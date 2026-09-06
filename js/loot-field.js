import * as THREE from 'three';
import { surfacePoint } from './world.js';

const COLORS = { common: 0xd7e1dd, uncommon: 0x68e6aa, rare: 0x75b4ff, relic: 0xfacb69 };
// No loot rules live here. This is the visible, persistent-on-ground side of
// the shell's transactions, with identities instead of recyclable enemy refs.
export class LootField {
  constructor(scene, allies) {
    this.scene = scene; this.allies = allies; this.entries = new Map(); this.time = 0;
    this.geometry = new THREE.OctahedronGeometry(0.32, 0);
    this.beamGeometry = new THREE.CylinderGeometry(0.018, 0.045, 2.7, 5);
    this.materials = Object.fromEntries(Object.entries(COLORS).map(([key, color]) => [key, new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.8,roughness:0.4,metalness:0.15,flatShading:true})]));
    this.boltMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), this.materials.rare, 32);
    this.boltMesh.frustumCulled = false; this.boltMesh.count = 0; scene.add(this.boltMesh);
  }
  add(item, direction) {
    if (this.entries.has(item.id)) return;
    const group = new THREE.Group(), token = new THREE.Mesh(this.geometry, this.materials[item.rarity]);
    token.position.y = 0.7; group.add(token);
    const beam = new THREE.Mesh(this.beamGeometry, this.materials[item.rarity]); beam.position.y = 1.5; group.add(beam);
    const position = surfacePoint(direction, new THREE.Vector3());
    group.position.copy(position); group.quaternion.setFromUnitVectors(_up, direction);
    this.scene.add(group); this.entries.set(item.id, { item, position, group, token });
  }
  remove(id) { const e = this.entries.get(id); if (!e) return; this.scene.remove(e.group); this.entries.delete(id); }
  nearby(position, reach = 2.8) {
    return [...this.entries.values()].filter(e => e.position.distanceTo(position) <= reach).sort((a,b) => a.position.distanceToSquared(position)-b.position.distanceToSquared(position)).map(e=>e.item);
  }
  update(dt) {
    this.time += dt;
    for (const e of this.entries.values()) { e.token.rotation.y = this.time * 0.8; e.token.position.y = 0.7 + Math.sin(this.time * 2) * 0.07; }
    let i = 0;
    for (const b of this.allies._bolts) if (b.live) { _matrix.makeTranslation(b.pos.x,b.pos.y,b.pos.z); this.boltMesh.setMatrixAt(i++, _matrix); }
    this.boltMesh.count = i; this.boltMesh.instanceMatrix.needsUpdate = true;
  }
}
const _up = new THREE.Vector3(0,1,0), _matrix = new THREE.Matrix4();
