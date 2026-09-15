"""Make approval MP3s using static gain, no denoising, compression or pitch changes."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def measure(path):
    run = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af",
                          "loudnorm=I=-19:TP=-2:LRA=11:print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True, check=True)
    return json.loads(run.stderr[run.stderr.rfind("{"):run.stderr.rfind("}")+1])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--comfy", type=Path, required=True)
    parser.add_argument("--input", type=Path, default=ROOT/"artifacts/planet-auditions")
    parser.add_argument("--output", type=Path, default=ROOT/"audio/auditions")
    parser.add_argument("--expected", type=int, default=5)
    args = parser.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    manifest = dict(version=1, status="Awaiting owner listening approval; never selected by in-game music",
                    model="ACE-Step 1.5 turbo, reference-conditioned cover/arrangement, audio-code planner disabled",
                    modelSHA256="bca0bfde54bc7177dc5939ca9e4fc94314b919f084044cd647347cdeac9bbd47",
                    sourceCommit="694a9723ff772285c73f0700caacf944d3f02f8d", tracks=[])
    for result in sorted(args.input.glob("*-result.json")):
        record = json.loads(result.read_text(encoding="utf-8"))
        recipe = record["recipe"]
        generated = record["history"]["outputs"]["11"]["audio"][0]
        raw = args.comfy/"output"/generated["subfolder"]/generated["filename"]
        seconds = record["seconds"]
        pre_gain = record.get("preExportGainDB", -9 if "12" in record["prompt"] else 0)
        silence = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", f"silencedetect=noise={-48+pre_gain}dB:d=4",
                                  "-f", "null", "-"], capture_output=True, text=True, check=True)
        gaps = [(float(a),float(b)) for a,b in re.findall(r"silence_start: ([\d.]+).*?silence_end: ([\d.]+)", silence.stderr, re.S)]
        quiet = []
        for start,end in gaps:
            if end >= seconds-.05:
                seconds=min(seconds,start+.25)  # Remove silence after a natural ending.
            elif end-start > 4:
                raise ValueError("Long internal quiet gap in generation: "+recipe["id"]+" "+str((start,end)))
            else:
                quiet.append(end-start)
        stats = measure(raw)
        integrated, peak = float(stats["input_i"]), float(stats["input_tp"])
        if not math.isfinite(integrated) or not math.isfinite(peak):
            raise ValueError("Silent or invalid generation: "+recipe["id"])
        if peak > -1:
            raise ValueError("Lossless export needs more headroom before mastering: "+recipe["id"])
        gain = min(-19-integrated, -2.5-peak)
        target = output/(recipe["id"]+".mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
                        f"volume={gain:.5f}dB,afade=t=in:d=0.08,afade=t=out:st={seconds-2}:d=2",
                        "-t", str(seconds),
                        "-map_metadata", "-1", "-metadata", "title="+recipe["title"],
                        "-metadata", "artist=Worldheart - approval draft", "-codec:a", "libmp3lame", "-q:a", "0", str(target)], check=True)
        final = measure(target)
        if float(final["input_tp"]) > -1.8:
            raise ValueError("Encoded peak too high: "+recipe["id"])
        if float(final["input_i"]) < -22.5:
            raise ValueError("Peak forces an excessively quiet master: "+recipe["id"])
        manifest["tracks"].append(dict(id=recipe["id"], title=recipe["title"], theme=recipe["theme"], file=target.name,
            reference=recipe["reference"], referenceSHA256=record["referenceSHA256"], duration=seconds, generatedSeconds=record["seconds"],
            seed=recipe["seed"], bpm=recipe["bpm"], key=recipe["key"], prompt=recipe["tags"], lyrics="[Instrumental]",
            referenceExcerpt=dict(start=16, seconds=record["referenceSeconds"]), bytes=target.stat().st_size,
            sha256=hashlib.sha256(target.read_bytes()).hexdigest(), rawSHA256=hashlib.sha256(raw.read_bytes()).hexdigest(),
            gainDB=round(gain,5), measuredLUFS=float(final["input_i"]), truePeakDBTP=float(final["input_tp"]),
            preExportGainDB=pre_gain, quietGapsOverFourSeconds=quiet,
            listeningStatus="Not auditioned by agent; owner must confirm musical fit and absence of voices"))
        print(recipe["id"], final["input_i"], "LUFS", final["input_tp"], "dBTP", flush=True)
    if len(manifest["tracks"]) != args.expected:
        raise ValueError("Completed draft count differs from --expected")
    (output/"manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
