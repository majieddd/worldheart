# What this changes

<!-- One paragraph. What was wrong or missing, and what the change does about it. -->

## Why

<!-- The cause, not just the symptom. If this fixes a defect, say what the wrong
     behaviour was, because that sentence usually belongs in a code comment too. -->

## Measurement

<!-- The numbers. Before and after, on a named map and seed.
     "Detours went from 1.2 to 6.9 times the straight line on seed 51940" is evidence.
     "Feels better" is not. Paste the console output or the harness lines. -->

## Checks

- [ ] `node tools/syntax.mjs` passes
- [ ] `node tools/test.mjs` passes
- [ ] Observed in the browser, not only reasoned about
- [ ] `node tools/deploy.mjs` run, so `v2/` and `dist/` are not stale
- [ ] `WH.camTest()` green (only if this went near the camera)
- [ ] The four classic maps still boot (only if this touched shared code)
- [ ] A whole run played, not just this feature
- [ ] No em dash character anywhere in the diff

## Notes for the reviewer

<!-- Anything you are unsure about, anything you deliberately left out, and any
     rule in CLAUDE.md you had to work around. -->
