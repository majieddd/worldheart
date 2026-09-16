# Collaborating on Worldheart

Read `CONTRIBUTING.md`, `CLAUDE.md`, `docs/PROGRESS.md` and the current
`docs/99-PLANETS-TO-DEFEND.md` before implementation. The owner's active request
sets scope and can supersede older design suggestions.

Keep GitHub tracker #1 and the relevant milestone issue current while working.
Record the active owner/branch/subsystem before edits, and update the progress
ledger and blueprint in the same session as gameplay changes. Preserve other
collaborators' changes and the immutable blind QA archive.

Distinguish planned, active, implemented-awaiting-verification, verified and
published. Close work only with the acceptance evidence it requires. Natural
play, instrumented fixtures and source inspection are different evidence types.
Correct disproven audit conclusions openly; do not rewrite frozen observations.

When repeated owner feedback shows that an output misses the target, use a bounded
reference-verification pass before another batch: search relevant YouTube creator
breakdowns or demonstrations, inspect accessible material, record the concrete
mismatch and check one representative revision against it. Use this when it resolves
uncertainty, not as a ritual for every edit. A transcript or waveform measurement
does not prove that audio was heard or that its sound was approved. If a video is
inaccessible, record that limitation and do not claim to have watched it.

The optional personal `implementation-tracker` skill provides this general
workflow. These repository instructions remain sufficient for collaborators
who do not have that skill installed. No additional approval gate is implied.

## Publish working changes to V2

On 2026-09-16 the owner explicitly authorized promoting the current verified V2
snapshot to main. See docs/qa/implementation/MAIN-PROMOTION.md for that release.
This is a production checkpoint, not standing permission to merge future work.

The owner authorized ongoing live previews at /worldheart/v2/ without merging
gameplay into main. Follow docs/PREVIEW.md at the start of each work session.
Base new campaign work on origin/preview/v2, preserve other collaborators'
changes, and publish each coherent verified checkpoint with
node tools/publish-preview.mjs. Keep ordinary review PRs alongside the preview.
Verify the Pages action, live build SHA and browser behavior before reporting
an update live. Update tracker #1 with the preview link and remaining QA gaps.
Preview publication is standing authorization; it does not authorize merging
gameplay into main. Never force-push the shared preview branch.
