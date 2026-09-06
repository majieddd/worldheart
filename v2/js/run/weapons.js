// Serializable weapon rules. RNG and identity are supplied by the shell.
export const BACKPACK_SIZE = 12;
export const FAMILIES = {
  sword: { name: 'Sword', visual: 'sword', view: 'commander', kind: 'melee', dmg: 40, cd: 0.85, radius: 3, arcDeg: 120, cleave: 0.65, pierce: 4, knockback: 0.6, kick: 0.3, trauma: 0.2, fov: 78 },
  spear: { name: 'Spear', visual: 'spear', view: 'warden', kind: 'melee', dmg: 42, cd: 1.05, radius: 4.4, arcDeg: 38, cleave: 0.35, pierce: 6, knockback: 0.3, kick: 0.22, trauma: 0.16, fov: 78 },
  carbine: { name: 'Carbine', visual: 'rifle', view: 'marksman', kind: 'projectile', dmg: 29, cd: 0.6, range: 34, speed: 42, corridor: 0.18, pierce: 3, kick: 0.22, trauma: 0.12, fov: 78, cross: 'ranged' },
  lobber: { name: 'Lobber', visual: 'mortar', view: 'bombardier', kind: 'lob', dmg: 40, cd: 1.15, speed: 16, lift: 0.42, gravity: 16, aoe: 3.4, pierce: 99, fuse: 2.6, kick: 0.3, trauma: 0.22, fov: 80, cross: 'ranged' },
};
export const COMPATIBILITY = {
  commander: { families: ['sword', 'spear', 'lobber'], label: 'Bulwark: broad melee arcs', arc: 1.15 },
  duelist: { families: ['sword', 'spear', 'carbine'], label: 'Twinfang: quick handling', cadence: 0.9 },
  marksman: { families: ['sword', 'spear', 'carbine'], label: 'Longsight: fast projectiles', velocity: 1.15 },
  bombardier: { families: ['sword', 'carbine', 'lobber'], label: 'Kettle: wider shell bursts', blast: 1.1 },
  oracle: { families: ['sword', 'spear', 'lobber'], label: 'Emberline: stronger elemental cores', element: 1.2 },
};
export const PARTS = {
  head: {
    balanced: { name: 'Balanced', note: 'Standard reach and coverage' },
    long: { name: 'Long', note: '+25% reach / velocity, 18% slower cadence', reach: 1.25, velocity: 1.25, cadence: 1.18 },
    keen: { name: 'Keen', note: '+3 pierce, 25% narrower arc / blast', pierce: 3, arc: 0.75, blast: 0.75 },
    broad: { name: 'Broad', note: '+25% arc / blast, 12% less damage', arc: 1.25, blast: 1.25, damage: 0.88, families: ['sword', 'spear', 'lobber'] },
  },
  grip: {
    balanced: { name: 'Balanced', note: 'Standard handling' },
    quick: { name: 'Quick', note: '15% faster cadence, 12% less damage', cadence: 0.85, damage: 0.88 },
    steady: { name: 'Steady', note: '35% less recoil, 10% slower cadence', recoil: 0.65, cadence: 1.1 },
    weighted: { name: 'Weighted', note: '+15% damage, 18% slower cadence', damage: 1.15, cadence: 1.18 },
  },
  core: {
    tempered: { name: 'Tempered', note: 'Standard impact' },
    ember: { name: 'Ember', note: 'Burn for 3 seconds, 12% less impact', burn: 3, damage: 0.88 },
    frost: { name: 'Frost', note: '18% slow for 2 seconds, 12% less impact', slow: 0.18, damage: 0.88 },
    pulse: { name: 'Pulse', note: '+30% projectile speed, 10% less impact', velocity: 1.3, damage: 0.9, families: ['carbine', 'lobber'] },
  },
};
export const RARITIES = ['common', 'uncommon', 'rare', 'relic'];
export const ERAS = ['ancient', 'technological', 'empowered'];
export function eraForPlanet(planet) { return planet <= 33 ? 'ancient' : planet <= 66 ? 'technological' : 'empowered'; }
export function compatible(commander, family) { return !!COMPATIBILITY[commander]?.families.includes(family); }
export function validPart(family, slot, id) {
  if (!Object.hasOwn(PARTS, slot) || !Object.hasOwn(PARTS[slot], id)) return false;
  const p = PARTS[slot][id]; return !p.families || p.families.includes(family);
}
export function validWeapon(item) {
  return !!item && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,159}$/.test(item.id)
    && Object.hasOwn(FAMILIES, item.family) && ERAS.includes(item.era)
    && Number.isInteger(item.seed) && item.seed >= 0 && item.seed <= 0xffffffff
    && Number.isInteger(item.tier) && item.tier >= 1 && item.tier <= 99
    && RARITIES.includes(item.rarity) && Number.isInteger(item.infusions) && item.infusions >= 0 && item.infusions <= 3
    && Object.keys(PARTS).every(slot => validPart(item.family, slot, item.parts?.[slot]))
    && Array.isArray(item.affixes) && item.affixes.length <= 1 && item.affixes.every(x => ['nimble', 'forceful', 'farseeing'].includes(x));
}
const clone = value => JSON.parse(JSON.stringify(value));
export function generateWeapon({ id, seed, tier = 1, family = null, rng }) {
  const keys = Object.keys(FAMILIES), roll = rng();
  family ||= keys[Math.floor(rng() * keys.length)];
  const rarity = roll < 0.68 ? 'common' : roll < 0.9 ? 'uncommon' : roll < 0.985 ? 'rare' : 'relic';
  const parts = {};
  for (const slot of Object.keys(PARTS)) {
    const pool = Object.keys(PARTS[slot]).filter(key => validPart(family, slot, key));
    parts[slot] = pool[Math.floor(rng() * pool.length)];
  }
  const affixes = rarity === 'common' ? [] : [['nimble', 'forceful', 'farseeing'][Math.floor(rng() * 3)]];
  const item = { id, seed: seed >>> 0, tier, family, era: eraForPlanet(tier), rarity, parts, affixes, infusions: 0 };
  if (!validWeapon(item)) throw new Error('Invalid generated weapon');
  return item;
}
export function shouldDrop({ boss = false, elite = false }, rng) { return boss || rng() < (elite ? 0.1 : 0.02); }
export function weaponName(item) {
  const eras = { ancient: 'Forged', technological: 'Circuit', empowered: 'Awakened' };
  return `${eras[item.era]} ${FAMILIES[item.family].name}`;
}
export function weaponStats(item, commander) {
  if (!validWeapon(item) || !compatible(commander, item.family)) return null;
  const s = { ...FAMILIES[item.family] }, trait = COMPATIBILITY[commander];
  // Tier is bounded independently of rarity. Era changes identity and core
  // presentation; it does not invalidate a favorite weapon's family.
  s.dmg *= Math.min(2.4, 1 + (item.tier - 1) * 0.014) * (1 + RARITIES.indexOf(item.rarity) * 0.08);
  const effects = [trait, ...Object.keys(PARTS).map(slot => PARTS[slot][item.parts[slot]])];
  if (item.affixes.includes('nimble')) effects.push({ cadence: 0.93, damage: 0.96 });
  if (item.affixes.includes('forceful')) effects.push({ damage: 1.08, recoil: 1.15 });
  if (item.affixes.includes('farseeing')) effects.push({ reach: 1.12, cadence: 1.06 });
  for (const p of effects) {
    s.dmg *= p.damage || 1; s.cd *= p.cadence || 1; s.kick *= p.recoil || 1;
    if (s.radius) s.radius *= p.reach || 1;
    if (s.range) s.range *= p.reach || 1;
    if (s.arcDeg) s.arcDeg = Math.min(180, s.arcDeg * (p.arc || 1));
    if (s.aoe) s.aoe *= p.blast || 1;
    if (s.speed) s.speed *= p.velocity || 1;
    s.pierce += p.pierce || 0;
    if (p.burn) s.burn = p.burn * (trait.element || 1);
    if (p.slow) s.slow = p.slow * (trait.element || 1);
  }
  s.weaponFamily = item.family;
  return s;
}

