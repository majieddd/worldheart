// Shared expedition rules. Time, input and random rolls are injected by the shell.
export const COMMANDERS = {
  commander: { name: 'Bulwark', health: 1400, power: 1.15, speed: .92, color: 0x68dbbe, role: 'Durable close combat' },
  duelist: { name: 'Twinfang', health: 1050, power: .9, speed: 1.22, color: 0xbcb0ff, role: 'Fast repeated slashes' },
  marksman: { name: 'Longsight', health: 900, power: 1, speed: 1.08, color: 0x99dcff, role: 'Precise ranged fire' },
  bombardier: { name: 'Kettle', health: 1150, power: 1.25, speed: .88, color: 0xffba76, role: 'Heavy area damage' },
  oracle: { name: 'Emberline', health: 1000, power: 1.08, speed: 1, color: 0xff94bf, role: 'Sustained energy beam' },
};
export const MOUNTS = {
  none: { name: 'On foot', speed: 1, water: 1, damage: 1, height: 0, description: 'Full weapon power and precise movement.' },
  strider: { name: 'Ridge Strider', speed: 1.65, water: .7, damage: .8, height: 1.1, color: 0xd9b084, description: 'Fast on land. Slow in water; mounted damage 80%.' },
  tideback: { name: 'Tideback', speed: 1.2, water: 2.4, damage: .9, height: .8, color: 0x5fd3ca, description: 'Amphibious: crosses oceans quickly. Mounted damage 90%.' },
  skyray: { name: 'Sky Ray', speed: 1.35, water: 1, damage: .65, height: 1.2, flight: 12, color: 0xb7a4ef, description: 'Hold Space to fly for up to 12 seconds. Recharge on land; mounted damage 65%.' },
};
export function commanderStats(key, level = 0) {
  const c = COMMANDERS[key] || COMMANDERS.commander, l = Math.max(0, Math.min(10, Number(level) || 0));
  return { health: Math.round(c.health * (1 + l * .15)), power: c.power * (1 + l * .12),
    speed: c.speed * (1 + l * .025), range: 1 + l * .045 };
}
export function scaleWeapon(spec, key, level = 0, mount = 'none') {
  if (!spec) return null;
  const s = commanderStats(key, level), m = MOUNTS[mount] || MOUNTS.none;
  const out = { ...spec };
  for (const key of ['dmg', 'dps', 'damage']) if (spec[key] != null) out[key] = spec[key] * s.power * m.damage;
  if (spec.range != null) out.range = spec.range * s.range;
  if (spec.radius != null) out.radius = spec.radius * s.range;
  if (spec.falloffFrom != null) out.falloffFrom = spec.falloffFrom * s.range;
  if (spec.kind === 'lob') { out.speed = spec.speed * Math.sqrt(s.range); out.fuse = spec.fuse * Math.sqrt(s.range); }
  // Projectile lifetime is derived from range by the combat adapter.
  return out;
}
export function createRespawn() {
  let remaining = 0;
  return {
    get remaining() { return remaining; },
    die(inside) { remaining = inside ? 30 : 0; return inside ? 'respawning' : 'defeat'; },
    tick(dt) { if (remaining <= 0) return false; remaining = Math.max(0, remaining - Math.max(0, dt)); return remaining === 0; },
  };
}
export const FORGE_COST = 3;
export function createOreLedger() {
  const collected = new Set(); let ore = 0;
  return {
    get ore() { return ore; },
    collect(id, amount = 1) { if (collected.has(id) || !id || !Number.isInteger(amount) || amount < 1) return false;
      collected.add(id); ore += amount; return true; },
    craft(insideBase, makeTower) { if (!insideBase || ore < FORGE_COST) return null;
      const tower = makeTower(); if (!tower) return null; ore -= FORGE_COST; return tower; },
  };
}
