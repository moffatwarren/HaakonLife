// Haakon Brawl's rules (js/brawl.js), and the live fight's lobby and fight, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as brawl from '../tables/brawl.js';
import { seeded } from '../rooms.js';

const B = brawl.load();
const table = (seed = 1) => brawl.create({ rng: seeded(seed) });
// tick until something's true (or give up)
const until = (s, ok, max = 60000) => {
  for (let i = 0; i < max && !ok(s); i++) brawl.tick(s);
  assert.ok(ok(s), 'it got there');
};
// everyone sitting there presses start, and the countdown in the lobby runs out
function begin(s) {
  for (const id of brawl.seated(s)) brawl.input(s, id, { go: true });
  until(s, (x) => x.ph === 'fight');
}
// a fight on a stage past the countdown, with nobody doing anything
function fight(stage = 0, players = [{ name: 'A' }, { name: 'B' }]) {
  const g = B.create(stage, { seed: 1, players });
  while (g.phase === 'ready') g.step([]);
  return g;
}

test('the rules load from the site\'s files, and the server says which rules they are', () => {
  assert.ok(B, 'js/brawl.js');
  assert.equal(B.STAGES.length, 3);
  assert.equal(brawl.VERSION, B.VERSION, 'VERSION in server/tables/brawl.js is js/brawl.js\'s (node tools/check_games.mjs says what to set it to)');
});

test('every stage: everything on the screen, the platforms reachable, and everyone starting on the stage', () => {
  for (let st = 0; st < B.STAGES.length; st++) {
    const S = B.STAGES[st], M = S.main;
    for (const P of [M].concat(S.soft)) {
      assert.ok(P.x0 >= 0 && P.x1 <= 20 && P.x1 - P.x0 >= 2.5, S.name + ': a platform on the screen, and big enough to stand on');
      assert.ok(P.y > 3 && P.y < 12, S.name + ': and between the top of the screen and the scores along the bottom');
    }
    // (each soft platform within a jump of something under it, so you can get up onto every one)
    for (const P of S.soft) {
      const under = [M].concat(S.soft).filter((Q) => Q !== P && Q.y > P.y && Q.x1 > P.x0 - 1 && Q.x0 < P.x1 + 1);
      assert.ok(under.some((Q) => Q.y - P.y <= 2.5), S.name + ': the platform at ' + P.x0 + '-' + P.x1 + ' is within a jump of something');
    }
    for (const n of [2, 3, 4]) {
      const g = B.create(st, { seed: 1, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i })) });
      for (const f of g.fighters) assert.ok(f.x > M.x0 + 0.5 && f.x < M.x1 - 0.5 && f.y === M.y, S.name + ': everyone starts on the stage');
      assert.equal(new Set(g.fighters.map((f) => f.x)).size, n, 'each in a place of their own');
    }
  }
});

test('a fight saved and loaded into another carries on exactly the same', () => {
  const players = [{ name: 'A' }, { name: 'B', ai: true, skill: 0.6 }, { name: 'C' }, { name: 'D', ai: true, skill: 1 }];
  const g = B.create(1, { seed: 7, players }), rng = seeded(3);
  const inputs = () => g.fighters.map(() => ({ x: Math.round(rng() * 2 - 1), y: rng() < 0.7 ? 0 : rng() < 0.5 ? -1 : 1, a: rng() < 0.2, b: rng() < 0.2 }));
  // well into a fight, with hits, knockouts and the computer playing two of them
  let ins = inputs();
  for (let i = 0; i < 3000; i++) { if (i % 6 === 0) ins = inputs(); g.step(ins); }
  const h = B.create(1, { seed: 99, players });
  h.load(JSON.parse(JSON.stringify(g.save())));
  const same = () => JSON.stringify(h.save()) === JSON.stringify(g.save());
  assert.ok(same());
  for (let i = 0; i < 3000; i++) { if (i % 6 === 0) ins = inputs(); g.step(ins); h.step(ins); }
  assert.ok(same(), 'the same 3000 ticks later');
});

