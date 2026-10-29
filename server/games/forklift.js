// Forklift Rush, two players in the same warehouse (ForkliftGame in js/game.js draws it).
// The layout, the driving and the forks are the same as the game on your own: a 320x240
// screen stepping 60 times a second, so the server does two of those steps each tick.
// What's different with two:
//  - there's one truck and one call at a time, and whoever puts that pallet on the truck
//    first gets it. The call is for a kind there are at least two of when there can be,
//    so you can fight over the same pallet or go for another;
//  - the forklifts bump into each other, and empty forks driven into the pallet on the
//    other forklift's forks take it (then it can't be taken straight back for a moment);
//  - the clock is shared, so hitting Steve or bringing the wrong pallet stalls your
//    forklift for a while instead of costing time.
// Most pallets loaded when the time's up wins.
const SW = 320, SH = 240, TOP = 20, R = 6.5, WHEEL = 4;
const TIME = 5400; // steps: 90 seconds
const READY = 75;
const STEVE_STALL = 180, WRONG_STALL = 120; // steps
const GUARD = 60; // steps a pallet you've just taken can't be taken back
const STEPS = 2;
const KINDS = 4; // FAN, COIL, DAMPER, MOTOR (PALLETS in js/game.js)

const BAY_X = [24, 58, 92, 126, 160, 194];
export const BAYS = BAY_X.map((x) => ({ x, y: TOP + 22 })).concat(BAY_X.map((x) => ({ x, y: SH - 22 })));
const WALLS = [
  { x: -20, y: 0, w: 22, h: SH }, { x: 0, y: -20, w: SW, h: TOP + 20 }, { x: 0, y: SH - 2, w: SW, h: 20 },
  { x: 6, y: TOP, w: 206, h: 10 }, { x: 6, y: SH - 10, w: 206, h: 10 },
  { x: 60, y: 124, w: 12, h: 12 }, { x: 168, y: 124, w: 12, h: 12 },
  { x: 262, y: TOP, w: 6, h: 70 - TOP }, { x: 262, y: 176, w: 6, h: SH - 176 },
  { x: 268, y: 64, w: 60, h: 6 }, { x: 268, y: 176, w: 60, h: 6 }, { x: 314, y: 64, w: 10, h: 118 },
];
const TRUCK = { x1: 266, y1: 72, x2: 312, y2: 174 };
const STEVE_X = 238;
const START = [{ x: 118, y: 104 }, { x: 118, y: 156 }];

export const hz = 30;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tip = (L, d) => ({ x: L.x + Math.cos(L.a) * d, y: L.y + Math.sin(L.a) * d });

// push the circle at c (radius r) out of the boxes in `solid`; returns how far it moved
function pushOut(c, r, solid) {
  let mx = 0, my = 0;
  for (const o of solid) {
    const cx = Math.max(o.x, Math.min(c.x + mx, o.x + o.w)), cy = Math.max(o.y, Math.min(c.y + my, o.y + o.h));
    const dx = c.x + mx - cx, dy = c.y + my - cy, d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d < 0.001) { my -= r; continue; }
    mx += dx / d * (r - d); my += dy / d * (r - d);
  }
  return { x: mx, y: my };
}

function event(s, seat, k, extra) {
  s.ev.push(Object.assign({ id: ++s.evN, s: seat, k, at: s.n }, extra));
  if (s.ev.length > 40) s.ev.shift();
}

// how many of each kind are out there, on the racks or on the forks
function counts(s) {
  const n = Array(KINDS).fill(0);
  for (const p of s.pallets) n[p.k]++;
  for (const L of s.lifts) if (L.load >= 0) n[L.load]++;
  return n;
}

function newOrder(s) {
  const n = counts(s);
  const two = n.map((c, k) => (c >= 2 ? k : -1)).filter((k) => k >= 0);
  const any = n.map((c, k) => (c >= 1 ? k : -1)).filter((k) => k >= 0);
  const pool = two.length ? two : any.length ? any : [0];
  s.order = pool[Math.floor(s.rng() * pool.length)];
}

function restock(s) {
  const free = BAYS.map((b, i) => i).filter((i) => !s.pallets.some((p) => p.b === i)
    && s.lifts.every((L) => dist(L, BAYS[i]) > 24));
  if (!free.length) return;
  s.pallets.push({ b: free[Math.floor(s.rng() * free.length)], k: Math.floor(s.rng() * KINDS) });
}

