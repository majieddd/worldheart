// URL intent stays explicit so regenerating a sandbox cannot start or replace
// an expedition. Replays use the requested seed, before worldgen acceptance.
export function worldgenUrl(base, seed, terrain = 'varied', inspect = true, biome = 'auto') {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw Error('Enter a seed from 1 to 4294967295.');
  if (!['varied', 'alpine', 'canyon', 'ocean', 'classic'].includes(terrain)) throw Error('Choose a supported terrain.');
  if(!['auto','temperate','desert','boreal','jungle','volcanic','wetland'].includes(biome))throw Error('Choose a supported climate.');
  const url = new URL(base);
  url.search = ''; url.hash = '';
  url.searchParams.set('map', terrain === 'classic' ? 'giant' : 'ninetynine');
  url.searchParams.set('campaign', '0'); url.searchParams.set('seed', String(seed));
  if (terrain !== 'classic') url.searchParams.set('terrain', terrain);
  if (terrain !== 'classic' && biome !== 'auto') url.searchParams.set('biome',biome);
  if (inspect) url.searchParams.set('worldgen', '1');
  return url.href;
}

export function rememberWorld(history, world) {
  const valid = x => x && Number.isInteger(x.seed) && x.seed > 0 && x.seed <= 0xffffffff
    && ['varied', 'alpine', 'canyon', 'ocean', 'classic'].includes(x.terrain) && (!x.biome || ['auto','temperate','desert','boreal','jungle','volcanic','wetland'].includes(x.biome));
  if (!valid(world)) throw Error('Invalid world history entry.');
  const prior = Array.isArray(history) ? history.filter(valid) : [];
  return [world, ...prior.filter(x => x.seed !== world.seed || x.terrain !== world.terrain || (x.biome||'auto') !== (world.biome||'auto'))].slice(0, 12);
}
