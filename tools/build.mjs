// Bundles the game into self-contained single-file HTML. Every ES module
// (three included) becomes a data: URI entry in a generated import map, so
// module semantics survive byte-for-byte with no concatenation hazards.
// Outputs:
//   dist/worldheart.html   complete standalone document (open anywhere)
//   dist/artifact.html     body-only variant for hosts that wrap the page
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(import.meta.url), '..', '..'));

// Module keys are paths relative to js/ without the extension, so js/run/rng.js
// becomes 'run/rng'. This list used to be flat and hand-maintained, which meant
// the bundler could not see subdirectories at all: js/run/* was silently
// omitted from the single-file build, and the omission would only have shown up
// once something finally imported it.
export function moduleKey(relPath) {
  return relPath.split('\\').join('/').replace(/\.js$/, '');
}

// Resolve a relative specifier against the importing module's own directory and
// return the import-map key it should point at. './rng.js' inside 'run/run'
// resolves to 'run/rng'; '../run/run.js' inside 'modes/ninetynine' to 'run/run'.
export function resolveSpecifier(fromKey, spec) {
  const fromDir = fromKey.includes('/') ? fromKey.slice(0, fromKey.lastIndexOf('/')) : '';
  const parts = fromDir ? fromDir.split('/') : [];
  for (const seg of spec.replace(/\.js$/, '').split('/')) {
    if (seg === '.' || seg === '') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

// Rewrite every relative import in a module to its bare import-map key.
export function rewriteSpecifiers(src, key) {
  return src.replace(
    /(from\s+|import\s+)(['"])(\.\.?\/[^'"]+\.js)\2/g,
    (_m, lead, quote, spec) => lead + quote + resolveSpecifier(key, spec) + quote,
  );
}

// Every .js under js/, recursively, so a new module is picked up by existing.
async function collectModules(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await collectModules(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

function toDataUri(source) {
  return 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
}

async function build() {
  const imports = {};

  let core = await readFile(join(root, 'lib', 'three.core.min.js'), 'utf8');
  imports['three-core'] = toDataUri(core);

  let three = await readFile(join(root, 'lib', 'three.module.min.js'), 'utf8');
  three = three
    .replaceAll('"./three.core.min.js"', '"three-core"')
    .replaceAll("'./three.core.min.js'", "'three-core'");
  imports['three'] = toDataUri(three);

  for (const rel of await collectModules(join(root, 'js'))) {
    const key = moduleKey(rel);
    const src = await readFile(join(root, 'js', rel), 'utf8');
    imports[key] = toDataUri(rewriteSpecifiers(src, key));
  }

  const css = await readFile(join(root, 'css', 'style.css'), 'utf8');
  let html = await readFile(join(root, 'index.html'), 'utf8');

  html = html.replace(
    /<link rel="stylesheet" href="css\/style.css">/,
    `<style>\n${css}\n</style>`,
  );
  html = html.replace(
    /<script type="importmap">[\s\S]*?<\/script>/,
    `<script type="importmap">\n${JSON.stringify({ imports }, null, 0)}\n</script>`,
  );
  html = html.replace(
    /<script type="module" src="js\/main.js"><\/script>/,
    `<script type="module">import 'main';</script>`,
  );

  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', 'worldheart.html'), html);

  // Artifact variant: strip the document skeleton, keep everything inside body
  // plus the style/font/importmap/script tags.
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  const headLinks = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">',
  ].join('\n');
  const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
  const artifact = `<title>WORLDHEART</title>\n${headLinks}\n${styleMatch[0]}\n${bodyMatch[1]}`;
  await writeFile(join(root, 'dist', 'artifact.html'), artifact);

  const size = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
  console.log(`dist/worldheart.html ${size} MB, ${Object.keys(imports).length} modules inlined`);
}

// Only build when run directly, so the pure helpers above can be unit-tested.
if (process.argv[1] && process.argv[1].endsWith('build.mjs')) build();
