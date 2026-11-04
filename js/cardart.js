// The pictures for the card game: the art on each card, the card around it, the small card that sits
// on the table and the back of a card. A legendary's art keeps moving (see LIVE).
//
// It's all plain pixels, with no document, keys or game in it, so the same pictures can be made in
// the game, on a page of samples, or in Node. Only toCanvas, canvasOf and shine touch a canvas.
//
// Art is painted at 118 x 75 and shown at double size, so one of its pixels is two on the screen
// (the game's 2-pixel outline is one pixel here). A big card is 260 x 364 on the screen and a small
// one 88 x 116. To paint a new card, add it to ART, with the middle of its picture in FOCUS for
// the small card. People are put together with person(), so they match each other.
window.CARD_ART = (function () {
  const FONT = window.FONT;
  const ART_W = 118, ART_H = 75;
  const LINE = '#1a1622'; // the outline round everything

  // ---------- colours ----------
  const packed = new Map();
  const C = (hex) => {
    let v = packed.get(hex);
    if (v === undefined) {
      const n = parseInt(hex.slice(1), 16);
      v = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
      packed.set(hex, v);
    }
    return v;
  };
  function toHsl(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const a = Math.max(r, g, b), i = Math.min(r, g, b), l = (a + i) / 2, d = a - i;
    let h = 0;
    if (d) { h = a === r ? ((g - b) / d + 6) % 6 : a === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
  }
  function fromHsl(h, s, l) {
    s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  }
  const toward = (h, to, by) => {
    const d = ((to - h + 540) % 360) - 180;
    return (h + Math.sign(d) * Math.min(Math.abs(d), by) + 360) % 360;
  };
  // A colour with its shade and highlight. Shadows lean blue and highlights lean yellow, which keeps
  // them looking like light on something rather than the same colour made darker.
  const ramps = new Map();
  function ramp(hex) {
    if (typeof hex !== 'string') return hex;
    let r = ramps.get(hex);
    if (!r) {
      const [h, s, l] = toHsl(hex);
      r = {
        hi: fromHsl(toward(h, 52, 10), s * 0.95, l + (1 - l) * (l < 0.2 ? 0.2 : 0.42)),
        body: hex,
        shade: fromHsl(toward(h, 250, 14), s * 1.05, l * 0.74),
        deep: fromHsl(toward(h, 250, 24), s * 1.1, l * 0.52),
      };
      ramps.set(hex, r);
    }
    return r;
  }

  // Skin gets its own: warmer and gentler, or everyone looks sunburnt on one side.
  function skinRamp(hex) {
    if (typeof hex !== 'string') return hex;
    const [h, s, l] = toHsl(hex);
    return {
      hi: fromHsl(h, s, l + (1 - l) * 0.4),
      body: hex,
      shade: fromHsl(toward(h, 8, 6), s * 0.82, l * 0.84),
      deep: fromHsl(toward(h, 8, 10), s * 0.78, l * 0.72),
    };
  }

  // ---------- pictures and shapes ----------
  function Pic(w, h) {
    const px = new Uint32Array(w * h); // (0 is see-through)
    return {
      w, h, px,
      set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = C(c); },
      box(x, y, bw, bh, c) { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) this.set(x + i, y + j, c); },
      // a little picture from rows of letters, with a colour for each letter ('.' is left alone)
      rows(x, y, rows, pal) {
        rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') this.set(x + i, y + j, pal[ch]); }));
      },
      // another picture on top of this one, n times the size
      put(o, x, y, n = 1) {
        for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
          const v = o.px[j * o.w + i];
          if (!v) continue;
          for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
            const X = x + i * n + a, Y = y + j * n + b;
            if (X >= 0 && Y >= 0 && X < w && Y < h) px[Y * w + X] = v;
          }
        }
      },
    };
  }
  // A shape: which pixels are in it. v = 0 on any of these cuts instead of adding.
  function Mask(w, h) {
    const on = new Uint8Array(w * h);
    const row = (y, a, b, v) => {
      y = Math.round(y);
      if (y < 0 || y >= h) return;
      for (let x = Math.max(0, Math.round(a)); x < Math.min(w, Math.round(b)); x++) on[y * w + x] = v;
    };
    const m = {
      w, h, on,
      has(x, y) { return x >= 0 && y >= 0 && x < w && y < h && on[y * w + x] === 1; },
      ell(cx, cy, rx, ry = rx, v = 1) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          const d = (y + 0.5 - cy) / ry;
          if (Math.abs(d) < 1) { const k = rx * Math.sqrt(1 - d * d); row(y, cx - k, cx + k, v); }
        }
        return m;
      },
      poly(pts, v = 1) {
        const ys = pts.map((q) => q[1]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
          const xs = [], at = y + 0.5;
          pts.forEach(([x0, y0], i) => {
            const [x1, y1] = pts[(i + 1) % pts.length];
            if ((y0 <= at && y1 > at) || (y1 <= at && y0 > at)) xs.push(x0 + (at - y0) * (x1 - x0) / (y1 - y0));
          });
          xs.sort((a, b) => a - b);
          for (let i = 0; i + 1 < xs.length; i += 2) row(y, xs[i], xs[i + 1], v);
        }
        return m;
      },
      box(x, y, bw, bh, v = 1) { for (let j = 0; j < bh; j++) row(y + j, x, x + bw, v); return m; },
      rbox(x, y, bw, bh, r, v = 1) {
        for (let j = 0; j < bh; j++) {
          const d = Math.min(j + 0.5, bh - j - 0.5), k = d < r ? r - Math.sqrt(r * r - (r - d) * (r - d)) : 0;
          row(y + j, x + k, x + bw - k, v);
        }
        return m;
      },
      // a thick line
      line(x0, y0, x1, y1, t = 2, v = 1) {
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
        for (let i = 0; i <= n; i++) m.ell(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, t / 2, t / 2, v);
        return m;
      },
      add(o) { for (let i = 0; i < on.length; i++) if (o.on[i]) on[i] = 1; return m; },
      cut(o) { for (let i = 0; i < on.length; i++) if (o.on[i]) on[i] = 0; return m; },
      keep(o) { for (let i = 0; i < on.length; i++) if (!o.on[i]) on[i] = 0; return m; },
    };
    return m;
  }
  // A shape in a colour, the way everything in the game is drawn: an outline all the way round, then
  // the light from the top left. sh, hi and deep are how far in the shade, highlight and darkest
  // shade reach: bigger makes it look rounder. 0 leaves one out, and line: null the outline.
  function fig(p, m, base, o = {}) {
    const r = ramp(base), { w, h } = m;
    const sh = o.sh === undefined ? [2, 2] : o.sh, hi = o.hi === undefined ? [1, 1] : o.hi, deep = o.deep || 0;
    if (o.line !== null) {
      const c = C(o.line || LINE);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!m.on[y * w + x]) continue;
        for (const [i, j] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const X = x + i, Y = y + j;
          if (X >= 0 && Y >= 0 && X < w && Y < h && !m.on[Y * w + X]) p.px[Y * w + X] = c;
        }
      }
    }
    const body = C(r.body), lit = C(r.hi), dark = C(r.shade), darker = C(r.deep);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m.on[y * w + x]) continue;
      let c = body;
      if (hi && !m.has(x - hi[0], y - hi[1])) c = lit;
      if (sh && !m.has(x + sh[0], y + sh[1])) c = dark;
      if (deep && !m.has(x + deep[0], y + deep[1])) c = darker;
      p.px[y * w + x] = c;
    }
  }
  const M = (p) => Mask(p.w, p.h);
  // a shape in one flat colour with no outline
  function flat(p, m, c) { const v = C(c); for (let i = 0; i < m.on.length; i++) if (m.on[i]) p.px[i] = v; }
  // a four-pointed twinkle
  function spark(p, x, y, c, n = 3) {
    for (let i = -n; i <= n; i++) { p.set(x + i, y, c); p.set(x, y + i, c); }
    if (n > 2) for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.set(x + i, y + j, c);
  }
  // part of a circle, as a thin line
  function arc(p, cx, cy, r, a0, a1, c) {
    const n = Math.ceil(r * Math.abs(a1 - a0) * 1.5);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
  }
  // wedges of light spreading out from a point
  function rays(p, cx, cy, n, c, turn = 0, y0 = 0, y1 = p.h) {
    const v = C(c), step = Math.PI * 2 / n;
    for (let y = y0; y < y1; y++) for (let x = 0; x < p.w; x++) {
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI + turn;
      if (Math.floor(a / step * 2) % 2 === 0) p.px[y * p.w + x] = v;
    }
  }
  function words(p, str, x, y, c, n = 1) { // in the game's letters at their small size, one pixel here each
    let cx = x;
    for (const ch of str) {
      const g = FONT.glyphs[ch] || FONT.glyphs['?'];
      g.forEach((row, j) => [...row].forEach((v, i) => { if (v === '1') p.box(cx + i * n, y + j * n, n, n, c); }));
      cx += FONT.ADV * n;
    }
  }

  // ---------- people ----------
  // A coworker from the chest up, in the colours they have in the game. cx, cy: the middle of their
  // head. o: { skin, hair, top, accent, hairdo, brow, mouth, look } (see the lists below). Whatever
  // they're holding gets painted after this, and on top of them with arm().
  const HAIRDOS = {
    // the hair behind the head goes first, then what's over the forehead
    short(p, cx, cy, hair) {
      const m = M(p).ell(cx, cy - 6, 17, 13);
      m.ell(cx - 15, cy - 1, 3, 6); m.ell(cx + 15, cy - 1, 3, 6);
      m.poly([[cx - 14, cy + 12], [cx - 14, cy - 3], [cx - 7, cy - 7], [cx + 3, cy - 8], [cx + 14, cy - 3], [cx + 14, cy + 12]], 0);
      fig(p, m, hair, { sh: [2, 2], hi: 0 });
    },
    // parted on one side, with a shine across it
    sidepart(p, cx, cy, hair) {
      const m = M(p).ell(cx, cy - 7, 18, 13);
      m.ell(cx - 16, cy - 1, 3, 6); m.ell(cx + 16, cy - 1, 3, 6);
      m.poly([[cx - 14, cy + 12], [cx - 14, cy - 2], [cx - 9, cy - 6], [cx - 1, cy - 4], [cx + 7, cy - 7], [cx + 14, cy - 3], [cx + 14, cy + 12]], 0);
      fig(p, m, hair, { sh: [2, 2], hi: 0 });
      const lit = ramp(hair).hi;
      for (let i = 0; i < 16; i++) p.set(cx - 12 + i, cy - 15 + Math.round(Math.abs(i - 7) * 0.32), lit);
      for (let i = 0; i < 9; i++) p.set(cx - 9 + i, cy - 13 + Math.round(Math.abs(i - 4) * 0.4), lit);
      p.set(cx - 2, cy - 9, LINE); p.set(cx - 1, cy - 8, LINE); p.set(cx - 1, cy - 7, LINE);
    },
    // long, down past the shoulders (it goes behind the head too: see back in person)
    long(p, cx, cy, hair) {
      const m = M(p).ell(cx, cy - 6, 18, 14);
      m.ell(cx - 16, cy + 2, 3, 8); m.ell(cx + 16, cy + 2, 3, 8);
      m.poly([[cx - 14, cy + 14], [cx - 14, cy - 4], [cx - 6, cy - 8], [cx + 6, cy - 5], [cx + 14, cy - 2], [cx + 14, cy + 14]], 0);
      fig(p, m, hair, { sh: [2, 2], hi: 0 });
      const lit = ramp(hair).hi;
      for (let i = 0; i < 14; i++) p.set(cx - 11 + i, cy - 15 + Math.round(Math.abs(i - 6) * 0.3), lit);
    },
    // just the bits that show below a hat
    under(p, cx, cy, hair) {
      const m = M(p).ell(cx - 15, cy - 2, 3, 6).ell(cx + 15, cy - 2, 3, 6).box(cx - 15, cy - 8, 30, 3);
      fig(p, m, hair, { sh: 0, hi: 0 });
    },
  };
  function face(p, cx, cy, o) {
    const skin = skinRamp(o.skin), eye = o.eyes || '#2a1c18', brow = o.browc || ramp(o.hair).shade;
    // eyes
    const pal = { L: LINE, w: '#f8f8f4', e: eye, h: '#ffffff', s: skin.shade };
    const EYE = o.look === 'wide'
      ? ['.LLLL.', 'LwwwwL', 'wweeww', 'wwehww', 'wweeww', '.wwww.']
      : ['LLLLL', 'weehw', 'weeew', 'sLLLs'];
    const EY = cy + (o.look === 'wide' ? -1 : 1), wd = EYE[0].length;
    p.rows(cx - 8 - (wd - 5), EY, EYE, pal);
    p.rows(cx + 4, EY, EYE, pal);
    // eyebrows
    const left = o.brow === 'worried' ? [[-9, 0], [-8, -1], [-7, -1], [-6, -2], [-5, -2]]
      : [[-9, -1], [-8, -2], [-7, -2], [-6, -2], [-5, -1]];
    const right = o.brow === 'raised' ? [[4, -3], [5, -4], [6, -4], [7, -4], [8, -3]]
      : o.brow === 'worried' ? [[4, -2], [5, -2], [6, -1], [7, -1], [8, 0]]
        : [[4, -1], [5, -2], [6, -2], [7, -2], [8, -1]];
    const by = cy + (o.look === 'wide' ? -2 : 0);
    for (const [x, y] of left.concat(right)) { p.set(cx + x, by + y, brow); p.set(cx + x, by + y + 1, brow); }
    // nose
    for (const [x, y] of [[1, 6], [1, 7], [0, 8], [1, 8], [-1, 8]]) p.set(cx + x, cy + y, skin.shade);
    p.set(cx - 1, cy + 6, skin.hi);
    // cheeks
    for (const x of [-11, -9, 8, 10]) { p.set(cx + x, cy + 8, o.blush || skin.shade); p.set(cx + x + 1, cy + 9, o.blush || skin.shade); }
    // mouth
    const y = cy + 12;
    if (o.mouth === 'grin') {
      p.rows(cx - 6, y - 1, ['LLLLLLLLLLLLL', 'LwwwwwwwwwwwL', '.LwwwwwwwwwL.', '..LrrrrrrrL..', '...LLLLLLL...'], { L: LINE, w: '#f8f8f4', r: '#c84848' });
    } else if (o.mouth === 'smirk') {
      p.rows(cx - 4, y, ['L.......L', '.LLLLLLL.'], { L: LINE });
      p.set(cx + 5, y - 1, LINE); p.set(cx + 5, y - 2, skin.shade);
    } else if (o.mouth === 'nervous') {
      p.rows(cx - 4, y, ['.L.L.L.L.', 'L.L.L.L.L'], { L: LINE });
    } else {
      p.rows(cx - 5, y, ['L.........L', '.LLLLLLLLL.'], { L: LINE });
      p.box(cx - 3, y + 2, 7, 1, skin.shade);
    }
  }
  function person(p, cx, cy, o) {
    const skin = skinRamp(o.skin);
    if (o.hairdo === 'long') fig(p, M(p).rbox(cx - 21, cy - 6, 42, 42, 10), o.hair, { sh: [3, 2], hi: 0 });
    // shoulders
    const torso = M(p).poly([[cx - 34, 80], [cx - 33, cy + 33], [cx - 24, cy + 25], [cx - 9, cy + 20], [cx + 9, cy + 20], [cx + 24, cy + 25], [cx + 33, cy + 33], [cx + 34, 80]]);
    fig(p, torso, o.top, { sh: [5, 3], hi: [2, 2], deep: [2, 1] });
    if (o.clothes) o.clothes(p, cx, cy, torso);
    // neck, with the head's shadow on it
    const neck = M(p).box(cx - 7, cy + 12, 14, 14);
    fig(p, neck, skin, { sh: [3, 0], hi: 0 });
    p.box(cx - 7, cy + 18, 14, 3, skin.shade);
    // ears
    const ears = M(p).ell(cx - 17, cy + 3, 3, 4).ell(cx + 17, cy + 3, 3, 4);
    fig(p, ears, skin, { sh: [1, 1], hi: 0 });
    // head: round on top, narrowing to the chin
    const head = M(p).ell(cx, cy, 16, 15).poly([[cx - 16, cy + 1], [cx - 13, cy + 13], [cx - 6, cy + 18], [cx + 6, cy + 18], [cx + 13, cy + 13], [cx + 16, cy + 1]]);
    fig(p, head, skin, { sh: [5, 3], hi: [1, 1], deep: [2, 1] });
    face(p, cx, cy, o);
    HAIRDOS[o.hairdo || 'short'](p, cx, cy, o.hair);
  }
  // an arm from the shoulder to a hand, over whatever's already there
  function arm(p, x0, y0, x1, y1, sleeve, skin, t = 9) {
    fig(p, M(p).line(x0, y0, x1, y1, t), sleeve, { sh: [3, 2], hi: [1, 1] });
    fig(p, M(p).ell(x1, y1, t / 2 + 0.5), skinRamp(skin), { sh: [2, 2], hi: [1, 1] });
  }

  // ---------- where they are ----------
  const BACKS = {
    // the kitchen off the lunch room: tiles, hanging pans, a counter
    lunch(p) {
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
        const tile = (Math.floor(x / 11) + Math.floor(y / 11)) % 2;
        const grout = x % 11 === 0 || y % 11 === 0;
        p.set(x, y, grout ? '#b8b08c' : tile ? '#d8d0a8' : '#d0c89c');
      }
      p.box(0, 12, ART_W, 3, '#7a5238'); p.box(0, 12, ART_W, 1, '#a07450'); p.box(0, 15, ART_W, 1, '#a89c78');
      for (const [x, r] of [[8, 6], [24, 5], [100, 5], [112, 6]]) {
        p.box(x, 15, 1, 5, '#6c6458');
        fig(p, M(p).ell(x, 20 + r, r), '#b87848', { sh: [2, 2], hi: [1, 1], line: '#5a3c30' });
      }
      p.box(0, 62, ART_W, 13, '#98a0a8'); p.box(0, 62, ART_W, 2, '#d0d8e0'); p.box(0, 64, ART_W, 1, '#687078');
    },
    // an office with a window on the North Shore mountains, and a whiteboard
    office(p) {
      p.box(0, 0, ART_W, ART_H, '#8c9cb4');
      p.box(0, 0, ART_W, 2, '#a8b4c8');
      p.box(0, 60, ART_W, 15, '#6c7c98');
      // the window
      const wx = 4, wy = 8, ww = 34, wh = 42;
      p.box(wx - 2, wy - 2, ww + 4, wh + 4, '#e8e8e8'); p.box(wx - 1, wy - 1, ww + 2, wh + 2, '#6c7c98');
      for (let y = 0; y < wh; y++) p.box(wx, wy + y, ww, 1, y < 12 ? '#a8d8f0' : y < 22 ? '#c0e4f4' : '#d8eef8');
      const hills = M(p).poly([[wx, wy + 34], [wx + 8, wy + 22], [wx + 14, wy + 26], [wx + 22, wy + 18], [wx + ww, wy + 28], [wx + ww, wy + wh], [wx, wy + wh]]);
      hills.keep(M(p).box(wx, wy, ww, wh));
      flat(p, hills, '#7898b0');
      flat(p, M(p).poly([[wx + 22, wy + 18], [wx + 18, wy + 21], [wx + 21, wy + 22], [wx + 23, wy + 21], [wx + 26, wy + 22]]), '#f0f8ff');
      for (let y = 2; y < wh; y += 5) p.box(wx, wy + y, ww, 1, '#c8d8e4');
      // the whiteboard, with an air handler sketched on it
      p.box(70, 6, 46, 34, '#d8dce4'); p.box(71, 7, 44, 32, '#f4f6f8'); p.box(70, 40, 46, 2, '#687078');
      for (const [x, y, w, h, c] of [[75, 16, 34, 1, '#3868c8'], [75, 30, 34, 1, '#3868c8'], [75, 16, 1, 15, '#3868c8'], [108, 16, 1, 15, '#3868c8'], [85, 16, 1, 15, '#3868c8'], [97, 16, 1, 15, '#3868c8']]) p.box(x, y, w, h, c);
      arc(p, 91, 23, 4, 0, Math.PI * 2, '#c83838');
      words(p, 'CFM', 76, 9, '#c83838');
    },
    // a cubicle: a fabric wall with a corkboard
    cubicle(p) {
      p.box(0, 0, ART_W, ART_H, '#7c8c98');
      for (let y = 0; y < ART_H; y += 2) for (let x = y % 4 ? 0 : 2; x < ART_W; x += 4) p.set(x, y, '#748490');
      p.box(0, 0, ART_W, 3, '#b0bcc4'); p.box(0, 3, ART_W, 1, '#5c6c78');
      p.box(82, 10, 30, 24, '#8a5a3a'); p.box(83, 11, 28, 22, '#c8986a');
      for (const [x, y, c] of [[86, 14, '#f8f0a0'], [97, 13, '#f8b0b0'], [90, 24, '#b0e0f8'], [102, 23, '#f8f0a0']]) { p.box(x, y, 8, 7, c); p.set(x + 3, y, '#c83838'); }
      p.box(6, 12, 24, 16, '#f4f4f0'); for (let y = 15; y < 26; y += 3) p.box(9, y, 18, 1, '#a8b0b8');
    },
    // out on the road: the mountains, the trees, and a long way to go
    road(p) {
      for (let y = 0; y < 44; y++) p.box(0, y, ART_W, 1, y < 14 ? '#78b8e0' : y < 28 ? '#98cce8' : '#bcdff0');
      flat(p, M(p).poly([[0, 40], [14, 18], [26, 30], [42, 12], [60, 32], [78, 16], [98, 34], [118, 20], [118, 50], [0, 50]]), '#7888a8');
      flat(p, M(p).poly([[42, 12], [36, 19], [41, 18], [44, 21], [49, 19]]), '#f0f6fc');
      flat(p, M(p).poly([[78, 16], [73, 21], [78, 20], [82, 23], [85, 22]]), '#f0f6fc');
      for (let x = -4; x < ART_W; x += 9) flat(p, M(p).poly([[x, 54], [x + 5, 34 + (x * 7 % 5 + 5) % 5], [x + 10, 54]]), (x + 4) % 18 ? '#3c6c48' : '#346040');
      p.box(0, 52, ART_W, 23, '#585c68'); p.box(0, 52, ART_W, 1, '#c8c4a8'); p.box(0, 73, ART_W, 2, '#c8c4a8');
      for (let x = 2; x < ART_W; x += 18) p.box(x, 62, 10, 2, '#f0d860');
    },
    // the plant: racks, columns and warm light coming down
    // (burst: light fanning out behind whatever's in front. u: how far round its loop it is, when it moves)
    plant(p, burst, u = 0) {
      p.box(0, 0, ART_W, ART_H, '#54484c');
      if (burst) rays(p, 60, 36, 16, '#a85c34', 0.18 + u * Math.PI * 2 / 16, 0, 60);
      else rays(p, 18, -20, 26, '#5e5048', 0.1, 0, 60);
      p.box(0, 0, ART_W, 4, '#3c3238');
      for (let x = 10; x < ART_W; x += 34) { p.box(x, 4, 5, 62, '#3e3640'); p.box(x, 4, 1, 62, '#62565a'); }
      for (const y of [18, 38]) { p.box(0, y, ART_W, 2, '#c86838'); p.box(0, y + 2, ART_W, 1, '#2c2630'); }
      const crates = [[18, 7, 11, 11, '#8c7450'], [31, 10, 9, 8, '#7c6c74'], [48, 8, 10, 10, '#94603c'], [62, 6, 9, 12, '#7c7c60'], [84, 7, 12, 11, '#8c7450'], [100, 9, 12, 9, '#6c6c80'],
        [18, 27, 9, 11, '#6c6c80'], [29, 29, 11, 9, '#94603c'], [50, 26, 12, 12, '#8c7450'], [86, 28, 10, 10, '#7c7c60'], [99, 26, 13, 12, '#94603c']];
      for (const [x, y, w, h, c] of crates) { p.box(x, y, w, h, ramp(c).shade); p.box(x, y, w - 1, h - 1, c); p.box(x, y, w - 1, 1, ramp(c).hi); p.box(x + Math.floor(w / 2), y, 1, h, ramp(c).shade); }
      // the floor, and the yellow line along it
      p.box(0, 60, ART_W, 15, '#8c8078'); p.box(0, 60, ART_W, 1, '#2c2630');
      const go = Math.floor(u * 20);
      for (let x = 0; x < ART_W; x++) for (let y = 0; y < 3; y++) p.set(x, 61 + y, (x + y + go) % 10 < 5 ? '#e8b820' : '#282028');
      for (let y = 66; y < ART_H; y += 4) for (let x = (y * 3) % 7 - 13 - Math.floor(u * 26) % 13; x < ART_W; x += 13) p.box(x, y, 4, 1, '#7c7068');
    },
  };

  // ---------- the people and things on the cards ----------
  const FOCUS = {}; // the middle of each picture, for the small card
  const ART = {
    // ---- a starter ----
    student(p) {
      BACKS.cubicle(p);
      const cx = 59, cy = 34;
      person(p, cx, cy, {
        skin: '#e8b890', hair: '#6a3c20', top: '#38a0a0', hairdo: 'short', brow: 'worried', mouth: 'nervous', look: 'wide',
        clothes(q) {
          // a hoodie's strings and a lanyard with a badge
          q.box(cx - 5, cy + 24, 1, 12, '#f0f0f0'); q.box(cx + 5, cy + 24, 1, 9, '#f0f0f0');
          const cord = M(q).line(cx - 10, cy + 22, cx, cy + 38, 1).line(cx + 10, cy + 22, cx, cy + 38, 1);
          flat(q, cord, '#c83838');
          fig(q, M(q).box(cx - 5, cy + 37, 10, 7), '#f4f4f0', { sh: [1, 1], hi: 0 });
          q.box(cx - 3, cy + 39, 3, 3, '#3868c8'); q.box(cx + 1, cy + 39, 2, 1, '#888');
        },
      });
      // a hard hat a size too big, tipping over one eye
      const hat = M(p).ell(cx - 1, cy - 9, 21, 15).box(0, cy - 8, ART_W, 40, 0);
      fig(p, hat, '#f0c020', { sh: [4, 2], hi: [2, 2] });
      fig(p, M(p).poly([[cx - 26, cy - 10], [cx + 24, cy - 6], [cx + 24, cy - 3], [cx - 26, cy - 7]]), '#f0c020', { sh: [0, 1], hi: 0 });
      fig(p, M(p).rbox(cx - 4, cy - 26, 7, 18, 2), '#f8d850', { sh: [1, 0], hi: 0 });
      // and a bead of sweat
      fig(p, M(p).ell(cx + 21, cy + 3, 2, 3).poly([[cx + 19, cy + 2], [cx + 21, cy - 3], [cx + 23, cy + 2]]), '#88d0f8', { sh: 0, hi: [1, 1] });
    },
    // ---- coworkers ----
    dmitriy(p) {
      BACKS.lunch(p);
      const cx = 46, cy = 32, skin = '#f8d8b8', top = '#58a848', white = '#f4f4ee';
      person(p, cx, cy, {
        skin, hair: '#201818', top: white, hairdo: 'under', brow: 'raised', mouth: 'smirk',
        clothes(q, x, y) {
          // his apron, in his green
          const apron = M(q).poly([[x - 17, 80], [x - 15, y + 30], [x - 9, y + 27], [x + 9, y + 27], [x + 15, y + 30], [x + 17, 80]]);
          fig(q, apron, top, { sh: [4, 2], hi: [1, 1] });
          q.box(x - 9, y + 20, 3, 8, ramp(top).shade); q.box(x + 7, y + 20, 3, 8, ramp(top).shade);
          fig(q, M(q).box(x - 9, y + 36, 18, 7), top, { sh: [1, 1], hi: [0, 1] });
        },
      });
      // his chef's hat
      const puff = M(p).ell(cx - 11, cy - 20, 9, 9).ell(cx, cy - 23, 11, 9).ell(cx + 11, cy - 20, 9, 9).box(cx - 15, cy - 20, 30, 8);
      fig(p, puff, white, { sh: [4, 3], hi: 0, deep: 0 });
      fig(p, M(p).rbox(cx - 16, cy - 15, 32, 8, 1), '#fbfbf6', { sh: [0, 2], hi: 0 });
      // a carrot in one hand...
      const carrot = M(p).poly([[cx - 40, 62], [cx - 30, 42], [cx - 22, 47], [cx - 37, 65]]);
      fig(p, M(p).poly([[cx - 26, 44], [cx - 29, 35], [cx - 25, 41]]).poly([[cx - 25, 45], [cx - 21, 36], [cx - 22, 43]]), '#58a848', { sh: 0, hi: 0 });
      fig(p, carrot, '#f07828', { sh: [2, 2], hi: [1, 1] });
      for (const [x, y] of [[-33, 54], [-30, 50], [-35, 58]]) { p.box(cx + x, y, 3, 1, '#c85818'); }
      arm(p, cx - 30, 72, cx - 30, 58, white, skin, 10);
      // ...and his knife up in the other, with the slices flying
      const blade = M(p).poly([[cx + 37, 40], [cx + 39, 8], [cx + 45, 4], [cx + 47, 12], [cx + 46, 40]]);
      fig(p, blade, '#d8e0e8', { sh: [3, 0], hi: [2, 0] });
      fig(p, M(p).box(cx + 37, 40, 9, 10), '#3a2c28', { sh: [2, 0], hi: 0 });
      arm(p, cx + 27, 72, cx + 41, 50, white, skin, 10);
      spark(p, cx + 42, 12, '#ffffff', 4);
      for (const [x, y, r] of [[-22, 12, 3], [23, 22, 3], [27, 8, 2], [61, 20, 3], [63, 42, 2]]) {
        fig(p, M(p).ell(cx + x, y, r), '#f07828', { sh: [1, 1], hi: 0 });
        p.set(cx + x, y, '#f8b878');
      }
    },
    richard(p) {
      BACKS.office(p);
      const cx = 48, cy = 33, skin = '#c08860', top = '#b83028', white = '#f8f8f8';
      person(p, cx, cy, {
        skin, hair: '#201818', top, hairdo: 'sidepart', brow: 'raised', mouth: 'grin',
        clothes(q, x, y) {
          // a white shirt, then the jacket's lapels over it
          const shirt = M(q).poly([[x - 9, y + 19], [x + 9, y + 19], [x + 4, 80], [x - 4, 80]]);
          fig(q, shirt, white, { sh: [1, 0], hi: 0, line: null });
          fig(q, M(q).poly([[x - 11, y + 20], [x - 3, y + 26], [x - 5, 80], [x - 15, 80]]), top, { sh: 0, hi: [1, 1] });
          fig(q, M(q).poly([[x + 11, y + 20], [x + 3, y + 26], [x + 5, 80], [x + 15, 80]]), top, { sh: [2, 0], hi: 0 });
          flat(q, M(q).line(x - 11, y + 22, x - 6, y + 37, 2), ramp(top).hi);
        },
      });
      // up in one hand, the fan wheel he'd like to ask you about
      const hub = [cx + 39, 24];
      fig(p, M(p).ell(hub[0], hub[1], 17), '#9098a8', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).ell(hub[0], hub[1], 14), '#283040');
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.3, b = a + 0.5;
        const blade = M(p).poly([[hub[0] + Math.cos(a) * 3, hub[1] + Math.sin(a) * 3], [hub[0] + Math.cos(a) * 13, hub[1] + Math.sin(a) * 13], [hub[0] + Math.cos(b) * 13, hub[1] + Math.sin(b) * 13]]);
        flat(p, blade, i % 2 ? '#d8f0fc' : '#a8d0ec');
      }
      fig(p, M(p).ell(hub[0], hub[1], 4), '#d08040', { sh: [1, 1], hi: [1, 1] });
      arm(p, cx + 26, 72, cx + 37, 44, top, skin, 10);
    },
    // ---- office things ----
    firedrill(p) {
      p.box(0, 0, ART_W, ART_H, '#5c1820');
      rays(p, 26, 24, 18, '#7c2228', 0.12, 0, 58);
      p.box(0, 58, ART_W, 17, '#2c1420'); p.box(0, 58, ART_W, 1, '#902c30');
      for (let x = 2; x < ART_W; x += 16) p.box(x, 66, 8, 1, '#44202c');
      // the way out, with the daylight coming through
      flat(p, M(p).poly([[90, 58], [116, 58], [118, 75], [66, 75]]), '#b84838');
      p.box(92, 20, 24, 38, '#f8f4c8'); p.box(92, 20, 1, 38, LINE); p.box(92, 19, 24, 1, LINE); p.box(116, 19, 2, 39, '#3a3448');
      p.box(96, 26, 16, 32, '#fffff0');
      fig(p, M(p).rbox(88, 4, 28, 12, 1), '#28b860', { sh: [1, 1], hi: [1, 1] });
      words(p, 'EXIT', 90, 6, '#ffffff');
      // the bell on the wall, going like mad
      fig(p, M(p).box(23, 2, 6, 6), '#4c4458', { sh: 0, hi: 0 });
      fig(p, M(p).ell(26, 24, 18), '#e03830', { sh: [5, 4], hi: [2, 2], deep: [2, 2] });
      fig(p, M(p).ell(26, 24, 12), '#b02028', { sh: 0, hi: 0, line: '#7c1820' });
      fig(p, M(p).ell(20, 18, 4, 3), '#ffb8a0', { sh: 0, hi: 0, line: null });
      fig(p, M(p).ell(26, 24, 4), '#f0c040', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).line(26, 24, 40, 12, 3), '#c8c8d0', { sh: 0, hi: 0 });
      fig(p, M(p).ell(41, 11, 3), '#f0c040', { sh: [1, 1], hi: [1, 1] });
      for (const r of [22, 26]) { arc(p, 26, 24, r, -0.9, -0.1, '#ffe8c0'); arc(p, 26, 24, r, 2.4, 3.0, '#ffe8c0'); }
      // everyone heading out
      const runner = (x, y, top, skin, hair, pants) => {
        fig(p, M(p).line(x - 1, y + 11, x - 7, y + 19, 4), pants, { sh: 0, hi: 0 });
        fig(p, M(p).line(x + 1, y + 11, x + 6, y + 17, 4).line(x + 6, y + 17, x + 5, y + 21, 4), pants, { sh: 0, hi: 0 });
        fig(p, M(p).line(x - 3, y + 5, x - 9, y + 9, 3), top, { sh: 0, hi: 0 });
        fig(p, M(p).rbox(x - 4, y + 2, 9, 11, 2), top, { sh: [2, 1], hi: [1, 1] });
        fig(p, M(p).line(x + 3, y + 5, x + 9, y + 2, 3), top, { sh: 0, hi: 0 });
        fig(p, M(p).ell(x + 1, y - 2, 6), skin, { sh: [2, 1], hi: 0 });
        fig(p, M(p).ell(x, y - 5, 6, 4).box(x - 7, y - 3, 14, 6, 0), hair, { sh: 0, hi: 0 });
        p.set(x + 4, y - 2, LINE); p.set(x + 1, y - 2, LINE);
        p.box(x + 2, y + 1, 2, 1, LINE);
      };
      runner(50, 46, '#3868c8', '#f8d0a8', '#6a3c20', '#303040');
      runner(68, 42, '#e07898', '#c08860', '#201818', '#484858');
      runner(84, 48, '#58a848', '#f8d8b8', '#b87830', '#383848');
      // what they dropped
      for (const [x, y, t] of [[46, 28, 1], [62, 22, -1], [74, 26, 1]]) {
        const sheet = M(p).poly([[x, y + t], [x + 7, y - t], [x + 8, y + 7 - t], [x + 1, y + 8 + t]]);
        fig(p, sheet, '#f4f4ec', { sh: 0, hi: 0 });
        p.box(x + 2, y + 3, 4, 1, '#a0a8b0');
      }
      fig(p, M(p).rbox(55, 34, 6, 7, 1), '#f4f0e0', { sh: [1, 0], hi: 0 });
      p.box(55, 34, 6, 1, '#6a3c20');
      for (const [x, y] of [[59, 31], [62, 29], [64, 33]]) p.set(x, y, '#8a5a3a');
    },
    felix(p) {
      // Felix never moves. This is the sunny spot on Kim's chair they've had since morning.
      p.box(0, 0, ART_W, ART_H, '#8c9cb4');
      flat(p, M(p).poly([[6, 0], [52, 0], [20, 75], [-30, 75]]), '#a8b4c8');
      p.box(0, 0, ART_W, 2, '#a8b4c8');
      fig(p, M(p).rbox(14, 20, 90, 60, 12), '#4c5468', { sh: [5, 3], hi: [2, 2] });
      fig(p, M(p).rbox(6, 52, 106, 30, 10), '#5c6478', { sh: [4, 2], hi: [2, 2] });
      const coat = '#e88a30', dark = '#b85a18', pale = '#f8d8a8';
      // the curled-up cat: back, then tail round the front
      const body = M(p).ell(62, 50, 36, 19).ell(40, 50, 18, 16);
      for (let i = 0; i < 8; i++) body.poly([[34 + i * 7, 34], [38 + i * 7, 28 - (i % 2) * 2], [42 + i * 7, 34]]);
      fig(p, body, coat, { sh: [6, 4], hi: [2, 2], deep: [2, 2] });
      for (const [x, y] of [[66, 36], [76, 38], [86, 42], [58, 35]]) flat(p, M(p).line(x, y, x - 3, y + 8, 2), dark);
      fig(p, M(p).line(92, 60, 66, 66, 8).line(66, 66, 44, 64, 7), coat, { sh: [0, 2], hi: [0, 1] });
      flat(p, M(p).ell(42, 64, 4, 3), pale);
      // the head, on its paws
      const head = M(p).ell(35, 46, 17, 14).poly([[21, 40], [20, 25], [31, 34]]).poly([[49, 40], [50, 25], [39, 34]]);
      fig(p, head, coat, { sh: [4, 3], hi: [1, 1] });
      flat(p, M(p).poly([[23, 36], [23, 30], [28, 35]]), '#f0a0a0');
      flat(p, M(p).poly([[47, 36], [47, 30], [42, 35]]), '#f0a0a0');
      flat(p, M(p).ell(35, 52, 10, 7), pale);
      // eyes shut, a little pink nose, and whiskers
      arc(p, 28, 44, 3.5, 0.2, 2.9, LINE); arc(p, 42, 44, 3.5, 0.2, 2.9, LINE);
      flat(p, M(p).poly([[33, 49], [37, 49], [35, 52]]), '#e07080');
      p.set(35, 53, LINE); p.set(34, 54, LINE); p.set(36, 54, LINE);
      for (const [x, y, a] of [[24, 51, -1], [24, 54, 0], [46, 51, 1], [46, 54, 0]]) for (let i = 0; i < 7; i++) p.set(x + (x < 35 ? -i : i), y + Math.abs(a) * Math.floor(i / 3) * (a < 0 || a > 0 ? -1 : 0), '#f8f0e0');
      fig(p, M(p).ell(26, 62, 6, 4).ell(44, 62, 6, 4), pale, { sh: [1, 1], hi: 0 });
      // zzz
      words(p, 'z', 56, 24, '#f4f8ff', 1); words(p, 'z', 62, 15, '#f4f8ff', 2); words(p, 'Z', 73, 2, '#ffffff', 2);
    },
    // ---- legendaries ----
    officedog(p, u = 0) {
      // a sunny office, with the light fanning out behind them
      p.box(0, 0, ART_W, ART_H, '#d88848');
      rays(p, 59, 30, 20, '#f0a858', 0.05 + u * Math.PI * 2 / 20);
      p.box(0, 66, ART_W, 9, '#b86838');
      const beat = Math.sin(u * Math.PI * 4), b = Math.round(beat), flap = Math.round(beat * 2), blink = u >= 0.5 && u < 0.5625;
      const coat = '#e0a050', ears = '#b87830', chest = '#f0c880';
      // chest fluff, and the collar across it
      fig(p, M(p).ell(59, 86, 40, 36), chest, { sh: [5, 2], hi: [1, 1] });
      fig(p, M(p).poly([[30, 55], [59, 63], [88, 55], [90, 60], [59, 69], [28, 60]]), '#b83028', { sh: [0, 1], hi: [0, 1] });
      // ears at the back, flapping
      const earL = M(p).poly([[37, 12 + b], [24, 16 + b], [17 - flap, 34 + flap], [20 - flap, 50 + flap], [29, 52 + flap], [37, 38 + b]]);
      const earR = M(p).poly([[81, 12 + b], [94, 16 + b], [101 + flap, 34 + flap], [98 + flap, 50 + flap], [89, 52 + flap], [81, 38 + b]]);
      fig(p, earL, ears, { sh: [3, 2], hi: [1, 1] });
      fig(p, earR, ears, { sh: [3, 2], hi: [1, 1] });
      // head
      const head = M(p).ell(59, 28 + b, 25, 22).ell(59, 37 + b, 20, 17);
      fig(p, head, coat, { sh: [6, 4], hi: [2, 2], deep: [2, 2] });
      // a light stripe up the middle of the face
      flat(p, M(p).poly([[55, 8 + b], [63, 8 + b], [66, 30 + b], [52, 30 + b]]), '#eeb868');
      // eyes, big and hopeful
      const pal = { L: LINE, k: '#30201c', b: '#5a3020', h: '#ffffff' };
      const EYE = ['..LLLLL..', '.LkkkkkL.', 'LkhhkkkkL', 'LkhhkbkkL', 'LkkkkbbkL', 'LkkkkkkkL', '.LkkkhkL.', '..LLLLL..'];
      if (blink) { p.box(39, 24 + b, 9, 2, LINE); p.box(70, 24 + b, 9, 2, LINE); } else { p.rows(39, 20 + b, EYE, pal); p.rows(70, 20 + b, EYE, pal); }
      for (const [x, y] of [[38, 18], [39, 17], [40, 17], [41, 17], [71, 17], [72, 17], [73, 17], [74, 18]]) p.set(x, y + b, ramp(coat).deep);
      // the card they've brought you: the back of one of ours, held in their mouth
      fig(p, M(p).poly([[41, 41 + b], [76, 38 + b], [79, 66 + b], [44, 69 + b]]), '#f8f4e0', { sh: [2, 2], hi: 0 });
      flat(p, M(p).poly([[44, 44 + b], [73, 41 + b], [76, 63 + b], [47, 66 + b]]), '#2c3468');
      fig(p, M(p).ell(66, 55 + b, 3).ell(66, 55 + b, 1.5, 1.5, 0), '#e8b030', { sh: 0, hi: 0, line: null });
      fig(p, M(p).ell(60, 55 + b, 6), '#e8b030', { sh: [1, 1], hi: 0, line: null });
      flat(p, M(p).ell(60, 55 + b, 4), '#6a3c20');
      // muzzle over the top of it, and the nose
      fig(p, M(p).ell(59, 38 + b, 16, 11), '#f8dca8', { sh: [4, 3], hi: [1, 1] });
      fig(p, M(p).rbox(52, 27 + b, 14, 9, 4), '#2a1c20', { sh: 0, hi: 0 });
      p.box(55, 28 + b, 4, 2, '#8a7c88'); p.box(54, 29 + b, 2, 1, '#5c5058');
      p.box(58, 36 + b, 2, 4, LINE);
      arc(p, 59, 34 + b, 10, 0.5, 2.6, LINE);
      [[14, 10, 4], [103, 8, 3], [108, 40, 3], [11, 54, 3], [88, 4, 2]].forEach(([x, y, n], i) => {
        spark(p, x, y, '#fff8d0', (u * 2 + i * 0.23) % 1 < 0.5 ? n : 1);
      });
    },
    forklift(p, u = 0) {
      BACKS.plant(p, true, u);
      const tick = Math.floor(u * 16), lift = 12 + Math.round(Math.sin(u * Math.PI * 2) * 4);
      // dust behind it, and smoke from the back
      for (let i = 0; i < 3; i++) {
        const v = (u * 2 + i / 3) % 1;
        fig(p, M(p).ell(8 - v * 12, 62 - v * 6, 2 + v * 3), '#c8c0b8', { sh: [1, 1], hi: 0, line: '#6c6068' });
      }
      for (let i = 0; i < 3; i++) {
        const v = (u + i / 3) % 1;
        fig(p, M(p).ell(4 - v * 4, 33 - v * 26, 1 + v * 3), '#d8d4d0', { sh: [1, 1], hi: 0, line: '#6c6068' });
      }
      p.put(forkliftPic({ wheel: tick % 4, lift }), 0, -(tick % 2));
      [[100, 8, 3], [8, 12, 2], [62, 4, 2]].forEach(([x, y, n], i) => {
        spark(p, x, y, '#fff0b0', (u * 2 + i * 0.31) % 1 < 0.5 ? n : 1);
      });
    },
  };
  // A card with no painting of its own: a person in their colours from the game in front of their
  // department's background, or for a thing, a plain picture of its first letter. It's what keeps every
  // card playable: anything added to ART above takes over from this.
  const WEARS = ['#3868c8', '#b83028', '#58a848', '#e07898', '#808898', '#38a0a0', '#c87830'];
  const SKINS = ['#f8d8b8', '#f8d0a8', '#d8a070', '#c08860', '#8a5838'];
  const HAIRS = ['#201818', '#5a3420', '#8a5a3a', '#6a3c20', '#b87830'];
  const hashOf = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  function whoOf(card) {
    const people = window.PEOPLE || {}, crew = Object.values(window.PLANT_CREW || {}), out = Object.values(window.VISITORS || {});
    return (Object.prototype.hasOwnProperty.call(people, card.name) ? people[card.name] : null) || crew.find((c) => c.name === card.name) || out.find((c) => c.name === card.name) || null;
  }
  const NOT_PEOPLE = ['bigcoil', 'crane', 'truck', 'printer', 'coffeemachine', 'humbug', 'legobrick', 'leftovers'];
  function standIn(p, card) {
    const h = hashOf(card.id), back = BACKS[card.dept] || (card.rarity === 'S' ? BACKS.cubicle : BACKS.office);
    back(p);
    if (card.kind === 'task' || NOT_PEOPLE.includes(card.id)) {
      fig(p, M(p).rbox(39, 13, 40, 50, 3), '#f4f0e0', { sh: [2, 2], hi: 0 });
      words(p, card.name[0], 49, 25, '#3c3448', 4);
      return;
    }
    const who = whoOf(card) || {}, female = who.body === 'female' || (!who.body && h % 3 === 0);
    const cx = 59, cy = 33, top = who.top || WEARS[h % WEARS.length], accent = who.accent || WEARS[(h >>> 3) % WEARS.length];
    person(p, cx, cy, {
      skin: who.skin || SKINS[(h >>> 2) % SKINS.length], hair: who.hair || HAIRS[(h >>> 4) % HAIRS.length], top,
      hairdo: female ? 'long' : h % 2 ? 'short' : 'sidepart', brow: h % 5 === 0 ? 'raised' : '', mouth: ['smile', 'grin', 'smirk'][(h >>> 5) % 3],
      clothes(q, x, y) {
        if (female) { flat(q, M(q).line(x - 8, y + 21, x, y + 30, 1).line(x + 8, y + 21, x, y + 30, 1), accent); fig(q, M(q).ell(x, y + 31, 2), accent, { sh: 0, hi: [1, 1], line: null }); return; }
        fig(q, M(q).poly([[x - 7, y + 20], [x + 7, y + 20], [x + 3, 80], [x - 3, 80]]), '#f4f4f0', { sh: 0, hi: 0, line: null });
        fig(q, M(q).poly([[x - 2, y + 21], [x + 2, y + 21], [x + 3, y + 36], [x, y + 41], [x - 3, y + 36]]), accent, { sh: [1, 0], hi: 0 });
      },
    });
  }

  Object.assign(FOCUS, {
    student: [59, 36], dmitriy: [46, 36], richard: [50, 36], firedrill: [40, 38], felix: [40, 38], officedog: [59, 37], forklift: [40, 37],
  });

  // The forklift by itself, on nothing, as it is on its card and when it drives on. wheel: which way
  // round the wheels have got to (0 to 3). lift: how far up the forks are. tilt: 1 while it brakes.
  const forkliftPics = new Map();
  function forkliftPic({ wheel = 0, lift = 0, tilt = 0 }) {
    const key = wheel + '/' + lift + '/' + tilt;
    let p = forkliftPics.get(key);
    if (p) return p;
    p = Pic(ART_W, ART_H);
    forkliftPics.set(key, p);
    const X = 2, floor = 68, yellow = '#f0a818', steel = '#4c4858', forks = floor - 7 - lift + tilt * 2;
    const m = () => M(p);
    // the mast at the front
    fig(p, m().box(X + 72, 3 + tilt, 4, floor - 9 - tilt), steel, { sh: [1, 0], hi: [1, 0] });
    fig(p, m().box(X + 78, 3 + tilt, 3, floor - 9 - tilt), steel, { sh: [1, 0], hi: [1, 0] });
    p.box(X + 77, 3 + tilt, 1, floor - 9 - tilt, '#9c98a8');
    fig(p, m().box(X + 71, 2 + tilt, 11, 3), steel, { sh: 0, hi: [0, 1] });
    // the load: one of the big coils, copper fins in a steel case, on a pallet
    const top = forks - 25, lx = X + 86, lw = 26;
    fig(p, m().rbox(lx, top, lw, 22, 1), '#a0a8b8', { sh: [2, 2], hi: [1, 1] });
    p.box(lx + 3, top + 3, lw - 6, 16, '#a85c28');
    for (let x = lx + 3; x < lx + lw - 3; x += 2) p.box(x, top + 3, 1, 16, '#e09048');
    for (const y of [top + 7, top + 11, top + 15]) p.box(lx + 3, y, lw - 6, 1, '#6c3818');
    fig(p, m().box(lx - 2, forks - 3, lw + 4, 3), '#a87848', { sh: [0, 1], hi: [0, 1] });
    for (const x of [lx, lx + 11, lx + 22]) p.box(x, forks - 1, 4, 1, LINE);
    // the forks and what carries them
    fig(p, m().box(X + 82, forks - 16, 3, 18), '#383440', { sh: 0, hi: [1, 0] });
    fig(p, m().poly([[X + 82, forks], [X + 115, forks + 1], [X + 115, forks + 2], [X + 82, forks + 3]]), '#585464', { sh: 0, hi: [0, 1] });
    // the driver's cage, behind them
    const cage = m().line(X + 19, 36, X + 22, 4, 3);
    fig(p, cage, '#383440', { sh: 0, hi: [1, 0] });
    // the driver: flannel, a beard and a toque
    const dy = 4;
    fig(p, m().rbox(X + 14, 18 + dy, 8, 18, 2), '#3c3440', { sh: [1, 1], hi: 0 });
    fig(p, m().rbox(X + 24, 24 + dy, 19, 13, 4), '#c83830', { sh: [4, 2], hi: [1, 1] });
    for (let i = 0; i < 4; i++) p.box(X + 25 + i * 5, 25 + dy, 1, 11, '#2c2028');
    for (let j = 0; j < 2; j++) p.box(X + 25, 28 + dy + j * 5, 17, 1, '#2c2028');
    const skin = skinRamp('#f0c098');
    fig(p, m().ell(X + 34, 16 + dy, 9), skin, { sh: [3, 2], hi: [1, 1] });
    fig(p, m().ell(X + 34, 22 + dy, 9, 6).box(X + 24, 13 + dy, 22, 6, 0), '#8a4a20', { sh: [2, 1], hi: 0 }); // the beard
    p.box(X + 34, 21 + dy, 5, 1, '#c88070');
    p.rows(X + 36, 13 + dy, ['LL', 'Lw', 'LL'], { L: LINE, w: '#ffffff' });
    fig(p, m().ell(X + 33, 9 + dy, 10, 7).box(X + 22, 11 + dy, 22, 8, 0), '#3868c8', { sh: [2, 1], hi: [1, 1] }); // the toque
    fig(p, m().box(X + 23, 9 + dy, 20, 3), '#f4f0e0', { sh: 0, hi: 0 });
    for (let x = 0; x < 20; x += 3) p.box(X + 24 + x, 9 + dy, 1, 3, '#c83830');
    // the wheel in their hands
    fig(p, m().line(X + 40, 34, X + 52, 29, 5), '#c83830', { sh: [0, 1], hi: 0 });
    fig(p, m().ell(X + 54, 29, 3), skin, { sh: [1, 1], hi: 0 });
    fig(p, m().line(X + 50, 24, X + 59, 37, 2), '#2c2830', { sh: 0, hi: 0 });
    // the roof over them
    fig(p, m().line(X + 22, 3, X + 63, 3, 3), '#383440', { sh: 0, hi: [0, 1] });
    fig(p, m().line(X + 63, 3, X + 68, 40, 3), '#383440', { sh: [1, 0], hi: [1, 0] });
    // the body
    const body = m().poly([[X + 3, 58], [X + 3, 38], [X + 8, 34], [X + 18, 34], [X + 24, 40], [X + 52, 40], [X + 56, 36], [X + 70, 36], [X + 71, 58]]);
    fig(p, body, yellow, { sh: [4, 3], hi: [2, 2], deep: [2, 1] });
    // the weight at the back, and a stripe
    fig(p, m().rbox(X + 1, 42, 18, 16, 2), '#3c3844', { sh: [2, 2], hi: [1, 1] });
    for (let i = 0; i < 4; i++) p.box(X + 4, 45 + i * 3, 12, 1, '#585464');
    for (let x = X + 22; x < X + 68; x++) for (let y = 44; y < 47; y++) p.set(x, y, (x + y) % 8 < 4 ? '#282028' : '#f8d850');
    p.set(X + 69, 40, '#fff8c0'); p.box(X + 66, 39, 4, 3, '#fff8c0'); p.box(X + 66, 39, 4, 1, '#ffffff');
    // the wheels, turning
    const wheelAt = (cx, cy, r) => {
      fig(p, m().ell(cx, cy, r), '#2c2830', { sh: [2, 2], hi: [1, 1] });
      fig(p, m().ell(cx, cy, r * 0.55), '#c8ccd8', { sh: [1, 1], hi: [1, 1] });
      for (let i = 0; i < 4; i++) {
        const a = (i + wheel / 4) * Math.PI / 2;
        p.box(cx + Math.cos(a) * r * 0.32 - 1, cy + Math.sin(a) * r * 0.32 - 1, 2, 2, '#585464');
      }
      p.box(cx - 1, cy - 1, 2, 2, LINE);
    };
    wheelAt(X + 14, floor - 8, 8);
    wheelAt(X + 56, floor - 10, 10);
    return p;
  }

  // ---------- the card ----------
  const DEPTS = {
    plant: { name: 'PLANT', c: '#d87830' },
    road: { name: 'ROAD', c: '#c84038' },
    office: { name: 'OFFICE', c: '#3868c8' },
    lunch: { name: 'LUNCH ROOM', c: '#48a048' },
    none: { name: 'OFFICE THING', c: '#74748c' },
    starter: { name: 'STARTER', c: '#a09880' },
  };
  const deptOf = (card) => DEPTS[card.dept] || (card.rarity === 'S' ? DEPTS.starter : DEPTS.none);
  const INK = '#2a2230';
  const GOLD = '#e8b030', SILVER = '#b8c4d4';
  // the small colour a card's rarity is marked with, and the line round its art
  const RARITY = {
    S: { trim: '#3c3440', gem: null },
    C: { trim: '#2c2830', gem: '#c8c4bc' },
    U: { trim: SILVER, gem: '#a8d0f0' },
    R: { trim: GOLD, gem: '#f0c040' },
    L: { trim: GOLD, gem: '#ff9830' },
  };
  // Letters at the size the game draws them, on a picture at full screen size: the same smoothed
  // letters as everything else in the game. Starting at x, each 12 across. size 2 is the big numbers.
  function letters(p, str, x, y, c, size = 1) {
    let cx = x;
    const v = C(c);
    for (const ch of String(str)) {
      const g = FONT.glyphs2[ch] || FONT.glyphs2['?'];
      g.forEach((row, j) => [...row].forEach((on, i) => {
        if (on !== '1') return;
        for (let b = 0; b < size; b++) for (let a = 0; a < size; a++) {
          const X = cx + i * size + a, Y = y + j * size + b;
          if (X >= 0 && Y >= 0 && X < p.w && Y < p.h) p.px[Y * p.w + X] = v;
        }
      }));
      cx += FONT.ADV * 2 * size;
    }
  }
  const wide = (str, size = 1) => String(str).length * 12 * size - 2 * size;
  // a number with a dark edge, readable on anything
  function number(p, n, cx, cy, size = 2, c = '#ffffff') {
    const x = Math.round(cx - wide(n, size) / 2), y = Math.round(cy - 7 * size);
    for (const [i, j] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) letters(p, n, x + i, y + j, LINE, size);
    letters(p, n, x, y, c, size);
  }
  // Splits a card's words into lines of at most `n` letters. A word in *stars* is a rule word, shown
  // in its own colour. (A test checks every card's words fit.)
  function wrap(str, n) {
    const lines = [];
    let line = [], len = 0;
    for (const word of str.split(' ')) {
      const size = word.replace(/\*/g, '').length;
      if (len && len + 1 + size > n) { lines.push(line); line = []; len = 0; }
      line.push(word); len += (len ? 1 : 0) + size;
    }
    if (line.length) lines.push(line);
    return lines;
  }
  function burst(m, cx, cy, r0, r1, n) { // a star shape, for Power
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? r0 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return m.poly(pts);
  }
  // A coffee cup, the cost of the card.
  function cup(p, cx, cy, r) {
    fig(p, M(p).ell(cx + r - 1, cy, r * 0.48).ell(cx + r - 1, cy, r * 0.22, r * 0.22, 0), '#f4ecd8', { sh: 0, hi: 0 });
    fig(p, M(p).ell(cx, cy, r), '#f4ecd8', { sh: [2, 2], hi: 0 });
    fig(p, M(p).ell(cx, cy, r - 2.5), '#6a3c20', { sh: 0, hi: 0, line: null });
    flat(p, M(p).ell(cx - 1, cy - 1, r - 4), '#8a5430');
  }
  // the whole card at half size, without its words
  function cardShell(card) {
    const p = Pic(130, 182), dept = deptOf(card), rar = RARITY[card.rarity] || RARITY.C, legend = card.rarity === 'L', rare = card.rarity === 'R';
    const m = () => M(p);
    const shell = m().rbox(1, 1, 128, 180, 8);
    fig(p, shell, legend ? GOLD : dept.c, { sh: [3, 3], hi: [2, 2], deep: [1, 1] });
    if (legend) { // a darker bed inside the gold, in its department's colour
      flat(p, m().rbox(4, 4, 122, 174, 6), ramp(GOLD).deep);
      flat(p, m().rbox(5, 5, 120, 172, 5), ramp(dept.c).deep);
      for (let y = 6; y < 176; y += 4) for (let x = 6 + (y % 8 ? 2 : 0); x < 124; x += 4) p.set(x, y, ramp(dept.c).shade);
    }
    // the art, in its trim
    fig(p, m().box(6, 22, ART_W, ART_H), rar.trim, { sh: 0, hi: 0, line: LINE });
    flat(p, m().box(5, 21, 120, 77), rar.trim);
    p.put(artPic(card.art || card.id), 6, 22);
    if (rare || card.rarity === 'U' || legend) { // rivets on the trim's corners
      for (const [x, y] of [[5, 21], [124, 21], [5, 97], [124, 97]]) p.box(x, y, 1, 1, '#ffffff');
    }
    // the name
    fig(p, m().rbox(25, 5, 100, 14, 3), legend ? '#2a2030' : '#f4ecd8', { sh: legend ? 0 : [1, 1], hi: 0, line: legend || rare ? GOLD : LINE });
    // the ribbon with the department on it
    fig(p, m().rbox(13, 96, 104, 12, 2), legend ? ramp(GOLD).shade : ramp(dept.c).shade, { sh: 0, hi: [0, 1] });
    // the words
    fig(p, m().rbox(8, 110, 114, 54, 3), '#f4ecd8', { sh: [1, 1], hi: 0 });
    // gold round the words, for rare cards and up, and stars either side of a legendary's ribbon
    if (rare || legend) flat(p, m().rbox(7, 109, 116, 56, 3).rbox(8, 110, 114, 54, 3, 0), GOLD);
    if (legend) {
      for (const [x, y] of [[8, 102], [122, 102]]) { fig(p, burst(m(), x, y, 2, 6, 4), '#fff0b0', { sh: 0, hi: 0 }); }
      fig(p, burst(m(), 65, 171, 6, 11, 8), GOLD, { sh: [1, 1], hi: [1, 1] });
    }
    // bottom corners for rare cards and up
    if (rare || legend) {
      for (const [x, y] of [[3, 172], [122, 172], [3, 3], [122, 3]]) fig(p, m().rbox(x, y, 5, 5, 1), GOLD, { sh: [1, 1], hi: [1, 1] });
    }
    if (rar.gem) {
      const big = legend ? 7 : rare ? 6 : 5, cx = 65, cy = 171;
      fig(p, m().poly([[cx, cy - big], [cx + big, cy], [cx, cy + big], [cx - big, cy]]), rar.gem, { sh: [2, 2], hi: [1, 1] });
    }
    // what it costs
    cup(p, 15, 14, 11);
    // its Power and Patience (a task has neither)
    if (card.kind !== 'task') {
      fig(p, burst(m(), 17, 168, 9, 13, 8), '#e04838', { sh: [2, 2], hi: [1, 1] });
      fig(p, m().ell(113, 168, 12), '#38a0a8', { sh: [2, 2], hi: [1, 1] });
    }
    return p;
  }
  // The big card: 260 x 364, the size you read it at.
  const bigs = new Map();
  function big(card) {
    let p = bigs.get(card.id);
    if (p) return p;
    p = Pic(260, 364);
    bigs.set(card.id, p);
    p.put(cardShell(card), 0, 0, 2);
    const dept = deptOf(card), legend = card.rarity === 'L';
    letters(p, card.name, Math.round(150 - wide(card.name) / 2), 18, legend ? GOLD : INK);
    const label = card.kind === 'task' ? 'TASK' : dept.name;
    letters(p, label, Math.round(130 - wide(label) / 2), 197, legend ? '#2a2030' : '#ffffff');
    // the rule, then in a quieter colour what they said
    let y = 228;
    for (const line of wrap(card.text || '', 18)) {
      const size = line.join(' ').replace(/\*/g, '').length;
      let x = Math.round(130 - (size * 12 - 2) / 2);
      for (const word of line) {
        const key = word.includes('*'), plain = word.replace(/\*/g, '');
        letters(p, plain, x, y, key ? '#b02820' : INK);
        x += (plain.length + 1) * 12;
      }
      y += 19;
    }
    if (card.said) {
      y += 3;
      for (const line of wrap(card.said, 18)) {
        const s = line.join(' ');
        letters(p, s, Math.round(130 - wide(s) / 2), y, '#8a7c68');
        y += 18;
      }
    }
    number(p, card.cost, 29, 28, 2);
    if (card.kind !== 'task') {
      number(p, card.power, 34, 336, 2);
      number(p, card.patience, 226, 336, 2);
    }
    return p;
  }
  // The small card, 88 x 116, as it sits on the table. o: { power, patience } to show instead of
  // what's printed, { hurt: true, up: true } to colour Patience that's down or Power that's up, and
  // { cost: true } to show what it costs, in your hand.
  function small(card, o = {}) {
    const half = Pic(44, 58), dept = deptOf(card), rar = RARITY[card.rarity] || RARITY.C, legend = card.rarity === 'L';
    fig(half, Mask(44, 58).rbox(1, 1, 42, 56, 4), legend ? GOLD : dept.c, { sh: [2, 2], hi: [1, 1] });
    flat(half, Mask(44, 58).box(3, 3, 38, 38), rar.trim);
    if (card.kind !== 'task') {
      fig(half, burst(Mask(44, 58), 11, 47, 6, 9, 7), '#e04838', { sh: [1, 1], hi: [1, 1] });
      fig(half, Mask(44, 58).ell(33, 47, 8), '#38a0a8', { sh: [1, 1], hi: [1, 1] });
    } else {
      flat(half, Mask(44, 58).rbox(4, 42, 36, 12, 2), ramp(dept.c).deep);
    }
    const p = Pic(88, 116);
    p.put(half, 0, 0, 2);
    // the art at half the size it is on a big card, so a whole face fits
    const art = artPic(card.art || card.id), [x0, y0] = cropOf(card.art || card.id);
    for (let j = 0; j < 72; j++) for (let i = 0; i < 72; i++) p.px[(8 + j) * 88 + 8 + i] = art.px[(y0 + j) * art.w + x0 + i] || C('#20202c');
    if (o.cost) { const coin = Pic(44, 58); cup(coin, 8, 8, 7); p.put(coin, 0, 0, 2); }
    if (card.kind !== 'task') {
      number(p, o.power === undefined ? card.power : o.power, 22, 95, 2, o.up ? '#90f070' : '#ffffff');
      number(p, o.patience === undefined ? card.patience : o.patience, 66, 95, 2, o.hurt ? '#ff9078' : '#ffffff');
    } else letters(p, 'TASK', 21, 88, '#ffffff');
    if (o.cost) number(p, card.cost, 16, 16, 1);
    return p;
  }
  // The back of a card: a cup on navy, in gold.
  let backPic = null;
  function back() {
    if (backPic) return backPic;
    const half = Pic(44, 58), m = () => Mask(44, 58);
    fig(half, m().rbox(1, 1, 42, 56, 4), '#2c3468', { sh: [2, 2], hi: [1, 1] });
    flat(half, m().rbox(4, 4, 36, 50, 3), GOLD);
    flat(half, m().rbox(5, 5, 34, 48, 2), '#20264c');
    for (let y = 6; y < 52; y += 4) for (let x = 6 + (y % 8 ? 2 : 0); x < 38; x += 4) half.set(x, y, '#343c74');
    fig(half, m().ell(26, 29, 4).ell(26, 29, 2, 2, 0), GOLD, { sh: 0, hi: 0 });
    fig(half, m().ell(21, 29, 9), GOLD, { sh: [2, 2], hi: [1, 1] });
    flat(half, m().ell(21, 29, 6), '#6a3c20');
    flat(half, m().ell(20, 28, 4), '#8a5430');
    backPic = Pic(88, 116);
    backPic.put(half, 0, 0, 2);
    return backPic;
  }
  const arts = new Map();
  function artPic(id) {
    let p = arts.get(id);
    if (!p) {
      p = Pic(ART_W, ART_H);
      if (ART[id]) ART[id](p);
      else standIn(p, (window.CARD_LIST || []).find((c) => c.id === id) || { id, name: '?', kind: 'task' });
      arts.set(id, p);
    }
    return p;
  }

  // ---------- on a screen ----------
  function toCanvas(pic) {
    const cv = document.createElement('canvas');
    cv.width = pic.w; cv.height = pic.h;
    const c = cv.getContext('2d'), img = c.createImageData(pic.w, pic.h);
    new Uint32Array(img.data.buffer).set(pic.px);
    c.putImageData(img, 0, 0);
    return cv;
  }
  // Light running across a card lying at x, y (w x h on the screen). t counts frames. Rare cards get a
  // gold glint now and then; legendaries a slower band with colours in it, and twinkles.
  function shine(ctx, x, y, w, h, t, rarity, corner = 14) {
    if (rarity !== 'R' && rarity !== 'L') return;
    const legend = rarity === 'L', period = legend ? 150 : 210, at = (t % period) / period;
    const span = w + h + 60, pos = -30 + at * span * (legend ? 1 : 1.4);
    const bands = legend
      ? [[0, 8, 'rgba(255,120,120,0.22)'], [8, 8, 'rgba(255,230,120,0.34)'], [16, 10, 'rgba(255,255,255,0.5)'], [26, 8, 'rgba(120,240,220,0.3)'], [34, 8, 'rgba(160,160,255,0.22)']]
      : [[0, 6, 'rgba(255,240,180,0.3)'], [6, 10, 'rgba(255,255,255,0.45)'], [16, 6, 'rgba(255,240,180,0.3)']];
    for (let j = 0; j < h; j += 2) {
      const inset = j < corner ? corner - j : j > h - corner ? corner - (h - j) : 0, k = Math.max(0, Math.round(inset * 0.4 / 2) * 2);
      for (const [a, b, c] of bands) {
        const x0 = Math.max(k, Math.round(pos + a - j / 1.2)), x1 = Math.min(w - k, x0 + b);
        if (x1 > x0) { ctx.fillStyle = c; ctx.fillRect(x + x0, y + j, x1 - x0, 2); }
      }
    }
    if (legend) {
      for (let i = 0; i < 5; i++) {
        const phase = (t + i * 37) % 80, px = 20 + (i * 97) % (w - 40), py = 20 + (i * 61) % (h - 40);
        if (phase < 24) {
          const n = phase < 8 || phase > 16 ? 2 : 4;
          ctx.fillStyle = '#fff8d0';
          ctx.fillRect(x + px - n * 2, y + py, n * 4 + 2, 2); ctx.fillRect(x + px, y + py - n * 2, 2, n * 4 + 2);
        }
      }
    }
  }
  const CAN = new WeakMap();
  const canvasOf = (pic) => { let c = CAN.get(pic); if (!c) { c = toCanvas(pic); CAN.set(pic, c); } return c; };
  // A legendary is alive: its art keeps moving, wherever you see it. frames: how many pictures in
  // its loop. every: how many ticks each one lasts. Its painter in ART gets how far round it is, 0 to 1.
  const LIVE = { forklift: { frames: 16, every: 3 }, officedog: { frames: 16, every: 5 } };
  const liveFrames = new Map();
  function artFrame(id, t) {
    const live = LIVE[id];
    if (!live) return artPic(id);
    const n = Math.floor(t / live.every) % live.frames, key = id + '/' + n;
    let p = liveFrames.get(key);
    if (!p) {
      p = Pic(ART_W, ART_H);
      ART[id](p, n / live.frames);
      liveFrames.set(key, p);
    }
    return p;
  }
  // the top left of the part of a card's art the small card shows, 72 x 72
  function cropOf(id) {
    const [fx, fy] = FOCUS[id] || [59, 37];
    return [Math.max(0, Math.min(ART_W - 72, fx - 36)), Math.max(0, Math.min(ART_H - 72, fy - 36))];
  }
  // some words by themselves, in the game's letters
  function label(str, c, size = 1) {
    const p = Pic(Math.max(1, wide(str, size)), 18 * size); // (18: room for the tails on g, p and y)
    letters(p, str, 0, 0, c, size);
    return p;
  }

  return { ART_W, ART_H, LIVE, Pic, big, small, back, artPic, artFrame, cropOf, label, toCanvas, canvasOf, shine, RARITY, DEPTS };
})();
