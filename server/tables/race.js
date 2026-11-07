// Live Haakon Grand Prix, against other players: two to four of them, on one of the five
// tracks. Whoever turns up first waits in the lobby for the rest, and picks the track (they're
// the host, until they leave and it's whoever's been there longest); everyone picks their own
// car. Once at least two are there and they've all pressed start, the lights go on after a few
// seconds (straight away if all four spots are taken), unless someone else turns up first.
// There's nobody the computer drives: it's just the players there. LiveRace in js/game.js draws it.
//
// The race itself is js/race.js, the same one the browser races coworkers with, read from the
// site's files the first time anyone sits down, so the server needs the whole repository, not
// just this folder. If it can't be read, live racing is off (sitting down gets 'off') and
// everything else carries on.
//
// Someone who leaves partway through (or drops out for too long) is out of the race: their car
// goes, and they're down as not finishing. If nobody's left, it's called off and the lobby's open
// again. Nobody can join a race that's on. Once it's over, everyone still there is back in the
// lobby, with the same cars, for another.
import fs from 'node:fs';
import vm from 'node:vm';

// js/race.js's VERSION: tools/check_games.mjs stops the site deploying until this matches, so a
// change to the rules always changes this folder too, which is what makes Render deploy the
// server again (a browser only races live when its rules are the server's)
export const VERSION = '1lof7f5';

export const hz = 30; // each tick is STEPS of the race's (it runs at 60 a second)
const STEPS = 2;
const SIZE = 4;
const OVER = 10 * hz; // ticks the results stay up before it's back to the lobby
const FILL = 5 * hz; // ticks a lobby with spots to spare waits, once everyone there is ready

let engine;
// js/race.js's RACE, or null if it can't be loaded
export function load() {
  if (engine !== undefined) return engine;
  try {
    const ctx = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(new URL('../../js/race.js', import.meta.url), 'utf8'), ctx, { filename: 'js/race.js' });
    engine = ctx.window.RACE || null;
  } catch (e) {
    engine = null;
  }
  if (!engine) console.error('Live racing is off: js/race.js could not be loaded');
  return engine;
}

// ph: 'lobby', 'race' or 'over'. slots: who's in each spot, { id, n (their name), r (pressed
// start), car }, or null. host: the id of whoever picks the track, tr. cd: ticks the lobby's been
// waiting for anyone else. In a race: g (js/race.js's race), ids (who's driving each car, in
// order), hold (what each is doing, from input), gn (counts races), n (counts the race's ticks)
// and ev (what happened since the last view); last: the results of the last race.
export function create({ rng }) {
  return { rng, slots: Array(SIZE).fill(null), host: null, tr: 0, ph: 'lobby', t: 0, cd: 0, g: null, ids: [], hold: [], gn: 0, n: 0, ev: [], last: null };
}

const slotOf = (s, id) => s.slots.findIndex((q) => q && q.id === id);
const seatedIds = (s) => s.slots.filter(Boolean).map((q) => q.id);

// Into the first free spot in the lobby. Not if they're all taken ('full'), or a race is on ('busy').
export function sit(s, id, name) {
  if (slotOf(s, id) >= 0) return true;
  if (!load()) return 'off';
  if (s.ph !== 'lobby') return 'busy';
  const i = s.slots.indexOf(null);
  if (i < 0) return 'full';
  s.slots[i] = { id, n: String(name).slice(0, 12), r: false, car: 0 };
  if (!s.host) s.host = id;
  return true;
}

// Out of the lobby, or out of the race (their car goes). If that was the last one there, the
// race is off and the lobby's open for whoever comes next.
export function stand(s, id) {
  const i = slotOf(s, id);
  if (i < 0) return;
  s.slots[i] = null;
  if (s.host === id) s.host = seatedIds(s)[0] || null;
  const j = s.ids.indexOf(id);
  if (s.ph === 'race' && j >= 0) { s.g.retire(j); s.ids[j] = null; s.hold[j] = still(); }
  if (s.ph !== 'lobby' && !s.slots.some(Boolean)) toLobby(s);
}

function toLobby(s) {
  s.ph = 'lobby'; s.g = null; s.ids = []; s.hold = []; s.cd = 0;
  for (const q of s.slots) if (q) q.r = false;
}

// A dropped connection lets go of everything, rather than driving on into the barriers.
export function away(s, id, gone) {
  const j = s.ids.indexOf(id);
  if (gone && j >= 0 && s.ph === 'race') Object.assign(s.hold[j], { s: 0, a: false, b: false, Q: [] });
}

// What each driver is doing: s, a and b as below, and Q, the ticks still to come, oldest first
// ({ q, s, a, b }), got (the newest q in), aq (the newest the race has had) and deep (ticks the
// queue's been longer than it need be).
const still = () => ({ s: 0, a: false, b: false, Q: [], got: 0, aq: 0, deep: 0 });
const QMAX = 30; // ticks of input kept waiting, at most (half a second)

