import { makeNoise3D, mulberry32, smoothstep } from '../noise.js';
import { LANDFORM_VERSION, LANDFORM_RECIPES, landformSettings } from './recipes.js';

const GRID = 20, TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const bucketAxis = x => clamp(Math.floor((x + 1) * GRID / 2), 0, GRID - 1);
const bucketKey = (x, y, z) => (bucketAxis(x) * GRID + bucketAxis(y)) * GRID + bucketAxis(z);

// Each seed owns irregular spherical regions. Their shared edges form a
// connected valley network before relief/detail is added. Every group blends
// to the same floor there; canyons and basins add entrances inside their group.
// No tiles, mesh seams, latitude wrap or hidden navigation-only tunnels.
export function createFormationField(seed, radius, profile, mix = 'varied', overrides = {}) {
  if (!Number.isInteger(seed) || !Number.isFinite(radius) || radius < 30) throw new Error('Invalid formation seed/radius');
  if (![profile.range, profile.canyon].every(x => Number.isFinite(x) && x >= 0 && x <= 160)) throw new Error('Invalid formation relief');
  const settings = landformSettings(mix, overrides), rng = mulberry32(seed ^ 0x62e2ac19);
  const count = Math.max(12, Math.round(4 * Math.PI * radius * radius / settings.spacing ** 2));
  if (settings.groups.some(g => g.id >= count)) throw new Error('Authored group id is outside this layout');
  const overridesById = new Map(settings.groups.map(g => [g.id, g]));
  const entries = Object.entries(settings.weights), geology = makeNoise3D(seed ^ 0x42aef103);
  const modules = [], rotate = rng() * TAU, tilt = rng() * TAU, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + .5) / count, r = Math.sqrt(1 - y * y), az = i * 2.399963229728653 + rotate;
    const jitter = settings.spacing / radius * .18;
    const v = norm([Math.cos(az) * r + (rng() - .5) * jitter, y + (rng() - .5) * jitter, Math.sin(az) * r + (rng() - .5) * jitter]);
    const authored = overridesById.get(i), dir = authored?.dir ? norm(authored.dir) : [v[0], v[1] * ct - v[2] * st, v[1] * st + v[2] * ct];
    // Broad geological provinces bias neighboring sites toward related forms.
    // They still contain contrasting families, rather than one global recipe.
    const province = geology(dir[0] * 2.4 + 17, dir[1] * 2.4, dir[2] * 2.4);
    const weightAt = (key, weight) => weight * (key === 'range' ? 1 + province * .7
      : key === 'hills' || key === 'basin' ? 1 - province * .5 : 1 + Math.abs(province) * .2);
    const total = entries.reduce((sum, [key, weight]) => sum + weightAt(key, weight), 0);
    let pick = rng() * total, type = entries.at(-1)[0];
    for (const [key, weight] of entries) { pick -= weightAt(key, weight); if (pick < 0) { type = key; break; } }
    if (authored?.type) type = authored.type;
    const a = norm(cross(dir, Math.abs(dir[1]) < .93 ? [0, 1, 0] : [1, 0, 0])), b = cross(dir, a);
    const angle = rng() * TAU, ca = Math.cos(angle), sa = Math.sin(angle), recipe = LANDFORM_RECIPES[type];
    modules.push({ id: i, type, dir, axis: a.map((v, k) => v * ca + b[k] * sa), side: a.map((v, k) => b[k] * ca - v * sa),
      height: profile[recipe.relief] * recipe.gain * (.78 + rng() * .44), phase: rng() * TAU,
      size: .78 + rng() * .44, roughness: recipe.roughness * (.85 + rng() * .3), province });
    const m = modules.at(-1);
    // Shape parameters derive from the existing phase, not new random draws.
    // Adding a silhouette detail does not reroll every subsequent region.
    m.variant = (Math.floor(m.phase * 1000) % 3);
    if (type === 'range') m.height *= mix === 'alpine' ? .87 + .13 * province : .75 + .25 * province;
    if (authored?.height !== undefined) m.height = authored.height;
    if (authored?.size !== undefined) m.size = authored.size;
    if (authored?.disabled) m.height = 0;
  }
  // Distances to neighbours give each group a measured footprint; changing
  // spacing changes group size, independently of its height/depth and biome.
  for (const m of modules) {
    const near = modules.filter(n => n !== m).map(n => Math.sqrt(Math.max(0, 2 - 2 * dot(m.dir, n.dir))) * radius).sort((a, b) => a - b);
    m.extent = near[0] * .5;
    if (m.extent < settings.valley + 8) throw new Error('Authored groups overlap or leave no shoulder space');
  }

  // Place 7-12 remnants before sampling. Pairwise measured footprints leave
  // at least 5.5 m between feet, so extra pillars cannot close their paths.
  for (const m of modules) if (m.type === 'buttes') {
    const count = 7 + Math.floor(m.phase * 997) % 6, extent = m.extent * Math.min(m.size, 1);
    m.pillars = Array.from({length:count}, (_,k) => {
      const inner = k < 3, n = inner ? 3 : count - 3, index = inner ? k : k - 3;
      const angle = index * TAU / n + m.phase + (inner ? .45 : 0), offset = extent * (inner ? .17 : .58);
      return {u:Math.cos(angle)*offset, v:Math.sin(angle)*offset, gain:.7+.1*(k%3)};
    });
    for (const p of m.pillars) {
      const separation = Math.min(...m.pillars.filter(q=>p!==q).map(q=>Math.hypot(p.u-q.u,p.v-q.v)));
      p.width = Math.max(.5, Math.min(extent*.14, (separation-5.5)/2));
    }
  }

  // Separate cells made every range taper into an isolated mound. Join a few
  // adjacent range cells into one long territory. Its OUTER border remains a
  // connected valley, while a shared spine crosses its internal cell seams.
  // Bounded chains avoid closed mountain rings trapping a floor component.
  const groupOf = modules.map(m => m.id), members = modules.map(m => [m.id]);
  const links = [], degree = new Uint8Array(count), edges = [];
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
    const a = modules[i], b = modules[j];
    // Explicit authoring keeps its own size/height/exclusion contract.
    if (overridesById.has(i) || overridesById.has(j) || a.type !== 'range' || b.type !== 'range' || !a.height || !b.height || (i + j) % 5 === 0) continue;
    const distance = Math.sqrt(Math.max(0, 2 - 2 * dot(a.dir, b.dir))) * radius;
    if (distance < (a.extent + b.extent) * 1.3) edges.push({i, j, distance});
  }
  edges.sort((a, b) => a.distance - b.distance || a.i - b.i || a.j - b.j);
  for (const {i, j} of edges) {
    const a = groupOf[i], b = groupOf[j];
    if (a === b || degree[i] >= 2 || degree[j] >= 2 || members[a].length + members[b].length > 3) continue;
    const extendsChain = (end, next) => {
      const old = links.find(e => e.includes(end));
      if (!old) return true;
      const prior = old[0] === end ? old[1] : old[0], d = modules[end].dir;
      const tangent = k => norm(modules[k].dir.map((v, axis) => v - d[axis] * dot(modules[k].dir, d)));
      return dot(tangent(prior), tangent(next)) < -.15;
    };
    if (!extendsChain(i, j) || !extendsChain(j, i)) continue;
    links.push([i, j]); degree[i]++; degree[j]++;
    for (const id of members[b]) { groupOf[id] = a; members[a].push(id); }
    members[b] = [];
  }
  const chains = members.flatMap((ids, id) => ids.length > 1 ? [{ id, members: ids,
    links: links.filter(([a]) => groupOf[a] === id),
    height: Math.max(...ids.map(i => modules[i].height)),
    extent: Math.min(...ids.map(i => modules[i].extent)),
    roughness: Math.max(...ids.map(i => modules[i].roughness)),
  }] : []);
  const chainOf = new Map(chains.map(c => [c.id, c]));

  // Lazy, conservative spatial shortlist. At any point in a bucket, each of
  // the nearest two sites lies within d2(center) + two bucket half-diagonals.
  // The exact search therefore agrees with a full scan, including bucket edges.
  const buckets = new Array(GRID ** 3), halfDiagonal = Math.sqrt(3) / GRID;
  function candidates(x, y, z) {
    const key = bucketKey(x, y, z);
    if (buckets[key]) return buckets[key];
    const c = [x, y, z].map(v => -1 + (bucketAxis(v) + .5) * 2 / GRID);
    const distances = modules.map(m => Math.hypot(m.dir[0] - c[0], m.dir[1] - c[1], m.dir[2] - c[2]));
    // The runner-up must belong to another territory, not another member of
    // this mountain chain, or the shortlist would omit its true valley edge.
    const groupDistances = new Map();
    distances.forEach((d, i) => groupDistances.set(groupOf[i], Math.min(d, groupDistances.get(groupOf[i]) ?? Infinity)));
    const limit = [...groupDistances.values()].sort((a, b) => a - b)[1] + 2 * halfDiagonal + 1e-9;
    return buckets[key] = modules.filter((m, i) => distances[i] <= limit);
  }
  const warp = makeNoise3D(seed ^ 0x715fba93), amplitude = settings.spacing / radius * .065;
  function evaluate(x, y, z, out, exhaustive = false) {
    // Low-frequency domain bends make the shared valleys meander. The warp is
    // identical on both sides of a join, and leaves room for a full nest exit.
    const wx = x + warp(x * 4 + 17, y * 4, z * 4) * amplitude;
    const wy = y + warp(x * 4, y * 4 + 31, z * 4) * amplitude;
    const wz = z + warp(x * 4, y * 4, z * 4 + 53) * amplitude;
    const length = Math.hypot(wx, wy, wz); x = wx / length; y = wy / length; z = wz / length;
    let first = Infinity, second = Infinity, owner = null, neighbour = null;
    const list = exhaustive ? modules : candidates(x, y, z);
    for (const m of list) {
      const d = Math.max(0, 2 - 2 * (x * m.dir[0] + y * m.dir[1] + z * m.dir[2]));
      if (owner && groupOf[m.id] === groupOf[owner.id]) {
        if (d < first) { first = d; owner = m; }
        continue;
      }
      if (d < first) { second = first; neighbour = owner; first = d; owner = m; }
      else if (d < second) { second = d; neighbour = m; }
    }
    const m = owner, chain = chainOf.get(groupOf[m.id]);
    // This continuous distance difference is zero on ALL region boundaries.
    // Width is conservative near triple junctions, where the valley widens.
    const edge = (Math.sqrt(second) - Math.sqrt(first)) * radius * .5;
    // Shared half-width avoids a crease when the second-nearest region changes.
    const valley = settings.valley;
    const rise = clamp((edge - valley) / Math.max(8, (chain?.extent ?? m.extent) * .94 - valley), 0, 1);
    // Rounded feet meet a pointed crest. A cubic easing all the way to one
    // flattened tall summits into blunt pillars, even with broad footprints.
    const shoulder = smoothstep(0, .3, rise) * Math.pow(rise, 1.35);
    let h = 0, entrance = 1, incision = 0;
    if (shoulder > 0) {
      const u = (x * m.axis[0] + y * m.axis[1] + z * m.axis[2]) * radius;
      const v = (x * m.side[0] + y * m.side[1] + z * m.side[2]) * radius;
      const extent = m.extent * m.size, bend = Math.sin(u / extent * 2.6 + m.phase) * extent * .16;
      const channel = Math.abs(v + bend);
      const folds = .5 + .5 * Math.cos(u / extent * 8 + Math.sin(v / extent * 3) + m.phase);
      if (chain) {
        let distance = Infinity;
        for (const [from, to] of chain.links) {
          const a = modules[from].dir, b = modules[to].dir;
          const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
          const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
          const sx = a[0] + t * dx, sy = a[1] + t * dy, sz = a[2] + t * dz;
          distance = Math.min(distance, Math.sqrt(Math.max(0, 2 - 2 * (x * sx + y * sy + z * sz) / Math.hypot(sx, sy, sz))) * radius);
        }
        const spine = Math.pow(clamp(1 - distance / (chain.extent * .8), 0, 1), 1.4);
        const first = modules[chain.members[0]], last = modules[chain.members.at(-1)];
        const along = (x * (last.dir[0] - first.dir[0]) + y * (last.dir[1] - first.dir[1]) + z * (last.dir[2] - first.dir[2])) * radius;
        const fold = .5 + .5 * Math.cos(along / chain.extent * 13 + first.phase + warp(x * 9, y * 9, z * 9));
        // A third territory can narrow the middle of a long ridge. Give its
        // connecting saddle a firmer shoulder without closing the outer floor.
        const chainShoulder = smoothstep(0, .3, rise) * rise;
        h = chain.height * chainShoulder * (.25 + .75 * spine) * (1 - chain.roughness + chain.roughness * fold * fold);
      } else if (m.type === 'range') {
        const spine = Math.pow(clamp(1 - channel / (extent * .88), 0, 1), 1.4);
        h = m.height * shoulder * (.38 + .62 * spine) * (1 - m.roughness + m.roughness * folds * folds);
      } else if (m.type === 'canyon') {
        entrance = smoothstep(valley * .8, Math.max(valley + 8, extent * .55), channel);
        const upland = m.height * shoulder * (1 - m.roughness + m.roughness * folds);
        incision = upland * (1 - entrance); h = upland - incision;
      } else if (m.type === 'basin') {
        // A bowl with two open, gently turning outlets to the shared valleys.
        const bowl = smoothstep(extent * .2, extent * .65, Math.hypot(u, v));
        entrance = smoothstep(valley, valley + extent * .25, channel);
        h = m.height * shoulder * bowl * entrance;
      } else if (m.type === 'mesa') {
        // Broad buildable benches, eroded shoulders, a pass through one flank.
        entrance = smoothstep(valley, valley + extent * .24, Math.abs(v + extent * .27));
        h = m.height * smoothstep(0, .66, shoulder) * entrance;
      } else if (m.type === 'plateau') {
        // Asymmetric two/three-tier shelves, scalloped flanks and one broad
        // ramp. Bench interiors stay flat enough to support emplacements.
        const scallop = Math.sin(u / extent * 7 + m.phase) * Math.sin(v / extent * 5) * .055;
        const shelf = rise + scallop * smoothstep(0, .2, rise);
        const upper = m.variant === 0 ? .69 : .79;
        const tiers = .46 * smoothstep(.04, .25, shelf) + .34 * smoothstep(.43, .58, shelf)
          + .2 * smoothstep(upper, upper + .1, shelf);
        const ramp = (1 - smoothstep(.14, .38, Math.abs(v / extent + .2))) * smoothstep(-.2, .4, u / extent);
        const upland = m.height * (tiers * (1 - ramp) + rise * ramp);
        const outlet = 1 - smoothstep(valley * .65, valley + extent * .12, Math.abs(v + bend - extent * .57));
        incision = upland * outlet; h = upland - incision;
      } else if (m.type === 'ravine') {
        // Variable-width, asymmetric erosion with one to three tributaries.
        // All bottoms connect to an outlet instead of ending in a sealed pit.
        let drain = channel;
        for (let branch = 0; branch < 3 + m.variant; branch++) {
          const sign = branch % 2 ? -1 : 1, join = (branch - 1.5) * extent * .32;
          const tributary = Math.abs(v - sign * (u - join) * (.65 + .08 * branch) + bend * .6)
            + Math.max(0, join - u) * 1.2;
          drain = Math.min(drain, tributary);
        }
        const bank = 1 - m.roughness + m.roughness * (.5 + .5 * Math.sin(u / extent * 4 + v / extent + m.phase));
        const upland = m.height * smoothstep(0, .3, rise) * bank;
        const width = valley * .75 + extent * (.025 + .025 * Math.sin(u / extent * 5 + m.phase));
        const cut = 1 - smoothstep(width, width + extent * (.14 + .06 * smoothstep(-extent, extent, v)), drain);
        incision = upland * cut; h = upland - incision;
      } else if (m.type === 'gorge') {
        // A negative incision through the planet, with stepped inner walls
        // and two long ramps to the shared floor. Water is a separate field.
        const width = 4.5 + extent * .035;
        const winding = Math.abs(v + Math.sin(u/extent*4.4+m.phase)*extent*.28);
        const cut = 1 - smoothstep(width, width + extent * .3, winding);
        const strata = .68 * cut + .32 * smoothstep(.32,.68,cut);
        // Depth follows available ramp length. An arbitrarily deep small cell
        // makes a sealed pit whose exits exceed the floor traversal grade.
        const depth = Math.min(m.height, m.extent * .24);
        incision = depth * smoothstep(0,.95,rise) * strata;
        h = -incision;
      } else if (m.type === 'escarpment') {
        // Three long lateral benches form a staircase across one flank.
        // A diagonal ramp links them; the other side is an eroded scarp.
        const across = clamp(.5 + v / (extent * 1.6),0,1);
        const tiers = .3 + .33*smoothstep(.27,.36,across) + .37*smoothstep(.6,.7,across);
        const ramp = 1-smoothstep(.08,.25,Math.abs(u/extent-v/extent*.65));
        h = m.height * smoothstep(0,.38,rise) * (tiers*(1-ramp)+(.25+.75*across)*ramp);
      } else if (m.type === 'crevice') {
        // A long fault crosses the whole cell, including its outer lowlands.
        // The wider dry bottom is a passage, not a decorative flooded crack.
        const fault = Math.abs(v + Math.sin(u / extent * 2 + m.phase) * extent * .13);
        const branch = Math.abs(v + u * .38 - extent * .18) + Math.max(0, -u) * .7;
        const cut = 1 - smoothstep(3.2, Math.max(9, extent * .28), Math.min(fault, branch));
        const upland = m.height * smoothstep(0, .62, shoulder);
        incision = (upland + m.height * .25 * smoothstep(0, .95, rise)) * cut;
        h = upland - incision;
      } else if (m.type === 'buttes') {
        // Several independent remnants, not a single mesa with a new name.
        // Irregular gaps between them are real ground, usable by every mover.
        let cluster = 0;
        for (const p of m.pillars) {
          const d = Math.hypot(u-p.u,v-p.v);
          const remnant = 1-smoothstep(p.width*.38,p.width,d);
          cluster = Math.max(cluster,remnant*p.gain);
        }
        h = m.height * smoothstep(0, .28, rise) * cluster;
      } else if (m.type === 'caldera') {
        // Irregular rim around a broad floor. A permanent breach connects the
        // interior to the exterior, including on dry volcanic planets.
        const radial = Math.hypot(u, v), angle = Math.atan2(v, u);
        const rim = extent * (.48 + .055 * Math.sin(angle * 3 + m.phase));
        const wall = Math.pow(Math.max(0, 1 - Math.abs(radial - rim) / (extent * .31)), 1.15);
        const breach = smoothstep(valley * .75, valley + extent * .13, Math.abs(v + bend * .35));
        h = m.height * smoothstep(0, .33, rise) * wall * (u > 0 ? breach : 1);
        incision = m.height * Math.max(0,1-radial/(rim*.7)) * smoothstep(0,.25,rise);
      } else if (m.type === 'dunes') {
        // Parallel wind-shaped crests, with a long windward slope and short
        // slip face. Low relief remains distinct from rocky mountain spines.
        const cycle = u / extent * (2 + m.variant * .22) + .18 * Math.sin(v / extent * 3 + m.phase) + m.phase;
        const t = cycle - Math.floor(cycle);
        const crest = t < .76 ? smoothstep(0, .76, t) : 1 - smoothstep(.76, 1, t);
        h = m.height * smoothstep(0, .4, rise) * crest;
      } else if (m.type === 'valley') {
        // A broad U-shaped trough between unequal glacial shoulders, wider
        // and smoother at its floor than the narrow V-shaped ravine family.
        const width = extent * (.25 + .035 * Math.sin(u / extent * 3 + m.phase));
        const wall = smoothstep(width, width + extent * .4, channel);
        const upland = m.height * smoothstep(0, .56, shoulder) * (.88 + .12 * Math.sin(u / extent * 4 + m.phase));
        incision = upland * (1 - wall); h = upland - incision;
      } else {
        // The classic field's ridged-noise hills create irregular low walls
        // and saddles. Keep that smaller scale beside the major peaks.
        const roll = 1 - Math.abs(geology(x * 11 + 11, y * 11, z * 11));
        h = m.height * shoulder * (.25 + .75 * roll * roll * roll);
      }
    }
    if (out) Object.assign(out, { id: m.id, group: groupOf[m.id], type: m.type, neighbour: neighbour.id, edge, valley, relief: h,
      incision, province: m.province, candidates: list.length, version: LANDFORM_VERSION });
    return h;
  }
  return {
    version: LANDFORM_VERSION, seed, radius, settings,
    modules, height: (x, y, z) => evaluate(x, y, z),
    inspect(x, y, z, exhaustive = false) { const out = {}; evaluate(x, y, z, out, exhaustive); return out; },
    manifest() { return { version: LANDFORM_VERSION, seed, radius, mix, settings, modules, chains }; },
  };
}
