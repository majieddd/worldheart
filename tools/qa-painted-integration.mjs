// Deterministic browser fixtures for cross-map rendering, waves and home saves.
// This validates lifecycle wiring, not natural-play difficulty or device FPS.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/painted-earth/integration');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{const key=location.pathname.includes('/v2/')?'whV2:whFirstExpedition1':'whFirstExpedition1';localStorage.setItem(key,JSON.stringify({intro:true,story:true,skipped:true,done:[],seen:[]}));});
const ready=async()=>{await page.waitForFunction(()=>window.WH?.game&&document.querySelector('#boot.done'),null,{timeout:180000});};
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
try{
  if(!process.argv.includes('--home-only')){
  for(const map of ['pocket','giant','titan','reach']){
    await page.goto(base+'/?map='+map+'&seed=12345');await ready();await page.locator('#btn-begin').click();await page.waitForTimeout(500);
    const camera=await page.evaluate(()=>WH.camTest());check(map+' renders and passes camera regression',camera.failed.length===0,camera.failed);
  }
  await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=earth');await ready();await page.waitForFunction(()=>WH.game.state==='playing');
  await page.evaluate(()=>{WH.possession.exit();WH.game.gold=50000;WH.game.maxLives=WH.game.lives=100000;WH.mode99.commander.hp=WH.mode99.commander.hpMax=100000;WH.mode99.weather.update=()=>{};for(let i=0;i<3;i++)WH.mode99.upgradeHeart();});
  const camera=await page.evaluate(()=>WH.camTest());check('Earth strategy camera regression during active play',camera.failed.length===0,camera.failed);
  const milestones=[];
  for(let i=0;i<1300;i++){
    const s=await page.evaluate(()=>{const m=WH.mode99,g=WH.game,r=m.run;const draft=r.getDraft(),record={wave:WH.waves.wave,cleared:r.checkpoint().wavesCleared,draft:!!draft,weapon:!!g.tutorialWeaponDropped,phase:r.getPhase()};
      if(draft)r.vote('solo',0);g.paused=false;WH.step(1.5,15,false);
      for(const e of [...WH.enemies.active])if(!e.dead)WH.enemies.damage(e,1e9,{armorPierce:99});return record;});
    if(!milestones.some(x=>x.wave===s.wave&&x.draft===s.draft&&x.phase===s.phase))milestones.push(s);
    if(s.phase==='victory')break;
  }
  check('Wave-one draft and wave-two guaranteed weapon survive actual director queues',milestones.some(s=>s.draft&&s.cleared===1)&&milestones.some(s=>s.weapon),milestones);
  check('Accelerated fixture completes the ten-wave defense',await page.evaluate(()=>WH.mode99.run.getPhase()==='victory'));
  }
  await page.goto(base+'/?home=home-earth');await ready();await page.waitForFunction(()=>WH.mode99.home.quiet&&WH.game.state==='playing');
  check('Starter home remains direct, peaceful, clear and in third person',await page.evaluate(()=>WH.CONFIG.environment.theme==='earth'&&WH.possession.boomWant===4&&!WH.world.fogVeil?.mesh.visible));
  const before=await page.evaluate(()=>{const m=WH.mode99,c=m.commander,w=m.walls;c.dir.copy(WH.game.frontier.centre).addScaledVector(c.fwd,3/WH.CONFIG.planetRadius).normalize();WH.allies._ground(c);m.inventory.awardScrap(1);const bought=w.buy();let placed=false;
    for(let i=0;i<20&&!placed;i++){const side=c.dir.clone().cross(c.fwd),d=WH.game.frontier.centre.clone().addScaledVector(c.fwd,8/WH.CONFIG.planetRadius).addScaledVector(side,(i-10)/WH.CONFIG.planetRadius).normalize();placed=w.place(d,0);}
    if(placed)w.items[0].hp=111;
    const site=m.structures.items[0],p=site.chest.getWorldPosition(c.dir.clone());c.dir.copy(p).normalize();c.height=p.length()-WH.CONFIG.planetRadius;WH.allies._ground(c);const opened=m.structures.open(site);WH.step(6,30,false);const saved=m.home.record.checkpoint.walls?.items[0]?.hp===111;
    return {bought,placed,opened,saved,walls:w.snapshot(),structures:m.structures.snapshot()};});
  check('Home fixture autosaves walls and opened supplies without manual save flags',before.bought&&before.placed&&before.opened&&before.saved,before);
  await page.reload();await ready();await page.waitForFunction(()=>WH.mode99.home.quiet);
  const after=await page.evaluate(()=>({walls:WH.mode99.walls.snapshot(),structures:WH.mode99.structures.snapshot(),closed:WH.mode99.structures.items.filter(s=>WH.mode99.structures.claimed.has(s.id)).every(s=>s.lid.rotation.x< -1)}));
  check('Home reload preserves stock, damaged wall HP and chest claims',JSON.stringify(before.walls)===JSON.stringify(after.walls)&&JSON.stringify(before.structures)===JSON.stringify(after.structures)&&after.closed,after);
  check('No browser runtime or shader errors',errors.length===0,errors);
}catch(e){checks.push({name:'Integration completed',ok:false,detail:String(e)});console.log(String(e));}
writeFileSync(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));await browser.close();process.exitCode=checks.some(c=>!c.ok)?1:0;
