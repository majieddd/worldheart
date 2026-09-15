"""Local, reference-conditioned approval drafts. Requires ComfyUI ACE-Step 1.5 and ffmpeg.

Usage: python tools/generate-planet-auditions.py --comfy PATH [--only garden]
Never changes the runtime soundtrack mapping. Outputs raw audio and exact API recipes
under ignored artifacts; mastering/public approval copies are a separate step.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RECIPES = [
    dict(id="garden", title="First Light Orchard", theme="Garden World", reference="playful", bpm=116, key="D major", seed=991501,
         tags="Instrumental orchestral adventure game music, playful chamber orchestra, warm legato strings, lyrical wooden flute melody, celesta answers, pizzicato double bass, soft hand percussion, curious joyful exploration of a lush garden planet. Memorable original melodic theme, clear introduction, developed contrasting middle section and resolved ending. Rich clean acoustic production, gentle transients, no hiss. Instruments only, no vocals, no singing, no spoken words, no choir, no vocal samples."),
    dict(id="canopy", title="Coral Canopy", theme="Canopy World", reference="tropical", bpm=104, key="G major", seed=991502,
         tags="Instrumental tropical adventure game soundtrack, dancing marimba melody, rounded wooden flute, nylon guitar arpeggios, warm plucked bass, gentle congas and shakers, subtle orchestral strings. Wonder and discovery in a colorful rainforest above a turquoise ocean. Original melodic call and response, evolving arrangement with a quieter bridge, satisfying instrumental ending. Clear high fidelity acoustic mix, no background noise. Instruments only, no vocals, no singing, no words, no choir, no vocal samples."),
    dict(id="dune", title="Amber Caravan", theme="Dune World", reference="desertBoss", bpm=100, key="D minor", seed=991503,
         tags="Instrumental cinematic desert exploration game music, warm oud and plucked lute melody, expressive low wooden flute, resonant but gentle frame drums, cello and viola ostinato, golden brass accents. Ancient sunlit canyons, adventurous and mysterious rather than aggressive. Original memorable melody, spacious opening, developing second theme, rhythmic middle and gentle resolved ending. Rich warm recording, soft high frequencies, no hiss. Instruments only, no vocals, no singing, no words, no choir, no vocal samples."),
    dict(id="frozen", title="Aurora Observatory", theme="Cryosphere", reference="planet", bpm=84, key="A major", seed=991504,
         tags="Instrumental orchestral space exploration game music, tender celesta melody, harp arpeggios, expressive warm string ensemble, gentle bass clarinet, sparse tuned percussion. Sparkling frozen valleys under a colorful aurora, graceful magical wonder. Full melodic arrangement, intimate opening expands to broad strings, contrasting middle and calm resolved ending. Clear natural recording, warm low mids, rounded bells, no noise or hiss. Instruments only, no vocals, no singing, no spoken words, absolutely no choir or voice pads."),
    dict(id="molten", title="Ember Orbit", theme="Molten World", reference="cinematicBoss", bpm=112, key="E minor", seed=991505,
         tags="Instrumental orchestral volcanic planet adventure game soundtrack, rich low cello ostinato, rounded French horn melody, warm trombone responses, deep soft-edged orchestral toms, plucked strings and marimba sparks. Majestic lava rivers and courageous exploration, energetic but not harsh. Original melodic motif grows through contrasting passages to a satisfying orchestral ending. Full clear cinematic recording, controlled treble, no distortion or hiss. Instruments only, no vocals, no singing, no words, no choir, no vocal samples."),
]


def request(url, data=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.load(response)


def graph(recipe, model, reference, seconds):
    node = lambda kind, **inputs: dict(class_type=kind, inputs=inputs)
    return {
        "1": node("CheckpointLoaderSimple", ckpt_name=model),
        "2": node("TextEncodeAceStepAudio1.5", clip=["1", 1], tags=recipe["tags"], lyrics="[Instrumental]",
                  seed=recipe["seed"], bpm=recipe["bpm"], duration=seconds, timesignature="4", language="unknown",
                  keyscale=recipe["key"], generate_audio_codes=False, cfg_scale=2.0, temperature=.85, top_p=.9, top_k=0, min_p=0),
        "3": node("LoadAudio", audio=reference),
        "4": node("VAEEncodeAudio", audio=["3", 0], vae=["1", 2]),
        "5": node("ReferenceTimbreAudio", conditioning=["2", 0], latent=["4", 0]),
        "6": node("ConditioningZeroOut", conditioning=["2", 0]),
        "7": node("ModelSamplingAuraFlow", model=["1", 0], shift=3.0),
        "8": node("EmptyAceStep1.5LatentAudio", seconds=seconds, batch_size=1),
        "9": node("KSampler", model=["7", 0], seed=recipe["seed"], steps=8, cfg=1.0, sampler_name="euler",
                  scheduler="simple", positive=["5", 0], negative=["6", 0], latent_image=["8", 0], denoise=1.0),
        "10": node("VAEDecodeAudioTiled", samples=["9", 0], vae=["1", 2], tile_size=512, overlap=64),
        "12": node("AudioAdjustVolume", audio=["10", 0], volume=-9),
        "11": node("SaveAudio", audio=["12", 0], filename_prefix="worldheart-auditions/"+recipe["id"]),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--comfy", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8189")
    parser.add_argument("--model", default="ace_step_1.5_turbo_reference.safetensors")
    parser.add_argument("--only")
    parser.add_argument("--seconds", type=float, default=96)
    args = parser.parse_args()
    out = ROOT/"artifacts/planet-auditions"
    out.mkdir(parents=True, exist_ok=True)
    for recipe in RECIPES:
        if args.only and recipe["id"] != args.only:
            continue
        result_path = out/(recipe["id"]+"-result.json")
        if result_path.exists():
            print(recipe["id"], "already generated; keeping original result", flush=True)
            continue
        source = ROOT/"audio/soundtrack"/(recipe["reference"]+".mp3")
        reference = "worldheart-reference-"+recipe["id"]+".wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "16", "-i", str(source), "-t", str(args.seconds),
                        "-ar", "48000", "-ac", "2", str(args.comfy/"input"/reference)], check=True)
        prompt = graph(recipe, args.model, reference, args.seconds)
        record = dict(recipe=recipe, model=args.model, seconds=args.seconds,
                      referenceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(), referenceStart=16, referenceSeconds=args.seconds,
                      prompt=prompt, status="approval-only; not integrated into game music")
        (out/(recipe["id"]+"-recipe.json")).write_text(json.dumps(record, indent=2))
        submitted = request(args.url+"/prompt", {"prompt": prompt, "client_id": "worldheart-planet-auditions"})
        prompt_id = submitted["prompt_id"]
        print(recipe["id"], "submitted", prompt_id, flush=True)
        started = time.time()
        while time.time()-started < 1800:
            history = request(args.url+"/history/"+prompt_id).get(prompt_id)
            if history:
                record["elapsedSeconds"] = round(time.time()-started, 2)
                record["history"] = history
                if history.get("status", {}).get("status_str") == "error":
                    (out/(recipe["id"]+"-error.json")).write_text(json.dumps(record, indent=2))
                    raise RuntimeError(str(history["status"]))
                result_path.write_text(json.dumps(record, indent=2))
                print(recipe["id"], "completed", record["elapsedSeconds"], history.get("outputs"), flush=True)
                break
            time.sleep(5)
        else:
            raise TimeoutError("Generation exceeded 30 minutes: "+prompt_id)


if __name__ == "__main__":
    main()
