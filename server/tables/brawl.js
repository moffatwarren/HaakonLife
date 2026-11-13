// Live Haakon Brawl, against other players: two to four of them, every one for themselves, on
// one of the stages. Whoever turns up first waits in the lobby for the rest, and picks the stage
// (they're the host, until they leave and it's whoever's been there longest). Once at least two
// are there and they've all pressed start, the fight starts after a few seconds (straight away
// if all four spots are taken), unless someone else turns up first. There's nobody the computer
// plays: it's just the players there. LiveBrawl in js/game.js draws it.
//
// The fight itself is js/brawl.js, the same one the browser fights coworkers with, read from
// the site's files the first time anyone sits down, so the server needs the whole repository,
// not just this folder. If it can't be read, live fights are off (sitting down gets 'off') and
// everything else carries on.
//
// Everyone has three lives, and the last one standing wins; after four minutes it's whoever has
// the most lives left (then the least damage). Someone who leaves partway through (or drops out
// for too long) is out of the fight. If nobody's left, it's called off and the lobby's open again.
// Nobody can join a fight that's on. Once it's over, everyone still there is back in the lobby
// for another.
import fs from 'node:fs';
import vm from 'node:vm';

// js/brawl.js's VERSION: tools/check_games.mjs stops the site deploying until this matches, so a
// change to the rules always changes this folder too, which is what makes Render deploy the
// server again (a browser only fights live when its rules are the server's)
export const VERSION = '1hhvgc4';

export const hz = 30; // each tick is STEPS of the fight's (it runs at 60 a second)
const STEPS = 2;
const SIZE = 4;
const TIME = 4 * 60 * 60; // the fight's time limit, in its ticks
const OVER = 8 * hz; // ticks the results stay up before it's back to the lobby
const FILL = 5 * hz; // ticks a lobby with spots to spare waits, once everyone there is ready

let engine;
// js/brawl.js's BRAWL, or null if it can't be loaded
export function load() {
  if (engine !== undefined) return engine;
  try {
    const ctx = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(new URL('../../js/brawl.js', import.meta.url), 'utf8'), ctx, { filename: 'js/brawl.js' });
    engine = ctx.window.BRAWL || null;
  } catch (e) {
    engine = null;
  }
  if (!engine) console.error('Live brawls are off: js/brawl.js could not be loaded');
  return engine;
}

// ph: 'lobby', 'fight' or 'over'. slots: who's in each spot, { id, n (their name), r (pressed
// start) }, or null. host: the id of whoever picks the stage, st. cd: ticks the lobby's been
// waiting for anyone else. In a fight: g (js/brawl.js's fight), ids (who's playing each
// fighter, in order), hold (what each is doing, from input), gn (counts fights), n (counts the
// fight's ticks) and ev (what happened since the last view); last: the last fight's results.
export function create({ rng }) {
  return { rng, slots: Array(SIZE).fill(null), host: null, st: 0, ph: 'lobby', t: 0, cd: 0, g: null, ids: [], hold: [], gn: 0, n: 0, ev: [], last: null };
}

const slotOf = (s, id) => s.slots.findIndex((q) => q && q.id === id);
const seatedIds = (s) => s.slots.filter(Boolean).map((q) => q.id);

// Into the first free spot in the lobby. Not if they're all taken ('full'), or a fight is on ('busy').
export function sit(s, id, name) {
  if (slotOf(s, id) >= 0) return true;
  if (!load()) return 'off';
  if (s.ph !== 'lobby') return 'busy';
  const i = s.slots.indexOf(null);
  if (i < 0) return 'full';
  s.slots[i] = { id, n: String(name).slice(0, 12), r: false };
  if (!s.host) s.host = id;
  return true;
}

// Out of the lobby, or out of the fight. If that was the last one there, the fight's off and
// the lobby's open for whoever comes next.
export function stand(s, id) {
  const i = slotOf(s, id);
  if (i < 0) return;
  s.slots[i] = null;
  if (s.host === id) s.host = seatedIds(s)[0] || null;
  const j = s.ids.indexOf(id);
  if (s.ph === 'fight' && j >= 0) { s.g.retire(j); s.ids[j] = null; s.hold[j] = still(); }
  if (s.ph !== 'lobby' && !s.slots.some(Boolean)) toLobby(s);
}

