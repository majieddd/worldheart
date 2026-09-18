"""Loopback-only asset studio. Models and inference remain on this computer."""
import hashlib,json,os,re,shutil,subprocess,sys,threading,time,uuid,zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime,timezone
import requests
from fastapi import FastAPI,HTTPException,Request,UploadFile,File,Body
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from workflows import STYLE,compose_prompt,krea_graph,checkpoint_graph
from asset_quality import inspect_asset,VERSION as QUALITY_VERSION
import reference_pack as packets
from shape_inputs import conditioning
from shape_budget import plan as shape_plan

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path(os.environ.get('WH_STUDIO_RUNTIME',ROOT.parent/'local-asset-runtime')).resolve()
DATA=RUNTIME/'studio-data';DATA.mkdir(parents=True,exist_ok=True)
PROJECTS=DATA/'projects';PROJECTS.mkdir(exist_ok=True)
COMFY=RUNTIME/'ComfyUI';COMFY_URL='http://127.0.0.1:8188'
POOL=ThreadPoolExecutor(max_workers=1);LOCK=threading.RLock();CANCEL={};ACTIVE=None
DEFAULT={'family':'krea','model':'krea2_turbo_int8_convrot.safetensors','loras':[{'name':'krea2_style_reference.safetensors','strength':.8}],'seed':99131,'width':768,'height':1024,'steps':8,'meshSteps':30,'meshResolution':256,'textureSize':2048,'meshEngine':'hunyuan','paintEngine':'projection','trellisSteps':25,'referenceMethod':'style-reference','referenceFidelity':2.0}
app=FastAPI(docs_url=None,redoc_url=None)

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path,default=None):return json.loads(path.read_text('utf-8')) if path.exists() else default
def write(path,data):
    path=Path(path);temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temp.open('w',encoding='utf-8') as stream:
            stream.write(json.dumps(data,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
def pid(value):
    if not re.fullmatch(r'[a-z0-9-]{1,60}',value):raise HTTPException(400,'Invalid project ID')
    return value
def project(value):
    p=read(PROJECTS/pid(value)/'project.json')
    if not p:raise HTTPException(404,'Project not found')
    return p
def save(p):
    p['updated']=time.time()
    with LOCK:write(PROJECTS/p['id']/'project.json',p)
def local_path(value,base=DATA):
    path=(base/value).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():raise HTTPException(404,'File not found')
    return path
def asset_url(p,name):return f'/files/projects/{p["id"]}/{name}'
def output(p,name):return PROJECTS/p['id']/name

def validate_output(p,field):
    if field not in ['mesh','paint','animation','polished'] or not p.get(field):raise HTTPException(409,'No model at this stage')
    path=output(p,p[field]);sha=digest(path);stage='polish' if field=='polished' else field
    reference_sha=digest(output(p,p['art'])) if p.get('art') else None
    extras=p.get('reviewReports',{}).get(field,[])
    evidence=[[name,digest(output(p,name))] for name in extras]
    cached=p.setdefault('quality',{}).get(field)
    if cached and cached.get('sha256')==sha and cached.get('version')==QUALITY_VERSION and cached.get('referenceSha256')==reference_sha and cached.get('evidence',[])==evidence:return cached
    report=inspect_asset(path,stage)
    report['referenceSha256']=reference_sha
    report['evidence']=evidence
    for name,_ in evidence:
        extra=read(output(p,name));matches=extra.get('sha256')==sha
        report['checks'].append({'name':'Bound refinement evidence: '+name,'status':'pass' if matches else 'fail','detail':'Checks must describe the current model bytes'})
        if matches:report['checks'].extend(extra['checks'])
    if any(c['status']=='fail' for c in report['checks']):report['status']='fail'
    report['reportFile']=str(Path(p[field]).with_suffix('.quality.json')).replace('\\','/')
    write(output(p,report['reportFile']),report);p['quality'][field]=report;save(p)
    return report

def require_valid_output(p,field):
    report=validate_output(p,field)
    if report['status']=='fail':
        failures=', '.join(c['name'] for c in report['checks'] if c['status']=='fail')
        raise HTTPException(409,'Asset checks failed: '+failures+'. Inspect the quality report before continuing.')

@app.post('/api/projects/{key}/validate/{field}')
def validate_project(key,field):
    p=project(key)
    if p['status'] in ['queued','running']:raise HTTPException(409,'Wait for the current job')
    validate_output(p,field);return p
def settings():return {**DEFAULT,**read(DATA/'settings.json',{})}
def brief_digest(p):
    return hashlib.sha256(json.dumps({'description':p['description'],'style':p['style'],'references':[(n,digest(output(p,n))) for n in p['references']]},sort_keys=True).encode()).hexdigest()
def update(p,stage,status,message):
    p['stage']=stage;p['status']=status;p['message']=message;save(p)
def log_event(p,text):
    p.setdefault('events',[]).append({'time':time.time(),'text':text});p['events']=p['events'][-80:];save(p)

@contextmanager
def timed_stage(p,stage):
    entry={'stage':stage,'startedAt':datetime.now(timezone.utc).isoformat(),'status':'running'}
    start=time.perf_counter();p.setdefault('timings',[]).append(entry);save(p)
    try:
        yield
        entry['status']='completed'
    except BaseException as e:
        entry.update(status='failed',error=str(e)[:500]);raise
    finally:
        entry.update(endedAt=datetime.now(timezone.utc).isoformat(),seconds=round(time.perf_counter()-start,3))
        write(output(p,'timings.json'),{'note':'Elapsed execution per attempt, including failed attempts. Human review and queue waits are separate.','attempts':p['timings']});save(p)
def model_files(folder):return sorted(str(p.relative_to(folder)).replace('\\','/') for p in folder.rglob('*.safetensors')) if folder.exists() else []
def config():
    return {'settings':settings(),'styles':[{'id':k,'name':v[0]} for k,v in STYLE.items()],
      'models':[{'family':'krea','name':n} for n in model_files(COMFY/'models/diffusion_models') if 'krea' in n.lower()]+[{'family':'checkpoint','name':n} for n in model_files(COMFY/'models/checkpoints')],
      'loras':model_files(COMFY/'models/loras'),'trellisReady':bool(read(DATA/'trellis2-ready.json')) and (RUNTIME/'modly-trellis2/venv/Scripts/python.exe').is_file(),'paths':{'models':str(COMFY/'models'),'projects':str(PROJECTS)}}
def gpu():
    try:
        text=subprocess.check_output(['nvidia-smi','--query-gpu=name,memory.total,memory.free','--format=csv,noheader,nounits'],text=True,timeout=4,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)).strip();name,total,free=text.split(',');return {'name':name,'total':int(total),'free':int(free)}
    except Exception:return None

@app.middleware('http')
async def local_only(request,call_next):
    host=request.headers.get('host','').split(':')[0]
    origin=request.headers.get('origin')
    if host not in ['127.0.0.1','localhost','testserver']:return JSONResponse({'detail':'Local access only'},403)
    if request.method not in ['GET','HEAD'] and origin and origin not in [f'http://{request.headers.get("host")}','http://testserver']:return JSONResponse({'detail':'Cross-site requests are blocked'},403)
    return await call_next(request)

@app.get('/api/status')
def status():
    try:r=requests.get(COMFY_URL+'/system_stats',timeout=2);ready=r.ok
    except requests.RequestException:ready=False
    return {'comfy':ready,'gpu':gpu(),'active':ACTIVE,'localOnly':True,'runtime':str(RUNTIME),'meshInstalled':(RUNTIME/'models/Hunyuan3D-2mini/hunyuan3d-dit-v2-mini/model.fp16.safetensors').exists(),'rigInstalled':(RUNTIME/'blender-py311/Scripts/python.exe').exists()}

@app.get('/api/config')
def get_config():return config()
@app.put('/api/config')
async def put_config(request:Request):
    data=await request.json();available=config()
    if {'family':data.get('family'),'name':data.get('model')} not in available['models']:raise HTTPException(400,'Choose an installed model')
    for lora in data.get('loras',[]):
        if lora.get('name') not in available['loras'] or not -2<=float(lora.get('strength',0))<=2:raise HTTPException(400,'Invalid LoRA')
    clean={k:data.get(k,v) for k,v in DEFAULT.items()}
    if clean['meshEngine'] not in ['hunyuan','hunyuan-mv','trellis2'] or clean['paintEngine'] not in ['projection','trellis2']:raise HTTPException(400,'Unknown 3D engine')
    if clean['meshEngine']=='hunyuan-mv' and not (RUNTIME/'models/Hunyuan3D-2mv/hunyuan3d-dit-v2-mv/model.fp16.safetensors').is_file():raise HTTPException(409,'Install the Hunyuan multiview weights first')
    if 'trellis2' in [clean['meshEngine'],clean['paintEngine']] and not available['trellisReady']:raise HTTPException(409,'Finish and verify the local Trellis installation first')
    if not isinstance(clean['trellisSteps'],int) or not 5<=clean['trellisSteps']<=50:raise HTTPException(400,'Invalid Trellis steps')
    for key,lo,hi in [('seed',0,2**48),('width',256,1536),('height',256,1536),('steps',1,60),('meshSteps',5,60),('meshResolution',128,512),('textureSize',512,4096)]:
        if not isinstance(clean[key],int) or not lo<=clean[key]<=hi:raise HTTPException(400,'Invalid '+key)
    if clean['referenceMethod'] not in ['style-reference','identity-edit']:raise HTTPException(400,'Unknown reference method')
    if not isinstance(clean['referenceFidelity'],(int,float)) or not .5<=clean['referenceFidelity']<=8:raise HTTPException(400,'Reference fidelity must be 0.5 to 8')
    if clean['referenceMethod']=='identity-edit' and not (COMFY/'models/loras/krea2_identity_edit_v1_2.safetensors').is_file():raise HTTPException(409,'Install the identity edit LoRA and nodes first')
    if clean['width']%64 or clean['height']%64:raise HTTPException(400,'Image dimensions must be multiples of 64')
    write(DATA/'settings.json',clean);return config()

@app.get('/api/projects')
def list_projects():return sorted([read(p) for p in PROJECTS.glob('*/project.json')],key=lambda p:p['updated'],reverse=True)
@app.post('/api/projects')
async def new_project(request:Request):
    body=await request.json();key=uuid.uuid4().hex[:12];(PROJECTS/key).mkdir()
    p={'id':key,'name':str(body.get('name','Untitled asset'))[:100],'description':'','style':'painted-anime-inkline','references':[],'art':None,'mesh':None,'paint':None,'animation':None,'polished':None,'approvals':{},'stage':'concept','status':'draft','message':'Describe an asset or import an existing model.','created':time.time(),'events':[]};save(p);return p
@app.get('/api/projects/{key}')
def get_project(key):return project(key)
@app.post('/api/projects/{key}/fork-inputs')
def fork_inputs(key,body:dict=Body(default={})):
    source=project(key)
    if source['status'] in ['running','queued']:raise HTTPException(409,'Wait for the source job to finish')
    pack=source.get('referencePack')
    if 'referenceHistory' in body:
        index=body['referenceHistory'];history=source.get('referencePackHistory',[])
        if not isinstance(index,int) or not 0<=index<len(history):raise HTTPException(400,'Unknown reference history entry')
        pack=history[index]
        if pack.get('heroSha256')!=digest(output(source,source['art'])):raise HTTPException(409,'Historical pack belongs to a different hero')
    identifier=uuid.uuid4().hex[:12];(PROJECTS/identifier).mkdir()
    clone={k:source[k] for k in ['description','style','references','art','artBrief'] if k in source}
    clone.update(id=identifier,name=str(body.get('name',source['name']+' / comparison'))[:100],mesh=None,paint=None,animation=None,polished=None,
                 approvals={},stage='concept',status='review',message='Independent input comparison. Source model retained.',created=time.time(),events=[],forkedFrom=key)
    files=set(source.get('references',[]));files.update([source['art']] if source.get('art') else [])
    if pack and not pack.get('sourceModel'):
        clone['referencePack']=json.loads(json.dumps(pack));clone['referencePackExpected']=source.get('referencePackExpected',True)
        files.update([pack['hero'],pack['folder']+'/manifest.json']);files.update(v['file'] for v in pack['outputs'].values())
    for name in files:
        dest=output(clone,name);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(output(source,name),dest)
    save(clone);return clone
@app.put('/api/projects/{key}')
async def edit_project(key,request:Request):
    p=project(key);body=await request.json()
    if p['status'] in ['queued','running']:raise HTTPException(409,'Wait for the current job or cancel it first')
    if body.get('style',p['style']) not in STYLE:raise HTTPException(400,'Unknown style')
    new={k:str(body.get(k,p[k]))[:12000 if k=='description' else 100] for k in ['name','description','style']}
    changed=any(new[k]!=p[k] for k in ['description','style']);p.update(new)
    if changed:
        p['approvals']={};p['polished']=None;p['status']='draft';p['message']='Brief changed. Generate and approve a new concept before continuing.'
    save(p);return p

@app.post('/api/projects/{key}/upload')
async def upload(key,file:UploadFile=File(...)):
    p=project(key)
    if p['status'] in ['queued','running']:raise HTTPException(409,'A job is running')
    limit=(256 if Path(file.filename or '').suffix.lower()=='.glb' else 32)*1024*1024
    raw=await file.read(limit+1)
    if len(raw)>limit:raise HTTPException(413,'Maximum upload size is 256 MB for GLB models, 32 MB for reference images')
    ext=Path(file.filename or '').suffix.lower();name='import-'+uuid.uuid4().hex[:10]+ext;dest=output(p,name)
    if ext=='.glb':
        if raw[:4]!=b'glTF':raise HTTPException(400,'Not a GLB model')
        dest.write_bytes(raw);p.update(mesh=name,paint=None,animation=None,polished=None,stage='mesh',status='review',message='Imported geometry is preserved. Inspect the model, then paint or prepare its animations.');p['imported']=True;p['approvals']={'geometry':digest(dest)}
    elif ext in ['.png','.jpg','.jpeg','.webp']:
        if len(p['references'])>=7:raise HTTPException(400,'Use a hero and up to six directional references')
        import io
        try:
            im=Image.open(io.BytesIO(raw));im.verify()
        except Exception:raise HTTPException(400,'Image could not be decoded')
        dest.write_bytes(raw);p['references'].append(name);p['approvals']={};p['polished']=None;p['status']='draft'
    else:raise HTTPException(400,'Choose PNG, JPEG, WebP or GLB')
    save(p);return p
@app.delete('/api/projects/{key}/references/{index}')
def remove_reference(key,index:int):
    p=project(key)
    if p['status'] in ['queued','running']:raise HTTPException(409,'A job is running')
    if not 0<=index<len(p['references']):raise HTTPException(404,'Reference not found')
    p['references'].pop(index);p['approvals']={};p['polished']=None;p['status']='draft';save(p);return p

@app.post('/api/projects/{key}/use-reference/{index}')
def use_reference(key,index:int):
    p=project(key)
    if p['status'] in ['queued','running']:raise HTTPException(409,'A job is running')
    if not 0<=index<len(p['references']):raise HTTPException(404,'Reference not found')
    name='concept-import-'+uuid.uuid4().hex[:8]+Path(p['references'][index]).suffix
    shutil.copy2(output(p,p['references'][index]),output(p,name))
    if p.get('referencePack'):p.setdefault('referencePackHistory',[]).append(p.pop('referencePack'))
    p.update(art=name,artBrief=brief_digest(p),mesh=None,paint=None,animation=None,polished=None,imported=False,approvals={})
    update(p,'concept','review','Imported reference is the concept. Review it and approve 2D before reconstruction.');return p

@app.get('/api/projects/{key}/reference-figures/{role}')
def reference_figures(key,role):
    from shape_images import prepare,figures
    p=project(key)
    if role not in packets.VIEWS:raise HTTPException(400,'Choose a directional reference')
    item=p.get('referencePack',{}).get('outputs',{}).get(role)
    if not item:raise HTTPException(409,'Create this reference first')
    image=prepare(output(p,item['file']),RUNTIME)
    return {'sourceSha256':digest(output(p,item['file'])),'figures':figures(image)}

@app.post('/api/projects/{key}/reference-figures/{role}')
def isolate_reference(key,role,body:dict=Body(...)):
    from shape_images import prepare,crop_figure
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    if role not in packets.VIEWS:raise HTTPException(400,'Choose a directional reference')
    pack=p.get('referencePack',{});item=pack.get('outputs',{}).get(role)
    if not item:raise HTTPException(409,'Create this reference first')
    if body.get('sourceSha256')!=digest(output(p,item['file'])):raise HTTPException(409,'Reference changed; inspect the figures again')
    try:image,box=crop_figure(prepare(output(p,item['file']),RUNTIME),body.get('index'))
    except ValueError as e:raise HTTPException(400,str(e))
    name=pack['folder']+'/'+role+'-isolated-'+uuid.uuid4().hex[:6]+'.png';image.save(output(p,name))
    pack.setdefault('attemptHistory',[]).append({'role':role,**item})
    pack['outputs'][role]={'file':name,'sha256':digest(output(p,name)),'crop':{'source':item['file'],'sourceSha256':item['sha256'],'box':box,'figureIndex':body['index']}}
    pack['approval']='pending';p['approvals'].pop('art',None);p['approvals'].pop('referencePack',None)
    if pack.get('complete'):packets.assemble(PROJECTS/key,pack,p['description'])
    write(output(p,pack['folder']+'/manifest.json'),pack)
    update(p,'concept','review','Figure isolated without regenerating artwork. Review the updated views and approve before shaping.');return p

@app.post('/api/projects/{key}/approve/{stage}')
def approve(key,stage,review:dict=Body(default={})):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the job to finish')
    field={'art':'art','animation':'animation'}.get(stage)
    if not field or not p.get(field):raise HTTPException(409,'There is no completed output to approve')
    if stage=='art':require_reference_pack(p)
    if stage=='art' and p.get('artBrief')!=brief_digest(p):raise HTTPException(409,'The concept belongs to an older brief. Generate a new concept or select a reference as the concept.')
    if stage=='animation' and p.get('motionInput')!=digest(output(p,p.get('paint') or p['mesh'])):raise HTTPException(409,'Motion belongs to an older model. Prepare motion again.')
    if stage=='animation':require_valid_output(p,'animation')
    if stage=='animation' and p.get('referenceMode')=='model':
        if not p.get('referencePack',{}).get('sourceModel'):raise HTTPException(409,'Render and review exact model references before animation approval')
        require_reference_pack(p)
    reviewer=review.get('reviewer','owner')
    if reviewer not in ['owner','agent']:raise HTTPException(400,'Reviewer must be owner or agent')
    notes=str(review.get('notes','')).strip()[:4000]
    if reviewer=='agent' and not notes:raise HTTPException(400,'Record the actual visual checks before an agent review')
    p['approvals'][stage]=digest(output(p,p[field]));
    p.setdefault('reviews',{})[stage]={'reviewer':reviewer,'notes':notes,'sha256':p['approvals'][stage],'time':time.time(),'ownerApproved':reviewer=='owner'}
    if stage=='art' and p.get('referencePack'):
        p['referencePack']['approval']='approved';p['approvals']['referencePack']=digest(output(p,p['referencePack']['folder']+'/manifest.json'))
    p['status']='approved';p['message']=('Owner review accepted. ' if reviewer=='owner' else 'Agent-reviewed candidate; owner acceptance is pending. ')+('Image and references locked for reconstruction.' if stage=='art' else 'Polish and export are available.');log_event(p,stage+' reviewed by '+reviewer);save(p);return p

@app.post('/api/projects/{key}/use-concept-reference')
def concept_reference(key):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    if not p.get('art'):raise HTTPException(409,'Generate a concept first')
    p['references']=[p['art']]+[n for n in p['references'] if n!=p['art']][:2]
    p['approvals']={};p['polished']=None
    update(p,'concept','draft','Current concept is the first identity reference. Describe the correction, then generate the next main concept.');return p

@app.post('/api/projects/{key}/paint-profile')
def save_paint_profile(key,profile:dict=Body(...)):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    source=p.get('paint')
    if not source or profile.get('sourceSha256')!=digest(output(p,source)):raise HTTPException(409,'Paint profile must identify the current painted model')
    palette=profile.get('palette',[])
    if len(palette)!=5 or any(len(c)!=3 or any(not isinstance(v,(float,int)) or not 0<=v<=255 for v in c) for c in palette):raise HTTPException(400,'Provide five RGB material colours')
    write(output(p,'paint-profile.json'),profile);p['paintProfile']={'file':'paint-profile.json','source':source,'sourceSha256':profile['sourceSha256']};save(p);return p

@app.post('/api/projects/{key}/recipe')
def save_recipe(key):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    if not all(p.get(k) for k in ['art','mesh','paint','paintProfile','rigProfile']):raise HTTPException(409,'Complete the concept, model, material fit and anatomical fit first')
    fit=read(output(p,p['rigProfile']['file']))
    known=[p['paint']]+p.get('paintHistory',[])
    if not any(digest(output(p,name))==fit['sourceSha256'] for name in known):raise HTTPException(409,'Anatomical fit belongs to a different model lineage')
    source=next(iter(p.get('paintHistory',[])),p['paint']);folder='recipe-'+uuid.uuid4().hex[:10];output(p,folder).mkdir()
    recipe={'version':1,'name':p['name'],'hero':p['art'],'heroSha256':digest(output(p,p['art'])),'mesh':p['mesh'],'meshSha256':digest(output(p,p['mesh'])),'sourcePaint':source,'sourcePaintSha256':digest(output(p,source)),'palette':read(output(p,p['paintProfile']['file'])),'rig':fit,'style':p['style'],'ownerApproved':False,'scope':'Replay fitted corrections for this exact identity and model lineage. Different anatomy requires a reviewed fit.'}
    file=folder+'/recipe.json';write(output(p,file),recipe);p['productionRecipe']={'file':file,'sha256':digest(output(p,file)),'name':p['name']};save(p);return p

def require_recipe(p):
    meta=p.get('productionRecipe')
    if not meta or digest(output(p,meta['file']))!=meta['sha256']:raise HTTPException(409,'Save a fitted production recipe first')
    recipe=read(output(p,meta['file']))
    for field in ['hero','mesh','sourcePaint']:
        if digest(output(p,recipe[field]))!=recipe[field+'Sha256']:raise HTTPException(409,'A recipe source changed; review and save it again')
    if digest(output(p,p['art']))!=recipe['heroSha256'] or digest(output(p,p['mesh']))!=recipe['meshSha256']:raise HTTPException(409,'This recipe belongs to a different concept or mesh')
    return recipe

def replay_fitted(p,s):
    recipe=require_recipe(p);p['paint']=recipe['sourcePaint'];p['reviewReports']={};p['approvals'].pop('animation',None)
    palette=recipe['palette'];palette['sourceSha256']=recipe['sourcePaintSha256'];write(output(p,'paint-profile.json'),palette)
    p['paintProfile']={'file':'paint-profile.json','source':p['paint'],'sourceSha256':palette['sourceSha256']}
    with timed_stage(p,'fitted paint replay'):clean_paint(p,s)
    cancelled(p);update(p,'replay-fitted','running','Fitted paint complete. Rebuilding captured motion and contact checks.')
    fit=recipe['rig'];fit['sourceSha256']=digest(output(p,p['paint']));write(output(p,'rig-profile.json'),fit)
    p['rigProfile']={'file':'rig-profile.json','sourceSha256':fit['sourceSha256'],'sha256':digest(output(p,'rig-profile.json')),'name':fit['name']}
    with timed_stage(p,'fitted motion replay'):blender_stage(p,s,'animation')
    cancelled(p);update(p,'replay-fitted','running','Motion gates passed. Rendering the exact reference packet.')
    with timed_stage(p,'exact reference replay'):render_reference_pack(p,s)
    update(p,'animation','review','Fitted recipe replay complete. Inspect the model and motion, then approve polish. Owner acceptance is still separate.')

@app.post('/api/projects/{key}/rig-profile')
def save_rig_profile(key,profile:dict=Body(...)):
    import math
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    source=p.get('paint') or p.get('mesh')
    if not source or profile.get('sourceSha256')!=digest(output(p,source)):raise HTTPException(409,'Fit must identify the current painted model bytes')
    joints=profile.get('joints',[]);seen=set()
    if not 15<=len(joints)<=100:raise HTTPException(400,'Provide 15 to 100 fitted joints')
    for joint in joints:
        name=joint.get('name');parent=joint.get('parent')
        if not isinstance(name,str) or name in seen or (parent and parent not in seen):raise HTTPException(400,'Joint names must be unique and parents must precede children')
        for point in ['head','tail']:
            value=joint.get(point)
            if not isinstance(value,list) or len(value)!=3 or not all(isinstance(x,(int,float)) and math.isfinite(x) and abs(x)<100 for x in value):raise HTTPException(400,'Joint positions need three finite meter coordinates')
        if sum((a-b)**2 for a,b in zip(joint['head'],joint['tail']))<1e-6:raise HTTPException(400,'Joint length is too small')
        seen.add(name)
    write(output(p,'rig-profile.json'),profile);p['rigProfile']={'file':'rig-profile.json','sha256':digest(output(p,'rig-profile.json')),'sourceSha256':profile['sourceSha256'],'name':str(profile.get('name','Fitted anatomy'))[:120]}
    p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None)
    update(p,'paint','review','Anatomical fit saved for this model. Prepare motion, then inspect the complete clips.');return p

