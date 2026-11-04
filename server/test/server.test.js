// Run with `npm test` in server/. Starts a real server on a spare port and connects to it
// the way browsers do, with a made-up game ("count") standing in for a server-run game.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { start } from '../index.js';
import * as cards from '../games/cards.js';

// first to 3 presses wins; ticks fast so the tests don't wait
const count = {
  hz: 50,
  create: ({ seats }) => ({ n: Array(seats).fill(0) }),
  input(s, seat, d) { if (d === 'press') s.n[seat]++; },
  tick(s) { const w = s.n.findIndex((n) => n >= 3); return w >= 0 ? { winner: w } : undefined; },
  view: (s, seat) => ({ mine: s.n[seat], theirs: s.n[1 - seat] }),
};
const broken = { create: () => ({}), tick() { throw new Error('oops'); } };

const PORT = 18080 + Math.floor(Math.random() * 1000);
const srv = start({ port: PORT, games: { count, broken, cards } });
after(() => srv.close());

let n = 0;
// a stand-in browser: connect(), then wait for() a message matching a test. bundles: it
// asks for everyone's moves bundled up, the way the game does now
function client(world = 'test', id = 'p' + ++n, key = 'k' + id, bundles = false) {
  const ws = new WebSocket(`ws://localhost:${PORT}/?w=${world}&id=${id}&key=${key}` + (bundles ? '&b=1' : ''));
  const got = [], waiting = [];
  ws.on('message', (buf) => {
    const d = JSON.parse(buf);
    got.push(d);
    for (const w of waiting.slice()) if (w.test(d)) { waiting.splice(waiting.indexOf(w), 1); w.done(d); }
  });
  const c = {
    id, ws, got,
    open: () => new Promise((ok, fail) => {
      if (ws.readyState === WebSocket.OPEN) ok(); else { ws.once('open', ok); ws.once('error', fail); }
    }),
    send: (d) => ws.send(JSON.stringify(d)),
    me: (r = {}) => c.send({ k: 'me', r: { n: 'P' + id, f: 0, x: 1, y: 2, p: 1, ...r } }),
    for(test, ms = 2000) {
      const seen = got.find(test);
      if (seen) { got.splice(got.indexOf(seen), 1); return Promise.resolve(seen); }
      return new Promise((done, fail) => {
        const w = { test, done: (d) => { clearTimeout(timer); got.splice(got.indexOf(d), 1); done(d); } };
        const timer = setTimeout(() => { waiting.splice(waiting.indexOf(w), 1); fail(new Error('timed out waiting')); }, ms);
        waiting.push(w);
      });
    },
    closed: () => new Promise((ok) => { ws.once('close', (code) => ok(code)); }),
  };
  return c;
}
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

test('players see each other arrive, move and leave', async () => {
  const a = client();
  await a.open(); await a.for((d) => d.k === 'all');
  a.me({ x: 5 });
  await pause(50);
  const b = client();
  await b.open();
  const all = await b.for((d) => d.k === 'all');
  assert.equal(all.players[a.id].x, 5);
  assert.equal(typeof all.players[a.id].t, 'number');
  b.me();
  assert.equal((await a.for((d) => d.k === 'p' && d.id === b.id)).r.n, 'P' + b.id);
  a.me({ x: 6 });
  assert.equal((await b.for((d) => d.k === 'p' && d.id === a.id && d.r)).r.x, 6);
  a.ws.close();
  assert.equal((await b.for((d) => d.k === 'p' && d.id === a.id)).r, null);
  b.ws.close();
});

