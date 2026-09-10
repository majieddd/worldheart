import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
globalThis.location = { search: '?map=ninetynine' };
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
registerHooks({ resolve(spec, context, next) {
  if (spec === 'three') return { url: new URL('../../lib/three.module.min.js', import.meta.url).href, shortCircuit: true };
  return next(spec, context);
} });
const THREE = await import('../../lib/three.module.min.js');
const { OrbitRig } = await import('../../js/camera.js');
const focus = r => new THREE.Vector3(Math.sin(r.lon) * Math.cos(r.lat), Math.sin(r.lat), Math.cos(r.lon) * Math.cos(r.lat));
function rigAt(lat, lon = 0, yaw = 0) {
  const r = new OrbitRig({ clientHeight: 720, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) });
  r.lat = lat; r.lon = lon; r.viewYaw = yaw; r.dist = r.targetDist = 35; r.setAspect(1280 / 720); r.update(0);
  return r;
}
test('arrow navigation crosses both poles without an orientation jump or latitude barrier', () => {
  for (const sign of [1, -1]) for (const fps of [30, 60, 120]) {
    const r = rigAt(sign * 1.2, 1.2, sign > 0 ? 0 : Math.PI), q = r.camera.quaternion.clone();
    r.keys.add('ArrowUp'); let peak = 0;
    for (let i = 0; i < fps * 3; i++) {
      r.update(1 / fps); peak = Math.max(peak, Math.abs(r.lat));
      assert.ok(q.angleTo(r.camera.quaternion) < .02); q.copy(r.camera.quaternion);
    }
    // Discrete 30 Hz samples can straddle the pole by half a bounded step.
    // The changed meridian proves crossing; exact focus is checked below.
    assert.ok(peak > Math.PI / 2 - .01, JSON.stringify({ sign, fps, peak, lat: r.lat, lon: r.lon })); assert.ok(Math.abs(r.lon - 1.2) > 2);
    r.keys.clear(); const end = focus(r); r.update(1); assert.ok(end.distanceTo(focus(r)) < 1e-12);
  }
});
test('released drag traverses a pole with bounded inertia and frame-rate-independent decay', () => {
  const ends = [];
  for (const fps of [30, 60, 120]) {
    const r = rigAt(1.56), start = focus(r), q = r.camera.quaternion.clone();
    r.pointerDt = 1 / 60; r.panPixels(0, 10, true);
    for (let i = 0; i < fps * 2; i++) {
      r.update(1 / fps); assert.ok(q.angleTo(r.camera.quaternion) < .08); q.copy(r.camera.quaternion);
    }
    assert.ok(start.angleTo(focus(r)) > .02); assert.ok(Math.abs(r.lon) > 2);
    assert.ok(Math.hypot(r.velLon, r.velLat) < 1e-4); ends.push(focus(r));
  }
  assert.ok(ends[0].distanceTo(ends[1]) < 1e-10 && ends[0].distanceTo(ends[2]) < 1e-10);
});
test('focus flights reach exact poles and take the short route across the date line', () => {
  for (const sign of [1, -1]) {
    const r = rigAt(sign * 1.4), pole = new THREE.Vector3(0, sign, 0);
    r.flyTo(pole, 35, .5); for (let i = 0; i < 31; i++) r.update(1 / 60);
    assert.ok(focus(r).distanceTo(pole) < 1e-12);
    const pixel = pole.clone().multiplyScalar(r.focusRadius).project(r.camera);
    assert.ok(Math.hypot(pixel.x, pixel.y) < 1e-10);
  }
  const r = rigAt(.3, Math.PI - .05), target = focus(rigAt(.3, -Math.PI + .05)), start = focus(r);
  r.flyTo(target, 35, 1); r.update(.5);
  assert.ok(start.angleTo(focus(r)) < .06); r.update(.5); assert.ok(focus(r).distanceTo(target) < 1e-12);
});
test('polar confinement stays continuous and handles an exactly antipodal focus', () => {
  for (const sign of [1, -1]) {
    const r = rigAt(sign * Math.PI / 2), center = new THREE.Vector3(0, sign, 0);
    r.confine = { center, maxAng: .15 }; r.keys.add('ArrowLeft');
    for (let i = 0; i < 240; i++) { r.update(1 / 60); assert.ok(focus(r).angleTo(center) <= .1500001); }
    r.keys.clear(); r.lat = -sign * Math.PI / 2; r.update(0);
    assert.ok(focus(r).angleTo(center) <= .1500001); assert.ok(r.camera.matrixWorld.elements.every(Number.isFinite));
  }
});
test('exact overhead framing retains yaw at the equator and both poles', () => {
  for (const lat of [0, Math.PI / 2, -Math.PI / 2]) {
    const r = rigAt(lat); r.heightProbe = () => 0; r.visibilityLift = Math.PI;
    r._placeCamera(); const q = r.camera.quaternion.clone(); r.viewYaw += Math.PI / 2; r._placeCamera();
    assert.ok(Math.abs(q.angleTo(r.camera.quaternion) - Math.PI / 2) < 1e-10);
    assert.ok(r.camera.matrixWorld.elements.every(Number.isFinite));
  }
});
test('skipping and completing an intro land on the same polar heading', () => {
  for (const sign of [1, -1]) {
    const target = new THREE.Vector3(0, sign, 0), a = rigAt(.2), b = rigAt(.2);
    a.introFlight(target); b.introFlight(target); a.skipFlight(); a.update(0);
    for (let i = 0; i < 241; i++) b.update(1 / 60);
    assert.ok(focus(a).distanceTo(target) < 1e-12 && focus(b).distanceTo(target) < 1e-12);
    assert.ok(a.camera.quaternion.angleTo(b.camera.quaternion) < 1e-6);
  }
});
