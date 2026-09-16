import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSIONS} from '../../js/hard-cel-versions.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('The owner-selected candidate keeps every archived dependency byte-identical',()=>{
  const root=new URL('../../art-candidates/hard-cel-v1/',import.meta.url),manifest=readFileSync(new URL('candidate.json',root)),baseline=JSON.parse(manifest),study=JSON.parse(readFileSync(new URL('../../art-candidates/hard-cel-study.json',import.meta.url)));
  assert.equal(hash(manifest),study.baselineManifestSha256);assert.equal(baseline.sourceRevision,'4fcee910ca6fb71771fa8b8ba54d9a5172281a58');assert.equal(baseline.files.length,16);
  for(const file of baseline.files)assert.equal(hash(readFileSync(new URL(file.path,root))),file.sha256,file.path);
});
test('The live baseline recipe retains the approved Hard Cel values',()=>{
  const baseline=JSON.parse(readFileSync(new URL('../../art-candidates/hard-cel-v1/candidate.json',import.meta.url))).recipe,v=VERSIONS.v1;
  assert.deepEqual(v.bands,baseline.gradientBands);assert.deepEqual(v.thresholds,baseline.gradientThresholds);assert.equal(v.line,baseline.contourCssPixels);assert.equal(v.ink,baseline.contourColor);assert.equal(v.pigment,baseline.paintAmount);assert.equal(v.emissive*.1,baseline.modelEmissiveIntensity);assert.equal(v.shadowRadius,baseline.shadowRadius);assert.equal(v.fog,baseline.fogDensity);assert.equal(v.tint,0);assert.equal(v.hatch,0);assert.equal(v.rim,0);
});
test('Each proposed version has a unique recipe and does not inherit owner approval',()=>{
  const s=JSON.parse(readFileSync(new URL('../../art-candidates/hard-cel-study.json',import.meta.url)));assert.equal(s.variants.length,4);assert.equal(new Set(s.variants.map(v=>v.version)).size,4);assert.equal(new Set(s.variants.map(v=>JSON.stringify(v.recipe))).size,4);
  for(const v of s.variants){assert.equal(v.status,'unreviewed');assert.equal(v.parent,'worldheart-hard-cel-v1');assert.ok(v.entry.includes(v.id));assert.ok(v.hypothesis.length>30);}
});
