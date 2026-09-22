// mesh-restore.js — load captured terrain geometry instead of rebuilding it.
//
// buildTerrainMeshSteps() spends ~2,292 ms evaluating faceColor + terrainThermal for
// 327,680 triangles. The finished geometry is a pure function of (map, seed), so it is
// captured and restored instead. Payload validated byte-for-byte against a freshly
// built mesh before this was written (tools: capture_mesh.py + the attribute check).
//
// The material is deliberately the SAME constructor the normal path uses. Painted /
// toon materials are applied afterwards by an art pass (js/hard-cel-materials.js
// traverses the scene and swaps materials), so constructing anything different here
// would be a needless visual risk.
//
// Refuses on ANY doubt and returns null - the caller then builds as before.

import * as THREE from '../lib/three.module.min.js';
import {loadPayloadChecked, PAYLOAD_FORMAT} from './payload-store.js';

const REQUIRED = ['position', 'color', 'normal'];

// WHY A MARKER. nav records `nav.__navMiss` with the wanted key and the store's actual
// keys, and that instrumentation is what made the silent wrong-world restore
// diagnosable. The mesh had no equivalent: it fell back to building without a word, so a
// mesh-only miss (or a mesh served from the WRONG planet) was invisible. These two
// fields are the equivalent - `meshMiss` says why the captured geometry was not used,
// `meshSource` says that it WAS used and where from (the fast path must prove it ran,
// because output equality alone is also satisfied by the build fallback).
function markMeshMiss(cfg, reason) {
  try { cfg.meshMiss = reason; } catch {}
  try { globalThis.__meshMiss = reason; } catch {}
  return null;
}
function markMeshSource(cfg, from) {
  try { cfg.meshSource = from; } catch {}
  try { globalThis.__meshSource = from; } catch {}
} async function storeState() {
  try {
    const m = await import('./payload-store.js');
    return 'keys=' + (await m.listPayloads()).join(',') + '|fmt=' + m.PAYLOAD_FORMAT;
  } catch (e) { return 'listThrew:' + String(e && e.message).slice(0, 60); }
}