test('jumping: higher holding A, again in the air but only once, and down + A through a platform', () => {
  const g = fight(), f = g.fighters[0], M = g.stage.main;
  const top = (hold) => {
    Object.assign(f, { x: 10, y: M.y, ground: 0, vy: 0, vx: 0 });
    let most = M.y;
    g.step([{ a: true }]);
    for (let i = 0; i < 60; i++) { g.step([{ a: i < hold }]); most = Math.min(most, f.y); }
    return M.y - most;
  };
  const full = top(60), short = top(2);
  assert.ok(full > 2.3 && full < 3, 'a full jump gets you onto the side platforms: ' + full.toFixed(2));
  assert.ok(short < full * 0.6, 'a tap is a short hop: ' + short.toFixed(2));
  // in the air: once more, then no more
  Object.assign(f, { x: 10, y: M.y, ground: 0, vy: 0 });
  for (let i = 0; i < 16; i++) g.step([{ a: true }]);
  g.step([{}]);
  g.step([{ a: true }]);
  assert.ok(f.vy < 0 && f.jumps === 0, 'a second jump in the air');
  for (let i = 0; i < 8; i++) g.step([{}]);
  const vy = f.vy;
  g.step([{ a: true }]);
  assert.ok(f.vy > vy, 'but not a third');
  // standing on a platform, down + A drops through it
  const P = g.stage.soft[0];
  Object.assign(f, { x: (P.x0 + P.x1) / 2, y: P.y, ground: 1, vy: 0, jumps: 1 });
  g.step([{}]);
  g.step([{ y: 1, a: true }]);
  for (let i = 0; i < 30; i++) g.step([{}]);
  assert.equal(f.ground, 0, 'down + A drops you through it onto the stage');
});

test('the air uppercut carries you up, once each time you leave the ground', () => {
  const g = fight(), f = g.fighters[0], M = g.stage.main;
  Object.assign(f, { x: M.x0 - 1, y: M.y + 1, ground: -1, vy: 3, jumps: 0 });
  g.step([{ y: -1, b: true }]);
  assert.equal(f.mv, 'uair');
  assert.ok(f.vy < -10, 'carried up');
  for (let i = 0; i < 26; i++) g.step([{ x: 1 }]);
  assert.ok(f.ground === 0 || f.y < M.y + 1, 'back up to the stage: ' + f.y.toFixed(2));
  Object.assign(f, { x: M.x0 - 2, y: M.y + 2, ground: -1, vy: 3, mv: '', lag: 0 });
  g.step([{}]);
  g.step([{ y: -1, b: true }]);
  assert.ok(f.vy > 0, 'not a second time before landing');
});

test('every hit adds damage, and the more damage you have the further a hit sends you', () => {
  const sent = (pct) => {
    const g = fight(), [a, v] = g.fighters, M = g.stage.main;
    Object.assign(a, { x: 9, face: 1 }); Object.assign(v, { x: 9.6, pct });
    g.step([{ x: 1, b: true }, {}]);
    const x0 = v.x;
    for (let i = 0; i < 90 && !v.falls; i++) g.step([{}, {}]);
    assert.ok(v.pct >= pct + 9, 'the side punch did its damage');
    return v.falls ? 99 : v.x - x0;
  };
  const d0 = sent(0), d50 = sent(50), d100 = sent(100);
  assert.ok(d0 < d50 && d50 < d100, 'further each time: ' + [d0, d50, d100].map((d) => d.toFixed(2)).join(', '));
  assert.ok(d0 < 1.5, 'hardly anywhere with no damage');
  assert.equal(sent(250), 99, 'and right off the screen with a lot');
});

