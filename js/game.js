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
  // Short burst of filtered noise (the "splash" part of a pour).
  function noise(dur, freq, vol) {
    const t = actx.currentTime, n = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.5;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start(t);
  }
  const SFX = {
    // liquid pouring into a cup: a rising "glug" that gets higher as it fills
    pour: (level) => {
      const base = 240 + (level || 0) * 4;
      tone(base, 0.08, 'sine', 0.07, 180);
      noise(0.06, 900 + (level || 0) * 12, 0.05);
    },
    bump: () => tone(90, 0.08, 'square', 0.05),
    select: () => tone(1320, 0.05),
    menu: () => { tone(880, 0.04); tone(1320, 0.05, 'square', 0.04, 0, 0.05); },
    stairs: () => tone(700, 0.3, 'square', 0.03, -450),
    ding: () => { tone(1568, 0.35, 'triangle', 0.08); tone(1319, 0.5, 'triangle', 0.08, 0, 0.2); },
    hit: (pts) => { noise(0.14, 260 + (pts || 0) * 2, 0.08 + (pts || 0) / 1200); tone(120, 0.15, 'square', 0.06, -70); },
    jump: () => tone(320, 0.12, 'square', 0.035, 380),
    blip: (hi) => tone(hi ? 880 : 440, 0.04, 'square', 0.05),
    swish: () => { noise(0.25, 2200, 0.06); tone(600, 0.15, 'triangle', 0.05, 500, 0.1); },
  };
  function sfx(name, arg) { if (soundOn && actx) SFX[name](arg); }

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
    Enter: 'start', KeyM: 'map',
  };
  // Esc backs out of any menu or mini-game (like B); while walking around it opens the start menu.
  let escAs = 'b';
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !e.repeat) escAs = mode === 'play' && !ui.length && !fade ? 'start' : 'b';
    const k = e.code === 'Escape' ? escAs : KEYS[e.code];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) press(k);
  });
  addEventListener('keyup', (e) => { const k = e.code === 'Escape' ? escAs : KEYS[e.code]; if (k) release(k); });
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
        text('Esc: close', 10, ty + 34);
      },
    };
    return self;
  }

  // ---------- office computers: a desktop with the SDG program on it ----------
  const sdgIcon = new Image();
  sdgIcon.src = 'assets/sdg.png';
  function ComputerScreen() {
    let sel = 0, state = 'desktop', t = 0;
    const OPTIONS = ['Open SDG', 'Exit'];
    const self = {
      update() {
        t++;
        if (state === 'loading') {
          if (t > 90) { state = 'desktop'; ui.push(SdgApp()); }
          return;
        }
        if (['left', 'right', 'up', 'down'].some((k) => pressed.has(k))) { sel ^= 1; sfx('select'); }
        if (pressed.has('b')) { sfx('select'); remove(self); return; }
        if (pressed.has('a')) {
          sfx('select');
          if (sel === 1) remove(self);
          else { state = 'loading'; t = 0; }
        }
      },
      draw() {
        ctx.fillStyle = col.dark; ctx.fillRect(0, 0, SW, SH);
        // monitor
        ctx.fillStyle = '#181820'; ctx.fillRect(22, 6, 276, 192);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(24, 8, 272, 188);
        ctx.fillStyle = '#181820'; ctx.fillRect(34, 18, 252, 164);
        ctx.fillStyle = '#2f6ea8'; ctx.fillRect(36, 20, 248, 160);
        ctx.fillStyle = '#58a848'; ctx.fillRect(280, 188, 4, 3); // power light
        // stand
        ctx.fillStyle = '#181820'; ctx.fillRect(138, 196, 44, 8); ctx.fillRect(112, 204, 96, 4);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(140, 196, 40, 7); ctx.fillRect(114, 204, 92, 3);
        // taskbar
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(36, 168, 248, 12);
        ctx.fillStyle = '#181820'; ctx.fillRect(36, 168, 248, 1);
        text('START', 40, 170); text('9:41', 254, 170);
        // SDG icon
        const ix = 129, iy = 54;
        if (sdgIcon.complete && sdgIcon.naturalWidth) ctx.drawImage(sdgIcon, ix, iy, 62, 64);
        if (sel === 0 && state === 'desktop' && (tick >> 4) & 1) {
          ctx.fillStyle = '#f8f8f8'; ring(ix - 3, iy - 3, 68, 70);
        }
        text('SDG', ix + 22, iy + 70, 1, '#f8f8f8');
        if (state === 'loading') {
          box(80, 76, 160, 48);
          text('Starting SDG...', 80 + 35, 88);
          ctx.fillStyle = col.dark; ring(96, 104, 128, 10);
          ctx.fillStyle = '#58a848'; ctx.fillRect(98, 106, Math.round(124 * Math.min(1, t / 80)), 6);
        }
        // options
        box(0, SH - 28, SW, 28);
        OPTIONS.forEach((o, i) => {
          const x = i === 0 ? 40 : 200;
          text(o, x, SH - 18);
          if (sel === i) text('>', x - 10, SH - 18);
        });
      },
    };
    return self;
  }

  // ---------- SDG: lay out an air handling unit, component by component ----------
  const sdgComps = []; // kept while the game is open, so your unit is still there next time
  const COMP_TYPES = ['Wall', 'Space', 'Fan', 'Coil'];
  const COMP_W = { Wall: 6, Space: 18, Fan: 34, Coil: 16 };
  const WIN = '#c8ccd8', WIN_DARK = '#8890a0', TITLE = '#2850a0', INK = '#181820';

  // Draw one component's slice of the unit (including its bit of the top and
  // bottom casing) with its left edge at x. y0/h are the unit's outer box.
  function drawComp(type, x, y0, h) {
    const w = COMP_W[type], CAS = 6, top = y0 + CAS, bot = y0 + h - CAS;
    // casing
    ctx.fillStyle = INK; ctx.fillRect(x, y0, w, CAS); ctx.fillRect(x, bot, w, CAS);
    ctx.fillStyle = '#a8b0c0'; ctx.fillRect(x, y0 + 1, w, CAS - 2); ctx.fillRect(x, bot + 1, w, CAS - 2);
    if (type === 'Wall') {
      ctx.fillStyle = INK; ctx.fillRect(x, top, w, bot - top);
      ctx.fillStyle = '#a8b0c0'; ctx.fillRect(x + 1, top, w - 2, bot - top);
    } else if (type === 'Fan') {
      // motor on a tall pedestal so the fan sits in the middle of the unit
      const cy = Math.round((top + bot) / 2), motorY = cy - 6;
      // pedestal + motor
      ctx.fillStyle = INK; ctx.fillRect(x + 4, motorY + 10, 9, bot - motorY - 10);
      ctx.fillStyle = '#686878'; ctx.fillRect(x + 5, motorY + 11, 7, bot - motorY - 11);
      ctx.fillStyle = INK; ctx.fillRect(x + 2, motorY, 14, 12);
      ctx.fillStyle = '#585868'; ctx.fillRect(x + 3, motorY + 1, 12, 10);
      ctx.fillStyle = '#8890a0'; ctx.fillRect(x + 4, motorY + 2, 10, 2);
      // shaft
      ctx.fillStyle = INK; ctx.fillRect(x + 16, cy - 1, 4, 2);
      // fan housing flaring out to the right
      for (let i = 0; i < 14; i++) {
        const hh = 8 + i * 2, xx = x + 20 + i;
        ctx.fillStyle = INK; ctx.fillRect(xx, cy - hh / 2, 1, hh);
        if (i > 0 && i < 13) { ctx.fillStyle = '#d8dce8'; ctx.fillRect(xx, cy - hh / 2 + 1, 1, hh - 2); }
      }
    } else if (type === 'Coil') {
      const cTop = top + 4, cBot = bot - 4;
      ctx.fillStyle = INK; ctx.fillRect(x + 1, cTop, w - 2, cBot - cTop);
      ctx.fillStyle = '#e0c898'; ctx.fillRect(x + 2, cTop + 1, w - 4, cBot - cTop - 2);
      ctx.fillStyle = '#9a6434';
      for (let fx = x + 4; fx < x + w - 3; fx += 3) ctx.fillRect(fx, cTop + 3, 1, cBot - cTop - 14);
      // pipe connections near the bottom
      ctx.fillStyle = INK; ctx.fillRect(x + 4, cBot - 8, 3, 3); ctx.fillRect(x + 8, cBot - 9, 4, 5);
      ctx.fillStyle = '#c87830'; ctx.fillRect(x + 9, cBot - 8, 2, 3);
    }
  }

  function SdgApp() {
    // sel: highlighted component. mode: 'main' | 'add' | 'insert' | 'move'
    let btn = 0, mode = 'main', addSel = 0, sel = sdgComps.length - 1;
    const BUTTONS = ['Add', 'Insert', 'Move', 'Delete', 'Exit'];
    const LIST = { x: 6, y: 20, w: 82, h: 186 };
    const VIEW = { x: 94, y: 20, w: 220, h: 186 };
    function bevel(x, y, w, h, pressedIn) {
      ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = pressedIn ? WIN_DARK : '#f8f8f8'; ctx.fillRect(x, y, w - 1, h - 1);
      ctx.fillStyle = pressedIn ? '#f8f8f8' : WIN_DARK; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = WIN; ctx.fillRect(x + 1, y + 1, w - 3, h - 3);
    }
    function moveSel(d) {
      if (!sdgComps.length) return;
      const n = Math.max(0, Math.min(sdgComps.length - 1, sel + d));
      if (n === sel) return;
      if (mode === 'move') [sdgComps[sel], sdgComps[n]] = [sdgComps[n], sdgComps[sel]];
      sel = n; sfx('select');
    }
    const self = {
      update() {
        if (mode === 'add' || mode === 'insert') {
          if (pressed.has('up')) { addSel = (addSel + COMP_TYPES.length - 1) % COMP_TYPES.length; sfx('select'); }
          if (pressed.has('down')) { addSel = (addSel + 1) % COMP_TYPES.length; sfx('select'); }
          if (pressed.has('a')) {
            const c = COMP_TYPES[addSel];
            if (mode === 'insert' && sel >= 0) sdgComps.splice(sel, 0, c);
            else { sdgComps.push(c); sel = sdgComps.length - 1; }
            mode = 'main'; sfx('menu');
          } else if (pressed.has('b')) { mode = 'main'; sfx('select'); }
          return;
        }
        if (pressed.has('up')) moveSel(-1);
        if (pressed.has('down')) moveSel(1);
        if (mode === 'move') {
          if (pressed.has('a') || pressed.has('b')) { mode = 'main'; sfx('menu'); }
          return;
        }
        if (pressed.has('left')) { btn = (btn + BUTTONS.length - 1) % BUTTONS.length; sfx('select'); }
        if (pressed.has('right')) { btn = (btn + 1) % BUTTONS.length; sfx('select'); }
        if (pressed.has('b')) { remove(self); sfx('select'); return; }
        if (pressed.has('a')) {
          const b = BUTTONS[btn];
          sfx('select');
          if (b === 'Add') mode = 'add';
          else if (b === 'Insert') mode = 'insert';
          else if (b === 'Move') { if (sdgComps.length > 1) mode = 'move'; }
          else if (b === 'Delete') {
            if (sel >= 0) { sdgComps.splice(sel, 1); sel = Math.min(sel, sdgComps.length - 1); }
          } else remove(self);
        }
      },
      draw() {
        // window + title bar
        ctx.fillStyle = WIN; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = TITLE; ctx.fillRect(0, 0, SW, 14);
        if (sdgIcon.complete && sdgIcon.naturalWidth) ctx.drawImage(sdgIcon, 3, 1, 12, 12);
        text('SDG - Unit Design', 19, 3, 1, '#f8f8f8');
        ctx.fillStyle = INK; ctx.fillRect(SW - 13, 2, 10, 10);
        ctx.fillStyle = WIN; ctx.fillRect(SW - 12, 3, 8, 8);
        text('x', SW - 11, 1, 1, INK);

        // component list, scrolled to keep the selection visible
        const L = LIST;
        ctx.fillStyle = INK; ctx.fillRect(L.x, L.y, L.w, L.h);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(L.x + 1, L.y + 1, L.w - 2, L.h - 2);
        text('Comps', L.x + 6, L.y + 4);
        ctx.fillStyle = INK; ctx.fillRect(L.x + 1, L.y + 15, L.w - 2, 1);
        const rows = Math.floor((L.h - 20) / 11);
        const first = Math.max(0, Math.min(sel - Math.floor(rows / 2), sdgComps.length - rows));
        sdgComps.slice(first, first + rows).forEach((c, i) => {
          const idx = first + i, yy = L.y + 20 + i * 11;
          let ink = INK;
          if (idx === sel) {
            ctx.fillStyle = mode === 'move' ? '#c03030' : TITLE;
            ctx.fillRect(L.x + 3, yy - 2, L.w - 6, 11);
            ink = '#f8f8f8';
          }
          text((idx + 1) + ' ' + c, L.x + 5, yy, 1, ink);
        });
        if (!sdgComps.length) text('(empty)', L.x + 5, L.y + 20, 1, WIN_DARK);

        // graphical view
        const V = VIEW;
        ctx.fillStyle = INK; ctx.fillRect(V.x, V.y, V.w, V.h);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(V.x + 1, V.y + 1, V.w - 2, V.h - 2);
        if (!sdgComps.length) {
          text('Add a component', V.x + 65, V.y + 82, 1, WIN_DARK);
          text('to start your unit', V.x + 59, V.y + 94, 1, WIN_DARK);
        } else {
          const total = sdgComps.reduce((n, c) => n + COMP_W[c], 0);
          const pad = 8, room = V.w - pad * 2, H = 80;
          const k = total * 2 <= room ? 2 : 1; // draw big while it fits
          const w = total * k;
          // offset of the selected component, so it can be kept in view
          let selX = 0;
          for (let i = 0; i < sel; i++) selX += COMP_W[sdgComps[i]];
          let x0 = V.x + pad + (w <= room ? Math.floor((room - w) / 2) : 0);
          if (w > room) x0 -= Math.max(0, Math.min(w - room, (selX + COMP_W[sdgComps[sel]] / 2) * k - room / 2));
          const y0 = V.y + Math.floor((V.h - 12 - H * k) / 2);
          ctx.save();
          ctx.beginPath(); ctx.rect(V.x + 1, V.y + 1, V.w - 2, V.h - 2); ctx.clip();
          ctx.translate(x0, y0); ctx.scale(k, k);
          let x = 0;
          sdgComps.forEach((c, i) => {
            drawComp(c, x, 0, H);
            if (i === sel && (mode !== 'move' || (tick >> 3) & 1)) {
              ctx.fillStyle = mode === 'move' ? '#c03030' : '#3060d0';
              const cw = COMP_W[c];
              ctx.fillRect(x, -4, cw, 1); ctx.fillRect(x, H + 3, cw, 1);
              ctx.fillRect(x, -4, 1, H + 8); ctx.fillRect(x + cw - 1, -4, 1, H + 8);
            }
            x += COMP_W[c];
          });
          ctx.restore();
          text(mode === 'move' ? 'Up/Down: move  Space: done' : 'Up/Down: select',
            V.x + 6, V.y + V.h - 12, 1, mode === 'move' ? '#c03030' : WIN_DARK);
        }

        // buttons
        let bx = 6;
        BUTTONS.forEach((b, i) => {
          const bw = b.length * 6 + 14;
          bevel(bx, 214, bw, 18, false);
          text(b, bx + 7, 219, 1, mode === 'move' ? WIN_DARK : INK);
          if (i === btn && mode === 'main') { ctx.fillStyle = INK; ring(bx + 3, 217, bw - 6, 12); }
          bx += bw + 6;
        });

        // add / insert popup
        if (mode === 'add' || mode === 'insert') {
          const px = 104, py = 56, pw = 112, ph = 30 + COMP_TYPES.length * 14;
          ctx.fillStyle = 'rgba(24,24,32,0.35)'; ctx.fillRect(0, 14, SW, SH - 14);
          bevel(px, py, pw, ph, false);
          ctx.fillStyle = TITLE; ctx.fillRect(px + 2, py + 2, pw - 5, 12);
          text(mode === 'insert' && sel >= 0 ? 'INSERT COMP' : 'ADD COMP', px + 6, py + 4, 1, '#f8f8f8');
          COMP_TYPES.forEach((c, i) => {
            const yy = py + 20 + i * 14;
            if (i === addSel) { ctx.fillStyle = TITLE; ctx.fillRect(px + 6, yy - 2, pw - 14, 12); }
            text('- ' + c.toLowerCase(), px + 10, yy, 1, i === addSel ? '#f8f8f8' : INK);
          });
        }
      },
    };
    return self;
  }

  // ---------- coffee mini-game: move the cup to catch falling coffee ----------
  let coffeesToday = 0;
  function CoffeeGame() {
    const AX = 12, AW = 248, HEAD = 18, CUP_Y = 184, CUP_W = 44, CUP_H = 34, FLOOR = 220;
    const COFFEE = '#6b3a1e', CREMA = '#b07040';
    const METER = { x: 280, y: 40, w: 24, h: 168 };
    let cup = AX + AW / 2 - CUP_W / 2, fill = 0, caught = 0, missed = 0, t = 0, state = 'ready';
    let nozzle = AX + AW / 2, target = nozzle, drops = [], splashes = [];
    const self = {
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            coffeesToday++;
            say(coffeesToday === 1
              ? 'You made a cup of coffee. Ahh, that hits the spot!'
              : 'Another cup of coffee! That\'s ' + coffeesToday + ' today...');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the coffee for later.'); return; }
        if (held.left) cup = Math.max(AX, cup - 3);
        if (held.right) cup = Math.min(AX + AW - CUP_W, cup + 3);
        // the nozzle wanders back and forth, faster as the cup fills
        if (Math.abs(target - nozzle) < 2) target = AX + 12 + Math.random() * (AW - 24);
        nozzle += Math.sign(target - nozzle) * Math.min(Math.abs(target - nozzle), 1 + fill / 40);
        if (t % 8 === 0) drops.push({ x: nozzle - 1 + (Math.random() * 4 - 2), y: HEAD + 22, vy: 1 });
        for (const d of drops) { d.vy = Math.min(d.vy + 0.08, 4); d.y += d.vy; }
        drops = drops.filter((d) => {
          if (d.y + 6 >= CUP_Y && d.y < CUP_Y + 8 && d.x + 3 > cup + 3 && d.x < cup + CUP_W - 3) {
            fill = Math.min(100, fill + 2); caught++;
            sfx('pour', fill);
            splashes.push({ x: d.x, y: CUP_Y + 2, t: 0 });
            return false;
          }
          if (d.y > FLOOR - 4) { missed++; splashes.push({ x: d.x, y: FLOOR - 2, t: 0 }); return false; }
          return true;
        });
        splashes.forEach((sp) => sp.t++);
        splashes = splashes.filter((sp) => sp.t < 12);
        if (fill >= 100) { state = 'done'; t = 0; drops = []; sfx('ding'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Catch the coffee!', AX + 4, 6);
        // machine head + nozzle
        ctx.fillStyle = col.dark; ctx.fillRect(AX, HEAD, AW, 14);
        ctx.fillStyle = '#585868'; ctx.fillRect(AX + 1, HEAD + 1, AW - 2, 12);
        ctx.fillStyle = col.dark; ctx.fillRect(Math.round(nozzle) - 6, HEAD + 13, 12, 8);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(Math.round(nozzle) - 5, HEAD + 14, 10, 6);
        if (state === 'play') { ctx.fillStyle = COFFEE; ctx.fillRect(Math.round(nozzle) - 1, HEAD + 21, 2, 3); }
        // falling coffee
        for (const d of drops) {
          ctx.fillStyle = COFFEE; ctx.fillRect(Math.round(d.x), Math.round(d.y), 3, 6);
          ctx.fillStyle = CREMA; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
        }
        // counter
        ctx.fillStyle = col.dark; ctx.fillRect(AX, FLOOR, AW, 1);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(AX, FLOOR + 1, AW, 5);
        // cup, filling up as you catch coffee
        const cx0 = Math.round(cup), inner = CUP_H - 4, lvl = Math.round(inner * fill / 100);
        ctx.fillStyle = col.dark; ctx.fillRect(cx0, CUP_Y, CUP_W, CUP_H);
        ctx.fillRect(cx0 + CUP_W, CUP_Y + 8, 7, 16);
        ctx.fillStyle = col.light; ctx.fillRect(cx0 + CUP_W, CUP_Y + 11, 4, 10);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(cx0 + 2, CUP_Y + 2, CUP_W - 4, CUP_H - 4);
        ctx.fillStyle = COFFEE; ctx.fillRect(cx0 + 2, CUP_Y + 2 + inner - lvl, CUP_W - 4, lvl);
        if (lvl) { ctx.fillStyle = CREMA; ctx.fillRect(cx0 + 2, CUP_Y + 2 + inner - lvl, CUP_W - 4, 1); }
        // name on a sleeve around the cup
        ctx.fillStyle = col.dark; ctx.fillRect(cx0, CUP_Y + 12, CUP_W, 13);
        ctx.fillStyle = '#e8d4b0'; ctx.fillRect(cx0 + 1, CUP_Y + 13, CUP_W - 2, 11);
        text('Haakon', cx0 + 4, CUP_Y + 15, 1, '#5a3420');
        // splashes
        for (const sp of splashes) {
          ctx.fillStyle = COFFEE;
          const dx = 2 + sp.t, dy = Math.round(sp.t * 0.8) - Math.round(sp.t * sp.t * 0.06);
          ctx.fillRect(Math.round(sp.x) - dx, sp.y - dy, 2, 2);
          ctx.fillRect(Math.round(sp.x) + dx, sp.y - dy, 2, 2);
        }
        // fill meter
        const m = METER, mh = Math.round((m.h - 4) * fill / 100);
        text('FILL', m.x, m.y - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.fillStyle = col.light; ctx.fillRect(m.x + 2, m.y + 2, m.w - 4, m.h - 4);
        ctx.fillStyle = COFFEE; ctx.fillRect(m.x + 2, m.y + m.h - 2 - mh, m.w - 4, mh);
        ctx.fillStyle = CREMA;
        for (let yy = m.y + m.h - 2 - mh; yy < m.y + m.h - 2; yy += 8) ctx.fillRect(m.x + 2, yy, m.w - 4, 1);
        text(Math.floor(fill) + '%', m.x, m.y + m.h + 4);
        // messages
        if (state === 'ready') {
          box(70, 92, 180, 48);
          text(t < 50 ? 'Get ready...' : 'GO!', 70 + (t < 50 ? 54 : 81), 104);
          text('Left/Right: move cup', 70 + 30, 120);
        } else if (state === 'done') {
          box(50, 76, 220, 72);
          text("Coffee's ready!", 50 + 65, 88);
          text('Caught ' + caught + '   Spilled ' + missed, 50 + 110 - (('Caught ' + caught + '   Spilled ' + missed).length * 3), 108);
          if (t > 30 && (tick >> 4) & 1) text('Press Space', 50 + 77, 128);
        } else {
          text('Esc: give up', AX + 4, SH - 16);
        }
      },
    };
    return self;
  }

  // ---------- shared bits for the arcade mini-games ----------
  const ctext = (str, y, color) => text(str, (SW - str.length * 6) >> 1, y, 1, color);
  // Save a high score; returns true if it's a new record.
  function saveBest(key, score) {
    if (score <= (+store.get('best.' + key) || 0)) return false;
    store.set('best.' + key, score);
    return true;
  }
  const getBest = (key) => +store.get('best.' + key) || 0;
  function readyBox(t, hint) {
    box(60, 92, 200, 48);
    ctext(t < 50 ? 'Get ready...' : 'GO!', 104);
    ctext(hint, 120);
  }
  function doneBox(lines, t) {
    box(40, 72, 240, 84);
    lines.forEach((l, i) => ctext(l, 86 + i * 16));
    if (t > 30 && (tick >> 4) & 1) ctext('Press Space', 136);
  }

  // ---------- punching bag: hit A when the marker is in the middle ----------
  function PunchGame() {
    const BAR = { x: 40, y: 200, w: 240, h: 12 }, BAG_X = 160, BAG_TOP = 50, BAG_W = 44, BAG_H = 96;
    const PUNCHES = 3;
    let state = 'ready', t = 0, p = 0, dir = 1, n = 0, total = 0, last = null, swing = 0, shake = 0, record = false;
    const self = {
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You hit the bag for ' + total + ' points.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You hang up the gloves.'); return; }
        swing *= 0.97; shake *= 0.85;
        if (state === 'hit') {
          if (t > 60) {
            if (n >= PUNCHES) { state = 'done'; record = saveBest('punch', total); sfx('ding'); }
            else state = 'play';
            t = 0;
          }
          return;
        }
        // the marker gets faster with every punch
        p += dir * (0.014 + n * 0.007);
        if (p >= 1) { p = 1; dir = -1; }
        if (p <= 0) { p = 0; dir = 1; }
        if (pressed.has('a')) {
          const d = Math.abs(p - 0.5);
          const pts = d < 0.04 ? 100 : d < 0.12 ? 60 : Math.max(5, Math.round(40 * (1 - d * 2)));
          last = { pts, label: pts === 100 ? 'PERFECT!' : pts === 60 ? 'GOOD!' : 'WEAK...' };
          total += pts; n++;
          swing = pts / 3; shake = pts / 12;
          sfx('hit', pts);
          state = 'hit'; t = 0;
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Punch the bag!', 16, 10);
        text('Punch ' + Math.min(n + (state === 'play' ? 1 : 0), PUNCHES) + '/' + PUNCHES, 16, 22);
        text('Score ' + total, SW - 16 - ('Score ' + total).length * 6, 10);
        text('Best ' + getBest('punch'), SW - 16 - ('Best ' + getBest('punch')).length * 6, 22);
        ctx.save();
        if (shake > 0.5) ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
        // ceiling hook and chain
        const off = Math.round(Math.sin(tick / 6) * swing);
        ctx.fillStyle = col.dark; ctx.fillRect(BAG_X - 10, 36, 20, 4);
        for (let i = 0; i < 6; i++) ctx.fillRect(BAG_X - 1 + Math.round(off * i / 6), 40 + i * 2, 2, 2);
        // bag
        const bx = BAG_X - BAG_W / 2 + off;
        ctx.fillRect(bx, BAG_TOP, BAG_W, BAG_H);
        ctx.fillStyle = '#b03030'; ctx.fillRect(bx + 2, BAG_TOP + 2, BAG_W - 4, BAG_H - 4);
        ctx.fillStyle = '#d85050'; ctx.fillRect(bx + 6, BAG_TOP + 4, 4, BAG_H - 8);
        ctx.fillStyle = col.dark;
        ctx.fillRect(bx + 2, BAG_TOP + 14, BAG_W - 4, 3); ctx.fillRect(bx + 2, BAG_TOP + BAG_H - 17, BAG_W - 4, 3);
        // glove shoots in from the left right after a punch
        if (state === 'hit' && t < 12) {
          const gx = bx - 34 + Math.min(t, 4) * 2;
          ctx.fillStyle = col.dark; ctx.fillRect(gx - 40, BAG_TOP + 40, 40, 10); ctx.fillRect(gx, BAG_TOP + 34, 26, 22);
          ctx.fillStyle = '#c02828'; ctx.fillRect(gx + 2, BAG_TOP + 36, 22, 18);
          ctx.fillStyle = '#e8b890'; ctx.fillRect(gx - 38, BAG_TOP + 42, 38, 6);
        }
        ctx.restore();
        if (state === 'hit' && last) ctext(last.label + '  +' + last.pts, 168);
        // power bar: centre zone is the sweet spot
        const B = BAR;
        ctx.fillStyle = col.dark; ctx.fillRect(B.x, B.y, B.w, B.h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(B.x + 2, B.y + 2, B.w - 4, B.h - 4);
        ctx.fillStyle = '#f0d060'; ctx.fillRect(B.x + B.w * 0.38, B.y + 2, B.w * 0.24, B.h - 4);
        ctx.fillStyle = '#58b058'; ctx.fillRect(B.x + B.w * 0.46, B.y + 2, B.w * 0.08, B.h - 4);
        const mx = Math.round(B.x + 2 + p * (B.w - 6));
        ctx.fillStyle = col.dark; ctx.fillRect(mx, B.y - 5, 2, B.h + 10);
        if (state === 'ready') readyBox(t, 'Space: punch');
        else if (state === 'done') doneBox(['Workout done!', 'Total ' + total + ' / ' + PUNCHES * 100, record ? 'New record!' : 'Best ' + getBest('punch')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- treadmill runner: jump over the gym clutter ----------
  function RunGame() {
    const FLOOR = 196, PX = 56, STAND = 28, DUCK = 14, CEIL = 36;
    // Things on the belt to jump over (h = how tall)...
    const LOW = [
      { w: 18, h: 8, draw: (x, y) => { ctx.fillStyle = col.dark; ctx.fillRect(x, y, 18, 8); ctx.fillStyle = '#58b8a8'; ctx.fillRect(x + 1, y + 1, 16, 6); ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 3, 16, 1); } },
      { w: 16, h: 12, draw: (x, y) => { ctx.fillStyle = col.dark; ctx.fillRect(x, y, 5, 12); ctx.fillRect(x + 11, y, 5, 12); ctx.fillRect(x + 4, y + 5, 8, 2); } },
      { w: 10, h: 22, draw: (x, y) => {
        ctx.fillStyle = col.dark; ctx.fillRect(x, y + 3, 10, 19); ctx.fillRect(x + 3, y, 4, 4);
        ctx.fillStyle = '#58a8e0'; ctx.fillRect(x + 1, y + 6, 8, 15);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 2, y + 7, 2, 6);
      } },
      { w: 18, h: 32, draw: (x, y) => { // a stack of weight plates
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = col.dark; ctx.fillRect(x + (i & 1), y + i * 8, 17, 8);
          ctx.fillStyle = i & 1 ? '#585868' : '#c03838'; ctx.fillRect(x + 1 + (i & 1), y + i * 8 + 1, 15, 6);
        }
      } },
    ];
    // ...and things hanging from above to duck under (gap = clearance above the belt)
    const HIGH = [
      { w: 16, gap: 20, draw: (x, y) => { // punching bag on a chain
        ctx.fillStyle = col.dark; ctx.fillRect(x + 7, CEIL, 2, y - 30 - CEIL); ctx.fillRect(x, y - 30, 16, 30);
        ctx.fillStyle = '#b03030'; ctx.fillRect(x + 1, y - 29, 14, 28);
        ctx.fillStyle = col.dark; ctx.fillRect(x + 1, y - 24, 14, 2); ctx.fillRect(x + 1, y - 7, 14, 2);
      } },
      { w: 26, gap: 20, draw: (x, y) => { // towel over a pull-up bar
        ctx.fillStyle = col.dark; ctx.fillRect(x + 2, CEIL, 2, y - 18 - CEIL); ctx.fillRect(x + 22, CEIL, 2, y - 18 - CEIL);
        ctx.fillRect(x, y - 20, 26, 3); ctx.fillRect(x + 6, y - 17, 14, 17);
        ctx.fillStyle = '#e8c048'; ctx.fillRect(x + 7, y - 17, 12, 16);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 7, y - 5, 12, 2);
      } },
    ];
    let state = 'ready', t = 0, h = 0, vy = 0, speed = 3, dist = 0, nextAt = 220, obs = [], record = false, ducking = false;
    const metres = () => Math.floor(dist / 16);
    const self = {
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You ran ' + metres() + 'm on the treadmill.' + (record ? ' A new record!' : ' Phew!'));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You step off the treadmill. Enough cardio for today.'); return; }
        // jump: tap for a hop, hold for a big jump; down ducks (or drops you faster mid-air)
        ducking = held.down && h === 0;
        if (pressed.has('a') && h === 0) { vy = 5.8; ducking = false; sfx('jump'); }
        if (!held.a && vy > 1.5) vy = 1.5;
        if (h > 0 || vy > 0) { h += vy; vy -= held.down ? 0.9 : 0.3; if (h <= 0) { h = 0; vy = 0; } }
        speed = Math.min(7.5, speed + 0.003);
        dist += speed;
        if (dist >= nextAt) {
          const pool = dist > 400 && Math.random() < 0.35 ? HIGH : LOW;
          obs.push({ x: SW, k: pool[Math.floor(Math.random() * pool.length)] });
          nextAt = dist + 40 + speed * 34 + Math.random() * 90;
        }
        for (const o of obs) o.x -= speed;
        obs = obs.filter((o) => o.x + o.k.w > 0);
        // hit box is the body, a bit narrower than the 32px sprite
        const top = h + (ducking ? DUCK : STAND);
        if (obs.some((o) => o.x < PX + 24 && o.x + o.k.w > PX + 9 && (o.k.gap ? top > o.k.gap + 1 : h < o.k.h - 1))) {
          state = 'done'; t = 0; record = saveBest('run', metres()); sfx('bump');
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Treadmill run!', 16, 10);
        const m = metres() + 'm', b = 'Best ' + getBest('run') + 'm';
        text(m, SW - 16 - m.length * 6, 10);
        text(b, SW - 16 - b.length * 6, 22);
        // gym wall: windows scroll past slowly
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(8, 36, SW - 16, FLOOR - 36);
        for (let i = 0; i < 4; i++) {
          const wx = 8 + ((i * 110 - Math.floor(dist / 3)) % 440 + 440) % 440 - 60;
          if (wx > SW - 8 || wx + 50 < 8) continue;
          const cx = Math.max(8, wx), cw = Math.min(SW - 8, wx + 50) - cx;
          ctx.fillStyle = col.dark; ctx.fillRect(cx, 60, cw, 50);
          ctx.fillStyle = '#a8d8f0'; ctx.fillRect(Math.max(9, wx + 2), 62, Math.max(0, Math.min(SW - 9, wx + 48) - Math.max(9, wx + 2)), 46);
        }
        // treadmill belt with moving stripes
        ctx.fillStyle = col.dark; ctx.fillRect(8, FLOOR, SW - 16, 14);
        ctx.fillStyle = '#585868';
        for (let x = 8 - Math.floor(dist) % 24; x < SW - 8; x += 24) if (x >= 8) ctx.fillRect(x, FLOOR + 4, 12, 3);
        for (const o of obs) o.k.draw(Math.round(o.x), FLOOR - (o.k.gap || o.k.h));
        const frame = h > 0 || state !== 'play' ? 0 : (t >> 3) & 1 ? 1 : 2;
        if (ducking) ctx.drawImage(sprites.right[frame], PX, FLOOR - 17, 32, 17);
        else ctx.drawImage(sprites.right[frame], PX, FLOOR - 32 - Math.round(h), 32, 32);
        if (state === 'ready') readyBox(t, 'Space: jump  Down: duck');
        else if (state === 'done') doneBox(['Wipeout!', 'You ran ' + metres() + 'm', record ? 'New record!' : 'Best ' + getBest('run') + 'm'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Pong on the big TV ----------
  function PongGame() {
    const L = 12, R = SW - 12, TOP = 34, BOT = SH - 22, PW = 4, PH = 28, BS = 4, WIN = 5;
    const me = { x: L + 4, y: (TOP + BOT - PH) / 2 }, cpu = { x: R - 8, y: (TOP + BOT - PH) / 2 };
    let state = 'ready', t = 0, mine = 0, theirs = 0, ball = null, wait = 0;
    function serve(toCpu) {
      ball = { x: SW / 2, y: (TOP + BOT) / 2, vx: toCpu ? 2.2 : -2.2, vy: (Math.random() * 2 - 1) * 1.5 };
      wait = 40;
    }
    function bounce(pad, dirOut) {
      const off = (ball.y + BS / 2 - (pad.y + PH / 2)) / (PH / 2);
      ball.vx = dirOut * Math.min(6, Math.abs(ball.vx) * 1.07);
      ball.vy = off * 3;
      ball.x = dirOut > 0 ? pad.x + PW : pad.x - BS;
      sfx('blip', true);
    }
    serve(Math.random() < 0.5);
    const self = {
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(mine > theirs ? 'You beat the TV at Pong! The news can wait.' : 'The TV beat you. Maybe just watch the news.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You switch the TV back to the news.'); return; }
        if (held.up) me.y -= 3.5;
        if (held.down) me.y += 3.5;
        me.y = Math.max(TOP, Math.min(BOT - PH, me.y));
        // the TV only watches the ball when it's coming its way, and can't move very fast
        const aim = ball.vx > 0 ? ball.y + BS / 2 - PH / 2 : (TOP + BOT - PH) / 2;
        cpu.y += Math.sign(aim - cpu.y) * Math.min(Math.abs(aim - cpu.y), 2.3);
        cpu.y = Math.max(TOP, Math.min(BOT - PH, cpu.y));
        if (wait > 0) { wait--; return; }
        ball.x += ball.vx; ball.y += ball.vy;
        if (ball.y < TOP) { ball.y = TOP; ball.vy = -ball.vy; sfx('blip'); }
        if (ball.y > BOT - BS) { ball.y = BOT - BS; ball.vy = -ball.vy; sfx('blip'); }
        const overlap = (pad) => ball.y + BS > pad.y && ball.y < pad.y + PH;
        if (ball.vx < 0 && ball.x <= me.x + PW && ball.x + BS >= me.x - 4 && overlap(me)) bounce(me, 1);
        if (ball.vx > 0 && ball.x + BS >= cpu.x && ball.x <= cpu.x + PW + 4 && overlap(cpu)) bounce(cpu, -1);
        if (ball.x < L - 8 || ball.x > R + 8) {
          const meScored = ball.x > R;
          if (meScored) mine++; else theirs++;
          sfx(meScored ? 'ding' : 'bump');
          if (mine >= WIN || theirs >= WIN) { state = 'done'; t = 0; }
          else serve(!meScored);
        }
      },
      draw() {
        // TV bezel around a dark screen
        ctx.fillStyle = '#303038'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = col.dark; ctx.fillRect(L - 4, TOP - 8, R - L + 8, BOT - TOP + 16);
        ctx.fillStyle = '#f8f8f8';
        for (let y = TOP; y < BOT; y += 10) ctx.fillRect(SW / 2 - 1, y, 2, 5);
        text(String(mine), SW / 2 - 30, TOP + 4, 2, '#f8f8f8');
        text(String(theirs), SW / 2 + 20, TOP + 4, 2, '#f8f8f8');
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(me.x, Math.round(me.y), PW, PH);
        ctx.fillRect(cpu.x, Math.round(cpu.y), PW, PH);
        if (state === 'play' && (wait === 0 || (wait >> 2) & 1)) ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BS, BS);
        text('YOU', L, 10, 1, '#f8f8f8');
        text('TV', R - 12, 10, 1, '#f8f8f8');
        text('First to ' + WIN, SW / 2 - 27, 10, 1, '#f8f8f8');
        if (state === 'ready') readyBox(t, 'Up/Down: move paddle');
        else if (state === 'done') doneBox([mine > theirs ? 'You win!' : 'The TV wins.', mine + ' - ' + theirs, ''], t);
        else text('Esc: give up', L, SH - 12, 1, '#f8f8f8');
      },
    };
    return self;
  }

  // ---------- paper toss: lock the angle, then the power, and throw ----------
  function TossGame() {
    const FLOOR = 204, HAND = { x: 46, y: FLOOR - 24 }, BIN_W = 30, BIN_H = 36, PAPERS = 10, G = 0.2;
    let state = 'ready', t = 0, ang = 0.6, angDir = 1, pow = 0, powDir = 1, thrown = 0, scored = 0, record = false;
    let binX = 0, wind = 0, ball = null, msg = '', floorPapers = [];
    function nextPaper() {
      binX = 170 + Math.floor(Math.random() * 100);
      wind = Math.round((Math.random() * 2 - 1) * 3) / 100;
      ball = null; state = 'aim';
    }
    const result = (inBin) => {
      thrown++;
      if (inBin) { scored++; msg = 'Swish!'; sfx('swish'); }
      else { msg = 'Missed!'; sfx('bump'); floorPapers.push({ x: Math.round(ball.x), y: FLOOR - 5 }); }
      state = 'result'; t = 0;
    };
    const self = {
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { nextPaper(); t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(scored === PAPERS ? 'Every single paper in the bin. Spotless!'
              : scored === 0 ? 'Somehow it\'s messier than before you started...'
              : 'You got ' + scored + ' of ' + PAPERS + ' papers in the bin.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You\'ll clean up later. Probably.'); return; }
        if (state === 'aim') {
          ang += angDir * 0.025;
          if (ang > 1.35) { ang = 1.35; angDir = -1; }
          if (ang < 0.2) { ang = 0.2; angDir = 1; }
          if (pressed.has('a')) { state = 'power'; pow = 0; powDir = 1; sfx('select'); }
        } else if (state === 'power') {
          pow += powDir * 0.02;
          if (pow > 1) { pow = 1; powDir = -1; }
          if (pow < 0) { pow = 0; powDir = 1; }
          if (pressed.has('a')) {
            const v = 3 + pow * 6.5;
            ball = { x: HAND.x, y: HAND.y, vx: Math.cos(ang) * v, vy: -Math.sin(ang) * v, spin: 0 };
            state = 'fly'; sfx('jump');
          }
        } else if (state === 'fly') {
          const b = ball, top = FLOOR - BIN_H, prevY = b.y;
          b.vx += wind; b.vy += G; b.x += b.vx; b.y += b.vy; b.spin++;
          // dropping in through the opening
          if (prevY <= top && b.y > top && b.vy > 0 && b.x > binX + 3 && b.x + 6 < binX + BIN_W - 3) { result(true); return; }
          // the rim and outside walls knock it back
          const hitWall = b.y + 6 > top && (
            (b.vx > 0 && b.x + 6 >= binX && b.x + 6 - b.vx < binX + 1) ||
            (b.vx < 0 && b.x <= binX + BIN_W && b.x - b.vx > binX + BIN_W - 1));
          if (hitWall) { b.vx = -b.vx * 0.5; b.x += b.vx * 2; b.vy *= 0.5; sfx('blip'); }
          if (b.y >= FLOOR - 6 || b.x > SW || b.x < -10) { b.y = FLOOR - 6; result(false); }
        } else if (state === 'result' && t > 45) {
          if (thrown >= PAPERS) { state = 'done'; t = 0; record = saveBest('toss', scored); if (scored) sfx('ding'); }
          else nextPaper();
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Clean up the papers!', 16, 10);
        const s = 'In bin ' + scored + '/' + PAPERS;
        text(s, SW - 16 - s.length * 6, 10);
        text('Best ' + getBest('toss'), SW - 16 - ('Best ' + getBest('toss')).length * 6, 22);
        // wind
        if (state !== 'ready') {
          const w = wind === 0 ? 'No wind' : 'Wind ' + (wind > 0 ? '>' : '<').repeat(Math.round(Math.abs(wind) * 100));
          text(w, 16, 22);
        }
        // floor
        ctx.fillStyle = col.dark; ctx.fillRect(8, FLOOR, SW - 16, 1);
        ctx.fillStyle = '#c8b898'; ctx.fillRect(8, FLOOR + 1, SW - 16, 12);
        const paper = (x, y) => {
          ctx.fillStyle = col.dark; ctx.fillRect(x, y, 6, 6);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 1, 4, 4);
          ctx.fillStyle = '#b8b8c0'; ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 3, y + 4, 1, 1);
        };
        // missed papers stay on the floor
        floorPapers.forEach((p) => paper(Math.max(8, Math.min(SW - 14, p.x)), p.y));
        // you, plus the pile you still have to throw
        ctx.drawImage(sprites.right[0], 14, FLOOR - 32, 32, 32);
        for (let i = 0; i < PAPERS - thrown - (ball ? 1 : 0); i++) paper(50 + (i % 4) * 5, FLOOR - 6 - Math.floor(i / 4) * 5);
        // recycling bin
        if (state !== 'ready') {
          const bx = binX, by = FLOOR - BIN_H;
          ctx.fillStyle = col.dark; ctx.fillRect(bx, by, BIN_W, BIN_H);
          ctx.fillStyle = '#3878c8'; ctx.fillRect(bx + 2, by + 2, BIN_W - 4, BIN_H - 3);
          ctx.fillStyle = col.dark; ctx.fillRect(bx - 2, by, BIN_W + 4, 3);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(bx + 11, by + 14, 8, 8);
          ctx.fillStyle = '#3878c8'; ctx.fillRect(bx + 13, by + 16, 4, 4);
        }
        // aim arrow and power bar
        if (state === 'aim' || state === 'power') {
          ctx.fillStyle = col.dark;
          for (let i = 2; i < 12; i++) ctx.fillRect(Math.round(HAND.x + Math.cos(ang) * i * 4), Math.round(HAND.y - Math.sin(ang) * i * 4), 2, 2);
          text(state === 'aim' ? 'Space: set angle' : 'Space: throw!', 16, SH - 14);
        }
        if (state === 'power' || state === 'fly') {
          text('POWER', 70, 40);
          ctx.fillStyle = col.dark; ctx.fillRect(106, 39, 100, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(107, 40, 98, 7);
          ctx.fillStyle = '#d86030'; ctx.fillRect(107, 40, Math.round(98 * pow), 7);
        }
        if (ball && state === 'fly') paper(Math.round(ball.x), Math.round(ball.y));
        if (state === 'result') ctext(msg, 100);
        if (state === 'ready') readyBox(t, 'Space twice: aim, then throw');
        else if (state === 'done') doneBox(['All thrown!', 'Cleaned up ' + scored + '/' + PAPERS, record ? 'New record!' : 'Best ' + getBest('toss')], t);
        else if (state !== 'aim' && state !== 'power') text('Esc: give up', 16, SH - 14);
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
    x: ['The photocopier blinks: PC LOAD LETTER'],
    T: ['A big table. Good for meetings.'],
    z: ['A server rack. The fans are roaring.', 'Rows of blinking lights. Something is definitely computing.'],
    y: ['A rack of computers crunching numbers.'],
    t: ['Cookie monster champion!'],
    u: ['A stretcher, freshly made up. Hopefully nobody needs it today.'],
    l: ['A sturdy railing. Watch your step!'],
    g: ['Shelves stocked with chips, granola bars and pop. Snack heaven!'],
    W: ['A washing machine. Someone left their gym towels in it.'],
    O: ['A dryer. Still warm.'],
    A: ['A squat rack loaded with heavy plates. Not today.'],
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
    if (t === 'm' || t === 'R') {
      sfx('menu');
      ui.push(ComputerScreen());
      return;
    }
    if (t === 'P') {
      sfx('select');
      ask('A big coffee machine. It smells amazing.', ['MAKE COFFEE', 'CANCEL'], (i) => {
        if (i === 0) { sfx('menu'); ui.push(CoffeeGame()); }
      });
      return;
    }
    const GAMES = {
      G: ['A punching bag. Want to throw a few?', 'PUNCH IT', PunchGame],
      q: ['A treadmill. Maybe after work...', 'GO FOR A RUN', RunGame],
      V: ['A big TV. Someone left the news on.', 'PLAY PONG', PongGame],
      v: ['A recycling bin. Crumpled paper everywhere around it...', 'CLEAN UP', TossGame],
    };
    if (GAMES[t]) {
      const [msg, opt, Game] = GAMES[t];
      sfx('select');
      ask(msg, [opt, 'CANCEL'], (i) => {
        if (i === 0) { sfx('menu'); ui.push(Game()); }
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
    text('Arrows: choose   Space: start', (SW - 29 * 6) >> 1, SH - 24);
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
    text('HAAKON', (SW - 6 * 12) >> 1, t0 + 22, 2);
    text('LIFE', (SW - 4 * 12) >> 1, t0 + 44, 2);
    ctx.drawImage(charSprites.male[0].down[(tick >> 4) & 1 ? 1 : 2], (SW >> 1) - 36, t0 + 70, 32, 32);
    ctx.drawImage(charSprites.female[0].down[(tick >> 4) & 1 ? 2 : 1], (SW >> 1) + 4, t0 + 70, 32, 32);
    if ((tick >> 5) & 1) text('PRESS ENTER', (SW - 11 * 6) >> 1, t0 + 118);
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

  // Testing shortcut: index.html#play&f=1&x=40&y=20&char=female:2 (add &game=punch|run|pong|toss|coffee)
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
    const GAME = { coffee: CoffeeGame, punch: PunchGame, run: RunGame, pong: PongGame, toss: TossGame }[q.get('game')];
    if (GAME) ui.push(GAME());
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
