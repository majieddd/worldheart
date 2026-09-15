import * as THREE from 'three';

// Every viewport uses these same material instances. Only the recipe changes
// between draws, so geometry and animation cannot quietly diverge by style.
export const recipes = [
  { id:'anime', ink:'#352f46', shadow:'#524557', rock:'#d49276', soil:'#d4a378', armor:'#748fac', foliage:'#9ba67f', crystal:'#72ddda', width:0.9, hatch:0.0, grain:0.025 },
  { id:'ink', ink:'#252631', shadow:'#3b363e', rock:'#b5814d', soil:'#ba985e', armor:'#657d8f', foliage:'#7b845a', crystal:'#60c9c9', width:2.7, hatch:0.66, grain:0.11 },
  { id:'hybrid', ink:'#302135', shadow:'#372340', rock:'#ce7969', soil:'#c98a71', armor:'#79739f', foliage:'#8d9374', crystal:'#79dbd5', width:1.8, hatch:0.27, grain:0.055 },
];

const vertex = `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec4 vShadow;
uniform mat4 shadowMatrix;
void main(){
  vec4 world=modelMatrix*vec4(position,1.0);
  vWorld=world.xyz;vLocal=position;
  vNormal=normalize(vec3(vec4(normalMatrix*normal,0.0)*viewMatrix));
  vShadow=shadowMatrix*vec4(world.xyz+vNormal*0.15,1.0);
  gl_Position=projectionMatrix*viewMatrix*world;
}`;

const fragment = `
#include <packing>
varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; varying vec4 vShadow;
uniform vec3 baseColor; uniform vec3 shadeColor; uniform vec3 inkColor; uniform vec3 sunDirection;
uniform float style; uniform float kind; uniform float hatch; uniform float grain; uniform float textures; uniform float sunset;
uniform sampler2D shadowTexture;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float shadow(){vec3 q=vShadow.xyz/vShadow.w;if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0||q.z>1.0)return 1.0;float bias=0.0007+0.001*(1.0-max(dot(normalize(vNormal),sunDirection),0.0));float s=0.0;for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){float d=texture2D(shadowTexture,q.xy+vec2(float(x),float(y))/1536.0).r;s+=step(q.z-bias,d);}}return s/9.0;}
void main(){
  vec3 n=normalize(vNormal),p=kind>=2.0?vLocal:vWorld;
  float ndl=dot(n,sunDirection),lit=ndl*0.5+0.5;
  lit*=mix(0.25,1.0,shadow());
  float band;
  if(style<0.5)band=lit<0.42?0.0:(lit<0.82?0.77:1.0);
  else if(style<1.5)band=lit<0.26?0.0:(lit<0.51?0.38:(lit<0.77?0.72:1.0));
  else band=lit<0.4?0.0:(lit<0.73?0.65:1.0);
  vec3 base=baseColor;
  float broad=noise(p*0.9),fine=noise(p*22.0);
  float strata=sin(p.y*7.0+sin(p.x*0.65)*1.3+sin(p.z*0.8));
  float stone=1.0-step(1.5,kind);
  base*=1.0+textures*(broad-0.5)*0.19;
  base*=1.0-textures*stone*smoothstep(0.82,0.97,strata)*(style<0.5?0.09:0.2);
  float fault=abs(sin(p.x*1.3+p.z*0.9+sin(p.y*1.8)*0.32));
  float cracks=(1.0-smoothstep(0.016,0.04+fwidth(fault),fault))*smoothstep(0.48,0.65,noise(p*0.8))*(1.0-abs(n.y));
  base=mix(base,inkColor,textures*stone*cracks*(style<0.5?0.12:style<1.5?0.65:0.38));
  vec3 shadowColor=mix(base*0.3,shadeColor,style<1.5?0.45:0.7);
  vec3 color=mix(shadowColor,base,band);
  color=mix(color,color*vec3(1.12,0.98,0.91),sunset*band*0.65);
  vec3 an=abs(n);vec2 uv=an.y>0.65?p.xz:(an.x>an.z?p.zy:p.xy);
  float linePhase=(uv.x*1.0+uv.y*1.7)*18.0;
  float aa=max(fwidth(linePhase),0.12);
  float lines=1.0-smoothstep(0.0,aa+0.2,abs(sin(linePhase)));
  float crossPhase=(uv.x*1.6-uv.y)*21.0;
  float crossLine=(1.0-smoothstep(0.0,max(fwidth(crossPhase),0.12)+0.16,abs(sin(crossPhase))))*step(lit,0.36);
  float hatchMask=smoothstep(0.36,0.69,noise(p*2.1))*(1.0-smoothstep(0.36,0.81,lit));
  float scratch=smoothstep(0.85,0.96,noise(vec3(uv*vec2(4.0,35.0),p.y*0.2)));
  color=mix(color,inkColor,textures*(max(lines,crossLine)*hatch*hatchMask+scratch*hatch*0.35));
  color*=1.0+textures*(fine-0.5)*grain;
  float rim=pow(1.0-max(dot(normalize(cameraPosition-vWorld),n),0.0),3.0)*max(ndl,0.0);
  color+=base*rim*(style<0.5?0.13:0.2);
  if(kind>3.5){color=mix(base*0.4,base*1.25,0.35+band*0.55);color+=vec3(0.14,0.2,0.16)*pow(max(dot(reflect(-sunDirection,n),normalize(cameraPosition-vWorld)),0.0),24.0);}
  gl_FragColor=vec4(color,1.0);
  #include <colorspace_fragment>
}`;

