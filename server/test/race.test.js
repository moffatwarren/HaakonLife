// Haakon Grand Prix's rules (js/race.js), and the live race's lobby and race, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as race from '../tables/race.js';
import { seeded } from '../rooms.js';

const R = race.load();
const table = (seed = 1) => race.create({ rng: seeded(seed) });
// tick until something's true (or give up)
const until = (s, ok, max = 60000) => {
  for (let i = 0; i < max && !ok(s); i++) race.tick(s);
  assert.ok(ok(s), 'it got there');
};
// everyone sitting there presses start, and the countdown in the lobby runs out
function begin(s) {
  for (const id of race.seated(s)) race.input(s, id, { go: true });
  until(s, (x) => x.ph === 'race');
}

test('the rules load from the site\'s files, and the server says which rules they are', () => {
  assert.ok(R, 'js/race.js');
  assert.equal(R.CARS.length, 5);
  assert.equal(R.TRACKS.length, 5);
  assert.equal(race.VERSION, R.VERSION, 'VERSION in server/tables/race.js is js/race.js\'s (node tools/check_games.mjs says what to set it to)');
});

test('every track: its bends round enough, every part of the road clear of the rest, on the map, and the grid on the straight', () => {
  for (let i = 0; i < R.TRACKS.length; i++) {
    const T = R.track(i);
    let most = 0;
    for (let j = 0; j < T.n; j++) most = Math.max(most, Math.abs(T.k[j]));
    assert.ok(1 / most >= R.WALL, T.name + ': its tightest bend is ' + (1 / most).toFixed(2) + ' tiles round, tighter than WALL');
    // (a barrier between any two parts of the road that aren't just round a bend from each other)
    for (let a = 0; a < T.n; a += 2) for (let b = a + 1; b < T.n; b += 2) {
      const arc = Math.min(Math.abs(T.s[a] - T.s[b]), T.len - Math.abs(T.s[a] - T.s[b]));
      if (arc < 16) continue;
      const d = Math.hypot(T.x[a] - T.x[b], T.y[a] - T.y[b]);
      assert.ok(d >= 2 * R.WALL + 0.5, T.name + ': the road at ' + T.x[a].toFixed(1) + ', ' + T.y[a].toFixed(1) + ' is ' + d.toFixed(2) + ' tiles from itself at ' + T.x[b].toFixed(1) + ', ' + T.y[b].toFixed(1));
    }
    const m = R.WALL + 1.5;
    for (let j = 0; j < T.n; j++) assert.ok(T.x[j] >= m && T.y[j] >= m && T.x[j] <= T.w - m && T.y[j] <= T.h - m, T.name + ': the barriers are on the map');
    const a0 = T.at(0, 0).ang;
    assert.ok(Math.abs(a0 - Math.PI / 2) < 0.01, T.name + ': the start line is on a straight going right');
    for (let b = 0; b <= 7.8; b += 0.3) assert.ok(Math.abs(T.at(-b, 0).ang - a0) < 0.06, T.name + ': the grid is on the straight');
    assert.ok(T.len > 180 && T.len < 330, T.name + ': a lap is a sensible length');
  }
});

test('a race saved and loaded into another carries on exactly the same', () => {
  const players = [{ name: 'A', car: 0 }, { name: 'B', car: 1, ai: true, pace: 0.96 }, { name: 'C', car: 2 }, { name: 'D', car: 3, ai: true }];
  const g = R.create(1, { seed: 7, players }), rng = seeded(3);
  let s = [0, 0];
  const inputs = () => {
    if (rng() < 0.03) s = [rng() * 2 - 1, rng() * 2 - 1];
    return g.cars.map((c, i) => ({ s: s[i & 1], a: rng() < 0.85, b: rng() < 0.04 }));
  };
  // well into a race, with bumps, drifts and the computer driving two of them
  for (let i = 0; i < 2500; i++) g.step(inputs());
  const h = R.create(1, { seed: 99, players });
  h.load(JSON.parse(JSON.stringify(g.save())));
  const same = () => JSON.stringify(h.save()) === JSON.stringify(g.save());
  assert.ok(same());
  for (let i = 0; i < 2000; i++) { const ins = inputs(); g.step(ins); h.step(ins); }
  assert.ok(same(), 'the same 2000 ticks later');
});

