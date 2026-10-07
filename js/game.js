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
  // Touch screens get the on-screen D-pad and A/B/START buttons (see layout), and the
  // control hints drawn in the game name those buttons instead of keyboard keys.
  const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || /[#&]touch/.test(location.hash);

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

  // The Employee of the Month easel ('$' tile by the front entrance) only appears once
  // Linda's list is done; until then the spot is plain floor.
  const easels = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === '$') list.push({ x, y }); }));
    return list;
  });

  // Electrical panels ('K' tiles) get blinking status lights drawn over them.
  const panels = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === 'K') list.push({ x, y }); }));
    return list;
  });
  const PANEL_LIGHTS = ['#58e048', '#f05040', '#f0b030'];

  // ---------- NPCs: one per person, pacing around their own office ----------
  // Everything a person says is shown as "Name: ...", so these no longer introduce
  // themselves. {n} still works if you want to use a name mid-sentence.
  const NPC_LINES = [
    "Hi there!",
    "Oh, hey! Welcome to the office.",
    "Busy day today!",
    "Have you tried the candy at reception?",
    "Don't tell anyone, but this is my third coffee.",
    "Morning! Or afternoon. I have lost track.",
    "If you see my mug, it is the one with the fan on it.",
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
  // Someone's body type and colours: from js/people.js, with a random-but-stable
  // look filling in anything they don't set.
  function lookFor(name) {
    const p = (window.PEOPLE || {})[name] || {};
    const body = ['female', 'ghost'].includes(p.body) ? p.body : 'male';
    const looks = Art.LOOKS[body] || Art.LOOKS.male;
    const def = looks[hash(name) % looks.length];
    return { body, look: { h: p.hair || def.h, s: p.skin || def.s, w: p.top || def.w, u: p.accent || def.u, K: p.pants || def.K } };
  }
  // The sprite sheet for a person, reusing the one their NPC already has.
  function spritesFor(name) {
    const n = npcs.find((p) => p.name === name);
    if (n) return n.sprites;
    const { body, look } = lookFor(name);
    return Art.renderSprites(body, look);
  }
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
          const { body, look } = lookFor(name);
          const [x, y] = spots[(hash(name) + npcs.length * 7) % spots.length];
          npcs.push({
            name: p.name || name, floor: fi, room: area, x, y, dir: 'down', moving: false, prog: 0, mdx: 0, mdy: 0, step: 0,
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
  let actx = null, sfxBus = null, musicBus = null;
  // Overall loudness. A compressor at the end keeps the boost from clipping.
  const SFX_VOLUME = 1.6, MUSIC_VOLUME = 1.7;
  function unlockAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
      if (actx) {
        const limit = actx.createDynamicsCompressor();
        limit.threshold.value = -6; limit.ratio.value = 8;
        limit.connect(actx.destination);
        sfxBus = actx.createGain(); sfxBus.gain.value = SFX_VOLUME; sfxBus.connect(limit);
        musicBus = actx.createGain(); musicBus.gain.value = MUSIC_VOLUME; musicBus.connect(limit);
      }
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
    o.connect(g); g.connect(sfxBus);
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
    src.connect(f); f.connect(g); g.connect(sfxBus);
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
    putt: () => tone(700, 0.05, 'triangle', 0.08, -300),
    cup: () => { tone(880, 0.08, 'square', 0.04); tone(1175, 0.08, 'square', 0.04, 0, 0.09); tone(1568, 0.25, 'square', 0.04, 0, 0.18); },
    splash: () => { noise(0.35, 700, 0.09); tone(300, 0.2, 'sine', 0.05, -200); },
    lift: (h) => tone(140 + (h || 0) * 260, 0.05, 'square', 0.03),
    note: (i) => tone([330, 440, 554, 660][i], 0.18, 'square', 0.05),
    buzz: () => { tone(90, 0.4, 'square', 0.07); noise(0.3, 400, 0.06); },
    swish: () => { noise(0.25, 2200, 0.06); tone(600, 0.15, 'triangle', 0.05, 500, 0.1); },
  };
  function sfx(name, arg) { if (soundOn && actx) SFX[name](arg); }

  // ---------- music: a tiny chiptune sequencer for the songs in js/music.js ----------
  let musicOn = store.get('music') !== 'off';
  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function noteFreq(tok) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
    if (!m) return 0;
    const n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (m[3] - 4) * 12;
    return 440 * Math.pow(2, n / 12);
  }
  // Turn each voice's note string into one slot per step: a note {f, len}, a drum letter, or null.
  const SONGS = {};
  for (const name in window.MUSIC) {
    const song = window.MUSIC[name];
    SONGS[name] = {
      bpm: song.bpm,
      voices: song.voices.map((v) => {
        const toks = v.notes.split(/\s+/).filter((s) => s && s !== '|');
        const steps = toks.map(() => null);
        toks.forEach((tok, i) => {
          if (v.type === 'drums') { if ('ksh'.includes(tok)) steps[i] = tok; return; }
          const f = noteFreq(tok);
          if (!f) return;
          let len = 1;
          while (toks[i + len] === '-') len++;
          steps[i] = { f, len };
        });
        return { type: v.type, vol: v.vol, steps };
      }),
    };
  }
  let noiseBuf = null;
  function drum(kind, t, vol, out) {
    if (kind === 'k') {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.16);
      return;
    }
    if (!noiseBuf) {
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.2, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    const len = kind === 's' ? 0.12 : 0.03;
    src.buffer = noiseBuf;
    f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
    g.gain.setValueAtTime(vol * (kind === 's' ? 0.25 : 0.12), t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + len + 0.01);
  }
  function voiceNote(v, ev, t, step, out) {
    const o = actx.createOscillator(), g = actx.createGain(), end = t + ev.len * step;
    o.type = v.type; o.frequency.setValueAtTime(ev.f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v.vol, t + 0.008);
    // plucky decay down to a sustain level, then a short release so notes don't click
    g.gain.linearRampToValueAtTime(v.vol * 0.6, t + Math.min(0.15, ev.len * step * 0.5));
    g.gain.setValueAtTime(v.vol * 0.6, Math.max(t + 0.01, end - 0.03));
    g.gain.linearRampToValueAtTime(0, end);
    o.connect(g); g.connect(out); o.start(t); o.stop(end + 0.01);
  }
  let music = null; // { name, song, step, next, out }
  function playMusic(name) {
    if ((music && music.name) === name) return;
    if (music && actx) { // fade the old song out; its already-scheduled notes go quiet with it
      const g = music.out.gain;
      g.setValueAtTime(g.value, actx.currentTime); g.linearRampToValueAtTime(0, actx.currentTime + 0.15);
    }
    music = null;
    if (!name || !SONGS[name] || !actx) return;
    const out = actx.createGain();
    out.gain.value = 1; out.connect(musicBus);
    music = { name, song: SONGS[name], step: 0, next: actx.currentTime + 0.05, out };
  }
  setInterval(() => {
    if (!music || !actx) return;
    const step = 60 / music.song.bpm / 2;
    if (music.next < actx.currentTime - 0.5) music.next = actx.currentTime + 0.02; // came back from a background tab
    while (music.next < actx.currentTime + 0.12) {
      for (const v of music.song.voices) {
        const ev = v.steps[music.step % v.steps.length];
        if (!ev) continue;
        if (typeof ev === 'string') drum(ev, music.next, v.vol, music.out);
        else voiceNote(v, ev, music.next, step, music.out);
      }
      music.step++; music.next += step;
    }
  }, 30);
  // Where the song is right now, in eighth-note steps (fractional), or null if it isn't playing.
  // Notes are scheduled a little ahead, so this backs up from the next step to what's audible.
  function musicPos(name) {
    if (!music || !actx || music.name !== name) return null;
    return music.step - (music.next - actx.currentTime) / (60 / music.song.bpm / 2);
  }
  // Which song fits right now: the open mini-game's theme, the room's mood, or the office tune.
  function pickMusic() {
    if (!musicOn) return null;
    for (let i = ui.length - 1; i >= 0; i--) if (ui[i].music) return ui[i].music;
    if (mode === 'play' && curRoom && (curRoom.name === 'Ghosts' || curRoom.dark)) return 'spooky';
    if (mode === 'play' && curRoom && curRoom.rave) return 'rave';
    return 'office';
  }

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
    // naming yourself: keys type letters, and only the arrows keep their game meaning
    if (mode === 'name' && !fade && (nameKey(e) || !e.code.startsWith('Arrow'))) { e.preventDefault(); return; }
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
  // Keyboard hints -> touch button hints ("Space: punch" -> "A: punch", "Esc: give up" ->
  // "B: give up", "Arrows: steer" -> "D-pad: steer"). Only hint-shaped text is touched,
  // so an SDG "Space" component or a printout stays as it is.
  const TOUCH_HINTS = [
    [/\bSpace(?=:| twice| to )|(?<=(?:Hold|Mash|Press|\+|then) )Space\b/g, 'A'],
    [/\bEsc(?=:)/g, 'B'],
    [/\bArrows(?=:| \+)/g, 'D-pad'],
    [/PRESS ENTER/g, 'PRESS START'],
  ];
  const touchHint = (str) => TOUCH_HINTS.reduce((s, [re, to]) => s.replace(re, to), str);
  function text(str, x, y, scale, color) {
    if (isTouch) str = touchHint(str);
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
    const w = Math.max(opts.minChars || 0, ...options.map((o) => o.length)) * 6 + 22, h = options.length * 16 + 8;
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

  // ---------- office computers: a desktop with one program on it ----------
  // Most computers run SDG; a room with a 'computer' option (see tools/build_maps.py)
  // runs that program instead.
  const sdgIcon = new Image();
  sdgIcon.src = 'assets/sdg.png';
  const PROGRAMS = {
    sdg: { label: 'SDG', App: () => SdgApp(),
      icon(x, y) { if (sdgIcon.complete && sdgIcon.naturalWidth) ctx.drawImage(sdgIcon, x, y, 62, 64); } },
    poker: { label: 'Poker', App: (pc) => PokerApp(pc), icon: (x, y) => drawPokerIcon(x, y) },
    blackjack: { label: 'Blackjack', App: (pc) => BlackjackApp(pc), icon: (x, y) => drawBlackjackIcon(x, y) },
  };
  function ComputerScreen(program) {
    const prog = PROGRAMS[program] || PROGRAMS.sdg;
    let sel = 0, state = 'desktop', t = 0;
    const OPTIONS = ['Open ' + prog.label, 'Exit'];
    const self = {
      update() {
        t++;
        if (state === 'loading') {
          if (t > 90) { state = 'desktop'; ui.push(prog.App(self)); }
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
        // the program's icon
        const ix = 129, iy = 54;
        prog.icon(ix, iy);
        if (sel === 0 && state === 'desktop' && (tick >> 4) & 1) {
          ctx.fillStyle = '#f8f8f8'; ring(ix - 3, iy - 3, 68, 70);
        }
        text(prog.label, ix + 31 - prog.label.length * 3, iy + 70, 1, '#f8f8f8');
        if (state === 'loading') {
          box(80, 76, 160, 48);
          const msg = 'Starting ' + prog.label + '...';
          text(msg, 160 - msg.length * 3, 88);
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

  // ---------- Spring Roll Hold'em: no-limit Texas Hold'em on Zin's computer ----------
  // You against Cody and Dmitriy, played for spring rolls. Everyone starts with
  // START rolls and the blinds go up every BLIND_EVERY hands, so a game always ends.
  // Cards are {r: 2-14 (14 = ace), s: 0-3 (spades, hearts, diamonds, clubs)}.
  const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  const handName = (v) => HAND_NAMES[Math.floor(v / 759375)]; // 759375 = 15^5, see handValue
  // The best five-card hand out of up to seven cards, as a number: higher beats lower,
  // equal is a split. The category is the top base-15 digit, then up to five tiebreak ranks.
  function handValue(cards) {
    const cnt = Array(15).fill(0), bySuit = [[], [], [], []];
    for (const c of cards) { cnt[c.r]++; bySuit[c.s].push(c.r); }
    const pack = (cat, ranks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (ranks[i] || 0); return v; };
    // top card of the best straight among the ranks has() accepts (the wheel A-5 counts, ace low), or 0
    const straightTop = (has) => {
      for (let top = 14; top >= 5; top--) {
        let r = top;
        while (r > top - 5 && has(r === 1 ? 14 : r)) r--;
        if (r === top - 5) return top;
      }
      return 0;
    };
    for (const suit of bySuit) if (suit.length >= 5) {
      const sf = straightTop((r) => suit.includes(r));
      if (sf) return pack(8, [sf]);
    }
    const groups = []; // [count, rank], most of a kind first, then highest
    for (let r = 14; r >= 2; r--) if (cnt[r]) groups.push([cnt[r], r]);
    groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const others = (...not) => groups.map((g) => g[1]).filter((r) => !not.includes(r)).sort((a, b) => b - a);
    const [g0, g1] = groups;
    if (g0[0] === 4) return pack(7, [g0[1], others(g0[1])[0]]);
    if (g0[0] === 3 && g1 && g1[0] >= 2) return pack(6, [g0[1], g1[1]]);
    const flush = bySuit.find((s) => s.length >= 5);
    if (flush) return pack(5, flush.slice().sort((a, b) => b - a));
    const st = straightTop((r) => cnt[r] > 0);
    if (st) return pack(4, [st]);
    if (g0[0] === 3) return pack(3, [g0[1], ...others(g0[1]).slice(0, 2)]);
    if (g0[0] === 2 && g1 && g1[0] === 2) return pack(2, [g0[1], g1[1], others(g0[1], g1[1])[0]]);
    if (g0[0] === 2) return pack(1, [g0[1], ...others(g0[1]).slice(0, 3)]);
    return pack(0, others());
  }
  function newDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  // How often `hole` wins (a tie counts as a share of a win) against `opps` random
  // hands, dealing the rest of the board at random `sims` times.
  function pokerEquity(hole, board, opps, sims) {
    const used = new Set(hole.concat(board).map((c) => c.r * 4 + c.s)), rest = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!used.has(r * 4 + s)) rest.push({ r, s });
    const fill = 5 - board.length, need = fill + opps * 2;
    let won = 0;
    for (let n = 0; n < sims; n++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const b = board.concat(rest.slice(0, fill)), mine = handValue(hole.concat(b));
      let ties = 0, beaten = false;
      for (let o = 0; o < opps && !beaten; o++) {
        const v = handValue([rest[fill + o * 2], rest[fill + o * 2 + 1]].concat(b));
        if (v > mine) beaten = true; else if (v === mine) ties++;
      }
      if (!beaten) won += 1 / (ties + 1);
    }
    return won / sims;
  }

  // card faces: 5x6 suit pictures, and rank labels
  const SUIT_PIX = [
    ['00100', '01110', '11111', '11111', '00100', '01110'], // spade
    ['01010', '11111', '11111', '01110', '00100', '00000'], // heart
    ['00100', '01110', '11111', '01110', '00100', '00000'], // diamond
    ['01110', '01110', '11111', '11111', '00100', '01110'], // club
  ];
  const SUIT_COL = ['#181820', '#c82828', '#c82828', '#181820'];
  const RANK_TXT = (r) => ({ 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r] || String(r);
  function drawSuit(s, x, y, k) {
    ctx.fillStyle = SUIT_COL[s];
    SUIT_PIX[s].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '1') ctx.fillRect(x + i * k, y + j * k, k, k); });
  }
  const CARD_W = 24, CARD_H = 32;
  function drawCard(c, x, y, faceDown) {
    ctx.fillStyle = '#181820'; ctx.fillRect(x, y, CARD_W, CARD_H);
    if (faceDown) {
      ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 1, CARD_W - 2, CARD_H - 2);
      ctx.fillStyle = '#3050a8'; ctx.fillRect(x + 3, y + 3, CARD_W - 6, CARD_H - 6);
      ctx.fillStyle = '#6890e0';
      for (let j = 0; j < CARD_H - 8; j += 4) for (let i = (j >> 2) & 1 ? 2 : 0; i < CARD_W - 8; i += 4) ctx.fillRect(x + 4 + i, y + 4 + j, 2, 2);
      return;
    }
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 1, CARD_W - 2, CARD_H - 2);
    text(RANK_TXT(c.r), x + 3, y + 3, 1, SUIT_COL[c.s]);
    drawSuit(c.s, x + 3, y + 12, 1);
    drawSuit(c.s, x + 9, y + 16, 2);
  }
  // a little spring roll, for amounts
  function drawRoll(x, y) {
    ctx.fillStyle = '#6a3c10'; ctx.fillRect(x, y + 1, 11, 5); ctx.fillRect(x + 1, y, 9, 7);
    ctx.fillStyle = '#e8b048'; ctx.fillRect(x + 1, y + 1, 9, 5);
    ctx.fillStyle = '#c07828'; ctx.fillRect(x + 3, y + 1, 1, 5); ctx.fillRect(x + 6, y + 1, 1, 5);
    ctx.fillStyle = '#f8e098'; ctx.fillRect(x + 1, y + 2, 9, 1);
  }
  // a generic profile picture: a grey head and shoulders on a coloured square
  function drawAvatar(x, y, bg) {
    ctx.fillStyle = '#181820'; ctx.fillRect(x, y, 24, 24);
    ctx.fillStyle = bg; ctx.fillRect(x + 1, y + 1, 22, 22);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(x + 9, y + 4, 6, 10); ctx.fillRect(x + 8, y + 5, 8, 8);
    ctx.fillRect(x + 6, y + 16, 12, 7); ctx.fillRect(x + 4, y + 18, 16, 5);
  }
  function drawPokerIcon(x, y) {
    drawCard({ r: 14, s: 1 }, x + 10, y + 4);
    drawCard({ r: 13, s: 0 }, x + 28, y + 10);
    for (let i = 0; i < 3; i++) drawRoll(x + 12 + i * 13, y + 50);
  }

  // pc: the ComputerScreen it runs on, which shuts down when the game is over
  function PokerApp(pc) {
    const START = 200, BLIND_EVERY = 8, SMALL_BLINDS = [2, 3, 5, 8, 12, 20, 30, 50, 80];
    // how the bots play: loose calls more, aggr raises more, bluff bets with nothing
    const BOTS = {
      Cody: { loose: 0.5, aggr: 0.6, bluff: 0.14, bg: '#3868c8', bust: "I guess I just won't eat this weekend :(" },
      Dmitriy: { loose: 0.1, aggr: 0.4, bluff: 0.05, bg: '#9868c8', bust: 'Spring rolls are overrated anyway...' },
    };
    // seats go round the table clockwise: you at the bottom, Cody left, Dmitriy right
    const seats = [
      { name: 'You', you: true, stack: START, cardX: 134, cardY: 122, chip: [120, 132] },
      { name: 'Cody', stack: START, px: 12, cardX: 12, cardY: 56, chip: [66, 64] },
      { name: 'Dmitriy', stack: START, px: 230, cardX: 258, cardY: 56, chip: [244, 64], right: true },
    ];
    for (const p of seats) Object.assign(p, { out: false, hand: [], folded: false, allIn: false, bet: 0, total: 0, acted: false, show: false, value: 0 });
    let button = Math.floor(Math.random() * 3), handNo = 0, deck = [], board = [], street = 0;
    let toAct = -1, curBet = 0, minRaise = 0, lines = [], state = 'play', timer = 0, next = null, think = 0;
    let btn = 1, raising = false, raiseTo = 0, t = 0, record = false;
    const after = (frames, fn) => { timer = frames; next = fn; };
    const sb = () => SMALL_BLINDS[Math.min(SMALL_BLINDS.length - 1, Math.floor(handNo / BLIND_EVERY))];
    const bb = () => sb() * 2;
    const live = () => seats.filter((p) => !p.out);
    const inHand = () => seats.filter((p) => !p.out && !p.folded);
    const canAct = () => inHand().filter((p) => !p.allIn);
    const nextSeat = (i, ok) => { for (let k = 1; k <= 3; k++) if (ok(seats[(i + k) % 3])) return (i + k) % 3; return -1; };
    const pot = () => seats.reduce((n, p) => n + p.total, 0);
    // "You raise" / "Cody raises"
    const does = (p, verb) => (p.you ? 'You ' + verb : p.name + ' ' + verb + 's');
    function put(p, amt) {
      amt = Math.min(amt, p.stack);
      p.stack -= amt; p.bet += amt; p.total += amt;
      if (!p.stack) p.allIn = true;
    }

    function startHand() {
      for (const p of seats) Object.assign(p, { hand: [], folded: p.out, allIn: false, bet: 0, total: 0, acted: false, show: false, value: 0 });
      deck = newDeck(); board = []; street = 0; state = 'play'; raising = false;
      button = nextSeat(button, (p) => !p.out);
      // heads-up, the button posts the small blind
      const sbSeat = live().length === 2 ? button : nextSeat(button, (p) => !p.out);
      const bbSeat = nextSeat(sbSeat, (p) => !p.out);
      put(seats[sbSeat], sb()); put(seats[bbSeat], bb());
      curBet = bb(); minRaise = bb();
      for (let k = 0; k < 2; k++) for (const p of live()) p.hand.push(deck.pop());
      lines = ['Hand ' + (handNo + 1) + '. Blinds ' + sb() + '/' + bb() + '.'];
      sfx('select');
      advance(bbSeat);
    }
    // After someone acts: pass the action on, or close the betting round.
    function advance(from) {
      toAct = -1;
      if (inHand().length === 1) { winUncontested(); return; }
      const needs = (p) => !p.out && !p.folded && !p.allIn && (!p.acted || p.bet < curBet);
      // a lone player who can still bet only has to act if they're behind
      const alone = canAct().length === 1 && canAct()[0].bet >= curBet;
      if (alone || !seats.some(needs)) { endStreet(); return; }
      toAct = nextSeat(from, needs); think = 0;
      if (seats[toAct].you) { btn = 1; raising = false; }
    }
    function endStreet() {
      for (const p of seats) { p.bet = 0; p.acted = false; }
      curBet = 0; minRaise = bb();
      if (street === 3) { after(30, showdown); return; }
      // nobody left to bet against: turn the hands over and run the board out
      const runOut = canAct().length <= 1;
      if (runOut) for (const p of inHand()) p.show = true;
      after(runOut ? 50 : 24, () => {
        street++;
        deck.pop(); // burn
        for (let i = street === 1 ? 3 : 1; i > 0; i--) board.push(deck.pop());
        sfx('putt');
        lines = [['', 'The flop.', 'The turn.', 'The river.'][street]];
        if (runOut) { endStreet(); return; }
        advance(button); // first to act after the flop: the next player after the button
      });
    }
    function act(i, kind, to) {
      const p = seats[i], call = curBet - p.bet;
      p.acted = true;
      if (kind === 'fold') { p.folded = true; lines = [does(p, 'fold') + '.']; sfx('select'); }
      else if (kind === 'call' || to <= curBet) {
        if (call <= 0) { lines = [does(p, 'check') + '.']; sfx('blip'); }
        else { put(p, call); lines = [does(p, 'call') + ' ' + p.bet + (p.allIn ? ', all in!' : '.')]; sfx('putt'); }
      } else {
        to = Math.min(to, p.bet + p.stack);
        const opened = curBet === 0;
        // a full raise sets the new minimum; either way everyone else has to answer it
        if (to - curBet >= minRaise) minRaise = to - curBet;
        put(p, to - p.bet); curBet = p.bet;
        for (const q of seats) if (q !== p) q.acted = false;
        lines = [does(p, opened ? 'bet' : 'raise') + (opened ? ' ' : ' to ') + p.bet + (p.allIn ? ', all in!' : '.')];
        sfx('menu');
      }
      toAct = -1;
      after(p.you ? 12 : 30, () => advance(i));
    }

    function winUncontested() {
      const w = inHand()[0], amt = pot();
      w.stack += amt;
      for (const p of seats) { p.total = 0; p.bet = 0; }
      lines = [does(w, 'take') + ' the pot of ' + amt + '.'];
      if (w.you) sfx('cup');
      state = 'result';
    }
    function showdown() {
      const contenders = inHand(), got = seats.map(() => 0);
      for (const p of contenders) { p.show = true; p.value = handValue(p.hand.concat(board)); }
      // Side pots: slice the contributions at each player's total, smallest first; each
      // slice goes to the best hand among those still in who paid into all of it.
      const levels = [...new Set(seats.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b);
      let prev = 0;
      for (const lv of levels) {
        const chunk = seats.reduce((n, p) => n + Math.max(0, Math.min(p.total, lv) - prev), 0);
        let elig = contenders.filter((p) => p.total >= lv);
        if (!elig.length) elig = contenders.filter((p) => p.total === Math.max(...contenders.map((q) => q.total)));
        const best = Math.max(...elig.map((p) => p.value)), winners = elig.filter((p) => p.value === best);
        const share = Math.floor(chunk / winners.length);
        for (const w of winners) { w.stack += share; if (elig.length > 1) got[seats.indexOf(w)] += share; }
        // the odd roll of a split goes to the first winner after the button
        const odd = chunk - share * winners.length;
        if (odd) seats[nextSeat(button, (p) => winners.includes(p))].stack += odd;
        prev = lv;
      }
      for (const p of seats) { p.total = 0; p.bet = 0; }
      const winners = seats.filter((p, i) => got[i] > 0);
      lines = winners.slice(0, 2).map((p) => does(p, 'win') + ' ' + got[seats.indexOf(p)] + ' with ' + handName(p.value) + '.');
      if (winners.some((p) => p.you)) sfx('cup'); else sfx('bump');
      state = 'result';
    }
    function endHand() {
      handNo++;
      const busted = seats.filter((p) => !p.out && p.stack === 0);
      for (const p of busted) p.out = true;
      const bot = busted.find((p) => !p.you);
      if (seats[0].out) {
        // busted: you get kicked off the computer
        remove(self); if (pc) remove(pc);
        say("Go again. It's impossible to lose more than once while gambling.");
      } else if (live().length === 1) {
        lines = ['You won all ' + seats[0].stack + ' spring rolls!', bot ? bot.name + ': ' + BOTS[bot.name].bust : ''];
        finish();
      } else if (bot) {
        // let the loser have their say before the next hand
        lines = [bot.name + ' is out.', bot.name + ': ' + BOTS[bot.name].bust];
        state = 'busted';
      } else startHand();
    }
    function finish() { state = 'over'; t = 0; record = saveBest('poker', seats[0].stack); sfx('ding'); }
    function leave() {
      remove(self);
      if (state === 'over') { if (pc) remove(pc); say('This gambling thing is too easy. You should do it full time.'); return; }
      // walking away mid-hand forfeits what you've already put in
      record = saveBest('poker', seats[0].stack);
      say('You log off with ' + seats[0].stack + ' spring rolls.' + (record ? ' A new record!' : ''));
    }

    // Cody and Dmitriy: estimate their chances against the hands still in, then weigh
    // that against the price of calling, each with their own habits.
    function botMove(i) {
      const p = seats[i], bot = BOTS[p.name], call = curBet - p.bet, potNow = pot();
      const opps = inHand().length - 1;
      const eq = pokerEquity(p.hand, board, opps, 250);
      const strength = eq * (opps + 1); // 1 = an average hand for this many players
      const odds = call / (potNow + call), r = Math.random();
      const canRaise = p.stack > call && canAct().some((q) => q !== p);
      const sized = (frac) => {
        const to = curBet + Math.max(minRaise, Math.round((potNow + call) * frac / sb()) * sb());
        return strength > 2.3 && r < 0.3 ? p.bet + p.stack : to;
      };
      if (canRaise && strength > 1.75 - bot.aggr * 0.5 && r < 0.35 + bot.aggr * 0.5) return ['raise', sized(0.5 + Math.random() * 0.6)];
      if (canRaise && call === 0 && r < bot.bluff) return ['raise', sized(0.6)];
      if (call === 0) return ['call'];
      if (eq + bot.loose * 0.12 >= odds) return ['call'];
      if (r < bot.bluff && call <= p.stack * 0.1) return ['call'];
      return ['fold'];
    }

    startHand();
    const self = {
      music: 'poker',
      update() {
        t++;
        if (timer > 0) {
          if (pressed.has('b')) ask('Leave the table with ' + seats[0].stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); });
          else if (--timer === 0 && next) { const f = next; next = null; f(); }
          return;
        }
        if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) leave(); return; }
        if (state === 'result' || state === 'busted') {
          if (pressed.has('a')) { sfx('select'); if (state === 'busted') startHand(); else endHand(); }
          else if (pressed.has('b')) ask('Leave the table with ' + seats[0].stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); });
          return;
        }
        if (toAct < 0) return;
        const p = seats[toAct];
        if (!p.you) {
          if (pressed.has('b')) { ask('Leave the table with ' + p.stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); }); return; }
          if (++think < 40) return;
          const [kind, to] = botMove(toAct);
          act(toAct, kind, to);
          return;
        }
        const call = curBet - p.bet, maxTo = p.bet + p.stack;
        const canRaise = p.stack > call && canAct().some((q) => q !== p);
        if (raising) {
          const minTo = Math.min(maxTo, curBet + minRaise), step = bb();
          const nudge = (d) => { raiseTo = Math.max(minTo, Math.min(maxTo, raiseTo + d)); sfx('select'); };
          const rep = (k) => pressed.has(k) || (held[k] && t % 5 === 0);
          if (rep('right')) nudge(step);
          if (rep('left')) nudge(-step);
          if (rep('up')) nudge(step * 5);
          if (rep('down')) nudge(-step * 5);
          if (pressed.has('a')) { raising = false; act(0, 'raise', raiseTo); }
          else if (pressed.has('b')) { raising = false; sfx('select'); }
          return;
        }
        if (pressed.has('left')) { btn = (btn + 3) % 4; sfx('select'); }
        if (pressed.has('right')) { btn = (btn + 1) % 4; sfx('select'); }
        if (pressed.has('b')) { ask('Leave the table with ' + p.stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); }); return; }
        if (pressed.has('a')) {
          if (btn === 0) act(0, 'fold');
          else if (btn === 1) act(0, 'call');
          else if (btn === 2) { if (canRaise) { raising = true; raiseTo = Math.min(maxTo, curBet + minRaise); sfx('select'); } else sfx('bump'); }
          else act(0, canRaise ? 'raise' : 'call', maxTo);
        }
      },
      draw() {
        // window + title bar
        ctx.fillStyle = WIN; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = TITLE; ctx.fillRect(0, 0, SW, 14);
        drawRoll(3, 4);
        text("Spring Roll Hold'em", 18, 3, 1, '#f8f8f8');
        const bl = 'Blinds ' + sb() + '/' + bb();
        text(bl, SW - 20 - bl.length * 6, 3, 1, '#f8f8f8');
        ctx.fillStyle = INK; ctx.fillRect(SW - 13, 2, 10, 10);
        ctx.fillStyle = WIN; ctx.fillRect(SW - 12, 3, 8, 8);
        text('x', SW - 11, 1, 1, INK);
        // the table
        ctx.fillStyle = '#4a2810'; ctx.fillRect(6, 18, 308, 150); ctx.fillRect(4, 22, 312, 142);
        ctx.fillStyle = '#2c7a40'; ctx.fillRect(10, 22, 300, 142); ctx.fillRect(8, 26, 304, 134);
        const blink = (tick >> 4) & 1;
        // the pot and the board
        const ps = 'Pot ' + pot();
        drawRoll(160 - ps.length * 3 - 14, 41);
        text(ps, 160 - ps.length * 3, 41, 1, '#f8f8f8');
        for (let i = 0; i < 5; i++) {
          const x = 94 + i * 27, y = 54;
          if (board[i]) drawCard(board[i], x, y);
          else { ctx.fillStyle = '#246a36'; ctx.fillRect(x, y, CARD_W, CARD_H); }
        }
        // the players
        seats.forEach((p, i) => {
          const showFace = p.you || p.show;
          if (p.out) {
            if (!p.you) { drawAvatar(p.px, 26, '#686878'); text(p.name, p.px + 28, 28, 1, '#a8b0a8'); text('OUT', p.cardX + 14, 66, 1, '#a8b0a8'); }
            return;
          }
          if (!p.you) {
            drawAvatar(p.px, 26, BOTS[p.name].bg);
            if (toAct === i && blink) { ctx.fillStyle = '#f8e070'; ring(p.px - 2, 24, 28, 28); }
            text(p.name, p.px + 28, 28, 1, '#f8f8f8');
            drawRoll(p.px + 28, 39); text(String(p.stack), p.px + 42, 39, 1, '#f8f8f8');
          } else {
            text('You', 40, 126, 1, '#f8f8f8');
            drawRoll(40, 138); text(String(p.stack), 54, 138, 1, '#f8f8f8');
            if (toAct === i && blink) { ctx.fillStyle = '#f8e070'; ring(p.cardX - 2, p.cardY - 2, CARD_W * 2 + 6, CARD_H + 4); }
          }
          if (p.folded) {
            ctx.globalAlpha = 0.35;
            p.hand.forEach((c, k) => drawCard(c, p.cardX + k * 26, p.cardY, !showFace));
            ctx.globalAlpha = 1;
            text('FOLD', p.cardX + 13, p.cardY + 12, 1, '#f8f8f8');
          } else p.hand.forEach((c, k) => drawCard(c, p.cardX + k * 26, p.cardY, !showFace));
          // what they have in front of them this round, and their hand once it's shown
          const note = p.allIn ? 'All in' : p.bet ? 'Bet ' + p.bet : '';
          const ny = p.you ? p.cardY - 11 : p.cardY + CARD_H + 4;
          if (note) text(note, p.you ? 160 - note.length * 3 : p.right ? 308 - note.length * 6 : p.cardX, ny, 1, '#f8e070');
          if (showFace && !p.folded && board.length >= 3) {
            const hn = handName(handValue(p.hand.concat(board)));
            if (p.you) text(hn, 190, 138, 1, '#f8f8f8');
            else text(hn, p.right ? 308 - hn.length * 6 : p.cardX, ny + 11, 1, '#f8f8f8');
          }
          if (i === button) {
            const [cx, cy] = p.chip;
            ctx.fillStyle = INK; ctx.fillRect(cx, cy + 1, 11, 9); ctx.fillRect(cx + 1, cy, 9, 11);
            ctx.fillStyle = '#f8f8f8'; ctx.fillRect(cx + 1, cy + 1, 9, 9);
            text('D', cx + 3, cy + 2, 1, INK);
          }
        });
        // what just happened
        ctx.fillStyle = INK; ctx.fillRect(4, 172, SW - 8, 26);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(5, 173, SW - 10, 24);
        lines.slice(0, 2).forEach((l, i) => text(l, 10, 176 + i * 11, 1, INK));
        // your controls
        const me = seats[0], myTurn = toAct === 0 && !timer && state === 'play';
        const call = Math.min(curBet - me.bet, me.stack);
        if (raising) {
          const minTo = Math.min(me.bet + me.stack, curBet + minRaise), maxTo = me.bet + me.stack;
          const lbl = (curBet ? 'Raise to ' : 'Bet ') + raiseTo + (raiseTo === maxTo ? ' (all in)' : '');
          text(lbl, 10, 204, 1, INK);
          ctx.fillStyle = INK; ctx.fillRect(160, 203, 150, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(161, 204, 148, 7);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(161, 204, Math.round(148 * (maxTo > minTo ? (raiseTo - minTo) / (maxTo - minTo) : 1)), 7);
          text('Arrows: amount  Space: OK  Esc: back', 10, 224, 1, INK);
        } else if (state === 'play') {
          const labels = ['Fold', call ? 'Call ' + call : 'Check', curBet ? 'Raise' : 'Bet', 'All in'];
          labels.forEach((l, i) => {
            const x = 6 + i * 78, on = myTurn && i === btn;
            ctx.fillStyle = INK; ctx.fillRect(x, 202, 74, 16);
            ctx.fillStyle = on ? WIN_DARK : '#f8f8f8'; ctx.fillRect(x, 202, 73, 15);
            ctx.fillStyle = on ? '#f8f8f8' : WIN_DARK; ctx.fillRect(x + 1, 203, 72, 14);
            ctx.fillStyle = on ? '#f0d890' : WIN; ctx.fillRect(x + 1, 203, 71, 13);
            text(l, x + 37 - l.length * 3, 206, 1, myTurn ? INK : WIN_DARK);
          });
          text(myTurn ? 'Arrows: choose  Space: OK  Esc: leave' : 'Esc: leave the table', 10, 226, 1, INK);
        } else if (state !== 'over') text('Space: next hand   Esc: leave the table', 10, 214, 1, INK);
        if (state === 'over') doneBox(['You cleaned them out!',
          'Spring rolls: ' + seats[0].stack, record ? 'New record!' : 'Best ' + getBest('poker')], t);
      },
    };
    return self;
  }

  // ---------- Spring Roll Blackjack: on Cody's computer ----------
  // You against the house, played for the same spring rolls as Hold'em. You start
  // with START rolls; blackjack pays 3 to 2 and the dealer stands on all 17s.
  // Break the bank (GOAL rolls) to win, or lose them all and get kicked off.
  function drawBlackjackIcon(x, y) {
    drawCard({ r: 14, s: 0 }, x + 10, y + 4);
    drawCard({ r: 11, s: 1 }, x + 28, y + 10);
    for (let i = 0; i < 3; i++) drawRoll(x + 12 + i * 13, y + 50);
  }
  // a hand's best total, and whether an ace is still counting as 11
  function bjTotal(hand) {
    let n = 0, aces = 0;
    for (const c of hand) { n += c.r === 14 ? 11 : Math.min(10, c.r); if (c.r === 14) aces++; }
    while (n > 21 && aces) { n -= 10; aces--; }
    return { n, soft: aces > 0 };
  }
  const isBlackjack = (hand) => hand.length === 2 && bjTotal(hand).n === 21;

  // pc: the ComputerScreen it runs on, which shuts down when the game is over
  function BlackjackApp(pc) {
    const START = 200, GOAL = 1000, MIN_BET = 10, DECKS = 4;
    let stack = START, bet = MIN_BET, wager = 0, shoe = [], me = [], dealer = [], holeHidden = true;
    let state = 'bet', lines = [], btn = 0, timer = 0, next = null, t = 0, record = false;
    const after = (frames, fn) => { timer = frames; next = fn; };
    // run fns one after another, a beat apart, then done()
    const steps = (fns, done) => {
      if (!fns.length) { done(); return; }
      fns[0](); after(16, () => steps(fns.slice(1), done));
    };
    const draw1 = (hand) => () => { hand.push(shoe.pop()); sfx('putt'); };
    function shuffle() {
      shoe = [];
      for (let d = 0; d < DECKS; d++) shoe.push(...newDeck());
      for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
    }
    shuffle();
    const fixBet = () => { bet = Math.max(Math.min(MIN_BET, stack), Math.min(stack, bet)); };
    lines = ['Welcome to Spring Roll Blackjack!', 'Blackjack pays 3 to 2. Place your bet.'];
    fixBet();

    function deal() {
      const reshuffled = shoe.length < 60;
      if (reshuffled) shuffle();
      wager = bet; stack -= wager;
      me = []; dealer = []; holeHidden = true; state = 'deal'; btn = 0;
      lines = [(reshuffled ? 'Fresh shoe. ' : '') + 'You bet ' + wager + ' spring rolls.'];
      sfx('select');
      steps([draw1(me), draw1(dealer), draw1(me), draw1(dealer)], () => {
        const up = dealer[0].r;
        // the dealer peeks under an ace or a ten-card for blackjack
        if (isBlackjack(dealer) && (up === 14 || up >= 10)) { holeHidden = false; settle(); return; }
        if (isBlackjack(me)) { holeHidden = false; settle(); return; }
        state = 'play';
        lines = ['You have ' + totalText(me) + '. Dealer shows ' + RANK_TXT(up) + '.'];
      });
    }
    const totalText = (hand) => { const v = bjTotal(hand); return (v.soft && v.n < 21 ? 'soft ' : '') + v.n; };
    const canDouble = () => state === 'play' && me.length === 2 && stack >= wager;

    function hit() {
      sfx('putt'); me.push(shoe.pop());
      const v = bjTotal(me).n;
      if (v > 21) { state = 'wait'; lines = ['You bust with ' + v + '.']; after(30, () => { holeHidden = false; settle(); }); }
      else if (v === 21) { state = 'wait'; lines = ['21!']; after(24, dealerPlays); }
      else lines = ['You have ' + totalText(me) + '.'];
    }
    function double() {
      stack -= wager; wager *= 2;
      sfx('menu'); me.push(shoe.pop());
      state = 'wait';
      const v = bjTotal(me).n;
      lines = ['You double down to ' + wager + ' and draw ' + v + '.'];
      after(30, () => { if (v > 21) { holeHidden = false; settle(); } else dealerPlays(); });
    }
    function dealerPlays() {
      state = 'wait'; holeHidden = false; sfx('blip');
      lines = ['Dealer turns over ' + totalText(dealer) + '.'];
      const go = () => {
        if (bjTotal(dealer).n < 17) {
          after(30, () => { draw1(dealer)(); lines = ['Dealer draws to ' + totalText(dealer) + '.']; go(); });
        } else after(30, settle);
      };
      go();
    }
    // pay out (or not) and show what happened
    function settle() {
      const mine = bjTotal(me).n, theirs = bjTotal(dealer).n;
      const myBJ = isBlackjack(me), theirBJ = isBlackjack(dealer);
      let won = 0, msg;
      if (myBJ && theirBJ) { won = wager; msg = 'Both blackjack. Push.'; }
      else if (myBJ) { won = wager + Math.floor(wager * 1.5); msg = 'Blackjack! You win ' + (won - wager) + '.'; }
      else if (theirBJ) msg = 'Dealer has blackjack. You lose ' + wager + '.';
      else if (mine > 21) msg = 'Bust. You lose ' + wager + '.';
      else if (theirs > 21) { won = wager * 2; msg = 'Dealer busts with ' + theirs + '! You win ' + wager + '.'; }
      else if (mine > theirs) { won = wager * 2; msg = mine + ' beats ' + theirs + '. You win ' + wager + '.'; }
      else if (mine === theirs) { won = wager; msg = 'Push at ' + mine + '. Bet back.'; }
      else msg = theirs + ' beats ' + mine + '. You lose ' + wager + '.';
      stack += won;
      lines = [msg, 'You have ' + stack + ' spring rolls.'];
      if (won > wager) sfx('cup'); else if (won < wager) sfx('bump'); else sfx('blip');
      wager = 0; state = 'result';
    }
    function nextHand() {
      if (stack <= 0) {
        // busted: you get kicked off the computer
        remove(self); if (pc) remove(pc);
        say("Cody: Don't worry, the house always wins. That's how I lose mine too.");
        return;
      }
      if (stack >= GOAL) { state = 'over'; t = 0; record = saveBest('blackjack', stack); sfx('ding'); return; }
      fixBet(); me = []; dealer = []; state = 'bet';
      lines = ['Place your bet.'];
    }
    function leave() {
      remove(self);
      if (state === 'over') { if (pc) remove(pc); say('You broke the bank on Cody\'s computer. He looks nervous.'); return; }
      // walking away mid-hand forfeits the bet on the table
      record = saveBest('blackjack', stack);
      say('You log off with ' + stack + ' spring rolls.' + (record ? ' A new record!' : ''));
    }
    const askLeave = () => ask('Leave the table with ' + stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); });

    const self = {
      music: 'poker',
      update() {
        t++;
        if (timer > 0) {
          if (pressed.has('b')) askLeave();
          else if (--timer === 0 && next) { const f = next; next = null; f(); }
          return;
        }
        if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) leave(); return; }
        if (pressed.has('b')) { askLeave(); return; }
        if (state === 'result') { if (pressed.has('a')) { sfx('select'); nextHand(); } return; }
        if (state === 'bet') {
          const nudge = (d) => {
            const b = Math.max(Math.min(MIN_BET, stack), Math.min(stack, bet + d));
            if (b !== bet) { bet = b; sfx('select'); }
          };
          const rep = (k) => pressed.has(k) || (held[k] && t % 5 === 0);
          if (rep('right')) nudge(MIN_BET);
          if (rep('left')) nudge(-MIN_BET);
          if (rep('up')) nudge(MIN_BET * 5);
          if (rep('down')) nudge(-MIN_BET * 5);
          if (pressed.has('a')) deal();
          return;
        }
        if (state !== 'play') return;
        if (pressed.has('left')) { btn = (btn + 2) % 3; sfx('select'); }
        if (pressed.has('right')) { btn = (btn + 1) % 3; sfx('select'); }
        if (pressed.has('a')) {
          if (btn === 0) hit();
          else if (btn === 1) { lines = ['You stand on ' + bjTotal(me).n + '.']; dealerPlays(); }
          else if (canDouble()) double();
          else sfx('bump');
        }
      },
      draw() {
        // window + title bar
        ctx.fillStyle = WIN; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = TITLE; ctx.fillRect(0, 0, SW, 14);
        drawRoll(3, 4);
        text('Spring Roll Blackjack', 18, 3, 1, '#f8f8f8');
        const gl = 'Goal ' + GOAL;
        text(gl, SW - 20 - gl.length * 6, 3, 1, '#f8f8f8');
        ctx.fillStyle = INK; ctx.fillRect(SW - 13, 2, 10, 10);
        ctx.fillStyle = WIN; ctx.fillRect(SW - 12, 3, 8, 8);
        text('x', SW - 11, 1, 1, INK);
        // the table
        ctx.fillStyle = '#4a2810'; ctx.fillRect(6, 18, 308, 150); ctx.fillRect(4, 22, 312, 142);
        ctx.fillStyle = '#2c7a40'; ctx.fillRect(10, 22, 300, 142); ctx.fillRect(8, 26, 304, 134);
        const felt = '#88c898';
        text('BLACKJACK PAYS 3 TO 2', 160 - 21 * 3, 80, 1, felt);
        text('Dealer stands on all 17s', 160 - 24 * 3, 91, 1, felt);
        // a hand of cards, centred, squeezed together when it gets long
        const row = (hand, y, hideSecond) => {
          if (!hand.length) { ctx.fillStyle = '#246a36'; ctx.fillRect(160 - CARD_W - 1, y, CARD_W, CARD_H); ctx.fillRect(161, y, CARD_W, CARD_H); return; }
          const gap = hand.length > 6 ? 16 : 26, w = (hand.length - 1) * gap + CARD_W;
          hand.forEach((c, i) => drawCard(c, 160 - (w >> 1) + i * gap, y, hideSecond && i === 1));
        };
        // dealer
        drawAvatar(14, 28, '#3868c8');
        text('Dealer', 42, 30, 1, '#f8f8f8');
        row(dealer, 34, holeHidden);
        if (dealer.length) {
          const dt = holeHidden ? RANK_TXT(dealer[0].r) + ' + ?' : totalText(dealer);
          text(dt, 238, 46, 1, '#f8f8f8');
        }
        // you
        text('You', 20, 124, 1, '#f8f8f8');
        drawRoll(20, 136); text(String(stack), 34, 136, 1, '#f8f8f8');
        row(me, 104, false);
        if (me.length) text(totalText(me), 238, 116, 1, '#f8f8f8');
        const shown = state === 'bet' ? bet : wager;
        if (shown) {
          const bs = 'Bet ' + shown;
          drawRoll(160 - bs.length * 3 - 14, 146);
          text(bs, 160 - bs.length * 3, 146, 1, '#f8e070');
        }
        // what just happened
        ctx.fillStyle = INK; ctx.fillRect(4, 172, SW - 8, 26);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(5, 173, SW - 10, 24);
        lines.slice(0, 2).forEach((l, i) => text(l, 10, 176 + i * 11, 1, INK));
        // your controls
        if (state === 'bet') {
          text('Bet ' + bet + (bet === stack ? ' (all in)' : ''), 10, 204, 1, INK);
          ctx.fillStyle = INK; ctx.fillRect(160, 203, 150, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(161, 204, 148, 7);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(161, 204, Math.round(148 * Math.min(1, bet / Math.max(1, stack))), 7);
          text('Arrows: bet  Space: deal  Esc: leave', 10, 224, 1, INK);
        } else if (state === 'play' || state === 'deal' || state === 'wait') {
          const myTurn = state === 'play' && !timer;
          ['Hit', 'Stand', 'Double'].forEach((l, i) => {
            const x = 6 + i * 104, on = myTurn && i === btn, ok = myTurn && (i < 2 || canDouble());
            ctx.fillStyle = INK; ctx.fillRect(x, 202, 100, 16);
            ctx.fillStyle = on ? WIN_DARK : '#f8f8f8'; ctx.fillRect(x, 202, 99, 15);
            ctx.fillStyle = on ? '#f8f8f8' : WIN_DARK; ctx.fillRect(x + 1, 203, 98, 14);
            ctx.fillStyle = on ? '#f0d890' : WIN; ctx.fillRect(x + 1, 203, 97, 13);
            text(l, x + 50 - l.length * 3, 206, 1, ok ? INK : WIN_DARK);
          });
          text(myTurn ? 'Arrows: choose  Space: OK  Esc: leave' : 'Esc: leave the table', 10, 226, 1, INK);
        } else if (state === 'result') text('Space: next hand   Esc: leave the table', 10, 214, 1, INK);
        if (state === 'over') doneBox(['You broke the bank!',
          'Spring rolls: ' + stack, record ? 'New record!' : 'Best ' + getBest('blackjack')], t);
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
      music: 'coffee',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            coffeesToday++;
            questNote('coffee', 1);
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
  const ctext = (str, y, color) => {
    if (isTouch) str = touchHint(str);
    text(str, (SW - str.length * 6) >> 1, y, 1, color);
  };
  // Save a high score; returns true if it's a new record.
  function saveBest(key, score) {
    questNote(key, score);
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
    const PUNCHES = 5;
    let state = 'ready', t = 0, p = 0, dir = 1, n = 0, total = 0, last = null, swing = 0, shake = 0, record = false;
    const self = {
      music: 'punch',
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
            if (n >= PUNCHES) { state = 'done'; record = saveBest('punch5', total); sfx('ding'); }
            else state = 'play';
            t = 0;
          }
          return;
        }
        // the marker gets faster with every punch
        p += dir * (0.014 + n * 0.006);
        if (p >= 1) { p = 1; dir = -1; }
        if (p <= 0) { p = 0; dir = 1; }
        if (pressed.has('a')) {
          // points fall off smoothly from the centre; only a dead-centre hit is PERFECT
          const d = Math.abs(p - 0.5);
          const pts = d < 0.012 ? 100 : Math.max(1, Math.round(98 * Math.pow(1 - d * 2, 3)));
          last = { pts, label: pts === 100 ? 'PERFECT!' : pts >= 85 ? 'GREAT!' : pts >= 60 ? 'GOOD' : pts >= 30 ? 'OK' : 'WEAK...' };
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
        text('Best ' + getBest('punch5'), SW - 16 - ('Best ' + getBest('punch5')).length * 6, 22);
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
        ctx.fillStyle = '#f0d060'; ctx.fillRect(B.x + B.w * 0.40, B.y + 2, B.w * 0.20, B.h - 4);
        ctx.fillStyle = '#a8d870'; ctx.fillRect(B.x + B.w * 0.45, B.y + 2, B.w * 0.10, B.h - 4);
        ctx.fillStyle = '#389838'; ctx.fillRect(Math.round(B.x + B.w * 0.488), B.y + 2, Math.round(B.w * 0.024), B.h - 4);
        const mx = Math.round(B.x + 2 + p * (B.w - 6));
        ctx.fillStyle = col.dark; ctx.fillRect(mx, B.y - 5, 2, B.h + 10);
        if (state === 'ready') readyBox(t, 'Space: punch');
        else if (state === 'done') doneBox(['Workout done!', 'Total ' + total + ' / ' + PUNCHES * 100, record ? 'New record!' : 'Best ' + getBest('punch5')], t);
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
      music: 'run',
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
      music: 'pong',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            questNote('pong', mine > theirs ? 1 : 0);
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
      music: 'toss',
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

  // ---------- photocopier stacker: drop each sheet onto the pile ----------
  function StackGame() {
    const SHEET = 8, BASE_Y = 204, BASE_W = 120, L = 16, R = SW - 16;
    let state = 'ready', t = 0, stack = [{ x: (SW - BASE_W) / 2, w: BASE_W }], cur = null, dir = 1;
    let falling = [], flash = 0, cam = 0, record = false;
    const count = () => stack.length - 1;
    const yOf = (i) => BASE_Y - i * SHEET;
    function next() {
      const top = stack[stack.length - 1];
      dir = count() % 2 ? -1 : 1;
      cur = { x: dir > 0 ? L : R - top.w, w: top.w };
    }
    const self = {
      music: 'stack',
      update() {
        t++;
        for (const f of falling) { f.vy += 0.3; f.y += f.vy; }
        falling = falling.filter((f) => f.y < SH + cam + 20);
        cam += (Math.max(0, (stack.length - 16) * SHEET) - cam) * 0.1;
        if (flash) flash--;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; next(); } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(count() === 0 ? 'Not a single copy. The copier blinks: PC LOAD LETTER'
              : 'You stacked ' + count() + ' copies.' + (record ? ' A new record!' : ' Nice and neat.'));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the copies for someone else.'); return; }
        cur.x += dir * Math.min(6, 2 + count() * 0.15);
        if (cur.x + cur.w >= R) { cur.x = R - cur.w; dir = -1; }
        if (cur.x <= L) { cur.x = L; dir = 1; }
        if (!pressed.has('a')) return;
        const top = stack[stack.length - 1], y = yOf(stack.length);
        let x0 = Math.max(cur.x, top.x), x1 = Math.min(cur.x + cur.w, top.x + top.w);
        if (x1 <= x0) { // missed the pile completely
          falling.push({ x: cur.x, w: cur.w, y, vy: 0 });
          cur = null; state = 'done'; t = 0; record = saveBest('stack', count()); sfx('bump');
          return;
        }
        if (Math.abs(cur.x - top.x) <= 2) { x0 = top.x; x1 = top.x + top.w; flash = 30; sfx('ding'); }
        else {
          // whatever hangs over the edge gets cut off and falls
          if (cur.x < x0) falling.push({ x: cur.x, w: x0 - cur.x, y, vy: 0 });
          if (cur.x + cur.w > x1) falling.push({ x: x1, w: cur.x + cur.w - x1, y, vy: 0 });
          sfx('blip', true);
        }
        stack.push({ x: x0, w: x1 - x0 });
        next();
      },
      draw() {
        box(0, 0, SW, SH);
        text('Stack the copies!', 16, 10);
        const s = 'Copies ' + count(), b = 'Best ' + getBest('stack');
        text(s, SW - 16 - s.length * 6, 10);
        text(b, SW - 16 - b.length * 6, 22);
        ctx.save();
        ctx.beginPath(); ctx.rect(8, 34, SW - 16, SH - 42); ctx.clip();
        const c = Math.round(cam);
        const sheet = (x, y, w) => {
          x = Math.round(x); y = Math.round(y) + c; w = Math.round(w);
          ctx.fillStyle = col.dark; ctx.fillRect(x, y, w, SHEET);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), SHEET - 2);
          ctx.fillStyle = '#b8bcc8'; ctx.fillRect(x + 3, y + 4, Math.max(0, w - 6), 1);
        };
        // copier output tray
        ctx.fillStyle = col.dark; ctx.fillRect(SW / 2 - 80, BASE_Y + SHEET + c, 160, 10);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(SW / 2 - 79, BASE_Y + SHEET + 1 + c, 158, 8);
        stack.forEach((p, i) => sheet(p.x, yOf(i), p.w));
        if (cur) sheet(cur.x, yOf(stack.length), cur.w);
        for (const f of falling) sheet(f.x, f.y, f.w);
        ctx.restore();
        if (flash) ctext('PERFECT!', 44);
        if (state === 'ready') readyBox(t, 'Space: drop the sheet');
        else if (state === 'done') doneBox(['Missed the pile!', 'Stacked ' + count() + ' copies', record ? 'New record!' : 'Best ' + getBest('stack')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- electrical panel: repeat the light sequence ----------
  function SimonGame() {
    const S = 40;
    const LIGHTS = [
      { k: 'up', x: 140, y: 52, on: '#f85848', off: '#702820' },
      { k: 'right', x: 194, y: 104, on: '#78e060', off: '#2c5a28' },
      { k: 'down', x: 140, y: 156, on: '#68a0f8', off: '#283c78' },
      { k: 'left', x: 86, y: 104, on: '#f8d848', off: '#6a5818' },
    ];
    let state = 'ready', t = 0, seq = [], pos = 0, lit = -1, litT = 0, record = false;
    const rounds = () => Math.max(0, seq.length - 1);
    const step = () => Math.max(14, 30 - seq.length * 1.5);
    function nextRound() { seq.push(Math.floor(Math.random() * 4)); state = 'show'; t = 0; }
    const self = {
      music: 'simon',
      update() {
        t++;
        if (litT) litT--;
        if (state === 'ready') { if (t > 75) nextRound(); return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(rounds() === 0 ? 'The panel buzzes angrily. Best not to touch it.'
              : 'You got through ' + rounds() + (rounds() === 1 ? ' round' : ' rounds') + ' before something sparked.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You back away from the panel slowly.'); return; }
        if (state === 'show') {
          const st = Math.round(step()), u = t - 1, i = Math.floor(u / st);
          if (i < seq.length && u % st === 0) { lit = seq[i]; litT = Math.round(st * 0.7); sfx('note', lit); }
          if (u >= seq.length * st + 8) { state = 'input'; pos = 0; t = 0; }
        } else if (state === 'input') {
          const i = LIGHTS.findIndex((l) => pressed.has(l.k));
          if (i < 0) return;
          lit = i; litT = 12;
          if (i !== seq[pos]) { sfx('buzz'); state = 'done'; t = 0; record = saveBest('simon', rounds()); return; }
          sfx('note', i);
          if (++pos === seq.length) { state = 'pause'; t = 0; }
        } else if (state === 'pause' && t > 40) nextRound();
      },
      draw() {
        box(0, 0, SW, SH);
        text('Repeat the lights!', 16, 10);
        const s = 'Round ' + seq.length, b = 'Best ' + getBest('simon');
        text(s, SW - 16 - s.length * 6, 10);
        text(b, SW - 16 - b.length * 6, 22);
        // panel housing with screws
        ctx.fillStyle = col.dark; ctx.fillRect(70, 40, 180, 172);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(72, 42, 176, 168);
        ctx.fillStyle = '#585868';
        [[76, 46], [242, 46], [76, 204], [242, 204]].forEach(([x, y]) => ctx.fillRect(x, y, 3, 3));
        LIGHTS.forEach((l, i) => {
          const on = litT > 0 && lit === i;
          ctx.fillStyle = col.dark; ctx.fillRect(l.x, l.y, S, S);
          ctx.fillStyle = on ? l.on : l.off; ctx.fillRect(l.x + 2, l.y + 2, S - 4, S - 4);
          if (on) { ctx.fillStyle = '#f8f8f8'; ctx.fillRect(l.x + 6, l.y + 6, 6, 3); }
        });
        ctx.fillStyle = col.dark; ctx.fillRect(146, 110, 28, 28);
        ctx.fillStyle = state === 'done' ? '#f85848' : '#484858'; ctx.fillRect(148, 112, 24, 24);
        if (state === 'show') ctext('Watch...', 220);
        else if (state === 'input') ctext('Your turn!', 220);
        else if (state === 'pause') ctext('Correct!', 220);
        if (state === 'ready') readyBox(t, 'Arrows: repeat the lights');
        else if (state === 'done') doneBox(['Wrong light! Zap!', 'Rounds: ' + rounds(), record ? 'New record!' : 'Best ' + getBest('simon')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- fridge shell game: keep your eye on your lunch ----------
  function LunchGame() {
    const SLOT = [80, 160, 240], Y = 132, CW = 44, CH = 30;
    // each container knows which slot it's in; container 0 holds your lunch
    const conts = [0, 1, 2].map((i) => ({ slot: i, x: SLOT[i], y: Y, open: 0 }));
    let state = 'ready', t = 0, round = 0, swaps = [], swap = null, cursor = 1, picked = null, record = false;
    const dur = () => Math.max(7, 22 - round * 3);
    function startRound() {
      swaps = [];
      for (let i = 0; i < 3 + round * 2; i++) {
        const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
        swaps.push([a, b]);
      }
      conts[0].open = 1; state = 'reveal'; t = 0;
    }
    const at = (slot) => conts.find((c) => c.slot === slot);
    const self = {
      music: 'lunch',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) startRound(); return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(round === 0 ? 'That\'s not your lunch. Someone is going to be upset.'
              : 'You found your lunch ' + round + (round === 1 ? ' time' : ' times') + '. Then someone ate it anyway.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You close the fridge. Lunch can wait.'); return; }
        if (state === 'reveal') {
          if (t === 70) conts[0].open = 0;
          if (t > 90) { state = 'shuffle'; t = 0; swap = null; }
        } else if (state === 'shuffle') {
          if (!swap) {
            if (!swaps.length) { state = 'pick'; t = 0; return; }
            const [a, b] = swaps.shift();
            swap = { ca: at(a), cb: at(b), a, b, t: 0 };
          }
          const s = swap, k = ++s.t / dur(), arc = Math.sin(Math.PI * Math.min(1, k)) * 20;
          s.ca.x = SLOT[s.a] + (SLOT[s.b] - SLOT[s.a]) * Math.min(1, k); s.ca.y = Y - arc;
          s.cb.x = SLOT[s.b] + (SLOT[s.a] - SLOT[s.b]) * Math.min(1, k); s.cb.y = Y + arc;
          if (k >= 1) {
            s.ca.slot = s.b; s.cb.slot = s.a;
            s.ca.x = SLOT[s.b]; s.cb.x = SLOT[s.a]; s.ca.y = s.cb.y = Y;
            sfx('blip'); swap = null;
          }
        } else if (state === 'pick') {
          if (pressed.has('left')) { cursor = (cursor + 2) % 3; sfx('select'); }
          if (pressed.has('right')) { cursor = (cursor + 1) % 3; sfx('select'); }
          if (pressed.has('a')) {
            picked = at(cursor); picked.open = 1; t = 0;
            if (picked === conts[0]) { round++; state = 'right'; sfx('ding'); }
            else { conts[0].open = 1; state = 'done'; record = saveBest('lunch', round); sfx('buzz'); }
          }
        } else if (state === 'right' && t > 60) { picked.open = 0; startRound(); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Find your lunch!', 16, 10);
        const s = 'Found ' + round, b = 'Best ' + getBest('lunch');
        text(s, SW - 16 - s.length * 6, 10);
        text(b, SW - 16 - b.length * 6, 22);
        // inside of the fridge: white walls and wire shelves
        ctx.fillStyle = col.dark; ctx.fillRect(20, 40, SW - 40, 180);
        ctx.fillStyle = '#e8f0f8'; ctx.fillRect(22, 42, SW - 44, 176);
        ctx.fillStyle = '#b8c8d8';
        for (const y of [80, Y + CH + 2]) ctx.fillRect(22, y, SW - 44, 3);
        // light at the back
        ctx.fillStyle = '#fff8d0'; ctx.fillRect(SW / 2 - 12, 44, 24, 4);
        for (const c of conts) {
          const x = Math.round(c.x - CW / 2), y = Math.round(c.y);
          ctx.fillStyle = col.dark; ctx.fillRect(x, y, CW, CH);
          ctx.fillStyle = '#d8dce8'; ctx.fillRect(x + 2, y + 2, CW - 4, CH - 4);
          if (c.open) {
            if (c === conts[0]) { // your sandwich
              ctx.fillStyle = col.dark; ctx.fillRect(x + 8, y + 6, 28, 16);
              ctx.fillStyle = '#f0d0a0'; ctx.fillRect(x + 9, y + 7, 26, 4); ctx.fillRect(x + 9, y + 17, 26, 4);
              ctx.fillStyle = '#58a848'; ctx.fillRect(x + 9, y + 11, 26, 2);
              ctx.fillStyle = '#b83028'; ctx.fillRect(x + 9, y + 13, 26, 4);
            } else text('?', x + 19, y + 11);
          }
          // lid, lifted when open
          const ly = y - 6 - (c.open ? 12 : 0);
          ctx.fillStyle = col.dark; ctx.fillRect(x - 2, ly, CW + 4, 7);
          ctx.fillStyle = '#3878c8'; ctx.fillRect(x - 1, ly + 1, CW + 2, 5);
        }
        if (state === 'pick') {
          const x = SLOT[cursor], y = Y - 30 + ((tick >> 3) & 1);
          ctx.fillStyle = col.dark;
          for (let i = 0; i < 5; i++) ctx.fillRect(x - 5 + i, y + i, 10 - i * 2, 1);
          ctext('Which one is yours?', 196);
        } else if (state === 'reveal') ctext(t < 70 ? 'This one is yours!' : 'Keep your eye on it...', 196);
        else if (state === 'right') ctext('Yes! That\'s your lunch!', 196);
        if (state === 'ready') readyBox(t, 'Left/Right + Space: pick');
        else if (state === 'done') doneBox(['That\'s not yours!', 'Found it ' + round + (round === 1 ? ' time' : ' times'), record ? 'New record!' : 'Best ' + getBest('lunch')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- candy table: sneak candy while nobody is looking ----------
  function CandyGame() {
    const FLOOR = 184, BOWL_X = 150, HAND_X0 = 50;
    const pool = npcs.filter((n) => !n.ghost);
    const who = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const name = who ? who.name : 'Someone', look = who ? who.sprites : sprites;
    const CANDY = ['#f85848', '#f8d848', '#78e060', '#68a0f8', '#d870d0', '#f0b030'];
    let state = 'ready', t = 0, p = 0, candies = 0, watch = 'away', wt = 0, wdur = 120, grab = null, record = false;
    const turnTime = () => Math.max(14, 40 - candies * 3);
    function setWatch(w) {
      watch = w; wt = 0;
      wdur = w === 'away' ? 60 + Math.random() * 140 : w === 'turn' ? turnTime() : w === 'look' ? 50 + Math.random() * 70 : 12;
    }
    const self = {
      music: 'candy',
      update() {
        t++;
        if (grab) { grab.t++; if (grab.t > 20) grab = null; }
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; setWatch('away'); } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(candies === 0 ? name + ' caught you red-handed. Not a single candy!'
              : 'You sneaked ' + candies + (candies === 1 ? ' candy' : ' candies') + ' before ' + name + ' caught you.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the candy alone. For now.'); return; }
        if (++wt >= wdur) setWatch({ away: 'turn', turn: 'look', look: 'back', back: 'away' }[watch]);
        if (held.a) {
          // a few frames of grace when they first look, so it's fair
          if (watch === 'look' && wt > 5) { state = 'done'; t = 0; record = saveBest('candy', candies); sfx('buzz'); return; }
          p += 0.016;
          if (p >= 1) { p = 0; candies++; grab = { t: 0, c: CANDY[candies % CANDY.length] }; sfx('swish'); }
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Sneak some candy!', 16, 10);
        const s = 'Candy ' + candies, b = 'Best ' + getBest('candy');
        text(s, SW - 16 - s.length * 6, 10);
        text(b, SW - 16 - b.length * 6, 22);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(8, 36, SW - 16, FLOOR - 36);
        ctx.fillStyle = col.dark; ctx.fillRect(8, FLOOR, SW - 16, 1);
        ctx.fillStyle = '#c8b898'; ctx.fillRect(8, FLOOR + 1, SW - 16, 30);
        // candy table and bowl
        ctx.fillStyle = col.dark; ctx.fillRect(110, FLOOR - 26, 90, 6); ctx.fillRect(114, FLOOR - 20, 4, 20); ctx.fillRect(192, FLOOR - 20, 4, 20);
        ctx.fillStyle = '#c89058'; ctx.fillRect(111, FLOOR - 25, 88, 4);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = CANDY[i % CANDY.length];
          ctx.fillRect(BOWL_X - 18 + (i % 7) * 5, FLOOR - 44 + (i < 7 ? 4 : 0) + ((i * 3) % 2), 4, 4);
        }
        ctx.fillStyle = col.dark; ctx.fillRect(BOWL_X - 22, FLOOR - 36, 44, 10);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(BOWL_X - 21, FLOOR - 35, 42, 8);
        // you, reaching for it
        ctx.drawImage(sprites.right[0], 8, FLOOR - 48, 48, 48);
        const hx = Math.round(HAND_X0 + p * (BOWL_X - 8 - HAND_X0));
        if (p > 0) {
          ctx.fillStyle = col.dark; ctx.fillRect(HAND_X0 - 4, FLOOR - 25, hx - HAND_X0 + 6, 6);
          ctx.fillStyle = '#f8d0a8'; ctx.fillRect(HAND_X0 - 4, FLOOR - 24, hx - HAND_X0 + 5, 4);
          ctx.fillStyle = col.dark; ctx.fillRect(hx, FLOOR - 28, 9, 9);
          ctx.fillStyle = '#f8d0a8'; ctx.fillRect(hx + 1, FLOOR - 27, 7, 7);
        }
        if (grab) { ctx.fillStyle = grab.c; ctx.fillRect(40 + grab.t, FLOOR - 50 - grab.t, 5, 5); }
        // coworker at their desk
        ctx.fillStyle = col.dark; ctx.fillRect(270, FLOOR - 26, 44, 4); ctx.fillRect(272, FLOOR - 22, 3, 22); ctx.fillRect(308, FLOOR - 22, 3, 22);
        ctx.fillRect(282, FLOOR - 46, 22, 18); ctx.fillStyle = '#a8d8f0'; ctx.fillRect(284, FLOOR - 44, 18, 13);
        const dir = watch === 'away' ? 'right' : watch === 'turn' || watch === 'back' ? 'down' : 'left';
        ctx.drawImage(look[dir][0], 216, FLOOR - 48, 48, 48);
        if (watch === 'turn' && state === 'play') text('?', 237, FLOOR - 62 + ((tick >> 2) & 1));
        if (watch === 'look' || state === 'done') text('!', 237, FLOOR - 62);
        text(name, 240 - name.length * 3, FLOOR + 8);
        if (state === 'ready') readyBox(t, 'Hold Space: reach. Freeze!');
        else if (state === 'done') doneBox(['Caught by ' + name + '!', 'Candies: ' + candies, record ? 'New record!' : 'Best ' + getBest('candy')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- squat rack: mash A to stand the bar up before time runs out ----------
  function SquatGame() {
    const FLOOR = 196, START = 135, STEP = 20, TIME = 480;
    let state = 'ready', t = 0, weight = START, h = 0, left = TIME, best = 0, record = false;
    const self = {
      music: 'squat',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(best ? 'You squatted ' + best + ' lb!' + (record ? ' A new record!' : '') + ' Your legs are jelly.'
              : 'You couldn\'t budge it. Not today after all.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You rack the bar. Leg day can wait.'); return; }
        if (state === 'lifted') {
          if (t > 70) { weight += STEP; h = 0; left = TIME; state = 'play'; t = 0; }
          return;
        }
        // heavier bars need more presses and sink faster
        const k = weight / START;
        if (pressed.has('a')) { h += 0.07 / k; sfx('lift', h); }
        h = Math.max(0, h - 0.002 * k);
        if (h >= 1) { h = 1; best = weight; state = 'lifted'; t = 0; sfx('ding'); return; }
        if (--left <= 0) { state = 'done'; t = 0; record = saveBest('squat', best); sfx('bump'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Squat ' + weight + ' lb!', 16, 10);
        const b = 'Best ' + getBest('squat') + ' lb';
        text(b, SW - 16 - b.length * 6, 10);
        // time left
        text('TIME', 16, 24);
        ctx.fillStyle = col.dark; ctx.fillRect(46, 23, 120, 9);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(47, 24, 118, 7);
        ctx.fillStyle = left < TIME / 4 ? '#f05040' : '#58b058'; ctx.fillRect(47, 24, Math.round(118 * left / TIME), 7);
        // gym floor and rack uprights
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(8, 38, SW - 16, FLOOR - 38);
        ctx.fillStyle = col.dark; ctx.fillRect(8, FLOOR, SW - 16, 1);
        ctx.fillStyle = '#585868'; ctx.fillRect(8, FLOOR + 1, SW - 16, 14);
        for (const x of [70, 246]) {
          ctx.fillStyle = col.dark; ctx.fillRect(x, 70, 6, FLOOR - 70);
          ctx.fillStyle = '#8890a0'; ctx.fillRect(x + 1, 71, 4, FLOOR - 71);
        }
        // you: squashed down at the bottom of the squat, standing tall at the top
        const ph = Math.round(30 + h * 26), py = FLOOR - ph;
        const shake = state === 'play' && h > 0.05 ? ((tick >> 1) & 1) : 0;
        ctx.drawImage(sprites.down[0], 132 + shake, py, 56, ph);
        // the bar on your shoulders, with a plate for every 20 lb over the empty bar
        const by = py + Math.round(ph * 0.55);
        ctx.fillStyle = col.dark; ctx.fillRect(40, by, SW - 80, 4);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(41, by + 1, SW - 82, 2);
        const plates = Math.min(8, Math.round((weight - 45) / 40));
        for (let i = 0; i < plates; i++) {
          for (const side of [-1, 1]) {
            const x = side < 0 ? 96 - i * 6 : SW - 102 + i * 6;
            ctx.fillStyle = col.dark; ctx.fillRect(x, by - 14, 6, 32);
            ctx.fillStyle = i & 1 ? '#585868' : '#c03838'; ctx.fillRect(x + 1, by - 13, 4, 30);
          }
        }
        // lift meter
        const M = { x: SW - 34, y: 50, w: 14, h: 130 };
        ctx.fillStyle = col.dark; ctx.fillRect(M.x, M.y, M.w, M.h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(M.x + 2, M.y + 2, M.w - 4, M.h - 4);
        const mh = Math.round((M.h - 4) * h);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(M.x + 2, M.y + M.h - 2 - mh, M.w - 4, mh);
        text('UP', M.x + 1, M.y - 11);
        if (state === 'lifted') ctext('LIFTED! +' + STEP + ' lb next', 46);
        if (state === 'ready') readyBox(t, 'Mash Space to lift!');
        else if (state === 'done') doneBox(['Too heavy!', best ? 'Best lift: ' + best + ' lb' : 'No lift this time', record ? 'New record!' : 'Record ' + getBest('squat') + ' lb'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Wade's putting green: top-down mini golf ----------
  function GolfGame() {
    const FX = 16, FY = 40, FW = 288, FH = 174, R = 3, CUP = 5, MAX_STROKES = 10;
    // walls / sand / water are rects inside the field
    const HOLES = [
      { par: 2, ball: [50, 127], cup: [266, 127], walls: [], sand: [], water: [] },
      { par: 3, ball: [46, 192], cup: [266, 66], walls: [{ x: 150, y: 40, w: 12, h: 120 }], sand: [], water: [] },
      { par: 3, ball: [40, 127], cup: [278, 127],
        walls: [{ x: 140, y: 40, w: 12, h: 70 }, { x: 140, y: 152, w: 12, h: 62 }],
        sand: [{ x: 200, y: 96, w: 44, h: 70 }], water: [] },
      { par: 3, ball: [40, 66], cup: [272, 66], walls: [{ x: 228, y: 40, w: 10, h: 60 }],
        sand: [], water: [{ x: 96, y: 40, w: 110, h: 118 }] },
      { par: 4, ball: [44, 196], cup: [270, 64],
        walls: [{ x: 92, y: 40, w: 12, h: 130 }, { x: 186, y: 92, w: 12, h: 122 }],
        sand: [{ x: 214, y: 150, w: 70, h: 44 }], water: [{ x: 120, y: 40, w: 50, h: 26 }] },
    ];
    const BOUNDS = [
      { x: FX - 8, y: FY - 8, w: FW + 16, h: 8 }, { x: FX - 8, y: FY + FH, w: FW + 16, h: 8 },
      { x: FX - 8, y: FY, w: 8, h: FH }, { x: FX + FW, y: FY, w: 8, h: FH },
    ];
    const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    let state = 'ready', t = 0, n = 0, hole = null, ball = null, last = null, ang = 0, pw = 0, pwDir = 1;
    let strokes = 0, cards = [], msg = '', record = false;
    function startHole() {
      hole = HOLES[n]; strokes = 0;
      ball = { x: hole.ball[0], y: hole.ball[1], vx: 0, vy: 0, sink: 0 };
      ang = Math.atan2(hole.cup[1] - ball.y, hole.cup[0] - ball.x);
      state = 'aim'; t = 0;
    }
    function collide(r) {
      const nx = Math.max(r.x, Math.min(ball.x, r.x + r.w)), ny = Math.max(r.y, Math.min(ball.y, r.y + r.h));
      let dx = ball.x - nx, dy = ball.y - ny, d = Math.hypot(dx, dy);
      if (d >= R) return;
      if (d === 0) { dx = -Math.sign(ball.vx) || 1; dy = 0; d = 1; } // centre ended up inside: push back out
      dx /= d; dy /= d;
      ball.x = nx + dx * R; ball.y = ny + dy * R;
      const dot = ball.vx * dx + ball.vy * dy;
      if (dot < 0) { ball.vx -= 1.75 * dot * dx; ball.vy -= 1.75 * dot * dy; if (dot < -0.6) sfx('blip'); }
    }
    function finishHole(score) {
      cards.push(score);
      const diff = score - hole.par;
      msg = score === 1 ? 'Hole in one!' : diff <= -2 ? 'Eagle!' : diff === -1 ? 'Birdie!' : diff === 0 ? 'Par'
        : diff === 1 ? 'Bogey' : diff === 2 ? 'Double bogey' : '+' + diff;
      state = 'holed'; t = 0;
    }
    const total = () => cards.reduce((a, b) => a + b, 0);
    const parSoFar = () => HOLES.slice(0, cards.length).reduce((a, h) => a + h.par, 0);
    const best = () => +store.get('best.golf') || 0; // fewest strokes, 0 = never finished
    const self = {
      music: 'golf',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) startHole(); return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            const d = total() - parSoFar();
            say('You finished in ' + total() + ' strokes (' + (d === 0 ? 'even par' : d > 0 ? d + ' over par' : -d + ' under par') + ').'
              + (record ? ' A new record!' : '') + (d < 0 ? ' Wade is impressed.' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You lean the putter back against the wall.'); return; }
        if (state === 'aim') {
          if (held.left) ang -= 0.075;
          if (held.right) ang += 0.075;
          if (held.up) ang -= 0.018;
          if (held.down) ang += 0.018;
          if (pressed.has('a')) { state = 'power'; pw = 0; pwDir = 1; }
        } else if (state === 'power') {
          pw += pwDir * 0.018;
          if (pw >= 1) { pw = 1; pwDir = -1; }
          if (pw <= 0) { pw = 0; pwDir = 1; }
          if (!held.a) {
            const v = 0.6 + pw * 6.4;
            last = { x: ball.x, y: ball.y };
            ball.vx = Math.cos(ang) * v; ball.vy = Math.sin(ang) * v;
            strokes++; state = 'roll'; sfx('putt');
          }
        } else if (state === 'roll') {
          const sp = Math.hypot(ball.vx, ball.vy), steps = Math.max(1, Math.ceil(sp / 1.5));
          for (let i = 0; i < steps; i++) {
            ball.x += ball.vx / steps; ball.y += ball.vy / steps;
            for (const r of BOUNDS) collide(r);
            for (const r of hole.walls) collide(r);
          }
          const [cx, cy] = hole.cup, dc = Math.hypot(ball.x - cx, ball.y - cy);
          // the cup pulls a slow ball in; a fast one rolls right over it
          if (dc < 9 && sp < 2.5) { ball.vx += (cx - ball.x) * 0.04; ball.vy += (cy - ball.y) * 0.04; }
          if (dc < CUP && sp < 3.2) { sfx('cup'); finishHole(strokes); return; }
          if (hole.water.some((r) => inRect(r, ball.x, ball.y))) {
            sfx('splash'); strokes++; msg = 'Splash! +1 stroke';
            Object.assign(ball, { x: last.x, y: last.y, vx: 0, vy: 0 });
            state = 'wet'; t = 0; return;
          }
          const f = hole.sand.some((r) => inRect(r, ball.x, ball.y)) ? 0.9 : 0.983;
          ball.vx *= f; ball.vy *= f;
          if (Math.hypot(ball.vx, ball.vy) < 0.05) {
            ball.vx = ball.vy = 0;
            if (strokes >= MAX_STROKES) { msg = 'Picked up'; cards.push(MAX_STROKES); state = 'holed'; t = 0; return; }
            state = 'aim';
          }
        } else if (state === 'wet') {
          if (t > 50) state = strokes >= MAX_STROKES ? (cards.push(MAX_STROKES), msg = 'Picked up', t = 0, 'holed') : 'aim';
        } else if (state === 'holed' && t > 80) {
          if (++n < HOLES.length) startHole();
          else {
            state = 'done'; t = 0;
            questNote('golf', 1);
            record = !best() || total() < best();
            if (record) store.set('best.golf', total());
            sfx('ding');
          }
        }
      },
      draw() {
        box(0, 0, SW, SH);
        const h = hole || HOLES[0];
        text('Hole ' + Math.min(n + 1, HOLES.length) + '/' + HOLES.length + '  Par ' + h.par, 16, 10);
        text('Strokes ' + strokes, 16, 22);
        const tot = 'Total ' + total() + (cards.length ? ' (' + (total() - parSoFar() >= 0 ? '+' : '') + (total() - parSoFar()) + ')' : '');
        text(tot, SW - 16 - tot.length * 6, 10);
        const b = 'Best ' + (best() || '-');
        text(b, SW - 16 - b.length * 6, 22);
        // wooden rail around the course
        ctx.fillStyle = col.dark; ctx.fillRect(FX - 8, FY - 8, FW + 16, FH + 16);
        ctx.fillStyle = '#9a6434'; ctx.fillRect(FX - 7, FY - 7, FW + 14, FH + 14);
        // mowed stripes
        for (let x = 0; x < FW; x += 16) { ctx.fillStyle = (x >> 4) & 1 ? '#58a848' : '#68b858'; ctx.fillRect(FX + x, FY, Math.min(16, FW - x), FH); }
        ctx.fillStyle = col.dark; ctx.fillRect(FX - 1, FY - 1, FW + 2, 1); ctx.fillRect(FX - 1, FY + FH, FW + 2, 1);
        ctx.fillRect(FX - 1, FY, 1, FH); ctx.fillRect(FX + FW, FY, 1, FH);
        for (const r of h.sand) {
          ctx.fillStyle = '#e8d090'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = '#c8b070';
          for (let y = r.y + 3; y < r.y + r.h; y += 6) for (let x = r.x + ((y >> 1) % 6); x < r.x + r.w - 1; x += 7) ctx.fillRect(x, y, 1, 1);
        }
        for (const r of h.water) {
          ctx.fillStyle = '#3878c8'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = '#68a0f8';
          for (let y = r.y + 6; y < r.y + r.h - 2; y += 10)
            for (let x = r.x + 4 + ((y + (tick >> 3)) % 12); x < r.x + r.w - 6; x += 16) ctx.fillRect(x, y, 5, 1);
        }
        for (const r of h.walls) {
          ctx.fillStyle = col.dark; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = '#9a6434'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
          ctx.fillStyle = '#c89058'; ctx.fillRect(r.x + 2, r.y + 1, 2, r.h - 2);
        }
        // cup and flag
        const [cx, cy] = h.cup;
        ctx.fillStyle = col.dark; ctx.fillRect(cx - 4, cy - 3, 9, 7); ctx.fillRect(cx - 3, cy - 4, 7, 9);
        ctx.fillRect(cx, cy - 20, 1, 18);
        ctx.fillStyle = '#f05040';
        for (let i = 0; i < 5; i++) ctx.fillRect(cx + 1, cy - 20 + i, 8 - i * 2 + (i < 3 ? 2 : 0), 1);
        if (ball && state !== 'holed') {
          // aim line: dots get longer with power
          if (state === 'aim' || state === 'power') {
            const len = 14 + (state === 'power' ? pw * 50 : 10);
            ctx.fillStyle = '#f8f8f8';
            for (let d = 6; d < len; d += 4) ctx.fillRect(Math.round(ball.x + Math.cos(ang) * d), Math.round(ball.y + Math.sin(ang) * d), 1, 1);
          }
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(ball.x) - 2, Math.round(ball.y) - 1, 5, 4);
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(ball.x) - 3, Math.round(ball.y) - 2, 5, 3); ctx.fillRect(Math.round(ball.x) - 2, Math.round(ball.y) - 3, 3, 5);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(Math.round(ball.x) - 2, Math.round(ball.y) - 2, 3, 3);
        }
        if (state === 'power') {
          text('POWER', 16, SH - 14);
          ctx.fillStyle = col.dark; ctx.fillRect(50, SH - 15, 100, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(51, SH - 14, 98, 7);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(51, SH - 14, Math.round(98 * pw), 7);
        } else if (state === 'aim') text('Left/Right: aim  Space: putt', 16, SH - 14);
        else if (state !== 'ready' && state !== 'done') text('Esc: give up', 16, SH - 14);
        if (state === 'holed' || state === 'wet') { box(90, 110, 140, 30); ctext(msg, 121); }
        if (state === 'ready') readyBox(t, 'Hold Space, let go to putt');
        else if (state === 'done') {
          const d = total() - parSoFar();
          doneBox(['Round complete!', total() + ' strokes (' + (d === 0 ? 'E' : (d > 0 ? '+' : '') + d) + ')', record ? 'New record!' : 'Best ' + best()], t);
        }
      },
    };
    return self;
  }

  // ---------- Damir's game: Lights Out ----------
  // The power is cut. Your flashlight is the only light; shadows creep closer
  // whenever they're out of the beam and freeze while it's on them. Find three
  // fuses and get them back to the breaker before they reach you.
  function DarkGame() {
    const AX = 8, AY = 32, AW = SW - 16, AH = SH - 40, SPEED = 1.4, CONE = 0.5, AMBIENT = 16;
    const DESKS = [
      { x: 56, y: 62, w: 52, h: 14 }, { x: 56, y: 172, w: 52, h: 14 }, { x: 148, y: 92, w: 14, h: 72 },
      { x: 206, y: 50, w: 60, h: 14 }, { x: 206, y: 190, w: 60, h: 14 }, { x: 266, y: 104, w: 14, h: 50 },
    ];
    const SPOTS = [[86, 44], [86, 206], [126, 128], [186, 126], [236, 84], [236, 160], [298, 44], [298, 214], [130, 210], [190, 40]];
    const BREAKER = { x: AX + 2, y: 118, w: 10, h: 18 };
    const dark = document.createElement('canvas');
    dark.width = SW; dark.height = SH;
    const dctx = dark.getContext('2d');
    const shuffled = SPOTS.slice().sort(() => Math.random() - 0.5);
    const fuses = shuffled.slice(0, 3).map(([x, y]) => ({ x, y, got: false }));
    const cells = shuffled.slice(3, 5).map(([x, y]) => ({ x, y, got: false }));
    const me = { x: 30, y: 127, ang: 0, target: 0, dir: 'right', moving: false };
    let state = 'intro', t = 0, time = 0, battery = 100, shadows = [], lights = 0, record = false, flicker = false;
    const got = () => fuses.filter((f) => f.got).length;
    const blocked = (x, y) => x < AX + 6 || x > AX + AW - 6 || y < AY + 4 || y > AY + AH - 2 ||
      DESKS.some((d) => x > d.x - 5 && x < d.x + d.w + 5 && y > d.y - 2 && y < d.y + d.h + 6);
    function spawnShadow() {
      let x, y, tries = 0;
      do { x = AX + 10 + Math.random() * (AW - 20); y = AY + 10 + Math.random() * (AH - 20); }
      while (Math.hypot(x - me.x, y - me.y) < 130 && ++tries < 50);
      shadows.push({ x, y, lit: 0, seed: Math.random() * 100 });
    }
    const beamLen = () => 44 + battery * 0.8;
    function inBeam(x, y) {
      if (flicker || battery <= 0) return false;
      const dx = x - me.x, dy = y - me.y, d = Math.hypot(dx, dy);
      if (d > beamLen()) return false;
      let a = Math.atan2(dy, dx) - me.ang;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      return Math.abs(a) < CONE + 6 / Math.max(d, 1);
    }
    const self = {
      music: 'dark',
      update() {
        t++;
        if (state === 'intro') { if (t > 150) { state = 'ready'; t = 0; } return; }
        if (state === 'ready') {
          if (t > 40 && (pressed.has('a') || pressed.has('b'))) { state = 'play'; t = 0; for (let i = 0; i < 3; i++) spawnShadow(); }
          return;
        }
        if (state === 'caught' || state === 'win') {
          if (state === 'win') lights = Math.min(1, lights + 0.02);
          if (t > 90 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            questNote('dark', state === 'win' ? 1 : 0);
            say(state === 'win'
              ? 'The lights flicker back on. Damir looks almost disappointed. "Not bad... for a first time."'
              : 'Something cold grabs your shoulder... The lights come on. Damir is smiling. "Maybe next time."');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You fumble for the door and flee. Damir chuckles in the dark.'); return; }
        time++;
        // walking: eight directions, the flashlight swings to face where you're going
        let vx = (held.right ? 1 : 0) - (held.left ? 1 : 0), vy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
        me.moving = !!(vx || vy);
        if (me.moving) {
          const len = Math.hypot(vx, vy);
          vx = vx / len * SPEED; vy = vy / len * SPEED;
          if (!blocked(me.x + vx, me.y)) me.x += vx;
          if (!blocked(me.x, me.y + vy)) me.y += vy;
          me.target = Math.atan2(vy, vx);
          me.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        }
        let da = me.target - me.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        me.ang += da * 0.25;
        // the batteries run down, and the beam flickers when they're nearly flat
        if (time % 30 === 0) battery = Math.max(0, battery - 1);
        flicker = battery < 25 && Math.random() < (25 - battery) / 60;
        for (const f of fuses) if (!f.got && Math.hypot(f.x - me.x, f.y - me.y) < 10) {
          f.got = true; sfx('note', 3); spawnShadow();
        }
        for (const c of cells) if (!c.got && Math.hypot(c.x - me.x, c.y - me.y) < 10) {
          c.got = true; battery = Math.min(100, battery + 40); sfx('swish');
        }
        if (got() === 3 && Math.hypot(BREAKER.x + 5 - me.x, BREAKER.y + 9 - me.y) < 16) {
          state = 'win'; t = 0; sfx('ding');
          const secs = Math.ceil(time / 60), best = +store.get('best.dark') || 0;
          record = !best || secs < best;
          if (record) store.set('best.dark', secs);
          return;
        }
        // shadows creep while you're not looking, freeze in the beam, and melt away if you hold it on them
        const speed = 0.38 + got() * 0.1;
        for (const s of shadows) {
          if (inBeam(s.x, s.y)) {
            if (++s.lit > 75) { s.dead = true; sfx('splash'); }
            continue;
          }
          s.lit = Math.max(0, s.lit - 1);
          const dx = me.x - s.x, dy = me.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.x += dx / d * speed + Math.sin((time + s.seed * 10) / 20) * 0.2;
          s.y += dy / d * speed + Math.cos((time + s.seed * 10) / 23) * 0.2;
          if (d < 9) { state = 'caught'; t = 0; sfx('buzz'); return; }
        }
        const lost = shadows.filter((s) => s.dead).length;
        shadows = shadows.filter((s) => !s.dead);
        for (let i = 0; i < lost; i++) spawnShadow();
      },
      draw() {
        if (state === 'intro') {
          // the world fades to black, then Damir's question hangs there
          ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, t / 60) + ')'; ctx.fillRect(0, 0, SW, SH);
          if (t > 70) {
            ctx.globalAlpha = Math.min(1, (t - 70) / 30);
            ctext('Do you feel safe in the dark?', SH / 2 - 4, '#f8f8f8');
            ctx.globalAlpha = 1;
          }
          return;
        }
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
        if (state === 'ready') {
          ctext('LIGHTS OUT', 50, '#f8f8f8');
          ['Damir cut the power.', '', 'Find the 3 fuses and bring', 'them back to the breaker.', '',
            'Things move in the dark.', 'Keep your flashlight on them', 'and they can\'t come closer.', '',
            'Arrows: walk and aim'].forEach((l, i) => ctext(l, 74 + i * 12, '#c8ccd8'));
          if (t > 40 && (tick >> 4) & 1) ctext('Press Space', 206, '#f8f8f8');
          return;
        }
        // the office, which you mostly can't see
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(AX, AY, AW, AH);
        ctx.fillStyle = '#a4acc4';
        for (let y = AY + 4; y < AY + AH; y += 8) for (let x = AX + ((y >> 3) & 1) * 4 + 2; x < AX + AW; x += 8) ctx.fillRect(x, y, 1, 1);
        for (const d of DESKS) {
          ctx.fillStyle = col.dark; ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.fillStyle = '#c89058'; ctx.fillRect(d.x + 1, d.y + 1, d.w - 2, d.h - 3);
        }
        ctx.fillStyle = col.dark; ctx.fillRect(BREAKER.x, BREAKER.y, BREAKER.w, BREAKER.h);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(BREAKER.x + 1, BREAKER.y + 1, BREAKER.w - 2, BREAKER.h - 2);
        for (const f of fuses) if (!f.got) {
          ctx.fillStyle = col.dark; ctx.fillRect(f.x - 2, f.y - 4, 5, 9);
          ctx.fillStyle = '#f0d060'; ctx.fillRect(f.x - 1, f.y - 3, 3, 7);
          ctx.fillStyle = '#c8ccd8'; ctx.fillRect(f.x - 1, f.y - 3, 3, 1); ctx.fillRect(f.x - 1, f.y + 3, 3, 1);
        }
        for (const c of cells) if (!c.got) {
          ctx.fillStyle = col.dark; ctx.fillRect(c.x - 4, c.y - 2, 8, 5);
          ctx.fillStyle = '#58b058'; ctx.fillRect(c.x - 3, c.y - 1, 5, 3); ctx.fillRect(c.x + 3, c.y, 1, 1);
        }
        // shadows: only visible where the light falls on them
        for (const s of shadows) {
          const x = Math.round(s.x), y = Math.round(s.y), wob = (tick >> 3) & 1;
          ctx.fillStyle = '#201028';
          ctx.fillRect(x - 5, y - 10, 10, 14); ctx.fillRect(x - 4, y - 12, 8, 2);
          for (let i = 0; i < 5; i++) ctx.fillRect(x - 5 + i * 2, y + 4, 1, 2 + ((i + wob) & 1));
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x - 3, y - 7, 2, 2); ctx.fillRect(x + 1, y - 7, 2, 2);
        }
        ctx.drawImage(sprites[me.dir][me.moving ? ((time >> 3) & 1 ? 1 : 2) : 0], Math.round(me.x) - 8, Math.round(me.y) - 14);
        // darkness with the flashlight cut out of it
        const L = 1 - lights;
        if (L > 0) {
          dctx.globalCompositeOperation = 'source-over';
          dctx.clearRect(0, 0, SW, SH);
          dctx.fillStyle = 'rgba(0,0,0,' + L + ')'; dctx.fillRect(AX, AY, AW, AH);
          dctx.globalCompositeOperation = 'destination-out';
          const glow = dctx.createRadialGradient(me.x, me.y, 2, me.x, me.y, AMBIENT);
          glow.addColorStop(0, 'rgba(0,0,0,0.75)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
          dctx.fillStyle = glow; dctx.fillRect(me.x - AMBIENT, me.y - AMBIENT, AMBIENT * 2, AMBIENT * 2);
          if (!flicker && battery > 0 && state === 'play') {
            const len = beamLen();
            const g = dctx.createRadialGradient(me.x, me.y, 4, me.x, me.y, len);
            g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            dctx.fillStyle = g;
            dctx.beginPath(); dctx.moveTo(me.x, me.y);
            dctx.arc(me.x, me.y, len, me.ang - CONE, me.ang + CONE); dctx.closePath(); dctx.fill();
          }
          ctx.drawImage(dark, 0, 0);
          // things you can make out even in the dark: eyes, the breaker's LED, a fuse's glint
          for (const s of shadows) {
            if (inBeam(s.x, s.y) || ((tick + s.seed * 7) % 140) < 8) continue; // they blink
            ctx.fillStyle = '#e03030';
            ctx.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 7, 1, 1); ctx.fillRect(Math.round(s.x) + 2, Math.round(s.y) - 7, 1, 1);
          }
          if ((tick >> 5) & 1) { ctx.fillStyle = got() === 3 ? '#58e048' : '#f05040'; ctx.fillRect(BREAKER.x + 4, BREAKER.y + 3, 2, 2); }
          fuses.forEach((f, i) => {
            if (!f.got && (tick + i * 47) % 160 < 4) { ctx.fillStyle = '#f8f0a0'; ctx.fillRect(f.x, f.y - 1, 1, 1); }
          });
        }
        // HUD
        text('Fuses ' + got() + '/3', 12, 8, 1, '#f8f8f8');
        text('Light', 96, 8, 1, '#f8f8f8');
        ctx.fillStyle = '#585868'; ctx.fillRect(128, 8, 62, 7);
        ctx.fillStyle = battery < 25 ? '#f05040' : '#f0d060'; ctx.fillRect(129, 9, Math.round(60 * battery / 100), 5);
        const secs = Math.ceil(time / 60), best = +store.get('best.dark') || 0;
        const tm = secs + 's' + (best ? '  Best ' + best + 's' : '');
        text(tm, SW - 12 - tm.length * 6, 8, 1, '#f8f8f8');
        if (got() === 3 && state === 'play') text('Back to the breaker!', 12, 20, 1, '#58e048');
        else if (state === 'play') text('Esc: run away', 12, 20, 1, '#8890a0');
        if (state === 'caught') {
          ctx.fillStyle = 'rgba(80,0,0,' + Math.min(0.85, t / 40) + ')'; ctx.fillRect(0, 0, SW, SH);
          if (t > 40) { ctext('IT FOUND YOU', 100, '#f8f8f8'); if (t > 90 && (tick >> 4) & 1) ctext('Press Space', 140, '#f8f8f8'); }
        } else if (state === 'win' && t > 40) {
          doneBox(['The lights are back on!', 'Time: ' + secs + 's', record ? 'New record!' : 'Best ' + best + 's'], t - 60);
        }
      },
    };
    return self;
  }

  // ---------- Richard's air handling duel: rock-paper-scissors as a retro battle ----------
  // Fan beats coil, coil beats damper, damper beats fan. First one down to 0 HP loses.
  const MOVES = [
    { key: 'fan', label: 'FAN GUST', said: 'Fan Gust' },
    { key: 'coil', label: 'COIL FREEZE', said: 'Coil Freeze' },
    { key: 'damper', label: 'DAMPER BLOCK', said: 'Damper Block' },
  ];
  const BEATS = { fan: 'coil', coil: 'damper', damper: 'fan' };
  // What it looks like when that move wins the round.
  const WIN_TEXT = {
    fan: 'Fan blows cold air away!',
    coil: 'Coil freezes damper immobile!',
    damper: 'Damper blocks fan air!',
  };
  const MOVE_SFX = { fan: 'swish', coil: 'note', damper: 'bump' };

  function BattleGame() {
    const MAX_HP = 3;
    const RX = 230, RY = 38, RS = 64;      // Richard, top right
    const PX = 26, PY = 100, PS = 76;      // you, seen from behind, bottom left
    const ECX = RX + RS / 2, ECY = RY + RS / 2, PCX = PX + PS / 2, PCY = PY + PS / 3;
    const rSprites = spritesFor('Richard');
    // hp is the real score; shown drains towards it so the bar visibly empties.
    let hp = { you: MAX_HP, rich: MAX_HP }, shown = { you: MAX_HP, rich: MAX_HP };
    let state = 'msg', sel = 0, queue = [], lines = [], chars = 0;
    let fx = null, hurt = { you: 0, rich: 0 }, result = null;

    // Each queued step is a line of text plus whatever happens once it is read.
    function push(str, step) { queue.push({ str, step: step || null }); }
    function nextMsg() {
      const m = queue.shift();
      if (!m) { state = 'menu'; return; }
      lines = wrap(m.str, Math.floor((SW - 16) / 6) - 1).slice(0, 2);
      chars = 0;
      if (m.step) m.step();
    }
    function damage(who) {
      hp[who]--; hurt[who] = 24; sfx('hit');
      if (hp[who] > 0) return;
      result = who === 'rich' ? 'win' : 'lose';
      push(who === 'rich' ? 'I have taught you the ways of airflow well!'
        : 'You still have much to learn!', () => sfx(result === 'win' ? 'ding' : 'buzz'));
    }
    function attack(mv, toward) {
      fx = { kind: mv.key, toward, t: 0 };
      sfx(MOVE_SFX[mv.key], 2);
    }
    function round(you) {
      const rich = MOVES[Math.floor(Math.random() * MOVES.length)];
      push('You use ' + you.said + '!', () => attack(you, 'rich'));
      push('Richard uses ' + rich.said + '!', () => attack(rich, 'you'));
      if (you.key === rich.key) push('You read each other\'s mind!');
      else if (BEATS[you.key] === rich.key) push(WIN_TEXT[you.key], () => damage('rich'));
      else push(WIN_TEXT[rich.key], () => damage('you'));
      state = 'msg';
      nextMsg();
    }

    function hpBar(x, y, w, name, value) {
      box(x, y, w, 38);
      text(name, x + 8, y + 6);
      text('HP', x + 8, y + 22);
      const bx = x + 28, bw = w - 60, f = Math.max(0, value) / MAX_HP;
      ctx.fillStyle = col.dark; ctx.fillRect(bx, y + 21, bw, 8);
      ctx.fillStyle = '#f8f8f8'; ctx.fillRect(bx + 1, y + 22, bw - 2, 6);
      ctx.fillStyle = f > 0.5 ? '#58b058' : f > 0.2 ? '#f0b030' : '#f05040';
      ctx.fillRect(bx + 1, y + 22, Math.round((bw - 2) * f), 6);
      text(Math.ceil(Math.max(0, value)) + '/' + MAX_HP, bx + bw + 4, y + 22);
    }

    const self = {
      music: 'battle',
      update() {
        if (fx && ++fx.t > 34) fx = null;
        for (const k in hurt) if (hurt[k] > 0) hurt[k]--;
        // drain the bars before letting the next line through
        let draining = false;
        for (const k in shown) {
          if (shown[k] > hp[k]) { shown[k] = Math.max(hp[k], shown[k] - 0.05); draining = true; }
        }
        if (state === 'menu') {
          if (pressed.has('up')) { sel = (sel + MOVES.length - 1) % MOVES.length; sfx('select'); }
          if (pressed.has('down')) { sel = (sel + 1) % MOVES.length; sfx('select'); }
          if (pressed.has('a')) { sfx('menu'); round(MOVES[sel]); return; }
          if (pressed.has('b')) { remove(self); say('You step away. Richard nods: another time, then.'); }
          return;
        }
        const len = lines.join('').length;
        if (chars < len) { chars += held.a || held.b ? 3 : 1; return; }
        if (draining || fx) return;
        if (pressed.has('a') || pressed.has('b')) {
          // the last line of a finished duel closes it
          if (result && !queue.length) {
            remove(self);
            questNote('battle', result === 'win' ? 1 : 0);
            say(result === 'win'
              ? 'You won the air handling duel! Richard looks genuinely proud.'
              : 'Richard wins. Time to read up on airflow.');
            return;
          }
          sfx('select');
          nextMsg();
        }
      },
      draw() {
        box(0, 0, SW, SH);
        // battle backdrop: a pale wall over a floor band, with a pad under each fighter
        ctx.fillStyle = '#d8dce8'; ctx.fillRect(4, 4, SW - 8, 146);
        ctx.fillStyle = '#c8b898'; ctx.fillRect(4, 150, SW - 8, SH - 154);
        ctx.fillStyle = col.dark; ctx.fillRect(4, 150, SW - 8, 1);
        ctx.fillStyle = '#b0a888'; ctx.fillRect(RX - 6, RY + RS - 6, RS + 12, 6);
        ctx.fillStyle = '#b0a888'; ctx.fillRect(PX - 10, PY + PS - 10, PS + 20, 8);
        // the fighters, blinking when they have just been hit
        const flash = (n) => n > 0 && (n >> 1) & 1;
        if (!flash(hurt.rich)) ctx.drawImage(rSprites.down[0], RX, RY, RS, RS);
        if (!flash(hurt.you)) ctx.drawImage(sprites.up[0], PX, PY, PS, PS);
        hpBar(8, 10, 150, 'RICHARD', shown.rich);
        hpBar(162, 112, 150, 'YOU', shown.you);
        // whichever move is flying across the screen
        if (fx) {
          const [ax, ay] = fx.toward === 'rich' ? [PCX, PCY] : [ECX, ECY];
          const [bx, by] = fx.toward === 'rich' ? [ECX, ECY] : [PCX, PCY];
          for (let i = 0; i < 5; i++) {
            const f = 0.18 + 0.82 * (((fx.t / 30) + i * 0.13) % 1);
            const x = Math.round(ax + (bx - ax) * f), y = Math.round(ay + (by - ay) * f);
            if (fx.kind === 'fan') {
              ctx.fillStyle = i & 1 ? '#f8f8f8' : '#a8d8f0';
              ctx.fillRect(x - 9, y, 18, 2);
            } else if (fx.kind === 'coil') {
              ctx.fillStyle = '#a8e0f8';
              ctx.fillRect(x - 5, y, 11, 1); ctx.fillRect(x, y - 5, 1, 11);
              ctx.fillRect(x - 2, y - 2, 4, 4);
            } else {
              ctx.fillStyle = i & 1 ? '#8890a0' : '#585868';
              ctx.fillRect(x - 3, y - 8, 5, 16);
            }
          }
        }
        if (state === 'menu') {
          box(0, SH - 64, SW, 64);
          text('What will', 14, SH - 52);
          text('you use?', 14, SH - 36);
          text('Esc: give up', 14, SH - 18);
          MOVES.forEach((m, i) => {
            text(m.label, 134, SH - 56 + i * 16);
            if (i === sel) text('>', 122, SH - 56 + i * 16);
          });
          return;
        }
        box(0, SH - 48, SW, 48);
        let left = chars;
        lines.forEach((l, i) => { text(l.slice(0, Math.max(0, left)), 12, SH - 38 + i * 16); left -= l.length; });
        if (chars >= lines.join('').length && !fx && shown.you <= hp.you && shown.rich <= hp.rich
          && (tick >> 4) & 1) text('~', SW - 14, SH - 12);
      },
    };
    push('Richard wants to test your air handling knowledge!');
    nextMsg();
    return self;
  }

  // ---------- air handling fan: hold the wheel inside the target CFM band ----------
  // Hold A to spin up, let go to coast. Push too hard and the motor amps redline.
  function FanGame() {
    const GAUGE = { x: 212, y: 40, w: 30, h: 160 }, AMP = { x: 262, y: 40, w: 20, h: 160 };
    const WHEEL = { x: 100, y: 118, r: 50 }, BRANCHES = 3, HOLD_NEED = 90, TIME = 540;
    let state = 'ready', t = 0, rpm = 0, amps = 0, spin = 0;
    let branch = 0, band = null, hold = 0, left = TIME, done = 0, record = false;
    function newBand() {
      const w = 16 - branch * 3, lo = 26 + Math.random() * (62 - w);
      band = { lo, hi: lo + w };
      hold = 0; left = TIME;
    }
    newBand();
    const self = {
      music: 'plant',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(done === BRANCHES ? 'Every branch balanced. The unit runs sweet!'
              : done ? 'You balanced ' + done + ' of ' + BRANCHES + ' branches.'
                : 'Not a single branch balanced. The fan wins this round.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the fan to its own devices.'); return; }
        // the wheel spins up under power and coasts down against the belt drag
        rpm = Math.max(0, Math.min(108, rpm + (held.a ? 0.85 : -0.5)));
        spin += rpm / 60;
        // amps chase the speed, with an inrush kick whenever you are on the throttle
        amps += ((rpm * 0.95 + (held.a ? 20 : 0)) - amps) * 0.07;
        if (amps > 100) { state = 'done'; t = 0; record = saveBest('fan', done); sfx('buzz'); return; }
        if (rpm >= band.lo && rpm <= band.hi) {
          hold++;
          if (hold % 12 === 0) sfx('blip', true);
          if (hold >= HOLD_NEED) {
            done++; sfx('ding');
            if (++branch >= BRANCHES) { state = 'done'; t = 0; record = saveBest('fan', done); return; }
            newBand();
          }
        } else hold = Math.max(0, hold - 2);
        if (--left <= 0) { state = 'done'; t = 0; record = saveBest('fan', done); sfx('bump'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Branch ' + Math.min(branch + 1, BRANCHES) + ' of ' + BRANCHES, 16, 10);
        const b = 'Best ' + getBest('fan');
        text(b, SW - 16 - b.length * 6, 10);
        // time left
        ctx.fillStyle = col.dark; ctx.fillRect(16, 24, 180, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(17, 25, 178, 6);
        ctx.fillStyle = left < TIME / 4 ? '#f05040' : '#58b058';
        ctx.fillRect(17, 25, Math.round(178 * left / TIME), 6);
        // the fan wheel, blurring as it speeds up
        const W = WHEEL;
        ctx.fillStyle = col.dark; ring(W.x - W.r - 2, W.y - W.r - 2, W.r * 2 + 4, W.r * 2 + 4);
        ctx.fillStyle = '#d8dce8'; ctx.fillRect(W.x - W.r, W.y - W.r, W.r * 2, W.r * 2);
        ctx.fillStyle = col.dark;
        for (let i = 0; i < 10; i++) {
          const a = spin * 0.06 + i * Math.PI / 5;
          for (let r = 12; r < W.r - 3; r += 3) {
            ctx.fillRect(Math.round(W.x + Math.cos(a) * r) - 1, Math.round(W.y + Math.sin(a) * r) - 1, 3, 3);
          }
        }
        ctx.fillStyle = '#585868'; ctx.fillRect(W.x - 8, W.y - 8, 16, 16);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(W.x - 6, W.y - 6, 12, 12);
        // CFM gauge with the target band marked
        const G = GAUGE, gy = (v) => G.y + G.h - 2 - Math.round((G.h - 4) * v / 110);
        text('CFM', G.x, G.y - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(G.x, G.y, G.w, G.h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(G.x + 2, G.y + 2, G.w - 4, G.h - 4);
        ctx.fillStyle = '#b8e8b8'; ctx.fillRect(G.x + 2, gy(band.hi), G.w - 4, gy(band.lo) - gy(band.hi));
        ctx.fillStyle = '#58b058'; ctx.fillRect(G.x + 2, gy(band.hi), G.w - 4, 1); ctx.fillRect(G.x + 2, gy(band.lo), G.w - 4, 1);
        ctx.fillStyle = col.dark; ctx.fillRect(G.x - 3, gy(rpm) - 1, G.w + 6, 3);
        // hold meter: fills while you stay in the band
        const hw = Math.round((G.w - 4) * Math.min(1, hold / HOLD_NEED));
        ctx.fillStyle = col.dark; ctx.fillRect(G.x, G.y + G.h + 6, G.w, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(G.x + 1, G.y + G.h + 7, G.w - 2, 6);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(G.x + 2, G.y + G.h + 8, hw, 4);
        // amps, red near the trip point
        const A = AMP, ah = Math.round((A.h - 4) * Math.min(1, amps / 100));
        text('AMP', A.x - 2, A.y - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(A.x, A.y, A.w, A.h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(A.x + 2, A.y + 2, A.w - 4, A.h - 4);
        ctx.fillStyle = amps > 85 ? '#f05040' : amps > 65 ? '#f0b030' : '#58b058';
        ctx.fillRect(A.x + 2, A.y + A.h - 2 - ah, A.w - 4, ah);
        ctx.fillStyle = '#c03030'; ctx.fillRect(A.x, A.y + 4, A.w, 1);
        if (state === 'ready') readyBox(t, 'Hold Space: spin up');
        else if (state === 'done') doneBox([amps > 100 ? 'The motor tripped!' : done === BRANCHES ? 'All branches balanced!' : 'Out of time!',
          'Branches: ' + done, record ? 'New record!' : 'Best ' + getBest('fan')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- cooling coil: hold superheat in the green while the load wanders ----------
  // The further it drifts the harder it runs away, and every 10s the load gets
  // livelier, the coil gets slower to settle, and the frost/flood walls close in.
  // A full-open valve always out-pulls the runaway, at every level.
  function CoilGame() {
    const G = { x: 236, y: 34, w: 34, h: 170 }, COIL = { x: 30, y: 44, w: 150, h: 138 };
    const AUTH = 0.055, INST = 0.0009;
    const levelOf = (secs) => 1 + Math.floor(secs / 10);
    const noiseOf = (L) => 0.013 * (1 + (L - 1) * 0.6);
    const dampOf = (L) => Math.min(0.93, 0.88 + (L - 1) * 0.006);
    const rerollOf = (L) => Math.max(20, 50 - (L - 1) * 4);
    const marginOf = (L) => Math.min(30, Math.max(0, L - 2) * 5);
    let state = 'ready', t = 0, sh = 50, vel = 0, valve = 0, load = 0, secs = 0, record = false;
    let level = 1, best = 1, levelUp = 0;
    const self = {
      music: 'plant',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(sh <= 50 ? 'The coil frosted solid after ' + secs + 's. Airflow: zero.'
              : 'You flooded the compressor after ' + secs + 's. Somebody is getting a phone call.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the coil to the controls.'); return; }
        secs = Math.floor(t / 60);
        const L = levelOf(secs);
        if (L !== level) { level = L; best = L; levelUp = 48; sfx('ding'); }
        if (levelUp > 0) levelUp--;
        // the valve is a direct control: snaps to where you hold it, springs back on release
        if (held.left) valve = Math.max(-1, valve - 0.5);
        else if (held.right) valve = Math.min(1, valve + 0.5);
        else valve *= 0.8;
        if (t % rerollOf(level) === 0) load = (Math.random() * 2 - 1) * noiseOf(level);
        vel += load + (sh - 50) * INST - valve * AUTH;
        vel *= dampOf(level);
        sh += vel;
        const m = marginOf(level);
        if (sh <= 10 + m || sh >= 90 - m) { state = 'done'; t = 0; record = saveBest('coil', secs); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Hold the superheat!', 16, 10);
        const b = 'Best ' + getBest('coil') + 's';
        text(b, SW - 16 - b.length * 6, 10);
        text(secs + 's', 16, 24);
        text('Level ' + level, 76, 24);
        // how long until the walls close in again
        const into = (t / 60) % 10;
        ctx.fillStyle = col.dark; ctx.fillRect(140, 23, 92, 10);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(141, 24, 90, 8);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(141, 24, Math.round(90 * into / 10), 8);
        const m = marginOf(level), lo = 10 + m, hi = 90 - m;
        const gw = Math.max(5, (hi - lo) / 8), gLo = 50 - gw, gHi = 50 + gw;
        // the coil: frost creeps up it when low, condensate runs off it when high
        const C = COIL;
        ctx.fillStyle = col.dark; ctx.fillRect(C.x, C.y, C.w, C.h);
        ctx.fillStyle = '#e0c898'; ctx.fillRect(C.x + 3, C.y + 3, C.w - 6, C.h - 6);
        ctx.fillStyle = '#9a6434';
        for (let fx = C.x + 7; fx < C.x + C.w - 6; fx += 5) ctx.fillRect(fx, C.y + 7, 2, C.h - 14);
        ctx.fillStyle = '#c87830';
        for (let py = C.y + 18; py < C.y + C.h - 10; py += 34) ctx.fillRect(C.x + 3, py, C.w - 6, 4);
        if (sh < gLo) {
          const fr = Math.round((C.h - 6) * Math.min(1, (gLo - sh) / Math.max(1, gLo - lo)));
          ctx.fillStyle = '#dff0fa'; ctx.fillRect(C.x + 3, C.y + C.h - 3 - fr, C.w - 6, fr);
          ctx.fillStyle = '#a8e0f8';
          for (let i = 0; i < 12; i++) {
            const px = C.x + 8 + ((i * 37) % (C.w - 16)), py = C.y + C.h - 6 - ((i * 23) % Math.max(1, fr));
            ctx.fillRect(px, py, 2, 2);
          }
        } else if (sh > gHi) {
          ctx.fillStyle = '#6890e0';
          for (let i = 0; i < 10; i++) {
            const px = C.x + 10 + ((i * 29) % (C.w - 20));
            const py = C.y + 10 + ((i * 53 + (tick * 2)) % (C.h - 20));
            ctx.fillRect(px, py, 2, 4);
          }
        }
        // superheat gauge: the frost and flood walls move in as the levels climb
        const gy = (v) => G.y + G.h - 2 - Math.round((G.h - 4) * v / 100);
        text('SH', G.x + 6, G.y - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(G.x, G.y, G.w, G.h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(G.x + 2, G.y + 2, G.w - 4, G.h - 4);
        ctx.fillStyle = '#dff0fa'; ctx.fillRect(G.x + 2, gy(lo), G.w - 4, gy(0) - gy(lo));
        ctx.fillStyle = '#f8d8d8'; ctx.fillRect(G.x + 2, gy(100), G.w - 4, gy(hi) - gy(100));
        ctx.fillStyle = '#b8e8b8'; ctx.fillRect(G.x + 2, gy(gHi), G.w - 4, gy(gLo) - gy(gHi));
        ctx.fillStyle = col.dark;
        ctx.fillRect(G.x + 2, gy(lo), G.w - 4, 1); ctx.fillRect(G.x + 2, gy(hi), G.w - 4, 1);
        ctx.fillRect(G.x - 4, gy(sh) - 1, G.w + 8, 3);
        text('FROST', G.x - 36, gy(lo) - 3, 1, '#4080c0');
        text('FLOOD', G.x - 36, gy(hi) - 3, 1, '#c03030');
        // the expansion valve you are steering with
        text('VALVE', 86, 192);
        ctx.fillStyle = col.dark; ctx.fillRect(80, 204, 120, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(81, 205, 118, 6);
        ctx.fillStyle = '#3868c8'; ctx.fillRect(139 + Math.round(valve * 57), 205, 4, 6);
        text('SHUT', 50, 204, 1, '#585868'); text('OPEN', 204, 204, 1, '#585868');
        if (levelUp > 0 && (levelUp >> 2) & 1) {
          const msg = 'LEVEL ' + level + '!';
          text(msg, (SW - msg.length * 12) >> 1, 96, 2, '#c03030');
        }
        if (state === 'ready') readyBox(t, 'Left/Right: open cools it down');
        else if (state === 'done') doneBox([sh <= 50 ? 'Frozen solid!' : 'Flooded!',
          'Held it ' + secs + 's  (level ' + best + ')',
          record ? 'New record!' : 'Best ' + getBest('coil') + 's'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- damper drill: split the air between three rooms ----------
  // The dampers share one fan, so a room's share is its opening over the total.
  // That makes it a balancing puzzle rather than three separate dials.
  function DamperGame() {
    const ROOMS = ['A', 'B', 'C'], TIME = 3600, TOL = 4;
    let state = 'ready', t = 0, pos = [3, 3, 3], want = null, sel = 0;
    let shown = null, testing = 0, solved = 0, left = TIME, record = false;
    function share(p) {
      const sum = p[0] + p[1] + p[2];
      return p.map((v) => Math.round(100 * v / sum));
    }
    function newPuzzle() {
      const w = [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 5));
      // an even split would be no puzzle at all, so lean one branch open
      if (w[0] === w[1] && w[1] === w[2]) w[Math.floor(Math.random() * 3)] = (w[0] % 5) + 1;
      want = share(w);
      pos = [3, 3, 3]; shown = null; sel = 0;
    }
    newPuzzle();
    const self = {
      music: 'plant',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(solved ? 'You balanced ' + solved + (solved === 1 ? ' duct layout.' : ' duct layouts.') + ' Nice touch on the blades.'
              : 'You never did get the air where it was supposed to go.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the dampers where they sit.'); return; }
        if (testing > 0) {
          if (--testing === 0) {
            shown = share(pos);
            if (shown.every((v, i) => Math.abs(v - want[i]) <= TOL)) {
              solved++; sfx('ding'); newPuzzle();
            } else sfx('bump');
          }
          return;
        }
        if (pressed.has('left')) { sel = (sel + 2) % 3; sfx('select'); }
        if (pressed.has('right')) { sel = (sel + 1) % 3; sfx('select'); }
        if (pressed.has('up') && pos[sel] < 5) { pos[sel]++; shown = null; sfx('blip', true); }
        if (pressed.has('down') && pos[sel] > 1) { pos[sel]--; shown = null; sfx('blip'); }
        if (pressed.has('a')) { testing = 45; sfx('menu'); }
        if (--left <= 0) { state = 'done'; t = 0; record = saveBest('damper', solved); sfx('bump'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Balance the ducts!', 16, 10);
        const b = 'Best ' + getBest('damper');
        text(b, SW - 16 - b.length * 6, 10);
        text('Solved ' + solved, 16, 24);
        ctx.fillStyle = col.dark; ctx.fillRect(140, 24, 164, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(141, 25, 162, 6);
        ctx.fillStyle = left < TIME / 5 ? '#f05040' : '#58b058';
        ctx.fillRect(141, 25, Math.round(162 * left / TIME), 6);
        // the trunk duct feeding three branches
        ctx.fillStyle = col.dark; ctx.fillRect(16, 44, SW - 32, 22);
        ctx.fillStyle = '#b0b8c8'; ctx.fillRect(17, 45, SW - 34, 20);
        text('FAN', 22, 50, 1, col.dark);
        ROOMS.forEach((r, i) => {
          const x = 48 + i * 86;
          ctx.fillStyle = col.dark; ctx.fillRect(x, 66, 44, 16);
          ctx.fillStyle = '#b0b8c8'; ctx.fillRect(x + 1, 66, 42, 15);
          // damper blades: flatter as they open
          const open = pos[i];
          ctx.fillStyle = col.dark; ctx.fillRect(x + 6, 84, 32, 34);
          ctx.fillStyle = '#d8dce8'; ctx.fillRect(x + 7, 85, 30, 32);
          ctx.fillStyle = '#585868';
          for (let bl = 0; bl < 3; bl++) {
            const by = 90 + bl * 10, lean = (5 - open) * 2;
            for (let k = 0; k < 28; k++) {
              ctx.fillRect(x + 8 + k, by + Math.round(((k - 14) / 14) * lean), 1, 3);
            }
          }
          if (i === sel && state === 'play' && testing === 0) { ctx.fillStyle = '#3060d0'; ring(x + 4, 82, 36, 38); }
          text('OPEN ' + open, x + 1, 122);
          // target vs what this setting actually delivers
          text('Room ' + r, x + 2, 142);
          text('want ' + want[i] + '%', x + 2, 158);
          if (shown) {
            const d = shown[i] - want[i], ok = Math.abs(d) <= TOL;
            text('got  ' + shown[i] + '%', x + 2, 174, 1, ok ? '#2c6a34' : '#b83028');
            text(ok ? 'OK' : d > 0 ? 'TOO MUCH' : 'TOO LITTLE', x + 2, 190, 1, ok ? '#2c6a34' : '#b83028');
          }
        });
        if (testing > 0) ctext('Testing...', 206);
        else if (state === 'play') text('Arrows: set blades   Space: test', 16, 206);
        if (state === 'ready') readyBox(t, 'Arrows: blades  Space: test');
        else if (state === 'done') doneBox(['Time!', 'Layouts solved: ' + solved,
          record ? 'New record!' : 'Best ' + getBest('damper')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- filter change: match the sizes before the pressure drop alarms out ----------
  function FilterGame() {
    const SIZES = [16, 18, 20, 24, 25, 30], SLOTS = 4, RELIEF = 16, BASE = 0.11, STEP = 0.05;
    let state = 'ready', t = 0, need = [], stock = [], sel = 0, press = 20, fitted = 0, record = false;
    let sets = 0, cleared = 0;
    // Every bank you finish, the pressure climbs faster, so the next one has to be
    // done quicker. Set 1 is the original pace; after that the clock closes in.
    const rise = () => BASE + sets * STEP;
    const pace = () => SLOTS * RELIEF / rise() / 60;
    const pick = () => SIZES[Math.floor(Math.random() * SIZES.length)];
    function deal() {
      need = [];
      for (let i = 0; i < SLOTS; i++) need.push(pick());
      stock = need.slice(0, SLOTS);
      while (stock.length < 6) stock.push(pick());
      for (let i = stock.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stock[i], stock[j]] = [stock[j], stock[i]];
      }
      sel = 0;
    }
    deal();
    const self = {
      music: 'stack',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(fitted ? 'You got ' + fitted + ' filters in and cleared ' + sets
              + (sets === 1 ? ' bank' : ' banks') + ' before the alarm won.'
              : 'The alarm beat you to it. Not one filter changed.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the filters for the next guy.'); return; }
        if (pressed.has('left')) { sel = (sel + stock.length - 1) % stock.length; sfx('select'); }
        if (pressed.has('right')) { sel = (sel + 1) % stock.length; sfx('select'); }
        if (pressed.has('a')) {
          if (stock[sel] === need[0]) {
            need.shift(); stock.splice(sel, 1);
            if (sel >= stock.length) sel = Math.max(0, stock.length - 1);
            fitted++; press = Math.max(0, press - RELIEF); sfx('ding');
            if (!need.length) { sets++; cleared = 60; sfx('menu'); deal(); }
          } else { press += 13; sfx('buzz'); }
        }
        if (cleared > 0) cleared--;
        press += rise();
        if (press >= 100) { state = 'done'; t = 0; record = saveBest('filter', fitted); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Change the filters!', 16, 10);
        const b = 'Best ' + getBest('filter');
        text(b, SW - 16 - b.length * 6, 10);
        text('Fitted ' + fitted, 16, 24);
        text('Bank ' + (sets + 1), 118, 24);
        const pc = pace().toFixed(1) + 's';
        text(pc, SW - 16 - pc.length * 6, 24, 1, sets ? '#b83028' : col.dark);
        // pressure drop across the bank, climbing faster with every bank you finish
        text('dP', 16, 40);
        ctx.fillStyle = col.dark; ctx.fillRect(40, 39, 264, 10);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(41, 40, 262, 8);
        ctx.fillStyle = press > 75 ? '#f05040' : press > 45 ? '#f0b030' : '#58b058';
        ctx.fillRect(41, 40, Math.round(262 * press / 100), 8);
        if (press > 75 && (tick >> 3) & 1) text('ALARM', 250, 52, 1, '#c03030');
        // the filter bank: the leftmost empty slot is the one calling for a size
        text('BANK', 16, 54);
        const at = SLOTS - need.length;   // how far along the bank you have got
        for (let i = 0; i < SLOTS; i++) {
          const x = 20 + i * 72, filled = i < at;
          ctx.fillStyle = col.dark; ctx.fillRect(x, 64, 64, 56);
          ctx.fillStyle = filled ? '#e8e8e8' : '#8a7458'; ctx.fillRect(x + 3, 67, 58, 50);
          ctx.fillStyle = filled ? '#c8ccd8' : '#5c4c3a';
          for (let py = 70; py < 114; py += 6) ctx.fillRect(x + 5, py, 54, 3);
          if (!filled) text(String(need[i - at]), x + 20, 86, 1, '#f8f8f8');
          if (i === at && (tick >> 3) & 1) { ctx.fillStyle = '#c03030'; ring(x - 2, 62, 68, 60); }
        }
        // the cupboard of spares
        text('CUPBOARD', 16, 134);
        stock.forEach((s, i) => {
          const x = 20 + i * 48;
          ctx.fillStyle = col.dark; ctx.fillRect(x, 150, 40, 46);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 2, 152, 36, 42);
          ctx.fillStyle = '#c8ccd8';
          for (let py = 155; py < 191; py += 6) ctx.fillRect(x + 4, py, 32, 3);
          text(String(s), x + 8, 168, 1, col.dark);
          if (i === sel && state === 'play') { ctx.fillStyle = '#3060d0'; ring(x - 2, 148, 44, 50); }
        });
        if (cleared > 0 && (cleared >> 3) & 1) ctext('BANK DONE - FASTER NOW!', 206, '#c03030');
        if (state === 'ready') readyBox(t, 'Left/Right: pick  Space: fit');
        else if (state === 'done') doneBox(['Pressure alarm!', 'Fitted ' + fitted + '  in ' + sets + ' banks',
          record ? 'New record!' : 'Best ' + getBest('filter')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Snake on the other TV (the left-hand set, so it isn't Pong) ----------
  function SnakeGame() {
    const CW = 10, COLS = 25, ROWS = 15, FX = 34, FY = 46;
    let state = 'ready', t = 0, snake = [], dir = [1, 0], nextDir = [1, 0];
    let food = null, grow = 0, step = 0, speed = 9, score = 0, record = false;
    function placeFood() {
      let p;
      do { p = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)]; }
      while (snake.some((s) => s[0] === p[0] && s[1] === p[1]));
      food = p;
    }
    snake = [[6, 7], [5, 7], [4, 7]];
    placeFood();
    const self = {
      music: 'pong',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(score ? 'Snake: ' + score + ' lengths.' + (record ? ' A new record!' : '') + ' Back to work.'
              : 'You crashed immediately. Maybe stick to Pong.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You switch the TV back to the news.'); return; }
        // no doubling back on yourself
        if (pressed.has('left') && dir[0] !== 1) nextDir = [-1, 0];
        if (pressed.has('right') && dir[0] !== -1) nextDir = [1, 0];
        if (pressed.has('up') && dir[1] !== -1) nextDir = [0, -1];
        if (pressed.has('down') && dir[1] !== 1) nextDir = [0, 1];
        if (++step < speed) return;
        step = 0; dir = nextDir;
        const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
        if (head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS
          || snake.some((s) => s[0] === head[0] && s[1] === head[1])) {
          state = 'done'; t = 0; record = saveBest('snake', score); sfx('buzz'); return;
        }
        snake.unshift(head);
        if (head[0] === food[0] && head[1] === food[1]) {
          score++; grow += 2; speed = Math.max(4, 9 - Math.floor(score / 4));
          sfx('blip', true); placeFood();
        }
        if (grow > 0) grow--; else snake.pop();
      },
      draw() {
        box(0, 0, SW, SH);
        text('Snake', 16, 10);
        const s = 'Score ' + score, b = 'Best ' + getBest('snake');
        text(s, 150, 10); text(b, SW - 16 - b.length * 6, 10);
        // TV bezel around the playfield
        ctx.fillStyle = '#181820'; ctx.fillRect(FX - 10, FY - 10, COLS * CW + 20, ROWS * CW + 20);
        ctx.fillStyle = '#3a3a48'; ctx.fillRect(FX - 7, FY - 7, COLS * CW + 14, ROWS * CW + 14);
        ctx.fillStyle = '#0d2818'; ctx.fillRect(FX, FY, COLS * CW, ROWS * CW);
        ctx.fillStyle = food && (tick >> 3) & 1 ? '#f8e070' : '#f0b030';
        if (food) ctx.fillRect(FX + food[0] * CW + 2, FY + food[1] * CW + 2, CW - 4, CW - 4);
        snake.forEach((sg, i) => {
          ctx.fillStyle = i === 0 ? '#a8e070' : '#58a848';
          ctx.fillRect(FX + sg[0] * CW + 1, FY + sg[1] * CW + 1, CW - 2, CW - 2);
        });
        ctx.fillStyle = '#181820'; ctx.fillRect(FX + 60, FY + ROWS * CW + 13, COLS * CW - 120, 6);
        if (state === 'ready') readyBox(t, 'Arrows: steer');
        else if (state === 'done') doneBox(['Crashed!', 'Score: ' + score,
          record ? 'New record!' : 'Best ' + getBest('snake')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- the pile of parts on the 2nd floor: sort them as they come past ----------
  function PartsGame() {
    const KINDS = [
      { name: 'CABLE', key: 'left', c: '#3868c8' },
      { name: 'BOARD', key: 'up', c: '#2c6a34' },
      { name: 'SCREW', key: 'right', c: '#8890a0' },
    ];
    const BELT_Y = 150, GATE = 96, LIVES = 3;
    let state = 'ready', t = 0, items = [], spawn = 0, sorted = 0, lives = LIVES, flash = null, record = false;
    const self = {
      music: 'stack',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(sorted ? 'You sorted ' + sorted + ' parts off the floor. It almost looks tidy.'
              : 'The parts are exactly where you found them.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You step over the parts, like everyone else.'); return; }
        if (flash) flash.t++;
        if (flash && flash.t > 16) flash = null;
        const rate = Math.max(32, 80 - sorted * 2);
        if (++spawn >= rate) { spawn = 0; items.push({ x: SW + 10, k: Math.floor(Math.random() * 3) }); }
        const speed = 1 + sorted * 0.02;
        for (const it of items) it.x -= speed;
        // the part sitting over the gate is the one your key press applies to
        const at = items.find((it) => it.x <= GATE + 14 && it.x >= GATE - 14);
        for (let i = 0; i < 3; i++) {
          if (!pressed.has(KINDS[i].key)) continue;
          if (!at) { sfx('bump'); continue; }
          at.gone = true;
          if (at.k === i) { sorted++; sfx('blip', true); flash = { t: 0, ok: true, i }; }
          else { lives--; sfx('buzz'); flash = { t: 0, ok: false, i }; }
        }
        items = items.filter((it) => {
          if (it.gone) return false;
          if (it.x < -12) { lives--; sfx('bump'); return false; }
          return true;
        });
        if (lives <= 0) { state = 'done'; t = 0; record = saveBest('parts', sorted); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Sort the parts!', 16, 10);
        const b = 'Best ' + getBest('parts');
        text(b, SW - 16 - b.length * 6, 10);
        text('Sorted ' + sorted, 16, 24);
        for (let i = 0; i < LIVES; i++) {
          ctx.fillStyle = i < lives ? '#c03030' : '#c8ccd8';
          ctx.fillRect(200 + i * 14, 24, 10, 10);
        }
        // three bins, each on its own arrow key
        KINDS.forEach((k, i) => {
          const x = 24 + i * 100;
          const lit = flash && flash.i === i ? (flash.ok ? '#58b058' : '#f05040') : '#d8dce8';
          ctx.fillStyle = col.dark; ctx.fillRect(x, 52, 86, 54);
          ctx.fillStyle = lit; ctx.fillRect(x + 2, 54, 82, 50);
          ctx.fillStyle = k.c; ctx.fillRect(x + 2, 54, 82, 8);
          text(k.name, x + 16, 72, 1, col.dark);
          const hint = { left: 'LEFT', up: 'UP', right: 'RIGHT' }[k.key];
          text(hint, x + 43 - hint.length * 3, 88, 1, col.dark);
        });
        // the belt, and the gate where you have to decide
        ctx.fillStyle = col.dark; ctx.fillRect(8, BELT_Y, SW - 16, 22);
        ctx.fillStyle = '#585868'; ctx.fillRect(9, BELT_Y + 1, SW - 18, 20);
        ctx.fillStyle = '#8890a0';
        for (let x = 10 - (tick * 2) % 12; x < SW - 10; x += 12) ctx.fillRect(x, BELT_Y + 1, 2, 20);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(GATE - 15, BELT_Y - 4, 2, 30); ctx.fillRect(GATE + 15, BELT_Y - 4, 2, 30);
        for (const it of items) {
          const k = KINDS[it.k];
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(it.x) - 9, BELT_Y - 10, 18, 16);
          ctx.fillStyle = k.c; ctx.fillRect(Math.round(it.x) - 8, BELT_Y - 9, 16, 14);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(Math.round(it.x) - 5, BELT_Y - 6, 10, 3);
        }
        if (state === 'ready') readyBox(t, 'Arrows: bin the part at the gate');
        else if (state === 'done') doneBox(['The floor wins!', 'Parts sorted: ' + sorted,
          record ? 'New record!' : 'Best ' + getBest('parts')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- server room: patch each port to its matching colour ----------
  function CableGame() {
    const N = 6, LX = 60, RX = 240, Y0 = 62, DY = 24, TIME = 2400;
    const WIRE = ['#c03030', '#3868c8', '#2c6a34', '#f0b030', '#9868c8', '#40a0a0'];
    let state = 'ready', t = 0, right = [], done = [], sel = 0, pickLeft = null, left = TIME, made = 0, record = false;
    function deal() {
      right = WIRE.map((_, i) => i);
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [right[i], right[j]] = [right[j], right[i]];
      }
      done = []; pickLeft = null; sel = 0;
    }
    deal();
    const self = {
      music: 'simon',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(made ? 'You patched ' + made + (made === 1 ? ' panel.' : ' panels.') + ' The rack blinks happily.'
              : 'You left the patch panel in a worse state than you found it.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You back out of the rack room.'); return; }
        if (pressed.has('up')) { sel = (sel + N - 1) % N; sfx('select'); }
        if (pressed.has('down')) { sel = (sel + 1) % N; sfx('select'); }
        if (pressed.has('a')) {
          if (pickLeft === null) {
            if (!done.some((d) => d.l === sel)) { pickLeft = sel; sfx('blip', true); }
          } else {
            if (!done.some((d) => d.r === sel)) {
              if (right[sel] === pickLeft) {
                done.push({ l: pickLeft, r: sel }); sfx('blip', true);
                if (done.length === N) {
                  made++; left = Math.min(TIME, left + 300); sfx('ding'); deal();
                }
              } else { left = Math.max(0, left - 180); sfx('buzz'); }
              pickLeft = null;
            }
          }
        }
        if (--left <= 0) { state = 'done'; t = 0; record = saveBest('cable', made); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Patch the panel!', 16, 10);
        const b = 'Best ' + getBest('cable');
        text(b, SW - 16 - b.length * 6, 10);
        text('Panels ' + made, 16, 24);
        ctx.fillStyle = col.dark; ctx.fillRect(140, 24, 164, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(141, 25, 162, 6);
        ctx.fillStyle = left < TIME / 5 ? '#f05040' : '#58b058';
        ctx.fillRect(141, 25, Math.round(162 * left / TIME), 6);
        // the two rails of ports
        for (const [x, lbl] of [[LX, 'IN'], [RX, 'OUT']]) {
          ctx.fillStyle = col.dark; ctx.fillRect(x - 22, Y0 - 14, 44, N * DY + 12);
          ctx.fillStyle = '#484858'; ctx.fillRect(x - 20, Y0 - 12, 40, N * DY + 8);
          text(lbl, x - 9, Y0 - 28);
        }
        // cables already run
        for (const d of done) {
          ctx.strokeStyle = WIRE[d.l]; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(LX + 20, Y0 + d.l * DY + 7);
          ctx.bezierCurveTo(LX + 90, Y0 + d.l * DY + 7, RX - 90, Y0 + d.r * DY + 7, RX - 20, Y0 + d.r * DY + 7);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          const y = Y0 + i * DY, lUsed = done.some((d) => d.l === i), rUsed = done.some((d) => d.r === i);
          ctx.fillStyle = col.dark; ctx.fillRect(LX - 12, y, 24, 14);
          ctx.fillStyle = lUsed ? '#585868' : WIRE[i]; ctx.fillRect(LX - 10, y + 2, 20, 10);
          ctx.fillStyle = col.dark; ctx.fillRect(RX - 12, y, 24, 14);
          ctx.fillStyle = rUsed ? '#585868' : WIRE[right[i]]; ctx.fillRect(RX - 10, y + 2, 20, 10);
          if (pickLeft === i) { ctx.fillStyle = '#f8f8f8'; ring(LX - 16, y - 4, 32, 22); }
        }
        // the cursor sits on whichever rail you are choosing from
        const cx = pickLeft === null ? LX : RX;
        ctx.fillStyle = '#3060d0'; ring(cx - 16, Y0 + sel * DY - 4, 32, 22);
        text(pickLeft === null ? 'Pick an IN port' : 'Match it on OUT', 90, 212);
        if (state === 'ready') readyBox(t, 'Up/Down + Space: patch');
        else if (state === 'done') doneBox(['Time!', 'Panels patched: ' + made,
          record ? 'New record!' : 'Best ' + getBest('cable')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- First Aid Station: compressions at the right tempo ----------
  // 110 bpm is about 33 frames at 60fps. You are scored on how close each press lands.
  function CprGame() {
    const BEAT = 33, REPS = 30, GOOD = 7, PERFECT = 3;
    const CX = 150, CY = 118;
    let state = 'ready', t = 0, beat = 0, n = 0, perfect = 0, good = 0, last = null, push = 0, record = false;
    const self = {
      music: 'cpr',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; beat = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(perfect >= 20 ? 'Textbook compressions. The dummy would like to thank you.'
              : perfect + good >= 15 ? 'Not bad. Keep practising on the dummy, not on people.'
                : 'Your timing needs work. Good thing it was a dummy.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the first aid dummy in peace.'); return; }
        if (push > 0) push--;
        beat++;
        if (beat >= BEAT) { beat = 0; sfx('blip'); }
        if (pressed.has('a')) {
          // distance to the nearest beat, before or after
          const off = Math.min(beat, BEAT - beat);
          push = 8; n++;
          if (off <= PERFECT) { perfect++; last = { s: 'PERFECT', c: '#2c6a34', t: 0 }; sfx('note', 3); }
          else if (off <= GOOD) { good++; last = { s: 'GOOD', c: '#f0b030', t: 0 }; sfx('note', 1); }
          else { last = { s: 'OFF BEAT', c: '#b83028', t: 0 }; sfx('bump'); }
          if (n >= REPS) { state = 'done'; t = 0; record = saveBest('cpr', perfect); sfx('ding'); }
        }
        if (last) last.t++;
      },
      draw() {
        box(0, 0, SW, SH);
        text('Compressions!', 16, 10);
        const b = 'Best ' + getBest('cpr');
        text(b, SW - 16 - b.length * 6, 10);
        text('Rep ' + Math.min(n + 1, REPS) + '/' + REPS, 16, 24);
        text('Perfect ' + perfect, 150, 24);
        // the dummy on the stretcher, chest dipping under each compression
        const dip = push > 4 ? 4 : push > 0 ? 2 : 0;
        ctx.fillStyle = col.dark; ctx.fillRect(40, CY + 34, 240, 10);
        ctx.fillStyle = '#585868'; ctx.fillRect(42, CY + 36, 236, 6);
        ctx.fillStyle = col.dark; ctx.fillRect(56, CY - 4, 208, 40);
        ctx.fillStyle = '#f0c098'; ctx.fillRect(58, CY - 2, 204, 36);
        ctx.fillStyle = col.dark; ctx.fillRect(40, CY - 14, 30, 30);
        ctx.fillStyle = '#f0c098'; ctx.fillRect(42, CY - 12, 26, 26);
        ctx.fillStyle = col.dark; ctx.fillRect(48, CY - 4, 3, 3); ctx.fillRect(58, CY - 4, 3, 3);
        ctx.fillRect(50, CY + 6, 12, 2);
        ctx.fillStyle = '#3868c8'; ctx.fillRect(100, CY - 2 + dip, 92, 34 - dip);
        // your hands
        ctx.fillStyle = col.dark; ctx.fillRect(CX - 16, CY - 16 + dip, 32, 22);
        ctx.fillStyle = '#f8d0a8'; ctx.fillRect(CX - 14, CY - 14 + dip, 28, 18);
        // the metronome: a bar that sweeps and a ring that pulses on the beat
        const p = ((beat + BEAT / 2) % BEAT) / BEAT;   // beat 0 sits dead centre
        ctx.fillStyle = col.dark; ctx.fillRect(40, 56, 240, 14);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(41, 57, 238, 12);
        const gw = Math.round(238 * GOOD / BEAT), pw = Math.round(238 * PERFECT / BEAT);
        ctx.fillStyle = '#b8e8b8'; ctx.fillRect(160 - gw, 57, gw * 2, 12);
        ctx.fillStyle = '#58b058'; ctx.fillRect(160 - pw, 57, pw * 2, 12);
        ctx.fillStyle = col.dark; ctx.fillRect(40 + Math.round(238 * p), 54, 3, 18);
        if (beat < 5) { ctx.fillStyle = '#f0b030'; ring(150, 50, 20, 26); }
        text('PUSH ON THE BEAT', 70, 38);
        if (last && last.t < 40) text(last.s, (SW - last.s.length * 6) >> 1, 200, 1, last.c);
        if (state === 'ready') readyBox(t, 'Space: compress, on the beat');
        else if (state === 'done') doneBox(['Thirty compressions!', 'Perfect ' + perfect + '  Good ' + good,
          record ? 'New record!' : 'Best ' + getBest('cpr')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- the engraver: keep the cutting head on the line ----------
  function EngraveGame() {
    const X0 = 30, X1 = 290, MID = 124, AMP = 44, TOL = 7, SPEED = 1.1;
    const PLATES = ['HAAKON', 'RICHMOND', 'WELL DONE', 'EMPLOYEE', 'NO 1 FAN'];
    let state = 'ready', t = 0, x = X0, head = MID, wob = 0, hits = 0, n = 0, cut = [], record = false;
    const seed = Math.random() * 100, plate = PLATES[Math.floor(Math.random() * PLATES.length)];
    // the groove the nameplate needs: a few sine waves layered so it isn't predictable
    const lineAt = (xx) => {
      const u = (xx - X0) / (X1 - X0);
      return MID + Math.sin(u * 6.1 + seed) * AMP * 0.6 + Math.sin(u * 13.7 + seed * 2) * AMP * 0.4;
    };
    const self = {
      music: 'golf',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            const pct = n ? Math.round(100 * hits / n) : 0;
            say(pct >= 90 ? 'A clean cut. That plate is going on someone\'s door.'
              : pct >= 60 ? 'A bit wobbly, but readable. ' + pct + '% on the line.'
                : 'The engraver made modern art. ' + pct + '% on the line.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You switch the engraver off.'); return; }
        if (held.up) head -= 1.7;
        if (held.down) head += 1.7;
        head = Math.max(MID - AMP - 20, Math.min(MID + AMP + 20, head));
        // the head shakes a little, so you have to keep correcting
        wob += 0.17;
        const real = head + Math.sin(wob) * 1.6;
        const on = Math.abs(real - lineAt(x)) <= TOL;
        n++; if (on) hits++;
        cut.push({ x, y: real, on });
        if (n % 14 === 0) sfx(on ? 'blip' : 'bump', true);
        x += SPEED;
        if (x >= X1) { state = 'done'; t = 0; record = saveBest('engrave', Math.round(100 * hits / n)); sfx('ding'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Engrave: ' + plate, 16, 10);
        const b = 'Best ' + getBest('engrave') + '%';
        text(b, SW - 16 - b.length * 6, 10);
        text('On the line ' + (n ? Math.round(100 * hits / n) : 0) + '%', 16, 24);
        // the blank plate
        ctx.fillStyle = col.dark; ctx.fillRect(X0 - 12, MID - AMP - 30, X1 - X0 + 24, (AMP + 30) * 2);
        ctx.fillStyle = '#d8b878'; ctx.fillRect(X0 - 9, MID - AMP - 27, X1 - X0 + 18, (AMP + 27) * 2);
        // the groove you are meant to follow
        ctx.fillStyle = '#9a7a40';
        for (let xx = X0; xx < X1; xx += 2) ctx.fillRect(xx, Math.round(lineAt(xx)) - 1, 2, 3);
        // what you actually cut
        for (const c of cut) {
          ctx.fillStyle = c.on ? '#f8f8f8' : '#b83028';
          ctx.fillRect(Math.round(c.x), Math.round(c.y) - 1, 2, 3);
        }
        // the cutting head
        if (state === 'play') {
          const real = head + Math.sin(wob) * 1.6;
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(x) - 4, Math.round(real) - 18, 9, 16);
          ctx.fillStyle = '#8890a0'; ctx.fillRect(Math.round(x) - 3, Math.round(real) - 17, 7, 14);
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(x) - 1, Math.round(real) - 3, 3, 5);
        }
        if (state === 'ready') readyBox(t, 'Up/Down: steer the head');
        else if (state === 'done') doneBox(['Plate finished!', 'On the line: ' + Math.round(100 * hits / n) + '%',
          record ? 'New record!' : 'Best ' + getBest('engrave') + '%'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- lat pulldown: pull on the beat, let it back up on the off-beat ----------
  // The marker sweeps back and forth across the meter, 20 times. Each sweep you get
  // one press: the right direction while it's in the sweet spot moves the bar and
  // switches you to the other direction; anything else is a miss and nothing moves.
  function PulldownGame() {
    const SWEEP = 42, SWEEPS = 20, SPOT = 0.11; // frames per sweep; sweet spot is the middle +-SPOT
    let state = 'ready', t = 0, beat = 0, sweep = 0, want = 'down', bar = 0, clean = 0, tried = false, last = null, record = false;
    const markerAt = () => (sweep & 1 ? 1 - beat / SWEEP : beat / SWEEP);
    function finish() { state = 'done'; t = 0; record = saveBest('pulldown', clean); sfx('ding'); }
    const self = {
      music: 'squat',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; beat = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(clean >= 16 ? 'Smooth reps all the way through. Lats are burning!'
              : clean >= 8 ? clean + ' clean reps out of ' + SWEEPS + '. Not bad.'
                : 'You fought the machine and the machine won.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You rack the bar and stretch instead.'); return; }
        bar += ((want === 'down' ? 0 : 1) - bar) * 0.25;
        if (last) last.t++;
        const other = want === 'down' ? 'up' : 'down';
        if (!tried && (pressed.has(want) || pressed.has(other))) {
          tried = true;
          if (pressed.has(want) && Math.abs(markerAt() - 0.5) <= SPOT) {
            clean++; last = { s: 'CLEAN', c: '#2c6a34', t: 0 }; sfx('lift', 0.8);
            want = other;
          } else { last = { s: 'MISSED', c: '#b83028', t: 0 }; sfx('bump'); }
        }
        if (++beat >= SWEEP) {
          if (!tried) { last = { s: 'MISSED', c: '#b83028', t: 0 }; sfx('bump'); }
          beat = 0; tried = false;
          if (++sweep >= SWEEPS) finish();
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Lat pulldown!', 16, 10);
        const b = 'Best ' + getBest('pulldown');
        text(b, SW - 16 - b.length * 6, 10);
        text('Sweep ' + Math.min(sweep + 1, SWEEPS) + '/' + SWEEPS, 16, 24);
        text('Clean ' + clean + '/' + SWEEPS, 160, 24);
        // frame and cable
        ctx.fillStyle = col.dark; ctx.fillRect(60, 44, 200, 8); ctx.fillRect(66, 52, 8, 150); ctx.fillRect(246, 52, 8, 150);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(68, 54, 4, 146); ctx.fillRect(248, 54, 4, 146);
        const by = 70 + Math.round(bar * 56);
        ctx.fillStyle = col.dark; ctx.fillRect(158, 52, 4, by - 52);
        ctx.fillRect(96, by, 128, 7);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(98, by + 1, 124, 5);
        // you, pulling
        ctx.drawImage(sprites.down[0], 132, by + 14, 56, 56);
        // the weight stack rises as the bar comes down
        const st = Math.round(bar * 40);
        ctx.fillStyle = col.dark; ctx.fillRect(272, 60, 34, 142);
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i < 4 ? '#585868' : '#c03838';
          ctx.fillRect(274, 170 - i * 16 - st, 30, 14);
        }
        // the meter: press as the marker crosses the green sweet spot
        const p = markerAt();
        ctx.fillStyle = col.dark; ctx.fillRect(40, 208, 240, 12);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(41, 209, 238, 10);
        ctx.fillStyle = '#b8e8b8';
        ctx.fillRect(40 + Math.round(238 * (0.5 - SPOT)), 209, Math.round(238 * SPOT * 2), 10);
        ctx.fillStyle = tried ? '#8890a0' : col.dark; ctx.fillRect(40 + Math.round(238 * p), 206, 3, 16);
        text(want === 'down' ? 'PULL (Down)' : 'RELEASE (Up)', 100, 192);
        if (last && last.t < 30) text(last.s, (SW - last.s.length * 6) >> 1, 38, 1, last.c);
        if (state === 'ready') readyBox(t, 'Down, Up, in the green');
        else if (state === 'done') doneBox(['Set finished!', 'Clean reps: ' + clean + '/' + SWEEPS,
          record ? 'New record!' : 'Best ' + getBest('pulldown')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- exercise ball: stay on it, and it keeps getting worse ----------
  // Level 1 is the baseline. Every 12s the disturbance grows, the ball gets more
  // slippery, the mat you are allowed on shrinks, and from level 3 gusts shove you.
  // What never changes is that a full lean (INPUT) out-pulls the tip at the rim
  // (edge * INST), so no position is ever unrecoverable at any level.
  function BallGame() {
    const CX = 160, CY = 124, R = 56, INPUT = 0.12, INST = 0.0018;
    const levelOf = (secs) => 1 + Math.floor(secs / 12);
    const noiseOf = (L) => 0.010 * (1 + (L - 1) * 0.35);
    const dampOf = (L) => Math.min(0.955, 0.93 + (L - 1) * 0.005);
    const edgeOf = (L) => Math.max(32, 50 - Math.max(0, L - 3) * 2.5);
    const gustGap = (L) => (L < 3 ? 0 : Math.max(70, 200 - L * 12));
    const gustHit = (L) => 0.45 + L * 0.07;
    let state = 'ready', t = 0, px = 0, py = 0, vx = 0, vy = 0, secs = 0, record = false;
    let level = 1, levelUp = 0, gust = 0, puff = null, best = 1;
    const self = {
      music: 'run',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(secs >= 60 ? 'You stayed up ' + secs + ' seconds and reached level ' + best + '. Core of steel.'
              : secs >= 25 ? 'Level ' + best + ' after ' + secs + ' seconds. The ball is winning, but slowly.'
                : 'Off after ' + secs + ' seconds. The ball wins.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You get off the ball before it gets you.'); return; }
        secs = Math.floor(t / 60);
        const L = levelOf(secs);
        if (L !== level) { level = L; best = L; levelUp = 48; sfx('ding'); }
        if (levelUp > 0) levelUp--;
        if (puff) { puff.t++; if (puff.t > 22) puff = null; }
        if (held.left) vx -= INPUT; if (held.right) vx += INPUT;
        if (held.up) vy -= INPUT; if (held.down) vy += INPUT;
        // a gust is a one-off shove you have to catch, not a force you fight
        const gap = gustGap(level);
        if (gap && ++gust >= gap) {
          gust = 0;
          const a = Math.random() * Math.PI * 2, g = gustHit(level);
          vx += Math.cos(a) * g; vy += Math.sin(a) * g;
          puff = { a, t: 0 };
          sfx('swish');
        }
        const noise = noiseOf(level), damp = dampOf(level);
        vx += px * INST + (Math.random() - 0.5) * noise;
        vy += py * INST + (Math.random() - 0.5) * noise;
        vx *= damp; vy *= damp;
        px += vx; py += vy;
        if (Math.hypot(px, py) > edgeOf(level)) { state = 'done'; t = 0; record = saveBest('ball', secs); sfx('bump'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Balance on the ball!', 16, 10);
        const b = 'Best ' + getBest('ball') + 's';
        text(b, SW - 16 - b.length * 6, 10);
        text(secs + 's', 16, 24);
        text('Level ' + level, 86, 24);
        // how long until it steps up again
        const into = (t / 60) % 12;
        ctx.fillStyle = col.dark; ctx.fillRect(170, 23, 134, 10);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(171, 24, 132, 8);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(171, 24, Math.round(132 * into / 12), 8);
        const edge = edgeOf(level);
        // the ball, with the band you are allowed on shrinking as the levels climb
        for (let rr = R - 2; rr > 0; rr -= 2) {
          ctx.fillStyle = rr > edge ? '#9aa0b0' : rr > edge - 10 ? '#f8d8d8'
            : rr > edge * 0.45 ? '#dfe8f8' : '#b8e8b8';
          for (let a = 0; a < 80; a++) {
            const an = a / 80 * Math.PI * 2;
            ctx.fillRect(CX + Math.round(Math.cos(an) * rr) - 1, CY + Math.round(Math.sin(an) * rr) - 1, 3, 3);
          }
        }
        // the edge you must not cross, drawn solid so the shrink is unmistakable
        ctx.fillStyle = col.dark;
        for (const rad of [R, edge]) {
          for (let a = 0; a < 80; a++) {
            const an = a / 80 * Math.PI * 2;
            ctx.fillRect(CX + Math.round(Math.cos(an) * rad) - 1, CY + Math.round(Math.sin(an) * rad) - 1, 3, 3);
          }
        }
        // a gust, shown blowing in from the side it came from
        if (puff) {
          const dx = Math.cos(puff.a), dy = Math.sin(puff.a);
          ctx.fillStyle = (puff.t >> 1) & 1 ? '#3868c8' : '#a8d8f0';
          for (let i = 0; i < 4; i++) {
            const d = R + 20 - puff.t * 1.6 - i * 7;
            ctx.fillRect(Math.round(CX - dx * d) - 4, Math.round(CY - dy * d) - 1, 9, 3);
          }
        }
        // where your weight is
        ctx.fillStyle = col.dark;
        ctx.fillRect(CX + Math.round(px) - 5, CY + Math.round(py) - 5, 11, 11);
        ctx.fillStyle = '#f0b030';
        ctx.fillRect(CX + Math.round(px) - 3, CY + Math.round(py) - 3, 7, 7);
        ctx.fillStyle = col.dark;
        ctx.fillRect(CX - 1, CY - 7, 3, 3); ctx.fillRect(CX - 1, CY + 5, 3, 3);
        ctx.fillRect(CX - 7, CY - 1, 3, 3); ctx.fillRect(CX + 5, CY - 1, 3, 3);
        if (levelUp > 0 && (levelUp >> 2) & 1) {
          const m = 'LEVEL ' + level + '!';
          text(m, (SW - m.length * 12) >> 1, 50, 2, '#c03030');
        }
        if (state === 'ready') readyBox(t, 'Arrows: shift your weight');
        else if (state === 'done') doneBox(['Off you go!', 'Stayed up ' + secs + 's  (level ' + best + ')',
          record ? 'New record!' : 'Best ' + getBest('ball') + 's'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- reception: send each visitor to the right office ----------
  function FrontDeskGame() {
    const TIME = 420, VISITORS = 10;
    const floorName = (fi) => (fi === 0 ? 'Ground' : fi + 1 + 'F');
    // Everyone sitting in a numbered office or cubicle. The option shows the room
    // NUMBER only, never the name on the door, or it would answer itself.
    const DIRECTORY = npcs.filter((n) => !n.ghost).map((n) => {
      const r = roomAt(n.floor, n.x, n.y), m = r && /^(\d+) /.exec(r.name);
      return m ? { name: n.name, where: 'Office ' + m[1] + ', ' + floorName(n.floor) } : null;
    }).filter(Boolean);
    if (!DIRECTORY.length) DIRECTORY.push({ name: 'Kiki', where: 'Office 101, Ground' });
    let state = 'ready', t = 0, who = null, opts = [], sel = 0, left = TIME;
    let n = 0, right = 0, last = null, record = false;
    const FACES = npcs.filter((n) => !n.ghost);
    let face = null;
    function nextVisitor() {
      who = DIRECTORY[Math.floor(Math.random() * DIRECTORY.length)];
      face = FACES.length ? FACES[Math.floor(Math.random() * FACES.length)].sprites : sprites;
      const pool = DIRECTORY.filter((d) => d.where !== who.where);
      opts = [who.where];
      while (opts.length < 3 && pool.length) {
        const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        if (!opts.includes(p.where)) opts.push(p.where);
      }
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      sel = 0; left = TIME;
    }
    nextVisitor();
    const self = {
      music: 'candy',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(right === VISITORS ? 'Every visitor sent the right way. Kiki would be proud.'
              : 'You got ' + right + ' of ' + VISITORS + ' visitors to the right office.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You step away from the front desk.'); return; }
        if (last) { last.t++; if (last.t > 40) { last = null; if (n >= VISITORS) { state = 'done'; t = 0; record = saveBest('desk', right); return; } nextVisitor(); } return; }
        if (pressed.has('up')) { sel = (sel + opts.length - 1) % opts.length; sfx('select'); }
        if (pressed.has('down')) { sel = (sel + 1) % opts.length; sfx('select'); }
        if (pressed.has('a')) {
          n++;
          const ok = opts[sel] === who.where;
          if (ok) { right++; sfx('ding'); } else sfx('buzz');
          last = { ok, t: 0 };
          return;
        }
        if (--left <= 0) { n++; last = { ok: false, t: 0, late: true }; sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Visitor ' + Math.min(n + 1, VISITORS) + '/' + VISITORS, 16, 10);
        const b = 'Best ' + getBest('desk');
        text(b, SW - 16 - b.length * 6, 10);
        text('Right ' + right, 150, 10);
        // patience
        ctx.fillStyle = col.dark; ctx.fillRect(16, 26, SW - 32, 8);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(17, 27, SW - 34, 6);
        ctx.fillStyle = left < TIME / 3 ? '#f05040' : '#58b058';
        ctx.fillRect(17, 27, Math.round((SW - 34) * left / TIME), 6);
        // the desk and the visitor standing at it
        ctx.fillStyle = col.dark; ctx.fillRect(8, 150, SW - 16, 10);
        ctx.fillStyle = '#c89058'; ctx.fillRect(10, 152, SW - 20, 6);
        ctx.drawImage(face.down[0], 40, 96, 52, 52);
        text('"I\'m here to see', 110, 48);
        text(who.name + '."', 110, 64);
        opts.forEach((o, i) => {
          const y = 88 + i * 18;
          text(o, 126, y, 1, last && o === who.where ? '#2c6a34' : col.dark);
          if (i === sel && !last) text('>', 114, y);
        });
        if (last) {
          const m = last.late ? 'Too slow!' : last.ok ? 'Right this way!' : 'Wrong office!';
          text(m, (SW - m.length * 6) >> 1, 168, 1, last.ok ? '#2c6a34' : '#b83028');
        }
        if (state === 'ready') readyBox(t, 'Up/Down then Space');
        else if (state === 'done') doneBox(['Shift over!', 'Correct: ' + right + '/' + VISITORS,
          record ? 'New record!' : 'Best ' + getBest('desk')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- printer jam: ease each sheet out without tearing it ----------
  // Every sheet is different: snags on hidden rollers (marked on the OUT bar) make it
  // strain, it comes out crooked (Left/Right straightens it, and a crooked sheet
  // strains faster), and the paper itself can be thin, stiff or sticky. Whatever was
  // printed on it is revealed line by line as it comes out.
  const JAM_PAPERS = [
    { name: 'Plain paper', bg: '#f8f8f8', pull: 0.55, strain: 1.5, relax: 2.3, drift: 0.22 },
    { name: 'Thin paper', bg: '#ecece4', pull: 0.7, strain: 1.7, relax: 2.6, drift: 0.3 },
    { name: 'Cardstock', bg: '#f0e0b0', pull: 0.45, strain: 1.1, relax: 1.7, drift: 0.12 },
    { name: 'Label sheet', bg: '#f8f8f8', pull: 0.5, strain: 1.4, relax: 1.5, drift: 0.22, labels: true },
  ];
  // what somebody sent to the printer: a title, then up to 8 lines of 24 characters
  const JAM_DOCS = [
    ['SPRING ROLL LEDGER', 'Cody owes Zin: 12', 'Cody owes Dmitriy: 30', 'Cody owes Zin: 45', 'Cody owes Zin: 80', 'Cody owes everyone', '', 'NOTE: do not lend Cody', 'any more spring rolls.'],
    ['MEMO: THE FRIDGE', 'To whoever ate the', 'lunch with my name on', 'it, in big letters:', '', 'I know it was you.', 'I have seen the', 'security footage.', '- Management'],
    ['FROM: STEPHEN', 'RE: EMAIL FORMATTING', '', 'PLEASE NOTE THAT ALL', 'EMAILS MUST NOW BE', 'WRITTEN IN CAPS.', 'IT IS EASIER TO READ.', '', 'THANK YOU, STEPHEN'],
    ['HYROX TRAINING PLAN', 'Mon: wall balls', 'Tue: sled push', 'Wed: burpees', 'Thu: more burpees', 'Fri: burpees again', 'Sat: race day!', 'Sun: cannot walk', '- Patrick'],
    ['POKEMON CARD WISHLIST', 'Charizard (shiny)', 'Pikachu (promo)', 'Mewtwo (first ed.)', 'Sleep (any edition)', '', 'Line starts at 4am.', 'Bring a chair.', '- Raegan'],
    ['TROPHY INVENTORY', 'Golf: 1st place', 'Golf: 2nd place', 'Bowling: 1st place', 'Darts: 3rd place', 'Participation: 14', 'Shelf space left: 0', '', 'Need a bigger office.'],
    ['MANULIFE FORM 1 OF 40', 'Name:', 'Dependants:', 'Dependants of', 'dependants:', '', 'Please return this', 'form by YESTERDAY.', '- Jhonna'],
    ['RESIGNATION LETTER', 'Dear boss,', '', 'I quit.', '', 'Just kidding. The', 'printer ate my real', 'letter. See you on', 'Monday.'],
    ['PRINTER MANUAL PAGE 1', 'To clear a paper jam:', '', '1. Open tray 2.', '2. Pull gently.', '3. Pull less gently.', '4. Cry a little.', '5. Use the other', '   printer.'],
    ['WHO TOOK MY STAPLER', 'It was red.', 'It was MINE.', '', 'I will haunt the rack', 'room until it is', 'returned.', '', 'Boo. - Linda'],
    ['POKER NIGHT RULES', '1. No crying.', '2. Cody, no crying.', '3. Buy in: 200 rolls.', '4. Zin deals.', '5. Zin always wins.', '6. Do not ask why', '   Zin always wins.', ''],
    ['PUTTING REMATCH', 'Wade vs. You', '', 'Hole 1: Wade', 'Hole 2: Wade', 'Hole 3: Wade', '', 'Wade says the green', 'was "fair".'],
    ['CANDY JAR AUDIT', 'Start of day: 300', 'End of day: 12', 'Suspects: everyone', '', 'New rule: one candy', 'per visit, please!', '', '- Reception'],
    ['VACATION PHOTOS.JPG', 'Page 1 of 400', '', '##########  ####', '####  ##########', '##########  ####', '####  ##########', '', 'Who printed this??'],
  ];
  function JamGame() {
    const SHEETS = 5, LEN = 100; // the sheet is LEN pixels long when it's all the way out
    const docs = JAM_DOCS.slice();
    for (let i = docs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [docs[i], docs[j]] = [docs[j], docs[i]]; }
    let state = 'ready', t = 0, done = 0, torn = 0, shake = 0, record = false;
    let sheet = null, out = 0, tension = 0, skew = 0, wait = 0, msg = '';
    const SNAG_W = 6;
    function newSheet() {
      const n = done + torn;
      const paper = n === 0 ? JAM_PAPERS[0] : JAM_PAPERS[Math.floor(Math.random() * JAM_PAPERS.length)];
      // 1 snag on the first sheet, then 2 or 3, spread along the sheet
      const snags = [], count = n === 0 ? 1 : 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let tries = 0; snags.length < count && tries < 50; tries++) {
        const s = 15 + Math.floor(Math.random() * 72);
        if (snags.every((o) => Math.abs(o - s) > 16)) snags.push(s);
      }
      snags.sort((a, b) => a - b);
      sheet = { paper, snags, doc: docs[n % docs.length] };
      out = 0; tension = 0; msg = '';
      skew = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 8);
    }
    const inSnag = () => sheet.snags.some((s) => out >= s && out < s + SNAG_W);
    const snagAhead = () => sheet.snags.some((s) => out >= s - 10 && out < s);
    function finishSheet() {
      if (done + torn >= SHEETS) { state = 'done'; t = 0; record = saveBest('jam', done); return; }
      newSheet(); state = 'play';
    }
    newSheet();
    const self = {
      music: 'stack',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(torn === 0 ? 'Every sheet out clean. The printer almost looks grateful.'
              : done ? done + ' sheets out, ' + torn + ' torn. The printer lives to jam again.'
                : 'You shredded the lot. PC LOAD LETTER, forever.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You give up and use the other printer.'); return; }
        if (shake > 0) shake--;
        // a finished sheet stays up so you can read it; a torn one hangs there a moment
        if (state === 'clean') { wait++; if (wait > 20 && pressed.has('a')) { sfx('select'); finishSheet(); } return; }
        if (state === 'tore') { if (++wait > 70) finishSheet(); return; }
        const p = sheet.paper, snag = inSnag();
        // straighten it out
        if (held.left) skew -= 0.7;
        if (held.right) skew += 0.7;
        if (held.a) {
          out += p.pull * (snag ? 0.5 : 1);
          // pulling crooked makes it worse, and strains it more
          skew += p.drift * (skew >= 0 ? 1 : -1) + (Math.random() - 0.5) * 0.3;
          tension += p.strain * (snag ? 1.8 : 1) * (1 + Math.abs(skew) / 18);
          if (snag && t % 10 === 0) sfx('blip');
        } else tension -= p.relax;
        skew = Math.max(-30, Math.min(30, skew));
        tension = Math.max(0, tension);
        if (tension >= 100) {
          torn++; shake = 14; tension = 0; sfx('buzz');
          state = 'tore'; wait = 0;
          msg = snag ? 'RRRIP! It caught on a roller.' : Math.abs(skew) > 12 ? 'RRRIP! It came out crooked.' : 'RRRIP! Too hard.';
          return;
        }
        if (out >= 100) {
          out = 100; done++; tension = 0; sfx('ding');
          state = 'clean'; wait = 0;
          msg = 'Out clean!';
        }
      },
      draw() {
        box(0, 0, SW, SH);
        const p = sheet.paper;
        text('Sheet ' + Math.min(done + torn + (state === 'clean' || state === 'tore' ? 0 : 1), SHEETS) + '/' + SHEETS, 16, 8);
        const b = 'Best ' + getBest('jam');
        text(b, SW - 16 - b.length * 6, 8);
        text('Clean ' + done + '   Torn ' + torn, 16, 20);
        text(p.name, SW - 16 - p.name.length * 6, 20, 1, p === JAM_PAPERS[0] ? col.dark : '#a05010');
        const sx = shake ? ((tick & 1) ? 2 : -2) : 0;
        // the sheet comes up out of the top of the printer, top of the page first,
        // drawn in 2px strips, each shifted by how crooked it is
        const W = 160, X = 80 + sx, SLOT = 146, shown = Math.round(out * LEN / 100);
        const top = SLOT - shown, off = (ly) => Math.round(skew * (shown - ly) / LEN);
        for (let ly = 0; ly < shown; ly += 2) {
          const dx = off(ly), h = Math.min(2, shown - ly);
          ctx.fillStyle = col.dark; ctx.fillRect(X + dx, top + ly, W, h);
          ctx.fillStyle = p.bg; ctx.fillRect(X + dx + 1, top + ly, W - 2, h);
        }
        if (shown > 0) {
          ctx.fillStyle = col.dark; ctx.fillRect(X + off(0), top, W, 1);
          // label sheets: rows of labels behind the print
          if (p.labels) {
            ctx.fillStyle = '#d8dce8';
            for (let ly = 3; ly + 21 < shown; ly += 24) for (const lx of [4, 82]) {
              const dx = off(ly);
              ctx.fillRect(X + dx + lx, top + ly, 74, 1); ctx.fillRect(X + dx + lx, top + ly + 20, 74, 1);
              ctx.fillRect(X + dx + lx, top + ly, 1, 21); ctx.fillRect(X + dx + lx + 73, top + ly, 1, 21);
            }
          }
          // the print, revealed a line at a time
          sheet.doc.forEach((line, i) => {
            const ly = i === 0 ? 4 : 8 + i * 10;
            if (ly + 8 > shown || !line) return;
            text(line, X + off(ly) + 6, top + ly, 1, i === 0 ? '#2850a0' : col.dark);
            if (i === 0) { ctx.fillStyle = '#2850a0'; ctx.fillRect(X + off(12) + 6, top + 12, line.length * 6 - 1, 1); }
          });
          // creases where it was dragged over a snag
          ctx.fillStyle = '#9098a8';
          for (const s of sheet.snags) {
            const ly = Math.round(s * LEN / 100);
            if (out < s + SNAG_W || ly >= shown) continue;
            for (let i = 0; i < W - 4; i += 2) ctx.fillRect(X + off(ly) + 2 + i, top + ly + ((i >> 1) & 1), 2, 1);
          }
          // a ragged edge where it ripped off at the rollers
          if (state === 'tore') {
            for (let i = 0; i < W; i += 4) {
              const d = 1 + ((i * 7) % 5);
              ctx.fillStyle = col.light; ctx.fillRect(X + off(shown) + i, SLOT - d, 4, d);
              ctx.fillStyle = col.dark; ctx.fillRect(X + off(shown) + i, SLOT - d - 1, 4, 1);
            }
          }
        }
        // the printer, the sheet feeding out of the slot on top
        ctx.fillStyle = col.dark; ctx.fillRect(70 + sx, SLOT - 2, 180, 46);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(73 + sx, SLOT + 1, 174, 40);
        ctx.fillStyle = col.dark; ctx.fillRect(76 + sx, SLOT - 2, 168, 4);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(80 + sx, SLOT + 8, 120, 16);
        text('PC LOAD LETTER', 83 + sx, SLOT + 12, 1, col.dark);
        ctx.fillStyle = state === 'play' && snagAhead() && (tick >> 2) & 1 ? '#f05040' : '#58a848';
        ctx.fillRect(222 + sx, SLOT + 12, 8, 8);
        // OUT (with the snags marked) on the left, PULL on the right, both filling upwards
        const BY = 42, BH = 146;
        text('OUT', 6, BY - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(10, BY, 12, BH);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(11, BY + 1, 10, BH - 2);
        const oh = Math.round((BH - 2) * out / 100);
        ctx.fillStyle = '#3868c8'; ctx.fillRect(11, BY + BH - 1 - oh, 10, oh);
        ctx.fillStyle = '#c03030';
        for (const s of sheet.snags) {
          const y1 = BY + BH - 1 - Math.round((BH - 2) * (s + SNAG_W) / 100);
          ctx.fillRect(8, y1, 16, Math.max(2, Math.round((BH - 2) * SNAG_W / 100)));
        }
        text('PULL', SW - 28, BY - 12);
        ctx.fillStyle = col.dark; ctx.fillRect(SW - 22, BY, 12, BH);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(SW - 21, BY + 1, 10, BH - 2);
        const th = Math.round((BH - 2) * Math.min(100, tension) / 100);
        ctx.fillStyle = tension > 75 ? '#f05040' : tension > 45 ? '#f0b030' : '#58b058';
        ctx.fillRect(SW - 21, BY + BH - 1 - th, 10, th);
        // what to watch out for
        let warn = '', wc = '#c03030';
        if (state === 'play') {
          if (tension > 75) warn = 'EASY!';
          else if (inSnag()) warn = 'Snagged! Gently...';
          else if (snagAhead()) { warn = 'Snag ahead!'; wc = '#a05010'; }
          else if (Math.abs(skew) > 12) { warn = skew > 0 ? 'Crooked! Press Left' : 'Crooked! Press Right'; wc = '#a05010'; }
        } else if (state === 'tore' || state === 'clean') { warn = msg; wc = state === 'tore' ? '#c03030' : '#2c7a40'; }
        if (warn && (state !== 'play' || warn !== 'EASY!' || (tick >> 2) & 1)) text(warn, 160 - warn.length * 3, 196, 1, wc);
        if (state === 'ready') readyBox(t, 'Hold Space, but ease off!');
        else if (state === 'done') doneBox(['Jam cleared!', 'Clean ' + done + '   Torn ' + torn,
          record ? 'New record!' : 'Best ' + getBest('jam')], t);
        else if (state === 'clean') text('Space: next sheet   Esc: give up', 16, SH - 22);
        else text('Space: pull  Left/Right: straighten  Esc: quit', 16, SH - 22);
      },
    };
    return self;
  }

  // ---------- laundry: catch this load's coveralls, let the rest fall past ----------
  function LaundryGame() {
    const FLOOR = 196, BASKET_W = 52, LIVES = 3;
    const LOADS = [
      { name: 'WHITES', c: '#f8f8f8', edge: '#c8ccd8' },
      { name: 'COLOURS', c: '#3868c8', edge: '#283878' },
      { name: 'GREASY', c: '#5c4c3a', edge: '#3a2f22' },
    ];
    let state = 'ready', t = 0, bx = 134, items = [], spawn = 0, load = 0, caught = 0, lives = LIVES;
    let swap = 0, record = false;
    const self = {
      music: 'coffee',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(caught ? 'You sorted ' + caught + ' bits of laundry. The coveralls thank you.'
              : 'You put a red rag in with the whites. Everything is pink now.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the laundry for another day.'); return; }
        if (held.left) bx = Math.max(12, bx - 3.4);
        if (held.right) bx = Math.min(SW - 12 - BASKET_W, bx + 3.4);
        // the machine calls for a different load every so often
        if (++swap > 420) { swap = 0; load = (load + 1 + Math.floor(Math.random() * 2)) % 3; sfx('menu'); }
        if (++spawn >= Math.max(26, 60 - caught)) {
          spawn = 0;
          items.push({ x: 16 + Math.random() * (SW - 48), y: 40, k: Math.floor(Math.random() * 3), vy: 1.5 + Math.random() });
        }
        for (const it of items) { it.vy = Math.min(it.vy + 0.02, 4); it.y += it.vy; }
        items = items.filter((it) => {
          const inBasket = it.y + 14 >= FLOOR - 16 && it.y < FLOOR && it.x + 14 > bx && it.x < bx + BASKET_W;
          if (inBasket) {
            if (it.k === load) { caught++; sfx('blip', true); }
            else { lives--; sfx('buzz'); }
            return false;
          }
          if (it.y > FLOOR + 10) {
            if (it.k === load) { lives--; sfx('bump'); }
            return false;
          }
          return true;
        });
        if (lives <= 0) { state = 'done'; t = 0; record = saveBest('laundry', caught); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Catch the ' + LOADS[load].name + '!', 16, 10);
        const b = 'Best ' + getBest('laundry');
        text(b, SW - 16 - b.length * 6, 10);
        text('Sorted ' + caught, 16, 24);
        for (let i = 0; i < LIVES; i++) {
          ctx.fillStyle = i < lives ? '#c03030' : '#c8ccd8';
          ctx.fillRect(220 + i * 14, 24, 10, 10);
        }
        // washer and dryer across the top, the chute between them
        for (const [x, lbl] of [[20, 'WASH'], [232, 'DRY']]) {
          ctx.fillStyle = col.dark; ctx.fillRect(x, 36, 68, 56);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 2, 38, 64, 52);
          ctx.fillStyle = col.dark; ring(x + 18, 52, 32, 32);
          ctx.fillStyle = '#a8d8f0'; ctx.fillRect(x + 20, 54, 28, 28);
          text(lbl, x + 22, 94, 1, col.dark);
        }
        // what the machine wants right now
        const L = LOADS[load];
        ctx.fillStyle = col.dark; ctx.fillRect(112, 40, 96, 26);
        ctx.fillStyle = L.c; ctx.fillRect(114, 42, 92, 22);
        text(L.name, 160 - L.name.length * 3, 48, 1, load === 0 ? '#181820' : '#f8f8f8');
        ctx.fillStyle = col.dark; ctx.fillRect(112, 70, 96, 6);
        ctx.fillStyle = '#58b058'; ctx.fillRect(113, 71, Math.round(94 * (1 - swap / 420)), 4);
        // falling laundry
        for (const it of items) {
          const k = LOADS[it.k];
          ctx.fillStyle = k.edge; ctx.fillRect(Math.round(it.x), Math.round(it.y), 16, 14);
          ctx.fillStyle = k.c; ctx.fillRect(Math.round(it.x) + 2, Math.round(it.y) + 2, 12, 10);
        }
        // floor and basket
        ctx.fillStyle = col.dark; ctx.fillRect(8, FLOOR + 10, SW - 16, 2);
        ctx.fillStyle = col.dark; ctx.fillRect(Math.round(bx), FLOOR - 16, BASKET_W, 26);
        ctx.fillStyle = '#c89058'; ctx.fillRect(Math.round(bx) + 2, FLOOR - 14, BASKET_W - 4, 22);
        ctx.fillStyle = L.c; ctx.fillRect(Math.round(bx) + 6, FLOOR - 10, BASKET_W - 12, 6);
        if (state === 'ready') readyBox(t, 'Left/Right: move the basket');
        else if (state === 'done') doneBox(['Laundry disaster!', 'Sorted: ' + caught,
          record ? 'New record!' : 'Best ' + getBest('laundry')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- elevator small talk: survive the ride ----------
  // Runs between picking a floor and arriving; `arrive` is called when the doors open.
  const SMALL_TALK = [
    { q: 'Cold enough for you?', a: [['Sure is!', 2], ['It is indoors.', 0], ['...', 0]] },
    { q: 'Busy week?', a: [['Flat out, you?', 2], ['Not really.', 1], ['Define busy.', 0]] },
    { q: 'Did you catch the game?', a: [['What a finish!', 2], ['Missed it.', 1], ['I do not watch sport.', 0]] },
    { q: 'How is that unit coming along?', a: [['Nearly done.', 2], ['Do not ask.', 1], ['Which unit?', 0]] },
    { q: 'Long way up, this.', a: [['Every morning!', 2], ['Four floors.', 1], ['Mm.', 0]] },
    { q: 'Any plans for the weekend?', a: [['Nothing much, you?', 2], ['Working.', 1], ['Yes.', 0]] },
    { q: 'They fixed the coffee machine.', a: [['About time!', 2], ['Oh good.', 1], ['I drink tea.', 0]] },
  ];
  function ElevatorGame(who, from, to, arrive) {
    const look = who ? who.sprites : sprites, name = who ? who.name : 'A coworker';
    const hops = Math.max(2, Math.abs(to - from) + 2);
    let state = 'ride', t = 0, turn = 0, sel = 0, silence = 30, bit = null, said = null, score = 0;
    function nextBit() {
      bit = SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)];
      sel = 0; said = null;
    }
    nextBit();
    const self = {
      music: 'office',
      update() {
        t++;
        if (state === 'done') {
          if (t > 24 && (pressed.has('a') || pressed.has('b'))) { remove(self); arrive(); }
          return;
        }
        if (said) {
          if (++said.t > 50) {
            if (++turn >= hops) { state = 'done'; t = 0; sfx('ding'); questNote('elevator', 1); return; }
            nextBit();
          }
          return;
        }
        if (pressed.has('up')) { sel = (sel + 2) % 3; sfx('select'); }
        if (pressed.has('down')) { sel = (sel + 1) % 3; sfx('select'); }
        if (pressed.has('a')) {
          const pts = bit.a[sel][1];
          score += pts; silence = Math.max(0, silence + (pts === 2 ? -14 : pts === 1 ? 2 : 18));
          said = { t: 0, line: bit.a[sel][0], pts };
          sfx(pts === 2 ? 'blip' : 'bump', true);
          return;
        }
        // say nothing for long enough and it gets properly awkward
        silence += 0.22;
        if (silence >= 100) { silence = 100; state = 'done'; t = 0; sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        // the car
        ctx.fillStyle = '#b0b8c8'; ctx.fillRect(10, 10, SW - 20, 158);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(10, 10, SW - 20, 8);
        ctx.fillStyle = col.dark; ctx.fillRect(150, 18, 20, 142); ctx.fillRect(10, 160, SW - 20, 8);
        // floor indicator: a lit panel with the number on it
        ctx.fillStyle = col.dark; ctx.fillRect(126, 20, 68, 16);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(128, 22, 64, 12);
        const lbl = state === 'done' ? 'ARRIVED'
          : 'FLOOR ' + (from + Math.round((to - from) * (turn / hops)) + 1);
        text(lbl, 160 - lbl.length * 3, 23, 1, '#181820');
        ctx.drawImage(look.down[0], 40, 86, 56, 56);
        ctx.drawImage(sprites.up[0], 216, 86, 56, 56);
        text(name, 68 - name.length * 3, 146);
        text('You', 238, 146);
        // awkwardness, below the car so the dialogue box cannot cover it
        text('AWKWARD', 16, 174);
        ctx.fillStyle = col.dark; ctx.fillRect(74, 172, 150, 10);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(75, 173, 148, 8);
        ctx.fillStyle = silence > 70 ? '#f05040' : silence > 40 ? '#f0b030' : '#58b058';
        ctx.fillRect(75, 173, Math.round(148 * silence / 100), 8);
        if (state === 'done') {
          box(0, SH - 36, SW, 36);
          const m = silence >= 100 ? 'You ride the rest of the way in silence.'
            : score >= hops * 2 - 1 ? 'A genuinely pleasant ride!' : 'You survive the ride.';
          text(m, 12, SH - 26);
          return;
        }
        box(0, SH - 56, SW, 56);
        if (said) {
          text('You: "' + said.line + '"', 12, SH - 46);
          text(said.pts === 2 ? '(they smile)' : said.pts === 1 ? '(they nod)' : '(long pause)',
            12, SH - 30, 1, said.pts === 2 ? '#2c6a34' : said.pts === 1 ? '#8890a0' : '#b83028');
          return;
        }
        text(name + ': "' + bit.q + '"', 12, SH - 50);
        bit.a.forEach((a, i) => {
          text(a[0], 26 + (i % 2) * 156, SH - 32 + Math.floor(i / 2) * 14);
          if (i === sel) text('>', 16 + (i % 2) * 156, SH - 32 + Math.floor(i / 2) * 14);
        });
      },
    };
    return self;
  }

  // ---------- Jhonna's Manulife forms: tick the real fields, not the traps ----------
  function FormsGame() {
    const WIN_Y = 118, WIN_H = 22, LIVES = 3;
    const FIELDS = ['Dependant name', 'Dependant DOB', 'Relationship', 'Coverage level',
      'Spouse name', 'Plan member ID', 'Effective date', 'Student status'];
    const TRAPS = ['SIGN HERE', 'OFFICE USE ONLY', 'DO NOT WRITE BELOW', 'STAPLE HERE', 'FOR ADVISOR ONLY'];
    let state = 'ready', t = 0, lines = [], spawn = 0, ticked = 0, lives = LIVES, last = null, record = false;
    function newLine(y) {
      const trap = Math.random() < 0.35;
      return { y, trap, s: trap ? TRAPS[Math.floor(Math.random() * TRAPS.length)]
        : FIELDS[Math.floor(Math.random() * FIELDS.length)] };
    }
    // start part-way down the page, so there is something to read straight away
    for (let i = 0; i < 4; i++) lines.push(newLine(150 + i * 42));
    const self = {
      music: 'lunch',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(ticked >= 15 ? 'Forms done! Jhonna will stop emailing you. For a month.'
              : 'You filled in ' + ticked + ' fields before giving up. Jhonna has noted it.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You put the forms back in the drawer.'); return; }
        if (last) last.t++;
        if (++spawn >= Math.max(34, 70 - ticked * 2)) { spawn = 0; lines.push(newLine(SH)); }
        const speed = 0.9 + ticked * 0.03;
        for (const l of lines) l.y -= speed;
        // the line sitting in the highlight band is the one Space applies to
        const at = lines.find((l) => l.y >= WIN_Y - 4 && l.y <= WIN_Y + WIN_H - 4 && !l.done);
        if (pressed.has('a')) {
          if (!at) { sfx('bump'); }
          else if (at.trap) { at.done = true; lives--; last = { s: 'That is not a field!', c: '#b83028', t: 0 }; sfx('buzz'); }
          else { at.done = true; ticked++; last = { s: 'Ticked', c: '#2c6a34', t: 0 }; sfx('blip', true); }
        }
        lines = lines.filter((l) => {
          if (l.y < -16) {
            if (!l.trap && !l.done) { lives--; last = { s: 'Missed a field!', c: '#b83028', t: 0 }; sfx('bump'); }
            return false;
          }
          return true;
        });
        if (lives <= 0) { state = 'done'; t = 0; record = saveBest('forms', ticked); sfx('buzz'); }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Manulife forms', 16, 10);
        const b = 'Best ' + getBest('forms');
        text(b, SW - 16 - b.length * 6, 10);
        text('Ticked ' + ticked, 16, 24);
        for (let i = 0; i < LIVES; i++) {
          ctx.fillStyle = i < lives ? '#c03030' : '#c8ccd8';
          ctx.fillRect(220 + i * 14, 24, 10, 10);
        }
        // the form itself, scrolling up past a highlight band
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(20, 40, SW - 40, 170);
        ctx.fillStyle = col.dark; ring(20, 40, SW - 40, 170);
        ctx.fillStyle = '#dfe8f8'; ctx.fillRect(22, WIN_Y - 4, SW - 44, WIN_H);
        ctx.fillStyle = '#3060d0'; ctx.fillRect(22, WIN_Y - 4, SW - 44, 1); ctx.fillRect(22, WIN_Y + WIN_H - 5, SW - 44, 1);
        ctx.save();
        ctx.beginPath(); ctx.rect(22, 42, SW - 44, 166); ctx.clip();
        for (const l of lines) {
          const y = Math.round(l.y);
          ctx.fillStyle = col.dark; ctx.fillRect(34, y + 2, 12, 12);
          ctx.fillStyle = l.done ? (l.trap ? '#f0a0a0' : '#b8e8b8') : '#f8f8f8';
          ctx.fillRect(35, y + 3, 10, 10);
          if (l.done && !l.trap) { ctx.fillStyle = '#2c6a34'; ctx.fillRect(37, y + 7, 2, 4); ctx.fillRect(39, y + 5, 2, 4); }
          text(l.s, 54, y + 2, 1, l.trap ? '#b83028' : col.dark);
        }
        ctx.restore();
        if (last && last.t < 36) text(last.s, (SW - last.s.length * 6) >> 1, 216, 1, last.c);
        if (state === 'ready') readyBox(t, 'Space: tick the real fields');
        else if (state === 'done') doneBox(['Jhonna takes the forms back.', 'Fields ticked: ' + ticked,
          record ? 'New record!' : 'Best ' + getBest('forms')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Nathan's shelf: grab the trophy he asks for, off a crowded shelf ----------
  // Your hand sweeps along the shelf and you stab A to grab. Nab the wrong one and
  // Nathan takes it straight back off you.
  function NathanGame() {
    const SHELF_Y = 150, SLOTS = 6, SLOT_W = 40, X0 = 14, LIVES = 3;
    // `tag` is the short label on the shelf; a full name would run into its neighbour
    const KINDS = [
      { name: 'BOWLING', tag: 'BOWL', c: '#9868c8', cup: false },
      { name: 'SALES', tag: 'SALES', c: '#f0b030', cup: true },
      { name: 'SAFETY', tag: 'SAFE', c: '#58a848', cup: false },
      { name: 'GOLF', tag: 'GOLF', c: '#40a0a0', cup: true },
      { name: 'CURLING', tag: 'CURL', c: '#78a8e8', cup: false },
      { name: 'DARTS', tag: 'DARTS', c: '#c03030', cup: true },
    ];
    const nathan = spritesFor('Nathan');
    let state = 'ready', t = 0, shelf = [], want = 0, hand = X0, dir = 1, speed = 1.8;
    let got = 0, lives = LIVES, grab = null, record = false;
    function deal() {
      shelf = KINDS.map((k, i) => i);
      for (let i = SLOTS - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shelf[i], shelf[j]] = [shelf[j], shelf[i]];
      }
      want = shelf[Math.floor(Math.random() * SLOTS)];
      speed = Math.min(6.5, 1.8 + got * 0.32);
    }
    deal();
    const slotAt = (x) => Math.max(0, Math.min(SLOTS - 1, Math.floor((x - X0) / SLOT_W)));
    const self = {
      music: 'punch',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(got >= 12 ? 'You cleared the shelf ' + got + ' times over. Nathan is genuinely impressed.'
              : got ? 'You got ' + got + (got === 1 ? ' trophy' : ' trophies') + ' down before Nathan took over.'
                : 'Nathan takes the shelf back. You did not get a single one.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave Nathan to his shelf.'); return; }
        if (grab) {
          grab.t++;
          if (grab.t > 34) {
            grab = null;
            if (lives <= 0) { state = 'done'; t = 0; record = saveBest('trophy', got); return; }
            deal();
          }
          return;
        }
        // the hand sweeps the shelf, quicker every time you get one
        hand += dir * speed;
        if (hand > X0 + SLOTS * SLOT_W - SLOT_W) { hand = X0 + SLOTS * SLOT_W - SLOT_W; dir = -1; }
        if (hand < X0) { hand = X0; dir = 1; }
        if (pressed.has('a')) {
          const slot = slotAt(hand + SLOT_W / 2), took = shelf[slot];
          const ok = took === want;
          if (ok) { got++; sfx('ding'); } else { lives--; sfx('buzz'); }
          grab = { t: 0, slot, ok, took };
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Grab the ' + KINDS[want].name + ' trophy!', 16, 10);
        const b = 'Best ' + getBest('trophy');
        text(b, SW - 16 - b.length * 6, 10);
        text('Got ' + got, 16, 26);
        for (let i = 0; i < LIVES; i++) {
          ctx.fillStyle = i < lives ? '#c03030' : '#c8ccd8';
          ctx.fillRect(90 + i * 14, 26, 10, 10);
        }
        ctx.drawImage(nathan.down[0], SW - 58, 96, 48, 48);
        text('Nathan', SW - 54, 148);
        // the shelf and what is standing on it
        ctx.fillStyle = col.dark; ctx.fillRect(10, SHELF_Y, SLOTS * SLOT_W + 10, 8);
        ctx.fillStyle = '#9a6434'; ctx.fillRect(12, SHELF_Y + 1, SLOTS * SLOT_W + 6, 6);
        shelf.forEach((k, i) => {
          const T = KINDS[k], x = X0 + i * SLOT_W;
          const taken = grab && grab.slot === i;
          const lift = taken ? Math.min(34, grab.t * 1.6) : 0;
          if (taken && !grab.ok && grab.t > 17) return;   // Nathan snatches it back
          const by = SHELF_Y - 40 - lift;
          ctx.fillStyle = col.dark; ctx.fillRect(x + 12, by + 30, 20, 8);
          ctx.fillStyle = '#5c4c3a'; ctx.fillRect(x + 13, by + 31, 18, 6);
          if (T.cup) {
            ctx.fillStyle = col.dark; ctx.fillRect(x + 19, by + 18, 6, 14);
            ctx.fillRect(x + 12, by + 2, 20, 18);
            ctx.fillStyle = T.c; ctx.fillRect(x + 13, by + 3, 18, 16); ctx.fillRect(x + 20, by + 19, 4, 12);
            ctx.fillStyle = col.dark; ctx.fillRect(x + 8, by + 5, 4, 10); ctx.fillRect(x + 32, by + 5, 4, 10);
          } else {
            ctx.fillStyle = col.dark; ctx.fillRect(x + 19, by + 16, 6, 16);
            ctx.fillRect(x + 14, by, 16, 18);
            ctx.fillStyle = T.c; ctx.fillRect(x + 15, by + 1, 14, 16); ctx.fillRect(x + 20, by + 17, 4, 14);
          }
          text(T.tag, x + 20 - T.tag.length * 3, SHELF_Y + 12, 1,
            k === want ? '#2c6a34' : '#585868');
        });
        // your hand, sweeping or diving in
        const hx = Math.round(hand) + SLOT_W / 2 - 9;
        const hy = grab ? SHELF_Y - 58 + Math.min(22, grab.t * 2) : 78;
        ctx.fillStyle = col.dark; ctx.fillRect(hx, hy, 18, 16);
        ctx.fillStyle = '#f8d0a8'; ctx.fillRect(hx + 1, hy + 1, 16, 14);
        ctx.fillStyle = col.dark; ctx.fillRect(hx + 7, hy - 10, 4, 10);
        if (grab) {
          const m = grab.ok ? 'Got it!' : 'Nathan: NOT THAT ONE!';
          text(m, (SW - m.length * 6) >> 1, 196, 1, grab.ok ? '#2c6a34' : '#b83028');
        }
        if (state === 'ready') readyBox(t, 'Space: grab the right one');
        else if (state === 'done') doneBox(['Shelf closed!', 'Trophies grabbed: ' + got,
          record ? 'New record!' : 'Best ' + getBest('trophy')], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Wade's grudge match: alternate putts, fewest strokes over 3 holes ----------
  function WadeGolfGame() {
    const FX = 16, FY = 44, FW = 288, FH = 150, R = 3, CUP = 6, HOLES = 3;
    const wade = spritesFor('Wade');
    let hole = 0, state = 'ready', t = 0, turn = 'you', phase = 'aim';
    let aim = 0, power = 0, dir = 1, ball = null, vel = null, strokes = [0, 0], won = [0, 0];
    let cup = null, msg = null, record = false, wadeWait = 0;
    function newHole() {
      ball = { you: { x: FX + 40, y: FY + FH / 2 }, wade: { x: FX + 40, y: FY + FH / 2 + 26 } };
      cup = { x: FX + FW - 50 - Math.random() * 40, y: FY + 30 + Math.random() * (FH - 60) };
      strokes = [0, 0]; turn = 'you'; phase = 'aim'; aim = 0; power = 0; vel = null; msg = null;
    }
    newHole();
    function shoot(who, a, p) {
      vel = { who, x: Math.cos(a) * p * 0.22, y: Math.sin(a) * p * 0.22 };
      strokes[who === 'you' ? 0 : 1]++;
      sfx('putt');
    }
    function sunk(b) { return Math.hypot(b.x - cup.x, b.y - cup.y) < CUP; }
    const self = {
      music: 'golf',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(won[0] > won[1] ? 'You beat Wade ' + won[0] + '-' + won[1] + '. He asks for a rematch immediately.'
              : won[0] === won[1] ? 'All square with Wade, ' + won[0] + '-' + won[1] + '. Honour intact.'
                : 'Wade wins ' + won[1] + '-' + won[0] + '. He putts between meetings, remember.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You hand Wade his putter back.'); return; }
        if (msg) {
          if (++msg.t > 60) {
            msg = null;
            if (hole >= HOLES) { state = 'done'; t = 0; record = saveBest('wade', won[0]); return; }
            newHole();
          }
          return;
        }
        // a ball is rolling
        if (vel) {
          const b = ball[vel.who];
          b.x += vel.x; b.y += vel.y;
          vel.x *= 0.965; vel.y *= 0.965;
          if (b.x < FX + R) { b.x = FX + R; vel.x = -vel.x * 0.6; }
          if (b.x > FX + FW - R) { b.x = FX + FW - R; vel.x = -vel.x * 0.6; }
          if (b.y < FY + R) { b.y = FY + R; vel.y = -vel.y * 0.6; }
          if (b.y > FY + FH - R) { b.y = FY + FH - R; vel.y = -vel.y * 0.6; }
          if (sunk(b)) {
            sfx('cup');
            const i = vel.who === 'you' ? 0 : 1;
            won[i]++; hole++;
            msg = { t: 0, s: (vel.who === 'you' ? 'You sink it' : 'Wade sinks it') + ' in ' + strokes[i] + '!' };
            vel = null;
            return;
          }
          if (Math.hypot(vel.x, vel.y) < 0.12) {
            vel = null;
            turn = turn === 'you' ? 'wade' : 'you';
            phase = 'aim'; aim = 0; power = 0; wadeWait = 0;
            if (strokes[0] + strokes[1] >= 14) {
              hole++;
              msg = { t: 0, s: 'Nobody sinks it. Halved!' };
            }
          }
          return;
        }
        if (turn === 'wade') {
          // Wade reads the line closely and putts just past the cup, so a miss
          // leaves him a tap-in: he sinks about half his first putts and nearly
          // always the second
          if (++wadeWait < 30) return;
          wadeWait = 0;
          const b = ball.wade, d = Math.hypot(cup.x - b.x, cup.y - b.y);
          const a = Math.atan2(cup.y - b.y, cup.x - b.x) + (Math.random() - 0.5) * 0.12;
          // the power that rolls the ball 14-32px past the cup (it slows 3.5% a frame and stops below 0.12)
          shoot('wade', a, Math.min(100, (0.035 * (d + 14 + Math.random() * 18) + 0.12) / 0.22));
          return;
        }
        // your turn: sweep the aim, then sweep the power
        if (phase === 'aim') {
          aim += dir * 0.022;
          if (aim > 0.95 || aim < -0.95) dir = -dir;
          if (pressed.has('a')) { phase = 'power'; power = 0; dir = 1; sfx('select'); }
        } else {
          power += dir * 2.1;
          if (power > 100) { power = 100; dir = -1; }
          if (power < 0) { power = 0; dir = 1; }
          if (pressed.has('a')) {
            const b = ball.you;
            shoot('you', Math.atan2(cup.y - b.y, cup.x - b.x) + aim, power);
            phase = 'aim';
          }
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Hole ' + Math.min(hole + 1, HOLES) + '/' + HOLES, 16, 10);
        text('You ' + won[0] + ' - ' + won[1] + ' Wade', 140, 10);
        const b = 'Best ' + getBest('wade');
        text(b, SW - 16 - b.length * 6, 26);
        text(turn === 'you' ? 'Your putt (' + strokes[0] + ')' : 'Wade putts (' + strokes[1] + ')', 16, 26);
        // the green
        ctx.fillStyle = col.dark; ctx.fillRect(FX - 3, FY - 3, FW + 6, FH + 6);
        ctx.fillStyle = '#58a848'; ctx.fillRect(FX, FY, FW, FH);
        ctx.fillStyle = '#4e9a40';
        for (let x = FX; x < FX + FW; x += 16) ctx.fillRect(x, FY, 8, FH);
        // the cup and its flag
        ctx.fillStyle = col.dark; ring(Math.round(cup.x) - CUP, Math.round(cup.y) - CUP, CUP * 2, CUP * 2);
        ctx.fillStyle = '#181820'; ctx.fillRect(Math.round(cup.x) - CUP + 2, Math.round(cup.y) - CUP + 2, CUP * 2 - 4, CUP * 2 - 4);
        ctx.fillStyle = col.dark; ctx.fillRect(Math.round(cup.x), Math.round(cup.y) - 24, 2, 20);
        ctx.fillStyle = '#c03030'; ctx.fillRect(Math.round(cup.x) + 2, Math.round(cup.y) - 24, 12, 8);
        // both balls
        for (const [who, c] of [['you', '#f8f8f8'], ['wade', '#f0b030']]) {
          const bb = ball[who];
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(bb.x) - R - 1, Math.round(bb.y) - R - 1, R * 2 + 2, R * 2 + 2);
          ctx.fillStyle = c; ctx.fillRect(Math.round(bb.x) - R, Math.round(bb.y) - R, R * 2, R * 2);
        }
        // your aim line and power bar
        if (turn === 'you' && !vel && !msg && state === 'play') {
          const bb = ball.you, a = Math.atan2(cup.y - bb.y, cup.x - bb.x) + aim;
          ctx.fillStyle = '#f8f8f8';
          for (let d = 8; d < 34; d += 5) ctx.fillRect(Math.round(bb.x + Math.cos(a) * d), Math.round(bb.y + Math.sin(a) * d), 2, 2);
          if (phase === 'power') {
            ctx.fillStyle = col.dark; ctx.fillRect(FX, FY + FH + 10, 200, 10);
            ctx.fillStyle = '#e8e8e8'; ctx.fillRect(FX + 1, FY + FH + 11, 198, 8);
            ctx.fillStyle = '#f0b030'; ctx.fillRect(FX + 1, FY + FH + 11, Math.round(198 * power / 100), 8);
          }
          text(phase === 'aim' ? 'Space: lock the line' : 'Space: hit it', FX, FY + FH + 24);
        }
        ctx.drawImage(wade.down[0], SW - 46, FY + FH + 4, 36, 36);
        if (msg) { box(50, 92, 220, 36); ctext(msg.s, 106); }
        if (state === 'ready') readyBox(t, 'Space: line, then power');
        else if (state === 'done') doneBox([won[0] > won[1] ? 'You beat Wade!' : won[0] === won[1] ? 'All square!' : 'Wade takes it.',
          'Holes: ' + won[0] + ' - ' + won[1], record ? 'New record!' : 'Best ' + getBest('wade')], t);
      },
    };
    return self;
  }

  // ---------- Kiki's candy jar: closest guess takes the round ----------
  function CandyJarGame() {
    const ROUNDS = 3, COLS = ['#f85848', '#f8d848', '#78e060', '#68a0f8', '#d870d0', '#f0b030'];
    const kiki = spritesFor('Kiki');
    let round = 0, state = 'look', t = 0, real = 0, guess = 0, hers = 0, score = [0, 0], record = false;
    function newJar() {
      real = 18 + Math.floor(Math.random() * 75);
      guess = 40; hers = 0; state = 'look'; t = 0;
    }
    newJar();
    const self = {
      music: 'candy',
      update() {
        t++;
        if (state === 'look') { if (t > 150) { state = 'guess'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(score[0] > score[1] ? 'You out-guessed Kiki ' + score[0] + '-' + score[1] + '. She hands over the jar.'
              : score[0] === score[1] ? 'Dead even with Kiki. She calls it a draw and gives you one anyway.'
                : 'Kiki wins ' + score[1] + '-' + score[0] + '. She has had a lot of practice.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You leave the jar alone. Mostly.'); return; }
        if (state === 'reveal') {
          if (t > 110) {
            if (++round >= ROUNDS) { state = 'done'; t = 0; record = saveBest('jar', score[0]); return; }
            newJar();
          }
          return;
        }
        // guessing: arrows nudge, held arrows run
        const step = (held.a ? 5 : 1);
        if (pressed.has('up') || (held.up && t % 4 === 0)) guess = Math.min(120, guess + step);
        if (pressed.has('down') || (held.down && t % 4 === 0)) guess = Math.max(1, guess - step);
        if (pressed.has('a') && t > 10) {
          // Kiki guesses close, but not perfectly, and never the same as you
          do { hers = Math.max(1, real + Math.round((Math.random() - 0.5) * 26)); } while (hers === guess);
          const mine = Math.abs(guess - real), theirs = Math.abs(hers - real);
          if (mine < theirs) { score[0]++; sfx('ding'); } else { score[1]++; sfx('buzz'); }
          state = 'reveal'; t = 0;
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Round ' + Math.min(round + 1, ROUNDS) + '/' + ROUNDS, 16, 10);
        text('You ' + score[0] + ' - ' + score[1] + ' Kiki', 150, 10);
        const b = 'Best ' + getBest('jar');
        text(b, SW - 16 - b.length * 6, 26);
        // the jar, with the sweets drawn in a heap
        const JX = 96, JY = 54, JW = 92, JH = 108;
        ctx.fillStyle = col.dark; ctx.fillRect(JX - 8, JY - 10, JW + 16, 10);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(JX - 6, JY - 8, JW + 12, 6);
        ctx.fillStyle = col.dark; ring(JX, JY, JW, JH);
        ctx.fillStyle = '#eef4ff'; ctx.fillRect(JX + 2, JY + 2, JW - 4, JH - 4);
        const show = state === 'look' || state === 'reveal' ? real : 0;
        for (let i = 0; i < show; i++) {
          const cx = JX + 8 + ((i * 29) % (JW - 22));
          const cy = JY + JH - 12 - Math.floor(i / ((JW - 22) / 9)) * 9 - ((i * 7) % 4);
          if (cy < JY + 6) continue;
          ctx.fillStyle = COLS[i % COLS.length];
          ctx.fillRect(cx, cy, 7, 7);
        }
        ctx.drawImage(kiki.down[0], 228, 96, 56, 56);
        text('Kiki', 240, 158);
        if (state === 'look') {
          ctext('Count them! ' + Math.ceil((150 - t) / 60) + 's', 196);
        } else if (state === 'guess') {
          ctext('How many sweets?', 180);
          box(110, 192, 100, 30);
          const g = String(guess);
          text(g, 160 - g.length * 6, 200, 2);
          text('Up/Down, Space to lock in', 56, 228);
        } else {
          box(28, 176, 264, 56);
          text('Really: ' + real, 40, 186);
          text('You: ' + guess + '   Kiki: ' + hers, 40, 202);
          const mine = Math.abs(guess - real), theirs = Math.abs(hers - real);
          text(mine < theirs ? 'You take the round!' : 'Kiki takes the round!', 40, 218, 1,
            mine < theirs ? '#2c6a34' : '#b83028');
        }
        if (state === 'done') doneBox([score[0] > score[1] ? 'You win the jar!' : score[0] === score[1] ? 'A draw!' : 'Kiki wins.',
          'Rounds: ' + score[0] + ' - ' + score[1], record ? 'New record!' : 'Best ' + getBest('jar')], t);
      },
    };
    return self;
  }

  function openStartMenu() {
    sfx('menu');
    // Linda's list shows up in the menu once you've taken it out of the locker
    const items = () => [['MAP', () => ui.push(MapView())]]
      .concat(quest ? [['LINDA\'S LIST', () => ui.push(LindaList())]] : [])
      .concat([
        [soundOn ? 'SOUND ON' : 'SOUND OFF', (self) => { soundOn = !soundOn; store.set('sound', soundOn ? 'on' : 'off'); self.options = items().map((o) => o[0]); sfx('select'); }],
        [musicOn ? 'MUSIC ON' : 'MUSIC OFF', (self) => { musicOn = !musicOn; store.set('music', musicOn ? 'on' : 'off'); self.options = items().map((o) => o[0]); sfx('select'); }],
        ['CLOSE', (self) => remove(self)],
      ]);
    const menu = Choice(items().map((o) => o[0]), -1, 0, (i, self) => {
      if (i < 0) return;
      items()[i][1](self);
    }, { keepOpen: true, startCloses: true, minChars: 12 });
    ui.push(menu);
  }

  // ---------- Linda's list: a side quest from a locker in the fitness room ----------
  // Linda (the ghost in the rack room) left a list of things she never got round to.
  // Each time you take it out of the locker you get a different handful of tasks from
  // LINDA_TASKS. Mini-games report their results to questNote(key, value) and a task
  // is crossed off when value reaches its target. Finish them all and you become
  // Employee of the Month, with your picture by the front entrance. None of this is
  // saved: it starts fresh every visit.
  const LINDA_TASKS = [
    { key: 'coffee', need: 1, text: 'Make a cup of coffee. I miss it.' },
    { key: 'pong', need: 1, text: 'Beat the TV at Pong' },
    { key: 'punch5', need: 300, text: 'Punch the bag for 300 points' },
    { key: 'squat', need: 175, text: 'Squat 175 lb' },
    { key: 'run', need: 150, text: 'Run 150m on the treadmill' },
    { key: 'pulldown', need: 10, text: 'Do 10 clean lat pulldowns' },
    { key: 'jam', need: 3, text: 'Unjam 3 sheets from the printer' },
    { key: 'blackjack', need: 300, text: 'Win 300 spring rolls off Cody' },
    { key: 'battle', need: 1, text: 'Beat Richard in his silly duel' },
    { key: 'dark', need: 1, text: 'Fix the lights in Damir\'s office' },
    { key: 'elevator', need: 1, text: 'Make small talk in the elevator' },
    { key: 'jar', need: 2, text: 'Beat Kiki at the candy jar' },
    { key: 'wade', need: 1, text: 'Win a hole against Wade' },
    { key: 'simon', need: 5, text: 'Get 5 rounds on a light panel' },
    { key: 'lunch', need: 3, text: 'Find the right lunch 3 times' },
    { key: 'candy', need: 5, text: 'Sneak 5 candies off the table' },
    { key: 'desk', need: 7, text: 'Send 7 visitors the right way' },
    { key: 'forms', need: 1, text: 'Help Jhonna with her forms' },
    { key: 'cpr', need: 0, text: 'Practise CPR on the dummy' },
    { key: 'engrave', need: 70, text: 'Engrave a nameplate (70% on)' },
    { key: 'golf', need: 1, text: 'Play a round on Wade\'s green' },
  ];
  const LINDA_COUNT = 7;
  const LINDA_WAITING = [
    'Ooooo... you found my list! Don\'t forget the rest of it.',
    'Boooo... how is my list coming along?',
    'You can check my list from the Start menu. Boo.',
  ];
  const LINDA_THANKS = [
    'You did EVERYTHING on my list! I feel so... light.',
    'Thank you, Employee of the Month. Boo! (That was a happy boo.)',
    'I can finally rest... right after I find my stapler.',
  ];
  let quest = null; // { tasks: [{key, need, text, done}], complete }
  let playerName = '';
  const questQueue = []; // messages to show once you're back walking around

  function startQuest() {
    const pool = LINDA_TASKS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    quest = { tasks: pool.slice(0, LINDA_COUNT).map((t) => Object.assign({ done: false }, t)), complete: false };
  }
  // Called with every mini-game result (from saveBest, and directly by the games that
  // don't keep a best score).
  function questNote(key, value) {
    if (!quest || quest.complete) return;
    for (const task of quest.tasks) {
      if (task.done || task.key !== key || !(value >= task.need)) continue;
      task.done = true;
      const left = quest.tasks.filter((x) => !x.done).length;
      if (left) {
        questQueue.push('A cold breeze ruffles Linda\'s list... "' + task.text + '" crosses itself off! (' + left + ' to go)');
      } else {
        quest.complete = true;
        questQueue.push('A cold breeze ruffles Linda\'s list... "' + task.text + '" crosses itself off!');
        questQueue.push('That\'s everything on Linda\'s list! A happy "Boooo!" echoes through the building.');
        questQueue.push('Somebody has hung a new EMPLOYEE OF THE MONTH picture by the front entrance. Go and have a look!');
      }
    }
  }

  // The open locker, with the list tucked on the top shelf.
  function LockerScreen() {
    let state = 'open', t = 0;
    const self = {
      update() {
        t++;
        if (state === 'open') { if (t > 30) { state = 'look'; t = 0; } return; }
        if (state === 'look') {
          if (t > 20 && pressed.has('a')) { sfx('select'); state = 'grab'; t = 0; }
          else if (pressed.has('b')) { remove(self); say('You close the locker. The paper can wait.'); }
          return;
        }
        if (t > 20 && (pressed.has('a') || pressed.has('b'))) {
          sfx('menu'); remove(self); startQuest(); ui.push(LindaList(true));
        }
      },
      draw() {
        ctx.fillStyle = col.dark; ctx.fillRect(0, 0, SW, SH);
        // the locker body
        const X = 90, Y = 12, W = 140, H = 176;
        ctx.fillStyle = '#5a6478'; ctx.fillRect(X - 6, Y - 6, W + 12, H + 12);
        ctx.fillStyle = '#20242e'; ctx.fillRect(X, Y, W, H);
        // shelf, towel, sneakers, gym bag
        ctx.fillStyle = '#8890a0'; ctx.fillRect(X, Y + 50, W, 5);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(X + 60, Y + 55, 2, 10); // hook
        ctx.fillStyle = '#d85858'; ctx.fillRect(X + 52, Y + 64, 20, 54); ctx.fillStyle = '#f8f8f8'; ctx.fillRect(X + 52, Y + 74, 20, 3); ctx.fillRect(X + 52, Y + 106, 20, 3);
        ctx.fillStyle = '#3868c8'; ctx.fillRect(X + 12, Y + 140, 56, 30); ctx.fillStyle = '#284888'; ctx.fillRect(X + 12, Y + 140, 56, 4); ctx.fillRect(X + 30, Y + 134, 20, 6);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(X + 84, Y + 156, 22, 12); ctx.fillRect(X + 108, Y + 156, 22, 12);
        ctx.fillStyle = '#c03030'; ctx.fillRect(X + 84, Y + 166, 22, 3); ctx.fillRect(X + 108, Y + 166, 22, 3);
        // the folded paper, glowing a little, until you take it
        if (state !== 'grab') {
          const glow = 0.25 + 0.2 * Math.sin(tick / 10);
          ctx.fillStyle = 'rgba(200,230,255,' + glow + ')'; ctx.fillRect(X + 40, Y + 22, 52, 30);
          ctx.fillStyle = '#181820'; ctx.fillRect(X + 45, Y + 28, 42, 22);
          ctx.fillStyle = '#f4ecd0'; ctx.fillRect(X + 46, Y + 29, 40, 20);
          ctx.fillStyle = '#d8ccb0'; ctx.fillRect(X + 46, Y + 38, 40, 1);
          ctx.fillStyle = '#5068b0'; for (let i = 0; i < 3; i++) ctx.fillRect(X + 50, Y + 32 + i * 5, 24 - i * 6, 1);
        }
        // the door, swinging open
        const open = state === 'open' ? Math.min(1, t / 30) : 1;
        const dw = Math.round(W * (1 - open) + 16 * open);
        ctx.fillStyle = '#6a7490'; ctx.fillRect(X - 6, Y - 6, dw, H + 12);
        ctx.fillStyle = '#8890a8';
        if (dw > 30) for (let i = 0; i < 4; i++) ctx.fillRect(X + 8, Y + 8 + i * 6, dw - 24, 2);
        if (state === 'look') sayBox('Something is tucked on the top shelf.', 'Space: take it   Esc: close');
        if (state === 'grab') sayBox('You reach in and grab a paper.', 'Space: read it');
      },
    };
    function sayBox(a, b) {
      box(0, SH - 48, SW, 48);
      text(a, 8, SH - 38);
      if ((tick >> 4) & 1) text(b, 8, SH - 22);
    }
    return self;
  }

  // Linda's list on old lined paper, crossed off as you go. first: just taken out.
  function LindaList(first) {
    const self = {
      update() {
        if (pressed.has('a') || pressed.has('b') || pressed.has('start')) {
          sfx('select'); remove(self);
          if (first) say('It\'s signed "Linda". You fold it into your pocket. (Read it again any time from the Start menu.)');
        }
      },
      draw() {
        ctx.fillStyle = col.dark; ctx.fillRect(0, 0, SW, SH);
        const X = 30, Y = 6, W = 260, H = 214, INK = '#2a3a8a';
        ctx.fillStyle = '#c8bc98'; ctx.fillRect(X + 3, Y + 3, W, H);
        ctx.fillStyle = '#f4ecd0'; ctx.fillRect(X, Y, W, H);
        ctx.fillStyle = '#b8d0e8'; for (let y = Y + 40; y < Y + H - 8; y += 20) ctx.fillRect(X + 4, y + 11, W - 8, 1);
        ctx.fillStyle = '#e8a0a0'; ctx.fillRect(X + 24, Y + 4, 1, H - 8);
        text('THINGS I NEVER GOT TO DO', X + 58, Y + 12, 1, '#a03030');
        ctx.fillStyle = '#a03030'; ctx.fillRect(X + 58, Y + 21, 143, 1);
        quest.tasks.forEach((task, i) => {
          const y = Y + 40 + i * 20, tx = X + 34;
          // the box, ticked once done
          ctx.fillStyle = INK; ring(X + 8, y + 1, 9, 9);
          text(task.text, tx, y + 2, 1, task.done ? '#7080b0' : INK);
          if (task.done) {
            ctx.fillStyle = '#c03030';
            const w = task.text.length * 6;
            for (let k = 0; k < w; k += 2) ctx.fillRect(tx - 2 + k, y + 5 + ((k >> 1) % 3 === 1 ? 1 : 0), 2, 1);
            ctx.fillRect(X + 9, y + 5, 2, 2); ctx.fillRect(X + 11, y + 7, 2, 2); ctx.fillRect(X + 13, y + 5, 2, 2); ctx.fillRect(X + 15, y + 3, 2, 2); ctx.fillRect(X + 17, y + 1, 2, 2);
          }
        });
        const doneN = quest.tasks.filter((x) => x.done).length;
        text(doneN + '/' + quest.tasks.length + ' done', X + 34, Y + H - 18, 1, '#7080b0');
        if (quest.complete) text('Thank you. I can rest now.', X + W - 166, Y + H - 30, 1, '#c03030');
        text('- Linda', X + W - 50, Y + H - 18, 1, INK);
        text('Space: put it away', 6, SH - 14, 1, '#f8f8f8');
      },
    };
    return self;
  }

  // Your framed picture by the front entrance, once Linda's list is done.
  function EmployeeOfMonth() {
    let t = 0;
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(), month = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    const self = {
      update() { t++; if (t > 20 && (pressed.has('a') || pressed.has('b'))) { sfx('select'); remove(self); } },
      draw() {
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#d8ccb0'; for (let y = 0; y < SH; y += 8) ctx.fillRect(0, y, SW, 1);
        const head = 'EMPLOYEE OF THE MONTH';
        text(head, (SW - head.length * 12) >> 1, 10, 2, '#a07010');
        // gold frame
        const FX = 100, FY = 34, FW = 120, FH = 130;
        ctx.fillStyle = '#6a4a10'; ctx.fillRect(FX - 2, FY - 2, FW + 4, FH + 4);
        ctx.fillStyle = '#e0b030'; ctx.fillRect(FX, FY, FW, FH);
        ctx.fillStyle = '#f8e070'; ctx.fillRect(FX + 3, FY + 3, FW - 6, 2); ctx.fillRect(FX + 3, FY + 3, 2, FH - 6);
        ctx.fillStyle = '#a07010'; ctx.fillRect(FX + 8, FY + 8, FW - 16, FH - 16);
        // the photo: you, on a studio backdrop
        ctx.fillStyle = '#5878b8'; ctx.fillRect(FX + 10, FY + 10, FW - 20, FH - 20);
        ctx.fillStyle = '#6888c8'; ctx.fillRect(FX + 10, FY + 10, FW - 20, (FH - 20) >> 1);
        ctx.drawImage(sprites.down[0], FX + 12, FY + 14, 96, 96);
        // a little gold star sticker
        ctx.fillStyle = '#f8d848'; ctx.fillRect(FX + FW - 26, FY + 14, 10, 4); ctx.fillRect(FX + FW - 23, FY + 11, 4, 10);
        // nameplate
        const name = playerName || 'New Hire';
        const nw = Math.max(100, name.length * 12 + 20);
        ctx.fillStyle = '#6a4a10'; ctx.fillRect((SW - nw) / 2 - 1, 173, nw + 2, 24);
        ctx.fillStyle = '#e0b030'; ctx.fillRect((SW - nw) / 2, 174, nw, 22);
        text(name, (SW - name.length * 12) >> 1, 178, 2, '#3a2808');
        text(month, (SW - month.length * 6) >> 1, 202, 1, '#6a4a10');
        const note = 'For finishing everything on Linda\'s list.';
        text(note, (SW - note.length * 6) >> 1, 216, 1, '#6a4a10');
        if (t > 20 && (tick >> 4) & 1) text('Space', SW - 40, SH - 12, 1, '#6a4a10');
      },
    };
    return self;
  }
  // the easel by the entrance, drawn over the map once there's a picture to show
  function drawEaselAt(x, y) {
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(x + 3, y + 8, 2, 8); ctx.fillRect(x + 11, y + 8, 2, 8); ctx.fillRect(x + 7, y + 10, 2, 5);
    ctx.fillStyle = '#6a4a10'; ctx.fillRect(x + 1, y - 6, 14, 15);
    ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 2, y - 5, 12, 13);
    ctx.fillStyle = '#5878b8'; ctx.fillRect(x + 4, y - 3, 8, 9);
    ctx.drawImage(sprites.down[0], 0, 0, 16, 16, x + 4, y - 3, 8, 9);
  }

  // ---------- your name, for the picture ----------
  const NAME_MAX = 12;
  const NAME_ROWS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz'].map((r) => r.split(''))
    .concat([['-', '\'', '.', 'SPACE', 'DEL', 'OK']]);
  const nameCur = { r: 0, c: 0 };
  function nameDone() {
    if (fade) return;
    playerName = playerName.trim() || 'New Hire';
    store.set('name', playerName);
    sfx('menu');
    startFade(() => { mode = 'play'; roomName = null; curRoom = null; updateRoom(); });
  }
  function nameType(tok) {
    if (tok === 'OK') { nameDone(); return; }
    if (tok === 'DEL') { playerName = playerName.slice(0, -1); sfx('select'); return; }
    const ch = tok === 'SPACE' ? ' ' : tok;
    if (playerName.length < NAME_MAX) { playerName += ch; sfx('blip'); } else sfx('bump');
  }
  // physical keyboard: type straight into the name
  function nameKey(e) {
    if (e.code === 'Enter') { if (!e.repeat) nameDone(); return true; }
    if (e.code === 'Backspace') { nameType('DEL'); return true; }
    if (e.key && e.key.length === 1 && /[A-Za-z0-9 .'\-]/.test(e.key)) { nameType(e.key === ' ' ? 'SPACE' : e.key); return true; }
    return false;
  }
  function updateName() {
    const row = () => NAME_ROWS[nameCur.r];
    if (pressed.has('up')) { nameCur.r = (nameCur.r + NAME_ROWS.length - 1) % NAME_ROWS.length; nameCur.c = Math.min(nameCur.c, row().length - 1); sfx('select'); }
    if (pressed.has('down')) { nameCur.r = (nameCur.r + 1) % NAME_ROWS.length; nameCur.c = Math.min(nameCur.c, row().length - 1); sfx('select'); }
    if (pressed.has('left')) { nameCur.c = (nameCur.c + row().length - 1) % row().length; sfx('select'); }
    if (pressed.has('right')) { nameCur.c = (nameCur.c + 1) % row().length; sfx('select'); }
    if (pressed.has('a')) nameType(row()[nameCur.c]);
    if (pressed.has('b')) nameType('DEL');
    if (pressed.has('start')) nameDone();
  }
  function drawName() {
    ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = col.dark; ring(4, 4, SW - 8, SH - 8); ring(6, 6, SW - 12, SH - 12);
    const title = 'What\'s your name?';
    text(title, (SW - title.length * 12) >> 1, 18, 2);
    ctx.drawImage(sprites.down[[1, 0, 2, 0][(tick >> 3) & 3]], 24, 42, 48, 48);
    // the name field
    ctx.fillStyle = col.dark; ctx.fillRect(84, 52, 206, 28);
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(86, 54, 202, 24);
    text(playerName, 92, 58, 2);
    if ((tick >> 4) & 1) { ctx.fillStyle = col.dark; ctx.fillRect(92 + playerName.length * 12, 58, 2, 16); }
    // letters to pick with the arrows (for touch screens)
    NAME_ROWS.forEach((row, r) => {
      const last = r === NAME_ROWS.length - 1;
      row.forEach((tok, c) => {
        const x = last ? 34 + c * 44 : 34 + c * 20, y = 100 + r * 18;
        const sel = nameCur.r === r && nameCur.c === c;
        if (sel) { ctx.fillStyle = col.dark; ctx.fillRect(x - 4, y - 4, tok.length * 6 + 7, 15); }
        text(tok, x, y, 1, sel ? col.light : col.dark);
      });
    });
    if (isTouch) {
      text('Pick letters with the D-pad + A,', (SW - 32 * 6) >> 1, SH - 34);
      text('then choose OK (or press START)', (SW - 31 * 6) >> 1, SH - 22);
    } else {
      text('Type your name, then press Enter', (SW - 32 * 6) >> 1, SH - 34);
      text('(or pick letters with the arrows + A)', (SW - 37 * 6) >> 1, SH - 22);
    }
  }

  // ---------- flavour text ----------
  const INFO = {
    d: ['A desk buried in sticky notes.', 'A tidy desk. Suspiciously tidy.', 'Someone left a half-finished coffee here.'],
    c: ['An office chair. It spins!'],
    p: ['A potted plant. Someone waters it every Monday.'],
    b: ['Binders, manuals and old catalogues.'],
    k: ['A clean countertop.'],
    M: ['A humming machine. Better not touch it.'],
    n: ['A sink. The water is freezing!'],
    w: ['It\'s a toilet. Nothing to see here.'],
    T: ['A big table. Good for meetings.'],
    z: ['A server rack. The fans are roaring.', 'Rows of blinking lights. Something is definitely computing.'],
    y: ['A rack of computers crunching numbers.'],
    t: ['Cookie monster champion!'],
    u: ['A stretcher, freshly made up. Hopefully nobody needs it today.'],
    l: ['A sturdy railing. Watch your step!'],
    g: ['Shelves stocked with chips, granola bars and pop. Snack heaven!'],
    W: ['A washing machine. Someone left their gym towels in it.'],
    O: ['A dryer. Still warm.'],
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
    L: ['A cooling coil. Cold air is blowing off it.'],
    Q: ['A TV for video calls. The remote is missing.'],
    U: ['Cupboards stocked with paper, pens and sticky notes.', 'Boxes of staples, binder clips and printer paper.'],
    Y: ['A printer. It\'s out of toner. Again.', 'The printer is warming up...'],
  };

  // ---------- player / world ----------
  const S0 = MAPS.start;
  const P = { floor: S0.floor, x: S0.x, y: S0.y, dir: S0.dir, moving: false, prog: 0, mdx: 0, mdy: 0, step: 0, turnWait: 0, walked: false, bump: 0 };
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
    return WALKABLE.includes(t) || (t === 'C' && curtainOpen === fi) || (t === '$' && !(quest && quest.complete));
  }

  function tryMove(d) {
    const [dx, dy] = DIRS[d];
    const blocked = genderBlock(P.x + dx, P.y + dy, dx, dy);
    if (blocked) { P.walked = false; say(blocked); return; }
    if (walkable(P.floor, P.x + dx, P.y + dy) && !npcAt(P.floor, P.x + dx, P.y + dy)) {
      Object.assign(P, { moving: true, prog: 0, mdx: dx, mdy: dy, bump: 0 });
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
      // Everyone speaks as "Name: ...", including the offers below and whatever
      // they say when you turn them down, so you always know who is talking.
      const says = (line) => npc.name + ': ' + line;
      if (npc.name === 'Damir') {
        say(says('Do you feel safe in the dark?'), () => ui.push(DarkGame()));
        return;
      }
      // name: [what they offer, yes label, the game, what they say if you decline, no label]
      const OFFERS = {
        Nathan: ['Have you seen all of my trophies? Go on, grab one.', 'GRAB ONE', NathanGame, 'Your loss. They are lovely.'],
        Wade: ['Fancy a quick three holes?', 'YOU ARE ON', WadeGolfGame, 'Another time, then.'],
        Kiki: ['Bet you cannot guess how many sweets are in that jar.', 'TAKE THE BET', CandyJarGame, 'Offer stands all week!'],
        Jhonna: ['Have you done your Manulife dependant forms?', 'DO THEM NOW', FormsGame, 'They are not going to fill themselves in.', 'NOT YET'],
        Richard: ['Do you want to test your air handling knowledge?', 'YES', BattleGame, 'Come back when you are ready.', 'NO'],
      };
      if (OFFERS[npc.name]) {
        const [msg, yes, Game, no, noLabel] = OFFERS[npc.name];
        ask(says(msg), [yes, noLabel || 'NO THANKS'], (i) => {
          if (i === 0) { sfx('menu'); ui.push(Game()); } else say(says(no));
        });
        return;
      }
      if (npc.ghost) {
        // Linda, and how she feels about her list
        const lines = quest && quest.complete ? LINDA_THANKS
          : quest ? LINDA_WAITING : npc.lines.concat(['Ooooo... I left something in the gym lockers...']);
        say(says(lines[Math.floor(Math.random() * lines.length)]));
        return;
      }
      say(says(npc.lines[Math.floor(Math.random() * npc.lines.length)]));
      return;
    }
    if (t === 'N' && curRoom && curRoom.name === 'Fitness Room') {
      sfx('select');
      if (!quest) ask('A row of lockers. One of them is open just a crack...', ['OPEN IT', 'LEAVE IT'], (i) => {
        if (i === 0) { sfx('menu'); ui.push(LockerScreen()); }
      });
      else say(quest.complete ? 'The locker is empty now. It feels warmer in here than it used to.'
        : 'Just a gym bag, some old sneakers and a faint chill.');
      return;
    }
    if (t === '$' && quest && quest.complete) { sfx('menu'); ui.push(EmployeeOfMonth()); return; }
    if (t === 'E') {
      const ends = findLink(P.floor, tx, ty);
      const names = MAPS.floors.map((f, i) => (i === 0 ? 'GROUND' : i + 1 + 'F'));
      sfx('select');
      ask('The elevator. Which floor?', names.concat(['CANCEL']), (i) => {
        if (i < 0 || i >= names.length) return;
        if (i === P.floor) { say('You\'re already on this floor.'); return; }
        sfx('ding');
        const from = P.floor, go = () => warpTo(ends.find((e) => e.floor === i));
        // every ride, somebody gets in with you
        const pool = npcs.filter((n) => !n.ghost);
        if (pool.length) {
          ui.push(ElevatorGame(pool[Math.floor(Math.random() * pool.length)], from, i, go));
        } else go();
      });
      return;
    }
    if (t === 'm' || t === 'R') {
      sfx('menu');
      // a cubicle sits inside its open office, so ask every room here for a program
      const room = MAPS.floors[P.floor].rooms.find((r) => r.computer && tx >= r.x1 && tx <= r.x2 && ty >= r.y1 && ty <= r.y2);
      ui.push(ComputerScreen(room && room.computer));
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
      i: ['Wade\'s putting green. He practises between meetings.', 'PLAY GOLF', GolfGame],
      A: ['A squat rack loaded with heavy plates.', 'LIFT IT', SquatGame],
      q: ['A treadmill. Maybe after work...', 'GO FOR A RUN', RunGame],
      V: ['A big TV. Someone left the news on.', 'PLAY PONG', PongGame],
      v: ['A recycling bin. Crumpled paper everywhere around it...', 'CLEAN UP', TossGame],
      x: ['The photocopier blinks: PC LOAD LETTER', 'MAKE COPIES', StackGame],
      K: ['An electrical control panel full of blinking lights.', 'PRESS BUTTONS', SimonGame],
      f: ['A fridge. One lunch is labelled DO NOT EAT.', 'FIND MY LUNCH', LunchGame],
      Z: ['A table full of candy! Nobody is watching...', 'SNEAK ONE', CandyGame],
      F: ['A big air handling fan. It hums loudly.', 'BALANCE IT', FanGame],
      L: ['A cooling coil. Cold air is blowing off it.', 'WATCH THE COIL', CoilGame],
      a: ['A bank of dampers feeding three rooms.', 'SET THE BLADES', DamperGame],
      U: ['A supply cupboard stacked with spare filters.', 'CHANGE FILTERS', FilterGame],
      Q: ['A big TV. This one has an old games console wired up.', 'PLAY SNAKE', SnakeGame],
      j: ['Computer parts all over the floor. Someone should sort these.', 'SORT THEM', PartsGame],
      z: ['A server rack. The patch panel is a bird\'s nest.', 'TIDY THE CABLES', CableGame],
      y: ['A rack of computers, cables everywhere.', 'TIDY THE CABLES', CableGame],
      u: ['A first aid dummy on a stretcher.', 'PRACTISE CPR', CprGame],
      s: ['The engraving machine, loaded with a blank nameplate.', 'ENGRAVE ONE', EngraveGame],
      I: ['A lat pulldown machine.', 'DO A SET', PulldownGame],
      o: ['A big exercise ball. Nobody is using it.', 'BALANCE ON IT', BallGame],
      r: ['The front desk. The visitor book is open.', 'COVER THE DESK', FrontDeskGame],
      R: ['The front desk. The visitor book is open.', 'COVER THE DESK', FrontDeskGame],
      Y: ['The printer blinks: PAPER JAM IN TRAY 2', 'CLEAR THE JAM', JamGame],
      W: ['A washer, mid-cycle. A pile of coveralls waits.', 'SORT THE WASH', LaundryGame],
      O: ['A dryer, still warm. A pile of coveralls waits.', 'SORT THE WASH', LaundryGame],
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
      P.prog += 2; // always at running pace
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
    } else if (mode === 'name') {
      updateName();
    } else if (ui.length) {
      top().update();
    } else if (questQueue.length) {
      say(questQueue.shift());
    } else {
      updatePlayer();
      updateNpcs();
    }
    if (banner && ++banner.t > 150) banner = null;
    playMusic(pickMusic());
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
      if (!playerName) playerName = store.get('name') || '';
      startFade(() => { mode = 'name'; });
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
    ctext('Arrows: choose   Space: start', SH - 24);
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
    if (quest && quest.complete)
      for (const e of easels[P.floor]) drawEaselAt(e.x * 16 - cx, e.y * 16 - cy);
    for (const k of panels[P.floor]) {
      const x = k.x * 16 - cx, y = k.y * 16 - cy;
      if (x < -16 || x > SW || y < -16 || y > SH) continue;
      PANEL_LIGHTS.forEach((c, i) => {
        // each light blinks at its own pace, offset per panel so they don't sync up
        if (((tick >> 4) * (i + 1) + k.x * 7 + k.y * 13 + i * 5) % 3 === 0) return;
        ctx.fillStyle = c; ctx.fillRect(x + 4 + i * 3, y + 3, 2, 2);
      });
    }
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
    for (const r of MAPS.floors[P.floor].rooms) if (r.rave) drawRave(r, cx, cy);
  }

  // Party lights: dim the room, light the floor tiles up in colour and sweep spotlights
  // around, all on the beat of the rave song (or a steady 140bpm with the music off).
  const RAVE_COLS = ['#ff2a6d', '#05d9e8', '#f9f871', '#7b2ff7', '#39ff14', '#ff8c00'];
  function drawRave(r, cx, cy) {
    const x0 = r.x1 * 16 - cx, y0 = r.y1 * 16 - cy - 4;
    const w = (r.x2 - r.x1 + 1) * 16, h = (r.y2 - r.y1 + 1) * 16 + 4;
    if (x0 > SW || y0 > SH || x0 + w < 0 || y0 + h < 0) return;
    let pos = musicPos('rave');
    if (pos === null) pos = tick / 12.86;
    const step = Math.floor(pos), frac = pos - step, beat = step >> 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(12, 0, 32, 0.6)';
    ctx.fillRect(x0, y0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    // disco floor: every other tile glows, the pattern shifting each beat
    ctx.globalAlpha = 0.22;
    for (let ty = r.y1; ty <= r.y2; ty++)
      for (let tx = r.x1; tx <= r.x2; tx++) {
        if ((tx + ty + beat) & 1) continue;
        ctx.fillStyle = RAVE_COLS[(tx * 3 + ty * 5 + beat) % RAVE_COLS.length];
        ctx.fillRect(tx * 16 - cx, ty * 16 - cy, 16, 16);
      }
    // spotlights swinging around the room
    for (let i = 0; i < 3; i++) {
      const t = pos / 4 + i * 2.1;
      const sx = x0 + w / 2 + Math.sin(t * 1.3 + i) * w * 0.38;
      const sy = y0 + h / 2 + Math.cos(t * 0.9 + i * 2) * h * 0.36;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = RAVE_COLS[(beat + i * 2) % RAVE_COLS.length];
      ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();
    }
    // strobe: a quick white flash on every kick
    if ((step & 1) === 0 && frac < 0.35) {
      ctx.globalAlpha = 0.4 * (1 - frac / 0.35);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0, y0, w, h);
    }
    ctx.restore();
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
    // when this version was published (set by the loader in index.html), so you can
    // tell whether your phone has the latest
    if (window.GAME_VERSION) {
      const d = window.GAME_VERSION, pad = (n) => String(n).padStart(2, '0');
      const v = 'Updated ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      text(v, (SW - v.length * 6) >> 1, SH - 20, 1, '#8890a0');
    }
  }

  function draw() {
    ctx.fillStyle = col.dark;
    ctx.fillRect(0, 0, SW, SH);
    if (mode === 'title') drawTitle();
    else if (mode === 'select') drawSelect();
    else if (mode === 'name') drawName();
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

  // Testing shortcut: index.html#play&f=1&x=40&y=20&char=female:2 (add &game=punch|run|pong|toss|stack|simon|lunch|candy|squat|golf|dark|coffee|battle|fan|coil|damper|filter|snake|parts|cable|cpr|engrave|pulldown|ball|desk|jam|laundry|forms|nathan|wade|jar|poker|blackjack, or locker|list|eotm with &quest=)
  if (location.hash.startsWith('#play')) {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.has('f')) P.floor = +q.get('f');
    if (q.has('x')) { P.x = +q.get('x'); P.y = +q.get('y'); }
    if (q.has('char')) { const [g, i] = q.get('char').split(':'); pick.gender = g; sprites = charSprites[g][+i || 0]; }
    if (q.has('dir')) P.dir = q.get('dir');
    mode = q.has('title') ? 'title' : q.has('select') ? 'select' : q.has('naming') ? 'name' : 'play';
    updateRoom();
    if (q.has('say')) ask('The elevator. Which floor?', ['GROUND', '2F', 'CANCEL'], () => {});
    if (q.has('menu')) openStartMenu();
    if (q.has('map')) ui.push(MapView());
    // &name=Sam sets your name; &quest=1 hands you Linda's list, &quest=done finishes it
    if (q.has('name')) playerName = q.get('name');
    if (q.has('quest')) {
      startQuest();
      if (q.get('quest') === 'done') { quest.tasks.forEach((x) => { x.done = true; }); quest.complete = true; }
      else quest.tasks.slice(0, +q.get('quest') - 1).forEach((x) => { x.done = true; });
    }
    const GAME = { coffee: CoffeeGame, punch: PunchGame, run: RunGame, pong: PongGame, toss: TossGame, stack: StackGame, simon: SimonGame, lunch: LunchGame, candy: CandyGame, squat: SquatGame, golf: GolfGame, dark: DarkGame, battle: BattleGame,
      fan: FanGame, coil: CoilGame, damper: DamperGame, filter: FilterGame,
      snake: SnakeGame, parts: PartsGame, cable: CableGame, cpr: CprGame,
      engrave: EngraveGame, pulldown: PulldownGame, ball: BallGame,
      desk: FrontDeskGame, jam: JamGame, laundry: LaundryGame, forms: FormsGame,
      nathan: NathanGame, wade: WadeGolfGame, jar: CandyJarGame, poker: PokerApp, blackjack: BlackjackApp,
      locker: LockerScreen, list: LindaList, eotm: EmployeeOfMonth }[q.get('game')];
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
  window.GAME = { P, MAPS, warpTo, npcs, questNote, get quest() { return quest; } };
})();
