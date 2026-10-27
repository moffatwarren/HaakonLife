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
  function stamp(b, art) {
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
  // The sprite sheet for someone in a costume: the same shape renderSprites returns.
  // `logo` is the SDG logo image, for the costume that wears it.
  function renderCostume(gender, look, key, logo) {
    const c = COSTUMES[key];
    if (!c) return renderSprites(gender, look);
    const pal = palette(Object.assign({}, look, c.pal)), out = {};
    const SP = gender === 'female' ? SPRITES_F : SPRITES;
    const make = (art, over, flip, sign) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), b = buf();
      stamp(b, art);
      over.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '_') b[j * 16 + i] = null; else if (ch !== '.') set(b, i, j, ch);
      }));
      blit(img, b, 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      if (sign && logo && logo.complete && logo.naturalWidth) ctx.drawImage(logo, sign[0], sign[1], sign[2], sign[3]);
      return cv;
    };
    out.down = [make(SP.down[0], c.down, false, c.sign), make(SP.down[1], c.down, false, c.sign), make(SP.down[1], c.down, true, c.sign)];
    out.up = [make(SP.up[0], c.up), make(SP.up[1], c.up), make(SP.up[1], c.up, true)];
    out.left = [make(SP.left[0], c.left), make(SP.left[1], c.left), make(SP.left[1], c.left)];
    out.right = [make(SP.left[0], c.left, true), make(SP.left[1], c.left, true), make(SP.left[1], c.left, true)];
    return out;
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

  function paintWall(b, get, x, y) {
    const up = get(x, y - 1), dn = get(x, y + 1), lf = get(x - 1, y), rt = get(x + 1, y);
    const face = !isWall(dn) && dn !== ' ';
    const capH = face ? 5 : 16;
    for (let yy = 0; yy < 16; yy++)
      for (let xx = 0; xx < 16; xx++) {
        let c;
        if (yy < capH) c = 'd';
        else if (yy === capH) c = 'k';
        else if (yy >= 13) c = yy === 15 ? 'D' : 'n';
        else c = (xx % 8 === 3 && yy >= capH + 2 && yy <= 11) ? 'C' : 'c';
        if ((xx === 0 && !isWall(lf)) || (xx === 15 && !isWall(rt))) c = 'k';
        if (yy === 0 && !isWall(up)) c = 'k';
        if (yy === 15 && !face && !isWall(dn)) c = 'k';
        b[yy * 16 + xx] = c;
      }
  }

  // Auto-connecting block (desks, tables, counters).
  function block(b, con, top, face, hi) {
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
    block(b, con, 'W', 'u', 'w');
    const top = con.u ? 0 : 3, bottom = con.d ? 16 : 10;
    if (con.r) rect(b, 15, top, 1, bottom - top, 'G');
    if (!con.d) {
      if (con.r) rect(b, 15, 11, 1, 3, 'k');
      rect(b, 3, 11, 10, 3, 'k');
      rect(b, 4, 11, 8, 2, 'U');
      set(b, 10, 12, 'w');
    }
  }

  // Finished air handling units in shipping, waiting for the truck. Each one is drawn
  // whole and then cut into tiles, so its doors, portholes and louvres can sit
  // anywhere on it. The digit on the map picks the design ('0' is the one in the paint booth).
  function paintShipUnit(b, get, x, y, t) {
    let x0 = x, y0 = y, x1 = x, y1 = y;
    while (get(x0 - 1, y) === t) x0--;
    while (get(x, y0 - 1) === t) y0--;
    while (get(x1 + 1, y) === t) x1++;
    while (get(x, y1 + 1) === t) y1++;
    const W = (x1 - x0 + 1) * 16, H = (y1 - y0 + 1) * 16, u = new Array(W * H).fill(null);
    const s = (px, py, c) => { if (px >= 0 && px < W && py >= 0 && py < H) u[py * W + px] = c; };
    const r = (px, py, w, h, c) => { for (let j = py; j < py + h; j++) for (let i = px; i < px + w; i++) s(i, j, c); };
    SHIP_UNITS[t](W, H, s, r);
    const ox = (x - x0) * 16, oy = (y - y0) * 16;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) set(b, i, j, u[(oy + j) * W + ox + i]);
  }

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
  function tile(get, floorCh, x, y) {
    const b = buf();
    const t = get(x, y);
    if (t === ' ') { rect(b, 0, 0, 16, 16, 'k'); return b; }
    if (t === '#') { paintWall(b, get, x, y); return b; }
    if (t === 'X') { paintExit(b); return b; }
    if (t === 'E') { paintElevator(b, get, x, y); return b; }
    paintFloor(b, floorCh, x, y);
    const con = (chars) => ({
      u: chars.includes(get(x, y - 1)), d: chars.includes(get(x, y + 1)),
      l: chars.includes(get(x - 1, y)), r: chars.includes(get(x + 1, y)),
    });
    switch (t) {
      case 'D': paintDoor(b, get, x, y); break;
      case 'S': paintStairs(b, get, x, y); break;
      case 'd': case 'm':
        block(b, con('dm%!'), 'N', 'n', 'y');
        stamp(b, t === 'm' ? ART.monitor : ((x * 7 + y * 5) % 3 === 0 ? ART.papers : []));
        break;
      case '%': block(b, con('dm%!'), 'N', 'n', 'y'); paintLegoDesk(b, x, y); break;
      case '!': block(b, con('dm%!'), 'N', 'n', 'y'); break; // the phone itself is drawn by the game, so it can ring
      case '+': paintWorkTable(b, con('+')); break;
      case '0': case '1': case '2': case '3': case '4': case '5': paintShipUnit(b, get, x, y, t); break;
      case '^': stamp(b, ART.forklift); break;
      case '&': paintLegoShelf(b, get, x, y); break;
      case 'T': block(b, con('T'), 'y', 'N', 'w'); break;
      case 'k': case 'M': block(b, con('kMnP'), 'W', 'g', 'w'); if (t === 'M') stamp(b, ART.appliance); break;
      case 'P':
        block(b, con('kMnP'), 'W', 'g', 'w');
        stamp(b, get(x, y + 1) === 'P' ? ART.coffeeTop : ART.coffeeBottom);
        break;
      case 'r': case 'R': block(b, con('rR'), 'y', 'u', 'w'); if (t === 'R') stamp(b, ART.monitor); break;
      case 'Z': block(b, con('Z'), 'y', 'N', 'w'); stamp(b, (y & 1) ? ART.candyB : ART.candy); break;
      case '=': partition(b, con('=#')); break;
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
        stamp(b, ART.treadmill.map((row) => row.substr((i % 3) * 16, 16)));
        break;
      }
      case 'h': paintShower(b); break;
      case 'o': stamp(b, ART.ball); break;
      case 'W': stamp(b, ART.washer); break;
      case 't': stamp(b, ART.trophies); break;
      case 'g': stamp(b, ART.snackShelf); break;
      case 'l': paintRailing(b, get, x, y); break;
      case 'C': paintCurtain(b, get, x, y, false); break;
      case '~': paintCurtain(b, get, x, y, true); break;
      case 'u': paintStretcher(b, get, x, y); break;
      case 'z': stamp(b, ART.serverRack); break;
      case 'y': stamp(b, ART.computerRack); break;
      case 'O': stamp(b, ART.dryer); break;
      case 'G': stamp(b, ART.punchingBag); break;
      case 'N': stamp(b, ART.locker); break;
      case 'I': stamp(b, ART.pulldown); break;
      case 'A': paintSquatRack(b, get, x, y); break;
      case 'i': paintGreen(b, get, x, y); break;
      case 'e': block(b, con('e'), 'g', 'K', 'G'); stamp(b, ART.dumbbells); break;
      case 'F': stamp(b, ART.fan); break;
      case 'a': stamp(b, ART.damper); break;
      case 's': stamp(b, ART.engraver); break;
      case 'L': stamp(b, ART.coil); break;
      case 'K': stamp(b, ART.panel); break;
      case 'V': case 'Q': paintTV(b, get, x, y, t); break;
      case '*': paintFame(b, get, x, y); break;
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
  function blit(img, b, ox, oy, pal, flip) {
    const d = img.data, W = img.width;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const c = b[y * 16 + (flip ? 15 - x : x)];
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
  function renderSprites(gender, look) {
    const pal = palette(gender === 'ghost' ? {} : look), out = {};
    const SP = gender === 'female' ? SPRITES_F : gender === 'ghost' ? SPRITES_GHOST : SPRITES;
    const make = (art, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), b = buf();
      stamp(b, art);
      blit(img, b, 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      return cv;
    };
    out.down = [make(SP.down[0]), make(SP.down[1]), make(SP.down[1], true)];
    out.up = [make(SP.up[0]), make(SP.up[1]), make(SP.up[1], true)];
    out.left = [make(SP.left[0]), make(SP.left[1]), make(SP.left[1])];
    out.right = [make(SP.left[0], true), make(SP.left[1], true), make(SP.left[1], true)];
    return out;
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

  // Tiny overview map (1 pixel per tile) for the MAP screen.
  function renderMini(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), pal = palette();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = floor.tiles[y][x];
        const c = t === ' ' ? 'w' : t === '#' ? 'k' : t === 'S' || t === 'E' ? 'r' : t === 'X' ? 'u' : '.,:_;D$'.includes(t) ? 'G' : 'g';
        const rgb = pal[c], i = (y * W + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  return { LOOKS, UI, COSTUMES, renderFloor, renderSprites, renderCostume, renderDog, renderMini, renderTileAs };
})();
