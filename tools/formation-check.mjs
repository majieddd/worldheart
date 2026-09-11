// Real graph/field inspection. This is an instrumented route and generation
// oracle, not combat balance or a natural campaign claim.
import { registerHooks } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { surveyBattlefield } from '../js/terrain/acceptance.js';
const option = key => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const profile = option('profile'), source = resolve(option('source-dir') || '.'), seed = Number(option('seed') || 12345);
if (profile) {
  const moduleUrl = path => pathToFileURL(resolve(source, path)).href;
  globalThis.location = { search: `?map=ninetynine&campaign=0&seed=${seed}&terrain=${profile}` };
  globalThis.matchMedia = () => ({ matches: false });
  registerHooks({ resolve(spec, context, next) { return spec === 'three' ? { url: moduleUrl('lib/three.module.min.js'), shortCircuit: true } : next(spec, context); } });
  const T = await import(moduleUrl('lib/three.module.min.js')), W = await import(moduleUrl('js/world.js'));
  const { CONFIG } = await import(moduleUrl('js/config.js')), { NavGraph } = await import(moduleUrl('js/nav.js'));
  const start = performance.now(); W.initTerrainField(CONFIG.seed); const nav = new NavGraph(); nav.build();
  const buildMs = performance.now() - start, p = new T.Vector3(), q = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
  let dry = 0, connected = 0, peak = 0, valleys = 0, inlandValleys = 0;
  const groups = new Set(), types = new Set(), biomes = {}, routes = [], exposed = {}, ecology = {};
  function inland(dir) {
    a.set(0, Math.abs(dir.y) < .93 ? 1 : 0, Math.abs(dir.y) < .93 ? 0 : 1);
    b.crossVectors(dir, a).normalize(); a.crossVectors(b, dir).normalize();
    for (let k = 0; k < 8; k++) {
      const angle = k * Math.PI / 4, arc = 12 / W.R;
      q.copy(dir).multiplyScalar(Math.cos(arc)).addScaledVector(a, Math.sin(arc) * Math.cos(angle)).addScaledVector(b, Math.sin(arc) * Math.sin(angle));
      if (W.terrainHeight(q.x, q.y, q.z, false) < .18) return false;
    }
    return true;
  }
  for (let i = 0; i < nav.n; i++) {
    peak = Math.max(peak, nav.height[i]);
    if (nav.floorWalk[i] && nav.baseHeight[i] >= .18) { dry++; if (nav.march.floorReach[i]) connected++; }
    if (i % 53) continue;
    nav.nodeDir(i, p);
    if (W.FORMATIONS) {
      const m = W.FORMATIONS.inspect(p.x, p.y, p.z); groups.add(m.id); types.add(m.type);
      const h=nav.baseHeight[i];
      if(h>.18&&m.relief>.25){
        const f=exposed[m.type]||={samples:0,peak:0};f.samples++;f.peak=Math.max(f.peak,h);
      }
      const biome=W.biomeAt?.(p,h);if(biome)ecology[biome]=(ecology[biome]||0)+1;
      const climate = W.climateAt(p, nav.baseHeight[i]); (biomes[m.type] ||= new Set()).add(climate);
      if (m.relief === 0 && nav.floorWalk[i] && nav.baseHeight[i] >= .18) { valleys++; if (inland(p)) inlandValleys++; }
    }
  }
  // Actual far physical sources exercise inland approaches, rather than
  // sampling only a short ring immediately outside the base.
  const { nestSite } = await import(moduleUrl('js/nest-sites.js')), used = new Set();
  for (let k = 0; k < 17; k++) {
    const node = nestSite(nav, nav.portalNodes[k % nav.portalNodes.length], nav.fieldCenter, .5, used, p);
    if (node >= 0) used.add(node);
    let i = node, steps = 0, samples = 0, land = 0, interior = 0;
    const seen = new Set();
    while (i >= 0 && i !== nav.heartNode && !seen.has(i) && steps < nav.n) {
      seen.add(i);
      if (steps % 12 === 0) {
        samples++; nav.nodeDir(i, p);
        if (nav.baseHeight[i] >= .18) { land++; if (inland(p)) interior++; }
      }
      steps++; i = nav.march.next[i];
    }
    routes.push({ node, steps, samples, dryFraction: land / samples, inlandFraction: interior / samples, arrived: i === nav.heartNode });
  }
  const checks = [
    { name: 'All seventeen remote physical sources trace to the heart', ok: routes.every(r => r.node >= 0 && r.arrived) },
    { name: 'Every sampled field height fits the terrain picking shell', ok: peak <= W.TERRAIN_TOP },
    { name: 'At least 95 percent of dry floor belongs to the heart floor network', ok: connected / dry >= .95 },
  ];
  if (W.FORMATIONS && profile === 'alpine') checks.push({ name: 'Giant-peaks battlefield contains a real major peak', ok: peak >= CONFIG.terrain.range * .65 });
  if (W.FORMATIONS) checks.push(
    { name: 'Active front contains multiple formation groups and types', ok: groups.size >= 3 && types.size >= 2 },
    { name: 'Connected valley samples include inland terrain away from shore', ok: inlandValleys >= 20 },
    { name: 'Most remote approach samples are inland, not coastal ribbons', ok: routes.reduce((s, r) => s + r.inlandFraction, 0) / routes.length >= .5 },
  );
  const certificate=W.FORMATIONS?surveyBattlefield(nav,W.FORMATIONS,W.terrainHeight,W.R,nav.fieldCenter,CONFIG.map.fieldTheta):null;
  if(certificate)checks.push({name:'Accepted field exposes three substantial families and connected terrain corridors',ok:certificate.pass});
  console.log(JSON.stringify({ profile, seed, effectiveSeed: CONFIG.seed, buildMs, attempts: nav.attempts, nodes: nav.n,
    peak, dryFloorConnected: connected / dry, groups: groups.size, types: [...types], biomes: Object.fromEntries(Object.entries(biomes).map(([k, v]) => [k, [...v]])),
    valleys, inlandValleys, routes, checks, exposed, ecology, certificate, climate:W.ECOLOGY?.manifest(), manifest: W.FORMATIONS?.manifest(), pass: checks.every(c => c.ok) }));
  if (checks.some(c => !c.ok)) process.exitCode = 1;
} else {
  const out = resolve(process.argv[2] || 'artifacts/formations'); mkdirSync(out, { recursive: true });
  const run = promisify(execFile), results = [];
  for (const p of ['varied', 'alpine', 'canyon', 'ocean']) {
    let r;
    try { r = await run(process.execPath, [resolve('tools/formation-check.mjs'), `--profile=${p}`, `--seed=${seed}`, `--source-dir=${source}`], { timeout: 300000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }); }
    catch (error) { r = error; }
    let result;
    try { result = JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1)); } catch { result = { profile: p, pass: false, error: String(r), stderr: r.stderr }; }
    results.push(result); writeFileSync(resolve(out, `${p}.json`), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ profile: p, pass: result.pass, buildMs: result.buildMs, attempts: result.attempts, types: result.types, inland: result.routes?.reduce((s, r) => s + r.inlandFraction, 0) / 17, failed: result.checks?.filter(c => !c.ok) }));
  }
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ scope: 'Real graph, source approach and recipe inspection; not combat', source, seed, results: results.map(({ manifest, ...rest }) => rest), pass: results.every(r => r.pass) }, null, 2) + '\n');
  if (results.some(r => !r.pass)) process.exitCode = 1;
}
