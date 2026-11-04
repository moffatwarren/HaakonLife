#!/usr/bin/env node
// Plays thousands of games of the card game with no browser, to see whether any deck or card is far
// ahead of the rest. The computer isn't a person, so treat this as what to look at next, not a verdict.
//
//   node tools/card_balance.mjs [games per pairing, default 300]
//
// It says how long games last, how often whoever goes first wins, how each department does against the
// others, whether better computer players beat worse ones, and which cards are in the most wins.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = new URL('../js/', import.meta.url);
const ctx = vm.createContext({ window: {} });
for (const f of ['cardlist.js', 'cards.js']) vm.runInContext(readFileSync(new URL(f, here), 'utf8'), ctx, { filename: 'js/' + f });
const CARDS = ctx.window.CARDS;
const GAMES = +process.argv[2] || 300;
const every = CARDS.LIST.filter((c) => c.rarity !== 'T').map((c) => c.id);

const problems = CARDS.check();
if (problems.length) { console.log('Problems with js/cardlist.js:\n- ' + problems.join('\n- ')); process.exit(1); }

function play(deckA, deckB, seed, levels = [3, 3], first) {
  const g = CARDS.create({ decks: [deckA, deckB], seed, first });
  const played = [new Set(), new Set()];
  let moves = 0, seen = -1;
  const note = () => {
    for (const e of g.events) {
      if (e.i <= seen) continue;
      seen = e.i;
      if (e.e === 'play') played[e.s].add(e.id);
    }
  };
  for (const s of [0, 1]) g.act(s, g.choose(s, levels[s]));
  while (!g.result && moves < 2000) {
    const s = g.view(0).turn;
    g.act(s, g.choose(s, levels[s]));
    moves++;
    note();
  }
  return { w: g.result ? g.result.w : -1, why: g.result && g.result.why, n: g.view(0).n, moves, first: g.view(0).first, played };
}
const pct = (a, b) => (b ? (a * 100 / b).toFixed(1).padStart(5) + '%' : '    -');

const DEPTS = Object.keys(CARDS.DEPTS);
const decks = Object.fromEntries(DEPTS.map((d) => [d, CARDS.buildDeck(every, { dept: d, seed: 11, wild: 0 })]));
decks.starter = CARDS.STARTER.slice();
for (const [name, d] of Object.entries(decks)) {
  const why = CARDS.deckProblem(d);
  if (why) console.log(name + ': ' + why);
}

// ---------- each deck against each other deck ----------
const names = Object.keys(decks);
const table = {};
let turns = 0, moves = 0, games = 0, firstWins = 0, draws = 0;
let seed = 1;
const started = Date.now();
for (const a of names) {
  table[a] = {};
  for (const b of names) {
    if (a === b) continue;
    let wins = 0;
    for (let k = 0; k < GAMES; k++) {
      const first = k % 2;
      const r = play(decks[a], decks[b], seed++, [3, 3], first);
      if (r.w === 0) wins++;
      if (r.w === r.first) firstWins++;
      if (r.w < 0) draws++;
      turns += r.n; moves += r.moves; games++;
    }
    table[a][b] = wins / GAMES;
  }
}
console.log(`\n${games} games, ${((Date.now() - started) / 1000).toFixed(1)} seconds`);
const perTurn = moves / turns;
console.log(`Length: ${(turns / games).toFixed(1)} turns in all, ${perTurn.toFixed(1)} moves a turn (ending it included)`);
// (a guess at a person: 6 seconds a move once you know the game, 3 more to take in each new turn)
console.log(`That's about ${((moves / games * 6 + (turns / games) * 3) / 60).toFixed(1)} minutes at 6 seconds a move`);
console.log(`Going first wins ${pct(firstWins, games - draws)}, draws ${pct(draws, games)}\n`);

console.log('Row beats column:');
console.log(''.padEnd(9) + names.map((n) => n.padStart(8)).join('') + '   overall');
for (const a of names) {
  const row = names.map((b) => (a === b ? '     -  ' : (table[a][b] * 100).toFixed(0).padStart(7) + '%'));
  const all = names.filter((b) => b !== a).reduce((s, b) => s + table[a][b], 0) / (names.length - 1);
  console.log(a.padEnd(9) + row.join('') + (all * 100).toFixed(0).padStart(8) + '%');
}

// ---------- do better computer players win? ----------
console.log('\nBetter computer players against worse, with the same deck:');
const SAME = decks.office;
for (const [hi, lo] of [[2, 1], [3, 2], [3, 1], [4, 3]]) {
  let wins = 0, n = Math.min(GAMES, hi === 4 ? 120 : GAMES);
  for (let k = 0; k < n; k++) if (play(SAME, SAME, seed++, [hi, lo], k % 2).w === 0) wins++;
  console.log(`  level ${hi} beats level ${lo}: ${pct(wins, n)}`);
}

// ---------- the cards ----------
// Random legal decks, so every card gets played alongside all sorts of others.
function randomDeck(s) {
  let x = s;
  const rand = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  const pool = every.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const deck = [];
  let legend = false;
  for (const id of pool) {
    if (deck.length === CARDS.RULES.DECK) break;
    const L = CARDS.card(id).rarity === 'L';
    if (L && legend) continue;
    if (L) legend = true;
    deck.push(id);
  }
  return deck;
}
const inDeck = new Map(every.map((id) => [id, { n: 0, w: 0, played: 0, playedWon: 0 }]));
const ROUNDS = GAMES * 8;
let base = 0;
for (let k = 0; k < ROUNDS; k++) {
  const A = randomDeck(k * 2 + 1), B = randomDeck(k * 2 + 2);
  const r = play(A, B, seed++, [3, 3], k % 2);
  [A, B].forEach((deck, s) => {
    const won = r.w === s;
    if (won) base++;
    for (const id of deck) {
      const row = inDeck.get(id);
      row.n++; if (won) row.w++;
      if (r.played[s].has(id)) { row.played++; if (won) row.playedWon++; }
    }
  });
}
const rows = [...inDeck].map(([id, r]) => ({ id, ...r, rate: r.played ? r.playedWon / r.played : 0 })).filter((r) => r.played >= 20);
rows.sort((a, b) => b.rate - a.rate);
const show = (r) => {
  const c = CARDS.card(r.id);
  return `  ${pct(r.playedWon, r.played)}  ${c.name.padEnd(17)} ${c.rarity}  ${String(c.cost).padStart(2)} coffee  ${c.kind === 'task' ? 'task' : c.power + '/' + c.patience}`;
};
console.log(`\nWins when played, in ${ROUNDS} games of random decks. Most:`);
rows.slice(0, 12).forEach((r) => console.log(show(r)));
console.log('Fewest:');
rows.slice(-10).forEach((r) => console.log(show(r)));
