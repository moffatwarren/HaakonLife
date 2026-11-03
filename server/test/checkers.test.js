// Checkers with no browser: the rules (js/checkers.js), how the computer plays, and the game the
// server runs (games/checkers.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as checkers from '../games/checkers.js';
import { seeded } from '../rooms.js';

const CHECKERS = checkers.load();
// (the rules run in a vm of their own, so what comes out of them has different Objects and Arrays)
const plain = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);
const sq = (name) => (name.charCodeAt(0) - 97) + (+name[1] - 1) * 8;
const go = (g, line) => {
  for (const mv of line.split(' ')) {
    assert.ok(g.play({ from: sq(mv.slice(0, 2)), to: sq(mv.slice(2, 4)) }), mv + ' should be legal in ' + g.fen());
  }
};
// a game from a position: one that can't be falls back to the start, so a test says if that happens
const pos = (fen, o) => {
  const g = CHECKERS.create({ fen, ...o });
  assert.equal(g.fen().split(' ')[0], fen.split(' ')[0], 'the position should load');
  return g;
};
const targets = (g, from) => g.moves(sq(from)).map((m) => m.to).sort((a, b) => a - b);
const squares = (...names) => names.map(sq).sort((a, b) => a - b);

// How many ways the game can go from the start, to a depth. These numbers were worked out long ago
// (a double jump counts as one move): a wrong one means a wrong rule somewhere.
function perft(g, depth) {
  let n = 0;
  const saved = g.save(), side = g.turn;
  for (const m of g.moves()) {
    g.play(m);
    if (g.turn === side && !g.result) n += perft(g, depth); // the rest of a double jump
    else n += depth === 1 ? 1 : perft(g, depth - 1);
    g.load(saved);
  }
  return n;
}
test('every legal move and no others, from the start', () => {
  [7, 49, 302, 1469, 7361, 36768, 179740].forEach((want, i) => {
    assert.equal(perft(CHECKERS.create(), i + 1), want, 'depth ' + (i + 1));
  });
});

test('the board starts as it should, black to go first', () => {
  const g = CHECKERS.create();
  assert.equal(g.turn, 0);
  assert.equal(g.at(sq('a1')), 'M');
  assert.equal(g.at(sq('c3')), 'M');
  assert.equal(g.at(sq('b8')), 'm');
  assert.equal(g.at(sq('f6')), 'm');
  assert.equal(g.at(sq('b1')), '', 'a light square');
  let black = 0, red = 0;
  for (let i = 0; i < 64; i++) { if (g.at(i) === 'M') black++; if (g.at(i) === 'm') red++; }
  assert.equal(black, 12);
  assert.equal(red, 12);
  assert.equal(g.result, null);
});

test('a man only goes forward, and only one square', () => {
  same(targets(pos('7k/8/8/8/3M4/8/8/8 b - 0'), 'd4'), squares('c5', 'e5'));
  same(targets(pos('8/8/8/2m5/8/8/8/K7 r - 0'), 'c5'), squares('b4', 'd4'));
});

test('a king goes either way, but only one square', () => {
  const g = pos('7k/8/8/8/3K4/8/8/8 b - 0');
  same(targets(g, 'd4'), squares('c5', 'e5', 'c3', 'e3'));
});

test('a move has to be legal, and it has to be your turn', () => {
  const g = CHECKERS.create();
  assert.equal(g.play({ from: sq('c3'), to: sq('c4') }), false, 'not diagonal');
  assert.equal(g.play({ from: sq('c3'), to: sq('e5') }), false, 'too far');
  assert.equal(g.play({ from: sq('b6'), to: sq('a5') }), false, 'red can\'t go first');
  assert.equal(g.play({ from: sq('a1'), to: sq('b2') }), false, 'someone\'s there');
  assert.equal(g.ply, 0);
  assert.equal(g.play({ from: sq('c3'), to: sq('d4') }), true);
  assert.equal(g.turn, 1);
  same(g.last, [sq('c3'), sq('d4')]);
});

test('whatever a tampered browser sends does nothing', () => {
  const g = CHECKERS.create();
  const before = g.fen();
  for (const bad of [null, {}, 'c3d4', { from: 'c3', to: 'd4' }, { from: -1, to: 3 }, { from: 18, to: 64 }, { from: 18.5, to: 27 },
    { from: 18, to: NaN }, { from: [18], to: [27] }, { from: 27, to: 36 }]) {
    assert.equal(g.play(bad), false, JSON.stringify(bad));
  }
  assert.equal(g.fen(), before);
});

