import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Enforces the portability contract from the spec, so it stays a property of
// the code rather than a matter of discipline. Phase 2 transliterates js/run
// into Luau; anything reached for here would have no Luau equivalent.

const DIR = 'js/run';

// Comments are stripped before scanning. The first version of this guard
// flagged rng.js because its comment says the core never calls Math.random,
// and a check that trips on prose is one people switch off.
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BANNED = [
  { pattern: /from\s+['"]three['"]/, why: 'imports three' },
  { pattern: /\bdocument\./, why: 'touches the DOM' },
  { pattern: /\bwindow\./, why: 'touches window' },
  { pattern: /\blocalStorage\b/, why: 'touches localStorage' },
  { pattern: /\bMath\.random\s*\(/, why: 'uses Math.random instead of the injected rng' },
  { pattern: /\bDate\.now\s*\(/, why: 'reads a clock instead of injected dt' },
  { pattern: /\bperformance\.now\s*\(/, why: 'reads a clock instead of injected dt' },
];

const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));

test('the core has files to check', () => {
  assert.ok(files.length >= 7, 'expected the seven core modules, saw ' + files.length);
});

for (const file of files) {
  test(file + ' obeys the portability contract', () => {
    const src = code(readFileSync(join(DIR, file), 'utf8'));
    for (const entry of BANNED) {
      assert.ok(!entry.pattern.test(src), 'js/run/' + file + ' ' + entry.why);
    }
  });
}

test('the core only imports from within js/run', () => {
  for (const file of files) {
    const src = code(readFileSync(join(DIR, file), 'utf8'));
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(spec.startsWith('./'), 'js/run/' + file + ' imports ' + spec + ' from outside the core');
    }
  }
});

test('the guard still catches a real violation', () => {
  const offender = 'const x = Math.random();';
  assert.ok(BANNED.some((b) => b.pattern.test(code(offender))), 'guard has been defanged');
});