@app.post('/api/projects/{key}/reference-mode')
def reference_mode(key,body:dict=Body(...)):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    mode=body.get('mode')
    if mode not in ['generated','model']:raise HTTPException(400,'Choose generated or model references')
    if p.get('referencePack'):p.setdefault('referencePackHistory',[]).append(p.pop('referencePack'))
    p['referenceMode']=mode;p['referencePackExpected']=mode=='generated';p['approvals']={};p['polished']=None
    update(p,'concept','review','Exact-view route: approve the hero, reconstruct and refine the model, then render its six views before animation approval. Hidden surfaces remain design proposals.' if mode=='model' else 'Generated-view route: test one angle for identity, then complete and review the pack before reconstruction.');return p

@app.delete('/api/projects/{key}/rig-profile')
def clear_rig_profile(key):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the current job')
    source=output(p,'rig-profile.json')
    if source.exists():shutil.move(str(source),str(output(p,'rig-profile-'+uuid.uuid4().hex[:8]+'.json')))
    p.pop('rigProfile',None);p['approvals'].pop('animation',None);p['polished']=None
    update(p,'paint','review','Fit archived. Rig and animate now uses the local learned rig and captured walk; inspect anatomy and motion before approval.');return p

def assert_approved(p,stage,field):
    if not p.get(field) or p['approvals'].get(stage)!=digest(output(p,p[field])):raise HTTPException(409,f'Approve the current {stage} first')
    if stage=='art':require_reference_pack(p)
    if stage=='art' and p.get('artBrief')!=brief_digest(p):raise HTTPException(409,'The approved concept no longer matches this brief')
    if stage=='art' and p.get('referencePack') and p['approvals'].get('referencePack')!=digest(output(p,p['referencePack']['folder']+'/manifest.json')):raise HTTPException(409,'Approve the current reference pack first')
