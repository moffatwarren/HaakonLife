// The Pong rules on their own, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pong from '../games/pong.js';
import { seeded } from '../rooms.js';

const game = (seed = 1) => pong.create({ seats: 2, rng: seeded(seed), soft: false });
const run = (s, ticks, each) => {
  for (let i = 0; i < ticks; i++) {
    if (each) each(s);
    const r = pong.tick(s);
    if (r) return r;
  }
};

test('nobody moving: someone wins 5 to something, and the game ends', () => {
  const s = game();
  const r = run(s, 30 * 300);
  assert.ok(r, 'it finished');
  assert.equal(r.sc[r.w], 5);
  assert.ok(r.sc[1 - r.w] < 5);
});

test('it waits before the first serve', () => {
  const s = game(), x = s.ball.x;
  run(s, 50); // 100 steps: 75 getting ready and 25 of the serve's 40
  assert.equal(s.ball.x, x);
  assert.equal(pong.view(s, 0).ph, 1);
  run(s, 10);
  assert.notEqual(s.ball.x, x);
});

test('two players who follow the ball keep a rally going', () => {
  const s = game(3);
  const follow = (st) => {
    for (const seat of [0, 1]) pong.input(st, seat, { y: st.ball.y - 12 });
  };
  const r = run(s, 30 * 60, follow);
  assert.equal(r, undefined, 'nobody missed in a minute');
  assert.ok(s.bn > 10, 'lots of hits');
  assert.deepEqual(s.sc, [0, 0]);
});

test('a paddle only follows its player so fast, and stays on the table', () => {
  const s = game();
  const y0 = s.pad[0];
  pong.input(s, 0, { y: -1000 });
  pong.tick(s); // two steps
  assert.equal(s.pad[0], y0 - 12);
  run(s, 40);
  assert.equal(s.pad[0], 34);
  for (const bad of [null, 'x', { y: 'up' }, { y: NaN }, { y: Infinity }]) pong.input(s, 1, bad);
  assert.equal(s.want[1], s.pad[1]);
});

test('each player sees themselves on the left', () => {
  const s = game();
  run(s, 60);
  pong.input(s, 1, { y: 100 });
  s.sc = [2, 4];
  run(s, 10);
  const a = pong.view(s, 0), b = pong.view(s, 1);
  assert.equal(a.me, b.them);
  assert.equal(a.them, b.me);
  assert.equal(b.me, 100);
  assert.equal(Math.round(a.bx + b.bx + 4), 320);
  assert.equal(a.vx, -b.vx);
  assert.deepEqual([a.sc, b.sc], [[2, 4], [4, 2]]);
  assert.deepEqual([a.s, b.s], [0, 1]);
});
