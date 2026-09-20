"""Local ComfyUI API graphs. No paid or remote inference providers."""
STYLE = {
    'painted-anime-inkline': ('Painted-Anime-Inkline', 'Hand-painted anime illustration with whimsical environmental light, confident dark outer contours, fine broken interior ink, rich colored cel shadows, broad opaque gouache color, selective material wear and crisp facial detail. Studio Ghibli painted warmth meets Borderlands comic grit. Preserve the subject anatomy, proportions, colors and signature props. No crosshatch shadow fill, glossy toy look, blurry texture, or screen-space pattern.'),
    'hard-cel': ('Hard Cel 1.0', 'Crisp hand-painted surfaces, sharp two-to-three-band colored cel shadows, clean dark contours, readable Roblox-compatible proportions, restrained edge wear, saturated accents. No crosshatching or screen-space noise.'),
    'atmospheric-ink': ('Atmospheric Ink 1.3.1', 'Painted illustrative surfaces, precise dark contour, deep colored shadows, subtle atmospheric recession, restrained haze, whimsical ecology and purposeful wear. Crisp foreground detail and legible silhouettes. No hatched 3D shadows.'),
    'vivid-paint': ('Vivid Paint', 'Painted-Anime-Inkline with bold black contour, dark colored shadow, rich local color and crisp painterly surface detail. Restrained atmospheric haze, clear foreground shapes, illustrative comic grit, no crosshatch fill.')
}

def compose_prompt(description, style, count=0):
    reference = 'Reference pictures preserve identity and rendering; do not add their background to the asset. ' if count else ''
    return f'{description.strip()} {reference}{STYLE[style][1]} Single isolated full-body asset, three-quarter front, neutral relaxed A-pose with hands separated from body, complete feet and extremities, generous margins, even neutral lighting, plain light gray background. No scenery, text, watermark or ground shadow.'

def krea_graph(prompt, settings, references, prefix):
    if settings.get('identityEdit') and references:
        return identity_edit_graph(prompt,settings,references,prefix)
    width, height = settings.get('width', 768), settings.get('height', 1024)
    graph = {}
    def node(key, kind, **inputs):
        graph[str(key)] = {'class_type': kind, 'inputs': inputs}
        return [str(key), 0]
    model = node(1, 'UNETLoader', unet_name=settings['model'], weight_dtype='default')
    clip = node(2, 'CLIPLoader', clip_name=settings.get('encoder','qwen3vl_4b_fp8_scaled.safetensors'), type='krea2', device='cpu')
    vae = node(3, 'VAELoader', vae_name='qwen_image_vae.safetensors')
    for i, lora in enumerate(settings.get('loras', [])):
        model = node(40+i, 'LoraLoaderModelOnly', model=model, lora_name=lora['name'], strength_model=lora['strength'])
    refs = {f'image{i+1}': node(50+i, 'LoadImage', image=file) for i, file in enumerate(references[:3])}
    if refs:
        positive = node(4, 'TextEncodeQwenImageEditPlus', clip=clip, vae=vae, prompt=prompt, **refs)
        positive = node(5, 'FluxKontextMultiReferenceLatentMethod', conditioning=positive, reference_latents_method='index_timestep_zero')
    else:
        positive = node(4, 'CLIPTextEncode', clip=clip, text=prompt)
    negative = node(6, 'ConditioningZeroOut', conditioning=positive)
    model = node(7, 'ModelSamplingFlux', model=model, max_shift=1.15, base_shift=.5, width=width, height=height)
    noise = node(8, 'RandomNoise', noise_seed=settings['seed'])
    guider = node(9, 'CFGGuider', model=model, positive=positive, negative=negative, cfg=1.)
    sampler = node(10, 'KSamplerSelect', sampler_name='euler')
    sigmas = node(11, 'BasicScheduler', model=model, scheduler='simple', steps=settings.get('steps', 8), denoise=1.)
    latent = node(12, 'EmptyLatentImage', width=width, height=height, batch_size=1)
    samples = node(13, 'SamplerCustomAdvanced', noise=noise, guider=guider, sampler=sampler, sigmas=sigmas, latent_image=latent)
    image = node(14, 'VAEDecode', samples=samples, vae=vae)
    node(15, 'SaveImage', images=image, filename_prefix=prefix)
    return graph

