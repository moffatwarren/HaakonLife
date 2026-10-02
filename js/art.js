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
        block(b, con('dm'), 'N', 'n', 'y');
        stamp(b, t === 'm' ? ART.monitor : ((x * 7 + y * 5) % 3 === 0 ? ART.papers : []));
        break;
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
      case 'L': stamp(b, ART.coil); break;
      case 'K': stamp(b, ART.panel); break;
      case 'V': case 'Q': paintTV(b, get, x, y, t); break;
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
  // like a curtain being pulled open).
  function renderTileAs(floor, x, y, ch) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const get = (xx, yy) => (xx === x && yy === y) ? ch
      : (xx < 0 || yy < 0 || xx >= W || yy >= H) ? ' ' : floor.tiles[yy][xx];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16);
    blit(img, tile(get, floor.floor[y][x], x, y), 0, 0, palette(), false);
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

  // Tiny overview map (1 pixel per tile) for the MAP screen.
  function renderMini(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), pal = palette();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = floor.tiles[y][x];
        const c = t === ' ' ? 'w' : t === '#' ? 'k' : t === 'S' || t === 'E' ? 'r' : t === 'X' ? 'u' : '.,:_D'.includes(t) ? 'G' : 'g';
        const rgb = pal[c], i = (y * W + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  return { LOOKS, UI, renderFloor, renderSprites, renderMini, renderTileAs };
})();
