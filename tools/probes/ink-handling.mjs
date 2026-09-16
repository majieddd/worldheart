import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {GRAPHICS_DEFAULTS,GRAPHICS_ORIGINAL} from '../../js/arena-presets.js';
export async function run({page,browser,base,out,check,sharp,errors}){
  const snaps=[],frames=[],context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:out,size:{width:1280,height:800}}}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(String(e)));await p.goto(base+'/atmospheric-arena.html?world=canyon');await p.waitForFunction(()=>window.INK_ARENA?.ready,null,{timeout:60000});
  const val=f=>p.evaluate(f),tick=async n=>val(()=>{}).then(()=>p.evaluate(n=>{for(let i=0;i<n;i++)INK_ARENA.step(1/120);INK_ARENA.render();},n));
  check('Fresh arena starts with exact new Vivid values',await p.evaluate(g=>JSON.stringify(INK_ARENA.graphics)===JSON.stringify(g),GRAPHICS_DEFAULTS));
  await p.locator('#graphics').click();await p.locator('[data-preset="default"]').click();check('Original 1.3.1 remains exact and independently selectable',await p.evaluate(g=>JSON.stringify(INK_ARENA.graphics)===JSON.stringify(g),GRAPHICS_ORIGINAL));await p.locator('#restore').click();check('Reset selects Vivid and restores current default',await p.locator('[data-preset="vivid"]').getAttribute('aria-pressed')==='true');await p.locator('#close-settings').click();await p.locator('#enter').click();
  await val(()=>{INK_ARENA.manual=true;INK_ARENA.reset();INK_ARENA.pause(false);INK_ARENA.player.position.x=3;});
  await p.keyboard.down('KeyW');await tick(120);const walk=await val(()=>({z:INK_ARENA.player.position.z,v:INK_ARENA.player.velocity.z}));check('Actual W input travels over four units in one second',11-walk.z>4&&11-walk.z<4.5,walk);
  await p.keyboard.down('ShiftLeft');await tick(60);const sprint=await val(()=>({...INK_ARENA.handling}));check('Forward sprint reaches 7.1 units per second',Math.abs(sprint.vz+7.1)<.01,sprint);
  await p.keyboard.down('KeyC');await tick(12);const slide=await val(()=>({...INK_ARENA.handling}));check('Actual sprint/C starts momentum slide and lowers camera',slide.slide>.65&&slide.vz<-7.8&&slide.eye<1.4,slide);
  await p.keyboard.up('KeyC');await p.keyboard.up('ShiftLeft');await p.keyboard.up('KeyW');await tick(100);check('Slide ends and standing view recovers smoothly',await val(()=>!INK_ARENA.handling.slide&&INK_ARENA.handling.eye>1.9));
  await p.keyboard.press('Digit2');await tick(30);await p.mouse.down({button:'right'});await tick(12);check('ADS passes through an intermediate pose',await val(()=>INK_ARENA.handling.ads>.49&&INK_ARENA.handling.ads<.51));await tick(12);check('ADS completes in 0.20 seconds',await val(()=>INK_ARENA.handling.ads>.999));
  await p.screenshot({path:resolve(out,'aimed-rifle.png')});
  const shots=await val(()=>INK_ARENA.state.shots);await p.mouse.down({button:'left'});await tick(60);await p.mouse.up({button:'left'});check('Left release stops fire while right aim stays held',await val(()=>INK_ARENA.handling.ads>.99)&&(await val(()=>INK_ARENA.state.shots))>shots+2);await tick(24);check('Aim remains after trigger release',await val(()=>INK_ARENA.handling.ads>.99));
  await p.mouse.down({button:'left'});await p.mouse.up({button:'right'});const n=await val(()=>INK_ARENA.state.shots);await tick(42);check('Right release leaves held fire active',await val(()=>INK_ARENA.state.shots)>n);await p.mouse.up({button:'left'});await tick(30);
  // Full rendered ADS cycle, including entering, firing and returning to hip.
  for(let i=0;i<20;i++){
    if(i===2)await p.mouse.down({button:'right'});if(i===8)await p.mouse.down({button:'left'});if(i===11)await p.mouse.up({button:'left'});if(i===13)await p.mouse.up({button:'right'});
    await tick(8);const b=await p.screenshot();snaps.push({input:await sharp(b).resize(320,200).toBuffer(),left:(i%4)*320,top:Math.floor(i/4)*200});frames.push(await val(()=>({ads:INK_ARENA.handling.ads,fov:INK_ARENA.camera.fov,joints:INK_ARENA.rig.joints})));
  }
  await sharp({create:{width:1280,height:1000,channels:3,background:'#132838'}}).composite(snaps).png().toFile(resolve(out,'ads-cycle.png'));
  check('All sampled ADS limbs stay finite with fixed segment lengths',frames.every(f=>f.joints.flat().every(Number.isFinite)&&[0,3].every(i=>Math.abs(Math.hypot(...f.joints[i].map((v,j)=>v-f.joints[i+1][j]))-.45)<1e-5&&Math.abs(Math.hypot(...f.joints[i+1].map((v,j)=>v-f.joints[i+2][j]))-.44)<1e-5)));
  await val(()=>{INK_ARENA.selectWorld('meadow');INK_ARENA.pause(false);INK_ARENA.state.flight=true;INK_ARENA.player.position.set(-10,5,8.5);INK_ARENA.setView(0,.08);INK_ARENA.render();});
  const foliage=await val(()=>INK_ARENA.foliage);check('Live foliage attaches formerly hovering accents',foliage.leaves===4480&&foliage.reattached>0&&foliage.maxRadiusBefore>1.1&&foliage.maxRadiusAfter<=.965001,foliage);await p.screenshot({path:resolve(out,'connected-canopy.png')});
  await val(()=>{INK_ARENA.selectWorld('canyon');INK_ARENA.manual=false;INK_ARENA.pause(false);INK_ARENA.chooseWeapon('rifle');INK_ARENA.player.position.x=3;});
  await p.keyboard.down('KeyW');await p.keyboard.down('ShiftLeft');await p.waitForTimeout(550);await p.keyboard.down('KeyC');await p.waitForTimeout(250);await p.keyboard.up('KeyC');await p.keyboard.up('ShiftLeft');await p.mouse.down({button:'right'});await p.mouse.down({button:'left'});await p.waitForTimeout(500);await p.mouse.up({button:'left'});await p.mouse.up({button:'right'});await p.keyboard.up('KeyW');await p.waitForTimeout(700);
  const live=await val(()=>({handling:{...INK_ARENA.handling},events:INK_ARENA.events,state:{...INK_ARENA.state}}));check('Real-time sprint-slide-aim-fire sequence executes',live.events.some(e=>e.kind==='slide-start')&&live.state.shots>2);
  await p.keyboard.press('Escape');check('Pause clears held inputs and stops simulation',await val(()=>INK_ARENA.state.paused));
  await p.goto(base+'/asset-stage.html');await p.waitForFunction(()=>window.INK_STAGE?.ready,null,{timeout:60000});check('Stage also starts with Vivid by default',await p.evaluate(g=>INK_STAGE.state.preset==='vivid'&&JSON.stringify(INK_STAGE.graphics)===JSON.stringify(g),GRAPHICS_DEFAULTS));
  await p.evaluate(()=>{INK_STAGE.select(8,true);INK_STAGE.state.clip='Guard';INK_STAGE.state.time=.3;INK_STAGE.advance(0);INK_STAGE.draw();});check('Stage guard scrubs to its articulated guard pose',await p.evaluate(()=>INK_STAGE.rig.sword.root.quaternion.z>.4));
  await p.evaluate(()=>{INK_STAGE.select(9,true);INK_STAGE.state.clip='Aim';INK_STAGE.state.time=.3;INK_STAGE.advance(0);INK_STAGE.draw();});check('Stage Aim scrubs to the same centered optical grip',await p.evaluate(()=>Math.abs(INK_STAGE.rig.rifle.root.position.x)<1e-4&&Math.abs(INK_STAGE.rig.rifle.root.position.y+.324)<1e-4));
  writeFileSync(resolve(out,'handling.json'),JSON.stringify({walk,sprint,slide,foliage,frames,live},null,2));await context.close();await p.video().saveAs(resolve(out,'handling-input.webm'));check('No handling browser errors',errors.length===0,errors);
}
