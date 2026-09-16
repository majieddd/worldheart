# 99 Planets To Defend

Modern Earth art and game-design foundation, revision 0.1.0. Owner review pending.
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
- Platform sequence: browser proof first, Roblox production port after approval.

Current-game observation: commander lobby, tower foundry, mission gate, a live
planet-one defense attempt ending at wave four, a second direct-control attempt,
equipment inspection and Debug World model inspection. This was a bounded replay,
not a complete campaign or balance evaluation. No gameplay state was injected.

## Pillars

1. **A place worth defending.** Familiar modern Earth makes the initial invasion
   tangible. Each later planet should have a memorable ecology and defensible place.
2. **Protect, venture, return.** Leaving the Worldheart offers useful equipment and
   resources while exposing the base. Building and direct combat support each other.
3. **Readable crossover identity.** Shared proportions, contour and shadow rules
   unify factions. Their silhouettes, materials and feedback remain distinct.
4. **Sincere stakes, strange tools.** The invasion matters. Humor comes from equipment,
   character reactions and timing, without making danger incomprehensible.
5. **Responsive actions.** Input, animation and impact should explain the same event.
   A swing cannot connect before its visible blade reaches the target.

## Core loop

Prepare a commander and deliberately equip two weapons. Enter an expedition,
establish defenses around the Worldheart, fight directly, collect useful gear and
crystals, then return to strengthen the base. Complete the expedition and pursue
the existing homeworld/progression loop. The browser campaign currently uses ten
waves per expedition. This art pass does not rebalance its economy or difficulty.

Three UI states express the loop: Combat protects the sightline; Build explains
placement, coverage and cost; Loadout explains role, manufacturer and equipment
changes. Switching context changes information priority rather than stacking menus.

## Kit and asset vocabulary

### Owner-defined manufacturers

| Faction / maker | Identity | Surface and form grammar | Proposed feedback |
| --- | --- | --- | --- |
| Alien glyph name | Native invading enemy | Rust chitin, ivory hooked brow, lime capillary channels; grown mechanisms | Contained pulses followed by sharp discharges |
| Brainshot | Brainrot-inspired | Shark/sneaker carbine, banana blade, espresso staff; enamel, screws, rubber | One clear object-related action per weapon, such as steam from the coffee emitter |
| RainBOOM | Rainbow Friends-inspired | Cobalt shell, crown antenna, button-eye gauges, separate pigment chambers | Bold colored impact fragments and short trails |
| Anomalous | Anomaly-inspired | Smoked glass cages, displaced ivory plates, amber witness lamps | Clearly different dormant, arming and triggered states |
| Axiom | Neutral autonomous robots | Ochre ceramic, graphite spine, paired teal lamps and balanced forms | Symmetrical closures and measured corrective pulses |

The alien identity is an original fictional five-glyph cipher encoding **ayy lmao**.
Repeated letters repeat the same glyph. The Adamic-language premise is inspiration,
not a claim of an authenticated historical translation. Anomalous has no particular
franchise assigned beyond the owner's stated anomaly theme. The weapon and character
sheets are proposed crossover-inspired designs, not official franchise assets.

Each faction sheet contains a ranged plasma family, a sword and a thermal/ember
staff family. Descriptive labels are placeholders; the owner retains weapon naming.
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

The heavy native invader, low skitterer and meteor nest establish the first enemy
shape family. Completing the existing Mite/Husk/Aegis/Wisp/Colossus roster needs
separate production specifications after the family direction is approved.

## Concept and visual baseline

Nine new original concept plates: modern Earth, four-panel opening storyboard,
five commanders, six tower families and five faction/equipment sheets. PNG originals,
full-resolution WebP previews, generation prompts and SHA-256 identities are saved
in `lib/99-art/catalogue.json`. The generator did not expose a backing model identity.

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
alien pods rain down; a sleeper agent receives activation. The storyboard's large
object and visible trail are cinematic devices, not an astronomical reconstruction.

Opening beats: expected flyby → fictional interception → pods unfolding over ordinary
streets → private activation signal → control handed to the player. Keep the first
threat sincere. Let a small human reaction or absurd tool introduce the comic register.

Later planets can vary tone and architecture. The prior medieval collection is retained
for that possibility; no planet index or story placement has been assigned to it.

## Interface and HUD

Three first drafts share the same illustrated Earth scene so composition can be compared:

- **Field:** compact field controls, ivory/amber labels, separate equipment column.
- **Arcade:** square, tactile controls and strong ownership of the two weapon slots.
- **Signal:** quieter framing, orbital Worldheart indicator, lighter loadout screen.

Each supports Combat, Build and Loadout. All five faction sheets can be inspected.
The background is an illustration, not a real-time scene. Review UI and staged numbers
are labeled outside the game image. The actual game is linked separately.

Keep enemies, floor geometry, placement and crosshair clear. Use visible labels and
shape with color. Never use faction color as the sole rarity or danger indicator.
No ammo counter is added because the current game does not use one. Selected UI must
later be tested with motion, camera rotation, effects, long labels and touch input.

Working brand palette: ink #20282c, warm white #eeeee9, Worldheart mint #84e5d1,
impact orange #d9582a, Axiom ochre #d1ab54. Barlow Condensed Bold carries short labels
and strong numbers; Barlow Regular/SemiBold carries reading. Fonts and OFL licenses
are saved locally. The title treatment is a draft, not an approved final logo.

## Build order and milestones

1. Owner selects the preferred UI composition and gives art/narrative corrections.
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

Owner decisions: new title, modern Earth opening, five faction identities, accepted
robot assigned to Axiom, Paintline/Ink Cel inspiration, no hatched 3D shadows,
previous medieval direction preserved for later, browser before Roblox.

Pending owner decisions: UI composition, final alien glyph shape, final weapon names,
faction trigger tuning, character costume refinements, final logo and production meshes.

| Decision | Status | Evidence |
| --- | --- | --- |
| Modern Earth visual foundation | partial | Nine saved plates in catalogue.json and rendered collection; owner art review pending |
| Five factions and Axiom robot assignment | partial | Five dedicated concept pages plus actual Axiom runtime reference; campaign integration not yet |
| Three different UI compositions | partial | Field, Arcade and Signal desktop/mobile screenshots; final composition not selected |
| Medieval study preserved | partial | Six original PNG hashes retained and archive link; no medieval planet added to campaign |
| Roblox port | not yet | Browser concept and asset acceptance precede the production adapter |

## Task list

U205: replay and source/fiction foundation. U206: modern concept catalogue and archive.
U207: three rendered interactive UI drafts. U208: durable design kit, browser evidence,
collaborator handoff and V2 review publication. Main game replacement is out of scope.

## Where we are

2026-09-16: This collection is a concrete first-draft review package. Approving an image does not
automatically approve gameplay tuning, UI composition or a 3D implementation. Collaborators
should add scoped refinements, preserving the chosen baselines and other active work.
