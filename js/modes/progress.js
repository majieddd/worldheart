// Campaign progress across runs: the profile, the coins, and the talent tree.
//
// Lives in the SHELL, not the core: js/run may not touch storage (portability
// contract rule 1), which is what keeps the core transliterable to Luau where
// this becomes a DataStore instead. The core is handed a plain object at
// construction and never learns where it came from.

import { campaignStore } from './campaign-store.js';

// The tree. Tiers gate on the tier below rather than on individual nodes, so a
// player can always see one row ahead and choose within it, and nothing can be
// bought out of order. Costs climb roughly with what a node changes: a whole
// new tower or commander costs more than a percentage.
export const TALENTS = [
  // --- tier 1: the rest of the tower roster --------------------------------
  { id: 't-cryo', tier: 1, kind: 'tower', grant: 'cryo', cost: 120,
    name: 'Cryo Bloom', desc: 'Unlock the Cryo Bloom. Slows everything near it.' },
  { id: 't-mortar', tier: 1, kind: 'tower', grant: 'mortar', cost: 140,
    name: 'Mortar', desc: 'Unlock the Mortar. Arcing splash over cover.' },
  { id: 't-tesla', tier: 1, kind: 'tower', grant: 'tesla', cost: 160,
    name: 'Arc Spire', desc: 'Unlock the Arc Spire. Chains between targets.' },

  // --- tier 2: the specialists ---------------------------------------------
  { id: 't-helios', tier: 2, kind: 'tower', grant: 'helios', cost: 240,
    name: 'Helios Lance', desc: 'Unlock the Helios Lance. A beam that ramps.' },
  { id: 't-warden', tier: 2, kind: 'tower', grant: 'warden', cost: 220,
    name: 'Warden Barracks', desc: 'Unlock the Warden Barracks. Summons a garrison.' },
  { id: 'b-interest', tier: 2, kind: 'bonus', grant: 'interest', cost: 180,
    name: 'Counting House', desc: 'Start every run with 150 extra gold.' },

  // --- tier 3: commanders ---------------------------------------------------
  { id: 'c-duelist', tier: 3, kind: 'commander', grant: 'duelist', cost: 300,
    name: 'Twinfang', desc: 'A fast dual-strike commander. Thin, quick, relentless.' },
  { id: 'c-marksman', tier: 3, kind: 'commander', grant: 'marksman', cost: 340,
    name: 'Longsight', desc: 'A marksman commander. The only one that shoots.' },
  { id: 'c-bombardier', tier: 3, kind: 'commander', grant: 'bombardier', cost: 340,
    name: 'Kettle', desc: 'A bombardier commander. Lobs bursting shells.' },
  { id: 'c-oracle', tier: 3, kind: 'commander', grant: 'oracle', cost: 380,
    name: 'Emberline', desc: 'A beam commander. Burns hotter the longer it holds.' },

  // --- tier 4: standing advantages -----------------------------------------
  { id: 'b-veteran', tier: 4, kind: 'bonus', grant: 'veteran', cost: 420,
    name: 'Veterancy', desc: 'Commanders and wardens carry 20% more health.' },
  { id: 'b-quartermaster', tier: 4, kind: 'bonus', grant: 'quartermaster', cost: 460,
    name: 'Quartermaster', desc: 'Hold a fourth card in hand.' },
  { id: 'b-scout', tier: 4, kind: 'bonus', grant: 'scout', cost: 400,
    name: 'Forward Scout', desc: 'The frontier starts one expansion wider.' },
];

export function loadProfile() {
  return campaignStore.snapshot().account;
}

export function saveProfile(profile) {
  campaignStore.updateAccount(profile);
  return loadProfile();
}
export function persistProfile(){return campaignStore.retry();}

export function bankVictory(coins = 0) {
  const p = loadProfile();
  p.planetsBeaten += 1;
  p.coins += coins;
  return saveProfile(p);
}

// A run that ends in defeat still banks what it earned, because a tree you only
// advance by winning is a tree a new player never sees.
export function bankCoins(coins) {
  const p = loadProfile();
  p.coins += Math.max(0, Math.round(coins));
  return saveProfile(p);
}

export function talentById(id) {
  return TALENTS.find((t) => t.id === id) || null;
}

export function isOwned(profile, talent) {
  if (talent.kind === 'tower') return profile.towers.includes(talent.grant);
  if (talent.kind === 'commander') return true; // The preparation roster is now freely selectable.
  return !!profile.bonuses[talent.grant];
}

// A tier opens once anything in the tier below is owned, so the tree always
// shows one row further than the player has reached.
export function isReachable(profile, talent) {
  if (talent.tier <= 1) return true;
  // Free commander choices do not bypass the paid tower/bonus progression.
  const previousTier = talent.tier === 4 ? 2 : talent.tier - 1;
  return TALENTS.some((t) => t.tier === previousTier && isOwned(profile, t));
}

export function buyTalent(id) {
  const p = loadProfile();
  const t = talentById(id);
  if (!t) return { ok: false, reason: 'unknown' };
  if (isOwned(p, t)) return { ok: false, reason: 'owned' };
  if (!isReachable(p, t)) return { ok: false, reason: 'locked' };
  if (p.coins < t.cost) return { ok: false, reason: 'coins' };
  p.coins -= t.cost;
  if (t.kind === 'tower') p.towers.push(t.grant);
  else if (t.kind === 'commander') p.commanders.push(t.grant);
  else p.bonuses[t.grant] = true;
  saveProfile(p);
  return { ok: true, profile: p, talent: t };
}

// The tower a run opens with. Only something actually unlocked can be chosen.
export function setLoadout(towerKey) {
  const p = loadProfile();
  if (!p.towers.includes(towerKey)) return p;
  p.loadout = towerKey;
  return saveProfile(p);
}