test('if you can jump you have to, and the piece you jump goes', () => {
  const g = pos('7k/8/8/4m3/3M4/8/5M2/8 b - 0');
  same(g.mustJump(), [sq('d4')]);
  assert.equal(g.play({ from: sq('f2'), to: sq('e3') }), false, 'that man could move, but d4 has to jump');
  assert.equal(g.play({ from: sq('d4'), to: sq('c5') }), false, 'so d4 can\'t just step, either');
  same(g.moves(), [{ from: sq('d4'), to: sq('f6'), over: sq('e5') }]);
  assert.equal(g.play({ from: sq('d4'), to: sq('f6') }), true);
  assert.equal(g.at(sq('e5')), '', 'it\'s gone');
  assert.equal(g.at(sq('f6')), 'M');
  assert.ok(g.events.includes('capture'));
});

test('you can\'t jump your own, or off the board, or onto someone, or backwards with a man', () => {
  same(pos('7k/8/8/4M3/3M4/8/8/8 b - 0').mustJump(), [], 'your own');
  same(pos('7k/8/8/8/8/m7/1M6/8 b - 0').mustJump(), [], 'off the edge');
  same(pos('7k/8/5m2/4m3/3M4/8/8/8 b - 0').mustJump(), [], 'someone behind it');
  same(pos('8/8/3M4/4m3/8/8/8/k7 b - 0').mustJump(), [], 'a man can\'t jump backwards');
  same(pos('8/8/3K4/4m3/8/8/8/k7 b - 0').mustJump(), [sq('d6')], 'a king can');
});

test('you pick which jump, if there\'s more than one', () => {
  const g = pos('7k/8/8/2m1m3/3M4/8/8/8 b - 0');
  same(g.moves().map((m) => m.to).sort((a, b) => a - b), squares('b6', 'f6'));
  const h = pos('7k/8/8/2m3m1/3M3M/8/8/8 b - 0');
  same(h.mustJump().sort((a, b) => a - b), squares('d4', 'h4'), 'and with which piece');
});

test('a double jump goes one jump at a time, and the same piece has to finish it', () => {
  const j = pos('7k/8/5m2/8/3m4/2M5/8/6M1 b - 0');
  assert.equal(j.holding(), -1);
  go(j, 'c3e5');
  assert.equal(j.turn, 0, 'still black\'s turn');
  assert.equal(j.holding(), sq('e5'));
  assert.equal(j.at(sq('d4')), '', 'the first one\'s gone already');
  same(j.mustJump(), [sq('e5')]);
  assert.equal(j.play({ from: sq('g1'), to: sq('h2') }), false, 'nothing else can move');
  same(j.moves(), [{ from: sq('e5'), to: sq('g7'), over: sq('f6') }]);
  go(j, 'e5g7');
  assert.equal(j.holding(), -1);
  assert.equal(j.turn, 1, 'now it\'s red\'s');
  assert.equal(j.at(sq('f6')), '');
});

test('reaching the far side crowns a man, and that ends his turn even with a jump on', () => {
  const g = pos('8/4M3/8/8/8/8/8/k7 b - 0');
  go(g, 'e7d8');
  assert.equal(g.at(sq('d8')), 'K');
  assert.ok(g.events.includes('crown'));
  const r = pos('8/8/8/8/8/8/3m4/K7 r - 0');
  go(r, 'd2c1');
  assert.equal(r.at(sq('c1')), 'k');
  // he jumps e7 to land on d8, where as a king he could go on to jump c7, but his turn's over
  const h = pos('8/2m1m3/5M2/8/8/8/8/6k1 b - 0');
  go(h, 'f6d8');
  assert.equal(h.at(sq('d8')), 'K');
  assert.equal(h.holding(), -1);
  assert.equal(h.turn, 1, 'crowned, and that\'s it');
  assert.equal(h.at(sq('c7')), 'm', 'c7 is still there');
});

test('a king can carry on a double jump in any direction', () => {
  // down over e5, then back up over g5
  const g = pos('8/8/3K4/4m1m1/8/8/8/k7 b - 0');
  go(g, 'd6f4');
  assert.equal(g.turn, 0);
  assert.equal(g.holding(), sq('f4'));
  go(g, 'f4h6');
  assert.equal(g.turn, 1);
  assert.equal(g.at(sq('h6')), 'K');
});

test('taking the last piece wins', () => {
  const g = pos('8/8/8/4m3/3M4/8/8/8 b - 0');
  go(g, 'd4f6');
  same(g.result, { w: 0, why: 'captured' });
  same(g.moves(), []);
  assert.ok(g.events.includes('over'));
  assert.equal(g.play({ from: sq('f6'), to: sq('e7') }), false, 'it\'s over');
});

