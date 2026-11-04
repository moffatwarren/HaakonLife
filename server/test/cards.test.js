// The card game with no browser: the rules (js/cards.js), the cards (js/cardlist.js) and how the
// computer plays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as live from '../games/cards.js';
import { seeded } from '../rooms.js';

const ctx = vm.createContext({ window: {} });
for (const f of ['cardlist.js', 'cards.js']) {
  vm.runInContext(readFileSync(new URL('../../js/' + f, import.meta.url), 'utf8'), ctx, { filename: 'js/' + f });
}
const CARDS = ctx.window.CARDS;
const { MORALE, DECK, CUPS, TABLE, HAND, OPENING, STRIKES } = CARDS.RULES;
const every = CARDS.LIST.filter((c) => c.rarity !== 'T').map((c) => c.id);
// (the rules run in a vm of their own, so what comes out has different Objects and Arrays)
const plain = (x) => JSON.parse(JSON.stringify(x));

// A game past the swapping, with seat 0 to play, and nothing on the table. A deck of plain workers
// unless it's told otherwise, so nothing happens by accident.
const PLAIN = CARDS.STARTER.filter((id) => !CARDS.card(id).does && !CARDS.card(id).words);
const deckOf = (n = DECK) => { const out = []; while (out.length < n) out.push(PLAIN[out.length % PLAIN.length]); return out; };
function game(o = {}) {
  const g = CARDS.create(Object.assign({ decks: [deckOf(), deckOf()], seed: 7, first: 0 }, o));
  g.act(0, { do: 'swap', cards: [] });
  g.act(1, { do: 'swap', cards: [] });
  return g;
}
// lots of coffee, so a test can play whatever it likes
function coffee(g, seat, n = 10) { const s = g.save(); s.p[seat].coffee = n; s.p[seat].cups = Math.min(n, CUPS); g.load(s); }
const me = (g, seat) => g.view(seat).you;
const worker = (g, seat, u) => g.view(seat).you.table.find((x) => x.u === u);
const wake = (g, seat) => { const s = g.save(); for (const x of s.p[seat].table) x.left = 1; g.load(s); };
const nextTurn = (g) => g.act(g.view(0).turn, { do: 'end' });
function play(g, seat, id, target) {
  coffee(g, seat);
  const u = g.give(seat, id, 'hand');
  assert.ok(g.act(seat, { do: 'play', card: u, target }), id + ' should be playable');
}

// ---------- the list ----------
test('nothing is wrong with the card list', () => {
  assert.deepEqual(plain(CARDS.check()), []);
});
test('the starters make a legal deck, so everybody can play from the start', () => {
  assert.equal(CARDS.STARTER.length, DECK);
  assert.equal(CARDS.deckProblem(CARDS.STARTER), null);
});
test('the words on a card are written from what it does', () => {
  const says = (id) => CARDS.text(CARDS.card(id)).replace(/\*/g, '');
  assert.equal(says('forklift'), 'Keen. On play: send an enemy worker back to their hand.');
  assert.equal(says('officedog'), 'Thick Skin. Every morning: draw a card.');
  assert.equal(says('firedrill'), 'Everyone on both sides goes home.');
  assert.equal(says('dmitriy'), 'On play: 2 damage to a worker.');
  assert.equal(says('felix'), 'Gatekeeper.');
  assert.equal(says('student'), '');
});

test('every card can be painted, big and small', () => {
  const art = vm.createContext({ window: {} });
  for (const f of ['font.js', 'people.js', 'cardlist.js', 'cardart.js']) {
    vm.runInContext(readFileSync(new URL('../../js/' + f, import.meta.url), 'utf8'), art, { filename: 'js/' + f });
  }
  const A = art.window.CARD_ART;
  for (const c of CARDS.LIST) {
    const face = Object.assign({}, c, { text: CARDS.text(c) });
    assert.equal(A.big(face).w, 260, c.id);
    assert.equal(A.small(face, { cost: true }).w, 88, c.id);
    assert.ok(A.artPic(c.id).px.some((v) => v), c.id + ' has a picture');
  }
  for (const id of Object.keys(A.LIVE)) {
    for (let t = 0; t < 200; t += 3) assert.ok(A.artFrame(id, t).px.some((v) => v), id + ' moves');
  }
});

// ---------- decks ----------
test('only a legal deck is a deck', () => {
  const legend = (id) => CARDS.card(id).rarity === 'L';
  const fine = CARDS.STARTER.slice();
  const swapIn = (...ids) => fine.slice(ids.length).concat(ids);
  assert.ok(CARDS.deckProblem(fine.slice(1)), 'too few');
  assert.ok(CARDS.deckProblem(fine.concat(['forklift'])), 'too many');
  assert.ok(CARDS.deckProblem(swapIn(fine[fine.length - 1])), 'two of the same');
  assert.ok(CARDS.deckProblem(swapIn('nosuchcard')), 'a card that isn\'t one');
  assert.ok(CARDS.deckProblem(swapIn('legobrick')), 'a card only another card can bring in');
  assert.ok(CARDS.deckProblem(swapIn(...every.filter(legend).slice(0, 2))), 'two legendaries');
  assert.equal(CARDS.deckProblem(swapIn(every.filter(legend)[0])), null, 'one legendary');
  for (const junk of [null, 'deck', 20, {}, [null], swapIn('__proto__'), swapIn('constructor'), swapIn(5), swapIn({})]) {
    assert.ok(CARDS.deckProblem(junk), 'junk: ' + JSON.stringify(junk));
  }
});
test('building a deck always comes out legal, leans the way you ask and keeps what it must', () => {
  for (let seed = 1; seed < 40; seed++) {
    for (const dept of [undefined, ...Object.keys(CARDS.DEPTS)]) {
      const deck = plain(CARDS.buildDeck(every, { dept, seed }));
      assert.equal(CARDS.deckProblem(deck), null);
      if (dept) assert.ok(deck.filter((id) => CARDS.card(id).dept === dept).length >= 8, dept + ' deck has its department');
    }
  }
  assert.equal(CARDS.deckProblem(CARDS.buildDeck([])), null, 'with nothing but the starters');
  assert.ok(CARDS.buildDeck(every, { must: ['felix'], dept: 'road' }).includes('felix'));
  assert.equal(CARDS.deckProblem(CARDS.buildDeck(['nosuchcard', '__proto__', 'legobrick', 'forklift'])), null, 'ignores what isn\'t a card');
});

