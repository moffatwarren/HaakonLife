#!/usr/bin/env node
// Makes sure every game is hooked up everywhere it needs to be. A game lives in several lists
// in js/game.js, and nothing goes wrong by itself if one gets missed: the game just never gets a
// leaderboard, or nobody can reach it, or other players see you standing around. So this
// reads the code and says so. The site's deploy runs it first, and doesn't upload if it fails.
//
//   node tools/check_games.mjs
//
// It says what's missing and where to add it. If something is meant to be that way, say why in
// the exceptions just below. A game is a function called SomethingGame or SomethingApp, or any
// other that says what you're `doing`.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- what's meant to be that way ----------
const NO_BOARD = { // saveBest keys that don't go on a leaderboard
  jar: 'win or lose, so no board (see Leaderboards in the README)',
  wade: 'win or lose, so no board (see Leaderboards in the README)',
  'dogrun.': 'each dog has its own best; boardNote puts them all on catchrun',
};
const NOT_DOING = { // games that don't say what you're doing (see MP_DOING)
  SdgApp: 'a program for laying out a unit, not a game: dots over your head will do, and a challenge can wait until you exit',
};
const NO_SHORTCUT = {}; // games that can't be opened with &game=
const NOT_STARTED = {}; // games nothing starts yet

// ---------- reading the code ----------
// (a failure here stops the site deploying, so say clearly if it's this that's confused)
process.on('uncaughtException', (e) => {
  console.error('check_games.mjs couldn\'t read the code: ' + e.message);
  console.error('If the game itself runs fine, then it\'s tools/check_games.mjs that needs fixing, not the game.');
  process.exit(2);
});
const ROOT = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

// The source with comments gone and everything inside strings, templates and regular
// expressions blanked out, each character in the same place. So looking for a name or a matching
// bracket in this only finds code, and what's at the same place in the source is the real text.
function mask(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const quoted = (i) => { // from the opening quote: the closing quote's place
    const q = src[i];
    for (let k = i + 1; k < src.length; k++) {
      if (src[k] === '\\') k++;
      else if (src[k] === q) return k;
    }
    throw new Error('a string that never ends, at character ' + i);
  };
  const template = (i) => { // from the opening `: the closing one's place
    for (let k = i + 1; k < src.length; k++) {
      if (src[k] === '\\') k++;
      else if (src[k] === '`') return k;
      else if (src[k] === '$' && src[k + 1] === '{') {
        let depth = 1;
        for (k += 2; depth; k++) {
          if (src[k] === '{') depth++;
          else if (src[k] === '}') depth--;
          else if (src[k] === "'" || src[k] === '"') k = quoted(k);
          else if (src[k] === '`') k = template(k);
        }
        k--;
      }
    }
    throw new Error('a template that never ends, at character ' + i);
  };
  const REGEX_AFTER = /^(return|typeof|case|in|of|delete|void|throw|new|do|else)$/;
  let i = 0, last = ''; // last: the code just before here, a word or a single character
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      let e = src.indexOf('\n', i);
      if (e < 0) e = src.length;
      blank(i, e); i = e;
    } else if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2) + 2;
      blank(i, e); i = e;
    } else if (c === "'" || c === '"') {
      const e = quoted(i);
      blank(i + 1, e); i = e + 1; last = 'x';
    } else if (c === '`') {
      const e = template(i);
      blank(i + 1, e); i = e + 1; last = 'x';
    } else if (c === '/' && (!last || (!/^[\w$]+$/.test(last) && last !== ')' && last !== ']') || REGEX_AFTER.test(last))) {
      let k = i + 1, inClass = false;
      for (; src[k] !== '/' || inClass; k++) {
        if (src[k] === '\\') k++;
        else if (src[k] === '[') inClass = true;
        else if (src[k] === ']') inClass = false;
        else if (src[k] === '\n') throw new Error('a regular expression that never ends, at character ' + i);
      }
      blank(i + 1, k); i = k + 1; last = 'x';
    } else if (/[\w$]/.test(c)) {
      let k = i;
      while (/[\w$]/.test(src[k] || '')) k++;
      last = last === '.' ? 'x' : src.slice(i, k); i = k; // (it.throw is a name, not the keyword)
    } else {
      if (!/\s/.test(c)) last = c;
      i++;
    }
  }
  return out.join('');
}