def cancelled(p):
    if CANCEL.get(p['id']):raise RuntimeError('Cancelled by user. Previous outputs are preserved.')
def comfy_free():
    try:requests.post(COMFY_URL+'/free',json={'unload_models':True,'free_memory':True},timeout=10)
    except requests.RequestException:pass
def run_process(p,args,timeout=None):
    log=output(p,'worker.log')
    last_message='';last_read=0;start_offset=log.stat().st_size if log.exists() else 0
    started=time.monotonic()
    with log.open('a',encoding='utf-8') as handle:
        child=subprocess.Popen([str(x) for x in args],cwd=ROOT,stdout=handle,stderr=subprocess.STDOUT,env={**os.environ,'PYTHONUNBUFFERED':'1'},creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        while child.poll() is None:
            if timeout and time.monotonic()-started>=timeout:
                child.terminate();child.wait(timeout=20)
                raise RuntimeError(f'Step exceeded {timeout} seconds. Previous accepted output retained. Reduce shape steps or extraction grid; the timed-out attempt remains in the log.')
            if CANCEL.get(p['id']):child.terminate();child.wait(timeout=20);cancelled(p)
            if time.time()-last_read>3:
                last_read=time.time()
                with log.open('rb') as tail:
                    tail.seek(max(start_offset,log.stat().st_size-8000));lines=tail.read().decode('utf-8',errors='replace').splitlines()
                for line in reversed(lines):
                    try:progress=json.loads(line)
                    except (ValueError,TypeError):continue
                    if not isinstance(progress,dict) or 'percent' not in progress or 'message' not in progress:continue
                    message=str(progress['message'])[:180]+' / '+str(progress['percent'])+'%'
                    if message!=last_message:last_message=message;p['message']=message;save(p)
                    break
            time.sleep(.4)
    if child.returncode:
        with log.open('rb') as tail:
            tail.seek(max(start_offset,log.stat().st_size-1800));detail=tail.read().decode('utf-8',errors='replace').strip()
        raise RuntimeError(f'{Path(args[1]).name} exited with code {child.returncode} (0x{child.returncode & 0xffffffff:08X}).\n'+(detail or 'Worker produced no diagnostic output for this attempt.'))

def generate_image(p,s,prompt,references,name):
    if not (COMFY/'models/text_encoders/qwen3vl_4b_fp8_scaled.safetensors').exists() and (COMFY/'models/text_encoders/qwen3vl_4b_native_bf16.safetensors').exists():s={**s,'encoder':'qwen3vl_4b_native_bf16.safetensors'}
    refs=[]
    for path in references[:3]:
        with Path(path).open('rb') as f:
            r=requests.post(COMFY_URL+'/upload/image',files={'image':(p['id']+'-'+Path(path).name,f)},data={'overwrite':'true'},timeout=40);r.raise_for_status();refs.append(r.json()['name'])
    graph=krea_graph(prompt,s,refs,'studio/'+p['id']+'-'+uuid.uuid4().hex[:8]) if s['family']=='krea' else checkpoint_graph(prompt,s,'studio/'+p['id'])
    write(output(p,name+'.workflow.json'),graph)
    r=requests.post(COMFY_URL+'/prompt',json={'prompt':graph,'client_id':'asset-studio-'+p['id']},timeout=30)
    if not r.ok:raise RuntimeError(r.text[:1800])
    job=r.json()['prompt_id'];p['comfyJob']=job;save(p);start=time.time()
    while time.time()-start<7200:
        cancelled(p);history=requests.get(COMFY_URL+'/history/'+job,timeout=20).json().get(job)
        if history:
            if history.get('status',{}).get('status_str')=='error':
                errors=[msg[1] for msg in history['status'].get('messages',[]) if msg[0]=='execution_error']
                raise RuntimeError(str(errors[-1].get('exception_message','Engine error'))[:1500] if errors else 'Image engine failed')
            images=[im for node in history.get('outputs',{}).values() for im in node.get('images',[])]
            if images:
                r=requests.get(COMFY_URL+'/view',params=images[0],timeout=120);r.raise_for_status();output(p,name).write_bytes(r.content)
                with Image.open(output(p,name)) as im:im.verify()
                receipt={'provider':'local ComfyUI','model':s['model'],'settings':s,'prompt':prompt,'references':[{'file':Path(x).name,'sha256':digest(x)}for x in references],'seconds':time.time()-start,'sha256':digest(output(p,name)),'job':job}
                write(output(p,name+'.json'),receipt);return receipt
        time.sleep(1.5)
    raise RuntimeError('Generation exceeded two hours; inspect ComfyUI before retrying')

def make_rig_reference(p,s):
    """Supplement an existing approved pack without replacing its geometry views."""
    if not p.get('art'):raise ValueError('Create the hero concept first.')
    if s['family']!='krea':raise ValueError('Choose Krea for an identity-conditioned T-pose.')
    hero=output(p,p['art']);refs=[hero]
    front=p.get('referencePack',{}).get('outputs',{}).get('front',{}).get('file')
    # An isolated full-body front is safer than a hero sheet: layout conditioning
    # otherwise tends to copy the sheet's extra figures into the T-pose image.
    if front:refs=[output(p,front)]
    name='tpose-'+uuid.uuid4().hex[:10]+'.png'
    prompt=packets.prompts(p['description'],p['style'])['tpose']
    receipt=generate_image(p,{**s,'identityEdit':s.get('referenceMethod')=='identity-edit','width':1280,'height':1024},prompt,refs,name)
    if p.get('rigReference'):p.setdefault('rigReferenceHistory',[]).append(p['rigReference'])
    p['rigReference']={'file':name,'sha256':receipt['sha256'],'heroSha256':digest(hero),'receipt':name+'.json','visualAcceptance':'pending'}
    update(p,'reference-tpose','review','T-pose guide saved. Check identity, level arms, separated fingers and flat feet. Existing model and approvals are retained.')

def make_reference_pack(p,s,roles=None):
    if not p.get('art') or p.get('artBrief')!=brief_digest(p):raise RuntimeError('Create a current hero concept first')
    if s['family']!='krea':raise RuntimeError('Choose Krea for identity-conditioned directional views; the checkpoint route is text-only')
    s={**s,'identityEdit':s.get('referenceMethod')=='identity-edit'}
    hero=output(p,p['art']);token=packets.identity(hero,p['description'],p['style'],s)
    pack=p.get('referencePack')
    if not pack or pack.get('recipeSha256')!=token:
        if pack:p.setdefault('referencePackHistory',[]).append(pack)
        folder='references-'+uuid.uuid4().hex[:10];output(p,folder).mkdir();shutil.copy2(hero,output(p,folder+'/hero.png'))
        pack={'version':packets.VERSION,'folder':folder,'hero':folder+'/hero.png','heroSha256':digest(hero),'recipeSha256':token,'style':p['style'],'complete':False,'calibrated':False,'approval':'pending','outputs':{},'roles':{'shape':'hero only; current local engines accept one image','paint':'individual views require camera and material-region fitting before projection','motion':'walk and strike are visual guides, not generated skeletal clips'}}
        p['referencePack']=pack;p['approvals'].pop('art',None);save(p)
    for i,(role,prompt) in enumerate(packets.prompts(p['description'],p['style']).items()):
        if roles and role not in roles:continue
        cancelled(p);old=pack['outputs'].get(role)
        if old and not roles and output(p,old['file']).is_file() and digest(output(p,old['file']))==old['sha256']:continue
        if old:pack.setdefault('attemptHistory',[]).append({'role':role,**old})
        name=pack['folder']+'/'+role+('-'+uuid.uuid4().hex[:6] if old else '')+'.png';size={'width':1280,'height':1024} if role=='tpose' else {'width':768,'height':1024} if role!='motion' else {'width':1280,'height':768}
        update(p,'references','running','Reference pack: '+role+' / completed views are cached')
        # Shared seed and immutable hero: never recursively feed an unreviewed
        # generated view back as identity, which compounds drift across angles.
        refs=[output(p,pack['outputs']['front']['file'])] if role=='tpose' and pack['outputs'].get('front') else [hero]
        with timed_stage(p,'reference '+role):receipt=generate_image(p,{**s,**size,'seed':s['seed']},prompt,refs,name)
        pack['outputs'][role]={'file':name,'sha256':receipt['sha256'],'prompt':prompt,'receipt':name+'.json'};save(p);write(output(p,pack['folder']+'/manifest.json'),pack)
    if not all(role in pack['outputs'] for role in [*packets.VIEWS,'motion','tpose']):
        pack['complete']=False;save(p);update(p,'concept','review','Inspect the test angle against the hero. Retry this angle if identity drifts; build the remaining references when it matches.');return
    with timed_stage(p,'palette and turnaround sheet'):pack['palette']=packets.assemble(PROJECTS/p['id'],pack,p['description'])
    pack['complete']=True;write(output(p,pack['folder']+'/manifest.json'),pack);save(p)
    update(p,'concept','review','Review hero, six views, T-pose, palette and walk/strike guide. Approve 2D before reconstruction. Generated views require fitting before texture projection.')

def render_reference_pack(p,s):
    model=p.get('animation') or p.get('paint') or p.get('mesh')
    if not model or not p.get('art'):raise RuntimeError('A model and hero concept are required')
    folder='model-references-'+uuid.uuid4().hex[:10]
    with timed_stage(p,'exact model reference renders'):
        run_process(p,[RUNTIME/'.venv/Scripts/python.exe',Path(__file__).with_name('render_references.py'),'--root',PROJECTS/p['id'],'--project',p['id'],'--model',model,'--hero',p['art'],'--folder',folder,'--description',p['description'],'--style',p['style']])
    if p.get('referencePack'):p.setdefault('referencePackHistory',[]).append(p['referencePack'])
    p['referencePack']=read(output(p,folder+'/manifest.json'));p['approvals'].pop('referencePack',None)
    update(p,'concept','review','Exact model references saved: six cameras, palette, walk frames and a separate strike pose proposal. Review guides before reusing them.')

def production_contract(p,s):
    contract={'version':1,'hero':{'file':p.get('art'),'sha256':digest(output(p,p['art'])) if p.get('art')else None},'referencePack':p.get('referencePack'),'engines':{'shape':s['meshEngine'],'paint':s['paintEngine']},'style':p['style'],
      'steps':[
        {'stage':'concept','gate':'Hero identity, six views, T-pose with level arms and separated fingers, palette and walk/strike references reviewed together. A generated back is a proposal until approved.'},
        {'stage':'shape','gate':'Compare silhouette and limb separation in six cameras. Preserve raw reconstruction. Do not infer geometry from a composite sheet.'},
        {'stage':'paint','gate':'Inspect lit, albedo and clay. Use calibrated visible views and material regions; reject front-to-back leakage. Preserve 4K paint when supplied.'},
        {'stage':'motion','gate':'Fit joints and weights to this anatomy. Check both soles: heel-flat-toe, lateral bank, contact and clearance. Inspect wrist fit, digit webbing max strain and all clip seams.'},
        {'stage':'export','gate':'Require owner animation approval and artifact-bound checks. Preserve source mesh, rig, paint and receipts.'}],
      'fittedProfile':p.get('refinementProfile'),'scope':'Vey repair is exact-source fitted. Other anatomy uses a draft rig until fitted and reviewed; a concept sheet does not perform rigging.'}
    write(output(p,'production-contract.json'),contract);return contract

def require_reference_pack(p):
    if not p.get('referencePack'):
        if p.get('referencePackExpected'):raise HTTPException(409,'Build and review the six-view reference pack before approving the complete concept')
        return
    if not packets.current(p['referencePack'],PROJECTS/p['id'],output(p,p['art'])):raise HTTPException(409,'Reference pack is incomplete or changed. Resume the pack and review it before continuing.')
    pack=p['referencePack']
    if pack.get('sourceModel') and digest(output(p,pack['sourceModel']))!=pack['sourceModelSha256']:raise HTTPException(409,'Reference model bytes changed; render the references again')

def make_art(p,s,with_pack=True):
    if s['family']!='krea':raise RuntimeError('The full character reference pack needs Krea reference conditioning. Select Krea in Settings.')
    name='concept-'+uuid.uuid4().hex[:10]+'.png';refs=[output(p,n)for n in p['references']]
    if not refs and (ROOT/'lib/99-art/references/paintline_clash.webp').exists():refs=[ROOT/'lib/99-art/references/paintline_clash.webp']
    with timed_stage(p,'hero concept'):generate_image(p,s,compose_prompt(p['description'],p['style'],len(refs)),refs,name)
    if p.get('art'):p.setdefault('conceptHistory',[]).append({'file':p['art'],'sha256':digest(output(p,p['art'])),'briefSha256':p.get('artBrief'),'replacedAt':time.time()})
    if p.get('referencePack'):p.setdefault('referencePackHistory',[]).append(p.pop('referencePack'))
    p.update(art=name,artBrief=brief_digest(p),mesh=None,paint=None,animation=None,polished=None,imported=False,approvals={},referencePackExpected=p.get('referenceMode')!='model');save(p)
    if with_pack:make_reference_pack(p,s)
    else:update(p,'concept','review','Review the hero face, silhouette, costume and full framing. Build the reference pack next when this direction is right.')

def make_mesh(p,s):
    previous={k:p.get(k) for k in ['mesh','paint','animation','polished','shapeConditioning']}
    comfy_free();name='shape-'+str(int(time.time()))+'.glb'
    budget=shape_plan(s);p['shapeBudget']=budget;save(p)
    receipt=conditioning(p,PROJECTS/p['id'],s['meshEngine']);receipt['budget']=budget;receipt_file=output(p,name+'.conditioning.json');write(receipt_file,receipt)
    if s.get('meshEngine')=='trellis2':trellis_stage(p,s,'shape',name)
    else:run_process(p,[RUNTIME/'.venv/Scripts/python.exe',Path(__file__).with_name('mesh_worker.py'),'--runtime',RUNTIME,'--image',output(p,p['art']),'--conditioning',receipt_file,'--output',output(p,name),'--steps',budget['effective']['steps'],'--resolution',budget['effective']['resolution'],'--seed',s['seed']],timeout=300)
    p['shapeConditioning']={'file':receipt_file.name,**receipt}
    if p.get('mesh'):p.setdefault('meshHistory',[]).append(previous)
    p.pop('paintHistory',None);p['mesh']=name;p['paint']=None;p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None);update(p,'mesh','review','Local image-to-3D complete. Orbit the model and compare the face, silhouette and back before continuing.')
    require_valid_output(p,'mesh')

