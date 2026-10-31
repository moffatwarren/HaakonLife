// Live hockey on the parking lot's rink, against other players: one on one (the 'hockey1'
// table) or two on two ('hockey2'). Whoever turns up first waits in the lobby for the rest.
// Anyone there can move over to the other team (swapping places with someone if it's full),
// and once every spot is taken and everyone has pressed start, the puck drops. Two or three
// players needn't wait for a fourth, though: once everyone there has pressed start, the
// computer takes the empty spots after a few seconds (unless someone else turns up first).
// LiveHockey in js/game.js draws it.
//
// The game itself is js/hockey.js, the same one the browser plays against a coworker, with
// the rink from js/maps.js. Both are read from the site's files the first time anyone sits
// down, so the server needs the whole repository, not just this folder. If they can't be
// read, live hockey is off (sitting down gets 'off') and everything else carries on.
//
// Someone who leaves partway through (or drops out for too long) has their skater played by
// the computer for the rest of the game, so it carries on without them (unless nobody's
// left, when it's called off and the lobby is open again). Once it's over,
// everyone still there is back in the lobby, on the same teams, for another.
import fs from 'node:fs';
import vm from 'node:vm';

export const hz = 30; // each tick is STEPS of the game's (it runs at 60 a second)
const STEPS = 2;
const OVER = 8 * hz; // ticks the final score stays up before it's back to the lobby
const FILL = 5 * hz; // ticks a lobby with spots to spare waits, once everyone there is ready, before the computer fills them

let engine;
// { HOCKEY, yard } from js/hockey.js and js/maps.js, or null if they can't be loaded
export function load() {
  if (engine !== undefined) return engine;
  try {
    const ctx = vm.createContext({ window: {} });
    for (const f of ['maps.js', 'hockey.js']) vm.runInContext(fs.readFileSync(new URL('../../js/' + f, import.meta.url), 'utf8'), ctx, { filename: 'js/' + f });
    const { HOCKEY, OFFICE_MAPS } = ctx.window, yard = OFFICE_MAPS && OFFICE_MAPS.floors.find((f) => f.outdoor);
    engine = HOCKEY && yard ? { HOCKEY, yard } : null;
  } catch (e) {
    engine = null;
  }
  if (!engine) console.error('Live hockey is off: js/hockey.js and js/maps.js could not be loaded');
  return engine;
}

// Spots in the lobby, which are also the players' places in the game: even ones are team 0
// (on the left in the lobby, the yellow rings), odd ones team 1 (on the right, red). 0 and 1
// are the front row (players 1 and 2, who take the faceoffs); 2 and 3 are behind them.
const teamOf = (i) => i % 2;

function kind(size) {
  return {
    hz,
    // ph: 'lobby', 'play' or 'over'. slots: who's in each spot, { id, n (their name), r
    // (pressed start) }, or null. cd: ticks the lobby has been waiting to fill the empty spots
    // with the computer. In a game: g (js/hockey.js's game), ids (who started it, in their
    // places, null for the computer's), cpu (for each of the computer's, a number the browsers
    // pick a coworker to show with), hold (what each player is doing, from input), gn (counts
    // games), n (counts the game's ticks), fo (counts faceoffs), ev (what happened this tick)
    // and last (the final score, once it's over)
    create: ({ rng }) => ({ size, rng, slots: Array(size).fill(null), ph: 'lobby', t: 0, cd: 0, g: null, ids: [], cpu: [], hold: [], gn: 0, n: 0, fo: 0, ev: [], last: null }),
    sit, stand, away, input, tick, seated, view,
  };
}

const slotOf = (s, id) => s.slots.findIndex((q) => q && q.id === id);

// Into the lobby, on whichever team has fewer players (team 0 if it's even). Not while a
// game's on ('busy'), or if every spot is taken ('full').
export function sit(s, id, name) {
  if (slotOf(s, id) >= 0) return true;
  if (!load()) return 'off';
  if (s.ph !== 'lobby') return 'busy';
  const free = s.slots.map((q, i) => i).filter((i) => !s.slots[i]);
  if (!free.length) return 'full';
  const count = (team) => s.slots.filter((q, i) => q && teamOf(i) === team).length;
  const team = count(1) < count(0) ? 1 : 0;
  const i = free.find((j) => teamOf(j) === team) ?? free[0];
  s.slots[i] = { id, n: String(name).slice(0, 12), r: false };
  return true;
}

// Out of the lobby, or out of the game: the computer plays their skater from here on. If
// that was the last player, the game's off and the rink is free for whoever comes next.
export function stand(s, id) {
  const i = slotOf(s, id);
  if (i < 0) return;
  s.slots[i] = null;
  if (s.ph === 'play') {
    s.g.players[i].ai = true;
    s.hold[i] = still();
  }
  if (s.ph !== 'lobby' && !s.slots.some(Boolean)) toLobby(s);
}

function toLobby(s) { s.ph = 'lobby'; s.g = null; s.hold = []; }

