// Campaign progress across runs.
//
// Lives in the SHELL, not the core: js/run may not touch storage (portability
// contract rule 1), which is what keeps the core transliterable to Luau where
// this becomes a DataStore instead.

const KEY = 'wh99Progress';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { planetsBeaten: 0 };
    const parsed = JSON.parse(raw);
    // Never trust the stored shape. A hand-edited or half-written value must
    // not take the game down on boot.
    return { planetsBeaten: Number.isFinite(parsed?.planetsBeaten) ? parsed.planetsBeaten : 0 };
  } catch {
    return { planetsBeaten: 0 };
  }
}

export function bankVictory() {
  const next = { planetsBeaten: loadProgress().planetsBeaten + 1 };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}
