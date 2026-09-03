// The draftable power catalog.
//
// Mostly numeric so powers compose predictably, with four switches that give a
// run its identity. Rarity only weights how often something is OFFERED; it does
// not gate anything.

import { weightedPick } from './rng.js';

export const RARITY_WEIGHT = { common: 100, uncommon: 45, rare: 14 };

// `unique: true` means the power does nothing a second time (it latches a
// switch), so it is withdrawn from the pool once owned. Numeric powers stay in
// the pool and stack.
export const POWERS = [
  // ---- common ----
  { id: 'keen-rails', name: 'Keen Rails', rarity: 'common', desc: 'Towers deal 12% more damage.', apply: (m) => { m.dmgMul += 0.12; } },
  { id: 'overclock', name: 'Overclock', rarity: 'common', desc: 'Towers fire 10% faster.', apply: (m) => { m.rateMul += 0.10; } },
  { id: 'long-lens', name: 'Long Lens', rarity: 'common', desc: 'Towers reach 8% further.', apply: (m) => { m.rangeMul += 0.08; } },
  { id: 'bounty', name: 'Bounty', rarity: 'common', desc: 'Kills pay 15% more gold.', apply: (m) => { m.goldMul += 0.15; } },
  { id: 'thrift', name: 'Thrift', rarity: 'common', desc: 'Towers cost 10% less.', apply: (m) => { m.costMul -= 0.10; } },
  { id: 'hardened-heart', name: 'Hardened Heart', rarity: 'common', desc: 'The worldheart holds 2 more lives.', apply: (m) => { m.livesAdd += 2; } },
  { id: 'sharp-edge', name: 'Sharp Edge', rarity: 'common', desc: '+5% critical chance.', apply: (m) => { m.critAdd += 0.05; } },
  { id: 'salvage', name: 'Salvage', rarity: 'common', desc: 'Selling refunds 20% more.', apply: (m) => { m.refundPct += 0.20; } },

  // ---- uncommon ----
  { id: 'twin-rails', name: 'Twin Rails', rarity: 'uncommon', desc: 'Towers deal 20% more damage.', apply: (m) => { m.dmgMul += 0.20; } },
  { id: 'flywheel', name: 'Flywheel', rarity: 'uncommon', desc: 'Towers fire 18% faster.', apply: (m) => { m.rateMul += 0.18; } },
  { id: 'far-sight', name: 'Far Sight', rarity: 'uncommon', desc: 'Towers reach 15% further.', apply: (m) => { m.rangeMul += 0.15; } },
  { id: 'compound-interest', name: 'Compound Interest', rarity: 'uncommon', desc: 'Earn 3% interest on gold each wave.', apply: (m) => { m.interestPct += 0.03; } },
  { id: 'mending', name: 'Mending', rarity: 'uncommon', desc: 'The worldheart recovers 1 life per wave.', apply: (m) => { m.heartRegen += 1; } },
  { id: 'cryo-field', name: 'Cryo Field', rarity: 'uncommon', desc: 'Enemies near the heart are slowed 10%.', apply: (m) => { m.slowAura += 0.10; } },
  { id: 'deep-crit', name: 'Deep Crit', rarity: 'uncommon', desc: '+10% critical chance.', apply: (m) => { m.critAdd += 0.10; } },
  { id: 'chain-coil', name: 'Chain Coil', rarity: 'uncommon', desc: 'Shots arc to 1 extra target.', apply: (m) => { m.chainAdd += 1; } },

  // ---- rare ----
  { id: 'pierce-rounds', name: 'Pierce Rounds', rarity: 'rare', unique: true, desc: 'Shots pass through their target.', apply: (m) => { m.pierce = true; } },
  { id: 'scorched-earth', name: 'Scorched Earth', rarity: 'rare', unique: true, desc: 'Mortar leaves burning ground.', apply: (m) => { m.burnGround = true; } },
  { id: 'deep-freeze', name: 'Deep Freeze', rarity: 'rare', unique: true, desc: 'Cryo halts enemies outright.', apply: (m) => { m.hardFreeze = true; } },
  { id: 'fifth-volley', name: 'Fifth Volley', rarity: 'rare', unique: true, desc: 'Every fifth shot deals double.', apply: (m) => { m.everyFifthDouble = true; } },
];

export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]));

// Three distinct offers. A unique power already owned is withdrawn, because
// offering a switch that is already on is a dead choice.
export function rollOffers(rng, ownedIds) {
  const owned = new Set(ownedIds);
  const pool = POWERS.filter((p) => !(p.unique && owned.has(p.id)));
  const offers = [];
  const taken = new Set();
  while (offers.length < 3 && taken.size < pool.length) {
    const candidates = pool.filter((p) => !taken.has(p.id));
    const chosen = weightedPick(rng, candidates, (p) => RARITY_WEIGHT[p.rarity]);
    taken.add(chosen.id);
    offers.push(chosen);
  }
  return offers;
}
