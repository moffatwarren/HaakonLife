// What chess and checkers have in common as games the server runs: they're played the same way, on
// the lunch room tables (js/game.js draws both with tableGame). This isn't a game itself, so it
// isn't in index.js: chess.js and checkers.js each make theirs with tableGame(), from their rules.
// Those are read from the site's files the first time anyone plays, so the server needs the whole
// repository, not just this folder. If they can't be read, the game stops as soon as it starts and
// nobody wins.
//
// First both players say which side they'd like. If they want different ones they get them, and
// if they want the same one a coin decides. Anyone who hasn't said by the time PICK runs out
// gets whatever's left. Then each has a clock of ten minutes for the whole game, so someone who
// wanders off loses rather than holding the other player up: the two clocks come to less than the
// half hour a game on this server is allowed (MAX_MS in rooms.js).
//
// A browser sends { pick: 0 or 1 } (side 0 or side 1), { from, to, promo } or { resign: true }. A
// move goes straight to the rules as it arrives, so two in a row (the jumps of a double jump) can't
// get in each other's way, and what they say is the end of it: a square that isn't one, or a move
// that isn't legal, does nothing.
import fs from 'node:fs';
import vm from 'node:vm';

const hz = 5; // each tick is STEPS of the game's (they run at 60 a second)
const STEPS = 12;
const PICK = 20 * hz; // ticks you get to pick a side
const CLOCK = 10 * 60 * 60; // the game's ticks each side gets

// file: the rules, in js/. name: what they call themselves on window.
export function tableGame(file, name) {
  let engine;
  // the rules, or null if they can't be loaded
  function load() {
    if (engine !== undefined) return engine;
    try {
      const ctx = vm.createContext({ window: {} });
      vm.runInContext(fs.readFileSync(new URL('../../js/' + file, import.meta.url), 'utf8'), ctx, { filename: 'js/' + file });
      engine = ctx.window[name] || null;
    } catch (e) {
      engine = null;
    }
    if (!engine) console.error('js/' + file + ' could not be loaded, so that game is off');
    return engine;
  }

  function create({ rng }) {
    const rules = load();
    if (!rules) throw new Error('js/' + file + ' could not be loaded');
    // want: the side each seat asked for. side: the side each seat got, once that's settled.
    // coin: a coin decided it. g: the game. resign: the seat that's just resigned, if one has
    return { rng, rules, t: 0, want: [null, null], side: null, coin: false, g: null, resign: null };
  }

  function input(s, seat, d) {
    if (!d || typeof d !== 'object') return;
    if (!s.g) {
      if (d.pick === 0 || d.pick === 1) s.want[seat] = d.pick;
      return;
    }
    if (d.resign === true) s.resign = seat;
    else if (s.side[seat] === s.g.turn) s.g.play({ from: d.from, to: d.to, promo: typeof d.promo === 'string' ? d.promo.slice(0, 1) : '' });
  }

  function settle(s) {
    const [a, b] = s.want;
    let first; // the side seat 0 plays
    if (a === null && b === null) first = s.rng() < 0.5 ? 0 : 1;
    else if (a === null) first = 1 - b;
    else if (b === null || a !== b) first = a;
    else { first = s.rng() < 0.5 ? 0 : 1; s.coin = true; }
    s.side = [first, 1 - first];
    s.g = s.rules.create({ clock: CLOCK });
  }

  function tick(s) {
    if (!s.g) {
      if ((s.want[0] === null || s.want[1] === null) && ++s.t < PICK) return undefined;
      settle(s);
      return undefined;
    }
    const inputs = [null, null];
    if (s.resign !== null) inputs[s.side[s.resign]] = { resign: true };
    s.resign = null;
    for (let i = 0; i < STEPS && !s.g.result; i++) s.g.step(i ? null : inputs);
    const r = s.g.result;
    if (!r) return undefined;
    // who won as a seat, like every other game here (-1 for a draw)
    return { w: r.w < 0 ? -1 : s.side.indexOf(r.w), why: r.why };
  }

  // While they're picking: ph 0, s (your seat), mine (the side you asked for) and t (ticks left to
  // pick). Playing: ph 1, s, me (your side), coin (a coin decided it) and v, the game (g.view() in
  // the rules: the position, the last move, the clocks and how it ended).
  function view(s, seat) {
    if (!s.g) return { ph: 0, s: seat, mine: s.want[seat], t: Math.max(0, PICK - s.t) };
    return { ph: 1, s: seat, me: s.side[seat], coin: s.coin, v: s.g.view() };
  }

  return { hz, load, create, input, tick, view };
}
