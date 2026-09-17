// Actual full-game boot/render/input checks, plus explicitly instrumented
// placement and generation fixtures. Not an unassisted campaign playthrough.
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
export async function run({page,browser,base,out,check,settle,errors}){
  page.setDefaultNavigationTimeout(180000);
  const ready=async()=>{await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done')||document.querySelector('#boot-status')?.textContent.startsWith('Boot failed'),null,{timeout:180000});if((await page.locator('#boot-status').textContent()).startsWith('Boot failed'))throw Error(await page.locator('#boot-status').textContent());};
  const results=[];
  await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
  const fixtures=process.argv.includes('--lifecycle-only')?[]:process.argv.includes('--quick')?[['varied','temperate',12345]]:[['varied','temperate',12345],['canyon','arid',9137],['alpine','frozen',44021],['ocean','oceanic',12345],['varied','io',2919286854],['sky','skyarchipelago',12345]];
  for(const [terrain,planet,seed] of fixtures){
    const start=Date.now();await page.goto(`${base}/?map=ninetynine&campaign=0&worldgen=1&terrain=${terrain}&planet=${planet}&seed=${seed}`);await ready();
    // The inspector is a deferred import after the game's boot-complete marker.
    await page.waitForFunction(()=>window.WH?.worldgen,null,{timeout:60000});
    const data=await page.evaluate(async()=>{
      const W=await import(new URL('js/world.js',location.href)),n=WH.nav;
      return {seed:WH.CONFIG.seed,version:WH.CONFIG.terrainVersion,theme:WH.CONFIG.environment.theme,stages:WH.bootStages,attempts:n.attempts,nodes:n.n,kit:W.GUIDED?.metrics,floating:W.floatingWorld(),surfaces:W.FEATURES.surfaces.length,routes:n.portalNodes.map(i=>({ground:Number.isFinite(n.dist[i]),air:Number.isFinite(n.airDist[i])})),maxTask:Math.max(...longTasks),overlooks:WH.worldgen.landmarks.filter(l=>l.label).length};
    });data.bootMs=Date.now()-start;results.push({terrain,planet,seed,...data});
    check(`${terrain}/${planet}: full production generator and all portal routes`,data.version===1&&(data.kit?.quads>5000||data.floating&&data.surfaces>0)&&data.routes.length===5&&data.routes.every(r=>r.ground&&r.air),data);
    await page.locator('#worldgen-peak').click();await page.waitForTimeout(1200);await page.locator('#worldgen-panel > summary').click();await settle();await page.screenshot({path:resolve(out,`${terrain}-${planet}.png`)});
    if(terrain==='varied'&&planet==='temperate'){
      await page.locator('#worldgen-panel > summary').click();
      const option=await page.locator('#worldgen-formation option').evaluateAll(os=>os.find(o=>o.textContent.startsWith('Guided overlook'))?.value);
      check('Fitted overlooks appear in the real world inspector',option!==undefined,{count:data.overlooks});
      if(option!==undefined){await page.locator('#worldgen-formation').selectOption(option);await page.waitForTimeout(1200);await page.locator('#worldgen-panel > summary').click();await page.screenshot({path:resolve(out,'guided-overlook.png')});}
      const placement=await page.evaluate(async()=>{
        const W=await import(new URL('js/world.js',location.href)),THREE=await import(new URL('lib/three.module.min.js',location.href)),{TOWER_TYPES}=await import(new URL('js/towers.js',location.href));
        const rows=[];for(const site of W.GUIDED.landmarks){const d=new THREE.Vector3(...site.dir),climate=W.climateAt(d),type=climate==='hot'?'mortar':climate==='cold'?'cryo':'bolt',fp=W.terrainFootprint(d,WH.game._fp(TOWER_TYPES[type]),type);rows.push({type,ok:fp.ok,height:W.terrainHeight(...site.dir,false)});}
        return rows;
      });check('Fitted shelves accept their climate-compatible tower footprint',placement.length>0&&placement.every(p=>p.ok),placement);
    }
  }
  writeFileSync(resolve(out,'generation.json'),JSON.stringify(results,null,2)+'\n');
  if(process.argv.includes('--quick'))return;
  await page.goto(`${base}/?map=ninetynine&campaign=1&seed=12345`);await ready();await page.locator('#btn-begin').click();
  check('New campaign assault saves the guided terrain version',await page.evaluate(async()=>{const {campaignStore}=await import(new URL('js/modes/campaign-store.js',location.href));return WH.CONFIG.terrainVersion===1&&campaignStore.snapshot().expedition.assault.terrainVersion===1;}));
  const saved=await page.evaluate(()=>WH.mode99.home.snapshot());
  check('Capture snapshot carries the terrain version',saved.world.terrainVersion===1);
  // Fresh Earth uses real lobby navigation, with no seed/anchor override.
  await page.goto(base+'/lobby.html#homeworld');await page.getByRole('link',{name:'Go to Homeworld'}).click();await ready();
  check('New Earth Homeworld opens on guided terrain in peaceful third person',await page.evaluate(()=>WH.CONFIG.terrainVersion===1&&WH.mode99.home.quiet&&WH.possession.unit===WH.mode99.commander));
  const homeRoutes=await page.evaluate(()=>WH.nav.portalNodes.map(n=>Number.isFinite(WH.nav.dist[n])));check('Earth starter anchors still have complete ground routes',homeRoutes.every(Boolean),homeRoutes);
  const start=await page.evaluate(()=>WH.mode99.commander.dir.toArray());await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
  const moved=await page.evaluate(p=>WH.mode99.commander.dir.distanceTo(WH.mode99.commander.dir.clone().set(...p))*WH.CONFIG.planetRadius,start);
  check('Real held movement moves the commander on the new surface',moved>2,{metres:moved});await page.screenshot({path:resolve(out,'earth-home.png')});
  const ramp=await page.evaluate(async()=>{
    const W=await import(new URL('js/world.js',location.href)),a=WH.mode99.commander,l=W.GUIDED.landmarks[0];if(!l)return {missing:true};
    const original=a.dir.clone(),heading=a.fwd.clone(),goal=a.dir.clone().set(...l.dir);
    a.dir.set(...l.entry);a.height=W.terrainHeight(...l.entry);a.moveNode=-1;a.hop=0;a.airT=0;WH.allies._ground(a);
    const begin=a.height;let steps=0,maxStep=0,previous=a.height;
    for(;steps<2400&&a.dir.angleTo(goal)*W.R>1.8;steps++){a.fwd.copy(goal).addScaledVector(a.dir,-goal.dot(a.dir)).normalize();WH.allies.driveUnit(a,1,0,1/60);maxStep=Math.max(maxStep,Math.abs(a.height-previous));previous=a.height;}
    const result={steps,remaining:a.dir.angleTo(goal)*W.R,climbed:a.height-begin,maxStep};
    a.dir.copy(original);a.fwd.copy(heading);a.moveNode=-1;WH.allies._ground(a);return result;
  });check('Commander collision and grounding can climb a fitted overlook ramp',ramp.remaining<1.8&&ramp.climbed>6&&ramp.maxStep<.6,ramp);
  await page.evaluate(()=>document.exitPointerLock?.());await page.locator('#home-wave-toggle').click();
  await page.waitForFunction(()=>WH.world.portals.some(p=>p.established&&p.active),null,{timeout:45000});
  check('Home defense starts nests on the integrated world',await page.evaluate(()=>WH.mode99.home.running&&WH.world.portals.some(p=>p.established&&p.active)));
  // Remove only the version from this test context to simulate a pre-kit home.
  await page.evaluate(async()=>{WH.mode99.home.running=false;WH.mode99.home.setPeace();WH.mode99.home.dirty=false;const {homeStore}=await import(new URL('js/modes/home-store.js',location.href));const h=homeStore.get('home-earth');delete h.world.terrainVersion;if(!homeStore.save(h).ok)throw Error('Legacy fixture save failed');});
  await page.reload();await ready();check('A pre-kit saved home reloads the legacy field',await page.evaluate(async()=>{const W=await import(new URL('js/world.js',location.href));return WH.CONFIG.terrainVersion===0&&W.GUIDED===null&&WH.mode99.home.active;}));
  await page.goto(base+'/debug.html#terrain/varied');await page.waitForFunction(()=>window.DEBUG_WORLD,null,{timeout:240000});await settle();
  check('Debug terrain and themed globes use production version one',await page.evaluate(()=>DEBUG_WORLD.exhibits.filter(e=>e.lane==='terrain'||e.lane==='themes').every(e=>(e.group.userData.terrain||e.group.userData.miniature).terrainVersion===1)));
  await page.screenshot({path:resolve(out,'debug-terrain.png')});await page.evaluate(()=>DEBUG_WORLD.select('formations','plateau'));await settle();await page.screenshot({path:resolve(out,'debug-plateau.png')});
  check('No game, debug or shader errors',errors.length===0,errors);
}
