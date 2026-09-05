// Read-only diagnostic of real exported rules. This does not simulate WebGL combat.
// Run with Node 24 and pass the checkout root as the first argument.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2]);
const moduleUrl = (p) => pathToFileURL(resolve(root, p)).href;
globalThis.location = { search: '?map=ninetynine' };
globalThis.matchMedia = () => ({ matches: false });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: moduleUrl('lib/three.module.min.js'), shortCircuit: true };
  return next(specifier, context);
} });
const { Tower, MODS } = await import(moduleUrl('js/towers.js'));
const { foldModifiers } = await import(moduleUrl('js/run/modifiers.js'));
const { POWER_BY_ID } = await import(moduleUrl('js/run/powers.js'));
const samples = [];
for (const [type, field, power] of [
  ['bolt', 'dmg', 'keen-rails'], ['helios', 'dps', 'keen-rails'],
  ['bolt', 'rate', 'overclock'], ['tesla', 'charge', 'overclock'],
  ['warden', 'summonTime', 'overclock'], ['tesla', 'chains', 'chain-coil'],
]) {
  const tower = Object.create(Tower.prototype);
  tower.typeKey = type;
  tower.tier = 0;
  MODS.current = null;
  const before = tower.stats[field];
  MODS.current = foldModifiers([POWER_BY_ID[power]]);
  const after = tower.stats[field];
  samples.push({ type, field, power, before, after, changed: before !== after });
}
MODS.current = null;
const sources = [];
function walk(dir) {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.js')) sources.push(p);
  }
}
walk('js');
const references = Object.fromEntries(['livesAdd','heartRegen','slowAura','chainAdd'].map(key => [key,
  sources.flatMap(file => readFileSync(resolve(root,file),'utf8').split('\n')
    .flatMap((line,i) => line.includes(key) ? [{file,line:i+1,text:line.trim()}] : []))
]));
const head = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const live = [];
for (const file of ['index.html','js/main.js','js/towers.js','js/ui.js','js/run/run.js','js/modes/ninetynine.js']) {
  const response = await fetch(`https://majieddd.github.io/worldheart/${file}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${file}`);
  const text = (await response.text()).replace(/\r\n/g,'\n');
  const expected = execFileSync('git',['show',`${head}:${file}`],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
  live.push({file,matchesHead:text===expected,sha256:createHash('sha256').update(text).digest('hex')});
}
console.log(JSON.stringify({time:new Date().toISOString(),head,node:process.version,
  scope:'Actual Tower.stats getter plus source reference search and six deployed asset comparisons. No browser combat simulation.',
  samples,references,live},null,2));
