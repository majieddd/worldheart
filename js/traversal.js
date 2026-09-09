// Shared numerical contract for movement, route costs and elemental ground.
// No rendering, random draws or simulation clock lives here.
export const SWIM_ENTER = 0.65;
export const SWIM_EXIT = 0.45;
export const MAX_GRADE = 0.95;
export const MAX_SLOW = 0.7;
export const MOUNTAIN_MARCH = 0.08;
// These limits meet the meadow-to-stone transition in the terrain palette.
// Water remains a floor route, with its existing swimming penalty.
export function isFloorTerrain(height, slope) { return height < 0.05 || (height <= 1.75 && slope <= 0.62); }
export function swimOffset(unit) { return unit.swimming ? unit.type.radius * 0.75 : 0; }

export function isSwimming(wasSwimming, depth) {
  return depth > (wasSwimming ? SWIM_EXIT : SWIM_ENTER);
}

export function travelFactor(grade, swimming = false) {
  const climb = Math.max(0.65, 1 / (1 + Math.max(0, grade) * 1.25));
  return climb * (swimming ? 0.6 : 1);
}

// from/to are gameplay heights; oceans use their water surface for distance.
// This cost is directed: climbing and descending the same edge differ.
export function travelCost(from, to, horizontal) {
  if (!(horizontal > 0)) return Infinity;
  const rise = Math.max(0.03, to) - Math.max(0.03, from);
  const grade = rise / horizontal;
  if (Math.abs(grade) > MAX_GRADE) return Infinity;
  return Math.hypot(horizontal, rise) / travelFactor(grade, Math.min(from, to) < -SWIM_ENTER);
}

export function climatePermission(type, climates) {
  const hot = climates.includes('hot'), cold = climates.includes('cold');
  if (hot && cold) return { ok: false, reason: 'mixed', climate: 'mixed' };
  const climate = hot ? 'hot' : cold ? 'cold' : 'neutral';
  if (hot && type !== 'mortar') return { ok: false, reason: 'hot', climate };
  if (cold && type !== 'cryo') return { ok: false, reason: 'cold', climate };
  return { ok: true, climate };
}

export function terrainTowerStats(stats, type, climate) {
  if (type === 'mortar' && climate === 'hot') return { ...stats, dmg: stats.dmg * 1.15 };
  if (type === 'cryo') return { ...stats, slow: Math.min(MAX_SLOW, stats.slow * (climate === 'cold' ? 1.1 : 1)) };
  return stats;
}
