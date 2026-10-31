// High-detail art: the parts of the game drawn in a smoother style than the office's
// 16x16 tiles (so far, the parking lot that opens up at Christmas): a rough, cel-shaded
// cartoon look, with thick black outlines, flat colour and a hard shadow and highlight
// on everything. It goes on its own canvas, K times the size of the game screen, which
// sits under the pixel one (see "the parking lot" in js/game.js). Everything here is
// measured in game pixels and scaled up by K, so 1 is one office pixel and a tile is
// still 16.
window.HD = (function () {
  const K = 4;
  const TAU = Math.PI * 2;

  // ---------- colours and shapes ----------
  const OUT = '#16121c'; // outline
  const OL = 1; // outline width
  function hexRGB(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  function mix(a, b, t) {
    const x = hexRGB(a), y = hexRGB(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  // flat colour, its hard shadow (cooler and darker) and its hard highlight
  const tone = (f) => ({ f, s: mix(f, '#2a2050', 0.4), h: mix(f, '#fff6e0', 0.32) });
  const flat = (f) => ({ f, s: f, h: f });
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
  // A shape: flat fill, anything painted on it (`inside`, clipped to it), its hard
  // shadow and highlight, then the outline.
  function part(c, t, path, shadow, hi, inside) {
    c.beginPath(); path(c); c.fillStyle = t.f; c.fill();
    if (shadow || hi || inside) {
      c.save(); c.beginPath(); path(c); c.clip();
      if (inside) inside(c);
      if (shadow) { c.fillStyle = t.s; c.globalAlpha = inside ? 0.55 : 1; c.beginPath(); shadow(c); c.fill(); c.globalAlpha = 1; }
      if (hi) { c.fillStyle = t.h; c.beginPath(); hi(c); c.fill(); }
      c.restore();
    }
    c.beginPath(); path(c); c.strokeStyle = OUT; c.lineWidth = OL; c.stroke();
  }
  // an arm or leg through a few points: outline, shadow, the lit side and a glint of
  // highlight, with an optional dashed pattern down it (a striped shirt's stripes)
  function limb(c, pts, w, t, dash) {
    const line = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); };
    line(); c.strokeStyle = OUT; c.lineWidth = w + OL * 2; c.stroke();
    c.strokeStyle = t.s; c.lineWidth = w; c.stroke();
    c.save(); c.translate(-w * 0.2, -w * 0.05); line(); c.strokeStyle = t.f; c.lineWidth = w * 0.55; c.stroke(); c.restore();
    if (dash) {
      c.setLineDash(dash.on); c.lineCap = 'butt'; line(); c.strokeStyle = dash.col; c.globalAlpha = dash.a; c.lineWidth = w; c.stroke();
      c.globalAlpha = 1; c.setLineDash([]); c.lineCap = 'round';
    }
    c.save(); c.translate(-w * 0.34, -w * 0.08); line(); c.strokeStyle = t.h; c.lineWidth = w * 0.14; c.lineCap = 'butt'; c.stroke(); c.restore();
  }
  // a cluster of round tufts outlined as one shape (snow, curls, a pompom)
  function tufts(c, pts, t, r) {
    c.fillStyle = OUT; for (const [x, y, r2] of pts) { ell(c, x, y, (r2 || r) + OL / 2, (r2 || r) + OL / 2); c.fill(); }
    c.fillStyle = t.f; for (const [x, y, r2] of pts) { ell(c, x, y, r2 || r, r2 || r); c.fill(); }
    c.fillStyle = t.s; for (const [x, y, r2] of pts) { ell(c, x + (r2 || r) * 0.35, y + (r2 || r) * 0.3, (r2 || r) * 0.55, (r2 || r) * 0.5); c.fill(); }
  }
  // a maple leaf, about 2r across
  function leaf(c, x, y, r, col) {
    const pts = [[0, -1], [0.18, -0.62], [0.42, -0.72], [0.36, -0.3], [0.78, -0.48], [0.68, -0.16], [0.9, -0.08], [0.5, 0.26], [0.56, 0.44],
      [0.08, 0.36], [0.08, 0.8], [-0.08, 0.8], [-0.08, 0.36], [-0.56, 0.44], [-0.5, 0.26], [-0.9, -0.08], [-0.68, -0.16], [-0.78, -0.48],
      [-0.36, -0.3], [-0.42, -0.72], [-0.18, -0.62]];
    poly(c, pts.map(([px, py]) => [x + px * r, y + py * r]));
    c.fillStyle = col; c.fill();
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // a canvas measured in game pixels
  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * K); cv.height = Math.ceil(h * K);
    const c = cv.getContext('2d');
    c.scale(K, K); c.lineJoin = 'round'; c.lineCap = 'round';
    return [cv, c];
  }
  // a soft round glow, drawn once per colour and stamped wherever it's needed
  const glows = {};
  function glow(col) {
    if (glows[col]) return glows[col];
    const [cv, c] = makeCanvas(32, 32), [r, g, b] = hexRGB(col);
    const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`); grad.addColorStop(0.25, `rgba(${r},${g},${b},0.45)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grad; c.fillRect(0, 0, 32, 32);
    return (glows[col] = cv);
  }
  function stampGlow(c, col, x, y, r, a) {
    c.globalAlpha = a; c.drawImage(glow(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  }

  // ---------- people ----------
  // Anyone can be drawn from the colours the rest of the game already has for them
  // (js/people.js), in the clothes the character editor has (js/art.js), which `style`
  // names: their hair, a head thing (a hat, or something worn with the hair showing), a
  // shirt (the outfit) and pants (the legs). A player's style is just what they made in
  // the editor. A coworker dresses as they do in the office, short hair with a shirt and
  // tie or long hair with a blouse and a necklace (the accent colour) over trousers,
  // unless their own `style` says otherwise (see js/people.js). Shoes and bare hands, and
  // everyone is the same size.
  const HAIRS = ['short', 'long', 'buzz', 'spiky', 'curly', 'bob', 'ponytail', 'bun', 'bald'];
  const SHIRTS = ['tie', 'blouse', 'tee', 'stripes', 'hoodie', 'suit', 'sweater', 'hivis'];
  const LEGS = ['trousers', 'shorts', 'skirt', 'overalls'];
  const HATS = ['cap', 'toque', 'hardhat', 'cowboy', 'crown'], WORN = ['glasses', 'shades', 'headphones', 'bow'];
  // the head things' colours, as the editor draws them
  const HAT_COLOURS = { cap: '#c03a30', toque: '#58a848', hardhat: '#f0b030', cowboy: '#9a6434', crown: '#f0b030', headphones: '#8890a0', bow: '#d23a40' };
  const HIVIS = '#f6a524';
  function person(name, body, look, style) {
    const h = hash(name || '?'), st = style || {}, female = body === 'female';
    const pick = (list, v, office) => (list.includes(v) ? v : office);
    const outfit = pick(SHIRTS, st.shirt, female ? 'blouse' : 'tie');
    // (a hi-vis vest is the coat, over a shirt that shows at the neck and down the arms)
    const coat = outfit === 'hivis' ? HIVIS : look.w;
    return {
      female, hair: pick(HAIRS, st.hair, female ? 'long' : 'short'), hat: pick(HATS, st.hat, 'none'), wear: pick(WORN, st.hat, ''),
      outfit, legs: pick(LEGS, st.pants, 'trousers'), seed: (h % 1000) / 37,
      skin: tone(look.s), hairC: tone(look.h), coat: tone(coat), arms: tone(outfit === 'hivis' ? look.w : coat), acc: tone(look.u),
      hatC: tone(HAT_COLOURS[st.hat] || look.u), pants: tone(look.K),
      boot: tone('#3c3440'), sole: tone('#1e1a22'), skate: tone('#2a2a34'), blade: tone('#cfd6e2'), pomT: tone('#f0ece4'),
      brow: mix(look.h, OUT, 0.5),
    };
  }

  // ---------- heads ----------
  const headFront = (c, p) => {
    const chin = p.female ? 1.6 : 2.7;
    c.beginPath();
    c.moveTo(-4.5, -35);
    c.bezierCurveTo(-4.7, -41.6, 4.7, -41.6, 4.5, -35);
    c.lineTo(4.4, -32.4);
    c.quadraticCurveTo(p.female ? 3.6 : 4.3, -29.4, chin, -29);
    c.lineTo(-chin, -29);
    c.quadraticCurveTo(p.female ? -3.6 : -4.3, -29.4, -4.4, -32.4);
    c.closePath();
  };
  const headSide = (c, p) => {
    c.beginPath();
    c.moveTo(3.4, -30.4);
    c.quadraticCurveTo(5.1, -33, 4.6, -36.6);
    c.bezierCurveTo(3.8, -41.8, -3.6, -42, -4.3, -37.2);
    c.lineTo(-4.6, -35.4); c.lineTo(-6, -33.1); c.lineTo(-4.8, -32.6); c.lineTo(-4.7, -31.6);
    c.quadraticCurveTo(-4.5, -29.2, p.female ? -2.8 : -2.2, -29);
    c.lineTo(1.4, -29.1);
    c.quadraticCurveTo(2.6, -29.3, 3.4, -30.4);
    c.closePath();
  };
  const faceShadow = (cc) => { cc.moveTo(1.9, -44); cc.lineTo(8, -44); cc.lineTo(8, -26); cc.lineTo(0.9, -26); cc.quadraticCurveTo(2.4, -31, 1.9, -44); };
  const faceLight = (cc) => { ell(cc, -2.6, -38.4, 1.6, 0.8, -0.3); };
  function face(c, p, k) {
    for (const s of [-1, 1]) {
      const ex = s * 1.95, ey = -34.3;
      if (k.blink) { c.strokeStyle = OUT; c.lineWidth = 0.6; c.beginPath(); c.moveTo(ex - 1.2, ey); c.lineTo(ex + 1.2, ey); c.stroke(); }
      else {
        // narrowed eyes: a heavy upper lid across the white
        ell(c, ex, ey, 1.2, 0.85); c.fillStyle = '#f6f2ea'; c.fill();
        c.fillStyle = OUT; ell(c, ex + 0.15, ey + 0.1, 0.55, 0.62); c.fill();
        c.beginPath(); c.moveTo(ex - 1.4, ey - 0.05); c.quadraticCurveTo(ex, ey - 1.1, ex + 1.4, ey - 0.25); c.lineTo(ex + 1.3, ey - 0.6);
        c.quadraticCurveTo(ex, ey - 1.5, ex - 1.4, ey - 0.4); c.fill();
        if (p.female) { c.strokeStyle = OUT; c.lineWidth = 0.55; c.beginPath(); c.moveTo(ex + s * 1.2, ey - 0.5); c.lineTo(ex + s * 1.9, ey - 1); c.stroke(); }
      }
      c.strokeStyle = p.skin.s; c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(ex - 0.9, ey + 1.1); c.quadraticCurveTo(ex, ey + 1.5, ex + 0.9, ey + 1.1); c.stroke();
      c.strokeStyle = p.brow; c.lineWidth = p.female ? 0.7 : 1.3;
      c.beginPath(); c.moveTo(s * 0.6, -35.5); c.lineTo(s * 1.9, -36.2); c.lineTo(s * 3.3, -36.1); c.stroke();
      c.fillStyle = 'rgba(214, 70, 60, 0.3)'; ell(c, s * 3, -32.3, 1.2, 0.7); c.fill();
    }
    c.fillStyle = 'rgba(214, 70, 60, 0.3)'; ell(c, 0.2, -32.4, 0.9, 0.6); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(0.4, -34.6); c.quadraticCurveTo(1.4, -32.6, 0.9, -32.1); c.quadraticCurveTo(0.2, -31.8, -0.6, -32.2); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-1.3, -30.6); c.quadraticCurveTo(0, -30.9, 1.4, -31.1); c.stroke();
    if (p.female) { c.strokeStyle = '#a84850'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(-0.7, -30.1); c.lineTo(0.8, -30.2); c.stroke(); }
  }
  function faceSide(c, p, k) {
    const ex = -2.9, ey = -34.4;
    if (k.blink) { c.strokeStyle = OUT; c.lineWidth = 0.6; c.beginPath(); c.moveTo(ex - 0.9, ey); c.lineTo(ex + 0.8, ey); c.stroke(); }
    else {
      ell(c, ex, ey, 0.85, 0.85); c.fillStyle = '#f6f2ea'; c.fill();
      c.fillStyle = OUT; ell(c, ex - 0.35, ey + 0.08, 0.42, 0.6); c.fill();
      c.beginPath(); c.moveTo(ex - 1, ey - 0.15); c.quadraticCurveTo(ex, ey - 1, ex + 0.9, ey - 0.3); c.lineTo(ex + 0.9, ey - 0.7);
      c.quadraticCurveTo(ex, ey - 1.4, ex - 1, ey - 0.5); c.fill();
    }
    c.strokeStyle = p.brow; c.lineWidth = p.female ? 0.7 : 1.3;
    c.beginPath(); c.moveTo(-4.3, -35.7); c.lineTo(-2.6, -36.2); c.lineTo(-1.4, -36.1); c.stroke();
    c.fillStyle = 'rgba(214, 70, 60, 0.3)'; ell(c, -2.2, -32.4, 1.1, 0.7); c.fill(); ell(c, -5.3, -33.2, 0.6, 0.5); c.fill();
    part(c, p.skin, (cc) => ell(cc, 1.1, -33.6, 1.1, 1.6), (cc) => cc.rect(1.4, -36, 3, 5));
    c.strokeStyle = OUT; c.lineWidth = 0.4; c.beginPath(); c.arc(1.2, -33.6, 0.6, -1.4, 1.4); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-4.7, -30.9); c.lineTo(-3.4, -31.1); c.stroke();
  }

  // ---------- hair ----------
  function strays(c, p, pts) {
    for (const [x, y, a, l] of pts) {
      c.beginPath(); c.moveTo(x - 0.7, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.lineTo(x + 0.7, y + 0.3); c.closePath();
      c.fillStyle = p.hairC.f; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.6; c.stroke();
    }
  }
  // a ragged edge along the bottom of a hank of hair, from x0 to x1
  const ragged = (x0, x1, y, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y + (i & 1 ? -1.2 : 0.4)]);
    return pts;
  };
  // how far down the back long hair hangs
  const HAIR_ENDS = { long: -21.5, bob: -28.8 };
  // what hangs down behind the head, drawn before the body
  function hairBehind(c, p, view) {
    const t = p.hairC, side = view === 'side';
    const end = HAIR_ENDS[p.hair];
    if (end) {
      part(c, t, (cc) => {
        if (side) poly(cc, [[-0.5, -38], [4.8, -36], [5.8, end + 4]].concat(ragged(5.2, 0.6, end, 4)));
        else poly(cc, [[-5, -37], [5, -37], [6.4, end + 4]].concat(ragged(6.2, -6.2, end, 8), [[-6.4, end + 4]]));
      }, (cc) => cc.rect(side ? 2.6 : 2.2, -45, 10, 30));
    }
    if (p.hair === 'ponytail' && view !== 'back')
      part(c, t, (cc) => ell(cc, side ? 6.2 : 5.4, -34.5, 1.9, 4.8, side ? -0.5 : -0.25), (cc) => cc.rect(5.6, -45, 6, 20));
    if (p.hair === 'bun' && view !== 'back') {
      part(c, t, (cc) => ell(cc, side ? 3.2 : 0, -41.6, 2.5, 2.2), (cc) => cc.rect(1, -45, 6, 6));
      strays(c, p, [[side ? 2 : -1.4, -43, -2.2, 1.6], [side ? 4.6 : 1.8, -42.8, -0.8, 1.4]]);
    }
  }
  const capShadow = (cc) => cc.rect(1.6, -46, 8, 16);
  const capLight = (cc) => ell(cc, -2.2, -40, 1.8, 0.7, -0.3);
  const FRINGE = [[3, -37.2], [2.2, -36.2], [1, -37.4], [-0.2, -36.4], [-1.4, -37.4], [-2.6, -36.4], [-3.6, -37.2], [-4.3, -36.4]];
  const SPIKES = [[-5.6, -38], [-4.8, -40.4], [-3.6, -43.4], [-2.2, -41.4], [-0.6, -45], [0.8, -41.8], [2.6, -44.2], [3.2, -41], [5.4, -41.6], [4.9, -38.6]];
  function hairFront(c, p) {
    const t = p.hairC, hidden = p.hat !== 'none';
    const cap = (fringe, spiky) => part(c, t, (cc) => {
      cc.beginPath(); cc.moveTo(-4.8, -33.4);
      if (spiky) SPIKES.forEach(([x, y]) => cc.lineTo(x, y));
      else cc.bezierCurveTo(-5.6, -42.8, 5.6, -42.8, 4.8, -33.4);
      cc.lineTo(4.8, -33.4); cc.lineTo(4.3, -36.6);
      fringe.forEach(([x, y]) => cc.lineTo(x, y));
      cc.closePath();
    }, capShadow, capLight);
    switch (p.hair) {
      case 'short': cap(FRINGE); break;
      case 'spiky': cap(FRINGE, !hidden); break;
      case 'buzz': // cropped close, with a straight hairline
        part(c, t, (cc) => {
          cc.beginPath(); cc.moveTo(-4.7, -34.6);
          cc.bezierCurveTo(-5.1, -42, 5.1, -42, 4.7, -34.6);
          cc.lineTo(4.3, -36.8); cc.quadraticCurveTo(0, -38.2, -4.3, -36.8);
          cc.closePath();
        }, capShadow, capLight);
        break;
      case 'bald':
        // the horseshoe that's left, round the sides
        for (const s of [-1, 1]) part(c, t, (cc) => poly(cc, [[s * 4.3, -37.4], [s * 5.1, -36.6], [s * 5, -33.4], [s * 4.4, -32.8], [s * 4.3, -35]]));
        if (!hidden) { c.fillStyle = 'rgba(255, 255, 255, 0.55)'; ell(c, -1.6, -39.8, 1.6, 0.8, -0.3); c.fill(); }
        break;
      case 'curly': {
        const pts = [[-4.6, -35.4], [-4.9, -38], [-3.4, -40.4], [-1, -41.4], [1.4, -41.4], [3.6, -40.2], [4.9, -38], [4.6, -35.4]]
          .concat(hidden ? [] : [[-2.2, -37.6], [0.2, -38.4], [2.4, -37.6]]);
        tufts(c, pts, t, 2.1);
        break;
      }
      case 'long': case 'bob':
        part(c, t, (cc) => {
          cc.beginPath(); cc.moveTo(-5.1, -31.4);
          cc.bezierCurveTo(-6.2, -43, 6.2, -43, 5.1, -31.4);
          cc.lineTo(4.2, -32.6); cc.lineTo(4.4, -34.6); cc.lineTo(3.4, -35.4); cc.quadraticCurveTo(2.4, -37.4, 0.2, -37.8);
          cc.lineTo(-1.2, -36.6); cc.quadraticCurveTo(-4, -36.8, -4.2, -33.6); cc.lineTo(-4.4, -32.4);
          cc.closePath();
        }, capShadow, capLight);
        if (!hidden) strays(c, p, [[-5, -36.4, -2.9, 1.3], [5, -36.4, -0.25, 1.3]]);
        break;
      case 'ponytail': case 'bun':
        part(c, t, (cc) => {
          cc.beginPath(); cc.moveTo(-4.75, -33.8);
          cc.bezierCurveTo(-5.4, -42.6, 5.4, -42.6, 4.75, -33.8);
          cc.lineTo(4.3, -36); cc.quadraticCurveTo(2, -38.4, -0.4, -37.4); cc.quadraticCurveTo(-3.6, -37.6, -4.3, -36);
          cc.closePath();
        }, capShadow, capLight);
        strays(c, p, [[-4.3, -35.4, 1.9, 1.8], [4.3, -35.4, 1.3, 1.8]]);
        break;
    }
    if (hidden && !['curly', 'bald', 'buzz'].includes(p.hair)) strays(c, p, [[-4.6, -36.4, 2.2, 1.6], [4.6, -36.4, 0.9, 1.6], [-4.9, -35.2, 2.6, 1.3]]);
  }
  function hairBack(c, p) {
    const t = p.hairC;
    if (p.hair === 'curly') {
      tufts(c, [[-4.6, -35.4], [-4.9, -38], [-3.4, -40.4], [-1, -41.4], [1.4, -41.4], [3.6, -40.2], [4.9, -38], [4.6, -35.4], [-3, -32.4], [0, -32], [3, -32.4], [-2, -37], [1.6, -37]], t, 2.3);
      return;
    }
    if (p.hair === 'bald') {
      ell(c, 0, -35.4, 4.8, 5.6); c.fillStyle = p.skin.f; c.fill(); c.strokeStyle = OUT; c.lineWidth = OL; c.stroke();
      part(c, t, (cc) => poly(cc, [[-5, -37.2], [-2, -35.6], [2, -35.6], [5, -37.2], [5, -33], [3, -31.2], [0, -30.6], [-3, -31.2], [-5, -33]]), (cc) => cc.rect(1.8, -40, 6, 12));
      return;
    }
    const end = HAIR_ENDS[p.hair] || -31;
    part(c, t, (cc) => {
      cc.beginPath(); cc.moveTo(-4.8, -33);
      if (p.hair === 'spiky' && p.hat === 'none') SPIKES.forEach(([x, y]) => cc.lineTo(x, y));
      else cc.bezierCurveTo(-5.4, -42.6, 5.4, -42.6, 4.8, -33);
      cc.lineTo(4.8, -33);
      const w = end < -30 ? 4.2 : 6;
      if (end > -30) cc.quadraticCurveTo(w + 0.6, end + 5, w, end + 0.6);
      ragged(w, -w, end, end < -30 ? 8 : 10).forEach(([x, y]) => cc.lineTo(x, y));
      if (end > -30) cc.quadraticCurveTo(-w - 0.6, end + 5, -4.8, -33);
      cc.closePath();
    }, (cc) => cc.rect(1.8, -46, 8, 30), capLight);
    if (p.hair === 'ponytail') {
      part(c, t, (cc) => rr(cc, -1.7, -36, 3.4, 10.4, 1.7), (cc) => cc.rect(0.6, -40, 4, 20));
      part(c, p.acc, (cc) => rr(cc, -1.8, -36.4, 3.6, 1.2, 0.5));
    }
    if (p.hair === 'bun') part(c, t, (cc) => ell(cc, 0, -41.4, 2.5, 2.2), (cc) => cc.rect(0.8, -45, 6, 6));
  }
  function hairSide(c, p) {
    const t = p.hairC, hidden = p.hat !== 'none';
    if (p.hair === 'curly') {
      tufts(c, [[-3.8, -38.4], [-1.8, -40.8], [0.8, -41.4], [3.2, -40.2], [4.6, -37.4], [4.4, -34.2], [3, -31.6]].concat(hidden ? [] : [[1.8, -37.6], [-0.6, -38.6]]), t, 2.1);
      return;
    }
    if (p.hair === 'bald') {
      part(c, t, (cc) => poly(cc, [[4.6, -37.4], [5.2, -33.6], [3.6, -30.8], [2.4, -32], [2.6, -35.4], [0.4, -36.6], [2.6, -37.2]]), (cc) => cc.rect(3.6, -40, 4, 12));
      if (!hidden) { c.fillStyle = 'rgba(255, 255, 255, 0.55)'; ell(c, -1.4, -40, 1.6, 0.7, -0.2); c.fill(); }
      return;
    }
    const long = p.hair === 'long' || p.hair === 'bob';
    part(c, t, (cc) => {
      cc.beginPath(); cc.moveTo(-4.6, -36.4);
      if (p.hair === 'spiky' && !hidden) [[-5.6, -39.4], [-3.6, -40.4], [-3.2, -43.8], [-1, -41.8], [0.6, -45], [1.8, -41.6], [4, -43.4], [4, -40.4], [6.2, -39.6]].forEach(([x, y]) => cc.lineTo(x, y));
      else cc.bezierCurveTo(-4.6, -42.6, 5, -43, 5, -36.4);
      cc.quadraticCurveTo(5.6, long ? -31 : -32.6, 3.6, long ? -29.6 : -31);
      cc.lineTo(3, long ? -30.6 : -31.6); cc.lineTo(2.2, long ? -30 : -32.2);
      cc.quadraticCurveTo(2.6, -35.6, 1.4, -36.6);
      if (p.hair === 'buzz') cc.quadraticCurveTo(-1.6, -37.8, -4.6, -37.2);
      else { cc.lineTo(-0.4, -37); cc.lineTo(-1.4, -36.4); cc.lineTo(-2.4, -37.4); cc.lineTo(-3.6, -36.8); }
      cc.closePath();
    }, (cc) => cc.rect(1.4, -46, 8, 20), (cc) => ell(cc, -1.6, -40.4, 1.6, 0.6, -0.2));
    if (!hidden && !['spiky', 'buzz'].includes(p.hair)) strays(c, p, [[4.8, -38.4, -0.3, 1.5]]);
    if (hidden && p.hair !== 'buzz') strays(c, p, [[4.2, -35.4, 0.9, 1.7], [3.4, -34.8, 1.6, 1.3]]);
  }

  // ---------- hats ----------
  function hat(c, p, view) {
    const side = view === 'side', dx = side ? 0.5 : 0;
    if (p.hat === 'toque') {
      // a knitted toque with a pompom
      const wool = p.hatC;
      part(c, wool, (cc) => {
        cc.beginPath(); cc.moveTo(-5 + dx, -37.4);
        cc.bezierCurveTo(-5.2 + dx, -44.6, 5.2 + dx, -44.8, 5 + dx, -37.4);
        cc.closePath();
      }, (cc) => cc.rect(1.6 + dx, -46, 8, 10), (cc) => ell(cc, -2 + dx, -42.4, 1.6, 0.7, -0.4), (cc) => {
        cc.strokeStyle = wool.s; cc.lineWidth = 0.55; // knitted ribs
        for (const x of [-3, -1, 1, 3]) { cc.beginPath(); cc.moveTo(x + dx, -38); cc.quadraticCurveTo(x * 0.85 + dx, -41.4, x * 0.45 + dx, -43.8); cc.stroke(); }
      });
      part(c, wool, (cc) => rr(cc, -5.4 + dx, -38.8, 10.8, 2.8, 1), (cc) => cc.rect(2 + dx, -40, 6, 4), (cc) => cc.rect(-5 + dx, -38.6, 3, 0.6));
      c.strokeStyle = wool.s; c.lineWidth = 0.45;
      for (let x = -4.4; x <= 4.6; x += 1.1) { c.beginPath(); c.moveTo(x + dx, -38.2); c.lineTo(x + dx, -36.4); c.stroke(); }
      tufts(c, [[dx + (side ? 1 : 0), -45, 1.2], [dx + (side ? 0 : -0.9), -44.4, 1], [dx + (side ? 1.8 : 0.9), -44.4, 1]], p.pomT);
    } else if (p.hat === 'cap') {
      // a ball cap: a round crown with a button on top, and the peak out front
      const t = p.hatC;
      part(c, t, (cc) => { cc.beginPath(); cc.moveTo(-5 + dx, -37); cc.bezierCurveTo(-5.2 + dx, -43.8, 5.2 + dx, -43.8, 5 + dx, -37); cc.closePath(); },
        (cc) => cc.rect(1.6 + dx, -46, 8, 10), (cc) => ell(cc, -2 + dx, -41.4, 1.5, 0.6, -0.4));
      c.fillStyle = t.s; ell(c, dx, -42.1, 0.8, 0.45); c.fill();
      if (view === 'front') {
        c.strokeStyle = t.s; c.lineWidth = 0.45; c.beginPath(); c.moveTo(0, -41.8); c.lineTo(0, -37.8); c.stroke();
        part(c, t, (cc) => {
          cc.beginPath(); cc.moveTo(-5.2, -37.4); cc.quadraticCurveTo(0, -38.6, 5.2, -37.4);
          cc.quadraticCurveTo(5.4, -35.8, 0, -35.7); cc.quadraticCurveTo(-5.4, -35.8, -5.2, -37.4); cc.closePath();
        }, (cc) => cc.rect(-6, -36.8, 12, 2));
      } else if (side) part(c, t, (cc) => poly(cc, [[-3.6, -37.8], [-8.8, -37.2], [-8.6, -36.2], [-3.4, -36.6]]), (cc) => cc.rect(-9, -36.8, 6, 1));
      else { c.strokeStyle = OUT; c.lineWidth = 0.55; c.beginPath(); c.moveTo(-1.6, -37.1); c.quadraticCurveTo(0, -39, 1.6, -37.1); c.stroke(); } // the strap
    } else if (p.hat === 'hardhat') {
      // a hard hat: a tall dome with a ridge over the top, and a brim all round
      const t = p.hatC;
      part(c, t, (cc) => { cc.beginPath(); cc.moveTo(-5.4 + dx, -37.4); cc.bezierCurveTo(-5.8 + dx, -46, 5.8 + dx, -46, 5.4 + dx, -37.4); cc.closePath(); },
        (cc) => cc.rect(1.8 + dx, -47, 8, 11), (cc) => ell(cc, -2.2 + dx, -42.6, 1.6, 0.8, -0.4));
      if (side) { c.strokeStyle = t.s; c.lineWidth = 1; c.beginPath(); c.moveTo(-4 + dx, -41.6); c.quadraticCurveTo(dx, -45.4, 4 + dx, -41.6); c.stroke(); }
      else part(c, t, (cc) => rr(cc, -1, -44.4, 2, 7, 1), (cc) => cc.rect(0, -45, 2, 8));
      part(c, t, (cc) => (side ? rr(cc, -7.8, -38.4, 14, 1.4, 0.7) : ell(cc, 0, -37.4, 7, 1.3)), (cc) => cc.rect(-8, -37.3, 16, 2));
    } else if (p.hat === 'cowboy') {
      // a cowboy hat: a creased crown with a band round it, on a wide brim curled up at the sides
      const t = p.hatC;
      part(c, t, (cc) => poly(cc, side ? [[-9.8, -39.2], [-6.6, -37.8], [5.6, -37.8], [8.8, -39.2], [8.6, -37.6], [5.4, -36.6], [-6.4, -36.6], [-9.6, -37.8]]
        : [[-9.6, -39.6], [-6.2, -37.6], [6.2, -37.6], [9.6, -39.6], [9.4, -37.8], [6.4, -35.9], [-6.4, -35.9], [-9.4, -37.8]]), (cc) => cc.rect(-10, -37.1, 20, 2));
      part(c, t, (cc) => poly(cc, [[-4.2 + dx, -37.6], [-4.6 + dx, -43.6], [-2.4 + dx, -45], [dx, -44], [2.4 + dx, -45], [4.6 + dx, -43.6], [4.2 + dx, -37.6]]),
        (cc) => cc.rect(1.4 + dx, -46, 6, 9), (cc) => ell(cc, -2.4 + dx, -42.6, 0.8, 1.4));
      part(c, tone('#5c4c3a'), (cc) => rr(cc, -4.35 + dx, -39.8, 8.7, 1.7, 0.4));
    } else if (p.hat === 'crown') {
      // the Office Champion's crown: a red velvet cap inside a gold band with three points,
      // a pearl on each point and jewels round the band
      const t = p.hatC;
      part(c, tone('#b83028'), (cc) => ell(cc, dx, -40.4, 4.2, 3.4), (cc) => cc.rect(1.4 + dx, -45, 4, 6), (cc) => ell(cc, -1.6 + dx, -42.4, 1.2, 0.6, -0.4));
      part(c, t, (cc) => poly(cc, [[-4.8 + dx, -39.6], [-5.4 + dx, -44], [-2.6 + dx, -41.2], [dx, -45.2], [2.6 + dx, -41.2], [5.4 + dx, -44], [4.8 + dx, -39.6]]),
        (cc) => cc.rect(1.6 + dx, -47, 5, 9), (cc) => poly(cc, [[-4.6 + dx, -40.2], [-5 + dx, -43], [-3.8 + dx, -41.8]]));
      for (const [x, y] of [[-5.4, -44], [0, -45.2], [5.4, -44]]) part(c, tone('#efe6d2'), (cc) => ell(cc, x + dx, y, 1, 1));
      part(c, t, (cc) => rr(cc, -5.1 + dx, -40.4, 10.2, 3.2, 0.7), (cc) => cc.rect(2.2 + dx, -41, 4, 5), (cc) => cc.rect(-4.6 + dx, -40, 3, 0.6));
      if (view !== 'back') {
        // (the jewels with no outline, or they'd be all outline at this size)
        const jewel = (x, r, col) => { c.fillStyle = col; ell(c, x + dx, -38.8, r, r * 0.85); c.fill(); c.fillStyle = 'rgba(255, 255, 255, 0.7)'; ell(c, x + dx - r * 0.35, -39.1, r * 0.35, r * 0.25); c.fill(); };
        jewel(side ? -2.6 : 0, 1.1, '#d0242c');
        for (const x of side ? [1] : [-3.1, 3.1]) jewel(x, 0.8, '#3a6ad8');
      }
    }
  }
  // what someone wears with their hair showing: glasses, shades, headphones or a bow
  function worn(c, p, view) {
    const side = view === 'side', t = p.hatC;
    if (p.wear === 'glasses' || p.wear === 'shades') {
      const lens = p.wear === 'shades' ? '#1c1a26' : 'rgba(188, 224, 248, 0.4)';
      c.strokeStyle = OUT; c.lineWidth = 0.6;
      if (view === 'front') {
        for (const s of [-1, 1]) { rr(c, s * 1.95 - 1.6, -35.6, 3.2, 2.6, 0.9); c.fillStyle = lens; c.fill(); c.stroke(); }
        c.beginPath(); c.moveTo(-0.35, -34.9); c.lineTo(0.35, -34.9); c.moveTo(-3.55, -35); c.lineTo(-4.5, -35.2); c.moveTo(3.55, -35); c.lineTo(4.5, -35.2); c.stroke();
      } else if (side) {
        rr(c, -4.3, -35.6, 2.2, 2.6, 0.8); c.fillStyle = lens; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-2.1, -35); c.lineTo(1.2, -34.8); c.stroke();
      }
      if (p.wear === 'shades' && view !== 'back') { // a glint
        c.strokeStyle = 'rgba(255, 255, 255, 0.7)'; c.lineWidth = 0.4;
        for (const x of side ? [-3.2] : [-1.95, 1.95]) { c.beginPath(); c.moveTo(x - 0.8, -34.1); c.lineTo(x, -35); c.stroke(); }
      }
    } else if (p.wear === 'headphones') {
      const band = () => {
        c.beginPath();
        if (side) { c.moveTo(1.2, -35.2); c.quadraticCurveTo(1.8, -41.8, 0, -42.6); } else { c.moveTo(-5.2, -34.6); c.bezierCurveTo(-6, -45, 6, -45, 5.2, -34.6); }
      };
      band(); c.strokeStyle = OUT; c.lineWidth = 2.1; c.stroke();
      band(); c.strokeStyle = t.f; c.lineWidth = 1; c.stroke();
      const cup = tone('#c8352f');
      if (side) { part(c, cup, (cc) => ell(cc, 1.2, -33.8, 2.1, 2.6), (cc) => cc.rect(1.8, -37, 3, 6)); part(c, tone('#3a3440'), (cc) => ell(cc, 1, -33.8, 0.9, 1.3)); }
      else for (const s of [-1, 1]) part(c, cup, (cc) => rr(cc, s * 5.3 - 1.3, -36, 2.6, 4.4, 1.1), (cc) => cc.rect(s * 5.3 + 0.2, -37, 2, 6));
    } else if (p.wear === 'bow') {
      const x = side ? 1.4 : view === 'back' ? -3.2 : 3.2, y = side ? -41.4 : -40.4;
      for (const s of [-1, 1]) part(c, t, (cc) => poly(cc, [[x, y], [x + s * 2.6, y - 1.6], [x + s * 2.8, y + 1.4]]), (cc) => cc.rect(x + (s > 0 ? 0.6 : -3), y + 0.2, 2.4, 2));
      part(c, t, (cc) => ell(cc, x, y, 0.9, 1));
    }
  }

  // ---------- bodies ----------
  function feet(c, p, x, y, sk, side) {
    if (sk) {
      part(c, p.skate, (cc) => (side ? rr(cc, x - 2.8, y - 3.4, 4.8, 3.4, 1) : rr(cc, x - 1.9, y - 3.6, 3.8, 3.6, 1)), (cc) => cc.rect(x + 0.6, y - 5, 4, 6));
      c.strokeStyle = '#e8e8f0'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(x - (side ? 0.4 : 0.9), y - 2.7); c.lineTo(x + (side ? 0.8 : 0.9), y - 2.7); c.stroke();
      part(c, p.blade, (cc) => (side ? rr(cc, x - 3.6, y - 0.3, 6, 1, 0.5) : rr(cc, x - 0.6, y - 0.3, 1.2, 1.2, 0.4)));
    } else {
      part(c, p.sole, (cc) => (side ? rr(cc, x - 3.2, y - 1, 5.4, 1.4, 0.6) : rr(cc, x - 2.2, y - 1, 4.4, 1.4, 0.6)));
      part(c, p.boot, (cc) => (side ? rr(cc, x - 2.9, y - 3.4, 4.8, 2.8, 1.1) : rr(cc, x - 2, y - 3.6, 4, 2.9, 1.1)), (cc) => cc.rect(x + 0.6, y - 5, 4, 6), (cc) => cc.rect(x - (side ? 2.4 : 1.6), y - 3.2, 1, 0.6));
      c.strokeStyle = '#e8d8b0'; c.lineWidth = 0.35;
      for (const yy of [-2.9, -2]) { c.beginPath(); c.moveTo(x - 0.6, y + yy); c.lineTo(x + 0.6, y + yy); c.stroke(); }
    }
  }
  // the shirt: with a tie, a blouse, a T-shirt, stripes, a hoodie, a suit, a sweater or a
  // hi-vis vest
  function torso(c, p, view, by) {
    const side = view === 'side';
    const sw = side ? 4.4 : p.female ? 6.6 : 7.8, ww = side ? 4.2 : p.female ? 5.4 : 6.4, hw = side ? 4.2 : p.female ? 5.8 : 6.2;
    const top = -28.6 + by, hem = -13.4 + by;
    const shape = (cc) => {
      cc.beginPath();
      cc.moveTo(-sw, top + 1.8); cc.quadraticCurveTo(-sw + 0.4, top, -sw + 2.2, top);
      cc.lineTo(sw - 2.2, top); cc.quadraticCurveTo(sw - 0.4, top, sw, top + 1.8);
      if (side) cc.lineTo(ww + 0.3, -19 + by); else cc.quadraticCurveTo(ww, -19 + by, hw + 0.4, hem);
      cc.lineTo(-hw - 0.4, hem);
      cc.quadraticCurveTo(-ww, -19 + by, -sw, top + 1.8);
      cc.closePath();
    };
    part(c, p.coat, shape, (cc) => { cc.moveTo(side ? 0.8 : 2.4, top - 1); cc.lineTo(20, top - 1); cc.lineTo(20, hem + 2); cc.lineTo(side ? 1.4 : 1.6, hem + 2); cc.closePath(); },
      (cc) => { cc.moveTo(-sw + 0.6, top + 1); cc.lineTo(-sw + 1.6, top + 0.6); cc.lineTo(-ww + 0.6, -19 + by); cc.lineTo(-ww - 0.2, -19 + by); cc.closePath(); });
    c.save(); shape(c); c.clip();
    c.strokeStyle = OUT; c.lineWidth = 0.55;
    if (p.outfit === 'stripes') {
      c.fillStyle = p.acc.f;
      for (let y = top + 2.2; y < hem - 0.6; y += 2.8) c.fillRect(-20, y, 40, 1.3);
    } else if (p.outfit === 'sweater') {
      // a knitted band of diamonds across the chest
      c.fillStyle = p.acc.f;
      c.fillRect(-20, -24.6 + by, 40, 0.7); c.fillRect(-20, -20.2 + by, 40, 0.7);
      for (let x = -9.1; x <= 9.1; x += 2.6) { poly(c, [[x, -23.6 + by], [x + 1.1, -22.4 + by], [x, -21.2 + by], [x - 1.1, -22.4 + by]]); c.fill(); }
    } else if (p.outfit === 'hivis') {
      // two silver stripes round the vest, and the shirt showing at the neck
      c.lineWidth = 0.35;
      for (const y of [-21.8, -17.4]) {
        c.fillStyle = '#e8ecf2'; c.fillRect(-20, y + by, 40, 1.4);
        c.beginPath(); c.moveTo(-20, y + by); c.lineTo(20, y + by); c.moveTo(-20, y + 1.4 + by); c.lineTo(20, y + 1.4 + by); c.stroke();
      }
      c.lineWidth = 0.55;
      if (view === 'front') {
        poly(c, [[-2.4, top - 1], [2.4, top - 1], [0, top + 3.6]]); c.fillStyle = p.arms.f; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, top + 3.6); c.lineTo(0, hem); c.stroke();
      }
    } else if (p.outfit === 'suit' || p.outfit === 'tie') {
      if (view === 'front') {
        // a suit's lapels open on a white shirt; either way, a tie down the front
        const end = (p.outfit === 'suit' ? -21.6 : -18.2) + by;
        if (p.outfit === 'suit') { poly(c, [[-2.6, top - 1], [2.6, top - 1], [0, -19.4 + by]]); c.fillStyle = '#f4f4f8'; c.fill(); c.stroke(); }
        c.fillStyle = p.acc.f;
        poly(c, [[-0.7, top + 1], [0.7, top + 1], [1.1, end], [0, end + 1.4], [-1.1, end]]); c.fill(); c.stroke();
        rr(c, -0.9, top - 0.2, 1.8, 1.5, 0.4); c.fill(); c.stroke();
        if (p.outfit === 'suit') for (const y of [-17.6, -15.4]) { ell(c, 0, y + by, 0.5, 0.5); c.fillStyle = p.coat.s; c.fill(); c.stroke(); }
      } else if (view === 'back' && p.outfit === 'suit') { c.beginPath(); c.moveTo(0, -17 + by); c.lineTo(0, hem); c.stroke(); }
    } else if (p.outfit === 'blouse') {
      if (view === 'front') { poly(c, [[-2.2, top - 1], [2.2, top - 1], [0, top + 2.8]]); c.fillStyle = p.skin.f; c.fill(); c.stroke(); }
    } else if (p.outfit === 'hoodie') {
      if (view === 'front') { rr(c, -3.8, -18.8 + by, 7.6, 4.2, 1.4); c.fillStyle = p.coat.s; c.fill(); c.stroke(); } // the pocket
    }
    c.restore();
    // a band at the hem
    c.strokeStyle = OUT; c.lineWidth = 0.55;
    c.beginPath(); c.moveTo(-hw, hem - 1.4); c.lineTo(hw, hem - 1.4); c.stroke();
  }
  // Below the waist, someone can have a skirt (drawn over the tops of the legs, under the
  // shirt) or overalls (a bib and straps, over the shirt).
  function skirt(c, p, view, by) {
    const w = view === 'side' ? 3.6 : p.female ? 5.4 : 5.8;
    part(c, p.pants, (cc) => poly(cc, [[-w, -15.6 + by], [w, -15.6 + by], [w + 2, -8.6 + by * 0.5], [-w - 2, -8.6 + by * 0.5]]), (cc) => cc.rect(view === 'side' ? 1 : 2.2, -17 + by, 10, 10));
  }
  function bib(c, p, view, by) {
    const hw = view === 'side' ? 4.2 : p.female ? 5.8 : 6.2, sw = p.female ? 6.6 : 7.8, top = -28.6 + by;
    // the seat of them, up to the waist
    part(c, p.pants, (cc) => rr(cc, -hw - 0.4, -16.2 + by, hw * 2 + 0.8, 2.8 + 0.4, 0.6), (cc) => cc.rect(view === 'side' ? 1 : 2.2, -18 + by, 10, 6));
    if (view === 'front') {
      for (const s of [-1, 1]) limb(c, [[s * 2.5, -22 + by], [s * (sw - 3.4), top + 0.4]], 1.3, p.pants);
      part(c, p.pants, (cc) => rr(cc, -3.4, -22.6 + by, 6.8, 7, 0.8), (cc) => cc.rect(1.6, -24 + by, 3, 10));
      c.strokeStyle = p.pants.s; c.lineWidth = 0.45; rr(c, -1.7, -21.4 + by, 3.4, 2.4, 0.4); c.stroke(); // a pocket
      for (const s of [-1, 1]) { ell(c, s * 2.4, -21.8 + by, 0.55, 0.55); c.fillStyle = '#e8c87a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.4; c.stroke(); }
    } else if (view === 'back') {
      for (const s of [-1, 1]) limb(c, [[s * (sw - 3.4), top + 0.4], [-s * 1.6, -16 + by]], 1.3, p.pants);
    } else {
      part(c, p.pants, (cc) => rr(cc, -3.6, -22.6 + by, 2.6, 7, 0.6));
      limb(c, [[-2.4, -22 + by], [0, top + 0.4], [2.6, -18 + by]], 1.3, p.pants);
    }
  }
  // the shirt's neckline: a collar, a crew neck, a necklace or a hood
  function neckline(c, p, view, by) {
    const side = view === 'side';
    switch (p.outfit) {
      case 'tie': case 'suit': {
        const t = p.outfit === 'suit' ? tone('#f4f4f8') : p.coat;
        if (view === 'front') for (const s of [-1, 1]) part(c, t, (cc) => poly(cc, [[s * 0.8, -28.8 + by], [s * 3.2, -29.2 + by], [s * 1.6, -26.4 + by]]));
        else part(c, t, (cc) => rr(cc, side ? -3 : -3.4, -29.6 + by, side ? 6 : 6.8, 1.6, 0.6));
        break;
      }
      case 'tee': case 'stripes': case 'sweater': {
        if (view === 'back') break;
        const arc = () => {
          c.beginPath();
          if (side) { c.moveTo(-3, -28.6 + by); c.quadraticCurveTo(-2.4, -27.2 + by, -1, -27.4 + by); } else { c.moveTo(-2.8, -28.7 + by); c.quadraticCurveTo(0, -26.4 + by, 2.8, -28.7 + by); }
        };
        arc(); c.strokeStyle = OUT; c.lineWidth = 1.9; c.stroke();
        arc(); c.strokeStyle = p.outfit === 'tee' ? p.acc.f : p.coat.s; c.lineWidth = 0.9; c.stroke();
        break;
      }
      case 'blouse':
        if (view !== 'front') break;
        c.strokeStyle = p.acc.f; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-2, -28.8 + by); c.quadraticCurveTo(0, -25.8 + by, 2, -28.8 + by); c.stroke();
        part(c, p.acc, (cc) => ell(cc, 0, -26.2 + by, 0.7, 0.8));
        break;
      case 'hoodie':
        // the hood, bunched behind the neck (or hanging down the back), and its strings
        if (view === 'front') {
          part(c, p.coat, (cc) => rr(cc, -5.2, -31.4 + by, 10.4, 3.8, 1.8), (cc) => cc.rect(2, -33 + by, 5, 6));
          for (const s of [-1, 1]) {
            const str = () => { c.beginPath(); c.moveTo(s * 1.2, -27.8 + by); c.lineTo(s * 1.4, -23.4 + by); };
            str(); c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke();
            str(); c.strokeStyle = p.acc.f; c.lineWidth = 0.5; c.stroke();
          }
        } else if (view === 'back') part(c, p.coat, (cc) => poly(cc, [[-4.6, -30.4 + by], [4.6, -30.4 + by], [3.8, -24.6 + by], [0, -23.2 + by], [-3.8, -24.6 + by]]), (cc) => cc.rect(1, -32 + by, 6, 10));
        else part(c, p.coat, (cc) => ell(cc, 3, -28.4 + by, 2.6, 2.4), (cc) => cc.rect(3.4, -32 + by, 4, 8));
        break;
    }
  }
  // the stripes down a striped shirt's sleeve
  const sleeve = (p) => (p.outfit === 'stripes' ? { on: [1.3, 1.5], col: p.acc.f, a: 1 } : null);
  const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // an arm in its sleeve (a T-shirt's stops short of the elbow), and its hand
  function arm(c, p, a, w, t, skin) {
    if (p.outfit === 'tee') { limb(c, a, w * 0.85, skin); limb(c, [a[0], along(a[0], a[1], 0.7)], w * 1.05, t); }
    else limb(c, a, w, t, sleeve(p));
    hand(c, p, ...a[2]);
  }
  // a leg in its trousers, or bare below shorts (or a skirt)
  function leg(c, p, pts, w, t, skin) {
    if (p.legs !== 'shorts' && p.legs !== 'skirt') { limb(c, pts, w, t); return; }
    limb(c, pts, w * 0.82, skin);
    if (p.legs === 'shorts') limb(c, [pts[0], along(pts[0], pts[1], 0.8)], w * 1.08, t);
  }
  function hand(c, p, x, y) {
    part(c, p.skin, (cc) => ell(cc, x, y, 1.8, 2), (cc) => cc.rect(x + 0.4, y - 3, 3, 6));
  }
  // heads are drawn a size up, grown from the neck
  function bigHead(c) { c.translate(0, -29.4); c.scale(1.16, 1.16); c.translate(0, 29.4); }

  function front(c, p, k, back) {
    const by = -k.bob - (k.sk ? 1.2 : 0), view = back ? 'back' : 'front';
    if (!back) { c.save(); c.translate(0, by); bigHead(c); hairBehind(c, p, 'front'); c.restore(); }
    for (const s of [-1, 1]) {
      const push = Math.max(0, s * k.sw), lift = k.mv ? push * (k.sk ? 1 : 1.8) : 0;
      const out = k.sk ? push * 3 : 0;
      const ax = s * (2.9 + out), ay = -lift;
      leg(c, p, [[s * 2.8, -14.4 + by], [s * (3.1 + out * 0.5) + (k.sk ? s * 0.6 : 0), -8.4 + by * 0.5 - lift * 0.4], [ax, -2.4 + ay]], 4.6, p.pants, p.skin);
      feet(c, p, ax, ay, k.sk, false);
    }
    if (p.legs === 'skirt') skirt(c, p, view, by);
    const sw = p.female ? 6.6 : 7.8;
    const arms = [-1, 1].map((s) => {
      const swing = k.mv ? -s * k.sw * 1.4 : 0;
      return k.sk ? [[s * (sw - 1), -26.6 + by], [s * (sw + 2.6), -22.4 + by + swing * 0.5], [s * (sw + 4.6), -19.2 + by + swing]]
        : [[s * (sw - 1), -26.6 + by], [s * (sw + 0.5), -21.2 + by + swing * 0.4], [s * (sw + 0.1), -16.4 + by + swing]];
    });
    torso(c, p, view, by);
    if (p.legs === 'overalls') bib(c, p, view, by);
    arms.forEach((a) => arm(c, p, a, 4.4, p.arms, p.skin));
    neckline(c, p, view, by);
    c.save(); c.translate(0, by); bigHead(c);
    for (const s of [-1, 1]) part(c, p.skin, (cc) => ell(cc, s * 4.6, -33.8, 0.95, 1.5));
    if (back) hairBack(c, p);
    else {
      part(c, p.skin, (cc) => headFront(cc, p), faceShadow, faceLight);
      face(c, p, k);
      hairFront(c, p);
    }
    worn(c, p, view);
    hat(c, p, view);
    c.restore();
  }
  function side(c, p, k) {
    const by = -k.bob - (k.sk ? 1.4 : 0);
    const legs = [1, -1].map((s) => { // far leg first; forward is -x
      const push = Math.max(0, s * k.sw);
      if (k.sk) return { hip: [0, -15 + by], knee: [-2.6 + push * 3.4, -8.4 + by * 0.5], foot: [-1 + push * 6.4, -push * 1.8] };
      const st = s * k.sw;
      return { hip: [0, -15 + by], knee: [-st * 2 - 0.4, -8.4], foot: [-st * 3, k.mv ? -Math.max(0, -s * Math.cos(k.a)) * 1.2 : 0] };
    });
    const lean = k.sk ? -0.26 : -0.04;
    const pivot = (fn) => { c.save(); c.translate(0, -15 + by); c.rotate(lean); c.translate(0, 15 - by); fn(); c.restore(); };
    const armAt = (s) => {
      const sw = k.mv ? (k.sk ? s * k.sw * 5 : -s * k.sw * 3) : 0;
      return [[0.2, -26.4 + by], [0.4 + sw * 0.5, -21.4 + by], [0.2 + sw, -16.6 + by + Math.abs(sw) * 0.25]];
    };
    pivot(() => arm(c, p, armAt(1), 4.2, flat(p.arms.s), flat(p.skin.s)));
    legs.forEach((l, i) => {
      leg(c, p, [l.hip, l.knee, [l.foot[0], l.foot[1] - 2.4]], 4.4, i ? p.pants : flat(p.pants.s), i ? p.skin : flat(p.skin.s));
      feet(c, p, l.foot[0], l.foot[1], k.sk, true);
    });
    if (p.legs === 'skirt') skirt(c, p, 'side', by);
    pivot(() => {
      c.save(); c.translate(0, by); bigHead(c); hairBehind(c, p, 'side'); c.restore();
      torso(c, p, 'side', by);
      if (p.legs === 'overalls') bib(c, p, 'side', by);
      arm(c, p, armAt(-1), 4.4, p.arms, p.skin);
      neckline(c, p, 'side', by);
      c.save(); c.translate(0, by); bigHead(c);
      part(c, p.skin, (cc) => headSide(cc, p), (cc) => { cc.moveTo(0.6, -44); cc.lineTo(8, -44); cc.lineTo(8, -26); cc.lineTo(0, -26); cc.closePath(); }, (cc) => ell(cc, -3, -38.6, 1.4, 0.7, -0.2));
      faceSide(c, p, k);
      hairSide(c, p);
      worn(c, p, 'side');
      hat(c, p, 'side');
      c.restore();
    });
  }

  const SIZE = 0.75;
  // One pose, with the feet at (0, 0). o: { dir, walk (0 to 1 through a stride, or -1
  // standing), skate, blink }.
  function pose(c, p, o) {
    const mv = o.walk >= 0, a = mv ? o.walk * TAU : 0;
    const k = { mv, a, sw: Math.sin(a), sk: !!o.skate, t: o.walk * 24, bob: mv ? Math.abs(Math.cos(a)) * (o.skate ? 0.6 : 1) : 0, blink: o.blink };
    c.save();
    c.fillStyle = 'rgba(40, 50, 90, 0.28)'; ell(c, 0, 0, 7.4, 2.3); c.fill();
    c.scale(o.dir === 'right' ? -SIZE : SIZE, SIZE);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (k.sk && o.dir !== 'left' && o.dir !== 'right') c.rotate(k.sw * 0.06);
    if (o.dir === 'left' || o.dir === 'right') side(c, p, k);
    else front(c, p, k, o.dir === 'up');
    c.restore();
  }
  // Someone takes a lot of shapes to draw, so each pose is drawn once onto a little canvas
  // of its own and reused: a stride is cut into 6 poses, and standing still is one (two,
  // with a blink). If too many pile up, they're all thrown away and drawn again as needed.
  const BOX_W = 48, BOX_H = 60, FEET = 52, MAX_POSES = 300;
  const posed = new Set();
  let poses = 0;
  // Draw someone with their feet at (x, y). o: { dir, t (a tick count, for blinking),
  // walk (0 to 1 through a stride, or -1 standing still), skate (on the ice) }.
  function drawPerson(c, p, x, y, o) {
    const step = o.walk >= 0 ? Math.floor(o.walk * 6) % 6 : -1;
    const blink = step < 0 && (o.t + Math.floor(p.seed * 40)) % 200 < 7;
    const key = o.dir + (o.skate ? 's' : 'w') + step + (blink ? 'b' : '');
    if (!p.poses) { p.poses = new Map(); posed.add(p.poses); }
    let img = p.poses.get(key);
    if (!img) {
      if (poses >= MAX_POSES) { posed.forEach((m) => m.clear()); poses = 0; }
      const [cv, cc] = makeCanvas(BOX_W, BOX_H);
      cc.translate(BOX_W / 2, FEET);
      pose(cc, p, { dir: o.dir, walk: step < 0 ? -1 : step / 6, skate: o.skate, blink });
      p.poses.set(key, img = cv);
      poses++;
    }
    c.drawImage(img, x - BOX_W / 2, y - FEET, BOX_W, BOX_H);
  }
  // A name over someone's head, and a speech bubble above that.
  const FONT = '700 5px system-ui, -apple-system, "Segoe UI", sans-serif';
  function tag(c, str, x, y) {
    c.font = FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(str).width + 5;
    rr(c, x - w / 2, y - 3.6, w, 7.2, 3.6);
    c.fillStyle = 'rgba(22, 18, 28, 0.72)'; c.fill();
    c.fillStyle = '#ffffff'; c.fillText(str, x, y + 0.2);
  }
  function bubble(c, str, x, y, minX, maxX) {
    c.font = FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(str).width + 8, bx = Math.max(minX + 1, Math.min(maxX - w - 1, x - w / 2));
    c.lineWidth = 0.9; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(bx + 3.4, y - 9); c.arcTo(bx + w, y - 9, bx + w, y, 3.4); c.arcTo(bx + w, y, bx, y, 3.4);
    c.lineTo(x + 1.8, y); c.lineTo(x, y + 2.6); c.lineTo(x - 1.8, y);
    c.arcTo(bx, y, bx, y - 9, 3.4); c.arcTo(bx, y - 9, bx + w, y - 9, 3.4); c.closePath();
    c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = OUT; c.stroke();
    c.fillStyle = OUT; c.fillText(str, bx + w / 2, y - 4.4);
  }

  // ---------- the parking lot ----------
  // Painted once, when you first step outside: `ground` is everything flat (one canvas
  // the size of the whole lot) and `props` everything that stands up off it, each with
  // the y its base sits on, so the game can sort them in among the people. Props with a
  // `draw` are animated and drawn fresh every frame. All of it in the same style as the
  // people: black outlines, flat colour, a hard shadow and highlight.
  const CARS = ['#c8352f', '#2f6fc0', '#d4d8e0', '#2e7a52', '#f2f2f4', '#e0a030', '#6a4aa8', '#3a3f4a', '#2a9ab0'];
  const BULBS = ['#ff4a4a', '#ffd23a', '#4ae06a', '#4aa8ff', '#ff7ad8', '#ff9a2a'];
  const SNOWY = { f: '#f4f8fc', s: '#b8cae0', h: '#ffffff' };
  const GROUND = 'rgba(40, 50, 90, 0.28)'; // shadows on the ground

  function sprite(w, h, ox, oy, fn) {
    const [img, c] = makeCanvas(w, h);
    c.translate(ox, oy); c.lineWidth = OL;
    fn(c);
    return { img, w, h, ox, oy };
  }
  const place = (s, x, y, base) => ({ img: s.img, x: x - s.ox, y: y - s.oy, w: s.w, h: s.h, base });
  // snow heaped on something
  const snowOn = (c, pts, r) => tufts(c, pts, SNOWY, r || 2.2);

  function pine(c, s, rnd) {
    const green = tone(rnd() < 0.5 ? '#2d6a48' : '#36744a');
    part(c, tone('#6a4428'), (cc) => rr(cc, -1.9 * s, -7 * s, 3.8 * s, 7.4 * s, 0.8), (cc) => cc.rect(0.3 * s, -10 * s, 4 * s, 12 * s));
    for (let i = 0; i < 4; i++) {
      const w = (13.5 - i * 2.9) * s, base = (-6 - i * 7.6) * s, h = 13 * s, top = base - h;
      // a tier of branches, ragged along the bottom
      const teeth = [];
      for (let j = 0; j <= 6; j++) teeth.push([w - j * w / 3, base + (j & 1 ? -1.4 * s : 0.8 * s)]);
      part(c, green, (cc) => poly(cc, [[0, top], [w * 0.4, base - h * 0.45], [w, base]].concat(teeth, [[-w, base], [-w * 0.4, base - h * 0.45]])),
        (cc) => { cc.moveTo(0.4, top - 1); cc.lineTo(w + 2, base + 3); cc.lineTo(w * 0.1, base + 3); cc.closePath(); },
        (cc) => { cc.moveTo(-0.6, top + 1); cc.lineTo(-w + 1, base - 0.6); cc.lineTo(-w + 2.6, base - 0.6); cc.closePath(); });
      // snow lying on it
      part(c, SNOWY, (cc) => {
        cc.beginPath(); cc.moveTo(0, top - 0.4);
        cc.lineTo(w * 0.48, base - h * 0.54);
        for (let j = 0; j < 4; j++) { const x = w * 0.48 - (j + 1) * w * 0.96 / 4; cc.quadraticCurveTo(x + w * 0.12, base - h * 0.54 + (j & 1 ? -1 : 1.8) * s, x, base - h * 0.54); }
        cc.closePath();
      }, (cc) => cc.rect(w * 0.15, top, w, h));
    }
  }

  function car(c, col, rearToUs, rnd) {
    const b = tone(col), side = (cc) => cc.rect(18, 0, 20, 50), lit = (cc) => cc.rect(3.4, 4, 2.2, 30);
    c.fillStyle = GROUND; rr(c, 1, 6, 31, 43, 8); c.fill();
    c.fillStyle = '#18161c';
    for (const [x, y] of [[0.8, 9], [27.8, 9], [0.8, 33], [27.8, 33]]) { rr(c, x, y, 3.6, 8.4, 1.6); c.fill(); }
    part(c, b, (cc) => rr(cc, 2.4, 2, 27.2, 42, 7), side, lit);
    // the end facing us: bumper and lights
    part(c, tone(b.s), (cc) => rr(cc, 2.4, 36, 27.2, 9.4, 4), (cc) => cc.rect(18, 30, 20, 20));
    part(c, tone('#8a8e9a'), (cc) => rr(cc, 4.4, 42.6, 23.2, 2.6, 1.3));
    for (const x of [4.6, 23.4]) part(c, tone(rearToUs ? '#e8383a' : '#fff4c8'), (cc) => rr(cc, x, 37.6, 4, 2.6, 1.2));
    if (!rearToUs) { c.fillStyle = OUT; rr(c, 11, 38.4, 10, 2.4, 1); c.fill(); }
    // windows and roof
    part(c, tone('#34405e'), (cc) => rr(cc, 5.6, 10, 20.8, 25, 5), null, (cc) => poly(cc, [[8, 12], [13, 12], [8.4, 20]]));
    part(c, b, (cc) => rr(cc, 7.4, 15, 17.2, 15, 4), side, (cc) => cc.rect(8.6, 16, 1.6, 12));
    // snow on the roof, the hood and the trunk
    const lump = (cx, cy, wd, n) => {
      const pts = [];
      for (let i = 0; i < n; i++) pts.push([cx - wd / 2 + (i + 0.5) * wd / n, cy + (rnd() - 0.5) * 2, 2.6 + rnd() * 1.4]);
      snowOn(c, pts);
    };
    lump(16, 20, 12, 4); lump(16, 25, 10, 3);
    lump(16, 5.4, 18, 5);
    if (rnd() < 0.7) lump(16, 32.6, 14, 4);
  }

  function wreath(c, x, y, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    tufts(c, pts, tone('#2f7a48'), r * 0.42);
    c.fillStyle = '#e03838';
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.5; ell(c, x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, r * 0.14, r * 0.14); c.fill(); }
    const red = tone('#d82c34');
    part(c, red, (cc) => poly(cc, [[x, y + r], [x - r * 0.6, y + r * 0.6], [x - r * 0.65, y + r * 1.4]]));
    part(c, red, (cc) => poly(cc, [[x, y + r], [x + r * 0.6, y + r * 0.6], [x + r * 0.65, y + r * 1.4]]));
    part(c, red, (cc) => poly(cc, [[x - 0.3, y + r], [x - r * 0.4, y + r * 2], [x - r * 0.1, y + r * 1.9]]));
    part(c, red, (cc) => poly(cc, [[x + 0.3, y + r], [x + r * 0.4, y + r * 2], [x + r * 0.1, y + r * 1.9]]));
    part(c, red, (cc) => ell(cc, x, y + r, r * 0.22, r * 0.22));
  }

  function lampPost(c) {
    const iron = tone('#2c3340');
    c.fillStyle = GROUND; ell(c, 0, 0, 5, 1.8); c.fill();
    part(c, iron, (cc) => rr(cc, -3, -3, 6, 3.4, 1), (cc) => cc.rect(0.6, -4, 4, 6));
    part(c, iron, (cc) => rr(cc, -1.3, -40, 2.6, 38, 1), (cc) => cc.rect(0.4, -42, 2, 42), (cc) => cc.rect(-0.9, -38, 0.6, 34));
    part(c, tone('#ffe08a'), (cc) => poly(cc, [[-3.4, -47], [3.4, -47], [2.6, -40], [-2.6, -40]]), (cc) => cc.rect(1, -48, 4, 9), (cc) => poly(cc, [[-2.6, -46.4], [-1.4, -46.4], [-1.8, -41]]));
    c.strokeStyle = OUT; c.lineWidth = 0.7; c.beginPath(); c.moveTo(0, -47); c.lineTo(0, -40); c.stroke(); c.lineWidth = OL;
    part(c, iron, (cc) => poly(cc, [[-4.8, -47], [0, -51], [4.8, -47]]));
    snowOn(c, [[-2.4, -48.8, 1.7], [0, -50.2, 1.9], [2.4, -48.8, 1.7]]);
    wreath(c, 0, -25, 3.4);
  }

  function cocoaStand(c) {
    // 48 wide; its base at y 0, the counter facing us
    const wood = tone('#a8683a'), dark = tone('#6e4024');
    c.fillStyle = GROUND; rr(c, -1, -4, 50, 6, 3); c.fill();
    part(c, dark, (cc) => rr(cc, 1, -42, 46, 26, 1));
    for (const x of [2, 43.4]) part(c, wood, (cc) => rr(cc, x, -44, 2.6, 30, 0.8), (cc) => cc.rect(x + 1.4, -46, 2, 34));
    // mugs and a big pot behind the counter
    part(c, tone('#b8bcc8'), (cc) => rr(cc, 30, -28, 10, 10.4, 2), (cc) => cc.rect(36, -30, 6, 14), (cc) => cc.rect(31, -26, 1.2, 7));
    c.fillStyle = '#4a2c1c'; ell(c, 35, -27.6, 3.6, 0.9); c.fill();
    for (const [x, col] of [[8, '#e04848'], [14.4, '#f4f4f4'], [20.8, '#3a8a58']]) {
      part(c, tone(col), (cc) => rr(cc, x, -23, 4.6, 4.8, 1), (cc) => cc.rect(x + 3, -24, 3, 6));
      c.strokeStyle = OUT; c.lineWidth = 0.7; c.beginPath(); c.arc(x + 5, -20.6, 1.3, -1.2, 1.2); c.stroke(); c.lineWidth = OL;
      snowOn(c, [[x + 1.4, -23.2, 1.1], [x + 3, -23.6, 1.2]], 1);
    }
    part(c, wood, (cc) => rr(cc, 0, -16, 48, 16, 1.2), (cc) => cc.rect(34, -17, 16, 18), null, (cc) => {
      cc.strokeStyle = OUT; cc.lineWidth = 0.5;
      for (let y = -12; y < 0; y += 4) { cc.beginPath(); cc.moveTo(0, y); cc.lineTo(48, y); cc.stroke(); }
    });
    part(c, tone('#c88850'), (cc) => rr(cc, -1.4, -18.4, 50.8, 3.4, 1.2), (cc) => cc.rect(34, -19, 20, 5), (cc) => cc.rect(0, -17.8, 30, 0.7));
    // striped awning, then the roof and the sign
    for (let i = 0; i < 8; i++) {
      const x = -2 + i * 6.5;
      part(c, tone(i & 1 ? '#f6f6f6' : '#d83a3a'), (cc) => { cc.beginPath(); cc.moveTo(x, -40); cc.lineTo(x + 6.5, -40); cc.lineTo(x + 6.5, -34); cc.quadraticCurveTo(x + 3.25, -31, x, -34); cc.closePath(); },
        (cc) => cc.rect(x + 4.4, -41, 3, 10));
    }
    part(c, dark, (cc) => rr(cc, -3, -48, 54, 8.6, 1.6), (cc) => cc.rect(-3, -42.6, 56, 4));
    snowOn(c, [[2, -48.6, 2.4], [8, -49.2, 2.8], [15, -48.8, 2.6], [33, -48.8, 2.6], [40, -49.2, 2.8], [46, -48.6, 2.4]]);
    part(c, tone('#fff3d8'), (cc) => rr(cc, 9, -58, 30, 11, 2), (cc) => cc.rect(33, -59, 8, 13));
    c.font = '900 6px system-ui, -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#9a2a1c'; c.fillText('HOT COCOA', 24, -52.2);
    snowOn(c, [[12, -58.6, 1.8], [18, -59.2, 2.2], [30, -59.2, 2.2], [36, -58.6, 1.8]]);
  }

  function bench(c) {
    const iron = tone('#2c3340'), wood = tone('#9a6438');
    c.fillStyle = GROUND; ell(c, 8, -1, 8, 2.2); c.fill();
    for (const x of [2, 12.6]) part(c, iron, (cc) => rr(cc, x, -9, 1.6, 9, 0.6));
    for (const [y, h] of [[-20, 3], [-15.6, 3], [-10.4, 3.4]])
      part(c, wood, (cc) => rr(cc, y === -10.4 ? -0.6 : 0, y, y === -10.4 ? 17.2 : 16, h, 1), (cc) => cc.rect(11, y - 1, 8, h + 2), (cc) => cc.rect(1, y + 0.5, 6, 0.6));
    snowOn(c, [[3, -11.6, 1.8], [8, -12, 2.2], [13, -11.6, 1.8]]);
    snowOn(c, [[5, -20.8, 1.5], [11, -21, 1.7]]);
  }

  // firewood stacked three high, log ends out, with a chopping block (axe in it) at the east end
  function woodpile(c) {
    const bark = tone('#7a5030'), end = tone('#d9b27a');
    c.fillStyle = GROUND; ell(c, 15, -1, 16, 2.6); c.fill();
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++) {
        const x = 2.6 + i * 4.6 + row * 2.3, y = -3 - row * 3.6;
        part(c, bark, (cc) => ell(cc, x, y, 2.3, 2), (cc) => cc.rect(x + 0.4, y - 3, 3, 6));
        part(c, end, (cc) => ell(cc, x - 0.4, y - 0.2, 1.5, 1.3));
        c.strokeStyle = bark.s; c.lineWidth = 0.35; ell(c, x - 0.4, y - 0.2, 0.7, 0.6); c.stroke(); c.lineWidth = OL;
      }
    snowOn(c, [[7, -12.8, 1.8], [10.5, -13, 2]]);
    part(c, bark, (cc) => rr(cc, 22.4, -6.4, 6.4, 6.4, 1.2), (cc) => cc.rect(26, -8, 4, 9));
    part(c, end, (cc) => ell(cc, 25.6, -6.4, 3.2, 1.2));
    part(c, tone('#a8743e'), (cc) => poly(cc, [[25.4, -6.6], [26.4, -6.8], [29.6, -14.4], [28.6, -14.6]]));
    part(c, tone('#c9d0d8'), (cc) => poly(cc, [[24, -6.4], [27.2, -6.4], [27, -8.8], [24.2, -8.4]]));
  }

  function snowman(c) {
    const snow = SNOWY, coal = '#22222c';
    c.fillStyle = GROUND; ell(c, 0, 0, 8, 2.4); c.fill();
    for (const [y, r] of [[-6.4, 7.2], [-16, 5.4], [-24, 4.3]]) part(c, snow, (cc) => ell(cc, 0, y, r, r * 0.92), (cc) => cc.rect(r * 0.3, y - r, r * 2, r * 2), (cc) => ell(cc, -r * 0.45, y - r * 0.45, r * 0.3, r * 0.2));
    c.strokeStyle = OUT; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(-5, -17); c.lineTo(-11, -21); c.moveTo(-9, -20); c.lineTo(-10, -23);
    c.moveTo(5, -17); c.lineTo(11, -20.4); c.moveTo(9.2, -19.4); c.lineTo(11, -17.6); c.stroke();
    c.strokeStyle = '#6a4428'; c.lineWidth = 0.5; c.stroke(); c.lineWidth = OL;
    c.fillStyle = coal;
    for (const y of [-17.6, -14.6, -8, -4.6]) { ell(c, 0, y, 0.8, 0.8); c.fill(); }
    ell(c, -1.5, -25, 0.7, 0.8); c.fill(); ell(c, 1.5, -25, 0.7, 0.8); c.fill();
    for (let i = 0; i < 5; i++) { ell(c, -1.8 + i * 0.9, -21.8 - Math.abs(i - 2) * 0.3, 0.38, 0.38); c.fill(); }
    part(c, tone('#f08a24'), (cc) => poly(cc, [[0, -24.2], [-4.4, -22.6], [0, -22.8]]));
    part(c, tone('#d83a3a'), (cc) => rr(cc, -5, -20.8, 10, 2.4, 1.2), (cc) => cc.rect(2, -22, 4, 4));
    part(c, tone('#d83a3a'), (cc) => rr(cc, 1.6, -19.4, 2.2, 5.4, 1), (cc) => cc.rect(2.8, -20, 2, 7));
    const hatT = tone('#2a2a34');
    part(c, hatT, (cc) => rr(cc, -4.6, -29, 9.2, 1.6, 0.8));
    part(c, hatT, (cc) => rr(cc, -3, -35, 6, 6.4, 0.6), (cc) => cc.rect(1.2, -36, 3, 8), (cc) => cc.rect(-2.2, -34, 0.7, 4.4));
    c.fillStyle = '#c82c34'; c.fillRect(-3, -30.6, 6, 1.2);
  }

  function spruce(c, rnd) {
    pine(c, 1.9, rnd);
    const cols = ['#e03838', '#f0c040', '#3878e0', '#e070c0'];
    for (let i = 0; i < 22; i++) {
      const t = rnd(), y = -16 - t * 52, w = (1 - t) * 20 + 2, x = (rnd() * 2 - 1) * w * 0.8;
      part(c, tone(cols[i % cols.length]), (cc) => ell(cc, x, y, 1.5, 1.5), (cc) => cc.rect(x + 0.2, y - 2, 2, 4), (cc) => ell(cc, x - 0.5, y - 0.5, 0.45, 0.45));
    }
  }

  function snowbank(c, rnd) {
    const pts = [];
    for (let i = 0; i < 5; i++) pts.push([-6 + i * 3 + (rnd() - 0.5) * 2, -3.5 - rnd() * 3, 3.6 + rnd() * 2.4]);
    c.fillStyle = GROUND; ell(c, 0, 0, 10, 2.6); c.fill();
    tufts(c, pts, SNOWY, 4);
  }

  function firePit(c) {
    c.fillStyle = '#2a2224'; ell(c, 0, -3, 7.6, 3.4); c.fill();
    for (let i = 0; i < 11; i++) {
      const a2 = i * TAU / 11;
      part(c, tone(i & 1 ? '#8a8e9a' : '#a4a8b2'), (cc) => ell(cc, Math.cos(a2) * 6.6, -3 + Math.sin(a2) * 3.2, 1.9, 1.5), (cc) => cc.rect(Math.cos(a2) * 6.6, -6, 3, 5));
    }
    part(c, tone('#6a4428'), (cc) => rr(cc, -5, -4.8, 10, 2.2, 1));
    c.save(); c.translate(0, -3.4); c.rotate(0.6); part(c, tone('#7a5030'), (cc) => rr(cc, -5, -1.1, 10, 2.2, 1)); c.restore();
  }
  function flames(c, x, y, t) {
    c.globalCompositeOperation = 'lighter';
    stampGlow(c, '#ff8a2a', x, y - 4, 30 + Math.sin(t / 5) * 2, 0.35);
    c.globalCompositeOperation = 'source-over';
    const tongue = (cc, s) => {
      cc.beginPath();
      for (let i = -1; i <= 1; i++) {
        const h = (9 + Math.sin(t / 3 + i * 2.1) * 2.2 - Math.abs(i) * 2.4) * s, w = 2.8 * s + 0.6;
        const fx = x + i * 2.6 * s, sway = Math.sin(t / 4 + i) * 1.2;
        cc.moveTo(fx - w, y - 3);
        cc.quadraticCurveTo(fx - w, y - 3 - h * 0.6, fx + sway, y - 3 - h);
        cc.quadraticCurveTo(fx + w, y - 3 - h * 0.6, fx + w, y - 3);
        cc.closePath();
      }
    };
    c.lineJoin = 'round'; c.lineWidth = 1.6; c.strokeStyle = OUT; tongue(c, 1); c.stroke();
    for (const [col, s] of [['#ff6a10', 1], ['#ffb82a', 0.68], ['#fff2a8', 0.36]]) { c.fillStyle = col; tongue(c, s); c.fill(); }
    c.fillStyle = '#ffd060';
    for (let i = 0; i < 5; i++) {
      const life = ((t / 40 + i * 0.37) % 1);
      c.globalAlpha = 1 - life;
      ell(c, x + Math.sin(i * 4 + t / 20) * 3 * life, y - 8 - life * 20, 0.6, 0.6); c.fill();
    }
    c.globalAlpha = 1; c.lineWidth = OL;
  }

  function net(c, facing) {
    // a hockey net, 2 tiles tall, opening towards `facing` (1 = right)
    c.save(); c.scale(facing, 1);
    c.fillStyle = 'rgba(255, 255, 255, 0.7)';
    poly(c, [[3, -8], [3, 16], [-6, 13], [-6, -4]]); c.fill();
    c.strokeStyle = 'rgba(120, 130, 150, 0.9)'; c.lineWidth = 0.4;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(3, -8 + i * 4); c.lineTo(-6, -4 + i * 3.4); c.stroke(); }
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(3 - i * 3, -8 + i * 1.4); c.lineTo(3 - i * 3, 16 - i); c.stroke(); }
    const frame = (pts) => {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = '#e03838'; c.lineWidth = 1.2; c.stroke();
    };
    frame([[3, 0], [-6, 4], [-6, 20], [3, 24]]);
    frame([[3, 24], [3, -8]]);
    c.restore(); c.lineWidth = OL;
  }
  // a hockey net 2 tiles wide, from the middle of its goal line: opening toward you
  // (`facing`), or with its back to you
  function netEnd(c, facing) {
    const frame = (pts) => {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = '#e03838'; c.lineWidth = 1.2; c.stroke();
    };
    // the mouth is 20 wide and 14 high, the net 10 deep and 9 high at the back
    const back = facing ? -10 : 10, shape = facing ? [[-10, 0], [-10, -14], [-8, -19], [8, -19], [10, -14], [10, 0]]
      : [[-10, 0], [-10, -14], [10, -14], [10, 0], [8, 10], [-8, 10]];
    if (!facing) frame([[-10, 0], [-10, -14], [10, -14], [10, 0]]);
    c.fillStyle = 'rgba(255, 255, 255, 0.7)'; poly(c, shape); c.fill();
    c.save(); poly(c, shape); c.clip();
    c.strokeStyle = 'rgba(120, 130, 150, 0.9)'; c.lineWidth = 0.4;
    for (let x = -9; x < 10; x += 3) { c.beginPath(); c.moveTo(x, -20); c.lineTo(x, 11); c.stroke(); }
    for (let y = -18; y < 11; y += 3) { c.beginPath(); c.moveTo(-11, y); c.lineTo(11, y); c.stroke(); }
    c.restore();
    frame([[-10, 0], [-8, back], [8, back], [10, 0]]);
    if (facing) frame([[-10, 0], [-10, -14], [10, -14], [10, 0]]);
    c.lineWidth = OL;
  }

  function star(c, x, y, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r2 = i & 1 ? r * 0.45 : r; pts.push([x + Math.cos(a) * r2, y + Math.sin(a) * r2]); }
    c.lineWidth = OL;
    part(c, tone('#ffd84a'), (cc) => poly(cc, pts), (cc) => cc.rect(x, y - r, r, r * 2));
  }

  function paintLot(floor) {
    const W = floor.tiles[0].length, H = floor.tiles.length;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? ' ' : floor.tiles[y][x]);
    const rnd = rng(1225);
    const [ground, c] = makeCanvas(W * 16, H * 16);
    c.lineWidth = OL;
    const props = [], lanterns = [];
    const lot = { w: W * 16, h: H * 16, ground, props, lanterns, strings: [] };

    // snow everywhere, with drifts in flat blue shadow and white
    c.fillStyle = '#e8f0f9'; c.fillRect(0, 0, W * 16, H * 16);
    for (let i = 0; i < W * H * 0.6; i++) {
      const x = rnd() * W * 16, y = rnd() * H * 16, w = 5 + rnd() * 12;
      c.fillStyle = '#d4e1f1'; ell(c, x, y, w, 1.6 + rnd() * 2); c.fill();
      c.fillStyle = '#f7fbff'; ell(c, x - w * 0.15, y - 1, w * 0.7, 1.1); c.fill();
    }
    // the plowed lot: flat asphalt, patched and cracked
    const paved = (t) => ',cLBn~'.includes(t);
    c.fillStyle = '#4e5666';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (paved(at(x, y))) c.fillRect(x * 16, y * 16, 16, 16);
    const onLot = (x, y) => at(Math.floor(x / 16), Math.floor(y / 16)) === ',';
    for (let i = 0; i < W * H * 2; i++) {
      const x = rnd() * W * 16, y = rnd() * H * 16;
      if (!onLot(x, y)) continue;
      c.fillStyle = rnd() < 0.5 ? '#454c5b' : '#5a6273';
      c.fillRect(x, y, 0.8 + rnd(), 0.8 + rnd());
    }
    c.strokeStyle = '#2c303a'; c.lineWidth = 0.5;
    for (let i = 0; i < W * H * 0.05; i++) {
      let x = rnd() * W * 16, y = rnd() * H * 16;
      if (!onLot(x, y)) continue;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * 8; y += (rnd() - 0.5) * 5; c.lineTo(x, y); }
      c.stroke();
    }
    // tire tracks down the middle of each aisle (a run of rows that are clear all the way
    // across the lot), and slush
    let lotX = 0;
    while (',B~'.includes(at(lotX + 1, H >> 1))) lotX++;
    const clear = (y) => { for (let x = 1; x <= lotX; x++) if (at(x, y) !== ',') return false; return true; };
    c.lineWidth = 2.6; c.strokeStyle = '#59616f';
    for (let y = 4; y < H; y++) {
      if (!clear(y) || clear(y - 1)) continue;
      let y1 = y;
      while (clear(y1 + 1)) y1++;
      const mid = (y + y1 + 1) * 8;
      for (const ty of [mid - 6, mid + 6]) {
        c.beginPath(); c.moveTo(0, ty);
        for (let x = 16; x <= (lotX + 1) * 16; x += 32) c.quadraticCurveTo(x, ty + (rnd() - 0.5) * 3, x + 16, ty + (rnd() - 0.5) * 2);
        c.stroke();
      }
    }
    for (let i = 0; i < W * H * 0.08; i++) {
      const x = rnd() * W * 16, y = rnd() * H * 16, w = 3 + rnd() * 6;
      if (!onLot(x, y)) continue;
      c.fillStyle = '#6c7586'; ell(c, x, y, w, 1 + rnd() * 1.4); c.fill();
      c.fillStyle = '#8e98a8'; ell(c, x - w * 0.2, y - 0.3, w * 0.5, 0.6); c.fill();
    }
    // parking lines either side of every car
    c.strokeStyle = '#e3bd3e'; c.lineWidth = 1.1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (at(x, y) !== 'c' || at(x - 1, y) === 'c' || at(x, y - 1) === 'c') continue;
        for (const lx of [x - 0.5, x + 2.5]) { c.beginPath(); c.moveTo(lx * 16, y * 16 + 2); c.lineTo(lx * 16, (y + 3) * 16 - 1); c.stroke(); }
      }
    // the sidewalk along the office: concrete slabs, salted
    for (let x = 0; x < W; x++) {
      if (at(x, 3) !== ',') continue;
      c.fillStyle = '#9ca5b4'; c.fillRect(x * 16, 48, 16, 16);
      c.fillStyle = '#b4bcc8'; c.fillRect(x * 16 + 1, 49, 14, 1);
      c.strokeStyle = OUT; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(x * 16 + 0.3, 48); c.lineTo(x * 16 + 0.3, 64); c.stroke();
      c.fillStyle = '#f4f6fa';
      for (let i = 0; i < 4; i++) { ell(c, x * 16 + rnd() * 16, 51 + rnd() * 11, 0.5, 0.5); c.fill(); }
    }
    c.lineWidth = OL;
    // snow ridges where the plow stopped
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!paved(at(x, y))) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = at(x + dx, y + dy);
          if (paved(t) || t === '#' || t === 'X') continue;
          const pts = [];
          for (let i = 0; i < 4; i++) {
            const along = (i + 0.5) * 4 + (rnd() - 0.5) * 2, into = 1.4 + rnd() * 1.4;
            pts.push([dx ? x * 16 + (dx > 0 ? 16 - into : into) : x * 16 + along, dy ? y * 16 + (dy > 0 ? 16 - into : into) : y * 16 + along, 2 + rnd() * 1.6]);
          }
          snowOn(c, pts);
        }
      }

    // ---- the rink ----
    let ix0 = W, iy0 = H, ix1 = 0, iy1 = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (at(x, y) === 'B') { ix0 = Math.min(ix0, x); iy0 = Math.min(iy0, y); ix1 = Math.max(ix1, x); iy1 = Math.max(iy1, y); }
    const L = (ix0 + 0.5) * 16, R = (ix1 + 0.5) * 16, TOP = (iy0 + 0.5) * 16, BOT = (iy1 + 0.5) * 16, RAD = 18;
    const midX = (L + R) / 2, midY = (TOP + BOT) / 2;
    const rinkPath = (cc) => {
      cc.beginPath(); cc.moveTo(L + RAD, TOP);
      cc.arcTo(R, TOP, R, BOT, RAD); cc.arcTo(R, BOT, L, BOT, RAD); cc.arcTo(L, BOT, L, TOP, RAD); cc.arcTo(L, TOP, R, TOP, RAD);
      cc.closePath();
    };
    // the gates, where the boards open on any side ({ side, a0, a1 }: from and to along
    // that side), with rubber mats
    const gaps = [];
    for (let y = iy0; y <= iy1; y++)
      for (let x = ix0; x <= ix1; x++) {
        const side = y === iy0 ? 'N' : y === iy1 ? 'S' : x === ix0 ? 'W' : x === ix1 ? 'E' : null;
        if (!side || at(x, y) !== '~') continue;
        const a = side === 'N' || side === 'S' ? x * 16 : y * 16, g = gaps.find((p) => p.side === side && p.a1 === a);
        if (g) g.a1 = a + 16; else gaps.push({ side, a0: a, a1: a + 16 });
        part(c, flat('#2a2d36'), (cc) => (side === 'N' || side === 'S' ? rr(cc, x * 16 - 0.5, y * 16 + (side === 'N' ? -3 : 8), 17, 11, 2)
          : rr(cc, x * 16 + (side === 'W' ? -3 : 8), y * 16 - 0.5, 11, 17, 2)));
      }
    c.save();
    rinkPath(c); c.clip();
    c.fillStyle = '#dcedf9'; c.fillRect(L, TOP, R - L, BOT - TOP);
    // hard-edged reflections
    for (let i = 0; i < 7; i++) {
      const x = L + rnd() * (R - L), w = 8 + rnd() * 22;
      c.fillStyle = i & 1 ? '#eaf6fe' : '#f2faff';
      poly(c, [[x, TOP], [x + w, TOP], [x + w - 60, BOT], [x - 60, BOT]]); c.fill();
    }
    c.fillStyle = '#cce3f4'; c.fillRect(L, BOT - 14, R - L, 14);
    // markings: centre red line, blue lines, goal lines and creases, faceoff circles, laid
    // out along the rink's length (u, from the middle) and across it (v), whichever way it runs
    const tall = BOT - TOP > R - L, half = (tall ? BOT - TOP : R - L) / 2, wide = (tall ? R - L : BOT - TOP) / 2;
    const uv = (u, v) => (tall ? [midX + v, midY + u] : [midX + u, midY + v]);
    const across = (u, inset) => { c.beginPath(); c.moveTo(...uv(u, -wide + inset)); c.lineTo(...uv(u, wide - inset)); c.stroke(); };
    c.lineWidth = 1.8;
    c.strokeStyle = '#d24a4a'; across(0, 0);
    c.strokeStyle = '#4a74d0';
    for (const u of [-0.33, 0.33]) across(u * half, 0);
    c.lineWidth = 1;
    c.beginPath(); c.arc(midX, midY, 26, 0, TAU); c.stroke();
    c.fillStyle = '#4a74d0'; ell(c, midX, midY, 1.6, 1.6); c.fill();
    // each net: [x, y] of its first tile, and whether it runs across the map (a net in the end
    // of a rink running north to south)
    const nets = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 'n' && at(x - 1, y) !== 'n' && at(x, y - 1) !== 'n') nets.push([x, y, at(x + 1, y) === 'n']);
    // where the goal line crosses the middle of a net
    const goal = ([nx, ny, flat2]) => (flat2 ? [nx * 16 + 16, ny * 16 + 8] : [nx * 16 + 8, ny * 16 + 16]);
    for (const n of nets) {
      const [gx, gy] = goal(n), u = tall ? gy - midY : gx - midX, f = u < 0 ? 1 : -1, toward = tall ? (f > 0 ? Math.PI / 2 : -Math.PI / 2) : (f > 0 ? 0 : Math.PI);
      c.strokeStyle = '#d24a4a';
      across(u, 6);
      c.fillStyle = '#a6cdf0';
      c.beginPath(); c.moveTo(gx, gy); c.arc(gx, gy, 14, toward - Math.PI / 2, toward + Math.PI / 2); c.closePath(); c.fill(); c.stroke();
      for (const s of [-1, 1]) {
        const [fx, fy] = uv(u + f * 50, s * wide * 0.5);
        c.beginPath(); c.arc(fx, fy, 18, 0, TAU); c.stroke();
        c.fillStyle = '#d24a4a'; ell(c, fx, fy, 1.6, 1.6); c.fill();
      }
    }
    // a maple leaf and the company name at centre ice
    leaf(c, midX, midY - 9, 7, '#e8a0a4');
    c.font = '900 11px system-ui, -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#9cbce6'; c.fillText('HAAKON', midX, midY + 9);
    c.strokeStyle = '#f6fbff'; c.lineWidth = 0.4;
    for (let i = 0; i < 140; i++) {
      const x = L + rnd() * (R - L), y = TOP + rnd() * (BOT - TOP), r = 8 + rnd() * 40, a0 = rnd() * TAU;
      c.beginPath(); c.arc(x, y, r, a0, a0 + 0.3 + rnd() * 0.8); c.stroke();
    }
    // snow scraped up against the boards
    c.lineWidth = 6; c.strokeStyle = '#f4f8fd'; rinkPath(c); c.stroke();
    c.restore();
    c.lineWidth = OL;

    // the boards: drawn on a canvas of their own, then cut into strips across so each
    // strip sorts in with the people by where its base is
    const BH = 9, TH = 3.2;
    const bx0 = L - 6, by0 = TOP - BH - 6, bw = R - L + 12, bh = BOT - TOP + BH + 10;
    const [bcv, bc] = makeCanvas(bw, bh);
    bc.translate(-bx0, -by0);
    const gapsOn = (side) => gaps.filter((g) => g.side === side);
    // all the way round dy up, lifting the pen over the gates
    const boardPath = (cc, dy) => {
      cc.beginPath();
      // a straight side from a0 to a1, pt(a) being the point that far along it
      const run = (side, a0, a1, pt) => {
        const dir = Math.sign(a1 - a0);
        for (const g of gapsOn(side).sort((p, q) => dir * (p.a0 - q.a0))) { cc.lineTo(...pt(dir > 0 ? g.a0 : g.a1)); cc.moveTo(...pt(dir > 0 ? g.a1 : g.a0)); }
        cc.lineTo(...pt(a1));
      };
      cc.moveTo(L + RAD, TOP + dy);
      run('N', L + RAD, R - RAD, (a) => [a, TOP + dy]);
      cc.arcTo(R, TOP + dy, R, TOP + RAD + dy, RAD);
      run('E', TOP + RAD, BOT - RAD, (a) => [R, a + dy]);
      cc.arcTo(R, BOT + dy, R - RAD, BOT + dy, RAD);
      run('S', R - RAD, L + RAD, (a) => [a, BOT + dy]);
      cc.arcTo(L, BOT + dy, L, BOT - RAD + dy, RAD);
      run('W', BOT - RAD, TOP + RAD, (a) => [L, a + dy]);
      cc.arcTo(L, TOP + dy, L + RAD, TOP + dy, RAD);
    };
    // every outline first, then the face (a yellow kick plate, white, and the cap's
    // shadow), then the blue cap on top
    bc.lineCap = 'butt';
    for (const pass of [0, 1])
      for (let d = 0; d <= BH; d += 0.5) {
        boardPath(bc, -d);
        if (pass) { bc.lineWidth = TH; bc.strokeStyle = d < 2 ? '#e8b830' : d > BH - 2.4 ? '#cdd6e4' : '#f4f6fa'; }
        else { bc.lineWidth = TH + OL * 2; bc.strokeStyle = OUT; }
        bc.stroke();
      }
    boardPath(bc, 0); bc.lineWidth = 0.6; bc.strokeStyle = OUT; bc.stroke();
    boardPath(bc, -BH); bc.lineWidth = TH + OL * 2.4; bc.strokeStyle = OUT; bc.stroke();
    bc.lineWidth = TH; bc.strokeStyle = '#2f5cc0'; bc.stroke();
    boardPath(bc, -BH - 0.7); bc.lineWidth = 0.8; bc.strokeStyle = '#7a9cf0'; bc.stroke();
    // ads along the north and south sides (the only ones whose faces you see)
    bc.font = '900 5.4px system-ui, -apple-system, "Segoe UI", sans-serif'; bc.textAlign = 'center'; bc.textBaseline = 'middle';
    for (const y of [TOP, BOT]) {
      const gs = gapsOn(y === TOP ? 'N' : 'S');
      for (let x = L + 30, i = 0; x < R - 24; x += 46, i++) {
        if (gs.some((g) => x > g.a0 - 22 && x < g.a1 + 22)) continue;
        if (i % 3 === 1) { leaf(bc, x, y - BH / 2 - 0.4, 2.6, '#d0262c'); continue; }
        bc.fillStyle = i & 1 ? '#d0262c' : '#2f5cc0';
        bc.fillText(i % 3 === 2 ? 'HAPPY HOLIDAYS' : 'HAAKON', x, y - BH / 2 - 0.5);
      }
    }
    // posts at the gates
    bc.lineCap = 'round';
    for (const g of gaps)
      for (const a of [g.a0, g.a1]) {
        const ns = g.side === 'N' || g.side === 'S';
        const x = ns ? a : g.side === 'W' ? L : R, y = ns ? (g.side === 'N' ? TOP : BOT) : a;
        bc.lineWidth = OL; part(bc, tone('#2f5cc0'), (cc) => rr(cc, x - 1.8, y - BH - 1.4, 3.6, BH + 2.4, 1.2), (cc) => cc.rect(x, y - BH - 2, 2, BH + 4));
      }
    // snow on the top rail
    for (const side of 'NSEW') {
      const ns = side === 'N' || side === 'S', len = ns ? R - L : BOT - TOP;
      for (let i = 0; i < len / 12; i++) {
        const a = (ns ? L : TOP) + 8 + rnd() * (len - 16);
        if (gapsOn(side).some((g) => a > g.a0 - 3 && a < g.a1 + 3)) continue;
        const x = ns ? a : side === 'W' ? L : R, y = (ns ? (side === 'N' ? TOP : BOT) : a) - BH - 1.2;
        bc.lineWidth = OL; tufts(bc, [[x, y, 1.2], ns ? [x + 1.6, y + 0.2, 1] : [x + 0.2, y + 1.6, 1]], SNOWY, 1);
      }
    }
    const cuts = [-Infinity, TOP + TH / 2];
    for (let y = Math.ceil((TOP + TH) / 16) * 16; y < BOT - BH - TH; y += 16) cuts.push(y);
    cuts.push(BOT - BH - TH / 2 - 1.2, Infinity);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const y0 = Math.max(by0, cuts[i]), y1 = Math.min(by0 + bh, cuts[i + 1]);
      props.push({ img: bcv, sy: y0 - by0, x: bx0, y: y0, w: bw, h: y1 - y0, base: cuts[i + 1] === Infinity ? BOT + TH : y1 });
    }
    for (const n of nets) {
      const [gx, gy] = goal(n), [nx, ny] = n;
      // in the end of a rink running north to south: the far net faces you, the near one has
      // its back to you
      if (n[2]) props.push(place(sprite(36, 34, 18, 22, (cc) => netEnd(cc, gy < midY)), gx, gy, gy < midY ? gy : gy + 10));
      else props.push(place(sprite(16, 34, 8, 10, (cc) => net(cc, gx < midX ? 1 : -1)), nx * 16 + 8, ny * 16 + 4, ny * 16 + 30));
    }

    // ---- the office wall along the top ----
    let wallH = 0;
    while (at(0, wallH) === '#') wallH++;
    const WY = wallH * 16;
    lot.roofline = 7;
    c.fillStyle = '#ad5a40'; c.fillRect(0, 0, W * 16, WY);
    // bricks: dark mortar, a few lighter and darker ones
    for (let y = 8, row = 0; y < WY - 5; y += 3.2, row++) {
      c.fillStyle = '#7e3a28'; c.fillRect(0, y, W * 16, 0.5);
      for (let x = (row & 1) * 3.5; x < W * 16; x += 7) {
        c.fillStyle = '#7e3a28'; c.fillRect(x, y, 0.5, 3.2);
        if (rnd() < 0.18) { c.fillStyle = rnd() < 0.5 ? '#96462f' : '#c0684c'; c.fillRect(x + 0.5, y + 0.5, 6.5, 2.7); }
      }
    }
    c.fillStyle = '#7e3a28'; c.fillRect(0, 6, W * 16, 3); // the roof's shadow
    part(c, tone('#8e96a3'), (cc) => cc.rect(-1, WY - 5, W * 16 + 2, 5), null, (cc) => cc.rect(0, WY - 4.4, W * 16, 0.8));
    // the roof edge, snowed on, with icicles
    part(c, tone('#3c404c'), (cc) => cc.rect(-1, -1, W * 16 + 2, 7.4), null, (cc) => cc.rect(0, 4.4, W * 16, 0.8));
    for (let x = 0; x < W * 16; x += 3) snowOn(c, [[x, 1.4 + rnd() * 1.2, 2.2 + rnd() * 1.2]]);
    c.lineWidth = 0.5;
    for (let x = 2; x < W * 16; x += 3 + rnd() * 6) {
      const len = 1.5 + rnd() * 4.5;
      poly(c, [[x - 0.9, 6.4], [x + 0.9, 6.4], [x, 6.4 + len]]); c.fillStyle = '#d4ecfb'; c.fill(); c.strokeStyle = OUT; c.stroke();
    }
    c.lineWidth = OL;
    // the doors, with a canopy and a wreath over them
    const doors = [];
    for (let x = 0; x < W; x++) if (at(x, wallH - 1) === 'X') doors.push(x);
    const d0 = doors[0] * 16, d1 = (doors[doors.length - 1] + 1) * 16;
    const frame = tone('#efe6d2'), glass = { f: '#ffd77a', s: '#eaa84c', h: '#fff2c4' };
    // windows, lit from inside, every few tiles away from the doors
    for (let x = 1.5; x + 2 < W; x += 4) {
      const wx = x * 16;
      if (wx + 32 > d0 - 10 && wx < d1 + 10) continue;
      c.fillStyle = 'rgba(255, 210, 120, 0.2)';
      poly(c, [[wx + 2, WY], [wx + 30, WY], [wx + 36, WY + 14], [wx - 4, WY + 14]]); c.fill();
      part(c, frame, (cc) => rr(cc, wx, 13, 32, 23, 1.2), (cc) => cc.rect(wx + 26, 12, 8, 26));
      part(c, glass, (cc) => cc.rect(wx + 2, 15, 28, 19), (cc) => cc.rect(wx + 2, 27, 28, 8), (cc) => poly(cc, [[wx + 3, 15], [wx + 9, 15], [wx + 3, 23]]));
      c.fillStyle = frame.f; c.fillRect(wx + 15.2, 15, 1.6, 19); c.fillRect(wx + 2, 23.6, 28, 1.4);
      c.strokeStyle = OUT; c.lineWidth = 0.5; c.strokeRect(wx + 15.2, 15, 1.6, 19); c.strokeRect(wx + 2, 23.6, 28, 1.4); c.lineWidth = OL;
      snowOn(c, [[wx + 4, 36, 2], [wx + 10, 35.8, 2.4], [wx + 16, 36, 2.2], [wx + 22, 35.8, 2.4], [wx + 28, 36, 2]]);
    }
    c.fillStyle = 'rgba(255, 220, 150, 0.28)';
    poly(c, [[d0 + 2, WY], [d1 - 2, WY], [d1 + 8, WY + 16], [d0 - 8, WY + 16]]); c.fill();
    part(c, tone('#343c4a'), (cc) => rr(cc, d0 - 2, 16, d1 - d0 + 4, WY - 16, 1));
    for (let x = d0; x < d1; x += 16) {
      part(c, glass, (cc) => rr(cc, x + 1.6, 18, 12.8, WY - 18, 0.6), (cc) => cc.rect(x, 36, 16, 12), (cc) => poly(cc, [[x + 3, 18], [x + 7, 18], [x + 3, 26]]));
      part(c, tone('#c8ccd8'), (cc) => rr(cc, x + (x === d0 ? 10 : 3), 31, 3, 1.4, 0.5));
    }
    part(c, tone('#24408a'), (cc) => rr(cc, d0 - 8, 9, d1 - d0 + 16, 7, 1.5), (cc) => cc.rect(d0 - 8, 13.6, d1 - d0 + 16, 3));
    c.font = '900 5px system-ui, -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.fillText('HAAKON', (d0 + d1) / 2, 12.4);
    snowOn(c, [[d0 - 6, 8.6, 2], [d0 + 2, 8.2, 2.4], [d0 + 12, 8.4, 2.2], [d1 - 12, 8.2, 2.4], [d1 - 2, 8.4, 2.2], [d1 + 6, 8.6, 2]]);
    // garland swags across the canopy, and the wreath
    for (let x = d0 - 8; x < d1 + 8; x += (d1 - d0 + 16) / 4) {
      c.beginPath(); c.moveTo(x, 15.6); c.quadraticCurveTo(x + (d1 - d0 + 16) / 8, 20, x + (d1 - d0 + 16) / 4, 15.6);
      c.strokeStyle = OUT; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = '#2f7a48'; c.lineWidth = 2.2; c.stroke();
    }
    c.lineWidth = OL;
    wreath(c, (d0 + d1) / 2, 25, 4.4);
    // a doormat
    part(c, tone('#8a2a2a'), (cc) => rr(cc, d0 + 2, WY + 1.5, d1 - d0 - 4, 9, 1.4), null, (cc) => cc.rect(d0 + 4, WY + 3, d1 - d0 - 8, 0.8));
    // snow piled along the foot of the wall
    for (let x = 0; x < W * 16; x += 4) {
      if (x > d0 - 14 && x < d1 + 14) continue;
      if (rnd() < 0.6) snowOn(c, [[x, WY - 0.5 + rnd(), 1.8 + rnd() * 1.6]]);
    }

    // ---- everything else standing on the lot ----
    const treeSprites = [0.9, 1.05, 1.2].map((s, i) => sprite(36, 64, 18, 60, (cc) => pine(cc, s, rng(40 + i))));
    const carDone = new Set();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = at(x, y), cx = x * 16 + 8, base = y * 16 + 16;
        if (t === ' ' && y >= wallH) {
          // the woods: a pine on every tile
          c.fillStyle = '#c8d7ea'; ell(c, cx, y * 16 + 13, 10, 3.4); c.fill();
          const s = treeSprites[Math.floor(rnd() * 3)];
          props.push(place(s, cx + (rnd() - 0.5) * 6, base - 2 + (rnd() - 0.5) * 3, base - 2));
        } else if (t === 'c' && !carDone.has(x + ',' + y)) {
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) carDone.add((x + dx) + ',' + (y + dy));
          const rear = y < H / 2, col = CARS[Math.floor(rnd() * CARS.length)], seed = Math.floor(rnd() * 1e6);
          props.push(place(sprite(34, 54, 1, 5, (cc) => car(cc, col, rear, rng(seed))), x * 16, y * 16, y * 16 + 46));
        } else if (t === 'L') {
          props.push(place(sprite(20, 66, 10, 58, lampPost), cx, base - 3, base - 3));
          lanterns.push([cx, base - 3 - 43.5]);
        } else if (t === 'h' && at(x - 1, y) !== 'h' && at(x, y - 1) !== 'h') {
          let h = 0;
          while (at(x, y + h) === 'h') h++;
          props.push(place(sprite(58, 66, 5, 63, cocoaStand), x * 16, (y + h) * 16 - 1, (y + h) * 16 - 1));
          lot.steam = [[x * 16 + 10.3, (y + h) * 16 - 25], [x * 16 + 16.7, (y + h) * 16 - 25], [x * 16 + 23.1, (y + h) * 16 - 25], [x * 16 + 35, (y + h) * 16 - 30]];
        } else if (t === 'b') {
          props.push(place(sprite(20, 26, 2, 24, bench), x * 16, base - 2, base - 2));
        } else if (t === 's') {
          props.push(place(sprite(28, 42, 14, 40, snowman), cx, base - 2, base - 2));
        } else if (t === 'w' && at(x - 1, y) !== 'w') {
          props.push(place(sprite(32, 18, 0, 16, woodpile), x * 16, base - 2, base - 2));
        } else if (t === '*') {
          const seed = Math.floor(rnd() * 1e6);
          props.push(place(sprite(26, 16, 13, 13, (cc) => snowbank(cc, rng(seed))), cx, base - 1, base - 1));
        } else if (t === 'Y') {
          const p = place(sprite(66, 112, 33, 106, (cc) => spruce(cc, rng(77))), cx, base - 2, base - 2);
          const lights = [], r2 = rng(99);
          for (let i = 0; i < 26; i++) {
            const k = r2(), ly = -14 - k * 54, w = (1 - k) * 22 + 2;
            lights.push([cx + (r2() * 2 - 1) * w * 0.8, base - 2 + ly, BULBS[i % BULBS.length]]);
          }
          p.draw = (cc, t2) => {
            cc.globalCompositeOperation = 'lighter';
            lights.forEach(([lx, ly, col], i) => { if ((Math.floor(t2 / 18) + i * 7) % 5) stampGlow(cc, col, lx, ly, 3.6, 0.9); });
            const sy = base - 2 - 81, tw = 0.7 + Math.sin(t2 / 10) * 0.3;
            stampGlow(cc, '#fff2a0', cx, sy, 12 * tw, 0.8);
            cc.globalCompositeOperation = 'source-over';
            star(cc, cx, sy, 4.4);
          };
          props.push(p);
        } else if (t === 'f') {
          props.push(place(sprite(22, 12, 11, 9, firePit), cx, base - 4, base - 3));
          props.push({ base: base - 2.9, draw: (cc, t2) => flames(cc, cx, base - 5, t2) });
          lot.fire = [cx, base - 6];
        }
      }
    // strings of lights between the lamp posts, criss-crossing over the rink
    for (let i = 0; i < lanterns.length; i++)
      for (let j = i + 1; j < lanterns.length; j++)
        if (lanterns[i][0] !== lanterns[j][0]) lot.strings.push([lanterns[i], lanterns[j]]);
    return lot;
  }

  // Draw a prop at its place on the map (the canvas is already in map coordinates).
  function drawProp(c, p, t) {
    if (p.img) c.drawImage(p.img, (p.sx || 0) * K, (p.sy || 0) * K, p.w * K, p.h * K, p.x, p.y, p.w, p.h);
    if (p.draw) p.draw(c, t);
  }

  // What goes over everything: the lamps' glow, the strings of lights, the lights along
  // the roofline and the cocoa steam (in map coordinates), then falling snow and a
  // touch of evening (on the screen). cx, cy is where the view's top-left corner is.
  function overlay(c, lot, t, cx, cy, sw, sh) {
    c.globalCompositeOperation = 'lighter';
    for (const [x, y] of lot.lanterns) {
      stampGlow(c, '#ffd890', x, y, 26, 0.5);
      stampGlow(c, '#ffc870', x, y + 46, 30, 0.12);
    }
    if (lot.fire) stampGlow(c, '#ff9a40', lot.fire[0], lot.fire[1] + 4, 46, 0.18);
    c.globalCompositeOperation = 'source-over';
    // the roofline: a bulb every 8 pixels, swagged from tile to tile
    const bulbs = [];
    c.strokeStyle = OUT; c.lineWidth = 0.5;
    c.beginPath();
    for (let x = Math.floor(cx / 16) * 16; x < cx + sw + 16; x += 16) {
      c.moveTo(x, lot.roofline); c.quadraticCurveTo(x + 8, lot.roofline + 5, x + 16, lot.roofline);
      bulbs.push([x + 4, lot.roofline + 2.2], [x + 12, lot.roofline + 2.2]);
    }
    c.stroke();
    // the strings: a sagging wire with a bulb every 9 pixels
    for (const [a, b] of lot.strings) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), sag = 14 + len * 0.05, n = Math.floor(len / 9);
      const pt = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + sag * 4 * u * (1 - u)];
      c.beginPath(); c.moveTo(a[0], a[1]);
      for (let i = 1; i <= 24; i++) c.lineTo(...pt(i / 24));
      c.stroke();
      for (let i = 1; i < n; i++) bulbs.push(pt(i / n));
    }
    let i = 0;
    c.globalCompositeOperation = 'lighter';
    for (const [x, y] of bulbs) {
      i++;
      if (x < cx - 8 || x > cx + sw + 8 || y < cy - 8 || y > cy + sh + 8) continue;
      const col = BULBS[(Math.floor(x / 8) + Math.floor(y / 9)) % BULBS.length];
      const on = (Math.floor(t / 20) + i * 3) % 7 !== 0;
      stampGlow(c, col, x, y + 0.8, on ? 5 : 2.4, on ? 0.75 : 0.3);
    }
    c.globalCompositeOperation = 'source-over';
    for (const [x, y] of bulbs) {
      if (x < cx - 8 || x > cx + sw + 8 || y < cy - 8 || y > cy + sh + 8) continue;
      c.fillStyle = OUT; ell(c, x, y + 0.8, 1.2, 1.5); c.fill();
      c.fillStyle = BULBS[(Math.floor(x / 8) + Math.floor(y / 9)) % BULBS.length]; ell(c, x, y + 0.8, 0.8, 1.1); c.fill();
      c.fillStyle = '#ffffff'; ell(c, x - 0.3, y + 0.3, 0.3, 0.35); c.fill();
    }
    if (lot.steam)
      for (const [x, y] of lot.steam)
        for (let j = 0; j < 3; j++) {
          const life = (t / 70 + j / 3 + x * 0.013) % 1;
          c.fillStyle = `rgba(255, 255, 255, ${0.4 * (1 - life)})`;
          ell(c, x + Math.sin(life * 6 + x) * 1.2, y - life * 10, 1 + life * 1.6, 1 + life * 1.6); c.fill();
        }
    // snow, in screen space: three layers, the nearer ones bigger, faster and drifting
    // more as you move
    c.save();
    c.setTransform(K, 0, 0, K, 0, 0);
    for (let j = 0; j < 150; j++) {
      const layer = j % 3, par = [0.4, 0.7, 1.15][layer], sp = [0.18, 0.3, 0.5][layer];
      const r0 = Math.sin(j * 127.1) * 43758.5453, r1 = Math.sin(j * 311.7) * 12345.678;
      const fx = (r0 - Math.floor(r0)) * (sw + 20), fy = (r1 - Math.floor(r1)) * (sh + 20);
      const x = (((fx + Math.sin(t / 60 + j) * 6 - cx * par) % (sw + 20)) + sw + 20) % (sw + 20) - 10;
      const y = (((fy + t * sp - cy * par) % (sh + 20)) + sh + 20) % (sh + 20) - 10;
      const r = [0.45, 0.7, 1.1][layer];
      c.fillStyle = layer === 2 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.75)';
      ell(c, x, y, r, r); c.fill();
    }
    // evening coming on: a cool vignette round the edges
    if (!lot.vignette) {
      const [v, vc] = makeCanvas(sw, sh);
      const grad = vc.createRadialGradient(sw / 2, sh / 2, sh * 0.35, sw / 2, sh / 2, sw * 0.7);
      grad.addColorStop(0, 'rgba(40, 50, 110, 0)'); grad.addColorStop(1, 'rgba(40, 50, 110, 0.3)');
      vc.fillStyle = grad; vc.fillRect(0, 0, sw, sh);
      lot.vignette = v;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(lot.vignette, 0, 0);
    c.restore();
  }

  return { K, person, drawPerson, tag, bubble, paintLot, drawProp, overlay };
})();