export async function restoreTerrainGeometry(cfg = {}) {
  try {
    const {mapKey, base = './bake'} = cfg;
    try { cfg.meshMiss = null; cfg.meshSource = null; globalThis.__meshMiss = null; } catch {}
    // KEY ON THE WORLD SEED (js/config.js `worldSeed`), never requestedSeed: in campaign
    // mode requestedSeed is frozen at the player's ?seed/whSeed for all 99 planets, so
    // every planet collided on one key and planet 2+ restored planet 1's terrain. The
    // settled CONFIG.seed is not the key either - the nav build's seed search advances it.
    const seed = (cfg.worldSeed !== undefined && cfg.worldSeed !== null) ? cfg.worldSeed
      : (cfg.requestedSeed !== undefined && cfg.requestedSeed !== null) ? cfg.requestedSeed
      : cfg.seed;
    if (!mapKey || seed === undefined) return null;
    const dir = `${base}/mesh_${mapKey}_${seed}`;

    // STORE FIRST: a payload written by an earlier build of this planet needs no
    // network at all. This is what makes revisiting a planet instant.
    const read = await loadPayloadChecked('mesh', mapKey, seed);
    const stored = read.payload;
    if (!stored) markMeshMiss(cfg, 'store:' + read.reason + ' wanted=mesh:' + mapKey + ':' + seed + ':' + PAYLOAD_FORMAT + ' | ' + await storeState());
    if (stored && stored.record && Array.isArray(stored.record.attributes)) {
      const mr = stored.record;
      // GUARD (defence in depth): payload-store refuses an entry that cannot prove its
      // world; this is the layer that hands geometry to the renderer, so it checks too.
      const stamp = mr.worldSeed;
      if (stamp === undefined || stamp === null || Number(stamp) !== Number(seed)) {
        markMeshMiss(cfg, 'store:world-mismatch entry=worldSeed ' + stamp + ' boot=' + seed
          + ' wanted=mesh:' + mapKey + ':' + seed + ':' + PAYLOAD_FORMAT + ' | REFUSED');
      } else {
      const byName = new Map(mr.attributes.map(a => [a.name, a]));
      let ok = REQUIRED.every(n => byName.has(n));
      if (ok) {
        for (const a of mr.attributes) {
          const buf = stored.buffers[a.name];
          const Ctor = globalThis[a.kind];
          if (typeof Ctor !== 'function' || !buf || buf.byteLength !== a.bytes) { ok = false; break; }
        }
      }
      if (!ok) markMeshMiss(cfg, 'store:invalid-record wanted=mesh:' + mapKey + ':' + seed + ':' + PAYLOAD_FORMAT);
      if (ok) {
        const geo = new THREE.BufferGeometry();
        for (const a of mr.attributes) {
          const arr = new globalThis[a.kind](stored.buffers[a.name]);
          const size = a.name === 'aLava' ? 2 : 3;
          if (a.name === 'position') geo.setAttribute('position', new THREE.BufferAttribute(arr, size));
          else if (a.name === 'color') geo.setAttribute('color', new THREE.BufferAttribute(arr, size));
          else if (a.name === 'normal') geo.setAttribute('normal', new THREE.BufferAttribute(arr, size));
          else if (a.name === 'aLava') geo.setAttribute('aLava', new THREE.BufferAttribute(arr, size));
        }
        if (mr.index && stored.buffers.index) {
          const a = mr.index;
          const Ctor = globalThis[a.kind];
          if (typeof Ctor === 'function' && stored.buffers.index.byteLength === a.bytes) {
            geo.setIndex(new THREE.BufferAttribute(new Ctor(stored.buffers.index), 1));
          }
        }
        geo.computeBoundingSphere();
        markMeshSource(cfg, 'store');
        return geo;
      }
      }
    }

    const manRes = await fetch(`${dir}/manifest.json`, {cache: 'no-store'});
    if (!manRes.ok) return null;
    const man = await manRes.json();
    if (!man || man.mapKey !== mapKey || Number(man.seed) !== Number(seed)) {
      return markMeshMiss(cfg, 'disk:manifest-mismatch ' + dir + ' man=' + (man && (man.mapKey + '/' + man.seed)));
    }
    if (!Array.isArray(man.attributes) || !man.attributes.length) return markMeshMiss(cfg, 'disk:no-attributes ' + dir);

    const byName = new Map(man.attributes.map(a => [a.name, a]));
    for (const name of REQUIRED) if (!byName.has(name)) return null;

    const bufs = await Promise.all(man.attributes.map(async a => {
      const r = await fetch(`${dir}/${a.name}.bin`);   // cached: immutable per (map,seed)
      return r.ok ? r.arrayBuffer() : null;
    }));
    if (bufs.some(b => !b)) return null;

    // validate kinds and sizes before touching anything
    for (let i = 0; i < man.attributes.length; i++) {
      const a = man.attributes[i];
      const Ctor = globalThis[a.kind];
      if (typeof Ctor !== 'function') return null;
      if (bufs[i].byteLength !== a.bytes) return null;
      if (bufs[i].byteLength !== a.count * a.itemSize * Ctor.BYTES_PER_ELEMENT) return null;
    }

    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < man.attributes.length; i++) {
      const a = man.attributes[i];
      const arr = new globalThis[a.kind](bufs[i]);
      if (a.name === 'position') {
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      } else if (a.name === 'color') {
        geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      } else if (a.name === 'normal') {
        geo.setAttribute('normal', new THREE.BufferAttribute(arr, 3));
      } else if (a.name === 'aLava') {
        geo.setAttribute('aLava', new THREE.BufferAttribute(arr, 2));
      }
    }
    if (man.index) {
      const r = await fetch(`${dir}/index.bin`);
      if (!r.ok) return null;
      const a = man.index;
      const Ctor = globalThis[a.kind];
      const buf = await r.arrayBuffer();
      if (typeof Ctor !== 'function' || buf.byteLength !== a.bytes) return null;
      geo.setIndex(new THREE.BufferAttribute(new globalThis[a.kind](buf), 1));
    }
    geo.computeBoundingSphere();
    markMeshSource(cfg, 'disk');
    return geo;
  } catch (e) {
    return markMeshMiss(cfg, 'threw:' + String((e && e.message) || e).slice(0, 120));
  }
}
