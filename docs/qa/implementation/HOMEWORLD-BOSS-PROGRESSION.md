# Homeworld boss progression

Owner: Codex. Branch: `feature/homeworld-boss-progression`, based on preview
`307f2a6`. Status: implemented and locally verified; publication pending. Existing art studies and selected Hard Cel are preserved.

| Item | Work | Acceptance |
| --- | --- | --- |
| U168 | Earth unlocked by default; direct third-person home entry, clear fog, visible wave control | Fresh and existing saves, lobby visit, desktop/touch runtime |
| U169 | Maximum base schedules a stronger planet boss with minions; defeat unlocks home and stops waves | No early claim, current-wave scaling, actual boss/minions and completion |
| U170 | Endless homes: checkpoints every 10 waves, retained gear on death, rare drop ceiling | Boundary rollback, gear/identity persistence, rarity sampling |
| U171 | Close minimum zoom at maximum base; reduce hail shake | Camera suite, bounded hail shake fixture, classic regression |

The targeted progression, fog, zoom and hail checks pass. All 23 backup/terrain/touch regressions and the single-file home boot also pass. Public verification is pending. Main remains unchanged. This work does not
close the open audio acceptance items U150/U151.


## Behavior and compatibility

- Every healthy home catalogue includes Earth without needing to write storage.
  Existing selection and imported selections are preserved. Capacity is 100:
  starter Earth plus the 99 expedition captures. Earth uses certified seed-12345
  anchors from the real generator, avoiding a repeated starter-site search.
- Full expansion schedules the next actual director wave as the sovereign. The
  current wave health curve and planet difficulty still apply, with 2.25x boss HP
  and 1.35x boss attack. It summons three minions every 12 seconds as well as its
  existing armor-break escorts. All emerge from physical nests and inherit wave
  ancestry. Quake-disrupted queued sovereign nests relocate rather than cancelling
  the required boss. A sovereign leaking into the heart is defeat, not capture.
- Killing the sovereign disperses its escorts and unlocks the peaceful home.
  Recapturing an already saved identical world preserves its earlier defenses.
- Home entry skips mode selection, starts beside the crystal in third person,
  and disables both the discovery veil and old cloud-deck mask. Visible Start
  waves / Stop after wave controls work in desktop and touch layouts.
- Peaceful resumes and defense checkpoints are separate. The capture is the
  initial defense checkpoint; cleared multiples of ten advance it. Commander
  or heart defeat rolls back defenses and resources to it, while preserving the
  current equipped/bag weapons, scraps, forge count and loot RNG/sequence.
  Previous ground drops are cleared so reclaimed/salvaged drops cannot duplicate.
  Higher rarity carried equipment is retained; newly dropped home weapons cap
  at Rare. Home drafts auto-resolve after 10 seconds for unattended defense.
- Storage refusal prevents the automatic death reload; retry and exported backup
  retain the recovery inventory. Existing homes remain valid without migration.
- Minimum orbit distance stays at the opening close framing (6 units with default
  settings) while maximum zoom still frames the whole planet at maximum base.
- Continuous weather damage adds at most one 0.08 trauma pulse per 0.65 seconds,
  rather than a full melee jolt every frame. Melee feedback is unchanged.

## Evidence and corrections

These are instrumented fixtures, not natural boss balance acceptance:

- [Home progression](HOMEWORLD-BOSS-PROGRESSION/home-local.json): Earth arrival,
  waves 1/10/11, commander and heart death, retained relic equipment, 110 actual
  enemy drops capped at Rare, and hail. Six seconds of exposed hail produced
  nine 0.08 pulses rather than 360 repeated hit jolts.
- [Sovereign encounter](HOMEWORLD-BOSS-PROGRESSION/conquest-local.json): wave 23,
  actual health scale 8.04375, protected physical nest, quake-path nest destruction
  and replacement, three summoned minions, boss-only victory, catalogue capture,
  quiet world and immediate optional restart on wave 24. Resources, earlier-wave
  state and lethal damage are explicit fixtures.
- [Camera/touch](HOMEWORLD-BOSS-PROGRESSION/camera-touch-local.json),
  [14 camera checks](HOMEWORLD-BOSS-PROGRESSION/camera.json),
  [four classic maps](HOMEWORLD-BOSS-PROGRESSION/classic.json).
- [23 home regressions](HOMEWORLD-BOSS-PROGRESSION/home-regression.json) cover
  decoration, saved tower upgrades, actual earthquake/reload, backup import and
  real touch controls. [Single-file boot](HOMEWORLD-BOSS-PROGRESSION/bundle.json)
  enters Earth in third person with styled controls and no runtime exceptions.
- [369 tests](HOMEWORLD-BOSS-PROGRESSION/unit-tests.txt), 117 parsed modules and
  195 generated mirrors. [Legal campaign](HOMEWORLD-BOSS-PROGRESSION/run.json)
  completed ten waves with 20 lives, six towers, 266 kills and six extracted
  weapons. Accelerated sparse rendering is not device-performance evidence.

The first input fixture tried clicking a HUD control after a draft had reclaimed
pointer lock; explicit pointer release fixed it. The first maximum-base camera
check treated the existing globe-centre transition as unwanted ground drift.
The checker now verifies ground lock before overview and globe centering at the
far endpoint, and strictly checks convergence to both zoom limits. Its original
failure remains in the home report. Older home regression also needed a longer
navigation timeout and a real input gesture to start music now that Begin is
skipped; initial reports are retained separately.

[Earth arrival](HOMEWORLD-BOSS-PROGRESSION/earth-arrival.png),
[touch controls](HOMEWORLD-BOSS-PROGRESSION/home-touch.png),
[sovereign](HOMEWORLD-BOSS-PROGRESSION/sovereign.png).
Rendered review checked clear surroundings, the commander beside the crystal,
48px touch targets and action-button separation. Physical-device feel, sovereign
balance and a full 99-planet playthrough remain separate acceptance work.

## Handoff

Run `node artifacts/cosmic-landforms/run.mjs tools/qa-home-boss.mjs artifacts/home-boss/final`.
Use `WH_BASE_URL` for the public V2 origin. `--conquest-only` isolates the boss;
`--home-only --from-camera` isolates entry, zoom and touch. Existing
`tools/qa-home-planet.mjs` retains backup, quake and decoration regression coverage.
No audio assets or selected art-candidate files changed.
