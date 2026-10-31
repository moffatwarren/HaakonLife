// Live hockey's lobby and game on their own, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as hockey from '../tables/hockey.js';
import { seeded } from '../rooms.js';

const { one, two } = hockey;
const table = (kind, seed = 1) => kind.create({ rng: seeded(seed) });
const ids = (s) => s.slots.map((q) => q && q.id);
// everyone presses start, and the game begins on the next tick
function begin(kind, s) {
  for (const id of kind.seated(s)) kind.input(s, id, { go: true });
  kind.tick(s);
  assert.equal(s.ph, 'play');
}
// tick until something's true (or give up)
const until = (kind, s, ok, max = 20000) => {
  for (let i = 0; i < max && !ok(s); i++) kind.tick(s);
  assert.ok(ok(s), 'it got there');
};

test('the engine loads from the site\'s files', () => {
  const e = hockey.load();
  assert.ok(e && e.HOCKEY && e.yard, 'js/hockey.js and the parking lot from js/maps.js');
});

test('a game saved and loaded into another carries on exactly the same', () => {
  const { HOCKEY, yard } = hockey.load();
  assert.match(HOCKEY.VERSION, /^[0-9a-z]+$/);
  const players = [{ name: 'A', team: 0 }, { name: 'B', team: 1, ai: true }, { name: 'C', team: 0, ai: true }, { name: 'D', team: 1 }];
  const g = HOCKEY.create(yard, { seed: 7, players }), rng = seeded(3);
  const inputs = () => g.players.map(() => ({ x: rng() * 2 - 1, y: rng() * 2 - 1, shoot: rng() < 0.3, pass: rng() < 0.05 }));
  const play = (gm, ins) => { gm.step(ins); if (gm.due() && !gm.over()) gm.faceoff(); };
  // well into a game, with checks, shots and the computer's players thinking
  for (let i = 0; i < 3000; i++) play(g, inputs());
  const h = HOCKEY.create(yard, { seed: 99, players });
  h.load(JSON.parse(JSON.stringify(g.save())));
  // (as JSON, which has no -0)
  const same = () => JSON.stringify(h.save()) === JSON.stringify(g.save());
  assert.ok(same());
  for (let i = 0; i < 2000; i++) { const ins = inputs(); play(g, ins); play(h, ins); }
  assert.ok(same(), 'the same 2000 ticks later');
  assert.deepEqual(h.score, g.score);
});

test('players fill the lobby a team at a time, and the next is told it\'s full', () => {
  const s = table(two);
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(two.sit(s, id, id), true);
  assert.deepEqual(ids(s), ['a', 'b', 'c', 'd']);
  assert.equal(two.sit(s, 'e', 'e'), 'full');
  assert.equal(two.sit(s, 'a', 'a'), true, 'sitting again where you already are is fine');
  two.stand(s, 'b');
  assert.equal(two.sit(s, 'e', 'e'), true);
  assert.deepEqual(ids(s), ['a', 'e', 'c', 'd'], 'into the team that\'s a player short');
});

test('nobody can start until every spot is taken and everyone has pressed start', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann');
  one.input(s, 'a', { go: true });
  for (let i = 0; i < 30; i++) one.tick(s);
  assert.equal(s.ph, 'lobby', 'waiting for a second player');
  assert.equal(one.view(s, 'a').slots[0].r, true);
  one.sit(s, 'b', 'Bob');
  one.tick(s);
  assert.equal(s.ph, 'lobby', 'Bob hasn\'t pressed start');
  one.input(s, 'b', { go: true });
  one.tick(s);
  assert.equal(s.ph, 'play');
  assert.deepEqual(s.g.players.map((p) => [p.name, p.team, p.ai]), [['Ann', 0, false], ['Bob', 1, false]]);
  assert.equal(one.sit(s, 'c', 'Cat'), 'busy', 'nobody new while a game\'s on');
});

