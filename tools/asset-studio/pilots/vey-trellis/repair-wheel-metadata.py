import zipfile,subprocess,sys,importlib.util
from pathlib import Path
root=Path('../local-asset-runtime/modly-trellis2').resolve();dest=root/'wheels/normalized';dest.mkdir(exist_ok=True)
for source in (root/'wheels').glob('*.whl'):
 with zipfile.ZipFile(source) as z,zipfile.ZipFile(dest/source.name,'w',zipfile.ZIP_DEFLATED) as out:
  for n in z.namelist():
   new=n.replace('flex-gemm-','flex_gemm-').replace('o-voxel-','o_voxel-')
   data=z.read(n)
   if n.endswith('/RECORD'):data=data.decode().replace('flex-gemm-','flex_gemm-').replace('o-voxel-','o_voxel-').encode()
   out.writestr(new,data)
 subprocess.run([sys.executable,'-m','pip','install','--no-deps',str(dest/source.name)],check=True)
spec=importlib.util.spec_from_file_location('modly_setup',root/'setup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m._patch_o_voxel_tiled_fdg(m._site_packages(root/'venv'))
import torch,cumesh,flex_gemm,nvdiffrast,o_voxel
print('CUDA imports verified',torch.__version__,torch.cuda.is_available())
