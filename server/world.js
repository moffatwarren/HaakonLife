// Everyone playing at once, kept in memory. There are two worlds: 'live' for
// haakonlife.com and 'test' for copies opened anywhere else, which never see each other.
//
// Each browser holds one connection and sends JSON:
//   { k: 'me', r: {...} }          its player's record (name, look, floor, x, y, ...)
//   { k: 'to', to: id, m: {...} }  a message for one other player (a challenge, a move)
//   { k: 'in', m: matchId, d: ... }  what they did in a game the server is running
//   { k: 'sit' | 'stand' | 'tin', t, ... }  at a table anyone can join (see tables.js)
// and is sent:
//   { k: 'all', now, players: { id: record }, rooms: [matchId], tables: [key] }  on
//                                  connecting: everyone here, the server's clock, and any
//                                  game you're still in or table you're still sitting at
//   { k: 'p', id, r }              someone's record changed (r is null once they've gone)
//   { k: 'm', m: {...} }           a message for you, with `from`, `n` (their name) and `t`
//   { k: 'st', m, s } / { k: 'end', m, r }  a server-run game's state, and its result
//   { k: 'tb', t, s, r }           what you see at a table (see tables.js)
// Records and messages are flat objects of numbers, booleans and short strings, the same
// shape the database rules allowed before there was a server.
import { Room } from './rooms.js';
import { Table } from './tables.js';

const NAME_MAX = 12, STR_MAX = 16, KEY_RE = /^[A-Za-z0-9_]{1,16}$/;
const MAIL_MAX = 50; // messages kept for someone whose connection has dropped
const KEEP = 600000; // ms an id stays reserved for its owner after they disconnect
const ASK_MS = 60000; // ms a challenge stays open
const PER_SEC = 100; // messages a second from one player before the rest are dropped

// a copy of o if it's a flat object of allowed values, otherwise null
function flat(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (!KEY_RE.test(k)) return null;
    if (!(typeof v === 'number' && Number.isFinite(v)) && typeof v !== 'boolean' && !(typeof v === 'string' && v.length <= STR_MAX)) return null;
    out[k] = v;
  }
  return out;
}

export class World {
  constructor(name, games = {}, now = Date.now, kinds = {}) {
    Object.assign(this, { name, games, now, kinds });
    this.players = new Map(); // id -> { id, key, sock, rec, mail, goneAt, room, table, rate }
    this.socks = new Map(); // connection -> player
    this.asks = new Map(); // matchId -> an open challenge for a server-run game
    this.rooms = new Map(); // matchId -> Room
    this.tables = new Map(); // key (from kinds) -> Table, while anyone's sitting at it
  }

  online() { return [...this.players.values()].filter((p) => p.sock).length; }

  // A connection says who it is. The id is the browser's own, so it keeps it across a
  // reconnect; the key proves it's the same browser. Returns false if the id is someone
  // else's.
  join(id, key, sock) {
    let p = this.players.get(id);
    if (p && p.key !== key) return false;
    if (!p) this.players.set(id, p = { id, key, sock: null, rec: null, mail: [], goneAt: 0, room: null, table: null, rate: { s: 0, n: 0 } });
    const old = p.sock;
    p.sock = sock; p.goneAt = 0;
    this.socks.set(sock, p);
    if (old) old.close(4000, 'replaced'); // the same tab reconnecting: drop the stale one
    const players = {};
    for (const o of this.players.values()) if (o !== p && o.sock && o.rec) players[o.id] = o.rec;
    this.write(sock, { k: 'all', now: this.now(), players, rooms: p.room ? [p.room] : [], tables: p.table ? [p.table] : [] });
    for (const msg of p.mail.splice(0)) this.write(sock, msg);
    if (p.room) this.rooms.get(p.room)?.back(p.id);
    if (p.table) this.tables.get(p.table)?.back(p.id);
    return true;
  }

  leave(sock) {
    const p = this.socks.get(sock);
    this.socks.delete(sock);
    if (!p || p.sock !== sock) return; // replaced by a newer connection
    p.sock = null; p.goneAt = this.now();
    if (p.rec) { p.rec = null; this.broadcast({ k: 'p', id: p.id, r: null }, p); }
    if (p.room) this.rooms.get(p.room)?.gone(p.id);
    if (p.table) this.tables.get(p.table)?.gone(p.id);
  }

