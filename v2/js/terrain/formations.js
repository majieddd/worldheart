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
  const entries = Object.entries(settings.weights), total = entries.reduce((s, [, w]) => s + w, 0);
  const modules = [], rotate = rng() * TAU, tilt = rng() * TAU, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + .5) / count, r = Math.sqrt(1 - y * y), az = i * 2.399963229728653 + rotate;
    const jitter = settings.spacing / radius * .18;
    const v = norm([Math.cos(az) * r + (rng() - .5) * jitter, y + (rng() - .5) * jitter, Math.sin(az) * r + (rng() - .5) * jitter]);
    const authored = overridesById.get(i), dir = authored?.dir ? norm(authored.dir) : [v[0], v[1] * ct - v[2] * st, v[1] * st + v[2] * ct];
    let pick = rng() * total, type = entries.at(-1)[0];
    for (const [key, weight] of entries) { pick -= weight; if (pick < 0) { type = key; break; } }
    if (authored?.type) type = authored.type;
    const a = norm(cross(dir, Math.abs(dir[1]) < .93 ? [0, 1, 0] : [1, 0, 0])), b = cross(dir, a);
    const angle = rng() * TAU, ca = Math.cos(angle), sa = Math.sin(angle), recipe = LANDFORM_RECIPES[type];
    modules.push({ id: i, type, dir, axis: a.map((v, k) => v * ca + b[k] * sa), side: a.map((v, k) => b[k] * ca - v * sa),
      height: profile[recipe.relief] * recipe.gain * (.78 + rng() * .44), phase: rng() * TAU,
      size: .78 + rng() * .44, roughness: recipe.roughness * (.85 + rng() * .3) });
    const m = modules.at(-1);
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

  // Lazy, conservative spatial shortlist. At any point in a bucket, each of
  // the nearest two sites lies within d2(center) + two bucket half-diagonals.
  // The exact search therefore agrees with a full scan, including bucket edges.
  const buckets = new Array(GRID ** 3), halfDiagonal = Math.sqrt(3) / GRID;
  function candidates(x, y, z) {
    const key = bucketKey(x, y, z);
    if (buckets[key]) return buckets[key];
    const c = [x, y, z].map(v => -1 + (bucketAxis(v) + .5) * 2 / GRID);
    const distances = modules.map(m => Math.hypot(m.dir[0] - c[0], m.dir[1] - c[1], m.dir[2] - c[2]));
    const limit = [...distances].sort((a, b) => a - b)[1] + 2 * halfDiagonal + 1e-9;
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
      if (d < first) { second = first; neighbour = owner; first = d; owner = m; }
      else if (d < second) { second = d; neighbour = m; }
    }
    const m = owner;
    // This continuous distance difference is zero on ALL region boundaries.
    // Width is conservative near triple junctions, where the valley widens.
    const edge = (Math.sqrt(second) - Math.sqrt(first)) * radius * .5;
    // Shared half-width avoids a crease when the second-nearest region changes.
    const valley = settings.valley;
    const rise = clamp((edge - valley) / Math.max(8, m.extent * .94 - valley), 0, 1);
    // Rounded feet meet a pointed crest. A cubic easing all the way to one
    // flattened tall summits into blunt pillars, even with broad footprints.
    const shoulder = smoothstep(0, .3, rise) * Math.pow(rise, 1.35);
    let h = 0, entrance = 1;
    if (shoulder > 0) {
      const u = (x * m.axis[0] + y * m.axis[1] + z * m.axis[2]) * radius;
      const v = (x * m.side[0] + y * m.side[1] + z * m.side[2]) * radius;
      const extent = m.extent * m.size, bend = Math.sin(u / extent * 2.6 + m.phase) * extent * .16;
      const channel = Math.abs(v + bend);
      const folds = .5 + .5 * Math.cos(u / extent * 8 + Math.sin(v / extent * 3) + m.phase);
      if (m.type === 'range') {
        const spine = 1 - smoothstep(extent * .1, extent * .88, channel);
        h = m.height * shoulder * (.38 + .62 * spine) * (1 - m.roughness + m.roughness * folds * folds);
      } else if (m.type === 'canyon') {
        entrance = smoothstep(valley * .8, Math.max(valley + 8, extent * .55), channel);
        h = m.height * shoulder * entrance * (1 - m.roughness + m.roughness * folds);
      } else if (m.type === 'basin') {
        // A bowl with two open, gently turning outlets to the shared valleys.
        const bowl = smoothstep(extent * .2, extent * .65, Math.hypot(u, v));
        entrance = smoothstep(valley, valley + extent * .25, channel);
        h = m.height * shoulder * bowl * entrance;
      } else if (m.type === 'mesa') {
        // Broad buildable benches, eroded shoulders, a pass through one flank.
        entrance = smoothstep(valley, valley + extent * .24, Math.abs(v + extent * .27));
        h = m.height * smoothstep(0, .66, shoulder) * entrance;
      } else {
        h = m.height * shoulder * (.45 + .55 * folds);
      }
    }
    if (out) Object.assign(out, { id: m.id, type: m.type, neighbour: neighbour.id, edge, valley, relief: h,
      candidates: list.length, version: LANDFORM_VERSION });
    return h;
  }
  return {
    version: LANDFORM_VERSION, seed, radius, settings,
    modules, height: (x, y, z) => evaluate(x, y, z),
    inspect(x, y, z, exhaustive = false) { const out = {}; evaluate(x, y, z, out, exhaustive); return out; },
    manifest() { return { version: LANDFORM_VERSION, seed, radius, mix, settings, modules }; },
  };
}