function toLobby(s) {
  s.ph = 'lobby'; s.g = null; s.ids = []; s.hold = []; s.cd = 0;
  for (const q of s.slots) if (q) q.r = false;
}

// A dropped connection lets go of everything, rather than running on off the edge.
export function away(s, id, gone) {
  const j = s.ids.indexOf(id);
  if (gone && j >= 0 && s.ph === 'fight') Object.assign(s.hold[j], { x: 0, y: 0, a: false, b: false, Q: [] });
}

// What each fighter's player is doing: x, y, a and b as below, and Q, the ticks still to come,
// oldest first ({ q, x, y, a, b }), got (the newest q in), aq (the newest the fight has had)
// and deep (ticks the queue's been longer than it need be).
const still = () => ({ x: 0, y: 0, a: false, b: false, Q: [], got: 0, aq: 0, deep: 0 });
const QMAX = 30; // ticks of input kept waiting, at most (half a second)

// In the lobby: { st: 0-2 } picks the stage (the host only), and { go: true } is pressing start
// ({ go: false } taking it back). A new stage takes everyone's start back. In a fight, what they
// did a tick at a time (a browser's own 60ths of a second, the fight's speed): { q, i: [[x, y,
// a, b], ...] }, the ticks numbered on from q, each with the way they're holding (x and y, -1,
// 0 or 1), A (a, 1 or 0) and B (b). The fight takes one each tick, and tells them the last it's
// taken (aq, in view), so the browser can run ahead of it with the rest.
export function input(s, id, d) {
  const i = slotOf(s, id);
  if (i < 0 || !d || typeof d !== 'object') return;
  const B = load();
  if (s.ph === 'lobby') {
    const q = s.slots[i];
    if (Number.isInteger(d.st) && B.STAGES[d.st] && s.host === id) { if (s.st !== d.st) for (const o of s.slots) if (o) o.r = false; s.st = d.st; }
    else if (typeof d.go === 'boolean') q.r = d.go;
    return;
  }
  const j = s.ids.indexOf(id);
  if (s.ph !== 'fight' || j < 0 || !Array.isArray(d.i) || !Number.isInteger(d.q)) return;
  const h = s.hold[j], way = (v) => (v === 1 || v === -1 ? v : 0);
  d.i.slice(0, QMAX).forEach((e, k) => {
    if (!Array.isArray(e) || d.q + k <= h.got) return; // (one it's had already)
    h.got = d.q + k;
    h.Q.push({ q: h.got, x: way(e[0]), y: way(e[1]), a: !!e[2], b: !!e[3] });
  });
  while (h.Q.length > QMAX) h.Q.unshift(merge(h.Q.shift(), h.Q.shift()));
}
// Two ticks of input as one, for catching up: the way they're holding as the later, a button
// down if it was down in either (so a quick press isn't lost)
const merge = (e, f) => ({ q: f.q, x: f.x, y: f.y, a: e.a || f.a, b: e.b || f.b });

// The fight starts, with everyone in the lobby in the order of their spots.
function start(s) {
  const B = load(), here = s.slots.filter(Boolean);
  s.g = B.create(s.st, { seed: Math.floor(s.rng() * 2 ** 31) || 1, time: TIME, players: here.map((q) => ({ name: q.n })) });
  s.ids = here.map((q) => q.id);
  s.hold = here.map(still);
  s.ph = 'fight'; s.gn++; s.n = 0; s.cd = 0; s.ev = []; s.last = null;
  for (const q of here) q.r = false;
}

