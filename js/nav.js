import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './noise.js';
import { R, SUN_DIR, initTerrainField, terrainHeight, isWalkableDir, surfacePoint } from './world.js';

// Walkability graph over a geodesic icosphere (detail 5, 10242 nodes).
// A single-source Dijkstra from the Worldheart yields a flow field every
// ground enemy steers by; tower placement blocks footprint nodes and is
// validated by checking every portal still reaches the heart.

const DETAIL = CONFIG.navDetail;

function buildIcosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 1048576 + b : b * 1048576 + a;
      let m = cache.get(key);
      if (m !== undefined) return m;
      const va = verts[a], vb = verts[b];
      const v = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
      const l = Math.hypot(...v);
      m = verts.length;
      verts.push([v[0] / l, v[1] / l, v[2] / l]);
      cache.set(key, m);
      return m;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { verts, faces };
}

class MinHeap {
  constructor(cap) {
    this.idx = new Int32Array(cap);
    this.key = new Float32Array(cap);
    this.n = 0;
  }
  push(i, k) {
    let c = this.n++;
    this.idx[c] = i; this.key[c] = k;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.key[p] <= this.key[c]) break;
      this._swap(p, c); c = p;
    }
  }
  pop() {
    const top = this.idx[0];
    this.n--;
    if (this.n > 0) {
      this.idx[0] = this.idx[this.n]; this.key[0] = this.key[this.n];
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < this.n && this.key[l] < this.key[m]) m = l;
        if (r < this.n && this.key[r] < this.key[m]) m = r;
        if (m === c) break;
        this._swap(m, c); c = m;
      }
    }
    return top;
  }
  _swap(a, b) {
    let t = this.idx[a]; this.idx[a] = this.idx[b]; this.idx[b] = t;
    let k = this.key[a]; this.key[a] = this.key[b]; this.key[b] = k;
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const CELLS = 40;

export class NavGraph {
  constructor() {
    this.n = 0;
    this.attempts = 0;
  }

  // Builds the graph for CONFIG.seed, bumping the seed until the world has a
  // large connected walkable region with valid heart and portal sites. Maps
  // with a battlefield cap also search for a viable cap center per seed.
  build() {
    const theta = CONFIG.map.fieldTheta;
    this.portalTarget = CONFIG.map.portalWakes.length;
    for (let attempt = 0; attempt < 14; attempt++) {
      this.attempts = attempt + 1;
      if (attempt > 0) {
        CONFIG.seed = (CONFIG.seed + 7919) >>> 0;
        initTerrainField(CONFIG.seed);
      }
      // Criteria relax as attempts mount so worldgen always converges on the
      // best seed the neighborhood offers.
      const relax = Math.min(attempt / 8, 1);
      if (theta) {
        const rng = mulberry32(CONFIG.seed ^ 0xCA97);
        for (let c = 0; c < 5; c++) {
          const center = this._pickCapCenter(rng, relax);
          this._buildGraph(center, theta);
          if (this._chooseSites(relax, center, theta)) {
            this.fieldCenter = center;
            return;
          }
        }
      } else {
        this._buildGraph();
        if (this._chooseSites(relax)) return;
      }
    }
    throw new Error('worldgen failed to find a playable seed');
  }

  _pickCapCenter(rng, relax) {
    const v = new THREE.Vector3();
    for (let t = 0; t < 400; t++) {
      v.set(rng() * 2 - 1, (rng() * 2 - 1) * 0.58, rng() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize();
      if (v.dot(SUN_DIR) < 0.2 - relax * 0.35) continue;
      return v.clone();
    }
    return SUN_DIR.clone();
  }

  _buildGraph(capCenter = null, capTheta = 0) {
    if (!this._ico) this._ico = buildIcosphere(DETAIL);
    const { verts, faces } = this._ico;
    const total = verts.length;

    let keep = null, oldToNew = null;
    let n;
    if (capCenter) {
      keep = new Uint8Array(total);
      oldToNew = new Int32Array(total).fill(-1);
      const cosLimit = Math.cos(capTheta + 0.02);
      n = 0;
      for (let i = 0; i < total; i++) {
        const [x, y, z] = verts[i];
        if (x * capCenter.x + y * capCenter.y + z * capCenter.z >= cosLimit) {
          keep[i] = 1;
          oldToNew[i] = n++;
        }
      }
    } else {
      n = total;
    }
    this.n = n;

    this.dirs = new Float32Array(n * 3);
    this.pos = new Float32Array(n * 3);
    this.height = new Float32Array(n);
    this.walk = new Uint8Array(n);
    this.block = new Int16Array(n);
    this.dist = new Float32Array(n);
    this.next = new Int32Array(n);
    this.flow = new Float32Array(n * 3);

    for (let i = 0; i < total; i++) {
      if (keep && !keep[i]) continue;
      const idx = keep ? oldToNew[i] : i;
      const [x, y, z] = verts[i];
      this.dirs[idx * 3] = x; this.dirs[idx * 3 + 1] = y; this.dirs[idx * 3 + 2] = z;
      _v.set(x, y, z);
      const h = terrainHeight(x, y, z);
      this.height[idx] = h;
      const p = Math.max(h, 0.03) + R;
      this.pos[idx * 3] = x * p; this.pos[idx * 3 + 1] = y * p; this.pos[idx * 3 + 2] = z * p;
      this.walk[idx] = isWalkableDir(_v) ? 1 : 0;
    }

    // CSR adjacency from unique triangle edges (kept nodes only)
    const edgeSet = new Set();
    const deg = new Int32Array(n);
    const addEdge = (a0, b0) => {
      let a = a0, b = b0;
      if (keep) {
        if (!keep[a0] || !keep[b0]) return;
        a = oldToNew[a0]; b = oldToNew[b0];
      }
      const key = a < b ? a * 1048576 + b : b * 1048576 + a;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      deg[a]++; deg[b]++;
    };
    for (const [a, b, c] of faces) { addEdge(a, b); addEdge(b, c); addEdge(c, a); }

    this.adjOff = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) this.adjOff[i + 1] = this.adjOff[i] + deg[i];
    this.adj = new Int32Array(this.adjOff[n]);
    this.cost = new Float32Array(this.adjOff[n]);
    const cursor = new Int32Array(n);
    for (const key of edgeSet) {
      const a = Math.floor(key / 1048576), b = key % 1048576;
      this.adj[this.adjOff[a] + cursor[a]++] = b;
      this.adj[this.adjOff[b] + cursor[b]++] = a;
    }
    for (let i = 0; i < n; i++) {
      for (let e = this.adjOff[i]; e < this.adjOff[i + 1]; e++) {
        const j = this.adj[e];
        const dx = this.pos[i * 3] - this.pos[j * 3];
        const dy = this.pos[i * 3 + 1] - this.pos[j * 3 + 1];
        const dz = this.pos[i * 3 + 2] - this.pos[j * 3 + 2];
        const len = Math.hypot(dx, dy, dz);
        const dh = Math.abs(this.height[i] - this.height[j]);
        this.cost[e] = len * (1 + dh * 0.7);
      }
    }

    // Spatial hash on direction cells for nearest-node lookups
    this.cells = new Map();
    for (let i = 0; i < n; i++) {
      const key = this._cellKey(this.dirs[i * 3], this.dirs[i * 3 + 1], this.dirs[i * 3 + 2]);
      let arr = this.cells.get(key);
      if (!arr) this.cells.set(key, arr = []);
      arr.push(i);
    }
  }

  _cellKey(x, y, z) {
    const qx = Math.min(CELLS - 1, Math.max(0, ((x + 1) * 0.5 * CELLS) | 0));
    const qy = Math.min(CELLS - 1, Math.max(0, ((y + 1) * 0.5 * CELLS) | 0));
    const qz = Math.min(CELLS - 1, Math.max(0, ((z + 1) * 0.5 * CELLS) | 0));
    return (qx * CELLS + qy) * CELLS + qz;
  }

  nearestNode(dir) {
    const qx = ((dir.x + 1) * 0.5 * CELLS) | 0;
    const qy = ((dir.y + 1) * 0.5 * CELLS) | 0;
    const qz = ((dir.z + 1) * 0.5 * CELLS) | 0;
    let best = -1, bestD = Infinity;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
      const cx = qx + ox, cy = qy + oy, cz = qz + oz;
      if (cx < 0 || cy < 0 || cz < 0 || cx >= CELLS || cy >= CELLS || cz >= CELLS) continue;
      const arr = this.cells.get((cx * CELLS + cy) * CELLS + cz);
      if (!arr) continue;
      for (const i of arr) {
        const dx = this.dirs[i * 3] - dir.x, dy = this.dirs[i * 3 + 1] - dir.y, dz = this.dirs[i * 3 + 2] - dir.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  // Incremental node tracking for a moving agent: hill-descend to whichever
  // neighbor is angularly closer to dir.
  descendNode(idx, dir) {
    if (idx < 0) return this.nearestNode(dir);
    for (let hop = 0; hop < 3; hop++) {
      let best = idx;
      let bestD = this._dirDist2(idx, dir);
      for (let e = this.adjOff[idx]; e < this.adjOff[idx + 1]; e++) {
        const j = this.adj[e];
        const d = this._dirDist2(j, dir);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best === idx) return idx;
      idx = best;
    }
    return idx;
  }

  _dirDist2(i, dir) {
    const dx = this.dirs[i * 3] - dir.x, dy = this.dirs[i * 3 + 1] - dir.y, dz = this.dirs[i * 3 + 2] - dir.z;
    return dx * dx + dy * dy + dz * dz;
  }

  _openness(i, hops = 3) {
    const seen = new Set([i]);
    let frontier = [i];
    for (let h = 0; h < hops; h++) {
      const nf = [];
      for (const a of frontier) {
        for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
          const b = this.adj[e];
          if (this.walk[b] && !seen.has(b)) { seen.add(b); nf.push(b); }
        }
      }
      frontier = nf;
    }
    return seen.size;
  }

  _chooseSites(relax = 0, capCenter = null, capTheta = 0) {
    const n = this.n;
    // Connected walkable regions
    const region = new Int32Array(n).fill(-1);
    const sizes = [];
    for (let i = 0; i < n; i++) {
      if (!this.walk[i] || region[i] >= 0) continue;
      const id = sizes.length;
      let size = 0;
      const stack = [i];
      region[i] = id;
      while (stack.length) {
        const a = stack.pop();
        size++;
        for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
          const b = this.adj[e];
          if (this.walk[b] && region[b] < 0) { region[b] = id; stack.push(b); }
        }
      }
      sizes.push(size);
    }
    if (!sizes.length) return false;
    let main = 0;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
    // Capped battlefields demand a higher land fraction: a walled front that
    // is mostly shallow sea reads washy and plays cramped.
    const baseFrac = capCenter ? 0.2 : 0.12;
    const minRegion = Math.max(560, Math.round(n * (baseFrac - relax * (baseFrac * 0.45))));
    if (sizes[main] < minRegion) return false;
    this.region = region;
    this.mainRegion = main;

    // Heart: open, gently elevated, inside the camera's latitude band
    const rng = mulberry32(CONFIG.seed ^ 0xF00D);
    let heart = -1, heartScore = -1;
    for (let tries = 0; tries < 1000; tries++) {
      const i = (rng() * n) | 0;
      if (!this.walk[i] || region[i] !== main) continue;
      if (!capCenter && Math.abs(this.dirs[i * 3 + 1]) > 0.82) continue;
      if (this.height[i] < 0.14 || this.height[i] > 1.6) continue;
      // The heart anchors the main battlefield: keep it in the sun, and on
      // capped maps pull it toward the field's center.
      const sunDot = this.dirs[i * 3] * SUN_DIR.x + this.dirs[i * 3 + 1] * SUN_DIR.y + this.dirs[i * 3 + 2] * SUN_DIR.z;
      if (!capCenter && sunDot < 0.12 - relax * 0.3) continue;
      let open = this._openness(i) + sunDot * 6;
      if (capCenter) {
        const cd = this.dirs[i * 3] * capCenter.x + this.dirs[i * 3 + 1] * capCenter.y + this.dirs[i * 3 + 2] * capCenter.z;
        const ang = Math.acos(Math.min(Math.max(cd, -1), 1));
        open += (1 - Math.min(ang / capTheta, 1)) * 9;
      }
      if (open > heartScore) { heartScore = open; heart = i; }
    }
    if (heart < 0 || heartScore < 25 - relax * 8) return false;
    this.heartNode = heart;

    // Graph distances from the heart pick spread-out portal sites
    this._dijkstra(heart, null);
    const cands = [];
    let maxD = 0;
    for (let i = 0; i < n; i++) {
      if (this.dist[i] < Infinity && this.walk[i]) maxD = Math.max(maxD, this.dist[i]);
    }
    for (let i = 0; i < n; i++) {
      if (!this.walk[i] || region[i] !== main) continue;
      if (this.dist[i] === Infinity) continue;
      if (this.dist[i] < maxD * (0.42 - relax * 0.12)) continue;
      if (!capCenter && Math.abs(this.dirs[i * 3 + 1]) > 0.86) continue;
      if (this._openness(i, 2) < 12 - relax * 4) continue;
      cands.push(i);
    }
    const target = this.portalTarget || 4;
    if (cands.length < target + 2) return false;

    // Portal separation is measured on unit-sphere chords; capped fields use
    // a budget that fits the cap's diameter.
    const sepBase = capCenter ? Math.pow(capTheta * 0.68, 2) : 0.2;
    const sepMin = sepBase * (1 - relax * 0.6);

    const portals = [];
    let first = cands[0];
    for (const c of cands) if (this.dist[c] > this.dist[first]) first = c;
    portals.push(first);
    while (portals.length < target) {
      let best = -1, bestScore = -1;
      for (const c of cands) {
        let minSep = Infinity;
        for (const p of portals) {
          const dx = this.dirs[c * 3] - this.dirs[p * 3];
          const dy = this.dirs[c * 3 + 1] - this.dirs[p * 3 + 1];
          const dz = this.dirs[c * 3 + 2] - this.dirs[p * 3 + 2];
          minSep = Math.min(minSep, dx * dx + dy * dy + dz * dz);
        }
        const score = minSep + this.dist[c] / maxD * 0.15;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best < 0 || bestScore < sepMin) return false;
      portals.push(best);
    }
    this.portalNodes = portals;
    this.recomputeFlow();
    return true;
  }

  _dijkstra(source, blockFilter) {
    const n = this.n;
    this.dist.fill(Infinity);
    this.next.fill(-1);
    const heap = new MinHeap(n * 6);
    this.dist[source] = 0;
    heap.push(source, 0);
    const done = new Uint8Array(n);
    while (heap.n > 0) {
      const a = heap.pop();
      if (done[a]) continue;
      done[a] = 1;
      const da = this.dist[a];
      for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
        const b = this.adj[e];
        if (done[b] || !this.walk[b]) continue;
        if (this.block[b] !== 0 && b !== source) continue;
        if (blockFilter && blockFilter.has(b)) continue;
        const nd = da + this.cost[e];
        if (nd < this.dist[b]) {
          this.dist[b] = nd;
          this.next[b] = a;
          heap.push(b, nd);
        }
      }
    }
  }

  recomputeFlow() {
    this._dijkstra(this.heartNode, null);
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const j = this.next[i];
      if (j < 0) {
        this.flow[i * 3] = 0; this.flow[i * 3 + 1] = 0; this.flow[i * 3 + 2] = 0;
        continue;
      }
      let fx = this.pos[j * 3] - this.pos[i * 3];
      let fy = this.pos[j * 3 + 1] - this.pos[i * 3 + 1];
      let fz = this.pos[j * 3 + 2] - this.pos[i * 3 + 2];
      const l = Math.hypot(fx, fy, fz) || 1;
      this.flow[i * 3] = fx / l; this.flow[i * 3 + 1] = fy / l; this.flow[i * 3 + 2] = fz / l;
    }
  }

  // Blend the flow of the tracked node and its neighbors, project to the
  // tangent plane at dir. Returns progress (distance to heart) as well.
  sampleFlow(nodeIdx, dir, out) {
    let wSum = 0, fx = 0, fy = 0, fz = 0, dSum = 0;
    const consider = (i) => {
      const w = 1 / (this._dirDist2(i, dir) + 1e-5);
      const hasFlow = this.next[i] >= 0;
      if (hasFlow) {
        fx += this.flow[i * 3] * w;
        fy += this.flow[i * 3 + 1] * w;
        fz += this.flow[i * 3 + 2] * w;
        dSum += this.dist[i] * w;
        wSum += w;
      }
    };
    consider(nodeIdx);
    for (let e = this.adjOff[nodeIdx]; e < this.adjOff[nodeIdx + 1]; e++) consider(this.adj[e]);

    if (wSum === 0) {
      // Stranded fallback: great-circle toward the heart.
      const hx = this.pos[this.heartNode * 3], hy = this.pos[this.heartNode * 3 + 1], hz = this.pos[this.heartNode * 3 + 2];
      _v.set(hx, hy, hz).normalize();
      const d = _v.dot(dir);
      _v.addScaledVector(dir, -d);
      if (_v.lengthSq() < 1e-8) _v.set(0, 1, 0);
      out.copy(_v.normalize());
      return 1e6;
    }
    _v.set(fx / wSum, fy / wSum, fz / wSum);
    const d = _v.dot(dir);
    _v.addScaledVector(dir, -d);
    if (_v.lengthSq() < 1e-8) _v.set(0, 1, 0);
    out.copy(_v.normalize());
    return dSum / wSum;
  }

  nodesInRadius(center, radius) {
    _v2.copy(center).normalize();
    const angR = radius / R;
    const chord2 = Math.pow(2 * Math.sin(Math.min(angR, Math.PI) / 2), 2) * 1.15;
    const span = Math.ceil(angR / (2 / CELLS)) + 1;
    const qx = ((_v2.x + 1) * 0.5 * CELLS) | 0;
    const qy = ((_v2.y + 1) * 0.5 * CELLS) | 0;
    const qz = ((_v2.z + 1) * 0.5 * CELLS) | 0;
    const found = [];
    for (let ox = -span; ox <= span; ox++) for (let oy = -span; oy <= span; oy++) for (let oz = -span; oz <= span; oz++) {
      const cx = qx + ox, cy = qy + oy, cz = qz + oz;
      if (cx < 0 || cy < 0 || cz < 0 || cx >= CELLS || cy >= CELLS || cz >= CELLS) continue;
      const arr = this.cells.get((cx * CELLS + cy) * CELLS + cz);
      if (!arr) continue;
      for (const i of arr) {
        const dx = this.dirs[i * 3] - _v2.x, dy = this.dirs[i * 3 + 1] - _v2.y, dz = this.dirs[i * 3 + 2] - _v2.z;
        if (dx * dx + dy * dy + dz * dz < chord2) found.push(i);
      }
    }
    return found;
  }

  // Would blocking this footprint sever any portal from the heart?
  validatePlacement(center, radius) {
    const nodes = this.nodesInRadius(center, radius);
    const temp = new Set();
    for (const i of nodes) {
      if (this.walk[i] && this.block[i] === 0) temp.add(i);
    }
    if (temp.has(this.heartNode)) return { ok: false, reason: 'heart' };
    for (const p of this.portalNodes) if (temp.has(p)) return { ok: false, reason: 'portal' };
    if (temp.size === 0) return { ok: true };

    // Reachability sweep from the heart with the candidate footprint blocked.
    const n = this.n;
    const seen = new Uint8Array(n);
    const stack = [this.heartNode];
    seen[this.heartNode] = 1;
    let need = this.portalNodes.length;
    const isPortal = new Set(this.portalNodes);
    while (stack.length && need > 0) {
      const a = stack.pop();
      for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
        const b = this.adj[e];
        if (seen[b] || !this.walk[b] || this.block[b] !== 0 || temp.has(b)) continue;
        seen[b] = 1;
        if (isPortal.has(b)) need--;
        stack.push(b);
      }
    }
    return need > 0 ? { ok: false, reason: 'path' } : { ok: true };
  }

  blockNodes(center, radius, towerId) {
    const nodes = this.nodesInRadius(center, radius);
    for (const i of nodes) {
      if (this.block[i] === 0) this.block[i] = towerId;
    }
    this.recomputeFlow();
  }

  unblockNodes(towerId) {
    for (let i = 0; i < this.n; i++) {
      if (this.block[i] === towerId) this.block[i] = 0;
    }
    this.recomputeFlow();
  }

  _traceChain(fromNode, out) {
    let i = fromNode, guard = 0;
    while (i >= 0 && guard++ < 900) {
      out.push(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      if (i === this.heartNode) break;
      i = this.next[i];
    }
    return out;
  }

  // All portal-to-heart polylines, optionally as if a footprint were blocked.
  // One Dijkstra for the whole preview, flow restored afterward.
  previewPaths(tempCenter = null, radius = 0) {
    let temp = null;
    if (tempCenter) {
      temp = new Set();
      for (const i of this.nodesInRadius(tempCenter, radius)) {
        if (this.walk[i] && this.block[i] === 0) temp.add(i);
      }
    }
    if (temp && temp.size) this._dijkstra(this.heartNode, temp);
    const paths = this.portalNodes.map((p) => this._traceChain(p, []));
    if (temp && temp.size) this.recomputeFlow();
    return paths;
  }

  nodePos(i, out) {
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }
  nodeDir(i, out) {
    return out.set(this.dirs[i * 3], this.dirs[i * 3 + 1], this.dirs[i * 3 + 2]);
  }

  buildDebugPoints() {
    const list = [];
    for (let i = 0; i < this.n; i++) if (this.walk[i]) list.push(i);
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 3);
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      _v.set(this.dirs[i * 3], this.dirs[i * 3 + 1], this.dirs[i * 3 + 2]);
      pos[k * 3] = this.pos[i * 3] + _v.x * 0.12;
      pos[k * 3 + 1] = this.pos[i * 3 + 1] + _v.y * 0.12;
      pos[k * 3 + 2] = this.pos[i * 3 + 2] + _v.z * 0.12;
      const blocked = this.block[i] !== 0;
      const unreachable = this.next[i] < 0 && i !== this.heartNode;
      col[k * 3] = blocked ? 1 : unreachable ? 0.9 : 0.15;
      col[k * 3 + 1] = blocked ? 0.2 : unreachable ? 0.7 : 0.9;
      col[k * 3 + 2] = blocked ? 0.25 : unreachable ? 0.1 : 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 20;
    return pts;
  }
}
