"""Exact model turnarounds through the existing Aegis browser renderer."""
import argparse,json,subprocess,hashlib,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import reference_pack as packets
ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--project',required=True);ap.add_argument('--model',required=True);ap.add_argument('--hero',required=True);ap.add_argument('--folder',required=True);ap.add_argument('--description',required=True);ap.add_argument('--style',required=True);a=ap.parse_args()
root=Path(a.root);out=root/a.folder;out.mkdir(exist_ok=True);repo=Path(__file__).resolve().parents[2]
import shutil
shutil.copy2(root/a.hero,out/'hero.png')
runner=Path(os.environ.get('WH_HEADLESS',repo.parent/'aegis-current/aegis-suite/tools/headless.js'))
if not runner.is_file():raise RuntimeError('Configure WH_HEADLESS to the installed Aegis headless.js')
steps=[{'size':[768,1024]},{'eval':"(async()=>{for(let i=0;i<200&&!window.REFERENCE_RENDER?.ready;i++)await new Promise(r=>setTimeout(r,100));if(!window.REFERENCE_RENDER?.ready)throw Error('Renderer not ready');return REFERENCE_RENDER.clips;})()"}]
for name in packets.VIEWS:steps.extend([{'eval':f"REFERENCE_RENDER.view('{name}')"},{'shot':name}])
for i,t in enumerate([.17,.40,.76]):steps.extend([{'eval':f"REFERENCE_RENDER.motion('Walk',{t})"},{'shot':'walk-'+str(i)}])
for i in range(3):steps.extend([{'eval':f'REFERENCE_RENDER.strike({i})'},{'shot':'strike-'+str(i)}])
script=out/'capture.cjs';script.write_text('module.exports='+json.dumps(steps)+';',encoding='utf-8')
url='http://127.0.0.1:8771/reference-render.html?asset=/files/projects/'+a.project+'/'+a.model
subprocess.run(['node',str(runner),url,str(out),str(script.resolve())],check=True,stdout=(out/'capture.log').open('w',encoding='utf-8'),stderr=subprocess.STDOUT)
result=json.loads((out/'summary.json').read_text(encoding='utf-8')) if (out/'summary.json').exists()else None
pack={'version':1,'folder':a.folder,'hero':a.hero,'heroSha256':packets.sha(root/a.hero),'sourceModel':a.model,'sourceModelSha256':packets.sha(root/a.model),'style':a.style,'provider':'local Three.js rendering of exact mesh','calibrated':True,'approval':'pending','complete':True,'outputs':{},'coordinateSystem':'glTF meters, Y up, face +Z; left means anatomical +X','limitations':['Rendered back shows existing mesh paint, not independent evidence of correct hidden-surface design.','Strike poses are an authored proposal on a compatible fitted arm rig; they are not a baked or approved attack clip.']}
for name in packets.VIEWS:pack['outputs'][name]={'file':(Path(a.folder)/(name+'.png')).as_posix(),'sha256':packets.sha(out/(name+'.png'))}
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23);sheet=Image.new('RGB',(1536,1500),'#eeeee7');draw=ImageDraw.Draw(sheet)
for i in range(3):
 im=Image.open(out/f'walk-{i}.png').convert('RGB');im.thumbnail((512,685));sheet.paste(im,(i*512,35));draw.text((i*512+20,10),['WALK / 17% OF CYCLE','WALK / 40% OF CYCLE','WALK / 76% OF CYCLE'][i],fill='#243830',font=font)
# The renderer log retains exact cameras and whether the source has an attack.
log=(out/'capture.log').read_text(encoding='utf-8');data=json.loads(log[log.index('{'):]);evaluations=[v.get('value')for v in data.get('steps',data.get('results',[]))if 'eval'in v]
calibration={name:next(v['value']for v in data['results']if v.get('eval')==f"REFERENCE_RENDER.view('{name}')")for name in packets.VIEWS}
(out/'cameras.json').write_text(json.dumps(calibration,indent=2),encoding='utf-8');pack['outputs']['cameras']={'file':a.folder+'/cameras.json','sha256':packets.sha(out/'cameras.json')}
attack=next((v for v in reversed(evaluations)if isinstance(v,dict)and 'available'in v),{})
if attack.get('available'):
 for i in range(3):
  im=Image.open(out/f'strike-{i}.png').convert('RGB');im.thumbnail((512,685));sheet.paste(im,(i*512,780));draw.text((i*512+20,740),['STRIKE / ANTICIPATE','STRIKE / EXTEND','STRIKE / RECOVER'][i],fill='#243830',font=font)
 draw.text((25,1460),'Strike: authored pose proposal. The accepted walk and source model remain unchanged.',fill='#243830',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20))
else:
 draw.text((30,780),'STRIKE / choreography brief for the next authored clip',fill='#243830',font=font)
 for i,(title,body)in enumerate([('ANTICIPATION','Plant both feet. Turn the torso. Draw the striking arm back.'),('CONTACT','Transfer weight forward. Extend the arm. Keep the wrist aligned.'),('RECOVERY','Retract the arm. Settle the hips. Return to the ready stance.')]):
  y=845+i*80;draw.text((30,y),title,fill='#243830',font=font);draw.text((310,y),body,fill='#243830',font=font)
 draw.text((30,1110),'No strike animation exists in the accepted model. This is guidance, not an approved clip.',fill='#243830',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19))
sheet.save(out/'motion.png');pack['outputs']['motion']={'file':a.folder+'/motion.png','sha256':packets.sha(out/'motion.png')};pack['motionStatus']={'walk':'rendered from source','strike':'authored pose proposal; not an approved attack' if attack.get('available')else'brief only; no source clip'}
packets.assemble(root,pack,a.description);pack['cameraEvidence']='capture.log';(out/'manifest.json').write_text(json.dumps(pack,indent=2),encoding='utf-8');print(json.dumps({'folder':a.folder,'sourceModelSha256':pack['sourceModelSha256'],'motionStatus':pack['motionStatus']}))