// ---------- the start ----------
test('you each draw three, swap what you like once, and going second gets a card and a Double Shot', () => {
  const g = CARDS.create({ decks: [CARDS.STARTER, CARDS.STARTER], seed: 3, first: 0 });
  assert.equal(me(g, 0).hand.length, OPENING);
  assert.equal(me(g, 0).morale, MORALE);
  assert.equal(g.view(0).ph, 'swap');
  const before = me(g, 0).hand.map((c) => c.u);
  assert.ok(g.act(0, { do: 'swap', cards: before.slice(0, 2) }));
  assert.equal(me(g, 0).hand.length, OPENING, 'as many back as you swapped');
  assert.ok(!me(g, 0).hand.some((c) => before.slice(0, 2).includes(c.u)));
  assert.ok(!g.act(0, { do: 'swap', cards: [] }), 'only once');
  assert.ok(!g.act(0, { do: 'end' }), 'not until both have');
  assert.ok(g.act(1, { do: 'swap', cards: [] }));
  assert.equal(g.view(0).ph, 'play');
  assert.equal(g.view(0).turn, 0);
  assert.equal(me(g, 0).coffee, 1, 'one coffee to start with');
  assert.equal(me(g, 0).hand.length, OPENING + 1, 'and a card for the morning');
  assert.equal(me(g, 1).hand.length, OPENING + 2);
  assert.ok(me(g, 1).hand.some((c) => c.id === 'doubleshot'));
  assert.ok(!me(g, 0).hand.some((c) => c.id === 'doubleshot'));
});
test('a Double Shot is one more coffee, for free, once', () => {
  const g = game();
  nextTurn(g);
  const shot = me(g, 1).hand.find((c) => c.id === 'doubleshot');
  assert.ok(g.act(1, { do: 'play', card: shot.u }));
  assert.equal(me(g, 1).coffee, 2);
  assert.ok(!g.act(1, { do: 'play', card: shot.u }));
});
test('the coin decides who goes first, and the same seed deals the same game', () => {
  const seen = new Set();
  for (let seed = 1; seed < 30; seed++) seen.add(CARDS.create({ seed }).save().first);
  assert.equal(seen.size, 2);
  const deal = (seed) => plain(CARDS.create({ decks: [CARDS.STARTER, CARDS.STARTER], seed }).save());
  assert.deepEqual(deal(5), deal(5));
  assert.notDeepEqual(deal(5).p[0].deck, deal(6).p[0].deck);
});

// ---------- a turn ----------
test('each morning you gain a cup up to eight, they all refill, and you draw', () => {
  const g = game();
  for (let cups = 1; cups <= CUPS + 3; cups++) {
    assert.equal(me(g, 0).cups, Math.min(cups, CUPS));
    assert.equal(me(g, 0).coffee, Math.min(cups, CUPS));
    const s = g.save(); s.p[0].hand = []; s.p[1].hand = []; g.load(s);
    nextTurn(g);
    nextTurn(g);
    assert.equal(me(g, 0).hand.length, 1);
  }
});
test('with no cards left you lose Morale instead: 1, then 2, then 3', () => {
  const g = game();
  const s = g.save(); s.p[0].deck = []; g.load(s);
  for (const [n, left] of [[1, 19], [2, 17], [3, 14]]) {
    nextTurn(g); nextTurn(g);
    assert.equal(me(g, 0).morale, left, 'after burning out ' + n + ' times');
  }
});
test('burning out can lose you the game', () => {
  const g = game();
  const s = g.save(); s.p[0].deck = []; s.p[0].morale = 1; g.load(s);
  nextTurn(g); nextTurn(g);
  assert.deepEqual(plain(g.result), { w: 1, why: 'morale' });
});
test('a card you can\'t hold is lost', () => {
  const g = game();
  const s = g.save(); s.p[0].hand = s.p[0].hand.slice(0, 0); g.load(s);
  for (let i = 0; i < HAND; i++) g.give(0, 'student', 'hand');
  const deck = me(g, 0).deck;
  nextTurn(g); nextTurn(g);
  assert.equal(me(g, 0).hand.length, HAND);
  assert.equal(me(g, 0).deck, deck - 1);
  assert.ok(g.events.some((e) => e.e === 'lost' && e.s === 0));
});
test('a card costs its coffee, and you can\'t play what you can\'t afford', () => {
  const g = game();
  const big = g.give(0, 'nightshift', 'hand');
  assert.ok(!g.act(0, { do: 'play', card: big }));
  coffee(g, 0, 7);
  assert.ok(g.act(0, { do: 'play', card: big }));
  assert.equal(me(g, 0).coffee, 2);
  assert.ok(!g.act(0, { do: 'play', card: big }), 'and it\'s not in your hand any more');
});
test('five workers on a side is all there\'s room for', () => {
  const g = game();
  for (let i = 0; i < TABLE; i++) g.give(0, 'student');
  coffee(g, 0);
  const u = g.give(0, 'student', 'hand');
  assert.ok(!g.act(0, { do: 'play', card: u }));
  const task = g.give(0, 'longlunch', 'hand');
  assert.ok(g.act(0, { do: 'play', card: task }), 'a task still works');
});
test('you can only do things on your own turn', () => {
  const g = game();
  const u = g.give(1, 'student', 'hand');
  assert.ok(!g.act(1, { do: 'play', card: u }));
  assert.ok(!g.act(1, { do: 'end' }));
  assert.deepEqual(plain(g.legal(1)), []);
});