def trellis_stage(p,s,stage,name,source=None):
    if not config()['trellisReady']:raise RuntimeError('Local Trellis engine has not passed its installation trial')
    if not p.get('art'):raise RuntimeError('Trellis texturing needs a concept reference')
    assert_approved(p,'art','art');comfy_free()
    args=[RUNTIME/'modly-trellis2/venv/Scripts/python.exe',Path(__file__).with_name('trellis_worker.py'),'--runtime',RUNTIME,'--image',output(p,p['art']),'--output',output(p,name),'--stage',stage,'--steps',s.get('trellisSteps',25),'--seed',s['seed'],'--texture-size',s['textureSize']]
    if source:args+=['--mesh',output(p,source)]
    run_process(p,args)

def clean_paint(p,s):
    profile=p.get('paintProfile')
    if not profile or digest(output(p,p['paint']))!=profile['sourceSha256']:raise RuntimeError('Fit a material profile to the current paint first')
    name='paint-clean-'+str(int(time.time()))+'.glb'
    run_process(p,[RUNTIME/'.venv/Scripts/python.exe',Path(__file__).with_name('palette_worker.py'),'--input',output(p,p['paint']),'--output',output(p,name),'--profile',output(p,profile['file'])])
    p.setdefault('paintHistory',[]).append(p['paint']);p['paint']=name;p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None)
    require_valid_output(p,'paint');update(p,'paint','review','Material cleanup saved. Inspect face, back, hands and soles; original generated paint remains in history.')

