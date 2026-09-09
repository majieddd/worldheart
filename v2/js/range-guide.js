import * as THREE from 'three';
import { PALETTE } from './config.js';

// The veil and orbits use the same origin and Euclidean radius as targeting.
// Let scene depth clip the actual sphere against terrain. Rebuilding a ground
// contour sampled thousands of heights and replaced GPU buffers on every
// pointer move, making placement hitch even when the rest of the game was idle.
export class RangeGuide {
  constructor(scene) {
    this.mesh = new THREE.Group();
    this.mesh.visible = false;
    const points = [], segments = 96;
    for (let plane = 0; plane < 3; plane++) for (let i = 0; i < segments; i++) {
      for (const a of [i / segments * Math.PI * 2, (i + 1) / segments * Math.PI * 2]) {
        const c = Math.cos(a), s = Math.sin(a);
        points.push(...(plane === 0 ? [c, s, 0] : plane === 1 ? [c, 0, s] : [0, c, s]));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.mat = new THREE.LineBasicMaterial({ color: PALETTE.energy, transparent: true, opacity: 0.38, depthWrite: false });
    this.outer = new THREE.LineSegments(geometry, this.mat);
    this.inner = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: PALETTE.danger, transparent: true, opacity: 0.55, depthWrite: false }));
    const sphere = new THREE.SphereGeometry(1, 48, 24);
    // One back-facing surface avoids doubled translucent layers and still
    // shows the boundary when the first-person camera is inside the range.
    this.veil = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: PALETTE.energy, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.BackSide }));
    this.innerVeil = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: PALETTE.danger, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.BackSide }));
    this.mesh.add(this.veil, this.innerVeil, this.outer, this.inner);
    scene.add(this.mesh);
  }
  show(visible) { this.mesh.visible = visible; }
  setColor(hex) { this.mat.color.setHex(hex); this.veil.material.color.setHex(hex); }
  place(center, radius, minimum = 0) {
    this.mesh.position.copy(center);
    this.mesh.quaternion.setFromUnitVectors(_up, _dir.copy(center).normalize());
    this.outer.scale.setScalar(radius);
    this.veil.scale.setScalar(radius);
    this.inner.scale.setScalar(minimum);
    this.innerVeil.scale.setScalar(minimum);
    this.inner.visible = this.innerVeil.visible = minimum > 0;
  }
}
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