test('a copy that takes bundles hears about everyone who moved together, and older copies still one at a time', async () => {
  const a = client(), b = client(), c = client('test', 'p' + ++n, 'kp' + n, true);
  for (const x of [a, b, c]) { await x.open(); await x.for((d) => d.k === 'all'); }
  a.me({ x: 7 }); b.me({ x: 8 });
  await pause(250);
  const bundles = c.got.filter((d) => d.k === 'ps');
  assert.ok(bundles.length >= 1 && bundles.length <= 2);
  const seen = Object.assign({}, ...bundles.map((d) => d.ps));
  assert.deepEqual([seen[a.id].x, seen[b.id].x], [7, 8]);
  assert.ok(!c.got.some((d) => d.k === 'p'));
  // the older copies hear the newer one straight away, as before; it isn't sent a bundle
  // of just its own record
  c.got.length = 0;
  c.me({ x: 9 });
  assert.equal((await a.for((d) => d.k === 'p' && d.id === c.id)).r.x, 9);
  assert.equal((await b.for((d) => d.k === 'p' && d.id === c.id)).r.x, 9);
  await pause(250);
  assert.ok(!c.got.some((d) => d.k === 'ps'));
  // somebody leaving goes in the next bundle
  a.ws.close();
  assert.equal((await c.for((d) => d.k === 'ps' && a.id in d.ps)).ps[a.id], null);
  b.ws.close(); c.ws.close();
});

test('the live and test worlds never meet', async () => {
  const a = client('live'), b = client('test');
  await a.open(); await b.open();
  await b.for((d) => d.k === 'all');
  a.me();
  await pause(100);
  assert.ok(!b.got.some((d) => d.k === 'p' && d.id === a.id));
  a.ws.close(); b.ws.close();
});

test('records that break the rules are ignored', async () => {
  const a = client(), b = client();
  await a.open(); await b.open();
  await b.for((d) => d.k === 'all');
  a.send({ k: 'me', r: { n: 'x'.repeat(13), f: 0, x: 0, y: 0, p: 1 } }); // name too long
  a.send({ k: 'me', r: { n: 'Al', f: 0, x: 0, y: 0, p: 1, junk: 'y'.repeat(17) } }); // long string
  a.send({ k: 'me', r: { n: 'Al', x: 0, y: 0, p: 1 } }); // no floor
  a.send({ k: 'me', r: { n: 'Al', f: 0, x: 0, y: 0, p: 1, o: { nested: 1 } } });
  await pause(100);
  assert.ok(!b.got.some((d) => d.k === 'p' && d.id === a.id));
  a.ws.close(); b.ws.close();
});

test('messages reach one player, stamped with who sent them', async () => {
  const a = client(), b = client(), c = client();
  await a.open(); await b.open(); await c.open();
  a.me({ n: 'Alice' });
  a.send({ k: 'to', to: b.id, m: { k: 'mv', m: 'x1', from: 'forged', s: 4 } });
  const got = await b.for((d) => d.k === 'm');
  assert.deepEqual([got.m.k, got.m.s, got.m.from, got.m.n], ['mv', 4, a.id, 'Alice']);
  await pause(50);
  assert.ok(!c.got.some((d) => d.k === 'm'));
  a.ws.close(); b.ws.close(); c.ws.close();
});

test('a dropped player gets their messages when they reconnect, under the same id', async () => {
  const a = client(), b = client();
  await a.open(); await b.open();
  b.ws.close();
  await pause(50);
  a.send({ k: 'to', to: b.id, m: { k: 'mv', m: 'x2', s: 1 } });
  await pause(50);
  const b2 = client('test', b.id, 'k' + b.id);
  await b2.open();
  assert.equal((await b2.for((d) => d.k === 'm')).m.s, 1);
  a.ws.close(); b2.ws.close();
});

test('nobody else can take an id that is in use', async () => {
  const a = client();
  await a.open();
  const thief = client('test', a.id, 'wrong');
  const code = await thief.closed();
  assert.equal(code, 4001);
  // the same browser reconnecting replaces its old connection
  const again = client('test', a.id, 'k' + a.id);
  const closedOld = a.closed();
  await again.open();
  assert.equal(await closedOld, 4000);
  again.ws.close();
});

test('a bad connection address is turned away', async () => {
  for (const q of ['w=nowhere&id=a&key=b', 'w=test&id=has space&key=b', 'w=test&id=a', 'w=__proto__&id=a&key=b']) {
    const ws = new WebSocket(`ws://localhost:${PORT}/?${q}`);
    await new Promise((done) => ws.on('error', done));
  }
});

