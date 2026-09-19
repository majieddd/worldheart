import { campaignStore } from './campaign-store.js';
import { startExpedition, extendExpedition } from '../run/campaign.js';
import { planetDefinition, CAMPAIGN_LENGTH } from '../run/planets.js';
import {CURRENT_TERRAIN_VERSION,savedTerrainVersion} from '../run/terrain-version.js';
import {planetEnvironment} from '../run/planet-environments.js';

export function campaignLaunch(enabled,seed) {
  if(!enabled)return null;
  if(!campaignStore.snapshot().expedition)campaignStore.commit(s=>startExpedition(s,{seed:seed>>>0||12345,limit:CAMPAIGN_LENGTH}));
  if(campaignStore.snapshot().expedition?.limit<CAMPAIGN_LENGTH)campaignStore.commit(s=>extendExpedition(s,CAMPAIGN_LENGTH));
  const expedition=campaignStore.snapshot().expedition;
  if(!expedition)return null;
  const planet=planetDefinition(expedition.planet,expedition.seed);
  const terrainVersion=expedition.assault?savedTerrainVersion(expedition.assault):CURRENT_TERRAIN_VERSION;
  if(planet?.index===1&&terrainVersion<2){planet.environment=planetEnvironment(planet.seed);planet.name='Hearthwild';}
  return planet ? {...planet,terrainVersion,status:expedition.status,limit:expedition.limit} : null;
}
