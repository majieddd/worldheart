// Deterministic seeded randomness for the run core.
//
// The core never calls Math.random(). Every random decision flows through a
// seeded generator passed in by the caller, so a run replays identically from
// its seed. That is what makes the core testable headlessly, lets a seed be
// shared, and lets a draft tiebreak resolve the same way for every player in
// co-op without anyone having to agree over the network.

// mulberry32: small, fast, and good enough for gameplay. Not cryptographic.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Weight zero must never be selected, so the scan compares strictly.
export function weightedPick(rng, list, weightOf) {
  let total = 0;
  for (const item of list) total += weightOf(item);
  if (total <= 0) return list[0];
  let roll = rng() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}
