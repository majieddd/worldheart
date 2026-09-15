import * as THREE from 'three';
import {createPaintedMaterials} from '../art-candidates/hard-cel-v1/js/painted-materials.js';
import {VERSIONS} from './hard-cel-versions.js';

export async function createCandidateMaterials(){
  // The frozen factory uses a document-relative texture URL. Redirect only
  // that load into its archived dependency set, then restore normal routing.
  THREE.DefaultLoadingManager.setURLModifier(url=>url.startsWith('lib/painted/')?'art-candidates/hard-cel-v1/'+url:url);
  let base;try{base=await createPaintedMaterials();}finally{THREE.DefaultLoadingManager.setURLModifier(null);}
  const variants=new Map(),originals=new Map();
  const shared={studyVariant:{value:0},studyPigment:{value:1},studyTint:{value:0},studyHatch:{value:0},studyRim:{value:0},studySun:{value:new THREE.Vector3(-13,24,13).normalize()}};
  const ramps={};
  for(const [id,v] of Object.entries(VERSIONS)){if(id==='v1')continue;const data=new Uint8Array(256*4);for(let i=0;i<256;i++){const b=v.bands[i<v.thresholds[0]?0:i<v.thresholds[1]?1:2];data.set([b*255,b*255,b*255,255],i*4);}const tex=new THREE.DataTexture(data,256,1);tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;ramps[id]=tex;}
  function variantMaterial(original){
    const m=original.clone(),compile=original.onBeforeCompile,key=original.customProgramCacheKey;
    m.onBeforeCompile=shader=>{compile.call(m,shader);Object.assign(shader.uniforms,shared);
      shader.fragmentShader='uniform float studyVariant;uniform float studyPigment;uniform float studyTint;uniform float studyHatch;uniform float studyRim;uniform vec3 studySun;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('paintAmount*((pigment-0.78)*0.8+broad)','paintAmount*studyPigment*((pigment-0.78)*0.8+broad)');
      // Baseline skips this branch completely. Marks belong to surfaces, not a screen overlay.
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(studyVariant>0.5){
        vec3 n=normalize(paintedNormal);float facing=dot(n,studySun);float shade=1.0-smoothstep(-.2,.55,facing);
        outgoingLight=mix(outgoingLight,outgoingLight*vec3(.77,.82,1.14)+vec3(.007,.004,.013),studyTint*shade);
        float hatchWave=sin((paintedPosition.x+paintedPosition.y*.8+paintedPosition.z*.45)*45.0);
        float hatch=1.0-smoothstep(.10,.10+max(fwidth(hatchWave)*1.6,.04),abs(hatchWave));
        float fade=1.0-smoothstep(12.0,36.0,1.0/gl_FragCoord.w);
        outgoingLight*=1.0-studyHatch*hatch*shade*fade;
        float edge=pow(1.0-abs(dot(n,normalize(cameraPosition-paintedPosition))),3.0)*smoothstep(-.1,.7,facing);
        outgoingLight+=vec3(1.0,.64,.24)*edge*studyRim;
      }
      #include <opaque_fragment>`);
    };m.customProgramCacheKey=()=>key.call(original)+'-candidate-1';return m;
  }
  base.setVariant=(id,state,w,h,scene)=>{const v=VERSIONS[id];base.setStyle(true,state,w,h);shared.studyVariant.value=id==='v1'?0:1;shared.studyPigment.value=v.pigment;shared.studyTint.value=v.tint;shared.studyHatch.value=state.paint?v.hatch:0;shared.studyRim.value=v.rim;shared.studySun.value.set(state.light==='golden'?-13:-5,state.light==='golden'?24:30,state.light==='golden'?13:10).normalize();
    // The selected original keeps its original shader, not a neutral setting
    // of an experimental shader. Even neutral arithmetic can change pixels.
    for(const original of base.all){if(!variants.has(original)){const m=variantMaterial(original);variants.set(original,m);originals.set(m,original);}const m=variants.get(original);m.color.copy(original.color);m.vertexColors=original.vertexColors;m.gradientMap=ramps[id]||original.gradientMap;m.emissiveIntensity=original.userData.baseEmissive*v.emissive;}
    scene.traverse(mesh=>{if(!mesh.isMesh)return;const original=originals.get(mesh.material)||mesh.material;if(variants.has(original))mesh.material=id==='v1'?original:variants.get(original);});
    if(base.shells[0]){const u=base.shells[0].material.uniforms;u.lineWidth.value=v.line;u.color.value.set(v.ink);}
  };
  return base;
}
