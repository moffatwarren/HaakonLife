// Haakon Brawl, the fighting game on the lunch room's second arcade cabinet: two to four
// fighters on a stage you can be knocked off. Every hit adds to your damage, and the more
// damage you've taken the further the next hit sends you, until one sends you right off the
// screen and you lose a life. This is the stages, the moves, the hits and how coworkers fight;
// nothing in here draws or reads keys (js/game.js's BrawlGame and LiveBrawl do that), so the
// game server runs it as it is for a live fight (server/tables/brawl.js).
//
//   const g = BRAWL.create(stage, { players: [{ name, ai, skill, team, lives, power }], seed, time })
//   g.step(inputs)   // one tick (a 60th of a second). inputs[i] is what fighter i is doing, if
//                    // they aren't ai: { x, y, a, b }, the way they're holding (x -1 left to 1
//                    // right, y -1 up to 1 down) and whether A (jump) and B (attack) are down
//   g.over()         // whether it's been won: one team left standing (or the time's up)
//   g.places()       // the fighters in the order they placed: still standing first (most lives,
//                    // then least damage), then the last out before the first
//   g.retire(i)      // fighter i is out (they left a live fight): gone from the stage
//   g.save()         // everything the fight is, as plain arrays and numbers (for JSON), and
//   g.load(saved)    // back again into a fight with the same players: a live fight's server
//                    // sends it, so a browser can carry on from there a little ahead
//   g.fighters, g.phase ('ready', 'fight', then 'over'), g.t (ticks into the phase), g.clock
//   (ticks since FIGHT!), g.events (what happened this tick, for the sounds and the sparks)
//
// Everything is in tiles from the top left of the screen (20 across, 15 down), y going down.
// A fighter: x, y (the middle of their feet), vx, vy (their own speed, tiles a second), kx, ky
// (how fast the last hit sent them, slowing by DECAY), face (1 right, -1 left), ground (the
// platform they're standing on: 0 the stage itself, 1 on the others, or -1 in the air), jumps
// (in the air: left), up (the air uppercut's lift used), pct (damage), lives, stun (ticks they
// can't do anything after a hit), launch (how hard it was), frz (ticks frozen as a hit lands),
// mv (the move they're making, or ''), mt (ticks into it), hit (who it's hit, as bits), chg
// (ticks they've been charging one up, or 0), cmv (the move they're charging), cp (how charged
// the move they're making was, 0 to 1), dt (ticks since they pressed a direction), run (running,
// not walking), tap and tapT (the way they last pressed left or right, and ticks since: holding
// it, how long it's been held), lag
// (ticks landing from an air move), gone (ticks off the screen after losing a life), safe (ticks
// nothing can hit them), drop (ticks falling through the platforms), kos (who they've
// knocked out), out (no lives left, or left), and in (what they were doing last tick).
//
// Left or right walks, and held for RUN_AFTER ticks it breaks into a run (or tap it twice, the
// second within DTAP ticks, to run straight away), until you let go or turn. B while running is a
// lunge that slides you along the ground.
// A jumps, and again in the air; holding it jumps higher. Down + A on a platform drops through
// it. Holding down while falling falls faster. B attacks, and the way you're holding picks the
// move: on the ground a jab, a side punch, an uppercut or a low sweep both ways; in the air a
// spin, a flying punch, an uppercut (the first since you left the ground carries you up: that's
// how you get back after being knocked off) or a stomp that knocks whoever's under you down.
// On the ground, press a direction and B together (give or take LEEWAY ticks either way) and
// keep holding B, and you plant your feet and charge that way's punch up instead: it goes when
// you let go, harder the longer you held, up to full after CHARGE ticks. A direction you were
// already holding when you pressed B (running, say) is the ordinary punch, straight away.
//
//   BRAWL.STAGES     // the stages: { key, name, about, main: { x0, x1, y, h }, soft: [{ x0, x1, y }] }
//   BRAWL.MOVES      // each move: dmg, base and grow (how hard it sends you), ang, start, act, rec, box
//   BRAWL.LIVES, BRAWL.READY (ticks of countdown), BRAWL.CHARGE (ticks to charge a punch fully), BRAWL.FW, BRAWL.FH (a fighter's half-width,
//   height), BRAWL.BLAST (the edges past which you're out), BRAWL.SAFE
//   BRAWL.VERSION    // a fingerprint of this file: a browser only runs a live fight ahead of the
//                    // server when the server has the very same copy
window.BRAWL = (function engine() {
  const DT = 1 / 60;
  const READY = 180; // the countdown: 3, 2, 1, a second each, then FIGHT!
  const LIVES = 3;
  const FW = 0.3, FH = 0.9; // a fighter's half-width and height
  const GRAV = 50, FALL = 11, FAST = 17; // gravity, how fast you fall at most, and holding down
  const WALK = 3.4, RUN = 7, RUN_ACC = 70, AIR = 5.2, AIR_ACC = 28, SLIDE = 45; // walking, running and getting up to speed, the same in the air, and stopping
  const RUN_AFTER = 20, DTAP = 15, LUNGE_SLIDE = 22; // ticks holding a direction before a walk's a run, or between two taps of it for one straight away; how quickly the lunge slows
  const JUMP = 16, JUMP2 = 13.5, HOP = 0.45; // the jump, the jump in the air, and what's kept letting go of A on the way up
  const LIFT = 14.5; // how fast the air uppercut carries you up
  const DECAY = 18; // how quickly a hit's launch dies away (tiles a second, each second)
  const STUN = 2.2, TUMBLE = 8; // ticks of being stunned for each tile a second of launch, and how hard a hit has to be to send you tumbling (no gravity till it's over)
  const GONE = 75, SAFE = 120; // ticks off the screen after losing a life, then not hittable once back
  const CHARGE = 60, CHARGED = 0.4, CHARGE_KB = 0.22, LEEWAY = 6; // charging a punch: ticks to full, and how much more damage it then does and how much harder it sends you; how far apart a direction and B can be pressed and count as together
  const BUF = 8, LAG = 8, CREDIT = 8 * 60; // a press remembered while you're busy; landing out of an air move; how long a hit counts towards a knockout
  const BLAST = { x0: -3, x1: 23, y0: -3, y1: 17.5 };

  // The stages. main is the stage itself, solid all round (h deep: a big h runs off the bottom of
  // the screen, like the side of a building); soft are the platforms you can jump up through and
  // drop down through. Live fights and saved choices go by their place in this list, so only
  // ever add to the end of it.
  const STAGES = [
    { key: 'roof', name: 'THE ROOF', about: 'Up top, by the rooftop units',
      main: { x0: 3, x1: 17, y: 10, h: 8 },
      soft: [{ x0: 4.5, x1: 8, y: 7.75 }, { x0: 12, x1: 15.5, y: 7.75 }, { x0: 8.25, x1: 11.75, y: 5.5 }] },
    { key: 'plant', name: 'THE PLANT', about: 'Pallet racks in the Kingston warehouse',
      main: { x0: 2.25, x1: 17.75, y: 10.25, h: 1.5 },
      soft: [{ x0: 3.25, x1: 6.75, y: 8 }, { x0: 13.25, x1: 16.75, y: 8 }, { x0: 6, x1: 9.25, y: 5.75 }, { x0: 10.75, x1: 14, y: 5.75 }] },
    { key: 'dock', name: 'THE DOCK', about: 'A cottage dock, out on the lake',
      main: { x0: 4.5, x1: 15.5, y: 9.75, h: 1.25 },
      soft: [{ x0: 6.5, x1: 13.5, y: 7.25 }, { x0: 1.25, x1: 3.75, y: 7.5 }, { x0: 16.25, x1: 18.75, y: 7.5 }] },
  ];

  // The moves. box: where it hits, [from x, from y, to x, to y] from the fighter's feet with x
  // the way they're facing; both: it sends whoever it hits away from the fighter, whichever side
  // they're on. dmg: the damage it does. base and grow: how hard it sends you (tiles a second),
  // at no damage and more for every 100% you have (counting this hit). ang: the way it sends you,
  // in degrees up from straight out (below 0, down). start, act, rec: ticks before it hits, while
  // it can, and after. air: it's done in the air, and landing cuts it short.
  const MOVES = {
    jab: { dmg: 3, base: 3.5, grow: 3.5, ang: 30, start: 3, act: 3, rec: 7, box: [0.1, -0.78, 0.8, -0.38] },
    side: { dmg: 10, base: 6.5, grow: 12, ang: 32, start: 9, act: 4, rec: 16, box: [0.15, -0.8, 1.05, -0.3], lunge: 3 },
    up: { dmg: 8, base: 7, grow: 10.5, ang: 86, start: 5, act: 6, rec: 14, box: [-0.45, -1.55, 0.55, -0.55] },
    low: { dmg: 7, base: 5.5, grow: 9, ang: 20, start: 6, act: 4, rec: 14, box: [-0.95, -0.35, 0.95, 0.02], both: true },
    nair: { dmg: 6, base: 5, grow: 8, ang: 40, start: 4, act: 6, rec: 10, box: [-0.55, -0.95, 0.8, -0.15], both: true, air: true },
    fair: { dmg: 9, base: 6, grow: 11, ang: 35, start: 7, act: 4, rec: 14, box: [0.15, -0.8, 1, -0.3], air: true },
    uair: { dmg: 7, base: 6, grow: 9, ang: 85, start: 3, act: 9, rec: 12, box: [-0.4, -1.5, 0.5, -0.5], air: true },
    dair: { dmg: 10, base: 5, grow: 9.5, ang: -70, start: 8, act: 8, rec: 12, box: [-0.4, -0.25, 0.4, 0.35], air: true },
    // B while running: a lunge, sliding along the ground at `lunge` tiles a second, slowing as it goes
    dash: { dmg: 10, base: 6.5, grow: 11, ang: 38, start: 4, act: 10, rec: 12, box: [0, -0.75, 0.85, -0.15], lunge: 9 },
  };
  const MOVE_KEYS = Object.keys(MOVES);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toward = (v, to, by) => (v < to ? Math.min(to, v + by) : Math.max(to, v - by));
  const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  // seeded random numbers, carrying on from o.s (which a saved fight keeps)
  function rng(o) {
    return () => {
      const s = o.s = (o.s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(stage, opts) {
    const S = STAGES[stage] || STAGES[0], M = S.main, seed = { s: (opts.seed || 1) >>> 0 || 1 }, r = rng(seed);
    const plats = [M].concat(S.soft), mid = (M.x0 + M.x1) / 2;
    const g = { stage: S, fighters: [], phase: 'ready', t: 0, clock: 0, time: opts.time || 0, events: [] };
    const ev = (e, o) => g.events.push(Object.assign({ e }, o));
    const n = opts.players.length;
    // where each starts, spread across the stage, and where they come back in (from above)
    const startX = (i) => (n === 1 ? mid : M.x0 + 1.5 + (M.x1 - M.x0 - 3) * [0, 1, 0.33, 0.67][i % 4]);
    g.fighters = opts.players.map((p, i) => ({
      i, name: String(p.name || ''), ai: !!p.ai, skill: clamp(+p.skill || 0, 0, 1), team: Number.isInteger(p.team) ? p.team : i,
      power: +p.power || 1, lives: Number.isInteger(p.lives) && p.lives > 0 ? p.lives : LIVES,
      x: startX(i), y: M.y, vx: 0, vy: 0, kx: 0, ky: 0, face: startX(i) < mid ? 1 : -1, ground: 0, jumps: 1, up: false,
      pct: 0, stun: 0, launch: 0, frz: 0, mv: '', mt: 0, hit: 0, lift: false, chg: 0, cmv: '', cp: 0, dt: 99, bd: 99, run: false, tap: 0, tapT: 99, lag: 0, gone: 0, safe: 0, drop: 0, hop: false, ff: false,
      ba: 0, bb: 0, bx: 0, by: 0, kos: 0, falls: 0, hb: -1, hbT: 0, out: false, outAt: -1,
      in: { x: 0, y: 0, a: false, b: false },
      mem: { next: 0, x: 0, ha: 0, hb: 0, tap: 0, tx: 0, gx: 0, gy: 0 },
    }));
    const foes = (f, o) => o !== f && o.team !== f.team;
    const live = (f) => !f.out && !f.gone;

    // ---------- coming back after losing a life ----------
    function spawn(f) {
      const k = f.i % 4, xs = [mid - 1.5, mid + 1.5, mid - 4, mid + 4];
      Object.assign(f, { x: clamp(xs[k], M.x0 + 0.8, M.x1 - 0.8), y: 1.5, vx: 0, vy: 0, kx: 0, ky: 0, ground: -1, jumps: 1, up: false, pct: 0,
        stun: 0, launch: 0, frz: 0, mv: '', mt: 0, chg: 0, cp: 0, lag: 0, safe: SAFE, drop: 0, hop: false, ff: false, ba: 0, bb: 0, hb: -1 });
      f.face = f.x < mid ? 1 : -1;
      ev('spawn', { f });
    }
    // off the edge of the screen: a life gone, and the knockout to whoever hit them last
    function ko(f) {
      const by = f.hb >= 0 && g.clock - f.hbT < CREDIT ? g.fighters[f.hb] : null;
      if (by) by.kos++;
      f.falls++; f.lives--;
      ev('ko', { f, by, x: f.x, y: f.y });
      Object.assign(f, { vx: 0, vy: 0, kx: 0, ky: 0, stun: 0, mv: '', chg: 0, lag: 0, frz: 0 });
      if (f.lives <= 0) { f.out = true; f.outAt = g.clock; f.gone = 0; ev('out', { f }); }
      else f.gone = GONE;
    }

    // ---------- starting a move, and jumping ----------
    // held: B's still down. On the ground with a direction pressed along with B, it's charged up.
    function attack(f, x, y, held) {
      const air = f.ground < 0;
      const lunge = !air && f.run && !y;
      if (!lunge && !air && (x || y) && held && f.bd <= LEEWAY) { charge(f, x, y); return; }
      let k;
      if (lunge) k = 'dash';
      else if (!air) k = y < 0 ? 'up' : y > 0 ? 'low' : x ? 'side' : 'jab';
      else k = y < 0 ? 'uair' : y > 0 ? 'dair' : x ? 'fair' : 'nair';
      if (x && (k === 'side' || k === 'fair' || k === 'jab')) f.face = x;
      f.mv = k; f.mt = 0; f.hit = 0; f.cp = 0;
      if (k === 'side' || k === 'dash') f.vx = f.face * MOVES[k].lunge;
      // the air uppercut carries you up, once each time you leave the ground
      if (k === 'uair' && !f.up) { f.up = true; f.vy = -LIFT; f.vx = x * AIR * 0.7; f.ff = false; f.lift = true; } else f.lift = false;
      ev('swing', { f, m: k });
    }
    // winding up a punch that way (planted, while B's held), and letting it go
    function charge(f, x, y) {
      const k = y < 0 ? 'up' : y > 0 ? 'low' : 'side';
      if (x && k === 'side') f.face = x;
      f.chg = 1; f.cmv = k; f.mv = ''; f.cp = 0;
      ev('charge', { f, m: k });
    }
    function release(f) {
      const c = Math.min(1, (f.chg - 1) / CHARGE);
      f.chg = 0; f.mv = f.cmv; f.mt = 0; f.hit = 0; f.cp = c; f.lift = false;
      if (f.mv === 'side') f.vx = f.face * MOVES.side.lunge * (1 + c);
      ev('swing', { f, m: f.mv, c });
    }
    function jump(f, x, y) {
      const P = f.ground >= 0 ? plats[f.ground] : null;
      if (P && y > 0 && f.ground > 0) { // down + A on a platform: through it
        f.ground = -1; f.drop = 14; f.vy = 2; ev('drop', { f });
        return;
      }
      if (P) { f.ground = -1; f.vy = -JUMP; f.hop = true; ev('jump', { f, air: false }); return; }
      if (f.jumps <= 0) return;
      f.jumps--; f.vy = -JUMP2; f.hop = true; f.ff = false;
      f.vx = x * AIR; // (a jump in the air can change your way)
      ev('jump', { f, air: true });
    }

    // ---------- one fighter, one tick ----------
    function move(f, inp) {
      if (f.out) return;
      if (f.gone) { if (--f.gone === 0) spawn(f); return; }
      const fight = g.phase === 'fight';
      const x = fight ? sgn(Math.round(clamp(+inp.x || 0, -1, 1))) : 0, y = fight ? sgn(Math.round(clamp(+inp.y || 0, -1, 1))) : 0;
      const a = fight && !!inp.a, b = fight && !!inp.b;
      // a press, remembered for a moment in case they're busy, and how long since they pressed a
      // direction (for a charged punch, it comes with B)
      if ((x && x !== f.in.x) || (y && y !== f.in.y)) f.dt = 0; else if (f.dt < 99) f.dt++;
      // Left or right held a moment on the ground is a run (or the second of two taps the same way,
      // close together, straight away), which lasts as long as they hold that way. Turning round,
      // it's a walk again until they've held it a moment, or tapped twice.
      const wasRun = f.run;
      if (x && x !== f.in.x) {
        f.run = x === f.tap && f.tapT <= DTAP;
        f.tap = x; f.tapT = 0;
      } else if (f.tapT < 99) f.tapT++;
      if (x && x === f.tap && f.tapT >= RUN_AFTER && f.ground >= 0) f.run = true;
      if (x !== f.tap) f.run = false;
      if (f.run && !wasRun && f.ground >= 0) ev('run', { f });
      if (a && !f.in.a) f.ba = BUF;
      if (b && !f.in.b) { f.bb = BUF; f.bx = x; f.by = y; f.bd = f.dt; }
      f.in = { x, y, a, b };
      if (f.frz > 0) { f.frz--; return; } // (a hit landing: everything stops for a moment)
      if (f.safe > 0) f.safe--;
      if (f.drop > 0) f.drop--;
      if (f.stun > 0) f.stun--;
      if (f.lag > 0) f.lag--;
      // B and then a direction a moment later, before the jab lands: charging that way instead
      if (f.mv === 'jab' && f.mt < MOVES.jab.start && f.ground >= 0 && b && f.dt === 0 && (x || y)) charge(f, x, y);
      // charging: it goes when they let go of B (and it's off if they're knocked off their feet)
      if (f.chg) {
        if (f.ground < 0) f.chg = 0;
        else if (!b) release(f);
        else if (f.chg <= CHARGE) {
          f.chg++;
          if (f.chg === CHARGE + 1) ev('full', { f });
          else if (f.chg % 10 === 0) ev('charging', { f, c: (f.chg - 1) / CHARGE });
        }
      }
      // what they're doing, when they're free to
      const free = !f.stun && !f.mv && !f.lag && !f.chg;
      if (free && f.ba && f.ground >= 0) { f.ba = 0; jump(f, x, y); }
      else if (free && f.bb) { f.bb = 0; attack(f, x || f.bx, y || f.by, b); }
      else if (free && f.ba) { f.ba = 0; jump(f, x, y); }
      if (f.ba) f.ba--;
      if (f.bb) f.bb--;
      // running, steering in the air, and stopping
      if (f.ground >= 0) {
        if (!f.stun && !f.mv && !f.lag && !f.chg) { f.vx = toward(f.vx, x * (f.run ? RUN : WALK), RUN_ACC * DT); if (x) f.face = x; }
        else f.vx = toward(f.vx, 0, (f.mv === 'dash' ? LUNGE_SLIDE : SLIDE) * DT);
        f.kx = toward(f.kx, 0, SLIDE * DT);
      } else if (!f.stun) f.vx = toward(f.vx, x * AIR, AIR_ACC * DT);
      // jumping higher holding A, falling faster holding down
      if (f.hop && (f.vy >= 0 || !a)) { if (f.vy < 0 && !a) f.vy *= HOP; f.hop = false; }
      if (f.ground < 0) {
        if (!f.stun && y > 0 && f.vy >= 0 && f.mv !== 'uair') f.ff = true;
        const tumbling = f.stun > 0 && f.launch >= TUMBLE;
        if (!tumbling) f.vy = Math.min(f.vy + GRAV * DT, f.ff ? FAST : FALL);
        if (f.mv === 'dair' && f.mt >= MOVES.dair.start) f.vy = FAST;
      }
      // a hit's launch dying away
      const k = Math.hypot(f.kx, f.ky);
      if (k > 0) { const s = Math.max(0, k - DECAY * DT) / k; f.kx *= s; f.ky *= s; }
      // and moving
      const px = f.x, py = f.y;
      f.x += (f.vx + f.kx) * DT; f.y += (f.vy + f.ky) * DT;
      land(f, px, py, x);
      if (f.x < BLAST.x0 || f.x > BLAST.x1 || f.y > BLAST.y1 || f.y < BLAST.y0) { ko(f); return; }
      if (f.mv) {
        const m = MOVES[f.mv];
        if (++f.mt >= m.start + m.act + m.rec) f.mv = '';
      }
    }

    // ---------- the stage: landing, the walls of the stage itself, and its edges ----------
    function land(f, px, py, x) {
      const fallV = f.vy + f.ky;
      // still on what they were standing on?
      if (f.ground >= 0) {
        const P = plats[f.ground];
        // (a move on the ground, the lunge say, stops at the edge rather than taking you off it)
        if ((f.x < P.x0 || f.x > P.x1) && f.mv && !MOVES[f.mv].air && !f.stun) { f.x = clamp(f.x, P.x0, P.x1); f.vx = 0; f.y = P.y; return; }
        if (f.x < P.x0 || f.x > P.x1) { f.ground = -1; if (f.vy < 0) f.vy = 0; }
        else { f.y = P.y; return; }
      }
      // the stage itself is solid: its sides and underneath push you out
      if (f.y > M.y && f.y - FH < M.y + M.h && f.x > M.x0 - FW && f.x < M.x1 + FW) {
        if (py <= M.y + 0.001) { /* (landing on it, below) */ }
        else if (py - FH >= M.y + M.h - 0.001) { f.y = M.y + M.h + FH; if (f.vy < 0) f.vy = 0; if (f.ky < 0) f.ky = -f.ky * 0.5; }
        else if (px <= M.x0 - FW + 0.001 || f.x < mid) { f.x = M.x0 - FW; if (f.vx > 0) f.vx = 0; if (f.kx > 0) f.kx = -f.kx * 0.5; }
        else { f.x = M.x1 + FW; if (f.vx < 0) f.vx = 0; if (f.kx < 0) f.kx = -f.kx * 0.5; }
      }
      // landing on something, falling onto it from above
      if (fallV >= 0) {
        for (let j = 0; j < plats.length; j++) {
          const P = plats[j];
          if (j > 0 && f.drop > 0) continue;
          if (py > P.y + 0.001 || f.y < P.y || f.x < P.x0 || f.x > P.x1) continue;
          // hit down hard: a bounce, not a landing
          if (f.stun > 0 && fallV > 7) { f.y = P.y - 0.01; f.ky = -fallV * 0.45; f.vy = 0; ev('bounce', { f }); return; }
          f.y = P.y; f.ground = j; f.vy = 0; f.ky = 0; f.jumps = 1; f.up = false; f.ff = false; f.hop = false;
          if (f.mv && MOVES[f.mv].air) { f.mv = ''; f.lag = LAG; }
          ev('land', { f });
          return;
        }
      }
      // just under the stage's edge, on the way back: up and over it
      if (!f.stun && f.ground < 0 && f.y > M.y && f.y < M.y + 0.8 && fallV < 4) {
        const left = f.x < M.x0 && f.x > M.x0 - FW - 0.35, right = f.x > M.x1 && f.x < M.x1 + FW + 0.35;
        if ((left && x >= 0) || (right && x <= 0)) {
          f.x = left ? M.x0 + 0.05 : M.x1 - 0.05; f.y = M.y; f.ground = 0;
          f.vy = 0; f.ky = 0; f.kx = 0; f.vx = 0; f.jumps = 1; f.up = false; f.ff = false; f.mv = ''; f.lag = 6;
          ev('ledge', { f });
        }
      }
    }

    // ---------- hits ----------
    // Where a move hits, in tiles: [x0, y0, x1, y1]
    function boxOf(f) {
      const m = MOVES[f.mv], b = m.box;
      return f.face > 0 ? [f.x + b[0], f.y + b[1], f.x + b[2], f.y + b[3]] : [f.x - b[2], f.y + b[1], f.x - b[0], f.y + b[3]];
    }
    function hits() {
      const landed = [];
      for (const f of g.fighters) {
        if (!f.mv || !live(f) || f.frz) continue;
        const m = MOVES[f.mv];
        if (f.mt < m.start || f.mt >= m.start + m.act) continue;
        const [x0, y0, x1, y1] = boxOf(f);
        for (const o of g.fighters) {
          if (!foes(f, o) || !live(o) || o.safe > 0 || (f.hit & (1 << o.i))) continue;
          if (x1 < o.x - FW || x0 > o.x + FW || y1 < o.y - FH || y0 > o.y) continue;
          f.hit |= 1 << o.i;
          landed.push([f, o, m]);
        }
      }
      // (everyone's hits land together, so two at once both count)
      for (const [f, o, m] of landed) {
        const dmg = Math.round(m.dmg * f.power * (1 + CHARGED * f.cp) * 10) / 10;
        o.pct = Math.min(999, Math.round((o.pct + dmg) * 10) / 10);
        let ang = m.ang;
        if (f.mv === 'dair' && o.ground >= 0) ang = 75; // (a stomp on someone standing pops them up)
        const dir = m.both ? (o.x === f.x ? f.face : o.x > f.x ? 1 : -1) : f.face, L = (m.base + m.grow * o.pct / 100) * (1 + CHARGE_KB * f.cp), rad = ang * Math.PI / 180;
        o.kx = Math.cos(rad) * L * dir; o.ky = -Math.sin(rad) * L;
        o.vx = 0; o.vy = 0; o.launch = L; o.stun = Math.round(L * STUN);
        if (o.ky < 0 || ang > 0) o.ground = -1;
        o.mv = ''; o.chg = 0; o.run = false; o.lag = 0; o.jumps = 1; o.up = false; o.ff = false; o.hop = false; o.ba = 0; o.bb = 0;
        o.face = -dir;
        o.hb = f.i; o.hbT = g.clock;
        const frz = 3 + Math.floor(dmg / 3);
        o.frz = Math.max(o.frz, frz); f.frz = Math.max(f.frz, frz);
        ev('hit', { f, o, m: f.mv, dmg, c: f.cp, p: Math.min(1, L / 24), x: (o.x + f.x) / 2, y: o.y - FH / 2 });
      }
    }
    // standing on top of each other: a little shove apart
    function shove() {
      const on = g.fighters.filter((f) => live(f) && f.ground >= 0);
      for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
        const p = on[a], q = on[b], d = q.x - p.x;
        if (p.ground !== q.ground || Math.abs(d) >= FW * 1.6) continue;
        const push = (FW * 1.6 - Math.abs(d)) * 0.15 * (d >= 0 ? 1 : -1);
        p.x -= push; q.x += push;
      }
    }

    // ---------- how coworkers fight ----------
    // They make up their mind every so often (quicker the better they are), and hold that
    // until the next time: run at whoever's nearest, jump after them, drop down to them, and
    // when they're close enough, hit them with whatever suits where they are (the side punch
    // once they've taken a lot). Knocked off, they head back, jumping and then uppercutting
    // up to the edge. The better they are the more they attack, and the more they wait at the
    // edge for you to come back. A beginner sometimes leaves it too late to get back.
    function think(f) {
      const m = f.mem, idle = { x: 0, y: 0, a: false, b: false };
      if (g.phase !== 'fight' || f.gone || f.out) { m.ha = 0; m.hb = 0; m.x = 0; return idle; }
      // a double tap under way, to run: nothing, the way, nothing, the way, a tick each
      if (m.tap > 0) {
        m.tap--;
        if (!m.tap) m.x = m.tx;
        return { x: m.tap & 1 ? 0 : m.tx, y: 0, a: false, b: false };
      }
      // charging one up: B held for as long as they meant to, or (once it's had a moment) until
      // someone comes in reach
      if (f.chg) {
        let near = false;
        for (const o of g.fighters) if (foes(f, o) && live(o) && Math.abs(o.x - f.x) < 1.1 && Math.abs(o.y - f.y) < 0.8) near = true;
        if (m.hb > 0) m.hb--;
        m.x = 0;
        return { x: 0, y: 0, a: false, b: m.hb > 0 && !(near && f.chg > 10) };
      }
      const out = { x: m.x, y: 0, a: m.ha > 0, b: false };
      if (m.ha > 0) m.ha--;
      if (--m.next > 0) return out;
      const sk = f.skill;
      m.next = Math.max(2, Math.round(15 - 11 * sk + r() * 5));
      // a jump: A held for a while (or, if it's still down from the last one, let go first)
      const hop = (hold) => { if (f.in.a) { m.ha = 0; out.a = false; m.next = 1; } else { m.ha = hold; out.a = true; } };
      // jumping for a platform (gx, gy: its middle and top): going on for it till they land, or
      // till they've dropped below it and it's out of reach
      if (f.ground >= 0 || (f.vy > 0 && f.y > m.gy + 0.2)) m.gy = 0;
      // knocked off: back to the stage
      const offX = f.x < M.x0 - 0.05 || f.x > M.x1 + 0.05, below = f.y > M.y + 0.05;
      if (f.ground < 0 && (offX || below) && !m.gy) {
        // (under the stage, out from under it first)
        const under = f.y - FH > M.y + M.h - 0.2 && f.x > M.x0 - 0.6 && f.x < M.x1 + 0.6, home = (f.x < mid ? 1 : -1) * (under ? -1 : 1);
        m.next = 2 + Math.round((1 - sk) * 3); m.x = home; out.x = home;
        if (f.stun) return out;
        const sinking = f.vy + f.ky > -1;
        if (r() < 0.12 * (1 - sk)) return out; // (a beginner, dithering)
        if (sinking && f.y > M.y - 1.2 && f.jumps > 0) hop(14);
        else if (sinking && f.jumps === 0 && !f.up && f.y > M.y - 0.4) { out.y = -1; out.b = !f.in.b; }
        return out;
      }
      // the nearest fighter on another team
      let tgt = null, best = Infinity;
      for (const o of g.fighters) {
        if (!foes(f, o) || !live(o)) continue;
        const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.7 + (o.safe ? 6 : 0);
        if (d < best) { best = d; tgt = o; }
      }
      m.x = 0; out.x = 0;
      if (m.gy) {
        const d = m.gx - f.x;
        m.x = out.x = Math.abs(d) > 0.3 ? sgn(d) : 0;
        if (f.vy > 0 && f.jumps > 0 && f.y > m.gy - 0.4 && Math.abs(d) > 0.6) hop(14); // (falling short: the jump in the air)
        return out;
      }
      if (!tgt) return out;
      const dx = tgt.x - f.x, dy = tgt.y - f.y, adx = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
      const busy = f.stun || f.mv || f.lag;
      const tgtOff = tgt.ground < 0 && (tgt.x < M.x0 || tgt.x > M.x1 || tgt.y > M.y + 0.05); // (knocked off: not just standing on a platform out over the edge)
      // close enough to hit
      const keen = 0.3 + 0.6 * sk;
      // running at them: the lunge, from a little further off
      if (f.run && f.ground >= 0 && !busy && !tgt.safe && f.face === dir && adx > 0.8 && adx < 1.9 && Math.abs(dy) < 0.6 && r() < keen) {
        out.x = dir; out.b = !f.in.b; m.next = Math.max(m.next, 6);
        return out;
      }
      if (!busy && !tgt.safe && adx < 1 + 0.15 * sk && Math.abs(dy) < 0.8 && r() < keen) {
        if (f.ground >= 0) {
          if (dy < -0.5 && adx < 0.7) out.y = -1;
          else if (f.face !== dir || r() < (tgt.pct > 110 - 40 * sk ? 0.75 : 0.3)) out.x = dir;
          else if (r() < 0.4) out.y = 1;
        } else if (dy > 0.35 && adx < 0.5) out.y = 1;
        else if (dy < -0.4 && adx < 0.6 && !tgtOff && f.up) out.y = -1;
        else if (f.face !== dir || r() < 0.5) out.x = dir;
        // a charged one now and then, once they've taken a fair bit: the direction pressed with B
        // (so only if they're not already holding it), and held a moment
        if (f.ground >= 0 && tgt.pct > 50 && r() < 0.35 * sk && ((out.x && f.in.x !== out.x) || (out.y && f.in.y !== out.y))) m.hb = 6 + Math.floor(r() * 30 * sk);
        out.b = !f.in.b;
        m.next = Math.max(m.next, 6);
        return out;
      }
      // someone running at them: waiting for them with one charged up
      if (f.ground >= 0 && !busy && !f.in.x && !tgtOff && adx > 1.2 && adx < 2.6 && Math.abs(dy) < 0.6 && sgn(tgt.vx) === -dir && Math.abs(tgt.vx) > 2 && tgt.pct > 30 && r() < 0.3 * sk) {
        out.x = dir; out.b = !f.in.b; m.x = 0; m.hb = 40 + Math.floor(r() * 30);
        return out;
      }
      // waiting at the edge for them to come back
      if (tgtOff && f.ground >= 0) {
        const edge = tgt.x < mid ? M.x0 + 0.5 : M.x1 - 0.5;
        if (Math.abs(edge - f.x) > 0.3 && r() < 0.4 + 0.5 * sk) { m.x = out.x = edge > f.x ? 1 : -1; }
        return out;
      }
      // after them: up (by way of a platform in between, if they're higher than a jump), down,
      // or across, with the jump in the air to get higher
      if (f.ground >= 0 && dy < -1.4) {
        // (near enough to jump to it, or as near as this platform goes)
        const step = dy < -2.4 ? stepUp(f, tgt) : null, goal = step ? (step.x0 + step.x1) / 2 : tgt.x, gd = goal - f.x, P = plats[f.ground];
        const near = step ? f.x > step.x0 - 0.5 && f.x < step.x1 + 0.5 : Math.abs(gd) < 2.2, edge = (gd < 0 && f.x < P.x0 + 1) || (gd > 0 && f.x > P.x1 - 1);
        if ((near || edge) && r() < 0.5 + 0.4 * sk) {
          hop(16); m.x = out.x = Math.abs(gd) > 0.4 ? sgn(gd) : 0;
          m.gx = goal; m.gy = step ? step.y : tgt.y;
          return out;
        }
        m.x = out.x = Math.abs(gd) > 0.3 ? sgn(gd) : 0;
      } else if (f.ground > 0 && dy > 1 && adx < 3.5 && r() < 0.6 && plats.some((Q, j) => j !== f.ground && Q.y > f.y && f.x > Q.x0 && f.x < Q.x1)) {
        // (down through the platform, if there's something under it to land on: otherwise off its end)
        out.y = 1; hop(2);
        return out;
      }
      else if (adx > 0.6) {
        // a long way off: tapping twice to run (and keeping it up while it's that way)
        if (f.ground >= 0 && !busy && !(f.run && f.tap === dir) && adx > 2.5 && r() < 0.3 + 0.6 * sk) { m.tap = 3; m.tx = dir; m.x = 0; return { x: 0, y: 0, a: false, b: false }; }
        m.x = out.x = dir;
      }
      if (f.ground < 0 && f.jumps > 0 && !busy && dy < -1.5 && adx < 3 && f.vy > -3 && r() < 0.4 + 0.5 * sk) hop(14);
      if (f.ground >= 0 && adx > 1.5 && adx < 3.2 && r() < 0.08 + 0.12 * sk) { hop(10 + Math.floor(r() * 6)); }
      // (never run off the stage after them)
      if (f.ground === 0 && (f.x + out.x * 0.9 < M.x0 || f.x + out.x * 0.9 > M.x1)) m.x = out.x = 0;
      // in the air over nothing: back toward the stage
      if (f.ground < 0 && (f.x < M.x0 + 0.3 || f.x > M.x1 - 0.3) && !tgtOff) m.x = out.x = f.x < mid ? 1 : -1;
      return out;
    }

    // the platform to jump onto on the way up to someone too high for one jump: one within a
    // jump above, below them, as near under them as there is
    function stepUp(f, tgt) {
      let best = null, d = Infinity;
      for (const P of S.soft) {
        if (P.y >= f.y - 0.5 || P.y < f.y - 2.5 || P.y < tgt.y - 0.2) continue;
        const k = Math.abs((P.x0 + P.x1) / 2 - tgt.x) + Math.abs((P.x0 + P.x1) / 2 - f.x) * 0.5;
        if (k < d) { d = k; best = P; }
      }
      return best;
    }

    // ---------- the fight ----------
    g.step = function (inputs) {
      g.events = [];
      g.t++;
      if (g.phase === 'ready') {
        if (g.t === 1 || g.t === 60 || g.t === 120) ev('count', { n: 3 - Math.floor(g.t / 60) });
        if (g.t >= READY) { g.phase = 'fight'; g.t = 0; ev('go'); }
      } else if (g.phase === 'fight') g.clock++;
      const ins = g.fighters.map((f, i) => (f.ai ? think(f) : (inputs && inputs[i]) || {}));
      g.fighters.forEach((f, i) => move(f, ins[i]));
      if (g.phase !== 'ready') hits();
      shove();
      // one team left (the rest out of lives, or gone: even before it's started), or the time's up
      if (g.phase !== 'over') {
        const teams = new Set(g.fighters.filter((f) => !f.out).map((f) => f.team));
        if (teams.size <= 1 || (g.phase === 'fight' && g.time && g.clock >= g.time)) { g.phase = 'over'; g.t = 0; ev('end', { time: teams.size > 1 }); }
      }
    };
    g.over = () => g.phase === 'over';
    g.places = () => g.fighters.slice().sort((a, b) => (a.out - b.out) || (a.out ? b.outAt - a.outAt : (b.lives - a.lives) || (a.pct - b.pct)));
    g.retire = (i) => {
      const f = g.fighters[i];
      if (!f || f.out) return;
      Object.assign(f, { out: true, left: true, outAt: g.clock, gone: 0, mv: '', vx: 0, vy: 0, kx: 0, ky: 0 });
      ev('out', { f });
    };
    g.boxOf = (f) => (f.mv ? boxOf(f) : null);
    // Saved: [the fight, each fighter].
    g.save = function () {
      return [
        [g.phase, g.t, g.clock, seed.s, g.time],
        g.fighters.map((f) => [f.x, f.y, f.vx, f.vy, f.kx, f.ky, f.face, f.ground, f.jumps, f.up ? 1 : 0, f.pct, f.lives,
          f.stun, f.launch, f.frz, MOVE_KEYS.indexOf(f.mv), f.mt, f.hit, f.lag, f.gone, f.safe, f.drop, f.hop ? 1 : 0, f.ff ? 1 : 0,
          f.ba, f.bb, f.bx, f.by, f.kos, f.falls, f.hb, f.hbT, f.out ? 1 : 0, f.outAt, f.left ? 1 : 0, f.lift ? 1 : 0,
          f.in.x, f.in.y, f.in.a ? 1 : 0, f.in.b ? 1 : 0, f.ai ? 1 : 0, [f.mem.next, f.mem.x, f.mem.ha, f.mem.hb],
          f.chg, MOVE_KEYS.indexOf(f.cmv), f.cp, f.dt, f.bd, f.run ? 1 : 0, f.tap, f.tapT, [f.mem.tap, f.mem.tx, f.mem.gx, f.mem.gy]]),
      ];
    };
    g.load = function ([gs, fs]) {
      [g.phase, g.t, g.clock] = gs; seed.s = gs[3] >>> 0; g.time = gs[4] || 0;
      fs.forEach((v, i) => {
        const f = g.fighters[i];
        if (!f) return;
        Object.assign(f, { x: v[0], y: v[1], vx: v[2], vy: v[3], kx: v[4], ky: v[5], face: v[6], ground: v[7], jumps: v[8], up: !!v[9],
          pct: v[10], lives: v[11], stun: v[12], launch: v[13], frz: v[14], mv: MOVE_KEYS[v[15]] || '', mt: v[16], hit: v[17], lag: v[18],
          gone: v[19], safe: v[20], drop: v[21], hop: !!v[22], ff: !!v[23], ba: v[24], bb: v[25], bx: v[26], by: v[27], kos: v[28],
          falls: v[29], hb: v[30], hbT: v[31], out: !!v[32], outAt: v[33], left: !!v[34], lift: !!v[35],
          in: { x: v[36], y: v[37], a: !!v[38], b: !!v[39] }, ai: !!v[40],
          chg: v[42], cmv: MOVE_KEYS[v[43]] || '', cp: v[44], dt: v[45], bd: v[46], run: !!v[47], tap: v[48], tapT: v[49] });
        const m = v[41];
        Object.assign(f.mem, { next: m[0], x: m[1], ha: m[2], hb: m[3] || 0, tap: v[50][0], tx: v[50][1], gx: v[50][2], gy: v[50][3] });
      });
    };
    return g;
  }

  // (a hash of this whole function's source, line endings aside)
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '')) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return { create, STAGES, MOVES, LIVES, READY, CHARGE, FW, FH, BLAST, SAFE, VERSION };
})();
