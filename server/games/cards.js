// Morale Madness between two players (CardsGame in js/game.js draws it). The rules are js/cards.js and
// the cards js/cardlist.js, the same ones the browser plays a coworker with. They're read from the
// site's files the first time anyone plays, so the server needs the whole repository, not just this
// folder. If they can't be read, the game stops as soon as it starts and nobody wins.
//
// A browser first sends { deck: ids }, the deck it wants to play. A deck that isn't legal, or one
// that hasn't come by the time DECKS runs out, is swapped for the starter deck that everyone has.
// (The server can check a deck is legal, but not that you own the cards: that's the same honour
// system as the scores.) After that it sends what its player did, as g.act() in the rules takes it,
// and they decide: anything that isn't a legal move does nothing.
//
// Two things here are different from the other games, because a card game has things to hide:
//   - The shuffle comes from a seed of the server's own, not the room's rng. That comes from the
//     challenger's browser, so they could work out everybody's cards from it.
//   - Each player is only sent g.view(their seat): the other hand and both decks are only counts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

export const hz = 5; // each tick is STEPS of the rules' (they run at 60 a second)
const STEPS = 12;
const TURN = 75 * 60; // the rules' ticks you get for a turn
const DECKS = 8 * hz; // ticks to wait for both decks
const EVENTS = 30; // how many of the latest events each view has (enough for a whole turn)
const FULL = 2 * hz; // ticks between whole views when nothing's happening, in case one got lost

// js/cards.js's CARDS.VERSION. A test and tools/check_games.mjs both check this is up to date. It's
// here so that a change to the rules or the cards has to touch this folder too, because Render only
// redeploys the server when something in server/ changes. A browser that has different rules from
// the server is told so and doesn't start.
export const VERSION = '1n2a80j';

let rules;
// the rules, or null if they can't be loaded
export function load() {
  if (rules !== undefined) return rules;
  try {
    const ctx = vm.createContext({ window: {} });
    for (const f of ['cardlist.js', 'cards.js']) {
      vm.runInContext(fs.readFileSync(new URL('../../js/' + f, import.meta.url), 'utf8'), ctx, { filename: 'js/' + f });
    }
    rules = ctx.window.CARDS || null;
  } catch (e) {
    rules = null;
  }
  if (!rules) console.error('js/cards.js could not be loaded, so that game is off');
  return rules;
}

export function create() {
  const CARDS = load();
  if (!CARDS) throw new Error('js/cards.js could not be loaded');
  // decks: what each seat asked to play. g: the game, once it's dealt. said, quiet: the last whole
  // view each seat was sent, and how many ticks ago.
  return { CARDS, t: 0, decks: [null, null], g: null, said: [null, null], quiet: [0, 0] };
}

export function input(s, seat, d) {
  if (!d || typeof d !== 'object') return;
  if (s.g) s.g.act(seat, d);
  else if (d.deck !== undefined && !s.decks[seat]) s.decks[seat] = s.CARDS.deckProblem(d.deck) ? s.CARDS.STARTER : d.deck.slice();
}

export function tick(s) {
  if (!s.g) {
    if ((!s.decks[0] || !s.decks[1]) && ++s.t < DECKS) return undefined;
    s.g = s.CARDS.create({
      decks: s.decks.map((d) => d || s.CARDS.STARTER),
      seed: crypto.randomInt(1, 2 ** 31),
      turn: TURN,
    });
    return undefined;
  }
  for (let i = 0; i < STEPS && !s.g.result; i++) s.g.step();
  const r = s.g.result;
  return r ? { w: r.w, why: r.why } : undefined;
}

// cv is the rules' version. While it's being dealt that's all there is. After that it's g.view(seat)
// in the rules, or when nothing's changed since the last one just { q: 1, clock }.
export function view(s, seat) {
  const cv = s.CARDS.VERSION;
  if (!s.g) return { ph: 'deal', cv };
  const v = s.g.view(seat), clock = v.clock;
  v.clock = 0;
  v.ev = v.ev.slice(-EVENTS);
  v.cv = cv;
  const said = JSON.stringify(v);
  if (said === s.said[seat] && ++s.quiet[seat] < FULL) return { q: 1, clock };
  s.said[seat] = said;
  s.quiet[seat] = 0;
  v.clock = clock;
  return v;
}