test('having no move left loses, with pieces still on the board', () => {
  // red's man on a3 has b2 in front of him, and nowhere to jump to (c1 is taken)
  same(pos('8/8/8/8/1M6/m7/1M6/2M5 r - 0').result, { w: 0, why: 'blocked' });
  // and it can come about as a move's made
  const h = pos('8/8/8/8/8/m7/8/M1M5 b - 0');
  assert.equal(h.result, null);
  go(h, 'a1b2');
  same(h.result, { w: 0, why: 'blocked' });
});

test('the same position three times is a draw', () => {
  const g = pos('7k/8/8/8/8/8/8/K7 b - 0');
  go(g, 'a1b2 h8g7 b2a1 g7h8 a1b2 h8g7 b2a1');
  assert.equal(g.result, null);
  go(g, 'g7h8');
  same(g.result, { w: -1, why: 'repetition' });
});

test('forty moves each with no jump and no man moved is a draw', () => {
  const g = pos('7k/8/8/8/8/8/8/K7 b - 79');
  go(g, 'a1b2');
  same(g.result, { w: -1, why: 'forty' });
  const h = pos('7k/8/8/8/8/8/1M6/8 b - 79');
  go(h, 'b2c3');
  assert.equal(h.result, null, 'a man moved, so the count starts again');
  assert.equal(h.fen().split(' ')[3], '0');
});

test('saving and loading gives the same game, partway through a double jump and all', () => {
  const g = pos('7k/8/5m2/8/3m4/2M5/8/6M1 b - 0', { seed: 5 });
  go(g, 'c3e5');
  const copy = CHECKERS.create();
  copy.load(JSON.parse(JSON.stringify(g.save())));
  assert.equal(copy.fen(), g.fen());
  same(copy.last, g.last);
  assert.equal(copy.ply, 1);
  assert.equal(copy.holding(), sq('e5'));
  go(copy, 'e5g7');
  assert.equal(copy.turn, 1);

  const rep = pos('7k/8/8/8/8/8/8/K7 b - 0');
  go(rep, 'a1b2 h8g7 b2a1 g7h8 a1b2 h8g7 b2a1');
  const again = CHECKERS.create();
  again.load(JSON.parse(JSON.stringify(rep.save())));
  go(again, 'g7h8');
  same(again.result, { w: -1, why: 'repetition' }, 'it remembered the first two times');
});

test('a view that\'s junk changes nothing, and neither does a board that can\'t be', () => {
  const g = CHECKERS.create();
  go(g, 'c3d4');
  const before = g.fen();
  for (const bad of [null, {}, { f: 'nonsense' }, { f: '8/8/8/8/8/8/8 b - 0' }, { f: 'x7/8/8/8/8/8/8/8 b - 0' },
    { f: '1M6/8/8/8/8/8/8/8 b - 0' }, { f: '8/8/8/8/8/8/8/m7 b - 0' }, { f: 'M7/8/8/8/8/8/8/8 b - 0' }, { f: '9/8/8/8/8/8/8/8 b - 0' }, { f: '7k/8/8/8/8/8/8/K7 b h3 0' }]) {
    assert.equal(g.load(bad), false, JSON.stringify(bad));
  }
  assert.equal(g.fen(), before);
});

test('the clock runs for the side to move, and running out loses', () => {
  const g = CHECKERS.create({ clock: 10 });
  for (let i = 0; i < 4; i++) g.step();
  same(g.clock, [6, 10]);
  g.step([{ from: sq('c3'), to: sq('d4') }, null]);
  assert.equal(g.turn, 1);
  same(g.clock, [5, 10]);
  for (let i = 0; i < 10; i++) g.step();
  same(g.result, { w: 0, why: 'time' });
});

test('either side can resign, whoever\'s turn it is', () => {
  const g = CHECKERS.create();
  g.step([null, { resign: true }]);
  same(g.result, { w: 0, why: 'resign' });
  const h = CHECKERS.create();
  h.step([{ resign: true }, null]);
  same(h.result, { w: 1, why: 'resign' });
  const not = CHECKERS.create();
  not.step([{ resign: 1 }, { resign: 'yes' }]);
  assert.equal(not.result, null, 'it has to be exactly true');
});

// ---------- the computer ----------
// Plays a whole game of the computer against itself.
function autoplay(levels, seed, cap = 500) {
  const g = CHECKERS.create({ seed, players: [{ name: 'A', ai: levels[0] }, { name: 'B', ai: levels[1] }] });
  for (let i = 0; i < cap * 130 && !g.result; i++) g.step();
  return g;
}

