// Checkers on the lunch room table: the rules, and how a coworker plays. Nothing in here draws or
// reads keys (CheckersGame in js/game.js does that), so the game server runs it as it is for a
// game between two players (server/games/checkers.js), and server/test/checkers.test.js plays it
// with no browser at all. It's used the same way as js/chess.js, so the same screen can play both.
//
//   const g = CHECKERS.create({ players: [black, red], seed, clock, fen })
//                    // a player is { name, ai }: ai is how well the computer plays them, 1 to 4,
//                    // or leave it out for a person. clock is the ticks each side gets for the
//                    // whole game (leave it out for no clock), fen a position to start from
//   g.step(inputs)   // one tick (a 60th of a second). inputs[side] is what that player did this
//                    // tick, if anything: { from, to } or { resign: true }. Only the side whose
//                    // turn it is can move, and a move that isn't legal does nothing
//   g.play(move)     // make a move for whoever's turn it is, right now: true if it was legal
//   g.moves(from)    // the legal moves, as { from, to, over }: all of them, or from one square.
//                    // over is the square of the piece it jumps, or -1. A double jump is two
//                    // moves, one at a time, and the turn stays put until it's done
//   g.holding()      // the square of a piece partway through a double jump (it has to carry
//                    // on, and nothing else can move), or -1
//   g.mustJump()     // the squares of the pieces that have to jump right now, if any do
//   g.at(sq)         // what's on a square: 'M' a man and 'K' a king for black, the same in lower
//                    // case for red, '' for nothing
//   g.turn           // whose turn it is: 0 black (who goes first), 1 red
//   g.result         // null until it's over, then { w: the side that won, or -1 for a draw, why }.
//                    // why: 'captured', 'blocked', 'repetition', 'forty', 'time', 'resign'
//   g.last           // the last move, [from, to], or null
//   g.clock          // ticks left for [black, red], or null with no clock
//   g.ply            // moves made so far, counting each jump of a double jump
//   g.fen()          // the position, written out like a chess position: the ranks from 8 to 1,
//                    // whose turn ('b' or 'r'), the square of a piece partway through a double
//                    // jump ('-' for none), and how many moves since a jump or a man moved
//   g.view()         // what a browser needs to draw the game, as plain data, and small enough to
//                    // send several times a second. g.load(view) puts a game there
//   g.save()         // everything the game is, as plain data for JSON: the view, and also the
//                    // positions so far (for repetition) and the random numbers. g.load(saved)
//   g.events         // what happened this tick, for the sounds: 'move', 'capture', 'crown', 'over'
//
// The rules are the usual ones here: on the dark squares, men move one square diagonally forward,
// kings either way, you have to jump if you can (any jump you like, but all the way to the end of
// it), and a man reaching the far side is crowned and stops there. You lose with nothing left
// or no move to make. Black's men start at the bottom of the numbers and go up the board.
//
// A square is a number from 0 (a1) to 63 (h8): the file (a to h) is sq & 7, the rank is sq >> 3.
//
//   CHECKERS.LEVELS  // how many ways the computer can play: levels 1 to this
//   CHECKERS.VERSION // a fingerprint of this file
window.CHECKERS = (function engine() {
  const START = '1m1m1m1m/m1m1m1m1/1m1m1m1m/8/8/M1M1M1M1/1M1M1M1M/M1M1M1M1 b - 0';
  // A piece is its kind, plus 4 if it's red. 0 is an empty square.
  const MAN = 1, KING = 2, RED = 4;
  const LETTERS = ' MK  mk';
  const WIN = 100000, INF = 1000000;
  const QUIET_LIMIT = 80; // moves in a row (forty each) with no jump and no man moved: a draw

  // Ticks the computer takes to move, at least and then at most this many more, and between the
  // jumps of a double jump. It's nothing to do with how hard it's thinking: a reply that came
  // straight back would be hard to follow.
  const THINK = 50, THINK_MORE = 70, JUMP_WAIT = 35;

  // How the computer plays: how many moves it looks ahead, whether it follows up any jumps at the
  // end of that (or stops halfway through a trade and misjudges it), how much it misjudges a move
  // by anyway (a man is worth 100), how often it just does something daft, and how many
  // positions it may look at for each move before it stops looking any deeper.
  const LEVELS = [null,
    { depth: 2, trades: false, wobble: 70, daft: 0.15, budget: 2000 },
    { depth: 4, trades: true, wobble: 30, daft: 0.04, budget: 8000 },
    { depth: 6, trades: true, wobble: 12, daft: 0, budget: 30000 },
    { depth: 10, trades: true, wobble: 3, daft: 0, budget: 150000 },
  ];

  // ---------- where a piece can go, worked out once ----------
  // The dark squares, and for each its four diagonals: the square next to it that way and the one
  // past that (-1 if it's off the board). The first two ways go up the board, the last two down.
  const DARK = [], NEXT = [], PAST = [];
  const WAYS = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3;
    if ((f + r) & 1) { NEXT.push(null); PAST.push(null); continue; }
    DARK.push(sq);
    NEXT.push(WAYS.map(([a, b]) => (onBoard(f + a, r + b) ? (r + b) * 8 + f + a : -1)));
    PAST.push(WAYS.map(([a, b]) => (onBoard(f + a * 2, r + b * 2) ? (r + b * 2) * 8 + f + a * 2 : -1)));
  }
  // the ways each piece can go, by piece
  const GOES = [];
  GOES[MAN] = [0, 1]; GOES[KING] = [0, 1, 2, 3]; GOES[MAN | RED] = [2, 3]; GOES[KING | RED] = [0, 1, 2, 3];

  // ---------- what a position is worth ----------
  const middle = (sq) => { const f = sq & 7, r = sq >> 3; return Math.min(f, 7 - f) + Math.min(r, 7 - r); };
  // a man is worth more the further on he is, and sitting on the back row keeps the other side's
  // men from being crowned; a king is worth more, more so out in the middle
  const MAN_AT = [[], []], KING_AT = [];
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3;
    KING_AT.push(170 + middle(sq) * 2);
    MAN_AT[0].push(100 + r * 4 + (r === 0 ? 12 : 0) + middle(sq));
    MAN_AT[1].push(100 + (7 - r) * 4 + (r === 7 ? 12 : 0) + middle(sq));
  }

  // seeded random numbers, carrying on from o.s (which a saved game keeps)
  function rng(o) {
    return () => {
      const s = o.s = (o.s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(o) {
    o = o || {};
    const players = o.players || [{ name: 'Black' }, { name: 'Red' }];
    const seed = { s: (o.seed || 0) >>> 0 }, rand = rng(seed);
    // the position. chain: the square of a piece partway through a double jump, or -1.
    // quiet: moves since a jump or a man moved
    const b = new Array(64).fill(0);
    let turn = 0, chain = -1, quiet = 0;
    const undo = []; // what make() needs to take a move back
    // a move inside here is one number: from, and to
    let cached = null; // the legal moves in this position, once they've been asked for
    let wait = -1; // ticks before the computer moves (-1: it hasn't started on this turn)
    let seen = {}; // how many times each position has come up in this game

    const g = { players, turn: 0, result: null, last: null, clock: o.clock > 0 ? [o.clock, o.clock] : null, ply: 0, events: [] };

    // ---------- moves ----------
    const isJump = (m) => { const d = (m >> 9) - ((m & 63) >> 3); return d === 2 || d === -2; };
    const isEnemy = (pc, side) => pc !== 0 && (pc >> 2) !== side;
    function canJump(sq) {
      const pc = b[sq], side = pc >> 2;
      for (const way of GOES[pc]) {
        const over = NEXT[sq][way], to = PAST[sq][way];
        if (to >= 0 && !b[to] && isEnemy(b[over], side)) return true;
      }
      return false;
    }
    function jumpsFrom(sq, out) {
      const pc = b[sq], side = pc >> 2;
      for (const way of GOES[pc]) {
        const over = NEXT[sq][way], to = PAST[sq][way];
        if (to >= 0 && !b[to] && isEnemy(b[over], side)) out.push(sq | (to << 6));
      }
      return out;
    }
    // Every legal move: the rest of a double jump if one's under way, or any jumps there are
    // (you have to jump if you can), or otherwise the plain moves.
    function steps() {
      if (chain >= 0) return jumpsFrom(chain, []);
      const jumps = [], plain = [];
      for (const sq of DARK) {
        const pc = b[sq];
        if (!pc || (pc >> 2) !== turn) continue;
        jumpsFrom(sq, jumps);
        if (jumps.length) continue;
        for (const way of GOES[pc]) {
          const to = NEXT[sq][way];
          if (to >= 0 && !b[to]) plain.push(sq | (to << 6));
        }
      }
      return jumps.length ? jumps : plain;
    }
    function make(m) {
      const from = m & 63, to = m >> 6, pc = b[from], side = pc >> 2, jumped = isJump(m), over = jumped ? (from + to) >> 1 : -1;
      undo.push(m, jumped ? b[over] : 0, pc, chain, quiet, turn);
      const crowned = (pc & 3) === MAN && (to >> 3) === (side ? 0 : 7);
      b[from] = 0;
      b[to] = crowned ? KING | (side * RED) : pc;
      if (jumped) b[over] = 0;
      quiet = jumped || (pc & 3) === MAN ? 0 : quiet + 1;
      // a jump carries on if there's another from here, unless that man has just been crowned
      chain = jumped && !crowned && canJump(to) ? to : -1;
      if (chain < 0) turn = 1 - side;
    }
    function unmake() {
      const prevTurn = undo.pop(), prevQuiet = undo.pop(), prevChain = undo.pop(), pc = undo.pop(), took = undo.pop(), m = undo.pop();
      const from = m & 63, to = m >> 6;
      b[to] = 0;
      b[from] = pc;
      if (took) b[(from + to) >> 1] = took;
      chain = prevChain; quiet = prevQuiet; turn = prevTurn;
    }
    function legalMoves() {
      if (!cached) cached = steps();
      return cached;
    }
    const fromMove = (m) => ({ from: m & 63, to: m >> 6, over: isJump(m) ? ((m & 63) + (m >> 6)) >> 1 : -1 });

    // ---------- the position in writing ----------
    function placement() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let gap = 0;
        for (let f = 0; f < 8; f++) {
          const pc = b[r * 8 + f];
          if (!pc) { gap++; continue; }
          if (gap) { out += gap; gap = 0; }
          out += LETTERS[pc];
        }
        if (gap) out += gap;
        if (r) out += '/';
      }
      return out;
    }
    const sqName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 3) + 1);
    // the position apart from the count, for spotting one that's come up before
    const posKey = () => placement() + ' ' + (turn ? 'r' : 'b') + ' ' + (chain < 0 ? '-' : sqName(chain));
    g.fen = () => posKey() + ' ' + quiet;

    // Puts the board at a position. False, with nothing changed, if it can't be one.
    function setFen(str) {
      const f = String(str).trim().split(/\s+/), rows = (f[0] || '').split('/');
      if (rows.length !== 8) return false;
      const next = new Array(64).fill(0);
      for (let i = 0; i < 8; i++) {
        let file = 0;
        for (const ch of rows[i]) {
          if (ch >= '1' && ch <= '8') { file += +ch; continue; }
          const pc = ch === ' ' ? -1 : LETTERS.indexOf(ch), sq = (7 - i) * 8 + file;
          // (only on the dark squares, and a man can't be stood where he'd have been crowned)
          if (pc <= 0 || file > 7 || ((7 - i) + file) & 1) return false;
          if (pc === MAN && i === 0) return false;
          if (pc === (MAN | RED) && i === 7) return false;
          next[sq] = pc;
          file++;
        }
        if (file !== 8) return false;
      }
      const at = f[2] && /^[a-h][1-8]$/.test(f[2]) ? (+f[2][1] - 1) * 8 + (f[2].charCodeAt(0) - 97) : -1;
      if (at >= 0 && !next[at]) return false;
      for (let i = 0; i < 64; i++) b[i] = next[i];
      turn = f[1] === 'r' ? 1 : 0;
      chain = at >= 0 && canJump(at) ? at : -1;
      quiet = Math.max(0, parseInt(f[3], 10) || 0);
      undo.length = 0;
      cached = null; wait = -1;
      g.turn = turn;
      return true;
    }

    // ---------- ways a game ends ----------
    function finish(w, why) {
      g.result = { w, why };
      g.events.push('over');
    }
    function settle() {
      if (chain >= 0) return;
      let left = 0;
      for (const sq of DARK) if (b[sq] && (b[sq] >> 2) === turn) left++;
      if (!left) finish(1 - turn, 'captured');
      else if (!legalMoves().length) finish(1 - turn, 'blocked');
      else if (quiet >= QUIET_LIMIT) finish(-1, 'forty');
      else if (seen[posKey()] >= 3) finish(-1, 'repetition');
    }

    // ---------- a real move ----------
    function playMove(m) {
      const from = m & 63, to = m >> 6, jumped = isJump(m), was = b[from];
      make(m);
      undo.length = 0;
      cached = null; wait = -1;
      g.turn = turn;
      g.ply++;
      g.last = [from, to];
      if (chain < 0) {
        const key = posKey();
        seen[key] = (seen[key] || 0) + 1;
      }
      g.events.push(jumped ? 'capture' : 'move');
      if (b[to] !== was) g.events.push('crown');
      settle();
    }
    g.play = (d) => {
      if (g.result || !d) return false;
      const ok = (n) => Number.isInteger(n) && n >= 0 && n < 64;
      if (!ok(d.from) || !ok(d.to)) return false;
      const m = d.from | (d.to << 6);
      if (!legalMoves().includes(m)) return false;
      playMove(m);
      return true;
    };

    // ---------- the computer ----------
    let nodes = 0, budget = 0;
    function evaluate() {
      let score = 0, counts = [0, 0];
      const kings = [[], []], all = [[], []];
      for (const sq of DARK) {
        const pc = b[sq];
        if (!pc) continue;
        const side = pc >> 2, value = (pc & 3) === KING ? KING_AT[sq] : MAN_AT[side][sq];
        score += side ? -value : value;
        counts[side]++;
        all[side].push(sq);
        if ((pc & 3) === KING) kings[side].push(sq);
      }
      // whoever's ahead is better off the fewer pieces are left, so they should trade them off...
      const total = counts[0] + counts[1], ahead = counts[0] - counts[1];
      score += ahead * (24 - total);
      // ...and with only a few left, their kings should go after what's still there
      if (total <= 8 && ahead) {
        const strong = ahead > 0 ? 0 : 1;
        let far = 0;
        for (const k of kings[strong]) {
          let near = 8;
          for (const sq of all[1 - strong]) near = Math.min(near, Math.max(Math.abs((sq & 7) - (k & 7)), Math.abs((sq >> 3) - (k >> 3))));
          far += near;
        }
        score += strong ? far * 3 : -far * 3;
      }
      return turn ? -score : score;
    }
    function search(depth, alpha, beta, ahead, trades) {
      nodes++;
      const moves = steps();
      if (!moves.length) return -WIN + ahead; // nothing to move, or nothing left: that's lost
      if (quiet >= QUIET_LIMIT) return 0;
      if (nodes > budget) return evaluate();
      // (at the end of the look ahead, carry on while there are jumps to make, if it can see that far)
      if (depth <= 0 && !(trades && isJump(moves[0]))) return evaluate();
      for (const m of moves) {
        const side = turn;
        make(m);
        // the rest of a double jump is still your move
        const score = turn === side ? search(depth, alpha, beta, ahead + 1, trades) : -search(depth - 1, -beta, -alpha, ahead + 1, trades);
        unmake();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }
    // What the computer plays here, at a level: a move as a number. It looks one move ahead, then
    // two and so on. If the budget runs out partway through a look it goes by the last whole one,
    // since a move that only got a glance can't be compared with one that was properly looked at.
    function choose(level) {
      const L = LEVELS[level] || LEVELS[1], moves = legalMoves();
      if (moves.length === 1) return moves[0];
      if (L.daft && rand() < L.daft) return moves[Math.floor(rand() * moves.length)];
      nodes = 0; budget = L.budget;
      let order = moves.slice(), scores = null;
      for (let depth = 1; depth <= L.depth; depth++) {
        const now = [];
        let best = -INF;
        for (const m of order) {
          const side = turn;
          make(m);
          // (anything that can't come within the wobble of the best so far needn't be looked at closely)
          let score = turn === side ? search(depth - 1, best - L.wobble, INF, 1, L.trades) : -search(depth - 1, -INF, L.wobble - best, 1, L.trades);
          // don't go round in circles while winning: be glad to while losing
          const again = chain < 0 ? seen[posKey()] || 0 : 0;
          if (again >= 2) score = 0;
          else if (again) score += score > 0 ? -40 : 40;
          unmake();
          if (scores && nodes > budget) break;
          if (score > best) best = score;
          now.push([m, score]);
        }
        if (now.length < order.length) break;
        scores = now;
        if (nodes > budget) break;
        order = scores.slice().sort((x, y) => y[1] - x[1]).map((e) => e[0]);
      }
      let pick = moves[0], top = -INF;
      for (const [m, score] of scores) {
        const felt = score + rand() * L.wobble;
        if (felt > top) { top = felt; pick = m; }
      }
      return pick;
    }

    // ---------- the game going on ----------
    g.step = (inputs) => {
      g.events = [];
      if (g.result) return;
      for (const side of [0, 1]) {
        if (inputs && inputs[side] && inputs[side].resign === true) { finish(1 - side, 'resign'); return; }
      }
      const side = turn;
      if (g.clock && --g.clock[side] <= 0) {
        g.clock[side] = 0;
        finish(1 - side, 'time');
        return;
      }
      const level = players[side] && players[side].ai;
      if (level) {
        if (wait < 0) wait = chain >= 0 ? JUMP_WAIT : THINK + Math.floor(rand() * THINK_MORE);
        if (wait-- > 0) return;
        playMove(choose(level));
      } else if (inputs && inputs[side]) g.play(inputs[side]);
    };

    // ---------- what the outside world sees ----------
    g.moves = (from) => {
      if (g.result) return [];
      const all = legalMoves().map(fromMove);
      return from === undefined ? all : all.filter((m) => m.from === from);
    };
    g.holding = () => chain;
    g.mustJump = () => {
      if (g.result) return [];
      const list = legalMoves();
      return list.length && isJump(list[0]) ? [...new Set(list.map((m) => m & 63))] : [];
    };
    g.at = (sq) => (b[sq] ? LETTERS[b[sq]] : '');
    g.view = () => ({ f: g.fen(), l: g.last, c: g.clock, r: g.result, n: g.ply });
    g.save = () => Object.assign(g.view(), { seen: Object.assign({}, seen), s: seed.s });
    g.load = (d) => {
      if (!d || !setFen(d.f)) return false;
      g.last = Array.isArray(d.l) ? d.l.slice(0, 2) : null;
      g.clock = Array.isArray(d.c) ? d.c.slice(0, 2) : null;
      g.result = d.r && typeof d.r === 'object' ? { w: d.r.w, why: d.r.why } : null;
      if (typeof d.n === 'number') g.ply = d.n;
      if (d.seen && typeof d.seen === 'object') seen = Object.assign({}, d.seen);
      if (typeof d.s === 'number') seed.s = d.s >>> 0;
      return true;
    };

    if (!setFen(o.fen || START)) setFen(START);
    seen[posKey()] = 1;
    settle(); // (a position to start from might already be over)
    return g;
  }

  // (a hash of this whole function's source, line endings aside)
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '')) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return { create, START, LEVELS: LEVELS.length - 1, VERSION };
})();
