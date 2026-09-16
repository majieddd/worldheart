# 99 Planets To Defend

Modern Earth art and game-design foundation, revision 0.2.0. B / Arcade composition selected. Expanded faction art remains under owner review.

The [six-faction supplement](factions/foundation.md) and [90-concept catalogue](factions/catalogue.json) record the current roster, all six weapon families, active powers, five-step profiles and terrain visions. Earlier plates remain preserved as first studies.
Prepared 2026-09-16 from the current public Worldheart game and owner direction.

This is an additive visual/narrative companion to the running game blueprint at
`docs/99-PLANETS-TO-DEFEND.md`. It does not replace campaign mechanics or imply
that new illustrations are already production meshes. Each subject has a page
in `99-art.html`. Three interactive UI compositions await owner selection.

## Reference

- Current browser game: https://majieddd.github.io/worldheart/
- Binding scene direction: Paintline column at https://majieddd.github.io/worldheart-styles/
- Binding object direction: Inked Cel posters and models at the same site.
- Accepted 3D surface foundation: Atmospheric Ink 1.3.1. Vivid Paint remains the
  owner's revised demo default. The original 1.3.1 archive remains immutable.
- New working title: **99 Planets To Defend**. This collection uses the new name;
  changing campaign branding everywhere is a later integration decision.
- Development sequence: use the browser for efficient staging today; port confirmed checkpoints to Roblox. Shift development to Roblox when it becomes the more efficient build-and-validation environment.

Current-game observation: commander lobby, tower foundry, mission gate, a live
planet-one defense attempt ending at wave four, a second direct-control attempt,
equipment inspection and Debug World model inspection. This was a bounded replay,
not a complete campaign or balance evaluation. No gameplay state was injected.

## Pillars

1. **A place worth defending.** Familiar modern Earth makes the initial invasion
   tangible. Each later planet should have a memorable ecology and defensible place.
2. **Protect, venture, return.** Leaving the Worldheart offers useful equipment and
   resources while exposing the base. At campaign scale, protect and claim a planet, venture to new planets, then return home to store loot or establish the new planet as home.
3. **Scenario gives a planet context.** Terrain, native inhabitants and the active conflict explain who the player encounters. A RainBOOM-native garden and an Axiom settlement invaded by anomalies have different reasons to defend and explore.
4. **Seriously Funny Vibes.** A semi-serious invasion story coexists with goofy Roblox characters. Their equipment, personalities and reactions supply humor without erasing the stakes.
5. **Responsive actions.** Input, animation and impact should explain the same event.
   A swing cannot connect before its visible blade reaches the target.

## Core loop

Prepare a commander and deliberately equip two weapons. Enter an expedition,
establish defenses around the Worldheart, fight directly, collect useful gear and
crystals, then return to strengthen the base. Complete the expedition and pursue
the homeworld/progression loop: protect and claim, venture to the next planet, return to store loot or make the captured planet the new home. The browser campaign currently uses ten
waves per expedition. This art pass does not rebalance its economy or difficulty.

Three UI states express the loop: Combat protects the sightline; Build explains
placement, coverage and cost; Loadout explains role, manufacturer and equipment
changes. Switching context changes information priority rather than stacking menus.

## Kit and asset vocabulary

### Owner-defined manufacturers

| Faction / maker | Identity | Surface and form grammar | Proposed feedback |
| --- | --- | --- | --- |
| Xeno | Original invading species | Element-colored chitin and ivory hooked brow; brown Physical, purple Void, blue Frost, orange Fire, green Poison | Heavy contact for Physical, clear teleport apertures for Void, bounded element effects |
| Brainshot | Brainrot-inspired | Shark/sneaker carbine, banana blade, espresso staff; enamel, screws, rubber | One clear object-related action per weapon, such as steam from the coffee emitter |
| RainBOOM | Rainbow Friends-inspired | Cobalt shell, crown antenna, button-eye gauges, separate pigment chambers | Bold colored impact fragments and short trails |
| Anomalous | Animal Hospital crossover | Animal silhouettes, unsettling faces, mint clinical enamel and one impossible detail | Clearly different dormant, arming and triggered states |
| Axiom | Neutral autonomous robots | Pristine white ceramic, graphite articulation, paired cyan optics and balanced forms | Symmetrical closures and measured corrective pulses |
| Robloxian | Classic Roblox | Yellow plastic, blue studded receivers, green molded bases and practical construction parts | Crisp brick-shaped impacts and readable snap-together effects |

