"""Download official weights for local use; no remote inference."""
import os,sys
from pathlib import Path
os.environ.setdefault('HF_HUB_DISABLE_XET','1')
from huggingface_hub import snapshot_download
runtime=Path(sys.argv[1]).resolve()
models=runtime/'ComfyUI/models'
files=['vae/qwen_image_vae.safetensors','loras/krea2_style_reference.safetensors']
if not (models/'diffusion_models/krea2-turbo-local-fp8.safetensors').exists():files.append('diffusion_models/krea2_turbo_int8_convrot.safetensors')
if not (models/'text_encoders/qwen3vl_4b_native_bf16.safetensors').exists():files.append('text_encoders/qwen3vl_4b_fp8_scaled.safetensors')
missing=[name for name in files if not (models/name).exists()]
if missing:snapshot_download('Comfy-Org/Krea-2',allow_patterns=missing,local_dir=models,max_workers=2)
else:print('Existing local image weights retained; no duplicate download.',flush=True)
snapshot_download('tencent/Hunyuan3D-2mini',allow_patterns=['hunyuan3d-dit-v2-mini/config.yaml','hunyuan3d-dit-v2-mini/model.fp16.safetensors','LICENSE','NOTICE'],local_dir=runtime/'models/Hunyuan3D-2mini',max_workers=1)
print('Official model files downloaded. Run a pilot before relying on the installation.')
