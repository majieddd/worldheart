import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export async function run({page,base,out,check,sharp,errors,httpFailures}){
  const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});};
  const overflow=()=>page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  const inspectImages=()=>page.evaluate(()=>[...document.images].filter(i=>i.getBoundingClientRect().width>0).map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
  const evidence={drafts:[],topics:[]};
  for(const id of ['field','arcade','signal']){
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base+'/design-demos/99-planets/'+id+'.html');
    await page.locator('button[data-mode="combat"]').waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    await capture(id+'-combat');
    if(process.argv.includes('--save-ui-previews'))await sharp(resolve(out,id+'-combat.png')).webp({quality:92}).toFile(resolve('lib/99-art/ui-'+id+'.webp'));
    const layout=await overflow();check(id+' desktop fits viewport',layout.scroll<=layout.width,layout);
    await page.keyboard.press('z');
    check(id+' Z selects Aegis Ward',await page.locator('[role="status"]').innerText().then(t=>t.includes('Aegis Ward')));
    await page.keyboard.press('v');
    check(id+' V selects Cyclone Slash',await page.locator('[role="status"]').innerText().then(t=>t.includes('Cyclone Slash')));
    await page.locator('button[data-mode="build"]').click();
    await capture(id+'-build');
    const place=id==='field'?'#placement-toggle':id==='arcade'?'#place-tower':'.place-button';
    // Each composition uses its own visible placement control.
    const placement=page.locator(place);
    if(await placement.count())await placement.click();else await page.getByRole('button',{name:/Preview placement/i}).click();
    check(id+' build placement control changes feedback',await page.locator('body').innerText().then(t=>/placement (preview|ready|active|confirmed)|Cancel preview|Cancel placement|Place Bolt Sentinel/i.test(t)));
    await page.locator('button[data-mode="loadout"]').click();
    for(const faction of ['alien','brainshot','rainboom','anomalous','axiom']){
      await page.locator('[data-faction="'+faction+'"]').click();
      await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
      check(id+' displays '+faction+' equipment',await page.locator('img[src$="/'+faction+(id==='arcade'?'-arsenal':'')+'.webp"]').count()>0);
    }
    await page.locator('[data-faction="brainshot"]').click();
    await capture(id+'-loadout');
    if(id==='field'){
      const before=await page.locator('#backpack-name').innerText();await page.locator('#equip-backpack').click();
      check('Field explicitly equips backpack into selected slot',await page.locator('.equip-slot[aria-pressed="true"] .slot-name').innerText()===before);
    }else if(id==='signal'){
      await page.locator('[data-faction="rainboom"]').click();await page.locator('.equip-button').click();
      check('Signal explicit equip updates combat maker',await page.locator('.weapon .family').first().textContent()==='RainBOOM');
    }else{
      const before=await page.locator('#backpack-weapon').innerText();await page.locator('#equip-button').click();
      check('Arcade explicitly swaps backpack into selected slot',await page.locator('.equipment .weapon-slot[aria-pressed="true"] strong').innerText()===before&&await page.locator('#backpack-weapon').innerText()!==before);
    }
    await page.keyboard.press('Escape');
    check(id+' Escape returns to combat',await page.locator('button[data-mode="combat"]').getAttribute('aria-selected')==='true');
    await page.setViewportSize({width:390,height:844});
    await capture(id+'-mobile');
    check(id+' mobile has no page overflow',(await overflow()).scroll<=390,await overflow());
    await page.locator('button[data-mode="loadout"]').click();
    const select=page.locator('select:visible');
    if(await select.count())await select.selectOption('rainboom');else await page.locator('[data-faction="rainboom"]').click();
    await capture(id+'-mobile-loadout');
    const images=await inspectImages();check(id+' mobile equipment images load',images.every(i=>i.loaded),images);
    check(id+' mobile loadout has no page overflow',(await overflow()).scroll<=390,await overflow());
    evidence.drafts.push({id,images});
  }
  if(!process.argv.includes('--99-drafts')){
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/99-art.html');await page.waitForFunction(()=>window.PLANET_ART);
    const topics=await page.locator('nav [data-page]').evaluateAll(a=>a.map(n=>n.dataset.page));
    for(const topic of topics){
      await page.locator('nav [data-page="'+topic+'"]').click();
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
      const images=await inspectImages();
      check(topic+' has dedicated URL, content and loaded art',new URL(page.url()).searchParams.get('page')===topic&&await page.locator('#page h1').count()===1&&images.every(i=>i.loaded),images);
      await capture('collection-'+topic);
      evidence.topics.push({topic,images});
    }
    await page.locator('nav [data-page="alien"]').click();
    check('Alien mark preserves repeated-letter cipher',await page.locator('[data-glyph]').evaluateAll(p=>p.map(e=>e.dataset.glyph).join(''))==='ayylmao');
    await page.locator('[data-plate="alien"]').click();await page.locator('#plate-full').evaluate(i=>i.decode());
    check('Full-size plate opens as a modal',await page.locator('#plate-viewer').evaluate(d=>d.open));
    const downloadPromise=page.waitForEvent('download');await page.locator('#plate-download').click();const download=await downloadPromise;await download.saveAs(resolve(out,'download-alien.png'));
    const catalogue=JSON.parse(readFileSync('lib/99-art/catalogue.json','utf8'));
    const sha=b=>createHash('sha256').update(b).digest('hex');
    check('Downloaded original matches saved identity',sha(readFileSync(resolve(out,'download-alien.png')))===catalogue.plates.find(p=>p.id==='alien').sha256);
    await page.keyboard.press('Escape');
    check('Escape closes full-size plate and restores focus',await page.locator('[data-plate="alien"]').evaluate(b=>document.activeElement===b));
    await page.locator('nav [data-page="story"]').click();
    check('Opening separates safe flyby fact from fictional invasion',await page.locator('#page').innerText().then(t=>t.includes('safely pass')&&t.includes('interception')&&t.includes('are fiction')));
    await page.locator('nav [data-page="axiom"]').click();await page.locator('#load-axiom').click();
    await page.waitForFunction(()=>document.querySelector('#load-axiom').textContent==='Live Axiom reference loaded',null,{timeout:65000});
    const stage=page.frames().find(f=>f.url().includes('asset-stage.html'));
    check('Axiom live reference loads a real WebGL asset',await stage.evaluate(()=>INK_STAGE.ready&&document.querySelector('canvas').width>0));
    await capture('axiom-live-model');
    await page.locator('nav [data-page="ui"]').click();await page.goBack();
    check('History restores topic',await page.locator('#page h1').innerText()==='Axiom');
    for(const topic of ['earth','ui','brand','alien']){
      await page.setViewportSize({width:390,height:844});await page.locator('nav [data-page="'+topic+'"]').click();await capture('collection-'+topic+'-mobile');
      check(topic+' collection mobile fits screen',(await overflow()).scroll<=390,await overflow());
    }
    for(const plate of catalogue.plates){const response=await page.request.get(base+'/lib/99-art/'+plate.file);check(plate.id+' original served byte-identical',response.ok()&&sha(await response.body())===plate.sha256);}
    const foundation=await page.request.get(base+'/lib/99-art/design-foundation.md');check('Design foundation download exists',foundation.ok()&&(await foundation.text()).includes('99 Planets To Defend'));
    const previous=JSON.parse(readFileSync('lib/artboard/catalogue.json','utf8'));
    for(const plate of previous.plates){const response=await page.request.get(base+'/lib/artboard/'+plate.file);check('Medieval original preserved: '+plate.id,response.ok()&&sha(await response.body())===plate.sha256);}
    await page.goto(base+'/artboard.html');check('Earlier collection is clearly archived',await page.locator('.archive-note').innerText().then(t=>t.includes('medieval-planet')));
  }
  check('No JavaScript or resource errors',errors.length===0&&httpFailures.length===0,{errors,httpFailures});
  writeFileSync(resolve(out,'art-direction-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
}
