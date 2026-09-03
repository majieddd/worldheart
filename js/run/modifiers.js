// The single object powers write to and everything else reads.
//
// Powers NEVER reach into towers, economy or enemies directly. Without that
// rule twenty powers need hooks in twenty call sites and each new power risks
// every system. Here a power is a function of one argument.
//
// Multipliers accumulate ADDITIVELY into a base of 1 (+0.12 three times gives
// 1.36, not 1.40). Multiplicative stacking across fifteen drafted powers is
// how roguelite balance explodes, and additive accumulation keeps the total
// legible and bounded.

export function baseModifiers() {
  return {
    // offense
    dmgMul: 1,
    rateMul: 1,
    rangeMul: 1,
    critAdd: 0,
    chainAdd: 0,
    // economy
    goldMul: 1,
    costMul: 1,
    interestPct: 0,
    refundPct: 0.7,
    // defense
    livesAdd: 0,
    heartRegen: 0,
    slowAura: 0,
    // build-defining switches
    pierce: false,
    burnGround: false,
    hardFreeze: false,
    everyFifthDouble: false,
  };
}

// A tower must never become free, however the draft goes.
const MIN_COST_MUL = 0.25;

export function foldModifiers(powers) {
  const m = baseModifiers();
  for (const p of powers) p.apply(m);
  if (m.costMul < MIN_COST_MUL) m.costMul = MIN_COST_MUL;
  return m;
}
