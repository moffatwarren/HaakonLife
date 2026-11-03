// Humbug Sweeper's fields with no browser: is every one really clear-able with no guesses? The check
// here shares no code with js/sweeper.js, and it's more thorough: at each step it tries every way the
// humbugs could be hiding, given only what's showing, to find squares that are safe in all of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.createContext(box);
vm.runInContext(readFileSync(new URL('../../js/sweeper.js', import.meta.url), 'utf8'), box);
const { FIELDS, board, solve, roundOf, randoms } = box.window.SWEEPER;

function neighbours({ cols, rows }, i) {
  const x = i % cols, y = Math.floor(i / cols), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ax = x + dx, ay = y + dy;
    if ((dx || dy) && ax >= 0 && ay >= 0 && ax < cols && ay < rows) out.push(ay * cols + ax);
  }
  return out;
}

// Could the numbers showing all be right with square `v` set to `value`? It's a search through the
// squares of v's patch, one at a time, stopping at the first way that works.
function possible(order, needsOf, v, value) {
  const assigned = new Map([[v, value]]);
  const fits = () => {
    for (const c of needsOf) {
      let bugs = 0, open = 0;
      for (const k of c.cells) {
        if (!assigned.has(k)) open++;
        else if (assigned.get(k)) bugs++;
      }
      if (bugs > c.left || bugs + open < c.left) return false;
    }
    return true;
  };
  const go = (n) => {
    if (n === order.length) return true;
    const k = order[n];
    if (assigned.has(k)) return go(n + 1);
    for (const val of [0, 1]) {
      assigned.set(k, val);
      if (fits() && go(n + 1)) return true;
    }
    assigned.delete(k);
    return false;
  };
  return fits() && go(0);
}

