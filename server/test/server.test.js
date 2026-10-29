// Run with `npm test` in server/. Starts a real server on a spare port and connects to it
// the way browsers do, with a made-up game ("count") standing in for a server-run game.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { start } from '../index.js';

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
const srv = start({ port: PORT, games: { count, broken } });
after(() => srv.close());

let n = 0;
// a stand-in browser: connect(), then wait for() a message matching a test
function client(world = 'test', id = 'p' + ++n, key = 'k' + id) {
  const ws = new WebSocket(`ws://localhost:${PORT}/?w=${world}&id=${id}&key=${key}`);
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

test('the live and test worlds never meet', async () => {
  const a = client('live'), b = client('test');
  await a.open(); await b.open();
  await b.for((d) => d.k === 'all');
  a.me();
  await pause(100);
  assert.ok(!b.got.some((d) => d.k === 'p'));
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
  assert.ok(!b.got.some((d) => d.k === 'p'));
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
