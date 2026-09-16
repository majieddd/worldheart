# Main release of the V2 game

Owner authorized production publication on 2026-09-16. U194, Codex,
`release/promote-v2-2026-09-16`. Status: verified locally, production deployment pending.

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
