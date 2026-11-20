// Jenn's Cookie Showdown's rules (js/cookies.js), played by the computer with no browser: that a
// quicker player does better, that the contest always ends however good you are (so there's no
// top score), that mashing, never drinking and biting the burnt ones all cost you, and that a
// saved contest carries on the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.createContext(box);
vm.runInContext(readFileSync(new URL('../../js/cookies.js', import.meta.url), 'utf8'), box);
const C = box.window.COOKIES;

// one contest to the end, with `play` deciding what a player does each tick (or the computer
// playing them, if they're ai): what they scored, how long they lasted and everything that happened
function contest(player, seed, play) {
  const g = C.create({ players: [player], seed });
  const events = [];
  while (!g.over() && g.t < 60 * 60 * 30) {
    g.step([play ? play(g, g.players[0]) : {}]);
    events.push(...g.events);
  }
  return { g, eaten: g.players[0].eaten, secs: (g.players[0].outAt - C.READY) / 60, events };
}
const average = (react, play, early = 0) => {
  let n = 0;
  for (let seed = 1; seed <= 20; seed++) n += contest({ name: 'Bot', ai: !play, react, early }, seed, play).eaten;
  return n / 20;
};

test('the rules load from the site\'s file', () => {
  assert.ok(C, 'js/cookies.js');
  assert.equal(typeof C.VERSION, 'string');
  for (const k of Object.values(C.KINDS)) assert.ok(k.size > 0 && k.size < 1 && k.bites > 0, k.name + ': a bite fits in an empty mouth');
});

test('it always ends, even for a player who never puts a foot wrong, so nobody reaches a top score', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { g, eaten, secs } = contest({ name: 'Perfect', ai: true, react: 0 }, seed);
    assert.ok(g.over(), 'seed ' + seed + ': Nik or Dmitriy caught up in the end');
    assert.ok(secs < 240, 'seed ' + seed + ': within four minutes (' + secs.toFixed(0) + 's)');
    assert.ok(eaten > 30, 'seed ' + seed + ': after a good few cookies (' + eaten + ')');
  }
});

test('the quicker you bite once there\'s room, the more you eat', () => {
  const quick = average(0), fair = average(15), slow = average(35);
  assert.ok(quick > fair && fair > slow, 'quick ' + quick + ', fair ' + fair + ', slow ' + slow);
  assert.ok(slow >= 12, 'even a slow player gets somewhere (' + slow + ')');
});

test('mashing chokes you', () => {
  // A on every other tick, and nothing else
  const mash = average(0, (g) => ({ bite: (g.t & 1) === 0 }));
  assert.ok(mash < average(35) / 2, 'mashing ' + mash);
  const { events } = contest({ name: 'Masher' }, 1, (g) => ({ bite: (g.t & 1) === 0 }));
  assert.ok(events.some((e) => e.e === 'choke'), 'it chokes');
});

test('the milk matters, and so does pushing the burnt ones away', () => {
  const sensible = average(10);
  let dry = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = C.create({ players: [{ name: 'Dry', ai: true, react: 10 }], seed });
    g.players[0].milk = -1e9; // (never enough for a gulp)
    while (!g.over()) g.step([]);
    dry += g.players[0].eaten;
  }
  assert.ok(dry / 20 < sensible / 2, 'never drinking: ' + dry / 20 + ' against ' + sensible);
  // the computer's own play, but biting the burnt cookies instead of pushing them away
  let bit = 0, crunches = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = contest({ name: 'Crunch' }, seed, (g, p) => {
      if (p.cough || p.bite || p.gulp || p.push || p.next) return {};
      if (p.burnt) return { bite: true };
      if (p.dry > 0.55 && p.milk >= 1) return { drink: true };
      return g.room(p) ? { bite: true } : {};
    });
    bit += r.eaten; crunches += r.events.filter((e) => e.e === 'crunch').length;
  }
  assert.ok(crunches > 0, 'there were burnt cookies to bite');
  assert.ok(bit / 20 < average(0) * 0.9, 'biting them: ' + bit / 20 + ' against ' + average(0));
});

test('burnt cookies never come two in a row or in the first few, and giants are worth two', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { events } = contest({ name: 'Bot', ai: true, react: 5 }, seed);
    let gone = 0, jenns = true, giants = 0, last = 0;
    for (const e of events) {
      if (e.e === 'slip') {
        assert.ok(gone >= 3, 'seed ' + seed + ': not in the first three');
        assert.ok(jenns, 'seed ' + seed + ': one of Jenn\'s since the last one');
        jenns = false;
      }
      if (e.e === 'ate' || e.e === 'waste') jenns = true;
      if (e.e === 'ate' || e.e === 'waste' || e.e === 'push' || e.e === 'crunch') gone++;
      if (e.e === 'ate') {
        if (e.kind === 'giant') { giants++; assert.ok(gone > 3, 'seed ' + seed + ': no giant in the first three'); }
        assert.equal(e.n, last + (e.kind === 'giant' ? 2 : 1), 'seed ' + seed + ': a giant counts twice');
        last = e.n;
      }
    }
  }
});

test('you\'re out the moment either of them has eaten more than you', () => {
  const { g } = contest({ name: 'Bot', ai: true, react: 20 }, 3);
  const p = g.players[0];
  assert.ok(g.rivals[p.outBy].eaten > p.eaten);
  assert.ok(g.rivals[p.outBy].eaten === p.eaten + 1, 'by one cookie, when it happened');
  // and nobody had eaten more than you before then
  const again = C.create({ players: [{ name: 'Bot', ai: true, react: 20 }], seed: 3 });
  while (again.t < p.outAt - 1) {
    again.step([]);
    assert.ok(again.rivals.every((r) => r.eaten <= again.players[0].eaten), 'still in at tick ' + again.t);
  }
});

test('the same seed plays the same, and a saved contest carries on just as it would have', () => {
  const a = contest({ name: 'Bot', ai: true, react: 8 }, 42), b = contest({ name: 'Bot', ai: true, react: 8 }, 42);
  assert.equal(a.eaten, b.eaten); assert.equal(a.g.t, b.g.t);
  const g = C.create({ players: [{ name: 'Bot', ai: true, react: 8 }], seed: 42 });
  for (let i = 0; i < 2000; i++) g.step([]);
  const saved = JSON.parse(JSON.stringify(g.save()));
  const h = C.create({ players: [{ name: 'Bot', ai: true, react: 8 }], seed: 1 });
  h.load(saved);
  while (!g.over()) { g.step([]); h.step([]); }
  assert.ok(h.over());
  assert.deepEqual(h.save(), g.save());
});