test('two or three players can start a two on two with the computer in the empty spots', () => {
  const s = table(two);
  two.sit(s, 'a', 'Ann');
  two.input(s, 'a', { go: true });
  for (let i = 0; i < 400; i++) two.tick(s);
  assert.equal(s.ph, 'lobby', 'not on your own');
  assert.equal(two.view(s, 'a').cd, 0);
  two.sit(s, 'b', 'Bob');
  two.input(s, 'b', { mv: 'left' });
  two.input(s, 'b', { go: true });
  two.tick(s);
  assert.equal(s.ph, 'lobby', 'a moment for anyone else to turn up');
  assert.equal(two.view(s, 'a').cd, 5, 'seconds to go');
  for (let i = 0; i < 5 * two.hz - 2; i++) two.tick(s);
  assert.equal(s.ph, 'lobby');
  assert.equal(two.view(s, 'b').cd, 1);
  two.tick(s);
  assert.equal(s.ph, 'play');
  assert.deepEqual(s.g.players.map((p) => [p.name, p.team, p.ai]), [['Ann', 0, false], ['CPU', 1, true], ['Bob', 0, false], ['CPU', 1, true]]);
  const who = two.view(s, 'a').who;
  assert.deepEqual(who.map((w) => w.id), ['a', null, 'b', null]);
  assert.ok(who.every((w) => (w.id ? w.c === undefined : Number.isInteger(w.c))), 'a number to pick a coworker by, for the computer\'s');
  two.stand(s, 'a');
  assert.equal(s.ph, 'play', 'Bob\'s still out there');
  two.stand(s, 'b');
  assert.equal(s.ph, 'lobby', 'nobody but the computer left: called off');
});

test('someone turning up stops the computer filling in, and so does taking start back', () => {
  const s = table(two);
  two.sit(s, 'a', 'Ann'); two.sit(s, 'b', 'Bob');
  two.input(s, 'a', { go: true }); two.input(s, 'b', { go: true });
  for (let i = 0; i < 100; i++) two.tick(s);
  two.sit(s, 'c', 'Cat');
  two.tick(s);
  assert.equal(two.view(s, 'a').cd, 0, 'Cat hasn\'t pressed start');
  two.input(s, 'c', { go: true });
  for (let i = 0; i < 100; i++) two.tick(s);
  assert.equal(two.view(s, 'a').cd, 2, 'counting from the start again');
  two.input(s, 'a', { go: false });
  two.tick(s);
  assert.equal(two.view(s, 'a').cd, 0, 'Ann would rather wait for a fourth');
  for (let i = 0; i < 400; i++) two.tick(s);
  assert.equal(s.ph, 'lobby');
  two.sit(s, 'd', 'Dan');
  two.input(s, 'a', { go: true }); two.input(s, 'd', { go: true });
  two.tick(s);
  assert.equal(s.ph, 'play', 'full, so straight away');
  assert.ok(s.g.players.every((p) => !p.ai));
});

test('moving to the other team takes a free spot, or swaps with whoever\'s level', () => {
  const s = table(two);
  two.sit(s, 'a', 'a'); two.sit(s, 'b', 'b'); two.sit(s, 'c', 'c');
  assert.deepEqual(ids(s), ['a', 'b', 'c', null]);
  two.input(s, 'a', { go: true });
  two.input(s, 'a', { mv: 'right' });
  assert.deepEqual(ids(s), [null, 'b', 'c', 'a'], 'the free spot on the right, behind b');
  assert.equal(s.slots[3].r, false, 'moving means pressing start again');
  two.input(s, 'a', { mv: 'right' });
  assert.deepEqual(ids(s), [null, 'b', 'c', 'a'], 'already on the right');
  two.input(s, 'a', { mv: 'down' });
  assert.deepEqual(ids(s), [null, 'a', 'c', 'b'], 'swapped rows with b');
  two.sit(s, 'd', 'd');
  assert.deepEqual(ids(s), ['d', 'a', 'c', 'b']);
  two.input(s, 'b', { go: true }); two.input(s, 'd', { go: true });
  two.input(s, 'c', { mv: 'right' });
  assert.deepEqual(ids(s), ['d', 'a', 'b', 'c'], 'full, so c and b swap teams');
  assert.equal(s.slots[2].r, false, 'b was moved, so b presses start again too');
  assert.equal(s.slots[0].r, true, 'nobody else');
  two.input(s, 'c', { mv: 'up' });
  assert.deepEqual(ids(s), ['d', 'a', 'b', 'c'], 'already in the back row');
});

