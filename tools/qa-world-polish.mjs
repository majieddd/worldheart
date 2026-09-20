// Scenarios use the shared painted-integration browser, report and error sink.
import {resolve} from 'node:path';
export async function worldPolish({page,browser,base,out,check,ready,visualOnly=false,interactionOnly=false,effectsOnly=false}){
 const shot=async name=>page.screenshot({path:resolve(out,name+'.png')});
 if(!interactionOnly){
 if(!effectsOnly){
 await page.goto(base+'/lobby.html');await page.waitForFunction(()=>window.LOBBY);await page.waitForTimeout(1800);
 check('Courtyard opens in commander follow view with seven spatial stations',await page.evaluate(()=>LOBBY.view.distance===11&&LOBBY.stations.length===7));await shot('lobby-entry');
 await page.keyboard.down('KeyW');await page.waitForTimeout(800);await page.keyboard.up('KeyW');
 check('Commander moves through the courtyard',await page.evaluate(()=>LOBBY.player.z<22));
 await page.getByRole('button',{name:'🎲 Weapons Roller',exact:true}).click();
 check('Roller explains real pack, currency and home rarity cap',await page.locator('#roller-pack').isVisible()&&await page.locator('#roll-weapon').isDisabled());await shot('lobby-roller-empty');
 // Isolated browser save fixture, not a reward in the player's save.
 await page.evaluate(async()=>{const {homeStore}=await import('./js/modes/home-store.js'),{generateWeapon}=await import('./js/run/weapons.js');const h=homeStore.get('home-earth');h.checkpoint.inventory.scrap=9;h.checkpoint.inventory.items=['fixture-a','fixture-b','fixture-c'].map(id=>generateWeapon({id,seed:1,family:'sword',rng:()=>.1}));homeStore.save(h);LOBBY.openStation('weapons');});
 await page.locator('#roll-weapon').click();check('Real roller click spends 3 scrap and shows a rendered weapon',await page.locator('.roller-balance').innerText().then(t=>t.startsWith('6 scrap'))&&await page.locator('#roller-result img').isVisible());await shot('lobby-roller-result');
 for(const id of ['fixture-a','fixture-b','fixture-c'])await page.locator(`.roller-item input[value="${id}"]`).check();await page.locator('#merge-weapons').click();
 check('Real merge persists a stronger weapon without spending extra scrap',await page.evaluate(async()=>{const {homeStore}=await import('./js/modes/home-store.js');const s=homeStore.get('home-earth').checkpoint.inventory;return s.scrap===6&&s.items.length===2&&s.items.some(w=>w.rarity==='uncommon');}));
 await page.reload();await page.waitForFunction(()=>window.LOBBY);await page.getByRole('button',{name:'🎲 Weapons Roller',exact:true}).click();check('Roller result survives reload',await page.locator('.roller-item').count()===2);
 await page.evaluate(async()=>{const {campaignStore}=await import('./js/modes/campaign-store.js'),{startExpedition}=await import('./js/run/campaign.js');campaignStore.commit(s=>startExpedition(s,{seed:23456,limit:99}));LOBBY.openStation('mission');});
 check('Start pad explicitly selects a fresh route',await page.locator('#fresh-expedition').isChecked()&&await page.locator('#launch').innerText()==='Launch expedition');
 await page.evaluate(()=>LOBBY.openStation('mission-return'));check('Continue pad protects the saved route',!await page.locator('#fresh-expedition').isChecked()&&await page.locator('#launch').innerText()==='Continue expedition');
 await page.locator('#launch').click();await ready();await page.waitForFunction(()=>WH.game.state==='playing');check('Join pad launches the selected commander into the campaign',await page.evaluate(()=>WH.CONFIG.mapKey==='ninetynine'&&!!WH.CONFIG.campaign),await page.evaluate(()=>({map:WH.CONFIG.mapKey,campaign:!!WH.CONFIG.campaign,state:WH.game.state,commander:WH.mode99.commander.typeKey})));
 }
 await page.goto(base+'/debug.html#disasters/meteor');await page.waitForFunction(()=>window.DEBUG_WORLD,null,{timeout:180000});
 const exhibits=await page.evaluate(effects=>DEBUG_WORLD.exhibits.filter(e=>effects?e.lane==='disasters':['disasters','features','structures','biomes'].includes(e.lane)||e.lane==='formations'&&['valley','grotto','caverns','arcade','ribbons'].includes(e.key)).map(e=>[e.lane,e.key]),effectsOnly);
 for(const [lane,key]of exhibits){await page.evaluate(([l,k])=>{DEBUG_WORLD.select(l,k);if(l==='disasters')DEBUG_WORLD.selected.animationStart=DEBUG_WORLD.time-2;},[lane,key]);await page.waitForTimeout(280);await shot(lane+'-'+key);}
 // Freeze the exhibit's production update only for labeled review frames.
 // The ordinary catalogue still loops through anticipation, travel and impact.
 for(const [key,t,warning,name]of [['meteor',1,true,'meteor-warning'],['meteor',3.55,false,'meteor-approach'],['meteor',.18,false,'meteor-impact'],['thunder',.1,false,'lightning-strike'],['solar',.2,false,'radiation-strike'],['quake',1,true,'quake-warning'],['sandstorm',1,true,'sand-warning']]){
  await page.evaluate(([key,t,warning])=>{DEBUG_WORLD.select('disasters',key);const art=DEBUG_WORLD.selected.group.children[1];art.userData.qaOriginal??=art.userData.update;art.userData.update=()=>art.userData.qaOriginal(t,warning);art.userData.update();},[key,t,warning]);await page.waitForTimeout(130);await shot('phase-'+name);
 }
 if(!effectsOnly)for(const theme of ['earth','moon','mars','mercury','venus','jupiter','saturn','uranus','neptune','titan','europa','ganymede','triton','io','callisto','pluto']){await page.evaluate(k=>DEBUG_WORLD.select('themes',k),theme);await page.waitForTimeout(350);await shot('planet-'+theme);}
 check('Debug World renders production scenery and Solar System miniatures',await page.evaluate(()=>DEBUG_WORLD.renderer.info.render.triangles>0));
 }if(visualOnly||effectsOnly)return;
 const start=Date.now();await page.goto(base+'/?home=home-earth');await ready();await page.waitForFunction(()=>WH.mode99.home.quiet&&WH.game.state==='playing');
 const anchors=await page.evaluate(()=>({ms:performance.now(),stages:WH.bootStages,centre:WH.nav.fieldCenter.toArray(),heart:Array.from(WH.nav.dirs.slice(WH.nav.heartNode*3,WH.nav.heartNode*3+3)),portals:WH.nav.portalNodes.map(n=>Array.from(WH.nav.dirs.slice(n*3,n*3+3))),healthy:WH.nav.portalNodes.every(n=>Number.isFinite(WH.nav.dist[n])),attempts:WH.nav.attempts}));
 check('Revised Earth home retains connected anchor routes',anchors.healthy,{...anchors,loadMs:Date.now()-start});
 const wall=await page.evaluate(()=>{const m=WH.mode99,w=m.walls;WH.possession.exit();w.stock=30;let dir=null;for(let i=0;i<50;i++){const d=WH.game.frontier.centre.clone().addScaledVector(m.commander.fwd,8/WH.CONFIG.planetRadius).addScaledVector(m.commander.dir.clone().cross(m.commander.fwd),(i-25)/WH.CONFIG.planetRadius).normalize();if(w.valid(d,0)){dir=d;break;}}if(!dir)return {first:false};const placeStart=performance.now(),first=w.place(dir,0),end=w.endpoints(dir,0)[1],delta=end.clone().sub(w.endpoints(dir,0)[0]).normalize(),raw=end.clone().addScaledVector(delta,1.35).normalize(),snap=w.snap(raw,0),gap=Math.min(...w.endpoints(snap,0).map(v=>v.distanceTo(end))),second=w.place(snap,0),duplicate=w.valid(dir,0);w.start();return {first,second,gap,duplicate,count:w.items.length,placementMs:performance.now()-placeStart};});
 check('Two wall placements avoid a synchronous route stall',wall.placementMs<100,wall);
 check('Walls join on the globe and reject duplicates',wall.first&&wall.second&&wall.gap<.28&&!wall.duplicate,wall);
 const corner=await page.evaluate(()=>{const w=WH.mode99.walls,first=w.items[0],joint=w.endpoints(first.dir,first.angle)[0],axis=first.root.localToWorld(first.dir.clone().set(0,0,1)).sub(first.root.position).normalize(),raw=joint.clone().addScaledVector(axis,1.4).normalize(),dir=w.snap(raw,Math.PI/2),gap=Math.min(...w.endpoints(dir,Math.PI/2).map(v=>v.distanceTo(joint)));return {gap,snapped:w.snapped,placed:w.place(dir,Math.PI/2)};});
 check('A rotated corner snaps without blocking its own adjoining segment',corner.snapped&&corner.placed&&corner.gap<.28,corner);
 const before=await page.evaluate(()=>({turn:WH.mode99.walls.turn,zoom:WH.rig.targetDist}));await page.mouse.move(700,420);await page.mouse.wheel(0,100);await page.waitForTimeout(180);const after=await page.evaluate(()=>({turn:WH.mode99.walls.turn,zoom:WH.rig.targetDist}));
 check('Wheel rotates the selected wall without zooming',after.turn!==before.turn&&after.zoom===before.zoom,{before,after});await shot('wall-building');
 check('Wall selector shares the desktop tower bar',await page.locator('#build-bar .wall-card').isVisible());
 await page.waitForFunction(()=>!WH.mode99.walls.routeJob,null,{timeout:30000});check('Wall routes finish without blocking the click',await page.evaluate(()=>WH.nav.wallPenalty.some(x=>x>0)&&Number.isFinite(WH.nav.dist[WH.nav.heartNode])));

 await page.evaluate(()=>{const m=WH.mode99,c=m.commander,site=m.structures.items.find(s=>s.kind==='bunker')||m.structures.items[0];m.walls.cancel();const p=site.root.localToWorld(c.dir.clone().set(0,0,2.2)),chest=site.chest.getWorldPosition(c.dir.clone());c.dir.copy(p).normalize();c.fwd.copy(chest).sub(p).addScaledVector(c.dir,-chest.clone().sub(p).dot(c.dir)).normalize();WH.allies._ground(c);c._renderDir.copy(c.dir);WH.possession.enter(c,{lock:false});WH.possession.boom=WH.possession.boomWant=4;WH.possession.pitch=-.15;});
 await page.waitForTimeout(450);await page.locator('.structure-open').click();await page.waitForTimeout(180);
 const chest=await page.evaluate(()=>({bursts:WH.mode99.structures.bursts.length,flight:[...WH.mode99.loot.entries.values()].filter(e=>e.flight).length,lids:WH.mode99.structures.items.filter(s=>s.openAge>0&&s.lid.rotation.x<0).length}));
 check('Opening a real chest button animates its lid and ejects reward models',chest.lids>0&&(chest.bursts>0||chest.flight>0),chest);await shot('chest-reward');
 const touch=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),mobile=await touch.newPage();
 await mobile.addInitScript(()=>{localStorage.setItem(location.pathname.includes('/v2/')?'whV2:whFirstExpedition1':'whFirstExpedition1',JSON.stringify({intro:true,story:true,skipped:true,done:[],seen:[]}));});
 await mobile.goto(base+'/?home=home-earth');await mobile.waitForFunction(()=>window.WH?.game?.state==='playing',null,{timeout:180000});
 await mobile.evaluate(()=>{WH.possession.exit();WH.rig.targetDist=WH.rig.dist=150;WH.rig.flight=null;WH.mode99.walls.stock=5;});await mobile.waitForTimeout(500);
 await mobile.screenshot({path:resolve(out,'touch-before-build.png')});
 check('Touch action bar has usable towers and a wall card',await mobile.locator('.touch-hotbar .build-card').count()>0&&await mobile.locator('#touch-wall').isVisible(),await mobile.evaluate(()=>({enabled:WH.mobile.enabled,paused:WH.game.paused,worldgen:WH.CONFIG.worldgen,hidden:WH.mobile.root.hidden,blocked:WH.mobile.blockedOverlay(),cards:document.querySelectorAll('.touch-hotbar .build-card').length,mode:!!WH.mobile.mode,wall:!!WH.mobile.mode?.walls,wallHidden:document.querySelector('#touch-wall').hidden})));
 await mobile.locator('#touch-wall').tap();await mobile.waitForTimeout(400);check('Touch wall card enters the same placement flow',await mobile.evaluate(()=>WH.mode99.walls.placing)&&await mobile.locator('#touch-confirm').isVisible(),await mobile.evaluate(()=>({placing:WH.mode99.walls.placing,canAct:WH.mobile.canAct(),stock:WH.mode99.walls.stock,paused:WH.game.paused,overlay:WH.mobile.blockedOverlay()})));await mobile.locator('#touch-cancel').tap();
 const session=await touch.newCDPSession(mobile),point=(x,id)=>({x,y:180,id,radiusX:4,radiusY:4});
 const getZoom=()=>mobile.evaluate(()=>({distance:WH.rig.targetDist,lon:WH.rig.lon,lat:WH.rig.lat}));const initial=await getZoom();
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(355,1),point(485,2)]});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(355-i*8,1),point(485+i*8,2)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);const spread=await getZoom();
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(315,1),point(525,2)]});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(315+i*8,1),point(525-i*8,2)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);const pinched=await getZoom();
 check('Two-finger spreading zooms in; pinching zooms out without rotating the map',spread.distance<initial.distance&&pinched.distance>spread.distance&&Math.abs(pinched.lon-initial.lon)<.002&&Math.abs(pinched.lat-initial.lat)<.002,{initial,spread,pinched});
 await mobile.screenshot({path:resolve(out,'touch-strategy.png')});await touch.close();
}
