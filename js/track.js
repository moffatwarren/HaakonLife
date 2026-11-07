// The racing game's pictures, in the same pixels as the office and the parking lot: a 2-pixel
// outline round everything, the light from the top left, and flat colours with a shade and a
// highlight, painted with js/lot.js's tools (LotArt.kit). Only painted: where the cars are and
// what they're doing is js/race.js's, and js/game.js draws it all (RaceGame and LiveRace).
//
//   const art = TrackArt.paint(RACE.track(i))
//   art.ground          // the whole track, the first time it's needed: the road, its kerbs and
//                       // lines, the grass, the barriers round it and everything past them
//                       // (trees, a lake, the grandstand...), 32 real pixels to a tile
//   art.w, art.h        // how big it is, in the game's pixels (16 to a tile)
//   TrackArt.car(type, colour) // one of RACE.CARS from above, in one of COLOURS, pointing each of
//                       // DIRS ways round (the first down the map, then turning the way the
//                       // angle goes): 64 x 64 real pixels each, its middle in the middle
//   TrackArt.bigCar(type, colour, k) // one of those at twice the size, pointing way k
//   TrackArt.mini(T, k) // the track's road, k of the game's pixels to a tile, for a map
//   TrackArt.DIRS, TrackArt.COLOURS
//
// Places in here are in real pixels, 32 to a tile, and each canvas is marked hi: 2, so it's
// drawn at half that (see js/game.js). Each track looks like its place and season (RACE.TRACKS'
// theme): the lake in summer, the maples in the fall, the snowbelt in winter, the prairie's
// fields in summer, and the yard round Haakon's Kingston plant.
window.TrackArt = (function () {
  const { K, hexInt, mix, noise, smooth, rng, canvas, pen, outline, pic, heap, pine: snowyPine, snowman } = LotArt.kit;
  const { HW, CURB, WALL } = RACE;
  const PX = 32, INK = hexInt(K);
  const DIRS = 48;
  // each car's paint: its colour, a highlight and a shade
  const COLOURS = [['#f0c030', '#f8e078', '#b08414'], ['#d83a30', '#f47a68', '#962018'], ['#3070d8', '#74a4f4', '#1c4494'], ['#38a048', '#7cd47c', '#1f6a30']];

  // ---------- each season's ground ----------
  const I = (h) => hexInt(h);
  const THEMES = {
    lake: {
      grass: [I('#5ca84a'), I('#509c40'), I('#68b456'), I('#7cc464')], dots: [I('#f8f0a0'), I('#f4b0c8')],
      mown: [I('#66b252'), I('#5aa648')], gravel: [I('#d8c690'), I('#c0ac74'), I('#ece0b8')],
      road: [I('#5c5f68'), I('#6a6d77'), I('#4f525a'), I('#56595f')], line: I('#ececf0'),
      water: [I('#3a7ac8'), I('#5c9ae0'), I('#2e66b0')], shore: [I('#e2d098'), I('#c8b47a')],
    },
    maple: {
      grass: [I('#94a644'), I('#86983a'), I('#a2b450'), I('#b0c060')], dots: [I('#d8582a'), I('#e8a030'), I('#c83a28')],
      mown: [I('#9cae4a'), I('#90a242')], gravel: [I('#ccb484'), I('#b49c6c'), I('#e0cca0')],
      road: [I('#5e5f66'), I('#6c6d75'), I('#505158'), I('#57585f')], line: I('#ececf0'),
    },
    snow: {
      grass: [I('#eef2f8'), I('#dce4f0'), I('#f8fafd'), I('#ffffff')], dots: [I('#c8d4e6')],
      gravel: [I('#e6ecf5'), I('#d4dcea'), I('#f4f7fb')],
      road: [I('#c0c8d6'), I('#ccd3df'), I('#b0b8c8'), I('#a8b0c0')], line: 0, ice: I('#d6e6f4'),
      water: [I('#bcd8ee'), I('#dceaf7'), I('#a4c4e2')], shore: [I('#f4f7fb'), I('#d4dcea')],
    },
    prairie: {
      grass: [I('#7cb24a'), I('#70a640'), I('#88bc56'), I('#96c862')], dots: [I('#f8e060'), I('#c8a0e0')],
      mown: [I('#82b84e'), I('#76ac44')], gravel: [I('#d8c690'), I('#c0ac74'), I('#ece0b8')],
      road: [I('#5c5f68'), I('#6a6d77'), I('#4f525a'), I('#56595f')], line: I('#ececf0'), fields: true,
    },
    plant: {
      grass: [I('#a6a69e'), I('#a0a098'), I('#acaca4'), I('#8c8c84')], dots: [I('#6a9a40'), I('#3e3e44')],
      mown: [I('#b2b2aa'), I('#a8a8a0')], gravel: [I('#c8b890'), I('#b0a078'), I('#dccca4')],
      road: [I('#4c4e56'), I('#585a63'), I('#42444b'), I('#484a52')], line: I('#e8c030'), slabs: true,
      kerb: [I('#f0c030'), I('#b08414'), I('#2a2a32'), I('#18181e')],
    },
  };
  // The prairie's fields, FW x FH real pixels each, with a strip of grass between: canola,
  // wheat, pasture or summerfallow, each in rows one way or the other.
  const FW = 320, FH = 256;
  const CROPS = [[I('#f0d028'), I('#d4b01c'), I('#f8e45c')], [I('#dcb464'), I('#c49c4c'), I('#ecc87c')], null, [I('#9a7650'), I('#846242'), I('#aa8660')]];
  function field(x, y) {
    const fx = Math.floor(x / FW), fy = Math.floor(y / FH), ux = x - fx * FW, uy = y - fy * FH;
    if (ux < 6 || uy < 6) return 0;
    const h = noise(fx * 7 + 3, fy * 13 + 5), crop = CROPS[h < 0.38 ? 0 : h < 0.72 ? 1 : h < 0.88 ? 2 : 3];
    if (!crop) return 0;
    const row = noise(fy * 5 + 1, fx * 3 + 2) < 0.5 ? uy : ux, n = noise(x, y);
    if (crop === CROPS[0] && n < 0.04) return I('#8ab030'); // (the green of the canola under its flowers)
    return row % 6 < 2 ? crop[1] : n < 0.08 ? crop[2] : crop[0];
  }
  const KERB = [I('#d83a30'), I('#a82820'), I('#f4f4f4'), I('#c8ccd8')], EDGE = I('#2a2a32'), WHITE = I('#f4f4f4');

  // Whether (x, y), in tiles, is inside the loop of the road: the road's middle as a polygon,
  // a ray to the right crossing it an odd number of times.
  function insideOf(T) {
    const k = 2, cols = T.w * k, rows = T.h * k, inside = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const py = (r + 0.5) / k, xs = [];
      for (let j = 0; j < T.n; j++) {
        const a = j, b = (j + 1) % T.n, ya = T.y[a], yb = T.y[b];
        if ((ya > py) !== (yb > py)) xs.push(T.x[a] + (py - ya) / (yb - ya) * (T.x[b] - T.x[a]));
      }
      xs.sort((p, q) => p - q);
      for (let c = 0; c < cols; c++) {
        const px = (c + 0.5) / k;
        let n = 0;
        while (n < xs.length && xs[n] < px) n++;
        inside[r * cols + c] = n & 1;
      }
    }
    return (x, y) => { const c = Math.floor(x * k), r = Math.floor(y * k); return c >= 0 && r >= 0 && c < cols && r < rows && inside[r * cols + c] === 1; };
  }

  // ---------- things standing round the track ----------
  // (each picture's foot is at the bottom middle of it, where it stands)
  // A pine in summer: tiers of green, the light on the left
  function greenPine(seed) {
    const r = rng(seed), top = 8 - Math.floor(r() * 7), cols = [['#1a4a2a', '#255e36', '#347a44'], ['#1e4e32', '#2a6640', '#3c8450']][seed & 1];
    return pic(40, 68, (p) => {
      p.rect(17, 58, 6, 8, '#4a2c16'); p.rect(18, 58, 2, 8, '#6a4424');
      for (const [t0, b0, w0, w1] of [[top, top + 22, 2, 9], [top + 14, top + 38, 5, 13], [top + 30, 62, 8, 17]]) {
        for (let y = t0; y <= b0; y++) {
          const hw = Math.round(w0 + (w1 - w0) * (y - t0) / (b0 - t0)) + (y % 6 < 2 ? 1 : 0);
          p.rect(20 - hw, y, hw * 2, 1, cols[1]);
          p.rect(20 - hw, y, Math.max(2, hw >> 1), 1, cols[2]);
          p.rect(20 + hw - Math.max(2, hw >> 2), y, Math.max(2, hw >> 2), 1, cols[0]);
          if (y % 6 === 3) p.rect(20 - hw + 3, y, hw * 2 - 6, 1, cols[0]);
        }
        p.rect(20 - w1, b0 + 1, w1 * 2, 2, cols[0]);
      }
    });
  }
  // A round leafy tree (a maple in the fall): a crown of lumps on a trunk
  function leafy(seed, cols) {
    const r = rng(seed), lumps = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + r(); lumps.push([26 + Math.cos(a) * 11, 26 + Math.sin(a) * 9, 9 + r() * 4]); }
    return pic(52, 64, (p) => {
      p.rect(23, 40, 7, 22, '#5a3418'); p.rect(24, 40, 2, 22, '#7a4c28'); p.rect(20, 58, 13, 4, '#5a3418');
      for (const [x, y, s] of lumps) p.oval(x + 1, y + 2, s, s * 0.9, cols[0]);
      p.oval(26, 27, 14, 13, cols[0]);
      for (const [x, y, s] of lumps) p.oval(x, y, s - 1.5, s * 0.9 - 1.5, cols[1]);
      p.oval(25, 25, 12, 11, cols[1]);
      for (const [x, y, s] of lumps) if (x < 28 && y < 28) p.oval(x - 2, y - 2, s * 0.45, s * 0.4, cols[2]);
      p.oval(20, 18, 5, 4, cols[2]);
    });
  }
  const MAPLES = [['#a03018', '#d0502a', '#f08a48'], ['#b02a20', '#d83a2c', '#f07058'], ['#b07818', '#e0a830', '#f8d060'], ['#2a6a34', '#3f8a4a', '#68b056']];
  // a boulder: pink granite, the Canadian Shield poking through
  function rock(seed) {
    const r = rng(seed), w = 18 + Math.floor(r() * 10), h = 12 + Math.floor(r() * 5), col = r() < 0.5 ? ['#7a6a68', '#a89490', '#ccbcb4'] : ['#6a7078', '#9098a2', '#bcc4cc'];
    return pic(w + 8, h + 8, (p) => {
      const cx = (w + 8) / 2, cy = (h + 8) / 2;
      p.oval(cx, cy + 1, w / 2, h / 2, col[0]);
      p.oval(cx - 1, cy - 1, w / 2 - 2, h / 2 - 2, col[1]);
      p.oval(cx - w * 0.16, cy - h * 0.18, w * 0.2, h * 0.16, col[2]);
    });
  }
  // A log cabin: the logs, a door, a window with a light on, a shingled roof and a stone chimney
  // (snow on the roof in winter)
  function cabin(seed, snowy) {
    const r = rng(seed), roof = ['#7a3020', '#5a4a3a', '#3a4a5a'][Math.floor(r() * 3)];
    return pic(84, 76, (p) => {
      p.rect(60, 6, 10, 24, '#7a7a80'); p.rect(61, 6, 3, 24, '#a0a0a8'); for (let y = 9; y < 30; y += 5) p.rect(60, y, 10, 1, '#5a5a60');
      for (let y = 40; y < 74; y += 6) { p.rect(6, y, 72, 6, '#8a5a30'); p.rect(6, y, 72, 1, '#a87444'); p.rect(6, y + 5, 72, 1, '#6a4020'); }
      p.rect(14, 50, 16, 24, '#4a2a14'); p.rect(15, 51, 3, 22, '#6a4020'); p.rect(26, 62, 2, 2, '#f0c030');
      p.rect(44, 48, 24, 16, '#3a2414'); p.rect(46, 50, 20, 12, '#f8d870'); p.rect(55, 50, 2, 12, '#3a2414'); p.rect(46, 55, 20, 2, '#3a2414'); p.rect(47, 51, 4, 3, '#fff4c0');
      for (let y = 18; y < 42; y++) {
        const hw = 30 + Math.floor((y - 18) * 0.5);
        p.rect(42 - hw, y, hw * 2, 1, y % 4 === 0 ? mix(roof, '#000000', 0.25) : roof);
        p.rect(42 - hw, y, 8, 1, mix(roof, '#ffffff', 0.25));
      }
      p.rect(10, 42, 64, 2, mix(roof, '#000000', 0.4));
      if (snowy) { heap(p, 42, 22, 64, 10); p.rect(12, 40, 60, 2, '#f4f7fc'); }
    });
  }
  // A red barn with white trim, its big doors crossed
  function barn() {
    return pic(124, 112, (p) => {
      for (let y = 8; y < 44; y++) { const hw = y < 24 ? 26 + (y - 8) * 1.4 : 48 + (y - 24) * 0.35; p.rect(62 - hw, y, hw * 2, 1, y % 5 === 0 ? '#4a3a3a' : '#5e4a48'); p.rect(62 - hw, y, 6, 1, '#7a6260'); }
      p.rect(10, 44, 104, 66, '#b83028'); for (let x = 14; x < 112; x += 8) p.rect(x, 44, 1, 66, '#982018'); p.rect(10, 44, 4, 66, '#d85040');
      p.rect(10, 44, 104, 4, '#f4f4f4'); p.rect(10, 106, 104, 4, '#f4f4f4');
      p.rect(40, 62, 44, 48, '#f4f4f4'); p.rect(44, 66, 36, 44, '#982018');
      for (let i = 0; i < 36; i++) { p.rect(44 + i, 66 + i * 44 / 36, 3, 3, '#f4f4f4'); p.rect(77 - i, 66 + i * 44 / 36, 3, 3, '#f4f4f4'); }
      p.rect(61, 66, 2, 44, '#f4f4f4');
      p.rect(52, 22, 20, 16, '#f4f4f4'); p.rect(55, 25, 14, 10, '#3a2414'); p.rect(61, 25, 2, 10, '#f4f4f4');
    });
  }
  // a round hay bale, sitting on its end: the spiral of straw on top, its side in shade
  function bale(seed) {
    const r = rng(seed);
    return pic(30, 30, (p) => {
      p.round(3, 10, 24, 17, 4, '#b89838'); p.rect(3, 14, 24, 1, '#a08028'); p.rect(3, 20, 24, 1, '#a08028');
      p.rect(5, 12, 4, 13, '#d8b850');
      p.oval(15, 11, 12, 7, '#e8c860'); p.oval(15, 11, 8, 4.5, '#d4b048'); p.oval(15, 11, 4, 2, '#e8c860'); p.rect(14, 10, 2, 1, '#b89838');
      p.oval(10 + r() * 2, 8, 3, 1.5, '#f8e090');
    });
  }
  // A grandstand along the start straight: a front wall with the name on it, rows of people
  // in their seats and a striped roof over them
  function grandstand(w, seed) {
    const r = rng(seed), SHIRTS = ['#d83a30', '#3070d8', '#f0c030', '#38a048', '#f4f4f4', '#8a4ab8', '#f08020', '#2a2a32'], SKIN = ['#f8d0a8', '#e0b088', '#b07850', '#8a5a38'];
    return pic(w, 116, (p) => {
      p.rect(4, 4, w - 8, 10, '#d83a30');
      for (let x = 4; x < w - 4; x += 16) p.rect(x, 4, 8, 10, '#f4f4f4');
      p.rect(4, 14, w - 8, 4, '#3a3a44');
      p.rect(8, 18, 4, 76, '#6a6a74'); p.rect(w - 12, 18, 4, 76, '#6a6a74');
      for (let row = 0; row < 4; row++) {
        const y = 22 + row * 18;
        p.rect(12, y + 10, w - 24, 8, '#9098a2'); p.rect(12, y + 10, w - 24, 2, '#b8c0c8'); p.rect(12, y + 16, w - 24, 2, '#6a7078');
        for (let x = 16 + (row & 1) * 6; x < w - 22; x += 12) {
          if (r() < 0.18) continue;
          const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)], skin = SKIN[Math.floor(r() * SKIN.length)];
          p.rect(x, y + 4, 8, 8, shirt); p.rect(x, y + 4, 2, 8, mix(shirt, '#ffffff', 0.3));
          p.rect(x + 1, y - 2, 6, 6, skin);
          if (r() < 0.4) p.rect(x + 1, y - 3, 6, 2, ['#5a3420', '#2a2a32', '#c8a050', '#d83a30'][Math.floor(r() * 4)]); // (a toque, or hair)
          if (r() < 0.12) { p.rect(x - 2, y - 6, 2, 8, skin); } // (cheering)
        }
      }
      p.rect(4, 94, w - 8, 18, '#f4f4f4'); p.rect(4, 94, w - 8, 3, '#ffffff'); p.rect(4, 108, w - 8, 4, '#c8ccd8');
      const name = 'HAAKON GRAND PRIX', at = Math.floor((w - name.length * 12) / 2);
      p.word(name, at, 98, '#3050a8', 2);
    });
  }
  // a canoe out on the lake, from above
  function canoe(col) {
    return pic(48, 16, (p) => {
      for (let x = 0; x < 40; x++) { const hw = Math.round(Math.sin(x / 39 * Math.PI) * 5); p.rect(4 + x, 8 - hw, 1, hw * 2, col); }
      for (let x = 4; x < 36; x++) { const hw = Math.round(Math.sin(x / 39 * Math.PI) * 5) - 2; if (hw > 0) p.rect(4 + x, 8 - hw, 1, hw * 2, '#a87444'); }
      p.rect(16, 4, 2, 8, '#6a4020'); p.rect(30, 4, 2, 8, '#6a4020'); p.rect(22, 6, 4, 4, '#f0c030');
    });
  }

  // ---- out on the prairie ----
  // A wooden grain elevator, the tallest thing for miles: its name up top, a peaked roof, the
  // head house on top of that, and an office shed at its foot
  function elevator() {
    return pic(92, 168, (p) => {
      const red = '#b0402c', lo = '#8a2c1c', hi = '#cc5a40';
      p.rect(6, 128, 22, 36, '#e8e0cc'); p.rect(6, 128, 22, 2, '#ffffff'); p.rect(10, 140, 7, 24, '#6a4a2a'); p.rect(19, 138, 6, 6, '#3a5478');
      for (let y = 120; y < 128; y++) p.rect(4, y, 26, 1, y % 3 ? '#5a5a62' : '#4a4a52');
      p.rect(22, 58, 56, 104, red);
      for (let x = 24; x < 78; x += 4) p.rect(x, 58, 1, 104, lo);
      p.rect(22, 58, 3, 104, hi); p.rect(70, 58, 8, 104, lo);
      p.rect(26, 66, 44, 12, '#f4f0e4'); p.word('HAAKON', 30, 68, red, 1);
      p.rect(20, 160, 60, 6, '#8a8a90'); p.rect(20, 160, 60, 1, '#b0b0b8');
      for (let y = 40; y < 58; y++) { const hw = 14 + (y - 40) * 1.1; p.rect(50 - hw, y, hw * 2, 1, y % 4 === 0 ? '#4a4a52' : '#62626c'); p.rect(50 - hw, y, 4, 1, '#84848e'); }
      p.rect(36, 16, 28, 26, red); for (let x = 38; x < 64; x += 4) p.rect(x, 16, 1, 26, lo); p.rect(36, 16, 2, 26, hi); p.rect(58, 16, 6, 26, lo);
      p.rect(44, 24, 10, 8, '#3a5478'); p.rect(45, 25, 3, 3, '#7aa0c8');
      for (let y = 4; y < 18; y++) { const hw = 6 + (y - 4) * 0.9; p.rect(50 - hw, y, hw * 2, 1, y % 4 === 0 ? '#4a4a52' : '#62626c'); }
    });
  }
  // a row of corrugated steel grain bins, their cones of roof shining
  function bins(seed) {
    const r = rng(seed), n = 2 + Math.floor(r() * 2);
    return pic(14 + n * 34, 80, (p) => {
      for (let i = 0; i < n; i++) {
        const x = 8 + i * 34, h = 40 + Math.floor(r() * 10), top = 74 - h;
        for (let y = top; y < 74; y++) { p.rect(x, y, 30, 1, y % 4 < 2 ? '#c4c8d0' : '#a8aeb8'); p.rect(x, y, 5, 1, '#e4e8ee'); p.rect(x + 24, y, 6, 1, '#8a909c'); }
        for (let y = top - 14; y < top; y++) { const hw = Math.round(2 + (y - top + 14) * 1.0); p.rect(x + 15 - hw, y, hw * 2, 1, '#b8bec8'); p.rect(x + 15 - hw, y, Math.max(2, hw >> 1), 1, '#eef0f4'); }
        p.rect(x + 12, top - 17, 6, 4, '#9aa0aa'); p.rect(x + 4, 66, 8, 8, '#5a5e68');
      }
    });
  }
  // a white farmhouse with a green roof and a porch
  function farmhouse() {
    return pic(84, 82, (p) => {
      for (let y = 46; y < 80; y += 4) { p.rect(8, y, 68, 4, '#ecece6'); p.rect(8, y + 3, 68, 1, '#c8c8c0'); }
      p.rect(8, 46, 3, 34, '#ffffff');
      p.rect(16, 54, 12, 12, '#3a5478'); p.rect(17, 55, 4, 4, '#7aa0c8'); p.rect(56, 54, 12, 12, '#3a5478'); p.rect(57, 55, 4, 4, '#7aa0c8');
      p.rect(36, 60, 12, 20, '#7a3a24'); p.rect(37, 61, 3, 18, '#9a5234');
      p.rect(28, 56, 28, 3, '#5a7a4a'); p.rect(30, 59, 2, 21, '#e0e0d8'); p.rect(52, 59, 2, 21, '#e0e0d8');
      for (let y = 12; y < 46; y++) {
        const hw = 18 + Math.floor((y - 12) * 0.75);
        p.rect(42 - hw, y, hw * 2, 1, y % 4 === 0 ? '#2e5a36' : '#3a6e42');
        p.rect(42 - hw, y, 6, 1, '#5a8e5e');
      }
      p.rect(56, 4, 8, 16, '#8a4a34'); p.rect(56, 4, 2, 16, '#a8644a');
    });
  }
  // a square bale of straw, its twine round it
  function squareBale(seed) {
    const r = rng(seed), hue = r() < 0.5 ? ['#d8b850', '#c4a040', '#ecd078'] : ['#ccac48', '#b8963a', '#e2c46c'];
    return pic(30, 24, (p) => {
      p.rect(3, 9, 24, 12, hue[0]); p.rect(3, 9, 3, 12, hue[2]); p.rect(3, 18, 24, 3, hue[1]);
      p.rect(3, 3, 24, 7, hue[2]); p.rect(3, 3, 24, 1, '#f8e8a8');
      for (const x of [10, 19]) { p.rect(x, 3, 1, 18, '#8a6a2a'); }
      p.rect(8 + Math.floor(r() * 10), 12, 3, 1, hue[1]);
    });
  }
  // A shelterbelt tree in its summer green
  const GREENS = [['#2a6a34', '#3f8a4a', '#68b056'], ['#3a6e28', '#58943a', '#84b85a']];

  // ---- the Kingston plant's yard ----
  // The plant: steel siding, the loading dock's doors, units on the roof, and its sign
  function plantBuilding() {
    return pic(300, 156, (p) => {
      p.rect(8, 26, 284, 14, '#8a8e98'); p.rect(8, 26, 284, 2, '#b0b4be');
      for (const x of [40, 120, 210]) { p.rect(x, 12, 30, 16, '#d8dad4'); p.rect(x, 12, 30, 3, '#f0f0ec'); p.rect(x + 8, 16, 12, 10, '#5a5e68'); }
      p.rect(8, 40, 284, 112, '#9cb0c4');
      for (let x = 10; x < 292; x += 6) p.rect(x, 40, 2, 112, '#8aa0b6');
      p.rect(8, 40, 4, 112, '#bccce0'); p.rect(8, 146, 284, 6, '#6a7480');
      // the office end, with its windows
      p.rect(8, 40, 70, 112, '#d8dcd8'); p.rect(8, 40, 4, 112, '#f0f2f0');
      for (const x of [18, 46]) for (const y of [56, 96]) { p.rect(x, y, 22, 22, '#3a5478'); p.rect(x + 2, y + 2, 6, 6, '#7aa0c8'); }
      p.rect(30, 124, 18, 28, '#3a5478'); p.rect(31, 125, 5, 26, '#7aa0c8');
      // the sign
      p.rect(96, 48, 96, 26, '#2a54a8'); p.rect(96, 48, 96, 3, '#4a78d0'); p.word('HAAKON', 108, 54, '#ffffff', 2);
      // the loading dock's doors, and bumpers under them
      for (const x of [96, 150, 204, 250]) {
        p.rect(x, 86, 38, 60, '#c8ccd4');
        for (let y = 88; y < 146; y += 4) p.rect(x, y, 38, 1, '#a4a8b2');
        p.rect(x, 86, 38, 3, '#5a5e68'); p.rect(x + 4, 140, 6, 8, '#2a2a32'); p.rect(x + 28, 140, 6, 8, '#2a2a32');
      }
    });
  }
  // An air handling unit on its skid, ready to go out: its panels and doors, a coil section
  // with its grille, and the blue Haakon stripe
  function ahu(seed) {
    const r = rng(seed), w = 64 + Math.floor(r() * 4) * 10, h = 44 + Math.floor(r() * 3) * 6, top = 14;
    const cv = pic(w + 8, h + top + 10, (p) => {
      p.rect(4, top + h + 2, w, 6, '#4a4a52'); p.rect(4, top + h + 2, w, 1, '#6a6a74');
      p.rect(4, 4, w, top, '#ecece6'); p.rect(4, 4, w, 2, '#ffffff');
      for (let x = 4 + 18; x < 4 + w; x += 18) p.rect(x, 4, 1, top, '#c8c8c2');
      p.rect(4, 4 + top, w, h - 2, '#d4d6d0'); p.rect(4, 4 + top, 3, h - 2, '#eeeeea'); p.rect(4 + w - 3, 4 + top, 3, h - 2, '#b0b2ac');
      const doors = Math.floor(w / 26);
      for (let i = 0; i < doors; i++) {
        const x = 8 + i * Math.floor((w - 8) / doors), dw = Math.floor((w - 8) / doors) - 4;
        p.rect(x, top + 8, dw, h - 12, '#c4c6c0'); p.rect(x, top + 8, dw, 1, '#e8e8e4'); p.rect(x + dw - 4, top + 8 + (h - 12) / 2 - 3, 2, 6, '#3a3a42');
        if (i === doors - 1 && r() < 0.7) for (let y = top + 12; y < top + h - 6; y += 3) p.rect(x + 3, y, dw - 10, 1, '#8a8c88');
      }
      p.rect(4, top + 6, w, 3, '#2a54a8');
    });
    cv.rad = (w + 8) / PX * 0.55;
    return cv;
  }
  // a shipping container, side on: its ribs, the doors at one end
  function container(col) {
    const cv = pic(104, 56, (p) => {
      const lo = mix(col, '#000000', 0.25), hi = mix(col, '#ffffff', 0.25);
      p.rect(4, 4, 96, 12, hi); p.rect(4, 4, 96, 2, mix(col, '#ffffff', 0.45));
      p.rect(4, 16, 96, 36, col);
      for (let x = 8; x < 96; x += 5) p.rect(x, 16, 2, 36, lo);
      p.rect(4, 16, 3, 36, hi); p.rect(80, 16, 1, 36, '#1e1e24'); for (const x of [86, 92]) p.rect(x, 18, 1, 32, '#3a3a42');
      p.rect(4, 48, 96, 4, lo);
    });
    cv.rad = 104 / PX * 0.55;
    return cv;
  }
  function cone() {
    return pic(16, 22, (p) => {
      p.rect(1, 17, 14, 4, '#e86020'); p.rect(1, 17, 14, 1, '#f88848');
      for (let y = 2; y < 17; y++) { const hw = 1 + Math.round((y - 2) * 0.38); p.rect(8 - hw, y, hw * 2, 1, y > 7 && y < 11 ? '#f4f4f4' : '#f07028'); p.rect(8 - hw, y, 1, 1, '#f8a070'); }
    });
  }
  function drum(seed) {
    const col = ['#2a5ab0', '#2a7a3c', '#b8382c'][seed % 3];
    return pic(20, 26, (p) => {
      p.rect(2, 6, 16, 18, col); p.rect(2, 6, 4, 18, mix(col, '#ffffff', 0.3)); p.rect(14, 6, 4, 18, mix(col, '#000000', 0.25));
      p.rect(2, 11, 16, 1, mix(col, '#000000', 0.35)); p.rect(2, 18, 16, 1, mix(col, '#000000', 0.35));
      p.oval(10, 6, 8, 3, mix(col, '#ffffff', 0.15)); p.oval(13, 5, 2, 1, '#2a2a32');
    });
  }
  function pallet(seed) {
    const r = rng(seed);
    return pic(34, 30, (p) => {
      p.rect(2, 22, 30, 6, '#a07848'); p.rect(2, 22, 30, 1, '#c09868'); for (const x of [4, 15, 26]) p.rect(x, 25, 4, 3, '#6a4a28');
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { const y = 12 - i * 9; p.rect(4, y, 26, 10, '#c89a5c'); p.rect(4, y, 26, 2, '#e0b878'); p.rect(15, y, 4, 10, '#e8d8b0'); }
    });
  }
  // a concrete barrier, plain or striped
  function jersey(i) {
    return pic(26, 24, (p) => {
      p.rect(2, 16, 22, 6, '#8a8a90'); p.rect(4, 8, 18, 9, '#b4b4b8'); p.rect(4, 4, 18, 5, '#d8d8dc'); p.rect(4, 4, 18, 1, '#f0f0f2');
      if (i % 2) for (let k = 0; k < 4; k++) p.rect(5 + k * 5, 10, 3, 6, '#f0c030');
    });
  }

  // The barriers, a picture every so often along each side: a stack of tyres in red or white
  // round the lake, round hay bales in the fall, and a bank of snow in winter.
  function tyres(i) {
    const band = i % 2 ? '#f0f0f0' : '#d83a30';
    return pic(26, 28, (p) => {
      p.round(3, 10, 20, 15, 3, '#2e2e36'); p.rect(3, 14, 20, 2, band); p.rect(3, 19, 20, 2, band); p.rect(5, 12, 2, 11, '#4a4a56');
      p.oval(13, 10, 10, 6, '#3a3a44'); p.oval(13, 10, 7, 4, band); p.oval(13, 10, 4, 2, '#141418'); p.rect(7, 7, 4, 1, '#6a6a76');
    });
  }
  const BARRIER = {
    lake: { gap: 15, pics: [tyres(0), tyres(1)], pick: (i) => (i >> 1) & 1 },
    maple: { gap: 17, pics: [bale(1), bale(2), bale(3)], pick: (i) => i % 3 },
    prairie: { gap: 15, pics: [squareBale(1), squareBale(2), squareBale(3)], pick: (i) => (i * 7) % 3 },
    plant: { gap: 13, pics: [jersey(0), jersey(1)], pick: (i) => (i >> 1) & 1 },
    snow: { gap: 12, pics: [0, 1, 2, 3].map((k) => { const r = rng(k + 40), w = 22 + Math.floor(r() * 8), h = 13 + Math.floor(r() * 5); return pic(w + 10, h + 12, (p) => heap(p, (w + 10) >> 1, (h + 12) >> 1, w, h)); }), pick: (i) => i % 4 },
  };

  // ---------- the whole track ----------
  const painted = new Map();
  function paint(T) {
    if (painted.has(T.i)) return painted.get(T.i);
    const th = THEMES[T.theme] || THEMES.lake, PW = T.w * PX, PH = T.h * PX, cs = PX / T.cell;
    const cv = canvas(PW, PH), c = cv.getContext('2d'), img = c.createImageData(PW, PH), px = new Uint32Array(img.data.buffer);
    const inside = insideOf(T), cols = T.cols, rows = T.rows, near = T.near, dist = T.dist;
    const D = (cc, rr) => (cc < 0 || rr < 0 || cc >= cols || rr >= rows ? 1e9 : dist[rr * cols + cc]);
    const dAt = (x, y) => { // how far (x, y) is from the middle of the road (tiles), or far
      const gx = x * T.cell - 0.5, gy = y * T.cell - 0.5, c0 = Math.floor(gx), r0 = Math.floor(gy), fx = gx - c0, fy = gy - r0;
      const a = D(c0, r0), b = D(c0 + 1, r0), e = D(c0, r0 + 1), f = D(c0 + 1, r0 + 1);
      return (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
    };
    const r = rng(T.i * 977 + 13), props = [];
    // nothing tall in front of the road: a picture standing at (x, y) mustn't reach up over it
    const clear = (x, y, im) => {
      const w = im.width / PX, h = im.height / PX;
      for (let yy = y - h; yy <= y; yy += 0.25) for (let xx = x - w / 2; xx <= x + w / 2; xx += 0.25) if (dAt(xx, yy) < WALL + 0.8) return false;
      return true;
    };
    const place = (x, y, im, rad) => { props.push({ x, y, im, rad }); };
    // The grandstand, behind the barrier above a straight: the start's if there's room, or the
    // nearest one round the track that has some. (First, so the lake keeps out of its way.)
    const standW = 14, stand = grandstand(standW * PX, T.i), standH = stand.height / PX;
    let sx = 0, sy = -99;
    for (let k = 0; k < 120; k++) {
      const along = (k & 1 ? -1 : 1) * Math.ceil(k / 2) * 2, at = T.at(along, 0), across = Math.abs(Math.sin(at.ang));
      if (across < 0.995 || Math.abs(T.at(along - 6, 0).ang - at.ang) > 0.05 || Math.abs(T.at(along + 6, 0).ang - at.ang) > 0.05) continue;
      const x = at.x, y = at.y - WALL - 1.1;
      if (y - standH < 0.2 || x - standW / 2 < 0.2 || x + standW / 2 > T.w - 0.2 || !clear(x, y, stand)) continue;
      sx = x; sy = y; place(x, y, stand, standW * 0.55);
      break;
    }
    const byStand = (x, y) => Math.hypot(Math.max(0, Math.abs(x - sx) - standW / 2), Math.max(0, sy - standH - y, y - sy)) < 1.2 + smooth(x / 3, y / 3);
    // the lake (or the frozen pond) fills the middle of the loop, well clear of the road
    const wet = th.water ? (x, y, d) => inside(x, y) && d > WALL + 2.4 + smooth(x / 4, y / 4) * 1.6 && !byStand(x, y) : () => false;
    const grid = []; // where each car starts, for the boxes painted on the road
    for (let i = 0; i < 4; i++) grid.push([-(2.2 + i * 1.7), i % 2 ? -1 : 1]);
    const ground = (x, y) => {
      if (th.fields) { const f = field(x, y); if (f) return f; }
      const n = noise(x, y), g = th.grass;
      if (th.slabs && (x % 64 === 0 || y % 64 === 0)) return n < 0.1 ? th.dots[0] : g[3]; // (the joints between the slabs, and weeds in them)
      if (n < 0.004 && th.dots) return th.dots[Math.floor(noise(y, x) * th.dots.length)];
      if (n < 0.03) return g[3];
      const v = smooth(x / 70, y / 50);
      return v > 0.64 ? g[2] : v < 0.36 ? g[1] : g[0];
    };
    for (let y = 0; y < PH; y++) {
      const ty = (y + 0.5) / PX;
      for (let x = 0; x < PW; x++) {
        const tx = (x + 0.5) / PX, dd = dAt(tx, ty);
        let col;
        if (dd > WALL + 0.7) {
          col = ground(x, y);
          if (wet(tx, ty, dd)) {
            const w = th.water;
            col = !wet(tx - 0.14, ty - 0.2, dAt(tx - 0.14, ty - 0.2)) ? w[2] : noise(x >> 2, y >> 1) < 0.025 ? w[1] : w[0];
          } else if (th.water && wet(tx, ty, dd + 0.45)) col = noise(x, y) < 0.2 ? th.shore[1] : th.shore[0];
        } else {
          const q = Math.min(rows - 1, Math.max(0, Math.round(ty * T.cell - 0.5))) * cols + Math.min(cols - 1, Math.max(0, Math.round(tx * T.cell - 0.5)));
          const j = near[q];
          if (j < 0) { px[y * PW + x] = ground(x, y); continue; }
          const vx = tx - T.x[j], vy = ty - T.y[j], side = vx * T.nx[j] + vy * T.ny[j], d = side >= 0 ? dd : -dd, a = dd;
          let s = T.s[j] + vx * T.tx[j] + vy * T.ty[j];
          if (s > T.len / 2) s -= T.len;
          const kerb = T.curb[j], edge = kerb ? HW + CURB : HW;
          if (a <= HW) {
            const r = th.road, n = noise(x, y);
            col = n < 0.05 ? r[2] : n < 0.09 ? r[1] : r[0];
            if (th.ice && smooth(x / 90, y / 40) > 0.72) col = th.ice;
            if (!th.line && (Math.abs(Math.abs(d) - 1.2) < 0.22)) col = r[3]; // (the ruts in the snow)
            if (th.line && a > HW - 0.17 && a < HW - 0.05) col = th.line;
            if (th.line && Math.abs(d - T.line[j]) < 0.5 && n > 0.5) col = r[3]; // (rubber laid down on the line)
            // the chequered line, and the boxes on the grid
            if (Math.abs(s) < 0.28 && a < HW - 0.05) col = ((Math.floor((s + 1) / 0.28) + Math.floor((d + 9) / 0.28)) & 1) ? WHITE : INK;
            for (const [gs, gd] of grid) {
              const fs = s - (gs + 0.6), fd = Math.abs(d - gd);
              if ((fs > -0.06 && fs < 0.06 && fd < 0.46) || (fd > 0.4 && fd < 0.47 && fs > -0.7 && fs < 0.06)) col = WHITE;
            }
          } else if (a <= edge) {
            const stripe = Math.floor((s + 90) / 0.9) & 1, outer = a > HW + CURB * 0.62;
            col = (th.kerb || KERB)[stripe * 2 + (outer ? 1 : 0)];
          } else if (a <= edge + 0.07) col = EDGE;
          else if (a < WALL + 0.7) {
            // the runoff: mown, or gravel on the outside of the tight bends
            if (T.sharp[j] > 0.1 && d * T.k[j] < 0 && a > edge + 0.25 && a < WALL - 0.3) {
              const n = noise(x, y), gv = th.gravel;
              col = n < 0.12 ? gv[1] : n > 0.92 ? gv[2] : gv[0];
            } else col = th.mown ? th.mown[Math.floor((s + 90) / 1.6) & 1] : ground(x, y);
            if (a > WALL - 0.05) col = mixInt(col, INK, 0.35); // (in the barrier's shadow)
          } else col = ground(x, y);
        }
        px[y * PW + x] = col;
      }
    }
    c.putImageData(img, 0, 0);

    // ---- what stands round it ----
    const free = (x, y, rad) => { // (in tiles: clear of the road, the water and everything else)
      const dd = dAt(x, y);
      if (dd < WALL + 0.9 + rad || wet(x, y, dd) || (th.water && wet(x, y, dd + 0.6)) || x < 0.5 || y < 1 || x > T.w - 0.5 || y > T.h - 0.2) return false;
      return props.every((o) => Math.hypot(o.x - x, (o.y - y) * 1.3) > o.rad + rad);
    };
    // the big things, somewhere with room
    const BIG = { maple: () => [barn(), cabin(3)], snow: () => [cabin(1, true), cabin(2, true), cabin(5, true)], prairie: () => [elevator(), bins(1), farmhouse(), bins(2)],
      plant: () => [plantBuilding(), container('#b8382c'), container('#2e5ea8'), ahu(9)] };
    const big = (BIG[T.theme] || (() => [cabin(1), cabin(4)]))();
    for (const im of big) for (let k = 0; k < 400; k++) {
      const x = 4 + r() * (T.w - 8), y = 6 + r() * (T.h - 8), rad = im.width / PX * 0.6;
      if (free(x, y, rad) && free(x, y - 1.5, rad) && clear(x, y, im)) { place(x, y, im, rad); break; }
    }
    // the trees, thickest where the woods are, and a few things scattered between
    // (on the prairie the trees are shelterbelts along the edges of the fields, and at the plant
    // they're the units and containers waiting in the yard, in stacks here and there)
    const trees = T.theme === 'maple' ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => leafy(k + 1, MAPLES[k % 4]))
      : T.theme === 'snow' ? [1, 2, 3, 4, 5, 6].map((k) => snowyPine(k * 7 + 3))
        : T.theme === 'prairie' ? [1, 2, 3, 4, 5, 6].map((k) => leafy(k + 20, GREENS[k & 1]))
          : T.theme === 'plant' ? [ahu(1), ahu(2), ahu(3), ahu(4), ahu(5), container('#3a7a44'), container('#d87a28'), container('#b8382c')]
            : [1, 2, 3, 4, 5, 6].map((k) => greenPine(k)).concat([leafy(11, MAPLES[3]), leafy(12, MAPLES[3])]);
    const bits = T.theme === 'maple' ? [bale(4), bale(5), bale(6)] : T.theme === 'snow' ? [snowman()] : T.theme === 'prairie' ? [squareBale(4), squareBale(5), rock(2), rock(3)]
      : T.theme === 'plant' ? [cone(), cone(), drum(0), drum(1), drum(2), pallet(1), pallet(2), pallet(3)] : [rock(1), rock(2), rock(3), rock(4)];
    const often = { snow: 0.012, prairie: 0.025, plant: 0.05 }[T.theme] || 0.06;
    const wooded = T.theme === 'prairie' ? (x, y, woods) => ((x * PX) % FW < 28 || (y * PX) % FH < 28) && woods > 0.36
      : T.theme === 'plant' ? (x, y, woods) => woods > 0.6 || r() < 0.006 : (x, y, woods) => woods > 0.42 || r() < 0.08;
    for (let k = 0; k < 2600; k++) {
      const x = r() * T.w, y = 1.5 + r() * (T.h - 1.5), woods = smooth(x / 7 + T.i * 5, y / 7);
      if (r() < often) {
        const im = bits[Math.floor(r() * bits.length)];
        if (free(x, y, 0.6) && clear(x, y, im)) place(x, y, im, 0.6);
      } else if (wooded(x, y, woods)) {
        const im = trees[Math.floor(r() * trees.length)], rad = im.rad || 0.62;
        if (free(x, y, rad) && clear(x, y, im)) place(x, y, im, rad);
      }
    }
    // boats on the lake
    if (T.theme === 'lake') for (const col of ['#d83a30', '#38a048']) for (let k = 0; k < 300; k++) {
      const x = r() * T.w, y = r() * T.h;
      if (wet(x, y, dAt(x, y)) && wet(x - 1, y, dAt(x - 1, y)) && wet(x + 1, y, dAt(x + 1, y)) && wet(x, y - 0.6, dAt(x, y - 0.6))) { props.push({ x, y: y + 0.25, im: canoe(col), rad: 0, flat: true }); break; }
    }
    // the barriers, along each side, stood in the order they come down the screen
    const bar = BARRIER[T.theme] || BARRIER.lake, stamps = [];
    for (const sg of [1, -1]) {
      let run = 0, lx = null, ly = null, n = 0;
      for (let j = 0; j <= T.n * 4; j++) {
        const s = j / 4 * T.step, at = T.at(s, sg * (WALL + 0.32));
        if (lx !== null) run += Math.hypot(at.x - lx, at.y - ly) * PX;
        lx = at.x; ly = at.y;
        if (run < bar.gap) continue;
        run = 0;
        if (dAt(at.x, at.y) < WALL + 0.12) continue; // (on the inside of a tight bend, there's no barrier: it's all grass)
        if (stamps.some((o) => Math.abs(o.x - at.x) < 0.3 && Math.abs(o.y - at.y) < 0.3)) continue;
        stamps.push({ x: at.x, y: at.y, im: bar.pics[bar.pick(n++)] });
      }
    }
    // the shadows, then everything, the furthest up the screen first
    for (const o of props.concat(stamps)) {
      if (o.flat) continue;
      c.fillStyle = 'rgba(20, 30, 20, 0.22)'; c.beginPath();
      c.ellipse(o.x * PX + 6, o.y * PX - 2, o.im.width * 0.42, Math.min(14, o.im.height * 0.16), 0, 0, Math.PI * 2); c.fill();
    }
    for (const o of stamps.concat(props).sort((a, b) => a.y - b.y)) c.drawImage(o.im, Math.round(o.x * PX - o.im.width / 2), Math.round(o.y * PX - o.im.height + (o.flat ? o.im.height / 2 : 4)));
    const out = { ground: cv, w: T.w * 16, h: T.h * 16 };
    painted.clear(); // (one track at a time: they're big)
    painted.set(T.i, out);
    return out;
  }
  function mixInt(a, b, t) {
    const ch = (v, s) => (v >>> s) & 255, m = (s) => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t);
    return ((255 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0;
  }

  // ---------- the cars ----------
  // Each car's shape from above, pointing up the page: which part of it is at u across (right
  // positive) and w along (the front negative), in real pixels from its middle, for a car W
  // across and L long each side of it (f and r below are how far from its front and its back).
  // b is its paint, B its roof (lighter), s a white stripe and w a white roof; g glass, t a tyre,
  // h a headlight, l a tail light, m trim, r chrome (a ladder, a toolbox), a the van's amber
  // light bar (and the truck's lights and straps), p a black bumper or frame, x the pickup's bed,
  // k the sports car's wing, and u and f the air handling unit on the back of the truck and its
  // fans. Each has one thing you can tell it by from across the track: the van's light bar and
  // ladder, the pickup's dark bed and big tyres, the sports car's stripes and wing, the
  // hatchback's white roof, short and round, and the truck's length, with a unit on the back.
  const box = (u, w, hw, hl, r) => {
    const au = Math.abs(u), aw = Math.abs(w);
    if (au > hw || aw > hl) return false;
    const du = au - (hw - r), dw = aw - (hl - r);
    return du <= 0 || dw <= 0 || du * du + dw * dw <= r * r;
  };
  const SHAPES = {
    van(u, w, W, L) {
      const au = Math.abs(u), f = w + L, r = L - w;
      if (box(u, w, W, L, 2.4)) {
        if (f < 1.5 && au > W - 4.2 && au < W - 1) return 'h';
        if (r < 1.3 && au > W - 3.4 && au < W - 1) return 'l';
        if (f > 3 && f < 6.4 && au < W - 1.5) return 'g';
        if (f > 6.4 && r > 1.4 && au < W - 1.2) { // the roof: the light bar, then the ladder
          if (f > 7 && f < 10.4 && au < W - 2) return f > 7.8 && f < 9.6 && au < W - 2.8 ? 'a' : 'p';
          if (f > 12 && r > 2.8) {
            if (au > 2.2 && au < 4.4) return 'r';
            if (au <= 2.2 && (f - 12) % 3.6 < 1.4) return 'r';
          }
          return 'B';
        }
        return 'b';
      }
      if (f > 5.6 && f < 7.4 && au > W && au < W + 1.8) return 'b';
      if (au < W + 0.9 && ((f > 2.8 && f < 7.2) || (r > 2.8 && r < 7.2))) return 't';
      return null;
    },
    pickup(u, w, W, L) {
      const au = Math.abs(u), f = w + L, r = L - w;
      if (box(u, w, W, L, 2.2)) {
        if (f < 1.4) return au < W - 1.4 ? 'p' : 'b';
        if (f < 3 && au > W - 4.4 && au < W - 1) return 'h';
        if (r < 1.3) return au > W - 3.4 && au < W - 1 ? 'l' : 'p';
        if (f > 7.2 && f < 10.4 && au < W - 1.5) return 'g';
        if (f > 10.4 && f < 15.2 && au < W - 1.3) return 'B';
        if (f > 15.2 && f < 16.6 && au < W - 2) return 'g';
        if (f > 17.8 && r > 1.8 && au < W - 1.5) { // the bed, with a toolbox across the front of it
          if (f < 20.2) return 'r';
          return au < 0.6 || Math.abs(au - 3.8) < 0.6 ? 'm' : 'x';
        }
        return 'b';
      }
      if (f > 9.6 && f < 11.2 && au > W && au < W + 1.8) return 'b';
      if (au < W + 2.2 && ((f > 2.6 && f < 8.6) || (r > 2.6 && r < 8.6))) return 't';
      return null;
    },
    sports(u, w, W, L) {
      const au = Math.abs(u), f = w + L, r = L - w, ww = W - (f < 10 ? Math.pow((10 - f) / 10, 1.6) * 4.4 : 0);
      if (r > 1 && r < 4 && au < W + 2.8) return au > W + 1.6 && r < 1.8 ? null : 'k';
      if (box(u, w, ww, L, 2.6)) {
        if (f < 2.4 && au > ww - 3.6 && au < ww - 1) return 'h';
        if (r < 1.2 && au > W - 3.6 && au < W - 1) return 'l';
        if (f > 11.4 && f < 15 && au < W - 2.4) return 'g';
        if (f > 18 && f < 20.6 && au < W - 3) return 'g';
        if (au > 0.8 && au < 2.8) return 's';
        if (f > 15 && f < 18 && au < W - 2.6) return 'B';
        return 'b';
      }
      if (au > ww - 1 && au < W + 0.9 && ((f > 3.6 && f < 8.2) || (r > 4.2 && r < 9.2))) return 't';
      return null;
    },
    truck(u, w, W, L) {
      const au = Math.abs(u), f = w + L, r = L - w;
      if (box(u, w, W, L, 1.8)) {
        if (f < 1.3) return au < W - 1.2 ? 'p' : 'b';
        if (f < 2.8 && au > W - 3.8 && au < W - 1) return 'h';
        if (r < 1.2) return au > W - 3 && au < W - 0.8 ? 'l' : 'p';
        if (f < 9.6) { // the cab: its windscreen, and the row of lights along the front of its roof
          if (f > 1.6 && f < 4.2 && au < W - 1.2) return 'g';
          if (f > 4.6 && f < 5.8 && au < W - 2 && Math.abs(Math.round(u)) % 3 === 0) return 'a';
          return f > 4.2 && au < W - 1 ? 'B' : 'b';
        }
        if (f < 11) return au > W - 2.8 && au < W - 0.8 ? 'r' : 'p'; // (the exhaust stacks behind it)
        // the flatbed, and an air handling unit strapped down on it: its two fans, and a seam
        if (au > W - 1.3 || r < 2.4 || f < 12) return 'b';
        for (const c of [20.5, 2 * L - 10.5]) { const d = Math.hypot(u, f - c); if (d < 3.8) return d < 1.1 ? 'r' : d > 3 ? 'm' : 'f'; }
        if (Math.abs(f - 14.6) < 0.7 || Math.abs(r - 4.6) < 0.7) return 'a';
        return Math.abs(f - (L + 5)) < 0.45 ? 'm' : 'u';
      }
      if (f > 2.2 && f < 3.6 && au > W && au < W + 1.6) return 'p';
      if (au < W + 1.2 && ((f > 3 && f < 7.8) || (r > 2.6 && r < 7.2) || (r > 7.8 && r < 12.4))) return 't';
      return null;
    },
    hatch(u, w, W, L) {
      const au = Math.abs(u), f = w + L, r = L - w;
      if (box(u, w, W, L, 4.6)) {
        if (Math.hypot(au - (W - 3.1), f - 2.4) < 1.7) return 'h';
        if (r < 1.4 && au > W - 3.4 && au < W - 1.4) return 'l';
        if (f > 4.4 && f < 7.8 && au < W - 1.6) return 'g';
        if (r > 1.8 && r < 3.8 && au < W - 2.2) return 'g';
        if (f > 7.8 && r > 3.8 && au < W - 1.4) return 'w';
        return 'b';
      }
      if (f > 6.4 && f < 8 && au > W && au < W + 1.7) return 'w';
      if (au < W + 1 && ((f > 2.4 && f < 6.4) || (r > 2.2 && r < 6.2))) return 't';
      return null;
    },
  };
  const PART = { g: '#3a5478', G: '#7aa0c8', t: '#24242a', h: '#fff4c0', l: '#e02828', s: '#f4f4f4', S: '#c8ccd8', m: '#8890a0', x: '#34343c', p: '#3c3c46', f: '#26282e' };
  // the parts that catch the light like the paint does: [lit, flat, shaded]
  const SHINE = { w: ['#ffffff', '#ececf2', '#b8bcca'], r: ['#f0f2f6', '#b4b8c4', '#747884'], a: ['#ffd878', '#f89820', '#b8600c'], k: ['#767684', '#464652', '#2a2a34'], u: ['#fafaf6', '#dcded8', '#a6a8a2'] };
  const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const CAR = 64; // each car's picture, across and down (real pixels)
  // car type in colour pointing way k (of DIRS), z times the size it is on the track (z 2 for
  // the car screen: finer, with the same 2-pixel outline)
  function carPic(type, colour, k, z) {
    const spec = RACE.CARS[type] || RACE.CARS[0], shape = SHAPES[spec.key] || SHAPES.van, [base, lite, dark] = COLOURS[colour % COLOURS.length];
    const W = spec.wid * PX / 2, L = spec.len * PX / 2, S = CAR * z, C = S / 2;
    const a = k / DIRS * Math.PI * 2, fx = Math.sin(a), fy = Math.cos(a), rx = -Math.cos(a), ry = Math.sin(a);
    const part = new Array(S * S).fill(null);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const ox = (x + 0.5 - C) / z, oy = (y + 0.5 - C) / z;
      part[y * S + x] = shape(ox * rx + oy * ry, -(ox * fx + oy * fy), W, L);
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? null : part[y * S + x]);
    const paint = (p) => p === 'b' || p === 'B' || p === 's';
    const cv = canvas(S, S), c = cv.getContext('2d');
    // the shadow on the ground, down and to the right
    c.fillStyle = 'rgba(16, 20, 28, 0.3)';
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!part[y * S + x] && at(x - 3 * z, y - 4 * z)) c.fillRect(x, y, 1, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = part[y * S + x];
      if (!p) {
        if (AROUND.some(([dx, dy]) => at(x + dx, y + dy))) { c.fillStyle = K; c.fillRect(x, y, 1, 1); }
        continue;
      }
      let col;
      const ul = at(x - 1, y - 1), dr = at(x + 1, y + 1);
      if (paint(p)) {
        // lit from the top left: a highlight where the paint meets anything up and to the left, a
        // shade down and to the right
        if (!paint(ul)) col = p === 's' ? '#ffffff' : lite;
        else if (!paint(dr)) col = p === 's' ? PART.S : dark;
        else col = p === 'B' ? mix(base, '#ffffff', 0.22) : p === 's' ? PART.s : base;
      } else if (SHINE[p]) col = SHINE[p][ul !== p ? 0 : dr !== p ? 2 : 1];
      else if (p === 'g') col = ul !== 'g' ? PART.G : PART.g;
      else col = PART[p];
      c.fillStyle = col; c.fillRect(x, y, 1, 1);
    }
    return cv;
  }
  const carPics = new Map();
  function car(type, colour) {
    const key = type + ':' + colour;
    if (!carPics.has(key)) carPics.set(key, Array.from({ length: DIRS }, (_, k) => carPic(type, colour, k, 1)));
    return carPics.get(key);
  }
  // one at twice the size, pointing way k (each made the first time it's wanted)
  function bigCar(type, colour, k) {
    const key = type + ':' + colour + ':' + k;
    if (!carPics.has(key)) carPics.set(key, carPic(type, colour, k, 2));
    return carPics.get(key);
  }

  // The road on its own, for a map of the track: k of the game's pixels to a tile (at double
  // resolution), light grey with a dark edge, and the start line in white.
  function mini(T, k, col) {
    const cv = canvas(Math.ceil(T.w * k * 2), Math.ceil(T.h * k * 2)), c = cv.getContext('2d'), w = Math.max(2, Math.round(k * 2 * HW * 0.7));
    for (const [pad, colour] of [[2, K], [0, col || '#d8dce4']]) {
      c.fillStyle = colour;
      for (let j = 0; j < T.n; j++) c.fillRect(Math.round(T.x[j] * k * 2 - w / 2 - pad), Math.round(T.y[j] * k * 2 - w / 2 - pad), w + pad * 2, w + pad * 2);
    }
    const st = T.at(0, 0);
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(st.x * k * 2) - 1, Math.round((st.y - HW * 0.9) * k * 2), 2, Math.max(3, Math.round(HW * 1.8 * k * 2)));
    return cv;
  }

  return { paint, car, bigCar, mini, DIRS, COLOURS };
})();
