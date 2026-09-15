// Home checkpoints are plain data. The browser adapter owns storage and meshes.
import { MAX_HEART_LEVEL } from './schedule.js';
import { createInventory, validWeapon } from './weapons.js';
import { POWER_BY_ID } from './powers.js';
import { PLANET_THEMES } from './planet-environments.js';
import { TERRAIN_PACKS } from './world-catalogue.js';
export const HOME_VERSION = 1;
export const DECORATIONS = {
  lantern: { name: 'Crystal lantern', color: 0x59f2ff },
  garden: { name: 'Flower garden', color: 0xb8d979 },
  banner: { name: 'Victory banner', color: 0xb6a4e8 },
  bench: { name: 'Resting bench', color: 0xa18d6e },
  arch: { name: 'Garden arch', color: 0x91ac8d },
  monument: { name: 'Heart monument', color: 0x91c9d8 },
};
export const canClaimHome = (level, phase, busy = false) => level >= MAX_HEART_LEVEL
  && ['building','victory'].includes(phase) && !busy;
export function unitVector(v) {
  return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) && Math.abs(Math.hypot(...v)-1)<.002;
}
const finite = (n, min=0, max=1e12) => Number.isFinite(n) && n>=min && n<=max;
export function validateHome(home) {
  const c=home?.checkpoint,w=home?.world,s=c?.run;
  if(home?.version!==HOME_VERSION || typeof home.id!=='string' || !/^[a-z0-9-]{1,80}$/.test(home.id))return false;
  if(typeof home.name!=='string'||home.name.length>60||!home.name.trim())return false;
  if(!w || !Number.isInteger(w.seed)||!finite(w.seed,1,0xffffffff)||!finite(w.radius,10,4000)
    || !unitVector(w.centre)||!unitVector(w.heart)||!Array.isArray(w.portals)||!w.portals.length||!w.portals.every(unitVector))return false;
  if(!w.environment||!Object.hasOwn(PLANET_THEMES,w.environment.theme)||!Object.hasOwn(TERRAIN_PACKS,w.terrain))return false;
  if(!c||!s||s.heartLevel!==MAX_HEART_LEVEL||s.frontierSteps!==10||s.phase!=='building'||!s.endless
    ||!Number.isInteger(s.wavesCleared)||!finite(s.wavesCleared,0,100000))return false;
  if(!['commander','duelist','marksman','bombardier','oracle'].includes(c.commander)||!c.inventory)return false;
  try{createInventory(c.commander,c.inventory);}catch{return false;}
  const towerKeys=['bolt','cryo','mortar','tesla','helios','warden'];
  if(!Array.isArray(s.powers)||s.powers.some(id=>!POWER_BY_ID[id])||!Array.isArray(s.hand)||s.hand.length>4||s.hand.some(id=>!towerKeys.includes(id))
    ||!Array.isArray(s.unlockedTowers)||!s.unlockedTowers.length||s.unlockedTowers.some(id=>!towerKeys.includes(id))||!Array.isArray(s.players))return false;
  if(c.loot&&(!Array.isArray(c.loot)||c.loot.length>256||!c.loot.every(d=>validWeapon(d.item)&&unitVector(d.dir)&&finite(d.height,-200,1000))))return false;
  if(c.caches&&(!Array.isArray(c.caches)||c.caches.length>60||!c.caches.every(d=>typeof d.id==='string'&&unitVector(d.dir))))return false;
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
