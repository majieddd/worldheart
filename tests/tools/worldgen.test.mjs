import {test} from 'node:test';
import assert from 'node:assert/strict';
import {worldgenUrl, rememberWorld} from '../../js/worldgen.js';
import {scopedStorage} from '../../js/storage.js';

test('generator URLs retain the deployed path and explicitly separate inspection from campaign play',()=>{
 const base='https://example.com/worldheart/v2/?campaign=1&seed=33#old';
 const inspect=new URL(worldgenUrl(base,12345,'alpine'));
 assert.equal(inspect.pathname,'/worldheart/v2/');assert.equal(inspect.searchParams.get('campaign'),'0');
 assert.equal(inspect.searchParams.get('worldgen'),'1');assert.equal(inspect.searchParams.get('seed'),'12345');assert.equal(inspect.hash,'');
 const classic=new URL(worldgenUrl(base,4294967295,'classic',false));
 assert.equal(classic.searchParams.get('map'),'giant');assert.equal(classic.searchParams.has('terrain'),false);assert.equal(classic.searchParams.has('worldgen'),false);
 for(const seed of [0,-1,Infinity,1.5,4294967296])assert.throws(()=>worldgenUrl(base,seed));
 assert.throws(()=>worldgenUrl(base,1,'unknown'));
});

test('world history deduplicates seed and terrain together and bounds local growth',()=>{
 let history=[];
 for(let seed=1;seed<=20;seed++)history=rememberWorld(history,{seed,terrain:'varied'});
 assert.equal(history.length,12);assert.equal(history[0].seed,20);assert.equal(history.at(-1).seed,9);
 history=rememberWorld(history,{seed:20,terrain:'alpine'});assert.equal(history.length,12);assert.equal(history[1].terrain,'varied');
 history=rememberWorld(history,{seed:20,terrain:'alpine'});assert.equal(history.length,12);assert.equal(history[1].terrain,'varied');
 assert.deepEqual(rememberWorld([null,{seed:-1,terrain:'varied'}],{seed:1,terrain:'classic'}),[{seed:1,terrain:'classic'}]);
});

test('inspector preferences, history and rewards never read or overwrite normal V2 or production saves',()=>{
 const data=new Map([['whV2:wh99Campaign','campaign'],['wh99Campaign','production'],['whV2:whCamTune','camera']]);
 const raw={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const lab=scopedStorage(raw,'/worldheart/v2/','whWorldgen:');
 assert.equal(lab.getItem('wh99Campaign'),null);assert.equal(lab.getItem('whCamTune'),null);
 lab.setItem('wh99Campaign','test');lab.setItem('whCamTune','test camera');lab.removeItem('wh99Campaign');
 assert.equal(data.get('whV2:wh99Campaign'),'campaign');assert.equal(data.get('wh99Campaign'),'production');assert.equal(data.get('whV2:whCamTune'),'camera');
});