// a challenge and an acceptance, passed along the way browsers do it
async function match(game) {
  const a = client(), b = client();
  await a.open(); await b.open();
  a.me(); b.me();
  const m = 'm' + n;
  a.send({ k: 'to', to: b.id, m: { k: 'ask', m, g: game, seed: 42, soft: 0 } });
  await b.for((d) => d.k === 'm' && d.m.k === 'ask');
  b.send({ k: 'to', to: a.id, m: { k: 'yes', m } });
  return { a, b, m };
}

test('a card game, over real connections: decks, a turn, and resigning', async () => {
  const { a, b, m } = await match('cards');
  a.send({ k: 'in', m, d: { deck: 'not a deck' } });
  b.send({ k: 'in', m, d: { deck: [] } });
  const deal = await a.for((d) => d.k === 'st' && d.m === m && d.s.you, 4000);
  assert.equal(typeof deal.s.them.hand, 'number');
  assert.equal(deal.s.ph, 'swap');
  a.send({ k: 'in', m, d: { do: 'swap', cards: [] } });
  b.send({ k: 'in', m, d: { do: 'swap', cards: [] } });
  const play = await a.for((d) => d.k === 'st' && d.m === m && d.s.ph === 'play', 4000);
  const mine = play.s.turn === play.s.me;
  (mine ? a : b).send({ k: 'in', m, d: { do: 'end' } });
  await a.for((d) => d.k === 'st' && d.m === m && d.s.ph === 'play' && d.s.turn !== play.s.turn, 4000);
  b.send({ k: 'in', m, d: { do: 'resign' } });
  const [ea, eb] = await Promise.all([a.for((d) => d.k === 'end'), b.for((d) => d.k === 'end')]);
  assert.deepEqual(ea.r, { w: 0, why: 'resign' });
  assert.deepEqual(eb.r, { w: 0, why: 'resign' });
  a.ws.close(); b.ws.close();
});

test('an accepted challenge for a server game starts it, and it plays to the end', async () => {
  const { a, b, m } = await match('count');
  const st = await a.for((d) => d.k === 'st' && d.m === m);
  assert.deepEqual(st.s, { mine: 0, theirs: 0 });
  for (let i = 0; i < 3; i++) b.send({ k: 'in', m, d: 'press' });
  a.send({ k: 'in', m, d: 'press' });
  await b.for((d) => d.k === 'st' && d.s.mine === 3);
  const [ea, eb] = await Promise.all([a.for((d) => d.k === 'end'), b.for((d) => d.k === 'end')]);
  assert.deepEqual(ea.r, { winner: 1 });
  assert.deepEqual(eb.r, { winner: 1 });
  assert.equal(srv.worlds.test.rooms.size, 0);
  a.ws.close(); b.ws.close();
});

test('a challenge for a game the server does not run is just passed along', async () => {
  const { a, b } = await match('snake');
  await pause(100);
  assert.ok(!a.got.some((d) => d.k === 'st'));
  a.ws.close(); b.ws.close();
});

test('a challenge that waited for a menu to close says so, and its server game still starts', async () => {
  const a = client(), b = client();
  await a.open(); await b.open();
  a.me(); b.me();
  const m = 'm' + n;
  a.send({ k: 'to', to: b.id, m: { k: 'ask', m, g: 'count', seed: 42, soft: 0 } });
  await b.for((d) => d.k === 'm' && d.m.k === 'ask');
  b.send({ k: 'to', to: a.id, m: { k: 'seen', m } });
  await a.for((d) => d.k === 'm' && d.m.k === 'seen');
  b.send({ k: 'to', to: a.id, m: { k: 'yes', m } });
  await a.for((d) => d.k === 'st' && d.m === m);
  a.send({ k: 'to', to: b.id, m: { k: 'quit', m } });
  await b.for((d) => d.k === 'end');
  a.ws.close(); b.ws.close();
});

