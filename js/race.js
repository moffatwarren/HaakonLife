// Haakon Grand Prix, the racing game on the lunch room's arcade cabinet: four cars, three laps,
// on one of five tracks, against coworkers or other players. This is the tracks, the cars and
// how they drive, the bumps, the laps and how the computer drives; nothing in here draws or
// reads keys (js/game.js's RaceGame and LiveRace do that, and js/track.js paints the tracks and
// the cars), so the game server runs it as it is for a live race (server/tables/race.js).
//
//   const g = RACE.create(track, { players: [{ name, car, ai, pace }], seed })
//   g.step(inputs)   // one tick (a 60th of a second). inputs[i] is what car i's driver is doing,
//                    // if they aren't ai: { s, a, b }, steering (-1 all the way left to 1 all
//                    // the way right), the gas (A held) and the brake (B held)
//   g.over()         // whether everyone still racing has finished, or it's been LATE since
//                    // the first car home
//   g.places()       // the cars in the order they're placed: finished first, then the furthest on
//   g.retire(i)      // car i is out of the race (their driver left): it's gone from the track
//   g.save()         // everything the race is, as plain arrays and numbers (for JSON), and
//   g.load(saved)    // back again into a race with the same players: a live race's server
//                    // sends it, so a browser can carry on from there a little ahead
//   g.cars, g.phase ('count', then 'race'), g.t (ticks into the countdown), g.clock (ticks since
//   the lights went green), g.events (what happened this tick, for the sounds)
//
// Each car: x, y, vx, vy (tiles and tiles a second, from the map's top-left corner), ang (which
// way it's pointing: 0 toward the bottom of the map and π/2 toward the right, as in hockey),
// steer (how far the wheels are turned), drift (0, or 1 or -1 sliding round to the right or the
// left), dk (ticks into the drift), hold (ticks of turning hard enough to drift: see HOLD), boost (ticks of boost left), surf (0 the road, 1 a kerb, 2 the
// grass), dist (how far along the race it's got, from the start line: negative on the grid), laps
// (each lap's time, in ticks), fin (the clock when it finished, or -1), back (ticks it's been
// going the wrong way) and out (retired).
//
// Driving: A is the gas and B the brake (and reverse, from a standstill). Keep the gas down and
// turn as hard as you can at speed for a moment (HOLD), and the back swings out: a drift. It
// keeps going while you keep turning that way, getting round a little harder than the tyres could
// on grip (DRIFT_GRIP: they still have to do it), and ends a moment after you stop (sooner if you
// steer the other way), or if you slow right down or run onto the grass. Hold one long enough and
// you get a burst of speed out of the end of it, more the longer it was. To take a bend on grip,
// turn less hard, or ease off the gas. Go into a tight one too fast either way and you slide wide.
//
//   RACE.CARS        // the five vehicles: { key, name, top, acc, grip, turn, mass, len, wid }
//   RACE.TRACKS      // the five tracks: { key, name, theme, w, h, pts, grip }
//   RACE.track(i)    // track i, worked out: the road's middle every STEP along it, its width,
//                    // the kerbs, the computer's line, and where(x, y) for any spot near it
//   RACE.LAPS, RACE.COUNT (ticks of countdown), RACE.HW (half the road's width), RACE.CURB,
//   RACE.WALL (how far from the middle of the road the barriers are), RACE.LATE
//   RACE.VERSION     // a fingerprint of this file: a browser only runs a live race ahead of the
//                    // server when the server has the very same copy
window.RACE = (function engine() {
  const DT = 1 / 60;
  const LAPS = 3;
  const COUNT = 180; // the countdown: 3, 2, 1, a second each, then green
  const LATE = 25 * 60; // ticks the race goes on after the first car home before it's called
  const HW = 2.4, CURB = 0.45, WALL = 4.7; // half the road, the kerbs past its edge, and the barriers
  const STEP = 0.5; // how far apart the road's middle is worked out
  const CELL = 4; // squares to a tile in each track's grid of what's nearest
  const BRAKE = 17, HANDBRAKE = 6, COAST = 2.2, REV = 3.2, REV_ACC = 6; // m/s² and m/s, in tiles
  const BOOST = 1.18; // how much faster than top speed a boost goes
  const SLIP = 0.6, SWING = 4; // in a drift: how far round the car can point from where it's going (radians), and how fast where it's going follows
  const HARD = 0.85, HOLD = 14; // a drift starts after HOLD ticks turning at least this hard, at speed with the gas down
  const DRIFT_GRIP = 1.2; // how much harder a drift can corner than the tyres can on grip

  // The vehicles, each driving its own way: top speed (tiles a second), acceleration, grip (how
  // hard it can corner before it slides, tiles a second²), how fast it turns (radians a second),
  // its weight (who comes off worse in a bump), and its size (tiles). Saved choices and live races
  // go by their place in this list, so only ever add to the end of it (the same for TRACKS).
  const CARS = [
    { key: 'van', name: 'SERVICE VAN', top: 11, acc: 7.8, grip: 14.4, turn: 2.75, mass: 1.25, len: 0.98, wid: 0.56,
      about: 'Haakon\'s own. Good at everything' },
    { key: 'pickup', name: 'PICKUP TRUCK', top: 11.05, acc: 11, grip: 13.9, turn: 2.7, mass: 1.7, len: 1, wid: 0.56,
      about: 'Quickest off the line, and heavy' },
    { key: 'sports', name: 'SPORTS CAR', top: 11.6, acc: 7.2, grip: 13.6, turn: 2.95, mass: 1, len: 0.94, wid: 0.52,
      about: 'Fast, and loose at the back' },
    { key: 'hatch', name: 'HATCHBACK', top: 10.95, acc: 9.8, grip: 14.2, turn: 3.25, mass: 0.8, len: 0.74, wid: 0.54,
      about: 'Small, and it turns on a dime' },
    { key: 'truck', name: 'FLATBED TRUCK', top: 11.7, acc: 6.2, grip: 13.5, turn: 2.6, mass: 2.6, len: 1.3, wid: 0.62,
      about: 'Slow to get going, fastest flat out' },
  ];

  // The tracks, in tiles. The middle of the road goes smoothly through `pts`, in the order you
  // drive them, or along `path`: a start ['S', x, y], then straights to a point ['L', x, y] and
  // bends round a centre ['A', x, y, radius, from, to] (angles in degrees, 0 to the right of the
  // centre and 90 below it, as on the screen), ending back at the start. Either way the start line
  // is at the first point, on a straight going right (the gantry over it is drawn that way). w and
  // h: how big the map is. grip: how much the road holds, a share of a dry one. Keep every bend
  // at least WALL tiles round, and every part of the road at least 2 WALLs from any other part
  // (server/test/race.test.js checks both), so there's always a barrier between them and no
  // way across, and the road WALL and a bit from the edge of the map.
  const TRACKS = [
    { key: 'lake', name: 'LAKESHORE', theme: 'lake', w: 88, h: 64, grip: 1, about: 'Fast and flowing, round the lake',
      path: [['S', 36, 56], ['L', 54, 56], ['A', 54, 44, 12, 90, 45], ['L', 64.607, 50.364],
        ['A', 57.536, 43.293, 10, 45, 0], ['L', 67.536, 41], ['A', 75.036, 41, 7.5, 180, 225],
        ['L', 70.439, 34.99], ['A', 65.136, 29.686, 7.5, 45, -45], ['L', 69.732, 23.676],
        ['A', 75.036, 18.373, 7.5, 135, 180], ['L', 67.536, 16.373], ['A', 60.536, 16.373, 7, 0, -90],
        ['L', 47.492, 9.373], ['A', 47.492, 15.873, 6.5, -90, -160], ['A', 35.746, 11.597, 6, 20, 160],
        ['A', 24, 15.873, 6.5, -20, -90], ['L', 21, 9.373], ['A', 21, 16.373, 7, -90, -180], ['L', 14, 20.373],
        ['A', 6.5, 20.373, 7.5, 0, 45], ['L', 11.096, 26.383], ['A', 16.399, 31.686, 7.5, -135, -225],
        ['L', 11.803, 37.697], ['A', 6.5, 43, 7.5, -45, 0], ['L', 14, 46], ['A', 24, 46, 10, 180, 90],
        ['L', 36, 56]] },
    { key: 'maple', name: 'MAPLE HOLLOW', theme: 'maple', w: 88, h: 64, grip: 1, about: 'Twisting through the trees',
      path: [['S', 29, 55], ['L', 56, 55], ['A', 56, 47, 8, 90, 0], ['L', 64, 41], ['A', 71, 41, 7, 180, 270], ['A', 71, 27, 7, 90, 0],
        ['L', 78, 18], ['A', 68, 18, 10, 0, -90], ['L', 58, 8], ['A', 58, 15, 7, -90, -180], ['L', 51, 19], ['A', 44, 19, 7, 0, 90],
        ['L', 40, 26], ['A', 40, 19, 7, 90, 180], ['L', 33, 15], ['A', 26, 15, 7, 0, -90], ['L', 17, 8], ['A', 17, 16, 8, -90, -180],
        ['L', 9, 22], ['A', 16, 22, 7, 180, 90], ['A', 16, 36, 7, -90, 90], ['A', 16, 49, 6, -90, -270], ['L', 29, 55]] },
    { key: 'snow', name: 'SNOWBELT', theme: 'snow', w: 88, h: 64, grip: 0.84, about: 'Slippery switchbacks: drift them',
      path: [['S', 28, 56], ['L', 44, 56], ['A', 44, 44, 12, 90, 78], ['A', 48.99, 67.476, 12, -102, -90],
        ['L', 65.949, 55.476], ['A', 65.949, 48.976, 6.5, 90, -90], ['L', 55.949, 42.476],
        ['A', 55.949, 33.476, 9, 90, 110], ['A', 49.793, 50.39, 9, -70, -90], ['L', 35.793, 41.39],
        ['A', 35.793, 34.89, 6.5, 90, 270], ['L', 45.793, 28.39], ['A', 45.793, 19.39, 9, 90, 65],
        ['A', 53.4, 35.704, 9, -115, -90], ['L', 66.4, 26.704], ['A', 66.4, 20.204, 6.5, 90, 0],
        ['L', 72.9, 18.204], ['A', 66.4, 18.204, 6.5, 0, -90], ['L', 17, 11.704], ['A', 17, 18.704, 7, -90, -180],
        ['L', 10, 27.786], ['A', 1, 27.786, 9, 0, 25], ['A', 17.314, 35.393, 9, -155, -205],
        ['A', 1, 43, 9, -25, 0], ['L', 10, 49], ['A', 17, 49, 7, 180, 90], ['L', 28, 56]] },
    { key: 'prairie', name: 'CANOLA FLATS', theme: 'prairie', w: 88, h: 64, grip: 1, about: 'Flat out across the fields',
      path: [['S', 32, 56], ['L', 48.34, 56], ['A', 48.34, 46, 10, 90, 0], ['L', 58.34, 44],
        ['A', 68.34, 44, 10, 180, 205], ['A', 50.214, 35.548, 10, 25, -25], ['A', 68.34, 27.095, 10, 155, 180],
        ['L', 58.34, 17.894], ['A', 49.34, 17.894, 9, 0, -90], ['L', 39.34, 8.894],
        ['A', 39.34, 18.894, 10, -90, -110], ['A', 32.5, 0.1, 10, 70, 90], ['L', 20.5, 10.1],
        ['A', 20.5, 19.1, 9, -90, -180], ['A', 18, 19.1, 6.5, 180, 90], ['L', 32, 25.6],
        ['A', 32, 31.8, 6.2, -90, 90], ['L', 20, 38], ['A', 20, 45, 7, -90, -180], ['L', 13, 47],
        ['A', 22, 47, 9, 180, 90], ['L', 32, 56]] },
    { key: 'plant', name: 'KINGSTON PLANT', theme: 'plant', w: 88, h: 64, grip: 1, about: 'Square corners round the yard',
      path: [['S', 30, 56], ['L', 60, 56], ['A', 60, 50, 6, 90, 0], ['L', 66, 46], ['A', 59.5, 46, 6.5, 0, -90],
        ['L', 56.5, 39.5], ['A', 56.5, 33, 6.5, 90, 180], ['L', 50, 30], ['A', 56.5, 30, 6.5, 180, 270],
        ['L', 59.5, 23.5], ['A', 59.5, 17, 6.5, 90, 0], ['L', 66, 15], ['A', 60, 15, 6, 0, -90], ['L', 44, 9],
        ['A', 44, 15, 6, -90, -180], ['L', 38, 30], ['A', 32, 30, 6, 0, 180], ['L', 26, 15],
        ['A', 20, 15, 6, 0, -90], ['L', 16, 9], ['A', 16, 15, 6, -90, -180], ['L', 10, 50],
        ['A', 16, 50, 6, 180, 90], ['L', 30, 56]] },
  ];
  // the points along a path's straights and bends, about every 3 tiles
  function pathPoints(path) {
    const pts = [];
    let x = path[0][1], y = path[0][2];
    const add = (px, py) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(px - l[0], py - l[1]) > 2.5) pts.push([px, py]); };
    add(x, y);
    for (const s of path.slice(1)) {
      if (s[0] === 'L') {
        const n = Math.max(1, Math.round(Math.hypot(s[1] - x, s[2] - y) / 3));
        for (let i = 1; i <= n; i++) add(x + (s[1] - x) * i / n, y + (s[2] - y) * i / n);
        x = s[1]; y = s[2];
      } else {
        const [, cx, cy, rad, a0, a1] = s, n = Math.max(2, Math.round(Math.abs(a1 - a0) * Math.PI / 180 * rad / 3));
        for (let i = 1; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; add(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); }
        x = cx + rad * Math.cos(a1 * Math.PI / 180); y = cy + rad * Math.sin(a1 * Math.PI / 180);
      }
    }
    const f = pts[0], l = pts[pts.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 2.6) pts.pop(); // (back at the start)
    return pts;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  // seeded random numbers, carrying on from o.s (which a saved race keeps)
  function rng(o) {
    return () => {
      const s = o.s = (o.s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- the tracks, worked out ----------
  // The road's middle, through the track's points (a centripetal Catmull-Rom curve, which never
  // loops round on itself between them), at even steps of about STEP all the way round. Each
  // step has where it is (x, y), the way the road goes (tx, ty) and its left (nx, ny: the
  // driver's left, going the right way), how far round it is (s), how sharply it bends (k:
  // radians a tile, more than 0 bending left), and how sharply it bends just ahead (sharp), whether
  // there are kerbs (curb) and where across the road the computer likes to be (line). A grid of
  // squares CELL to a tile, for as far as WALL and a bit from the road, says which step is
  // nearest each (near, or -1) and how far off it is (dist), so where() can say where anything
  // is without looking along the whole road.
  const built = [];
  function trackOf(i) {
    if (built[i]) return built[i];
    const T = TRACKS[i], P = T.pts || pathPoints(T.path), m = P.length, fine = [];
    for (let j = 0; j < m; j++) {
      const p0 = P[(j - 1 + m) % m], p1 = P[j], p2 = P[(j + 1) % m], p3 = P[(j + 2) % m];
      const k = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-3;
      const t1 = k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3);
      const lerp = (a, b, ta, tb, t) => [a[0] + (b[0] - a[0]) * (t - ta) / (tb - ta), a[1] + (b[1] - a[1]) * (t - ta) / (tb - ta)];
      for (let n = 0; n < 32; n++) {
        const t = t1 + (t2 - t1) * n / 32;
        const a1 = lerp(p0, p1, 0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
        const b1 = lerp(a1, a2, 0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
        fine.push(lerp(b1, b2, t1, t2, t));
      }
    }
    // evenly spaced, all the way round
    const at = [0];
    for (let j = 1; j <= fine.length; j++) at.push(at[j - 1] + Math.hypot(fine[j % fine.length][0] - fine[j - 1][0], fine[j % fine.length][1] - fine[j - 1][1]));
    const len = at[fine.length], n = Math.round(len / STEP), step = len / n;
    const x = new Float64Array(n), y = new Float64Array(n);
    for (let j = 0, f = 0; j < n; j++) {
      const s = j * step;
      while (at[f + 1] < s) f++;
      const u = (s - at[f]) / (at[f + 1] - at[f] || 1), a = fine[f], b = fine[(f + 1) % fine.length];
      x[j] = a[0] + (b[0] - a[0]) * u; y[j] = a[1] + (b[1] - a[1]) * u;
    }
    const tr = { i, key: T.key, name: T.name, theme: T.theme, w: T.w, h: T.h, grip: T.grip, n, step, len, x, y,
      tx: new Float64Array(n), ty: new Float64Array(n), nx: new Float64Array(n), ny: new Float64Array(n), s: new Float64Array(n),
      k: new Float64Array(n), sharp: new Float64Array(n), curb: new Uint8Array(n), line: new Float64Array(n) };
    const nxt = (j, d) => (j + d + n * 4) % n;
    for (let j = 0; j < n; j++) {
      const dx = x[nxt(j, 1)] - x[nxt(j, -1)], dy = y[nxt(j, 1)] - y[nxt(j, -1)], d = Math.hypot(dx, dy) || 1;
      tr.tx[j] = dx / d; tr.ty[j] = dy / d; tr.nx[j] = dy / d; tr.ny[j] = -dx / d; tr.s[j] = j * step;
    }
    const heading = (j) => Math.atan2(tr.tx[j], tr.ty[j]);
    for (let j = 0; j < n; j++) tr.k[j] = wrap(heading(nxt(j, 2)) - heading(nxt(j, -2))) / (4 * step);
    // (smoothed over a couple of tiles either way, which is what a driver feels)
    const smooth = (j, a, b) => { let t = 0; for (let d = a; d <= b; d++) t += tr.k[nxt(j, d)]; return t / (b - a + 1); };
    for (let j = 0; j < n; j++) {
      let most = 0;
      for (let d = -2; d <= 8; d++) most = Math.max(most, Math.abs(smooth(nxt(j, d), -3, 3)));
      tr.sharp[j] = most;
      tr.curb[j] = Math.abs(smooth(j, -4, 4)) > 1 / 13 ? 1 : 0;
      tr.line[j] = clamp(smooth(j, -2, 12) * 22, -(HW - 0.9), HW - 0.9); // (to the inside of a bend, a little before it)
    }
    // the grid: the nearest step, and how far, for every square near the road
    const cols = T.w * CELL, rows = T.h * CELL, near = new Int32Array(cols * rows).fill(-1), dist = new Float32Array(cols * rows).fill(1e9);
    const R = WALL + 5.5; // (well past the barriers: js/track.js paints the shore of the lake from it too)
    for (let j = 0; j < n; j++) {
      const ax = x[j], ay = y[j], bx = x[nxt(j, 1)], by = y[nxt(j, 1)], ex = bx - ax, ey = by - ay, ee = ex * ex + ey * ey || 1;
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - R) * CELL)), c1 = Math.min(cols - 1, Math.ceil((Math.max(ax, bx) + R) * CELL));
      const r0 = Math.max(0, Math.floor((Math.min(ay, by) - R) * CELL)), r1 = Math.min(rows - 1, Math.ceil((Math.max(ay, by) + R) * CELL));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
        const px = (cc + 0.5) / CELL, py = (rr + 0.5) / CELL, u = clamp(((px - ax) * ex + (py - ay) * ey) / ee, 0, 1);
        const d = Math.hypot(px - ax - ex * u, py - ay - ey * u), q = rr * cols + cc;
        if (d < dist[q] && d < R) { dist[q] = d; near[q] = j; }
      }
    }
    Object.assign(tr, { cols, rows, cell: CELL, near, dist });
    // Where (x, y) is, by the road: { j (the step it's alongside), d (how far left of the middle
    // of the road, negative for right), s (how far round), far (nowhere near the road) }. From
    // the grid's nearest step, then the steps either side of it, exactly.
    tr.where = function (px, py) {
      const cc = Math.floor(px * CELL), rr = Math.floor(py * CELL);
      let j0 = cc >= 0 && rr >= 0 && cc < cols && rr < rows ? near[rr * cols + cc] : -1, span = 3;
      if (j0 < 0) { j0 = 0; span = n >> 1; } // (way off: look all the way round)
      let best = null;
      for (let d = -span; d <= span; d++) {
        const j = nxt(j0, d), ax = x[j], ay = y[j], ex = x[nxt(j, 1)] - ax, ey = y[nxt(j, 1)] - ay, ee = ex * ex + ey * ey || 1;
        const u = clamp(((px - ax) * ex + (py - ay) * ey) / ee, 0, 1), qx = ax + ex * u, qy = ay + ey * u, dd = Math.hypot(px - qx, py - qy);
        if (!best || dd < best.dd) best = { j, u, dd, qx, qy };
      }
      const { j, u } = best, side = (px - best.qx) * tr.nx[j] + (py - best.qy) * tr.ny[j];
      return { j, d: side >= 0 ? best.dd : -best.dd, s: (j + u) * step, far: span > 3 };
    };
    // where on the road something a way round (s) and a way across (d) is, and which way it goes
    tr.at = function (s, d) {
      s = ((s % len) + len) % len;
      const j = Math.floor(s / step) % n, u = s / step - Math.floor(s / step), k = nxt(j, 1);
      const cx = x[j] + (x[k] - x[j]) * u, cy = y[j] + (y[k] - y[j]) * u;
      return { x: cx + tr.nx[j] * d, y: cy + tr.ny[j] * d, ang: Math.atan2(tr.tx[j], tr.ty[j]) };
    };
    built[i] = tr;
    return tr;
  }

  function create(ti, opts) {
    const T = trackOf(ti), seed = { s: (opts.seed || 1) >>> 0 || 1 }, r = rng(seed);
    const g = { track: T, ti, cars: [], phase: 'count', t: 0, clock: 0, first: -1, home: 0, events: [] };
    const ev = (e, o) => g.events.push(Object.assign({ e }, o));
    const fwd = (c) => [Math.sin(c.ang), Math.cos(c.ang)];
    const left = (c) => [Math.cos(c.ang), -Math.sin(c.ang)];

    // On the grid, two by two behind the line, the first on the left of the road.
    g.cars = opts.players.map((o, i) => {
      const spec = CARS[o.car] || CARS[0], back = 2.2 + i * 1.7, p = T.at(-back, i % 2 ? -1 : 1);
      return {
        i, name: o.name, car: CARS[o.car] ? o.car : 0, spec, ai: !!o.ai, pace: o.ai ? clamp(num(o.pace) || 1, 0.8, 1.1) : 1,
        x: p.x, y: p.y, vx: 0, vy: 0, ang: p.ang, spin: 0, steer: 0, drift: 0, dk: 0, off: 0, boost: 0, surf: 0,
        j: T.where(p.x, p.y).j, s: 0, d: 0, dist: -back, laps: [], lapAt: 0, fin: -1, place: 0, back: 0, out: false,
        in: { s: 0, a: false, b: false }, hold: 0, rub: 0,
        mem: { lane: (r() * 2 - 1) * 0.6, laneT: 60 + Math.floor(r() * 120), stuck: 0, rev: 0, revS: 0, dr: 0, drS: 0 },
      };
    });
    for (const c of g.cars) { const w = T.where(c.x, c.y); c.s = w.s; c.d = w.d; }

    // ---------- driving ----------
    function endDrift(c, boost) {
      if (boost && c.dk >= 40) { c.boost = Math.min(80, 24 + Math.floor((c.dk - 40) * 0.5)); ev('boost', { c }); }
      c.drift = 0; c.dk = 0; c.off = 0;
    }
    function drive(c, inp) {
      const sp = c.spec, s = clamp(num(inp.s), -1, 1), gas = !!inp.a, brk = !!inp.b;
      c.in = { s, a: gas, b: brk };
      if (g.phase !== 'race') return; // (held on the grid until the lights go green)
      // the wheels turn over a few ticks, not all at once
      c.steer += clamp(s - c.steer, -0.16, 0.16);
      let [fx, fy] = fwd(c);
      const v0 = c.vx * fx + c.vy * fy, speed = Math.abs(v0);
      // a drift: turning as hard as you can at speed with the gas down, for HOLD ticks the same way
      // (hold counts them, going up turning right and down turning left), and it lasts as long as
      // you keep turning that way
      if (!c.drift) {
        const hard = gas && Math.abs(s) >= HARD && v0 > sp.top * 0.5 && c.surf !== 2;
        c.hold = hard ? (Math.sign(c.hold) === Math.sign(s) ? c.hold : 0) + Math.sign(s) : 0;
        if (Math.abs(c.hold) >= HOLD) {
          c.drift = Math.sign(c.hold); c.dk = 0; c.off = 0; c.hold = 0;
          c.spin += c.drift * 1.2;
          ev('drift', { c });
        }
      }
      if (c.drift) {
        c.dk++;
        c.off = s * c.drift > 0.3 ? 0 : c.off + (s * c.drift < -0.3 ? 3 : 1); // (steering the other way ends it sooner)
        if (c.off > 15 || v0 < sp.top * 0.3 || c.surf === 2) endDrift(c, c.surf !== 2);
      }
      // Turning: only on the move, a little less at speed, and quicker in a drift (where the back
      // keeps coming round even with the wheels straight). Steering right turns the angle down.
      const roll = Math.min(1, speed / 2.2) * (1 - 0.3 * Math.min(1, speed / sp.top));
      let yaw = c.steer * sp.turn * roll * (v0 < 0 ? -1 : 1);
      if (c.drift) yaw = c.steer * sp.turn * roll * 1.35 + c.drift * sp.turn * roll * 0.35 * clamp(s * c.drift, 0, 1);
      c.ang = wrap(c.ang - (yaw + c.spin) * DT);
      c.spin *= 0.86;
      if (Math.abs(c.spin) < 0.01) c.spin = 0;
      // In a drift the back's out: the car points further round the bend than it's going, by up to
      // SLIP, and where it's going swings round after it, a little slower the further out it is.
      // So it turns tighter than it could on grip, and never spins right round.
      if (c.drift) {
        const v = Math.hypot(c.vx, c.vy), va = Math.atan2(c.vx, c.vy);
        let slip = wrap(va - c.ang);
        if (Math.abs(slip) > SLIP) { slip = Math.sign(slip) * SLIP; c.ang = wrap(va - slip); }
        const most = sp.grip * T.grip * DRIFT_GRIP * DT / Math.max(1, v); // (how far round it can go this tick: the tyres still have to do it)
        const to = va - clamp(slip * Math.min(1, SWING * DT), -most, most), keep = v * (1 - 0.35 * Math.abs(slip) * DT);
        c.vx = Math.sin(to) * keep; c.vy = Math.cos(to) * keep;
      }
      // what the car's doing, the way it's now pointing: forward, and sliding to its left
      [fx, fy] = fwd(c);
      const [lx, ly] = left(c);
      let vf = c.vx * fx + c.vy * fy, vl = c.vx * lx + c.vy * ly;
      const grass = c.surf === 2, boosting = c.boost > 0;
      if (boosting) c.boost--;
      let top = sp.top * c.pace * (boosting ? BOOST : 1), acc = sp.acc * c.pace * (boosting ? 1.7 : 1);
      if (grass) top *= 0.55;
      // the gas, the brakes (or reverse, from a standstill), and coasting
      if (gas) vf += (vf < 0 ? BRAKE : acc * Math.max(0, 1 - Math.max(0, vf) / top) * (c.drift ? 0.9 : 1)) * DT;
      if (brk) {
        if (vf > 0.4) vf = Math.max(0, vf - (c.drift ? HANDBRAKE : BRAKE) * DT);
        else if (!gas) vf = Math.max(-REV, vf - REV_ACC * DT);
      }
      if (!gas && !brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), COAST * DT);
      if (vf > top) vf = Math.max(top, vf - (vf - top) * (grass ? 3 : 1.5) * DT - 0.5 * DT); // (on the grass, or out of a boost)
      // the tyres take out the sliding sideways, as much as they can hold (a drift's slide is
      // above), and some of it goes into keeping the car going
      if (!c.drift) {
        const hold = sp.grip * T.grip * (grass ? 0.7 : 1), take = Math.min(Math.abs(vl) * (1 - Math.exp(-11 * DT)), hold * DT);
        vl -= Math.sign(vl) * take;
        if (gas && vf > 0) vf += take * 0.2;
      }
      c.vx = fx * vf + lx * vl; c.vy = fy * vf + ly * vl;
      c.x += c.vx * DT; c.y += c.vy * DT;
    }

    // ---------- bumping into things ----------
    // Each car is two circles, one at the front and one at the back, for the barriers and each
    // other. A bump pushes them apart and bounces them off, and catching one off centre spins it.
    const ends = (c) => {
      const [fx, fy] = fwd(c), h = c.spec.len * 0.27, rad = c.spec.wid * 0.5 + 0.03;
      return [{ x: c.x + fx * h, y: c.y + fy * h, rx: fx * h, ry: fy * h, rad }, { x: c.x - fx * h, y: c.y - fy * h, rx: -fx * h, ry: -fy * h, rad }];
    };
    const inertia = (c) => c.spec.mass * (c.spec.len * c.spec.len + c.spec.wid * c.spec.wid) / 10;
    // the push off something at a point r from c's middle, along n, of size J (spin: as the angle goes)
    function shove(c, r0, n, J) {
      c.vx += n[0] * J / c.spec.mass; c.vy += n[1] * J / c.spec.mass;
      c.spin = clamp(c.spin - J * (r0.ry * n[0] - r0.rx * n[1]) / inertia(c), -7, 7);
    }
    // how fast the point r from c's middle is going (the car turning carries it round)
    const pointV = (c, r0) => { const w = -c.spin; return [c.vx + w * r0.ry, c.vy - w * r0.rx]; };
    function barriers(c) {
      for (const e of ends(c)) {
        const w = T.where(e.x, e.y), lim = WALL - e.rad;
        if (Math.abs(w.d) <= lim) continue;
        const j = w.j, sg = w.d > 0 ? -1 : 1, n = [T.nx[j] * sg, T.ny[j] * sg], pen = Math.abs(w.d) - lim;
        c.x += n[0] * pen; c.y += n[1] * pen;
        const [vx, vy] = pointV(c, e), vn = vx * n[0] + vy * n[1];
        if (vn >= 0) continue;
        const rn = e.ry * n[0] - e.rx * n[1], J = -(1.3 * vn) / (1 / c.spec.mass + rn * rn / inertia(c));
        shove(c, e, n, J);
        // (scraping along it slows you down too)
        const tx = -n[1], ty = n[0], vt = c.vx * tx + c.vy * ty;
        c.vx -= tx * vt * 0.08; c.vy -= ty * vt * 0.08;
        if (-vn > 1.5) { ev('wall', { c, p: Math.min(1, -vn / 10) }); if (c.drift) endDrift(c, false); }
      }
    }
    function bumps() {
      const on = g.cars.filter((c) => !c.out);
      for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
        const p = on[a], q = on[b];
        if (Math.abs(p.x - q.x) > 2 || Math.abs(p.y - q.y) > 2) continue;
        let hard = 0;
        for (const e of ends(p)) for (const f of ends(q)) {
          const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy), need = e.rad + f.rad;
          if (d >= need || d < 1e-6) continue;
          const n = [dx / d, dy / d], pen = need - d, mp = p.spec.mass, mq = q.spec.mass;
          p.x -= n[0] * pen * mq / (mp + mq); p.y -= n[1] * pen * mq / (mp + mq);
          q.x += n[0] * pen * mp / (mp + mq); q.y += n[1] * pen * mp / (mp + mq);
          const [pvx, pvy] = pointV(p, e), [qvx, qvy] = pointV(q, f), vn = (qvx - pvx) * n[0] + (qvy - pvy) * n[1];
          if (vn >= 0) continue;
          const rp = e.ry * n[0] - e.rx * n[1], rq = f.ry * n[0] - f.rx * n[1];
          const J = -(1.4 * vn) / (1 / mp + 1 / mq + rp * rp / inertia(p) + rq * rq / inertia(q));
          shove(p, e, [-n[0], -n[1]], J); shove(q, f, n, J);
          hard = Math.max(hard, -vn);
        }
        if (hard > 1.2) { ev('bump', { c: p, o: q, p: Math.min(1, hard / 8) }); for (const c of [p, q]) if (c.drift && hard > 3) endDrift(c, false); }
      }
    }

    // ---------- along the track ----------
    // Where it is on the road now, and how far round it's got: laps, and the finish.
    function progress(c) {
      const w = T.where(c.x, c.y);
      let ds = w.s - c.s;
      if (ds > T.len / 2) ds -= T.len;
      if (ds < -T.len / 2) ds += T.len;
      c.j = w.j; c.s = w.s; c.d = w.d;
      c.dist += ds;
      const a = Math.abs(w.d), was = c.surf;
      c.surf = a <= HW ? 0 : a <= HW + CURB && T.curb[w.j] ? 1 : 2;
      if (c.surf === 1 && g.phase === 'race' && ++c.rub % 9 === 1) ev('curb', { c });
      if (c.surf === 2 && was !== 2) ev('grass', { c });
      // the wrong way: heading back round the track, on the move
      const going = (c.vx * T.tx[w.j] + c.vy * T.ty[w.j]);
      c.back = going < -1 ? c.back + 1 : Math.max(0, c.back - 3);
      if (g.phase !== 'race' || c.fin >= 0) return;
      const done = Math.floor(c.dist / T.len);
      if (done > c.laps.length) {
        c.laps.push(g.clock - c.lapAt); c.lapAt = g.clock;
        if (c.laps.length >= LAPS) {
          c.fin = g.clock; c.place = ++g.home;
          if (g.first < 0) g.first = g.clock;
          ev('finish', { c, place: c.place });
        } else ev('lap', { c, n: c.laps.length + 1 });
      }
    }

    // ---------- how the computer drives ----------
    // Round the road on its line (to the inside of the bends) give or take its own lane, which
    // wanders now and then, and round anyone just ahead. It works out the slowest it'll need to
    // be for every bend coming up and brakes in time for it, and now and then drifts the tight
    // ones (otherwise keeping the wheels off full lock, so it doesn't drift when it doesn't mean to). Stuck on a barrier, it backs off. Racing you (anyone the computer isn't driving), it
    // eases off a little when it's well ahead and pushes a little when it's well behind.
    function think(c) {
      const m = c.mem, sp = c.spec, [fx, fy] = fwd(c), [lx, ly] = left(c), vf = c.vx * fx + c.vy * fy;
      if (g.phase !== 'race') return { s: 0, a: g.t > COUNT - 30, b: false };
      if (--m.laneT <= 0) { m.lane = (r() * 2 - 1) * 0.8; m.laneT = 90 + Math.floor(r() * 200); }
      if (m.rev > 0) { m.rev--; return { s: m.revS, a: false, b: true }; }
      const ahead = Math.round((2.2 + Math.max(0, vf) * 0.3) / T.step), k = (c.j + ahead) % T.n;
      let off = T.line[k] + m.lane;
      for (const o of g.cars) {
        if (o === c || o.out) continue;
        const dx = o.x - c.x, dy = o.y - c.y, along = dx * fx + dy * fy, side = dx * lx + dy * ly;
        if (along > 0 && along < 2.6 && Math.abs(side) < 0.9 && o.vx * fx + o.vy * fy < vf + 0.5) off += side > 0 ? -1 : 1;
      }
      off = clamp(off, -(HW - 0.55), HW - 0.55);
      const tx = T.x[k] + T.nx[k] * off, ty = T.y[k] + T.ny[k] * off, err = wrap(Math.atan2(tx - c.x, ty - c.y) - c.ang);
      let s = clamp(-err * 2.6, -1, 1);
      // stuck (or the wrong way round): back off for a moment, steering the other way
      if ((vf < 0.7 || c.back > 30) && g.clock > 90) {
        if (++m.stuck > 45) { m.stuck = 0; m.rev = 40; m.revS = err > 0 ? 1 : -1; }
      } else m.stuck = 0;
      // as fast as the bends ahead allow: no faster than it can hold one, or turn tight enough for it
      const hold = sp.grip * T.grip * 1.25, turn = sp.turn * 0.8, look = Math.ceil((vf * vf / (2 * BRAKE * 0.65) + 3) / T.step);
      let lim = Infinity;
      for (let j = 0; j <= look; j += 2) {
        const kk = (c.j + j) % T.n, bend = Math.max(0.004, T.sharp[kk]), vs = Math.min(Math.sqrt(hold / bend), turn / bend);
        lim = Math.min(lim, Math.sqrt(vs * vs + 2 * BRAKE * 0.65 * j * T.step));
      }
      // racing you: easing off when well ahead, pushing when well behind
      let band = 1;
      const you = g.cars.filter((o) => !o.ai && !o.out && o.fin < 0);
      if (you.length && c.fin < 0) {
        const gap = c.dist - Math.max(...you.map((o) => o.dist));
        band = clamp(1 - gap * 0.0016, 0.93, 1.05);
      }
      c.pace = c.base === undefined ? c.pace : c.base * band;
      const brake = vf > lim + 0.7, gas = !brake && vf < lim;
      // a drift round a tight one, now and then: the wheels hard over until the back goes
      if (c.drift) m.dr = 0;
      else if (!m.dr && !brake && T.sharp[(c.j + 3) % T.n] > 0.12 && vf > sp.top * 0.55 && Math.abs(s) > 0.6 && r() < 0.3) { m.dr = HOLD + 6; m.drS = Math.sign(s); }
      if (m.dr) { m.dr--; return { s: m.drS, a: true, b: false }; }
      if (!c.drift) s = clamp(s, -(HARD - 0.01), HARD - 0.01);
      return { s, a: gas, b: brake };
    }
    for (const c of g.cars) if (c.ai) c.base = c.pace;

    // ---------- the race ----------
    g.step = function (inputs) {
      g.events = [];
      g.t++;
      if (g.phase === 'count') {
        if (g.t === 1 || g.t === 60 || g.t === 120) ev('count', { n: 3 - Math.floor(g.t / 60) });
        if (g.t >= COUNT) { g.phase = 'race'; ev('go'); }
      } else g.clock++;
      // everyone makes up their mind before anyone moves (the computer drives a car that's finished)
      const ins = g.cars.map((c, i) => (c.out ? {} : c.ai || c.fin >= 0 ? think(c) : (inputs && inputs[i]) || {}));
      g.cars.forEach((c, i) => { if (!c.out) drive(c, ins[i]); });
      bumps();
      for (const c of g.cars) if (!c.out) { barriers(c); progress(c); }
    };
    g.over = () => g.phase === 'race' && (g.cars.every((c) => c.out || c.fin >= 0 || c.ai) || (g.first >= 0 && g.clock - g.first >= LATE));
    g.places = () => g.cars.slice().sort((a, b) => (a.out - b.out) || ((a.fin < 0) - (b.fin < 0)) || (a.fin >= 0 ? a.place - b.place : b.dist - a.dist));
    g.retire = (i) => { const c = g.cars[i]; if (c && !c.out) { c.out = true; c.vx = c.vy = 0; c.drift = 0; } };
    // Saved: [the race, each car].
    g.save = function () {
      return [
        [g.phase, g.t, g.clock, g.first, g.home, seed.s],
        g.cars.map((c) => {
          const m = c.mem;
          return [c.x, c.y, c.vx, c.vy, c.ang, c.spin, c.steer, c.drift, c.dk, c.off, c.boost, c.surf,
            c.j, c.s, c.d, c.dist, c.laps.slice(), c.lapAt, c.fin, c.place, c.back, c.out ? 1 : 0,
            c.in.s, c.in.a ? 1 : 0, c.in.b ? 1 : 0, c.hold, c.rub, c.ai ? 1 : 0, c.pace, c.base === undefined ? -1 : c.base,
            [m.lane, m.laneT, m.stuck, m.rev, m.revS, m.dr, m.drS]];
        }),
      ];
    };
    g.load = function ([gs, cs]) {
      [g.phase, g.t, g.clock, g.first, g.home] = gs; seed.s = gs[5] >>> 0;
      cs.forEach((v, i) => {
        const c = g.cars[i];
        if (!c) return;
        Object.assign(c, { x: v[0], y: v[1], vx: v[2], vy: v[3], ang: v[4], spin: v[5], steer: v[6], drift: v[7], dk: v[8], off: v[9],
          boost: v[10], surf: v[11], j: v[12], s: v[13], d: v[14], dist: v[15], laps: v[16].slice(), lapAt: v[17], fin: v[18],
          place: v[19], back: v[20], out: !!v[21], in: { s: v[22], a: !!v[23], b: !!v[24] }, hold: v[25], rub: v[26], ai: !!v[27], pace: v[28] });
        if (v[29] >= 0) c.base = v[29]; else delete c.base;
        const m = v[30];
        Object.assign(c.mem, { lane: m[0], laneT: m[1], stuck: m[2], rev: m[3], revS: m[4], dr: m[5], drS: m[6] });
      });
    };
    return g;
  }

  // (a hash of this whole function's source, line endings aside)
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '')) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return { create, CARS, TRACKS, track: trackOf, LAPS, COUNT, LATE, HW, CURB, WALL, VERSION };
})();
