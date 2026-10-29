(function () {
  // View: 20 x 15 tiles of 16px.
  const SW = 320, SH = 240;
  const MAPS = window.OFFICE_MAPS;
  const WALKABLE = '.,:_;DSj-';
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
  // The online leaderboards' database: the web address of a Firebase Realtime Database
  // (see "Leaderboards" in the README). Left empty, scores stay in this browser only.
  const BOARD_URL = 'https://haakonlife-d4ef2-default-rtdb.firebaseio.com';
  // Scores are only sent from the hosted copy (haakonlife.com), so
  // playing a local copy (opening index.html straight from the folder) can't post test
  // scores. Locally the boards still load; your score just isn't added.
  const BOARD_POSTS = /(^|\.)haakonlife\.com$/.test(location.hostname);

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
  // Kiki has given you the award; until then the spot is plain floor.
  const easels = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === '$') list.push({ x, y }); }));
    return list;
  });

  // The visitor office portal ('@' tile) gets a swirl of light drawn over it.
  const portals = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === '@') list.push({ x, y }); }));
    return list;
  });

  // Electrical panels ('K' tiles) get blinking status lights drawn over them.
  const panels = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === 'K') list.push({ x, y }); }));
    return list;
  });
  const PANEL_LIGHTS = ['#58e048', '#f05040', '#f0b030'];

  // The Hall of Fame board in reception ('*' tiles): the crown on its top tile glints now and then.
  const fameCrowns = MAPS.floors.map((f) => {
    const list = [];
    f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === '*' && (f.tiles[y - 1] || '')[x] !== '*') list.push({ x, y }); }));
    return list;
  });

  // The Kingston plant: a map of its own (see tools/build_maps.py) that you only get to
  // by answering Eugene's phone, and leave from the start menu.
  const PLANT = MAPS.floors.findIndex((f) => f.plant);
  // Cody's casino: his cubicle is bigger on the inside. It's a map of its own, lined up
  // tile for tile with the floor it opens off (CASINO_AT), so walking into his cubicle
  // puts you in the same spot in the casino, and walking back out of its doorway puts
  // you back in the office (see onArrive).
  const CASINO = MAPS.floors.findIndex((f) => f.casino);
  const CASINO_AT = CASINO >= 0 ? MAPS.floors[CASINO].casino : null;
  // the floor someone on floor f shows up on, on the map
  const mapFloor = (f) => (f === CASINO ? CASINO_AT.floor : f);
  // The desk phones ('!' tiles). They ring the whole time, except while you're on one.
  // Eugene's sends you to the plant; the one on the plant's reception desk calls you back.
  const phones = [];
  MAPS.floors.forEach((f, fi) => f.tiles.forEach((r, y) => {
    const x = r.indexOf('!');
    if (x >= 0) phones.push({ floor: fi, x, y, ringing: true });
  }));
  const phone = phones.find((p) => p.floor !== PLANT) || null;
  const plantPhone = phones.find((p) => p.floor === PLANT) || null;
  // the phone on the floor you're on, if there is one
  const phoneHere = () => phones.find((p) => p.floor === P.floor) || null;

  // Halloween: all through October there's a costume to pick after your name and a party
  // waiting in the downstairs boardroom (see "Halloween" further down). Adding
  // &halloween=1 (or =0) to a #play link forces it on (or off) for testing.
  const hw = (function () {
    const state = { floor: -1, room: null, doors: [], props: [], costume: store.get('costume'), worn: false, state: 'idle', guests: [], back: null };
    MAPS.floors.forEach((f, fi) => {
      const room = !state.room && f.rooms.find((r) => /^Boardroom/.test(r.name));
      if (!room) return;
      // party games that stand on the floor: the apple tub and the toilet rolls
      Object.assign(state, { floor: fi, room, props: [{ kind: 'bucket', x: room.x1 + 1, y: room.y2 - 2 }, { kind: 'rolls', x: room.x1 + 1, y: room.y1 + 2 }] });
      for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
        for (let x = room.x1 - 1; x <= room.x2 + 1; x++)
          if ((f.tiles[y] || '')[x] === 'D') state.doors.push({ x, y });
    });
    return state;
  })();
  const HALLOWEEN = !!hw.room && (function () {
    const m = /[#&]halloween=(\d)/.exec(location.hash);
    return m ? m[1] !== '0' : new Date().getMonth() === 9;
  })();

  // ---------- NPCs: one per person, pacing around their own office ----------
  // Everything a person says is shown as "Name: ...", so these no longer introduce
  // themselves. {n} still works if you want to use a name mid-sentence.
  const NPC_LINES = [
    "Hi there!",
    "Oh, hey! Welcome to the office.",
    "Busy day today!",
    "Have you tried the candy at reception?",
    "Morning! Or afternoon. I have lost track.",
    "Is it Friday yet?",
    "I'd chat, but I have a meeting in five minutes.",
    "Did someone turn the thermostat down again? It's freezing in here.",
    "Have you seen the new parts upstairs?",
  ];
  const NOT_PEOPLE = ['Meeting Room', 'First Aid Station', 'Ansys Station', 'Reception', 'Engraver'];
  const NPC_FLOOR = '.,:_;j-';
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const npcs = [];
  const dogs = []; // the office dogs, from js/people.js
  // Someone's body type and colours: from js/people.js, with a random-but-stable
  // look filling in anything they don't set.
  function lookOf(p, name) {
    const body = ['female', 'ghost'].includes(p.body) ? p.body : 'male';
    const looks = Art.LOOKS[body] || Art.LOOKS.male;
    const def = looks[hash(name) % looks.length];
    return { body, look: { h: p.hair || def.h, s: p.skin || def.s, w: p.top || def.w, u: p.accent || def.u, K: p.pants || def.K } };
  }
  const personOf = (name) => (window.PEOPLE || {})[name] || (window.PLANT_CREW || {})[name] || {};
  function lookFor(name) {
    return lookOf(personOf(name), name);
  }
  // The sprite sheet for a person, reusing the one their NPC already has.
  function spritesFor(name) {
    const n = npcs.find((p) => p.name === name);
    if (n) return n.sprites;
    const { body, look } = lookFor(name);
    return Art.renderSprites(body, look);
  }
  function npcAt(fi, x, y) {
    const at = (n) => n.floor === fi && ((n.x === x && n.y === y) || (n.moving && n.x + n.mdx === x && n.y + n.mdy === y));
    return npcs.find(at) || dogs.find(at) || null;
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
          const p = personOf(name);
          const { body, look } = lookFor(name);
          const [x, y] = spots[(hash(name) + npcs.length * 7) % spots.length];
          npcs.push({
            name: p.name || name, floor: fi, room: area, x, y, dir: 'down', moving: false, prog: 0, mdx: 0, mdy: 0, step: 0,
            wait: 30 + ((hash(name) + npcs.length * 37) % 120), sprites: Art.renderSprites(body, look),
            // extra: the plant crew, and the dealers in Cody's casino (who are in the office too),
            // so they're left out wherever the game picks one of your coworkers
            ghost: body === 'ghost', extra: fi === PLANT || fi === CASINO,
            lines: room.lines || (p.lines && p.lines.length ? p.lines : [NPC_LINES[hash(name) % NPC_LINES.length].replace('{n}', name)]),
          });
        }
      }
    });
  })();

  // ---------- the visitor office: visitors take turns, coming and going by portal ----------
  // Everyone in VISITORS (js/people.js) gets a spell in the office. When their time is
  // up they walk into the portal in the corner and the next one steps out of it.
  const VISIT_TICKS = 1800; // how long each one stays: about 30 seconds of walking around
  const visit = (function () {
    const list = window.VISITORS || [];
    for (let fi = 0; fi < MAPS.floors.length; fi++) {
      const room = MAPS.floors[fi].rooms.find((r) => /^\d+ Visitor$/.test(r.name));
      const npc = room && npcs.find((n) => n.floor === fi && n.room === room);
      const inRoom = (k) => k.x >= room.x1 && k.x <= room.x2 && k.y >= room.y1 && k.y <= room.y2;
      const gate = npc && portals[fi].find(inRoom);
      if (!gate || list.length < 2) continue;
      // they step out of the portal onto the floor tile next to it
      const side = Object.values(DIRS).map(([dx, dy]) => ({ x: gate.x + dx, y: gate.y + dy }))
        .find((k) => inRoom(k) && NPC_FLOOR.includes(tileAt(fi, k.x, k.y)));
      if (!side) continue;
      return { npc, room, gate, side, list, i: 0, t: VISIT_TICKS, phase: 'stay', a: 1, stuck: 0, sheets: [npc.sprites] };
    }
    return null;
  })();
  function setVisitor(i) {
    const v = visit.list[i], n = visit.npc;
    if (!visit.sheets[i]) {
      const { body, look } = lookOf(v, v.name);
      visit.sheets[i] = Art.renderSprites(body, look);
    }
    visit.i = i;
    Object.assign(n, { name: v.name, sprites: visit.sheets[i], lines: v.lines && v.lines.length ? v.lines : n.lines });
  }
  // Which way the visitor should step to get to (tx, ty), around the furniture and
  // anyone in the way; null if there's no way through right now.
  function visitStep(tx, ty) {
    const n = visit.npc, r = visit.room, key = (x, y) => x + ',' + y;
    const seen = new Set([key(n.x, n.y)]), queue = [[n.x, n.y, null]];
    while (queue.length) {
      const [x, y, first] = queue.shift();
      if (x === tx && y === ty) return first;
      for (const d in DIRS) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < r.x1 || nx > r.x2 || ny < r.y1 || ny > r.y2 || seen.has(key(nx, ny))) continue;
        if (!NPC_FLOOR.includes(tileAt(n.floor, nx, ny)) || playerAt(nx, ny) || npcAt(n.floor, nx, ny)) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny, first || d]);
      }
    }
    return null;
  }
  function visitWalk(d) {
    const n = visit.npc;
    Object.assign(n, { dir: d, moving: true, prog: 0, mdx: DIRS[d][0], mdy: DIRS[d][1] });
    n.step ^= 1;
  }
  const dirTo = (a, b) => Object.keys(DIRS).find((d) => a.x + DIRS[d][0] === b.x && a.y + DIRS[d][1] === b.y);
  function updateVisitor() {
    if (!visit) return;
    const n = visit.npc, next = (visit.i + 1) % visit.list.length, FADE = 24;
    if (visit.phase === 'stay') {
      if (--visit.t > 0) return;
      // nobody is there to watch (or everyone is dancing): just swap them over
      if (P.floor !== n.floor || party) { setVisitor(next); visit.t = VISIT_TICKS; return; }
      if (!n.moving) { visit.phase = 'leave'; visit.stuck = 0; }
      return;
    }
    if (P.floor !== n.floor) {
      // you left halfway through a changeover: finish it off out of sight
      if (['leave', 'in', 'out', 'swap'].includes(visit.phase)) setVisitor(next);
      Object.assign(n, { x: visit.side.x, y: visit.side.y, moving: false, prog: 0 });
      Object.assign(visit, { phase: 'stay', a: 1, t: VISIT_TICKS });
      return;
    }
    if (visit.phase === 'leave') {
      if (n.moving) return;
      if (n.x === visit.side.x && n.y === visit.side.y) { visitWalk(dirTo(n, visit.gate)); visit.phase = 'in'; return; }
      const d = visitStep(visit.side.x, visit.side.y);
      if (d) { visitWalk(d); visit.stuck = 0; }
      else if (++visit.stuck > 300) visit.phase = 'out'; // boxed in: vanish from where they stand
    } else if (visit.phase === 'in') {
      // fading away as they step into the portal
      visit.a = n.moving ? 1 - n.prog / 16 : 0;
      if (!n.moving) { visit.phase = 'swap'; visit.t = 40; }
    } else if (visit.phase === 'out') {
      visit.a = Math.max(0, visit.a - 1 / FADE);
      if (visit.a === 0) { Object.assign(n, { x: visit.gate.x, y: visit.gate.y }); visit.phase = 'swap'; visit.t = 40; }
    } else if (visit.phase === 'swap') {
      if (--visit.t > 0) return;
      setVisitor(next);
      n.dir = dirTo(visit.gate, visit.side);
      visit.phase = 'arrive';
      if (Math.abs(P.x - n.x) < 12 && Math.abs(P.y - n.y) < 9) sfx('ding');
    } else if (visit.phase === 'arrive') {
      visit.a = Math.min(1, visit.a + 1 / FADE);
      // wait in the portal until there's room to step out
      if (visit.a < 1 || playerAt(visit.side.x, visit.side.y) || npcAt(n.floor, visit.side.x, visit.side.y)) return;
      visitWalk(n.dir);
      visit.phase = 'exit';
    } else if (!n.moving) {
      Object.assign(visit, { phase: 'stay', t: VISIT_TICKS });
      n.wait = 60;
    }
  }

  // Each office dog roams the area around its owner's office: in and out of the office
  // itself, and the hallway and neighbours within a few steps of it.
  const DOG_ROAM = 5;
  (function spawnDogs() {
    const S = MAPS.start, DOGS = window.DOGS || {};
    for (const name in DOGS) {
      const d = DOGS[name], owner = npcs.find((p) => p.name === d.owner);
      if (!owner) continue;
      const fi = owner.floor, t = MAPS.floors[fi].tiles, r = owner.room;
      const room = { x1: Math.max(0, r.x1 - DOG_ROAM), y1: Math.max(0, r.y1 - DOG_ROAM),
        x2: Math.min(t[0].length - 1, r.x2 + DOG_ROAM), y2: Math.min(t.length - 1, r.y2 + DOG_ROAM) };
      const spots = [];
      for (let y = room.y1; y <= room.y2; y++)
        for (let x = room.x1; x <= room.x2; x++)
          if (NPC_FLOOR.includes(t[y][x]) && !npcAt(fi, x, y) && !(fi === S.floor && x === S.x && y === S.y)) spots.push([x, y]);
      if (!spots.length) continue;
      // a cat takes the spot nearest the middle of the office and stays there
      const mx = (r.x1 + r.x2) / 2, my = (r.y1 + r.y2) / 2, dist = ([x, y]) => (x - mx) ** 2 + (y - my) ** 2;
      const [x, y] = d.cat ? spots.reduce((a, b) => (dist(b) < dist(a) ? b : a))
        : spots[Math.floor(Math.random() * spots.length)];
      dogs.push({
        name, dog: d, floor: fi, room,
        x, y, dir: 'down', moving: false, prog: 0, mdx: 0, mdy: 0, step: 0, wait: d.cat ? Infinity : 20 + Math.floor(Math.random() * 90),
        sprites: Art.renderDog({ h: d.coat, D: d.ears, y: d.chest, u: d.collar, cat: d.cat }),
      });
    }
  })();

  function updateNpcs() {
    updateVisitor();
    for (const n of npcs.concat(dogs)) {
      if (n.floor !== P.floor) continue;
      if (n.moving) {
        if (++n.prog >= 16) { n.x += n.mdx; n.y += n.mdy; n.moving = false; n.prog = 0; }
        continue;
      }
      if (visit && n === visit.npc && visit.phase !== 'stay') continue; // on their way to or from the portal
      if (--n.wait > 0) continue;
      n.wait = n.dog ? 10 + Math.floor(Math.random() * 70) : 40 + Math.floor(Math.random() * 140);
      n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      if (Math.random() < 0.25) continue; // sometimes just look around
      const [dx, dy] = DIRS[n.dir], tx = n.x + dx, ty = n.y + dy, r = n.room;
      if (tx < r.x1 || tx > r.x2 || ty < r.y1 || ty > r.y2) continue;
      // dogs can trot through doorways too
      const tt = tileAt(n.floor, tx, ty);
      if (!(NPC_FLOOR.includes(tt) || (n.dog && tt === 'D' && !doorShut(n.floor, tx, ty))) || npcAt(n.floor, tx, ty) || playerAt(tx, ty) || propAt(n.floor, tx, ty)) continue;
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
    sizzle: () => { noise(0.3, 3200, 0.07); noise(0.15, 1200, 0.04); },
    chop: () => { noise(0.05, 500, 0.12); tone(160, 0.06, 'square', 0.05, -80); },
    bark: (small) => {
      const f = small ? 880 : 380;
      tone(f, 0.07, 'square', 0.06, -f * 0.4); noise(0.05, f * 2, 0.05);
      tone(f * 1.05, 0.09, 'square', 0.06, -f * 0.45, 0.13);
    },
    meow: () => { tone(620, 0.12, 'triangle', 0.07, 260); tone(880, 0.35, 'triangle', 0.07, -420, 0.12); },
    swish: () => { noise(0.25, 2200, 0.06); tone(600, 0.15, 'triangle', 0.05, 500, 0.1); },
    // an old desk phone's trill, quieter from out in the hallway
    ring: (vol) => { for (let i = 0; i < 10; i++) tone(i & 1 ? 1180 : 940, 0.04, 'square', 0.035 * (vol || 1), 0, i * 0.04); },
    pickup: () => { tone(160, 0.05, 'square', 0.06); noise(0.05, 1400, 0.05); },
    // somebody shouting down the line
    caller: () => { tone(520, 0.06, 'square', 0.03, 140); tone(620, 0.06, 'square', 0.03, -160, 0.08); tone(480, 0.09, 'square', 0.03, 90, 0.16); },
    thump: () => { tone(70, 0.12, 'sine', 0.14, -30); tone(62, 0.1, 'sine', 0.11, -25, 0.16); },
    beep: () => tone(1480, 0.09, 'square', 0.03), // a forklift backing up
    spray: () => noise(0.09, 5200, 0.03), // a spray gun's hiss
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
    if (mode === 'play' && hw.state === 'party') return 'halloween';
    if (mode === 'play' && curRoom && ((curRoom.name === 'Haunted Office' && !lindaFree) || curRoom.dark)) return 'spooky';
    if (mode === 'play' && curRoom && curRoom.rave) return 'rave';
    if (mode === 'play' && P.floor !== PLANT && inPhoneRoom()) return null; // nothing but the phone ringing in Eugene's office
    if (mode === 'play' && P.floor === PLANT) return 'plant';
    if (mode === 'play' && P.floor === CASINO) return 'poker';
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
    // the same for a box you type into (it has key())
    const typing = top();
    if (typing && typing.key && !fade && (typing.key(e) || !e.code.startsWith('Arrow'))) { e.preventDefault(); return; }
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
      if (Math.hypot(dx, dy) < r.width * 0.06) return cur; // a small dead spot in the middle
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
  // iOS Safari ignores user-scalable=no and touch-action on the page, so a quick double tap
  // (say on the d-pad) zooms in and there's no way back out. The controls all run on pointer
  // events, so cancelling the touch defaults costs nothing and stops the zoom.
  document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());

  // ---------- drawing helpers ----------
  // Keyboard hints -> touch button hints ("Space: punch" -> "A: punch", "Esc: give up" ->
  // "B: give up", "Arrows: steer" -> "D-pad: steer"). Only hint-shaped text is touched,
  // so an SDG "Space" component or a printout stays as it is.
  const TOUCH_HINTS = [
    // (no lookbehind for "Hold Space": Safari before iOS 16.4 can't parse one, and the
    // whole game would fail to load)
    [/\bSpace(?=:| twice| to )/g, 'A'],
    [/(Hold|Mash|Press|\+|then) Space\b/g, '$1 A'],
    [/\bEsc(?=:)/g, 'B'],
    [/\bEnter(?=:)/g, 'START'],
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
      overlay: true,
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
      options, overlay: true,
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
    const here = mapFloor(P.floor);
    let fi = here;
    // the office floors flip between each other; the plant is a map on its own
    const floors = MAPS.floors.map((f, i) => i).filter((i) => i !== CASINO && (i === PLANT) === (here === PLANT));
    const self = {
      update() {
        if (floors.length > 1 && (pressed.has('left') || pressed.has('right') || pressed.has('up') || pressed.has('down'))) {
          fi = floors[(floors.indexOf(fi) + 1) % floors.length]; sfx('select');
        }
        if (pressed.has('a') || pressed.has('b') || pressed.has('start') || pressed.has('map')) { sfx('select'); remove(self); }
      },
      draw() {
        box(0, 0, SW, SH);
        const name = MAPS.floors[fi].name.toUpperCase();
        text(name, (SW - name.length * 6) >> 1, 12);
        const m = miniCanvas[fi], k = Math.max(1, Math.min(Math.floor((SW - 16) / m.width), Math.floor(150 / m.height)));
        const mx = (SW - m.width * k) >> 1, my = 30;
        ctx.drawImage(m, mx, my, m.width * k, m.height * k);
        // everyone else playing, in red
        ctx.fillStyle = '#d83040';
        for (const o of mpHere()) if (mapFloor(o.f) === fi) ctx.fillRect(mx + o.x * k - 1, my + o.y * k - 1, k + 2, k + 2);
        if (fi === here && (tick >> 3) & 1) {
          ctx.fillStyle = col.dark;
          ctx.fillRect(mx + P.x * k - 1, my + P.y * k - 1, k + 2, k + 2);
        }
        const r = fi === here ? roomAt(P.floor, P.x, P.y) : null;
        const ty = my + m.height * k + 12;
        text(r ? r.name : fi !== here ? '' : fi === PLANT ? 'Plant floor' : 'Hallway', 10, ty);
        if (floors.length > 1) text('Arrows: other floor', 10, ty + 20);
        text('Esc: close', 10, ty + (floors.length > 1 ? 34 : 20));
      },
    };
    return self;
  }

  // ---------- office computers: a desktop with one program on it ----------
  // Most computers run SDG; a room with a 'computer' option (see tools/build_maps.py)
  // runs that program instead.
  const sdgIcon = new Image();
  sdgIcon.onload = () => { if (hw.worn) wearCostume(hw.costume); if (mode === 'costume') openCostumes(); }; // the SDG Sign costume wears the logo
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
  // Little spring rolls flying across the table when money moves (poker and blackjack):
  // n rolls a few frames apart, each on a low arc from (x0, y0) to near (x1, y1).
  // Call update() every frame and draw() over the table.
  function RollFlyer() {
    const TIME = 20;
    let flying = [];
    return {
      send(x0, y0, x1, y1, n) {
        for (let i = 0; i < n; i++)
          flying.push({ x0, y0, x1: x1 + Math.round(Math.random() * 30 - 15), y1: y1 + Math.round(Math.random() * 6 - 3), t: -i * 4 });
      },
      update() { flying = flying.filter((f) => ++f.t < TIME); },
      draw() {
        for (const f of flying) {
          if (f.t < 0) continue;
          const k = f.t / TIME, e = 1 - (1 - k) * (1 - k); // ease out
          drawRoll(Math.round(f.x0 + (f.x1 - f.x0) * e), Math.round(f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * k) * 14));
        }
      },
    };
  }
  // a generic profile picture: a grey head and shoulders on a coloured square
  function drawAvatar(x, y, bg) {
    ctx.fillStyle = '#181820'; ctx.fillRect(x, y, 24, 24);
    ctx.fillStyle = bg; ctx.fillRect(x + 1, y + 1, 22, 22);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(x + 9, y + 4, 6, 10); ctx.fillRect(x + 8, y + 5, 8, 8);
    ctx.fillRect(x + 6, y + 16, 12, 7); ctx.fillRect(x + 4, y + 18, 16, 5);
  }
  // The top of a card game. On a computer it's a window with the table drawn in it; at a
  // real table in Cody's casino the felt runs right out to a padded rail round the screen,
  // with the game's name printed on it, and the leather edge you sit at runs along the
  // bottom. note goes top right, or under the name.
  const BRASS = '#e8c060', CREAM = '#f8f0d8';
  function drawCardTable(title, note, table) {
    if (table) {
      ctx.fillStyle = '#140a08'; ctx.fillRect(0, 0, SW, SH);
      ctx.fillStyle = '#3a1a0c'; ctx.fillRect(0, 150, SW, SH - 150);
      ctx.fillStyle = INK; ctx.fillRect(4, 0, SW - 8, 170); ctx.fillRect(0, 4, SW, 162);
      ctx.fillStyle = '#6a3418'; ctx.fillRect(5, 1, SW - 10, 168); ctx.fillRect(1, 5, SW - 2, 160);
      ctx.fillStyle = '#c89058'; ctx.fillRect(6, 2, SW - 12, 1);
      ctx.fillStyle = INK; ctx.fillRect(9, 7, SW - 18, 156); ctx.fillRect(7, 9, SW - 14, 152);
      ctx.fillStyle = '#2c7a40'; ctx.fillRect(10, 8, SW - 20, 154); ctx.fillRect(8, 10, SW - 16, 150);
      text(title, 160 - title.length * 3, 12, 1, BRASS);
      text(note, 160 - note.length * 3, 22, 1, '#88c898');
      ctx.fillStyle = '#5a2c14';
      for (let x = 3; x < SW; x += 6) ctx.fillRect(x, 236, 3, 1);
      return;
    }
    ctx.fillStyle = WIN; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = TITLE; ctx.fillRect(0, 0, SW, 14);
    drawRoll(3, 4);
    text(title, 18, 3, 1, '#f8f8f8');
    text(note, SW - 20 - note.length * 6, 3, 1, '#f8f8f8');
    ctx.fillStyle = INK; ctx.fillRect(SW - 13, 2, 10, 10);
    ctx.fillStyle = WIN; ctx.fillRect(SW - 12, 3, 8, 8);
    text('x', SW - 11, 1, 1, INK);
    ctx.fillStyle = '#4a2810'; ctx.fillRect(6, 18, 308, 150); ctx.fillRect(4, 22, 312, 142);
    ctx.fillStyle = '#2c7a40'; ctx.fillRect(10, 22, 300, 142); ctx.fillRect(8, 26, 304, 134);
  }
  // what just happened, in a box under the table
  function drawCardLog(lines, table) {
    ctx.fillStyle = table ? BRASS : INK; ctx.fillRect(4, 172, SW - 8, 26);
    ctx.fillStyle = table ? '#1c0e08' : '#f8f8f8'; ctx.fillRect(5, 173, SW - 10, 24);
    lines.slice(0, 2).forEach((l, i) => text(l, 10, 176 + i * 11, 1, table ? CREAM : INK));
  }
  // one of the buttons along the bottom: bevelled on a computer, a red plaque edged in
  // brass at a table. on: it's the one picked; ok: you can press it.
  function drawCardButton(x, w, label, on, ok, table) {
    if (table) {
      ctx.fillStyle = on ? BRASS : '#1c0e08'; ctx.fillRect(x, 202, w, 16);
      ctx.fillStyle = on ? '#b82828' : '#6a1818'; ctx.fillRect(x + 1, 203, w - 2, 14);
      text(label, x + (w >> 1) - label.length * 3, 206, 1, ok ? CREAM : '#b07868');
      return;
    }
    ctx.fillStyle = INK; ctx.fillRect(x, 202, w, 16);
    ctx.fillStyle = on ? WIN_DARK : '#f8f8f8'; ctx.fillRect(x, 202, w - 1, 15);
    ctx.fillStyle = on ? '#f8f8f8' : WIN_DARK; ctx.fillRect(x + 1, 203, w - 2, 14);
    ctx.fillStyle = on ? '#f0d890' : WIN; ctx.fillRect(x + 1, 203, w - 3, 13);
    text(label, x + (w >> 1) - label.length * 3, 206, 1, ok ? INK : WIN_DARK);
  }
  function drawPokerIcon(x, y) {
    drawCard({ r: 14, s: 1 }, x + 10, y + 4);
    drawCard({ r: 13, s: 0 }, x + 28, y + 10);
    for (let i = 0; i < 3; i++) drawRoll(x + 12 + i * 13, y + 50);
  }

  // pc: the ComputerScreen it runs on, which shuts down when the game is over.
  // table: played at the poker table in Cody's casino instead.
  function PokerApp(pc, table) {
    const START = 200, BLIND_EVERY = 4, SMALL_BLINDS = [2, 3, 5, 8, 12, 20, 30, 50, 80];
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
      if (amt > 0) flyRolls(p, amt);
    }
    // spring rolls fly from someone's stack into the pot: more for bigger amounts, up to 6
    const rolls = RollFlyer();
    function flyRolls(p, amt) {
      const [x0, y0] = p.you ? [40, 138] : [p.px + 28, 39];
      rolls.send(x0, y0, 134, 40, Math.min(6, 1 + Math.floor(amt / (bb() * 2))));
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
      // walking away mid-hand forfeits what you've already put in
      if (state !== 'over') record = saveBest('poker', seats[0].stack);
      remove(self);
      if (state === 'over') { if (pc) remove(pc); say('This gambling thing is too easy. You should do it full time.'); return; }
      say((table ? 'You leave the table with ' : 'You log off with ') + seats[0].stack + ' spring rolls.' + (record ? ' A new record!' : ''));
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
        rolls.update();
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
        drawCardTable("Spring Roll Hold'em", 'Blinds ' + sb() + '/' + bb(), table);
        const ink = table ? CREAM : INK, blink = (tick >> 4) & 1;
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
        rolls.draw(); // spring rolls on their way into the pot
        drawCardLog(lines, table);
        // your controls
        const me = seats[0], myTurn = toAct === 0 && !timer && state === 'play';
        const call = Math.min(curBet - me.bet, me.stack);
        if (raising) {
          const minTo = Math.min(me.bet + me.stack, curBet + minRaise), maxTo = me.bet + me.stack;
          const lbl = (curBet ? 'Raise to ' : 'Bet ') + raiseTo + (raiseTo === maxTo ? ' (all in)' : '');
          text(lbl, 10, 204, 1, ink);
          ctx.fillStyle = INK; ctx.fillRect(160, 203, 150, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(161, 204, 148, 7);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(161, 204, Math.round(148 * (maxTo > minTo ? (raiseTo - minTo) / (maxTo - minTo) : 1)), 7);
          text('Arrows: amount  Space: OK  Esc: back', 10, 224, 1, ink);
        } else if (state === 'play') {
          const labels = ['Fold', call ? 'Call ' + call : 'Check', curBet ? 'Raise' : 'Bet', 'All in'];
          labels.forEach((l, i) => drawCardButton(6 + i * 78, 74, l, myTurn && i === btn, myTurn, table));
          text(myTurn ? 'Arrows: choose  Space: OK  Esc: leave' : 'Esc: leave the table', 10, 226, 1, ink);
        } else if (state !== 'over') text('Space: next hand   Esc: leave the table', 10, 214, 1, ink);
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

  // pc: the ComputerScreen it runs on, which shuts down when the game is over.
  // table: played at Cody's blackjack table in his casino instead.
  function BlackjackApp(pc, table) {
    const START = 200, GOAL = 1000, MIN_BET = 10, DECKS = 4;
    let stack = START, bet = MIN_BET, wager = 0, shoe = [], me = [], dealer = [], holeHidden = true;
    let state = 'bet', lines = [], btn = 0, timer = 0, next = null, t = 0, record = false;
    const after = (frames, fn) => { timer = frames; next = fn; };
    // spring rolls flying between your stack, the bet spot and the dealer
    const rolls = RollFlyer(), YOU = [20, 136], BET = [130, 146], DEALER = [42, 40];
    const count = (amt) => Math.min(6, 1 + Math.floor(amt / 20));
    const toBet = (amt) => rolls.send(YOU[0], YOU[1], BET[0], BET[1], count(amt));
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
      wager = bet; stack -= wager; toBet(wager);
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
      toBet(wager); stack -= wager; wager *= 2;
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
      // the bet goes to the dealer, or comes back to you with any winnings
      if (won === 0) rolls.send(BET[0], BET[1], DEALER[0], DEALER[1], count(wager));
      else {
        rolls.send(BET[0], BET[1], YOU[0], YOU[1], count(Math.min(won, wager)));
        if (won > wager) rolls.send(DEALER[0], DEALER[1], YOU[0], YOU[1], count(won - wager));
      }
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
      // walking away mid-hand forfeits the bet on the table
      if (state !== 'over') record = saveBest('blackjack', stack);
      remove(self);
      if (state === 'over') { if (pc) remove(pc); say('You broke the bank ' + (table ? 'at Cody\'s table' : 'on Cody\'s computer') + '. He looks nervous.'); return; }
      say((table ? 'You leave the table with ' : 'You log off with ') + stack + ' spring rolls.' + (record ? ' A new record!' : ''));
    }
    const askLeave = () => ask('Leave the table with ' + stack + ' spring rolls?', ['LEAVE', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); });

    const self = {
      music: 'poker',
      update() {
        t++;
        rolls.update();
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
        drawCardTable('Spring Roll Blackjack', 'Goal ' + GOAL, table);
        const felt = '#88c898', ink = table ? CREAM : INK;
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
        rolls.draw();
        drawCardLog(lines, table);
        // your controls
        if (state === 'bet') {
          text('Bet ' + bet + (bet === stack ? ' (all in)' : ''), 10, 204, 1, ink);
          ctx.fillStyle = INK; ctx.fillRect(160, 203, 150, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(161, 204, 148, 7);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(161, 204, Math.round(148 * Math.min(1, bet / Math.max(1, stack))), 7);
          text('Arrows: bet  Space: deal  Esc: leave', 10, 224, 1, ink);
        } else if (state === 'play' || state === 'deal' || state === 'wait') {
          const myTurn = state === 'play' && !timer;
          ['Hit', 'Stand', 'Double'].forEach((l, i) => drawCardButton(6 + i * 104, 100, l, myTurn && i === btn, myTurn && (i < 2 || canDouble()), table));
          text(myTurn ? 'Arrows: choose  Space: OK  Esc: leave' : 'Esc: leave the table', 10, 226, 1, ink);
        } else if (state === 'result') text('Space: next hand   Esc: leave the table', 10, 214, 1, ink);
        if (state === 'over') doneBox(['You broke the bank!',
          'Spring rolls: ' + stack, record ? 'New record!' : 'Best ' + getBest('blackjack')], t);
      },
    };
    return self;
  }

  // ---------- Spring Roll Slots: the slot machines in Cody's casino ----------
  // Three reels and one payline, played for the same spring rolls as the card games: you
  // start with START and clean out the machine at GOAL. Every reel has the same 20 stops
  // (SLOT_STRIP), so with SLOT_PAYS the machine pays back about 94% of what goes in.
  const SLOT_STRIP = ['7', 'lemon', 'cherry', 'roll', 'lemon', 'bell', 'cherry', 'lemon', 'bar', 'roll',
    'lemon', 'cherry', 'bell', 'roll', 'lemon', 'bar', 'cherry', 'roll', 'lemon', 'bell'];
  // three of a kind on the line pays this many times your bet; any two cherries pay 4
  // times, and a cherry on the left reel gives you your bet back
  const SLOT_PAYS = { 7: 100, bar: 40, bell: 20, roll: 12, cherry: 10, lemon: 5 };
  const SLOT_NAMES = { 7: 'sevens', bar: 'bars', bell: 'bells', roll: 'spring rolls', cherry: 'cherries', lemon: 'lemons' };
  const SLOT_PIX = {
    7: ['kkkkkkkkkkkk', 'kRRRRRRRRRRk', 'krrrrrrrrrrk', 'kkkkkkkkrrrk', '......krrrk.', '.....krrrk..',
      '....krrrk...', '....krrk....', '...krrrk....', '...krrk.....', '...krrk.....', '...kkkk.....'],
    bell: ['.....kk.....', '....kyok....', '...kyoook...', '...kyoook...', '..kyoooonk..', '..kyoooonk..',
      '.kyoooooonk.', 'kyooooooonnk', 'kkkkkkkkkkkk', '.knnnnnnnnk.', '..kkkkkkkk..', '.....kk.....'],
    cherry: ['........ggG.', '.......g.gGG', '......g..g..', '.....g...g..', '....g....g..', '...g.....g..',
      '.kkkk..kkkk.', 'kRrrrkkRrrrk', 'krrrrkkrrrrk', 'krrrrkkrrrrk', '.kkkk..kkkk.', '............'],
    lemon: ['............', '....kkkk....', '..kkllllkk..', '.kllwwlllLk.', 'kllwlllllLLk', 'klllllllllLk',
      'klllllllllLk', 'kllllllllLLk', '.kLllllllLk.', '..kkLLLLkk..', '....kkkk....', '............'],
    roll: ['............', '............', '..hhhhhhhh..', '.hbbbbbbbbh.', 'hYYYYYYYYYYh', 'hbcbbcbbcbbh',
      'hbcbbcbbcbbh', 'hbbbbbbbbbbh', '.hbbbbbbbbh.', '..hhhhhhhh..', '............', '............'],
  };
  const SLOT_COL = { k: '#181820', r: '#c82828', R: '#f07858', y: '#f8e070', o: '#f0b030', n: '#a86818', g: '#2c8a30',
    G: '#78c850', l: '#f8e048', L: '#c8a020', w: '#f8f8f8', h: '#6a3c10', b: '#e8b048', c: '#c07828', Y: '#f8e098' };
  // a reel symbol, 12 pixels square at scale k
  function drawSlotSymbol(sym, x, y, k) {
    if (sym === 'bar') {
      ctx.fillStyle = '#181820'; ctx.fillRect(x, y + 3 * k, 12 * k, 6 * k);
      ctx.fillStyle = '#f8f8f8';
      if (k > 1) { ring(x + 1, y + 3 * k + 1, 12 * k - 2, 6 * k - 2); text('BAR', x + 4, y + 9, 1, '#f8f8f8'); }
      else ctx.fillRect(x + 2, y + 5, 8, 2);
      return;
    }
    SLOT_PIX[sym].forEach((row, j) => {
      for (let i = 0; i < 12; i++) {
        if (row[i] === '.') continue;
        ctx.fillStyle = SLOT_COL[row[i]]; ctx.fillRect(x + i * k, y + j * k, k, k);
      }
    });
  }

  function SlotsGame() {
    const START = 200, GOAL = 1000, BETS = [5, 10, 25, 50, 100], N = SLOT_STRIP.length;
    const SPEED = 0.45; // stops a frame while a reel spins
    // the reel window: three reels side by side, three symbols tall, the payline through the middle
    const RX = 72, RY = 48, RW = 52, GAP = 6, CELL = 32;
    const CREDITS = [98, 162], SLOT = [160, 96];
    let stack = START, betI = 1, wager = 0, won = 0, state = 'idle', t = 0, record = false, pull = 0, flash = 0;
    let lines = ['Welcome to Spring Roll Slots!', 'Three in a row on the line pays.'];
    // pos: the stop showing on the payline (fractional while it spins); stopAt: where it lands
    const reels = [0, 1, 2].map(() => ({ pos: Math.floor(Math.random() * N), stopAt: null, at: 0, bounce: 0 }));
    const rolls = RollFlyer(), count = (amt) => Math.min(6, 1 + Math.floor(amt / 20));
    const bet = () => Math.min(BETS[betI], stack);
    const showing = (r) => SLOT_STRIP[((Math.round(r.pos) % N) + N) % N];

    function spin() {
      wager = bet(); stack -= wager; won = 0;
      rolls.send(CREDITS[0], CREDITS[1], SLOT[0], SLOT[1], count(wager));
      state = 'spin'; t = 0; pull = 20; sfx('menu');
      lines = ['You bet ' + wager + '. Round and round they go...'];
      // they stop by themselves, one after another, unless you stop them first
      reels.forEach((r, i) => Object.assign(r, { stopAt: null, at: 40 + i * 20 }));
    }
    // Pick where a reel lands, and put it a couple of stops short of there to roll in
    // (it's spinning far too fast to see the jump).
    function stopReel(r) {
      r.stopAt = N + Math.floor(Math.random() * N);
      r.pos = r.stopAt - 2.5;
    }
    function settle() {
      const [a, b, c] = reels.map(showing), cherries = [a, b, c].filter((s) => s === 'cherry').length;
      const jackpot = a === '7' && b === '7' && c === '7';
      let k = 0, msg;
      if (a === b && b === c) { k = SLOT_PAYS[a]; msg = (jackpot ? 'JACKPOT! ' : '') + 'Three ' + SLOT_NAMES[a] + '!'; }
      else if (cherries === 2) { k = 4; msg = 'Two cherries!'; }
      else if (a === 'cherry') { k = 1; msg = 'A cherry on the left.'; }
      won = wager * k; stack += won;
      reels.forEach((r) => { r.pos %= N; r.stopAt = null; });
      if (k > 1) {
        msg += ' You win ' + won + '.';
        rolls.send(SLOT[0], SLOT[1] + 20, CREDITS[0], CREDITS[1], count(won));
        flash = jackpot ? 150 : 60;
        sfx(jackpot ? 'ding' : 'cup');
      } else if (k === 1) { msg += ' Your ' + wager + ' back.'; rolls.send(SLOT[0], SLOT[1] + 20, CREDITS[0], CREDITS[1], count(won)); sfx('blip'); }
      else { msg = 'No luck. You lose ' + wager + '.'; sfx('bump'); }
      lines = [msg, stack ? 'You have ' + stack + ' spring rolls.' : 'That was your last spring roll.'];
      wager = 0;
      if (stack >= GOAL) { state = 'over'; t = 0; record = saveBest('slots', stack); return; }
      state = stack > 0 ? 'idle' : 'broke';
    }
    function leave() {
      // walking away mid-spin forfeits the bet
      if (state !== 'over') record = saveBest('slots', stack);
      remove(self);
      if (state === 'over') { say('You cleaned out the slot machine. Cody unplugs it, just in case.'); return; }
      say('You cash out with ' + stack + ' spring rolls.' + (record ? ' A new record!' : ''));
    }
    const askLeave = () => ask('Cash out with ' + stack + ' spring rolls?', ['CASH OUT', 'KEEP PLAYING'], (i) => { if (i === 0) leave(); });

    const self = {
      music: 'poker',
      update() {
        t++;
        rolls.update();
        if (pull > 0) pull--;
        if (flash > 0) flash--;
        if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) leave(); return; }
        if (state === 'broke') {
          if (pressed.has('a') || pressed.has('b')) { remove(self); say("Cody: The machine always wins. Trust me, I've checked."); }
          return;
        }
        if (pressed.has('b')) { askLeave(); return; }
        if (state === 'spin') {
          // A stops the next reel along
          const next = reels.find((r) => r.stopAt === null);
          if (next && pressed.has('a')) stopReel(next);
          for (const r of reels) {
            if (r.bounce > 0) r.bounce--;
            if (r.stopAt === null) { r.pos = (r.pos + SPEED) % N; if (t >= r.at) stopReel(r); }
            else if (r.pos < r.stopAt) {
              r.pos = Math.min(r.stopAt, r.pos + SPEED);
              if (r.pos === r.stopAt) { r.bounce = 8; sfx('putt'); }
            }
          }
          if (reels.every((r) => r.stopAt !== null && r.pos === r.stopAt && !r.bounce)) settle();
          return;
        }
        const nudge = (d) => {
          const i = Math.max(0, Math.min(BETS.length - 1, betI + d));
          if (i !== betI && (d < 0 || BETS[betI] < stack)) { betI = i; sfx('select'); }
        };
        if (pressed.has('right') || pressed.has('up')) nudge(1);
        if (pressed.has('left') || pressed.has('down')) nudge(-1);
        if (pressed.has('a')) spin();
      },
      draw() {
        const blink = (tick >> (flash ? 2 : 4)) & 1;
        ctx.fillStyle = '#140a10'; ctx.fillRect(0, 0, SW, SH);
        // the machines either side of this one, in the dark
        for (const x of [-26, 298]) {
          ctx.fillStyle = '#3a0c10'; ctx.fillRect(x, 14, 48, 188);
          ctx.fillStyle = '#1c0e08'; ctx.fillRect(x + 6, 60, 36, 50);
        }
        // the cabinet
        ctx.fillStyle = INK; ctx.fillRect(44, 2, 224, 200);
        ctx.fillStyle = '#a82020'; ctx.fillRect(45, 3, 222, 198);
        ctx.fillStyle = '#7a1414'; ctx.fillRect(45, 3, 5, 198); ctx.fillRect(262, 3, 5, 198);
        // the marquee, with bulbs chasing round it (all of them flashing when you win)
        ctx.fillStyle = INK; ctx.fillRect(56, 7, 200, 33);
        ctx.fillStyle = '#1c0e08'; ctx.fillRect(57, 8, 198, 31);
        let n = 0;
        const bulb = (x, y) => {
          const lit = flash ? blink : ((n++ + (tick >> 3)) % 3 === 0);
          ctx.fillStyle = lit ? '#f8f0b0' : '#a86818'; ctx.fillRect(x, y, 2, 2);
        };
        for (let x = 59; x < 253; x += 6) bulb(x, 9);
        for (let y = 15; y < 36; y += 6) bulb(252, y);
        for (let x = 253; x > 58; x -= 6) bulb(x, 36);
        for (let y = 30; y > 12; y -= 6) bulb(58, y);
        text('SPRING ROLL', 160 - 33, 13, 1, BRASS);
        text('SLOTS', 160 - 30, 22, 2, flash && blink ? '#f8f8f8' : '#f05040');
        // the reels behind their window, with the payline across the middle
        ctx.fillStyle = INK; ctx.fillRect(RX - 6, RY - 4, 3 * RW + 2 * GAP + 12, 3 * CELL + 8);
        ctx.fillStyle = BRASS; ring(RX - 5, RY - 3, 3 * RW + 2 * GAP + 10, 3 * CELL + 6);
        reels.forEach((r, i) => {
          const x = RX + i * (RW + GAP);
          ctx.save();
          ctx.beginPath(); ctx.rect(x, RY, RW, 3 * CELL); ctx.clip();
          ctx.fillStyle = '#f4f0e4'; ctx.fillRect(x, RY, RW, 3 * CELL);
          const off = Math.round(Math.sin((r.bounce / 8) * Math.PI) * 4), base = Math.floor(r.pos);
          for (let d = -2; d <= 2; d++) {
            const j = base + d, y = RY + CELL + Math.round((r.pos - j) * CELL) + off;
            drawSlotSymbol(SLOT_STRIP[((j % N) + N) % N], x + (RW >> 1) - 12, y + 4, 2);
          }
          // the reel curving away at the top and bottom
          ctx.fillStyle = 'rgba(24,24,32,0.25)'; ctx.fillRect(x, RY, RW, 8); ctx.fillRect(x, RY + 3 * CELL - 8, RW, 8);
          ctx.fillStyle = 'rgba(24,24,32,0.15)'; ctx.fillRect(x, RY + 8, RW, 6); ctx.fillRect(x, RY + 3 * CELL - 14, RW, 6);
          ctx.restore();
        });
        const ly = RY + CELL + (CELL >> 1);
        ctx.fillStyle = 'rgba(200,40,40,0.55)'; ctx.fillRect(RX - 2, ly, 3 * RW + 2 * GAP + 4, 1);
        ctx.fillStyle = '#f05040';
        for (let k = 0; k < 4; k++) { ctx.fillRect(RX - 10 + k, ly - 3 + k, 1, 7 - 2 * k); ctx.fillRect(RX + 3 * RW + 2 * GAP + 9 - k, ly - 3 + k, 1, 7 - 2 * k); }
        // credits, bet and winnings, in red lights
        [['CREDITS', stack, 66, 64], ['BET', state === 'spin' ? wager : bet(), 138, 44], ['WIN', won, 190, 56]].forEach(([l, v, x, w]) => {
          text(l, x, 150, 1, '#f8e070');
          ctx.fillStyle = INK; ctx.fillRect(x, 158, w, 13);
          const s = String(v);
          if (l !== 'WIN' || !flash || blink) text(s, x + w - 3 - s.length * 6, 161, 1, '#ff4830');
        });
        // what pays
        const pays = [[['7', '7', '7'], 100], [['bar', 'bar', 'bar'], 40], [['bell', 'bell', 'bell'], 20], [['roll', 'roll', 'roll'], 12],
          [['cherry', 'cherry', 'cherry'], 10], [['lemon', 'lemon', 'lemon'], 5], [['cherry', 'cherry'], 4], [['cherry'], 1]];
        ctx.fillStyle = '#7a1414'; ctx.fillRect(54, 174, 204, 26);
        pays.forEach(([syms, k], i) => {
          const x = 58 + (i % 4) * 50, y = 175 + (i >> 2) * 12;
          syms.forEach((sy, j) => drawSlotSymbol(sy, x + j * 8, y, 1));
          text(String(k), x + 28, y + 3, 1, '#f8e070');
        });
        // the lever: pull it and the knob swings down and back up
        const ky = 62 + Math.round(Math.sin(((20 - pull) / 20) * Math.PI) * (pull ? 52 : 0));
        ctx.fillStyle = INK; ctx.fillRect(267, 104, 10, 22); ctx.fillRect(280, Math.min(ky, 114), 5, Math.abs(114 - ky) + 1);
        ctx.fillStyle = '#585868'; ctx.fillRect(268, 105, 8, 20);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(281, Math.min(ky, 114), 3, Math.abs(114 - ky));
        ctx.fillStyle = INK; ctx.fillRect(276, 113, 9, 4);
        ctx.fillStyle = INK; ctx.fillRect(277, ky - 6, 11, 11); ctx.fillRect(276, ky - 5, 13, 9);
        ctx.fillStyle = '#d83030'; ctx.fillRect(278, ky - 5, 9, 9); ctx.fillRect(277, ky - 4, 11, 7);
        ctx.fillStyle = '#f8a8a0'; ctx.fillRect(279, ky - 4, 3, 2);
        rolls.draw();
        // what just happened, and what to press
        ctx.fillStyle = BRASS; ctx.fillRect(4, 205, SW - 8, 24);
        ctx.fillStyle = '#1c0e08'; ctx.fillRect(5, 206, SW - 10, 22);
        lines.slice(0, 2).forEach((l, i) => text(l, 10, 208 + i * 10, 1, CREAM));
        const hint = state === 'spin' ? 'Space: stop a reel  Esc: cash out'
          : state === 'broke' ? 'Space: leave' : 'Arrows: bet  Space: spin  Esc: cash out';
        if (state !== 'over') text(hint, 10, 232, 1, '#c8a878');
        if (state === 'over') doneBox(['You cleaned out the machine!',
          'Spring rolls: ' + stack, record ? 'New record!' : 'Best ' + getBest('slots')], t);
      },
    };
    return self;
  }

  // ---------- coffee mini-game: move the cup to catch falling coffee ----------
  // Against a player (vs) you both get the same pour, and their cup is a faint outline
  // chasing the same drops.
  let coffeesToday = 0;
  function CoffeeGame(vs) {
    const AX = 12, AW = 248, HEAD = 18, CUP_Y = 184, CUP_W = 44, CUP_H = 34, FLOOR = 220;
    const COFFEE = '#6b3a1e', CREMA = '#b07040';
    const METER = { x: 280, y: 40, w: 24, h: 168 };
    // the machine pours this many drops and stops; your score is how many land in the cup
    const DROPS = 150;
    let cup = AX + AW / 2 - CUP_W / 2, fill = 0, caught = 0, missed = 0, t = 0, state = 'ready';
    let poured = 0, wait = 0, record = false, frame = 0;
    let nozzle = AX + AW / 2, target = nozzle, drops = [], splashes = [];
    const rnd = vs ? vs.rng : Math.random, ghost = ghostTrack();
    const race = vs && scoreRace(vs, { what: 'the coffee machine', fmt: String, hear: (m) => ghost.add(m) });
    const self = {
      music: 'coffee',
      update() {
        t++;
        if (race) {
          if (race.update() && state !== 'over') { state = 'over'; t = 0; sfx(race.outcome === 'win' ? 'cup' : 'bump'); }
          if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); vs.end(); race.say(); } return; }
          if (state === 'wait') { if (pressed.has('b')) { remove(self); vs.end(); say('You leave the coffee machine.'); } return; }
        }
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
        if (pressed.has('b')) { remove(self); if (vs) vs.end(); say('You leave the coffee for later.'); return; }
        frame++;
        if (held.left) cup = Math.max(AX, cup - 3);
        if (held.right) cup = Math.min(AX + AW - CUP_W, cup + 3);
        if (race) { race.send({ f: frame, x: Math.round(cup), s: caught }, Math.round(cup) + ':' + caught); ghost.follow(frame); }
        // the nozzle wanders back and forth. As the pour goes on it gets faster (in the end
        // faster than the cup), drips more often and starts changing its mind halfway.
        const p = poured / DROPS;
        if (Math.abs(target - nozzle) < 2 || rnd() < 0.025 * p) target = AX + 12 + rnd() * (AW - 24);
        nozzle += Math.sign(target - nozzle) * Math.min(Math.abs(target - nozzle), 1.2 + 4.4 * p);
        if (poured < DROPS && --wait <= 0) {
          drops.push({ x: nozzle - 1 + (rnd() * 4 - 2), y: HEAD + 22, vy: 1 });
          poured++; wait = Math.round(8 - 3 * p);
        }
        for (const d of drops) { d.vy = Math.min(d.vy + 0.08, 4); d.y += d.vy; }
        drops = drops.filter((d) => {
          if (d.y + 6 >= CUP_Y && d.y < CUP_Y + 8 && d.x + 3 > cup + 3 && d.x < cup + CUP_W - 3) {
            caught++; fill = 100 * caught / DROPS;
            sfx('pour', fill);
            splashes.push({ x: d.x, y: CUP_Y + 2, t: 0 });
            return false;
          }
          if (d.y > FLOOR - 4) { missed++; splashes.push({ x: d.x, y: FLOOR - 2, t: 0 }); return false; }
          return true;
        });
        splashes.forEach((sp) => sp.t++);
        splashes = splashes.filter((sp) => sp.t < 12);
        if (poured >= DROPS && !drops.length) {
          if (race) { race.finish(caught); state = 'wait'; t = 0; return; }
          state = 'done'; t = 0; record = saveBest('coffee', caught); sfx('ding');
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Catch the coffee!', AX + 4, 6);
        const b = race ? vs.name + ' ' + race.now : 'Best ' + getBest('coffee');
        text(b, AX + AW - b.length * 6, 6);
        // machine head + nozzle
        ctx.fillStyle = col.dark; ctx.fillRect(AX, HEAD, AW, 14);
        ctx.fillStyle = '#585868'; ctx.fillRect(AX + 1, HEAD + 1, AW - 2, 12);
        ctx.fillStyle = col.dark; ctx.fillRect(Math.round(nozzle) - 6, HEAD + 13, 12, 8);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(Math.round(nozzle) - 5, HEAD + 14, 10, 6);
        if (state === 'play' && poured < DROPS) { ctx.fillStyle = COFFEE; ctx.fillRect(Math.round(nozzle) - 1, HEAD + 21, 2, 3); }
        // falling coffee
        for (const d of drops) {
          ctx.fillStyle = COFFEE; ctx.fillRect(Math.round(d.x), Math.round(d.y), 3, 6);
          ctx.fillStyle = CREMA; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
        }
        // counter
        ctx.fillStyle = col.dark; ctx.fillRect(AX, FLOOR, AW, 1);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(AX, FLOOR + 1, AW, 5);
        // their cup: an outline where it was at this point in the pour, until they're done
        if (race && ghost.started && !(race.theirsDone && frame - ghost.lag > ghost.end)) {
          const gx = Math.round(ghost.at(frame - ghost.lag, 'x'));
          ctx.globalAlpha = 0.45; ctx.fillStyle = col.dark;
          ring(gx, CUP_Y, CUP_W, CUP_H); ring(gx + 1, CUP_Y + 1, CUP_W - 2, CUP_H - 2);
          ctx.fillRect(gx + CUP_W, CUP_Y + 8, 6, 2); ctx.fillRect(gx + CUP_W + 5, CUP_Y + 8, 2, 16); ctx.fillRect(gx + CUP_W, CUP_Y + 22, 6, 2);
          const n = vs.name.slice(0, 7);
          text(n, gx + ((CUP_W - n.length * 6) >> 1), CUP_Y + 15, 1, col.dark);
          ctx.globalAlpha = 1;
        }
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
        // how full their cup is, as a notch beside the meter
        if (race) {
          const ty = m.y + m.h - 2 - Math.round((m.h - 4) * Math.min(1, race.now / DROPS));
          ctx.fillStyle = col.dark; ctx.fillRect(m.x - 5, ty - 1, 5, 3);
        }
        // messages
        if (state === 'ready') {
          box(70, 92, 180, 48);
          text(t < 50 ? 'Get ready...' : 'GO!', 70 + (t < 50 ? 54 : 81), 104);
          text('Left/Right: move cup', 70 + 30, 120);
        } else if (state === 'over') race.box(t);
        else if (state === 'wait') race.waitBox();
        else if (state === 'done') {
          doneBox(['Coffee\'s ready!', 'Caught ' + caught + ' of ' + DROPS + '   Spilled ' + missed, record ? 'New record!' : 'Best ' + getBest('coffee')], t);
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
    boardNote(key, score);
    if (score <= (+store.get('best.' + key) || 0)) return false;
    store.set('best.' + key, score);
    return true;
  }
  const getBest = (key) => +store.get('best.' + key) || 0;

  // ---------- online leaderboards ----------
  // Everyone's best score at each game, kept in a Firebase Realtime Database (BOARD_URL)
  // as scores/<game>/<name> = { name, score, t }: one row per name. Only the games listed
  // here have a board. A higher stored score is always better, so the fewest-strokes and
  // fastest-time games (low) are stored negated.
  const tenths = (n) => (n / 10).toFixed(1) + 's';
  const times = (n) => n + (n === 1 ? ' time' : ' times');
  const BOARDS = {
    coffee: { title: 'COFFEE MACHINE' }, punch5: { title: 'PUNCHING BAG' }, run: { title: 'TREADMILL', unit: 'm' }, toss: { title: 'PAPER TOSS' },
    stack: { title: 'PHOTOCOPIER' }, simon: { title: 'CONTROL PANEL' }, lunch: { title: 'FIND MY LUNCH' },
    candy: { title: 'CANDY TABLE' }, squat: { title: 'SQUAT RACK', unit: ' lb' }, fan: { title: 'FAN BALANCING' },
    coil: { title: 'COOLING COIL', unit: 's' }, damper: { title: 'DAMPERS' }, filter: { title: 'FILTER CHANGE' },
    snake: { title: 'SNAKE' }, pong: { title: 'BEAT THE TV AT PONG', unit: times, count: true }, parts: { title: 'PARTS SORTING' }, cable: { title: 'CABLE TIDY' }, cpr: { title: 'CPR' },
    engrave: { title: 'ENGRAVER', unit: '%' }, pulldown: { title: 'LAT PULLDOWN' }, ball: { title: 'EXERCISE BALL', unit: 's' },
    desk: { title: 'FRONT DESK' }, jam: { title: 'PAPER JAM' }, laundry: { title: 'LAUNDRY' },
    forms: { title: 'JHONNA\'S FORMS' }, trophy: { title: 'NATHAN\'S TROPHIES' }, legolines: { title: 'JOE\'S BRICK BATTLE' },
    legosolo: { title: 'LEGO BUILDING', unit: ' lines' },
    wokdishes: { title: 'NIK\'S WOK' }, carrotpct: { title: 'DMITRIY\'S CARROTS', unit: '%' }, dance: { title: 'PATRICK\'S DANCE-OFF', unit: '%' },
    poker: { title: 'SPRING ROLL HOLD\'EM' }, blackjack: { title: 'SPRING ROLL BLACKJACK' }, slots: { title: 'SPRING ROLL SLOTS' },
    catch: { title: 'FRISBEE CATCH' },
    bob: { title: 'BOBBING FOR APPLES' }, carve: { title: 'PUMPKIN CARVING' }, treat: { title: 'TRICK-OR-TREAT' },
    ghosts: { title: 'GHOST IN THE CUPBOARD' }, costume: { title: 'COSTUME CONTEST' },
    golf: { title: 'WADE\'S PUTTING GREEN', low: true }, dark: { title: 'DAMIR\'S LIGHTS', unit: 's', low: true },
    mummy: { title: 'MUMMY WRAP', unit: tenths, low: true },
    forklift: { title: 'FORKLIFT RUSH', unit: ' pallets' }, paint: { title: 'EVEN COAT' },
    // the side quests: the "score" is how many times that name has done it (see questBoard), as it is for Pong (count)
    linda: { title: 'LINDA SET FREE', unit: times, quest: true, count: true }, eotm: { title: 'EMPLOYEE OF THE MONTH', unit: times, quest: true, count: true },
  };
  // tools/test.html sets BOARD_DEMO: the boards show made-up rows and nothing is sent
  const boardDemo = !!window.BOARD_DEMO;
  let pendingBoard = null;
  // Called with every result; the board itself goes up once the game on top has closed (see update).
  function boardNote(key, score) {
    if (key.startsWith('dog.')) key = 'catch';
    if (!BOARDS[key] || !(BOARD_URL || boardDemo)) return;
    pendingBoard = { key, score, owner: top() };
  }
  // Linda freed, Employee of the Month won or the TV beaten at Pong: one more time on that
  // board. The count goes up from what the database already holds for the name, so playing
  // on a phone and a computer adds up. The board goes up once everything that was being said is done.
  function questBoard(key) {
    if (!(BOARD_URL || boardDemo)) return;
    const name = playerName || store.get('name') || '';
    const mine = !name || boardDemo || !BOARD_POSTS ? Promise.resolve(null)
      : boardFetch(key + '/' + boardKey(name) + '.json').then((r) => (r.ok ? r.json() : Promise.reject()));
    mine.then((r) => (r && typeof r.score === 'number' ? r.score : 0) + 1, () => 0) // couldn't check: show it, add nothing
      .then((score) => { pendingBoard = { key, score, owner: null, quiet: true }; });
  }
  // a name's row in the database: "Sam" and "sam" are the same person
  const boardKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  function boardFetch(path, opts) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 5000);
    return fetch(BOARD_URL.replace(/\/+$/, '') + '/scores/' + path, Object.assign({ signal: ac.signal }, opts))
      .finally(() => clearTimeout(timer));
  }
  const byScore = (a, b) => b.score - a.score || a.t - b.t;
  const boardSort = (rows) => rows.sort(byScore).slice(0, 10);
  // every row of a board as the database sent it, best first
  const boardRows = (all) => Object.entries(all || {}).filter(([, r]) => r && typeof r.score === 'number')
    .map(([rid, r]) => ({ id: rid, name: String(r.name).slice(0, NAME_MAX), score: r.score, t: +r.t || 0 })).sort(byScore);
  // a stored score (or the gap between two) as the game shows it: "12 pallets", "8.4s"
  function boardFmt(key, v) {
    const b = BOARDS[key], n = b.low ? -v : v;
    return typeof b.unit === 'function' ? b.unit(n) : n + (b.unit || '');
  }
  const DEMO_NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim', 'Guido', 'Edsger'];
  // Send the score (the database refuses anything that isn't an improvement on that name's
  // row), then fetch the top ten and the name's own row.
  function boardLoad(key, name, score) {
    const val = BOARDS[key].low ? -score : score, id = boardKey(name), send = name && score > 0 && (BOARD_POSTS || boardDemo);
    if (boardDemo) {
      const rows = DEMO_NAMES.map((n, i) => ({ id: boardKey(n), name: n, score: BOARDS[key].low ? -(20 + i * 3) : BOARDS[key].count ? Math.max(1, 7 - i) : 100 - i * 7, t: i }));
      const mine = send ? { name, score: val } : null;
      if (mine) rows.push({ id, name, score: val, t: 99 });
      return Promise.resolve({ rows: boardSort(rows), mine });
    }
    const sent = !send ? Promise.resolve()
      : boardFetch(key + '/' + id + '.json', { method: 'PUT', body: JSON.stringify({ name, score: val, t: { '.sv': 'timestamp' } }) })
        .catch(() => {});
    return sent.then(() => Promise.all([
      boardFetch(key + '.json?orderBy=%22score%22&limitToLast=10'),
      name ? boardFetch(key + '/' + id + '.json') : null,
    ])).then(([all, mine]) => {
      if (!all.ok) throw new Error('board ' + all.status);
      return Promise.all([all.json(), mine && mine.ok ? mine.json() : null]);
    }).then(([all, mine]) => ({
      rows: boardRows(all).slice(0, 10),
      mine: mine && typeof mine.score === 'number' ? mine : null,
    }));
  }
  // The top ten at one game, with your own row picked out (and added underneath if you didn't make the list).
  function Leaderboard(p) {
    const b = BOARDS[p.key], name = playerName || store.get('name') || '', id = boardKey(name);
    const fmt = (v) => boardFmt(p.key, v);
    let rows = null, mine = null, failed = false, t = 0;
    boardLoad(p.key, name, p.score).then((r) => { rows = r.rows; mine = r.mine; }, () => { failed = true; });
    const row = (rank, who, score, y, me) => {
      if (me) { ctx.fillStyle = col.dark; ctx.fillRect(16, y - 4, SW - 32, 15); }
      const c = me ? col.light : col.dark, sc = fmt(score);
      text(rank, 24, y, 1, c);
      text(who, 50, y, 1, c);
      text(sc, SW - 24 - sc.length * 6, y, 1, c);
    };
    const self = {
      update() {
        t++;
        if (t > 20 && (pressed.has('a') || pressed.has('b'))) { sfx('menu'); remove(self); }
      },
      draw() {
        box(0, 0, SW, SH);
        ctext('LEADERBOARD', 10);
        ctext(b.title, 23);
        if (failed) ctext('Leaderboard unavailable', 110);
        else if (!rows) ctext('Loading...', 110);
        else if (!rows.length) ctext('No scores yet', 110);
        else {
          rows.forEach((r, i) => row((i + 1) + '.', r.name, r.score, 42 + i * 16, name && r.id === id));
          if (mine && !rows.some((r) => r.id === id)) row('-', name, mine.score, 204, true);
          else if (name && rows[0].id === id) { drawCrown(97, 205); text('You hold the crown!', 109, 204, 1, GOLD); }
        }
        if (t > 20 && (tick >> 4) & 1) ctext('Press Space', SH - 16);
      },
    };
    return self;
  }

  // ---------- the Hall of Fame: every board at once, on the wall in reception ----------
  // Each board's top ten earn points towards Office Champion (10 for 1st down to 1 for
  // 10th), and holding 1st is a crown. The games are grouped by where you find them;
  // a board left out of FAME_GROUPS still turns up, under OTHER. The quests (Linda and
  // Employee of the Month) earn no points: they get a QUESTS page listing everyone who has done them.
  const FAME_GROUPS = [
    ['OFFICE', ['coffee', 'toss', 'lunch', 'candy', 'stack', 'simon', 'desk', 'jam', 'filter']],
    ['FITNESS ROOM', ['punch5', 'squat', 'run', 'pulldown', 'ball', 'laundry']],
    ['TVS AND CODY\'S CASINO', ['pong', 'snake', 'poker', 'blackjack', 'slots']],
    ['BOARDROOM AND 2ND FLOOR', ['fan', 'coil', 'damper', 'parts', 'cable', 'cpr', 'engrave', 'golf', 'legosolo']],
    ['COWORKERS AND DOGS', ['dark', 'dance', 'trophy', 'forms', 'wokdishes', 'carrotpct', 'legolines', 'catch']],
    ['KINGSTON PLANT', ['forklift', 'paint']],
    ['HALLOWEEN', ['bob', 'mummy', 'carve', 'treat', 'ghosts', 'costume']],
  ];
  const GOLD = '#c08818', MEDALS = [GOLD, '#8890a0', '#b06830'];
  const pts = (n) => n + (n === 1 ? ' pt' : ' pts');
  const nth = (n) => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  function ago(t) {
    const m = Math.max(0, Date.now() - t) / 60000;
    return m < 1 ? 'just now' : m < 60 ? Math.floor(m) + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago';
  }
  function drawCrown(x, y) {
    ctx.fillStyle = '#f0b030';
    ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 3, y, 1, 2); ctx.fillRect(x + 6, y, 1, 2);
    ctx.fillRect(x, y + 2, 7, 3);
    ctx.fillStyle = '#b83028'; ctx.fillRect(x + 3, y + 3, 1, 1);
  }
  // Every row of one board, best first.
  function boardAll(key, name) {
    if (boardDemo) {
      // a different made-up crowd at each game (you among them now and then), and a few boards nobody has played
      if (hash(key) % 6 === 0) return Promise.resolve([]);
      const crowd = DEMO_NAMES.concat(name ? [name] : []).filter((n) => hash(key + n) % 3);
      return Promise.resolve(crowd.map((n) => {
        const v = BOARDS[key].count ? hash(n + key) % 4 + 1 : hash(n + key) % 400 + 1;
        return { id: boardKey(n), name: n, score: BOARDS[key].low ? -v : v, t: Date.now() - hash(key + n) % 6e8 };
      }).sort(byScore));
    }
    return boardFetch(key + '.json').then((r) => {
      if (!r.ok) throw new Error('board ' + r.status);
      return r.json();
    }).then(boardRows);
  }
  function HallOfFame() {
    const name = playerName || store.get('name') || '', me = name ? boardKey(name) : null;
    const keys = Object.keys(BOARDS), games = keys.filter((k) => !BOARDS[k].quest), grouped = new Set(FAME_GROUPS.flatMap(([, k]) => k));
    const groups = FAME_GROUPS.concat([['OTHER', games.filter((k) => !grouped.has(k))]]);
    let boards = null, failed = !(BOARD_URL || boardDemo), standings = [], latest = [], tab = 0, sel = 0, scroll = 0, t = 0;
    // Halloween's games only get a page in October, or once somebody has a score on them
    const pages = () => ['CHAMPIONS', 'LATEST SCORES', 'QUESTS'].concat(groups.filter(([g, k]) => k.length &&
      (g !== 'HALLOWEEN' || HALLOWEEN || (boards && k.some((key) => boards[key].length)))));
    const rankOf = (key) => (boards && me ? boards[key].findIndex((r) => r.id === me) : -1);
    if (!failed) {
      Promise.all(keys.map((k) => boardAll(k, name).catch(() => null))).then((all) => {
        if (all.every((r) => r === null)) { failed = true; return; }
        boards = {};
        keys.forEach((k, i) => { boards[k] = all[i] || []; });
        const pts = {};
        for (const k of games) boards[k].slice(0, 10).forEach((r, i) => {
          const s = pts[r.id] || (pts[r.id] = { id: r.id, name: r.name, points: 0, crowns: 0 });
          s.points += 10 - i;
          if (!i) s.crowns++;
        });
        standings = Object.values(pts).sort((a, b) => b.points - a.points || b.crowns - a.crowns || a.name.localeCompare(b.name));
        latest = keys.flatMap((k) => boards[k].map((r, i) => Object.assign({ key: k, rank: i }, r)))
          .sort((a, b) => b.t - a.t).slice(0, 7);
      });
    }
    // what it takes to climb one board, for the game picked on a page
    function climb(key) {
      const rows = boards[key], r = rankOf(key), fmt = (v) => boardFmt(key, v);
      if (!rows.length) return ['Nobody has played this yet.', 'Any score takes the crown!'];
      if (r < 0) return ['You haven\'t played this one yet.', rows.length < 10 ? 'Any score gets you into the top ten.'
        : 'Beat ' + fmt(rows[9].score) + ' to make the top ten.'];
      if (r === 0) return ['You hold the crown!', rows.length > 1
        ? rows[1].name + ' is ' + boardFmt(key, BOARDS[key].low ? rows[1].score - rows[0].score : rows[0].score - rows[1].score) + ' behind you.'
        : 'Nobody else has even tried.'];
      return ['You\'re ' + nth(r + 1) + ' with ' + fmt(rows[r].score) + '.', 'Beat ' + rows[r - 1].name + '\'s ' + fmt(rows[r - 1].score) + ' for ' + nth(r) + '.'];
    }
    const right = (str, y, c) => text(str, SW - 18 - str.length * 6, y, 1, c);
    function drawChampions() {
      ctext('10 points for 1st, down to 1 for 10th', 46, '#686878');
      const mine = standings.findIndex((s) => s.id === me);
      const row = (i, y) => {
        const s = standings[i], hi = s.id === me, c = hi ? col.light : col.dark;
        if (hi) { ctx.fillStyle = col.dark; ctx.fillRect(14, y - 3, SW - 28, 13); }
        text(nth(i + 1), 20, y, 1, MEDALS[i] || c);
        text(s.name, 50, y, 1, c);
        if (s.crowns) { drawCrown(160, y + 1); text('x' + s.crowns, 170, y, 1, c); }
        right(pts(s.points), y, c);
      };
      if (!standings.length) ctext('No scores yet. Go and set some!', 110);
      standings.slice(0, 8).forEach((s, i) => row(i, 62 + i * 13));
      if (mine >= 8) row(mine, 170);
      ctx.fillStyle = col.mid; ctx.fillRect(14, 184, SW - 28, 1);
      if (!me) return;
      const played = games.filter((k) => rankOf(k) >= 0), tens = played.filter((k) => rankOf(k) < 10);
      const s = standings[mine];
      ctext(mine < 0 ? 'Make any top ten to start scoring.'
        : mine === 0 ? (standings[1] ? 'Office Champion! ' + standings[1].name + ' is ' + pts(s.points - standings[1].points) + ' behind.' : 'You are the Office Champion!')
          : 'You\'re ' + nth(mine + 1) + '. ' + pts(standings[mine - 1].points - s.points + 1) + ' more to pass ' + standings[mine - 1].name + '.', 190);
      ctext('Crowns ' + (s ? s.crowns : 0) + '   Top tens ' + tens.length + '   Played ' + played.length + ' of ' + games.length, 204, '#686878');
    }
    // Everyone who has freed Linda or been Employee of the Month, most times first, side by side.
    const QUESTS = [['linda', 20], ['eotm', 166]], QROWS = 9;
    const questRoom = () => Math.max(0, ...QUESTS.map(([k]) => boards[k].length - QROWS));
    function drawQuests() {
      ctext('Everyone who has done it, and how many times', 46, '#686878');
      ctx.fillStyle = col.mid; ctx.fillRect(SW / 2 - 1, 58, 1, 118);
      QUESTS.forEach(([key, x]) => {
        const rows = boards[key];
        text(BOARDS[key].title, x, 60, 1, GOLD);
        if (!rows.length) { text('Nobody yet!', x, 76, 1, '#686878'); return; }
        rows.slice(scroll, scroll + QROWS).forEach((r, i) => {
          const y = 76 + i * 11, hi = r.id === me, c = hi ? col.light : col.dark, n = 'x' + r.score;
          if (hi) { ctx.fillStyle = col.dark; ctx.fillRect(x - 3, y - 2, 140, 11); }
          text(r.name, x, y, 1, c);
          text(n, x + 134 - n.length * 6, y, 1, c);
        });
      });
      // more names above or below
      if (scroll) text('^', SW - 12, 76, 1, '#686878');
      if (scroll < questRoom()) text('v', SW - 12, 164, 1, '#686878');
      ctx.fillStyle = col.mid; ctx.fillRect(14, 184, SW - 28, 1);
      const count = (key) => { const r = me ? boards[key].find((x) => x.id === me) : null; return r ? r.score : 0; };
      const l = count('linda'), e = count('eotm');
      if (me) ctext(l || e ? 'You: freed Linda ' + l + 'x, Employee of the Month ' + e + 'x' : 'You haven\'t done either yet.', 190);
      ctext(boards.linda.length + ' freed Linda   ' + boards.eotm.length + ' made Employee of the Month', 204, '#686878');
    }
    function drawLatest() {
      if (!latest.length) ctext('No scores yet. Go and set some!', 110);
      latest.forEach((r, i) => {
        const y = 50 + i * 22, hi = r.id === me, c = hi ? col.light : col.dark;
        if (hi) { ctx.fillStyle = col.dark; ctx.fillRect(14, y - 3, SW - 28, 21); }
        text(r.name, 20, y, 1, c);
        if (!r.rank) drawCrown(26 + r.name.length * 6, y + 1);
        right(boardFmt(r.key, r.score), y, c);
        text(BOARDS[r.key].title + '  ' + (r.rank ? nth(r.rank + 1) : 'TOP SPOT') + '  ' + ago(r.t), 20, y + 9, 1, hi ? '#c8ccd8' : '#686878');
      });
    }
    function drawGroup(list) {
      list.forEach((key, i) => {
        const y = 50 + i * 15, rows = boards[key], hi = i === sel, c = hi ? col.light : col.dark;
        if (hi) { ctx.fillStyle = col.dark; ctx.fillRect(14, y - 4, SW - 28, 15); }
        text(BOARDS[key].title, 20, y, 1, c);
        if (!rows.length) { right('up for grabs', y, hi ? '#f0b030' : '#d07020'); return; }
        if (rows[0].id === me) drawCrown(150, y + 1);
        text(rows[0].name, 160, y, 1, c);
        right(boardFmt(key, rows[0].score), y, c);
      });
      ctx.fillStyle = col.mid; ctx.fillRect(14, 186, SW - 28, 1);
      if (me) climb(list[sel]).forEach((l, i) => ctext(l, 192 + i * 12, i ? '#686878' : col.dark));
    }
    const self = {
      update() {
        t++;
        const p = pages(), list = typeof p[tab] === 'string' ? null : p[tab][1];
        if (pressed.has('b')) { sfx('menu'); remove(self); return; }
        if (pressed.has('left') || pressed.has('right')) {
          tab = (tab + (pressed.has('left') ? p.length - 1 : 1)) % p.length; sel = 0; scroll = 0; sfx('select');
        }
        if (p[tab] === 'QUESTS' && boards && (pressed.has('up') || pressed.has('down'))) {
          const s = Math.max(0, Math.min(questRoom(), scroll + (pressed.has('up') ? -1 : 1)));
          if (s !== scroll) { scroll = s; sfx('select'); }
        }
        if (list) {
          if (!boards) return;
          if (pressed.has('up')) { sel = (sel + list.length - 1) % list.length; sfx('select'); }
          if (pressed.has('down')) { sel = (sel + 1) % list.length; sfx('select'); }
          if (pressed.has('a') && t > 10) { sfx('menu'); ui.push(Leaderboard({ key: list[sel], score: 0 })); }
        } else if (pressed.has('a') && t > 10) { sfx('menu'); remove(self); }
      },
      draw() {
        box(0, 0, SW, SH);
        drawCrown(76, 12); drawCrown(237, 12);
        text('HALL OF FAME', 88, 8, 2, col.dark);
        const p = pages(), page = p[Math.min(tab, p.length - 1)];
        const label = typeof page === 'string' ? page : page[0], half = label.length * 3;
        ctext(label, 28, GOLD);
        ctx.fillStyle = GOLD;
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(SW / 2 - half - 12 + i, 31 - i, 1, i * 2 + 1);
          ctx.fillRect(SW / 2 + half + 10 - i, 31 - i, 1, i * 2 + 1);
        }
        right((tab + 1) + '/' + p.length, 28, '#686878');
        ctx.fillStyle = col.dark; ctx.fillRect(14, 39, SW - 28, 1);
        if (failed) ctext(BOARD_URL || boardDemo ? 'The board is blank. Try again later.' : 'No online leaderboards set up.', 110);
        else if (!boards) ctext('Loading...', 110);
        else if (page === 'CHAMPIONS') drawChampions();
        else if (page === 'LATEST SCORES') drawLatest();
        else if (page === 'QUESTS') drawQuests();
        else drawGroup(page[1]);
        ctext(page === 'QUESTS' && questRoom() ? 'Arrows: pages, scroll   Esc: close' : typeof page === 'string' ? 'Arrows: pages   Esc: close' : 'Arrows: browse   Space: full board', SH - 16, '#686878');
      },
    };
    return self;
  }

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

  // ---------- score races against another player ----------
  // The coffee machine, treadmill, Snake and the control panel can be played against
  // another player (see VERSUS). You both get the same game from the match's seed and send
  // each other how you're doing as you go ({ e: 'p', s: score, ... }, passed on to hear),
  // then your final score ({ e: 'f', s }). It carries on until you're both out, and the
  // higher final score wins.
  function scoreRace(vs, { what, fmt, hear }) {
    const foe = vs.name;
    let sentKey = '', sendT = 0;
    const r = {
      now: 0, theirs: 0, theirsDone: false, mine: 0, mineDone: false, outcome: null,
      // read their messages and see whether it's settled: 'win', 'lose', 'tie' or 'gone'
      update() {
        for (let m; (m = vs.take());) {
          r.now = Math.max(0, +m.s || 0);
          if (m.e === 'f') { r.theirs = r.now; r.theirsDone = true; } else if (hear) hear(m);
        }
        if (r.outcome) return r.outcome;
        if (r.theirsDone && r.mineDone) r.outcome = r.mine > r.theirs ? 'win' : r.mine < r.theirs ? 'lose' : 'tie';
        else if (vs.gone && !r.theirsDone) r.outcome = 'gone';
        return r.outcome;
      },
      finish(score) {
        if (r.mineDone) return;
        r.mineDone = true; r.mine = score;
        vs.send({ e: 'f', s: score });
      },
      // how you're doing, only when `key` has changed, and at most every 2 ticks through
      // the game server (every 6 through the database, which is slower to write to)
      send(data, key) {
        if (++sendT < (MP_WS ? 2 : 6) || key === sentKey) return;
        sendT = 0; sentKey = key;
        vs.send(Object.assign({ e: 'p' }, data));
      },
      waitBox() {
        box(50, 100, 220, 40);
        ctext('Waiting for ' + foe + '...', 108);
        ctext(foe + ' is on ' + fmt(r.now), 122);
      },
      box(t) {
        const score = 'You ' + fmt(r.mine) + '   ' + foe + ' ' + fmt(r.theirs);
        doneBox(r.outcome === 'gone' ? [foe + ' left.', 'Nobody wins this one.']
          : [r.outcome === 'win' ? 'You beat ' + foe + '!' : r.outcome === 'lose' ? foe + ' wins!' : 'A dead heat!', score], t);
      },
      say() {
        const a = fmt(r.mine), b = fmt(r.theirs);
        say(r.outcome === 'gone' ? foe + ' has gone. Nobody wins this one.'
          : r.outcome === 'win' ? 'You beat ' + foe + ' at ' + what + ', ' + a + ' to ' + b + '!'
            : r.outcome === 'lose' ? foe + ' beat you at ' + what + ', ' + b + ' to ' + a + '.'
              : 'A dead heat at ' + what + ': ' + a + ' each.');
      },
    };
    return r;
  }
  // Where the other player was at each moment of a race, from the progress they send (each
  // with `f`, their ticks since the start), so a ghost can be drawn where they were when
  // they'd got as far into the game as you have. If they're behind you, it's where they
  // last said.
  // Their news arrives a little late and in steps, so they're shown `lag` frames behind
  // your own frame (call follow() once a tick): a few frames more than their news is
  // behind yours, eased so it never jerks. Then there's always a newer point to glide
  // towards instead of stopping and jumping.
  function ghostTrack() {
    const pts = [];
    const g = {
      lag: 6,
      follow(f) {
        const want = pts.length ? Math.max(0, Math.min(30, f - pts[pts.length - 1].f + 4)) : 6;
        g.lag += (want - g.lag) * 0.05;
      },
      add(p) {
        const f = +p.f, last = pts[pts.length - 1];
        if (!(f >= 0) || (last && f <= last.f)) return;
        // nothing sent for a while means nothing changed: they held still until just before
        if (last && f - last.f > 8) pts.push(Object.assign({}, last, { f: f - 6 }));
        pts.push(Object.assign({}, p, { f }));
        if (pts.length > 400) pts.splice(0, 200);
      },
      at(f, k) {
        if (!pts.length) return null;
        let i = pts.length - 1;
        while (i > 0 && pts[i].f > f) i--;
        const a = pts[i], b = pts[i + 1];
        if (!b || f <= a.f) return +a[k] || 0;
        return (+a[k] || 0) + ((+b[k] || 0) - (+a[k] || 0)) * (f - a.f) / (b.f - a.f);
      },
      get started() { return pts.length > 0; },
      get end() { return pts.length ? pts[pts.length - 1].f : 0; },
    };
    return g;
  }

  // ---------- office dogs: play catch, then see how they stack up ----------
  function dogTalk(n) {
    const d = n.dog;
    sfx(d.cat ? 'meow' : 'bark', d.small);
    say(n.name + ' the ' + d.breed + (d.cat ? ' cat' : '') + ': ' + d.sound, () =>
      ask('Play catch with ' + n.name + '?', ['THROW THE FRISBEE', 'NOT NOW'], (i) => {
        if (i === 0) { sfx('menu'); ui.push(CatchGame(n)); return; }
        say(d.cat ? n.name + ' stretches, curls back into a ball and goes back to sleep.'
          : n.name + ' wanders off, tail wagging.');
      }));
  }
  // A sleeping cat's "z Z z", drifting up and fading out over (x, y).
  function drawZzz(x, y, scale) {
    for (let i = 0; i < 3; i++) {
      const k = ((tick + i * 30) % 90) / 90;
      ctx.globalAlpha = 1 - k;
      text(i === 1 ? 'Z' : 'z', x + i * 4 * scale + Math.round(Math.sin(k * 6) * scale), y - Math.round(k * 14 * scale), scale);
    }
    ctx.globalAlpha = 1;
  }
  // Each dog's best catch game, or null if nobody has played catch with them yet.
  const dogBest = (name) => { const v = store.get('best.dog.' + name); return v === null ? null : +v; };

  // The dog runs out while the power meter swings: throw so the frisbee comes down
  // near the dog, then steer the dog under it and jump to snag it before it lands.
  function CatchGame(n) {
    // A cat doesn't play: it sleeps through two throws and that's the end of it.
    const d = n.dog, THROWS = d.cat ? 2 : 10, GY = 196, TOP = 34, HAND = { x: 44, y: GY - 26 };
    const RUN = 1.15 * d.speed, CHASE = 1.05 * d.speed;
    let state = 'ready', t = 0, throwNo = 0, caught = 0, record = false, msg = '';
    let p = 0, pdir = 1, wind = 0, disc = null, runMul = 1, meterMul = 1;
    const HOME = d.cat ? 150 : 56;
    const dog = { x: HOME, dir: 1, h: 0, vh: 0, moving: false };
    // each throw gets its own wind, dog sprint speed and meter speed
    const newWind = () => {
      wind = (Math.random() * 2 - 1) * (0.04 + throwNo * 0.014);
      runMul = 0.75 + Math.random() * 0.55;
      meterMul = 0.75 + Math.random() * 0.6;
    };
    // where the dog's mouth is, so a frisbee touching it is caught
    const mouth = () => {
      const top = GY - 32 - dog.h;
      return { x1: dog.x + (dog.dir > 0 ? 18 : 0), x2: dog.x + (dog.dir > 0 ? 32 : 14), y1: top + 8, y2: top + 22 };
    };
    function finish(text) { msg = text; state = 'result'; t = 0; }
    const self = {
      music: 'run',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'aim'; t = 0; newWind(); } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); ui.push(DogBoard(n)); }
          return;
        }
        if (pressed.has('b')) { remove(self); say(n.name + ' looks at you, then at the frisbee, then back at you.'); return; }
        // jumping, whatever is going on
        if (dog.h > 0 || dog.vh > 0) {
          dog.h += dog.vh; dog.vh -= 0.14;
          if (dog.h <= 0) { dog.h = 0; dog.vh = 0; }
        }
        if (state === 'aim') {
          // the dog sprints out and back; the meter gets quicker every throw
          dog.moving = !d.cat;
          if (dog.moving) dog.x += dog.dir * RUN * runMul;
          if (dog.x > SW - 44) dog.dir = -1;
          if (dog.x < 56) dog.dir = 1;
          p += pdir * (0.012 + throwNo * 0.0018) * meterMul;
          if (p >= 1) { p = 1; pdir = -1; }
          if (p <= 0) { p = 0; pdir = 1; }
          if (pressed.has('a')) {
            disc = { x: HAND.x, y: HAND.y, vx: 0.5 + p * 1.1 + wind, vy: -2 };
            sfx('swish'); state = 'fly'; t = 0;
          }
          return;
        }
        if (state === 'fly') {
          // you steer the dog now
          dog.moving = false;
          const spd = dog.h > 0 ? CHASE * 1.4 : CHASE;
          if (!d.cat) {
            if (held.left) { dog.x -= spd; dog.dir = -1; dog.moving = true; }
            if (held.right) { dog.x += spd; dog.dir = 1; dog.moving = true; }
            dog.x = Math.max(8, Math.min(SW - 40, dog.x));
            if (pressed.has('a') && dog.h === 0) { dog.vh = 3; dog.h = 0.01; sfx('jump'); }
          }
          disc.x += disc.vx; disc.vy = Math.min(disc.vy + 0.045, 0.6); disc.y += disc.vy;
          const m = mouth();
          if (!d.cat && disc.x + 4 > m.x1 && disc.x - 4 < m.x2 && disc.y + 2 > m.y1 && disc.y - 1 < m.y2) {
            caught++; sfx('cup'); finish(dog.h > 4 ? 'What a leap! Caught it!' : 'Caught it!');
          } else if (disc.y >= GY - 2) { sfx('bump'); disc.y = GY - 2; finish(d.cat ? n.name + ' didn\'t even open an eye.' : 'It hit the grass.'); }
          else if (disc.x > SW - 8) { sfx('bump'); disc = null; finish(d.cat ? n.name + ' didn\'t even open an eye.' : 'Way too far!'); }
          return;
        }
        if (state === 'result') {
          dog.moving = false;
          if (t > 70) {
            if (++throwNo >= THROWS) {
              state = 'done'; t = 0;
              record = saveBest('dog.' + n.name, caught);
              if (dogBest(n.name) === null) store.set('best.dog.' + n.name, caught);
              sfx('ding');
              return;
            }
            Object.assign(dog, { x: HOME, dir: 1, h: 0, vh: 0 });
            disc = null; p = 0; pdir = 1; newWind(); state = 'aim'; t = 0;
          }
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Catch with ' + n.name + '!', 12, 8);
        text('Frisbee ' + Math.min(throwNo + 1, THROWS) + '/10', 12, 20); // a cat gives up early
        const right = (str, y) => text(str, SW - 12 - str.length * 6, y);
        right('Caught ' + caught, 8);
        right('Best ' + (dogBest(n.name) || 0), 20);
        // the park: sky, a couple of clouds, striped grass
        ctx.fillStyle = '#bce0f8'; ctx.fillRect(4, TOP, SW - 8, GY - TOP);
        ctx.fillStyle = '#f8f8f8';
        for (const [cx, cy] of [[70, 56], [210, 70]]) {
          const x = Math.round(((cx + tick * 0.1) % (SW + 60)) - 30);
          ctx.fillRect(x, cy, 34, 8); ctx.fillRect(x + 8, cy - 5, 18, 6);
        }
        ctx.fillStyle = '#58a848'; ctx.fillRect(4, GY, SW - 8, SH - GY - 4);
        ctx.fillStyle = '#4c9840';
        for (let x = 4; x < SW - 4; x += 24) ctx.fillRect(x, GY, 12, SH - GY - 4);
        // wind
        if (state === 'aim' || state === 'fly') {
          const arrows = Math.round(Math.abs(wind) / 0.05);
          right('Wind ' + (arrows ? (wind > 0 ? '>' : '<').repeat(arrows) : 'calm'), TOP + 10);
        }
        // you, with the frisbee until it's thrown
        const throwing = state === 'fly' && t < 10;
        ctx.drawImage(sprites.right[throwing ? 1 : 0], 12, GY - 30, 32, 32);
        if (state === 'aim') drawDisc(HAND.x, HAND.y);
        // the dog (2x), running, leaping or sitting
        const img = n.sprites[dog.dir > 0 ? 'right' : 'left'][dog.moving && dog.h === 0 ? 1 + ((tick >> 3) & 1) : dog.h > 0 ? 1 : 0];
        ctx.drawImage(img, Math.round(dog.x), Math.round(GY - 32 - dog.h), 32, 32);
        if (d.cat) drawZzz(Math.round(dog.x) + 22, GY - 30, 2);
        if (disc && state === 'result' && caught && msg.indexOf('Caught') >= 0) {
          const m = mouth(); drawDisc(dog.dir > 0 ? m.x2 - 3 : m.x1 + 3, m.y1 + 8);
        } else if (disc) drawDisc(disc.x, disc.y);
        // power meter
        if (state === 'aim') {
          const B = { x: 60, y: TOP + 8, w: 160, h: 10 };
          text('POWER', 12, B.y + 2);
          ctx.fillStyle = col.dark; ctx.fillRect(B.x, B.y, B.w, B.h);
          ctx.fillStyle = '#f8f8f8'; ctx.fillRect(B.x + 2, B.y + 2, B.w - 4, B.h - 4);
          ctx.fillStyle = '#f0b030'; ctx.fillRect(B.x + 2, B.y + 2, Math.round((B.w - 4) * p), B.h - 4);
          ctx.fillStyle = col.dark; ctx.fillRect(Math.round(B.x + 2 + p * (B.w - 6)), B.y - 3, 2, B.h + 6);
        }
        if (state === 'ready') readyBox(t, 'Space: throw, then run + jump!');
        else if (state === 'done') doneBox(d.cat ? [n.name + ' refuses to move.']
          : [n.name + ' caught ' + caught + ' of ' + THROWS + '!', record ? 'A new record for ' + n.name + '!' : 'Best ' + (dogBest(n.name) || 0)], t);
        else {
          if (state === 'result') { box(50, 92, 220, 32); ctext(msg, 104); }
          text(state === 'aim' ? 'Space: throw   Esc: give up' : d.cat ? 'Esc: give up' : 'Arrows: run   Space: jump', 12, SH - 14, 1, '#f8f8f8');
        }
      },
    };
    function drawDisc(x, y) {
      const w = (tick >> 2) & 1 ? 10 : 8;
      x = Math.round(x); y = Math.round(y);
      ctx.fillStyle = col.dark; ctx.fillRect(x - w / 2 - 1, y - 2, w + 2, 5);
      ctx.fillStyle = '#e04040'; ctx.fillRect(x - w / 2, y - 1, w, 3);
      ctx.fillStyle = '#f8a0a0'; ctx.fillRect(x - w / 2 + 1, y - 1, w - 3, 1);
    }
    return self;
  }

  // Every dog's best catch game, the one you just played with picked out.
  function DogBoard(n) {
    // cats always come last: they never catch anything
    const isCat = (name) => (window.DOGS[name].cat ? 1 : 0);
    const names = Object.keys(window.DOGS || {}).sort((a, b) => isCat(a) - isCat(b) ||
      (dogBest(b) === null ? -1 : dogBest(b)) - (dogBest(a) === null ? -1 : dogBest(a)) || a.localeCompare(b));
    const sprite = (name) => { const dg = dogs.find((x) => x.name === name); return dg && dg.sprites.down[0]; };
    const self = {
      update() {
        if (pressed.has('a') || pressed.has('b')) {
          remove(self);
          if (n.dog.cat) { sfx('meow'); say(n.name + ' rolls over and goes back to sleep.'); return; }
          sfx('bark', n.dog.small);
          say(n.name + ' drops the frisbee at your feet and wags. Again sometime?');
        }
      },
      draw() {
        box(0, 0, SW, SH);
        ctext('FRISBEE LEADERBOARD', 12);
        ctext('Most caught out of 10', 26);
        names.forEach((name, i) => {
          const y = 42 + i * 21, me = name === n.name, best = dogBest(name);
          if (me) { ctx.fillStyle = col.dark; ctx.fillRect(16, y - 3, SW - 32, 20); }
          const c = me ? col.light : col.dark;
          text((i + 1) + '.', 24, y + 4, 1, c);
          const img = sprite(name);
          if (img) ctx.drawImage(img, 42, y - 6);
          text(name, 64, y, 1, c);
          text(window.DOGS[name].breed, 64, y + 9, 1, me ? '#c8ccd8' : '#686878');
          const sc = best === null ? '-' : String(best);
          text(sc, SW - 26 - sc.length * 12, y, 2, c);
        });
        if ((tick >> 4) & 1) ctext('Press Space', SH - 16);
      },
    };
    return self;
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
  // Against a player (vs) you both get the same clutter, and they run on a treadmill of
  // their own further back, where they were at this point in their run; whoever gets
  // further wins. If you wipe out first, you step off and watch them run on until they
  // wipe out too.
  function RunGame(vs) {
    const FLOOR = 196, PX = 56, STAND = 28, DUCK = 14, CEIL = 36;
    // Their treadmill is drawn full size on a canvas of its own (back), then shrunk to half
    // at (BX, BY), so their sprite stays crisp. `pen` is what the clutter and lane() draw
    // on: the screen, or for a moment that canvas.
    const BX = 80, BY = CEIL / 2;
    const back = vs ? document.createElement('canvas') : null;
    if (back) { back.width = SW; back.height = SH; }
    let pen = ctx;
    // Things on the belt to jump over (h = how tall)...
    const LOW = [
      { w: 18, h: 8, draw: (x, y) => { pen.fillStyle = col.dark; pen.fillRect(x, y, 18, 8); pen.fillStyle = '#58b8a8'; pen.fillRect(x + 1, y + 1, 16, 6); pen.fillStyle = '#f8f8f8'; pen.fillRect(x + 1, y + 3, 16, 1); } },
      { w: 16, h: 12, draw: (x, y) => { pen.fillStyle = col.dark; pen.fillRect(x, y, 5, 12); pen.fillRect(x + 11, y, 5, 12); pen.fillRect(x + 4, y + 5, 8, 2); } },
      { w: 10, h: 22, draw: (x, y) => {
        pen.fillStyle = col.dark; pen.fillRect(x, y + 3, 10, 19); pen.fillRect(x + 3, y, 4, 4);
        pen.fillStyle = '#58a8e0'; pen.fillRect(x + 1, y + 6, 8, 15);
        pen.fillStyle = '#f8f8f8'; pen.fillRect(x + 2, y + 7, 2, 6);
      } },
      { w: 18, h: 32, draw: (x, y) => { // a stack of weight plates
        for (let i = 0; i < 4; i++) {
          pen.fillStyle = col.dark; pen.fillRect(x + (i & 1), y + i * 8, 17, 8);
          pen.fillStyle = i & 1 ? '#585868' : '#c03838'; pen.fillRect(x + 1 + (i & 1), y + i * 8 + 1, 15, 6);
        }
      } },
    ];
    // ...and things hanging from above to duck under (gap = clearance above the belt)
    const HIGH = [
      { w: 16, gap: 20, draw: (x, y) => { // punching bag on a chain
        pen.fillStyle = col.dark; pen.fillRect(x + 7, CEIL, 2, y - 30 - CEIL); pen.fillRect(x, y - 30, 16, 30);
        pen.fillStyle = '#b03030'; pen.fillRect(x + 1, y - 29, 14, 28);
        pen.fillStyle = col.dark; pen.fillRect(x + 1, y - 24, 14, 2); pen.fillRect(x + 1, y - 7, 14, 2);
      } },
      { w: 26, gap: 20, draw: (x, y) => { // towel over a pull-up bar
        pen.fillStyle = col.dark; pen.fillRect(x + 2, CEIL, 2, y - 18 - CEIL); pen.fillRect(x + 22, CEIL, 2, y - 18 - CEIL);
        pen.fillRect(x, y - 20, 26, 3); pen.fillRect(x + 6, y - 17, 14, 17);
        pen.fillStyle = '#e8c048'; pen.fillRect(x + 7, y - 17, 12, 16);
        pen.fillStyle = '#f8f8f8'; pen.fillRect(x + 7, y - 5, 12, 2);
      } },
    ];
    let state = 'ready', t = 0, h = 0, vy = 0, speed = 3, dist = 0, nextAt = 220, obs = [], record = false, ducking = false;
    let frame = 0;
    let myStop = null, theirStop = null; // how far the belts had gone when each of you stepped off
    const metres = () => Math.floor(dist / 16);
    const rnd = vs ? vs.rng : Math.random, ghost = ghostTrack();
    const race = vs && scoreRace(vs, { what: 'the treadmill', fmt: (n) => n + 'm', hear: (m) => ghost.add(m) });
    // the belt and the clutter on it move on a tick
    function belt() {
      speed = Math.min(7.5, speed + 0.003);
      dist += speed;
      if (dist >= nextAt) {
        const pool = dist > 400 && rnd() < 0.35 ? HIGH : LOW;
        obs.push({ x: SW, k: pool[Math.floor(rnd() * pool.length)] });
        nextAt = dist + 40 + speed * 34 + rnd() * 90;
      }
      for (const o of obs) o.x -= speed;
      // (against a player, clutter you've passed stays a while: their treadmill is drawn
      // up to 30 frames behind yours)
      obs = obs.filter((o) => o.x + o.k.w > (vs ? -240 : 0));
    }
    // A treadmill and whoever is on it ({ img, h, duck }). `stop`: how far its belt had gone
    // when it stopped (then there's no clutter on it), or null while it's running. `behind`:
    // how far behind yours it is (their lagged view), so the clutter is where it was then.
    function lane(who, stop, behind = 0) {
      const d = (stop === null ? dist : stop) - behind;
      pen.fillStyle = col.dark; pen.fillRect(8, FLOOR, SW - 16, 14);
      pen.fillStyle = '#585868';
      for (let x = 8 - ((Math.floor(d) % 24) + 24) % 24; x < SW - 8; x += 24) if (x >= 8) pen.fillRect(x, FLOOR + 4, 12, 3);
      if (stop === null) for (const o of obs) o.k.draw(Math.round(o.x + behind), FLOOR - (o.k.gap || o.k.h));
      if (who.duck) pen.drawImage(who.img, PX, FLOOR - 17, 32, 17);
      else pen.drawImage(who.img, PX, FLOOR - 32 - who.h, 32, 32);
    }
    const self = {
      music: 'run',
      update() {
        t++;
        if (race) {
          if (race.update() && state !== 'over') { state = 'over'; t = 0; sfx(race.outcome === 'win' ? 'cup' : 'bump'); }
          if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); vs.end(); race.say(); } return; }
          if (state === 'wait') {
            if (pressed.has('b')) { remove(self); vs.end(); say('You step off the treadmill.'); return; }
            // you're out and they're still running: keep the belt in step with their moves as
            // they come in, a little behind so it doesn't stutter (and quicker to catch up)
            const behind = ghost.end - frame, steps = behind > 30 ? 2 : behind > 6 ? 1 : 0;
            for (let i = 0; i < steps; i++) { frame++; belt(); }
            ghost.follow(frame);
            return;
          }
        }
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You ran ' + metres() + 'm on the treadmill.' + (record ? ' A new record!' : ' Phew!'));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); if (vs) vs.end(); say('You step off the treadmill. Enough cardio for today.'); return; }
        frame++;
        // jump: tap for a hop, hold for a big jump; down ducks (or drops you faster mid-air)
        ducking = held.down && h === 0;
        if (pressed.has('a') && h === 0) { vy = 5.8; ducking = false; sfx('jump'); }
        if (!held.a && vy > 1.5) vy = 1.5;
        if (h > 0 || vy > 0) { h += vy; vy -= held.down ? 0.9 : 0.3; if (h <= 0) { h = 0; vy = 0; } }
        belt();
        if (race) { race.send({ f: frame, h: Math.round(h), d: ducking ? 1 : 0, s: metres() }, Math.round(h) + ':' + ducking + ':' + metres()); ghost.follow(frame); }
        // hit box is the body, a bit narrower than the 32px sprite
        const top = h + (ducking ? DUCK : STAND);
        if (obs.some((o) => o.x < PX + 24 && o.x + o.k.w > PX + 9 && (o.k.gap ? top > o.k.gap + 1 : h < o.k.h - 1))) {
          if (race) { race.finish(metres()); state = 'wait'; t = 0; sfx('bump'); return; }
          state = 'done'; t = 0; record = saveBest('run', metres()); sfx('bump');
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Treadmill run!', 16, 10);
        const m = (race && race.mineDone ? race.mine : metres()) + 'm', b = race ? vs.name + ' ' + race.now + 'm' : 'Best ' + getBest('run') + 'm';
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
        // the other player's treadmill, further back: the same clutter as yours (it's the
        // same run), with them where they were this far into it. Once they've wiped out
        // their belt stops, and they stand there watching you.
        if (back) {
          const gf = frame - ghost.lag, out = race.theirsDone && gf > ghost.end, running = ghost.started && !out;
          if (out && theirStop === null) theirStop = dist;
          const gh = running ? Math.round(ghost.at(gf, 'h')) : 0, gd = running && ghost.at(gf, 'd') > 0.5;
          const img = out ? vs.sprites.down[0] : vs.sprites.right[gh > 0 || !running ? 0 : (t >> 3) & 1 ? 2 : 1];
          const bctx = back.getContext('2d');
          bctx.clearRect(0, 0, SW, SH);
          pen = bctx;
          lane({ img, h: gh, duck: gd }, out ? theirStop : null, running ? ghost.lag * speed : 0);
          pen = ctx;
          ctx.drawImage(back, BX, BY, SW / 2, SH / 2);
          // their name over their head
          const nx = BX + (PX + 16) / 2, ny = BY + Math.round((FLOOR - (gd ? 17 : 32) - gh) / 2) - 11, w = vs.name.length * 6 + 3;
          ctx.globalAlpha = 0.7; ctx.fillStyle = col.dark; ctx.fillRect(nx - (w >> 1), ny, w, 10); ctx.globalAlpha = 1;
          text(vs.name, nx - (w >> 1) + 2, ny + 1, 1, '#f8f8f8');
        }
        // your treadmill. Once you're out (against a player) you've stepped off, and you
        // stand on your stopped belt watching them.
        const off = vs && (state === 'wait' || state === 'over');
        if (off && myStop === null) myStop = dist;
        const step = h > 0 || state !== 'play' ? 0 : (t >> 3) & 1 ? 1 : 2;
        lane(off ? { img: sprites.down[0], h: 0 } : { img: sprites.right[step], h: Math.round(h), duck: ducking }, off ? myStop : null);
        if (state === 'ready') readyBox(t, 'Space: jump  Down: duck');
        else if (state === 'over') race.box(t);
        else if (state === 'wait') text(vs.name + ' is still running.  Esc: leave', 16, SH - 14);
        else if (state === 'done') doneBox(['Wipeout!', 'You ran ' + metres() + 'm', record ? 'New record!' : 'Best ' + getBest('run') + 'm'], t);
        else text('Esc: give up', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Pong on the big TV ----------
  // Against the TV, or another player (VERSUS.pong). Against a player the game server runs
  // the game (server/games/pong.js, with the same sizes and speeds as here): it moves the
  // ball and keeps the score, and sends a view of the table 30 times a second (vs.view,
  // see view() there) with you always on the left. Your paddle moves the moment you
  // press and the server is told where it is; between views the ball carries on along its
  // path, and their paddle glides to where the server last had it.
  function PongGame(vs) {
    const L = 12, R = SW - 12, TOP = 34, BOT = SH - 22, PW = 4, PH = 28, BS = 4, WIN = 5;
    const me = { x: L + 4, y: (TOP + BOT - PH) / 2 }, cpu = { x: R - 8, y: (TOP + BOT - PH) / 2 };
    let state = 'ready', t = 0, mine = 0, theirs = 0, ball = null, wait = 0;
    const foe = vs ? vs.name : 'TV';
    // against a player: the server's latest view, where you last told it your paddle is,
    // and how it ended ('win', 'lose', 'gone' or 'stopped')
    let view = null, sentY = null, sendT = 0, outcome = null;
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
    if (!vs) serve(Math.random() < 0.5);
    const num = (n, d) => (typeof n === 'number' && Number.isFinite(n) ? n : d);
    function hear(v) {
      if (!v || typeof v !== 'object' || !Array.isArray(v.sc)) return;
      const sc = [num(v.sc[0], mine), num(v.sc[1], theirs)];
      // the sounds, from what's happened since the last view
      if (view) {
        if (sc[0] > mine) sfx('ding');
        else if (sc[1] > theirs) sfx('bump');
        else if (v.bn !== view.bn) sfx('blip', true);
        else if (v.wn !== view.wn) sfx('blip');
      } else me.y = num(v.me, me.y);
      [mine, theirs] = sc;
      view = v;
      ball = { x: num(v.bx, SW / 2), y: num(v.by, (TOP + BOT) / 2), vx: num(v.vx, 0), vy: num(v.vy, 0) };
      wait = num(v.w, 0);
      state = v.ph ? 'play' : 'ready';
      t = num(v.t, 0);
    }
    function versusOver() {
      const r = vs.result;
      if (r && typeof r.w === 'number' && Array.isArray(r.sc)) {
        const seat = view ? view.s : 0;
        mine = num(r.sc[seat], mine); theirs = num(r.sc[1 - seat], theirs);
        outcome = r.w === seat ? 'win' : 'lose';
      } else outcome = (r && (r.error || r.timeout)) ? 'stopped' : 'gone';
      state = 'done'; t = 0;
      sfx(outcome === 'win' ? 'cup' : 'bump');
    }
    function versusUpdate() {
      t++;
      if (state === 'done') {
        if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
          remove(self); vs.end();
          const a = mine + ' to ' + theirs, b = theirs + ' to ' + mine;
          say(outcome === 'win' ? 'You beat ' + foe + ' at Pong, ' + a + '!'
            : outcome === 'lose' ? foe + ' beat you at Pong, ' + b + '.'
              : outcome === 'gone' ? foe + ' has gone. Nobody wins this one.'
                : 'The TV lost the signal. Nobody wins this one.');
        }
        return;
      }
      if (pressed.has('b')) { remove(self); vs.end(); say('You switch the TV back to the news.'); return; }
      if (vs.view !== view) hear(vs.view);
      if (vs.result !== undefined || vs.gone) { versusOver(); return; }
      if (!view) return; // the server hasn't started it yet
      if (held.up) me.y -= 3.5;
      if (held.down) me.y += 3.5;
      me.y = Math.max(TOP, Math.min(BOT - PH, me.y));
      // where your paddle is, at most 30 times a second, and once more when it stops
      if (me.y !== sentY && ++sendT >= 2) { sendT = 0; sentY = me.y; vs.input({ y: me.y }); }
      cpu.y += (num(view.them, cpu.y) - cpu.y) / 2;
      if (state !== 'play') return;
      if (wait > 0) { wait--; return; }
      ball.x += ball.vx; ball.y += ball.vy;
      if (ball.y < TOP) { ball.y = TOP; ball.vy = -ball.vy; }
      if (ball.y > BOT - BS) { ball.y = BOT - BS; ball.vy = -ball.vy; }
    }
    const self = {
      music: 'pong',
      update() {
        if (vs) { versusUpdate(); return; }
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            questNote('pong', mine > theirs ? 1 : 0);
            if (mine > theirs) questBoard('pong');
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
        cpu.y += Math.sign(aim - cpu.y) * Math.min(Math.abs(aim - cpu.y), 1.8);
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
        // (against a player the ball can run a step past the edge before the server says
        // who scored)
        if (state === 'play' && ball.x > L - 8 && ball.x < R + 8 && (wait === 0 || (wait >> 2) & 1)) ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BS, BS);
        text('YOU', L, 10, 1, '#f8f8f8');
        text(foe.toUpperCase(), R - foe.length * 6, 10, 1, '#f8f8f8');
        text('First to ' + WIN, SW / 2 - 27, 10, 1, '#f8f8f8');
        if (vs && !view && state !== 'done') { box(60, 92, 200, 48); ctext('Waiting for ' + foe + '...', 104); ctext('Esc: give up', 120); }
        else if (state === 'ready') readyBox(t, 'Up/Down: move paddle');
        else if (state === 'done' && vs) {
          doneBox(outcome === 'gone' ? [foe + ' left.', 'Nobody wins this one.', '']
            : outcome === 'stopped' ? ['The TV lost the signal.', 'Nobody wins this one.', '']
              : [outcome === 'win' ? 'You beat ' + foe + '!' : foe + ' wins!', mine + ' - ' + theirs, ''], t);
        } else if (state === 'done') doneBox([mine > theirs ? 'You win!' : 'The TV wins.', mine + ' - ' + theirs, ''], t);
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
  // Against a player (vs) you both get the same sequence; you only see how far they've
  // got, not their presses, so they can't give the answer away. Whoever's out first
  // watches the other's lights until they're out too; most rounds wins.
  function SimonGame(vs) {
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
    const rnd = vs ? vs.rng : Math.random;
    function nextRound() { seq.push(Math.floor(rnd() * 4)); state = 'show'; t = 0; }
    // rounds you've got right so far, counting the one you've just finished
    const cleared = () => (state === 'pause' ? seq.length : rounds());
    // once you're out, the other player's lights show on your panel as they play
    let theirRound = 0;
    function hear(m) {
      if (state !== 'wait') return;
      if (+m.r > 0) theirRound = +m.r;
      if (+m.l >= 0 && +m.l < 4) { lit = +m.l; litT = Math.max(4, Math.min(30, +m.d || 12)); sfx('note', lit); }
    }
    const race = vs && scoreRace(vs, { what: 'the control panel', fmt: String, hear });
    // a light going on, sent to the other player only once they're out (so they can watch
    // you, but never while it could give them the answer)
    const flash = (i, d) => { if (race && race.theirsDone) vs.send({ e: 'p', s: cleared(), l: i, d, r: seq.length }); };
    const self = {
      music: 'simon',
      update() {
        t++;
        if (litT) litT--;
        if (race) {
          if (race.update() && state !== 'over') { state = 'over'; t = 0; sfx(race.outcome === 'win' ? 'cup' : 'bump'); }
          if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); vs.end(); race.say(); } return; }
          if (state === 'wait') { if (pressed.has('b')) { remove(self); vs.end(); say('You back away from the panel slowly.'); } return; }
          if (state !== 'ready') race.send({ s: cleared() }, cleared());
        }
        if (state === 'ready') { if (t > 75) nextRound(); return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(rounds() === 0 ? 'The panel buzzes angrily. Best not to touch it.'
              : 'You got through ' + rounds() + (rounds() === 1 ? ' round' : ' rounds') + ' before something sparked.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); if (vs) vs.end(); say('You back away from the panel slowly.'); return; }
        if (state === 'show') {
          const st = Math.round(step()), u = t - 1, i = Math.floor(u / st);
          if (i < seq.length && u % st === 0) { lit = seq[i]; litT = Math.round(st * 0.7); sfx('note', lit); flash(lit, litT); }
          if (u >= seq.length * st + 8) { state = 'input'; pos = 0; t = 0; }
        } else if (state === 'input') {
          const i = LIGHTS.findIndex((l) => pressed.has(l.k));
          if (i < 0) return;
          lit = i; litT = 12; flash(i, 12);
          if (i !== seq[pos]) {
            sfx('buzz'); t = 0;
            if (race) { race.finish(rounds()); state = 'wait'; return; }
            state = 'done'; record = saveBest('simon', rounds()); return;
          }
          sfx('note', i);
          if (++pos === seq.length) { state = 'pause'; t = 0; }
        } else if (state === 'pause' && t > 40) nextRound();
      },
      draw() {
        box(0, 0, SW, SH);
        text('Repeat the lights!', 16, 10);
        const s = state === 'wait' ? vs.name + ': round ' + (theirRound || race.now + 1) : 'Round ' + seq.length, b = 'Best ' + getBest('simon');
        text(s, SW - 16 - s.length * 6, 10);
        if (!race) text(b, SW - 16 - b.length * 6, 22);
        else {
          // the other player beside the panel, with how many rounds they've got right
          const n = vs.name.slice(0, 10), st = race.theirsDone ? 'Out: ' + race.theirs : 'Cleared ' + race.now;
          ctx.drawImage(vs.sprites.down[0], 15, 84, 40, 40);
          text(n, 35 - n.length * 3, 130);
          text(st, 35 - st.length * 3, 144, 1, race.theirsDone ? '#b83028' : undefined);
        }
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
        else if (state === 'wait') ctext('You\'re out! Watching ' + vs.name, 220);
        else if (state === 'input') ctext('Your turn!', 220);
        else if (state === 'pause') ctext('Correct!', 220);
        if (state === 'ready') readyBox(t, 'Arrows: repeat the lights');
        else if (state === 'over') race.box(t);
        else if (state === 'done') doneBox(['Wrong light! Zap!', 'Rounds: ' + rounds(), record ? 'New record!' : 'Best ' + getBest('simon')], t);
        else if (state !== 'wait') text('Esc: give up', 16, SH - 14);
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
    const pool = npcs.filter((n) => !n.ghost && !n.extra);
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
            boardNote('golf', total());
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
          boardNote('dark', secs);
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

  // With `vs` (a match with another player, see "other players") it's you against them:
  // each of you picks a move, and the round plays out once both are in.
  function BattleGame(vs) {
    const MAX_HP = 3;
    const RX = 230, RY = 38, RS = 64;      // Richard, top right
    const PX = 26, PY = 100, PS = 76;      // you, seen from behind, bottom left
    const ECX = RX + RS / 2, ECY = RY + RS / 2, PCX = PX + PS / 2, PCY = PY + PS / 3;
    const foe = vs ? vs.name : 'Richard';
    const rSprites = vs ? vs.sprites : spritesFor('Richard');
    // hp is the real score; shown drains towards it so the bar visibly empties.
    let hp = { you: MAX_HP, rich: MAX_HP }, shown = { you: MAX_HP, rich: MAX_HP };
    let state = 'msg', sel = 0, queue = [], lines = [], chars = 0;
    let fx = null, hurt = { you: 0, rich: 0 }, result = null;
    let rounds = 0, mine = null; const theirs = {}; // against a player: the moves so far, by round

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
      push(vs ? (who === 'rich' ? 'You win the duel!' : foe + ' wins the duel!')
        : who === 'rich' ? 'I have taught you the ways of airflow well!'
          : 'You still have much to learn!', () => sfx(result === 'win' ? 'ding' : 'buzz'));
    }
    function attack(mv, toward) {
      fx = { kind: mv.key, toward, t: 0 };
      sfx(MOVE_SFX[mv.key], 2);
    }
    function round(you) {
      if (vs) { mine = you; vs.send({ r: rounds, mv: you.key }); state = 'wait'; return; }
      play(you, MOVES[Math.floor(Math.random() * MOVES.length)]);
    }
    function play(you, rich) {
      rounds++;
      push('You use ' + you.said + '!', () => attack(you, 'rich'));
      push(foe + ' uses ' + rich.said + '!', () => attack(rich, 'you'));
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
        if (vs) {
          for (let m; (m = vs.take());) {
            const mv = MOVES.find((x) => x.key === m.mv);
            if (mv && m.r >= 0) theirs[m.r] = mv;
          }
          if (state === 'wait' && theirs[rounds]) { play(mine, theirs[rounds]); return; }
          if (vs.gone && !result) {
            result = 'left'; queue = [];
            push(foe + ' has left the duel.');
            state = 'msg'; nextMsg();
          }
        }
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
          if (pressed.has('b')) giveUp();
          return;
        }
        if (state === 'wait') { if (pressed.has('b')) giveUp(); return; }
        const len = lines.join('').length;
        if (chars < len) { chars += held.a || held.b ? 3 : 1; return; }
        if (draining || fx) return;
        if (pressed.has('a') || pressed.has('b')) {
          // the last line of a finished duel closes it
          if (result && !queue.length) {
            remove(self);
            if (vs) {
              vs.end();
              say(result === 'win' ? 'You beat ' + foe + ' in the air handling duel!'
                : result === 'lose' ? foe + ' beat you in the air handling duel.' : 'The duel is off.');
              return;
            }
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
        hpBar(8, 10, 150, foe.toUpperCase(), shown.rich);
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
        if (state === 'wait') {
          box(0, SH - 48, SW, 48);
          text('You picked ' + mine.said + '.', 12, SH - 38);
          text('Waiting for ' + foe + '.'.repeat(1 + ((tick >> 4) % 3)), 12, SH - 22);
          return;
        }
        box(0, SH - 48, SW, 48);
        let left = chars;
        lines.forEach((l, i) => { text(l.slice(0, Math.max(0, left)), 12, SH - 38 + i * 16); left -= l.length; });
        if (chars >= lines.join('').length && !fx && shown.you <= hp.you && shown.rich <= hp.rich
          && (tick >> 4) & 1) text('~', SW - 14, SH - 12);
      },
    };
    function giveUp() {
      remove(self);
      if (vs) { vs.end(); say('You walk away from the duel.'); } else say('You step away. Richard nods: another time, then.');
    }
    push(vs ? 'An air handling duel with ' + foe + '! First to knock the other out wins.' : 'Richard wants to test your air handling knowledge!');
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
  // Against a player (vs) your screen shrinks to make room for a small copy of theirs, and
  // the food turns up in the same places for both of you (unless it would land on your snake).
  // Whoever crashes first watches the other's TV until they crash too; most food wins.
  function SnakeGame(vs) {
    const COLS = 25, ROWS = 15, CW = vs ? 8 : 10, FX = vs ? 6 : 34, FY = vs ? 44 : 46, TC = 4, TX = 214;
    let state = 'ready', t = 0, snake = [], dir = [1, 0], nextDir = [1, 0];
    let food = null, grow = 0, step = 0, speed = 9, score = 0, record = false;
    // against a player, each piece of food has its own seed, so you both get the same pieces
    const foodSeed = vs ? Math.floor(vs.rng() * 1e9) : 0;
    let foodN = 0, theirs = null;
    function placeFood() {
      const rnd = vs ? seeded(foodSeed + foodN++) : Math.random;
      let p;
      do { p = [Math.floor(rnd() * COLS), Math.floor(rnd() * ROWS)]; }
      while (snake.some((s) => s[0] === p[0] && s[1] === p[1]));
      food = p;
    }
    snake = [[6, 7], [5, 7], [4, 7]];
    placeFood();
    // your snake as the other player sees it: two letters a cell (column and row in base
    // 36), eight cells to a field, since a message only carries short strings
    function picture() {
      const cells = snake.map(([x, y]) => x.toString(36) + y.toString(36)).join('');
      const pic = { s: score, fx: food[0], fy: food[1] };
      for (let i = 0; i * 16 < cells.length && i < 40; i++) pic['c' + i] = cells.slice(i * 16, i * 16 + 16);
      return pic;
    }
    function hear(m) {
      let cells = '';
      for (let i = 0; i < 40 && typeof m['c' + i] === 'string'; i++) cells += m['c' + i];
      const body = [];
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const x = parseInt(cells[i], 36), y = parseInt(cells[i + 1], 36);
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) body.push([x, y]);
      }
      const fx = +m.fx, fy = +m.fy;
      theirs = { body, food: fx >= 0 && fx < COLS && fy >= 0 && fy < ROWS ? [fx, fy] : null };
    }
    const race = vs && scoreRace(vs, { what: 'Snake', fmt: String, hear });
    const self = {
      music: 'pong',
      update() {
        t++;
        if (race) {
          if (race.update() && state !== 'over') { state = 'over'; t = 0; sfx(race.outcome === 'win' ? 'cup' : 'bump'); }
          if (state === 'over') { if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); vs.end(); race.say(); } return; }
          if (state === 'wait') { if (pressed.has('b')) { remove(self); vs.end(); say('You switch the TV back to the news.'); } return; }
          if (state === 'play') { const pic = picture(); race.send(pic, JSON.stringify(pic)); }
        }
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(score ? 'Snake: ' + score + ' lengths.' + (record ? ' A new record!' : '') + ' Back to work.'
              : 'You crashed immediately. Maybe stick to Pong.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); if (vs) vs.end(); say('You switch the TV back to the news.'); return; }
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
          if (race) { race.finish(score); state = 'wait'; t = 0; sfx('buzz'); return; }
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
        // a playfield c pixels to a cell at (x, y), with the snake and its food on it
        const field = (x, y, c, body, fd) => {
          ctx.fillStyle = '#0d2818'; ctx.fillRect(x, y, COLS * c, ROWS * c);
          ctx.fillStyle = fd && (tick >> 3) & 1 ? '#f8e070' : '#f0b030';
          if (fd) ctx.fillRect(x + fd[0] * c + (c >> 2), y + fd[1] * c + (c >> 2), c - (c >> 2) * 2, c - (c >> 2) * 2);
          body.forEach((sg, i) => {
            ctx.fillStyle = i === 0 ? '#a8e070' : '#58a848';
            ctx.fillRect(x + sg[0] * c + 1, y + sg[1] * c + 1, c - (c > 4 ? 2 : 1), c - (c > 4 ? 2 : 1));
          });
        };
        if (race) {
          // two TVs: yours, and a little one showing theirs
          text('You ' + score, FX, 30);
          text(vs.name + ' ' + race.now, TX, 30);
          for (const [x, w, h] of [[FX, COLS * CW, ROWS * CW], [TX, COLS * TC, ROWS * TC]]) {
            ctx.fillStyle = '#181820'; ctx.fillRect(x - 3, FY - 3, w + 6, h + 6);
            ctx.fillStyle = '#3a3a48'; ctx.fillRect(x - 2, FY - 2, w + 4, h + 4);
          }
          field(FX, FY, CW, snake, food);
          if (theirs) field(TX, FY, TC, theirs.body, theirs.food);
          else { ctx.fillStyle = '#0d2818'; ctx.fillRect(TX, FY, COLS * TC, ROWS * TC); }
          if (race.theirsDone) { box(TX + 22, FY + 6, 56, 20); text('OUT', TX + 41, FY + 12); }
        } else {
          const s = 'Score ' + score, b = 'Best ' + getBest('snake');
          text(s, 150, 10); text(b, SW - 16 - b.length * 6, 10);
          // TV bezel around the playfield
          ctx.fillStyle = '#181820'; ctx.fillRect(FX - 10, FY - 10, COLS * CW + 20, ROWS * CW + 20);
          ctx.fillStyle = '#3a3a48'; ctx.fillRect(FX - 7, FY - 7, COLS * CW + 14, ROWS * CW + 14);
          field(FX, FY, CW, snake, food);
          ctx.fillStyle = '#181820'; ctx.fillRect(FX + 60, FY + ROWS * CW + 13, COLS * CW - 120, 6);
        }
        if (state === 'ready') readyBox(t, 'Arrows: steer');
        else if (state === 'over') race.box(t);
        else if (state === 'wait') race.waitBox();
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
        if (pressed.has('b')) { remove(self); say('You back out of the Haunted Office.'); return; }
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
    const DIRECTORY = npcs.filter((n) => !n.ghost && !n.extra).map((n) => {
      const r = roomAt(n.floor, n.x, n.y), m = r && /^(\d+) /.exec(r.name);
      return m ? { name: n.name, where: 'Office ' + m[1] + ', ' + floorName(n.floor) } : null;
    }).filter(Boolean);
    if (!DIRECTORY.length) DIRECTORY.push({ name: 'Kiki', where: 'Office 101, Ground' });
    let state = 'ready', t = 0, who = null, opts = [], sel = 0, left = TIME;
    let n = 0, right = 0, last = null, record = false;
    const FACES = npcs.filter((n) => !n.ghost && !n.extra);
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
    ['POKEMON CARD WISHLIST', 'Charizard (shiny)', 'Pikachu (promo)', 'Mewtwo (first ed.)', 'Sleep (any edition)', '', 'Line starts at 4am.', 'Bring a chair.', '- Reagan'],
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

  // ---------- Joe's Lego brick battle: falling-brick puzzle, you against Joe ----------
  // Both of you get the same bricks in the same order. Fill a row to clear it; clear
  // two or more at once and grey bricks push up from the bottom of Joe's baseplate
  // (2 rows -> 1, 3 -> 2, 4 -> 4), and his clears do the same to you. Whoever's bricks
  // reach the top first loses. The bricks fall faster every 15 seconds.
  // LegoGame(true) is the shelf's game: no Joe, one baseplate, and you clear as many rows as you can.
  // LegoGame(false, vs) is against another player (see "other players"): the same bricks in
  // the same order from the match's shared random numbers. Each of you plays your own
  // baseplate and sends the other a picture of it a few times a second, plus a message for
  // every batch of grey rows you send and one when you top out.
  function LegoGame(solo, vs) {
    const COLS = 10, ROWS = 20, C = 9, BY = 38;
    const BX = solo ? [115] : [22, 208];
    // each piece's cells in its first rotation, on an n x n grid
    const SHAPES = {
      I: [4, [[0, 1], [1, 1], [2, 1], [3, 1]]], O: [2, [[0, 0], [1, 0], [0, 1], [1, 1]]],
      T: [3, [[1, 0], [0, 1], [1, 1], [2, 1]]], S: [3, [[1, 0], [2, 0], [0, 1], [1, 1]]],
      Z: [3, [[0, 0], [1, 0], [1, 1], [2, 1]]], J: [3, [[0, 0], [0, 1], [1, 1], [2, 1]]],
      L: [3, [[2, 0], [0, 1], [1, 1], [2, 1]]],
    };
    const KEYS_ = Object.keys(SHAPES);
    const ROTS = {};
    for (const k of KEYS_) {
      const [n, first] = SHAPES[k];
      ROTS[k] = [first];
      for (let r = 1; r < 4; r++) ROTS[k].push(ROTS[k][r - 1].map(([x, y]) => [n - 1 - y, x]));
    }
    // brick colours: [face, stud highlight, shadow]
    const COLOURS = {
      I: ['#4a9de0', '#9ccaf2', '#2a64a0'], O: ['#f2cd37', '#fbeaa0', '#b0901a'],
      T: ['#9b5bc0', '#c89ae0', '#64368a'], S: ['#2d9a4a', '#7cd090', '#1a6430'],
      Z: ['#d02818', '#f07858', '#8a1a10'], J: ['#1e5ac8', '#6890e0', '#123c88'],
      L: ['#f08a20', '#f8c070', '#a85a10'], G: ['#9aa0a8', '#c8ccd8', '#60646c'],
    };
    const SEND = [0, 0, 1, 2, 4];
    const foe = vs ? vs.name : 'Joe';
    const joe = vs ? vs.sprites : spritesFor('Joe');
    // one shared bag of pieces, so neither of you gets luckier bricks
    const seq = [], rnd = vs ? vs.rng : Math.random;
    function piece(i) {
      while (seq.length <= i) {
        const bag = KEYS_.slice();
        for (let j = bag.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [bag[j], bag[k]] = [bag[k], bag[j]]; }
        seq.push(...bag);
      }
      return seq[i];
    }
    const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const fits = (board, k, r, x, y) => ROTS[k][r].every(([cx, cy]) => {
      const bx = x + cx, by = y + cy;
      return bx >= 0 && bx < COLS && by < ROWS && (by < 0 || !board[by][bx]);
    });
    const players = (solo ? [0] : [0, 1]).map((i) => ({
      ai: i === 1, board: empty(), cur: null, next: 0, fall: 0, lockT: 0, das: 0,
      clearing: null, pending: 0, lines: 0, sent: 0, dead: false, plan: null, wait: 0, dropping: false,
    }));
    const [you, them] = players;
    // against a player, only your own baseplate is played here; theirs is what they last sent
    const mine = vs ? [you] : players;
    let state = 'ready', t = 0, frames = 0, record = false, won = false;
    let sentPic = '', picT = 0;
    const gravity = () => Math.max(6, 42 - Math.floor(frames / 900) * 4);
    const level = () => 1 + Math.min(9, Math.floor(frames / 900));
    const secs = () => Math.floor(frames / 60);
    // On your own, rows of grey bricks push up from the bottom by themselves: one every 12
    // seconds to begin with, each a little sooner than the last (down to one every 2 seconds),
    // so no game lasts forever. The gap in them moves every third row.
    let rise = 0, risen = 0, riseHole = 0;
    const riseEvery = () => Math.max(120, Math.round(720 * Math.pow(0.95, risen)));

    function spawn(p) {
      // rows of grey bricks the other player sent push up from the bottom
      if (p.pending) {
        let hole = Math.floor(Math.random() * COLS);
        for (let i = 0; i < p.pending; i++) {
          if (solo) { if (risen++ % 3 === 0) riseHole = Math.floor(Math.random() * COLS); hole = riseHole; }
          if (p.board.shift().some((c) => c)) p.dead = true;
          const row = Array(COLS).fill('G'); row[hole] = null;
          p.board.push(row);
        }
        p.pending = 0;
        sfx('bump');
      }
      const k = piece(p.next++);
      p.cur = { k, r: 0, x: k === 'O' ? 4 : 3, y: 0 };
      p.fall = 0; p.lockT = 0; p.dropping = false; p.plan = null; p.wait = 0;
      if (p.dead || !fits(p.board, k, 0, p.cur.x, p.cur.y)) { p.dead = true; p.cur = null; }
    }
    function move(p, dx, dy) {
      const c = p.cur;
      if (!c || !fits(p.board, c.k, c.r, c.x + dx, c.y + dy)) return false;
      c.x += dx; c.y += dy;
      return true;
    }
    function rotate(p) {
      const c = p.cur, r = (c.r + 1) % 4;
      // nudge it off a wall or another brick if it won't turn where it is
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
        if (fits(p.board, c.k, r, c.x + dx, c.y + dy)) { c.r = r; c.x += dx; c.y += dy; return true; }
      }
      return false;
    }
    function lock(p) {
      const c = p.cur;
      for (const [cx, cy] of ROTS[c.k][c.r]) {
        if (c.y + cy < 0) p.dead = true;
        else p.board[c.y + cy][c.x + cx] = c.k;
      }
      p.cur = null;
      if (p.dead) return;
      const rows = [];
      p.board.forEach((row, y) => { if (row.every((x) => x)) rows.push(y); });
      if (!rows.length) { if (!p.ai) sfx('blip'); spawn(p); return; }
      p.clearing = { rows, t: 0 };
      p.lines += rows.length;
      if (!solo) {
        let send = SEND[rows.length];
        const cancel = Math.min(send, p.pending);
        p.pending -= cancel; send -= cancel;
        if (vs) { if (send) vs.send({ e: 'g', c: send }); } else (p === you ? them : you).pending += send;
        p.sent += send;
      }
      sfx(rows.length >= 2 ? 'cup' : 'blip', true);
    }
    function drop(p) { while (move(p, 0, 1)); lock(p); }

    // Joe weighs up every landing spot for his brick: low, flat and no gaps
    // underneath. He doesn't always pick the best one.
    function plan(p) {
      const c = p.cur, opts = [];
      for (let r = 0; r < 4; r++) {
        for (let x = -2; x < COLS; x++) {
          if (!fits(p.board, c.k, r, x, 0)) continue;
          let y = 0;
          while (fits(p.board, c.k, r, x, y + 1)) y++;
          const b = p.board.map((row) => row.slice());
          for (const [cx, cy] of ROTS[c.k][r]) if (y + cy >= 0) b[y + cy][x + cx] = c.k;
          const full = b.filter((row) => row.every((v) => v)).length;
          const kept = b.filter((row) => !row.every((v) => v));
          const h = [];
          let holes = 0;
          for (let cx = 0; cx < COLS; cx++) {
            let top = kept.findIndex((row) => row[cx]);
            if (top < 0) { h.push(0); continue; }
            h.push(kept.length - top);
            for (let yy = top + 1; yy < kept.length; yy++) if (!kept[yy][cx]) holes++;
          }
          let bump = 0;
          for (let cx = 1; cx < COLS; cx++) bump += Math.abs(h[cx] - h[cx - 1]);
          const score = -0.51 * h.reduce((a, v) => a + v, 0) + 0.76 * full - 0.36 * holes - 0.18 * bump;
          opts.push({ r, x, score });
        }
      }
      opts.sort((a, b) => b.score - a.score);
      const pickN = Math.random() < 0.5 ? Math.min(opts.length, 6) : 1;
      return opts[Math.floor(Math.random() * pickN)] || { r: 0, x: c.x };
    }
    function joeThink(p) {
      if (!p.plan) { if (++p.wait < 30) return; p.plan = plan(p); p.wait = 0; }
      if (p.dropping) return;
      if (++p.wait < 11) return;
      p.wait = 0;
      const c = p.cur, goal = p.plan;
      if (c.r !== goal.r) { if (!rotate(p)) p.dropping = true; }
      else if (c.x !== goal.x) { if (!move(p, Math.sign(goal.x - c.x), 0)) p.dropping = true; }
      else p.dropping = true;
    }

    function step(p) {
      if (p.dead) return;
      if (p.clearing) {
        if (++p.clearing.t < 14) return;
        const gone = p.clearing.rows;
        p.board = p.board.filter((_, y) => !gone.includes(y));
        while (p.board.length < ROWS) p.board.unshift(Array(COLS).fill(null));
        p.clearing = null;
        spawn(p);
        return;
      }
      if (!p.cur) return;
      let soft = false;
      if (p.ai) { joeThink(p); soft = p.dropping; }
      else {
        if (pressed.has('a')) { if (rotate(p)) sfx('select'); }
        if (pressed.has('up')) { drop(p); return; }
        for (const d of ['left', 'right']) {
          if (pressed.has(d)) { move(p, d === 'left' ? -1 : 1, 0); p.das = 0; }
          else if (held[d] && ++p.das >= 12 && (p.das - 12) % 3 === 0) move(p, d === 'left' ? -1 : 1, 0);
        }
        soft = held.down;
      }
      const c = p.cur;
      if (!fits(p.board, c.k, c.r, c.x, c.y + 1)) {
        if (++p.lockT >= (soft ? 4 : 30)) lock(p);
        return;
      }
      p.lockT = 0;
      if (++p.fall >= (soft ? Math.min(2, gravity()) : gravity())) { p.fall = 0; move(p, 0, 1); }
    }

    function finish() {
      state = 'done'; t = 0;
      if (solo) { record = saveBest('legosolo', you.lines); sfx('buzz'); return; }
      won = them.dead && !you.dead;
      if (vs) { if (you.dead) vs.send({ e: 'x' }); sfx(won ? 'cup' : 'buzz'); return; }
      questNote('lego', won ? 1 : 0);
      record = saveBest('legolines', you.lines);
      sfx(won ? 'cup' : 'buzz');
    }

    // your baseplate as the other player sees it: a row of letters per row ('.' for a gap),
    // the brick that's falling, your lines and the grey rows on their way to you
    function picture() {
      const pic = { e: 'b', l: you.lines, p: you.pending, nx: you.next };
      you.board.forEach((row, y) => { pic['r' + y] = row.map((k) => k || '.').join(''); });
      if (you.cur) Object.assign(pic, { z: you.cur.k, q: you.cur.r, x: you.cur.x, y: you.cur.y });
      return pic;
    }
    function hear(m) {
      if (m.e === 'g') you.pending += Math.max(0, Math.min(4, Math.round(+m.c) || 0));
      else if (m.e === 'x') them.dead = true;
      else if (m.e === 'b') {
        const board = [];
        for (let y = 0; y < ROWS; y++) {
          const row = String(m['r' + y] || '');
          board.push(Array.from({ length: COLS }, (_, x) => (row[x] && row[x] !== '.' ? (COLOURS[row[x]] ? row[x] : 'G') : null)));
        }
        them.board = board;
        them.cur = ROTS[m.z] ? { k: m.z, r: (+m.q || 0) & 3, x: +m.x || 0, y: +m.y || 0 } : null;
        them.lines = +m.l || 0; them.pending = +m.p || 0; them.next = Math.max(0, Math.min(you.next + 50, +m.nx || 0));
      }
    }

    mine.forEach(spawn);
    const self = {
      music: 'lego',
      update() {
        t++;
        if (vs) {
          for (let m; (m = vs.take());) hear(m);
          if (vs.gone && state !== 'done' && state !== 'gone') { state = 'gone'; t = 0; }
          if (state === 'gone' || state === 'done') {
            if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
              remove(self); vs.end();
              say(state === 'gone' ? foe + ' has gone. Nobody wins this one.'
                : won ? 'You beat ' + foe + ' at the brick battle!' : foe + ' beat you at the brick battle.');
            }
            return;
          }
        }
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            if (solo) { say('You cleared ' + you.lines + (you.lines === 1 ? ' line' : ' lines') + ' in ' + secs() + ' seconds.' + (record ? ' A new record!' : '') + ' You put every brick back exactly where Joe had it. Probably.'); return; }
            say(won ? 'Joe: "My bricks! My beautiful bricks!" He bows to the new master builder.'
              : 'Joe: "Still the master builder!" He snaps another brick onto his tower.');
          }
          return;
        }
        if (pressed.has('b')) {
          remove(self);
          if (vs) { vs.end(); say('You knock your bricks over and walk away.'); return; }
          say(solo ? 'You tip the bricks back into the tub before Joe notices.' : 'Joe: "Ha! Knew you would crack." He starts sorting his bricks by colour.');
          return;
        }
        frames++;
        if (solo && ++rise >= riseEvery()) { rise = 0; you.pending++; }
        mine.forEach(step);
        // send your baseplate when it's changed, at most ten times a second
        if (vs && ++picT >= 6) {
          const pic = picture(), key = JSON.stringify(pic);
          if (key !== sentPic) { vs.send(pic); sentPic = key; picT = 0; }
        }
        if (players.some((p) => p.dead)) finish();
      },
      draw() {
        box(0, 0, SW, SH);
        text(solo ? 'Lego Building' : 'Lego Brick Battle', 16, 10);
        const b = 'Best ' + getBest(solo ? 'legosolo' : 'legolines') + ' lines';
        if (!vs) text(b, SW - 16 - b.length * 6, 10);
        const brick = (x, y, k, s, alpha) => {
          const [face, hi, lo] = COLOURS[k];
          ctx.globalAlpha = alpha || 1;
          ctx.fillStyle = lo; ctx.fillRect(x, y, s, s);
          ctx.fillStyle = face; ctx.fillRect(x, y, s - 1, s - 1);
          ctx.fillStyle = hi; ctx.fillRect(x, y, s - 1, 1); ctx.fillRect(x, y, 1, s - 1);
          // the stud
          const st = s > 7 ? 3 : 2, o = (s - st) >> 1;
          ctx.fillStyle = lo; ctx.fillRect(x + o, y + o + 1, st, st);
          ctx.fillStyle = hi; ctx.fillRect(x + o, y + o, st, st);
          ctx.globalAlpha = 1;
        };
        players.forEach((p, i) => {
          const X = BX[i];
          const name = (i ? foe : playerName || 'YOU').toUpperCase();
          text(name, X, 26);
          const ln = p.lines + (p.lines === 1 ? ' line' : ' lines');
          text(ln, X + COLS * C - ln.length * 6, 26);
          // the baseplate, studs and all
          ctx.fillStyle = col.dark; ctx.fillRect(X - 2, BY - 2, COLS * C + 4, ROWS * C + 4);
          ctx.fillStyle = i ? '#3a5a90' : '#2f7a3a'; ctx.fillRect(X, BY, COLS * C, ROWS * C);
          ctx.fillStyle = i ? '#4668a0' : '#3a8a46';
          for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) ctx.fillRect(X + x * C + 3, BY + y * C + 3, 3, 3);
          p.board.forEach((row, y) => row.forEach((k, x) => {
            if (!k) return;
            if (p.clearing && p.clearing.rows.includes(y) && (p.clearing.t >> 1) & 1) {
              ctx.fillStyle = '#f8f8f8'; ctx.fillRect(X + x * C, BY + y * C, C, C);
            } else brick(X + x * C, BY + y * C, k, C);
          }));
          if (p.cur) {
            const c = p.cur;
            if (p === you) { // where your brick will land
              let gy = c.y;
              while (fits(p.board, c.k, c.r, c.x, gy + 1)) gy++;
              for (const [cx, cy] of ROTS[c.k][c.r]) if (gy + cy >= 0) brick(X + (c.x + cx) * C, BY + (gy + cy) * C, c.k, C, 0.3);
            }
            for (const [cx, cy] of ROTS[c.k][c.r]) if (c.y + cy >= 0) brick(X + (c.x + cx) * C, BY + (c.y + cy) * C, c.k, C);
          }
          // incoming grey rows, as a red bar beside the baseplate (they arrive with your next brick)
          if (p.pending) {
            const mx = i ? X + COLS * C + 3 : X - 7, h = Math.min(ROWS, p.pending) * C;
            ctx.fillStyle = (tick >> 3) & 1 ? '#f05040' : '#b83028';
            ctx.fillRect(mx, BY + ROWS * C - h, 4, h);
          }
          // next brick, in the middle
          const NX = solo ? 40 : i ? 164 : 118, NY = 54;
          ctx.fillStyle = col.dark; ring(NX, NY, 38, 30);
          const k = piece(p.next), cells = ROTS[k][0];
          const w = Math.max(...cells.map((q) => q[0])) + 1, hgt = Math.max(...cells.map((q) => q[1])) + 1;
          const ox = NX + ((38 - w * 7) >> 1), oy = NY + ((30 - hgt * 7) >> 1) - (k === 'I' ? 3 : 0);
          for (const [cx, cy] of cells) brick(ox + cx * 7, oy + cy * 7, k, 7);
          if (p.dead && state === 'done') {
            box(X + 5, BY + 140, COLS * C - 10, 22);
            text('TOPPED', X + 27, BY + 148);
          }
        });
        if (solo) {
          // next brick on the left of the baseplate, the clock and the controls on the right
          text('NEXT', 47, 42);
          text('Time ' + secs() + 's', 222, 54);
          text('Speed ' + level(), 222, 68);
          if (state === 'play') ['Space: turn', 'Up: drop', 'Esc: give up'].forEach((h, i) => text(h, 222, 176 + i * 12));
          if (state === 'ready') readyBox(t, 'Clear rows as the bricks rise');
          else if (state === 'done') doneBox(['The bricks reached the top!',
            'Cleared ' + you.lines + (you.lines === 1 ? ' line' : ' lines') + ' in ' + secs() + 's',
            record ? 'New record!' : 'Best ' + getBest('legosolo') + ' lines'], t);
          return;
        }
        ctext('NEXT', 42);
        ctx.drawImage(joe.down[0], 142, 92, 36, 36);
        ctext('VS', 134);
        ctext('Speed ' + level(), 150);
        if (state === 'play') {
          ctext('Space: turn', 176);
          ctext('Up: drop', 188);
          ctext('Esc: give up', 200);
        }
        if (state === 'ready') readyBox(t, 'Clear 2+ rows to send bricks');
        else if (state === 'gone') doneBox([foe + ' has gone.', 'Nobody wins this one.'], t);
        else if (state === 'done' && vs) doneBox([won ? 'You buried ' + foe + ' in bricks!' : foe + ' out-built you!',
          'Lines: ' + you.lines + ' - ' + them.lines], t);
        else if (state === 'done') doneBox([won ? 'You buried Joe in bricks!' : 'Joe out-built you!',
          'Lines: ' + you.lines + ' - ' + them.lines,
          record ? 'New record!' : 'Best ' + getBest('legolines') + ' lines'], t);
      },
    };
    return self;
  }

  // ---------- Nik's wok toss: keep the stir-fry moving and in the wok ----------
  // Toss the food up with A and slide the wok under it to catch it. Food in the wok
  // cooks (faster over the flame) but scorches if you leave it sitting, and a toss
  // knocks the scorch back down. Cook a dish through and it's served; scorch it and
  // it's binned. Serve more dishes than Nik in a minute to win.
  function WokGame() {
    const WOK_Y = 186, FLOOR = 232, HALF = 28, GRAV = 0.18, TIME = 60 * 60, NIK = 4;
    const FLAME = { x: 120, w: 80 };
    const FOOD = {
      rice: '#f8f0d8', egg: '#f8d848', pea: '#58a848', shrimp: '#f8a070',
      beef: '#8a4a28', pepper: '#d83020', noodle: '#f0d090', onion: '#e8e0f0',
    };
    const DISHES = [
      ['Fried Rice', ['rice', 'rice', 'egg', 'pea', 'shrimp', 'rice']],
      ['Beef Stir-Fry', ['beef', 'pepper', 'beef', 'onion', 'pea', 'pepper']],
      ['Pad Thai', ['noodle', 'noodle', 'shrimp', 'egg', 'pea', 'noodle']],
      ['Sweet and Sour', ['pepper', 'onion', 'beef', 'pepper', 'rice', 'onion']],
    ];
    const nik = spritesFor('Nik');
    let state = 'ready', t = 0, left = TIME, wx = 160, dish = 0, food = [], cook = 0, scorch = 0;
    let served = 0, perfect = 0, dropped = 0, cool = 0, msg = null, record = false;
    function newDish() {
      const [, items] = DISHES[dish % DISHES.length];
      food = items.map((kind, i) => ({ kind, inWok: true, off: (i - 2.5) * 8, x: 0, y: WOK_Y, vx: 0, vy: 0 }));
      cook = 0; scorch = 0; dropped = 0;
    }
    newDish();
    const endDish = (s, good) => { msg = { t: 0, s }; sfx(good ? 'cup' : 'buzz'); };
    const self = {
      music: 'kitchen',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(served > NIK ? 'Nik: "Not bad at all! Just don\'t tell Dmitriy you out-cooked me."'
              : 'Nik: "And that is how a real chef does it. Dmitriy learned from the best."');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('Nik: "Too hot in the kitchen? Ha!"'); return; }
        if (--left <= 0) {
          state = 'done'; t = 0;
          questNote('wok', served > NIK ? 1 : 0);
          record = saveBest('wokdishes', served);
          sfx(served > NIK ? 'cup' : 'buzz');
          return;
        }
        if (held.left) wx = Math.max(HALF + 4, wx - 3);
        if (held.right) wx = Math.min(SW - HALF - 4, wx + 3);
        if (msg) { if (++msg.t > 60) { msg = null; dish++; newDish(); } return; }
        const inWok = food.filter((f) => f.inWok);
        if (cool) cool--;
        if (pressed.has('a') && inWok.length && !cool) {
          // the further into service, the higher and wider it all goes
          const lift = 5 + Math.min(dish, 6) * 0.15, spread = 1.1 + Math.min(dish, 6) * 0.2;
          for (const f of inWok) {
            Object.assign(f, { inWok: false, x: wx + f.off, y: WOK_Y, vx: (Math.random() - 0.5) * spread, vy: -(lift + Math.random() * 1.4) });
          }
          scorch = Math.max(0, scorch - 45); cool = 18;
          sfx('sizzle');
        }
        for (const f of food) {
          if (f.inWok) continue;
          f.x += f.vx; f.y += f.vy; f.vy += GRAV;
          if (f.x < 4 || f.x > SW - 4) f.vx = -f.vx;
          if (f.vy > 0 && f.y >= WOK_Y && f.y - f.vy < WOK_Y + 1 && Math.abs(f.x - wx) <= HALF - 2) {
            f.inWok = true; f.off = Math.max(-HALF + 6, Math.min(HALF - 6, f.x - wx)); f.y = WOK_Y;
          }
        }
        const lost = food.filter((f) => !f.inWok && f.y > FLOOR);
        if (lost.length) { dropped += lost.length; food = food.filter((f) => !lost.includes(f)); sfx('bump'); }
        if (!food.length) { endDish('All over the floor!', false); return; }
        const now = food.filter((f) => f.inWok).length;
        if (now) {
          const over = Math.abs(wx - (FLAME.x + FLAME.w / 2)) < FLAME.w / 2 + HALF / 2;
          cook += 0.26 * (now / food.length) * (over ? 1 : 0.35);
          scorch += (0.5 + Math.min(dish, 6) * 0.07) * (over ? 1 : 0.4);
        } else scorch = Math.max(0, scorch - 0.5);
        if (scorch >= 100) { endDish('Burnt! Into the bin.', false); return; }
        if (cook >= 100) {
          served++;
          if (!dropped) perfect++;
          endDish(dropped ? DISHES[dish % DISHES.length][0] + ' served!' : 'Perfect ' + DISHES[dish % DISHES.length][0] + '!', true);
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text(DISHES[dish % DISHES.length][0], 16, 10);
        const tm = 'Time ' + Math.ceil(left / 60);
        text(tm, SW - 16 - tm.length * 6, 10);
        text('Served ' + served + '   Nik ' + NIK, 16, 22);
        const b = 'Best ' + getBest('wokdishes');
        text(b, SW - 16 - b.length * 6, 22);
        // the two meters
        const meter = (x, label, v, c) => {
          text(label, x, 36);
          ctx.fillStyle = col.dark; ctx.fillRect(x + 44, 35, 92, 9);
          ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 45, 36, 90, 7);
          ctx.fillStyle = c; ctx.fillRect(x + 45, 36, Math.round(90 * Math.min(100, v) / 100), 7);
        };
        meter(16, 'Cooked', cook, '#58a848');
        meter(164, 'Scorch', scorch, scorch > 70 && (tick >> 2) & 1 ? '#f8e070' : '#d83020');
        // the kitchen: tiled wall and the stove
        ctx.fillStyle = '#dce8ec'; ctx.fillRect(4, 50, SW - 8, 154);
        ctx.fillStyle = '#c4d4da';
        for (let y = 50; y < 204; y += 16) ctx.fillRect(4, y, SW - 8, 1);
        for (let x = 4; x < SW - 4; x += 16) ctx.fillRect(x, 50, 1, 154);
        ctx.drawImage(nik.down[0], SW - 50, 56, 36, 36);
        ctx.fillStyle = '#484858'; ctx.fillRect(4, 204, SW - 8, 32);
        ctx.fillStyle = '#303040'; ctx.fillRect(4, 204, SW - 8, 3);
        // the flame
        for (let i = 0; i < 8; i++) {
          const fx = FLAME.x + 4 + i * 10, h = 8 + ((tick + i * 5) >> 2) % 4 * 2;
          ctx.fillStyle = '#f0b030'; ctx.fillRect(fx, 204 - h, 6, h);
          ctx.fillStyle = '#d83020'; ctx.fillRect(fx + 1, 204 - h + 3, 4, h - 3);
          ctx.fillStyle = '#3868c8'; ctx.fillRect(fx, 202, 6, 2);
        }
        // the wok, with its handle
        ctx.fillStyle = '#5a3420'; ctx.fillRect(wx + HALF, WOK_Y + 1, 22, 4);
        ctx.fillStyle = col.dark;
        for (let i = 0; i < 6; i++) ctx.fillRect(wx - HALF + i * 3, WOK_Y + 3 + i * 2, (HALF - i * 3) * 2, 2);
        ctx.fillStyle = '#686878'; ctx.fillRect(wx - HALF, WOK_Y + 3, HALF * 2, 1);
        // the food
        for (const f of food) {
          const x = Math.round(f.inWok ? wx + f.off : f.x), y = Math.round(f.inWok ? WOK_Y + 1 + ((tick + f.off) >> 4 & 1) : f.y);
          ctx.fillStyle = col.dark; ctx.fillRect(x - 4, y - 4, 9, 7);
          ctx.fillStyle = FOOD[f.kind]; ctx.fillRect(x - 3, y - 3, 7, 5);
        }
        if (msg) { box(60, 100, 200, 30); ctext(msg.s, 112); }
        if (state === 'ready') readyBox(t, 'Space: toss  Arrows: catch');
        else if (state === 'done') doneBox([served > NIK ? 'You out-cooked Nik!' : 'Nik\'s still the chef.',
          'Served ' + served + ' (' + perfect + ' perfect)  Nik ' + NIK,
          record ? 'New record!' : 'Best ' + getBest('wokdishes') + ' dishes'], t);
        else text('Space: toss  Arrows: move  Esc: quit', 16, SH - 12, 1, '#f8f8f8');
      },
    };
    return self;
  }

  // ---------- Dmitriy's knife skills: chop the carrot on the marked lines ----------
  // Each carrot slides under the knife with dashed lines marked along it. Press A to
  // bring the knife down; the closer to a line, the better the cut. Lines you miss
  // and extra cuts both count against you. Beat Dmitriy's evenness to win.
  function CarrotGame() {
    const KNIFE = 120, CY = 128, CH = 16, DMITRIY = 75;
    // [lines, gap between them in px, speed in px a frame]
    const CARROTS = [[5, 26, 0.9], [6, 24, 1.05], [6, 22, 1.2], [7, 20, 1.3], [8, 18, 1.4]];
    const REMARKS = [[90, 'Clean. Very clean.'], [75, 'Not bad. Not Nik bad, either.'], [50, 'Hmm. Rustic.'], [0, 'Chunks? Really?']];
    const dima = spritesFor('Dmitriy');
    let state = 'ready', t = 0, round = 0, cx = 0, lines = [], cuts = [], len = 0, speed = 0;
    let total = 0, count = 0, roundSum = 0, roundN = 0, chop = 0, pop = null, remark = 'Watch the lines, then chop.', record = false;
    function newCarrot() {
      const [n, gap, sp] = CARROTS[round];
      len = gap * (n + 1); speed = sp;
      lines = Array.from({ length: n }, (_, i) => ({ at: gap * (i + 1), cut: false }));
      cuts = []; cx = SW + 10; roundSum = 0; roundN = 0;
    }
    newCarrot();
    const pct = () => (count ? Math.round(total / count) : 0);
    function score(pts, label) {
      total += pts; count++; roundSum += pts; roundN++;
      if (label) pop = { s: label, t: 0 };
    }
    const self = {
      music: 'kitchen',
      update() {
        t++;
        if (pop && ++pop.t > 30) pop = null;
        if (chop) chop--;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(pct() > DMITRIY ? 'Dmitriy: "...Fine. You could work my line. Don\'t tell Nik."'
              : 'Dmitriy: "Back to peeling potatoes with you."');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('Dmitriy takes the knife back. "Fingers first, then technique."'); return; }
        cx -= speed;
        const at = KNIFE - cx; // where on the carrot the knife is right now
        // the windows are about the same number of frames whatever the speed
        const reach = Math.max(8, CARROTS[round][1] / 2), perfect = 1.5 + speed * 1.5, good = 3 + speed * 3;
        // a line that's gone past the knife without a cut counts as a miss
        for (const l of lines) if (!l.cut && at > l.at + reach) { l.cut = true; score(0, 'Missed one!'); }
        if (pressed.has('a') && !chop && at > 0 && at < len) {
          chop = 10; cuts.push(at); sfx('chop');
          let best = null;
          for (const l of lines) if (!l.cut && (!best || Math.abs(l.at - at) < Math.abs(best.at - at))) best = l;
          const err = best ? Math.abs(best.at - at) : 99;
          if (err <= reach) {
            best.cut = true;
            score(err <= perfect ? 100 : err <= good ? 75 : 40, err <= perfect ? 'Perfect!' : err <= good ? 'Good' : 'Sloppy');
          } else score(0, 'Extra cut!');
        }
        if (cx + len < KNIFE - 20) {
          const avg = roundN ? roundSum / roundN : 0;
          remark = REMARKS.find(([min]) => avg >= min)[1];
          if (++round >= CARROTS.length) {
            state = 'done'; t = 0;
            questNote('carrot', pct() > DMITRIY ? 1 : 0);
            record = saveBest('carrotpct', pct());
            sfx(pct() > DMITRIY ? 'cup' : 'buzz');
            return;
          }
          newCarrot();
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Carrot ' + Math.min(round + 1, CARROTS.length) + '/' + CARROTS.length, 16, 10);
        const e = 'Even ' + pct() + '%   Dmitriy ' + DMITRIY + '%';
        text(e, SW - 16 - e.length * 6, 10);
        const b = 'Best ' + getBest('carrotpct') + '%';
        text(b, SW - 16 - b.length * 6, 22);
        // Dmitriy, with what he thought of the last carrot
        ctx.drawImage(dima.down[0], 14, 30, 36, 36);
        box(54, 36, 250, 24); text(remark, 64, 45);
        // the cutting board
        ctx.fillStyle = '#6a4a20'; ctx.fillRect(14, 86, SW - 28, 96);
        ctx.fillStyle = '#c89058'; ctx.fillRect(16, 88, SW - 32, 92);
        ctx.fillStyle = '#b88048';
        for (let y = 94; y < 178; y += 9) ctx.fillRect(18, y, SW - 36, 1);
        // the carrot: orange, leafy top on the right, only drawn on the board
        ctx.save();
        ctx.beginPath(); ctx.rect(16, 88, SW - 32, 92); ctx.clip();
        const x0 = Math.round(cx);
        ctx.fillStyle = '#58a848';
        for (let i = 0; i < 4; i++) ctx.fillRect(x0 + len + 1, CY - 8 + i * 6, 10 + (i & 1) * 4, 3);
        ctx.fillStyle = col.dark; ctx.fillRect(x0 - 1, CY - CH / 2 - 1, len + 2, CH + 2);
        ctx.fillStyle = '#f08a20'; ctx.fillRect(x0, CY - CH / 2, len, CH);
        ctx.fillStyle = '#f8b060'; ctx.fillRect(x0, CY - CH / 2 + 2, len, 2);
        ctx.fillStyle = '#c86a10'; ctx.fillRect(x0, CY + CH / 2 - 3, len, 2);
        ctx.fillStyle = '#c89058'; ctx.fillRect(x0 - 1, CY - CH / 2 - 1, 4, 3); ctx.fillRect(x0 - 1, CY + CH / 2 - 2, 4, 3);
        // the lines to cut on, and the cuts you've made
        for (const l of lines) {
          if (l.cut) continue;
          ctx.fillStyle = '#f8f8f8';
          for (let y = CY - CH / 2 - 6; y < CY + CH / 2 + 6; y += 4) ctx.fillRect(x0 + l.at, y, 1, 2);
        }
        ctx.fillStyle = '#c89058';
        for (const c of cuts) ctx.fillRect(x0 + Math.round(c), CY - CH / 2 - 1, 2, CH + 2);
        ctx.restore();
        // the knife: up and ready, or down mid-chop
        const ky = chop ? CY - CH / 2 - 4 : CY - 52;
        ctx.fillStyle = col.dark; ctx.fillRect(KNIFE - 2, ky - 22, 5, 14);
        ctx.fillStyle = '#5a3420'; ctx.fillRect(KNIFE - 1, ky - 21, 3, 12);
        ctx.fillStyle = col.dark; ctx.fillRect(KNIFE - 6, ky - 9, 9, 22);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(KNIFE - 5, ky - 8, 7, 20);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(KNIFE + 1, ky - 8, 1, 20);
        if (!chop) { ctx.fillStyle = 'rgba(24,24,32,0.25)'; ctx.fillRect(KNIFE, 92, 1, 84); }
        if (pop) text(pop.s, KNIFE + 14, 98, 1, pop.s === 'Perfect!' ? '#2c6a34' : pop.s === 'Good' ? '#3050a8' : '#b83028');
        if (state === 'ready') readyBox(t, 'Space: chop on the line');
        else if (state === 'done') doneBox([pct() > DMITRIY ? 'Dmitriy is impressed!' : 'Dmitriy shakes his head.',
          'Evenness ' + pct() + '%  Dmitriy ' + DMITRIY + '%',
          record ? 'New record!' : 'Best ' + getBest('carrotpct') + '%'], t);
        else text('Space: chop   Esc: put the knife down', 16, SH - 14);
      },
    };
    return self;
  }

  // ---------- Patrick's dance-off: hit the arrows on the beat of the rave song ----------
  // Arrows rise up their lanes and you press each one as it reaches the targets at the
  // top. Timing follows the rave song itself (or a steady 140bpm with the music off),
  // counted in eighth-note steps like the song is. Out-score Patrick to win.
  // With `vs` (a match with another player) you both get the same arrows, from the match's
  // shared random numbers, and each of you sees the other's score as they dance. The
  // higher score when you've both finished the song wins.
  function DanceGame(vs) {
    const LANES = ['left', 'down', 'up', 'right'], LANE_COLS = ['#ff2a6d', '#05d9e8', '#39ff14', '#f9f871'];
    const LX = 104, LW = 28, TY = 34, PX = 9; // first lane, lane width, target row, pixels per step
    // Timing windows and lengths, in steps. On a touch screen the D-pad is slower to hit than
    // a key, so the windows are wider and the chart is gentler (see below). Against a
    // player, that's whenever either of you is on touch, so you both get the same.
    const soft = vs ? vs.soft : isTouch, rnd = vs ? vs.rng : Math.random;
    const PERFECT = soft ? 0.7 : 0.5, GOOD = soft ? 1.4 : 1, LEN = 128, LEAD = 16;
    const foe = vs ? vs.name : 'Patrick';
    const patrick = vs ? vs.sprites : spritesFor('Patrick');
    // The chart: half notes to warm up, then every beat, then some off-beats to finish.
    // On touch it stays on the beat at the end, and never asks for the same arrow twice
    // in a row (that means lifting your thumb off the pad and pressing again).
    const notes = [];
    for (let s = 0; s < LEN; s += s < 32 ? 4 : s < 96 || soft ? 2 : rnd() < 0.45 ? 1 : 2) {
      let lane;
      do lane = Math.floor(rnd() * 4);
      while (notes.length && notes[notes.length - 1].lane === lane && (soft || (notes.length > 1 && notes[notes.length - 2].lane === lane)));
      notes.push({ s, lane, hit: null });
    }
    // Patrick is good, not perfect; a player's score is whatever they last sent
    let PATRICK = vs ? 0 : 62 + Math.floor(Math.random() * 14);
    let state = 'play', t = 0, pos = -LEAD, lastMp = null, synced = false;
    let pts = 0, combo = 0, maxCombo = 0, judge = null, flash = [0, 0, 0, 0], move = 'down', record = false;
    let theirsDone = false, sentPct = 0, sendT = 0;
    const pct = () => Math.round(100 * pts / (notes.length * 2));
    function rate(word, color, lane) { judge = { word, color, t: 0 }; if (lane >= 0) flash[lane] = 10; }
    const self = {
      music: 'rave',
      update() {
        t++;
        if (vs) {
          for (let m; (m = vs.take());) {
            PATRICK = Math.max(0, Math.min(100, Math.round(+m.p) || 0));
            if (m.e === 'f') theirsDone = true;
          }
          // your score as you go, at most every 10 ticks
          if (++sendT >= 10 && pct() !== sentPct && state === 'play') { vs.send({ e: 's', p: pct() }); sentPct = pct(); sendT = 0; }
          if (vs.gone && !theirsDone && state !== 'gone') { state = 'gone'; t = 0; }
          if (state === 'wait' && theirsDone) { state = 'done'; t = 0; sfx(pct() > PATRICK ? 'cup' : 'bump'); }
          if (state === 'done' || state === 'gone') {
            if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
              remove(self); vs.end();
              say(state === 'gone' ? foe + ' left the dance floor. Nobody wins this one.'
                : pct() > PATRICK ? 'You out-danced ' + foe + ', ' + pct() + '% to ' + PATRICK + '%!'
                  : pct() < PATRICK ? foe + ' out-danced you, ' + PATRICK + '% to ' + pct() + '%.'
                    : 'A dead heat: ' + pct() + '% each.');
            }
            return;
          }
          if (state === 'wait') { if (pressed.has('b')) { remove(self); vs.end(); say('You leave the dance floor.'); } return; }
        }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            if (pct() > PATRICK && MAPS.floors[P.floor].rooms.some((r) => r.rave)) {
              say('Patrick: ' + pct() + '% to my ' + PATRICK + '%? You can actually dance! EVERYBODY IN HERE!', () => ui.push(PartyTime()));
            } else say(pct() > PATRICK ? 'Patrick: You can actually dance! Respect. ' + pct() + '% to my ' + PATRICK + '%.'
              : 'Patrick: ' + PATRICK + '% to your ' + pct() + '%. Come back when you\'ve warmed up!');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); if (vs) { vs.end(); say('You leave the dance floor.'); } else say('Patrick: Leaving the floor already? More room for me.'); return; }
        // follow the song when it's playing; otherwise count 140bpm ticks ourselves
        const mp = musicPos('rave');
        if (mp === null) pos += 1 / 12.86;
        else if (!synced) {
          // line the chart up so it starts on a bar of the song, a couple of bars from now
          synced = true;
          pos = mp - (Math.ceil(mp / 8) * 8 + LEAD);
        } else pos += mp - lastMp;
        lastMp = mp;
        if (judge) judge.t++;
        flash = flash.map((f) => Math.max(0, f - 1));
        // arrows pressed: take the closest unhit note in that lane
        LANES.forEach((k, lane) => {
          if (!pressed.has(k)) return;
          move = k;
          let best = null;
          for (const n of notes) if (n.lane === lane && !n.hit && Math.abs(n.s - pos) <= GOOD && (!best || Math.abs(n.s - pos) < Math.abs(best.s - pos))) best = n;
          if (!best) return; // a stray press costs nothing
          const d = Math.abs(best.s - pos);
          best.hit = d <= PERFECT ? 'perfect' : 'good';
          pts += d <= PERFECT ? 2 : 1;
          maxCombo = Math.max(maxCombo, ++combo);
          rate(d <= PERFECT ? 'PERFECT' : 'GOOD', d <= PERFECT ? '#f9f871' : '#05d9e8', lane);
        });
        // anything that's slipped past the targets is a miss
        for (const n of notes) if (!n.hit && pos - n.s > GOOD) { n.hit = 'miss'; combo = 0; rate('MISS', '#ff2a6d', -1); }
        if (pos > LEN + 4) {
          // against a player: send your final score, then wait for theirs
          if (vs) { vs.send({ e: 'f', p: pct() }); state = 'wait'; t = 0; return; }
          state = 'done'; t = 0;
          record = saveBest('dance', pct());
          if (pct() > PATRICK) { questNote('danceoff', 1); sfx('cup'); } else sfx('bump');
        }
      },
      draw() {
        const step = Math.floor(pos), beat = step >> 1;
        // the dance floor, lit up on the beat like the office
        ctx.fillStyle = '#140024'; ctx.fillRect(0, 0, SW, SH);
        for (let ty = 0; ty < SH / 16; ty++)
          for (let tx = 0; tx < SW / 16; tx++) {
            if ((tx + ty + beat) & 1) continue;
            ctx.fillStyle = RAVE_COLS[(tx * 3 + ty * 5 + (beat & 0xffff)) % RAVE_COLS.length];
            ctx.globalAlpha = 0.18; ctx.fillRect(tx * 16, ty * 16, 16, 16);
          }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fillRect(LX - 4, 0, LW * 4 + 8, SH);
        // you and Patrick, dancing on either side
        const bop = (step & 1) ? 0 : 3;
        ctx.drawImage(sprites[move][1 + (beat & 1)], 22, 100 - bop, 56, 56);
        const pDir = ['down', 'left', 'down', 'right', 'up', 'right', 'down', 'left'][beat & 7];
        ctx.drawImage(patrick[pDir][1 + (beat & 1)], 242, 100 - bop, 56, 56);
        text('You', 41, 162, 1, '#f8f8f8');
        text(foe, 270 - foe.length * 3, 162, 1, '#f8f8f8');
        text(pct() + '%', 50 - String(pct()).length * 3 - 3, 176, 1, '#f9f871');
        // Patrick's score is a surprise until the end; a player's goes up as they dance
        text(PATRICK + '%', 270 - String(PATRICK).length * 3 - 3, 176, 1, state === 'done' || vs ? '#f9f871' : '#606080');
        // targets, then the arrows on their way up
        LANES.forEach((k, lane) => {
          arrow(k, LX + lane * LW + 4, TY, flash[lane] ? '#ffffff' : '#505070', true);
        });
        for (const n of notes) {
          if (n.hit && n.hit !== 'miss') continue;
          const y = TY + (n.s - pos) * PX;
          if (y > SH || y < -20) continue;
          arrow(LANES[n.lane], LX + n.lane * LW + 4, Math.round(y), n.hit === 'miss' ? '#585868' : LANE_COLS[n.lane]);
        }
        if (judge && judge.t < 30) text(judge.word, 160 - judge.word.length * 6, 70 - (judge.t >> 3), 2, judge.color);
        if (combo > 4) text(combo + ' combo', 160 - (String(combo).length + 6) * 3, 92, 1, '#f8f8f8');
        text('DANCE-OFF', 4, 4, 1, '#f8f8f8');
        const b = 'Best ' + getBest('dance') + '%';
        if (!vs) text(b, SW - 4 - b.length * 6, 4, 1, '#a0a0c8');
        if (pos < 0) {
          box(60, 120, 200, 48);
          ctext(pos < -8 ? (vs ? 'Dance-off with ' + foe + '!' : 'Patrick wants a dance-off!') : 'Get ready... ' + Math.ceil(-pos / 2), 132);
          ctext('Arrows on the beat', 148);
        }
        if (state === 'wait') { box(60, 100, 200, 40); ctext('Waiting for ' + foe + '...', 108); ctext('to finish the song', 122); }
        else if (state === 'gone') doneBox([foe + ' left the floor.', 'Nobody wins this one.'], t);
        else if (state === 'done' && vs) doneBox([pct() > PATRICK ? 'You out-danced ' + foe + '!' : pct() < PATRICK ? foe + ' wins!' : 'A dead heat!',
          'You ' + pct() + '%  ' + foe + ' ' + PATRICK + '%', 'Your best combo ' + maxCombo], t);
        else if (state === 'done') doneBox([pct() > PATRICK ? 'You out-danced Patrick!' : 'Patrick wins!',
          'You ' + pct() + '%  Patrick ' + PATRICK + '%  Combo ' + maxCombo, record ? 'New record!' : 'Best ' + getBest('dance') + '%'], t);
      },
    };
    // a chunky pixel arrow pointing k, 20px square at (x, y); hollow for the targets
    function arrow(k, x, y, color, hollow) {
      const UP = ['....##....', '...####...', '..######..', '.########.', '##########', '...####...', '...####...', '...####...', '...####...', '...####...'];
      const on = (cx, cy) => cx >= 0 && cy >= 0 && cx < 10 && cy < 10 && UP[cy][cx] === '#';
      for (let cy = 0; cy < 10; cy++)
        for (let cx = 0; cx < 10; cx++) {
          if (!on(cx, cy)) continue;
          if (hollow && on(cx - 1, cy) && on(cx + 1, cy) && on(cx, cy - 1) && on(cx, cy + 1)) continue;
          const [px, py] = k === 'up' ? [cx, cy] : k === 'down' ? [cx, 9 - cy] : k === 'left' ? [cy, cx] : [9 - cy, cx];
          ctx.fillStyle = '#000000'; ctx.fillRect(x + px * 2 + 1, y + py * 2 + 1, 2, 2);
          ctx.fillStyle = color; ctx.fillRect(x + px * 2, y + py * 2, 2, 2);
        }
    }
    return self;
  }

  // ---------- the dance party: win the dance-off and the whole office piles in ----------
  // For a few seconds everybody (bar Linda) dances in the rave room with you, then they
  // all wander back to wherever they were. Nobody actually moves; drawWorld just draws
  // the party guests on the dance floor instead of at their desks while it's on.
  let party = null; // { names: Set, dancers: [{ x, y, sprites, phase }] }
  function PartyTime() {
    const room = MAPS.floors[P.floor].rooms.find((r) => r.rave) || { x1: 0, y1: 0, x2: -1, y2: -1 };
    const spots = [];
    for (let y = room.y1; y <= room.y2; y++)
      for (let x = room.x1; x <= room.x2; x++)
        if (NPC_FLOOR.includes(tileAt(P.floor, x, y)) && !(x === P.x && y === P.y)) spots.push([x, y]);
    const guests = npcs.filter((n) => !n.ghost && !n.extra);
    // the people already in the room stay where they are; everyone else squeezes in around them
    const taken = new Set();
    const dancers = [];
    for (const n of guests) if (n.floor === P.floor && n.x >= room.x1 && n.x <= room.x2 && n.y >= room.y1 && n.y <= room.y2) {
      taken.add(n.x + ',' + n.y); dancers.push({ name: n.name, x: n.x, y: n.y, sprites: n.sprites });
    }
    const free = spots.filter(([x, y]) => !taken.has(x + ',' + y));
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    for (const n of guests) {
      if (!free.length) break;
      if (dancers.some((d) => d.name === n.name)) continue;
      const [x, y] = free.pop();
      dancers.push({ name: n.name, x, y, sprites: n.sprites });
    }
    dancers.forEach((d, i) => { d.phase = (i * 3) % 8; });
    party = { names: new Set(dancers.map((d) => d.name)), dancers };
    const bits = [];
    let t = 0;
    sfx('cup');
    const self = {
      music: 'rave',
      update() {
        t++;
        if (bits.length < 90) for (let k = 0; k < 3; k++)
          bits.push({ x: Math.random() * SW, y: -4 - Math.random() * 40, v: 0.6 + Math.random() * 1.2, c: RAVE_COLS[Math.floor(Math.random() * RAVE_COLS.length)], w: Math.random() * 6 });
        for (const b of bits) { b.y += b.v; b.x += Math.sin((t + b.w * 20) / 10) * 0.5; if (b.y > SH) b.y -= SH + 10; }
        if (t > 420 || (t > 60 && pressed.has('b'))) {
          party = null; remove(self);
          say('The whole office danced with you! Everyone drifts back to their desks, grinning.');
        }
      },
      draw() {
        for (const b of bits) { ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 2); }
        const msg = 'DANCE PARTY!';
        const y = 18 + Math.round(Math.sin(t / 8) * 3);
        text(msg, ((SW - msg.length * 12) >> 1) + 1, y + 1, 2, '#000000');
        text(msg, (SW - msg.length * 12) >> 1, y, 2, RAVE_COLS[(t >> 3) % RAVE_COLS.length]);
      },
    };
    return self;
  }

  // ---------- Kiki's candy jar: closest guess takes the round ----------
  // A round where you're both the same distance off goes to nobody. Nobody on 2 rounds
  // after 3 (1-1 with a tie, say) is a draw, and you play the whole match again.
  // With `vs` (a match with another player) you both get the same jars, from the match's
  // shared random numbers, and each round is revealed once you've both locked in. A draw
  // against a player is just a draw.
  function CandyJarGame(vs) {
    const ROUNDS = 3, COLS = ['#f85848', '#f8d848', '#78e060', '#68a0f8', '#d870d0', '#f0b030'];
    const foe = vs ? vs.name : 'Kiki', rnd = vs ? vs.rng : Math.random;
    const kiki = vs ? vs.sprites : spritesFor('Kiki');
    let round = 0, state = 'look', t = 0, real = 0, guess = 0, hers = 0, score = [0, 0], record = false;
    const theirs = {}; // against a player: their guess, by round
    const decided = () => Math.max(score[0], score[1]) >= 2;
    function newJar() {
      real = 18 + Math.floor(rnd() * 75);
      guess = 40; hers = 0; state = 'look'; t = 0;
    }
    function judge() {
      const mine = Math.abs(guess - real), them = Math.abs(hers - real);
      if (mine < them) { score[0]++; sfx('ding'); } else if (mine > them) { score[1]++; sfx('buzz'); } else sfx('bump');
      state = 'reveal'; t = 0;
    }
    newJar();
    const self = {
      music: 'candy',
      update() {
        t++;
        if (vs) {
          for (let m; (m = vs.take());) if (m.r >= 0 && m.g >= 1) theirs[m.r] = Math.round(m.g);
          if (vs.gone && state !== 'done' && state !== 'gone') { state = 'gone'; t = 0; }
          if (state === 'gone') {
            if (t > 30 && (pressed.has('a') || pressed.has('b'))) { remove(self); vs.end(); say(foe + ' has gone. The jar is all yours.'); }
            return;
          }
          if (state === 'done') {
            if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
              remove(self); vs.end();
              say(!decided() ? 'You and ' + foe + ' are dead even.'
                : score[0] > score[1] ? 'You out-guessed ' + foe + ' ' + score[0] + '-' + score[1] + '!'
                  : foe + ' out-guessed you ' + score[1] + '-' + score[0] + '.');
            }
            return;
          }
        }
        if (state === 'look') { if (t > 150) { state = 'guess'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && !decided() && pressed.has('a')) { round = 0; score = [0, 0]; record = false; newJar(); return; }
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(!decided() ? 'Kiki: "We\'ll settle this another time."'
              : score[0] > score[1] ? 'You out-guessed Kiki ' + score[0] + '-' + score[1] + '. She hands over the jar.'
                : 'Kiki wins ' + score[1] + '-' + score[0] + '. She has had a lot of practice.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); if (vs) vs.end(); say('You leave the jar alone. Mostly.'); return; }
        if (state === 'wait') { if (theirs[round] !== undefined) { hers = theirs[round]; judge(); } return; }
        if (state === 'reveal') {
          if (t > 110) {
            if (++round >= ROUNDS) {
              state = 'done'; t = 0;
              // only a decided match counts; 2 rounds always beats Kiki's 1 or fewer
              if (decided() && !vs) record = saveBest('jar', score[0]);
              return;
            }
            newJar();
          }
          return;
        }
        // guessing: arrows nudge, held arrows run
        const step = (held.a ? 5 : 1);
        if (pressed.has('up') || (held.up && t % 4 === 0)) guess = Math.min(120, guess + step);
        if (pressed.has('down') || (held.down && t % 4 === 0)) guess = Math.max(1, guess - step);
        if (pressed.has('a') && t > 10) {
          if (vs) { sfx('select'); vs.send({ r: round, g: guess }); state = 'wait'; return; }
          // Kiki guesses close, but not perfectly, and never the same as you
          do { hers = Math.max(1, real + Math.round((Math.random() - 0.5) * 26)); } while (hers === guess);
          judge();
        }
      },
      draw() {
        box(0, 0, SW, SH);
        text('Round ' + Math.min(round + 1, ROUNDS) + '/' + ROUNDS, 16, 10);
        text('You ' + score[0] + ' - ' + score[1] + ' ' + foe, 150, 10);
        const b = 'Best ' + getBest('jar');
        if (!vs) text(b, SW - 16 - b.length * 6, 26);
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
        text(foe, 256 - foe.length * 3, 158);
        if (state === 'look') {
          ctext('Count them! ' + Math.ceil((150 - t) / 60) + 's', 196);
        } else if (state === 'guess' || state === 'wait') {
          ctext(state === 'wait' ? 'Waiting for ' + foe + '...' : 'How many sweets?', 180);
          box(110, 192, 100, 30);
          const g = String(guess);
          text(g, 160 - g.length * 6, 200, 2);
          if (state === 'guess') text('Up/Down, Space to lock in', 56, 228);
        } else if (state !== 'gone') {
          box(28, 176, 264, 56);
          text('Really: ' + real, 40, 186);
          text('You: ' + guess + '   ' + foe + ': ' + hers, 40, 202);
          const mine = Math.abs(guess - real), them = Math.abs(hers - real);
          text(mine < them ? 'You take the round!' : mine > them ? foe + ' takes the round!' : 'Tied! Nobody scores.', 40, 218, 1,
            mine < them ? '#2c6a34' : mine > them ? '#b83028' : '#3050a8');
        }
        if (state === 'gone') doneBox([foe + ' has gone.', 'The jar is all yours.'], t);
        else if (state === 'done' && vs) {
          doneBox([!decided() ? 'Dead even!' : score[0] > score[1] ? 'You win the jar!' : foe + ' wins the jar.',
            'Rounds: ' + score[0] + ' - ' + score[1]], t);
        } else if (state === 'done') {
          if (!decided()) doneBox([score[0] === score[1] ? 'Dead even!' : 'Too close to call!',
            'Rounds: ' + score[0] + ' - ' + score[1], 'Space: play again  Esc: leave'], t);
          else doneBox([score[0] > score[1] ? 'You win the jar!' : 'Kiki wins.',
            'Rounds: ' + score[0] + ' - ' + score[1], record ? 'New record!' : 'Best ' + getBest('jar')], t);
        }
      },
    };
    return self;
  }

  // ---------- Halloween: costumes, the boardroom party and Lam's costume contest ----------
  // Sit on a boardroom chair to start the party. The guests are ordinary NPCs added to
  // `npcs` for as long as it lasts (so they wander and talk like anyone else); the real
  // coworkers stay at their desks, out of sight behind the shut doors. Lam runs the
  // costume contest, and once that's over the splash screen puts everything back.
  const COSTUME_KEYS = Object.keys(Art.COSTUMES);
  if (!Art.COSTUMES[hw.costume]) hw.costume = COSTUME_KEYS[0];
  const shuffled = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  function wearCostume(key) {
    if (Art.COSTUMES[key]) hw.costume = key;
    hw.worn = true;
    sprites = Art.renderCostume(pick.gender, Art.LOOKS[pick.gender][pick.index], hw.costume, sdgIcon);
  }
  const propAt = (fi, x, y) => (hw.state === 'party' && fi === hw.floor && hw.props.find((p) => p.x === x && p.y === y)) || null;
  const doorShut = (fi, x, y) => hw.state === 'party' && fi === hw.floor && hw.doors.some((d) => d.x === x && d.y === y);

  // Who comes: Lam (the MC), eight others at random, each in a different costume, and Linda.
  function pickGuests() {
    const lines = window.COSTUME_LINES || {};
    const others = shuffled(npcs.filter((n) => !n.ghost && !n.extra && !n.guest && n.name !== 'Lam' && !(visit && n === visit.npc))).slice(0, 8);
    const outfits = shuffled(COSTUME_KEYS.concat(['ghost']));
    const guests = ['Lam'].concat(others.map((n) => n.name)).map((name, i) => {
      const costume = outfits[i % outfits.length], { body, look } = lookFor(name);
      const own = ((window.PEOPLE || {})[name] || {}).halloween;
      return {
        name, costume, guest: true, ghost: false,
        outfit: costume === 'ghost' ? 'Bedsheet Ghost' : Art.COSTUMES[costume].name,
        sprites: costume === 'ghost' ? Art.renderSprites('ghost', {}) : Art.renderCostume(body, look, costume, sdgIcon),
        lines: (lines[costume] || ['Happy Halloween!']).concat(own ? [own] : []),
      };
    });
    guests.push({
      name: 'Linda', costume: 'none', outfit: 'Actual Ghost', guest: true, ghost: true, sprites: Art.renderSprites('ghost', {}),
      lines: ['Everyone keeps complimenting my costume. I\'m not wearing a costume.', 'Finally, a party where I blend in. Boo.'],
    });
    return guests;
  }
  function startParty() {
    const r = hw.room, fi = hw.floor;
    hw.back = { x: P.x, y: P.y, dir: P.dir };
    hw.state = 'party';
    const nearDoor = (x, y) => hw.doors.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 2);
    const spots = [];
    for (let y = r.y1; y <= r.y2; y++)
      for (let x = r.x1; x <= r.x2; x++)
        if (NPC_FLOOR.includes(tileAt(fi, x, y)) && !npcAt(fi, x, y) && !nearDoor(x, y) && !playerAt(x, y) && !propAt(fi, x, y)) spots.push([x, y]);
    const free = shuffled(spots);
    hw.guests = pickGuests();
    for (const g of hw.guests) {
      // Lam waits at the head of the table by the TVs, so he's easy to find
      const mc = g.name === 'Lam', li = mc ? free.findIndex(([x, y]) => x === r.x2 - 2 && y === r.y1 + 5) : -1;
      const at = li >= 0 ? free.splice(li, 1)[0] : free.pop();
      if (!at) continue;
      Object.assign(g, { floor: fi, room: r, x: at[0], y: at[1], dir: mc ? 'left' : 'down', moving: false, prog: 0, mdx: 0, mdy: 0, step: 0,
        wait: mc ? Infinity : 30 + Math.floor(Math.random() * 120) });
      npcs.push(g);
    }
    say('The lights dim and the doors swing shut. Happy Halloween! Mingle, and try the games dotted around the room. When you\'re ready for the costume contest, go and see Lam.');
  }
  function endParty() {
    for (let i = npcs.length - 1; i >= 0; i--) if (npcs[i].guest) npcs.splice(i, 1);
    hw.guests = [];
    if (hw.back) Object.assign(P, hw.back, { floor: hw.floor, moving: false, prog: 0, walked: false, bump: 0 });
    hw.back = null;
    hw.state = 'done';
    curRoom = roomAt(P.floor, P.x, P.y);
    roomName = curRoom ? curRoom.name : null;
    questQueue.push('The lights come back up and everyone drifts back to their desks. Back to work!');
  }
  function guestTalk(npc, says) {
    if (npc.name !== 'Lam') { say(says(npc.lines[Math.floor(Math.random() * npc.lines.length)])); return; }
    ask(says('I\'m your MC tonight! Are you ready to walk the catwalk in the Haakon costume contest?'), ['I\'M READY', 'STILL MINGLING'], (i) => {
      if (i === 0) { sfx('menu'); ui.push(CostumeContest()); } else say(says('Take your time. The punch is... a colour.'));
    });
  }

  // Decorations, drawn over the boardroom. Pass 0 goes under the people; pass 1 goes over
  // them: the dimmed lights (while the party is on), what glows in the dark, and the bats.
  function drawPumpkinAt(x, y, lit) {
    ctx.fillStyle = '#2c6a34'; ctx.fillRect(x + 4, y, 2, 2);
    ctx.fillStyle = '#f08020'; ctx.fillRect(x + 1, y + 2, 8, 7); ctx.fillRect(x, y + 3, 10, 5);
    ctx.fillStyle = '#c05810'; ctx.fillRect(x + 3, y + 2, 1, 7); ctx.fillRect(x + 6, y + 2, 1, 7);
    ctx.fillStyle = lit ? ((tick >> 3) % 3 ? '#f8e040' : '#f8b830') : '#402008';
    ctx.fillRect(x + 2, y + 4, 2, 2); ctx.fillRect(x + 6, y + 4, 2, 2);
    ctx.fillRect(x + 2, y + 7, 6, 1); ctx.fillRect(x + 3, y + 6, 1, 1); ctx.fillRect(x + 6, y + 6, 1, 1);
  }
  function drawBatAt(x, y, up, color) {
    ctx.fillStyle = color || '#4a2c78';
    ctx.fillRect(x - 1, y, 2, 3); ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1);
    const wy = up ? y - 2 : y + 1;
    ctx.fillRect(x - 5, wy, 4, 2); ctx.fillRect(x + 1, wy, 4, 2);
    ctx.fillRect(x - 7, wy + (up ? -1 : 1), 2, 2); ctx.fillRect(x + 5, wy + (up ? -1 : 1), 2, 2);
  }
  const BUNTING = ['#f08020', '#7b3fb8', '#181820'];
  function drawHalloween(cx, cy, pass) {
    const r = hw.room, on = hw.state === 'party';
    const X = (tx) => tx * 16 - cx, Y = (ty) => ty * 16 - cy;
    const x0 = X(r.x1), y0 = Y(r.y1), w = (r.x2 - r.x1 + 1) * 16, h = (r.y2 - r.y1 + 1) * 16;
    if (x0 > SW || y0 - 16 > SH || x0 + w < 0 || y0 + h + 16 < 0) return;
    // table tiles the pumpkins and candles sit on, and one pumpkin on the counter
    const pumpkins = [[r.x1 + 5, r.y1 + 4], [r.x1 + 14, r.y1 + 6], [r.x1 + 2, r.y2]].map(([tx, ty]) => [X(tx) + 3, Y(ty) + 2]);
    const candles = [[r.x1 + 7, r.y1 + 6], [r.x1 + 12, r.y1 + 5]].map(([tx, ty]) => [X(tx) + 7, Y(ty) + 3]);
    if (pass === 0) {
      // bunting and cobwebs along the top wall, and a spider on a thread
      const by = y0 - 9;
      ctx.fillStyle = '#181820'; ctx.fillRect(x0, by - 1, w, 1);
      for (let i = 0; i * 8 < w; i++) {
        ctx.fillStyle = BUNTING[i % 3];
        for (let k = 0; k < 3; k++) ctx.fillRect(x0 + i * 8 + 1 + k, by + k * 2, 6 - k * 2, 2);
      }
      ctx.fillStyle = '#f8f8f8';
      for (let i = 0; i < 11; i++) {
        ctx.fillRect(x0 + i, y0 - 11 + i, 1, 1); ctx.fillRect(x0 + w - 1 - i, y0 - 11 + i, 1, 1);
        if (i % 4 === 3) { ctx.fillRect(x0, y0 - 11 + i, i, 1); ctx.fillRect(x0 + w - i, y0 - 11 + i, i, 1); }
      }
      const sx = X(r.x1 + 9) + 8, drop = 10 + Math.round(Math.sin(tick / 40) * 5);
      ctx.fillStyle = '#f8f8f8'; ctx.fillRect(sx, y0 - 10, 1, drop);
      ctx.fillStyle = '#181820'; ctx.fillRect(sx - 2, y0 - 10 + drop, 5, 3); ctx.fillRect(sx - 1, y0 - 11 + drop, 3, 5);
      ctx.fillRect(sx - 4, y0 - 10 + drop, 1, 1); ctx.fillRect(sx + 4, y0 - 10 + drop, 1, 1);
      ctx.fillRect(sx - 4, y0 - 8 + drop, 1, 1); ctx.fillRect(sx + 4, y0 - 8 + drop, 1, 1);
      // a bowl of candy on the near edge of the table
      const bx = X(r.x1 + 10), byy = Y(r.y1 + 7) + 4;
      ctx.fillStyle = '#181820'; ctx.fillRect(bx, byy, 16, 9);
      ctx.fillStyle = '#7b3fb8'; ctx.fillRect(bx + 1, byy + 1, 14, 7);
      ['#f08020', '#f8f8f8', '#f8e040', '#58a848', '#f08020', '#e03030'].forEach((c, i) => {
        ctx.fillStyle = c; ctx.fillRect(bx + 2 + (i % 3) * 4, byy + 2 + (i > 2 ? 3 : 0), 3, 2);
      });
      for (const [px, py] of pumpkins) drawPumpkinAt(px, py, false);
      for (const [px, py] of candles) { ctx.fillStyle = '#f8f8f8'; ctx.fillRect(px, py + 3, 2, 6); ctx.fillStyle = '#f0b030'; ctx.fillRect(px, py + (tick >> 3 & 1), 2, 3); }
      // the party games: the apple tub, the toilet rolls, a knife by the counter pumpkin
      // and whatever is in the cupboard
      if (on) {
        for (const p of hw.props) {
          const px = X(p.x), py = Y(p.y);
          if (p.kind === 'bucket') {
            ctx.fillStyle = '#181820'; ctx.fillRect(px + 1, py + 3, 14, 12);
            ctx.fillStyle = '#7a5028'; ctx.fillRect(px + 2, py + 4, 12, 10);
            ctx.fillStyle = '#a8a8b0'; ctx.fillRect(px + 2, py + 10, 12, 1);
            ctx.fillStyle = '#3878c8'; ctx.fillRect(px + 3, py + 4, 10, 4);
            ctx.fillStyle = '#d02830';
            [4, 8, 11].forEach((ax, i) => ctx.fillRect(px + ax, py + 4 + (((tick >> 4) + i) & 1), 2, 2));
          } else {
            [[2, 8], [9, 8], [5, 2]].forEach(([rx, ry]) => {
              ctx.fillStyle = '#181820'; ctx.fillRect(px + rx - 1, py + ry - 1, 7, 8);
              ctx.fillStyle = '#f8f8f8'; ctx.fillRect(px + rx, py + ry, 5, 6);
              ctx.fillStyle = '#a8a8b0'; ctx.fillRect(px + rx + 2, py + ry + 2, 1, 2);
            });
          }
        }
        const kx = X(r.x1 + 3) + 4, ky = Y(r.y2) + 7;
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(kx, ky, 7, 2); ctx.fillStyle = '#5a3420'; ctx.fillRect(kx + 7, ky, 4, 2);
        const gx = X(r.x1 + 11) - 4, gy = Y(r.y2) - 2 - ((tick >> 5) & 1);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(gx, gy, 8, 6); ctx.fillRect(gx + 1, gy - 1, 6, 1);
        ctx.fillStyle = '#181820'; ctx.fillRect(gx + 2, gy + 2, 1, 2); ctx.fillRect(gx + 5, gy + 2, 1, 2);
      }
      // the doors, barred until it's over
      if (on) for (const d of hw.doors) {
        ctx.fillStyle = '#181820'; ctx.fillRect(X(d.x), Y(d.y) + 6, 16, 4);
        ctx.fillStyle = '#f08020'; ctx.fillRect(X(d.x), Y(d.y) + 7, 16, 2);
      }
      return;
    }
    if (on) {
      ctx.fillStyle = 'rgba(10, 4, 30, 0.55)';
      ctx.fillRect(x0, y0 - 4, w, h + 4);
      // candlelight: the pumpkins and candles glow through the dark
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0 - 4, w, h + 4); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      pumpkins.concat(candles).forEach(([px, py], i) => {
        const flick = Math.sin(tick / 5 + i * 2.3) * 2;
        ctx.fillStyle = '#f08020';
        ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(px + 5, py + 5, 26 + flick, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(px + 5, py + 5, 13 + flick, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      for (const [px, py] of pumpkins) drawPumpkinAt(px, py, true);
      for (const [px, py] of candles) { ctx.fillStyle = '#f8e040'; ctx.fillRect(px, py + (tick >> 3 & 1), 2, 3); }
    }
    for (let i = 0; i < 4; i++) {
      const a = tick / (50 + i * 9) + i * 1.9;
      drawBatAt(Math.round(x0 + w / 2 + Math.sin(a) * w * 0.42), Math.round(y0 + h / 2 + Math.sin(a * 1.7 + i) * h * 0.38), (tick >> 3) + i & 1, on ? '#a070e0' : '#4a2c78');
    }
  }

  // ---------- Halloween party games: things to do in the boardroom while you mingle ----------
  // What's at (tx, ty) to play with, while the party is on: [what it says, the yes option, the game].
  function partyGameAt(tx, ty, t) {
    const r = hw.room;
    if (hw.state !== 'party' || P.floor !== hw.floor || tx < r.x1 || tx > r.x2 || ty < r.y1 || ty > r.y2) return null;
    const p = propAt(P.floor, tx, ty);
    if (p) return p.kind === 'bucket' ? ['A tub of water with apples bobbing in it.', 'BOB FOR APPLES', BobGame]
      : ['A mountain of toilet rolls. Somebody raided the supply cupboard.', 'WRAP A MUMMY', MummyGame];
    if (t === 'k') return ['A pumpkin, a knife and a picture of how it should look.', 'CARVE IT', CarveGame];
    if (tx === r.x1 + 10 && ty === r.y1 + 7) return ['A huge bowl of Halloween candy. Somebody is about to tip it out.', 'TRICK OR TREAT', TreatGame];
    if (t === 'b') return ['The cupboard doors keep creaking open. Something is in there.', 'SHUT THEM IN', GhostGame];
    return null;
  }

  // Bobbing for apples: slide along the tub and dunk when an apple is under you.
  function BobGame() {
    const TIME = 30 * 60, WATER = 152, X0 = 44, X1 = 276;
    const float = () => {
      const r = Math.random();
      return { x: X0 + 14 + Math.random() * (X1 - X0 - 28), v: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9),
        kind: r < 0.12 ? 'gold' : r < 0.32 ? 'duck' : 'apple', ph: Math.random() * 6 };
    };
    const things = [0, 1, 2, 3, 4, 5].map(float);
    let state = 'ready', t = 0, left = TIME, x = 160, dunk = 0, score = 0, record = false, msg = '', msgT = 0;
    const self = {
      music: 'halloween',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You come up dripping, with ' + score + (score === 1 ? ' apple.' : ' apples.') + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You dry your face on your costume.'); return; }
        if (msgT > 0) msgT--;
        const rush = 1 + (TIME - left) / TIME * 0.7; // the apples get livelier as the clock runs down
        for (const o of things) {
          o.x += o.v * rush;
          if (o.x < X0 + 10) { o.x = X0 + 10; o.v = Math.abs(o.v); }
          if (o.x > X1 - 10) { o.x = X1 - 10; o.v = -Math.abs(o.v); }
        }
        if (dunk) {
          if (++dunk === 11) {
            const hit = things.find((o) => Math.abs(o.x - x) < 9);
            if (!hit) { sfx('splash'); msg = 'Just water.'; }
            else if (hit.kind === 'duck') { left -= 120; sfx('buzz'); msg = 'A rubber duck! -2 seconds'; }
            else { score += hit.kind === 'gold' ? 3 : 1; sfx(hit.kind === 'gold' ? 'cup' : 'ding'); msg = hit.kind === 'gold' ? 'A golden apple! +3' : 'Got one!'; }
            if (hit) Object.assign(hit, float());
            msgT = 50;
          }
          if (dunk > 24) dunk = 0;
        } else {
          if (held.left) x -= 2.4;
          if (held.right) x += 2.4;
          x = Math.max(X0 + 12, Math.min(X1 - 12, x));
          if (pressed.has('a')) dunk = 1;
        }
        if (--left <= 0) { left = 0; state = 'done'; t = 0; record = saveBest('bob', score); sfx('ding'); }
      },
      draw() {
        ctx.fillStyle = '#1c1230'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#2a1c44'; ctx.fillRect(0, 190, SW, 50);
        text('Bobbing for apples', 12, 10, 1, '#f08020');
        text('Apples ' + score, 12, 24, 1, '#f8f8f8');
        const tm = 'Time ' + Math.ceil(left / 60), bs = 'Best ' + getBest('bob');
        text(tm, SW - 12 - tm.length * 6, 10, 1, left < 300 ? '#f05040' : '#f8f8f8');
        text(bs, SW - 12 - bs.length * 6, 24, 1, '#c8ccd8');
        // the back of the tub, you, then the water and what's floating in it
        ctx.fillStyle = '#4a3018'; ctx.fillRect(X0 - 8, WATER - 8, X1 - X0 + 16, 64);
        const depth = dunk ? Math.sin(dunk / 24 * Math.PI) * 58 : 0;
        ctx.drawImage(sprites.down[0], Math.round(x) - 24, Math.round(72 + depth), 48, 48);
        ctx.globalAlpha = 0.8; ctx.fillStyle = '#3878c8'; ctx.fillRect(X0, WATER, X1 - X0, 50); ctx.globalAlpha = 1;
        ctx.fillStyle = '#78b0f0';
        for (let i = X0; i < X1; i += 8) ctx.fillRect(i + ((t >> 3) & 1 ? 0 : 4), WATER, 4, 1);
        for (const o of things) {
          const ox = Math.round(o.x), oy = Math.round(WATER + 1 + Math.sin(t / 9 + o.ph) * 2);
          if (o.kind === 'duck') {
            ctx.fillStyle = '#f8e040'; ctx.fillRect(ox - 7, oy - 3, 13, 7); ctx.fillRect(ox + 1, oy - 9, 7, 7);
            ctx.fillStyle = '#f08020'; ctx.fillRect(ox + 8, oy - 6, 3, 2);
            ctx.fillStyle = '#181820'; ctx.fillRect(ox + 5, oy - 7, 1, 1);
          } else {
            ctx.fillStyle = '#181820'; ctx.fillRect(ox - 7, oy - 6, 14, 13);
            ctx.fillStyle = o.kind === 'gold' ? '#f8d030' : '#d02830'; ctx.fillRect(ox - 6, oy - 5, 12, 11);
            ctx.fillStyle = o.kind === 'gold' ? '#f8f0a0' : '#f07868'; ctx.fillRect(ox - 4, oy - 3, 2, 3);
            ctx.fillStyle = '#5a3420'; ctx.fillRect(ox, oy - 9, 1, 4);
            ctx.fillStyle = '#58a848'; ctx.fillRect(ox + 1, oy - 9, 3, 2);
          }
        }
        // the front of the tub: staves and a hoop
        ctx.fillStyle = '#7a5028'; ctx.fillRect(X0 - 8, WATER + 14, X1 - X0 + 16, 44);
        ctx.fillStyle = '#4a3018'; for (let i = X0 - 8; i < X1 + 8; i += 16) ctx.fillRect(i, WATER + 14, 1, 44);
        ctx.fillStyle = '#a8a8b0'; ctx.fillRect(X0 - 8, WATER + 30, X1 - X0 + 16, 3);
        if (msgT > 0) ctext(msg, 48, '#f8e040');
        if (state === 'ready') readyBox(t, 'Arrows: move  Space: dunk');
        else if (state === 'done') doneBox(['Time!', 'Apples: ' + score, record ? 'New record!' : 'Best ' + getBest('bob')], t);
        else text('Arrows: move   Space: dunk   Esc: give up', 12, SH - 14, 1, '#c8ccd8');
      },
    };
    return self;
  }

  // Mummy wrap: alternate left and right to wind the paper round, quicker than the other
  // team. Wind faster than the paper can take and it tears.
  function MummyGame() {
    const NEED = 70, pool = shuffled(hw.guests.filter((g) => !g.ghost && g.name !== 'Lam'));
    const mine = pool[0] || { name: 'Kiki', sprites: spritesFor('Kiki') }, theirs = pool[1] || { name: 'Nathan', sprites: spritesFor('Nathan') };
    let state = 'ready', t = 0, me = 0, them = 0, last = null, strain = 0, torn = 0, ticks = 0, won = false, record = false;
    const best = () => +store.get('best.mummy') || 0; // quickest wrap, in tenths of a second
    const secs = (n) => (n / 10).toFixed(1) + 's';
    function finish(w) {
      won = w; state = 'done'; t = 0;
      const mine10 = Math.round(ticks / 6);
      if (won && (!best() || mine10 < best())) { store.set('best.mummy', mine10); record = true; }
      if (won) boardNote('mummy', mine10);
      sfx(won ? 'cup' : 'buzz');
    }
    function wrapped(g, x, n, flip) {
      ctx.drawImage(g.sprites.down[0], x, 76, 80, 80);
      // bandages from the feet up
      const rows = Math.floor(Math.min(1, n / NEED) * 20);
      for (let i = 0; i < rows; i++) {
        const y = 76 + 76 - i * 4, head = i >= 8;
        ctx.fillStyle = (i + (flip ? 1 : 0)) & 1 ? '#e8e0c8' : '#c8c0a0';
        ctx.fillRect(x + (head ? 12 : 16), y, head ? 56 : 48, 4);
        ctx.fillStyle = '#a89c78'; ctx.fillRect(x + (head ? 12 : 16) + ((i * 13) % 40), y + 3, 10, 1);
      }
      if (rows >= 20) { ctx.fillStyle = '#181820'; ctx.fillRect(x + 26, 76 + 30, 6, 4); ctx.fillRect(x + 48, 76 + 30, 6, 4); }
    }
    const self = {
      music: 'halloween',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(won ? mine.name + ': Mmmph! (You wrapped ' + mine.name + ' in ' + secs(Math.round(ticks / 6)) + '.' + (record ? ' A new record!)' : ')')
              : theirs.name + ' is a mummy already. ' + mine.name + ' is mostly just tangled.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say(mine.name + ' unwinds, looking relieved.'); return; }
        ticks++;
        them += 0.068 + Math.random() * 0.012;
        strain = Math.max(0, strain - 0.02);
        if (torn > 0) torn--;
        else {
          const d = pressed.has('left') ? 'left' : pressed.has('right') ? 'right' : null;
          if (d && d === last) sfx('bump');
          else if (d) {
            last = d; me++; strain += 0.2; sfx('blip', me & 1);
            if (strain > 1) { torn = 50; strain = 0.3; sfx('buzz'); }
          }
        }
        if (me >= NEED) finish(true); else if (them >= NEED) finish(false);
      },
      draw() {
        ctx.fillStyle = '#1c1230'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#2a1c44'; ctx.fillRect(0, 150, SW, 90);
        text('Mummy wrap', 12, 10, 1, '#f08020');
        const tm = (ticks / 60).toFixed(1) + 's', bs = 'Best ' + (best() ? secs(best()) : '-');
        text(tm, SW - 12 - tm.length * 6, 10, 1, '#f8f8f8');
        text(bs, SW - 12 - bs.length * 6, 24, 1, '#c8ccd8');
        wrapped(mine, 40, me, me & 1); wrapped(theirs, 200, them, Math.floor(them) & 1);
        ctext('VS', 112, '#f08020');
        text('YOU + ' + mine.name, 80 - (6 + mine.name.length) * 3, 56, 1, '#f8f8f8');
        text(theirs.name + '\'s team', 240 - (7 + theirs.name.length) * 3, 56, 1, '#c8ccd8');
        // how much of each mummy is done
        [[40, me], [200, them]].forEach(([x, n]) => {
          ctx.fillStyle = '#181820'; ctx.fillRect(x, 164, 80, 8);
          ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x + 1, 165, Math.round(78 * Math.min(1, n / NEED)), 6);
        });
        // how close the paper is to tearing
        text('Paper', 40, 184, 1, '#c8ccd8');
        ctx.fillStyle = '#181820'; ctx.fillRect(76, 183, 204, 10);
        ctx.fillStyle = strain > 0.75 ? '#f05040' : strain > 0.5 ? '#f0b030' : '#58a848';
        ctx.fillRect(78, 185, Math.round(200 * Math.min(1, strain)), 6);
        if (torn > 0) ctext('RIP! The paper tore!', 200, '#f05040');
        if (state === 'ready') readyBox(t, 'Left, Right, Left, Right...');
        else if (state === 'done') doneBox([won ? 'Fully wrapped!' : theirs.name + '\'s team wins!', won ? 'Your time: ' + secs(Math.round(ticks / 6)) : 'You got ' + Math.round(100 * me / NEED) + '% done',
          record ? 'New record!' : 'Best ' + (best() ? secs(best()) : '-')], t);
        else text('Arrows: left, right, left...   Esc: give up', 12, SH - 14, 1, '#c8ccd8');
      },
    };
    return self;
  }

  // Pumpkin carving: look at the face, then carve it from memory, one feature at a time.
  function CarveGame() {
    const PARTS = [['Eyes', 4], ['Nose', 3], ['Mouth', 4], ['Brows', 3]];
    let state = 'ready', t = 0, round = 0, face = [], mine = [], step = 0, cur = 0, record = false;
    const parts = () => (round >= 2 ? 4 : 3), look = () => Math.max(45, 150 - round * 22);
    function newFace() {
      face = PARTS.map(([, n]) => Math.floor(Math.random() * n));
      mine = []; step = 0; state = 'show'; t = 0;
    }
    const tri = (x, y, s, down) => { ctx.beginPath(); ctx.moveTo(x, y + (down ? s : -s)); ctx.lineTo(x + s, y + (down ? -s : s)); ctx.lineTo(x - s, y + (down ? -s : s)); ctx.fill(); };
    // f: the features to draw; anything undefined hasn't been cut yet
    function pumpkin(cx, cy, f, lit) {
      ctx.fillStyle = '#2c6a34'; ctx.fillRect(cx - 4, cy - 58, 8, 14);
      ctx.fillStyle = '#c05810'; ctx.beginPath(); ctx.ellipse(cx, cy, 66, 48, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f08020';
      for (const dx of [-38, 0, 38]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy, 25, 47, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = lit ? '#f8e040' : '#402008';
      const [e, n, m, b] = f;
      for (const s of [-1, 1]) {
        const ex = cx + s * 26, ey = cy - 12;
        if (e === 0) tri(ex, ey, 9);
        else if (e === 1) { ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill(); }
        else if (e === 2) ctx.fillRect(ex - 10, ey - 2, 20, 5);
        else if (e === 3) { ctx.beginPath(); ctx.moveTo(ex - s * 10, ey - 8); ctx.lineTo(ex + s * 10, ey + 6); ctx.lineTo(ex - s * 10, ey + 6); ctx.fill(); }
        if (b === 1) ctx.fillRect(ex - 10, ey - 20, 20, 3);
        else if (b === 2) { ctx.beginPath(); ctx.moveTo(ex - s * 11, ey - 16); ctx.lineTo(ex + s * 11, ey - 24); ctx.lineTo(ex + s * 11, ey - 20); ctx.lineTo(ex - s * 11, ey - 12); ctx.fill(); }
      }
      if (n === 0) tri(cx, cy + 4, 5);
      else if (n === 1) ctx.fillRect(cx - 3, cy + 1, 6, 6);
      else if (n === 2) tri(cx, cy + 4, 5, true);
      if (m === 0) { ctx.fillRect(cx - 30, cy + 18, 60, 10); ctx.fillStyle = '#f08020'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 22 + i * 15, cy + 18, 6, 4); }
      else if (m === 1) for (let i = 0; i < 6; i++) tri(cx - 25 + i * 10, cy + 23, 6, i & 1);
      else if (m === 2) { ctx.beginPath(); ctx.ellipse(cx, cy + 23, 10, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (m === 3) { ctx.fillRect(cx - 22, cy + 18, 44, 6); ctx.fillRect(cx - 30, cy + 24, 10, 6); ctx.fillRect(cx + 20, cy + 24, 10, 6); }
    }
    const self = {
      music: 'halloween',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) newFace(); return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You carved ' + round + (round === 1 ? ' pumpkin' : ' pumpkins') + ' before the knife slipped.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You put the knife down. Carefully.'); return; }
        if (state === 'show') { if (t > look()) { state = 'carve'; t = 0; cur = Math.floor(Math.random() * PARTS[0][1]); } return; }
        if (state === 'right') { if (t > 50) { round++; newFace(); } return; }
        const n = PARTS[step][1];
        if (pressed.has('left')) { cur = (cur + n - 1) % n; sfx('select'); }
        if (pressed.has('right')) { cur = (cur + 1) % n; sfx('select'); }
        if (pressed.has('a')) {
          mine[step] = cur;
          if (cur !== face[step]) { state = 'done'; t = 0; record = saveBest('carve', round); sfx('buzz'); return; }
          sfx('chop');
          if (++step >= parts()) { state = 'right'; t = 0; sfx('cup'); }
          else cur = Math.floor(Math.random() * PARTS[step][1]);
        }
      },
      draw() {
        ctx.fillStyle = '#1c1230'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#6a4a28'; ctx.fillRect(0, 176, SW, 64);
        text('Pumpkin carving', 12, 10, 1, '#f08020');
        text('Carved ' + round, 12, 24, 1, '#f8f8f8');
        const bs = 'Best ' + getBest('carve');
        text(bs, SW - 12 - bs.length * 6, 10, 1, '#c8ccd8');
        const showing = state === 'show' || state === 'ready';
        const f = state === 'show' ? face.slice(0, parts()) : state === 'done' ? face.slice(0, parts())
          : mine.slice(0, step).concat(state === 'carve' ? [cur] : []);
        pumpkin(160, 122, showing && state === 'ready' ? [] : f, state === 'show' || state === 'right' || state === 'done');
        if (state === 'show') {
          ctext('Remember this face!', 42, '#f8e040');
          ctx.fillStyle = '#f8e040'; ctx.fillRect(60, 56, Math.round(200 * (1 - t / look())), 3);
        } else if (state === 'carve') {
          const label = '<  ' + PARTS[step][0] + ' ' + (step + 1) + '/' + parts() + '  >';
          ctext(label, 42, '#f8f8f8');
          text('Arrows: choose   Space: cut   Esc: give up', 12, SH - 14, 1, '#f8f8f8');
        } else if (state === 'right') ctext('Spot on!', 42, '#58e048');
        if (state === 'ready') readyBox(t, 'Remember the face, then carve it');
        else if (state === 'done') {
          ctext('It should have looked like this.', 42, '#f05040');
          doneBox(['The knife slipped!', 'Pumpkins carved: ' + round, record ? 'New record!' : 'Best ' + getBest('carve')], t);
        }
      },
    };
    return self;
  }

  // Trick-or-treat catch: sweets in the bag, spiders and toothbrushes not.
  function TreatGame() {
    const SWEETS = ['#f08020', '#e03030', '#7b3fb8', '#58a848', '#f8e040'], BAG_Y = 196;
    const items = [];
    let state = 'ready', t = 0, x = 160, score = 0, strikes = 0, gap = 30, record = false, msg = '', msgT = 0;
    function strike(why) {
      strikes++; msg = why; msgT = 50; sfx('buzz');
      if (strikes >= 3) { state = 'done'; t = 0; record = saveBest('treat', score); }
    }
    const self = {
      music: 'halloween',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You bagged ' + score + (score === 1 ? ' sweet.' : ' sweets.') + (record ? ' A new record!' : '') + ' Your dentist will hear about this.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You put the bag down and step away from the candy.'); return; }
        if (msgT > 0) msgT--;
        if (held.left) x -= 3.2;
        if (held.right) x += 3.2;
        x = Math.max(20, Math.min(SW - 20, x));
        if (--gap <= 0) {
          gap = Math.max(16, 46 - score * 0.8) * (0.7 + Math.random() * 0.6);
          const r = Math.random();
          items.push({ x: 16 + Math.random() * (SW - 32), y: 30, v: 1.3 + score * 0.035 + Math.random() * 0.5,
            kind: r < 0.14 ? 'spider' : r < 0.26 ? 'brush' : 'sweet', c: SWEETS[Math.floor(Math.random() * SWEETS.length)] });
        }
        for (let i = items.length - 1; i >= 0 && state === 'play'; i--) {
          const o = items[i];
          o.y += o.v;
          if (o.y >= BAG_Y - 4 && o.y <= BAG_Y + 10 && Math.abs(o.x - x) < 17) {
            items.splice(i, 1);
            if (o.kind === 'sweet') { score++; sfx('blip', score & 1); }
            else strike(o.kind === 'spider' ? 'A spider! In the bag!' : 'A toothbrush. Who gives out toothbrushes?');
          } else if (o.y > SH - 8) {
            items.splice(i, 1);
            if (o.kind === 'sweet') strike('Dropped one!');
          }
        }
      },
      draw() {
        ctx.fillStyle = '#1c1230'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#2a1c44'; ctx.fillRect(0, SH - 12, SW, 12);
        text('Trick or treat!', 12, 10, 1, '#f08020');
        text('Sweets ' + score, 12, 24, 1, '#f8f8f8');
        const bs = 'Best ' + getBest('treat');
        text(bs, SW - 12 - bs.length * 6, 10, 1, '#c8ccd8');
        for (let i = 0; i < 3; i++) drawPumpkinAt(SW - 22 - i * 14, 22, i >= strikes);
        for (const o of items) {
          const ox = Math.round(o.x), oy = Math.round(o.y);
          if (o.kind === 'sweet') {
            ctx.fillStyle = o.c; ctx.fillRect(ox - 4, oy - 3, 8, 6);
            ctx.fillRect(ox - 8, oy - 3, 3, 2); ctx.fillRect(ox - 8, oy + 1, 3, 2); ctx.fillRect(ox + 5, oy - 3, 3, 2); ctx.fillRect(ox + 5, oy + 1, 3, 2);
            ctx.fillStyle = '#f8f8f8'; ctx.fillRect(ox - 2, oy - 2, 2, 1);
          } else if (o.kind === 'spider') {
            ctx.fillStyle = '#c8ccd8'; ctx.fillRect(ox, oy - 20, 1, 16);
            ctx.fillStyle = '#080810'; ctx.fillRect(ox - 4, oy - 4, 9, 7);
            for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.fillRect(ox + s * 5 + (s < 0 ? -2 : 0), oy - 3 + k * 2, 3, 1); ctx.fillRect(ox + s * 8, oy - 2 + k * 2, 1, 2); }
            ctx.fillStyle = '#f05040'; ctx.fillRect(ox - 2, oy - 2, 1, 1); ctx.fillRect(ox + 2, oy - 2, 1, 1);
          } else {
            ctx.fillStyle = '#40a0e0'; ctx.fillRect(ox - 1, oy - 8, 3, 16);
            ctx.fillStyle = '#f8f8f8'; ctx.fillRect(ox - 4, oy - 9, 4, 6);
          }
        }
        // you and your bag
        ctx.drawImage(sprites.down[held.left || held.right ? 1 + ((t >> 3) & 1) : 0], Math.round(x) - 16, BAG_Y - 4, 32, 32);
        ctx.fillStyle = '#181820'; ctx.fillRect(Math.round(x) - 15, BAG_Y + 4, 30, 18);
        ctx.fillStyle = '#f08020'; ctx.fillRect(Math.round(x) - 13, BAG_Y + 6, 26, 14);
        ctx.fillStyle = '#402008'; ctx.fillRect(Math.round(x) - 7, BAG_Y + 10, 4, 4); ctx.fillRect(Math.round(x) + 3, BAG_Y + 10, 4, 4); ctx.fillRect(Math.round(x) - 6, BAG_Y + 16, 12, 2);
        if (msgT > 0) ctext(msg, 48, '#f05040');
        if (state === 'ready') readyBox(t, 'Left/Right: catch the sweets');
        else if (state === 'done') doneBox(['Three strikes!', 'Sweets: ' + score, record ? 'New record!' : 'Best ' + getBest('treat')], t);
        else if (!msgT) text('Arrows: move   Esc: give up', 12, 40, 1, '#8890a0');
      },
    };
    return self;
  }

  // Ghost in the cupboard: shut the door on each ghost with its arrow. Not on Linda.
  function GhostGame() {
    const SPOTS = { up: [138, 34], down: [138, 150], left: [44, 92], right: [232, 92] }, DIR_LIST = Object.keys(SPOTS);
    const sheet = Art.renderSprites('ghost', {});
    let state = 'ready', t = 0, score = 0, strikes = 0, pop = null, wait = 40, slam = null, record = false, msg = '', msgT = 0;
    function strike(why) {
      strikes++; msg = why; msgT = 50; sfx('buzz'); pop = null; wait = 40;
      if (strikes >= 3) { state = 'done'; t = 0; record = saveBest('ghosts', score); }
    }
    const self = {
      music: 'halloween',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say('You shut ' + score + (score === 1 ? ' ghost' : ' ghosts') + ' back in the cupboard.' + (record ? ' A new record!' : ''));
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You back away from the cupboards. Slowly.'); return; }
        if (msgT > 0) msgT--;
        if (slam && --slam.t <= 0) slam = null;
        const dir = DIR_LIST.find((d) => pressed.has(d));
        if (!pop) {
          if (dir) sfx('bump'); // nobody there: no harm done
          if (--wait <= 0) {
            pop = { dir: DIR_LIST[Math.floor(Math.random() * 4)], t: 0, life: Math.max(24, 72 - score * 2.5), linda: score > 2 && Math.random() < 0.2 };
            sfx('swish');
          }
          return;
        }
        pop.t++;
        if (dir) {
          if (dir !== pop.dir) strike('Wrong cupboard!');
          else if (pop.linda) strike('Linda: Rude. I work here.');
          else { score++; slam = { dir, t: 12 }; pop = null; wait = Math.max(8, 34 - score) + Math.random() * 20; sfx('hit', 60); }
        } else if (pop.t > pop.life) {
          if (pop.linda) { pop = null; wait = 20; } else strike('One got out!');
        }
      },
      draw() {
        ctx.fillStyle = '#1c1230'; ctx.fillRect(0, 0, SW, SH);
        text('Ghost in the cupboard', 12, 10, 1, '#f08020');
        text('Shut in ' + score, 12, 24, 1, '#f8f8f8');
        const bs = 'Best ' + getBest('ghosts');
        text(bs, SW - 12 - bs.length * 6, 10, 1, '#c8ccd8');
        for (let i = 0; i < 3; i++) drawPumpkinAt(SW - 22 - i * 14, 22, i >= strikes);
        for (const d of DIR_LIST) {
          const [x, y] = SPOTS[d], open = pop && pop.dir === d, shut = slam && slam.dir === d;
          ctx.fillStyle = '#181820'; ctx.fillRect(x - 2, y - 2, 48, 60);
          ctx.fillStyle = '#080810'; ctx.fillRect(x, y, 44, 56);
          if (open) {
            const rise = Math.min(1, pop.t / 8), gy = y + 40 - Math.round(rise * 28) + Math.round(Math.sin(t / 6) * 2);
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, 44, 56); ctx.clip();
            ctx.drawImage(sheet.down[(t >> 3) & 1], x + 6, gy, 32, 32);
            if (pop.linda) { // Linda has her red stapler with her
              ctx.fillStyle = '#d02030'; ctx.fillRect(x + 24, gy + 22, 10, 4); ctx.fillStyle = '#181820'; ctx.fillRect(x + 24, gy + 26, 10, 1);
              ctx.fillStyle = '#e07898'; ctx.fillRect(x + 12, gy + 2, 6, 3); ctx.fillRect(x + 20, gy + 2, 6, 3); ctx.fillRect(x + 18, gy + 3, 2, 2);
            }
            ctx.restore();
            // the door, swung open to one side
            ctx.fillStyle = '#6a4a28'; ctx.fillRect(x + 40, y, 8, 56);
            // how long before it floats off
            ctx.fillStyle = pop.linda ? '#e07898' : '#f8e040'; ctx.fillRect(x, y + 60, Math.round(44 * (1 - pop.t / pop.life)), 3);
          } else {
            ctx.fillStyle = shut ? '#a87840' : '#8a6030'; ctx.fillRect(x, y, 44, 56);
            ctx.fillStyle = '#6a4a28'; ctx.fillRect(x + 21, y, 2, 56); ctx.fillRect(x + 4, y + 4, 14, 48); ctx.fillRect(x + 26, y + 4, 14, 48);
            ctx.fillStyle = '#f0b030'; ctx.fillRect(x + 17, y + 26, 3, 5); ctx.fillRect(x + 24, y + 26, 3, 5);
          }
        }
        // which arrow is which
        ctx.fillStyle = '#4a3068';
        ctx.fillRect(152, 104, 16, 34); ctx.fillRect(143, 113, 34, 16);
        if (msgT > 0) ctext(msg, 222, '#f05040');
        else if (state === 'play') ctext('Arrows: shut that door   Esc: give up', 222, '#8890a0');
        if (state === 'ready') readyBox(t, 'Arrows: shut the ghosts in');
        else if (state === 'done') doneBox(['Three strikes!', 'Ghosts shut in: ' + score, record ? 'New record!' : 'Best ' + getBest('ghosts')], t);
      },
    };
    return self;
  }

  // Lam's costume contest. Three coworkers walk the catwalk and get their scorecards, then
  // it's your turn: ten poses, each an arrow with a ring closing in on it, faster every
  // time. Hit that arrow as the ring meets the mark. The three judges' cards come from how well you timed them.
  function CostumeContest() {
    const pool = hw.guests.length ? hw.guests : pickGuests();
    const mc = pool.find((g) => g.name === 'Lam'), linda = pool.find((g) => g.name === 'Linda');
    const rest = shuffled(pool.filter((g) => g !== mc && g !== linda));
    const judges = [rest[3], linda, rest[4]];
    const POSES = 10, GAP = 23, CX = 144, RUN_Y = 92, STOPS = (k) => 50 + k * GAP;
    const acts = rest.slice(0, 3).map((g) => ({ name: g.name, outfit: g.outfit, sprites: g.sprites, cards: [0, 1, 2].map(() => 5 + Math.floor(Math.random() * 5)) }));
    const me = { name: playerName || 'You', outfit: Art.COSTUMES[hw.costume].name, sprites, cards: null, me: true };
    acts.push(me);
    const sum = (a) => a.cards.reduce((x, y) => x + y, 0);
    const QUIPS = ['Give it up for {n} the {o}!', 'Next on the catwalk: {n} the {o}. Health and Safety has questions.',
      'And here comes {n} the {o}! Ten minutes and a glue gun, I\'m told.'];
    const DIR_LIST = ['up', 'right', 'down', 'left'];
    let state = 'intro', t = 0, ai = 0, pose = 0, pts = 0, want = null, need = 0, got = null, label = '', record = false, order = null;
    let quip = 'Welcome to the Haakon Halloween costume contest! I\'m Lam, your MC.';
    const intro = (a) => (a.me ? 'And finally... ' + a.name + ' the ' + a.outfit + '! Strike a pose!' : QUIPS[ai % QUIPS.length].replace('{n}', a.name).replace('{o}', a.outfit));
    function nextAct() {
      const a = acts[ai];
      quip = intro(a); t = 0;
      state = a.me ? 'ready' : 'walk';
    }
    function nextPose() {
      want = DIR_LIST[Math.floor(Math.random() * 4)];
      // the ring closes faster every pose: 56 ticks down to 20
      need = 56 - pose * 4; got = null; state = 'pose'; t = 0;
    }
    function judge(dir) {
      const err = Math.abs(t - need);
      const p = dir !== want || err > 13 ? 0 : err <= 3 ? 5 : err <= 7 ? 4 : 2;
      label = p === 5 ? 'PERFECT!' : p === 4 ? 'GREAT!' : p === 2 ? 'OK' : dir && dir !== want ? 'WRONG WAY!' : 'MISSED!';
      pts += p; got = p ? want : null;
      sfx(p === 5 ? 'cup' : p ? 'ding' : 'buzz');
      state = 'judged'; t = 0;
    }
    const self = {
      music: 'halloween',
      update() {
        t++;
        const a = acts[ai];
        if (state === 'intro') { if (t > 150 || (t > 30 && pressed.has('a'))) nextAct(); return; }
        if (state === 'walk') { if (t > 80) { state = 'spin'; t = 0; } return; }
        if (state === 'spin') { if (t > 72) { state = 'cards'; t = 0; sfx('ding'); } return; }
        if (state === 'cards') {
          if (t > 110 || (t > 30 && pressed.has('a'))) {
            if (a.me) {
              order = acts.slice().sort((p, q) => sum(q) - sum(p) || (q.me ? 1 : 0) - (p.me ? 1 : 0));
              record = saveBest('costume', sum(me));
              state = 'done'; t = 0; sfx(order[0] === me ? 'cup' : 'ding');
            } else { state = 'exit'; t = 0; }
          }
          return;
        }
        if (state === 'exit') { if (t > 50) { ai++; nextAct(); } return; }
        if (state === 'ready') { if (t > 75) { state = 'step'; t = 0; } return; }
        if (state === 'step') { if (t % 8 === 1) sfx('blip'); if (t > 16) nextPose(); return; }
        if (state === 'pose') {
          const dir = DIR_LIST.find((d) => pressed.has(d));
          if (dir) judge(dir); else if (t > need + 13) judge(null);
          return;
        }
        if (state === 'judged') {
          if (t > 30) {
            if (++pose < POSES) { state = 'step'; t = 0; return; }
            // the judges mark you out of 10 each, on how well you hit your poses
            me.cards = [0.3, -0.3, 0].map((d) => Math.max(1, Math.min(10, Math.round(pts * 2 / POSES + d))));
            quip = 'Judges, your scores please!';
            state = 'cards'; t = 0; sfx('ding');
          }
          return;
        }
        if (state === 'done' && t > 40 && (pressed.has('a') || pressed.has('b'))) {
          const won = order[0] === me;
          remove(self);
          say('Lam: ' + (won ? 'Best costume of the night goes to ' + me.name + ' the ' + me.outfit + '! Take a bow!'
            : 'Best costume goes to ' + order[0].name + ' the ' + order[0].outfit + '! Hard luck, ' + me.name + '. There\'s always next October.'),
          () => ui.push(HalloweenSplash()));
        }
      },
      draw() {
        const a = acts[ai];
        ctx.fillStyle = '#140c20'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#2a1840'; ctx.fillRect(0, 0, SW, 84);
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = BUNTING[i % 2];
          for (let k = 0; k < 3; k++) ctx.fillRect(i * 8 + 1 + k, 2 + k * 2, 6 - k * 2, 2);
        }
        const title = 'COSTUME CONTEST';
        text(title, (SW - title.length * 12) >> 1, 12, 2, '#f08020');
        // the catwalk, with footlights
        ctx.fillStyle = '#4a3068'; ctx.fillRect(0, RUN_Y + 20, SW, 20);
        ctx.fillStyle = '#7b3fb8'; ctx.fillRect(0, RUN_Y + 20, SW, 2); ctx.fillRect(0, RUN_Y + 38, SW, 2);
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = ((tick >> 4) + i) % 3 ? '#f8e040' : '#f08020';
          ctx.fillRect(i * 16 + 7, RUN_Y + 42, 2, 2);
        }
        // Lam and what he's saying
        ctx.drawImage(mc.sprites.right[0], 6, 46, 32, 32);
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(36, 60, 2, 8); ctx.fillStyle = '#181820'; ctx.fillRect(35, 57, 4, 4);
        if (state !== 'pose' && state !== 'judged') wrap(quip, 44).slice(0, 3).forEach((l, i) => text(l, 46, 42 + i * 11, 1, '#f8f8f8'));
        // the crowd, in the dark beyond the judges
        ctx.fillStyle = '#241838';
        for (let i = 0; i < 14; i++) {
          const hx = i * 24 + ((i * 7) % 5), hy = 152 + ((i * 5) % 3) * 3 + (((tick >> 4) + i) % 5 ? 0 : -1);
          ctx.fillRect(hx + 2, hy, 12, 12); ctx.fillRect(hx, hy + 8, 16, 20);
        }
        // whoever is on the catwalk
        let x = CX, img = a.sprites.down[0], lift = 0;
        if (state === 'walk') { x = -32 + (CX + 32) * Math.min(1, t / 80); img = a.sprites.right[(t >> 3) & 1 ? 1 : 0]; }
        else if (state === 'spin') { img = a.sprites[['down', 'left', 'up', 'right'][(t / 12 | 0) & 3]][0]; lift = (t / 12 | 0) & 1 ? 2 : 0; }
        else if (state === 'exit') { x = CX + (SW - CX + 8) * Math.min(1, t / 50); img = a.sprites.right[(t >> 3) & 1 ? 1 : 0]; }
        else if (a.me) {
          x = STOPS(Math.min(pose, POSES - 1));
          if (state === 'ready') x = STOPS(0) - GAP;
          else if (state === 'step') { x -= GAP * (1 - Math.min(1, t / 16)); img = sprites.right[(t >> 3) & 1 ? 1 : 0]; }
          else if (state === 'judged' && got) { img = sprites[got][1 + ((t >> 3) & 1)]; lift = Math.max(0, 6 - Math.abs(t - 8)); }
          else if (state === 'cards' || state === 'done') { x = CX; lift = (tick >> 4) & 1; }
        }
        if (state !== 'intro') {
          ctx.globalAlpha = 0.22; ctx.fillStyle = '#f8e8a0';
          ctx.beginPath(); ctx.ellipse(Math.round(x) + 16, RUN_Y + 32, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.drawImage(img, Math.round(x), RUN_Y - lift, 32, 32);
        }
        // the pose to strike: an arrow, the mark round it, and a ring closing in
        if (state === 'pose' || state === 'judged') {
          const px = Math.round(x) + 16, py = RUN_Y - 22;
          if (state === 'pose') {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#f08020'; ctx.beginPath(); ctx.arc(px, py, 13 + Math.max(0, need - t) * 0.4, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.save();
          ctx.translate(px, py); ctx.rotate(DIR_LIST.indexOf(want) * Math.PI / 2);
          ctx.fillStyle = state === 'judged' ? (got ? '#58e048' : '#f05040') : '#f8e040';
          ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(3, 0); ctx.lineTo(3, 8); ctx.lineTo(-3, 8); ctx.lineTo(-3, 0); ctx.lineTo(-8, 0); ctx.fill();
          ctx.restore();
          if (state === 'judged') text(label, px - label.length * 3, RUN_Y + 48, 1, got ? '#58e048' : '#f05040');
        }
        // the judges, with their backs to us, and their scorecards
        ctx.fillStyle = '#181820'; ctx.fillRect(58, 176, 204, 14);
        ctx.fillStyle = '#6a4a28'; ctx.fillRect(60, 178, 200, 10);
        judges.forEach((j, i) => {
          const jx = 84 + i * 60;
          if (j.ghost) ctx.globalAlpha = 0.8;
          ctx.drawImage(j.sprites.up[0], jx, 184, 32, 32);
          ctx.globalAlpha = 1;
          if ((state === 'cards' || state === 'done') && a.cards && t > i * 14) {
            const n = String(a.cards[i]);
            ctx.fillStyle = '#181820'; ctx.fillRect(jx + 3, 150, 26, 24);
            ctx.fillStyle = '#f8f8f8'; ctx.fillRect(jx + 5, 152, 22, 20);
            text(n, jx + 16 - n.length * 6, 155, 2, '#181820');
          }
        });
        if (state === 'cards' && t > 42) ctext(a.name + ': ' + sum(a) + ' points', 224, '#f8e040');
        else if (a.me && state !== 'intro' && state !== 'done') {
          text('Pose ' + Math.min(pose + 1, POSES) + '/' + POSES, 8, 224, 1, '#c8ccd8');
          const hint = 'Arrows: strike the pose';
          text(hint, SW - 8 - hint.length * 6, 224, 1, '#c8ccd8');
        } else if (state !== 'intro' && state !== 'done') ctext(a.name + ' the ' + a.outfit, 224, '#c8ccd8');
        if (state === 'ready') readyBox(t, 'Arrows: pose as the ring closes');
        if (state === 'done') {
          box(24, 34, SW - 48, 172);
          ctext('THE JUDGES HAVE SPOKEN', 46);
          order.forEach((o, i) => {
            const y = 68 + i * 22, sc = String(sum(o));
            if (o.me) { ctx.fillStyle = '#f8e8a0'; ctx.fillRect(30, y - 5, SW - 60, 20); }
            text((i + 1) + '.', 36, y);
            ctx.drawImage(o.sprites.down[0], 52, y - 5);
            text(o.name + ' the ' + o.outfit, 74, y);
            text(sc, SW - 38 - sc.length * 6, y);
          });
          ctext(order[0] === me ? 'BEST COSTUME! You win!' : 'Best costume: ' + order[0].name, 160, '#c05810');
          ctext(record ? 'New record!' : 'Your best: ' + getBest('costume'), 174);
          if (t > 40 && (tick >> 4) & 1) ctext('Press Space', 190);
        }
      },
    };
    return self;
  }

  // The last word: Happy Haakon Halloween. When it fades, you're back by your chair.
  function HalloweenSplash() {
    let t = 0;
    const bats = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: Math.random() * SW, y: 16 + Math.random() * 190, v: 0.4 + Math.random() * 0.8, i }));
    sfx('cup');
    const self = {
      music: 'halloween',
      update() {
        t++;
        for (const b of bats) { b.x += b.v; if (b.x > SW + 10) b.x = -10; }
        if (t > 300 || (t > 60 && (pressed.has('a') || pressed.has('b')))) startFade(() => { remove(self); endParty(); }, '#000000');
      },
      draw() {
        ctx.fillStyle = '#0c0614'; ctx.fillRect(0, 0, SW, SH);
        // a big moon, and a bigger pumpkin
        ctx.fillStyle = '#f8f0c0'; ctx.beginPath(); ctx.arc(258, 150, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0d8a0'; ctx.fillRect(244, 136, 8, 6); ctx.fillRect(266, 158, 10, 8); ctx.fillRect(270, 132, 5, 5);
        for (const b of bats) drawBatAt(Math.round(b.x), Math.round(b.y + Math.sin(t / 14 + b.i) * 8), ((t >> 3) + b.i) & 1, '#7b3fb8');
        const cx = 160, cy = 162, bob = Math.round(Math.sin(t / 16) * 2);
        ctx.fillStyle = '#2c6a34'; ctx.fillRect(cx - 4, cy - 46 + bob, 8, 12);
        ctx.fillStyle = '#c05810'; ctx.beginPath(); ctx.ellipse(cx, cy + bob, 52, 38, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f08020';
        for (const dx of [-30, 0, 30]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy + bob, 20, 37, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = (t >> 3) % 3 ? '#f8e040' : '#f8b830';
        const tri = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.fill(); };
        tri(cx - 22, cy - 10 + bob, 9); tri(cx + 22, cy - 10 + bob, 9); tri(cx, cy + 2 + bob, 5);
        ctx.fillRect(cx - 30, cy + 12 + bob, 60, 10);
        ctx.fillStyle = '#f08020';
        for (let i = 0; i < 4; i++) { ctx.fillRect(cx - 22 + i * 16, cy + 12 + bob, 6, 4); ctx.fillRect(cx - 30 + i * 16, cy + 18 + bob, 6, 4); }
        ctx.drawImage(sprites.down[[1, 0, 2, 0][(t >> 3) & 3]], 28, 150, 48, 48);
        ['HAPPY HAAKON', 'HALLOWEEN'].forEach((line, i) => {
          const x = (SW - line.length * 18) >> 1, y = 22 + i * 34 + Math.round(Math.sin(t / 10 + i) * 2);
          text(line, x + 2, y + 2, 3, '#7b3fb8');
          text(line, x, y, 3, '#f08020');
        });
      },
    };
    return self;
  }

  // ---------- Eugene's phone and the Kingston plant ----------
  // The phone on Eugene's desk never stops ringing. Answer it and the plant piles one
  // problem after another on you until you black out, and wake up on the plant floor.
  // 'Leave plant' in the start menu (or the phone ringing on the plant's reception desk)
  // brings you back beside the phone, with the office just as you left it (and the phone
  // ringing again).
  const RING_EVERY = 240; // ticks from one ring-ring to the next
  // true during either half of a ring-ring
  const ringing = (p) => {
    const ph = tick % RING_EVERY;
    return !!p && p.ringing && (ph < 24 || (ph >= 30 && ph < 54));
  };
  const inPhoneRoom = () => {
    const p = phoneHere();
    return !!p && !!curRoom && curRoom === roomAt(p.floor, p.x, p.y);
  };
  function ringPhone() {
    // only while you're walking around (or reading a line): not in a mini-game or menu screen
    const p = phoneHere();
    if (!p || !p.ringing || !ui.every((el) => el.overlay)) return;
    const ph = tick % RING_EVERY;
    if (ph !== 0 && ph !== 30) return;
    // loud in the phone's room, fainter from the hallway outside
    const vol = inPhoneRoom() ? 1
      : Math.hypot(P.x - p.x, P.y - p.y) < 10 ? 0.35 : 0;
    if (vol) sfx('ring', vol);
  }
  const PHONE_BASE = [
    '..kkkkkkkkkk..',
    '.kKKKKKKKKKKk.',
    'kKGkGkGKKKKKKk',
    'kKKKKKKKKKKrKk',
    'kKGkGkGKKKKKKk',
    'kKKKKKKKKKKKKk',
    '.kkkkkkkkkkkk.',
  ];
  const PHONE_HANDSET = [
    'kkkk......kkkk',
    'kKKkkkkkkkkKKk',
    'kKKKKKKKKKKKKk',
    '.kkkkkkkkkkkk.',
  ];
  function drawPix(rows, x, y, cols) {
    rows.forEach((row, j) => [...row].forEach((c, i) => {
      if (c === '.') return;
      ctx.fillStyle = cols[c]; ctx.fillRect(x + i, y + j, 1, 1);
    }));
  }
  // The phone on its desk tile: while it rings the handset rattles on the cradle,
  // the light flashes and the ring comes off it either side.
  function drawPhoneAt(p, x, y) {
    if (x < -16 || x > SW || y < -16 || y > SH) return;
    const on = ringing(p), flash = on && (tick >> 2) & 1;
    drawPix(PHONE_BASE, x + 1, y + 6, { k: '#181820', K: '#484858', G: '#c8ccd8', r: flash ? '#f05040' : '#782020' });
    const jig = on ? ((tick >> 1) & 1 ? 1 : -1) : 0;
    drawPix(PHONE_HANDSET, x + 1 + jig, y + 3 - (on && (tick >> 2) & 1 ? 2 : 0), { k: '#181820', K: '#484858' });
    if (!on) return;
    ctx.fillStyle = '#f0d040';
    const far = (tick >> 3) & 1 ? 2 : 0;
    for (const [sx, d] of [[x - 1 - far, -1], [x + 16 + far, 1]]) {
      ctx.fillRect(sx, y + 4, 1, 4);
      ctx.fillRect(sx - d, y + 2, 1, 2); ctx.fillRect(sx - d, y + 8, 1, 2);
    }
  }
  // Where to stand to use the phone, and which way to face; whoever is standing there moves.
  function phoneSpot() {
    for (const d in DIRS) {
      const x = phone.x - DIRS[d][0], y = phone.y - DIRS[d][1];
      if (!walkable(phone.floor, x, y)) continue;
      const n = npcAt(phone.floor, x, y);
      if (n) {
        const r = n.room;
        for (let yy = r.y1; yy <= r.y2; yy++)
          for (let xx = r.x1; xx <= r.x2; xx++)
            if (!(xx === x && yy === y) && NPC_FLOOR.includes(tileAt(n.floor, xx, yy)) && !npcAt(n.floor, xx, yy)) {
              Object.assign(n, { x: xx, y: yy, moving: false, prog: 0 });
              yy = r.y2 + 1; break;
            }
      }
      return [x, y, d];
    }
    return [MAPS.start.x, MAPS.start.y, MAPS.start.dir];
  }

  const CALL = [
    'There is a problem with the fan design!',
    'The unit won\'t pass the deflection test!',
    'The coil is two inches too wide for the casing!',
    'The motor nameplate says 575 volts. The drawings say 208!',
    'Somebody put all the access doors on the wrong side!',
    'The truck is here and the unit isn\'t even painted yet!',
    'The customer is on the other line asking where their unit is!',
    'And the coffee machine is broken!',
  ];
  const PANIC = ['WHERE ARE THE DRAWINGS?!', 'WE ARE OUT OF RIVETS!', 'IS THAT A 3 OR AN 8?!', 'THE DRAIN PAN LEAKS!',
    'WHO SIGNED OFF ON THIS?!', 'THE DAMPERS ARE BACKWARDS!', 'THE FORKLIFT WON\'T STOP BEEPING!', 'CALL ENGINEERING!',
    'IT SHIPS FRIDAY!', 'HELLO?! ARE YOU STILL THERE?!'];
  function answerPhone() {
    phone.ringing = false;
    sfx('pickup');
    say('You answer the phone. It is someone from the plant...', () => callLine(0));
  }
  function callLine(i) {
    if (i < CALL.length) { sfx('caller'); say('"' + CALL[i] + '"', () => callLine(i + 1)); return; }
    const panic = StressBurst(() => startFade(() => {
      remove(panic);
      blackout('You blacked out from all of the stress...', enterPlant);
    }, '#000000'));
    ui.push(panic);
  }
  // Everything else the plant has to say, all at once: shouts pop up faster and faster
  // all over the screen, the room shakes and goes red, and your heart races.
  function StressBurst(done) {
    let t = 0, next = 30, gap = 46, beat = 1, over = false;
    const pops = [];
    const self = {
      music: 'none', shake: 0,
      update() {
        t++;
        self.shake = Math.min(3, t / 60);
        if (pops.length < PANIC.length && t >= next) {
          const str = PANIC[pops.length], w = str.length * 6 + 16;
          pops.push({ str, w, x: 4 + Math.floor(Math.random() * (SW - w - 8)), y: 6 + Math.floor(Math.random() * (SH - 34)) });
          sfx('caller');
          next = t + gap; gap = Math.max(10, Math.round(gap * 0.8));
        }
        if (--beat <= 0) { sfx('thump'); beat = Math.max(14, 40 - pops.length * 3); }
        if (!over && pops.length === PANIC.length && t >= next + 30) { over = true; done(); }
      },
      draw() {
        ctx.fillStyle = 'rgba(150, 0, 0, ' + Math.min(0.45, t / 500) + ')';
        ctx.fillRect(0, 0, SW, SH);
        for (const p of pops) {
          const jx = Math.round((Math.random() - 0.5) * self.shake), jy = Math.round((Math.random() - 0.5) * self.shake);
          box(p.x + jx, p.y + jy, p.w, 24);
          text(p.str, p.x + 8 + jx, p.y + 8 + jy);
        }
      },
    };
    return self;
  }
  // A black screen with one line on it. A or B (or waiting) moves on.
  function Blackout(msg, done) {
    const lines = wrap(msg, 50), len = lines.join('').length;
    let t = 0, shown = 0, after = 0, gone = false;
    const self = {
      music: 'none',
      update() {
        t++;
        if (shown < len) { if (t > 30) shown = Math.min(len, shown + (held.a || held.b ? 1 : 0.4)); return; }
        if (!gone && (pressed.has('a') || pressed.has('b') || ++after > 210)) { gone = true; sfx('select'); done(); }
      },
      draw() {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, SW, SH);
        const y0 = (SH - lines.length * 16) >> 1;
        let left = Math.floor(shown);
        lines.forEach((l, i) => {
          text(l.slice(0, Math.max(0, left)), (SW - l.length * 6) >> 1, y0 + i * 16, 1, '#f8f8f8');
          left -= l.length;
        });
        if (shown >= len && !gone && (tick >> 4) & 1) text('~', SW - 14, SH - 12, 1, '#f8f8f8');
      },
    };
    return self;
  }
  // Show a Blackout, then fade from it into whatever `then` sets up.
  function blackout(msg, then) {
    const screen = Blackout(msg, () => startFade(() => { remove(screen); then(); }, '#000000'));
    ui.push(screen);
  }
  function enterPlant() {
    const S = MAPS.plant;
    phone.ringing = true; // it'll be ringing again when you get back
    if (plantPhone) plantPhone.ringing = true;
    placePlayer(S.floor, S.x, S.y, S.dir);
    showBanner(MAPS.floors[S.floor].name);
    say('You wake up in the Kingston plant. Time to start helping with production!');
  }
  // The phone on the plant's reception desk: the office wants you back.
  function answerPlantPhone() {
    plantPhone.ringing = false;
    sfx('pickup');
    sfx('caller');
    say('"Where are you? You are needed back in the office!"', leavePlant);
  }
  function leavePlant() {
    sfx('select');
    startFade(() => blackout('You are exhausted and pass out...', () => {
      placePlayer(phone.floor, ...phoneSpot());
      say('You woke up from a nightmare and are exhausted.');
    }), '#000000');
  }
  // The plant's own take on things you can use: the same games as the office, with
  // what you'd find on a plant floor.
  const PLANT_GAMES = {
    F: ['A plenum fan, fresh off the line. It wobbles. Somebody has to balance it.', 'BALANCE IT', FanGame],
    L: ['A coil on the test stand, waiting for its superheat check.', 'WATCH THE COIL', CoilGame],
    a: ['Damper sections waiting to go into a unit. The blades need setting.', 'SET THE BLADES', DamperGame],
    U: ['Racks of filters for the units that ship today. The sizes are all mixed up.', 'SORT FILTERS', FilterGame],
    K: ['The test bench controls. Half the lights are red.', 'RUN THE TEST', SimonGame],
    j: ['Rivets, screws and brackets all over the floor.', 'SORT THEM', PartsGame],
    '^': ['A forklift with the keys in it. Jay says the truck still needs loading.', 'DRIVE IT', ForkliftGame],
    0: [() => boothCoat ? 'Your paint job, drying. QC rolls another grey unit in behind it whenever you\'re ready.'
      : 'A unit in grey primer, waiting for paint. Nobody masked the portholes.', 'PAINT IT', PaintGame],
  };
  const PLANT_INFO = {
    X: ['The loading dock. A truck is backed up to it, waiting.', 'The loading dock. The driver waves at you. Then points at his watch.'],
    M: ['The press brake. It folds sheet metal like paper.', 'The shear. It is very loud and very sharp.'],
    T: ['A stack of galvanized panels, cut and waiting to be folded.'],
    k: ['A workbench covered in rivet guns, drill bits and coffee cups.'],
    b: ['Binders of drawings. Every one of them says REV C.', 'Shelves of motors, bearings and belts.'],
    d: ['A desk buried in work orders.', 'A desk with a hard hat and three coffee cups on it.', 'A desk covered in drawings. Every one says REV C.'],
    B: ['Crates of parts. Half of them say URGENT.', 'A crate marked RUSH. It has been here since March.'],
    '=': ['A safety partition. Someone taped a drawing to it, covered in red pen.'],
    1: ['A finished unit, tagged for the truck. You can see the fan through the porthole.', 'A finished unit. The tag says SHIP TODAY. It has said that since Tuesday.'],
    2: ['A long, low unit. The coil connections are capped so nothing gets in on the way.', 'A finished unit. Someone wrote GOOD LUCK on the side in marker.'],
    3: ['A stacked unit, supply on top of return. It only just fits under the dock door.', 'A big stacked unit. The rain hood comes off for shipping. Nobody took it off.'],
    4: ['A unit shrink-wrapped to a skid. It squeaks when you poke it.', 'Wrapped, strapped and labelled THIS SIDE UP. The arrow points sideways.'],
    5: ['A rooftop unit. The condenser fan on top spins a little when the dock door opens.', 'A rooftop unit, ready for the crane. The tag says DO NOT STACK.'],
  };
  // ...and for things in one particular room of the plant
  const PLANT_ROOM_INFO = {
    'Training Room': { T: ['The training table. Someone left a quiz on lockout/tagout. It is half done.'] },
    'Assembly Line': { '+': ['A work table on the line, covered in drill bits, rivets and half a muffin.',
      'A work table on the line. The drawing taped to it says REV C. The parts on it say REV B.',
      'A work table. Someone has written GOOD LUCK on it in marker.'] },
    'Test Bay': { '+': ['The test bench. A pressure gauge, a roll of duct tape and a test sheet nobody has signed.',
      'The test bench. The manometer tubes are tied in a knot.'] },
    'Finishing': { '+': ['A finishing table: touch-up paint, labels and a box of door handles.',
      'A work table covered in nameplates waiting for their rivets.'] },
    'Paint Booth': { k: ['Paint cans, spray tips and a whole box of masking tape. Unopened.', 'A bench of paint cans. Every lid has a drip down the side.'] },
  };

  // ---------- the plant forklift: load the truck before it has to leave ----------
  // Top-down loading dock. The truck calls for one kind of pallet at a time; drive the
  // forks into it and it's on, drive it into the trailer and it's off (or into an empty
  // rack bay to put a wrong one back). The forklift steers from the back: left and right
  // turn the wheels a notch at a time and they stay turned, so it only turns while it's
  // moving. It beeps when it reverses, and Steve from Health and Safety keeps walking
  // across the crosswalk. Hitting him, or bringing the wrong pallet, costs time.
  const FORKLIFT_ART = [
    '....K......K....',
    '....K......K....',
    '....K......K....',
    '...kKkkkkkkKk...',
    '...kGGGGGGGGk...',
    '.kkkkkkkkkkkkkk.',
    '.kkooooooooookk.',
    '.kkokkkkkkkkokk.',
    '..kokKKKKKKkok..',
    '..kokKKKKKKkok..',
    '..kokkkkkkkkok..',
    '..kooooooooook..',
    '.kkKKKKKKKKKKkk.',
    '.kkKKKKKKKKKKkk.',
    '..kkkkkkkkkkkk..',
    '................',
  ];
  const FORKLIFT_COLS = { k: '#181820', K: '#585868', G: '#c8ccd8', o: '#f0b030' };
  // yours, and (against another player) theirs, painted blue
  let forkliftSprite = null, forkliftSprite2 = null;
  function forkliftArt(o) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d'), cols = Object.assign({}, FORKLIFT_COLS, { o });
    FORKLIFT_ART.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') { g.fillStyle = cols[ch]; g.fillRect(x, y, 1, 1); }
    }));
    return c;
  }
  const PALLETS = [
    { name: 'FAN', letter: 'F', c: '#3868c8' },
    { name: 'COIL', letter: 'C', c: '#d08040' },
    { name: 'DAMPER', letter: 'D', c: '#a8acb8' },
    { name: 'MOTOR', letter: 'M', c: '#58a848' },
  ];
  function drawPallet(x, y, k) {
    const p = PALLETS[k];
    ctx.fillStyle = '#5c3c1c'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#9a6434';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 1, y + 1 + i * 5, 14, 4);
    ctx.fillStyle = col.dark; ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = p.c; ctx.fillRect(x + 3, y + 3, 10, 10);
    text(p.letter, x + 6, y + 5, 1, col.dark);
  }
  // Against another player (VERSUS.forklift) you're both in the same warehouse, and the
  // game server runs it (server/games/forklift.js, with the same layout and driving as
  // here): one truck and one call at a time, so you race for the same pallets, and empty
  // forks driven into the pallet on theirs take it. Hitting Steve or bringing the wrong
  // pallet stalls you instead of costing time, since the clock is shared. Your keys go to
  // the server, and both forklifts are drawn where it says, eased so they glide.
  function ForkliftGame(vs) {
    const TIME = 5400, TOP = 20, R = 6.5; // 90 seconds; the arena starts under the status bar
    const foe = vs ? vs.name : '';
    const rndOrder = Math.random, rndStock = Math.random;
    if (!forkliftSprite) { forkliftSprite = forkliftArt(FORKLIFT_COLS.o); forkliftSprite2 = forkliftArt('#58a8e0'); }
    // against a player: the server's latest view, the last of its events you've heard,
    // the keys you've told it about, their forklift (eased like yours), their count, and
    // how it ended ('win', 'lose' or 'tie')
    let view = null, lastEv = 0, sentH = -1, presses = '', theirs = 0, outcome = null;
    const other = { x: 118, y: 156, a: 0, tx: 118, ty: 156, ta: 0, load: -1, stall: 0 };
    // racks along the top and bottom with a row of bays in front of each, two pillars,
    // the dock wall and the trailer of the truck backed up to it
    const BAY_X = [24, 58, 92, 126, 160, 194];
    const BAYS = BAY_X.map((x) => ({ x, y: TOP + 22 })).concat(BAY_X.map((x) => ({ x, y: SH - 22 })));
    const WALLS = [
      { x: -20, y: 0, w: 22, h: SH }, { x: 0, y: -20, w: SW, h: TOP + 20 }, { x: 0, y: SH - 2, w: SW, h: 20 },
      { x: 6, y: TOP, w: 206, h: 10 }, { x: 6, y: SH - 10, w: 206, h: 10 },
      { x: 60, y: 124, w: 12, h: 12 }, { x: 168, y: 124, w: 12, h: 12 },
      { x: 262, y: TOP, w: 6, h: 70 - TOP }, { x: 262, y: 176, w: 6, h: SH - 176 },
      { x: 268, y: 64, w: 60, h: 6 }, { x: 268, y: 176, w: 60, h: 6 }, { x: 314, y: 64, w: 10, h: 118 },
    ];
    const TRUCK = { x1: 266, y1: 72, x2: 312, y2: 174 };
    const STEVE_X = 238;
    const steve = { y: 60, to: 60, wait: 30, dir: 'down', step: 0, sprites: spritesFor('Steve') };
    const WHEEL = 4; // notches each way
    const lift = { x: 118, y: 130, a: 0, v: 0, load: -1, wheel: 0 };
    let pallets = [], state = 'ready', t = 0, left = TIME, loaded = 0, order = 0, record = false;
    let msg = null, beepT = 0, hurt = 0, bumpT = 0, wheelT = 0;
    // after picking up, setting down or being turned away at the truck, nothing more
    // happens until the forks are clear of everything again
    let armed = true;
    const say2 = (str, good) => { msg = { str, t: 0, good }; };
    const fx = () => Math.cos(lift.a), fy = () => Math.sin(lift.a);
    const tipAt = (d) => ({ x: lift.x + fx() * d, y: lift.y + fy() * d });
    function newOrder() {
      // something that's actually out there (or already on the forks)
      const kinds = pallets.map((p) => p.k).concat(lift.load >= 0 ? [lift.load] : []);
      order = kinds[Math.floor(rndOrder() * kinds.length)];
    }
    function restock() {
      const free = BAYS.filter((b) => !pallets.some((p) => Math.hypot(p.x - b.x, p.y - b.y) < 16)
        && Math.hypot(lift.x - b.x, lift.y - b.y) > 24);
      if (!free.length) return;
      const b = free[Math.floor(rndStock() * free.length)];
      pallets.push({ x: b.x, y: b.y, k: Math.floor(rndStock() * PALLETS.length) });
    }
    BAYS.forEach((b, i) => { if (i % 4 !== 3) pallets.push({ x: b.x, y: b.y, k: (i * 3 + (i >> 2)) % PALLETS.length }); });
    newOrder();
    // push the circle at (x, y) out of everything solid; returns how far it moved
    function pushOut(c, r, solid) {
      let mx = 0, my = 0;
      for (const o of solid) {
        const cx = Math.max(o.x, Math.min(c.x + mx, o.x + o.w)), cy = Math.max(o.y, Math.min(c.y + my, o.y + o.h));
        const dx = c.x + mx - cx, dy = c.y + my - cy, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 0.001) { my -= r; continue; }
        mx += dx / d * (r - d); my += dy / d * (r - d);
      }
      return { x: mx, y: my };
    }
    function finish() {
      state = 'done'; t = 0;
      record = saveBest('forklift', loaded);
      sfx(loaded ? 'cup' : 'buzz');
    }
    // A view from the server: where everything is now, and what's just happened.
    function hear(v) {
      if (!v || !Array.isArray(v.l) || !Array.isArray(v.p) || !Array.isArray(v.sc)) return;
      const me = v.l[v.s], them = v.l[1 - v.s];
      if (!Array.isArray(me) || !Array.isArray(them)) return;
      const first = !view;
      view = v;
      const ok = (k) => (PALLETS[k] ? k : -1);
      if (!first && me[5] !== lift.wheel) sfx('select');
      Object.assign(lift, { tx: +me[0] || 0, ty: +me[1] || 0, ta: +me[2] || 0, v: +me[3] || 0, load: ok(me[4]), wheel: Math.max(-WHEEL, Math.min(WHEEL, me[5] | 0)), stall: me[6] ? 1 : 0 });
      Object.assign(other, { tx: +them[0] || 0, ty: +them[1] || 0, ta: +them[2] || 0, load: ok(them[4]), stall: them[6] ? 1 : 0 });
      if (first) { lift.x = lift.tx; lift.y = lift.ty; lift.a = lift.ta; other.x = other.tx; other.y = other.ty; other.a = other.ta; }
      pallets = [];
      for (let i = 0; i + 1 < v.p.length; i += 2) if (BAYS[v.p[i]] && PALLETS[v.p[i + 1]]) pallets.push({ x: BAYS[v.p[i]].x, y: BAYS[v.p[i]].y, k: v.p[i + 1] });
      if (Array.isArray(v.st)) {
        steve.to = +v.st[0] || steve.y; steve.dir = v.st[1] ? 'down' : 'up';
        steve.wait = v.st[2] ? 0 : 1; steve.step = v.st[2] === 2 ? 1 : 0;
        if (first) steve.y = steve.to;
      }
      if (PALLETS[v.order]) order = v.order;
      left = Math.max(0, v.left | 0);
      loaded = v.sc[v.s] | 0; theirs = v.sc[1 - v.s] | 0;
      state = v.ph ? 'play' : 'ready';
      if (!v.ph) t = v.t | 0;
      for (const e of Array.isArray(v.ev) ? v.ev : []) {
        if (!Array.isArray(e) || !(e[0] > lastEv)) continue;
        lastEv = e[0];
        if (!first) heard(e[1] === v.s, e[2], PALLETS[e[3]] ? PALLETS[e[3]].name : '');
      }
    }
    // something that happened in the warehouse: to you (mine), or to them
    function heard(mine, k, what) {
      if (k === 'steal') {
        if (mine) { sfx('lift', 0.6); say2('You swiped ' + foe + '\'s ' + what + '!', true); } else { sfx('buzz'); say2(foe + ' swiped your ' + what + '!', false); }
      } else if (k === 'cup') {
        if (mine) { sfx('cup'); say2(['Loaded!', 'Nice!', 'On the truck!', 'Next!'][loaded % 4], true); } else { sfx('bump'); say2(foe + ' loaded the ' + what + '.', false); }
      } else if (!mine) {
        // the rest only matter to whoever it happened to
      } else if (k === 'lift') sfx('lift', 0.6);
      else if (k === 'putt') sfx('putt');
      else if (k === 'bump') sfx('bump');
      else if (k === 'wrong') { sfx('buzz'); say2('Wrong pallet! The truck wants ' + what + '. Stalled 2s', false); }
      else if (k === 'steve') { sfx('buzz'); say2('Steve: Zero days since an incident! Stalled 3s', false); }
    }
    // turn a towards b the short way round, k of the way
    const turnTo = (a, b, k) => a + ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
    function versusUpdate() {
      if (state === 'done' || state === 'gone') {
        if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
          remove(self); vs.end();
          say(state === 'gone' ? foe + ' has parked up and gone. Nobody wins this one.'
            : outcome === 'win' ? 'You out-loaded ' + foe + ', ' + loaded + ' pallets to ' + theirs + '!'
              : outcome === 'lose' ? foe + ' out-loaded you, ' + theirs + ' pallets to ' + loaded + '.'
                : 'Dead even: ' + loaded + ' pallets each.');
        }
        return;
      }
      if (pressed.has('b')) { remove(self); vs.end(); say('You park the forklift. Steve looks relieved.'); return; }
      if (vs.view !== view) hear(vs.view);
      const r = vs.result;
      if (r !== undefined || vs.gone) {
        if (r && typeof r.w === 'number' && Array.isArray(r.sc) && view) {
          loaded = r.sc[view.s] | 0; theirs = r.sc[1 - view.s] | 0;
          outcome = r.w === view.s ? 'win' : r.w < 0 ? 'tie' : 'lose';
          state = 'done'; sfx(outcome === 'win' ? 'cup' : 'buzz');
        } else state = 'gone';
        t = 0;
        return;
      }
      if (!view) return;
      // your keys: what's held, and any presses since last time
      const h = (held.up ? 1 : 0) | (held.down ? 2 : 0) | (held.left ? 4 : 0) | (held.right ? 8 : 0);
      if (pressed.has('left')) presses += 'l';
      if (pressed.has('right')) presses += 'r';
      if (pressed.has('a')) presses += 'a';
      if (h !== sentH || presses) { vs.input({ h, e: presses.slice(-8) }); sentH = h; presses = ''; }
      // both forklifts and Steve glide to where the server has them
      for (const f of [lift, other]) { f.x += (f.tx - f.x) * 0.5; f.y += (f.ty - f.y) * 0.5; f.a = turnTo(f.a, f.ta, 0.5); }
      steve.y += (steve.to - steve.y) * 0.5;
      if (state === 'play' && lift.v < -0.1 && --beepT <= 0) { sfx('beep'); beepT = 22; }
    }
    const self = {
      music: 'run',
      update() {
        t++;
        if (msg && ++msg.t > 70) msg = null;
        if (vs) { versusUpdate(); return; }
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            say(loaded ? 'You loaded ' + loaded + ' pallet' + (loaded === 1 ? '' : 's') + '. Jay says the truck can finally leave.'
              : 'The truck driver sighs and opens another bag of your snacks.');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You park the forklift. Steve looks relieved.'); return; }
        if (--left <= 0) { left = 0; finish(); return; }
        // driving: it only turns while it's rolling, and backwards it steers the other way
        const max = lift.load >= 0 ? 1.7 : 2.1;
        if (held.up) lift.v = Math.min(max, lift.v + 0.07);
        else if (held.down) lift.v = Math.max(-1.3, lift.v - 0.07);
        else lift.v *= 0.92;
        if (Math.abs(lift.v) < 0.02) lift.v = 0;
        // the wheels stay where you turn them: a notch per press (and quickly, a notch every
        // few ticks, while held), and Space straightens them
        if (held.left || held.right) {
          if (pressed.has('left') || pressed.has('right') || ++wheelT % 4 === 0) {
            const w = Math.max(-WHEEL, Math.min(WHEEL, lift.wheel + (held.right ? 1 : -1)));
            if (w !== lift.wheel) { lift.wheel = w; sfx('select'); }
          }
        } else wheelT = 0;
        if (pressed.has('a') && lift.wheel) { lift.wheel = 0; sfx('select'); }
        lift.a += lift.wheel / WHEEL * 0.05 * Math.max(-1, Math.min(1, lift.v / 1.2));
        lift.x += fx() * lift.v; lift.y += fy() * lift.v;
        if (lift.v < -0.1 && --beepT <= 0) { sfx('beep'); beepT = 22; }
        // bump into things: the body, and the forks (or the pallet on them); loose pallets
        // only stop the body, so the forks can slide in under one
        const steveBox = { x: STEVE_X - 5, y: steve.y - 6, w: 10, h: 12 };
        const solid = WALLS.concat(pallets.map((p) => ({ x: p.x - 8, y: p.y - 8, w: 16, h: 16 })), [steveBox]);
        const body = { x: lift.x - fx() * 1.5, y: lift.y - fy() * 1.5 };
        let push = pushOut(body, R, solid);
        const front = lift.load >= 0 ? { c: tipAt(10), r: 7, s: solid } : { c: tipAt(7), r: 2, s: WALLS.concat([steveBox]) };
        const push2 = pushOut({ x: front.c.x + push.x, y: front.c.y + push.y }, front.r, front.s);
        push = { x: push.x + push2.x, y: push.y + push2.y };
        if (push.x || push.y) {
          const hitSteve = pushOut(body, R + 1, [steveBox]).x || pushOut(body, R + 1, [steveBox]).y
            || pushOut(front.c, front.r + 1, [steveBox]).x || pushOut(front.c, front.r + 1, [steveBox]).y;
          if (hitSteve && hurt <= 0 && Math.abs(lift.v) > 0.5) {
            left = Math.max(0, left - 300); hurt = 90; sfx('buzz');
            say2('Steve: Zero days since an incident! -5s', false);
          } else if (Math.abs(lift.v) > 0.8 && bumpT <= 0) { sfx('bump'); bumpT = 12; }
          lift.x += push.x; lift.y += push.y;
          lift.v = 0;
        }
        if (hurt > 0) hurt--;
        if (bumpT > 0) bumpT--;
        // the forks load and unload themselves when you're in the right place
        const tip = tipAt(8), held1 = tipAt(11); // the fork tips, and the middle of a pallet on them
        // in the truck as soon as the pallet (or the empty forks) is through the doorway
        const inTruck = held1.x > TRUCK.x1 && held1.x < TRUCK.x2 && held1.y > TRUCK.y1 && held1.y < TRUCK.y2;
        const under = pallets.find((q) => Math.hypot(q.x - tip.x, q.y - tip.y) < 9);
        // an empty bay you're facing into, with the pallet over it
        const bay = BAYS.find((b) => Math.hypot(b.x - held1.x, b.y - held1.y) < 7 && (b.y < SH / 2 ? fy() < -0.7 : fy() > 0.7)
          && !pallets.some((q) => Math.hypot(q.x - b.x, q.y - b.y) < 16));
        if (!armed) {
          armed = !inTruck && !pallets.some((q) => Math.hypot(q.x - tip.x, q.y - tip.y) < 16)
            && !BAYS.some((b) => Math.hypot(b.x - held1.x, b.y - held1.y) < 12);
        } else if (lift.load < 0 && under) {
          lift.load = under.k; pallets = pallets.filter((q) => q !== under); sfx('lift', 0.6); armed = false;
        } else if (lift.load >= 0 && inTruck) {
          armed = false;
          if (lift.load === order) {
            loaded++; lift.load = -1; sfx('cup');
            say2(['Loaded!', 'Nice!', 'On the truck!', 'Next!'][loaded % 4], true);
            restock(); newOrder();
          } else {
            left = Math.max(0, left - 180); sfx('buzz');
            say2('Wrong pallet! The truck wants ' + PALLETS[order].name + '. -3s', false);
          }
        } else if (lift.load >= 0 && bay) {
          pallets.push({ x: bay.x, y: bay.y, k: lift.load }); lift.load = -1; sfx('putt'); armed = false;
        }
        // Steve wanders up and down the crosswalk, stopping now and then
        if (steve.wait > 0) steve.wait--;
        else if (Math.abs(steve.y - steve.to) < 1) {
          steve.to = TOP + 14 + Math.random() * (SH - TOP - 28);
          steve.wait = 20 + Math.floor(Math.random() * 70);
        } else {
          steve.dir = steve.to > steve.y ? 'down' : 'up';
          const ny = steve.y + Math.sign(steve.to - steve.y) * Math.min(0.6, Math.abs(steve.to - steve.y));
          // he waits for the forklift rather than walking into it
          if (Math.hypot(lift.x - STEVE_X, lift.y - ny) > 14 && Math.hypot(tipAt(8).x - STEVE_X, tipAt(8).y - ny) > 10) steve.y = ny;
          if (tick % 12 === 0) steve.step ^= 1;
        }
      },
      draw() {
        // concrete, the crosswalk, the dock and the trailer
        ctx.fillStyle = '#c8ccd8'; ctx.fillRect(0, TOP, SW, SH - TOP);
        ctx.fillStyle = '#a4acc4';
        for (let x = 0; x < SW; x += 64) ctx.fillRect(x, TOP, 1, SH - TOP);
        for (let y = TOP; y < SH; y += 64) ctx.fillRect(0, y, SW, 1);
        ctx.fillStyle = '#f0d040';
        for (let y = TOP + 4; y < SH; y += 12) ctx.fillRect(STEVE_X - 10, y, 20, 6);
        for (const o of WALLS) {
          if (o.y >= SH - 2 || o.y + o.h <= TOP) continue;
          ctx.fillStyle = col.dark; ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.fillStyle = '#585868'; ctx.fillRect(268, TOP, SW - 268, SH - TOP); // the yard outside
        ctx.fillStyle = '#383848'; ctx.fillRect(268, 70, 46, 106);
        ctx.fillStyle = '#7a5430'; ctx.fillRect(270, 72, 42, 102);
        ctx.fillStyle = '#5c3c1c';
        for (let y = 76; y < 174; y += 8) ctx.fillRect(270, y, 42, 1);
        ctx.fillStyle = '#f0d040'; ctx.fillRect(264, 72, 2, 102);
        text('TRUCK', 276, 188, 1, col.light);
        // what's been loaded so far, stacked from the back of the trailer
        for (let i = 0; i < Math.min(loaded, 12); i++) {
          ctx.fillStyle = '#9a6434'; ctx.fillRect(298 - (i % 2) * 13, 160 - Math.floor(i / 2) * 15, 12, 12);
          ctx.fillStyle = '#585868'; ctx.fillRect(300 - (i % 2) * 13, 162 - Math.floor(i / 2) * 15, 8, 8);
        }
        // racks: orange beams on dark uprights, and yellow bay markings in front
        for (const ry of [TOP, SH - 10]) {
          ctx.fillStyle = '#484858'; ctx.fillRect(6, ry, 206, 10);
          ctx.fillStyle = '#f08020'; ctx.fillRect(6, ry + 3, 206, 4);
          ctx.fillStyle = col.dark;
          for (let x = 6; x <= 212; x += 34) ctx.fillRect(x, ry, 3, 10);
        }
        ctx.fillStyle = '#f0d040';
        for (const b of BAYS) { ring(b.x - 10, b.y - 10, 20, 20); }
        for (const p of pallets) drawPallet(Math.round(p.x) - 8, Math.round(p.y) - 8, p.k);
        // Steve, in his hi-vis
        const img = steve.sprites[steve.dir][steve.wait > 0 ? 0 : 1 + steve.step];
        ctx.drawImage(img, STEVE_X - 8, Math.round(steve.y) - 10);
        // the other player's forklift (blue), with their name over it; a stalled one flashes
        if (vs && view && state !== 'gone') {
          const oa = Math.round(other.a / (Math.PI / 16)) * (Math.PI / 16);
          ctx.save();
          if (other.stall && (tick >> 3) & 1) ctx.globalAlpha = 0.5;
          ctx.translate(Math.round(other.x), Math.round(other.y));
          ctx.rotate(oa + Math.PI / 2);
          if (other.load >= 0) drawPallet(-8, -19, other.load);
          ctx.drawImage(forkliftSprite2, -8, -8);
          ctx.restore();
          // over it, or under it when it's up against the top racks
          text(foe, Math.round(other.x) - foe.length * 3, Math.round(other.y) + (other.y < TOP + 30 ? 14 : -22), 1, '#283878');
        }
        // the forklift, turned to face where it's going (pixels kept square)
        const a = Math.round(lift.a / (Math.PI / 16)) * (Math.PI / 16);
        ctx.save();
        if (lift.stall && (tick >> 3) & 1) ctx.globalAlpha = 0.5;
        ctx.translate(Math.round(lift.x), Math.round(lift.y));
        ctx.rotate(a + Math.PI / 2);
        if (lift.load >= 0) drawPallet(-8, -19, lift.load);
        ctx.drawImage(forkliftSprite, -8, -8);
        ctx.fillStyle = col.dark;
        for (const wx of [-6, 6]) {
          ctx.save();
          ctx.translate(wx, 5);
          ctx.rotate(-lift.wheel / WHEEL * 0.6);
          ctx.fillRect(-1, -2, 3, 5);
          ctx.restore();
        }
        ctx.restore();
        // which way the wheels are turned
        text('WHEELS', 274, 206, 1, col.light);
        ctx.fillStyle = '#383848'; ctx.fillRect(272, 218, 41, 7);
        ctx.fillStyle = '#8890a0';
        for (let i = -WHEEL; i <= WHEEL; i++) ctx.fillRect(292 + i * 5, i ? 220 : 218, 1, i ? 3 : 7);
        ctx.fillStyle = '#f0b030'; ctx.fillRect(291 + lift.wheel * 5, 216, 3, 11);
        // status bar: the order, time and score
        ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, TOP);
        ctx.fillStyle = col.dark; ctx.fillRect(0, TOP - 1, SW, 1);
        text('TRUCK WANTS:', 6, 6);
        drawPallet(80, 2, order);
        text(PALLETS[order].name, 100, 6);
        const tm = 'Time ' + Math.ceil(left / 60);
        text(tm, 160, 6, 1, left < 600 && (tick >> 3) & 1 ? '#c03030' : col.dark);
        const sc = 'Loaded ' + loaded;
        text(sc, SW - 6 - sc.length * 6, 6);
        if (msg && state === 'play') {
          const w = msg.str.length * 6 + 16, y = msg.good ? 96 : 104;
          box((SW - w) >> 1, y, w, 24);
          text(msg.str, ((SW - w) >> 1) + 8, y + 8, 1, msg.good ? '#2c6a34' : '#c03030');
        }
        // against a player: their count, in the yard above the truck
        if (vs) {
          text(foe.slice(0, 8), 272, 30, 1, col.light);
          text(theirs + ' loaded', 272, 44, 1, '#f0d040');
        }
        if (vs && !view && state !== 'gone') { box(60, 100, 200, 40); ctext('Waiting for ' + foe + '...', 108); ctext('Esc: give up', 122); }
        else if (state === 'ready') readyBox(t, vs ? 'Same truck. Swipe their pallets!' : 'Space: straighten the wheels');
        else if (state === 'gone') doneBox([foe + ' has gone.', 'Nobody wins this one.'], t);
        else if (state === 'done' && vs) doneBox([outcome === 'win' ? 'You out-loaded ' + foe + '!' : outcome === 'lose' ? foe + ' wins!' : 'Dead even!',
          'You ' + loaded + '  ' + foe + ' ' + theirs], t);
        else if (state === 'done') doneBox(['Time\'s up! The truck has to go.', 'Pallets loaded: ' + loaded,
          record ? 'New record!' : 'Best ' + getBest('forklift')], t);
      },
    };
    return self;
  }

  // ---------- Even Coat: spray the grey unit in the plant's paint booth ----------
  // The front of the unit is a grid of 4px cells, each holding how thick its paint is.
  // Holding A sprays a round pattern that's heaviest in the middle, so one pass leaves a
  // stripe and passes that overlap by half leave an even coat; stay in one place and it
  // runs. Nobody masked the portholes, latches or nameplate, so paint on those counts
  // against you, and dust drifting down from the booth fans spoils the finish unless you
  // blow it away with the spray before it lands. Enter calls QC over when you're done.
  const PAINTS = [
    { name: 'HAAKON BLUE', c: '#3868c8', l: '#6890e0', d: '#283878' },
    { name: 'SAFETY YELLOW', c: '#f0c030', l: '#f8e070', d: '#b88810' },
    { name: 'FOREST GREEN', c: '#4a9a50', l: '#78c070', d: '#2c6a34' },
    { name: 'FIRE RED', c: '#c84038', l: '#f07858', d: '#8a2420' },
    { name: 'DESERT TAN', c: '#c8a870', l: '#e8d0a0', d: '#8a6a38' },
    { name: 'HOSPITAL WHITE', c: '#f4f4f8', l: '#ffffff', d: '#c8b078' }, // thick white goes creamy, not grey like the primer
  ];
  const PRIMER = '#a4acc4';
  // the booth unit's tiles ('0'), and the same tiles in the last paint you finished
  const boothTiles = [];
  if (PLANT >= 0) MAPS.floors[PLANT].tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => { if (c === '0') boothTiles.push({ x, y }); }));
  let boothCoat = null;
  function paintBooth(p) {
    const f = MAPS.floors[PLANT];
    boothCoat = boothTiles.map((k) => ({ x: k.x, y: k.y, img: Art.renderTileAs(f, k.x, k.y, '0', { P: p.l, p: p.c }) }));
  }
  // a colour part of the way from a to b
  function mixHex(a, b, k) {
    const h = (s, i) => parseInt(s.slice(i, i + 2), 16);
    return '#' + [1, 3, 5].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * k).toString(16).padStart(2, '0')).join('');
  }

  function PaintGame() {
    const TOP = 20, CELL = 4, CW = 68, CH = 43, X0 = 24, Y0 = 30, FW = CW * CELL, FH = CH * CELL;
    const TIME = 2700, CAN = 2100, R = 14, DOSE = 0.14, SPEED = 2.4;
    const GOOD = 0.9, THIN = 0.5, HEAVY = 2.2, RUN = 2.9, FOUL = 0.5;
    const paint = PAINTS[Math.floor(Math.random() * PAINTS.length)];
    // shades from bare primer up to a full coat, then heavier and darker
    const SHADES = [];
    for (let i = 0; i <= 8; i++) SHADES.push(mixHex(PRIMER, paint.c, i / 8));
    const heavy = mixHex(paint.c, paint.d, 0.55);
    const coat = new Float32Array(CW * CH), ran = new Uint8Array(CW * CH), bare = new Int8Array(CW * CH).fill(-1);
    // what nobody masked, in cells: two portholes, five latches and the nameplate
    const BARE = [
      { round: true, x: 9, y: 11, r: 3.3 }, { round: true, x: 26, y: 16, r: 3.3 },
      { x1: 13, y1: 8, x2: 14, y2: 9 }, { x1: 13, y1: 33, x2: 14, y2: 34 },
      { x1: 29, y1: 13, x2: 30, y2: 14 }, { x1: 29, y1: 34, x2: 30, y2: 35 },
      { x1: 45, y1: 28, x2: 46, y2: 29 },
      { x1: 38, y1: 5, x2: 47, y2: 9, plate: true },
    ];
    BARE.forEach((o, n) => {
      o.cells = [];
      for (let j = 0; j < CH; j++)
        for (let i = 0; i < CW; i++) {
          const inside = o.round ? Math.hypot(i - o.x, j - o.y) <= o.r : i >= o.x1 && i <= o.x2 && j >= o.y1 && j <= o.y2;
          if (inside) { bare[j * CW + i] = n; o.cells.push(j * CW + i); }
        }
    });
    let state = 'ready', t = 0, left = TIME, can = CAN, record = false, result = null, endMsg = '';
    let gx = X0 + 20, gy = Y0 + 20, spraying = false, dustT = 200;
    const drips = [], dust = [], puffs = [], specks = [];
    function spray() {
      const i0 = Math.max(0, Math.floor((gx - X0 - R) / CELL)), i1 = Math.min(CW - 1, Math.floor((gx - X0 + R) / CELL));
      const j0 = Math.max(0, Math.floor((gy - Y0 - R) / CELL)), j1 = Math.min(CH - 1, Math.floor((gy - Y0 + R) / CELL));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const dx = X0 + (i + 0.5) * CELL - gx, dy = Y0 + (j + 0.5) * CELL - gy, d2 = (dx * dx + dy * dy) / (R * R);
          if (d2 >= 1) continue;
          const k = j * CW + i;
          coat[k] += DOSE * (1 - d2);
          // too much in one place and it sags into a run; one run per blob
          if (coat[k] >= RUN && !ran[k] && bare[k] < 0) {
            for (let y = j - 4; y <= j + 4; y++)
              for (let x = i - 4; x <= i + 4; x++) if (x >= 0 && y >= 0 && x < CW && y < CH) ran[y * CW + x] = 1;
            const x = X0 + i * CELL + 1, y = Y0 + (j + 1) * CELL;
            drips.push({ x, y0: y, y, end: Math.min(Y0 + FH - 2, y + 14 + Math.random() * 22) });
            sfx('putt');
          }
        }
    }
    function score() {
      let sum = 0, n = 0;
      for (let k = 0; k < coat.length; k++) {
        if (bare[k] >= 0) continue;
        n++;
        sum += coat[k] >= GOOD ? 1 : coat[k] >= THIN ? 0.5 : 0;
      }
      // QC starts from the coverage (out of 100) and takes off for each defect, up to a limit
      const covered = Math.round(100 * sum / n);
      const fouled = BARE.filter((o) => o.cells.some((k) => coat[k] >= FOUL)).length;
      const lines = [
        ['Coverage ' + covered + '%', covered],
        ['Runs x' + drips.length, -Math.min(30, 3 * drips.length)],
        ['Overspray x' + fouled, -4 * fouled],
        ['Dust x' + specks.length, -Math.min(10, 2 * specks.length)],
      ];
      return { lines, total: Math.max(0, lines.reduce((a, l) => a + l[1], 0)) };
    }
    function finish(why) {
      result = score(); endMsg = why; state = 'done'; t = 0;
      record = saveBest('paint', result.total);
      sfx('ding');
    }
    const self = {
      music: 'plant',
      update() {
        t++;
        if (state === 'ready') { if (t > 75) { state = 'play'; t = 0; } return; }
        if (state === 'done') {
          if (t > 30 && (pressed.has('a') || pressed.has('b'))) {
            remove(self);
            paintBooth(paint);
            const s = result.total;
            say(s >= 85 ? 'QC runs the gauge over it and signs it off. "Now that\'s an even coat."'
              : s >= 60 ? 'QC frowns at a couple of spots, then signs it off anyway. "It\'s going on a roof."'
                : 'QC sticks a red tag on it. "Sand it back and do it again."');
          }
          return;
        }
        if (pressed.has('b')) { remove(self); say('You put the spray gun down. The unit stays grey.'); return; }
        if (pressed.has('start')) { finish('You call QC over.'); return; }
        const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0), dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
        const v = dx && dy ? SPEED * 0.7071 : SPEED;
        gx = Math.max(X0 - 18, Math.min(X0 + FW + 18, gx + dx * v));
        gy = Math.max(Y0 - 14, Math.min(Y0 + FH + 14, gy + dy * v));
        spraying = held.a && can > 0;
        if (spraying) {
          can--;
          spray();
          if (t % 5 === 0) sfx('spray');
        }
        for (const d of drips) if (d.y < d.end) d.y += 0.3;
        // dust drifts down from the fans; the spray blows it away, otherwise it lands
        if (--dustT <= 0) {
          dust.push({ x: X0 + 10 + Math.random() * (FW - 20), y: TOP + 2, land: Y0 + 20 + Math.random() * (FH - 30), ph: Math.random() * 6 });
          dustT = 140 + Math.floor(Math.random() * 160);
        }
        for (let i = dust.length - 1; i >= 0; i--) {
          const m = dust[i];
          m.y += 0.4; m.ph += 0.05;
          const x = m.x + Math.sin(m.ph) * 6;
          if (spraying && Math.hypot(x - gx, m.y - gy) < R + 4) {
            dust.splice(i, 1); puffs.push({ x, y: m.y, t: 0 }); sfx('blip', true);
          } else if (m.y >= m.land) {
            dust.splice(i, 1); specks.push({ x: Math.round(x), y: Math.round(m.y) }); sfx('bump');
          }
        }
        for (let i = puffs.length - 1; i >= 0; i--) if (++puffs[i].t > 16) puffs.splice(i, 1);
        if (--left <= 0) finish('Time\'s up! QC is here.');
        else if (can <= 0) finish('The can\'s empty. QC is here.');
      },
      draw() {
        // the booth: pale walls with the exhaust filters behind the unit
        ctx.fillStyle = '#e4e4ec'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#c8ccd8';
        for (let x = 4; x < SW; x += 26) ctx.fillRect(x, TOP + 2, 22, Y0 - TOP - 6);
        ctx.fillStyle = '#8890a0'; ctx.fillRect(0, Y0 + FH + 10, SW, SH - Y0 - FH - 10);
        // the unit's front: every cell its own thickness of paint
        ctx.fillStyle = col.dark; ctx.fillRect(X0 - 2, Y0 - 2, FW + 4, FH + 4);
        for (let j = 0; j < CH; j++)
          for (let i = 0; i < CW; i++) {
            const c = coat[j * CW + i];
            ctx.fillStyle = c >= HEAVY ? heavy : c >= GOOD ? SHADES[8] : SHADES[Math.min(7, Math.floor(c / GOOD * 8))];
            ctx.fillRect(X0 + i * CELL, Y0 + j * CELL, CELL, CELL);
          }
        // the base rail, panel seams, door edges, hinges and the louvre's blades
        ctx.fillStyle = '#484858'; ctx.fillRect(X0 - 2, Y0 + FH + 2, FW + 4, 8);
        ctx.fillStyle = col.dark;
        for (let x = X0 + 6; x < X0 + FW - 6; x += 24) ctx.fillRect(x, Y0 + FH + 4, 6, 4);
        ctx.fillStyle = 'rgba(24,24,32,0.45)';
        for (const i of [17, 34, 51]) ctx.fillRect(X0 + i * CELL, Y0, 1, FH);
        for (const [x1, y1, x2, y2] of [[3, 4, 15, 39], [20, 9, 31, 39], [37, 22, 47, 36]]) {
          ring(X0 + x1 * CELL, Y0 + y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL);
          ctx.fillRect(X0 + x1 * CELL - 1, Y0 + (y1 + 2) * CELL, 3, 6);
          ctx.fillRect(X0 + x1 * CELL - 1, Y0 + (y2 - 3) * CELL, 3, 6);
        }
        ring(X0 + 54 * CELL, Y0 + 8 * CELL, 12 * CELL, 27 * CELL);
        for (let y = Y0 + 8 * CELL + 4; y < Y0 + 35 * CELL - 2; y += 5) ctx.fillRect(X0 + 54 * CELL + 2, y, 12 * CELL - 4, 2);
        // the bits that should have been masked, then whatever paint got on them
        for (const o of BARE) {
          if (o.round) {
            const cx = X0 + (o.x + 0.5) * CELL, cy = Y0 + (o.y + 0.5) * CELL;
            ctx.fillStyle = '#8890a0'; ctx.beginPath(); ctx.arc(cx, cy, o.r * CELL + 1, 0, 7); ctx.fill();
            ctx.fillStyle = '#283038'; ctx.beginPath(); ctx.arc(cx, cy, o.r * CELL - 2, 0, 7); ctx.fill();
            ctx.fillStyle = '#bce0f8'; ctx.fillRect(cx - 5, cy - 5, 3, 2);
          } else if (o.plate) {
            const x = X0 + o.x1 * CELL, y = Y0 + o.y1 * CELL, w = (o.x2 - o.x1 + 1) * CELL, h = (o.y2 - o.y1 + 1) * CELL;
            ctx.fillStyle = col.dark; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#d8dce8'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
            text('HAAKON', x + 2, y + 3, 1, '#484858');
            ctx.fillStyle = '#8890a0'; ctx.fillRect(x + 3, y + 12, w - 6, 1); ctx.fillRect(x + 3, y + 15, w - 12, 1);
          } else {
            const x = X0 + o.x1 * CELL, y = Y0 + o.y1 * CELL;
            ctx.fillStyle = col.dark; ctx.fillRect(x - 3, y, 10, 8);
            ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x - 2, y + 1, 8, 3); ctx.fillRect(x + 3, y + 1, 3, 6);
          }
          for (const k of o.cells) {
            if (coat[k] < 0.15) continue;
            ctx.globalAlpha = Math.min(1, coat[k] / 1.2);
            ctx.fillStyle = paint.c;
            ctx.fillRect(X0 + (k % CW) * CELL, Y0 + Math.floor(k / CW) * CELL, CELL, CELL);
          }
          ctx.globalAlpha = 1;
        }
        // runs, and dust stuck in the finish
        for (const d of drips) {
          ctx.fillStyle = paint.d; ctx.fillRect(d.x, d.y0 - 3, 2, d.y - d.y0 + 3);
          ctx.fillRect(d.x - 1, Math.round(d.y), 4, 3);
        }
        ctx.fillStyle = '#5c4c3a';
        for (const m of specks) { ctx.fillRect(m.x, m.y, 2, 2); ctx.fillRect(m.x - 1, m.y + 1, 1, 1); }
        // dust in the air, and puffs where the spray caught it
        for (const m of dust) { ctx.fillStyle = '#8a7458'; ctx.fillRect(Math.round(m.x + Math.sin(m.ph) * 6), Math.round(m.y), 2, 2); }
        for (const p of puffs) {
          ctx.fillStyle = '#f8f8f8';
          for (let a = 0; a < 6; a++) ctx.fillRect(Math.round(p.x + Math.cos(a) * p.t * 0.8), Math.round(p.y + Math.sin(a) * p.t * 0.8), 1, 1);
        }
        // the spray gun's pattern: a ring, and a mist of paint while the trigger's held
        if (state === 'play') {
          const x = Math.round(gx), y = Math.round(gy);
          if (spraying) {
            ctx.fillStyle = paint.l;
            for (let i = 0; i < 14; i++) {
              const a = Math.random() * 6.3, d = Math.sqrt(Math.random()) * R;
              ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1);
            }
          }
          ctx.fillStyle = spraying ? col.dark : 'rgba(24,24,32,0.6)';
          for (let a = 0; a < 24; a += 1) if (a & 1) ctx.fillRect(Math.round(x + Math.cos(a / 24 * 6.283) * R), Math.round(y + Math.sin(a / 24 * 6.283) * R), 1, 1);
          ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y, 5, 1);
          // the gun itself, held below and to the right of where it's aimed
          ctx.fillStyle = col.dark; ctx.fillRect(x + 6, y + 6, 10, 5); ctx.fillRect(x + 13, y + 10, 4, 8);
          ctx.fillStyle = '#8890a0'; ctx.fillRect(x + 7, y + 7, 8, 3); ctx.fillRect(x + 14, y + 11, 2, 6);
          ctx.fillStyle = paint.c; ctx.fillRect(x + 9, y + 2, 5, 4);
        }
        // status bar: the job's colour, the can, the time
        ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, TOP);
        ctx.fillStyle = col.dark; ctx.fillRect(0, TOP - 1, SW, 1);
        ctx.fillRect(6, 4, 12, 12); ctx.fillStyle = paint.c; ctx.fillRect(7, 5, 10, 10);
        text(paint.name, 22, 7);
        text('CAN', 150, 7);
        ctx.fillStyle = col.dark; ctx.fillRect(170, 5, 62, 10);
        ctx.fillStyle = '#585868'; ctx.fillRect(172, 7, 58, 6);
        ctx.fillStyle = can < CAN * 0.15 && (tick >> 3) & 1 ? '#c03030' : paint.c;
        ctx.fillRect(172, 7, Math.round(58 * can / CAN), 6);
        const tm = 'Time ' + Math.ceil(left / 60);
        text(tm, SW - 6 - tm.length * 6, 7, 1, left < 600 && (tick >> 3) & 1 ? '#c03030' : col.dark);
        if (state === 'ready') {
          readyBox(t, 'Hold Space: spray');
          text('Keep it off the glass, latches and plate!', 8, SH - 12, 1, col.light);
        } else if (state === 'done') {
          // QC's sheet: the coverage, what each defect cost, and the score
          box(40, 40, 240, 156);
          ctext(endMsg, 52);
          result.lines.forEach(([label, pts], i) => {
            const v = (pts < 0 ? '-' : '+') + Math.abs(pts), y = 72 + i * 14;
            text(label, 60, y);
            text(v, 260 - v.length * 6, y, 1, pts < 0 ? '#c03030' : col.dark);
          });
          ctx.fillStyle = col.dark; ctx.fillRect(60, 128, 200, 1);
          const sc = String(result.total);
          text('QC score', 60, 134); text(sc, 260 - sc.length * 6, 134);
          ctext(record ? 'New record!' : 'Best ' + getBest('paint'), 154);
          if (t > 30 && (tick >> 4) & 1) ctext('Press Space', 176);
        } else text('Esc: give up   Enter: call QC', 8, SH - 12, 1, col.light);
      },
    };
    return self;
  }

  function openStartMenu() {
    sfx('menu');
    // Linda's and Kiki's lists show up in the menu once you've got them
    const items = () => (P.floor === PLANT ? [['LEAVE PLANT', (self) => { remove(self); leavePlant(); }]] : [])
      .concat([['MAP', () => ui.push(MapView())]])
      .concat(MP_ON ? [['WHO\'S HERE', (self) => { remove(self); mpWho(); }], ['SAY SOMETHING', (self) => { remove(self); mpSayMenu(); }]] : [])
      .concat(mp.newer ? [['UPDATE GAME', () => location.reload()]] : [])
      .concat(quest ? [['LINDA\'S LIST', () => ui.push(LindaList())]] : [])
      .concat(kikiList ? [['KIKI\'S LIST', () => ui.push(KikiList())]] : [])
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
  // Linda (the ghost in the Haunted Office) left a list of things she never got round to.
  // Each time you take it out of the locker you get a different handful of tasks from
  // LINDA_TASKS. Mini-games report their results to questNote(key, value) and a task
  // is crossed off when value reaches its target. Finish them all, and find her stapler,
  // and Linda is free to move on. None of this is saved: it starts fresh every visit.
  const LINDA_TASKS = [
    { key: 'coffee', need: 75, text: 'Catch 75 drops of coffee' },
    { key: 'pong', need: 1, text: 'Beat the TV at Pong' },
    { key: 'punch5', need: 300, text: 'Punch the bag for 300 points' },
    { key: 'squat', need: 175, text: 'Squat 175 lb' },
    { key: 'run', need: 150, text: 'Run 150m on the treadmill' },
    { key: 'pulldown', need: 10, text: 'Do 10 clean lat pulldowns' },
    { key: 'jam', need: 3, text: 'Unjam 3 sheets from the printer' },
    { key: 'blackjack', need: 300, text: 'Win 100 spring rolls off Cody' }, // you start with 200
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
    { key: 'cpr', need: 15, text: 'Get 15 perfect CPR compressions' },
    { key: 'engrave', need: 70, text: 'Engrave a nameplate (70% on)' },
    { key: 'golf', need: 1, text: 'Play a round on Wade\'s green' },
    { key: 'legosolo', need: 5, text: 'Clear 5 rows at Joe\'s Lego shelf' },
  ];
  const LINDA_COUNT = 7;
  const LINDA_WAITING = [
    'Ooooo... you found my list! Don\'t forget the rest of it.',
    'Boooo... how is my list coming along?',
    'You can check my list from the Start menu. Boo.',
  ];
  let quest = null; // { tasks: [{key, need, text, done}], complete }
  let playerName = '';
  const questQueue = []; // messages to show once you're back walking around

  // ---------- Linda's red stapler ----------
  // Linda needs her stapler back AND her list done before she can move on. The stapler
  // sits on a desk, counter, shelf or table somewhere different every visit, and Linda
  // drops hints about which room. Not saved, like the list.
  const STAPLER_ON = 'dkbT';
  const stapler = (function hideStapler() {
    const spots = [];
    MAPS.floors.forEach((f, fi) => f.tiles.forEach((rowStr, y) => [...rowStr].forEach((c, x) => {
      if (!STAPLER_ON.includes(c) || fi === PLANT) return;
      // it has to be reachable: next to floor you can stand on, in a room you can walk into
      for (const [dx, dy] of Object.values(DIRS)) {
        const r = roomAt(fi, x + dx, y + dy);
        if (!WALKABLE.includes(tileAt(fi, x + dx, y + dy)) || !r) continue;
        if (r.name === 'Haunted Office' || r.dark || r.gender || r.curtain || / \/ \d/.test(r.name)) continue;
        spots.push({ floor: fi, x, y, room: r });
        return;
      }
    })));
    return Object.assign({ found: false }, spots[Math.floor(Math.random() * spots.length)]);
  })();
  let lindaFree = false; // she's gone for good
  let freeing = null; // { npc, t } while she floats away
  // "in Zin's office upstairs", "by the photocopier upstairs", ... for Linda's hints
  function staplerPlace() {
    const name = stapler.room.name, m = /^\d+ (.+)$/.exec(name);
    const BY = { Photocopier: 'by the photocopier', Engraver: 'by the engraver', Visitor: 'in the visitor office' };
    let place;
    if (BY[m ? m[1] : name]) place = BY[m ? m[1] : name];
    else if (m && !NOT_PEOPLE.includes(m[1])) {
      place = 'in ' + m[1].split(' / ').map((n) => ((window.PEOPLE || {})[n] || {}).name || n).join(' and ') + '\'s office';
    } else place = 'in the ' + (m ? m[1] : name.replace(/^(Lunch Room|Boardroom|Instrument Room) \d+$/, '$1'));
    return place + (stapler.floor ? ' upstairs' : ' downstairs');
  }
  const staplerHint = () => 'Ooooo... I think I left my stapler ' + staplerPlace() + '...';
  // The stapler or the list is done: say so, and point you at Linda once both are.
  function lindaLighter() {
    if (stapler.found && quest && quest.complete) {
      questQueue.push('The air feels lighter than ever. You should go and see Linda in the Haunted Office.');
    } else questQueue.push('The air feels a little lighter.');
  }
  function drawStaplerAt(x, y) {
    ctx.fillStyle = '#5a1010'; ctx.fillRect(x + 3, y + 9, 10, 3); // base
    ctx.fillStyle = '#d02828'; ctx.fillRect(x + 3, y + 6, 10, 3); // top arm
    ctx.fillStyle = '#f06060'; ctx.fillRect(x + 4, y + 6, 8, 1);
    ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 11, y + 8, 2, 1); // metal tip
  }
  // ---------- Jenn's cookies ----------
  // A plate of homemade cookies on the lunch room counter, next to the sink.
  const cookies = { floor: 0, x: 78, y: 4 };
  function drawCookiesAt(x, y) {
    ctx.fillStyle = '#a8acb8'; ctx.fillRect(x + 1, y + 8, 14, 5); // plate
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 2, y + 8, 12, 4);
    ctx.fillStyle = '#7a4a20'; // cookies
    ctx.fillRect(x + 3, y + 7, 4, 3); ctx.fillRect(x + 8, y + 7, 4, 3); ctx.fillRect(x + 5, y + 5, 5, 3);
    ctx.fillStyle = '#c88848';
    ctx.fillRect(x + 4, y + 7, 2, 2); ctx.fillRect(x + 9, y + 7, 2, 2); ctx.fillRect(x + 6, y + 5, 3, 2);
    ctx.fillStyle = '#301808'; // chocolate chips
    ctx.fillRect(x + 4, y + 8, 1, 1); ctx.fillRect(x + 10, y + 7, 1, 1); ctx.fillRect(x + 7, y + 6, 1, 1);
    ctx.fillStyle = '#f8e070'; ctx.fillRect(x + 12, y + 10, 3, 3); // the note
  }
  function lindaTalk(npc, says) {
    const listDone = quest && quest.complete;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (stapler.found && listDone) { say(says('My stapler... my list... it\'s all done. I... I am finally FREE!'), () => ui.push(LindaFree(npc))); return; }
    if (listDone) { say(says('You did EVERYTHING on my list! But I can\'t rest without my stapler. I think I left it ' + staplerPlace() + '...')); return; }
    if (stapler.found) {
      say(says(quest ? 'My stapler! Thank you! Now if only somebody would finish my list...'
        : 'My stapler! Thank you! But there are still things I never got to do... I left a list in the gym lockers.'));
      return;
    }
    const lines = quest ? LINDA_WAITING : npc.lines.concat(['Ooooo... I left something in the gym lockers...']);
    say(says(pick(lines.concat([staplerHint()]))));
  }

  // Both done: Linda glows, rises up a beam of light and floats away, to some happy music.
  const FREE_TICKS = 480;
  function LindaFree(npc) {
    freeing = { npc, t: 0 };
    const self = {
      music: 'free',
      update() {
        if (++freeing.t < FREE_TICKS) return;
        remove(self);
        npcs.splice(npcs.indexOf(npc), 1);
        freeing = null; lindaFree = true;
        sfx('ding'); questBoard('linda');
        questQueue.push('Linda floats up through the ceiling tiles, stapler in hand, and is gone.');
        questQueue.push('Somewhere far above, there is a happy "Boooo!" and the click of a stapler.');
        questQueue.push('The Haunted Office feels warm for the first time in years.');
      },
      draw() {
        // a warm wash over everything, ending in a soft white flash
        const t = freeing ? freeing.t : FREE_TICKS;
        ctx.fillStyle = 'rgba(255, 220, 120, ' + (0.12 * Math.min(1, t / 90)) + ')';
        ctx.fillRect(0, 0, SW, SH);
        const flash = t > FREE_TICKS - 70 ? 1 - Math.abs(t - (FREE_TICKS - 35)) / 35 : 0;
        if (flash > 0) { ctx.fillStyle = 'rgba(255, 255, 255, ' + flash.toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); }
      },
    };
    return self;
  }
  // Linda mid-departure: the beam, the sparkles and her, drawn where she stands.
  function drawFreeing(sx, sy, img) {
    const t = freeing.t;
    const grow = Math.min(1, t / 90); // the beam opens up first
    const rise = t < 120 ? 0 : Math.pow((t - 120) / (FREE_TICKS - 120), 1.6) * (sy + 40); // then up she goes
    const fadeOut = t < 200 ? 1 : Math.max(0, 1 - (t - 200) / (FREE_TICKS - 240));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bw = 4 + grow * 20 + Math.sin(t / 6) * 2;
    ctx.globalAlpha = 0.35 * grow;
    ctx.fillStyle = '#f8d870'; ctx.fillRect(sx + 8 - bw / 2, 0, bw, sy + 18);
    ctx.globalAlpha = 0.5 * grow;
    ctx.fillStyle = '#fff8d0'; ctx.fillRect(sx + 8 - bw / 4, 0, bw / 2, sy + 18);
    // sparkles drifting up the beam
    for (let i = 0; i < 20; i++) {
      const p = (t * (0.6 + (i % 5) * 0.15) + i * 23) % 90;
      const px = sx + 8 + Math.sin(t / 15 + i * 1.7) * (6 + (i % 4) * 3);
      const py = sy + 16 - rise * 0.5 - p;
      ctx.globalAlpha = grow * (1 - p / 90);
      ctx.fillStyle = i % 3 ? '#f8e070' : '#ffffff';
      ctx.fillRect(Math.round(px), Math.round(py), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
    // a soft halo that follows her up
    const hy = sy + 8 - rise, glow = ctx.createRadialGradient(sx + 8, hy, 1, sx + 8, hy, 18);
    glow.addColorStop(0, 'rgba(255, 240, 180, 0.6)'); glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.globalAlpha = grow * fadeOut; ctx.fillStyle = glow; ctx.fillRect(sx - 12, hy - 20, 40, 40);
    ctx.restore();
    // Linda herself, glowing and fading as she rises
    ctx.globalAlpha = 0.75 * fadeOut;
    ctx.drawImage(img, sx, Math.round(sy - 2 - rise + Math.sin(t / 8) * 2));
    ctx.globalAlpha = 1;
  }

  function startQuest() {
    const pool = LINDA_TASKS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    quest = { tasks: pool.slice(0, LINDA_COUNT).map((t) => Object.assign({ done: false }, t)), complete: false };
  }
  // ---------- Employee of the Month: help out every coworker with a challenge ----------
  // Beat each person's own game (the results come in through questNote too). Once
  // everyone's been helped, Kiki at reception hands you the award and your picture goes
  // up by the front entrance. Not saved, like Linda's list.
  const COWORKERS = [
    { name: 'Nathan', task: 'Grab 8 of Nathan\'s trophies', key: 'trophy', need: 8, thanks: 'Nathan grudgingly admits you know your trophies.' },
    { name: 'Wade', task: 'Beat Wade at putting', key: 'wade', need: 2, thanks: 'Wade shakes your hand. He is already planning the rematch.' },
    { name: 'Kiki', task: 'Beat me at the candy jar', key: 'jar', need: 2, thanks: 'Kiki is impressed. Nobody out-guesses her at the candy jar.' },
    { name: 'Jhonna', task: 'Fill in 15 of Jhonna\'s fields', key: 'forms', need: 15, thanks: 'Jhonna can finally close that Manulife ticket.' },
    { name: 'Richard', task: 'Win Richard\'s air duel', key: 'battle', need: 1, thanks: 'Richard bows. Your air handling knowledge is sound.' },
    { name: 'Damir', task: 'Fix the lights in Damir\'s office', key: 'dark', need: 1, thanks: 'Damir feels safe in the dark again, thanks to you.' },
    { name: 'Patrick', task: 'Win Patrick\'s dance-off', key: 'danceoff', need: 1, thanks: 'Patrick is out of breath. "Same time next week?"' },
    { name: 'Nik', task: 'Out-cook Nik at the wok', key: 'wok', need: 1, thanks: 'Nik hands you a pair of chopsticks. "You can cook. Don\'t let it go to your head."' },
    { name: 'Dmitriy', task: 'Pass Dmitriy\'s knife skills test', key: 'carrot', need: 1, thanks: 'Dmitriy nods. "Even slices. Nik never managed that."' },
    { name: 'Joe', task: 'Win Joe\'s Lego brick battle', key: 'lego', need: 1, thanks: 'Joe builds you a tiny trophy out of yellow bricks. "Master builder."' },
  ];
  const helped = new Set();
  let eotm = false; // Kiki has given you the award
  let kikiList = false; // Kiki has handed you her list
  function coworkerNote(key, value) {
    for (const c of COWORKERS) {
      if (helped.has(c.name) || c.key !== key || !(value >= c.need)) continue;
      helped.add(c.name);
      questQueue.push(c.thanks);
      const left = COWORKERS.length - helped.size;
      if (left && kikiList) {
        questQueue.push('"' + c.task + '" gets ticked off Kiki\'s list! (' + left + ' to go)');
      } else if (left) {
        questQueue.push('Word gets around. Kiki at reception keeps track of who has helped who...');
      } else {
        questQueue.push('You\'ve helped everyone in the office! Kiki at reception wants a word.');
      }
    }
  }

  // Called with every mini-game result (from saveBest, and directly by the games that
  // don't keep a best score).
  function questNote(key, value) {
    coworkerNote(key, value);
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
        lindaLighter();
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

  // A list on old lined paper, ticked and crossed off as you go. Used for Linda's list
  // and Kiki's Employee of the Month list. first: just handed over, with what to say then.
  function PaperList(title, items, sign, footer, first) {
    const self = {
      update() {
        if (pressed.has('a') || pressed.has('b') || pressed.has('start')) {
          sfx('select'); remove(self);
          if (first) say(first);
        }
      },
      draw() {
        ctx.fillStyle = col.dark; ctx.fillRect(0, 0, SW, SH);
        const X = 30, Y = 6, W = 260, H = 214, INK = '#2a3a8a';
        ctx.fillStyle = '#c8bc98'; ctx.fillRect(X + 3, Y + 3, W, H);
        ctx.fillStyle = '#f4ecd0'; ctx.fillRect(X, Y, W, H);
        const list = items(), gap = list.length > 7 ? Math.min(17, Math.floor(130 / (list.length - 1))) : 20; // long lists sit closer together
        ctx.fillStyle = '#b8d0e8'; for (let y = Y + 40; y < Y + H - 8; y += gap) ctx.fillRect(X + 4, y + 11, W - 8, 1);
        ctx.fillStyle = '#e8a0a0'; ctx.fillRect(X + 24, Y + 4, 1, H - 8);
        const tx0 = X + 24 + ((W - 24 - title.length * 6) >> 1);
        text(title, tx0, Y + 12, 1, '#a03030');
        ctx.fillStyle = '#a03030'; ctx.fillRect(tx0, Y + 21, title.length * 6 - 1, 1);
        list.forEach((task, i) => {
          const y = Y + 40 + i * gap, tx = X + 34;
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
        const doneN = list.filter((x) => x.done).length;
        text(doneN + '/' + list.length + ' done', X + 34, Y + H - 18, 1, '#7080b0');
        const note = footer();
        if (note) text(note, X + W - 10 - note.length * 6, Y + H - 30, 1, '#c03030');
        text(sign, X + W - 10 - sign.length * 6, Y + H - 18, 1, INK);
        text('Space: put it away', 6, SH - 14, 1, '#f8f8f8');
      },
    };
    return self;
  }
  function LindaList(first) {
    return PaperList('THINGS I NEVER GOT TO DO', () => quest.tasks, '- Linda',
      () => (!quest.complete ? '' : stapler.found ? 'Thank you. I can rest now.' : 'Now... where is my stapler?'),
      first && 'It\'s signed "Linda". You fold it into your pocket. (Read it again any time from the Start menu.)');
  }
  function KikiList(first) {
    return PaperList('EMPLOYEE OF THE MONTH', () => COWORKERS.map((c) => ({ text: c.task, done: helped.has(c.name) })), '- Kiki',
      () => (eotm ? 'Congratulations!' : helped.size === COWORKERS.length ? 'All done! Come and see me.' : ''),
      first && 'You tuck Kiki\'s list into your pocket. (Read it again any time from the Start menu.)');
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
        const note = 'For helping out every single coworker.';
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
  // Bob owns the company, so nobody else gets to be Bob (or BOB, or B.o.b, or B0B).
  const isBob = (name) => name.toLowerCase().replace(/0/g, 'o').replace(/[^a-z]/g, '') === 'bob';
  let bobNote = 0; // ticks the "only ONE true Bob" message has been up; 0 when it isn't
  function nameDone() {
    if (fade) return;
    if (isBob(playerName)) { playerName = ''; bobNote = 1; sfx('buzz'); return; }
    playerName = playerName.trim() || 'New Hire';
    store.set('name', playerName);
    sfx('menu');
    startFade(HALLOWEEN ? openCostumes : enterOffice);
  }
  function enterOffice() {
    mode = 'play'; roomName = null; curRoom = null; updateRoom();
    if (HALLOWEEN) questQueue.push('It\'s Halloween at Haakon! When you\'re ready for the party, go and take a seat in the downstairs boardroom.');
  }
  function nameType(tok) {
    if (tok === 'OK') { nameDone(); return; }
    if (tok === 'DEL') { playerName = playerName.slice(0, -1); sfx('select'); return; }
    const ch = tok === 'SPACE' ? ' ' : tok;
    if (playerName.length < NAME_MAX) { playerName += ch; sfx('blip'); } else sfx('bump');
  }
  // physical keyboard: type straight into the name
  function nameKey(e) {
    if (bobNote) { if (!e.repeat && bobNote > 20) { bobNote = 0; sfx('select'); } return true; }
    if (e.code === 'Enter') { if (!e.repeat) nameDone(); return true; }
    if (e.code === 'Backspace') { nameType('DEL'); return true; }
    if (e.key && e.key.length === 1 && /[A-Za-z0-9 .'\-]/.test(e.key)) { nameType(e.key === ' ' ? 'SPACE' : e.key); return true; }
    return false;
  }
  function updateName() {
    if (bobNote) {
      if (++bobNote > 20 && (pressed.has('a') || pressed.has('b') || pressed.has('start'))) { bobNote = 0; sfx('select'); }
      return;
    }
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
    if (bobNote) {
      box(20, 78, SW - 40, 84);
      ['There is only ONE true Bob', 'in this company.', '', 'Name yourself something else.'].forEach((line, i) =>
        text(line, (SW - line.length * 6) >> 1, 92 + i * 12));
      if (bobNote > 20 && (tick >> 4) & 1) text(isTouch ? 'Press A' : 'Press any key', (SW - (isTouch ? 7 : 13) * 6) >> 1, 144);
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
    g: ['Shelves stocked with chips, granola bars and pop. Snack heaven!\nWait, where did all the coke go? There\'s a John-shaped gap on the bottom shelf.'],
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
    '+': ['A steel work table. Somebody\'s tape measure is holding down a drawing.'],
  };

  // ---------- other players: everyone playing at once shares the office ----------
  // Each copy of the game keeps a small record of where its player is, and gets everyone
  // else's. Anything meant for one player (a challenge, a move in a match) is a message
  // to them. All that goes through the game server (GAME_SERVER, the server/ folder) if
  // there is one: a WebSocket carries it both ways, and the server can also run a game
  // itself (see `server` in VERSUS). Without one it goes through the leaderboards'
  // database: your record at mp/<world>/players/<id>, everyone's streamed back down an
  // EventSource (so there's no SDK to load), and messages in mp/<world>/inbox/<id>.
  // The hosted copy plays in the 'live' world; a copy opened from the folder or a local
  // server joins 'test', so trying things out never puts anyone in the real office.
  // tools/test.html stays offline unless its address has &server=<game server> or
  // &mp=<database>.
  const GAME_SERVER = 'wss://play.haakonlife.com';
  const MP_WS = (window.MP_SERVER !== undefined ? window.MP_SERVER : GAME_SERVER).replace(/\/+$/, '');
  const MP_URL = MP_WS ? '' : (window.MP_URL !== undefined ? window.MP_URL : BOARD_URL).replace(/\/+$/, '');
  const MP_WORLD = BOARD_POSTS ? 'live' : 'test';
  const MP_ROOT = MP_URL + '/mp/' + MP_WORLD;
  const MP_ON = !!(MP_WS || MP_URL);
  // Bump this whenever a player's record or a message changes shape: copies on different
  // numbers don't see each other at all, rather than seeing each other wrong.
  const MP_PROTO = 1;
  // when this copy was published (see index.html): two players can only play a match on
  // the same version, and an older copy is told to reload when a newer one turns up
  const MP_VER = window.GAME_VERSION ? +window.GAME_VERSION : 0;
  const MP_LIVE = 12000; // ms without word from a player before they count as gone
  const MP_ASK = 30000; // ms a challenge waits for an answer
  // What you can say, a page of the menu each. A line is sent as its place in the whole
  // list, so only ever add lines to the end of the last page (or add a new page after it):
  // an older copy ignores a number it doesn't have, but moving a line would make older
  // copies show the wrong one.
  const MP_SAY = [
    ['SMALL TALK', ['Hi!', 'Hello!', 'Follow me!', 'Wait up!', 'Over here!', 'Nice!', 'Ha ha!', 'Good game!', 'Bye!']],
    ['SHOP TALK', ['Check the CFM!', 'Coil\'s frozen!', 'Change the filters!', 'Balance that damper!',
      'Is that REV C?', 'Ship it today!', 'Run it through SDG.', 'Belt\'s slipping!', 'Mind the static!']],
  ];
  const MP_LINES = MP_SAY.flatMap(([, lines]) => lines);
  // Or type your own (CUSTOM on that menu): up to MP_TYPE_MAX of the characters the font
  // has. It goes in your record as w0 and w1, 16 characters each, since a record only
  // carries short strings.
  const MP_TYPE_MAX = 32;
  const MP_TYPE_OK = /[A-Za-z0-9 .,!?'"\-:\/&#()+%]/;
  const mpClean = (str) => [...String(str)].filter((ch) => MP_TYPE_OK.test(ch)).join('').replace(/\s+/g, ' ').trim().slice(0, MP_TYPE_MAX);
  const mp = {
    id: Math.random().toString(36).slice(2, 12), on: false, heard: false, others: {}, mail: [],
    sending: false, sentKey: '', lastSend: 0, tickAt: Date.now(), say: -1, sayText: '', sayN: 0, bubble: null, newer: false, nudged: false,
    pending: null, invite: null, match: null,
  };
  // the head-to-head games: a challenge names one by key. These all run in each player's
  // own browser, passing moves back and forth. A game with `server: true` is run by the
  // game server instead (the module with the same key in server/games/): its Game is
  // handed a match whose `view` is what the server last said the game looks like,
  // `input(d)` sends the server what you did, and `result` is set once it's over. Those
  // can only be picked when there's a game server.
  const VERSUS = {
    duel: { label: 'AIR DUEL', title: 'an air handling duel', Game: (m) => BattleGame(m) },
    jar: { label: 'CANDY JAR', title: 'a candy jar guess-off', Game: (m) => CandyJarGame(m) },
    lego: { label: 'BRICK BATTLE', title: 'a Lego brick battle', Game: (m) => LegoGame(false, m) },
    dance: { label: 'DANCE-OFF', title: 'a dance-off', Game: (m) => DanceGame(m) },
    forklift: { label: 'FORKLIFT RUSH', title: 'a Forklift Rush race', server: true, Game: (m) => ForkliftGame(m) },
    coffee: { label: 'COFFEE MACHINE', title: 'a coffee catch-off', Game: (m) => CoffeeGame(m) },
    run: { label: 'TREADMILL', title: 'a treadmill race', Game: (m) => RunGame(m) },
    snake: { label: 'SNAKE', title: 'a game of Snake', Game: (m) => SnakeGame(m) },
    pong: { label: 'PONG', title: 'a game of Pong', server: true, Game: (m) => PongGame(m) },
    simon: { label: 'CONTROL PANEL', title: 'a control panel showdown', Game: (m) => SimonGame(m) },
  };
  // A small seeded random number generator (mulberry32), so both players in a match get
  // the same jars.
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mpLive = (o) => !!o && Date.now() - o.seen < MP_LIVE;
  const mpHere = () => Object.values(mp.others).filter(mpLive);
  function mpAt(fi, x, y) {
    return mpHere().find((o) => o.f === fi && ((o.x === x && o.y === y) || (Math.round(o.px / 16) === x && Math.round(o.py / 16) === y))) || null;
  }
  // where someone is, for the who's-here list
  function mpWhere(o) {
    const r = roomAt(o.f, o.x, o.y);
    return r ? r.name : MAPS.floors[o.f].name;
  }
  // Their sprite sheet: the look they picked, in costume if they're wearing one.
  const mpSheets = {};
  function mpSprites(o) {
    const key = o.g + ':' + o.l + ':' + o.c + ':' + sdgIcon.complete;
    if (!mpSheets[key])
      mpSheets[key] = o.c ? Art.renderCostume(o.g, Art.LOOKS[o.g][o.l], o.c, sdgIcon) : charSprites[o.g][o.l];
    return mpSheets[key];
  }

  // Fold one Firebase stream event (a put or a patch at a path) into a copy of the tree.
  function treeApply(root, path, data, merge) {
    if (merge) { for (const k in data) root = treeApply(root, path + '/' + k, data[k]); return root; }
    const ks = path.split('/').filter(Boolean);
    if (!ks.length) return data && typeof data === 'object' ? data : {};
    let o = root;
    for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    if (data === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = data;
    return root;
  }
  function mpStream(path, onTree) {
    let tree = {};
    const es = new EventSource(MP_ROOT + path + '.json');
    const on = (merge) => (e) => {
      let d; try { d = JSON.parse(e.data); } catch (err) { return; }
      if (!d || typeof d.path !== 'string') return;
      mp.heard = true;
      tree = treeApply(tree, d.path, d.data, merge);
      onTree(tree);
    };
    es.addEventListener('put', on(false));
    es.addEventListener('patch', on(true));
    // a refusal (say the database rules don't allow it) closes the stream for good; a
    // dropped connection just reconnects on its own
    es.addEventListener('error', () => { if (es.readyState === EventSource.CLOSED) mp.heard = false; });
    return es;
  }
  function mpFetch(path, method, body, keepalive) {
    return fetch(MP_ROOT + path + '.json', { method, keepalive, body: body === undefined ? undefined : JSON.stringify(body) })
      .then((r) => { if (!r.ok) throw new Error(r.status); });
  }
  const mpSend = (to, msg) => {
    if (MP_WS) wsSend({ k: 'to', to, m: Object.assign({ n: playerName }, msg) });
    else mpFetch('/inbox/' + to, 'POST', Object.assign({ from: mp.id, n: playerName, t: { '.sv': 'timestamp' } }, msg)).catch(() => {});
  };

  // The game server: one WebSocket, which picks up again on its own if it drops. Your id
  // stays the same across a reconnect, and mpKey proves to the server that it's still you.
  // What comes down: 'all' (everyone here, when you connect), 'p' (one record changed,
  // or null when they've gone), 'm' (a message for you), and 'st' and 'end' (a server-run
  // game's state and result). See server/world.js.
  const mpKey = Math.random().toString(36).slice(2, 12);
  const ws = { sock: null, tree: {}, skew: 0, retry: 0 };
  const wsSend = (d) => { if (ws.sock && ws.sock.readyState === 1) ws.sock.send(JSON.stringify(d)); };
  // records are stamped with the server's clock: shift them onto this device's
  const wsRec = (r) => Object.assign({}, r, { t: (+r.t || 0) + ws.skew });
  function wsOpen() {
    if (ws.sock) { ws.sock.onclose = null; ws.sock.close(); }
    const sock = ws.sock = new WebSocket(MP_WS + '/?' + new URLSearchParams({ w: MP_WORLD, id: mp.id, key: mpKey }));
    sock.onopen = () => { ws.retry = 0; mp.sentKey = ''; mp.lastSend = 0; };
    sock.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch (err) { return; }
      if (d && typeof d === 'object') wsHear(d);
    };
    sock.onclose = (e) => {
      if (ws.sock !== sock) return;
      ws.sock = null; mp.heard = false;
      // somebody else has this id (vanishingly unlikely): pick another
      if (e.code === 4001) mp.id = Math.random().toString(36).slice(2, 12);
      setTimeout(wsOpen, e.code === 1012 || e.code === 4001 ? 500 : Math.min(30000, 1000 * 2 ** ws.retry++));
    };
  }
  function wsHear(d) {
    const m = mp.match;
    if (d.k === 'all') {
      mp.heard = true;
      ws.skew = Date.now() - (+d.now || Date.now());
      ws.tree = {};
      for (const id in d.players || {}) ws.tree[id] = wsRec(d.players[id]);
      mpPlayers(ws.tree);
      // a server-run game the server no longer has (it restarted, or you were gone too
      // long) is over
      if (m && m.server && !m.gone && !(d.rooms || []).includes(m.id)) m.gone = true;
    } else if (d.k === 'p' && typeof d.id === 'string') {
      if (d.r && typeof d.r === 'object') ws.tree[d.id] = wsRec(d.r); else delete ws.tree[d.id];
      mpPlayers(ws.tree);
    } else if (d.k === 'm' && d.m && typeof d.m === 'object') {
      mp.mail.push(d.m);
    } else if (m && m.server && d.m === m.id) {
      if (d.k === 'st') m.view = d.s;
      else if (d.k === 'end') m.result = d.r === undefined ? null : d.r;
    }
  }

  // Everyone's records, as they come down the stream.
  function mpPlayers(raw) {
    const now = Date.now();
    for (const id in mp.others) if (!raw[id]) delete mp.others[id];
    for (const id in raw) {
      const r = raw[id];
      if (id === mp.id || !r || typeof r !== 'object') continue;
      // a record nobody has touched in ten minutes is a closed tab that didn't get to say
      // goodbye: tidy it (and anything still waiting in its inbox) away
      if (!MP_WS && now - (+r.t || 0) > 600000) { mpFetch('/players/' + id, 'DELETE').catch(() => {}); mpFetch('/inbox/' + id, 'DELETE').catch(() => {}); continue; }
      if (r.p !== MP_PROTO) { if (r.p > MP_PROTO && now - r.t < 30000) mp.newer = true; delete mp.others[id]; continue; }
      const g = GENDERS.includes(r.g) ? r.g : 'male', looks = Art.LOOKS[g];
      const rec = {
        n: String(r.n || '?').slice(0, NAME_MAX), g, l: looks[r.l] ? r.l : 0, c: Art.COSTUMES[r.c] ? r.c : '',
        f: MAPS.floors[r.f] ? r.f : 0, x: +r.x || 0, y: +r.y || 0, d: DIRS[r.d] ? r.d : 'down', b: !!r.b,
        s: MP_LINES[r.s] ? r.s : -1, w: mpClean((typeof r.w0 === 'string' ? r.w0 : '') + (typeof r.w1 === 'string' ? r.w1 : '')),
        sn: +r.sn || 0, v: +r.v || 0, t: +r.t || 0, tc: !!r.tc,
      };
      let o = mp.others[id];
      if (!o) {
        // someone already here when you arrive counts if their record is recent (by this
        // device's clock); otherwise they show up as soon as their next update arrives
        o = mp.others[id] = { id, px: rec.x * 16, py: rec.y * 16, dir: rec.d, dist: 0, seen: now - rec.t < 30000 ? now : 0, said: 0 };
        Object.assign(o, rec);
        o.sn0 = rec.sn; // what they'd said before you got here stays unsaid
        continue;
      }
      if (rec.t !== o.t) o.seen = now;
      if (rec.sn !== o.sn && (rec.s >= 0 || rec.w)) o.said = now;
      Object.assign(o, rec);
    }
    if (MP_VER && mpHere().some((o) => o.v > MP_VER)) mp.newer = true;
  }
  // What's come into your inbox: dealt with (and deleted) one at a time, in order.
  const mpDone = new Set();
  function mpInbox(raw) {
    for (const key of Object.keys(raw).sort()) {
      const msg = raw[key];
      if (mpDone.has(key) || !msg || typeof msg !== 'object') continue;
      mpDone.add(key);
      mp.mail.push(msg);
      mpFetch('/inbox/' + mp.id + '/' + key, 'DELETE').catch(() => {});
    }
  }
  function mpConnect() {
    mp.on = true;
    if (MP_WS) {
      wsOpen();
      // a phone that's been asleep can come back with its connection looking open but
      // dead, so start a fresh one (the server swaps it in without anyone noticing)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wsOpen(); });
      // closing the tab (or reloading it) takes you out of the office straight away
      addEventListener('pagehide', () => {
        if (mp.match && !mp.match.gone) mpSend(mp.match.opp, { k: 'quit', m: mp.match.id });
        if (ws.sock) { ws.sock.onclose = null; ws.sock.close(1000); ws.sock = null; }
      });
      return;
    }
    let streams = [];
    const open = () => {
      streams.forEach((es) => es.close());
      streams = [mpStream('/players', mpPlayers), mpStream('/inbox/' + mp.id, mpInbox)];
    };
    open();
    // A phone that's been asleep or in the background can come back with its streams still
    // looking open but no longer delivering anything, so start them afresh. Nothing is
    // lost: a new stream begins with everything that's there now, inbox included, and
    // mail you've already read is skipped.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') open(); });
    // closing the tab (or reloading it) takes you out of the office straight away
    addEventListener('pagehide', () => {
      if (mp.match && !mp.match.gone) mpFetch('/inbox/' + mp.match.opp, 'POST', { k: 'quit', m: mp.match.id, from: mp.id, t: { '.sv': 'timestamp' } }, true).catch(() => {});
      mpFetch('/players/' + mp.id, 'DELETE', undefined, true).catch(() => {});
      mpFetch('/inbox/' + mp.id, 'DELETE', undefined, true).catch(() => {});
    });
  }

  // Your own record goes up whenever something about it changes (at most ten times a
  // second), and every few seconds anyway so everyone knows you're still here.
  function mpRecord() {
    const rec = {
      n: playerName || 'New Hire', g: pick.gender, l: pick.index, c: hw.worn ? hw.costume : '', f: P.floor,
      x: P.x + (P.moving ? P.mdx : 0), y: P.y + (P.moving ? P.mdy : 0), d: P.dir, b: ui.length || fade ? 1 : 0,
      s: mp.say, sn: mp.sayN, v: MP_VER, p: MP_PROTO, tc: isTouch ? 1 : 0,
    };
    if (mp.sayText) { rec.w0 = mp.sayText.slice(0, 16); if (mp.sayText.length > 16) rec.w1 = mp.sayText.slice(16); }
    return rec;
  }
  function mpPut() {
    const rec = mpRecord(), key = JSON.stringify(rec), now = Date.now();
    if (mp.sending || now < mp.lastSend + (key === mp.sentKey ? 4000 : 100)) return;
    if (MP_WS) {
      if (!ws.sock || ws.sock.readyState !== 1) return;
      mp.lastSend = now; mp.sentKey = key;
      wsSend({ k: 'me', r: rec });
      return;
    }
    mp.sending = true; mp.lastSend = now; mp.sentKey = key;
    rec.t = { '.sv': 'timestamp' };
    mpFetch('/players/' + mp.id, 'PUT', rec)
      // the database said no (or isn't there): try again in a while, not every tick
      .catch(() => { mp.lastSend = Date.now() + 10000; mp.sentKey = ''; })
      .finally(() => { mp.sending = false; });
  }

  // A match between two players. The games read the other player's moves with take(),
  // send theirs with send(), and call end() when they close. `soft` is set when either of
  // you is on a touch screen, so a game that goes easier on touch does for both of you.
  // In a game the server runs (`server`), view, input() and result take the place of
  // take() and send() (see VERSUS).
  function mpMatch(id, opp, name, seed, soft, server) {
    const o = mp.others[opp];
    const m = {
      id, opp, name, gone: false, rng: seeded(seed), soft: !!soft, moves: [],
      sprites: o ? mpSprites(o) : charSprites.male[0],
      server: !!server, view: null, result: undefined,
      send(data) { mpSend(opp, Object.assign({}, data, { k: 'mv', m: id })); },
      take() { return m.moves.shift(); },
      input(d) { wsSend({ k: 'in', m: id, d }); },
      end() {
        if (!m.gone) mpSend(opp, { k: 'quit', m: id });
        m.gone = true;
        if (mp.match === m) mp.match = null;
      },
    };
    return m;
  }
  function mpStart(id, opp, name, seed, game, soft) {
    sfx('menu');
    mp.match = mpMatch(id, opp, name, seed, soft, VERSUS[game].server);
    ui.push(VERSUS[game].Game(mp.match));
  }
  // Waiting for the other player to answer your challenge.
  function MpWait(c) {
    const until = Date.now() + MP_ASK;
    const self = {
      overlay: true,
      update() {
        const timeUp = Date.now() > until;
        if (!pressed.has('b') && !timeUp) return;
        mpSend(c.opp, { k: 'cancel', m: c.id });
        remove(self); mp.pending = null;
        if (timeUp) { sfx('bump'); say(c.name + ' didn\'t answer.'); } else sfx('select');
      },
      draw() {
        box(0, SH - 48, SW, 48);
        text('Waiting for ' + c.name + '.'.repeat(1 + ((tick >> 4) % 3)), 8, SH - 38);
        text('Esc: call it off', 8, SH - 22);
      },
      close() { remove(self); },
    };
    return self;
  }
  // Somebody challenged you.
  function mpInvite(msg) {
    const inv = { msg, until: Date.now() + MP_ASK, els: [] };
    const answer = (k) => { inv.els.forEach(remove); mp.invite = null; mpSend(msg.from, { k, m: msg.m }); };
    const dlg = Dialog(msg.n + ' challenges you to ' + VERSUS[msg.g].title + '!', {
      then() {
        const ch = Choice(['ACCEPT', 'NO THANKS'], -1, SH - 48 - 40, (i) => {
          answer(i === 0 ? 'yes' : 'no');
          if (i === 0) mpStart(msg.m, msg.from, msg.n, msg.seed, msg.g, msg.soft);
        });
        inv.els.push(ch); ui.push(ch);
      },
    });
    inv.els.push(dlg); ui.push(dlg);
    mp.invite = inv;
    sfx('ding');
  }
  function mpMail(msg) {
    const c = mp.pending, inv = mp.invite, m = mp.match;
    if (msg.k === 'ask') {
      // only if you're free: walking around, not mid-conversation or mid-game
      if (!VERSUS[msg.g] || c || inv || m || mode !== 'play' || fade || ui.length || questQueue.length) mpSend(msg.from, { k: 'busy', m: msg.m });
      else mpInvite(msg);
    } else if (c && msg.m === c.id) {
      remove(c.el); mp.pending = null;
      if (msg.k === 'yes') mpStart(c.id, c.opp, c.name, c.seed, c.game, c.soft);
      else if (msg.k === 'no') { sfx('bump'); say(c.name + ' said no thanks.'); }
      else if (msg.k === 'busy') { sfx('bump'); say(c.name + ' is busy right now. Try again in a moment.'); }
    } else if (inv && msg.m === inv.msg.m && msg.k === 'cancel') {
      inv.els.forEach(remove); mp.invite = null;
      say(msg.n + ' called off the challenge.');
    } else if (m && msg.m === m.id) {
      if (msg.k === 'quit' || msg.k === 'cancel') m.gone = true;
      else if (msg.k === 'mv') m.moves.push(msg);
    } else if (msg.k === 'yes') {
      mpSend(msg.from, { k: 'quit', m: msg.m }); // too late: you'd already given up waiting
    }
  }

  // Every tick: send your record, read your mail and walk everyone else towards where
  // they last said they were.
  function mpUpdate() {
    if (!MP_ON || mode !== 'play') return;
    if (!mp.on) mpConnect();
    mpPut();
    while (mp.mail.length) mpMail(mp.mail.shift());
    if (mp.invite && Date.now() > mp.invite.until) {
      mp.invite.els.forEach(remove); mp.invite = null;
      say('The challenge ran out of time.');
    }
    // They've gone quiet (a closed tab, or a phone that's been put away): tell them it's
    // over too, so if they come back they aren't left waiting on you. And if this copy is
    // the one that was frozen that long, they'll have given up on you already.
    const now = Date.now();
    if (mp.match && !mp.match.gone && (!mpLive(mp.others[mp.match.opp]) || now - mp.tickAt > MP_LIVE)) {
      mpSend(mp.match.opp, { k: 'quit', m: mp.match.id });
      mp.match.gone = true;
    }
    mp.tickAt = now;
    if (mp.newer && !mp.nudged && !ui.length && !fade) {
      mp.nudged = true;
      say('Somebody here has a newer version of the game. Reload the page (or START > UPDATE GAME) to get it.');
    }
    if (mp.bubble && ++mp.bubble.t > mpSayFor(mp.bubble.str)) mp.bubble = null;
    for (const o of Object.values(mp.others)) {
      const tx = o.x * 16, ty = o.y * 16, dx = tx - o.px, dy = ty - o.py;
      // a floor change, or falling more than a few tiles behind, jumps straight there
      if (o.f !== o.drawnF || Math.abs(dx) + Math.abs(dy) > 64) { o.px = tx; o.py = ty; o.drawnF = o.f; o.dir = o.d; continue; }
      if (!dx && !dy) { o.dir = o.d; o.dist = 0; continue; }
      // walk at your pace, a little quicker when lagging, one axis at a time like the player
      const sp = Math.abs(dx) + Math.abs(dy) > 16 ? 3 : 2;
      if (dx) { o.px += Math.sign(dx) * Math.min(sp, Math.abs(dx)); o.dir = dx < 0 ? 'left' : 'right'; }
      else { o.py += Math.sign(dy) * Math.min(sp, Math.abs(dy)); o.dir = dy < 0 ? 'up' : 'down'; }
      o.dist += sp;
    }
  }
  // the same step cycle as yours: a foot forward, stand, the other foot, stand
  const mpFrame = (o) => (o.px === o.x * 16 && o.py === o.y * 16 ? 0 : [1, 0, 2, 0][(o.dist >> 3) & 3]);

  // Names over everyone's heads, and whatever they've just said in a bubble above that.
  function mpBubble(str, x, y) {
    const w = str.length * 6 + 7;
    x = Math.max(1, Math.min(SW - w - 1, x - (w >> 1)));
    ctx.fillStyle = col.dark; ctx.fillRect(x, y, w, 13);
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 1, w - 2, 11);
    ctx.fillStyle = col.dark; ctx.fillRect(x + (w >> 1) - 1, y + 13, 3, 2);
    text(str, x + 4, y + 3);
  }
  function mpDrawTags(cx, cy, px, py) {
    const now = Date.now();
    for (const o of mpHere()) {
      if (o.f !== P.floor) continue;
      const sx = o.px - cx + 8, sy = o.py - cy - 4;
      if (sx < -40 || sx > SW + 40 || sy < -30 || sy > SH + 10) continue;
      const w = o.n.length * 6 + 3;
      ctx.globalAlpha = 0.7; ctx.fillStyle = col.dark; ctx.fillRect(sx - (w >> 1), sy - 11, w, 10); ctx.globalAlpha = 1;
      text(o.n, sx - (w >> 1) + 2, sy - 10, 1, '#f8f8f8');
      const said = o.s >= 0 ? MP_LINES[o.s] : o.w;
      if (o.said && o.sn !== o.sn0 && said && now - o.said < mpSayFor(said) * 1000 / 60) mpBubble(said, sx, sy - 28);
      else if (o.b) mpBubble('.'.repeat(1 + ((tick >> 4) % 3)).padEnd(3), sx, sy - 28);
    }
    if (mp.bubble) mpBubble(mp.bubble.str, px - cx + 8, py - cy - 22);
  }

  // ticks a speech bubble stays up: 3 seconds, longer for a long one you typed
  const mpSayFor = (str) => Math.max(180, str.length * 9);
  function mpSay(i, str) {
    mp.say = i; mp.sayText = i < 0 ? str : ''; mp.sayN++;
    mp.bubble = { str: i < 0 ? str : MP_LINES[i], t: 0 };
  }
  function mpSayMenu() {
    ui.push(Choice(MP_SAY.map(([page]) => page).concat(['CUSTOM']), -1, 0, (p) => {
      if (p < 0) return;
      if (p === MP_SAY.length) { ui.push(MpType()); return; }
      const first = MP_SAY.slice(0, p).reduce((n, [, lines]) => n + lines.length, 0);
      ui.push(Choice(MP_SAY[p][1], -1, 0, (i) => {
        if (i < 0) { mpSayMenu(); return; } // back to the pages
        mpSay(first + i);
      }));
    }));
  }
  // Typing your own line: straight from a keyboard, or picking characters with the arrows
  // (or D-pad) + A, like naming yourself. B rubs out a character, or backs out once it's
  // empty.
  const MP_TYPE_ROWS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '0123456789', '.,!?\'"-:/&()+']
    .map((r) => r.split('')).concat([['SPACE', 'DEL', 'SAY IT']]);
  function MpType() {
    let str = '';
    const cur = { r: 0, c: 0 }, Y = SH - 152;
    const row = () => MP_TYPE_ROWS[cur.r];
    function type(tok) {
      if (tok === 'SAY IT') { done(); return; }
      if (tok === 'DEL') { if (str) { str = str.slice(0, -1); sfx('select'); } else { remove(self); sfx('select'); mpSayMenu(); } return; }
      if (str.length >= MP_TYPE_MAX) { sfx('bump'); return; }
      str += tok === 'SPACE' ? ' ' : tok; sfx('blip');
    }
    function done() {
      remove(self);
      const line = mpClean(str);
      if (line) { sfx('select'); mpSay(-1, line); }
    }
    const self = {
      overlay: true,
      // a keyboard types straight in (see the keydown listener); only the arrows still
      // move around the characters
      key(e) {
        if (e.code === 'Enter') { if (!e.repeat) done(); return true; }
        if (e.code === 'Escape') { if (!e.repeat) { remove(self); sfx('select'); } return true; }
        if (e.code === 'Backspace') { if (str) type('DEL'); return true; }
        // (not a held key repeating: Space or E opened this box, and might still be down)
        if (e.key && e.key.length === 1 && MP_TYPE_OK.test(e.key)) { if (!e.repeat) type(e.key === ' ' ? 'SPACE' : e.key); return true; }
        return false;
      },
      update() {
        if (pressed.has('up')) { cur.r = (cur.r + MP_TYPE_ROWS.length - 1) % MP_TYPE_ROWS.length; cur.c = Math.min(cur.c, row().length - 1); sfx('select'); }
        if (pressed.has('down')) { cur.r = (cur.r + 1) % MP_TYPE_ROWS.length; cur.c = Math.min(cur.c, row().length - 1); sfx('select'); }
        if (pressed.has('left')) { cur.c = (cur.c + row().length - 1) % row().length; sfx('select'); }
        if (pressed.has('right')) { cur.c = (cur.c + 1) % row().length; sfx('select'); }
        if (pressed.has('a')) type(row()[cur.c]);
        if (pressed.has('b')) type('DEL');
        if (pressed.has('start')) done();
      },
      draw() {
        box(0, Y, SW, SH - Y);
        text('Say something:', 10, Y + 8);
        const n = MP_TYPE_MAX - str.length + '';
        text(n, SW - 10 - n.length * 6, Y + 8, 1, '#686878');
        ctx.fillStyle = col.dark; ctx.fillRect(8, Y + 19, SW - 16, 15);
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(9, Y + 20, SW - 18, 13);
        text(str, 12, Y + 23);
        if ((tick >> 4) & 1) { ctx.fillStyle = col.dark; ctx.fillRect(12 + str.length * 6, Y + 22, 1, 9); }
        MP_TYPE_ROWS.forEach((r, ri) => {
          const last = ri === MP_TYPE_ROWS.length - 1;
          r.forEach((tok, c) => {
            const x = last ? 30 + c * 64 : 30 + c * 20, y = Y + 42 + ri * 13;
            const sel = cur.r === ri && cur.c === c;
            if (sel) { ctx.fillStyle = col.dark; ctx.fillRect(x - 3, y - 3, tok.length * 6 + 5, 13); }
            text(tok, x, y, 1, sel ? col.light : col.dark);
          });
        });
        text(isTouch ? 'A: pick  B: rub out  START: say it' : 'Type, then Enter   Esc: cancel', 10, SH - 14, 1, '#686878');
      },
    };
    return self;
  }
  function mpChallenge(o) {
    const keys = Object.keys(VERSUS).filter((k) => MP_WS || !VERSUS[k].server);
    ui.push(Choice(keys.map((k) => VERSUS[k].label).concat(['CANCEL']), -1, SH - 48 - (keys.length + 1) * 16 - 8, (i) => {
      if (i < 0 || i >= keys.length) return;
      if (!mpLive(o)) { say(o.n + ' has gone.'); return; }
      if (o.b) { say(o.n + ' is busy right now. Try again in a moment.'); return; }
      if (o.v !== MP_VER) {
        say(o.v > MP_VER ? o.n + ' has a newer version of the game. Reload the page to play them.'
          : o.n + ' has an older version of the game. They need to reload before you can play.');
        return;
      }
      const c = { id: Math.random().toString(36).slice(2, 12), opp: o.id, name: o.n, game: keys[i], seed: Math.floor(Math.random() * 1e9), soft: isTouch || o.tc ? 1 : 0 };
      c.el = MpWait(c);
      mp.pending = c;
      mpSend(o.id, { k: 'ask', m: c.id, g: c.game, seed: c.seed, soft: c.soft });
      ui.push(c.el);
    }));
  }
  // Pressing A on another player.
  function mpTalk(o) {
    sfx('select');
    ask(o.n + (o.b ? ' looks busy.' : ' is right here.'), ['SAY SOMETHING', 'CHALLENGE', 'CANCEL'], (i) => {
      if (i === 0) mpSayMenu();
      else if (i === 1) mpChallenge(o);
    });
  }
  function mpWho() {
    const here = mpHere();
    if (!mp.heard) { say('You can\'t reach the other players right now, so it\'s just you for the moment.'); return; }
    say(here.length ? 'Also here: ' + here.map((o) => o.n + ' (' + mpWhere(o) + ')').join(', ') + '.' : 'Nobody else is playing right now.');
  }

  // ---------- player / world ----------
  const S0 = MAPS.start;
  const P = { floor: S0.floor, x: S0.x, y: S0.y, dir: S0.dir, moving: false, prog: 0, mdx: 0, mdy: 0, step: 0, turnWait: 0, walked: false, bump: 0 };
  let mode = 'title', tick = 0, roomName = null, curRoom = null, banner = null;
  let fade = null; // {t, cb, color}

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

  function startFade(cb, color) { fade = { t: 0, cb, color }; }
  function placePlayer(fi, x, y, dir) {
    Object.assign(P, { floor: fi, x, y, dir, moving: false, walked: false, bump: 0 });
    curRoom = roomAt(fi, x, y);
    roomName = curRoom ? curRoom.name : null;
  }
  function warpTo(end) {
    startFade(() => {
      placePlayer(end.floor, ...end.arrive);
      showBanner(MAPS.floors[P.floor].name);
    });
  }

  function onArrive() {
    // into Cody's cubicle and it opens out into the casino; out of the casino's doorway
    // and you're back in the office
    if (CASINO_AT) {
      const r = roomAt(P.floor, P.x, P.y);
      if (P.floor === CASINO_AT.floor && r && r.name === CASINO_AT.room) { P.floor = CASINO; sfx('ding'); }
      else if (P.floor === CASINO && !r) P.floor = CASINO_AT.floor;
    }
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
    if (doorShut(fi, x, y) || propAt(fi, x, y)) return false;
    return WALKABLE.includes(t) || (t === 'C' && curtainOpen === fi) || (t === '$' && !eotm);
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
    const other = mpAt(P.floor, tx, ty);
    if (other) { mpTalk(other); return; }
    let npc = npcAt(P.floor, tx, ty);
    if (npc && visit && npc === visit.npc && visit.a < 1) npc = null; // halfway through the portal
    if (npc) {
      if (!npc.moving && !(visit && npc === visit.npc && visit.phase !== 'stay')) npc.dir = OPPOSITE[P.dir];
      sfx('select');
      // Everyone speaks as "Name: ...", including the offers below and whatever
      // they say when you turn them down, so you always know who is talking.
      const says = (line) => npc.name + ': ' + line;
      if (npc.dog) { dogTalk(npc); return; }
      if (npc.guest) { guestTalk(npc, says); return; }
      if (npc.name === 'Damir') {
        say(says('Do you feel safe in the dark?'), () => ui.push(DarkGame()));
        return;
      }
      if (npc.name === 'Kiki' && !eotm && helped.size === COWORKERS.length) {
        sfx('ding');
        say(says('Everyone has been talking about you. You helped every single person in this office!'), () =>
          say(says('So this month\'s Employee of the Month is... YOU! I\'ll put your picture up by the entrance.'), () => {
            eotm = true; sfx('cup'); ui.push(EmployeeOfMonth()); questBoard('eotm');
          }));
        return;
      }
      if (npc.name === 'Kiki' && !kikiList && !eotm) {
        sfx('select');
        say(says('Want to be Employee of the Month? Help out everyone on this list and it\'s yours!'), () => {
          kikiList = true; sfx('menu'); ui.push(KikiList(true));
        });
        return;
      }
      // name: [what they offer (or a list of lines, the last one asked), yes label, the game,
      //        what they say if you decline, no label]
      const OFFERS = {
        Nathan: ['Have you seen all of my trophies? Go on, grab one.', 'GRAB ONE', NathanGame, 'Your loss. They are lovely.'],
        Wade: ['Fancy a quick three holes?', 'YOU ARE ON', WadeGolfGame, 'Another time, then.'],
        Kiki: ['Bet you cannot guess how many sweets are in that jar.', 'TAKE THE BET', CandyJarGame, 'Offer stands all week!'],
        Jhonna: ['Have you done your Manulife dependant forms?', 'DO THEM NOW', FormsGame, 'They are not going to fill themselves in.', 'NOT YET'],
        Richard: ['Do you want to test your air handling knowledge?', 'YES', BattleGame, 'Come back when you are ready.', 'NO'],
        Patrick: ['Dance-off! Think you can keep up with me?', 'BRING IT', DanceGame, 'Suit yourself. More floor for me.'],
        Nik: [['Dmitriy\'s my younger brother. I taught him all he knows about being a chef.', 'Here, I\'ll show you.'], 'HAND ME THE WOK', WokGame, 'Your loss. My fried rice is legendary.', 'NOT NOW'],
        Dmitriy: ['Nik says he taught me to cook? I ran the line, not him. Let\'s see your knife skills.', 'PICK UP THE KNIFE', CarrotGame, 'Keep your fingers, then.', 'NOT NOW'],
        Joe: ['Lego brick battle! Winner is the office master builder. You in?', 'CHALLENGE ACCEPTED', LegoGame, 'Scared of a few bricks? My baseplate is always open.', 'NOT TODAY'],
      };
      if (OFFERS[npc.name]) {
        const [msg, yes, Game, no, noLabel] = OFFERS[npc.name];
        const lines = [].concat(msg);
        const offer = (k) => {
          if (k < lines.length - 1) { say(says(lines[k]), () => offer(k + 1)); return; }
          ask(says(lines[k]), [yes, noLabel || 'NO THANKS'], (i) => {
            if (i === 0) { sfx('menu'); ui.push(Game()); } else say(says(no));
          });
        };
        offer(0);
        return;
      }
      if (npc.ghost) { lindaTalk(npc, says); return; } // Linda, her list and her stapler
      say(says(npc.lines[Math.floor(Math.random() * npc.lines.length)]));
      return;
    }
    if (P.floor === cookies.floor && tx === cookies.x && ty === cookies.y) {
      sfx('select');
      say('There is a plate of cookies with a note: "Made with love by Jenn." You take one.\nAs you eat it, you think to yourself: Nik and Dmitriy could never make anything this good.');
      return;
    }
    if (!stapler.found && P.floor === stapler.floor && tx === stapler.x && ty === stapler.y) {
      sfx('cup');
      stapler.found = true;
      say('A red stapler! It\'s ice cold. This must be Linda\'s.');
      questQueue.push('A chilly breeze whisks it out of your hands, off towards the Haunted Office.');
      lindaLighter();
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
    const partyGame = partyGameAt(tx, ty, t);
    if (partyGame) {
      const [msg, opt, Game] = partyGame;
      sfx('select');
      ask(msg, [opt, 'CANCEL'], (i) => { if (i === 0) { sfx('menu'); ui.push(Game()); } });
      return;
    }
    if (doorShut(P.floor, tx, ty)) { sfx('bump'); say('The doors are shut until the party\'s over.'); return; }
    if (HALLOWEEN && t === 'c' && hw.state !== 'party' && P.floor === hw.floor && roomAt(P.floor, tx, ty) === hw.room) {
      sfx('select');
      ask(hw.state === 'done' ? 'Take a seat and start the Halloween celebration all over again?' : 'Take a seat and start the Halloween celebration?',
        ['START THE PARTY', 'NOT YET'], (i) => { if (i === 0) { sfx('ding'); startFade(startParty, '#000000'); } });
      return;
    }
    if (t === '@') { sfx('select'); say('A shimmering portal. It hums with out-of-town energy.'); return; }
    if (t === '!' && P.floor === PLANT && plantPhone) { answerPlantPhone(); return; }
    if (t === '!' && phone) { answerPhone(); return; }
    if (t === '&') {
      sfx('select');
      ask('Joe\'s Lego shelf: a red house, a spaceship and a tub of loose bricks.', ['BUILD SOMETHING', 'LEAVE IT'], (i) => {
        if (i === 0) { sfx('menu'); ui.push(LegoGame(true)); }
      });
      return;
    }
    if (t === '%') { sfx('select'); say('One of Joe\'s Lego builds. A sticky note on it says DO NOT TOUCH.'); return; }
    if (t === '$' && eotm) { sfx('menu'); ui.push(EmployeeOfMonth()); return; }
    if (t === '*') { sfx('menu'); ui.push(HallOfFame()); return; }
    if (t === 'E') {
      const ends = findLink(P.floor, tx, ty);
      const names = MAPS.floors.filter((f) => !f.plant && !f.casino).map((f, i) => (i === 0 ? 'GROUND' : i + 1 + 'F'));
      sfx('select');
      ask('The elevator. Which floor?', names.concat(['CANCEL']), (i) => {
        if (i < 0 || i >= names.length) return;
        if (i === P.floor) { say('You\'re already on this floor.'); return; }
        sfx('ding');
        const from = P.floor, go = () => warpTo(ends.find((e) => e.floor === i));
        // every ride, somebody gets in with you
        const pool = npcs.filter((n) => !n.ghost && !n.extra);
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
      '[': ['Cody\'s blackjack table. Blackjack pays 3 to 2.', 'DEAL ME IN', () => BlackjackApp(null, true)],
      ']': ['The poker table. Zin is dealing Texas Hold\'em, and Cody and Dmitriy are already in.', 'TAKE A SEAT', () => PokerApp(null, true)],
      7: ['A slot machine, all lit up. It plays for spring rolls.', 'PULL THE LEVER', SlotsGame],
    };
    // the boardroom's everyday games are off while the Halloween party is on
    if (GAMES[t] && hw.state === 'party' && P.floor === hw.floor && roomAt(P.floor, tx, ty) === hw.room) {
      sfx('select');
      say('Someone has hung a sign on it: "NOT TONIGHT. IT\'S A PARTY!"');
      return;
    }
    const game = (P.floor === PLANT && PLANT_GAMES[t]) || GAMES[t];
    if (game) {
      const [msg, opt, Game] = game;
      sfx('select');
      ask(typeof msg === 'function' ? msg() : msg, [opt, 'CANCEL'], (i) => {
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
    const here = P.floor === PLANT && roomAt(P.floor, tx, ty);
    const msgs = (here && (PLANT_ROOM_INFO[here.name] || {})[t]) || (P.floor === PLANT && PLANT_INFO[t]) || INFO[t];
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
    } else if (mode === 'costume') {
      updateCostume();
    } else if (ui.length) {
      top().update();
    } else if (questQueue.length) {
      say(questQueue.shift());
    } else {
      updatePlayer();
      updateNpcs();
    }
    if (mode === 'play' && !fade) ringPhone();
    mpUpdate();
    // a finished game's leaderboard goes up as soon as the game has closed, ahead of its parting line
    // (a quest's board waits until you're back walking around)
    if (pendingBoard && !ui.includes(pendingBoard.owner) && !(pendingBoard.quiet && (ui.length || questQueue.length || mode !== 'play'))) {
      ui.push(Leaderboard(pendingBoard)); pendingBoard = null;
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

  // ---------- Halloween costume select ----------
  let costumeCur = 0, costumeSheets = [];
  function openCostumes() {
    const look = Art.LOOKS[pick.gender][pick.index];
    costumeSheets = COSTUME_KEYS.map((k) => Art.renderCostume(pick.gender, look, k, sdgIcon));
    costumeCur = Math.max(0, COSTUME_KEYS.indexOf(hw.costume));
    mode = 'costume';
  }
  function updateCostume() {
    const n = COSTUME_KEYS.length, row = costumeCur - (costumeCur % 4);
    if (pressed.has('left')) { costumeCur = row + ((costumeCur + 3) % 4); sfx('select'); }
    if (pressed.has('right')) { costumeCur = row + ((costumeCur + 1) % 4); sfx('select'); }
    if (pressed.has('up') || pressed.has('down')) { costumeCur = (costumeCur + 4) % n; sfx('select'); }
    if (pressed.has('a') || pressed.has('start')) {
      sfx('menu');
      wearCostume(COSTUME_KEYS[costumeCur]);
      store.set('costume', hw.costume);
      startFade(enterOffice);
    } else if (pressed.has('b')) { sfx('select'); startFade(() => { mode = 'name'; }); }
  }
  function drawCostume() {
    ctx.fillStyle = col.light; ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = col.dark; ring(4, 4, SW - 8, SH - 8); ring(6, 6, SW - 12, SH - 12);
    const title = 'Choose your costume';
    text(title, (SW - title.length * 12) >> 1, 18, 2, '#c05810');
    COSTUME_KEYS.forEach((k, i) => {
      const x = 32 + (i % 4) * 70, y = 50 + (i >> 2) * 78, sel = i === costumeCur, name = Art.COSTUMES[k].name;
      ctx.drawImage(costumeSheets[i].down[sel ? [1, 0, 2, 0][(tick >> 3) & 3] : 0], x, y, 48, 48);
      text(name, x + 24 - name.length * 3, y + 54);
      if (sel) { ctx.fillStyle = col.dark; ring(x - 8, y - 6, 64, 72); ring(x - 7, y - 5, 62, 70); }
    });
    ctext('Arrows: choose   Space: wear it', SH - 24);
  }

  // ---------- render ----------
  function frameIndex() {
    const walkFrame = P.step ? 1 : 2;
    if (P.moving) return P.prog < 8 ? walkFrame : 0;
    if (P.bump) return (P.bump >> 3) & 1 ? walkFrame : 0;
    return 0;
  }

  // The visitor office portal: a disc of light on the floor, two arms spiralling
  // round it. It spins faster and glows brighter while someone is coming or going.
  const PORTAL_COLS = ['#281850', '#7b2ff7', '#05d9e8', '#7b2ff7'];
  const PORTAL_PIX = [];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
      if (r < 7.6) PORTAL_PIX.push({ x, y, r, a: Math.atan2(dy, dx) / (Math.PI * 2) });
    }
  function drawPortalAt(x, y, busy) {
    const spin = tick / (busy ? 12 : 40);
    for (const p of PORTAL_PIX) {
      if (p.r > 6.6) ctx.fillStyle = '#181030';
      else if (p.r < (busy ? 2.6 : 1.2)) ctx.fillStyle = '#f8f8f8';
      else ctx.fillStyle = PORTAL_COLS[((Math.floor((p.a * 2 + p.r * 0.22 - spin) * 4) % 4) + 4) % 4];
      ctx.fillRect(x + p.x, y + p.y, 1, 1);
    }
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
    if (boothCoat && P.floor === PLANT)
      for (const c of boothCoat) ctx.drawImage(c.img, c.x * 16 - cx, c.y * 16 - cy);
    if (eotm)
      for (const e of easels[P.floor]) drawEaselAt(e.x * 16 - cx, e.y * 16 - cy);
    if (cookies.floor === P.floor) drawCookiesAt(cookies.x * 16 - cx, cookies.y * 16 - cy);
    if (!stapler.found && stapler.floor === P.floor) drawStaplerAt(stapler.x * 16 - cx, stapler.y * 16 - cy);
    for (const k of portals[P.floor]) {
      const x = k.x * 16 - cx, y = k.y * 16 - cy;
      if (x < -16 || x > SW || y < -16 || y > SH) continue;
      drawPortalAt(x, y, !!visit && visit.gate === k && visit.phase !== 'stay');
    }
    const ph = phoneHere();
    if (ph) drawPhoneAt(ph, ph.x * 16 - cx, ph.y * 16 - cy);
    for (const k of panels[P.floor]) {
      const x = k.x * 16 - cx, y = k.y * 16 - cy;
      if (x < -16 || x > SW || y < -16 || y > SH) continue;
      PANEL_LIGHTS.forEach((c, i) => {
        // each light blinks at its own pace, offset per panel so they don't sync up
        if (((tick >> 4) * (i + 1) + k.x * 7 + k.y * 13 + i * 5) % 3 === 0) return;
        ctx.fillStyle = c; ctx.fillRect(x + 4 + i * 3, y + 3, 2, 2);
      });
    }
    for (const k of fameCrowns[P.floor]) {
      const g = (tick >> 2) % 40;
      if (g > 3) continue;
      const x = k.x * 16 - cx + 6, y = k.y * 16 - cy + 3, r = g < 2 ? g + 1 : 4 - g;
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1);
    }
    const spooky = HALLOWEEN && P.floor === hw.floor;
    if (spooky) drawHalloween(cx, cy, 0);
    // people, drawn back to front so nearer ones overlap farther ones
    const actors = [{ x: px, y: py, img: sprites[P.dir][frameIndex()] }];
    if (party) {
      // everyone takes turns facing a new way and bouncing, on the beat of the rave song
      const rp = musicPos('rave'), beat = Math.floor(rp === null ? tick / 25.7 : rp / 2);
      const DANCE = ['down', 'left', 'down', 'right', 'up', 'right', 'down', 'left'];
      const hop = (b) => (b & 1 ? 0 : 3);
      actors[0] = { x: px, y: py - hop(beat), img: sprites[DANCE[beat & 7]][1 + (beat & 1)] };
      for (const d of party.dancers) {
        const b = beat + d.phase;
        actors.push({ x: d.x * 16, y: d.y * 16 - hop(b), img: d.sprites[DANCE[b & 7]][1 + (b & 1)] });
      }
    }
    for (const n of npcs.concat(dogs)) {
      if (n.floor !== P.floor || (party && party.names.has(n.name))) continue;
      const frame = n.moving && n.prog < 8 ? (n.step ? 1 : 2) : 0;
      actors.push({ x: n.x * 16 + (n.moving ? n.mdx * n.prog : 0), y: n.y * 16 + (n.moving ? n.mdy * n.prog : 0),
        img: n.sprites[n.dir][frame], ghost: n.ghost, freeing: freeing && freeing.npc === n,
        alpha: visit && visit.npc === n ? visit.a : 1 });
    }
    for (const o of mpHere()) if (o.f === P.floor) actors.push({ x: o.px, y: o.py, img: mpSprites(o)[o.dir][mpFrame(o)] });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      const sx = a.x - cx, sy = a.y - cy - 4;
      if (!(sx > -16 && sx < SW && sy > -20 && sy < SH)) continue;
      if (a.freeing) drawFreeing(sx, sy, a.img);
      else if (a.ghost) {
        // ghosts are see-through and bob up and down
        ctx.globalAlpha = 0.75;
        ctx.drawImage(a.img, sx, sy - 2 + Math.round(Math.sin(tick / 12 + a.x) * 2));
        ctx.globalAlpha = 1;
      } else {
        // a visitor fades in and out as they go through the portal
        if (a.alpha < 1) ctx.globalAlpha = a.alpha;
        ctx.drawImage(a.img, sx, sy);
        ctx.globalAlpha = 1;
      }
    }
    for (const n of dogs) if (n.dog.cat && n.floor === P.floor) drawZzz(n.x * 16 - cx + 10, n.y * 16 - cy - 2, 1);
    // rooms with the lights off (drawn over the player too)
    ctx.fillStyle = 'rgba(8, 8, 28, 0.78)';
    for (const r of MAPS.floors[P.floor].rooms)
      if (r.dark) ctx.fillRect(r.x1 * 16 - cx, r.y1 * 16 - cy - 4, (r.x2 - r.x1 + 1) * 16, (r.y2 - r.y1 + 1) * 16 + 4);
    for (const r of MAPS.floors[P.floor].rooms) if (r.rave) drawRave(r, cx, cy);
    if (spooky) drawHalloween(cx, cy, 1);
    mpDrawTags(cx, cy, px, py);
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
    else if (mode === 'costume') drawCostume();
    else {
      // the room shakes while the plant is yelling at you
      const shake = ui.reduce((m, el) => Math.max(m, el.shake || 0), 0);
      ctx.save();
      if (shake) ctx.translate(Math.round((Math.random() - 0.5) * 2 * shake), Math.round((Math.random() - 0.5) * 2 * shake));
      drawWorld();
      ctx.restore();
      drawBanner();
      ui.forEach((el) => el.draw());
    }
    if (fade) {
      const lvl = fade.t < 16 ? fade.t / 16 : (32 - fade.t) / 16;
      ctx.globalAlpha = Math.min(1, Math.ceil(lvl * 4) / 4);
      ctx.fillStyle = fade.color || col.light;
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

  // Testing shortcut: index.html#play&f=1&x=40&y=20&char=female:2 (add &game=punch|run|pong|toss|stack|simon|lunch|candy|squat|golf|dark|coffee|battle|fan|coil|damper|filter|snake|parts|cable|cpr|engrave|pulldown|ball|desk|jam|laundry|forms|nathan|wade|lego|wok|carrot|jar|poker|blackjack|slots|pokertable|bjtable, or locker|list|eotm with &quest=)
  if (location.hash.startsWith('#play')) {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.has('f')) P.floor = +q.get('f');
    if (q.has('x')) { P.x = +q.get('x'); P.y = +q.get('y'); }
    if (q.has('char')) { const [g, i] = q.get('char').split(':'); pick.gender = g; pick.index = +i || 0; sprites = charSprites[g][pick.index]; }
    if (q.has('dir')) P.dir = q.get('dir');
    // &costume=vampire wears that costume (in October you wear your last one anyway);
    // &party=1 starts the boardroom party with you standing by a chair (or at &x=&y=)
    if (q.has('name')) playerName = q.get('name');
    if (HALLOWEEN || q.has('costume')) wearCostume(q.get('costume'));
    if (q.has('party')) {
      if (!q.has('x')) Object.assign(P, { floor: hw.floor, x: hw.room.x2 - 2, y: hw.room.y1 + 6, dir: 'up' });
      startParty();
    }
    // &plant=1 wakes you up in the Kingston plant; &phone=1 stands you at Eugene's phone,
    // and &call=1 answers it
    if (q.has('plant')) placePlayer(MAPS.plant.floor, MAPS.plant.x, MAPS.plant.y, MAPS.plant.dir);
    if ((q.has('phone') || q.has('call')) && phone) placePlayer(phone.floor, ...phoneSpot());
    mode = q.has('title') ? 'title' : q.has('select') ? 'select' : q.has('naming') ? 'name' : 'play';
    if (q.has('costumes')) openCostumes();
    updateRoom();
    if (q.has('say')) ask('The elevator. Which floor?', ['GROUND', '2F', 'CANCEL'], () => {});
    if (q.has('menu')) openStartMenu();
    if (q.has('map')) ui.push(MapView());
    if (q.has('call') && phone) answerPhone();
    // &name=Sam sets your name; &quest=1 hands you Linda's list, &quest=done finishes it
    if (q.has('name')) playerName = q.get('name');
    if (q.has('quest')) {
      startQuest();
      if (q.get('quest') === 'done') { quest.tasks.forEach((x) => { x.done = true; }); quest.complete = true; }
      else quest.tasks.slice(0, +q.get('quest') - 1).forEach((x) => { x.done = true; });
    }
    // &helped=6 has you help the first N coworkers; &eotm=1 gives you the award
    if (q.has('helped')) COWORKERS.slice(0, +q.get('helped')).forEach((c) => helped.add(c.name));
    if (q.has('eotm')) eotm = true;
    if (q.has('kikilist')) kikiList = true;
    // &stapler=found hands Linda her stapler back; &stapler=near puts it on the desk in front of you
    if (q.get('stapler') === 'found') stapler.found = true;
    if (q.get('stapler') === 'near') {
      const [dx, dy] = DIRS[P.dir];
      Object.assign(stapler, { floor: P.floor, x: P.x + dx, y: P.y + dy, room: roomAt(P.floor, P.x, P.y) || stapler.room });
    }
    // &visitor=Alex puts that visitor in the visitor office; &visit=120 has them leave
    // through the portal in 120 ticks
    if (visit) {
      const vi = visit.list.findIndex((v) => v.name === q.get('visitor'));
      if (vi >= 0) setVisitor(vi);
      if (q.has('visit')) visit.t = +q.get('visit');
    }
    // &dog=Bella puts that dog right in front of you (and keeps it still); game=catch plays
    // catch with it and game=dogs shows the frisbee leaderboard
    const testDog = dogs.find((x) => x.name === q.get('dog')) || dogs[0];
    if (q.has('dog') && testDog) {
      const [dx, dy] = DIRS[P.dir];
      Object.assign(testDog, { floor: P.floor, x: P.x + dx, y: P.y + dy, wait: 1e9 });
    }
    const GAME = { coffee: CoffeeGame, punch: PunchGame, run: RunGame, pong: PongGame, toss: TossGame, stack: StackGame, simon: SimonGame, lunch: LunchGame, candy: CandyGame, squat: SquatGame, golf: GolfGame, dark: DarkGame, battle: BattleGame,
      fan: FanGame, coil: CoilGame, damper: DamperGame, filter: FilterGame,
      snake: SnakeGame, parts: PartsGame, cable: CableGame, cpr: CprGame,
      engrave: EngraveGame, pulldown: PulldownGame, ball: BallGame,
      desk: FrontDeskGame, jam: JamGame, laundry: LaundryGame, forms: FormsGame,
      dance: DanceGame, party: PartyTime, nathan: NathanGame, wade: WadeGolfGame, lego: LegoGame, build: () => LegoGame(true), wok: WokGame, carrot: CarrotGame, jar: CandyJarGame, poker: PokerApp, blackjack: BlackjackApp, slots: SlotsGame,
      pokertable: () => PokerApp(null, true), bjtable: () => BlackjackApp(null, true),
      forklift: ForkliftGame, paint: PaintGame, contest: CostumeContest, hsplash: HalloweenSplash, bob: BobGame, mummy: MummyGame, carve: CarveGame, treat: TreatGame, ghosts: GhostGame, locker: LockerScreen, list: LindaList, kiki: KikiList, eotm: EmployeeOfMonth,
      catch: () => CatchGame(testDog), dogs: () => DogBoard(testDog),
      fame: HallOfFame, board: () => Leaderboard({ key: BOARDS[q.get('key')] ? q.get('key') : 'snake', score: boardDemo ? +q.get('score') || 0 : 0 }) }[q.get('game')];
    // &vs=1 plays a head-to-head game (a VERSUS key: duel, jar, lego, dance, coffee, run,
    // snake, simon) against "Echo", a stand-in who sends you back everything you send, a
    // second later
    const versus = q.has('vs') && VERSUS[q.get('game')] && !VERSUS[q.get('game')].server && VERSUS[q.get('game')];
    if (versus) {
      const later = [];
      const echo = {
        id: 'echo', name: 'Echo', gone: false, rng: seeded(+q.get('seed') || 1), soft: isTouch, sprites: charSprites.male[1],
        send(data) { later.push({ at: tick + 60, data: JSON.parse(JSON.stringify(data)) }); },
        take() { return later.length && later[0].at <= tick ? later.shift().data : undefined; },
        end() { echo.gone = true; },
      };
      ui.push(versus.Game(echo));
    } else if (GAME) ui.push(GAME());
  }

  // The shortcuts above are only read when the page loads, and a browser doesn't reload
  // a page whose address changed only after the #. So reload when that happens: then
  // pasting a shortcut into a tab that already has the game open works.
  addEventListener('hashchange', () => location.reload());

  // ---------- main loop ----------
  layout();
  if (location.hash.startsWith('#play')) {
    const q = new URLSearchParams(location.hash.slice(1));
    // keys=left:40,a:1  -> hold each key for N ticks, in order (up+left:20 holds both)
    for (const part of (q.get('keys') || '').split(',').filter(Boolean)) {
      const [k, n] = part.split(':'), ks = k.split(/[+ ]/); // a + in the address reads as a space
      ks.forEach(press);
      for (let i = 0; i < +n; i++) update();
      ks.forEach(release);
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
  window.GAME = { P, MAPS, warpTo, npcs, questNote, stapler, mp, press, release, get quest() { return quest; } };
})();
