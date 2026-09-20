import importlib.util
from pathlib import Path
ext=Path('../local-asset-runtime/modly-trellis2').resolve()
spec=importlib.util.spec_from_file_location('modly_setup',ext/'setup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m._install_cuda_wheels(ext/'venv',89,128)
m._patch_o_voxel_tiled_fdg(m._site_packages(ext/'venv'))
import torch,cumesh,flex_gemm,nvdiffrast,o_voxel
print('CUDA imports verified',torch.__version__,torch.cuda.is_available())