export function createInventory(commander, initial = null) {
  let items = [], slots = [null, null], active = 'native', pending = null, scrap = 0;
  const drops = new Map(), claimed = new Set();
  if (initial) {
    const ids = new Set();
    if (initial.version !== 1 || !Array.isArray(initial.items) || initial.items.length > 14
      || initial.items.some(x => !validWeapon(x) || ids.has(x.id) || !ids.add(x.id))
      || !Array.isArray(initial.slots) || initial.slots.length !== 2
      || initial.slots.some(id => id !== null && !ids.has(id))
      || (initial.slots[0] !== null && initial.slots[0] === initial.slots[1])
      || initial.slots.some(id => id && !compatible(commander, initial.items.find(x => x.id === id).family))
      || initial.items.length - initial.slots.filter(Boolean).length > BACKPACK_SIZE
      || !['native', 'basic', 0, 1].includes(initial.active)
      || (typeof initial.active === 'number' && !initial.slots[initial.active])
      || !Number.isInteger(initial.scrap) || initial.scrap < 0) throw new Error('Invalid inventory checkpoint');
    items = clone(initial.items); slots = [...initial.slots]; active = initial.active; scrap = initial.scrap;
  }
  const find = id => items.find(x => x.id === id);
  const bagCount = () => items.length - slots.filter(Boolean).length;
  const equipped = id => slots.includes(id);
  const transact = op => {
    if (op.kind === 'select') {
      if (!['native', 'basic', 0, 1].includes(op.slot) || (typeof op.slot === 'number' && !slots[op.slot])) return false;
      active = op.slot; return true;
    }
    if (op.kind === 'equip') {
      const item = find(op.id);
      if (!item || ![0, 1].includes(op.slot) || !compatible(commander, item.family)) return false;
      const previous = slots.indexOf(op.id);
      if (previous >= 0) slots[previous] = slots[op.slot];
      slots[op.slot] = op.id; active = op.slot; return true;
    }
    if (op.kind === 'unequip') {
      if (![0,1].includes(op.slot) || !slots[op.slot] || bagCount() >= BACKPACK_SIZE) return false;
      slots[op.slot] = null; if (active === op.slot) active = 'basic'; return true;
    }
    if (op.kind === 'part') {
      const item = find(op.id);
      if (!item || !validPart(item.family, op.slot, op.part)) return false;
      item.parts[op.slot] = op.part; return true;
    }
    return false;
  };
  return {
    register(item) { if (!validWeapon(item) || drops.has(item.id) || claimed.has(item.id) || find(item.id)) return false; drops.set(item.id, clone(item)); return true; },
    pickup(id, replace = null) {
      const item = drops.get(id); if (!item || claimed.has(id)) return false;
      if (replace !== null && (!find(replace) || equipped(replace))) return false;
      if (bagCount() >= BACKPACK_SIZE && replace === null) return false;
      if (replace !== null) { items = items.filter(x => x.id !== replace); scrap++; }
      items.push(item); drops.delete(id); claimed.add(id); return true;
    },
    salvage(id) {
      if (equipped(id)) return false;
      if (drops.has(id)) { drops.delete(id); claimed.add(id); scrap++; return true; }
      if (!find(id)) return false;
      items = items.filter(x => x.id !== id); scrap++; return true;
    },
    request(op, busy = false) {
      // Validate on a disposable transaction state before accepting a queue.
      const oldItems = clone(items), oldSlots = [...slots], oldActive = active;
      const ok = transact(op);
      if (busy || !ok) { items = oldItems; slots = oldSlots; active = oldActive; }
      if (ok && busy) pending = clone(op);
      else if (ok) pending = null;
      return ok;
    },
    settle(busy) { if (!pending || busy) return false; const op = pending; pending = null; return transact(op); },
    infuse(id, planet) {
      const item = find(id);
      if (!item || !Number.isInteger(planet) || planet <= item.tier || planet > 99 || item.infusions >= 3) return false;
      item.tier = planet; item.era = eraForPlanet(planet); item.infusions++; return true;
    },
    get current() { return typeof active === 'number' ? clone(find(slots[active]) || null) : null; },
    get active() { return active; },
    get pending() { return pending && clone(pending); },
    get items() { return clone(items); },
    get slots() { return [...slots]; },
    get drops() { return [...drops.values()].map(clone); },
    get scrap() { return scrap; },
    snapshot() { return { version: 1, items: clone(items), slots: [...slots], active, scrap }; },
  };
}
