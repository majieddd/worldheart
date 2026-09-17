// This is an authored game cipher, not a claimed reconstruction of a historical language.
export const glyphs={
 a:'M26 6V31L15 41L5 31V16L16 7M5 22H18V32M25 13H32',
 b:'M6 5V41H20L30 31L20 22H6M6 5H21L29 13L20 22',
 c:'M29 7L17 4L5 16V32L17 41L29 36M5 23H16',
 d:'M6 5V41H17L30 29V16L17 5H6M14 14V31',
 e:'M29 5H8V41H29M8 23H23M20 5L28 13',
 f:'M7 41V5H30M7 22H23M20 5V13',
 g:'M29 12L18 4L5 15V31L18 41L30 30V23H18',
 h:'M5 5V41M29 5V41M5 23H29M12 12L21 7',
 i:'M8 5H27M17 5V41M8 41H27M17 20L27 26',
 j:'M10 5H29V31L18 41L5 30V23M21 5V16',
 k:'M5 5V41M30 5L8 24L30 41M21 16H30',
 l:'M4 11L17 4L30 12L20 21H7V34L17 41M27 30V42M3 26H12',
 m:'M3 8H13V20L24 31V42M22 4L31 14L22 23M3 31L11 39',
 n:'M5 41V5L29 41V5M5 23H13M22 23H29',
 o:'M4 13L16 4L28 12V28L16 40L4 32V24M11 17H21V28H14',
 p:'M6 41V5H21L30 15L21 25H6M13 13H21',
 q:'M5 14L17 4L29 14V30L17 40L5 30V14M18 27L31 43',
 r:'M6 41V5H21L30 15L21 24H6M17 24L30 41',
 s:'M29 10L17 4L5 15L29 31L17 41L5 35M11 21H24',
 t:'M4 6H30M17 6V41M9 31L17 41L25 31',
 u:'M5 5V30L17 41L29 30V5M12 12V25',
 v:'M4 5L17 41L30 5M9 20H25',
 w:'M3 5L8 41L17 25L26 41L31 5M11 12H23',
 x:'M5 5L29 41M29 5L5 41M5 23H29',
 y:'M7 4V14L26 25V39M3 24L17 32M20 5L30 11L24 17',
 z:'M5 5H29L5 41H29M10 23H24'
};
export const readings=['ah','beh','keh','deh','eh','feh','geh','hah','ee','jah','kah','lah','mah','nah','oh','pah','kwah','rah','sah','tah','oo','vah','wah','kseh','yah','zah'];
export const elements=[
 {id:'physical',name:'Physical',role:'Strength & endurance',color:'#964a33',stats:{Power:5,Speed:1,Health:5,'Element resistance':1,Complexity:1},description:'Reddish-brown, massive and slow. Physical Xeno rely on shell strength, hard blows and endurance, with few special abilities. Mars is their established habitat; hollow meteors carry them through space.',cue:'Dust, shell chips and heavy ground contact. Weight is the spectacle.',counter:'Create distance, attack from the flank and exploit slow turns.'},
 {id:'void',name:'Void',role:'Teleporting scout',color:'#6f4594',stats:{Power:1,Speed:4,Health:1,'Element resistance':5,Complexity:4},description:'Purple and physically fragile. Void Xeno resist elemental attacks and use a teleportation system to scout ahead. They are the first invaders to appear on Earth, arriving before the brown meteor inhabitants.',cue:'A narrow violet aperture, a clear departure tell and a sharp reappearance. Keep the thin silhouette visible.',counter:'Proposed counter: physical pressure and an exposed recovery after teleporting. Resistance is not immunity.'},
 {id:'frost',name:'Frost',role:'Defensive controller',color:'#356984',stats:{Power:2,Speed:2,Health:4,'Element resistance':3,Complexity:3},description:'Pale blue shell, ice-white edges and navy recesses. Proposed role: slow an approach and protect a short defensive line. Exact resistances and status rules await the elemental prototype.',cue:'A clean-edged frost patch, a short crystal burst and visible thawing.',counter:'Leave the marked slow field and pressure the long recovery.'},
 {id:'fire',name:'Fire',role:'Committed attacker',color:'#a64026',stats:{Power:4,Speed:3,Health:2,'Element resistance':2,Complexity:2},description:'Ember-red and burnt-orange chitin with dark heat seams. Proposed role: commit to short aggressive bursts that trade endurance for pressure.',cue:'A contained hot core opens before the attack; a brief flame arc marks its reach.',counter:'Evade the marked attack and punish the cooling interval.'},
 {id:'poison',name:'Poison',role:'Patient area denial',color:'#53621d',stats:{Power:2,Speed:2,Health:3,'Element resistance':3,Complexity:4},description:'Moss-green chitin and small yellow-green toxin sacs. Proposed role: control routes with persistent hazards, trading immediate damage for preparation.',cue:'Outlined toxin pools with open gaps and a visible fade. Keep haze away from the aiming line.',counter:'Move between safe gaps, avoid lingering in pools and close during the release tell.'}
];
export const glyphSVG=(letter)=>`<svg viewBox="0 0 36 48" role="img" aria-label="Xeno glyph for ${letter.toUpperCase()}"><path d="${glyphs[letter]||''}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
export const encode=(text)=>[...text.toLowerCase()].map(c=>glyphs[c]?glyphSVG(c):c===' '?'<span class="glyph-space" aria-hidden="true"></span>':'').join('');
export function glyphMarkup(){return `<section class="codex"><h2>Xeno script / Adamic-inspired alphabet</h2><p class="lede">26 original glyphs, one consistent A-Z key. The maker mark reads <strong>ayy lmao</strong>.</p><p>This is the game's fictional Adamic-inspired writing system. The readings below are invented design proposals, not an authenticated Adamic alphabet or historical translation. A letter cipher is supplied here; a full spoken language and grammar remain future worldbuilding.</p><div class="cipher-tool"><label for="cipher-input">Try the script <span>Latin letters and spaces, up to 80 characters</span></label><input id="cipher-input" value="ayy lmao" maxlength="80" autocomplete="off" spellcheck="false"><div id="cipher-output" class="glyph-line" aria-live="polite" aria-label="ayy lmao in Xeno script">${encode('ayy lmao')}</div></div><div class="alphabet">${Object.entries(glyphs).map(([key])=>`<div class="letter">${glyphSVG(key)}<strong>${key.toUpperCase()}</strong><span>${readings[key.charCodeAt(0)-97]}</span></div>`).join('')}</div><p class="small">Read left to right. Spaces separate words. Repeated letters repeat the same glyph. A, Y, L, M and O retain the original maker-mark designs. Each tile pairs its Latin key with a fictional Adamic-inspired reading.</p><details><summary>Language source boundary</summary><p>The Adamic language belongs to religious and speculative linguistic traditions. This game does not claim a recovered historical script. <a href="https://scholarsarchive.byu.edu/rmmra/vol8/iss1/11/">Historical discussion of Adamic-language ideas</a>.</p></details></section>`;}
