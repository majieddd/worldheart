// Release routing and persistence checks use an isolated browser profile.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright');
const base=(process.argv[2]||'http://127.0.0.1:8141/').replace(/\/?$/,'/'),out=process.argv[3]||'artifacts/main-promotion/local';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.setDefaultNavigationTimeout(180000);page.on('pageerror',e=>errors.push(String(e)));
const check=(name,ok,actual)=>{checks.push({name,ok:!!ok,actual});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
try{
 await page.goto(base);await page.waitForURL('**/lobby.html');
 await page.locator('[data-station="homeworld"]').waitFor();
 check('Bare main route opens its own preparation lobby',page.url()===new URL('lobby.html',base).href,page.url());
 // Real valid preview saves, not malformed sentinels, verify route separation.
 const prior=await page.evaluate(async()=>{
  const {scopedStorage}=await import('./js/storage.js');
  const {createCampaignStore}=await import('./js/modes/campaign-store.js');
  const {createHomeStore}=await import('./js/modes/home-store.js');
  const {starterEarthHome}=await import('./js/run/homeworld.js');
  const store=scopedStorage(localStorage,'/v2/'),campaign=createCampaignStore(store),homes=createHomeStore(store,{starter:true});
  campaign.commit(s=>{s.account.coins=321;return true;});const home=starterEarthHome();home.name='Preview Earth marker';homes.save(home);
  return {campaign:store.getItem('wh99Campaign'),homes:store.getItem('whHomesV1')};
 });
 await page.locator('[data-station="homeworld"]').click();
 check('Released lobby offers default Earth and correct capacity',(await page.locator('.home-featured').innerText()).includes('Earth')&&await page.getByRole('heading',{name:'Home planets · 1 / 100',exact:true}).isVisible());
 await page.waitForTimeout(450);await page.screenshot({path:out+'/lobby.png'});
 const href=await page.getByRole('link',{name:'Go to Homeworld'}).getAttribute('href');
 check('Homeworld link stays on production',new URL(href,page.url()).pathname===new URL(base).pathname,href);
 await page.getByRole('link',{name:'Go to Homeworld'}).click();
 await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),null,{timeout:180000});
 const home=await page.evaluate(()=>({playing:WH.game.state,home:WH.mode99.home.active,quiet:WH.mode99.home.quiet,possessed:WH.possession.unit===WH.mode99.commander,boom:WH.possession.boomWant,theme:WH.CONFIG.environment.theme,veil:WH.world.fogVeil?.mesh.visible,title:document.querySelector('#title-overlay').classList.contains('show')}));
 check('Root Earth starts directly in clear third person',home.playing==='playing'&&home.home&&home.quiet&&home.possessed&&home.boom===4&&home.theme==='earth'&&!home.veil&&!home.title,home);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#boot')).opacity==='0');await page.screenshot({path:out+'/earth.png'});
 await page.evaluate(()=>document.exitPointerLock?.());await page.locator('#home-wave-toggle').click();
 await page.evaluate(()=>WH.step(14,30,false));
 check('Root Start waves runs the real nest-based wave director',await page.evaluate(()=>WH.mode99.home.running&&WH.waves.wave===1&&WH.world.portals.some(p=>p.active&&p.established)));
 const saved=await page.evaluate(prior=>({root:!!localStorage.getItem('whHomesV1'),previewHomes:localStorage.getItem('whV2:whHomesV1')===prior.homes,previewCampaign:localStorage.getItem('whV2:wh99Campaign')===prior.campaign}),prior);
 check('Root saves a home without altering the V2 profile',saved.root&&saved.previewHomes&&saved.previewCampaign,saved);
 await page.goto(new URL('lobby.html',base).href);await page.locator('[data-station="mission"]').click();await page.locator('#launch').waitFor();
 check('Root mission gate offers a playable expedition',await page.locator('#launch').isEnabled());
 // Inspect the click's destination while blocking only its full world boot.
 let launchURL='';await page.route('**/*',async route=>{if(route.request().isNavigationRequest()&&new URL(route.request().url()).searchParams.get('campaign')==='1'){launchURL=route.request().url();await route.fulfill({status:200,contentType:'text/html',body:'<title>Verified campaign destination</title>'});}else await route.continue();});
 await page.locator('#launch').click();await page.waitForFunction(()=>document.title==='Verified campaign destination');
 const url=new URL(launchURL);check('Mission launch retains production path and 99 Planets campaign',url.pathname===new URL(base).pathname&&url.searchParams.get('map')==='ninetynine'&&url.searchParams.get('campaign')==='1',launchURL);
 await page.unroute('**/*');
 await page.goto(new URL('v2/lobby.html#homeworld',base).href);await page.locator('.home-featured').waitFor();
 check('V2 retains its own saved home after root play',(await page.locator('.home-featured').innerText()).includes('Preview Earth marker'));
 await page.setViewportSize({width:390,height:844});
 await page.goto(new URL('lobby.html#homeworld',base).href);await page.getByRole('link',{name:'Go to Homeworld'}).waitFor();
 const fits=await page.getByRole('link',{name:'Go to Homeworld'}).evaluate(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>=44&&r.left>=0&&r.right<=innerWidth;});
 check('Main mobile lobby has a visible usable home action',fits);await page.waitForTimeout(450);await page.screenshot({path:out+'/mobile.png'});
 check('No browser exceptions',errors.length===0,errors);
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure.txt',String(e.stack));process.exitCode=1;console.error(e);}
finally{writeFileSync(out+'/results.json',JSON.stringify({base,checks,errors,scope:'Production route and save-isolation smoke. Wave time accelerated; mission destination intercepted after real UI launch.'},null,2));await browser.close();}
