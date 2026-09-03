// Sigils for the power draft. Inline SVG rather than an <img>, so the shapes
// inherit the card's colour through `currentColor` and change with its rarity.
//
// These are drawn rather than sourced because the project has no image assets
// at all: tower thumbnails are rendered from the real models at boot, and a
// power has no model to render. Every shape is built on the same 24 unit box
// and 2 unit stroke as the rest of the HUD icons.
const PATHS = {
  damage: '<path d="M4 20 L14 10 M11 4 L20 4 L20 13 M20 4 L12 12"/>',
  rate:   '<path d="M12 3 v9 l6 3"/><circle cx="12" cy="12" r="9"/>',
  range:  '<circle cx="12" cy="12" r="3"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>',
  gold:   '<circle cx="12" cy="12" r="7.5"/><path d="M12 7.5 v9 M9.6 9.8 h4.2 a2.2 2.2 0 0 1 0 4.4 h-4.2"/>',
  cost:   '<path d="M4 12 h16 M8 8 l-4 4 l4 4"/><path d="M17 5 v14"/>',
  heart:  '<path d="M12 20 C6 15.5 3 12.5 3 9.2 A4.2 4.2 0 0 1 12 6.8 A4.2 4.2 0 0 1 21 9.2 C21 12.5 18 15.5 12 20 Z"/>',
  crit:   '<path d="M12 2 l2.6 6.4 L21 11 l-6.4 2.6 L12 20 l-2.6-6.4 L3 11 l6.4-2.6 Z"/>',
  chain:  '<path d="M13 4 L7 13 h5 l-2 7 6-9 h-5 Z"/>',
  slow:   '<path d="M12 2 v20 M3.5 7 l17 10 M20.5 7 l-17 10"/>',
  pierce: '<path d="M2 12 h20 M16 7 l5 5 l-5 5"/><circle cx="9" cy="12" r="3"/>',
  burn:   '<path d="M12 21 C8 21 6 18 6 15 C6 11 10 9 10 5 C13 7 14 9 14 11 C15.5 10 16 8.5 16 7 C17.5 9 18 12 18 15 C18 18 16 21 12 21 Z"/>',
  volley: '<path d="M3 18 h4 v-4 h4 v-5 h4 v-5 h6"/>',
};

export function powerSigil(tag) {
  const d = PATHS[tag] || PATHS.damage;
  return `<svg class="dc-sigil" width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${d}</svg>`;
}
