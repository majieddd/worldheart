// Ordinary nests need a dry clearing connected to the heart's floor region.
// A walkable mountain cell is not sufficient: its first enemies would crawl
// at the emergency mountain speed. Candidates are cached per footprint
// revision and inspected only when a wave creates a physical source.
export const NEST_CLEARANCE = 2.4;
export const NEST_SEPARATION = 6;
export const NEST_ROUTE_LIMIT = 160;
export const NEST_SCHEDULE_CAPACITY = 17;

function dryFloor(nav, i) {
  return nav.walk[i] && !nav.block[i] && nav.airWalk[i]
    && nav.baseHeight[i] >= .18 && nav.baseHeight[i] <= 1.5
    && nav.march.floorReach[i] && Number.isFinite(nav.airDist[i]);
}

export function nestSite(nav, original, centre, theta, used, scratch) {
  const field = nav.march;
  if (!field) return -1;
  let cache = nav._nestSites;
  if (!cache || cache.revision !== nav.revision) {
    cache = nav._nestSites = { revision: nav.revision, candidates: [], clear: new Map() };
    for (let i = 0; i < nav.n; i++) {
      if (!dryFloor(nav, i)) continue;
      let safe = true;
      for (let e = nav.adjOff[i]; e < nav.adjOff[i + 1]; e++) {
        if (!dryFloor(nav, nav.adj[e]) || !Number.isFinite(nav.cost[e])) { safe = false; break; }
      }
      if (safe) cache.candidates.push(i);
    }
  }
  nav.nodeDir(original, scratch);
  const ox = scratch.x, oy = scratch.y, oz = scratch.z;
  nav.nodePos(nav.heartNode, scratch);
  const radius = scratch.length() - nav.height[nav.heartNode];
  const target = theta * radius * 1.12, budget = NEST_ROUTE_LIMIT;
  let chosen = -1, best = Infinity;
  for (const i of cache.candidates) {
    if (used.has(i) || field.dist[i] > budget) continue;
    nav.nodeDir(i, scratch);
    const angle = Math.acos(Math.max(-1, Math.min(1, scratch.dot(centre))));
    const arc = angle * radius;
    if (arc < 10) continue;
    // Prefer the requested azimuth near the frontier, but a shorter healthy
    // approach inside expanded territory beats a remote ocean detour.
    const bearing = Math.acos(Math.max(-1, Math.min(1, scratch.x * ox + scratch.y * oy + scratch.z * oz)));
    const score = Math.abs(arc - target) + bearing * radius * .08 + field.dist[i] * .1;
    if (score >= best) continue;
    nav.nodePos(i, scratch);
    let separate = true;
    for (const previous of used) {
      const x = scratch.x - nav.pos[previous * 3], y = scratch.y - nav.pos[previous * 3 + 1], z = scratch.z - nav.pos[previous * 3 + 2];
      if (x * x + y * y + z * z < NEST_SEPARATION ** 2) { separate = false; break; }
    }
    if (!separate) continue;
    if (!cache.clear.has(i)) cache.clear.set(i, nav.nodesInRadius(scratch, NEST_CLEARANCE).every(n => dryFloor(nav, n)));
    if (!cache.clear.get(i)) continue;
    chosen = i; best = score;
  }
  // Never force a mountain fallback. The director delays this wave if player
  // footprints leave no legal source; selling reopens candidates by revision.
  return chosen;
}
