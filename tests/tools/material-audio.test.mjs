import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../audio/material/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
function pcm(name) {
  const bytes = readFileSync(new URL(name, root));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  let data;
  for (let i = 12; i + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(i + 4), id = bytes.toString('ascii', i, i + 4);
    if (id === 'fmt ') {
      assert.equal(bytes.readUInt16LE(i + 8), 1, 'Uncompressed PCM');
      assert.equal(bytes.readUInt16LE(i + 10), 1, 'One channel');
      assert.equal(bytes.readUInt32LE(i + 12), 48000);
      assert.equal(bytes.readUInt16LE(i + 22), 16);
    }
    if (id === 'data') data = bytes.subarray(i + 8, i + 8 + size);
    i += 8 + size + size % 2;
  }
  assert.ok(data);
  return { bytes, data, frames: data.length / 2 };
}

test('material draft assets match their recorded hashes and have PCM headroom', () => {
  for (const [name, entry] of Object.entries(manifest.files)) {
    const { bytes, data } = pcm(name);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    let peak = 0;
    for (let i = 0; i < data.length; i += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
    assert.ok(peak > 1000 && peak / 32767 < .67, `${name}: bounded non-silent output`);
  }
});

test('every sprite segment is in bounds and separated by silence', () => {
  const { data, frames } = pcm(manifest.bank);
  let previousEnd = 0;
  for (const entries of Object.values(manifest.cues)) {
    assert.ok(entries.length > 0);
    for (const clip of entries) {
      const start = Math.round(clip.offset * 48000), end = start + Math.round(clip.duration * 48000);
      assert.ok(start >= previousEnd && end <= frames && end > start);
      assert.equal(data.readInt16LE(start * 2), 0);
      assert.equal(data.readInt16LE((end - 1) * 2), 0);
      for (let i = end; i < Math.min(end + 2000, frames); i++) assert.equal(data.readInt16LE(i * 2), 0);
      previousEnd = end;
    }
  }
});

test('piano phrases have deliberate quiet gaps and documented instrument sources', () => {
  const { data, frames } = pcm(manifest.score);
  assert.equal(frames / 48000, 48);
  let zeros = 0;
  for (let i = 0; i < frames; i++) if (data.readInt16LE(i * 2) === 0) zeros++;
  assert.ok(zeros / frames > .3, 'Quiet spaces occupy at least 30% of the sketch');
  assert.equal(manifest.pianoSources.length, 5);
  for (const source of manifest.pianoSources) {
    assert.match(source.url, /VSCO-2-CE\/440300901dfe9275fd84e0b7763af1f8443ae62e\/Keys\/Upright%20Piano\//);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
});