def blender_stage(p,s,stage):
    field={'paint':'mesh','animation':'paint','polish':'animation'}[stage]
    source=p.get(field) or (p.get('mesh') if stage=='animation' else None)
    if not source:raise RuntimeError('Complete the preceding stage first')
    name=stage+'-'+str(int(time.time()))+'.glb'
    task={'stage':stage,'input':str(output(p,source)),'output':str(output(p,name)),'reference':str(output(p,p['art'])) if p.get('art') else None,'style':p['style'],'textureSize':s['textureSize'],'preserveRig':p.get('imported',False),'seed':s['seed'],'productionContract':str(output(p,'production-contract.json'))}
    write(output(p,'task.json'),task)
    if stage=='paint' and s.get('paintEngine')=='trellis2':trellis_stage(p,s,'paint',name,source)
    else:run_process(p,[RUNTIME/'blender-py311/Scripts/python.exe',Path(__file__).with_name('model_worker.py'),output(p,'task.json')])
    p[stage if stage!='polish' else 'polished']=name
    p['modelReport']=read(output(p,name).with_suffix('.json'),{})
    if stage=='animation' and p.get('rigProfile'):
        quality_name=Path(name).with_suffix('.fitted-quality.json').name
        run_process(p,[RUNTIME/'blender-py311/Scripts/python.exe',Path(__file__).with_name('fitted_quality.py'),output(p,name).with_suffix('.blend'),output(p,quality_name)])
        fitted=read(output(p,quality_name));p['modelReport']['fittedQuality']=quality_name
        p['modelReport']['motionSpeeds']={k:v['contactSpeedMedian']for k,v in fitted['clips'].items()if k in ['Walk','Run']}
        write(output(p,name).with_suffix('.json'),p['modelReport']);p.setdefault('reviewReports',{})['animation']=[quality_name]

    if stage=='paint':p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None)
    if stage=='animation':p['approvals'].pop('animation',None);p['polished']=None;p['motionInput']=digest(output(p,source))
    if stage=='polish':p['polishInput']=digest(output(p,source))
    update(p,stage,'review','Review every animation and deformation before approving polish.' if stage=='animation' else 'Inspect the surface treatment from every side.' if stage=='paint' else 'Polished export ready. Original geometry, paint and animation versions are retained.')
    require_valid_output(p,'polished' if stage=='polish' else stage)

