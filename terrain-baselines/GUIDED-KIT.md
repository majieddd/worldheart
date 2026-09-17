# Guided Terrain Kit 1.0.0: approved terrain direction

The owner selected the guided terrain approach on 2026-09-16:
"really like the new terrain approach, it looks fantastic., lets lock it in"

This is the selected terrain direction for future V2 development. Preserve the
irregular shared-corner structure, pronounced cliff shelves, readable passages
and fitted multi-cell landmarks shown in the guided pane.

- Exact reviewed runtime: `2fb6ddf297a64edcb6c9257156d0fe78f99eccd0`.
- Immutable reference tag: `terrain/guided-kit-v1.0.0`.
- Approval and exact source file identities: [manifest](guided-kit-v1.0.0.json).
- Entry: `procgen-lab.html?seed=12345&terrain=varied`; select **Guided kit**.
- [Live comparison](https://majieddd.github.io/worldheart/v2/procgen-lab.html?seed=12345&terrain=varied).
- [Research and measured evidence](../docs/qa/implementation/PROCGEN-GUIDED-KIT.md).

For an exact reproduction, check out the tag in a separate worktree, run
`node tools/serve.mjs 8137`, and open the entry above. The tag preserves the whole
repository, including the demo, its worker, generation inputs, renderer and
navigation links. The manifest hashes exact Git bytes, not platform-normalized
working-tree line endings. Its screenshot also comes from that revision.

Do not move the tag, overwrite this version's manifest, or quietly replace the
selected visual direction. Create a separately named version for substantive
revisions and preserve this reference for comparison. Improve implementation and
performance while retaining the approved shapes and readability.

Visual acceptance is complete. The next implementation milestone is spherical
campaign integration: compatible planet seams, floor-following canyon passages,
production nest/tower/commander traversal, local rebuilds and measured device
performance. Keep the existing planet themes and macro-landscape diversity while
carrying the approved kit into those systems. The local fixture's stair/causeway
tradeoffs and QA limits remain documented; approval does not erase that evidence
or claim the full campaign has already migrated. Main remains on its released
version until another release is requested.
