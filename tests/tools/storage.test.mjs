import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopedStorage, storageKey, isPreviewPath } from '../../js/storage.js';
import { createCampaignStore } from '../../js/modes/campaign-store.js';

test('Preview campaign and preferences never read or overwrite production saves', () => {
  const data = new Map([['wh99Progress', JSON.stringify({ coins: 900 })], ['whMap', 'pocket']]);
  const raw = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const stable = scopedStorage(raw, '/worldheart/'), preview = scopedStorage(raw, '/worldheart/v2/');
  const store = createCampaignStore(preview);
  assert.equal(store.snapshot().account.coins, 0);
  preview.setItem('whMap', 'ninetynine');
  assert.equal(stable.getItem('whMap'), 'pocket');
  assert.equal(preview.getItem('whMap'), 'ninetynine');
  assert.equal(store.commit(s => { s.account.coins = 75; return true; }).saved, true);
  assert.equal(data.has('wh99Campaign'), false);
  assert.equal(createCampaignStore(preview).snapshot().account.coins, 75);
  preview.removeItem('whMap');
  assert.equal(stable.getItem('whMap'), 'pocket');
  assert.equal(data.get('wh99Progress'), JSON.stringify({ coins: 900 }));
});

test('Preview tabs retain conflict protection and denied-storage recovery', () => {
  const data = new Map(), raw = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const storage = scopedStorage(raw, '/worldheart/v2/');
  const first = createCampaignStore(storage), second = createCampaignStore(storage);
  assert.equal(first.commit(s => { s.account.coins = 1; return true; }).saved, true);
  assert.equal(second.commit(s => { s.account.coins = 2; return true; }).saved, false);
  assert.equal(second.status().error, 'conflict');
  const denied = createCampaignStore(scopedStorage({ getItem() { throw Error('denied'); } }, '/v2/'));
  assert.equal(denied.status().error, 'unavailable');
});

test('Only a v2 path segment changes the storage namespace', () => {
  for (const path of ['/worldheart/', '/worldheart/v20/', '/worldheart/preview-v2/']) {
    assert.equal(isPreviewPath(path), false); assert.equal(storageKey('whMap', path), 'whMap');
  }
  for (const path of ['/v2', '/v2/', '/worldheart/v2/index.html']) assert.equal(storageKey('whMap', path), 'whV2:whMap');
});
