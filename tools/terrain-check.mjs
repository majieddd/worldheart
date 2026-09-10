// Terrain fixtures are deliberately instrumented; they do not certify an
// unforced expedition, combat balance or the feel of continuous input.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(process.env.WH_NODE_MODULES ? resolve(process.env.WH_NODE_MODULES, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const out = resolve(process.argv[2] || 'artifacts/m3'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const profile of (process.argv[3] ? [process.argv[3]] : ['varied', 'alpine', 'canyon', 'ocean'])) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), faults = [];
    page.on('pageerror', e => faults.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') faults.push(m.text()); });
    await page.addInitScript(() => { const raf = requestAnimationFrame.bind(window); window.__qaFramesEnabled = true; window.requestAnimationFrame = fn => raf(t => { if (window.__qaFramesEnabled) fn(t); }); });
    const started = Date.now();
    await page.goto(`http://127.0.0.1:8139/?map=ninetynine&seed=12345&terrain=${profile}`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(() => window.WH?.mode99 && document.getElementById('boot').classList.contains('done'), {}, { timeout: 180000 });
    const result = await page.evaluate(async () => {
      __qaFramesEnabled = false;
      const W = WH, n = W.nav, g = W.game, checks = [];
      const world = await import('/js/world.js'), { TOWER_TYPES } = await import('/js/towers.js');
      const check = (name, ok, actual) => checks.push({ name, ok: !!ok, actual });
      const v = W.heartPos.clone().normalize(), origin = v.clone(), hit = v.clone();
      const begin = document.getElementById('btn-begin').getBoundingClientRect();
      check('Begin remains visible at 720p', begin.bottom <= innerHeight && begin.top >= 0, { bottom: begin.bottom });
      let high = -Infinity, low = Infinity, peak = -1, water = 0, blockedAir = 0, raised = 0, wetNode = -1;
      const sites = {};
      for (let i = 0; i < n.n; i++) {
        const h = n.height[i];
        if (h > high) { high = h; peak = i; }
        low = Math.min(low, h);
        if (h < -0.7) water++;
        // Fine relief can put a visually wet sample on the swim hysteresis
        // boundary. Compare both inputs from the same deep gameplay surface.
        if (n.baseHeight[i] < -.85 && n.walk[i]) wetNode = i;
        if (!n.airWalk[i]) blockedAir++;
        if (n.walk[i] && h > 2.05) raised++;
        if (i % 11 !== 0 || h < 1.5) continue;
        n.nodeDir(i, v);
        const climate = world.climateAt(v);
        const type = climate === 'hot' ? 'mortar' : climate === 'cold' ? 'cryo' : 'bolt';
        if (!sites[climate] && world.terrainFootprint(v, g._fp(TOWER_TYPES[type]), type).ok) sites[climate] = { node: i, type, height: h };
      }
      n.nodeDir(peak, v); origin.copy(v).multiplyScalar(world.R + world.TERRAIN_TOP + 15);
      check('Highest peak can be picked', world.raycastTerrain(origin, v.clone().negate(), hit) && Math.abs(hit.length() - world.R - high) < 0.01, { high, hitHeight: hit.length() - world.R, shell: world.TERRAIN_TOP });
      const rig=W.rig,saved={lat:rig.lat,lon:rig.lon,dist:rig.dist};
      rig.lat=Math.asin(v.y);rig.lon=Math.atan2(v.x,v.z);rig.dist=rig.distMin;rig._placeCamera();
      const cameraDir=rig.camera.position.clone().normalize(),cameraGround=world.terrainHeight(cameraDir.x,cameraDir.y,cameraDir.z);
      check('Orbit focus and camera clearance follow the highest mountain',Math.abs(rig.focusRadius-world.R-high)<.02&&rig.camera.position.length()>=world.R+cameraGround+1.99,{focus:rig.focusRadius-world.R,clearance:rig.camera.position.length()-world.R-cameraGround});
      Object.assign(rig,saved);rig._placeCamera();
      check('Ground can be traversed above the former height cutoff', raised > 0, raised);
      check('All ground portals reach the base', n.portalNodes.every(i => Number.isFinite(n.dist[i])), n.portalNodes.map(i => n.dist[i]));
      check('All flyer portals reach the base on their own graph', n.portalNodes.every(i => Number.isFinite(n.airDist[i])), n.portalNodes.map(i => n.airDist[i]));
      check('Some extreme mountains exclude flyers', high < world.FLIGHT_CEILING || blockedAir > 0, { blockedAir, ceiling: world.FLIGHT_CEILING });
      for (const [climate, site] of Object.entries(sites)) {
        n.nodeDir(site.node, v);
        check(`${climate} stable raised terrain accepts its tower`, world.terrainFootprint(v, g._fp(TOWER_TYPES[site.type]), site.type).ok, site);
        if (climate !== 'neutral') check(`${climate} refuses a Bolt footprint`, !world.terrainFootprint(v, g._fp(TOWER_TYPES.bolt), 'bolt').ok);
      }
      document.getElementById('btn-begin').click(); g.paused = true;
      const a = W.allies.active.find(a => a.type.commander);
      if (wetNode >= 0) {
        n.nodeDir(wetNode, a.dir); a.fwd.addScaledVector(a.dir, -a.fwd.dot(a.dir)).normalize();
        a.swimming = false; a.moveNode = -1; W.allies._ground(a);
        const start = a.dir.clone(), heading = a.fwd.clone();
        W.allies.driveUnit(a, 1, 0, 0.05, 1); const ordinary = start.angleTo(a.dir);
        a.dir.copy(start); a.fwd.copy(heading); a.swimming = false; a.moveNode = -1; W.allies._ground(a);
        W.allies.driveUnit(a, 1, 0, 0.05, 1.45);
        const sprint = start.angleTo(a.dir);
        const probe=a.dir.clone().addScaledVector(a.fwd,.05/world.R).normalize();
        check('Water enters swimming and refuses sprint speed', a.swimming && ordinary > 0 && Math.abs(sprint / ordinary - 1) < 0.001, { ordinary, sprint, swimming: a.swimming, boundary: a.dir.angleTo(world.BATTLEFIELD.center), cap: world.BATTLEFIELD.theta, height: world.terrainHeight(a.dir.x,a.dir.y,a.dir.z,false), factor: world.surfaceTravel(a,a.fwd), masked: n._buildGraph.toString().includes('stitching'), to:world.terrainHeight(probe.x,probe.y,probe.z,false), probe:world.inBattlefield(probe.x,probe.y,probe.z), bearing:a.fwd.toArray() });
      }
      // Never change the shared heart flow while planning a commander order.
      const before = Array.from(n.next.slice(0, 500));
      const path = n.findPath(n.nodeDir(n.heartNode, v), n.nodeDir(n.portalNodes[0], origin));
      check('Commander route reaches a portal without overwriting enemy flow', path.length > 1 && path.at(-1) === n.portalNodes[0] && before.every((x, i) => n.next[i] === x), path.length);
      const oldAir = n.airNext.slice();
      n.nodePos(n.heartNode, origin); n.blockNodes(origin, 0.1, 30000); n.unblockNodes(30000);
      check('Tower footprints cannot rewrite flyer routes', oldAir.every((x, i) => n.airNext[i] === x));
      const tower = W.towers.place('mortar', W.heartPos);
      const baseDamage = tower.stats.dmg;
      tower.terrain = 'hot';
      check('Placed Mortar consumes the elemental bonus', Math.abs(tower.stats.dmg / baseDamage - 1.15) < 0.00001, tower.stats.dmg);
      g.select(tower);
      check('Range orbit and minimum exclusion match actual stats', g.selRing.outer.scale.x === tower.range && g.selRing.inner.scale.x === tower.stats.minRange && g.selRing.mesh.position.distanceTo(tower.pos) === 0);
      g.selRing.mesh.updateMatrixWorld(true);
      // The owner replaced expensive terrain contours with a depth-clipped
      // translucent volume. Its geometry still has to match targeting exactly.
      for (const [line, radius] of [[g.selRing.veil, tower.range], [g.selRing.innerVeil, tower.stats.minRange]]) {
        const points = line.geometry.getAttribute('position'); let error = 0;
        for (let i = 0; i < points.count; i++) {
          v.fromBufferAttribute(points, i).applyMatrix4(line.matrixWorld);
          error = Math.max(error, Math.abs(v.distanceTo(tower.pos) - radius));
        }
        check('Depth-clipped range veil follows the actual range boundary', points.count > 0 && error < 0.001 && line.material.transparent && line.material.depthTest && !line.material.depthWrite, { radius, vertices: points.count, error });
      }
      const bolt=W.towers.place('bolt',W.heartPos),enemy=W.enemies.spawn('husk',n.portalNodes[0]);
      enemy.dir.copy(bolt.pos).normalize();enemy.alt=0;enemy.progress=1;
      const at=distance=>{enemy.height=bolt.pos.length()-world.R+distance-enemy.type.radius*.9;};
      at(bolt.range*.99);bolt.target=null;check('Sphere acquires at the true vertical range',bolt._acquire([enemy])===enemy);
      at(bolt.range*1.02);check('Existing target has the documented retention margin',bolt._acquire([enemy])===enemy);
      bolt.target=null;check('A new target outside the sphere is refused',bolt._acquire([enemy])===null);
      at(bolt.range*1.06);bolt.target=enemy;check('Retention cannot extend beyond 4.9 percent',bolt._acquire([enemy])===null);
      tower.target=null;enemy.dir.copy(tower.pos).normalize();at(tower.stats.minRange*.8);check('Mortar refuses its visible inner exclusion',tower._acquire([enemy])===null);
      W.towers.remove(bolt);W.enemies._release(enemy);g.select(tower);
      W.step(0.01);
      return { profile: W.CONFIG.terrainKey, seed: W.CONFIG.seed, attempts:n.attempts, high, low, water, raised, sites, checks };
    });
    result.bootMs = Date.now() - started; result.faults = faults; results.push(result);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title-overlay')).opacity === '0', {}, { polling: 50 });
    await page.screenshot({ path: resolve(out, `${profile}.jpg`), quality: 82 });
    writeFileSync(resolve(out, 'terrain-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ profile, high: result.high, bootMs: result.bootMs, failed: result.checks.filter(c => !c.ok), faults }));
    await page.close();
  }
} finally { await browser.close(); }
if (results.some(r => r.faults.length || r.checks.some(c => !c.ok))) process.exitCode = 1;