// ---------- attacking ----------
test('a worker waits a turn, then attacks once a turn', () => {
  const g = game();
  play(g, 0, 'assembler');
  const a = me(g, 0).table[0].u;
  assert.ok(!g.act(0, { do: 'attack', from: a, target: 1 }), 'not on the turn it\'s played');
  nextTurn(g); nextTurn(g);
  assert.ok(g.act(0, { do: 'attack', from: a, target: 1 }));
  assert.equal(me(g, 1).morale, MORALE - 3);
  assert.ok(!g.act(0, { do: 'attack', from: a, target: 1 }), 'only once');
});
test('Keen attacks straight away', () => {
  const g = game();
  play(g, 0, 'courier');
  assert.ok(g.act(0, { do: 'attack', from: me(g, 0).table[0].u, target: 1 }));
  assert.equal(me(g, 1).morale, MORALE - 2);
});
test('a worker with no Power can\'t attack', () => {
  const g = game();
  const u = g.give(0, 'felix');
  wake(g, 0);
  assert.ok(!g.act(0, { do: 'attack', from: u, target: 1 }));
});
test('attacking a worker hits both; attacking a player, nothing hits back; lost Patience stays lost', () => {
  const g = game();
  const a = g.give(0, 'foreman'), b = g.give(1, 'nightshift');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: b }));
  assert.equal(worker(g, 1, b).pa, 5 - 4);
  assert.equal(me(g, 0).table.length, 0, '5 Power against 4 Patience: the Foreman goes home');
  assert.equal(me(g, 1).morale, MORALE);
  nextTurn(g); nextTurn(g);
  assert.equal(worker(g, 1, b).pa, 1);
  const c = g.give(0, 'student');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: c, target: 1 }));
  assert.equal(worker(g, 0, c).pa, 2, 'a player doesn\'t hit back');
});
test('you can only attack the other side', () => {
  const g = game();
  const a = g.give(0, 'foreman'), mine = g.give(0, 'student');
  wake(g, 0);
  assert.ok(!g.act(0, { do: 'attack', from: a, target: mine }));
  assert.ok(!g.act(0, { do: 'attack', from: a, target: 0 }));
  assert.ok(!g.act(0, { do: 'attack', from: a, target: a }));
});
test('a Gatekeeper has to be dealt with first', () => {
  const g = game();
  const a = g.give(0, 'nightshift'), other = g.give(1, 'student'), gate = g.give(1, 'receptionist');
  wake(g, 0);
  assert.ok(!g.act(0, { do: 'attack', from: a, target: 1 }));
  assert.ok(!g.act(0, { do: 'attack', from: a, target: other }));
  assert.ok(g.act(0, { do: 'attack', from: a, target: gate }));
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: other }), 'and then anyone');
  assert.equal(me(g, 1).table.length, 0);
});
test('Thick Skin ignores the first hit, and only the first', () => {
  const g = game();
  const a = g.give(0, 'foreman'), b = g.give(1, 'leo');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: b }));
  assert.equal(worker(g, 1, b).pa, 2);
  assert.equal(worker(g, 1, b).skin, false);
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: b }));
  assert.equal(me(g, 1).table.length, 0);
});
test('a hit of nothing doesn\'t use up Thick Skin', () => {
  const g = game();
  const a = g.give(0, 'leo'), b = g.give(1, 'felix');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: b }));
  assert.equal(worker(g, 0, a).skin, true, 'Felix has no Power');
});
test('if you both hit 0 it\'s a draw', () => {
  const g = game();
  const s = g.save();
  s.p[0].morale = 0; s.p[1].morale = 0;
  g.load(s);
  play(g, 0, 'student');
  assert.deepEqual(plain(g.result), { w: -1, why: 'morale' });
});
test('reaching 0 Morale ends it, and nothing more can happen', () => {
  const g = game();
  const s = g.save(); s.p[1].morale = 3; g.load(s);
  const a = g.give(0, 'assembler');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: 1 }));
  assert.deepEqual(plain(g.result), { w: 0, why: 'morale' });
  assert.ok(!g.act(0, { do: 'end' }));
  assert.deepEqual(plain(g.legal(0)), []);
});
test('you can resign whenever you like', () => {
  const g = game();
  assert.ok(g.act(1, { do: 'resign' }));
  assert.deepEqual(plain(g.result), { w: 0, why: 'resign' });
});