// A dropped connection lets go of everything, rather than skating on into the boards.
export function away(s, id, gone) {
  const i = slotOf(s, id);
  if (gone && i >= 0 && s.ph === 'play') Object.assign(s.hold[i], { x: 0, y: 0, a: false, Q: [] });
}

// What each player is doing: x, y and a as below, and either (from a copy that sends a tick
// at a time) Q, the ticks still to come, oldest first ({ q, x, y, a, b }), got (the newest q
// in), aq (the newest the game has had) and deep (ticks the queue's been longer than it
// need be), or (from an older copy) ap, bp, taps and passes
const still = () => ({ x: 0, y: 0, a: false, ap: 0, bp: 0, taps: 0, passes: 0, Q: [], got: 0, aq: 0, deep: 0 });
const QMAX = 30; // ticks of input kept waiting, at most (half a second)

// In the lobby: { mv: 'left' | 'right' | 'up' | 'down' } moves them, { go: true } is pressing
// start and { go: false } taking it back (to wait for more players). In a game, what they did
// a tick at a time (a browser's own 60ths of a second, the game's speed): { q, i: [[x, y, a,
// b], ...] }, the ticks numbered on from q, each with which way they're steering (x and y,
// -1 to 1 each), whether A is held (a, 1 or 0) and whether B was pressed (b). The game takes
// one each tick, and tells them the last it's taken (aq, in view), so the browser can run
// ahead of it with the rest. (An older copy sends { x, y, a, ap, bp } whenever it changes: a
// whether A is held, and ap and bp counting presses of A and B, so a quick tap, down and up
// again before the next tick, still counts.)
export function input(s, id, d) {
  const i = slotOf(s, id);
  if (i < 0 || !d || typeof d !== 'object') return;
  if (s.ph === 'lobby') {
    if (['left', 'right', 'up', 'down'].includes(d.mv)) move(s, i, d.mv);
    else if (typeof d.go === 'boolean') s.slots[i].r = d.go;
    return;
  }
  if (s.ph !== 'play') return;
  const h = s.hold[i], num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  if (Array.isArray(d.i) && Number.isInteger(d.q)) {
    d.i.slice(0, QMAX).forEach((e, j) => {
      if (!Array.isArray(e) || d.q + j <= h.got) return; // (one it's had already)
      h.got = d.q + j;
      h.Q.push({ q: h.got, x: num(e[0]), y: num(e[1]), a: !!e[2], b: !!e[3] });
    });
    while (h.Q.length > QMAX) h.Q.unshift(merge(h.Q.shift(), h.Q.shift()));
    return;
  }
  h.x = num(d.x); h.y = num(d.y); h.a = !!d.a;
  if (Number.isInteger(d.ap) && d.ap !== h.ap) { h.ap = d.ap; h.taps = Math.min(2, h.taps + 1); }
  if (Number.isInteger(d.bp) && d.bp !== h.bp) { h.bp = d.bp; h.passes = Math.min(2, h.passes + 1); }
}

// Left and right go over to that team: into a free spot there (the same row if it can),
// otherwise swapping with whoever's level with them. Up and down (two on two) swap rows
// within their team. Anyone who's moved has to press start again.
function move(s, i, dir) {
  const team = teamOf(i), row = i >> 1, rows = s.size / 2;
  let j;
  if (dir === 'left' || dir === 'right') {
    const to = dir === 'left' ? 0 : 1;
    if (to === team) return;
    j = row * 2 + to;
    for (let k = 0; k < rows && s.slots[j]; k++) if (!s.slots[k * 2 + to]) j = k * 2 + to;
  } else {
    if (rows < 2 || (dir === 'up') === (row === 1)) return;
    j = (1 - row) * 2 + team;
  }
  [s.slots[i], s.slots[j]] = [s.slots[j], s.slots[i]];
  for (const q of [s.slots[i], s.slots[j]]) if (q) q.r = false;
}

// The puck drops, with the computer in any empty spots.
function start(s) {
  const { HOCKEY, yard } = load();
  s.g = HOCKEY.create(yard, {
    seed: Math.floor(s.rng() * 2 ** 31) || 1,
    players: s.slots.map((q, i) => (q ? { name: q.n, team: teamOf(i), hand: 1 } : { name: 'CPU', team: teamOf(i), ai: true, hand: 1 })),
  });
  s.ids = s.slots.map((q) => (q ? q.id : null));
  s.cpu = s.slots.map((q) => (q ? -1 : Math.floor(s.rng() * 1000)));
  s.hold = s.slots.map(still);
  s.ph = 'play'; s.gn++; s.n = 0; s.fo = 0; s.cd = 0; s.ev = []; s.last = null;
  for (const q of s.slots) if (q) q.r = false;
}

// Two ticks of input as one, for catching up: steering as the later, but nothing pressed lost
const merge = (e, f) => ({ q: f.q, x: f.x, y: f.y, a: e.a || f.a, b: e.b || f.b });

