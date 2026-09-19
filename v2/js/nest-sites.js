// Ordinary nests need a dry clearing connected to the heart's floor region.
// A walkable mountain cell is not sufficient: its first enemies would crawl
// at the emergency mountain speed. Candidates are cached per footprint
// revision and inspected only when a wave creates a physical source.
export const NEST_CLEARANCE = 2.4;
export const NEST_SEPARATION = 6;
export const NEST_ROUTE_LIMIT = 160;
export const NEST_SCHEDULE_CAPACITY = 11;

function dryFloor(nav, i) {
  return !nav.layer?.[i] && nav.walk[i] && !nav.block[i] && nav.airWalk[i]
    && (nav.waterDepth ? nav.waterDepth[i] === 0 : nav.baseHeight[i] >= .18) && nav.baseHeight[i] <= 1.5+(nav.floorDatum||0)
    && nav.march.floorReach[i] && Number.isFinite(nav.airDist[i]);
}

// Cheap per-site certificate for a staged terrain forecast. It shares the
// spawning predicates without rebuilding the global wet-route scoring cache.
export function isNestClearing(nav,i,scratch){
  if(!dryFloor(nav,i))return false;
  for(let e=nav.adjOff[i];e<nav.adjOff[i+1];e++)if(!dryFloor(nav,nav.adj[e])||!Number.isFinite(nav.cost[e]))return false;
  nav.nodePos(i,scratch);
  return nav.nodesInRadius(scratch,NEST_CLEARANCE).every(n=>dryFloor(nav,n));
}

function siteCache(nav) {
  const field = nav.march;
  if (!field) return null;
  let cache = nav._nestSites;
  if (!cache || cache.revision !== nav.revision) {
    cache = nav._nestSites = { revision: nav.revision, candidates: [], clear: new Map(), wetDistance: new Float64Array(nav.n).fill(-1),flank:new Uint8Array(nav.n) };
    // Multi-source expansion from raised terrain, once per graph revision.
    // Favour clearings beside useful hills without ever relaxing route safety.
    const queue=[];for(let i=0;i<nav.n;i++)if(!nav.layer?.[i]&&nav.baseHeight[i]>8+(nav.floorDatum||0)){cache.flank[i]=1;queue.push(i);}
    const reach=Math.max(2,Math.min(10,Math.ceil(18/(nav.spacing||3))));
    for(let k=0;k<queue.length;k++){const a=queue[k],step=cache.flank[a];if(step>=reach)continue;for(let e=nav.adjOff[a];e<nav.adjOff[a+1];e++){const b=nav.adj[e];if(!cache.flank[b]&&!nav.layer?.[b]){cache.flank[b]=step+1;queue.push(b);}}}
    for (let i = 0; i < nav.n; i++) {
      if (!dryFloor(nav, i)) continue;
      let safe = true;
      for (let e = nav.adjOff[i]; e < nav.adjOff[i + 1]; e++) {
        if (!dryFloor(nav, nav.adj[e]) || !Number.isFinite(nav.cost[e])) { safe = false; break; }
      }
      if (safe) cache.candidates.push(i);
    }
    // Score the whole approach, not just its dry clearing. Otherwise a nest
    // on an offshore meadow can win while its creatures spend most of their
    // journey swimming. Memoize the existing acyclic flow once per revision;
    // shared tails are measured once, without another navigation solve.
    const wet = cache.wetDistance, trail = [];
    wet[nav.heartNode] = 0;
    for (const start of cache.candidates) {
      trail.length = 0; let node = start;
      while (node >= 0 && wet[node] < 0 && trail.length < nav.n) {
        trail.push(node); node = field.next[node];
      }
      for (let k = trail.length - 1; k >= 0; k--) {
        const a = trail[k], b = field.next[a];
        wet[a] = b < 0 || wet[b] < 0 ? Infinity : wet[b] +
          ((nav.waterDepth ? nav.waterDepth[a] > 0 || nav.waterDepth[b] > 0 : nav.baseHeight[a] < .18 || nav.baseHeight[b] < .18) ? Math.max(0, field.dist[a] - field.dist[b]) : 0);
      }
    }
  }
  return cache;
}

function clearing(nav, cache, i, scratch) {
  nav.nodePos(i, scratch);
  if (!cache.clear.has(i)) cache.clear.set(i, nav.nodesInRadius(scratch, NEST_CLEARANCE).every(n => dryFloor(nav, n)));
  return cache.clear.get(i);
}

// Inspector enumerates individually legal sites using the same predicates as
// spawning. Separation is a constraint between occupied nests, not habitat.
// A generator lets the inspector yield between chunks without another solve.
export function* availableNestSites(nav, centre, scratch) {
  const cache = siteCache(nav); if (!cache) return;
  nav.nodePos(nav.heartNode, scratch);
  const radius = scratch.length() - nav.height[nav.heartNode];
  for (const i of cache.candidates) {
    if (!Number.isFinite(nav.march.dist[i])) continue;
    nav.nodeDir(i, scratch);
    if (Math.acos(Math.max(-1, Math.min(1, scratch.dot(centre)))) * radius < 10) continue;
    if (clearing(nav, cache, i, scratch)) yield i;
  }
}

export function nestSite(nav, original, centre, theta, used, scratch, wave = 1) {
  const field = nav.march, cache = siteCache(nav);
  if (!cache) return -1;
  nav.nodeDir(original, scratch);
  const ox = scratch.x, oy = scratch.y, oz = scratch.z;
  nav.nodePos(nav.heartNode, scratch);
  const radius = scratch.length() - nav.height[nav.heartNode];
  const outward = Math.min(radius * 1.4, 12 + Math.max(0, wave - 1) * 7);
  const target = Math.max(theta * radius * 1.12, outward);
  let chosen = -1, best = Infinity;
  for (const i of cache.candidates) {
    if (used.has(i) || !Number.isFinite(field.dist[i])) continue;
    nav.nodeDir(i, scratch);
    const angle = Math.acos(Math.max(-1, Math.min(1, scratch.dot(centre))));
    const arc = angle * radius;
    if (arc < 10) continue;
    // Prefer the requested azimuth near the frontier, but a shorter healthy
    // approach inside expanded territory beats a remote ocean detour.
    const bearing = Math.acos(Math.max(-1, Math.min(1, scratch.x * ox + scratch.y * oy + scratch.z * oz)));
    const tactical=cache.flank[i]>1?Math.max(0,7-cache.flank[i]*.6):0;
    const score = Math.abs(arc - target) + Math.max(0, outward * .8 - arc) * 6 + bearing * radius * .08 + field.dist[i] * .1 + cache.wetDistance[i] * 2 + Math.max(0,field.dist[i]-Math.max(NEST_ROUTE_LIMIT,target*2.5))*4-tactical;
    if (score >= best) continue;
    nav.nodePos(i, scratch);
    let separate = true;
    for (const previous of used) {
      const x = scratch.x - nav.pos[previous * 3], y = scratch.y - nav.pos[previous * 3 + 1], z = scratch.z - nav.pos[previous * 3 + 2];
      if (x * x + y * y + z * z < NEST_SEPARATION ** 2) { separate = false; break; }
    }
    if (!separate) continue;
    if (!clearing(nav, cache, i, scratch)) continue;
    chosen = i; best = score;
  }
  // The preferred short approach is a score, not a hard world boundary.
  // Expanded bases and legitimate tower detours may require a longer route.
  return chosen;
}
