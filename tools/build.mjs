// Bundles the game into self-contained single-file HTML. Every ES module
// (three included) becomes a data: URI entry in a generated import map, so
// module semantics survive byte-for-byte with no concatenation hazards.
// Outputs:
//   dist/worldheart.html   complete standalone document (open anywhere)
//   dist/artifact.html     body-only variant for hosts that wrap the page
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(import.meta.url), '..', '..'));

const GAME_MODULES = [
  'noise', 'config', 'audio', 'postfx', 'camera', 'world', 'nav',
  'effects', 'towers', 'enemies', 'waves', 'ui', 'game', 'main',
];

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

  for (const name of GAME_MODULES) {
    let src = await readFile(join(root, 'js', `${name}.js`), 'utf8');
    src = src.replace(/from\s+'\.\/([\w-]+)\.js'/g, "from '$1'");
    src = src.replace(/import\s+'\.\/([\w-]+)\.js'/g, "import '$1'");
    imports[name] = toDataUri(src);
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

build();
