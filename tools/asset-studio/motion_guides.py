"""Optional external video references; never substitute video for skeletal motion."""
import json,math,time,uuid
from pathlib import Path
from fastapi import HTTPException,UploadFile,File,Body,Form
from fastapi.responses import JSONResponse
from PIL import Image,ImageDraw
from workflows import STYLE

MODEL='MiniMax-H3'
PHASES=[('neutral',0,1),('walk',1,5),('settle',5,6),('anticipation',6,7),('strike',7,8),('recovery',8,10),('neutral',10,12)]
CHECKS=['identity','camera','feet','timing']

def brief(p,s,reference='front'):
    if not p.get('art'):raise HTTPException(409,'Create or import the character concept first.')
    if reference not in ['front','hero']:raise HTTPException(400,'Choose hero or front reference.')
    source=(p.get('referencePack',{}).get('outputs',{}).get('front',{}).get('file') if reference=='front' else None) or p['art']
    prompt=(f'Technical character motion reference for {p["name"]}. Identity: {p["description"]}. '
      'The attached approved character is authoritative. Preserve face, anatomy, proportions, fingers, costume asymmetry, palette and every material. '
      +STYLE[p['style']][1]+' One character, complete full body with generous margins, plain light gray floor and background. '
      'Fixed waist-height three-quarter side camera, no cuts, orbit, zoom, blur, VFX, props, text or UI. '
      '12 seconds, real-time: 0-1 neutral; 1-5 two complete WALK IN PLACE cycles with heel contact, flat planted support, trailing toe-off, knee flexion, pelvis weight shift and opposite arm swing; '
      '5-6 smoothly settle; 6-7 anticipate ONE right-hand unarmed strike, pelvis leads chest; 7-8 extend with a soft elbow and balanced planted feet; '
      '8-10 controlled recovery; 10-12 neutral hold. Relax fingers while walking; close the striking fist without merging digits. '
      'No sliding, floating feet, changed limb lengths or additional strikes. Weighty and fluid. Silent clip.')
    return {'version':1,'provider':'MiniMax / external generation','model':MODEL,'duration':12,'resolution':'2K','aspectRatio':'16:9',
      'referenceMode':reference,'reference':{'file':source,'sha256':s.digest(s.output(p,source))},'heroSha256':s.digest(s.output(p,p['art'])),
      'prompt':prompt,'requestedPhases':[{'name':n,'start':a,'end':b} for n,a,b in PHASES],
      'boundary':'Visual reference only. The current rig worker consumes captured skeletal motion, not this video. Pose extraction, cleanup and retarget validation are required before video-driven animation.',
      'review':{'identity':'Same character and intact anatomy throughout','camera':'Full body and feet visible; fixed camera; no cuts','feet':'Ground contact, foot roll and weight transfer are believable','timing':'Observe actual phase boundaries; requested timestamps are not measured motion data'}}