const OPEN = { '(': ')', '[': ']', '{': '}' };
// the place of the bracket that closes the one at i
function closing(code, i) {
  const stack = [];
  for (let k = i; k < code.length; k++) {
    if (OPEN[code[k]]) stack.push(OPEN[code[k]]);
    else if (code[k] === ')' || code[k] === ']' || code[k] === '}') {
      if (stack.pop() !== code[k]) throw new Error('brackets that don\'t match, at character ' + k);
      if (!stack.length) return k;
    }
  }
  throw new Error('a bracket that never closes, at character ' + i);
}

const SRC = read('js/game.js');
const CODE = mask(SRC);
closing(CODE, CODE.indexOf('(')); // (the whole file is one function call: if that's wrong, nothing else is right)

// The list that opens right after `opening`: [where it starts, where it ends]
function block(opening) {
  const at = CODE.indexOf(opening);
  if (at < 0) throw new Error('can\'t find ' + opening + ' in js/game.js');
  const from = at + opening.length - 1;
  return [from, closing(CODE, from)];
}
// The keys of the object at [from, to], each { key, a, b } with a and b around its value.
function entries([from, to]) {
  const out = [];
  let i = from + 1;
  while (i < to) {
    while (i < to && /[\s,]/.test(CODE[i])) i++;
    if (i >= to) break;
    let key, k;
    if (CODE[i] === "'" || CODE[i] === '"') {
      k = CODE.indexOf(CODE[i], i + 1);
      key = SRC.slice(i + 1, k).replace(/\\(.)/g, '$1');
      k++;
    } else {
      k = i;
      while (/[\w$]/.test(CODE[k])) k++;
      key = CODE.slice(i, k);
    }
    while (/\s/.test(CODE[k])) k++;
    if (CODE[k] !== ':' || !key) throw new Error('can\'t read the list around "' + SRC.slice(i, i + 40).split('\n')[0] + '"');
    const a = k + 1;
    k = a;
    while (k < to && CODE[k] !== ',') k = OPEN[CODE[k]] ? closing(CODE, k) + 1 : k + 1;
    out.push({ key, a, b: k });
    i = k;
  }
  return out;
}
// the strings between from and to, as { s, at, before: the code just before it }
function strings(from, to) {
  const out = [];
  for (let i = from; i < to; i++) {
    if (CODE[i] !== "'" && CODE[i] !== '"') continue;
    const e = CODE.indexOf(CODE[i], i + 1), before = CODE.slice(Math.max(from, i - 12), i).trim();
    out.push({ s: SRC.slice(i + 1, e).replace(/\\(.)/g, '$1'), at: i, before });
    i = e;
  }
  return out;
}

// ---------- what's in there ----------
const problems = [];
const say = (msg) => problems.push(msg);
const inSpan = (name, from, to) => new RegExp('\\b' + name + '\\b').test(CODE.slice(from, to));

const funcs = new Map(); // every function in js/game.js's top level: name -> { params, from, to }
for (const m of CODE.matchAll(/^ {2}function (\w+)\(([^)]*)\)\s*\{/gm)) {
  const from = m.index + m[0].length - 1;
  funcs.set(m[1], { params: m[2].trim(), at: m.index, from, to: closing(CODE, from) });
}
const DOING = /(?<![.\w])doing\s*:/g; // (a doing: of its own, not somebody else's: x ? y.doing : z)
const says = (f) => new RegExp(DOING.source).test(CODE.slice(f.from, f.to)) || /\bget doing\b/.test(CODE.slice(f.from, f.to));
const games = [...funcs].filter(([name, f]) => /^[A-Z]\w*(Game|App)$/.test(name) || (/^[A-Z]/.test(name) && says(f)));

const boardsAt = block('const BOARDS = {');
const boards = entries(boardsAt);
const fameAt = block('const FAME_GROUPS = [');
const doingLabels = new Set(entries(block('const MP_DOING = {')).map((e) => e.key));
const shortcutsAt = block('const GAME = {');
const versus = entries(block('const VERSUS = {'));

const mapSrc = read('js/maps.js');
const maps = JSON.parse(mapSrc.slice(mapSrc.indexOf('{'), mapSrc.lastIndexOf('}') + 1));
const tilesOn = (want) => new Set(maps.floors.filter(want).flatMap((f) => [...f.tiles.join('')]));

// (if there's far too little of any of it, this has stopped understanding the code: say so)
const COUNTS = [['games', games.length, 40], ['boards', boards.length, 30], ['doing labels', doingLabels.size, 30], ['head-to-head games', versus.length, 5]];
for (const [what, n, least] of COUNTS) if (n < least) throw new Error('only found ' + n + ' ' + what + ', so this has stopped understanding js/game.js');