test('the computer takes its time, then moves', () => {
  const g = CHECKERS.create({ seed: 3, players: [{ name: 'A', ai: 1 }, { name: 'B' }] });
  g.step();
  assert.equal(g.ply, 0, 'not straight away');
  for (let i = 0; i < 130 && !g.ply; i++) g.step();
  assert.equal(g.ply, 1);
  assert.equal(g.turn, 1);
  const before = g.fen();
  for (let i = 0; i < 200; i++) g.step();
  assert.equal(g.fen(), before, 'and then waits for you');
});

test('the computer does a double jump a jump at a time, so you can follow it', () => {
  const g = pos('7k/8/5m2/8/3m4/2M5/8/8 b - 0', { seed: 1, players: [{ ai: 3 }, {}] });
  for (let i = 0; i < 130 && !g.ply; i++) g.step();
  assert.equal(g.ply, 1);
  assert.equal(g.holding(), sq('e5'), 'partway through');
  assert.equal(g.turn, 0);
  g.step();
  assert.equal(g.ply, 1, 'it waits a moment');
  for (let i = 0; i < 60 && g.ply === 1; i++) g.step();
  assert.equal(g.ply, 2);
  assert.equal(g.at(sq('g7')), 'M');
  assert.equal(g.turn, 1);
});

test('the same seed plays the same game', () => {
  const a = autoplay([1, 2], 11, 40), b = autoplay([1, 2], 11, 40);
  assert.equal(a.fen(), b.fen());
  assert.notEqual(a.fen(), autoplay([1, 2], 12, 40).fen());
});

test('the computer plays whole games to a proper end at every level', () => {
  for (let level = 1; level <= CHECKERS.LEVELS; level++) {
    const g = autoplay([level, level], level * 7);
    assert.ok(g.result, 'level ' + level + ' finished: ' + g.fen());
    assert.ok(['captured', 'blocked', 'repetition', 'forty'].includes(g.result.why), g.result.why);
  }
});

test('from level 3 up it takes the double jump over the single one', () => {
  // a3 or c3 can each take b4, but c3 over d4 goes on to take f6 as well
  for (let level = 3; level <= CHECKERS.LEVELS; level++) {
    for (let seed = 1; seed <= 5; seed++) {
      const g = pos('1k6/8/5m2/8/1m1m4/M1M5/8/8 b - 0', { seed, players: [{ ai: level }, {}] });
      for (let i = 0; i < 400 && g.turn === 0 && !g.result; i++) g.step();
      assert.equal(g.at(sq('g7')), 'M', 'level ' + level + ' seed ' + seed + ': ' + g.fen());
    }
  }
});

test('a higher level beats a lower one, most of the time', () => {
  let wins = 0, losses = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const white = seed & 1, r = autoplay(white ? [3, 1] : [1, 3], seed).result;
    if (r.w === (white ? 0 : 1)) wins++;
    else if (r.w >= 0) losses++;
  }
  assert.ok(wins > losses, wins + ' wins and ' + losses + ' losses');
});

test('the hardest level still moves quickly', () => {
  const g = CHECKERS.create({ seed: 1, players: [{ ai: CHECKERS.LEVELS }, { ai: CHECKERS.LEVELS }] });
  let worst = 0;
  for (let i = 0; i < 3000 && !g.result && g.ply < 25; i++) {
    const at = performance.now();
    g.step();
    worst = Math.max(worst, performance.now() - at);
  }
  assert.ok(g.ply >= 10, 'it got on with it');
  assert.ok(worst < 500, 'took ' + Math.round(worst) + ' ms');
});

// ---------- the game the server runs ----------
const room = (seed = 1) => checkers.create({ seats: 2, rng: seeded(seed), soft: false });
const pick = (s, a, b) => {
  if (a !== null) checkers.input(s, 0, { pick: a });
  if (b !== null) checkers.input(s, 1, { pick: b });
  checkers.tick(s);
};

test('two players who want different sides get them', () => {
  for (const [a, b] of [[0, 1], [1, 0]]) {
    const s = room();
    pick(s, a, b);
    same(s.side, [a, b]);
    assert.equal(checkers.view(s, 0).me, a);
    assert.equal(checkers.view(s, 1).me, b);
    assert.equal(checkers.view(s, 0).coin, false);
  }
});

test('two players who want the same side leave it to a coin, which can land either way', () => {
  const got = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const s = room(seed);
    pick(s, 1, 1);
    assert.equal(s.side[0] + s.side[1], 1, 'one of each');
    assert.equal(checkers.view(s, 1).coin, true);
    got.add(s.side[0]);
  }
  assert.equal(got.size, 2);
});

