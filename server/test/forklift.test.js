// The two-player Forklift Rush rules on their own, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fl from '../games/forklift.js';
import { seeded } from '../rooms.js';

// a game past "Get ready", with the forklifts put wherever a test wants them
function game(seed = 1) {
  const s = fl.create({ seats: 2, rng: seeded(seed), soft: false });
  s.ready = 75;
  return s;
}
const place = (L, x, y, a, extra) => Object.assign(L, { x, y, a, v: 0, wheel: 0, armed: true }, extra);
const hold = (s, seat, keys) => fl.input(s, seat, { h: (keys.includes('u') ? 1 : 0) | (keys.includes('d') ? 2 : 0) });
const run = (s, ticks) => { for (let i = 0; i < ticks; i++) { const r = fl.tick(s); if (r) return r; } };
// park the other forklift out of the way, by the far pillar
const park = (s, seat) => place(s.lifts[seat], 118, 200, Math.PI);
const kinds = (s) => { const n = [0, 0, 0, 0]; for (const p of s.pallets) n[p.k]++; return n; };
const UP = -Math.PI / 2, LEFT = Math.PI, RIGHT = 0;

test('it starts with the usual racks, and calls for a kind there are two of', () => {
  for (let seed = 1; seed < 20; seed++) {
    const s = game(seed);
    assert.equal(s.pallets.length, 9);
    assert.ok(kinds(s)[s.order] >= 2);
  }
});

test('driving the forks under a pallet picks it up', () => {
  const s = game();
  park(s, 1);
  const bay0 = s.pallets.find((p) => p.b === 0);
  place(s.lifts[0], 24, 80, UP);
  hold(s, 0, 'u');
  run(s, 30);
  assert.equal(s.lifts[0].load, bay0.k);
  assert.ok(!s.pallets.includes(bay0));
});

test('the right pallet in the truck scores, then there is a new call and a restock', () => {
  const s = game();
  park(s, 1);
  const before = s.pallets.length;
  place(s.lifts[0], 250, 120, RIGHT, { load: s.order });
  hold(s, 0, 'u');
  run(s, 20);
  assert.deepEqual(s.sc, [1, 0]);
  assert.equal(s.lifts[0].load, -1);
  assert.equal(s.pallets.length, before + 1);
});

test('the wrong pallet in the truck stalls you', () => {
  const s = game();
  park(s, 1);
  place(s.lifts[0], 250, 120, RIGHT, { load: (s.order + 1) % 4 });
  hold(s, 0, 'u');
  run(s, 20);
  assert.deepEqual(s.sc, [0, 0]);
  assert.ok(s.lifts[0].stall > 0);
  assert.notEqual(s.lifts[0].load, -1, 'still on the forks');
});

test('empty forks driven into their pallet steal it, and it cannot be stolen straight back', () => {
  const s = game();
  const [a, b] = s.lifts;
  // b carries a COIL facing right; a comes at it from the right, facing left
  place(b, 120, 100, RIGHT, { load: 1 });
  place(a, 160, 100, LEFT);
  hold(s, 0, 'u');
  run(s, 30);
  assert.equal(a.load, 1, 'a has it');
  assert.equal(b.load, -1);
  assert.ok(s.ev.some((e) => e.k === 'steal' && e.s === 0));
  // b drives straight back in, but the pallet's guarded for a moment
  hold(s, 0, '');
  hold(s, 1, 'u');
  run(s, 10);
  assert.equal(a.load, 1, 'still a\'s');
});

test('forklifts push each other instead of driving through', () => {
  const s = game();
  const [a, b] = s.lifts;
  place(a, 118, 100, RIGHT);
  place(b, 150, 100, LEFT);
  hold(s, 0, 'u'); hold(s, 1, 'u');
  run(s, 60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 12, 'they never overlap');
});

test('wheels turn a notch a press, and straighten on A', () => {
  const s = game();
  park(s, 1);
  fl.input(s, 0, { h: 0, e: 'rrr' });
  run(s, 1);
  assert.equal(s.lifts[0].wheel, 3);
  fl.input(s, 0, { h: 0, e: 'a' });
  run(s, 1);
  assert.equal(s.lifts[0].wheel, 0);
  for (const bad of [null, 'x', { h: 'up' }, { e: 5 }]) fl.input(s, 0, bad);
});

test('A sets the pallet down where you are, and the forks can pick it back up', () => {
  const s = game();
  const L = s.lifts[0];
  park(s, 1);
  const before = s.pallets.length;
  place(L, 120, 100, RIGHT, { load: 2, wheel: 3 });
  fl.input(s, 0, { h: 0, e: 'a' });
  fl.tick(s);
  assert.equal(L.load, -1);
  assert.equal(L.wheel, 0);
  assert.equal(s.pallets.length, before + 1);
  const dropped = s.pallets.at(-1);
  assert.equal(dropped.k, 2);
  assert.ok(Math.abs(dropped.x - 133) < 2 && dropped.y === 100, 'just ahead of the forklift');
  assert.ok(s.ev.some((e) => e.k === 'putt' && e.s === 0));
  const v = fl.view(s, 0);
  assert.deepEqual([v.f.length, v.f[2]], [3, 2], 'sent apart from the racks');
  assert.equal(v.p.length, before * 2);
  // it doesn't jump straight back on: back off, then drive in again
  fl.tick(s);
  assert.equal(L.load, -1);
  hold(s, 0, 'd');
  run(s, 30);
  assert.ok(L.armed);
  hold(s, 0, 'u');
  run(s, 60);
  assert.equal(L.load, 2);
  assert.ok(!s.pallets.includes(dropped));
  assert.equal(fl.view(s, 0).f.length, 0);
});