// ---------- the games ----------
for (const [name, f] of games) {
  // the shortcut list
  if (!inSpan(name, ...shortcutsAt) && !NO_SHORTCUT[name]) {
    say(`${name} has no &game= shortcut: add it to const GAME near the end of js/game.js, so it can be tested and screenshotted.`);
  }
  // something starts it: a tile, a coworker, a computer, a challenge...
  const elsewhere = [...CODE.matchAll(new RegExp('\\b' + name + '\\b', 'g'))].some((m) => {
    const inOwn = m.index >= f.at && m.index <= f.to;
    return !inOwn && !(m.index >= shortcutsAt[0] && m.index <= shortcutsAt[1]);
  });
  if (!elsewhere && !NOT_STARTED[name]) {
    say(`Nothing starts ${name}, so nobody can reach it: give it a tile in GAMES (in useTile), PLANT_GAMES or YARD_GAMES, a coworker in OFFERS (in talkTo), a program in PROGRAMS or an entry in VERSUS.`);
  }
  // what other players see you doing
  if (!says(f) && !NOT_DOING[name]) {
    say(`${name} doesn't say what you're doing: give it \`doing: 'somekey'\` and a label in MP_DOING. Without it other players only see dots over your head, and someone challenging you isn't told you're busy.`);
  }
}
// every game named anywhere is a real one (a typo in one of the object lists throws when it's used)
for (const m of CODE.matchAll(/\b[A-Z]\w*(?:Game|App)\b/g)) {
  if (!funcs.has(m[0]) && CODE[m.index - 1] !== '.') say(`${m[0]} is used in js/game.js, but there's no function called that.`);
}

