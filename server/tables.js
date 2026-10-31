// Tables anyone can sit down at and get up from whenever they like, unlike a Room, which
// is a match two players agreed to. There's one of each kind in a world, started when the
// first person sits down and put away when the last one gets up. A browser sends
//   { k: 'sit', t }  { k: 'stand', t }  { k: 'tin', t, d }  (what they did at it)
// and while they're sitting there it's sent { k: 'tb', t, s } whenever what they see
// changes, then { k: 'tb', t, s: null, r: why } once they're no longer at it ('left',
// 'full', 'gone' (dropped out too long), or whatever the game says, like 'bust').
//
// A table game is a module in tables/, listed by its key in tables/index.js, that exports:
//   hz                 how many times a second it ticks (default 10)
//   create({ rng })    the starting state, with nobody sitting
//   sit(s, id, name)   sit them down: true, or false if there's no room (or a word for why
//                      not, which they're sent as the r above)
//   stand(s, id)       get them up
//   away(s, id, gone)  (optional) their connection dropped (gone true), or came back
//   input(s, id, d)    they did something. d comes straight from their browser: check it
//   tick(s)            one step. Returns who it's got up, as [{ id, r: why }]
//   seated(s)          the ids of everyone sitting there
//   view(s, id)        what they're sent
import { GRACE } from './rooms.js';

export class Table {
  // send(id, msg) reaches a player; left(id) is called when they're no longer at it.
  constructor({ id, game, send, left }) {
    Object.assign(this, { id, game, send, left, sent: new Map(), away: new Map() });
    this.state = game.create({ rng: Math.random });
    // Ticking on a clock of its own, not setInterval, which runs a little slow (and slower
    // still when the server's busy): a late tick is made up straight away, so a game's as
    // many ticks a second as it says (a live game's browsers count on it).
    const ms = 1000 / (game.hz || 10);
    let next = performance.now() + ms;
    const run = () => {
      for (let k = 0; k < 4 && !this.closed && performance.now() >= next; k++) { this.step(); next += ms; }
      if (this.closed) return; // (put away by that tick)
      if (performance.now() >= next) next = performance.now() + ms; // too far behind to catch up
      this.timer = setTimeout(run, next - performance.now());
    };
    this.timer = setTimeout(run, ms);
  }

  seated() { return this.game.seated(this.state); }

  sit(pid, name) {
    const got = this.game.sit(this.state, pid, name);
    if (got !== true) return got || false;
    this.sent.delete(pid);
    this.show(pid);
    return true;
  }

  stand(pid, why = 'left') {
    if (!this.seated().includes(pid)) return;
    try { this.game.stand(this.state, pid); } catch (e) { this.crash(e); return; }
    this.out(pid, why);
  }

  input(pid, d) {
    try { this.game.input(this.state, pid, d); } catch (e) { this.crash(e); }
  }

  // their connection dropped: they have GRACE to come back before they lose their seat
  gone(pid) {
    if (this.away.has(pid) || !this.seated().includes(pid)) return;
    this.away.set(pid, setTimeout(() => { this.away.delete(pid); this.stand(pid, 'gone'); }, GRACE));
    this.tell(pid, true);
  }

  back(pid) {
    if (this.away.has(pid)) this.tell(pid, false);
    clearTimeout(this.away.get(pid));
    this.away.delete(pid);
    this.sent.delete(pid); // they need to be told everything again
    this.show(pid);
  }

  // let the game know their connection dropped or came back, if it wants to
  tell(pid, gone) {
    if (!this.game.away) return;
    try { this.game.away(this.state, pid, gone); } catch (e) { this.crash(e); }
  }

  out(pid, why) {
    clearTimeout(this.away.get(pid));
    this.away.delete(pid);
    this.sent.delete(pid);
    this.send(pid, { k: 'tb', t: this.id, s: null, r: why });
    this.left(pid);
  }

  // send them what they see, if it's changed
  show(pid) {
    const str = JSON.stringify(this.game.view(this.state, pid));
    if (this.sent.get(pid) === str) return;
    this.sent.set(pid, str);
    this.send(pid, { k: 'tb', t: this.id, s: JSON.parse(str) });
  }

  step() {
    try {
      for (const { id, r } of this.game.tick(this.state) || []) this.out(id, r);
      for (const pid of this.seated()) this.show(pid);
    } catch (e) { this.crash(e); }
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    for (const t of this.away.values()) clearTimeout(t);
    this.away.clear();
  }

  // a bug in a table game sends everyone away from it, not the server down
  crash(e) {
    console.error('table', this.id, 'crashed:', e);
    let ids = [];
    try { ids = this.seated(); } catch (err) { /* nothing more to do */ }
    this.state = this.game.create({ rng: Math.random });
    for (const pid of ids) this.out(pid, 'error');
  }
}
