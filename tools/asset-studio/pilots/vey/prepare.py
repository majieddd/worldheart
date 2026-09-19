"""Prepare directional inputs without changing the generated reference artwork."""
from pathlib import Path
import json, hashlib
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'lib/99-art/vey-pilot-v1'
sheet=Image.open(OUT/'turnaround.png').convert('RGB')
w,h=sheet.size
views={}
for name,(col,row) in {'front':(0,0),'left':(1,0),'right':(2,0),'back':(0,1),'top':(1,1),'bottom':(2,1)}.items():
    tile=sheet.crop((round(col*w/3),round(row*h/2),round((col+1)*w/3),round((row+1)*h/2)))
    tile.save(OUT/(name+'.png'))
    views[name]={'file':name+'.png','role':'cardinal paint reference' if name in ('front','left','back','right') else 'advisory underside/overhead detail','sha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
palette=[{'name':'Gray skin','hex':'#b5b0aa'},{'name':'Obsidian eyes / ink','hex':'#19171e'},{'name':'Plum technician cloth','hex':'#503747'},{'name':'Slate mantle','hex':'#697a7c'},{'name':'Ivory ceramic','hex':'#d4c6ac'},{'name':'Dark leather','hex':'#393034'},{'name':'Mint instrument','hex':'#9edeb7'},{'name':'Void lens','hex':'#78469a'}]
prompt='Vey the Surveyor, Xeno Gray commander for 99 Planets To Defend. Preserve the supplied identity: oversized smooth pear-shaped cool-gray skull, black almond eyes, two tiny nostrils, tiny closed mouth; slim neck and lean humanoid body, long fingers, three fingers plus thumb. Muted plum technician suit, slate-blue layered short shoulder mantle, ivory collar and forearm/boot cuffs, one ivory shoulder clasp, small mint triangular breast instrument, violet oval belt lens, dark broad boots. No helmet, horns, weapons, additional props or rear face. Matte Painted-Anime-Inkline: rich colored cel shadows, broad handpainted gouache variation, clear dark outer contour, restrained broken interior ink and material scuffs. No crosshatch fill or screen-space pattern. Separate orthographic front, anatomical left, back, anatomical right in identical neutral A-pose and scale; top/bottom detail guides. Use image evidence to resolve appearance. Model with separate movable limbs, deformable elbows/knees/hips/shoulders, stable feet, usable UV islands and crisp painted texture. Back shows plain skull and mantle/suit construction, never mirrored front features. Preserve silhouette first; paint cannot repair missing geometry.'
(OUT/'portable-prompt.txt').write_text(prompt,encoding='utf-8')
manifest={'version':'0.1.0-review','character':'Vey, the Surveyor','ownerApproved':False,'promotionToStudio':False,'style':'Painted-Anime-Inkline','hero':'../identity-v2/gray-commander.png','views':views,'tripoOrder':['front','left','back','right'],'palette':palette,'prompt':prompt,'cameraNote':'Cardinal illustrations are orthographic targets, not measured camera captures. Top/bottom use perspective and guide hidden details only. Separate consistent mesh renders are used for motion review.','sourceGeometry':'../identity-v2/vey-hunyuan.glb','method':'Manual reference / shape / paint / rig / motion pilot; source scripts and intermediate receipts preserved.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'views':len(views),'palette':len(palette),'sourceSize':sheet.size,'ownerApproved':False}))