// ---------- what cards do ----------
test('On play lands on who you pick, and a bad pick isn\'t allowed', () => {
  const g = game();
  const them = g.give(1, 'nightshift');
  coffee(g, 0);
  const u = g.give(0, 'dmitriy', 'hand');
  assert.ok(!g.act(0, { do: 'play', card: u }), 'it has to be aimed');
  assert.ok(!g.act(0, { do: 'play', card: u, target: 1 }), 'at a worker, not a player');
  assert.ok(!g.act(0, { do: 'play', card: u, target: 9999 }));
  assert.ok(g.act(0, { do: 'play', card: u, target: them }));
  assert.equal(worker(g, 1, them).pa, 3);
});
test('a worker with nobody to aim at still comes in, but a task stays in your hand', () => {
  const g = game();
  coffee(g, 0);
  const u = g.give(0, 'dmitriy', 'hand'), task = g.give(0, 'reorg', 'hand');
  assert.ok(!g.act(0, { do: 'play', card: task }));
  assert.ok(g.act(0, { do: 'play', card: u }));
  assert.equal(me(g, 0).table.length, 1);
});
test('Every morning happens at the start of each of your turns', () => {
  const g = game();
  const s = g.save(); s.p[0].morale = 10; g.load(s);
  g.give(0, 'nik');
  nextTurn(g);
  assert.equal(me(g, 0).morale, 10);
  nextTurn(g);
  assert.equal(me(g, 0).morale, 11);
  nextTurn(g); nextTurn(g);
  assert.equal(me(g, 0).morale, 12);
});
test('every special word on a card gets explained', () => {
  for (const c of CARDS.LIST) {
    const said = CARDS.text(c), means = plain(CARDS.meanings(c)).map((k) => CARDS.MEANS[k]);
    assert.ok(means.every(Boolean), c.id + ' has a word with no meaning');
    for (const word of ['Gatekeeper', 'Keen', 'Thick Skin', 'On play', 'Every morning', 'Last word', 'Team-up']) {
      if (said.includes(word)) assert.ok(means.some((m) => m.startsWith(word + ':')), c.id + ' says ' + word + ' and doesn\'t explain it');
      else assert.ok(!means.some((m) => m.startsWith(word + ':')), c.id + ' explains ' + word + ' and doesn\'t say it');
    }
  }
});
test('Morale can go over where it started, and keeps going', () => {
  const g = game();
  play(g, 0, 'longlunch');
  assert.equal(me(g, 0).morale, MORALE + 4);
  play(g, 0, 'longlunch');
  assert.equal(me(g, 0).morale, MORALE + 8);
});
test('a last word happens when they go home', () => {
  const g = game();
  const s = g.save(); s.p[1].morale = 10; g.load(s);
  const a = g.give(0, 'nightshift'), b = g.give(1, 'apprentice');
  wake(g, 0);
  assert.ok(g.act(0, { do: 'attack', from: a, target: b }));
  assert.equal(me(g, 1).morale, 12);
});
test('Team-up only counts with somebody from that department already there', () => {
  const g = game();
  play(g, 0, 'graham');
  assert.equal(me(g, 0).table[0].pw, 3, 'on their own');
  play(g, 0, 'graham');
  assert.equal(me(g, 0).table[1].pw, 5, 'with another Plant worker');
  const h = game();
  play(h, 0, 'tho');
  assert.equal(me(h, 1).morale, MORALE);
  play(h, 0, 'tho');
  assert.equal(me(h, 1).morale, MORALE - 2);
});
test('The worker that can\'t attack next turn really can\'t, and then it can', () => {
  const g = game();
  const b = g.give(1, 'nightshift');
  const s = g.save(); s.p[1].table[0].left = 1; g.load(s);
  play(g, 0, 'stephen', b);
  nextTurn(g);
  assert.equal(g.view(1).turn, 1);
  assert.ok(!g.act(1, { do: 'attack', from: b, target: 0 }));
  nextTurn(g); nextTurn(g);
  assert.ok(g.act(1, { do: 'attack', from: b, target: 0 }));
});
test('Sent back to the hand means played again, as new', () => {
  const g = game();
  const b = g.give(1, 'nightshift');
  const hand = me(g, 1).hand.length;
  const s = g.save(); s.p[1].table[0].pa = 1; g.load(s);
  play(g, 0, 'paperjam', b);
  assert.equal(me(g, 1).table.length, 0);
  assert.equal(me(g, 1).hand.length, hand + 1);
  assert.ok(me(g, 1).hand.some((c) => c.id === 'nightshift'));
});
test('With no room in your hand, being sent back means going home', () => {
  const g = game();
  const b = g.give(1, 'apprentice');
  const s = g.save(); s.p[1].morale = 10; s.p[1].hand = []; g.load(s);
  for (let i = 0; i < HAND; i++) g.give(1, 'student', 'hand');
  play(g, 0, 'paperjam', b);
  assert.equal(me(g, 1).table.length, 0);
  assert.equal(me(g, 1).hand.length, HAND);
  assert.equal(me(g, 1).morale, 12, 'with their last word');
});
test('the Forklift comes in Keen and sends somebody back', () => {
  const g = game();
  const b = g.give(1, 'nightshift');
  play(g, 0, 'forklift', b);
  assert.equal(me(g, 1).table.length, 0);
  const f = me(g, 0).table[0];
  assert.ok(g.act(0, { do: 'attack', from: f.u, target: 1 }));
  assert.equal(me(g, 1).morale, MORALE - 6);
});
test('the Office Dog brings you a card each morning', () => {
  const g = game();
  g.give(0, 'officedog');
  const s = g.save(); s.p[0].hand = []; g.load(s);
  nextTurn(g); nextTurn(g);
  assert.equal(me(g, 0).hand.length, 2);
});
test('Fire Drill sends everyone home, whatever their Thick Skin, and everyone has their last word', () => {
  const g = game();
  const s = g.save(); s.p[0].morale = 10; s.p[1].morale = 10; g.load(s);
  g.give(0, 'nathan'); g.give(0, 'apprentice'); g.give(1, 'felix'); g.give(1, 'apprentice');
  play(g, 0, 'firedrill');
  assert.equal(me(g, 0).table.length, 0);
  assert.equal(me(g, 1).table.length, 0);
  assert.equal(me(g, 0).morale, 12);
  assert.equal(me(g, 1).morale, 12);
});
test('Linda always comes back to your hand', () => {
  const g = game();
  const u = g.give(1, 'linda');
  const s = g.save(); s.p[1].hand = []; g.load(s);
  play(g, 0, 'reorg', u);
  assert.equal(me(g, 1).table.length, 0);
  assert.deepEqual(plain(me(g, 1).hand.map((c) => c.id)), ['linda']);
});
test('the Humbug takes Power away, but never below nothing', () => {
  const g = game();
  const a = g.give(1, 'nightshift'), b = g.give(1, 'student');
  play(g, 0, 'humbug');
  assert.equal(worker(g, 1, a).pw, 3);
  assert.equal(worker(g, 1, b).pw, 0);
});
test('Potluck can only bring in as many as there\'s room for', () => {
  const g = game();
  for (let i = 0; i < TABLE - 1; i++) g.give(0, 'student');
  play(g, 0, 'potluck');
  assert.equal(me(g, 0).table.length, TABLE);
});
test('The Printer jams somebody random each morning, when there\'s anybody to jam', () => {
  const g = game();
  g.give(0, 'printer');
  nextTurn(g); nextTurn(g);
  assert.equal(g.result, null, 'with nobody there it does nothing');
  const b = g.give(1, 'student');
  nextTurn(g); nextTurn(g);
  assert.equal(worker(g, 1, b).frozen, 1);
});

