# Creative direction

What this world is, how it should feel, and the tests a new tower, enemy,
commander or power has to pass before it belongs here.

`DESIGN.md` is the visual contract: colours, type, spacing, motion. This document
is the layer above it. If `DESIGN.md` says which cyan, this says why anything is
glowing at all.

## The premise, in one paragraph

A living planet carries a Worldheart, a crystal that keeps it alight. The void
has found this world and opens breaches on its surface. You are not a general
looking at a map, you are on the planet: you raise machines on its ground, and
when that is not enough you step into a body and fight beside them. The horizon
curves in front of you. What comes over it is coming for the heart.

## Pillars

1. **The planet is the board.** Curvature is always visible. Enemies crest the
   horizon before they arrive. Mountain ranges and canyons cut the ground into
   corridors and walls that the march has to obey. Nothing is flat and nothing is
   a map.
2. **Two decisions, one game.** Where your towers stand and where *you* stand are
   separate choices, each with a cost. Standing on the board makes you a target.
   Standing on the ground makes the board fight alone.
3. **Seal nothing, shape everything.** Placement is free anywhere on walkable
   ground, with exactly one restriction: no placement may sever the last path
   from a breach to the heart. The game is about bending a march, never about
   walling it out.
4. **Every blow reads.** A wind-up you can see, a strike frame where the hit
   lands, contact that stops time for a breath, a number and a spark at the
   wound. Nothing damages anything by touching it.
5. **Glow means something.** Light is information. A surface that glows is
   either player energy, enemy void, or economy. Decoration does not emit.

## The two sides

Everything in the game reads as one of two materials, and the split is absolute.

**Yours is machined.** Gunmetal, milled edges, visible fixings, and cyan light
running through channels that look like they were cut for it. Your machines look
manufactured by someone competent and slightly old fashioned. They are patient,
they hold ground, and they were clearly built before you got here. Nothing of
yours is organic and nothing of yours is purple.

**The void is wet obsidian lit from inside.** Dark bodies with magenta light
bleeding through seams, as if the light is a pressure rather than a lamp. It
moves in a way machinery does not: it lurches, it splits, it swarms. Magenta is
the enemy's colour and it never appears in interface chrome, so a magenta pixel
anywhere on screen means something hostile is there.

**The planet is neither.** Faceted terrain like cut gemstone, water like poured
glass, warm sunlight, and a sky that goes deep indigo at altitude. The world is
beautiful and indifferent. It is not on your side; it is the thing being fought
over.

**The Worldheart is the exception.** One luminous crystal, warm rather than
cyan, the only object on the planet that is neither machine nor void. It is the
reason for everything else on screen. When it takes damage, the whole frame
should know.

## Naming

The names in this game follow four grammars, and a new thing should join one of
them rather than invent a fifth.

| Family | Grammar | Existing |
|---|---|---|
| Towers | Two words: a physical noun plus a role or structure | Bolt Sentinel, Cryo Bloom, Mortar Bastion, Arc Spire, Helios Lance, Warden Barracks |
| Enemies | One blunt noun, short, no adjective | Mite, Husk, Aegis, Wisp, Colossus |
| Commanders | One compound word, a thing a person could be called | Bulwark, Twinfang, Longsight, Kettle, Emberline |
| Powers | Two plain words naming the mechanic, not the fantasy | Keen Rails, Overclock, Long Lens, Deep Freeze, Fifth Volley |

Rules that hold across all four: no apostrophes, no prefixes like Mega or Ultra,
no numerals in a name, and nothing that only makes sense if you already know the
lore. A player should be able to guess roughly what a Mortar Bastion does and be
right.

## Copy voice

Player-facing text is mechanics first, flavour second, and the flavour is one
concrete sentence rather than a mood.

```
Bolt Sentinel
Rapid single-target rails. Hits air.
Twin rails sing in the dark.
```

The middle line tells you what it does in the fewest words that are still
precise. The italic line underneath is allowed to be beautiful, but it has to be
about a thing, not a feeling. "Winter kept in a seed" is a real image. "Unleash
devastating frost" is not, and would be rejected.

Instructions address the player directly and plainly: "Click open ground to
build. Every breach must keep a path to the heart." Refusals say what to do
instead: "Too far to build from here. Walk closer."

Uppercase is reserved for short system markers such as WAVE 12 or PATH BLOCKED,
never for sentences. There are no exclamation marks in shipped copy.

## The tests a new thing has to pass

**A new tower** must change what the player does, not only what a number says. If
the honest description is "the same as an existing tower but stronger", it is an
upgrade mark, not a tower. It also needs a silhouette readable at strategic zoom,
where towers become icons, and a role sentence that does not overlap an existing
one.

**A new enemy** must attack the answer to the last enemy. The species exist as a
conversation: something fast and cheap, something that soaks, something armoured,
something that flies over your maze, something enormous. A new one should make a
defence that was working stop working, and it must telegraph its blow. Nothing in
this game damages by contact.

**A new commander** must play differently in the hands, not on the sheet. The
five archetypes are a heavy cleave, a fast dual strike, a hitscan marksman, an
arcing bombardier and a channelled beam. A sixth needs its own answer to "what is
it like to hold this", and it needs a first-person weapon that belongs to the
same body the third-person view shows.

**A new power** must be readable in one line at draft time, and it must matter
inside the same run. A power that only pays off in a run you will not finish is a
trap. Common powers scale a number, uncommon ones bend a system, rare ones change
a rule and are unique.

**A new landform** must change where towers go. Ranges and canyons earn their
place because routes bend around one and pour along the other. Terrain that only
looks different is set dressing, and set dressing goes in the decor pass.

## Sound

Everything is synthesised in WebAudio at runtime. There are no audio files in
this repository and adding one is a change of kind, not a change of degree.

The palette follows the material split: your machines are tuned, mechanical and
short, with a metallic transient and a clean tail. The void is detuned, breathy
and slightly wrong, with no clear pitch centre. The heart is warm and sustained,
and it is the only thing allowed a long tail.

Feedback follows the frequency gate in `DESIGN.md`. Something that happens a
hundred times a match is quiet and dry. Something that happens once a wave is
allowed to be an event.

## What this game is not

- Not a lane defence. There are no lanes, and adding a fixed path would remove
  the only structural rule the game has.
- Not a base builder. The Worldheart has levels, not a construction menu.
- Not grimdark. The planet is warm and the light is good. The horror is that
  something is eating a beautiful place.
- Not a shooter with towers attached. The first-person mode exists because
  standing on the board is a decision with a cost, not because it is a second
  game bolted on.
- Not photoreal. Faceted, hand-carved, museum diorama. If a surface needs a
  texture to read, it is the wrong surface.