// One tick of the fight: everyone's input in.
function step(s) {
  const g = s.g;
  const ins = g.fighters.map((f, j) => {
    const h = s.hold[j];
    if (!s.ids[j]) return {};
    if (h.Q.length) {
      // their next tick, or if they've got ahead (a bunch at once after a hiccup), two as one to
      // catch up: straight away if they're well ahead, or now and then if a little
      let e = h.Q.shift();
      h.deep = h.Q.length > 2 ? h.deep + 1 : 0;
      if (h.Q.length > 6 || h.deep > 60) { e = merge(e, h.Q.shift()); h.deep = 0; }
      Object.assign(h, { x: e.x, y: e.y, a: e.a, b: e.b, aq: e.q });
    }
    // (none come yet: what they were doing goes on)
    return { x: h.x, y: h.y, a: h.a, b: h.b };
  });
  g.step(ins);
  s.n++;
  for (const e of g.events) s.ev.push(event(e));
  if (g.over()) {
    s.ph = 'over'; s.t = 0;
    s.last = g.places().map((f) => ({ n: f.name, lives: f.out ? 0 : f.lives, kos: f.kos, falls: f.falls, left: !!f.left }));
  }
}

// js/brawl.js's events name fighters by the fighter itself; these go by their place
const event = (e) => {
  const o = { e: e.e };
  for (const k of ['f', 'o', 'by']) if (e[k]) o[k] = e[k].i;
  for (const k of ['n', 'm', 'air', 'time']) if (e[k] !== undefined) o[k] = e[k];
  for (const k of ['dmg', 'p', 'x', 'y']) if (e[k] !== undefined) o[k] = round(e[k]);
  return o;
};
const round = (v) => Math.round(v * 1000) / 1000;

export function tick(s) {
  if (s.ph === 'lobby') {
    // everyone's ready: straight on with a full lobby, or with spots to spare (and at least two
    // players), after a few seconds for anyone else to turn up
    const here = s.slots.filter(Boolean);
    if (here.length >= 2 && here.every((q) => q.r)) { if (here.length === SIZE || ++s.cd >= FILL) start(s); }
    else s.cd = 0;
  } else if (s.ph === 'over') {
    if (++s.t >= OVER) toLobby(s);
  } else {
    s.ev = [];
    for (let k = 0; k < STEPS && s.ph === 'fight'; k++) step(s);
  }
  return [];
}

export function seated(s) { return seatedIds(s); }

// For a list of tables (see tables.js): which stage (st). Nobody can join a fight that's on.
export function brief(s) {
  return { size: SIZE, ph: s.ph, st: s.st, who: s.slots.filter(Boolean).map((q) => q.n), open: s.ph === 'lobby' ? s.slots.filter((q) => !q).length : 0 };
}

// What id sees. Always: ph, me (their spot in the lobby), st, bv (js/brawl.js's VERSION) and last
// (the last fight's results, winner first: { n, lives (left), kos, falls, left (they left) }).
// In the lobby: slots ({ id, n, r } or null), host (the spot of whoever picks the stage) and cd
// (seconds until the fight starts, or 0). In a fight ('fight', or 'over' once it's been won): gn
// and n (see create), who (each fighter: { id, n }, id null once they've left), at (theirs, or
// -1), and for a browser to run the fight ahead on its own, sv (the whole fight, js/brawl.js's
// save()) and aq (the last tick of their input the fight has taken), and ev (what happened since
// the last view, as js/brawl.js's events but with fighters by their place).
export function view(s, id) {
  const me = slotOf(s, id), base = { ph: s.ph, me, st: s.st, bv: load().VERSION, last: s.last };
  if (s.ph === 'lobby') {
    return Object.assign(base, { slots: s.slots.map((q) => q && { id: q.id, n: q.n, r: q.r }), host: slotOf(s, s.host), cd: s.cd ? Math.ceil((FILL - s.cd) / hz) : 0 });
  }
  const g = s.g, at = s.ids.indexOf(id);
  return Object.assign(base, {
    gn: s.gn, n: s.n, at,
    who: g.fighters.map((f, j) => ({ id: s.ids[j], n: f.name })),
    sv: mm(g.save()), aq: at >= 0 ? s.hold[at].aq : 0,
    ev: s.ph === 'fight' ? s.ev : [],
  });
}
// (to the millimetre, for sending)
const mm = (v) => (typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(mm) : v);