def require_refinement_source(p):
    profile=read(Path(__file__).parent/'pilots/vey-trellis/refinement-profile.json')
    if p.get('refinementProfile')!=profile['id']:raise HTTPException(409,'This fitted recipe is available for the Vey Trellis review project. Other assets need their own material and rig profile.')
    if not p.get('mesh') or digest(output(p,p['mesh']))!=profile['meshSha256']:raise HTTPException(409,'Current geometry differs from the fitted Vey mesh')
    sources=p.get('refinementSources') or {'art':p.get('art'),'paint':p.get('paint'),'animation':p.get('animation')}
    for field,expected in [('art','referenceSha256'),('paint','paintSha256'),('animation','animationSha256')]:
        name=sources.get(field)
        if not name or digest(output(p,name))!=profile[expected]:raise HTTPException(409,'Refinement source or identity changed. Fit and review the profile before applying it.')
    if p.get('art')!=sources['art'] or digest(output(p,p['art']))!=profile['referenceSha256']:raise HTTPException(409,'Current reference differs from the fitted Vey identity')
    if digest(ROOT/'lib/99-art/vey-benchmark-v1/vey-motion.blend')!=profile['sourceRigSha256']:raise HTTPException(409,'Source rig changed; update and review the fitted recipe')
    return sources

