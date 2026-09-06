import { campaignStore } from './campaign-store.js';
import { startExpedition, extendExpedition } from '../run/campaign.js';
import { planetDefinition, CAMPAIGN_LENGTH } from '../run/planets.js';

export function campaignLaunch(enabled,seed) {
  if(!enabled)return null;
  if(!campaignStore.snapshot().expedition)campaignStore.commit(s=>startExpedition(s,{seed:seed>>>0||12345,limit:CAMPAIGN_LENGTH}));
  if(campaignStore.snapshot().expedition?.limit<CAMPAIGN_LENGTH)campaignStore.commit(s=>extendExpedition(s,CAMPAIGN_LENGTH));
  const expedition=campaignStore.snapshot().expedition;
  if(!expedition)return null;
  const planet=planetDefinition(expedition.planet,expedition.seed);
  return planet ? {...planet,status:expedition.status,limit:expedition.limit} : null;
}
