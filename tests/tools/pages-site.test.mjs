import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { composeSite } from '../../tools/pages-site.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'worldheart-pages-test-'));
  t.after(() => {
    if (dirname(resolve(dir)) !== resolve(tmpdir())) throw new Error('Unexpected test cleanup path');
    rmSync(dir, { recursive: true });
  });
  const repo = name => {
    const root = join(dir, name); mkdirSync(root);
    const files = {
      'index.html': name, 'debug.html': name, 'js/main.js': name, 'css/style.css': name,
      'lib/three.module.min.js': name, 'dist/worldheart.html': name,
      'v2/obsolete.js': 'stale mirror', '.github/workflows/private.yml': 'workflow',
    };
    for (const [path, value] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value);
    }
    const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git('init'); git('add', '.');
    git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture');
    return root;
  };
  return { dir, production: repo('production'), preview: repo('preview') };
}

test('Pages preserves production bytes and replaces only the v2 game with preview assets', t => {
  const { dir, production, preview } = fixture(t), out = join(dir, 'site');
  const build = composeSite(production, preview, out);
  assert.equal(readFileSync(join(out, 'index.html'), 'utf8'), 'production');
  assert.equal(readFileSync(join(out, 'dist/worldheart.html'), 'utf8'), 'production');
  assert.equal(readFileSync(join(out, 'v2/index.html'), 'utf8'), 'preview');
  assert.equal(readFileSync(join(out, 'v2/js/main.js'), 'utf8'), 'preview');
  assert.equal(readFileSync(join(out, 'v2/debug.html'), 'utf8'), 'preview');
  assert.equal(readFileSync(join(out, 'debug.html'), 'utf8'), 'production');
  assert.equal(existsSync(join(out, 'v2/obsolete.js')), false);
  assert.equal(existsSync(join(out, '.github')), false);
  assert.equal(existsSync(join(out, 'v2/dist')), false);
  assert.equal(JSON.parse(readFileSync(join(out, 'v2/build.json'))).previewSha, build.previewSha);
  assert.equal(Object.keys(build.previewHashes).length, 5);
});

test('Pages refuses stale output or a destination that would contain source', t => {
  const { dir, production, preview } = fixture(t), out = join(dir, 'site');
  mkdirSync(out); writeFileSync(join(out, 'sentinel'), 'keep');
  assert.throws(() => composeSite(production, preview, out), /empty/);
  assert.equal(readFileSync(join(out, 'sentinel'), 'utf8'), 'keep');
  assert.throws(() => composeSite(production, preview, production), /source checkout/);
  assert.throws(() => composeSite(production, preview, dir), /source checkout/);
  assert.throws(() => composeSite(production, production, join(dir, 'new')), /separate checkouts/);
});

test('Pages fails when either checkout cannot supply a playable app', t => {
  const { dir, production, preview } = fixture(t);
  execFileSync('git', ['rm', 'js/main.js'], { cwd: preview });
  assert.throws(() => composeSite(production, preview, join(dir, 'site')), /Missing required asset/);
});
