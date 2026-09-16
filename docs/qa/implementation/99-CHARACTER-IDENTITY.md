# Character identity, placement concept and commander pilot

2026-09-16. Owner: Codex, feature/99-character-identity. U225-U228.

## Scope and status

- U225: revised Anomalous and Brainshot roster plates and current catalogue identities. Implemented and locally verified; owner visual approval pending.
- U226: third-person turret-placement painting composed with Arcade B, F/G powers and no in-game mode rail. Implemented and locally verified. This is an interactive concept, not a production-game graphics replacement.
- U227: Xeno race/element/role distinction and two original commander proposals, Vey the Gray and Sarrak the Reptilian. Implemented and locally verified. Existing Earth/2029, brown meteor dwellers and purple first-arrival canon retained.
- U228: same-commander method comparison and reusable production instructions. PARTIAL: Higgsfield 2D poster and editable Blender mesh available; ComfyUI/Krea execution and Meshy conversion remain pending access/capability.

The catalogue now has 92 proposed concepts, 20 commanders and 56 active powers.
Ratings preserve category budgets, but this does not establish gameplay balance.
The 67-image gallery keeps old source paintings and receipts. Superseded roster
plates are labeled. Earlier environment studies remain lighting references;
the new character rosters govern identity.

## Reference decisions

Animal Hospital patients retain the supplied screenshot's distinctive faces:
three red eyes/pink floppy ears, beige pointed ears/ring eyes/teeth, cyan horn,
indigo cat grin, long-neck cat and green open-mouth patient. Commander positions
and powers are proposed; descriptive labels are not asserted official names.
IGN was blocked by the browser safety policy. No alternate fetch was attempted.
The owner image and accessible appearance reference were used instead.

Brainrot bodies retain the three-sneaker shark, cup-headed ballerina, wooden log
with bat, masked coffee ninja, crocodile plane and banana chimp. The referenced
fan catalogue supplies appearance, not authority for invented stats or lore.

Sources: [Brainrot catalogue](https://brainrotcharacters.net/all-brainrot-characters/),
[appearance guide](https://animal-hospital-game.wiki/guides/animal-hospital/how-to-check-appearance-anomalies/).
Cosmic Conquest's local narrative source supplied only multi-race structure and
complementary alien archetypes. No timeline, politics or campaign mechanics were
ported. PvEvP, multiple commanders and planet stakes are future design notes.

## Production evidence

Five built-in generations preserve exact prompts and reference paths; the tool
does not expose its backing model, so these are not certified Astra outputs.
Higgsfield job de2fc528-1f21-41cc-b4bb-9fa897589c9d reports gpt_image_2_5,
high quality, 2K. Its prompt and receipt are in identity-v2/gray-higgsfield.json.
Meshy is listed in the connector catalogue, but submission rejects image_to_3d
and requests a generate_3d tool that is unavailable. No mesh job was submitted.

Blender project 473cc44f-ea1b-4be9-8912-73650b0403ec, revision 2, provides
GLB, self-contained glTF and .blend. Both construction and refinement scripts
are saved. Structural inspection: GLB v2 with valid length, 86 meshes with UVs,
8 embedded 1024 paint maps, finite small-scale bounds and zero animations.
The viewer loads all eight maps and contour hulls and supports orbit/reset.
The result is a simpler unrigged comparison, visibly below the poster's detail.
The external Aegis glbgate script was unavailable; these are direct structure
and rendered checks, not a claim that that named gate ran.

The ComfyUI workflow retains the official style-reference subgraph and model
filenames, prompt enhancement off, seed 99131 and the shared Vey prompt.
No running local server/install was found; the owner was asked for its location.
No Krea result, timing or VRAM measurement is claimed. Krea creates 2D images;
a later reviewed result can use the same mesh conversion for comparison.

## Verification

Local: 31 identity/placement/model checks, 206 faction/UI checks and 93 unified
artbook checks pass. Reports are in the adjacent 99-CHARACTER-IDENTITY folder.
402 repository tests pass; 155 modules parse; style check passes.
All 24 historical faction prompt receipts match their previous values.
Visual review corrected reversed model orientation, mobile HUD overlap and
new-text encoding before final captures.

The first identity probe stalled decoding below-fold lazy images; it now loads
the intended test images eagerly. The first unified-artbook pass was 92/93:
the UI filter correctly gained two placement pictures, while the probe expected
exactly three old drafts. The corrected assertion counts the manifest's UI set.
First failure report is retained alongside final reports.

Current-game placement evidence: armed the real Bolt build action in the browser
and read its route-preservation instruction. Source inspection confirmed stable
footprint, reach, frontier, obstructions, cost and open enemy-route validation.
The new painting demonstrates those ideas; it does not prove third-person
placement interaction in the production game. No full campaign QA is claimed.

## Reproduce

Use tools/serve.mjs 8157. Set WH_BASE_URL and WH_NODE_MODULES for the existing
browser runner. Run tools/qa-painted-lab.mjs with --99-identity, --99-factions
and --99-unified into separate artifact directories. Regenerate media with
tools/assemble-identity-art.mjs then tools/assemble-artbook.mjs. Preserve the
identity-v2 source PNGs and generated model files.

## Collaboration and publication

Integrated shared preview 47d874d and retained the procgen sandbox records.
Publication is V2 only; main remains under the existing release policy.
Deployment and public checks will be recorded after publishing.
