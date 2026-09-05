# Where this stands, and what is worth doing next

Written 2026-09-05, at commit `d5e68a4`. The "state" section is fact. The "next"
section is a considered suggestion, not a commitment the owner has made. Check
with them before starting anything large.

## Where it stands

The game is complete and playable end to end on all five worlds. The roguelite
mode, 99 Planets, is the one under active development and is where the last
several rounds of work went.

Shipped and verified in the recent rounds:

- **Bodies and animation.** A procedural skeleton drives every creature and
  commander. Swings resolve at a strike frame rather than on the click, with hit
  stop, blade trails, damage numbers and particles. Enemies telegraph a blow and
  do no damage by contact.
- **First person.** Movement with acceleration, sprint, jump, head bob and a
  weapon view model, third person on the scroll wheel, raw pointer deltas
  through a smoothing filter, and a look sensitivity slider.
- **Progression.** Worldheart levels gate both the tower tier cap and how much
  of the frontier the run can hold. Breaches outside the circle become nests
  that raid until destroyed or swallowed.
- **Landforms.** Mountain ranges with passes and canyons with rims and ramps,
  cut into the same height field the navigation graph reads, so routes bend
  around one and pour along the other.
- **Building from the ground.** The digits arm a hand card while possessed, the
  ghost rides the crosshair, and a target beyond 14 units is refused.

`docs/POLISH-2026-09-04.md` is the tracker for those rounds and is worth reading
once as a worked example of how an item gets closed here: measured before,
changed, measured after, with the numbers in the commit message.

## Open decisions for the owner

These are not tasks. They are choices only the owner can make, and a collaborator
will hit all of them in the first week.

- **There is no LICENSE file.** The repository is public, so contributors and
  users currently have no granted rights. Adding one is a decision about
  ownership, so it has deliberately been left alone.
- **The checks workflow is new and is not yet required.** `.github/workflows/checks.yml`
  runs the syntax pass, the tests, the style rule and a staleness check on the
  published copies, on every pull request and every push to main. It does not
  touch deployment; Pages continues to serve `main` from repository settings.
  Whether it becomes a required status check before merging is a repository
  setting only the owner can change.
- **98 em dashes live in `docs/superpowers/`.** The house rule forbids them, but
  that directory is a frozen record of what was planned in early September 2026,
  so `tools/style.mjs` skips it rather than quietly rewriting history. Sweeping
  it is a one-line decision and nobody has made it.
- **The `v2/` mirror doubles the tree.** It exists because the URL was shared. A
  redirect would remove 36 duplicated files, but it would change what that URL
  serves, so it is the owner's call.
- **Nobody but the owner has pushed to this repository.** Whether a collaborator
  gets push rights to main or works entirely through pull requests should be
  settled before the first change, not during it.

## Known gaps, stated honestly

- **No tests outside the pure core.** `js/run/` and the bundler are covered. The
  renderer, the shell, the UI and every gameplay system are verified by hand. This
  is the single biggest structural weakness in the project.
- **Sun elevation swings across a walled playfield**, measured from 3 degrees to
  61 on one seed. A wide cap under a fixed sun has a gradient by construction.
  Fixing it needs a per-field sun or a smaller cap.
- **No systematic graphics artifact sweep has ever run** across the five maps. It
  was attempted once and the run died before reporting. Nothing since has changed
  world, tower or post-processing rendering, but the sweep is still owed.
- **`docs/superpowers/` is historical.** Several plans there describe intentions
  that changed. Every file carries a status header. Trust the code.

## Next work, sized

A systems inventory on 2026-09-05 found several places where the code disagrees
with itself. Each was verified by grep and each is written up with its citation
in `docs/GAMEPLAY.md`, under "Where the code disagrees with itself". They are the
most concrete work in the project right now, so they lead the list.

### Small, self-contained, good first tasks

0. **Counting House is bought and never paid.** The talent costs 180 coins and
   promises 150 extra gold per run. The bonus is added to the run core's
   per-player ledger, but live gold is `game.gold`, initialised from config and
   never written from the run, so the player never receives it. Either pay it
   into `game.gold` when the mode starts, or stop selling it.
1. **Show the build reach in first person.** Arming a card on the ground refuses
   targets past 14 units with a message, but nothing on screen says where the
   line is. A ground ring at the reach radius while a ghost is armed would make
   the rule visible instead of discoverable. Touches `js/game.js` and
   `js/effects.js`.
2. **Generate the content counts instead of writing them down.** The line in
   `docs/ARCHITECTURE.md` that reads "6 towers, 5 enemies, 20 powers" is hand
   maintained and has already drifted once, on the module count. A twenty line
   script that imports the registries and prints the tally would retire a whole
   category of stale documentation.
3. **Add a `.mailmap`.** The history has one author under two email addresses, so
   `git shortlog -sn` reports the same person twice. One file, two lines, and the
   contribution history reads correctly from then on.
4. **A seed gallery page.** A static page that boots a list of seeds and captures
   one orbit frame each would make terrain changes reviewable at a glance. Today
   every terrain judgement is one seed at a time.

### Medium

4a. **Wire up or retire the four dead powers.** Hardened Heart, Mending, Cryo
   Field and Chain Coil write modifier keys that nothing reads. They still take
   pool slots and can still win a draft, so a run can spend one of its seven
   power picks on nothing. Wiring each one is a balance change and needs a
   measurement, which is why this is not a first task.
4b. **Make the damage powers reach every tower.** The stats getter multiplies
   `dmg`, but Helios Lance keeps its damage in `dps`, the Arc Spire uses
   `charge` instead of `rate`, and the Warden Barracks uses `summonTime`. So the
   most expensive tower in the game gains nothing from any damage power, and two
   more gain nothing from rate. Fixing it properly probably means normalising
   what a tier row is allowed to call its numbers, which touches every tower.
4c. **Veterancy and Forward Scout are sold and do nothing.** Both set a profile
   flag that no consumer reads. Same choice as the dead powers: implement or
   withdraw.

5. **A headless shell harness.** Something that boots the game with a scripted
   input tape, advances with `WH.step`, and asserts on `WH.*` state at the end.
   This is the missing half of the test story, and it would let the gameplay
   systems be regression tested for the first time. Start with one scenario: a
   full 99 Planets run to wave 3 with scripted placements.
6. **The graphics artifact sweep.** Boot each of the five maps at several zoom
   levels and camera pitches, capture frames, and look for z-fighting, seams,
   popping decor and bloom blowout. Write down what "clean" means so it can be
   repeated.
7. **Canyons and ranges as tactical objects.** They currently shape the route
   because they shape walkability. The next step is making them read as
   decisions: a pass is a choke point worth fortifying, and the game does not yet
   say so anywhere in the interface.

### Large, discuss first

8. **A second planet in one session.** The mode is called 99 Planets and plays
   one. Carrying a profile from a cleared planet to the next is the mode's
   headline promise and it does not exist yet.
9. **Per-field sun.** Fixes the elevation gradient above and would let walled
   fields have their own time of day, which is a creative win as much as a
   technical one.
10. **A sixth commander archetype.** Five exist and each plays differently in the
    hands. `docs/CREATIVE.md` has the test a sixth would have to pass.

## How to close an item

Measure it before you change it, change it, measure it again, and put both
numbers in the commit message. That is the whole method, and it is the reason the
recent rounds have held up. `CONTRIBUTING.md` has the specifics of what counts as
evidence in this repo.
