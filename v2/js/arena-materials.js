import * as THREE from 'three';
import {createCandidateMaterials} from './hard-cel-materials.js';
import {VERSIONS} from './hard-cel-versions.js';

export {GRAPHICS_DEFAULTS,GRAPHICS_LIMITS,normalizeGraphics} from './arena-presets.js';

export async function createSurfaceMaterials(){
  const paint=await createCandidateMaterials(),make=paint.material,shaders=new Set();
  paint.paper.anisotropy=16;
  paint.material=(color,options={})=>{
    const m=make(color,options),compile=m.onBeforeCompile,key=m.customProgramCacheKey;
    m.userData.paintDensity=options.detail?2.4:.22;
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
      shader.fragmentShader=shader.fragmentShader.replace('abs(normalize(paintedNormal))','abs(normalize(surfacePaintNormal))').replace('vec3 p=paintedPosition*0.22;',`vec3 p=surfacePaintPosition*${options.detail?'2.4':'0.22'};`);
    };
    m.customProgramCacheKey=()=>key()+'-surface-anchored-2-'+(options.detail?'weapon':'world');return m;
  };
  paint.tune=g=>{
    if(paint.shells[0])paint.shells[0].material.uniforms.lineWidth.value=g.line;
    for(const s of shaders){if(s.uniforms.paintAmount)s.uniforms.paintAmount.value=g.texture;if(s.uniforms.studySaturation)s.uniforms.studySaturation.value=g.saturation;if(s.uniforms.studyShadowDepth)s.uniforms.studyShadowDepth.value=g.shadowDepth;}
  };
  paint.recipe=Object.freeze({...VERSIONS.v5,bands:Object.freeze([...VERSIONS.v5.bands]),thresholds:Object.freeze([...VERSIONS.v5.thresholds])});
  return paint;
}
