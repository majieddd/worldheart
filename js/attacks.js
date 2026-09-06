// One timing and shape contract for simulation, poses and threat guides.
export const STRIKE_AT = Object.freeze({ melee: 0.40, twin: 0.34, hitscan: 0.05, projectile: 0.12, lob: 0.42, beam: 0 });
export function insideStrike(offset, up, facing, radius, arcDeg = 360) {
  const d2 = offset.x ** 2 + offset.y ** 2 + offset.z ** 2;
  if (d2 > radius * radius + 1e-8) return false;
  if (arcDeg >= 359) return true;
  const vertical = offset.x * up.x + offset.y * up.y + offset.z * up.z;
  const x = offset.x - up.x * vertical, y = offset.y - up.y * vertical, z = offset.z - up.z * vertical;
  const length = Math.hypot(x, y, z);
  return length < 1e-8 || (x * facing.x + y * facing.y + z * facing.z) / length >= Math.cos(arcDeg * Math.PI / 360) - 1e-8;
}
export function enemyStrike(type) {
  return { radius: type.reach + 0.35, arcDeg: type.boss ? 120 : 100, wind: type.wind, damage: type.atk };
}
