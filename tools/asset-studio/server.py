"""Loopback-only asset studio. Models and inference remain on this computer."""
import hashlib,json,os,re,shutil,subprocess,sys,threading,time,uuid,zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from fastapi import FastAPI,HTTPException,Request,UploadFile,File
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from workflows import STYLE,compose_prompt,krea_graph,checkpoint_graph

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path(os.environ.get('WH_STUDIO_RUNTIME',ROOT.parent/'local-asset-runtime')).resolve()
DATA=RUNTIME/'studio-data';DATA.mkdir(parents=True,exist_ok=True)
PROJECTS=DATA/'projects';PROJECTS.mkdir(exist_ok=True)
COMFY=RUNTIME/'ComfyUI';COMFY_URL='http://127.0.0.1:8188'
POOL=ThreadPoolExecutor(max_workers=1);LOCK=threading.RLock();CANCEL={};ACTIVE=None
DEFAULT={'family':'krea','model':'krea2_turbo_int8_convrot.safetensors','loras':[{'name':'krea2_style_reference.safetensors','strength':.8}],'seed':99131,'width':768,'height':1024,'steps':8,'meshSteps':30,'meshResolution':256,'textureSize':2048}
app=FastAPI(docs_url=None,redoc_url=None)

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path,default=None):return json.loads(path.read_text('utf-8')) if path.exists() else default
def write(path,data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8');temp.replace(path)
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
def settings():return {**DEFAULT,**read(DATA/'settings.json',{})}
def brief_digest(p):
    return hashlib.sha256(json.dumps({'description':p['description'],'style':p['style'],'references':[(n,digest(output(p,n))) for n in p['references']]},sort_keys=True).encode()).hexdigest()
def update(p,stage,status,message):
    p['stage']=stage;p['status']=status;p['message']=message;save(p)
def log_event(p,text):
    p.setdefault('events',[]).append({'time':time.time(),'text':text});p['events']=p['events'][-80:];save(p)
def model_files(folder):return sorted(str(p.relative_to(folder)).replace('\\','/') for p in folder.rglob('*.safetensors')) if folder.exists() else []
def config():
    return {'settings':settings(),'styles':[{'id':k,'name':v[0]} for k,v in STYLE.items()],
      'models':[{'family':'krea','name':n} for n in model_files(COMFY/'models/diffusion_models') if 'krea' in n.lower()]+[{'family':'checkpoint','name':n} for n in model_files(COMFY/'models/checkpoints')],
      'loras':model_files(COMFY/'models/loras'),'paths':{'models':str(COMFY/'models'),'projects':str(PROJECTS)}}
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
    for key,lo,hi in [('seed',0,2**48),('width',256,1536),('height',256,1536),('steps',1,60),('meshSteps',5,60),('meshResolution',128,384),('textureSize',512,4096)]:
        if not isinstance(clean[key],int) or not lo<=clean[key]<=hi:raise HTTPException(400,'Invalid '+key)
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
    raw=await file.read(32*1024*1024+1)
    if len(raw)>32*1024*1024:raise HTTPException(413,'Maximum upload size is 32 MB')
    ext=Path(file.filename or '').suffix.lower();name='import-'+uuid.uuid4().hex[:10]+ext;dest=output(p,name)
    if ext=='.glb':
        if raw[:4]!=b'glTF':raise HTTPException(400,'Not a GLB model')
        dest.write_bytes(raw);p.update(mesh=name,paint=None,animation=None,polished=None,stage='mesh',status='review',message='Imported geometry is preserved. Inspect the model, then paint or prepare its animations.');p['imported']=True;p['approvals']={'geometry':digest(dest)}
    elif ext in ['.png','.jpg','.jpeg','.webp']:
        if len(p['references'])>=3:raise HTTPException(400,'Use up to three reference images')
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
    p.update(art=name,artBrief=brief_digest(p),mesh=None,paint=None,animation=None,polished=None,imported=False,approvals={})
    update(p,'concept','review','Imported reference is the concept. Review it and approve 2D before reconstruction.');return p

@app.post('/api/projects/{key}/approve/{stage}')
def approve(key,stage):
    p=project(key)
    if p['status'] in ['running','queued']:raise HTTPException(409,'Wait for the job to finish')
    field={'art':'art','animation':'animation'}.get(stage)
    if not field or not p.get(field):raise HTTPException(409,'There is no completed output to approve')
    if stage=='art' and p.get('artBrief')!=brief_digest(p):raise HTTPException(409,'The concept belongs to an older brief. Generate a new concept or select a reference as the concept.')
    if stage=='animation' and p.get('motionInput')!=digest(output(p,p.get('paint') or p['mesh'])):raise HTTPException(409,'Motion belongs to an older model. Prepare motion again.')
    p['approvals'][stage]=digest(output(p,p[field]));p['status']='approved';p['message']='2D approved. The approved image is locked for reconstruction.' if stage=='art' else 'Animation approved. Polish and export are now available.';log_event(p,stage+' approved by user');save(p);return p

def assert_approved(p,stage,field):
    if not p.get(field) or p['approvals'].get(stage)!=digest(output(p,p[field])):raise HTTPException(409,f'Approve the current {stage} first')
    if stage=='art' and p.get('artBrief')!=brief_digest(p):raise HTTPException(409,'The approved concept no longer matches this brief')
def cancelled(p):
    if CANCEL.get(p['id']):raise RuntimeError('Cancelled by user. Previous outputs are preserved.')
def comfy_free():
    try:requests.post(COMFY_URL+'/free',json={'unload_models':True,'free_memory':True},timeout=10)
    except requests.RequestException:pass
def run_process(p,args):
    log=output(p,'worker.log')
    with log.open('a',encoding='utf-8') as handle:
        child=subprocess.Popen([str(x) for x in args],cwd=ROOT,stdout=handle,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        while child.poll() is None:
            if CANCEL.get(p['id']):child.terminate();child.wait(timeout=20);cancelled(p)
            time.sleep(.4)
    if child.returncode:raise RuntimeError(log.read_text('utf-8',errors='replace')[-1800:])

def make_art(p,s):
    if not (COMFY/'models/text_encoders/qwen3vl_4b_fp8_scaled.safetensors').exists() and (COMFY/'models/text_encoders/qwen3vl_4b_native_bf16.safetensors').exists():s={**s,'encoder':'qwen3vl_4b_native_bf16.safetensors'}
    refs=[]
    source_refs=p['references'][:]
    if not source_refs and (ROOT/'lib/99-art/references/paintline_clash.webp').exists():
        shutil.copy2(ROOT/'lib/99-art/references/paintline_clash.webp',output(p,'style-reference.webp'));source_refs=['style-reference.webp']
    if s['family']=='checkpoint' and p['references']:raise RuntimeError('Reference conditioning is supported by the Krea workflow. Choose Krea to use pasted references; the checkpoint workflow is text-only.')
    for name in source_refs:
        with output(p,name).open('rb') as f:
            r=requests.post(COMFY_URL+'/upload/image',files={'image':(p['id']+'-'+name,f)},data={'overwrite':'true'},timeout=40);r.raise_for_status();refs.append(r.json()['name'])
    prompt=compose_prompt(p['description'],p['style'],len(refs));stamp=str(int(time.time()));prefix='studio/'+p['id']+'-'+stamp
    graph=krea_graph(prompt,s,refs,prefix) if s['family']=='krea' else checkpoint_graph(prompt,s,prefix)
    write(output(p,'workflow-'+stamp+'.json'),graph)
    r=requests.post(COMFY_URL+'/prompt',json={'prompt':graph,'client_id':'asset-studio-'+p['id']},timeout=30)
    if not r.ok:raise RuntimeError(r.text[:1800])
    job=r.json()['prompt_id'];p['comfyJob']=job;save(p);start=time.time()
    while time.time()-start<7200:
        cancelled(p);history=requests.get(COMFY_URL+'/history/'+job,timeout=20).json().get(job)
        if history:
            if history.get('status',{}).get('status_str')=='error':
                errors=[msg[1] for msg in history['status'].get('messages',[]) if msg[0]=='execution_error']
                if errors:raise RuntimeError(errors[-1].get('exception_type','Engine error')+': '+errors[-1].get('exception_message','Unknown error'))
                raise RuntimeError('Image engine failed. Inspect the local ComfyUI log.')
            images=[im for node in history.get('outputs',{}).values() for im in node.get('images',[])]
            if images:
                info=images[0];r=requests.get(COMFY_URL+'/view',params=info,timeout=120);r.raise_for_status();name='concept-'+stamp+'.png';output(p,name).write_bytes(r.content)
                p.update(art=name,artBrief=brief_digest(p),mesh=None,paint=None,animation=None,polished=None,imported=False,approvals={})
                write(output(p,'concept-'+stamp+'.json'),{'provider':'local ComfyUI','model':s['model'],'settings':s,'prompt':prompt,'references':refs,'seconds':time.time()-start,'sha256':digest(output(p,name)),'job':job})
                update(p,'concept','review','Inspect the concept. Approve its identity and style before making a model.');return
        time.sleep(1.5)
    raise RuntimeError('Generation exceeded two hours; inspect the ComfyUI log before retrying')

def make_mesh(p,s):
    comfy_free();name='shape-'+str(int(time.time()))+'.glb'
    run_process(p,[RUNTIME/'.venv/Scripts/python.exe',Path(__file__).with_name('mesh_worker.py'),'--runtime',RUNTIME,'--image',output(p,p['art']),'--output',output(p,name),'--steps',s['meshSteps'],'--resolution',s['meshResolution'],'--seed',s['seed']])
    p['mesh']=name;p['paint']=None;p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None);update(p,'mesh','review','Local image-to-3D complete. Orbit the model and compare the face, silhouette and back before continuing.')

def blender_stage(p,s,stage):
    field={'paint':'mesh','animation':'paint','polish':'animation'}[stage]
    source=p.get(field) or (p.get('mesh') if stage=='animation' else None)
    if not source:raise RuntimeError('Complete the preceding stage first')
    name=stage+'-'+str(int(time.time()))+'.glb'
    task={'stage':stage,'input':str(output(p,source)),'output':str(output(p,name)),'reference':str(output(p,p['art'])) if p.get('art') else None,'style':p['style'],'textureSize':s['textureSize'],'preserveRig':p.get('imported',False),'seed':s['seed']}
    write(output(p,'task.json'),task)
    run_process(p,[RUNTIME/'blender-py311/Scripts/python.exe',Path(__file__).with_name('model_worker.py'),output(p,'task.json')])
    p[stage if stage!='polish' else 'polished']=name
    p['modelReport']=read(output(p,name).with_suffix('.json'),{})
    if stage=='paint':p['animation']=None;p['polished']=None;p['approvals'].pop('animation',None)
    if stage=='animation':p['approvals'].pop('animation',None);p['polished']=None;p['motionInput']=digest(output(p,source))
    update(p,stage,'review','Review every animation and deformation before approving polish.' if stage=='animation' else 'Inspect the surface treatment from every side.' if stage=='paint' else 'Polished export ready. Original geometry, paint and animation versions are retained.')

def worker(key,stage,s):
    global ACTIVE
    p=project(key);ACTIVE={'project':key,'stage':stage};update(p,stage,'running','Working locally. You can leave this tab open.');log_event(p,stage+' started')
    try:
        cancelled(p)
        if stage=='concept':make_art(p,s)
        elif stage=='mesh':make_mesh(p,s)
        elif stage=='production':
            make_mesh(p,s)
            for step in ['paint','animation']:cancelled(p);update(p,step,'running','Working locally.');blender_stage(p,s,step)
        else:blender_stage(p,s,stage)
        log_event(p,stage+' completed')
    except Exception as e:update(p,stage,'error',str(e));log_event(p,'Failed: '+str(e)[:500])
    finally:ACTIVE=None;CANCEL.pop(key,None)

@app.post('/api/projects/{key}/run/{stage}')
def run(key,stage):
    p=project(key)
    if stage not in ['concept','mesh','paint','animation','production','polish']:raise HTTPException(400,'Unknown stage')
    with LOCK:
        if any(x['status'] in ['queued','running'] for x in list_projects()):raise HTTPException(409,'One local GPU job at a time. Wait for or cancel the active job.')
        if stage=='concept' and len(p['description'].strip())<8:raise HTTPException(400,'Describe the asset first')
        if stage in ['mesh','production']:assert_approved(p,'art','art')
        if stage=='polish':assert_approved(p,'animation','animation')
        if stage in ['paint','animation'] and not p.get('mesh'):raise HTTPException(409,'Create or import a model first')
        CANCEL[key]=False;update(p,stage,'queued','Waiting for the local worker.');POOL.submit(worker,key,stage,settings())
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
    archive=output(p,'asset-package.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for name in [p['polished'],Path(p['polished']).with_suffix('.blend').name,Path(p['polished']).with_suffix('.fbx').name,Path(p['polished']).with_suffix('.json').name,'project.json']:
            path=output(p,name)
            if path.exists():z.write(path,name)
    return FileResponse(archive,filename=p['id']+'-asset.zip')

for stale in PROJECTS.glob('*/project.json'):
    p=read(stale)
    if p['status'] in ['queued','running']:p.update(status='error',message='The previous local job was interrupted. Saved outputs are intact.');save(p)
app.mount('/js',StaticFiles(directory=ROOT/'js'),name='js')
app.mount('/lib',StaticFiles(directory=ROOT/'lib'),name='lib')
app.mount('/',StaticFiles(directory=ROOT/'tools/asset-studio/ui',html=True),name='ui')
