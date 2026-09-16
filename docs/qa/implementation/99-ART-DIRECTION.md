# 99 Planets modern-Earth art direction

Owner: Codex. Branch: `feature/99-planets-art-direction`. Scope: U205-U208.
Status: published and publicly verified as a first-draft review package at `ec7320d`.
Owner visual selection is pending. Usage: unmeasured.

## Request and boundaries

The owner moves the previous frontier collection into a possible medieval planet,
starts the game's real modern-Earth brand foundation, specifies five manufacturers,
assigns the accepted robot to Axiom and asks for current-model redraws and game-like
Roblox UI concepts. The collection supplements the running blueprint and current
Paintline reference. It does not change saves, campaign gameplay or production main.

The modern opening uses Apophis's real safe April 13, 2029 flyby. Orbit entry and
impact are not real predictions. Interception, alien pods and sleeper activation
are the fictional divergence. The alien glyph name is a fictional cipher for
"ayy lmao", not an authenticated Adamic translation.

## Plan and acceptance

| Work | State | Acceptance / evidence | Usage |
| --- | --- | --- | --- |
| U205 replay and source foundation | verified, bounded | Current public game was played; observations below and replay screenshots | unmeasured |
| U206 modern catalogue and medieval archive | verified locally | Nine new original plates, hashes/prompts, old originals retained; owner art acceptance pending | unmeasured |
| U207 three UI compositions | verified locally | Field/Arcade/Signal, Combat/Build/Loadout, desktop/mobile render and input checks; owner choice pending | unmeasured |
| U208 design kit and review publication | published and publicly verified | 84 public browser cases and 536 source/deployed identities; final art/UI acceptance pending | unmeasured |

## What was played

Public `https://majieddd.github.io/worldheart/`, release `6133d07`, fresh isolated
Chrome profile, real browser keyboard/pointer actions. No save or simulation state
injected. Commanders, tower foundry, mission gate and Debug World were also inspected.

- Planet-one Hearthwild expedition, Bolt placement and direct defense. First attempt
  ended naturally at wave 4, with 25 kills and score 520. Some time was unattended
  during research; this is not a tuned balance trial or full campaign evaluation.
- Retry exercised commander movement, jumping, mouse attack, V Cyclone Slash,
  Z Aegis Ward, inventory and pause. Current loadout has two equipped weapons and
  twelve backpack positions. No ammunition counter or reload system was invented.
- Inspected Bulwark, Longsight, Bolt Sentinel and the tower model lane. These source
  silhouettes informed the five-commander and six-tower redraws.

Play captures are retained under this ledger's `99-ART-DIRECTION/` evidence folder.
The long local browser recording remains in ignored `artifacts/art-direction/replay-video/`;
it is not a packaged replay or an end-to-end campaign certification.

## Visual judgment

The Earth plate puts a recognizable contemporary street behind Roblox proportions,
solid colored shadows and crisp contours. A first turret interpretation drifted
into masonry; a targeted image edit restored the actual twin-rail Bolt silhouette.
The faction sheets vary material and mechanism rather than recoloring one object.
The accepted Axiom robot keeps its broad head, binocular eyes and ochre body.

Field emphasizes a compact lower control strip, Arcade emphasizes slot ownership,
Signal uses a quieter orbit indicator and pale loadout. All three protect the
center of the game image. Actual rendered desktop and mobile states were inspected;
these are real HTML compositions over a shared illustration, not screenshots of a
new playable 3D Earth level. Image/source identities and generation prompts are
saved in `lib/99-art/catalogue.json`. The backing image model was not exposed.

One webpage per subject is addressed through a dedicated `?page=` URL. The shell
has a quiet navigation column, large artwork and short functional copy. It avoids
the earlier slogan-heavy hero and mixed-subject presentation.

## Failures retained and corrected

- Initial draft probe hit a strict-selector collision with the scene's `data-mode`.
  The probe now scopes that locator to actual buttons; no product failure was hidden.
- Draft run 2: 41/42 checks passed; the remaining console error was an absent favicon.
  All three drafts now declare an empty favicon.
- Visible and keyboard ability mappings in initial drafts reversed Z/V. Corrected
  to Z ward, V slash and checked through actual key input.