// Play the field knowing only what's showing, and only ever opening a square that can't have a
// humbug. It says true once the field is clear, and false if it runs out of squares it can be sure of.
function clearsWithNoGuess(field, first, mine) {
  const N = field.cols * field.rows, around = [];
  for (let i = 0; i < N; i++) around.push(neighbours(field, i));
  const shown = new Int8Array(N).fill(-1), bug = new Uint8Array(N);
  const open = (i) => {
    assert.ok(!mine[i], 'the check itself opened a humbug, so it proved something false');
    const todo = [i];
    while (todo.length) {
      const j = todo.pop();
      if (shown[j] >= 0) continue;
      shown[j] = around[j].reduce((n, k) => n + mine[k], 0);
      if (!shown[j]) todo.push(...around[j].filter((k) => shown[k] < 0));
    }
  };
  open(first);
  const unknown = () => { const u = []; for (let i = 0; i < N; i++) if (shown[i] < 0 && !bug[i]) u.push(i); return u; };
  const bugsLeft = () => field.mines - bug.reduce((a, b) => a + b, 0);
  for (;;) {
    const rest = unknown();
    if (!rest.length) return true;
    if (rest.length === bugsLeft()) return true;
    if (bugsLeft() === 0) { rest.forEach((i) => { if (shown[i] < 0) open(i); }); return true; }

    const needsOf = [];
    for (let i = 0; i < N; i++) {
      if (shown[i] <= 0) continue;
      const cells = around[i].filter((k) => shown[k] < 0 && !bug[k]);
      if (cells.length) needsOf.push({ cells, left: shown[i] - around[i].reduce((n, k) => n + bug[k], 0) });
    }
    // the patches of squares that the numbers tie together, each in an order that keeps it tied
    const seen = new Set();
    let moved = false;
    for (const c of needsOf) for (const start of c.cells) {
      if (seen.has(start)) continue;
      const order = [], queue = [start];
      seen.add(start);
      while (queue.length) {
        const k = queue.shift();
        order.push(k);
        for (const d of needsOf) if (d.cells.includes(k)) for (const m of d.cells) if (!seen.has(m)) { seen.add(m); queue.push(m); }
      }
      const inPatch = needsOf.filter((d) => d.cells.some((m) => order.includes(m)));
      for (const v of order) {
        if (shown[v] >= 0 || bug[v]) continue;
        if (!possible(order, inPatch, v, 1)) { open(v); moved = true; break; }
        if (!possible(order, inPatch, v, 0)) { bug[v] = 1; moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) return false;
  }
}

const SIZES = Object.keys(FIELDS);
const places = ({ cols, rows }) => ({
  'the middle': (rows >> 1) * cols + (cols >> 1),
  'a corner': 0,
  'the far corner': cols * rows - 1,
  'an edge': cols >> 1,
});

test('the sizes are the ones the game says they are', () => {
  assert.deepEqual({ ...FIELDS.small }, { cols: 9, rows: 9, mines: 10 });
  assert.deepEqual({ ...FIELDS.medium }, { cols: 16, rows: 16, mines: 40 });
  assert.deepEqual({ ...FIELDS.full }, { cols: 30, rows: 16, mines: 99 }); // the Christmas Cup's field
});

for (const size of SIZES) {
  const field = FIELDS[size];
  test(`every ${size} field can be cleared with no guesses, wherever you start`, () => {
    const each = size === 'full' ? 10 : 25; // (a few seconds in all: this is the slow one)
    for (const [where, first] of Object.entries(places(field))) {
      for (let s = 1; s <= each; s++) {
        const { mine } = board(field, first, s * 104729);
        assert.ok(clearsWithNoGuess(field, first, mine), `${size} from ${where}, seed ${s * 104729}, needs a guess`);
      }
    }
  });

  test(`a ${size} field has the right humbugs, in the right places`, () => {
    for (const first of Object.values(places(field))) {
      for (let s = 1; s <= 50; s++) {
        const { mine, near } = board(field, first, s);
        assert.equal(mine.reduce((a, b) => a + b, 0), field.mines);
        assert.equal(mine[first], 0, 'never under the first square');
        assert.equal(near[first], 0, 'never next to it, so it opens up a patch');
        for (const k of neighbours(field, first)) assert.equal(mine[k], 0);
        for (let i = 0; i < mine.length; i++) {
          assert.equal(near[i], neighbours(field, i).reduce((n, k) => n + mine[k], 0), 'the number on square ' + i);
        }
      }
    }
  });

  test(`solving a ${size} field never opens a humbug, even on one it gives up on`, () => {
    const rand = randoms(size.length);
    let gaveUp = 0;
    for (let s = 0; s < 300; s++) {
      const N = field.cols * field.rows, first = Math.floor(rand() * N), mine = new Uint8Array(N);
      const keep = new Set([first, ...neighbours(field, first)]);
      for (let placed = 0; placed < field.mines;) {
        const i = Math.floor(rand() * N);
        if (!keep.has(i) && !mine[i]) { mine[i] = 1; placed++; }
      }
      const finished = solve(field, first, (i) => {
        assert.ok(!mine[i], 'it opened a humbug, so what it thought it had proved was wrong');
        return neighbours(field, i).reduce((n, k) => n + mine[k], 0);
      });
      if (!finished) gaveUp++;
    }
    // (if none needed a guess, this wouldn't be testing much)
    assert.ok(gaveUp > 0, 'some of these random fields should have needed a guess');
  });

  test(`the same seed and first square make the same ${size} field`, () => {
    const first = places(field)['the middle'];
    assert.deepEqual([...board(field, first, 12345).mine], [...board(field, first, 12345).mine]);
    assert.notDeepEqual([...board(field, first, 12345).mine], [...board(field, first, 54321).mine]);
  });
}

test('a real coin flip gets turned down', () => {
  // Two by four, starting top left. One humbug, in one of the two far right squares, with nothing
  // to say which: both of the numbers next to them touch both, and they say the same either way.
  const field = { cols: 4, rows: 2, mines: 1 };
  const mine = new Uint8Array(8);
  mine[3] = 1;
  const reveal = (i) => (mine[i] ? -1 : neighbours(field, i).reduce((n, k) => n + mine[k], 0));
  assert.equal(solve(field, 0, reveal), false);
  assert.equal(clearsWithNoGuess(field, 0, mine), false);
});

test('the counter settles squares that no number can', () => {
  // the same field with a humbug in both far right squares: as many humbugs as squares
  const field = { cols: 4, rows: 2, mines: 2 };
  const mine = new Uint8Array(8);
  mine[3] = 1; mine[7] = 1;
  assert.equal(solve(field, 0, (i) => (mine[i] ? -1 : neighbours(field, i).reduce((n, k) => n + mine[k], 0))), true);
});

test('reading two numbers together gets further than reading one at a time', () => {
  // Plays a field reading one number at a time, and says if it finished. Any field this can't
  // finish but solve can, solve must have read two numbers together, and the thorough check
  // has to agree that it really can be done.
  const oneAtATime = (field, first, mine) => {
    const N = field.cols * field.rows, around = [];
    for (let i = 0; i < N; i++) around.push(neighbours(field, i));
    const shown = new Int8Array(N).fill(-1), bug = new Uint8Array(N);
    const open = (i) => {
      const todo = [i];
      while (todo.length) {
        const j = todo.pop();
        if (shown[j] >= 0) continue;
        shown[j] = around[j].reduce((n, k) => n + mine[k], 0);
        if (!shown[j]) todo.push(...around[j]);
      }
    };
    open(first);
    for (let moved = true; moved;) {
      moved = false;
      for (let i = 0; i < N; i++) {
        if (shown[i] <= 0) continue;
        const cells = around[i].filter((k) => shown[k] < 0 && !bug[k]);
        const left = shown[i] - around[i].reduce((n, k) => n + bug[k], 0);
        if (!cells.length) continue;
        if (left === 0) { cells.forEach(open); moved = true; }
        else if (left === cells.length) { cells.forEach((k) => { bug[k] = 1; }); moved = true; }
      }
    }
    return shown.every((n, i) => n >= 0 || mine[i]);
  };
  const field = FIELDS.medium, first = places(field)['the middle'];
  let found = 0;
  for (let s = 1; s <= 300 && found < 5; s++) {
    const { mine } = board(field, first, s);
    if (oneAtATime(field, first, mine)) continue;
    found++;
    assert.ok(clearsWithNoGuess(field, first, mine), 'seed ' + s);
  }
  assert.ok(found > 0, 'some fields should need two numbers read together');
});

test('the squares round a square are the right ones', () => {
  for (const size of SIZES) {
    const field = FIELDS[size], round = roundOf(field);
    for (let i = 0; i < field.cols * field.rows; i++) {
      assert.deepEqual([...round[i]].sort((a, b) => a - b), neighbours(field, i).sort((a, b) => a - b));
    }
  }
});
