import { browserStorage, scopedStorage } from '../storage.js';
import { validateHome, starterEarthHome, EARTH_HOME_ID } from '../run/homeworld.js';
const KEY='whHomesV1';
export function createHomeStore(storage=browserStorage,{starter=false}={}) {
  const read=()=>{
    const raw=storage.getItem(KEY);
    const data=raw?JSON.parse(raw):{version:1,homes:[]};
    if(data.version!==1||!Array.isArray(data.homes)||data.homes.length>100||!data.homes.every(validateHome))throw Error('Home save is damaged or from an incompatible version. Export it before repairing.');
    if(new Set(data.homes.map(h=>h.id)).size!==data.homes.length)throw Error('Duplicate home identity.');
    if(data.selected!==undefined&&data.selected!==null&&!data.homes.some(h=>h.id===data.selected))throw Error('Selected home is missing from the catalogue.');
    if(starter&&!data.homes.some(h=>h.id===EARTH_HOME_ID)&&data.homes.length<100)data.homes.push(starterEarthHome());
    return data;
  };
  return {
    list(){try{const d=read();return {ok:true,homes:d.homes,selected:d.selected??d.homes[0]?.id??null};}catch(e){return {ok:false,homes:[],selected:null,error:String(e.message||e)};}},
    choose(id){try{const data=read();if(!data.homes.some(h=>h.id===id))throw Error('Capture that planet before choosing it.');
      data.selected=id;const encoded=JSON.stringify(data);storage.setItem(KEY,encoded);if(storage.getItem(KEY)!==encoded)throw Error('Home selection could not be saved.');return {ok:true};
    }catch(e){return {ok:false,error:String(e.message||e)};}},
    get(id){const r=this.list();return r.ok?r.homes.find(h=>h.id===id)||null:null;},
    save(home){
      if(!validateHome(home))return {ok:false,error:'Invalid home checkpoint; existing save was preserved.'};
      try{const data=read(),index=data.homes.findIndex(h=>h.id===home.id);
        if(index<0){if(data.homes.length>=100)throw Error('All 100 home slots are occupied.');data.homes.push(home);}else data.homes[index]=home;
        const encoded=JSON.stringify(data);storage.setItem(KEY,encoded);
        if(storage.getItem(KEY)!==encoded)throw Error('Home save could not be verified.');
        return {ok:true};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    },
    export(){try{return JSON.stringify(read());}catch{return storage.getItem(KEY)||'';}},
    import(text){try{const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.homes)||!data.homes.length||data.homes.length>100||!data.homes.every(validateHome)||new Set(data.homes.map(h=>h.id)).size!==data.homes.length)throw Error('Invalid home backup.');
      if(data.selected!=null&&!data.homes.some(h=>h.id===data.selected))throw Error('Invalid selected home in backup.');
      const current=read();if(!storage.getItem(KEY)&&data.selected)current.selected=data.selected;
      for(const h of data.homes){const i=current.homes.findIndex(x=>x.id===h.id);if(i>=0)current.homes[i]=h;else current.homes.push(h);}
      if(current.homes.length>100)throw Error('Too many homes.');storage.setItem(KEY,JSON.stringify(current));return {ok:true};
    }catch(e){return {ok:false,error:String(e.message||e)};}}
  };
}
// A deliberately captured home belongs to the lobby, including a planet
// explored in the generator. Expedition sandboxes still keep their own saves.
// Debug World can import this module without ever accessing browser storage.
const homeStorage=scopedStorage({
  getItem:key=>/\/debug\.html$/.test(globalThis.location?.pathname||'')?null:globalThis.localStorage.getItem(key),
  setItem:(key,value)=>{if(!/\/debug\.html$/.test(globalThis.location?.pathname||''))globalThis.localStorage.setItem(key,value);},
},globalThis.location?.pathname||'/');
export const homeStore=createHomeStore(homeStorage,{starter:!(/\/debug\.html$/.test(globalThis.location?.pathname||''))});