def refine_vey(p,s,continuing=False):
    sources=require_refinement_source(p);folder='refine-'+uuid.uuid4().hex[:10];dest=output(p,folder);dest.mkdir()
    scripts=Path(__file__).parent;recipe=scripts/'pilots/vey-trellis';profile=recipe/'refinement-profile.json'
    def step(name,args):
        cancelled(p)
        with timed_stage(p,name):run_process(p,args)
    py=RUNTIME/'.venv/Scripts/python.exe';bp=RUNTIME/'blender-py311/Scripts/python.exe'
    step('surface and sole reconstruction',[py,recipe/'solidify-surface.py','--input',output(p,sources['paint']),'--output',dest/'solid-surface.glb'])
    step('silhouette validation and UVs',[bp,recipe/'repair-shape.py','--input',dest/'solid-surface.glb','--reference',output(p,sources['paint']),'--output',dest/'clean-shape.glb'])
    step('material-region paint',[py,recipe/'refine-paint.py','--input',dest/'clean-shape.glb','--output',dest/'paint-refined.glb','--size',4096])
    step('sole weights and motion',[bp,recipe/'refine-motion.py','--input',ROOT/'lib/99-art/vey-benchmark-v1/vey-motion.blend','--surface',dest/'paint-refined.glb','--atlas',dest/'paint-refined.png','--output-dir',dest])
    step('surface region validation',[py,scripts/'surface_quality.py',dest/'paint-refined.glb','--profile',profile,'--output',dest/'surface-quality.json'])
    step('deformed sole validation',[bp,scripts/'sole_quality.py',dest/'vey-motion.glb','--profile',profile,'--output',dest/'sole-quality.json'])
    # Keep earlier files and approvals as history. A repair creates a new review
    # candidate and cannot inherit approval from different paint or animation.
    p.setdefault('refinementHistory',[]).append({'paint':p.get('paint'),'animation':p.get('animation'),'approvals':dict(p['approvals'])})
    p['refinementSources']=sources;p['paint']=folder+'/paint-refined.glb';p['animation']=folder+'/vey-motion.glb';p['polished']=None;p['approvals'].pop('animation',None)
    p['reviewReports']={'paint':[folder+'/surface-quality.json'],'animation':[folder+'/sole-quality.json']}
    p['motionInput']=digest(dest/'paint-refined.glb');save(p)
    require_valid_output(p,'paint');require_valid_output(p,'animation')
    update(p,'refined-production' if continuing else 'animation','running' if continuing else 'review','Surface and paint checked. Continuing wrist, digit and boot articulation.' if continuing else 'Vey material paint and boot correction complete. Compare all views and full clips before approving. Original files remain available.')

def require_articulation_source(p):
    require_refinement_source(p)
    profile=read(Path(__file__).parent/'pilots/vey-trellis/refinement-profile.json')['articulation']
    sources=p.get('articulationSources') or {'paint':p.get('paint'),'animation':p.get('animation')}
    for field in ['paint','animation']:
        if not sources.get(field) or digest(output(p,sources[field]))!=profile[field+'Sha256']:raise HTTPException(409,'Articulation needs the saved Vey surface-refinement candidate. Run and review that stage first.')
    if digest(ROOT/'lib/99-art/vey-refinement-v1/vey-motion.blend')!=profile['blendSha256']:raise HTTPException(409,'Articulation source rig changed; refit the recipe')
    return sources

def articulate_vey(p,s):
    sources=require_articulation_source(p);folder='articulate-'+uuid.uuid4().hex[:10];dest=output(p,folder);dest.mkdir()
    scripts=Path(__file__).parent;recipe=scripts/'pilots/vey-trellis';profile=recipe/'refinement-profile.json';py=RUNTIME/'.venv/Scripts/python.exe';bp=RUNTIME/'blender-py311/Scripts/python.exe'
    def step(name,args):
        cancelled(p)
        with timed_stage(p,name):run_process(p,args)
    step('boot roll, wrists and digits',[bp,recipe/'refine-articulation.py','--input',ROOT/'lib/99-art/vey-refinement-v1/vey-motion.blend','--output-dir',dest])
    step('articulation validation',[bp,scripts/'articulation_quality.py',dest/'vey-motion.glb','--output',dest/'articulation-quality.json'])
    step('sole validation',[bp,scripts/'sole_quality.py',dest/'vey-motion.glb','--profile',profile,'--output',dest/'sole-quality.json'])
    step('surface validation',[py,scripts/'surface_quality.py',dest/'paint-articulated.glb','--profile',profile,'--output',dest/'surface-quality.json'])
    p.setdefault('refinementHistory',[]).append({'paint':p.get('paint'),'animation':p.get('animation'),'approvals':dict(p['approvals'])})
    p['articulationSources']=sources;p['paint']=folder+'/paint-articulated.glb';p['animation']=folder+'/vey-motion.glb';p['polished']=None;p['approvals'].pop('animation',None)
    p['reviewReports']={'paint':[folder+'/surface-quality.json'],'animation':[folder+'/sole-quality.json',folder+'/articulation-quality.json']};p['motionInput']=digest(dest/'paint-articulated.glb');save(p)
    require_valid_output(p,'paint');require_valid_output(p,'animation')
    update(p,'animation','review','Hands and boot roll refined. Review heel contact, flat support, toe-off and relaxed digits through full walk/run cycles before approval.')

def has_authored_motion(p):
    """Importing a GLB does not imply that it has a usable animated skeleton."""
    path=output(p,p.get('paint') or p['mesh'])
    with path.open('rb') as stream:
        header=stream.read(20)
        if header[:4]!=b'glTF' or header[16:20]!=b'JSON':return False
        document=json.loads(stream.read(int.from_bytes(header[12:16],'little')))
    return bool(document.get('skins') and document.get('animations'))

