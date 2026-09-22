// payload-store.js — persistent store for captured planet payloads.
//
// One store serves both goals:
//   1. CACHE ON FIRST BUILD - after any cold build, save the nav graph and terrain
//      mesh here, so revisiting that planet is a restore instead of a rebuild.
//   2. BACKGROUND PRE-GENERATION - a worker can save a payload for a planet the
//      player has not visited yet, and the next visit finds it already waiting.
//
// IndexedDB (not the network) because payloads are ~103 MB per planet (nav 61 MB +
// mesh 42 MB) and they are per-user state, not shippable content. Structured clone
// stores typed arrays directly - no base64, no serialisation cost.
//
// Everything is best-effort: any failure returns null/false and callers fall back to
// building. A missing or corrupt entry must only ever cost speed.

const DB_NAME = 'worldheart-payloads';
const DB_VERSION = 1;
const STORE = 'payloads';

// bump when the capture format changes, so stale entries are never restored
//
// 2 (KEYFIX): entries now carry a WORLD-SEED STAMP and the lookup refuses anything that
// cannot prove which world it holds. Format 1 was written by a producer that keyed on
// CONFIG.requestedSeed, which is frozen at the player's ?seed/whSeed in campaign mode -
// so a format-1 entry filed under seed X can contain ANY planet's nav graph and terrain.
// Restoring one is how the wrong world was served. Bumping the stamp invalidates every
// one of them at the door; the cost is one rebuild per planet the player had cached.
export const PAYLOAD_FORMAT = 2;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; resolve(null); };
      req.onblocked = () => { dbPromise = null; resolve(null); };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  }).then(db => {
    if (!db) dbPromise = null;   // allow a later retry instead of failing forever
    return db;
  });
  return dbPromise;
}

/** loadPayload with a short retry - the first store access in a boot can race the
 *  IndexedDB open, and a transient failure must not look like "no entry". */
export async function loadPayloadRetry(kind, mapKey, seed, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const v = await loadPayload(kind, mapKey, seed);
    if (v) return v;
    await new Promise(r => setTimeout(r, 60 * (i + 1)));
  }
  return null;
}

const keyFor = (kind, mapKey, seed, format = PAYLOAD_FORMAT) => `${kind}:${mapKey}:${seed}:${format}`;