// One tick of the game: everyone's input in, and a goal or the buzzer followed by the next
// faceoff, or the end.
function step(s) {
  const g = s.g;
  const ins = g.players.map((p, i) => {
    if (p.ai) return null;
    const h = s.hold[i];
    if (h.Q.length) {
      // their next tick, or if they've got ahead (a bunch at once after a hiccup), two as one
      // to catch up: straight away if they're well ahead, or now and then if a little
      let e = h.Q.shift();
      h.deep = h.Q.length > 2 ? h.deep + 1 : 0;
      if (h.Q.length > 6 || h.deep > 60) { e = merge(e, h.Q.shift()); h.deep = 0; }
      Object.assign(h, { x: e.x, y: e.y, a: e.a, aq: e.q });
      return { x: e.x, y: e.y, shoot: e.a, pass: e.b };
    }
    // (none come yet: what they were doing goes on)
    let shoot = h.a, pass = false;
    // a press the game hasn't seen yet holds A down for at least a tick
    if (h.taps > 0 && !p.wasA) { shoot = true; h.taps--; }
    if (h.passes > 0) { pass = true; h.passes--; }
    return { x: h.x, y: h.y, shoot, pass };
  });
  g.step(ins);
  s.n++;
  for (const e of g.events) s.ev.push(event(e));
  if (g.due()) {
    if (g.over()) { s.ph = 'over'; s.t = 0; s.last = { sc: g.score.slice(), ot: g.ot }; }
    else { g.faceoff(); s.fo++; }
  }
}

// js/hockey.js's events name players by the player themselves; these go by their place
const event = (e) => {
  const o = { e: e.e };
  for (const k of ['p', 'q', 'to', 'from']) if (e[k]) o[k] = e[k].i;
  if (e.team !== undefined) o.team = e.team;
  if (e.power !== undefined) o.power = round(e.power);
  return o;
};
const round = (v) => Math.round(v * 1000) / 1000;

export function tick(s) {
  if (s.ph === 'lobby') {
    // everyone's ready: straight on with a full lobby, or with spots to spare (and at least
    // two players), after a few seconds for anyone else to turn up
    const here = s.slots.filter(Boolean);
    if (here.length >= 2 && here.every((q) => q.r)) { if (here.length === s.size || ++s.cd >= FILL) start(s); }
    else s.cd = 0;
  } else if (s.ph === 'over') {
    if (++s.t >= OVER) toLobby(s);
  } else {
    s.ev = [];
    for (let k = 0; k < STEPS && s.ph === 'play'; k++) step(s);
  }
  return [];
}

export function seated(s) { return s.slots.filter(Boolean).map((q) => q.id); }

// What id sees. In the lobby: ph, size, me (their spot), slots ({ id, n, r } or null), cd
// (seconds until the computer fills the empty spots, or 0 if it isn't about to) and last
// (the last game's final score, { sc, ot }, if there was one). In a game ('play', or 'over'
// once it's been won), they're also sent gn, n and fo (see create), who (each player: { id,
// n, ai (the computer's playing them), and for a spot the computer had from the start, id
// null and c, see cpu in create }), sc (the score), clk (ticks left), ot, gp and
// gt (js/hockey.js's phase and t), pk (the puck: x, y, vx, vy, and who has it, or -1), pl
// (each player: x, y, vx, vy, ang, pushing (1 or 0), how far down, which way they fall,
// and their stick: what it's doing, how far through, and the power of a shot), ev (what
// happened this tick, as js/hockey.js's events but with players by their place), and for
// a browser to run the game ahead on its own, st (the whole game, js/hockey.js's save()),
// hv (js/hockey.js's VERSION) and aq (the last tick of their input the game's taken).
export function view(s, id) {
  const me = slotOf(s, id), base = { ph: s.ph, size: s.size, me, last: s.last };
  if (s.ph === 'lobby') {
    return Object.assign(base, { slots: s.slots.map((q) => q && { id: q.id, n: q.n, r: q.r }), cd: s.cd ? Math.ceil((FILL - s.cd) / hz) : 0 });
  }
  const g = s.g;
  return Object.assign(base, {
    gn: s.gn, n: s.n, fo: s.fo,
    who: g.players.map((p, i) => (s.ids[i] ? { id: s.ids[i], n: p.name, ai: p.ai } : { id: null, n: p.name, ai: true, c: s.cpu[i] })),
    sc: g.score.slice(), clk: g.clock, ot: g.ot, gp: g.phase, gt: g.t,
    pk: [round(g.puck.x), round(g.puck.y), round(g.puck.vx), round(g.puck.vy), g.puck.owner ? g.puck.owner.i : -1],
    pl: g.players.map((p) => {
      const st = g.stick(p);
      return [round(p.x), round(p.y), round(p.vx), round(p.vy), round(p.ang), p.push ? 1 : 0, round(g.down(p)), p.fall, st.k, round(st.a), round(st.p || 0)];
    }),
    ev: s.ph === 'play' ? s.ev : [],
    st: mm(g.save()), hv: load().HOCKEY.VERSION, aq: s.hold[me] ? s.hold[me].aq : 0,
  });
}
// (to the millimetre, for sending)
const mm = (v) => (typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(mm) : v);

// The two tables: the same game, for two players or four.
export const one = kind(2), two = kind(4);
