// Real browser interactions plus explicitly labeled simulation fixtures.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8141',out=resolve(process.argv[2]||'artifacts/painted-earth/qa');
mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),checks=[],errors=[];
const track=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};track(page);
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
const shot=async(p,name)=>p.screenshot({path:resolve(out,name+'.png')});
const ready=async p=>{await p.waitForFunction(()=>window.WH?.mode99||document.querySelector('#boot-status')?.textContent.includes('failed'),null,{timeout:180000});if(await p.evaluate(()=>!window.WH?.mode99))throw Error('Game boot failed');};
const pause=async(p,ms=450)=>p.waitForTimeout(ms);
try{
  if(!process.argv.includes('--touch-only')){
  const start=Date.now();await page.goto(base+'/');await ready(page);
  check('Bare entry bypasses lobby and generates Earth',await page.evaluate(()=>WH.CONFIG.environment.theme==='earth'&&WH.CONFIG.mapKey==='ninetynine'),{loadMs:Date.now()-start});
  await page.waitForSelector('.first-skip');await page.locator('.first-skip').click();await page.waitForSelector('.first-story[open]');await pause(page);
  const story=await page.locator('.first-story').boundingBox();check('Four-panel story is centered',Math.abs(story.x+story.width/2-720)<2&&Math.abs(story.y+story.height/2-480)<2,story);
  check('All four authored paintings load',await page.evaluate(async()=>{const images=[...document.querySelectorAll('.first-art')].map(el=>getComputedStyle(el).backgroundImage.slice(5,-2));return images.length===4&&(await Promise.all(images.map(src=>new Promise(r=>{const im=new Image();im.onload=()=>r(im.width>500);im.onerror=()=>r(false);im.src=src;})))).every(Boolean);}));await shot(page,'story-desktop');
  await page.getByRole('button',{name:'Begin first defense'}).click();await pause(page);
  check('Story closes into first person and held first wave',await page.evaluate(()=>WH.possession.active&&WH.possession.boomWant===0&&WH.onboarding.holding&&WH.onboarding.lesson==='select'));
  check('Paint covers world, units and held models',await page.evaluate(()=>WH.paint.stats.materials>70&&WH.paint.stats.contours>100),await page.evaluate(()=>WH.paint.stats));
  await shot(page,'first-defense');
  await page.locator('.build-card[data-type="bolt"]').click();await pause(page);
  check('Real tower selection removes tutorial blur',await page.evaluate(()=>WH.onboarding.lesson==='tower'&&document.querySelector('.first-spotlight').hidden));
  // Camera aim is a fixture; the purchase goes through the real canvas click.
  let valid=false;for(const pitch of [-.65,-.9,-1.1]){await page.evaluate(p=>{WH.possession.pitch=p;},pitch);await pause(page);valid=await page.evaluate(()=>WH.game.validity.ok);if(valid)break;}
  check('Initial foothold offers a legal first-person tower placement',valid,await page.evaluate(()=>WH.game.validity));
  if(valid){await page.locator('#view').click({position:{x:720,y:480}});await pause(page);}
  check('Real placement advances to tower upgrade',await page.evaluate(()=>WH.game.towerMgr.towers.length===1&&WH.onboarding.lesson==='towerUpgrade'));
  await page.evaluate(()=>{const t=WH.game.towerMgr.towers[0];if(!t)return;WH.game.context.target={kind:'tower',object:t};WH.game.context.open();});await pause(page);
  await page.locator('#tp-upgrade').click();await pause(page);
  check('Contextual upgrade advances while waves remain frozen',await page.evaluate(()=>WH.game.towerMgr.towers[0].tier===1&&WH.onboarding.lesson==='crystal'&&WH.onboarding.holding));
  await page.evaluate(()=>{const c=WH.mode99.commander,cache=WH.caches.caches.find(x=>!x.taken);c.dir.copy(cache.dir);c.height=WH.nav.height[cache.node];c.moveNode=cache.node;c._renderDir.copy(c.dir);WH.allies._ground(c);});await pause(page,700);
  await page.waitForFunction(()=>WH.mode99.crystals.carried.length>0&&WH.onboarding.lesson==='deposit');
  check('Fixture proximity collects a real seeded crystal',true);
  await page.evaluate(()=>{const c=WH.mode99.commander;c.dir.copy(WH.game.frontier.centre).addScaledVector(c.fwd,3/WH.CONFIG.planetRadius).normalize();WH.allies._ground(c);});await pause(page);
  await page.keyboard.press('KeyC');await pause(page);
  check('Real deposit key advances the base objective',await page.evaluate(()=>WH.onboarding.lesson==='upgrade'&&WH.mode99.crystals.credit>=100));
  await page.evaluate(()=>{const c=WH.mode99.commander,p=WH.world.heart.group.position.clone().addScaledVector(WH.game.frontier.centre,2),aim=p.sub(WH.rig.camera.position),up=aim.dot(c.dir);c.fwd.copy(aim).addScaledVector(c.dir,-up).normalize();WH.possession.pitch=Math.atan2(up,Math.sqrt(Math.max(.001,aim.lengthSq()-up*up)));});await pause(page);
  await page.keyboard.press('KeyF');await pause(page);
  await page.locator('#base-upgrade').click();await pause(page);
  check('Base interaction upgrades and releases the countdown',await page.evaluate(()=>WH.mode99.run.getHeartLevel()===1&&!WH.onboarding.holding));
  await shot(page,'base-growth');
  // Event setup is staged; rendered guide priority is the behavior under test.
  const waveBefore=await page.evaluate(()=>{const wave=WH.waves.wave;WH.waves.wave=1;return wave;});await pause(page);
  const waveGuide=await page.locator('.first-guide h2').textContent();check('Wave guidance replaces an undismissed growth tip',waveGuide==='Destroy the nests',waveGuide);
  await page.evaluate(()=>{const c=WH.mode99.commander,d=c.dir.clone().addScaledVector(c.fwd,30/WH.CONFIG.planetRadius).normalize();window.__guideBoss=WH.enemies.spawn('colossus',WH.nav.nearestWalkableNode(d));});await pause(page);
  const bossGuide=await page.locator('.first-guide h2').textContent();check('Boss warning replaces lower-priority guide text',bossGuide==='A boss approaches',bossGuide);
  await page.evaluate(()=>{WH.enemies.damage(window.__guideBoss,1e9,{armorPierce:99});});await pause(page);
  const claimGuide=await page.locator('.first-guide h2').textContent();check('Boss defeat advances to the claim explanation',claimGuide==='Amazing! Claim this planet',claimGuide);
  await page.evaluate(wave=>{WH.waves.wave=wave;},waveBefore);
  await page.keyboard.press('KeyT');await pause(page);await page.locator('[data-skip]').click();
  await page.keyboard.press('Tab');await pause(page);check('Tab releases to strategy',await page.evaluate(()=>!WH.possession.active));
  await page.keyboard.press('Tab');await pause(page);check('Tab returns to commander',await page.evaluate(()=>WH.possession.active));
  // Wall economy and geometry use the real controller; only resource setup is staged.
  const wall=await page.evaluate(()=>{const m=WH.mode99,w=m.walls;m.inventory.awardScrap(1);const before=m.inventory.scrap,bought=w.buy();return {bought,spent:before-m.inventory.scrap,stock:w.stock};});check('Fixture: one scrap buys exactly five walls',wall.bought&&wall.spent===1&&wall.stock===5,wall);
  const wallPlace=await page.evaluate(()=>{const {walls}=WH.mode99,c=WH.mode99.commander;let placed=false;for(let i=0;i<20&&!placed;i++){const d=WH.game.frontier.centre.clone().addScaledVector(c.fwd,8/WH.CONFIG.planetRadius);const side=c.dir.clone().cross(c.fwd);d.addScaledVector(side,(i-10)/WH.CONFIG.planetRadius).normalize();placed=walls.place(d,0);}const w=walls.items[0];window.__wall=w;return {placed,stock:walls.stock,hp:w?.hp,penalty:WH.nav.wallPenalty?.some(n=>n>0)};});check('Fixture: walls place with HP and route penalties',wallPlace.placed&&wallPlace.stock===4&&wallPlace.hp===180&&wallPlace.penalty,wallPlace);
  const breach=await page.evaluate(()=>{const w=window.__wall;if(!w)return null;const T=w.root.position.constructor,from=new T(0,0,-.8).applyMatrix4(w.root.matrixWorld),to=new T(0,0,.8).applyMatrix4(w.root.matrixWorld),e={dir:from.clone().normalize(),height:from.length()-WH.CONFIG.planetRadius,type:{radius:.4,atk:35},dead:false};const fly={...e,type:{radius:.4,flying:true}};const flies=WH.mode99.walls.stopEnemy(fly,to.clone().normalize(),1);let hits=0;while(WH.mode99.walls.items.includes(w)&&hits<30){WH.mode99.walls.stopEnemy(e,to.clone().normalize(),1);hits++;}return {flies,hits,gone:!WH.mode99.walls.items.includes(w),penaltyCleared:WH.nav.wallPenalty.every(n=>n===0)};});check('Fixture: flyers pass; ground enemies break walls and restore routes',breach&&!breach.flies&&breach.gone&&breach.penaltyCleared,breach);
  const supplies=await page.evaluate(()=>{const f=WH.mode99.structures,s=f.items[0],c=WH.mode99.commander;if(!s)return {count:0};const v=s.chest.getWorldPosition(s.dir.clone());c.dir.copy(v).normalize();c.height=v.length()-WH.CONFIG.planetRadius;WH.allies._ground(c);const a=f.open(s),b=f.open(s);return {count:f.items.length,first:a,repeat:b,claimed:f.snapshot().claimed.length};});check('Fixture: explorable chests reward once',supplies.count>=4&&supplies.first&&!supplies.repeat&&supplies.claimed===1,supplies);
  const boss=await page.evaluate(()=>{const g=WH.game;g.maxLives=100;g.lives=100;g.enemies.onLeak({type:{boss:true,damage:6}});return g.lives;});check('Fixture: boss leak removes half maximum base HP',boss===50,boss);
  await page.evaluate(()=>WH.possession.exit());
  await page.reload();await ready(page);await pause(page,600);check('Reload does not force lore on a returning assault',await page.locator('.first-story[open]').count()===0);
  }
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),mobile=await touch.newPage();track(mobile);
  await mobile.goto(base+'/?seed=12345&onboarding=1');await ready(mobile);await mobile.waitForSelector('.first-skip');await mobile.locator('.first-skip').tap();await mobile.waitForSelector('.first-story[open]');await pause(mobile);await shot(mobile,'story-mobile');
  check('Mobile story has no horizontal overflow',await mobile.locator('.first-story').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await mobile.getByRole('button',{name:'Begin first defense'}).tap();await pause(mobile);await shot(mobile,'first-defense-mobile');
  check('Mobile starts in first person with touch controls',await mobile.evaluate(()=>WH.mobile.enabled&&WH.possession.boomWant===0&&WH.onboarding.holding));
  check('Mobile guide leaves movement and combat controls clear',await mobile.locator('.first-guide').evaluate(el=>{const g=el.getBoundingClientRect(),r=document.querySelector('.touch-right').getBoundingClientRect(),l=document.querySelector('.touch-left').getBoundingClientRect();return g.bottom<=Math.min(r.top,l.top)-4;}));
  await mobile.locator('#touch-build').tap();await pause(mobile);check('Build menu highlights the real first card',await mobile.locator('.build-card.first-tutorial-target').count()===1);
  await mobile.locator('.build-card[data-type="bolt"]').tap();await pause(mobile);check('Touch selection advances the tutorial',await mobile.evaluate(()=>WH.onboarding.lesson==='tower'));
  await mobile.setViewportSize({width:844,height:390});await pause(mobile);await shot(mobile,'guide-landscape');
  const overlaps=await mobile.locator('.first-guide').evaluate(el=>{const a=el.getBoundingClientRect();return [...document.querySelectorAll('#touch-hud button,#touch-stick')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&a.right>r.left&&a.left<r.right&&a.bottom>r.top&&a.top<r.bottom;}).map(b=>b.id);});
  check('Landscape guide clears active touch controls',overlaps.length===0,overlaps);
  check('Landscape guide leaves the aiming reticle visible',await mobile.locator('.first-guide').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>innerHeight/2+20||r.bottom<innerHeight/2-20||r.right<innerWidth/2-20||r.left>innerWidth/2+20;}));
  await mobile.locator('[data-skip]').tap();check('Touch skip releases beginner hold',await mobile.evaluate(()=>!WH.onboarding.holding));await touch.close();
  check('No runtime or shader errors',errors.length===0,errors);
}catch(e){check('Probe completed',false,String(e));}
writeFileSync(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));await browser.close();process.exitCode=checks.some(c=>!c.ok)?1:0;
