// The snowball fight across the parking lot, one player against another (SnowballGame in
// js/game.js draws it). Each of you is behind a wall of snow with the other's wall across
// the lot, and it plays like the game against coworkers: left and right move you along
// your wall, A throws straight across the lot, and holding Down ducks behind your wall,
// where nothing can hit you, and packs another snowball (you hold 5). Three hits and
// you're out; otherwise whoever has been hit fewer times when the 90 seconds are up wins.
//
// The sizes and speeds are the same as SnowballGame's: a 320-wide lot stepping 60 times
// a second, so the server does two of those steps each tick. Seat 0's wall is the near
// one; each player is sent the lot mirrored so they're behind the near wall, with x
// mirrored to match.
//
// Each player's browser moves them along their wall the moment they press, and sends where
// they are and whether they're ducking ({ x, d }), with n, how many times they've thrown.
// The server's copy follows that, a bit faster than anyone can move so it keeps up, and
// the server decides where the snowballs go and who they hit.
const SW = 320, LO = 20, HI = SW - 20;
const TIME = 90 * 60; // steps of play
const READY = 75; // steps of "Get ready..." first
const STEPS = 2;
const CHASE = 4; // the furthest the server moves someone towards where their browser has them, a step
const AMMO = 5, PACK = 28, COOL = 12, HEARTS = 3;
const REACH = 13; // a snowball hits anyone standing up closer than this to where it lands
const HURT = 40; // steps after a hit when the next one only brushes you
// how many steps a snowball takes to cross the lot: quicker as it goes on, and a bit
// slower if either of you is on a touch screen
const flight = (s) => Math.round(44 - 12 * s.t / TIME) + (s.soft ? 6 : 0);

export const hz = 30;

const player = () => ({ x: SW / 2, want: SW / 2, duck: false, ammo: AMMO, pack: 0, cool: 0, hearts: HEARTS, hurt: 0, hits: 0, tap: 0, n: 0, q: 0 });

export function create({ soft }) {
  return { soft: !!soft, ready: 0, t: 0, p: [player(), player()], balls: [], id: 0 };
}

// d: { x (where they are on their own screen), d (1 while ducking), n (throws so far) }
export function input(s, seat, d) {
  if (!d || typeof d !== 'object') return;
  const p = s.p[seat];
  if (typeof d.x === 'number' && Number.isFinite(d.x)) p.want = Math.max(LO, Math.min(HI, seat ? SW - d.x : d.x));
  if (d.d !== undefined) p.duck = !!d.d;
  // new throws wait their turn (one every COOL steps); a burst of more than two is ignored
  if (Number.isInteger(d.n) && d.n > p.n) { p.q = Math.min(2, p.q + d.n - p.n); p.n = d.n; }
}

function result(s) {
  const [a, b] = s.p.map((p) => p.hearts);
  return { w: a > b ? 0 : b > a ? 1 : -1, hp: [a, b], hits: s.p.map((p) => p.hits) };
}

function step(s) {
  if (s.ready < READY) { s.ready++; return; }
  s.t++;
  s.p.forEach((p, seat) => {
    const d = p.want - p.x;
    p.x += Math.sign(d) * Math.min(Math.abs(d), CHASE);
    if (p.cool > 0) p.cool--;
    if (p.hurt > 0) p.hurt--;
    if (p.duck) { if (p.ammo < AMMO && ++p.pack >= PACK) { p.ammo++; p.pack = 0; } } else p.pack = 0;
    if (p.q > 0 && !p.cool) {
      // (a throw while ducking, or with nothing to throw, comes to nothing)
      p.q--;
      if (!p.duck && p.ammo > 0) {
        // from where their browser had them when they threw, if the server's nearly caught up
        if (Math.abs(p.want - p.x) <= 12) p.x = p.want;
        p.ammo--; p.cool = COOL;
        s.balls.push({ id: ++s.id, s: seat, x: p.x, t: 0, dur: flight(s) });
      }
    }
  });
  // snowballs land on the far wall: whoever's standing up there, near enough, is hit
  for (const b of s.balls) {
    if (++b.t < b.dur) continue;
    b.dead = true;
    const p = s.p[1 - b.s];
    if (Math.abs(b.x - p.x) >= REACH) continue;
    if (p.duck || p.hurt > 0) { p.tap++; continue; }
    p.hearts--; p.hurt = HURT; s.p[b.s].hits++;
  }
  s.balls = s.balls.filter((b) => !b.dead);
  if (s.p.some((p) => p.hearts <= 0) || s.t >= TIME) return result(s);
}

export function tick(s) {
  for (let i = 0; i < STEPS; i++) {
    const r = step(s);
    if (r) return r;
  }
}

const r2 = (n) => Math.round(n * 100) / 100;

// s: your seat, ph: 0 getting ready (t counts up to 75) or 1 playing, left: steps of play
// left. me: where you are (x), ducking (d), ammo (a), packing (pk), hearts (h), how many of
// your throws it's taken in (n), hits you've got in (hi) and snowballs that have hit your
// wall (tp). th: the same for them, with c, steps since they threw (counting down from 12),
// and hu, steps since they were hit (counting down from 40). b: the snowballs in the air,
// each [id, 1 if it's yours, x, steps since it was thrown, steps it takes].
export function view(s, seat) {
  const fx = (x) => r2(seat ? SW - x : x), me = s.p[seat], th = s.p[1 - seat];
  return {
    s: seat, ph: s.ready < READY ? 0 : 1, t: s.ready, left: TIME - s.t,
    me: { x: fx(me.x), d: me.duck ? 1 : 0, a: me.ammo, pk: me.pack, h: me.hearts, n: me.n - me.q, hi: me.hits, tp: me.tap },
    th: { x: fx(th.x), d: th.duck ? 1 : 0, a: th.ammo, c: th.cool, h: th.hearts, hu: th.hurt, hi: th.hits, tp: th.tap },
    b: s.balls.map((b) => [b.id, b.s === seat ? 1 : 0, fx(b.x), b.t, b.dur]),
  };
}
