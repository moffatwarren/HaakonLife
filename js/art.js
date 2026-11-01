// All graphics are drawn from single-character colour codes.
window.Art = (function () {
  const COLORS = {
    k: '#181820', K: '#484858', g: '#8890a0', G: '#c8ccd8',
    w: '#f8f8f8', W: '#e4e4ec',
    n: '#9a6434', N: '#c89058', y: '#f0d0a0',
    e: '#2c6a34', E: '#58a848', l: '#a8e070',
    r: '#b83028', R: '#f07858',
    u: '#3050a8', U: '#6890e0', i: '#bce0f8',
    s: '#f8d0a8', h: '#5a3420', o: '#f0b030',
    c: '#f4ecd8', C: '#dccfb0', d: '#8a7458', D: '#5c4c3a',
    P: '#d8dce8', p: '#a4acc4',
    a: '#f4ecd4', Z: '#ebe0c4', A: '#cbbb96',
    // Cody's casino: carpet, gold trim, felt and the tables' wooden rails
    m: '#4a0c18', M: '#7a1828', q: '#d8a838',
    Q: '#2c7a40', F: '#58a868', t: '#3a1a0c', T: '#6a3418',
  };

  // Player characters. In the sprites: h = hair, s = skin, w = top,
  // u = accent (tie / necklace), K = trousers.
  const LOOKS = {
    male: [
      { h: '#5a3420', s: '#f8d0a8', w: '#f8f8f8', u: '#3050a8', K: '#484858' },
      { h: '#201818', s: '#d8a070', w: '#78a8e8', u: '#283878', K: '#b09870' },
      { h: '#e8c050', s: '#f8d8b8', w: '#58a848', u: '#2c6a34', K: '#383848' },
      { h: '#181010', s: '#8a5838', w: '#b83028', u: '#f0b030', K: '#686878' },
    ],
    female: [
      { h: '#6a3c20', s: '#f8d0a8', w: '#f8f8f8', u: '#d03868', K: '#383848' },
      { h: '#201818', s: '#d8a070', w: '#9868c8', u: '#f8e070', K: '#303040' },
      { h: '#d06030', s: '#f8dcc0', w: '#40a0a0', u: '#f8f8f8', K: '#585868' },
      { h: '#181010', s: '#8a5838', w: '#f0b030', u: '#b83028', K: '#3a3050' },
    ],
  };

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function palette(over) {
    const p = {};
    for (const c in COLORS) p[c] = hexRGB(COLORS[c]);
    for (const c in over || {}) p[c] = hexRGB(over[c]);
    return p;
  }
  const UI = { light: COLORS.w, dark: COLORS.k, mid: COLORS.g };

  // ---------- 16x16 indexed buffers ----------
  const buf = () => new Array(256).fill(null);
  function set(b, x, y, c) { if (x >= 0 && x < 16 && y >= 0 && y < 16 && c) b[y * 16 + x] = c; }
  function rect(b, x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(b, i, j, c); }
  function stamp(b, art) { stampArt(b, art); }
  function stampArt(b, art) {
    for (let j = 0; j < art.length; j++)
      for (let i = 0; i < art[j].length; i++) {
        const ch = art[j][i];
        if (ch !== '.') set(b, i, j, ch);
      }
  }

  // ---------- object art ----------
  const ART = {
    forklift: [
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
    ],
    chair: [
      '................',
      '................',
      '....kkkkkkkk....',
      '...kuuuuuuuuk...',
      '...kuUUUUUUuk...',
      '...kuUUUUUUuk...',
      '...kkkkkkkkkk...',
      '..kuUUUUUUUUuk..',
      '..kuUUUUUUUUuk..',
      '..kuUUUUUUUUuk..',
      '..kkuuuuuuuukk..',
      '...kkkkkkkkkk...',
      '......kKKk......',
      '....kkkKKkkk....',
      '...kK..kk..Kk...',
      '................',
    ],
    plant: [
      '......kkkk......',
      '....kkEElEkk....',
      '...kEElEEEElk...',
      '..kEEllEEeElEk..',
      '.kEleEElEEleEEk.',
      '.kEEEeElleEEeEk.',
      '.keElEEeEEElEek.',
      '..kEEeElEEeEEk..',
      '..kkeEEeEEEekk..',
      '....kkeeeekk....',
      '.....knnnnk.....',
      '....knNNNNnk....',
      '....knNNNNnk....',
      '....knnNNnnk....',
      '.....knnnnk.....',
      '......kkkk......',
    ],
    toilet: [
      '................',
      '...kkkkkkkkkk...',
      '...kwwwwwwwwk...',
      '...kGGGGGGGGk...',
      '...kkkkkkkkkk...',
      '....kwwwwwwk....',
      '...kwwGGGGwwk...',
      '...kwGiiiiGwk...',
      '...kwGiiiiGwk...',
      '...kwGiiiiGwk...',
      '...kwwGiiGwwk...',
      '....kwwGGwwk....',
      '.....kwwwwk.....',
      '......kkkk......',
      '................',
      '................',
    ],
    sink: [
      '................',
      '................',
      'kkkkkkkkkkkkkkkk',
      'kWWWWWWggWWWWWWk',
      'kWWWWWWKKWWWWWWk',
      'kWWkkkkkkkkkkWWk',
      'kWkiiiiiiiiiikWk',
      'kWkiiiiiiiiiikWk',
      'kWkiiiiKKiiiikWk',
      'kWkiiiiiiiiiikWk',
      'kWWkkkkkkkkkkWWk',
      'kWWWWWWWWWWWWWWk',
      'kGGGGGGGGGGGGGGk',
      'kkkkkkkkkkkkkkkk',
      '................',
      '................',
    ],
    fridge: [
      '..kkkkkkkkkkkk..',
      '..kGGGGGGGGGGk..',
      '..kWWWWWWWWWWk..',
      '..kkkkkkkkkkkk..',
      '..kwwwwwwwwwwk..',
      '..kwwwwwwwwKwk..',
      '..kwwwwwwwwKwk..',
      '..kGGGGGGGGGGk..',
      '..kwwwwwwwwwwk..',
      '..kwwwwwwwwKwk..',
      '..kwwwwwwwwKwk..',
      '..kwwwwwwwwKwk..',
      '..kwwwwwwwwwwk..',
      '..kGGGGGGGGGGk..',
      '..kkkkkkkkkkkk..',
      '................',
    ],
    recycling: [
      '................',
      '...kkkkkkkkkk...',
      '..kUUUUUUUUUUk..',
      '..kuuuuuuuuuuk..',
      '..kkkkkkkkkkkk..',
      '...kUUUUUUUUk...',
      '...kUUUwwUUUk...',
      '...kUUwUUwUUk...',
      '...kUwUUUUwUk...',
      '...kUUwwwwUUk...',
      '...kUUUUUUUUk...',
      '...kuUUUUUUuk...',
      '...kuuuuuuuuk...',
      '....kkkkkkkk....',
      '................',
      '................',
    ],
    copier: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kGGGGGGGGGGGGk.',
      '.kGkkkkkkkkkkGk.',
      '.kGkiiiiiiiikGk.',
      '.kGkkkkkkkkkkGk.',
      '.kWWWWWWWWuUoWk.',
      '.kkkkkkkkkkkkkk.',
      '.kWWWWWWWWWWWWk.',
      '.kWkkkkkkkkkkWk.',
      '.kWkwwwwwwwwkWk.',
      '.kWkkkkkkkkkkWk.',
      '.kGGGGGGGGGGGGk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    shelf: [
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knkkkkkkkkkkkknk',
      'knrRuUeEoyrRuUnk',
      'knrRuUeEoyrRuUnk',
      'knrRuUeEoyrRuUnk',
      'knnnnnnnnnnnnnnk',
      'knuUeEyrRuUoeEnk',
      'knuUeEyrRuUoeEnk',
      'knuUeEyrRuUoeEnk',
      'knnnnnnnnnnnnnnk',
      'knNNNNNNNNNNNNnk',
      'knNNNNNNNNNNNNnk',
      'knnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    // One treadmill seen from the side, 3 tiles wide (console on the left).
    treadmill: [
      '................................................',
      '.kkkkkkkk.......................................',
      '.kiiiiiUk.......................................',
      '.kUiiiiik.......................................',
      '.kkkkkkkk.......................................',
      '...kKkgggggggkk.................................',
      '...kKkkkkkkkkKk.................................',
      '....kKk......kk.................................',
      '....kKk......kk.................................',
      '.kkkkkkkkkk.....................................',
      '.kRRRRRRRRkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      '.krrrrrrrrggKgggggKgggggKgggggKgggggKgggggKgGGk.',
      '.krrrrrrrrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      '.kkkkkkkkkkKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk.',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      '..kkk.....................................kkk...',
    ],
    appliance: [
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kGGGGGGGGGGGGk.',
      '.kGkkkkkkkkKGGk.',
      '.kGkiiiiiikKoGk.',
      '.kGkiiiiiikKGGk.',
      '.kGkiiiiiikKuGk.',
      '.kGkkkkkkkkKGGk.',
      '.kGGGGGGGGGGGGk.',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
    monitor: [
      '................',
      '....kkkkkkkk....',
      '....kKKKKKKk....',
      '....kKiiiiKk....',
      '....kKiUiiKk....',
      '....kKiiiiKk....',
      '....kKKKKKKk....',
      '....kkkkkkkk....',
      '......kKKk......',
      '.....kkkkkk.....',
      '................',
      '...kkkkkkkkk....',
      '...kWWWWWWWk....',
      '...kkkkkkkkk....',
    ],
    ball: [
      '................',
      '................',
      '.....kkkkkk.....',
      '...kkRRRRRRkk...',
      '..kRwwRRRRRRrk..',
      '..kRwRRRRRRRrk..',
      '.kRRRRRRRRRRRrk.',
      '.kRRRRRRRRRRrrk.',
      '.kRRRRRRRRRRrrk.',
      '.krRRRRRRRRrrrk.',
      '..krRRRRRRrrrk..',
      '..krrrrrrrrrrk..',
      '...kkrrrrrrkk...',
      '.....kkkkkk.....',
      '....KKKKKKKK....',
      '................',
    ],
    box: [
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '..kyyyyNNyyyyk..',
      '..kyyyyNNyyyyk..',
      '..kyyyyNNyyyyk..',
      '..kkkkkkkkkkkk..',
      '..kNNNNNNNNNNk..',
      '..kNNNNNNNNNNk..',
      '..kNNkkkkNNNNk..',
      '..kNNkwwkNNNNk..',
      '..kNNkkkkNNNNk..',
      '..kNNNNNNNNNNk..',
      '..knnnnnnnnnnk..',
      '..kkkkkkkkkkkk..',
      '................',
    ],
    partsShelf: [
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knkkkkkkkkkkkknk',
      'knKKKgDEoEoDKink',
      'knKgKgDEEEEDKKnk',
      'knKKKgDoEoEDggnk',
      'knnnnnnnnnnnnnnk',
      'knDGGGgDKiiKDonk',
      'knDGgGgDKiiKDonk',
      'knDggggDKKKKDknk',
      'knnnnnnnnnnnnnnk',
      'knNNNNNNNNNNNNnk',
      'knNNNNNNNNNNNNnk',
      'knnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    junk: [
      '................',
      '...kkkkkkk......',
      '...kGGGGGk......',
      '...kGkkkGk......',
      '...kGkikGk......',
      '...kGkkkGkkkkk..',
      '...kGGGGGkKKKk..',
      '..kkkkkkkkKgKk..',
      '..kKKKKKKKkKKKk.',
      '..kKgKKoKKkKgKk.',
      '..kKKKKKKKkKKKk.',
      '..kEoEEoEEkkkkk.',
      '.kEEEoEEEoEk....',
      '.kkkkkkkkkkk....',
      '................',
      '................',
    ],
    floorParts: [
      '................',
      '.kkkkkkk........',
      '.kEoEoEk........',
      '.kkkkkkk....K...',
      '...........K.K..',
      '..........K...K.',
      '...KK....K......',
      '..K..K..K.......',
      '.K....KK........',
      '................',
      '.........kkk....',
      '........kGgGk...',
      '...g....kgGgk...',
      '..gGg....kkk....',
      '...g............',
      '................',
    ],
    cupboard: [
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knkkkkkkkkkkkknk',
      'knwwwkwwwkuUrRnk',
      'knGGGkGGGkuUrRnk',
      'knwwwkwwwkuUrRnk',
      'knnnnnnnnnnnnnnk',
      'knNNNNNkkNNNNNnk',
      'knNyyyNkkNyyyNnk',
      'knNNNNokkoNNNNnk',
      'knNyyyNkkNyyyNnk',
      'knNNNNNkkNNNNNnk',
      'knnnnnnnnnnnnnnk',
      'kDDDDDDDDDDDDDDk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    printer: [
      '................',
      '................',
      '...kkkkkkkkkk...',
      '...kwwwwwwwwk...',
      '..kkkkkkkkkkkk..',
      '..kGGGGGGGGGGk..',
      '..kGKKKKKKKKGk..',
      '..kGGGGGGuoGGk..',
      '..kggggggggggk..',
      '..kkkkkkkkkkkk..',
      '...kwwwwwwwwk...',
      '...kkkkkkkkkk...',
      '..knnnnnnnnnnk..',
      '..knNNNNNNNNnk..',
      '..kk........kk..',
      '................',
    ],
    fan: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kGGGGGGGGGGGGk.',
      '.kGGGkkkkkkGGGk.',
      '.kGGkKgKKgKkGGk.',
      '.kGkKKgKKgKKkGk.',
      '.kGkgggkkgggkGk.',
      '.kGkKKgkkgKKkGk.',
      '.kGkKgKKKKgKkGk.',
      '.kGGkKKgKKKkGGk.',
      '.kGGGkkkkkkGGGk.',
      '.kGGGGGGGGGGGGk.',
      '.kggggggggggggk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    coil: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kKKKKKKKKKKKKk.',
      '.kGgGgGgGgGgGgk.',
      '.knooooooooooGk.',
      '.kGgGgGgGgGgGgk.',
      '.kGgGgGgGgGgGgk.',
      '.kGoooooooooonk.',
      '.kGgGgGgGgGgGgk.',
      '.kGgGgGgGgGgGgk.',
      '.knooooooooooGk.',
      '.kGgGgGgGgGgGgk.',
      '.kKKKKKKKKKKKKk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    // A damper: angled louvre blades in a frame, with a linkage rod down the side.
    damper: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kKKKKKKKKKKKKk.',
      '.kGGgkGGGgkGGKk.',
      '.kGgkGGgkGGgkKk.',
      '.kgkGGgkGGgkGKk.',
      '.kKKKKKKKKKKKKk.',
      '.kGGgkGGGgkGGKk.',
      '.kGgkGGgkGGgkKk.',
      '.kgkGGgkGGgkGKk.',
      '.kKKKKKKKKKKKKk.',
      '.kGGgkGGGgkGGKk.',
      '.kGgkGGgkGGgkKk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    // An engraving machine: a gantry over a bed, with a nameplate under the head.
    engraver: [
      '................',
      '..kkkkkkkkkkkk..',
      '..kKKKKKKKKKKk..',
      '..kKGGGGGGGGKk..',
      '..kKGkkkkkkGKk..',
      '..kKGkooooKGKk..',
      '..kKGkkkkkkGKk..',
      '..kKGGGGGGGGKk..',
      '..kKKKkwwkKKKk..',
      '..kGGGkwwkGGGk..',
      '..kGwwwwwwwwGk..',
      '..kGwkkkkkkwGk..',
      '..kKKKKKKKKKKk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
    // Status lights at (4,3), (7,3), (10,3) are drawn dark here; game.js blinks them.
    panel: [
      '.kkkkkkkkkkkkkk.',
      '.kGGGGGGGGGGGGk.',
      '.kGkkkkkkkkkkGk.',
      '.kGkKKkKKkKKkGk.',
      '.kGkKKkKKkKKkGk.',
      '.kGkkkkkkkkkkGk.',
      '.kGGGGGGGGGGGGk.',
      '.kGKKGGKKGGKKGk.',
      '.kGKwGGKwGGKwGk.',
      '.kGKKGGKKGGKKGk.',
      '.kGGGGGGGGGGGGk.',
      '.kGkkkkkkkkkkGk.',
      '.kGkiiiiUiiikGk.',
      '.kGkkkkkkkkkkGk.',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
    candy: [
      '................',
      '................',
      '.....RoUEr......',
      '....kkkkkkkk....',
      '....kwwwwwwk....',
      '.....kwwwwk.....',
      '......kkkk......',
      '..R.....U..o....',
      '.......E........',
    ],
    candyB: [
      '................',
      '................',
      '...o.....R......',
      '.......E....U...',
      '..U.............',
      '.....R...o......',
      '..........E.....',
      '...E.r..........',
      '........U.......',
    ],
    washer: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kWWWWWWWWoKWWk.',
      '.kGGGGGGGGGGGGk.',
      '.kwwwwkkkkwwwwk.',
      '.kwwwkiiiikwwwk.',
      '.kwwkiUiiiikwwk.',
      '.kwwkiiUiiikwwk.',
      '.kwwkiiiiiikwwk.',
      '.kwwwkiiiikwwwk.',
      '.kwwwwkkkkwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kGGGGGGGGGGGGk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    punchingBag: [
      '.......kk.......',
      '.......Kk.......',
      '.......kK.......',
      '.....kkkkkk.....',
      '....kRRRRRrk....',
      '....kRwRRRrk....',
      '....kRwRRRrk....',
      '....kRRRRRrk....',
      '....kkkkkkkk....',
      '....kRRRRRrk....',
      '....kRRRRRrk....',
      '....kRRRRRrk....',
      '....krrrrrrk....',
      '.....kkkkkk.....',
      '....KKKKKKKK....',
      '................',
    ],
    locker: [
      'kkkkkkkkkkkkkkkk',
      'kuUUUUUUUUUUUUuk',
      'kuUkkkkkkkkkkUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUkkkkkkkkkkUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUkUUuk',
      'kuUUUUUUUUUkUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuUUUUUUUUUUUUuk',
      'kuuuuuuuuuuuuuuk',
      'kkkkkkkkkkkkkkkk',
    ],
    pulldown: [
      '..kkkkkkkkkkkk..',
      '..kKKKKKKKKKKk..',
      '..kKkkkkkkkkKk..',
      '..kKk..g...kKk..',
      '..kKk..g...kKk..',
      '.kkkkkkkkkkkkkk.',
      '..kKk..g...kKk..',
      '..kKk.kKKk.kKk..',
      '..kKk.kggk.kKk..',
      '..kKk.kKKk.kKk..',
      '..kKk.kggk.kKk..',
      '..kKkkkkkkkkKk..',
      '..kKkuUUUukkKk..',
      '..kKkkkkkkkkKk..',
      '..kkk......kkk..',
      '................',
    ],
    dumbbells: [
      '................',
      '................',
      '................',
      '.kkk.....kkk....',
      '.kKkgggggkKk....',
      '.kkk.....kkk....',
      '................',
      '....kkk.....kkk.',
      '....kKkgggggkKk.',
      '....kkk.....kkk.',
    ],
    snackShelf: [
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knkkkkkkkkkkkknk',
      'knooDRRDuuDooRnk',
      'knoyDRwDUUDoyRnk',
      'knooDRRDuuDooRnk',
      'knnnnnnnnnnnnnnk',
      'knrDrDEEDyyDrDnk',
      'knrDrDElDyyDrDnk',
      'knrDrDEEDooDrDnk',
      'knnnnnnnnnnnnnnk',
      'knNNNNNNNNNNNNnk',
      'knNNNNNNNNNNNNnk',
      'knnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    serverRack: [
      '..kkkkkkkkkkkk..',
      '..kKKKKKKKKKKk..',
      '..kKkkkkkkkkKk..',
      '..kKkgggggEkKk..',
      '..kKkkkkkkkkKk..',
      '..kKkgggggokKk..',
      '..kKkkkkkkkkKk..',
      '..kKkggggEEkKk..',
      '..kKkkkkkkkkKk..',
      '..kKkgggggEkKk..',
      '..kKkkkkkkkkKk..',
      '..kKkgggggrkKk..',
      '..kKkkkkkkkkKk..',
      '..kKKKKKKKKKKk..',
      '..kkkkkkkkkkkk..',
      '................',
    ],
    computerRack: [
      '.kkkkkkkkkkkkkk.',
      '.kg..........gk.',
      '.kg.kkkk.kkk.gk.',
      '.kg.kiik.kEk.gk.',
      '.kg.kkkk.kKk.gk.',
      '.kg..kk..kkk.gk.',
      '.kkkkkkkkkkkkkk.',
      '.kg..........gk.',
      '.kg.kkk.kkk..gk.',
      '.kg.kEk.koK..gk.',
      '.kg.kKk.kKk..gk.',
      '.kg.kkk.kkk..gk.',
      '.kkkkkkkkkkkkkk.',
      '.kg..........gk.',
      '.kk..........kk.',
      '................',
    ],
    slotTop: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kqoqoqoqoqoqok.',
      '.kokkkkkkkkkkok.',
      '.kokrRrRrRrRkok.',
      '.kokkkkkkkkkkok.',
      '.kqoqoqoqoqoqok.',
      '.kkkkkkkkkkkkkk.',
      '.krrrrrrrrrrrrk.',
      '.krkkkkkkkkkkrk.',
      '.krkwwkwwkwwkrk.',
      '.krkrwkowkwrkrk.',
      '.krkwwkwwkwwkrk.',
      '.krkkkkkkkkkkrk.',
      '.krrrrrrrrrrrrk.',
      '.kRRRRRRRRRRRRk.',
    ],
    slotBottom: [
      '.krrrrrrrrrrrrk.',
      '.kkkkkkkkkkkkkk.',
      '.kWWWWWWWWWWWWk.',
      '.kWoWWrWWuWWWWk.',
      '.kkkkkkkkkkkkkk.',
      '.krrrrrrrrrrrrk.',
      '.krrrrrrrrrrrrk.',
      '.krrkkkkkkkkrrk.',
      '.krrkKKKKKKkrrk.',
      '.krrkkkkkkkkrrk.',
      '.krrrrrrrrrrrrk.',
      '.kqqqqqqqqqqqqk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
    coffeeTop: [
      '................',
      '..kkkkkkkkkkkk..',
      '..kKKKKKKKKKKk..',
      '..kKkkkkkkkkKk..',
      '..kKknnnnnnkKk..',
      '..kKknNnnNnkKk..',
      '..kKknnnnnnkKk..',
      '..kKkkkkkkkkKk..',
      '..kKKKKKKKKKKk..',
      '..kKkiiiiiikKk..',
      '..kKkiUiiiikKk..',
      '..kKkkkkkkkkKk..',
      '..kKKoKKrKKKKk..',
      '..kKKKKKKKKKKk..',
      '..kKKKKKKKKKKk..',
      '..kKKKKKKKKKKk..',
    ],
    coffeeBottom: [
      '..kKKKKKKKKKKk..',
      '..kKKkkkkkkKKk..',
      '..kKKkgggkkKKk..',
      '..kKkkkgkkkkKk..',
      '..kKk..g...kKk..',
      '..kKk..n...kKk..',
      '..kKk.kwwk.kKk..',
      '..kKk.kwwk.kKk..',
      '..kKk.kkkk.kKk..',
      '..kKkkkkkkkkKk..',
      '..kKggggggggKk..',
      '..kKKKKKKKKKKk..',
      '..kkkkkkkkkkkk..',
    ],
    trophies: [
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knDDDDDDDDDDDDnk',
      'knDoooDDDGGGDDnk',
      'knDoyoDDDGWGDDnk',
      'knDDoDDDDDGDDDnk',
      'knDoooDDDGGGDDnk',
      'knnnnnnnnnnnnnnk',
      'knDDDDDDDDDDDDnk',
      'knDDDooooDDDDDnk',
      'knDDDoyooDGGGDnk',
      'knDDDDooDDDGDDnk',
      'knDDDooooDGGGDnk',
      'knnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    papers: [
      '................',
      '................',
      '................',
      '................',
      '...kkkkk........',
      '...kwwwk..kkk...',
      '...kwGwk.krrk...',
      '...kwwwk.kRrkk..',
      '...kwGwk.krrk...',
      '...kkkkk..kk....',
    ],
  };

  ART.dryer = ART.washer.map((row) => row.replace(/i/g, 'K').replace(/U/g, 'g'));
  ART.floorPartsB = ART.floorParts.map((row) => row.split('').reverse().join(''));

  // ---------- player sprite (office new-hire) ----------
  const LEGS_A = ['....kKKKKKKk....', '...kKKkk.kKk....', '...kkk....kk....'];
  const HEAD_DOWN = [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khsshhsshk...',
    '...kssssssssk...',
    '...kskssssksk...',
    '....kssssssk....',
    '.....kkkkkk.....',
  ];
  const HEAD_UP = [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...kshhhhhhsk...',
    '....khhhhhhk....',
    '.....kkkkkk.....',
  ];
  const HEAD_LEFT = [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...ksshhhhhhk...',
    '..ksssshhhhhk...',
    '..ksksssshhhk...',
    '...kssssshhk....',
    '....kkkkkkk.....',
  ];
  const BODY_DOWN = ['...kswwwwwwsk...', '...kswwwwwwsk...', '....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....'];
  const FEMALE = {
    down: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhsshhsshhk..',
      '..khsssssssshk..',
      '..khsksssskshk..',
      '..khhsssssshhk..',
      '..khhkkkkkkhhk..',
      '..khkwwuuwwkhk..',
    ],
    up: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..khhhhhhhhhhk..',
      '..kkhhhhhhhhkk..',
      '...kshhhhhhsk...',
      '...kswhhhhwsk...',
    ],
    left: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khhhhhhhhhk..',
      '...ksshhhhhhhk..',
      '..ksssshhhhhhk..',
      '..ksksssshhhhk..',
      '...kssssshhhhk..',
      '....kkkkkhhhhk..',
      '....kwwwwwhhk...',
    ],
  };
  const SPRITES_F = {
    down: [
      FEMALE.down.concat(BODY_DOWN),
      FEMALE.down.concat(BODY_DOWN.slice(0, 2), LEGS_A),
    ],
    up: [
      FEMALE.up.concat(['...kswwwwwwsk...', '....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....']),
      FEMALE.up.concat(['...kswwwwwwsk...'], LEGS_A),
    ],
    left: [
      FEMALE.left.concat(['....kwwsswwk....', '....kwwsswwk....', '....kKKKKKKk....', '....kKKkKKk.....', '.....kk.kk......']),
      FEMALE.left.concat(['...kswwwwwwk....', '....kwwwwwsk....', '....kKKKKKKk....', '...kKKk..kKKk...', '...kkk....kkk...']),
    ],
  };
  // Ghost: a floating sheet. Walking frames ripple the hem.
  const GHOST_TOP = ['................', '.....kkkkkk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwwwwwwwwk...'];
  const GHOST_BODY = ['..kwwwwwwwwwGk..', '..kwwwwwwwwwGk..', '..kWwwwwwwwwGk..', '..kWWwwwwwwGGk..', '..kWWWwwwwGGGk..'];
  const HEM_A = ['..kwkWWkkWWkwk..', '..k.k..kk..k.k..'];
  const HEM_B = ['..kkWWkwwkWWkk..', '...kk..kk..kk...'];
  const GHOST_FACE_DOWN = ['..kwwkkwwkkwwk..', '..kwwkkwwkkwwk..', '..kwwwwwwwwwwk..', '..kwwwwkkwwwwk..'];
  const GHOST_FACE_UP = ['..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..'];
  const GHOST_FACE_LEFT = ['..kwkkwwkkwwwk..', '..kwkkwwkkwwwk..', '..kwwwwwwwwwwk..', '..kwkkwwwwwwwk..'];
  const ghost = (face, hem) => GHOST_TOP.concat(face, GHOST_BODY.slice(0, 5), hem).slice(0, 16);
  const SPRITES_GHOST = {
    down: [ghost(GHOST_FACE_DOWN, HEM_A), ghost(GHOST_FACE_DOWN, HEM_B)],
    up: [ghost(GHOST_FACE_UP, HEM_A), ghost(GHOST_FACE_UP, HEM_B)],
    left: [ghost(GHOST_FACE_LEFT, HEM_A), ghost(GHOST_FACE_LEFT, HEM_B)],
  };

  const SPRITES = {
    down: [
      HEAD_DOWN.concat(['....kwwuuwwk....', '...kswwuuwwsk...', '...kswwwwwwsk...', '....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....']),
      HEAD_DOWN.concat(['....kwwuuwwk....', '...kswwuuwwsk...', '...kswwwwwwsk...'], LEGS_A),
    ],
    up: [
      HEAD_UP.concat(['....kwwwwwwk....', '...kswwwwwwsk...', '...kswwwwwwsk...', '....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....']),
      HEAD_UP.concat(['....kwwwwwwk....', '...kswwwwwwsk...', '...kswwwwwwsk...'], LEGS_A),
    ],
    left: [
      HEAD_LEFT.concat(['....kwwwwwwk....', '....kwwsswwk....', '....kwwsswwk....', '....kKKKKKKk....', '....kKKkKKk.....', '.....kk.kk......']),
      HEAD_LEFT.concat(['....kwwwwwwk....', '...kswwwwwwk....', '....kwwwwwsk....', '....kKKKKKKk....', '...kKKk..kKKk...', '...kkk....kkk...']),
    ],
  };

  // ---------- your own character (the character editor) ----------
  // A look is { g, skin, hair, hairC, hat, shirt, shirtC, pants, pantsC }: the body
  // ('male' or 'female') and a place in each list below. It's saved and sent as a short
  // code (lookCode), one base-36 digit per part in LOOK_PARTS order, so only ever add to
  // the end of a list: moving something would change everyone's saved look.
  // In the pictures, h = hair (H a shade darker), s = skin, w = shirt (v a shade darker),
  // u = its accent, K = pants; anything else is the ordinary palette.
  const SKINS = ['#f8dcc0', '#f8d8b8', '#f8d0a8', '#e8b48a', '#d8a070', '#b87848', '#8a5838', '#6a4028'];
  const HAIR_COLOURS = [
    ['Brown', '#5a3420'], ['Black', '#201818'], ['Blonde', '#e8c050'], ['Chestnut', '#6a3c20'], ['Ginger', '#d06030'],
    ['Grey', '#9a9aa4'], ['White', '#ecebf0'], ['Platinum', '#f0e4b8'], ['Blue', '#3868c8'], ['Pink', '#e870a8'],
    ['Green', '#48a848'], ['Purple', '#7848b8'],
  ];
  // a shirt colour and the accent that goes with it (the tie, the stripe, the strings)
  const SHIRT_COLOURS = [
    ['White', '#f8f8f8', '#3050a8'], ['Sky', '#78a8e8', '#283878'], ['Green', '#58a848', '#2c6a34'], ['Red', '#b83028', '#f0b030'],
    ['Pearl', '#f8f8f8', '#d03868'], ['Purple', '#9868c8', '#f8e070'], ['Teal', '#40a0a0', '#f8f8f8'], ['Gold', '#f0b030', '#b83028'],
    ['Black', '#383848', '#d03838'], ['Grey', '#a0a0b0', '#283878'], ['Pink', '#e878a0', '#f8f8f8'], ['Orange', '#e87830', '#283878'],
    ['Navy', '#283878', '#f8f8f8'], ['Brown', '#8a5a32', '#f0d0a0'],
  ];
  const PANTS_COLOURS = [
    ['Charcoal', '#484858'], ['Khaki', '#b09870'], ['Black', '#383848'], ['Grey', '#686878'], ['Slate', '#585868'],
    ['Plum', '#3a3050'], ['Denim', '#4a6c9e'], ['Navy', '#283878'], ['Brown', '#6a4428'], ['Olive', '#5a6a30'],
    ['Red', '#9a2820'], ['Cream', '#e0d8c0'],
  ];
  // Hair: the whole head, from row 0, looking down (at you), up (away) and left (right is
  // the same flipped). Rows past the chin (row 9) are laid over the shirt, where '.'
  // leaves the shirt showing. `hd` is the parking lot's nearest hairdo (js/hd.js).
  const HAIRS = [
    { name: 'Short', hd: 'short', down: HEAD_DOWN, up: HEAD_UP, left: HEAD_LEFT },
    {
      name: 'Long', hd: 'long',
      down: FEMALE.down.slice(0, 10).concat(['..khk......khk..']),
      up: FEMALE.up.slice(0, 10).concat(['.....hhhhhh.....', '......hhhh......']),
      left: FEMALE.left.slice(0, 10).concat(['..........hhk...']),
    },
    {
      name: 'Buzz cut', hd: 'buzz',
      down: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kssssssssk...', '...kssssssssk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....kssssssk....', '.....kkkkkk.....'],
      left: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...kshhhhhhhk...', '...ksssshhhhk...', '..ksssssshhhk...', '..ksksssssshk...', '...ksssssshk....', '....kkkkkkk.....'],
    },
    {
      name: 'Spiky', hd: 'spiky',
      down: ['....k.k..k.k....', '...khkhkkhkhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhshhshhk...', '...kssssssssk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['....k.k..k.k....', '...khkhkkhkhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....khhhhhhk....', '.....kkkkkk.....'],
      left: ['.....k.k.k......', '....khkhkhkk....', '...khhhhhhhhk...', '...khhhhhhhhhk..', '...khhhhhhhhk...', '...ksshhhhhhk...', '..ksssshhhhhk...', '..ksksssshhhk...', '...kssssshhk....', '....kkkkkkk.....'],
    },
    {
      name: 'Curly', hd: 'curly',
      down: ['....kkkkkkkk....', '...khhHhhHhhk...', '..khHhhhhhhHhk..', '..khhhhHhhhhhk..', '..khHhhhhhhHhk..', '..khhsssssshhk..', '...kssssssssk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['....kkkkkkkk....', '...khhHhhHhhk...', '..khHhhhhhhHhk..', '..khhhhHhhhhhk..', '..khHhhhhhhHhk..', '..khhhhHhhhhhk..', '..khhHhhhhHhhk..', '...kshhhhhhsk...', '....khhhhhhk....', '.....kkkkkk.....'],
      left: ['....kkkkkkkk....', '...khhHhhHhhk...', '..khHhhhhhhHhk..', '..khhhhHhhhhhk..', '..kshhhhhhHhhk..', '..kssshhhhhhhk..', '..ksssshhHhhhk..', '..ksksssshhhk...', '...kssssshhk....', '....kkkkkkk.....'],
    },
    {
      name: 'Bob', hd: 'bob',
      down: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..khsssssssshk..', '..khsksssskshk..', '..khhsssssshhk..', '..kkkkkkkkkkkk..'],
      up: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..kkkkkkkkkkkk..'],
      left: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '..khhhhhhhhhhk..', '..ksssshhhhhhk..', '..ksksssshhhhk..', '...kssssshhhhk..', '....kkkkkkkkkk..'],
    },
    {
      name: 'Ponytail', hd: 'ponytail',
      down: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhsssshhk...', '...khsssssshk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhrrhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....khhhhhhk....', '.....kkhhkk.....', '......khhk......', '.......hh.......'],
      left: ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhkk..', '...ksshhhhhhkhk.', '..ksssshhhhhkhk.', '..ksksssshhhkhk.', '...kssssshhk.kk.', '....kkkkkkk.....'],
    },
    {
      name: 'Bun', hd: 'bun',
      down: ['......kkkk......', '.....kHHHHk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhsssshhk...', '...khsssssshk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['......kkkk......', '.....khhhhk.....', '....khHHHHhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....kssssssk....', '.....kkkkkk.....'],
      left: ['........kkk.....', '.....kkkhhhk....', '....khhhHHhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...ksshhhhhhk...', '..ksssshhhhhk...', '..ksksssshhhk...', '...kssssshhk....', '....kkkkkkk.....'],
    },
    {
      name: 'Bald', hd: 'bald',
      down: ['................', '.....kkkkkk.....', '....kssssssk....', '...kssssssssk...', '...kssssssssk...', '...khsssssshk...', '...khsssssshk...', '...kskssssksk...', '....kssssssk....', '.....kkkkkk.....'],
      up: ['................', '.....kkkkkk.....', '....kssssssk....', '...kssssssssk...', '...kssssssssk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...kshhhhhhsk...', '....khhhhhhk....', '.....kkkkkk.....'],
      left: ['................', '.....kkkkkk.....', '....kssssssk....', '...kssssssssk...', '...kssssssssk...', '...ksssssshhk...', '..ksssssshhhk...', '..ksksssshhhk...', '...kssssshhk....', '....kkkkkkk.....'],
    },
  ];
  // Head things: laid over the hair, from row 0 ('.' leaves it, '_' rubs it out).
  // `hd` names the same thing out in the parking lot (js/hd.js), as it does for the hair,
  // shirts and pants.
  const HATS = [
    { name: 'Nothing', hd: 'none' },
    {
      name: 'Cap', hd: 'cap',
      down: ['________________', '_____kkkkkk_____', '....krrrrrrk....', '...krrrWWrrrk...', '..kRRRRRRRRRRk..'],
      up: ['________________', '_____kkkkkk_____', '....krrrrrrk....', '...krrrrrrrrk...', '...krrkhhkrrk...'],
      left: ['________________', '_____kkkkkk_____', '....krrrrrrk....', '...krrrrrrrrk...', '.kRRRRRrrrrrk...', '.kkk............'],
    },
    {
      name: 'Toque', hd: 'toque',
      down: ['______kWWk______', '_____kEEEEk_____', '....kEEEEEEk....', '...kEEEEEEEEk...', '...keeeeeeeek...'],
    },
    {
      name: 'Hard hat', hd: 'hardhat',
      down: ['________________', '_____kkkkkk_____', '....kooyyook....', '...kooooooook...', '..kqqqqqqqqqqk..'],
      left: ['________________', '_____kkkkkk_____', '....kooyyook....', '...kooooooook...', '.kqqqqqqqqqqqk..'],
    },
    {
      name: 'Cowboy hat', hd: 'cowboy',
      down: ['______kkkk______', '_____knNNnk_____', '....knnnnnnk....', '...kkDDDDDDkk...', 'knnnnnnnnnnnnnnk', '.kkkkkkkkkkkkkk.'],
    },
    {
      name: 'Headphones', hd: 'headphones',
      down: ['', '', '....kggggggk....', '...kg......gk...', '...kg......gk...', '..kkk......kkk..', '..krk......krk..', '..kkk......kkk..'],
      left: ['', '........kkk.....', '.........gk.....', '.........gk.....', '.........gk.....', '........kkkk....', '........krrk....', '........kkkk....'],
    },
    {
      name: 'Glasses', hd: 'glasses',
      down: ['', '', '', '', '', '', '....kkk..kkk....', '....kik..kik....'],
      up: [],
      left: ['', '', '', '', '', '', '', '...kikkkk.......'],
    },
    {
      name: 'Shades', hd: 'shades',
      down: ['', '', '', '', '', '', '', '...kkgkkkkgkk...'],
      up: [],
      left: ['', '', '', '', '', '', '', '...kgkkkk.......'],
    },
    {
      name: 'Bow', hd: 'bow',
      down: ['..........kk.kk.', '..........kRkRk.', '..........krrrk.', '..........kRkRk.', '..........kk.kk.'],
      up: ['.kk.kk..........', '.kRkRk..........', '.krrrk..........', '.kRkRk..........', '.kk.kk..........'],
      left: ['.......kk.kk....', '.......kRkRk....', '.......krrrk....', '.......kRkRk....'],
    },
    // only ever worn by the Office Champion, and they can't wear anything else (see js/game.js)
    {
      name: 'Crown', hd: 'crown',
      down: ['____k__kk__k____', '___kokkookkok___', '...koyooooook...', '...kqrqiiqrqk...'],
    },
    // only for a name that's opened its present under the tree on Christmas Day (see js/game.js)
    {
      name: 'Santa hat', hd: 'santa',
      down: ['_______kkk_kWWk_', '______krrrkkWWk_', '....krrrrrrRk___', '...kWWWWWWWWk...', '...kWWWWWWWWk...'],
      up: ['_kWWk_kkk_______', '_kWWkkrrrk______', '___kRrrrrrrk....', '...kWWWWWWWWk...', '...kWWWWWWWWk...'],
    },
    // only for the Christmas Cup's champion, the fastest at Humbug Sweeper over Christmas 2026
    // (see js/game.js): gold reindeer antlers, with the hair showing
    {
      name: 'Golden antlers', hd: 'antlers',
      down: ['.k...k....k...k.', 'kyk.kyk..kyk.kyk', 'kyoooqk..kyoooqk', '.kkqqk....kqqkk.'],
    },
  ];
  // where the crown, the Santa hat and the golden antlers are in HATS
  const CROWN = HATS.findIndex((h) => h.hd === 'crown'), SANTA = HATS.findIndex((h) => h.hd === 'santa'), ANTLERS = HATS.findIndex((h) => h.hd === 'antlers');
  // Shirts: rows 10-12 (or from row 9, when `from` says so), looking down, up (the same
  // as down unless it says), left standing and left mid-stride.
  const SHIRTS = [
    {
      name: 'Shirt & tie', hd: 'tie',
      down: ['....kwwuuwwk....', '...kswwuuwwsk...', '...kswwwwwwsk...'],
      up: ['....kwwwwwwk....', '...kswwwwwwsk...', '...kswwwwwwsk...'],
      left: ['....kuwwwwwk....', '....kuwsswwk....', '....kwwsswwk....'],
      leftWalk: ['....kuwwwwwk....', '...ksuwwwwwk....', '....kwwwwwsk....'],
    },
    {
      name: 'Blouse', hd: 'blouse',
      down: ['....kwwuuwwk....', '...kswwwwwwsk...', '...kswwwwwwsk...'],
      up: ['....kwwwwwwk....', '...kswwwwwwsk...', '...kswwwwwwsk...'],
      left: ['....kwwwwwwk....', '....kwwsswwk....', '....kwwsswwk....'],
      leftWalk: ['....kwwwwwwk....', '...kswwwwwwk....', '....kwwwwwsk....'],
    },
    {
      name: 'T-shirt', hd: 'tee',
      down: ['...kwwuuuuwwk...', '...kswwwwwwsk...', '...kswwwwwwsk...'],
      up: ['...kwwwwwwwwk...', '...kswwwwwwsk...', '...kswwwwwwsk...'],
      left: ['....kwwwwwwk....', '....kwwwwwwk....', '....kwwsswwk....'],
      leftWalk: ['....kwwwwwwk....', '...kswwwwwwk....', '....kwwwwwsk....'],
    },
    {
      name: 'Stripes', hd: 'stripes',
      down: ['....kwwwwwwk....', '...ksuuuuuusk...', '...kswwwwwwsk...'],
      left: ['....kwwwwwwk....', '....kuussuuk....', '....kwwsswwk....'],
      leftWalk: ['....kwwwwwwk....', '...ksuuuuuuk....', '....kwwwwwsk....'],
    },
    {
      name: 'Hoodie', hd: 'hoodie', from: 9,
      down: ['...kw......wk...', '...kwwuwwuwwk...', '...kwwuwwuwwk...', '...kswuuuuwsk...'],
      up: ['...kv......vk...', '....kvvvvvvk....', '...kwwvvvvwwk...', '...kswwwwwwsk...'],
      left: ['', '....kwwwwvvk....', '....kwwwwwwk....', '....kwwsswwk....'],
      leftWalk: ['', '....kwwwwvvk....', '...kwwwwwwwk....', '....kwwwwwsk....'],
    },
    {
      name: 'Suit', hd: 'suit',
      down: ['....kwWuuWwk....', '...kwwwuuwwwk...', '...kswwwwwwsk...'],
      up: ['....kwwwwwwk....', '...kwwwwwwwwk...', '...kswwwwwwsk...'],
      left: ['....kWwwwwwk....', '....kuwwwwwk....', '....kwwsswwk....'],
      leftWalk: ['....kWwwwwwk....', '...kwuwwwwwk....', '....kwwwwwsk....'],
    },
    {
      name: 'Sweater', hd: 'sweater',
      down: ['....kwwwwwwk....', '...kwuwuuwuwk...', '...kswuwwuwsk...'],
      left: ['....kwwwwwwk....', '....kuwuwuwk....', '....kwussuwk....'],
      leftWalk: ['....kwwwwwwk....', '...kwuwuwuwk....', '....kwuwuwsk....'],
    },
    {
      name: 'Hi-vis vest', hd: 'hivis',
      down: ['....kowwwwok....', '...ksoWWWWosk...', '...ksoooooosk...'],
      up: ['....kooooook....', '...ksWWWWWWsk...', '...ksoooooosk...'],
      left: ['....kooooook....', '....kWWssWWk....', '....koossook....'],
      leftWalk: ['....kooooook....', '...ksWWWWWWk....', '....kooooosk....'],
    },
  ];
  // Pants: rows 13-15, looking down (up is the same), down mid-stride, left standing and
  // left mid-stride; `top` is laid over the shirt (rows 10-12) the same four ways.
  const PANTS = [
    {
      name: 'Trousers', hd: 'trousers',
      down: ['....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....'],
      downWalk: LEGS_A,
      left: ['....kKKKKKKk....', '....kKKkKKk.....', '.....kk.kk......'],
      leftWalk: ['....kKKKKKKk....', '...kKKk..kKKk...', '...kkk....kkk...'],
    },
    {
      name: 'Shorts', hd: 'shorts',
      down: ['....kKKKKKKk....', '....ksskkssk....', '.....kk..kk.....'],
      downWalk: ['....kKKKKKKk....', '...ksskk.ksk....', '...kkk....kk....'],
      left: ['....kKKKKKKk....', '....ksskssk.....', '.....kk.kk......'],
      leftWalk: ['....kKKKKKKk....', '...kssk..kssk...', '...kkk....kkk...'],
    },
    {
      name: 'Skirt', hd: 'skirt',
      down: ['....kKKKKKKk....', '...kKKKKKKKKk...', '.....kk..kk.....'],
      downWalk: ['....kKKKKKKk....', '...kKKKKKKKKk...', '....kk....kk....'],
      left: ['....kKKKKKKk....', '...kKKKKKKKk....', '.....kk.kk......'],
      leftWalk: ['....kKKKKKKk....', '...kKKKKKKKKk...', '...kk......kk...'],
    },
    {
      name: 'Overalls', hd: 'overalls',
      down: ['....kKKKKKKk....', '....kKKkkKKk....', '.....kk..kk.....'],
      downWalk: LEGS_A,
      left: ['....kKKKKKKk....', '....kKKkKKk.....', '.....kk.kk......'],
      leftWalk: ['....kKKKKKKk....', '...kKKk..kKKk...', '...kkk....kkk...'],
      top: {
        down: ['.....K....K.....', '.....K....K.....', '...ksKKKKKKsk...'],
        up: ['.....K....K.....', '......KKKK......', '...ksKKKKKKsk...'],
        left: ['......K.........', '......K.........', '....kKKssKKk....'],
        leftWalk: ['......K.........', '......K.........', '....kKKKKKsk....'],
      },
    },
  ];
  const LOOK_PARTS = [['skin', SKINS], ['hair', HAIRS], ['hairC', HAIR_COLOURS], ['hat', HATS],
    ['shirt', SHIRTS], ['shirtC', SHIRT_COLOURS], ['pants', PANTS], ['pantsC', PANTS_COLOURS]];
  // a look with every part in range (missing or unknown ones are the first in their list)
  function lookFix(look) {
    const out = { g: look && look.g === 'female' ? 'female' : 'male' };
    for (const [k, list] of LOOK_PARTS) {
      const i = look ? Math.floor(+look[k]) : 0;
      out[k] = i >= 0 && i < list.length ? i : 0;
    }
    return out;
  }
  const lookCode = (look) => (look.g === 'female' ? 'f' : 'm') + LOOK_PARTS.map(([k]) => look[k].toString(36)).join('');
  // a look from its code, or null if it isn't one (a code with fewer parts than this copy
  // knows gets the first of each missing one, and one with more just has them ignored)
  function lookFrom(code) {
    if (typeof code !== 'string' || !/^[mf][0-9a-z]{0,15}$/.test(code)) return null;
    const look = { g: code[0] === 'f' ? 'female' : 'male' };
    LOOK_PARTS.forEach(([k], i) => { look[k] = code[i + 1] ? parseInt(code[i + 1], 36) : 0; });
    return lookFix(look);
  }
  // the nearest colour in a list to a hex colour (pick picks the hex out of a list entry)
  function nearest(list, hex, pick) {
    const [r, g, b] = hexRGB(hex);
    let best = 0, bd = Infinity;
    list.forEach((e, i) => {
      const [r2, g2, b2] = hexRGB(pick(e)), d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  // The look closest to one of the old pick-a-character looks (LOOKS), or to anyone's
  // colours: what someone who picked a character before the editor came along wears.
  function lookLike(g, c) {
    const female = g === 'female';
    return lookFix({
      g, skin: nearest(SKINS, c.s, (e) => e), hair: female ? 1 : 0, hairC: nearest(HAIR_COLOURS, c.h, (e) => e[1]), hat: 0,
      shirt: female ? 1 : 0, shirtC: nearest(SHIRT_COLOURS, c.w, (e) => e[1]) , pants: 0, pantsC: nearest(PANTS_COLOURS, c.K, (e) => e[1]),
    });
  }
  // a colour t of the way to another
  function blend(a, b, t) {
    const x = hexRGB(a), y = hexRGB(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function darker(hex, f) {
    const c = hexRGB(hex), k = hexRGB(COLORS.k);
    return '#' + c.map((v, i) => Math.round(v + (k[i] - v) * f).toString(16).padStart(2, '0')).join('');
  }
  // a look's colours, the way the rest of the game (and js/hd.js) names them
  function lookColours(look) {
    const sc = SHIRT_COLOURS[look.shirtC];
    return { h: HAIR_COLOURS[look.hairC][1], s: SKINS[look.skin], w: sc[1], u: sc[2], K: PANTS_COLOURS[look.pantsC][1] };
  }
  // how a look dresses in the parking lot's smoother style (js/hd.js): just as it is here,
  // in an ugly sweater (SWEATERS) if it names one
  const lookStyle = (look, sweater) => ({ hair: HAIRS[look.hair].hd, hat: HATS[look.hat].hd, shirt: SHIRTS[look.shirt].hd, pants: PANTS[look.pants].hd, sweater: sweaterStyle(sweater) });

  // lay rows over a buffer from row y0: '.' (or past a row's end) leaves what's there, '_' rubs it out
  function lay(b, rows, y0) {
    (rows || []).forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '_') b[(y0 + j) * 16 + i] = null; else if (ch !== '.') set(b, i, y0 + j, ch);
    }));
  }
  const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
  // One picture of a look, as a buffer: dir is 'down', 'up' or 'left', and step 0 standing,
  // 1 mid-stride or 2 the other stride (which only flips the legs, so a bow or a side
  // part stays put). noHat leaves the head thing off (under a costume). sweater (a key in
  // SWEATERS) wears that in place of the shirt, over the top of any overalls.
  function lookBuf(look, dir, step, noHat, sweater) {
    const sw = SWEATERS[sweater], b = buf(), shirt = sw ? sweaterRows(sw) : SHIRTS[look.shirt], pants = PANTS[look.pants], hair = HAIRS[look.hair], hat = HATS[look.hat];
    const side = dir === 'left', walk = step > 0;
    const torso = side ? (walk ? shirt.leftWalk : shirt.left) : (dir === 'up' && shirt.up) || shirt.down;
    lay(b, torso, shirt.from || 10);
    if (pants.top && !sw) lay(b, side ? (walk ? pants.top.leftWalk : pants.top.left) : pants.top[dir], 10);
    const legs = side ? (walk ? pants.leftWalk : pants.left) : walk ? pants.downWalk : pants.down;
    lay(b, step === 2 && !side ? mirror(legs) : legs, 13);
    lay(b, hair[dir], 0);
    if (!noHat) lay(b, hat[dir] || hat.down, 0);
    return b;
  }
  // the extra colours a 32 x 32 picture uses, from a look's colours (h, s, w, K)
  const extras32 = (c) => ({ H: darker(c.h, 0.35), v: darker(c.w, 0.25), S: darker(c.s, 0.2), f: blend(c.s, '#e04848', 0.4), j: blend(c.h, '#ffffff', 0.3), O: '#f8e070', Y: '#a87018', L: darker(c.K, 0.3), b: '#383040' });
  function lookPalette(look, over) {
    const c = lookColours(look);
    // (and for 32 x 32: S, skin in shadow, f, the cheeks, j, a shine on the hair, and O and
    // Y, light and dark gold, for the crown and the golden antlers, L, the pants in shadow,
    // and b, shoes)
    return palette(Object.assign({ H: darker(c.h, 0.35), v: darker(c.w, 0.25) }, extras32(c), c, over));
  }
  // Returns {down:[stand,walkA,walkB], up, left, right} canvases for a look, the same
  // shape renderSprites gives, in an ugly sweater if `sweater` names one.
  function renderLook(look, sweater) {
    const sw = SWEATERS[sweater], pal = lookPalette(look, sw ? sweaterPal(sw) : null), out = {};
    const make = (dir, step, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16);
      blit(img, lookBuf(look, dir, step, false, sw && sweater), 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    out.down = [make('down', 0), make('down', 1), make('down', 2)];
    out.up = [make('up', 0), make('up', 1), make('up', 2)];
    out.left = [make('left', 0), make('left', 1), make('left', 1)];
    out.right = [make('left', 0, true), make('left', 1, true), make('left', 1, true)];
    return out;
  }

  // ---------- 32 x 32 characters ----------
  // The looks drawn at double resolution (for &hires: see js/game.js), a part at a time. A
  // part that's been redrawn has a `hi` of its own, the same shape as at 16 (down, up,
  // left; rows 32 wide, laid from row 0), drawn with 2-pixel outlines and the light from
  // the top left; one that hasn't is today's, doubled with Scale2x, so a look always comes
  // out whole. Once a look's hair has been redrawn the face is HEAD32 underneath it (at 16
  // the hair and the face are one picture, so until then it's the old head, doubled).
  // Letters as at 16, plus S (skin in shadow), f (the cheeks) and j (a shine on the hair):
  // see lookPalette.
  const HEAD32 = {
    down: [
      '................................',
      '................................',
      '............kkkkkkkk............',
      '...........kkkkkkkkkk...........',
      '.........kkksssssssskkk.........',
      '........kkksssssssssskkk........',
      '.......kksssssssssssssskk.......',
      '.......kksssssssssssssskk.......',
      '......kksssssssssssssssskk......',
      '......kksssssssssssssssskk......',
      '......kkssHHHssssssHHHsSkk......',
      '.....kkSsssssssssssssssSSkk.....',
      '....kkSSsssWkssssssWkssSSSkk....',
      '....kkSSSsskksssssskksSSSSkk....',
      '.....kkSksskksssSsskkSSkSkk.....',
      '......kkkffsssSssSssSffkkk......',
      '.......kkkkSsssMMssSSkkkk.......',
      '.........kkkSSSSSSSSkkk.........',
      '...........kkkkkkkkkk...........',
      '............kkkkkkkk............',
    ],
    up: [
      '................................',
      '................................',
      '............kkkkkkkk............',
      '...........kkkkkkkkkk...........',
      '.........kkksssssssskkk.........',
      '........kkksssssssssskkk........',
      '.......kksssssssssssssskk.......',
      '.......kksssssssssssssskk.......',
      '......kksssssssssssssssskk......',
      '......kksssssssssssssssskk......',
      '......kksssssssssssssssSkk......',
      '.....kkSsssssssssssssssSSkk.....',
      '....kkSSsssssssssssssssSSSkk....',
      '....kkSSSsssssssssssssSSSSkk....',
      '.....kkSkssssssssssssSSkSkk.....',
      '......kkkSssssssssssSSSkkk......',
      '.......kkkkSsssssssSSkkkk.......',
      '.........kkkSSSSSSSSkkk.........',
      '...........kkkkkkkkkk...........',
      '............kkkkkkkk............',
    ],
    left: [
      '................................',
      '................................',
      '............kkkkkkkk............',
      '...........kkkkkkkkkk...........',
      '.........kkksssssssskkk.........',
      '........kkksssssssssskkk........',
      '.......kksssssssssssssskk.......',
      '.......kksssssssssssssskk.......',
      '......kksssssssssssssssskk......',
      '......kksssssssssssssssskk......',
      '......kksHHHHssssssssssSkk......',
      '......kksssssssssskksssSkk......',
      '......kkssWksssssskSkssSkk......',
      '......kkSskksssssskSksSSkk......',
      '.....kkSSskksssssskksSSkk.......',
      '......kkSSssffssssssSSSkk.......',
      '.......kkMMSsssssssSSkkk........',
      '........kkkkSSSSSSSSkkk.........',
      '...........kkkkkkkkkk...........',
      '............kkkkkkkk............',
    ],
  };
  // The hairstyles, by their hd name: laid over HEAD32, from row 0 (long hair and a
  // ponytail hang down past the shoulders, over the body). Bald is just the head.
  const HAIR32 = {
    short: {
      down: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhHHHHHHkk',
        '.....kkhhhhhhhHHHH.....HHkk',
        '.....kkhhHHHHH.........HHkk',
        '.....kkHH..............HHkk',
        '.....kkHH..............HHkk',
      ],
      up: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....k.HhhhhhhhhhhhhhhhHH.k',
        '........hhhhhhhhhhhhhhHH',
        '......k.HhhhhhhhhhhhhhHH.k',
        '.......kkHHHHHHHHHHHHHHkk',
        '........kkk..........kkk',
        '.........kkk........kkk',
      ],
      left: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkHHHhhhhhhhhhhhHHkk',
        '.......k...hhhhhhhhhhhhHHkk',
        '...........HHHHhhhhhhhhHHkk',
        '...............hhhhhhhhHHkk',
        '...............hhHkkHhhHHkk',
        '...............HHksskhhHHkk',
        '...............HHkSskhHHkk',
        '..................kk.hHHkk',
        '.....................HHkk',
        '.....................kkk',
        '.....................kk',
      ],
    },
    long: {
      down: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '.......kkkhhhjjjjjhhhHkkk',
        '......kkkhhhjjhhhhhhhhHkkk',
        '.....kkhhhhhjhhhhhhhhhhhHkk',
        '.....kkhhhhhhhhhhhHHHHhHHkk',
        '....kkhhhhhhhhHHHH....HhHHkk',
        '....kkhhhHHHHH.........hHHkk',
        '....kkhHH..............hHHkk',
        '...kkhhHH..............hhHHkk',
        '...kkhhHH..............hhHHkk',
        '...kkhhHH..............hhHHkk',
        '...kkhhHH..............hhHHkk',
        '...kkHhHH..............hhHHkk',
        '....kkhHHkk..........kkhHHkk',
        '....kkhhHHkk........kkhhHHkk',
        '....kkHhHHkk........kkhhHHkk',
        '.....kkHHHkk........kkhHHkk',
        '......kkHHkk........kkHHkk',
        '.......kkHkk........kkHkk',
        '........kkk..........kkk',
        '.........k............k',
      ],
      up: [
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhhhhhhhhhHkk',
        '.......kkhhhhjjjjjhhhhHkk',
        '......kkhhhhjjhhhhhhhhhHkk',
        '.....kkhhhhhjhhhhhhhhhhhHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '...kkhhhhhhhhhhhhhhhhhhhhHHkk',
        '...kkhhhhhhhhhhhhhhhhhhhhHHkk',
        '...kkHhhhHhhhHhhhHhhhHhhhHHkk',
        '...kkHhhhHhhhHhhhHhhhHhhhHHkk',
        '...kkHhhhHhhhHhhhHhhhHhhhHHkk',
        '....kkhhhHhhhHhhhHhhhHhhHHkk',
        '....kkhhhHhhhHhhhHhhhHhhHHkk',
        '....kkHhhHhhhHhhhHhhhHhhHHkk',
        '.....kkHhHhhhHhhhHhhhHhHHkk',
        '......kkHHhhhHhhhHhhhHHHkk',
        '.......kkHhhhHhhhHhhhHHkk',
        '........kkHhhHhhhHhhHHkk',
        '.........kkHHHHHHHHHHkk',
        '..........kkkkkkkkkkkk',
        '...........kkkkkkkkkk',
      ],
      left: [
        '.............kkkkkkk',
        '............kkkkkkkkkk',
        '..........kkkhhhhhhHkkk',
        '.........kkkhhhhhhhhhHkk',
        '........kkhhhjjjjjhhhhHkk',
        '.......kkhhhjjhhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhhHkk',
        '......kkHHHhhhhhhhhhhhhHHkk',
        '.......k...hhhhhhhhhhhhhHHkk',
        '...........HHhhhhhhhhhhhHHkk',
        '.............hhhhhhhhhhhHHkk',
        '.............hhhhhhhhhhhhHHkk',
        '...........k.hhhhhhhhhhhhHHkk',
        '...........k.hhhhhhhhhhhhHHkk',
        '...........k.hhhhhhhhhhhhHHkk',
        '.............hhhhhhhhhhhhHHkk',
        '.............hhhhhhhhhhhHHkk',
        '...........k.hhhhhhhhhhhHHkk',
        '...........kkhhhhhhhhhhhHHkk',
        '...........kkhhhhhhhhhhHHkk',
        '...........kkhhhhhhhhhHHkk',
        '...........kkhhhhhhhhHHkk',
        '...........kkhhhhhhhHHkk',
        '...........kkHHHHHHHHkk',
        '............kkkkkkkkkk',
        '.............kkkkkkkk',
      ],
    },
    buzz: {
      down: [
        '',
        '',
        '............kkkkkkkk',
        '...........kkkkkkkkkk',
        '.........kkkhHhhhhHHkkk',
        '........kkkhhhhHhhhhHkkk',
        '.......kkhhhHhhhhHhhhhHkk',
        '.......kkHhhhhHhhhhHhHHkk',
        '......kkHHHHHHHHHHHHHHHHkk',
        '.......k................k',
      ],
      up: [
        '',
        '',
        '............kkkkkkkk',
        '...........kkkkkkkkkk',
        '.........kkkhHhhhhHHkkk',
        '........kkkhhhhHhhhhHkkk',
        '.......kkhhhHhhhhHhhhhHkk',
        '.......kkHhhhhHhhhhHhHHkk',
        '......kkhhhHhhhhHhhhhHHHkk',
        '......kkHhhhhHhhhhHhhhHHkk',
        '......kkhhHhhhhHhhhhHhHHkk',
        '......k.hhhhHhhhhHhhhhHH.k',
        '........hHhhhhHhhhhHhhHH',
        '........HhhHhhhhHhhhhHHH',
        '........khhhhHhhhhHhhHHk',
        '.......kkHHHHHHHHHHHHHHkk',
        '........kkk..........kkk',
        '.........kkk........kkk',
      ],
      left: [
        '',
        '',
        '............kkkkkkkk',
        '...........kkkkkkkkkk',
        '.........kkkhHhhhhHHkkk',
        '........kkkhhhhHhhhhHkkk',
        '.......kkhhhHhhhhHhhhhHkk',
        '.......kkHHhhhHhhhhHhHHkk',
        '...........HHHHhHhhhhHHHkk',
        '...............hhhHhhhHHkk',
        '...............HhhhhHhHHkk',
        '...............hhHkkHhHHkk',
        '...............HHksskhHHkk',
        '...............HHkSskHHHkk',
        '..................kk.HHkk',
        '.....................HHkk',
        '.....................kkk',
        '.....................kk',
      ],
    },
    spiky: {
      down: [
        '.......kkkkkhHkkhHkkkkk',
        '......kkhHkkhHkkhHkkhHkkk',
        '......kkhHkhhhhhhhHkhHkkkk',
        '.....kkhhhhhhhhhhhhhhhhhHkk',
        '.....kkhhhhhhjjjjjhhhhhhHkk',
        '....kkhhhhhhjjhhhhhhhhhhhHkk',
        '....kkHHhhhhjhhhhhhhhhhhHHkk',
        '.....kkkhhhhhhhhhhHHHHHHkkk',
        '.....kkhhhhhhhHHHH.....HHkk',
        '.....kkhhHHHHH.........HHkk',
        '.....kkHH..............HHkk',
        '.....kkHH..............HHkk',
      ],
      up: [
        '.......kkkkkhHkkhHkkkkk',
        '......kkhHkkhHkkhHkkhHkkk',
        '......kkhHkhhhhhhhHkhHkkkk',
        '.....kkhhhhhhhhhhhhhhhhhHkk',
        '.....kkhhhhhhjjjjjhhhhhhHkk',
        '....kkhhhhhhjjhhhhhhhhhhhHkk',
        '....kkHHhhhhjhhhhhhhhhhhHHkk',
        '.....kkkhhhhhhhhhhhhhhHHkkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....k.HhhhhhhhhhhhhhhhHH.k',
        '........hhhhhhhhhhhhhhHH',
        '......k.HhhhhhhhhhhhhhHH.k',
        '.......kkHHHHHHHHHHHHHHkk',
        '........kkk..........kkk',
        '.........kkk........kkk',
      ],
      left: [
        '........kkkkkhHkkkkk',
        '.......kkhHkkhHkkhHkkkk',
        '.......kkhHkhhhHkhHkkkkk',
        '......kkhhhhhhhhhhhHkhHkkk',
        '......kkhhhhhjjjjjhhhhHkkkk',
        '.....kkhhhhhjjhhhhhhhhhhhHkk',
        '.....kkhhhhhjhhhhhhhhhhhhHkk',
        '....kkHHHHHhhhhhhhhhhhhhhHHkk',
        '.....kkk...hhhhhhhhhhhhHHkkk',
        '......kk...HHHHhhhhhhhhHHkk',
        '...............hhhhhhhhHHkk',
        '...............hhHkkHhhHHkk',
        '...............HHksskhhHHkk',
        '...............HHkSskhHHkk',
        '..................kk.hHHkk',
        '.....................HHkk',
        '.....................kkk',
        '.....................kk',
      ],
    },
    curly: {
      down: [
        '......kkkkhhhhhjhhhhjHkkkk',
        '.....kkkkhHhHhhhhHhhhhHkkkk',
        '....kkhhhhHhHhhhhHhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhhHkk',
        '...kkHhhhjhhhhjhjhhhhjhhhhHkk',
        '....kkHhhhhHhhhhhhHhhhhHhHkk',
        '...kkkhhhhhhhhhhhhhhhhhhhHkkk',
        '..kkhhhhhhhhhhhhhhhhhhhhhhHHkk',
        '..kkhhhhjHHHHHHHHHHHHHHhhhHHkk',
        '..kkhHhHH..............hHhHHkk',
        '..kkhHhHH..............hHhHHkk',
        '..kkhhhHH..............hhhHHkk',
        '.kkhhhhHH..............hhhhHHkk',
        '.kkHHhHHH..............HhhhHHkk',
        '..kkHHHHH..............HHHHHkk',
        '...kkkkkk..............kkkkkk',
        '....kkkkk..............kkkkk',
      ],
      up: [
        '......kkkkhhhhhjhhhhjHkkkk',
        '.....kkkkhHhHhhhhHhhhhHkkkk',
        '....kkhhhhHhHhhhhHhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhhHkk',
        '...kkHhhhjhhhhjhjhhhhjhhhhHkk',
        '....kkHhhhhHhhhhhhHhhhhHhHkk',
        '...kkkhhhhhhhhhhhhhhhhhhhHkkk',
        '..kkhhhhhhhhhhhhhhhhhhhhhhHHkk',
        '..kkhhhhjhhhhhhjhhhhjhjhhhHHkk',
        '..kkhHhhhhHhHhhhhHhhhhhhHhHHkk',
        '..kkhHhhhhHhHhhhhHhhhhhhHhHHkk',
        '..kkhhhhhhhhhhhhhhhhhhhhhhHHkk',
        '.kkhhhhhhhhhhhhhhhhhhhhhhhhHHkk',
        '.kkHHhHhhhhHhhhhhhHhhhhHhhhHHkk',
        '..kkHhhhhhhhhhhhhhhhhhhhhhHHkk',
        '...kkHHHhhhhhhhhhhhhhhhhHHHkk',
        '....kkkkHhhhhhhhhhhhhhHHkkkk',
        '.....kkkkHHHHHHHHHHHHHHkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.........kkkkkkkkkkkkkk',
      ],
      left: [
        '......kkkkhhhhhjhhhhjHkkkk',
        '.....kkkkhHhHhhhhHhhhhHkkkk',
        '....kkhhhhHhHhhhhHhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhhHkk',
        '...kkHhhhjhhhhjhjhhhhjhhhhHkk',
        '....kkHhhhhHhhhhhhHhhhhHhHkk',
        '...kkkhhhhhhhhhhhhhhhhhhhHkkk',
        '..kkhhhhhhhhhhhhhhhhhhhhhhHHkk',
        '..kkHHHHHHhhhhhjhhhhjhjhhhHHkk',
        '...kkkkk..HHHhhhhHhhhhhhHhHHkk',
        '....kkkk....HhhhhHhhhhhhHhHHkk',
        '............hhhhhhhhhhhhhhHHkk',
        '...........khhhhhhhhhhhhhhhHHkk',
        '..........kkhhhhhhHhhhhHhhhHHkk',
        '..........kkhhhhhhhhhhhhHhHHkk',
        '............hhhhhhhhhhHHkHHkk',
        '............HHHHHHHHHHkkkkkk',
        '...........k........kkkk.kk',
        '............kkkkkkkkkk',
      ],
    },
    bob: {
      down: [
        '..............kkkk',
        '...........kkkkkkkkkk',
        '.........kkkkkhhhHkkkkk',
        '........kkkhhhhhhhhhHkkk',
        '.......kkhhhhjjjjjhhhhHkk',
        '......kkhhhhjjhhhhhhhhhHkk',
        '.....kkhhhhhjhhhhhhhhhhhHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhHHHHHHHHHHHHhhHHkk',
        '....kkhhHH............hhHHkk',
        '....kkhhHH............hhHHkk',
        '....kkhhHH............hhHHkk',
        '....kkhhHH..........k.hhHHkk',
        '....kkHhHH.k........k.hhHHkk',
        '.....kkhHH.k........k.hHHkk',
        '.....kkHHH............hHHkk',
        '......kkHHk..........kHHkk',
        '.......kkHkk........kkHkk',
        '........kkk..........kkk',
        '.........k............k',
      ],
      up: [
        '..............kkkk',
        '...........kkkkkkkkkk',
        '.........kkkkkhhhHkkkkk',
        '........kkkhhhhhhhhhHkkk',
        '.......kkhhhhjjjjjhhhhHkk',
        '......kkhhhhjjhhhhhhhhhHkk',
        '.....kkhhhhhjhhhhhhhhhhhHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkhhhhhhhhhhhhhhhhhhHHkk',
        '....kkHhhHhhhHhhhHhhhHhhHHkk',
        '.....kkhhHhhhHhhhHhhhHhHHkk',
        '.....kkHhHhhhHhhhHhhhHhHHkk',
        '......kkHHhhhHhhhHhhhHHHkk',
        '.......kkHHhhHhhhHhhhHHkk',
        '........kkkHHHHHHHHHHkkk',
        '.........kkkkkkkkkkkkkk',
        '...........kkkkkkkkkk',
      ],
      left: [
        '..............kkkk',
        '...........kkkkkkkkkk',
        '.........kkkkkhhhHkkkkk',
        '........kkkhhhhhhhhhHkkk',
        '.......kkhhhhjjjjjhhhhHkk',
        '......kkhhhhjjhhhhhhhhhHkk',
        '.....kkhhhhhjhhhhhhhhhhhHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '....kkHHHHHHhhhhhhhhhhhhHHkk',
        '.....kkk....hhhhhhhhhhhhHHkk',
        '......kk....hhhhhhhhhhhhHHkk',
        '............hhhhhhhhhhhhHHkk',
        '...........khhhhhhhhhhhhHHkk',
        '..........kkhhhhhhhhhhhhHHkk',
        '..........kkhhhhhhhhhhhHHkk',
        '............hhhhhhhhhhhHHkk',
        '............hhhhhhhhhhHHkk',
        '..........kkHHHHHHHHHHHkk',
        '...........kkkkkkkkkkkkk',
        '............kkkkkkkkkkk',
      ],
    },
    ponytail: {
      down: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhhhhhHHkk',
        '.....kkhhHHHHHHHHHHHHHHHHkk',
        '.....kkHH..............HHkk',
        '.....kkHH..............HHkk',
        '......k..................k',
      ],
      up: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....k.HhhhhhhhhhhhhhhhHH.k',
        '........hHhhhHhhhHhhhHHH',
        '......k.HHHHHHhhhHHHHHHH.k',
        '.......kk.....hhHH.....kk',
        '........kkk...hhHH...kkk',
        '..............hhHH',
        '............kkhhHHkk',
        '............kkhhHHkk',
        '............kkHhHHkk',
        '.............kkHHkk',
        '.............kkHHkk',
        '.............kkHHkk',
        '.............kkHHkk',
        '..............kkkk',
        '...............kk',
      ],
      left: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkHHHhhhhhhhhhhhHHkkk',
        '.......k...HHHHhhhhhhhhHHkkk',
        '...............hhhhhhhhhhHHkk',
        '...............hhhhhhhhhhHHkk',
        '...............hhHkkHhhhhHHkk',
        '...............HHksskhhhhhHHkk',
        '...............HHkSskHHhhhHHkk',
        '..................kk...hhhHHkk',
        '.......................hhhHHkk',
        '.....................kkHhhHHkk',
        '......................kkhhHHkk',
        '......................kkhHHkk',
        '......................kkhHHkk',
        '......................kkHHHkk',
        '.......................kkkkk',
        '........................kkk',
      ],
    },
    bun: {
      down: [
        '...........kkhhhhhHkk',
        '..........kkhhhhhhhHkk',
        '..........kkhhhhhhhHkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhhhhhHHkk',
        '.....kkhhHHHHHHHHHHHHHHHHkk',
        '.....kkHH..............HHkk',
        '.....kkHH..............HHkk',
        '......k..................k',
      ],
      up: [
        '...........kkhhhhhHkk',
        '..........kkhhhhhhhHkk',
        '..........kkhhhhhhhHkk',
        '.........kkkhhhhhhhHkkk',
        '........kkhhhjjjjjhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....kkhhhhhhhhhhhhhhhhHHkk',
        '.....k.HhhhhhhhhhhhhhhhHH.k',
        '........hhhhhhhhhhhhhhHH',
        '......k.HHHHHHHHHHHHHHHH.k',
        '.......kk..............kk',
        '........kkk..........kkk',
      ],
      left: [
        '..............kkhhhhhHkk',
        '............kkkhhhhhhhHkk',
        '..........kkkkkhhhhhhhHkk',
        '.........kkkhhhhhhhhhhHkk',
        '........kkhhhjjjjjhhhhHkk',
        '.......kkhhhjjhhhhhhhhHkk',
        '......kkhhhhjhhhhhhhhhhHkk',
        '......kkHHHhhhhhhhhhhhHHkk',
        '.......k...HHHHhhhhhhhhHHkk',
        '...............hhhhhhhhHHkk',
        '...............hhhhhhhhHHkk',
        '...............hhHkkHhhHHkk',
        '...............HHksskhhHHkk',
        '...............HHkSskHHHkk',
        '..................kk...kk',
        '.......................k',
      ],
    },
    bald: { down: [], up: [], left: [] },
  };
  for (const h of HAIRS) if (HAIR32[h.hd]) h.hi = HAIR32[h.hd];
  // The head things, by their hd name: laid over the hair. A hat that covers the top of the
  // head starts with rows of '_', which tuck the hair in under it: the bare head goes back
  // there (see lookBuf32), so hair can't poke out through the top of a hat.
  const HAT32 = {
    cap: {
      down: [
        '___________kkkkkkkkkk___________',
        '_________kkkkkrrMrkkkkk_________',
        '________kkkrrrrrrrrrMkkk________',
        '_______kkrrRRRRrrrrrrrMkk_______',
        '______kkrrRRRRRRrrrrrrrMkk______',
        '______kkrrrRRRRWWrrrrrrMkk______',
        '.....kkrrrrrrrrWWrrrrrrrMkk',
        '.....kkrrrrrrrrrrrrrrrrrMkk',
        '....kkrrrrrrrrrrrrrrrrrrrrkk',
        '...kkrrrrrrrrrrrrrrrrrrrrrrkk',
        '....kkkMMMMMMMMMMMMMMMMMMkkk',
        '.....kk..................kk',
        '............k.......k',
      ],
      up: [
        '___________kkkkkkkkkk___________',
        '_________kkkkkrrMrkkkkk_________',
        '________kkkrrrrrrrrrMkkk________',
        '_______kkrrRRRRrrrrrrrMkk_______',
        '______kkrrRRRRRRrrrrrrrMkk______',
        '______kkrrrRRRRrrrrrrrrMkk______',
        '.....kkrrrrrrrrrrrrrrrrrMkk',
        '.....kkrrrrrrr....rrrrrrMkk',
        '.....kkrrrrrMM....MMrrrrMkk',
        '......kk................kk',
        '.......k................k',
      ],
      left: [
        '___________kkkkkkkkkk___________',
        '_________kkkkkrMrrkkkkk_________',
        '________kkkrrrrrrrrrMkkk________',
        '_______kkrrRRRRrrrrrrrMkk_______',
        '______kkrrRRRRRRrrrrrrrMkk______',
        '_kkkkkkkrrrRRRRrrrrrrrrMkk______',
        'kkkkkkkrrrrrrrrrrrrrrrrrMkk',
        'krrrrrrrrrrrrrrrrrrrrrrrMkk',
        'krrrrrrrrrrrrrrrrrrrrrrrMkk',
        'kkMMMMMMMMMM............kk',
        '.kkkkkkk................k',
        '..kkkkkk',
      ],
    },
    toque: {
      down: [
        '___________kkkWGWWkkk___________',
        '__________kkkWGWWGWkkk__________',
        '_________kkEEEWWGWEEekk_________',
        '________kkEEeEEeEEeEEekk________',
        '_______kkeEEeEEeEEeEEeekk_______',
        '______kkEeEEeEEeEEeEEeEekk______',
        '_____kkeeeeeeeeeeeeeeeeeekk_____',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '.....kkkeeeeeeeeeeeeeeeekkk',
        '......kk................kk',
      ],
      up: [
        '___________kkkWGWWkkk___________',
        '__________kkkWGWWGWkkk__________',
        '_________kkEEEWWGWEEekk_________',
        '________kkEEeEEeEEeEEekk________',
        '_______kkeEEeEEeEEeEEeekk_______',
        '______kkEeEEeEEeEEeEEeEekk______',
        '_____kkeeeeeeeeeeeeeeeeeekk_____',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '.....kkkeeeeeeeeeeeeeeeekkk',
        '......kk................kk',
      ],
      left: [
        '___________kkkkGWWGkk___________',
        '__________kkkkGWWGWWkk__________',
        '_________kkEEEEWGWWEekk_________',
        '________kkEEeEEeEEeEEekk________',
        '_______kkeEEeEEeEEeEEeekk_______',
        '______kkEeEEeEEeEEeEEeEekk______',
        '_____kkeeeeeeeeeeeeeeeeeekk_____',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '....kkEeEeEeEeEeEeEeEeEeEekk',
        '.....kkkeeeeeeeeeeeeeeeekkk',
        '......kk................kk',
        '..................kk',
      ],
    },
    hardhat: {
      down: [
        '___________kkkkkkkkkk___________',
        '_________kkkkooqqoqkkkk_________',
        '________kkkooooqqoooqkkk________',
        '_______kkoOOOOOqqoooooqkk_______',
        '_______kkoOOOOOqqoooooqkk_______',
        '______kkooOOOOOqqooooooqkk______',
        '_____kkooooooooqqooooooqqkk_____',
        '.....kkooooooooqqoooooooqkk',
        '....kkooooooooooooooooooookk',
        '...kkooooooooooooooooooooookk',
        '....kkkqqqqqqqqqqqqqqqqqqkkk',
        '.....kk..................kk',
        '............k.......k',
      ],
      up: [
        '___________kkkkkkkkkk___________',
        '_________kkkkooqqoqkkkk_________',
        '________kkkooooqqoooqkkk________',
        '_______kkoOOOOOqqoooooqkk_______',
        '_______kkoOOOOOqqoooooqkk_______',
        '______kkooOOOOOqqooooooqkk______',
        '_____kkooooooooqqooooooqqkk_____',
        '.....kkooooooooqqoooooooqkk',
        '....kkooooooooooooooooooookk',
        '...kkooooooooooooooooooooookk',
        '....kkkqqqqqqqqqqqqqqqqqqkkk',
        '.....kk..................kk',
      ],
      left: [
        '___________kkkkkkkkkk___________',
        '_________kkkkoooooqkkkk_________',
        '________kkkoooooooooqkkk________',
        '_______kkoOOOOOoooooooqkk_______',
        '_______kkoOOOOOoooooooqkk_______',
        '______kkooOOOOOooooooooqkk______',
        '_____kkooooooooooooooooqqkk_____',
        '.....kkoooooooooooooooooqkk',
        '....kkooooooooooooooooooookk',
        '...kkooooooooooooooooooooookk',
        '....kkkqqqqqqqqqqqqqqqqqqkkk',
        '.....kkk..........kk....kkk',
        '.......k...k......k.k...k',
      ],
    },
    cowboy: {
      down: [
        '_________kkkkkkkkkkkkkk_________',
        '________kkNNNknnnnknnnkk________',
        '_______kkNNNNnnDDnnnnnnkk_______',
        '_______kkNNNNnnnnnnnnnnkk_______',
        'k______kkNNNNnnnnnnnnnnkk______k',
        'kkk____kkNNNNnnnnnnnnnnkk____kkk',
        'NkkkkkkkDDDDDDDDDDDDDDDDkkkkkkkN',
        'kNNkkkkkDDDDDDDDDDDDDDDDkkkkkNNk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'kkkkkDDDDDDDDDDDDDDDDDDDDDDkkkkk',
        '.kkkkkk..................kkkkkk',
        '.....k......k.......k.....k',
      ],
      up: [
        '_________kkkkkkkkkkkkkk_________',
        '________kkNNNknnnnknnnkk________',
        '_______kkNNNNnnDDnnnnnnkk_______',
        '_______kkNNNNnnnnnnnnnnkk_______',
        'k______kkNNNNnnnnnnnnnnkk______k',
        'kkk____kkNNNNnnnnnnnnnnkk____kkk',
        'NkkkkkkkDDDDDDDDDDDDDDDDkkkkkkkN',
        'kNNkkkkkDDDDDDDDDDDDDDDDkkkkkNNk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'kkkkkDDDDDDDDDDDDDDDDDDDDDDkkkkk',
        '.kkkkkk..................kkkkkk',
        '.....k....................k',
      ],
      left: [
        '_________kkkkkkkkkkkkkk_________',
        '________kkNNNknnnnknnnkk________',
        '_______kkNNNNnnDDnnnnnnkk_______',
        '_______kkNNNNnnnnnnnnnnkk_______',
        'k______kkNNNNnnnnnnnnnnkk______k',
        'kkk____kkNNNNnnnnnnnnnnkk____kkk',
        'NkkkkkkkDDDDDDDDDDDDDDDDkkkkkkkN',
        'kNNkkkkkDDDDDDDDDDDDDDDDkkkkkNNk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnk',
        'kkkkkDDDDDDDDDDDDDDDDDDDDDDkkkkk',
        '.kkkkkkk..........kk....kkkkkkk',
        '.....kkk...k......k.k...kkk',
      ],
    },
    headphones: {
      down: [
        '...........kkkggggkkk',
        '.........kkggggggggggkk',
        '........kggggkkkkkkggggk',
        '.......kgggkk......kkgggk',
        '......kggkk..........kkggk',
        '......kggk............kggk',
        '.....kggk..............kggk',
        '.....kgk................kgk',
        '.....kgk................kgk',
        '....kggk................kggk',
        '...kMMMk................kMMMk',
        '..kMrrMM................MrrMMk',
        '..kMrrMM................MrrMMk',
        '..kMrrMM................MrrMMk',
        '..kMMrMMk..............kMMrMMk',
        '...kMMMk................kMMMk',
        '....kkk..................kkk',
      ],
      up: [
        '...........kkkggggkkk',
        '.........kkggggggggggkk',
        '........kggggkkkkkkggggk',
        '.......kgggkk......kkgggk',
        '......kggkk..........kkggk',
        '......kggk............kggk',
        '.....kggk..............kggk',
        '.....kgk................kgk',
        '.....kgk................kgk',
        '....kggk................kggk',
        '...kMMMk................kMMMk',
        '..kMrrMM................MrrMMk',
        '..kMrrMM................MrrMMk',
        '..kMrrMM................MrrMMk',
        '..kMMrMMk..............kMMrMMk',
        '...kMMMk................kMMMk',
        '....kkk..................kkk',
      ],
      left: [
        '................kgk',
        '................kgk',
        '...............kgkgk',
        '...............kgkgk',
        '................g.g',
        '................g.g',
        '................g.g',
        '................g.g',
        '................g.g',
        '................g.g',
        '................gMMM',
        '................MrrMM',
        '................MrrMM',
        '................MrrMM',
        '................MMrMM',
        '.................MMM',
      ],
    },
    glasses: {
      down: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.........kkkkkk...kkkkkk',
        '.......kkk...Wkkkkk...Wkk',
        '.........k....k...k....k',
        '.........k....k...k....k',
        '.........kkkkkk...kkkkkk',
      ],
      up: [],
      left: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.......kkkkkk',
        '.......k...Wkkkkkk',
        '.......k....k',
        '.......k....k',
        '.......kkkkkk',
      ],
    },
    shades: {
      down: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.......kkkkkkkkkkkkkkkkkk',
        '.........kggkkk...kggkkk',
        '.........kkkkkk...kkkkkk',
        '..........kkkk.....kkkk',
      ],
      up: [],
      left: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.......kkkkkkkkkkk',
        '.......kggkkk',
        '.......kkkkkk',
        '........kkkk',
      ],
    },
    bow: {
      down: [
        '.................kkkk..kkkk',
        '................kkRRkkkkRRkk',
        '................kkRRRkkrRRkk',
        '................kkRRRMMrRRkk',
        '..................rrrMMrrrkk',
        '..................rrrkkrrrkk',
        '..................rr...krrkk',
        '.......................kkkk',
        '........................kk',
      ],
      up: [
        '.....kkkk..kkkk',
        '....kkRRkkkkRRkk',
        '....kkRRRkkrRRkk',
        '....kkRRRMMrRRkk',
        '....kkrrrMMrrr',
        '....kkrrrkkrrr',
        '....kkrrk...rr',
        '.....kkkk',
        '......kk',
      ],
      left: [
        '..........kkRRRkkrRRkk',
        '..........kkRRRMMrRRkk',
        '..........kkrrrMMrrrkk',
        '..........kkrrrkkrrrkk',
        '..........kkrr....rrkk',
      ],
    },
    crown: {
      down: [
        '______kkPPPkkkkPPkkkkPPPkk______',
        '_______kkPkk_kkPPkk_kkPkk_______',
        '______kkOookkkkOokkkkOookk______',
        '______kkOookkkOOookkkOookk______',
        '.....kkOOooo.OOOooo.OOoookk',
        '....kkOOOooooOOOoooOOOooookk',
        '.....kkkoooUooorroooUoookkk',
        '......kkoooUooorroooUoookk',
        '......kkYYYYYYYYYYYYYYYYkk',
        '.......k................k',
      ],
      up: [
        '______kkPPPkkkkPPkkkkPPPkk______',
        '_______kkPkk_kkPPkk_kkPkk_______',
        '______kkOookkkkOokkkkOookk______',
        '______kkOookkkOOookkkOookk______',
        '.....kkOOooo.OOOooo.OOoookk',
        '....kkOOOooooOOOoooOOOooookk',
        '.....kkkooooooooooooooookkk',
        '......kkooooooooooooooookk',
        '......kkYYYYYYYYYYYYYYYYkk',
        '.......k................k',
      ],
      left: [
        '______kkPPPkkkkPPkkkkPPPkk______',
        '_______kkPkk_kkPPkk_kkPkk_______',
        '______kkOookkkkOokkkkOookk______',
        '______kkOookkkOOookkkOookk______',
        '.....kkOOooo.OOOooo.OOoookk',
        '....kkOOOooooOOOoooOOOooookk',
        '.....kkkooroooooooooooookkk',
        '......kkooroooooooooooookk',
        '......kkYYYYYYYYYYYYYYYYkk',
        '.......k................k',
      ],
    },
    santa: {
      down: [
        '____________kkkrrrrrrrrrrMkk____',
        '__________kkkkrrrrrrrrrrrrMkk___',
        '_________kkkrrrrrrrrrrrrrrrMkk__',
        '________kkrrrkMrrrrrMMMMrrrMkk__',
        '_______kkrrrrrkMMMMMkkkkMrrMkk__',
        '______kkrrrrrrrkkkkkrrrMkrrrMkk_',
        '_____kkWWWGWWWGWWWGWWWGWWMrrMkk_',
        '....kkWWWGWWWGWWWGWWWGWWWGrrMkk',
        '....kkWWGWWWGWWWGWWWGWWWGWrrMkk',
        '.....kkkGGGGGGGGGGGGGGGGkkkkkkk',
        '......kk................kkGWWkkk',
        '........................kGWWGGkk',
        '........................kWWGWGkk',
        '.........................kGWWkkk',
        '.......................k.kkkkkkk',
        '........................kkkkkkk',
        '.........................kkkkk',
      ],
      up: [
        '____kkMrrrrrrrrrrkkk____________',
        '___kkMrrrrrrrrrrrrkkkk__________',
        '__kkMrrrrrrrrrrrrrrrkkk_________',
        '__kkMrrrMMMMrrrrrMkrrMkk________',
        '__kkMrrMkkkkMMMMMkrrrrMkk_______',
        '_kkMrrrkrrrrkkkkkrrrrrrMkk______',
        '_kkMrrMWWWGWWWGWWWGWWWGWWkk_____',
        '.kkMrrWWWGWWWGWWWGWWWGWWWGkk',
        '.kkMrrWWGWWWGWWWGWWWGWWWGWkk',
        '.kkkkkkkGGGGGGGGGGGGGGGGkkk',
        'kkkGWGkk................kk',
        'kkGGGWWk',
        'kkGGWWGk',
        'kkkGWGk',
        'kkkkkkk.k',
        '.kkkkkkk',
        '..kkkkk',
      ],
      left: [
        '____________kkkrrrrrrrrrrMkk____',
        '__________kkkkrrrrrrrrrrrrMkk___',
        '_________kkkrrrrrrrrrrrrrrrMkk__',
        '________kkrrrkMrrrrrMMMMrrrMkk__',
        '_______kkrrrrrkMMMMMkkkkMrrMkk__',
        '______kkrrrrrrrkkkkkrrrMkrrrMkk_',
        '_____kkWWWGWWWGWWWGWWWGWWMrrMkk_',
        '....kkWWWGWWWGWWWGWWWGWWWGrrMkk',
        '....kkWWGWWWGWWWGWWWGWWWGWrrMkk',
        '.....kkkGGGGGGGGGGGGGGGGkkkkkkk',
        '......kk................kkGWWkkk',
        '..................kk....kGWWGGkk',
        '........................kWWGWGkk',
        '........................kkGWWkkk',
        '.......................kkkkkkkkk',
        '........................kkkkkkk',
        '.........................kkkkk',
      ],
    },
    antlers: {
      down: [
        '.kkOkkkWkkOkk......kkOkkWkkkOkk',
        '.kkOokkOokOkk......kkOkoOkkoOkk',
        '..kkOooOookk........kkooOooOkk',
        '...kkkooOokk........kkoOookkk',
        '....kkkkOokk........kkoOkkkk',
        '......kkkOY..........YOkkk',
        '........k.oY........Yo.k',
      ],
      up: [
        '.kkOkkkWkkOkk......kkOkkWkkkOkk',
        '.kkOokkOokOkk......kkOkoOkkoOkk',
        '..kkOooOookk........kkooOooOkk',
        '...kkkooOokk........kkoOookkk',
        '....kkkkOokk........kkoOkkkk',
        '......kkkOY..........YOkkk',
        '........k.oY........Yo.k',
      ],
      left: [
        '....kkOkkkWkkOkk...kkOkkWkkkOkk',
        '....kkOokkOokOkk...kkOkoOkkoOkk',
        '.....kkOooOookk.....kkooOooOkk',
        '......kkkooOokk.....kkoOookkk',
        '.......kkkkOo.......kkoOkkkk',
        '.........kk.OY.......YOkkk',
        '.............oY.....Yo.k',
      ],
    },
  };
  for (const h of HATS) if (HAT32[h.hd]) h.hi = HAT32[h.hd];
  // The shirts, by their hd name: the body from the shoulders to the waist (rows 20-25;
  // the hoodie's hood from 18, behind the head), arms and hands and all, looking down, up,
  // left, and left mid-stride (the near arm swung forward). `from` is the row they start on.
  const SHIRT32 = {
    tie: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwvuuuuvwvkkkk',
        '......kkwwwwwwwuuwwwvvvvkk',
        '......kkwwkwwwwuUwwwvkvvkk',
        '......kkwwkwwwwuuwwwvkvvkk',
        '......kksskwwwwuuwwwvkSSkk',
        '......kksskvvvvuuvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkwwwwwwwwwwwwvvvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkuvwwwwwwwvkk',
        '........kkuuwwwwvkwwvvkk',
        '........kkuuwwwwvkwwvvkk',
        '........kkuuwwwwvkwwvvkk',
        '........kkwwwwssskwwvvkk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkuwwwwwwwwvkk',
        '........kkuuwvvvkwwwvvkk',
        '.......kkkuuvvvkkwwwvvkk',
        '......kkkkuvvvkkwwwwvvkkk',
        '.....kksssvvvkkwwwwwvvSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    blouse: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwsssssswvkkkk',
        '......kkwwwwwussssuwvvvvkk',
        '......kkwwkwwwuuuuwwvkvvkk',
        '......kkwwkwwwwvuwwwvkvvkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkwwwwwwwwwwwwvvvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkswwwwwwwwvkk',
        '........kkuwwwwwvkwwvvkk',
        '........kkwuwwwwvkwwvvkk',
        '........kkwwwwwwvkwwvvkk',
        '........kkwwwwssskwwvvkk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkswwwwwwwwvkk',
        '........kkuwwvvvkwwwvvkk',
        '.......kkkwuvvvkkwwwvvkk',
        '......kkkkwvvvkkwwwwvvkkk',
        '.....kksssvvvkkwwwwwvvSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    tee: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwuussssuuvkkkk',
        '......kkwwwwwuuuuuuwvvvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwuuuuuuuuvkkkk',
        '......kkwwwwwwwwwwwwvvvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskwwwwwwwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkuuwwwwwwwvkk',
        '........kkswwwwwvkwwvvkk',
        '........kkwwwwwwvkwwvvkk',
        '........kkwwwwssSkwwvvkk',
        '........kkwwwwssskwwvvkk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkuuwwwwwwwvkk',
        '........kkswwvvvkwwwvvkk',
        '.......kkkwwvvvkkwwwvvkk',
        '......kkkkwssskkwwwwvvkkk',
        '.....kksssssskkwwwwwvvSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    stripes: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwsssswwvkkkk',
        '......kkuuuuuuuuuuuuuuuukk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskuuuuuuuuuukSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkuuuuuuuuuuuuuuuukk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kksskuuuuuuuuuukSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwwwwwwwwwvkk',
        '........kkuuuuuuukuuuukk',
        '........kkwwwwwwvkwwvvkk',
        '........kkwwwwwwvkwwvvkk',
        '........kkuuuussskuuuukk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwwwwwwwwwvkk',
        '........kkuuuuuukuuuuukk',
        '.......kkkwwvvvkkwwwvvkk',
        '......kkkkwvvvkkwwwwvvkkk',
        '.....kksssuuukkuuuuuuuSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    hoodie: {
      from: 17,
      down: [
        '.........kk..........kk',
        '........kwwkkkkkkkkkkwwk',
        '........kwwkkkkkkkkkkwwk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkwwwwwuwwwwuwvvvvkk',
        '......kkwwkwwuwwwwuwvkvvkk',
        '......kkwwkwwWwwwwWwvkvvkk',
        '......kkvvkvuuuuuuuuvkvvkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '...........wwwwwwwvvv',
        '........kkkwwwwwwwvvvkkk',
        '.......kkkkvvvvvvvvvvkkkk',
        '......kkwwwwvvvvvvvvvvvvkk',
        '......kkwwkwwvvvvvvwvkvvkk',
        '......kkwwkwwwwwwwwwvkvvkk',
        '......kkvvkwwwwwwwwwvkvvkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '.................kkkkk',
        '...........kkkkkkwwwwwk',
        '..........kkkkkkkwwwwwk',
        '.........kkwwwwwwvvvvvk',
        '........kkuwwwwwvvvvvvkk',
        '........kkWwwwwwvkwwvvkk',
        '........kkwwwwwwvkwwvvkk',
        '........kkwwwwvvvkwwvvkk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '.................kkkkk',
        '...........kkkkkkwwwwwk',
        '..........kkkkkkkwwwwwk',
        '.........kkwwwwwwvvvvvk',
        '........kkuwwvvvkvvvvvkk',
        '.......kkkWwvvvkkwwwvvkk',
        '......kkkkwvvvkkwwwwvvkkk',
        '.....kkvvvvvvkkwwwwwvvvvkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    suit: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwWWuuWWwvkkkk',
        '......kkwwwwwvWuuWvwvvvvkk',
        '......kkwwkwwwvuuvwwvkvvkk',
        '......kkwwkwvvwWWwwwvkvvkk',
        '......kksskwwwwwkwwwvkSSkk',
        '......kksskvvvvvkvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkwwwwwwwwwwwwvvvvkk',
        '......kkwwkwwwwwvwwwvkvvkk',
        '......kkwwkwwwwwvwwwvkvvkk',
        '......kksskwwwwwvwwwvkSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkWwwwwwwwwvkk',
        '........kkuWwwwwvkwwvvkk',
        '........kkuwwwwwvkwwvvkk',
        '........kkwwwwwwvkwwvvkk',
        '........kkwwwwssskwwvvkk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkWwwwwwwwwvkk',
        '........kkuWwvvvkwwwvvkk',
        '.......kkkuwvvvkkwwwvvkk',
        '......kkkkwvvvkkwwwwvvkkk',
        '.....kksssvvvkkwwwwwvvSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    sweater: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwvvvvvvwvkkkk',
        '......kkuuuuuuuuuuuuuuuukk',
        '......kkwukwwuwwwuwwvuvvkk',
        '......kkuwuwuwuwuwuwukuvkk',
        '......kkssuuuuuuuuuuuuSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkwwwwwwwwwvkkkk',
        '......kkuuuuuuuuuuuuuuuukk',
        '......kkwukwwuwwwuwwvuvvkk',
        '......kkuwuwuwuwuwuwukuvkk',
        '......kkssuuuuuuuuuuuuSSkk',
        '......kksskvvvvvvvvvvkSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwwwwwwwwwvkk',
        '........kkuuuuuuuuuuuukk',
        '........kkwwwuwwvuwwvukk',
        '........kkuwuwuwukuwuvkk',
        '........kkuuuusssuuuuukk',
        '........kkvvvvSSSkvvvvkk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwwwwwwwwwvkk',
        '........kkuuuuuuuuuuuukk',
        '.......kkkwwvuvkkuwwvukk',
        '......kkkkuvuvukuwuwuvkkk',
        '.....kksssuuuuuuuuuuuuSSkk',
        '.....kkSSSkkkkvvvvvvvvSSkk',
      ],
    },
    hivis: {
      from: 18,
      down: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkooowwwwoookkkk',
        '......kkwwoooowwwwoooovvkk',
        '......kkwwWWWWWwwWWWWWvvkk',
        '......kkwwWWWWWWWWWWWWvvkk',
        '......kkssoooooqqoooooSSkk',
        '......kkssqqqqqqqqqqqqSSkk',
      ],
      up: [
        '...........kkkkkkkkkk',
        '........kkkkkkkkkkkkkkkk',
        '.......kkkkooooooooookkkk',
        '......kkwwoooooooooooovvkk',
        '......kkwwWWWWWWWWWWWWvvkk',
        '......kkwwWWWWWWWWWWWWvvkk',
        '......kkssooooooooooooSSkk',
        '......kkssooooooooooooSSkk',
      ],
      left: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwoooooooookk',
        '........kkoooowwvoooookk',
        '........kkWWWWwwvWWWWWkk',
        '........kkWWWWwwvWWWWWkk',
        '........kkoooosssoooookk',
        '........kkooooSSSoooookk',
      ],
      leftWalk: [
        '...........kkkkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkwoooooooookk',
        '........kkooovvvooooookk',
        '.......kkkWWvvvWWWWWWWkk',
        '......kkkkWvvvWWWWWWWWkkk',
        '.....kksssvvvoooooooooSSkk',
        '.....kkSSSooooooooooooSSkk',
      ],
    },
  };
  for (const s of SHIRTS) if (SHIRT32[s.hd]) s.hi = SHIRT32[s.hd];
  // The pants, by their hd name: hips, legs and shoes, rows 26-31, looking down (up is the
  // same), down mid-stride (the other stride is the same mirrored), left and left
  // mid-stride; overalls' `top` is laid over the shirt from row 20. L is the pants' shade
  // and b the shoes (see lookPalette).
  const PANTS32 = {
    trousers: {
      down: [
        '........kkLLLLLqqLLLLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKLkkKKKLLkk',
        '........kkKKKKLkkKKKLLkk',
        '........kkgbbgbkkgbgbbkk',
        '........kkbbbbbkkbbbbbkk',
      ],
      downWalk: [
        '........kkLLLLLqqLLLLLkk',
        '.......kkKKKKKKKKKKKLLkk',
        '.......kkKKKKLkkkkKKLLkk',
        '.......kkKKKKLkkkkKKLLkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkkkkk',
      ],
      left: [
        '........kkLqLLLLLLLLLLkk',
        '........kkKKKKKKKKKKLLkk',
        '.........kkkKKKLkKKLkkk',
        '..........kkKKKLkKKLkk',
        '.........kkgbgbbkgbgkk',
        '.........kkbbbbbkbbbkk',
      ],
      leftWalk: [
        '........kkLqLLLLLLLLLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKLkkkkKKLLkk',
        '........kkKKKLkkkkKKLLkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkbbbkk',
      ],
    },
    shorts: {
      down: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKLkkKKKLLkk',
        '........kkssssskkSSSSSkk',
        '........kkgbbgbkkgbgbbkk',
        '........kkbbbbbkkbbbbbkk',
      ],
      downWalk: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLkk',
        '.......kkKKKKLkkkkKKLLkk',
        '.......kkssssskkkkSSSSkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkkkkk',
      ],
      left: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '.........kkkKKKLkKKLkkk',
        '..........kksssskSSSkk',
        '.........kkgbgbbkgbgkk',
        '.........kkbbbbbkbbbkk',
      ],
      leftWalk: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKLkkkkKKLLkk',
        '........kksssskkkkSSSSkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkbbbkk',
      ],
    },
    skirt: {
      down: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLLkk',
        '.......kkLLLLLLLLLLLLLLkk',
        '........kkssssskkSSSSSkk',
        '........kkgbbgbkkgbgbbkk',
        '........kkbbbbbkkbbbbbkk',
      ],
      downWalk: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLLkk',
        '.......kkLLLLLLLLLLLLLLkk',
        '.......kkssssskkkkSSSSkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkkkkk',
      ],
      left: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLLkk',
        '.......kkLLLLLLLLLLLLLLkk',
        '........kkkksssskSSSkkkk',
        '.........kkgbgbbkgbgkkk',
        '.........kkbbbbbkbbbkk',
      ],
      leftWalk: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLLkk',
        '.......kkLLLLLLLLLLLLLLkk',
        '........kksssskkkkSSSSkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkbbbkk',
      ],
    },
    overalls: {
      down: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKLkkKKKLLkk',
        '........kkLLLLLkkLLLLLkk',
        '........kkgbbgbkkgbgbbkk',
        '........kkbbbbbkkbbbbbkk',
      ],
      downWalk: [
        '........kkKKKKKKKKKKLLkk',
        '.......kkKKKKKKKKKKKLLkk',
        '.......kkKKKKLkkkkKKLLkk',
        '.......kkLLLLLkkkkLLLLkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkkkkk',
      ],
      left: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '.........kkkKKKLkKKLkkk',
        '..........kkLLLLkLLLkk',
        '.........kkgbgbbkgbgkk',
        '.........kkbbbbbkbbbkk',
      ],
      leftWalk: [
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKKKKKKKKLLkk',
        '........kkKKKLkkkkKKLLkk',
        '........kkLLLLkkkkLLLLkk',
        '.......kkggbbgkkkkggbbkk',
        '.......kkbbbbbkk.kkbbbkk',
      ],
      // the bib and straps, over the shirt (from row 20)
      top: {
        down: [
          '............KL....KL',
          '............KL....KL',
          '...........kKLkkkkKLk',
          '...........KqKKKKKKqL',
          '...........KKKLLLLKLL',
          '...........KKKKKKKKLL',
        ],
        up: [
          '............KL....KL',
          '............KL....KL',
          '............KKKKKKKL',
          '.............KKKKKK',
          '...........KKKKKKKKLL',
          '...........KKKKKKKKLL',
        ],
        left: [
          '............KL',
          '............KL',
          '............KL',
          '..........KKqKL',
          '..........KKKKL',
          '..........KKKKL',
        ],
        leftWalk: [
          '............KL',
          '............KL',
          '............KL',
          '..........KKqKL',
          '..........KKKKL',
          '..........KKKKL',
        ],
      },
    },
  };
  for (const p of PANTS) if (PANTS32[p.hd]) p.hi = PANTS32[p.hd];
  // The ugly Christmas sweaters, by their key in SWEATERS: on the same body as the shirts
  // (rows 20-25), in the sweater's own colours ('1' to '5', the knit first) and '0', the
  // knit in shadow (see sweaterPal): a motif on the front, a band across the back.
  const SWEATER32 = {
    gingerbread: {
      down: [
        '.......kkkk0101220101kkkk',
        '......kk1113132222330000kk',
        '......kk11k1112422113k00kk',
        '......kk44k3111221110k44kk',
        '......kkssk1112112113kSSkk',
        '......kkssk3434343434kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1121112110k00kk',
        '......kk44k1212121212k44kk',
        '......kkssk1121112110kSSkk',
        '......kkssk3434343434kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1112111k1102kk',
        '........kk2121444k2120kk',
        '........kk1112sssk1102kk',
        '........kk4343sssk4343kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk21102kk',
        '......kkkk2444kk212120kkk',
        '.....kksss111kk1121102SSkk',
        '.....kkssskkkk43434343SSkk',
      ],
    },
    reindeer: {
      down: [
        '.......kkkk0144014401kkkk',
        '......kk1111114444110000kk',
        '......kk11k1113443110k00kk',
        '......kk33k1114444110k33kk',
        '......kkssk1111221110kSSkk',
        '......kkssk1313131313kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1131113110k00kk',
        '......kk33k1313131313k33kk',
        '......kkssk1131113110kSSkk',
        '......kkssk1313131313kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1113111k1103kk',
        '........kk3131333k3130kk',
        '........kk1113sssk1103kk',
        '........kk3131sssk3131kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk31103kk',
        '......kkkk3333kk313130kkk',
        '.....kksss111kk1131103SSkk',
        '.....kkssskkkk31313131SSkk',
      ],
    },
    snowflake: {
      down: [
        '.......kkkk0102020201kkkk',
        '......kk1114111222140000kk',
        '......kk11k1112222214k00kk',
        '......kk33k4111222110k33kk',
        '......kkssk1112121214kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1121112110k00kk',
        '......kk33k1212121212k33kk',
        '......kkssk1121112110kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1112111k1102kk',
        '........kk2121333k2120kk',
        '........kk1112sssk1102kk',
        '........kk3333sssk3333kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk21102kk',
        '......kkkk2333kk212120kkk',
        '.....kksss111kk1121102SSkk',
        '.....kkssskkkk33333333SSkk',
      ],
    },
    tree: {
      down: [
        '.......kkkk0101030101kkkk',
        '......kk1111111242110000kk',
        '......kk11k1112522210k00kk',
        '......kk44k1122224220k44kk',
        '......kkssk1111121110kSSkk',
        '......kkssk1414141414kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1141114110k00kk',
        '......kk44k1414141414k44kk',
        '......kkssk1141114110kSSkk',
        '......kkssk1414141414kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1114111k1104kk',
        '........kk4141444k4140kk',
        '........kk1114sssk1104kk',
        '........kk4141sssk4141kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk41104kk',
        '......kkkk4444kk414140kkk',
        '.....kksss111kk1141104SSkk',
        '.....kkssskkkk41414141SSkk',
      ],
    },
    candycane: {
      down: [
        '.......kkkk0124014201kkkk',
        '......kk1111211441120000kk',
        '......kk11k1111221110k00kk',
        '......kk33k1111441110k33kk',
        '......kkssk1111221110kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1141114110k00kk',
        '......kk33k1414141414k33kk',
        '......kkssk1141114110kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1114111k1104kk',
        '........kk4141333k4140kk',
        '........kk1114sssk1104kk',
        '........kk3333sssk3333kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk41104kk',
        '......kkkk4333kk414140kkk',
        '.....kksss111kk1141104SSkk',
        '.....kkssskkkk33333333SSkk',
      ],
    },
    santa: {
      down: [
        '.......kkkk0102012101kkkk',
        '......kk1111112222110000kk',
        '......kk11k1111221110k00kk',
        '......kk22k1333333330k22kk',
        '......kkssk1334334330kSSkk',
        '......kkssk2222222222kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1121112110k00kk',
        '......kk22k1212121212k22kk',
        '......kkssk1121112110kSSkk',
        '......kkssk2222222222kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1112111k1102kk',
        '........kk2121222k2120kk',
        '........kk1112sssk1102kk',
        '........kk2222sssk2222kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk21102kk',
        '......kkkk2222kk212120kkk',
        '.....kksss111kk1121102SSkk',
        '.....kkssskkkk22222222SSkk',
      ],
    },
    snowman: {
      down: [
        '.......kkkk0101444101kkkk',
        '......kk1112111242120000kk',
        '......kk11k1111223112k00kk',
        '......kk22k2115555510k22kk',
        '......kkssk1112242212kSSkk',
        '......kkssk1212121212kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1121112110k00kk',
        '......kk22k1212121212k22kk',
        '......kkssk1121112110kSSkk',
        '......kkssk1212121212kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1112111k1102kk',
        '........kk2121222k2120kk',
        '........kk1112sssk1102kk',
        '........kk2121sssk2121kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk21102kk',
        '......kkkk2222kk212120kkk',
        '.....kksss111kk1121102SSkk',
        '.....kkssskkkk21212121SSkk',
      ],
    },
    moose: {
      down: [
        '.......kkkk0221010221kkkk',
        '......kk1111222112220000kk',
        '......kk11k1112222110k00kk',
        '......kk33k1112332110k33kk',
        '......kkssk1111331110kSSkk',
        '......kkssk4343434343kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1131113110k00kk',
        '......kk33k1313131313k33kk',
        '......kkssk1131113110kSSkk',
        '......kkssk4343434343kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1113111k1103kk',
        '........kk3131333k3130kk',
        '........kk1113sssk1103kk',
        '........kk3434sssk3434kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk31103kk',
        '......kkkk3333kk313130kkk',
        '.....kksss111kk1131103SSkk',
        '.....kkssskkkk34343434SSkk',
      ],
    },
    hvac: {
      down: [
        '.......kkkk0101444101kkkk',
        '......kk1111114242410000kk',
        '......kk11k1114424410k00kk',
        '......kk33k1114242410k33kk',
        '......kkssk1111444110kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      up: [
        '.......kkkk0101010101kkkk',
        '......kk1111111111110000kk',
        '......kk11k1141114110k00kk',
        '......kk33k1414141414k33kk',
        '......kkssk1141114110kSSkk',
        '......kkssk3333333333kSSkk',
      ],
      left: [
        '.........kk1111111110kk',
        '........kk1111111k1100kk',
        '........kk1114111k1104kk',
        '........kk4141333k4140kk',
        '........kk1114sssk1104kk',
        '........kk3333sssk3333kk',
      ],
      leftWalk: [
        '.........kk1111111110kk',
        '........kk111111k11100kk',
        '.......kkk11111kk41104kk',
        '......kkkk4333kk414140kkk',
        '.....kksss111kk1141104SSkk',
        '.....kkssskkkk33333333SSkk',
      ],
    },
  };
  // a buffer of letters, doubled by Scale2x (the same rule as scale2x, on letters); null is clear
  function double(b) {
    const out = new Array(1024).fill(null), at = (x, y) => b[Math.min(15, Math.max(0, y)) * 16 + Math.min(15, Math.max(0, x))];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const p = at(x, y), a = at(x, y - 1), r = at(x + 1, y), l = at(x - 1, y), d = at(x, y + 1), o = y * 64 + x * 2;
        const edge = a !== d && l !== r;
        out[o] = edge && l === a ? l : p;
        out[o + 1] = edge && a === r ? r : p;
        out[o + 32] = edge && l === d ? l : p;
        out[o + 33] = edge && d === r ? r : p;
      }
    return out;
  }
  // lay rows over a 32 x 32 buffer from column x0, row y0 ('.' leaves what's there)
  function lay32Over(b, rows, x0, y0) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && x0 + i < 32 && y0 + j < 32) b[(y0 + j) * 32 + x0 + i] = ch; }));
  }
  // lay 32-wide rows over a 32 x 32 buffer, as lay does at 16
  function lay32(b, rows, y0) {
    (rows || []).forEach((row, j) => [...row].forEach((ch, i) => {
      if (i >= 32 || y0 + j >= 32) return;
      if (ch === '_') b[(y0 + j) * 32 + i] = null; else if (ch !== '.') b[(y0 + j) * 32 + i] = ch;
    }));
  }
  const BALD = HAIRS.findIndex((h) => h.hd === 'bald');
  // lay today's 16-wide rows (from row y0 at 16) over a 32 x 32 buffer, doubled: '_'
  // (rubbing out) and '.' (leaving what's there) carried through
  function doubleOver(b, rows, y0) {
    const o = new Array(256).fill(null);
    (rows || []).forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && y0 + j < 16) o[(y0 + j) * 16 + i] = ch; }));
    double(o).forEach((ch, i) => { if (ch === '_') b[i] = null; else if (ch) b[i] = ch; });
  }
  // One picture of a look at 32 x 32, as lookBuf at 16.
  function lookBuf32(look, dir, step, noHat, sweater) {
    const hair = HAIRS[look.hair], hat = HATS[look.hat], shirt = SHIRTS[look.shirt], pants = PANTS[look.pants];
    // today's picture without the head thing, doubled: the body, and the head till the hair's
    // redrawn (once it is, today's hair is left off, or long hair would show twice)
    const b = double(lookBuf(hair.hi ? Object.assign({}, look, { hair: BALD }) : look, dir, step, true, sweater));
    if (hair.hi) b.fill(null, 0, 20 * 32); // (the head is rows 0-19; the body starts at 20)
    // the shirt (or an ugly sweater in its place) goes on before the head, so the hoodie's
    // hood is behind it, and overalls' bib and straps over a shirt (not over a sweater)
    const sw = SWEATERS[sweater], top = sw ? sw.hi : shirt.hi;
    if (top) {
      const view = dir === 'left' && step > 0 ? 'leftWalk' : dir;
      b.fill(null, 20 * 32, 26 * 32);
      lay32(b, top[view], top.from || 20);
      if (sw) { /* (no bib over a sweater) */ } else if (pants.hi && pants.hi.top) lay32(b, pants.hi.top[view], 20);
      else if (pants.top) doubleOver(b, pants.top[view] || pants.top[dir], 10);
    }
    if (pants.hi) {
      const side = dir === 'left', legs = pants.hi[side ? (step > 0 ? 'leftWalk' : 'left') : step > 0 ? 'downWalk' : 'down'];
      b.fill(null, 26 * 32);
      lay32(b, step === 2 && !side ? legs.map((r) => [...r.padEnd(32, '.')].reverse().join('')) : legs, 26);
    }
    if (hair.hi) {
      lay32(b, HEAD32[dir], 0);
      lay32(b, hair.hi[dir], 0);
    }
    if (!noHat) {
      if (hat.hi) {
        const head = HEAD32[dir];
        (hat.hi[dir] || hat.hi.down).forEach((row, j) => [...row].forEach((ch, i) => {
          if (ch === '_') { const h = (head[j] || '')[i]; b[j * 32 + i] = h && h !== '.' ? h : null; } else if (ch !== '.') b[j * 32 + i] = ch;
        }));
      } else doubleOver(b, hat[dir] || hat.down, 0);
    }
    return b;
  }
  // renderLook at 32 x 32: canvases marked hi: 2, drawn at the usual size (see js/game.js)
  function renderLook32(look, sweater) {
    const sw = SWEATERS[sweater];
    return sheet32(look, sw && sweater, lookPalette(look, sw ? sweaterPal(sw) : null));
  }
  // renderSprites at 32 x 32, for a coworker: their body is the character editor's parts
  // (short hair, a shirt and tie and trousers; long hair and a blouse for a woman) in their
  // own colours (look: h, s, w, u, K), in an ugly sweater if `sweater` names one.
  const COWORKER32 = {
    male: { hair: HAIRS.findIndex((h) => h.hd === 'short'), shirt: SHIRTS.findIndex((s) => s.hd === 'tie') },
    female: { hair: HAIRS.findIndex((h) => h.hd === 'long'), shirt: SHIRTS.findIndex((s) => s.hd === 'blouse') },
  };
  function renderSprites32(gender, look, sweater) {
    const sw = SWEATERS[sweater], parts = Object.assign({ hat: 0, pants: 0 }, COWORKER32[gender] || COWORKER32.male);
    return sheet32(parts, sw && sweater, palette(Object.assign(extras32(look), look, sw ? sweaterPal(sw) : null)));
  }
  // a whole sheet at 32 x 32 ({down: [stand, stride, other stride], up, left, right}) for
  // the parts in `parts`, in the colours in `pal`
  function sheet32(parts, sweater, pal) {
    const out = {};
    const make = (dir, step, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32);
      blit(img, lookBuf32(parts, dir, step, false, sweater), 0, 0, pal, flip, 32);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    out.down = [make('down', 0), make('down', 1), make('down', 2)];
    out.up = [make('up', 0), make('up', 1), make('up', 2)];
    out.left = [make('left', 0), make('left', 1), make('left', 1)];
    out.right = [make('left', 0, true), make('left', 1, true), make('left', 1, true)];
    return out;
  }

  // ---------- Halloween costumes ----------
  // Each costume is drawn over the ordinary body: `pal` recolours it (and adds any new
  // colour letters), and down / up / left are overlays stamped on top, row 0 first.
  // In an overlay '.' leaves the body showing and '_' rubs it out (long hair under a mask).
  const below = (n, rows) => new Array(n).fill('').concat(rows);
  const COSTUMES = {
    clown: {
      name: 'Clown',
      pal: { h: '#e03030', M: '#e03030', F: '#f8f8f8', w: '#f8e040', u: '#3868c8', K: '#7b3fb8' },
      down: [
        '',
        '...kkkkkkkkkk...',
        '..kMMMMMMMMMMk..',
        '.kMMMMMMMMMMMMk.',
        '.kMMMMMMMMMMMMk.',
        '.kMMkFFFFFFkMMk.',
        '.kMMkFkFFkFkMMk.',
        '..kkkFFMMFFkkk..',
        '..__kMFFFFMk__..',
        '..___kkkkkk___..',
        '..__kFGFFGFk__..',
      ],
      up: [
        '',
        '...kkkkkkkkkk...',
        '..kMMMMMMMMMMk..',
        '.kMMMMMMMMMMMMk.',
        '.kMMMMMMMMMMMMk.',
        '.kMMMMMMMMMMMMk.',
        '.kMMMMMMMMMMMMk.',
        '..kkMMMMMMMMkk..',
        '..__kMMMMMMk__..',
        '..___kkkkkk___..',
        '..__kFGFFGFk__..',
      ],
      left: [
        '',
        '...kkkkkkkkk....',
        '..kMMMMMMMMMk...',
        '.kMMMMMMMMMMMk..',
        '.kMMMMMMMMMMMk..',
        '..kFFFkMMMMMMk..',
        '..kFFFFkMMMMMk..',
        '.MFFkFFFkMMMMk..',
        '...kFFFFFkMMk_..',
        '....kkkkkkkk__..',
        '....kFGFFGFk_...',
      ],
    },
    vampire: {
      name: 'Vampire',
      pal: { h: '#181018', s: '#e4e4f0', w: '#f8f8f8', u: '#d02030', K: '#30303c', M: '#d02030', x: '#3a2848' },
      down: [
        '', '', '', '', '', '',
        '.k............k.',
        '.kM..........Mk.',
        '.kMk..w..w..kMk.',
        '.kMMk......kMMk.',
        '.kxk........kxk.',
        '.kxk........kxk.',
        '.kxk........kxk.',
        '.kxk........kxk.',
        '..k..........k..',
      ],
      up: [
        '', '', '', '', '', '',
        '.k............k.',
        '.kx..........xk.',
        '.kxk........kxk.',
        '.kxxkkkkkkkkxxk.',
        '.kxxxxxxxxxxxxk.',
        '.kxxxxxxxxxxxxk.',
        '.kxxxxxxxxxxxxk.',
        '.kxxxxxxxxxxxxk.',
        '..kkk......kkk..',
      ],
      left: [
        '', '', '', '', '', '', '',
        '............kk..',
        '....w......kMk..',
        '...........kMk..',
        '.........xxxxk..',
        '.........xxxxk..',
        '.........xxxxk..',
        '..........kxxk..',
        '...........kk...',
      ],
    },
    skeleton: {
      name: 'Skeleton',
      pal: { h: '#f0ecd8', s: '#f0ecd8', b: '#f0ecd8', w: '#2c2c38', x: '#2c2c38', u: '#f0ecd8', K: '#3c3c4a' },
      down: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbbbbbbbbk...',
        '.._kbbbbbbbbk_..',
        '.._kbkkbbkkbk_..',
        '.._kbkkbbkkbk_..',
        '.._kbbbkkbbbk_..',
        '..__kbkbbkbk__..',
        '..___kkkkkk___..',
        '..__kxbbbbxk__..',
        '...kbxbkkbxbk...',
        '...kbxbbbbxbk...',
      ],
      up: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbbbbbbbbk...',
        '.._kbbbbbbbbk_..',
        '.._kbbbbbbbbk_..',
        '.._kbbbbbbbbk_..',
        '.._kbbbbbbbbk_..',
        '..__kbbbbbbk__..',
        '..___kkkkkk___..',
        '..__kxxbbxxk__..',
        '...kbxbbbbxbk...',
        '...kbxxbbxxbk...',
      ],
      left: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbbbbbbbbk...',
        '...kbbbbbbbbk_..',
        '...kkkbbbbbbk_..',
        '..kbkkbbbbbbk_..',
        '..kbbbbbbbbbk_..',
        '...kbkbkbbbk__..',
        '....kkkkkkk___..',
        '....kxbbxxxk_...',
      ],
    },
    witch: {
      name: 'Witch',
      pal: { s: '#80c868', w: '#7b3fb8', u: '#f08020', K: '#30283c', x: '#30283c', V: '#7b3fb8', O: '#f0b030' },
      down: [
        '.......kk.......',
        '......kxxk......',
        '.....kxxxxk.....',
        '....kVVOOVVk....',
        '.kkkxxxxxxxxkkk.',
        '.kxxxxxxxxxxxxk.',
        '.kk..........kk.',
      ],
      up: [
        '.......kk.......',
        '......kxxk......',
        '.....kxxxxk.....',
        '....kVVVVVVk....',
        '.kkkxxxxxxxxkkk.',
        '.kxxxxxxxxxxxxk.',
        '.kk..........kk.',
      ],
      left: [
        '.......kk.......',
        '......kxxk......',
        '.....kxxxxk.....',
        '....kVVVVVVk....',
        '.kkkxxxxxxxxkkk.',
        '.kxxxxxxxxxxxxk.',
        '.kk..........kk.',
      ],
    },
    pumpkin: {
      name: 'Pumpkin',
      pal: { O: '#f08020', q: '#c05810', h: '#58a848', w: '#58a848', u: '#2c6a34', K: '#5a4a30' },
      down: [
        '.......ee.......',
        '....kkkeekkk....',
        '...kOOOOOOOOk...',
        '..kOOqOOOOqOOk..',
        '..kOOOOOOOOOOk..',
        '..kOOkOOOOkOOk..',
        '..kOkkkOOkkkOk..',
        '..kOOOOOOOOOOk..',
        '..kOkkOkkOkkOk..',
        '...kOOOOOOOOk...',
        '..__kkkkkkkk__..',
      ],
      up: [
        '.......ee.......',
        '....kkkeekkk....',
        '...kOOOOOOOOk...',
        '..kOOqOOOOqOOk..',
        '..kOOqOOOOqOOk..',
        '..kOOqOOOOqOOk..',
        '..kOOqOOOOqOOk..',
        '..kOOqOOOOqOOk..',
        '..kOOqOOOOqOOk..',
        '...kOOOOOOOOk...',
        '..__kkkkkkkk__..',
      ],
      left: [
        '.......ee.......',
        '....kkkeekkk....',
        '...kOOOOOOOOk...',
        '..kOOOOOqOOOOk..',
        '..kOOOOOqOOOOk..',
        '..kOkOOOqOOOOk..',
        '..kkkOOOqOOOOk..',
        '..kOOOOOqOOOOk..',
        '..kkOkOOqOOOOk..',
        '...kOOOOOOOOk...',
        '....kkkkkkkk_...',
      ],
    },
    mummy: {
      name: 'Mummy',
      pal: { h: '#e8e0c8', s: '#e8e0c8', b: '#e8e0c8', B: '#a89c78', w: '#e8e0c8', u: '#a89c78', K: '#c8c0a0', Y: '#f8e040' },
      down: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbBBbbbbbk...',
        '.._kbbbbBBBbk_..',
        '.._kBBbbbbbbk_..',
        '.._kbbbBBbbbk_..',
        '.._kkYkkkkYkk_..',
        '..__kbbBBbbk__..',
        '..___kkkkkk___..',
        '..__kbBBbbBk__..',
        '...kbbbbBBbbk...',
        '...kbBBbbbbbk...',
      ],
      up: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbBBbbbbbk...',
        '.._kbbbbBBBbk_..',
        '.._kBBbbbbbbk_..',
        '.._kbbbBBbbbk_..',
        '.._kbBBbbbBBk_..',
        '..__kbbbbbbk__..',
        '..___kkkkkk___..',
        '..__kbBBbbBk__..',
        '...kbbbbBBbbk...',
        '...kbBBbbbbbk...',
      ],
      left: [
        '',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbBBbbbbbk...',
        '...kbbbbBBBbk_..',
        '...kBBbbbbbbk_..',
        '..kbbbBBbbbbk_..',
        '..kkYkkkbBBbk_..',
        '...kbbBBbbbk__..',
        '....kkkkkkk___..',
        '....kbBBbbbk_...',
      ],
    },
    // an air handling fan: a whole blower housing with the outlet duct up by one
    // shoulder, and the wearer's face looking out of the round inlet
    fan: {
      name: 'Haakon Fan',
      pal: { x: '#484858' },
      down: [
        'kkkkkkk.........',
        'kGGGGGkkkkkkk...',
        'kGGGGGGGGGGGGkk.',
        'kGGxxxxxxxxxxGGk',
        'kGxk........kxGk',
        'kGxk........kxGk',
        'kGxk........kxGk',
        'kGxk........kxGk',
        'kGxk........kxGk',
        'kGGxkkkkkkkkxGGk',
        'kgGGxxxxxxxxGGgk',
        '.kggGGGGGGGGggk.',
        '..kkkkkkkkkkkk..',
      ],
      up: [
        '.........kkkkkkk',
        '...kkkkkkkGGGGGk',
        '.kkGGGGGGGGGGGGk',
        'kGGGGGGGGGGGGGGk',
        'kGGGGGkkkkGGGGGk',
        'kGGGGkxxxxkGGGGk',
        'kGGGGkxggxkGGGGk',
        'kGGGGkxggxkGGGGk',
        'kGGGGkxxxxkGGGGk',
        'kGGGGGkkkkGGGGGk',
        'kgGGGGGGGGGGGGgk',
        '.kggGGGGGGGGggk.',
        '..kkkkkkkkkkkk..',
      ],
      left: [
        '...kkkkkkkkkkk..',
        '...kGGGGGGGGgk..',
        '...kGGGGGGGGgk..',
        '...kGGGGGGGGgk..',
        '...kxxxGGGGGgk..',
        '......xGGGGGgk..',
        '......xGGGGGgk..',
        '......xGGGGGgk..',
        '......xGGGGGgk..',
        '...kxxxGGGGGgk..',
        '...kGGGGGGGGgk..',
        '...kgggggggggk..',
        '...kkkkkkkkkkk..',
      ],
    },
    // a sandwich board with the SDG logo on the front (the logo itself is drawn on
    // by renderCostume, from assets/sdg.png)
    sdg: {
      name: 'SDG Sign',
      pal: { Y: '#f8d838', O: '#c8a020' },
      sign: [4, 10, 8, 4],
      down: below(9, [
        '...kkkkkkkkkk...',
        '...kYYYYYYYYk...',
        '..skYYYYYYYYks..',
        '...kYYYYYYYYk...',
        '...kYYYYYYYYk...',
        '...kkkkkkkkkk...',
      ]),
      up: below(9, [
        '...kkkkkkkkkk...',
        '...kYYYYYYYYk...',
        '..skYOOOOOOYks..',
        '...kYYYYYYYYk...',
        '...kYOOOOOOYk...',
        '...kkkkkkkkkk...',
      ]),
      left: below(9, [
        '...kkkkkkkkk....',
        '..kYk.....kYk...',
        '..kYk.....kYk...',
        '..kYk.....kYk...',
        '..kYk.....kYk...',
        '..kkk.....kkk...',
      ]),
    },
  };
  // ---------- Christmas: ugly sweaters ----------
  // Picked after the character editor at Christmas and worn over the look you made in
  // place of its shirt (your hair, head thing and pants stay), in this order on the picker.
  // `cols` are the sweater's
  // colours, the knit first: in the rows they're '1' to '5'. `front` and `back` are the
  // chest across rows 10-12 (six pixels wide, between the arms); the side view has the
  // back's pattern. js/hd.js and js/lot3d.js knit the same sweater by its key, bigger.
  const SWEATERS = {
    gingerbread: { name: 'Gingerbread', cols: ['#efe2c4', '#a8642e', '#f8f8f8', '#d03a3a'], front: ['112211', '224422', '121121'], back: ['111111', '212121', '111111'] },
    reindeer: { name: 'Reindeer', cols: ['#2e6b3a', '#d23a3a', '#f4f1ea', '#8a5a34'], front: ['141141', '114411', '132231'], back: ['111111', '323232', '111111'] },
    snowflake: { name: 'Snowflakes', cols: ['#23366e', '#f4f1ea', '#c8303a', '#8fb4e8'], front: ['121121', '212212', '333333'], back: ['121121', '111111', '333333'] },
    tree: { name: 'Xmas tree', cols: ['#c22c34', '#2e8a44', '#f0c838', '#f4f1ea', '#5ab0f0'], front: ['113311', '122421', '252242'], back: ['111111', '414141', '111111'] },
    candycane: { name: 'Candy cane', cols: ['#2e7a44', '#d0283a', '#f0c838', '#f4f1ea'], front: ['242424', '424242', '333333'], back: ['121212', '111111', '333333'] },
    santa: { name: 'Santa suit', cols: ['#c8202a', '#f6f4ee', '#1e1a22', '#f0c838'], front: ['112211', '112211', '334433'], back: ['111111', '111111', '333333'] },
    snowman: { name: 'Snowman', cols: ['#6fa8d8', '#f6f6f2', '#f08a24', '#1e1a22', '#d03a3a'], front: ['114411', '112311', '125521'], back: ['121112', '111211', '211121'] },
    moose: { name: 'Moose', cols: ['#9a2c2c', '#a8763e', '#efe6cf', '#2e6b3a'], front: ['221122', '112211', '343434'], back: ['111111', '111111', '343434'] },
    hvac: { name: 'Ho Ho HVAC', cols: ['#1f5a8a', '#f4f1ea', '#d03a3a', '#cfd6e2'], front: ['142241', '124421', '333333'], back: ['111111', '212121', '333333'] },
  };
  // a sweater's rows, laid out the way SHIRTS are (long sleeves, knit, with the hands below)
  const sweaterRows = (sw) => sw.rows || (sw.rows = {
    down: ['....k' + sw.front[0] + 'k....', '...k1' + sw.front[1] + '1k...', '...ks' + sw.front[2] + 'sk...'],
    up: ['....k' + sw.back[0] + 'k....', '...k1' + sw.back[1] + '1k...', '...ks' + sw.back[2] + 'sk...'],
    left: ['....k' + sw.back[0] + 'k....', '....k' + sw.back[1] + 'k....', '....k' + sw.back[2].slice(0, 2) + 'ss' + sw.back[2].slice(4) + 'k....'],
    leftWalk: ['....k' + sw.back[0] + 'k....', '...k1' + sw.back[1] + 'k....', '....k' + sw.back[2].slice(0, 5) + 'sk....'],
  });
  // (and '0', the knit in shadow, for 32 x 32)
  const sweaterPal = (sw) => { const o = { 0: darker(sw.cols[0], 0.25) }; sw.cols.forEach((c, i) => { o[i + 1] = c; }); return o; };
  // how a sweater dresses someone in the parking lot (js/hd.js, js/lot3d.js)
  const sweaterStyle = (key) => (SWEATERS[key] ? { key, cols: SWEATERS[key].cols } : null);
  // (and each one's 32 x 32 knit: see SWEATER32)
  for (const k in SWEATERS) if (SWEATER32[k]) SWEATERS[k].hi = SWEATER32[k];

  // The sprite sheet for someone in a costume: the same shape renderSprites returns.
  // base(dir, i) is the body under it (i: 0 standing, 1 mid-stride), and `logo` is the
  // SDG logo image, for the costume that wears it.
  function costumeSheet(c, base, pal, logo) {
    const out = {};
    const make = (dir, i, flip, sign) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), b = base(dir, i);
      lay(b, c[dir], 0);
      blit(img, b, 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      if (sign && logo && logo.complete && logo.naturalWidth) ctx.drawImage(logo, sign[0], sign[1], sign[2], sign[3]);
      return cv;
    };
    out.down = [make('down', 0, false, c.sign), make('down', 1, false, c.sign), make('down', 1, true, c.sign)];
    out.up = [make('up', 0), make('up', 1), make('up', 1, true)];
    out.left = [make('left', 0), make('left', 1), make('left', 1)];
    out.right = [make('left', 0, true), make('left', 1, true), make('left', 1, true)];
    return out;
  }
  // a coworker in a costume: their body and colours, like renderSprites
  function renderCostume(gender, look, key, logo) {
    const c = COSTUMES[key];
    if (!c) return renderSprites(gender, look);
    const SP = gender === 'female' ? SPRITES_F : SPRITES;
    return costumeSheet(c, (dir, i) => { const b = buf(); stamp(b, SP[dir][i]); return b; }, palette(Object.assign({}, look, c.pal)), logo);
  }
  // a player in a costume, over the look they made (minus any head thing)
  function renderLookCostume(look, key, logo) {
    const c = COSTUMES[key];
    if (!c) return renderLook(look);
    return costumeSheet(c, (dir, i) => lookBuf(look, dir, i, true), lookPalette(look, c.pal), logo);
  }

  // ---------- tile painters ----------
  const isWall = (c) => c === '#' || c === 'X' || c === 'E';

  function paintFloor(b, f, tx, ty) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let c;
        switch (f) {
          case '.': c = ((x % 8 === 0 && y % 8 === 0) || (x % 8 === 4 && y % 8 === 4)) ? 'p' : 'P'; break;
          case ',': c = (x === 0 || y === 0) ? 'A' : ((tx + ty) & 1 ? 'a' : 'Z'); break;
          case ':': c = (x % 8 === 0 || y % 8 === 0) ? 'G' : 'w'; break;
          case ';': {
            // plant concrete: big poured slabs with saw cuts, and a few flecks of aggregate
            const gx = tx * 16 + x, gy = ty * 16 + y;
            c = gx % 64 === 0 || gy % 64 === 0 ? 'p' : (gx * 13 + gy * 7) % 29 === 0 ? 'p' : 'G';
            break;
          }
          case '-': {
            // casino carpet: a dark red diamond lattice with a gold stud in each diamond
            const gx = tx * 16 + x, gy = ty * 16 + y, p = (gx + gy) & 15, q = (gx - gy) & 15;
            c = p === 0 || q === 0 ? 'm' : Math.abs(p - 8) + Math.abs(q - 8) <= 2 ? 'q' : 'M';
            break;
          }
          case '_': {
            // long planks: 4px tall, a joint every 48px, staggered per row
            const gx = tx * 16 + x, row = Math.floor((ty * 16 + y) / 4);
            const joint = (gx + row * 19) % 48 === 0;
            const grain = y % 4 === 1 && (gx * 7 + row * 3) % 13 < 3;
            c = y % 4 === 3 || joint || grain ? 'N' : 'y';
            break;
          }
          default: c = 'k';
        }
        b[y * 16 + x] = c;
      }
  }

  // A wall standing on casino carpet is a casino wall: burgundy with gold pinstripes.
  function paintWall(b, get, x, y, casino) {
    const [cap, wall, stripe, base, foot] = casino ? ['t', 'M', 'q', 'T', 't'] : ['d', 'c', 'C', 'n', 'D'];
    const up = get(x, y - 1), dn = get(x, y + 1), lf = get(x - 1, y), rt = get(x + 1, y);
    const face = !isWall(dn) && dn !== ' ';
    const capH = face ? 5 : 16;
    for (let yy = 0; yy < 16; yy++)
      for (let xx = 0; xx < 16; xx++) {
        let c;
        if (yy < capH) c = cap;
        else if (yy === capH) c = 'k';
        else if (yy >= 13) c = yy === 15 ? foot : base;
        else c = (xx % 8 === 3 && yy >= capH + 2 && yy <= 11) ? stripe : wall;
        if ((xx === 0 && !isWall(lf)) || (xx === 15 && !isWall(rt))) c = 'k';
        if (yy === 0 && !isWall(up)) c = 'k';
        if (yy === 15 && !face && !isWall(dn)) c = 'k';
        b[yy * 16 + xx] = c;
      }
  }

  // Auto-connecting block (desks, tables, counters).
  function blockAt(b, con, top, face, hi) {
    const x0 = con.l ? 0 : 1, x1 = con.r ? 15 : 14, y0 = con.u ? 0 : 2, y1 = con.d ? 15 : 14;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let c = top;
        if (!con.u && y === y0 + 1) c = hi;
        if (!con.d && y >= y1 - 3) c = face;
        if (!con.d && y === y1 - 4) c = 'k';
        if ((!con.l && x === x0) || (!con.r && x === x1) || (!con.u && y === y0) || (!con.d && y === y1)) c = 'k';
        set(b, x, y, c);
      }
  }

  function partition(b, con) {
    const inM = (x, y) =>
      (y >= 3 && y <= 11 && ((x >= 5 && x <= 10) || (con.l && x <= 10) || (con.r && x >= 5))) ||
      (x >= 5 && x <= 10 && ((con.u && y <= 11) || (con.d && y >= 3)));
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if (!inM(x, y)) continue;
        let c = 'G';
        if (!inM(x - 1, y) || !inM(x + 1, y) || !inM(x, y - 1) || !inM(x, y + 1)) c = 'k';
        else if (!inM(x, y + 3)) c = 'g';
        else if (!inM(x, y - 2)) c = 'w';
        set(b, x, y, c);
      }
  }

  // A steel work table on the plant floor: a grey top with seams where the tables meet,
  // and a drawer with a handle in the blue front.
  function paintWorkTable(b, con) {
    blockAt(b, con, 'W', 'u', 'w');
    const top = con.u ? 0 : 3, bottom = con.d ? 16 : 10;
    if (con.r) rect(b, 15, top, 1, bottom - top, 'G');
    if (!con.d) {
      if (con.r) rect(b, 15, 11, 1, 3, 'k');
      rect(b, 3, 11, 10, 3, 'k');
      rect(b, 4, 11, 8, 2, 'U');
      set(b, 10, 12, 'w');
    }
  }

  // Something drawn whole across the block of touching t tiles and then cut into tiles,
  // so its details can sit anywhere on it. draw(W, H, s, r) paints it (s = set a pixel,
  // r = fill a rectangle).
  function paintWhole(b, get, x, y, t, draw) {
    let x0 = x, y0 = y, x1 = x, y1 = y;
    while (get(x0 - 1, y) === t) x0--;
    while (get(x, y0 - 1) === t) y0--;
    while (get(x1 + 1, y) === t) x1++;
    while (get(x, y1 + 1) === t) y1++;
    const W = (x1 - x0 + 1) * 16, H = (y1 - y0 + 1) * 16, u = new Array(W * H).fill(null);
    const s = (px, py, c) => { if (px >= 0 && px < W && py >= 0 && py < H) u[py * W + px] = c; };
    const r = (px, py, w, h, c) => { for (let j = py; j < py + h; j++) for (let i = px; i < px + w; i++) s(i, j, c); };
    draw(W, H, s, r);
    const ox = (x - x0) * 16, oy = (y - y0) * 16;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) set(b, i, j, u[(oy + j) * W + ox + i]);
  }

  // Finished air handling units in shipping, waiting for the truck. The digit on the
  // map picks the design ('0' is the one in the paint booth).
  const paintShipUnit = (b, get, x, y, t) => paintWhole(b, get, x, y, t, SHIP_UNITS[t]);

  // The tables in Cody's casino: green felt inside a padded wooden rail.
  const CASINO_TABLES = {
    // blackjack: a half-moon, with the dealer along the straight side at the top, the
    // chip rack and the cards in front of them, and the betting spots round the curve
    '['(W, H, s, r) {
      const cx = W / 2, rx = W / 2 - 0.5, ry = H - 3.5;
      const inside = (i, j, k) => ((i + 0.5 - cx) / (rx - k)) ** 2 + ((j + 0.5 - 2) / (ry - k)) ** 2 <= 1;
      for (let j = 2; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (!inside(i, j, 0)) continue;
          let c = 'k';
          if (inside(i, j, 1) && j > 2) c = inside(i, j, 2) && j > 3 ? 'T' : 'N';
          if (inside(i, j, 4) && j > 5) c = inside(i, j, 9) && !inside(i, j, 10) ? 'F' : 'Q';
          s(i, j, c);
        }
      r(cx - 9, 6, 18, 4, 'k');
      ['r', 'w', 'u', 'o', 'r', 'w', 'u', 'o'].forEach((c, k) => r(cx - 8 + k * 2, 7, 2, 2, c));
      for (const dx of [-5, 1]) { r(cx + dx, 12, 5, 7, 'k'); r(cx + dx + 1, 13, 3, 5, 'w'); s(cx + dx + 2, 15, 'r'); }
      for (const a of [0.5, 1.57, 2.64]) {
        const px = Math.round(cx + Math.cos(a) * (rx - 7)) - 2, py = Math.round(2 + Math.sin(a) * (ry - 7)) - 2;
        r(px, py, 4, 4, 'F'); r(px + 1, py + 1, 2, 2, 'Q');
      }
    },
    // poker: a long oval, the five community cards in the middle and everyone's chips
    // round the edge
    ']'(W, H, s, r) {
      const R = 14.5, cy = 16.5, half = W / 2 - R - 0.5;
      const dist = (i, j) => Math.hypot(Math.max(0, Math.abs(i + 0.5 - W / 2) - half), j + 0.5 - cy);
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const d = dist(i, j);
          if (d > R) continue;
          s(i, j, d > R - 1 ? 'k' : d > R - 2 ? 'N' : d > R - 4 ? 'T' : d > R - 7 && d <= R - 6 ? 'F' : 'Q');
        }
      for (let k = 0; k < 5; k++) { const x = W / 2 - 15 + k * 6; r(x, 13, 5, 7, 'k'); r(x + 1, 14, 3, 5, 'w'); s(x + 2, 16, k & 1 ? 'r' : 'k'); }
      [[12, 15, 'r'], [64, 15, 'u'], [28, 7, 'o'], [48, 7, 'r'], [28, 23, 'u'], [48, 23, 'o']].forEach(([x, y, c]) => {
        r(x, y, 4, 3, 'k'); r(x + 1, y + 1, 2, 1, c);
      });
      r(57, 9, 3, 3, 'k'); s(58, 10, 'w'); // the dealer button
    },
  };

  // Pieces the shipping units are built from (s = set a pixel, r = fill a rectangle).
  const ahu = {
    // Casing: the roof from y=2 to `roof`, the front face below it down to `base`,
    // then the steel base rail with lifting holes. Returns where the face starts.
    casing(W, H, s, r, roof, base, top, face, seam) {
      r(1, 2, W - 2, base - 2, 'k');
      r(2, 3, W - 4, roof - 3, top);
      r(2, 3, W - 4, 1, 'w');
      r(2, roof, W - 4, 1, 'g');
      r(2, roof + 1, W - 4, base - roof - 2, face);
      for (let i = 16; i < W - 8; i += 16) { r(i, 4, 1, roof - 4, seam); r(i, roof + 1, 1, base - roof - 2, seam); }
      r(1, base, W - 2, H - base - 1, 'k');
      r(2, base + 1, W - 4, H - base - 3, 'K');
      for (let i = 6; i < W - 6; i += 12) r(i, base + 1, 3, H - base - 3, 'k');
      return roof + 1;
    },
    // A round porthole: grey rim, dark glass, a glint.
    porthole(s, r, x, y) {
      r(x + 1, y, 4, 6, 'g'); r(x, y + 1, 6, 4, 'g');
      r(x + 1, y + 1, 4, 4, 'k');
      s(x + 2, y + 2, 'i');
    },
    // An access door, hinged on the left with lever latches on the right.
    door(s, r, x, y, w, h, window, fill = 'w') {
      r(x, y, w, h, 'g');
      r(x + 1, y + 1, w - 2, h - 2, fill);
      r(x, y + 2, 2, 2, 'K'); r(x, y + h - 4, 2, 2, 'K');
      for (const ly of h > 14 ? [y + 3, y + h - 5] : [y + (h >> 1) - 1]) { r(x + w - 4, ly, 3, 2, 'K'); s(x + w - 4, ly + 2, 'K'); }
      if (window) ahu.porthole(s, r, x + (w >> 1) - 4, y + 3);
    },
    // A louvred intake or discharge: a frame with sloping blades.
    louvre(s, r, x, y, w, h) {
      r(x, y, w, h, 'k');
      r(x + 1, y + 1, w - 2, h - 2, 'G');
      for (let j = y + 2; j < y + h - 2; j += 3) { r(x + 2, j, w - 4, 1, 'K'); r(x + 2, j + 1, w - 4, 1, 'g'); }
    },
    // The shipping tag taped on, with the job number scribbled across it.
    tag(s, r, x, y) {
      r(x, y, 8, 6, 'k');
      r(x + 1, y + 1, 6, 4, 'o');
      r(x + 2, y + 2, 4, 1, 'k'); r(x + 2, y + 3, 2, 1, 'k');
    },
    // A wooden shipping skid along the bottom.
    skid(W, H, s, r, y) {
      r(0, y, W, H - y - 1, 'D');
      r(0, y, W, 2, 'N');
      for (let i = 2; i < W - 4; i += 10) r(i, y + 2, 6, H - y - 3, 'n');
    },
  };

  const SHIP_UNITS = {
    // The unit in the paint booth, still in grey primer. P and p are its paint, so once
    // you've painted it (Even Coat) the game redraws it with those two swapped out.
    0(W, H, s, r) {
      const f = ahu.casing(W, H, s, r, 13, H - 5, 'P', 'p', 'g');
      ahu.door(s, r, 3, f + 1, 12, 12, true, 'P');
      ahu.door(s, r, 19, f + 1, 10, 12, false, 'P');
      ahu.louvre(s, r, 34, f + 1, 11, 12);
    },
    // Like the photo: white casing, a louvred intake on the end, a big fan door and a
    // smaller coil door, both with portholes, and a little panel between them.
    1(W, H, s, r) {
      const f = ahu.casing(W, H, s, r, 20, H - 5, 'W', 'w', 'G');
      ahu.louvre(s, r, 3, f + 14, 10, 17);
      ahu.door(s, r, 15, f + 3, 17, 31, true);
      ahu.door(s, r, 34, f + 12, 8, 11, false);
      ahu.door(s, r, 45, f + 9, 15, 25, true);
      r(51, f + 3, 3, 3, 'g'); s(52, f + 4, 'o');       // pressure gauge
      ahu.tag(s, r, 6, 8);
    },
    // A long, low unit: intake louvre, filter door, coil with its pipe stubs poking
    // out, then the fan section and a discharge opening on the far end.
    2(W, H, s, r) {
      const f = ahu.casing(W, H, s, r, 13, H - 5, 'W', 'w', 'G');
      ahu.louvre(s, r, 3, f + 1, 9, 12);
      ahu.door(s, r, 15, f + 1, 12, 12, false);
      for (const py of [f + 2, f + 8]) { r(31, py, 3, 3, 'n'); s(32, py + 1, 'o'); r(36, py, 3, 3, 'n'); s(37, py + 1, 'o'); }
      ahu.door(s, r, 46, f + 1, 15, 12, true);
      r(65, f + 1, 12, 12, 'k'); r(66, f + 2, 10, 10, 'K'); r(66, f + 2, 10, 1, 'g');
      ahu.tag(s, r, 5, 4);
    },
    // A stacked unit: a supply tier on top of a return tier, with a rain hood over the
    // outdoor air intake on the roof and the main disconnect on the bottom tier.
    3(W, H, s, r) {
      const f = ahu.casing(W, H, s, r, 34, H - 5, 'W', 'w', 'G'), mid = f + 19;
      r(2, mid, W - 4, 2, 'g'); r(2, mid + 2, W - 4, 1, 'G');
      ahu.door(s, r, 6, f + 2, 14, 15, true);
      ahu.door(s, r, 36, f + 2, 14, 15, true);
      ahu.louvre(s, r, 60, f + 3, 14, 13);
      ahu.door(s, r, 6, mid + 4, 14, 17, true);
      ahu.door(s, r, 24, mid + 4, 9, 17, false);
      r(52, mid + 6, 10, 13, 'k'); r(53, mid + 7, 8, 11, 'K');   // disconnect switch
      r(55, mid + 9, 4, 2, 'r'); r(56, mid + 11, 2, 4, 'r');
      r(4, 6, 24, 18, 'k'); r(5, 7, 22, 16, 'g');               // rain hood on the roof
      for (let j = 9; j < 22; j += 3) r(6, j, 20, 1, 'K');
      r(5, 7, 22, 1, 'G');
      ahu.tag(s, r, 66, 8);
    },
    // Shrink-wrapped and strapped down to a skid, ready to go on the truck.
    4(W, H, s, r) {
      const base = H - 8;
      ahu.skid(W, H, s, r, base);
      r(1, 2, W - 2, base - 2, 'k');
      r(2, 3, W - 4, 18, 'i');
      r(2, 21, W - 4, 1, 'U');
      r(2, 22, W - 4, base - 23, 'U');
      for (let i = 4; i < W - 6; i += 9) { s(i, 5, 'w'); s(i + 1, 6, 'w'); s(i + 2, 7, 'w'); s(i + 3, 24, 'i'); s(i + 4, 25, 'i'); }
      for (const i of [10, 16, 28, 34, 46, 52, 64, 70]) r(i, 4, 1, base - 6, 'G');  // the unit's seams under the wrap
      for (const i of [20, W - 24]) { r(i, 2, 3, base - 2, 'k'); r(i + 1, 3, 1, base - 4, 'o'); }  // straps
      r(36, 26, 10, 8, 'k'); r(37, 27, 8, 6, 'w'); r(38, 28, 6, 1, 'r'); r(38, 30, 4, 1, 'K'); r(38, 31, 5, 1, 'K');
    },
    // A rooftop unit: grey casing with the condenser fan in a grille on top, and its
    // access doors along the front.
    5(W, H, s, r) {
      const f = ahu.casing(W, H, s, r, 27, H - 5, 'G', 'W', 'g');
      const cx = 40, cy = 14;
      for (let j = -10; j <= 10; j++)
        for (let i = -10; i <= 10; i++) {
          const d = i * i + j * j;
          if (d <= 100) s(cx + i, cy + j, d > 81 ? 'k' : (i + j) % 3 === 0 || (i - j) % 3 === 0 ? 'K' : 'k');
        }
      for (let k = -7; k <= 7; k++) { s(cx + k, cy + (k >> 1), 'g'); s(cx - (k >> 1), cy + k, 'g'); }
      r(cx - 1, cy - 1, 3, 3, 'G');
      r(5, 6, 14, 16, 'k'); for (let j = 7; j < 21; j += 2) r(6, j, 12, 1, 'g');   // condenser coil
      ahu.door(s, r, 4, f + 1, 14, 13, false);
      ahu.door(s, r, 22, f + 1, 14, 13, true);
      ahu.louvre(s, r, 42, f + 1, 18, 13);
      ahu.tag(s, r, 54, 4);
    },
  };

  function paintDoor(b, get, x, y) {
    const lf = get(x - 1, y), rt = get(x + 1, y), up = get(x, y - 1), dn = get(x, y + 1);
    const horiz = isWall(lf) || isWall(rt) || lf === 'D' || rt === 'D';
    let x0, x1, y0, y1;
    if (horiz) { x0 = lf === 'D' ? 0 : 2; x1 = rt === 'D' ? 15 : 13; y0 = 3; y1 = 12; }
    else { y0 = up === 'D' ? 0 : 2; y1 = dn === 'D' ? 15 : 13; x0 = 3; x1 = 12; }
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const edge = (xx === x0 && x0 > 0) || (xx === x1 && x1 < 15) || (yy === y0 && y0 > 0) || (yy === y1 && y1 < 15);
        set(b, xx, yy, edge ? 'd' : ((xx + yy) % 4 === 0 ? 'A' : 'C'));
      }
  }

  function paintStairs(b, get, x, y) {
    const lf = get(x - 1, y), rt = get(x + 1, y), up = get(x, y - 1);
    for (let yy = 0; yy < 16; yy++)
      for (let xx = 0; xx < 16; xx++) {
        let c = yy % 4 === 0 ? 'w' : yy % 4 === 3 ? 'd' : 'C';
        if ((xx === 0 && lf !== 'S') || (xx === 15 && rt !== 'S')) c = 'K';
        if (yy === 0 && up !== 'S') c = 'k';
        b[yy * 16 + xx] = c;
      }
  }

  function paintExit(b) {
    rect(b, 0, 0, 16, 16, 'c');
    rect(b, 1, 0, 14, 16, 'k');
    rect(b, 2, 1, 12, 15, 'r');
    rect(b, 3, 2, 10, 1, 'R');
    rect(b, 4, 4, 8, 5, 'k');
    rect(b, 5, 5, 6, 3, 'i');
    set(b, 11, 10, 'o'); set(b, 11, 11, 'o');
  }

  function paintElevator(b, get, x, y) {
    rect(b, 0, 0, 16, 16, 'g');
    rect(b, 0, 0, 16, 1, get(x, y - 1) === 'E' ? 'g' : 'k');
    rect(b, 2, 2, 12, 13, 'K');
    rect(b, 3, 3, 10, 11, 'G');
    rect(b, 3, 8, 10, 1, 'g');
    if (get(x, y - 1) !== 'E') { set(b, 7, 5, 'o'); set(b, 8, 5, 'o'); }
  }

  function paintShower(b) {
    rect(b, 1, 1, 14, 14, 'k');
    rect(b, 2, 2, 12, 12, 'W');
    for (let i = 2; i < 14; i++) { set(b, i, i, 'G'); set(b, 15 - i, i, 'G'); }
    rect(b, 7, 7, 2, 2, 'K');
  }

  // Wall-mounted TV seen from the side; joins up with TV tiles above/below.
  function paintTV(b, get, x, y, t) {
    const up = get(x, y - 1) === t, dn = get(x, y + 1) === t;
    const x0 = t === 'V' ? 9 : 1, x1 = x0 + 5;
    const y0 = up ? 0 : 2, y1 = dn ? 15 : 13;
    rect(b, x0, y0, 6, y1 - y0 + 1, 'k');
    rect(b, x0 + 1, up ? 0 : y0 + 1, 4, (dn ? 16 : y1) - (up ? 0 : y0 + 1), 'u');
    for (let i = 0; i < 16; i++) {
      const sy = (y * 16 + i) % 40;
      if (sy < 6 && i >= y0 + 1 && i <= y1 - 1) set(b, x0 + 1 + (sy >> 1) % 4, i, 'U');
    }
    // wall bracket
    rect(b, t === 'V' ? 15 : 0, 7, 1, 2, 'K');
  }

  // The Hall of Fame board on reception's left wall: a gold-framed screen running down
  // the wall, with a crown and the top three up top and the rest of the standings below.
  function paintFame(b, get, x, y) {
    const up = get(x, y - 1) === '*', dn = get(x, y + 1) === '*';
    const y0 = up ? 0 : 1, y1 = dn ? 15 : 14;
    rect(b, 0, y0, 12, y1 - y0 + 1, 'n');
    rect(b, 1, y0, 10, y1 - y0 + 1, 'o');
    rect(b, 2, up ? 0 : y0 + 1, 8, (dn ? 16 : y1) - (up ? 0 : y0 + 1), 'k');
    if (!up) {
      // the crown, then gold, silver and bronze
      set(b, 3, 3, 'o'); set(b, 6, 3, 'o'); set(b, 8, 3, 'o');
      rect(b, 3, 4, 2, 1, 'o'); rect(b, 6, 4, 1, 1, 'o'); rect(b, 8, 4, 1, 1, 'o');
      rect(b, 3, 5, 6, 2, 'o'); set(b, 5, 5, 'r');
      rect(b, 3, 9, 6, 1, 'o'); rect(b, 3, 11, 5, 1, 'G'); rect(b, 3, 13, 4, 1, 'N');
    } else {
      for (let j = 1; j < (dn ? 16 : 13); j += 2) {
        set(b, 3, j, 'U');
        rect(b, 5, j, 2 + ((x * 3 + y * 7 + j) % 4), 1, 'W');
      }
    }
  }

  // Putting green: striped turf with a dark edge, a flag in the top-right
  // tile and a ball waiting in the bottom-left one.
  function paintGreen(b, get, x, y) {
    const l = get(x - 1, y) === 'i', r = get(x + 1, y) === 'i', u = get(x, y - 1) === 'i', d = get(x, y + 1) === 'i';
    const x0 = l ? 0 : 1, x1 = r ? 16 : 15, y0 = u ? 0 : 1, y1 = d ? 16 : 15;
    rect(b, x0, y0, x1 - x0, y1 - y0, 'e');
    const ix0 = l ? 0 : 2, ix1 = r ? 16 : 14, iy0 = u ? 0 : 2, iy1 = d ? 16 : 14;
    for (let j = iy0; j < iy1; j++) rect(b, ix0, j, ix1 - ix0, 1, ((y * 16 + j) >> 2) & 1 ? 'l' : 'E');
    let ix = 0, iy = 0;
    while (get(x - 1 - ix, y) === 'i') ix++;
    while (get(x, y - 1 - iy) === 'i') iy++;
    if (iy === 0 && !r) {
      rect(b, 8, 11, 5, 3, 'k'); rect(b, 9, 10, 3, 5, 'k');   // hole
      rect(b, 10, 2, 1, 10, 'k');                             // pole
      rect(b, 11, 2, 4, 1, 'r'); rect(b, 11, 3, 3, 1, 'r'); rect(b, 11, 4, 2, 1, 'r');
    }
    if (!d && ix === 0) {
      rect(b, 6, 6, 3, 3, 'w'); set(b, 7, 9, 'e'); set(b, 8, 9, 'e');  // ball + shadow
    }
  }

  // Squat rack: uprights at the ends, barbell with plates across the middle.
  function paintSquatRack(b, get, x, y) {
    const l = get(x - 1, y) === 'A', r = get(x + 1, y) === 'A';
    rect(b, l ? 0 : 3, 13, (l ? 3 : 0) + (r ? 16 : 13) - 3, 2, 'K');
    rect(b, 0, 7, 16, 1, 'g');
    rect(b, 0, 6, 16, 1, 'k'); rect(b, 0, 8, 16, 1, 'k');
    if (!l) {
      rect(b, 0, 6, 3, 3, '.'); rect(b, 2, 1, 3, 14, 'k'); rect(b, 3, 2, 1, 12, 'K');
      for (let i = 3; i < 13; i += 3) set(b, 3, i, 'g');
      rect(b, 6, 3, 2, 9, 'k'); rect(b, 6, 4, 1, 7, 'r');
    }
    if (!r) {
      rect(b, 11, 1, 3, 14, 'k'); rect(b, 12, 2, 1, 12, 'K');
      for (let i = 3; i < 13; i += 3) set(b, 12, i, 'g');
      rect(b, 8, 3, 2, 9, 'k'); rect(b, 9, 4, 1, 7, 'r');
    }
    for (let i = 0; i < 256; i++) if (b[i] === '.') b[i] = null;
  }

  // Metal railing running left-right; joins neighbouring railings and walls.
  function paintRailing(b, get, x, y) {
    const joins = (c) => c === 'l' || c === '#';
    const x0 = joins(get(x - 1, y)) ? 0 : 1, x1 = joins(get(x + 1, y)) ? 15 : 14;
    rect(b, x0, 5, x1 - x0 + 1, 3, 'k');
    rect(b, x0, 6, x1 - x0 + 1, 1, 'G');
    for (const px of [3, 12]) { rect(b, px - 1, 7, 3, 7, 'k'); rect(b, px, 7, 1, 6, 'g'); }
    if (x0) rect(b, 1, 5, 1, 9, 'k');
    if (x1 < 15) rect(b, 14, 5, 1, 9, 'k');
  }

  // Hospital curtain across a doorway. 'C' is drawn closed, '~' drawn open
  // (fabric bunched against the outer edge of the doorway).
  function paintCurtain(b, get, x, y, open) {
    const isC = (c) => c === 'C' || c === '~';
    const l = isC(get(x - 1, y)), r = isC(get(x + 1, y));
    if (!open) {
      for (let yy = 3; yy < 16; yy++)
        for (let xx = 0; xx < 16; xx++)
          set(b, xx, yy, yy === 15 ? 'e' : xx % 4 === 0 ? 'E' : 'l');
    } else {
      const bx = r && !l ? 0 : 11;
      rect(b, bx, 3, 5, 13, 'l');
      rect(b, bx + 1, 3, 1, 12, 'E'); rect(b, bx + 3, 3, 1, 12, 'E');
      rect(b, bx, 15, 5, 1, 'e');
    }
    rect(b, 0, 1, 16, 2, 'K'); rect(b, 0, 1, 16, 1, 'g');
    for (let xx = 2; xx < 16; xx += 4) if (!open || (xx >= (r && !l ? 0 : 11) && xx < (r && !l ? 5 : 16))) set(b, xx, 3, 'k');
  }

  // Stretcher / hospital bed running left-right, pillow on the left end.
  function paintStretcher(b, get, x, y) {
    const l = get(x - 1, y) === 'u', r = get(x + 1, y) === 'u';
    const x0 = l ? 0 : 1, x1 = r ? 15 : 14;
    rect(b, x0, 4, x1 - x0 + 1, 7, 'k');
    const m0 = l ? 0 : 2, m1 = r ? 15 : 13;
    rect(b, m0, 5, m1 - m0 + 1, 5, 'w');
    if (!l) { rect(b, 3, 5, 4, 5, 'W'); rect(b, 3, 5, 4, 1, 'G'); }
    const b0 = l ? 0 : 8;
    rect(b, b0, 6, m1 - b0 + 1, 4, 'U'); rect(b, b0, 6, m1 - b0 + 1, 1, 'i');
    rect(b, x0, 11, x1 - x0 + 1, 1, 'g');
    if (!l) { rect(b, 2, 12, 1, 2, 'K'); set(b, 2, 14, 'k'); }
    if (!r) { rect(b, 13, 12, 1, 2, 'K'); set(b, 13, 14, 'k'); }
  }

  // One Lego brick seen from above: outlined, with a raised stud on every
  // second pixel in the lighter shade.
  function legoBrick(b, x, y, w, h, c, hi) {
    rect(b, x, y, w, h, 'k');
    rect(b, x + 1, y + 1, w - 2, h - 2, c);
    for (let j = y + 2; j < y + h - 1; j += 2)
      for (let i = x + 2; i < x + w - 1; i += 2) set(b, i, j, hi);
  }

  // Joe's Lego shelf, fixed to a left-hand wall: a wooden plank running down the
  // tile with a different little build on each tile.
  function paintLegoShelf(b, get, x, y) {
    const up = get(x, y - 1) === '&', dn = get(x, y + 1) === '&';
    const y0 = up ? 0 : 1, y1 = dn ? 15 : 14;
    rect(b, 0, y0, 14, y1 - y0 + 1, 'k');
    rect(b, 0, y0 + (up ? 0 : 1), 13, y1 - y0 + 1 - (up ? 0 : 1) - (dn ? 0 : 1), 'N');
    rect(b, 0, y0, 2, y1 - y0 + 1, 'n');
    switch (y % 3) {
      case 0: // a red house with a white door and a yellow minifig out front
        legoBrick(b, 2, 2, 10, 8, 'r', 'R');
        rect(b, 5, 6, 3, 3, 'w');
        legoBrick(b, 4, 10, 5, 5, 'o', 'y');
        break;
      case 1: // a blue spaceship with white wings and a cockpit
        legoBrick(b, 2, 1, 4, 14, 'W', 'w');
        legoBrick(b, 9, 1, 4, 14, 'W', 'w');
        legoBrick(b, 4, 3, 7, 10, 'u', 'U');
        rect(b, 6, 6, 3, 3, 'i');
        break;
      default: // a green tree and a stack of loose bricks
        legoBrick(b, 2, 1, 8, 7, 'E', 'l');
        rect(b, 5, 8, 2, 2, 'n');
        legoBrick(b, 2, 10, 5, 5, 'o', 'y');
        legoBrick(b, 7, 9, 6, 6, 'u', 'U');
        break;
    }
  }

  // A desk with one of Joe's builds sitting on it.
  function paintLegoDesk(b, x, y) {
    if ((x + y) & 1) { // a half-built red and yellow tower, with spare bricks
      legoBrick(b, 1, 1, 8, 10, 'r', 'R');
      legoBrick(b, 3, 3, 4, 6, 'o', 'y');
      legoBrick(b, 9, 1, 6, 5, 'E', 'l');
      legoBrick(b, 9, 6, 5, 5, 'u', 'U');
    } else { // a little blue car with a minifig driver
      rect(b, 2, 1, 3, 2, 'k'); rect(b, 11, 1, 3, 2, 'k');
      rect(b, 2, 10, 3, 2, 'k'); rect(b, 11, 10, 3, 2, 'k');
      legoBrick(b, 1, 2, 14, 9, 'u', 'U');
      rect(b, 6, 4, 4, 5, 'i');
      rect(b, 7, 5, 2, 2, 'o'); set(b, 7, 7, 'r'); set(b, 8, 7, 'r');
    }
  }

  // Build the 16x16 buffer for map tile (x, y).
  // (objOnly: just what stands on the floor, for renderFloor32, which draws the floor, the
  // walls, doors, desks and counters and partitions itself, at 32 x 32)
  function tile(get, floorCh, x, y, objOnly) {
    const b = buf();
    const t = get(x, y);
    const block = objOnly ? () => {} : blockAt;
    // (anything with a 32 x 32 picture is left out for renderFloor32 and noted in b.hi, for it to draw)
    const art32 = (k, draw) => { if (objOnly && OBJ32[k]) (b.hi = b.hi || []).push(k); else draw(); };
    // (and the things drawn by code: renderFloor32 runs their 32 x 32 painter instead)
    const paint32 = (k, draw) => { if (objOnly && PAINT32[k]) (b.hi = b.hi || []).push((bb) => PAINT32[k](bb, get, x, y, t)); else draw(); };
    const stamp = (bb, art) => art32(ART_KEY.get(art), () => stampArt(bb, art));
    if (t === ' ') { if (!objOnly) rect(b, 0, 0, 16, 16, 'k'); return b; }
    if (t === '#') { if (!objOnly) paintWall(b, get, x, y, floorCh === '-'); return b; }
    if (t === 'X' || t === 'E') {
      if (objOnly && PAINT32[t]) b.hi = [(bb) => PAINT32[t](bb, get, x, y, t)];
      else if (t === 'X') paintExit(b); else paintElevator(b, get, x, y);
      return b;
    }
    if (!objOnly) paintFloor(b, floorCh, x, y);
    const con = (chars) => ({
      u: chars.includes(get(x, y - 1)), d: chars.includes(get(x, y + 1)),
      l: chars.includes(get(x - 1, y)), r: chars.includes(get(x + 1, y)),
    });
    switch (t) {
      case 'D': if (!objOnly) paintDoor(b, get, x, y); break;
      case 'S': paint32('S', () => paintStairs(b, get, x, y)); break;
      case 'd': case 'm':
        block(b, con('dm%!'), 'N', 'n', 'y');
        stamp(b, t === 'm' ? ART.monitor : ((x * 7 + y * 5) % 3 === 0 ? ART.papers : []));
        break;
      case '%': block(b, con('dm%!'), 'N', 'n', 'y'); paint32('%', () => paintLegoDesk(b, x, y)); break;
      case '!': block(b, con('dm%!'), 'N', 'n', 'y'); break; // the phone itself is drawn by the game, so it can ring
      case '+': if (!objOnly) paintWorkTable(b, con('+')); break; // (at 32 x 32 a desk like any other: see BLOCKS32)
      case '0': case '1': case '2': case '3': case '4': case '5': paintShipUnit(b, get, x, y, t); break;
      case '[': case ']': paintWhole(b, get, x, y, t, CASINO_TABLES[t]); break;
      case '7': stamp(b, get(x, y + 1) === '7' ? ART.slotTop : ART.slotBottom); break;
      case '^': stamp(b, ART.forklift); break;
      case '&': paint32('&', () => paintLegoShelf(b, get, x, y)); break;
      case 'T': block(b, con('T'), 'y', 'N', 'w'); break;
      case 'k': case 'M': block(b, con('kMnP'), 'W', 'g', 'w'); if (t === 'M') stamp(b, ART.appliance); break;
      case 'P':
        block(b, con('kMnP'), 'W', 'g', 'w');
        stamp(b, get(x, y + 1) === 'P' ? ART.coffeeTop : ART.coffeeBottom);
        break;
      case 'r': case 'R': block(b, con('rR'), 'y', 'u', 'w'); if (t === 'R') stamp(b, ART.monitor); break;
      case 'Z': block(b, con('Z'), 'y', 'N', 'w'); stamp(b, (y & 1) ? ART.candyB : ART.candy); break;
      case '=': if (!objOnly) partition(b, con('=#')); break;
      case 'c': stamp(b, ART.chair); break;
      case 'p': stamp(b, ART.plant); break;
      case 'w': stamp(b, ART.toilet); break;
      case 'n': stamp(b, ART.sink); break;
      case 'f': stamp(b, ART.fridge); break;
      case 'v': stamp(b, ART.recycling); break;
      case 'x': stamp(b, ART.copier); break;
      case 'b': stamp(b, ART.shelf); break;
      case 'q': { // each 'q' tile shows its third of the treadmill, counting from the left
        let i = 0;
        while (get(x - 1 - i, y) === 'q') i++;
        art32('treadmill' + (i % 3), () => stamp(b, ART.treadmill.map((row) => row.substr((i % 3) * 16, 16))));
        break;
      }
      case 'h': art32('shower', () => paintShower(b)); break;
      case 'o': stamp(b, ART.ball); break;
      case 'W': stamp(b, ART.washer); break;
      case 't': stamp(b, ART.trophies); break;
      case 'g': stamp(b, ART.snackShelf); break;
      case 'l': paint32('l', () => paintRailing(b, get, x, y)); break;
      case 'C': paint32('C', () => paintCurtain(b, get, x, y, false)); break;
      case '~': paint32('~', () => paintCurtain(b, get, x, y, true)); break;
      case 'u': paint32('u', () => paintStretcher(b, get, x, y)); break;
      case 'z': stamp(b, ART.serverRack); break;
      case 'y': stamp(b, ART.computerRack); break;
      case 'O': stamp(b, ART.dryer); break;
      case 'G': stamp(b, ART.punchingBag); break;
      case 'N': stamp(b, ART.locker); break;
      case 'I': stamp(b, ART.pulldown); break;
      case 'A': paint32('A', () => paintSquatRack(b, get, x, y)); break;
      case 'i': paint32('i', () => paintGreen(b, get, x, y)); break;
      case 'e': block(b, con('e'), 'g', 'K', 'G'); stamp(b, ART.dumbbells); break;
      case 'F': stamp(b, ART.fan); break;
      case 'a': stamp(b, ART.damper); break;
      case 's': stamp(b, ART.engraver); break;
      case 'L': stamp(b, ART.coil); break;
      case 'K': stamp(b, ART.panel); break;
      case 'V': case 'Q': paint32('V', () => paintTV(b, get, x, y, t)); break;
      case '*': paint32('*', () => paintFame(b, get, x, y)); break;
      case 'U': stamp(b, ART.cupboard); break;
      case 'Y': stamp(b, ART.printer); break;
      case 'B': stamp(b, ART.box); break;
      case 'H': stamp(b, ART.partsShelf); break;
      case 'J': stamp(b, ART.junk); break;
      case 'j': stamp(b, (x + y) % 3 === 0 ? ART.floorPartsB : ART.floorParts); break;
    }
    return b;
  }

  // Paint a buffer into ImageData at pixel (ox, oy).
  function blit(img, b, ox, oy, pal, flip, n) {
    const d = img.data, W = img.width, N = n || 16;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const c = b[y * N + (flip ? N - 1 - x : x)];
        if (!c) continue;
        const rgb = pal[c], i = ((oy + y) * W + ox + x) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
  }

  function renderFloor(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const cv = document.createElement('canvas');
    cv.width = W * 16; cv.height = H * 16;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const pal = palette();
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? ' ' : floor.tiles[y][x];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        blit(img, tile(get, floor.floor[y][x], x, y), x * 16, y * 16, pal, false);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // The things that stand on the floor at 32 x 32, by their name in ART (the treadmill a
  // third at a time, and the shower): laid over the tile from its top left ('.' clear).
  // Anything not here is today's, doubled (see renderFloor32).
  const OBJ32 = {
    chair: [
      '',
      '',
      '',
      '...........kkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '.........kwwwwwwwwwwwkk',
      '........kkUUUUUUUUUUUukk',
      '........kkUUUUUUUUUUUukk',
      '........kkUUUUUUUUUUUukk',
      '........kkUUUUUUUUUUUukk',
      '........kkUUUUUUUUUUUukk',
      '.........kUUUUUUUUUUUkk',
      '.........kkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.......kiiiiiiiiiiiiiiikk',
      '......kkUUUUUUUUUUUUUUUUkk',
      '......kkUUUUUUUUUUUUUUUUkk',
      '......kkuuuuuuuuuuuuuuuukk',
      '.......kuuuuuuuuuuuuuuuuk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '..............kKKk',
      '..............kKKk',
      '..............kKKk',
      '........kKKKKKKKKKKKKKKk',
      '........kkkkkkkkkkkkkkkk',
      '.......kkk.....kk.....kkk',
      '.......kkk....kkkk....kkk',
      '.......kkk....kkkk....kkk',
      '...............kk',
    ],
    plant: [
      '.......kkkeeekEeeekeeekkk',
      '......kkeeEEEEEleleeeeeekk',
      '.....kkeEEleleEEEEEEEeeeekk',
      '.....kkleEEEEEEEleleEEeeekk',
      '....kkkEEEEleleEEEEEEEleekkk',
      '...kkeleleEEEEEEEleleEEeeeekk',
      '..kkeEEEEEEEleleEEEEEEEleeeekk',
      '..kkeEEleleEEEEEEEleleEEeeeekk',
      '..kkeeEEEEEEEleleEEEEEEEeeeekk',
      '..kkeEEEleleEEEEEEEleleEeeeekk',
      '..kkeleEEEEEEEleleEEEEEEeeeekk',
      '..kkeeEEEleleEEEEEEEleleeeeekk',
      '...kkeEeEEEEEEEEeEeEEEEeeeekk',
      '...kkeeEEEEeEeEEEEEEEEeeeeekk',
      '...kkeeeeEEEEEEEEeEeEeeeeeekk',
      '...kkeeeeeEEeEeEeEEeeeeeeeekk',
      '...kkeeeeeeeeeEeeeeeeeeeeeekk',
      '....kkeeeeeekekkkkekeeeeeekk',
      '.....kkkkNyyyyyyyyyyyyNkkkk',
      '......kkkNNNNNNNNNNNNNNkkk',
      '.......kkNNNNNNNNNNNNNNkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkNNNNNNNnnnkkk',
      '.........kkNNNNNNNnnnkk',
      '.........kkNNNNNNNnnnkk',
      '.........kkNNNNNNNnnnkk',
      '.........kkNNNNNNNnnnkk',
      '.........kknnnnnnnnnnkk',
      '.........kknnnnnnnnnnkk',
      '..........kknnnnnnnnkk',
      '...........kkkkkkkkkk',
      '............kkkkkkkk',
    ],
    monitor: [
      '',
      '.........kkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
      '........kkiiiiiiiiiiiikk',
      '........kkiiwwiiiiiiiikk',
      '........kkiiiwwiiiiiiikk',
      '........kkiiiiwwiiiiiikk',
      '........kkiiiiiwwiiiiikk',
      '........kkiiiiiiiiiiiikk',
      '........kkUUUUUUUUUUUUkk',
      '........kkUUUUUUUUUUUUkk',
      '........kkUUUUUUUUUUUUkk',
      '........kkkkkkkkkkkkokkk',
      '.........kkkkkkkkkkkkkk',
      '.............kKKKKk',
      '.............kKKKKk',
      '...........kkkkkkkkkk',
      '...........kkkkkkkkkk',
      '',
      '.....kkkkkkkkkkkkkkkkkkk',
      '.....kWGWGWGWGWGWGWGWGWk..k',
      '.....kWWWWWWWWWWWWWWWWWk.kWk',
      '.....kWGWGWGWGWGWGWGWGWk.kWk',
      '.....kWWWWGGGGGGGGGWWWWk.kWk',
      '.....kkkkkkkkkkkkkkkkkkk..k',
    ],
    papers: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '......kkkkkkkkkk',
      '......kwwwwwwwWkk',
      '......kwGGGGGGWkk',
      '......kwwwwwwwWkk..kkkkk',
      '......kwGGGGGGWkk.kDDDDDk',
      '......kwwwwwwwWkk.kRrrrrkkk',
      '......kwGGGGGGWkk.kRrrrrk.kk',
      '......kwwwwwwwWkk.kRrrrrk..k',
      '......kwGGGGwwWkk.kRrrrrk.kk',
      '......kwwwwwwwWkk.kRrrrrkkk',
      '......kwwwwwwwWkk.kRrrrrk',
      '......kWWWWWWWWkk.krrrrrk',
      '......kkkkkkkkkkk..kkkkk',
      '.....kkkkkkkkkkk',
    ],
    copier: [
      '',
      '',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkGGGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '.kkGGkkkkkkkkkkkkkkkkkkkkkkGGkk',
      '.kkGGkUUUUUUUUUUUUUUUUUUUUkGGkk',
      '.kkGGkiiiiiiiiiiiiiiiiiiiikGGkk',
      '.kkGGkiiiiiiiiiiiiiiiiiiiikGGkk',
      '.kkGGkiiiiiiiiiiiiiiiiiiiikGGkk',
      '.kkGGkkkkkkkkkkkkkkkkkkkkkkGGkk',
      '.kkGGGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkWWWWWWWWWWWWWWWWWiiiiWWWWWkk',
      '.kkWWWWWWWWWWWWWWWWWiiiiWuWoWkk',
      '.kkWWWWWWWWWWWWWWWWWiiiiWWWWWkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkwwwwwwwwwwkkkkkkwwwwwwwwwwkk',
      '.kkwwwwwwwwwwkkkkkkwwwwwwwwwwkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkwwwwwwwwwwkkkkkkwwwwwwwwwwkk',
      '.kkwwwwwwwwwwkkkkkkwwwwwwwwwwkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkGGGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    printer: [
      '',
      '',
      '.......kkkkkkkkkkkkkkkkkk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kwGGGGGGGGGGGGGGwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkwwwwwwwwwwwwwwwwwwwwkk',
      '....kkGGGGGGGGGGGGGGGuGoGGkk',
      '....kkGGGGGGGGGGGGGGGGGGGGkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkGGGGGGGGGGGGGGGGGGGGkk',
      '....kkggggggggggggggggggggkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkNNNNNNNNNNNNNNNNNNNNkk',
      '....kkNNNNNNNNNNNNNNNNNNNNkk',
      '....kknnnnnnnnnnnnnnnnnnnnkk',
      '....kknnnnnnnnDDDDnnnnnnnnkk',
      '....kknnnnnnnnDDDDnnnnnnnnkk',
      '....kknnnnnnnnnnnnnnnnnnnnkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    fridge: [
      '........kkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '......kkGGGGGGGGGGGGGGWWkk',
      '......kkGGGGGGGGGGGGGGWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkkkkkkkkkkkkkkkWWkk',
      '......kkGGGGGGGGGGGGGGWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwwwwrrrwwWWkk',
      '......kkwKKwwwwwwrrrwwWWkk',
      '......kkwKKwwwwwwrrrwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwKKwwwuuwwwwwwWWkk',
      '......kkwKKwwwuuwwwwwwWWkk',
      '......kkwKKwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkwwwwwwwwwwwwwwWWkk',
      '......kkGGGGGGGGGGGGGGGGkk',
      '......kkGGGGGGGGGGGGGGGGkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
    ],
    sink: [
      '',
      '',
      '',
      '',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkWWWWWWWWWWWgGggggWWWWWWWWWWWkk',
      'kkWWWWWWWWWWWggggggWWWWWWWWWWWkk',
      'kkWWWWWWWWWWWggKKggWWWWWWWWWWWkk',
      'kkWWWWWWWWWWWWWKKWWWWWWWWWWWWWkk',
      'kkWWWWWWWWWWWWWKKWWWWWWWWWWWWWkk',
      'kkWWWWWWkkkkkkkkkkkkkkkkWWWWWWkk',
      'kkWWWWkkkkkkkkkkkkkkkkkkkkWWWWkk',
      'kkWWWkkkwwwwwwwiiiiiiiiikkkWWWkk',
      'kkWWWkkiiiiiiiiiiiiiiiiiikkWWWkk',
      'kkWWkkiiiiiiiiiiiiiiiiiiiikkWWkk',
      'kkWWkkiiiiiiiiiiiiiiiiiiiikkWWkk',
      'kkWWkkiiiiiiiiiiiiiiiiiiiikkWWkk',
      'kkWWkkiiiiiiiUUUUUiiiiiiiikkWWkk',
      'kkWWkkiiiiiiiUUKKUiiiiiiiikkWWkk',
      'kkWWkkiiiiiiiiiiiiiiiiiiiikkWWkk',
      'kkWWWkkiiiiiiiiiiiiiiiiiikkWWWkk',
      'kkWWWkkkiiiiiiiiiiiiiiiikkkWWWkk',
      'kkWWWWkkkkkkkkkkkkkkkkkkkkWWWWkk',
      'kkWWWWWWkkkkkkkkkkkkkkkkWWWWWWkk',
      'kkWWWWWWWWWWWWWWWWWWWWWWWWWWWWkk',
      'kkGGGGGGGGGGGGGGGGGGGGGGGGGGGGkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    toilet: [
      '',
      '',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkwwwwwwwwwwwwwwGwkk',
      '......kkwwwwwwwwwwwwwwwwkk',
      '......kkGGGGGGGGGGGGGGGGkk',
      '......kkGGGGGGGGGGGGGGGGkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkWWWWWWWWWWWWWWWWkk',
      '......kkWWWWWWWWWWWWWWWWkk',
      '.........kkwwwwwwwwwwkk',
      '........kkwwwwwGGwwwwwkk',
      '........kkwwwGGGGGGwwwkk',
      '........kkwwGGGGGGGGwwkk',
      '.......kkwwGGGiiiiGGGwwkk',
      '.......kkwwGGiwwwwiGGwwkk',
      '.......kkwwGiiiiiiiiGwwkk',
      '.......kkwwGiiiiiiiiGwwkk',
      '.......kkwwGiiiiiiiiGwwkk',
      '.......kkwwGiiiiiiiiGwwkk',
      '........kkwGiiiiiiiiGwkk',
      '........kkwwGiiiiiiGwwkk',
      '........kkwwwGiiiiGwwwkk',
      '.........kkwwwwGGwwwwkk',
      '..........kkkwwwwwwkkk',
      '...........kkkkkkkkkk',
      '.............kkkkkk',
    ],
    recycling: [
      '',
      '',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkiiiiiiiiiiiiiiiiiikk',
      '.....kkUUUUUUUUUUUUUUUUUUkk',
      '.....kkuuuuuuuuuuuuuuuuuukk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkUUUUUUUwUUUUuukk',
      '.......kkUUUUUUwwUUUUuukk',
      '.......kkUUUUUwUUwUUUuukk',
      '.......kkUUUUwUUUUwUUuukk',
      '.......kkUUUUUUUUUUwUuukk',
      '.......kkUUUwUUUUUUwUuukk',
      '.......kkUUUwUUUUUUwUuukk',
      '.......kkUUwUUUUUUUUwuukk',
      '.......kkUUUUwwwwwwUUuukk',
      '.......kkUUUwUUUUUUUUuukk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkUUUUUUUUUUUUuukk',
      '.......kkuuuuuuuuuuuuuukk',
      '.......kkuuuuuuuuuuuuuukk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
    ],
    shelf: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDEEEDRRRDDDDDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kknooDRRRDEEEDRRRDEEEDRRRDEEDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknDDDDUUUDyyyDDDDDyyyDUUUDDDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kknyyyDUUUDyyyDUUUDyyyDUUUDyDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknyyyyyyyyyyyyyyyyyyyyyyyyyynkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNDDDDDDNNNNNNNNNNnkk',
      'kknNNNNNNNNNNDDDDDDNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    appliance: [
      '',
      '',
      '',
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGkkkkkkkkkkkkkkkGGKKKKKGkk',
      '..kkGkKKKKKKKKKKKKKkGGKooKKGkk',
      '..kkGkKUUUUUUUUUUUKkGGKKKKKGkk',
      '..kkGkKiiiiiiiiiiiKkGGGGGGGGkk',
      '..kkGkKiiiiiiiiiiiKkGGgGgGgGkk',
      '..kkGkKiiiiiiiiiiiKkGGGGGGGGkk',
      '..kkGkKiiiiiiiiiiiKkGGgGgGgGkk',
      '..kkGkKiiiiiiiiiiiKkGGGGGGGGkk',
      '..kkGkKiiiiiiiioiiKkGGgGgGgGkk',
      '..kkGkKiiiiiiiiiiiKkGGGGGGGGkk',
      '..kkGkKiiiiiiiiiiiKkGGuuuuuGkk',
      '..kkGkKKKKKKKKKKKKKkGGuuuuuGkk',
      '..kkGkkkkkkkkkkkkkkkGGGGGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkggggggggggggggggggggggggkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    coffeeTop: [
      '',
      '',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKkkNNNNNNNNNNNNkkKKkk',
      '....kkKKkkNDDNNNNDDNNNkkKKkk',
      '....kkKKkkNNNNNNDDNNNNkkKKkk',
      '....kkKKkkNNNNDDNNNNNNkkKKkk',
      '....kkKKkkNNDDNNNNNDDNkkKKkk',
      '....kkKKkkNNNNNNNNNNNNkkKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKkiUUUUUUUiiiiiikKKkk',
      '....kkKKkiiiiiiiiiiiiiikKKkk',
      '....kkKKkiiiiiiiiiiiiiikKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKoKKrKKuKKEKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    coffeeBottom: [
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKKkkKKKggggggKKKkkKKkk',
      '....kkKKkkKKKggggggKKKkkKKkk',
      '....kkKKkkKKKggggggKKKkkKKkk',
      '....kkKKkkKKKKKggKKKKKkkKKkk',
      '....kkKKkkKKKKKggKKKKKkkKKkk',
      '....kkKKkkKKKKKggKKKKKkkKKkk',
      '....kkKKkkKKKKKKKKKKKKkkKKkk',
      '....kkKKkkKKKKKKKKKKKKkkKKkk',
      '....kkKKkkKKKKKKKKKKKKkkKKkk',
      '....kkKKkkKKkkkkkkkkKKkkKKkk',
      '....kkKKkkKKknnnnnnkKKkkKKkk',
      '....kkKKkkKKkwwwwwwkkKkkKKkk',
      '....kkKKkkKKkwwwwwwkkKkkKKkk',
      '....kkKKkkKKkwwwwwwkkKkkKKkk',
      '....kkKKkkKKkwwwwwwkKKkkKKkk',
      '....kkKKkkKKkwwwwwwkKKkkKKkk',
      '....kkKKkkKKkkkkkkkkKKkkKKkk',
      '....kkKKkkkkkkkkkkkkkkkkKKkk',
      '....kkKKgKgKgKgKgKgKgKggKKkk',
      '....kkKKggggggggggggggggKKkk',
      '....kkGGGGGGGGGGGGGGGGGGGGkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    candy: [
      '',
      '',
      '',
      '',
      '',
      '.............oo....EE',
      '..........RR.oo.UU.Ek',
      '..........Rk..ooUU...rr',
      '...........RR.okooUU.rr',
      '.......kkkkRRRkkooUUEEkkk',
      '.......kwwwwRkwwwwwwEEwwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '.......kwwwwwwwwwwwwwwwwk',
      '........kwwwwwwwwwwwwwwk',
      '........kwWWWWWWWWWWWWwk',
      '.........kkwwwwwwwwwwkk',
      '...........kkkkkkkkkk',
      '',
      '',
      '.........................oo',
      '',
      '....RR',
      '',
      '',
      '',
      '.........UU',
      '......................EE',
    ],
    candyB: [
      '',
      '',
      '',
      '.......WooW',
      '...UU...WrrW...EE',
      '...k.....k.....k..WEEW',
      '...........WRRW....k',
      '............k',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '....UU.............RR',
      '....k..............k',
      '',
      '...RR',
      '...k',
      '.............rr',
      '.............k',
      '..............oo',
      '..............k',
    ],
    box: [
      '',
      '',
      '',
      '',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkyyyyyyyyNNNNyyyyyyyykk',
      '....kkNNNNNNNNNNNNNNNNNNNNkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kkNNNkkkkkkkkNNNNNNNnnkk',
      '....kkNNNkwwwwwwkNNNNNNNnnkk',
      '....kkNNNkwggggwkNNNNNNNnnkk',
      '....kkNNNkwwwwwwkNNNNNNNnnkk',
      '....kkNNNkkkkkkkkNNNNNNNnnkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kkNNNNNNNNNNNNNNNNNNnnkk',
      '....kknnnnnnnnnnnnnnnnnnnnkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    cupboard: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDkkkkkDkkkkkDkkkkkDDDDDDDDnkk',
      'kknDkGGGkDkGGGkDkGGGkDuuUUDDDnkk',
      'kknDkwwwkDkwwwkDkwwwkDuuUUrrDnkk',
      'kknDkGGGkDkGGGkDkGGGkDuuUUrrDnkk',
      'kknDkwwwkDkwwwkDkwwwkDuuUUrrDnkk',
      'kknDkwwwkDkwwwkDkwwwkDuuUUrrDnkk',
      'kknDkkkkkDkkkkkDkkkkkDuuUUrrDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknkkkkkkkkkkkknnkkkkkkkkkkkknkk',
      'kknkNNNNNNNNNNknnkNNNNNNNNNNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNNNNNNNNNNknnkNNNNNNNNNNknkk',
      'kknkNNNNNNNNNoknnkoNNNNNNNNNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNyyyyyyyyNknnkNyyyyyyyyNknkk',
      'kknkNNNNNNNNNNknnkNNNNNNNNNNknkk',
      'kknkNNNNNNNNNNknnkNNNNNNNNNNknkk',
      'kknkkkkkkkkkkkknnkkkkkkkkkkkknkk',
      'kkDDDDDDDDDDDDDDDDDDDDDDDDDDDDkk',
      'kkDDDDDDDDDDDDDDDDDDDDDDDDDDDDkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    snackShelf: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDkkkDwwwDkkkDwwwDkkkDwwwDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kknDEEDDyyDDrrDDooDDRRDDuuDDDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDkkkDwwwDkkkDwwwDkkkDwwwDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kknDRRDDuuDDEEDDyyDDrrDDooDDDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknyyyyyyyyyyyyyyyyyyyyyyyyyynkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    treadmill0: [
      '',
      '..kkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkk',
      '..kkiiiiiiiiiiiikk',
      '..kkiiiiiiiiiwiikk',
      '..kkiiiiiiiiwiiikk',
      '..kkUUUUUUUUUUUUkk',
      '..kkUUUUUUUUUUUUkk',
      '..kkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkk',
      '..kkggrggEggogggkk',
      '..kkkkkkkkkkkkkkkk',
      '......kKKkkggggggggggggggggggk',
      '......kKKkkkkkkkkkkkkkkkkkkkkk',
      '......kKKk',
      '......kKKk',
      '......kKKk',
      '......kKKk',
      '......kKKk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkwwwwwwwwwwwwwwwwgggggggggggg',
      '..kkRRRRRRRRRRRRRRRRgggggggggggg',
      '..kkRRRRRRRRRRRRRRRRKKKKgKKKKKgK',
      '..kkRRRRRRRRRRRRRRRRKKKKgKKKKKgK',
      '..kkrrrrrrrrrrrrrrrrKKKKgKKKKKgK',
      '..kkrrrrrrrrrrrrrrrrKKKKgKKKKKgK',
      '..kkgggggggggggggggggggggggggggg',
      '..kkKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkk',
      '....kkkkkk',
    ],
    treadmill1: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'gggggggggggggggggggggggggggggggg',
      'gggggggggggggggggggggggggggggggg',
      'KKKKgKKKKKgKKKKKgKKKKKgKKKKKgKKK',
      'KKKKgKKKKKgKKKKKgKKKKKgKKKKKgKKK',
      'KKKKgKKKKKgKKKKKgKKKKKgKKKKKgKKK',
      'KKKKgKKKKKgKKKKKgKKKKKgKKKKKgKKK',
      'gggggggggggggggggggggggggggggggg',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    treadmill2: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'ggggggggggggggggggggggggggggkk',
      'ggggggggggggggggggggggggggggkk',
      'KKgKKKKKgKKKKKgKKKKKgKKKKKgKkk',
      'KKgKKKKKgKKKKKgKKKKKgKKKKKgKkk',
      'KKgKKKKKgKKKKKgKKKKKgKKKKKgKkk',
      'KKgKKKKKgKKKKKgKKKKKgKKKKKgKkk',
      'ggggggggggggggggggggggggggggkk',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '......................kkkkkk',
      '......................kkkkkk',
    ],
    punchingBag: [
      '...............KK',
      '...............gK',
      '...............KK',
      '...............Kg',
      '.............kkkkkk',
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '..........kkRRRRRRRrrk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRwwRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkkkkkkkkkkkkk',
      '.........kkrrrrrrrrrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '.........kkRRRRRRRRrrkk',
      '..........kkRRRRRRRrrk',
      '..........krrrrrrrrrrk',
      '...........kkkkkkkkkk',
      '.............kkkkkk',
      '',
      '........KKKKKKKKKKKKKKKK',
      '........KKKKKKKKKKKKKKKK',
    ],
    washer: [
      '',
      '',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkWWWWWWWWWWWWWWWWWWWWWWWWkk',
      '..kkWGGGGGGGGGGGWWWWWWWKKKWWkk',
      '..kkWGGGGGGGGGGGWWWWoWWKKKWWkk',
      '..kkWGGGGGGGGGGGWWWWWWWKKKWWkk',
      '..kkWWWWWWWWWWWWWWWWWWWWWWWWkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '..kkwwwwwwwwwkkkkkkwwwwwwwwwkk',
      '..kkwwwwwwwkkGGGGGGkkwwwwwwwkk',
      '..kkwwwwwwkGGGkkkkGGGkwwwwwwkk',
      '..kkwwwwwkGGkkiiiikkGGkwwwwwkk',
      '..kkwwwwwkGkiwwwiiiikGkwwwwwkk',
      '..kkwwwwkGGkiiwiiiwikGGkwwwwkk',
      '..kkwwwwkGkiiwiiiiiiikGkwwwwkk',
      '..kkwwwwkGkiiiiiiiiwikGkwwwwkk',
      '..kkwwwwkGkiUUUUUUUUikGkwwwwkk',
      '..kkwwwwkGkUUUUUUUUUUkGkwwwwkk',
      '..kkwwwwkGGUUUUUUUUUUGGkwwwwkk',
      '..kkwwwwwkGkUUUUUUUUkGkwwwwwkk',
      '..kkwwwwwkGGkUUUUUUkGGkwwwwwkk',
      '..kkwwwwwwkGGGkkkkGGGkwwwwwwkk',
      '..kkwwwwwwwkkGGGGGGkkwwwwwwwkk',
      '..kkwwwwwwwwwkkkkkkwwwwwwwwwkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    dryer: [
      '',
      '',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkWWWWWWWWWWWWWWWWWWWWWWWWkk',
      '..kkWGGGGGGGGGGGWWWWWWWKKKWWkk',
      '..kkWGGGGGGGGGGGWWWWoWWKKKWWkk',
      '..kkWGGGGGGGGGGGWWWWWWWKKKWWkk',
      '..kkWWWWWWWWWWWWWWWWWWWWWWWWkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '..kkwwwwwwwwwkkkkkkwwwwwwwwwkk',
      '..kkwwwwwwwkkGGGGGGkkwwwwwwwkk',
      '..kkwwwwwwkGGGkkkkGGGkwwwwwwkk',
      '..kkwwwwwkGGkkKKKKkkGGkwwwwwkk',
      '..kkwwwwwkGkKwwwKKKKkGkwwwwwkk',
      '..kkwwwwkGGkKKggKKKKkGGkwwwwkk',
      '..kkwwwwkGkKKKKgKKKKKkGkwwwwkk',
      '..kkwwwwkGkKKKKKKKKKKkGkwwwwkk',
      '..kkwwwwkGkKKKKKKKgggkGkwwwwkk',
      '..kkwwwwkGkKKKKKKKKKKkGkwwwwkk',
      '..kkwwwwkGGkKKKgKKKKkGGkwwwwkk',
      '..kkwwwwwkGkKKgKKKKKkGkwwwwwkk',
      '..kkwwwwwkGGkkKKKKkkGGkwwwwwkk',
      '..kkwwwwwwkGGGkkkkGGGkwwwwwwkk',
      '..kkwwwwwwwkkGGGGGGkkwwwwwwwkk',
      '..kkwwwwwwwwwkkkkkkwwwwwwwwwkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    locker: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUkkkkkkkkkkkkkkkkUUUUuukk',
      'kkuuUUUUuuuuuuuuuuuuuuuuUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUkkkkkkkkkkkkkkkkUUUUuukk',
      'kkuuUUUUuuuuuuuuuuuuuuuuUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUkkkkkkkkkkkkkkkkUUUUuukk',
      'kkuuUUUUuuuuuuuuuuuuuuuuUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkKUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUkkUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUqqqqUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUqkqqUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUqqqqUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkuuuuuuuuuuuuuuuuuuuuuuuuuuuukk',
      'kkuuUUUUUUUUUUUUUUUUUUUUUUUUuukk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    pulldown: [
      '',
      '....kkkKKKKKKKKKKKKKKKKKKkkk',
      '....kKkkkkkkkkkkkkkkkkkkkkKk',
      '....kKk........gk........kKk',
      '....kKk........gk........kKk',
      '....kKk........gk........kKk',
      '....kKk........gk........kKk',
      '....kKk........gk........kKk',
      '....kKk........gk........kKk',
      '..kggggggggggggggggggggggggggk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kKk..................kKk',
      '....kKk..................kKk',
      '....kKk....kkkkkkkkkk....kKk',
      '....kKk....kKKKKKKKKk....kKk',
      '....kKk....kggggggggk....kKk',
      '....kKk....kKKKKKKKKk....kKk',
      '....kKk....kggggggggk....kKk',
      '....kKk....kKKKKKKKKk....kKk',
      '....kKk....kggggggggk....kKk',
      '....kKk....kKKKKKKKKk....kKk',
      '....kKk....kggggggggk....kKk',
      '....kKk....kkkkkkkkkk....kKk',
      '....kKk..................kKk',
      '....kKk...kUUUUUUUUUUk...kKk',
      '....kKk...kuuuuuuuuuuk...kKk',
      '....kKk...kkkkkkkkkkkk...kKk',
      '....kKk..................kKk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    dumbbells: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '...kkk.............kkk',
      '..kgKKk...........kgKKk',
      '..kgKKkkkkkkkkkkkkkgKKk',
      '..kgKKkgggggggggggkgKKk',
      '..kgKKkkkkkkkkkkkkkgKKk',
      '..kKKKk...........kKKKk',
      '...kkk.............kkk',
      '',
      '',
      '',
      '',
      '...........kkk.............kkk',
      '..........kgKKk...........kgKKk',
      '..........kgKKkkkkkkkkkkkkkgKKk',
      '..........kgKKkgggggggggggkgKKk',
      '..........kgKKkkkkkkkkkkkkkgKKk',
      '..........kKKKk...........kKKKk',
      '...........kkk.............kkk',
    ],
    ball: [
      '',
      '.............kkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkkkRRRRRRkkkk',
      '........kkRRRRRRRRRRrrkk',
      '.......kkRRRRRRRRRRRRRrkk',
      '......kkRRRRRRRRRRRRRRRrkk',
      '.....kkRRRRwRRRwRRRRRRRrrkk',
      '....kkRRRwwwwwRRRRRRRRRRrrkk',
      '...kkRRRRwwwwwRRRRRRRRRRRrrkk',
      '...kkRRRRwwwwwRRRRRRRRRRRrrkk',
      '...kkRRRRRRwRRRRRRRRRRRRRrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRrrrkk',
      '...kkRRRRRRRRRRRRRRRRRRRrrrkk',
      '...kkrRRRRRRRRRRRRRRRRRrrrrkk',
      '...kkrRRRRRRRRRRRRRRRRRrrrrkk',
      '....kkrRRRRRRRRRRRRRRRrrrrkk',
      '.....kkrrRRRRRRRRRRRrrrrrkk',
      '......kkrrRRRRRRRRRrrrrrkk',
      '.......kkrrrrrrrrrrrrrrkk',
      '........kkrrrrrrrrrrrrkk',
      '.........kkkkrrrrrrkkkk',
      '..........kkkkkkkkkkkk',
      '.............kkkkkk',
      '.........KKKKKKKKKKKKKK',
      '.........KKKKKKKKKKKKKK',
    ],
    trophies: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDowooooDDDDDDDDDDowooooDDnkk',
      'kknDooooooooDGGGGGGDooooooooDnkk',
      'kknDDooooooDDGWWWWGDDooooooDDnkk',
      'kknDDooooooDDGWWWWGDDooooooDDnkk',
      'kknDDDDqqDDDDGWWWWGDDDDqqDDDDnkk',
      'kknDDDDqqDDDDGWWWWGDDDDqqDDDDnkk',
      'kknDDDDqqDDDDGGGGGGDDDDqqDDDDnkk',
      'kknDDDnnnnDDDGggggGDDDnnnnDDDnkk',
      'kknDDDnnnnDDDGGGGGGDDDnnnnDDDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDDDDDDDDDowooooDDDDDDDDDDnkk',
      'kknDDGGGGGGDooooooooDGGGGGGDDnkk',
      'kknDDGWWWWGDDooooooDDGWWWWGDDnkk',
      'kknDDGWWWWGDDooooooDDGWWWWGDDnkk',
      'kknDDGWWWWGDDDDqqDDDDGWWWWGDDnkk',
      'kknDDGWWWWGDDDDqqDDDDGWWWWGDDnkk',
      'kknDDGGGGGGDDDDqqDDDDGGGGGGDDnkk',
      'kknDDGggggGDDDnnnnDDDGggggGDDnkk',
      'kknDDGGGGGGDDDnnnnDDDGGGGGGDDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    shower: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkGWWWWWWWWWWWWWWWWWWWWWWGkk',
      '..kkWGWWWWWWWWWWWWWWWWWWWWGWkk',
      '..kkWWGWWWWWWWWWWWWWWWWWWGWWkk',
      '..kkWWWGWWWWWWWWWWWWWWWWGWWWkk',
      '..kkWWWWGWWWWWWWWWWWWWWGWWWWkk',
      '..kkWWWWWGWWWWWWWWWWWWGWWWWWkk',
      '..kkWWWWWWGWWWWWWWWWWGWWWWWWkk',
      '..kkWWWWWWWGWWWWWWWWGWWWWWWWkk',
      '..kkWWWWWWWWGWWWWWWGWWWWWWWWkk',
      '..kkWWWWWWWWWGWWWWGWWWWWWWWWkk',
      '..kkWWWWWWWWWWKKKKWWWWWWWWWWkk',
      '..kkWWWWWWWWWWKgKKWWWWWWWWWWkk',
      '..kkWWWWWWWWWWKKKKWWWWWWWWWWkk',
      '..kkWWWWWWWWWWKKKKWWWWWWWWWWkk',
      '..kkWWWWWWWWWGWWWWGWWWWWWWWWkk',
      '..kkWWWWWWWWGWWWWWWGWWWWWWWWkk',
      '..kkWWWWWWWGWWWWWWWWGWWWWWWWkk',
      '..kkWWWWWWGWWWWWWWWWWGWWWWWWkk',
      '..kkWWWWWGWWWWWWWWWWWWGWWWWWkk',
      '..kkWWWWGWWWWWWWWWWWWWWGWWWWkk',
      '..kkWWWGWWWWWWWWWWWWWWWWGWWWkk',
      '..kkWWGWWWWWWWWWWWWWWWWWWGWWkk',
      '..kkWGWWWWWWWWWWWWWWWWWWWWGWkk',
      '..kkGWWWWWWWWWWWWWWWWWWWWWWGkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    fan: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkgGGGGGGGGkkkkkkGGGGGGGGgkk',
      '..kkGGGGGGGkkkkGGkkkkGGGGGGGkk',
      '..kkGGGGGkkkKGGGGKKKkkkGGGGGkk',
      '..kkGGGGkkKKKKGGGGKKKGkkGGGGkk',
      '..kkGGGGkKKKKKKGGGKKKGGkGGGGkk',
      '..kkGGGkkGGGGKKKGGKKKGGkkGGGkk',
      '..kkGGGkGGGGGGKKGGKKKGGGkGGGkk',
      '..kkGGkkGGGGGGGKKGKKGGGKkkGGkk',
      '..kkGGkkGKKKKKggggKGGGKKkkGGkk',
      '..kkGGkKKKKKKGgwggGGGKKKKkGGkk',
      '..kkGGkKKKKGGGggggGKKKKKKkGGkk',
      '..kkGGkkKKGGGKggggKKKKKGkkGGkk',
      '..kkGGkkKGGGKKGKKGGGGGGGkkGGkk',
      '..kkGGGkGGGKKKGGKKGGGGGGkGGGkk',
      '..kkGGGkkGGKKKGGKKKGGGGkkGGGkk',
      '..kkGGGGkGGKKKGGGKKKKKKkGGGGkk',
      '..kkGGGGkkGKKKGGGGKKKKkkGGGGkk',
      '..kkGGGGGkkkKKKGGGGKkkkGGGGGkk',
      '..kkGGGGGGGkkkkGGkkkkGGGGGGGkk',
      '..kkgGGGGGGGGkkkkkkGGGGGGGGgkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkggggggggggggggggggggggggkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    coil: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkqoooooooooooooooooooooookk',
      '..kknnnnnnnnnnnnnnnnnnnnnnnDkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkqoooooooooooooooooooooookk',
      '..kknnnnnnnnnnnnnnnnnnnnnnnDkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkqoooooooooooooooooooooookk',
      '..kknnnnnnnnnnnnnnnnnnnnnnnDkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkgGgGgGgGgGgGgGgGgGgGgGgGkk',
      '..kkKKKKKKKKKKKKKKKKKKKKKKKKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '...kGGGGGGGGGGGGGGGGGGGGGGGGk',
      '...kkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    damper: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwwKKkk',
      '..kkGGGGGGGGGGGkGGGGGGGGGGgKkk',
      '..kkgggggggggggggggggggggggKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkgKkk',
      '..kkKKKKKKKKKKKKKKKKKKKKKKgKkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwwgKkk',
      '..kkGGGGGGGGGGGkGGGGGGGGGGgKkk',
      '..kkgggggggggggggggggggggggKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkKKKKKKKKKKKKKKKKKKkuuuuukk',
      '..kkwwwwwwwwwwwwwwwwwwkuouuukk',
      '..kkGGGGGGGGGGGkGGGGGGkuuuuukk',
      '..kkggggggggggggggggggkuuuuukk',
      '..kkkkkkkkkkkkkkkkkkkkkuuuuukk',
      '..kkKKKKKKKKKKKKKKKKKKkuuuuukk',
      '..kkwwwwwwwwwwwwwwwwwwkkkkkkkk',
      '..kkGGGGGGGGGGGkGGGGGGGGGGgKkk',
      '..kkgggggggggggggggggggggggKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkgKkk',
      '..kkKKKKKKKKKKKKKKKKKKKKKKgKkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwwgKkk',
      '..kkGGGGGGGGGGGkGGGGGGGGGGgKkk',
      '..kkgggggggggggggggggggggggKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkKKkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    panel: [
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkgGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGkkkkkkkkkkkkkkkkkkkkkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkKwKkKKKkKwKkKKKkKwKkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkKKKkKwKkKKKkKwKkKKKkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkkkkkkkkkkkkkkkkkkkkkkGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGkkkkkkkkkkkkkkkkkkkkkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkKwKkKKKkKwKkKKKkKwKkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkKKKkKwKkKKKkKwKkKKKkkGkk',
      '..kkGkKKKkKKKkKKKkKKKkKKKkkGkk',
      '..kkGkkkkkkkkkkkkkkkkkkkkkkGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGGkkkkkkkkkkkkkkkkkkkkGGkk',
      '..kkGGkiUUUUUUUUiiiiiiiiikGGkk',
      '..kkGGkiiiiiiiiiiiiiiiiiikGGkk',
      '..kkGGkkkkkkkkkkkkkkkkkkkkGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGgkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    serverRack: [
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggogrgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggEgEgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggEgrgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggogEgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggEgrgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkgKgKgKgKgKggggEgEgkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkggggggggggggggggggggkk',
      '....kkggggggggggggggggggggkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    computerRack: [
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
      '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
      '..kkDDkkkkkkkDDDDDDDDDDDDDDDkk',
      '..kkDDkKKKKKkDDkkkkkkkkkkkDDkk',
      '..kkDDkgggggkDDkiiiiiiiiikDDkk',
      '..kkDDkKKKKKkDDkiwwwwwiiikDDkk',
      '..kkDDkKKKKKkDDkiiiiiiiiikDDkk',
      '..kkDDkKKKKKkDDkiiiiiiiiikDDkk',
      '..kkDDkKKKKKkDDkiiiiiiiiikDDkk',
      '..kkDDkKEKKKkDDkkkkkkkkkkkDDkk',
      '..kkDDkKKKKKkDDDDDDkkkDDDDDDkk',
      '..kkDDkkkkkkkDDDDDDkkkDDDDDDkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
      '..kkDDDDDDDDDDDDDDDDDDDDDDDDkk',
      '..kkDDkkkkkkkDDkkkkkkkDDDDDDkk',
      '..kkDDkKKKKKkDDkKKKKKkDDDDDDkk',
      '..kkDDkgggggkDDkgggggkDDDDDDkk',
      '..kkDDkKKKKKkDDkKKKKKkDkkkkDkk',
      '..kkDDkKKKKKkDDkKKKKKkDkGGkDkk',
      '..kkDDkKKKKKkDDkKKKKKkDkGGkDkk',
      '..kkDDkKKKKKkDDkKKKKKkDkGGkDkk',
      '..kkDDkKoKKKkDDkKEKKKkDkGGkDkk',
      '..kkDDkKKKKKkDDkKKKKKkDkGGkDkk',
      '..kkDDkkkkkkkDDkkkkkkkDkkkkDkk',
      '..kkggggggggggggggggggggggggkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    engraver: [
      '',
      '',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkKkkkkkkkkkkkkkkkkkkKkk',
      '....kkKkGGGGGGGkkGGGGGGGkKkk',
      '....kkKkGGGGGGGkkGGGGGGGkKkk',
      '....kkKkGooooookkooooooGkKkk',
      '....kkKkGoooooowoooooooGkKkk',
      '....kkKkGooooooooooooooGkKkk',
      '....kkKkGGGGGGGGGGGGGGGGkKkk',
      '....kkKkGGGGGGGGGGGGGGGGkKkk',
      '....kkKkkkkkkkkkkkkkkkkkkKkk',
      '....kkKKKKKKKKKKKKKKKKKKKKkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkGGGGkkkkkkkkkkkkkkkkGGGGkk',
      '..kkGGGGkwwwwwwwwwwwwwwkGrGGkk',
      '..kkGGGGkwgggggggggwwwwkGGGGkk',
      '..kkGGGGkwwwwwwwwwwwwwwkGEGGkk',
      '..kkGGGGkkkkkkkkkkkkkkkkGGGGkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '..kkggggggggggggggggggggggggkk',
      '..kkggggggggggggggggggggggggkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    partsShelf: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDDKKKKDDDDDDkkkkDDDDDDDDDnkk',
      'kknDDKKKKKKDDDDkkkkkkDkkkkkkDnkk',
      'kknDKKKggKKKKKDkDDDDkDkNNNNkDnkk',
      'kknDKKggggKKKKkkDDDDkkkyyyykDnkk',
      'kknDKKKggKKKKKDkDDDDkDkNNNNkDnkk',
      'kknDDKKKKKKKKKDkkkkkkDkNNNNkDnkk',
      'kknDDDKKKKDDDDDDkkkkDDkNNNNkDnkk',
      'kknDDDDDDDDDDDDDDDDDDDkkkkkkDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDDDDDDDDDDDDDDDDDDDDDDDDDDnkk',
      'kknDkkkkkDkkkkkDDDDkkkkDDDDDDnkk',
      'kknDkwwwkDkwwwkDDDkwwwrkDDDDDnkk',
      'kknDkGGGkDkGGGkDDDkwwrwkDDDDDnkk',
      'kknDkwwwkDkwwwkDDDkwwwwkDDDDDnkk',
      'kknDkGGGkDkGGGkDDDkwwwwkDDDDDnkk',
      'kknDkwwwkDkwwwkDDDDkkkkDDDDDDnkk',
      'kknDkkkkkDkkkkkDDDDDDDDDDDDDDnkk',
      'kkNNNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      'kknyyyyyyyyyyyyyyyyyyyyyyyyyynkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknNNNNNNNNNNDDDDDDNNNNNNNNNNnkk',
      'kknNNNNNNNNNNDDDDDDNNNNNNNNNNnkk',
      'kknNNNNNNNNNNNNNNNNNNNNNNNNNNnkk',
      'kknnnnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    junk: [
      '',
      '',
      '......kkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkk',
      '......kkGGGGGGGGGGkk',
      '......kkGKKKKKKKKGkk',
      '......kkGKiiiKKKKGkk',
      '......kkGKiiiKKKKGkk',
      '......kkGKiiiKKKKGkk',
      '......kkGKKKKKKKKGkk',
      '......kkGKKKKKKKKGkk',
      '......kkGGGGGGGGGGkk',
      '......kkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkKKKKkk',
      '....kkDDDDDDDDDDDDDDDDDDKKKKkk',
      '....kkDDDDDDDDDDDDDDDDDDKoKKkk',
      '....kkDDDDDDDDDDDDDDDDDDKKKKkk',
      '....kkNkkkkkkkkkkkkkkkkNKKKKkk',
      '....kkNkKKKKKKKKKKKKKKkNKKKKkk',
      '....kkNkKgKgKgKgKgKgKKkNKKKKkk',
      '....kkNkKKKKKKKKKKKKKKkNNNNNkk',
      '....kkNkKKKKKKKKKKKKKKkNNNNNkk',
      '....kkNkkkkkkkkkkkkkkkkNNNNNkk',
      '....kknnnnnnnnnnnnnnnnnnnnnnkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    floorParts: [
      '',
      '',
      '..kkkkkkkkkkkkk',
      '..kNNNNNNNNNNNk',
      '..kNNoNNENNoNNk',
      '..kNNNNNNNNNNNk',
      '..kkkkkkkkkkkkk',
      '',
      '......................K',
      '.....................K.K',
      '....................K...K',
      '',
      '',
      '....K.......K',
      '.....K...K.K.K',
      '......K.K.K...K',
      '.......K.......K',
      '',
      '',
      '',
      '....................kk',
      '...................kGGk',
      '..................kGGGGk',
      '..................kGGkGk',
      '...................kGGk',
      '......gg............kk',
      '.....gggg',
      '.....ggkg',
      '......gg',
    ],
    floorPartsB: [
      '',
      '',
      '.................kkkkkkkkkkkkk',
      '.................kNNNNNNNNNNNk',
      '.................kNNoNNENNoNNk',
      '.................kNNNNNNNNNNNk',
      '.................kkkkkkkkkkkkk',
      '',
      '.........K',
      '........K.K',
      '.......K...K',
      '',
      '',
      '...................K.......K',
      '..................K.K.K...K',
      '.................K...K.K.K',
      '................K.......K',
      '',
      '',
      '',
      '..........kk',
      '.........kGGk',
      '........kGGGGk',
      '........kGkGGk',
      '.........kGGk',
      '..........kk............gg',
      '.......................gggg',
      '.......................gkgg',
      '........................gg',
    ],
    forklift: [
      '.........KK..........KK',
      '.........KK..........KK',
      '.........KK..........KK',
      '.........KK..........KK',
      '.........KK..........KK',
      '.........KK..........KK',
      '.......kkkkkkkkkkkkkkkkkk',
      '.......kKKKKKKKKKKKKKKKKk',
      '.......kKKKKKKKKKKKKKKKKk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkoqqqqqqqqqqqqqqqqqqqqokkkk',
      '.kkkkooooooooooooooooooooookkkk',
      '.kkkkooookkkkkkkkkkkkkkooookkkk',
      '.kkkkooookKKKKKKKKKKKKkooookkkk',
      '...kkooookKKggggggggKKkooookk',
      '...kkooookKKggggggggKKkooookk',
      '...kkooookKKggggggggKKkooookk',
      '...kkooookKKggggggggKKkooookk',
      '...kkooookKKKKKKKKKKKKkooookk',
      '.kkkkooookkkkkkkkkkkkkkooookkkk',
      '.kkkkoooooooooKKKKoooooooookkkk',
      '.kkkkoooooooooKKKKoooooooookkkk',
      '.kkkkoooooooooKKKKoooooooookkkk',
      '.kkkkqqqqqqqqqqqqqqqqqqqqqqkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
    ],
    slotTop: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkwqoqwqoqwqoqwqoqwqoqwqoqkrrk',
      '..kkoqqqqqqqqqqqqqqqqqqqqqqokrrk',
      '..kkqqkkkkkkkkkkkkkkkkkkkkqqkkkk',
      '..kkoqkRRRRRRRRRRRRRRRRRRkqokKK',
      '..kkqqkrroorroorroorroorrkqqkKK',
      '..kkoqkrroorroorroorroorrkqokKK',
      '..kkqqkrrrrrrrrrrrrrrrrrrkqqkKK',
      '..kkoqkkkkkkkkkkkkkkkkkkkkqokKK',
      '..kkqqqqqqqqqqqqqqqqqqqqqqqqkKK',
      '..kkoqwqoqwqoqwqoqwqoqwqoqwqkKK',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkKK',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkWWWWWWkWWWWWWkWWWWWWkkkk',
      '..kkkkwwwwwwkwwwwwwkwwwwwwkkkk',
      '..kkkkwwwwwwkwwwwwwkwwwwwwkkkk',
      '..kkkkwrrrrwkwwwEwwkwwoowwkkkk',
      '..kkkkwwwwrwkwwEwEwkwoooowkkkk',
      '..kkkkwwwrwwkwrrwwwkwoooowkkkk',
      '..kkkkwwwrwwkwrrrrwkwoooowkkkk',
      '..kkkkwwrwwwkwwwrrwkooooookkkk',
      '..kkkkwwwwwwkwwwwwwkwwqwwwkkkk',
      '..kkkkwwwwwwkwwwwwwkwwwwwwkkkk',
      '..kkkkWWWWWWkWWWWWWkWWWWWWkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkRRRRRRRRRRRRRRRRRRRRRRRRkk',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    slotBottom: [
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkkKK',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkkKK',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkkKK',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkKK',
      '..kkkWWWWWWWWWWWWWWWWWWWWWWkkkKK',
      '..kkkWWoooWWrrrWWuuuWWEEEWWkkk',
      '..kkkWWoooWWrrrWWuuuWWEEEWWkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkk',
      '..kkrrrrrrrrrrrrrrrrrkkkkrrrkk',
      '..kkrrrrrrrrrrrrrrrrrkqqkrrrkk',
      '..kkrrrrrrrrrrrrrrrrrkkkkrrrkk',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkk',
      '..kkrrrkkkkkkkkkkkkkkkkkkrrrkk',
      '..kkrrrkKKKKKKKKKKKKKKKKkrrrkk',
      '..kkrrrkKKKKKKKKKKKKKKKKkrrrkk',
      '..kkrrrkKKKKKKKoKKKKKKKKkrrrkk',
      '..kkrrrkKKKoKKKKKKKoKKKKkrrrkk',
      '..kkrrrkggggggggggggggggkrrrkk',
      '..kkrrrkkkkkkkkkkkkkkkkkkrrrkk',
      '..kkrrrrrrrrrrrrrrrrrrrrrrrrkk',
      '..kkqqqqqqqqqqqqqqqqqqqqqqqqkk',
      '..kkqqqqqqqqqqqqqqqqqqqqqqqqkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
  };
  const ART_KEY = new Map(Object.entries(ART).map(([k, v]) => [v, k]));

  // ---------- things drawn by code, at 32 x 32 ----------
  // Each takes a 32 x 32 buffer and the same (get, x, y, t) as its painter at 16, and draws
  // what stands on the tile (renderFloor32 lays it over the floor and the rest).
  function r32(b, x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && i < 32 && j >= 0 && j < 32) b[j * 32 + i] = c; }
  const s32 = (b, x, y, c) => { if (x >= 0 && x < 32 && y >= 0 && y < 32) b[y * 32 + x] = c; };
  // a box with an outline n pixels thick
  function box32(b, x, y, w, h, c, n) { r32(b, x, y, w, h, 'k'); r32(b, x + (n || 1), y + (n || 1), w - 2 * (n || 1), h - 2 * (n || 1), c); }
  // a Lego brick: outlined, studs every 4 pixels
  function brick32(b, x, y, w, h, c, hi) {
    box32(b, x, y, w, h, c, 1);
    for (let j = y + 2; j < y + h - 2; j += 4) for (let i = x + 2; i < x + w - 2; i += 4) { r32(b, i, j, 2, 2, hi); s32(b, i + 1, j + 1, c); }
  }
  const PAINT32 = {
    // an exit: a red door in its frame, a window with a shine, a push bar
    X(b) {
      r32(b, 0, 0, 32, 32, 'c');
      r32(b, 2, 0, 28, 32, 'k'); r32(b, 4, 2, 24, 30, 'r'); r32(b, 4, 2, 24, 2, 'R'); r32(b, 4, 4, 2, 28, 'R');
      box32(b, 8, 7, 16, 11, 'i', 2); s32(b, 11, 10, 'w'); s32(b, 12, 10, 'w'); s32(b, 11, 11, 'w');
      r32(b, 7, 21, 18, 3, 'k'); r32(b, 8, 22, 16, 1, 'G'); r32(b, 22, 20, 2, 5, 'o');
    },
    // the elevator: steel doors that meet in the middle, a frame, the lit buttons above
    E(b, get, x, y) {
      const top = get(x, y - 1) !== 'E';
      r32(b, 0, 0, 32, 32, 'g');
      if (top) r32(b, 0, 0, 32, 2, 'k');
      r32(b, 3, 3, 26, 27, 'k'); r32(b, 5, 5, 22, 24, 'G');
      for (let j = 6; j < 28; j += 3) { r32(b, 6, j, 9, 1, 'W'); r32(b, 17, j, 9, 1, 'W'); }
      r32(b, 15, 5, 2, 24, 'k');
      if (top) { r32(b, 12, 1, 8, 3, 'K'); s32(b, 14, 2, 'o'); s32(b, 17, 2, 'o'); }
    },
    // stairs: treads with a light front edge and a shadow under each nose, rails at the sides
    S(b, get, x, y) {
      const lf = get(x - 1, y) === 'S', rt = get(x + 1, y) === 'S', up = get(x, y - 1) === 'S';
      for (let yy = 0; yy < 32; yy++)
        for (let xx = 0; xx < 32; xx++) {
          const k = yy % 8;
          let c = k === 0 ? 'w' : k >= 6 ? 'd' : 'C';
          if ((xx < 3 && !lf) || (xx > 28 && !rt)) c = xx === 0 || xx === 31 ? 'k' : 'K';
          if (yy < 2 && !up) c = 'k';
          b[yy * 32 + xx] = c;
        }
    },
    // a TV on the wall, seen from the side (joining up with the TV tiles above and below):
    // a black frame, the screen's glow flickering down it, a bracket to the wall
    V(b, get, x, y, t) {
      const up = get(x, y - 1) === t, dn = get(x, y + 1) === t, x0 = t === 'V' ? 18 : 2;
      const y0 = up ? 0 : 4, y1 = dn ? 31 : 27;
      r32(b, x0, y0, 12, y1 - y0 + 1, 'k');
      r32(b, x0 + 2, up ? 0 : y0 + 2, 8, (dn ? 32 : y1 - 1) - (up ? 0 : y0 + 2), 'u');
      for (let i = 0; i < 32; i++) {
        const sy = (y * 32 + i) % 80;
        if (sy < 12 && i >= y0 + 2 && i <= y1 - 2) r32(b, x0 + 2 + (sy >> 2) % 6, i, 2, 1, 'U');
      }
      if (!up) r32(b, x0 + 2, y0 + 2, 8, 1, 'i');
      r32(b, t === 'V' ? 30 : 0, 14, 2, 4, 'K');
    },
    // the Hall of Fame: a tall board on the wall in a wooden frame with a gold edge; at the
    // top a crown and gold, silver and bronze, and the names in rows down the rest
    '*'(b, get, x, y) {
      const up = get(x, y - 1) === '*', dn = get(x, y + 1) === '*', y0 = up ? 0 : 2, y1 = dn ? 31 : 29;
      r32(b, 0, y0, 24, y1 - y0 + 1, 'k');
      r32(b, 1, up ? 0 : y0 + 1, 22, (dn ? 32 : y1) - (up ? 0 : y0 + 1), 'n');
      r32(b, 3, up ? 0 : y0 + 3, 18, (dn ? 32 : y1 - 2) - (up ? 0 : y0 + 3), 'o');
      r32(b, 5, up ? 0 : y0 + 5, 14, (dn ? 32 : y1 - 4) - (up ? 0 : y0 + 5), 'k');
      if (!up) {
        for (const px of [7, 11, 15]) { r32(b, px, 8, 2, 2, 'o'); r32(b, px, 10, 2, 2, 'o'); }
        r32(b, 7, 11, 10, 3, 'o'); s32(b, 11, 12, 'r'); s32(b, 12, 12, 'r'); s32(b, 9, 9, 'w');
        r32(b, 7, 17, 10, 2, 'o'); r32(b, 7, 21, 9, 2, 'G'); r32(b, 7, 25, 8, 2, 'N');
      } else {
        for (let j = 1; j < (dn ? 32 : 26); j += 4) {
          r32(b, 7, j, 2, 2, 'U');
          r32(b, 10, j, 3 + ((x * 3 + y * 7 + j) % 5), 2, 'W');
        }
      }
    },
    // Wade's putting green: mown in stripes, its edge, the hole and flag on one end, a ball on the other
    i(b, get, x, y) {
      const l = get(x - 1, y) === 'i', r = get(x + 1, y) === 'i', u = get(x, y - 1) === 'i', d = get(x, y + 1) === 'i';
      const x0 = l ? 0 : 2, x1 = r ? 32 : 30, y0 = u ? 0 : 2, y1 = d ? 32 : 30;
      r32(b, x0, y0, x1 - x0, y1 - y0, 'e');
      const ix0 = l ? 0 : 4, ix1 = r ? 32 : 28, iy0 = u ? 0 : 4, iy1 = d ? 32 : 28;
      for (let j = iy0; j < iy1; j++) r32(b, ix0, j, ix1 - ix0, 1, ((y * 32 + j) >> 3) & 1 ? 'l' : 'E');
      let ix = 0, iy = 0;
      while (get(x - 1 - ix, y) === 'i') ix++;
      while (get(x, y - 1 - iy) === 'i') iy++;
      if (iy === 0 && !r) {
        r32(b, 16, 21, 10, 7, 'k'); r32(b, 18, 20, 6, 9, 'k'); r32(b, 18, 22, 6, 4, 'K');   // the hole
        r32(b, 20, 3, 2, 19, 'k'); r32(b, 20, 3, 1, 18, 'w');                               // the pole
        for (let k = 0; k < 6; k++) r32(b, 22, 4 + k, 8 - k, 1, k < 1 ? 'R' : 'r');           // the flag
      }
      if (!d && ix === 0) {
        r32(b, 11, 11, 7, 7, 'k'); r32(b, 12, 12, 5, 5, 'w'); s32(b, 13, 13, 'W'); s32(b, 15, 15, 'W');
        r32(b, 12, 18, 7, 2, 'e');
      }
    },
    // the squat rack: the uprights with their peg holes at either end, the bar across with a
    // red plate by each upright, its base along the floor
    A(b, get, x, y) {
      const l = get(x - 1, y) === 'A', r = get(x + 1, y) === 'A';
      r32(b, l ? 0 : 6, 26, (l ? 6 : 0) + (r ? 32 : 26) - 6, 4, 'k'); r32(b, l ? 0 : 7, 27, (l ? 7 : 0) + (r ? 32 : 25) - 7, 2, 'K');
      r32(b, 0, 12, 32, 6, 'k'); r32(b, 0, 14, 32, 2, 'g'); r32(b, 0, 14, 32, 1, 'w');
      if (!l) {
        r32(b, 0, 12, 4, 6, null);
        r32(b, 4, 2, 6, 28, 'k'); r32(b, 6, 4, 2, 24, 'K');
        for (let i = 6; i < 26; i += 6) r32(b, 6, i, 2, 2, 'g');
        r32(b, 12, 6, 4, 18, 'k'); r32(b, 13, 8, 2, 14, 'r'); r32(b, 13, 8, 1, 14, 'R');
      }
      if (!r) {
        r32(b, 22, 2, 6, 28, 'k'); r32(b, 24, 4, 2, 24, 'K');
        for (let i = 6; i < 26; i += 6) r32(b, 24, i, 2, 2, 'g');
        r32(b, 16, 6, 4, 18, 'k'); r32(b, 17, 8, 2, 14, 'r'); r32(b, 17, 8, 1, 14, 'R');
        r32(b, 28, 12, 4, 6, null);
      }
    },
    // a railing: a rail along the top, posts, joining up with railings and walls either side
    l(b, get, x, y) {
      const joins = (c) => c === 'l' || c === '#';
      const x0 = joins(get(x - 1, y)) ? 0 : 2, x1 = joins(get(x + 1, y)) ? 31 : 29;
      for (const px of [6, 24]) { r32(b, px - 2, 14, 6, 14, 'k'); r32(b, px, 14, 2, 12, 'g'); r32(b, px, 14, 1, 12, 'w'); }
      r32(b, x0, 10, x1 - x0 + 1, 6, 'k'); r32(b, x0, 12, x1 - x0 + 1, 2, 'G'); r32(b, x0, 12, x1 - x0 + 1, 1, 'w');
      if (x0) r32(b, 2, 10, 2, 18, 'k');
      if (x1 < 31) r32(b, 28, 10, 2, 18, 'k');
    },
    // the boardroom curtains, closed (pleated all the way across) or open (bunched at one side), on their rail
    C(b, get, x, y, t) {
      const open = t === '~', isC = (c) => c === 'C' || c === '~', l = isC(get(x - 1, y)), r = isC(get(x + 1, y));
      const bx = r && !l ? 0 : 22;
      for (let yy = 6; yy < 32; yy++)
        for (let xx = 0; xx < 32; xx++) {
          if (open && (xx < bx || xx >= bx + 10)) continue;
          const k = (xx - (open ? bx : 0)) % 8;
          b[yy * 32 + xx] = yy >= 30 ? 'e' : k === 0 || k === 7 ? 'E' : k === 1 ? 'e' : 'l';
        }
      r32(b, 0, 2, 32, 4, 'K'); r32(b, 0, 2, 32, 2, 'g');
      for (let xx = 4; xx < 32; xx += 8) if (!open || (xx >= bx && xx < bx + 10)) r32(b, xx, 6, 2, 2, 'k');
    },
    // a stretcher: a frame, a white mattress, a pillow, a blue blanket, legs on castors
    u(b, get, x, y) {
      const l = get(x - 1, y) === 'u', r = get(x + 1, y) === 'u';
      const x0 = l ? 0 : 2, x1 = r ? 31 : 29, m0 = l ? 0 : 4, m1 = r ? 31 : 27;
      r32(b, x0, 8, x1 - x0 + 1, 14, 'k');
      r32(b, m0, 10, m1 - m0 + 1, 10, 'w');
      if (!l) { r32(b, 6, 10, 8, 10, 'W'); r32(b, 6, 10, 8, 2, 'G'); r32(b, 7, 12, 2, 1, 'w'); }
      const b0 = l ? 0 : 16;
      r32(b, b0, 12, m1 - b0 + 1, 8, 'U'); r32(b, b0, 12, m1 - b0 + 1, 2, 'i'); r32(b, b0, 16, m1 - b0 + 1, 1, 'u');
      r32(b, x0, 22, x1 - x0 + 1, 2, 'g');
      if (!l) { r32(b, 4, 24, 2, 4, 'K'); r32(b, 3, 28, 4, 2, 'k'); }
      if (!r) { r32(b, 26, 24, 2, 4, 'K'); r32(b, 25, 28, 4, 2, 'k'); }
    },
    // Joe's Lego shelf on its plank, a different build on each tile
    '&'(b, get, x, y) {
      const up = get(x, y - 1) === '&', dn = get(x, y + 1) === '&', y0 = up ? 0 : 2, y1 = dn ? 31 : 29;
      r32(b, 0, y0, 28, y1 - y0 + 1, 'k');
      r32(b, 0, y0 + (up ? 0 : 2), 26, y1 - y0 + 1 - (up ? 0 : 2) - (dn ? 0 : 2), 'N');
      r32(b, 0, y0, 4, y1 - y0 + 1, 'n');
      switch (y % 3) {
        case 0: // a red house with a white door and a window, a yellow minifig out front
          brick32(b, 4, 4, 20, 16, 'r', 'R'); r32(b, 4, 2, 20, 3, 'k'); r32(b, 6, 2, 16, 2, 'D');
          r32(b, 10, 12, 6, 8, 'k'); r32(b, 11, 13, 4, 7, 'w'); r32(b, 17, 8, 4, 4, 'k'); r32(b, 18, 9, 2, 2, 'i');
          r32(b, 9, 21, 6, 9, 'k'); r32(b, 10, 22, 4, 3, 'o'); s32(b, 11, 23, 'k'); s32(b, 12, 23, 'k'); r32(b, 10, 25, 4, 4, 'r');
          break;
        case 1: // a blue spaceship with white wings and a glass cockpit
          brick32(b, 4, 2, 8, 28, 'W', 'w'); brick32(b, 18, 2, 8, 28, 'W', 'w');
          brick32(b, 8, 6, 14, 20, 'u', 'U'); r32(b, 12, 12, 6, 6, 'k'); r32(b, 13, 13, 4, 4, 'i'); s32(b, 13, 13, 'w');
          r32(b, 13, 26, 4, 3, 'o');
          break;
        default: // a green tree and a stack of loose bricks
          brick32(b, 4, 2, 16, 14, 'E', 'l'); r32(b, 10, 16, 4, 4, 'k'); r32(b, 11, 16, 2, 4, 'n');
          brick32(b, 4, 20, 10, 10, 'o', 'y'); brick32(b, 14, 18, 12, 12, 'u', 'U');
      }
    },
    // a desk with a Lego build on it: a red and yellow tower, or a blue car with its driver
    '%'(b, get, x, y) {
      if ((x + y) & 1) {
        brick32(b, 2, 2, 16, 20, 'r', 'R'); brick32(b, 6, 6, 8, 12, 'o', 'y');
        brick32(b, 18, 2, 12, 10, 'E', 'l'); brick32(b, 18, 12, 10, 10, 'u', 'U');
      } else {
        for (const [wx, wy] of [[4, 2], [22, 2], [4, 20], [22, 20]]) r32(b, wx, wy, 6, 4, 'k');
        brick32(b, 2, 4, 28, 18, 'u', 'U');
        r32(b, 11, 7, 10, 11, 'k'); r32(b, 12, 8, 8, 9, 'i'); r32(b, 14, 10, 4, 4, 'o'); s32(b, 15, 11, 'k'); s32(b, 16, 11, 'k'); r32(b, 14, 14, 4, 2, 'r');
      }
    },
  };
  PAINT32['~'] = PAINT32.C; // (open curtains: the same painter, which looks at t)

  // ---------- the office at 32 x 32 ----------
  // A floor at double resolution (renderFloor32): the floors, walls, doors, desks and
  // counters and the cubicle partitions are drawn at 32 x 32 here, a tile at a time, and
  // everything that stands on the floor (chairs, plants, machines and the rest) is today's,
  // laid out at 16 for the whole floor and doubled in one go with Scale2x, so anything that
  // spans tiles stays whole, then laid over the top. Outlines are 2 pixels, light from the
  // top left, as for the people.
  function floor32(b, f, tx, ty) {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const gx = tx * 32 + x, gy = ty * 32 + y;
        let c;
        switch (f) {
          case '.': // office carpet: a fine loop pile
            c = (gx % 16 === 0 && gy % 16 === 0) || (gx % 16 === 8 && gy % 16 === 8) ? 'p' : 'P';
            break;
          case ',': // reception's stone tiles, one to a tile: grout, a light edge, two shades
            c = x === 0 || y === 0 ? 'A' : x === 1 || y === 1 ? 'a' : (tx + ty) & 1 ? 'a' : 'Z';
            break;
          case ':': // small white tiles, grout every 8, a little shade on each one's lower edge
            c = x % 8 === 0 || y % 8 === 0 ? 'G' : x % 8 === 7 || y % 8 === 7 ? 'W' : 'w';
            break;
          case ';': // plant concrete: big slabs with saw cuts, flecks of aggregate
            c = gx % 128 === 0 || gy % 128 === 0 || (gx * 13 + gy * 7) % 29 === 0 ? 'p' : (gx * 5 + gy * 11) % 37 === 0 ? 'W' : 'G';
            break;
          case '-': { // casino carpet: a dark red lattice with a gold stud in each diamond
            const p = (gx + gy) & 31, q = (gx - gy) & 31, dd = Math.abs(p - 16) + Math.abs(q - 16);
            c = p === 0 || q === 0 ? 'm' : dd <= 2 ? 'o' : dd <= 4 ? 'q' : 'M';
            break;
          }
          case '_': { // long planks, 8 tall, staggered joints, a grain line or two, a light top edge (J: warm wood)
            const row = Math.floor(gy / 8), joint = (gx + row * 38) % 96 === 0;
            const grain = y % 8 === 3 && (gx * 7 + row * 3) % 13 < 4;
            c = y % 8 === 7 || joint || grain ? 'N' : y % 8 === 0 ? 'y' : 'J';
            break;
          }
          default: c = 'k';
        }
        b[y * 32 + x] = c;
      }
  }
  // a wall: the top of it (cap), a line, the face with stripes and a dado rail, a skirting
  // board; outlined 2 pixels wherever it ends
  function wall32(b, get, x, y, casino) {
    const [cap, wall, stripe, base, foot] = casino ? ['t', 'M', 'q', 'T', 't'] : ['d', 'c', 'C', 'n', 'D'];
    const up = get(x, y - 1), dn = get(x, y + 1), lf = get(x - 1, y), rt = get(x + 1, y);
    const face = !isWall(dn) && dn !== ' ', capH = face ? 10 : 32;
    for (let yy = 0; yy < 32; yy++)
      for (let xx = 0; xx < 32; xx++) {
        let c;
        if (yy < capH) c = cap;
        else if (yy < capH + 2) c = 'k';
        else if (yy >= 26) c = yy >= 30 ? foot : yy === 26 ? 'k' : base;
        else if (yy === 21) c = casino ? 'q' : 'C';
        else c = xx % 16 === 6 && yy < 21 ? stripe : wall;
        if ((xx < 2 && !isWall(lf)) || (xx > 29 && !isWall(rt))) c = 'k';
        if (yy < 2 && !isWall(up)) c = 'k';
        if (yy > 29 && !face && !isWall(dn)) c = 'k';
        b[yy * 32 + xx] = c;
      }
  }
  // a doorway: the threshold strip, a frame each side, a ribbed mat
  function door32(b, get, x, y) {
    const lf = get(x - 1, y), rt = get(x + 1, y), up = get(x, y - 1), dn = get(x, y + 1);
    const horiz = isWall(lf) || isWall(rt) || lf === 'D' || rt === 'D';
    let x0, x1, y0, y1;
    if (horiz) { x0 = lf === 'D' ? 0 : 4; x1 = rt === 'D' ? 31 : 27; y0 = 6; y1 = 25; }
    else { y0 = up === 'D' ? 0 : 4; y1 = dn === 'D' ? 31 : 27; x0 = 6; x1 = 25; }
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const edge = (xx <= x0 + 1 && x0 > 0) || (xx >= x1 - 1 && x1 < 31) || (yy <= y0 + 1 && y0 > 0) || (yy >= y1 - 1 && y1 < 31);
        const rib = horiz ? yy % 4 === 0 : xx % 4 === 0;
        b[yy * 32 + xx] = edge ? 'd' : rib ? 'A' : 'C';
      }
  }
  // A desk, table or counter at 32 x 32. Its shape is worked out across its neighbours, not
  // a tile at a time, so where a run turns a corner (an L-shaped desk) the outline goes all
  // the way round it and the front of one run stops at a line where it meets the top of the
  // other. Within the shape: a 2-pixel outline, a highlight along its back edges, the top
  // (with a grain line or two on wood), a line, and its front, 6 pixels deep.
  function block32(b, get, joins, top, face, hi, tx, ty) {
    const rects = new Map();
    const rectOf = (x, y) => {
      const key = x + ',' + y;
      if (!rects.has(key)) {
        const c = (dx, dy) => joins.includes(get(x + dx, y + dy));
        rects.set(key, joins.includes(get(x, y)) ? [c(-1, 0) ? 0 : 2, c(1, 0) ? 31 : 29, c(0, -1) ? 0 : 4, c(0, 1) ? 31 : 29] : null);
      }
      return rects.get(key);
    };
    // inside the desk: worked out once for this tile and 12 pixels round it (P), from each
    // tile's own rectangle; outside that it's taken as more desk
    const P = 12, N = 32 + P * 2, grid = new Uint8Array(N * N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const gx = tx * 32 - P + i, gy = ty * 32 - P + j, x = Math.floor(gx / 32), y = Math.floor(gy / 32), r = rectOf(x, y);
        const lx = gx - x * 32, ly = gy - y * 32;
        grid[j * N + i] = r && lx >= r[0] && lx <= r[1] && ly >= r[2] && ly <= r[3] ? 1 : 0;
      }
    const m = (gx, gy) => {
      const i = gx - tx * 32 + P, j = gy - ty * 32 + P;
      return i < 0 || j < 0 || i >= N || j >= N ? true : grid[j * N + i] === 1;
    };
    const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    // what each pixel of the desk is: its edge, its front (or the line above that), the
    // highlight along the back, or the top
    const part = (gx, gy) => {
      if (!m(gx, gy)) return null;
      if (AROUND.some(([dx, dy]) => !m(gx + dx, gy + dy))) return 'edge';
      let d = 1;
      while (d <= 10 && m(gx, gy + d)) d++;
      if (d <= 8) return 'face';
      if (d <= 10) return 'line';
      let u = 1;
      while (u <= 4 && m(gx, gy - u)) u++;
      return u <= 4 ? 'hi' : 'top';
    };
    const flat = (p) => p === 'top' || p === 'hi';
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const gx = tx * 32 + x, gy = ty * 32 + y, p = part(gx, gy);
        if (!p) continue;
        let c;
        if (p === 'edge' || p === 'line') c = 'k';
        // (the front of a run stops at a line where it meets the top of the run it joins)
        else if (p === 'face') c = [1, 2, -1, -2].some((dx) => flat(part(gx + dx, gy))) ? 'k' : face;
        else if (p === 'hi') c = hi;
        else c = top === 'N' && y % 9 === 3 && (gx * 7 + y) % 11 < 6 ? 'n' : top; // (grain, on wood)
        b[y * 32 + x] = c;
      }
  }
  // a cubicle partition: a padded low wall, joined up with its neighbours
  function partition32(b, con) {
    const inM = (x, y) =>
      (y >= 6 && y <= 23 && ((x >= 10 && x <= 21) || (con.l && x <= 21) || (con.r && x >= 10))) ||
      (x >= 10 && x <= 21 && ((con.u && y <= 23) || (con.d && y >= 6)));
    const at = (x, y) => x >= 0 && x < 32 && y >= 0 && y < 32 && inM(x, y);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        if (!inM(x, y)) continue;
        let c = (x + y) % 4 === 0 ? 'g' : 'G';
        const edge = (dx, dy) => !inM(x + dx, y + dy) && x + dx >= 0 && x + dx < 32 && y + dy >= 0 && y + dy < 32;
        if (edge(-1, 0) || edge(1, 0) || edge(0, -1) || edge(0, 1) || edge(-2, 0) || edge(2, 0) || edge(0, -2) || edge(0, 2)) c = 'k';
        else if (!at(x, y + 5) && y + 5 < 32) c = 'g';
        else if (!at(x, y - 3) && y - 3 >= 0) c = 'w';
        b[y * 32 + x] = c;
      }
  }
  // what each kind of desk or counter is made of: [the tiles it joins up with, top, front, highlight]
  const BLOCKS32 = {
    d: ['dm%!', 'N', 'n', 'y'], m: ['dm%!', 'N', 'n', 'y'], '%': ['dm%!', 'N', 'n', 'y'], '!': ['dm%!', 'N', 'n', 'y'],
    T: ['T', 'y', 'N', 'w'], k: ['kMnP', 'W', 'g', 'w'], M: ['kMnP', 'W', 'g', 'w'], P: ['kMnP', 'W', 'g', 'w'],
    r: ['rR', 'y', 'u', 'w'], R: ['rR', 'y', 'u', 'w'], Z: ['Z', 'y', 'N', 'w'], e: ['e', 'g', 'K', 'G'],
    '+': ['+', 'W', 'u', 'w'], // (the plant's steel work tables)
  };
  // the floor, walls, door, desk or partition of one tile at 32 x 32 (what's standing on it comes after)
  function structure32(get, floorCh, x, y) {
    const b = new Array(1024).fill(null), t = get(x, y);
    if (t === ' ') return b.fill('k');
    if (t === '#') { wall32(b, get, x, y, floorCh === '-'); return b; }
    floor32(b, floorCh, x, y);
    const con = (chars) => ({ u: chars.includes(get(x, y - 1)), d: chars.includes(get(x, y + 1)), l: chars.includes(get(x - 1, y)), r: chars.includes(get(x + 1, y)) });
    if (t === 'D') door32(b, get, x, y);
    else if (t === '=') partition32(b, con('=#'));
    else if (BLOCKS32[t]) { const [joins, top, face, hi] = BLOCKS32[t]; block32(b, get, joins, top, face, hi, x, y); }
    return b;
  }
  // a whole floor at 32 x 32: a canvas marked hi: 2 (see js/game.js)
  function renderFloor32(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length, PW = W * 32, PH = H * 32;
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? ' ' : floor.tiles[y][x];
    // everything standing on the floor, at 16, as letters for the whole floor
    const W16 = W * 16, H16 = H * 16, obj = new Array(W16 * H16).fill(null);
    const hi = [];
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        const t = tile(get, floor.floor[ty][tx], tx, ty, true);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) obj[(ty * 16 + y) * W16 + tx * 16 + x] = t[y * 16 + x];
        if (t.hi) hi.push([tx, ty, t.hi]);
      }
    // ... doubled by Scale2x, over the floors, walls and desks drawn at 32
    const cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH; cv.hi = 2;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(PW, PH), d = img.data, pal = palette({ J: '#e4b47c' });
    const at = (x, y) => obj[Math.min(H16 - 1, Math.max(0, y)) * W16 + Math.min(W16 - 1, Math.max(0, x))];
    const put = (X, Y, c) => { if (!c) return; const rgb = pal[c], i = (Y * PW + X) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; };
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        const b = structure32(get, floor.floor[ty][tx], tx, ty);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) put(tx * 32 + x, ty * 32 + y, b[y * 32 + x]);
      }
    for (let y = 0; y < H16; y++)
      for (let x = 0; x < W16; x++) {
        const p = at(x, y);
        const a = at(x, y - 1), r = at(x + 1, y), l = at(x - 1, y), dn = at(x, y + 1), edge = a !== dn && l !== r;
        put(x * 2, y * 2, edge && l === a ? l : p);
        put(x * 2 + 1, y * 2, edge && a === r ? r : p);
        put(x * 2, y * 2 + 1, edge && l === dn ? l : p);
        put(x * 2 + 1, y * 2 + 1, edge && dn === r ? r : p);
      }
    // and the things drawn at 32 x 32, in their places
    for (const [tx, ty, keys] of hi)
      for (const k of keys) {
        if (typeof k === 'function') { const bb = new Array(1024).fill(null); k(bb); bb.forEach((c, i) => put(tx * 32 + (i & 31), ty * 32 + (i >> 5), c)); }
        else OBJ32[k].forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') put(tx * 32 + x, ty * 32 + y, c); }));
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // renderTileAs at 32 x 32: one tile drawn as if it were `ch`, with `over` swapping any
  // colours (the floor and so on at 32, what stands on it doubled, or at 32 where it's been redrawn)
  function renderTileAs32(floor, x, y, ch, over) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const get = (xx, yy) => (xx === x && yy === y) ? ch : (xx < 0 || yy < 0 || xx >= W || yy >= H) ? ' ' : floor.tiles[yy][xx];
    const b = structure32(get, floor.floor[y][x], x, y), t = tile(get, floor.floor[y][x], x, y, true);
    double(t).forEach((c, i) => { if (c) b[i] = c; });
    for (const k of t.hi || []) {
      if (typeof k === 'function') { const bb = new Array(1024).fill(null); k(bb); bb.forEach((c, i) => { if (c) b[i] = c; }); }
      else lay32Over(b, OBJ32[k], 0, 0);
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32; cv.hi = 2;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32);
    blit(img, b, 0, 0, palette(Object.assign({ J: '#e4b47c' }, over)), false, 32);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  // One tile drawn as if it were `ch` (used for things that change at runtime,
  // like a curtain being pulled open), with `over` swapping any colours.
  function renderTileAs(floor, x, y, ch, over) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const get = (xx, yy) => (xx === x && yy === y) ? ch
      : (xx < 0 || yy < 0 || xx >= W || yy >= H) ? ' ' : floor.tiles[yy][xx];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16);
    blit(img, tile(get, floor.floor[y][x], x, y), 0, 0, palette(over), false);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // Returns {down:[stand,walkA,walkB], up, left, right} canvases for a look.
  // `sweater` (a key in SWEATERS) knits an ugly Christmas sweater over their shirt.
  function renderSprites(gender, look, sweater) {
    const sw = gender !== 'ghost' && SWEATERS[sweater], rows = sw ? sweaterRows(sw) : {};
    const pal = palette(gender === 'ghost' ? {} : Object.assign({}, look, sw ? sweaterPal(sw) : null)), out = {};
    const SP = gender === 'female' ? SPRITES_F : gender === 'ghost' ? SPRITES_GHOST : SPRITES;
    const make = (art, flip, knit) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), b = buf();
      stamp(b, art);
      if (knit) knitOver(b, knit);
      blit(img, b, 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    out.down = [make(SP.down[0], false, rows.down), make(SP.down[1], false, rows.down), make(SP.down[1], true, rows.down)];
    out.up = [make(SP.up[0], false, rows.up), make(SP.up[1], false, rows.up), make(SP.up[1], true, rows.up)];
    out.left = [make(SP.left[0], false, rows.left), make(SP.left[1], false, rows.leftWalk), make(SP.left[1], false, rows.leftWalk)];
    out.right = [make(SP.left[0], true, rows.left), make(SP.left[1], true, rows.leftWalk), make(SP.left[1], true, rows.leftWalk)];
    return out;
  }
  // A sweater's rows over a coworker's body (rows 10-12, as on the look sprites), only where
  // their shirt is, or a bare arm it has a sleeve over: long hair down their back stays put.
  function knitOver(b, rows) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const k = (10 + j) * 16 + i;
      if (ch >= '1' && ch <= '9' && ['w', 'u', 's'].includes(b[k])) b[k] = ch;
    }));
  }

  // Dogs: h = coat, D = ears and darker patches, y = chest and belly, u = collar.
  const DOG_TOP = ['................', '................', '................', '................'];
  const DOG = {
    down: DOG_TOP.concat([
      '...kk......kk...',
      '..kDDk....kDDk..',
      '..kDhhkkkkhhDk..',
      '...khhhhhhhhk...',
      '...khkhhhhkhk...',
      '...khhhhhhhhk...',
      '....khhkkhhk....',
      '....kuuuuuuk....',
      '...khyyyyyyhk...',
    ]),
    up: DOG_TOP.concat([
      '...kk......kk...',
      '..kDDk....kDDk..',
      '..kDhhkkkkhhDk..',
      '...khhhhhhhhk...',
      '...khhhhhhhhk...',
      '....khhhhhhk....',
      '....kuuuuuuk....',
      '...khhhhhhhhk...',
      '...khhhkkhhhk...',
    ]),
    left: DOG_TOP.concat([
      '...kk...........',
      '..kDDk..........',
      '.khhhDk.......k.',
      'kkhkhhhk.....khk',
      'khhhhhhhkkkkkhk.',
      '.kkhhuhhhhhhhhk.',
      '...kuhhhhhhhhhk.',
      '...khhhhhhhhhhk.',
      '...khyyyyyyyhhk.',
    ]),
  };
  const DOG_LEGS = {
    down: [['...khk....khk...', '...khk....khk...', '...kkk....kkk...'],
      ['...khk....khk...', '...kkk....khk...', '..........kkk...']],
    up: [['...khk.kk.khk...', '...khk....khk...', '...kkk....kkk...'],
      ['...khk.kk.khk...', '...kkk....khk...', '..........kkk...']],
    left: [['...khk.....khk..', '...khk.....khk..', '...kk......kk...'],
      ['..khk......khk..', '.khk........khk.', '.kk..........kk.']],
  };
  // A cat, curled up sitting and fast asleep. h = coat, D = stripes, y = chest.
  const CAT = [
    '................',
    '................',
    '................',
    '................',
    '....kk....kk....',
    '....khk..khk....',
    '....khhkkhhk....',
    '...khhDhhDhhk...',
    '...khkkhhkkhk...',
    '...khhhyyhhhk...',
    '....khhkkhhk....',
    '...khDhhhhDhk...',
    '..khhhyyyyhhhk..',
    '..khDhyyyyhDhkk.',
    '..khhhyyyyhhkDk.',
    '...kkkkkkkkkkk..',
  ];
  // Returns {down:[stand,walkA,walkB], up, left, right} canvases for a dog (or, with
  // look.cat, the same sleeping cat every way round).
  function renderDog(look) {
    const { cat, ...colours } = look, pal = palette(colours), out = {};
    const make = (art, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), b = buf();
      stamp(b, art);
      blit(img, b, 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    if (cat) {
      const img = make(CAT);
      for (const d of ['down', 'up', 'left', 'right']) out[d] = [img, img, img];
      return out;
    }
    const frame = (d, i) => DOG[d].concat(DOG_LEGS[d][i]);
    out.down = [make(frame('down', 0)), make(frame('down', 1)), make(frame('down', 1), true)];
    out.up = [make(frame('up', 0)), make(frame('up', 1)), make(frame('up', 1), true)];
    out.left = [make(frame('left', 0)), make(frame('left', 1)), make(frame('left', 1))];
    out.right = [make(frame('left', 0), true), make(frame('left', 1), true), make(frame('left', 1), true)];
    return out;
  }

  // A picture at double resolution, by Scale2x: each pixel becomes four, and where two
  // neighbours of the same colour meet at a corner that corner takes their colour, so
  // diagonals and curves come out smoother instead of just blockier. The canvas it gives
  // back is marked hi: 2, so the game draws it at the original's size (see js/game.js).
  function scale2x(src) {
    const w = src.width, h = src.height;
    const inp = new Uint32Array(src.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    const cv = document.createElement('canvas');
    cv.width = w * 2; cv.height = h * 2;
    const c = cv.getContext('2d'), img = c.createImageData(w * 2, h * 2), out = new Uint32Array(img.data.buffer);
    const at = (x, y) => inp[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), l = at(x - 1, y), d = at(x, y + 1), o = (y * 2 * w + x) * 2;
        const edge = a !== d && l !== b;
        out[o] = edge && l === a ? l : p;
        out[o + 1] = edge && a === b ? b : p;
        out[o + w * 2] = edge && l === d ? l : p;
        out[o + w * 2 + 1] = edge && d === b ? b : p;
      }
    c.putImageData(img, 0, 0);
    cv.hi = 2;
    return cv;
  }

  // ---------- dogs and the cat at 32 x 32 (for &hires: see js/game.js) ----------
  // Each way a dog faces, standing and mid-step (from row DOG32.from); the cat curled up
  // asleep (from row DOG32.catFrom). Their own colours (h, D, y, u, as at 16) plus H, the
  // coat in shadow, j, a shine on it, R, the tongue and nose, and o, the collar's tag.
  const DOG32 = {
    from: 7,
    down: [[
        '............kkkkkkkk',
        '.......kkk.kkkkkkkkkk.kkk',
        '......kkkkkkhhhhhhhHkkkkkk',
        '.....kkDDDkhhhhhhhhhHkDDDkk',
        '.....kkDDDhhjjhhhhhhhHDDDkk',
        '....kkDDDDDhjhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhWkhhhhWkhDDDDDkk',
        '....kkDDDDDhkkhhhhkkhDDDDDkk',
        '.....kkDDDhhhyyWkyyhhHDDDkk',
        '.....kkDDDHhyyykkyyyHHDDDkk',
        '......kkkkkHyyyyyyyyHkkkkk',
        '.......kkkkkHykRRkyHkkkkk',
        '..........kkHHHHHHHHkk',
        '.........kkuuuuuuuuuukk',
        '........kkHHHHyooyHHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '.........kkHHyyyyyyHHkk',
        '.........kkHHHyyyyHHHkk',
        '.........kkyyykkkkyyykk',
        '.........kkyyykkkkyyykk',
        '.........kkyyykkkkyyykk',
        '..........kkkkk..kkkkk',
    ], [
        '............kkkkkkkk',
        '.......kkk.kkkkkkkkkk.kkk',
        '......kkkkkkhhhhhhhHkkkkkk',
        '.....kkDDDkhhhhhhhhhHkDDDkk',
        '.....kkDDDhhjjhhhhhhhHDDDkk',
        '....kkDDDDDhjhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhWkhhhhWkhDDDDDkk',
        '....kkDDDDDhkkhhhhkkhDDDDDkk',
        '.....kkDDDhhhyyWkyyhhHDDDkk',
        '.....kkDDDHhyyykkyyyHHDDDkk',
        '......kkkkkHyyyyyyyyHkkkkk',
        '.......kkkkkHykRRkyHkkkkk',
        '..........kkHHHHHHHHkk',
        '.........kkuuuuuuuuuukk',
        '........kkHHHHyooyHHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '........kkHHHyyyyyyHHHkk',
        '.........kkHHyyyyyyHHkk',
        '.........kkyHHyyyyHHHkk',
        '.........kkyyykkkkyyykk',
        '..........kkkkkkkkyyykk',
        '...........kkk..kkyyykk',
        '.................kkkkk',
    ]],
    up: [[
        '............kkkkkkkk',
        '.......kkk.kkkkkkkkkk.kkk',
        '......kkkkkkhhhhhhhHkkkkkk',
        '.....kkDDDkhhhhhhhhhHkDDDkk',
        '.....kkDDDhhjjhhhhhhhHDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '.....kkDDDhhhhhhhhhhhHDDDkk',
        '.....kkDDDHhhhhhhhhhHHDDDkk',
        '......kkkkkHHhhhhhHHHkkkkk',
        '.......kkkkkHHHkkHHHkkkkk',
        '..........kuuukhhkuuuk',
        '.........kkHHHkhhkHHHkk',
        '........kkHHHHkhhkHHHHkk',
        '.......kkHHHHHkhhkHHHHHkk',
        '.......kkHHHHHkhhkHHHHHkk',
        '........kkHHHHkhhkHHHHkk',
        '.........kkHHHHkkHHHHkk',
        '.........kkHHHHHHHHHHkk',
        '.........kkHHHkkkkHHHkk',
        '.........kkHHHkkkkHHHkk',
        '.........kkHHHkkkkHHHkk',
        '..........kkkkk..kkkkk',
    ], [
        '............kkkkkkkk',
        '.......kkk.kkkkkkkkkk.kkk',
        '......kkkkkkhhhhhhhHkkkkkk',
        '.....kkDDDkhhhhhhhhhHkDDDkk',
        '.....kkDDDhhjjhhhhhhhHDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '....kkDDDDDhhhhhhhhhhDDDDDkk',
        '.....kkDDDhhhhhhhhhhhHDDDkk',
        '.....kkDDDHhhhhhhhhhHHDDDkk',
        '......kkkkkHHhhhhhHHHkkkkk',
        '.......kkkkkHHHHHkkHkkkkk',
        '..........kuuuuukhhkuk',
        '.........kkHHHHHkhhkHkk',
        '........kkHHHHHHkhhkHHkk',
        '.......kkHHHHHHHkhhkHHHkk',
        '.......kkHHHHHHHkhhkHHHkk',
        '........kkHHHHHHkhhkHHkk',
        '.........kkHHHHHHkkHHkk',
        '.........kkHHHHHHHHHHkk',
        '.........kkHHHkkkkHHHkk',
        '..........kkkkkkkkHHHkk',
        '...........kkk..kkHHHkk',
        '.................kkkkk',
    ]],
    left: [[
        '......kkkkkkk...............k',
        '.....kkkkkkkkk.............kkk',
        '....kkHHjjjHHkk...........kkHkk',
        '...kkHHHHHHHDHkk.........kkHHHkk',
        '..kkHHHHHHHDDDHkk........kkHHHkk',
        '..kkHHHWkHDDDDHkk........kkHHHkk',
        '.kkkyyHkkHDDDDHkk........kkHHHkk',
        'kWkyyyyHHHDDDDHkk........kkHHHkk',
        'kkkyyyyyHHDDDDHkkkkkkkkkkkkHHHkk',
        'kkyyyyyyHHHDDDuukkkkkkkkkkkHHHkk',
        '.kkkkRHHHHHDDkuuhhhhhhhhhkkkHkk',
        '..kkkkkkkkkkhhuuhhhhhhhhhhHkkk',
        '...kkkkkkkkhhhuuhhhhhhhhhhhHkk',
        '.........kkhhhuuhhhhhhhhhhhHkk',
        '.........kkhhhohhhhhhhhhhhhHkk',
        '.........kkHhhhhhhhhhhhhhHHHkk',
        '..........kkyyyyyyyyyyhHHHHkk',
        '.........kkHHHyyyyyyyyHHHHkk',
        '.........kkHHHkkkkkkkkkHHHkk',
        '.........kkHHHkkkkkkkkkHHHkk',
        '.........kkHHHkk.....kkHHHkk',
        '.........kkHHHkk.....kkHHHkk',
        '.........kkyyykk.....kkyyykk',
        '.........kkyyykk.....kkyyykk',
        '..........kkkkk.......kkkkk',
    ], [
        '......kkkkkkk...............k',
        '.....kkkkkkkkk.............kkk',
        '....kkHHjjjHHkk...........kkHkk',
        '...kkHHHHHHHDHkk.........kkHHHkk',
        '..kkHHHHHHHDDDHkk........kkHHHkk',
        '..kkHHHWkHDDDDHkk........kkHHHkk',
        '.kkkyyHkkHDDDDHkk........kkHHHkk',
        'kWkyyyyHHHDDDDHkk........kkHHHkk',
        'kkkyyyyyHHDDDDHkkkkkkkkkkkkHHHkk',
        'kkyyyyyyHHHDDDuukkkkkkkkkkkHHHkk',
        '.kkkkRHHHHHDDkuuhhhhhhhhhkkkHkk',
        '..kkkkkkkkkkhhuuhhhhhhhhhhHkkk',
        '...kkkkkkkkhhhuuhhhhhhhhhhhHkk',
        '.........kkhhhuuhhhhhhhhhhhHkk',
        '.........kkhhhohhhhhhhhhhhhHkk',
        '.........kkHhhhhhhhhhhhhhHHHkk',
        '........kkkkyyyyyyyyyyhHHHHkkk',
        '.......kkHHHkkyyyyyyyyHHHkHHHkk',
        '.......kkHHHkkkHHkkkkHHkkkHHHkk',
        '.......kkHHHkkkHHkkkkHHkkkHHHkk',
        '.......kkHHHkkkHHkkkkHHkkkHHHkk',
        '.......kkHHHkkkHHkkkkHHkkkHHHkk',
        '.......kkyyykkkyykkkkyykkkyyykk',
        '.......kkyyykkkyykkkkyykkkyyykk',
        '........kkkkk.kkkk..kkkk.kkkkk',
    ]],
    catFrom: 13,
    cat: [
      '......kk....kk',
      '.....kkkk..kkkk',
      '....kkHHkkkkHHkk',
      '....kkHHkkkkHHkkkkkkkkkk',
      '...kkHHRHHHHHRHkkkkkkkkkkk',
      '...kkHHHHHHHHHhhjjhhhhhHkkkk',
      '...kkHHHHHHHhhkjhhDhhhDhhHDkk',
      '...kkHHHHHHhhhhkhhDhhhDhhhDHkk',
      '...kkHHHHHhhhhhkhDhhhDhhhDhHHkk',
      '...kkHHkkHhkkhhkhhhhhhhhhhhHHkk',
      '...kkHHHHyyhhhhkhhhhhhhhhhhHHkk',
      '....kkHyyRRyyhkhhhhhhhhhhhhHHkk',
      '.....kkyyyyykkkkkkkkkkkkhhHHHkk',
      '......kkkkkkDDhhDDhhDDhhkkkkkk',
      '......kkDDHHDDHHDDhhDDHHDDHHkk',
      '......kkDDHHDDHHDDHHDDHHDDHHkk',
      '.......kkkkkDDHHDDHHDDHHkkkkk',
      '........kkkkkkkkkkkkkkkkkkkk',
      '............kkkkkkkkkkkk',
    ],
  };
  function renderDog32(look) {
    const { cat, ...c } = look, out = {};
    const pal = palette(Object.assign({ H: darker(c.h, 0.25), j: blend(c.h, '#ffffff', 0.35), R: '#f07878', o: '#f0c838', W: '#ffffff' }, c));
    const make = (rows, y0, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = new Array(1024).fill(null);
      lay32(b, rows, y0);
      blit(img, b, 0, 0, pal, flip, 32);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    if (cat) {
      const img = make(DOG32.cat, DOG32.catFrom);
      for (const d of ['down', 'up', 'left', 'right']) out[d] = [img, img, img];
      return out;
    }
    const f = DOG32.from;
    out.down = [make(DOG32.down[0], f), make(DOG32.down[1], f), make(DOG32.down[1], f, true)];
    out.up = [make(DOG32.up[0], f), make(DOG32.up[1], f), make(DOG32.up[1], f, true)];
    out.left = [make(DOG32.left[0], f), make(DOG32.left[1], f), make(DOG32.left[1], f)];
    out.right = [make(DOG32.left[0], f, true), make(DOG32.left[1], f, true), make(DOG32.left[1], f, true)];
    return out;
  }

  // ---------- Halloween costumes at 32 x 32 ----------
  // Each is laid over the look (or the coworker) drawn bald, or with their own hair where
  // it says `own`, in the costume's colours (its `pal` at 16, then any more here, which are
  // the 32 x 32 ones only). '.' leaves what's underneath and '_' rubs it out, as at 16. A
  // `logo` is laid at `sign`, front and back (the SDG sign's).
  const COSTUME32 = {
    clown: {
      // (white face paint, white gloves, pink cheeks)
      pal: { s: '#f8f8f8', f: '#f8b0b0' },
      down: [
        '.....kkkkkkkkhHhhhhkkkkkkkk',
        '....kkkhhhHkhhhhhHhhkhhhHkkk',
        '...kkhHhhhhhhHhhhhhhHhhhhhhkk',
        '...kkhhhhHhhhhhhHhhhhhhHhhhkk',
        '..kkkHhhhhhhHhhhhhhHhhhhhhHkkk',
        '.kkhhhhhHhhhhkhHhhkhhhHhhhhhhkk',
        'kkhhHhhhhhhkkkkkkkkkkhhhhHhhhhkk',
        'kkhhhhhHhkkkk.kkkk.kkkkhhhhhHhkk',
        'kkhHhhhhkkk..........kkkHhhhhhkk',
        'kkhhhhHhkk............kkhhhHhhkk',
        'kkHhhhhhkk.uu......uu.kkhhhhhhkk',
        'kkhhhHhhkk............kkhhHhhhkk',
        'kkhhhhhhkk............kkhhhhhHkk',
        'kkhhHhhhkk............kkhHhhhhkk',
        'kkhhhhhHkk....MMMM....kkhhhhHhkk',
        'kkhHhhhhkk....MMMM....kkHhhhhhkk',
        '.kkhhhHkk..uM..MM..Mu..kkhhHhkk',
        '..kkkkkk.....MMMMMM.....kkkkkk',
        '...kkkk.kkkkkkkkkkkkkkkk.kkkk',
        '.......kFuFFFuFFFuFFFuFFk',
        '.......kuFFFuFFFuFFFuFFFk',
        '.......kFkFukFFkFFkuFkFuk',
        '........k.kk.kk.kk.kk.kk',
        '...............MM',
        '',
        '...............MM',
      ],
      up: [
        '.....kkkkkkkkhHhhhhkkkkkkkk',
        '....kkkhhhHkhhhhhHhhkhhhHkkk',
        '...kkhHhhhhhhHhhhhhhHhhhhhhkk',
        '...kkhhhhHhhhhhhHhhhhhhHhhhkk',
        '..kkkHhhhhhhHhhhhhhHhhhhhhHkkk',
        '.kkhhhhhHhhhhhhHhhhhhhHhhhhhhkk',
        'kkhhHhhhhhhHhhhhhhHhhhhhhHhhhhkk',
        'kkhhhhhHhhhhhhHhhhhhhHhhhhhhHhkk',
        'kkhHhhhhhhHhhhhhhHhhhhhhHhhhhhkk',
        'kkhhhhHhhhhhhHhhhhhhHhhhhhhHhhkk',
        'kkHhhhhhhHhhhhhhHhhhhhhHhhhhhhkk',
        'kkhhhHhhhhhhHhhhhhhHhhhhhhHhhhkk',
        'kkhhhhhhHhhhhhhHhhhhhhHhhhhhhHkk',
        'kkhhHhhhhhhHhhhhhhHhhhhhhHhhhhkk',
        'kkhhhhhHhhhhhhHhhhhhhHhhhhhhHhkk',
        'kkhHhhhhkhHhhhhhhHhhhhhkHhhhhhkk',
        '.kkhhhHkkkhhhHhhhhhhHhkkkhhHhkk',
        '..kkkkkk.kkhhhhhHhhhhkk.kkkkkk',
        '...kkkk.kkkkkkkkkkkkkkkk.kkkk',
        '.......kFuFFFuFFFuFFFuFFk',
        '.......kuFFFuFFFuFFFuFFFk',
        '.......kFkFukFFkFFkuFkFuk',
        '........k.kk.kk.kk.kk.kk',
      ],
      left: [
        '...........kkkkkkkk',
        '..........kkhhhhhHkk',
        '.........kkhhHhhhhhkkk',
        '........kkhhhhhhHhhhkkk',
        '........kkhhHhhhhhhHhhkk',
        '.........kkhhhhHhhhhhhHkk',
        '..........kkhhhhhhHhhhhhkk',
        '...........kkkkkhhhhhHhhkk',
        '............kkkhhHhhhhhhHkk',
        '.............kkhhhhhHhhhhkk',
        '..............kkHhhhhhhHkkk',
        '..............kkhhhHhhhhhhkk',
        '....kkk........kkhhhhhHhhhhkk',
        '...kMMMk........kkHhhhhhhHhkk',
        '...kMMMk.........kkkkHhhhhhkk',
        '...kMMMk..........kkkhhhHhhkk',
        '....kkk.............kkhhhhkk',
        '........MM...........kkkkkk',
        '........kkkkkkkkkkkkkkkkkk',
        '.......kFuFFFuFFFuFFFuFFk',
        '.......kuFFFuFFFuFFFuFFFk',
        '.......kFkFukFFkFFkuFkFuk',
        '........k.kk.kk.kk.kk.kk',
      ],
    },
    vampire: {
      down: [
        '',
        '.............kkkkkk',
        '...........kkkkkkkkkk',
        '.........kkkkhjhhhhkkkk',
        '........kkkhjjhhhhhhhkkk',
        '.......kkhhhhhhhhhhhhhhkk',
        '....k..kkhhhhhhhhhhhhhhkk..k',
        '...kkkkkhhkkkkkkkkkkkkhhkkkkk',
        '..kkxkkhhhhhhkkkkkkhhhhhhkkxkk',
        '..kkxukhhhhhhhhkkhhhhhhhhkuxkk',
        '..kkxukhhkkkkkkkkkkkkkkhhkuxkk',
        '..kkxuuhhkkkkkk..kkkkkkhhuuxkk',
        '..kkxxukkk............kkkuxxkk',
        '..kkxxukk...u.......u..kkuxxkk',
        '..kkxxuukk............kkuuxxkk',
        '..kkxxuukk............kkuuxxkk',
        '..kkxxxuukk..........kkuuxxxkk',
        '..kkxxxuukk...W..W...kkuuxxxkk',
        '..kkxxxuuukk........kkuuuxxxkk',
        '..kkxxxuuukk........kkuuuxxxkk',
        '..kkxkkxxuukk..uu..kkuuxxkkxkk',
        '...kkkkxxukk........kkuxxkkkk',
        '....kkkxxuk..........kuxxkkk',
        '.....kkxxu............uxxkk',
        '.....kkxxu............uxxkk',
        '.....kkxxu............uxxkk',
        '.....kkxxu............uxxkk',
      ],
      up: [
        '',
        '............kkkkkkkk',
        '..........kkkkkkkkkkkk',
        '.........kkkhhhhhhhhkkk',
        '........kkhhjjhhhhhhhhkk',
        '.......kkhhhhhhhhhhhhhhkk',
        '....k.kkhhhhhhhhhhhhhhhhkk.k',
        '...kkkkkhhhhhhhhhhhhhhhhkkkkk',
        '..kkxkkhhhhhhhhhhhhhhhhhhkkxkk',
        '..kkxukhhhhhhhhhhhhhhhhhhkuxkk',
        '..kkxukhhhhhhhhhhhhhhhhhhkuxkk',
        '..kkxuuhhhhhhhhhhhhhhhhhhuuxkk',
        '..kkxxukhhhhhhhhhhhhhhhhkuxxkk',
        '..kkxxukhhhhhhhhhhhhhhhhkuxxkk',
        '..kkxxuukhhhhhhhhhhhhhhkuuxxkk',
        '..kkxxuukhhhhhhhhhhhhhhkuuxxkk',
        '..kkxxxuukkkkkkkkkkkkkkuuxxxkk',
        '..kkxxxuukkkkkkkkkkkkkkuuxxxkk',
        '..kkxxxuuxxxxxxxxxxxxxxuuxxxkk',
        '..kkxxxuuxxxxxxxxxxxxxxuuxxxkk',
        '..kkxxxxxxxxxxxxxxxxxxxxxxxxkk',
        '...kkkkkxxxxxxxxxxxxxxxxkkkkk',
        '....kkkkxxxxxxxxxxxxxxxxkkkk',
        '.....kkxxxxxxxxxxxxxxxxxxkk',
        '.....kkxxxxxxxxxxxxxxxxxxkk',
        '.....kkxxxxxxxxxxxxxxxxxxkk',
        '....kkxxxxxxxxxxxxxxxxxxxxkk',
        '....kkxxxxxxxxxxxxxxxxxxxxkk',
        '...kkxxxxxxxxxxxxxxxxxxxxxxkk',
        '...kkxxxxxxxxxxxxxxxxxxxxxxkk',
        '...kkxxxxxxxxxxxxxxxxxxxxxxkk',
        '....kkkkkkkkkkkkkkkkkkkkkkkk',
      ],
      left: [
        '',
        '.............kkkkkk',
        '...........kkkkkkkkkk',
        '.........kkkkhhhhhhkkkk',
        '........kkkhhhhhhhhhhkkk',
        '.......kkhhhhhhhhhhhhhhkk',
        '.......kkhhhhhhhhhhhhhhkkk',
        '........kkhhhhhhhhhhhhhhkkk',
        '........kkhhhhhhhhhhhhhhhxkk',
        '.........kkkkhhhhhhhhhhhhxkk',
        '..........kkkhhhhhhhhhhhhxkk',
        '...........kkhhhhhhhhhhhhxkk',
        '...........kkhhhhhhhhhhhxkk',
        '...........kkhhhhhhhhhhhxkk',
        '...........kkhhhhhhhhhhxxkk',
        '............kkkkkkkkkuuxxkk',
        '.............kkkkkkkkuuxxkk',
        '.........W........kkuuuxxkk',
        '..................kkuuxxxkk',
        '.................kkuuuxxxkk',
        '...............uuuxxxxxxkkk',
        '.................uxxxxxxkk',
        '.................uxxxxxxkk',
        '.................uxxxxxxkk',
        '.................uxxxxxxkk',
        '.................uxxxxxxkk',
        '.................uxxxxxxkk',
      ],
    },
    skeleton: {
      down: [
        '',
        '...............kk',
        '............kkkkkkkk',
        '..........kkkkkbbkkkkk',
        '.........kkkbbbbbbbbkkk',
        '........kkbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbkkbbbbbbkkbbbkk',
        '......kkbbkkkkbbbbkkkkbbkk',
        '......kkbbkkkkbbbbkkkkbbkk',
        '......kkbbkkkkbbbbkkkkbbkk',
        '.......kkbbkkbbbbbbkkbbkk',
        '.......kkbbbbbbkkbbbbbbkk',
        '........kkbbbbbbbbbbbbkk',
        '.........kkkbkbkbkbkbkk',
        '..........kkkkkkkkkkkk',
        '............kkkkkkkk',
        '..........xxxxxbbxxxxx',
        '..........xbbbbbbbbbbx',
        '..........xxxxxbbxxxxx',
        '..........xbbbbbbbbbbx',
        '..........xxxxxbbxxxxx',
        '..........xbbbbbbbbbbx',
        '...........bb......bb',
        '...........bb......bb',
        '...........bb......bb',
        '...........bb......bb',
      ],
      up: [
        '',
        '...............kk',
        '............kkkkkkkk',
        '..........kkkkkbbkkkkk',
        '.........kkkbbbbbbbbkkk',
        '........kkbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '........kkbbbbbbbbbbbbkk',
        '.........kkkbbbbbbbbkkk',
        '..........kkkkkkkkkkkk',
        '............kkkkkkkk',
        '..........xxxxxbbxxxxx',
        '..........xxxxxbbxxxxx',
        '..........xxxxxbbxxxxx',
        '..........xxxxxbbxxxxx',
        '..........xxxxxbbxxxxx',
        '..........xxxxxbbxxxxx',
        '...........bb......bb',
        '...........bb......bb',
        '...........bb......bb',
        '...........bb......bb',
      ],
      left: [
        '',
        '...............kk',
        '............kkkkkkkk',
        '..........kkkkkbbkkkkk',
        '.........kkkbbbbbbbbkkk',
        '........kkbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbbbbbbbbbbbbbbbbkk',
        '......kkbkbbbbbbbbbbbbbbkk',
        '......kkkkkbbbbbbbbbbbbbkk',
        '......kkkkkkbbbbbbbbbbbbkk',
        '......kkkkkbbbbbbbbbbbbbkk',
        '.......kkkbbbbbbbbbbbbbkk',
        '.......kkbbbbbbbbbbbbbbkk',
        '........kkbbbbbbbbbbbbkk',
        '........bkbkbkbbbbbbkkk',
        '..........kkkkkbbkkkkk',
        '............kkkkkkkk',
        '..........xxxbxxxxxxxx',
        '..........xbbbbxxbbbbx',
        '..........xxxbxxxxxxxx',
        '..........xbbbbxxbbbbx',
        '..........xxxbxxxxxxxx',
        '..........xbbbbxxbbbbx',
        '.............bb...b',
        '.............bb...b',
        '.............bb...b',
        '.............bb...b',
      ],
    },
    witch: {
      down: [
        '................kkkVVVVVk',
        '..............kkkkVVVVVVk',
        '.............kkkVVVVVVkk',
        '...........kkkVVVVVVVVkk',
        '..kkkkkkkkkkkVVVVVVVVVkkkkkkkk',
        '.kkkkkkkkkkOOOOOOOOOOOkkkkkkkkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        '.kkkHxxkVVVVVVVVVVVVVVVVkHxxkkk',
        '.kkHxxHxkkkkkkkkkkkkkkkkHxxHxkk',
        '.kkxxHxxkkkkkkkkkkkkkkkkxxHxxkk',
        '.kkxHxxHkk............kkxHxxHkk',
        '.kkHxxHxkk............kkHxxHxkk',
        '.kkxxHxxkk............kkxxHxxkk',
        '.kkxHxxHkk............kkxHxxHkk',
        '.kkHxxHxkk.....SS.....kkHxxHxkk',
        '.kkxxHxxkk.....SS.....kkxxHxxkk',
        '..kkHxxkk..............kkHxxkk',
        '..kkxxHkk..............kkxxHkk',
        '...kkkkk................kkkkk',
        '....kkk..................kkk',
      ],
      up: [
        '................kkkVVVVVk',
        '..............kkkkVVVVVVk',
        '.............kkkVVVVVVkk',
        '...........kkkVVVVVVVVkk',
        '..kkkkkkkkkkkVVVVVVVVVkkkkkkkk',
        '.kkkkkkkkkkOOOOOOOOOOOkkkkkkkkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        '.kkkHxxkVVVVVVVVVVVVVVVVkHxxkkk',
        '.kkHxxHxkkkkkkkkkkkkkkkkHxxHxkk',
        '.kkxxHxxkkkkkkkkkkkkkkkkxxHxxkk',
        '.kkxHxxHkk............kkxHxxHkk',
        '.kkHxxHxkk............kkHxxHxkk',
        '.kkxxHxxkk............kkxxHxxkk',
        '.kkxHxxHkk............kkxHxxHkk',
        '.kkHxxHxkk............kkHxxHxkk',
        '.kkxxHxxkk............kkxxHxxkk',
        '..kkHxxkk..............kkHxxkk',
        '..kkxxHkk..............kkxxHkk',
        '...kkkkk................kkkkk',
        '....kkk..................kkk',
      ],
      left: [
        '................kkkVVVVVk',
        '..............kkkkVVVVVVk',
        '.............kkkVVVVVVkk',
        '...........kkkVVVVVVVVkk',
        '..kkkkkkkkkkkVVVVVVVVVkkkkkkkk',
        '.kkkkkkkkkkOOOOOOOOOOOkkkkkkkkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        'kkVVVVVVVVVVVVVVVVVVVVVVVVVVVVkk',
        '.kkkkkkkVVVVVVVVVVVVVVVVkkkkkkk',
        '..kkkkkkkkkkkkkkkkkxxHxxHkkkkk',
        '........kkkkkkkkkkkxHxxHxkk',
        '.................kkHxxHxxkk',
        '....kk...........kkxxHxxHkk',
        '...kssk..........kkxHxxHxkk',
        '...kssk..........kkHxxHxxkk',
        '...kssk..........kkxxHxxHkk',
        '...kssk..........kkxHxxHxkk',
        '....kk............kkxxHxkk',
        '..................kkxHxxkk',
        '...................kkkkkk',
        '....................kkkk',
      ],
    },
    pumpkin: {
      // (the jack-o'-lantern's glow)
      pal: { o: '#f8e040' },
      down: [
        '...............khhk',
        '...........kkkkhhhkkk',
        '..........kkkkkhhhkkkk',
        '........kkkqOOOhhhOOqkkk',
        '.......kkkOqOOOOqOOOOqkkk',
        '......kkOOOqOOOOqOOOOqOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOoOOOOqOOOoqOOOqkk',
        '....kkOOOOoooOOOqOOoooOOOqkk',
        '....kkOOOoooooOOqOoooooOOqkk',
        '....kkOOOoooooOOqOoooooOqqkk',
        '....kkOOOOOqOOOooOOOOqOOqqkk',
        '.....kkOOOOqOOOooOOOOqOqqkk',
        '.....kkqOOooOooOooOooqOqqkk',
        '......kkqOkooooooooookqqkk',
        '.......kkqqooOooqooOooqkk',
        '........kkkqqqqqqqqqqkkk',
        '.........kkkkqqqqqqkkkk',
        '...........kkkkkkkkkk',
        '.............kkkkkk',
      ],
      up: [
        '...............khhk',
        '...........kkkkhhhkkk',
        '..........kkkkkhhhkkkk',
        '........kkkqOOOhhhOOqkkk',
        '.......kkkOqOOOOqOOOOqkkk',
        '......kkOOOqOOOOqOOOOqOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOqqkk',
        '....kkOOOOOqOOOOqOOOOqOOqqkk',
        '.....kkOOOOqOOOOqOOOOqOqqkk',
        '.....kkqOOOqOOOOqOOOOqOqqkk',
        '......kkqOOqOOOOqOOOOqqqkk',
        '.......kkqqqOOOOqOOOqqqkk',
        '........kkkqqqqqqqqqqkkk',
        '.........kkkkqqqqqqkkkk',
        '...........kkkkkkkkkk',
        '.............kkkkkk',
      ],
      left: [
        '...............khhk',
        '...........kkkkhhhkkk',
        '..........kkkkkhhhkkkk',
        '........kkkqOOOhhhOOqkkk',
        '.......kkkOqOOOOqOOOOqkkk',
        '......kkOOOqOOOOqOOOOqOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '.....kkOOOOqOOOOqOOOOqOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOOOOqOOOOqOOOOqOOOqkk',
        '....kkOOooOqOOOOqOOOOqOOOqkk',
        '....kkOooooqOOOOqOOOOqOOOqkk',
        '....kkooooooOOOOqOOOOqOOqqkk',
        '....kkOOOOOqOOOOqOOOOqOOqqkk',
        '.....kkOOOOqOOOOqOOOOqOqqkk',
        '.....kkooOooOOOOqOOOOqOqqkk',
        '......kooooooOOOqOOOOqqqkk',
        '.......ooooooOOOqOOOqqqkk',
        '........kkkqqqqqqqqqqkkk',
        '.........kkkkqqqqqqkkkk',
        '...........kkkkkkkkkk',
        '.............kkkkkk',
      ],
    },
    mummy: {
      down: [
        '',
        '..............kkkk',
        '...........kkkkkkkkkk',
        '..........kkkkbBBBkkkk',
        '.........kkBBBBbbbbbbkk',
        '........kkbbbbbbbbbbBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '......kkbbBBBBBbbbbbbbbbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '.....kkbbbBBBBBbbbbbbbbbbkk',
        '.....kkBBBbbbbbbbbbbBBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '......kkbbkkWkkkkkkWkkkbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '........kkBBBBBbbbbbbbkk',
        '.........kkbbbbbbbbbBkk.k',
        '..........kkkkbBBBkkkk.kbk',
        '...........kkkkkkkkkk..kbk',
        '..............kkkk.....kbk',
        '.......................kbbk',
        '.......................kbbk',
        '.......................kbk',
        '........................k',
      ],
      up: [
        '',
        '..............kkkk',
        '...........kkkkkkkkkk',
        '..........kkkkbBBBkkkk',
        '.........kkBBBBbbbbbbkk',
        '........kkbbbbbbbbbbBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '......kkbbBBBBBbbbbbbbbbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '.....kkbbbBBBBBbbbbbbbbbbkk',
        '.....kkBBBbbbbbbbbbbBBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '......kkbbBBBBBbbbbbbbbbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '........kkBBBBBbbbbbbbkk',
        '.........kkbbbbbbbbbBkk.k',
        '..........kkkkbBBBkkkk.kbk',
        '...........kkkkkkkkkk..kbk',
        '..............kkkk.....kbk',
        '.......................kbbk',
        '.......................kbbk',
        '.......................kbk',
        '........................k',
      ],
      left: [
        '',
        '..............kkkk',
        '...........kkkkkkkkkk',
        '..........kkkkbBBBkkkk',
        '.........kkBBBBbbbbbbkk',
        '........kkbbbbbbbbbbBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '......kkbbBBBBBbbbbbbbbbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '.....kkbbbBBBBBbbbbbbbbbbkk',
        '.....kkBBBbbbbbbbbbbBBBBBkk',
        '......kkbbbbbbbBBBBBbbbbkk',
        '......kkkWkkkBBbbbbbbbbbkk',
        '......kkBBbbbbbbbbbbBBBBkk',
        '.......kkbbbbbbBBBBBbbbkk',
        '........kkBBBBBbbbbbbbkk',
        '.........kkbbbbbbbbbBkkk',
        '..........kkkkbBBBkkkkkbk',
        '...........kkkkkkkkkk.kbk',
        '..............kkkk....kbk',
        '......................kbk',
        '......................kbk',
        '......................kbk',
        '.......................k',
      ],
    },
    fan: {
      own: true, // (your own hair shows in the fan's opening)
      pal: { X: '#30303c' },
      down: [
        'kGGGGGGGGGGGGGkkkkkkk',
        'kGGGGGGGGGGGGGGGGGkkkkk',
        'kGGGGGGGGGGGGGGGGGGGGkkkk',
        'kGGGGGGGGGGGGGGGGGGGGGGkkk',
        'kGGGGGGGGGGGkkkkkkkkGGGGGkk',
        'kGGGGGGGGGkkxxxxxxxxkkGGGgkk',
        'kxxxxxxxxxxxxx......xkkGGgkk',
        'kkkkkGGGkkx..........xkkGggkk',
        '.kkkkGGGkx............xkGggkk',
        '..kkGGGkx..............xkgggkk',
        '..kkGGGkx..............xkgggkk',
        '..kkGGGkx..............xkgggkk',
        '.kkGGGGkx..............xkggggkk',
        '.kkGGGGkx..............xkggggkk',
        '.kkGGGGkx..............xkggggkk',
        '..kkGGGkx..............xkgggkk',
        '..kkGGGkx..............xkgggkk',
        '..kkGGGGkx............xkGgggkk',
        '...kkGGGkkx..........xkkGggkk',
        '...kkGGGGkkx........xkkGGggkk',
        '....kkGGGGkkxxxxxxxxkkGGGgkk',
        '....kkGGGGGGkkkkkkkkGGGGGgkk',
        '.....kkggggggggggggggggggkk',
        '......kkkggggggggggggggkkk',
        '.......kkkkggggggggggkkkk',
        '.........kkkkkggggkkkkk',
        '...........kkkkkkkkkk',
        '..............kkkk',
      ],
      up: [
        '...........kkkkkkkGGGGGGGggggggk',
        '.........kkkkkGGGGGGGGGGGggggggk',
        '.......kkkkGGGGGGGGGGGGGGggggggk',
        '......kkkGGGGGGGGGGGGGGGGggggggk',
        '.....kkGGGGGkkkkkkkkGGGGGggggggk',
        '....kkGGGGkkxxxxxxxxkkGGGggggggk',
        '....kkGGGkkxXggggXxxxxxxxxxxxxxk',
        '...kkGGGkkxXXXXgggXXgxkkGggkkkkk',
        '...kkGGGkxXXXXXXggXXggxkGggkkkk',
        '..kkGGGkxgggggXXggXXgggxkgggkk',
        '..kkGGGkxggggggXggXXggXxkgggkk',
        '..kkGGGkxgXXXXgkkXXgggXxkgggkk',
        '.kkGGGGkxXXXXXkkkkgggXXxkggggkk',
        '.kkGGGGkxXXgggkkkkXXXXXxkggggkk',
        '.kkGGGGkxXgggXXkkgXXXXgxkggggkk',
        '..kkGGGkxXggXXggXggggggxkgggkk',
        '..kkGGGkxgggXXggXXgggggxkgggkk',
        '..kkGGGGkxggXXggXXXXXXxkGgggkk',
        '...kkGGGkkxgXXgggXXXXxkkGggkk',
        '...kkGGGGkkxXXXggggXxkkGGggkk',
        '....kkGGGGkkxxxxxxxxkkGGGgkk',
        '....kkGGGGGGkkkkkkkkGGGGGgkk',
        '.....kkggggggggggggggggggkk',
        '......kkkggggggggggggggkkk',
        '.......kkkkggggggggggkkkk',
        '.........kkkkkggggkkkkk',
        '...........kkkkkkkkkk',
        '..............kkkk',
      ],
      left: [
        '......kkkkkkkkkkkkkkkkkkkkkkk',
        '.....kkGGGGGGGGGGGGGGGGGGgggkk',
        '.....kkGGGGGGGGGGGGGGGGGGgggkk',
        '.....kkGGGGGGGGGGGxGGGGGGgggkk',
        '.....kkGGGGGGxGGGGxGGGGxGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kk..xxGGGGGGGxGGGGGGgggkk',
        '.....kkGGGGGGxGGGGxGGGGxGgggkk',
        '......kkggggggggggxggggggggkk',
        '......kkggggggggggxggggggggkk',
        '.......kkgggggggggggggggggkk',
        '........kkkgggggggggggggkkk',
        '.........kkkkkkkkkkkkkkkkk',
        '...........kkkkkkkkkkkkk',
      ],
    },
    sdg: {
      own: true, // (your own hair: it's a sandwich board)
      // the SDG logo (assets/sdg.png, as on the computers), pixelled at the board's size so
      // the lettering stays sharp: on the board, front and back, from column 9, row 17
      sign: [9, 17],
      logo: [
        'YkkkYkkYYkkkY',
        'YkYYYkYkYkYYY',
        'YkkkYkYkYkYkY',
        'YYYkYkYkYkYkY',
        'YkkkYkkYYkkkY',
        'YYYYYYYYYYYYY',
        'YkkkkkkkkYYYY',
        'YkggGGGGGkYYY',
        'YkkkGGkkkGkYY',
        'YYYYkGkgkGkYY',
        'YYYYkGkkkGkYY',
        'YYYYYkGGGkYYY',
        'YYYYYYkkkYYYY',
      ],
      down: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.........kkkkkkkkkkkkk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '.........kkkkkkkkkkkkk',
      ],
      up: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '.........kkkkkkkkkkkkk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '........kYYYYYYYYYYYYYk',
        '.........kkkkkkkkkkkkk',
      ],
      left: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '......kk................kk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '.....kYOk..............kOYk',
        '......kk................kk',
      ],
    },
  };
  // the ghost: a sheet, front, back and side, its hem rippling one way and the other
  const GHOST32 = {
    down: [[
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwkkwwwwwwkkwwwGkk',
      '.....kkwwwkkkkwwwwkkkkGGGkk',
      '....kkGwwwkkkkwwwwkkkkGGGGkk',
      '....kkwwwwkkkkwwwwkkkkGGGGkk',
      '....kkwwwwkkkkwwwwkkkkGGGGkk',
      '....kkWWWWwkkwwwwwwkkwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWkkkWwwkkkwwwkkkwGGkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkk',
      '.....k...kkk...kkk...kkk',
    ], [
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwkkwwwwwwkkwwwGkk',
      '.....kkwwwkkkkwwwwkkkkGGGkk',
      '....kkGwwwkkkkwwwwkkkkGGGGkk',
      '....kkwwwwkkkkwwwwkkkkGGGGkk',
      '....kkwwwwkkkkwwwwkkkkGGGGkk',
      '....kkWWWWwkkwwwwwwkkwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '....kkWWWWwwwwkkkkwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '....kkWWWkkkwwwkkkwwwkkkGGGkk',
      '.....kkkkkkkkkkkkkkkkkkkkkkk',
      '......kkk...kkk...kkk...kkk',
    ]],
    up: [[
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwGGGkk',
      '....kkGwwwwwwwwwwwwwwwGGGGkk',
      '....kkwwwwwwwwwwwwwwwwGGGGkk',
      '....kkwwwwwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWkkkWwwkkkwwwkkkwGGkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkk',
      '.....k...kkk...kkk...kkk',
    ], [
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwGGGkk',
      '....kkGwwwwwwwwwwwwwwwGGGGkk',
      '....kkwwwwwwwwwwwwwwwwGGGGkk',
      '....kkwwwwwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '....kkWWWkkkwwwkkkwwwkkkGGGkk',
      '.....kkkkkkkkkkkkkkkkkkkkkkk',
      '......kkk...kkk...kkk...kkk',
    ]],
    left: [[
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwkkwwwwwwwwwwwwGGGkk',
      '....kkGkkkkwwwwwwwwwwwGGGGkk',
      '....kkwkkkkwwwwwwwwwwwGGGGkk',
      '....kkwwkkwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWkkkWwwkkkwwwkkkwGGkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkk',
      '.....k...kkk...kkk...kkk',
    ], [
      '...............kk',
      '...........kkkkkkkkkk',
      '..........kkkkkwwkkkkk',
      '.........kkwwwwwwwwwGkk',
      '........kkwwwwwwwwwwwwkk',
      '.......kkwwwwwwwwwwwwwGkk',
      '......kkwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwwwwwwwwwwwwwwwwwGkk',
      '.....kkwkkwwwwwwwwwwwwGGGkk',
      '....kkGkkkkwwwwwwwwwwwGGGGkk',
      '....kkwkkkkwwwwwwwwwwwGGGGkk',
      '....kkwwkkwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkWWWWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '....kkkkkWwwwwwwwwwwwwGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '...kkWWWWWwwwwwwwwwwwwGGGGGkk',
      '....kkWWWkkkwwwkkkwwwkkkGGGkk',
      '.....kkkkkkkkkkkkkkkkkkkkkkk',
      '......kkk...kkk...kkk...kkk',
    ]],
  };
  // a costume's sheet at 32 x 32, over `parts` (a look, or a coworker's parts) in colours `c`
  function costumeSheet32(parts, key, c) {
    const k = COSTUME32[key], cos = COSTUMES[key];
    const col = Object.assign({}, c, cos.pal, k.pal);
    const pal = palette(Object.assign({ H: darker(col.h, 0.35), v: darker(col.w, 0.25) }, extras32(col), col));
    const body = Object.assign({ pants: 0 }, parts, { hat: 0 }, k.own ? {} : { hair: BALD });
    const make = (dir, step, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = lookBuf32(body, dir, step, true);
      k[dir].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '_') b[j * 32 + i] = null; else if (ch !== '.') b[j * 32 + i] = ch; }));
      if (k.logo && dir !== 'left') lay32Over(b, k.logo, k.sign[0], k.sign[1]);
      blit(img, b, 0, 0, pal, flip, 32);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    return {
      down: [make('down', 0), make('down', 1), make('down', 2)],
      up: [make('up', 0), make('up', 1), make('up', 2)],
      left: [make('left', 0), make('left', 1), make('left', 1)],
      right: [make('left', 0, true), make('left', 1, true), make('left', 1, true)],
    };
  }
  // renderLookCostume at 32 x 32: a player in a costume, over the look they made (the SDG
  // sign's logo is pixelled in, so unlike at 16 it doesn't need the logo image)
  function renderLookCostume32(look, key) {
    return COSTUME32[key] ? costumeSheet32(look, key, lookColours(look)) : renderLook32(look);
  }
  // renderCostume at 32 x 32: a coworker in a costume (or the ghost, a sheet of its own)
  function renderCostume32(gender, look, key) {
    if (gender === 'ghost') return renderGhost32();
    return COSTUME32[key] ? costumeSheet32(COWORKER32[gender] || COWORKER32.male, key, look) : renderSprites32(gender, look);
  }
  function renderGhost32() {
    const pal = palette(), make = (rows, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = new Array(1024).fill(null);
      lay32(b, rows, 0);
      blit(img, b, 0, 0, pal, flip, 32);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    const G = GHOST32;
    return {
      down: [make(G.down[0]), make(G.down[1]), make(G.down[1], true)],
      up: [make(G.up[0]), make(G.up[1]), make(G.up[1], true)],
      left: [make(G.left[0]), make(G.left[1]), make(G.left[1])],
      right: [make(G.left[0], true), make(G.left[1], true), make(G.left[1], true)],
    };
  }

  // Tiny overview map (1 pixel per tile) for the MAP screen.
  function renderMini(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), pal = palette();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = floor.tiles[y][x];
        const out = floor.outdoor ? ' .,~'.indexOf(t) : -1; // the parking lot's woods, snow, lot and ice
        const c = out >= 0 ? 'eWGi'[out] : t === ' ' ? 'w' : t === '#' ? 'k' : t === 'S' || t === 'E' ? 'r' : t === 'X' ? 'u' : '.,:_;-D$'.includes(t) ? 'G' : 'g';
        const rgb = pal[c], i = (y * W + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  return {
    LOOKS, UI, COSTUMES, scale2x, renderFloor, renderFloor32, renderTileAs32, renderSprites, renderCostume, renderDog, renderDog32, renderMini, renderTileAs,
    LOOK: { skins: SKINS, hairs: HAIRS, hairColours: HAIR_COLOURS, hats: HATS, shirts: SHIRTS, shirtColours: SHIRT_COLOURS, pants: PANTS, pantsColours: PANTS_COLOURS },
    LOOK_PARTS: LOOK_PARTS.map(([k, list]) => [k, list.length]), CROWN, SANTA, ANTLERS, lookFix, lookCode, lookFrom, lookLike, lookColours, lookStyle, renderLook, renderLook32, renderSprites32, renderLookCostume, renderLookCostume32, renderCostume32, renderGhost32,
    SWEATERS,
  };
})();
