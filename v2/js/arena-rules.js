export const WAVES=Object.freeze([3,5,7]);
export const UNIT_TYPES=Object.freeze([
  {id:'skirmisher',name:'Blade skirmisher',color:'#b87d65',hp:65,speed:1.8,range:2.5,damage:12,attack:.8,weapon:'sword'},
  {id:'ranger',name:'Plasma ranger',color:'#7b91a7',hp:55,speed:1.35,range:13,damage:9,attack:1.0,weapon:'rifle'},
  {id:'guard',name:'Iron guard',color:'#a99976',hp:115,speed:1.12,range:2.8,damage:19,attack:1.25,weapon:'sword'}
]);
export function segmentDistanceSquared(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=dx*dx+dy*dy+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/len)):0;return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2+(p.z-a.z-t*dz)**2;}
export function swordActive(progress){return progress>=.25&&progress<=.61;}
export function newRound(){return {phase:'tour',wave:0,kills:0,total:0,remaining:0,delay:0,respawns:0,elapsed:0};}
export function beginRound(s){Object.assign(s,newRound(),{phase:'between',delay:.5});}
export function advanceRound(s,dt){if(s.phase==='tour'||s.phase==='complete')return false;s.elapsed+=dt;if(s.phase==='between'){s.delay-=dt;if(s.delay<=0){if(s.wave>=WAVES.length){s.phase='complete';return false;}s.remaining=WAVES[s.wave++];s.total+=s.remaining;s.phase='active';return true;}}return false;}
export function registerKill(s){if(s.phase!=='active'||s.remaining<=0)return;s.kills++;s.remaining--;if(s.remaining===0){s.phase='between';s.delay=2.5;}}
