import test from 'node:test';
import assert from 'node:assert/strict';
import {freshOpening,readOpening,saveOpening,nextLesson,completeLesson,holdsFirstWave,OPENING_KEY} from '../js/run/first-expedition.js';
test('beginner wave hold remains through construction and releases on base upgrade',()=>{
  const s=freshOpening();completeLesson(s,'tower');completeLesson(s,'towerUpgrade');assert.equal(holdsFirstWave(s),true);assert.equal(nextLesson(s),'select');
  completeLesson(s,'select');assert.equal(holdsFirstWave(s),true);assert.equal(nextLesson(s),'crystal');completeLesson(s,'upgrade');assert.equal(holdsFirstWave(s),false);completeLesson(s,'select');assert.equal(s.done.length,4);
});
test('skip releases unfinished onboarding without pretending actions occurred',()=>{const s=freshOpening();s.skipped=true;assert.equal(holdsFirstWave(s),false);assert.equal(nextLesson(s),null);assert.deepEqual(s.done,[]);});
test('presentation persistence is isolated and defensive against denied or malformed storage',()=>{
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.deepEqual(readOpening(denied),freshOpening());assert.equal(saveOpening(denied,freshOpening()),false);
  const records=new Map([['wh99Campaign','unchanged']]),store={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
  store.setItem(OPENING_KEY,JSON.stringify({intro:true,story:true,done:['select','unknown','select'],seen:9}));
  assert.deepEqual(readOpening(store).done,['select']);saveOpening(store,freshOpening());assert.equal(records.get('wh99Campaign'),'unchanged');
});
