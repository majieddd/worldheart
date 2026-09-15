import * as THREE from 'three';

export async function createPaintedMaterials(){
  const paper=await new THREE.TextureLoader().loadAsync('lib/painted/gouache.png');
  paper.wrapS=paper.wrapT=THREE.RepeatWrapping;paper.colorSpace=THREE.NoColorSpace;paper.anisotropy=4;
  const ramps=[];
  for(const hard of [false,true]){const data=new Uint8Array(256*4);for(let i=0;i<256;i++){let v;if(hard)v=i<92?0.32:i<165?0.62:0.96;else{const t=i/255;v=0.38+0.5*(t*t*(3-2*t))+0.12*Math.pow(t,5);}data.set([v*255,v*255,v*255,255],i*4);}const tex=new THREE.DataTexture(data,256,1);tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;ramps.push(tex);}
  const shared={paintTexture:{value:paper},paintAmount:{value:1},lightMix:{value:0},resolution:{value:new THREE.Vector2(1200,700)},lineWidth:{value:0.7}};
  const all=[],shells=[];
  function material(color,{map=null,plant=false,emissive=0,ink=true}={}){
    const m=new THREE.MeshToonMaterial({color,map,gradientMap:ramps[0],side:plant?THREE.DoubleSide:THREE.FrontSide,emissive:map?0xffffff:color,emissiveMap:map,emissiveIntensity:map?0.10:emissive});
    m.userData.baseEmissive=m.emissiveIntensity;
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,shared);
      shader.vertexShader='varying vec3 paintedPosition;\nvarying vec3 paintedNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npaintedPosition=(modelMatrix*vec4(position,1.0)).xyz;paintedNormal=normalize(mat3(modelMatrix)*normal);');
      shader.fragmentShader='uniform sampler2D paintTexture;uniform float paintAmount;varying vec3 paintedPosition;varying vec3 paintedNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec3 blend=pow(abs(normalize(paintedNormal)),vec3(4.0));blend/=max(dot(blend,vec3(1.0)),0.001);
        vec3 p=paintedPosition*0.22;
        float pigment=dot(texture2D(paintTexture,p.yz).rgb,vec3(0.333))*blend.x+dot(texture2D(paintTexture,p.xz).rgb,vec3(0.333))*blend.y+dot(texture2D(paintTexture,p.xy).rgb,vec3(0.333))*blend.z;
        float broad=sin(p.x*4.7+sin(p.z*5.0))*sin(p.z*3.7+p.y*4.0)*0.018;
        diffuseColor.rgb*=1.0+paintAmount*((pigment-0.78)*0.8+broad);
      `);
    };
    m.customProgramCacheKey=()=>plant?'painted-plant-1':'painted-surface-1';all.push(m);return m;
  }
  const outline=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{resolution:shared.resolution,lineWidth:shared.lineWidth,color:{value:new THREE.Color('#363b38')}},vertexShader:`uniform vec2 resolution;uniform float lineWidth;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vec3 n=normalize(normalMatrix*normal);vec4 clip=projectionMatrix*mv;vec2 d=(projectionMatrix*vec4(n,0.0)).xy;float l=length(d);if(l>0.0001)clip.xy+=d/l*lineWidth*2.0/resolution*clip.w;clip.z+=0.000015*clip.w;gl_Position=clip;}`,fragmentShader:`uniform vec3 color;void main(){gl_FragColor=vec4(color,1.0);
#include <colorspace_fragment>
}`});
  function contour(mesh){const shell=new THREE.Mesh(mesh.geometry,outline);shell.layers.set(1);shell.castShadow=false;shell.receiveShadow=false;mesh.add(shell);shells.push(shell);return shell;}
  function setStyle(hard,options,w,h){for(const m of all){m.gradientMap=ramps[hard?1:0];m.emissiveIntensity=m.userData.baseEmissive*(hard?0.6:1);}shared.paintAmount.value=options.paint?1:0;shared.lineWidth.value=hard?1.45:0.65;shared.resolution.value.set(w,h);outline.uniforms.color.value.set(hard?'#292332':'#41403c');for(const shell of shells)shell.visible=options.ink;}
  return {material,contour,setStyle,all,shells,paper};
}
