import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insideFrontier, angleBetween } from '../../js/run/frontier.js';

const CENTRE = { x: 0, y: 0, z: 1 };

test('angleBetween is zero for identical directions', () => {
  assert.ok(angleBetween(CENTRE, CENTRE) < 1e-9);
});

test('angleBetween is a right angle for perpendicular directions', () => {
  const a = angleBetween(CENTRE, { x: 1, y: 0, z: 0 });
  assert.ok(Math.abs(a - Math.PI / 2) < 1e-9, `got ${a}`);
});

test('a direction at the centre is inside any frontier', () => {
  assert.equal(insideFrontier(CENTRE, CENTRE, 0.12), true);
});

test('a direction beyond theta is outside', () => {
  const off = { x: Math.sin(0.3), y: 0, z: Math.cos(0.3) };
  assert.equal(insideFrontier(CENTRE, off, 0.12), false);
  assert.equal(insideFrontier(CENTRE, off, 0.52), true);
});

test('the boundary is inclusive within a small epsilon', () => {
  const edge = { x: Math.sin(0.12), y: 0, z: Math.cos(0.12) };
  assert.equal(insideFrontier(CENTRE, edge, 0.12), true);
});

test('unnormalised input still works', () => {
  const scaled = { x: 0, y: 0, z: 240 };
  assert.equal(insideFrontier(CENTRE, scaled, 0.05), true);
});

test('a null centre means unbounded, for planetary maps', () => {
  assert.equal(insideFrontier(null, { x: 1, y: 0, z: 0 }, 0.1), true);
});
