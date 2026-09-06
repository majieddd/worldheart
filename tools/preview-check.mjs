// Exercise both routes on one origin, including real save/reload isolation.
// This is a deployment smoke test, not a whole-campaign balance run.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(process.env.WH_NODE_MODULES ? resolve(process.env.WH_NODE_MODULES, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'https://majieddd.github.io/worldheart/').replace(/\/?$/, '/');
const out = resolve(process.argv[3] || 'artifacts/preview-check'); mkdirSync(out, { recursive: true });
const checks = [], faults = [];
const check = (name, ok, actual) => { checks.push({ name, ok, actual }); if (!ok) throw Error(name + ': ' + JSON.stringify(actual)); };
const body = async path => {
  const response = await fetch(new URL(path + '?verify=' + Date.now(), base));
  if (!response.ok) throw Error(`${response.status} ${path}`);
  return Buffer.from(await response.arrayBuffer());
};
const build = JSON.parse((await body('v2/build.json')).toString());
for (const path of ['index.html', 'js/main.js', 'js/config.js', 'js/camera.js', 'css/style.css', 'dist/worldheart.html']) {
  const actual = createHash('sha256').update(await body(path)).digest('hex');
  check(`Production bytes: ${path}`, actual === build.productionHashes[path], actual);
}
for (const path of ['index.html', 'js/config.js', 'js/storage.js', 'js/modes/campaign-store.js']) {
  const actual = createHash('sha256').update(await body('v2/' + path)).digest('hex');
  check(`Preview bytes: ${path}`, actual === build.previewHashes[path], actual);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); page.on('pageerror', error => faults.push(String(error)));
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.__qaFramesEnabled = true;
    window.requestAnimationFrame = fn => raf(t => { if (window.__qaFramesEnabled) fn(t); });
    if (!localStorage.getItem('previewQASentinel')) {
      localStorage.setItem('whMap', 'pocket'); localStorage.setItem('whSeed', '12345');
      localStorage.setItem('wh99Progress', JSON.stringify({ coins: 900, marker: 'production-save' }));
      localStorage.setItem('previewQASentinel', '1');
    }
  });
  const open = async path => {
    await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.WH?.game && document.getElementById('boot')?.classList.contains('done'), {}, { timeout: 180000, polling: 50 });
    await page.evaluate(() => { __qaFramesEnabled = false; });
  };
  await open('v2/?seed=12345');
  const start = await page.evaluate(async () => {
    const { CONFIG } = await import(new URL('js/config.js', location.href).href);
    const { campaignStore } = await import(new URL('js/modes/campaign-store.js', location.href).href);
    return { map: CONFIG.mapKey, planet: CONFIG.campaign?.index, limit: CONFIG.campaign?.limit, coins: campaignStore.snapshot().account.coins,
      stableMap: localStorage.getItem('whMap'), stableSave: localStorage.getItem('wh99Progress'), rootCampaign: localStorage.getItem('wh99Campaign') };
  });
  check('Bare V2 starts saved 99-planet campaign', start.map === 'ninetynine' && start.planet === 1 && start.limit === 99, start);
  check('Preview ignores original profile', start.coins === 0 && start.stableMap === 'pocket' && start.rootCampaign === null, start);
  await page.screenshot({ path: resolve(out, 'v2-title.png') });
  await page.locator('#btn-begin').click();
  const played = await page.evaluate(async () => {
    WH.step(12);
    const { campaignStore } = await import(new URL('js/modes/campaign-store.js', location.href).href);
    return { state: WH.game.state, status: campaignStore.expeditionStatus(), save: localStorage.getItem('whV2:wh99Campaign'),
      rootCampaign: localStorage.getItem('wh99Campaign'), stableSave: localStorage.getItem('wh99Progress') };
  });
  check('V2 begins real assault and saves only preview checkpoint', played.status === 'assault' && !!played.save && played.rootCampaign === null && played.stableSave === start.stableSave, { ...played, save: !!played.save });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(out, 'v2-playing.png') });
  await open('v2/?seed=12345');
  const reload = await page.evaluate(() => ({ saved: localStorage.getItem('whV2:wh99Campaign'), root: localStorage.getItem('wh99Campaign'), original: localStorage.getItem('wh99Progress') }));
  check('V2 reload retains checkpoint and original save', reload.saved === played.save && reload.root === null && reload.original === start.stableSave);
  await open('?map=pocket&seed=12345');
  const stable = await page.evaluate(async () => {
    const { CONFIG } = await import(new URL('js/config.js', location.href).href);
    return { map: CONFIG.mapKey, campaign: !!CONFIG.campaign, original: localStorage.getItem('wh99Progress'), preview: localStorage.getItem('whV2:wh99Campaign') };
  });
  check('Original game boots with original profile and retains V2 save', stable.map === 'pocket' && !stable.campaign && stable.original === start.stableSave && stable.preview === played.save);
  await page.screenshot({ path: resolve(out, 'original-title.png') });
  await open('v2/?map=pocket&seed=12345');
  const classic = await page.evaluate(async () => {
    const { CONFIG } = await import(new URL('js/config.js', location.href).href);
    return { map: CONFIG.mapKey, campaign: !!CONFIG.campaign };
  });
  check('Explicit classic map remains available in V2', classic.map === 'pocket' && !classic.campaign, classic);
  check('No browser runtime faults', faults.length === 0, faults);
} finally {
  await browser.close();
  writeFileSync(resolve(out, 'result.json'), JSON.stringify({ base, build, checks, faults, scope: 'Deployment identity, root preservation and instrumented title/play/save/reload smoke test' }, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: checks.every(c => c.ok), checks: checks.length, previewSha: build.previewSha, productionSha: build.productionSha }));
