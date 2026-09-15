# Owner audio feedback revision

Published and publicly verified: V2 023a70b. Codex, feature/audio-restoration, PR #44.

- U143: preserve six approved effects, restore previous tower shot/lobber, deepen explosion; contextual melee/creature sounds, distinct landing and short playful reward motifs.
- U144: publish the nine owner-provided soundtrack files with contextual streaming and controls. Owner explicitly confirmed these are the public game soundtrack. Remove the rejected piano sketch.
- U145: measure sample tails, headroom, approved-clip identity, context routing and browser playback; retain owner listening as final subjective acceptance.

No main merge. Draft effects remain opt-in; owner music is enabled by a user gesture in normal V2 and lobby, replacing the procedural background bed.

## Implementation

Six accepted clips pass exact PCM hashes. Tower shot/lobber revert to the
original recipes; explosion lowers its noise sweep and sub frequencies. Sword,
spear, twin blades and wood equipment route contact separately. Armor and flesh
contacts differ, and five creature types receive short distinct reactions.
Ranged hits no longer mistakenly use the melee-contact cue in the draft.
Landing has a low body with leather/gear settle; pickup is 0.20 seconds, with
short original reward motifs for upgrade/victory.

The owner confirmed all nine supplied files should be published. MP3 bytes are
preserved; source measured loudness spans -14.63 to -12.03 LUFS. Runtime gain
attenuates to a common -19 LUFS basis without raising source noise. Streaming
keeps at most two decks during 0.8-second transitions. Music and effects have
shared peak protection; music never passes through the effects treble filter.
Original wind/pad removed; music waits for a gesture, follows master mute and
hidden-tab pause, and has independent controls in Settings / lobby Music menu.

Research: [Halo's audio team](https://www.halowaypoint.com/news/inside-infinite-march-2021)
informed clear, distinct blast identities; [Nintendo's Galaxy sound team](https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-Super-Mario-Galaxy/Volume-3-The-Sound-Team/1-Why-Use-an-Orchestra-/1-Why-Use-an-Orchestra-205026.html)
informed musical reward feedback. No Halo/Nintendo recordings or melodies copied.

The first browser pass tried to click a decorative lobby heading that deliberately
passes pointer events to the canvas. The fixture now clicks the actual canvas.
A visual pass also caught station navigation painting over the music popover;
its stacking order was corrected. Failed evidence is retained.

Subjective acceptance remains open: the implementing agent cannot hear audio.
No spectral metric is a substitute for the owner's judgment of warmth, musical
character, unwanted noise or vocal content.

## Verified publication

V2 commit `023a70b6cb5c53d3eab9c91ae2f1915afb3d8131`, [successful Pages action
34954033695](https://github.com/majieddd/worldheart/actions/runs/34954033695).
340 tests, 100 source modules, style, 128 generated mirror assets, 66 local and
66 public browser checks pass. Public identity verification compares every
preview asset to its Git blob and manifest, preserves main runtime hashes and
checks rejected assets are absent: 180 checks. Main remains `1374122`.

[Revised comparison](https://majieddd.github.io/worldheart/v2/audio-lab.html)
contains contextual selectors and all nine native music players. Draft effects
remain opt-in via its Play link; the owner soundtrack is available in normal
V2 and lobby after a gesture. Settings has the music volume/enable controls;
the lobby uses a compact Music menu. The single-file export needs the audio
asset folder for music; the live stable-root export is unchanged.

U143 and U144 are implemented/published. U145 technical verification is complete;
subjective listening and physical-device acceptance remain open. Evidence-only
closeout edits do not change the deployed runtime.
