// Plain routing rules shared by the game and the audition controls.
export function impactCue({ family = 'sword', material = 'iron', target = 'flesh' } = {}) {
  if (target === 'armor' || target === 'stone') return 'swordArmor';
  if (target === 'wood') return 'swordWood';
  if (material === 'wood') return 'woodFlesh';
  if (family === 'spear') return 'spearFlesh';
  if (family === 'twinblade') return 'twinFlesh';
  return 'swordFlesh';
}
export function creatureCue(type = 'husk') {
  return ({ mite:'creatureMite', husk:'creatureHusk', aegis:'creatureAegis', wisp:'creatureWisp', colossus:'creatureColossus' })[type] || 'creatureHusk';
}
export function musicContext({ homeQuiet = false, lobby = false, state = 'title', boss = false, theme = '', planet = 1, wave = 0 } = {}) {
  if (lobby) return 'lobby';
  if (state === 'title') return 'title';
  if (state === 'defeat' || state === 'victory') return 'silent';
  if(homeQuiet){
    if(/molten|volcan|io$|venus|magma/i.test(theme))return 'homemolten';
    if(/frozen|cryo|ice|europa|pluto|tundra/i.test(theme))return 'homefrozen';
    if(/desert|dune|arid|mercury/i.test(theme))return 'homedune';
    if(/canopy|tropic|jungle|ocean/i.test(theme))return 'homecanopy';
    return 'homegarden';
  }
  if (boss) {
    if (/desert|dune|arid|mercury|venus/i.test(theme)) return 'desertBoss';
    return wave >= 10 ? 'cinematicBoss' : 'boss';
  }
  if (/tropic|jungle|garden|ocean|earth/i.test(theme)) return 'tropical';
  return planet === 1 || planet % 2 ? 'planet' : 'playful';
}
