// Chess with no browser: the rules (js/chess.js), how the computer plays, and the game the server
// runs (games/chess.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as chess from '../games/chess.js';
import { seeded } from '../rooms.js';

const CHESS = chess.load();
// (the rules run in a vm of their own, so what comes out of them has different Objects and Arrays)
const plain = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);
const sq = (name) => (name.charCodeAt(0) - 97) + (+name[1] - 1) * 8;
const go = (g, line) => {
  for (const mv of line.split(' ')) {
    assert.ok(g.play({ from: sq(mv.slice(0, 2)), to: sq(mv.slice(2, 4)), promo: mv[4] || '' }), mv + ' should be legal');
  }
};

// How many ways the game can go from a position, to a depth. Every chess program has to get the
// same numbers as these, which were worked out long ago: a wrong one means a wrong rule somewhere.
function perft(g, depth) {
  if (depth === 0) return 1;
  let n = 0;
  const saved = g.save();
  for (const m of g.moves()) {
    g.play(m);
    n += g.result && depth > 1 ? 0 : perft(g, depth - 1);
    g.load(saved);
  }
  return n;
}
const PERFT = [
  ['the start', CHESS.START, [20, 400, 8902]],
  ['Kiwipete: castling, pins and en passant all at once', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['a rook endgame with en passant pins', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['promotions in every direction', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['promoting by taking a rook', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['a quiet middlegame', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];
for (const [what, fen, counts] of PERFT) {
  test('every legal move and no others: ' + what, () => {
    counts.forEach((want, i) => assert.equal(perft(CHESS.create({ fen }), i + 1), want, 'depth ' + (i + 1)));
  });
}

test('a move has to be legal, and it has to be your turn', () => {
  const g = CHESS.create();
  assert.equal(g.play({ from: sq('e2'), to: sq('e5') }), false);
  assert.equal(g.play({ from: sq('e7'), to: sq('e5') }), false, 'black can\'t go first');
  assert.equal(g.turn, 0);
  assert.equal(g.ply, 0);
  assert.equal(g.play({ from: sq('e2'), to: sq('e4') }), true);
  assert.equal(g.turn, 1);
  same(g.last, [sq('e2'), sq('e4')]);
});

test('whatever a tampered browser sends does nothing', () => {
  const g = CHESS.create();
  const before = g.fen();
  for (const bad of [null, {}, 'e2e4', { from: 'e2', to: 'e4' }, { from: -1, to: 3 }, { from: 12, to: 64 }, { from: 12.5, to: 28 },
    { from: 12, to: NaN }, { from: 12, to: 28, promo: 'q' }, { from: 28, to: 36 }, { from: [12], to: [28] }]) {
    assert.equal(g.play(bad), false, JSON.stringify(bad));
  }
  assert.equal(g.fen(), before);
  // on a pawn that isn't promoting, odd promotions are just left out, rather than breaking it
  for (const odd of [7, {}, '__proto__', 'constructor', 'qq']) {
    assert.equal(CHESS.create().play({ from: 12, to: 28, promo: odd }), true, JSON.stringify(odd));
    const last = CHESS.create({ fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' });
    assert.equal(last.play({ from: sq('a7'), to: sq('a8'), promo: odd }), false, 'a pawn has to become something: ' + JSON.stringify(odd));
  }
});

test('a pawn reaching the end has to say what it becomes, and can\'t become a king', () => {
  const fresh = () => CHESS.create({ fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' });
  const a7 = sq('a7'), a8 = sq('a8');
  for (const bad of ['', 'k', 'p', 'x']) assert.equal(fresh().play({ from: a7, to: a8, promo: bad }), false, 'promo ' + bad);
  for (const [promo, letter] of [['q', 'Q'], ['r', 'R'], ['b', 'B'], ['n', 'N']]) {
    const g = fresh();
    assert.equal(g.play({ from: a7, to: a8, promo }), true);
    assert.equal(g.at(a8), letter);
    assert.equal(g.at(a7), '');
  }
});

test('castling moves the rook too, and not after the king has moved or through check', () => {
  const g = CHESS.create();
  go(g, 'g1f3 g8f6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8');
  assert.equal(g.at(sq('g1')), 'K');
  assert.equal(g.at(sq('f1')), 'R');
  assert.equal(g.at(sq('h1')), '');
  assert.equal(g.at(sq('g8')), 'k');
  assert.equal(g.at(sq('f8')), 'r');

  const moved = CHESS.create({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
  go(moved, 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(moved.moves(sq('e1')).some((m) => m.to === sq('g1')), false, 'the king has moved');

  const through = CHESS.create({ fen: '4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1' });
  assert.equal(through.moves(sq('e1')).some((m) => m.to === sq('g1')), false, 'f1 is covered by the rook on f8');
  assert.equal(through.moves(sq('e1')).some((m) => m.to === sq('c1')), true, 'the long way round is fine');
});

test('en passant takes the pawn that went past, and only straight away', () => {
  const g = CHESS.create();
  go(g, 'e2e4 a7a6 e4e5 d7d5 e5d6');
  assert.equal(g.at(sq('d6')), 'P');
  assert.equal(g.at(sq('d5')), '', 'the black pawn is gone');

  const late = CHESS.create();
  go(late, 'e2e4 a7a6 e4e5 d7d5 a2a3 a6a5');
  assert.equal(late.moves(sq('e5')).some((m) => m.to === sq('d6')), false);
});

test('a pinned piece can\'t move, and you have to get out of check', () => {
  const pinned = CHESS.create({ fen: '4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1' });
  same(pinned.moves(sq('e2')), []);
  const checked = CHESS.create({ fen: '4r2k/8/8/8/8/8/N7/4K3 w - - 0 1' });
  assert.equal(checked.check(), true);
  assert.ok(checked.moves().every((m) => m.from === sq('e1')), 'nothing but the king can help');
});

test('checkmate wins it', () => {
  const g = CHESS.create();
  go(g, 'f2f3 e7e5 g2g4 d8h4');
  same(g.result, { w: 1, why: 'mate' });
  assert.ok(g.events.includes('over'));
  same(g.moves(), []);
  assert.equal(g.play({ from: sq('a2'), to: sq('a3') }), false, 'it\'s over');
});

test('stalemate is a draw', () => {
  const g = CHESS.create({ fen: '7k/5Q2/8/6K1/8/8/8/8 w - - 0 1' });
  go(g, 'g5g6');
  same(g.result, { w: -1, why: 'stalemate' });
});

test('not enough left to give checkmate is a draw', () => {
  const take = (fen, mv) => { const g = CHESS.create({ fen }); go(g, mv); return g.result; };
  same(take('7k/8/8/8/8/8/p7/K7 w - - 0 1', 'a1a2'), { w: -1, why: 'material' }, 'kings alone');
  same(take('7k/8/8/8/8/8/n7/KN6 w - - 0 1', 'a1a2'), { w: -1, why: 'material' }, 'a knight left');
  same(take('7k/8/8/8/8/1b6/n7/KB6 w - - 0 1', 'a1b2'), null, 'a bishop and a knight can still do it');
  same(take('7k/7b/8/8/8/8/n7/KB6 w - - 0 1', 'a1a2'), { w: -1, why: 'material' }, 'a bishop each, on the same colour');
  same(take('5b1k/8/8/8/8/8/n7/KB6 w - - 0 1', 'a1a2'), null, 'a bishop each, on different colours');
});

test('the same position three times is a draw', () => {
  const g = CHESS.create();
  go(g, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
  assert.equal(g.result, null);
  go(g, 'f6g8');
  same(g.result, { w: -1, why: 'repetition' });
});

test('fifty moves each with no pawn moved and nothing taken is a draw', () => {
  const g = CHESS.create({ fen: '7k/8/8/8/8/8/P7/K6R w - - 99 80' });
  go(g, 'h1h2');
  same(g.result, { w: -1, why: 'fifty' });
});

test('saving and loading gives the same game, repetitions and all', () => {
  const g = CHESS.create({ seed: 5 });
  go(g, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
  const copy = CHESS.create();
  copy.load(JSON.parse(JSON.stringify(g.save())));
  assert.equal(copy.fen(), g.fen());
  same(copy.last, g.last);
  assert.equal(copy.ply, 7);
  go(copy, 'f6g8');
  same(copy.result, { w: -1, why: 'repetition' }, 'it remembered the first two times');
});

test('a view that\'s junk changes nothing', () => {
  const g = CHESS.create();
  go(g, 'e2e4');
  const before = g.fen();
  for (const bad of [null, {}, { f: 'nonsense' }, { f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w' }, { f: '8/8/8/8/8/8/8/8 w - - 0 1' }, { f: 'xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w' }]) {
    assert.equal(g.load(bad), false, JSON.stringify(bad));
  }
  assert.equal(g.fen(), before);
});

test('the clock runs for the side to move, and running out loses', () => {
  const g = CHESS.create({ clock: 10 });
  for (let i = 0; i < 4; i++) g.step();
  same(g.clock, [6, 10]);
  g.step([{ from: sq('e2'), to: sq('e4') }, null]);
  assert.equal(g.turn, 1);
  same(g.clock, [5, 10]);
  for (let i = 0; i < 10; i++) g.step();
  same(g.result, { w: 0, why: 'time' });
});

test('running out of time against a lone king is only a draw', () => {
  const g = CHESS.create({ clock: 3, fen: '7k/8/8/8/8/8/P7/K7 b - - 0 1' });
  for (let i = 0; i < 3; i++) g.step();
  same(g.result, { w: 0, why: 'time' }, 'a pawn could still queen');
  const lone = CHESS.create({ clock: 3, fen: '7k/7p/8/8/8/8/8/K7 w - - 0 1' });
  for (let i = 0; i < 3; i++) lone.step();
  same(lone.result, { w: 1, why: 'time' });
  const nothing = CHESS.create({ clock: 3, fen: '7k/7p/8/8/8/8/8/K7 b - - 0 1' });
  for (let i = 0; i < 3; i++) nothing.step();
  same(nothing.result, { w: -1, why: 'time' }, 'white has nothing left to mate with');
});

test('either side can resign, whoever\'s turn it is', () => {
  const g = CHESS.create();
  g.step([null, { resign: true }]);
  same(g.result, { w: 0, why: 'resign' });
  const h = CHESS.create();
  h.step([{ resign: true }, null]);
  same(h.result, { w: 1, why: 'resign' });
  const not = CHESS.create();
  not.step([{ resign: 1 }, { resign: 'yes' }]);
  assert.equal(not.result, null, 'it has to be exactly true');
});

// ---------- the computer ----------
// Plays a whole game of the computer against itself, checking each move as it goes.
function autoplay(levels, seed, cap = 600) {
  const g = CHESS.create({ seed, players: [{ name: 'A', ai: levels[0] }, { name: 'B', ai: levels[1] }] });
  for (let i = 0; i < cap * 130 && !g.result; i++) g.step();
  return g;
}

test('the computer takes its time, then moves', () => {
  const g = CHESS.create({ seed: 3, players: [{ name: 'A', ai: 1 }, { name: 'B' }] });
  g.step();
  assert.equal(g.ply, 0, 'not straight away');
  for (let i = 0; i < 130 && !g.ply; i++) g.step();
  assert.equal(g.ply, 1);
  assert.equal(g.turn, 1);
  const before = g.fen();
  for (let i = 0; i < 200; i++) g.step();
  assert.equal(g.fen(), before, 'and then waits for you');
});

test('the same seed plays the same game', () => {
  const a = autoplay([1, 2], 11, 60), b = autoplay([1, 2], 11, 60);
  assert.equal(a.fen(), b.fen());
  assert.notEqual(a.fen(), autoplay([1, 2], 12, 60).fen());
});

test('the computer plays whole games to a proper end at every level', () => {
  for (let level = 1; level <= CHESS.LEVELS; level++) {
    const g = autoplay([level, level], level * 7);
    assert.ok(g.result, 'level ' + level + ' finished');
    assert.ok(['mate', 'stalemate', 'repetition', 'fifty', 'material'].includes(g.result.why), g.result.why);
  }
});

test('from level 3 up it always sees a checkmate in one, and takes a free queen', () => {
  const mate = '6k1/5ppp/8/8/8/8/8/K3R3 w - - 0 1'; // Re8 is mate
  const free = '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1'; // the pawn can take the queen
  for (let level = 3; level <= CHESS.LEVELS; level++) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = CHESS.create({ fen: mate, seed, players: [{ ai: level }, {}] });
      for (let i = 0; i < 130 && !g.ply; i++) g.step();
      same(g.result, { w: 0, why: 'mate' }, 'level ' + level + ' seed ' + seed);
      const h = CHESS.create({ fen: free, seed, players: [{ ai: level }, {}] });
      for (let i = 0; i < 130 && !h.ply; i++) h.step();
      assert.equal(h.at(sq('d5')), 'P', 'level ' + level + ' seed ' + seed);
    }
  }
});

test('even running out of budget it doesn\'t throw a piece away', () => {
  // A rook hanging to a pawn, in a position busy enough to use up the budget at every level:
  // a move that only got a glance mustn't win out over one that was looked at properly.
  const busy = 'r2q1rk1/pp2bppp/2n1bn2/2pp4/3P4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 10';
  for (let seed = 1; seed <= 8; seed++) {
    const g = CHESS.create({ fen: busy, seed, players: [{ ai: CHESS.LEVELS }, {}] });
    for (let i = 0; i < 130 && !g.ply; i++) g.step();
    assert.equal(g.ply, 1);
    const reply = CHESS.create({ fen: g.fen() });
    const piece = { P: 100, N: 320, B: 330, R: 500, Q: 900 };
    const [, to] = g.last;
    const taken = reply.moves().some((m) => m.to === to);
    if (taken) assert.ok(piece[g.at(to)] <= 330, 'seed ' + seed + ' left a ' + g.at(to) + ' where it can be taken: ' + g.fen());
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
  const g = CHESS.create({ seed: 1, fen: 'r2q1rk1/pp2bppp/2n1bn2/2pp4/3P4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 10', players: [{ ai: CHESS.LEVELS }, {}] });
  let worst = 0;
  for (let i = 0; i < 200 && !g.ply; i++) {
    const at = performance.now();
    g.step();
    worst = Math.max(worst, performance.now() - at);
  }
  assert.equal(g.ply, 1);
  assert.ok(worst < 500, 'took ' + Math.round(worst) + ' ms');
});

// ---------- the game the server runs ----------
const room = (seed = 1) => chess.create({ seats: 2, rng: seeded(seed), soft: false });
const pick = (s, a, b) => {
  if (a !== null) chess.input(s, 0, { pick: a });
  if (b !== null) chess.input(s, 1, { pick: b });
  chess.tick(s);
};

test('two players who want different sides get them', () => {
  for (const [a, b] of [[0, 1], [1, 0]]) {
    const s = room();
    pick(s, a, b);
    same(s.side, [a, b]);
    assert.equal(chess.view(s, 0).me, a);
    assert.equal(chess.view(s, 1).me, b);
    assert.equal(chess.view(s, 0).coin, false);
  }
});

test('two players who want the same side leave it to a coin, which can land either way', () => {
  const got = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const s = room(seed);
    pick(s, 0, 0);
    assert.equal(s.side[0] + s.side[1], 1, 'one of each');
    assert.equal(chess.view(s, 1).coin, true);
    got.add(s.side[0]);
  }
  assert.equal(got.size, 2);
});

test('it waits for both, and someone who doesn\'t pick in time gets what\'s left', () => {
  const s = room();
  chess.input(s, 1, { pick: 0 });
  chess.tick(s);
  assert.equal(chess.view(s, 0).ph, 0, 'still waiting on seat 0');
  assert.equal(chess.view(s, 1).mine, 0);
  for (let i = 0; i < chess.hz * 25; i++) chess.tick(s);
  assert.equal(chess.view(s, 0).ph, 1);
  same(s.side, [1, 0]);
  assert.equal(s.coin, false);

  const nobody = room();
  for (let i = 0; i < chess.hz * 25; i++) chess.tick(nobody);
  assert.equal(chess.view(nobody, 0).ph, 1, 'it still starts if nobody picks');
  assert.equal(nobody.side[0] + nobody.side[1], 1);
});

test('a bad pick is ignored, and you can\'t move before it starts', () => {
  const s = room();
  for (const bad of [null, 'white', {}, { pick: 2 }, { pick: '0' }, { pick: -1 }, { pick: [0] }, { from: 12, to: 28 }]) chess.input(s, 0, bad);
  same(s.want, [null, null]);
  assert.equal(s.g, null);
});

test('only the player whose turn it is can move, and the rules are the server\'s', () => {
  const s = room();
  pick(s, 1, 0); // seat 1 is white
  chess.input(s, 0, { from: sq('e7'), to: sq('e5') });
  chess.tick(s);
  assert.equal(s.g.ply, 0, 'black can\'t go first');
  chess.input(s, 1, { from: sq('e2'), to: sq('e5') });
  chess.tick(s);
  assert.equal(s.g.ply, 0, 'a pawn can\'t do that');
  chess.input(s, 1, { from: sq('e2'), to: sq('e4') });
  chess.tick(s);
  assert.equal(s.g.ply, 1);
  assert.equal(s.g.at(sq('e4')), 'P');
  same(chess.view(s, 0).v.l, [sq('e2'), sq('e4')]);
});

test('junk from a browser mid-game does nothing', () => {
  const s = room();
  pick(s, 0, 1);
  const before = s.g.fen();
  for (const bad of [null, 'x', 7, [], { from: 'e2', to: 'e4' }, { from: 12 }, { from: -3, to: 99 }, { resign: 'yes' }, { pick: 1 }]) {
    chess.input(s, 0, bad);
    assert.equal(chess.tick(s), undefined);
  }
  assert.equal(s.g.fen(), before);
  same(s.side, [0, 1]);
});

test('the result says which seat won', () => {
  const s = room();
  pick(s, 1, 0); // seat 1 is white
  for (const [seat, from, to] of [[1, 'f2', 'f3'], [0, 'e7', 'e5'], [1, 'g2', 'g4']]) {
    chess.input(s, seat, { from: sq(from), to: sq(to) });
    assert.equal(chess.tick(s), undefined);
  }
  chess.input(s, 0, { from: sq('d8'), to: sq('h4') });
  same(chess.tick(s), { w: 0, why: 'mate' });
});

test('resigning hands it to the other seat, on your turn or not', () => {
  const s = room();
  pick(s, 0, 1);
  chess.input(s, 1, { resign: true });
  same(chess.tick(s), { w: 0, why: 'resign' });
  const t = room();
  pick(t, 1, 0);
  chess.input(t, 0, { resign: true });
  same(chess.tick(t), { w: 1, why: 'resign' });
});

test('a draw is w -1', () => {
  const s = room();
  pick(s, 0, 1);
  s.g.load({ f: '7k/5Q2/8/6K1/8/8/8/8 w - - 0 1' });
  chess.input(s, 0, { from: sq('g5'), to: sq('g6') });
  same(chess.tick(s), { w: -1, why: 'stalemate' });
});

test('someone who wanders off loses on time, well inside the server\'s half hour limit', () => {
  const s = room();
  pick(s, 1, 0); // seat 0 is black
  chess.input(s, 1, { from: sq('e2'), to: sq('e4') });
  let r, ticks = 0;
  for (; r === undefined && ticks < chess.hz * 60 * 15; ticks++) r = chess.tick(s);
  same(r, { w: 1, why: 'time' });
  assert.ok(ticks / chess.hz <= 601, 'about ten minutes, got ' + ticks / chess.hz + ' seconds');
});

test('a view is small enough to send five times a second, and it\'s plain data', () => {
  const s = room();
  pick(s, 0, 1);
  for (const [seat, from, to] of [[0, 'g1', 'f3'], [1, 'g8', 'f6'], [0, 'f3', 'g1'], [1, 'f6', 'g8']]) {
    chess.input(s, seat, { from: sq(from), to: sq(to) });
    chess.tick(s);
  }
  const v = JSON.parse(JSON.stringify(chess.view(s, 1)));
  assert.equal(v.me, 1);
  assert.ok(JSON.stringify(v).length < 200, JSON.stringify(v));
  const copy = CHESS.create();
  assert.ok(copy.load(v.v), 'a browser can load it');
  assert.equal(copy.fen(), s.g.fen());
  assert.equal(copy.ply, 4);
});
