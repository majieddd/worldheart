// Base-only resource accounting. World proximity and life state are validated
// by the mode; identities, capacity and duplicate transactions live here.
export const CRYSTAL_CAPACITY = 3;
export const CRYSTAL_CREDIT = 100;

export function createCrystalLedger() {
  const registered = new Set(), claimed = new Set(), deposited = new Set();
  const carried = [];
  let credit = 0;
  return {
    register(id) { if (typeof id === 'string' && id) registered.add(id); },
    pickup(id) {
      if (!registered.has(id) || claimed.has(id) || carried.length >= CRYSTAL_CAPACITY) return false;
      claimed.add(id); carried.push(id); return true;
    },
    deposit({ alive, nearHeart }) {
      if (!alive || !nearHeart || !carried.length) return { count: 0, credit: 0 };
      const count = carried.length;
      for (const id of carried) deposited.add(id);
      carried.length = 0;
      const paid = count * CRYSTAL_CREDIT; credit += paid;
      return { count, credit: paid };
    },
    quote(cost, gold) {
      if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(gold) || gold < 0) return null;
      const useCredit = Math.min(credit, cost), useGold = cost - useCredit;
      return { credit: useCredit, gold: useGold, shortfall: Math.max(0, useGold - gold), afford: gold >= useGold };
    },
    spend(cost, gold) {
      const q = this.quote(cost, gold);
      if (!q?.afford) return null;
      credit -= q.credit; return q;
    },
    loseCarried() { const count = carried.length; carried.length = 0; return count; },
    get carried() { return [...carried]; },
    get credit() { return credit; },
    snapshot() { return { version: 1, carried: [...carried], claimed: [...claimed], deposited: [...deposited], credit }; },
  };
}