test('the computer gets every car round every track, and none is much faster than the rest', () => {
  // (four to a race, so every car in one race or the other)
  const groups = [[0, 1, 2, 3], [4, 3, 2, 1]];
  assert.ok(R.CARS.every((c, i) => groups.some((g) => g.includes(i))));
  for (let ti = 0; ti < R.TRACKS.length; ti++) for (const cars of groups) {
    const g = R.create(ti, { seed: 5, players: cars.map((i) => ({ name: R.CARS[i].key, car: i, ai: true })) });
    for (let n = 0; n < 60 * 240 && !g.cars.every((c) => c.fin >= 0); n++) g.step([]);
    const name = R.TRACKS[ti].name;
    assert.ok(g.cars.every((c) => c.fin >= 0), name + ': everyone finishes inside four minutes');
    assert.ok(g.over(), name + ': and that\'s the race over');
    assert.deepEqual(Array.from(g.places(), (c) => c.place), [1, 2, 3, 4]);
    // (the second and third laps: the first depends on where each started on the grid)
    const laps = g.cars.map((c) => c.laps[1] + c.laps[2]);
    assert.ok(Math.max(...laps) / Math.min(...laps) < 1.08, name + ': ' + laps.map((l) => (l / 120).toFixed(1)).join(', ') + ' seconds a lap');
  }
});

test('a drift: turning hard at speed with the gas down, and a burst of speed out of a long one', () => {
  const g = R.create(1, { seed: 1, players: [{ name: 'A', car: 0 }] }), c = g.cars[0];
  while (g.phase !== 'race') g.step([{ a: true }]);
  for (let i = 0; i < 100; i++) g.step([{ a: true }]);
  const v = Math.hypot(c.vx, c.vy);
  assert.ok(v > c.spec.top * 0.6, 'up to speed down the straight');
  // back over to the left of the road, going down it (or a little to the left), for room to slide right across it
  const again = (a = 0) => {
    const p = g.track.at(c.s, 2), ang = p.ang + a;
    Object.assign(c, { x: p.x, y: p.y, ang, vx: Math.sin(ang) * v, vy: Math.cos(ang) * v, steer: 0, spin: 0 });
  };
  again();
  g.step([{ a: true, b: true }]);
  assert.equal(c.drift, 0, 'braking going straight is just braking');
  again();
  for (let i = 0; i < 8; i++) g.step([{ s: 1, a: true }]);
  for (let i = 0; i < 4; i++) g.step([{ a: true }]);
  assert.equal(c.drift, 0, 'a quick turn is just a turn');
  again();
  for (let i = 0; i < 20; i++) g.step([{ s: 1 }]);
  assert.equal(c.drift, 0, 'turning hard off the gas is just a turn');
  again();
  for (let i = 0; i < 20; i++) g.step([{ s: 0.6, a: true }]);
  assert.equal(c.drift, 0, 'turning gently is just a turn');
  again(0.3);
  let held = 0;
  while (!c.drift && held < 30) { g.step([{ s: 1, a: true }]); held++; }
  assert.equal(c.drift, 1, 'holding a hard turn right with the gas down swings the back out');
  assert.ok(held >= 10, 'after a moment');
  let boost = false, most = 0;
  for (let i = 0; i < 40; i++) {
    g.step([{ s: 0.4, a: true }]);
    const slip = Math.abs(Math.atan2(Math.sin(Math.atan2(c.vx, c.vy) - c.ang), Math.cos(Math.atan2(c.vx, c.vy) - c.ang)));
    most = Math.max(most, slip);
  }
  assert.equal(c.drift, 1, 'it keeps going while you keep turning that way');
  assert.ok(most > 0.2 && most < 0.65, 'the back out, but never spinning round');
  assert.ok(Math.hypot(c.vx, c.vy) > c.spec.top * 0.6, 'still going');
  for (let i = 0; i < 6 && c.drift; i++) { g.step([{ s: -1, a: true }]); boost = boost || g.events.some((e) => e.e === 'boost'); }
  assert.equal(c.drift, 0, 'steering out of it ends it');
  assert.ok(boost && c.boost > 0, 'and a long one gives you a burst of speed');
});

