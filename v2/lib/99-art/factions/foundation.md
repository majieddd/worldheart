# 99 Planets To Defend: faction expansion

This supplements the earlier design foundation. The owner selected B / Arcade and requested six faction catalogues in Painted-Anime-Inkline. The earlier sheets and original B remain available as historical comparisons.

## Content contract

Each faction has three commanders, three regular units, six weapons, three towers and a homeworld. The six weapon families match the current game's family identifiers: twinblade, sword, spear, carbine, scepter and lobber. Every commander and weapon has a named active, a legible icon, an activation window, a visual cue and a stated limitation.

The catalogue contains 90 asset concepts and 54 actives. The 24 retained review plates are generated illustrations, not new meshes or implemented abilities. Existing gameplay and its accepted Atmospheric Ink rendering recipe remain the browser proof for a later Roblox port.

## Factions

- RainBOOM: Blue, Green and Orange remain recognizable Rainbow Friends characters. Original helper units and pigment machinery extend their world.
- Axiom: Custodian, Vector and Mender are original neutral automata. Pristine white ceramic, smoked glass and graphite joints replace the first study's ochre. Paired optics preserve a family resemblance to the accepted robot.
- Anomalous: Barney, Stalker and Dr. Harlow draw from Animal Hospital. Dr. Harlow's anomaly status is uncertain in the source; his support role here is explicitly a crossover interpretation. Clinical objects with one unsettling detail replace the earlier abstract glitch hardware.
- Brainshot: Tralalero Tralala, Ballerina Cappuccina and Tung Tung Tung Sahur are recognizable character concepts. Their game roles are new proposals. The visual references do not imply current availability in every source game.
- Robloxian: Noob, Guest and classic Builderman anchor the faction. Builderman uses the older construction avatar, not the current account outfit. Brickguard, Builder crew and Bacon runner supply normal unit roles.
- Xeno: Herald and Broodwarden belong to the brown Physical Martian lineage. Riftwalker and Skitter are purple Void scouts; Shellback is Physical and Sporeeye is a proposed Poison support unit. The current roster is a new built-in painting. The complete fictional A-Z cipher retains the maker mark ayy lmao.

Mars is the owner-defined habitat of brown Physical Xeno; purple Void scouts teleport onto Earth first. Other homeworlds and abilities are this parallel universe's proposals. Original equipment names remain working names for the owner to revise.

## Balance language

Bars are ordinal comparison targets from minimal to very high, not damage, hit points or cooldown seconds. Compare within one category. Most commander power, movement speed and health profiles share a ten-point internal drafting budget; units use nine. Riftwalker explicitly falls below that physical budget because the owner defines Void as physically weak with strong elemental resistance and teleportation. Weapon power, handling speed and reach share ten. Tower power, firing/activation speed and health share ten. Complexity measures handling demand and is excluded from strength budgets.

These budgets prevent a simple across-the-board stronger draft. They do not price healing, control, summons, area damage, range geometry, uptime or movement immunity. Each active therefore also has an explicit tell, condition and counterplay limitation. Testing those dimensions in a playable slice is required before tuning can be called balanced. No balance outcome is claimed from illustrations.

## Surface and effect contract

Retain bold outer contours, finer internal ink, broad colored shadows and painted local color. Wear follows contact surfaces. Avoid a screen-space texture overlay and hatched shadow fill. Axiom deliberately has cleaner surfaces than the other factions. Faction effects use short, crisp silhouettes and clear activation states rather than large bloom clouds.

The selected B interface keeps the center clear, Worldheart at upper right, wave at upper center, commander at lower left, equipment below center and powers at lower right. The planet/date block is removed. Moderate corner radii, heavy outlined edges, raised controls and semantic icons add a Roblox-like feel while keeping restrained colors and mature typography.

## Source references

- [Paintline and Inked Cel binding art reference](https://majieddd.github.io/worldheart-styles/)
- [Blue](https://rainbow-friends.fandom.com/wiki/Blue), [Green](https://rainbow-friends.fandom.com/wiki/Green), [Orange](https://rainbow-friends.fandom.com/wiki/Orange)
- [Animal Hospital anomalies](https://animal-hospital.fandom.com/wiki/Anomalies), [Barney](https://animal-hospital.fandom.com/wiki/Barney), [Stalker](https://animal-hospital.fandom.com/wiki/Stalker), [Dr. Harlow](https://animal-hospital.fandom.com/wiki/Dr._Harlow), [Head Banger](https://animal-hospital.fandom.com/wiki/Head_Banger)
- [Tralalero Tralala](https://stealabrainrot.fandom.com/wiki/Tralalero_Tralala), [Ballerina Cappuccina](https://stealabrainrot.fandom.com/wiki/Ballerina_Cappuccina), [Tung Tung Tung Sahur](https://stealabrainrot.fandom.com/wiki/Tung_Tung_Tung_Sahur)
- [Builderman outfit history](https://roblox.fandom.com/wiki/Player%3ABuilderman)

Source descriptions were consulted for identity. The generated drawings are new interpretations. Canonical appearance evidence and proposed gameplay are kept separate.

## Reproducible production

`tools/build-faction-catalogue.mjs` contains authored identities, behaviors, powers and ordinal profiles. `catalogue.json` retains each composed prompt, prompt hash, provider request, reported backend model, output hash and dimensions. Higgsfield's Nano Banana Pro route was requested; the returned backend model field is `nano_banana_2`. Preserve both fields rather than certifying a different model identity.

26 generated images were reviewed: 24 delivered plates plus two superseded roster layouts. The cost preflight was two credits per requested 2K image, 52 credits estimated for the complete set including revisions. This is a preflight estimate, not a billing audit.

The pilot established identity and surface behavior before the full batch. A visual contact-sheet review caught extra Robloxian figures and a full-height Brainshot figure. Both were regenerated to restore one-to-one sheet mapping. Superseded files and their prompts stay in `archive/`. All original PNGs remain intact; WebP files are delivery derivatives. Lucide icons retain their license and canonical path geometry.