The Xeno maker mark encodes **ayy lmao** in a complete original A-Z glyph cipher.
The five existing shapes are preserved; the other 21 are proposals. Each glyph has
a Latin key and a fictional reading. This is an alphabet, not a complete grammar.
Repeated letters repeat the same glyph. The Adamic-language premise is inspiration,
not a claim of an authenticated historical translation. Anomalous now draws on the
owner's Animal Hospital reference. The weapon and character
sheets are proposed crossover-inspired designs, not official franchise assets.

The expanded faction pages cover twin daggers, sword, spear, rifle, ember scepter
and lobber, plus three commanders, three units and three towers per faction.
Descriptive labels are working names; the owner retains weapon naming.
The previously accepted broad-headed, binocular-eyed robot belongs to **Axiom**.

### Existing identity carried into the redraw

- Bulwark: broad protective mass and a heavy sword.
- Twinfang: fast dual-blade stance and lighter shoulder mass.
- Longsight: precise ranged silhouette and shouldered carbine.
- Kettle: heavy equipment, stable stance and lobbed area fire.
- Emberline: energy containment, sustained heat and staff-like equipment.
- Bolt Sentinel: box gunhead, two short rails, pivot and four stabilizers.
- Cryo Bloom: cooling petals and a slowing field.
- Mortar Bastion: recoil cradle and an unmistakable lobber aperture.
- Arc Spire: separated coils and readable chain discharge.
- Helios Lance: focusing tube and sustained beam path.
- Warden Barracks: deployable shelter with a visible unit exit.

The hooked brow and layered chitin establish the Xeno species. Brown Physical forms are slow, strong and enduring Martian meteor dwellers. Purple Void forms are physically fragile, element-resistant teleport scouts that arrive first. Frost, Fire and Poison forms add proposed control, burst and denial roles. Completing the existing Mite/Husk/Aegis/Wisp/Colossus roster needs
separate production specifications after the family direction is approved.

## Concept and visual baseline

The preserved first collection contains nine original concept plates: modern Earth, four-panel opening storyboard,
five commanders, six tower families and five faction/equipment sheets. PNG originals,
full-resolution WebP previews, generation prompts and SHA-256 identities are saved
in `lib/99-art/catalogue.json`. The generator did not expose a backing model identity.

Current direction: **Painted-Anime-Inkline**, joining Studio Ghibli-like whimsical painted worlds with Borderlands-like darker comic realism and grit. Eight new built-in paintings under painted-anime-inkline/ cover five environments, an updated six-panel opening, five elemental Xeno and their six-character roster. media.json joins all 59 illustrations, references and UI captures. The exact backing generation model is not exposed; these are not certified model-identity receipts.

**Paint recipe:** strong outer contour, finer broken interior marks, broad painted
local color, deep colored cel shadows, selective chips at exposed edges and contact
points. Surface texture follows the object. No screen-space texture swimming. No
line-filled crosshatching in 3D shadows. Do not age the whole image with sepia grain.

Use Roblox-compatible block proportions and readable joints. Preserve open space
around elbows, knees, hands and weapon grips. A poster is an asset target, not proof
of retopology, skinning, grip correctness, UV quality or mobile performance.

Close-up weapons need an independent texture-density review. Test a held rifle at
normal and aimed distance, checking mip selection, UV stretching and contour overlap.
World props must also read at combat distance without relying on scratches for identity.

The prior frontier artboard is now the **medieval-planet archive**. Its six original
PNGs and prompts stay intact. Its old manufacturer names do not define this new kit.

## Mechanics

These contracts distinguish existing game behavior from proposed visual treatment.

### Commander combat

**Purpose:** let direct player action support the defenses.
**Experience:** clear threat, responsive movement and contact-aligned feedback.
**Inputs:** existing movement/attack controls, Z for Aegis Ward, V for Cyclone Slash.
**Outputs:** the existing simulation owns health, damage and cooldowns; the concept shows their presentation.
**Edge cases:** overlapping effects, interrupted attacks, long maker labels and camera occlusion.
**Failure:** a unavailable ability remains visibly unavailable; this UI study never pretends to apply damage.

### Tower placement

**Purpose:** convert resources and defensible ground into protection.
**Experience:** inspect the footprint, coverage and cost before committing.
**Inputs:** Build state, selected tower, ground position and current-game validation.
**Outputs:** valid placement spends the existing cost and creates a tower in the game; draft controls only preview the interface.
**Edge cases:** terrain boundary, overlapping footprints, insufficient resources and changing selection mid-placement.
**Failure:** explain invalid placement without spending resources; the art page writes no simulation state.

