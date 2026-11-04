// The card game's rules, and how the computer plays it. Nothing in here draws or reads keys (js/game.js
// does that), so the game server runs this as it is for a live game, and the tests and
// tools/card_balance.mjs play it with no browser. The cards themselves are in js/cardlist.js.
//
//   const g = CARDS.create({ decks: [ids, ids], seed, names, ai: [0, 3], turn, first })
//                    // turn: ticks each player gets for a turn (0 or left out: as long as they like).
//                    // ai: how good the computer is at each seat, 1 to 4 (0: somebody's playing it).
//                    // first: who goes first, instead of tossing a coin
//   g.act(seat, a)   // what a player does, true if it was allowed. Anything can come in here, and
//                    // whatever isn't a legal move just does nothing:
//                    //   { do: 'swap', cards: [u, u] }      the cards to swap at the start
//                    //   { do: 'play', card: u, target: u } a card from your hand
//                    //   { do: 'attack', from: u, target: u }
//                    //   { do: 'end' }, { do: 'resign' }
//   g.step()         // one tick (a 60th of a second): the clock, and the computer's moves
//   g.legal(seat)    // every move seat can make right now
//   g.choose(seat, level) // the move the computer would make
//   g.view(seat)     // what seat can see, and only that. It's all a screen needs, and all the server
//                    // sends: the other player's hand and both decks are just counts
//   g.save(), g.load(saved) // the whole game as plain JSON, and back
//   g.events         // everything that's happened, oldest first (the last EVENTS of it), for the
//                    // animations. view(seat) has them too, without what seat can't know
//   g.result         // null, or { w: the seat that won (-1 for a draw), why }
//
// Every card in the game has its own number, u. The players are 0 and 1, so a target is always a
// number: a worker's u, or a player's seat. A worker in a game looks like:
//   { u, id, pw: Power, pa: Patience, max: most Patience, gate, skin, left: attacks left this turn,
//     frozen: can't attack on its next turn, stuck: can't attack this turn }
//
//   CARDS.LIST, CARDS.card(id), CARDS.text(card) (the words on it, with *rule words* marked)
//   CARDS.deckProblem(ids)     // why that's not a legal deck, or null if it is
//   CARDS.buildDeck(owned, { dept, must, seed }) // a good deck from the cards you have
//   CARDS.STARTER              // the ids everybody has
//   CARDS.check()              // anything wrong with js/cardlist.js, as a list of what
//   CARDS.VERSION              // a fingerprint of the rules and the cards, so a browser can tell
//                              // whether the server has the same ones
window.CARDS = (function engine() {
  const LIST = window.CARD_LIST || [];
  const CARD = new Map(LIST.map((c) => [c.id, c])); // (a Map: ids can come from anybody)
  const MORALE = 20, DECK = 20, CUPS = 8, MOST_COFFEE = 10, TABLE = 5, HAND = 7, OPENING = 3;
  const SWAP_TICKS = 30 * 60; // how long you get to choose what to swap, in a game with a clock
  const THINK = 50; // ticks the computer takes over each move
  const STRIKES = 3; // turns in a row you can run out of time before you lose
  const LONGEST = 200; // turns before it's called a draw (nothing should ever get near this)
  const EVENTS = 120; // how many events are kept
  const PICKS = new Set(['worker', 'enemy', 'ally', 'any']);
  const AUTO = new Set(['self', 'enemies', 'others', 'allies', 'all', 'them', 'you', 'random']);
  const DOES = new Set(['hit', 'heal', 'draw', 'coffee', 'boost', 'summon', 'home', 'back', 'freeze', 'give']);
  const WHENS = new Set(['play', 'morning', 'last']);
  const DEPTS = { plant: 'Plant', road: 'Road', office: 'Office', lunch: 'Lunch Room' };
  const WORDS = { gate: 'Gatekeeper', keen: 'Keen', skin: 'Thick Skin' };
  // What the special words mean, for saying under a card. Each is short, so that a few of them fit.
  const MEANS = {
    gate: 'Gatekeeper: has to be attacked first.',
    keen: 'Keen: can attack the turn it\'s played.',
    skin: 'Thick Skin: ignores the first hit.',
    play: 'On play: happens when you play it.',
    morning: 'Every morning: when your turn starts.',
    last: 'Last word: happens when it goes home.',
    team: 'Team-up: only with that department on the table.',
  };
  const RARITIES = new Set(['S', 'C', 'U', 'R', 'L', 'T']);

  // ---------- the words on a card ----------
  function whatItDoes(e) {
    const n = e.n, name = e.id && CARD.get(e.id) ? CARD.get(e.id) : null;
    const dept = e.dept ? DEPTS[e.dept] + ' ' : '';
    const stats = () => [e.p ? (e.p > 0 ? '+' : '') + e.p + ' Power' : '', e.h ? (e.h > 0 ? '+' : '') + e.h + ' Patience' : ''].filter(Boolean).join(' and ');
    const worker = { worker: 'a worker', enemy: 'an enemy worker', ally: 'another worker', random: 'a random enemy worker' };
    const those = { enemies: 'all enemy workers', others: 'your other ' + dept + 'workers', allies: 'all your ' + dept + 'workers', all: 'every worker' };
    switch (e.do) {
      case 'hit':
        if (e.who === 'them') return 'the other player loses ' + n + ' Morale';
        if (e.who === 'you') return 'you lose ' + n + ' Morale';
        if (e.who === 'any') return n + ' damage to anyone';
        return n + ' damage to ' + (worker[e.who] || those[e.who]);
      case 'heal':
        if (e.who === 'you') return '+' + n + ' Morale';
        return 'restore ' + n + ' Patience to ' + (worker[e.who] || those[e.who]);
      case 'draw': return n === 1 ? 'draw a card' : 'draw ' + n + ' cards';
      case 'coffee': return '+' + n + ' coffee this turn';
      case 'boost':
        if (e.who === 'self') return stats();
        return (worker[e.who] ? 'give ' + worker[e.who] + ' ' : those[e.who] + ' get ') + stats();
      case 'summon':
        return n === 1 ? 'bring in a ' + name.name : 'bring in ' + n + ' ' + (name.plural || name.name + 's');
      case 'home':
        if (e.who === 'all') return 'everyone on both sides goes home';
        return 'send ' + (worker[e.who] || those[e.who]) + ' home';
      case 'back':
        if (e.who === 'self') return 'come back to your hand';
        return 'send ' + (worker[e.who] || those[e.who]) + ' back to their hand';
      case 'freeze': {
        const who = worker[e.who] || those[e.who];
        return who + ' can\'t attack next turn';
      }
      case 'give': return 'give ' + (worker[e.who] || those[e.who]) + ' ' + WORDS[e.word];
      default: return '';
    }
  }
  const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // What a card says: the words are marked *like this*, for a colour of their own.
  function text(card) {
    const bits = (card.words || []).map((w) => '*' + WORDS[w] + '.*');
    let last = null;
    for (const e of card.does || []) {
      const when = e.when || 'play', label = e.team ? 'Team-up ' + DEPTS[e.team] : when === 'morning' ? 'Every morning' : when === 'last' ? 'Last word' : card.kind === 'task' ? '' : 'On play';
      const said = whatItDoes(e);
      if (label && label !== last) { bits.push('*' + label + ':*', said + '.'); } else bits.push((label ? said : upper(said)) + '.');
      last = label;
    }
    return bits.join(' ');
  }
  // Which of those a card needs explaining: any word its text uses, in the order it uses them.
  function meanings(card) {
    const out = [...(card.words || [])];
    const add = (k) => { if (!out.includes(k)) out.push(k); };
    for (const e of card.does || []) {
      const when = e.when || 'play';
      if (e.team) add('team');
      else if (when === 'morning' || when === 'last') add(when);
      else if (card.kind !== 'task') add('play');
      if (e.do === 'give') add(e.word);
    }
    return out;
  }
  // the same splitting into lines as the card itself (see wrap in js/cardart.js)
  function lines(str, width) {
    const out = [];
    let len = 0, n = 0;
    for (const word of str.split(' ')) {
      const size = word.replace(/\*/g, '').length;
      if (n && len + 1 + size > width) { out.push(len); len = 0; n = 0; }
      len += (n ? 1 : 0) + size; n++;
    }
    if (n) out.push(len);
    return out;
  }

  // ---------- anything wrong with the list ----------
  function check() {
    const bad = [], seen = new Set(), say = (c, what) => bad.push(c.id + ': ' + what);
    const named = (x) => x === undefined || DEPTS[x] !== undefined && Object.keys(DEPTS).includes(x);
    for (const c of LIST) {
      if (seen.has(c.id)) say(c, 'there are two cards with this id');
      seen.add(c.id);
      if (!/^[a-z0-9]{1,14}$/.test(c.id)) say(c, 'an id is lower case letters and numbers, 14 at most, so it fits in the database');
      if (typeof c.name !== 'string' || c.name.length > 16) say(c, 'a name is 16 letters at most, or it runs off the card');
      if (!RARITIES.has(c.rarity)) say(c, 'no such rarity as ' + c.rarity);
      if (!named(c.dept)) say(c, 'no such department as ' + c.dept);
      if (!Number.isInteger(c.cost) || c.cost < 0 || c.cost > 10) say(c, 'its cost should be 0 to 10');
      if (c.kind !== undefined && c.kind !== 'task') say(c, 'kind is task or left out');
      if (c.kind === 'task') {
        if (c.power !== undefined || c.patience !== undefined || c.words) say(c, 'a task has no Power, Patience or words');
        if (!c.does || !c.does.length) say(c, 'a task has to do something');
      } else {
        if (!Number.isInteger(c.power) || c.power < 0) say(c, 'a worker needs its Power');
        if (!Number.isInteger(c.patience) || c.patience < 1) say(c, 'a worker needs at least 1 Patience');
      }
      for (const w of c.words || []) if (!WORDS[w]) say(c, 'no such word as ' + w);
      let picks = 0;
      for (const e of c.does || []) {
        if (!DOES.has(e.do)) say(c, 'no such thing to do as ' + e.do);
        if (e.when !== undefined && !WHENS.has(e.when)) say(c, 'no such time as ' + e.when);
        if (!named(e.team)) say(c, 'no such department to team up with as ' + e.team);
        if (e.team && (e.when || 'play') !== 'play') say(c, 'a Team-up can only be when it\'s played');
        if (!named(e.dept)) say(c, 'no such department as ' + e.dept);
        if (e.do === 'summon') {
          const t = CARD.get(e.id);
          if (!t || t.kind === 'task') say(c, 'it brings in ' + e.id + ', which isn\'t a worker');
        } else if (e.do !== 'draw' && e.do !== 'coffee') {
          if (!PICKS.has(e.who) && !AUTO.has(e.who)) say(c, 'no such who as ' + e.who);
          if (PICKS.has(e.who)) {
            picks++;
            if (e.when && e.when !== 'play') say(c, 'only On play can ask you to pick');
          }
        }
        if (['hit', 'heal', 'draw', 'coffee', 'summon'].includes(e.do) && !(Number.isInteger(e.n) && e.n > 0)) say(c, e.do + ' needs n');
        if (e.do === 'boost' && !e.p && !e.h) say(c, 'boost needs p or h');
        if (e.do === 'give' && !WORDS[e.word]) say(c, 'no such word to give as ' + e.word);
        if (e.do === 'back' && e.who === 'self' && e.when !== 'last') say(c, 'only a last word can bring itself back');
      }
      if (picks > 1) say(c, 'a card can only ask you to pick once');
      const rule = lines(text(c).replace(/\*/g, ''), 18), said = c.said ? lines(c.said, 18) : [];
      if (rule.some((w) => w > 18)) say(c, 'a word in its text is too long for a line');
      if (rule.length + said.length > 5) say(c, 'its words take ' + (rule.length + said.length) + ' lines and only 5 fit on the card');
      const under = meanings(c).reduce((n, k) => n + lines(MEANS[k], 20).length, 0);
      if (under > 6) say(c, 'explaining its words takes ' + under + ' lines and only 6 fit under the card');
    }
    if (LIST.filter((c) => c.rarity === 'S').length !== DECK) bad.push('there should be exactly ' + DECK + ' starters, so everybody can make a deck from the start');
    return bad;
  }
  const collectable = (c) => c && c.rarity !== 'T';
  const STARTER = LIST.filter((c) => c.rarity === 'S').map((c) => c.id);
  function deckProblem(ids) {
    if (!Array.isArray(ids) || ids.length !== DECK) return 'A deck is exactly ' + DECK + ' cards.';
    const seen = new Set();
    let legends = 0;
    for (const id of ids) {
      if (typeof id !== 'string' || !collectable(CARD.get(id))) return 'There\'s no such card as ' + String(id).slice(0, 20) + '.';
      if (seen.has(id)) return 'A deck can only have one of each card.';
      seen.add(id);
      if (CARD.get(id).rarity === 'L') legends++;
    }
    if (legends > 1) return 'A deck can only have one legendary.';
    return null;
  }
  const seededRand = (o) => () => {
    const s = o.s = (o.s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // How good a card is for its coffee, roughly, for building a deck.
  function rough(c) {
    let v = c.rarity === 'L' ? 6 : c.rarity === 'R' ? 3 : c.rarity === 'U' ? 2 : c.rarity === 'C' ? 1 : 0;
    if (c.kind !== 'task') v += (c.power + c.patience - c.cost * 2 - 1) * 0.7;
    return v + (c.words || []).length * 0.8 + (c.does || []).length * 1.2;
  }
  // The best deck you can make from what you have, aiming for plenty of cheap cards and a few big
  // ones. dept: lean that way. must: these go in whatever happens (a coworker's own card, say).
  function buildDeck(owned, o = {}) {
    const state = { s: (o.seed || 1) >>> 0 }, rand = seededRand(state);
    const pool = [...new Set(STARTER.concat((owned || []).filter((id) => collectable(CARD.get(id)))))];
    const score = (id) => {
      const c = CARD.get(id);
      let v = rough(c) + rand() * (o.wild === undefined ? 1 : o.wild);
      if (o.dept) v += c.dept === o.dept ? 4 : c.dept ? -3 : 0;
      return v;
    };
    const ranked = pool.map((id) => [score(id), id]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    const deck = [], want = { low: 8, mid: 8, high: 4 };
    let legend = false;
    const band = (c) => (c.cost <= 2 ? 'low' : c.cost <= 4 ? 'mid' : 'high');
    const take = (id) => {
      const c = CARD.get(id);
      if (deck.includes(id) || deck.length >= DECK || (c.rarity === 'L' && legend)) return false;
      deck.push(id);
      want[band(c)]--;
      if (c.rarity === 'L') legend = true;
      return true;
    };
    for (const id of o.must || []) if (collectable(CARD.get(id))) take(id);
    for (const id of ranked) if (want[band(CARD.get(id))] > 0) take(id);
    for (const id of ranked) take(id);
    return deck;
  }

  // ---------- a game ----------
  function create(o = {}) {
    const g = { events: [], result: null };
    let st = {
      ph: 'swap', turn: 0, n: 0, clock: 0, turnTicks: o.turn || 0, wait: THINK, next: 2, first: 0, r: null, s: (o.seed || 1) >>> 0, count: 0, log: [],
      p: [0, 1].map((seat) => ({
        name: String((o.names || [])[seat] || 'Player ' + (seat + 1)).slice(0, 12), ai: (o.ai || [])[seat] || 0,
        morale: MORALE, cups: 0, coffee: 0, burn: 0, swapped: false, strikes: 0, deck: [], hand: [], table: [],
      })),
    };
    const rand = () => seededRand(st)();
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const log = (e) => {
      if (st.quiet) return;
      st.log.push(Object.assign({ i: st.count++ }, e));
      if (st.log.length > EVENTS) st.log.shift();
    };
    const finish = (w, why) => {
      if (st.r) return;
      st.r = { w, why };
      st.ph = 'over';
      log({ e: 'over', w, why });
    };
    const unit = (u) => {
      for (const q of st.p) for (const x of q.table) if (x.u === u) return x;
      return null;
    };
    const ownerOf = (u) => (st.p[0].table.some((x) => x.u === u) ? 0 : 1);

    function draw(seat, n = 1) {
      const me = st.p[seat];
      for (let k = 0; k < n; k++) {
        if (!me.deck.length) { // nothing left: it starts to wear you down
          me.burn++;
          me.morale -= me.burn;
          log({ e: 'burnout', s: seat, n: me.burn });
          continue;
        }
        const id = me.deck.pop();
        if (me.hand.length >= HAND) { log({ e: 'lost', s: seat, id }); continue; }
        const u = st.next++;
        me.hand.push({ u, id });
        log({ e: 'draw', s: seat, u, id });
      }
    }
    function newUnit(id, seat) {
      const c = CARD.get(id), words = c.words || [];
      return { u: st.next++, id, pw: c.power, pa: c.patience, max: c.patience, gate: words.includes('gate'), skin: words.includes('skin'), left: words.includes('keen') ? 1 : 0, frozen: 0, stuck: false, seat };
    }
    function hurt(u, n) {
      if (n <= 0) return;
      if (u === 0 || u === 1) { st.p[u].morale -= n; log({ e: 'hit', u, n }); return; }
      const x = unit(u);
      if (!x) return;
      if (x.skin) { x.skin = false; log({ e: 'skin', u }); return; }
      x.pa -= n;
      log({ e: 'hit', u, n });
    }
    function toHand(seat, id) {
      const me = st.p[seat];
      if (me.hand.length >= HAND) return false;
      const u = st.next++;
      me.hand.push({ u, id });
      log({ e: 'tohand', s: seat, u, id });
      return true;
    }
    const teamUp = (e, seat, self) => !e.team || st.p[seat].table.some((x) => x.u !== self && CARD.get(x.id).dept === e.team);
    const whenOf = (e) => e.when || 'play';
    // Who an effect lands on: a list of workers' numbers (or a player's seat).
    function aim(e, seat, self, target) {
      const mine = st.p[seat].table, theirs = st.p[1 - seat].table, u = self ? self.u : -1;
      const of = (list) => (e.dept ? list.filter((x) => CARD.get(x.id).dept === e.dept) : list).map((x) => x.u);
      switch (e.who) {
        case 'self': return self ? [self.u] : [];
        case 'enemies': return of(theirs);
        case 'others': return of(mine.filter((x) => x.u !== u));
        case 'allies': return of(mine);
        case 'all': return of(mine.concat(theirs));
        case 'them': return [1 - seat];
        case 'you': return [seat];
        case 'random': {
          const alive = theirs.filter((x) => x.pa > 0);
          return alive.length ? [alive[Math.floor(rand() * alive.length)].u] : [];
        }
        default: return target === null || target === undefined ? [] : [target]; // (someone they picked)
      }
    }
    function run(e, seat, self, target) {
      const me = st.p[seat], who = aim(e, seat, self, target);
      switch (e.do) {
        case 'hit': for (const u of who) hurt(u, e.n); break;
        case 'heal':
          for (const u of who) {
            if (u === 0 || u === 1) { // (Morale has no top: you only start at 20)
              st.p[u].morale += e.n;
              log({ e: 'heal', u, n: e.n });
            } else {
              const x = unit(u), gain = x ? Math.min(e.n, x.max - x.pa) : 0;
              if (gain > 0) { x.pa += gain; log({ e: 'heal', u, n: gain }); }
            }
          }
          break;
        case 'draw': draw(seat, e.n); break;
        case 'coffee': {
          me.coffee = Math.min(MOST_COFFEE, me.coffee + e.n);
          log({ e: 'coffee', s: seat, n: e.n });
          break;
        }
        case 'boost':
          for (const u of who) {
            const x = unit(u);
            if (!x) continue;
            if (e.p) x.pw = Math.max(0, x.pw + e.p);
            if (e.h) { x.pa += e.h; x.max = Math.max(1, x.max + e.h); }
            log({ e: 'boost', u, p: e.p || 0, h: e.h || 0 });
          }
          break;
        case 'summon':
          for (let k = 0; k < e.n && me.table.length < TABLE; k++) {
            const x = newUnit(e.id, seat);
            me.table.push(x);
            log({ e: 'summon', s: seat, u: x.u, id: x.id });
          }
          break;
        case 'home':
          for (const u of who) { const x = unit(u); if (x) x.pa = 0; }
          break;
        case 'back':
          if (e.who === 'self') { if (self) toHand(seat, self.id); break; }
          for (const u of who) {
            const x = unit(u);
            if (!x) continue;
            const owner = ownerOf(u), t = st.p[owner].table;
            if (st.p[owner].hand.length >= HAND) { x.pa = 0; continue; } // (no room: they go home instead)
            t.splice(t.indexOf(x), 1);
            log({ e: 'sentback', u, id: x.id, s: owner });
            toHand(owner, x.id);
          }
          break;
        case 'freeze':
          for (const u of who) { const x = unit(u); if (x) { x.frozen = 1; log({ e: 'freeze', u }); } }
          break;
        case 'give':
          for (const u of who) {
            const x = unit(u);
            if (!x) continue;
            if (e.word === 'gate') x.gate = true;
            else if (e.word === 'skin') x.skin = true;
            else if (e.word === 'keen' && x.left === 0) x.left = 1;
            log({ e: 'give', u, word: e.word });
          }
          break;
        default: break;
      }
    }
    // Everyone out of Patience goes home, starting with whoever's turn it is, and has their last word
    // (which might send more people home). Then see if anybody's lost.
    function settle() {
      for (let guard = 0; guard < 64; guard++) {
        let any = false;
        for (const seat of [st.turn, 1 - st.turn]) {
          const me = st.p[seat];
          for (let i = 0; i < me.table.length; i++) {
            if (me.table[i].pa > 0) continue;
            const x = me.table.splice(i, 1)[0];
            i--; any = true;
            log({ e: 'home', u: x.u, id: x.id, s: seat });
            for (const e of CARD.get(x.id).does || []) if (whenOf(e) === 'last') run(e, seat, x, null);
          }
        }
        if (!any) break;
      }
      const a = st.p[0].morale <= 0, b = st.p[1].morale <= 0;
      if (a || b) finish(a && b ? -1 : a ? 1 : 0, 'morale');
    }
    function morning(seat) {
      st.turn = seat;
      st.n++;
      if (st.n > LONGEST) { finish(-1, 'long'); return; }
      const me = st.p[seat];
      me.cups = Math.min(CUPS, me.cups + 1);
      me.coffee = me.cups;
      for (const x of me.table) { x.left = 1; x.stuck = x.frozen > 0; x.frozen = 0; }
      st.clock = st.turnTicks;
      st.wait = THINK;
      log({ e: 'turn', s: seat, n: st.n });
      draw(seat);
      settle();
      if (st.r) return;
      for (const x of me.table.slice()) {
        if (x.pa <= 0) continue;
        for (const e of CARD.get(x.id).does || []) if (whenOf(e) === 'morning') run(e, seat, x, null);
      }
      settle();
    }
    function endTurn() {
      for (const x of st.p[st.turn].table) x.stuck = false;
      morning(1 - st.turn);
    }
    function beginPlay() {
      // going second: one more card, and a Double Shot to catch up with
      const second = 1 - st.first;
      draw(second);
      toHand(second, 'doubleshot');
      morning(st.first);
    }
    function swap(seat, cards) {
      const me = st.p[seat];
      if (me.swapped) return false;
      const going = me.hand.filter((c) => Array.isArray(cards) && cards.includes(c.u));
      me.hand = me.hand.filter((c) => !going.includes(c));
      for (const c of going) me.deck.push(c.id);
      shuffle(me.deck);
      me.swapped = true;
      log({ e: 'swap', s: seat, n: going.length });
      draw(seat, going.length);
      if (st.p[0].swapped && st.p[1].swapped) { st.ph = 'play'; beginPlay(); }
      return true;
    }
    // who a card in your hand could be aimed at: a list, or null if it doesn't ask
    function picksFor(seat, c) {
      for (const e of c.does || []) {
        if (whenOf(e) !== 'play' || !PICKS.has(e.who) || !teamUp(e, seat, -1)) continue;
        const mine = st.p[seat].table.map((x) => x.u), theirs = st.p[1 - seat].table.map((x) => x.u);
        if (e.who === 'enemy') return theirs;
        if (e.who === 'ally') return mine;
        if (e.who === 'any') return mine.concat(theirs, [0, 1]);
        return mine.concat(theirs);
      }
      return null;
    }
    const canPlay = (seat, c) => c.cost <= st.p[seat].coffee && (c.kind === 'task' || st.p[seat].table.length < TABLE);
    function playCard(seat, a) {
      const me = st.p[seat], at = me.hand.findIndex((h) => h.u === a.card);
      if (at < 0) return false;
      const c = CARD.get(me.hand[at].id);
      if (!canPlay(seat, c)) return false;
      const picks = picksFor(seat, c);
      let target = null;
      if (picks) {
        if (picks.length) {
          if (!picks.includes(a.target)) return false;
          target = a.target;
        } else if (c.kind === 'task') return false; // (a task with nobody to aim at does nothing, so it stays in your hand)
      }
      me.hand.splice(at, 1);
      me.coffee -= c.cost;
      let self = null;
      if (c.kind !== 'task') {
        self = newUnit(c.id, seat);
        me.table.push(self);
      }
      log({ e: 'play', s: seat, id: c.id, u: self ? self.u : a.card, card: a.card, target });
      for (const e of c.does || []) {
        if (whenOf(e) === 'play' && teamUp(e, seat, self ? self.u : -1)) run(e, seat, self, target);
      }
      settle();
      return true;
    }
    function attackTargets(seat) {
      const theirs = st.p[1 - seat].table, gates = theirs.filter((x) => x.gate);
      return gates.length ? gates.map((x) => x.u) : theirs.map((x) => x.u).concat([1 - seat]);
    }
    const canAttack = (x) => x.left > 0 && !x.stuck && x.pw > 0 && x.pa > 0;
    function attack(seat, a) {
      const x = st.p[seat].table.find((y) => y.u === a.from);
      if (!x || !canAttack(x) || !attackTargets(seat).includes(a.target)) return false;
      x.left--;
      log({ e: 'attack', u: x.u, t: a.target });
      const other = a.target === 0 || a.target === 1 ? null : unit(a.target);
      hurt(a.target, x.pw);
      if (other) hurt(x.u, other.pw);
      settle();
      return true;
    }
    // the move itself, once it's known who's asking and that they can
    function apply(seat, a) {
      if (a.do === 'play') return playCard(seat, a);
      if (a.do === 'attack') return attack(seat, a);
      if (a.do === 'end') { endTurn(); return true; }
      return false;
    }
    g.act = (seat, a) => {
      if ((seat !== 0 && seat !== 1) || !a || typeof a !== 'object' || st.r) return false;
      if (a.do === 'resign') { finish(1 - seat, 'resign'); g.sync(); return true; }
      let ok = false;
      if (st.ph === 'swap') { if (a.do === 'swap') ok = swap(seat, a.cards); } else if (st.ph === 'play' && st.turn === seat) ok = apply(seat, a);
      if (ok) st.p[seat].strikes = 0;
      g.sync();
      return ok;
    };
    g.sync = () => { g.events = st.log; g.result = st.r; };
    g.legal = (seat) => {
      if (st.r) return [];
      if (st.ph === 'swap') return st.p[seat].swapped ? [] : [{ do: 'swap', cards: [] }];
      if (st.turn !== seat) return [];
      const out = [], me = st.p[seat];
      for (const h of me.hand) {
        const c = CARD.get(h.id);
        if (!canPlay(seat, c)) continue;
        const picks = picksFor(seat, c);
        if (picks && picks.length) for (const target of picks) out.push({ do: 'play', card: h.u, target });
        else if (!picks || c.kind !== 'task') out.push({ do: 'play', card: h.u });
      }
      const targets = attackTargets(seat);
      for (const x of me.table) if (canAttack(x)) for (const target of targets) out.push({ do: 'attack', from: x.u, target });
      out.push({ do: 'end' });
      return out;
    };

    // ---------- how the computer plays ----------
    // How well seat's doing. It only looks at what's on the table, the Morale and how many cards there
    // are, never at what's in the other hand or either deck.
    function worth(x) {
      const c = CARD.get(x.id);
      let v = x.pw * 1.2 + x.pa * 0.8;
      if (x.gate) v += 1;
      if (x.skin) v += x.pw * 0.4 + 0.8;
      if (x.frozen || x.stuck) v -= x.pw * 0.5;
      for (const e of c.does || []) {
        if (e.when === 'morning') v += 2.5;
        if (e.when === 'last') v += 1;
      }
      return v;
    }
    const moraleWorth = (m) => m + (m < 10 ? (m - 10) * 0.6 : 0);
    function value(seat) {
      const me = st.p[seat], them = st.p[1 - seat];
      if (them.morale <= 0 && me.morale > 0) return 1e6;
      if (me.morale <= 0) return -1e6;
      let v = moraleWorth(me.morale) - moraleWorth(them.morale);
      v += me.hand.length * 0.9 - them.hand.length * 0.9;
      for (const x of me.table) v += worth(x);
      for (const x of them.table) v -= worth(x);
      // more coffee only counts if it lets you play something you couldn't otherwise
      let reach = 0;
      for (const h of me.hand) { const c = CARD.get(h.id); if (c.cost > 0 && c.cost <= me.coffee && c.cost > reach) reach = c.cost; }
      return v + reach * 0.5;
    }
    // what they could do to you on their next turn, roughly
    function danger(seat) {
      const me = st.p[seat], them = st.p[1 - seat];
      let hit = 0;
      for (const x of them.table) if (!x.frozen) hit += x.pw;
      if (me.table.some((x) => x.gate)) hit *= 0.3;
      return hit >= me.morale ? 40 : hit * 0.4;
    }
    const copy = (x) => ({
      ...x, log: [], quiet: true, r: x.r,
      p: x.p.map((q) => ({ ...q, deck: q.deck.slice(), hand: q.hand.map((h) => ({ ...h })), table: q.table.map((y) => ({ ...y })) })),
    });
    // the best single move, as [move, how good], or [null] if nothing beats ending the turn
    function bestStep(seat, from) {
      let best = null, top = value(seat) + 0.01;
      const moves = g.legal(seat);
      for (const a of moves) {
        if (a.do === 'end') continue;
        st = copy(from);
        if (apply(seat, a)) {
          const v = value(seat);
          if (v > top) { top = v; best = a; }
        }
        st = from;
      }
      return [best, top];
    }
    // Going on with the turn after this move, playing the obvious way, how does it end up?
    function rollout(seat, from, first) {
      st = copy(from);
      apply(seat, first);
      for (let k = 0; k < 12 && !st.r; k++) {
        const here = st, [next] = bestStep(seat, here);
        st = here;
        if (!next) break;
        apply(seat, next);
      }
      const v = value(seat) - danger(seat);
      st = from;
      return v;
    }
    g.choose = (seat, level) => {
      level = level || st.p[seat].ai || 3;
      if (st.ph === 'swap') {
        return { do: 'swap', cards: st.p[seat].hand.filter((h) => CARD.get(h.id).cost > 3).map((h) => h.u) };
      }
      const moves = g.legal(seat);
      if (level <= 2 && rand() < (level === 1 ? 0.4 : 0.15)) return moves[Math.floor(rand() * moves.length)];
      const from = st;
      if (level < 4) {
        const [best] = bestStep(seat, from);
        return best || { do: 'end' };
      }
      // the sharks: the best few moves, each played through to the end of the turn
      const scored = [];
      for (const a of moves) {
        if (a.do === 'end') continue;
        st = copy(from);
        if (apply(seat, a)) scored.push([value(seat), a]);
        st = from;
      }
      scored.sort((a, b) => b[0] - a[0]);
      let best = { do: 'end' }, top = value(seat) - danger(seat) + 0.01; // (what ending the turn right now comes to)
      for (const [, a] of scored.slice(0, 5)) {
        const v = rollout(seat, from, a);
        if (v > top) { top = v; best = a; }
      }
      return best;
    };
    g.step = () => {
      if (st.r) return;
      if (st.ph === 'swap') {
        for (const seat of [0, 1]) {
          if (st.p[seat].ai && !st.p[seat].swapped && --st.wait <= 0) { g.act(seat, g.choose(seat)); st.wait = THINK; }
        }
        if (st.r || st.ph !== 'swap' || !st.turnTicks) { g.sync(); return; }
        if (--st.clock <= -SWAP_TICKS) for (const seat of [0, 1]) if (!st.p[seat].swapped && st.ph === 'swap') swap(seat, []);
        g.sync();
        return;
      }
      const seat = st.turn, me = st.p[seat];
      if (me.ai) {
        if (--st.wait <= 0) { st.wait = THINK; g.act(seat, g.choose(seat)); }
        return;
      }
      if (st.turnTicks && --st.clock <= 0) {
        me.strikes++;
        log({ e: 'timeout', s: seat, n: me.strikes });
        if (me.strikes >= STRIKES) finish(1 - seat, 'time');
        else endTurn();
        g.sync();
      }
    };

    // ---------- what the outside world sees ----------
    const open = (x) => ({ u: x.u, id: x.id, pw: x.pw, pa: x.pa, max: x.max, gate: x.gate, skin: x.skin, frozen: x.frozen, stuck: x.stuck, left: x.left, ready: canAttack(x) });
    g.view = (seat) => {
      const me = st.p[seat], them = st.p[1 - seat];
      const side = (q) => ({ name: q.name, morale: q.morale, cups: q.cups, coffee: q.coffee, burn: q.burn, deck: q.deck.length, swapped: q.swapped, table: q.table.map(open) });
      const v = {
        ph: st.ph, turn: st.turn, n: st.n, me: seat, clock: st.clock, first: st.first, r: st.r,
        you: Object.assign(side(me), { hand: me.hand.map((h) => ({ u: h.u, id: h.id })) }),
        them: Object.assign(side(them), { hand: them.hand.length }),
        ev: st.log.map((e) => (e.e === 'draw' && e.s !== seat ? { i: e.i, e: 'draw', s: e.s } : e)),
      };
      if (st.ph === 'play' && st.turn === seat && !st.r) {
        // what you can do, so a screen doesn't need to know the rules
        v.can = { play: {}, attack: {} };
        for (const h of me.hand) {
          const c = CARD.get(h.id);
          if (!canPlay(seat, c)) continue;
          const picks = picksFor(seat, c);
          if (picks && !picks.length && c.kind === 'task') continue;
          v.can.play[h.u] = picks && picks.length ? picks : null;
        }
        const targets = attackTargets(seat);
        for (const x of me.table) if (canAttack(x)) v.can.attack[x.u] = targets;
      }
      return v;
    };
    g.save = () => JSON.parse(JSON.stringify(st));
    g.load = (saved) => { st = JSON.parse(JSON.stringify(saved)); g.sync(); };
    // Puts a card straight on the table or in a hand, whatever the rules say, for trying things out.
    // Says its number.
    g.give = (seat, id, where = 'table') => {
      if (where === 'hand') { const u = st.next++; st.p[seat].hand.push({ u, id }); return u; }
      const x = newUnit(id, seat);
      st.p[seat].table.push(x);
      return x.u;
    };

    // ---------- the deal ----------
    st.first = o.first === 0 || o.first === 1 ? o.first : rand() < 0.5 ? 0 : 1;
    st.clock = 0;
    for (const seat of [0, 1]) {
      const ids = (o.decks || [])[seat];
      const me = st.p[seat];
      me.deck = shuffle((Array.isArray(ids) ? ids : STARTER).filter((id) => CARD.has(id)));
      for (let k = 0; k < OPENING && me.deck.length; k++) draw(seat);
    }
    g.sync();
    return g;
  }

  // (a hash of this whole function's source and the card list, line endings aside)
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '') + JSON.stringify(LIST)) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return {
    create, check, deckProblem, buildDeck, text, LIST, STARTER, VERSION, DEPTS, WORDS, MEANS, meanings,
    card: (id) => CARD.get(id),
    RULES: { MORALE, DECK, CUPS, TABLE, HAND, OPENING, STRIKES },
  };
})();