def worker(key,stage,s):
    global ACTIVE
    p=project(key);ACTIVE={'project':key,'stage':stage};update(p,stage,'running','Working locally. You can leave this tab open.');log_event(p,stage+' started')
    try:
        cancelled(p)
        for step in (['mesh','paint','animation'] if stage=='production' else [stage]):
            cancelled(p);production_contract(p,s);update(p,step,'running','Working locally.')
            with timed_stage(p,step):
                if step=='concept':make_art(p,s)
                elif step=='hero':make_art(p,s,with_pack=False)
                elif step=='references':make_reference_pack(p,s)
                elif step=='reference-tpose':make_rig_reference(p,s)
                elif step.startswith('reference-'):make_reference_pack(p,s,[step.removeprefix('reference-')])
                elif step=='model-references':render_reference_pack(p,s)
                elif step=='refined-production':
                    refine_vey(p,s,continuing=True);articulate_vey(p,s)
                elif step=='mesh':make_mesh(p,s)
                elif step=='refine':refine_vey(p,s)
                elif step=='articulate':articulate_vey(p,s)
                elif step=='clean-paint':clean_paint(p,s)
                elif step=='replay-fitted':replay_fitted(p,s)
                elif step=='animation' and not p.get('rigProfile') and not has_authored_motion(p):
                    prepare_learned_motion(p)
                else:blender_stage(p,s,step)
        production_contract(p,s);log_event(p,stage+' completed')
    except Exception as e:
        diagnostic='failure-'+str(int(time.time()))+'.txt';output(p,diagnostic).write_text(str(e),encoding='utf-8')
        p['failureDiagnostic']=diagnostic
        message=str(e).strip().splitlines()[-1][:360] or 'Local job failed. Inspect its saved diagnostic.'
        update(p,stage,'error',message);log_event(p,'Failed: '+message)
    finally:ACTIVE=None;CANCEL.pop(key,None)

@app.post('/api/projects/{key}/run/{stage}')
def run(key,stage,queue:bool=False):
    p=project(key)
    if stage not in ['concept','hero','mesh','paint','animation','production','polish','refine','articulate','references','model-references','refined-production','clean-paint','replay-fitted']+['reference-'+r for r in [*packets.VIEWS,'motion','tpose']]:raise HTTPException(400,'Unknown stage')
    with LOCK:
        busy=ACTIVE or any(x['status'] in ['queued','running'] for x in list_projects())
        if busy and not (queue and ACTIVE and ACTIVE['project']!=key and p['status'] not in ['queued','running']):
            raise HTTPException(409,'One local GPU job at a time. Wait for or cancel the active job.')
        if stage in ['concept','hero'] and len(p['description'].strip())<8:raise HTTPException(400,'Describe the asset first')
        if (stage=='references' or stage.startswith('reference-')) and not p.get('art'):raise HTTPException(409,'Create or import a hero first')
        if stage in ['refine','refined-production']:require_refinement_source(p)
        if stage=='articulate':require_articulation_source(p)
        if stage=='replay-fitted':require_recipe(p)
        if stage in ['mesh','production']:assert_approved(p,'art','art')
        if stage=='polish':assert_approved(p,'animation','animation')
        if stage in ['paint','animation'] and not p.get('mesh'):raise HTTPException(409,'Create or import a model first')
        if stage=='paint':require_valid_output(p,'mesh')
        if stage=='animation':require_valid_output(p,'paint' if p.get('paint') else 'mesh')
        if stage=='polish':require_valid_output(p,'animation')
        CANCEL[key]=False;update(p,stage,'queued','Waiting behind the active local job.' if busy else 'Waiting for the local worker.');POOL.submit(worker,key,stage,settings())
    return p
@app.post('/api/projects/{key}/cancel')
def cancel(key):
    p=project(key);CANCEL[key]=True
    if p.get('comfyJob'):
        try:requests.post(COMFY_URL+'/interrupt',json={'prompt_id':p['comfyJob']},timeout=3)
        except requests.RequestException:pass
    return {'message':'Cancellation requested'}
@app.post('/api/runtime/start')
def start_runtime():
    if status()['comfy']:return {'message':'ComfyUI is already running'}
    python=RUNTIME/'.venv/Scripts/python.exe'
    if not python.exists():raise HTTPException(409,'Run the local setup first')
    log=(RUNTIME/'comfy.log').open('a',encoding='utf-8')
    subprocess.Popen([str(python),str(COMFY/'main.py'),'--listen','127.0.0.1','--port','8188','--lowvram','--reserve-vram','1.0','--disable-auto-launch'],cwd=COMFY,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));return {'message':'Starting local ComfyUI. Loading may take a moment.'}

@app.get('/files/{path:path}')
def file(path):return FileResponse(local_path(path))
@app.get('/api/projects/{key}/export')
def export(key):
    p=project(key)
    if not p.get('polished'):raise HTTPException(409,'Approve animation and polish before exporting the production package')
    assert_approved(p,'animation','animation')
    if p.get('motionInput')!=digest(output(p,p.get('paint') or p['mesh'])):raise HTTPException(409,'The model changed after motion was prepared')
    if p.get('polishInput')!=digest(output(p,p['animation'])):raise HTTPException(409,'Polish belongs to an older animation')
    require_valid_output(p,'polished')
    archive=output(p,'asset-package.zip');temp=archive.with_suffix('.zip.part')
    required=sum(output(p,name).stat().st_size for name in [p.get('mesh'),p.get('paint'),p.get('animation'),p['polished']] if name and output(p,name).is_file())+128*1024*1024
    if shutil.disk_usage(archive.parent).free<required:
        raise HTTPException(507,'Not enough free disk space to build the ZIP. Free at least '+str(round(required/1024/1024))+' MB, then retry. Saved models remain available individually.')
    try:
        with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED) as z:
            for name in [p.get('art'),p.get('mesh'),p.get('paint'),p.get('animation'),p['polished'],Path(p['polished']).with_suffix('.blend').name,Path(p['polished']).with_suffix('.fbx').name,Path(p['polished']).with_suffix('.json').name,'project.json','timings.json','production-contract.json']+[q['reportFile'] for q in p.get('quality',{}).values() if q.get('reportFile')]:
                if not name:continue
                path=output(p,name)
                if path.exists():z.write(path,name)
            if p.get('referencePack'):
                for path in output(p,p['referencePack']['folder']).glob('*'):
                    if path.is_file():z.write(path,str(path.relative_to(PROJECTS/p['id'])))
            extra=['paint-profile.json','rig-profile.json']
            if p.get('motionGuide'):
                extra.extend(p['motionGuide'][k] for k in ['file','sheet','receipt'])
            if p.get('rigReference'):
                extra.extend([p['rigReference']['file'],p['rigReference']['receipt']])
                if p['rigReference'].get('rawFile'):extra.append(p['rigReference']['rawFile'])
            if p.get('productionRecipe'):
                recipe=require_recipe(p);extra.extend([p['productionRecipe']['file'],recipe['sourcePaint']])
            extra.extend(name for names in p.get('reviewReports',{}).values() for name in names)
            existing=set(z.namelist())
            for name in extra:
                if name not in existing and output(p,name).is_file():z.write(output(p,name),name);existing.add(name)
        temp.replace(archive)
    finally:
        temp.unlink(missing_ok=True)
    return FileResponse(archive,filename=p['id']+'-asset.zip')

import research_pipeline
research_pipeline.register(app,sys.modules[__name__])
import motion_guides
motion_guides.register(app,sys.modules[__name__])

for stale in PROJECTS.glob('*/project.json'):
    p=read(stale)
    if p['status'] in ['queued','running']:p.update(status='error',message='The previous local job was interrupted. Saved outputs are intact.');save(p)
app.mount('/js',StaticFiles(directory=ROOT/'js'),name='js')
app.mount('/lib',StaticFiles(directory=ROOT/'lib'),name='lib')
app.mount('/',StaticFiles(directory=ROOT/'tools/asset-studio/ui',html=True),name='ui')
