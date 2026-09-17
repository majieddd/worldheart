# Main release of the V2 game

Owner authorized production publication on 2026-09-16. U194, Codex,
`release/promote-v2-2026-09-16`. Status: published and publicly verified.

Source snapshot: `4ca722bc07e67e6d4856f49f1639f567021cfff6`, including the verified
collaborator publication during preparation. The first snapshot `0e8723e` also
passed all 261 public identity checks before that update. Previous main:
`1374122d1109919a5fab10b69fefdfb80308eb6e`.
No gameplay, art, audio or save format changes are part of this release.
Both sites retain the existing isolated browser profiles. No saves are copied,
deleted or overwritten by the promotion; campaign/home export/import is available
for deliberate transfers. The root URL opens the preparation lobby, just like V2.

The release preserves all current integrated work. The ongoing V2 development
branch stays available and is not reset, rewritten or automatically promoted to
main in future. Prior "main unchanged" notes are historical release records.

Acceptance: current published V2 identity; source parse, tests and style;
generated mirror consistency; lobby, direct Homeworld play and save isolation
in the browser; successful Pages deployment; production/source file identities.
The previous ten-wave campaign and Homeworld gameplay evidence remain in their
respective ledgers. Deployment smoke checks do not assert new balance, performance
or full 99-planet acceptance.

Rollback: the pre-release main is preserved as tag
`release/pre-v2-promotion-2026-09-16`. Restore its public runtime via a reviewed
forward commit if needed, retaining the publishing workflow and newer preview.
Never force-push main or preview/v2.

## Verification

Main and preview/v2 were atomically fast-forwarded to
`6133d0713f4e93e6fc743c35d9dd0fd1834bc98f`. [PR #57](https://github.com/majieddd/worldheart/pull/57)
is merged. [Main Pages action](https://github.com/majieddd/worldheart/actions/runs/35066134083)
and the identical [preview action](https://github.com/majieddd/worldheart/actions/runs/35066137526)
both succeeded. The [main game](https://majieddd.github.io/worldheart/) is live.

- [485 public/source identities](MAIN-PROMOTION/public-identity.json) match both
  branch revisions, including the stable single-file download.
- [All 11 public browser checks](MAIN-PROMOTION/public.json) pass with no runtime
  exceptions. The [mobile lobby](MAIN-PROMOTION/public-mobile.png) and
  [Earth entry](MAIN-PROMOTION/public-earth.png) were rendered and inspected.
- [279 pre-release identities](MAIN-PROMOTION/preview-final-identity.json) confirm
  the newer V2 snapshot before promotion; the earlier receipt is also retained.

- All 379 automated tests pass; 135 source modules parse and the house style
  check passes. The generated V2 mirror has 242 matching files.
- Runtime directories and all entry pages are unchanged from `4ca722b`.
- All 11 local release browser checks pass: bare-root lobby, default Earth,
  direct clear third-person entry, actual nest wave start, root home persistence,
  isolated V2 campaign/home saves, mission launch destination and mobile action.
- The first QA script assumed `#mission` opened the station. Only `#homeworld`
  has a deep link; the corrected probe clicks the real Mission gate button.
  This was a fixture failure, not a changed game feature. The first report is
  retained with the final evidence. Campaign navigation is intercepted only
  after the real launch click; the home wave is actually simulated.

The evidence closeout on the release branch only updates documents and the
probe's screenshot-settling waits. Deployed gameplay remains the exact release
above; it does not require another runtime publication.