// ---------- what you're doing ----------
const doingKeys = new Set();
for (const m of CODE.matchAll(DOING)) {
  let k = m.index + m[0].length;
  while (k < CODE.length && CODE[k] !== ',' && CODE[k] !== '}') k = OPEN[CODE[k]] ? closing(CODE, k) + 1 : k + 1;
  for (const { s, before } of strings(m.index, k)) if (/(:|\?)$/.test(before)) doingKeys.add(s);
}
for (const m of CODE.matchAll(/\bget doing\(\)\s*\{/g)) {
  const from = m.index + m[0].length - 1;
  for (const { s, before } of strings(from, closing(CODE, from))) if (/(:|\?|return)$/.test(before)) doingKeys.add(s);
}
for (const key of doingKeys) if (!doingLabels.has(key)) say(`doing: '${key}' has no label in MP_DOING, so other players see nothing for it.`);

// ---------- the leaderboards ----------
const boardKeys = new Set(boards.map((b) => b.key));
const fame = new Map(); // board -> how many pages it's on
{
  const [from, to] = fameAt;
  for (const row of strings(from, to)) {
    // (each page is ['ITS NAME', [the boards]]: the boards are the strings inside the second bracket)
    let depth = 0;
    for (let i = from; i < row.at; i++) {
      if (CODE[i] === '[') depth++;
      else if (CODE[i] === ']') depth--;
    }
    if (depth === 3) fame.set(row.s, (fame.get(row.s) || 0) + 1);
  }
}
const allStrings = strings(0, CODE.length);
for (const b of boards) {
  const v = CODE.slice(b.a, b.b), off = /\bquest:\s*true\b|\bunlisted:\s*true\b/.test(v);
  if (!off && !fame.has(b.key)) say(`The board ${b.key} isn't on a Hall of Fame page: add it to FAME_GROUPS (or mark it unlisted: true). As it is, it lands on a page called OTHER.`);
  if (off && fame.has(b.key)) say(`The board ${b.key} is in FAME_GROUPS, but it's marked as staying off those pages.`);
  // something has to send to it, or it says "up for grabs" for ever
  const used = allStrings.some((x) => x.s === b.key && !(x.at >= boardsAt[0] && x.at <= boardsAt[1]) && !(x.at >= fameAt[0] && x.at <= fameAt[1]));
  if (!used) say(`Nothing sends scores to the board ${b.key}: call saveBest('${b.key}', score) when the game ends, or take it out of BOARDS.`);
}
for (const [key, n] of fame) {
  if (!boardKeys.has(key)) say(`FAME_GROUPS has ${key}, but there's no board called that in BOARDS.`);
  if (n > 1) say(`${key} is on ${n} Hall of Fame pages in FAME_GROUPS.`);
}
for (const m of CODE.matchAll(/\b(?:saveBest|boardNote)\(\s*'/g)) {
  const at = m.index + m[0].length - 1, key = strings(at, CODE.indexOf("'", at + 1) + 1)[0].s;
  if (!boardKeys.has(key) && !NO_BOARD[key]) say(`saveBest('${key}') has no leaderboard: add ${key} to BOARDS, or to NO_BOARD in tools/check_games.mjs with why not.`);
}

// ---------- the tiles that start them ----------
const TILE_LISTS = [
  ['GAMES', 'const GAMES = {', 'an indoor map', (f) => !f.outdoor],
  ['PLANT_GAMES', 'const PLANT_GAMES = {', 'the Kingston plant', (f) => f.plant],
  ['YARD_GAMES', 'const YARD_GAMES = {', 'the parking lot', (f) => f.outdoor],
];
for (const [list, opening, where, want] of TILE_LISTS) {
  const tiles = tilesOn(want);
  for (const { key } of entries(block(opening))) {
    if (!tiles.has(key)) say(`${list} starts a game from the tile '${key}', but there's no '${key}' on ${where}: place it in tools/build_maps.py and run it.`);
  }
}

// ---------- head-to-head ----------
const serverIndex = readFileSync(join(ROOT, 'server/games/index.js'), 'utf8');
const serverGames = new Set((/export default \{([^}]*)\}/.exec(serverIndex) || ['', ''])[1].split(',').map((s) => s.trim()).filter(Boolean));
if (!serverGames.size) throw new Error('can\'t read the games in server/games/index.js');
for (const v of versus) {
  const code = CODE.slice(v.a, v.b), m = /\bGame:\s*\(\s*(\w+)\s*\)\s*=>\s*([A-Z]\w*)\(([^)]*)\)/.exec(code);
  if (!m) { say(`VERSUS ${v.key} needs Game: (m) => SomeGame(m).`); continue; }
  if (!new RegExp('\\b' + m[1] + '\\b').test(m[3])) say(`VERSUS ${v.key} doesn't hand ${m[2]} its match.`);
  const f = funcs.get(m[2]);
  if (f && !f.params) say(`VERSUS ${v.key} hands ${m[2]} a match, but ${m[2]} takes no arguments.`);
  if (!/\blabel:/.test(code) || !/\btitle:/.test(code)) say(`VERSUS ${v.key} needs a label (for the list) and a title (for the challenge).`);
  const onServer = /\bserver:\s*true\b/.test(code);
  if (onServer && !serverGames.has(v.key)) say(`VERSUS ${v.key} says server: true, but server/games/index.js has no game called ${v.key}.`);
  if (!onServer && serverGames.has(v.key)) say(`server/games/index.js has ${v.key}, but VERSUS ${v.key} doesn't say server: true, so the server never runs it.`);
}
for (const key of serverGames) if (!versus.some((v) => v.key === key)) say(`server/games/index.js has ${key}, but it's not in VERSUS, so nobody can challenge anyone to it.`);

// ---------- the files themselves ----------
const loaded = JSON.parse((/var FILES = (\[[^\]]*\])/.exec(read('index.html')) || ['', '[]'])[1].replace(/'/g, '"'));
const testPage = [...read('tools/test.html').matchAll(/<script src="\.\.\/js\/(\w+)\.js">/g)].map((m) => m[1]);
if (!loaded.length) throw new Error('can\'t read FILES in index.html');
if (loaded.join() !== testPage.join()) say(`index.html loads ${loaded.join(', ')}, but tools/test.html loads ${testPage.join(', ')}: they should load the same files in the same order.`);
for (const f of readdirSync(join(ROOT, 'js'))) {
  if (f.endsWith('.js') && !loaded.includes(f.slice(0, -3))) say(`js/${f} isn't in FILES in index.html, so it never loads.`);
}

// ---------- and the verdict ----------
const unique = [...new Set(problems)];
if (unique.length) {
  console.error(unique.length + (unique.length === 1 ? ' problem' : ' problems') + ' hooking up the games:\n');
  for (const p of unique) {
    console.error('- ' + p);
    if (process.env.GITHUB_ACTIONS) console.log('::error::' + p); // (shows on the run's page)
  }
  process.exit(1);
}
console.log(`OK: ${games.length} games, ${boards.length} boards, ${doingKeys.size} doing keys, ${versus.length} head-to-head games and ${loaded.length} files all hooked up`);
