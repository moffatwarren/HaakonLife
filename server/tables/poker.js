// Spring Roll Hold'em at the poker table in Cody's casino, for up to four people at once
// (LivePoker in js/game.js draws it; PokerApp there is the same game against Cody and
// Dmitriy). Anyone can sit down while there's a seat: you get BUY_IN spring rolls, and if
// a hand is already going you're dealt in from the next one. With one player it waits
// for a second. The blinds stay put, since people come and go. Run out of rolls and you
// have to get up (you can sit straight back down for a fresh BUY_IN).
//
// Cards are {r: 2-14 (14 = ace), s: 0-3 (spades, hearts, diamonds, clubs)}, as in the
// browser.
export const hz = 10;
export const MAX = 4, BUY_IN = 200, SB = 2, BB = 4;
const TURN = 30 * hz; // ticks you get to act before you're checked or folded
const IDLE = 2; // turns in a row that run out before you're got up from the table
const RESULT = 4 * hz; // ticks the end of a hand stays up before the next one is dealt
const START = 2 * hz; // ticks before the first hand once a second player sits down

// The best five-card hand out of up to seven cards, as a number: higher beats lower,
// equal is a split. The same as handValue in js/game.js.
export function handValue(cards) {
  const cnt = Array(15).fill(0), bySuit = [[], [], [], []];
  for (const c of cards) { cnt[c.r]++; bySuit[c.s].push(c.r); }
  const pack = (cat, ranks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (ranks[i] || 0); return v; };
  const straightTop = (has) => {
    for (let top = 14; top >= 5; top--) {
      let r = top;
      while (r > top - 5 && has(r === 1 ? 14 : r)) r--;
      if (r === top - 5) return top;
    }
    return 0;
  };
  for (const suit of bySuit) if (suit.length >= 5) {
    const sf = straightTop((r) => suit.includes(r));
    if (sf) return pack(8, [sf]);
  }
  const groups = [];
  for (let r = 14; r >= 2; r--) if (cnt[r]) groups.push([cnt[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const others = (...not) => groups.map((g) => g[1]).filter((r) => !not.includes(r)).sort((a, b) => b - a);
  const [g0, g1] = groups;
  if (g0[0] === 4) return pack(7, [g0[1], others(g0[1])[0]]);
  if (g0[0] === 3 && g1 && g1[0] >= 2) return pack(6, [g0[1], g1[1]]);
  const flush = bySuit.find((s) => s.length >= 5);
  if (flush) return pack(5, flush.slice().sort((a, b) => b - a));
  const st = straightTop((r) => cnt[r] > 0);
  if (st) return pack(4, [st]);
  if (g0[0] === 3) return pack(3, [g0[1], ...others(g0[1]).slice(0, 2)]);
  if (g0[0] === 2 && g1 && g1[0] === 2) return pack(2, [g0[1], g1[1], others(g0[1], g1[1])[0]]);
  if (g0[0] === 2) return pack(1, [g0[1], ...others(g0[1]).slice(0, 3)]);
  return pack(0, others());
}
const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
const handName = (v) => HAND_NAMES[Math.floor(v / 759375)];

// s.seats holds MAX seats, null when empty. A seat is { id, n (their name), stack, hand,
// dealt (in this hand), folded, allIn, bet (this round), total (this hand), acted, show,
// idle (turns run out in a row), left }. Someone who gets up mid-hand stays in their seat,
// folded and `left`, until the hand is over, so what they put in stays in the pot.
// ph: 'wait' (not enough players), 'play' or 'result'. A pause in the play (dealing the
// next card, say) is `timer` ticks and then the step named `next`.
export function create({ rng }) {
  return {
    rng, seats: Array(MAX).fill(null), ph: 'wait', hn: 0, button: -1, deck: [], board: [], street: 0,
    toAct: -1, clock: 0, curBet: 0, minRaise: BB, timer: 0, next: null, from: 0,
    log: [], ev: 0, snd: '', out: [],
  };
}

const at = (s, id) => s.seats.findIndex((p) => p && p.id === id && !p.left);
const inHand = (s) => s.seats.filter((p) => p && p.dealt && !p.folded);
const canAct = (s) => inHand(s).filter((p) => !p.allIn);
const pot = (s) => s.seats.reduce((n, p) => n + (p ? p.total : 0), 0);
function nextSeat(s, i, ok) {
  for (let k = 1; k <= MAX; k++) { const j = (i + k) % MAX; if (s.seats[j] && ok(s.seats[j])) return j; }
  return -1;
}
const later = (s, ticks, next) => { s.timer = ticks; s.next = next; };
const sound = (s, snd) => { s.snd = snd; s.ev++; };
// a log line: who did it (their seat's id and name, or null) and the verb, which reads
// "You raise" to them and "Cody raises" to everyone else
const say = (s, ...lines) => { s.log = lines; };
const did = (p, verb, rest = '') => [p.id, p.n, verb, rest];

function put(p, amt) {
  amt = Math.min(amt, p.stack);
  p.stack -= amt; p.bet += amt; p.total += amt;
  if (!p.stack) p.allIn = true;
}

// Sit `id` down in the first empty seat. False if the table's full.
export function sit(s, id, name) {
  if (at(s, id) >= 0) return true;
  const i = s.seats.indexOf(null);
  if (i < 0) return false;
  s.seats[i] = { id, n: String(name).slice(0, 12), stack: BUY_IN, hand: [], dealt: false, folded: false, allIn: false, bet: 0, total: 0, acted: false, show: false, idle: 0, left: false };
  if (s.ph === 'wait' && !s.timer && players(s).length >= 2) later(s, START, 'deal');
  return true;
}
const players = (s) => s.seats.filter((p) => p && !p.left && p.stack > 0);

// Get `id` up from the table. In a hand, that folds what they had.
export function stand(s, id) {
  const i = at(s, id);
  if (i < 0) return;
  const p = s.seats[i];
  if (s.ph !== 'play' || !p.dealt) { s.seats[i] = null; return; }
  p.left = true;
  if (p.folded) return;
  p.folded = true; p.acted = true;
  say(s, did(p, 'fold'));
  if (s.toAct === i) { s.toAct = -1; later(s, 3, 'advance'); s.from = i; return; }
  // someone else is thinking: they may have just won, or not need to act any more
  if (!s.timer && s.toAct >= 0) {
    const was = s.toAct, clock = s.clock;
    advance(s, (was + MAX - 1) % MAX);
    if (s.toAct === was) s.clock = clock;
  }
}

function startHand(s) {
  for (let i = 0; i < MAX; i++) {
    const p = s.seats[i];
    if (p && (p.left || !p.stack)) s.seats[i] = null;
    else if (p) Object.assign(p, { hand: [], dealt: true, folded: false, allIn: false, bet: 0, total: 0, acted: false, show: false });
  }
  s.toAct = -1;
  if (players(s).length < 2) {
    for (const p of s.seats) if (p) p.dealt = false;
    s.ph = 'wait'; s.board = []; say(s);
    return;
  }
  s.ph = 'play'; s.hn++;
  s.deck = [];
  for (let su = 0; su < 4; su++) for (let r = 2; r <= 14; r++) s.deck.push({ r, s: su });
  for (let i = s.deck.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]]; }
  s.board = []; s.street = 0;
  const dealt = (p) => p.dealt;
  s.button = nextSeat(s, s.button, dealt);
  // heads-up, the button posts the small blind
  const sbSeat = players(s).length === 2 ? s.button : nextSeat(s, s.button, dealt);
  const bbSeat = nextSeat(s, sbSeat, dealt);
  put(s.seats[sbSeat], SB); put(s.seats[bbSeat], BB);
  s.curBet = BB; s.minRaise = BB;
  for (let k = 0; k < 2; k++) for (const p of s.seats) if (p && p.dealt) p.hand.push(s.deck.pop());
  say(s, [null, null, 'Hand ' + s.hn + '. Blinds ' + SB + '/' + BB + '.']);
  sound(s, 'deal');
  advance(s, bbSeat);
}

// After someone acts: pass the action on, or close the betting round.
function advance(s, from) {
  s.toAct = -1;
  if (inHand(s).length === 1) { winUncontested(s); return; }
  const needs = (p) => p.dealt && !p.folded && !p.allIn && (!p.acted || p.bet < s.curBet);
  // a lone player who can still bet only has to act if they're behind
  const alone = canAct(s).length === 1 && canAct(s)[0].bet >= s.curBet;
  if (alone || !s.seats.some((p) => p && needs(p))) { endStreet(s); return; }
  s.toAct = nextSeat(s, from, needs); s.clock = TURN;
}

function endStreet(s) {
  for (const p of s.seats) if (p) { p.bet = 0; p.acted = false; }
  s.curBet = 0; s.minRaise = BB;
  if (s.street === 3) { later(s, 6, 'showdown'); return; }
  // nobody left to bet against: turn the hands over and run the board out
  const runOut = canAct(s).length <= 1;
  if (runOut) for (const p of inHand(s)) p.show = true;
  later(s, runOut ? 12 : 6, 'street');
}

function nextStreet(s) {
  s.street++;
  s.deck.pop(); // burn
  for (let i = s.street === 1 ? 3 : 1; i > 0; i--) s.board.push(s.deck.pop());
  say(s, [null, null, ['', 'The flop.', 'The turn.', 'The river.'][s.street]]);
  sound(s, 'card');
  if (canAct(s).length <= 1) { endStreet(s); return; }
  advance(s, s.button); // first to act after the flop: the next player after the button
}

function act(s, i, kind, to) {
  const p = s.seats[i], call = s.curBet - p.bet;
  p.acted = true;
  if (kind === 'fold') { p.folded = true; say(s, did(p, 'fold')); sound(s, 'fold'); }
  else if (kind === 'call' || !(to > s.curBet)) {
    if (call <= 0) { say(s, did(p, 'check')); sound(s, 'check'); }
    else { put(p, call); say(s, did(p, 'call', ' ' + p.bet + (p.allIn ? ', all in!' : '.'))); sound(s, 'call'); }
  } else {
    to = Math.min(Math.max(to, s.curBet + s.minRaise), p.bet + p.stack);
    const opened = s.curBet === 0;
    // a full raise sets the new minimum; either way everyone else has to answer it
    if (to - s.curBet >= s.minRaise) s.minRaise = to - s.curBet;
    put(p, to - p.bet); s.curBet = p.bet;
    for (const q of s.seats) if (q && q !== p) q.acted = false;
    say(s, did(p, opened ? 'bet' : 'raise', (opened ? ' ' : ' to ') + p.bet + (p.allIn ? ', all in!' : '.')));
    sound(s, 'raise');
  }
  s.toAct = -1; s.from = i;
  later(s, 3, 'advance');
}

function winUncontested(s) {
  const w = inHand(s)[0], amt = pot(s);
  w.stack += amt;
  for (const p of s.seats) if (p) { p.total = 0; p.bet = 0; }
  say(s, did(w, 'take', ' the pot of ' + amt + '.'));
  sound(s, 'win:' + s.seats.indexOf(w));
  s.ph = 'result';
  later(s, RESULT, 'deal');
}

function showdown(s) {
  const contenders = inHand(s), got = s.seats.map(() => 0), all = s.seats.filter(Boolean);
  for (const p of contenders) { p.show = true; p.value = handValue(p.hand.concat(s.board)); }
  // Side pots: slice the contributions at each player's total, smallest first; each
  // slice goes to the best hand among those still in who paid into all of it.
  const levels = [...new Set(all.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b);
  let prev = 0;
  for (const lv of levels) {
    const chunk = all.reduce((n, p) => n + Math.max(0, Math.min(p.total, lv) - prev), 0);
    let elig = contenders.filter((p) => p.total >= lv);
    if (!elig.length) elig = contenders.filter((p) => p.total === Math.max(...contenders.map((q) => q.total)));
    const best = Math.max(...elig.map((p) => p.value)), winners = elig.filter((p) => p.value === best);
    const share = Math.floor(chunk / winners.length);
    for (const w of winners) { w.stack += share; if (elig.length > 1) got[s.seats.indexOf(w)] += share; }
    // the odd roll of a split goes to the first winner after the button
    const odd = chunk - share * winners.length;
    if (odd) s.seats[nextSeat(s, s.button, (p) => winners.includes(p))].stack += odd;
    prev = lv;
  }
  for (const p of all) { p.total = 0; p.bet = 0; }
  const winners = s.seats.map((p, i) => i).filter((i) => got[i] > 0);
  say(s, ...winners.slice(0, 2).map((i) => did(s.seats[i], 'win', ' ' + got[i] + ' with ' + handName(s.seats[i].value) + '.')));
  sound(s, 'win:' + winners.join(','));
  s.ph = 'result';
  later(s, RESULT, 'deal');
}

// Whoever's run out of rolls gets up, and the next hand is dealt.
function endHand(s) {
  for (const p of s.seats) if (p && !p.left && p.dealt && !p.stack) { p.left = true; s.out.push({ id: p.id, r: 'bust' }); }
  startHand(s);
}

// What `id` did on their turn: { a: 'fold' | 'call' | 'raise', to } (call also checks;
// to is what their bet goes up to, and anything past their stack is all in).
export function input(s, id, d) {
  const i = at(s, id);
  if (i < 0 || i !== s.toAct || s.timer || !d || typeof d !== 'object') return;
  if (!['fold', 'call', 'raise'].includes(d.a)) return;
  const to = Number.isFinite(d.to) ? Math.floor(d.to) : 0;
  const p = s.seats[i];
  p.idle = 0;
  // can't raise when nobody else could answer it, or there's nothing past the call
  if (d.a === 'raise' && (p.stack <= s.curBet - p.bet || !canAct(s).some((q) => q !== p))) { act(s, i, 'call'); return; }
  act(s, i, d.a, to);
}

// One tick. Returns who's had to get up since the last one, as [{ id, r: why }]
// ('bust' or 'idle').
export function tick(s) {
  if (s.timer > 0) {
    if (--s.timer === 0) {
      const next = s.next;
      s.next = null;
      if (next === 'deal') endHand(s);
      else if (next === 'advance') advance(s, s.from);
      else if (next === 'street') nextStreet(s);
      else if (next === 'showdown') showdown(s);
    }
  } else if (s.ph === 'play' && s.toAct >= 0 && --s.clock <= 0) {
    // out of time: check if that's free, otherwise fold
    const i = s.toAct, p = s.seats[i];
    act(s, i, s.curBet > p.bet ? 'fold' : 'call');
    if (++p.idle >= IDLE) {
      p.left = true;
      if (!p.folded) p.folded = true;
      s.out.push({ id: p.id, r: 'idle' });
    }
  }
  return s.out.splice(0);
}

export const seated = (s) => s.seats.filter((p) => p && !p.left).map((p) => p.id);

// What `id` sees: me (their seat), ph, hn (the hand number), btn (the button's seat),
// act (whose turn it is, or -1) and clk (their seconds left), bet (the bet to call),
// min (the smallest raise), sb/bb, pot, board, and the seats (null when empty): each
// { id, n, st (stack), b (bet this round), d (dealt in), f (folded), ai (all in),
// h (their cards, 0 for one you can't see) }. log is up to two lines on what just
// happened, and ev counts sounds, the latest being snd.
export function view(s, id) {
  const me = at(s, id);
  const line = (l) => (!l[0] ? l[2] : l[0] === id ? 'You ' + l[2] + l[3] : l[1] + ' ' + l[2] + 's' + l[3]);
  return {
    me, ph: s.ph, hn: s.hn, btn: s.button, act: s.timer ? -1 : s.toAct, clk: Math.ceil(s.clock / hz),
    bet: s.curBet, min: s.minRaise, sb: SB, bb: BB, pot: pot(s), board: s.board,
    seats: s.seats.map((p, i) => p && !p.left ? {
      id: p.id, n: p.n, st: p.stack, b: p.bet, d: p.dealt, f: p.folded, ai: p.allIn,
      h: i === me || (p.show && !p.folded) ? p.hand : p.hand.map(() => 0),
    } : null),
    log: s.log.map(line), ev: s.ev, snd: s.snd,
  };
}