test('a direction and B pressed together on the ground, B held: charged up, harder the longer it was held, up to full', () => {
  const punch = (hold) => {
    const g = fight(), [a, v] = g.fighters;
    Object.assign(a, { x: 9, face: 1 }); Object.assign(v, { x: 9.7, pct: 60 });
    g.step([{}, {}]);
    g.step([{ x: 1, b: true }, {}]);
    assert.ok(a.chg > 0 && !a.mv && a.cmv === 'side', 'charging, not punching yet');
    const x0 = a.x;
    for (let i = 0; i < hold; i++) g.step([{ x: 1, b: true }, {}]);
    assert.equal(v.pct, 60, 'nothing lands while it charges');
    assert.ok(Math.abs(a.x - x0) < 0.2, 'planted: holding the direction doesn\'t run');
    g.step([{ x: 1 }, {}]);
    assert.equal(a.mv, 'side', 'letting go of B throws it');
    for (let i = 0; i < 30; i++) g.step([{}, {}]);
    return v.pct - 60;
  };
  const quick = punch(1), half = punch(30), full = punch(B.CHARGE), longer = punch(150);
  assert.ok(quick < half && half < full, 'more damage the longer: ' + [quick, half, full].join(', '));
  assert.equal(longer, full, 'and no more than full');
});

test('a direction already held when B goes down is the ordinary punch, straight away; B then a direction a moment later still charges; never in the air', () => {
  const g = fight(), [a] = g.fighters, M = g.stage.main;
  Object.assign(a, { x: 9, face: 1 });
  for (let i = 0; i < 10; i++) g.step([{ x: 1 }, {}]);
  g.step([{ x: 1, b: true }, {}]);
  assert.equal(a.mv, 'side', 'walking, then B: the side punch');
  assert.equal(a.chg, 0);
  for (let i = 0; i < 40; i++) g.step([{}, {}]);
  g.step([{ b: true }, {}]);
  assert.equal(a.mv, 'jab');
  g.step([{ y: -1, b: true }, {}]);
  assert.ok(a.chg > 0 && a.cmv === 'up', 'up a tick later with B still down: an uppercut charging');
  g.step([{}, {}]);
  assert.equal(a.mv, 'up');
  for (let i = 0; i < 40; i++) g.step([{}, {}]);
  Object.assign(a, { x: 9, y: M.y - 4, ground: -1, vy: 0 });
  g.step([{}, {}]);
  g.step([{ x: 1, b: true }, {}]);
  assert.equal(a.mv, 'fair', 'in the air it\'s the flying punch, straight away');
  assert.equal(a.chg, 0);
});

test('left or right walks, held a moment it runs (or tapped twice, straight away), for as long as you hold it', () => {
  const g = fight(), [a] = g.fighters;
  const speed = (ins) => {
    Object.assign(a, { x: 6, vx: 0, run: false, tap: 0, tapT: 99, mv: '' });
    g.step([{}, {}]);
    for (const i of ins) g.step([i, {}]);
    return Math.abs(a.vx);
  };
  const hold = (n) => Array(n).fill({ x: 1 }), none = (n) => Array(n).fill({});
  const walk = speed(hold(15)), held = speed(hold(40)), tapped = speed([{ x: 1 }, {}, ...hold(10)]);
  assert.ok(walk > 3 && walk < 4, 'walking, for a moment: ' + walk);
  assert.ok(held > 6.5, 'held a moment longer, running: ' + held);
  assert.ok(tapped > 6.5, 'tapped twice, running straight away: ' + tapped);
  assert.ok(speed([{ x: 1 }, ...none(20), ...hold(15)]) < 4, 'two taps too far apart is a walk');
  assert.ok(speed([{ x: 1 }, {}, ...hold(10), { x: -1 }, ...Array(15).fill({ x: -1 })]) < 4, 'turning round is a walk again');
  assert.ok(speed([...hold(30), {}, ...hold(15)]) < 4, 'and so is letting go');
});