test('the barriers keep every car on the track, however it\'s driven', () => {
  for (let ti = 0; ti < R.TRACKS.length; ti++) {
    const g = R.create(ti, { seed: 3, players: [0, 1, 2, 3].map((k) => ({ name: 'x', car: (ti + k) % R.CARS.length })) }), rng = seeded(ti + 9);
    let steer = g.cars.map(() => 0);
    for (let i = 0; i < 5000; i++) {
      if (i % 40 === 0) steer = steer.map(() => Math.round(rng() * 2 - 1));
      g.step(g.cars.map((c, j) => ({ s: steer[j], a: rng() < 0.9, b: rng() < 0.03 })));
      for (const c of g.cars) assert.ok(Math.abs(g.track.where(c.x, c.y).d) < R.WALL, 'inside the barriers on ' + R.TRACKS[ti].name);
    }
  }
});

test('up to four sit down and the fifth is told it\'s full; the first there picks the track, everyone their car', () => {
  const s = table();
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(race.sit(s, id, id), true);
  assert.equal(race.sit(s, 'e', 'e'), 'full');
  assert.equal(race.sit(s, 'a', 'a'), true, 'sitting again where you already are is fine');
  race.input(s, 'b', { tr: 2 });
  assert.equal(s.tr, 0, 'only the host picks the track');
  race.input(s, 'a', { tr: 2 });
  assert.equal(s.tr, 2);
  race.input(s, 'a', { tr: 7 });
  assert.equal(s.tr, 2, 'not a track');
  race.input(s, 'b', { car: 3 });
  assert.equal(s.slots[1].car, 3);
  for (const d of [{ car: 9 }, { car: 'van' }, { car: 1.5 }, null, 'go', { go: 'yes' }]) race.input(s, 'b', d);
  assert.equal(s.slots[1].car, 3, 'nothing that isn\'t a car');
  assert.equal(s.slots[1].r, false);
  race.stand(s, 'a');
  assert.equal(s.host, 'b', 'the host leaving hands the track on');
  assert.equal(race.view(s, 'b').host, 1);
  assert.equal(race.brief(s).open, 1);
});

test('nobody races alone: two who\'ve pressed start go after a few seconds, four straight away', () => {
  const s = table();
  race.sit(s, 'a', 'Ann');
  race.input(s, 'a', { go: true });
  for (let i = 0; i < 400; i++) race.tick(s);
  assert.equal(s.ph, 'lobby', 'one on their own waits');
  race.sit(s, 'b', 'Bob');
  race.tick(s);
  assert.equal(race.view(s, 'a').cd, 0, 'not while Bob hasn\'t pressed start');
  race.input(s, 'b', { go: true });
  race.tick(s);
  assert.ok(race.view(s, 'a').cd > 0, 'a few seconds for anyone else');
  race.input(s, 'b', { car: 2 });
  race.tick(s);
  assert.equal(race.view(s, 'a').cd, 0, 'changing your car takes your start back');
  race.input(s, 'b', { go: true });
  race.tick(s);
  race.sit(s, 'c', 'Cat');
  race.tick(s);
  assert.equal(race.view(s, 'a').cd, 0, 'someone turning up stops the count');
  race.input(s, 'c', { go: true });
  until(s, (x) => x.ph === 'race');
  assert.equal(s.g.cars.length, 3, 'just the players there: nobody the computer drives');
  assert.ok(s.g.cars.every((c) => !c.ai));
  assert.deepEqual(s.g.cars.map((c) => c.car), [0, 2, 0]);
  assert.equal(race.sit(s, 'd', 'Dan'), 'busy', 'nobody joins a race that\'s on');
  const t = table();
  for (const id of ['a', 'b', 'c', 'd']) { race.sit(t, id, id); race.input(t, id, { go: true }); }
  race.tick(t);
  assert.equal(t.ph, 'race', 'with all four, straight away');
});