test('someone who doesn\'t pick in time gets what\'s left', () => {
  const s = room();
  checkers.input(s, 1, { pick: 0 });
  checkers.tick(s);
  assert.equal(checkers.view(s, 0).ph, 0, 'still waiting on seat 0');
  for (let i = 0; i < checkers.hz * 25; i++) checkers.tick(s);
  assert.equal(checkers.view(s, 0).ph, 1);
  same(s.side, [1, 0]);
});

test('only the player whose turn it is can move, and the rules are the server\'s', () => {
  const s = room();
  pick(s, 1, 0); // seat 1 is black, who goes first
  checkers.input(s, 0, { from: sq('b6'), to: sq('a5') });
  checkers.tick(s);
  assert.equal(s.g.ply, 0, 'red can\'t go first');
  checkers.input(s, 1, { from: sq('c3'), to: sq('c4') });
  checkers.tick(s);
  assert.equal(s.g.ply, 0, 'a man can\'t do that');
  checkers.input(s, 1, { from: sq('c3'), to: sq('d4') });
  checkers.tick(s);
  assert.equal(s.g.ply, 1);
  assert.equal(s.g.at(sq('d4')), 'M');
  same(checkers.view(s, 0).v.l, [sq('c3'), sq('d4')]);
});

test('both jumps of a double jump get through, even between two ticks', () => {
  const s = room();
  pick(s, 0, 1);
  s.g.load({ f: '7k/8/5m2/8/3m4/2M5/8/6M1 b - 0' });
  checkers.input(s, 0, { from: sq('c3'), to: sq('e5') });
  checkers.input(s, 0, { from: sq('e5'), to: sq('g7') });
  assert.equal(checkers.tick(s), undefined);
  assert.equal(s.g.at(sq('g7')), 'M');
  assert.equal(s.g.at(sq('d4')), '');
  assert.equal(s.g.at(sq('f6')), '');
  assert.equal(s.g.turn, 1);
});

test('junk from a browser mid-game does nothing', () => {
  const s = room();
  pick(s, 0, 1);
  const before = s.g.fen();
  for (const bad of [null, 'x', 7, [], { from: 'c3', to: 'd4' }, { from: 18 }, { from: -3, to: 99 }, { resign: 'yes' }, { pick: 1 }]) {
    checkers.input(s, 0, bad);
    assert.equal(checkers.tick(s), undefined);
  }
  assert.equal(s.g.fen(), before);
  same(s.side, [0, 1]);
});

test('the result says which seat won, and a draw is w -1', () => {
  const s = room();
  pick(s, 1, 0); // seat 1 is black
  s.g.load({ f: '8/8/8/4m3/3M4/8/8/8 b - 0' });
  checkers.input(s, 1, { from: sq('d4'), to: sq('f6') });
  same(checkers.tick(s), { w: 1, why: 'captured' });

  const d = room();
  pick(d, 0, 1);
  d.g.load({ f: '7k/8/8/8/8/8/8/K7 b - 79' });
  checkers.input(d, 0, { from: sq('a1'), to: sq('b2') });
  same(checkers.tick(d), { w: -1, why: 'forty' });
});

test('resigning hands it to the other seat, on your turn or not', () => {
  const s = room();
  pick(s, 0, 1);
  checkers.input(s, 1, { resign: true });
  same(checkers.tick(s), { w: 0, why: 'resign' });
  const t = room();
  pick(t, 1, 0);
  checkers.input(t, 1, { resign: true });
  same(checkers.tick(t), { w: 0, why: 'resign' });
});

test('someone who wanders off loses on time, well inside the server\'s half hour limit', () => {
  const s = room();
  pick(s, 1, 0); // seat 0 is red
  checkers.input(s, 1, { from: sq('c3'), to: sq('d4') });
  let r, ticks = 0;
  for (; r === undefined && ticks < checkers.hz * 60 * 15; ticks++) r = checkers.tick(s);
  same(r, { w: 1, why: 'time' });
  assert.ok(ticks / checkers.hz <= 601, 'about ten minutes, got ' + ticks / checkers.hz + ' seconds');
});

test('a view is small enough to send five times a second, and a browser can load it', () => {
  const s = room();
  pick(s, 0, 1);
  go(s.g, 'c3d4 b6a5');
  const v = plain(checkers.view(s, 1));
  assert.equal(v.me, 1);
  assert.ok(JSON.stringify(v).length < 200, JSON.stringify(v));
  const copy = CHECKERS.create();
  assert.ok(copy.load(v.v));
  assert.equal(copy.fen(), s.g.fen());
  assert.equal(copy.ply, 2);
});
