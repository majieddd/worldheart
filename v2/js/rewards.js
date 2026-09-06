// Each tower family expresses output differently. Preserve absent fields so
// an aura never acquires NaN damage, and map cadence to its real clock.
export function modifiedTowerStats(base, m) {
  if (!m) return base;
  const out = { ...base };
  if (base.dmg !== undefined) out.dmg *= m.dmgMul;
  if (base.dps !== undefined) out.dps *= m.dmgMul * (1 + 1.2 * Math.min(1, m.critAdd));
  if (base.rate !== undefined) out.rate *= m.rateMul;
  if (base.charge !== undefined) out.charge /= m.rateMul;
  if (base.ramp !== undefined) out.ramp /= m.rateMul;
  if (base.summonTime !== undefined) out.summonTime /= m.rateMul;
  if (base.range !== undefined) out.range *= m.rangeMul;
  if (base.leash !== undefined) out.leash *= m.rangeMul;
  if (base.chains !== undefined) out.chains += m.chainAdd;
  if (base.dmg !== undefined) out.crit = Math.min(1, (base.crit || 0) + m.critAdd);
  return out;
}

// The shell owns live health and gold. Keep one consumer for persistent
// talent setup and incremental run rewards, so re-rendering cannot pay twice.
export function createRewardConsumer({ game, profile, startGold, startLives, allies, enemies, centre, world }) {
  game.gold = startGold + (profile.bonuses?.interest ? 150 : 0);
  game.maxLives = startLives;
  let livesApplied = 0;
  let modifiers = null;
  if (allies) allies.healthMultiplier = profile.bonuses?.veteran ? 1.2 : 1;
  return {
    sync(m) {
      modifiers = m;
      const added = Math.max(0, m.livesAdd - livesApplied);
      livesApplied = m.livesAdd;
      game.maxLives = startLives + livesApplied;
      if (game.lives > 0) game.lives = Math.min(game.maxLives, game.lives + added);
      if (allies) allies.modifiers = m;
      if (enemies) enemies.heartAura = centre && m.slowAura > 0
        ? { centre, radius: 8, fraction: Math.min(0.7, m.slowAura) } : null;
      world?.setHeartHealth?.(game.lives / game.maxLives);
    },
    waveCleared() {
      if (!modifiers || game.lives <= 0) return { healed: 0, interest: 0 };
      const healed = Math.min(game.maxLives - game.lives, modifiers.heartRegen);
      game.lives += healed;
      const interest = Math.floor(game.gold * modifiers.interestPct);
      game.gold += interest;
      world?.setHeartHealth?.(game.lives / game.maxLives);
      return { healed, interest };
    },
  };
}
