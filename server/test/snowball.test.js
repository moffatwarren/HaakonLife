// The two-player snowball fight's rules on their own, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sb from '../games/snowball.js';
import { seeded } from '../rooms.js';

// a game past "Get ready"
function game(soft = false) {
  const s = sb.create({ seats: 2, rng: seeded(1), soft });
  s.ready = 75;
  return s;
}
const run = (s, ticks, each) => {
  for (let i = 0; i < ticks; i++) {
    if (each) each(s);
    const r = sb.tick(s);
    if (r) return r;
  }
};
// seat throws (from x on their own screen, standing up)
const toss = (s, seat, x) => sb.input(s, seat, { x, d: 0, n: s.p[seat].n + 1 });

test('nobody throwing: it runs 90 seconds and nobody wins', () => {
  const s = sb.create({ seats: 2, rng: seeded(1), soft: false });
  assert.equal(sb.view(s, 0).ph, 0);
  const r = run(s, 30 * 95);
  assert.deepEqual(r, { w: -1, hp: [3, 3], hits: [0, 0] });
});

test('a snowball hits whoever is standing where it lands, and takes a moment to get there', () => {
  const s = game();
  toss(s, 0, 160);
  sb.tick(s);
  assert.equal(s.p[0].ammo, 4);
  assert.equal(s.balls.length, 1);
  const dur = s.balls[0].dur;
  assert.ok(dur >= 40, 'about two thirds of a second across the lot');
  run(s, Math.ceil(dur / 2) - 2);
  assert.equal(s.p[1].hearts, 3, 'not there yet');
  run(s, 2);
  assert.equal(s.balls.length, 0);
  assert.equal(s.p[1].hearts, 2);
  assert.equal(s.p[0].hits, 1);
});

test('ducking or stepping aside gets out of the way', () => {
  const s = game();
  sb.input(s, 1, { d: 1 });
  toss(s, 0, 160);
  run(s, 30);
  assert.equal(s.p[1].hearts, 3);
  assert.equal(s.p[1].tap, 1, 'it hit the wall in front of them');
  sb.input(s, 1, { x: 190, d: 0 }); // their 190 is the thrower's 130
  toss(s, 0, 160);
  run(s, 30);
  assert.equal(s.p[1].x, 130);
  assert.equal(s.p[1].hearts, 3);
  assert.equal(s.p[1].tap, 1, 'it missed altogether');
});

test('five snowballs, then ducking packs another', () => {
  const s = game();
  for (let i = 0; i < 6; i++) { toss(s, 0, 40); run(s, 7); }
  assert.equal(s.p[0].ammo, 0);
  assert.equal(s.id, 5, 'the sixth throw had nothing to throw');
  sb.input(s, 0, { d: 1 });
  run(s, 13);
  assert.equal(s.p[0].ammo, 0);
  run(s, 1);
  assert.equal(s.p[0].ammo, 1);
  toss(s, 0, 40); // still ducking on the server: a throw only counts standing up
  sb.input(s, 0, { d: 1 });
  run(s, 2);
  assert.equal(s.id, 5);
});

test('three hits and you are out; the next one only brushes you for a moment after a hit', () => {
  const s = game();
  toss(s, 1, 160);
  run(s, 6); toss(s, 1, 160); // lands 12 steps after the first, while they're still reeling
  run(s, 30);
  assert.equal(s.p[0].hearts, 2);
  assert.equal(s.p[0].tap, 1);
  let r;
  for (let i = 0; i < 2 && !r; i++) { toss(s, 1, 160); r = run(s, 40); }
  assert.deepEqual(r, { w: 1, hp: [0, 3], hits: [0, 3] });
});

test('each player sees themselves behind the near wall', () => {
  const s = game(true);
  sb.input(s, 0, { x: 100 });
  sb.input(s, 1, { x: 100, d: 1 });
  run(s, 10);
  toss(s, 0, 100);
  run(s, 10);
  const a = sb.view(s, 0), b = sb.view(s, 1);
  assert.deepEqual([a.me.x, a.th.x, b.me.x, b.th.x], [100, 220, 100, 220]);
  assert.deepEqual([a.me.d, a.th.d, b.me.d, b.th.d], [0, 1, 1, 0]);
  assert.equal(a.b.length, 1);
  assert.deepEqual([a.b[0][1], a.b[0][2]], [1, 100]);
  assert.deepEqual([b.b[0][1], b.b[0][2]], [0, 220]);
  assert.equal(a.b[0][4], 50, 'slower on a touch screen');
  assert.equal(a.me.n, 1);
});

test('someone only moves so fast, stays on their wall, and bad input changes nothing', () => {
  const s = game();
  sb.input(s, 0, { x: 1000 });
  sb.tick(s);
  assert.equal(s.p[0].x, 168);
  run(s, 40);
  assert.equal(s.p[0].x, 300);
  for (const bad of [null, 'x', 7, { x: 'left' }, { x: NaN }, { x: Infinity }, { n: 1.5 }, { n: '3' }]) sb.input(s, 1, bad);
  assert.equal(s.p[1].want, 160);
  assert.equal(s.p[1].n, 0);
  sb.input(s, 1, { n: 50 });
  assert.equal(s.p[1].q, 2, 'a burst only queues two');
});