test('B while running is a lunge, sliding you along the ground, and it stops at the edge', () => {
  const g = fight(), [a, v] = g.fighters, M = g.stage.main;
  Object.assign(a, { x: 6, face: 1 }); Object.assign(v, { x: 9, pct: 0 });
  g.step([{}, {}]); g.step([{ x: 1 }, {}]); g.step([{}, {}]);
  for (let i = 0; i < 12; i++) g.step([{ x: 1 }, {}]);
  assert.ok(a.run, 'running');
  const x0 = a.x;
  g.step([{ x: 1, b: true }, {}]);
  assert.equal(a.mv, 'dash', 'the lunge');
  assert.equal(a.chg, 0, 'not a charge, though right was pressed only a moment ago');
  for (let i = 0; i < 30; i++) g.step([{}, {}]);
  assert.ok(a.x - x0 > 1.4, 'it slides: ' + (a.x - x0).toFixed(2));
  assert.equal(v.pct, 10, 'and it hit');
  // running at the edge: the lunge stops there, rather than taking you off it
  Object.assign(a, { x: M.x1 - 1, vx: 7, face: 1, run: true, tap: 1, mv: '', lag: 0, stun: 0, in: { x: 1, y: 0, a: false, b: false } });
  Object.assign(v, { x: 5 });
  g.step([{ x: 1, b: true }, {}]);
  assert.equal(a.mv, 'dash');
  for (let i = 0; i < 40; i++) g.step([{}, {}]);
  assert.equal(a.ground, 0, 'still on the stage');
  assert.ok(a.x <= M.x1, 'at its edge');
});

test('getting hit while charging loses the charge', () => {
  const g = fight(), [a, v] = g.fighters;
  Object.assign(a, { x: 9, face: 1 }); Object.assign(v, { x: 9.6, face: -1 });
  g.step([{}, {}]);
  g.step([{ x: 1, b: true }, {}]);
  for (let i = 0; i < 8; i++) g.step([{ x: 1, b: true }, { b: i === 0 }]);
  assert.ok(a.pct > 0, 'the jab landed');
  assert.equal(a.chg, 0, 'and the charge is gone');
});

test('knocked off the screen: a life gone, damage back to nothing, back in from above, and nobody can hit you for a moment', () => {
  const g = fight(), [a, v] = g.fighters;
  Object.assign(v, { x: 25 });
  g.step([{}, {}]);
  assert.equal(v.lives, B.LIVES - 1);
  assert.ok(v.gone > 0);
  assert.equal(g.events.find((e) => e.e === 'ko').f, v);
  while (v.gone) g.step([{}, {}]);
  assert.equal(v.pct, 0);
  assert.ok(v.y < 3 && v.safe > 0, 'coming back in from above');
  Object.assign(a, { x: v.x - 0.5, y: v.y, face: 1, ground: -1 });
  for (let i = 0; i < 12; i++) g.step([{ b: i === 0 }, {}]);
  assert.equal(v.pct, 0, 'not while it lasts');
  // the last life: out, and that's the fight
  v.lives = 1; v.safe = 0;
  Object.assign(v, { x: 25 });
  g.step([{}, {}]);
  assert.ok(v.out);
  assert.ok(g.over());
  assert.equal(g.places()[0], a);
});

test('teammates can\'t hit each other', () => {
  const g = fight(0, [{ name: 'A', team: 1 }, { name: 'B', team: 1 }, { name: 'C', team: 0 }]), [a, b] = g.fighters;
  Object.assign(a, { x: 9, face: 1 }); Object.assign(b, { x: 9.5 });
  for (let i = 0; i < 20; i++) g.step([{ x: 1, b: i === 0 }, {}, {}]);
  assert.equal(b.pct, 0);
});

test('the computer fights back: fights end, the better fighter usually wins, and it rarely falls off on its own', () => {
  let wins = 0, self = 0, kos = 0;
  for (let st = 0; st < B.STAGES.length; st++) for (let k = 0; k < 4; k++) {
    const g = B.create(st, { seed: 11 + k * 31 + st, players: [{ name: 'Weak', ai: true, skill: 0.2 }, { name: 'Strong', ai: true, skill: 0.9 }] });
    for (let i = 0; i < 60 * 60 * 6 && !g.over(); i++) {
      g.step([]);
      for (const e of g.events) if (e.e === 'ko') { kos++; if (!e.by) self++; }
    }
    assert.ok(g.over(), B.STAGES[st].name + ': the fight ends inside six minutes');
    if (g.places()[0].name === 'Strong') wins++;
  }
  assert.ok(wins >= 10, 'the better fighter won ' + wins + ' of 12');
  assert.ok(self <= kos * 0.15, self + ' of ' + kos + ' lives lost without being hit');
});

