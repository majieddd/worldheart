"""Reproducible isolated CPU tracking setup; never changes the existing 3D workers."""
import hashlib,subprocess,sys,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];RUNTIME=ROOT.parent/'local-asset-runtime'
MODEL_URL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task'
MODEL_SHA='64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b'
def setup():
    env=RUNTIME/'motion-env';python=env/'Scripts/python.exe'
    if not python.exists():subprocess.run([sys.executable,'-m','venv',str(env)],check=True)
    subprocess.run([str(python),'-m','pip','install','mediapipe==0.10.32','scipy==1.18.1'],check=True)
    model=RUNTIME/'models/pose_landmarker_heavy.task';model.parent.mkdir(exist_ok=True)
    if not model.exists():
        temporary=model.with_suffix('.download');urllib.request.urlretrieve(MODEL_URL,temporary)
        if hashlib.sha256(temporary.read_bytes()).hexdigest()!=MODEL_SHA:raise ValueError('Pose model hash mismatch; retained download for inspection.')
        temporary.replace(model)
    if hashlib.sha256(model.read_bytes()).hexdigest()!=MODEL_SHA:raise ValueError('Existing pose model hash mismatch.')
    print('Local CPU body tracking is ready. Each converted animation remains a review candidate.')
if __name__=='__main__':setup()