test('a dropped player gets the newest messages when there are too many to keep', async () => {
  const a = client(), b = client();
  await a.open(); await b.open();
  await a.for((d) => d.k === 'all'); await b.for((d) => d.k === 'all');
  b.ws.close();
  await pause(50);
  for (let i = 0; i < 60; i++) a.send({ k: 'to', to: b.id, m: { k: 'mv', m: 'x', i } });
  await pause(100);
  const b2 = client('test', b.id, 'k' + b.id);
  await b2.open();
  await b2.for((d) => d.k === 'all');
  // (the last one is the one that would be somebody's final score)
  await b2.for((d) => d.k === 'm' && d.m.i === 59);
  assert.equal(b2.got.some((d) => d.k === 'm' && d.m.i === 0), false);
  a.ws.close(); b2.ws.close();
});

test('giving up ends a server game for both', async () => {
  const { a, b, m } = await match('count');
  await a.for((d) => d.k === 'st');
  a.send({ k: 'to', to: b.id, m: { k: 'quit', m } });
  assert.deepEqual((await b.for((d) => d.k === 'end')).r, { quit: 0 });
  a.ws.close(); b.ws.close();
});

test('a player dropping out and coming back carries on the game', async () => {
  const { a, b, m } = await match('count');
  await a.for((d) => d.k === 'st');
  b.ws.close();
  await pause(100);
  const b2 = client('test', b.id, 'k' + b.id);
  await b2.open();
  assert.deepEqual((await b2.for((d) => d.k === 'all')).rooms, [m]);
  await b2.for((d) => d.k === 'st' && d.m === m);
  a.send({ k: 'to', to: b.id, m: { k: 'quit', m } });
  await b2.for((d) => d.k === 'end');
  a.ws.close(); b2.ws.close();
});

test('a game that crashes ends with an error, and the server carries on', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const { a, b } = await match('broken');
    assert.deepEqual((await a.for((d) => d.k === 'end')).r, { error: true });
    a.ws.close(); b.ws.close();
  } finally { console.error = orig; }
  const res = await fetch(`http://localhost:${PORT}/`);
  assert.match(await res.text(), /^ok live:\d+ test:\d+/);
});

// sitting down at the poker table, the way browsers do it
async function seated(...cs) {
  for (const c of cs) {
    await c.open(); c.me();
    await pause(20);
    c.send({ k: 'sit', t: 'poker' });
    await c.for((d) => d.k === 'tb' && d.s);
  }
}

test('one player waits at the table; a second sits down and they are dealt in', async () => {
  const a = client(), b = client();
  await seated(a);
  assert.equal(srv.worlds.test.tables.get('poker').seated().length, 1);
  await pause(300);
  assert.ok(a.got.every((d) => d.k !== 'tb' || d.s.ph === 'wait'));
  await seated(b);
  const st = await a.for((d) => d.k === 'tb' && d.s.ph === 'play' && d.s.act >= 0, 4000);
  assert.equal(st.s.seats[st.s.me].h.length, 2);
  assert.ok(st.s.seats.filter(Boolean).every((p, i) => i === st.s.me || p.h.every((c) => c === 0)));
  // whoever's turn it is folds, and the other takes the pot
  const mover = st.s.seats[st.s.act].id === a.id ? a : b;
  mover.send({ k: 'tin', t: 'poker', d: { a: 'fold' } });
  await a.for((d) => d.k === 'tb' && d.s.ph === 'result');
  // getting up empties the table, and it's put away
  a.send({ k: 'stand', t: 'poker' });
  assert.equal((await a.for((d) => d.k === 'tb' && !d.s)).r, 'left');
  b.send({ k: 'stand', t: 'poker' });
  await b.for((d) => d.k === 'tb' && !d.s);
  assert.equal(srv.worlds.test.tables.size, 0);
  a.ws.close(); b.ws.close();
});

test('a fifth player is told the table is full', async () => {
  const cs = [client(), client(), client(), client()], e = client();
  await seated(...cs);
  await e.open(); e.me();
  await pause(20);
  e.send({ k: 'sit', t: 'poker' });
  assert.equal((await e.for((d) => d.k === 'tb')).r, 'full');
  // (just closing would keep their seats for a while, in case they came back)
  for (const c of cs) { c.send({ k: 'stand', t: 'poker' }); await c.for((d) => d.k === 'tb' && !d.s); c.ws.close(); }
  e.ws.close();
});

