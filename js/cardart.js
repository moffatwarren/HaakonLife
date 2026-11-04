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
        for (let i = 0; i <= n; i++) {
          const X = x0 + (x1 - x0) * i / n, Y = y0 + (y1 - y0) * i / n;
          if (t <= 1) row(Y, X, X + 1, v); else m.ell(X, Y, t / 2, t / 2, v);
        }
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
    const EYE = o.look === 'wide' ? ['.LLLL.', 'LwwwwL', 'wweeww', 'wwehww', 'wweeww', '.wwww.']
      : o.look === 'shut' ? ['.....', '.LLL.', 'L...L', '.....']
        : o.look === 'tired' ? ['sssss', 'LLLLL', 'weehw', 'sLLLs']
          : o.look === 'side' ? ['LLLLL', 'wweeh', 'wweee', 'sLLLs']
            : ['LLLLL', 'weehw', 'weeew', 'sLLLs'];
    const EY = cy + (o.look === 'wide' ? -1 : 1), wd = EYE[0].length;
    p.rows(cx - 8 - (wd - 5), EY, EYE, pal);
    p.rows(cx + 4, EY, EYE, pal);
    // eyebrows
    const left = o.brow === 'worried' ? [[-9, 0], [-8, -1], [-7, -1], [-6, -2], [-5, -2]]
      : o.brow === 'angry' ? [[-9, -3], [-8, -3], [-7, -2], [-6, -1], [-5, 0]]
        : [[-9, -1], [-8, -2], [-7, -2], [-6, -2], [-5, -1]];
    const right = o.brow === 'raised' ? [[4, -3], [5, -4], [6, -4], [7, -4], [8, -3]]
      : o.brow === 'worried' ? [[4, -2], [5, -2], [6, -1], [7, -1], [8, 0]]
        : o.brow === 'angry' ? [[4, 0], [5, -1], [6, -2], [7, -3], [8, -3]]
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
    } else if (o.mouth === 'open') {
      p.rows(cx - 5, y - 2, ['.LLLLLLLLL.', 'LwwwwwwwwwL', 'LrrrrrrrrrL', 'LrrrrrrrrrL', '.LrrrrrrrL.', '..LLLLLLL..'], { L: LINE, w: '#f8f8f4', r: '#a83038' });
    } else if (o.mouth === 'flat') {
      p.box(cx - 5, y + 1, 11, 1, LINE);
    } else if (o.mouth === 'o') {
      p.rows(cx - 2, y - 1, ['.LLL.', 'LrrrL', 'LrrrL', '.LLL.'], { L: LINE, r: '#a83038' });
    } else {
      p.rows(cx - 5, y, ['L.........L', '.LLLLLLLLL.'], { L: LINE });
      p.box(cx - 3, y + 2, 7, 1, skin.shade);
    }
  }
  function person(p, cx, cy, o) {
    const skin = skinRamp(o.skin);
    if (o.hairdo === 'long' || o.hairdo === 'curls') fig(p, M(p).rbox(cx - 21, cy - 6, 42, 42, 10), o.hair, { sh: [3, 2], hi: 0 });
    if (o.hairdo === 'bob') fig(p, M(p).rbox(cx - 20, cy - 6, 40, 26, 8), o.hair, { sh: [3, 2], hi: 0 });
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
    if (o.beard) fig(p, M(p).poly([[cx - 16, cy + 2], [cx - 14, cy + 15], [cx - 7, cy + 21], [cx + 7, cy + 21], [cx + 14, cy + 15], [cx + 16, cy + 2], [cx + 11, cy + 8], [cx + 6, cy + 10], [cx - 6, cy + 10], [cx - 11, cy + 8]]), o.beard, { sh: [2, 2], hi: 0, line: null });
    face(p, cx, cy, o);
    if (o.stache) fig(p, M(p).poly([[cx - 8, cy + 12], [cx - 5, cy + 9], [cx, cy + 10], [cx + 5, cy + 9], [cx + 8, cy + 12], [cx + 3, cy + 12], [cx, cy + 11], [cx - 3, cy + 12]]), o.stache, { sh: [0, 1], hi: 0, line: null });
    HAIRDOS[o.hairdo || 'short'](p, cx, cy, o.hair);
    if (o.specs) specs(p, cx, cy, o.specs);
  }
  // an arm from the shoulder to a hand, over whatever's already there
  function arm(p, x0, y0, x1, y1, sleeve, skin, t = 9) {
    fig(p, M(p).line(x0, y0, x1, y1, t), sleeve, { sh: [3, 2], hi: [1, 1] });
    fig(p, M(p).ell(x1, y1, t / 2 + 0.5), skinRamp(skin), { sh: [2, 2], hi: [1, 1] });
  }

  // ---------- more hair, what goes on heads and over shirts, and a little person ----------
  Object.assign(HAIRDOS, {
    // right down to the skull
    buzz(p, cx, cy, hair) {
      const m = M(p).ell(cx, cy - 5, 17, 12);
      m.poly([[cx - 15, cy + 12], [cx - 15, cy - 6], [cx - 6, cy - 10], [cx + 6, cy - 10], [cx + 15, cy - 6], [cx + 15, cy + 12]], 0);
      fig(p, m, hair, { sh: [1, 1], hi: 0 });
    },
    // a big tumble of curls on top (curls hang down at the back too: see person)
    curly(p, cx, cy, hair) {
      const m = M(p);
      for (let i = -3; i <= 3; i++) m.ell(cx + i * 5.5, cy - 10 - (3 - Math.abs(i)) * 2.2, 6);
      m.ell(cx - 17, cy - 2, 5); m.ell(cx + 17, cy - 2, 5);
      m.poly([[cx - 14, cy + 12], [cx - 14, cy - 4], [cx - 8, cy - 8], [cx + 8, cy - 8], [cx + 14, cy - 4], [cx + 14, cy + 12]], 0);
      fig(p, m, hair, { sh: [2, 2], hi: [1, 1] });
    },
    curls(p, cx, cy, hair) { HAIRDOS.curly(p, cx, cy, hair); },
    // standing straight up
    spiky(p, cx, cy, hair) {
      const m = M(p).ell(cx, cy - 6, 17, 11);
      for (let i = 0; i < 7; i++) m.poly([[cx - 17 + i * 5, cy - 10], [cx - 14 + i * 5, cy - 23 - (i % 2) * 3], [cx - 10 + i * 5, cy - 10]]);
      m.poly([[cx - 14, cy + 12], [cx - 14, cy - 3], [cx - 7, cy - 7], [cx + 7, cy - 7], [cx + 14, cy - 3], [cx + 14, cy + 12]], 0);
      fig(p, m, hair, { sh: [2, 2], hi: [1, 1] });
    },
    // swept up and over at the front
    quiff(p, cx, cy, hair) {
      HAIRDOS.short(p, cx, cy, hair);
      fig(p, M(p).ell(cx + 2, cy - 16, 15, 7).ell(cx + 9, cy - 13, 8, 6), hair, { sh: [2, 2], hi: [2, 2] });
    },
    // tied up on top
    bun(p, cx, cy, hair) {
      fig(p, M(p).ell(cx, cy - 23, 8, 7), hair, { sh: [2, 2], hi: [1, 1] });
      HAIRDOS.sidepart(p, cx, cy, hair);
    },
    // tied back, with the end showing over one shoulder
    ponytail(p, cx, cy, hair) {
      fig(p, M(p).line(cx + 15, cy - 3, cx + 21, cy + 20, 7), hair, { sh: [2, 1], hi: 0 });
      HAIRDOS.sidepart(p, cx, cy, hair);
    },
    bob(p, cx, cy, hair) { HAIRDOS.long(p, cx, cy, hair); },
    // nothing up there but a shine, and a bit round the sides
    bald(p, cx, cy, hair) {
      fig(p, M(p).ell(cx - 15, cy - 1, 3, 5).ell(cx + 15, cy - 1, 3, 5), hair, { sh: 0, hi: 0 });
      for (const [x, y] of [[-8, -12], [-7, -13], [-6, -13], [-5, -14], [-4, -14], [-3, -14]]) p.set(cx + x, cy + y, '#fff8e8');
    },
  });
  function specs(p, cx, cy, c) {
    for (const x of [-6, 6]) { arc(p, cx + x, cy + 3, 5.5, 0, Math.PI * 2, c); arc(p, cx + x, cy + 3, 4.8, 3.6, 5, '#ffffff'); }
    p.box(cx - 1, cy + 2, 2, 1, c);
    p.box(cx - 16, cy + 2, 5, 1, c); p.box(cx + 11, cy + 2, 5, 1, c);
  }
  // goggles that go right the way round, shining
  function goggles(p, cx, cy, c = '#a8e0f0') {
    fig(p, M(p).rbox(cx - 16, cy - 3, 32, 10, 3), c, { sh: [1, 1], hi: [1, 1] });
    p.box(cx - 11, cy, 2, 3, LINE); p.box(cx + 6, cy, 2, 3, LINE); p.box(cx - 1, cy + 3, 2, 4, ramp(c).shade);
    p.box(cx - 13, cy - 1, 6, 1, '#ffffff'); p.box(cx + 3, cy - 1, 6, 1, '#ffffff');
  }
  function hardHat(p, cx, cy, c = '#f0c020') {
    fig(p, M(p).ell(cx, cy - 9, 20, 15).box(0, cy - 8, ART_W, 40, 0), c, { sh: [4, 2], hi: [2, 2] });
    fig(p, M(p).rbox(cx - 25, cy - 10, 50, 4, 2), c, { sh: [0, 1], hi: 0 });
    fig(p, M(p).rbox(cx - 3, cy - 24, 7, 15, 2), ramp(c).hi, { sh: [1, 0], hi: 0 });
  }
  // way: which way the peak points
  function ballCap(p, cx, cy, c, way = 1) {
    fig(p, M(p).poly([[cx + way * 8, cy - 10], [cx + way * 30, cy - 7], [cx + way * 30, cy - 4], [cx + way * 8, cy - 6]]), ramp(c).shade, { sh: 0, hi: 0 });
    fig(p, M(p).ell(cx, cy - 9, 18, 13).box(0, cy - 8, ART_W, 40, 0), c, { sh: [3, 2], hi: [2, 2] });
    p.set(cx, cy - 22, ramp(c).hi);
  }
  function headband(p, cx, cy, c) {
    fig(p, M(p).rbox(cx - 17, cy - 11, 34, 6, 1), c, { sh: [0, 1], hi: [0, 1] });
    fig(p, M(p).line(cx + 15, cy - 8, cx + 23, cy - 2, 2).line(cx + 15, cy - 8, cx + 24, cy - 6, 2), c, { sh: 0, hi: 0 });
  }
  function headset(p, cx, cy, c = '#2c2c3c') {
    arc(p, cx, cy - 2, 19, Math.PI, Math.PI * 2, c); arc(p, cx, cy - 2, 18, Math.PI, Math.PI * 2, c);
    fig(p, M(p).rbox(cx - 21, cy - 2, 6, 11, 2).rbox(cx + 15, cy - 2, 6, 11, 2), c, { sh: 0, hi: [1, 1] });
    flat(p, M(p).line(cx - 18, cy + 8, cx - 8, cy + 15, 1), c);
    fig(p, M(p).ell(cx - 7, cy + 15, 2), c, { sh: 0, hi: 0, line: null });
  }
  // a tie, on a white shirt with an open jacket either side if you give a colour for one
  function tie(q, x, y, c, jacket) {
    fig(q, M(q).poly([[x - 9, y + 19], [x + 9, y + 19], [x + 5, 80], [x - 5, 80]]), '#f4f4f0', { sh: 0, hi: 0, line: null });
    fig(q, M(q).poly([[x - 3, y + 21], [x + 3, y + 21], [x + 4, y + 36], [x, y + 43], [x - 4, y + 36]]), c, { sh: [1, 0], hi: 0 });
    if (!jacket) return;
    fig(q, M(q).poly([[x - 11, y + 20], [x - 4, y + 26], [x - 6, 80], [x - 16, 80]]), jacket, { sh: 0, hi: [1, 1] });
    fig(q, M(q).poly([[x + 11, y + 20], [x + 4, y + 26], [x + 6, 80], [x + 16, 80]]), jacket, { sh: [2, 0], hi: 0 });
  }
  // a hi-vis vest, over whatever's under it
  function hiVis(q, x, y, c = '#d8e820') {
    fig(q, M(q).poly([[x - 26, y + 26], [x - 9, y + 20], [x - 3, y + 30], [x - 3, 80], [x - 28, 80]]), c, { sh: [1, 1], hi: 0 });
    fig(q, M(q).poly([[x + 26, y + 26], [x + 9, y + 20], [x + 3, y + 30], [x + 3, 80], [x + 28, 80]]), c, { sh: [2, 1], hi: 0 });
    for (const ey of [y + 36, y + 41]) { q.box(x - 26, ey, 22, 2, '#f09030'); q.box(x + 4, ey, 22, 2, '#f09030'); }
  }
  // Somebody small, for a picture with more going on than a face. o: top, skin, hair, pants, and for
  // what they're doing with their legs and arms, run (a stride) and up (an arm in the air).
  function little(p, x, y, o) {
    const pants = o.pants || '#303040';
    if (o.run) {
      fig(p, M(p).line(x - 1, y + 11, x - 7, y + 19, 4), pants, { sh: 0, hi: 0 });
      fig(p, M(p).line(x + 1, y + 11, x + 6, y + 17, 4).line(x + 6, y + 17, x + 5, y + 21, 4), pants, { sh: 0, hi: 0 });
    } else {
      fig(p, M(p).box(x - 4, y + 11, 3, 10).box(x + 1, y + 11, 3, 10), pants, { sh: 0, hi: 0 });
    }
    fig(p, M(p).line(x - 3, y + 5, x - 8, y + 10, 3), o.top, { sh: 0, hi: 0 });
    fig(p, M(p).rbox(x - 4, y + 2, 9, 11, 2), o.top, { sh: [2, 1], hi: [1, 1] });
    fig(p, M(p).line(x + 3, y + 5, x + 8, o.up ? y - 4 : y + 9, 3), o.top, { sh: 0, hi: 0 });
    fig(p, M(p).ell(x + 1, y - 2, 6), o.skin, { sh: [2, 1], hi: 0 });
    fig(p, M(p).ell(x, y - 5, 6, 4).box(x - 7, y - 3, 14, 6, 0), o.hair, { sh: 0, hi: 0 });
    p.set(x + 4, y - 2, LINE); p.set(x + 1, y - 2, LINE); p.box(x + 2, y + 1, 2, 1, LINE);
  }
  // a question mark or the like, floating
  const loud = (p, str, x, y, c, n = 3) => { for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) words(p, str, x + a, y + b, LINE, n); words(p, str, x, y, c, n); };

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

  // (a stand-in for someone goes by their department)
  BACKS.sales = BACKS.road; BACKS.engineering = BACKS.cubicle;

  // ---------- the people and things on the cards ----------
  // (They're in the order they were painted, not by class: js/cardlist.js says who's in which.)
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
  // ---------- Plant ----------
  Object.assign(ART, {
    // "My hands are rivet guns now."
    markv(p) {
      p.box(0, 0, ART_W, ART_H, '#8c98a4');
      for (const x of [0, 39, 78]) { p.box(x, 0, 2, ART_H, '#5c6874'); p.box(x + 2, 0, 1, ART_H, '#b0bac4'); }
      for (let y = 5; y < ART_H; y += 9) for (let x = 7; x < ART_W; x += 9) { p.box(x, y, 2, 2, '#c8d0d8'); p.set(x + 1, y + 1, '#586470'); }
      const cx = 59, cy = 33, top = '#f08020', skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'quiff', brow: 'raised', mouth: 'grin' });
      for (const way of [-1, 1]) {
        const x = cx + way * 38;
        arm(p, cx + way * 28, 74, x, 50, top, skin, 10);
        fig(p, M(p).rbox(x - 7, 14, 14, 28, 3), '#d83830', { sh: [3, 2], hi: [2, 1] });
        fig(p, M(p).rbox(x - 4, 38, 8, 12, 2), '#3a3440', { sh: [1, 1], hi: 0 });
        fig(p, M(p).box(x - 2, 6, 4, 8), '#b8c0c8', { sh: [1, 0], hi: [1, 0] });
        spark(p, x, 4, '#fff0b0', 3);
      }
      fig(p, M(p).ell(cx - 23, 11, 2.5), '#c8d0d8', { sh: 0, hi: 0 });
      fig(p, M(p).ell(cx + 21, 7, 2.5), '#c8d0d8', { sh: 0, hi: 0 });
    },
    // "Safety glasses on! Yes, even in the hallway."
    steve(p) {
      p.box(0, 0, ART_W, ART_H, '#36604c');
      for (let y = 0; y < ART_H; y += 3) p.box(0, y, ART_W, 1, '#3c6854');
      for (let x = -12; x < ART_W; x++) for (let y = 66; y < ART_H; y++) if (x >= 0) p.set(x, y, ((x + y) >> 3) % 2 ? '#f0c020' : '#26222c');
      fig(p, M(p).rbox(79, 5, 35, 29, 2), '#f4f4ec', { sh: [1, 1], hi: 0 });
      p.box(80, 6, 33, 7, '#38a050');
      words(p, 'ZERO', 85, 7, '#ffffff'); words(p, '0', 88, 14, '#d83020', 2);
      words(p, 'DAYS', 85, 26, '#2c2c34');
      const cx = 42, cy = 33, top = '#f0b030', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'under', brow: 'angry', mouth: 'open', clothes(q, x, y) { hiVis(q, x, y); } });
      goggles(p, cx, cy + 2);
      hardHat(p, cx, cy, '#f8f4e8');
      // one finger up, for emphasis
      arm(p, cx + 26, 76, cx + 33, 44, top, skin, 10);
      fig(p, M(p).rbox(cx + 31, 26, 5, 16, 2), skin, { sh: [1, 1], hi: 0 });
      for (const [a, b] of [[28, 22], [39, 22], [33, 18]]) p.box(cx + a, b, 2, 2, '#fff0b0');
    },
    // "Everything in this warehouse has a place. I just can't find it."
    justin(p) {
      p.box(0, 0, ART_W, ART_H, '#5a4c44');
      const boxes = ['#b89060', '#a88050', '#c8a070', '#987048'];
      for (let r = 0; r < 4; r++) {
        const y = 2 + r * 18;
        p.box(0, y + 15, ART_W, 2, '#2c5898'); p.box(0, y + 15, ART_W, 1, '#4c78c0');
        for (let i = 0; i < 9; i++) {
          const x = 1 + i * 13, c = boxes[(i * 3 + r * 5) % 4];
          if ((i + r * 2) % 7 === 3) continue; // the gap where it ought to be
          p.box(x, y, 12, 15, ramp(c).shade); p.box(x, y, 11, 14, c); p.box(x, y, 11, 1, ramp(c).hi);
          p.box(x + 3, y + 5, 5, 3, '#f4f0e0');
        }
      }
      for (const x of [0, 58, 116]) p.box(x, 0, 2, ART_H, '#d86820');
      const cx = 62, cy = 34, top = '#f0b030', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#5a3420', top, hairdo: 'short', brow: 'worried', mouth: 'nervous', look: 'side' });
      // a clipboard, and scratching his head
      fig(p, M(p).rbox(cx - 42, 40, 22, 30, 1), '#8a5a3a', { sh: [1, 1], hi: 0 });
      fig(p, M(p).box(cx - 40, 44, 18, 24), '#f8f8f0', { sh: 0, hi: 0, line: null });
      for (let y = 47; y < 66; y += 4) p.box(cx - 38, y, 14, 1, '#909098');
      p.box(cx - 35, 39, 8, 3, '#b8b8c0');
      arm(p, cx - 26, 74, cx - 28, 60, top, skin, 10);
      arm(p, cx + 27, 74, cx + 22, 16, top, skin, 9);
      loud(p, '?', cx + 24, 0, '#f8e070', 3); loud(p, '?', cx + 42, 12, '#f8e070', 2);
    },
    // "The FMS punches out a panel every few seconds. Try to keep up."
    graham(p) {
      p.box(0, 0, ART_W, ART_H, '#4c4860');
      p.box(0, 62, ART_W, 13, '#6c6878'); p.box(0, 62, ART_W, 1, '#2c2838');
      // the machine
      fig(p, M(p).rbox(2, 6, 50, 58, 3), '#3c78b8', { sh: [4, 3], hi: [2, 2] });
      fig(p, M(p).box(8, 26, 38, 18), '#1c2030', { sh: 0, hi: 0 });
      fig(p, M(p).box(23, 12, 8, 22), '#c8d0d8', { sh: [2, 0], hi: [1, 0] });
      fig(p, M(p).rbox(8, 9, 12, 8, 1), '#20d870', { sh: 0, hi: 0 }); words(p, 'FMS', 26, 2, '#ffffff');
      for (const [x, c] of [[8, '#e03030'], [14, '#f0c020']]) fig(p, M(p).ell(x + 2, 52, 2), c, { sh: 0, hi: 0 });
      // the panels coming out faster than anyone can catch them
      for (const [x, y, t] of [[44, 34, -2], [58, 22, 3], [72, 8, -3], [92, 4, 4], [105, 16, -2]]) {
        const panel = M(p).poly([[x, y + t], [x + 15, y - t], [x + 15, y + 10 - t], [x, y + 10 + t]]);
        fig(p, panel, '#c8d0d8', { sh: [1, 1], hi: [1, 0] });
        for (const a of [3, 7, 11]) p.box(x + a, y + 4, 2, 2, '#4c4860');
      }
      for (const [x, y] of [[53, 34], [67, 22], [85, 10]]) p.box(x, y, 4, 1, '#ffffff');
      const cx = 79, cy = 38, top = '#f08020', skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#5a3420', top, hairdo: 'spiky', brow: 'raised', mouth: 'smirk', look: 'side', specs: '#2a2a34' });
      arm(p, cx + 26, 76, cx + 32, 58, top, skin, 10);
      fig(p, M(p).box(cx + 24, 52, 15, 3), '#c8d0d8', { sh: 0, hi: 0 });
    },
    // "If it leaks, sparks or squeaks, it ends up on my list."
    brian(p) {
      p.box(0, 0, ART_W, ART_H, '#2c4c50');
      for (const [y, c] of [[9, '#c86838'], [20, '#688c98'], [31, '#c8a038']]) { p.box(0, y, ART_W, 5, c); p.box(0, y, ART_W, 1, ramp(c).hi); p.box(0, y + 4, ART_W, 1, ramp(c).shade); for (let x = 12; x < ART_W; x += 40) p.box(x, y - 1, 4, 7, '#2a2a34'); }
      // the compressor, making that noise again
      fig(p, M(p).rbox(72, 34, 42, 30, 12), '#b83828', { sh: [4, 3], hi: [2, 2] });
      fig(p, M(p).ell(93, 49, 9), '#d0d4d8', { sh: 0, hi: 0 }); flat(p, M(p).line(93, 49, 98, 44, 1), '#d02020');
      p.box(66, 64, 52, 11, '#3a3a44');
      for (const [x, y] of [[71, 26], [114, 28], [68, 32]]) spark(p, x, y, '#fff0a0', 2);
      arc(p, 110, 40, 7, -1, 0.2, '#ffffff'); arc(p, 110, 40, 10, -1, 0.2, '#ffffff');
      // the drip
      for (const [x, y] of [[40, 5], [24, 36]]) fig(p, M(p).ell(x, y, 2, 3).poly([[x - 2, y - 1], [x, y - 6], [x + 2, y - 1]]), '#78c8f8', { sh: 0, hi: [1, 1] });
      const cx = 42, cy = 35, top = '#f08020', skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#d06030', top, hairdo: 'curly', brow: '', mouth: 'smile', beard: '#d06030' });
      // and the big wrench over his shoulder
      fig(p, M(p).line(cx - 34, 62, cx - 16, 22, 7), '#c8d0d8', { sh: [2, 1], hi: [1, 0] });
      fig(p, M(p).poly([[cx - 22, 24], [cx - 26, 12], [cx - 19, 15], [cx - 15, 8], [cx - 8, 13], [cx - 10, 26]]), '#c8d0d8', { sh: [2, 1], hi: [1, 0] });
      arm(p, cx - 28, 76, cx - 29, 54, top, skin, 10);
    },
    // "The drawing says this coil fits. The coil disagrees."
    jillian(p) {
      p.box(0, 0, ART_W, ART_H, '#24487c');
      for (let x = 4; x < ART_W; x += 8) p.box(x, 0, 1, ART_H, '#2e568c');
      for (let y = 4; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#2e568c');
      // the opening on the drawing...
      for (const [x, y, w, h] of [[66, 12, 40, 1], [66, 62, 40, 1], [66, 12, 1, 50], [105, 12, 1, 50]]) p.box(x, y, w, h, '#e8f0f8');
      words(p, '24"', 78, 3, '#e8f0f8');
      // ...and the coil that doesn't fit in it
      fig(p, M(p).rbox(60, 18, 58, 42, 2), '#c07840', { sh: [3, 3], hi: [2, 2] });
      for (let x = 63; x < 116; x += 3) p.box(x, 20, 1, 38, '#8c5228');
      for (let i = 0; i < 4; i++) { fig(p, M(p).ell(60, 25 + i * 9, 4), '#d89060', { sh: [1, 1], hi: [1, 1] }); }
      const cx = 37, cy = 33, skin = '#f8d0a8';
      person(p, cx, cy, {
        skin, hair: '#5a3420', top: '#f8f8f8', hairdo: 'ponytail', brow: 'raised', mouth: 'flat', look: 'side',
        clothes(q, x, y) { flat(q, M(q).line(x - 8, y + 21, x, y + 31, 1).line(x + 8, y + 21, x, y + 31, 1), '#58a848'); fig(q, M(q).rbox(x - 4, y + 31, 8, 10, 1), '#58a848', { sh: [1, 1], hi: 0 }); },
      });
      // the rolled-up drawing, under her arm
      fig(p, M(p).line(cx - 34, 56, cx - 10, 69, 7), '#e8f0f8', { sh: [1, 2], hi: 0 });
      arm(p, cx + 25, 76, cx + 26, 52, '#f8f8f8', skin, 9);
      fig(p, M(p).ell(cx + 26, 48, 4.5, 5), skin, { sh: [1, 1], hi: 0 });
    },
    // "My walls don't sag."
    kylebullock(p) {
      p.box(0, 0, ART_W, ART_H, '#d8d4c4');
      for (let x = 0; x < ART_W; x += 29) { p.box(x, 0, 2, ART_H, '#88847c'); p.box(x + 2, 0, 1, ART_H, '#f4f0e4'); }
      p.box(0, 0, ART_W, 3, '#6c7884'); p.box(0, 70, ART_W, 5, '#6c7884');
      for (let x = 7; x < ART_W; x += 29) for (let y = 7; y < 70; y += 12) p.box(x + 11, y, 2, 2, '#a8a498');
      const cx = 59, cy = 33, top = '#f0b030', skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#e8c050', top, hairdo: 'buzz', brow: 'angry', mouth: 'flat' });
      // arms folded, and not going anywhere
      fig(p, M(p).rbox(cx - 31, 58, 44, 13, 5), top, { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).rbox(cx - 13, 62, 44, 13, 5), top, { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(cx - 25, 66, 6, 5), skin, { sh: [1, 1], hi: 0 }); fig(p, M(p).ell(cx + 27, 66, 6, 5), skin, { sh: [1, 1], hi: 0 });
      // the level on the wall, dead centre
      fig(p, M(p).rbox(6, 16, 28, 8, 1), '#f0c020', { sh: [1, 1], hi: [1, 0] });
      p.box(15, 18, 10, 4, '#a8e850'); p.box(17, 18, 1, 4, '#26222c'); p.box(22, 18, 1, 4, '#26222c'); p.box(19, 19, 2, 2, '#f0ffd0');
      spark(p, 96, 14, '#ffffff', 3);
    },
    // "We're behind, we're over, and the coffee machine is broken. Normal Tuesday."
    miked(p) {
      p.box(0, 0, ART_W, ART_H, '#b8a888');
      p.box(0, 60, ART_W, 15, '#7c6c58'); p.box(0, 60, ART_W, 1, '#4c4034');
      // the chart, going the wrong way
      fig(p, M(p).box(4, 6, 36, 28), '#f8f8f0', { sh: 0, hi: 0 });
      p.box(8, 9, 1, 22, '#585868'); p.box(8, 30, 29, 1, '#585868');
      for (let i = 0; i < 26; i++) { const y = 29 - Math.floor(i * i / 34); p.box(9 + i, y, 2, 2, '#d82828'); }
      words(p, 'TUE', 14, 10, '#585868');
      // the coffee machine, with its note
      fig(p, M(p).rbox(90, 22, 24, 38, 2), '#585868', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(95, 40, 14, 12), '#1c1c28', { sh: 0, hi: 0 });
      fig(p, M(p).box(92, 25, 20, 12), '#f8e870', { sh: [1, 1], hi: 0 }); p.box(94, 28, 16, 1, '#d02020'); p.box(94, 31, 16, 1, '#d02020'); p.box(94, 34, 10, 1, '#d02020');
      const cx = 60, cy = 34, top = '#78a8e8', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top, hairdo: 'bald', brow: 'worried', mouth: 'flat', look: 'tired', stache: '#a8a8b0', clothes(q, x, y) { tie(q, x, y, '#283878'); } });
      // on the phone to Richmond
      arm(p, cx + 27, 76, cx + 21, 38, top, skin, 9);
      fig(p, M(p).rbox(cx + 17, 20, 7, 20, 2), '#26222c', { sh: 0, hi: [1, 1] });
    },
    // A coil the size of a garage door
    bigcoil(p) {
      p.box(0, 0, ART_W, ART_H, '#2c2630');
      rays(p, 59, 34, 18, '#3c3440', 0.1, 0, 62);
      p.box(0, 62, ART_W, 13, '#6c6068'); p.box(0, 62, ART_W, 1, '#1c1820');
      fig(p, M(p).rbox(12, 6, 94, 56, 2), '#c07840', { sh: [4, 4], hi: [2, 2], deep: [2, 2] });
      fig(p, M(p).box(20, 11, 78, 46), '#a86030', { sh: 0, hi: 0 });
      for (let x = 21; x < 98; x += 2) p.box(x, 12, 1, 44, x % 4 === 1 ? '#d89860' : '#884c24');
      p.box(12, 6, 94, 3, '#9098a8'); p.box(12, 59, 94, 3, '#9098a8');
      // the tube ends down the side, and the header
      for (let r = 0; r < 5; r++) {
        fig(p, M(p).ell(13, 14 + r * 10, 5), '#e8a878', { sh: [2, 2], hi: [1, 1] });
        fig(p, M(p).ell(105, 14 + r * 10, 5), '#e8a878', { sh: [2, 2], hi: [1, 1] });
      }
      fig(p, M(p).rbox(108, 2, 8, 62, 3), '#d89060', { sh: [2, 1], hi: [1, 1] });
      // a very small person, for scale
      little(p, 34, 45, { top: '#f0b030', skin: '#f0c098', hair: '#5a3420', up: true });
      fig(p, M(p).rbox(0, 66, ART_W, 3, 0), '#a86c30', { sh: 0, hi: 0 });
      spark(p, 86, 18, '#fff8d8', 3); spark(p, 50, 50, '#fff8d8', 2);
    },
    // Up in the roof, with a unit on the hook
    crane(p) {
      p.box(0, 0, ART_W, ART_H, '#4c4048');
      rays(p, 59, -30, 22, '#5c4e50', 0.1, 0, 60);
      p.box(0, 60, ART_W, 15, '#807468'); p.box(0, 60, ART_W, 1, '#2c2630');
      for (let x = 2; x < ART_W; x += 14) p.box(x, 64, 7, 2, '#e8b820');
      // the bridge, right across
      fig(p, M(p).box(-2, 5, ART_W + 4, 12), '#f0b020', { sh: [0, 2], hi: [0, 1] });
      for (let x = 6; x < ART_W; x += 12) { const m = M(p).poly([[x, 7], [x + 6, 14], [x + 12, 7]]); flat(p, m, '#c88410'); }
      words(p, '5 TON', 8, 7, '#26222c');
      // the trolley, the cable and the hook
      fig(p, M(p).rbox(50, 15, 22, 10, 1), '#d83830', { sh: [2, 2], hi: [1, 1] });
      p.box(59, 25, 1, 14, '#1c1820'); p.box(62, 25, 1, 14, '#1c1820');
      fig(p, M(p).rbox(56, 34, 10, 6, 1), '#f0b020', { sh: [1, 1], hi: 0 });
      arc(p, 61, 44, 3, -1, 3.6, '#c8d0d8');
      // the slings, and the unit going up
      flat(p, M(p).line(61, 41, 38, 49, 1).line(61, 41, 84, 49, 1), '#f8f4e8');
      fig(p, M(p).rbox(32, 48, 58, 16, 1), '#b8c4cc', { sh: [2, 2], hi: [1, 1] });
      for (let x = 37; x < 88; x += 4) p.box(x, 52, 2, 8, '#7c8894');
      p.box(33, 49, 8, 2, '#3c78b8');
      little(p, 104, 52, { top: '#f0b030', skin: '#f8d0a8', hair: '#6a3c20', up: true });
      little(p, 14, 52, { top: '#58a848', skin: '#c08860', hair: '#201818' });
    },
  });

  // ---------- Sales ----------
  Object.assign(ART, {
    // "I'm young and Italian!"
    mauro(p) {
      p.box(0, 0, 40, ART_H, '#2c9858'); p.box(40, 0, 38, ART_H, '#f4f4ec'); p.box(78, 0, 40, ART_H, '#d83838');
      const cx = 56, cy = 34, top = '#40a0a0', skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#d06030', top, hairdo: 'curly', brow: 'raised', mouth: 'grin' });
      // the fingers all together, the way you do
      arm(p, cx + 26, 76, cx + 37, 46, top, skin, 10);
      fig(p, M(p).poly([[cx + 32, 44], [cx + 34, 28], [cx + 37, 25], [cx + 40, 28], [cx + 43, 44]]), skin, { sh: [1, 1], hi: [1, 0] });
      for (const x of [35, 37, 40]) p.box(cx + x, 30, 1, 11, ramp(skin).shade);
      for (const [a, b, r] of [[46, 22, 7], [50, 30, 9], [28, 24, 9]]) arc(p, cx + a - 8, b, r, -1.2, 0.3, '#26222c');
    },
    // "Did you get your Hyrox tickets? Let's get a workout in!"
    patrick(p) {
      p.box(0, 0, ART_W, ART_H, '#4c3878');
      for (let x = 0; x < ART_W; x += 26) p.box(x, 0, 1, 60, '#5c4888');
      p.box(0, 60, ART_W, 15, '#2c2440'); for (let x = 0; x < ART_W; x += 8) p.box(x, 60, 4, 1, '#58c8a8');
      fig(p, M(p).box(6, 40, 16, 20), '#3c3050', { sh: 0, hi: 0 });
      for (const y of [44, 51, 56]) fig(p, M(p).rbox(5, y, 18, 3, 1), '#88a0b0', { sh: 0, hi: 0 });
      const cx = 59, cy = 37, top = '#e07898', skin = '#f8d0a8';
      // up it goes
      for (const way of [-1, 1]) arm(p, cx + way * 27, 75, cx + way * 34, 18, top, skin, 10);
      fig(p, M(p).box(4, 11, 110, 4), '#c8d0d8', { sh: [0, 1], hi: [0, 1] });
      for (const x of [6, 13, 98, 105]) fig(p, M(p).rbox(x, x % 2 ? 2 : 5, 6, x % 2 ? 22 : 16, 1), '#2a2a34', { sh: [1, 0], hi: [1, 0], line: '#101018' });
      person(p, cx, cy, { skin, hair: '#201818', top, hairdo: 'short', brow: 'angry', mouth: 'open' });
      headband(p, cx, cy, '#58c8a8');
      words(p, 'HYROX', cx - 15, 66, '#ffffff', 1);
      for (const [x, y] of [[cx - 21, 30], [cx + 22, 38], [cx + 24, 28]]) fig(p, M(p).ell(x, y, 1.5, 2.5), '#88d8f8', { sh: 0, hi: 0, line: null });
    },
    // "Go Leafs Go!!!"
    tho(p) {
      p.box(0, 0, ART_W, ART_H, '#20386c');
      for (let i = 0; i < 44; i++) { const x = (i * 37) % ART_W, y = (i * 23) % 26; fig(p, M(p).ell(x, y + 3, 2.5), ['#3868c8', '#f4f4ec', '#48609c'][i % 3], { sh: 0, hi: 0, line: null }); }
      p.box(0, 28, ART_W, 3, '#f4f4ec'); p.box(0, 31, ART_W, 3, '#d83838');
      p.box(0, 34, ART_W, 41, '#dcecf4');
      for (const [x, y, n] of [[6, 44, 14], [86, 58, 22], [8, 66, 16]]) p.box(x, y, n, 1, '#b8d0dc');
      p.box(0, 58, ART_W, 3, '#3868c8');
      const cx = 56, cy = 34, top = '#1c4c9c', skin = '#f0c098';
      person(p, cx, cy, {
        skin, hair: '#5a3420', top, hairdo: 'short', brow: 'raised', mouth: 'open', look: 'wide',
        clothes(q, x, y) {
          q.box(x - 34, 67, 68, 3, '#f4f4ec');
          flat(q, M(q).poly([[x, y + 23], [x + 4, y + 28], [x + 9, y + 26], [x + 7, y + 33], [x + 2, y + 33], [x + 1, y + 37], [x - 1, y + 37], [x - 2, y + 33], [x - 7, y + 33], [x - 9, y + 26], [x - 4, y + 28]]), '#f8f8f8');
        },
      });
      // and his stick in the air
      arm(p, cx + 26, 76, cx + 34, 44, top, skin, 10);
      fig(p, M(p).line(cx + 34, 46, cx + 46, 4, 4).line(cx + 46, 4, cx + 57, 8, 5), '#c89858', { sh: [1, 1], hi: [1, 0] });
      flat(p, M(p).line(cx + 46, 5, cx + 56, 8, 2), '#26222c');
    },
    // Hours and hours of highway, with the sun in his eyes
    wade(p) {
      BACKS.road(p);
      const cx = 56, cy = 37, top = '#78a8e8', skin = '#f0c098';
      // the inside of the truck, round the windshield
      p.box(0, 0, ART_W, 5, '#38343c'); p.box(0, 0, 8, ART_H, '#38343c'); p.box(ART_W - 8, 0, 8, ART_H, '#38343c');
      flat(p, M(p).poly([[8, 5], [18, 5], [8, 28]]), '#38343c'); flat(p, M(p).poly([[110, 5], [100, 5], [110, 28]]), '#38343c');
      person(p, cx, cy, { skin, hair: '#181010', top, hairdo: 'sidepart', mouth: 'smile', clothes(q, x, y) { flat(q, M(q).line(x - 26, y + 22, x + 18, 74, 4), '#26222c'); } });
      // shades
      fig(p, M(p).rbox(cx - 14, cy, 12, 7, 2).rbox(cx + 2, cy, 12, 7, 2), '#1c1820', { sh: 0, hi: 0 });
      p.box(cx - 2, cy + 1, 4, 1, '#1c1820'); p.box(cx - 12, cy + 1, 4, 1, '#88a0c0'); p.box(cx + 4, cy + 1, 4, 1, '#88a0c0');
      // the mirror, the dash and the wheel
      fig(p, M(p).rbox(88, 3, 18, 6, 1), '#26222c', { sh: 0, hi: 0 }); p.box(90, 4, 14, 3, '#9cc8e8');
      p.box(0, 68, ART_W, 7, '#26222c'); p.box(0, 68, ART_W, 1, '#5c5868');
      arc(p, cx, 80, 22, Math.PI, Math.PI * 2, '#1c1820'); arc(p, cx, 80, 23, Math.PI, Math.PI * 2, '#1c1820'); arc(p, cx, 80, 24, Math.PI, Math.PI * 2, '#3c3844');
      for (const way of [-1, 1]) fig(p, M(p).ell(cx + way * 22, 62, 5, 4), skin, { sh: [1, 1], hi: 0 });
      fig(p, M(p).rbox(92, 56, 11, 13, 1), '#2c2c3c', { sh: 0, hi: 0 }); p.box(94, 58, 7, 8, '#58c8e8');
    },
    // "You look like a C to me with shading of D."
    ali(p) {
      p.box(0, 0, ART_W, ART_H, '#b89cc8');
      for (let y = 0; y < ART_H; y += 6) p.box(0, y, ART_W, 1, '#c4aad2');
      p.box(0, 62, ART_W, 13, '#785c88');
      // the pad on its easel
      fig(p, M(p).line(82, 66, 88, 4, 2).line(112, 66, 106, 4, 2), '#7a5238', { sh: 0, hi: 0 });
      fig(p, M(p).box(70, 4, 44, 46), '#f8f8f0', { sh: [1, 1], hi: 0 });
      p.box(70, 4, 44, 3, '#d04848');
      words(p, 'C', 73, 11, '#3050c8', 4);
      // the D, shaded in
      words(p, 'D', 95, 21, '#d04848', 3);
      for (let y = 21; y < 45; y += 2) for (let x = 95 + (y % 4 ? 0 : 1); x < 113; x += 2) p.set(x, y, '#f8f8f0');
      const cx = 36, cy = 33, top = '#3868c8', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#201818', top, hairdo: 'long', brow: 'raised', mouth: 'smirk', look: 'side' });
      arm(p, cx + 26, 74, cx + 33, 42, top, skin, 9);
      flat(p, M(p).line(cx + 35, 40, cx + 48, 26, 2), '#26222c');
    },
    // "Have you tried naming yourself Bob?"
    ryan(p) {
      p.box(0, 0, ART_W, ART_H, '#38a8a0');
      const tag = (x, y, str) => {
        fig(p, M(p).rbox(x, y, 25, 15, 1), '#f8f8f0', { sh: [1, 1], hi: 0 });
        p.box(x + 1, y + 1, 23, 4, '#d84038'); words(p, str, x + 4, y + 7, '#26222c');
      };
      tag(3, 5, 'BOB'); tag(90, 8, 'BOB'); tag(4, 52, 'BOB'); tag(92, 50, 'BOB'); tag(10, 28, 'BOB'); tag(87, 29, 'BOB');
      const cx = 59, cy = 32, top = '#e07898', skin = '#f0c098';
      person(p, cx, cy, {
        skin, hair: '#6a3c20', top, hairdo: 'quiff', mouth: 'grin', brow: 'raised',
        clothes(q, x, y) {
          fig(q, M(q).rbox(x - 20, y + 23, 40, 22, 1), '#f8f8f0', { sh: [1, 1], hi: 0 });
          q.box(x - 19, y + 24, 38, 2, '#d84038'); words(q, 'BOB', x - 17, y + 27, '#26222c', 2);
        },
      });
    },
    // "We have finally recovered from all of that flooding. Do you want to move to Asheville?"
    garrett(p) {
      for (let y = 0; y < 42; y++) p.box(0, y, ART_W, 1, y < 16 ? '#88c0e0' : y < 30 ? '#a8d0e8' : '#c8e0f0');
      flat(p, M(p).poly([[0, 34], [18, 22], [38, 30], [62, 16], [86, 28], [118, 18], [118, 52], [0, 52]]), '#6c88a8');
      flat(p, M(p).poly([[0, 42], [24, 32], [50, 40], [78, 30], [118, 38], [118, 54], [0, 54]]), '#4c7868');
      p.box(0, 50, ART_W, 25, '#6c9cb8');
      // the sign
      fig(p, M(p).box(92, 26, 3, 30), '#7a5238', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(70, 8, 46, 19, 1), '#2c8048', { sh: [1, 1], hi: 0 });
      words(p, 'ASHE', 74, 10, '#ffffff'); words(p, 'VILLE', 74, 18, '#ffffff');
      const cx = 40, cy = 28, top = '#c87830', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#6a3c20', top, hairdo: 'under', mouth: 'grin', brow: 'raised' });
      ballCap(p, cx, cy, '#2c5898', 1);
      // waving you over
      arm(p, cx - 26, 72, cx - 33, 32, top, skin, 9);
      // and the water, still up to here
      for (let y = 60; y < ART_H; y++) p.box(0, y, ART_W, 1, y < 66 ? '#5888a8' : '#4c7898');
      for (const [x, y] of [[4, 60], [28, 63], [56, 60], [74, 66], [100, 61], [14, 70], [90, 71]]) { p.box(x, y, 10, 1, '#c8e4f4'); p.box(x + 3, y + 1, 5, 1, '#88b8d8'); }
    },
    // "Everyone else signed up for the Gran Fondo already."
    desirae(p) {
      BACKS.road(p);
      fig(p, M(p).box(2, 2, 64, 11), '#d83838', { sh: [0, 1], hi: 0 }); words(p, 'GRAN FONDO', 4, 4, '#ffffff');
      for (const [y, n] of [[46, 12], [40, 18], [52, 8]]) p.box(4, y, n, 1, '#f4f4ec');
      // her bike
      const fr = 88, bk = 33, wy = 60;
      for (const x of [bk, fr]) { arc(p, x, wy, 12, 0, 7, '#1c1820'); arc(p, x, wy, 11, 0, 7, '#26222c'); for (let a = 0; a < 6; a++) flat(p, M(p).line(x, wy, x + Math.cos(a + 0.4) * 11, wy + Math.sin(a + 0.4) * 11, 1), '#a8b0b8'); }
      flat(p, M(p).line(bk, wy, 58, wy, 2).line(bk, wy, 48, 38, 2).line(58, wy, 48, 38, 2).line(58, wy, 78, 38, 2).line(48, 38, 78, 38, 2).line(78, 34, fr, wy, 2), '#f0c020');
      fig(p, M(p).rbox(42, 33, 13, 3, 1), '#26222c', { sh: 0, hi: 0 }); flat(p, M(p).line(78, 34, 84, 30, 2).line(84, 30, 86, 36, 2), '#26222c');
      // her, right down over the bars
      const skin = '#f8d0a8', top = '#f8f8f8';
      fig(p, M(p).line(52, 32, 60, 46, 6).line(60, 46, 57, 60, 5), '#2c2c3c', { sh: [1, 1], hi: 0 });
      fig(p, M(p).ell(57, 62, 3, 2), skin, { sh: 0, hi: 0 });
      fig(p, M(p).poly([[46, 33], [52, 20], [72, 15], [76, 22], [58, 34]]), top, { sh: [2, 2], hi: 0 });
      p.box(54, 23, 8, 6, '#3868c8'); words(p, '7', 56, 23, '#ffffff');
      fig(p, M(p).line(68, 19, 83, 30, 5), skin, { sh: [1, 1], hi: 0 });
      fig(p, M(p).ell(80, 15, 9, 9), skin, { sh: [2, 1], hi: 0 });
      fig(p, M(p).ell(79, 9, 11, 7).box(0, 11, ART_W, 40, 0), '#e8508c', { sh: [2, 1], hi: [1, 1] });
      for (const x of [74, 78, 82]) p.box(x, 5, 2, 5, '#26222c');
      flat(p, M(p).line(68, 12, 66, 26, 4), '#181010');
      p.set(85, 15, LINE); p.set(84, 15, LINE); p.box(84, 19, 3, 1, LINE);
    },
    // Everything in the back, and a long way to go
    roadtrip(p) {
      for (let y = 0; y < 50; y++) p.box(0, y, ART_W, 1, ['#483070', '#784080', '#b84c70', '#e87048', '#f8a040', '#f8c858'][Math.floor(y / 8.4)]);
      fig(p, M(p).ell(82, 36, 16), '#fff0a0', { sh: 0, hi: 0, line: null });
      flat(p, M(p).poly([[0, 44], [20, 28], [36, 40], [56, 22], [78, 42], [100, 30], [118, 42], [118, 54], [0, 54]]), '#382c58');
      for (let x = -3; x < ART_W; x += 10) flat(p, M(p).poly([[x, 54], [x + 5, 40 + (x * 3 % 7 + 7) % 7], [x + 10, 54]]), '#1c2c30');
      p.box(0, 52, ART_W, 23, '#34303c'); p.box(0, 52, ART_W, 1, '#f8c858');
      for (let x = 4; x < ART_W; x += 20) p.box(x, 66, 11, 2, '#f0d860');
      // the car
      fig(p, M(p).poly([[16, 58], [17, 46], [40, 44], [54, 32], [84, 32], [96, 44], [106, 47], [106, 58]]), '#3898b8', { sh: [2, 3], hi: [1, 1] });
      fig(p, M(p).poly([[45, 44], [56, 35], [68, 35], [68, 44]]), '#d8f0f8', { sh: 0, hi: 0 });
      fig(p, M(p).poly([[71, 35], [83, 35], [91, 44], [71, 44]]), '#d8f0f8', { sh: 0, hi: 0 });
      for (const x of [34, 88]) { fig(p, M(p).ell(x, 59, 8), '#26222c', { sh: 0, hi: 0 }); fig(p, M(p).ell(x, 59, 3), '#c8d0d8', { sh: 0, hi: 0, line: null }); }
      // the bags on top
      fig(p, M(p).rbox(50, 21, 16, 11, 1), '#d83838', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).rbox(66, 18, 14, 14, 1), '#f0c020', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).rbox(78, 24, 9, 8, 1), '#58a848', { sh: [1, 1], hi: [1, 1] });
      p.box(49, 26, 39, 1, '#26222c');
      little(p, 60, 33, { top: '#f08020', skin: '#f0c098', hair: '#5a3420' });
      p.box(45, 44, 46, 11, '#3898b8'); p.box(69, 44, 1, 11, '#28708c');
      for (const [x, y, n] of [[2, 50, 11], [6, 56, 8], [1, 62, 12]]) p.box(x, y, n, 1, '#f8c858');
    },
    // The legend itself, heading for the next job. u: how far round its loop it is.
    truck(p, u = 0) {
      for (let y = 0; y < 44; y++) p.box(0, y, ART_W, 1, y < 12 ? '#3880c0' : y < 26 ? '#68a8d8' : '#a8d0e8');
      const hill = Math.round(u * ART_W), far = Math.round(u * ART_W / 2);
      for (let x = 0; x < ART_W; x++) {
        const X = (x + far) % ART_W, top = 26 + Math.abs((X % 59) - 29) * 0.6;
        p.box(x, Math.round(top), 1, 44 - Math.round(top), '#5c6c98');
      }
      for (let x = -12; x < ART_W + 12; x += 12) { const X = ((x + hill) % (ART_W + 12) + ART_W + 12) % (ART_W + 12) - 12; flat(p, M(p).poly([[X, 50], [X + 6, 34], [X + 12, 50]]), x % 24 ? '#2c5c3c' : '#346844'); }
      p.box(0, 48, ART_W, 27, '#3c3c48'); p.box(0, 48, ART_W, 1, '#d8d4b0');
      const dash = Math.round(u * 40) * 2;
      for (let x = -40; x < ART_W; x += 20) p.box(((x + dash) % (ART_W + 40) + ART_W + 40) % (ART_W + 40) - 40, 68, 11, 2, '#f8e060');
      const b = Math.floor(u * 16) % 2;
      // dust, and the speed
      for (let i = 0; i < 3; i++) { const v = (u * 2 + i / 3) % 1; fig(p, M(p).ell(8 - v * 12, 58 - v * 8, 2 + v * 4), '#d8d0c0', { sh: [1, 1], hi: 0, line: '#7c7468' }); }
      // the unit in the back
      fig(p, M(p).rbox(14, 19 + b, 40, 22, 1), '#c8d0d8', { sh: [2, 2], hi: [1, 1] });
      for (let x = 18; x < 52; x += 3) p.box(x, 24 + b, 1, 12, '#7c8894');
      p.box(14, 28 + b, 40, 1, '#f8c020'); p.box(14, 33 + b, 40, 1, '#f8c020');
      // the truck
      fig(p, M(p).poly([[8, 56 + b], [8, 40 + b], [56, 40 + b], [58, 22 + b], [88, 22 + b], [99, 39 + b], [114, 42 + b], [116, 56 + b]]), '#d82828', { sh: [2, 3], hi: [1, 1], deep: [1, 1] });
      fig(p, M(p).poly([[62, 26 + b], [85, 26 + b], [93, 38 + b], [62, 38 + b]]), '#c8ecf8', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[66, 26 + b], [71, 26 + b], [64, 38 + b], [62, 38 + b], [62, 32 + b]]), '#f0fcff');
      little(p, 74, 31 + b, { top: '#f0b030', skin: '#f0c098', hair: '#5a3420' });
      p.box(60, 39 + b, 40, 15, '#d82828'); p.box(60, 39 + b, 40, 1, '#f86048');
      words(p, 'HAAKON', 60, 41 + b, '#ffffff', 1);
      fig(p, M(p).rbox(109, 44 + b, 7, 5, 1), '#fff0a0', { sh: 0, hi: 0 });
      for (const x of [28, 92]) {
        fig(p, M(p).ell(x, 58, 10), '#1c1820', { sh: 0, hi: [1, 1] }); fig(p, M(p).ell(x, 58, 5), '#c8d0d8', { sh: [1, 1], hi: 0 });
        const a = u * Math.PI * 4; flat(p, M(p).line(x - Math.cos(a) * 4, 58 - Math.sin(a) * 4, x + Math.cos(a) * 4, 58 + Math.sin(a) * 4, 2), '#26222c');
      }
      [[106, 8, 3], [8, 12, 2], [66, 6, 2], [34, 6, 3]].forEach(([x, y, n], i) => spark(p, x, y, '#fff8d0', (u * 2 + i * 0.27) % 1 < 0.5 ? n : 1));
    },
  });

  // ---------- Office ----------
  Object.assign(ART, {
    // "Everything perfectly organised."
    davisson(p) {
      p.box(0, 0, ART_W, ART_H, '#e8e4d8');
      const rainbow = ['#d83838', '#e87820', '#f0c020', '#58a848', '#2c98a8', '#3868c8', '#7848b8'];
      for (let r = 0; r < 3; r++) {
        const y = 3 + r * 23;
        p.box(0, y + 19, ART_W, 3, '#8a6848'); p.box(0, y + 19, ART_W, 1, '#b08c64');
        for (let i = 0; i < 14; i++) {
          const x = 2 + i * 8, c = rainbow[Math.floor(i / 2)];
          p.box(x, y, 7, 19, ramp(c).shade); p.box(x, y, 6, 19, c); p.box(x + 1, y + 3, 4, 5, '#f8f8f0');
          p.box(x + 2, y + 5, 2, 1, '#585868');
        }
      }
      const cx = 59, cy = 35, top = '#f8f8f8', skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#d06030', top, hairdo: 'sidepart', mouth: 'smile', specs: '#3c3c48', clothes(q, x, y) { tie(q, x, y, '#3868c8'); q.box(x + 14, y + 32, 7, 1, '#3868c8'); q.box(x + 14, y + 34, 2, 5, '#d83838'); q.box(x + 18, y + 34, 2, 4, '#58a848'); } });
      // a ruler, straight as anything
      fig(p, M(p).rbox(cx - 39, 40, 6, 32, 0), '#f0d060', { sh: [1, 0], hi: 0 });
      for (let y = 42; y < 70; y += 3) p.box(cx - 39, y, 3, 1, '#585868');
      fig(p, M(p).ell(cx - 34, 66, 5), skin, { sh: [1, 1], hi: 0 });
      spark(p, cx + 39, 26, '#ffffff', 3);
    },
    // "Make sure to check the sender's email address and don't click on any links."
    leo(p) {
      p.box(0, 0, ART_W, ART_H, '#141c30');
      for (let i = 0; i < 26; i++) { const x = (i * 29) % ART_W, y = (i * 17) % ART_H; p.box(x, y, 3 + i % 5, 1, '#20604c'); }
      // the screen, with something on a hook
      fig(p, M(p).rbox(62, 4, 53, 41, 2), '#585868', { sh: [2, 2], hi: [1, 1] });
      p.box(65, 7, 47, 35, '#f4ecd0');
      p.box(65, 7, 47, 6, '#d83030'); words(p, 'URGENT', 69, 7, '#ffffff');
      fig(p, M(p).box(70, 22, 30, 18), '#ffffff', { sh: 0, hi: 0 });
      flat(p, M(p).line(70, 22, 85, 33, 1).line(100, 22, 85, 33, 1), '#585868');
      // ...with a hook through it, on a line
      flat(p, M(p).line(85, 13, 85, 25, 1), '#26222c');
      arc(p, 82, 25, 3, -0.2, 3, '#d83030'); arc(p, 82, 25, 4, -0.2, 3, '#d83030');
      p.box(79, 22, 1, 3, '#d83030');
      words(p, '!', 103, 22, '#d83030', 2);
      p.box(84, 45, 10, 6, '#3c3c48'); p.box(76, 50, 26, 3, '#585868');
      const cx = 33, cy = 34, top = '#808898', skin = '#d8a070';
      person(p, cx, cy, {
        skin, hair: '#d06030', top, hairdo: 'short', brow: 'raised', mouth: 'flat', look: 'side', specs: '#101018',
        clothes(q, x, y) { fig(q, M(q).poly([[x - 11, y + 20], [x, y + 28], [x + 11, y + 20], [x + 15, y + 27], [x, y + 37], [x - 15, y + 27]]), ramp(top).shade, { sh: 0, hi: 0 }); q.box(x - 4, y + 33, 1, 8, '#f8f8f8'); q.box(x + 4, y + 33, 1, 8, '#f8f8f8'); },
      });
      // one finger, wagging
      arm(p, cx + 26, 76, cx + 28, 46, top, skin, 10);
      fig(p, M(p).rbox(cx + 26, 30, 5, 15, 2), skin, { sh: [1, 1], hi: 0 });
      for (const a of [-0.4, 0, 0.4]) arc(p, cx + 28, 30, 9, -Math.PI / 2 + a - 0.1, -Math.PI / 2 + a + 0.1, '#f8e070');
    },
    // "Make sure you have your dependant forms filled out for Manulife!"
    jhonna(p) {
      p.box(0, 0, ART_W, ART_H, '#88b8a8');
      for (let y = 0; y < 66; y += 3) p.box(0, y, ART_W, 1, '#94c0b0');
      for (const y of [6, 26, 46]) { fig(p, M(p).box(92, y, 24, 18), '#7c8894', { sh: [1, 1], hi: [1, 1] }); fig(p, M(p).rbox(99, y + 6, 10, 3, 1), '#c8d0d8', { sh: 0, hi: 0 }); p.box(98, y + 2, 12, 3, '#f8f8f0'); }
      const cx = 48, cy = 28, top = '#3868c8', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'bob', mouth: 'smile', brow: 'raised', specs: '#8a3050', clothes(q, x, y) { flat(q, M(q).line(x - 8, y + 21, x, y + 30, 1).line(x + 8, y + 21, x, y + 30, 1), '#2c6a34'); } });
      // the counter, and forms stacked up so nothing gets past it
      fig(p, M(p).box(-2, 59, ART_W + 4, 18), '#a87c50', { sh: [0, 2], hi: [0, 1] });
      for (let i = 0; i < 9; i++) { const y = 56 - i * 3; fig(p, M(p).box(4 + (i % 3), y, 24, 3), '#f8f8f0', { sh: 0, hi: 0, line: '#888890' }); }
      for (let i = 0; i < 3; i++) fig(p, M(p).box(70 + (i % 2), 56 - i * 3, 14, 3), '#f8f0c8', { sh: 0, hi: 0, line: '#888868' });
      // the form you haven't filled out
      arm(p, cx + 24, 62, cx + 30, 44, top, skin, 9);
      fig(p, M(p).box(cx + 20, 6, 24, 34), '#f8f8f0', { sh: [1, 1], hi: 0 });
      words(p, 'FORM', cx + 21, 7, '#d83838');
      for (let y = 16; y < 34; y += 4) { p.box(cx + 23, y, 3, 3, '#3c3448'); p.box(cx + 28, y + 1, 13, 1, '#a0a0a8'); }
    },
    // "EMAILS ARE MUCH EASIER TO READ IF EVERYTHING IS ALL CAPS"
    stephen(p) {
      p.box(0, 0, ART_W, ART_H, '#f8f8f0');
      p.box(0, 0, ART_W, 7, '#3868c8'); words(p, 'RE: RE: RE:', 3, 0, '#ffffff');
      for (const [str, x, y, n, c] of [['READ', 2, 9, 2, '#26222c'], ['THIS', 68, 9, 2, '#d83030'], ['ALL', 2, 27, 2, '#d83030'], ['CAPS', 2, 44, 2, '#26222c'], ['NOW', 78, 27, 2, '#3050c8']]) words(p, str, x, y, c, n);
      const cx = 56, cy = 37, top = '#40a0a0', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#5a3420', top, hairdo: 'short', brow: 'angry', mouth: 'open', look: 'wide' });
      // and a loudhailer, for the ones at the back
      fig(p, M(p).poly([[cx + 16, 50], [cx + 36, 38], [cx + 36, 68], [cx + 16, 58]]), '#f0c020', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(cx + 36, 53, 3, 15), '#d89818', { sh: 0, hi: 0 });
      for (const r of [8, 12]) arc(p, cx + 38, 53, r, -0.7, 0.7, '#d83030');
    },
    // "Nameplates are my favorite thing to do! Go check out the engraver!"
    tainah(p) {
      p.box(0, 0, ART_W, ART_H, '#4c3028');
      for (let x = 0; x < ART_W; x += 18) { p.box(x, 0, 1, 62, '#402820'); p.box(x + 5, 8, 8, 1, '#5a3a30'); p.box(x + 9, 28, 7, 1, '#5a3a30'); }
      p.box(0, 62, ART_W, 13, '#7c5c44'); p.box(0, 62, ART_W, 1, '#2c1c18');
      // the engraver, cutting a plate
      fig(p, M(p).rbox(4, 40, 36, 24, 2), '#687888', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(13, 14, 7, 28), '#889898', { sh: [1, 0], hi: [1, 0] });
      fig(p, M(p).poly([[12, 34], [21, 34], [17, 42]]), '#d8e0e8', { sh: 0, hi: 0 });
      fig(p, M(p).box(6, 43, 30, 7), '#e8b030', { sh: [1, 1], hi: [1, 1] });
      for (let x = 9; x < 17; x += 2) p.box(x, 46, 1, 2, '#7c5818');
      for (const [x, y, n] of [[18, 40, 3], [25, 36, 2], [12, 38, 2], [30, 41, 1]]) spark(p, x, y, '#fff0a0', n);
      const cx = 70, cy = 33, top = '#f0b030', skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#d06030', top, hairdo: 'long', mouth: 'grin', look: 'shut' });
      // holding up the finished one
      arm(p, cx + 24, 76, cx + 30, 42, top, skin, 9);
      fig(p, M(p).rbox(cx + 14, 21, 32, 15, 2), '#e8b030', { sh: [2, 2], hi: [1, 1], deep: [1, 1] });
      p.box(cx + 16, 23, 28, 1, '#fff0b0');
      words(p, 'YOU', cx + 20, 24, '#5c4010');
      spark(p, cx + 42, 18, '#ffffff', 3);
    },
    // "Have you seen all of my trophies?"
    nathan(p) {
      p.box(0, 0, ART_W, ART_H, '#5c2038');
      for (let y = 0; y < ART_H; y += 4) for (let x = (y % 8) * 2; x < ART_W; x += 8) p.set(x, y, '#6c2844');
      const cup = (x, y, n) => {
        fig(p, M(p).poly([[x - n, y], [x + n, y], [x + n - 2, y + n + 3], [x + 1, y + n + 5], [x + 1, y + n + 8], [x + n / 2 + 1, y + n + 10], [x - n / 2 - 1, y + n + 10], [x - 1, y + n + 8], [x - 1, y + n + 5], [x - n + 2, y + n + 3]]), '#f0c030', { sh: [2, 1], hi: [1, 1] });
        arc(p, x - n - 1, y + 3, 3, 1.5, 4.7, '#b88818'); arc(p, x + n + 1, y + 3, 3, -1.5, 1.6, '#b88818');
      };
      for (const y of [22, 48]) { p.box(0, y, ART_W, 3, '#a87840'); p.box(0, y, ART_W, 1, '#d0a060'); }
      for (const [x, n] of [[8, 4], [20, 5], [32, 3], [96, 4], [108, 5]]) cup(x, 22 - n - 10, n);
      for (const [x, n] of [[6, 5], [19, 4], [100, 4], [111, 3]]) cup(x, 48 - n - 10, n);
      const cx = 56, cy = 34, top = '#e07898', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'sidepart', mouth: 'grin', brow: 'raised', clothes(q, x, y) { tie(q, x, y, '#f0b030', top); } });
      // the big one
      arm(p, cx + 26, 76, cx + 35, 52, top, skin, 10);
      cup(cx + 37, 18, 10);
      for (const [x, y] of [[cx + 22, 16], [cx + 50, 28], [cx + 42, 10]]) spark(p, x, y, '#ffffff', 2);
    },
    // Out of paper, out of toner, out of patience
    paperjam(p) {
      p.box(0, 0, ART_W, ART_H, '#686c84');
      p.box(0, 64, ART_W, 11, '#4c4c5c'); p.box(0, 64, ART_W, 1, '#2c2c34');
      // the copier
      fig(p, M(p).rbox(24, 32, 70, 34, 2), '#d8d8d0', { sh: [3, 3], hi: [1, 1] });
      fig(p, M(p).box(32, 54, 54, 8), '#a8a8a0', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(26, 26, 66, 8, 1), '#b8b8b0', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(70, 38, 20, 9), '#101828', { sh: 0, hi: 0 }); words(p, 'JAM', 72, 39, '#f84030');
      for (const [x, c] of [[34, '#d83030'], [42, '#f0c020'], [50, '#d83030']]) fig(p, M(p).ell(x, 44, 3), c, { sh: 0, hi: [1, 1] });
      // the paper, everywhere
      const sheet = (x, y, a) => {
        const co = Math.cos(a) * 8, si = Math.sin(a) * 8;
        fig(p, M(p).poly([[x - co + si, y - si - co], [x + co + si, y + si - co], [x + co - si, y + si + co], [x - co - si, y - si + co]]), '#f8f8f0', { sh: [1, 1], hi: 0 });
      };
      for (const [x, y, a] of [[16, 16, 0.5], [34, 8, -0.3], [54, 16, 0.9], [78, 8, 0.2], [100, 18, -0.6], [64, 4, 1.3], [8, 44, 1.1], [108, 44, 0.4]]) sheet(x, y, a);
      // the crumpled lot, still in its mouth
      fig(p, M(p).poly([[42, 30], [46, 20], [52, 25], [58, 17], [64, 24], [71, 20], [76, 30]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      for (const [a, b, c, d] of [[50, 22, 54, 28], [60, 20, 58, 28], [68, 23, 66, 29]]) flat(p, M(p).line(a, b, c, d, 1), '#a0a0a8');
      spark(p, 88, 28, '#fff0a0', 3); spark(p, 30, 28, '#fff0a0', 2);
    },
    // An hour on next year's forecast, and nobody's coming out of it the same
    budget(p) {
      p.box(0, 0, ART_W, ART_H, '#3c3850');
      // the slide
      fig(p, M(p).box(26, 3, 66, 34), '#f8f8f0', { sh: 0, hi: 0 });
      words(p, 'Q4', 30, 4, '#3c3850');
      for (const [x, h, c] of [[34, 22, '#58a848'], [44, 17, '#f0c020'], [54, 11, '#e87820'], [64, 7, '#d83838'], [74, 3, '#d83838']]) p.box(x, 34 - h, 7, h, c);
      flat(p, M(p).line(36, 14, 82, 31, 1), '#26222c');
      // a clock that's stopped trying
      fig(p, M(p).ell(107, 15, 9), '#f8f8f0', { sh: [1, 1], hi: 0 }); flat(p, M(p).line(107, 15, 107, 8, 1).line(107, 15, 112, 18, 1), '#26222c');
      // the table
      flat(p, M(p).poly([[20, 46], [98, 46], [118, 75], [0, 75]]), '#7a5238');
      flat(p, M(p).poly([[20, 46], [98, 46], [100, 49], [18, 49]]), '#9c7048');
      // everyone, face down
      const nod = (x, y, skin, hair, top, z) => {
        fig(p, M(p).rbox(x - 10, y + 7, 20, 9, 3), top, { sh: [1, 1], hi: [1, 1] });
        fig(p, M(p).ell(x, y, 7, 6), skin, { sh: [1, 1], hi: 0 });
        fig(p, M(p).ell(x, y - 2, 7, 5).box(0, y + 1, ART_W, 9, 0), hair, { sh: 0, hi: [1, 1] });
        if (z) { words(p, 'z', x + 7, y - 9, '#f8f8f0', 1); words(p, 'Z', x + 12, y - 15, '#f8f8f0', 1); }
      };
      nod(15, 44, '#f0c098', '#5a3420', '#b83028', true);
      nod(100, 43, '#c08860', '#201818', '#3868c8', true);
      nod(32, 60, '#8a5838', '#181010', '#58a848', false);
      nod(84, 60, '#f8d8b8', '#b87830', '#e07898', true);
      fig(p, M(p).box(53, 52, 12, 14), '#f8f8f0', { sh: 0, hi: 0 });
      for (let y = 55; y < 65; y += 3) p.box(55, y, 8, 1, '#a0a0a8');
    },
    // Everybody reports to somebody else now
    reorg(p) {
      p.box(0, 0, ART_W, ART_H, '#d8ccb0');
      for (let y = 0; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#ccc0a4');
      const node = (x, y, c, face) => {
        fig(p, M(p).rbox(x - 9, y - 6, 18, 12, 1), c, { sh: [1, 1], hi: [1, 1] });
        fig(p, M(p).ell(x, y - 1, 3), face || '#f8e0c0', { sh: 0, hi: 0, line: null });
        p.box(x - 3, y + 3, 6, 1, '#f8f8f8');
      };
      flat(p, M(p).line(58, 12, 58, 26, 1).line(24, 26, 92, 26, 1).line(24, 26, 24, 36, 1).line(58, 26, 58, 36, 1), '#585868');
      node(58, 10, '#d83838');
      node(24, 40, '#3868c8', '#c08860'); node(58, 40, '#58a848', '#f0c098');
      flat(p, M(p).line(24, 46, 24, 54, 1).line(58, 46, 58, 54, 1), '#585868');
      node(24, 60, '#e87820', '#8a5838'); node(58, 60, '#7848b8');
      // this one's on its way out, and the new box hasn't got anybody in it
      flat(p, M(p).line(92, 26, 92, 35, 1), '#a8a098');
      for (const [x, y, w, h] of [[83, 34, 18, 1], [83, 46, 18, 1], [83, 34, 1, 13], [100, 34, 1, 13]]) for (let i = 0; i < w + h; i += 2) p.set(x + (w > 1 ? i : 0), y + (h > 1 ? i : 0), '#585868');
      words(p, '?', 89, 37, '#d83838');
      node(101, 63, '#2c98a8', '#f8d0a8');
      flat(p, M(p).line(95, 54, 98, 58, 1).line(106, 52, 104, 57, 1), '#d83838');
      flat(p, M(p).line(90, 56, 112, 70, 2).line(112, 56, 90, 70, 2), '#d83838');
      // and the arrows, going every way at once
      arc(p, 76, 58, 9, 0.2, 2.6, '#3c3448'); arc(p, 76, 58, 10, 0.2, 2.6, '#3c3448');
      flat(p, M(p).poly([[85, 55], [90, 63], [80, 62]]), '#3c3448');
      flat(p, M(p).poly([[62, 56], [74, 50], [72, 60]]), '#3c3448');
    },
    // It's alive, and it wants more paper. u: how far round its loop it is.
    printer(p, u = 0) {
      p.box(0, 0, ART_W, ART_H, '#1c1428');
      const pulse = Math.sin(u * Math.PI * 2), flap = Math.round(pulse * 3), b = Math.round(pulse);
      rays(p, 59, 34, 16, '#30183c', u * Math.PI * 2 / 16, 0, 62);
      p.box(0, 62, ART_W, 13, '#2c2038'); p.box(0, 62, ART_W, 1, '#100c18');
      for (let i = 0; i < 4; i++) { const v = (u + i / 4) % 1; fig(p, M(p).ell(18 + i * 26 + Math.sin(v * 6) * 3, 28 - v * 24, 2 + v * 5), '#584868', { sh: [1, 1], hi: 0, line: '#2c2038' }); }
      // the body
      fig(p, M(p).rbox(20, 18 + b, 78, 44, 3), '#c8c4c0', { sh: [4, 3], hi: [2, 2], deep: [2, 2] });
      fig(p, M(p).box(26, 12 + b, 66, 8), '#a8a4a0', { sh: [1, 1], hi: [1, 1] });
      for (let x = 32; x < 88; x += 8) p.box(x, 14 + b, 5, 2, '#f4f4ec');
      // eyes
      const eye = (x, way) => {
        fig(p, M(p).poly([[x - 9, 25 + b + (way > 0 ? 3 : 0)], [x + 9, 25 + b + (way < 0 ? 3 : 0)], [x + 8, 36 + b], [x - 8, 36 + b]]), '#f83020', { sh: 0, hi: 0 });
        p.box(x - 2, 30 + b, 4, 5, '#fff0a0');
        fig(p, M(p).poly([[x - 11, 22 + b + (way > 0 ? 3 : 0)], [x + 11, 22 + b + (way < 0 ? 3 : 0)], [x + 11, 26 + b + (way < 0 ? 3 : 0)], [x - 11, 26 + b + (way > 0 ? 3 : 0)]]), '#26222c', { sh: 0, hi: 0, line: null });
      };
      eye(42, 1); eye(76, -1);
      // its mouth, and its long paper tongue
      fig(p, M(p).rbox(30, 41 + b, 58, 13, 1), '#26222c', { sh: 0, hi: 0 });
      for (let x = 33; x < 86; x += 6) { flat(p, M(p).poly([[x, 41 + b], [x + 5, 41 + b], [x + 2.5, 46 + b]]), '#f4f4ec'); flat(p, M(p).poly([[x, 54 + b], [x + 5, 54 + b], [x + 2.5, 49 + b]]), '#f4f4ec'); }
      const tongue = M(p).poly([[48, 47 + b], [72, 47 + b], [75 + flap, 62], [73 - flap, 72], [46 - flap, 72], [44 + flap, 62]]);
      fig(p, tongue, '#f8f8f0', { sh: [2, 1], hi: 0 });
      for (let y = 54; y < 71; y += 4) p.box(50 + (flap > 0 ? 1 : 0), y, 20, 1, '#a0a0a8');
      words(p, 'FEED', 49, 56, '#d83030');
      // the light on the front, and sparks off the top
      fig(p, M(p).ell(92, 57, 2.5), u * 4 % 1 < 0.5 ? '#f84030' : '#7c1810', { sh: 0, hi: 0 });
      [[14, 14, 3], [106, 12, 3], [10, 50, 2], [110, 44, 2], [60, 6, 2]].forEach(([x, y, n], i) => spark(p, x, y, i % 2 ? '#f8b0ff' : '#ff8060', (u * 2 + i * 0.29) % 1 < 0.5 ? n : 1));
    },
  });

  // ---------- Engineering ----------
  Object.assign(ART, {
    // "Don't tell anyone, but this is my third coffee."
    matthew(p) {
      p.box(0, 0, ART_W, ART_H, '#6c4630');
      rays(p, 56, 36, 14, '#7c5238', 0.2, 0, ART_H);
      for (let i = 0; i < 16; i++) { const x = (i * 43) % ART_W, y = (i * 29) % 58; fig(p, M(p).ell(x, y, 3, 2), '#4c2c1c', { sh: 0, hi: 0, line: null }); p.box(x - 2, y, 4, 1, '#6c4630'); }
      p.box(0, 64, ART_W, 11, '#a87c50'); p.box(0, 64, ART_W, 1, '#2c1c14');
      const paper = (x, y) => { fig(p, M(p).poly([[x, y], [x + 11, y], [x + 9, y + 14], [x + 2, y + 14]]), '#f4f0e0', { sh: [1, 1], hi: 0 }); p.box(x + 2, y + 5, 7, 4, '#c87830'); };
      paper(5, 51); paper(16, 51);
      const cx = 58, cy = 32, top = '#f0b030', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#5a3420', top, hairdo: 'spiky', brow: 'raised', mouth: 'grin', look: 'wide', clothes(q, x, y) { tie(q, x, y, '#d03868'); } });
      // number three, gripped in both hands
      fig(p, M(p).poly([[cx + 21, 46], [cx + 43, 46], [cx + 40, 70], [cx + 24, 70]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      fig(p, M(p).rbox(cx + 19, 42, 26, 5, 1), '#58a848', { sh: [0, 1], hi: 0 });
      words(p, '3', cx + 28, 52, '#d83838', 2);
      for (const way of [-1, 1]) fig(p, M(p).ell(cx + 32 + way * 11, 60, 5, 4), skin, { sh: [1, 1], hi: 0 });
      for (const [a, b, c, d] of [[cx - 22, 18, cx - 27, 15], [cx - 24, 28, cx - 30, 28], [cx + 22, 16, cx + 27, 12], [cx - 21, 8, cx - 25, 3], [cx + 19, 6, cx + 23, 1]]) flat(p, M(p).line(a, b, c, d, 1), '#fff0b0');
      for (let i = 0; i < 3; i++) { for (let y = 28; y < 41; y++) p.set(cx + 26 + i * 6 + Math.round(Math.sin(y / 3 + i) * 1.5), y, '#f8f4e8'); }
    },
    // "Welcome to Richmond! Help yourself to some candy."
    kiki(p) {
      p.box(0, 0, ART_W, ART_H, '#f0c8d0');
      for (let y = 0; y < 60; y += 12) for (let x = (y / 12) % 2 ? 0 : 6; x < ART_W; x += 12) fig(p, M(p).ell(x, y + 4, 1.5), '#f8e0e4', { sh: 0, hi: 0, line: null });
      fig(p, M(p).box(-2, 58, ART_W + 4, 19), '#8a5a3a', { sh: [0, 2], hi: [0, 1] });
      p.box(0, 62, ART_W, 1, '#6a4028');
      const cx = 36, cy = 31, top = '#e07898', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#201818', top, hairdo: 'curls', mouth: 'grin', look: 'shut', clothes(q, x, y) { flat(q, M(q).line(x - 8, y + 21, x, y + 30, 2).line(x + 8, y + 21, x, y + 30, 2), '#f8e070'); } });
      // the jar, nearly as big as she is
      const jar = M(p).rbox(66, 14, 44, 50, 8);
      fig(p, jar, '#d8f0f4', { sh: 0, hi: 0 });
      const CANDY = ['#d83838', '#f0c020', '#38a0d8', '#58a848', '#e878a8', '#f08020', '#9858c8'];
      for (let i = 0; i < 46; i++) { const x = 70 + (i * 17) % 36, y = 28 + (i * 11) % 32; fig(p, M(p).ell(x, y, 3, 2.5), CANDY[i % 7], { sh: [1, 1], hi: [1, 1], line: null }); }
      for (let y = 17; y < 58; y++) p.set(71, y, '#ffffff'); for (let y = 20; y < 44; y++) p.set(72, y, '#ffffff');
      fig(p, M(p).rbox(70, 7, 36, 8, 2), '#c83838', { sh: [1, 1], hi: [1, 1] });
      // one for you
      arm(p, cx + 24, 74, cx + 26, 53, top, skin, 9);
      fig(p, M(p).ell(cx + 27, 45, 3, 2.5), '#f0c020', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).poly([[cx + 21, 45], [cx + 24, 42], [cx + 24, 48]]).poly([[cx + 33, 45], [cx + 30, 42], [cx + 30, 48]]), '#f0c020');
      spark(p, 110, 4, '#ffffff', 3);
    },
    // "Sure Nik and Dmitriy can cook, but baking is where it's really at."
    jenn(p) {
      p.box(0, 0, ART_W, ART_H, '#e8d8b8');
      for (let y = 0; y < ART_H; y += 9) p.box(0, y, ART_W, 1, '#dcc8a4');
      // the oven, still warm
      fig(p, M(p).rbox(72, 8, 44, 58, 2), '#a8a8b0', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(77, 24, 34, 28), '#2c1c18', { sh: 0, hi: 0 });
      for (let y = 26; y < 50; y++) p.box(78, y, 32, 1, y < 34 ? '#783018' : y < 44 ? '#b04c1c' : '#e87c28');
      p.box(78, 39, 32, 1, '#26222c');
      for (let i = 0; i < 4; i++) fig(p, M(p).ell(80 + i * 9, 15, 3), '#585868', { sh: 0, hi: [1, 1] });
      fig(p, M(p).rbox(76, 20, 36, 3, 1), '#d8d8e0', { sh: 0, hi: 0 });
      const cx = 42, cy = 30, top = '#b83028', skin = '#f8d0a8', white = '#f4f4ee';
      person(p, cx, cy, {
        skin, hair: '#6a3c20', top, hairdo: 'bun', mouth: 'grin', look: 'shut',
        clothes(q, x, y) { fig(q, M(q).poly([[x - 16, 80], [x - 14, y + 28], [x - 8, y + 26], [x + 8, y + 26], [x + 14, y + 28], [x + 16, 80]]), white, { sh: [3, 2], hi: 0 }); },
      });
      for (const [x, y] of [[cx - 9, cy + 7], [cx - 11, cy + 9], [cx + 10, cy - 3]]) { p.box(x, y, 3, 2, '#ffffff'); }
      // the pie, in its oven mitts, with the steam coming off
      for (const [x, y] of [[cx + 1, 37], [cx + 8, 34], [cx + 15, 37]]) for (let j = 0; j < 10; j++) p.set(x + Math.round(Math.sin(j / 2) * 1.5) + 8, y - j, '#ffffff');
      fig(p, M(p).ell(cx + 16, 52, 27, 8), '#a06830', { sh: [0, 2], hi: 0 });
      fig(p, M(p).ell(cx + 16, 48, 25, 7), '#e8b060', { sh: [2, 2], hi: [2, 1] });
      for (let i = -2; i <= 2; i++) flat(p, M(p).line(cx + 16 + i * 8 - 3, 44, cx + 16 + i * 8 + 3, 52, 2), '#c88840');
      for (const x of [cx - 12, cx + 44]) fig(p, M(p).rbox(x - 6, 48, 13, 13, 4), '#58a848', { sh: [1, 1], hi: [1, 1] });
    },
    // "Have you seen my Lego shelf? That spaceship took me all weekend."
    joe(p) {
      p.box(0, 0, ART_W, ART_H, '#f0c848');
      for (let i = 0; i < ART_W; i += 10) for (let j = 0; j < ART_H; j += 10) fig(p, M(p).ell(i + 5, j + 5, 2.5), '#f8d868', { sh: 0, hi: 0, line: null });
      const brick = (x, y, w, c) => { fig(p, M(p).box(x, y, w, 5), c, { sh: [1, 1], hi: [1, 1] }); for (let i = x + 1; i < x + w - 1; i += 4) p.box(i, y - 1, 2, 1, ramp(c).hi); };
      for (const y of [22, 50]) { p.box(0, y, ART_W, 3, '#7a5238'); p.box(0, y, ART_W, 1, '#a07450'); }
      brick(4, 17, 10, '#d83838'); brick(14, 17, 9, '#3868c8'); brick(6, 12, 13, '#58a848'); brick(8, 7, 8, '#f8f8f0');
      brick(4, 45, 18, '#3868c8'); brick(7, 40, 11, '#f08020');
      brick(96, 45, 18, '#d83838'); brick(99, 40, 13, '#f8f8f0'); brick(102, 35, 7, '#58a848');
      const cx = 59, cy = 36, top = '#b83028', skin = '#8a5838';
      for (const way of [-1, 1]) arm(p, cx + way * 26, 76, cx + way * 26, 24, top, skin, 9);
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'short', mouth: 'grin', look: 'wide', brow: 'raised' });
      // the spaceship, held up very carefully
      const ship = '#d8dce4';
      fig(p, M(p).poly([[18, 15], [76, 5], [102, 11], [76, 20], [28, 22]]), ship, { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).poly([[30, 7], [54, 8], [50, 14], [28, 15]]), ship, { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).rbox(68, 7, 13, 6, 2), '#58c8e8', { sh: 0, hi: [1, 1] });
      for (let x = 34; x < 66; x += 5) p.box(x, 10, 3, 3, x % 2 ? '#d83838' : '#3868c8');
      for (let x = 34; x < 66; x += 4) p.box(x, 8, 2, 1, '#ffffff');
      fig(p, M(p).poly([[18, 15], [11, 13], [11, 21], [20, 21]]), '#585868', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[11, 14], [3, 17], [11, 20]]), '#f8a020');
      spark(p, 108, 4, '#ffffff', 3);
    },
    // "I may work in the shop but the kitchen is my territory."
    chris(p) {
      p.box(0, 0, ART_W, ART_H, '#88888c');
      // half of it's the shop, half the kitchen, and he's standing on the line
      p.box(0, 0, 59, ART_H, '#6c7c88');
      for (let y = 4; y < 62; y += 6) for (let x = 3; x < 59; x += 6) p.set(x, y, '#465460');
      fig(p, M(p).line(9, 7, 9, 35, 4), '#c8d0d8', { sh: 0, hi: 0 }); fig(p, M(p).poly([[4, 3], [14, 3], [12, 11], [6, 11]]), '#c8d0d8', { sh: 0, hi: 0 });
      fig(p, M(p).line(21, 6, 21, 28, 3), '#d83838', { sh: 0, hi: 0 }); fig(p, M(p).rbox(15, 3, 13, 6, 1), '#585868', { sh: 0, hi: 0 });
      p.box(59, 0, 59, ART_H, '#e8d8a8');
      for (let y = 0; y < ART_H; y += 9) for (let x = 59 + (y % 2 ? 0 : 4); x < ART_W; x += 9) p.box(x, y, 8, 8, '#f4e4b8');
      for (const [x, r] of [[98, 7], [112, 5]]) { p.box(x, 0, 1, 8, '#585868'); fig(p, M(p).ell(x, 8 + r, r), '#b87848', { sh: [2, 2], hi: [1, 1] }); }
      // the grill, in front of him
      const cx = 59, cy = 28, top = '#808898', skin = '#f0c098';
      person(p, cx, cy, {
        skin, hair: '#5a3420', top, hairdo: 'buzz', mouth: 'grin', brow: 'raised', stache: '#5a3420',
        clothes(q, x, y) { fig(q, M(q).poly([[x - 16, 80], [x - 14, y + 29], [x - 8, y + 27], [x + 8, y + 27], [x + 14, y + 29], [x + 16, 80]]), '#f0b030', { sh: [3, 2], hi: 0 }); },
      });
      for (let i = 0; i < 9; i++) { const x = 16 + i * 11; flat(p, M(p).poly([[x - 6, 64], [x - 3, 50 + (i * 5) % 7], [x, 56], [x + 2, 46 + (i * 7) % 9], [x + 6, 64]]), i % 2 ? '#f07818' : '#f8c020'); }
      fig(p, M(p).box(4, 62, 110, 14), '#3c3844', { sh: [0, 2], hi: [0, 1] });
      for (let x = 8; x < 112; x += 6) p.box(x, 62, 2, 4, '#88888c');
      // the spatula, up like a flag
      arm(p, cx + 26, 66, cx + 32, 36, top, skin, 9);
      fig(p, M(p).line(cx + 33, 33, cx + 38, 16, 3), '#585868', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(cx + 33, 2, 13, 15, 1), '#d8e0e8', { sh: [1, 1], hi: [1, 1] });
      for (const x of [37, 41]) p.box(cx + x, 5, 1, 9, '#7c8894');
    },
    // "You're in for a good time when I MC the Christmas party."
    lam(p) {
      p.box(0, 0, ART_W, ART_H, '#241c48');
      const beam = (x, c) => flat(p, M(p).poly([[x, 0], [x + 4, 0], [x + 24, 66], [x - 20, 66]]), c);
      beam(18, '#3c2c6c'); beam(58, '#4c2c70'); beam(96, '#3c2c6c');
      p.box(0, 62, ART_W, 13, '#603818'); p.box(0, 62, ART_W, 2, '#f0c030');
      for (let x = 2; x < ART_W; x += 8) { p.box(x, 66, 2, 2, x % 16 === 2 ? '#f8e070' : '#f0a020'); }
      const CONF = ['#f83868', '#f8e070', '#58d8c8', '#88e058', '#f89838'];
      for (let i = 0; i < 40; i++) p.box((i * 47) % ART_W, (i * 31) % 58, 2, 1 + i % 2, CONF[i % 5]);
      const cx = 52, cy = 32, top = '#b83028', skin = '#8a5838';
      person(p, cx, cy, {
        skin, hair: '#8a5a3a', top, hairdo: 'quiff', mouth: 'open', brow: 'raised', look: 'shut',
        clothes(q, x, y) {
          fig(q, M(q).poly([[x - 9, y + 19], [x + 9, y + 19], [x + 5, 80], [x - 5, 80]]), '#f4f4f0', { sh: 0, hi: 0, line: null });
          fig(q, M(q).poly([[x - 9, y + 21], [x, y + 25], [x + 9, y + 21], [x + 9, y + 30], [x, y + 26], [x - 9, y + 30]]), '#2c6a34', { sh: 0, hi: 0 });
          fig(q, M(q).ell(x, y + 25, 2.5), '#58a848', { sh: 0, hi: 0, line: null });
          for (const way of [-1, 1]) fig(q, M(q).poly([[x + way * 11, y + 20], [x + way * 5, y + 28], [x + way * 7, 80], [x + way * 18, 80]]), top, { sh: 0, hi: [1, 1] });
        },
      });
      // the microphone in one hand, the other way up in the air
      fig(p, M(p).line(cx - 24, 50, cx - 14, 46, 4), '#2c2c3c', { sh: 0, hi: 0 });
      fig(p, M(p).ell(cx - 12, 45, 4), '#a8b0b8', { sh: [1, 1], hi: [1, 1] });
      arm(p, cx - 27, 76, cx - 26, 54, top, skin, 10);
      arm(p, cx + 26, 76, cx + 38, 24, top, skin, 10);
    },
    // "I taught him all he knows about being a chef."
    nik(p) {
      p.box(0, 0, ART_W, ART_H, '#2c2c34');
      for (let x = 0; x < ART_W; x += 8) for (let y = 0; y < ART_H; y += 8) p.box(x, y, 7, 7, '#383840');
      // the hood, and the range
      fig(p, M(p).poly([[10, 0], [108, 0], [118, 12], [0, 12]]), '#a8b0b8', { sh: [0, 2], hi: [0, 1] });
      const cx = 42, cy = 34, top = '#f4f4ee', skin = '#f8d8b8';
      person(p, cx, cy, {
        skin, hair: '#6a3c20', top, hairdo: 'under', mouth: 'smirk', brow: 'raised', beard: '#6a3c20',
        clothes(q, x, y) {
          for (const way of [-1, 1]) for (const dy of [28, 36, 44]) fig(q, M(q).ell(x + way * 6, y + dy, 1.5), '#808898', { sh: 0, hi: 0, line: null });
          flat(q, M(q).line(x, y + 20, x, 80, 2), '#d8d8d0');
        },
      });
      // a hat as tall as he thinks he is
      fig(p, M(p).poly([[cx - 16, cy - 12], [cx - 21, cy - 30], [cx - 10, cy - 36], [cx, cy - 34], [cx + 10, cy - 36], [cx + 21, cy - 30], [cx + 16, cy - 12]]), '#fbfbf6', { sh: [3, 2], hi: 0 });
      for (const x of [-8, 0, 8]) p.box(cx + x, cy - 28, 1, 14, '#d8d8d0');
      fig(p, M(p).rbox(cx - 17, cy - 15, 34, 8, 1), '#fbfbf6', { sh: [0, 2], hi: 0 });
      // the pan, on fire, on purpose
      for (let i = 0; i < 7; i++) { const x = 74 + i * 6; flat(p, M(p).poly([[x - 5, 54], [x - 2, 28 + (i * 7) % 12], [x, 40], [x + 3, 18 + (i * 11) % 18], [x + 5, 54]]), i % 2 ? '#f07818' : '#f8c020'); }
      for (let i = 0; i < 6; i++) { const x = 78 + i * 6; flat(p, M(p).poly([[x - 3, 54], [x, 40 + (i * 5) % 6], [x + 3, 54]]), '#fff0a0'); }
      fig(p, M(p).poly([[66, 53], [116, 53], [112, 62], [70, 62]]), '#3c3844', { sh: [1, 2], hi: [1, 0] });
      fig(p, M(p).line(cx + 12, 66, 68, 57, 4), '#2c2c34', { sh: 0, hi: 0 });
      arm(p, cx + 24, 78, cx + 22, 64, top, skin, 10);
    },
    // Everybody brought potato salad
    potluck(p) {
      p.box(0, 0, ART_W, ART_H, '#88a878');
      for (let y = 0; y < 30; y += 5) p.box(0, y, ART_W, 1, '#94b484');
      // the sign-up sheet
      fig(p, M(p).box(46, 2, 26, 22), '#f8f8f0', { sh: 0, hi: 0 });
      words(p, 'SIGN', 48, 2, '#3c3448');
      for (let y = 11; y < 22; y += 3) { p.box(49, y, 12 + (y % 5) * 2, 1, '#3868c8'); }
      // the table, with its cloth
      for (let y = 30; y < ART_H; y++) for (let x = 0; x < ART_W; x++) p.set(x, y, ((x >> 3) + (y >> 3)) % 2 ? '#d84848' : '#f4f0e8');
      const dish = (x, y, r, c, inner) => { fig(p, M(p).ell(x, y, r, r * 0.6), c, { sh: [1, 2], hi: [1, 1] }); fig(p, M(p).ell(x, y - 1, r - 3, (r - 3) * 0.55), inner, { sh: 0, hi: [1, 1], line: null }); };
      dish(20, 38, 14, '#f4f4ec', '#e8d060');
      dish(54, 42, 14, '#3868c8', '#e8d868');
      dish(95, 38, 15, '#f4f4ec', '#58a848');
      for (const [x, y] of [[90, 36], [96, 35], [100, 39], [92, 40]]) p.box(x, y, 3, 2, '#d83838');
      // a slow cooker, a plate of squares, and a bowl nobody's sure about
      fig(p, M(p).rbox(66, 50, 26, 18, 5), '#585868', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(79, 50, 13, 4), '#c8d0d8', { sh: 0, hi: [1, 1] }); fig(p, M(p).ell(79, 46, 3, 2), '#26222c', { sh: 0, hi: 0 });
      fig(p, M(p).ell(25, 62, 19, 9), '#f4f4ec', { sh: [1, 2], hi: 0 });
      for (const [x, y] of [[12, 58], [21, 56], [30, 58], [16, 63], [26, 63]]) { fig(p, M(p).box(x, y, 7, 5), '#8a5a3a', { sh: 0, hi: [1, 1] }); }
      fig(p, M(p).ell(107, 60, 11, 7), '#c8a0d8', { sh: [1, 2], hi: [1, 1] }); fig(p, M(p).ell(107, 58, 7, 3), '#a8d858', { sh: 0, hi: 0, line: null });
      words(p, '?', 104, 49, '#f8f8f0', 1);
      fig(p, M(p).line(48, 56, 60, 70, 3), '#c8d0d8', { sh: 0, hi: 0 });
    },
    // Friday, finally
    pizza(p) {
      p.box(0, 0, ART_W, ART_H, '#38989c');
      for (let i = 0; i < 14; i++) { const x = (i * 41) % ART_W, y = (i * 23) % ART_H; p.box(x, y, 8, 1, '#48a8ac'); }
      // the box, lid up
      fig(p, M(p).poly([[14, 28], [104, 28], [96, 2], [22, 2]]), '#d0a868', { sh: [1, 1], hi: [1, 1] });
      words(p, 'FRIDAY', 41, 10, '#a83020', 1);
      fig(p, M(p).poly([[6, 28], [112, 28], [118, 72], [0, 72]]), '#d0a868', { sh: [2, 2], hi: 0 });
      // the pizza
      const cx = 59, cy = 50;
      fig(p, M(p).ell(cx, cy, 46, 19), '#d89048', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).ell(cx, cy, 41, 16), '#f0c848');
      const dots = [[-28, -6], [-14, -9], [6, -10], [24, -7], [-32, 4], [-16, 2], [2, 0], [22, 3], [34, 0], [-6, 8], [12, 10], [-24, 11]];
      dots.forEach(([x, y], i) => { const c = i % 3 === 2 ? '#3c3c34' : '#c83828'; fig(p, M(p).ell(cx + x, cy + y, 4.5, 3), c, { sh: [1, 1], hi: [1, 1], line: ramp(c).deep }); });
      for (const [x, y] of [[-20, -3], [14, -3], [-2, 6], [28, 8], [-34, -1]]) p.box(cx + x, cy + y, 3, 2, '#58a848');
      for (const [a, b] of [[-46, 0], [-26, -16], [26, -16], [46, 0]]) flat(p, M(p).line(cx, cy, cx + a, cy + b, 1), '#c89838');
      // the slice someone's already got, and the cheese not letting go
      flat(p, M(p).poly([[cx, cy], [cx + 14, cy - 18], [cx + 33, cy - 14]]), '#d0a868');
      fig(p, M(p).poly([[cx + 16, cy - 10], [cx + 30, cy - 30], [cx + 50, cy - 26]]), '#f0c848', { sh: [1, 1], hi: 0 });
      fig(p, M(p).line(cx + 30, cy - 30, cx + 50, cy - 26, 4), '#d89048', { sh: 0, hi: 0 });
      fig(p, M(p).ell(cx + 33, cy - 21, 3.5, 2.5), '#c83828', { sh: 0, hi: 0, line: '#7c1810' });
      for (const x of [2, 6, 10]) for (let y = 0; y < 8; y++) p.set(cx + x + 8 + Math.round(y * 0.5), cy - 2 - y, '#f8e070');
      fig(p, M(p).ell(cx + 42, cy - 29, 7, 6), '#f0c098', { sh: [1, 1], hi: 0 });
    },
  });

  // ---------- for any deck, and the little things other cards bring in ----------
  Object.assign(ART, {
    // Keeps the whole place running
    coffeemachine(p) {
      p.box(0, 0, ART_W, ART_H, '#4c3028');
      rays(p, 59, 30, 18, '#583830', 0.1, 0, 62);
      p.box(0, 62, ART_W, 13, '#a07850'); p.box(0, 62, ART_W, 1, '#2c1c14');
      fig(p, M(p).rbox(26, 3, 66, 62, 4), '#c8d0d8', { sh: [4, 3], hi: [2, 2], deep: [2, 2] });
      fig(p, M(p).box(36, 30, 46, 30), '#2c2c34', { sh: 0, hi: 0 });
      for (const [x, c] of [[36, '#d83838'], [47, '#f0c020'], [58, '#58c858'], [69, '#3898e8']]) fig(p, M(p).rbox(x, 18, 8, 6, 1), c, { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(36, 7, 46, 8), '#142c28', { sh: 0, hi: 0 }); words(p, 'READY', 44, 7, '#58f8a8');
      // the spout, and the pour
      fig(p, M(p).rbox(52, 30, 14, 7, 1), '#7c8894', { sh: [1, 1], hi: 0 });
      p.box(57, 37, 4, 12, '#6a3c20'); p.box(58, 37, 1, 12, '#a06830');
      fig(p, M(p).poly([[49, 45], [69, 45], [67, 60], [51, 60]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      arc(p, 70, 52, 4, -1.3, 1.3, LINE); arc(p, 70, 52, 3, -1.3, 1.3, '#f8f8f0');
      p.box(51, 47, 16, 3, '#6a3c20');
      fig(p, M(p).box(40, 60, 38, 3), '#7c8894', { sh: 0, hi: 0 });
      for (const [x, o] of [[16, 0], [100, 1], [110, 2]]) for (let y = 30; y > 6; y--) p.set(x + Math.round(Math.sin(y / 3 + o) * 2.5), y + o * 3, '#d8d0c8');
      spark(p, 88, 8, '#ffffff', 3);
    },
    // A green grump off the field, with everything around it wilting. u: how far round its loop it is.
    humbug(p, u = 0) {
      for (let y = 0; y < 62; y++) p.box(0, y, ART_W, 1, y < 22 ? '#10202c' : y < 44 ? '#142c34' : '#1c3c3c');
      p.box(0, 60, ART_W, 15, '#d8e8f0');
      for (let i = 0; i < 20; i++) { const v = (u + i / 20) % 1, x = (i * 37 + Math.sin(v * 6.28 + i) * 3) % ART_W, y = v * 60; p.box(Math.round(x), Math.round(y), 2, 2, '#f8fcff'); }
      // candy canes, snapped
      for (const [x, way] of [[10, 1], [108, -1]]) {
        const y = 60;
        for (let i = 0; i < 18; i += 2) { p.box(x, y - i, 3, 2, (i / 2) % 2 ? '#f8f8f8' : '#d82828'); }
        arc(p, x + way * 3, y - 18, 3, way > 0 ? Math.PI : 0, way > 0 ? Math.PI * 2 : Math.PI, '#d82828');
      }
      const beat = Math.sin(u * Math.PI * 2), b = Math.round(beat * 2), blink = u >= 0.75 && u < 0.8125, cx = 59, cy = 38 + b;
      const dark = '#204818', coat = '#58a838';
      // horns, then a big round body
      for (const way of [-1, 1]) {
        flat(p, M(p).poly([[cx + way * 33, cy - 12], [cx + way * 38 + Math.round(beat) * way, cy - 40], [cx + way * 13, cy - 29]]), dark);
      }
      fig(p, M(p).ell(cx, cy, 34, 32), coat, { sh: [5, 4], hi: [2, 2], deep: [2, 2], line: dark });
      fig(p, M(p).ell(cx - 11, cy - 23, 13, 5), '#88d060', { sh: 0, hi: 0, line: null });
      // yellow eyes, under a scowl
      for (const way of [-1, 1]) {
        const x = cx + way * 13;
        fig(p, M(p).ell(x, cy - 2, 9, 8), blink ? coat : '#f8e048', { sh: 0, hi: 0, line: blink ? dark : LINE });
        if (!blink) { fig(p, M(p).ell(x - way * 2 + Math.round(Math.sin(u * 12.56)), cy, 4), '#181820', { sh: 0, hi: 0, line: null }); p.box(x - way * 2 + Math.round(Math.sin(u * 12.56)) - 2, cy - 2, 2, 2, '#ffffff'); }
        fig(p, M(p).line(cx + way * 28, cy - 14, cx + way * 3, cy - 6, 4), '#181820', { sh: 0, hi: 0, line: null });
      }
      // and a frown
      arc(p, cx, cy + 27, 17, -2.3, -0.8, '#181820'); arc(p, cx, cy + 28, 17, -2.3, -0.8, '#181820');
      p.box(cx - 8, cy + 11, 3, 3, '#f8f8f8'); p.box(cx + 6, cy + 11, 3, 3, '#f8f8f8');
      words(p, 'BAH', 91, 4 - b, '#f8e048', 1);
    },
    // "Ooooo... has anyone seen my stapler?" u: how far round her loop she is.
    linda(p, u = 0) {
      p.box(0, 0, ART_W, ART_H, '#1c2448');
      const beat = Math.sin(u * Math.PI * 2), b = Math.round(beat * 3);
      // the rack room, with its little lights
      for (const x of [2, 84]) {
        fig(p, M(p).box(x, 3, 32, 60), '#262c44', { sh: [1, 1], hi: [1, 1] });
        for (let y = 8; y < 60; y += 7) { p.box(x + 3, y, 26, 5, '#1c1c30'); for (let i = 0; i < 4; i++) p.box(x + 6 + i * 4, y + 2, 2, 1, ((i * 3 + y + Math.floor(u * 8)) % 5) ? '#28d868' : '#f83838'); }
      }
      p.box(0, 63, ART_W, 12, '#14182c'); p.box(0, 63, ART_W, 1, '#3c4468');
      // a glow round her
      for (let r = 34; r > 22; r -= 4) flat(p, M(p).ell(59, 34 + b, r, r - 2), r > 30 ? '#242e58' : r > 26 ? '#2c3868' : '#384878');
      // the sheet, its hem rippling
      const sheet = M(p).ell(59, 24 + b, 22, 21).box(37, 24 + b, 44, 30);
      for (let i = 0; i < 5; i++) { const x = 37 + i * 9, drop = Math.round(Math.sin(u * Math.PI * 4 + i * 1.4) * 2); sheet.ell(x + 4.5, 54 + b + drop, 5, 6 + drop); }
      fig(p, sheet, '#f4f4fc', { sh: [5, 3], hi: [2, 1], deep: [2, 2] });
      // her eyes, and her mouth going "oooo"
      for (const x of [50, 68]) fig(p, M(p).ell(x, 24 + b, 4, 6), '#1c1c2c', { sh: 0, hi: 0, line: null });
      fig(p, M(p).ell(59, 38 + b, 5, 6 + Math.round((beat + 1))), '#1c1c2c', { sh: 0, hi: 0, line: null });
      // her arms out, and floating past them, the stapler she's lost
      for (const way of [-1, 1]) fig(p, M(p).line(59 + way * 20, 34 + b, 59 + way * 33, 26 - b, 7), '#f4f4fc', { sh: [1, 1], hi: 0 });
      const s = Math.round(Math.sin(u * Math.PI * 4) * 2), sx = 92, sy = 48 - s;
      fig(p, M(p).rbox(sx, sy, 20, 5, 1), '#d82828', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).poly([[sx, sy - 1], [sx + 18, sy - 7], [sx + 20, sy - 4], [sx + 3, sy + 1]]), '#f03838', { sh: [1, 1], hi: [1, 0] });
      fig(p, M(p).rbox(sx - 1, sy + 5, 22, 2, 0), '#585868', { sh: 0, hi: 0, line: null });
      [[24, 10, 3], [94, 16, 2], [10, 56, 2]].forEach(([x, y, n], i) => spark(p, x, y, '#c8d8ff', (u * 2 + i * 0.3) % 1 < 0.5 ? n : 1));
      words(p, 'Boo', 13, 4 + b, '#c8d8ff', 1);
    },
    // Two of them, one after the other
    doubleshot(p) {
      p.box(0, 0, ART_W, ART_H, '#2c1c18');
      rays(p, 59, 34, 16, '#3c2820', 0, 0, 62);
      p.box(0, 60, ART_W, 15, '#8a5a3a'); p.box(0, 60, ART_W, 1, '#1c100c');
      for (const x of [24, 66]) {
        fig(p, M(p).poly([[x, 28], [x + 28, 28], [x + 24, 58], [x + 4, 58]]), '#f8f8f0', { sh: [3, 2], hi: [2, 1] });
        fig(p, M(p).poly([[x + 3, 31], [x + 25, 31], [x + 24, 41], [x + 4, 41]]), '#4c2814', { sh: 0, hi: 0, line: null });
        p.box(x + 4, 31, 20, 2, '#c88840');
        fig(p, M(p).ell(x + 14, 62, 19, 3), '#f8f8f0', { sh: [0, 1], hi: 0 });
        for (const o of [6, 14, 22]) for (let y = 25; y > 4; y--) p.set(x + o + Math.round(Math.sin(y / 3 + o) * 2), y, '#d8d0c8');
      }
    },
    // Careful where you step
    legobrick(p) {
      p.box(0, 0, ART_W, ART_H, '#7c98b0');
      for (let y = 0; y < ART_H; y += 4) p.box(0, y, ART_W, 1, '#7490a8');
      for (const [x, y] of [[8, 58], [100, 10], [20, 12], [104, 62]]) spark(p, x, y, '#f8f8f0', 3);
      // the top, then its front
      for (const [x0, y0] of [[0, 0]]) {
        flat(p, M(p).poly([[20 + x0, 33 + y0], [79 + x0, 24 + y0], [100 + x0, 34 + y0], [41 + x0, 44 + y0]]), '#e84838');
        fig(p, M(p).poly([[20, 33], [41, 44], [41, 66], [20, 54]]), '#a82820', { sh: 0, hi: 0 });
        fig(p, M(p).poly([[41, 44], [100, 34], [100, 56], [41, 66]]), '#c83028', { sh: [1, 1], hi: 0 });
      }
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const x = 37 + i * 15 - j * 9, y = 36 - i * 2.2 - j * 4.5 + 0.5;
        fig(p, M(p).ell(x, y, 6, 3).box(x - 6, y - 4, 12, 4).ell(x, y - 4, 6, 3), '#f05848', { sh: [1, 1], hi: [1, 1], line: '#7c1810' });
      }
    },
    // Whose is this?
    leftovers(p) {
      p.box(0, 0, ART_W, ART_H, '#d8e8ec');
      for (const y of [22, 52]) { p.box(0, y, ART_W, 3, '#a8c0c8'); p.box(0, y, ART_W, 1, '#f4fcff'); }
      fig(p, M(p).rbox(4, 4, 18, 18, 2), '#58a848', { sh: [1, 1], hi: [1, 1] }); fig(p, M(p).rbox(96, 8, 18, 14, 2), '#f08020', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).rbox(92, 34, 24, 18, 2), '#e8d868', { sh: [1, 1], hi: [1, 1] });
      // the container nobody's opened since March
      fig(p, M(p).rbox(26, 22, 66, 30, 3), '#d8e0dc', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).rbox(30, 26, 58, 22, 2), '#88a868');
      for (const [x, y, r] of [[40, 34, 5], [54, 38, 6], [72, 32, 7], [80, 42, 4]]) fig(p, M(p).ell(x, y, r), '#a8c078', { sh: [1, 1], hi: [1, 1], line: '#688048' });
      fig(p, M(p).rbox(24, 16, 70, 8, 2), '#3898c8', { sh: [0, 2], hi: [0, 1] });
      fig(p, M(p).box(38, 28, 42, 14), '#f8f8f0', { sh: 0, hi: 0 }); words(p, 'MINE', 47, 30, '#3c3448');
      for (const [x, o] of [[34, 0], [58, 2], [84, 4]]) for (let y = 14; y > 2; y--) p.set(x + Math.round(Math.sin(y / 2 + o) * 2), y, '#88b858');
      flat(p, M(p).ell(59, 62, 34, 4), '#c8d8dc');
    },
  });

  // ---------- the starter deck: nobody in particular, but you'd know them anywhere ----------
  Object.assign(ART, {
    coop(p) {
      p.box(0, 0, ART_W, ART_H, '#2c5848');
      p.box(0, 0, ART_W, 3, '#7a5238'); p.box(0, 62, ART_W, 3, '#7a5238'); p.box(0, 65, ART_W, 10, '#8c8c98');
      words(p, 'CFM ?', 4, 8, '#e8f0e8'); words(p, 'A x V', 8, 20, '#e8f0e8'); flat(p, M(p).line(72, 14, 112, 14, 1).line(92, 14, 92, 34, 1), '#e8f0e8'); words(p, '?', 100, 20, '#f8e070', 2);
      const cx = 59, cy = 32, top = '#7848b8', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#201818', top, hairdo: 'bob', brow: 'raised', mouth: 'smile', specs: '#c83868', clothes(q, x, y) { for (const way of [-1, 1]) fig(q, M(q).line(x + way * 17, y + 22, x + way * 20, 80, 5), '#d88030', { sh: 0, hi: [1, 0] }); } });
      // books, a few more than anyone can carry
      const book = (x, y, w, c) => { fig(p, M(p).rbox(x, y, w, 6, 1), c, { sh: [0, 1], hi: 0 }); p.box(x + 3, y + 2, w - 6, 1, '#f8f4e0'); };
      book(cx + 16, 67, 30, '#d83838'); book(cx + 18, 61, 26, '#3868c8'); book(cx + 15, 55, 30, '#58a848'); book(cx + 19, 49, 24, '#f0c020'); book(cx + 16, 43, 28, '#e87820');
      fig(p, M(p).ell(cx + 16, 71, 4), skin, { sh: 0, hi: 0 }); fig(p, M(p).ell(cx + 46, 71, 4), skin, { sh: 0, hi: 0 });
    },
    temp(p) {
      p.box(0, 0, ART_W, ART_H, '#c8b890');
      for (let y = 0; y < ART_H; y += 2) for (let x = y % 4 ? 0 : 2; x < ART_W; x += 4) p.set(x, y, '#bcac84');
      p.box(0, 0, ART_W, 3, '#8c8068'); p.box(0, 66, ART_W, 9, '#7c7468');
      // a desk with nothing on it, not even a name
      fig(p, M(p).box(84, 16, 30, 16), '#f4f0e0', { sh: 0, hi: 0 }); for (let i = 0; i < 28; i += 2) p.box(85 + i, 23, 1, 1, '#b8b0a0');
      const cx = 46, cy = 32, top = '#808898', skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top, hairdo: 'buzz', mouth: 'nervous', brow: 'worried', look: 'side' });
      // everything they've brought, for however long it is
      fig(p, M(p).poly([[cx + 13, 58], [cx + 52, 58], [cx + 49, 76], [cx + 16, 76]]), '#c89858', { sh: [2, 2], hi: [1, 1] });
      p.box(cx + 13, 63, 39, 2, '#e8c888');
      fig(p, M(p).poly([[cx + 26, 44], [cx + 42, 44], [cx + 40, 58], [cx + 28, 58]]), '#c86838', { sh: [1, 1], hi: [1, 1] });
      for (const [a, b, c, d] of [[34, 44, 26, 30], [34, 44, 34, 26], [34, 44, 42, 32], [34, 44, 30, 34]]) fig(p, M(p).line(cx + a, b, cx + c, d, 3), '#48a048', { sh: 0, hi: 0 });
      fig(p, M(p).box(cx - 13, 56, 22, 16), '#f8e858', { sh: [1, 1], hi: 0, line: '#b8a828' }); words(p, 'TEMP', cx - 12, 60, '#3c3448');
    },
    newhire(p) {
      p.box(0, 0, ART_W, ART_H, '#8cc8e8');
      fig(p, M(p).box(-2, 2, ART_W + 4, 13), '#f8f4e0', { sh: [0, 1], hi: 0 });
      words(p, 'WELCOME!', 34, 5, '#d83838');
      const CONF = ['#f83868', '#f8e070', '#58a848', '#7848b8', '#f89838'];
      for (let i = 0; i < 44; i++) p.box((i * 43) % ART_W, 16 + (i * 29) % 50, 2, 2, CONF[i % 5]);
      const cx = 42, cy = 35, top = '#f8f8f8', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top, hairdo: 'curly', mouth: 'grin', look: 'wide', brow: 'raised', clothes(q, x, y) { tie(q, x, y, '#3868c8'); fig(q, M(q).box(x + 13, y + 28, 8, 11), '#f8f8f0', { sh: 0, hi: 0 }); q.box(x + 15, y + 30, 4, 4, '#3868c8'); } });
      // the handbook, all of it
      fig(p, M(p).rbox(72, 26, 40, 46, 2), '#b83028', { sh: [3, 3], hi: [1, 1] });
      p.box(70, 28, 3, 42, '#f4f0e0'); words(p, 'RULES', 77, 32, '#f8e070', 1); words(p, 'VOL 1', 77, 42, '#f8e070', 1);
      for (let i = 0; i < 3; i++) p.box(76, 55 + i * 4, 32, 1, '#7c1810');
      arm(p, cx + 25, 76, cx + 31, 56, top, skin, 10);
    },
    receptionist(p) {
      p.box(0, 0, ART_W, ART_H, '#a8c0d0');
      p.box(0, 0, ART_W, 3, '#c8d8e4');
      fig(p, M(p).poly([[94, 56], [100, 56], [103, 40], [91, 40]]), '#c87838', { sh: 0, hi: 0 });
      for (const [a, b, c] of [[97, 40, -10], [97, 40, 10], [97, 40, 0]]) fig(p, M(p).ell(a + c, b - 11 + Math.abs(c) / 2, 5, 11), '#48a058', { sh: [1, 1], hi: [1, 1] });
      words(p, 'HELLO', 5, 8, '#3868c8');
      const cx = 49, cy = 30, top = '#d83868', skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#6a3c20', top, hairdo: 'bun', mouth: 'smile', brow: 'raised' });
      headset(p, cx, cy);
      // the desk, the bell, and all the lines ringing at once
      fig(p, M(p).box(-2, 56, ART_W + 4, 21), '#6a4830', { sh: [0, 2], hi: [0, 2] });
      p.box(0, 62, ART_W, 1, '#4c3020');
      fig(p, M(p).rbox(79, 45, 30, 12, 2), '#3c3c4c', { sh: [1, 1], hi: [1, 1] });
      for (let i = 0; i < 5; i++) p.box(83 + i * 5, 49, 3, 3, i % 2 ? '#f03838' : '#40d870');
      fig(p, M(p).ell(18, 52, 8, 6).box(0, 53, ART_W, 10, 0), '#f0c030', { sh: [2, 1], hi: [1, 1] });
      fig(p, M(p).ell(18, 45, 2), '#f0c030', { sh: 0, hi: 0 });
      p.box(9, 53, 18, 2, '#a07820');
      for (const r of [11, 14]) { arc(p, 18, 47, r, -2.6, -2, '#26222c'); arc(p, 18, 47, r, -1.1, -0.5, '#26222c'); }
    },
    courier(p) {
      p.box(0, 0, ART_W, ART_H, '#e88838');
      for (const [y, x, n] of [[8, 4, 30], [18, 72, 44], [28, 0, 22], [46, 82, 34], [58, 2, 26], [66, 74, 40], [38, 90, 22]]) p.box(x, y, n, 2, '#f8b060');
      const cx = 62, cy = 31, top = '#38a0a0', skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#201818', top, hairdo: 'under', mouth: 'open', brow: 'angry', look: 'side' });
      ballCap(p, cx, cy, '#26222c', 1);
      // the parcel, tucked under one arm
      fig(p, M(p).rbox(cx - 49, 40, 36, 28, 1), '#c89858', { sh: [2, 2], hi: [1, 1] });
      p.box(cx - 34, 40, 6, 28, '#e8c888');
      fig(p, M(p).box(cx - 48, 44, 12, 8), '#f8f8f0', { sh: 0, hi: 0 }); p.box(cx - 46, 46, 8, 1, '#585868'); p.box(cx - 46, 49, 6, 1, '#585868');
      arm(p, cx - 26, 76, cx - 22, 58, top, skin, 10);
      arm(p, cx + 26, 76, cx + 37, 50, top, skin, 10);
    },
    apprentice(p) {
      p.box(0, 0, ART_W, ART_H, '#1c2030');
      // the arc, and the light it throws
      rays(p, 24, 56, 22, '#2c3454', 0.1);
      for (const r of [28, 18, 10]) flat(p, M(p).ell(24, 56, r, r), r > 20 ? '#3c5088' : r > 12 ? '#88a8e8' : '#f0f8ff');
      for (let i = 0; i < 26; i++) { const a = -0.4 - (i * 0.37) % 2.4, d = 8 + (i * 13) % 34; p.box(24 + Math.cos(a) * d, 56 + Math.sin(a) * d, 2, 2, i % 2 ? '#ffe880' : '#ff9838'); }
      fig(p, M(p).box(-2, 64, 58, 12), '#585868', { sh: [0, 1], hi: [0, 1] });
      const cx = 72, cy = 36, top = '#6c4c34', skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#b87830', top, hairdo: 'under', mouth: 'grin', look: 'wide', brow: 'raised' });
      // the mask, flipped up
      fig(p, M(p).poly([[cx - 18, cy - 8], [cx - 20, cy - 26], [cx - 10, cy - 34], [cx + 10, cy - 34], [cx + 20, cy - 26], [cx + 18, cy - 8]]), '#3c4048', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).rbox(cx - 11, cy - 27, 22, 9, 1), '#20d870', { sh: 0, hi: 0 }); p.box(cx - 9, cy - 26, 8, 1, '#a0f8c8');
      // the torch, in a big glove
      fig(p, M(p).line(cx - 26, 62, cx - 45, 56, 4), '#c8d0d8', { sh: 0, hi: 0 });
      arm(p, cx - 26, 76, cx - 27, 62, top, '#c89858', 11);
    },
    assembler(p) {
      BACKS.plant(p);
      const cx = 39, cy = 33, top = '#3060a0', skin = '#c08860';
      person(p, cx, cy, {
        skin, hair: '#201818', top, hairdo: 'bald', mouth: 'smile', beard: '#201818',
        clothes(q, x, y) { flat(q, M(q).line(x, y + 21, x, 80, 2), ramp(top).deep); for (const way of [-1, 1]) q.box(x + way * 8 - 3, y + 29, 7, 6, ramp(top).shade); },
      });
      // the fan going together
      fig(p, M(p).rbox(66, 16, 50, 50, 2), '#a8b0b8', { sh: [3, 3], hi: [1, 1] });
      flat(p, M(p).ell(91, 41, 20), '#283040');
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7 + 0.3, b = a + 0.55; flat(p, M(p).poly([[91 + Math.cos(a) * 4, 41 + Math.sin(a) * 4], [91 + Math.cos(a) * 19, 41 + Math.sin(a) * 19], [91 + Math.cos(b) * 19, 41 + Math.sin(b) * 19]]), i % 2 ? '#d8d8e0' : '#a8b4c0'); }
      fig(p, M(p).ell(91, 41, 5), '#e8a030', { sh: [1, 1], hi: [1, 1] });
      for (const [x, y] of [[69, 19], [112, 19], [69, 62], [112, 62]]) fig(p, M(p).ell(x, y, 2), '#585868', { sh: 0, hi: 0, line: null });
      // the wrench on the last bolt
      arm(p, cx + 24, 76, cx + 29, 58, top, skin, 10);
      fig(p, M(p).line(cx + 30, 57, 68, 62, 4), '#d8e0e8', { sh: [1, 1], hi: 0 });
    },
    bookkeeper(p) {
      p.box(0, 0, ART_W, ART_H, '#e8ecd4');
      for (let y = 3; y < ART_H; y += 5) p.box(0, y, ART_W, 1, '#c0d0b0');
      for (const x of [10, 86, 104]) p.box(x, 0, 1, ART_H, '#e0a8a0');
      const cx = 40, cy = 34, top = '#f4f4f0', skin = '#f8d8b8';
      person(p, cx, cy, {
        skin, hair: '#a8a8b0', top, hairdo: 'sidepart', mouth: 'flat', brow: 'raised', specs: '#3c3c48',
        clothes(q, x, y) { fig(q, M(q).poly([[x - 8, y + 22], [x, y + 26], [x + 8, y + 22], [x + 8, y + 30], [x, y + 27], [x - 8, y + 30]]), '#d83838', { sh: 0, hi: 0 }); },
      });
      // an eye shade, the old way
      fig(p, M(p).poly([[cx - 19, cy - 6], [cx + 19, cy - 6], [cx + 13, cy - 13], [cx - 13, cy - 13]]), '#30a868', { sh: [0, 1], hi: [0, 1] });
      // the adding machine, and its tape, all over everything
      fig(p, M(p).rbox(70, 44, 44, 26, 2), '#585868', { sh: [2, 2], hi: [1, 1] });
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) p.box(74 + i * 6, 52 + r * 6, 4, 4, i === 5 ? '#d83838' : '#d8d8d0');
      const tape = M(p);
      for (let i = 0; i < 90; i++) { const v = i / 90; tape.ell(92 - v * 4 + Math.sin(v * 9) * 15, 44 - v * 38, 3, 2.5); }
      fig(p, tape, '#f8f8f0', { sh: 0, hi: 0 });
      for (let i = 8; i < 90; i += 9) { const v = i / 90; p.box(88 - v * 4 + Math.sin(v * 9) * 15, 44 - v * 38, 6, 1, '#585868'); }
    },
    safety(p) {
      p.box(0, 0, ART_W, ART_H, '#585c64');
      for (const y of [12, 50]) for (let x = 0; x < ART_W; x++) for (let j = 0; j < 7; j++) p.set(x, y + j + Math.round(x * 0.05), ((x + j) >> 2) % 2 ? '#f8d020' : '#26222c');
      // cones
      for (const x of [10, 100]) { fig(p, M(p).poly([[x - 7, 70], [x, 46], [x + 7, 70]]), '#f07820', { sh: [2, 0], hi: [1, 0] }); p.box(x - 4, 58, 8, 3, '#f8f8f0'); p.box(x - 10, 70, 20, 4, '#f07820'); }
      const cx = 52, cy = 35, top = '#f07820', skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top, hairdo: 'ponytail', mouth: 'flat', brow: 'angry', clothes(q, x, y) { hiVis(q, x, y, '#f8f040'); } });
      hardHat(p, cx, cy, '#f07820');
      // the paddle, and you aren't getting past it
      arm(p, cx + 26, 76, cx + 34, 58, top, skin, 10);
      fig(p, M(p).box(cx + 33, 28, 3, 30), '#26222c', { sh: 0, hi: 0 });
      const o = 15, X = cx + 35, Y = 19;
      fig(p, M(p).poly([[X - o, Y - 7], [X - 7, Y - o], [X + 7, Y - o], [X + o, Y - 7], [X + o, Y + 7], [X + 7, Y + o], [X - 7, Y + o], [X - o, Y + 7]]), '#d82828', { sh: 0, hi: 0 });
      words(p, 'STOP', X - 12, Y - 3, '#ffffff');
    },
    salesrep(p) {
      for (let y = 0; y < ART_H; y++) p.box(0, y, ART_W, 1, y < 25 ? '#3878c8' : y < 50 ? '#58a0e0' : '#88c4f0');
      rays(p, 59, 34, 18, '#68b0e8', 0.1);
      const cx = 56, cy = 33, top = '#283878', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#181010', top, hairdo: 'quiff', mouth: 'grin', brow: 'raised', clothes(q, x, y) { tie(q, x, y, '#d83838', top); } });
      // the teeth, and the thumb
      spark(p, cx + 8, cy + 9, '#ffffff', 5);
      arm(p, cx + 26, 76, cx + 37, 50, top, skin, 10);
      fig(p, M(p).rbox(cx + 35, 34, 6, 14, 2), skin, { sh: [1, 1], hi: 0 });
      // this quarter's brochure
      fig(p, M(p).poly([[cx - 49, 34], [cx - 22, 28], [cx - 19, 64], [cx - 46, 70]]), '#f8f8f0', { sh: [1, 1], hi: 0 });
      words(p, 'BUY', cx - 44, 36, '#d83838');
      fig(p, M(p).poly([[cx - 42, 45], [cx - 27, 42], [cx - 25, 58], [cx - 40, 61]]), '#58a848', { sh: 0, hi: 0, line: null });
      arm(p, cx - 26, 76, cx - 32, 66, top, skin, 10);
    },
    foreman(p) {
      BACKS.plant(p, true);
      little(p, 14, 45, { top: '#f0b030', skin: '#f0c098', hair: '#5a3420' });
      little(p, 104, 44, { top: '#58a848', skin: '#8a5838', hair: '#181010', up: true });
      const cx = 59, cy = 34, top = '#3c5c8c', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#807878', top, hairdo: 'under', mouth: 'flat', brow: 'angry', stache: '#807878' });
      hardHat(p, cx, cy, '#f8f8f4');
      // arms folded, a radio on the shoulder
      fig(p, M(p).rbox(cx - 30, 60, 42, 12, 5), top, { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).rbox(cx - 12, 64, 42, 11, 5), top, { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(cx - 25, 67, 5), skin, { sh: [1, 1], hi: 0 }); fig(p, M(p).ell(cx + 27, 69, 5), skin, { sh: [1, 1], hi: 0 });
      fig(p, M(p).rbox(cx + 20, 49, 9, 12, 1), '#26222c', { sh: 0, hi: [1, 1] }); p.box(cx + 26, 41, 1, 8, '#26222c'); p.set(cx + 22, 52, '#f03838');
    },
    estimator(p) {
      p.box(0, 0, ART_W, ART_H, '#d8c8a0');
      // the plans, covering everything
      fig(p, M(p).poly([[52, 8], [118, 3], [118, 72], [52, 72]]), '#2c5898', { sh: 0, hi: 0 });
      for (let x = 58; x < ART_W; x += 8) p.box(x, 6, 1, 66, '#3c68a8');
      for (let y = 12; y < 72; y += 8) p.box(53, y, 66, 1, '#3c68a8');
      for (const [x, y, w, h] of [[62, 16, 40, 1], [62, 40, 40, 1], [62, 16, 1, 25], [101, 16, 1, 25], [82, 16, 1, 25]]) p.box(x, y, w, h, '#f0f4f8');
      words(p, 'COST?', 66, 45, '#f8e070'); flat(p, M(p).line(62, 58, 112, 58, 1), '#f0f4f8'); p.box(62, 56, 1, 5, '#f0f4f8'); p.box(112, 56, 1, 5, '#f0f4f8');
      const cx = 29, cy = 34, top = '#58a848', skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#d06030', top, hairdo: 'long', mouth: 'flat', look: 'side', brow: 'raised' });
      // a pencil behind the ear, and a tape measure, running out
      fig(p, M(p).line(cx + 9, cy - 11, cx + 27, cy - 5, 3), '#f0c020', { sh: 0, hi: 0 }); p.box(cx + 26, cy - 7, 3, 3, '#f8a0a0');
      fig(p, M(p).rbox(cx + 22, 56, 16, 15, 3), '#f0c020', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(cx + 37, 62, 40, 4), '#f8f0a0', { sh: 0, hi: 0 });
      for (let x = cx + 40; x < cx + 76; x += 4) p.box(x, 62, 1, 2, '#26222c');
      arm(p, cx + 20, 76, cx + 26, 68, top, skin, 9);
    },
    maintenance(p) {
      p.box(0, 0, ART_W, ART_H, '#b0b8b0');
      // the ceiling, with one tube out of four still going
      p.box(0, 0, ART_W, 12, '#e8e8e0');
      for (let x = 0; x < ART_W; x += 20) p.box(x, 0, 1, 12, '#a8a8a0');
      p.box(0, 12, ART_W, 1, '#6c746c');
      fig(p, M(p).box(58, 1, 50, 9), '#f8f8f0', { sh: 0, hi: 0 });
      p.box(60, 3, 46, 2, '#fffff0');
      // the ladder
      for (const x of [20, 40]) fig(p, M(p).box(x, 18, 3, 57), '#d89038', { sh: [1, 0], hi: [1, 0] });
      for (let y = 22; y < ART_H; y += 9) p.box(22, y, 18, 3, '#d89038');
      const cx = 66, cy = 37, top = '#38a0a0', skin = '#d8a070';
      person(p, cx, cy, {
        skin, hair: '#5a3420', top, hairdo: 'under', mouth: 'smile', look: 'side', brow: 'raised',
        clothes(q, x, y) { fig(q, M(q).rbox(x - 30, 67, 60, 9, 1), '#7a5238', { sh: [0, 1], hi: [0, 1] }); for (const a of [-20, -8, 6, 18]) fig(q, M(q).box(x + a, 60, 3, 9), '#c8d0d8', { sh: 0, hi: 0 }); },
      });
      ballCap(p, cx, cy, '#d83838', 1);
      // the new one, on its way up
      arm(p, cx + 24, 76, cx + 36, 30, top, skin, 10);
      fig(p, M(p).box(cx + 18, 21, 34, 5), '#f8f8f0', { sh: [0, 1], hi: 0 });
      p.box(cx + 16, 21, 2, 5, '#a8a8a0'); p.box(cx + 52, 21, 2, 5, '#a8a8a0');
    },
    nightshift(p) {
      p.box(0, 0, ART_W, ART_H, '#14183c');
      // the only window, and it's three in the morning
      fig(p, M(p).box(70, 6, 42, 34), '#101434', { sh: 0, hi: 0, line: '#5c6488' });
      fig(p, M(p).ell(98, 18, 8), '#f8f0c8', { sh: 0, hi: 0, line: null }); flat(p, M(p).ell(102, 16, 7), '#101434');
      for (const [x, y] of [[76, 11], [86, 27], [76, 32], [106, 34], [84, 14]]) p.box(x, y, 1, 1, '#ffffff');
      p.box(91, 6, 1, 34, '#5c6488'); p.box(70, 23, 42, 1, '#5c6488');
      flat(p, M(p).poly([[34, 0], [36, 0], [70, 66], [0, 66]]), '#20284c');
      p.box(0, 66, ART_W, 9, '#2c3050');
      fig(p, M(p).rbox(4, 5, 16, 16, 7), '#e8e8e0', { sh: 0, hi: 0 }); flat(p, M(p).line(12, 13, 12, 7, 1).line(12, 13, 8, 13, 1), '#26222c');
      const cx = 36, cy = 36, top = '#2c3c68', skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#5a3420', top, hairdo: 'spiky', mouth: 'flat', look: 'tired', brow: 'worried', clothes(q, x, y) { fig(q, M(q).box(x + 8, y + 27, 12, 8), '#f0b030', { sh: 0, hi: 0 }); } });
      for (const way of [-1, 1]) p.box(cx + (way < 0 ? -9 : 4), cy + 6, 5, 1, '#7c5c6c');
      // a thermos the size of a fire extinguisher
      fig(p, M(p).rbox(72, 42, 19, 30, 3), '#3898a0', { sh: [3, 2], hi: [2, 1] });
      fig(p, M(p).rbox(74, 36, 15, 8, 2), '#c8d0d8', { sh: [1, 1], hi: [1, 1] });
      p.box(75, 52, 13, 2, '#d8f0f0');
      words(p, 'z', 64, 26, '#a8b4e8');
    },
    driver(p) {
      for (let y = 0; y < 38; y++) p.box(0, y, ART_W, 1, y < 16 ? '#f0a860' : '#f8c880');
      for (const [x, w, h, c] of [[0, 22, 26, '#a87868'], [24, 18, 18, '#987068'], [94, 24, 28, '#a87868'], [82, 12, 14, '#987068']]) { p.box(x, 38 - h, w, h, c); for (let i = 3; i < w - 2; i += 5) for (let j = 4; j < h; j += 7) p.box(x + i, 38 - h + j, 2, 3, '#f8e8a8'); }
      p.box(0, 38, ART_W, 37, '#4c4c58');
      p.box(0, 38, ART_W, 2, '#a8a8b0');
      for (let i = 0; i < 7; i++) flat(p, M(p).poly([[57, 60 + i * 3 - 3], [61, 60 + i * 3 - 3], [62, 62 + i * 3], [56, 62 + i * 3]]), i % 2 ? '#4c4c58' : '#f0d860');
      // the van, coming straight at you
      fig(p, M(p).rbox(24, 8, 70, 58, 5), '#f4f4ec', { sh: [3, 3], hi: [1, 1] });
      fig(p, M(p).rbox(30, 14, 58, 27, 2), '#b8e0f0', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[34, 14], [44, 14], [32, 41], [30, 41], [30, 24]]), '#d8f0f8');
      const cx = 59, cy = 26, skin = '#8a5838', top = '#b83028';
      fig(p, M(p).rbox(cx - 15, cy + 8, 30, 8, 3), top, { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(cx, cy, 9), skin, { sh: [2, 1], hi: 0 });
      ballCap(p, cx, cy + 4, '#3868c8', -1);
      p.box(cx - 5, cy, 3, 3, LINE); p.box(cx + 3, cy, 3, 3, LINE); p.box(cx - 3, cy + 5, 7, 1, LINE);
      fig(p, M(p).box(30, 44, 58, 3), '#3868c8', { sh: 0, hi: 0 });
      words(p, 'DELIVERY', 35, 47, '#3868c8');
      fig(p, M(p).rbox(34, 57, 50, 6, 1), '#585868', { sh: 0, hi: 0 });
      for (const x of [27, 91]) fig(p, M(p).rbox(x - 4, 50, 8, 7, 1), '#fff0a0', { sh: 0, hi: 0 });
      for (const x of [15, 103]) { fig(p, M(p).line(x + (x < 50 ? 8 : -8), 22, x, 22, 2), '#26222c', { sh: 0, hi: 0 }); fig(p, M(p).rbox(x - 4, 16, 8, 14, 1), '#26222c', { sh: 0, hi: 0 }); }
      for (const x of [28, 80]) fig(p, M(p).rbox(x, 64, 11, 9, 1), '#1c1820', { sh: 0, hi: 0 });
    },
    closer(p) {
      p.box(0, 0, ART_W, ART_H, '#14141c');
      flat(p, M(p).poly([[52, 0], [66, 0], [116, 75], [2, 75]]), '#26242c');
      const cx = 59, cy = 28, top = '#20202c', skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#181010', top, hairdo: 'sidepart', mouth: 'smirk', brow: 'angry', clothes(q, x, y) { tie(q, x, y, '#b81818', '#32323e'); } });
      // half in the dark, and it's nothing personal
      for (let y = 0; y < ART_H; y++) for (let x = 59; x < ART_W; x++) { const k = y * p.w + x, v = p.px[k]; if (v) p.px[k] = ((v >>> 1) & 0x7f7f7f) | 0xff000000; }
      // the table, the contract, and the pen
      fig(p, M(p).box(-2, 54, ART_W + 4, 23), '#4c2c1c', { sh: [0, 2], hi: [0, 1] });
      fig(p, M(p).poly([[34, 56], [82, 56], [90, 75], [28, 75]]), '#f4f0e0', { sh: 0, hi: 0 });
      for (const [a, b, y] of [[40, 76, 59], [39, 77, 63]]) p.box(a, y, b - a, 1, '#a8a8a0');
      words(p, 'X', 37, 66, '#d82828'); p.box(44, 72, 34, 1, '#26222c');
      arm(p, cx + 26, 66, cx + 12, 60, '#32323e', skin, 9);
      fig(p, M(p).line(cx + 10, 58, cx - 2, 70, 3), '#e8b030', { sh: 0, hi: 0 });
      spark(p, cx + 12, 52, '#fff8d8', 3);
    },
    // Four of them, on one tray, at speed
    coffeerun(p) {
      p.box(0, 0, ART_W, ART_H, '#d8e4e8');
      for (const [y, n] of [[10, 34], [24, 22], [50, 30], [64, 18]]) { p.box(0, y, n, 2, '#a8c0c8'); p.box(ART_W - n + 8, y + 6, n - 8, 1, '#c0d4d8'); }
      p.box(0, 68, ART_W, 7, '#a89880');
      // the tray
      fig(p, M(p).poly([[20, 53], [98, 53], [90, 68], [28, 68]]), '#b89868', { sh: [1, 2], hi: 0 });
      const lids = ['#3c3c48', '#b83028', '#3c3c48', '#58a848'];
      [28, 46, 64, 82].forEach((x, i) => {
        fig(p, M(p).poly([[x, 28], [x + 15, 28], [x + 13, 60], [x + 2, 60]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
        p.box(x + 1, 37, 13, 9, '#a87040');
        fig(p, M(p).rbox(x - 2, 23, 19, 5, 1), lids[i], { sh: [0, 1], hi: [1, 0] });
        for (let y = 21; y > 4; y--) p.set(x + 7 + Math.round(Math.sin(y / 3 + i) * 2), y, '#a8b0b8');
      });
      for (const x of [14, 104]) fig(p, M(p).ell(x, 60, 7, 6), '#f0c098', { sh: [1, 1], hi: 0 });
      for (const [x, y] of [[8, 42], [13, 34], [106, 40], [99, 30]]) fig(p, M(p).ell(x, y, 2), '#a87040', { sh: 0, hi: 0, line: null });
    },
    // In all caps, with everyone copied
    angryemail(p) {
      p.box(0, 0, ART_W, ART_H, '#581818');
      rays(p, 60, 30, 20, '#702020', 0.1, 0, 58);
      for (let i = 0; i < 12; i++) { const x = (i * 11) - 2; flat(p, M(p).poly([[x - 5, 58], [x - 1, 38 + (i * 7) % 12], [x + 1, 46], [x + 3, 30 + (i * 11) % 16], [x + 6, 58]]), i % 2 ? '#d84818' : '#f89818'); }
      // the envelope
      fig(p, M(p).poly([[30, 8], [90, 4], [94, 44], [34, 48]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      flat(p, M(p).line(30, 8, 63, 28, 2).line(90, 4, 63, 28, 2), '#a8a8a8');
      words(p, '!!!', 46, 30, '#d82020', 2);
      // the keyboard, and the key that's about to go
      fig(p, M(p).poly([[6, 60], [112, 60], [118, 75], [0, 75]]), '#3c3c48', { sh: 0, hi: [0, 1] });
      for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) p.box(9 + i * 8 + r * 2, 62 + r * 6, 6, 4, '#686878');
      fig(p, M(p).rbox(76, 56, 34, 14, 2), '#e82020', { sh: [2, 2], hi: [1, 1] }); words(p, 'SEND', 81, 58, '#ffffff');
      // the fist, on its way down
      fig(p, M(p).rbox(79, 32, 26, 22, 7), '#f0c098', { sh: [3, 3], hi: [1, 1] });
      for (const x of [86, 92, 98]) p.box(x, 34, 1, 8, '#b88858');
      fig(p, M(p).box(86, 18, 13, 15), '#3868c8', { sh: [1, 0], hi: [1, 0] }); p.box(83, 28, 19, 5, '#f8f8f8');
      for (const [a, b, c, d] of [[72, 40, 66, 36], [110, 40, 116, 36], [72, 52, 64, 52], [112, 52, 118, 52]]) flat(p, M(p).line(a, b, c, d, 1), '#fff0a0');
    },
    // Back in five minutes, it says
    longlunch(p) {
      for (let y = 0; y < 40; y++) p.box(0, y, ART_W, 1, y < 14 ? '#68b8e8' : y < 28 ? '#88cce8' : '#b0e0f0');
      fig(p, M(p).ell(18, 12, 9), '#fff0a0', { sh: 0, hi: 0, line: null });
      for (const [x, y] of [[62, 9], [78, 14]]) fig(p, M(p).ell(x, y, 11, 4).ell(x + 6, y - 3, 7, 4), '#f8f8f8', { sh: 0, hi: 0, line: null });
      // the tree
      fig(p, M(p).box(96, 18, 9, 26), '#7a5238', { sh: [2, 0], hi: [1, 0] });
      fig(p, M(p).ell(100, 12, 20, 15).ell(88, 19, 11, 8), '#48a058', { sh: [3, 3], hi: [2, 1] });
      p.box(0, 38, ART_W, 37, '#68b050');
      for (let i = 0; i < 40; i++) p.box((i * 29) % ART_W, 40 + (i * 13) % 34, 2, 1, '#88c868');
      // a clock on the post, which you haven't looked at
      fig(p, M(p).box(39, 14, 3, 26), '#585868', { sh: 0, hi: 0 });
      fig(p, M(p).ell(40, 12, 9), '#f8f8f0', { sh: [1, 1], hi: 0 }); flat(p, M(p).line(40, 12, 40, 6, 1).line(40, 12, 45, 15, 1), '#26222c');
      // the blanket and everything on it
      for (let y = 48; y < 73; y++) for (let x = 12; x < 92; x++) p.set(x + (73 - y) / 3, y, ((x >> 3) + (y >> 2)) % 2 ? '#d84848' : '#f8f4e8');
      fig(p, M(p).poly([[30, 56], [66, 54], [68, 60], [31, 62]]), '#d8a860', { sh: [1, 1], hi: [1, 1] });
      p.box(31, 53, 36, 2, '#58a848'); p.box(32, 51, 34, 2, '#d83838');
      fig(p, M(p).ell(49, 48, 18, 4).box(0, 49, ART_W, 9, 0), '#e8b868', { sh: 0, hi: [1, 1] });
      fig(p, M(p).ell(78, 58, 5), '#d83838', { sh: [1, 1], hi: [1, 1] }); p.box(78, 51, 1, 3, '#5a3420');
      fig(p, M(p).rbox(14, 52, 8, 13, 1), '#3898c8', { sh: [1, 1], hi: [1, 1] });
      // your feet, up
      for (const [x, y] of [[84, 58], [97, 53]]) { fig(p, M(p).rbox(x, y, 16, 10, 3), '#303040', { sh: [1, 1], hi: [1, 1] }); fig(p, M(p).rbox(x + 8, y - 8, 8, 11, 3), '#303040', { sh: [1, 1], hi: [1, 1] }); }
    },
  });

  // ---------- odds and ends the later cards share ----------
  // a dog sitting, from the side, in its colours from the game. way: which way it faces
  function pooch(p, x, y, o, way = 1) {
    const s = o.small ? 0.8 : 1;
    fig(p, M(p).ell(x, y + 8 * s, 9 * s, 7 * s), o.coat, { sh: [2, 1], hi: [1, 1] });
    fig(p, M(p).line(x - way * 8 * s, y + 6 * s, x - way * 13 * s, y - 1 * s, 3), o.coat, { sh: 0, hi: 0 });
    fig(p, M(p).ell(x + way * 7 * s, y - 2 * s, 7 * s, 6 * s), o.coat, { sh: [1, 1], hi: [1, 1] });
    fig(p, M(p).rbox(x + way * 10 * s - (way < 0 ? 5 : 0), y - 1 * s, 6, 4, 1), o.chest || o.coat, { sh: 0, hi: 0 });
    p.set(x + way * (13 * s + 1), y - 1 * s, LINE); p.set(x + way * 8 * s, y - 4 * s, LINE);
    fig(p, M(p).ell(x + way * 3 * s, y - 3 * s, 3, 5), o.ears, { sh: 0, hi: 0 });
    if (o.collar) p.box(x + way * 2 * s - 3, y + 3 * s, 7, 1, o.collar);
    fig(p, M(p).box(x + way * 3, y + 13 * s, 3, 3).box(x - way * 5, y + 13 * s, 3, 3), o.coat, { sh: 0, hi: 0 });
  }
  // something in a frame on the wall, with its picture from draw(x, y)
  function board(p, x, y, w, h, c = '#f4f4f0', draw) {
    fig(p, M(p).box(x, y, w, h), c, { sh: 0, hi: 0 });
    if (draw) draw(x, y);
  }
  // a screen on a stand: draw(x, y) paints what's on it
  function screen(p, x, y, w, h, draw, c = '#14202c') {
    fig(p, M(p).box(x + w / 2 - 3, y + h, 6, 6), '#484858', { sh: 0, hi: 0 });
    fig(p, M(p).rbox(x, y, w, h, 1), c, { sh: 0, hi: 0 });
    if (draw) draw(x + 1, y + 1);
  }
  // a wall in one colour, a floor or desk along the bottom
  function room(p, wall, floor, y = 60, line = '#2c2630') {
    p.box(0, 0, ART_W, ART_H, wall); p.box(0, y, ART_W, ART_H - y, floor); p.box(0, y, ART_W, 1, line);
    p.box(0, y + 1, ART_W, 1, ramp(floor).hi);
  }
  // a piece of paper, tilted a little if you like
  function paper(p, x, y, w, h, t = 0, c = '#f8f8f0') {
    fig(p, M(p).poly([[x + t, y], [x + w + t, y + t], [x + w - t, y + h + t], [x - t, y + h]]), c, { sh: [1, 1], hi: 0 });
  }
  // a dollar sign (the game's letters don't have one)
  function dollar(p, x, y, c) {
    p.rows(x, y, ['..1..', '.1111', '1.1..', '.111.', '..1.1', '1111.', '..1..'], { 1: c });
  }
  // a spring roll, on its side
  function roll(p, x, y, a = 0, n = 11) {
    const dx = Math.cos(a) * n, dy = Math.sin(a) * n;
    fig(p, M(p).line(x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2, 7), '#d89838', { sh: [1, 2], hi: [1, 1] });
    for (let i = -1; i <= 1; i++) p.set(x + dx * i / 4, y + dy * i / 4, '#a86820');
  }
  // the air handler itself: a long box with panels, a fan in the end
  function unitBox(p, x, y, w, h, c = '#b8c4cc') {
    fig(p, M(p).rbox(x, y, w, h, 1), c, { sh: [2, 2], hi: [1, 1] });
    for (let i = x + Math.floor(w / 4); i < x + w - 2; i += Math.floor(w / 4)) p.box(i, y + 1, 1, h - 2, ramp(c).shade);
    p.box(x + 2, y + 2, 6, 2, '#3c78b8');
  }

  // ---------- the rest of the plant ----------
  Object.assign(ART, {
    // "Oh good, you're awake. Six units ship Friday and the drawings are still on revision C."
    alex(p) {
      room(p, '#a8b0b8', '#6c7078', 58);
      board(p, 6, 6, 34, 34, '#f8f8f0', (x, y) => {
        p.box(x + 1, y + 1, 32, 7, '#d83838'); words(p, 'FRI', x + 8, y + 1, '#ffffff');
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) p.box(x + 3 + i * 7, y + 11 + j * 7, 5, 5, '#c8ccd4');
        arc(p, x + 26, y + 20, 6, 0, Math.PI * 2, '#d83838');
      });
      for (let i = 0; i < 6; i++) unitBox(p, 88 + (i % 2) * 15, 8 + Math.floor(i / 2) * 17, 13, 13);
      const cx = 57, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#f8f8f8', hairdo: 'short', brow: 'raised', mouth: 'smirk', look: 'side', clothes(q, x, y) { tie(q, x, y, '#3050a8'); } });
      arm(p, cx + 25, 76, cx + 31, 52, '#f8f8f8', skin, 9);
      fig(p, M(p).rbox(cx + 28, 39, 3, 11, 1), skin, { sh: 0, hi: 0 });
    },
    // "HR is here to help. Mostly with forms."
    courtney(p) {
      room(p, '#d8c8c0', '#907c78', 62);
      fig(p, M(p).rbox(80, 8, 32, 44, 1), '#6c4830', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(87, 14, 18, 11), '#f4f0e0', { sh: 0, hi: 0 }); words(p, 'HR', 91, 15, '#6c4830');
      fig(p, M(p).ell(104, 34, 2), '#e8c050', { sh: 0, hi: 0 });
      const cx = 44, cy = 33, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#9868c8', hairdo: 'long', mouth: 'smile', clothes(q, x, y) { flat(q, M(q).line(x - 8, y + 21, x, y + 31, 1).line(x + 8, y + 21, x, y + 31, 1), '#f8f8f8'); fig(q, M(q).ell(x, y + 32, 2), '#f8f8f8', { sh: 0, hi: 0, line: null }); } });
      arm(p, cx - 25, 76, cx - 31, 56, '#9868c8', skin, 9);
      paper(p, cx - 42, 40, 17, 22, 1);
      for (let y = 45; y < 58; y += 3) p.box(cx - 39, y, 12, 1, '#a0a0b0');
    },
    // "I just need you to fill in a few forms. And a few more after those."
    amelia(p) {
      room(p, '#c4d4d0', '#7c8c88', 64);
      for (const [x, n] of [[3, 26], [17, 15], [86, 19], [101, 28]]) {
        for (let i = 0; i < n; i++) { p.box(x + (i * 3 % 3), 63 - i * 2, 14, 2, i % 3 === 2 ? '#d0ccc0' : '#f8f8f0'); p.box(x + (i * 3 % 3), 64 - i * 2, 14, 1, '#a8a498'); }
      }
      const cx = 59, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#40a0a0', hairdo: 'bob', mouth: 'grin', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#f8e070', { sh: 0, hi: 0, line: null }); } });
      // handing you one more
      arm(p, cx + 26, 76, cx + 34, 56, '#40a0a0', skin, 9);
      paper(p, cx + 26, 28, 20, 26, -1);
      for (let y = 33; y < 50; y += 3) p.box(cx + 29, y, 14, 1, '#a0a0b0');
      fig(p, M(p).line(cx + 40, 18, cx + 32, 32, 2), '#3868c8', { sh: 0, hi: 0 });
    },
    // "If it isn't on the BOM, it doesn't exist."
    fleur(p) {
      room(p, '#b0b8a8', '#808878', 58);
      // the bill of materials, down the wall and across the floor
      fig(p, M(p).poly([[74, 2], [112, 2], [112, 60], [118, 75], [66, 75], [74, 60]]), '#f8f8f0', { sh: 0, hi: 0 });
      words(p, 'BOM', 83, 3, '#2c5848');
      for (let y = 13; y < 72; y += 4) { p.box(79, y, 22, 1, '#808890'); p.box(104, y, 5, 1, y % 12 === 1 ? '#d83838' : '#808890'); }
      const cx = 42, cy = 33, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#e8c050', top: '#58a848', hairdo: 'ponytail', brow: 'raised', mouth: 'flat', clothes(q, x, y) { flat(q, M(q).line(x - 8, y + 21, x, y + 31, 1).line(x + 8, y + 21, x, y + 31, 1), '#f8f8f8'); } });
      arm(p, cx + 26, 76, cx + 32, 44, '#58a848', skin, 9);
      // the rivets, four hundred more of them
      for (let i = 0; i < 22; i++) fig(p, M(p).ell(3 + i * 7 % 28, 68 - (i % 4) * 3, 2), '#c8d0d8', { sh: 0, hi: 0, line: '#585868' });
    },
    // "Lead time on that motor is fourteen weeks. And I asked nicely."
    ashley(p) {
      room(p, '#d0c4c8', '#8c7c80', 62);
      fig(p, M(p).box(4, 5, 42, 46), '#f8f8f0', { sh: 0, hi: 0 });
      p.box(5, 6, 40, 8, '#d83838'); words(p, 'WEEKS', 10, 6, '#ffffff');
      words(p, '14', 8, 19, '#d83838', 3);
      // the motor she's still waiting for, on the shelf of its picture
      fig(p, M(p).rbox(94, 36, 22, 18, 3), '#3c78b8', { sh: [3, 2], hi: [1, 1] });
      for (let y = 39; y < 52; y += 3) p.box(97, y, 16, 1, '#285890');
      fig(p, M(p).box(89, 42, 6, 5), '#c8d0d8', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(92, 54, 26, 6, 1), '#585868', { sh: 0, hi: 0 });
      const cx = 64, cy = 34, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#201818', top: '#e07898', hairdo: 'long', brow: 'worried', mouth: 'smile', clothes(q, x, y) { fig(q, M(q).ell(x, y + 29, 2), '#f8f8f8', { sh: 0, hi: 0, line: null }); } });
      arm(p, cx + 26, 76, cx + 22, 42, '#e07898', skin, 9);
      fig(p, M(p).rbox(cx + 20, 22, 7, 20, 2), '#26222c', { sh: 0, hi: [1, 1] });
    },
    // "Welcome to the Kingston plant! Please sign in. Safety glasses are on the left."
    samantha(p) {
      room(p, '#c0ccd8', '#7c8898', 56);
      fig(p, M(p).box(26, 3, 66, 13), '#284878', { sh: 0, hi: 0 }); words(p, 'KINGSTON', 39, 5, '#f8f8f0');
      // the glasses, on the left
      fig(p, M(p).box(3, 22, 22, 30), '#e8e8e0', { sh: 0, hi: 0 });
      for (let y = 25; y < 50; y += 8) { for (const x of [8, 16]) { arc(p, x, y + 2, 3, 0, Math.PI * 2, '#3898c8'); } p.box(10, y + 2, 4, 1, '#3898c8'); }
      const cx = 62, cy = 31, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#3868c8', hairdo: 'bob', mouth: 'grin', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#f8e070', { sh: 0, hi: 0, line: null }); } });
      // the front desk and the sign-in book
      fig(p, M(p).box(0, 60, ART_W, 15), '#8a5a3a', { sh: 0, hi: [0, 1] });
      fig(p, M(p).rbox(76, 53, 30, 9, 1), '#f8f8f0', { sh: 0, hi: 0 });
      for (let x = 79; x < 104; x += 4) p.box(x, 56, 3, 1, '#808890');
      fig(p, M(p).line(92, 44, 86, 56, 2), '#d83838', { sh: 0, hi: 0 });
    },
    // "I'm updating the drawings to revision D. Don't tell anyone about revision C."
    william(p) {
      p.box(0, 0, ART_W, ART_H, '#e0dcc8');
      for (let x = 3; x < ART_W; x += 6) p.box(x, 0, 1, ART_H, '#d0ccb4');
      for (let y = 3; y < ART_H; y += 6) p.box(0, y, ART_W, 1, '#d0ccb4');
      flat(p, M(p).rbox(78, 8, 37, 15, 2).rbox(80, 10, 33, 11, 1, 0), '#d83030');
      words(p, 'REV D', 82, 10, '#d83030');
      words(p, 'REV C', 6, 8, '#585868');
      flat(p, M(p).line(4, 20, 38, 6, 2).line(4, 6, 38, 20, 2), '#d83030');
      const cx = 57, cy = 34, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#808898', hairdo: 'sidepart', brow: 'raised', mouth: 'flat', look: 'side', clothes(q, x, y) { tie(q, x, y, '#b83028'); } });
      // shh
      arm(p, cx + 16, 76, cx + 5, 54, '#808898', skin, 9);
      fig(p, M(p).rbox(cx - 1, 43, 3, 11, 1), skin, { sh: 0, hi: 0 });
    },
    // "Have you tried turning the plant off and on again?"
    cedric(p) {
      p.box(0, 0, ART_W, ART_H, '#20242c');
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 19;
        fig(p, M(p).box(x, 3, 16, 70), '#383c48', { sh: 0, hi: 0 });
        for (let y = 7; y < 70; y += 6) { p.box(x + 2, y, 12, 4, '#14181f'); p.set(x + 3, y + 1, ['#20d870', '#f0c020', '#20d870', '#e03030'][(i + y) % 4]); p.set(x + 5, y + 1, '#20d870'); }
      }
      // the switch for the whole plant
      fig(p, M(p).rbox(86, 8, 26, 44, 2), '#c8c8c0', { sh: [2, 2], hi: [1, 1] });
      words(p, 'ON', 95, 10, '#20a050'); words(p, 'OFF', 92, 42, '#d83030');
      fig(p, M(p).box(96, 21, 6, 18), '#26222c', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(92, 26, 14, 6, 2), '#e03030', { sh: [1, 1], hi: [1, 1] });
      const cx = 62, cy = 35, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#58a848', hairdo: 'short', brow: 'raised', mouth: 'smile', specs: '#d0d0d8' });
      arm(p, cx + 26, 76, 97, 34, '#58a848', skin, 9);
    },
    // "Today's training: how to answer the phone without blacking out."
    stephanie(p) {
      room(p, '#b8b4c8', '#787488', 62);
      fig(p, M(p).box(46, 4, 69, 44), '#f8f8f4', { sh: 0, hi: 0 });
      p.box(46, 48, 69, 2, '#585868');
      words(p, 'TODAY', 54, 6, '#3050a8');
      flat(p, M(p).line(62, 34, 70, 24, 3).line(70, 24, 84, 24, 3).line(84, 24, 92, 34, 3), '#2c2c3c');
      fig(p, M(p).rbox(66, 30, 22, 13, 2), '#2c2c3c', { sh: 0, hi: 0 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.box(70 + i * 5, 33 + j * 4, 3, 2, '#c8c8d0');
      flat(p, M(p).line(98, 22, 110, 42, 2).line(110, 22, 98, 42, 2), '#d83030');
      const cx = 28, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#f0b030', hairdo: 'long', mouth: 'grin', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#b83028', { sh: 0, hi: 0, line: null }); } });
      arm(p, cx + 24, 76, cx + 28, 52, '#f0b030', skin, 9);
      flat(p, M(p).line(cx + 28, 50, 72, 40, 2), '#8a5a3a');
    },
    // "Sheet metal is just origami with more cuts."
    josh(p) {
      p.box(0, 0, ART_W, ART_H, '#50586c');
      for (let y = 0; y < 64; y += 10) { p.box(0, y, ART_W, 1, '#606880'); }
      p.box(0, 64, ART_W, 11, '#787484'); p.box(0, 64, ART_W, 1, '#2c2838');
      const cx = 36, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#201818', top: '#f0b030', hairdo: 'short', mouth: 'smirk', brow: 'raised', clothes(q, x, y) { hiVis(q, x, y, '#f8f070'); } });
      arm(p, cx + 26, 76, 78, 58, '#f0b030', skin, 10);
      // a crane, folded out of a sheet of steel
      const steel = '#c8d0d8', dark = '#8c98a8', light = '#e8ecf0';
      fig(p, M(p).poly([[74, 56], [84, 38], [92, 56]]), steel, { sh: 0, hi: 0 });
      flat(p, M(p).poly([[84, 38], [92, 56], [84, 56]]), dark);
      fig(p, M(p).poly([[80, 44], [62, 16], [86, 42]]), light, { sh: 0, hi: 0 });
      fig(p, M(p).poly([[86, 44], [116, 12], [90, 54]]), steel, { sh: 0, hi: 0 });
      flat(p, M(p).poly([[88, 46], [112, 18], [90, 50]]), dark);
      fig(p, M(p).poly([[62, 16], [56, 20], [65, 20]]), light, { sh: 0, hi: 0 });
      fig(p, M(p).poly([[74, 54], [58, 44], [80, 46]]), dark, { sh: 0, hi: 0 });
      for (const [x, y] of [[100, 26], [70, 26]]) p.box(x, y, 2, 2, '#50586c');
      spark(p, 104, 10, '#ffffff', 2);
    },
    // "Grab one of those fans and balance it, would you? Mind your fingers."
    johnk(p) {
      p.box(0, 0, ART_W, ART_H, '#50483c');
      // the base he's built, I-beams on the floor
      fig(p, M(p).box(-2, 62, ART_W + 4, 13), '#587898', { sh: 0, hi: [0, 1] });
      for (let x = 10; x < ART_W; x += 26) fig(p, M(p).box(x, 58, 8, 17), '#3c5c7c', { sh: 0, hi: 0 });
      const cx = 36, cy = 34, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#f0b030', hairdo: 'buzz', mouth: 'open', brow: 'raised', clothes(q, x, y) { hiVis(q, x, y, '#f8f070'); } });
      // a fan wheel, spinning on one finger
      arm(p, cx + 26, 76, 84, 50, '#f0b030', skin, 9);
      fig(p, M(p).rbox(82, 40, 4, 12, 1), skin, { sh: 0, hi: 0 });
      fig(p, M(p).ell(84, 21, 22), '#8c98a8', { sh: [3, 2], hi: [1, 1] });
      flat(p, M(p).ell(84, 21, 18), '#2c2c3c');
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7, b = a + 0.7;
        fig(p, M(p).poly([[84, 21], [84 + Math.cos(a) * 18, 21 + Math.sin(a) * 18], [84 + Math.cos(b) * 18, 21 + Math.sin(b) * 18]]), '#c8d0d8', { sh: 0, hi: 0, line: null });
      }
      fig(p, M(p).ell(84, 21, 4), '#f0b030', { sh: [1, 1], hi: [1, 1] });
      arc(p, 84, 21, 25, -0.5, 0.6, '#ffffff'); arc(p, 84, 21, 25, 2.6, 3.7, '#ffffff');
    },
    // "Coils, dampers, drain pans. If it goes in a unit, it comes through here first."
    markl(p) {
      room(p, '#685c58', '#88807c', 58);
      // the bench, with one of each
      fig(p, M(p).box(0, 54, ART_W, 6), '#8a6a48', { sh: 0, hi: [0, 1] });
      // a damper with its blades open
      fig(p, M(p).box(6, 8, 30, 44), '#a8b0b8', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).box(9, 11, 24, 38), '#2c2c3c');
      for (let y = 12; y < 48; y += 6) fig(p, M(p).poly([[9, y + 3], [33, y], [33, y + 2], [9, y + 5]]), '#d0d8e0', { sh: 0, hi: 0, line: null });
      // a drain pan
      fig(p, M(p).poly([[84, 44], [116, 44], [112, 53], [88, 53]]), '#c8d0d8', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).box(88, 45, 24, 2), '#7c8894');
      // a bit of coil
      fig(p, M(p).box(88, 12, 26, 26), '#c07840', { sh: [2, 2], hi: [1, 1] });
      for (let x = 90; x < 112; x += 2) p.box(x, 14, 1, 22, '#8c5228');
      const cx = 60, cy = 32, skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#181010', top: '#f0b030', hairdo: 'short', mouth: 'smile', clothes(q, x, y) { hiVis(q, x, y, '#f8f070'); } });
    },
    // "Keep it moving! Every minute this line stands still is a unit we don't ship."
    mikeb(p) {
      p.box(0, 0, ART_W, ART_H, '#4c5060');
      // the line, and everything on it going by
      for (let i = 0; i < 4; i++) { unitBox(p, 4 + i * 30, 30, 26, 20); }
      for (let y of [24, 33, 42]) { p.box(0, y, 6, 1, '#ffffff'); }
      fig(p, M(p).box(-2, 50, ART_W + 4, 5), '#3a3a44', { sh: 0, hi: [0, 1] });
      for (let x = 2; x < ART_W; x += 7) fig(p, M(p).ell(x, 58, 3), '#888898', { sh: [1, 1], hi: 0 });
      p.box(0, 62, ART_W, 13, '#6c6878');
      const cx = 40, cy = 35, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#f0b030', hairdo: 'under', mouth: 'open', brow: 'angry', clothes(q, x, y) { hiVis(q, x, y, '#f8f070'); } });
      hardHat(p, cx, cy, '#d83830');
      arm(p, cx + 26, 76, cx + 50, 44, '#f0b030', skin, 10);
      loud(p, '!', 100, 3, '#f8e070', 4);
      for (const y of [9, 16, 23]) p.box(70, y, 20, 1, '#ffffff');
    },
    // "The motor nameplate says 575 volts. The drawings say 208. Guess who gets to sort it out."
    scott(p) {
      p.box(0, 0, ART_W, ART_H, '#384048');
      fig(p, M(p).box(60, 3, 54, 62), '#a8a8a0', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).box(64, 7, 46, 54), '#d8d8cc');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = 69 + i * 11, y = 13 + j * 11, red = (i * 3 + j) % 3 !== 1;
        fig(p, M(p).ell(x, y, 3), red ? '#e83030' : '#20c860', { sh: [1, 1], hi: [1, 1] });
      }
      p.box(0, 65, ART_W, 10, '#585c64'); p.box(0, 65, ART_W, 1, '#1c2028');
      // what's written on the motor, and what's on the drawing
      paper(p, 3, 4, 26, 13); words(p, '575V', 5, 5, '#d83030');
      paper(p, 30, 4, 26, 13); words(p, '208V', 32, 5, '#3050a8');
      const cx = 32, cy = 37, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#201818', top: '#f0b030', hairdo: 'short', brow: 'worried', mouth: 'nervous', look: 'side', clothes(q, x, y) { hiVis(q, x, y, '#f8f070'); } });
      arm(p, cx + 24, 76, cx + 26, 56, '#f0b030', skin, 9);
      flat(p, M(p).poly([[56, 40], [50, 50], [55, 50], [51, 60], [60, 47], [55, 47], [60, 40]]), '#f8e860');
    },
    // "No sticker, no ship. Those are the rules."
    caleb(p) {
      p.box(0, 0, ART_W, ART_H, '#5c6878');
      unitBox(p, -6, 18, 46, 44);
      unitBox(p, 88, 18, 40, 44);
      p.box(0, 62, ART_W, 13, '#787484'); p.box(0, 62, ART_W, 1, '#2c2838');
      const cx = 50, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#e8c050', top: '#f8f8f8', hairdo: 'quiff', brow: 'raised', mouth: 'flat', clothes(q, x, y) { tie(q, x, y, '#3050a8'); } });
      // the sticker, held up
      arm(p, cx + 26, 76, cx + 36, 42, '#f8f8f8', skin, 9);
      fig(p, M(p).ell(cx + 40, 22, 15), '#28b058', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).line(cx + 33, 22, cx + 38, 28, 3).line(cx + 38, 28, cx + 48, 15, 3), '#ffffff');
    },
    // "The truck is here and this unit isn't even painted yet. No pressure."
    nick(p) {
      p.box(0, 0, ART_W, ART_H, '#384850');
      // half a unit painted so far
      fig(p, M(p).box(46, 12, 72, 50), '#808890', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[46, 12], [86, 12], [78, 62], [46, 62]]), '#3c78b8');
      for (let x = 58; x < 118; x += 16) p.box(x, 12, 1, 50, '#283848');
      p.box(0, 62, ART_W, 13, '#606870');
      for (const [x, y, r] of [[89, 18, 5], [94, 32, 7], [88, 48, 6], [100, 22, 4], [101, 44, 4]]) flat(p, M(p).ell(x, y, r), '#90b8d8');
      for (let i = 0; i < 14; i++) p.set(84 + i * 17 % 30, 10 + i * 23 % 52, '#c8e0f0');
      const cx = 26, cy = 35, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#181010', top: '#f08020', hairdo: 'short', brow: 'raised', mouth: 'flat', look: 'side' });
      goggles(p, cx, cy - 8);
      // the spray gun
      arm(p, cx + 25, 76, 58, 44, '#f08020', skin, 10);
      fig(p, M(p).rbox(56, 34, 18, 7, 1), '#c8c8d0', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(70, 35, 8, 4), '#585868', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(58, 41, 7, 9, 1), '#3c78b8', { sh: 0, hi: [1, 1] });
    },
    // "The truck's been here since seven. The driver has eaten all of our snacks."
    jay(p) {
      p.box(0, 0, ART_W, ART_H, '#5c5c68');
      // the dock door, and the truck backed up to it
      fig(p, M(p).box(58, 4, 56, 54), '#e8e8e8', { sh: 0, hi: 0 });
      flat(p, M(p).box(61, 7, 50, 50), '#1c2028');
      for (let y = 10; y < 57; y += 7) p.box(62, y, 48, 1, '#3c4048');
      for (const [x, y, w, h, c] of [[64, 34, 16, 21, '#b89060'], [81, 40, 12, 15, '#a88050'], [94, 30, 14, 25, '#c8a070']]) { p.box(x, y, w, h, c); p.box(x, y, w, 1, ramp(c).hi); p.box(x + Math.floor(w / 2), y, 1, h, ramp(c).shade); }
      for (let x = 0; x < ART_W; x += 2) { p.set(x, 58, x % 6 < 3 ? '#e8b820' : '#282028'); p.set(x + 1, 58, x % 6 < 3 ? '#e8b820' : '#282028'); }
      p.box(0, 59, ART_W, 16, '#7c7c80');
      // three o'clock
      fig(p, M(p).ell(23, 10, 8), '#f8f8f0', { sh: 0, hi: 0 });
      flat(p, M(p).line(23, 10, 28, 10, 1).line(23, 10, 23, 5, 1), '#2c2c3c');
      const cx = 36, cy = 37, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#f08020', hairdo: 'sidepart', brow: 'worried', mouth: 'flat', beard: '#6a3c20' });
      arm(p, cx - 25, 76, cx - 28, 58, '#f08020', skin, 9);
      fig(p, M(p).rbox(cx - 34, 42, 15, 18, 1), '#8a5a3a', { sh: 0, hi: 0 });
      flat(p, M(p).box(cx - 32, 44, 11, 14), '#f8f8f0');
      // the empty snack packet
      fig(p, M(p).poly([[66, 66], [80, 62], [84, 70], [70, 74]]), '#d83830', { sh: 0, hi: [1, 1] });
    },
  });

  // ---------- the rest of Sales, and the things they do ----------
  Object.assign(ART, {
    // A headset, and the only chart that's going the right way
    howard(p) {
      BACKS.cubicle(p);
      fig(p, M(p).box(70, 6, 44, 36), '#f8f8f0', { sh: 0, hi: 0 });
      p.box(74, 10, 1, 28, '#585868'); p.box(74, 37, 37, 1, '#585868');
      for (let i = 0; i < 5; i++) fig(p, M(p).box(77 + i * 7, 34 - i * 5, 5, 3 + i * 5), ['#58a848', '#58a848', '#40a848', '#30b048', '#20b848'][i], { sh: 0, hi: 0 });
      flat(p, M(p).poly([[100, 8], [110, 8], [110, 16]]), '#d83838');
      flat(p, M(p).line(82, 26, 106, 11, 2), '#d83838');
      const cx = 42, cy = 35, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#201818', top: '#9868c8', hairdo: 'sidepart', mouth: 'open', brow: 'raised', clothes(q, x, y) { tie(q, x, y, '#3050a8'); } });
      headset(p, cx, cy);
    },
    // Off again, with the airport behind him
    mikeh(p) {
      room(p, '#c8d4dc', '#8c8c98', 60);
      for (let x = 2; x < ART_W; x += 26) { p.box(x, 4, 22, 34, '#90c8e8'); p.box(x, 4, 22, 1, '#d0e8f4'); }
      fig(p, M(p).poly([[66, 20], [96, 14], [103, 15], [99, 19], [86, 23], [90, 31], [84, 32], [76, 25], [68, 26]]), '#f4f4f8', { sh: [1, 1], hi: 0 });
      fig(p, M(p).box(3, 40, 40, 16), '#1c2028', { sh: 0, hi: 0 });
      words(p, 'GATE', 6, 40, '#f8c040'); words(p, 'BOARD', 6, 48, '#20d870');
      const cx = 62, cy = 35, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#58a848', hairdo: 'short', mouth: 'grin', clothes(q, x, y) { tie(q, x, y, '#f8e070', '#3a4858'); } });
      arm(p, cx + 26, 76, cx + 34, 56, '#3a4858', skin, 9);
      fig(p, M(p).rbox(cx + 29, 46, 22, 26, 2), '#584038', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(cx + 36, 40, 8, 7), '#c8c8d0', { sh: 0, hi: 0 });
    },
    // Every customer, on a map
    jp(p) {
      p.box(0, 0, ART_W, ART_H, '#786050');
      fig(p, M(p).box(3, 3, 112, 55), '#a8d4e8', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[6, 12], [28, 7], [50, 11], [76, 6], [108, 12], [112, 28], [96, 38], [84, 46], [56, 44], [36, 50], [14, 44], [4, 30]]), '#a8c878');
      flat(p, M(p).poly([[60, 18], [74, 16], [80, 24], [68, 30], [58, 26]]), '#a8d4e8');
      flat(p, M(p).line(14, 34, 30, 22, 1).line(30, 22, 92, 26, 1).line(92, 26, 96, 34, 1).line(30, 22, 44, 44, 1), '#d83838');
      for (const [x, y] of [[14, 34], [30, 22], [92, 26], [96, 34], [44, 44]]) { fig(p, M(p).ell(x, y - 3, 3), '#d83838', { sh: 0, hi: [1, 1] }); p.set(x, y, '#2c2c3c'); }
      p.box(0, 58, ART_W, 17, '#584838');
      const cx = 62, cy = 37, skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#78a8e8', hairdo: 'quiff', mouth: 'smile', brow: 'raised', clothes(q, x, y) { tie(q, x, y, '#2c6a34'); } });
      arm(p, cx - 26, 76, cx - 32, 32, '#78a8e8', skin, 9);
    },
    // "Yes"
    mikefriesen(p) {
      rays(p, 59, 37, 20, '#3c7878', 0, 0, ART_H);
      for (let i = 0; i < ART_W * ART_H; i++) if (!p.px[i]) p.px[i] = C('#2c6a6a');
      const cx = 34, cy = 35, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#40a0a0', hairdo: 'short', mouth: 'smile', clothes(q, x, y) { tie(q, x, y, '#d03868'); } });
      fig(p, M(p).rbox(62, 6, 52, 34, 7).poly([[62, 28], [50, 40], [70, 36]]), '#f8f8f4', { sh: [2, 2], hi: 0 });
      words(p, 'YES', 66, 11, '#d03868', 2);
      arm(p, cx + 26, 76, cx + 34, 60, '#40a0a0', skin, 9);
      fig(p, M(p).rbox(cx + 30, 46, 7, 13, 2), skin, { sh: [1, 0], hi: 0 });
    },
    // It's been ringing out in the cold
    coldcall(p) {
      p.box(0, 0, ART_W, ART_H, '#284868');
      for (let i = 0; i < 40; i++) p.set(i * 37 % ART_W, i * 53 % ART_H, '#d0e8f8');
      for (const [x, y, n] of [[10, 12, 2], [104, 16, 3], [20, 58, 2], [100, 60, 2]]) spark(p, x, y, '#e8f8ff', n);
      flat(p, M(p).box(0, 66, ART_W, 9), '#d0e0f0');
      fig(p, M(p).rbox(34, 36, 50, 30, 3), '#90c8f0', { sh: [2, 2], hi: [2, 2] });
      flat(p, M(p).line(26, 24, 92, 24, 11).line(26, 24, 26, 33, 11).line(92, 24, 92, 33, 11), '#b8e0f8');
      flat(p, M(p).line(29, 21, 88, 21, 2), '#ffffff');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) fig(p, M(p).box(47 + i * 9, 41 + j * 7, 6, 4), '#2c5078', { sh: 0, hi: 0 });
      for (const [x, n] of [[38, 8], [60, 12], [78, 7]]) flat(p, M(p).poly([[x - 3, 66], [x + 3, 66], [x, 66 + n]]), '#e8f8ff');
      for (const a of [-0.6, 0, 0.6]) { arc(p, 59, 24, 40 + a * 2, -0.6 + a * 0.1, -0.2 + a * 0.1, '#ffffff'); arc(p, 59, 24, 40, 3.5 + a * 0.2, 3.7 + a * 0.2, '#ffffff'); }
    },
    // The good restaurant, and who's paying
    clientlunch(p) {
      p.box(0, 0, ART_W, ART_H, '#5c2c30');
      for (let y = 0; y < 30; y += 6) for (let x = (y % 12) * 2; x < ART_W; x += 24) flat(p, M(p).ell(x, y, 2), '#6c3638');
      fig(p, M(p).box(-2, 34, ART_W + 4, 44), '#f4f0e8', { sh: 0, hi: 0 });
      for (const cx of [32, 86]) {
        fig(p, M(p).ell(cx, 52, 21, 13), '#f8f8f4', { sh: [2, 2], hi: 0 });
        flat(p, M(p).ell(cx, 52, 15, 9), '#e8e4dc');
      }
      fig(p, M(p).poly([[20, 50], [32, 44], [44, 50], [38, 58], [24, 58]]), '#8a4830', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).line(26, 50, 38, 55, 1).line(30, 47, 42, 52, 1), '#5a2c1c');
      fig(p, M(p).poly([[76, 48], [94, 46], [96, 56], [78, 58]]), '#e8884c', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).ell(84, 49, 3, 2), '#58a848');
      // a glass each, and the bill
      for (const x of [56, 66]) { fig(p, M(p).poly([[x - 3, 16], [x + 3, 16], [x + 2, 28], [x - 2, 28]]), '#b83848', { sh: 0, hi: [1, 0] }); fig(p, M(p).box(x, 28, 1, 6), '#c8d0d8', { line: null, sh: 0, hi: 0 }); }
      paper(p, 52, 46, 14, 22, 1);
      dollar(p, 56, 49, '#d83030');
      for (let y = 58; y < 66; y += 3) p.box(55, y, 8, 1, '#808890');
    },
    // A banner, a unit, and a bowl of free pens
    tradeshow(p) {
      p.box(0, 0, ART_W, ART_H, '#384060');
      for (let x = 6; x < ART_W; x += 18) { flat(p, M(p).poly([[x, 0], [x + 4, 0], [x + 10, 18], [x - 6, 18]]), '#485078'); }
      p.box(0, 60, ART_W, 15, '#6c6c88');
      fig(p, M(p).box(8, 4, 102, 15), '#d83838', { sh: 0, hi: 0 }); words(p, 'HAAKON', 28, 3, '#ffffff', 2);
      for (const x of [8, 109]) p.box(x, 19, 1, 42, '#c8c8d0');
      unitBox(p, 18, 24, 58, 28);
      arc(p, 66, 38, 8, 0, Math.PI * 2, '#2c2c3c'); arc(p, 66, 38, 5, 0, Math.PI * 2, '#2c2c3c');
      fig(p, M(p).box(14, 52, 66, 12), '#f8f8f4', { sh: 0, hi: [0, 1] });
      // the table with the pens
      fig(p, M(p).box(80, 48, 30, 18), '#3868c8', { sh: [1, 1], hi: [0, 1] });
      fig(p, M(p).ell(95, 44, 10, 4), '#d8d8e0', { sh: 0, hi: 0 });
      for (const [x, c] of [[89, '#d83838'], [93, '#f0c020'], [97, '#58a848'], [101, '#3868c8']]) flat(p, M(p).line(x, 44, x + 1, 34, 2), c);
      little(p, 96, 58, { top: '#e07898', skin: '#f0c098', hair: '#201818' });
    },
    // It's come in. Everybody stop what you're doing.
    bigorder(p) {
      p.box(0, 0, ART_W, ART_H, '#285838');
      rays(p, 59, 34, 18, '#347048', 0.1, 0, ART_H);
      fig(p, M(p).poly([[26, 3], [92, 3], [96, 72], [22, 72]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      words(p, 'PURCHASE', 36, 6, '#2c2c3c');
      words(p, 'ORDER', 44, 15, '#2c2c3c');
      for (let y = 27; y < 52; y += 4) p.box(32, y, 54, 1, '#a0a0a8');
      for (let i = 0; i < 4; i++) dollar(p, 33 + i * 7, 53, '#20a050');
      fig(p, M(p).box(26, 62, 66, 1), '#2c2c3c', { line: null, sh: 0, hi: 0 });
      flat(p, M(p).rbox(62, 44, 28, 14, 2).rbox(64, 46, 24, 10, 1, 0), '#d83030');
      words(p, 'YES', 66, 44, '#d83030');
      for (let i = 0; i < 18; i++) { const x = i * 41 % ART_W, y = i * 29 % ART_H; p.box(x, y, 2, 3, ['#f0c020', '#d83838', '#3898f0', '#f0f0f0'][i % 4]); }
      spark(p, 16, 14, '#fff0b0', 3); spark(p, 104, 26, '#fff0b0', 3); spark(p, 106, 60, '#fff0b0', 2);
    },
    // A small, perfect air handler that nobody's allowed to touch
    demounit(p) {
      p.box(0, 0, ART_W, ART_H, '#201c30');
      flat(p, M(p).poly([[42, 0], [76, 0], [108, 62], [10, 62]]), '#3c3858');
      flat(p, M(p).poly([[50, 0], [68, 0], [92, 62], [26, 62]]), '#4c4870');
      p.box(0, 62, ART_W, 13, '#383048');
      fig(p, M(p).poly([[20, 54], [98, 54], [104, 66], [14, 66]]), '#d83838', { sh: [0, 2], hi: [0, 1] });
      unitBox(p, 28, 22, 62, 32, '#d0dce4');
      flat(p, M(p).ell(74, 38, 11), '#2c2c3c');
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; flat(p, M(p).poly([[74, 38], [74 + Math.cos(a) * 10, 38 + Math.sin(a) * 10], [74 + Math.cos(a + 0.6) * 10, 38 + Math.sin(a + 0.6) * 10]]), '#c8d0d8'); }
      fig(p, M(p).ell(74, 38, 3), '#f0b030', { sh: 0, hi: [1, 1] });
      fig(p, M(p).box(36, 30, 20, 16), '#88a8c0', { sh: 0, hi: [1, 1] });
      for (let x = 38; x < 56; x += 3) p.box(x, 31, 1, 14, '#587088');
      spark(p, 88, 22, '#ffffff', 3); spark(p, 30, 26, '#ffffff', 2);
      // the rope
      for (const x of [6, 112]) fig(p, M(p).rbox(x - 2, 42, 4, 24, 1), '#e8b030', { sh: 0, hi: [1, 0] });
      arc(p, 59, 22, 74, 0.55, 2.6, '#a82838'); arc(p, 59, 21, 74, 0.55, 2.6, '#a82838');
    },
  });

  // ---------- the rest of the Office ----------
  Object.assign(ART, {
    // "Why do I feel so old? Did Mauro steal my youth?"
    alyssa(p) {
      room(p, '#b8c4d0', '#7c8898', 62);
      const cx = 30, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#78a8e8', hairdo: 'bob', brow: 'angry', mouth: 'flat', look: 'side', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#283878', { sh: 0, hi: 0, line: null }); } });
      arm(p, cx + 26, 76, cx + 30, 54, '#78a8e8', skin, 9);
      fig(p, M(p).rbox(cx + 27, 39, 4, 13, 1), skin, { sh: 0, hi: 0 });
      // and there he goes, with it
      little(p, 102, 40, { top: '#40a0a0', skin: '#8a5838', hair: '#d06030', pants: '#3a3050', run: true });
      fig(p, M(p).ell(82, 32, 14, 13).poly([[82, 15], [76, 22], [88, 22]]), '#d8c088', { sh: [1, 1], hi: [1, 1] });
      words(p, 'YOUTH', 62, 46, '#2c2c3c');
      for (const y of [44, 50, 56]) p.box(109, y, 8, 1, '#ffffff');
    },
    // The month end, with Louie under the desk
    rob(p) {
      room(p, '#b0a8c0', '#6c6478', 50);
      fig(p, M(p).box(-2, 54, ART_W + 4, 22), '#7c5438', { sh: 0, hi: [0, 1] });
      const cx = 44, cy = 28, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#9868c8', hairdo: 'sidepart', mouth: 'smile', specs: '#2c2c3c', clothes(q, x, y) { tie(q, x, y, '#3050a8'); } });
      fig(p, M(p).box(-2, 54, ART_W + 4, 22), '#7c5438', { sh: 0, hi: [0, 1] });
      // the adding machine, and how far its paper's got
      fig(p, M(p).poly([[74, 54], [102, 54], [106, 72], [70, 72]]), '#d8d0b8', { sh: [1, 1], hi: [1, 1] });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) fig(p, M(p).box(77 + i * 6, 60 + j * 5, 4, 3), '#585868', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[80, 54], [90, 54], [90, 4], [80, 4]]), '#f8f8f0');
      for (let y = 7; y < 54; y += 4) p.box(82, y, 6, 1, '#808890');
      pooch(p, 10, 46, { coat: '#d8b078', ears: '#b08850', chest: '#ecd0a0', collar: '#f0b030' }, 1);
    },
    // "The dumbbell rack is my legacy."
    warren(p) {
      room(p, '#90949c', '#585460', 62);
      for (let x = 66; x < ART_W; x += 4) p.box(x, 4, 2, 2, '#808490');
      // the rack
      fig(p, M(p).box(64, 8, 3, 54).box(112, 8, 3, 54).box(64, 22, 51, 3).box(64, 40, 51, 3), '#30303c', { sh: 0, hi: 0 });
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const x = 70 + i * 15, y = 15 + j * 18, s = 2 + j;
        flat(p, M(p).box(x, y + 2, 12, 2), '#c8c8d0');
        fig(p, M(p).rbox(x - 1, y - s + 2, 4, s * 2 + 2, 1).rbox(x + 9, y - s + 2, 4, s * 2 + 2, 1), '#3c3c48', { sh: 0, hi: [1, 1] });
      }
      const cx = 26, cy = 34, skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#f8f8f8', hairdo: 'short', mouth: 'grin', brow: 'raised' });
      arm(p, cx + 24, 76, cx + 31, 40, '#f8f8f8', skin, 10);
      flat(p, M(p).box(cx + 21, 30, 22, 3), '#c8c8d0');
      fig(p, M(p).rbox(cx + 19, 24, 5, 15, 1).rbox(cx + 41, 24, 5, 15, 1), '#3c3c48', { sh: 0, hi: [1, 1] });
    },
    // "Have you read the Globe & Mail today?"
    bob(p) {
      room(p, '#a89888', '#6c5c50', 62);
      for (const x of [4, 104]) { fig(p, M(p).box(x, 6, 10, 56), '#6c4830', { sh: 0, hi: 0 }); for (let y = 12; y < 60; y += 12) p.box(x, y, 10, 1, '#3c2818'); }
      const cx = 59, cy = 17, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#3868c8', hairdo: 'sidepart', mouth: 'smile', brow: 'raised', look: 'side', specs: '#2c2c3c' });
      // and the paper, wide open
      fig(p, M(p).poly([[20, 36], [58, 38], [60, 76], [18, 76]]), '#ece8dc', { sh: 0, hi: 0 });
      fig(p, M(p).poly([[60, 38], [98, 36], [100, 76], [60, 76]]), '#f4f0e4', { sh: 0, hi: 0 });
      words(p, 'NEWS', 28, 39, '#2c2c34'); words(p, 'MAIL', 68, 39, '#2c2c34');
      for (let y = 50; y < 74; y += 3) { p.box(24, y, 14, 1, '#909098'); p.box(41, y, 14, 1, '#909098'); p.box(65, y, 14, 1, '#909098'); p.box(82, y, 14, 1, '#909098'); }
      fig(p, M(p).ell(18, 56, 5.5).ell(100, 56, 5.5), skinRamp(skin), { sh: [2, 1], hi: 0 });
    },
    // Admin Assistant, Controllers: every controller in the building goes past this desk
    leon(p) {
      room(p, '#b4bcc4', '#7c8490', 56);
      fig(p, M(p).box(-2, 60, ART_W + 4, 16), '#8a6a48', { sh: 0, hi: [0, 1] });
      for (let i = 0; i < 6; i++) { const c = ['#d83838', '#3868c8', '#58a848', '#f0b030', '#808898', '#9868c8'][i]; fig(p, M(p).box(4 + i * 7, 22, 6, 34), c, { sh: [1, 0], hi: [1, 0] }); p.box(5 + i * 7, 28, 4, 5, '#f4f4f0'); }
      const cx = 66, cy = 33, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#808898', hairdo: 'buzz', mouth: 'smile', clothes(q, x, y) { tie(q, x, y, '#2c6a34'); } });
      arm(p, cx + 25, 76, cx + 30, 54, '#808898', skin, 9);
      // a controller, with its lights on
      fig(p, M(p).rbox(cx + 18, 22, 28, 24, 1), '#2c8c50', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(cx + 22, 26, 10, 8), '#1c2028', { sh: 0, hi: 0 });
      for (let i = 0; i < 4; i++) p.box(cx + 21 + i * 5, 39, 3, 3, '#e8d090');
      for (const [x, c] of [[37, '#20f878'], [41, '#f8d030']]) p.box(cx + x, 27, 2, 2, c);
    },
    // "What do you mean John ate all of the peanut butter cups?"
    kim(p) {
      room(p, '#b4a8bc', '#6c6474', 52);
      fig(p, M(p).box(-2, 56, ART_W + 4, 20), '#7c5438', { sh: 0, hi: [0, 1] });
      const cx = 40, cy = 29, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#201818', top: '#3868c8', hairdo: 'long', brow: 'raised', mouth: 'o', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#283878', { sh: 0, hi: 0, line: null }); } });
      fig(p, M(p).box(-2, 56, ART_W + 4, 20), '#7c5438', { sh: 0, hi: [0, 1] });
      // the empty box, and the wrappers
      fig(p, M(p).poly([[6, 40], [24, 40], [28, 58], [2, 58]]), '#f08020', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).ell(15, 42, 7, 2), '#3c2818');
      words(p, 'PB', 9, 45, '#5a3420');
      for (const [x, y] of [[62, 62], [74, 66], [84, 60], [34, 66]]) fig(p, M(p).ell(x, y, 4, 2), '#f0a030', { sh: 0, hi: [1, 0] });
      // and Felix, who was no help at all
      fig(p, M(p).ell(94, 49, 16, 9), '#e88a30', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(81, 45, 8, 7), '#e88a30', { sh: [1, 1], hi: [1, 1] });
      for (const x of [76, 83]) fig(p, M(p).poly([[x, 40], [x + 2, 34], [x + 5, 40]]), '#b85a18', { sh: 0, hi: 0 });
      for (const x of [77, 83]) p.box(x, 45, 3, 1, LINE);
      fig(p, M(p).ell(81, 49, 3, 2), '#f8d8a8', { sh: 0, hi: 0, line: null });
      for (const x of [90, 98, 104]) p.box(x, 41, 2, 6, '#b85a18');
      words(p, 'z', 88, 24, '#ffffff'); words(p, 'z', 96, 16, '#ffffff', 2);
    },
    // "Am I getting fired? I'll sneak some cokes on the way out."
    john(p) {
      room(p, '#a8a4b0', '#6c6874', 62);
      fig(p, M(p).box(6, 2, 32, 12), '#208848', { sh: 0, hi: 0 }); words(p, 'EXIT', 10, 2, '#ffffff');
      fig(p, M(p).box(4, 16, 36, 46), '#6c5038', { sh: 0, hi: [1, 1] });
      const cx = 66, cy = 27, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#808898', hairdo: 'sidepart', look: 'side', brow: 'worried', mouth: 'nervous', clothes(q, x, y) { tie(q, x, y, '#d03868'); } });
      // arms full
      for (let j = 0; j < 2; j++) for (let i = 0; i < 6 - j; i++) {
        const x = 38 + j * 3 + i * 9, y = 62 - j * 13;
        fig(p, M(p).rbox(x, y, 8, 13, 1), '#d02828', { sh: [1, 0], hi: [1, 0] });
        p.box(x + 1, y, 6, 1, '#d0d4d8'); p.box(x + 1, y + 5, 6, 2, '#f8f8f8');
      }
    },
    // A spike for the receipts, and more on the way
    mayaj(p) {
      room(p, '#c8c0b8', '#847c74', 58);
      for (let i = 0; i < 16; i++) paper(p, i * 37 % 110, i * 19 % 36, 8, 10, i % 3 - 1, '#fbf8e8');
      for (let i = 0; i < 16; i++) p.box((i * 37 % 110) + 2, (i * 19 % 36) + 4, 4, 1, '#a0a0a8');
      const cx = 44, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#b83028', hairdo: 'ponytail', brow: 'raised', mouth: 'smirk', look: 'side', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#f0b030', { sh: 0, hi: 0, line: null }); } });
      arm(p, cx + 26, 76, cx + 32, 62, '#b83028', skin, 9);
      // the spike
      fig(p, M(p).rbox(84, 62, 26, 8, 2), '#3c3c48', { sh: 0, hi: [1, 1] });
      flat(p, M(p).box(96, 18, 2, 44), '#c8d0d8');
      for (let i = 0; i < 9; i++) paper(p, 86 + (i * 3) % 4, 56 - i * 3, 22, 2, 0, i % 2 ? '#fbf8e8' : '#f0ecd8');
    },
    // A spreadsheet, and Birdie, who's got something to say about it
    diane(p) {
      room(p, '#b8b0c4', '#74707c', 60);
      screen(p, 4, 5, 46, 34, (x, y) => {
        p.box(x, y, 44, 32, '#f4f8f4'); p.box(x, y, 44, 4, '#2c8c50');
        for (let i = 1; i < 5; i++) p.box(x + i * 9, y + 4, 1, 28, '#b8c8b8');
        for (let j = 1; j < 6; j++) p.box(x, y + 4 + j * 5, 44, 1, '#b8c8b8');
        p.box(x + 18, y + 14, 9, 5, '#f8e070');
      });
      const cx = 64, cy = 33, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#9868c8', hairdo: 'curls', mouth: 'smile', clothes(q, x, y) { fig(q, M(q).ell(x, y + 28, 2), '#b83028', { sh: 0, hi: 0, line: null }); } });
      pooch(p, 99, 49, { coat: '#c07838', ears: '#6a3c20', chest: '#f8f8f8', collar: '#58a848' }, -1);
      fig(p, M(p).poly([[88, 6], [116, 6], [116, 18], [100, 18], [96, 24], [97, 18], [88, 18]]), '#f8f8f4', { sh: 0, hi: 0 });
      words(p, 'AROO', 90, 7, '#2c2c3c');
    },
    // It's a lot of forms, for one expensive sandwich
    expense(p) {
      p.box(0, 0, ART_W, ART_H, '#4c5868');
      fig(p, M(p).box(-2, 62, ART_W + 4, 14), '#7c5438', { sh: 0, hi: [0, 1] });
      fig(p, M(p).poly([[30, 3], [88, 5], [86, 66], [28, 64]]), '#f8f8f0', { sh: [2, 2], hi: 0 });
      words(p, 'EXPENSE', 37, 6, '#3050a8');
      for (let y = 18; y < 52; y += 6) { p.box(35, y, 32, 1, '#808890'); p.box(71, y, 11, 1, '#808890'); p.box(71, y - 3, 8, 2, '#a0a0a8'); }
      flat(p, M(p).rbox(44, 26, 40, 22, 2).rbox(46, 28, 36, 18, 1, 0), '#d83030');
      words(p, 'NOPE', 49, 28, '#d83030', 1);
      words(p, 'SEE ME', 46, 37, '#d83030');
      // the sandwich, and the receipt stapled to it
      fig(p, M(p).ell(101, 58, 13, 6), '#d8a050', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).box(88, 60, 26, 2), '#58a848'); flat(p, M(p).box(89, 62, 24, 2), '#b83028');
      fig(p, M(p).ell(101, 66, 13, 4), '#c89040', { sh: 0, hi: 0 });
      paper(p, 8, 40, 14, 22, 1, '#fbf8e8'); for (let y = 46; y < 60; y += 3) p.box(10, y, 10, 1, '#a0a0a8');
    },
    // Everybody, in one room, about nothing
    allhands(p) {
      room(p, '#48445c', '#383448', 58);
      fig(p, M(p).box(28, 3, 62, 30), '#f8f8f4', { sh: 0, hi: 0 });
      words(p, 'Q & A', 44, 5, '#3050a8');
      for (let y = 15; y < 30; y += 4) p.box(34, y, 50, 1, '#a0a0a8');
      fig(p, M(p).box(58, 33, 2, 8), '#3c3c48', { line: null, sh: 0, hi: 0 });
      const tops = ['#3868c8', '#b83028', '#58a848', '#f0b030', '#e07898', '#808898', '#40a0a0', '#9868c8'];
      const skins = ['#f8d8b8', '#d8a070', '#f0c098', '#8a5838', '#f8d0a8', '#c08860'], hairs = ['#201818', '#5a3420', '#a8a8b0', '#d06030', '#181010', '#8a5a3a'];
      for (let r = 0; r < 2; r++) for (let i = 0; i < 8 - r; i++) {
        const x = 8 + r * 7 + i * 15, y = 47 + r * 13, up = (i * 3 + r) % 5 === 0;
        fig(p, M(p).rbox(x - 7, y + 6, 14, 16, 3), tops[(i + r * 3) % 8], { sh: [1, 1], hi: [1, 1] });
        fig(p, M(p).ell(x, y, 6), skins[(i * 2 + r) % 6], { sh: [1, 1], hi: 0 });
        fig(p, M(p).ell(x, y - 2, 6, 5).box(x - 7, y, 14, 7, 0), hairs[(i + r * 2) % 6], { sh: 0, hi: 0 });
        if (up) fig(p, M(p).rbox(x + 7, y - 12, 3, 16, 1), skins[(i * 2 + r) % 6], { sh: 0, hi: 0 });
      }
    },
  });

  // ---------- for any deck ----------
  Object.assign(ART, {
    // "I'll sneak some cokes on the way out."
    sneakycoke(p) {
      p.box(0, 0, ART_W, ART_H, '#20242c');
      flat(p, M(p).poly([[60, -4], [76, -4], [100, 62], [36, 62]]), '#3c4048');
      p.box(0, 62, ART_W, 13, '#48484c');
      flat(p, M(p).ell(68, 64, 34, 5), '#686868');
      fig(p, M(p).rbox(52, 22, 32, 42, 3), '#d02828', { sh: [3, 1], hi: [2, 1] });
      fig(p, M(p).rbox(55, 18, 26, 6, 1), '#d0d4d8', { sh: 0, hi: [1, 1] });
      fig(p, M(p).rbox(55, 63, 26, 3, 1), '#b0b4b8', { sh: 0, hi: 0 });
      for (let x = 52; x < 84; x++) { const y = 41 + Math.round(Math.sin((x - 52) / 5) * 3); p.box(x, y, 1, 3, '#f8f8f8'); }
      for (let i = 0; i < 12; i++) p.set(55 + i * 13 % 26, 26 + i * 17 % 34, '#f88080');
      // a hand, coming in from the side to get it
      arm(p, -4, 44, 44, 44, '#808898', '#d8a070', 10);
      for (const [x, y] of [[50, 38], [50, 44], [50, 50]]) fig(p, M(p).rbox(x - 4, y - 2, 10, 4, 2), '#d8a070', { sh: 0, hi: 0 });
      loud(p, '?', 96, 8, '#f8e070', 3);
    },
    // The business pages, over a good cup of coffee
    morningpaper(p) {
      p.box(0, 0, ART_W, ART_H, '#f0c070');
      for (let y = 0; y < 34; y++) p.box(0, y, ART_W, 1, y < 14 ? '#f8d890' : '#f8e4a8');
      fig(p, M(p).ell(90, 28, 16), '#f8f0b0', { sh: 0, hi: 0, line: null });
      p.box(0, 44, ART_W, 31, '#8a5a3a'); p.box(0, 44, ART_W, 1, '#5a3420'); p.box(0, 45, ART_W, 1, '#b07c50');
      fig(p, M(p).poly([[10, 20], [62, 16], [70, 68], [14, 72]]), '#f4f0e4', { sh: [2, 2], hi: 0 });
      words(p, 'NEWS', 14, 18, '#2c2c34', 2);
      flat(p, M(p).line(16, 37, 64, 33, 1), '#2c2c34');
      fig(p, M(p).box(20, 41, 18, 14), '#a8b0c0', { sh: 0, hi: 0 });
      for (let y = 42; y < 68; y += 3) p.box(42, y - (y > 60 ? 1 : 0), 20, 1, '#909098');
      for (let y = 58; y < 70; y += 3) p.box(20, y, 18, 1, '#909098');
      // the coffee
      fig(p, M(p).rbox(82, 46, 22, 20, 4), '#f8f8f4', { sh: [2, 1], hi: 0 });
      fig(p, M(p).ell(93, 47, 9, 2), '#5a3420', { sh: 0, hi: 0, line: null });
      arc(p, 104, 56, 5, -1.4, 1.4, '#f8f8f4'); arc(p, 104, 56, 6, -1.4, 1.4, LINE);
      for (const x of [88, 94, 99]) for (let i = 0; i < 9; i++) p.set(x + Math.round(Math.sin(i / 1.6 + x) * 1.5), 42 - i * 2, '#fff8e0');
    },
    // "The dumbbell rack is my legacy."
    dumbbells(p) {
      p.box(0, 0, ART_W, ART_H, '#383c48');
      rays(p, 59, 40, 16, '#444856', 0.1, 0, 60);
      p.box(0, 60, ART_W, 15, '#20222a'); for (let x = 0; x < ART_W; x += 12) p.box(x, 60, 1, 15, '#2c2e38');
      // one big one
      fig(p, M(p).rbox(40, 40, 38, 8, 1), '#c8d0d8', { sh: [0, 2], hi: [0, 1] });
      for (let i = 0; i < 2; i += 1) {
        const left = 34 - i * 12, right = 77 + i * 12, h = 42 - i * 8;
        fig(p, M(p).rbox(left, 44 - h / 2, 8 + i * 4, h, 2), i ? '#30303c' : '#484858', { sh: [2, 1], hi: [1, 1] });
        fig(p, M(p).rbox(right, 44 - h / 2, 8 + i * 4, h, 2), i ? '#30303c' : '#484858', { sh: [2, 1], hi: [1, 1] });
      }
      words(p, '50', 30, 38, '#f8f8f8'); words(p, '50', 81, 38, '#f8f8f8');
      spark(p, 20, 12, '#fff0b0', 3); spark(p, 100, 14, '#fff0b0', 3); spark(p, 59, 8, '#fff0b0', 2);
    },
    // "Help yourself to some candy."
    candyjar(p) {
      p.box(0, 0, ART_W, ART_H, '#e8a0b8');
      for (let y = 4; y < ART_H; y += 8) for (let x = y % 16 ? 4 : 12; x < ART_W; x += 16) flat(p, M(p).ell(x, y, 2), '#f0b4c8');
      fig(p, M(p).box(-2, 62, ART_W + 4, 14), '#8a5a3a', { sh: 0, hi: [0, 1] });
      const jar = M(p).rbox(32, 16, 54, 50, 10);
      flat(p, jar, '#f4fcff');
      const cols = ['#d83838', '#f0c020', '#3898f0', '#58c848', '#e878b8', '#f08030', '#9868e8', '#ffffff'];
      for (let r = 0; r < 9; r++) for (let i = 0; i < 9; i++) {
        const x = 36 + i * 6 + (r % 2) * 3, y = 62 - r * 5;
        if (jar.has(x, y)) fig(p, M(p).ell(x, y, 3).keep(jar), cols[(i * 5 + r * 3) % 8], { sh: [1, 1], hi: [1, 1], line: null });
      }
      arc(p, 59, 41, 26, 2.6, 3.6, '#ffffff');
      flat(p, M(p).box(38, 24, 3, 26), '#ffffff');
      fig(p, M(p).rbox(36, 8, 46, 9, 2), '#d83838', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(59, 7, 5, 3), '#f0c020', { sh: 0, hi: [1, 1] });
    },
    // Everyone else signed up already
    granfondo(p) {
      for (let y = 0; y < 46; y++) p.box(0, y, ART_W, 1, y < 16 ? '#68b8e8' : y < 30 ? '#90d0f0' : '#c0e8f4');
      flat(p, M(p).poly([[0, 42], [20, 20], [38, 34], [62, 14], [84, 32], [104, 18], [118, 28], [118, 54], [0, 54]]), '#6c88a4');
      flat(p, M(p).poly([[62, 14], [56, 21], [62, 20], [66, 23], [71, 21]]), '#f4f8fc');
      flat(p, M(p).poly([[0, 52], [118, 40], [118, 75], [0, 75]]), '#58a048');
      flat(p, M(p).poly([[0, 62], [118, 48], [118, 66], [0, 75]]), '#585c68');
      const rider = (x, y, top, skin, hair) => {
        for (const w of [x - 11, x + 11]) { arc(p, w, y + 14, 7, 0, Math.PI * 2, '#1c1820'); arc(p, w, y + 14, 6, 0, Math.PI * 2, '#3c3c48'); flat(p, M(p).line(w - 5, y + 14, w + 5, y + 14, 1), '#888898'); }
        flat(p, M(p).line(x - 11, y + 14, x + 3, y + 14, 2).line(x - 4, y + 3, x + 3, y + 14, 2).line(x + 3, y + 14, x + 10, y + 3, 2).line(x - 4, y + 3, x + 10, y + 3, 2).line(x + 10, y + 3, x + 11, y + 14, 2), top);
        flat(p, M(p).line(x - 3, y + 3, x + 2, y + 12, 3), '#2c2c3c');
        fig(p, M(p).line(x - 3, y + 2, x + 6, y - 5, 5), top, { sh: 0, hi: [1, 1] });
        flat(p, M(p).line(x + 6, y - 5, x + 10, y + 2, 2), top);
        fig(p, M(p).ell(x + 8, y - 9, 4), skin, { sh: 0, hi: 0 });
        fig(p, M(p).ell(x + 8, y - 11, 5, 3).box(x, y - 10, 16, 5, 0), '#f0f0f0', { sh: 0, hi: 0 });
      };
      rider(18, 36, '#d83838', '#f0c098', '#201818');
      rider(50, 32, '#3868c8', '#d8a070', '#5a3420');
      rider(78, 28, '#f8f8f8', '#f8d0a8', '#181010');
      rider(102, 24, '#58a848', '#c08860', '#8a5a3a');
    },
    // "You're in for a good time when I MC the Christmas party."
    xmasparty(p) {
      p.box(0, 0, ART_W, ART_H, '#2c2c58');
      for (let i = 0; i < 14; i++) { const x = 4 + i * 8.6; arc(p, x + 4, -6, 11, 0.6, 2.5, '#282838'); fig(p, M(p).ell(x, 4 + (i % 2) * 2, 2, 3), ['#d83838', '#f0c020', '#3898f0', '#58c848'][i % 4], { sh: 0, hi: 0, line: null }); }
      p.box(0, 60, ART_W, 15, '#5c3838');
      // the tree
      for (const [y, w] of [[12, 12], [24, 18], [36, 24]]) fig(p, M(p).poly([[26, y], [26 - w, y + 20], [26 + w, y + 20]]), '#2c7c48', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).box(23, 56, 6, 6), '#5a3420', { sh: 0, hi: 0 });
      spark(p, 26, 10, '#f8e070', 3);
      for (const [x, y, c] of [[19, 30, '#d83838'], [32, 36, '#f0c020'], [14, 46, '#3898f0'], [30, 50, '#d83838'], [40, 48, '#f0c020'], [24, 22, '#f8f8f8']]) p.box(x, y, 2, 2, c);
      // the presents
      for (const [x, w, h, c, r] of [[6, 13, 9, '#d83838', '#f0c020'], [36, 10, 7, '#3898f0', '#f8f8f8']]) { fig(p, M(p).box(x, 67 - h, w, h), c, { sh: [1, 1], hi: [1, 1] }); p.box(x + Math.floor(w / 2), 67 - h, 2, h, r); }
      // a table of food
      fig(p, M(p).box(56, 50, 62, 26), '#f4f0e8', { sh: 0, hi: 0 });
      fig(p, M(p).ell(74, 44, 13, 8), '#a86830', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(74, 50, 17, 3), '#f8f8f4', { sh: 0, hi: 0 });
      for (const [x, c] of [[97, '#d83838'], [105, '#58a848'], [113, '#f0c020']]) { fig(p, M(p).poly([[x - 3, 36], [x + 3, 36], [x + 1, 45], [x - 1, 45]]), c, { sh: 0, hi: [1, 0] }); p.box(x, 45, 1, 5, '#c8d0d8'); }
      for (let i = 0; i < 24; i++) p.set(i * 41 % ART_W, i * 23 % 52, '#f8f8f4');
    },
  });

  // ---------- Engineering's things ----------
  Object.assign(ART, {
    // Hudson's department, in a green box
    firstaid(p) {
      p.box(0, 0, ART_W, ART_H, '#d8e4dc');
      for (let y = 0; y < ART_H; y += 11) p.box(0, y, ART_W, 1, '#c4d4c8');
      for (let x = 5; x < ART_W; x += 11) p.box(x, 0, 1, ART_H, '#c4d4c8');
      fig(p, M(p).rbox(46, 8, 26, 12, 3), '#1c2028', { sh: 0, hi: 0 });
      flat(p, M(p).rbox(50, 12, 18, 10, 1), '#d8e4dc');
      fig(p, M(p).rbox(18, 17, 82, 50, 4), '#28a058', { sh: [3, 3], hi: [2, 2] });
      p.box(18, 40, 82, 2, '#1c7c40');
      fig(p, M(p).box(51, 24, 16, 36).box(41, 34, 36, 16), '#f8f8f4', { sh: [1, 1], hi: 0 });
      flat(p, M(p).box(54, 27, 10, 30).box(44, 37, 30, 10), '#d83030');
      fig(p, M(p).rbox(55, 38, 8, 7, 1), '#f8f0c0', { sh: 0, hi: 0, line: null });
      spark(p, 104, 16, '#ffffff', 3); spark(p, 12, 60, '#ffffff', 2);
    },
    // Up on the roof, where it holds the whole unit up
    roofcurb(p) {
      for (let y = 0; y < 44; y++) p.box(0, y, ART_W, 1, y < 16 ? '#70b8e8' : y < 30 ? '#98d0f0' : '#c4e8f4');
      for (const [x, y, w] of [[12, 8, 22], [84, 14, 26], [50, 4, 16]]) { flat(p, M(p).rbox(x, y, w, 6, 3), '#f8fcff'); flat(p, M(p).rbox(x + 4, y - 3, w - 8, 6, 3), '#f8fcff'); }
      flat(p, M(p).poly([[0, 44], [118, 44], [118, 75], [0, 75]]), '#6c6c74');
      for (let y = 46; y < ART_H; y += 4) for (let x = (y * 3) % 11; x < ART_W; x += 11) p.box(x, y, 5, 1, '#5c5c64');
      // the curb, and the unit on it
      fig(p, M(p).poly([[12, 52], [92, 52], [106, 64], [26, 64]]), '#a8b0b8', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).poly([[26, 64], [106, 64], [106, 71], [26, 71]]), '#808890', { sh: 0, hi: 0 });
      for (let x = 32; x < 104; x += 12) p.box(x, 65, 2, 5, '#585c64');
      unitBox(p, 26, 22, 66, 32, '#c8d0d8');
      for (let x = 62; x < 88; x += 3) p.box(x, 27, 1, 22, '#7c8894');
      arc(p, 44, 38, 10, 0, Math.PI * 2, '#3c3c48');
      flat(p, M(p).line(36, 38, 52, 38, 1).line(44, 30, 44, 46, 1), '#3c3c48');
      fig(p, M(p).ell(44, 38, 2), '#3c3c48', { sh: 0, hi: 0, line: null });
    },
    // "I'm updating the drawings to revision D."
    revisiond(p) {
      p.box(0, 0, ART_W, ART_H, '#24487c');
      for (let x = 4; x < ART_W; x += 8) p.box(x, 0, 1, ART_H, '#2e568c');
      for (let y = 4; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#2e568c');
      for (const [x, y, w, h] of [[14, 22, 76, 1], [14, 54, 76, 1], [14, 22, 1, 33], [90, 22, 1, 33], [40, 22, 1, 33], [66, 22, 1, 33]]) p.box(x, y, w, h, '#e8f0f8');
      arc(p, 78, 38, 8, 0, Math.PI * 2, '#e8f0f8'); arc(p, 78, 38, 3, 0, Math.PI * 2, '#e8f0f8');
      for (let x = 44; x < 64; x += 3) p.box(x, 26, 1, 25, '#88b0d8');
      flat(p, M(p).line(14, 15, 90, 15, 1).line(14, 12, 14, 18, 1).line(90, 12, 90, 18, 1), '#e8f0f8');
      words(p, 'A', 6, 62, '#88b0d8'); words(p, 'B', 16, 62, '#88b0d8'); words(p, 'C', 26, 62, '#88b0d8');
      flat(p, M(p).line(4, 68, 34, 62, 1), '#d83030');
      // the stamp, still wet
      const m = M(p).rbox(46, 46, 70, 26, 2);
      m.rbox(48, 48, 66, 22, 1, 0);
      flat(p, m, '#d83030');
      words(p, 'REV D', 51, 48, '#d83030', 2);
      spark(p, 108, 10, '#ffffff', 3);
    },
    // The honeycomb wheel: hot air goes in on one side, and the heat comes out on the other
    heatwheel(p) {
      p.box(0, 0, 59, ART_H, '#b83828'); p.box(59, 0, 59, ART_H, '#2858a8');
      for (let y = 8; y < ART_H; y += 14) {
        flat(p, M(p).line(2, y, 18, y, 2).poly([[18, y - 3], [22, y], [18, y + 3]]), '#f08860');
        flat(p, M(p).line(98, y, 114, y, 2).poly([[98, y - 3], [94, y], [98, y + 3]]), '#78b8f8');
      }
      fig(p, M(p).ell(59, 37, 34), '#7c8088', { sh: [3, 2], hi: [2, 1] });
      const face = M(p).ell(59, 37, 30);
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
        if (!face.has(x, y)) continue;
        const row = Math.floor(y / 3), hex = (x + (row % 2) * 2) % 4 === 0 || y % 3 === 0;
        const t = (x - 29) / 60;
        p.set(x, y, hex ? '#584c4c' : t < 0.5 ? (t < 0.25 ? '#e87840' : '#d89860') : (t > 0.75 ? '#70a0e0' : '#a0b4d0'));
      }
      fig(p, M(p).ell(59, 37, 6), '#c8d0d8', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(59, 37, 2), '#2c2c3c', { sh: 0, hi: 0, line: null });
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; flat(p, M(p).line(59 + Math.cos(a) * 6, 37 + Math.sin(a) * 6, 59 + Math.cos(a) * 30, 37 + Math.sin(a) * 30, 1), '#c8ccd4'); }
      arc(p, 59, 37, 36, -0.8, -0.1, '#ffffff'); arc(p, 59, 37, 36, 2.3, 3, '#ffffff');
      flat(p, M(p).poly([[92, 21], [97, 26], [90, 28]]), '#ffffff');
      flat(p, M(p).poly([[26, 53], [21, 48], [28, 46]]), '#ffffff');
    },
    // What Haakon makes. The big one, running flat out. (u: how far round its loop it is)
    airhandler(p, u = 0) {
      p.box(0, 0, ART_W, ART_H, '#1c2840');
      rays(p, 70, 36, 18, '#24344c', 0.12 + u * Math.PI * 2 / 18, 0, 64);
      p.box(0, 64, ART_W, 11, '#3c4458'); p.box(0, 64, ART_W, 1, '#10141c');
      // the casing, right across
      fig(p, M(p).rbox(4, 10, 92, 54, 2), '#c0ccd8', { sh: [3, 3], hi: [2, 2], deep: [1, 1] });
      p.box(5, 11, 90, 1, '#e8f0f8');
      for (const x of [34, 64]) { p.box(x, 11, 2, 52, '#7c8898'); p.box(x + 2, 11, 1, 52, '#e8f0f8'); }
      p.box(8, 13, 14, 3, '#3c78b8'); words(p, 'AHU', 9, 17, '#3c78b8');
      // a door with a window, the coil behind it
      fig(p, M(p).box(38, 18, 22, 38), '#384858', { sh: 0, hi: 0 });
      fig(p, M(p).box(40, 20, 18, 34), '#c07840', { sh: 0, hi: 0, line: null });
      for (let x = 41; x < 57; x += 2) p.box(x, 20, 1, 34, '#8c5228');
      fig(p, M(p).rbox(55, 34, 3, 8, 1), '#f0c020', { sh: 0, hi: 0 });
      // the dial, shaking
      fig(p, M(p).ell(18, 42, 9), '#f4f4f0', { sh: 0, hi: 0 });
      const needle = -0.5 + Math.sin(u * Math.PI * 4) * 0.35;
      flat(p, M(p).line(18, 42, 18 + Math.cos(needle) * 7, 42 + Math.sin(needle) * 7, 1), '#d83030');
      arc(p, 18, 42, 7, -1, 0.1, '#d83030');
      // and the fan, in the end
      fig(p, M(p).ell(80, 37, 20), '#5c6878', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).ell(80, 37, 17), '#10141c');
      for (let i = 0; i < 7; i++) {
        const a = u * Math.PI * 2 + i * Math.PI * 2 / 7, b = a + 0.62;
        fig(p, M(p).poly([[80, 37], [80 + Math.cos(a) * 16, 37 + Math.sin(a) * 16], [80 + Math.cos(b) * 16, 37 + Math.sin(b) * 16]]), i % 2 ? '#d0d8e0' : '#a8b4c0', { sh: 0, hi: 0, line: null });
      }
      fig(p, M(p).ell(80, 37, 4), '#e8b030', { sh: [1, 1], hi: [1, 1] });
      // the air, on its way out
      for (let i = 0; i < 8; i++) {
        const y = 10 + i * 8, x = 94 + ((i * 11 + u * 24) % 24), n = 5 + (i * 3) % 6;
        p.box(x, y, n, 1, '#c8f0ff');
        if (i % 2) p.box(x - 3, y + 2, 3, 1, '#7cc0e8');
      }
      // papers going with it
      for (let i = 0; i < 3; i++) {
        const t = (u + i / 3) % 1, x = 92 + t * 28, y = 18 + i * 18 + Math.sin(t * Math.PI * 2) * 3;
        p.box(x, y, 5, 4, '#f8f8f0'); p.box(x + 1, y + 1, 3, 1, '#808890');
      }
      for (let x = 8; x < 96; x += 14) p.box(x, 66, 7, 2, '#e8b820');
    },
    // One spring roll, ready to go
    springroll(p) {
      p.box(0, 0, ART_W, ART_H, '#d84838');
      for (let y = 0; y < ART_H; y += 6) for (let x = (y % 12) ? 0 : 6; x < ART_W; x += 12) flat(p, M(p).box(x, y, 6, 6), '#e86858');
      fig(p, M(p).ell(59, 48, 44, 16), '#f8f8f4', { sh: [2, 2], hi: 0 });
      flat(p, M(p).ell(59, 47, 35, 11), '#e8e4dc');
      fig(p, M(p).line(28, 44, 90, 34, 18), '#d89838', { sh: [2, 3], hi: [2, 2] });
      for (let i = 0; i < 6; i++) { const x = 34 + i * 10, y = 43 - i * 1.6; flat(p, M(p).line(x, y - 7, x + 3, y + 7, 1), '#a86820'); }
      for (const [x, y] of [[36, 35], [62, 30], [80, 26], [50, 41]]) p.set(x, y, '#f8d890');
      flat(p, M(p).ell(90, 34, 7, 8), '#c08028');
      flat(p, M(p).ell(90, 34, 4, 5), '#6c9848');
      spark(p, 18, 16, '#ffffff', 3); spark(p, 100, 12, '#ffffff', 2);
      for (const [x, y] of [[44, 26], [38, 20], [46, 14], [64, 20], [70, 14]]) p.box(x, y, 1, 3, '#f8f8f4');
    },
  });

  // ---------- the rest of Engineering: designers, programmers and R&D ----------
  const tieOn = (c, jacket) => (q, x, y) => tie(q, x, y, c, jacket);
  const beads = (c) => (q, x, y) => { flat(q, M(q).line(x - 8, y + 21, x, y + 30, 1).line(x + 8, y + 21, x, y + 30, 1), c); fig(q, M(q).ell(x, y + 31, 2), c, { sh: 0, hi: [1, 1], line: null }); };
  Object.assign(ART, {
    // Frankie: "Who needs a Roomba? I'm a dog mop - I dust the floors for free!"
    avery(p) {
      room(p, '#b4c0cc', '#c8c0b0', 52);
      for (let x = 0; x < ART_W; x += 20) p.box(x, 52, 1, 23, '#b0a898');
      const cx = 36, cy = 28, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#78a8e8', hairdo: 'short', mouth: 'grin', brow: 'raised', look: 'side', clothes: tieOn('#d03868') });
      // the floor it's done already, and the dust it hasn't got to
      for (const [x, y, n] of [[76, 56, 2], [84, 60, 1], [72, 64, 1]]) spark(p, x, y, '#ffffff', n);
      for (const [x, y] of [[113, 66], [116, 60], [110, 58]]) flat(p, M(p).ell(x, y, 3, 2), '#a89c88');
      // the dog mop
      for (const [x, y, r] of [[80, 67, 5], [87, 70, 5], [95, 70, 5], [101, 69, 5], [90, 63, 7], [98, 63, 7]]) fig(p, M(p).ell(x, y, r), '#fafaf6', { sh: [1, 1], hi: 0 });
      fig(p, M(p).ell(106, 58, 8), '#fafaf6', { sh: [1, 1], hi: 0 });
      fig(p, M(p).ell(100, 57, 3, 5), '#e2ded4', { sh: 0, hi: 0 });
      p.set(107, 57, LINE); p.set(111, 57, LINE); p.box(112, 60, 2, 2, LINE);
      p.box(100, 64, 8, 1, '#283a88');
    },
    // A unit going round on the screen, with nothing on it but lines
    carlos(p) {
      BACKS.cubicle(p);
      screen(p, 50, 3, 64, 46, (x, y) => {
        const a = '#60e0f0', b = '#3898c8';
        flat(p, M(p).line(x + 8, y + 18, x + 42, y + 12, 1).line(x + 42, y + 12, x + 56, y + 20, 1).line(x + 56, y + 20, x + 22, y + 26, 1).line(x + 22, y + 26, x + 8, y + 18, 1), a);
        flat(p, M(p).line(x + 8, y + 18, x + 8, y + 32, 1).line(x + 22, y + 26, x + 22, y + 40, 1).line(x + 56, y + 20, x + 56, y + 34, 1).line(x + 8, y + 32, x + 22, y + 40, 1).line(x + 22, y + 40, x + 56, y + 34, 1), a);
        flat(p, M(p).line(x + 33, y + 24, x + 33, y + 38, 1).line(x + 44, y + 22, x + 44, y + 36, 1), b);
        arc(p, x + 15, y + 26, 4, 0, Math.PI * 2, b);
        p.box(x + 2, y + 2, 16, 2, '#3c5c70'); p.box(x + 2, y + 5, 9, 1, '#3c5c70');
      });
      fig(p, M(p).box(-2, 58, ART_W + 4, 18), '#8a6a48', { sh: 0, hi: [0, 1] });
      const cx = 25, cy = 32, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#201818', top: '#58a848', hairdo: 'short', mouth: 'smile', look: 'side', beard: '#201818', clothes: tieOn('#f8f8f8') });
      fig(p, M(p).rbox(66, 60, 22, 9, 3), '#d8d8e0', { sh: [1, 1], hi: [1, 1] });
    },
    // Roof Curbs: up on someone's roof, with the mountains behind
    charles(p) {
      for (let y = 0; y < 50; y++) p.box(0, y, ART_W, 1, y < 18 ? '#88c8e8' : y < 34 ? '#a8d8f0' : '#d0ecf4');
      flat(p, M(p).poly([[0, 40], [18, 20], [36, 34], [56, 16], [78, 34], [98, 22], [118, 34], [118, 48], [0, 48]]), '#8098b0');
      flat(p, M(p).poly([[56, 16], [50, 22], [56, 21], [60, 24], [64, 21]]), '#f4f8fc');
      for (const [x, w, h] of [[0, 14, 18], [16, 10, 26], [28, 16, 14], [86, 12, 24], [100, 18, 16]]) { p.box(x, 50 - h, w, h, '#687888'); for (let y = 52 - h; y < 48; y += 4) for (let i = x + 2; i < x + w - 1; i += 4) p.box(i, y, 2, 2, '#c0d0d8'); }
      p.box(0, 50, ART_W, 25, '#5c5c64'); p.box(0, 50, ART_W, 1, '#3c3c44');
      // a curb, waiting for its unit
      fig(p, M(p).poly([[78, 56], [112, 56], [118, 68], [84, 68]]), '#b0b8c0', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).poly([[84, 58], [108, 58], [111, 65], [87, 65]]), '#2c2c34');
      const cx = 44, cy = 35, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#58a848', hairdo: 'under', mouth: 'smile', clothes(q, x, y) { hiVis(q, x, y); } });
      hardHat(p, cx, cy, '#f8f8f4');
      arm(p, cx - 25, 76, cx - 30, 54, '#58a848', skin, 9);
      fig(p, M(p).line(cx - 40, 40, cx - 24, 60, 6), '#e8f0f8', { sh: [1, 1], hi: 0 });
    },
    // "I'm down this week on spring rolls. I guess I just won't eat this weekend :("
    cody(p) {
      room(p, '#a8a098', '#6c6460', 56);
      fig(p, M(p).box(66, 4, 48, 40), '#f8f8f4', { sh: 0, hi: 0 });
      words(p, 'ZIN', 69, 6, '#3050a8'); words(p, 'ME', 69, 24, '#d83030');
      for (let i = 0; i < 4; i++) p.box(92 + i * 3, 6, 1, 9, '#3050a8');
      flat(p, M(p).line(90, 13, 104, 7, 1), '#3050a8');
      words(p, '0', 92, 24, '#d83030');
      fig(p, M(p).box(-2, 60, ART_W + 4, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      const cx = 36, cy = 31, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#f8f8f8', hairdo: 'sidepart', look: 'tired', brow: 'worried', mouth: 'flat', clothes: tieOn('#f0b030') });
      fig(p, M(p).box(-2, 60, ART_W + 4, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      // the plate, with one crumb
      fig(p, M(p).ell(84, 66, 22, 7), '#f8f8f4', { sh: [1, 1], hi: 0 });
      flat(p, M(p).ell(84, 65, 15, 4), '#e4e0d8');
      p.box(89, 64, 2, 1, '#c08028');
    },
    // A model of the unit she's drawing, made out of the drawings
    dalia(p) {
      room(p, '#d0c8d4', '#8c8494', 62);
      flat(p, M(p).line(8, 20, 40, 20, 3).line(10, 6, 10, 54, 3), '#c8a068');
      for (let y = 10; y < 54; y += 6) p.box(10, y, 3, 1, '#786038');
      const cx = 38, cy = 33, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#e07898', hairdo: 'long', mouth: 'grin', brow: 'raised', clothes: beads('#f8f8f8') });
      arm(p, cx + 26, 76, cx + 44, 60, '#e07898', skin, 9);
      // cardboard, folded and taped
      const card = '#d8b888';
      fig(p, M(p).poly([[66, 36], [100, 28], [114, 34], [80, 43]]), ramp(card).hi, { sh: 0, hi: 0 });
      fig(p, M(p).poly([[66, 36], [80, 43], [80, 58], [66, 51]]), card, { sh: 0, hi: 0 });
      fig(p, M(p).poly([[80, 43], [114, 34], [114, 49], [80, 58]]), ramp(card).shade, { sh: 0, hi: 0 });
      flat(p, M(p).line(90, 41, 90, 55, 1).line(101, 38, 101, 52, 1), '#8c6c44');
      arc(p, 73, 45, 3, 0, Math.PI * 2, '#8c6c44');
      p.box(83, 34, 12, 2, '#f8e8a8');
    },
    // Programmer: three screens of it, in the dark
    damir(p) {
      p.box(0, 0, ART_W, ART_H, '#14141c');
      const code = (x, y, w, h) => { for (let j = 0; j < h; j += 3) { const n = 3 + (x * 3 + j * 7) % (w - 5); p.box(x + 1 + ((j * 5 + x) % 3) * 2, y + j, n, 1, j % 9 === 3 ? '#f8e070' : j % 6 === 0 ? '#60e0f0' : '#40d868'); } };
      for (const [x, y, w, h] of [[2, 10, 32, 28], [43, 2, 32, 26], [84, 10, 32, 28]]) {
        fig(p, M(p).box(x, y, w, h), '#0c1820', { sh: 0, hi: 0 });
        code(x + 1, y + 2, w - 2, h - 4);
      }
      const cx = 59, cy = 38, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#181010', top: '#f0b030', hairdo: 'short', mouth: 'smirk', look: 'side', clothes: tieOn('#3050a8') });
      for (const x of [-6, 6]) p.box(cx + x - 3, cy + 2, 7, 1, '#40d868');
    },
    // Ducts all the way round the wall, and only she knows where they go
    daphne(p) {
      p.box(0, 0, ART_W, ART_H, '#5c6878');
      const duct = M(p).line(-4, 12, 40, 12, 12).line(40, 12, 40, 34, 12).line(78, 12, 122, 12, 12).line(78, 12, 78, 34, 12).line(40, 34, 78, 34, 12).line(102, 12, 102, 58, 12).line(102, 58, 122, 58, 12).line(14, 12, 14, 58, 12).line(-4, 58, 14, 58, 12);
      fig(p, duct, '#c0c8d0', { sh: [2, 2], hi: [1, 1] });
      for (const [x, y] of [[26, 6], [90, 6], [8, 30], [96, 30], [50, 28], [66, 28]]) p.box(x, y, 2, 12, '#88929c');
      for (const [x, y] of [[32, 12], [20, 12], [96, 34], [8, 44]]) flat(p, M(p).poly([[x, y - 3], [x + 4, y], [x, y + 3]]), '#3868c8');
      p.box(0, 66, ART_W, 9, '#404854');
      const cx = 59, cy = 37, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#58a848', hairdo: 'bun', mouth: 'smile', specs: '#f0f0f0', clothes: beads('#2c6a34') });
    },
    // "If you see my mug, its the one with the tweety bird on it."
    dave(p) {
      room(p, '#4c5060', '#70707c', 62);
      // the robot arm, going about it by itself
      fig(p, M(p).rbox(78, 54, 30, 9, 1), '#3c3c48', { sh: 0, hi: [1, 1] });
      fig(p, M(p).line(93, 54, 100, 26, 9), '#f08020', { sh: [2, 1], hi: [1, 1] });
      fig(p, M(p).line(100, 26, 76, 12, 7), '#f08020', { sh: [1, 2], hi: [1, 1] });
      for (const [x, y, r] of [[93, 54, 6], [100, 26, 6], [76, 12, 4]]) fig(p, M(p).ell(x, y, r), '#3c3c48', { sh: 0, hi: [1, 1] });
      fig(p, M(p).box(70, 16, 12, 4), '#c8d0d8', { sh: 0, hi: 0 });
      fig(p, M(p).box(60, 20, 34, 3), '#a8b4c0', { sh: 0, hi: 0 });
      const cx = 37, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#e07898', hairdo: 'bald', mouth: 'smile', brow: 'raised', clothes: tieOn('#f8e070') });
      // the mug, with a yellow bird on it
      arm(p, cx + 25, 76, cx + 31, 60, '#e07898', skin, 9);
      fig(p, M(p).rbox(cx + 24, 40, 20, 20, 2), '#f8f8f4', { sh: [1, 1], hi: 0 });
      arc(p, cx + 44, 49, 5, -1.4, 1.4, '#f8f8f4');
      fig(p, M(p).ell(cx + 33, 50, 6), '#f8d820', { sh: 0, hi: [1, 1] });
      fig(p, M(p).ell(cx + 33, 44, 4), '#f8d820', { sh: 0, hi: 0 });
      p.set(cx + 33, 43, LINE); p.box(cx + 35, 45, 2, 1, '#f08020');
    },
    // Structurals: the colours show where the beam's about to give up
    derek(p) {
      p.box(0, 0, ART_W, ART_H, '#1c2030');
      for (let x = 6; x < ART_W; x += 8) p.box(x, 0, 1, ART_H, '#242a3c');
      for (let y = 6; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#242a3c');
      const heat = ['#3050d8', '#30a0e0', '#30d0a0', '#70e050', '#e8e030', '#f09030', '#e83020'];
      for (let x = 2; x < 116; x++) {
        const bend = Math.round(Math.sin((x - 2) / 114 * Math.PI) * 8);
        for (let y = 0; y < 15; y++) {
          const t = Math.abs(y - 7) / 7 * (Math.sin((x - 2) / 114 * Math.PI)) * 6;
          p.set(x, 7 + bend + y, heat[Math.min(6, Math.round(t))]);
          if ((x % 6 === 0 || y % 5 === 0)) p.set(x, 7 + bend + y, '#10141c');
        }
      }
      for (const x of [59, 38, 80]) { flat(p, M(p).line(x, 0, x, 8, 2), '#f8f8f8'); flat(p, M(p).poly([[x - 3, 7], [x + 3, 7], [x, 12]]), '#f8f8f8'); }
      const cx = 59, cy = 45, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#58a848', hairdo: 'sidepart', brow: 'worried', look: 'wide', mouth: 'o', clothes: tieOn('#f0b030') });
    },
    // Measuring something very small, very carefully
    eric(p) {
      BACKS.office(p);
      const cx = 32, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#201818', top: '#40a0a0', hairdo: 'spiky', brow: 'raised', mouth: 'flat', look: 'side', clothes: tieOn('#f8f8f8') });
      arm(p, cx + 25, 76, cx + 30, 62, '#40a0a0', skin, 9);
      // the calipers
      fig(p, M(p).box(56, 12, 60, 8), '#d0d8e0', { sh: [0, 1], hi: [0, 1] });
      for (let x = 60; x < 114; x += 3) p.box(x, 13, 1, x % 9 === 0 ? 4 : 2, '#585868');
      fig(p, M(p).poly([[56, 20], [64, 20], [64, 46], [60, 56], [56, 46]]), '#b8c4d0', { sh: 0, hi: 0 });
      fig(p, M(p).poly([[74, 12], [100, 12], [100, 30], [80, 30], [80, 46], [76, 56], [72, 46], [72, 20]]), '#d0d8e0', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(82, 15, 16, 10), '#b0c8a8', { sh: 0, hi: 0 });
      words(p, '.01', 83, 15, '#1c2820');
      // and what's in them
      fig(p, M(p).box(65, 48, 7, 7), '#808898', { sh: 0, hi: [1, 1] });
    },
    // Water piping, evaps, and that phone
    eugene(p) {
      p.box(0, 0, ART_W, ART_H, '#3c5868');
      for (const [y, c] of [[8, '#3898d8'], [22, '#c86838']]) { p.box(0, y, ART_W, 7, c); p.box(0, y, ART_W, 1, ramp(c).hi); p.box(0, y + 6, ART_W, 1, ramp(c).shade); for (let x = 6; x < ART_W; x += 28) p.box(x, y - 1, 3, 9, '#2c2c3c'); }
      for (const x of [20, 100]) { fig(p, M(p).box(x - 1, 2, 5, 7), '#585868', { sh: 0, hi: 0 }); fig(p, M(p).ell(x + 1, 3, 5, 2), '#d83030', { sh: 0, hi: [1, 1] }); }
      for (const [x, y] of [[50, 16], [50, 19], [78, 17]]) p.box(x, y, 1, 2, '#78c8f8');
      const cx = 40, cy = 37, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#e8c050', top: '#808898', hairdo: 'quiff', look: 'wide', brow: 'worried', mouth: 'o', clothes: tieOn('#f8f8f8') });
      fig(p, M(p).box(70, 60, 50, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      // it's ringing again
      fig(p, M(p).rbox(80, 46, 28, 15, 2), '#d83030', { sh: [2, 1], hi: [1, 1] });
      flat(p, M(p).line(76, 44, 112, 44, 7), '#d83030'); flat(p, M(p).line(76, 44, 76, 48, 7).line(112, 44, 112, 48, 7), '#d83030');
      flat(p, M(p).line(76, 42, 112, 42, 1), '#f88080');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.box(87 + i * 5, 50 + j * 4, 3, 2, '#f8f8f4');
      for (const r of [8, 12]) { arc(p, 94, 40, r + 22, -2, -1.5, '#f8f070'); arc(p, 94, 40, r + 22, -1.6, -1.1, '#f8f070'); }
    },
    // "Do you know the lyrics to 'Bohemian Rhapsody'?"
    gigi(p) {
      p.box(0, 0, ART_W, ART_H, '#2c2048');
      rays(p, 59, 44, 18, '#3c2c60', 0.1, 0, ART_H);
      flat(p, M(p).poly([[46, 0], [72, 0], [100, 75], [18, 75]]), '#584080');
      const cx = 57, cy = 34, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#40a0a0', hairdo: 'curls', look: 'shut', mouth: 'open', brow: 'raised', clothes: beads('#283878') });
      arm(p, cx + 26, 76, cx + 11, 56, '#40a0a0', skin, 9);
      fig(p, M(p).line(cx + 11, 58, cx + 6, 49, 4), '#3c3c48', { sh: 0, hi: 0 });
      fig(p, M(p).ell(cx + 5, 47, 4), '#c8c8d0', { sh: [1, 1], hi: [1, 1] });
      for (const [x, y, c] of [[16, 18, '#f8e070'], [28, 8, '#f070a0'], [92, 12, '#70e0f0'], [104, 26, '#f8e070'], [12, 42, '#70e0f0'], [100, 46, '#f070a0']]) {
        fig(p, M(p).ell(x, y + 7, 3, 2), c, { sh: 0, hi: 0, line: null }); flat(p, M(p).box(x + 2, y, 1, 7), c); flat(p, M(p).box(x + 2, y, 4, 2), c);
      }
    },
    // Heat exchangers, and he's who you go to with a cut
    hudson(p) {
      room(p, '#c0c8cc', '#7c8488', 62);
      fig(p, M(p).box(4, 12, 46, 46), '#8c98a4', { sh: [2, 2], hi: [1, 1] });
      for (let i = 0; i < 9; i++) { const y = 15 + i * 4.6; flat(p, M(p).box(7, y, 40, 3), i % 2 ? '#e87850' : '#78a8e8'); }
      flat(p, M(p).line(0, 8, 30, 8, 2).poly([[28, 5], [34, 8], [28, 11]]), '#e83828');
      flat(p, M(p).line(54, 62, 26, 62, 2).poly([[28, 59], [22, 62], [28, 65]]), '#3878e0');
      const cx = 78, cy = 34, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#181010', top: '#808898', hairdo: 'sidepart', mouth: 'smile', clothes(q, x, y) { tie(q, x, y, '#f0b030'); fig(q, M(q).box(x + 15, y + 26, 13, 13), '#f8f8f4', { sh: 0, hi: 0 }); q.box(x + 20, y + 28, 3, 9, '#28a058'); q.box(x + 17, y + 31, 9, 3, '#28a058'); } });
    },
    // Project take-off: every last part on the drawing, in highlighter
    james(p) {
      p.box(0, 0, ART_W, ART_H, '#e8ecf4');
      for (let x = 2; x < ART_W; x += 12) p.box(x, 0, 1, ART_H, '#d4dae8');
      for (let y = 2; y < ART_H; y += 12) p.box(0, y, ART_W, 1, '#d4dae8');
      const mark = [['#f8f060', 2, 8, 34, 8], ['#90f090', 6, 22, 22, 8], ['#f8a0d0', 2, 36, 28, 8], ['#f8f060', 86, 6, 30, 8], ['#90d0f8', 90, 20, 26, 8], ['#f8a0d0', 84, 34, 32, 8], ['#90f090', 88, 48, 28, 8]];
      for (const [c, x, y, w, h] of mark) { p.box(x, y, w, h, c); p.box(x + 2, y + 3, w - 4, 1, '#3c3c50'); p.box(x + 2, y + 5, Math.floor(w / 2), 1, '#3c3c50'); }
      const cx = 57, cy = 36, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#58a848', hairdo: 'short', mouth: 'smile', brow: 'raised', look: 'side', clothes: tieOn('#283878') });
      arm(p, cx + 26, 76, cx + 32, 58, '#58a848', skin, 9);
      fig(p, M(p).line(cx + 30, 56, cx + 40, 40, 5), '#f8e020', { sh: [1, 1], hi: [1, 0] });
      fig(p, M(p).poly([[cx + 37, 41], [cx + 44, 34], [cx + 43, 42]]), '#2c2c3c', { sh: 0, hi: 0, line: null });
    },
    // Design programmer, explaining it to the only one who listens
    jimmy(p) {
      room(p, '#a8a0b8', '#6c6474', 58);
      fig(p, M(p).box(-2, 60, ART_W + 4, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      screen(p, 60, 4, 54, 42, (x, y) => {
        const brace = ['..11', '.1..', '.1..', '.1..', '1...', '.1..', '.1..', '.1..', '..11'];
        p.rows(x + 13, y + 3, brace, { 1: '#f8e070' });
        p.rows(x + 34, y + 3, brace.map((r) => [...r].reverse().join('')), { 1: '#f8e070' });
        p.box(x + 21, y + 7, 2, 2, '#f8e070'); p.box(x + 26, y + 7, 2, 2, '#f8e070');
        for (const [a, b, n, c] of [[6, 20, 22, '#c080f0'], [10, 24, 30, '#60e0f0'], [10, 28, 18, '#40d868'], [14, 32, 26, '#f8a0d0'], [6, 36, 12, '#c080f0']]) p.box(x + a, y + b, n, 1, c);
      }, '#1c1c2c');
      const cx = 30, cy = 32, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#181010', top: '#9868c8', hairdo: 'spiky', mouth: 'open', brow: 'raised', look: 'side', clothes: tieOn('#f8e070') });
      fig(p, M(p).box(-2, 60, ART_W + 4, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      // the duck
      fig(p, M(p).ell(66, 62, 9, 6), '#f8d820', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(60, 54, 6), '#f8d820', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).poly([[66, 53], [71, 55], [66, 57]]), '#f08020');
      p.set(62, 53, LINE);
      flat(p, M(p).poly([[72, 58], [78, 54], [75, 62]]), '#e8c018');
    },
    // A printer that makes the whole unit, one very thin layer at a time
    jonathan(p) {
      room(p, '#889098', '#585c68', 60);
      // the frame
      fig(p, M(p).box(58, 4, 4, 60).box(110, 4, 4, 60).box(58, 4, 56, 4).box(54, 62, 64, 5), '#2c2c3c', { sh: 0, hi: [1, 1] });
      fig(p, M(p).box(62, 18, 48, 3), '#c8d0d8', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(78, 13, 14, 12, 1), '#d83838', { sh: [1, 1], hi: [1, 1] });
      flat(p, M(p).poly([[81, 25], [89, 25], [85, 31]]), '#f0c020');
      // the unit, as far as it's got
      for (let y = 58; y > 36; y -= 2) p.box(68, y, 34, 1, y % 4 ? '#58c8e0' : '#40a8c8');
      for (let y = 58; y > 36; y -= 2) { p.box(71, y, 10, 1, '#2c7898'); p.box(90, y, 8, 1, '#2c7898'); }
      p.box(68, 60, 34, 2, '#f8f8f4');
      const cx = 28, cy = 34, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#e07898', hairdo: 'short', mouth: 'grin', look: 'side', clothes: tieOn('#d03868') });
    },
    // A fan wheel going round on the drawing board, the old-fashioned way
    jordan(p) {
      p.box(0, 0, ART_W, ART_H, '#f4f0dc');
      for (let x = 4; x < ART_W; x += 8) p.box(x, 0, 1, ART_H, '#e8e4cc');
      for (let y = 4; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#e8e4cc');
      for (const r of [28, 20, 6]) arc(p, 84, 43, r, 0, Math.PI * 2, '#3050a8');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; flat(p, M(p).line(84 + Math.cos(a) * 6, 43 + Math.sin(a) * 6, 84 + Math.cos(a + 0.5) * 20, 43 + Math.sin(a + 0.5) * 20, 1), '#3050a8'); }
      flat(p, M(p).line(84, 43, 112, 43, 1), '#d83030');
      // the compass, nearly round
      fig(p, M(p).line(84, 43, 96, 6, 4), '#a8b4c0', { sh: [1, 0], hi: 0 });
      fig(p, M(p).line(96, 6, 112, 42, 4), '#a8b4c0', { sh: [1, 0], hi: 0 });
      fig(p, M(p).ell(96, 6, 4), '#585868', { sh: 0, hi: [1, 1] });
      fig(p, M(p).box(109, 36, 5, 8), '#f0c020', { sh: 0, hi: 0 });
      const cx = 28, cy = 34, skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#181010', top: '#b83028', hairdo: 'sidepart', mouth: 'smile', stache: '#181010', clothes: tieOn('#f0b030') });
    },
    // There it is. Line 412.
    jules(p) {
      p.box(0, 0, ART_W, ART_H, '#20283c');
      for (let j = 0; j < 12; j++) { const n = 12 + (j * 37) % 40; p.box(4 + (j % 3) * 3, 3 + j * 6, n, 2, '#3c4c70'); p.box(66 + (j % 2) * 4, 3 + j * 6, 44 - (j * 13) % 26, 2, '#3c4c70'); }
      const cx = 32, cy = 37, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#3868c8', hairdo: 'buzz', look: 'side', brow: 'angry', mouth: 'smirk', clothes: tieOn('#f8e070') });
      // the magnifying glass, and the bug
      arm(p, cx + 25, 76, 66, 54, '#3868c8', skin, 9);
      fig(p, M(p).line(66, 54, 73, 44, 5), '#5a3420', { sh: 0, hi: 0 });
      flat(p, M(p).ell(84, 28, 19), '#a8d8f0');
      arc(p, 84, 28, 20, 0, Math.PI * 2, '#c8d0d8'); arc(p, 84, 28, 21, 0, Math.PI * 2, '#585868'); arc(p, 84, 28, 19, 0, Math.PI * 2, '#f0f4f8');
      fig(p, M(p).ell(84, 30, 7, 9), '#40a848', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(84, 19, 4), '#2c7838', { sh: 0, hi: 0 });
      flat(p, M(p).line(84, 22, 84, 38, 1), '#1c5c28');
      for (const y of [25, 30, 35]) flat(p, M(p).line(77, y, 71, y - 2, 1).line(91, y, 97, y - 2, 1), '#1c2028');
      flat(p, M(p).line(82, 16, 78, 11, 1).line(86, 16, 90, 11, 1), '#1c2028');
    },
    // Pulled right out to the end of the tape
    kyle(p) {
      BACKS.cubicle(p);
      p.box(0, 62, ART_W, 13, '#5c6c78');
      const cx = 30, cy = 33, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#3868c8', hairdo: 'curly', mouth: 'grin', clothes: tieOn('#3050a8') });
      arm(p, cx + 25, 76, cx + 28, 56, '#3868c8', skin, 9);
      fig(p, M(p).rbox(cx + 20, 42, 20, 18, 3), '#f0c020', { sh: [2, 2], hi: [1, 1] });
      fig(p, M(p).ell(cx + 30, 51, 5), '#26222c', { sh: 0, hi: 0 });
      // the tape
      const tape = M(p).poly([[cx + 39, 48], [117, 26], [117, 34], [cx + 39, 55]]);
      fig(p, tape, '#f8e070', { sh: 0, hi: 0 });
      for (let i = 0; i < 12; i++) { const x = cx + 42 + i * 4; p.box(x, 49 - i * 1.3 - 1, 1, i % 3 ? 2 : 4, '#2c2c3c'); }
      fig(p, M(p).box(112, 22, 5, 15), '#c8d0d8', { sh: 0, hi: 0 });
    },
    // Tech support, electrical, and first aid, all at the same time
    lauren(p) {
      p.box(0, 0, ART_W, ART_H, '#28303c');
      for (const [y, c, w] of [[14, '#e03030', 3], [28, '#3898f0', 3], [44, '#40c868', 3], [58, '#f0c020', 3]]) { const m = M(p); for (let x = 0; x < ART_W; x += 2) m.ell(x, y + Math.sin(x / 11 + y) * 5, w / 2); flat(p, m, c); }
      const cx = 44, cy = 35, skin = '#8a5838';
      person(p, cx, cy, { skin, hair: '#181010', top: '#f0b030', hairdo: 'ponytail', mouth: 'open', brow: 'raised', clothes(q, x, y) { fig(q, M(q).box(x + 13, y + 25, 13, 13), '#f8f8f4', { sh: 0, hi: 0 }); q.box(x + 18, y + 27, 3, 9, '#d83030'); q.box(x + 15, y + 30, 9, 3, '#d83030'); } });
      headset(p, cx, cy);
      arm(p, cx + 26, 76, cx + 34, 56, '#f0b030', skin, 9);
      // the meter
      fig(p, M(p).rbox(cx + 26, 24, 26, 30, 2), '#f0c020', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).box(cx + 30, 28, 18, 10), '#b0c8a8', { sh: 0, hi: 0 });
      words(p, '24V', cx + 30, 28, '#1c2820');
      fig(p, M(p).ell(cx + 39, 46, 4), '#2c2c3c', { sh: 0, hi: [1, 1] });
    },
    // The whole unit with its side off, all drawn out and pinned up
    lia(p) {
      p.box(0, 0, ART_W, ART_H, '#9caabc');
      p.box(0, 64, ART_W, 11, '#6c7c90');
      paper(p, 54, 3, 62, 56);
      const c = '#3050a8';
      flat(p, M(p).line(60, 24, 92, 16, 1).line(92, 16, 110, 24, 1).line(110, 24, 78, 33, 1).line(78, 33, 60, 24, 1).line(60, 24, 60, 42, 1).line(78, 33, 78, 52, 1).line(110, 24, 110, 42, 1).line(60, 42, 78, 52, 1).line(78, 52, 110, 42, 1), c);
      for (const x of [86, 94, 102]) flat(p, M(p).line(x, 31 - (x - 86) / 4, x, 50 - (x - 86) / 4, 1), '#d83030');
      arc(p, 69, 36, 5, 0, Math.PI * 2, c);
      for (const x of [58, 112]) fig(p, M(p).ell(x, 6, 2), '#d83030', { sh: 0, hi: [1, 1] });
      for (const [x, y, n] of [[4, 8, '#f8f0a0'], [4, 24, '#b0e0f8']]) { fig(p, M(p).box(x, y, 11, 11), n, { sh: 0, hi: 0 }); p.box(x + 2, y + 4, 7, 1, '#808890'); p.box(x + 2, y + 7, 5, 1, '#808890'); }
      const cx = 32, cy = 34, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#40a0a0', hairdo: 'long', mouth: 'smile', brow: 'raised', look: 'side', clothes: beads('#f8e070') });
    },
    // The whole fan, in bits, in order
    marcus(p) {
      p.box(0, 0, ART_W, ART_H, '#e4e8f0');
      for (let x = 2; x < ART_W; x += 6) p.box(x, 0, 1, ART_H, '#d8dce8');
      for (let x = 46; x < ART_W; x += 5) p.box(x, 26, 3, 1, '#3050a8');
      // housing, wheel, shaft, motor, bolts
      fig(p, M(p).ell(56, 26, 7, 20), '#8c98a8', { sh: [2, 1], hi: [1, 1] });
      flat(p, M(p).ell(56, 26, 4, 16), '#3c4450');
      fig(p, M(p).ell(74, 26, 5, 17), '#c8d0d8', { sh: [1, 1], hi: [1, 1] });
      for (let y = 13; y < 40; y += 3) p.box(71, y, 6, 1, '#7c8894');
      fig(p, M(p).box(84, 24, 8, 4), '#d8dce0', { sh: 0, hi: 0 });
      fig(p, M(p).rbox(95, 13, 20, 26, 3), '#3c78b8', { sh: [2, 2], hi: [1, 1] });
      for (let x = 98; x < 113; x += 3) p.box(x, 15, 1, 22, '#285890');
      for (const [x, y] of [[62, 6], [66, 44], [86, 14], [88, 38]]) { fig(p, M(p).box(x, y, 3, 5), '#585868', { sh: 0, hi: 0 }); fig(p, M(p).box(x - 1, y - 1, 5, 2), '#808898', { sh: 0, hi: 0, line: null }); }
      words(p, '1', 54, 48, '#d83030'); words(p, '2', 72, 48, '#d83030'); words(p, '3', 102, 42, '#d83030');
      const cx = 24, cy = 38, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#8a5a3a', top: '#f0b030', hairdo: 'sidepart', mouth: 'smirk', brow: 'raised', clothes: tieOn('#2c6a34') });
    },
    // A stylus and a big tablet, with a damper coming out of it
    mayaw(p) {
      room(p, '#c0c8e0', '#8088a8', 64);
      for (let i = 0; i < 18; i++) p.set(4 + i * 41 % 110, 3 + i * 29 % 56, '#d8e0f4');
      const cx = 32, cy = 33, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#181010', top: '#78a8e8', hairdo: 'bob', mouth: 'smile', look: 'side', clothes: beads('#f8f8f8') });
      // the tablet
      fig(p, M(p).poly([[60, 18], [112, 12], [114, 62], [58, 66]]), '#2c2c3c', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[63, 21], [109, 15], [111, 59], [61, 63]]), '#f8f8fc');
      fig(p, M(p).box(72, 24, 28, 28), '#e8eef8', { sh: 0, hi: 0, line: '#3868c8' });
      for (let y = 28; y < 50; y += 5) flat(p, M(p).line(74, y + 2, 98, y - 1, 2), '#3868c8');
      arm(p, cx + 24, 76, 64, 62, '#78a8e8', skin, 9);
      fig(p, M(p).line(66, 60, 90, 38, 3), '#f8f8f4', { sh: 0, hi: 0 });
      flat(p, M(p).ell(90, 38, 1.5), '#d83030');
    },
    // Door Handle, it says on the list. It's a very complicated door handle.
    michaeltam(p) {
      p.box(0, 0, ART_W, ART_H, '#8c98a4');
      for (let y = 4; y < ART_H; y += 8) p.box(0, y, ART_W, 1, '#7c8894');
      fig(p, M(p).box(58, 4, 56, 66), '#b8c4cc', { sh: [2, 2], hi: [1, 1] });
      flat(p, M(p).box(58, 4, 2, 66), '#1c1c24');
      for (const y of [8, 66]) for (const x of [64, 108]) fig(p, M(p).ell(x, y, 2), '#585868', { sh: 0, hi: 0 });
      // the workings, behind glass
      fig(p, M(p).rbox(70, 12, 36, 24, 2), '#2c3440', { sh: 0, hi: 0 });
      for (const [x, y, r, n] of [[80, 24, 7, 8], [94, 22, 5, 6], [93, 30, 3, 5]]) { fig(p, M(p).ell(x, y, r), '#d8b048', { sh: [1, 1], hi: [1, 1], line: null }); for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; p.box(x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1), 2, 2, '#a88428'); } p.set(x, y, LINE); }
      // the handle
      fig(p, M(p).rbox(78, 44, 28, 8, 3), '#3c3c48', { sh: [1, 2], hi: [1, 1] });
      fig(p, M(p).ell(82, 48, 8), '#c8d0d8', { sh: [2, 2], hi: [1, 1] });
      spark(p, 104, 40, '#ffffff', 2);
      const cx = 30, cy = 34, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#181010', top: '#40a0a0', hairdo: 'sidepart', mouth: 'smile', brow: 'raised', look: 'side', specs: '#2a2a34', clothes: tieOn('#3050a8') });
      arm(p, cx + 25, 76, 76, 50, '#40a0a0', skin, 9);
    },
    // The psychrometric chart: everything you'd ever need to know about air, in curves
    muhammad(p) {
      p.box(0, 0, ART_W, ART_H, '#3c6c5c');
      p.box(2, 2, ART_W - 4, 60, '#f8f8f4');
      for (let x = 8; x < 116; x += 9) p.box(x, 4, 1, 56, '#d0d8d8');
      for (let y = 8; y < 60; y += 8) p.box(50, y, 66, 1, '#b8d0e0');
      for (const k of [20, 42, 68, 100]) { const m = M(p); for (let x = 50; x < 116; x++) { const y = 60 - Math.pow((x - 50) / 66, 2) * k; if (y > 3) m.ell(x, y, 0.8); } flat(p, m, k === 100 ? '#d83030' : '#3898c8'); }
      for (let x = 56; x < 112; x += 12) flat(p, M(p).line(x, 58, x + 16, 10, 1), '#a8d8b8');
      fig(p, M(p).ell(90, 36, 3), '#f0c020', { sh: 0, hi: [1, 1] });
      p.box(0, 62, ART_W, 13, '#685040'); p.box(0, 62, ART_W, 2, '#8a6a58');
      const cx = 28, cy = 36, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#b83028', hairdo: 'short', beard: '#5a3420', mouth: 'smile', brow: 'raised', clothes: tieOn('#2c6a34') });
      arm(p, cx + 25, 76, 88, 40, '#b83028', skin, 9);
    },
    // Everyone else went home hours ago
    nicholas(p) {
      p.box(0, 0, ART_W, ART_H, '#181c38');
      fig(p, M(p).box(70, 4, 44, 34), '#28305c', { sh: 0, hi: 0 });
      p.box(91, 4, 2, 34, '#181c38'); p.box(70, 20, 44, 2, '#181c38');
      fig(p, M(p).ell(102, 14, 5), '#f8f0c0', { sh: 0, hi: 0, line: null }); flat(p, M(p).ell(105, 12, 4), '#28305c');
      for (const [x, y] of [[76, 8], [84, 14], [78, 28], [100, 30], [108, 26], [86, 30]]) p.set(x, y, '#f8f8f4');
      flat(p, M(p).poly([[6, 12], [14, 12], [46, 62], [-14, 62]]), '#3c3858');
      const cx = 40, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#78a8e8', hairdo: 'short', look: 'tired', mouth: 'flat', clothes: tieOn('#f8e070') });
      fig(p, M(p).box(-2, 62, ART_W + 4, 14), '#5a4030', { sh: 0, hi: [0, 1] });
      // the lamp
      fig(p, M(p).poly([[4, 10], [16, 10], [20, 18], [0, 18]]), '#d83030', { sh: 0, hi: [1, 1] });
      flat(p, M(p).line(8, 18, 8, 62, 2), '#2c2c3c');
      // the cups so far
      for (const [x, y] of [[82, 53], [92, 53], [102, 53], [87, 44], [97, 44], [92, 35]]) { fig(p, M(p).poly([[x - 4, y], [x + 4, y], [x + 3, y + 9], [x - 3, y + 9]]), '#f8f8f4', { sh: [1, 0], hi: 0 }); p.box(x - 3, y + 3, 6, 2, '#8a5a3a'); }
    },
    // Every job there's ever been, rolled up
    raymond(p) {
      p.box(0, 0, ART_W, ART_H, '#786858');
      const rolled = (x, y, c) => { fig(p, M(p).ell(x, y, 6), c, { sh: [1, 1], hi: [1, 1] }); arc(p, x, y, 3, 0, 5.5, ramp(c).deep); p.set(x, y, ramp(c).deep); };
      for (let r = 0; r < 7; r++) for (let i = 0; i < 11 - (r % 2); i++) rolled(5 + (r % 2) * 5.5 + i * 11, 70 - r * 10, ['#e8f0f8', '#f4f0dc', '#d8e4f0', '#f8f8f0'][(i * 3 + r) % 4]);
      const cx = 59, cy = 35, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#b83028', hairdo: 'short', mouth: 'grin', clothes: tieOn('#f8e070') });
      fig(p, M(p).line(cx + 12, 68, cx + 42, 40, 7), '#e8f0f8', { sh: [1, 1], hi: 0 });
      arm(p, cx + 26, 76, cx + 28, 56, '#b83028', skin, 9);
    },
    // "I was up all night waiting in line to get Pokemon cards. These lights are keeping me awake!"
    reagan(p) {
      room(p, '#c8c8d4', '#888898', 64);
      for (const x of [14, 59, 104]) {
        flat(p, M(p).poly([[x - 12, 0], [x + 12, 0], [x + 24, 64], [x - 24, 64]]), '#e0e0e8');
        fig(p, M(p).box(x - 12, 0, 24, 3), '#fffff0', { sh: 0, hi: 0 });
      }
      const cx = 44, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#9868c8', hairdo: 'spiky', look: 'tired', brow: 'worried', mouth: 'flat', clothes: tieOn('#f8e070') });
      for (const x of [-8, 7]) p.box(cx + x, cy + 6, 6, 1, '#b08090');
      // the cards, fanned out
      arm(p, cx + 26, 76, 84, 56, '#9868c8', skin, 9);
      for (const [dx, a, c] of [[-14, -6, '#d83838'], [-5, -2, '#3868c8'], [5, 2, '#f0c020'], [14, 6, '#58a848']]) {
        fig(p, M(p).poly([[84 + dx + a, 22], [84 + dx + a + 13, 22 + Math.abs(a) / 2], [84 + dx + 12, 54], [84 + dx - 2, 54 - Math.abs(a) / 2]]), c, { sh: 0, hi: [1, 1] });
        fig(p, M(p).ell(84 + dx + a / 2 + 5, 37, 3), '#f8f8f4', { sh: 0, hi: 0, line: null });
      }
      spark(p, 110, 18, '#ffffff', 3);
    },
    // "Did Mauro say he's more Italian than me? Mama Mia!"
    romano(p) {
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) { const a = (x >> 3) % 2, b = (y >> 3) % 2; p.set(x, y, a && b ? '#c82830' : a || b ? '#e87880' : '#f8f4ec'); }
      loud(p, 'MAMA', 69, 6, '#f8e070', 1); loud(p, 'MIA!', 73, 16, '#f8e070', 2);
      const cx = 40, cy = 35, skin = '#f8d8b8';
      person(p, cx, cy, { skin, hair: '#6a3c20', top: '#f8f8f8', hairdo: 'curly', mouth: 'open', brow: 'raised', look: 'wide', stache: '#6a3c20', clothes: tieOn('#b83028') });
      // the coffee pot, on the stove at home
      fig(p, M(p).poly([[86, 44], [106, 44], [102, 56], [106, 72], [86, 72], [90, 56]]), '#c8d0d8', { sh: [2, 1], hi: [1, 1] });
      fig(p, M(p).poly([[92, 44], [100, 44], [96, 38]]), '#3c3c48', { sh: 0, hi: 0 });
      fig(p, M(p).line(107, 48, 112, 60, 3), '#2c2c34', { sh: 0, hi: 0 });
      flat(p, M(p).poly([[86, 46], [80, 42], [86, 50]]), '#a8b0b8');
      for (const x of [76, 80]) for (let i = 0; i < 6; i++) p.set(x + Math.round(Math.sin(i + x) * 1.5), 38 - i * 2, '#ffffff');
    },
    // Measuring the air, and it's a lot of air
    sharon(p) {
      p.box(0, 0, ART_W, ART_H, '#88a0b8');
      for (const x of [0, 16]) p.box(x, 0, 2, ART_H, '#708098');
      fig(p, M(p).box(-2, 8, 28, 58), '#c0c8d0', { sh: 0, hi: 0 });
      for (let y = 12; y < 62; y += 5) p.box(0, y, 24, 2, '#505860');
      for (let i = 0; i < 10; i++) { const y = 8 + i * 6, x = 28 + (i * 13) % 26; p.box(x, y, 14 + (i * 7) % 10, 1, '#f0f8ff'); }
      p.box(0, 66, ART_W, 9, '#5c6878');
      const cx = 66, cy = 34, skin = '#f8d8b8';
      // the wind gets in her hair
      const hair = M(p).ell(cx + 6, cy - 4, 22, 15);
      for (let i = 0; i < 5; i++) hair.ell(cx + 22 + i * 5, cy - 12 + i * 6, 5 - i * 0.4);
      fig(p, hair, '#5a3420', { sh: [2, 2], hi: 0 });
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#e07898', hairdo: 'sidepart', brow: 'raised', mouth: 'grin', clothes: beads('#f8e070') });
      // the meter, with its little fan
      arm(p, cx - 25, 76, cx - 31, 50, '#e07898', skin, 9);
      fig(p, M(p).rbox(cx - 37, 28, 14, 18, 1), '#f0c020', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(cx - 30, 20, 8), '#3c3c48', { sh: 0, hi: 0 });
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; flat(p, M(p).line(cx - 30, 20, cx - 30 + Math.cos(a) * 6, 20 + Math.sin(a) * 6, 2), '#d0d8e0'); }
      fig(p, M(p).box(cx - 35, 31, 10, 6), '#b0c8a8', { sh: 0, hi: 0 });
    },
    // The design schedule, with Mocha keeping an eye on it
    sidney(p) {
      room(p, '#b8b0c0', '#787080', 62);
      fig(p, M(p).box(46, 4, 69, 44), '#f8f8f4', { sh: 0, hi: 0 });
      for (let x = 58; x < 112; x += 9) p.box(x, 5, 1, 42, '#d8d8e0');
      for (const [x, y, w, c] of [[48, 8, 26, '#3868c8'], [62, 15, 30, '#58a848'], [52, 22, 14, '#d83838'], [70, 22, 26, '#f0b030'], [84, 29, 28, '#9868c8'], [56, 36, 40, '#40a0a0']]) fig(p, M(p).box(x, y, w, 4), c, { sh: 0, hi: 0, line: null });
      flat(p, M(p).box(82, 5, 1, 42), '#d83030');
      const cx = 26, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#9868c8', hairdo: 'sidepart', mouth: 'smile', specs: '#2c2c3c', clothes: tieOn('#2c6a34') });
      fig(p, M(p).box(54, 60, 66, 16), '#7c5438', { sh: 0, hi: [0, 1] });
      pooch(p, 92, 49, { coat: '#8a5a3a', ears: '#5a3420', chest: '#c09068', collar: '#9868c8', small: true }, -1);
    },
    // Haakon Heatwheels, and he's taking this one round the track
    troy(p) {
      p.box(0, 0, ART_W, ART_H, '#384058');
      for (let i = 0; i < 16; i++) p.box(i * 37 % ART_W, i * 19 % 44, 10, 1, '#485070');
      // an orange track, looping
      arc(p, 86, 26, 21, 0, Math.PI * 2, '#f08020'); arc(p, 86, 26, 20, 0, Math.PI * 2, '#f08020'); arc(p, 86, 26, 19, 0, Math.PI * 2, '#f8a040');
      fig(p, M(p).poly([[0, 62], [118, 44], [118, 52], [0, 70]]), '#f08020', { sh: 0, hi: [0, 1] });
      for (let i = 0; i < 3; i++) { const x = 70 - i * 12, y = 48 - i * 1.6; flat(p, M(p).poly([[x + 16, y - 2], [x, y - 8 + i], [x + 4, y], [x, y + 5 - i]]), i ? '#f0c020' : '#e84828'); }
      // the wheel
      fig(p, M(p).ell(88, 35, 13), '#7c8088', { sh: [2, 1], hi: [1, 1] });
      flat(p, M(p).ell(88, 35, 10), '#c89060');
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.4; flat(p, M(p).line(88, 35, 88 + Math.cos(a) * 10, 35 + Math.sin(a) * 10, 1), '#584c4c'); }
      fig(p, M(p).ell(88, 35, 2), '#2c2c3c', { sh: 0, hi: 0, line: null });
      const cx = 28, cy = 34, skin = '#f8d0a8';
      person(p, cx, cy, { skin, hair: '#201818', top: '#58a848', hairdo: 'spiky', mouth: 'grin', brow: 'raised', clothes: tieOn('#283878') });
    },
    // Cashew, and the frisbee, and nobody's getting any work done
    walker(p) {
      room(p, '#a8b8c4', '#70808c', 60);
      const cx = 30, cy = 33, skin = '#c08860';
      person(p, cx, cy, { skin, hair: '#d06030', top: '#40a0a0', hairdo: 'short', mouth: 'grin', brow: 'raised', clothes: tieOn('#d03868') });
      arm(p, cx + 26, 76, cx + 30, 24, '#40a0a0', skin, 9);
      fig(p, M(p).ell(104, 13, 10, 3), '#e83828', { sh: [0, 1], hi: [0, 1] });
      for (const [x, y] of [[70, 20], [78, 18], [86, 16]]) p.box(x, y, 4, 1, '#ffffff');
      // and up she goes
      fig(p, M(p).ell(84, 46, 15, 7), '#e0a050', { sh: [2, 1], hi: [1, 1] });
      fig(p, M(p).line(71, 50, 62, 56, 3), '#e0a050', { sh: 0, hi: 0 });
      fig(p, M(p).line(76, 50, 72, 60, 4).line(92, 50, 96, 60, 4), '#e0a050', { sh: 0, hi: 0 });
      fig(p, M(p).ell(98, 35, 9, 8), '#e0a050', { sh: [1, 1], hi: [1, 1] });
      fig(p, M(p).ell(103, 38, 5, 4), '#f0c880', { sh: 0, hi: 0 });
      fig(p, M(p).ell(91, 36, 4, 7), '#b87830', { sh: 0, hi: 0 });
      p.set(99, 32, LINE); p.box(106, 35, 2, 2, LINE); p.box(101, 41, 6, 1, '#d83858');
      p.box(90, 42, 8, 1, '#b83028');
    },
    // Looking at the mountains, through the job she's got on
    yeunie(p) {
      BACKS.office(p);
      flat(p, M(p).box(70, 6, 46, 36), '#c8e4f4');
      flat(p, M(p).poly([[70, 42], [84, 20], [94, 30], [104, 14], [116, 28], [116, 42]]), '#7898b0');
      flat(p, M(p).poly([[104, 14], [100, 19], [104, 18], [108, 20]]), '#f4f8fc');
      p.box(70, 6, 46, 1, '#f4f6f8'); p.box(92, 6, 1, 36, '#e8e8e8');
      const cx = 46, cy = 34, skin = '#f0c098';
      person(p, cx, cy, { skin, hair: '#5a3420', top: '#3868c8', hairdo: 'bob', mouth: 'grin', clothes: beads('#f8f8f8') });
      // the rolled-up drawing, as a telescope
      arm(p, cx + 26, 76, cx + 22, 44, '#3868c8', skin, 9);
      fig(p, M(p).poly([[cx + 2, 34], [cx + 42, 22], [cx + 44, 33], [cx + 4, 44]]), '#e8f0f8', { sh: [1, 2], hi: [1, 1] });
      for (const t of [14, 28]) flat(p, M(p).line(cx + 2 + t, 34 - t * 0.3, cx + 4 + t, 44 - t * 0.3, 1), '#88a8d0');
      fig(p, M(p).ell(cx + 43, 28, 2, 6), '#88a8d0', { sh: 0, hi: 0 });
    },
    // "I'm on a 5 spring roll winning streak. I've never felt so alive!"
    zin(p) {
      p.box(0, 0, ART_W, ART_H, '#285878');
      rays(p, 59, 40, 22, '#306888', 0.15, 0, ART_H);
      for (let i = 0; i < 26; i++) p.box(i * 43 % ART_W, i * 31 % 60, 2, 2, ['#f0c020', '#d83838', '#58c848', '#f8f8f8', '#e878b8'][i % 5]);
      const cx = 59, cy = 34, skin = '#d8a070';
      person(p, cx, cy, { skin, hair: '#a8a8b0', top: '#78a8e8', hairdo: 'short', mouth: 'grin', look: 'shut', brow: 'raised', clothes: tieOn('#f8f8f8') });
      arm(p, cx - 26, 76, cx - 36, 18, '#78a8e8', skin, 9);
      arm(p, cx + 26, 76, cx + 36, 18, '#78a8e8', skin, 9);
      for (const x of [cx - 40, cx + 40]) { roll(p, x, 10, -0.3, 13); }
      for (const [x, y] of [[10, 66], [24, 66], [17, 59]]) roll(p, x, y, 0, 11);
      loud(p, '5', 53, -1, '#f8e070', 2);
    },
  });

  // A card with no painting of its own: a person in their colours from the game in front of their
  // department's background, or for a thing, a plain picture of its first letter. A test says when a
  // card's still using this, since then it looks like all the others. It's what keeps every
  // card playable: anything added to ART above takes over from this.
  const WEARS = ['#3868c8', '#b83028', '#58a848', '#e07898', '#808898', '#38a0a0', '#c87830'];
  const SKINS = ['#f8d8b8', '#f8d0a8', '#d8a070', '#c08860', '#8a5838'];
  const HAIRS = ['#201818', '#5a3420', '#8a5a3a', '#6a3c20', '#b87830'];
  const hashOf = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  function whoOf(card) {
    const people = window.PEOPLE || {}, crew = Object.values(window.PLANT_CREW || {}), out = Object.values(window.VISITORS || {});
    return (Object.prototype.hasOwnProperty.call(people, card.name) ? people[card.name] : null) || crew.find((c) => c.name === card.name) || out.find((c) => c.name === card.name) || null;
  }
  const NOT_PEOPLE = ['bigcoil', 'crane', 'truck', 'printer', 'coffeemachine', 'humbug', 'legobrick', 'leftovers', 'springroll', 'demounit', 'roofcurb', 'heatwheel', 'airhandler'];
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
    mauro: [62, 37], patrick: [59, 37], tho: [62, 37], wade: [56, 37], ali: [40, 37], ryan: [59, 37], garrett: [42, 37], desirae: [64, 37], roadtrip: [60, 37], truck: [62, 37],
    davisson: [59, 37], leo: [38, 37], jhonna: [46, 37], stephen: [64, 37], tainah: [72, 37], nathan: [64, 37], paperjam: [59, 37], budget: [59, 37], reorg: [59, 37], printer: [59, 37],
    matthew: [70, 37], kiki: [50, 37], jenn: [46, 37], joe: [59, 37], chris: [62, 37], lam: [56, 37], nik: [52, 37], potluck: [59, 37], pizza: [66, 37],
    coffeemachine: [59, 37], humbug: [59, 37], linda: [59, 37], doubleshot: [59, 37], legobrick: [59, 37], leftovers: [59, 37],
    coop: [62, 37], temp: [52, 37], newhire: [52, 37], receptionist: [50, 37], courier: [52, 37], apprentice: [64, 37], assembler: [52, 37], bookkeeper: [46, 37], safety: [60, 37], salesrep: [50, 37], foreman: [59, 37], estimator: [40, 37], maintenance: [68, 37], nightshift: [50, 37], driver: [59, 37], closer: [59, 37], coffeerun: [59, 37], angryemail: [64, 37], longlunch: [59, 37],
    markv: [59, 37], steve: [50, 37], justin: [62, 37], graham: [76, 37], brian: [42, 37], jillian: [42, 37], kylebullock: [59, 37], miked: [62, 37], bigcoil: [59, 37], crane: [59, 37],
    alex: [50, 37], courtney: [50, 37], amelia: [62, 37], fleur: [50, 37], ashley: [58, 37], samantha: [62, 37], william: [50, 37], cedric: [72, 37], stephanie: [42, 37], josh: [64, 37], johnk: [64, 37], markl: [60, 37], mikeb: [50, 37], scott: [60, 37], caleb: [64, 37], nick: [50, 37], jay: [50, 37],
    howard: [50, 37], mikeh: [60, 37], jp: [50, 37], mikefriesen: [60, 37], coldcall: [59, 37], clientlunch: [59, 37], tradeshow: [59, 37], bigorder: [59, 37], demounit: [59, 37],
    alyssa: [68, 37], rob: [50, 37], warren: [50, 37], bob: [59, 37], leon: [72, 37], kim: [62, 37], john: [66, 37], mayaj: [60, 37], diane: [76, 37], expense: [59, 37], allhands: [59, 37],
    avery: [60, 37], carlos: [50, 37], charles: [50, 37], cody: [50, 37], dalia: [68, 37], damir: [59, 37], daphne: [59, 37], dave: [50, 37], derek: [59, 37], eric: [52, 37], eugene: [58, 37], gigi: [57, 37], hudson: [70, 37], james: [64, 37], jimmy: [44, 37], jonathan: [50, 37], jordan: [50, 37], jules: [60, 37], kyle: [50, 37], lauren: [60, 37], lia: [50, 37], marcus: [50, 37], mayaw: [50, 37], michaeltam: [50, 37], muhammad: [50, 37], nicholas: [50, 37], raymond: [64, 37], reagan: [64, 37], romano: [50, 37], sharon: [60, 37], sidney: [50, 37], troy: [50, 37], walker: [60, 37], yeunie: [60, 37], zin: [59, 37],
    sneakycoke: [64, 37], morningpaper: [50, 37], dumbbells: [59, 37], candyjar: [59, 37], granfondo: [60, 37], xmasparty: [40, 37], firstaid: [59, 37], roofcurb: [59, 37], revisiond: [59, 37], heatwheel: [59, 37], airhandler: [70, 37], springroll: [59, 37],
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
    sales: { name: 'SALES', c: '#c84038' },
    office: { name: 'OFFICE', c: '#3868c8' },
    engineering: { name: 'ENGINEERING', c: '#48a048' },
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
  // The back of a card: a cup on navy, in gold. Whoever has won every card gets theirs the other way
  // round, a navy cup on gold.
  const BACK_COLS = {
    navy: { edge: '#2c3468', frame: GOLD, field: '#20264c', dot: '#343c74', cup: GOLD },
    gold: { edge: '#c8941c', frame: '#fff4c0', field: '#e0a828', dot: '#f0c450', cup: '#20264c' },
  };
  const backPics = {};
  function back(gold) {
    const key = gold ? 'gold' : 'navy', k = BACK_COLS[key];
    if (backPics[key]) return backPics[key];
    const half = Pic(44, 58), m = () => Mask(44, 58);
    fig(half, m().rbox(1, 1, 42, 56, 4), k.edge, { sh: [2, 2], hi: [1, 1] });
    flat(half, m().rbox(4, 4, 36, 50, 3), k.frame);
    flat(half, m().rbox(5, 5, 34, 48, 2), k.field);
    for (let y = 6; y < 52; y += 4) for (let x = 6 + (y % 8 ? 2 : 0); x < 38; x += 4) half.set(x, y, k.dot);
    fig(half, m().ell(26, 29, 4).ell(26, 29, 2, 2, 0), k.cup, { sh: 0, hi: 0 });
    fig(half, m().ell(21, 29, 9), k.cup, { sh: [2, 2], hi: [1, 1] });
    flat(half, m().ell(21, 29, 6), '#6a3c20');
    flat(half, m().ell(20, 28, 4), '#8a5430');
    backPics[key] = Pic(88, 116);
    backPics[key].put(half, 0, 0, 2);
    return backPics[key];
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
  const LIVE = { forklift: { frames: 16, every: 3 }, officedog: { frames: 16, every: 5 }, truck: { frames: 16, every: 3 }, printer: { frames: 16, every: 4 }, humbug: { frames: 16, every: 4 }, linda: { frames: 16, every: 5 }, airhandler: { frames: 16, every: 2 } };
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

  // (painted: whether a card has a picture of its own, rather than the stand-in)
  return { ART_W, ART_H, LIVE, Pic, big, small, back, artPic, artFrame, cropOf, label, toCanvas, canvasOf, shine, RARITY, DEPTS, painted: (id) => Object.prototype.hasOwnProperty.call(ART, id) };
})();
