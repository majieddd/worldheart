import * as THREE from 'three';
import { CONFIG, CAM_TUNE, TERRAIN_PROFILES } from './config.js';
import { browserStorage } from './storage.js';
import { worldgenUrl, rememberWorld } from './worldgen.js';
import { FORMATIONS, ECOLOGY, terrainHeight, biomeAt, waterDepthAt } from './world.js';
import { NestAtlasView } from './nest-atlas-view.js';
import { BIOME_REGIMES } from './terrain/ecology.js';
import { PLANET_THEMES } from './run/planet-environments.js';
import { LANDFORM_RECIPES } from './terrain/recipes.js';
import { surveyLandmarks } from './terrain/landmarks.js';

// One inspector component uses the actual generated scene and navigation field.
// A new seed reloads their entire lifecycle instead of leaving old pooled units,
// paths or GPU buffers attached to a different planet.
export class WorldgenPanel {
  constructor({ui, game, world, nav, rig, possession, scene}) {
    Object.assign(this, {ui, game, world, nav, rig, scene});
    this.terrain = CONFIG.terrain ? CONFIG.terrainKey : 'classic';
    const labels = Object.fromEntries(Object.entries(TERRAIN_PROFILES).map(([key, value]) => [key, value.name]));
    labels.classic = 'Classic whole planet';
    let history = [];
    try { history = JSON.parse(browserStorage.getItem('worldHistory') || '[]'); }
    catch { /* A denied or invalid local history cannot prevent inspection. */ }
    this.history = rememberWorld(history, {seed: CONFIG.requestedSeed, terrain: this.terrain, biome: CONFIG.biomeKey, planet: CONFIG.planetKey});
    let saved = true;
    try { browserStorage.setItem('worldHistory', JSON.stringify(this.history)); } catch { saved = false; }

    const panel = this.panel = document.createElement('details');
    panel.id = 'worldgen-panel'; panel.className = 'panel'; panel.open = true;
    panel.innerHTML = `<summary>World generator <small>Inspection sandbox</small></summary>
      <div class="worldgen-controls">
        <p>Roll a world, explore its terrain, then play the seed in a new tab.</p>
        <form id="worldgen-form">
          <label>Terrain<select id="worldgen-terrain">${Object.entries(labels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
          <label>Climate<select id="worldgen-biome">${Object.entries(BIOME_REGIMES).map(([key,value])=>`<option value="${key}">${value.name}</option>`).join('')}</select></label>
          <label>Planet theme<select id="worldgen-planet">${Object.entries(PLANET_THEMES).map(([key,value])=>`<option value="${key}">${value.name}</option>`).join('')}</select></label>
          <button class="btn primary" type="button" id="worldgen-new">Generate world</button>
          <label>Seed<input id="worldgen-seed" inputmode="numeric" pattern="[0-9]+" required aria-describedby="worldgen-status"></label>
          <button class="btn" type="submit">Load seed</button>
        </form>
        <label>Recent worlds<select id="worldgen-history">${this.history.map((x, i) => `<option value="${i}">${x.seed} · ${labels[x.terrain]} · ${BIOME_REGIMES[x.biome||'auto']?.name||'Planet mix'} · ${PLANET_THEMES[x.planet||'auto'].name}</option>`).join('')}</select></label>
        <div class="worldgen-actions"><button class="btn" id="worldgen-home">Base area</button><button class="btn" id="worldgen-peak">Highest peak</button><button class="btn" id="worldgen-globe">Whole planet</button></div>
        <label id="worldgen-formation-label">Explore a formation<select id="worldgen-formation"><option value="">Choose a landform</option></select></label>
        <label class="worldgen-toggle"><input type="checkbox" id="worldgen-daylight" checked> Daylight inspection</label>
        <label class="worldgen-toggle"><input type="checkbox" id="worldgen-paths"> Show nest habitat and routes</label>
        <p id="worldgen-atlas" hidden>Cyan outlines: valid battlefield areas and approaches. Pale outlines: potential habitat across the globe. Moving dots follow shared routes toward the base.</p>
        <div class="worldgen-actions"><button class="btn" id="worldgen-copy">Copy seed link</button><a class="btn" id="worldgen-play" target="_blank" rel="noopener">Play this seed</a></div>
        <a class="btn" href="debug.html" target="_blank" rel="noopener">Open Debug World</a>
        <input id="worldgen-link" aria-label="Seed link" readonly hidden>
        <p id="worldgen-info"></p><p id="worldgen-status" role="status"></p>
        <p>Drag terrain or use WASD / arrows. Wheel to zoom. Collapse this panel for a clear view.</p>
      </div>`;
    document.body.append(panel); document.body.classList.add('worldgen');
    const el = id => panel.querySelector('#worldgen-' + id);
    this.status = el('status'); el('seed').value = CONFIG.requestedSeed; el('terrain').value = this.terrain; el('biome').value = ECOLOGY?.manifest().key || 'auto';
    el('planet').value=CONFIG.planetKey;
    this.inspectionLight=new THREE.DirectionalLight(0xffeddb,1.9);
    this.inspectionLight.name='Inspection daylight';scene.add(this.inspectionLight);
    el('daylight').onchange=()=>{this.inspectionLight.visible=el('daylight').checked;};
    el('play').href = worldgenUrl(location.href, CONFIG.requestedSeed, this.terrain, false, CONFIG.biomeKey,CONFIG.planetKey);
    el('form').onsubmit = event => { event.preventDefault(); this.generate(el('seed').value, el('terrain').value); };
    el('new').onclick = () => {
      const data = new Uint32Array(1); crypto.getRandomValues(data);
      this.generate((data[0] || 1) === CONFIG.requestedSeed ? (data[0] % 0xfffffffe) + 1 : data[0] || 1, el('terrain').value);
    };
    el('history').onchange = () => { const selected = this.history[Number(el('history').value)]; this.generate(selected.seed, selected.terrain, selected.biome||'auto',selected.planet||'auto'); };
    el('copy').onclick = async () => {
      const link = worldgenUrl(location.href, CONFIG.requestedSeed, this.terrain, true, CONFIG.biomeKey,CONFIG.planetKey);
      try { await navigator.clipboard.writeText(link); this.status.textContent = 'Seed link copied.'; }
      catch { el('link').hidden = false; el('link').value = link; el('link').focus(); el('link').select(); this.status.textContent = 'Copy the selected seed link.'; }
    };
    // Keep the game in its non-simulating title state with the overlay hidden.
    // Inspection cannot earn currency, release a wave or enter possession.
    game.paused = true; possession?.suspend(true); ui.el['title-overlay'].classList.remove('show');
    rig.cancelFlight(); rig.keys.clear(); rig.velLon = rig.velLat = 0; rig.autoOrbit = 0;
    rig.confine = null; rig.frontierTheta = null; CAM_TUNE.maxAlt = 3.2;
    for (const part of [world.fogVeil, world.cloudDeck, world.fieldWall]) if (part) part.mesh.visible = false;
    const home = world.heart.group.position.clone().normalize();
    let peak = nav.heartNode;
    for (let i = 0; i < nav.n; i++) if (nav.height[i] > nav.height[peak]) peak = i;
    const peakDir = nav.nodeDir(peak, new THREE.Vector3());
    el('home').onclick = () => this.focus(home, 115);
    el('peak').onclick = () => this.focus(peakDir, Math.max(65, CONFIG.terrain?.range || 40));
    el('globe').onclick = () => this.focus(home, CONFIG.planetRadius * 2.8);
    this.landmarks = FORMATIONS ? surveyLandmarks(FORMATIONS,terrainHeight,nav.fieldCenter,CONFIG.map.fieldTheta,(x,y,z,h)=>waterDepthAt(new THREE.Vector3(x,y,z),h)>0,(x,y,z,h)=>biomeAt(new THREE.Vector3(x,y,z),h)) : [];
    el('formation-label').hidden = !FORMATIONS;
    for(const [i,site]of this.landmarks.entries()){
      const option=document.createElement('option');option.value=String(i);
      const d=new THREE.Vector3(...site.dir);
      option.textContent=`${LANDFORM_RECIPES[site.type].label} · ${biomeAt(d,site.height)}${site.inside?'':' · beyond battlefield'}`;
      el('formation').append(option);
    }
    el('formation').onchange=()=>{
      const site=this.landmarks[Number(el('formation').value)];if(el('formation').value===''||!site)return;
      this.focus(new THREE.Vector3(...site.dir),Math.max(65,site.scale*1.4));
      this.status.textContent=`${LANDFORM_RECIPES[site.type].label}. ${site.inside?'Inside this battlefield.':'Elsewhere on this planet.'} ${site.depth>1?`${site.depth.toFixed(1)}m cut into the surrounding upland.`:'Look around the shoulders and nearby routes.'}`;
    };
    el('paths').disabled = !CONFIG.terrain;
    el('paths').onchange = () => { if (!this.paths) this.buildRoutes(); this.paths.visible = el('paths').checked; el('atlas').hidden = !el('paths').checked; };
    el('info').textContent = `Seed ${CONFIG.requestedSeed} · generated ${CONFIG.seed} · ${FORMATIONS ? 'landforms v' + FORMATIONS.version : 'classic terrain'} · peak ${nav.height[peak].toFixed(1)}m${ECOLOGY?' · '+ECOLOGY.manifest().regime+' climate':''}`;
    if(CONFIG.environment){
      const e=CONFIG.environment;
      el('info').textContent+=` · ${e.name} · ${e.star.name} (${e.star.type}) · ${e.orbitAU.toFixed(2)} AU · ${e.flux.toFixed(2)}x Earth sunlight`;
      if(CONFIG.biomeKey==='auto')el('info').textContent+=' · Latitude shapes local bands within this planet theme. Theme sets its dominant ecology.';
    }
    this.status.textContent = saved ? 'Campaign and rewards are separate from this sandbox.' : 'History could not be saved. Copy a seed link to keep this world.';
    this.focus(home, 115);
  }

