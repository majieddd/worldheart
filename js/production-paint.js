import * as THREE from 'three';
import {createSurfaceMaterials} from './arena-materials.js';
import {GRAPHICS_PRESETS} from './arena-presets.js';

// The approved arena surface recipe, applied to the simulation's existing rigs.
// No screen-space paper overlay, vertex displacement or collision changes.
export async function productionPaint(renderer) {
  const paint=await createSurfaceMaterials(),settings=GRAPHICS_PRESETS.ink132.graphics;
  const materials=new WeakMap(),processed=new WeakMap(),roots=new Set();
  const resolution=new THREE.Vector2(1,1),line={value:settings.line};
  const state={paint:true,outline:true,light:'golden',bands:true};
  let last=-Infinity,meshes=0;
  function convert(source,detail) {
    if(materials.has(source))return materials.get(source);
    if(!(source.isMeshStandardMaterial||source.isMeshLambertMaterial||source.isMeshPhongMaterial)||source.transparent||source.userData.noPaint)return source;
    let mat=paint.material(source.color.getHex(),{detail,plant:source.side===THREE.DoubleSide});
    // Gold and other polished finishes retain their authored reflection maps.
    // Paint and contour still apply; the metal does not turn into yellow wood.
    if(source.metalness>=.65){const toon=mat;mat=source.clone();mat.onBeforeCompile=toon.onBeforeCompile;mat.customProgramCacheKey=toon.customProgramCacheKey;paint.all[paint.all.indexOf(toon)]=mat;}
    for(const key of ['vertexColors','flatShading','side','alphaTest','depthWrite','depthTest','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])mat[key]=source[key];
    mat.color=source.color;mat.emissive=source.emissive||new THREE.Color(0);
    mat.emissiveIntensity=Math.min(source.emissiveIntensity||0,.85);
    if(source.map)mat.map=source.map;
    if(source.emissiveMap)mat.emissiveMap=source.emissiveMap;
    if(source.bumpMap){mat.bumpMap=source.bumpMap;mat.bumpScale=source.bumpScale;}
    const compile=mat.onBeforeCompile,old=source.onBeforeCompile,oldKey=source.customProgramCacheKey();
    mat.onBeforeCompile=shader=>{compile(shader);old.call(source,shader,renderer);};
    mat.customProgramCacheKey=()=>`production-ink132-${detail}-${oldKey}`;
    mat.userData={...source.userData,baseEmissive:mat.emissiveIntensity,painted:true};
    materials.set(source,mat);return mat;
  }
  function outline(mesh,source) {
    // Terrain already supplies a continuous silhouette. Outlining every terrain
    // sector creates false seams, and outlining effects would obscure hit tells.
    if(mesh.name.startsWith('terrain')||mesh.isSkinnedMesh||mesh.geometry.attributes.position.count>100000||Array.isArray(source)||source.transparent||source.userData.noContour||source.alphaTest>0||!source.isMeshStandardMaterial)return;
    const ink=new THREE.MeshBasicMaterial({color:0x293146,side:THREE.BackSide,depthWrite:false});
    ink.toneMapped=false;ink.userData.noPaint=true;
    ink.onBeforeCompile=shader=>{
      shader.uniforms.inkResolution={value:resolution};shader.uniforms.inkWidth=line;
      shader.vertexShader='uniform vec2 inkResolution;uniform float inkWidth;\n'+shader.vertexShader;
      // Reuse foliage's deformation so the ink stays attached to its silhouette.
      const original={uniforms:{},vertexShader:shader.vertexShader,fragmentShader:''};
      source.onBeforeCompile(original,renderer);shader.vertexShader=original.vertexShader;Object.assign(shader.uniforms,original.uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec3 inkNormal=normal;
        #ifdef USE_INSTANCING
          inkNormal=mat3(instanceMatrix)*inkNormal;
        #endif
        vec2 inkDirection=(projectionMatrix*vec4(normalMatrix*inkNormal,0.0)).xy;
        float inkLength=length(inkDirection);
        gl_Position.xy+=inkDirection/max(inkLength,.001)*inkWidth*2.0/inkResolution*gl_Position.w;`);
    };
    ink.customProgramCacheKey=()=>`production-outline-${source.customProgramCacheKey()}`;
    const shell=mesh.isInstancedMesh?new THREE.InstancedMesh(mesh.geometry,ink,0):new THREE.Mesh(mesh.geometry,ink);
    shell.name='painted-contour';shell.userData.paintShell=true;shell.frustumCulled=mesh.frustumCulled;
    if(mesh.isInstancedMesh){shell.instanceMatrix=mesh.instanceMatrix;shell.count=mesh.count;shell.boundingSphere=mesh.boundingSphere;shell.onBeforeRender=()=>{shell.instanceMatrix=mesh.instanceMatrix;shell.count=mesh.count;shell.boundingSphere=mesh.boundingSphere;};}
    shell.renderOrder=mesh.renderOrder;mesh.add(shell);
  }
  function apply(root) {
    if(!root)return;
    roots.add(root);
    const pending=[];
    root.traverse(mesh=>{
      if(!mesh.isMesh||mesh.userData.paintShell||processed.get(mesh)===mesh.material)return;
      const old=mesh.material,detail=!!root.userData.heldEquipment;
      mesh.material=Array.isArray(old)?old.map(m=>convert(m,detail)):convert(old,detail);
      if(mesh.material!==old&&!mesh.children.some(c=>c.userData.paintShell))pending.push([mesh,old]);
      processed.set(mesh,mesh.material);meshes++;
    });
    // setVariant swaps only the factory's materials; custom uniforms remain shared.
    paint.setVariant('v5',state,resolution.x,resolution.y,root);paint.tune(settings);
    root.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.paintShell)processed.set(mesh,mesh.material);});
    for(const [mesh,old]of pending)outline(mesh,old);
  }
  return {apply,settings,
    update(time,scene,held){
      renderer.getDrawingBufferSize(resolution);
      if(time-last<.3)return;last=time;
      apply(scene);if(held){held.userData.heldEquipment=true;apply(held);}
    },
    // Count on inspection rather than retaining removed mesh groups in a Set.
    get stats(){let contours=0;for(const root of roots)root.traverse(m=>{if(m.userData.paintShell)contours++;});return {meshes,materials:paint.all.length,contours,version:'Painted-Anime-Inkline 1.3.2'};}
  };
}
