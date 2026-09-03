import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleKey, resolveSpecifier, rewriteSpecifiers } from '../../tools/build.mjs';

// A literal backslash, built from its char code so the test data cannot be
// mangled by a shell heredoc on the way into this file. Writing '\\' here once
// cost a false failure that looked like a bug in moduleKey.
const BACKSLASH = String.fromCharCode(92);

test('moduleKey strips the extension and normalises separators', () => {
  assert.equal(moduleKey('main.js'), 'main');
  assert.equal(moduleKey('run/rng.js'), 'run/rng');
  assert.equal(moduleKey('run' + BACKSLASH + 'rng.js'), 'run/rng');
  assert.equal(moduleKey('modes/ninetynine.js'), 'modes/ninetynine');
});

test('a same-directory specifier resolves beside its importer', () => {
  assert.equal(resolveSpecifier('main', './config.js'), 'config');
  assert.equal(resolveSpecifier('run/run', './rng.js'), 'run/rng');
});

test('a parent specifier climbs out of the importer directory', () => {
  assert.equal(resolveSpecifier('modes/ninetynine', '../run/run.js'), 'run/run');
  assert.equal(resolveSpecifier('modes/ninetynine', '../config.js'), 'config');
  assert.equal(resolveSpecifier('run/run', '../config.js'), 'config');
});

test('nested descent resolves', () => {
  assert.equal(resolveSpecifier('main', './run/rng.js'), 'run/rng');
  assert.equal(resolveSpecifier('a/b/c', '../../d.js'), 'd');
});

test('rewrite maps a core import to its bundled key', () => {
  const src = "import { makeRng } from './rng.js';";
  assert.equal(rewriteSpecifiers(src, 'run/run'), "import { makeRng } from 'run/rng';");
});

test('rewrite handles the shell reaching into the core', () => {
  const src = "import { createRun } from '../run/run.js';\nimport { CONFIG } from '../config.js';";
  const out = rewriteSpecifiers(src, 'modes/ninetynine');
  assert.ok(out.includes("from 'run/run'"), out);
  assert.ok(out.includes("from 'config'"), out);
});

test('rewrite handles double quotes and side-effect imports', () => {
  assert.equal(rewriteSpecifiers('import "./boot.js";', 'main'), 'import "boot";');
});

test('bare specifiers are left alone so three keeps resolving', () => {
  const src = "import * as THREE from 'three';";
  assert.equal(rewriteSpecifiers(src, 'world'), src);
});

test('a quote mismatch is not rewritten', () => {
  const src = 'import x from \'./a.js";';
  assert.equal(rewriteSpecifiers(src, 'main'), src);
});

test('the real core rewrites to keys that exist in the bundle', () => {
  const src = "import { makeRng, pick } from './rng.js';\nimport { foldModifiers } from './modifiers.js';";
  const out = rewriteSpecifiers(src, 'run/run');
  assert.ok(out.includes("'run/rng'"));
  assert.ok(out.includes("'run/modifiers'"));
  assert.ok(!out.includes('./'), 'no relative specifier should survive');
});
