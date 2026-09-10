// Actual game-render captures with a controlled, fully revealed frontier.
// Extra gold/upgrades are inspection-only. No natural-play claim.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(resolve(process.env.WH_NODE_MODULES, 'package.json')), { chromium } = require('playwright');
const base = (process.env.WH_BASE_URL || 'http://127.0.0.1:8139').replace(/\/$/, ''), out = resolve(process.argv[2] || 'artifacts/formation-gallery');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }), records = [];
try {
  for (const profile of ['varied', 'alpine', 'canyon', 'ocean']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), faults = [];
    page.on('pageerror', e => faults.push(String(e)));
    await page.addInitScript(() => { const raf = requestAnimationFrame.bind(window); window.__qaFramesEnabled = true; window.requestAnimationFrame = fn => raf(t => { if (__qaFramesEnabled) fn(t); }); });
    await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=${profile}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.WH?.mode99 && document.getElementById('boot').classList.contains('done'), {}, { timeout: 180000 });
    await page.locator('#btn-begin').click();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title-overlay')).opacity === '0');
    const info = await page.evaluate(async () => {
      __qaFramesEnabled = false; const W = WH, world = await import(new URL('js/world.js', location.href));
      W.game.paused = true; W.game.gold = 1e7;
      for (let i = 0; i < 5; i++) document.getElementById('heart-panel').click();
      W.rig.cancelFlight(); W.game.cancelBuild(); W.game.select(null);
      const c = W.nav.fieldCenter;
      W.rig.lat = Math.asin(c.y); W.rig.lon = Math.atan2(c.x, c.z); W.rig.dist = W.rig.targetDist = 270;
      W.rig.tiltOffset = -.8; W.rig._placeCamera(); W.step(0);
      let peak = W.nav.heartNode; for (let i = 0; i < W.nav.n; i++) if (W.nav.height[i] > W.nav.height[peak]) peak = i;
      return { seed: W.CONFIG.seed, nodes: W.nav.n, peak, peakHeight: W.nav.height[peak], version: world.FORMATIONS.version };
    });
    await page.screenshot({ path: resolve(out, `${profile}-overview.png`) });
    await page.evaluate(peak => {
      const W = WH, p = W.heartPos.clone(); W.nav.nodeDir(peak, p);
      W.rig.lat = Math.asin(p.y); W.rig.lon = Math.atan2(p.x, p.z); W.rig.dist = W.rig.targetDist = 95;
      W.rig.viewYaw = .8; W.rig.tiltOffset = 0; W.rig._placeCamera(); W.step(0);
    }, info.peak);
    await page.screenshot({ path: resolve(out, `${profile}-relief.png`) });
    records.push({ profile, ...info, faults }); console.log(JSON.stringify({ profile, ...info, faults })); await page.close();
  }
} finally { writeFileSync(resolve(out, 'results.json'), JSON.stringify({ scope: 'Actual renderer, injected reveal gold/upgrades and inspection cameras; not natural play', base, records }, null, 2) + '\n'); await browser.close(); }
if (records.length !== 4 || records.some(r => r.faults.length)) process.exitCode = 1;
