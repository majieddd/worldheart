import { browserStorage } from '../storage.js';
import { validateHome } from '../run/homeworld.js';
const KEY='whHomesV1';
export function createHomeStore(storage=browserStorage) {
  const read=()=>{
    const raw=storage.getItem(KEY);if(!raw)return {version:1,homes:[]};
    const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.homes)||data.homes.length>99||!data.homes.every(validateHome))throw Error('Home save is damaged or from an incompatible version. Export it before repairing.');
    if(new Set(data.homes.map(h=>h.id)).size!==data.homes.length)throw Error('Duplicate home identity.');
    return data;
  };
  return {
    list(){try{return {ok:true,homes:read().homes};}catch(e){return {ok:false,homes:[],error:String(e.message||e)};}},
    get(id){const r=this.list();return r.ok?r.homes.find(h=>h.id===id)||null:null;},
    save(home){
      if(!validateHome(home))return {ok:false,error:'Invalid home checkpoint; existing save was preserved.'};
      try{const data=read(),index=data.homes.findIndex(h=>h.id===home.id);
        if(index<0){if(data.homes.length>=99)throw Error('All 99 home slots are occupied.');data.homes.push(home);}else data.homes[index]=home;
        const encoded=JSON.stringify(data);storage.setItem(KEY,encoded);
        if(storage.getItem(KEY)!==encoded)throw Error('Home save could not be verified.');
        return {ok:true};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    },
    export(){return storage.getItem(KEY)||JSON.stringify({version:1,homes:[]});},
    import(text){try{const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.homes)||!data.homes.length||data.homes.length>99||!data.homes.every(validateHome)||new Set(data.homes.map(h=>h.id)).size!==data.homes.length)throw Error('Invalid home backup.');
      const current=read();for(const h of data.homes){const i=current.homes.findIndex(x=>x.id===h.id);if(i>=0)current.homes[i]=h;else current.homes.push(h);}
      if(current.homes.length>99)throw Error('Too many homes.');storage.setItem(KEY,JSON.stringify(current));return {ok:true};
    }catch(e){return {ok:false,error:String(e.message||e)};}}
  };
}
export const homeStore=createHomeStore();
