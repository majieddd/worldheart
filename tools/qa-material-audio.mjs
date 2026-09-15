// Playwright is supplied by the local QA runtime, not a player dependency.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(resolve(process.env.WH_NODE_MODULES, 'package.json'));
const { chromium } = require('playwright');
const base = process.env.WH_BASE_URL || 'http://127.0.0.1:8141';
const out = process.argv[2] || 'artifacts/audio-restoration/material-local.json';
const report = { base, checks: [], errors: [], hearing: 'Unavailable. Output measurements are not listening acceptance.' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => report.errors.push(String(e)));
  const assets = [];
  page.on('request', r => { if (r.url().includes('/audio/material/')) assets.push(r.url()); });
  await page.goto(base + '/audio-lab.html');
  await page.waitForFunction(() => !!window.audioLab);
  check('No audio downloads or context before a gesture', assets.length === 0 && await page.evaluate(() => !audioLab.draft.ctx && !audioLab.previous.ctx));
  await page.getByRole('button', { name: 'Draft: Menu click', exact: true }).click();
  await page.waitForFunction(() => !!audioLab.draft.bank);
  check('Actual draft button loads and starts the engine', await page.evaluate(() => audioLab.draft.ctx.state === 'running'));
  await page.evaluate(() => {
    const a = audioLab.draft.ctx.createAnalyser(); a.fftSize = 2048;
    audioLab.draft.output.disconnect(); audioLab.draft.output.connect(a);
    a.connect(audioLab.draft.ctx.destination); window.measure = a;
  });
  const ids = await page.locator('[data-engine="draft"]').evaluateAll(els => els.map(e => e.dataset.cue));
  for (const id of ids) {
    await page.locator(`[data-engine="draft"][data-cue="${id}"]`).click();
    const peak = await page.evaluate(async () => {
      let peak = 0; const data = new Float32Array(measure.fftSize);
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 20)); measure.getFloatTimeDomainData(data);
        peak = Math.max(peak, ...data.map(Math.abs));
      }
      return peak;
    });
    check(`Measured non-silent, unclipped output: ${id}`, peak > .0005 && peak < .99, { peak });
  }
  check('One cached bank download across all cue buttons', assets.filter(x => x.endsWith('impacts.wav')).length === 1);
  check('Piano is not fetched with effects', !assets.some(x => x.endsWith('piano-sketch.wav')));
  await page.route('**/piano-sketch.wav', async route => {
    await new Promise(r => setTimeout(r, 700)); await route.continue();
  });
  await page.getByRole('button', { name: 'Play piano sketch', exact: true }).click();
  await page.waitForFunction(() => audioLab.draft.scoreEnabled);
  await page.locator('#stop').click();
  await page.waitForTimeout(1100);
  check('Stop during piano loading prevents delayed playback', await page.evaluate(() => !audioLab.draft.scoreNode && !audioLab.draft.scoreEnabled));
  await page.getByRole('button', { name: 'Play piano sketch', exact: true }).click();
  await page.waitForFunction(() => !!audioLab.draft.scoreNode);
  check('Piano starts only by explicit selection', assets.filter(x => x.endsWith('piano-sketch.wav')).length === 1);
  await page.locator('#stop').click();
  check('Stop ends music and clears sampled voices', await page.evaluate(() => !audioLab.draft.scoreNode && audioLab.draft.voices.size === 0));
  await page.locator('#sequence-new').click();
  await page.locator('#stop').click();
  await page.waitForTimeout(1900);
  check('Stop cancels the comparison sequence', await page.locator('#status').textContent() === 'Stopped.');
  const burst = await page.evaluate(async () => {
    const a = audioLab.draft;
    a.master.gain.cancelScheduledValues(a.ctx.currentTime);
    a.master.gain.setValueAtTime(1, a.ctx.currentTime); a._last.clear();
    const names = Object.keys(a.manifest.cues);
    for (const name of names) a.play(name);
    let peak = 0, voices = a.voices.size;
    const data = new Float32Array(measure.fftSize);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 20)); measure.getFloatTimeDomainData(data);
      peak = Math.max(peak, ...data.map(Math.abs));
    }
    return { peak, voices };
  });
  check('Simultaneous sampled combat at maximum lab volume is bounded and unclipped', burst.voices <= 12 && burst.peak > .01 && burst.peak < .99, burst);
  await page.locator('#stop').click();
  await page.waitForTimeout(250);
  const quiet = await page.evaluate(() => { const d = new Float32Array(measure.fftSize); measure.getFloatTimeDomainData(d); return Math.max(...d.map(Math.abs)); });
  check('No persistent bed after stopping', quiet < .00001, { peak: quiet });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      small: [...document.querySelectorAll('button')].filter(e => e.getBoundingClientRect().height < 48).length,
      nav: document.querySelector('header').getBoundingClientRect().height,
      clipped: [...document.querySelectorAll('button')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).length }));
    check(`Readable controls at ${width}px`, !layout.overflow && !layout.small && !layout.clipped && layout.nav <= 80, layout);
    await page.screenshot({ path: out.replace('.json', `-${width}.png`), fullPage: true });
  }
  const contrast = await page.evaluate(() => {
    const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const parse = x => x.match(/[\d.]+/g).slice(0, 3).map(Number);
    const body = getComputedStyle(document.documentElement).backgroundColor;
    return [...document.querySelectorAll('p, a, button, small, footer, h1, h2, label, output')].map(el => {
      let bg = body, node = el;
      while (node) { const c = getComputedStyle(node).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') { bg = c; break; } node = node.parentElement; }
      const a = luminance(parse(getComputedStyle(el).color)), b = luminance(parse(bg));
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
  });
  check('Computed text contrast passes AA', Math.min(...contrast) >= 4.5, { minimum: Math.min(...contrast) });
  await page.keyboard.press('Tab'); // Establish keyboard modality for :focus-visible.
  await page.locator('#stop').focus();
  check('Keyboard focus is visible', await page.locator('#stop').evaluate(e => getComputedStyle(e).outlineStyle !== 'none'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => audioLab.draft.ctx.state === 'suspended');
  check('Hidden tab suspends draft audio', true);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => audioLab.draft.ctx.state === 'running');
  check('Visible tab can resume without restarting an ambient bed', await page.evaluate(() => !audioLab.draft.scoreNode && audioLab.draft.voices.size === 0));
  await page.evaluate(() => audioLab.draft.dispose());
  await page.waitForFunction(() => audioLab.draft.ctx.state === 'closed');
  check('Disposal closes the context and releases active voices', await page.evaluate(() => audioLab.draft.voices.size === 0));
  await page.close();

  const fail = await browser.newPage();
  await fail.route('**/audio/material/impacts.wav', r => r.abort());
  await fail.goto(base + '/audio-lab.html');
  await fail.getByRole('button', { name: 'Draft: Menu click', exact: true }).click();
  await fail.waitForFunction(() => document.querySelector('#status').textContent.includes('could not load'));
  await fail.getByRole('button', { name: 'Previous: Menu click', exact: true }).click();
  check('Failed draft download leaves previous playback usable', await fail.evaluate(() => audioLab.previous.ctx.state === 'running'));
  await fail.close();

  const game = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  game.on('pageerror', e => report.errors.push(String(e)));
  const downloads = []; game.on('request', r => { if (r.url().includes('/audio/material/') || r.url().endsWith('/audio-material.js')) downloads.push(r.url()); });
  // Small original map isolates audio startup without expensive campaign generation.
  await game.goto(base + '/?map=pocket&seed=77');
  await game.waitForFunction(() => window.WH?.game?.audio && document.querySelector('#boot.done'), null, { timeout: 180000 });
  await game.locator('#btn-begin').tap();
  check('Default play still uses original audio and zero trial downloads', downloads.length === 0 && await game.evaluate(() => !WH.game.audio.materialTrial));
  await game.goto(base + '/?map=pocket&seed=77&sound=material');
  await game.waitForFunction(() => window.WH?.game?.audio && document.querySelector('#boot.done'), null, { timeout: 180000 });
  await game.locator('#btn-begin').tap();
  await game.waitForFunction(() => WH.game.audio.bank);
  check('Opt-in play installs draft before touch controls begin', await game.evaluate(() => WH.game.audio.materialTrial && WH.game.audio.ctx.state === 'running'));
  check('Game UI and gameplay share the same draft instance', await game.evaluate(() => WH.game.audio === WH.ui.audio));
  await game.evaluate(() => WH.game.audio.toggleMute());
  check('Existing game mute works in draft mode', await game.evaluate(() => WH.game.audio.muted));
  await game.evaluate(() => WH.game.audio.toggleMute());
  await game.waitForTimeout(500);
  check('Draft game starts no piano automatically', !downloads.some(x => x.endsWith('piano-sketch.wav')));
  await game.screenshot({ path: out.replace('.json', '-game.png') });
  await game.close();
  check('No uncaught runtime exceptions', report.errors.length === 0);
} catch (error) { report.errors.push(String(error)); console.error(error); }
finally { await browser.close(); writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
if (report.errors.length || report.checks.some(c => !c.ok)) process.exitCode = 1;