test('one on one has just the two spots to swap between', () => {
  const s = table(one);
  one.sit(s, 'a', 'a');
  one.input(s, 'a', { mv: 'right' });
  assert.deepEqual(ids(s), [null, 'a']);
  one.input(s, 'a', { mv: 'up' });
  assert.deepEqual(ids(s), [null, 'a']);
  one.sit(s, 'b', 'b');
  assert.deepEqual(ids(s), ['b', 'a']);
  one.input(s, 'b', { mv: 'right' });
  assert.deepEqual(ids(s), ['a', 'b']);
});

test('steering moves your skater, and a tap of A too quick for a tick still shoots', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  until(one, s, () => s.g.phase === 'play');
  const p = s.g.players[0], y0 = p.y;
  one.input(s, 'a', { x: 0, y: -1, a: 0, ap: 0, bp: 0 });
  for (let i = 0; i < 30; i++) one.tick(s);
  assert.ok(p.y < y0 - 2, 'skated up the ice');
  // give Ann the puck, then press and let go of A between two ticks
  const g = s.g;
  one.input(s, 'a', { x: 0, y: 0, a: 0, ap: 0, bp: 0 });
  Object.assign(g.puck, { owner: p, past: [] });
  one.input(s, 'a', { x: 0, y: 0, a: 1, ap: 1, bp: 0 });
  one.input(s, 'a', { x: 0, y: 0, a: 0, ap: 1, bp: 0 });
  one.tick(s);
  assert.equal(g.puck.owner, null, 'shot');
  assert.ok(s.ev.some((e) => e.e === 'shot' && e.p === 0));
  assert.ok(one.view(s, 'a').ev.some((e) => e.e === 'shot'), 'the shot goes out to everyone');
});

test('B presses are counted too: each one is a pass or a check', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  until(one, s, () => s.g.phase === 'play');
  one.input(s, 'b', { x: 0, y: 1, a: 0, ap: 0, bp: 1 });
  one.tick(s);
  assert.equal(s.g.players[1].act && s.g.players[1].act.k, 'check');
  one.input(s, 'b', { x: 0, y: 1, a: 0, ap: 0, bp: 1 });
  assert.equal(s.hold[1].passes, 0, 'the same count again isn\'t another press');
  one.input(s, 'b', { x: 0, y: 1, a: 0, ap: 0, bp: 2 });
  assert.equal(s.hold[1].passes, 1);
});

test('input a tick at a time is taken a tick at a time, and each player\'s told how far it\'s got', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  until(one, s, () => s.g.phase === 'play');
  const p = s.g.players[0];
  one.input(s, 'a', { q: 1, i: [[0, -1, 0, 0], [0, -1, 0, 0], [0, -1, 0, 1], [0, -1, 0, 0], [0, -1, 0, 0]] });
  one.input(s, 'a', { q: 1, i: [[1, 0, 0, 1]] }); // one it's had already
  one.tick(s);
  assert.equal(one.view(s, 'a').aq, 2);
  assert.equal(one.view(s, 'b').aq, 0, 'Bob hasn\'t sent any');
  assert.equal(p.act, null);
  one.tick(s);
  assert.equal(one.view(s, 'a').aq, 4);
  assert.equal(p.act && p.act.k, 'check', 'B on the third tick');
  one.tick(s);
  assert.equal(one.view(s, 'a').aq, 5);
  one.tick(s);
  assert.equal(one.view(s, 'a').aq, 5, 'none left: still 5');
  assert.deepEqual([s.hold[0].x, s.hold[0].y], [0, -1], 'and still skating the way the last one said');
  // a bunch at once after a hiccup: it catches up
  one.input(s, 'a', { q: 6, i: Array(16).fill([0, 1, 0, 0]) });
  for (let i = 0; i < 4; i++) one.tick(s);
  assert.ok(s.hold[0].Q.length < 16 - 8, 'more than two ticks\' worth a tick');
  one.input(s, 'a', { q: 22, i: [[0, 1, 1, 0], [0, 1, 0, 0]] });
  one.away(s, 'a', true);
  assert.equal(s.hold[0].Q.length, 0, 'a dropped connection lets go of what was still to come');
});

