"""Video -> local tracking -> fitted rig -> isolated, reviewable animation candidate."""
import math,time,uuid,shutil
from pathlib import Path
from fastapi import Body,HTTPException
from motion_guides import brief
from motion_catalogue import CLIPS

def guide_for(p,clip):
    return p.get('motionGuides',{}).get(clip) or (p.get('motionGuide') if p.get('motionGuide',{}).get('clip','combined')==clip else None)

def validate_guide(p,guide,s):
    if not guide:raise HTTPException(409,'Import a video for this animation first.')
    current=brief(p,s,guide['recipe'].get('referenceMode','front'))
    if current['heroSha256']!=guide['recipe']['heroSha256'] or current['reference']!=guide['recipe']['reference'] or s.digest(s.output(p,guide['file']))!=guide['sha256']:
        raise HTTPException(409,'The video or character reference changed. Import a current guide.')

def register(app,s):
    scripts=Path(__file__).parent
    def idle(p):
        if s.ACTIVE or p['status'] in ['running','queued'] or any(x['status'] in ['running','queued'] for x in s.list_projects()):raise HTTPException(409,'Wait for the current local job.')

    def worker(key,identifier):
        p=s.project(key);item=next(c for c in p['videoConversions'] if c['id']==identifier);folder=s.output(p,item['folder']);folder.mkdir(exist_ok=True);s.ACTIVE={'project':key,'stage':'video-motion'};start=time.perf_counter()
        try:
            guide=guide_for(p,item['clip']);validate_guide(p,guide,s)
            s.update(p,'video-motion','running','Tracking this video locally. Existing animations remain saved.')
            pose={'video':str(s.output(p,guide['file'])),'output':str(folder/'poses.npz'),'model':str(s.RUNTIME/'models/pose_landmarker_heavy.task'),'start':item['start'],'end':item['end']};s.write(folder/'pose-task.json',pose)
            item['extractorSha256']=s.digest(scripts/'video_pose.py');item['poseModelSha256']=s.digest(Path(pose['model']))
            cached=next((c for c in reversed(p['videoConversions']) if c['id']!=identifier and all(c.get(k)==item.get(k) for k in ['videoSha256','start','end','extractorSha256','poseModelSha256']) and s.output(p,c['folder']+'/poses.npz').is_file() and s.read(s.output(p,c['folder']+'/poses.json'),{}).get('passed')),None)
            with s.timed_stage(p,'Video pose extraction'):
                if cached:
                    for suffix in ['.npz','.json','.mp4']:shutil.copy2(s.output(p,cached['folder']+'/poses'+suffix),folder/('poses'+suffix))
                    item['reusedTracking']=cached['id']
                else:s.run_process(p,[s.RUNTIME/'motion-env/Scripts/python.exe',scripts/'video_pose.py',folder/'pose-task.json'],timeout=300)
            item['overlay']=item['folder']+'/poses.mp4';item['trackingReport']=item['folder']+'/poses.json'
            s.cancelled(p)
            with s.timed_stage(p,'Video rig preparation'):rig=s.prepare_video_rig(p)
            item['rigFile']=str(rig.relative_to(s.PROJECTS/key));item['rigSha256']=s.digest(rig)
            task={'input':str(rig),'poses':str(folder/'poses.npz'),'output':str(folder/'candidate.glb'),'name':item['label']+' / video','clip':item['clip'],'contactRefinement':item['clip']!='death','loop':CLIPS.get(item['clip'],('',False,''))[1]}
            s.write(folder/'retarget-task.json',task)
            with s.timed_stage(p,'Video retarget and surface checks'):
                s.run_process(p,[s.RUNTIME/'blender-py311/Scripts/python.exe',scripts/'video_retarget.py',folder/'retarget-task.json'],timeout=300)
            chosen='candidate';report=s.read(folder/'candidate.json');item['attempts']=[{'file':chosen+'.glb','passed':report['passed']}]
            if task['loop'] and not report['passed']:
                for rank in [1,2]:
                    s.cancelled(p);name='candidate-loop-'+str(rank);task.update(output=str(folder/(name+'.glb')),loopRank=rank);s.write(folder/'retarget-task.json',task)
                    try:
                        with s.timed_stage(p,'Alternative measured loop '+str(rank)):
                            s.run_process(p,[s.RUNTIME/'blender-py311/Scripts/python.exe',scripts/'video_retarget.py',folder/'retarget-task.json'],timeout=120)
                        alternative=s.read(folder/(name+'.json'));item['attempts'].append({'file':name+'.glb','passed':alternative['passed']})
                        if alternative['passed']:chosen=name;report=alternative;break
                    except Exception as error:item['attempts'].append({'file':name+'.glb','passed':False,'error':str(error).splitlines()[-1][:250]})
            item['file']=item['folder']+'/'+chosen+'.glb';item['report']=item['folder']+'/'+chosen+'.json'
            asset=s.inspect_asset(folder/(chosen+'.glb'),'animation');s.write(folder/'asset-quality.json',asset)
            item.update(passed=report['passed'] and asset['status']!='fail',qualityContract=report.get('qualityContract',0),sha256=s.digest(folder/(chosen+'.glb')),status='review',skeletalMotionExtracted=True)
            item['message']='Candidate ready for comparison.' if item['passed'] else 'Candidate needs correction: '+', '.join(c['name'] for c in report['checks'] if not c['pass'])
            s.update(p,'video-motion','review',item['message'])
        except Exception as e:
            message=str(e).strip().splitlines()[-1][:350];(folder/'failure.txt').write_text(str(e),encoding='utf-8');item.update(status='failed',passed=False,message=message,diagnostic=item['folder']+'/failure.txt')
            if (folder/'poses.mp4').is_file():item['overlay']=item['folder']+'/poses.mp4'
            if (folder/'poses.json').is_file():item['trackingReport']=item['folder']+'/poses.json'
            s.update(p,'video-motion','error',message)
        finally:
            item['seconds']=round(time.perf_counter()-start,3);item['finishedAt']=time.time();s.save(p);s.ACTIVE=None;s.CANCEL.pop(key,None)

    @app.post('/api/projects/{key}/video-motion')
    def convert(key,body:dict=Body(...)):
        p=s.project(key);clip=body.get('clip','combined')
        if clip not in [*CLIPS,'combined']:raise HTTPException(400,'Unknown animation.')
        guide=guide_for(p,clip);validate_guide(p,guide,s)
        for file in [s.RUNTIME/'motion-env/Scripts/python.exe',s.RUNTIME/'models/pose_landmarker_heavy.task']:
            if not file.is_file():raise HTTPException(409,'Run the local video-motion setup first.')
        field='paint' if p.get('paint') else 'mesh';s.require_valid_output(p,field)
        try:start=float(body.get('start',0));end=float(body.get('end') or guide['metadata']['duration'])
        except (TypeError,ValueError):raise HTTPException(400,'Invalid trim times.')
        if not math.isfinite(start+end) or not 0<=start<end<=guide['metadata']['duration'] or end-start<1:raise HTTPException(400,'Choose at least one second inside this video.')
        with s.LOCK:
            idle(p);identifier=uuid.uuid4().hex[:12]
            item={'id':identifier,'clip':clip,'label':CLIPS.get(clip,('Walk + Strike',))[0],'folder':'video-'+identifier,'sourceSha256':s.digest(s.output(p,p[field])),
              'videoSha256':guide['sha256'],'start':start,'end':end,'createdAt':time.time(),'status':'queued','passed':False,'ownerApproved':False}
            p.setdefault('videoConversions',[]).append(item);s.CANCEL[key]=False;s.update(p,'video-motion','queued','Waiting for local video conversion.');s.POOL.submit(worker,key,identifier)
        return p

    @app.post('/api/projects/{key}/video-motion/{identifier}/use')
    def use(key,identifier,body:dict=Body(...)):
        p=s.project(key)
        with s.LOCK:
            idle(p);item=next((c for c in p.get('videoConversions',[]) if c['id']==identifier),None)
            if not item or not item.get('passed') or not item.get('file'):raise HTTPException(409,'This candidate has unresolved quality checks.')
            if item.get('qualityContract')!=2:raise HTTPException(409,'This candidate predates the current motion checks. Convert again; source-bound tracking can be reused.')
            guide=guide_for(p,item['clip']);validate_guide(p,guide,s)
            if not body.get('visualReviewConfirmed'):raise HTTPException(409,'Review the full exported animation and tracking overlay first.')
            if not guide.get('status')=='accepted-reference':raise HTTPException(409,'Accept this video reference before applying its motion.')
            source=s.output(p,p.get('paint') or p.get('mesh',''))
            if s.digest(source)!=item['sourceSha256'] or guide['sha256']!=item['videoSha256'] or s.digest(s.output(p,item['file']))!=item['sha256'] or s.digest(s.output(p,item['rigFile']))!=item['rigSha256']:
                raise HTTPException(409,'Source or candidate changed. Convert the current source again.')
            if p.get('animation') and p.get('motionInput')==item['sourceSha256'] and str(Path(p['animation']).with_suffix('.blend')).replace('\\','/')!=item['rigFile'].replace('\\','/'):
                raise HTTPException(409,'Other clips were applied after this conversion. Reconvert to retain them.')
            p.setdefault('refinementHistory',[]).append({k:p.get(k) for k in ['animation','motionInput','polished','reviewReports']})
            p.update(animation=item['file'],motionInput=item['sourceSha256'],polished=None,stage='animation',status='review',message='Video motion selected. Final animation approval and polish remain separate.')
            p.setdefault('reviewReports',{})['animation']=[item['report'],item['trackingReport']];p.setdefault('approvals',{}).pop('animation',None);p.setdefault('reviews',{}).pop('animation',None);item['visualReviewConfirmed']=True;s.save(p)
        return p
