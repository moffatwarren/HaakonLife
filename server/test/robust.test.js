// Things going wrong shouldn't take everybody else down with them. Run with `npm test` in
// server/. Starts real servers on spare ports, as server.test.js does.
import { test, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { start } from '../index.js';

// a table game whose sit throws, one whose view does, and the rest of what a table needs
const table = {
  create: () => ({}), stand() {}, input() {}, tick() {}, seated: () => [], brief: () => ({}), view: () => ({}),
};
const tables = {
  boom: { ...table, sit() { throw new Error('oops'); } },
  blind: { ...table, sit: () => true, view() { throw new Error('oops'); } },
};
const PORT = 19080 + Math.floor(Math.random() * 400);
const srv = start({ port: PORT, tables });
const ORIGIN = 'https://game.example';
const PORT2 = PORT + 500;
const srv2 = start({ port: PORT2, origins: [ORIGIN], tables });
after(() => Promise.all([srv.close(), srv2.close()]));

// the server logs what goes wrong, which is what these tests set off on purpose
let errors, realError;
beforeEach(() => { errors = []; realError = console.error; console.error = (...a) => { errors.push(a.join(' ')); }; });
afterEach(() => { console.error = realError; });

let n = 0;
function connect(port = PORT) {
  const id = 'r' + ++n, ws = new WebSocket(`ws://localhost:${port}/?w=test&id=${id}&key=k${id}`);
  const got = [];
  ws.on('message', (b) => got.push(JSON.parse(b)));
  return new Promise((ok, fail) => {
    ws.once('error', fail); // (can't get on at all)
    ws.once('open', () => { ws.off('error', fail); ws.on('error', () => {}); ok({ id, ws, got }); }); // (being cut off is the point of some of these)
  });
}
const closed = (ws) => new Promise((ok) => ws.once('close', (code) => ok(code)));
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const say = (c, d) => c.ws.send(JSON.stringify(d));
const me = (c) => say(c, { k: 'me', r: { n: 'P' + c.id, f: 0, x: 1, y: 2, p: 1 } });

// someone else on the server can still be heard, and somebody new can still get on
async function stillUp(other, port = PORT) {
  const fresh = await connect(port);
  me(fresh);
  await pause(60);
  assert.ok(other.got.some((d) => d.k === 'p' && d.id === fresh.id), 'the others hear about somebody new');
  assert.equal(other.ws.readyState, WebSocket.OPEN);
  fresh.ws.close();
}

// The server as it really runs, on its own: an error nobody catches stops it, as it would for
// real. (One started inside a test, like the others here, would carry on regardless: the test
// runner catches those itself.)
async function ownServer(port) {
  const proc = spawn(process.execPath, ['index.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, PORT: String(port), ORIGINS: '' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const own = { proc, stopped: false };
  proc.once('exit', () => { own.stopped = true; });
  await new Promise((ok) => proc.stdout.once('data', ok));
  return own;
}

test('a message that is too big drops that connection, not the server', async () => {
  const port = PORT + 1000, own = await ownServer(port);
  try {
    const other = await connect(port), bad = await connect(port);
    const gone = closed(bad.ws);
    bad.ws.send(JSON.stringify({ k: 'me', pad: 'x'.repeat(20 * 1024) }));
    assert.equal(await gone, 1009); // the WebSocket code for "too big"
    await pause(50);
    assert.equal(own.stopped, false, 'the server is still running');
    await stillUp(other, port);
    other.ws.close();
  } finally { own.proc.kill(); }
});

test('a broken frame drops that connection, not the server', async () => {
  const port = PORT + 1001, own = await ownServer(port);
  try {
    const other = await connect(port), bad = await connect(port);
    const gone = closed(bad.ws);
    bad.ws._socket.write(Buffer.from([0xff, 0x80, 0, 0, 0, 0])); // not a WebSocket frame at all
    assert.equal(await gone, 1002); // the WebSocket code for "protocol error"
    await pause(50);
    assert.equal(own.stopped, false, 'the server is still running');
    await stillUp(other, port);
    other.ws.close();
  } finally { own.proc.kill(); }
});

test('a bug in a table game as you sit down tells you and leaves no table behind', async () => {
  const other = await connect(), c = await connect();
  me(c);
  await pause(30);
  say(c, { k: 'sit', t: 'boom' });
  await pause(50);
  assert.ok(c.got.some((d) => d.k === 'tb' && d.s === null && d.r === 'error'));
  assert.ok(!srv.worlds.test.tables.has('boom'));
  await stillUp(other);
  other.ws.close(); c.ws.close();
});

test('a bug while handling a message goes in the log, and the server carries on', async () => {
  const other = await connect(), c = await connect();
  me(c);
  await pause(30);
  say(c, { k: 'sit', t: 'blind' });
  await pause(50);
  assert.ok(errors.some((e) => e.startsWith('message from ' + c.id + ' failed:')), 'it was logged');
  await stillUp(other);
  other.ws.close(); c.ws.close();
  for (const t of srv.worlds.test.tables.values()) t.close();
  srv.worlds.test.tables.clear();
});

const report = (body, port = PORT, headers = {}) => fetch(`http://localhost:${port}/problem`, { method: 'POST', body, headers });
const problems = async (port = PORT) => +/problems:(\d+)/.exec(await (await fetch(`http://localhost:${port}/`)).text())[1];

test('a problem a browser reports goes in the log on one line and on the health check', async () => {
  const before = await problems();
  const res = await report(JSON.stringify({ m: 'boom\nfake log line', s: 'at draw (js/game.js:1:1)', at: 'play / laundry', v: 123 }), PORT, { 'user-agent': 'A phone' });
  assert.equal(res.status, 204);
  assert.equal(await problems(), before + 1);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].startsWith('browser problem {'));
  assert.ok(!errors[0].includes('\n'), 'it stays on one line, whatever is in it');
  assert.deepEqual(JSON.parse(errors[0].slice('browser problem '.length)),
    { m: 'boom\nfake log line', at: 'play / laundry', v: 123, ua: 'A phone', s: 'at draw (js/game.js:1:1)' });
});

test('a report that makes no sense or is far too big is turned away', async () => {
  const before = await problems();
  assert.equal((await report('not json')).status, 400);
  assert.equal((await report(JSON.stringify({ at: 'no message' }))).status, 400);
  assert.equal((await report(JSON.stringify({ m: 'x'.repeat(20 * 1024) }))).status, 413);
  assert.equal(await problems(), before);
  assert.equal(errors.length, 0);
});

test('only the pages allowed to connect can report a problem', async () => {
  const body = JSON.stringify({ m: 'boom' });
  assert.equal((await report(body, PORT2, { origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await report(body, PORT2)).status, 403);
  assert.equal((await report(body, PORT2, { origin: ORIGIN })).status, 204);
});

test('reports are limited to so many a minute, so nobody can flood the log', async () => {
  // (enough that it goes over the limit even if the clock reaches a new minute partway through)
  const body = JSON.stringify({ m: 'again' });
  const codes = [];
  for (let i = 0; i < 130; i++) codes.push((await report(body, PORT2, { origin: ORIGIN })).status);
  assert.ok(codes.includes(204));
  assert.ok(codes.includes(429));
});