### Equipment

**Purpose:** let gear support a deliberate combat choice.
**Experience:** compare role and manufacturer, then explicitly equip a chosen slot.
**Inputs:** two equipped slots, twelve backpack positions in the observed game, inspected weapon and Equip action.
**Outputs:** the chosen weapon enters the selected slot; the displaced item returns to storage.
**Edge cases:** full backpack, repeated pickup and switching which sample manufacturer is being inspected.
**Failure:** full-bag drops remain on the ground; nearby collection never silently changes the held weapon.

### Crystal delivery

**Purpose:** make leaving and returning to the Worldheart useful.
**Experience:** readable cargo capacity and a clear reason to return.
**Inputs:** existing collection proximity, cargo count and deposit conditions.
**Outputs:** retain the current deposit rules; the draft displays capacity and destination.
**Edge cases:** full cargo, empty deposit attempt and effects hiding the Worldheart.
**Failure:** an empty delivery changes nothing and gives brief, quiet feedback.

### Conditional faction effect

**Purpose:** make Anomalous equipment reward an identifiable circumstance.
**Experience:** see dormant, armed and triggered states before making a decision.
**Inputs:** a future owner-approved gameplay trigger; draft example conditions are explicitly speculative.
**Outputs:** the proposed effect transitions through arming, activation and recovery with shape and lamp cues.
**Edge cases:** repeated events, an event during recovery, switching weapons and invalid targets.
**Failure:** no false activation; exact trigger and tuning must be settled before implementing this mechanic.

### Planet progression

**Purpose:** connect expeditions to persistent travel and homeworld development.
**Experience:** understand the current destination, result and next available action.
**Inputs:** existing expedition completion and homeworld actions.
**Outputs:** the existing progression/save system remains authoritative.
**Edge cases:** old saves, revisited worlds and visual prototype routes opened beside the live game.
**Failure:** a concept route cannot modify a campaign save or block return to the game.

## Numbers and tuning

Observed examples used to stage the concepts: wave 4/10, Bulwark maximum health 1400,
Worldheart health 20, Bolt Sentinel cost 150 and crystal display 0/3. These are UI
examples, not new balance targets. Draft build markers have no gameplay authority.

No new manufacturer damage multipliers, rarity curves, prices or conditional triggers
are approved by this document. Preserve family function before tuning differentiators.

Animation timing, polygon count, texture budgets and effect count must be measured
on the target Roblox/device profile. Do not advertise an unmeasured universal FPS budget.

## Content and planets

The first setting is contemporary Earth, April 13, 2029. Familiar architecture,
traffic signals, utility lines and everyday clothing establish reality before invasion.

**Fact:** Apophis will make a safe close flyby on Friday, April 13, 2029. It is not
predicted to enter Earth orbit or strike Earth. NASA describes the safe encounter:
https://science.nasa.gov/solar-system/asteroids/apophis-facts/

**Fiction:** humanity attempts to intercept the approaching object; its shell breaks;
brown Physical Xeno are revealed inside the meteor. Purple Void scouts teleport onto Earth first; a sleeper agent receives activation. The storyboard's large
object and visible trail are cinematic devices, not an astronomical reconstruction.

Opening beats: expected flyby → fictional interception → brown meteor inhabitants revealed → purple scouts teleport onto Earth → private activation signal → first defense. Brown Xeno are canonically Martian; Void scouts use a separate teleportation system. Keep the stakes sincere and the crossover characters funny.

Later planets can vary tone and architecture. The prior medieval collection is retained
for that possibility; no planet index or story placement has been assigned to it.

## Interface and HUD

The original three UI drafts shared one Earth image. Selected B now uses the purple-scout arrival, with its approved framing preserved:

- **Field:** compact field controls, ivory/amber labels, separate equipment column.
- **Arcade B, selected:** tactile rounded controls and strong ownership of the two weapon slots. Planet/date block removed; six current faction arsenals supported.
- **Signal:** quieter framing, orbital Worldheart indicator, lighter loadout screen.

Each supports Combat, Build and Loadout. Refined B includes all six faction arsenals; A, C and original B remain comparisons.
The background is an illustration, not a real-time scene. Review UI and staged numbers
are labeled outside the game image. The actual game is linked separately.

Keep enemies, floor geometry, placement and crosshair clear. Use visible labels and
shape with color. Never use faction color as the sole rarity or danger indicator.
No ammo counter is added because the current game does not use one. Selected UI must
later be tested with motion, camera rotation, effects, long labels and touch input.

