import * as THREE from 'three';
import {createCandidateMaterials} from './hard-cel-materials.js';
import {VERSIONS} from './hard-cel-versions.js';

// The recipe is the owner's 1.3.1. Overrides never write into VERSIONS.
export const GRAPHICS_DEFAULTS=Object.freeze({line:1.4,fog:.0115,shadowDepth:.10,saturation:1.16,texture:1,exposure:1,resolution:1.25,fov:78,bob:.35,shake:.45,sensitivity:1});
export const GRAPHICS_LIMITS={line:[0,4],fog:[0,.035],shadowDepth:[0,.35],saturation:[.6,1.65],texture:[0,2],exposure:[.65,1.4],resolution:[.65,1.75],fov:[60,100],bob:[0,1],shake:[0,1],sensitivity:[.4,2]};
export function normalizeGraphics(input={}){return Object.fromEntries(Object.entries(GRAPHICS_DEFAULTS).map(([k,v])=>[k,typeof input[k]==='number'&&Number.isFinite(input[k])?Math.max(GRAPHICS_LIMITS[k][0],Math.min(GRAPHICS_LIMITS[k][1],Number(input[k]))):v]));}

export async function createSurfaceMaterials(){
  const paint=await createCandidateMaterials(),make=paint.material,shaders=new Set();
  paint.material=(color,options={})=>{
    const m=make(color,options),compile=m.onBeforeCompile,key=m.customProgramCacheKey;
    m.onBeforeCompile=shader=>{
      compile(shader);shaders.add(shader);
      // Rest-position pigment follows triangles through skinning. Lighting gets
      // its own deformed world position/normal after the engine's skinning stage.
      shader.vertexShader='varying vec3 surfacePaintPosition;varying vec3 surfacePaintNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('paintedPosition=(modelMatrix*vec4(position,1.0)).xyz;paintedNormal=normalize(mat3(modelMatrix)*normal);',`surfacePaintPosition=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));surfacePaintNormal=normal;`);
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 surfaceWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          surfaceWorld=instanceMatrix*surfaceWorld;
        #endif
        paintedPosition=(modelMatrix*surfaceWorld).xyz;
        paintedNormal=inverseTransformDirection(transformedNormal,viewMatrix);`);
      shader.fragmentShader='varying vec3 surfacePaintPosition;varying vec3 surfacePaintNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('abs(normalize(paintedNormal))','abs(normalize(surfacePaintNormal))').replace('vec3 p=paintedPosition*0.22;','vec3 p=surfacePaintPosition*0.22;');
    };
    m.customProgramCacheKey=()=>key()+'-surface-anchored-1';return m;
  };
  paint.tune=g=>{
    if(paint.shells[0])paint.shells[0].material.uniforms.lineWidth.value=g.line;
    for(const s of shaders){if(s.uniforms.paintAmount)s.uniforms.paintAmount.value=g.texture;if(s.uniforms.studySaturation)s.uniforms.studySaturation.value=g.saturation;if(s.uniforms.studyShadowDepth)s.uniforms.studyShadowDepth.value=g.shadowDepth;}
  };
  paint.recipe=Object.freeze({...VERSIONS.v5,bands:Object.freeze([...VERSIONS.v5.bands]),thresholds:Object.freeze([...VERSIONS.v5.thresholds])});
  return paint;
}