test('a good coworker gets to you wherever you stand: every platform of every stage', () => {
  for (let st = 0; st < B.STAGES.length; st++) {
    const S = B.STAGES[st];
    [S.main].concat(S.soft).forEach((P, k) => {
      for (const seed of [3, 8, 21]) {
        const g = B.create(st, { seed, players: [{ name: 'Ann', ai: true, skill: 1 }, { name: 'Bob' }] }), bob = g.fighters[1];
        Object.assign(bob, { x: (P.x0 + P.x1) / 2, y: P.y, ground: k });
        for (let t = 0; t < 60 * 20 && bob.pct === 0; t++) g.step([{}, {}]);
        assert.ok(bob.pct > 0, S.name + ': nobody got to Bob standing on the platform at ' + P.x0 + '-' + P.x1 + ' (seed ' + seed + ')');
      }
    });
  }
});

test('however it\'s played, nobody ends up inside the stage, and everyone comes back on the screen', () => {
  for (let st = 0; st < B.STAGES.length; st++) {
    const g = B.create(st, { seed: 3, players: [0, 1, 2, 3].map((k) => ({ name: 'x' + k, ai: k > 1, skill: 0.5 })) }), rng = seeded(st + 9), M = g.stage.main;
    let ins = [];
    for (let i = 0; i < 8000 && !g.over(); i++) {
      if (i % 10 === 0) ins = g.fighters.map(() => ({ x: Math.round(rng() * 2 - 1), y: rng() < 0.6 ? 0 : rng() < 0.5 ? -1 : 1, a: rng() < 0.3, b: rng() < 0.3 }));
      g.step(ins);
      for (const f of g.fighters) {
        if (f.out || f.gone) continue;
        const inside = f.x > M.x0 + 0.05 && f.x < M.x1 - 0.05 && f.y > M.y + 0.05 && f.y - B.FH < M.y + M.h - 0.05;
        assert.ok(!inside, B.STAGES[st].name + ': ' + f.name + ' inside the stage at ' + f.x.toFixed(2) + ', ' + f.y.toFixed(2));
        assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.pct));
      }
    }
  }
});

test('up to four sit down and the fifth is told it\'s full; the first there picks the stage', () => {
  const s = table();
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(brawl.sit(s, id, id), true);
  assert.equal(brawl.sit(s, 'e', 'e'), 'full');
  assert.equal(brawl.sit(s, 'a', 'a'), true, 'sitting again where you already are is fine');
  brawl.input(s, 'b', { st: 2 });
  assert.equal(s.st, 0, 'only the host picks the stage');
  brawl.input(s, 'a', { st: 2 });
  assert.equal(s.st, 2);
  for (const d of [{ st: 7 }, { st: 'roof' }, { st: 1.5 }, null, 'go', { go: 'yes' }]) brawl.input(s, 'a', d);
  assert.equal(s.st, 2, 'nothing that isn\'t a stage');
  assert.equal(s.slots[0].r, false);
  brawl.stand(s, 'a');
  assert.equal(s.host, 'b', 'the host leaving hands the stage on');
  assert.equal(brawl.view(s, 'b').host, 1);
  assert.equal(brawl.brief(s).open, 1);
});

test('nobody fights alone: two who\'ve pressed start go after a few seconds, four straight away', () => {
  const s = table();
  brawl.sit(s, 'a', 'Ann');
  brawl.input(s, 'a', { go: true });
  for (let i = 0; i < 400; i++) brawl.tick(s);
  assert.equal(s.ph, 'lobby', 'one on their own waits');
  brawl.sit(s, 'b', 'Bob');
  brawl.input(s, 'b', { go: true });
  brawl.tick(s);
  assert.ok(brawl.view(s, 'a').cd > 0, 'a few seconds for anyone else');
  brawl.input(s, 'a', { st: 1 });
  brawl.tick(s);
  assert.equal(brawl.view(s, 'a').cd, 0, 'a new stage takes everyone\'s start back');
  begin(s);
  assert.equal(s.g.fighters.length, 2, 'just the players there: nobody the computer plays');
  assert.ok(s.g.fighters.every((f) => !f.ai));
  assert.equal(s.g.stage.key, B.STAGES[1].key);
  assert.equal(brawl.sit(s, 'c', 'Cat'), 'busy', 'nobody joins a fight that\'s on');
  const t = table();
  for (const id of ['a', 'b', 'c', 'd']) { brawl.sit(t, id, id); brawl.input(t, id, { go: true }); }
  brawl.tick(t);
  assert.equal(t.ph, 'fight', 'with all four, straight away');
});

