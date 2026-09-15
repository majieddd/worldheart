import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {impactCue,creatureCue,musicContext} from '../../js/audio-context.js';

test('impact contact respects target material, weapon and wooden equipment',()=>{
  assert.equal(impactCue({family:'spear'}),'spearFlesh');
  assert.equal(impactCue({family:'twinblade'}),'twinFlesh');
  assert.equal(impactCue({family:'sword',material:'wood'}),'woodFlesh');
  assert.equal(impactCue({family:'spear',target:'armor'}),'swordArmor');
  assert.equal(impactCue({target:'wood'}),'swordWood');
  assert.equal(new Set(['mite','husk','aegis','wisp','colossus'].map(creatureCue)).size,5);
});
test('soundtrack distinguishes title, lobby, worlds, boss and end states',()=>{
  assert.equal(musicContext({lobby:true}),'lobby');
  assert.equal(musicContext({state:'title',boss:true}),'title');
  assert.equal(musicContext({state:'playing',boss:true,theme:'desert'}),'desertBoss');
  assert.equal(musicContext({state:'playing',boss:true,wave:10}),'cinematicBoss');
  assert.equal(musicContext({state:'playing',boss:true}),'boss');
  assert.equal(musicContext({state:'playing',theme:'jungle'}),'tropical');
  assert.equal(musicContext({state:'playing',planet:2}),'playful');
  assert.equal(musicContext({state:'playing',planet:1}),'planet');
  assert.equal(musicContext({state:'defeat'}),'silent');
});
test('all nine published music files are the authorized originals with conservative mix gains',()=>{
  const root=new URL('../../audio/soundtrack/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
  const originals=Object.values(manifest.tracks).filter(t=>t.role!=='calm');
  assert.equal(originals.length,9);
  for(const track of originals) {
    const bytes=readFileSync(new URL(track.file,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),track.sha256);
    assert.equal(bytes.length,track.bytes);
    assert.ok(track.gain>0&&track.gain<=1);
    assert.ok(track.sourceTruePeak+20*Math.log10(track.gain)<=-1.99);
  }
});
test('five approved calm tracks keep their bytes and play only in peaceful home contexts',()=>{
  const root=new URL('../../audio/',import.meta.url);
  const soundtrack=JSON.parse(readFileSync(new URL('soundtrack/manifest.json',root)));
  const auditions=JSON.parse(readFileSync(new URL('auditions/manifest.json',root)));
  const calm=Object.values(soundtrack.tracks).filter(t=>t.role==='calm');
  assert.equal(calm.length,5);
  for(const track of calm){
    const source=auditions.tracks.find(t=>t.id===track.id);
    const bytes=readFileSync(new URL('soundtrack/'+track.file,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    assert.ok(track.truePeakDBTP+20*Math.log10(track.gain)<=-1.99);
  }
  for(const [theme,context] of [['garden','homegarden'],['canopy','homecanopy'],['desert','homedune'],['europa','homefrozen'],['io','homemolten']]){
    assert.equal(musicContext({state:'playing',homeQuiet:true,boss:true,theme}),context);
    assert.notEqual(musicContext({state:'playing',theme}),context);
  }
});
