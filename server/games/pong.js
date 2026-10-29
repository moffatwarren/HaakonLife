// Pong on the break room TV, one player against another (PongGame in js/game.js draws it).
// The sizes and speeds are the same as PongGame's game against the TV: a 320x240 screen
// stepping 60 times a second, so the server does two of those steps each tick. Here seat
// 0 is the left paddle; each player is sent the table mirrored so they're on the left.
//
// Each player's browser moves their own paddle the moment they press, and sends where it
// is ({ y }). The server's copy of the paddle follows that, a bit faster than a paddle can
// move so it keeps up, and the server decides where the ball goes and who scores.
const SW = 320, SH = 240, L = 12, R = SW - 12, TOP = 34, BOT = SH - 22, PW = 4, PH = 28, BS = 4, WIN = 5;
const X = [L + 4, R - 8]; // the paddles' x, seat 0 then seat 1
const READY = 75; // steps of "Get ready..." before the first serve
const SERVE = 40; // steps the ball waits before each serve
const CHASE = 6; // the furthest the server moves a paddle towards where its player has it, a step
// A paddle reaches this far past its ends. By the time you see the ball reach your
// paddle, it's already there on the server, a moment before it hears where you moved to.
const REACH = 4;
const STEPS = 2;

export const hz = 30;

function serve(s, toward) {
  s.ball = { x: SW / 2, y: (TOP + BOT) / 2, vx: toward ? 2.2 : -2.2, vy: (s.rng() * 2 - 1) * 1.5 };
  s.wait = SERVE;
}

function bounce(s, k) {
  const b = s.ball, out = k ? -1 : 1;
  const off = Math.max(-1.2, Math.min(1.2, (b.y + BS / 2 - (s.pad[k] + PH / 2)) / (PH / 2)));
  b.vx = out * Math.min(s.top, Math.abs(b.vx) * 1.07);
  b.vy = off * 3;
  b.x = k ? X[1] - BS : X[0] + PW;
  s.bn++;
}

// soft (either player on a touch screen): the ball doesn't get quite as fast
export function create({ rng, soft }) {
  const mid = (TOP + BOT - PH) / 2;
  const s = { rng, top: soft ? 5 : 6, ready: 0, pad: [mid, mid], want: [mid, mid], ball: null, wait: 0, sc: [0, 0], bn: 0, wn: 0 };
  serve(s, rng() < 0.5 ? 1 : 0);
  return s;
}

export function input(s, seat, d) {
  if (d && typeof d.y === 'number' && Number.isFinite(d.y)) s.want[seat] = Math.max(TOP, Math.min(BOT - PH, d.y));
}

function step(s) {
  for (const k of [0, 1]) {
    const d = s.want[k] - s.pad[k];
    s.pad[k] += Math.sign(d) * Math.min(Math.abs(d), CHASE);
  }
  if (s.ready < READY) { s.ready++; return; }
  if (s.wait > 0) { s.wait--; return; }
  const b = s.ball;
  b.x += b.vx; b.y += b.vy;
  if (b.y < TOP) { b.y = TOP; b.vy = -b.vy; s.wn++; }
  if (b.y > BOT - BS) { b.y = BOT - BS; b.vy = -b.vy; s.wn++; }
  const near = (k) => b.y + BS > s.pad[k] - REACH && b.y < s.pad[k] + PH + REACH;
  if (b.vx < 0 && b.x <= X[0] + PW && b.x + BS >= X[0] - 4 && near(0)) bounce(s, 0);
  if (b.vx > 0 && b.x + BS >= X[1] && b.x <= X[1] + PW + 4 && near(1)) bounce(s, 1);
  if (b.x < L - 8 || b.x > R + 8) {
    const k = b.x > R ? 0 : 1; // who scored
    s.sc[k]++;
    if (s.sc[k] >= WIN) return { w: k, sc: s.sc };
    serve(s, k ? 1 : 0); // the next ball goes to whoever just scored
  }
}

export function tick(s) {
  for (let i = 0; i < STEPS; i++) {
    const result = step(s);
    if (result) return result;
  }
}

const r2 = (n) => Math.round(n * 100) / 100;

// s: your seat, ph: 0 getting ready (t counts up to 75) or 1 playing, w: steps until the
// serve, me/them: the paddles' y, the ball and its speed, sc: [yours, theirs], and bn/wn
// count bounces off paddles and walls (for the sounds)
export function view(s, seat) {
  const flip = seat === 1, b = s.ball;
  return {
    s: seat, ph: s.ready < READY ? 0 : 1, t: s.ready, w: s.wait,
    me: r2(s.pad[seat]), them: r2(s.pad[1 - seat]),
    bx: r2(flip ? SW - b.x - BS : b.x), by: r2(b.y), vx: r2(flip ? -b.vx : b.vx), vy: r2(b.vy),
    sc: [s.sc[seat], s.sc[1 - seat]], bn: s.bn, wn: s.wn,
  };
}