def inspect_video(path,sheet):
    import cv2
    cap=cv2.VideoCapture(str(path))
    try:
        fps=cap.get(cv2.CAP_PROP_FPS);count=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        width=cap.get(cv2.CAP_PROP_FRAME_WIDTH);height=cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        if not all(math.isfinite(x) and x>0 for x in [fps,count,width,height]) or max(width,height)>4096 or not 4<=count/fps<=16:
            raise ValueError('Use a readable full-body MP4 guide lasting 4-16 seconds, up to 4096 pixels per side.')
        duration=count/fps;board=Image.new('RGB',(1280,810),'#e9ede7');draw=ImageDraw.Draw(board);times=[]
        for i in range(12):
            at=i*(duration-1/fps)/11;cap.set(cv2.CAP_PROP_POS_MSEC,at*1000);ok,frame=cap.read()
            if not ok:raise ValueError('The video has unreadable sample frames.')
            image=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));image.thumbnail((310,240))
            x=(i%4)*320;y=(i//4)*270;board.paste(image,(x+(320-image.width)//2,y+23));draw.text((x+10,y+5),f'{at:.2f} s',fill='#20282c');times.append(round(at,4))
        board.save(sheet)
        return {'duration':duration,'fps':fps,'frames':int(count),'width':int(width),'height':int(height),'sampleTimes':times}
    finally:cap.release()

def register(app,s):
    @app.get('/api/projects/{key}/motion-guide/brief')
    def get_brief(key,reference:str='front'):
        return JSONResponse(brief(s.project(key),s,reference),headers={'Content-Disposition':'attachment; filename="minimax-h3-motion-brief.json"'})

    @app.post('/api/projects/{key}/motion-guide')
    async def import_guide(key,file:UploadFile=File(...),model:str=MODEL,job_id:str='',reference:str='front',generation_prompt:str=Form('')):
        p=s.project(key)
        if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current project job.')
        if model not in [MODEL,'MiniMax-H3-Max','Other / imported']:raise HTTPException(400,'Unknown guide model.')
        if Path(file.filename or '').suffix.lower()!='.mp4':raise HTTPException(400,'Import an MP4 video.')
        if len(generation_prompt)>7000:raise HTTPException(400,'Generation prompt exceeds 7000 characters.')
        recipe=brief(p,s,reference);name='motion-guide-'+uuid.uuid4().hex[:10]+'.mp4';path=s.output(p,name);size=0;start=time.perf_counter()
        try:
            with path.open('wb') as dest:
                while chunk:=await file.read(1024*1024):
                    size+=len(chunk)
                    if size>100*1024*1024:raise HTTPException(413,'Guide exceeds 100 MB.')
                    dest.write(chunk)
            metadata=inspect_video(path,path.with_suffix('.jpg'))
        except Exception as e:
            path.unlink(missing_ok=True);path.with_suffix('.jpg').unlink(missing_ok=True)
            if isinstance(e,HTTPException):raise
            raise HTTPException(400,str(e)) from e
        guide={'file':name,'sha256':s.digest(path),'sheet':path.with_suffix('.jpg').name,'receipt':name+'.json','model':model,
          'jobId':job_id[:100],'providerIdentity':'Importer-reported; verify against provider receipt','recipe':recipe,'metadata':metadata,
          'generationPrompt':generation_prompt or None,'status':'review','review':None,'importSeconds':round(time.perf_counter()-start,3),'skeletalMotionExtracted':False}
        if p.get('motionGuide'):p.setdefault('motionGuideHistory',[]).append(p['motionGuide'])
        p['motionGuide']=guide;s.write(s.output(p,guide['receipt']),guide);s.save(p);return p

    @app.post('/api/projects/{key}/motion-guide/review')
    def review_guide(key,body:dict=Body(...)):
        p=s.project(key);guide=p.get('motionGuide')
        if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current project job.')
        if not guide:raise HTTPException(409,'Import a video guide first.')
        recipe=brief(p,s,guide['recipe'].get('referenceMode','front'))
        if recipe['heroSha256']!=guide['recipe']['heroSha256'] or recipe['reference']!=guide['recipe']['reference'] or s.digest(s.output(p,guide['file']))!=guide['sha256']:
            raise HTTPException(409,'The character reference or video changed. Import a current guide.')
        if body.get('decision') not in ['accept','reject']:raise HTTPException(400,'Accept or reject the reference.')
        checks=body.get('checks',{})
        if body['decision']=='accept' and not all(checks.get(k) is True for k in CHECKS):raise HTTPException(400,'Watch the entire clip and confirm each reference check.')
        guide['status']='accepted-reference' if body['decision']=='accept' else 'rejected-reference'
        guide['review']={'checks':checks,'notes':str(body.get('notes',''))[:1500],'reviewer':str(body.get('reviewer','owner'))[:30],'time':time.time()}
        s.write(s.output(p,guide['receipt']),guide);s.save(p);return p
