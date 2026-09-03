// Runs the headless core suite. The core imports nothing, so it needs no
// browser and no build step.
//
// `node --test tests/` (the directory form) misbehaves on this setup, so the
// glob form is used deliberately. Do not "simplify" it back.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--test', 'tests/**/*.test.mjs'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
