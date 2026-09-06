import { freshSave, validSave, accountProfile } from '../run/campaign.js';

export const CAMPAIGN_KEY='wh99Campaign';
const LEGACY_KEY='wh99Progress';
const clone=x=>JSON.parse(JSON.stringify(x));

// One atomic envelope keeps account rewards and planet receipts together.
// Failed writes stay in memory for export/retry. A stale tab cannot overwrite
// another tab's newer checkpoint, and corrupt input is preserved for recovery.
export function createCampaignStore(storage) {
  let state,baseRaw=null,dirty=false,error=null,recoveryRaw=null;
  try {
    baseRaw=storage.getItem(CAMPAIGN_KEY);
    if(baseRaw){state=JSON.parse(baseRaw);if(!validSave(state))throw new Error('Invalid checkpoint');}
    else {
      const legacy=storage.getItem(LEGACY_KEY);let profile;
      if(legacy){try{profile=JSON.parse(legacy);}catch{error='legacy-corrupt';recoveryRaw=legacy;}}
      state=freshSave(profile);
    }
  } catch {
    recoveryRaw=baseRaw;state=freshSave();error=baseRaw?'corrupt':'unavailable';
  }
  function flush(recover=false) {
    if(['corrupt','legacy-corrupt'].includes(error)&&!recover)return false;
    try {
      if(storage.getItem(CAMPAIGN_KEY)!==baseRaw){error='conflict';return false;}
      const next=JSON.stringify(state);storage.setItem(CAMPAIGN_KEY,next);baseRaw=next;dirty=false;error=null;return true;
    }catch{error='unavailable';return false;}
  }
  return {
    snapshot:()=>clone(state),
    expeditionStatus:()=>state.expedition?.status || null,
    status:()=>({saved:!dirty&&!error,error,dirty,recoverable:recoveryRaw!==null}),
    commit(change){
      const next=clone(state),value=change(next);if(value===false)return {ok:false,saved:!dirty&&!error};
      next.revision++;if(!validSave(next))throw new Error('Campaign transaction produced an invalid checkpoint');
      state=next;dirty=true;return {ok:true,saved:flush(),value};
    },
    retry:recover=>flush(!!recover),
    export:()=>JSON.stringify({format:'99-planets-save-export',checkpoint:state,original:recoveryRaw},null,2),
    import(text){
      let next;try{const parsed=JSON.parse(text);next=parsed.checkpoint||parsed;if(!validSave(next))return false;}catch{return false;}
      // Import is an explicit recovery action. Preserve the current raw value
      // until the replacement validates, then save through the same guard.
      state=clone(next);dirty=true;return flush(true);
    },
    updateAccount(profile){return this.commit(s=>{s.account=accountProfile(profile);return true;});},
  };
}
const browserStorage={getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value)};
export const campaignStore=createCampaignStore(browserStorage);
