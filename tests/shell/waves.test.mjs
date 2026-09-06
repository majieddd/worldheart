import{test}from'node:test';import assert from'node:assert/strict';import{registerHooks}from'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const{WaveDirector}=await import('../../js/waves.js');
test('a full enemy pool delays an owed wave spawn without paying its clear',()=>{
 let full=true,spawned=0,cleared=0;const enemies={active:[],spawn(){if(full)return null;const e={id:++spawned};this.active.push(e);return e;}},game={gold:0},waves=new WaveDirector(game,enemies,{});
 waves.state='spawning';waves.wave=1;waves.clock=0;waves.queues=[{t:0,type:'mite',portal:0,scale:1}];waves.pendingSpawns=1;waves.onWaveClear=()=>cleared++;
 waves.update(.1);assert.equal(waves.pendingSpawns,1);assert.equal(waves.queues.length,1);assert.equal(cleared,0);assert.equal(game.gold,0);
 full=false;waves.update(.1);assert.equal(spawned,1);assert.equal(waves.pendingSpawns,0);assert.equal(cleared,0);
 enemies.active=[];waves.update(.1);assert.equal(cleared,1);assert.ok(game.gold>0);
});
