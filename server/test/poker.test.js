// The live poker table's rules on their own, without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as poker from '../tables/poker.js';
import { seeded } from '../rooms.js';

const table = (seed = 1) => poker.create({ rng: seeded(seed) });
// tick until something's true (or give up)
const until = (s, ok, max = 2000) => {
  const out = [];
  for (let i = 0; i < max && !ok(s); i++) out.push(...poker.tick(s));
  assert.ok(ok(s), 'it got there');
  return out;
};
const turn = (s) => s.seats[s.toAct].id;
const total = (s) => s.seats.reduce((n, p) => n + (p ? p.stack + p.total : 0), 0);

test('one player waits; a second starts the first hand', () => {
  const s = table();
  assert.ok(poker.sit(s, 'a', 'Ann'));
  for (let i = 0; i < 100; i++) poker.tick(s);
  assert.equal(s.ph, 'wait');
  assert.equal(poker.view(s, 'a').me, 0);
  poker.sit(s, 'b', 'Bob');
  until(s, () => s.ph === 'play');
  assert.equal(s.seats[0].hand.length, 2);
  assert.equal(s.seats[1].hand.length, 2);
  assert.equal(s.seats[0].total + s.seats[1].total, poker.SB + poker.BB);
});

test('four seats at most', () => {
  const s = table();
  for (const id of ['a', 'b', 'c', 'd']) assert.ok(poker.sit(s, id, id));
  assert.ok(!poker.sit(s, 'e', 'e'));
  assert.ok(poker.sit(s, 'a', 'a'), 'sitting again where you already are is fine');
  poker.stand(s, 'b');
  assert.ok(poker.sit(s, 'e', 'e'));
});

test('someone who sits down mid-hand is dealt in from the next one', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  until(s, () => s.ph === 'play' && s.toAct >= 0);
  poker.sit(s, 'c', 'Cat');
  const c = s.seats[2];
  assert.equal(c.dealt, false);
  assert.deepEqual(poker.view(s, 'c').seats[2].h, []);
  poker.input(s, turn(s), { a: 'fold' });
  until(s, () => s.ph === 'result');
  until(s, () => s.ph === 'play' && s.toAct >= 0);
  assert.equal(c.dealt, true);
  assert.equal(c.hand.length, 2);
});

test('you only see your own cards until the showdown', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  until(s, () => s.toAct >= 0);
  const v = poker.view(s, 'a');
  assert.ok(v.seats[0].h.every((c) => c && c.r));
  assert.deepEqual(v.seats[1].h, [0, 0]);
  // check it down to the end
  until(s, () => {
    if (s.toAct >= 0 && !s.timer) poker.input(s, turn(s), { a: 'call' });
    return s.ph === 'result';
  });
  assert.ok(poker.view(s, 'a').seats[1].h.every((c) => c && c.r));
  assert.equal(s.board.length, 5);
});

test('only whoever\'s turn it is can act, and the rolls always add up', () => {
  const s = table(7);
  for (const id of ['a', 'b', 'c']) poker.sit(s, id, id);
  until(s, () => s.toAct >= 0);
  const other = s.seats.find((p) => p.id !== turn(s)).id;
  const before = JSON.stringify(s.seats);
  poker.input(s, other, { a: 'fold' });
  assert.equal(JSON.stringify(s.seats), before);
  let hands = 0;
  until(s, () => {
    if (s.toAct >= 0 && !s.timer) {
      const r = s.rng();
      poker.input(s, turn(s), r < 0.2 ? { a: 'fold' } : r < 0.5 ? { a: 'raise', to: s.curBet + s.minRaise * 2 } : { a: 'call' });
    }
    if (s.ph === 'result' && s.timer === 1) hands++;
    // nobody new sits down, so whoever's busted, the rolls on the table stay the same
    assert.equal(total(s), poker.BUY_IN * 3);
    return hands >= 10 || s.ph === 'wait';
  }, 100000);
});

test('getting up on your turn folds you, and the last one in takes the pot', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  until(s, () => s.toAct >= 0);
  const leaver = turn(s), stayer = leaver === 'a' ? 'b' : 'a';
  poker.stand(s, leaver);
  assert.deepEqual(poker.seated(s), [stayer]);
  until(s, () => s.ph === 'result');
  // heads-up the button posts the small blind and acts first, so the leaver put in SB
  assert.equal(s.seats.find((p) => p && p.id === stayer).stack, poker.BUY_IN + poker.SB);
  until(s, () => s.ph === 'wait');
  assert.equal(s.seats.filter(Boolean).length, 1);
});

test('getting up out of turn: the one left thinking wins straight away', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  until(s, () => s.toAct >= 0);
  const other = turn(s) === 'a' ? 'b' : 'a';
  poker.stand(s, other);
  assert.equal(s.ph, 'result');
});

test('running out of time checks or folds you, and twice in a row gets you up', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob'); poker.sit(s, 'c', 'Cat');
  until(s, () => s.toAct >= 0);
  const slow = turn(s);
  const out = until(s, () => {
    if (s.toAct >= 0 && !s.timer && turn(s) !== slow) poker.input(s, turn(s), { a: 'call' });
    return !poker.seated(s).includes(slow);
  }, 100000);
  assert.deepEqual(out, [{ id: slow, r: 'idle' }]);
  assert.equal(total(s), poker.BUY_IN * 3);
});

test('running out of rolls gets you up', () => {
  const s = table(3);
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  const out = until(s, () => {
    if (s.toAct >= 0 && !s.timer) poker.input(s, turn(s), { a: 'raise', to: 99999 });
    return s.ph === 'wait' && s.hn > 0;
  }, 100000);
  assert.equal(out.length, 1);
  assert.equal(out[0].r, 'bust');
  assert.equal(poker.seated(s).length, 1);
  assert.equal(s.seats.find(Boolean).stack, poker.BUY_IN * 2);
});

test('the log reads "You" to you and your name to everyone else', () => {
  const s = table();
  poker.sit(s, 'a', 'Ann'); poker.sit(s, 'b', 'Bob');
  until(s, () => s.toAct >= 0);
  const who = turn(s), name = who === 'a' ? 'Ann' : 'Bob', them = who === 'a' ? 'b' : 'a';
  poker.input(s, who, { a: 'call' });
  assert.match(poker.view(s, who).log[0], /^You call/);
  assert.match(poker.view(s, them).log[0], new RegExp('^' + name + ' calls'));
});
