"""Engine-specific five-minute profiles; never extrapolate mini timings to MV."""
def plan(settings):
    engine=settings.get('meshEngine','hunyuan')
    requested={'steps':settings['meshSteps'],'resolution':settings['meshResolution']}
    effective=dict(requested)
    if engine=='hunyuan-mv':
        effective={'steps':min(requested['steps'],30),'resolution':min(requested['resolution'],384)}
    limited=effective!=requested
    return {'engine':engine,'requested':requested,'effective':effective,'timeoutSeconds':300,
        'limited':limited,'note':('Five-minute multiview profile: at most 384 grid / 30 steps. 512/60 timed out on this GPU. Texture pixels are unchanged.' if engine=='hunyuan-mv' else 'Single-view settings; five-minute worker limit. Timings vary with the asset and GPU load.')}