test('a pallet set down stops forklifts like one on the racks', () => {
  const s = game();
  const L = s.lifts[0];
  park(s, 1);
  s.pallets.push({ x: 140, y: 100, k: 1 });
  place(L, 100, 100, RIGHT, { load: 0 });
  hold(s, 0, 'u');
  run(s, 60);
  assert.equal(L.load, 0);
  assert.ok(L.x + 10 + 7 <= 132 + 0.5, 'the pallet on the forks stops at it');
});

test('a pallet set down against a wall lands clear of it', () => {
  const s = game();
  const L = s.lifts[0];
  park(s, 1);
  s.steve.y = s.steve.to = 200; s.steve.wait = 1000;
  // nose up against the dock wall, which starts at x 262
  place(L, 245, 40, RIGHT, { load: 3 });
  fl.input(s, 0, { h: 0, e: 'a' });
  run(s, 5);
  assert.equal(L.load, -1);
  const dropped = s.pallets.at(-1);
  assert.ok(dropped.x + 8 <= 262, 'not in the wall');
  assert.ok(L.x < 245, 'the forklift backs off it');
});

test('nothing can be set down on the truck, or while stalled', () => {
  const s = game();
  const L = s.lifts[0];
  park(s, 1);
  const before = s.pallets.length;
  place(L, 270, 120, RIGHT, { load: (s.order + 1) % 4, armed: false });
  fl.input(s, 0, { h: 0, e: 'a' });
  fl.tick(s);
  assert.notEqual(L.load, -1);
  assert.equal(s.pallets.length, before);
  assert.ok(s.ev.some((e) => e.k === 'noroom' && e.s === 0));
  place(L, 120, 100, RIGHT, { load: 1, stall: 30 });
  fl.input(s, 0, { h: 0, e: 'a' });
  fl.tick(s);
  assert.equal(L.load, 1);
});

test('it can be set down in a squeeze only if it fits', () => {
  const s = game();
  const L = s.lifts[0];
  park(s, 1);
  // a pallet each side of where this one would land leaves no room for it
  s.pallets.push({ x: 134, y: 86, k: 0 }, { x: 134, y: 114, k: 0 });
  place(L, 120, 100, RIGHT, { load: 1 });
  fl.input(s, 0, { h: 0, e: 'a' });
  fl.tick(s);
  assert.equal(L.load, 1);
  assert.ok(s.ev.some((e) => e.k === 'noroom'));
});

test('Steve never walks through a pallet left on the crosswalk', () => {
  for (let seed = 1; seed < 6; seed++) {
    const s = game(seed);
    place(s.lifts[0], 118, 100, RIGHT);
    park(s, 1);
    s.pallets.push({ x: 238, y: 130, k: 0 });
    s.left = 100000;
    for (let i = 0; i < 2000; i++) {
      fl.tick(s);
      assert.ok(Math.abs(s.steve.y - 130) >= 13.9, 'he stays clear of it');
    }
  }
});

test('a rack bay with a pallet set down over it is not restocked', () => {
  const s = game();
  park(s, 1);
  // every bay full, bar one with a pallet sitting over it
  s.pallets = fl.BAYS.flatMap((b, i) => (i === 3 ? [{ x: b.x + 4, y: b.y + 4, k: 0 }] : [{ x: b.x, y: b.y, b: i, k: 0 }]));
  const before = s.pallets.length;
  place(s.lifts[0], 250, 120, RIGHT, { load: s.order });
  hold(s, 0, 'u');
  run(s, 20);
  assert.deepEqual(s.sc, [1, 0]);
  assert.equal(s.pallets.length, before);
});

test('when time is up, most pallets loaded wins', () => {
  const s = game();
  s.sc = [3, 5];
  s.left = 10;
  const r = run(s, 10);
  assert.deepEqual(r, { w: 1, sc: [3, 5] });
  const t = game();
  t.sc = [2, 2]; t.left = 4;
  assert.equal(run(t, 10).w, -1, 'a tie');
});

test('each player is sent the whole warehouse and which forklift is theirs', () => {
  const s = game();
  run(s, 5);
  const v0 = fl.view(s, 0), v1 = fl.view(s, 1);
  assert.deepEqual([v0.s, v1.s], [0, 1]);
  assert.equal(v0.l.length, 2);
  assert.equal(v0.p.length, 18);
  assert.deepEqual(JSON.parse(JSON.stringify(v0)), v0);
});