export function createMaterialSystem(shadowTexture,shadowMatrix){
  // The depth receiver is offset along its normal in the vertex shader. Cel
  // bands amplify ordinary self-shadow speckling into visible dark patches.
  const shared={shadowTexture:{value:shadowTexture},shadowMatrix:{value:shadowMatrix},sunDirection:{value:new THREE.Vector3(-0.6,0.8,0.5).normalize()},style:{value:0},hatch:{value:0},grain:{value:0},textures:{value:1},sunset:{value:1},shadeColor:{value:new THREE.Color()},inkColor:{value:new THREE.Color()}};
  const materials=new Map();
  const kinds={rock:0,soil:1,armor:2,foliage:3,crystal:4,trim:2,skin:2,dark:2};
  for(const [name,kind] of Object.entries(kinds))materials.set(name,new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{...shared,kind:{value:kind},baseColor:{value:new THREE.Color()}}}));
  const outline=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:true,uniforms:{color:shared.inkColor,width:{value:1},resolution:{value:new THREE.Vector2(800,600)}},vertexShader:`uniform float width;uniform vec2 resolution;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vec3 n=normalize(normalMatrix*normal);vec4 c=projectionMatrix*p;vec2 d=(projectionMatrix*vec4(n,0.0)).xy;float len=length(d);if(len>0.0001)c.xy+=d/len*width*2.0/resolution*c.w;c.z+=0.00001*c.w;gl_Position=c;}`,fragmentShader:`uniform vec3 color;void main(){gl_FragColor=vec4(color,1.0);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const edges=new THREE.LineBasicMaterial({color:0x302135,transparent:true,opacity:0.25});
  function apply(index,options,width,height){const r=recipes[index];shared.style.value=index;shared.hatch.value=r.hatch;shared.grain.value=r.grain;shared.textures.value=options.textures?1:0;shared.sunset.value=options.light==='sunset'?1:0;shared.shadeColor.value.set(options.light==='sunset'?r.shadow:'#636f82');shared.inkColor.value.set(r.ink);outline.uniforms.width.value=options.outlines?r.width:0;outline.uniforms.resolution.value.set(width,height);edges.color.set(r.ink);edges.opacity=options.outlines?(index===0?0.09:index===1?0.6:0.28):0;
    for(const [name,mat] of materials){mat.uniforms.baseColor.value.set(r[name]||({trim:'#d6c7b5',skin:'#eac19b',dark:'#454458'}[name]));}
  }
  return {materials,outline,edges,shared,apply};
}
