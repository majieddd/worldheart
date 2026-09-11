// Paths share one browser origin on Pages. Keep preview experiments out of
// the production profile, including map, camera preferences and campaign saves.
export const isPreviewPath = path => /(?:^|\/)v2(?:\/|$)/.test(path);
export const storageKey = (key, path) => isPreviewPath(path) ? `whV2:${key}` : key;

export function scopedStorage(storage, path, namespace = '') {
  return {
    getItem: key => storage.getItem(namespace + storageKey(key, path)),
    setItem: (key, value) => storage.setItem(namespace + storageKey(key, path), value),
    removeItem: key => storage.removeItem(namespace + storageKey(key, path)),
  };
}

// Resolve browser storage lazily so denied storage is still handled by the
// campaign recovery layer, and pure store tests need no browser globals.
export const browserStorage = scopedStorage({
  getItem: key => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: key => globalThis.localStorage.removeItem(key),
}, globalThis.location?.pathname || '/', new URLSearchParams(globalThis.location?.search || '').get('worldgen') === '1' ? 'whWorldgen:' : '');
