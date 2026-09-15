import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AUDIO_CUES,AUDIO_DEFAULTS,AUDIO_LIMITS,cleanAudioSettings,musicState,ambienceKind} from '../js/audio-catalogue.js';
import {AUDIO_BANK} from '../js/audio-bank.js';
import {MUSIC_TRACKS} from '../js/audio-music.js';

test('corrupt stored audio settings cannot break boot or write unbounded gain',()=>{
  for(const bad of [null,false,'invalid',[],42])assert.deepEqual(cleanAudioSettings(bad),AUDIO_DEFAULTS);
  assert.deepEqual(cleanAudioSettings({master:10,music:-1,effects:NaN,ui:'1',muted:'false'}),{...AUDIO_DEFAULTS,master:1,music:0});
  assert.equal(cleanAudioSettings({muted:true}).muted,true);
});
test('music follows real victory, defeat, pressure and pause outcomes',()=>{
  assert.equal(musicState({state:'title'}),'lobby');
  assert.equal(musicState({state:'playing',waveActive:false}),'explore');
  assert.equal(musicState({state:'playing',waveActive:true}),'battle');
  assert.equal(musicState({state:'playing',waveActive:true,boss:true}),'danger');
  assert.equal(musicState({state:'playing',waveActive:true,health:.2}),'danger');
  assert.equal(musicState({state:'playing',waveActive:true,paused:true}),'explore');
  for(const state of ['victory','defeat'])assert.equal(musicState({state,paused:true}),state);
});
test('local ecological beds distinguish water, ice, volcanic and living regions',()=>{
  for(const [theme,bed]of Object.entries({woodland:'forest',oceanic:'ocean',alpine:'ice',volcanic:'lava',arid:'desert',moon:'cosmic'}))assert.equal(ambienceKind({theme}),bed);
});
test('shipped effects bank has exact provenance and no missing or overlapping cue slices',()=>{
  const bytes=readFileSync(new URL('../audio/'+AUDIO_BANK.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),AUDIO_BANK.sha256);
  assert.equal(bytes.length,AUDIO_BANK.bytes);assert.ok(bytes.length<AUDIO_LIMITS.bankBytes);
  assert.ok(AUDIO_BANK.duration*48000*4<AUDIO_LIMITS.decodedBytes);
  assert.deepEqual(Object.keys(AUDIO_BANK.cues),Object.keys(AUDIO_CUES));
  let previousEnd=0;
  for(const [key,clips]of Object.entries(AUDIO_BANK.cues)){
    assert.ok(clips.length>0,key);
    for(const clip of clips){assert.ok(clip.start>=previousEnd-.00001,key);assert.ok(clip.duration>.02,key);previousEnd=clip.start+clip.duration;assert.ok(previousEnd<=AUDIO_BANK.duration,key);}
  }
});

test('each shipped score state has a distinct, screened local YuE2 generation',()=>{
  const records=JSON.parse(readFileSync(new URL('../audio/music-provenance.json',import.meta.url)));
  assert.deepEqual(Object.keys(MUSIC_TRACKS).sort(),['battle','danger','defeat','explore','lobby','victory']);
  const hashes=new Set();let bytes=0;
  for(const [key,track]of Object.entries(MUSIC_TRACKS)){
    const r=records[key],file=readFileSync(new URL('../audio/'+track.file,import.meta.url));
    assert.equal(createHash('sha256').update(file).digest('hex'),track.sha256,key);
    assert.equal(r.sha256,track.sha256);assert.equal(file.length,track.bytes);hashes.add(track.sha256);bytes+=file.length;
    assert.equal(r.model,'Comfy-Org/YuE2');assert.equal(r.checkpointSha256,'33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee');
    assert.ok(r.license.includes('NC'));assert.ok(r.vocalScreening.maximumVocalScore<.12,key);assert.equal(r.vocalScreening.threshold,.12);
    const history=JSON.parse(readFileSync(new URL('../'+r.generationReceipt+'/history.json',import.meta.url)));
    assert.equal(history.status.status_str,'success');assert.ok(Number(r.measured.input_tp)<-.8,key);assert.ok(Math.abs(Number(r.measured.input_i)+20)<1.5,key);
  }
  assert.equal(hashes.size,6);assert.ok(bytes<10*1024*1024);
});
