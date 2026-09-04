// Parse every module under js/ as an ES MODULE and fail on the first error.
//
// WHY THIS EXISTS. `node --check js/foo.js` on this tree returns 0 for a file
// that does not parse. With no package.json, --check does not run the ESM
// auto-detection the runtime does, so it never reaches the body of a module
// that begins with `import` and reports nothing. A regex edit that welded two
// statements into one parenthesis passed --check on five lines and shipped a
// SyntaxError to the browser, where boot hung on "waking the planet" with one
// console line and nothing else. Copying each file to a .mjs and checking
// THAT parses it as a module and catches it.
//
//   node tools/syntax.mjs            # all of js/, exit 1 on any failure
//   node tools/syntax.mjs js/x.js    # one or more files
import { readdirSync, statSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.slice(2);
if (!files.length) {
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.js')) files.push(p);
    }
  };
  walk(join(ROOT, 'js'));
}
const tmp = mkdtempSync(join(tmpdir(), 'wh-syntax-'));
let failed = 0;
for (const f of files) {
  const copy = join(tmp, basename(f).replace(/\.js$/, '.mjs'));
  writeFileSync(copy, readFileSync(f));
  const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed++;
    // Reported against the real path: the temp copy's name means nothing.
    console.error(`SYNTAX ${f}\n${(r.stderr || '').split(copy).join(f).split('\n').slice(0, 6).join('\n')}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log(`${files.length - failed}/${files.length} modules parse`);
process.exit(failed ? 1 : 0);
