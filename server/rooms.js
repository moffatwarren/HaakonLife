// Games the server runs itself. Two players agree to a match the usual way (a challenge
// and an answer, passed along by world.js); if the game is one of these, the server
// starts a Room for it. Each player's browser then just sends what they did, and draws
// whatever the server says the game looks like now.
//
// A game is a module in games/, listed by its key in games/index.js, that exports:
//   hz               how many times a second it ticks (default 20)
//   create(o)        the starting state. o.seats is how many players, o.rng a seeded
//                    random number function (from the challenge, so it's repeatable),
//                    o.soft whether either player is on a touch screen
//   input(s, seat, d)  player `seat` sent d (0 = the challenger, 1 = the one who said
//                    yes). d comes straight from their browser: check it
//   tick(s)          one step of the game. Return the result (anything but undefined)
//                    to end it
//   view(s, seat)    what that player is sent after each tick (default: the whole state)
// The state and results go out as JSON, so keep them to plain objects, arrays, numbers
// and strings.

// How long a player can drop out (a phone waking up, a flaky connection) before the
// game counts them as gone. The same as how long the browsers wait. While anyone's out the
// game stands still, clocks and all, so nobody loses points for it: nothing ticks, and each
// player's state goes out with w saying why (1: it's waiting for the other player, 2: for you,
// 3: everyone's back, and it carries on in a moment).
export const GRACE = 12000;
// A player's browser says something every 4 seconds, so this long with nothing means they've
// stopped, even with their connection still open: a closed laptop, or a tab in the background.
const QUIET = 6000;
// How long it holds on once everyone's back, so nobody's caught out.
const BACK_MS = 2000;
// No game runs longer than this.
const MAX_MS = 30 * 60000;

// mulberry32, the same seeded random numbers as seeded() in js/game.js
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Room {
  // seats: the players' ids, in seat order. send(id, msg) reaches a player; done() is
  // called once, when the game is over. quiet(id): how long since that player last said
  // anything, in ms.
  constructor({ id, game, seats, seed, soft, send, done, quiet = () => 0 }) {
    Object.assign(this, { id, game, seats, send, done, quiet, over: false, ticks: 0, hold: 0, away: new Map() });
    const hz = game.hz || 20;
    this.maxTicks = Math.ceil(MAX_MS / 1000 * hz);
    this.holdFor = Math.ceil(BACK_MS / 1000 * hz);
    try {
      this.state = game.create({ seats: seats.length, rng: seeded(seed), soft: !!soft });
    } catch (e) { this.crash(e); return; }
    this.timer = setInterval(() => this.step(), 1000 / hz);
  }

  seat(pid) { return this.seats.indexOf(pid); }

  input(pid, d) {
    const seat = this.seat(pid);
    if (seat < 0 || this.over || !this.game.input) return;
    try { this.game.input(this.state, seat, d); } catch (e) { this.crash(e); }
  }

  step() {
    if (this.over) return;
    const stopped = this.seats.find((pid) => this.quiet(pid) > GRACE);
    if (stopped !== undefined) { this.quit(stopped); return; }
    // who it's waiting for, and if that's nobody, whether it's still holding on for a moment
    const out = this.seats.filter((pid) => this.away.has(pid) || this.quiet(pid) > QUIET);
    if (out.length) this.hold = this.holdFor;
    const still = this.hold > 0;
    if (still && !out.length) this.hold--;
    let result;
    try {
      if (!still) result = this.game.tick(this.state);
      this.seats.forEach((pid, seat) => {
        const msg = { k: 'st', m: this.id, s: this.game.view ? this.game.view(this.state, seat) : this.state };
        if (still) msg.w = !out.length ? 3 : out.some((o) => o !== pid) ? 1 : 2;
        this.send(pid, msg);
      });
    } catch (e) { this.crash(e); return; }
    if (result !== undefined) this.end(result);
    else if (++this.ticks >= this.maxTicks) this.end({ timeout: true });
  }

  end(result) {
    if (this.over) return;
    this.over = true;
    clearInterval(this.timer);
    for (const t of this.away.values()) clearTimeout(t);
    for (const pid of this.seats) this.send(pid, { k: 'end', m: this.id, r: result });
    this.done();
  }

  // a player gave up, or was gone too long
  quit(pid) {
    const seat = this.seat(pid);
    if (seat >= 0) this.end({ quit: seat });
  }

  // their connection dropped: they have GRACE to come back
  gone(pid) {
    if (this.seat(pid) < 0 || this.away.has(pid) || this.over) return;
    this.away.set(pid, setTimeout(() => this.quit(pid), GRACE));
  }

  back(pid) {
    clearTimeout(this.away.get(pid));
    this.away.delete(pid);
  }

  // a bug in a game ends that game, not the server
  crash(e) {
    console.error('game', this.id, 'crashed:', e);
    this.end({ error: true });
  }
}
