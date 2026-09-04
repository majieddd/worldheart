// Run state as plain, serialisable data.
//
// No class instances, no renderer handles, no Vector3. Everything here must
// survive JSON.stringify and come back identical, because phase 2 sends this
// over the wire and stores it in a DataStore.
//
// Two ownership rules from the spec, and they differ on purpose:
//   - GOLD is per player.
//   - POWERS belong to the run, because the draft is shared and yields one
//     power for the whole team.

export const STARTING_TOWER = 'bolt';
export const DEFAULT_START_GOLD = 450;

export function createRunState({ seed, playerIds, startGold = DEFAULT_START_GOLD }) {
  return {
    seed,
    wavesCleared: 0,
    phase: 'building',
    players: playerIds.map((id) => ({ id, gold: startGold })),
    powers: [],
    unlockedTowers: [STARTING_TOWER],
    // The hand of placeable tower cards. Always refilled to HAND_SIZE at the
    // top of a wave; placing a tower spends its card.
    hand: [],
    lives: 20,
    // The Worldheart's level, and how many frontier expansions have actually
    // been applied. These are two numbers rather than one because a cleared
    // wave earns a ring the heart may not yet be able to hold, and the run
    // has to remember what is owed.
    heartLevel: 0,
    frontierSteps: 0,
  };
}

export function serialise(state) {
  return JSON.stringify(state);
}

export function deserialise(text) {
  return JSON.parse(text);
}