def identity_edit_graph(prompt,settings,references,prefix):
    """Training-matched dual conditioning, not the style-reference latent path."""
    graph={}
    def node(key,kind,**inputs):
        graph[str(key)]={'class_type':kind,'inputs':inputs};return [str(key),0]
    model=node(1,'UNETLoader',unet_name=settings['model'],weight_dtype='default')
    clip=node(2,'CLIPLoader',clip_name=settings.get('encoder','qwen3vl_4b_fp8_scaled.safetensors'),type='krea2',device='cpu')
    vae=node(3,'VAELoader',vae_name='qwen_image_vae.safetensors')
    model=node(4,'LoraLoaderModelOnly',model=model,lora_name='krea2_identity_edit_v1_2.safetensors',strength_model=1.0)
    for i,lora in enumerate(settings.get('loras',[])):
        if 'style_reference' in lora['name'] or 'identity_edit' in lora['name']:continue
        model=node(40+i,'LoraLoaderModelOnly',model=model,lora_name=lora['name'],strength_model=lora['strength'])
    image=node(5,'LoadImage',image=references[0])
    latent=node(6,'EmptySD3LatentImage',width=settings['width'],height=settings['height'],batch_size=1)
    source=node(7,'VAEEncode',pixels=image,vae=vae)
    model=node(8,'Krea2EditModelPatch',model=model,source_latent=source,vae=vae,source_image=image,
               target_latent=latent,fit_mode='fit',ref_boost=settings.get('referenceFidelity',2.0),ref_boost_a=1.0)
    positive=node(9,'Krea2EditGroundedEncode',clip=clip,prompt=prompt,image=image,grounding_px=768,system_prompt='')
    negative=node(10,'Krea2EditGroundedEncode',clip=clip,prompt='',image=image,grounding_px=768,system_prompt='')
    samples=node(11,'KSampler',model=model,positive=positive,negative=negative,latent_image=latent,
                 seed=settings['seed'],steps=settings.get('steps',8),cfg=1.0,sampler_name='euler',scheduler='simple',denoise=1.0)
    decoded=node(12,'VAEDecode',samples=samples,vae=vae)
    node(13,'SaveImage',images=decoded,filename_prefix=prefix)
    return graph

def checkpoint_graph(prompt, settings, prefix):
    # SDXL/SD1.5 checkpoints use a separate graph; Krea LoRAs never cross families.
    g = {'1': {'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':settings['model']}}}
    model, clip = ['1',0], ['1',1]
    for i,lora in enumerate(settings.get('loras', [])):
        key=str(30+i);g[key]={'class_type':'LoraLoader','inputs':{'model':model,'clip':clip,'lora_name':lora['name'],'strength_model':lora['strength'],'strength_clip':lora['strength']}};model,clip=[key,0],[key,1]
    g.update({'2':{'class_type':'CLIPTextEncode','inputs':{'clip':clip,'text':prompt}},'3':{'class_type':'CLIPTextEncode','inputs':{'clip':clip,'text':'blur, watermark, text, cropped feet, extra limbs, glossy plastic'}},'4':{'class_type':'EmptyLatentImage','inputs':{'width':settings['width'],'height':settings['height'],'batch_size':1}},'5':{'class_type':'KSampler','inputs':{'model':model,'positive':['2',0],'negative':['3',0],'latent_image':['4',0],'seed':settings['seed'],'steps':settings['steps'],'cfg':5.5,'sampler_name':'euler','scheduler':'normal','denoise':1.}},'6':{'class_type':'VAEDecode','inputs':{'samples':['5',0],'vae':['1',2]}},'7':{'class_type':'SaveImage','inputs':{'images':['6',0],'filename_prefix':prefix}}})
    return g