  hear(sock, d) {
    const p = this.socks.get(sock);
    if (!p || !d || typeof d !== 'object') return;
    const sec = Math.floor(this.now() / 1000);
    if (p.rate.s !== sec) p.rate = { s: sec, n: 0 };
    if (++p.rate.n > PER_SEC) return;
    if (d.k === 'me') {
      const r = flat(d.r);
      if (!r || typeof r.n !== 'string' || !r.n.length || r.n.length > NAME_MAX) return;
      if (!['f', 'x', 'y', 'p'].every((k) => typeof r[k] === 'number')) return;
      r.t = this.now();
      p.rec = r;
      this.broadcast({ k: 'p', id: p.id, r }, p);
    } else if (d.k === 'to') {
      const m = flat(d.m);
      if (!m || typeof d.to !== 'string' || d.to === p.id) return;
      Object.assign(m, { from: p.id, t: this.now() });
      if (p.rec) m.n = p.rec.n;
      this.watch(p.id, d.to, m);
      this.send(d.to, { k: 'm', m }, true);
    } else if (d.k === 'in') {
      const room = this.rooms.get(d.m);
      if (room) room.input(p.id, d.d);
    } else if (d.k === 'sit') {
      this.sit(p, d.t);
    } else if (d.k === 'stand') {
      if (p.table && p.table === d.t) this.tables.get(p.table)?.stand(p.id);
    } else if (d.k === 'tin') {
      if (p.table && p.table === d.t) this.tables.get(p.table)?.input(p.id, d.d);
    }
  }

  // Sit down at a table, starting it if nobody's there. You need a record first (it has
  // your name), and you can only be at one table at a time.
  sit(p, t) {
    if (typeof t !== 'string' || !Object.hasOwn(this.kinds, t)) return;
    if (!p.rec) { this.send(p.id, { k: 'tb', t, s: null, r: 'no' }); return; }
    if (p.table && p.table !== t) this.tables.get(p.table)?.stand(p.id);
    let table = this.tables.get(t);
    if (!table) {
      table = new Table({
        id: t, game: this.kinds[t],
        send: (pid, msg) => this.send(pid, msg),
        left: (pid) => {
          const q = this.players.get(pid);
          if (q && q.table === t) q.table = null;
          if (!table.seated().length) { table.close(); if (this.tables.get(t) === table) this.tables.delete(t); }
        },
      });
      this.tables.set(t, table);
    }
    const got = table.sit(p.id, p.rec.n);
    if (got === true) p.table = t;
    else {
      this.send(p.id, { k: 'tb', t, s: null, r: typeof got === 'string' ? got : 'full' });
      if (!table.seated().length) { table.close(); this.tables.delete(t); }
    }
  }

  // Challenges pass through here, so when one for a server-run game is accepted the
  // server starts it, and when either player gives up it stops.
  watch(from, to, m) {
    if (typeof m.m !== 'string') return;
    if (m.k === 'ask' && this.games[m.g]) {
      this.asks.set(m.m, { g: m.g, a: from, b: to, seed: +m.seed || 0, soft: !!m.soft, at: this.now() });
    } else if (m.k === 'yes') {
      const c = this.asks.get(m.m);
      if (c && c.a === to && c.b === from) { this.asks.delete(m.m); this.start(m.m, c); }
    } else if (['no', 'busy', 'cancel', 'quit'].includes(m.k)) {
      const c = this.asks.get(m.m);
      if (c && (c.a === from || c.b === from)) this.asks.delete(m.m);
      this.rooms.get(m.m)?.quit(from);
    }
  }

  start(id, c) {
    const seats = [c.a, c.b];
    if (this.rooms.has(id) || seats.some((pid) => !this.players.has(pid))) return;
    const room = new Room({
      id, game: this.games[c.g], seats, seed: c.seed, soft: c.soft,
      send: (pid, msg) => this.send(pid, msg),
      done: () => {
        this.rooms.delete(id);
        for (const pid of seats) { const p = this.players.get(pid); if (p && p.room === id) p.room = null; }
      },
    });
    if (room.over) return; // it couldn't even start
    this.rooms.set(id, room);
    for (const pid of seats) this.players.get(pid).room = id;
  }

  // keep: hold on to it if they're disconnected right now (a message, not a game's state)
  send(id, msg, keep) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.sock) this.write(p.sock, msg);
    else if (keep && p.mail.length < MAIL_MAX) p.mail.push(msg);
  }

  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const p of this.players.values()) if (p !== except && p.sock) this.write(p.sock, str);
  }

  write(sock, msg) {
    if (sock.readyState === 1) sock.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  // Every so often: forget players who've been gone a while, and challenges nobody
  // answered.
  tidy() {
    const now = this.now();
    for (const p of this.players.values()) if (!p.sock && !p.room && !p.table && now - p.goneAt > KEEP) this.players.delete(p.id);
    for (const [id, c] of this.asks) if (now - c.at > ASK_MS) this.asks.delete(id);
  }

  // the server is shutting down: stop the tables ticking
  close() {
    for (const table of this.tables.values()) table.close();
    this.tables.clear();
  }
}
