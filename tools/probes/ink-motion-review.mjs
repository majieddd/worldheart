import {resolve} from 'node:path';

// Real-time playback capture complements ordered frame/limb measurements.
// It is a review artifact, not an automated verdict about perceived fluidity.
export async function run({browser,base,out,check,errors}){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/asset-stage.html');await page.waitForFunction(()=>window.INK_STAGE?.ready,null,{timeout:60000});
  await page.locator('#assets button').nth(8).click();await page.evaluate(()=>INK_STAGE.setPlaying(true));
  for(let cut=1;cut<=3;cut++){await page.locator('#clip').selectOption('Cut '+cut);await page.locator('#speed').selectOption('0.25');await page.waitForTimeout(2800);await page.locator('#speed').selectOption('1');await page.waitForTimeout(1500);check('Recorded cut '+cut+' at inspection and authored cadence',await page.evaluate(()=>INK_STAGE.state.playing&&INK_STAGE.state.fps&&INK_STAGE.rig.joints.flat().every(Number.isFinite)));}
  await page.locator('#assets button').nth(9).click();await page.waitForTimeout(1500);await page.locator('#clip').selectOption('Vent');await page.waitForTimeout(1500);await page.locator('#assets button').nth(1).click();await page.locator('#clip').selectOption('Running');await page.waitForTimeout(2200);
  const video=page.video();await context.close();await video.saveAs(resolve(out,'motion-review.webm'));check('Motion recording completed without browser errors',errors.length===0,errors);
}