export function create({ rng }) {
  const s = {
    rng, n: 0, ready: 0, left: TIME, order: 0, sc: [0, 0], ev: [], evN: 0,
    pallets: [],
    steve: { y: 60, to: 60, wait: 30, dir: 1, step: 0 },
    lifts: START.map((p) => ({
      x: p.x, y: p.y, a: 0, v: 0, load: -1, wheel: 0, wheelT: 0, armed: true,
      stall: 0, hurt: 0, bumpT: 0, guard: 0, held: { u: false, d: false, l: false, r: false }, presses: [],
    })),
  };
  // the same starting racks as on your own
  BAYS.forEach((b, i) => { if (i % 4 !== 3) s.pallets.push({ b: i, k: (i * 3 + (i >> 2)) % KINDS }); });
  newOrder(s);
  return s;
}

// d.h: the keys held (1 up, 2 down, 4 left, 8 right), d.e: presses since the last message
// ('l' and 'r' turn the wheels a notch, 'a' straightens them)
export function input(s, seat, d) {
  if (!d || typeof d !== 'object') return;
  const L = s.lifts[seat];
  if (typeof d.h === 'number') L.held = { u: !!(d.h & 1), d: !!(d.h & 2), l: !!(d.h & 4), r: !!(d.h & 8) };
  if (typeof d.e === 'string') for (const ch of d.e.slice(0, 8)) if ('lra'.includes(ch)) L.presses.push(ch);
}

function drive(s, i) {
  const L = s.lifts[i], O = s.lifts[1 - i];
  const presses = L.presses.splice(0);
  if (L.stall > 0) { L.stall--; L.v = 0; } else {
    // driving: it only turns while it's rolling, and backwards it steers the other way
    const max = L.load >= 0 ? 1.7 : 2.1;
    if (L.held.u) L.v = Math.min(max, L.v + 0.07);
    else if (L.held.d) L.v = Math.max(-1.3, L.v - 0.07);
    else L.v *= 0.92;
    if (Math.abs(L.v) < 0.02) L.v = 0;
    // the wheels: a notch a press, and a notch every 4 steps while held
    const notch = (dir) => { L.wheel = Math.max(-WHEEL, Math.min(WHEEL, L.wheel + dir)); };
    for (const p of presses) {
      if (p === 'a') L.wheel = 0;
      else { notch(p === 'r' ? 1 : -1); L.wheelT = 0; }
    }
    if (L.held.l || L.held.r) { if (!presses.some((p) => p !== 'a') && ++L.wheelT % 4 === 0) notch(L.held.r ? 1 : -1); } else L.wheelT = 0;
  }
  L.a += L.wheel / WHEEL * 0.05 * Math.max(-1, Math.min(1, L.v / 1.2));
  L.x += Math.cos(L.a) * L.v; L.y += Math.sin(L.a) * L.v;

  // bumping into things: walls, pallets on the racks, Steve, and the other forklift (its
  // body, and the pallet on its forks). Empty forks slide in under a pallet, theirs too.
  const steveBox = { x: STEVE_X - 5, y: s.steve.y - 6, w: 10, h: 12 };
  const oBody = { x: O.x - Math.cos(O.a) * 1.5 - 6, y: O.y - Math.sin(O.a) * 1.5 - 6, w: 12, h: 12 };
  const oHeld = tip(O, 11);
  const oLoad = O.load >= 0 ? [{ x: oHeld.x - 7, y: oHeld.y - 7, w: 14, h: 14 }] : [];
  const racked = s.pallets.map((p) => ({ x: BAYS[p.b].x - 8, y: BAYS[p.b].y - 8, w: 16, h: 16 }));
  const solid = WALLS.concat(racked, [steveBox, oBody], oLoad);
  const body = { x: L.x - Math.cos(L.a) * 1.5, y: L.y - Math.sin(L.a) * 1.5 };
  let push = pushOut(body, R, solid);
  const front = L.load >= 0 ? { c: tip(L, 10), r: 7, s: solid } : { c: tip(L, 7), r: 2, s: WALLS.concat([steveBox, oBody]) };
  const push2 = pushOut({ x: front.c.x + push.x, y: front.c.y + push.y }, front.r, front.s);
  push = { x: push.x + push2.x, y: push.y + push2.y };
  if (push.x || push.y) {
    const near = (c, r) => { const p = pushOut(c, r, [steveBox]); return p.x || p.y; };
    if ((near(body, R + 1) || near(front.c, front.r + 1)) && L.hurt <= 0 && Math.abs(L.v) > 0.5) {
      L.stall = STEVE_STALL; L.hurt = 90;
      event(s, i, 'steve');
    } else if (Math.abs(L.v) > 0.8 && L.bumpT <= 0) { event(s, i, 'bump'); L.bumpT = 12; }
    L.x += push.x; L.y += push.y;
    L.v = 0;
  }
  if (L.hurt > 0) L.hurt--;
  if (L.bumpT > 0) L.bumpT--;
  if (L.guard > 0) L.guard--;

  // the forks load and unload themselves when you're in the right place
  const t8 = tip(L, 8), held1 = tip(L, 11);
  const inTruck = held1.x > TRUCK.x1 && held1.x < TRUCK.x2 && held1.y > TRUCK.y1 && held1.y < TRUCK.y2;
  const under = s.pallets.find((p) => dist(BAYS[p.b], t8) < 9);
  const fy = Math.sin(L.a);
  const bay = BAYS.findIndex((b, bi) => dist(b, held1) < 7 && (b.y < SH / 2 ? fy < -0.7 : fy > 0.7)
    && !s.pallets.some((p) => p.b === bi));
  // their pallet, if your empty forks are in under it
  const steal = O.load >= 0 && O.guard <= 0 && dist(oHeld, t8) < 9;
  if (!L.armed) {
    L.armed = !inTruck && !s.pallets.some((p) => dist(BAYS[p.b], t8) < 16)
      && !BAYS.some((b) => dist(b, held1) < 12) && !(O.load >= 0 && dist(oHeld, t8) < 16);
  } else if (L.load < 0 && under) {
    L.load = under.k; s.pallets = s.pallets.filter((p) => p !== under); L.armed = false;
    event(s, i, 'lift');
  } else if (L.load < 0 && steal) {
    L.load = O.load; O.load = -1; L.guard = GUARD; L.armed = false; O.armed = false;
    event(s, i, 'steal', { p: L.load });
  } else if (L.load >= 0 && inTruck) {
    L.armed = false;
    if (L.load === s.order) {
      s.sc[i]++; L.load = -1;
      event(s, i, 'cup', { p: s.order });
      restock(s); newOrder(s);
    } else {
      L.stall = WRONG_STALL;
      event(s, i, 'wrong', { p: s.order });
    }
  } else if (L.load >= 0 && bay >= 0) {
    s.pallets.push({ b: bay, k: L.load }); L.load = -1; L.armed = false;
    event(s, i, 'putt');
  }
}

