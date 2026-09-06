// Optional instrumented player policy. It changes input and legal equipment,
// never health, position, enemies, rewards, wave completion or difficulty.
import * as THREE from '../lib/three.module.min.js';
import { weaponStats } from '../js/run/weapons.js';

export function installAssaultPolicy(W, trace) {
  const mode = W.mode99, g = W.game, p = W.possession, R = W.CONFIG.planetRadius;
  const cautious = window.__qaCautious === true;
  const pressed = new Set(); let firing = false, target = null, route = [], at = 0;
  let refresh = 0, stalled = 0, previous = null, lastGoal = '', previousNestCount = 0;
  let resting = false, lastWeapon = null;
  const metrics = { portalKills: 0, attacks: 0, distance: 0, stalledSeconds: 0, replanCount: 0, commanderDamage: 0, evasions: 0, cautious };
  const oldDamage = W.allies.onDamage;
  W.allies.onDamage = (unit, dealt, killed) => {
    if (unit.type.commander) metrics.commanderDamage += dealt;
    oldDamage?.(unit, dealt, killed);
  };
  const key = (code, down) => {
    if (pressed.has(code) === down) return;
    dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    if (down) pressed.add(code); else pressed.delete(code);
  };
  const fire = down => {
    if (down === firing && p.firing === down) return;
    firing = down;
    if (down) { p.canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, buttons: 1 })); metrics.attacks++; }
    else dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  };
  const stop = () => { for(const code of ['KeyW','KeyS','KeyA','KeyD','ShiftLeft'])key(code,false);fire(false); };
  function equip(commander, family) {
    const eligible = mode.inventory.items.map(item => ({ item, stats: weaponStats(item, commander.typeKey) }))
      .filter(x => x.stats && (family === 'ranged' ? x.item.family === 'carbine' : ['sword', 'spear'].includes(x.item.family)))
      .sort((a, b) => b.stats.dmg / b.stats.cd - a.stats.dmg / a.stats.cd);
    const item = eligible[0]?.item;
    if (!item || item.id === lastWeapon) return;
    if (mode.weapons.request({ kind: 'equip', id: item.id, slot: 0 })) {
      lastWeapon = item.id; trace('assault-weapon', { id: item.id, family: item.family });
    }
  }
  function setGoal(id, dir, kind, entity) {
    const now = W.enemies.time;
    if (id !== lastGoal || now > refresh || !route.length) {
      route = W.nav.findPath(p.unit.dir, dir); at = 0; refresh = now + 5; metrics.replanCount++;
      if (id !== lastGoal) trace('assault-goal', { id, kind, nodes: route.length, cost: route.cost });
      target = { id, dir: dir.clone(), kind, entity }; lastGoal = id;
    }
  }
  function recoveryGoal(unit) {
    if (target?.kind === 'recover' && (!cautious || W.enemies.time < refresh)) { setGoal(target.id, target.dir, 'recover'); return; }
    const centre = W.nav.fieldCenter;
    const side = new THREE.Vector3().crossVectors(centre, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < .001) side.crossVectors(centre, new THREE.Vector3(1, 0, 0));
    side.normalize();
    const forward = new THREE.Vector3().crossVectors(side, centre).normalize();
    const options = [];
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      const dir = centre.clone().addScaledVector(side, Math.cos(angle) * 44 / R)
        .addScaledVector(forward, Math.sin(angle) * 44 / R).normalize();
      const node = W.nav.nearestWalkableNode(dir, true);
      if (node < 0 || !Number.isFinite(W.nav.dist[node])) continue;
      W.nav.nodeDir(node, dir);
      const path = W.nav.findPath(unit.dir, dir);
      if (!path.length || path.cost > 130) continue;
      const clearance = W.enemies.active.filter(e => e.active && !e.dead)
        .reduce((v, e) => Math.min(v, e.dir.angleTo(dir) * R), 80);
      options.push({ dir, score: clearance - path.cost * .18 });
    }
    options.sort((a, b) => b.score - a.score);
    setGoal('recover-away-from-assault', options[0]?.dir || centre, 'recover');
  }
  function aimAt(unit, world) {
    const delta = world.clone().sub(W.allies.worldPos(unit, new THREE.Vector3()));
    const tangent = delta.clone().addScaledVector(unit.dir, -delta.dot(unit.dir)).normalize();
    const right = new THREE.Vector3().crossVectors(unit.fwd, unit.dir).normalize();
    const turn = Math.atan2(tangent.dot(right), tangent.dot(unit.fwd));
    const pitch = Math.asin(THREE.MathUtils.clamp(delta.normalize().dot(unit.dir), -1, 1));
    p.canvas.dispatchEvent(new MouseEvent('mousemove', { buttons: 2, movementX: turn / .0032, movementY: (p.pitch - pitch) / .0032 }));
    return turn;
  }
  return {
    metrics,
    update(dt) {
      const unit = W.allies.active.find(a => a.type.commander && a.active && !a.dead);
      if (!unit || g.state !== 'playing' || mode.run.getPhase() === 'victory') { stop(); return; }
      if (window.__qaTripState !== 'done' || mode.run.getDraft()) { stop(); return; }
      if (!p.active || p.unit !== unit) { p.enter(unit); pressed.clear(); firing = false; }
      if (previous) {
        const moved = previous.angleTo(unit.dir) * R; metrics.distance += moved;
        if (pressed.has('KeyW') && moved < .004) { stalled += dt; metrics.stalledSeconds += dt; } else stalled = 0;
      }
      previous = unit.dir.clone();
      key('KeyA',false);key('KeyD',false);
      const destroyed = W.world.portals.filter(n => n.destroyed).length;
      if (destroyed > previousNestCount) { metrics.portalKills += destroyed - previousNestCount; trace('assault-nest-destroyed', { total: destroyed }); previousNestCount = destroyed; lastGoal = ''; }
      if (!resting && unit.hp < unit.hpMax * (cautious ? .78 : .65)) { resting = true; trace('assault-rest-start', { hp: unit.hp }); }
      if (resting && unit.hp > unit.hpMax * .95) { resting = false; trace('assault-rest-end', { hp: unit.hp }); }
      const pos = W.allies.worldPos(unit, new THREE.Vector3());
      const nearby = W.enemies.active.filter(e => e.active && !e.dead)
        .map(e => ({ enemy: e, pos: W.allies.enemyPos(e, new THREE.Vector3()) }))
        .map(e => ({ ...e, distance: e.pos.distanceTo(pos) })).sort((a, b) => a.distance - b.distance);
      const danger = nearby[0];
      if(cautious){
        // Read the visible locked tells, then try ordinary movement away
        // from their volume. Position, speed, health and damage stay owned
        // by the game; an obstructed sidestep can still fail.
        const tells=nearby.filter(x=>x.enemy.windT>0&&x.enemy.attackPlan&&mode.threats.contains(x.enemy,pos));
        if(tells.length){
          const right=new THREE.Vector3().crossVectors(unit.fwd,unit.dir).normalize();
          const candidates=[['KeyD',right],['KeyA',right.clone().negate()],['KeyS',unit.fwd.clone().negate()],['KeyW',unit.fwd.clone()]].map(([code,dir])=>{
            const point=pos.clone().addScaledVector(dir,unit.type.speed*.2),node=W.nav.nearestWalkableNode(point.clone().normalize(),true);
            const safe=tells.filter(x=>!mode.threats.contains(x.enemy,point)).length;
            const clearance=nearby.slice(0,8).reduce((n,x)=>Math.min(n,x.pos.distanceTo(point)),20);
            return {code,score:node>=0&&Number.isFinite(W.nav.dist[node])?safe*100+clearance:-1000};
          }).sort((a,b)=>b.score-a.score);
          stop();key(candidates[0].code,true);key('ShiftLeft',!unit.swimming);metrics.evasions++;return;
        }
      }
      const nestNodes = W.waves.liveNests();
      const nests = W.world.portals.filter(n => !n.destroyed && nestNodes.includes(n.node));
      const hunting = !resting && mode.run.getWave() <= 12 && nests.length && unit.hp > unit.hpMax * .6;
      if (resting) {
        recoveryGoal(unit);
      } else if (hunting) {
        if (target?.kind !== 'nest' || target.entity.destroyed || !nestNodes.includes(target.entity.node)) {
          const options = nests.map(n => ({ nest: n, dir: n.group.position.clone().normalize() }))
            .map(x => ({ ...x, path: W.nav.findPath(unit.dir, x.dir) }))
            .filter(x => x.path.length).sort((a, b) => a.path.cost - b.path.cost);
          if (options[0]) setGoal('nest-' + options[0].nest.node, options[0].dir, 'nest', options[0].nest);
        } else setGoal(target.id, target.dir, 'nest', target.entity);
      } else {
        const threats = nearby.filter(x => x.pos.distanceTo(W.heartPos) < 36).sort((a, b) => a.pos.distanceTo(W.heartPos) - b.pos.distanceTo(W.heartPos));
        if (threats[0]) setGoal('enemy-' + threats[0].enemy.id, threats[0].enemy.dir, 'enemy', threats[0].enemy);
        else setGoal('guard-heart', W.nav.fieldCenter, 'guard');
      }
      if (!target) { stop(); return; }
      const nestDistance = target.kind === 'nest' ? target.entity.group.position.distanceTo(pos) : Infinity;
      equip(unit, nestDistance < 8 || danger?.distance < 4 ? 'melee' : 'ranged');
      const spec = unit.type.strike;
      const inMelee = danger && danger.distance < (cautious ? (spec.radius || 3)-.15 : 4);
      if (!resting && ((target.kind === 'nest' && nestDistance < (spec.radius || 3) + 2) || inMelee)) {
        key('KeyW', false); key('KeyS', false); key('ShiftLeft', false);
        aimAt(unit, inMelee ? danger.pos : target.entity.group.position); fire(true); return;
      }
      if (!hunting && danger && !resting && ['projectile', 'hitscan'].includes(spec.kind) && danger.distance < spec.range * .8) {
        const turn = aimAt(unit, danger.pos); key('KeyW', false); key('KeyS', danger.distance < 5.5); key('ShiftLeft', false); fire(Math.abs(turn) < .12); return;
      }
      fire(false); key('KeyS', false);
      if (unit.dir.angleTo(target.dir) * R < 1.8) { key('KeyW', false); key('ShiftLeft', false); return; }
      let goal = target.dir;
      while (at < route.length) {
        const point = W.nav.nodeDir(route[at], new THREE.Vector3());
        if (unit.dir.angleTo(point) * R > .32) { goal = point; break; }
        at++;
      }
      const goalWorld = goal.clone().multiplyScalar(pos.length());
      const turn = aimAt(unit, goalWorld); key('KeyW', Math.abs(turn) < .6); key('ShiftLeft', Math.abs(turn) < .25 && !unit.swimming && (resting || !(danger?.distance < 7)));
      if (stalled > 2) {
        trace('assault-movement-stall', { goal: target.id, node: route[at], elapsed: stalled });
        refresh = 0; route = []; stalled = 0;
        // Space is an ordinary jump attempt. The controller still validates
        // every movement step; this cannot teleport through a blocked route.
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      }
    },
  };
}
