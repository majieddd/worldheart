import * as THREE from 'three';
import { CONFIG, MAPS, PALETTE, storeLocal, CAM_RANGES, CAM_TUNE, saveCamTune, resetCamTune } from './config.js';
import { TOWER_TYPES, tierCost, buildTowerVisual, TOWER_SCALE, MAT } from './towers.js';
import { powerSigil } from './ui-icons.js';
import { TALENTS, loadProfile, buyTalent, isOwned, isReachable } from './modes/progress.js';

// DOM HUD. All chrome lives here; the scene renders beneath it. Per the
// design contract: per-shot and per-kill readouts update with zero animation,
// wave-level moments may animate.

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  fast: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeX: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
  settings: '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.04 3 5.5l7 7Z"/>',
  gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
};

function icon(name, size = 15, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

function fmt(n) { return n.toLocaleString('en-US'); }

export class HUD {
  constructor({ game, waves, world, nav, rig, renderer, audio }) {
    this.game = game;
    this.waves = waves;
    this.world = world;
    this.nav = nav;
    this.rig = rig;
    this.renderer = renderer;
    this.audio = audio;
    this.root = document.getElementById('hud');
    this.thumbs = {};
    this.seen = { build: false, leak: false };
    // null means the whole roster is available, which is how every mode but
    // 99 Planets reads. The mode shell assigns the unlocked list.
    this.unlockedTowers = null;
    this.handCards = null;      // card mode: the live hand buttons, else null
    this._lastCountdownText = '';
    this._build();
    this._wire();
    this.refresh();
  }

  // -- construction ---------------------------------------------------------

  _build() {
    this.root.innerHTML = `
      <div class="hud-corner hud-top-left">
        <div class="panel">
          <div class="stat-row" id="lives-row" style="color:var(--accent)">
            ${icon('heart')}
            <div>
              <div class="bar" style="margin:3px 0 4px"><div class="bar-fill integrity" id="lives-fill"></div></div>
              <div class="stat-sub"><span class="stat-value" id="lives-num" style="font-size:var(--fs-14)">20</span>
              <span style="color:var(--text-faint)"> worldheart</span></div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="stat-row" style="color:var(--gold)">
            ${icon('gem')}
            <span class="stat-value gold-text" id="gold-num">400</span>
          </div>
          <div class="stat-sub" id="score-line">score 0</div>
        </div>
      </div>

      <div class="hud-top-center">
        <div class="pill" id="wave-pill">
          <span id="wave-label" class="marker" style="color:var(--text)">STANDBY</span>
          <span class="sep">|</span>
          <span id="wave-sub" style="color:var(--text-muted);font-size:var(--fs-12)">the breach stirs</span>
        </div>
        <button class="btn primary" id="btn-call" style="display:none">Call wave (+<span id="call-bonus">0</span>)</button>
        <div id="boss-bar">
          <div id="boss-name">COLOSSUS</div>
          <div class="bar"><div class="bar-fill" id="boss-fill"></div></div>
        </div>
      </div>

      <div class="hud-corner hud-top-right">
        <button class="btn icon" id="btn-speed" title="Game speed (F)"><span class="marker" id="speed-label" style="color:inherit">1x</span></button>
        <button class="btn icon" id="btn-pause" title="Pause (Space)">${icon('pause')}</button>
        <button class="btn icon" id="btn-sound" title="Sound (M)">${icon('volume')}</button>
        <button class="btn icon" id="btn-settings" title="Settings">${icon('settings')}</button>
      </div>

      <div class="panel" id="settings-pop">
        <div class="set-row"><span>World</span><span class="marker" style="color:var(--text)">${CONFIG.map.name}</span></div>
        <div class="set-row"><span>Mode</span><span class="marker" style="color:var(--gold)">${CONFIG.map.modeLabel}</span></div>
        <div class="set-row"><span>Quality</span><button class="btn" id="set-quality">Auto</button></div>
        <div class="set-row"><span>Screen shake</span><button class="btn" id="set-shake">On</button></div>
        <div class="set-row"><span>Seed</span><span class="marker" id="set-seed" style="color:var(--text)">0</span></div>
        <div class="marker" style="margin-top:var(--sp-2)">camera feel</div>
        <div id="cam-sliders"></div>
        <button class="btn" id="cam-reset" style="width:100%;font-size:var(--fs-12)">Reset camera feel</button>
      </div>

      <div id="toast-anchor"></div>
      <div id="wave-banner"><div class="big" id="banner-big"></div><div class="small" id="banner-small"></div></div>

      <div class="hud-bottom">
        <div class="hint-line" id="hint-line"></div>
        <div id="build-bar"></div>
      </div>

      <div class="panel raised" id="tower-panel">
        <div class="t-name"><span id="tp-name">Tower</span><span class="t-tier" id="tp-tier">MK I</span></div>
        <div class="t-desc" id="tp-desc"></div>
        <div class="t-stats" id="tp-stats"></div>
        <div class="t-actions">
          <button class="btn primary" id="tp-upgrade">Upgrade</button>
          <button class="btn danger" id="tp-sell">Sell</button>
          <button class="btn icon ghost" id="tp-close" title="Close">${icon('x')}</button>
        </div>
      </div>

      <div id="damage-vignette"></div>
      <div id="sel-readout"></div>
      <!-- The moment the link drops. Loud, brief, and then it hands over to the
           persistent chip in the possession HUD, because a one-shot toast is
           not a state and being cut off from the base IS a state. -->
      <div id="link-warn"><b>BASE CONTROL DISCONNECTING</b><span>you are leaving the frontier</span></div>

      <!-- First person. Hidden until a unit is possessed. A possessed body is
           mortal and a commander's death ends the run, so a health readout is
           a prerequisite for that fight, not decoration. -->
      <div id="fp-hud">
        <div id="fp-cross"><span></span><span></span><span></span><span></span><i></i></div>
        <div id="fp-hit"></div>
        <div id="fp-panel">
          <div id="fp-name">Commander</div>
          <div class="bar" id="fp-hp-track"><div class="bar-fill" id="fp-hp"></div></div>
          <div id="fp-swing-track"><div id="fp-swing"></div></div>
          <div id="fp-link">BASE CONTROL DISCONNECTED<span>outside the frontier - walk back to reconnect</span></div>
        <div id="fp-keys">
            <span><b>WASD</b> move</span><span><b>Shift</b> sprint</span><span><b>LMB</b> strike</span>
            <span><b>Space</b> jump</span><span><b>Scroll</b> view</span><span><b>P</b> pause</span>
            <span id="fp-rally"><b>G</b> rally</span><span><b>H</b> dismiss</span><span><b>Esc</b> release</span>
          </div>
        </div>
      </div>

      <div class="overlay" id="title-overlay">
        <div class="overlay-card">
          <div class="o-mark">WORLDHEART</div>
          <div class="o-sub">planetary defense</div>
          <div class="o-body">The void found this world. Raise your defenses anywhere on the globe,
            bend the swarm through your maze, and keep the heart alight.
            <em>Every breach must always have a path: seal nothing, shape everything.</em></div>
          <div class="o-body" style="margin-top:var(--sp-3);font-size:var(--fs-12)">
            Drag or <span class="kbd">WASD</span> to move, scroll or <span class="kbd">+</span>
            <span class="kbd">-</span> to zoom, <span class="kbd">Q</span> <span class="kbd">E</span> or
            <span class="kbd">Ctrl</span> + middle-drag to rotate (<span class="kbd">R</span> resets).
            Keys <span class="kbd">1</span> to <span class="kbd">5</span> choose a tower, click to build.
            <span class="kbd">U</span> upgrade, <span class="kbd">X</span> sell,
            <span class="kbd">Space</span> pause, <span class="kbd">F</span> speed. Camera feel sliders live in settings.</div>
          <div class="map-row" id="map-row"></div>
          <div class="o-actions">
            <button class="btn primary" id="btn-begin" style="font-family:var(--font-display)">Begin the defense</button>
            <button class="btn" id="btn-talents">Talents</button>
          </div>
        </div>
      </div>

      <!-- Where coins earned in a run are spent. Between runs, not during one:
           permanent progress is a decision about the NEXT attempt. -->
      <div class="overlay" id="talent-overlay">
        <div class="overlay-card talent-panel">
          <div class="o-mark">TALENTS</div>
          <div class="o-sub"><span id="talent-coins">0</span> coins earned</div>
          <div class="o-body" style="max-width:60ch">Every wave you clear pays coins, whether the run
            is won or lost. Spend them here on unlocks you keep for good.</div>
          <div id="talent-tiers"></div>
          <div class="o-actions">
            <button class="btn primary" id="btn-talents-close">Back</button>
          </div>
        </div>
      </div>

      <div class="overlay" id="end-overlay">
        <div class="overlay-card" id="end-card">
          <div class="o-mark" id="end-mark">VICTORY</div>
          <div class="o-sub" id="end-sub"></div>
          <div class="o-stats">
            <div class="o-stat"><b id="end-waves">0</b><span>waves</span></div>
            <div class="o-stat"><b id="end-kills">0</b><span>kills</span></div>
            <div class="o-stat"><b id="end-score">0</b><span>score</span></div>
          </div>
          <div class="o-body" id="end-body"></div>
          <div class="o-actions">
            <button class="btn primary" id="btn-continue" style="display:none">Hold the line (endless)</button>
            <button class="btn" id="btn-retry">Same world</button>
            <button class="btn" id="btn-new">New world</button>
          </div>
        </div>
      </div>

      <!-- Must sit AFTER #end-overlay: overlays carry no z-index and stack by
           DOM order, so a draft placed earlier would paint under the end card. -->
      <div class="overlay" id="draft-overlay">
        <div class="overlay-card draft-panel">
          <div class="o-mark">CHOOSE A POWER</div>
          <div class="o-sub" id="draft-sub">The frontier widens</div>
          <div class="draft-cards" id="draft-cards"></div>
          <div class="draft-timer"><span id="draft-timer-fill"></span></div>
        </div>
      </div>
    `;

    this._buildCards();
    this._buildMapCards();
    this._buildCamSliders();
    this.el = {};
    for (const id of [
      'lives-fill', 'lives-num', 'gold-num', 'score-line', 'wave-label', 'wave-sub',
      'btn-call', 'call-bonus', 'boss-bar', 'boss-fill', 'boss-name',
      'btn-speed', 'speed-label', 'btn-pause', 'btn-sound', 'btn-settings', 'settings-pop',
      'set-quality', 'set-shake', 'set-seed', 'toast-anchor', 'wave-banner', 'banner-big', 'banner-small',
      'hint-line', 'build-bar', 'tower-panel', 'tp-name', 'tp-tier', 'tp-desc', 'tp-stats',
      'tp-upgrade', 'tp-sell', 'tp-close', 'damage-vignette',
      'fp-hud', 'fp-cross', 'fp-hit', 'fp-name', 'fp-hp', 'fp-swing', 'fp-keys', 'fp-rally',
      'fp-link', 'link-warn', 'sel-readout',
      'title-overlay', 'end-overlay', 'end-card', 'end-mark', 'end-sub', 'end-waves', 'end-kills',
      'end-score', 'end-body', 'btn-continue', 'btn-retry', 'btn-new', 'btn-begin',
      'btn-talents', 'btn-talents-close', 'talent-overlay', 'talent-coins', 'talent-tiers',
    ]) this.el[id] = document.getElementById(id);
    this.el['set-seed'].textContent = String(CONFIG.seed);
  }

  _buildCards() {
    const bar = document.getElementById('build-bar');
    const keys = Object.keys(TOWER_TYPES);
    this.cards = {};
    keys.forEach((key, i) => {
      const def = TOWER_TYPES[key];
      const card = document.createElement('button');
      card.className = 'build-card';
      card.dataset.type = key;
      card.innerHTML = `
        <img class="build-thumb" alt="${def.name}">
        <div class="build-name">${def.name.split(' ')[0]}</div>
        <div class="build-cost">${def.cost}</div>
        <span class="kbd build-key">${i + 1}</span>
      `;
      card.title = `${def.name}: ${def.desc}`;
      bar.appendChild(card);
      this.cards[key] = card;
      card.addEventListener('click', () => this.game.toggleBuild(key));
    });
  }

  _buildMapCards() {
    const row = document.getElementById('map-row');
    for (const key of Object.keys(MAPS)) {
      const m = MAPS[key];
      const card = document.createElement('button');
      card.className = 'map-card' + (key === CONFIG.mapKey ? ' selected' : '');
      card.innerHTML = `
        <div class="m-name">${m.name}</div>
        <div class="m-mode marker">${m.modeLabel}</div>
        <div class="m-chip marker">${m.chip}</div>
        <div class="m-tag">${m.tag}</div>
      `;
      card.addEventListener('click', () => {
        if (key === CONFIG.mapKey) return;
        storeLocal('whMap', key);
        storeLocal('whSeed', String(CONFIG.seed));
        this._reboot();
      });
      row.appendChild(card);
    }
  }

  // Live camera-feel sliders: every value applies on the next frame and
  // persists per browser.
  _buildCamSliders() {
    const box = document.getElementById('cam-sliders');
    this._camRows = [];
    for (const key of Object.keys(CAM_RANGES)) {
      const r = CAM_RANGES[key];
      const row = document.createElement('div');
      row.className = 'cam-row';
      row.innerHTML = `
        <div class="cam-top"><span>${r.label}</span><b>${CAM_TUNE[key]}${r.unit}</b></div>
        <input type="range" class="cam-slider" min="${r.min}" max="${r.max}" step="${r.step}" value="${CAM_TUNE[key]}">
      `;
      const input = row.querySelector('input');
      const val = row.querySelector('b');
      input.addEventListener('input', () => {
        CAM_TUNE[key] = Number(input.value);
        val.textContent = `${CAM_TUNE[key]}${r.unit}`;
        saveCamTune();
      });
      box.appendChild(row);
      this._camRows.push({ key, input, val, unit: r.unit });
    }
    document.getElementById('cam-reset').addEventListener('click', () => {
      resetCamTune();
      for (const row of this._camRows) {
        row.input.value = CAM_TUNE[row.key];
        row.val.textContent = `${CAM_TUNE[row.key]}${row.unit}`;
      }
      this.rig.viewYaw = 0;
      this.rig.tiltOffset = 0;
      this.audio?.play('click');
    });
  }

  // All restarts persist their intent in localStorage and reload the clean
  // path: query-string navigation is not reliable on every host this game
  // ships to (the published artifact included).
  _reboot() {
    location.href = location.pathname;
  }

  // Render each tower into an offscreen target for the build cards.
  // Card mode. The build bar becomes a hand of exactly three cards drawn each
  // wave, so what you can build is itself part of the run. Rebuilt whenever the
  // hand changes, because a card is spent on placement and the indices shift.
  renderHand(hand) {
    this.hand = hand;
    const bar = document.getElementById('build-bar');
    bar.textContent = '';
    this.cards = {};
    this.handCards = [];
    hand.forEach((key, i) => {
      const def = TOWER_TYPES[key];
      const card = document.createElement('button');
      card.className = 'build-card';
      card.dataset.type = key;
      card.dataset.card = String(i);
      // An <img> with no src renders as a broken-image icon, so the thumb is
      // only emitted once one exists; until then the slot is a styled initial.
      const thumb = this.thumbs[key];
      card.innerHTML = `
        ${thumb
          ? `<img class="build-thumb" alt="${def.name}" src="${thumb}">`
          : `<div class="build-thumb build-thumb-fallback">${def.name.charAt(0)}</div>`}
        <div class="build-name">${def.name.split(' ')[0]}</div>
        <div class="build-cost">${def.cost}</div>
        <span class="kbd build-key">${i + 1}</span>
      `;
      card.title = `${def.name}: ${def.desc}`;
      bar.appendChild(card);
      this.handCards.push(card);
      card.addEventListener('click', () => this.game.toggleBuildCard(i));
    });
    if (!hand.length) {
      const note = document.createElement('div');
      note.className = 'hint-line';
      // Parity-aware: a cleared wave pays ONE card, and only on the odd ones.
      note.textContent = this.nextPaysCard
        ? 'Hand spent. Clear this wave for another tower.'
        : 'Hand spent. This wave pays a power; the next pays a tower.';
      bar.appendChild(note);
    }
  }

  makeThumbnails() {
    const size = 112;
    const rt = new THREE.WebGLRenderTarget(size, size);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    cam.position.set(2.6, 2.3, 2.6);
    cam.lookAt(0, 0.85, 0);
    scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x3a4a5c, 0.9));
    const key = new THREE.DirectionalLight(PALETTE.sunlight, 2.4);
    key.position.set(3, 4, 2);
    scene.add(key);

    const px = new Uint8Array(size * size * 4);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);

    for (const typeKey of Object.keys(TOWER_TYPES)) {
      const built = buildTowerVisual(typeKey, 0);
      scene.add(built.group);
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(scene, cam);
      this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      this.renderer.setRenderTarget(null);
      // flip Y and gamma-correct the linear buffer
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const src = ((size - 1 - y) * size + x) * 4;
          const dst = (y * size + x) * 4;
          img.data[dst] = Math.pow(px[src] / 255, 1 / 2.2) * 255;
          img.data[dst + 1] = Math.pow(px[src + 1] / 255, 1 / 2.2) * 255;
          img.data[dst + 2] = Math.pow(px[src + 2] / 255, 1 / 2.2) * 255;
          img.data[dst + 3] = px[src + 3];
        }
      }
      ctx.putImageData(img, 0, 0);
      // Cache it. This used to write straight into this.cards[typeKey], the
      // classic shop card, and nothing else ever saw it - so the 99 Planets
      // hand, which reads this.thumbs, rendered every card as a broken image,
      // and in card mode this.cards is empty so the write threw as well.
      this.thumbs[typeKey] = cv.toDataURL();
      this.cards[typeKey]?.querySelector('img')?.setAttribute('src', this.thumbs[typeKey]);
      scene.remove(built.group);
      built.group.traverse((o) => o.geometry?.dispose());
    }
    rt.dispose();
    // The mode shell renders its opening hand during setup, which can happen
    // before this runs. Back-fill rather than depending on the order.
    if (this.hand && this.hand.length) this.renderHand(this.hand);
  }

  // -- wiring ---------------------------------------------------------------

  _wire() {
    const g = this.game;
    g.onHudChange = () => this.refresh();
    g.onToast = (msg, kind) => this.toast(msg, kind);
    g.onLeakFx = () => this._leakFlash();
    g.onGameEnd = (won) => this.showEnd(won);

    this.el['btn-call'].addEventListener('click', () => {
      const bonus = this.waves.callEarly();
      if (bonus > 0) this.toast(`Early call: +${bonus} gold`, 'info');
      this.audio?.play('click');
    });
    this.el['btn-speed'].addEventListener('click', () => this.cycleSpeed());
    this.el['btn-pause'].addEventListener('click', () => this.togglePause());
    this.el['btn-sound'].addEventListener('click', () => this.toggleSound());
    this.el['btn-settings'].addEventListener('click', () => {
      this.el['settings-pop'].classList.toggle('show');
    });
    this.el['set-shake'].addEventListener('click', () => {
      this.rig.shakeEnabled = !this.rig.shakeEnabled;
      this.el['set-shake'].textContent = this.rig.shakeEnabled ? 'On' : 'Off';
    });
    this.el['set-quality'].addEventListener('click', () => {
      const next = { Auto: 'High', High: 'Low', Low: 'Auto' }[this.el['set-quality'].textContent];
      this.el['set-quality'].textContent = next;
      if (this.onQuality) this.onQuality(next.toLowerCase());
    });

    this.el['tp-upgrade'].addEventListener('click', () => this.game.upgradeSelected());
    this.el['tp-sell'].addEventListener('click', () => this.game.sellSelected());
    this.el['tp-close'].addEventListener('click', () => this.game.select(null));

    this.el['btn-begin'].addEventListener('click', () => this.beginGame());
    this.el['btn-talents'].addEventListener('click', () => this.showTalents());
    this.el['btn-talents-close'].addEventListener('click', () => {
      this.el['talent-overlay'].classList.remove('show');
      this.audio?.play('click');
    });
    this.el['btn-retry'].addEventListener('click', () => {
      storeLocal('whMap', CONFIG.mapKey);
      storeLocal('whSeed', String(CONFIG.seed));
      this._reboot();
    });
    this.el['btn-new'].addEventListener('click', () => {
      storeLocal('whMap', CONFIG.mapKey);
      storeLocal('whSeed', String((Math.random() * 9e6 + 1e6) | 0));
      this._reboot();
    });
    this.el['btn-continue'].addEventListener('click', () => {
      this.el['end-overlay'].classList.remove('show');
      this._ended = false;
      this.game.paused = false;
      this.audio?.play('click');
    });

    addEventListener('keydown', (e) => {
      // Pause and sound belong to the player wherever they are, but the SPEED
      // key does not: F is a jump alias while a body is possessed, and these
      // are two separate window listeners, so preventDefault in one does not
      // stop the other. Every hop was also cycling the game speed. Exactly the
      // shape of the Space-is-pause collision this project already fixed once,
      // and then hit AGAIN from the other side: Space paused the game while a
      // body was possessed, which is the key every player presses to jump, so
      // the owner reported "you cannot jump". On the ground Space is the jump
      // (js/possess.js) and P pauses; on the board both pause.
      if (e.code === 'Space') { e.preventDefault(); if (!this.possession?.active) this.togglePause(); }
      else if (e.code === 'KeyP') { e.preventDefault(); this.togglePause(); }
      else if (e.code === 'KeyF') { if (!this.possession?.active) this.cycleSpeed(); }
      else if (e.code === 'KeyM') this.toggleSound();
    });

    this.waves.onWaveStart = (n) => {
      const boss = CONFIG.waves.count === 30 ? n % 10 === 0 : n === CONFIG.waves.count;
      this.banner(`WAVE ${n}`, boss ? 'the colossus stirs' : this._waveTag(n), boss);
      this.audio?.play(boss ? 'boss' : 'waveStart');
      this.refresh();
    };
    this.waves.onWaveClear = (n, reward) => {
      this.toast(`Wave ${n} held: +${reward} gold`, 'info');
      this.audio?.play('waveClear');
      this.refresh();
    };
    this.waves.onVictory = () => this.showEnd(true);
  }

  _waveTag(n) {
    const comp = this.waves.constructor === Object ? [] : [];
    const tags = ['the swarm gathers', 'skitterers incoming', 'wings on the horizon', 'heavy plating ahead', 'a mixed tide'];
    return tags[n % tags.length];
  }

  beginGame() {
    this.el['title-overlay'].classList.remove('show');
    this.game.state = 'playing';
    this.waves.begin();
    this.rig.autoOrbit = 0;
    this.rig.flyTo(this.world.heart.group.position, this.rig.defaultDist, 1.6);
    this.audio?.start();
    this.audio?.play('begin');
    this.refresh();
  }

  // The talent tree. Rebuilt from the stored profile every time it opens, so it
  // always shows what was actually banked rather than a cached view of it.
  showTalents() {
    this.el['talent-overlay'].classList.add('show');
    this.renderTalents();
    this.audio?.play('click');
  }

  renderTalents() {
    const profile = loadProfile();
    this.el['talent-coins'].textContent = String(profile.coins);
    const host = this.el['talent-tiers'];
    host.textContent = '';
    const tiers = [...new Set(TALENTS.map((t) => t.tier))].sort((a, b) => a - b);
    for (const tier of tiers) {
      const row = document.createElement('div');
      row.className = 'talent-row';
      for (const t of TALENTS.filter((x) => x.tier === tier)) {
        const owned = isOwned(profile, t);
        const reachable = isReachable(profile, t);
        const afford = profile.coins >= t.cost;
        const b = document.createElement('button');
        b.className = `talent-node ${owned ? 'owned' : reachable ? (afford ? 'ready' : 'poor') : 'locked'}`;
        b.innerHTML = `
          <div class="tn-kind">${t.kind}</div>
          <div class="tn-name">${t.name}</div>
          <div class="tn-desc">${t.desc}</div>
          <div class="tn-cost">${owned ? 'owned' : reachable ? `${t.cost} coins` : 'locked'}</div>
        `;
        if (!owned && reachable) {
          b.addEventListener('click', () => {
            const r = buyTalent(t.id);
            if (r.ok) {
              this.toast(`${t.name} unlocked`, 'info');
              this.audio?.play('talent');
              this.renderTalents();
            } else {
              this.toast(r.reason === 'coins' ? 'Not enough coins' : 'Locked', 'warn');
              this.audio?.play('deny');
            }
          });
        }
        row.appendChild(b);
      }
      host.appendChild(row);
    }
  }

  showTitle() {
    this.el['title-overlay'].classList.add('show');
  }

  // Cards are <button> elements on purpose. css/style.css sets
  // `#hud > * { pointer-events: none }` at ID specificity and only buttons,
  // .panel and .build-card get it back, so a <div> card would look completely
  // correct and be completely unclickable.
  showDraft(offers, onPick) {
    const host = document.getElementById('draft-cards');
    host.textContent = '';
    offers.forEach((power, i) => {
      const card = document.createElement('button');
      card.className = `draft-card ${power.rarity}`;
      card.innerHTML = `
        ${powerSigil(power.tag)}
        <div class="dc-rarity">${power.rarity}</div>
        <div class="dc-name">${power.name}</div>
        <div class="dc-desc">${power.desc}</div>
      `;
      card.addEventListener('click', () => onPick(i));
      host.appendChild(card);
    });
    this.setDraftTimer(1);
    document.getElementById('draft-overlay').classList.add('show');
  }

  setDraftTimer(fraction) {
    const fill = document.getElementById('draft-timer-fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }

  hideDraft() {
    document.getElementById('draft-overlay').classList.remove('show');
  }

  // -- first person ---------------------------------------------------------

  showPossession(unit) {
    const e = this.el;
    e['fp-hud'].classList.add('show');
    e['fp-name'].textContent = unit.type.name;
    e['fp-rally'].style.display = unit.type.commander ? '' : 'none';
    e['fp-cross'].dataset.kind = unit.type.strike?.cross || 'melee';
    this.updatePossession(unit);
  }

  updatePossession(unit) {
    if (!unit) return;
    const e = this.el;
    const frac = Math.max(0, Math.min(1, unit.hp / unit.hpMax));
    e['fp-hp'].style.width = `${frac * 100}%`;
    e['fp-hp'].classList.toggle('low', frac < 0.35);
    // The swing meter fills as the cooldown drains, so full means ready.
    const dur = unit.swingDur || 0.55;
    const ready = unit.swingT > 0 ? 1 - unit.swingT / dur : 1;
    e['fp-swing'].style.width = `${Math.max(0, Math.min(1, ready)) * 100}%`;
    e['fp-swing'].classList.toggle('ready', unit.swingT <= 0);
    this.el['damage-vignette'].classList.toggle('fp-hurt', frac < 0.35);
  }

  // What is currently selected on the board, and what it can be told to do.
  showSelection(count, name) {
    const el = this.el['sel-readout'];
    el.classList.toggle('show', count > 0);
    if (count > 0) {
      el.innerHTML = count === 1
        ? `<b>${name}</b> selected<span>Right-click the ground to send them</span>`
        : `<b>${count} units</b> selected<span>Right-click the ground to send them</span>`;
    }
  }

  // Called when the link to the base drops or comes back.
  setBaseLink(linked) {
    this.el['fp-link'].classList.toggle('show', !linked);
    if (!linked) {
      const w = this.el['link-warn'];
      w.classList.remove('go');
      void w.offsetWidth;
      w.classList.add('go');
      this.audio?.play('deny');
    }
  }

  // Board chrome off while the player is on the ground. Also lifts the
  // first-person panel out from under the build bar: the two plus the selection
  // readout were all landing on the same pixels at the bottom centre, which
  // made the mode's only first-person tutorial unreadable.
  setBoardEnabled(on) {
    document.getElementById('build-bar')?.classList.toggle('board-off', !on);
    this.el['tower-panel']?.classList.toggle('board-off', !on);
    this.el['sel-readout']?.classList.toggle('board-off', !on);
  }

  hidePossession() {
    this.el['fp-hud'].classList.remove('show');
    this.el['fp-link'].classList.remove('show');
    this.el['damage-vignette'].classList.remove('fp-hurt');
  }

  // A hit confirmation the eye can actually catch: the crosshair kicks for a
  // moment. Blocked reads differently from landed, because from evolution tier
  // three a shield eats the first hits of an engagement and a swing that does
  // nothing with no feedback reads as a broken weapon.
  strikeFeedback(landed, blocked) {
    const h = this.el['fp-hit'];
    h.classList.remove('go', 'blocked');
    void h.offsetWidth;              // restart the animation
    h.classList.add('go');
    if (blocked) h.classList.add('blocked');
  }

  showEnd(won, subtitle) {
    // A run ends once. The classic wave director and a mode's own run core can
    // both declare an ending for the same run, and whichever arrived second
    // used to overwrite the first one's message with its generic default - so
    // a 99 Planets win reported "15 waves repelled" instead of the planet it
    // had just taken.
    if (this._ended) return;
    this._ended = true;
    const e = this.el;
    e['end-mark'].textContent = won ? 'THE DAWN HOLDS' : 'THE HEART FADES';
    e['end-sub'].textContent = subtitle
      || (won ? `${CONFIG.waves.count} waves repelled` : `fell on wave ${this.waves.wave}`);
    e['end-card'].classList.toggle('danger', !won);
    e['end-waves'].textContent = String(this.waves.wave);
    e['end-kills'].textContent = fmt(this.game.kills);
    e['end-score'].textContent = fmt(this.game.score);
    const top = [...this.game.towerMgr.towers].sort((a, b) => b.damageDealt - a.damageDealt)[0];
    e['end-body'].innerHTML = top
      ? `Highest damage: <b style="color:var(--accent)">${top.def.name}</b> with ${fmt(Math.round(top.damageDealt))}.`
      : 'The world stood undefended.';
    e['btn-continue'].style.display = won ? '' : 'none';
    e['end-overlay'].classList.add('show');
    this.game.paused = true;
    this.audio?.play(won ? 'victory' : 'defeat');
  }

  // -- runtime --------------------------------------------------------------

  cycleSpeed() {
    if (this.game.state !== 'playing') return;
    this.game.speed = this.game.speed >= 3 ? 1 : this.game.speed + 1;
    this.el['speed-label'].textContent = `${this.game.speed}x`;
    this.audio?.play('click');
  }

  togglePause() {
    if (this.game.state !== 'playing') return;
    this.game.paused = !this.game.paused;
    this.reflectPause();
    this.audio?.play('click');
  }

  reflectPause() {
    this.el['btn-pause'].innerHTML = this.game.paused ? icon('play') : icon('pause');
  }

  toggleSound() {
    if (!this.audio) return;
    const muted = this.audio.toggleMute();
    this.el['btn-sound'].innerHTML = muted ? icon('volumeX') : icon('volume');
  }

  toast(msg, kind = 'info') {
    const anchor = this.el['toast-anchor'];
    if (anchor.children.length > 2) anchor.firstChild.remove();
    const t = document.createElement('div');
    t.className = `toast ${kind === 'info' ? '' : kind}`;
    t.textContent = msg;
    anchor.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 240);
    }, 2800);
  }

  banner(big, small, danger = false) {
    const b = this.el['wave-banner'];
    this.el['banner-big'].textContent = big;
    this.el['banner-small'].textContent = small;
    b.classList.toggle('danger', danger);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  _leakFlash() {
    const v = this.el['damage-vignette'];
    v.classList.add('hit');
    clearTimeout(this._vigT);
    this._vigT = setTimeout(() => v.classList.remove('hit'), 90);
    if (!this.seen.leak) {
      this.seen.leak = true;
      this.toast('The Worldheart dims when enemies reach it', 'danger');
    }
    this.audio?.play('leak');
  }

  refresh() {
    const g = this.game;
    const e = this.el;
    e['gold-num'].textContent = fmt(g.gold);
    e['lives-num'].textContent = String(g.lives);
    e['score-line'].textContent = `score ${fmt(g.score)}`;
    const frac = g.lives / CONFIG.economy.startLives;
    const fill = e['lives-fill'];
    fill.style.transform = `scaleX(${frac})`;
    fill.classList.toggle('hurt', frac <= 0.6 && frac > 0.3);
    fill.classList.toggle('critical', frac <= 0.3);

    if (this.handCards) {
      // Card mode: affordability is the only gate, and the armed card is the
      // one selected by INDEX, since a hand may hold the same tower twice.
      this.handCards.forEach((card, i) => {
        const key = card.dataset.type;
        const cost = g._cost ? g._cost(TOWER_TYPES[key]) : TOWER_TYPES[key].cost;
        card.classList.toggle('selected', g.selectedCard === i);
        card.classList.toggle('locked', g.gold < cost);
        card.querySelector('.build-cost').textContent = String(cost);
      });
    } else {
      for (const key of Object.keys(this.cards)) {
        const card = this.cards[key];
        const unlocked = !this.unlockedTowers || this.unlockedTowers.includes(key);
        card.classList.toggle('selected', g.buildType === key);
        // Reuses the existing `locked` look so an unaffordable and a not-yet-
        // unlocked tower read the same way; the title says which it is.
        card.classList.toggle('locked', !unlocked || g.gold < TOWER_TYPES[key].cost);
        card.disabled = !unlocked;
        card.title = unlocked
          ? `${TOWER_TYPES[key].name}: ${TOWER_TYPES[key].desc}`
          : `${TOWER_TYPES[key].name} - locked. Survive more waves.`;
      }
    }

    if (g.buildType && !this.seen.build) {
      this.seen.build = true;
      this.toast(CONFIG.map.mode === 'space'
        ? 'Build on any rock, sides included. The swarm flies in low, mid, and high lanes: match your coverage.'
        : 'Click open ground to build. Every breach must keep a path to the heart.', 'info');
    }
    e['hint-line'].textContent = g.buildType
      ? `Placing ${TOWER_TYPES[g.buildType].name}. Right-click to cancel.`
      : (g.selectedTower ? '' : '');

    // tower panel
    const t = g.selectedTower;
    const panel = e['tower-panel'];
    panel.classList.toggle('show', !!t);
    if (t) {
      const st = t.stats;
      e['tp-name'].textContent = t.def.name;
      // Roman numerals for the three authored marks, then plain numbers - the
      // array lookup returned undefined past MK III and textContent turned that
      // into an empty badge, so a tier-7 tower looked identical to a tier-3 one.
      e['tp-tier'].textContent = t.tier < 3 ? ['MK I', 'MK II', 'MK III'][t.tier] : `MK ${t.tier + 1}`;
      e['tp-desc'].innerHTML = `${t.def.desc} <em>${t.def.flavor}</em>`;
      const rows = [];
      // Rounded. Every stat above the authored tiers is scaled by a power curve
      // and printed raw it read "143.41380686670303", overflowing the column.
      const num = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
      if (st.dmg) rows.push(['Damage', num(st.dmg)], ['Rate', `${st.rate ? num(st.rate) + '/s' : 'charge'}`]);
      if (st.dps) rows.push(['Damage', `${num(st.dps)}/s`], ['Ramp', `${st.rampMax}x`]);
      // A barracks has no damage numbers at all, so without these its panel
      // showed only Range/Dealt/Kills and a garrison upgrade changed nothing
      // visible. The `summoner` flag existed for exactly this and was read by
      // nothing.
      if (t.def.summoner) {
        rows.push(['Garrison', st.garrison], ['Respawn', `${st.summonTime}s`], ['Leash', st.leash]);
      }
      if (st.slow) rows.push(['Slow', `${Math.round(st.slow * 100)}%`]);
      if (st.aoe) rows.push(['Blast', st.aoe.toFixed(1)]);
      if (st.chains) rows.push(['Chains', st.chains]);
      rows.push(['Range', st.range.toFixed(1)]);
      rows.push(['Dealt', fmt(Math.round(t.damageDealt))]);
      rows.push(['Kills', fmt(t.kills)]);
      e['tp-stats'].innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
      // There is no tier ceiling any more, so the button is ALWAYS offered and
      // the price is what stops you. Hiding it at MK III left the whole
      // uncapped ladder reachable only through a hotkey taught once in small
      // print on the title screen.
      if (g.uncappedTiers || t.tier < 2) {
        const cost = tierCost(t.typeKey, t.tier + 1);
        e['tp-upgrade'].textContent = `Upgrade ${fmt(cost)}`;
        e['tp-upgrade'].disabled = g.gold < cost;
        e['tp-upgrade'].style.display = '';
      } else {
        e['tp-upgrade'].style.display = 'none';
      }
      e['tp-sell'].textContent = `Sell +${fmt(t.sellValue(g.refundFrac()))}`;
    }
  }

  update() {
    const w = this.waves;
    const e = this.el;
    let label = 'STANDBY', sub = 'the breach stirs';
    let showCall = false;
    if (this.game.state === 'playing' || this.game.state === 'defeat') {
      if (w.state === 'countdown') {
        const next = w.wave + 1;
        label = next > CONFIG.waves.count ? `ENDLESS ${next}` : `WAVE ${next}/${CONFIG.waves.count}`;
        sub = `breach in ${Math.max(0, Math.ceil(w.countdown))}s`;
        showCall = true;
        e['call-bonus'].textContent = String(Math.floor(w.countdown) * CONFIG.waves.earlyBonusPerSec);
      } else {
        label = w.wave > CONFIG.waves.count ? `ENDLESS ${w.wave}` : `WAVE ${w.wave}/${CONFIG.waves.count}`;
        const left = this.game.enemies.active.length + w.pendingSpawns;
        sub = `${left} remaining`;
      }
    }
    if (e['wave-label'].textContent !== label) e['wave-label'].textContent = label;
    if (e['wave-sub'].textContent !== sub) e['wave-sub'].textContent = sub;
    const callVisible = e['btn-call'].style.display !== 'none';
    if (showCall !== callVisible) e['btn-call'].style.display = showCall ? '' : 'none';

    // boss bar
    let boss = null;
    for (const en of this.game.enemies.active) if (en.type.boss) { boss = en; break; }
    const bb = e['boss-bar'];
    if (boss) {
      bb.classList.add('show');
      e['boss-fill'].style.transform = `scaleX(${Math.max(0, boss.hp / boss.hpMax)})`;
    } else if (bb.classList.contains('show')) {
      bb.classList.remove('show');
    }
  }
}