  focus(dir, height) {
    this.rig.keys.clear(); this.rig.velLon = this.rig.velLat = 0;
    this.rig.tiltOffset = 0; this.rig.flyTo(dir, height, .6);
    this.inspectionLight.position.copy(dir).multiplyScalar(1000);
  }

  generate(input, terrain, biome=this.panel.querySelector('#worldgen-biome').value,planet=this.panel.querySelector('#worldgen-planet').value) {
    try {
      if (!/^\d+$/.test(String(input).trim())) throw Error('Enter a whole-number seed.');
      const url = worldgenUrl(location.href, Number(input), terrain, true, biome,planet);
      this.status.textContent = 'Generating terrain and checking routes…';
      this.panel.setAttribute('aria-busy', 'true');
      for (const el of this.panel.querySelectorAll('button,input,select')) el.disabled = true;
      location.href = url;
    } catch (error) { this.status.textContent = error.message; }
  }

  buildRoutes() {
    this.routeView = new NestAtlasView(this.scene,this.nav,{renderer:this.ui.renderer,camera:this.rig.camera}); this.paths=this.routeView.group;
    this.routeCount=this.routeView.routeCount;
    this.status.textContent='Checking battlefield approaches and surveying the whole planet…';
    this.routeView.routesReady.then(()=>{this.routeCount=this.routeView.routeCount;},()=>{});
    this.atlasReady=this.routeView.build().then(stats=>{
      this.panel.querySelector('#worldgen-atlas').textContent=`Cyan outlines enclose ${stats.exact.toLocaleString()} individually valid battlefield sites, with ${this.routeCount} example approaches. Pale outlines enclose ${stats.potential.toLocaleString()} potential habitat samples across the whole planet; moving dots show shared routes toward the base. ${stats.disconnected.toLocaleString()} samples lack a surveyed route to this base. Global lines are a coarse terrain survey; distance limits and combat placement still apply.`;
      this.status.textContent='Planet survey ready. Rotate the globe to inspect the other hemisphere.';
      return stats;
    }).catch(error=>{this.status.textContent='Terrain survey could not finish. Reload this world to retry.';console.error(error);return null;});
  }
  update(dt){this.routeView?.update(dt);if(this.rig.camera)this.inspectionLight.position.copy(this.rig.camera.position);}
}
