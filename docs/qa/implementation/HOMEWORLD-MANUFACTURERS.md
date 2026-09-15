# Homeworld lobby and weapon manufacturers

Owner: Codex. Branch: `feature/homeworld-manufacturers`, based on preview
`fbea3a0`. Status: locally verified; V2 publication pending. Main is not a deployment target.

| Item | Status | Acceptance |
| --- | --- | --- |
| U154 Homeworld lobby | Verified locally | Dedicated station, captured planet catalogue, selected home persists, visit/import and empty states, desktop and touch |
| U155 Manufacturer weapons | Verified locally | Four distinct manufacturers, deterministic modifiers, real combat skills, old inventory/save compatibility |
| U156 Weapon cards and inspection | Verified locally | Reference-inspired cards, actual model preview, comparison, no ammo or level fields, Debug World combinations |
| U157 Verification and V2 | Local checks pass; publishing next | Pure tests, browser combat/save checks, visual and responsive inspection, published build identity |

Captured means full Worldheart coverage, preserving the existing claim rule.
Selection must preserve the previously owned planet and its checkpoint.
Existing audio feedback U150/U151 remains open; this work does not replace songs
or claim sound approval.

## Reference decisions

The two owner screenshots establish rarity frames, clear weapon identity, DPS,
stat comparisons, trait rows and a manufacturer footer. Ammo, reload and visible
level fields do not apply to Worldheart. Original geometry and brand motifs will
fit the faceted Worldheart models. Manufacturer and part effects must reach combat,
not exist only as card text.

[2K's gameplay deep dive](https://newsroom.2k.com/news/borderlands-4-unveils-action-packed-gameplay-deep-dive)
and [the creator's PlayStation post](https://blog.playstation.com/2025/04/30/borderlands-4-revealing-vault-hunter-skills-new-planet-kairos-and-more/)
describe combining manufacturer behaviors. Use bounded, readable combinations
and tradeoffs rather than untestable combinatorial claims.

## Evidence

- 361 [core/schema/geometry tests](HOMEWORLD-MANUFACTURERS/unit-tests.txt), including legacy RNG equivalence, invalid payload rejection, saved selection, all 192 family/maker/modifier combinations and 72 attached model variants.
- 54 [targeted browser checks](HOMEWORLD-MANUFACTURERS/local.json): four combat traits, eight skills and swap-proof cooldowns, six held/world models, common ground/inventory cards, deterministic Debug controls, captured/selected homes, touch actions and saved revisit.
- 23 [existing home checks](HOMEWORLD-MANUFACTURERS/home-regression.json): peaceful/active waves, defeat rollback, decoration, terrain fault persistence, import and touch.
- 29 [weapon checks](HOMEWORLD-MANUFACTURERS/weapon-regression.json) and all four [classic boot/camera suites](HOMEWORLD-MANUFACTURERS/classic.json).
- A [complete legal expedition](HOMEWORLD-MANUFACTURERS/expedition.json), seed 12345: ten-wave victory, 20 lives, six defenses, 266 kills and extraction to planet two. This is an instrumented policy with sparse rendering, not blind play or a frame-rate measurement. The policy's weapon loop was not completed; direct manufacturer combat is covered by the targeted fixtures.
- 108 modules parse; 151 generated mirror files match source. The single-file build includes the shared card stylesheet. House style and diff checks pass. Public build verification follows publication.

## Adversarial findings and corrections

The older combat fixture spawned enemies at raw terrain height, underneath a
28m sky deck. Its purported 2m melee target was actually 28.265m away, causing
six failures. [Both current and previous live builds reproduce it](HOMEWORLD-MANUFACTURERS/fixture-baseline.json).
The fixture now uses the commander's support layer. The [initial failure](HOMEWORLD-MANUFACTURERS/weapon-fixture-initial.json)
is retained; gameplay reach was not changed to satisfy the fixture.

The first comparison focus assertion did not focus its select before changing it.
The corrected keyboard test passes. Visual inspection prompted a more compact
inventory toolbar, visible comparison colors, a readable Homeworld panel and a
Debug card above its advanced controls. A geometry check also verifies that maker
fittings stay attached to every family/era. Reach and coverage skills explicitly
adapt to shells and beams. Healing is capped to health actually removed and delayed
shots check the original owner's identity.

## Rendered review

[Homeworld](HOMEWORLD-MANUFACTURERS/homeworld.png), [touch Homeworld](HOMEWORLD-MANUFACTURERS/homeworld-touch.png),
[touch weapon card](HOMEWORLD-MANUFACTURERS/inventory-touch.png), [ground inspection](HOMEWORLD-MANUFACTURERS/loot-card.png),
[Debug foundry](HOMEWORLD-MANUFACTURERS/debug-foundry.png).

Reviewed manufacturer silhouettes, connected attachments, rarity borders, actual
model thumbnails, comparison direction, text clipping and 390px touch layouts.
Owner aesthetic/balance acceptance and physical-device feel remain open. These
checks do not establish a complete 99-planet playthrough or multiplayer behavior.

## Collaborator handoff

Identity and effects: `js/run/manufacturers.js`, `js/run/weapons.js`.
Combat application: `js/abilities.js`, `js/allies.js`. Shared model assembly:
`js/weapon-model.js`. Shared cards: `js/weapon-card.js`, `css/weapon-cards.css`.
Debug options: `js/debug-weapons.js`. Captures and selection: `js/home-planet.js`,
`js/modes/home-store.js`, `js/lobby-homes.js`. New loot rolls makers; legacy saved
items remain Worldheart originals with unchanged stats and inventory identity.
Home selection and backups preserve prior planets; a deliberately captured test
world is accessible from the normal lobby without sharing its expedition save.