// ---------- hidden things stay hidden ----------
test('you can\'t see the other hand, or either deck, or what they draw', () => {
  // two decks with no card in common, so any of theirs showing up in your view is a leak
  const mine = CARDS.STARTER.slice();
  const theirs = CARDS.buildDeck(every.filter((id) => !mine.includes(id) && CARDS.card(id).rarity !== 'L'), { seed: 3 });
  const onlyTheirs = plain(theirs).filter((id) => !mine.includes(id));
  assert.ok(onlyTheirs.length > 5);
  const g = CARDS.create({ decks: [mine, onlyTheirs.concat(onlyTheirs).slice(0, DECK)], seed: 9, first: 0 });
  for (let i = 0; i < 40 && !g.result; i++) {
    const v = plain(g.view(0));
    assert.equal(typeof v.them.hand, 'number');
    assert.equal(typeof v.them.deck, 'number');
    assert.equal(typeof v.you.deck, 'number');
    assert.ok(!('s' in v), 'no seed');
    assert.ok(!JSON.stringify(v).includes('"s":' + g.save().s), 'no seed anywhere');
    const open = new Set(v.them.table.map((x) => x.id));
    // anything of theirs that shows must be on the table or have been played or gone home in the open
    for (const e of v.ev) if (e.id && e.s === 1) open.add(e.id);
    for (const id of onlyTheirs) {
      if (JSON.stringify(v).includes('"' + id + '"')) assert.ok(open.has(id), id + ' leaked');
    }
    for (const e of v.ev) if (e.e === 'draw' && e.s === 1) { assert.equal(e.id, undefined); assert.equal(e.u, undefined); }
    const turn = g.view(0).ph === 'swap' ? null : g.view(0).turn;
    if (turn === null) { g.act(0, { do: 'swap', cards: [] }); g.act(1, { do: 'swap', cards: [] }); } else g.act(turn, g.choose(turn, 3));
  }
});
test('the view says what you can do, and only on your turn', () => {
  const g = game();
  const u = g.give(0, 'student', 'hand'), big = g.give(0, 'closer', 'hand');
  const v = plain(g.view(0));
  assert.ok(u in v.can.play);
  assert.ok(!(big in v.can.play));
  assert.equal(plain(g.view(1)).can, undefined);
});

// ---------- anything can come in ----------
test('rubbish does nothing', () => {
  const g = game();
  const before = JSON.stringify(g.save());
  const junk = [null, undefined, 5, 'end', [], {}, { do: 'nothing' }, { do: 'play' }, { do: 'play', card: 'x' }, { do: 'play', card: {} }, { do: 'play', card: null, target: null },
    { do: 'attack' }, { do: 'attack', from: 1, target: 1 }, { do: 'attack', from: '__proto__', target: 'constructor' }, { do: 'swap', cards: 'all' }, { do: '__proto__' }, { do: 'play', card: -1 }];
  for (const seat of [0, 1, 2, -1, 'x', null, undefined, '__proto__']) {
    for (const a of junk) if (!(seat === 0 && a && a.do === 'end')) g.act(seat, a);
  }
  assert.equal(JSON.stringify(g.save()), before);
  assert.equal(g.result, null);
});
test('a card from the other side, or one already played, can\'t be played', () => {
  const g = game();
  coffee(g, 0);
  coffee(g, 1);
  const theirs = g.give(1, 'student', 'hand');
  assert.ok(!g.act(0, { do: 'play', card: theirs }));
  const b = g.give(1, 'student');
  assert.ok(!g.act(0, { do: 'attack', from: b, target: 1 }));
});

