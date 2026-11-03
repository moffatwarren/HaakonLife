// The Haakon Life game server. A browser connects with a WebSocket to
//   wss://<host>/?w=<live or test>&id=<its player id>&key=<its secret>&b=1
// and from then on it's JSON messages both ways (see world.js). &b=1 says it takes
// everyone's moves bundled up (copies from before that leave it off). A plain web request
// gets "ok" and how many people are on, for the host's health check, and how many problems
// browsers have reported (see problems.js, for a POST to /problem).
//
// Settings, from the environment:
//   PORT     where to listen (default 8080)
//   ORIGINS  the pages allowed to connect, comma separated, e.g.
//            "https://haakonlife.com,https://www.haakonlife.com". Unset allows any page,
//            which is what you want on your own computer.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { World, BUNDLE_MS } from './world.js';
import defaultGames from './games/index.js';
import defaultTables from './tables/index.js';
import { problemDesk } from './problems.js';

// A bug in handling one player's message shouldn't stop the game for everybody else.
function safely(what, id, fn) {
  try { return fn(); } catch (e) { console.error(what, id, 'failed:', e); return undefined; }
}

export function start({ port = 8080, origins = [], games = defaultGames, tables = defaultTables } = {}) {
  const worlds = { live: new World('live', games, Date.now, tables), test: new World('test', games, Date.now, tables) };
  const problems = problemDesk(origins);
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/problem') { problems.take(req, res); return; }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok ' + Object.entries(worlds).map(([n, w]) => n + ':' + w.online()).join(' ') + ' problems:' + problems.count + '\n');
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    // (a connection that breaks before it's a WebSocket: with nobody listening for that
    // error, it would stop the whole server)
    socket.on('error', () => {});
    const q = new URL(req.url, 'http://localhost').searchParams;
    const world = Object.hasOwn(worlds, q.get('w')) ? worlds[q.get('w')] : null;
    const id = q.get('id') || '', key = q.get('key') || '';
    if (!world || (origins.length && !origins.includes(req.headers.origin)) ||
      !/^[A-Za-z0-9]{1,16}$/.test(id) || !key || key.length > 32) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Something broken or too big (over maxPayload) coming down a connection closes that
      // connection, and is reported here. With nobody listening for it, it would stop the
      // whole server, and everybody on it with their live games.
      ws.on('error', (e) => console.error('connection', id, 'dropped:', e.message));
      ws.on('close', () => safely('leaving', id, () => world.leave(ws)));
      const joined = safely('joining', id, () => world.join(id, key, ws, q.get('b') === '1'));
      if (joined === undefined) { ws.close(1011, 'error'); return; }
      if (!joined) { ws.close(4001, 'taken'); return; }
      ws.alive = true;
      ws.on('pong', () => { ws.alive = true; });
      ws.on('message', (buf) => {
        let d;
        try { d = JSON.parse(buf); } catch { return; }
        safely('message from', id, () => world.hear(ws, d));
      });
    });
  });

  // A connection that hasn't answered a ping in 30 seconds (a phone that's been put
  // away, say) is closed, which takes that player out of the office.
  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  const tidy = setInterval(() => Object.values(worlds).forEach((w) => w.tidy()), 30000);
  const bundle = setInterval(() => Object.values(worlds).forEach((w) => w.flush()), BUNDLE_MS);

  server.listen(port);
  return {
    server, worlds,
    // Closing tells every browser the server is restarting (1012), so they reconnect
    // straight away to the new one.
    close() {
      clearInterval(ping); clearInterval(tidy); clearInterval(bundle);
      Object.values(worlds).forEach((w) => w.close());
      for (const ws of wss.clients) ws.close(1012, 'restarting');
      return new Promise((done) => server.close(done));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = +process.env.PORT || 8080;
  const origins = (process.env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const s = start({ port, origins });
  console.log('Haakon Life server on port ' + port + (origins.length ? ', for ' + origins.join(', ') : ''));
  // hosts stop the old copy with SIGTERM when they deploy a new one
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => s.close().then(() => process.exit(0)));
}
