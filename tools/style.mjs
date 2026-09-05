// The house style rules that a machine can check, so review does not have to.
//
// Today that is one rule: no em dash character anywhere in the source, the copy
// or the documents. It is the rule that is easiest to break by accident (every
// editor and every model produces them) and the hardest to spot in a diff,
// because at a glance it looks like a hyphen.
//
// A shell one-liner was tried first and was worse than nothing: `grep -P` needs
// a UTF-8 locale and errored out on the author's machine while still exiting in
// a way that read as "clean", so the check silently passed everything. Node has
// no locale to get wrong.
//
//   node tools/style.mjs          report and exit non-zero if anything is found
//
// Vendored and generated trees are skipped: lib/ is Three.js, dist/ and v2/ are
// produced by tools/deploy.mjs from files that are checked here already.
//
// docs/superpowers/ is skipped too, for a different reason. It is a frozen
// record of what was planned in early September 2026, it carries 98 em dashes
// from before the rule existed, and rewriting an archive to satisfy a style
// rule would be editing the record. Sweep it deliberately if you ever want to,
// but do not let it fail a check on work that has nothing to do with it.

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['lib', 'dist', 'v2', '.git', 'node_modules']);
const SKIP_PREFIXES = ['docs/superpowers/'];
// Written as an escape on purpose: a literal one here would make this file
// fail its own check the moment it was committed.
const EM_DASH = String.fromCharCode(0x2014);
const TEXT = /\.(mjs|js|json|md|html|css|txt|yml|yaml)$/i;

function tracked() {
  try {
    // --others --exclude-standard adds files that are new but not ignored.
    // Without them a brand new document is invisible to this check until it is
    // staged, which is exactly when a contributor most wants to be told.
    return execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    // Not a git checkout, or git is missing. Walk instead, so the check still
    // works from a downloaded copy of the tree.
    const out = [];
    (function walk(dir) {
      for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else out.push(relative(ROOT, full).split(sep).join('/'));
      }
    })(ROOT);
    return out;
  }
}

const files = tracked().filter((f) => {
  const top = f.split('/')[0];
  if (SKIP_DIRS.has(top)) return false;
  if (SKIP_PREFIXES.some((p) => f.startsWith(p))) return false;
  return TEXT.test(f);
});

const hits = [];
for (const f of files) {
  let text;
  try {
    text = readFileSync(join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  if (!text.includes(EM_DASH)) continue;
  text.split('\n').forEach((line, i) => {
    if (line.includes(EM_DASH)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
  });
}

if (hits.length) {
  console.error(`Em dash found in ${hits.length} place(s). Use a comma, a colon, or " - ".`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`style ok, no em dash in ${files.length} files`);