Working brand palette: ink #20282c, warm white #eeeee9, Worldheart mint #84e5d1,
impact orange #d9582a, Axiom ceramic white and cyan #acdcd9. Barlow Condensed Bold carries short labels
and strong numbers; Barlow Regular/SemiBold carries reading. Fonts and OFL licenses
are saved locally. The title treatment is a draft, not an approved final logo.

## Build order and milestones

1. B / Arcade is selected. Review the new environmental references, Xeno concepts and narrative corrections.
2. Develop that composition with actual combat/build/loadout states and representative motion.
3. Produce one modern commander, one held weapon, one turret and one native invader
   using the approved plates. Preserve named identities and attachment rules.
4. Verify their full movement/attack cycles, source textures, held distance and effects.
5. Integrate a bounded browser slice with the existing game, without replacing progression.
6. Author a Roblox adapter: character rig/attachments, materials, input, UI safe areas,
   effect budgets and simulation boundaries. Validate on the chosen devices.

The Axiom runtime reference remains available now. New concept redraws are not yet
new GLBs or Roblox models; the mesh-production step follows visual acceptance.

## Verification

- Replayed current public game and inspected its Debug World assets.
- Check every page, asset original identity, full-size view and PNG download.
- Exercise each draft's modes, factions, ability key labels and equipment controls.
- Capture 1440px desktop and 390px narrow layouts; inspect actual screenshots.
- Verify Axiom embedded reference is a real loaded WebGL scene.
- Preserve the six prior PNG identities and locked Atmospheric Ink archive.
- Distinguish browser rendering checks from subjective art approval and actual playability.
- Before publication, verify deploy allowlists and source/V2 mirror; after publication,
  verify public routes, browser behavior and exact bytes. Keep failed checks in the ledger.

## Decided

Owner decisions: new title, modern Earth opening, six factions, Xeno elemental lineages and Void-first invasion; Axiom pristine white robotics; B UI composition; Painted-Anime-Inkline style name and Ghibli/Borderlands direction; no hatched 3D shadows; medieval archive; efficient browser staging and Roblox ports at confirmed checkpoints.

Pending owner decisions: refined B surface treatment, expanded faction concepts, new glyph shapes and fictional readings, final weapon names,
faction trigger tuning, character costume refinements, final logo and production meshes.

| Decision | Status | Evidence |
| --- | --- | --- |
| Modern Earth visual foundation | partial | Nine saved plates in catalogue.json and rendered collection; owner art review pending |
| Six factions and Axiom robot assignment | partial | Six expanded pages with 24 plates and 90 concepts; actual original robot reference retained; campaign integration not yet |
| Selected B / Arcade composition | partial | Owner selected B on 2026-09-16; refined controls and 203 browser checks; not integrated into campaign |
| Medieval study preserved | partial | Six original PNG hashes retained and archive link; no medieval planet added to campaign |
| Roblox port | not yet | Browser concept and asset acceptance precede the production adapter |

## Task list

U217-U220: unified navigation and Media; eight style/canon references; Xeno name, elements and alphabet; browser verification and V2 publication. Usage unmeasured. No elemental gameplay or Roblox port is claimed.

U205: replay and source/fiction foundation. U206: modern concept catalogue and archive.
U207: three rendered interactive UI drafts. U208: durable design kit, browser evidence,
collaborator handoff and V2 review publication. Main game replacement is out of scope.

## Where we are

Current owner revision: one five-tab artbook at 99-art.html. The faction data and original prompts stay durable; old page links resolve to the new tabs. The scenario and maker identity should explain both the appearance and proposed behavior. Development uses whichever environment validates the next change most efficiently without sacrificing quality.

2026-09-16: This collection is a concrete first-draft review package. Approving an image does not
automatically approve gameplay tuning, UI composition or a 3D implementation. Collaborators
should add scoped refinements, preserving the chosen baselines and other active work.


## Character identity supplement, 2026-09-16

The identity-v2 roster is the current Anomalous and Brainshot appearance guide.
Keep iconic anatomy, face, palette and props; our rendering treatment supplies
paint and ink without replacing character identity. The Xeno include distinct
grunt, Gray and Reptilian races; element and role are independent.
See [the production guide](identity-v2/production-guide.md) for ComfyUI/Krea 2,
Higgsfield and Blender instructions, method status and preserved receipts.
Arcade B now demonstrates third-person placement and F/G powers, with preview
mode controls outside the game frame. It remains a concept visualization.
