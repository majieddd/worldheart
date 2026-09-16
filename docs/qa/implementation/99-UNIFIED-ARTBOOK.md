# Unified Painted-Anime-Inkline artbook

Owner: Codex. Branch: feature/99-unified-artbook.
Base: preview 6b85808 plus feature closeout 6199d81. Collaborator terrain and
performance work are retained. Main 6133d07 remains separate.

## Scope and status

- U217 published and publicly verified: exactly five main tabs; native faction inspector;
  searchable/filterable 59-image Media gallery; old links preserve context.
- U218 published and publicly verified: eight built-in image_gen paintings, five environments
  with scenario/faction mixes, revised six-panel comic and Xeno sheets.
- U219 published and publicly verified: Xeno name, Physical/Mars and Void-first canon, five
  elemental silhouettes and complete 26-glyph fictional Adamic-inspired cipher.
- U220 published and publicly verified. Runtime d96576d1eac852c360fd7a1b5696ff5bdb57bda7, [PR #63](https://github.com/majieddd/worldheart/pull/63).

Selected B keeps its composition and now uses the Void arrival scene and Xeno
label. Original B, A/C, the nine earlier built-in paintings, 24 Higgsfield plates,
six medieval originals and Atmospheric Ink 1.3.1 archive are preserved.
Historical prompt/receipt records remain exact; content overrides run after
the legacy prompt composer. The earlier compact faction URL redirects into the
main artbook, retaining faction, category and asset selection.

## Evidence

- [93 unified-page browser checks](99-UNIFIED-ARTBOOK/local.json): five tabs,
  legacy links, story order, five elemental profiles, 26 unique glyphs with
  the original five unchanged, input escaping, gallery search/filter, modal
  zoom/focus, full-size image URL, live WebGL stage, 375/768/1280 layouts,
  real touch selection, measured AA text contrast, new and preserved image hashes,
  unchanged browser saves, no missing resources or script errors.
- [204 faction/B browser checks](99-UNIFIED-ARTBOOK/factions.json): all 90
  asset selections, 54 actives/icons, 30 faction/category routes, 48 original
  catalogue image identities, history, keyboard/modal, touch, B abilities,
  placement, explicit equipment swaps and six faction arsenals.
- 397/397 repository tests; 148/148 modules parsed; style clean.
- 384 generated V2 files match source; dist regenerated.
- Blueprint gate: 14/14 sections, 6/6 complete mechanics, 5/5 decision statuses,
  zero failures or warnings.
- [24 historical prompt/image/provider receipts preserved](99-UNIFIED-ARTBOOK/source-preservation.json).
- [Content and contrast audit](99-UNIFIED-ARTBOOK/content-audit.json).
- Visual review: [artbook contract and image limitations](../../art/99-planets/unified-artbook.md).

Earlier local runs are retained in artifacts/artbook/local-first and
factions-first. They passed their then-current scope before the eighth image
and final canon refinements. Final acceptance uses the reports above.

## Public verification

[Successful deployment](https://github.com/majieddd/worldheart/actions/runs/35141745405).
[93 unified-page cases](99-UNIFIED-ARTBOOK/public.json),
[204 faction/B cases](99-UNIFIED-ARTBOOK/public-factions.json) and
[627 live/source identities](99-UNIFIED-ARTBOOK/public-identity.json) pass.
Main remains 6133d0713f4e93e6fc743c35d9dd0fd1834bc98f.

Retained first reports: [iframe probe race](99-UNIFIED-ARTBOOK/public-first.json)
and [large PNG download timeout](99-UNIFIED-ARTBOOK/public-factions-first.json).
The first probe looked up the iframe before its navigation had established the URL.
It now waits for the embedded stage readiness before inspecting the frame. The
other attempt received HTTP 200 but exceeded the request download deadline while
identity verification was running concurrently. Its complete affected pass succeeded
on retry. Final public reports have zero script or resource errors. These are
probe/transfer corrections, not changes to the published application.

## Reproduce

Serve source with node tools/serve.mjs 8157. Set WH_NODE_MODULES to the bundled
node_modules directory and WH_BASE_URL to the server URL.

```text
node tools/qa-painted-lab.mjs artifacts/artbook/local-final --99-unified
node tools/qa-painted-lab.mjs artifacts/artbook/factions-final --99-factions
node tools/syntax.mjs
node tools/style.mjs
node tools/test.mjs
node tools/deploy.mjs
```

The canonical runner's --99-art path includes the new page probe; --99-drafts
retains the A/B/C interaction pass. No separate browser launcher was added.

## Boundaries

This is concept, narrative and page work. New abilities, elemental gameplay,
3D meshes, empirical faction balance and the Roblox port are not implemented
by this revision. Owner approval of the new art is pending.

The built-in image generator was used in response to the owner's preference for
the earlier Astra-described artwork. Its tool does not expose backing model
identity; prompts and receipts do not certify an exact model. Eight generations
were retained, usage unmeasured. No Higgsfield credits were used in this revision.
The alphabet is invented and Adamic-inspired; no recovered historical script or
full spoken-language grammar is claimed.
