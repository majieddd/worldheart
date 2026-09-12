// Pages deploys one artifact for the whole site. Compose it from two separate
// checkouts, then verify every production file before uploading anything.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const publicPath = path => !path.split('/').some(part => part.startsWith('.'));
const previewPath = path => (path === 'index.html' || path === 'debug.html' || path === 'lobby.html') || /^(js|css|lib)\//.test(path);

export function composeSite(production, preview, output) {
  production = resolve(production); preview = resolve(preview); output = resolve(output);
  if (production === preview) throw new Error('Production and preview must be separate checkouts');
  // A fresh destination prevents stale scripts surviving a removed module.
  // Never recursively clear a caller-supplied directory.
  for (const source of [production, preview]) {
    const rel = relative(output, source);
    if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Output would contain a source checkout');
  }
  if (existsSync(output) && readdirSync(output).length) throw new Error('Output must be empty');
  mkdirSync(output, { recursive: true });
  const list = root => git(root, 'ls-files', '-z').split('\0').filter(Boolean);
  const stableFiles = list(production).filter(path => publicPath(path) && !path.startsWith('v2/'));
  const previewFiles = list(preview).filter(previewPath);
  for (const [root, files] of [[production, stableFiles], [preview, previewFiles]]) {
    for (const required of ['index.html', 'js/main.js', 'css/style.css', 'lib/three.module.min.js']) {
      if (!files.includes(required)) throw new Error(`Missing required asset: ${required}`);
    }
    for (const path of files) {
      const src = join(root, path);
      if (!lstatSync(src).isFile()) throw new Error(`Only regular tracked files may publish: ${path}`);
      const dest = join(output, root === production ? '' : 'v2', path);
      mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest);
      if (hash(src) !== hash(dest)) throw new Error(`Published asset differs: ${path}`);
    }
  }
  const build = {
    format: 1, previewBranch: 'preview/v2', previewSha: git(preview, 'rev-parse', 'HEAD'),
    productionBranch: 'main', productionSha: git(production, 'rev-parse', 'HEAD'),
    productionFiles: stableFiles.length, previewFiles: previewFiles.length,
    productionHashes: Object.fromEntries(stableFiles.filter(path => previewPath(path) || path === 'dist/worldheart.html')
      .map(path => [path, hash(join(output, path))])),
    previewHashes: Object.fromEntries(previewFiles.map(path => [path, hash(join(output, 'v2', path))])),
  };
  writeFileSync(join(output, '.nojekyll'), '');
  writeFileSync(join(output, 'v2', 'build.json'), JSON.stringify(build, null, 2) + '\n');
  console.log(`Pages: ${stableFiles.length} production files preserved, ${previewFiles.length} preview assets verified`);
  return build;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 5) throw new Error('Usage: node tools/pages-site.mjs PRODUCTION_CHECKOUT PREVIEW_CHECKOUT EMPTY_OUTPUT');
  composeSite(...process.argv.slice(2));
}