// ---------- the clock ----------
test('run out of time and your turn ends; three in a row and you lose; doing anything resets it', () => {
  const g = game({ turn: 10 });
  const tick = (n) => { for (let i = 0; i < n; i++) g.step(); };
  tick(10);
  assert.equal(g.view(0).turn, 1, 'time ran out');
  assert.ok(g.events.some((e) => e.e === 'timeout' && e.s === 0));
  g.act(1, { do: 'end' });
  tick(10);
  assert.equal(g.view(0).turn, 1);
  g.act(1, { do: 'end' });
  // this time they do something, which clears it
  assert.ok(g.act(0, { do: 'end' }));
  g.act(1, { do: 'end' });
  for (let i = 0; i < STRIKES; i++) {
    assert.equal(g.result, null);
    tick(10);
    if (!g.result) g.act(1, { do: 'end' });
  }
  assert.deepEqual(plain(g.result), { w: 1, why: 'time' });
});
test('nobody waits at the swap for ever in a game with a clock', () => {
  const g = CARDS.create({ decks: [deckOf(), deckOf()], seed: 2, first: 0, turn: 10 });
  for (let i = 0; i < 40 * 60 && g.view(0).ph === 'swap'; i++) g.step();
  assert.equal(g.view(0).ph, 'play');
});
test('a game with no clock waits as long as you like', () => {
  const g = game();
  for (let i = 0; i < 100000; i++) g.step();
  assert.equal(g.view(0).turn, 0);
});

// ---------- saving ----------
test('a saved game carries on exactly the same', () => {
  const start = () => CARDS.create({ decks: [CARDS.buildDeck(every, { dept: 'plant', seed: 1 }), CARDS.buildDeck(every, { dept: 'lunch', seed: 2 })], seed: 4, first: 0 });
  const a = start();
  for (const s of [0, 1]) a.act(s, a.choose(s, 3));
  for (let i = 0; i < 25 && !a.result; i++) { const t = a.view(0).turn; a.act(t, a.choose(t, 3)); }
  const saved = JSON.parse(JSON.stringify(a.save()));
  const b = start();
  b.load(saved);
  for (let i = 0; i < 40 && !a.result; i++) {
    const t = a.view(0).turn, m = a.choose(t, 3);
    assert.ok(a.act(t, m));
    assert.ok(b.act(t, m));
    assert.deepEqual(plain(b.view(0)), plain(a.view(0)));
    assert.deepEqual(plain(b.view(1)), plain(a.view(1)));
  }
});

// ---------- how the computer plays ----------
const playThrough = (g, levels) => {
  for (const s of [0, 1]) g.act(s, g.choose(s, levels[s]));
  for (let m = 0; m < 2000 && !g.result; m++) { const t = g.view(0).turn; assert.ok(g.act(t, g.choose(t, levels[t])), 'the computer only makes legal moves'); }
  return g.result;
};
test('better computer players beat worse ones', () => {
  const deck = CARDS.buildDeck(every, { seed: 1 });
  const wins = (hi, lo, n) => { let w = 0; for (let k = 0; k < n; k++) if (playThrough(CARDS.create({ decks: [deck, deck], seed: 100 + k, first: k % 2 }), [hi, lo]).w === 0) w++; return w / n; };
  assert.ok(wins(2, 1, 200) > 0.6, 'level 2 beats level 1');
  assert.ok(wins(3, 2, 200) > 0.55, 'level 3 beats level 2');
  assert.ok(wins(4, 3, 300) > 0.55, 'level 4 beats level 3'); // (it's close enough that 80 games could go either way)
});
test('the computer plays by itself as the clock goes by', () => {
  const g = CARDS.create({ decks: [deckOf(), deckOf()], seed: 2, first: 0, ai: [3, 2] });
  for (let i = 0; i < 400000 && !g.result; i++) g.step();
  assert.ok(g.result, 'the game finishes');
});
test('the computer knows when it can win', () => {
  const g = game();
  const s = g.save(); s.p[1].morale = 3; g.load(s);
  const a = g.give(0, 'assembler');
  g.give(1, 'student');
  wake(g, 0);
  assert.deepEqual(plain(g.choose(0, 3)), { do: 'attack', from: a, target: 1 });
});

// ---------- whatever happens ----------
test('thousands of random games all finish, and nothing ever goes out of bounds', () => {
  let games = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    let x = seed;
    const rand = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const deck = () => {
      const pool = every.slice().sort(() => rand() - 0.5), out = [];
      let L = false;
      for (const id of pool) { if (out.length === DECK) break; const isL = CARDS.card(id).rarity === 'L'; if (isL && L) continue; if (isL) L = true; out.push(id); }
      return out;
    };
    const g = CARDS.create({ decks: [deck(), deck()], seed });
    const hands = [g.view(0).you.hand, g.view(1).you.hand];
    g.act(0, { do: 'swap', cards: hands[0].filter(() => rand() < 0.4).map((c) => c.u) });
    g.act(1, { do: 'swap', cards: hands[1].filter(() => rand() < 0.4).map((c) => c.u) });
    for (let m = 0; m < 5000 && !g.result; m++) {
      const t = g.view(0).turn, moves = plain(g.legal(t));
      assert.ok(moves.length > 0, 'there is always something you can do');
      const a = rand() < 0.15 ? { do: 'end' } : pick(moves);
      assert.ok(g.act(t, a), 'a legal move works: ' + JSON.stringify(a));
      for (const s of [0, 1]) {
        const v = g.view(s).you;
        assert.ok(v.table.length <= TABLE, 'room on the table');
        assert.ok(v.hand.length <= HAND, 'room in the hand');
        assert.ok(v.coffee >= 0, 'coffee');
        assert.ok(v.cups <= CUPS, 'cups');
        for (const w of v.table) { assert.ok(w.pa > 0, 'nobody stays with no Patience'); assert.ok(w.pw >= 0, 'no Power under nothing'); }
      }
      const seen = new Set();
      const save = g.save();
      for (const q of save.p) for (const c of q.hand.concat(q.table)) { assert.ok(!seen.has(c.u), 'every card has its own number'); seen.add(c.u); assert.ok(c.u >= 2); }
    }
    assert.ok(g.result, 'game ' + seed + ' finished');
    assert.ok([0, 1, -1].includes(g.result.w));
    games++;
  }
  assert.equal(games, 1500);
});

