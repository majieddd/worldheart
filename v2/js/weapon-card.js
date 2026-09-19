import { FAMILIES, PARTS, weaponName, materialForWeapon } from './run/weapons.js';
import { MANUFACTURERS, MODIFIERS, MAKER_SKILLS, makeEffects } from './run/manufacturers.js';
import { WEAPON_ABILITIES } from './run/abilities.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={damage:'M3 17 17 3M10 3h7v7M3 12v5h5',rate:'M10 3a7 7 0 1 0 7 7M10 6v5l3 2M14 2h4v4',reach:'M2 10h16M5 7l-3 3 3 3M15 7l3 3-3 3',armor:'M10 2 3 5v5c0 4 7 8 7 8s7-4 7-8V5Z M10 6v8',skill:'m11 1-7 10h6l-1 8 7-11h-6Z'};
const icon=key=>`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${icons[key]}"/></svg>`;
const fmt=n=>Number.isFinite(n)?n>=100?n.toFixed(0):n.toFixed(1).replace(/\.0$/,''):'0';
export function damageRate(s){return s.kind==='beam'?s.dps:s.dmg/s.cd;}
export function modifierText(make){
  if(!make)return '';
  const p=makeEffects(make)[1],words=[];
  for(const [k,v]of Object.entries(p)){
    if(k==='pierce')continue;
    if(k==='armorPierce'){words.push(`+${fmt(v+(p.pierce||0))} armor penetration`);continue;}
    if(['damage','cadence','reach','velocity'].includes(k))words.push(`${v>=1?'+':''}${Math.round((v-1)*100)}% ${ {damage:'impact',cadence:'recovery time',reach:'reach',velocity:'velocity'}[k]}`);
    else if(k==='leech')words.push(`heal ${fmt(v*100)}% of direct damage`);
    else if(k==='slow')words.push(`${fmt(v*100)}% slow`);
    else if(k==='burn')words.push(`${fmt(v)} burn damage/s`);
    else if(k==='knockback')words.push(`+${fmt(v*100)}% knockback`);
    else words.push(`+${fmt(v)} armor penetration`);
  }
  return words.join(' · ');
}
export function weaponCard(item,{stats,baseline=null,comparison='',image='',compact=false}={}){
  const s=stats,make=item.make,brand=MANUFACTURERS[make?.brand],skill=MAKER_SKILLS[make?.skill]||WEAPON_ABILITIES[item.family];
  if(!s)return '';
  const diff=(value,old)=>{if(old==null||Math.abs(value-old)<.05)return '';const n=value-old;return `<small class="wc-delta ${n>0?'wc-up':'wc-down'}" aria-label="${n>0?'increase':'decrease'} ${fmt(Math.abs(n))}">${n>0?'▲ +':'▼ '}${fmt(n)}</small>`;};
  const row=(key,label,value,unit,old)=>`<div><span class="wc-symbol" aria-hidden="true">${{damage:'⚔️',rate:'⚡',reach:'🎯'}[key]||'◈'}</span><span class="wc-stat-label">${label}</span><strong>${fmt(value)}<small>${unit}</small></strong>${diff(value,old)}</div>`;
  const continuous=s.kind==='beam',reach=s.radius||s.range||s.aoe;
  const same=baseline?.kind===s.kind,armor=s.pierce+(s.armorPierce||0);
  const band=row('damage',continuous?'Beam DPS':'Impact',s.dmg,'',(baseline?.kind==='beam')===continuous?baseline?.dmg:null)
    +row('rate',continuous?'Ramp':'Attacks / s',continuous?s.ramp:1/s.cd,continuous?'x':'',same?(continuous?baseline.ramp:1/baseline.cd):null)
    +row('reach',s.kind==='lob'?'Blast':'Reach',reach,'m',same?(baseline.radius||baseline.range||baseline.aoe):null);
  return `<section class="weapon-card wc-${escape(item.rarity)} ${compact?'wc-compact':''}" data-weapon-card="${escape(item.id)}" style="--maker:${brand?.color||'#aec4d6'}">
    <div class="wc-heading"><span class="wc-rarity">${escape(item.rarity)} · ${escape(materialForWeapon(item))}</span><h3 title="${escape(weaponName(item))}">${escape(make?MODIFIERS[make.perk].name+' ':'')}${escape(FAMILIES[item.family].name)}</h3><span class="wc-family">${continuous?'Continuous beam':s.kind==='melee'?'Melee weapon':'Ranged weapon'} · ${escape(brand?.name||'Worldheart')}</span></div>
    <div class="wc-showcase"><div class="wc-dps"><strong>${fmt(damageRate(s))}</strong><span>${continuous?'Base beam DPS':'Direct DPS'}</span>${diff(damageRate(s),baseline?damageRate(baseline):null)}</div>${image?`<img src="${image}" alt="${escape(brand?.name||'Worldheart')} ${escape(FAMILIES[item.family].name)} model" width="480" height="176">`:''}</div>
    <div class="wc-stats">${band}</div>
    ${comparison?`<p class="wc-compare">Compared with ${escape(comparison)}. ▲ stronger · ▼ weaker</p>`:''}
    <div class="wc-traits"><p class="wc-skill">${icon('skill')}<b>${escape(skill.name)} <small>${skill.cooldown}s</small></b><span>${escape(skill.description)}</span></p></div>
    <details class="wc-details" data-item="${escape(item.id)}-stats"><summary>🔎 Traits & details</summary><div class="wc-traits">${brand?`<p><b>${escape(brand.trait)}</b><span>${escape(brand.note)}</span></p><p><b>${['','Standard','Refined','Pristine'][make.quality]} roll</b><span>${escape(modifierText(make))}</span></p>`:''}<p>Armor penetration <b>${fmt(armor)}</b></p><p>${Object.keys(PARTS).map(k=>escape(PARTS[k][item.parts[k]].name)).join(' / ')}${item.affixes.length?' · '+escape(item.affixes.join(', ')):''}</p><p>${escape(weaponName(item))}</p></div></details>
    <div class="wc-footer"><span class="wc-mark">${brand?.mark||'WH'}</span><strong>${escape(brand?.name||'Worldheart originals')}</strong><span>1 scrap</span></div>
    ${continuous?'<small class="wc-method">Beam ramps while held; heat limits uptime.</small>':''}
  </section>`;
}
