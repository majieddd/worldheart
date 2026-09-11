// Real worldgen plus isolated movement from newly selected physical nests.
// This is a route fixture, with no combat or campaign completion claim.
import { registerHooks } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const option = key => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const source = resolve(option('source-dir') || '.'), seed = Number(option('seed')) || 12345;
const seconds=Number(option('seconds')||500);if(!Number.isFinite(seconds)||seconds<1||seconds>3600)throw Error('Invalid route time budget');
const index = Number(option('planet'));
if (index) {
  const moduleUrl = path => pathToFileURL(resolve(source, path)).href;
  const { planetDefinition } = await import(moduleUrl('js/run/planets.js'));
  const definition = planetDefinition(index, seed);
  globalThis.location = { search: `?map=ninetynine&terrain=${definition.terrain}&seed=${definition.seed}` };
  globalThis.matchMedia = () => ({ matches: false });
  registerHooks({ resolve(spec, context, next) {
    return spec === 'three' ? { url: moduleUrl('lib/three.module.min.js'), shortCircuit: true } : next(spec, context);
  } });
  const THREE = await import(moduleUrl('lib/three.module.min.js'));
  const { CONFIG } = await import(moduleUrl('js/config.js'));
  const world = await import(moduleUrl('js/world.js'));
  const { NavGraph } = await import(moduleUrl('js/nav.js'));
  const { EnemyManager } = await import(moduleUrl('js/enemies.js'));
  const { nestSite, NEST_CLEARANCE, NEST_SEPARATION, NEST_ROUTE_LIMIT } = await import(moduleUrl('js/nest-sites.js'));
  const { frontierTheta } = await import(moduleUrl('js/run/schedule.js'));
  world.initTerrainField(CONFIG.seed);
  const nav = new NavGraph(); nav.build();
  const scratch = new THREE.Vector3(), records = [];
  // Seventeen sources model one new nest per wave plus two milestone extras.
  // Include an unexpanded run, so upgrading the heart is never required for
  // the wave schedule to have room to create its sources.
  for (const rings of [0, 3, 14]) {
    const theta = frontierTheta(rings), used = new Set(), sites = [];
    for (let i = 0; i < 17; i++) {
      let node = nestSite(nav, nav.portalNodes[i % nav.portalNodes.length], nav.fieldCenter, theta, used, scratch);
      for (const alternative of nav.portalNodes) if (node < 0) node = nestSite(nav, alternative, nav.fieldCenter, theta, used, scratch);
      const valid = node >= 0 && !used.has(node) && nav.walk[node] && !nav.block[node]
        && nav.airWalk[node] && nav.march.floorReach[node] && nav.march.dist[node]<=NEST_ROUTE_LIMIT
        && Number.isFinite(nav.airDist[node])
        && nav.nodesInRadius(nav.nodePos(node,scratch),NEST_CLEARANCE).every(i=>!nav.block[i]&&nav.march.floorReach[i]&&nav.baseHeight[i]>=.18&&nav.baseHeight[i]<=1.5)
        && [...used].every(i=>nav.nodePos(i,scratch).distanceTo(nav.nodePos(node,new THREE.Vector3()))>=NEST_SEPARATION);
      sites.push({ node, valid: !!valid, height:nav.baseHeight[node], routeCost:nav.march.dist[node] }); if (node >= 0) used.add(node);
    }
    const enemies = new EnemyManager(new THREE.Scene(), nav); enemies._render = () => {}; enemies.onLeak = () => {};
    enemies.setHeart(world.surfacePoint(nav.nodeDir(nav.heartNode, scratch), new THREE.Vector3()));
    for (const site of sites) if (site.valid) for (const type of ['husk', 'mite', 'wisp']) enemies.spawn(type, site.node, 1);
    const spawned = enemies.active.length; let steps = 0, ceilingViolation = false, floorViolation=false;const floorLocked=new Set();
    for (; steps < seconds*30 && enemies.active.length; steps++) {
      enemies.update(1 / 30);
      for (const e of enemies.active){
        if (e.type.flying && world.terrainHeight(e.dir.x, e.dir.y, e.dir.z, false) + e.alt > world.FLIGHT_CEILING + .01) ceilingViolation = true;
        if(!e.type.flying&&nav.march){if(nav.march.floorReach[e.node])floorLocked.add(e.id);else if(floorLocked.has(e.id))floorViolation=true;}
      }
    }
    const stranded = enemies.active.map(e => ({ type: e.typeKey, node: e.node }));
    records.push({ rings, sites, spawned, arrived: spawned - stranded.length, seconds: steps / 30, ceilingViolation, floorViolation, stranded,
      pass: sites.every(s => s.valid) && spawned === sites.length * 3 && !stranded.length && !ceilingViolation && !floorViolation });
  }
  const result = { index, name: definition.name, terrain: definition.terrain, requestedSeed: definition.seed, effectiveSeed: CONFIG.seed,
    source, originalPortalCount: nav.portalNodes.length, records, pass: records.every(r => r.pass) };
  console.log(JSON.stringify(result)); if (!result.pass) process.exitCode = 1;
} else {
  const out = resolve(process.argv[2] || 'artifacts/nest-nav'); mkdirSync(out, { recursive: true });
  const queue = (option('planets') || '1,2,3,4,33,34,66,67,99').split(',').map(Number), results = [];
  const requested = [...queue], run = promisify(execFile);
  async function worker() {
    while (queue.length) {
      const i = queue.shift(); let result;
      try {
        const r = await run(process.execPath, [resolve('tools/nest-nav-check.mjs'), `--planet=${i}`, `--seed=${seed}`, `--source-dir=${source}`,`--seconds=${seconds}`],
          { timeout: 300000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
        result = JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
      } catch (error) {
        try { result = JSON.parse(error.stdout.trim().split(/\r?\n/).at(-1)); }
        catch { result = { index: i, pass: false, error: String(error), stderr: error.stderr }; }
      }
      results.push(result); writeFileSync(resolve(out, `planet-${i}.json`), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify({ index: i, pass: result.pass, arrived: result.records?.reduce((s, r) => s + r.arrived, 0) }));
    }
  }
  await Promise.all([worker(), worker()]); results.sort((a, b) => a.index - b.index);
  const report = { scope: 'Requested real-worldgen planet definitions, physical nest sites and isolated enemy traversal; not combat or full-campaign completion', source, seed, requested, results,
    pass: results.length === requested.length && results.every(r => r.pass) };
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n'); if (!report.pass) process.exitCode = 1;
}
