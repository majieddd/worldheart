// Real DOM input with deterministic frames. Polar fixtures move only the rig
// and its confinement; they do not claim a naturally spawned polar campaign.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(resolve(process.env.WH_NODE_MODULES, 'package.json'));
const { chromium } = require('playwright');
const base = (process.env.WH_BASE_URL || 'http://127.0.0.1:8139').replace(/\/$/, '');
const out = resolve(process.argv[2] || 'artifacts/polar-camera/check');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], faults = [];
let info;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => faults.push(String(e)));
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window); window.__qaFramesEnabled = true;
    window.requestAnimationFrame = fn => raf(t => { if (__qaFramesEnabled) fn(t); });
  });
  await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WH?.mode99 && document.getElementById('boot').classList.contains('done'), {}, { timeout: 180000 });
  await page.locator('#btn-begin').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('title-overlay')).opacity === '0');
  info = await page.evaluate(async () => {
    __qaFramesEnabled = false; WH.game.paused = true; WH.rig.cancelFlight();
    window.__poleTHREE = await import('three');
    window.__poleSaved = { height: WH.rig.heightProbe, surface: WH.rig.surfaceProbe, confine: WH.rig.confine };
    window.__poleFocus = () => new __poleTHREE.Vector3(Math.sin(WH.rig.lon) * Math.cos(WH.rig.lat), Math.sin(WH.rig.lat), Math.cos(WH.rig.lon) * Math.cos(WH.rig.lat));
    window.__poleSet = (lat, lon = 0, yaw = 0, terrain = false, confined = false) => {
      const r = WH.rig; r.keys.clear(); r.cancelFlight(); r.velLon = r.velLat = 0;
      r.lon = lon; r.lat = lat; r.viewYaw = yaw; r.tiltOffset = 0;
      r.heightProbe = terrain ? __poleSaved.height : null;
      r.surfaceProbe = terrain ? __poleSaved.surface : null;
      r.confine = confined ? { center: new __poleTHREE.Vector3(0, Math.sign(lat), 0), maxAng: .22 } : null;
      r.visibilityLift = r.visibilityTarget = r.visibilityVelocity = 0;
      // This inspection moves outside the actual frontier. Reveal the mesh
      // explicitly so screenshots show terrain instead of the exploration fog.
      if (WH.world.fogVeil) WH.world.fogVeil.mesh.visible = false;
      if (WH.world.cloudDeck) WH.world.cloudDeck.mesh.visible = false;
      r.dist = r.targetDist = 35; r.update(0); WH.step(0);
    };
    window.__poleMeasure = (frames = 120, fps = 60) => {
      const r = WH.rig, start = __poleFocus(), q = r.camera.quaternion.clone(), eye = r.camera.position.clone().normalize();
      let maxRotation = 0, maxEye = 0, maxFocus = 0, peakLat = Math.abs(r.lat), boundary = 0, prev = start.clone();
      for (let i = 0; i < frames; i++) {
        WH.step(1 / fps, fps, i % 12 === 0);
        const f = __poleFocus(), e = r.camera.position.clone().normalize();
        maxRotation = Math.max(maxRotation, q.angleTo(r.camera.quaternion));
        maxEye = Math.max(maxEye, eye.angleTo(e)); maxFocus = Math.max(maxFocus, prev.angleTo(f));
        peakLat = Math.max(peakLat, Math.abs(r.lat));
        if (r.confine) boundary = Math.max(boundary, f.angleTo(r.confine.center));
        q.copy(r.camera.quaternion); eye.copy(e); prev.copy(f);
      }
      return { maxRotation, maxEye, maxFocus, peakLat, boundary, moved: start.angleTo(__poleFocus()), lat: r.lat, lon: r.lon, position: r.camera.position.toArray(), finite: [...r.camera.matrixWorld.elements, r.lon, r.lat].every(Number.isFinite) };
    };
    return { map: WH.CONFIG.mapKey, seed: WH.CONFIG.seed, heartLatitude: Math.asin(WH.heartPos.clone().normalize().y), scope: 'Real keyboard/pointer events, controlled polar camera fixtures and actual spawn; deterministic frames with sparse real rendering' };
  });
  const check = (name, ok, actual) => { checks.push({ name, ok, actual }); console.log(JSON.stringify({ name, ok, actual })); };
  for (const sign of [1, -1]) {
    await page.evaluate(s => __poleSet(s * (Math.asin(.94) - .025), 1.2, s > 0 ? 0 : Math.PI), sign);
    await page.keyboard.down('ArrowUp'); const seam = await page.evaluate(() => __poleMeasure(150)); await page.keyboard.up('ArrowUp');
    check(`${sign > 0 ? 'North' : 'South'} orientation seam is continuous`, seam.finite && seam.maxRotation < .12 && seam.maxEye < .04 && seam.peakLat > Math.asin(.94), seam);
    await page.evaluate(s => __poleSet(s * 1.54, 0, s > 0 ? 0 : Math.PI), sign);
    await page.keyboard.down('ArrowUp'); const cross = await page.evaluate(() => __poleMeasure(100)); await page.keyboard.up('ArrowUp');
    check(`${sign > 0 ? 'North' : 'South'} pole can be crossed`, cross.finite && cross.peakLat > 1.565 && cross.maxRotation < .12 && Math.abs(cross.lon) > 2, cross);
    await page.evaluate(s => __poleSet(s * Math.PI / 2, 0, 0, true, true), sign);
    await page.keyboard.down('ArrowLeft'); const left = await page.evaluate(() => __poleMeasure(180)); await page.keyboard.up('ArrowLeft');
    check(`${sign > 0 ? 'North' : 'South'} polar terrain and boundary accept left input`, left.finite && left.maxRotation < .2 && left.maxEye < .08 && left.maxFocus < .04 && left.moved > .01 && left.boundary <= .220001, left);
    await page.screenshot({ path: resolve(out, `${sign > 0 ? 'north' : 'south'}-left.png`) });
    const centered = await page.evaluate(s => {
      const p = new __poleTHREE.Vector3(0, s, 0), r = WH.rig;
      r.flyTo(p, 35, .6); WH.step(.7); const error = __poleFocus().angleTo(p);
      const actual = p.multiplyScalar(r.focusRadius).project(r.camera);
      return { error, screenError: Math.hypot(actual.x * 640, actual.y * 360) };
    }, sign);
    check(`${sign > 0 ? 'North' : 'South'} pole is exactly focusable`, centered.error < 1e-6 && centered.screenError < .1, centered);
    await page.evaluate(s => __poleSet(s * 1.564, 0, s > 0 ? 0 : Math.PI, true), sign);
    await page.mouse.move(640, 360); await page.mouse.down({ button: 'middle' });
    const anchor = await page.evaluate(() => ({ valid: WH.rig.grabValid && WH.rig.rayHit, point: WH.rig.grabDir.clone().multiplyScalar(WH.rig.grabR).toArray() }));
    let maxRotation = 0;
    for (let i = 1; i <= 30; i++) {
      await page.evaluate(() => { window.__poleLastQ = WH.rig.camera.quaternion.clone(); });
      await page.mouse.move(640 + i * 1.5, 360 + i * 2);
      maxRotation = Math.max(maxRotation, await page.evaluate(() => { WH.step(1 / 60); return __poleLastQ.angleTo(WH.rig.camera.quaternion); }));
    }
    const drag = await page.evaluate(a => {
      const p = new __poleTHREE.Vector3(...a.point).project(WH.rig.camera);
      return { error: Math.hypot((p.x + 1) * 640 - 685, (1 - p.y) * 360 - 420), lat: WH.rig.lat, lon: WH.rig.lon };
    }, anchor);
    await page.mouse.up({ button: 'middle' });
    const drift = await page.evaluate(() => __poleMeasure(180));
    const velocity = await page.evaluate(() => Math.hypot(WH.rig.velLon, WH.rig.velLat));
    check(`${sign > 0 ? 'North' : 'South'} terrain drag crosses and settles`, anchor.valid && drag.error < 2 && maxRotation < .15 && Math.abs(drag.lon) > 1 && drift.maxRotation < .15 && velocity < 1e-4, { anchorValid: anchor.valid, ...drag, maxRotation, drift, velocity });
    await page.screenshot({ path: resolve(out, `${sign > 0 ? 'north' : 'south'}-drag.png`) });
    for (const zoom of ['near', 'far']) {
      await page.evaluate(({ s, zoom }) => {
        __poleSet(s * Math.PI / 2, 0, .7, true, true);
        const r = WH.rig; r.dist = r.targetDist = zoom === 'near' ? r.distMin : r.distMax; WH.step(1);
      }, { s: sign, zoom });
      const runs = [];
      for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
        await page.keyboard.down(key); runs.push(await page.evaluate(() => __poleMeasure(60))); await page.keyboard.up(key);
      }
      check(`${sign > 0 ? 'North' : 'South'} rotated ${zoom} view handles all arrows`, runs.every(r => r.finite && r.maxRotation < .2 && r.maxFocus < .04 && r.boundary <= .220001), runs);
    }
  }
  await page.evaluate(() => {
    const r = WH.rig; r.heightProbe = __poleSaved.height; r.surfaceProbe = __poleSaved.surface; r.confine = __poleSaved.confine;
    if (WH.world.fogVeil) WH.world.fogVeil.mesh.visible = true;
    if (WH.world.cloudDeck) WH.world.cloudDeck.mesh.visible = true;
  });
  await page.locator('#btn-home').click();
  const home = await page.evaluate(() => { WH.step(2); return __poleFocus().angleTo(WH.heartPos.clone().normalize()); });
  check('Return to the real heart after polar navigation', home < 1e-6, { error: home });
  await page.keyboard.down('q'); await page.evaluate(() => WH.step(.3)); await page.keyboard.up('q');
  await page.mouse.move(640, 360); await page.mouse.wheel(0, -180); await page.evaluate(() => WH.step(.5));
  const spawn = [];
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.down(key); spawn.push(await page.evaluate(() => __poleMeasure(45))); await page.keyboard.up(key);
  }
  check('Actual spawn remains navigable after rotation and wheel zoom', spawn.every(r => r.finite && r.maxRotation < .2 && r.maxFocus < .04 && r.moved > 1e-4), spawn);
  await page.locator('#btn-home').click(); await page.evaluate(() => WH.step(2));
  await page.screenshot({ path: resolve(out, 'actual-spawn.png') });
} finally {
  await browser.close();
  const report = { ...info, checks, faults, pass: checks.every(c => c.ok) && !faults.length };
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.pass) process.exitCode = 1;
}
