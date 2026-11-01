// The parking lot at 32 x 32, in the same pixels as the office: a 2-pixel outline round
// everything, the light from the top left, and flat colours with a shade and a highlight,
// a tile at a time from the Parking Lot's rows in js/maps.js. It's all painted once, the
// first time you go out there, and only painted: where everyone is and what they're doing
// is js/game.js's (see drawYard).
//
//   const lot = LotArt.paint(floor)
//   lot.w, lot.h        // how big it is, in the game's pixels (16 to a tile)
//   lot.ground          // everything lying flat or no taller than its own tiles: the snow, the
//                       // asphalt, the office, the rink, its boards and markings, the cars...
//   lot.props           // what you can walk behind, each { x, y, z, img } (or { frames, every }
//                       // to go through them, every that many ticks). z sorts it in with people,
//                       // as their y would.
//   lot.bulbs, lot.wires // the strings of lights, [x, y, colour number] and [x, y]
//   lot.gate            // { x, y, img }: the rink's gate, shut, for a hockey game
//   lot.roof            // how far down the map the lights along the roof run
//
// Places in here are in real pixels, 32 to a tile, and each canvas is marked hi: 2, so it's
// drawn at half that (see js/game.js).
window.LotArt = (function () {
  const K = '#181820';
  const CARS = ['#c8352f', '#2f6fc0', '#d4d8e0', '#2e7a52', '#f2f2f4', '#e0a030', '#6a4aa8', '#3a3f4a', '#2a9ab0'];

  const hexInt = (hex) => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }
  // a number from 0 to 1 for each pixel, always the same...
  function noise(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // ...and one that wanders smoothly from place to place
  function smooth(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (noise(x0, y0) * (1 - u) + noise(x0 + 1, y0) * u) * (1 - v) + (noise(x0, y0 + 1) * (1 - u) + noise(x0 + 1, y0 + 1) * u) * v;
  }
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.hi = 2;
    return cv;
  }
  // what everything's painted with: crisp rectangles and the shapes made of them
  function pen(c) {
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const oval = (cx, cy, rx, ry, col) => {
      c.fillStyle = col;
      for (let y = -Math.ceil(ry); y < ry; y++) {
        const k = 1 - ((y + 0.5) * (y + 0.5)) / (ry * ry);
        if (k <= 0) continue;
        const w = Math.round(rx * Math.sqrt(k));
        if (w) c.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2, 1);
      }
    };
    const round = (x, y, w, h, r, col) => {
      c.fillStyle = col;
      for (let j = 0; j < h; j++) {
        const d = Math.min(j + 0.5, h - j - 0.5), k = d < r ? Math.round(r - Math.sqrt(r * r - (r - d) * (r - d))) : 0;
        c.fillRect(x + k, y + j, w - k * 2, 1);
      }
    };
    // a ring: rows of the disc that aren't in the hole
    const ring = (cx, cy, r, w, col) => {
      c.fillStyle = col;
      for (let y = -r; y < r; y++)
        for (let x = -r; x < r; x++) {
          const d = Math.hypot(x + 0.5, y + 0.5);
          if (d < r && d >= r - w) c.fillRect(cx + x, cy + y, 1, 1);
        }
    };
    // words in the game's own letters, n real pixels to each of theirs
    const word = (str, x, y, col, n) => {
      n = n || 1;
      c.fillStyle = col;
      for (const ch of str) {
        const g = FONT.glyphs[ch] || FONT.glyphs['?'];
        g.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') c.fillRect(x + i * n, y + j * n, n, n); }));
        x += 6 * n;
      }
    };
    return { c, rect, oval, round, ring, word };
  }
  // the outline: anything see-through within 2 pixels of what's been painted goes dark
  const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function outline(cv) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, img = c.getImageData(0, 0, w, h), d = img.data, ink = hexInt(K);
    const px = new Uint32Array(d.buffer), solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (solid[y * w + x]) continue;
        for (const [dx, dy] of AROUND) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < w && Y < h && solid[Y * w + X]) { px[y * w + x] = ink; break; }
        }
      }
    c.putImageData(img, 0, 0);
  }
  // a picture w x h: painted, then outlined (unless plain), then anything see-through goes on (over)
  function pic(w, h, paint, o) {
    o = o || {};
    const cv = canvas(w, h), p = pen(cv.getContext('2d'));
    paint(p);
    if (!o.plain) outline(cv);
    if (o.over) o.over(p);
    return cv;
  }

  // ---------- what the ground's made of ----------
  const SNOW = hexInt('#e6edf7'), SNOW_HI = hexInt('#f2f6fc'), SNOW_LO = hexInt('#d8e2f0'), SNOW_DOT = hexInt('#c4d2e6'), SNOW_GLINT = hexInt('#ffffff');
  const ASPH = hexInt('#5a5e70'), ASPH_HI = hexInt('#5e6275'), ASPH_LO = hexInt('#565a6c'), ASPH_DOT = hexInt('#484c5c'), ASPH_FLECK = hexInt('#70748a');
  const SLAB = hexInt('#a8aebd'), SLAB_HI = hexInt('#c0c5d2'), SLAB_LO = hexInt('#7c8294'), SALT = hexInt('#e8ecf4');
  const ICE = hexInt('#d4e9f6'), ICE_HI = hexInt('#e2f1fa'), ICE_EDGE = hexInt('#eef7fc');
  const INK = hexInt(K), CAP = hexInt('#2f5cc0'), CAP_HI = hexInt('#6a90e8'), CAP_LO = hexInt('#21449a');
  const FACE = hexInt('#f4f6fa'), FACE_LO = hexInt('#bcc8da'), KICK = hexInt('#e8b830');
  function snowAt(x, y) {
    const n = noise(x, y);
    if (n < 0.004) return SNOW_GLINT;
    if (n < 0.012) return SNOW_DOT;
    const v = smooth(x / 62, y / 16);
    return v > 0.66 ? SNOW_HI : v < 0.36 ? SNOW_LO : SNOW;
  }
  function asphaltAt(x, y) {
    const n = noise(x, y);
    if (n < 0.05) return ASPH_DOT;
    if (n < 0.085) return ASPH_FLECK;
    const v = smooth(x / 44, y / 26);
    return v > 0.68 ? ASPH_HI : v < 0.34 ? ASPH_LO : ASPH;
  }
  // the sidewalk along the office: slabs two tiles long, salted
  function slabAt(x, y) {
    const lx = x & 63, ly = y & 31;
    if (lx < 2) return SLAB_LO;
    if (ly < 2) return SLAB_HI;
    return noise(x, y) < 0.02 ? SALT : noise(x + 1, y + 7) < 0.03 ? SLAB_LO : SLAB;
  }

  // a heap of snow, for lying on anything
  function heap(p, x, y, w, h) {
    p.oval(x, y + h * 0.4, w / 2, h * 0.6, '#b4c2d8');
    p.oval(x, y, w / 2, h * 0.6, '#f4f7fc');
    p.oval(x - w * 0.14, y - h * 0.16, w * 0.24, h * 0.22, '#ffffff');
  }
  // a lump of snow: one picture, stamped wherever
  const lump = (seed) => {
    const r = rng(seed), w = 12 + Math.floor(r() * 10), h = 8 + Math.floor(r() * 5);
    return pic(w + 8, h + 8, (p) => heap(p, (w + 8) >> 1, (h + 8) >> 1, w, h));
  };

  // ---------- things to stand on the lot ----------
  // A parked car from above, 2 tiles by 3: nose to the top of the map with its tail lights
  // showing (rear), or nose to the bottom with its headlights showing. Snow on the roof.
  function car(col, rear, r) {
    const dark = mix(col, '#101428', 0.34), lite = mix(col, '#ffffff', 0.34), glass = '#2a3450', shine = '#5a6a90';
    return pic(64, 96, (p) => {
      for (const y of [14, 64]) for (const x of [5, 55]) p.rect(x, y, 4, 16, '#24242c');
      p.rect(4, rear ? 34 : 56, 6, 4, dark); p.rect(54, rear ? 34 : 56, 6, 4, dark); // (the mirrors)
      p.round(8, 3, 48, 90, 10, col);
      p.rect(50, 12, 6, 72, dark);
      p.rect(10, 13, 2, 70, lite);
      p.round(8, 82, 48, 11, 5, dark);
      p.rect(12, 83, 40, 1, K);
      // (the windscreen and back window, wider at the windscreen, and the side windows along the roof)
      const [wy, by] = rear ? [28, 66] : [58, 26];
      p.round(14, wy, 36, 10, 2, glass); p.rect(16, wy + 1, 8, 2, shine);
      p.round(16, by, 32, 8, 2, glass); p.rect(18, by + 1, 6, 1, shine);
      const y0 = rear ? 38 : 34, y1 = rear ? 66 : 58;
      p.rect(12, y0, 2, y1 - y0, glass); p.rect(50, y0, 2, y1 - y0, glass);
      p.rect(14, y0, 36, y1 - y0, lite); p.rect(16, y0 + 2, 32, y1 - y0 - 4, col);
      // (lights on the end you can see)
      if (rear) { p.rect(12, 85, 9, 4, '#d83030'); p.rect(43, 85, 9, 4, '#d83030'); p.rect(13, 85, 3, 1, '#ff9090'); p.rect(44, 85, 3, 1, '#ff9090'); }
      else { p.rect(12, 85, 9, 4, '#fff2c0'); p.rect(43, 85, 9, 4, '#fff2c0'); p.rect(26, 86, 12, 3, K); }
      // a foot of snow on the roof, and a bit more on the hood and the trunk
      heap(p, 32, (y0 + y1) >> 1, 38 + r() * 3, 22 + r() * 4);
      heap(p, 24 + r() * 16, rear ? 14 : 72, 22 + r() * 8, 8 + r() * 3);
      if (r() < 0.6) heap(p, 22 + r() * 18, rear ? 76 : 14, 16 + r() * 8, 6 + r() * 2);
    });
  }
  // A lamp post with a wreath on it: its foot's at the bottom of the picture
  function lampPost() {
    return pic(56, 122, (p) => {
      p.rect(23, 110, 10, 10, '#2c3644'); p.rect(24, 110, 2, 10, '#4a5668');
      p.rect(25, 30, 6, 80, '#2c3644'); p.rect(26, 30, 2, 80, '#556276');
      p.rect(21, 12, 14, 20, '#fff0b0'); p.rect(21, 26, 14, 6, '#ffd070'); p.rect(23, 14, 3, 8, '#ffffff');
      p.rect(19, 30, 18, 3, '#2c3644'); p.rect(19, 9, 18, 3, '#2c3644'); p.rect(27, 12, 2, 18, '#2c3644');
      p.oval(28, 8, 10, 4, '#f4f7fc');
      p.ring(28, 62, 9, 5, '#2c6a34');
      for (const [x, y] of [[21, 58], [34, 57], [28, 54]]) p.rect(x, y, 2, 2, '#f05050');
      p.rect(24, 69, 8, 4, '#d83030');
    }, { over: (p) => {
      p.oval(28, 22, 26, 22, 'rgba(255, 216, 140, 0.13)');
      p.oval(28, 22, 16, 14, 'rgba(255, 226, 160, 0.2)');
    } });
  }
  // A spruce: tiers narrow at the top and wide at the bottom, the light on the left, snow on
  // each one. tiers: [top, bottom, half-width at the top, at the bottom].
  // (rag: how far its branches stick out and droop, for a big one)
  function tiers(p, mid, list, cols, r, rag) {
    const [dark, midc, light] = cols;
    for (const [top, bot, w0, w1] of list) {
      for (let y = top; y <= bot; y++) {
        const hw = Math.round(w0 + (w1 - w0) * (y - top) / (bot - top)) + (rag ? 0 : y % 6 < 2 ? 1 : 0);
        const saw = (o) => (rag ? Math.round(((y + o) % 12) / 12 * rag - rag * 0.5 + r() * 2) : 0), hl = hw + saw(0), hr = hw + saw(5);
        p.rect(mid - hl, y, hl + hr, 1, midc);
        p.rect(mid - hl, y, Math.max(2, hl >> 1), 1, light);
        p.rect(mid + hr - Math.max(2, hr >> 2), y, Math.max(2, hr >> 2), 1, dark);
        if (y % 6 === 3) p.rect(mid - hl + 3, y, hl + hr - 6, 1, dark);
      }
      // the bottom of the tier in shadow, and snow along its top and on its branches
      p.rect(mid - w1, bot + 1, w1 * 2, 2, dark);
      if (rag) for (let x = mid - w1 + 1; x < mid + w1 - 3; x += 6 + Math.floor(r() * 7)) {
        const len = 4 + Math.floor(r() * rag);
        for (let j = 0; j < len; j++) p.rect(x + (j >> 2), bot + 2 + j, Math.max(1, 5 - (j >> 1)), 1, j < len - 2 ? dark : midc);
      }
      if (!rag || top < 12) p.oval(mid - 1, top + 2, Math.max(2, w0 * 0.9), 3, '#f4f7fc');
      const n = Math.max(2, Math.floor(w1 / 6));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, x = mid - w1 * 0.85 + k * w1 * 1.7, y = bot - 2 - r() * (bot - top) * 0.35;
        p.oval(x, y, 2 + r() * 2, 1.5, '#e8f0fa');
      }
    }
  }
  const PINE_GREEN = ['#16402c', '#22583a', '#2f7048'];
  function pine(seed) {
    const r = rng(seed), top = 10 - Math.floor(r() * 8);
    return pic(40, 68, (p) => {
      p.rect(17, 58, 6, 8, '#4a2c16'); p.rect(18, 58, 2, 8, '#6a4424');
      tiers(p, 20, [[top, top + 22, 2, 9], [top + 14, top + 38, 5, 13], [top + 30, 62, 8, 17]], PINE_GREEN, r);
    });
  }
  // The big spruce, its branches spreading nearly two tiles all round, strung with lights that
  // twinkle (three pictures). The wind's had the star.
  function bigSpruce() {
    const W = 132, H = 216, r0 = rng(77), spots = [];
    for (let i = 0; i < 52; i++) {
      const k = r0(), y = 14 + k * 174, hw = 4 + k * 46;
      spots.push([66 + Math.round((r0() * 2 - 1) * hw * 0.9), Math.round(y)]);
    }
    const base = pic(W, H, (p) => {
      p.rect(58, 192, 16, 22, '#4a2c16'); p.rect(60, 192, 5, 22, '#6a4424'); p.rect(60, 192, 2, 22, '#8a6038');
      tiers(p, 66, [[6, 62, 3, 24], [40, 106, 12, 37], [84, 150, 20, 48], [126, 192, 28, 56]], PINE_GREEN, rng(31), 7);
    });
    return [0, 1, 2].map((k) => {
      const cv = canvas(W, H), p = pen(cv.getContext('2d'));
      cv.getContext('2d').drawImage(base, 0, 0);
      spots.forEach(([x, y], i) => {
        const on = (i + k) % 3, col = ['#f84848', '#f8d040', '#48d860', '#4898f8', '#f070c8'][i % 5];
        p.rect(x - 2, y - 2, 6, 6, K);
        p.rect(x - 1, y - 1, 4, 4, on ? col : '#2a3a30');
        if (on) p.rect(x - 1, y - 1, 2, 2, '#ffffff');
      });
      return cv;
    });
  }
  // A snowman in a top hat and a red scarf, wearing a Haakon lanyard
  function snowman() {
    const ball = (p, x, y, r) => {
      p.oval(x, y, r, r, '#c0cee2'); p.oval(x - 1, y - 1, r - 1, r - 1, '#eef3fa'); p.oval(x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.35, '#ffffff');
    };
    return pic(52, 76, (p) => {
      ball(p, 26, 58, 16);
      p.rect(12, 34, 8, 2, '#5c3c20'); p.rect(6, 31, 7, 2, '#5c3c20'); p.rect(32, 34, 8, 2, '#5c3c20'); p.rect(39, 31, 7, 2, '#5c3c20');
      ball(p, 26, 36, 12);
      ball(p, 26, 18, 9);
      for (const y of [32, 39, 54, 62]) p.rect(25, y, 3, 3, '#282830');
      p.rect(22, 16, 2, 2, '#282830'); p.rect(29, 16, 2, 2, '#282830');
      p.rect(25, 19, 8, 2, '#e8802c'); p.rect(25, 19, 4, 1, '#f8a850');
      for (const x of [22, 24, 27, 29]) p.rect(x, 23, 1, 1, '#282830');
      p.rect(17, 26, 18, 4, '#d83030'); p.rect(17, 26, 18, 1, '#f07070'); p.rect(29, 28, 4, 9, '#b82828');
      p.rect(25, 41, 3, 4, '#3050a8');
      p.rect(17, 9, 18, 2, '#282830'); p.rect(19, 0, 14, 9, '#282830'); p.rect(20, 1, 2, 7, '#484858'); p.rect(19, 6, 14, 2, '#d83030');
    });
  }
  // The hot chocolate stand: a counter with a striped awning over it on two poles, three tiles
  // wide; the urn's on the counter and the mugs lined up beside it
  function cocoaStand() {
    return pic(112, 120, (p) => {
      p.rect(10, 34, 4, 40, '#3a2c20'); p.rect(98, 34, 4, 40, '#3a2c20');
      // behind the counter: the urn and the mugs
      p.round(22, 42, 22, 26, 4, '#c8ccd8'); p.rect(24, 44, 4, 22, '#f0f2f8'); p.rect(38, 44, 4, 22, '#8890a0');
      p.rect(26, 38, 14, 4, '#8890a0'); p.rect(30, 66, 6, 4, '#484858');
      for (const x of [56, 66, 76, 86]) { p.rect(x, 60, 8, 8, '#f4f6fa'); p.rect(x, 60, 8, 2, '#6a3c20'); p.rect(x + 8, 62, 2, 4, '#f4f6fa'); }
      // the counter, in planks, with the sign on it
      p.rect(6, 68, 100, 50, '#9a6434');
      for (let x = 6; x < 106; x += 14) { p.rect(x, 74, 1, 44, '#6a4020'); p.rect(x + 1, 74, 1, 44, '#b47c48'); }
      p.rect(2, 66, 108, 8, '#f0d0a0'); p.rect(2, 72, 108, 2, '#c89058');
      p.rect(6, 112, 100, 6, '#6a4020');
      p.rect(32, 84, 48, 18, K); p.rect(34, 86, 44, 14, '#8a2020'); p.word('COCOA', 41, 89, '#f8e8c0');
      // the awning, red and cream, its edge scalloped; snow along the top
      for (let i = 0; i < 8; i++) {
        const x = i * 14, col = i & 1 ? '#f4e2b8' : '#d83030', lo = i & 1 ? '#c8a878' : '#a82020';
        p.rect(x, 12, 14, 22, col); p.rect(x, 12, 2, 22, mix(col, '#ffffff', 0.25)); p.rect(x + 12, 12, 2, 22, lo);
        p.oval(x + 7, 34, 7, 5, lo); p.oval(x + 7, 33, 7, 5, col);
      }
      p.rect(0, 30, 112, 1, 'rgba(24, 24, 32, 0.25)');
      for (let x = 4; x < 110; x += 14) p.oval(x + (x * 7) % 5, 12, 9 + (x % 3), 5, '#f4f7fc');
    });
  }
  // the steam off the urn, going up in turn
  function steam() {
    return [0, 1, 2].map((k) => pic(24, 30, (p) => {
      for (let i = 0; i < 3; i++) {
        const y = 26 - ((i * 9 + k * 3) % 26), s = y < 10 ? 1 : 2;
        p.rect(10 + Math.round(Math.sin(y / 4 + i) * 3), y, s + 1, s, 'rgba(255, 255, 255, 0.55)');
      }
    }, { plain: true }));
  }
  // The woodpile, two tiles wide, with the chopping block at its east end and the axe in it
  function woodpile() {
    const end = (p, x, y) => { p.oval(x, y, 7, 7, '#5c3c20'); p.oval(x, y, 6, 6, '#dcae70'); p.oval(x, y, 3, 3, '#b88848'); p.rect(x - 1, y - 1, 2, 2, '#dcae70'); };
    return pic(72, 54, (p) => {
      for (const x of [9, 22, 35]) end(p, x, 44);
      for (const x of [15, 28]) end(p, x, 32);
      end(p, 21, 20);
      p.oval(21, 13, 9, 3, '#f4f7fc'); p.oval(9, 37, 5, 2, '#f4f7fc');
      // the block
      p.rect(48, 34, 20, 18, '#7a4c28'); p.rect(50, 36, 3, 16, '#9a6a3c'); p.rect(62, 36, 4, 16, '#5c3820');
      p.oval(58, 34, 10, 5, '#dcae70'); p.oval(58, 34, 6, 3, '#b88848');
      // the axe: its handle up and over, its head in the block
      for (let i = 0; i < 18; i++) p.rect(60 + (i >> 2), 32 - i, 3, 1, '#c89058');
      p.rect(53, 28, 10, 7, '#8890a0'); p.rect(53, 28, 10, 2, '#c8ccd8');
    });
  }
  // the fire pit, on the ground: a ring of stones round the embers and a couple of logs
  function firePit() {
    return pic(32, 32, (p) => {
      p.oval(16, 18, 12, 8, '#2a1a12');
      p.oval(16, 19, 8, 5, '#6a2a14');
      p.rect(8, 17, 16, 3, '#5c3820'); p.rect(11, 20, 12, 3, '#7a4c28');
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2, x = 16 + Math.cos(a) * 12.5, y = 18 + Math.sin(a) * 8.5;
        p.oval(x, y, 3.5, 2.5, '#6c7284'); p.rect(Math.round(x) - 2, Math.round(y) - 2, 2, 1, '#a8aebd');
      }
    });
  }
  // its flames, four pictures to flicker through, from the bottom of the picture up
  function flames() {
    return [0, 1, 2, 3].map((k) => pic(28, 34, (p) => {
      const r = rng(11 + k * 13);
      const tongues = [[6, 12], [10, 21], [14, 28], [18, 22], [22, 13]].map(([x, h]) => [x, h + Math.floor(r() * 7) - 3]);
      const draw = (scale, col, w) => {
        for (const [x, h] of tongues) {
          const hh = Math.round(h * scale);
          for (let j = 0; j < hh; j++) {
            const hw = Math.ceil((1 - j / hh) * w);
            p.rect(x - hw, 32 - j, hw * 2, 1, col);
          }
        }
      };
      draw(1, '#e8501c', 4); draw(0.72, '#f8a030', 3); draw(0.42, '#fff0a0', 2);
      for (let i = 0; i < 3; i++) p.rect(4 + Math.floor(r() * 20), Math.floor(r() * 6), 1, 1, '#f8a030');
    }, { plain: true }));
  }
  // a bench, seen from above and from the end, its back on the side away from what it's facing
  function bench(faceRight) {
    return pic(32, 32, (p) => {
      const back = faceRight ? 6 : 22, seat = faceRight ? 10 : 8;
      p.rect(back, 3, 4, 24, '#7a4c28'); p.rect(back, 3, 1, 24, '#a87840');
      p.rect(seat, 3, 14, 24, '#a87840');
      for (let y = 8; y < 27; y += 6) p.rect(seat, y, 14, 1, '#7a4c28');
      p.rect(seat, 3, 14, 1, '#c89860');
      for (const y of [5, 22]) { p.rect(seat - (faceRight ? 4 : 0), y, 18, 2, '#2c3340'); }
      p.oval(seat + 7, 12, 5, 3, '#f4f7fc');
    });
  }
  // A hockey net, its mouth 40 pixels across (as js/hockey.js has it) and as deep as it should
  // be. Opening down the map you see into it; opening up it, you see its back, and the crossbar
  // and posts over the front.
  function net(down) {
    const RED = '#d83030', HI = '#f47070';
    return pic(54, 54, (p) => {
      const L = 7, RR = 47, MESH = 'rgba(248, 250, 255, 0.75)';
      if (down) {
        // the back of the net, then the mesh over it, then the front of the frame
        p.rect(L + 3, 8, RR - L - 6, 30, 'rgba(120, 130, 150, 0.35)');
        for (let x = L + 3; x < RR - 3; x += 4) p.rect(x, 8, 1, 30, MESH);
        for (let y = 8; y < 38; y += 4) p.rect(L + 3, y, RR - L - 6, 1, MESH);
        p.rect(L + 2, 6, RR - L - 4, 3, RED); // (round the back, on the ice behind)
        p.rect(L, 24, 3, 28, RED); p.rect(RR - 3, 24, 3, 28, RED);
        p.rect(L, 24, 1, 28, HI);
        p.rect(L, 24, RR - L, 3, RED); p.rect(L, 24, RR - L, 1, HI);
      } else {
        p.rect(L, 8, 3, 26, RED); p.rect(RR - 3, 8, 3, 26, RED);
        p.rect(L, 8, 1, 26, HI);
        p.rect(L, 8, RR - L, 3, RED); p.rect(L, 8, RR - L, 1, HI);
        p.rect(L + 3, 11, RR - L - 6, 40, 'rgba(120, 130, 150, 0.3)');
        for (let x = L + 3; x < RR - 3; x += 4) p.rect(x, 11, 1, 40, MESH);
        for (let y = 11; y < 51; y += 4) p.rect(L + 3, y, RR - L - 6, 1, MESH);
        p.rect(L + 2, 49, RR - L - 4, 3, RED);
      }
    });
  }
  // a maple leaf for centre ice, from rows
  const LEAF = ['.......##.......', '......####......', '...#..####..#...', '...##.####.##...', '#..##########..#', '.##############.', '..############..', '...##########...', '..############..', '.....######.....', '.......##.......', '.......##.......'];

  // ---------- all of it ----------
  function paint(floor) {
    const W = floor.tiles[0].length, H = floor.tiles.length, PW = W * 32, PH = H * 32;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? ' ' : floor.tiles[y][x]);
    const paved = (t) => ',cLBn~'.includes(t);
    const R = HOCKEY.rink(floor);
    const cv = canvas(PW, PH), c = cv.getContext('2d'), img = c.createImageData(PW, PH), d = new Uint32Array(img.data.buffer);
    let wallH = 0;
    while (at(0, wallH) === '#') wallH++;

    // what the ground's made of, a pixel at a time
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const t = at(x >> 5, y >> 5);
        d[y * PW + x] = !paved(t) ? snowAt(x, y) : y >> 5 === wallH ? slabAt(x, y) : asphaltAt(x, y);
      }

    // ---- the rink ----
    // The ice runs to the middle of the board tiles (where the boards are in js/hockey.js,
    // round the same corners). The boards' cap is that shape lifted up the screen by LIFT, and
    // between them you see their faces: their inside along the top, their outside along the
    // bottom, nothing up the sides.
    const x0 = R.x0 * 32, y0 = R.y0 * 32, x1 = R.x1 * 32, y1 = R.y1 * 32, rr = R.r * 32, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const LIFT = 12, CAP_W = 10;
    const edge = (x, y) => { // how far outside the ice (minus inside)
      const dx = Math.abs(x - mx) - ((x1 - x0) / 2 - rr), dy = Math.abs(y - my) - ((y1 - y0) / 2 - rr);
      return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - rr;
    };
    // the gate: where the boards open, a run of '~' down the rink's right-hand tiles
    let gate0 = 0, gate1 = 0;
    const gx = Math.floor(R.x1);
    for (let y = 0; y < H; y++) if (at(gx, y) === '~') { if (!gate0) gate0 = y * 32; gate1 = (y + 1) * 32; }
    const inGate = (x, y) => gate1 > gate0 && x > mx && y >= gate0 && y < gate1;
    for (let y = Math.floor(y0 - LIFT - CAP_W - 2); y < y1 + CAP_W + 4; y++)
      for (let x = Math.floor(x0 - CAP_W - 2); x < x1 + CAP_W + 2; x++) {
        const s0 = edge(x + 0.5, y + 0.5), s1 = edge(x + 0.5, y + 0.5 + LIFT), i = y * PW + x;
        if (s1 >= 0 && s1 < CAP_W && !inGate(x, y + LIFT)) {
          d[i] = s1 < 2 || s1 >= CAP_W - 2 ? INK : s1 >= CAP_W - 4 ? CAP_HI : s1 < 4 ? CAP_LO : CAP;
        } else if (s0 >= 0 && s1 < 0) {
          if (inGate(x, y)) continue;
          const down = -s1; // (down the inside of the boards: under the cap, white, a yellow kick plate)
          d[i] = down < 2 ? FACE_LO : s0 < 2 ? INK : s0 < 4 ? KICK : FACE;
        } else if (s1 >= CAP_W && s0 < CAP_W) {
          d[i] = s0 >= CAP_W - 2 ? INK : s0 >= CAP_W - 4 ? KICK : FACE;
        } else if (s0 < 0) {
          const near = s0 > -6 - 4 * smooth(x / 9, y / 9);
          const band = (x - y * 0.6 + 4000) % 420 < 54 || (x - y * 0.6 + 4131) % 700 < 26;
          d[i] = near ? ICE_EDGE : band ? ICE_HI : noise(x, y) < 0.002 ? ICE_EDGE : ICE;
        }
      }
    c.putImageData(img, 0, 0);
    const p = pen(c);

    // skate marks: pale arcs here and there
    const rs = rng(33);
    for (let i = 0; i < 90; i++) {
      const cx = x0 + rs() * (x1 - x0), cy = y0 + rs() * (y1 - y0), rad = 20 + rs() * 90, a0 = rs() * Math.PI * 2, len = 0.3 + rs() * 0.9, col = i % 3 ? '#eef7fc' : '#bcd8ec';
      for (let a = a0; a < a0 + len; a += 1 / rad) {
        const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
        if (edge(x, y + LIFT) < -2 && edge(x, y) < -2) p.rect(x, y, 1, 1, col);
      }
    }
    // the markings: laid out along the rink, the same whichever end you're looking from
    const RED = '#d24a4a', BLUE = '#4a74d0', half = (y1 - y0) / 2, wide = (x1 - x0) / 2;
    const across = (y, h, col, inset) => { for (let x = Math.ceil(x0); x < x1; x++) { if (Math.abs(x - mx) <= wide - (inset || 0) && edge(x, y) < -2) p.rect(x, y - (h >> 1), 1, h, col); } };
    // (a ring, kept off the boards)
    const circle = (cx, cy, r, w, col) => {
      c.fillStyle = col;
      for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
        const dd = Math.hypot(x + 0.5, y + 0.5);
        if (dd < r && dd >= r - w && edge(cx + x, cy + y) < -2) c.fillRect(cx + x, cy + y, 1, 1);
      }
    };
    across(Math.round(my), 4, RED);
    for (const s of [-1, 1]) across(Math.round(my + s * half * 0.33), 4, BLUE);
    circle(Math.round(mx), Math.round(my), 52, 2, BLUE);
    p.rect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4, BLUE);
    for (const n of R.nets) {
      const gy = Math.round(n.y * 32), gxx = Math.round(n.x * 32), s = n.dir;
      across(gy, 2, RED, 12);
      // the crease: a half circle in front of the net
      for (let y = 0; y < 30; y++) for (let x = -30; x <= 30; x++) {
        const dd = Math.hypot(x, y);
        if (dd < 30) p.rect(gxx + x, gy + s * y, 1, 1, dd >= 28 ? RED : '#a4cbee');
      }
      for (const u of [-1, 1]) {
        const fx = Math.round(mx + u * wide * 0.5), fy = gy + s * 96;
        circle(fx, fy, 34, 2, RED);
        p.rect(fx - 2, fy - 2, 4, 4, RED);
      }
    }
    // a maple leaf and the company's name at centre ice
    LEAF.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.rect(Math.round(mx) - 16 + i * 2, Math.round(my) - 34 + j * 2, 2, 2, '#e8a0a4'); }));
    p.word('HAAKON', Math.round(mx) - 35, Math.round(my) + 8, '#9cbce6', 2);
    // what's on the boards along the top and the bottom
    const ads = (y) => {
      const lines = [['HAAKON', '#2f5cc0'], ['HAPPY HOLIDAYS', '#d0262c'], ['HAAKON', '#d0262c'], ['MERRY CHRISTMAS', '#2f5cc0'], ['HAAKON', '#2f5cc0']];
      let x = Math.round(x0 + 26), i = 0;
      while (x < x1 - 40) {
        const [str, col] = lines[i++ % lines.length], w = str.length * 6;
        if (x + w > x1 - 26) break;
        p.word(str, x, y, col);
        x += w + 26;
      }
    };
    ads(Math.round(y0 - LIFT + 2));
    ads(Math.round(y1 + 1));
    // snow on the top rail
    const rt = rng(5);
    const tuft = (x, y) => { p.rect(x, y - 1, 5 + Math.floor(rt() * 5), 3, '#f4f7fc'); p.rect(x + 1, y - 2, 3, 1, '#ffffff'); };
    for (let x = x0 + 30; x < x1 - 30; x += 16 + rt() * 40) { tuft(Math.round(x), Math.round(y0 - LIFT - 5)); tuft(Math.round(x + 7), Math.round(y1 - LIFT + 5)); }
    for (let y = y0 + 44; y < y1 - 30; y += 70 + rt() * 130) {
      p.rect(Math.round(x0 - 7), Math.round(y), 4, 5 + Math.floor(rt() * 5), '#f4f7fc');
      if (!inGate(x1 + 2, y) && !inGate(x1 + 2, y + 12)) p.rect(Math.round(x1 + 3), Math.round(y + 9), 4, 5 + Math.floor(rt() * 5), '#f4f7fc');
    }
    // the gate: a rubber mat through the gap, a post each side
    let gateCap = null;
    if (gate1 > gate0) {
      const gX = Math.round(x1);
      p.rect(gX - 4, gate0, 24, gate1 - gate0, K); p.rect(gX - 4, gate0 + 2, 22, gate1 - gate0 - 4, '#3a3d48');
      for (let y = gate0 + 6; y < gate1 - 4; y += 6) p.rect(gX - 2, y, 18, 2, '#2a2d36');
      for (const y of [gate0, gate1]) { p.rect(gX - 2, y - 14, 12, 16, K); p.rect(gX, y - 12, 8, 12, '#2f5cc0'); p.rect(gX, y - 12, 2, 12, '#6a90e8'); p.rect(gX - 1, y - 16, 10, 3, '#f4f7fc'); }
      gateCap = { x: (gX - 2) / 2, y: (gate0 - LIFT) / 2, img: pic(12, gate1 - gate0, (q) => {
        q.rect(2, 0, 8, gate1 - gate0, '#2f5cc0'); q.rect(6, 0, 2, gate1 - gate0, '#6a90e8');
      }) };
    }

    // ---- the lot itself ----
    // slush, in heaps of grey here and there, and oil where the cars stand
    const rl = rng(1225);
    for (let i = 0; i < W * H * 0.07; i++) {
      const x = Math.floor(rl() * PW), y = Math.floor(rl() * PH), w = 6 + rl() * 14;
      if (at(x >> 5, y >> 5) !== ',' || y >> 5 === wallH || at((x + w) >> 5, y >> 5) !== ',' || at((x - w) >> 5, y >> 5) !== ',') continue;
      p.oval(x, y + 1, w, 2 + rl() * 2, '#70748a');
      p.oval(x - 1, y, w * 0.7, 1.5, '#8a8fa4');
    }
    // parking lines down the gaps between the cars
    const cars = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (at(x, y) === 'c' && at(x - 1, y) !== 'c' && at(x, y - 1) !== 'c') {
          cars.push([x, y]);
          for (const lx of [x - 1, x + 2]) if (at(lx, y) === ',' && at(lx, y + 1) === ',' && at(lx, y + 2) === ',') { p.rect(lx * 32 + 15, y * 32 + 4, 3, 90, '#e0b83a'); p.rect(lx * 32 + 15, y * 32 + 4, 1, 90, '#f4d868'); }
        }
    // ridges of snow where the plow stopped, all along wherever asphalt meets snow: a scalloped
    // white band with a blue edge where it thins out onto the asphalt
    const drift = (u, v) => Math.round(smooth(u / 17, v / 17 + 3) * 7 + Math.abs(Math.sin((u + v) / 6.5)) * 4);
    for (let y = wallH; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = at(x, y);
        if (!paved(t) || t === 'B' || t === 'n' || t === '~') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = at(x + dx, y + dy);
          if (paved(n) || n === '#' || n === 'X') continue;
          for (let i = 0; i < 32; i += 2) {
            const ax = dx ? x * 32 + (dx > 0 ? 32 : 0) : x * 32 + i, ay = dy ? y * 32 + (dy > 0 ? 32 : 0) : y * 32 + i, w = 3 + drift(ax, ay);
            if (dx) { p.rect(dx > 0 ? ax - w - 2 : ax, ay, w + 2, 2, '#a4b2ca'); p.rect(dx > 0 ? ax - w : ax, ay, w, 2, '#f0f4fb'); }
            else { p.rect(ax, dy > 0 ? ay - w - 2 : ay, 2, w + 2, '#a4b2ca'); p.rect(ax, dy > 0 ? ay - w : ay, 2, w, '#f0f4fb'); }
          }
        }
      }

    // ---- the office along the top ----
    const WY = wallH * 32, doors = [];
    for (let x = 0; x < W; x++) if (at(x, wallH - 1) === 'X') doors.push(x);
    const d0 = doors[0] * 32, d1 = (doors[doors.length - 1] + 1) * 32;
    // brick, a course every 8 pixels, each brick a little different
    for (let y = 12; y < WY - 14; y++) {
      const row = (y - 12) >> 3, ly = (y - 12) & 7;
      for (let x = 0; x < PW; x++) {
        const lx = (x + (row & 1) * 12) % 24, n = noise(Math.floor((x + (row & 1) * 12) / 24), row * 37);
        const col = ly === 7 || lx === 0 ? '#7e3a28' : ly === 0 ? '#c8745a' : n < 0.14 ? '#96462f' : n < 0.26 ? '#bc664c' : '#ad5a40';
        p.rect(x, y, 1, 1, col);
      }
    }
    // the eaves' shadow, the footing along the bottom, the roof edge
    p.rect(0, 12, PW, 2, '#5a2c20'); p.rect(0, 14, PW, 2, '#7e3a28');
    p.rect(0, WY - 14, PW, 2, K); p.rect(0, WY - 12, PW, 10, '#8e96a8'); p.rect(0, WY - 12, PW, 2, '#b4bac8'); p.rect(0, WY - 2, PW, 2, K);
    p.rect(0, 0, PW, 12, '#3c404c'); p.rect(0, 8, PW, 2, '#5c6070'); p.rect(0, 10, PW, 2, K);
    // and snow on it, with icicles hanging off
    const rr2 = rng(77);
    for (let x = 0; x < PW; x += 4) { const h = 3 + Math.floor(rr2() * 4); p.rect(x, 0, 4, h + 1, '#c4d2e6'); p.rect(x, 0, 4, h, '#f4f7fc'); }
    for (let x = 3; x < PW; x += 9 + Math.floor(rr2() * 18)) {
      const len = 4 + Math.floor(rr2() * 9);
      for (let j = 0; j < len; j++) { const w = Math.max(1, 3 - (j * 3 / len | 0)); p.rect(x, 12 + j, w, 1, j < 2 ? '#e8f4fc' : '#b4dcf4'); }
    }
    // windows, lit from inside, every few tiles away from the doors, and their light on the sidewalk
    for (let tx = 1.5; tx + 2 < W; tx += 4) {
      const wx = tx * 32;
      if (wx + 64 > d0 - 20 && wx < d1 + 20) continue;
      p.c.fillStyle = 'rgba(255, 214, 130, 0.2)';
      for (let j = 0; j < 22; j++) p.c.fillRect(wx + 6 - (j >> 2), WY + j, 52 + (j >> 1), 1);
      const y0w = 20, hw = 46;
      p.rect(wx - 2, y0w - 2, 68, hw + 4, K);
      p.rect(wx, y0w, 64, hw, '#efe6d2'); p.rect(wx + 58, y0w, 6, hw, '#c8bea4');
      p.rect(wx + 4, y0w + 4, 56, hw - 8, K);
      p.rect(wx + 5, y0w + 5, 54, hw - 10, '#ffd77a');
      p.rect(wx + 5, y0w + hw - 16, 54, 11, '#f0b050');
      for (let j = 0; j < 12; j++) p.rect(wx + 7 + j, y0w + 5 + (12 - j), 12, 1, '#fff2c4');
      p.rect(wx + 30, y0w + 5, 4, hw - 10, '#efe6d2'); p.rect(wx + 5, y0w + 21, 54, 3, '#efe6d2');
      p.rect(wx + 30, y0w + 5, 1, hw - 10, K); p.rect(wx + 33, y0w + 5, 1, hw - 10, K); p.rect(wx + 5, y0w + 21, 54, 1, K); p.rect(wx + 5, y0w + 23, 54, 1, K);
      // (a sill of snow)
      p.rect(wx - 4, y0w + hw + 2, 72, 2, K);
      p.rect(wx - 4, y0w + hw - 3, 72, 5, '#f4f7fc'); p.rect(wx - 4, y0w + hw - 5, 72, 2, K);
      for (let k = 0; k < 8; k++) p.rect(wx - 2 + k * 9, y0w + hw - 6, 7, 3, '#f4f7fc');
    }
    // the doors: glass and light, a dark frame, a canopy over them with the name on, a wreath, a mat
    p.c.fillStyle = 'rgba(255, 220, 150, 0.26)';
    for (let j = 0; j < 30; j++) p.c.fillRect(d0 + 2 - (j >> 1), WY + j, d1 - d0 - 4 + j, 1);
    p.rect(d0 - 4, 34, d1 - d0 + 8, WY - 34, K);
    p.rect(d0 - 2, 36, d1 - d0 + 4, WY - 36, '#343c4a');
    for (let x = d0; x < d1; x += 32) {
      p.rect(x + 2, 40, 28, WY - 40, K);
      p.rect(x + 3, 41, 26, WY - 41, '#ffd77a');
      p.rect(x + 3, 66, 26, WY - 66, '#f0b050');
      for (let j = 0; j < 12; j++) p.rect(x + 5 + j, 42 + (11 - j), 6, 1, '#fff2c4');
      p.rect(x === d0 ? x + 24 : x + 5, 62, 3, 10, '#c8ccd8');
    }
    p.rect(d0 - 18, 16, d1 - d0 + 36, 20, K);
    p.rect(d0 - 16, 18, d1 - d0 + 32, 16, '#24408a'); p.rect(d0 - 16, 18, d1 - d0 + 32, 2, '#4a6cc0'); p.rect(d0 - 16, 30, d1 - d0 + 32, 4, '#182c60');
    p.word('HAAKON', ((d0 + d1) >> 1) - 18, 21, '#ffffff');
    for (let x = d0 - 16; x < d1 + 16; x += 8) { const h = 2 + (x % 3); p.rect(x, 18 - h, 8, h, '#f4f7fc'); p.rect(x, 18, 8, 1, '#c4d2e6'); }
    p.rect(((d0 + d1) >> 1) - 1, 34, 2, 7, K); // (the wreath hangs from the canopy)
    const wreath = pic(26, 26, (q) => {
      q.ring(13, 13, 10, 5, '#2c6a34');
      q.ring(13, 13, 9, 1, '#58a848');
      for (const [x, y] of [[7, 7], [18, 9], [5, 15], [20, 15], [13, 4]]) q.rect(x, y, 2, 2, '#f05050');
      q.rect(9, 19, 8, 4, '#d83030'); q.rect(12, 18, 2, 6, '#a82020');
    });
    c.drawImage(wreath, ((d0 + d1) >> 1) - 13, 40);
    p.rect(d0 + 2, WY + 2, d1 - d0 - 4, 18, K); p.rect(d0 + 4, WY + 4, d1 - d0 - 8, 14, '#8a2a2a');
    for (let y = WY + 6; y < WY + 18; y += 4) p.rect(d0 + 4, y, d1 - d0 - 8, 1, '#6a1e1e');
    // snow against the foot of the wall, in the same scallops
    for (let x = 0; x < PW; x += 2) {
      if (x > d0 - 24 && x < d1 + 24) continue;
      const w = drift(x, 900) - 2;
      if (w < 1) continue;
      p.rect(x, WY - w, 2, w + 5, '#a4b2ca'); p.rect(x, WY - w, 2, w + 3, '#f0f4fb');
    }

    // ---- what stands on the lot ----
    const props = [], bulbs = [], wires = [];
    const light = (x, y, rx, ry, col) => { for (const [k, a] of [[1, 0.07], [0.68, 0.08], [0.4, 0.1]]) p.oval(x, y, rx * k, ry * k, 'rgba(' + col + ', ' + a + ')'); };
    // (a picture on the map: its foot's middle at x, foot, sorted in with people by that foot)
    const stand = (im, x, foot, extra) => props.push(Object.assign({ x: (x - im.width / 2) / 2, y: (foot - im.height) / 2, z: foot / 2 - 12, img: im }, extra));
    const pines = [1, 2, 3, 4].map(pine), rw = rng(4242);
    const lumps = [0, 1, 2, 3, 4, 5].map((i) => lump(100 + i));
    const lanterns = [];
    for (const [x, y] of cars) {
      const col = CARS[Math.floor(rl() * CARS.length)];
      c.drawImage(car(col, y < H / 2, rng(Math.floor(rl() * 1e6))), x * 32, y * 32);
    }
    const mpix = (x) => x * 32 + 16;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = at(x, y), foot = (y + 1) * 32 - 4;
        if (t === ' ' && y >= wallH) {
          const s = pines[Math.floor(rw() * pines.length)];
          p.oval(mpix(x), y * 32 + 28, 16, 5, '#c0cee2');
          props.push({ x: (mpix(x) - 20 + Math.round((rw() - 0.5) * 8)) / 2, y: (y * 32 + 30 - s.height + Math.round((rw() - 0.5) * 4)) / 2, z: y * 16 + 3, img: s });
        } else if (t === 'L') {
          const im = lampPost();
          light(mpix(x), foot - 4, 76, 40, '255, 214, 130');
          stand(im, mpix(x), foot + 2);
          lanterns.push([(mpix(x)) / 2, (foot + 2 - im.height + 22) / 2]);
        } else if (t === 'h' && at(x - 1, y) !== 'h' && at(x, y - 1) !== 'h') {
          let hh = 0, ww = 0;
          while (at(x, y + hh) === 'h') hh++;
          while (at(x + ww, y) === 'h') ww++;
          const im = cocoaStand(), bx = x * 32 + (ww * 32) / 2, by = (y + hh) * 32 - 2;
          light(bx, by + 6, 80, 22, '255, 214, 130');
          stand(im, bx, by);
          const sm = steam();
          props.push({ x: (bx - 56 + 33 - 12) / 2, y: (by - 120 + 44 - 30) / 2, z: by / 2 - 11, frames: sm, every: 14 });
        } else if (t === 'b') {
          const faces = at(x + 2, y) === 'f';
          c.drawImage(bench(faces), x * 32, y * 32);
        } else if (t === 'f') {
          light(mpix(x), y * 32 + 18, 96, 56, '255, 150, 70');
          c.drawImage(firePit(), x * 32, y * 32);
          const fl = flames();
          props.push({ x: (mpix(x) - 14) / 2, y: (y * 32 + 22 - 34) / 2, z: y * 16 + 1, frames: fl, every: 6 });
        } else if (t === 's') {
          stand(snowman(), mpix(x), foot);
        } else if (t === 'w' && at(x - 1, y) !== 'w') {
          stand(woodpile(), x * 32 + 32, foot);
        } else if (t === '*') {
          const rb = rng(x * 31 + y);
          for (let i = 0; i < 3; i++) c.drawImage(lumps[Math.floor(rb() * lumps.length)], x * 32 + Math.floor(rb() * 14) - 1, y * 32 + 4 + i * 6 + Math.floor(rb() * 3));
          const big = pic(36, 28, (q) => { heap(q, 18, 12, 28, 16); heap(q, 12, 8, 14, 8); });
          c.drawImage(big, x * 32 - 2, y * 32 + 2);
        } else if (t === 'Y') {
          const fr = bigSpruce();
          p.oval(mpix(x), y * 32 + 28, 56, 16, '#c0cee2');
          props.push({ x: (mpix(x) - fr[0].width / 2) / 2, y: (y * 32 + 32 - fr[0].height) / 2, z: y * 16 + 4, frames: fr, every: 32 });
        }
      }
    // the nets, on the ice, sorted in by their goal lines
    for (const n of R.nets) {
      const im = net(n.dir > 0), gy = n.y * 32, xp = n.x * 32;
      props.push({ x: (xp - 27) / 2, y: (n.dir > 0 ? gy + 2 - 52 : gy + 2 - 34) / 2, z: gy / 2 - 12, img: im });
    }
    // a string of lights all round the rink, lamp post to lamp post, with a bulb every 9 pixels
    const corner = (i, j) => lanterns.find(([lx, ly]) => (i ? lx > mx / 2 : lx < mx / 2) && (j ? ly > my / 2 : ly < my / 2));
    const loop = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
    if (loop.every(Boolean)) loop.forEach((a, i) => {
      const b = loop[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), level = Math.abs(a[1] - b[1]) < 1, sag = level ? 12 : 0, n = Math.floor(len / 9);
      const pt = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + sag * 4 * u * (1 - u)];
      for (let j = 0; j <= len; j++) { const [x, y] = pt(j / len); wires.push([Math.round(x * 2) / 2, Math.round(y * 2) / 2]); }
      for (let j = 1; j < n; j++) { const [x, y] = pt(j / n); bulbs.push([Math.round(x * 2) / 2, Math.round(y * 2) / 2, (i * 3 + j) % 4]); }
    });

    return { w: W * 16, h: H * 16, ground: cv, props, bulbs, wires, gate: gateCap, roof: 7 };
  }
  // A snow angel, for pressing into the snow: h tiles tall from its head to its feet, its wings
  // swept out and its skirt of legs below (at 32 x 32, like everything else here).
  const ANGEL = [
    '.........######.........', '........########........', '........########........', '.........######.........',
    '..##......####......##..', '.####....######....####.', '.######.########.######.', '..######################', '...####################.',
    '.....################...', '.......############.....', '........##########......', '........##########......',
    '.......############.....', '.......############.....', '......##############....', '......######..######....', '.....######....######...',
    '.....#####......#####...', '....#####........#####..', '....####..........####..', '.....##............##...',
  ];
  function angel() {
    return pic(24, 22, (p) => ANGEL.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.rect(i, j, 1, 1, '#a8b8d4'); })), { plain: true });
  }
  return { paint, angel };
})();