test('the whole game goes out too, for a browser to run ahead with', () => {
  const s = table(two);
  for (const id of ['a', 'b', 'c', 'd']) two.sit(s, id, id.toUpperCase());
  begin(two, s);
  for (let i = 0; i < 200; i++) two.tick(s);
  const { HOCKEY, yard } = hockey.load(), v = JSON.parse(JSON.stringify(two.view(s, 'b')));
  assert.equal(v.hv, HOCKEY.VERSION);
  const g = HOCKEY.create(yard, { players: v.who.map((w, j) => ({ name: w.n, team: j % 2 })) });
  g.load(v.st);
  g.players.forEach((p, j) => assert.ok(Math.hypot(p.x - s.g.players[j].x, p.y - s.g.players[j].y) < 0.002));
  assert.equal(g.clock, s.g.clock);
});

test('what each player sees: their place, everyone\'s skaters and the puck', () => {
  const s = table(two);
  for (const id of ['a', 'b', 'c', 'd']) two.sit(s, id, id.toUpperCase());
  begin(two, s);
  const v = two.view(s, 'c');
  assert.equal(v.me, 2);
  assert.equal(v.ph, 'play');
  assert.deepEqual(v.who.map((w) => w.id), ['a', 'b', 'c', 'd']);
  assert.equal(v.pl.length, 4);
  assert.equal(v.pl[0].length, 11);
  assert.equal(v.pk[4], -1, 'nobody has the puck at the drop');
  assert.equal(typeof v.clk, 'number');
  assert.doesNotThrow(() => JSON.stringify(v));
});

test('someone leaving partway through is played by the computer, and the game goes on', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  one.stand(s, 'b');
  assert.deepEqual(one.seated(s), ['a']);
  assert.equal(s.g.players[1].ai, true);
  assert.equal(one.view(s, 'a').who[1].ai, true);
  until(one, s, () => s.g.phase === 'play');
  const p = s.g.players[1], x0 = p.x, y0 = p.y;
  for (let i = 0; i < 60; i++) one.tick(s);
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 0.5, 'the computer skates it');
});

test('a game everyone has left is called off, so the next players needn\'t wait it out', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  one.stand(s, 'a');
  assert.equal(s.ph, 'play', 'Bob\'s still playing');
  one.stand(s, 'b');
  assert.equal(s.ph, 'lobby');
  assert.equal(s.last, null, 'no final score for a game nobody finished');
  assert.equal(one.sit(s, 'c', 'Cat'), true);
  assert.equal(one.view(s, 'c').ph, 'lobby');
});

test('a dropped connection lets go of the stick', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  one.input(s, 'a', { x: 1, y: 0, a: 1, ap: 1, bp: 0 });
  one.away(s, 'a', true);
  assert.deepEqual([s.hold[0].x, s.hold[0].y, s.hold[0].a], [0, 0, false]);
});

test('a game played out goes to the final score, then back to the lobby for another', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  // nobody touches anything, so a goal or two at most: run the clock down quickly
  s.g.clock = 120;
  s.g.score = [2, 1];
  until(one, s, () => s.ph === 'over');
  assert.deepEqual(one.view(s, 'b').last, { sc: [2, 1], ot: false });
  assert.deepEqual(one.view(s, 'b').ev, []);
  until(one, s, () => s.ph === 'lobby');
  const v = one.view(s, 'a');
  assert.deepEqual(v.slots.map((q) => [q.id, q.r]), [['a', false], ['b', false]], 'same teams, start to press again');
  assert.deepEqual(v.last.sc, [2, 1]);
  begin(one, s);
  assert.equal(s.gn, 2);
});

test('a tie at the buzzer goes to overtime', () => {
  const s = table(one);
  one.sit(s, 'a', 'Ann'); one.sit(s, 'b', 'Bob');
  begin(one, s);
  s.g.clock = 120;
  until(one, s, () => s.g.phase === 'buzzer');
  s.g.score = [1, 1];
  until(one, s, () => s.g.ot);
  assert.equal(s.ph, 'play');
  assert.equal(s.fo, 1);
});
