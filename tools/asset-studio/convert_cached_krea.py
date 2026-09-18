"""Optional local conversion of existing diffusers Krea weights, with full key/shape validation."""
import json,sys,time
from pathlib import Path
import torch
from safetensors import safe_open
from safetensors.torch import save_file
source=Path(sys.argv[1]);runtime=Path(sys.argv[2]);sys.path.insert(0,str(runtime/'ComfyUI'))
# The command-line arguments are for this converter, not ComfyUI's CLI.
sys.argv=sys.argv[:1]
from comfy.ldm.krea2.model import SingleStreamDiT
import comfy.ops
expected=SingleStreamDiT(device='meta',dtype=torch.bfloat16,operations=comfy.ops.disable_weight_init).state_dict()
mapping=[('text_fusion.','txtfusion.'),('transformer_blocks.','blocks.'),('img_in.','first.'),('time_embed.linear_1.','tmlp.0.'),('time_embed.linear_2.','tmlp.2.'),('time_mod_proj.','tproj.1.'),('txt_in.norm.weight','txtmlp.0.scale'),('txt_in.linear_1.','txtmlp.1.'),('txt_in.linear_2.','txtmlp.3.'),('text_proj.norm.weight','txtmlp.0.scale'),('text_proj.linear_1.','txtmlp.1.'),('text_proj.linear_2.','txtmlp.3.'),('final_layer.','last.'),('.attn.norm_q.weight','.attn.qknorm.qnorm.scale'),('.attn.norm_k.weight','.attn.qknorm.knorm.scale'),('.attn.to_q.','.attn.wq.'),('.attn.to_k.','.attn.wk.'),('.attn.to_v.','.attn.wv.'),('.attn.to_gate.','.attn.gate.'),('.attn.to_out.0.','.attn.wo.'),('.ff.','.mlp.'),('.norm1.weight','.prenorm.scale'),('.norm2.weight','.postnorm.scale'),('last.norm.weight','last.norm.scale'),('last.scale_shift_table','last.modulation.lin'),('.scale_shift_table','.mod.lin')]
def rename(key):
    for before,after in mapping:key=key.replace(before,after)
    return key
index=json.loads((source/'transformer/diffusion_pytorch_model.safetensors.index.json').read_text())['weight_map']
keys={rename(k):k for k in index}
if set(keys)!=set(expected):raise ValueError({'missing':sorted(set(expected)-set(keys)),'extra':sorted(set(keys)-set(expected))})
state={};start=time.time()
for filename in sorted(set(index.values())):
    print('Converting '+filename,flush=True)
    with safe_open(source/'transformer'/filename,framework='pt',device='cpu') as f:
        for key in f.keys():
            dest=rename(key);tensor=f.get_tensor(key)
            if dest.endswith('.mod.lin'):tensor=tensor.reshape(-1)
            if tensor.shape!=expected[dest].shape:raise ValueError((dest,tensor.shape,expected[dest].shape))
            state[dest]=tensor.to(torch.float8_e4m3fn if tensor.ndim==2 and tensor.numel()>1000000 else torch.bfloat16).contiguous()
out=runtime/'ComfyUI/models/diffusion_models/krea2-turbo-local-fp8.safetensors'
print('Saving validated native checkpoint',flush=True);save_file(state,str(out),metadata={'source':'Local unsloth/Krea-2-Turbo cache','conversion':'Diffusers to ComfyUI key mapping; large matrices FP8 E4M3FN, remaining tensors BF16','checked':'All keys and shapes match ComfyUI SingleStreamDiT'})
out.with_suffix('.json').write_text(json.dumps({'source':str(source),'tensors':len(state),'seconds':time.time()-start,'quantization':'FP8 E4M3FN','keyShapeValidation':True},indent=2),encoding='utf-8');print(out,flush=True)
del state
encoder=runtime/'ComfyUI/models/text_encoders/qwen3vl_4b_native_bf16.safetensors'
with safe_open(source/'text_encoder/model.safetensors',framework='pt',device='cpu') as f:
    text_state={'model.'+key:f.get_tensor(key) for key in f.keys()}
assert text_state['model.visual.merger.linear_fc2.weight'].shape[0]==2560
save_file(text_state,str(encoder),metadata={'source':'Local Krea Qwen3VL4B cache','conversion':'Added model. namespace for ComfyUI detection; tensor values unchanged.'})
print(encoder,flush=True)