test('dropping out and coming back keeps your seat', async () => {
  const a = client(), b = client();
  await seated(a, b);
  b.ws.close();
  await pause(100);
  const b2 = client('test', b.id, 'k' + b.id);
  await b2.open();
  assert.deepEqual((await b2.for((d) => d.k === 'all')).tables, ['poker']);
  await b2.for((d) => d.k === 'tb' && d.s);
  assert.equal(srv.worlds.test.tables.get('poker').seated().length, 2);
  for (const c of [a, b2]) { c.send({ k: 'stand', t: 'poker' }); await c.for((d) => d.k === 'tb' && !d.s); c.ws.close(); }
});

// into a live hockey lobby, the way browsers do it
async function lobby(t, ...cs) {
  for (const c of cs) {
    await c.open(); c.me();
    await pause(20);
    c.send({ k: 'sit', t });
    await c.for((d) => d.k === 'tb' && d.s && d.s.ph === 'lobby');
  }
}

test('live hockey: two in the lobby press start and play; a third is told a game is on', async () => {
  const a = client(), b = client(), c = client();
  await lobby('hockey1', a, b);
  a.send({ k: 'tin', t: 'hockey1', d: { mv: 'right' } });
  const moved = await b.for((d) => d.k === 'tb' && d.s.slots && d.s.slots[1] && d.s.slots[1].id === a.id);
  assert.equal(moved.s.slots[0].id, b.id, 'swapped');
  for (const x of [a, b]) x.send({ k: 'tin', t: 'hockey1', d: { go: true } });
  const v = await a.for((d) => d.k === 'tb' && d.s.ph === 'play');
  assert.equal(v.s.me, 1);
  assert.deepEqual(v.s.who.map((w) => w.id), [b.id, a.id]);
  await c.open(); c.me();
  await pause(20);
  c.send({ k: 'sit', t: 'hockey1' });
  assert.equal((await c.for((d) => d.k === 'tb')).r, 'busy');
  // steering: a's skater (team 1) skates down the ice once the puck has dropped
  a.send({ k: 'tin', t: 'hockey1', d: { x: 0, y: 1, a: 0, ap: 0, bp: 0 } });
  const later = await a.for((d) => d.k === 'tb' && d.s.gp === 'play' && d.s.gt > 30, 5000);
  assert.ok(later.s.pl[1][1] > v.s.pl[1][1] + 1);
  // b leaves: the computer takes over b's skater, and a plays on
  b.send({ k: 'stand', t: 'hockey1' });
  assert.equal((await b.for((d) => d.k === 'tb' && !d.s)).r, 'left');
  await a.for((d) => d.k === 'tb' && d.s.who && d.s.who[0].ai);
  a.send({ k: 'stand', t: 'hockey1' });
  await a.for((d) => d.k === 'tb' && !d.s);
  assert.equal(srv.worlds.test.tables.size, 0);
  for (const x of [a, b, c]) x.ws.close();
});

// up from wherever they are, and gone
async function done(...cs) {
  for (const c of cs) {
    const t = srv.worlds.test.players.get(c.id)?.table;
    if (t) { c.send({ k: 'stand', t }); await c.for((d) => d.k === 'tb' && d.t === t && !d.s); }
    c.ws.close();
  }
}
const listed = (c, g) => { c.send({ k: 'ls', g }); return c.for((d) => d.k === 'ls' && d.g === g); };

