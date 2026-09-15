# Home planets, battle music and production workflow

Owner: Codex. Active branch: `feature/homeworld-combat-audio`, based on V2
fc5299c and its evidence closeout. September 15, 2026. Publish to V2 only.

| Item | State | Acceptance |
|---|---|---|
| U149 Reusable production workflow | Verified, plugin PR published and installed | [Aegis PR #2](https://github.com/majieddd/claude-plugins-custom/pull/2), cb14a65, 3.16.0 local install; 48 workflow tests, 37 runtime checks, 200 source/install files identical |
| U150 Plasma rifle and blade audio | Verified and published to V2 | Warm falling plasma pulse; blade contact and swing air envelopes; nine accepted cues PCM-locked; 82 local and 82 public audio browser checks; owner listening remains explicit |
| U151 Five combat arrangements | Published in Audio Lab, awaiting owner listening | Five 96-second battle arrangements in Audio Lab only; 20 technical signal checks; five calm arrangements and nine owner songs byte-identical |
| U152 Claim and revisit home planets | Verified and published to V2 | Full-planet eligibility; saved seed/theme/anchor/defenses/inventory; lobby revisit; quota/corruption refusal and backups; isolated campaign storage |
| U153 Home incursions and decoration | Verified and published to V2 | Manual start/stop, wave checkpoints, defeat rollback, six free saved decorations, peaceful music and HUD, quake terrain persistence |

## Owner decisions

- Pickup, upgrade and victory are approved, alongside the six previously accepted cues.
- The five U148 arrangements are approved as calm music, not battle music.
- The two new YouTube references guide plasma and blade character. Web retrieval
  failed; no claim is made that the agent heard them.
- Home checkpoint means the last peaceful state saved before an incursion,
  advanced after clearing a wave. Defeat returns there with defenses and decor.
  Multiplayer visits remain future work; this implementation saves locally.

## What changed in the working process

The repeated costs were re-reading unrelated skill references, re-authoring
content generation scripts, regenerating unchanged candidates, accidentally
touching approved sounds, and copying tracker/public-verification scripts.
No measured token-savings percentage is claimed.

- Design Forge now has an existing-DESIGN.md targeted-change path and loads only
  relevant references. Shared audio guidance no longer carries another game's
  procedural-only rule or a universal ban on generated music.
- Aegis content batches capture recipe, source, model and output identities.
  Preparation precedes generation; a verified receipt is distinct from a file
  merely existing. Pilot checks and approved-asset locks prevent blind batch work.
- Its tracker tool edits one unique marker-delimited section, preserves all
  surrounding UTF-8 text, previews changes and checks for intervening edits.
- The plugin install now handles Windows Git Bash/WSL selection and LF shell files.
- This project adopts `tools/production/combat-music.batch.json`, approved SFX
  PCM locks, recipe-aware local generation, parameterized mastering and
  `tools/verify-preview.mjs`. Existing battle exports correctly remain `inspect`
  in the new generic batch tool because they predate its preparation tickets.
  No retrospective generation receipts were fabricated.

## Home rules and persistence

Claim from Expedition kit after all ten base upgrades cover the globe, between
waves or at victory. Claim opens a separate home route; campaign progress remains
available in the lobby. Claiming the same generated world revisits its saved home
instead of overwriting it. A home begins peaceful, with no wave timer or weather.

Start incursions explicitly. Stop finishes the current wave and returns to peace.
Each cleared wave advances the checkpoint after its draft is resolved. Defeat
reloads the saved peaceful checkpoint, including gold, weapons, cards, forge cost,
crystals, towers, terrain faults and decorations. Home waves award local resources;
account coins remain expedition rewards so retries cannot duplicate account coins.

Six free cosmetic pieces: crystal lantern, flower garden, victory banner, bench,
garden arch and heart monument. Choose facing, tap terrain to place or remove,
or use Place here / Remove nearby on foot. Decorations do not block navigation
or improve combat. Quakes reseat them on changed ground. Edits autosave, with
explicit save failure feedback; export/import backups are available in the home
and imports in the lobby. Up to 99 homes and 500 pieces per home are supported
by storage validation, not a claim of measured performance at those limits.

Saves live in this browser, with separate V2 keys. Backups transfer save data;
there is no cloud sync or multiplayer visitor service. The seed, accepted anchor,
environment and faults reproduce the current generator. Future generator changes
must preserve or migrate these versioned saves; a seed alone is not a promise
that arbitrary future generator rewrites will render the same world.

## Audio delivery

Approved pickup, upgrade and victory join click, build, blocked, mortar, grass
and hard footsteps in the frozen PCM manifest. Normal play now uses these accepted
clips plus the revised rifle/blade effects. Other unapproved comparison cues stay
in the opt-in material sound bank. Rifle uses a rounded energy pulse and falling
plasma tail. Blade contact follows family/material, with shorter contact bodies
and air movement timed to the existing physical swing envelope.

The five prior arrangements are assigned to quiet homes by theme. Five new
orchestral/band plus Jungle/Garage/DnB briefs cover Garden, Canopy, Dune, Frozen
and Molten worlds. They are local ACE-Step 1.5 reference-conditioned arrangements,
which can retain melodic material from the owner's sources. Exact model revision,
prompts, seeds, hashes, mastering and source provenance are in
`audio/combat-drafts/manifest.json` and `CREDITS.md`. They remain approval-only.

Machine signal checks do not certify musical quality, genre or absence of voice-like
output. The agent cannot hear audio. The owner's no-vocals requirement is in every
generation brief; owner listening is still required before battle integration.

## Verification and retained failures

- 349 core/tool tests, 103 module parses, house style. Seven focused home tests
  cover eligibility, inventory validation, RNG restoration, forge/crystal state,
  quota refusal, backup merge and campaign isolation.
- 82 local audio browser checks: lazy/exclusive music playback, all effect cues,
  normal and opt-in game routes, mobile layout, clipping/mute/fallback behavior.
- A complete unforced instrumented ten-wave campaign defense used legal purchases,
  cards and placements. It ended with 20/20 heart lives, 240 kills and six towers,
  then extracted to Planet 2 with its equipment. Simulation ran at 60 Hz with sparse
  rendering; this is not blind play or a physical-device FPS measurement.
- All four classic maps boot and pass their camera suites.
- First home revisit failed because a crystal pickup's private Three.js cache
  vector was serialized as gameplay state. The save now explicitly whitelists
  pickup fields. Failed runs are retained in the local QA archive.
- Two over-strict test comparisons were corrected with measured tolerances:
  tower spherical-coordinate roundtrips and quake graph Float32 direction sampling.
  The complete 426,335-node quake probe found a maximum 0.0000353 world-unit height
  difference after reload, with matching faults and no deck differences. This was
  numerical precision, not missing terrain. Tests require error below 0.0001 units.
- The legacy broad regression test expected commander death inside the base to
  end the game, despite the existing respawn rule. Its failure is retained;
  `--classic` isolates the required four-map checks. Home death recovery and a
  complete campaign are covered separately, not counted as that old test passing.
- The first Dune take failed for 12 nearly silent one-second windows. Its replacement
  used a new source/seed and passed the same signal gate. Both failure measurements
  and the rejected MP3 remain in the local archive. Five final tracks are 96 seconds,
  approximately -19 LUFS, with controlled peaks and preserved source-file hashes.

The final 23 local home checks include real touch events, quake commit/reload, peaceful HUD,
claim/revisit, defeat rollback and cleared-wave checkpointing. Compact reports and
phone/lobby captures are in [the evidence folder](HOMEWORLD-COMBAT-AUDIO/).
Final public evidence is linked below.
Physical-phone acceptance, owner audio approval and future multiplayer are separate.

The first public candidate f0475b7 passed 22 home checks and all 182 deployed
file comparisons, with main unchanged. Its 82 public audio checks pass after
a test harness race was fixed: the fallback scenario now waits for the lab
module to finish loading before reading its handles. The first failing report
is retained. The final follow-up adds active-home backup reload so pending
autosave cannot overwrite an imported checkpoint, and incursion HUD labels
that remain meaningful past wave ten. The final follow-up passed all 23 public home checks, including active-home import.

## Published checkpoint

V2 `9d7a37b07e0e2b432aa62e65a5884bdfc607b521`, [PR #46](https://github.com/majieddd/worldheart/pull/46),
[successful Pages action](https://github.com/majieddd/worldheart/actions/runs/35002122390).
23 local and 23 public home cases pass; the final 182 live/source hashes match.
The 82 public audio checks ran on f0475b7; all audio assets and audio modules are
byte-identical in the follow-up. A targeted HUD fixture also verifies HOME PLANET,
INCURSION 1 and INCURSION 11. Main remains 1374122.
[Machine-readable publication record](HOMEWORLD-COMBAT-AUDIO/publication.json).

Counts are explicit: the first local home report had 21 checks, the first public
report added calm playback for 22, and backup restoration brought the final suite
to 23. Earlier prose saying 22 local checks referred to the developing suite; the
retained JSON reports are authoritative. The closing commit changes only evidence
and a test navigation wait, not deployed gameplay.
