import { createInventory, COMPATIBILITY } from './weapons.js';

export const SAVE_VERSION = 1;
const clone = x => JSON.parse(JSON.stringify(x));
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
const TOWERS = ['bolt','cryo','mortar','tesla','helios','warden'];
const BONUSES = ['interest','veteran','quartermaster','scout'];
export function accountProfile(raw = {}) {
  const list = (value, allowed, first) => [...new Set([first,...(Array.isArray(value) ? value.filter(x=>allowed.includes(x)) : [])])];
  const towers = list(raw?.towers,TOWERS,'bolt');
  return {version:2,planetsBeaten:integer(raw?.planetsBeaten,0,1e9)?raw.planetsBeaten:0,
    coins:integer(raw?.coins,0,1e9)?raw.coins:0,towers,
    commanders:list(raw?.commanders,Object.keys(COMPATIBILITY),'commander'),
    bonuses:Object.fromEntries(BONUSES.filter(k=>raw?.bonuses?.[k]===true).map(k=>[k,true])),
    loadout:towers.includes(raw?.loadout)?raw.loadout:'bolt'};
}
export function freshSave(legacy) {
  return {version:SAVE_VERSION,revision:0,sequence:0,account:accountProfile(legacy),expedition:null};
}
function validInventory(commander, value) {
  try { createInventory(commander,value); return !!value; } catch { return false; }
}
export function validSave(s) {
  if (!s || s.version!==SAVE_VERSION || !integer(s.revision,0,1e9) || !integer(s.sequence,0,1e9)
    || JSON.stringify(s.account)!==JSON.stringify(accountProfile(s.account))) return false;
  const e=s.expedition;if(e===null)return true;
  if (!e || !/^expedition-\d+$/.test(e.id) || !integer(e.seed,1,0xffffffff)
    || !integer(e.limit,2,99) || !integer(e.planet,1,e.limit) || !integer(e.completed,0,e.limit)
    || !['ready','assault','victory','defeat','complete'].includes(e.status)
    || !integer(e.attempt,0,1e9) || (e.commander!==null&&!Object.hasOwn(COMPATIBILITY,e.commander))
    || (e.banked!==null&&!validInventory(e.commander,e.banked))
    || !Array.isArray(e.receipts) || e.receipts.length!==e.completed) return false;
  if (e.receipts.some((r,i)=>!r||r.planet!==i+1||r.id!==`${e.id}-${i+1}`||!integer(r.items,0,14)||!integer(r.coins,0,1e9)||!integer(r.kills,0,1e9)||!integer(r.score,0,1e12)))return false;
  if (e.status==='complete' ? e.completed!==e.limit||e.planet!==e.limit : e.completed!==e.planet-1)return false;
  const a=e.assault;
  if (['ready','complete'].includes(e.status)) return a===null;
  if (!a || a.id!==`${e.id}-${e.planet}-${e.attempt}` || !integer(a.paid,0,32767)
    || !integer(a.coins,0,1e9) || !integer(a.effectiveSeed,1,0xffffffff)
    || !validInventory(e.commander,a.start)) return false;
  if(e.status!=='victory')return a.victory===null;
  const v=a.victory;
  if(!v||!validInventory(e.commander,v.inventory)||!Array.isArray(v.drops)||v.drops.length>5000
    || !integer(v.kills,0,1e9)||!integer(v.score,0,1e12)||!integer(v.lives,1,1e6))return false;
  const inventory=createInventory(e.commander,v.inventory);
  return v.drops.every(d=>d&&Array.isArray(d.dir)&&d.dir.length===3&&d.dir.every(Number.isFinite)
    && Math.abs(Math.hypot(...d.dir)-1)<.001&&inventory.register(d.item));
}
export function startExpedition(s,{seed,limit=2}) {
  if(!integer(seed,1,0xffffffff)||!integer(limit,2,99))return false;
  s.sequence++;
  s.expedition={id:`expedition-${s.sequence}`,seed,limit,planet:1,completed:0,status:'ready',attempt:0,
    commander:null,banked:null,assault:null,receipts:[]};return true;
}
export function extendExpedition(s,limit) {
  const e=s.expedition;if(!e||!integer(limit,e.limit+1,99))return false;
  e.limit=limit;
  if(e.status==='complete'){e.status='ready';e.planet=e.completed+1;}
  return true;
}
export function beginAssault(s,{commander,inventory,effectiveSeed}) {
  const e=s.expedition;if(!e||!['ready','assault','defeat'].includes(e.status))return false;
  if(e.status==='assault')return e.assault.id;
  if(!Object.hasOwn(COMPATIBILITY,commander)||!validInventory(commander,inventory)||!integer(effectiveSeed,1,0xffffffff))return false;
  if(e.commander&&e.commander!==commander)return false;
  e.commander=commander;e.banked ||= clone(inventory);e.attempt++;
  e.assault={id:`${e.id}-${e.planet}-${e.attempt}`,paid:0,coins:0,effectiveSeed,start:clone(e.banked),victory:null};
  e.status='assault';return e.assault.id;
}
export function awardWave(s,id,wave,coins) {
  const e=s.expedition,a=e?.assault;
  if(e?.status!=='assault'||a?.id!==id||!integer(wave,1,15)||!integer(coins,0,1e6))return false;
  const bit=1<<(wave-1);if(a.paid&bit)return false;
  a.paid|=bit;a.coins+=coins;s.account.coins+=coins;return true;
}
export function resolveAssault(s,id,outcome,victory=null) {
  const e=s.expedition;if(e?.status!=='assault'||e.assault?.id!==id||!['victory','defeat'].includes(outcome))return false;
  if(outcome==='victory') {
    const probe=clone(s);probe.expedition.status='victory';probe.expedition.assault.victory=clone(victory);
    if(!validSave(probe))return false;
    e.assault.victory=clone(victory);
  }
  e.status=outcome;return true;
}
export function updateSalvage(s,id,victory) {
  const e=s.expedition;if(e?.status!=='victory'||e.assault?.id!==id)return false;
  const probe=clone(s);probe.expedition.assault.victory=clone(victory);if(!validSave(probe))return false;
  e.assault.victory=clone(victory);return true;
}
export function extractPlanet(s,id,inventory) {
  const e=s.expedition;if(e?.status!=='victory'||e.assault?.id!==id||!validInventory(e.commander,inventory))return false;
  // The caller saves the carried inventory first. Extraction cannot smuggle
  // a different inventory into the checkpoint or pay a receipt twice.
  if(JSON.stringify(inventory)!==JSON.stringify(e.assault.victory.inventory))return false;
  e.banked=clone(inventory);e.completed=e.planet;s.account.planetsBeaten++;
  e.receipts.push({id:`${e.id}-${e.planet}`,planet:e.planet,items:inventory.items.length,coins:e.assault.coins,kills:e.assault.victory.kills,score:e.assault.victory.score});
  e.assault=null;
  if(e.planet===e.limit)e.status='complete';else{e.planet++;e.status='ready';}
  return true;
}
