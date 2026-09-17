"""Identity-bound concept packets. Generated views remain uncalibrated until fitted."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from workflows import STYLE

VIEWS={'front':'straight front view, face and both palms visible',
 'left':'anatomical LEFT side profile, nose points toward the left edge',
 'right':'anatomical RIGHT side profile, nose points toward the right edge',
 'back':'straight BACK view, back of head and costume; NO face visible',
 'top':'directly overhead TOP view, looking down at crown and shoulders',
 'bottom':'directly underneath BOTTOM view, looking up at soles and underside'}
VERSION=2
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def identity(hero,description,style,settings):
 scripts={name:sha(Path(__file__).with_name(name))for name in ['reference_pack.py','workflows.py']}
 return hashlib.sha256(json.dumps({'version':VERSION,'scripts':scripts,'hero':sha(hero),'brief':description,'style':style,'settings':settings},sort_keys=True).encode()).hexdigest()
def prompts(description,style):
 base='Use the supplied image as the exact character, not just a style reference. Keep its head-to-body proportions, face, all armor shapes, buckle, clasps, material colors and painted ink texture unchanged. Do not redesign it or add ornaments. '
 result={name:f'Rotate the SAME character into {view}. '+base+'Same standing pose. Single full body, complete hands, feet and tail, plain light gray background, orthographic camera. Only the viewing angle changes. No text or extra figures.' for name,view in VIEWS.items()}
 result['motion']=base+'Character motion reference sheet, two rows of three complete full-body side-view poses. Top row walking: heel contact, flat support, toe-off. Bottom row a grounded unarmed strike: anticipation, extension/contact, recovery. Show a relaxed hand during walking and a safe closed fist during striking. Same character and scale in every cell, wide space between poses, plain light gray background. No extra limbs, no cropped feet. This is a visual choreography guide, not animation frames.'
 return result
def current(pack,root,hero):
 if not pack or not pack.get('complete') or pack.get('heroSha256')!=sha(hero):return False
 return all((Path(root)/v['file']).is_file() and sha(Path(root)/v['file'])==v['sha256'] for v in pack.get('outputs',{}).values()) and all(n in pack.get('outputs',{})for n in [*VIEWS,'motion','sheet','palette','prompt'])
def assemble(root,pack,description):
 root=Path(root);folder=Path(pack['folder']);hero=Image.open(root/pack['hero']).convert('RGBA');sample=hero.resize((192,192))
 # Respect alpha first: transparent black is not a costume color.
 transparent=sample.getextrema()[3][0]<128;corner=sample.getpixel((0,0))[:3]
 pixels=[rgb[:3] for rgb in sample.getdata() if rgb[3]>127 and (transparent or sum((rgb[i]-corner[i])**2 for i in range(3))>35**2)]
 strip=Image.new('RGB',(max(1,len(pixels)),1));strip.putdata(pixels or [(120,120,120)])
 quant=strip.quantize(colors=32);pal=quant.getpalette();candidates=[(count,tuple(pal[i*3:i*3+3]))for count,i in sorted(quant.getcolors(),reverse=True)]
 chosen=[candidates.pop(0)]
 while candidates and len(chosen)<8:
  best=max(candidates,key=lambda item:min(sum((a-b)**2 for a,b in zip(item[1],old[1]))for old in chosen)*item[0]**.1);chosen.append(best);candidates.remove(best)
 colors=['#%02x%02x%02x'%color for _,color in chosen]
 material_palette=pack.get('materialPalette')
 if material_palette:colors=['#%02x%02x%02x'%tuple(color)for color in material_palette]
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
 sheet=Image.new('RGB',(1536,1720),'#eeeee7');d=ImageDraw.Draw(sheet)
 for i,name in enumerate(VIEWS):
  im=Image.open(root/pack['outputs'][name]['file']).convert('RGB');im.thumbnail((490,690));x=i%3*512;y=i//3*770;sheet.paste(im,(x+(512-im.width)//2,y+38));d.text((x+24,y+12),name.upper(),font=font,fill='#243830')
 d.text((24,1550),'FITTED MATERIAL PALETTE / skin, armor, trim, energy, eyes' if material_palette else 'SAMPLED sRGB PALETTE / verify material roles before painting',font=small,fill='#243830')
 for i,color in enumerate(colors):
  x=24+i*187;d.rectangle((x,1590,x+158,1650),fill=color);d.text((x,1660),color,font=small,fill='#243830')
 sheet.save(root/folder/'turnaround.png')
 (root/folder/'palette.json').write_text(json.dumps({'colorSpace':'sRGB','colors':colors,'method':'fitted material profile' if material_palette else 'dominant non-background hero pixels','materialRoles':'skin, armor, trim, energy, eyes' if material_palette else 'requires review; these are not segmentation masks'},indent=2),encoding='utf-8')
 camera_note='Individual views are exact model renders; cameras.json records their orthographic transforms. Match those cameras when checking shape and paint.' if pack.get('calibrated') else 'Individual directional views are design guides, not calibrated projection cameras.'
 (root/folder/'portable-prompt.txt').write_text(description+'\n\n'+STYLE[pack['style']][1]+'\n\nUse hero.png as identity. '+camera_note+' Preserve pose, proportions, material boundaries and asymmetry. Fit and verify the back, hands, wrists, soles and full walk/strike cycles. Do not project a front image through the model onto its back.\n',encoding='utf-8')
 for key,file in [('sheet','turnaround.png'),('palette','palette.json'),('prompt','portable-prompt.txt')]:
  p=folder/file;pack['outputs'][key]={'file':p.as_posix(),'sha256':sha(root/p)}
 return colors
