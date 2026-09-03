// Is a direction inside the current frontier?
//
// This is the whole of the frontier mechanic at runtime. The nav graph and the
// terrain are built once at the FINAL angle and never rebuilt, because
// nav._buildGraph reallocates every array and would destroy the tower
// footprints in nav.block along with heartNode and portalNodes. So the frontier
// is a mask over a fixed world rather than a smaller world that grows.
//
// Pure by contract: plain {x,y,z} objects, no THREE.

export function angleBetween(a, b) {
  const la = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
  const lb = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z) || 1;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

// A hair of tolerance so a point placed exactly on the rim is not rejected by
// floating-point noise.
const EDGE_EPSILON = 1e-6;

export function insideFrontier(centre, dir, theta) {
  if (!centre) return true;
  return angleBetween(centre, dir) <= theta + EDGE_EPSILON;
}