async function withStore(mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = fn(store);
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persist a payload. `record` is the manifest object; `buffers` maps attribute/array
 * name to an ArrayBuffer. Returns true on success.
 *
 * `seed` is the WORLD SEED the caller looked up (see config.js `worldSeed`) and
 * `worldSeed` re-states it as the entry's own stamp, so the entry can prove on read
 * which world it holds even if the key ever drifts again. Defaults to `seed`.
 */
export async function savePayload(kind, mapKey, seed, record, buffers, worldSeed) {
  const db = await openDB();
  if (!db) return false;
  // IndexedDB clones on write, so detach nothing - just hand over the buffers.
  const stamp = (worldSeed === undefined || worldSeed === null) ? seed : worldSeed;
  const payload = {
    kind, mapKey, seed, worldSeed: stamp, format: PAYLOAD_FORMAT,
    record, buffers, savedAt: Date.now(),
  };
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(payload, keyFor(kind, mapKey, seed));
      // Drop the entry a PREVIOUS format left for this same world. Format-1 entries were
      // written under the wrong key by the campaign bug and can hold another planet, so
      // they are never read again (the format stamp is part of the key AND is validated);
      // re-saving the world is the moment to stop paying ~103 MB of disk for one.
      if (PAYLOAD_FORMAT > 1) store.delete(keyFor(kind, mapKey, seed, PAYLOAD_FORMAT - 1));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Read ONE raw entry and judge it. Returns {ok:true, record, buffers} or
 * {ok:false, reason}. The reason is what the nav/mesh miss markers report, so a refusal
 * says WHY instead of looking like an empty store.
 */
async function getPayload(kind, mapKey, seed) {
  const db = await openDB();
  if (!db) return {ok: false, reason: 'no-db'};
  const raw = await new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(keyFor(kind, mapKey, seed));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  const wanted = `${kind}:${mapKey}:${seed}:${PAYLOAD_FORMAT}`;
  if (!raw) return {ok: false, reason: 'no-entry'};
  if (raw.format !== PAYLOAD_FORMAT) return {ok: false, reason: `stale-format ${raw.format} != ${PAYLOAD_FORMAT} (${wanted})`};
  if (!raw.record || !raw.buffers) return {ok: false, reason: 'malformed'};
  // THE GUARD. A payload must be able to prove which world it holds, and it must be the
  // world this caller asked for. Missing stamp = written before the stamp existed, i.e.
  // by the producer that filed whatever world it booted under the requested seed - that
  // entry is unverifiable and is refused even under the key it names. A mismatching
  // stamp means the key and the contents disagree; whichever is right, serving it would
  // render a world this boot is not building, so refuse and let the caller build.
  const stamp = (raw.worldSeed !== undefined && raw.worldSeed !== null) ? raw.worldSeed
    : (raw.record.worldSeed !== undefined ? raw.record.worldSeed : null);
  if (stamp === null) return {ok: false, reason: `unstamped-world-seed (pre-fix entry, ${wanted})`};
  if (Number(stamp) !== Number(seed)) return {ok: false, reason: `world-mismatch entry=worldSeed ${stamp} boot=${seed} (${wanted})`};
  return {ok: true, record: raw.record, buffers: raw.buffers};
}

/** Returns { record, buffers } or null. Validates the format stamp and the world stamp. */
export async function loadPayload(kind, mapKey, seed) {
  const r = await getPayload(kind, mapKey, seed);
  return r.ok ? {record: r.record, buffers: r.buffers} : null;
}

/** Same lookup, but says why it refused - for the restore miss markers. */
export async function loadPayloadChecked(kind, mapKey, seed) {
  const r = await getPayload(kind, mapKey, seed);
  if (!r.ok) return {payload: null, reason: r.reason};
  return {payload: {record: r.record, buffers: r.buffers}, reason: null};
}

export async function hasPayload(kind, mapKey, seed) {
  return (await loadPayload(kind, mapKey, seed)) !== null;
}

export async function deletePayload(kind, mapKey, seed) {
  return (await withStore('readwrite', store => store.delete(keyFor(kind, mapKey, seed)))) !== null;
}

/** List stored keys, for diagnostics ("what planets are pre-generated?"). */
export async function listPayloads() {
  const db = await openDB();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map(String));
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Extract the nav graph's typed arrays into buffers ready for savePayload().
 * Mirrors the capture format used by tools/capture_nav.py so the same restore path
 * works whether the payload came from disk or from this store.
 */
export function navBuffersFrom(nav) {
  const arrays = [], buffers = {};
  for (const k of Object.keys(nav).sort()) {
    const v = nav[k];
    if (!ArrayBuffer.isView(v)) continue;
    arrays.push({ name: k, kind: v.constructor.name, length: v.length, bytes: v.byteLength });
    // copy: the live arrays keep being used/mutated, the store must keep a snapshot
    buffers[k] = v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  }
  const scalars = {};
  const skipped = [];
  const numArrays = {};
  const vector3 = {};
  for (const k of Object.keys(nav).sort()) {
    const v = nav[k];
    if (ArrayBuffer.isView(v)) continue;
    // Diagnostics must never be baked into a payload. `__navMiss` (js/nav-restore.js) is a
    // string, so it would land in `scalars` and be copied straight back onto the graph by
    // the restore - a restored boot then reports the PREVIOUS boot's miss and its stale
    // store-key list, which reads as a fresh refusal that never happened. Found while
    // verifying the keying fix: a warm arm carried the cold arm's marker text verbatim.
    if (k.startsWith('__')) continue;
    if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') { scalars[k] = v; continue; }
    if (Array.isArray(v)) {
      if (v.length === 0) scalars[k] = [];
      else if (v.length <= 4096 && v.every(x => typeof x === 'number' && Number.isFinite(x))) numArrays[k] = v.slice();
      else skipped.push(k + ':Array(' + v.length + ')');
      continue;
    }
    if (v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
      vector3[k] = { x: v.x, y: v.y, z: v.z };
      continue;
    }
    if (typeof v === 'object') skipped.push(k + ':' + (v.constructor ? v.constructor.name : 'Object'));
  }
  let total = 0;
  for (const a of arrays) total += a.bytes;
  return {
    record: { mapKey: undefined, seed: undefined, arrays, scalars, numArrays, vector3, skipped, total_bytes: total },
    buffers,
  };
}

/** Extract terrain mesh geometry attributes into buffers ready for savePayload(). */
export function meshBuffersFrom(mesh) {
  const g = mesh && mesh.geometry;
  if (!g || !g.attributes) return null;
  const attributes = [], buffers = {};
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k];
    if (!a || !ArrayBuffer.isView(a.array)) continue;
    attributes.push({ name: k, kind: a.array.constructor.name, itemSize: a.itemSize, count: a.count, bytes: a.array.byteLength });
    buffers[k] = a.array.buffer.slice(a.array.byteOffset, a.array.byteOffset + a.array.byteLength);
  }
  let index = null;
  if (g.index && ArrayBuffer.isView(g.index.array)) {
    index = { name: 'index', kind: g.index.array.constructor.name, count: g.index.count, bytes: g.index.array.byteLength };
    buffers.index = g.index.array.buffer.slice(g.index.array.byteOffset, g.index.array.byteOffset + g.index.array.byteLength);
  }
  let total = 0;
  for (const a of attributes) total += a.bytes;
  if (index) total += index.bytes;
  return {
    record: { attributes, index, material: mesh.material ? { type: mesh.material.type } : null, total_bytes: total },
    buffers,
  };
}
