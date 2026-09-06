import * as THREE from 'three';
import { CONFIG } from './config.js';
import { surfacePoint } from './world.js';

// The sphere is centred on the very same tower position as acquisition.
// Three intersecting orbits expose height; depth testing hides buried arcs.
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
    this.mat = new THREE.LineBasicMaterial({ color: 0x72f1df, transparent: true, opacity: 0.8, depthWrite: false });
    this.outer = new THREE.LineSegments(geometry, this.mat);
    this.inner = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xff685d, transparent: true, opacity: 0.85, depthWrite: false }));
    this.mesh.add(this.outer, this.inner);
    this.contour = new THREE.LineSegments(new THREE.BufferGeometry(), this.mat);
    this.innerContour = new THREE.LineSegments(new THREE.BufferGeometry(), this.inner.material);
    this.mesh.add(this.contour, this.innerContour);
    this.lastCenter = new THREE.Vector3(Infinity, Infinity, Infinity);
    scene.add(this.mesh);
  }
  show(visible) { this.mesh.visible = visible; }
  setColor(hex) { this.mat.color.setHex(hex); }
  place(center, radius, minimum = 0) {
    this.mesh.position.copy(center);
    this.mesh.quaternion.setFromUnitVectors(_up, _dir.copy(center).normalize());
    this.outer.scale.setScalar(radius);
    this.inner.scale.setScalar(minimum);
    this.inner.visible = minimum > 0;
    this.innerContour.visible = minimum > 0;
    if (CONFIG.terrain && (this.lastCenter.distanceToSquared(center) > 1e-8 || this.lastRadius !== radius || this.lastMinimum !== minimum)) {
      this.lastCenter.copy(center); this.lastRadius = radius; this.lastMinimum = minimum;
      this._groundContour(center, radius, minimum);
    }
  }
  _groundContour(center, radius, minimum) {
    const count = 32, edge = radius * 1.04, points = [], distances = [];
    const rotation = this.mesh.quaternion, inverse = rotation.clone().invert();
    const radial = center.clone().normalize(), base = CONFIG.planetRadius;
    // March a local terrain grid, then bisect crossing edges against the
    // actual height field. Disconnected intersections on steep landforms
    // remain disconnected; a projected flat circle would invent coverage.
    const pointAt = (x, z) => {
      const dir = new THREE.Vector3(x, 0, z).applyQuaternion(rotation).addScaledVector(radial, base).normalize();
      return surfacePoint(dir, new THREE.Vector3());
    };
    for (let z = 0; z <= count; z++) for (let x = 0; x <= count; x++) {
      const p = pointAt((x / count * 2 - 1) * edge, (z / count * 2 - 1) * edge);
      points.push(p); distances.push(p.distanceTo(center));
    }
    for (const [range, line] of [[radius, this.contour], [minimum, this.innerContour]]) {
      const vertices = [];
      const crossing = (a, b) => {
        let pa = points[a].clone(), pb = points[b].clone(), inside = distances[a] < range;
        for (let i = 0; i < 9; i++) {
          const mid = pa.clone().add(pb).normalize(); surfacePoint(mid, mid);
          if ((mid.distanceTo(center) < range) === inside) pa = mid; else pb = mid;
        }
        const p = pa.add(pb).multiplyScalar(0.5);
        p.addScaledVector(p.clone().normalize(), 0.045);
        return p.sub(center).applyQuaternion(inverse);
      };
      if (range > 0) for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
        const a = z * (count + 1) + x, b = a + 1, c = a + count + 1, d = c + 1;
        for (const tri of [[a, b, d], [a, d, c]]) {
          const hits = [];
          for (let i = 0; i < 3; i++) {
            const u = tri[i], v = tri[(i + 1) % 3];
            if ((distances[u] < range) !== (distances[v] < range)) hits.push(crossing(u, v));
          }
          if (hits.length === 2) for (const p of hits) vertices.push(p.x, p.y, p.z);
        }
      }
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry();
      line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    }
  }
}
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
