// Chess on the lunch room table: the rules, and how a coworker plays. Nothing in here draws or
// reads keys (ChessGame in js/game.js does that), so the game server runs it as it is for a game
// between two players (server/games/chess.js), and server/test/chess.test.js plays it with no
// browser at all.
//
//   const g = CHESS.create({ players: [white, black], seed, clock, fen })
//                    // a player is { name, ai }: ai is how well the computer plays them, 1 to 4,
//                    // or leave it out for a person. clock is the ticks each side gets for the
//                    // whole game (leave it out for no clock), fen a position to start from
//   g.step(inputs)   // one tick (a 60th of a second). inputs[side] is what that player did this
//                    // tick, if anything: { from, to, promo } or { resign: true }. Only the
//                    // side whose turn it is can move, and a move that isn't legal does nothing
//   g.play(move)     // make a move for whoever's turn it is, right now: true if it was legal
//   g.moves(from)    // the legal moves, as { from, to, promo }: all of them, or from one square
//   g.at(sq)         // what's on a square: 'P' 'N' 'B' 'R' 'Q' 'K' for white, the same in lower
//                    // case for black, '' for nothing
//   g.turn           // whose turn it is: 0 white, 1 black
//   g.check()        // whether the side to move is in check
//   g.king(side)     // the square that side's king is on
//   g.result         // null until it's over, then { w: the side that won, or -1 for a draw, why }.
//                    // why: 'mate', 'stalemate', 'repetition', 'fifty', 'material', 'time', 'resign'
//   g.last           // the last move, [from, to], or null
//   g.clock          // ticks left for [white, black], or null with no clock
//   g.ply            // moves made so far, counting each side's separately
//   g.fen()          // the position, in the usual notation for chess positions
//   g.view()         // what a browser needs to draw the game, as plain data, and small enough to
//                    // send several times a second. g.load(view) puts a game there
//   g.save()         // everything the game is, as plain data for JSON: the view, and also the
//                    // positions so far (for repetition) and the random numbers. g.load(saved)
//   g.events         // what happened this tick, for the sounds: 'move', 'capture', 'castle',
//                    // 'promote', 'check', 'over'
//
// A square is a number from 0 (a1) to 63 (h8): the file (a to h) is sq & 7, the rank is sq >> 3.
//
//   CHESS.LEVELS     // how many ways the computer can play: levels 1 to this
//   CHESS.VERSION    // a fingerprint of this file
window.CHESS = (function engine() {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // A piece is its kind, plus 8 if it's black. 0 is an empty square.
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
  const LETTERS = ' PNBRQK  pnbrqk';
  const VALUE = [0, 100, 320, 330, 500, 900, 0];
  const MATE = 100000, INF = 1000000;

  // Ticks the computer takes to move, at least and then at most this many more. It's nothing to
  // do with how hard it's thinking: a reply that came straight back would be hard to follow.
  const THINK = 50, THINK_MORE = 70;

  // How the computer plays: how many moves it looks ahead, whether it follows up the captures
  // at the end of that (or stops mid-trade and misjudges it), how much it misjudges a move by
  // anyway (in hundredths of a pawn), how often it just does something daft, and how many
  // positions it may look at for each move before it stops looking any deeper, so a hard
  // position can't hold up the game.
  const LEVELS = [null,
    { depth: 1, trades: false, wobble: 220, daft: 0.2, budget: 2000 },
    { depth: 2, trades: false, wobble: 90, daft: 0.06, budget: 8000 },
    { depth: 3, trades: true, wobble: 35, daft: 0, budget: 30000 },
    { depth: 5, trades: true, wobble: 10, daft: 0, budget: 150000 },
  ];

  // ---------- where each piece can go, worked out once ----------
  const KNIGHT = [], KING = [], RAYS = [], PAWN_FROM = [[], []];
  const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3;
    const hops = (list) => list.filter(([a, b]) => onBoard(f + a, r + b)).map(([a, b]) => (r + b) * 8 + f + a);
    KNIGHT.push(hops([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]));
    KING.push(hops([[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]));
    // the eight ways out from here, each the squares along it: the first four straight, then diagonal
    RAYS.push([[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => {
      const ray = [];
      for (let k = 1; onBoard(f + a * k, r + b * k); k++) ray.push((r + b * k) * 8 + f + a * k);
      return ray;
    }));
    // where a pawn of each side would have to be to attack this square
    PAWN_FROM[0].push(hops([[-1, -1], [1, -1]]));
    PAWN_FROM[1].push(hops([[-1, 1], [1, 1]]));
  }
  // what's left of the castling rights (1 white short, 2 white long, 4 black short, 8 black
  // long) once something has moved from, or been taken on, a square
  const KEEPS = new Array(64).fill(15);
  KEEPS[0] = 13; KEEPS[7] = 14; KEEPS[4] = 12; KEEPS[56] = 7; KEEPS[63] = 11; KEEPS[60] = 3;

  // ---------- what a position is worth ----------
  // Where each piece likes to be, in hundredths of a pawn, as white sees it with rank 8 on top.
  const WHERE = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  ];
  // the king once the queens and most of the rest are gone: out in the middle, helping
  const KING_LATE = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  // the same, by side and square: white reads the rows from the bottom, black from the top
  const place = (table, side, sq) => table[(side ? (sq >> 3) : 7 - (sq >> 3)) * 8 + (sq & 7)];
  const PLACE = [[], []], PLACE_LATE = [[], []];
  for (const side of [0, 1]) {
    for (let sq = 0; sq < 64; sq++) PLACE_LATE[side].push(place(KING_LATE, side, sq));
    for (let kind = 0; kind <= K; kind++) {
      PLACE[side].push([]);
      if (kind) for (let sq = 0; sq < 64; sq++) PLACE[side][kind].push(VALUE[kind] + place(WHERE[kind], side, sq));
    }
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
    const players = o.players || [{ name: 'White' }, { name: 'Black' }];
    const seed = { s: (o.seed || 0) >>> 0 }, rand = rng(seed);
    // the position
    const b = new Array(64).fill(0), kings = [4, 60];
    let turn = 0, castle = 15, ep = -1, half = 0, full = 1;
    // what make() needs to take a move back
    const undo = [];
    // a move inside here is one number: from, to and what a pawn becomes (see fromMove and toMove)
    let cached = null; // the legal moves in this position, once they've been asked for
    let wait = -1; // ticks before the computer moves (-1: it hasn't started on this turn)
    let seen = {}; // how many times each position has come up in this game

    const g = { players, turn: 0, result: null, last: null, clock: o.clock > 0 ? [o.clock, o.clock] : null, ply: 0, events: [] };

    // ---------- moves ----------
    function attacked(sq, by) {
      const mine = by * BLACK;
      for (const s of PAWN_FROM[by][sq]) if (b[s] === (P | mine)) return true;
      for (const s of KNIGHT[sq]) if (b[s] === (N | mine)) return true;
      for (const s of KING[sq]) if (b[s] === (K | mine)) return true;
      const rays = RAYS[sq];
      for (let d = 0; d < 8; d++) {
        const ray = rays[d], slider = (d < 4 ? R : B) | mine, queen = Q | mine;
        for (let k = 0; k < ray.length; k++) {
          const pc = b[ray[k]];
          if (pc) { if (pc === slider || pc === queen) return true; break; }
        }
      }
      return false;
    }
    const inCheck = () => attacked(kings[turn], 1 - turn);

    // Every move the pieces could make, not looking at whether it leaves your king in check
    // (make one and see). With only: just the ones that take something or queen a pawn.
    function pseudo(out, only) {
      const me = turn;
      const dir = me ? -8 : 8, homeRank = me ? 6 : 1, lastRank = me ? 0 : 7;
      const push = (from, to) => {
        if (to >> 3 === lastRank) {
          out.push(from | (to << 6) | (Q << 12));
          if (!only) for (const k of [N, R, B]) out.push(from | (to << 6) | (k << 12));
        } else out.push(from | (to << 6));
      };
      for (let s = 0; s < 64; s++) {
        const pc = b[s];
        if (!pc || (pc >> 3) !== me) continue;
        const kind = pc & 7;
        if (kind === P) {
          const one = s + dir;
          if (!b[one]) {
            if (!only || one >> 3 === lastRank) push(s, one);
            if (!only && s >> 3 === homeRank && !b[one + dir]) out.push(s | ((one + dir) << 6));
          }
          // the squares it attacks are where a pawn of the other side would attack it from
          for (const to of PAWN_FROM[1 - me][s]) {
            if (to === ep || (b[to] && (b[to] >> 3) !== me)) push(s, to);
          }
        } else if (kind === N || kind === K) {
          for (const to of kind === N ? KNIGHT[s] : KING[s]) {
            const there = b[to];
            if (there ? (there >> 3) !== me : !only) out.push(s | (to << 6));
          }
        } else {
          const rays = RAYS[s], from = kind === B ? 4 : 0, to = kind === R ? 4 : 8;
          for (let d = from; d < to; d++) {
            const ray = rays[d];
            for (let k = 0; k < ray.length; k++) {
              const there = b[ray[k]];
              if (!there) { if (!only) out.push(s | (ray[k] << 6)); continue; }
              if ((there >> 3) !== me) out.push(s | (ray[k] << 6));
              break;
            }
          }
        }
      }
      if (only) return out;
      // castling: the squares between empty, and the king not in, through or into check
      const them = 1 - me, e = me ? 60 : 4;
      if (b[e] === (K | (me * BLACK))) {
        if ((castle & (me ? 4 : 1)) && !b[e + 1] && !b[e + 2] && b[e + 3] === (R | (me * BLACK))
          && !attacked(e, them) && !attacked(e + 1, them) && !attacked(e + 2, them)) out.push(e | ((e + 2) << 6));
        if ((castle & (me ? 8 : 2)) && !b[e - 1] && !b[e - 2] && !b[e - 3] && b[e - 4] === (R | (me * BLACK))
          && !attacked(e, them) && !attacked(e - 1, them) && !attacked(e - 2, them)) out.push(e | ((e - 2) << 6));
      }
      return out;
    }

    function make(m) {
      const from = m & 63, to = (m >> 6) & 63, promo = m >> 12, pc = b[from], side = pc >> 3, kind = pc & 7;
      undo.push(m, b[to], castle, ep, half);
      half = b[to] || kind === P ? 0 : half + 1;
      b[to] = promo ? promo | (side * BLACK) : pc;
      b[from] = 0;
      let nextEp = -1;
      if (kind === P) {
        if (to === ep) b[to + (side ? 8 : -8)] = 0;
        else if (to - from === 16 || from - to === 16) {
          // (it only counts as there to be taken if there's a pawn next to it that could)
          const them = P | ((1 - side) * BLACK), f = to & 7;
          if ((f > 0 && b[to - 1] === them) || (f < 7 && b[to + 1] === them)) nextEp = (from + to) >> 1;
        }
      } else if (kind === K) {
        kings[side] = to;
        if (to - from === 2) { b[to - 1] = b[to + 1]; b[to + 1] = 0; } else if (from - to === 2) { b[to + 1] = b[to - 2]; b[to - 2] = 0; }
      }
      castle &= KEEPS[from] & KEEPS[to];
      ep = nextEp;
      turn = 1 - turn;
    }
    function unmake() {
      const prevHalf = undo.pop(), prevEp = undo.pop(), prevCastle = undo.pop(), there = undo.pop(), m = undo.pop();
      const from = m & 63, to = (m >> 6) & 63, promo = m >> 12, side = 1 - turn, pc = promo ? P | (side * BLACK) : b[to], kind = pc & 7;
      b[from] = pc;
      b[to] = there;
      if (kind === P) {
        if (to === prevEp) b[to + (side ? 8 : -8)] = P | ((1 - side) * BLACK);
      } else if (kind === K) {
        kings[side] = from;
        if (to - from === 2) { b[to + 1] = b[to - 1]; b[to - 1] = 0; } else if (from - to === 2) { b[to - 2] = b[to + 1]; b[to + 1] = 0; }
      }
      castle = prevCastle; ep = prevEp; half = prevHalf;
      turn = side;
    }
    function legalMoves() {
      if (cached) return cached;
      const out = [];
      for (const m of pseudo([])) {
        make(m);
        if (!attacked(kings[1 - turn], turn)) out.push(m);
        unmake();
      }
      cached = out;
      return out;
    }
    const fromMove = (m) => ({ from: m & 63, to: (m >> 6) & 63, promo: m >> 12 ? LETTERS[m >> 12].toLowerCase() : '' });
    const toMove = (d) => {
      // (what a pawn becomes comes from outside, so it's looked up by its place in a string)
      const at = typeof d.promo === 'string' && d.promo.length === 1 ? 'nbrq'.indexOf(d.promo) : -1;
      return d.from | (d.to << 6) | ((at < 0 ? 0 : at + N) << 12);
    };

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
    const castleText = () => ((castle & 1 ? 'K' : '') + (castle & 2 ? 'Q' : '') + (castle & 4 ? 'k' : '') + (castle & 8 ? 'q' : '')) || '-';
    const epText = () => (ep < 0 ? '-' : 'abcdefgh'[ep & 7] + ((ep >> 3) + 1));
    // the position apart from the two move counters, for spotting one that's come up before
    const posKey = () => placement() + ' ' + (turn ? 'b' : 'w') + ' ' + castleText() + ' ' + epText();
    g.fen = () => posKey() + ' ' + half + ' ' + full;

    // Puts the board at a position. False, with nothing changed, if it can't be one.
    function setFen(str) {
      const f = String(str).trim().split(/\s+/), rows = (f[0] || '').split('/');
      if (rows.length !== 8) return false;
      const next = new Array(64).fill(0), king = [-1, -1];
      for (let i = 0; i < 8; i++) {
        let file = 0;
        for (const ch of rows[i]) {
          if (ch >= '1' && ch <= '8') { file += +ch; continue; }
          const pc = ch === ' ' ? -1 : LETTERS.indexOf(ch), sq = (7 - i) * 8 + file;
          if (pc <= 0 || file > 7) return false;
          next[sq] = pc;
          if ((pc & 7) === K) king[pc >> 3] = sq;
          file++;
        }
        if (file !== 8) return false;
      }
      if (king[0] < 0 || king[1] < 0) return false;
      for (let i = 0; i < 64; i++) b[i] = next[i];
      kings[0] = king[0]; kings[1] = king[1];
      turn = f[1] === 'b' ? 1 : 0;
      const c = f[2] || '-';
      castle = (c.includes('K') ? 1 : 0) | (c.includes('Q') ? 2 : 0) | (c.includes('k') ? 4 : 0) | (c.includes('q') ? 8 : 0);
      ep = f[3] && /^[a-h][36]$/.test(f[3]) ? ((+f[3][1]) - 1) * 8 + (f[3].charCodeAt(0) - 97) : -1;
      half = Math.max(0, parseInt(f[4], 10) || 0);
      full = Math.max(1, parseInt(f[5], 10) || 1);
      undo.length = 0;
      cached = null; wait = -1;
      g.turn = turn;
      g.ply = (full - 1) * 2 + turn;
      return true;
    }

    // ---------- ways a game ends ----------
    // Neither side has enough left to ever give checkmate: kings alone, or with one knight or
    // bishop, or a bishop each on the same colour of square.
    function tooLittle() {
      const bishops = [];
      let minors = 0;
      for (let s = 0; s < 64; s++) {
        const kind = b[s] & 7;
        if (kind === P || kind === R || kind === Q) return false;
        if (kind === N) minors++;
        if (kind === B) { minors++; bishops.push(((s >> 3) + s) & 1); }
      }
      return minors <= 1 || (minors === 2 && bishops.length === 2 && bishops[0] === bishops[1]);
    }
    // whether this side has anything left that could give checkmate (for when the other's clock runs out)
    function hasMating(side) {
      let minors = 0;
      for (let s = 0; s < 64; s++) {
        if (!b[s] || (b[s] >> 3) !== side) continue;
        const kind = b[s] & 7;
        if (kind === P || kind === R || kind === Q) return true;
        if (kind === N || kind === B) minors++;
      }
      return minors >= 2;
    }
    function finish(w, why) {
      g.result = { w, why };
      g.events.push('over');
    }
    function settle() {
      const none = !legalMoves().length;
      if (none && inCheck()) finish(1 - turn, 'mate');
      else if (none) finish(-1, 'stalemate');
      else if (tooLittle()) finish(-1, 'material');
      else if (half >= 100) finish(-1, 'fifty');
      else if (seen[posKey()] >= 3) finish(-1, 'repetition');
    }

    // ---------- a real move ----------
    function playMove(m) {
      const from = m & 63, to = (m >> 6) & 63, took = b[to] || ((b[from] & 7) === P && to === ep);
      const castled = (b[from] & 7) === K && Math.abs(to - from) === 2;
      make(m);
      undo.length = 0;
      cached = null; wait = -1;
      if (!turn) full++;
      g.turn = turn;
      g.ply++;
      g.last = [from, to];
      const key = posKey();
      seen[key] = (seen[key] || 0) + 1;
      g.events.push(took ? 'capture' : castled ? 'castle' : 'move');
      if (m >> 12) g.events.push('promote');
      if (inCheck()) g.events.push('check');
      settle();
    }
    g.play = (d) => {
      if (g.result || !d) return false;
      const ok = (n) => Number.isInteger(n) && n >= 0 && n < 64;
      if (!ok(d.from) || !ok(d.to)) return false;
      const m = toMove(d);
      if (!legalMoves().includes(m)) return false;
      playMove(m);
      return true;
    };

    // ---------- the computer ----------
    let nodes = 0, budget = 0;
    function evaluate() {
      let score = 0, big = 0;
      for (let s = 0; s < 64; s++) {
        const pc = b[s];
        if (!pc) continue;
        const kind = pc & 7, side = pc >> 3;
        if (kind === K) continue;
        if (kind !== P) big += VALUE[kind];
        score += side ? -PLACE[1][kind][s] : PLACE[0][kind][s];
      }
      // (the two kings go on last, once it's known how much of everything else is left)
      const late = big < 2600, table = late ? PLACE_LATE : PLACE;
      score += late ? table[0][kings[0]] - table[1][kings[1]] : table[0][K][kings[0]] - table[1][K][kings[1]];
      return turn ? -score : score;
    }
    // best captures first: the biggest thing taken, by the smallest thing taking it
    function sorted(list) {
      for (let i = 0; i < list.length; i++) {
        const m = list[i], there = b[(m >> 6) & 63] & 7;
        let worth = there ? 10 + there * 8 - (b[m & 63] & 7) : 0;
        if (m >> 12 === Q) worth += 40;
        list[i] = m + worth * 32768;
      }
      list.sort((x, y) => y - x);
      for (let i = 0; i < list.length; i++) list[i] %= 32768;
      return list;
    }
    // looking no further ahead, but seeing out any captures, so it doesn't stop mid-trade
    function quiesce(alpha, beta) {
      nodes++;
      const stand = evaluate();
      if (stand >= beta) return beta;
      if (nodes > budget) return stand;
      if (stand > alpha) alpha = stand;
      for (const m of sorted(pseudo([], true))) {
        make(m);
        if (attacked(kings[1 - turn], turn)) { unmake(); continue; }
        const score = -quiesce(-beta, -alpha);
        unmake();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }
    function search(depth, alpha, beta, ahead, trades) {
      if (depth <= 0) return trades ? quiesce(alpha, beta) : (nodes++, evaluate());
      nodes++;
      if (half >= 100) return 0;
      if (nodes > budget) return evaluate();
      let any = false;
      for (const m of sorted(pseudo([]))) {
        make(m);
        if (attacked(kings[1 - turn], turn)) { unmake(); continue; }
        any = true;
        const score = -search(depth - 1, -beta, -alpha, ahead + 1, trades);
        unmake();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      if (!any) return inCheck() ? -MATE + ahead : 0;
      return alpha;
    }
    // What the computer plays here, at a level: a move as a number. It looks one move ahead, then
    // two and so on. If the budget runs out partway through a look it goes by the last whole one,
    // since a move that only got a glance can't be compared with one that was properly looked at.
    function choose(level) {
      const L = LEVELS[level] || LEVELS[1], moves = legalMoves();
      if (L.daft && rand() < L.daft) return moves[Math.floor(rand() * moves.length)];
      nodes = 0; budget = L.budget;
      let order = sorted(moves.slice()), scores = null;
      for (let depth = 1; depth <= L.depth; depth++) {
        const now = [];
        let best = -INF;
        for (const m of order) {
          make(m);
          // (anything that can't come within the wobble of the best so far needn't be looked at closely)
          let score = -search(depth - 1, -INF, L.wobble - best, 1, L.trades);
          // don't go round in circles while winning: be glad to while losing
          const again = seen[posKey()] || 0;
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
        // the other side wins, as long as they could ever have given checkmate
        finish(hasMating(1 - side) ? 1 - side : -1, 'time');
        return;
      }
      const level = players[side] && players[side].ai;
      if (level) {
        if (wait < 0) wait = THINK + Math.floor(rand() * THINK_MORE);
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
    g.at = (sq) => (b[sq] ? LETTERS[b[sq]] : '');
    g.check = () => inCheck();
    g.king = (side) => kings[side];
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
    g.ply = 0;
    seen[posKey()] = 1;
    return g;
  }

  // (a hash of this whole function's source, line endings aside)
  let VERSION = 2166136261;
  for (const ch of String(engine).replace(/\r/g, '')) VERSION = Math.imul(VERSION ^ ch.charCodeAt(0), 16777619);
  VERSION = (VERSION >>> 0).toString(36);

  return { create, START, LEVELS: LEVELS.length - 1, VERSION };
})();