- Field kept an old equip confirmation after changing faction sample. It now resets
  the help text with the sample selection.
- Initial blueprint check found the missing Decided table and no mechanic blocks.
  The foundation now includes explicit six-field mechanics and status/evidence rows.

## Shared tooling and collaborator safety

Canonical runner: `tools/qa-painted-lab.mjs --99-art`, with one added probe module.
No new recurring QA launcher. Use `--99-drafts --save-ui-previews` to recapture the
three browser composition thumbnails after actual layout changes. Generated art
originals are separate from these derived UI screenshots.

The installed Aegis was refreshed by another contributor during this turn. The
current verified manifest is `3.18.3+codex.20260916153720`; its Huashu, blueprint
and content-feedback guidance were reread. The original content batch predates
its new preparation-ticket helpers, so no preparation receipts are fabricated.
The saved catalogue identifies actual inputs, prompts and output bytes. Current
content-feedback guidance recommends append-only comments for active trackers;
that matches this work's tracker updates. No collaborator plugin files were replaced.

Huashu requires showing three real first drafts and ending the turn for the owner's
selection. This package stops at that review boundary. No `direction-approved.md`
exists because the owner has not chosen a new UI composition.

The shared preview advanced to `f22e3b2` while this collection was built. It was
merged at `5ba9c2e`, preserving both the `--guided-game` and `--99-art` probes.
Generated single-file builds were rebuilt from the integrated sources. Game
modules, index and existing game CSS remain identical to that collaborator snapshot.

## Integrated local acceptance

- `local-browser.json`: **84/84** cases pass. Includes all three desktop/mobile
  compositions, actual keyboard abilities, explicit equipment swaps, all thirteen
  topic routes, original downloads, history, Axiom WebGL and six archived originals.
- `tests.txt`: **393/393** automated tests pass, including the extended Pages
  fixture which publishes this review route and excludes unrelated draft directories.
- `syntax.txt`: **142/142** modules parse. All three inline draft scripts were
  also parsed and exercised in the browser.
- `style.txt`: clean. `blueprint.txt`: **14/14** sections, **6/6** mechanic blocks,
  **5/5** decision rows, no failures or warnings.
- **293** source/V2 files mirror correctly after integration.
- Actual desktop combat/build/loadout and narrow-screen captures were reviewed.
  Selected durable captures live beside this ledger; the three combat previews
  are also served in `lib/99-art/ui-*.webp`.

These results support the review package. They do not certify final taste,
new-mesh animation quality, a new playable Earth environment or a Roblox port.

## Reproduction

```text
node tools/serve.mjs 8157
WH_NODE_MODULES=<runtime node_modules> WH_BASE_URL=http://127.0.0.1:8157
node tools/qa-painted-lab.mjs artifacts/art-direction/final --99-art
node tools/syntax.mjs
node tools/test.mjs
node tools/style.mjs
node tools/deploy.mjs
```

## Publication receipt

- Runtime checkpoint: `ec7320d29c5d526844be9f56e586b32282801f8e`.
- [Pages run 35118313459](https://github.com/majieddd/worldheart/actions/runs/35118313459): successful.
- [Draft PR #60](https://github.com/majieddd/worldheart/pull/60), based on the
  collaborator's guided terrain branch to keep the review scoped.
- [Public collection](https://majieddd.github.io/worldheart/v2/99-art.html).
- [UI comparison](https://majieddd.github.io/worldheart/v2/99-art.html?page=ui).
- `public-browser.json`: **84/84** public checks pass with no runtime/resource errors.
- `public-identity.json`: **536/536** live/source identities pass, including
  unchanged main `6133d07`. All nine new originals and six older originals verify.

After publication, collaborator receipt commit `e527859` was merged as `8a2d67b`.
Its public terrain evidence and corrected inspection wait are preserved. This
follow-up changes documentation and QA only; published user-facing runtime files
remain byte-identical to `ec7320d`. The shared preview is not rewritten for receipts.

Next action belongs to the owner: choose Field, Arcade or Signal (or a specific
combination) before developing the final composition. Asset and brand acceptance
remains separate from machine checks. Future production meshes and the Roblox port
are explicitly not claimed by this concept package.
