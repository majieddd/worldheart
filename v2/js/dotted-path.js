import * as THREE from 'three';
import { REDUCED_MOTION, PALETTE } from './config.js';

// World-distance dots flow toward a decreasing route distance. Only the phase
// uniform moves, so a paused inspector never rebuilds geometry to animate it.
export function dottedPathMaterial(color = PALETTE.energy, spacing = 2.4) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tint: { value: new THREE.Color(color) }, phase: { value: 0 }, spacing: { value: spacing } },
    vertexShader: `attribute float routeDistance; varying float along;
      void main(){along=routeDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 tint; uniform float phase; uniform float spacing; varying float along;
      void main(){float dotPosition=mod(along+phase,spacing)/spacing;
        if(dotPosition>.3)discard;gl_FragColor=vec4(tint,.9);}`,
  });
}

export function advanceDots(material, dt) {
  if (!REDUCED_MOTION) material.uniforms.phase.value = (material.uniforms.phase.value + Math.max(0, dt) * 2.4) % material.uniforms.spacing.value;
}
