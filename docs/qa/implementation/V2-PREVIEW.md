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

Pending first Pages deployment, exact public build identity and live browser
checks. Main has not been merged or edited. Remaining M0-M6 acceptance gates
are unchanged by making the preview accessible.