test('in a race: what you did a tick at a time, and a view with the whole race for a browser to run ahead with', () => {
  const s = table();
  race.sit(s, 'a', 'Ann'); race.sit(s, 'b', 'Bob');
  begin(s);
  race.input(s, 'a', { q: 1, i: [[0.5, 1, 0], [0.5, 1, 0], ['x', null, 0], [7, 1, 1]] });
  race.input(s, 'a', { q: 'x', i: [[1, 1, 1]] });
  race.input(s, 'a', { q: 1, i: 'x' });
  race.tick(s);
  const v = race.view(s, 'a');
  assert.equal(v.ph, 'race');
  assert.equal(v.at, 0);
  assert.equal(v.rv, R.VERSION);
  assert.equal(v.aq, 2, 'two ticks of it taken, one a game tick');
  assert.equal(s.hold[0].Q.length, 2);
  assert.deepEqual(s.hold[0].Q.map((e) => e.s), [0, 1], 'anything that isn\'t a number is nothing, and it\'s no more than all the way');
  // a browser's own copy, loaded from the view, is the same race
  const h = R.create(v.tr, { players: v.who.map((w) => ({ name: w.n, car: w.car })) });
  h.load(v.st);
  h.cars.forEach((c, j) => assert.ok(Math.abs(c.x - s.g.cars[j].x) < 0.01 && Math.abs(c.y - s.g.cars[j].y) < 0.01));
  assert.equal(race.view(s, 'nobody').at, -1);
  assert.ok(race.brief(s).lap >= 1);
  assert.equal(race.brief(s).open, 0, 'nobody can join it');
});

test('leaving partway: your car is out, and with nobody left it\'s back to the lobby', () => {
  const s = table();
  for (const id of ['a', 'b', 'c']) race.sit(s, id, id);
  begin(s);
  race.stand(s, 'b');
  assert.equal(s.g.cars[1].out, true);
  assert.equal(race.view(s, 'a').who[1].id, null);
  race.away(s, 'a', true);
  assert.deepEqual([s.hold[0].a, s.hold[0].s], [false, 0], 'a dropped connection lets go of everything');
  race.stand(s, 'a'); race.stand(s, 'c');
  assert.equal(s.ph, 'lobby');
  assert.equal(s.host, null);
  assert.equal(race.sit(s, 'd', 'Dan'), true, 'and open for the next');
  assert.equal(s.host, 'd');
});

test('a race to the end: the results, then the lobby again with everyone\'s car', () => {
  const s = table();
  race.sit(s, 'a', 'Ann'); race.sit(s, 'b', 'Bob');
  race.input(s, 'b', { car: 3 });
  begin(s);
  s.g.cars[0].ai = true; // (the computer drives Ann; Bob never touches the gas)
  until(s, (x) => x.ph === 'over', 60 * 60 * 6);
  assert.equal(s.last.length, 2);
  assert.equal(s.last[0].n, 'Ann');
  assert.ok(s.last[0].fin > 0 && s.last[0].best > 0);
  assert.equal(s.last[1].fin, -1, 'Bob didn\'t finish: it\'s called LATE after the first home');
  assert.ok(s.g.clock - s.g.first >= R.LATE);
  until(s, (x) => x.ph === 'lobby');
  assert.deepEqual(s.slots.slice(0, 2).map((q) => [q.id, q.car, q.r]), [['a', 0, false], ['b', 3, false]]);
  assert.equal(race.view(s, 'a').last.length, 2);
});
