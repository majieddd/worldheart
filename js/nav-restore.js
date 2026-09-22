// Restore a previously captured nav graph instead of rebuilding it.
//
// Mirrors the game's OWN graph-swap path (nav.js drafts): copy the arrays, then
// explicitly null the transient state it also nulls (_heap, march, _nestSites,
// _routeRegions) because those are rebuilt on demand.
//
// Returns the restored array names on success, or null on ANY doubt - the caller
// then simply builds as before. A bad payload must only ever cost speed.

import * as THREE from '../lib/three.module.min.js';
import {loadPayloadChecked, PAYLOAD_FORMAT} from './payload-store.js';
//
// Why completeness is judged on ARRAYS rather than manifest.complete: the capture
// cannot serialise a handful of runtime fields (cells, nestSites, march,
// fieldCenter, portalNodes, scratch). Those are not independent state - nav.js's
// own draft path nulls several of them and rebuilds on demand - so they are
// rebuilt here too. What must be exact is the 23 typed arrays: those are the
// expensive output, and they are validated name-by-name, kind-by-kind and
// byte-for-byte before anything is applied.

const STATE_KEYS = ['_heap', 'march', '_nestSites', '_routeRegions'];

const REQUIRED_ARRAYS = [
  '_done', '_mark', 'adj', 'adjOff', 'airCost', 'airDist', 'airNext', 'airWalk',
  'baseHeight', 'block', 'cost', 'deckIndex', 'dirs', 'dist', 'floorWalk', 'flow',
  'height', 'layer', 'next', 'pos', 'region', 'walk', 'waterDepth',
];

// Rebuild the spatial hash on direction cells. nav.js builds it from this.dirs and
// this._cellKey alone, both of which are restored, so this reproduces it exactly
// without the ~13,500 ms graph build. Leaving it undefined crashes the boot
// ("Cannot read properties of undefined (reading 'get')"); an EMPTY Map would be
// worse - it would answer nearest-node queries wrongly instead of failing loudly.
function rebuildCells(nav) {
  if (!nav.dirs || typeof nav.n !== 'number' || typeof nav._cellKey !== 'function') return false;
  const cells = new Map();
  for (let i = 0; i < nav.n; i++) {
    const key = nav._cellKey(nav.dirs[i * 3], nav.dirs[i * 3 + 1], nav.dirs[i * 3 + 2]);
    let arr = cells.get(key);
    if (!arr) cells.set(key, arr = []);
    arr.push(i);
  }
  nav.cells = cells;
  return true;
}

// Apply a validated record to the nav graph. Shared by the IndexedDB store and the
// on-disk capture so both paths are provably the same code.
function applyNavRecord(nav, man, bufs) {
  const names = [];
  for (let i = 0; i < man.arrays.length; i++) {
    const a = man.arrays[i];
    const Ctor = globalThis[a.kind];
    if (typeof Ctor !== 'function') return null;
    if (!bufs[i] || bufs[i].byteLength !== a.bytes) return null;
    nav[a.name] = new Ctor(bufs[i]);
    names.push(a.name);
  }
  if (man.scalars && typeof man.scalars === 'object') {
    for (const k of Object.keys(man.scalars)) {
      const v = man.scalars[k];
      if (v !== undefined) nav[k] = v;
    }
  }
  // payload-store.js writes `numberArrays`; tools/capture_nav.py writes `numArrays`.
  // Reading only the latter silently dropped EVERY numeric array on the IndexedDB
  // path - portalNodes, nestCapacity, coverageTrials - so a store-restored graph
  // came back with no portalNodes and boot() died at
  // `for (const pn of nav.portalNodes)` ("nav.portalNodes is not iterable").
  // Read whichever the producer wrote. Note PAYLOAD_FORMAT was NOT bumped when the
  // producer's field name was fixed, so pre-fix entries are still live in users'
  // IndexedDB and this branch is what keeps them usable.
  const numArrays = man.numberArrays || man.numArrays || {};
  for (const k of Object.keys(numArrays)) {
    const arr = numArrays[k];
    if (Array.isArray(arr)) nav[k] = arr.slice();
  }
  for (const k of Object.keys(man.vector3 || {})) {
    const v = man.vector3[k];
    if (v && typeof v.x === 'number') nav[k] = new THREE.Vector3(v.x, v.y, v.z);
  }
  for (const k of STATE_KEYS) nav[k] = null;
  if (!rebuildCells(nav)) return null;
  return names;
}

