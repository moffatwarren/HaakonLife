// Jenn's Cookie Showdown: the cookie eating contest at the lunch room counter. This is the rules: the
// biting, chewing, the milk and Nik and Dmitriy's pace. Nothing in here draws or reads keys
// (CookieGame in js/game.js does that), so the same rules could run on the game server one day for
// a live contest, and server/test/cookies.test.js plays them with no browser.
//
//   const g = COOKIES.create({ players: [{ name, ai, react, early }], seed })
//   g.step(inputs)   // one tick (a 60th of a second). inputs[i] is what player i did this tick, if
//                    // they aren't ai: { bite, drink, push }, each true on the tick its button
//                    // went down (A, Down and B in the browser)
//   g.over()         // whether everybody's out
//   g.room(p)        // whether player p's next bite would fit in their mouth
//   g.save()         // everything the contest is, as plain arrays and numbers (for JSON), and
//   g.load(saved)    // back again
//   g.players, g.rivals, g.t (ticks since it started), g.phase ('ready', 'play' or 'over'),
//   g.events (what happened this tick, for the sounds and the words on the screen)
//
// How it plays: A takes a bite out of the cookie in your hand, which fills your mouth (mouth, 0 to
// 1). Your mouth empties as you chew, quicker the fuller it is, so the quickest way through a pile
// is to keep it nearly full. Bite with no room left and you choke, and cough for a while with no
// chewing (spluttering a little of it out, so even mashing gets somewhere, slowly). Every bite dries your mouth out (dry, 0 to 1), which slows the chewing right down; a gulp
// of milk (Down) puts that right, and Jenn tops your glass back up a gulp at a time (milk, up to
// MILK). Now and then Nik or Dmitriy slips one of their own burnt cookies onto your plate: push it
// away (B) rather than biting into it, since only Jenn's cookies count. Pushing away one of hers is
// a waste of a cookie.
//
// Nik and Dmitriy (the rivals) don't play by any of that: each eats at a pace that only goes up
// (pace), with a little give from cookie to cookie. You're out once either of them has eaten more
// cookies than you, so there's no top score: the pace keeps climbing until it catches everyone.
// A player marked ai is played by the computer, for the tests: it bites `react` ticks after there's
// room (or `early` of a mouthful before, risking a choke), drinks when it's getting dry and pushes
// burnt cookies away.
//
//   COOKIES.KINDS    // the cookies on Jenn's plate: bites each, how much of a mouthful a bite is,
//                    // how much it dries you out and how quick it is to chew
//   COOKIES.VERSION  // a fingerprint of this file
window.COOKIES = (function engine() {
  const READY = 150; // ticks of "Ready... set..." before the first bite
  const CHEW = 0.0125; // a mouthful chewed a tick, with a full mouth, dry as can be is less
  const SLOW = 0.3; // how fast an almost empty mouth still chews, next to a full one
  const DRY = 0.6; // how much a dry mouth slows the chewing, all the way dry
  const COUGH = 80, CRUNCH = 110; // ticks of coughing after a bite with no room, and into a burnt cookie
  const SPLUTTER = 0.15; // how much of a mouthful a choke sprays across the table
  const BITE = 10; // ticks a bite takes, when another press does nothing
  const GULP = 30; // ticks a gulp of milk takes (chewing carries on, but no biting)
  const MILK = 3, REFILL = 330; // gulps in a full glass, and ticks between Jenn's top-ups
  const PUSH = 12, NEXT = 18; // ticks to push a cookie away, and for the next one to land in your hand
  const BURNT_FROM = 3, BURNT = 0.14; // cookies you've had before a burnt one can turn up, and how often
  const KINDS = {
    chip: { name: 'Chocolate chip', bites: 4, size: 0.36, dry: 0.07, chew: 1, often: 5 },
    oat: { name: 'Oatmeal raisin', bites: 4, size: 0.36, dry: 0.04, chew: 0.75, often: 3 },
    short: { name: 'Shortbread', bites: 3, size: 0.42, dry: 0.13, chew: 1.15, often: 3 },
    snap: { name: 'Gingersnap', bites: 3, size: 0.3, dry: 0.1, chew: 0.9, often: 3 },
    // (worth two, and never one of the first few)
    giant: { name: 'Giant cookie', bites: 7, size: 0.45, dry: 0.08, chew: 1, often: 1, counts: 2 },
    // (one of Nik's or Dmitriy's: never off Jenn's plate, and it stays the kind in your hand until
    // the next one comes, as it's pushed away)
    burnt: { name: 'Burnt cookie', bites: 1, size: 0.36, dry: 0, chew: 1, often: 0 },
  };
  const KIND_IDS = Object.keys(KINDS).filter((k) => KINDS[k].often > 0);
  // Nik's and Dmitriy's pace: cookies a second to start with, and how much quicker each second.
  // Nik starts quicker and Dmitriy speeds up more, so Dmitriy comes past him a while in.
  const RIVALS = [{ name: 'Nik', pace: 0.16, faster: 0.0036 }, { name: 'Dmitriy', pace: 0.12, faster: 0.0042 }];
  const RIVAL_BITES = 4; // (how many bites a rival's cookie looks like it takes)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // seeded random numbers, carrying on from o.s (which a saved game keeps)
  function rng(o) {
    return () => {
      const s = o.s = (o.s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const seeded = { s: (opts.seed >>> 0) || 1 };
    const rand = rng(seeded);
    const g = { t: 0, phase: 'ready', events: [] };
    const say = (e) => g.events.push(e);
    // the next cookie off Jenn's plate, once you've had `had`
    function pickKind(had) {
      const ids = KIND_IDS.filter((k) => had >= BURNT_FROM || !KINDS[k].counts);
      let r = rand() * ids.reduce((n, k) => n + KINDS[k].often, 0);
      for (const k of ids) if ((r -= KINDS[k].often) < 0) return k;
      return ids[0];
    }
    // A cookie lands in player p's hand: mostly Jenn's, but now and then a burnt one of Nik's or
    // Dmitriy's (never two in a row).
    function serve(p, i) {
      const had = p.eaten + p.pushed;
      if (had >= BURNT_FROM && p.kind !== 'burnt' && rand() < BURNT) {
        Object.assign(p, { kind: 'burnt', left: 1, burnt: true, by: rand() < 0.5 ? 0 : 1 });
        say({ e: 'slip', p: i, by: p.by });
        return;
      }
      p.kind = pickKind(had); p.left = KINDS[p.kind].bites; p.burnt = false;
    }
    g.players = opts.players.map((o) => ({
      name: o.name, ai: !!o.ai, react: o.react || 0, early: o.early || 0,
      eaten: 0, pushed: 0, kind: 'chip', left: KINDS.chip.bites, burnt: false, by: 0,
      mouth: 0, dry: 0, chew: 1, milk: MILK, refill: 0,
      // ticks left of: a bite, a coughing fit, a gulp, pushing a cookie away, waiting for the next
      bite: 0, cough: 0, gulp: 0, push: 0, next: 0,
      wait: 0, // (ai: ticks it's been ready to bite)
      out: false, outAt: 0, outBy: 0,
    }));
    g.rivals = RIVALS.map((r) => ({ name: r.name, eaten: 0, kind: 'chip', prog: 0, len: 1 }));
    // a rival's next cookie: how long it'll take them at their pace now, give or take
    function rivalServe(r, i) {
      r.kind = pickKind(0);
      r.prog = 0;
      r.len = Math.round(60 / g.pace(i) * (0.9 + rand() * 0.2));
    }
    g.pace = (i) => RIVALS[i].pace + RIVALS[i].faster * Math.max(0, g.t - READY) / 60;
    g.rivals.forEach(rivalServe);

    const busy = (p) => p.bite || p.cough || p.gulp || p.push || p.next;
    g.room = (p) => p.mouth + KINDS[p.kind].size <= 1 + 1e-9;
    // whatever's in their hand goes (eaten or pushed away), and the next one comes after a moment
    const finish = (p, ticks) => { p.next = ticks; };

    function bite(p, i) {
      if (p.bite || p.cough || p.gulp || p.push || p.next) return;
      if (p.burnt) {
        // hard as a rock: a coughing fit, and Jenn takes it off you
        p.cough = CRUNCH; p.pushed++; p.burnt = false;
        say({ e: 'crunch', p: i, by: p.by });
        finish(p, NEXT);
        return;
      }
      const k = KINDS[p.kind];
      // (no room: you choke, and splutter a little of what's in there out)
      if (!g.room(p)) { p.cough = COUGH; p.mouth = Math.max(0, p.mouth - SPLUTTER); say({ e: 'choke', p: i }); return; }
      p.mouth += k.size; p.dry = clamp(p.dry + k.dry, 0, 1); p.chew = k.chew; p.bite = BITE;
      say({ e: 'bite', p: i, kind: p.kind });
      if (--p.left <= 0) {
        p.eaten += k.counts || 1;
        say({ e: 'ate', p: i, kind: p.kind, n: p.eaten });
        finish(p, NEXT);
      }
    }
    function drink(p, i) {
      if (busy(p)) return;
      if (p.milk < 1) { say({ e: 'nomilk', p: i }); return; }
      p.milk--; p.gulp = GULP;
      say({ e: 'gulp', p: i });
    }
    function push(p, i) {
      if (busy(p)) return;
      if (p.burnt) { say({ e: 'push', p: i, by: p.by }); p.burnt = false; }
      else say({ e: 'waste', p: i, kind: p.kind });
      p.pushed++; p.push = PUSH;
    }
    // the computer playing someone: bite once there's room (react ticks after, or a little before
    // if it's `early`), drink when it's getting dry, push the burnt ones away
    function aiInput(p) {
      if (busy(p)) { p.wait = 0; return {}; }
      if (p.burnt) return ++p.wait > p.react ? { push: true } : {};
      if (p.dry > 0.55 && p.milk >= 1) return { drink: true };
      if (p.mouth + KINDS[p.kind].size <= 1 + p.early) return ++p.wait > p.react ? { bite: true } : {};
      p.wait = 0;
      return {};
    }

    g.step = function (inputs) {
      g.events = [];
      g.t++;
      if (g.phase === 'over') return;
      if (g.phase === 'ready') {
        if (g.t >= READY) { g.phase = 'play'; say({ e: 'go' }); }
        return;
      }
      // Nik and Dmitriy, at their pace
      g.rivals.forEach((r, i) => {
        if (++r.prog < r.len) return;
        r.eaten++;
        say({ e: 'rival', r: i, n: r.eaten });
        rivalServe(r, i);
      });
      g.players.forEach((p, i) => {
        if (p.out) return;
        const inp = p.ai ? aiInput(p) : (inputs && inputs[i]) || {};
        if (inp.push) push(p, i);
        else if (inp.drink) drink(p, i);
        else if (inp.bite) bite(p, i);
        // chewing (not while you cough), quicker with a full mouth and slower when it's dry
        if (!p.cough && p.mouth > 0) p.mouth = Math.max(0, p.mouth - CHEW * p.chew * (SLOW + (1 - SLOW) * p.mouth) * (1 - DRY * p.dry));
        if (p.gulp) { p.dry = Math.max(0, p.dry - 1 / GULP); p.gulp--; }
        if (p.bite) p.bite--;
        if (p.cough) p.cough--;
        if (p.push && !--p.push) finish(p, NEXT);
        if (p.next && !--p.next) serve(p, i);
        // Jenn and the jug
        if (p.milk < MILK) { if (++p.refill >= REFILL) { p.refill = 0; p.milk++; say({ e: 'refill', p: i }); } }
        else p.refill = 0;
        // out, once either of them has had more than you
        const ahead = g.rivals.findIndex((r) => r.eaten > p.eaten);
        if (ahead >= 0) { Object.assign(p, { out: true, outAt: g.t, outBy: ahead }); say({ e: 'out', p: i, by: ahead }); }
      });
      if (g.players.every((p) => p.out)) g.phase = 'over';
    };
    g.over = () => g.phase === 'over';
    g.save = () => JSON.parse(JSON.stringify({ t: g.t, phase: g.phase, s: seeded.s, players: g.players, rivals: g.rivals }));
    g.load = (d) => {
      g.t = d.t; g.phase = d.phase; seeded.s = d.s;
      d.players.forEach((p, i) => Object.assign(g.players[i], p));
      d.rivals.forEach((r, i) => Object.assign(g.rivals[i], r));
    };
    return g;
  }

  // a fingerprint of this file's rules, the same in every copy that has the same rules
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '')) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return { create, KINDS, RIVALS, RIVAL_BITES, READY, BITE, GULP, MILK, REFILL, PUSH, NEXT, VERSION };
})();
