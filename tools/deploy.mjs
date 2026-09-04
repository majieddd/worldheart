// Refresh the published copy at v2/ from the source tree.
//
// v2/ is a full duplicate of index.html, css/, js/ and lib/ that GitHub Pages
// serves at /worldheart/v2/. It was kept in sync BY HAND, which meant every
// source change needed a follow-up commit that was easy to forget - and
// forgetting it silently shipped a stale game while the repo looked correct.
// The name is also misleading: v2 is not a newer version, it is a mirror.
//
// Run this before committing anything under js/, css/ or index.html:
//   node tools/deploy.mjs
//
// It also rebuilds dist/, because the single-file build is committed too and
// drifts the same way.

import { cpSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR = join(ROOT, 'v2');
const TREES = ['js', 'css', 'lib'];
const FILES = ['index.html'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Compared with line endings normalised, because the working tree is checked
// out CRLF on Windows and a byte compare would report every file as different.
function sameContent(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  return norm(a) === norm(b);
}

for (const tree of TREES) {
  rmSync(join(MIRROR, tree), { recursive: true, force: true });
  cpSync(join(ROOT, tree), join(MIRROR, tree), { recursive: true });
}
for (const f of FILES) cpSync(join(ROOT, f), join(MIRROR, f));

// Verify rather than trust: a silent copy failure is exactly the class of
// problem this script exists to remove.
let checked = 0;
const drift = [];
for (const tree of TREES) {
  for (const src of walk(join(ROOT, tree))) {
    const rel = relative(ROOT, src);
    checked++;
    if (!sameContent(src, join(MIRROR, rel))) drift.push(rel);
  }
}
for (const f of FILES) {
  checked++;
  if (!sameContent(join(ROOT, f), join(MIRROR, f))) drift.push(f);
}

if (drift.length) {
  console.error(`v2 mirror FAILED on ${drift.length} file(s):`);
  for (const d of drift.slice(0, 10)) console.error('  ' + d);
  process.exit(1);
}

execFileSync(process.execPath, [join(ROOT, 'tools', 'build.mjs')], { stdio: 'inherit' });
console.log(`v2 mirror verified, ${checked} files identical to source`);