test('two hockey games at once: each with its own players, its own lobby and its own score', async () => {
  const a = client(), b = client(), c = client(), d = client();
  await lobby('hockey1:one', a, b);
  await lobby('hockey1:two', c, d);
  assert.equal(srv.worlds.test.tables.size, 2);
  for (const x of [a, b]) x.send({ k: 'tin', t: 'hockey1:one', d: { go: true } });
  const v = await a.for((m) => m.k === 'tb' && m.s.ph === 'play');
  assert.equal(v.t, 'hockey1:one');
  assert.deepEqual(v.s.who.map((w) => w.id), [a.id, b.id]);
  // the other game hasn't started, and nothing of the first reached it
  await pause(100);
  const seen = c.got.filter((m) => m.k === 'tb');
  assert.ok(seen.every((m) => m.t === 'hockey1:two' && m.s.ph === 'lobby'));
  assert.deepEqual(seen[seen.length - 1].s.slots.map((q) => q.id), [c.id, d.id]);
  for (const x of [c, d]) x.send({ k: 'tin', t: 'hockey1:two', d: { go: true } });
  const w = await c.for((m) => m.k === 'tb' && m.s.ph === 'play');
  assert.deepEqual(w.s.who.map((q) => q.id), [c.id, d.id]);
  assert.equal(srv.worlds.test.tables.get('hockey1:one').state.gn, 1);
  assert.equal(srv.worlds.test.tables.get('hockey1:two').state.gn, 1);
  // what you send only reaches the game you're in
  a.send({ k: 'tin', t: 'hockey1:two', d: { x: 1, y: 0, a: 0, ap: 0, bp: 0 } });
  await pause(50);
  assert.deepEqual([srv.worlds.test.tables.get('hockey1:two').state.hold[0].x, srv.worlds.test.tables.get('hockey1:one').state.hold[0].x], [0, 0]);
  await done(a, b, c, d);
  assert.equal(srv.worlds.test.tables.size, 0);
});

test('two poker tables at once, and sitting at another gets you up from the first', async () => {
  const a = client(), b = client();
  for (const c of [a, b]) { await c.open(); c.me(); }
  await pause(20);
  a.send({ k: 'sit', t: 'poker:red' });
  b.send({ k: 'sit', t: 'poker:blue' });
  assert.equal((await a.for((d) => d.k === 'tb' && d.s)).t, 'poker:red');
  assert.equal((await b.for((d) => d.k === 'tb' && d.s)).t, 'poker:blue');
  assert.deepEqual([...srv.worlds.test.tables.keys()].sort(), ['poker:blue', 'poker:red']);
  b.send({ k: 'sit', t: 'poker:red' });
  assert.equal((await b.for((d) => d.k === 'tb' && d.t === 'poker:blue' && !d.s)).r, 'left');
  await b.for((d) => d.k === 'tb' && d.t === 'poker:red' && d.s);
  assert.deepEqual([...srv.worlds.test.tables.keys()], ['poker:red'], 'the empty one is put away');
  await done(a, b);
});

test('a list of what\'s on: only the sort you ask for, oldest first, with who\'s there', async () => {
  const a = client(), b = client(), c = client(), d = client();
  await lobby('hockey2:first', a, b);
  await lobby('hockey3:second', c);
  await seated(d);
  const { l } = await listed(a, 'hockey');
  assert.deepEqual(l.map((g) => g.t), ['hockey2:first', 'hockey3:second']);
  assert.deepEqual(l[0], { t: 'hockey2:first', size: 4, ph: 'lobby', who: ['P' + a.id, 'P' + b.id], open: 2 });
  assert.equal(l[1].size, 6);
  assert.deepEqual((await listed(a, 'poker')).l.map((g) => [g.t, g.open]), [['poker', 3]]);
  assert.deepEqual((await listed(a, 'pong')).l, []);
  assert.equal(b.got.filter((m) => m.k === 'ls').length, 0, 'just to whoever asked');
  await done(a, b, c, d);
});

test('anyone connected can ask what\'s on, and nothing odd gets through', async () => {
  const a = client();
  await a.open();
  assert.deepEqual((await listed(a, 'hockey')).l, [], 'without a record yet, or a seat');
  a.send({ k: 'ls' }); a.send({ k: 'ls', g: 5 }); a.send({ k: 'ls', g: '' });
  await pause(50);
  assert.equal(a.got.filter((m) => m.k === 'ls').length, 0);
  a.me();
  await pause(20);
  for (const t of ['nosuch', 'nosuch:x', 'poker:', ':x', 'poker:a:b', 'poker:' + 'x'.repeat(17), 'poker: x', 'constructor', '__proto__', 7, null]) a.send({ k: 'sit', t });
  await pause(50);
  assert.equal(srv.worlds.test.tables.size, 0);
  assert.equal(a.got.filter((m) => m.k === 'tb').length, 0);
  a.ws.close();
});

