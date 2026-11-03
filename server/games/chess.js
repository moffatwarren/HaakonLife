// Chess between two players, on the lunch room table (ChessGame in js/game.js draws it). The
// rules are js/chess.js, the same ones the browser plays against a coworker, read from the site's
// files the first time anyone plays, so the server needs the whole repository, not just this
// folder. If they can't be read, the game stops as soon as it starts and nobody wins.
//
// First both players say which side they'd like. If they want different ones they get them, and
// if they want the same one a coin decides. Anyone who hasn't said by the time PICK runs out
// gets whatever's left. Then each has a clock of ten minutes for the whole game, so someone who
// wanders off loses rather than holding the other player up: the two clocks come to less than the
// half hour a game on this server is allowed (MAX_MS in rooms.js).
//
// A browser sends { pick: 0 or 1 } (white or black), { from, to, promo } or { resign: true }.
import fs from 'node:fs';
import vm from 'node:vm';

export const hz = 5; // each tick is STEPS of the game's (it runs at 60 a second)
const STEPS = 12;
const PICK = 20 * hz; // ticks you get to pick a side
const CLOCK = 10 * 60 * 60; // the game's ticks each side gets

let engine;
// js/chess.js's CHESS, or null if it can't be loaded
export function load() {
  if (engine !== undefined) return engine;
  try {
    const ctx = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(new URL('../../js/chess.js', import.meta.url), 'utf8'), ctx, { filename: 'js/chess.js' });
    engine = ctx.window.CHESS || null;
  } catch (e) {
    engine = null;
  }
  if (!engine) console.error('Live chess is off: js/chess.js could not be loaded');
  return engine;
}

export function create({ rng }) {
  const CHESS = load();
  if (!CHESS) throw new Error('js/chess.js could not be loaded');
  // want: the side each seat asked for. side: the side each seat got, once that's settled.
  // coin: a coin decided it. g: the game, and held: what each seat has sent since the last tick
  return { rng, CHESS, t: 0, want: [null, null], side: null, coin: false, g: null, held: [null, null] };
}

export function input(s, seat, d) {
  if (!d || typeof d !== 'object') return;
  if (!s.g) {
    if (d.pick === 0 || d.pick === 1) s.want[seat] = d.pick;
    return;
  }
  if (d.resign === true) s.held[seat] = { resign: true };
  // (a move's only held for whoever's turn it is; the rules
  // check the rest: a square that isn't one, or a move that isn't legal, just does nothing)
  else if (s.side[seat] === s.g.turn) {
    s.held[seat] = { from: d.from, to: d.to, promo: typeof d.promo === 'string' ? d.promo.slice(0, 1) : '' };
  }
}

function settle(s) {
  const [a, b] = s.want;
  let first; // the side seat 0 plays
  if (a === null && b === null) first = s.rng() < 0.5 ? 0 : 1;
  else if (a === null) first = 1 - b;
  else if (b === null || a !== b) first = a;
  else { first = s.rng() < 0.5 ? 0 : 1; s.coin = true; }
  s.side = [first, 1 - first];
  s.g = s.CHESS.create({ clock: CLOCK });
}

export function tick(s) {
  if (!s.g) {
    if ((s.want[0] === null || s.want[1] === null) && ++s.t < PICK) return undefined;
    settle(s);
    return undefined;
  }
  // what each side did, rather than each seat
  const inputs = [null, null];
  inputs[s.side[0]] = s.held[0];
  inputs[s.side[1]] = s.held[1];
  s.held = [null, null];
  for (let i = 0; i < STEPS && !s.g.result; i++) s.g.step(i ? null : inputs);
  const r = s.g.result;
  if (!r) return undefined;
  // who won as a seat, like every other game here (-1 for a draw)
  return { w: r.w < 0 ? -1 : s.side.indexOf(r.w), why: r.why };
}

// While they're picking: ph 0, s (your seat), mine (the side you asked for) and t (ticks left to
// pick). Playing: ph 1, s, me (your side), coin (a coin decided it) and v, the game (g.view() in
// js/chess.js: the position, the last move, the clocks and how it ended).
export function view(s, seat) {
  if (!s.g) return { ph: 0, s: seat, mine: s.want[seat], t: Math.max(0, PICK - s.t) };
  return { ph: 1, s: seat, me: s.side[seat], coin: s.coin, v: s.g.view() };
}
