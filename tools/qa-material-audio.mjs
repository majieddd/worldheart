// Playwright is supplied by the local QA runtime, not a player dependency.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(resolve(process.env.WH_NODE_MODULES, 'package.json'));
const { chromium } = require('playwright');
const base = process.env.WH_BASE_URL || 'http://127.0.0.1:8141';
const out = process.argv[2] || 'artifacts/audio-feedback/local.json';
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
  const musicRequests=[];
  page.on('request',r=>{if(/\/audio\/(soundtrack|auditions)\/.*\.mp3/.test(r.url()))musicRequests.push(r.url());});
  page.on('request', r => { if (r.url().includes('/audio/material/')) assets.push(r.url()); });
  await page.goto(base + '/audio-lab.html');
  await page.waitForFunction(() => !!window.audioLab);
  check('No soundtrack or draft music downloads before an audition gesture',musicRequests.length===0);
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
  check('Nine owner tracks are available without autoplay', await page.locator('#tracks audio').count()===9 && await page.locator('audio').evaluateAll(a=>a.every(x=>x.paused&&x.preload==='none')));
  for(let i=0;i<9;i++) {
    await page.locator('#tracks audio').nth(i).evaluate(a=>a.play());
    await page.waitForFunction(i=>document.querySelectorAll('#tracks audio')[i].currentTime>.1,i);
    check('Owner track '+(i+1)+' decodes and plays alone',await page.locator('audio').evaluateAll(a=>a.filter(x=>!x.paused).length===1));
  }
  await page.locator('#stop').click();
  check('Stop ends all owner music players',await page.locator('audio').evaluateAll(a=>a.every(x=>x.paused)));
  check('Five approval drafts are available with lazy loading',await page.locator('#auditions audio').count()===5&&await page.locator('#auditions audio').evaluateAll(a=>a.every(x=>x.preload==='none'&&x.paused)));
  for(let i=0;i<5;i++){
    await page.locator('#auditions audio').nth(i).evaluate(a=>a.play());
    await page.waitForFunction(i=>document.querySelectorAll('#auditions audio')[i].currentTime>.1,i);
    check('Planet draft '+(i+1)+' decodes a full 90-second audition and plays alone',await page.locator('audio').evaluateAll(a=>a.filter(x=>!x.paused).length===1)&&await page.locator('#auditions audio').nth(i).evaluate(a=>a.duration>=90&&a.duration<=96.15));
  }
  await page.locator('#stop').click();
  check('Stop ends all approval drafts',await page.locator('#auditions audio').evaluateAll(a=>a.every(x=>x.paused)));

  check('Rejected piano player removed',await page.locator('#piano').count()===0);
  for(const [family,material,target,expected] of [['spear','iron','flesh','spearFlesh'],['twinblade','iron','flesh','twinFlesh'],['sword','wood','flesh','woodFlesh'],['sword','iron','armor','swordArmor']]) {
    await page.selectOption('#family',family);await page.selectOption('#material',material);await page.selectOption('#target',target);
    const before=await page.evaluate(k=>audioLab.draft.variants.get(k)||0,expected);
    await page.getByRole('button',{name:'Draft: Melee impact',exact:true}).click();
    check('Context selects '+expected,await page.evaluate(([k,b])=>(audioLab.draft.variants.get(k)||0)>b,[expected,before]));
    await page.waitForTimeout(90);
  }
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
  check('Visible tab can resume without restarting an ambient bed', await page.evaluate(() => audioLab.draft.voices.size === 0));
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
  const draftMusicRequests=[];game.on('request',r=>{if(r.url().includes('/audio/auditions/'))draftMusicRequests.push(r.url());});
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
  const contact=await game.evaluate(()=>{
    const audio=WH.game.audio;audio._last.clear();
    const e=WH.enemies.spawn('husk',WH.enemies.nav.portalNodes[0],1);
    const before=audio.variants.get('spearFlesh')||0;
    WH.allies.onStrikeHit(e,3,true,{weaponFamily:'spear',weaponMaterial:'iron'},{kind:'melee'});
    return {impact:(audio.variants.get('spearFlesh')||0)>before,creature:(audio.variants.get('creatureHusk')||0)>0};
  });
  check('Combat callback routes the attacking weapon and struck creature',contact.impact&&contact.creature,contact);
  const contexts=[['title',{state:'title'}],['tropical',{state:'playing',theme:'jungle'}],['boss',{state:'playing',boss:true}],['desertBoss',{state:'playing',boss:true,theme:'desert'}],['cinematicBoss',{state:'playing',boss:true,wave:10}],['playful',{state:'playing',planet:2}]];
  for(const [key,context] of contexts) {
    await game.evaluate(c=>{WH.game.soundtrack.read=()=>c;WH.game.soundtrack.update();},context);
    await game.waitForFunction(k=>WH.game.soundtrack.key===k&&WH.game.soundtrack.decks.some(d=>d.id===k&&d.media.currentTime>.1),key);
    check('Game music context: '+key,await game.evaluate(()=>WH.game.soundtrack.decks.length<=2));
  }
  await game.evaluate(()=>WH.game.audio.toggleMute());await game.waitForTimeout(550);
  check('Game mute also mutes music',await game.evaluate(()=>WH.game.soundtrack.bus.gain.value<.002));
  await game.evaluate(()=>WH.game.audio.toggleMute());
  await game.evaluate(()=>WH.game.soundtrack.setEnabled(false));
  check('Music can stop independently of effects',await game.evaluate(()=>WH.game.soundtrack.decks.length===0&&!WH.game.audio.muted));
  check('Approval music never downloads during game context changes',draftMusicRequests.length===0);
  await game.screenshot({ path: out.replace('.json', '-game.png') });
  await game.close();
  const lobby=await browser.newPage({hasTouch:true,isMobile:true});lobby.on('pageerror',e=>report.errors.push(String(e)));
  await lobby.goto(base+'/lobby.html');await lobby.waitForFunction(()=>!!window.lobbySoundtrack);
  check('Lobby music waits for gesture',await lobby.evaluate(()=>!lobbySoundtrack.started));
  await lobby.locator('#lobby-view').click({position:{x:600,y:400}});
  await lobby.waitForFunction(()=>lobbySoundtrack.decks.some(d=>d.id==='lobby1'&&d.media.currentTime>.1));
  await lobby.evaluate(()=>lobbySoundtrack.decks.at(-1).media.dispatchEvent(new Event('ended')));
  await lobby.waitForFunction(()=>lobbySoundtrack.decks.some(d=>d.id==='lobby2'&&d.media.currentTime>.1));
  check('Lobby rotates both owner tracks',true);
  await lobby.locator('.soundtrack-controls summary').click();
  await lobby.locator('.soundtrack-controls button').click();
  check('Lobby music toggle stops streaming',await lobby.evaluate(()=>!lobbySoundtrack.enabled&&lobbySoundtrack.decks.length===0));
  await lobby.setViewportSize({width:390,height:844});
  const fit=await lobby.locator('.soundtrack-controls').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
  check('Lobby music controls fit a phone viewport',fit);
  await lobby.screenshot({path:out.replace('.json','-lobby.png')});await lobby.close();
  check('No uncaught runtime exceptions', report.errors.length === 0);
} catch (error) { report.errors.push(String(error)); console.error(error); }
finally { await browser.close(); writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
if (report.errors.length || report.checks.some(c => !c.ok)) process.exitCode = 1;
