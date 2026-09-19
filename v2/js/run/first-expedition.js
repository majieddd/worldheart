// Presentation progress lives apart from inventory, assaults and home saves.
export const OPENING_KEY = 'whFirstExpedition1';
export const LESSONS = ['select','tower','towerUpgrade','crystal','deposit','upgrade'];
export function freshOpening() { return {intro:false,story:false,skipped:false,done:[],seen:[]}; }
export function readOpening(storage) {
  try {
    const value=JSON.parse(storage.getItem(OPENING_KEY));
    if(!value||typeof value!=='object')return freshOpening();
    return {intro:value.intro===true,story:value.story===true,skipped:value.skipped===true,
      done:value.done?.includes('move')&&value.done?.includes('upgrade')?[...LESSONS]:LESSONS.filter(id=>Array.isArray(value.done)&&value.done.includes(id)),
      seen:Array.isArray(value.seen)?value.seen.filter(x=>typeof x==='string').slice(0,30):[]};
  } catch { return freshOpening(); }
}
export function saveOpening(storage,state) { try { storage.setItem(OPENING_KEY,JSON.stringify(state));return true; } catch { return false; } }
export function nextLesson(state) { return state.skipped?null:LESSONS.find(id=>!state.done.includes(id))||null; }
export function completeLesson(state,id) { if(LESSONS.includes(id)&&!state.done.includes(id))state.done.push(id); }
export function holdsFirstWave(state) { return !state.skipped&&!state.done.includes('upgrade'); }
