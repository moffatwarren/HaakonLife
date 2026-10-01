(function () {
  // View: 20 x 15 tiles of 16px.
  const SW = 320, SH = 240;
  const MAPS = window.OFFICE_MAPS;
  const WALKABLE = '.,:_DSj';
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const canvas = document.getElementById('screen');
  canvas.width = SW; canvas.height = SH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- settings ----------
  const store = {
    get(k) { try { return localStorage.getItem('richmond.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('richmond.' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  let soundOn = store.get('sound') !== 'off';

  // ---------- art ----------
  const GENDERS = ['male', 'female'];
  const col = Art.UI;
  const floorCanvas = MAPS.floors.map((f) => Art.renderFloor(f));
  const miniCanvas = MAPS.floors.map((f) => Art.renderMini(f));
  const charSprites = {};
  GENDERS.forEach((g) => { charSprites[g] = Art.LOOKS[g].map((look) => Art.renderSprites(g, look)); });
  // Last character picked (used as the default on the select screen).
  const pick = { gender: GENDERS.includes(store.get('gender')) ? store.get('gender') : 'male', index: 0 };
  pick.index = Math.min(+store.get('look') || 0, Art.LOOKS[pick.gender].length - 1);
  let sprites = charSprites[pick.gender][pick.index];

  // Curtains ('C' tiles): closed until the player peeks around them, then
  // walkable until they leave the curtained room. Pre-render the open look.
  const curtains = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => {
      if (c === 'C') list.push({ x, y, open: Art.renderTileAs(f, x, y, '~') });
    }));
    return list;
  });
  let curtainOpen = null; // floor index whose curtains are open

  // ---------- NPCs: one per person, pacing around their own office ----------
  const NPC_LINES = [
    "Hi! I'm {n}.",
    "Oh, hey! I'm {n}. Welcome to the office!",
    "I'm {n}. Busy day today!",
    "Hey, I'm {n}. Have you tried the candy at reception?",
    "I'm {n}. Don't tell anyone, but this is my third coffee.",
  ];
  const NOT_PEOPLE = ['Meeting Room', 'First Aid Station', 'Ansys Station', 'Reception', 'Engraver'];
  const NPC_FLOOR = '.,:_j';
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const npcs = [];
  function npcAt(fi, x, y) {
    return npcs.find((n) => n.floor === fi &&
      ((n.x === x && n.y === y) || (n.moving && n.x + n.mdx === x && n.y + n.mdy === y))) || null;
  }
  function playerAt(x, y) {
    return (P.x === x && P.y === y) || (P.moving && P.x + P.mdx === x && P.y + P.mdy === y);
  }
  (function spawnNpcs() {
    const placed = new Set();
    MAPS.floors.forEach((f, fi) => {
      // offices first, so someone with an office isn't placed in a cubicle too
      const rooms = f.rooms.filter((r) => !r.parent).concat(f.rooms.filter((r) => r.parent));
      for (const room of rooms) {
        const m = /^\d+ (.+)$/.exec(room.name);
        let names, area = room;
        if (room.people) {
          names = room.people;
        } else if (room.person) {
          names = [room.person];
          if (room.area) area = { x1: room.area[0], y1: room.area[1], x2: room.area[2], y2: room.area[3] };
        } else {
          if (!m || NOT_PEOPLE.includes(m[1]) || m[1].startsWith('/')) continue;
          names = m[1].split(' / ');
        }
        for (const name of names) {
          if (placed.has(name) && !room.people) continue;
          const spots = [];
          for (let y = area.y1; y <= area.y2; y++)
            for (let x = area.x1; x <= area.x2; x++)
              if (NPC_FLOOR.includes(tileAt(fi, x, y)) && !npcAt(fi, x, y)) spots.push([x, y]);
          if (!spots.length) continue;
          placed.add(name);
          const p = (window.PEOPLE || {})[name] || {};
          const body = ['female', 'ghost'].includes(p.body) ? p.body : 'male';
          const looks = Art.LOOKS[body] || Art.LOOKS.male;
          const def = looks[hash(name) % looks.length];
          const look = { h: p.hair || def.h, s: p.skin || def.s, w: p.top || def.w, u: p.accent || def.u, K: p.pants || def.K };
          const [x, y] = spots[(hash(name) + npcs.length * 7) % spots.length];
          npcs.push({
            name, floor: fi, room: area, x, y, dir: 'down', moving: false, prog: 0, mdx: 0, mdy: 0, step: 0,
            wait: 30 + ((hash(name) + npcs.length * 37) % 120), sprites: Art.renderSprites(body, look),
            ghost: body === 'ghost',
            lines: p.lines && p.lines.length ? p.lines : [NPC_LINES[hash(name) % NPC_LINES.length].replace('{n}', name)],
          });
        }
      }
    });
  })();

  function updateNpcs() {
    for (const n of npcs) {
      if (n.floor !== P.floor) continue;
      if (n.moving) {
        if (++n.prog >= 16) { n.x += n.mdx; n.y += n.mdy; n.moving = false; n.prog = 0; }
        continue;
      }
      if (--n.wait > 0) continue;
      n.wait = 40 + Math.floor(Math.random() * 140);
      n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      if (Math.random() < 0.25) continue; // sometimes just look around
      const [dx, dy] = DIRS[n.dir], tx = n.x + dx, ty = n.y + dy, r = n.room;
      if (tx < r.x1 || tx > r.x2 || ty < r.y1 || ty > r.y2) continue;
      if (!NPC_FLOOR.includes(tileAt(n.floor, tx, ty)) || npcAt(n.floor, tx, ty) || playerAt(tx, ty)) continue;
      Object.assign(n, { moving: true, prog: 0, mdx: dx, mdy: dy });
      n.step ^= 1;
    }
  }

  const area = (r) => (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
  MAPS.floors.forEach((f) => f.rooms.sort((a, b) => area(a) - area(b)));

  function tileAt(fi, x, y) {
    const t = MAPS.floors[fi].tiles;
    return y < 0 || y >= t.length || x < 0 || x >= t[0].length ? ' ' : t[y][x];
  }
  function roomAt(fi, x, y) {
    return MAPS.floors[fi].rooms.find((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) || null;
  }
  const inLink = (e, fi, x, y) => e.floor === fi && x >= e.x1 && x <= e.x2 && y >= e.y1 && y <= e.y2;
  function findLink(fi, x, y) {
    for (const name in MAPS.links) {
      const ends = MAPS.links[name];
      if (ends.some((e) => inLink(e, fi, x, y))) return ends;
    }
    return null;
  }

  // ---------- sound ----------
  let actx = null;
  function unlockAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function tone(freq, dur, type, vol, slide, delay) {
    const t = actx.currentTime + (delay || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol || 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const SFX = {
    bump: () => tone(90, 0.08, 'square', 0.05),
    select: () => tone(1320, 0.05),
    menu: () => { tone(880, 0.04); tone(1320, 0.05, 'square', 0.04, 0, 0.05); },
    stairs: () => tone(700, 0.3, 'square', 0.03, -450),
    ding: () => { tone(1568, 0.35, 'triangle', 0.08); tone(1319, 0.5, 'triangle', 0.08, 0, 0.2); },
  };
  function sfx(name) { if (soundOn && actx) SFX[name](); }

  // ---------- input ----------
  const held = { up: false, down: false, left: false, right: false, a: false, b: false, start: false, map: false };
  const pressed = new Set();
  let dirStack = [];
  function press(k) {
    unlockAudio();
    if (held[k]) return;
    held[k] = true;
    pressed.add(k);
    if (DIRS[k]) { dirStack = dirStack.filter((d) => d !== k); dirStack.push(k); }
  }
  function release(k) {
    held[k] = false;
    if (DIRS[k]) dirStack = dirStack.filter((d) => d !== k);
  }
  const heldDir = () => dirStack[dirStack.length - 1] || null;

  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyE: 'a', Space: 'a', KeyJ: 'a',
    KeyX: 'b', ShiftLeft: 'b', ShiftRight: 'b', KeyK: 'b', Backspace: 'b',
    Enter: 'start', Escape: 'start', KeyM: 'map',
  };
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) press(k);
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) release(k); });
  addEventListener('blur', () => { for (const k in held) release(k); });

  // Touch / mouse controls
  document.querySelectorAll('[data-btn]').forEach((el) => {
    const k = el.dataset.btn;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); press(k); });
    const up = () => { el.classList.remove('down'); release(k); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  });
  const dpad = document.getElementById('dpad');
  if (dpad) {
    let cur = null;
    const setDir = (d) => {
      if (d === cur) return;
      if (cur) release(cur);
      cur = d;
      if (d) press(d);
      dpad.dataset.dir = d || '';
    };
    const fromEvent = (e) => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.1) return cur;
      return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    };
    dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); setDir(fromEvent(e)); });
    dpad.addEventListener('pointermove', (e) => { if (cur) setDir(fromEvent(e)); });
    const end = () => setDir(null);
    dpad.addEventListener('pointerup', end);
    dpad.addEventListener('pointercancel', end);
    dpad.addEventListener('lostpointercapture', end);
  }
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- drawing helpers ----------
  function text(str, x, y, scale, color) {
    scale = scale || 1;
    ctx.fillStyle = color || col.dark;
    let cx = x;
    for (const ch of str) {
      const g = FONT.glyphs[ch] || FONT.glyphs['?'];
      for (let r = 0; r < g.length; r++)
        for (let c = 0; c < 5; c++)
          if (g[r][c] === '1') ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
      cx += FONT.ADV * scale;
    }
  }
  function ring(x, y, w, h) {
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  }
  function box(x, y, w, h) {
    ctx.fillStyle = col.light; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col.dark; ring(x + 1, y + 1, w - 2, h - 2); ring(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = col.light;
    [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]].forEach(([a, b]) => ctx.fillRect(a, b, 1, 1));
  }
  function wrap(str, max) {
    const lines = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        if (line && (line + ' ' + word).length > max) { lines.push(line); line = word; }
        else line = line ? line + ' ' + word : word;
      }
      lines.push(line);
    }
    return lines;
  }

  // ---------- UI stack (dialogs, menus) ----------
  const ui = [];
  const top = () => ui[ui.length - 1];
  const remove = (el) => { const i = ui.indexOf(el); if (i >= 0) ui.splice(i, 1); };

  function Dialog(str, opts) {
    opts = opts || {};
    const lines = wrap(str, Math.floor((SW - 16) / 6) - 1), pages = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
    let page = 0, shown = 0, holding = false;
    const self = {
      update() {
        if (holding) return;
        const len = pages[page].join('').length;
        if (shown < len) {
          shown += held.a || held.b ? 3 : 1;
          if (shown >= len && page === pages.length - 1 && opts.then) { holding = true; opts.then(self); }
          return;
        }
        if (pressed.has('a') || pressed.has('b')) {
          sfx('select');
          if (++page >= pages.length) { remove(self); if (opts.done) opts.done(); }
          else shown = 0;
        }
      },
      draw() {
        box(0, SH - 48, SW, 48);
        let left = Math.floor(shown);
        pages[page].forEach((l, i) => {
          text(l.slice(0, Math.max(0, left)), 8, SH - 38 + i * 16);
          left -= l.length;
        });
        if (!holding && shown >= pages[page].join('').length && (tick >> 4) & 1) text('~', SW - 14, SH - 12);
      },
      close() { remove(self); },
    };
    return self;
  }
  function say(str, done) { ui.push(Dialog(str, { done })); }

  function Choice(options, x, y, cb, opts) {
    opts = opts || {};
    let cur = opts.start || 0;
    const w = Math.max(...options.map((o) => o.length)) * 6 + 22, h = options.length * 16 + 8;
    if (x < 0) x = SW - w + x + 1;
    const self = {
      options,
      update() {
        if (pressed.has('up')) { cur = (cur + options.length - 1) % options.length; sfx('select'); }
        if (pressed.has('down')) { cur = (cur + 1) % options.length; sfx('select'); }
        if (pressed.has('a')) { sfx('select'); if (!opts.keepOpen) remove(self); cb(cur, self); }
        else if (pressed.has('b') || (opts.startCloses && pressed.has('start'))) { remove(self); cb(-1, self); }
      },
      draw() {
        box(x, y, w, h);
        self.options.forEach((o, i) => {
          text(o, x + 16, y + 8 + i * 16);
          if (i === cur) text('>', x + 8, y + 8 + i * 16);
        });
      },
    };
    return self;
  }
  function ask(str, options, cb) {
    ui.push(Dialog(str, {
      then(dlg) {
        ui.push(Choice(options, -1, SH - 48 - options.length * 16 - 8, (i) => { dlg.close(); cb(i); }));
      },
    }));
  }

  function MapView() {
    let fi = P.floor;
    const self = {
      update() {
        if (pressed.has('left') || pressed.has('right') || pressed.has('up') || pressed.has('down')) {
          fi = (fi + 1) % MAPS.floors.length; sfx('select');
        }
        if (pressed.has('a') || pressed.has('b') || pressed.has('start') || pressed.has('map')) { sfx('select'); remove(self); }
      },
      draw() {
        box(0, 0, SW, SH);
        const name = MAPS.floors[fi].name.toUpperCase();
        text(name, (SW - name.length * 6) >> 1, 12);
        const m = miniCanvas[fi], k = Math.max(1, Math.floor((SW - 16) / m.width));
        const mx = (SW - m.width * k) >> 1, my = 30;
        ctx.drawImage(m, mx, my, m.width * k, m.height * k);
        if (fi === P.floor && (tick >> 3) & 1) {
          ctx.fillStyle = col.dark;
          ctx.fillRect(mx + P.x * k - 1, my + P.y * k - 1, k + 2, k + 2);
        }
        const r = fi === P.floor ? roomAt(P.floor, P.x, P.y) : null;
        const ty = my + m.height * k + 12;
        text(r ? r.name : fi === P.floor ? 'Hallway' : '', 10, ty);
        text('Arrows: other floor', 10, ty + 20);
        text('Space: close', 10, ty + 34);
      },
    };
    return self;
  }

  function openStartMenu() {
    sfx('menu');
    const labels = () => ['MAP', soundOn ? 'SOUND ON' : 'SOUND OFF', 'CLOSE'];
    const menu = Choice(labels(), -1, 0, (i, self) => {
      if (i === 0) ui.push(MapView());
      else if (i === 1) {
        soundOn = !soundOn; store.set('sound', soundOn ? 'on' : 'off');
        self.options = labels();
        sfx('select');
      } else remove(self);
    }, { keepOpen: true, startCloses: true });
    ui.push(menu);
  }

  // ---------- flavour text ----------
  const INFO = {
    d: ['A desk buried in sticky notes.', 'A tidy desk. Suspiciously tidy.', 'Someone left a half-finished coffee here.'],
    m: ['The monitor shows a very long spreadsheet.', 'An inbox with 1,204 unread emails...', 'The screensaver is bouncing around.'],
    c: ['An office chair. It spins!'],
    p: ['A potted plant. Someone waters it every Monday.'],
    b: ['Binders, manuals and old catalogues.'],
    k: ['A clean countertop.'],
    M: ['A humming machine. Better not touch it.'],
    n: ['A sink. The water is freezing!'],
    w: ['It\'s a toilet. Nothing to see here.'],
    f: ['A fridge. One lunch is labelled DO NOT EAT.'],
    v: ['A recycling bin stuffed with pop cans.'],
    x: ['The photocopier blinks: PC LOAD LETTER'],
    T: ['A big table. Good for meetings.'],
    q: ['A treadmill. Maybe after work...'],
    z: ['A server rack. The fans are roaring.', 'Rows of blinking lights. Something is definitely computing.'],
    y: ['A rack of computers crunching numbers.'],
    u: ['A stretcher, freshly made up. Hopefully nobody needs it today.'],
    l: ['A sturdy railing. Watch your step!'],
    g: ['Shelves stocked with chips, granola bars and pop. Snack heaven!'],
    W: ['A washing machine. Someone left their gym towels in it.'],
    O: ['A dryer. Still warm.'],
    A: ['A squat rack loaded with heavy plates. Not today.'],
    G: ['A punching bag. You give it a light jab. Ow.'],
    N: ['A row of lockers. Most of them are locked.'],
    I: ['A lat pulldown machine.'],
    e: ['A rack of dumbbells, neatly sorted by weight.'],
    h: ['A shower stall.'],
    r: ['The reception desk.\nWelcome to Richmond!'],
    '=': ['A cubicle wall covered in pushpins.'],
    X: ['It\'s an exit.\nNo sneaking out early!'],
    o: ['A big exercise ball. Nathan swears it\'s great for his back.'],
    B: ['A box of tangled cables and old keyboards.', 'A box labelled MISC PARTS - DO NOT TOSS!'],
    H: ['Shelves crammed with hard drives, graphics cards and mystery cables.'],
    J: ['A heap of old monitors and computer towers.'],
    F: ['A big air handling fan. It hums loudly.'],
    R: ['The reception computer. The visitor log is open.'],
    Z: ['A table full of candy! You sneak one. Shh...'],
    L: ['A cooling coil. Cold air is blowing off it.'],
    K: ['An electrical control panel full of blinking lights.', 'A panel of switches. Best not to flip any.'],
    V: ['A big TV. Someone left the news on.'],
    Q: ['A TV for video calls. The remote is missing.'],
    U: ['Cupboards stocked with paper, pens and sticky notes.', 'Boxes of staples, binder clips and printer paper.'],
    Y: ['A printer. It\'s out of toner. Again.', 'The printer is warming up...'],
  };

  // ---------- player / world ----------
  const S0 = MAPS.start;
  const P = { floor: S0.floor, x: S0.x, y: S0.y, dir: S0.dir, moving: false, prog: 0, mdx: 0, mdy: 0, speed: 1, step: 0, turnWait: 0, walked: false, bump: 0 };
  let mode = 'title', tick = 0, roomName = null, curRoom = null, banner = null;
  let fade = null; // {t, cb}

  function showBanner(t) { banner = { text: t, t: 0 }; }
  function updateRoom() {
    const r = roomAt(P.floor, P.x, P.y), name = r ? r.name : null;
    if (name === roomName) return;
    const prev = curRoom;
    roomName = name; curRoom = r;
    if (!r) return;
    // stepping out of a cubicle back into its open office doesn't re-announce it
    if (!(prev && prev.parent === name)) showBanner(name);
    if (r.say) say(r.say);
  }

  function startFade(cb) { fade = { t: 0, cb }; }
  function warpTo(end) {
    startFade(() => {
      P.floor = end.floor;
      [P.x, P.y, P.dir] = end.arrive;
      P.moving = false; P.walked = false; P.bump = 0;
      curRoom = roomAt(P.floor, P.x, P.y);
      roomName = curRoom ? curRoom.name : null;
      showBanner(MAPS.floors[P.floor].name);
    });
  }

  function onArrive() {
    if (tileAt(P.floor, P.x, P.y) === 'S') {
      const ends = findLink(P.floor, P.x, P.y);
      const other = ends && ends.find((e) => e.floor !== P.floor);
      if (other) { sfx('stairs'); warpTo(other); return; }
    }
    // the curtain swings shut once you've left the room behind it
    if (curtainOpen === P.floor && tileAt(P.floor, P.x, P.y) !== 'C') {
      const r = roomAt(P.floor, P.x, P.y);
      if (!(r && r.curtain)) curtainOpen = null;
    }
    updateRoom();
  }

  // Message if (x, y) -- or the room behind a doorway at (x, y) -- is a
  // bathroom for the other gender.
  function genderBlock(x, y, dx, dy) {
    let r = roomAt(P.floor, x, y);
    if (!r && tileAt(P.floor, x, y) === 'D') r = roomAt(P.floor, x + dx, y + dy);
    if (!r || !r.gender || r.gender === pick.gender) return null;
    return 'You can\'t go into the ' + (r.gender === 'male' ? 'boys\'' : 'girls\'') + ' bathroom!';
  }

  function walkable(fi, x, y) {
    const t = tileAt(fi, x, y);
    return WALKABLE.includes(t) || (t === 'C' && curtainOpen === fi);
  }

  function tryMove(d) {
    const [dx, dy] = DIRS[d];
    const blocked = genderBlock(P.x + dx, P.y + dy, dx, dy);
    if (blocked) { P.walked = false; say(blocked); return; }
    if (walkable(P.floor, P.x + dx, P.y + dy) && !npcAt(P.floor, P.x + dx, P.y + dy)) {
      Object.assign(P, { moving: true, prog: 0, mdx: dx, mdy: dy, speed: held.b ? 2 : 1, bump: 0 });
      P.step ^= 1;
    } else {
      if (P.bump % 24 === 0) sfx('bump');
      P.bump++;
      P.walked = false;
    }
  }

  function interact() {
    const [dx, dy] = DIRS[P.dir];
    const tx = P.x + dx, ty = P.y + dy, t = tileAt(P.floor, tx, ty);
    const npc = npcAt(P.floor, tx, ty);
    if (npc) {
      if (!npc.moving) npc.dir = OPPOSITE[P.dir];
      sfx('select');
      say(npc.lines[Math.floor(Math.random() * npc.lines.length)]);
      return;
    }
    if (t === 'E') {
      const ends = findLink(P.floor, tx, ty);
      const names = MAPS.floors.map((f, i) => (i === 0 ? 'GROUND' : i + 1 + 'F'));
      sfx('select');
      ask('The elevator. Which floor?', names.concat(['CANCEL']), (i) => {
        if (i < 0 || i >= names.length) return;
        if (i === P.floor) { say('You\'re already on this floor.'); return; }
        sfx('ding');
        warpTo(ends.find((e) => e.floor === i));
      });
      return;
    }
    if (t === 'C') {
      if (curtainOpen === P.floor) return;
      sfx('select');
      ask('Peek around the curtain?', ['YES', 'NO'], (i) => {
        if (i === 0) { curtainOpen = P.floor; sfx('menu'); }
      });
      return;
    }
    const msgs = INFO[t];
    if (msgs) { sfx('select'); say(msgs[(tx * 3 + ty * 5) % msgs.length]); }
  }

  function updatePlayer() {
    if (P.moving) {
      P.prog += P.speed;
      if (P.prog < 16) return;
      P.moving = false; P.prog = 0;
      P.x += P.mdx; P.y += P.mdy;
      P.walked = true;
      onArrive();
      if (fade) return;
    }
    if (pressed.has('start')) { openStartMenu(); return; }
    if (pressed.has('map')) { sfx('menu'); ui.push(MapView()); return; }
    if (pressed.has('a')) { interact(); return; }
    const d = heldDir();
    if (!d) { P.walked = false; P.turnWait = 0; P.bump = 0; return; }
    if (d !== P.dir) {
      P.dir = d; P.bump = 0;
      if (!P.walked) { P.turnWait = 6; return; }
    }
    if (P.turnWait > 0) { P.turnWait--; return; }
    tryMove(d);
  }

  function update() {
    tick++;
    if (fade) {
      fade.t++;
      if (fade.t === 16) fade.cb();
      if (fade.t >= 32) fade = null;
    } else if (mode === 'title') {
      if (pressed.has('a') || pressed.has('start')) { sfx('menu'); mode = 'select'; }
    } else if (mode === 'select') {
      updateSelect();
    } else if (ui.length) {
      top().update();
    } else {
      updatePlayer();
      updateNpcs();
    }
    if (banner && ++banner.t > 150) banner = null;
    pressed.clear();
  }

  // ---------- character select ----------
  function updateSelect() {
    const n = Art.LOOKS[pick.gender].length;
    if (pressed.has('left')) { pick.index = (pick.index + n - 1) % n; sfx('select'); }
    if (pressed.has('right')) { pick.index = (pick.index + 1) % n; sfx('select'); }
    if (pressed.has('up') || pressed.has('down')) {
      pick.gender = pick.gender === 'male' ? 'female' : 'male';
      pick.index = Math.min(pick.index, Art.LOOKS[pick.gender].length - 1);
      sfx('select');
    }
    if (pressed.has('a') || pressed.has('start')) {
      sfx('menu');
      store.set('gender', pick.gender); store.set('look', pick.index);
      sprites = charSprites[pick.gender][pick.index];
      startFade(() => { mode = 'play'; roomName = null; curRoom = null; updateRoom(); });
    }
  }

  function drawSelect() {
    ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = col.dark; ring(4, 4, SW - 8, SH - 8); ring(6, 6, SW - 12, SH - 12);
    const title = 'Choose your character';
    text(title, (SW - title.length * 12) >> 1, 20, 2);
    GENDERS.forEach((g, gi) => {
      const y = 62 + gi * 74, label = g.toUpperCase();
      text(label, 24, y - 2);
      charSprites[g].forEach((sp, i) => {
        const x = 36 + i * 70, sel = pick.gender === g && pick.index === i;
        const frame = sel ? [1, 0, 2, 0][(tick >> 3) & 3] : 0;
        ctx.drawImage(sp.down[frame], x, y + 12, 48, 48);
        if (sel) { ctx.fillStyle = col.dark; ring(x - 6, y + 6, 60, 60); ring(x - 5, y + 7, 58, 58); }
      });
    });
    text('Arrows: choose    A: start', (SW - 26 * 6) >> 1, SH - 24);
  }

  // ---------- render ----------
  function frameIndex() {
    const walkFrame = P.step ? 1 : 2;
    if (P.moving) return P.prog < 8 ? walkFrame : 0;
    if (P.bump) return (P.bump >> 3) & 1 ? walkFrame : 0;
    return 0;
  }

  function drawWorld() {
    const px = P.x * 16 + (P.moving ? P.mdx * P.prog : 0);
    const py = P.y * 16 + (P.moving ? P.mdy * P.prog : 0);
    const ox = (SW - 16) >> 1, oy = (SH - 16) >> 1;
    const cx = px - ox, cy = py - oy;
    const cv = floorCanvas[P.floor];
    let sx = cx, sy = cy, dx = 0, dy = 0, w = SW, h = SH;
    if (sx < 0) { dx = -sx; w += sx; sx = 0; }
    if (sy < 0) { dy = -sy; h += sy; sy = 0; }
    w = Math.min(w, cv.width - sx); h = Math.min(h, cv.height - sy);
    if (w > 0 && h > 0) ctx.drawImage(cv, sx, sy, w, h, dx, dy, w, h);
    if (curtainOpen === P.floor)
      for (const c of curtains[P.floor]) ctx.drawImage(c.open, c.x * 16 - cx, c.y * 16 - cy);
    // people, drawn back to front so nearer ones overlap farther ones
    const actors = [{ x: px, y: py, img: sprites[P.dir][frameIndex()] }];
    for (const n of npcs) {
      if (n.floor !== P.floor) continue;
      const frame = n.moving && n.prog < 8 ? (n.step ? 1 : 2) : 0;
      actors.push({ x: n.x * 16 + (n.moving ? n.mdx * n.prog : 0), y: n.y * 16 + (n.moving ? n.mdy * n.prog : 0),
        img: n.sprites[n.dir][frame], ghost: n.ghost });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      const sx = a.x - cx, sy = a.y - cy - 4;
      if (!(sx > -16 && sx < SW && sy > -20 && sy < SH)) continue;
      if (a.ghost) {
        // ghosts are see-through and bob up and down
        ctx.globalAlpha = 0.75;
        ctx.drawImage(a.img, sx, sy - 2 + Math.round(Math.sin(tick / 12 + a.x) * 2));
        ctx.globalAlpha = 1;
      } else ctx.drawImage(a.img, sx, sy);
    }
    // rooms with the lights off (drawn over the player too)
    ctx.fillStyle = 'rgba(8, 8, 28, 0.78)';
    for (const r of MAPS.floors[P.floor].rooms)
      if (r.dark) ctx.fillRect(r.x1 * 16 - cx, r.y1 * 16 - cy - 4, (r.x2 - r.x1 + 1) * 16, (r.y2 - r.y1 + 1) * 16 + 4);
  }

  function drawBanner() {
    if (!banner) return;
    const w = banner.text.length * 6 + 16, t = banner.t;
    const y = t < 8 ? -24 + t * 3 : t > 142 ? -(t - 142) * 3 : 0;
    box(0, y, w, 24);
    text(banner.text, 8, y + 8);
  }

  function drawTitle() {
    ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = col.dark; ring(4, 4, SW - 8, SH - 8); ring(6, 6, SW - 12, SH - 12);
    const t0 = (SH - 144) >> 1;
    text('RICHMOND', (SW - 8 * 12) >> 1, t0 + 22, 2);
    text('OFFICE', (SW - 6 * 12) >> 1, t0 + 44, 2);
    ctx.drawImage(charSprites.male[0].down[(tick >> 4) & 1 ? 1 : 2], (SW >> 1) - 36, t0 + 70, 32, 32);
    ctx.drawImage(charSprites.female[0].down[(tick >> 4) & 1 ? 2 : 1], (SW >> 1) + 4, t0 + 70, 32, 32);
    if ((tick >> 5) & 1) text('PRESS START', (SW - 11 * 6) >> 1, t0 + 118);
  }

  function draw() {
    ctx.fillStyle = col.dark;
    ctx.fillRect(0, 0, SW, SH);
    if (mode === 'title') drawTitle();
    else if (mode === 'select') drawSelect();
    else {
      drawWorld();
      drawBanner();
      ui.forEach((el) => el.draw());
    }
    if (fade) {
      const lvl = fade.t < 16 ? fade.t / 16 : (32 - fade.t) / 16;
      ctx.globalAlpha = Math.min(1, Math.ceil(lvl * 4) / 4);
      ctx.fillStyle = col.light;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- layout ----------
  const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || /[#&]touch/.test(location.hash);
  document.body.classList.toggle('touch', isTouch);
  function layout() {
    const vw = innerWidth, vh = innerHeight, portrait = vh >= vw;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', !portrait);
    let aw, ah;
    if (!isTouch) { aw = vw - 48; ah = vh - 90; }
    else if (portrait) { aw = vw - 40; ah = vh * 0.56; }
    else { aw = vw - 380; ah = vh - 70; }
    let s = Math.min(aw / SW, ah / SH);
    if (s >= 2) s = Math.floor(s);
    s = Math.max(0.5, s);
    canvas.style.width = SW * s + 'px';
    canvas.style.height = SH * s + 'px';
  }
  addEventListener('resize', layout);
  addEventListener('orientationchange', layout);

  // Testing shortcut: index.html#play&f=1&x=40&y=20&char=female:2
  if (location.hash.startsWith('#play')) {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.has('f')) P.floor = +q.get('f');
    if (q.has('x')) { P.x = +q.get('x'); P.y = +q.get('y'); }
    if (q.has('char')) { const [g, i] = q.get('char').split(':'); pick.gender = g; sprites = charSprites[g][+i || 0]; }
    if (q.has('dir')) P.dir = q.get('dir');
    mode = q.has('title') ? 'title' : q.has('select') ? 'select' : 'play';
    updateRoom();
    if (q.has('say')) ask('The elevator. Which floor?', ['GROUND', '2F', 'CANCEL'], () => {});
    if (q.has('menu')) openStartMenu();
    if (q.has('map')) ui.push(MapView());
  }

  // ---------- main loop ----------
  layout();
  if (location.hash.startsWith('#play')) {
    const q = new URLSearchParams(location.hash.slice(1));
    // keys=left:40,a:1  -> hold each key for N ticks, in order
    for (const part of (q.get('keys') || '').split(',').filter(Boolean)) {
      const [k, n] = part.split(':');
      press(k);
      for (let i = 0; i < +n; i++) update();
      release(k);
    }
    const n = +q.get('ticks') || 0;
    for (let i = 0; i < n; i++) update();
  }
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose a little state for debugging in the console.
  window.GAME = { P, MAPS, warpTo, npcs };
})();