// Steve wanders up and down the crosswalk, stopping now and then, and waits for a
// forklift rather than walking into it
function walkSteve(s) {
  const st = s.steve;
  if (st.wait > 0) { st.wait--; return; }
  if (Math.abs(st.y - st.to) < 1) {
    st.to = TOP + 14 + s.rng() * (SH - TOP - 28);
    st.wait = 20 + Math.floor(s.rng() * 70);
    return;
  }
  st.dir = st.to > st.y ? 1 : 0;
  const ny = st.y + Math.sign(st.to - st.y) * Math.min(0.6, Math.abs(st.to - st.y));
  const clear = s.lifts.every((L) => Math.hypot(L.x - STEVE_X, L.y - ny) > 14 && Math.hypot(tip(L, 8).x - STEVE_X, tip(L, 8).y - ny) > 10);
  if (clear) st.y = ny;
  if (s.n % 12 === 0) st.step ^= 1;
}

function step(s) {
  s.n++;
  if (s.ready < READY) { s.ready++; return; }
  if (--s.left <= 0) {
    s.left = 0;
    return { w: s.sc[0] > s.sc[1] ? 0 : s.sc[1] > s.sc[0] ? 1 : -1, sc: s.sc };
  }
  // take turns going first, so neither forklift always wins a tie
  for (const i of s.n & 1 ? [1, 0] : [0, 1]) drive(s, i);
  walkSteve(s);
}

export function tick(s) {
  for (let i = 0; i < STEPS; i++) {
    const result = step(s);
    if (result) return result;
  }
}

const r1 = (n) => Math.round(n * 10) / 10;

// s: your seat, ph: 0 getting ready (t counts up to 75) or 1 playing, left: steps to go,
// order: the kind the truck wants, l: each forklift [x, y, angle, speed, load, wheel,
// stalled], p: the pallets on the racks [bay, kind, bay, kind, ...], st: Steve [y, facing
// down, step], sc: pallets loaded by each seat, ev: the last second's events
export function view(s, seat) {
  return {
    s: seat, ph: s.ready < READY ? 0 : 1, t: s.ready, left: s.left, order: s.order,
    l: s.lifts.map((L) => [r1(L.x), r1(L.y), Math.round(L.a * 1000) / 1000, Math.round(L.v * 100) / 100, L.load, L.wheel, L.stall > 0 ? 1 : 0]),
    p: s.pallets.flatMap((p) => [p.b, p.k]),
    st: [r1(s.steve.y), s.steve.dir, s.steve.wait > 0 ? 0 : 1 + s.steve.step],
    sc: s.sc,
    ev: s.ev.filter((e) => s.n - e.at < 60).map((e) => [e.id, e.s, e.k, e.p === undefined ? -1 : e.p]),
  };
}