test('in a fight: what you did a tick at a time, and a view with the whole fight for a browser to run ahead with', () => {
  const s = table();
  brawl.sit(s, 'a', 'Ann'); brawl.sit(s, 'b', 'Bob');
  begin(s);
  brawl.input(s, 'a', { q: 1, i: [[1, 0, 1, 0], [1, 0, 1, 0], ['x', null, 0, 0], [7, -1, 1, 1]] });
  brawl.input(s, 'a', { q: 'x', i: [[1, 1, 1, 1]] });
  brawl.input(s, 'a', { q: 1, i: 'x' });
  brawl.tick(s);
  const v = brawl.view(s, 'a');
  assert.equal(v.ph, 'fight');
  assert.equal(v.at, 0);
  assert.equal(v.bv, B.VERSION);
  assert.equal(v.aq, 2, 'two ticks of it taken, one a game tick');
  assert.deepEqual(s.hold[0].Q.map((e) => [e.x, e.y]), [[0, 0], [0, -1]], 'anything that isn\'t -1, 0 or 1 is nothing');
  // a browser's own copy, loaded from the view, is the same fight
  const h = B.create(v.st, { players: v.who.map((w) => ({ name: w.n })) });
  h.load(v.sv);
  h.fighters.forEach((f, j) => assert.ok(Math.abs(f.x - s.g.fighters[j].x) < 0.01 && Math.abs(f.y - s.g.fighters[j].y) < 0.01));
  assert.equal(brawl.view(s, 'nobody').at, -1);
  assert.equal(brawl.brief(s).open, 0, 'nobody can join it');
});

test('leaving partway: you\'re out, the last one left wins, and with nobody left it\'s back to the lobby', () => {
  const s = table();
  for (const id of ['a', 'b', 'c']) brawl.sit(s, id, id);
  begin(s);
  brawl.stand(s, 'b');
  assert.equal(s.g.fighters[1].out, true);
  assert.equal(brawl.view(s, 'a').who[1].id, null);
  brawl.away(s, 'a', true);
  assert.deepEqual([s.hold[0].a, s.hold[0].x], [false, 0], 'a dropped connection lets go of everything');
  brawl.stand(s, 'c');
  brawl.tick(s);
  assert.equal(s.ph, 'over', 'the last one there wins');
  assert.equal(s.last[0].n, 'a');
  assert.equal(s.last[1].left, true);
  until(s, (x) => x.ph === 'lobby');
  assert.deepEqual(s.slots[0], { id: 'a', n: 'a', r: false }, 'and back in the lobby for another');
  brawl.stand(s, 'a');
  assert.equal(s.host, null);
  assert.equal(brawl.sit(s, 'd', 'Dan'), true, 'open for the next');
});

test('a fight to the end: the results, winner first, then the lobby again', () => {
  const s = table();
  brawl.sit(s, 'a', 'Ann'); brawl.sit(s, 'b', 'Bob');
  begin(s);
  s.g.fighters[0].ai = true; s.g.fighters[0].skill = 1; // (the computer plays Ann; Bob stands there)
  until(s, (x) => x.ph === 'over', 60 * 60 * 6);
  assert.equal(s.last.length, 2);
  assert.equal(s.last[0].n, 'Ann');
  assert.equal(s.last[1].lives, 0);
  assert.ok(s.last[0].kos >= 1);
  until(s, (x) => x.ph === 'lobby');
  assert.equal(brawl.view(s, 'a').last.length, 2);
});