// ---------- the game the server runs ----------
const LIVE_TURN = 75 * 5; // the server's ticks in a 75 second turn
const dealt = (decks) => {
  const s = live.create({ seats: 2, rng: seeded(42) });
  if (decks) { live.input(s, 0, { deck: decks[0] }); live.input(s, 1, { deck: decks[1] }); }
  for (let i = 0; i < 100 && !s.g; i++) live.tick(s);
  assert.ok(s.g, 'it gets dealt');
  return s;
};
// a whole view, whatever the server would have said about nothing having changed
const fresh = (s, seat) => { s.said[seat] = null; return plain(live.view(s, seat)); };
// two decks with no card in common, so anything of one showing up in the other's view is a leak
const NOT_MINE = () => {
  const mine = CARDS.STARTER, theirs = every.filter((id) => !mine.includes(id) && CARDS.card(id).rarity !== 'L').slice(0, DECK);
  assert.equal(CARDS.deckProblem(theirs), null);
  return [mine, theirs];
};

test('the server has the rules\' version, so a change to the cards has to touch server/', () => {
  assert.equal(live.VERSION, CARDS.VERSION, 'set VERSION in server/games/cards.js to what the rules say it is now');
  assert.equal(live.load().VERSION, live.VERSION, 'and those are the rules the server really loads');
});
test('it waits for both decks, and starts as soon as it has them', () => {
  const s = live.create({ seats: 2, rng: seeded(1) });
  assert.equal(live.tick(s), undefined);
  assert.equal(s.g, null);
  assert.deepEqual(plain(live.view(s, 0)), { ph: 'deal', cv: CARDS.VERSION });
  live.input(s, 0, { deck: CARDS.STARTER });
  live.tick(s);
  assert.equal(s.g, null, 'one deck isn\'t enough');
  live.input(s, 1, { deck: CARDS.STARTER });
  live.tick(s);
  assert.ok(s.g, 'both decks are');
});
test('a deck that never comes, or isn\'t legal, is the starter deck', () => {
  const had = (s, seat) => { const sv = plain(s.g.save()).p[seat]; return sv.deck.concat(sv.hand).map((c) => c.id || c).sort(); };
  const nobody = dealt();
  assert.deepEqual(had(nobody, 0), [...CARDS.STARTER].sort());
  const legends = every.filter((id) => CARDS.card(id).rarity === 'L');
  const two = legends.slice(0, 2).concat(CARDS.STARTER.slice(0, DECK - 2));
  assert.ok(CARDS.deckProblem(two));
  for (const bad of [two, 'all of them', 7, null, [], ['forklift'], Array(DECK).fill('forklift'), Array(DECK).fill({}), { length: DECK }]) {
    const s = live.create({ seats: 2, rng: seeded(1) });
    live.input(s, 0, { deck: bad });
    live.input(s, 1, { deck: CARDS.STARTER });
    for (let i = 0; i < 100 && !s.g; i++) live.tick(s);
    assert.deepEqual(had(s, 0), [...CARDS.STARTER].sort(), 'not ' + JSON.stringify(bad).slice(0, 30));
  }
  const good = NOT_MINE()[1], s = dealt([good, CARDS.STARTER]);
  assert.deepEqual(had(s, 0), [...good].sort(), 'a legal deck is the one you play');
});
test('you can only send your deck once', () => {
  const [a, b] = NOT_MINE(), s = live.create({ seats: 2, rng: seeded(1) });
  live.input(s, 0, { deck: a });
  live.input(s, 0, { deck: b });
  assert.deepEqual(s.decks[0], a);
});
test('the shuffle isn\'t the room\'s seed, which comes from a browser', () => {
  const order = () => { const s = live.create({ seats: 2, rng: seeded(42) }); live.input(s, 0, { deck: CARDS.STARTER }); live.input(s, 1, { deck: CARDS.STARTER }); live.tick(s); const sv = plain(s.g.save()); return sv.p[0].hand.map((h) => h.id).concat(sv.p[0].deck).join(); };
  const seen = new Set();
  for (let i = 0; i < 8; i++) seen.add(order());
  assert.ok(seen.size > 1, 'the same room seed deals different games');
});
test('neither player is sent the other\'s hand or either deck', () => {
  const [a, b] = NOT_MINE();
  const s = dealt([a, b]);
  // Anything that's been in the open stops being secret: a card that's been played, and then sent back
  // to its owner's hand, and the Double Shot, which everybody knows you get for going second.
  const open = () => { const ids = new Set(['doubleshot']); for (const e of plain(s.g.events)) if (e.e !== 'draw' && e.id) ids.add(e.id); return ids; };
  const secret = (seat) => { const sv = plain(s.g.save()), ids = new Set(), known = open(); for (const c of sv.p[1 - seat].hand) if (!known.has(c.id)) ids.add(c.id); for (const c of sv.p[1 - seat].deck) if (!known.has(c.id || c)) ids.add(c.id || c); return ids; };
  const check = () => {
    for (const seat of [0, 1]) {
      const v = fresh(s, seat), text = JSON.stringify(v), hiding = secret(seat);
      assert.equal(typeof v.them.hand, 'number');
      assert.equal(typeof v.them.deck, 'number');
      assert.equal(typeof v.you.deck, 'number', 'not even the order of your own');
      assert.equal(v.s, undefined, 'no seed');
      assert.ok(!/"s":\d{6,}/.test(text), 'nothing that looks like one');
      for (const id of hiding) assert.ok(!text.includes('"' + id + '"'), 'seat ' + seat + ' can see ' + id);
    }
  };
  check();
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  check();
  // and all through a game
  for (let m = 0; m < 400 && !s.g.result; m++) {
    const t = s.g.view(0).turn;
    live.input(s, t, s.g.choose(t, 2));
    check();
  }
  assert.ok(s.g.result, 'a whole game was played');
});
test('a game played through the server ends with who won', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  let r;
  for (let m = 0; m < 2000 && r === undefined; m++) {
    const t = s.g.view(0).turn;
    live.input(s, t, s.g.choose(t, 3));
    r = live.tick(s);
  }
  assert.ok(r, 'it finished');
  assert.ok([-1, 0, 1].includes(r.w));
  assert.equal(r.why, 'morale');
});
test('you can only play on your turn, and your own cards, and rubbish does nothing', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  const t = s.g.view(0).turn, other = 1 - t, before = JSON.stringify(plain(s.g.save()));
  const notYours = s.g.view(t).you.hand[0].u;
  for (const d of [{ do: 'end' }, { do: 'play', card: notYours }, { do: 'attack', from: 1, target: 0 }]) live.input(s, other, d);
  for (const d of [null, 1, 'end', [], {}, { do: 'nonsense' }, { do: 'play' }, { do: 'play', card: 'x' }, { do: 'play', card: {} }, { do: 'attack', from: {}, target: [] }, { do: 'swap', cards: 'x' }, { deck: CARDS.STARTER }, { do: '__proto__' }, JSON.parse('{"__proto__":{"do":"end"}}')]) {
    live.input(s, t, d);
    live.tick(s);
  }
  const was = JSON.parse(before), now = plain(s.g.save());
  assert.equal(now.turn, was.turn, 'still their turn');
  assert.equal(now.n, was.n);
  assert.deepEqual(now.p[0].hand, was.p[0].hand);
  assert.deepEqual(now.p[1].hand, was.p[1].hand);
  assert.equal(s.g.result, null);
});
test('resigning loses, at any point, and the other player can\'t do it for you', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 1, { do: 'resign' });
  assert.deepEqual(live.tick(s), { w: 0, why: 'resign' });
});
test('run out of time three turns running and you lose', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  const first = s.g.view(0).turn;
  assert.equal(s.g.view(0).clock, 75 * 60);
  let r, ticks = 0;
  while (r === undefined && ticks < LIVE_TURN * 8) { r = live.tick(s); ticks++; }
  assert.deepEqual(r, { w: 1 - first, why: 'time' });
  assert.ok(Math.abs(ticks - LIVE_TURN * 5) < 10, 'that was five turns of 75 seconds, not ' + ticks + ' ticks');
});
test('someone who never picks their cards gets on with what they have', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  for (let i = 0; i < 29 * 5; i++) live.tick(s);
  assert.equal(s.g.view(0).ph, 'swap', 'they get 30 seconds');
  for (let i = 0; i < 2 * 5; i++) live.tick(s);
  assert.equal(s.g.view(0).ph, 'play', 'and no more');
});
test('with nothing happening only the clock is sent, and now and then the whole view again', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  const whole = plain(live.view(s, 0));
  assert.ok(whole.you && whole.them, 'the first one\'s all of it');
  assert.equal(whole.cv, CARDS.VERSION);
  live.tick(s);
  const quiet = plain(live.view(s, 0));
  assert.deepEqual(Object.keys(quiet).sort(), ['clock', 'q']);
  assert.equal(quiet.clock, whole.clock - 12);
  let kinds = 0;
  for (let i = 0; i < 25; i++) { live.tick(s); if (plain(live.view(s, 0)).you) kinds++; }
  assert.ok(kinds >= 2, 'a whole view every couple of seconds, in case one was lost: ' + kinds);
  const t = s.g.view(0).turn;
  live.input(s, t, { do: 'end' });
  assert.ok(plain(live.view(s, 0)).you, 'and straight away when something happens');
});
test('a view isn\'t huge, even late in a long game', () => {
  const s = dealt([CARDS.STARTER, CARDS.STARTER]);
  live.input(s, 0, { do: 'swap', cards: [] });
  live.input(s, 1, { do: 'swap', cards: [] });
  for (let m = 0; m < 60 && !s.g.result; m++) { const t = s.g.view(0).turn; live.input(s, t, s.g.choose(t, 3)); }
  assert.ok(fresh(s, 0).ev.length <= 30);
  assert.ok(JSON.stringify(fresh(s, 0)).length < 6000, JSON.stringify(fresh(s, 0)).length + ' characters');
});
