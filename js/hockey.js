// Pond hockey on the parking lot's rink: one on one against a coworker for now, two on two
// one day (so passing is in already). This is the rules, the skating, the puck and how the
// players nobody's playing play; nothing in here draws or reads keys (js/game.js's
// HockeyGame does that, and js/lot3d.js draws the players and the puck), so a game server
// could run it as it is.
//
//   const g = HOCKEY.create(floor, { players: [{ name, team, ai, hand }], seed })
//   g.step(inputs)   // one tick (a 60th of a second). inputs[i] is what player i is doing,
//                    // if they aren't ai: { x, y } which way they're skating (-1 to 1
//                    // each), shoot (A held down) and pass (B pressed this tick)
//   g.faceoff()      // everyone back to the middle and the puck dropped (after a goal)
//   g.over()         // whether it's been won
//   g.stick(p)       // what player p is doing with their stick, for drawing it
//   g.down(p)        // how far over they've been knocked (0 to 1), for drawing it
//   g.players, g.puck, g.score, g.clock (ticks of play left), g.ot (in overtime), g.phase
//   ('ready', 'play', 'goal' or 'buzzer'), g.t (ticks into it), g.events (what happened
//   this tick, for the sounds)
//
// Everything is in tiles (a metre each) from the map's top-left corner. Facing is an angle,
// 0 toward the bottom of the map and π/2 toward the right, as in js/lot3d.js. Team 0
// attacks the net at the top of the rink and team 1 the one at the bottom.
//
// A: with the puck, tap it to shoot, or hold it to wind up a slapshot (harder, but less
// accurate); without it, a poke check. B: with the puck, it goes the way you're steering
// (to a teammate, if there's one that way); without it, a body check, a burst of speed the
// way you're steering: coming in hard it knocks over whoever it catches (and the puck off
// their stick), softly it only shoves them, and it leaves you off balance if it misses.
//
//   HOCKEY.LENGTH    // ticks in a game, before any overtime
window.HOCKEY = (function () {
  const DT = 1 / 60;
  const LENGTH = 3 * 60 * 60; // three minutes of play
  const READY = 90, DOWN = 60; // ticks before the puck drops, and lying on the ice after a check
  const HARD = 5.5; // how fast (m/s) a check has to close in on someone to knock them over
  const BURST = 4.5; // the speed (m/s) a check adds
  // skating: top speed and how quickly you get up to it (m/s, m/s²), how much quicker you can
  // stop than start, and how you slow down coasting (a share of your speed, and m/s, a second)
  const SPEED = 6.2, ACC = 9, BRAKE = 1.4, DRAG = 0.45, GLIDE = 0.35;
  const PR = 0.32, PUCK = 0.038, REACH = 0.55; // a player's radius, the puck's, how far out the blade is
  const MOUTH = 0.62, DEPTH = 0.6, POST = 0.035; // half the net's mouth, how deep it goes, its posts
  const WRIST = 10, FULL = 40; // A held longer than WRIST ticks winds up a slapshot, full power at FULL
  const LEN = { poke: 16, check: 20 }, SWING = { shot: 18, pass: 12 }; // ticks each lasts
  const AI_SPEED = 0.9; // the players nobody's playing are a little slower than you

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The rink, from the map: the boards run through the middle of the 'B' tiles, round
  // corners and all, and each net is a pair of 'n' tiles side by side, its goal line through
  // their middle.
  function rinkOf(floor) {
    const nets = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    floor.tiles.forEach((row, y) => [...row].forEach((t, x) => {
      if (t === 'B') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (t === 'n' && row[x - 1] !== 'n') nets.push({ x: x + 1, y: y + 0.5 });
    }));
    const R = { x0: x0 + 0.5, y0: y0 + 0.5, x1: x1 + 0.5, y1: y1 + 0.5, r: 1.125 };
    R.cx = (R.x0 + R.x1) / 2; R.cy = (R.y0 + R.y1) / 2;
    // the top net first, each with the way it opens (1: down the map)
    R.nets = nets.sort((a, b) => a.y - b.y).map((n) => ({ x: n.x, y: n.y, dir: n.y < R.cy ? 1 : -1 }));
    return R;
  }
  // Keep something round (radius rad) inside the boards: if it's gone through them, put it
  // back, and return which way is back in (a unit vector); otherwise null.
  function boards(R, o, rad) {
    const cx = clamp(o.x, R.x0 + R.r, R.x1 - R.r), cy = clamp(o.y, R.y0 + R.r, R.y1 - R.r);
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), room = R.r - rad;
    if (d <= room) return null;
    o.x = cx + (dx / d) * room; o.y = cy + (dy / d) * room;
    return [-dx / d, -dy / d];
  }
  // Bounce off a surface facing n: e of the speed into it comes back out, f of the speed
  // along it is kept. Returns how hard it hit.
  function bounce(o, n, e, f) {
    const vn = o.vx * n[0] + o.vy * n[1];
    if (vn >= 0) return 0;
    const tx = o.vx - vn * n[0], ty = o.vy - vn * n[1];
    o.vx = tx * f - vn * e * n[0]; o.vy = ty * f - vn * e * n[1];
    return -vn;
  }
  // A net from the outside: a box something round can't get into. Pushes it out and returns
  // which way, or null.
  function netBox(n, o, rad) {
    const bx0 = n.x - MOUTH - POST, bx1 = n.x + MOUTH + POST, by0 = n.dir > 0 ? n.y - DEPTH : n.y, by1 = n.dir > 0 ? n.y : n.y + DEPTH;
    const qx = clamp(o.x, bx0, bx1), qy = clamp(o.y, by0, by1), dx = o.x - qx, dy = o.y - qy, d = Math.hypot(dx, dy);
    if (d >= rad) return null;
    if (d > 1e-6) { o.x = qx + (dx / d) * rad; o.y = qy + (dy / d) * rad; return [dx / d, dy / d]; }
    const [k, ox, oy] = [[o.x - bx0, -1, 0], [bx1 - o.x, 1, 0], [o.y - by0, 0, -1], [by1 - o.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    o.x += ox * (k + rad); o.y += oy * (k + rad);
    return [ox, oy];
  }

  function create(floor, opts) {
    const R = rinkOf(floor), r = rng(opts.seed || 1);
    const gauss = () => (r() + r() + r() - 1.5) * 1.41; // about a normal spread
    const g = { rink: R, players: [], puck: null, score: [0, 0], clock: LENGTH, ot: false, phase: 'ready', t: 0, events: [], touch: null };
    const ev = (e, o) => g.events.push(Object.assign({ e }, o));
    const attack = (team) => R.nets[team === 0 ? 0 : 1], defend = (team) => R.nets[team === 0 ? 1 : 0];
    const fwd = (p) => [Math.sin(p.ang), Math.cos(p.ang)];
    const left = (p) => [Math.cos(p.ang), -Math.sin(p.ang)];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // where the blade is: out in front and over on the side they shoot from
    function blade(p, reach) {
      const [fx, fy] = fwd(p), [lx, ly] = left(p);
      return { x: p.x + fx * reach + lx * p.hand * 0.22, y: p.y + fy * reach + ly * p.hand * 0.22 };
    }

    g.players = opts.players.map((o, i) => ({
      i, name: o.name, team: o.team, ai: !!o.ai, hand: o.hand || 1,
      x: R.cx, y: R.cy, vx: 0, vy: 0, ang: 0, in: { x: 0, y: 0 }, push: false,
      act: null, swing: null, wind: 0, wasA: false, down: 0, fall: 1, guard: 0, recover: 0, cheer: false,
      cool: { grab: 0, poke: 0, check: 0 }, drib: 0, stride: 0, mem: { next: 0, hold: 0, lane: 1, range: 5, wait: 0, gx: R.cx, gy: R.cy, saw: null },
    }));
    g.puck = { x: R.cx, y: R.cy, vx: 0, vy: 0, owner: null, inNet: null, past: [] };

    // ---------- the puck changing hands ----------
    function take(p) {
      const pk = g.puck;
      if (pk.owner && pk.owner !== p) pk.owner.wind = 0;
      pk.owner = p; p.drib = 0; g.touch = p;
      ev('pickup', { p });
    }
    // (past: who a hard shot or pass has already got by; from: who had it, whose skates it
    // can go between while they can't pick it up again, for a pass back past them)
    function loose(vx, vy) {
      const pk = g.puck;
      if (pk.owner) { pk.owner.wind = 0; pk.owner.cool.grab = 20; }
      pk.from = pk.owner; pk.owner = null; pk.vx = vx; pk.vy = vy; pk.past = [];
    }
    // A shot at the net they're attacking, as hard as power (0, a wrist shot, to 1): the
    // further out, the harder and the faster they're going, the wider it can go. Facing well
    // away from the net, it goes the way they're facing instead (clearing it).
    function shoot(p, power) {
      const n = attack(p.team), aim = Math.atan2(n.x + (r() - 0.5) * 0.7 - p.x, n.y - p.y);
      const far = Math.hypot(n.x - p.x, n.y - p.y), spd = Math.hypot(p.vx, p.vy);
      const spread = (0.05 + 0.025 * far) * (1 + 0.5 * power) * (1 + 0.12 * spd / SPEED);
      const a = (Math.abs(wrap(aim - p.ang)) < 1.9 ? aim : p.ang) + gauss() * spread, v = 16 + 11 * power;
      loose(Math.sin(a) * v + p.vx * 0.4, Math.cos(a) * v + p.vy * 0.4);
      p.cool.grab = 18; p.swing = { k: 'shot', t: 0, p: power };
      ev('shot', { p, power });
    }
    // The way they're steering, or with no direction held, the way they're facing.
    const heading = (p) => (Math.hypot(p.in.x, p.in.y) > 0.2 ? Math.atan2(p.in.x, p.in.y) : p.ang);
    // The puck sent the way they're steering: to a teammate if there's one roughly that way
    // (led so it meets them), otherwise along the ice that way (to bank it off the boards,
    // say, or get it past someone).
    function pass(p) {
      const a = heading(p);
      let best = null, bestOff = 0.6;
      for (const q of g.players) {
        if (q === p || q.team !== p.team || q.down) continue;
        const off = Math.abs(wrap(Math.atan2(q.x - p.x, q.y - p.y) - a));
        if (off < bestOff) { best = q; bestOff = off; }
      }
      if (best) {
        const v = 13, lead = dist(p, best) / v, tx = best.x + best.vx * lead - p.x, ty = best.y + best.vy * lead - p.y, b = Math.atan2(tx, ty) + gauss() * 0.03;
        loose(Math.sin(b) * v, Math.cos(b) * v);
        ev('pass', { p, to: best });
      } else {
        loose(Math.sin(a) * 10 + p.vx * 0.3, Math.cos(a) * 10 + p.vy * 0.3);
        ev('pass', { p });
      }
      p.cool.grab = 14; p.swing = { k: 'pass', t: 0 };
    }
    // A check: a burst of speed the way they're steering (or facing), into whoever they
    // meet, carrying them on for as long as it lasts. Coming in hard (head on, or from the
    // side at speed) it knocks them over and the puck off their stick; otherwise (catching
    // them up from behind, or from a standstill) it's only a shove, which puts them off
    // balance and might jar the puck loose.
    function startCheck(p) {
      const a = heading(p);
      p.act = { k: 'check', t: 0, ang: a };
      p.vx += Math.sin(a) * BURST; p.vy += Math.cos(a) * BURST;
      const s = Math.hypot(p.vx, p.vy), top = SPEED + BURST - 1;
      if (s > top) { p.vx *= top / s; p.vy *= top / s; }
      p.cool.check = 50;
      ev('lunge', { p });
    }
    // The puck jarred off q's stick: it dribbles away at a fraction of their pace, nudged on
    // the way the check went, slow enough for whoever's nearest to scoop up.
    function spill(q, fx, fy) {
      loose(q.vx * 0.35 + fx * 1.5 + (r() - 0.5) * 2, q.vy * 0.35 + fy * 1.5 + (r() - 0.5) * 2);
    }
    function hit(p, q) {
      const a = p.act.ang, [fx, fy] = [Math.sin(a), Math.cos(a)];
      const rel = Math.max(0, (p.vx - q.vx) * fx + (p.vy - q.vy) * fy);
      if (rel < HARD) {
        if (g.puck.owner === q && r() < 0.4) spill(q, fx, fy);
        q.vx += fx * (1 + rel * 0.3); q.vy += fy * (1 + rel * 0.3); q.recover = 20;
        p.vx *= 0.5; p.vy *= 0.5; p.act = null;
        ev('shove', { p, q });
        return;
      }
      if (g.puck.owner === q) spill(q, fx, fy);
      q.down = DOWN; q.act = null; q.swing = null; q.wind = 0;
      // over sideways, the way they were shoved
      const [lx, ly] = left(q);
      q.fall = fx * lx + fy * ly > 0 ? 1 : -1;
      q.vx = q.vx * 0.3 + fx * (2.5 + rel * 0.5); q.vy = q.vy * 0.3 + fy * (2.5 + rel * 0.5);
      p.vx *= 0.35; p.vy *= 0.35; p.act = null;
      ev('hit', { p, q });
    }

    // ---------- each player, each tick ----------
    function control(p, inp) {
      for (const k in p.cool) if (p.cool[k] > 0) p.cool[k]--;
      if (p.guard > 0) p.guard--;
      if (p.recover > 0) p.recover--;
      if (p.swing && ++p.swing.t >= SWING[p.swing.k]) p.swing = null;
      if (p.act) {
        p.act.t++;
        if (p.act.k === 'poke' && p.act.t >= 4 && p.act.t <= 9 && !p.act.done) {
          // the stick jabs out: anything on its blade is knocked loose (most of the time)
          const b = blade(p, REACH + 0.4), pk = g.puck, o = pk.owner;
          if (o && o.team !== p.team && Math.hypot(pk.x - b.x, pk.y - b.y) < 0.45) {
            p.act.done = true;
            if (r() < 0.7) {
              const [fx, fy] = fwd(p);
              loose(fx * 4 + (r() - 0.5) * 3, fy * 4 + (r() - 0.5) * 3);
              p.cool.grab = 6;
              ev('steal', { p, from: o });
            }
          }
        }
        if (p.act && p.act.k === 'check') {
          for (const q of g.players) if (q.team !== p.team && !q.down && !q.guard && dist(p, q) < PR * 2 + 0.14) { hit(p, q); break; }
        }
        if (p.act && p.act.t >= LEN[p.act.k]) {
          if (p.act.k === 'check') p.recover = 24; // missed: off balance for a moment
          p.act = null;
        }
      }
      if (p.down > 0) {
        if (--p.down === 0) p.guard = 45;
        p.in = { x: 0, y: 0 }; p.wasA = !!inp.shoot;
        return;
      }
      const im = Math.hypot(inp.x || 0, inp.y || 0);
      p.in = im > 1 ? { x: inp.x / im, y: inp.y / im } : { x: inp.x || 0, y: inp.y || 0 };
      if (g.phase !== 'play') { p.wasA = !!inp.shoot; p.wind = 0; return; }
      const has = g.puck.owner === p;
      // A: pressed with the puck it winds up, and let go it shoots; without the puck, a poke
      if (inp.shoot && !p.wasA) {
        if (has) p.wind = 1;
        else if (!p.act && !p.cool.poke) { p.act = { k: 'poke', t: 0 }; p.cool.poke = 28; ev('poke', { p }); }
      } else if (inp.shoot && p.wind) p.wind++;
      else if (!inp.shoot && p.wind) {
        if (has) shoot(p, clamp((p.wind - WRIST) / (FULL - WRIST), 0, 1));
        p.wind = 0;
      }
      if (g.puck.owner !== p) p.wind = 0;
      p.wasA = !!inp.shoot;
      // B: with the puck a pass, without it a check
      if (inp.pass && !p.act && !p.swing) {
        if (has) pass(p);
        else if (!p.cool.check) startCheck(p);
      }
    }
    function move(p) {
      if (g.phase === 'ready') { p.vx = p.vy = 0; p.push = false; return; }
      const top = SPEED * (p.ai ? AI_SPEED : 1) * (g.puck.owner === p ? 0.92 : 1);
      const im = Math.hypot(p.in.x, p.in.y), s = Math.hypot(p.vx, p.vy);
      if (p.down || im < 0.1 || (p.act && p.act.k === 'check')) {
        // coasting (or carried along by a check, or sliding along on your side)
        if (s > 0) {
          const ns = Math.max(0, s * (1 - (p.down ? 1.2 : DRAG) * DT) - (p.down ? 2.5 : GLIDE) * DT);
          p.vx *= ns / s; p.vy *= ns / s;
        }
        p.push = false;
      } else {
        // pushing toward the way they want to go, quicker to stop than to start (but still
        // going faster than they could skate, after a check, it wears off slowly)
        const cos = s > 0.5 ? (p.vx * p.in.x + p.vy * p.in.y) / (s * im) : 1, over = s > top + 0.2 && cos > 0 ? 0.35 : 1;
        const k = (p.wind ? 0.25 : 1) * (p.recover ? 0.4 : 1) * over, tx = p.in.x * top, ty = p.in.y * top;
        const acc = ACC * k * (1 + BRAKE * Math.max(0, -cos));
        const dvx = tx - p.vx, dvy = ty - p.vy, dv = Math.hypot(dvx, dvy);
        if (dv > 1e-6) { const f = Math.min(1, (acc * DT) / dv); p.vx += dvx * f; p.vy += dvy * f; }
        p.push = true;
        // a stride's worth of ice gone under them
        if ((p.stride += s * DT) > 2.6) { p.stride = 0; ev('stride', { p }); }
      }
      p.x += p.vx * DT; p.y += p.vy * DT;
      const n = boards(R, p, PR);
      if (n && bounce(p, n, 0.2, 0.85) > 3) ev('boards', { p });
      for (const nt of R.nets) { const m = netBox(nt, p, PR); if (m) bounce(p, m, 0.1, 0.8); }
      // turning to face where they're going: into a check, toward the net winding up a shot
      // (if it's anywhere in front of them), the way they're pushing, or the way they're sliding
      let want = null;
      if (p.down) want = null;
      else if (p.act && p.act.k === 'check') want = p.act.ang;
      else if (p.wind) { const n2 = attack(p.team), a = Math.atan2(n2.x - p.x, n2.y - p.y); if (Math.abs(wrap(a - p.ang)) < 1.9) want = a; }
      else if (p.push) want = Math.atan2(p.in.x, p.in.y);
      else if (s > 1) want = Math.atan2(p.vx, p.vy);
      if (want !== null) p.ang = wrap(p.ang + wrap(want - p.ang) * Math.min(1, DT * 12));
    }
    // players bump off each other, sharing out their momentum along the way they met
    function collide() {
      const ps = g.players;
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = PR * 2;
          if (d >= min || d < 1e-6) continue;
          const nx = dx / d, ny = dy / d, push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const j2 = -rel * 0.6;
            a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2;
            if (-rel > 3) ev('bump', { p: a, q: b });
          }
        }
    }

    // ---------- the puck ----------
    function carry(p) {
      const pk = g.puck, s = Math.hypot(p.vx, p.vy), ox = pk.x, oy = pk.y;
      p.drib += DT * (7 + s * 0.6);
      const b = blade(p, REACH), [lx, ly] = left(p), [fx, fy] = fwd(p);
      const side = Math.sin(p.drib) * 0.13, ahead = Math.cos(2 * p.drib) * 0.04;
      pk.x = b.x + lx * side + fx * ahead; pk.y = b.y + ly * side + fy * ahead;
      pk.vx = p.vx; pk.vy = p.vy;
      boards(R, pk, PUCK);
      // tucked in from right in front; skating at your own net with it, though, it's knocked
      // off your stick on the goal line (it'd go in long before you could turn)
      for (const n of R.nets) {
        if (g.phase !== 'play' || !through(n, ox, oy)) continue;
        if (n === defend(p.team)) { pk.x = ox; pk.y = oy; loose(-p.vx * 0.3, -p.vy * 0.3); return; }
        loose(p.vx, p.vy); goal(n); return;
      }
    }
    // a loose puck, a short step at a time so a hard shot can't skip through anything
    function slide() {
      const pk = g.puck, s = Math.hypot(pk.vx, pk.vy);
      if (s > 0) { const ns = Math.max(0, s * (1 - 0.12 * DT) - 0.45 * DT); pk.vx *= ns / s; pk.vy *= ns / s; }
      const steps = Math.max(1, Math.ceil((s * DT) / 0.08));
      for (let k = 0; k < steps && !pk.owner; k++) {
        const ox = pk.x, oy = pk.y;
        pk.x += (pk.vx * DT) / steps; pk.y += (pk.vy * DT) / steps;
        const n = boards(R, pk, PUCK);
        if (n) { const hit = bounce(pk, n, 0.65, 0.92); if (hit > 1.5) ev('boards', { hit }); }
        for (const nt of R.nets) if (inNet(nt, ox, oy)) return;
        if (g.phase === 'play') touchPlayers();
      }
    }
    // whether the puck, coming from (ox, oy), has just crossed n's goal line between the posts
    function through(n, ox, oy) {
      const pk = g.puck, s0 = (oy - n.y) * n.dir, s1 = (pk.y - n.y) * n.dir;
      return s0 >= 0 && s1 < 0 && Math.abs(ox + ((pk.x - ox) * s0) / (s0 - s1) - n.x) < MOUTH - PUCK;
    }
    // the puck and a net: in through the mouth is a goal; otherwise off the posts, or off
    // the netting round the back and sides
    function inNet(n, ox, oy) {
      const pk = g.puck;
      if (pk.inNet === n) {
        // in already: it stays in, dying against the netting
        const back = n.y - n.dir * (DEPTH - PUCK);
        if ((pk.y - back) * n.dir < 0) { pk.y = back; pk.vy *= -0.2; pk.vx *= 0.5; }
        if (Math.abs(pk.x - n.x) > MOUTH - PUCK) { pk.x = n.x + Math.sign(pk.x - n.x) * (MOUTH - PUCK); pk.vx *= -0.2; }
        if ((pk.y - n.y) * n.dir > -PUCK) { pk.y = n.y - n.dir * PUCK; pk.vy *= -0.2; }
        return false;
      }
      if (g.phase === 'play' && through(n, ox, oy)) { goal(n); return true; }
      for (const sx of [-1, 1]) {
        const qx = n.x + sx * MOUTH, dx = pk.x - qx, dy = pk.y - n.y, d = Math.hypot(dx, dy), min = POST + PUCK;
        if (d < min && d > 1e-6) {
          pk.x = qx + (dx / d) * min; pk.y = n.y + (dy / d) * min;
          if (bounce(pk, [dx / d, dy / d], 0.8, 0.9) > 1) ev('post');
          return false;
        }
      }
      // in round the side or the back: out the way it came, most of its speed soaked up
      const x0 = n.x - MOUTH - POST - PUCK, x1 = n.x + MOUTH + POST + PUCK, deep = -(pk.y - n.y) * n.dir;
      if (pk.x > x0 && pk.x < x1 && deep > 0 && deep < DEPTH + PUCK) {
        const [k, ox2, oy2] = [[pk.x - x0, -1, 0], [x1 - pk.x, 1, 0], [DEPTH + PUCK - deep, 0, -n.dir]].sort((a, b) => a[0] - b[0])[0];
        pk.x += ox2 * k; pk.y += oy2 * k;
        if (bounce(pk, [ox2, oy2], 0.25, 0.6) > 2) ev('net');
      }
      return false;
    }
    // whoever's blade it reaches gets it (if it isn't coming too hard to hold), and it
    // bounces off anyone it runs into
    function touchPlayers() {
      const pk = g.puck;
      let best = null, bestD = Infinity;
      for (const p of g.players) {
        if (p.down) continue;
        const b = blade(p, REACH), db = Math.hypot(pk.x - b.x, pk.y - b.y), dp = Math.hypot(pk.x - p.x, pk.y - p.y);
        // one that's got by them goes on through, and once it's clear of them it's anyone's
        // again (back off the boards, say)
        if (pk.past.includes(p)) { if (Math.min(db, dp) > 0.8) pk.past.splice(pk.past.indexOf(p), 1); continue; }
        if ((db < 0.42 || dp < PR + 0.1) && !p.cool.grab && db < bestD) { best = p; bestD = db; }
        else if (dp < PR + PUCK && dp > 1e-6 && !(p === pk.from && p.cool.grab)) {
          pk.x = p.x + ((pk.x - p.x) / dp) * (PR + PUCK); pk.y = p.y + ((pk.y - p.y) / dp) * (PR + PUCK);
          pk.vx -= p.vx; pk.vy -= p.vy;
          bounce(pk, [(pk.x - p.x) / dp, (pk.y - p.y) / dp], 0.3, 0.7);
          pk.vx += p.vx; pk.vy += p.vy;
        }
      }
      if (!best) return;
      const rel = Math.hypot(pk.vx - best.vx, pk.vy - best.vy);
      if (rel < 12) take(best);
      else if (r() < 0.7) {
        // too hot to handle: it comes off the stick, most of the pace gone
        pk.vx = best.vx + (pk.vx - best.vx) * -0.25 + (r() - 0.5) * 3; pk.vy = best.vy + (pk.vy - best.vy) * -0.25 + (r() - 0.5) * 3;
        best.cool.grab = 8;
        ev('block', { p: best });
      } else pk.past.push(best); // or it's past them before they can get a stick on it
    }
    function goal(n) {
      const team = n === R.nets[0] ? 0 : 1, by = g.touch && g.touch.team === team ? g.touch : null;
      g.score[team]++;
      g.puck.inNet = n;
      g.phase = 'goal'; g.t = 0;
      for (const p of g.players) { p.wind = 0; p.act = null; p.cheer = p.team === team; }
      ev('goal', { team, p: by });
    }

    // ---------- how the players nobody's playing play ----------
    // They pick where to skate every few ticks, not every tick, so they're a beat behind
    // the play, and they're a little slower than you.
    function think(p) {
      const m = p.mem, pk = g.puck, tgt = attack(p.team), own = defend(p.team), o = pk.owner;
      const inp = { x: 0, y: 0, shoot: false, pass: false };
      const foes = g.players.filter((q) => q.team !== p.team && !q.down);
      const foe = foes.reduce((a, q) => (!a || dist(p, q) < dist(p, a) ? q : a), null);
      if (g.phase !== 'play') return inp;
      if (m.wait > 0) { m.wait--; return inp; }
      // a check coming at them with the puck: half the time they see it and cut away to
      // whichever side of it they're on
      const ck = foe && foe.act && foe.act.k === 'check' ? foe.act : null;
      if (o === p && ck && m.saw !== ck && dist(p, foe) < 3) {
        m.saw = ck;
        if (r() < 0.5) {
          const lx = Math.cos(ck.ang), ly = -Math.sin(ck.ang), s = (p.x - foe.x) * lx + (p.y - foe.y) * ly > 0 ? 2.5 : -2.5;
          m.gx = clamp(p.x + lx * s, R.x0 + 0.6, R.x1 - 0.6); m.gy = clamp(p.y + ly * s, R.y0 + 0.6, R.y1 - 0.6); m.next = 20;
        }
      }
      if (--m.next <= 0) {
        m.next = 4 + Math.floor(r() * 5);
        if (o === p) {
          // on the attack: toward a spot in front of their net, round whoever's in the way
          const front = (p.y - tgt.y) * tgt.dir;
          if (r() < 0.04) m.lane = -m.lane;
          if (front < 0.8) { m.gx = tgt.x + (Math.sign(p.x - tgt.x) || m.lane) * 2.4; m.gy = tgt.y + tgt.dir * 2.6; }
          else {
            m.gx = tgt.x + m.lane * 1.1; m.gy = tgt.y + tgt.dir * 2.8;
            if (foe) {
              const ax = m.gx - p.x, ay = m.gy - p.y, al = Math.hypot(ax, ay) || 1;
              const fx = foe.x - p.x, fy = foe.y - p.y, along = (fx * ax + fy * ay) / al, side = (fx * ay - fy * ax) / al;
              if (along > 0 && along < 3.2 && Math.abs(side) < 1.4) {
                const s = side > 0 ? 1 : -1;
                m.gx = p.x + (ax / al) * 2 + (ay / al) * s * 2.2; m.gy = p.y + (ay / al) * 2 - (ax / al) * s * 2.2;
              }
            }
          }
        } else if (o && o.team !== p.team) {
          // defending: between them and the net, a stride off them
          const dn = Math.hypot(own.x - o.x, own.y - o.y) || 1, k = Math.min(1.4, dn * 0.5);
          m.gx = o.x + ((own.x - o.x) / dn) * k + o.vx * 0.2; m.gy = o.y + ((own.y - o.y) / dn) * k + o.vy * 0.2;
        } else if (!o) {
          // a loose puck: get to where it's going
          const lead = Math.min(0.7, dist(p, pk) / 7);
          m.gx = pk.x + pk.vx * lead; m.gy = pk.y + pk.vy * lead;
        } else {
          // a teammate has it: get open, across from them in front of the net
          m.gx = tgt.x - (o.x - tgt.x) * 0.8; m.gy = tgt.y + tgt.dir * 4;
        }
        m.gx = clamp(m.gx, R.x0 + 0.6, R.x1 - 0.6); m.gy = clamp(m.gy, R.y0 + 0.6, R.y1 - 0.6);
      }
      const dx = m.gx - p.x, dy = m.gy - p.y, dd = Math.hypot(dx, dy);
      if (dd > 0.2) { const k = Math.min(1, dd / 1.2); inp.x = (dx / dd) * k; inp.y = (dy / dd) * k; }
      // finishing a shot it started: A held for m.hold ticks, then let go
      if (m.hold > 0) { m.hold--; inp.shoot = m.hold > 0; return inp; }
      if (o === p) {
        const toNet = Math.hypot(tgt.x - p.x, tgt.y - p.y), front = (p.y - tgt.y) * tgt.dir;
        const off = Math.abs(wrap(Math.atan2(tgt.x - p.x, tgt.y - p.y) - p.ang));
        // (not straight into someone, if it can help it: it tries to get round them first)
        const lane = foe && (() => {
          const ax = (tgt.x - p.x) / toNet, ay = (tgt.y - p.y) / toNet, fx = foe.x - p.x, fy = foe.y - p.y, along = fx * ax + fy * ay;
          return along > 0 && along < toNet && Math.abs(fx * ay - fy * ax) < PR + 0.45;
        })();
        if (front > 1 && off < 0.9 && (!lane || r() < 0.02 || toNet < 2)) {
          if (toNet < m.range) { m.hold = 2; inp.shoot = true; m.range = 3.5 + r() * 3.5; }
          else if (toNet < 10 && (!foe || dist(p, foe) > 4.5) && r() < 0.006) { m.hold = 24 + Math.floor(r() * 14); inp.shoot = true; }
        }
        // two on two: pass to a teammate who's open and nearer the net
        const mate = g.players.find((q) => q !== p && q.team === p.team && !q.down);
        if (mate && Math.hypot(tgt.x - mate.x, tgt.y - mate.y) < toNet - 3 && (!foe || dist(mate, foe) > 2.5) && r() < 0.05) {
          const d = dist(p, mate) || 1; // (steering at them, so it goes their way)
          inp.pass = true; inp.x = (mate.x - p.x) / d; inp.y = (mate.y - p.y) / d;
        }
      } else if (o && o.team !== p.team) {
        const d = dist(p, o), facing = ((o.x - p.x) * Math.sin(p.ang) + (o.y - p.y) * Math.cos(p.ang)) / (d || 1);
        const closing = ((p.vx - o.vx) * (o.x - p.x) + (p.vy - o.vy) * (o.y - p.y)) / (d || 1);
        if (d < 1.3 && facing > 0.5 && !p.cool.poke && r() < 0.1) inp.shoot = true;
        else if (d < 2 && closing > 1.5 && !p.cool.check && !o.guard && r() < 0.025) inp.pass = true;
      }
      return inp;
    }

    // ---------- the game ----------
    g.faceoff = function () {
      if (g.clock <= 0) g.ot = true;
      const spots = [[[0, 4], [-3.5, 7]], [[0, -4], [3.5, -7]]], seen = [0, 0];
      for (const p of g.players) {
        const [dx, dy] = spots[p.team][seen[p.team]++ % 2];
        Object.assign(p, { x: R.cx + dx, y: R.cy + dy, vx: 0, vy: 0, ang: p.team === 0 ? Math.PI : 0, act: null, swing: null, wind: 0, down: 0, guard: 0, recover: 0, cheer: false });
        p.mem.next = 0; p.mem.hold = 0; p.mem.wait = 8 + Math.floor(r() * 14); // a moment to react to the drop
      }
      Object.assign(g.puck, { x: R.cx, y: R.cy, vx: 0, vy: 0, owner: null, inNet: null, past: [] });
      g.touch = null; g.phase = 'ready'; g.t = 0;
    };
    g.step = function (inputs) {
      g.events = [];
      g.t++;
      if (g.phase === 'ready' && g.t >= READY) {
        g.phase = 'play'; g.t = 0;
        g.puck.vx = (r() - 0.5) * 0.6; g.puck.vy = (r() - 0.5) * 0.6;
        ev('go');
      }
      // everyone makes up their mind before anyone moves, so nobody gets to see what the
      // others did first
      const ins = g.players.map((p, i) => (p.ai ? think(p) : (inputs && inputs[i]) || {}));
      g.players.forEach((p, i) => control(p, ins[i]));
      g.players.forEach(move);
      collide();
      if (g.puck.owner) carry(g.puck.owner); else slide();
      if (g.phase === 'play' && !g.ot && --g.clock <= 0) {
        g.clock = 0; g.phase = 'buzzer'; g.t = 0;
        for (const p of g.players) { p.wind = 0; p.act = null; }
        ev('buzzer');
      }
    };
    g.over = () => g.clock <= 0 && g.score[0] !== g.score[1];
    g.stick = function (p) {
      const hand = p.hand;
      if (p.down) return { k: 'down', a: 0, hand };
      if (p.cheer && g.phase === 'goal') return { k: 'cheer', a: g.t / 60, hand };
      if (p.act) return { k: p.act.k, a: p.act.t / LEN[p.act.k], hand };
      if (p.swing) return { k: p.swing.k, a: p.swing.t / SWING[p.swing.k], p: p.swing.p, hand };
      if (p.wind) return { k: 'wind', a: Math.min(1, p.wind / FULL), hand };
      if (g.puck.owner === p) return { k: 'carry', a: p.drib, hand };
      return { k: 'ready', a: 0, hand };
    };
    g.down = (p) => (p.down ? Math.min(1, (DOWN - p.down) / 8, p.down / 22) : 0);
    g.faceoff();
    return g;
  }

  return { create, LENGTH };
})();
