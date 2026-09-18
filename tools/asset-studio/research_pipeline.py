"""Local reference imports and isolated research candidates for Asset Studio."""
import json
import time
import uuid
from pathlib import Path
from fastapi import Body, File, HTTPException, UploadFile


def register(app, s):
    library=s.DATA/'motion-library';library.mkdir(exist_ok=True)
    scripts=Path(__file__).parent

    def available():
        trial=s.read(s.DATA/'research-runtime.json',{})
        return {'mixamo':(s.RUNTIME/'blender-py311/Scripts/python.exe').is_file(),
            'mia':bool(trial.get('mia')) and (s.RUNTIME/'mia-env/Scripts/python.exe').is_file(),
            'instantmesh':bool(trial.get('instantmesh')) and (s.RUNTIME/'instantmesh-env/Scripts/python.exe').is_file(),
            'note':'Research engines create separate candidates. Installed and executed does not mean visually accepted.',
            'trial':trial}

    def motions():
        result=[]
        for path in library.glob('*.json'):
            row=s.read(path,{})
            if path.with_suffix('.npz').is_file():
                result.append({**row,'id':path.stem})
        return result

    def dataset_root():
        # Reuse the owner's HF download, including Windows' non-symlink cache.
        from huggingface_hub.constants import HF_HUB_CACHE
        return Path(HF_HUB_CACHE)/'datasets--jasongzy--Mixamo/snapshots/b1c7f4975ea3261d3d0aa2379f6e24754ccde9d8'

    @app.get('/api/projects/{key}/dataset-motions')
    def dataset_motions(key):
        s.project(key);root=dataset_root()
        inventory=s.read(library/'dataset/manifest.json',{}).get('files',[])
        files=[]
        for entry in inventory:
            name=entry['path']
            if not name.startswith(('animation/','animation_extra/')):continue
            path=root/name
            if path.is_file() and path.stat().st_size==entry['bytes']:
                files.append({'id':name,'bytes':entry['bytes']})
        return {'available':files,'total':sum(x['path'].startswith(('animation/','animation_extra/')) for x in inventory),
                'note':'Original dataset IDs. Import a selected capture to inspect its timing. Captures are not assumed to be walk/run loops.'}

    @app.post('/api/projects/{key}/dataset-motions/import')
    def import_dataset_motion(key,body:dict=Body(...)):
        p=s.project(key)
        with s.LOCK:
            idle(p);name=body.get('id')
            inventory=s.read(library/'dataset/manifest.json',{}).get('files',[])
            entry=next((x for x in inventory if x['path']==name and x['path'].startswith(('animation/','animation_extra/'))),None)
            if not entry:raise HTTPException(400,'Choose an indexed dataset capture')
            source=dataset_root()/name
            if not source.is_file() or source.stat().st_size!=entry['bytes']:raise HTTPException(409,'Capture is still downloading')
            if entry.get('sha256') and s.digest(source)!=entry['sha256']:raise HTTPException(409,'Dataset hash mismatch')
            filename='dataset-'+Path(name).stem+'.fbx'
            if (library/filename).with_suffix('.npz').exists():return {'message':'Capture already imported'}
            import shutil
            shutil.copy2(source,library/filename)
            s.update(p,'motion-import','queued','Preparing the selected original dataset capture.')
            s.POOL.submit(import_job,key,filename,Path(name).stem,'https://huggingface.co/datasets/jasongzy/Mixamo')
        return {'message':'Capture import queued; source timing is preserved'}

    def idle(p):
        if s.ACTIVE or p['status'] in ['queued','running'] or any(x['status'] in ['queued','running'] for x in s.list_projects()):
            raise HTTPException(409,'Wait for the current local job.')

    def source_model(p):
        field='paint' if p.get('paint') else 'mesh'
        if not p.get(field):raise HTTPException(409,'Create or import the model first.')
        s.require_valid_output(p,field)
        return p[field]

    def source_rig(p,target=None):
        if target:
            item=next((x for x in p.get('researchCandidates',[]) if x['id']==target),None)
            if not item or not item.get('passed') or not item.get('file') or item['method'] not in ['mia','mixamo']:
                raise HTTPException(409,'Choose a rig candidate that passed its checks.')
            if item['sourceSha256']!=s.digest(s.output(p,source_model(p))):raise HTTPException(409,'Candidate rig belongs to an older model.')
            filename=item['file']
        else:filename=p.get('animation')
        if not filename or not s.output(p,filename).with_suffix('.blend').is_file():
            raise HTTPException(409,'Prepare a fitted rig in Studio, or test MIA first. A GLB alone does not include the editable source rig.')
        return s.output(p,filename).with_suffix('.blend')

    @app.get('/api/projects/{key}/research')
    def status(key):
        p=s.project(key)
        return {'project':p,'motions':motions(),'engines':available()}

    def import_job(key,filename,label,source_url):
        p=s.project(key);s.ACTIVE={'project':key,'stage':'motion-import'}
        try:
            s.update(p,'motion-import','running','Importing the local capture and retaining its original timing.')
            dest=library/(Path(filename).stem+'.npz')
            with s.timed_stage(p,'Mixamo reference import'):
                s.run_process(p,[s.RUNTIME/'blender-py311/Scripts/python.exe',scripts/'mixamo_extract.py','--input',library/filename,'--output',dest,'--name',label])
            receipt=s.read(dest.with_suffix('.json'));receipt['sourceUrl']=source_url;receipt['sourceFile']=filename;s.write(dest.with_suffix('.json'),receipt)
            s.update(p,'motion-import','review','Capture imported. Choose it below to retarget your fitted model.')
        except Exception as e:s.update(p,'motion-import','error',str(e))
        finally:s.ACTIVE=None;s.CANCEL.pop(key,None)

    @app.post('/api/projects/{key}/motion-library')
    async def import_motion(key,file:UploadFile=File(...)):
        p=s.project(key)
        with s.LOCK:idle(p)
        if Path(file.filename or '').suffix.lower()!='.fbx':raise HTTPException(400,'Choose a Mixamo FBX capture.')
        raw=await file.read(256*1024*1024+1)
        if len(raw)>256*1024*1024:raise HTTPException(413,'Maximum capture size is 256 MB.')
        if not (raw.startswith(b'Kaydara FBX Binary') or b'FBXHeaderExtension' in raw[:4096]):raise HTTPException(400,'File is not an FBX capture.')
        filename='capture-'+uuid.uuid4().hex[:12]+'.fbx';(library/filename).write_bytes(raw)
        label=Path(file.filename).stem[:80]
        with s.LOCK:
            idle(p);s.CANCEL[key]=False;s.update(p,'motion-import','queued','Waiting for capture import.')
            s.POOL.submit(import_job,key,filename,label,'User-supplied local FBX; exact download URL not recorded')
        return p

    def execute(key,item,task,production=None):
        p=production if production is not None else s.project(key)
        if production is None:s.ACTIVE={'project':key,'stage':'research-'+item['method']}
        # Reload the same persisted item so timings/status edits share one object.
        item=next(x for x in p['researchCandidates'] if x['id']==item['id'])
        method=item['method'];folder=s.output(p,item['folder']);folder.mkdir(exist_ok=True)
        def command(script,env,*args):s.run_process(p,[s.RUNTIME/env/'Scripts/python.exe',scripts/script,*args])
        try:
            s.update(p,'animation' if production is not None else 'research-'+method,'running',
                'Fitting the skeleton and skin weights to this painted model.' if method=='mia' else 'Retargeting captured motion and checking foot contact.' if method=='mixamo' else 'Building an isolated comparison.')
            with s.timed_stage(p,method+' candidate'):
                task_path=folder/'task.json';s.write(task_path,task)
                if method=='mixamo':
                    command('mixamo_retarget.py','blender-py311',task_path)
                    command('retarget_quality.py','blender-py311',Path(task['output']).with_suffix('.blend'),folder/'quality.json')
                    item['report']=item['folder']+'/quality.json'
                elif method=='mia':
                    s.comfy_free()
                    command('mia_worker.py','mia-env',task_path)
                    bind={'input':task['input'],'prediction':task['output'],'output':str(folder/'candidate.glb')};s.write(folder/'bind.json',bind)
                    command('mia_bind.py','blender-py311',folder/'bind.json')
                    item['report']=item['folder']+'/prediction.json'
                else:
                    command('instantmesh_worker.py','instantmesh-env',task_path)
                    item['report']=item['folder']+'/candidate.json'
                filename=item['folder']+'/candidate.glb'
                report=s.inspect_asset(s.output(p,filename),'mesh' if method in ['mia','instantmesh'] else 'animation')
                s.write(folder/'asset-quality.json',report)
                if report['status']=='fail':raise ValueError('The generated file failed asset checks. Review its retained report.')
                item.update(file=filename,sha256=s.digest(s.output(p,filename)),passed=True,status='review',
                    message='Technical checks passed. Compare identity, hands, boots and full motion before use.')
            if production is None:s.update(p,'research-'+method,'review','Comparison saved. Inspect it before using it in production.')
        except Exception as e:
            # Keep complete worker diagnostics downloadable, with a short result
            # in the product UI rather than a raw traceback.
            (folder/'failure.txt').write_text(str(e),encoding='utf-8')
            message=str(e).strip().splitlines()[-1][:320]
            item.update(passed=False,status='failed',message=message,diagnostic=item['folder']+'/failure.txt')
            for report in ['quality.json','prediction.json','asset-quality.json']:
                if (folder/report).exists():
                    item['report']=item['folder']+'/'+report
                    failures=[c['name'] for c in s.read(folder/report,{}).get('checks',[]) if c['status']=='fail']
                    if failures:item['message']='Needs correction: '+', '.join(failures)+'. Current asset retained.'
                    break
            if (folder/'candidate.glb').exists():item['file']=item['folder']+'/candidate.glb'
            if production is None:s.update(p,'research-'+method,'error',item['message'])
        finally:
            item['finishedAt']=time.time();s.save(p)
            if production is None:s.ACTIVE=None;s.CANCEL.pop(key,None)
        if production is not None and not item.get('passed'):raise ValueError(item['message'])
        return item

    def candidate_task(p,method,body):
        source=source_model(p);identifier=uuid.uuid4().hex[:12];folder='research-'+identifier
        item={'id':identifier,'method':method,'folder':folder,'sourceSha256':s.digest(s.output(p,source)),
            'createdAt':time.time(),'status':'queued','passed':False,'ownerApproved':False}
        dest=s.output(p,folder);task={'runtime':str(s.RUNTIME),'input':str(s.output(p,source)),'output':str(dest/'candidate.glb')}
        if method=='mixamo':
            motion=next((m for m in motions() if m['id']==body.get('motion')),None)
            if not motion:raise HTTPException(400,'Choose an imported locomotion capture.')
            target=source_rig(p,body.get('target'))
            label=str(motion.get('name') or motion.get('label') or motion['id'])
            carry=body.get('carryAction') or ('Run' if 'run' in label.lower() else 'Walk' if 'walk' in label.lower() else None)
            if carry not in ['Walk','Run']:raise HTTPException(400,'Choose walk or run to match the fitted appendage cycle.')
            task.update(input=str(target),motion=str(library/(motion['id']+'.npz')),name='Mixamo '+label.removeprefix('Mixamo ')[:90],fps=60,carryAction=carry)
        elif method=='mia':
            task['output']=str(dest/'prediction.npz')
            if p.get('rigProfile'):task['rigProfile']=str(s.output(p,p['rigProfile']['file']))
            fit_hash=s.digest(Path(task['rigProfile'])) if task.get('rigProfile') else None
            for previous in ([] if body.get('freshInference') else reversed(p.get('researchCandidates',[]))):
                prediction=s.output(p,previous['folder']+'/prediction.npz')
                report=s.read(prediction.with_suffix('.json'),{})
                if previous['method']=='mia' and prediction.is_file() and report.get('passed') and report.get('sourceSha256')==item['sourceSha256'] and report.get('canonicalizationFitSha256')==fit_hash:
                    task['reusePrediction']=str(prediction);break
        else:
            s.assert_approved(p,'art','art');task.update(image=str(s.output(p,p['art'])),seed=s.settings()['seed'])
            item['referenceSha256']=s.digest(s.output(p,p['art']))
        p.setdefault('researchCandidates',[]).append(item)
        return item,task

    def prepare_motion(p):
        """The normal Paint -> Motion route; no generic proximity rig fallback."""
        if not available()['mia'] or not available()['mixamo']:
            raise ValueError('Local rigging runtime is unavailable. Check Motion library setup before retrying.')
        captures=motions()
        motion=next((m for m in captures if m['id']=='mixamo-walk'),None)
        if not motion:
            motion=next((m for m in captures if str(m.get('name','')).lower() in ['walking','mixamo walking','walk']),None)
        if not motion:raise ValueError('Import a Walking capture in Motion library, then retry Rig and animate.')
        source=source_model(p);source_hash=s.digest(s.output(p,source))
        rig=None
        for previous in reversed(p.get('researchCandidates',[])):
            if previous.get('method')!='mia' or not previous.get('passed') or previous.get('sourceSha256')!=source_hash:continue
            path=s.output(p,previous.get('file','missing'))
            if path.is_file() and path.with_suffix('.blend').is_file() and s.digest(path)==previous.get('sha256') and s.read(path.with_suffix('.json'),{}).get('pipelineVersion')==3:
                rig=previous;break
        if rig is None:
            rig,task=candidate_task(p,'mia',{})
            s.save(p);execute(p['id'],rig,task,production=p)
        s.cancelled(p)
        item,task=candidate_task(p,'mixamo',{'motion':motion['id'],'target':rig['id'],'carryAction':'Walk'})
        s.save(p);execute(p['id'],item,task,production=p)
        s.cancelled(p)
        # Publish only the fully checked motion. Keep any earlier production output
        # and all candidate failures, and never grant visual/owner approval here.
        p.setdefault('refinementHistory',[]).append({k:p.get(k) for k in ['animation','polished','motionInput','reviewReports']})
        p['animation']=item['file'];p['motionInput']=source_hash;p['polished']=None
        p.setdefault('reviewReports',{})['animation']=[item['report']]
        p.setdefault('approvals',{}).pop('animation',None);p.setdefault('reviews',{}).pop('animation',None)
        p['motionRecipe']={'method':'mia-mixamo','sourceSha256':source_hash,'rigCandidate':rig['id'],
            'motionCandidate':item['id'],'capture':motion['id'],'captureSha256':s.digest(library/(motion['id']+'.npz'))}
        s.require_valid_output(p,'animation')
        s.update(p,'animation','review','Rig and captured walk ready. Inspect the hands, boots and a full cycle, then approve animation to unlock Polish & package. More clips are available in Motion library.')
        return p

    s.prepare_learned_motion=prepare_motion

    @app.post('/api/projects/{key}/research')
    def generate(key,body:dict=Body(...)):
        p=s.project(key);method=body.get('method');engines=available()
        if method not in ['mixamo','mia','instantmesh']:raise HTTPException(400,'Unknown research method.')
        if not engines[method]:raise HTTPException(409,'Run the pinned research setup and runtime trial first.')
        with s.LOCK:
            idle(p);item,task=candidate_task(p,method,body)
            s.CANCEL[key]=False;s.update(p,'research-'+method,'queued','Waiting for the local worker.')
            s.POOL.submit(execute,key,item,task)
        return p

    @app.post('/api/projects/{key}/research/{candidate}/use')
    def use(key,candidate,body:dict=Body(...)):
        p=s.project(key)
        with s.LOCK:
            idle(p);item=next((x for x in p.get('researchCandidates',[]) if x['id']==candidate),None)
            if not item or not item.get('passed') or not item.get('file'):raise HTTPException(409,'Candidate did not pass its checks.')
            if not body.get('visualReviewConfirmed'):raise HTTPException(409,'Inspect the candidate and confirm visual review first.')
            if item['method']=='mia':raise HTTPException(409,'Retarget and review motion on this rig before using it in production.')
            if item['sha256']!=s.digest(s.output(p,item['file'])):raise HTTPException(409,'Candidate bytes changed after validation.')
            if item['sourceSha256']!=s.digest(s.output(p,source_model(p))):raise HTTPException(409,'Source model changed. Build a fresh comparison.')
            if item['method']=='instantmesh' and item['referenceSha256']!=s.digest(s.output(p,p['art'])):raise HTTPException(409,'Concept changed. Build a fresh comparison.')
            p.setdefault('refinementHistory',[]).append({k:p.get(k) for k in ['mesh','paint','animation','polished','rigProfile','paintProfile','reviewReports']})
            if item['method']=='mixamo':
                p['animation']=item['file'];p['motionInput']=item['sourceSha256'];p.setdefault('reviewReports',{})['animation']=[item['report']];p['stage']='animation'
            else:
                p.update(mesh=item['file'],paint=None,animation=None,stage='mesh');p.pop('rigProfile',None);p.pop('paintProfile',None);p['reviewReports']={}
            p['polished']=None;p['approvals'].pop('animation',None);p['status']='review';p['message']='Candidate selected. Animation approval and polish remain separate steps.';s.save(p)
        return p
