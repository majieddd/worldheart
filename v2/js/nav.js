import { buildIcosphere } from './geodesic.js';
import { surveyBattlefield } from './terrain/acceptance.js';
import * as THREE from 'three';
import { nestSite, NEST_SCHEDULE_CAPACITY } from './nest-sites.js';
import { CONFIG } from './config.js';
import { mulberry32 } from './noise.js';
import { travelCost, isFloorTerrain, MOUNTAIN_MARCH } from './traversal.js';
import { R, SUN_DIR, SPACE, initTerrainField, terrainHeight, isWalkableDir, isLandDir, surfacePoint } from './world.js';
import * as WORLD from './world.js';

// Walkability graph over a geodesic icosphere (detail 5, 10242 nodes).
// A single-source Dijkstra from the Worldheart yields a flow field every
// ground enemy steers by; tower placement blocks footprint nodes and is
// validated by checking every portal still reaches the heart.

const DETAIL = CONFIG.navDetail;


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

// Walkable nodes wanted within six hops of the heart: three-fifths of the
// 127 a full six-hop neighbourhood holds on this graph.
const FOOTHOLD_MIN = 76;

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

    // Space Battlefields are authored, not searched: the platform layout is
    // deterministic per seed, the whole cap is flight space (pathable), and
    // the heart and breach sites come straight from the layout.
    if (CONFIG.map.mode === 'space') {
      const space = WORLD.SPACE;
      this.attempts = 1;
      this._buildGraph(space.center, theta, true);
      const heartSite = space.sites.find((s) => s.kind === 'heart');
      this.heartNode = this.nearestWalkableNode(heartSite.dir);
      this.portalNodes = space.sites
        .filter((s) => s.kind === 'portal')
        .map((s) => this.nearestWalkableNode(s.dir));
      this.fieldCenter = space.center.clone();
      this.recomputeFlow();
      return;
    }

    // Seed search on a colossal world would cost seconds per attempt at full
    // resolution, so candidate seeds are judged on a cheap scout graph and
    // only the winner is built at full detail.
    // One level below full: fine enough to resolve real coastlines (a coarser
    // scout shatters continents into islands that do not exist at play
    // resolution) and cheap because the land test skips slope and forest.
    const scoutDetail = DETAIL > 6 ? DETAIL - 1 : 0;

    // Ocean campaign fronts can exhaust the old fourteen-seed neighborhood
    // without a dry buildable anchor. Keep deterministic retries and all site
    // constraints, but give these varied worlds a wider bounded search.
    for (let attempt = 0; attempt < (CONFIG.terrain ? 32 : 14); attempt++) {
      this.attempts = attempt + 1;
      if (attempt > 0) {
        CONFIG.seed = (CONFIG.seed + 7919) >>> 0;
        initTerrainField(CONFIG.seed);
      }
      // Criteria relax as attempts mount so worldgen always converges on the
      // best seed the neighborhood offers.
      const relax = Math.min(attempt / 8, 1);
      if (!theta && scoutDetail) {
        this._buildGraph(null, 0, false, scoutDetail, true);
        if (!this._chooseSites(relax)) continue;
        this._buildGraph(null, 0, false, DETAIL);
        for (let r = relax; r <= 1.0001; r = Math.min(1, r + 0.25)) {
          if (this._chooseSites(r)) return;
          if (r >= 1) break;
        }
        continue;
      }
      if (theta) {
        const rng = mulberry32(CONFIG.seed ^ 0xCA97);
        for (let c = 0; c < 5; c++) {
          const center = this._pickCapCenter(rng, relax, theta);
          // A front that is mostly sea is not a battlefield; try another seed.
          if (this.capLandFrac < 0.76 - relax * 0.3) break;
          this._buildGraph(center, theta);
          if (this._chooseSites(relax, center, theta)) {
            this.fieldCenter = CONFIG.terrain ? this.nodeDir(this.heartNode, new THREE.Vector3()) : center;
            if (CONFIG.map.mode === 'ninetynine') {
              const heart=this.nodeDir(this.heartNode,new THREE.Vector3());
              const portals=this.portalNodes.map(n=>this.nodeDir(n,new THREE.Vector3()));
              const ico=buildIcosphere(DETAIL,this.fieldCenter,theta,7);
              this._buildGraph(null,0,false,DETAIL,false,ico);
              this.heartNode=this.nearestWalkableNode(heart);
              this.portalNodes=portals.map(d=>this.nearestWalkableNode(d));
              this.global=true;
              this.recomputeFlow();
            }
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

  // A battlefield must sit on ground the player can actually build on. Sunlit
  // placement alone once dropped the front over open ocean, where most of the
  // visible field refused every tower.
  _pickCapCenter(rng, relax, theta) {
    const v = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const probe = new THREE.Vector3();
    const SAMPLES = 56;
    let best = null, bestLand = -1, bestFrac = -1;

    for (let t = 0; t < 700; t++) {
      v.set(rng() * 2 - 1, (rng() * 2 - 1) * 0.58, rng() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize();
      if (v.dot(SUN_DIR) < 0.2 - relax * 0.35) continue;
      // Anchor on dry ground before paying for the full cap survey.
      const anchorHeight = terrainHeight(v.x, v.y, v.z, false);
      if (anchorHeight < 0.15) continue;
      if (CONFIG.terrain && (anchorHeight > 1.3 || !WORLD.isBuildableDir(v) || !isWalkableDir(v) || WORLD.climateAt(v, anchorHeight) !== 'neutral')) continue;
      if (CONFIG.terrain && WORLD.continentalityAt(v.x, v.y, v.z) - CONFIG.terrain.ocean < .22) continue;

      if (Math.abs(v.y) < 0.93) e1.set(0, 1, 0); else e1.set(1, 0, 0);
      e2.crossVectors(v, e1).normalize();
      e1.crossVectors(e2, v).normalize();

      // The cap is 0.52 rad across, so gating only the CENTRE on sun leaves the
      // rim free to sit anywhere: measured on one seed the sun ran from 2 to 59
      // degrees of elevation around a single playfield, and since the frontier
      // widens every wave the run deliberately opens the badly lit half. Score
      // the dimmest point on the rim too, and reject a cap whose far edge is in
      // effective dusk.
      let minRim = 1;
      for (let s = 0; s < 6; s++) {
        const az = (s / 6) * Math.PI * 2;
        probe.copy(v).multiplyScalar(Math.cos(theta))
          .addScaledVector(e1, Math.sin(theta) * Math.cos(az))
          .addScaledVector(e2, Math.sin(theta) * Math.sin(az))
          .normalize();
        const d = probe.dot(SUN_DIR);
        if (d < minRim) minRim = d;
      }
      // A hard floor here rejected every candidate and the relax loop then
      // climbed until the gate stopped mattering, landing on the same dim field
      // it started with. Rim light is a PREFERENCE instead: only genuine night
      // is refused, and the rest is scored, so the scout always finds a field
      // and picks the best lit one available.
      if (minRim < -0.12) continue;

      let land = 0, traversable = 0, inlandFloor = 0, sampledPeak = 0;
      const exposedFamilies = new Set();
      for (let s = 0; s < SAMPLES; s++) {
        // sunflower spiral: even coverage of the cap with few samples
        const ang = theta * Math.sqrt((s + 0.5) / SAMPLES);
        const az = s * 2.39996323;
        probe.copy(v).multiplyScalar(Math.cos(ang))
          .addScaledVector(e1, Math.sin(ang) * Math.cos(az))
          .addScaledVector(e2, Math.sin(ang) * Math.sin(az))
          .normalize();
        const h = terrainHeight(probe.x, probe.y, probe.z, false);
        sampledPeak = Math.max(sampledPeak, h);
        if (CONFIG.terrain && h > 2) exposedFamilies.add(WORLD.FORMATIONS.inspect(probe.x, probe.y, probe.z).type);
        if (h >= 0.05) land++;
        if (CONFIG.terrain && h >= .18 && isWalkableDir(probe)) {
          traversable++;
          if (h <= 1.5 && WORLD.continentalityAt(probe.x, probe.y, probe.z) - CONFIG.terrain.ocean > .25) inlandFloor++;
        }
      }
      const frac = land / SAMPLES;
      // A globally tall alpine seed is not enough if its playable cap only
      // contains foothills. Survey a real major peak inside this battlefield.
      if (CONFIG.terrainKey === 'alpine' && CONFIG.terrain && sampledPeak < CONFIG.terrain.range * .65) continue;
      if (CONFIG.terrain && (exposedFamilies.size < 3 || sampledPeak < 16)) continue;
      // Land is still what matters most - a field in the sea is unplayable
      // where a dim one is merely moody - so rim light is a modest bonus that
      // breaks ties between otherwise equal caps.
      const walkFraction = traversable / SAMPLES;
      const score = frac + 0.35 * Math.max(0, Math.min(0.6, minRim)) + (CONFIG.terrain ? walkFraction * 0.4 + inlandFloor / SAMPLES * .8 + Math.min(5,exposedFamilies.size)*.055 : 0);
      if (score > bestLand) { bestLand = score; bestFrac = frac; best = v.clone(); }
      if (bestFrac >= 0.86 && minRim > 0.25 && (!CONFIG.terrain || walkFraction > 0.65)) break;
    }
    // The blended score chose the field; the land fraction is what the caller
    // gates on, so report that rather than the score.
    this.capLandFrac = bestFrac;
    return best || SUN_DIR.clone();
  }

  _buildGraph(capCenter = null, capTheta = 0, walkAll = false, detail = DETAIL, coarse = false, supplied = null) {
    let ico = supplied;
    if (ico) { /* accepted whole-world topology supplied by build() */ }
    else if (capCenter) {
      // Cap-pruned spheres depend on where the field landed, so they are built
      // per attempt rather than cached; pruning keeps that cheap.
      ico = buildIcosphere(detail, capCenter, capTheta);
    } else {
      if (!this._icoCache) this._icoCache = new Map();
      ico = this._icoCache.get(detail);
      if (!ico) { ico = buildIcosphere(detail); this._icoCache.set(detail, ico); }
    }
    const { verts, faces } = ico;
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
    // Node spacing at this resolution (derived from the detail level, since a
    // cap-pruned sphere carries only part of the globe), and the factor that
    // keeps a tower footprint meaningful against the grid.
    this.spacing = Math.sqrt((4 * Math.PI * R * R) / (10 * Math.pow(4, detail) + 2));
    this.footprintScale = Math.max(1, Math.min(1.7, this.spacing / 1.05));

    this.dirs = new Float32Array(n * 3);
    this.pos = new Float32Array(n * 3);
    this.height = new Float32Array(n);
    this.baseHeight = new Float32Array(n);
    this.waterDepth = new Float32Array(n);
    this.walk = new Uint8Array(n);
    this.floorWalk = CONFIG.terrain ? new Uint8Array(n) : null;
    this.march = null;
    this.block = new Int16Array(n);
    this.dist = new Float32Array(n);
    this.next = new Int32Array(n);
    this.flow = new Float32Array(n * 3);
    this.airWalk = CONFIG.terrain ? new Uint8Array(n) : null;
    this.airDist = CONFIG.terrain ? new Float32Array(n) : null;
    this.airNext = CONFIG.terrain ? new Int32Array(n) : null;
    this._airReady = false;
    this.revision = (this.revision || 0) + 1;

    for (let i = 0; i < total; i++) {
      if (keep && !keep[i]) continue;
      const idx = keep ? oldToNew[i] : i;
      const [x, y, z] = verts[i];
      this.dirs[idx * 3] = x; this.dirs[idx * 3 + 1] = y; this.dirs[idx * 3 + 2] = z;
      _v.set(x, y, z);
      const h = terrainHeight(x, y, z);
      this.height[idx] = h;
      this.baseHeight[idx] = CONFIG.terrain ? terrainHeight(x, y, z, false) : h;
      this.waterDepth[idx] = WORLD.waterDepthAt(_v,this.baseHeight[idx]);
      if (this.airWalk) this.airWalk[idx] = WORLD.canFlyAt(_v, WORLD.FLIGHT_CLEARANCE + 2) ? 1 : 0;
      const p = (CONFIG.terrain ? WORLD.surfaceElevation(_v,h) : Math.max(h,.03)) + R;
      this.pos[idx * 3] = x * p; this.pos[idx * 3 + 1] = y * p; this.pos[idx * 3 + 2] = z * p;
      // Space flight lanes: the void is pathable, the rocks are not, so the
      // flow field bends every lane around the platforms.
      this.walk[idx] = walkAll ? (h < 0.55 ? 1 : 0)
        : (coarse ? (isLandDir(_v) ? 1 : 0) : (isWalkableDir(_v) ? 1 : 0));
      if(this.floorWalk)this.floorWalk[idx]=this.walk[idx]&&isFloorTerrain(this.baseHeight[idx],WORLD.slopeAt(_v),this.waterDepth[idx])?1:0;
      // The retained mesh includes a stitching margin outside the wall.
      // It must never become a route that the movement boundary refuses.
      if (CONFIG.terrain && capCenter && _v.dot(capCenter) < Math.cos(capTheta - 0.8 / R)) {
        this.walk[idx] = 0;
        this.floorWalk[idx] = 0;
        this.airWalk[idx] = 0;
      }
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
    this.airCost = CONFIG.terrain ? new Float32Array(this.adjOff[n]) : null;
    const cursor = new Int32Array(n);
    for (const key of edgeSet) {
      const a = Math.floor(key / 1048576), b = key % 1048576;
      this.adj[this.adjOff[a] + cursor[a]++] = b;
      this.adj[this.adjOff[b] + cursor[b]++] = a;
    }
    if (this.airWalk) {
      const centre = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), probe = new THREE.Vector3();
      for (let i = 0; i < n; i++) if (this.airWalk[i]) {
        let nearRelief = this.baseHeight[i] > WORLD.FLIGHT_CEILING * 0.2;
        for (let e = this.adjOff[i]; !nearRelief && e < this.adjOff[i + 1]; e++) nearRelief = this.baseHeight[this.adj[e]] > WORLD.FLIGHT_CEILING * 0.2;
        if (!nearRelief) continue;
        this.nodeDir(i, centre).normalize();
        a.set(0, Math.abs(centre.y) < 0.9 ? 1 : 0, Math.abs(centre.y) < 0.9 ? 0 : 1);
        b.crossVectors(centre, a).normalize(); a.crossVectors(b, centre).normalize();
        for (let sample = 0; sample < 24; sample++) {
          const angle = sample % 8 * Math.PI / 4, distance = (1 + Math.floor(sample / 8)) * this.spacing * 0.3;
          probe.copy(centre).addScaledVector(a, Math.cos(angle) * distance / R).addScaledVector(b, Math.sin(angle) * distance / R).normalize();
          if (!WORLD.canFlyAt(probe, WORLD.FLIGHT_CLEARANCE + 1)) { this.airWalk[i] = 0; break; }
        }
      }
      const safe = this.airWalk.slice();
      // Keep the entire steering cell clear of a ceiling-height cliff,
      // including its corners, not merely the height at its centre.
      for (let i = 0; i < n; i++) if (safe[i]) {
        for (let e = this.adjOff[i]; e < this.adjOff[i + 1]; e++) {
          if (!safe[this.adj[e]]) { this.airWalk[i] = 0; break; }
        }
      }
    }
    this._routeHeuristicScale = CONFIG.terrain ? Infinity : 0;
    for (let i = 0; i < n; i++) {
      for (let e = this.adjOff[i]; e < this.adjOff[i + 1]; e++) {
        const j = this.adj[e];
        const dx = this.pos[i * 3] - this.pos[j * 3];
        const dy = this.pos[i * 3 + 1] - this.pos[j * 3 + 1];
        const dz = this.pos[i * 3 + 2] - this.pos[j * 3 + 2];
        const len = Math.hypot(dx, dy, dz);
        const dh = Math.abs(this.height[i] - this.height[j]);
        this.cost[e] = len * (1 + dh * 0.7);
        if (CONFIG.terrain) {
          const dot = this.dirs[i * 3] * this.dirs[j * 3] + this.dirs[i * 3 + 1] * this.dirs[j * 3 + 1] + this.dirs[i * 3 + 2] * this.dirs[j * 3 + 2];
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
          const horizontal = angle * (R + ((this.waterDepth[i]>0?.03:this.baseHeight[i]) + (this.waterDepth[j]>0?.03:this.baseHeight[j]))*.5);
          // Dijkstra expands OUT from the destination. Store the incoming
          // j -> i travel cost, so a route uphill really costs more time.
          this.cost[e] = travelCost(this.baseHeight[j], this.baseHeight[i], horizontal, this.waterDepth[j], this.waterDepth[i]);
          _v.set(this.dirs[i * 3] + this.dirs[j * 3], this.dirs[i * 3 + 1] + this.dirs[j * 3 + 1], this.dirs[i * 3 + 2] + this.dirs[j * 3 + 2]).normalize();
          this.airCost[e] = this.airWalk[i] && this.airWalk[j] && WORLD.canFlyAt(_v, WORLD.FLIGHT_CLEARANCE + 2) ? angle * R : Infinity;
          // A conservative lower cost per unit chord, measured from every
          // actual directed edge. This keeps point-search A* admissible even
          // with Float32 direction/edge rounding or future traversal costs.
          const chord=Math.hypot(this.dirs[i*3]-this.dirs[j*3],this.dirs[i*3+1]-this.dirs[j*3+1],this.dirs[i*3+2]-this.dirs[j*3+2]);
          if(chord>0&&Number.isFinite(this.cost[e]))this._routeHeuristicScale=Math.min(this._routeHeuristicScale,this.cost[e]/chord*.999);
        }
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

  // Nearest node that is actually pathable: BFS outward from the nearest
  // node until one qualifies (goal and spawn anchors sit at rock edges).
  nearestWalkableNode(dir, unblocked = false) {
    let start = this.nearestNode(dir);
    if (start < 0) return -1;
    if (this.walk[start] && (!unblocked || !this.block[start])) return start;
    const seen = new Set([start]);
    let frontier = [start];
    for (let hop = 0; hop < 24; hop++) {
      const next = [];
      for (const a of frontier) {
        for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
          const b = this.adj[e];
          if (seen.has(b)) continue;
          if (this.walk[b] && (!unblocked || !this.block[b])) return b;
          seen.add(b);
          next.push(b);
        }
      }
      frontier = next;
    }
    return unblocked ? -1 : start;
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

  // Generation-marked scratch: worldgen calls this once per node on graphs of
  // 160k+, so it must not allocate.
  _scratch() {
    if (!this._mark || this._mark.length !== this.n) {
      this._mark = new Int32Array(this.n);
      this._gen = 0;
      this._fA = [];
      this._fB = [];
    }
    this._gen++;
    return this._mark;
  }

  _openness(i, hops = 3) {
    const mark = this._scratch();
    const g = this._gen;
    let frontier = this._fA, next = this._fB;
    frontier.length = 0;
    mark[i] = g;
    frontier.push(i);
    let count = 1;
    for (let h = 0; h < hops; h++) {
      next.length = 0;
      for (let k = 0; k < frontier.length; k++) {
        const a = frontier[k];
        for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
          const b = this.adj[e];
          if (this.walk[b] && mark[b] !== g) { mark[b] = g; next.push(b); count++; }
        }
      }
      const swap = frontier; frontier = next; next = swap;
    }
    this._fA = frontier; this._fB = next;
    return count;
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
    // Enough connected ground to host a war, not a fixed share of the globe:
    // on a colossal planet a 12% landmass would be an impossible supercontinent.
    const baseFrac = capCenter ? 0.2 : 0.12;
    const minRegion = Math.min(
      Math.max(560, Math.round(n * (baseFrac - relax * (baseFrac * 0.45)))),
      Math.round(6000 * (1 - relax * 0.35)),
    );
    if (sizes[main] < minRegion) return false;
    this.region = region;
    this.mainRegion = main;

    // Heart: open, gently elevated, inside the camera's latitude band
    const rng = mulberry32(CONFIG.seed ^ 0xF00D);
    let heart = -1, heartScore = -1;
    for (let tries = 0; tries < (CONFIG.terrain && capCenter ? 1 : 1000); tries++) {
      // Campaign territory and crystal delivery are anchored on the actual
      // base. Choose its surveyed centre, not another point elsewhere in it.
      const i = CONFIG.terrain && capCenter ? this.nearestWalkableNode(capCenter) : (rng() * n) | 0;
      if (!this.walk[i] || region[i] !== main) continue;
      if (this.floorWalk && !this.floorWalk[i]) continue;
      if (!capCenter && Math.abs(this.dirs[i * 3 + 1]) > 0.82) continue;
      if (this.height[i] < 0.14 || this.height[i] > (CONFIG.terrain ? WORLD.FLIGHT_CEILING * 0.5 : 1.6)) continue;
      // The heart anchors the main battlefield: keep it in the sun, and on
      // capped maps pull it toward the field's center.
      const sunDot = this.dirs[i * 3] * SUN_DIR.x + this.dirs[i * 3 + 1] * SUN_DIR.y + this.dirs[i * 3 + 2] * SUN_DIR.z;
      if (!capCenter && sunDot < 0.12 - relax * 0.3) continue;
      let open = this._openness(i) + sunDot * 6;
      // The first ring is where the opening towers go. With ranges and
      // canyons in the world a doorstep can be open while the ring around
      // it is mostly cliff, which crams the first moves against a wall; so
      // the six-hop neighbourhood (about the first ring's radius) must be
      // mostly walkable too, and a more open one scores higher.
      const wide = this._openness(i, 6);
      if (wide < FOOTHOLD_MIN - relax * 30) continue;
      open += (wide - FOOTHOLD_MIN) * 0.2;
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
      if (CONFIG.terrain && (this.height[i] < 0.14 || !this.airWalk[i])) continue;
      // Spread breaches around the heart, but keep the march to a few minutes:
      // on a colossal world a fraction-of-the-world gate would put portals an
      // ocean away and waves would spend the game walking.
      if (this.dist[i] < Math.min(maxD * (0.42 - relax * 0.12), 140)) continue;
      if (this.dist[i] > 300) continue;
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
    if (this.airDist && portals.some(i => !Number.isFinite(this.airDist[i]))) return false;
    if (CONFIG.map.mode === 'ninetynine' && this.march) {
      // A valid original portal route can hide a tiny meadow island. Accept
      // this battlefield only if a full unexpanded nest schedule fits on dry
      // connected clearings, without distant emergency mountain approaches.
      const centre = this.nodeDir(heart, new THREE.Vector3()), scratch = new THREE.Vector3(), used = new Set();
      for (let i = 0; i < NEST_SCHEDULE_CAPACITY; i++) {
        const node = nestSite(this, portals[i % portals.length], centre, .05, used, scratch);
        if (node < 0) return false;
        used.add(node);
      }
      this.nestCapacity = [...used];
      this.terrainCertificate = surveyBattlefield(this,WORLD.FORMATIONS,terrainHeight,R,capCenter,capTheta);
      if (!this.terrainCertificate.pass) return false;
    }
    return true;
  }

  _dijkstra(source, blockFilter, field = this, stop = -1, guided = false) {
    for(const _ of this._dijkstraSteps(source,blockFilter,field,stop,guided)){/* Synchronous path for ordinary placements. */}
  }

  *_dijkstraSteps(source, blockFilter, field = this, stop = -1, guided = false) {
    const n = this.n;
    const { dist, next, walk, block, cost } = field;
    // Only commander point-to-point searches use this goal heuristic.
    // Authoritative heart and air fields retain the complete calculation.
    const scale=guided&&stop>=0&&Number.isFinite(this._routeHeuristicScale)?this._routeHeuristicScale:0;
    const sx=scale?this.dirs[stop*3]:0,sy=scale?this.dirs[stop*3+1]:0,sz=scale?this.dirs[stop*3+2]:0;
    dist.fill(Infinity);
    next.fill(-1);
    // The heap and visited set are reused: on a colossal world these are
    // multi-megabyte buffers and every build re-solves the field.
    if (!this._heap || this._heapFor !== n) {
      this._heap = new MinHeap(n * 6 + 8);
      this._done = new Uint8Array(n);
      this._heapFor = n;
    }
    const heap = this._heap;
    heap.n = 0;
    const done = this._done;
    done.fill(0);
    dist[source] = 0;
    heap.push(source, 0);
    let visits=0;
    while (heap.n > 0) {
      if(++visits%512===0)yield;
      const a = heap.pop();
      if (done[a]) continue;
      done[a] = 1;
      if (a === stop) break;
      const da = dist[a];
      for (let e = this.adjOff[a]; e < this.adjOff[a + 1]; e++) {
        const b = this.adj[e];
        if (done[b] || !walk[b]) continue;
        if (block && block[b] !== 0 && b !== source) continue;
        if (blockFilter && blockFilter.has(b)) continue;
        const nd = da + cost[e];
        if (nd < dist[b]) {
          dist[b] = nd;
          next[b] = a;
          const h=scale?Math.hypot(this.dirs[b*3]-sx,this.dirs[b*3+1]-sy,this.dirs[b*3+2]-sz)*scale:0;
          heap.push(b, nd+h);
        }
      }
    }
  }

  recomputeFlow() {
    for(const _ of this.recomputeFlowSteps()){/* Drain during ordinary placement. */}
  }

  *recomputeFlowSteps() {
    yield* this._dijkstraSteps(this.heartNode, null);
    if(this.floorWalk)yield* this._marchFlowSteps();
    if (this.airWalk && !this._airReady) {
      yield* this._dijkstraSteps(this.heartNode, null, { dist: this.airDist, next: this.airNext, walk: this.airWalk, cost: this.airCost });
      this._airReady = true;
    }
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if(i%4096===0)yield;
      const j = (this.march?.next||this.next)[i];
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

  refreshTerrain(fault){
    const steps=this.refreshTerrainSteps(fault);let result;do{result=steps.next();}while(!result.done);return result.value;
  }

  *refreshTerrainSteps(fault){
    const dirty=new Uint8Array(this.n);let changed=0;
    for(let i=0;i<this.n;i++){
      if(i%64===0)yield;
      this.nodeDir(i,_v);if(_v.dot(fault.dir)<Math.cos(48/R))continue;
      const h=terrainHeight(_v.x,_v.y,_v.z),base=terrainHeight(_v.x,_v.y,_v.z,false);
      this.height[i]=h;this.baseHeight[i]=base;this.waterDepth[i]=WORLD.waterDepthAt(_v,base);
      this.walk[i]=isWalkableDir(_v)?1:0;
      this.floorWalk[i]=this.walk[i]&&isFloorTerrain(base,WORLD.slopeAt(_v),this.waterDepth[i])?1:0;
      this.airWalk[i]=WORLD.canFlyAt(_v,WORLD.FLIGHT_CLEARANCE+3)?1:0;
      const radius=R+WORLD.surfaceElevation(_v,h);this.pos[i*3]=_v.x*radius;this.pos[i*3+1]=_v.y*radius;this.pos[i*3+2]=_v.z*radius;
      dirty[i]=1;for(let e=this.adjOff[i];e<this.adjOff[i+1];e++)dirty[this.adj[e]]=1;changed++;
    }
    for(let i=0;i<this.n;i++){if(i%64===0)yield;if(dirty[i])for(let e=this.adjOff[i];e<this.adjOff[i+1];e++){
      const j=this.adj[e];this.nodeDir(i,_v);this.nodeDir(j,_v2);const angle=Math.acos(Math.max(-1,Math.min(1,_v.dot(_v2))));
      const horizontal=angle*(R+(WORLD.surfaceElevation(_v,this.baseHeight[i])+WORLD.surfaceElevation(_v2,this.baseHeight[j]))*.5);
      this.cost[e]=travelCost(this.baseHeight[j],this.baseHeight[i],horizontal,this.waterDepth[j],this.waterDepth[i]);
      _v.add(_v2).normalize();this.airCost[e]=this.airWalk[i]&&this.airWalk[j]&&WORLD.canFlyAt(_v,WORLD.FLIGHT_CLEARANCE+3)?angle*R:Infinity;
    }}
    // Node identity, adjacency and tower footprint ownership are retained.
    this.march=null;this._airReady=false;this._routeHeuristicScale=0;yield* this.recomputeFlowSteps();this.revision++;return changed;
  }

  sampleAirFlow(node, dir, out) {
    if (!this.airNext) return this.sampleFlow(node, dir, out);
    let best = node, bestD = Infinity;
    // Prefer a reachable neighbor when steering has brushed a blocked peak.
    for (let e = this.adjOff[node] - 1; e < this.adjOff[node + 1]; e++) {
      const i = e < this.adjOff[node] ? node : this.adj[e];
      if (this.airNext[i] < 0) continue;
      const d = this._dirDist2(i, dir);
      if (d < bestD) { bestD = d; best = i; }
    }
    const next = this.airNext[best];
    if (next < 0) { out.set(0, 0, 0); return Infinity; }
    this.nodeDir(next, out);
    out.addScaledVector(dir, -out.dot(dir)).normalize();
    return this.airDist[best];
  }

  _sameRouteRegion(start,end) {
    // Tower rings can isolate a unit. Re-solving an impossible chase across
    // the entire graph on every new target made movement frames hitch. A
    // cached weak-connectivity check safely rejects separate walkable regions.
    // Ignore edge weights here: this may allow a later weighted search to
    // fail, but can never reject a valid directed route. Revision invalidates
    // labels after construction, selling or a new terrain graph.
    if(!this._routeRegions||this._routeRegions.labels.length!==this.n)this._routeRegions={labels:new Int32Array(this.n),queue:new Int32Array(this.n),revision:-1,count:0};
    const r=this._routeRegions;
    if(r.revision!==this.revision){r.labels.fill(0);r.count=0;r.revision=this.revision;}
    if(!r.labels[start]){
      const id=++r.count;let head=0,tail=1;r.queue[0]=start;r.labels[start]=id;
      while(head<tail){const a=r.queue[head++];for(let edge=this.adjOff[a];edge<this.adjOff[a+1];edge++){const b=this.adj[edge];if(r.labels[b]||!this.walk[b]||this.block[b])continue;r.labels[b]=id;r.queue[tail++]=b;}}
    }
    return r.labels[start]===r.labels[end];
  }

  _marchFlow() {
    for(const _ of this._marchFlowSteps()){/* Drain during ordinary placement. */}
  }

  *_marchFlowSteps() {
    const n=this.n;
    if(!this.march||this.march.dist.length!==n){
      const cost=new Float32Array(this.cost.length);
      for(let i=0;i<n;i++){if(i%2048===0)yield;for(let e=this.adjOff[i];e<this.adjOff[i+1];e++)cost[e]=this.cost[e]/(this.floorWalk[i]&&this.floorWalk[this.adj[e]]?1:MOUNTAIN_MARCH);}
      this.march={dist:new Float64Array(n),next:new Int32Array(n),floorReach:new Uint8Array(n),cost,
        lowerDist:new Float64Array(n),lowerNext:new Int32Array(n)};
    }
    const m=this.march;
    // Certify floor-only routes first. These nodes never take a mountain
    // shortcut, however long their valley route is. The second flood joins
    // disconnected floor regions through the least costly slow passage.
    yield* this._dijkstraSteps(this.heartNode,null,{...m,walk:this.floorWalk,cost:this.cost,block:this.block});
    const heap=this._heap,done=this._done;heap.n=0;done.fill(0);
    for(let i=0;i<n;i++){if(i%4096===0)yield;m.floorReach[i]=Number.isFinite(m.dist[i])?1:0;}
    for(let i=0;i<n;i++){if(i%2048===0)yield;if(m.floorReach[i]){
      for(let e=this.adjOff[i];e<this.adjOff[i+1];e++)if(this.walk[this.adj[e]]&&!m.floorReach[this.adj[e]]){heap.push(i,m.dist[i]);break;}
    }}
    let visits=0;
    while(heap.n){
      if(++visits%512===0)yield;
      const a=heap.pop();if(done[a])continue;done[a]=1;
      for(let e=this.adjOff[a];e<this.adjOff[a+1];e++){
        const b=this.adj[e];if(done[b]||m.floorReach[b]||!this.walk[b]||this.block[b])continue;
        const d=m.dist[a]+m.cost[e];if(d<m.dist[b]){m.dist[b]=d;m.next[b]=a;heap.push(b,d);}
      }
    }
    // An unconstrained, mountain-weighted distance is a safe lower bound for
    // emergency preview detours. The floor-first field itself can overestimate
    // such a detour, so it cannot serve as that search's A* heuristic.
    yield* this._dijkstraSteps(this.heartNode,null,{dist:m.lowerDist,next:m.lowerNext,walk:this.walk,cost:m.cost,block:this.block});
  }

  canMarchStep(fromDir,toDir,node=-1) {
    if(!this.canStep(fromDir,toDir,false,node))return false;
    if(!this.march)return true;
    const from=node>=0?this.descendNode(node,fromDir):this.nearestNode(fromDir),to=this.descendNode(from,toDir);
    // Chase and separation must respect the same valley as the route line.
    return !this.march.floorReach[from]||!!this.march.floorReach[to];
  }

  findPath(fromDir, toDir) {
    if(this.terrainBusy)return [];
    const start = this.nearestWalkableNode(fromDir, true), end = this.nearestWalkableNode(toDir, true);
    if (start < 0 || end < 0 || this.block[end]) return [];
    if(start===end){const path=[start];path.cost=0;return path;}
    if(CONFIG.terrain&&!this._sameRouteRegion(start,end))return [];
    if (!this._route || this._route.dist.length !== this.n) this._route = { dist: new Float32Array(this.n), next: new Int32Array(this.n) };
    this._dijkstra(end, null, { ...this._route, walk: this.walk, cost: this.cost, block: this.block }, start, true);
    if (!Number.isFinite(this._route.dist[start])) return [];
    const path = [];
    for (let i = start, guard = 0; i >= 0 && guard++ < this.n; i = this._route.next[i]) {
      path.push(i);
      if (i === end) break;
    }
    path.cost = this._route.dist[start];
    return path;
  }

  canStep(fromDir, toDir, flying = false, node = -1) {
    if (!CONFIG.terrain) return true;
    const from = node >= 0 ? this.descendNode(node, fromDir) : this.nearestNode(fromDir);
    const to = from >= 0 ? this.descendNode(from, toDir) : -1;
    const walk = flying ? this.airWalk : this.walk;
    if (from < 0 || to < 0 || !walk[to] || (!flying && this.block[to] && this.block[to] !== this.block[from])) return false;
    if (from === to) return true;
    const cost = flying ? this.airCost : this.cost;
    // Incoming costs are stored in the destination's adjacency row.
    for (let e = this.adjOff[to]; e < this.adjOff[to + 1]; e++) {
      if (this.adj[e] === from) return Number.isFinite(cost[e]);
    }
    return false;
  }

  // Blend the flow of the tracked node and its neighbors, project to the
  // tangent plane at dir. Returns progress (distance to heart) as well.
  sampleFlow(nodeIdx, dir, out) {
    let wSum = 0, fx = 0, fy = 0, fz = 0, dSum = 0;
    const consider = (i) => {
      if(this.march?.floorReach[nodeIdx]&&!this.march.floorReach[i])return;
      const w = 1 / (this._dirDist2(i, dir) + 1e-5);
      const hasFlow = (this.march?.next||this.next)[i] >= 0;
      if (hasFlow) {
        fx += this.flow[i * 3] * w;
        fy += this.flow[i * 3 + 1] * w;
        fz += this.flow[i * 3 + 2] * w;
        dSum += (this.march?.dist||this.dist)[i] * w;
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
  validatePlacement(center, radius, requiredNodes = []) {
    const nodes = this.nodesInRadius(center, radius);
    const temp = new Set();
    for (const i of nodes) {
      if (this.walk[i] && this.block[i] === 0) temp.add(i);
    }
    if (temp.has(this.heartNode)) return { ok: false, reason: 'heart' };
    for (const p of this.portalNodes) if (temp.has(p)) return { ok: false, reason: 'portal' };
    if (temp.size === 0) return { ok: true };

    // Most cursor positions miss every live route. A known route that never
    // enters the candidate footprint is already proof of a remaining exit.
    // Share checked suffixes, then search only for the routes that need a
    // detour. Include living enemies and new nests, not just original gates.
    const required = new Set([...this.portalNodes, ...requiredNodes]);
    const verified = new Set([this.heartNode]);
    for (const node of required) {
      let i = node; const trail = [];
      while (!verified.has(i) && i >= 0 && i < this.n && trail.length < this.n) {
        if (temp.has(i) || this.block[i] || !this.walk[i]) break;
        trail.push(i); i = this.next[i];
      }
      if (!verified.has(i)) {
        const detour = this._previewRoute(node, temp);
        if (!detour.length) return { ok: false, reason: 'path' };
        for (const step of detour) verified.add(step);
        continue;
      }
      for (const step of trail) verified.add(step);
    }
    return { ok: true };
  }

  _previewRoute(from, temp, field = null) {
    const next=field?.next||this.next,walk=field?.walk||this.walk,costs=field?.cost||this.cost,lowerDist=field?.dist||this.dist;
    const rejected=field?.rejected;if(rejected)rejected.length=0;
    if (from < 0 || from >= this.n || !Number.isFinite(this.dist[from]) || this.block[from] || temp.has(from) || temp.has(this.heartNode)) return [];
    if(!walk[from])return [];
    const direct = [];
    for (let i = field?.direct===false?-1:from; i >= 0 && direct.length < this.n; i = next[i]) {
      if (temp.has(i)||!walk[i]) break;
      direct.push(i); if (i === this.heartNode) return direct;
      if(field?.floorReach?.[i]&&!field.floorReach[next[i]])break;
    }
    // Removing nodes cannot shorten the existing distance to the heart.
    // That field is a much tighter admissible heuristic than straight-line
    // distance through mountainous terrain. Search forward with OUTGOING
    // costs; adjacency rows store incoming costs, so use each reverse edge.
    if (!this._preview || this._preview.dist.length !== this.n) this._preview = {
      dist: new Float64Array(this.n), parent: new Int32Array(this.n), seen: new Uint32Array(this.n), closed: new Uint32Array(this.n), generation: 0,
    };
    const f = this._preview, generation = f.generation = (f.generation + 1) >>> 0;
    if (!generation) { f.seen.fill(0xffffffff); f.closed.fill(0xffffffff); }
    const heap = this._heap; heap.n = 0;
    // Leave a small margin for the authoritative field's Float32 rounding.
    const lower = i => lowerDist[i] * 0.99999;
    f.dist[from] = 0; f.parent[from] = -1; f.seen[from] = generation; heap.push(from, lower(from));
    while (heap.n) {
      const a = heap.pop(); if (f.closed[a] === generation) continue;
      f.closed[a] = generation;
      if(rejected)rejected.push(a);
      if (a === this.heartNode) {
        if(rejected)rejected.length=0;
        const path = []; for (let i = a; i >= 0; i = f.parent[i]) path.push(i);
        return path.reverse();
      }
      for (let e = this.adjOff[a]; e < this.adjOff[a+1]; e++) {
        const b = this.adj[e];
        if (!walk[b] || this.block[b] || temp.has(b) || f.closed[b] === generation || !Number.isFinite(this.dist[b])) continue;
        if(field?.floorReach?.[a]&&!field.floorReach[b])continue;
        let cost = Infinity;
        for (let r = this.adjOff[b]; r < this.adjOff[b+1]; r++) if (this.adj[r] === a) { cost = costs[r]; break; }
        const distance = f.dist[a] + cost;
        if (Number.isFinite(distance) && (f.seen[b] !== generation || distance < f.dist[b])) {
          f.seen[b] = generation; f.dist[b] = distance; f.parent[b] = a;
          heap.push(b, distance + lower(b));
        }
      }
    }
    return [];
  }

  blockNodes(center, radius, towerId) {
    this.revision++;
    const nodes = this.nodesInRadius(center, radius);
    for (const i of nodes) {
      if (this.block[i] === 0) this.block[i] = towerId;
    }
    this.recomputeFlow();
  }

  unblockNodes(towerId) {
    this.revision++;
    for (let i = 0; i < this.n; i++) {
      if (this.block[i] === towerId) this.block[i] = 0;
    }
    this.recomputeFlow();
  }

  _traceChain(fromNode, out) {
    let i = fromNode, guard = 0;
    while (i >= 0 && guard++ < this.n) {
      out.push(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      if (i === this.heartNode) break;
      i = (this.march?.next||this.next)[i];
    }
    return out;
  }

  // All portal-to-heart polylines, optionally as if a footprint were blocked.
  // Keep preview searches out of the authoritative ground/air fields.
  // Full-world solve plus restore on every hover caused visible stalls.
  previewPaths(tempCenter = null, radius = 0) {
    let temp = null;
    if (tempCenter) {
      temp = new Set();
      for (const i of this.nodesInRadius(tempCenter, radius)) {
        if (this.walk[i] && this.block[i] === 0) temp.add(i);
      }
    }
    if (!temp?.size) return this.portalNodes.map(p => this._traceChain(p, []));
    const key = `${this.revision}:${this.heartNode}:${this.portalNodes.join(',')}:${[...temp].sort((a,b)=>a-b).join(',')}`;
    if (this._previewKey === key) return this._previewPaths;
    let floorReach=null;
    if(this.march){
      // Only routes entering the removed footprint can lose floor access.
      // Certify its incoming rim, sharing successful route suffixes. A failed
      // search supplies its whole disconnected region; everything else keeps
      // its certification. Avoid a whole-world flood on every mouse move.
      floorReach=this.march.floorReach;const rim=new Set(),verified=new Set([this.heartNode]),rejected=[];
      for(const a of temp)if(floorReach[a])for(let e=this.adjOff[a];e<this.adjOff[a+1];e++){const b=this.adj[e];if(floorReach[b]&&!temp.has(b)&&!this.block[b]&&Number.isFinite(this.cost[e]))rim.add(b);}
      for(const from of rim){
        if(!floorReach[from]||verified.has(from))continue;
        const trail=[];let i=from;
        while(i>=0&&trail.length<this.n&&!verified.has(i)&&floorReach[i]&&!temp.has(i)){trail.push(i);i=this.march.next[i];}
        if(verified.has(i)){for(const node of trail)verified.add(node);continue;}
        const route=this._previewRoute(from,temp,{next:this.march.next,walk:floorReach,cost:this.cost,dist:this.march.dist,rejected});
        if(route.length){for(const node of route)verified.add(node);}
        else if(rejected.length){if(floorReach===this.march.floorReach)floorReach=floorReach.slice();for(const node of rejected)floorReach[node]=0;}
      }
    }
    const paths = this.portalNodes.map(p => {
      const flat = [];
      let route=this.march?(floorReach[p]?this._previewRoute(p,temp,{next:this.march.next,walk:floorReach,cost:this.cost,dist:this.march.dist}):[]):this._previewRoute(p,temp);
      if(this.march&&!route.length)route=this._previewRoute(p,temp,{next:this.march.next,walk:this.walk,cost:this.march.cost,dist:this.march.lowerDist,floorReach,direct:floorReach===this.march.floorReach});
      for (const i of route) flat.push(this.pos[i*3], this.pos[i*3+1], this.pos[i*3+2]);
      return flat;
    });
    this._previewKey = key; this._previewPaths = paths;
    return paths;
  }

  nodePos(i, out) {
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }
  nodeDir(i, out) {
    return out.set(this.dirs[i * 3], this.dirs[i * 3 + 1], this.dirs[i * 3 + 2]).normalize();
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