// In the lobby: { car: 0-3 } picks your car, { tr: 0-2 } the track (the host only), and { go:
// true } is pressing start ({ go: false } taking it back). Picking something else takes your
// start back, and a new track takes everyone's. In a race, what they did a tick at a time (a
// browser's own 60ths of a second, the race's speed): { q, i: [[s, a, b], ...] }, the ticks
// numbered on from q, each with the steering (s, -1 to 1), the gas (a, 1 or 0) and the brake
// (b). The race takes one each tick, and tells them the last it's taken (aq, in view), so the
// browser can run ahead of it with the rest.
export function input(s, id, d) {
  const i = slotOf(s, id);
  if (i < 0 || !d || typeof d !== 'object') return;
  const R = load();
  if (s.ph === 'lobby') {
    const q = s.slots[i];
    if (Number.isInteger(d.car) && R.CARS[d.car]) { if (q.car !== d.car) q.r = false; q.car = d.car; }
    else if (Number.isInteger(d.tr) && R.TRACKS[d.tr] && s.host === id) { if (s.tr !== d.tr) for (const o of s.slots) if (o) o.r = false; s.tr = d.tr; }
    else if (typeof d.go === 'boolean') q.r = d.go;
    return;
  }
  const j = s.ids.indexOf(id);
  if (s.ph !== 'race' || j < 0 || !Array.isArray(d.i) || !Number.isInteger(d.q)) return;
  const h = s.hold[j], num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  d.i.slice(0, QMAX).forEach((e, k) => {
    if (!Array.isArray(e) || d.q + k <= h.got) return; // (one it's had already)
    h.got = d.q + k;
    h.Q.push({ q: h.got, s: num(e[0]), a: !!e[1], b: !!e[2] });
  });
  while (h.Q.length > QMAX) h.Q.unshift(merge(h.Q.shift(), h.Q.shift()));
}
// Two ticks of input as one, for catching up: steering as the later, but a press not lost
const merge = (e, f) => ({ q: f.q, s: f.s, a: e.a || f.a, b: e.b || f.b });

// The lights go on, with everyone in the lobby on the grid in the order of their spots.
function start(s) {
  const R = load(), here = s.slots.filter(Boolean);
  s.g = R.create(s.tr, { seed: Math.floor(s.rng() * 2 ** 31) || 1, players: here.map((q) => ({ name: q.n, car: q.car })) });
  s.ids = here.map((q) => q.id);
  s.hold = here.map(still);
  s.ph = 'race'; s.gn++; s.n = 0; s.cd = 0; s.ev = []; s.last = null;
  for (const q of here) q.r = false;
}

// One tick of the race: everyone's input in.
function step(s) {
  const g = s.g;
  const ins = g.cars.map((c, j) => {
    const h = s.hold[j];
    if (!s.ids[j]) return {};
    if (h.Q.length) {
      // their next tick, or if they've got ahead (a bunch at once after a hiccup), two as one to
      // catch up: straight away if they're well ahead, or now and then if a little
      let e = h.Q.shift();
      h.deep = h.Q.length > 2 ? h.deep + 1 : 0;
      if (h.Q.length > 6 || h.deep > 60) { e = merge(e, h.Q.shift()); h.deep = 0; }
      Object.assign(h, { s: e.s, a: e.a, b: e.b, aq: e.q });
    }
    // (none come yet: what they were doing goes on)
    return { s: h.s, a: h.a, b: h.b };
  });
  g.step(ins);
  s.n++;
  for (const e of g.events) s.ev.push(event(e));
  if (g.over()) {
    s.ph = 'over'; s.t = 0;
    s.last = g.places().map((c) => ({ n: c.name, car: c.car, fin: c.out ? -1 : c.fin, out: c.out, best: c.laps.length ? Math.min(...c.laps) : 0 }));
  }
}

// js/race.js's events name cars by the car itself; these go by their place
const event = (e) => {
  const o = { e: e.e };
  if (e.c) o.c = e.c.i;
  if (e.o) o.o = e.o.i;
  for (const k of ['n', 'place']) if (e[k] !== undefined) o[k] = e[k];
  if (e.p !== undefined) o.p = round(e.p);
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
    for (let k = 0; k < STEPS && s.ph === 'race'; k++) step(s);
  }
  return [];
}

export function seated(s) { return seatedIds(s); }

// For a list of tables (see tables.js): which track (tr), and in a race, the leader's lap (lap).
// Nobody can join a race that's on.
export function brief(s) {
  const b = { size: SIZE, ph: s.ph, tr: s.tr, who: s.slots.filter(Boolean).map((q) => q.n), open: s.ph === 'lobby' ? s.slots.filter((q) => !q).length : 0 };
  if (s.g) b.lap = Math.min(load().LAPS, Math.max(...s.g.cars.map((c) => c.laps.length)) + 1);
  return b;
}

// What id sees. Always: ph, me (their spot in the lobby), tr, rv (js/race.js's VERSION) and last
// (the last race's results, best first: { n, car, fin (its time in ticks, or -1), out, best (its
// best lap) }). In the lobby: slots ({ id, n, r, car } or null), host (the spot of whoever picks
// the track) and cd (seconds until the lights go on, or 0). In a race ('race', or 'over' once
// it's been won): gn and n (see create), who (each car: { id, n, car }, id null once they've
// left), at (their car, or -1), and for a browser to run the race ahead on its own, st (the
// whole race, js/race.js's save()) and aq (the last tick of their input the race has taken),
// and ev (what happened since the last view, as js/race.js's events but with cars by their place).
export function view(s, id) {
  const me = slotOf(s, id), base = { ph: s.ph, me, tr: s.tr, rv: load().VERSION, last: s.last };
  if (s.ph === 'lobby') {
    return Object.assign(base, { slots: s.slots.map((q) => q && { id: q.id, n: q.n, r: q.r, car: q.car }), host: slotOf(s, s.host), cd: s.cd ? Math.ceil((FILL - s.cd) / hz) : 0 });
  }
  const g = s.g, at = s.ids.indexOf(id);
  return Object.assign(base, {
    gn: s.gn, n: s.n, at,
    who: g.cars.map((c, j) => ({ id: s.ids[j], n: c.name, car: c.car })),
    st: mm(g.save()), aq: at >= 0 ? s.hold[at].aq : 0,
    ev: s.ph === 'race' ? s.ev : [],
  });
}
// (to the millimetre, for sending)
const mm = (v) => (typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(mm) : v);
