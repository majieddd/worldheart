import { browserStorage } from './storage.js';
import { COMMANDERS, MOUNTS } from './run/expedition.js';
export function preparation() {
  let value={};try{value=JSON.parse(browserStorage.getItem('whPreparation')||'{}');}catch{/* Default preparation works without storage. */}
  return {commander:Object.hasOwn(COMMANDERS,value?.commander)?value.commander:'commander',
    mount:Object.hasOwn(MOUNTS,value?.mount)?value.mount:'strider'};
}
export function savePreparation(value) {
  if(!Object.hasOwn(COMMANDERS,value.commander)||!Object.hasOwn(MOUNTS,value.mount))return false;
  try{browserStorage.setItem('whPreparation',JSON.stringify(value));return true;}catch{return false;}
}
