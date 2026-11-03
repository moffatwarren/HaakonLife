// Copy everything worth keeping out of the leaderboards' database into one file:
//
//   node tools/backup_boards.mjs [folder]     (default: backup/)
//
// That's every board's scores, plus the saved character and special items of every name on
// any board. .github/workflows/backup-data.yml runs this every night. It only reads, using
// the same public access as the game, so it needs no password. The rules only let anyone read
// one board or one name at a time, so the boards come from BOARDS in js/game.js and the
// names from the boards: somebody who has a saved character but has never posted a score
// isn't in it. The file has the same shape as the database, so any part of it can go back
// in (see "Backups" in the README).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = readFileSync(join(HERE, '../js/game.js'), 'utf8');
const BOARD_URL = /const BOARD_URL = '([^']+)'/.exec(GAME)?.[1];
const TRIES = 3, AT_ONCE = 8;

// the boards in BOARDS, and a net board's two halves as they're really stored (see netNote)
function boards() {
  const from = GAME.indexOf('const BOARDS = {'), to = GAME.indexOf('\n  };', from);
  if (from < 0 || to < 0) throw new Error('BOARDS not found in js/game.js');
  const keys = [];
  for (const [, key, rest] of GAME.slice(from, to).matchAll(/(\w+): \{ title: ([^}]*)\}/g)) {
    if (/\bnet: true/.test(rest)) keys.push(key + 'won', key + 'lost');
    else keys.push(key);
  }
  // (far fewer than this and the code's changed in a way this no longer understands: better a
  // failed backup, which GitHub emails about, than one that's quietly missing most of it)
  if (keys.length < 30) throw new Error('only found ' + keys.length + ' boards in js/game.js');
  return keys;
}

let failures = 0;
async function read(path) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(BOARD_URL + '/' + path + '.json', { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i < TRIES) { await new Promise((ok) => setTimeout(ok, 2000 * i)); continue; }
      console.error('could not read ' + path + ': ' + e.message);
      failures++;
      return null;
    }
  }
}

// read each of a list of paths, a few at a time: { path's last part: what was there }
async function readAll(names, pathOf) {
  const out = {}, queue = [...names];
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    while (queue.length) {
      const n = queue.shift(), v = await read(pathOf(n));
      if (v !== null) out[n] = v;
    }
  }));
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const keys = boards();
const scores = await readAll(keys, (k) => 'scores/' + k);
const names = [...new Set(Object.values(scores).flatMap((rows) => Object.keys(rows)))].sort();
const looks = await readAll(names, (n) => 'looks/live/' + n);
const items = await readAll(names, (n) => 'items/live/' + n);

if (failures) { console.error(failures + ' reads failed, so no backup was written'); process.exit(1); }
const rows = Object.values(scores).reduce((sum, b) => sum + Object.keys(b).length, 0);
if (!rows) { console.error('every board came back empty, so no backup was written'); process.exit(1); }

const folder = process.argv[2] || join(HERE, '../backup');
const day = new Date().toISOString().slice(0, 10), file = join(folder, 'haakonlife-data-' + day + '.json');
mkdirSync(folder, { recursive: true });
writeFileSync(file, JSON.stringify({ scores, looks: { live: looks }, items: { live: items } }, null, 1) + '\n');
console.log(`${file}: ${keys.length} boards checked, ${Object.keys(scores).length} with scores, ${rows} rows, ${names.length} names, ${Object.keys(looks).length} characters, ${Object.keys(items).length} with items`);