test('joining from a list: told if it\'s gone, and doesn\'t start a new one', async () => {
  const a = client(), b = client();
  await lobby('hockey2:mine', a);
  await b.open(); b.me();
  await pause(20);
  b.send({ k: 'sit', t: 'hockey2:gone', j: 1 });
  assert.equal((await b.for((d) => d.k === 'tb' && d.t === 'hockey2:gone')).r, 'ended');
  assert.equal(srv.worlds.test.tables.size, 1);
  b.send({ k: 'sit', t: 'hockey2:mine', j: 1 });
  assert.equal((await b.for((d) => d.k === 'tb' && d.t === 'hockey2:mine' && d.s)).s.me, 1);
  await done(a, b);
});

test('sitting down in a game on the ice: the computer\'s spot is theirs, on every screen', async () => {
  const a = client(), b = client(), c = client(), d = client();
  await lobby('hockey2:ice', a, b);
  for (const x of [a, b]) x.send({ k: 'tin', t: 'hockey2:ice', d: { go: true } });
  await a.for((m) => m.k === 'tb' && m.s.ph === 'play', 7000);
  assert.deepEqual((await listed(a, 'hockey')).l.map((g) => [g.ph, g.open, g.who.length]), [['play', 2, 2]]);
  await c.open(); c.me();
  await pause(20);
  c.send({ k: 'sit', t: 'hockey2:ice', j: 1 });
  const v = await c.for((m) => m.k === 'tb' && m.s);
  assert.equal(v.s.ph, 'play', 'straight into the game');
  assert.equal(v.s.me, 2);
  const w = await a.for((m) => m.k === 'tb' && m.s.who && m.s.who[2].id === c.id);
  assert.equal(w.s.who[2].ai, false);
  assert.equal((await listed(a, 'hockey')).l[0].open, 1);
  await d.open(); d.me();
  await pause(20);
  d.send({ k: 'sit', t: 'hockey2:ice', j: 1 });
  await d.for((m) => m.k === 'tb' && m.s);
  assert.equal((await listed(a, 'hockey')).l[0].open, 0, 'full now');
  await done(a, b, c, d);
});

test('dropping out and coming back keeps your place at one table of several', async () => {
  const a = client(), b = client();
  await lobby('hockey2:other', a);
  await lobby('hockey2:mine', b);
  b.ws.close();
  await pause(100);
  const b2 = client('test', b.id, 'k' + b.id);
  await b2.open();
  assert.deepEqual((await b2.for((d) => d.k === 'all')).tables, ['hockey2:mine']);
  const v = await b2.for((d) => d.k === 'tb' && d.s);
  assert.equal(v.t, 'hockey2:mine');
  await done(a, b2);
});

test('a copy from before there could be several still gets its one table of each', async () => {
  const a = client(), b = client();
  await lobby('hockey1', a);
  await lobby('hockey1', b);
  assert.deepEqual(srv.worlds.test.tables.get('hockey1').seated().sort(), [a.id, b.id].sort());
  const n = client();
  await n.open();
  const { l } = await listed(n, 'hockey');
  assert.deepEqual(l.map((g) => [g.t, g.size, g.open]), [['hockey1', 2, 0]], 'and it shows up in everyone\'s list');
  await done(a, b, n);
});

test('there\'s only so many tables at once', async () => {
  const cs = [];
  for (let i = 0; i < 40; i++) { const c = client(); await c.open(); c.me(); cs.push(c); }
  await pause(50);
  cs.forEach((c, i) => c.send({ k: 'sit', t: 'poker:t' + i }));
  await Promise.all(cs.map((c) => c.for((d) => d.k === 'tb' && d.s)));
  assert.equal(srv.worlds.test.tables.size, 40);
  const e = client();
  await e.open(); e.me();
  await pause(20);
  e.send({ k: 'sit', t: 'poker:more' });
  assert.equal((await e.for((d) => d.k === 'tb')).r, 'many');
  e.send({ k: 'sit', t: 'poker:t3' });
  await e.for((d) => d.k === 'tb' && d.s);
  await done(...cs, e);
  assert.equal(srv.worlds.test.tables.size, 0);
});
