// Humbug Sweeper's fields, with no guessing on any of them. There's no drawing and there are no keys
// here, so server/test/sweeper.test.js can check it with no browser; HumbugGame in js/game.js does
// the rest. Randomness comes from a seed, so the same seed and first square give the same field.
//
//   SWEEPER.FIELDS                      the sizes: small, medium and full
//   SWEEPER.board(field, first, seed)   { mine, near, tries }: a field you can clear from that first
//                                       square by working it out, with no guesses
//   SWEEPER.solve(field, first, reveal) can it be cleared that way? reveal(i) says what opening square
//                                       i shows (how many humbugs are round it), and is all it knows
//
// How it makes sure: it lays the humbugs at random, plays the field the way a person would, and
// throws it away and tries again if it ever gets stuck. Solving only ever opens a square it has
// proved is safe, and it never looks under the snow, so a field it finishes can always be finished
// by somebody playing it, whatever order they do it in: finding out more never makes a proof wrong.
//
// It knows the things a good player looks for, and no more, so nobody is stuck needing something
// cleverer than these:
//   - One number: its humbugs are all accounted for, so the rest round it are safe; or it has just
//     enough squares left round it for its humbugs, so they're all humbugs.
//   - Two numbers side by side: if one needs so many more humbugs than the other that the squares
//     only it touches have to hold them all, those are humbugs and the ones only the other touches
//     are safe. That's the 1-1 and 1-2 at the edge of a patch, and so 1-2-1 and 1-2-2-1 too.
//   - The counter: no humbugs left means the rest are safe, and as many humbugs as squares means
//     they're all humbugs. That's for squares no number can reach.
window.SWEEPER = (function engine() {
  const FIELDS = {
    small: { cols: 9, rows: 9, mines: 10 },
    medium: { cols: 16, rows: 16, mines: 40 },
    full: { cols: 30, rows: 16, mines: 99 },
  };

  // (a small random number maker, the same on every computer)
  function randoms(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  // the squares round each square (up to eight), worked out once for each size
  const rounds = {};
  function roundOf(field) {
    const key = field.cols + 'x' + field.rows;
    if (rounds[key]) return rounds[key];
    const { cols, rows } = field, all = [];
    for (let i = 0; i < cols * rows; i++) {
      const x = i % cols, y = (i / cols) | 0, list = [];
      for (let ay = Math.max(0, y - 1); ay <= Math.min(rows - 1, y + 1); ay++)
        for (let ax = Math.max(0, x - 1); ax <= Math.min(cols - 1, x + 1); ax++)
          if (ax !== x || ay !== y) list.push(ay * cols + ax);
      all.push(list);
    }
    return (rounds[key] = all);
  }

  // the humbugs, anywhere but the first square and round it, so that it always opens up a patch
  function lay(field, first, rand) {
    const N = field.cols * field.rows, round = roundOf(field), mine = new Uint8Array(N);
    const keep = new Uint8Array(N);
    keep[first] = 1;
    for (const j of round[first]) keep[j] = 1;
    const free = [];
    for (let i = 0; i < N; i++) if (!keep[i]) free.push(i);
    for (let k = 0; k < field.mines; k++) {
      const j = k + Math.floor(rand() * (free.length - k));
      const pick = free[j];
      free[j] = free[k];
      free[k] = pick;
      mine[pick] = 1;
    }
    return mine;
  }

  function countsOf(field, mine) {
    const round = roundOf(field), near = new Uint8Array(mine.length);
    for (let i = 0; i < mine.length; i++) if (mine[i]) for (const j of round[i]) near[j]++;
    return near;
  }

  function solve(field, first, reveal) {
    const N = field.cols * field.rows, round = roundOf(field);
    const shown = new Int8Array(N).fill(-1); // what an opened square says (-1: not opened yet)
    const bug = new Uint8Array(N);           // worked out to have a humbug under it
    let unknown = N, bugsLeft = field.mines;

    // open a square, and everything round any square with no humbugs round it
    function open(i) {
      const todo = [i];
      while (todo.length) {
        const j = todo.pop();
        if (shown[j] >= 0 || bug[j]) continue;
        const n = reveal(j);
        if (n < 0) return false;
        shown[j] = n;
        unknown--;
        if (n === 0) for (const k of round[j]) if (shown[k] < 0 && !bug[k]) todo.push(k);
      }
      return true;
    }
    function mark(i) {
      if (bug[i] || shown[i] >= 0) return;
      bug[i] = 1;
      unknown--;
      bugsLeft--;
    }
    if (!open(first)) return false;

    // the squares still in question round number i, and how many humbugs it still needs among them
    const needs = (i) => {
      let left = shown[i];
      const cells = [];
      for (const k of round[i]) {
        if (bug[k]) left--;
        else if (shown[k] < 0) cells.push(k);
      }
      return { i, left, cells };
    };

    const stamp = new Int32Array(N).fill(-1);
    while (unknown > 0) {
      if (bugsLeft === 0) {
        for (let i = 0; i < N; i++) if (shown[i] < 0 && !bug[i] && !open(i)) return false;
        return true;
      }
      if (bugsLeft === unknown) return true;

      // one number at a time, until that stops getting anywhere
      const live = [];
      let moved = false;
      for (let i = 0; i < N; i++) {
        if (shown[i] <= 0) continue;
        const c = needs(i);
        if (!c.cells.length) continue;
        if (c.left === 0) {
          for (const k of c.cells) if (!open(k)) return false;
          moved = true;
        } else if (c.left === c.cells.length) {
          for (const k of c.cells) mark(k);
          moved = true;
        } else live.push(c);
      }
      if (moved) continue;

      // two numbers that share squares
      const byNumber = new Map();
      for (const c of live) byNumber.set(c.i, c);
      for (const a of live) {
        for (const k of a.cells) stamp[k] = a.i;
        const seen = new Set();
        for (const k of a.cells) {
          for (const n of round[k]) {
            const b = byNumber.get(n);
            if (!b || b === a || seen.has(n)) continue;
            seen.add(n);
            let shared = 0;
            for (const m of b.cells) if (stamp[m] === a.i) shared++;
            const onlyA = a.cells.length - shared, onlyB = b.cells.length - shared;
            if (!onlyA && !onlyB) continue;
            if (b.left - a.left !== onlyB) continue;
            // b needs so many more than a that the squares only b touches hold them all, which
            // leaves a's share all in the squares they both touch: the ones only a touches are safe
            for (const m of b.cells) if (stamp[m] !== a.i) mark(m);
            for (const m of a.cells) {
              let both = false;
              for (const o of b.cells) if (o === m) both = true;
              if (!both && !open(m)) return false;
            }
            moved = true;
            break;
          }
          if (moved) break;
        }
        if (moved) break;
      }
      if (!moved) return false; // stuck: from here on it would take a guess
    }
    return true;
  }

  // keep laying fields until one can be cleared with no guesses
  function board(field, first, seed) {
    const rand = randoms(seed);
    for (let tries = 1; ; tries++) {
      const mine = lay(field, first, rand), near = countsOf(field, mine);
      if (solve(field, first, (i) => (mine[i] ? -1 : near[i]))) return { mine, near, tries };
    }
  }

  return { FIELDS, board, solve, roundOf, randoms };
})();
