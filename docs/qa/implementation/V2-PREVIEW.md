# V2 preview publication

2026-09-06. Owner: Codex on feature/v2-preview-workflow, based on PR #17.
The owner authorized live development at /worldheart/v2/ without merging the
gameplay stack into main. [PREVIEW.md](../../PREVIEW.md) is the standing workflow.

The Pages artifact combines 71 tracked public main files at the root with 52
current game assets under v2. Every copied file is SHA-256 verified against
its source checkout. Production source is 1374122; the artifact records both
commit IDs and runtime asset hashes at /v2/build.json. Only the preview's source
code, styles and vendored runtime publish under v2, not the development evidence.

V2 defaults to the 99-planet campaign and uses whV2-prefixed storage. It does not
read or overwrite the stable game's profile. Preview saves survive subsequent
deployments. Explicit classic-map links and the single-planet sandbox remain.

## Local evidence

- [213 headless checks](V2-PREVIEW/headless.txt) passed, including six new
  deployment/storage tests. The artifact tests prove root versus preview source
  separation, removal of the old mirror, rejection of stale/dangerous output,
  required game assets, save isolation, reload, conflict and denied-storage paths.
- 47/47 source modules parse; house style and whitespace pass. Generated v2 and
  dist were refreshed, with 49 bundled modules and 52 identical mirror files.
- [Five-map camera/boot/defeat/retry regression](V2-PREVIEW/maps.json) passed.
- [17 deployment/browser checks](V2-PREVIEW/local.json) passed in installed
  Chrome at 1280x720. They check six stable and four preview HTTP asset hashes,
  V2 campaign startup, actual Begin and twelve seconds of simulation, saved
  assault/reload, original profile preservation, stable Pocket boot and an
  explicit V2 classic map. No runtime faults occurred.

The local artifact was composed before the implementation commit, so its
previewSha names the parent and its asset hashes identify the working files.
Public verification must record the committed build identity separately.
This is a deployment smoke test, not an additional full campaign victory.

## Public verification

The [first Pages deployment](https://github.com/majieddd/worldheart/actions/runs/34044866229)
succeeded for implementation commit fe2f4a28944295997b17d63e23ac26de3097e37a.
The [17 live checks](V2-PREVIEW/live.json) passed against
https://majieddd.github.io/worldheart/ in installed Chrome at 1280x720, with
zero runtime faults. The public build identity named that exact preview commit
and unchanged main commit 1374122d1109919a5fab10b69fefdfb80308eb6e.
Six original and four preview HTTP assets matched their respective hashes.

[V2 title](V2-PREVIEW/live-title.png), [V2 playing](V2-PREVIEW/live-playing.png)
and [original title](V2-PREVIEW/original-title.png) document both public routes.
V2 began a real assault, saved only the prefixed checkpoint, retained it through
reload, and left the seeded original profile unchanged. The stable Pocket map
and explicit V2 Pocket map both booted. All images were inspected.

[PR #18](https://github.com/majieddd/worldheart/pull/18) remains a stacked draft.
Main has not been merged or edited. This evidence follow-up changes docs only;
the next preview deployment retains the tested game asset hashes. Remaining
M0-M6 acceptance gates are unchanged by making the preview accessible.

The first original-title screenshot caught the loading layer during its fade.
That image is retained; the harness now waits for the layer's computed opacity
to reach zero before pausing browser frames or taking a capture. The
[repeated 17 live checks](V2-PREVIEW/settled.json) passed at documentation commit
8ba1539, with the same runtime hashes and unchanged production SHA. The
[settled original title](V2-PREVIEW/settled-original-title.png) confirms the
loading layer has cleared. This was a capture-timing refinement, not a game
loading defect or a change to the published gameplay.
