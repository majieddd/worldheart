// Home checkpoints are plain data. The browser adapter owns storage and meshes.
import { MAX_HEART_LEVEL } from './schedule.js';
import { createInventory, validWeapon } from './weapons.js';
import { POWER_BY_ID } from './powers.js';
import { PLANET_THEMES } from './planet-environments.js';
import { TERRAIN_PACKS } from './world-catalogue.js';
import { planetEnvironment } from './planet-environments.js';
import { createRunState } from './state.js';
import {CURRENT_TERRAIN_VERSION,validTerrainVersion} from './terrain-version.js';
export const HOME_VERSION = 1;
export const DECORATIONS = {
  lantern: { name: 'Crystal lantern', color: 0x59f2ff },
  garden: { name: 'Flower garden', color: 0xb8d979 },
  banner: { name: 'Victory banner', color: 0xb6a4e8 },
  bench: { name: 'Resting bench', color: 0xa18d6e },
  arch: { name: 'Garden arch', color: 0x91ac8d },
  monument: { name: 'Heart monument', color: 0x91c9d8 },
};
export const canClaimHome = (level, phase, busy = false, conquered = false) => level >= MAX_HEART_LEVEL
  && ['building','victory'].includes(phase) && !busy && conquered;
export const HOME_CHECKPOINT_INTERVAL=10;
export const EARTH_HOME_ID='home-earth';
export function starterEarthHome(){
  const seed=12345,environment=planetEnvironment(seed,'earth'),run=createRunState({seed,playerIds:['solo']});
  Object.assign(run,{heartLevel:MAX_HEART_LEVEL,frontierSteps:10,endless:true,conquest:'won',hand:['bolt','cryo','mortar'],unlockedTowers:['bolt','cryo','mortar','tesla','helios','warden'],coins:0,rngState:seed});
  // The starter world's certified anchors avoid repeating the expensive seed
  // search on every new device. Recertified against v3: all five portal routes
  // remain finite and the heart retains its buildable opening courtyard.
  const centre=[.9078024509717959,.15408265393676962,-.3900682578285518];
  const portals=[[.6801780331007379,.6080736400562928,-.40939503118125603],[.8955682196225241,-.34300387963419166,-.2833829609521985],[.9667618343511912,.23208756910083342,.10727029370140632],[.6846683613657987,.059442877702197174,-.7264267197970857],[.837718025117125,.5415445664233771,-.07041301705778767]];
  return {version:HOME_VERSION,id:EARTH_HOME_ID,name:'Earth',starter:false,decorations:[],
    world:{seed,terrainVersion:CURRENT_TERRAIN_VERSION,radius:environment.radius,terrain:'varied',environment,planetIndex:1,centre,heart:[...centre],portals},
    checkpoint:{run,commander:'commander',mount:'none',inventory:createInventory('commander').snapshot(),gold:650,lives:20,maxLives:20,kills:0,score:0,forged:0,lootSequence:0,towers:[],faults:[]}};
}
// Equipment survives a defense rollback. The loot stream/sequence continue,
// and old ground drops are discarded so salvaged checkpoint loot cannot duplicate.
export function homeDefeatCheckpoint(saved,gear){
  const restored=JSON.parse(JSON.stringify(saved));
  for(const key of ['inventory','lootSequence','lootRng','forged','structures'])if(gear[key]!==undefined)restored[key]=JSON.parse(JSON.stringify(gear[key]));
  restored.loot=[];return restored;
}
export function unitVector(v) {
  return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) && Math.abs(Math.hypot(...v)-1)<.002;
}
const finite = (n, min=0, max=1e12) => Number.isFinite(n) && n>=min && n<=max;
export function validateHome(home) {
  if(home?.starter!==undefined&&home.starter!==false&&(home.starter!==true||home.id!==EARTH_HOME_ID))return false;
  if(home?.defenseCheckpoint&&!validateHome({...home,checkpoint:home.defenseCheckpoint,defenseCheckpoint:undefined}))return false;
  const c=home?.checkpoint,w=home?.world,s=c?.run;
  if(home?.version!==HOME_VERSION || typeof home.id!=='string' || !/^[a-z0-9-]{1,80}$/.test(home.id))return false;
  if(typeof home.name!=='string'||home.name.length>60||!home.name.trim())return false;
  if(!w || !Number.isInteger(w.seed)||!finite(w.seed,1,0xffffffff)||!finite(w.radius,10,4000)
    || !unitVector(w.centre)||!unitVector(w.heart)||!Array.isArray(w.portals)||!w.portals.length||!w.portals.every(unitVector))return false;
  if(!validTerrainVersion(w.terrainVersion)||!w.environment||!Object.hasOwn(PLANET_THEMES,w.environment.theme)||!Object.hasOwn(TERRAIN_PACKS,w.terrain))return false;
  if(!c||!s||s.heartLevel!==MAX_HEART_LEVEL||s.frontierSteps!==10||s.phase!=='building'||!s.endless
    ||!Number.isInteger(s.wavesCleared)||!finite(s.wavesCleared,0,100000))return false;
  if(!['commander','duelist','marksman','bombardier','oracle'].includes(c.commander)||!c.inventory)return false;
  try{createInventory(c.commander,c.inventory);}catch{return false;}
  const towerKeys=['bolt','cryo','mortar','tesla','helios','warden'];
  if(!Array.isArray(s.powers)||s.powers.some(id=>!POWER_BY_ID[id])||!Array.isArray(s.hand)||s.hand.length>4||s.hand.some(id=>!towerKeys.includes(id))
    ||!Array.isArray(s.unlockedTowers)||!s.unlockedTowers.length||s.unlockedTowers.some(id=>!towerKeys.includes(id))||!Array.isArray(s.players))return false;
  if(c.loot&&(!Array.isArray(c.loot)||c.loot.length>256||!c.loot.every(d=>validWeapon(d.item)&&unitVector(d.dir)&&finite(d.height,-200,1000))))return false;
  if(c.caches&&(!Array.isArray(c.caches)||c.caches.length>60||!c.caches.every(d=>typeof d.id==='string'&&unitVector(d.dir))))return false;
  if(c.structures&&(!Array.isArray(c.structures.claimed)||c.structures.claimed.length>24||c.structures.claimed.some(id=>typeof id!=='string'||id.length>80)))return false;
  if(c.walls&&(!Number.isInteger(c.walls.stock)||!finite(c.walls.stock,0,5000)||!Number.isInteger(c.walls.sequence)||!finite(c.walls.sequence,0,1e6)||!Array.isArray(c.walls.items)||c.walls.items.length>1000||c.walls.items.some(w=>!unitVector(w.dir)||!finite(w.hp,1,180)||!finite(w.angle,-1000,1000)||!Number.isInteger(w.id)||!finite(w.id,1,1e6))))return false;
  if(c.crystals&&(!finite(c.crystals.credit)||!['claimed','carried','deposited'].every(k=>Array.isArray(c.crystals[k])&&c.crystals[k].every(id=>typeof id==='string'))||c.crystals.carried.length>3))return false;
  if(c.credits&&(!Array.isArray(c.credits)||c.credits.some(e=>!Array.isArray(e)||!towerKeys.includes(e[0])||!Number.isInteger(e[1])||!finite(e[1],0,1000))))return false;
  if(!finite(c.gold)||!finite(c.lives,1)||!finite(c.maxLives,1)||c.lives>c.maxLives||!finite(c.forged))return false;
  if(!Array.isArray(c.towers)||c.towers.length>1000||!c.towers.every(t=>['bolt','cryo','mortar','tesla','helios','warden'].includes(t.type)
    &&unitVector(t.dir)&&finite(t.height,-200,1000)&&Number.isInteger(t.tier)&&finite(t.tier,0,1000)&&finite(t.invested)))return false;
  if(!Array.isArray(home.decorations)||home.decorations.length>500||!home.decorations.every(d=>Object.hasOwn(DECORATIONS,d.kind)
    &&unitVector(d.dir)&&finite(d.height,-200,1000)&&finite(d.rotation,0,Math.PI*2)))return false;
  if(!Array.isArray(c.faults)||c.faults.length>8||!c.faults.every(f=>['dir','axis','side','protectedDir'].every(k=>unitVector(f[k]))&&finite(f.strength,0,4)&&finite(f.limit,-1,1)))return false;
  return true;
}