export async function restoreNavGraph(nav, cfg = {}) {
  try {
    const {mapKey, base = './bake'} = cfg;
    // KEY ON THE WORLD SEED (js/config.js `worldSeed`) - the value that actually
    // determines which planet this is. It is NOT requestedSeed: in campaign mode every
    // planet shares the player's ?seed/whSeed (the campaign's reload path deletes ?seed
    // and never writes whSeed), so all 99 planets collided on one key and planet 2+
    // silently restored planet 1's graph. Nor is it the settled CONFIG.seed, which the
    // build's own seed search advances (nav.js). The requestedSeed/seed fallbacks are
    // only for a caller that does not pass worldSeed.
    const seed = (cfg.worldSeed !== undefined && cfg.worldSeed !== null) ? cfg.worldSeed
      : (cfg.requestedSeed !== undefined && cfg.requestedSeed !== null) ? cfg.requestedSeed
      : cfg.seed;
    if (!nav || !mapKey || seed === undefined) return null;
    const dir = `${base}/nav_${mapKey}_${seed}`;

    // 1. STORE FIRST: a payload written by an earlier build of this planet needs no
    // network at all. This is what makes revisiting a planet instant.
    const read = await loadPayloadChecked('nav', mapKey, seed);
    const stored = read.payload;
    if (!stored) {
      let dbState = 'n/a';
      try { const m = await import('./payload-store.js'); const keys = await m.listPayloads(); dbState = 'keys=' + keys.join(',') + '|fmt=' + m.PAYLOAD_FORMAT; } catch (e) { dbState = 'listThrew:' + String(e && e.message).slice(0, 60); }
      nav.__navMiss = 'store:' + read.reason + ' wanted=nav:' + mapKey + ':' + seed + ':' + PAYLOAD_FORMAT + ' | ' + dbState;
    }
    if (stored) {
      // GUARD (defence in depth). payload-store already refuses an entry that cannot
      // prove its world, but this is the layer that writes into the graph, so it checks
      // again: a store entry whose own worldSeed is not the world this boot is building
      // must never be applied, whatever key it was found under.
      const stamp = stored.record && stored.record.worldSeed;
      if (stamp === undefined || stamp === null || Number(stamp) !== Number(seed)) {
        nav.__navMiss = 'store:world-mismatch entry=worldSeed ' + stamp + ' boot=' + seed
          + ' wanted=nav:' + mapKey + ':' + seed + ':' + PAYLOAD_FORMAT + ' | REFUSED';
      } else {
      let names = null;
      try {
        names = applyNavRecord(nav, stored.record, stored.record.arrays.map(a => stored.buffers[a.name] || null));
      } catch (e) { nav.__navMiss = 'store:threw:' + String(e && e.message).slice(0, 120); }
      if (!names) nav.__navMiss = nav.__navMiss || 'store:apply-failed';
      if (names) {
        nav.parallelMetrics = {restored: true, from: 'store', arrays: names.length};
        return names;
      }
      }
    }

    const manRes = await fetch(`${dir}/manifest.json`, {cache: 'no-store'});
    if (!manRes.ok) return null;
    const man = await manRes.json();
    if (!man) return null;
    if (man.mapKey !== mapKey || Number(man.seed) !== Number(seed)) return null;
    if (!Array.isArray(man.arrays) || !man.arrays.length) return null;

    // every required array must be present before we fetch anything
    const byName = new Map(man.arrays.map(a => [a.name, a]));
    for (const name of REQUIRED_ARRAYS) if (!byName.has(name)) return null;

    const bufs = await Promise.all(man.arrays.map(async a => {
      // Cached deliberately: the payload is immutable for a given (map, seed), so a
      // repeat boot should reuse it rather than re-download 61 MB. The manifest fetch
      // above keeps no-store so a stale/missing payload is still detected.
      const r = await fetch(`${dir}/${a.name}.bin`);
      return r.ok ? r.arrayBuffer() : null;
    }));
    if (bufs.some(b => !b)) return null;

    // validate EVERYTHING before mutating anything
    for (let i = 0; i < man.arrays.length; i++) {
      const a = man.arrays[i];
      const Ctor = globalThis[a.kind];
      if (typeof Ctor !== 'function') return null;
      if (bufs[i].byteLength !== a.bytes) return null;
      if (bufs[i].byteLength !== a.length * Ctor.BYTES_PER_ELEMENT) return null;
    }

    const names = applyNavRecord(nav, man, bufs);
    if (!names) return null;
    nav.parallelMetrics = {restored: true, from: 'disk', arrays: names.length};
    return names;
  } catch (error) {
    try { nav.__navMiss = 'thrown:' + String(error && error.message).slice(0, 160); } catch {}
    return null;
  }
}

// main.js imports it under this name; keep both so either call site resolves.
export const tryRestoreNav = restoreNavGraph;
