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

  // ---------- your own character (the character editor) ----------
  // A look is { g, skin, hair, hairC, hat, shirt, shirtC, pants, pantsC, extra, flair, champOff }: the body
  // ('male' or 'female') and a place in each list below. It's saved and sent as a short
  // code (lookCode), one base-36 digit per part in LOOK_PARTS order, so only ever add to
  // the end of a list: moving something would change everyone's saved look. A head thing,
  // shirt, pair of pants, extra or flair with `item` set is a special item, only for the names whose
  // number for that item is 1 (see "special items" in js/game.js).
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
  // Hair. `hd` is its name in the 32 x 32 tables below, as it is for the head things, shirts and pants.
  const HAIRS = [
    { name: 'Short', hd: 'short' },
    { name: 'Long', hd: 'long' },
    { name: 'Buzz cut', hd: 'buzz' },
    { name: 'Spiky', hd: 'spiky' },
    { name: 'Curly', hd: 'curly' },
    { name: 'Bob', hd: 'bob' },
    { name: 'Ponytail', hd: 'ponytail' },
    { name: 'Bun', hd: 'bun' },
    { name: 'Bald', hd: 'bald' },
  ];
  // Head things, laid over the hair.
  const HATS = [
    { name: 'Nothing', hd: 'none' },
    { name: 'Cap', hd: 'cap' },
    { name: 'Toque', hd: 'toque' },
    { name: 'Hard hat', hd: 'hardhat' },
    { name: 'Cowboy hat', hd: 'cowboy' },
    { name: 'Headphones', hd: 'headphones' },
    { name: 'Glasses', hd: 'glasses' },
    { name: 'Shades', hd: 'shades' },
    { name: 'Bow', hd: 'bow' },
    // for the Office Champion while they're on top (see champLook in js/game.js), and for good for
    // a name whose number for it is 1
    { name: 'Crown', hd: 'crown', item: 'crown' },
    // given to a name the first time it comes in over Christmas (see santaAward in js/game.js).
    // Its tail and bell swing as you walk, drawn there (santaTail) from `loose` in HAT32.
    { name: 'Santa hat', hd: 'santa', item: 'santa' },
    // only for the Christmas Cup's champion, the fastest at Humbug Sweeper over Christmas 2026
    // (see js/game.js): gold antlers hung with humbug baubles, too big for the picture (see BIG32)
    { name: 'Humbug antlers', hd: 'antlers', item: 'antlers' },
    // only for a name that's set Linda free (see "the quests' wearables" in js/game.js)
    { name: 'Ghost mask', hd: 'ghostmask', item: 'ghostmask' },
    // the same mask on whoever has set her free the most, with ghosts going round it. Like the
    // crown it's never picked or saved: it's only ever worn, in place of the Ghost mask.
    { name: 'Haunted mask', hd: 'ghostmask' },
    // a fan of Morale Madness cards, too big for the picture (see BIG32), for a name that's won half
    // of them (see CARD_PRIZES in js/game.js)
    { name: 'Card crown', hd: 'cardcrown', item: 'cardcrown' },
  ];
  // where the crown, the Santa hat, the humbug antlers and the masks are in HATS
  const CROWN = HATS.findIndex((h) => h.hd === 'crown'), SANTA = HATS.findIndex((h) => h.hd === 'santa'), ANTLERS = HATS.findIndex((h) => h.hd === 'antlers');
  const GHOST_MASK = HATS.findIndex((h) => h.item === 'ghostmask'), HAUNTED_MASK = HATS.findIndex((h) => h.name === 'Haunted mask');
  const SHIRTS = [
    { name: 'Shirt & tie', hd: 'tie' },
    { name: 'Blouse', hd: 'blouse' },
    { name: 'T-shirt', hd: 'tee' },
    { name: 'Stripes', hd: 'stripes' },
    { name: 'Hoodie', hd: 'hoodie' },
    { name: 'Suit', hd: 'suit' },
    { name: 'Sweater', hd: 'sweater' },
    { name: 'Hi-vis vest', hd: 'hivis' },
    // only for a name that's opened its present under the tree on Christmas Day (see openPresent in
    // js/game.js): a sweater knotted up in Christmas lights, in your shirt colour, with the plug
    // dragging behind you (lightsCord there) and the bulbs going off and on (lightsTwinkle). `over`
    // means nothing goes on top of it: not an ugly sweater, or the bib of a pair of overalls.
    { name: 'Tangled lights', hd: 'lights', item: 'lights', over: true },
  ];
  const LIGHTS = SHIRTS.findIndex((s) => s.item === 'lights');
  const PANTS = [
    { name: 'Trousers', hd: 'trousers' },
    { name: 'Shorts', hd: 'shorts' },
    { name: 'Skirt', hd: 'skirt' },
    { name: 'Overalls', hd: 'overalls' },
  ];
  // Things worn over the top of your clothes, whatever the shirt, sweater or overalls.
  const EXTRAS = [
    { name: 'Nothing', hd: 'none' },
    // only for a name that's been Employee of the Month (see "the quests' wearables" in js/game.js)
    { name: 'Ribbon', hd: 'ribbon', item: 'ribbon' },
    // the same ribbon in gold on whoever has been it the most, sparkling. Like the crown it's
    // never picked or saved: it's only ever worn, in place of the Ribbon.
    { name: 'Gold ribbon', hd: 'goldribbon' },
    // only for a name that's got it off the elf in the parking lot (see elfTalk in js/game.js)
    { name: 'Candy cane', hd: 'candycane', item: 'candycane' },
  ];
  const RIBBON = EXTRAS.findIndex((e) => e.hd === 'ribbon'), GOLD_RIBBON = EXTRAS.findIndex((e) => e.hd === 'goldribbon'), CANDY_CANE = EXTRAS.findIndex((e) => e.hd === 'candycane');
  // Flair: not something you wear, so it isn't in your picture at all, but something that
  // goes with you, drawn by js/game.js. `item` works here too, for one that's earned.
  const FLAIRS = [
    { name: 'Nothing' },
    // the trail of gold stars behind you as you walk (glowTick in js/game.js). The Office
    // Champion's while they're on top, like the crown (see champLook there), and for good for a
    // name whose number for it is 1.
    { name: 'Star trail', item: 'startrail' },
    // a beaten humbug who follows you about with a broom (followTick in js/game.js): the
    // Christmas Cup's champion's, along with the antlers
    { name: 'Sweeper', item: 'sweeper' },
    // Morale Madness cards going round you (deckOrbit in js/game.js), for a name that's won three
    // quarters of them (see CARD_PRIZES there)
    { name: 'Card storm', item: 'cardstorm' },
  ];
  const STAR_TRAIL = FLAIRS.findIndex((f) => f.name === 'Star trail'), SWEEPER = FLAIRS.findIndex((f) => f.item === 'sweeper'), CARD_STORM = FLAIRS.findIndex((f) => f.item === 'cardstorm');
  // Not a part you pick from a list: which of the Office Champion's things they've chosen not
  // to wear, 1 for the crown plus 2 for the star trail (see champLook in js/game.js).
  const CHAMP_OFF = [0, 1, 2, 3];
  const LOOK_PARTS = [['skin', SKINS], ['hair', HAIRS], ['hairC', HAIR_COLOURS], ['hat', HATS],
    ['shirt', SHIRTS], ['shirtC', SHIRT_COLOURS], ['pants', PANTS], ['pantsC', PANTS_COLOURS], ['extra', EXTRAS], ['flair', FLAIRS], ['champOff', CHAMP_OFF]];
  // the special items and where they are, like { santa: { part: 'hat', i: 10 } }
  const LOOK_ITEMS = {};
  for (const [part, list] of LOOK_PARTS) list.forEach((e, i) => { if (e.item) LOOK_ITEMS[e.item] = { part, i }; });
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
  // a look's colours, the way the rest of the game names them
  function lookColours(look) {
    const sc = SHIRT_COLOURS[look.shirtC];
    return { h: HAIR_COLOURS[look.hairC][1], s: SKINS[look.skin], w: sc[1], u: sc[2], K: PANTS_COLOURS[look.pantsC][1] };
  }

  // the extra colours a 32 x 32 picture uses, from a look's colours (h, s, w, K)
  // (the bulbs on the tangled lights: each one's letter in a picture, lit, its glint, and switched off)
  const BULBS = { 6: { on: '#e83040', glint: '#ffa8a8', off: '#742434' }, 7: { on: '#f8d030', glint: '#fff4b0', off: '#7c6c2c' }, 8: { on: '#4088f0', glint: '#b0d8ff', off: '#28487c' } };
  const BULB_GLINTS = { x: 6, V: 7, B: 8 };
  const extras32 = (c) => ({ 6: BULBS[6].on, 7: BULBS[7].on, 8: BULBS[8].on, x: BULBS[6].glint, V: BULBS[7].glint, B: BULBS[8].glint, H: darker(c.h, 0.35), v: darker(c.w, 0.25), S: darker(c.s, 0.2), f: blend(c.s, '#e04848', 0.4), j: blend(c.h, '#ffffff', 0.3), O: '#f8e070', Y: '#a87018', L: darker(c.K, 0.3), b: '#383040', I: '#fcfcff', J: '#2f62d8', z: '#1c3a94', X: '#8a1c20' });
  function lookPalette(look, over) {
    const c = lookColours(look);
    // (and for 32 x 32: S, skin in shadow, f, the cheeks, j, a shine on the hair, and O and
    // Y, light and dark gold, for the crown and the humbug antlers, L, the pants in shadow,
    // b, shoes, I, a pure white for the ghost mask, J and z, the ribbon's blue and its shadow,
    // X, the candy cane's red in shadow, and 6 to 8 and their glints x, V and B, the tangled lights' bulbs)
    return palette(Object.assign({ H: darker(c.h, 0.35), v: darker(c.w, 0.25) }, extras32(c), c, over));
  }
  // ---------- 32 x 32 characters ----------
  // A look is drawn a part at a time. Each part has a `hi` of its own (down, up, left; rows
  // 32 wide, laid from row 0), drawn with 2-pixel outlines and the light from the top left,
  // and the face is HEAD32 underneath the hair. Letters as above, plus S (skin in shadow),
  // f (the cheeks) and j (a shine on the hair): see lookPalette.
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
  for (const h of HAIRS) h.hi = HAIR32[h.hd];
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
        '.........................kOOok',
        '........................kOOooYk',
        '........................kOoooYk',
        '........................kkkkkkk',
        '.........................kYoYk',
        '..........................kkk',
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
        '..kOOok',
        '.kOOooYk',
        '.kOoooYk',
        '.kkkkkkk',
        '..kYoYk',
        '...kkk',
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
        '.........................kOOok',
        '........................kOOooYk',
        '........................kOoooYk',
        '........................kkkkkkk',
        '.........................kYoYk',
        '..........................kkk',
      ],
      // The same hat with its tail cut off at the fold, for wherever it's drawn on its own so it
      // can swing (santaTail in js/game.js). The whole picture above is for the mini-games.
      loose: {
        down: [
          '____________kkkrrrrrrrrrrMkk____',
          '__________kkkkrrrrrrrrrrrrMkk___',
          '_________kkkrrrrrrrrrrrrrrrMkk__',
          '________kkrrrkMrrrrrMMMMrrrMkk__',
          '_______kkrrrrrkMMMMMkkkkMrrMkk__',
          '______kkrrrrrrrkkkkkrrrMkrrrMkk_',
          '_____kkWWWGWWWGWWWGWWWGWWMrrMkk_',
          '....kkWWWGWWWGWWWGWWWGWWWkrrMkk',
          '....kkWWGWWWGWWWGWWWGWWWGkkkkkk',
          '.....kkkGGGGGGGGGGGGGGGGkkk',
          '......kk................kk',
        ],
        up: [
          '____kkMrrrrrrrrrrkkk____________',
          '___kkMrrrrrrrrrrrrkkkk__________',
          '__kkMrrrrrrrrrrrrrrrkkk_________',
          '__kkMrrrMMMMrrrrrMkrrMkk________',
          '__kkMrrMkkkkMMMMMkrrrrMkk_______',
          '_kkMrrrkrrrrkkkkkrrrrrrMkk______',
          '_kkMrrMWWWGWWWGWWWGWWWGWWkk_____',
          '.kkMrrkWWGWWWGWWWGWWWGWWWGkk',
          '.kkkkkkWGWWWGWWWGWWWGWWWGWkk',
          '.....kkkGGGGGGGGGGGGGGGGkkk',
          '......kk................kk',
        ],
        left: [
          '____________kkkrrrrrrrrrrMkk____',
          '__________kkkkrrrrrrrrrrrrMkk___',
          '_________kkkrrrrrrrrrrrrrrrMkk__',
          '________kkrrrkMrrrrrMMMMrrrMkk__',
          '_______kkrrrrrkMMMMMkkkkMrrMkk__',
          '______kkrrrrrrrkkkkkrrrMkrrrMkk_',
          '_____kkWWWGWWWGWWWGWWWGWWMrrMkk_',
          '....kkWWWGWWWGWWWGWWWGWWWkrrMkk',
          '....kkWWGWWWGWWWGWWWGWWWGkkkkkk',
          '.....kkkGGGGGGGGGGGGGGGGkkk',
          '......kk................kk',
          '..................kk',
        ],
      },
    },
    // Linda's face, more or less: white, with big hollow eyes and an "ooo", and a strap round the back
    ghostmask: {
      down: [
        '',
        '',
        '',
        '',
        '',
        '...........kkkkkkkkkk',
        '.........kkkIIIIIIIWkkk',
        '........kkIIIIIIIIIIIWkk',
        '.......kkIIIIIIIIIIIIIWkk',
        '.......kIIIkkIIIIIIkkIIWk',
        '.......kIIkkkkIIIIkkkkIWk',
        '.......kIIkkkkIIIIkkkkIWk',
        '.......kIIkkkkIIIIkkkkIWk',
        '.......kIIIkkIIIIIIkkIIWk',
        '.......kIIIIIIIIIIIIIIIWk',
        '.......kkIIIIIIkkIIIIWGkk',
        '........kkIIIIkkkkIIWGkk',
        '.........kkIIIIkkIIWGkk',
        '..........kkkWWWWWWkkk',
        '............kkkkkkkk',
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
        '........kkkkkkkkkkkkkkkk',
        '.......kWWWWWWkkkkWWWWWWk',
        '........kkkkkkkkkkkkkkkk',
      ],
      left: [
        '',
        '',
        '',
        '',
        '',
        '........kkkkkkkk',
        '.......kkIIIIIWkk',
        '......kkIIIIIIIWk',
        '......kIIIIIIIIWk',
        '......kIIkIIIIIWk',
        '......kIkkkIIIIWkkkkkkkkk',
        '......kIkkkIIIIWWWWWWWWWW',
        '.....kkIkkkIIIIWkkkkkkkkk',
        '.....kIIIkIIIIIWk',
        '.....kIIIIIIIIIWk',
        '.....kIIkIIIIIWGk',
        '.....kkkkkIIIIWGk',
        '......kkkIIIIWGkk',
        '.......kkkWWWWkk',
        '.........kkkkkk',
      ],
    },
  };
  // Head things too big for a 32 x 32 picture, by their hd name: each is a picture of its own,
  // drawn behind its wearer (wornBehind in js/game.js), so their head and hair cover the bottom of
  // it. x and y are where its top left goes, in pixels from the top left of their picture, so a
  // negative y is above the tile. There's a down and a left (right is left flipped), and an up only
  // if the back looks different. Only use the colours in BIG_COLS, which leaves out h, s, w, u and K
  // because those go by the wearer's look. How to add one: "Head things bigger than a tile" in the README.
  const { h: _h, s: _s, w: _w, u: _u, K: _K, ...FIXED_COLORS } = COLORS;
  const BIG_COLS = Object.assign(FIXED_COLORS, { O: '#f8e070', Y: '#a87018', I: '#fcfcff', J: '#2f62d8', z: '#1c3a94' });
  const BIG32 = {
    // the card crown: 3 cards standing up behind a gold band, blue, gold and green. From behind you see
    // their backs. `over` goes over the hair: the band.
    cardcrown: {
      x: -8, y: -9,
      down: [
        '...................kkkkkkkkkk...................',
        '.................kkkkkkkkkkkkkk.................',
        '..............kkkkkkkkkkkkkkkkkkkk..............',
        '............kkkkkkkkkkkkkkkkkkkkkkkk............',
        '...........kkkkkkkIIkoOOOOOkEIkkkkkkk...........',
        '...........kkkkUIIIIkoOOOOOkEIIIIkkkk...........',
        '...........kkkkUIIIJkOoooYOkEIIIIkkkk...........',
        '...........kkkkUUUUJkOoooYOkEEeeIkkkk...........',
        '............kkkIUUUJkOoooYOkEEeeIkkk............',
        '............kkkkIUUUkOoooYOkEEeIkkkk............',
        '............kkkkIUUUkOoooYOkEeeIkkkk............',
        '.............kkkIIUUkOYYYYOkEeIIkkk.............',
        '.............kkkkIUJkOYYYYOkeeIkkkk.............',
        '..............kkkIJJkOOOOOOkeeIkkk..............',
        '..............kkkIIIkOOOOOOkIIIkkk..............',
        '..............kkkkIIkOOOOOOkIIkkkk..............',
        '...............kkkIIkOOOOOOkIIkkk...............',
        '...............kkkkIkOOOOOOkIkkkk...............',
      ],
      left: [
        '....................kkkkkkkk....................',
        '...................kkkkkkkkkk...................',
        '.................kkkkkkkkkkkkkk.................',
        '................kkkkkkkkkkkkkkkk................',
        '...............kkkkkIkoOOOkIkkkkk...............',
        '...............kkkkIIkoOOOkIIkkkk...............',
        '...............kkkUIIkOoYOkIIIkkk...............',
        '...............kkkUUUkOoYOkEeIkkk...............',
        '................kkkUUkOoYOkEekkk................',
        '................kkkIUkOoYOkEIkkk................',
        '................kkkIUkOoYOkeIkkk................',
        '................kkkIUkOYYOkeIkkk................',
        '.................kkIUkOYYOkeIkk.................',
        '.................kkkJkOOOOkekkk.................',
        '.................kkkIkOOOOkIkkk.................',
        '.................kkkIkOOOOkIkkk.................',
        '.................kkkIkOOOOkIkkk.................',
        '..................kkkkOOOOkkkk..................',
      ],
      up: [
        '...................kkkkkkkkkk...................',
        '.................kkkkkkkkkkkkkk.................',
        '..............kkkkkkkkkkkkkkkkkkkk..............',
        '............kkkkkkkkkkkkkkkkkkkkkkkk............',
        '...........kkkkkkkOOkOOOOOOkOOkkkkkkk...........',
        '...........kkkkOOOzzkOzzzzOkzzOOOkkkk...........',
        '...........kkkkOzzzzkOzzzzOkzzzzOkkkk...........',
        '...........kkkkOzzzzkOzoozOkzzzzOkkkk...........',
        '............kkkOzoookOzoozOkooozOkkk............',
        '............kkkkOzookOzoozOkoozOkkkk............',
        '............kkkkOzookOzoozOkoozOkkkk............',
        '.............kkkOzzokOzoozOkozzOkkk.............',
        '.............kkkkOzokOzzzzOkozOkkkk.............',
        '..............kkkOzzkOzzzzOkzzOkkk..............',
        '..............kkkOzzkOzzzzOkzzOkkk..............',
        '..............kkkkOzkOzzzzOkzOkkkk..............',
        '...............kkkOzkOzzzzOkzOkkk...............',
        '...............kkkkOkOzzzzOkOkkkk...............',
      ],
      over: {
        down: [
          '',
          '',
          '',
          '',
          '',
          '......kkOOOOOOOOOOOOOOOOkk',
          '......kkooUoooorrooooUookk',
          '......kkooUoooorrooooUookk',
          '......kkYYYYYYYYYYYYYYYYkk',
          '.......k................k',
        ],
        left: [
          '',
          '',
          '',
          '',
          '',
          '......kkOOOOOOOOOOOOOOOOkk',
          '......kkoorrooooooooooookk',
          '......kkoorrooooooooooookk',
          '......kkYYYYYYYYYYYYYYYYkk',
          '.......k................k',
        ],
        up: [
          '',
          '',
          '',
          '',
          '',
          '......kkOOOOOOOOOOOOOOOOkk',
          '......kkoooooooooooooooook',
          '......kkoooooooooooooooook',
          '......kkYYYYYYYYYYYYYYYYkk',
          '.......k................k',
        ],
      },
    },
    // the humbug antlers: seen side on, the far one is a shade darker
    antlers: {
      x: -6, y: -16,
      down: [
        '...kkkk..............................kkkk...',
        '..kkkkkk............................kkkkkk..',
        '..kkOOkkkkkk....................kkkkkkOOkk..',
        '..kkOYkkkkkkk..................kkkkkkkOYkk..',
        '..kkooOkkOOkk..................kkOOkkOoYkk..',
        '..kkkOYkOoYkk..................kkOoOkOYkkk..',
        '...kkooOooYkk..................kkoooOoYkk...',
        '...kkkoooYkkk..................kkkOooYkkk...',
        '.kkkkkkOoYkk....................kkOoYkkkkkk.',
        'kkkkkkkOoYkk....................kkOoYkkkkkkk',
        'kkOOkkkOoYkkk..................kkkOoYkkkOOkk',
        'kkooOOOoooOkk..................kkOoooOOOoYkk',
        'kkkoYYooooYkk..................kkOooooYYYkkk',
        '.kkkkkooooYkkk................kkkOoooYkkkkk.',
        '.kkkkkkoYooOkkk..............kkkOooYYkkkkkk.',
        'kkkkkkkkkOooOkk..............kkOooYkkkkkkkkk',
        'kkOOOOkkkoooYkkk............kkkOooYkkkOOOOkk',
        'kkooooOOOkOooOkkk..........kkkOooYkOOOoooYkk',
        'kkkoYYYooOooooOkkk........kkkOooooOooYYYYkkk',
        '.kkkkkkoYooooooOkkk......kkkOooooooYYkkkkkk.',
        '..kkkkkkkoYYYoooOkkk....kkkOoooYYYYkkkkkkk..',
        '......kkkkkkkooooOkk....kkOoooYkkkkkkk......',
        '........kkkkkkOooYkk....kkOooYkkkkkk........',
        '............kkoooYkk....kkOooYkk............',
        '............kkkoYYkk....kkoYYkkk............',
        '.............kkkkkkk....kkkkkkk.............',
        '..............kkkkk......kkkkk..............',
      ],
      left: [
        '......kkkk.........................kkkk.....',
        '.....kkkkkkkkk.................kkkkkkkkk....',
        '.....kkookkkkkk...............kkkkkkOOkk....',
        '.....kkonkkkokk...............kkOkkkOYkk....',
        '.....kkYYokonkk...............kkOOkOoYkk....',
        '.....kkkonkonkk...............kkOYkOYkkk....',
        '......kkYYoYnkk...............kkOoOoYkk.....',
        '......kkkYYYnkk...............kkOooYkkk.....',
        '.....kkkkkoYnkk...............kkOoYkkkkk....',
        '....kkkkkkoYnkk...............kkOoYkkkkkk...',
        '...kkkookkoYnkk...............kkOoYkkOOkkk..',
        '...kkoYYooYYnkk...............kkOooOOooOkk..',
        '...kkkYnnYYYnkkk.............kkkOoooYYYkkk..',
        '....kkkkkYYYYokk.............kkOoooYkkkkk...',
        '.....kkkkkYYYnkkk...........kkkOooYkkkkk....',
        '....kkkkkkkoYYokk...........kkOooYkkkkkkk...',
        '...kkkoookkoYYnkkk.........kkkOooYkkOOOkkk..',
        '...kkoYYYooYYYYokkk.......kkkOooooOOoooOkk..',
        '...kkkYnnYYYYYYYokk.......kkOoooooooYYYkkk..',
        '....kkkkkYnYYYYYnkkk.....kkkOoooooYYkkkkk...',
        '.....kkkkkkYnnYYYokkk...kkkOoooYYYkkkkkk....',
        '........kkkkkkYYYYokkk.kkkOoooYkkkkkk.......',
        '..........kkkkkoYYYokk.kkOoooYkkkkk.........',
        '.............kkYYYYnkk.kkooooYkk............',
        '.............kkkYnnkkk.kkkoYYkkk............',
        '..............kkkkkkk...kkkkkkk.............',
        '...............kkkkk.....kkkkk..............',
      ],
    },
  };
  // the part of a big head thing that's inside the 32 x 32 picture, which lines up with the rest of
  // it and is all there is of it in a mini-game
  function insidePicture(big) {
    const cut = (rows) => [...new Array(Math.max(0, big.y)).fill(''), ...rows.slice(Math.max(0, -big.y))]
      .map((r) => (big.x < 0 ? r.slice(-big.x) : '.'.repeat(big.x) + r).slice(0, 32).replace(/\.+$/, ''));
    return { down: cut(big.down), up: cut(big.up || big.down), left: cut(big.left) };
  }
  for (const h of HATS) {
    h.big = BIG32[h.hd];
    h.hi = h.big ? insidePicture(h.big) : HAT32[h.hd];
  }
  // The end of the Santa hat's tail, drawn with the tail in js/game.js (santaTail): a pom-pom, and
  // under it the bell. The bell's slit is in the middle, or off to one side as it swings.
  const SANTA_END32 = {
    pom: [
      '..kkkkkk..',
      '.kkIIWWkk.',
      'kkIIWWWGkk',
      'kkIWWWGWkk',
      'kkWWGWWGkk',
      'kkWWWGGGkk',
      '.kkGGGGkk.',
      '..kkkkkk..',
    ],
    bell: [
      '...kkk...',
      '..kOOok..',
      '.kOOoooY.',
      'kOOoooYYk',
      'kOooooYYk',
      'kYkkkkkYk',
      '.kYoYoYk.',
      '..kkkkk..',
    ],
    bellSwung: [
      '...kkk...',
      '..kOOok..',
      '.kOOoooY.',
      'kOOoooYYk',
      'kOooooYYk',
      'kkkkkkoYk',
      '.kYoYoYk.',
      '..kkkkk..',
    ],
  };
  // The humbugs hanging off the humbug antlers, as baubles with a gold cap: eyes open, and shut
  // for a moment now and then. b, G, L and D are its greens, as in SWEEPER_BODY.
  const BAUBLE32 = {
    open: [
      '.....kkk.....',
      '.k..koOok..k.',
      'kbk.kkkkk.kbk',
      'kbGkGGGGGkGDk',
      '.kGLLGGGGGDk.',
      'kGGkkGGGkkGDk',
      'kGYYkGGGkYYDk',
      'kGYkkGGGkkYDk',
      'kGGGGGGGGGDDk',
      'kGGGkkkkkGDDk',
      '.kGkGGGGGkDk.',
      '..kGDDDDDDk..',
      '...kkkkkkk...',
    ],
    shut: [
      '.....kkk.....',
      '.k..koOok..k.',
      'kbk.kkkkk.kbk',
      'kbGkGGGGGkGDk',
      '.kGLLGGGGGDk.',
      'kGGkkGGGkkGDk',
      'kGGGGGGGGGGDk',
      'kGkkkGGGkkkDk',
      'kGGGGGGGGGDDk',
      'kGGGkkkkkGDDk',
      '.kGkGGGGGkDk.',
      '..kGDDDDDDk..',
      '...kkkkkkk...',
    ],
  };
  // The humbug who follows the champion about, without the outline, which is added below: one set
  // of rows for each way it can face. The feet go on in turn as it walks.
  const SWEEPER_BODY = {
    down: ['L............G', 'LL..........GG', 'LLGGGLLGGGGGGD', '.GGLLGGGGGGGD.', '.GkkGGGGGGkkD.', '.GYYkGGGGkYYD.', '.GYkkGGGGkkYD.', '.GGGGGGGGGGGD.', '.GGGkkkkkkGGD.', '.GGkGGGGGGkGD.', '..GGGGGGGGDD..', '..DDGGGGGDDD..'],
    up: ['L............G', 'LL..........GG', 'LLGGGLLGGGGGGD', '.GGLLGGGGGGGD.', '.GGGGGGGGGGGD.', '.GGGGGGGGGGGD.', '.GGGGGGGGGGGD.', '.GGGGGGGGGGGD.', '.GGGGGGGGGGGD.', '.GGGGGGGGGGGD.', '..GGGGGGGGDD..', '..DDGGGGGDDD..'],
    left: ['L..........G..', 'LL........GG..', 'LLGGLLGGGGGD..', 'GGLLGGGGGGGD..', 'kkGGGkkGGGGD..', 'YYkGkYYGGGGD..', 'YkkGkkYGGGGD..', 'GGGGGGGGGGGD..', 'GkkkkkGGGGGD..', 'kGGGGGkGGGGD..', '.GGGGGGGGDD...', '.DDGGGGDDD....'],
  };
  const SWEEPER_FEET = ['..FF.....FF...', '..FF..........', '.........FF...'];
  // rows with the 2-pixel outline round them, which makes them 2 wider and taller on every side
  function outlined32(rows) {
    const w = Math.max(...rows.map((r) => r.length)) + 4, out = Array.from({ length: rows.length + 4 }, () => new Array(w).fill('.'));
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) + Math.abs(j) <= 3 && out[y + 2 + j][x + 2 + i] === '.') out[y + 2 + j][x + 2 + i] = 'k';
    }));
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') out[y + 2][x + 2] = ch; }));
    return out.map((r) => r.join(''));
  }
  // each way it can face: [standing, one foot up, the other foot up]
  const SWEEPER32 = {};
  for (const dir in SWEEPER_BODY) SWEEPER32[dir] = SWEEPER_FEET.map((f) => outlined32([...SWEEPER_BODY[dir], f, f]));
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
  // The tangled lights: three bulbs (6 to 8, see BULBS) hanging off the wire (e), each with a metal
  // socket (g), a glint, a pointed end and a dark outline, so they stand out on any colour of shirt.
  // Going by colour, js/game.js finds them in the finished picture to make them twinkle (see
  // lightsShowing), so they stay in the same places in left and leftWalk, and clear of the candy cane,
  // which moves as you walk.
  SHIRT32.lights = {
    from: 18,
    down: [
      '...........kkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
      '.......kkkkwgeeegeeegkkkk',
      '......kkwwkx66kV77kB88kvkk',
      '......kkewk666k777k888kekk',
      '......kkwek666k777k888kvkk',
      '......kksskk6kwk7kwk8kSSkk',
      '......kksskukuuukuuukkSSkk',
    ],
    up: [
      '...........kkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
      '.......kkkkgeeegeeegwkkkk',
      '......kkwkB88kV77kx66kvvkk',
      '......kkek888k777k666kvekk',
      '......kkwk888k777k666kevkk',
      '......kkssk8kwk7kwk6kkSSkk',
      '......kksskkuuukuuukukSSkk',
    ],
    left: [
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkgeeegeeegvkk',
      '........kkx66kV77kB88kkk',
      '........kk666k777k888kkk',
      '........kk666k777k888kkk',
      '........kkk6kwk7kkk8kvkk',
      '........kkukuuSkSkukuukk',
    ],
    leftWalk: [
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkgeeegeeegvkk',
      '........kkx66kV77kB88kkk',
      '.......kkk666k777k888kkk',
      '......kkkk666k777k888kkkk',
      '.....kksssk6kwk7kwk8kwSSkk',
      '.....kkSSSkkkkukuuukuuSSkk',
    ],
  };
  for (const s of SHIRTS) s.hi = SHIRT32[s.hd];
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
  for (const p of PANTS) p.hi = PANTS32[p.hd];
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
  // The extras, by their hd name: rows 32 wide, looking down and left, and up if there's anything
  // to see of them from behind (right is left, flipped). They start at row 20 of the picture, the
  // chest, unless `from` says which row, for something that goes higher, like something you hold.
  // They're laid over everything, hair and all, so keep them clear of the face.
  const EXTRA32 = {
    // a blue rosette with two tails, pinned over the heart
    ribbon: {
      down: [
        '...............kkkkk',
        '..............kUUJJzk',
        '..............kUIIJzk',
        '..............kJIIJzk',
        '..............kJJzzzk',
        '...............kJkzk',
        '...............kJkzk',
        '...............kk.kk',
      ],
      left: [
        '..........kkkk',
        '.........kUUJzk',
        '.........kUIIzk',
        '.........kJIIzk',
        '.........kJJzzk',
        '..........kJzk',
        '..........kJzk',
        '..........kkkk',
      ],
    },
    // a candy cane the size of a walking stick, held in one hand: the other hand from behind
    candycane: {
      from: 9,
      down: [
        '.........................kkkk',
        '........................kkkkkk',
        '.......................kkkIrkkk',
        '......................kkkIrrIkkk',
        '......................kkIXkkIXkk',
        '......................kkrXkkrXkk',
        '......................kkrGkkrGkk',
        '......................kkIGkkkkkk',
        '......................kkIXkkkkk',
        '......................kkrXkk',
        '......................kkrGkk',
        '......................kkIGkk',
        '......................kkIXkk',
        '......................kkrXkk',
        '......................kkrGkk',
        '......................kkIGkk',
        '......................kkIXkk',
        '......................kkrXkk',
        '......................kkrGkk',
        '......................kkIGkk',
        '......................kkIXkk',
        '......................kkkkkk',
        '.......................kkkk',
      ],
      up: [
        '...kkkk',
        '..kkkkkk',
        '.kkkrIkkk',
        'kkkrIIrkkk',
        'kkrGkkrGkk',
        'kkIGkkIGkk',
        'kkIXkkIXkk',
        'kkkkkkrXkk',
        '.kkkkkrGkk',
        '....kkIGkk',
        '....kkIXkk',
        '....kkrXkk',
        '....kkrGkk',
        '....kkIGkk',
        '....kkIXkk',
        '....kkrXkk',
        '....kkrGkk',
        '....kkIGkk',
        '....kkIXkk',
        '....kkrXkk',
        '....kkrGkk',
        '....kkkkkk',
        '.....kkkk',
      ],
      left: [
        '',
        '',
        '',
        '...kkkk',
        '..kkkkkk',
        '.kkkrrkkk',
        'kkkrrIIkkk',
        'kkrXkkrXkk',
        'kkrGkkrGkk',
        'kkIGkkIGkk',
        'kkkkkkIXkk',
        '.kkkkkrXkk',
        '....kkrGkk',
        '....kkIGkk',
        '....kkIXkk',
        '....kkrXkk',
        '....kkrGkk',
        '....kkIGkk',
        '....kkIXkk',
        '....kkrXkk',
        '....kkrGkk',
        '....kkkkkk',
        '.....kkkk',
      ],
    },
  };
  // the top Employee of the Month's: the same one in gold
  EXTRA32.goldribbon = {};
  for (const view in EXTRA32.ribbon) EXTRA32.goldribbon[view] = EXTRA32.ribbon[view].map((r) => r.replace(/[UJzI]/g, (c) => ({ U: 'I', J: 'O', z: 'Y', I: 'o' }[c])));
  // The candy cane swings as you walk, the way a walking stick does: planted out ahead on one stride,
  // lifted off the ground on the other, and straight up in between. Each stride is a copy of the rows,
  // leaned about your hand: `top` and `foot` are how far its two ends move, and `lift` how far it comes
  // up, so it's all drawn CANE_LIFT rows higher, with that many empty rows to spare when it's down. The
  // hook moves as one piece, and only a little, to stay off your face.
  const CANE_LIFT = 2;
  const CANE_STRIDES = {
    down: { hook: 8, hand: 13, strides: [{ top: -1, foot: 2, lift: 0 }, { top: 0, foot: -1, lift: CANE_LIFT }] },
    up: { hook: 8, hand: 13, strides: [{ top: 1, foot: -2, lift: 0 }, { top: 0, foot: 1, lift: CANE_LIFT }] },
    left: { hook: 11, hand: 14, strides: [{ top: 0, foot: -3, lift: 0 }, { top: 0, foot: 1, lift: CANE_LIFT }] },
  };
  (function caneStrides() {
    const cane = EXTRA32.candycane;
    cane.from -= CANE_LIFT;
    cane.stride = {};
    for (const view in CANE_STRIDES) {
      const rows = cane[view], { hook, hand, strides } = CANE_STRIDES[view];
      const leaned = ({ top, foot, lift }) => new Array(CANE_LIFT - lift).fill('').concat(rows.map((row, j) => {
        const dx = Math.round(j <= hook ? top : j < hand ? top * (hand - j) / (hand - hook) : foot * (j - hand) / (rows.length - 1 - hand));
        return dx < 0 ? row.slice(-dx) : '.'.repeat(dx) + row;
      }));
      cane.stride[view] = strides.map(leaned);
      cane[view] = leaned({ top: 0, foot: 0, lift: 0 });
    }
  })();
  for (const e of EXTRAS) e.hi = EXTRA32[e.hd];
  // lay rows over a 32 x 32 buffer from column x0, row y0 ('.' leaves what's there)
  function lay32Over(b, rows, x0, y0) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && x0 + i < 32 && y0 + j < 32) b[(y0 + j) * 32 + x0 + i] = ch; }));
  }
  // lay 32-wide rows over a 32 x 32 buffer from row y0: '.' (or past a row's end) leaves what's there, '_' rubs it out
  function lay32(b, rows, y0) {
    (rows || []).forEach((row, j) => [...row].forEach((ch, i) => {
      if (i >= 32 || y0 + j >= 32) return;
      if (ch === '_') b[(y0 + j) * 32 + i] = null; else if (ch !== '.') b[(y0 + j) * 32 + i] = ch;
    }));
  }
  const BALD = HAIRS.findIndex((h) => h.hd === 'bald');
  // One picture of a look at 32 x 32, as a buffer: dir is 'down', 'up' or 'left', and step 0
  // standing, 1 mid-stride or 2 the other stride (which only flips the legs, so a bow or a
  // side part stays put). noHat leaves the head thing and any extra off (under a costume). sweater (a key
  // in SWEATERS) wears that in place of the shirt, over the top of any overalls. loose leaves off
  // the part of the head thing that's drawn on its own so it can move, if it has one.
  function lookBuf32(look, dir, step, noHat, sweater, loose) {
    const hair = HAIRS[look.hair], hat = HATS[look.hat], shirt = SHIRTS[look.shirt], pants = PANTS[look.pants];
    const b = new Array(1024).fill(null);
    // the shirt (or an ugly sweater in its place) goes on before the head, so the hoodie's
    // hood is behind it, and overalls' bib and straps over a shirt (not over a sweater)
    const sw = SWEATERS[sweater], top = sw ? sw.hi : shirt.hi;
    const view = dir === 'left' && step > 0 ? 'leftWalk' : dir;
    lay32(b, top[view], top.from || 20);
    if (!sw && !shirt.over && pants.hi.top) lay32(b, pants.hi.top[view], 20);
    const side = dir === 'left', legs = pants.hi[side ? (step > 0 ? 'leftWalk' : 'left') : step > 0 ? 'downWalk' : 'down'];
    lay32(b, step === 2 && !side ? legs.map((r) => [...r.padEnd(32, '.')].reverse().join('')) : legs, 26);
    if (!noHat && hat.big) lay32(b, hat.hi[dir], 0); // (a big head thing goes behind the head)
    lay32(b, HEAD32[dir], 0);
    lay32(b, hair.hi[dir], 0);
    if (!noHat && hat.big && hat.big.over) lay32(b, hat.big.over[dir], 0); // (a part of it that goes over the hair)
    if (!noHat && hat.hi && !hat.big) { // (the first head thing is nothing at all)
      const head = HEAD32[dir], rows = (loose && hat.hi.loose) || hat.hi;
      (rows[dir] || rows.down).forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '_') { const h = (head[j] || '')[i]; b[j * 32 + i] = h && h !== '.' ? h : null; } else if (ch !== '.') b[j * 32 + i] = ch;
      }));
    }
    // (and over everything, hair and all, whatever's worn on top of the clothes: not under a costume)
    const extra = EXTRAS[look.extra];
    if (!noHat && extra && extra.hi) {
      const stride = step > 0 && extra.hi.stride && extra.hi.stride[dir]; // (the candy cane swings as you walk)
      lay32(b, stride ? stride[step - 1] : extra.hi[dir], extra.hi.from || 20);
    }
    return b;
  }
  // Returns {down:[stand,walkA,walkB], up, left, right} canvases for a look, marked hi: 2 so
  // they're drawn at the usual size (see js/game.js), in an ugly sweater if `sweater` names one.
  function renderLook(look, sweater) {
    const sw = !SHIRTS[look.shirt].over && SWEATERS[sweater];
    return sheet32(look, sw && sweater, lookPalette(look, sw ? sweaterPal(sw) : null));
  }
  // The same picture as renderLook paints, as numbers: 32 x 32, one to a pixel, 0 for see-through
  // and a colour as 0xAABBGGRR, the way a Uint32Array over ImageData has it. For making a picture
  // from without reading a canvas back, since some browsers sprinkle noise over what you read back
  // to stop sites recognizing them (Brave does, and Firefox with fingerprinting protection on).
  function lookPixels(look, dir, step) {
    const pal = lookPalette(look), out = new Uint32Array(1024);
    lookBuf32(look, dir, step).forEach((c, i) => {
      if (!c) return;
      const [r, g, b] = pal[c];
      out[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    });
    return out;
  }
  // The bulbs on someone's tangled lights that you can see (hair or a ribbon might be in the way):
  // each pixel as [x, y, which bulb] from the top left of their picture, for making them twinkle.
  const lightsSeen = {};
  function lightsShowing(look, dir) {
    const key = lookCode(look) + dir;
    if (lightsSeen[key]) return lightsSeen[key];
    const out = [];
    lookBuf32(look, dir === 'right' ? 'left' : dir, 0).forEach((c, i) => {
      const bulb = BULB_GLINTS[c] || c;
      if (BULBS[bulb]) out.push([dir === 'right' ? 31 - (i % 32) : i % 32, Math.floor(i / 32), String(bulb)]);
    });
    return (lightsSeen[key] = out);
  }
  // The same for a coworker: their body is the character editor's parts (short hair, a shirt
  // and tie and trousers; long hair and a blouse for a woman) in their own colours (look: h,
  // s, w, u, K), in an ugly sweater if `sweater` names one. Or the ghost, a sheet of its own.
  const COWORKER32 = {
    male: { hair: HAIRS.findIndex((h) => h.hd === 'short'), shirt: SHIRTS.findIndex((s) => s.hd === 'tie') },
    female: { hair: HAIRS.findIndex((h) => h.hd === 'long'), shirt: SHIRTS.findIndex((s) => s.hd === 'blouse') },
  };
  function renderSprites(gender, look, sweater) {
    if (gender === 'ghost') return renderGhost();
    const sw = SWEATERS[sweater], parts = Object.assign({ hat: 0, pants: 0 }, COWORKER32[gender] || COWORKER32.male);
    return sheet32(parts, sw && sweater, palette(Object.assign(extras32(look), look, sw ? sweaterPal(sw) : null)));
  }
  // a whole sheet at 32 x 32 ({down: [stand, stride, other stride], up, left, right}) for
  // the parts in `parts`, in the colours in `pal`
  function sheet32(parts, sweater, pal) {
    const out = {};
    const make = (dir, step, flip, body = parts, loose = false) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32);
      blit(img, lookBuf32(body, dir, step, false, sweater, loose), 0, 0, pal, flip);
      ctx.putImageData(img, 0, 0);
      // (a head thing with a part that moves: the same picture without it, for drawing with that part)
      const hat = HATS[body.hat];
      if (!loose && hat && hat.hi && hat.hi.loose) cv.loose = make(dir, step, flip, body, true);
      return cv;
    };
    // (and with no hair, showing the whole of both sleeves: see armsOf in js/game.js)
    out.bare = make('down', 0, false, Object.assign({}, parts, { hair: BALD }));
    out.down = [make('down', 0), make('down', 1), make('down', 2)];
    out.up = [make('up', 0), make('up', 1), make('up', 2)];
    // (from the side the legs are the same on both strides, but the candy cane isn't)
    out.left = [make('left', 0), make('left', 1), make('left', 2)];
    out.right = [make('left', 0, true), make('left', 1, true), make('left', 2, true)];
    return out;
  }

  // ---------- Halloween costumes ----------
  // Each costume's name, and its `pal`, which recolours the body under it (and adds any new
  // colour letters). Their pictures are in COSTUME32.
  const COSTUMES = {
    clown: { name: 'Clown', pal: { h: '#e03030', M: '#e03030', F: '#f8f8f8', w: '#f8e040', u: '#3868c8', K: '#7b3fb8' } },
    vampire: { name: 'Vampire', pal: { h: '#181018', s: '#e4e4f0', w: '#f8f8f8', u: '#d02030', K: '#30303c', M: '#d02030', x: '#3a2848' } },
    skeleton: { name: 'Skeleton', pal: { h: '#f0ecd8', s: '#f0ecd8', b: '#f0ecd8', w: '#2c2c38', x: '#2c2c38', u: '#f0ecd8', K: '#3c3c4a' } },
    witch: { name: 'Witch', pal: { s: '#80c868', w: '#7b3fb8', u: '#f08020', K: '#30283c', x: '#30283c', V: '#7b3fb8', O: '#f0b030' } },
    pumpkin: { name: 'Pumpkin', pal: { O: '#f08020', q: '#c05810', h: '#58a848', w: '#58a848', u: '#2c6a34', K: '#5a4a30' } },
    mummy: { name: 'Mummy', pal: { h: '#e8e0c8', s: '#e8e0c8', b: '#e8e0c8', B: '#a89c78', w: '#e8e0c8', u: '#a89c78', K: '#c8c0a0', Y: '#f8e040' } },
    // an air handling fan: a whole blower housing with the outlet duct up by one
    // shoulder, and the wearer's face looking out of the round inlet
    fan: { name: 'Haakon Fan', pal: { x: '#484858' } },
    // a sandwich board with the SDG logo on the front
    sdg: { name: 'SDG Sign', pal: { Y: '#f8d838', O: '#c8a020' } },
  };
  // ---------- Christmas: ugly sweaters ----------
  // Picked after the character editor at Christmas and worn over the look you made in
  // place of its shirt (your hair, head thing and pants stay), in this order on the picker.
  // `cols` are the sweater's colours, the knit first: in SWEATER32's rows they're '1' to '5'.
  const SWEATERS = {
    gingerbread: { name: 'Gingerbread', cols: ['#efe2c4', '#a8642e', '#f8f8f8', '#d03a3a'] },
    reindeer: { name: 'Reindeer', cols: ['#2e6b3a', '#d23a3a', '#f4f1ea', '#8a5a34'] },
    snowflake: { name: 'Snowflakes', cols: ['#23366e', '#f4f1ea', '#c8303a', '#8fb4e8'] },
    tree: { name: 'Xmas tree', cols: ['#c22c34', '#2e8a44', '#f0c838', '#f4f1ea', '#5ab0f0'] },
    candycane: { name: 'Candy cane', cols: ['#2e7a44', '#d0283a', '#f0c838', '#f4f1ea'] },
    santa: { name: 'Santa suit', cols: ['#c8202a', '#f6f4ee', '#1e1a22', '#f0c838'] },
    snowman: { name: 'Snowman', cols: ['#6fa8d8', '#f6f6f2', '#f08a24', '#1e1a22', '#d03a3a'] },
    moose: { name: 'Moose', cols: ['#9a2c2c', '#a8763e', '#efe6cf', '#2e6b3a'] },
    hvac: { name: 'Ho Ho HVAC', cols: ['#1f5a8a', '#f4f1ea', '#d03a3a', '#cfd6e2'] },
  };
  // (and '0', the knit in shadow)
  const sweaterPal = (sw) => { const o = { 0: darker(sw.cols[0], 0.25) }; sw.cols.forEach((c, i) => { o[i + 1] = c; }); return o; };
  // (and each one's 32 x 32 knit: see SWEATER32)
  for (const k in SWEATERS) SWEATERS[k].hi = SWEATER32[k];

  // ---------- the plant's finished units ----------
  // Finished air handling units in shipping, waiting for the truck. The digit on the
  // map picks the design ('0' is the one in the paint booth). Each is laid out at half size
  // (s = set a pixel, r = fill a rectangle, A = the parts: see ahu32).
  const SHIP_UNITS = {
    // The unit in the paint booth, still in grey primer. P and p are its paint, so once
    // you've painted it (Even Coat) the game redraws it with those two swapped out.
    0(W, H, s, r, A) {
      const f = A.casing(W, H, s, r, 13, H - 5, 'P', 'p', 'g');
      A.door(s, r, 3, f + 1, 12, 12, true, 'P');
      A.door(s, r, 19, f + 1, 10, 12, false, 'P');
      A.louvre(s, r, 34, f + 1, 11, 12);
    },
    // Like the photo: white casing, a louvred intake on the end, a big fan door and a
    // smaller coil door, both with portholes, and a little panel between them.
    1(W, H, s, r, A) {
      const f = A.casing(W, H, s, r, 20, H - 5, 'W', 'w', 'G');
      A.louvre(s, r, 3, f + 14, 10, 17);
      A.door(s, r, 15, f + 3, 17, 31, true);
      A.door(s, r, 34, f + 12, 8, 11, false);
      A.door(s, r, 45, f + 9, 15, 25, true);
      r(51, f + 3, 3, 3, 'g'); s(52, f + 4, 'o');       // pressure gauge
      A.tag(s, r, 6, 8);
    },
    // A long, low unit: intake louvre, filter door, coil with its pipe stubs poking
    // out, then the fan section and a discharge opening on the far end.
    2(W, H, s, r, A) {
      const f = A.casing(W, H, s, r, 13, H - 5, 'W', 'w', 'G');
      A.louvre(s, r, 3, f + 1, 9, 12);
      A.door(s, r, 15, f + 1, 12, 12, false);
      for (const py of [f + 2, f + 8]) { r(31, py, 3, 3, 'n'); s(32, py + 1, 'o'); r(36, py, 3, 3, 'n'); s(37, py + 1, 'o'); }
      A.door(s, r, 46, f + 1, 15, 12, true);
      r(65, f + 1, 12, 12, 'k'); r(66, f + 2, 10, 10, 'K'); r(66, f + 2, 10, 1, 'g');
      A.tag(s, r, 5, 4);
    },
    // A stacked unit: a supply tier on top of a return tier, with a rain hood over the
    // outdoor air intake on the roof and the main disconnect on the bottom tier.
    3(W, H, s, r, A) {
      const f = A.casing(W, H, s, r, 34, H - 5, 'W', 'w', 'G'), mid = f + 19;
      r(2, mid, W - 4, 2, 'g'); r(2, mid + 2, W - 4, 1, 'G');
      A.door(s, r, 6, f + 2, 14, 15, true);
      A.door(s, r, 36, f + 2, 14, 15, true);
      A.louvre(s, r, 60, f + 3, 14, 13);
      A.door(s, r, 6, mid + 4, 14, 17, true);
      A.door(s, r, 24, mid + 4, 9, 17, false);
      r(52, mid + 6, 10, 13, 'k'); r(53, mid + 7, 8, 11, 'K');   // disconnect switch
      r(55, mid + 9, 4, 2, 'r'); r(56, mid + 11, 2, 4, 'r');
      r(4, 6, 24, 18, 'k'); r(5, 7, 22, 16, 'g');               // rain hood on the roof
      for (let j = 9; j < 22; j += 3) r(6, j, 20, 1, 'K');
      r(5, 7, 22, 1, 'G');
      A.tag(s, r, 66, 8);
    },
    // Shrink-wrapped and strapped down to a skid, ready to go on the truck.
    4(W, H, s, r, A) {
      const base = H - 8;
      A.skid(W, H, s, r, base);
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
    5(W, H, s, r, A) {
      const f = A.casing(W, H, s, r, 27, H - 5, 'G', 'W', 'g');
      A.fan(s, r, 40, 14);
      r(5, 6, 14, 16, 'k'); for (let j = 7; j < 21; j += 2) r(6, j, 12, 1, 'g');   // condenser coil
      A.door(s, r, 4, f + 1, 14, 13, false);
      A.door(s, r, 22, f + 1, 14, 13, true);
      A.louvre(s, r, 42, f + 1, 18, 13);
      A.tag(s, r, 54, 4);
    },
  };

  // Paint a 32 x 32 buffer into ImageData at pixel (ox, oy).
  function blit(img, b, ox, oy, pal, flip) {
    const d = img.data, W = img.width, N = 32;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const c = b[y * N + (flip ? N - 1 - x : x)];
        if (!c) continue;
        const rgb = pal[c], i = ((oy + y) * W + ox + x) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
  }

  // The things that stand on the floor at 32 x 32, by name (the treadmill a third at a time):
  // laid over the tile from its top left ('.' clear). objAt says which tile has which.
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
    // the chair side on, facing left (its back on the right) and facing right, and facing away from
    // you (the back of its backrest in front of the seat): for your Secret Lair, where it turns
    chairLeft: [
      '',
      '',
      '',
      '...................kkkkkk',
      '..................kkkkkkkk',
      '..................kkwwwukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '..................kkwUUukk',
      '......kkkkkkkkkkkkkkwUUukk',
      '.....kkkkkkkkkkkkkkkwUUukk',
      '.....kkiiiiiiiiiiikkwUUukk',
      '.....kkUUUUUUUUUUUkkwUUukk',
      '.....kkUUUUUUUUUUUkkkkkkkk',
      '.....kkuuuuuuuuuuuukkkkkk',
      '.....kkuuuuuuuuuuuuuuuukk',
      '.....kkkkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkk',
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
    chairRight: [
      '',
      '',
      '',
      '.......kkkkkk',
      '......kkkkkkkk',
      '......kkwwwukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukk',
      '......kkwUUukkkkkkkkkkkkkk',
      '......kkwUUukkkkkkkkkkkkkkk',
      '......kkwUUukkiiiiiiiiiiikk',
      '......kkwUUukkUUUUUUUUUUUkk',
      '......kkkkkkkkUUUUUUUUUUUkk',
      '.......kkkkkkuuuuuuuuuuuukk',
      '.......kkuuuuuuuuuuuuuuuukk',
      '.......kkkkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkkkk',
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
    chairUp: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '.......kkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkiiiiiiiiiiiiiiiikk',
      '......kkUUUUUUUUUUUUUUUUkk',
      '......kkUkkkkkkkkkkkkkkUkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkkkUUUUUUUUUUUUkkkk',
      '.......kkkUuuuukkuuuuukkk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuukkuuuuukk',
      '........kkUuuuuuuuuuuukk',
      '........kkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '..............kKKk',
      '........kKKKKKKKKKKKKKKk',
      '........kkkkkkkkkkkkkkkk',
      '.......kkk.....kk.....kkk',
      '.......kkk....kkkk....kkk',
      '.......kkk....kkkk....kkk',
      '...............kk',
    ],
    // lamps, for your Secret Lair: a floor lamp, a table lamp and a lava lamp, each of the last two on a
    // little round side table (js/game.js lights them up)
    floorLamp: [
      '.........kkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
      '........kkwwwwwwwwwwwwkk',
      '........kkwaaaaaaaaaAAkk',
      '........kkwaaaaaaaaaAAkk',
      '.......kkkwaaaaaaaaaAAkkk',
      '.......kkwaaaaaaaaaaaAAkk',
      '.......kkwaaaaaaaaaaaAAkk',
      '......kkkwaaaaaaaaaaaAAkkk',
      '......kkwaaaaaaaaaaaaaAAkk',
      '......kkwaaaaaaaaaaaaaAAkk',
      '.....kkkwaaaaaaaaaaaaaAAkkk',
      '.....kkooooooooooooooooookk',
      '.....kkkkkkkkkkgKkkkkkkkkkk',
      '......kkkkkkkkkgKkkkkkkkkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.............kkgKkk',
      '.........kkkkkkgKkkkkkk',
      '........kkkkkkggKgkkkkkk',
      '.......kkkggggggKgggggkkk',
      '.......kkKKKKKKgKKKKKKKkk',
      '.......kkKKKKKKKKKKKKKKkk',
      '.......kkkKKKKKKKKKKKKkkk',
      '........kkkkkkKKKKkkkkkk',
      '.........kkkkkkkkkkkkkk',
    ],
    tableLamp: [
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '..........kkwwwwwwwwkk',
      '.........kkkwaaaaaaAkkk',
      '.........kkwaaaaaaaaAkk',
      '........kkkwaaaaaaaaAkkk',
      '........kkwaaaaaaaaaaAkk',
      '.......kkkwaaaaaaaaaaAkkk',
      '.......kkooooooooooooookk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkkkuUUUuukkkkk',
      '..........kkkUUUUUukkk',
      '..........kkuUiUUUuukk',
      '..........kkUUiUUUUukk',
      '..........kkuUUUUUuukk',
      '.........kkkuUUUUUuukkk',
      '.......kkkkkkuUUUuukkkkkk',
      '......kkkkNNNuuuuuuNNNkkkk',
      '.....kkkNNyyyyyuuNNNNNNNkkk',
      '.....kkNNNNNNNNNNNNNNNNNNkk',
      '.....kkNNNNNNNNNNNNNNNNNNkk',
      '.....kknNNNNNNNNNNNNNNNNnkk',
      '.....kkknnNNNNNNNNNNNNnnkkk',
      '......kkknnnnnnnnnnnnnnkkk',
      '.......kknnknnnnnnnnknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkk..kkkk..kkkk',
    ],
    lavaLamp: [
      '.............kkkkkk',
      '............kkkkkkkk',
      '............kkGgggkk',
      '............kkGgggkk',
      '............kkooookk',
      '............kkoRrokk',
      '...........kkkorookkk',
      '...........kkoyooookk',
      '...........kkoyooRokk',
      '..........kkkooorrokkk',
      '..........kkooorroookk',
      '..........kkooooooookk',
      '..........kkkGgggggkkk',
      '...........kkGgggggkk',
      '..........kkkGgggggkkk',
      '.........kkkGgggggggkkk',
      '.......kkkkkGgggggggkkkkk',
      '......kkkkNNGgggggggNNkkkk',
      '.....kkkNNyGgggggggggNNNkkk',
      '.....kkNNNNNNNNNNNNNNNNNNkk',
      '.....kkNNNNNNNNNNNNNNNNNNkk',
      '.....kknNNNNNNNNNNNNNNNNnkk',
      '.....kkknnNNNNNNNNNNNNnnkkk',
      '......kkknnnnnnnnnnnnnnkkk',
      '.......kknnknnnnnnnnknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kknnkkkkhhkkkknnkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkk..kkkk..kkkk',
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
    // the racing cabinet in the lunch room (two tiles tall, like the slot machines): the GP sign
    // lit up on top, a track on the screen, a steering wheel and a gear stick, the coin door
    raceTop: [
      '',
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkwwwwwwwwwwwwwwwwwwwwkmmkk',
      '..kkkoooooorrrorrroooooookmmkk',
      '..kkkoooooorooororoooooookmmkk',
      '..kkkoooooorororrroooooookmmkk',
      '..kkkoooooorororoooooooookmmkk',
      '..kkkoooooorrroroooooooookmmkk',
      '..kkkkwkwkwkwkwkwkwkwkwkwkmmkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkRrrrrrrrrrrrrrrrrrrrrrmmkk',
      '..kkRkkkkkkkkkkkkkkkkkkkkrmmkk',
      '..kkRkkkkkkkkkkkkkkkkkkkkrmmkk',
      '..kkRkkiiieeeeeeeeeeeeekkrmmkk',
      '..kkRkkieeeeeeeeeeeeeeekkrmmkk',
      '..kkRkkeegwwgggrrggggeekkrmmkk',
      '..kkRkkeeggggggggggggeekkrmmkk',
      '..kkRkkeeggEEEEEEEEggeekkrmmkk',
      '..kkRkkeeggEeeeeeeEggeekkrmmkk',
      '..kkRkkeeggEeeeeeeEggeekkrmmkk',
      '..kkRkkeeggEeeeeeeEggeekkrmmkk',
      '..kkRkkeeggEEEEEEEEUgeekkrmmkk',
      '..kkRkkeeggggggggggUgeekkrmmkk',
      '..kkRkkeeggggggggggggeekkrmmkk',
      '..kkRkkeeeeeeeeeeeeeeeekkrmmkk',
      '..kkRkkeeeeeeeeeeeeeeeekkrmmkk',
      '..kkRkkkkkkkkkkkkkkkkkkkkrmmkk',
      '..kkRkkkkkkkkkkkkkkkkkkkkrmmkk',
    ],
    raceBottom: [
      '..kkRrrrrrrrrrrrrrrrrrrrrrmmkk',
      '..kkgggggggkkGGggkkgggggggkkkk',
      '..kkKKKKKKkGGGkkgggkKKwWKKkkkk',
      '..kkKKKKKkGGkKKKKkggkKkkKKkkkk',
      '..kkKKKKKGGkKkkkkkkggKkkKKkkkk',
      '..kkKKKKkggkkkRrrkkkgkGGKKkkkk',
      '..kkKKKKKggkgkrrrkgggKGGKKkkkk',
      '..kkKKKKKkggkkkkkkggkKGGKKkkkk',
      '..kkKKKKKKkgggkkgggkKKKKKKkkkk',
      '..kkkkkkkkkkkggggkkkkkkkkkkkkk',
      '..kkRrrrrrrrrrrrrrrrrrrrrrmmkk',
      '..kkRrrrrrrrrrrrrrrrrrrrrrmmkk',
      '..kkRrrrrrrrrrrrrrrrrrrrrrmmkk',
      '..kkRrrrrrrkkkkkkkkkkrrrrrmmkk',
      '..kkRrrrrrrkgKKKKKKKkrrrrrmmkk',
      '..kkRrrrrrrkgKkkKkkKkrrrrrmmkk',
      '..kkRrrrrrrkgKooKooKkrrrrrmmkk',
      '..kkRrrrrrrkgKkkKkkKkrrrrrmmkk',
      '..kkRrrrrrrkgKKKKKKKkrrrrrmmkk',
      '..kkRrrrrrrkgKRRRRKKkrrrrrmmkk',
      '..kkRrrrrrrkgKKKKKKKkrrrrrmmkk',
      '..kkRrrrrrrkkkkkkkkkkrrrrrmmkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkmmkk',
      '..kkKKKKKKKKKKKKKKKKKKKKKKmmkk',
      '..kkKKKKKKKKKKKKKKKKKKKKKKmmkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '',
      '',
      '',
      '',
      '',
    ],
  };

  // ---------- the plant's finished units and the casino's tables at 32 x 32 ----------
  // A thing several tiles big, at 32 x 32: drawn whole into a buffer and the tile's own piece
  // cut out. draw(W, H, s, r, S, R): s and r take half-size coordinates (each pixel drawn
  // 2 x 2), with W and H at that size too, and S and R the 32 x 32's.
  function paintWhole32(b, get, x, y, t, draw) {
    let x0 = x, y0 = y, x1 = x, y1 = y;
    while (get(x0 - 1, y) === t) x0--;
    while (get(x, y0 - 1) === t) y0--;
    while (get(x1 + 1, y) === t) x1++;
    while (get(x, y1 + 1) === t) y1++;
    const W = (x1 - x0 + 1) * 32, H = (y1 - y0 + 1) * 32, u = new Array(W * H).fill(null);
    const S = (px, py, c) => { px = Math.round(px); py = Math.round(py); if (px >= 0 && px < W && py >= 0 && py < H) u[py * W + px] = c; };
    const R = (px, py, w, h, c) => { for (let j = py; j < py + h; j++) for (let i = px; i < px + w; i++) S(i, j, c); };
    draw(W / 2, H / 2, (px, py, c) => R(px * 2, py * 2, 2, 2, c), (px, py, w, h, c) => R(px * 2, py * 2, w * 2, h * 2, c), S, R);
    const ox = (x - x0) * 32, oy = (y - y0) * 32;
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const c = u[(oy + j) * W + ox + i]; if (c) b[j * 32 + i] = c; }
  }
  // the units' parts: called in half-size coordinates, drawn with 2-pixel outlines, rivets,
  // hinges, a glint on the portholes
  const ahu32 = (S, R) => ({
    casing(W, H, s, r, roof, base, top, face, seam) {
      R(2, 4, W * 2 - 4, base * 2 - 4, 'k');
      R(4, 6, W * 2 - 8, roof * 2 - 6, top); R(4, 6, W * 2 - 8, 1, 'w');
      R(4, roof * 2, W * 2 - 8, 2, 'g');
      R(4, roof * 2 + 2, W * 2 - 8, base * 2 - roof * 2 - 4, face); R(4, roof * 2 + 2, W * 2 - 8, 1, 'w');
      for (let i = 32; i < W * 2 - 16; i += 32) {
        R(i, 8, 1, roof * 2 - 8, seam); R(i, roof * 2 + 2, 1, base * 2 - roof * 2 - 4, seam);
        for (let j = roof * 2 + 6; j < base * 2 - 4; j += 8) S(i + 2, j, seam);   // rivets
      }
      R(2, base * 2, W * 2 - 4, H * 2 - base * 2 - 2, 'k');
      R(4, base * 2 + 2, W * 2 - 8, H * 2 - base * 2 - 6, 'K'); R(4, base * 2 + 2, W * 2 - 8, 1, 'g');
      for (let i = 12; i < W * 2 - 12; i += 24) { R(i, base * 2 + 3, 6, H * 2 - base * 2 - 8, 'k'); R(i + 1, base * 2 + 3, 4, 1, 'K'); }
      return roof + 1;
    },
    porthole(s, r, x, y) {
      const cx = x * 2 + 6, cy = y * 2 + 6;
      for (let j = -7; j <= 7; j++)
        for (let i = -7; i <= 7; i++) {
          const d = Math.hypot(i + 0.5, j + 0.5);
          if (d <= 6.2) S(cx + i, cy + j, d > 5.2 ? 'k' : d > 3.8 ? 'g' : 'k');
        }
      R(cx - 3, cy - 3, 2, 2, 'i'); S(cx + 1, cy + 2, 'u'); S(cx + 2, cy + 1, 'u');
    },
    door(s, r, x, y, w, h, window, fill = 'w') {
      R(x * 2, y * 2, w * 2, h * 2, 'k'); R(x * 2 + 1, y * 2 + 1, w * 2 - 2, h * 2 - 2, 'g');
      R(x * 2 + 2, y * 2 + 2, w * 2 - 4, h * 2 - 4, fill);
      R(x * 2 + 2, y * 2 + h * 2 - 3, w * 2 - 4, 1, 'G'); R(x * 2 + w * 2 - 3, y * 2 + 2, 1, h * 2 - 4, 'G');
      for (const hy of [y * 2 + 4, y * 2 + h * 2 - 8]) { R(x * 2 - 1, hy, 4, 4, 'k'); R(x * 2, hy + 1, 2, 2, 'g'); }   // hinges
      for (const ly of h > 14 ? [y * 2 + 6, y * 2 + h * 2 - 10] : [y * 2 + h - 2]) {   // lever latches
        R(x * 2 + w * 2 - 8, ly, 6, 3, 'k'); R(x * 2 + w * 2 - 7, ly + 1, 4, 1, 'K'); R(x * 2 + w * 2 - 8, ly + 3, 2, 3, 'k');
      }
      if (window) this.porthole(s, r, x + (w >> 1) - 4, y + 3);
    },
    louvre(s, r, x, y, w, h) {
      R(x * 2, y * 2, w * 2, h * 2, 'k'); R(x * 2 + 2, y * 2 + 2, w * 2 - 4, h * 2 - 4, 'G');
      for (let j = y * 2 + 3; j < y * 2 + h * 2 - 3; j += 4) { R(x * 2 + 3, j, w * 2 - 6, 1, 'w'); R(x * 2 + 3, j + 1, w * 2 - 6, 1, 'g'); R(x * 2 + 3, j + 2, w * 2 - 6, 1, 'K'); }
    },
    tag(s, r, x, y) {
      R(x * 2, y * 2, 16, 12, 'k'); R(x * 2 + 1, y * 2 + 1, 14, 10, 'o'); R(x * 2 + 1, y * 2 + 1, 14, 1, 'y');
      S(x * 2 + 3, y * 2 + 3, 'k');                                                   // the string hole
      R(x * 2 + 6, y * 2 + 4, 7, 1, 'k'); R(x * 2 + 5, y * 2 + 6, 5, 1, 'k'); R(x * 2 + 5, y * 2 + 8, 7, 1, 'D');
    },
    skid(W, H, s, r, y) {
      R(0, y * 2, W * 2, H * 2 - y * 2 - 2, 'D'); R(0, y * 2, W * 2, 3, 'N'); R(0, y * 2, W * 2, 1, 'y');
      for (let i = 4; i < W * 2 - 8; i += 20) { R(i, y * 2 + 3, 12, H * 2 - y * 2 - 5, 'n'); S(i + 2, y * 2 + 5, 'k'); S(i + 9, y * 2 + 5, 'k'); }
    },
    fan(s, r, cx, cy) {
      const X = cx * 2 + 1, Y = cy * 2 + 1;
      for (let j = -21; j <= 21; j++)
        for (let i = -21; i <= 21; i++) {
          const d = Math.hypot(i, j), a = Math.atan2(j, i);
          if (d > 21) continue;
          if (d > 19) S(X + i, Y + j, 'k');
          else if (d > 17.5) S(X + i, Y + j, 'g');
          else if (d < 3) S(X + i, Y + j, d < 1.6 ? 'w' : 'G');
          else S(X + i, Y + j, Math.round(d) % 4 === 0 ? 'g' : ((a * 5 / Math.PI + d * 0.12) % 2 + 2) % 2 < 1 ? 'K' : 'k');
        }
    },
  });
  // the tables in Cody's casino: green felt inside a padded wooden rail (W and H the 32 x 32 size)
  const CASINO_TABLES32 = {
    '['(W, H, S, R) {
      const cx = W / 2, rx = W / 2 - 1, ry = H - 7;
      const inside = (i, j, k) => ((i + 0.5 - cx) / (rx - k)) ** 2 + ((j + 0.5 - 4) / (ry - k)) ** 2 <= 1;
      for (let j = 4; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (!inside(i, j, 0)) continue;
          let c = 'k';
          if (inside(i, j, 2) && j > 5) c = inside(i, j, 4) && j > 7 ? (inside(i, j, 6) ? 'T' : 'N') : 'N';
          if (inside(i, j, 8) && j > 11) c = inside(i, j, 18) && !inside(i, j, 19.5) ? 'F' : 'Q';
          if (c === 'T' && !inside(i, j - 2, 4)) c = 'N';
          S(i, j, c);
        }
      R(cx - 18, 12, 36, 8, 'k'); ['r', 'w', 'u', 'o', 'r', 'w', 'u', 'o'].forEach((c, k) => { R(cx - 16 + k * 4, 14, 3, 4, c); S(cx - 16 + k * 4, 14, 'w'); });
      for (const dx of [-10, 2]) { R(cx + dx, 24, 10, 14, 'k'); R(cx + dx + 1, 25, 8, 12, 'w'); R(cx + dx + 3, 28, 2, 2, 'r'); R(cx + dx + 5, 32, 2, 2, 'r'); }
      for (const a of [0.5, 1.57, 2.64]) {
        const px = Math.round(cx + Math.cos(a) * (rx - 14)), py = Math.round(4 + Math.sin(a) * (ry - 14));
        for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = Math.hypot(i, j); if (d <= 4) S(px + i, py + j, d > 3 ? 'F' : 'Q'); }
      }
    },
    ']'(W, H, S, R) {
      const Rr = 29, cy = 33, half = W / 2 - Rr - 1;
      const dist = (i, j) => Math.hypot(Math.max(0, Math.abs(i + 0.5 - W / 2) - half), j + 0.5 - cy);
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const d = dist(i, j);
          if (d > Rr) continue;
          S(i, j, d > Rr - 2 ? 'k' : d > Rr - 4 ? 'N' : d > Rr - 8 ? (d > Rr - 5 ? 'N' : 'T') : d > Rr - 13 && d <= Rr - 11.5 ? 'F' : 'Q');
        }
      for (let k = 0; k < 5; k++) {
        const x = W / 2 - 30 + k * 12;
        R(x, 26, 10, 14, 'k'); R(x + 1, 27, 8, 12, 'w');
        const c = k & 1 ? 'r' : 'k'; R(x + 2, 28, 2, 2, c); R(x + 4, 31, 2, 3, c); R(x + 6, 35, 2, 2, c);
      }
      [[24, 30, 'r'], [128, 30, 'u'], [56, 14, 'o'], [96, 14, 'r'], [56, 46, 'u'], [96, 46, 'o']].forEach(([x, y, c]) => {
        R(x, y, 8, 6, 'k'); R(x + 1, y + 1, 6, 1, c); R(x + 1, y + 3, 6, 1, c); R(x + 1, y + 2, 6, 1, 'k');
      });
      R(114, 18, 6, 6, 'k'); R(115, 19, 4, 4, 'w'); R(116, 20, 2, 2, 'k'); // the dealer button
    },
  };

  // ---------- things drawn by code, at 32 x 32 ----------
  // Each takes a 32 x 32 buffer and the tile's (get, x, y, t), and draws what stands on the
  // tile (standing32 lays it over the floor and the rest).
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
  PAINT32.Q = PAINT32.V; // (as with the TVs)
  // the plant's finished units (SHIP_UNITS' layouts, drawn with the 32 x 32 parts) and the casino's tables
  // a board laid out on a lunch room table, ready for a game, with piece() to set out each square
  const tableBoard32 = (t, piece) => (b, get, x, y) => paintWhole32(b, get, x, y, t, (W, H, s, r, S, R) => {
    const SIZE = 5, X = 12, Y = 7, N = SIZE * 8;
    R(X - 2, Y - 2, N + 4, N + 4, 'k');
    R(X - 1, Y - 1, N + 2, N + 2, 'D');
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const px = X + i * SIZE, py = Y + j * SIZE;
      R(px, py, SIZE, SIZE, (i + j) & 1 ? 'p' : 'c');
      piece(i, j, px, py, S, R);
    }
  });
  // the chessboard (the map's '8'): the back row stands a little taller. Black's are solid with a
  // glint, white's have a white middle
  PAINT32['8'] = tableBoard32('8', (i, j, px, py, S, R) => {
    if (j > 1 && j < 6) return;
    const tall = j === 0 || j === 7, top = py + (tall ? 0 : 1), h = tall ? 4 : 3;
    R(px + 1, top, 3, h, 'k');
    if (j > 5) R(px + 2, top + 1, 1, h - 1, 'w'); else S(px + 2, top, 'g');
  });
  // the checkerboard (the map's '9'): red at the far side, black at the near side, on the dark squares
  PAINT32['9'] = tableBoard32('9', (i, j, px, py, S, R) => {
    if (!((i + j) & 1) || (j > 2 && j < 5)) return;
    const red = j < 3;
    R(px + 1, py + 1, 3, 3, red ? 'r' : 'k');
    S(px + 1, py + 1, red ? 'R' : 'g');
  });
  for (const t of '012345') PAINT32[t] = (b, get, x, y) => paintWhole32(b, get, x, y, t, (W, H, s, r, S, R) => SHIP_UNITS[t](W, H, s, r, ahu32(S, R)));
  for (const t of '[]') PAINT32[t] = (b, get, x, y) => paintWhole32(b, get, x, y, t, (W, H, s, r, S, R) => CASINO_TABLES32[t](W * 2, H * 2, S, R));

  // ---------- the office at 32 x 32 ----------
  // A floor (renderFloor): the floors, walls, doors, desks and counters and the cubicle
  // partitions a tile at a time, with everything that stands on the floor (chairs, plants,
  // machines and the rest) laid over the top. Outlines are 2 pixels, light from the top
  // left, as for the people.
  const isWall = (c) => c === '#' || c === 'X' || c === 'E';
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
          // (the next three are only floors you can pick for your Secret Lair: see LAIR_FLOORS in js/game.js)
          case 'W': { // dark wood: the same planks, stained
            const row = Math.floor(gy / 8), joint = (gx + row * 38) % 96 === 0;
            const grain = y % 8 === 3 && (gx * 7 + row * 3) % 13 < 4;
            c = y % 8 === 7 || joint || grain ? 'h' : y % 8 === 0 ? 'N' : 'n';
            break;
          }
          case 'H': { // parquet: squares of four short slats, laid each way in turn, a light edge on each slat
            const across = ((gx >> 4) + (gy >> 4)) & 1, along = across ? gy : gx, at = (across ? gx : gy) % 16;
            c = along % 4 === 3 || at === 15 ? 'n' : along % 4 === 0 ? 'y' : 'N';
            break;
          }
          case 'X': { // a checkerboard, half a tile to a square, each square lit along its top
            const dark = ((gx >> 4) + (gy >> 4)) & 1;
            c = dark ? (gy % 16 === 0 ? 'g' : 'K') : (gy % 16 === 0 ? 'w' : 'W');
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
    T: ['T', 'y', 'N', 'w'], 8: ['8', 'y', 'N', 'w'], 9: ['9', 'y', 'N', 'w'], k: ['kMnP', 'W', 'g', 'w'], M: ['kMnP', 'W', 'g', 'w'], P: ['kMnP', 'W', 'g', 'w'],
    r: ['rR', 'y', 'u', 'w'], R: ['rR', 'y', 'u', 'w'], Z: ['Z', 'y', 'N', 'w'], e: ['e', 'g', 'K', 'G'],
    '+': ['+', 'W', 'u', 'w'], // (the plant's steel work tables)
  };
  // the floor, walls, door, desk or partition of one tile at 32 x 32 (what's standing on it comes after)
  function structure32(get, floorCh, x, y, rugs) {
    const b = new Array(1024).fill(null), t = get(x, y);
    if (t === ' ') return b.fill('k');
    if (t === '#') { wall32(b, get, x, y, floorCh === '-'); return b; }
    floor32(b, floorCh, x, y);
    if (rugs) rug32(b, rugs, x, y);
    const con = (chars) => ({ u: chars.includes(get(x, y - 1)), d: chars.includes(get(x, y + 1)), l: chars.includes(get(x - 1, y)), r: chars.includes(get(x + 1, y)) });
    if (t === 'D') door32(b, get, x, y);
    else if (t === '=') partition32(b, con('=#'));
    else if (BLOCKS32[t]) { const [joins, top, face, hi] = BLOCKS32[t]; block32(b, get, joins, top, face, hi, x, y); }
    return b;
  }
  // Rugs, for your Secret Lair: each { x1, y1, x2, y2, kind } on the map (see LAIR_PIECES in js/game.js),
  // laid over the floor, under anything standing on them. Each is drawn whole, a few pixels in from the
  // edges of its tiles so the floor shows round it, with a 2-pixel outline. RUGS32[kind](x, y, W, H) is
  // the colour of pixel x, y of a rug W by H pixels, or null where there isn't any rug.
  const RUGS32 = {
    // red, with a gold-studded border, a gold line inside it and a cream diamond in the middle, and a
    // fringe on its two short ends
    red(x, y, W, H) {
      const M = 3, long = W >= H, along = long ? x : y, across = long ? y : x, L = long ? W : H, A = long ? H : W;
      if (along < M || along >= L - M) return across >= M + 3 && across < A - M - 3 && across % 3 === 0 ? 'y' : null;
      if (across < M || across >= A - M) return null;
      const e = Math.min(x - M, W - M - 1 - x, y - M, H - M - 1 - y);
      if (e < 2) return 'k';
      if (e < 7) return (e === 4 && (along + across) % 6 < 2) ? 'o' : 'M';
      if (e === 7) return 'o';
      const d = Math.abs(x + 0.5 - W / 2) / (W / 2 - 10) + Math.abs(y + 0.5 - H / 2) / (H / 2 - 10);
      if (d < 0.22) return 'M';
      if (d < 0.42) return 'y';
      if (d < 0.48) return 'o';
      return e === 8 ? 'R' : 'r';
    },
    // a flannel buffalo check, red and black
    plaid(x, y, W, H) {
      const M = 3;
      if (x < M || y < M || x >= W - M || y >= H - M) return null;
      if (x < M + 2 || y < M + 2 || x >= W - M - 2 || y >= H - M - 2) return 'k';
      const a = ((x - M) >> 3) & 1, b = ((y - M) >> 3) & 1;
      return a && b ? 'k' : a || b ? 'm' : (x + y) % 4 === 0 ? 'R' : 'r';
    },
    // a round braided rag rug, rings of blues
    round(x, y, W, H) {
      const rx = W / 2 - 3, ry = H / 2 - 3, d = Math.hypot((x + 0.5 - W / 2) / rx, (y + 0.5 - H / 2) / ry);
      if (d > 1) return null;
      const e = (1 - d) * Math.min(rx, ry);
      if (e < 2) return 'k';
      const ring = Math.floor((e - 2) / 4) % 4, braid = (Math.round(Math.atan2(y - H / 2, x - W / 2) * 12) & 1) && ((e - 2) % 4) < 1;
      return braid ? 'i' : ['U', 'u', 'U', 'i'][ring];
    },
  };
  function rug32(b, rugs, tx, ty) {
    for (const r of rugs) {
      if (tx < r.x1 || tx > r.x2 || ty < r.y1 || ty > r.y2 || !RUGS32[r.kind]) continue;
      const W = (r.x2 - r.x1 + 1) * 32, H = (r.y2 - r.y1 + 1) * 32, ox = (tx - r.x1) * 32, oy = (ty - r.y1) * 32;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const c = RUGS32[r.kind](ox + x, oy + y, W, H);
        if (c) b[y * 32 + x] = c;
      }
    }
  }
  // the tiles with one picture from OBJ32 standing on them
  const OBJ_AT = {
    m: 'monitor', R: 'monitor', '^': 'forklift', M: 'appliance', c: 'chair', '<': 'chairLeft', '>': 'chairRight', '"': 'chairUp', '(': 'floorLamp', ')': 'tableLamp', '|': 'lavaLamp', p: 'plant', w: 'toilet', n: 'sink', f: 'fridge',
    v: 'recycling', x: 'copier', b: 'shelf', h: 'shower', o: 'ball', W: 'washer', t: 'trophies', g: 'snackShelf', z: 'serverRack',
    y: 'computerRack', O: 'dryer', G: 'punchingBag', N: 'locker', I: 'pulldown', e: 'dumbbells', F: 'fan', a: 'damper', s: 'engraver',
    L: 'coil', K: 'panel', U: 'cupboard', Y: 'printer', B: 'box', H: 'partsShelf', J: 'junk',
  };
  // ---------- the Secret Lair's keepsakes ----------
  // What each game earns you for your Secret Lair (see LAIR_PIECES in js/game.js): not the game's own
  // machine but something that stands for it, a giant coffee mug for the coffee machine, boxing gloves
  // for the punching bag and so on, each a picture standing on one tile, like OBJ32's. On the lair's
  // map each is a character of its own from U+0100 on, given out in this order (DECOR_CH). Only the
  // lair's map has them, and a saved lair goes by the piece's id, so the order can change.
  const DECOR32 = {
    mug: [
      '',
      '............W..W....W',
      '............W..W...W',
      '...........W..W....W',
      '...........W..W...W',
      '.........kWkkkkWkkW',
      '......kkkkWkkkkkWkkWkk',
      '.....kkkkkRRRRRRRRkkkkk',
      '....kkkRRRhhhhhhhhRRRkkk',
      '....kkRRhhhhhhhhhhhhRRkk',
      '....kkRRhhnnnnhhhhhhRRkkkk',
      '....kkRRRRhhhhhhhhRRRMkkkkk',
      '....kkRRRRRRRRRRRRMMMMrrrkkk',
      '....kkRRRRrrrrrrrrMMMMrrrrkkk',
      '....kkRRRRrrrrrrrrMMMMkkrrrkkk',
      '....kkRRRRrrrrrrrrMMMMkkkrrrkk',
      '....kkRWWwwwwwwwwwwwwwkkkkrrkk',
      '....kkRWWwwwwwwwwwwwwwkkkkrrkk',
      '....kkRRRRrrrrrrrrMMMMkkkkrrkk',
      '....kkRRRRrrrrrrrrMMMMkkkkrrkk',
      '....kkRRRRrrrrrrrrMMMMkkkrrrkk',
      '....kkRRRRrrrrrrrrMMMMkkrrrkkk',
      '....kkRRRRrrrrrrrrMMMMrrrrkkk',
      '....kkRRRRrrrrrrrrMMMMrrrkkk',
      '....kkRRRRrrrrrrrrMMMMkkkkk',
      '....kkRRRRrrrrrrrrMMMMkkkk',
      '....kkkRRRrrrrrrrrMMMkkk',
      '.....kkkkkrrrrrrrrkkkkk',
      '......kkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkk',
    ],
    paddle: [
      '..........kkkkkkkkkk',
      '.........kkkkkkkkkkkk.kkkkkk',
      '........kkkRRRRRrrrkkkkkkkkkk',
      '.......kkkRRRRRrrrrrkkkwwwwkkk',
      '......kkkRRRRRrrrrrrrkwwwwwwkk',
      '......kkRRRRRrrrrrrrrrwwwwwwkk',
      '.....kkkRRRRrrrrrrrrrrwwwwwWkk',
      '.....kkRRRRrrrrrrrrrrrwwwwWWkk',
      '.....kkRRRrrrrrrrrrrrrMwwWWkkk',
      '.....kkRRrrrrrrrrrrrrMMkkkkkk',
      '.....kkRrrrrrrrrrrrrMMMkkkkk',
      '.....kkrrrrrrrrrrrrMMMMkk',
      '.....kkrrrrrrrrrrrMMMMMkk',
      '.....kkkrrrrrrrrrMMMMMkkk',
      '......kkrrrrrrrrMMMMMMkk',
      '......kkkrrrrrrrMMMMMkkk',
      '.......kkkrrrrrMMMMMkkk',
      '........kkkrrrMMMMMkkk',
      '.........kkkkkyNNnkkk',
      '..........kkkkyNNnkk',
      '............kkyNNnkk',
      '............kkyNNnkk',
      '............kkyNNnkk',
      '...........kkkyNNnkkk',
      '.........kkkkkyNNnkkkkk',
      '........kkkkggyNNnKKkkkk',
      '........kkgggKKKKKKKKKkk',
      '........kkKKKKKKKKKKKKkk',
      '........kkkkKKKKKKKKkkkk',
      '.........kkkkkkkkkkkkkk',
      '...........kkkkkkkkkk',
    ],
    plushsnake: [
      '',
      '.................kkkkkk',
      '...............kkkkkkkkkk',
      '..............kkkkllEEkkkk',
      '.............kkklllEEEEEkkk',
      '.............kklllEEEEEEEkk',
      '.............kkllEEwEEwEekk',
      '.............kkEEEEkEEkeekk',
      '.............kkEEEEEEEeeekkr',
      '.............kkkEEEEeeeekkr',
      '..............kkklEeeekkkk.r',
      '...............kklEEEkkkk',
      '.........kkkkkkkklEEEkk',
      '........kkkkkkkkklEEEkkk',
      '.......kkklllllEElEEEEkkk',
      '......kkkllllEEEEEEEEEEkkk',
      '......kkllEEEEEEEEEEEeeekk',
      '......kkkEEoEoEEoEEoeoekkk',
      '.....kkklleeeeeeeeeeeeEEkkk',
      '....kkkllllEEEEEEEEEEEEEEkkk',
      '....kklllEEEEEEEEEEEEEEeeekk',
      '....kkkEEoEEEoEEoEEoeeeoekkk',
      '....kkklEEEEEEEEEEeeeeeeEkkk',
      '...kkkllleeeeeeeeeeeeeeeEEkkk',
      '...kkllllEEEEEEEEEEEEEEEEeekk',
      '...kklEEEEEEEEEEEEEEEEeeeeekk',
      '...kkkEEoEEEoEEEoEEEoeeeoekkk',
      '....kkkEEEEEEEEEEeeeeeeeekkk',
      '.....kkkeeeeeeeeeeeeeeeeekk',
      '......kkkkkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkkk',
    ],
    gloves: [
      '............kkkkkkkk',
      '...........kkkkwwkkkk',
      '..........kkkwwkkwwkkk',
      '..........kkwwkkkkwwkkk',
      '..........kkwkkkkkkkwkkk',
      '........kkkkkkk..kkkkwkk',
      '......kkkkkkkkkk..kkkkkk',
      '.....kkkkRRRrkkkkkkkkkkkkk',
      '....kkkRRRRrrrrkkkkRRRrkkkk',
      '....kkRRRRrrrrrrkRRRRrrrrkkk',
      '...kkkRRRrrrrrrrRRRRrrrrrrkk',
      '...kkRRRrrrrrrrrRRRrrrrrrrkkk',
      '...kkRRrrrrrrrrRRRrrrrrrrrrkk',
      '..kkkRrrMrrrrrrRRrrrrrrrrrrkk',
      '..kkRRrrMrrrrrrRrrMrrrrrrrMkk',
      '..kkRrrrMrrrrrRRrrMrrrrrrMMkk',
      '..kkrrrrMrrrrMRrrrMrrrrrMMMkk',
      '..kkrrrrMrrrMMrrrrMrrrrMMMMkk',
      '..kkkrrrMrrMMMrrrrMrrrMMMMkkk',
      '...kkrrrrrrMMMMrrrMrrMMMMMkk',
      '...kkkkGGrMMMGGrrrrrrMMMMkkk',
      '....kkkwwwwwwwGGkGGrMMMGGGkk',
      '.....kkwwwwwwwGGkwwwwwwwGGkk',
      '.....kkwwwwwwwGGkwwwwwwwGGkk',
      '.....kkwwwwwwwGGkwwwwwwwGGkk',
      '.....kkkkkkkkkkkkwwwwwwwGGkk',
      '......kkkkkkkkkkkkkkkkkkkkkk',
      '................kkkkkkkkkkk',
    ],
    sneakers: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '...............kkkkkk',
      '..........kkkkkkkkkkkk',
      '........kkkkkkkkuuuukkk',
      '.......kkkkuuuuuuuuuukkkk',
      '......kkkuUUUUUUUUuwwukkkkkk',
      '.....kkkuuuuuuuuuuuuuuwwkkkkkk',
      '.....kkuuuuuuuuuuuuuuuuuuwwkkkk',
      '.....kkuuuuuuuuuuuuuuuuuuuuuukkk',
      '.....kkoooooouuuuuuuuuuuuuuuuukk',
      '....kkkuuuuuUUUUuuuuuuuuuuuuuuuk',
      '...kkkkUUUUUUUUUUuuuuuuuuuuuuuuk',
      '..kkkUiiiiiiiiUwwUwwwwwwwwwwwwww',
      '.kkkUUUUUUUUUUUUUUwwwwwwwwwwwwww',
      '.kkUUUUUUUUUUUUUUUUUUwwGGGGGGGGG',
      '.kkUUUUUUUUUUUUUUUUUUUUUUkkkkkkk',
      '.kkooooooUUUUUUUUUUUUUUUUUkkkkkk',
      '.kkUUUUUUUUUUUUUUUUUUUUUUUUkk',
      '.kkUUUUUUUUUUUUUUUUUUUUUUUUkkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkwwwwwwwwwwwwwwwwwwwwwwwwwkk',
      '.kkGGGGGGGGGGGGGGGGGGGGGGGGGkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    kettlebell: [
      '',
      '',
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkkKKKKKKKKkkk',
      '........kkkKKKKKKKKKKkkk',
      '.......kkkKKKKkkkkKKKKkkk',
      '.......kkKKKkkkkkkkkKKKkk',
      '.......kkKKkkkk..kkkkKKkk',
      '.......kkggkk......kkKKkk',
      '.......kkKKkkkkkkkkkkKKkk',
      '.......kkKKkkkkkkkkkkKKkk',
      '.......kkKKRRRRRRrrrrKKkk',
      '......kkkkRRRRRRrrrrrrkkkk',
      '......kkRRRRRRRrrrrrrrrrkk',
      '.....kkkRRRRRrrrrrrrrrrrkkk',
      '....kkkRRRRRrrrrrrrrrrrrrkkk',
      '....kkRRRRRrrrrrrrrrrrrrrrkk',
      '....kkRRRRrrrwwwwwwrrrrrrMkk',
      '....kkRRRrrrrwrrrrwrrrrrMMkk',
      '....kkRRrrrrrwrrrrwrrrrMMMkk',
      '....kkrrrrrrrwwwwwwrrMMMMMkk',
      '....kkrrrrrrrrrrrrrrMMMMMMkk',
      '....kkkrrrrrrrrrrrrMMMMMMkkk',
      '.....kkkrrrrrrrrrrMMMMMMkkk',
      '......kkrrrrrrrrrMMMMMMMkk',
      '......kkkkrrrrrMMMMMMMkkkk',
      '.......kkMMMMMMMMMMMMMMkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
    ],
    dumbbells: [
      '',
      '',
      '',
      '......kkkk................kkkk',
      '.....kkkkkk..............kkkkkk',
      '....kkkUukkk............kkkUukkk',
      '...kkkUUuukkk..........kkkUUuukk',
      '...kkUUuuuukk..........kkUUuuuuk',
      '...kkUUuuuukkkkkkkkkkkkkkUUuuuuk',
      '...kkUUUuuukkkkkkkkkkkkkkUuuUUuk',
      '...kkUUUuuuwwwwwwwwwwwwwwUuuUUuk',
      '...kkuUUuukGGGGGGGGGGGGGGuuuUUkk',
      '...kkuUUuukGGGGGGGGGGGGGGuuuUUkk',
      '...kkuuuukkkkkkkkkkkkkkkkuuuukkk',
      '..kkkuuukkkkkkkkkkkkkkkkkuuukkkk',
      '.kkkgKuukkkkk........kkkgKuukkkk',
      'kkkggKKkkkkk........kkkggKKkkkkk',
      'kkggKKKKkkk.........kkggKKKKkkk',
      'kkggKKKKkkkkkkkkkkkkkkggKKKKkk',
      'kkgggKKKkkkkkkkkkkkkkkgKKggKkk',
      'kkgggKKKwwwwwwwwwwwwwwgKKggKkk',
      'kkKggKKKGGGGGGGGGGGGGGKKKggKkk',
      'kkKggKKKGGGGGGGGGGGGGGKKKggKkk',
      'kkKKKKKKkkkkkkkkkkkkkkKKKKKKkk',
      'kkKKKKKKkkkkkkkkkkkkkkKKKKKKkk',
      'kkkKKKKkkk..........kkkKKKKkkk',
      '.kkkKKkkk............kkkKKkkk',
      '..kkkkkk..............kkkkkk',
      '...kkkk................kkkk',
    ],
    yogamat: [
      '',
      '.............kkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkkkkEEEEkkkkk',
      '........kkkEEEeeeeEEEkkk',
      '.......kkkEEeEeeeeEeEEkkk',
      '.......kklEEeEeeeeEeEEekk',
      '.......kkllEEEeeeeEEEeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kkNNNNNNNNNNNNNNkk',
      '.......kknnnnnnnnnnnnnnkk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kkNNNNNNNNNNNNNNkk',
      '.......kknnnnnnnnnnnnnnkk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kklllEEEEEEEEeeekk',
      '.......kkkllEEEEEEEEeekkk',
      '........kkklEEEEEEEEekkk',
      '.........kkkkkEEEEkkkkk',
      '..........kkkkkkkkkkkk',
      '.............kkkkkk',
    ],
    basket: [
      '',
      '',
      '',
      '',
      '',
      '.......kkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '......kkUUUUUUUUUUUUUUUUkk',
      '.....kkkuuuuuuuuuuuuuuuukkk',
      '....kkkkuuuuuuuuuuuuuuuukkkk',
      '....kkyyyyyyyyyyyyyyyyyyyykk',
      '..kkkkooooooooooooooooooookkkk',
      '.kkkkkooooooooooooooooooookkkkk',
      '.kkiiiiiiiiiiiiiiiiiiiiiiiiiUkk',
      '.kkUUUUUUUUUUUUUUUUUUUUUUUUUUkk',
      '.kkUUUUUUUUUUUUUUUUUUUUUUUUUUkk',
      '.kkkiiiiiiiiiiiiiiiiiiiiiiUUkkk',
      '..kkiiiiiiiiiiiiiiiiiiiiiiUUkk',
      '..kkiiiUUiiUUiiUUiiUUiiUUiUUkk',
      '..kkiiiUUiiUUiiUUiiUUiiUUiUUkk',
      '..kkiiiUUiiUUiiUUiiUUiiUUiUkkk',
      '..kkkiiiiiiiiiiiiiiiiiiiiiUkk',
      '...kkiiiiiiiiiiiiiiiiiiiiiUkk',
      '...kkiiUUiiUUiiUUiiUUiiUUiUkk',
      '...kkiiUUiiUUiiUUiiUUiiUUiUkk',
      '...kkiiUUiiUUiiUUiiUUiiUUikkk',
      '...kkkiiiiiiiiiiiiiiiiiiiikk',
      '....kkiiiiiiiiiiiiiiiiiiiikk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
    ],
    papers: [
      '',
      '',
      '..........kkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkkkkk',
      '........kkkwwwwwwwwwwwwGkk',
      '.......kkkwwwwwwwwwwwwGGkk',
      '.......kkwwwwwwwwwwwwGGGkk',
      '.......kkWWWWWWWWWWWWGGGkk',
      '.......kkWWWWWWWWWWWWGGGkk',
      '.......kkGGGGGGGGGGGGGgGkk',
      '.......kkWWWWWWWWWWWWGGukk',
      '.......kkGGGGGGGGGGGGguukk',
      '.......kkWWWWWWWWWWWWuuukk',
      '.......kkiiiiiiiiiiiiuuGkk',
      '.......kkUUUUUUUUUUUUuGGkk',
      '.......kkUUUUUUUUUUUUGgGkk',
      '.......kkWWWWWWWWWWWWGGGkk',
      '.......kkGGGGGGGGGGGGgGGkk',
      '.......kkWWWWWWWWWWWWGGukk',
      '.......kkGGGGGGGGGGGGguukk',
      '.......kkWWWWWWWWWWWWuuukk',
      '.......kkiiiiiiiiiiiiuuGkk',
      '.......kkUUUUUUUUUUUUuGGkk',
      '.......kkUUUUUUUUUUUUgGGkk',
      '.......kkWWWWWWWWWWWWGGGkk',
      '.......kkGGGGGGGGGGGGgGkkk',
      '.......kkWWWWWWWWWWWWGkkk',
      '.......kkGGGGGGGGGGGGkgkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
    ],
    paperclip: [
      '',
      '.............kkk',
      '.........kkkkkkkkkkk',
      '........kkkkkkGkkkkkk',
      '.......kkkGGGGGGGGGkkk',
      '......kkkGGGGGkGGGGGkkk',
      '......kkGGGkkkkkkkGGGkk',
      '......kkGGkkkkkkkkGGGkkkk',
      '......kkGGkk....kkGGGkkkkk',
      '......kkwGkkkk..kkGGkkGGkk',
      '......kkwGkkkkk.kkGGkkGGkk',
      '......kkwGkkwkkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkwGkkkkGGkkGGkk',
      '......kkwGkkGGkkkkGGkkGGkk',
      '......kkwGkkGGkkkkGGkkGGkk',
      '......kkwGkkGGGGGGGGkkGGkk',
      '......kkGGkkkkGGGGkkkkGGkk',
      '......kkGGkkkkkkkkkkkkGGkk',
      '......kkGGGGkkkkkkkkGGGGkk',
      '......kkkGGGGGGGGGGGGGGkkk',
      '.......kkkkkGGGGGGGGkkkkk',
      '........kkkkkkkkkkkkkkkk',
      '...........kkkkkkkkkk',
    ],
    hoop: [
      '......kkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwrrrrrrrrwwwWWkk',
      '.....kkwwwwwrrwwwwrrwwwWWkk',
      '.....kkwwwwwrrwwwwrrwwwWWkk',
      '.....kkwwwwwrrwwwwrrwwwWWkk',
      '.....kkwwwwwrrrrrrrrwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkkkkkkkkkGgkkkkkkkkkk',
      '......kkkkrrrrrrrrrrrrkkkk',
      '.......kkrkkkkkGgkkkkkrkk',
      '.......kkkrrrrrrrrrrrrkkk',
      '........kkWGWwwwwwwGWWkk',
      '........kkkGWwwwwwwGWkkk',
      '.........kkGGwwwwwGGGkk',
      '.........kkWGwwwwGGWGkk',
      '.........kkkGWwwGGWWGkk',
      '..........kkGWWWGWWWGkkk',
      '..........kkkGkGgGkkkGkk',
      '.........kkkkkkGgkkkkkkk',
      '........kkkkggggKKKKkkkk',
      '........kkgggKKKKKKKKKkk',
      '........kkKKKKKKKKKKKKkk',
      '........kkkkKKKKKKKKkkkk',
      '.........kkkkkkkkkkkkkk',
      '...........kkkkkkkkkk',
    ],
    lunchbox: [
      '',
      '',
      '',
      '.............kkkkkk',
      '...........kkkkkkkkkk',
      '..........kkkkKKKKkkkk',
      '.........kkkKKKKKKKKkkk',
      '.........kkKKkkkkkkKKkk',
      '......kkkkkKKkkkkkkKKkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkRRRRRRRRRRRRRRRRRRRMkk',
      '...kkkRRRRRRRRRRRRRRRRRRRMMkk',
      '...kkRRRRRRRRRRRRRRRRRRRMMMkk',
      '...kkRRrrrrrrrgggrrrrrrrMMMkk',
      '...kkRRrrrrrrrgggrrrrrrrMMMkk',
      '...kkRRrrrrrrrrrrrrrrrrrMMMkk',
      '...kkRRrrrrrrrrrrrrrrrrrMMMkk',
      '...kkRRrrwwwwwwwwwwwwrrrMMMkk',
      '...kkRRrrwwwwwwwwwwwwrrrMMMkk',
      '...kkRRrrwwkkkkkkkkwwrrrMMMkk',
      '...kkRRrrwwwwwwwwwwwwrrrMMMkk',
      '...kkRRrrwwkkkkkwwwwwrrrMMMkk',
      '...kkRRrrwwwwwwwwwwwwrrrMMMkk',
      '...kkRRrrwwwwwwwwwwwwrrrMMMkk',
      '...kkRRrrrrrrrrrrrrrrrrrMMMkk',
      '...kkRRrrrrrrrrrrrrrrrrrMMkkk',
      '...kkRRrrrrrrrrrrrrrrrrrMkkk',
      '...kkRRrrrrrrrrrrrrrrrrrkkk',
      '...kkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkk',
    ],
    gumball: [
      '...........kkkkkkkkkk',
      '...........kkRRRRRRkk',
      '.........kkkkrrrrrrkkkk',
      '........kkkkwwwwwiiikkkk',
      '.......kkkwwwwwwiiiiiikkk',
      '......kkkwwwwwwiiiiiiiikkk',
      '.....kkkwwwwwRRiiiiiiiiikkk',
      '.....kkwwwwwiRRiiiiiiiiiikk',
      '.....kkwwwwiiiiiooiiiiiiikk',
      '.....kkwwwiirriiooiiiiiiUkk',
      '.....kkwwiiirriiiiiiEEiUUkk',
      '.....kkwiiiiiiiiiiiiEEUUUkk',
      '.....kkiiiiiiiiiiiiiiUUUUkk',
      '.....kkiiiiiiiUUiiiiUUUUUkk',
      '.....kkiiiiiiiUUiirrUUUUUkk',
      '.....kkkiiiooiiiiirrUwwUkkk',
      '......kkkiiooiiiEEUUUwwkkk',
      '.......kkkiiiiiiEEUUUUkkk',
      '.......kkkkkiiUUUUUUkkkkk',
      '.......kkRRRRRRRRRRRRRRkk',
      '......kkkrrrrrrrrrrrrrrkkk',
      '......kkrrrrrrGGGGrrrrrrkk',
      '......kkrrrrrrggggrrrrrrkk',
      '......kkrrrrrrgkkgrrrrrrkk',
      '......kkrrrrrrggggrrrrrrkk',
      '.....kkkrrrrrrrrrrrrrrrrkkk',
      '.....kkMMMMMMMMMMMMMMMMMMkk',
      '.....kkMMMMMMMMMMMMMMMMMMkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
    ],
    button: [
      '',
      '',
      '',
      '',
      '',
      '...........kkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '........kkkkRRRRrrrrkkkk',
      '.......kkkRRRRrrrrrrrrkkk',
      '.......kkRRRwwrrrrrrrrrkk',
      '.......kkRRrrrrrrrrrrrMkk',
      '.......kkRrrrrrrrrrrMMMkk',
      '......kkkrrrrrrrrrrMMMMkkk',
      '.....kkkggrrrrrrrrrrrMKKkkk',
      '.....kkggKKrrrrrrrrrrKKKKkk',
      '.....kkkKKKKKKKKKKKKKKKKkkk',
      '......kkkKKKKKKKKKKKKKKkkk',
      '.......kkKoooKKKoooKKKokk',
      '.......kkoooKKKoooKKKookk',
      '.......kkooKKKoooKKKoookk',
      '.......kkoKKKoooKKKoooKkk',
      '.......kkKKKoooKKKoooKKkk',
      '.......kkKKoooKKKoooKKKkk',
      '.......kkKoooKKKoooKKKokk',
      '.......kkoooKKKoooKKKookk',
      '.......kkooKKKoooKKKoookk',
      '.......kkoKKKoooKKKoooKkk',
      '.......kkKKKoooKKKoooKKkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
    ],
    bell: [
      '',
      '',
      '',
      '',
      '.............kkkkkk',
      '............kkkkkkkk',
      '............kkwwGGkk',
      '............kkwGGGkk',
      '............kkGGGGkk',
      '............kkGGGGkk',
      '............kkkGgkkk',
      '...........kkkkGgkkkk',
      '.........kkkkkkGgkkkkkk',
      '........kkkkooooooookkkk',
      '.......kkkyooooooooooqkkk',
      '......kkkyyooooooooooqqkkk',
      '.....kkkyyyooooooooooqqqkkk',
      '.....kkyyyyooooooooooqqqqkk',
      '....kkkyyyyooooooooooqqqqkkk',
      '....kkyyyyyooooooooooqqqqqkk',
      '....kkyyyyyooooooooooqqqqqkk',
      '....kkyyyyyooooooooooqqqqqkk',
      '...kkkyyyyyooooooooooqqqqqkkk',
      '..kkkNNKKKKKKKKKKKKKKKKKKnnkkk',
      '..kkNNNNnnKKKKKKKKKKKKnnnnhhkk',
      '..kkNnnnnnnnnnnnnnnnnnnhhhhhkk',
      '..kkknnnnnnnnnnnnnnnhhhhhhhkkk',
      '...kkkknnnnnnnnnnhhhhhhhhkkkk',
      '....kkkkkknnnnhhhhhhhhkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
    ],
    firstaid: [
      '',
      '',
      '',
      '',
      '............kkkkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkkkKKKKKKkkkk',
      '.........kkKKKkkkkKKKkk',
      '.........kkKKkkkkkkKKkk',
      '.....kkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkwwwwwwwwwwwwwwwwwwwwwGkk',
      '..kkkwwwwwwwwwwwwwwwwwwwwwGGkk',
      '..kkwwwwwwwwwwwwwwwwwwwwwGGGkk',
      '..kkwWWWWWWWWWWWWWWWWWWWWGGGkk',
      '..kkwWWWWWWWWWWWWWWWWWWWWGGGkk',
      '..kkwWWWWWWWRRRRRWWWWWWWWGGGkk',
      '..kkwWWWWWWWrrrrrWWWWWWWWGGGkk',
      '..kkwWWWWWWWrrrrrWWWWWWWWGGGkk',
      '..kkwWWWWrrrrrrrrrrrWWWWWGGGkk',
      '..kkwWWWWrrrrrrrrrrrWWWWWGGGkk',
      '..kkwWWWWrrrrrrrrrrrWWWWWGGGkk',
      '..kkwWWWWrrrrrrrrrrrWWWWWGGGkk',
      '..kkwWWWWrrrrrrrrrrrWWWWWGGGkk',
      '..kkwWWWWWWWrrrrrWWWWWWWWGGGkk',
      '..kkwWWWWWWWrrrrrWWWWWWWWGGkkk',
      '..kkwWWWWWWWrrrrrWWWWWWWWGkkk',
      '..kkwWWWWWWWWWWWWWWWWWWWWkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkkkkkkkkkkkkkkkkkkk',
    ],
    plaque: [
      '',
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkNNNNNNNNNNNNNNNNNNNNNNNNNNkk',
      '.kkNnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      '.kkNnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      '.kkNnnyyyyyyyyyyyyyyyyyyyynnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyoohhhhhhhhhhhhhhooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyoooohhhhhhhhhhooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyooooohhhhhhhhoooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnyooooooooooooooooooqnnnkk',
      '.kkNnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      '.kkNnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      '.kkNnnnnnnnnnnnnnnnnnnnnnnnnnkk',
      '.kkkkkkknnnnnnnnnnnnnnnnkkkkkkk',
      '..kkkkkknnnnnnnnnnnnnnnnkkkkkk',
      '.....kknnnnnnnnnnnnnnnnnnkk',
      '.....kknnnnnnnnnnnnnnnnnnkk',
      '....kkknnnnnnnnnnnnnnnnnnkkk',
      '....kkhhhhhhhhhhhhhhhhhhhhkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
    ],
    trophy: [
      '',
      '......kkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkyyyyyyyyyyyyyyyyyykkkk',
      '..kkkkoyyyyooooooooooqqqqokkkk',
      '.kkkoooyyyyooooooooooqqqqoookkk',
      '.kkookkyyyyooooooooooqqqqkkookk',
      '.kkookkyyyyooooooooooqqqqkkookk',
      '.kkokkkyyyyooooooooooqqqqkkkokk',
      '.kkokkkyyyyooooooooooqqqqkkkokk',
      '.kkookkkyyyyooooooooqqqqkkkookk',
      '.kkookkkoyyyooooooooqqqokkkookk',
      '.kkkoooookyyyooooooqqqkoooookkk',
      '..kkkkokkkkyyooooooqqkkkkokkkk',
      '...kkkkkkkkyyyooooqqqkkkkkkkk',
      '.....kkk.kkkyyooooqqkkk.kkk',
      '..........kkkyyoooqkkk',
      '...........kkkyoookkk',
      '.........kkkkkyoookkkkk',
      '........kkkkkkyoookkkkkk',
      '.......kkkyyyyyyyyyyyykkk',
      '......kkkkooooooooooookkkk',
      '......kknnnnnnnnnnnnnnnnkk',
      '......kkTTTTTTTTTTTTTTTTkk',
      '......kkTTTTooooooooTTTTkk',
      '......kkTTTTooooooooTTTTkk',
      '......kkTTTTTTTTTTTTTTTTkk',
      '......kkTTTTTTTTTTTTTTTTkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
    ],
    golfbag: [
      '............kkkkkkkkkkkkkkk',
      '.........kkkkkGGGGkkkRRrrkkk',
      '........kkkkkkGGGGkkRRrrrrkk',
      '........kkKKKKGGGGkkRrrrrrkk',
      '........kkKKKKkgkkGGrrrrrrkk',
      '........kkKKKKkgkkGGrrrrrrkk',
      '........kkkgkkkgkkGGGrrrrkkk',
      '........kkkgkkkgkkkgkkrrkkk',
      '.......kkkKKKKKKKKKKKKrrkk',
      '.......kkKKKKKKKKKKKKKKrkk',
      '.......kkKKKKKKKKKKKKKKrkk',
      '.......kkUKKKKKKKKKKKKukkk',
      '.......kknnUuuuuuuuuuuukk',
      '.......kknnnuuuuuuuuuuukk',
      '.......kkUnnnuuuuuuuuuukk',
      '.......kkwwnnnwwwwwwwwwkk',
      '.......kkwwwnnnwwwwwwwwkk',
      '.......kkUUUunnnuuuuuuukk',
      '.......kkUUUuunnnuuuuuukk',
      '.......kkUUUuuunnnuuuuukk',
      '.......kkUUUuuuunnnuuuukk',
      '.......kkUUUuuuuunnnuuukk',
      '.......kkwwwwwwwwwnnnwwkk',
      '.......kkUUUuuuuuuunnnukk',
      '.......kkUUUuuuuuuuunnnkkk',
      '.......kkUUUuuuuuuuuunnnkk',
      '.......kkUUUuuuuuuuuuunnkk',
      '.......kkkUUuuuuuuuuuukkkk',
      '........kkkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
    ],
    chessking: [
      '.............kkkkkk',
      '............kkkgKkkk',
      '...........kkkkKKkkkk',
      '...........kkgKKKKKkk',
      '...........kkKKKKKKkk',
      '...........kkkkKKkkkk',
      '..........kkkgggKKKkkk',
      '.........kkkgggKKKKKkkk',
      '.........kkggKKKKKKKKkk',
      '.........kkgKKKKKKKKKkk',
      '.........kkKKKKKKKKKKkk',
      '........kkkkKKKKKKKKkkkk',
      '........kkggggggggggggkk',
      '........kkKKKKKKKKKKKKkk',
      '........kkkkKKKKKKKKkkkk',
      '.........kkggKKKKKKKkkk',
      '.........kkgKKKKKKKKKkk',
      '.........kkgKKKKKKKKKkk',
      '........kkkgKKKKKKKKKkkk',
      '........kkgKKKKKKKKKKKkk',
      '........kkgKKKKKKKKKKKkk',
      '.......kkkgKKKKKKKKKKKkkk',
      '......kkkKgKKKKKKKKKKKKkkk',
      '.....kkkkggggggKKKKKKKKkkkk',
      '....kkkgggggKKKKKKKKKKKKKkkk',
      '....kkgggggggggggggggggggKkk',
      '....kkkKKKKKKKKKKKKKKKKKKkkk',
      '.....kkkkKKKKKKKKKKKKKKkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '........kkkkkkkkkkkkkkkk',
    ],
    checkers: [
      '',
      '',
      '...........kkkkkkkkkk',
      '..........kkkkkkkkkkkk',
      '.........kkkookookookkk',
      '.......kkkkkooooooookkkkk',
      '......kkkkggooooooooggkkkk',
      '.....kkkggRyyyyyyyyyyyggkkk',
      '.....kkggRRoooooooooooRggkk',
      '.....kkgggRRRRRRRRRRRRggKkk',
      '.....kkggggggRRRRRRgggKKKkk',
      '.....kkkgggKKKKKKKKKKKKKkkk',
      '.....kkRRRgKKKKKKKKKKKRRrkk',
      '.....kkRRRRRRRRRRRRRRRRrrkk',
      '.....kkkRRRrRRRRRRRRrrrrkkk',
      '.....kkggRRrrrrrrrrrrrrgKkk',
      '.....kkgggggrrrrrrrrggggKkk',
      '.....kkkgggggggggggggKKKkkk',
      '.....kkRgggKKKKKKKKKKKKKrkk',
      '.....kkRRRRKKKKKKKKKKRRRrkk',
      '.....kkkRRRRRRRRRRRRRRrrkkk',
      '.....kkkRRRrrrrrrrrrrrrrkkk',
      '.....kkgggRrrrrrrrrrrrggKkk',
      '.....kkggggggggggggggggKKkk',
      '.....kkkgggKKggggggKKKKKkkk',
      '.....kkRRggKKKKKKKKKKKKRrkk',
      '.....kkRRRRRRKKKKKKRRRRrrkk',
      '.....kkkRRRRRRRRRRRRRrrrkkk',
      '......kkkRRrrrrrrrrrrrrkkk',
      '.......kkkkrrrrrrrrrrkkkk',
      '........kkkkkkkkkkkkkkkk',
      '..........kkkkkkkkkkkk',
    ],
    lucky7: [
      '',
      '......kkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkyyyyyyyyyyyyyyyyyykk',
      '.....kkyoooooooooooooooookk',
      '.....kkyoooooooooooooooookk',
      '.....kkyoooooooooooooooookk',
      '.....kkyoooooooooooooooookk',
      '.....kkyoooooooooooooooookk',
      '.....kkkkkkkkkkkkkyyooooqkk',
      '......kkkkkkkkkkkyyooooqkkk',
      '..............kkkyoooooqkk',
      '..............kkyyooooqkkk',
      '.............kkkyooooqkkk',
      '.............kkyyooooqkk',
      '............kkkyooooqkkk',
      '............kkyyooooqkk',
      '...........kkkyooooqkkk',
      '...........kkyyooooqkk',
      '..........kkkyooooqkkk',
      '..........kkyyoooqkkk',
      '.....kkkkkkkyooooqkkkkkkkkk',
      '....kkkkkkkoyoooqkkkkkkkkkkk',
      '....kkRRRRRRRRRRRRRRRRRRRRkk',
      '....kkrrrrrrrrrrrrrrrrrrrrkk',
      '....kkrrrrrrrrrrrrrrrrrrrrkk',
      '....kkrrrrrrrrrrrrrrrrrrrrkk',
      '....kkMMMMMMMMMMMMMMMMMMMMkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
    ],
    acecard: [
      '......kkkkkkkkkkkkkkkkkkkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '.....kkwwwwwwwwwwwwwwwwwwkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwkwwwwwwwwwwwwWWkk',
      '.....kkwwkwkwwwwwwwwwwwWWkk',
      '.....kkwwkkkwwwwwwwwwwwWWkk',
      '.....kkwwkwkwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwkkwwwwwwWWkk',
      '.....kkwwwwwwwkkkkwwwwwWWkk',
      '.....kkwwwwwwkkkkkkwwwwWWkk',
      '.....kkwwwwwkkkkkkkkwwwWWkk',
      '.....kkwwwwkkkkkkkkkkwwWWkk',
      '.....kkwwwkkkkkkkkkkkkwWWkk',
      '.....kkwwwkkkkkkkkkkkkwWWkk',
      '.....kkwwwkkkkkkkkkkkkwWWkk',
      '.....kkwwwkkkkkkkkkkkkwWWkk',
      '.....kkwwwwkkkkkkkkkkwwWWkk',
      '.....kkwwwwwwkwkkwkwwwwWWkk',
      '.....kkwwwwwwwkkkkwwwwwWWkk',
      '.....kkwwwwwwwkkkkwwwwwWWkk',
      '.....kkwwwwwwwkkkkwwwkwWWkk',
      '.....kkwwwwwwkkkkkkwkwkWWkk',
      '.....kkwwwwwwwwwwwwwkkkWWkk',
      '.....kkwwwwwwwwwwwwwkwkWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkwwwwwwwwwwwwwwwwWWkk',
      '.....kkWWWWWWWWWWWWWWWWWWkk',
      '.....kkkkkkkkkkkkkkkkkkkkkk',
      '......kkkkkkkkkkkkkkkkkkkk',
    ],
    chips: [
      '',
      '',
      '..............kkkkkkkkkk',
      '............kkkkkkkkkkkkkk',
      '...........kkkkUUUUUUUUkkkk',
      '...........kkUUwwUUUUwwUUkk',
      '...........kkUUwwUUUUwwUUkk',
      '...........kkUUUUUUUUUUuukk',
      '...........kkwUUuuuwwuuwUkk',
      '...........kkUUUUUUUUUUUUkk',
      '...........kkUUUUUUUUUUuukk',
      '.....kkkkkkkkwUUuuuwwuuwUkk',
      '...kkkkkkkkkkUUUUUUUUUUUUkk',
      '..kkkkRRRRRRRUUUUUUUUUUuukk',
      '..kkRRwwRRRRwwUUuuuwwuuwUkk',
      '..kkRRwwRRRRwUUUUUUUUUUUUkk',
      '..kkRRRRRRRRRUUUUUUUUUUuukkk',
      '..kkwRRrrrwwrwUUuuuwwuuwUkkkkk',
      '..kkRRRRRRRRRUUUUUUggggggggkkkk',
      '..kkRRRRRRRRRUUUUggwwggggwwggkk',
      '..kkwRRrrrwwrwUUuggwwggggwwggkk',
      '..kkRRRRRRRRRUUUUggggggggggKKkk',
      '..kkRRRRRRRRRUUUUwggKKKwwKKwgkk',
      '..kkwRRrrrwwrwwUuggggggggggggkk',
      '..kkRRRRRRRRRRRRkggggggggggKKkk',
      '..kkRRRRRRRRRRrrkwggKKKwwKKwgkk',
      '..kkwkRrrrwwrrwkkggggggggggggkk',
      '..kkkkkkkkkkkkkkkggggggggggKKkk',
      '...kkkkkkkkkkkkkkwkgKKKwwKKwkkk',
      '...............kkkkkkkkkkkkkkk',
      '................kkkkkkkkkkkkk',
    ],
    helmet: [
      '',
      '............kkkkkkkk',
      '.........kkkkkkkkkkkkkk',
      '........kkkkkRRRRRrkkkkk',
      '.......kkkRRRRRRRrrrrrkkkkkkk',
      '......kkkRRRRRRRrrrrrrrkkkkkkk',
      '.....kkkRRRRRRRrrrwkwkwkwkwkkk',
      '....kkkRRRRRRrrrrrkwkwkwkwkwkk',
      '....kkRRRRRRrrrrrrrrrrrrrrkkkk',
      '...kkkRRRRRrrrrrrrrrrrrrrrkkk',
      '...kkuuuuuuuuuurrrrrrrrrrrrkk',
      '...kkuiiiiiuuuuurrrrrrrrrrMkk',
      '...kkuUUuuuuuuuuurrrrrrrMMMkk',
      '...kkuUUuuuuuuuuurrrrrrMMMMkk',
      '...kkuuuuuuuuuuuurrrrrMMMMMkk',
      '...kkuuuuuuuuuuuurrrrMMMMMMkk',
      '...kkuuuuuuuuuuuurrrMMMMMMkkk',
      '...kkkrrrrrrrrrrrrrMMMMMMMkk',
      '....kkkrrrrrrrrrrrMMMMMMMkkk',
      '...kkkkkrrrrrrrrrMMMMMMMkkkkk',
      '...kkKKKKKKKKKKKKKKKKKKKKKKkk',
      '...kkKKKKKKKKKKKKKKKKKKKKKKkk',
      '...kkKKKKKKKKKKKKKKKKKKKKKKkk',
      '...kkkkkkkkkkkKKKKkkkkkkkkkkk',
      '....kkkkkkkkkkKKKKkkkkkkkkkk',
      '.......kkkkgggggKKKKKkkkk',
      '.......kkgggKKKKKKKKKKKkk',
      '.......kkKKKKKKKKKKKKKKkk',
      '.......kkkkKKKKKKKKKKkkkk',
      '........kkkkkkkkkkkkkkkk',
      '..........kkkkkkkkkkkk',
    ],
    brick: [
      '',
      '',
      '...........kkkkkk...kkkkkk',
      '..........kkkkkkkk.kkkkkkkk',
      '.........kkkwwRRkkkkkwwRRkkk',
      '.........kkwRRRRRkkkwRRRRRkk',
      '.......kkkkRRRRRMkkkRRRRRMkkk',
      '......kkkkkRrrrrMkkkRrrrrMkkkk',
      '......kkwwRRrrrrRwwRRrrrrRRMkk',
      '.....kkkRRRRRRRRRRRRRRRRRRMMkk',
      '....kkkRRrrrrMRRRRrrrrMRRMMMkk',
      '...kkkRRRrrrrMRRRRrrrrMRMMMMkk',
      '..kkkRRRRRRRRRRRRRRRRRRMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMMkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMMkkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMMkkk',
      '..kkRrrrrrrrrrrrrrrrrrMMMkkk',
      '..kkRrrrrrrrrrrrrrrrrrMMkkk',
      '..kkRrrrrrrrrrrrrrrrrrMkkk',
      '..kkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkkkkkkkkkkkkkkkkk',
    ],
    cablereel: [
      '',
      '',
      '.......kkkkkkkkkkkkkkkkkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkyyyyyyyNNNNNNNNNkkkkk',
      '..kkkyyyyyyyNNNNNNNNNNNNNNNkkk',
      '..kkyyyyNNNNNhhhhhhNNNNNNNnnkk',
      '..kkyNNNNNNNNhhhhhhNNNNnnnnnkk',
      '..kkkNNNNNNNNNNNNNNnnnnnnnnkkk',
      '...kkkkkNNNNNNNNnnnnnnnnukkkk',
      '....kkkkiiiuuuuuuuuuuuuuukkk',
      '......kkiiiUUUUUUUUUUuuuukk',
      '......kkiiiuuuuuuuuuuuuuukk',
      '......kkiiiUUUUUUUUUUuuuukk',
      '......kkiiiuuuuuuuuuuuuuukk',
      '......kkiiiUUUUUUUUUUuuuukk',
      '......kkiiiuuuuuuuuuuuuuukk',
      '......kkiiiUUUUUUUUUUuuuukkk',
      '......kkiiiuuuuuuuuuuuuuUUkkk',
      '......kkiiiUUUUUUUUUUuuuUUUkkk',
      '......kkiiiuuuuuuuuuuuuuuUUUkkk',
      '....kkkkiiiUUUUUUUUUUuuuukUUUkkk',
      '...kkkkkiiiuuuuuuuuuuuuuukkUUUkk',
      '..kkkNNNiiiUUUUUUUUUUuuuunnkUUkk',
      '..kkNNNNiiiuuuuuuuuuuuuuunhhUUkk',
      '..kkNnnnnnnnnnnnnnnnnnnhhhhhUUkk',
      '..kkknnnnnnnnnnnnnnhhhhhhhhkUUkk',
      '...kkkkknnnnnnnnhhhhhhhhkkkkUUkk',
      '....kkkkkkkkkkkkkkkkkkkkkkkkUUkk',
      '.......kkkkkkkkkkkkkkkkkk.kkkkkk',
      '...........................kkkk',
    ],
    deskfan: [
      '..........kkkkkkkkkkkk',
      '........kkkkkggggggkkkkk',
      '.......kkkkggggggggggkkkk',
      '......kkkgggiiiUUiiigggkkk',
      '......kkgggiiiUUUUiiigggkk',
      '.....kkkggiiiGGGGGGiiiggkkk',
      '.....kkggiiGGUUUUuuGGiiggkk',
      '....kkkgiiiGiUUUuuiiGiiigkkk',
      '....kkggiiGiiUUuuiiiiGiiggkk',
      '....kkggiiGiiiggKKiiiGiiggkk',
      '....kkggiiGiiigKKKiiiGUiggkk',
      '....kkggiiGiUUKKKKiiUGUiggkk',
      '....kkggiiGUUUKKKKiUUGUuggkk',
      '....kkggiiGUUUUiiiUUUGuuggkk',
      '....kkkgiUUGUUuiiiUUGuuigkkk',
      '.....kkggUUGGuuiiiiGGuuggkk',
      '.....kkkggUUuGGGGGGiiiggkkk',
      '......kkgggiiiiiiiiiigggkk',
      '......kkkgggiiiiiiiigggkkk',
      '.......kkkkggggggggggkkkk',
      '........kkkkkggggggkkkkk',
      '..........kkkkkgKKkkkk',
      '.........kkkkkkgKKkkkkk',
      '.......kkkkkkkkgKKkkkkkkk',
      '......kkkkggggggKKKKKKkkkk',
      '......kkgggKKKKgKKKKKKKKkk',
      '......kkKKKKKKKKKKKKKKKKkk',
      '......kkkkKKKKKKKKKKKKkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.........kkkkkkkkkkkkkk',
    ],
    iceblock: [
      '',
      '',
      '',
      '........kkkkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkkkkkk',
      '......kkkwwwwwwwwwwwwwwwwwUkk',
      '.....kkkwwwwwwwwwwwwwwwwwUUkk',
      '....kkkwwwwwwwwwwwwwwwwwUUUkk',
      '...kkkwwwwwwwwwwwwwwwwwUUUUkk',
      '..kkkwwwwwwwwwwwwwwwwwUUUUUkk',
      '..kkwwwwwwwwwwwwwwwwwUUUUUUkk',
      '..kkwiiiwwiiiiiiiiiiiUUUUUUkk',
      '..kkwiiwiiiiiiiiiiiiiUUUUUUkk',
      '..kkwiiwiiiiiiiiiiiiiUUUUUUkk',
      '..kkwiiiiiiiiiiiiiiiiUUUUUUkk',
      '..kkwiiiwiiiwiiiwiiiiUUUUUUkk',
      '..kkwiiiiwiiwiiwiiiiiUUUUUUkk',
      '..kkwiiiiiwiwiwiiiiiiUUUUUUkk',
      '..kkwiiiiiiwwwiiiiiiiUUUUUUkk',
      '..kkwiiiwwwwwwwwwiiiiUUUUUUkk',
      '..kkwiiiiUUwwwiiiiiiiUUUUUUkk',
      '..kkwiiiUiwiwiwiiiiiiUUUUUUkk',
      '..kkwiiUUwiiwiiwiiiiiUUUUUUkk',
      '..kkwiiUwiiiwiiiwiiiiUUUUUkkk',
      '..kkwiUiiiiiiiiiiiiiiUUUUkkk',
      '..kkwiUiiiiiiiiiiiiiiUUUkkk',
      '..kkwiiiiiiiiiiiiiiiiUUkkk',
      '..kkwiiiiiiiiiiiiiiiiUkkk',
      '..kkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkkkkkkkkkkkkkkkkk',
    ],
    ducttape: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '..........kkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
      '.....kkkkkkwwwwwwwGGGkkkkkk',
      '....kkkkwwwwwwwwGGGGGGGGkkkk',
      '...kkkwwwwwwwwGGGGGGGGGGGGkkk',
      '..kkkwwwwwwwNNNNNNNNGGGGGGGkkk',
      '..kkwwwwwwNNNkkkkkkNNNGGGGGGkk',
      '..kkwwwwGGNNkkkkkkkkNNGGGGGGkk',
      '..kkwwGGGGNNkkkkkkkkNNGGGGGGkk',
      '..kkGGGGGGNNNkkkkkkNNNGGGGGGkk',
      '..kkGGGGGGGGNNNNNNNNGGGGGGGKkk',
      '..kkGGGGGGGGGGGGGGGGGGGGGGKKkk',
      '..kkGGGGGGGGGGGGGGGGGGGGKKKKkk',
      '..kkGGGGGggGGGGGGGGGGggKKKKKkk',
      '..kkGGGGGggggggggggggggKKKKKkk',
      '..kkkGGGGggggggggggggggKKKKkkk',
      '...kkkGGGggggggggggggggKKKkkk',
      '....kkkkGggggggggggggggKkkkk',
      '.....kkkkkkggggggggggGGGkkk',
      '.......kkkkkkkkkkkkwGGGGkk',
      '..........kkkkkkkkkwGGGGkk',
      '.................kkkkkkkkk',
      '..................kkkkkkk',
    ],
    airfilter: [
      '',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kkyyyyyyyyyyyyyyyyyyyyyyyyyykk',
      '.kkyooooooooooooooooooooooooqkk',
      '.kkyooooooooooooooooooooooooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooggggggggggggggggggggooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooGwWGwWGwWGwWGwWGwWGwooqkk',
      '.kkyooooooooooooooooooooooooqkk',
      '.kkyooooooooooooooooooooooooqkk',
      '.kkyqqqqqqqqqqqqqqqqqqqqqqqqqkk',
      '.kkkkkkkknnnnnnnnnnnnnnkkkkkkkk',
      '..kkkkkkknnnnnnnnnnnnnnkkkkkkk',
      '......kknnnnnnnnnnnnnnnkkk',
      '......kkhhhhhhhhhhhhhhhhkk',
      '......kkkkkkkkkkkkkkkkkkkk',
      '.......kkkkkkkkkkkkkkkkkk',
    ],
  };
  const DECOR_CH = {};
  Object.keys(DECOR32).forEach((k, i) => {
    const ch = String.fromCharCode(0x100 + i);
    DECOR_CH[k] = ch; OBJ32['decor.' + k] = DECOR32[k]; OBJ_AT[ch] = 'decor.' + k;
  });
  // what's standing on map tile (x, y), if it's a picture: its name in OBJ32
  function objAt(get, x, y) {
    const t = get(x, y);
    switch (t) {
      case 'd': return (x * 7 + y * 5) % 3 === 0 ? 'papers' : null;
      case '7': return get(x, y + 1) === '7' ? 'slotTop' : 'slotBottom';
      case '6': return get(x, y + 1) === '6' ? 'raceTop' : 'raceBottom';
      case 'P': return get(x, y + 1) === 'P' ? 'coffeeTop' : 'coffeeBottom';
      case 'Z': return y & 1 ? 'candyB' : 'candy';
      case 'j': return (x + y) % 3 === 0 ? 'floorPartsB' : 'floorParts';
      case 'q': { // each 'q' tile shows its third of the treadmill, counting from the left
        let i = 0;
        while (get(x - 1 - i, y) === 'q') i++;
        return 'treadmill' + (i % 3);
      }
    }
    return OBJ_AT[t] || null;
  }
  // lay what's standing on map tile (x, y) over a 32 x 32 buffer: a picture, or something drawn by code
  function standing32(b, get, x, y) {
    const t = get(x, y), k = objAt(get, x, y);
    if (k) lay32Over(b, OBJ32[k], 0, 0);
    else if (PAINT32[t]) {
      const bb = new Array(1024).fill(null);
      PAINT32[t](bb, get, x, y, t);
      bb.forEach((c, i) => { if (c) b[i] = c; });
    }
  }
  // a whole floor: a canvas marked hi: 2 (see js/game.js)
  function renderFloor(floor) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const cv = document.createElement('canvas');
    cv.width = W * 32; cv.height = H * 32; cv.hi = 2;
    renderFloorPart(floor, cv, 0, 0, W - 1, H - 1);
    return cv;
  }
  // Tiles x1 to x2 and y1 to y2 of a floor painted again, over the canvas renderFloor made for it,
  // for a part of the map that changes as you play (the furniture in your Secret Lair). Anything
  // that joins up with its neighbours looks at the tiles round it, so take in a tile more each way
  // than what's changed. A floor with rugs (floor.rugs, see rug32) has them laid on it.
  function renderFloorPart(floor, cv, x1, y1, x2, y2) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? ' ' : floor.tiles[y][x];
    const ctx = cv.getContext('2d'), img = ctx.createImageData((x2 - x1 + 1) * 32, (y2 - y1 + 1) * 32), pal = palette({ J: '#e4b47c' });
    for (let ty = y1; ty <= y2; ty++)
      for (let tx = x1; tx <= x2; tx++) {
        const b = structure32(get, floor.floor[ty][tx], tx, ty, floor.rugs);
        standing32(b, get, tx, ty);
        blit(img, b, (tx - x1) * 32, (ty - y1) * 32, pal, false);
      }
    ctx.putImageData(img, x1 * 32, y1 * 32);
  }

  // One tile drawn as if it were `ch` (used for things that change at runtime, like a
  // curtain being pulled open), with `over` swapping any colours.
  function renderTileAs(floor, x, y, ch, over) {
    const H = floor.tiles.length, W = floor.tiles[0].length;
    const get = (xx, yy) => (xx === x && yy === y) ? ch : (xx < 0 || yy < 0 || xx >= W || yy >= H) ? ' ' : floor.tiles[yy][xx];
    const b = structure32(get, floor.floor[y][x], x, y);
    standing32(b, get, x, y);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32; cv.hi = 2;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32);
    blit(img, b, 0, 0, palette(Object.assign({ J: '#e4b47c' }, over)), false);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ---------- dogs and the cat at 32 x 32 ----------
  // Each way a dog faces, standing and mid-step (from row DOG32.from); the cat curled up
  // asleep (from row DOG32.catFrom). Their own colours (h = coat, D = ears and darker patches,
  // y = chest and belly, u = collar) plus H, the
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
  function renderDog(look) {
    const { cat, ...c } = look, out = {};
    const pal = palette(Object.assign({ H: darker(c.h, 0.25), j: blend(c.h, '#ffffff', 0.35), R: '#f07878', o: '#f0c838', W: '#ffffff' }, c));
    const make = (rows, y0, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = new Array(1024).fill(null);
      lay32(b, rows, y0);
      blit(img, b, 0, 0, pal, flip);
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

  // ---------- reindeer at 32 x 32 ----------
  // Out in the parking lot at Christmas. Each way one faces, from the top down, with the legs
  // for standing and for mid-step apart so they can share a body. Their own colours (h = coat,
  // D = the far legs and the ears, y = belly, ruff and muzzle, u = collar) plus H, the coat in
  // shadow, j, a shine on it, Y, the belly in shadow, A and a, the antlers, R, the nose and
  // hooves, and o and O, the bell. There's no outline in these rows: picture32 adds it.
  const DEER_ANTLERS = [
    '',
    '',
    '.....A..A............A..A',
    '.....A..A............A..A',
    '.....AA.AA..........AA.AA',
    '......AAAa..........aAAA',
    '.......AAa..........aAA',
    '........AAa........aAA',
    '.........AA.jjjhhh.AA',
    '.....DDDD..jjhhhhhh..DDDD',
    '.....DDDDDjjhhhhhhhhDDDDD',
    '.......DDDjhhhhhhhhhHDDD',
  ];
  const DEER_FRONT = DEER_ANTLERS.concat([
    '..........hhkWhhhhkWhH',
    '..........hhkkhhhhkkHH',
    '..........hhhhyyyyhhHH',
    '...........hhyyyyyyHH',
    '...........hyyRRRRyyH',
    '............yyyRRyyy',
    '...........uuuuuuuuuu',
    '..........hhyyyooyyyHH',
    '..........hhhyyOOyyHHH',
    '..........hhhyyyyyyHHH',
    '..........hhhyyyyyyHHH',
    '..........hhHyyyyyyHHH',
    '..........HHHHHyyHHHHH',
  ]);
  const DEER_BACK = DEER_ANTLERS.concat([
    '..........hhhhhhhhhhhH',
    '..........hhhhhhhhhhHH',
    '..........hhhhhhhhhhHH',
    '...........hhhhhhhhHH',
    '...........hhhhhhhHHH',
    '............hhhhhHHH',
    '...........uuuuuuuuuu',
    '..........jjjhhhhhhhHH',
    '..........jhhhhhhhhHHH',
    '..........hhhhyyyyhHHH',
    '..........hhhyyyyyyHHH',
    '..........hhHyyyyyyHHH',
    '..........HHHHyyyyHHHH',
  ]);
  const DEER_SIDE = [
    '',
    '',
    '....A.....A..A',
    '....AA....A..A',
    '.....AA...AAAA',
    '......Aa..AA',
    '.......AA.Aa',
    '........AAa',
    '......jjjAajhDD',
    '.....jjhhhhhhhDD',
    '....jhhhkWhhhhD',
    '...jhhhhkkhhhhy',
    '..RRyyhhhhhhhyyy',
    '..RyyyyHHhhhhyyyj',
    '...yyyyyHhhhyyyjjjjjjjjjjjjjyy',
    '.....HHHHHhhuuhhhhhhhhhhhhhhyy',
    '..........yuuuhhhhhhhhhhhhhhhy',
    '..........yyoOhhhhhhhhhhhhhhH',
    '..........yyOhhhhhhhhhhhhhhHH',
    '..........yyyhhhhhhhhhhhhhHHH',
    '..........yyyHhhhhhhhhhhhHHHH',
    '...........yHHHyyyyyyyyyyHHHH',
    '...........HHHHYyyyyyyyYHHHHH',
  ];
  const DEER_LEGS = {
    // (both of these are for the front and the back: the mirror image is the other step)
    ahead: [
      '..........DDD......DDD',
      '..........DDD......DDD',
      '..........DDD......DDD',
      '..........RRR......RRR',
      '..........RRR......RRR',
    ],
    aheadStep: [
      '..........DDD......DDD',
      '..........DDD......DDD',
      '..........RRR......DDD',
      '..........RRR......RRR',
      '...................RRR',
    ],
    side: [
      '...........HHH.DDD....DDD.HHH',
      '...........HHH.DDD....DDD.HHH',
      '...........HHH.DDD....DDD.HHH',
      '...........HHH.DDD....DDD.HHH',
      '...........HHH.DDD....DDD.HHH',
      '...........RRR.RRR....RRR.RRR',
      '...........RRR.RRR....RRR.RRR',
    ],
    sideA: [
      '..........HHH...DDD..DDD...HHH',
      '..........HHH...DDD..DDD...HHH',
      '.........HHH....DDD..DDD...HHH',
      '.........HHH....DDD..DDD...HHH',
      '........HHH.....DDD..DDD...HHH',
      '........RRR.....RRR..RRR...RRR',
      '........RRR.....RRR..RRR...RRR',
    ],
    sideB: [
      '..........DDD.HHH....HHH...DDD',
      '..........DDD.HHH....HHH...DDD',
      '.........DDD..HHH....HHH...DDD',
      '.........DDD..HHH....HHH...DDD',
      '........DDD...HHH....HHH...DDD',
      '........RRR...RRR....RRR...RRR',
      '........RRR...RRR....RRR...RRR',
    ],
  };
  // A 32 x 32 picture from rows with no outline, any number of layers one over the other, and
  // the outline added round whatever's been filled in (so nothing's filled in on the outermost 2
  // pixels all round, which is where it goes).
  function picture32(layers, pal, flip) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32; cv.hi = 2;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = new Array(1024).fill(null);
    for (const rows of layers) lay32(b, rows, 0);
    const rows = [];
    for (let y = 2; y < 30; y++) rows.push(b.slice(y * 32 + 2, y * 32 + 30).map((c) => c || '.').join(''));
    const done = new Array(1024).fill(null);
    lay32(done, outlined32(rows), 0);
    blit(img, done, 0, 0, pal, flip);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function renderReindeer(look) {
    const pal = palette(Object.assign({ H: darker(look.h, 0.25), j: blend(look.h, '#ffffff', 0.3), Y: blend(look.y, '#5a463c', 0.28),
      A: '#e4d2a8', a: '#a88e62', R: '#2c1e1e', o: '#f0c838', O: '#b88a18', W: '#ffffff' }, look));
    const make = (body, legs, flip) => picture32([body.concat(legs)], pal, flip);
    const L = DEER_LEGS;
    return {
      down: [make(DEER_FRONT, L.ahead), make(DEER_FRONT, L.aheadStep), make(DEER_FRONT, L.aheadStep, true)],
      up: [make(DEER_BACK, L.ahead), make(DEER_BACK, L.aheadStep), make(DEER_BACK, L.aheadStep, true)],
      left: [make(DEER_SIDE, L.side), make(DEER_SIDE, L.sideA), make(DEER_SIDE, L.sideB)],
      right: [make(DEER_SIDE, L.side, true), make(DEER_SIDE, L.sideA, true), make(DEER_SIDE, L.sideB, true)],
    };
  }

  // ---------- the elf at 32 x 32 ----------
  // Who runs around the parking lot at Christmas, a head or so shorter than anybody else. Each way
  // he faces, the legs apart again, and the candy cane he carries as a layer of its own, since he
  // hasn't got it any more once you have. `dazed` is him sat in the snow with crossed-out eyes,
  // the cane dropped beside him. No outline in these rows either: picture32 adds it.
  const ELF_FRONT = ['', '', '', '', '', '', '', '',
    '.........oo',
    '.........ooGg',
    '...........gggg',
    '............ggggg',
    '............jgggggG',
    '...........jjggggggGG',
    '..........rrrrrrrrrrrr',
    '........ss.ssssssssss.ss',
    '.........sssssWkssssWksss',
    '...........ssskkssssskkS',
    '...........sssssssssssS',
    '............ssskkksSS',
    '...........rrrrrrrrrr',
    '...........jggggggggG',
    '..........sjggggggggGs',
    '...........yyyyooyyyy',
    '...........gggggggGGG',
    '...........ggGggGggGG',
  ];
  const ELF_BACK = ['', '', '', '', '', '', '', '',
    '.........oo',
    '.........ooGg',
    '...........gggg',
    '............ggggg',
    '............jgggggG',
    '...........jjggggggGG',
    '..........rrrrrrrrrrrr',
    '........ss.hhhhhhhhHH.ss',
    '.........sshhhhhhhhHHss',
    '...........hhhhhhhHHH',
    '...........hhhhhhHHHS',
    '............ssssssSS',
    '...........rrrrrrrrrr',
    '...........jggggggggG',
    '..........sjggggggggGs',
    '...........yyyyyyyyyy',
    '...........gggggggGGG',
    '...........ggGggGggGG',
  ];
  const ELF_SIDE = ['', '', '', '', '', '', '', '',
    '....................oo',
    '.................ggGoo',
    '...............ggggg',
    '.............gggggg',
    '............jggggggG',
    '...........jjgggggGG',
    '...........rrrrrrrrrr',
    '..........sssssssss.ss',
    '.........ssskWsssssss',
    '.........ssskksssssS',
    '........sssssssssssS',
    '...........ssksssSS',
    '............rrrrrr',
    '............jggggG',
    '...........sjgggGG',
    '............yyoyyy',
    '............gggGGG',
    '............gGgGgG',
  ];
  const ELF_DAZED = ['', '', '', '', '', '', '', '', '', '', '', '', '',
    '.......oo',
    '.......ooGg',
    '.........ggggg',
    '..........ggggggG',
    '.........jjggggggGG',
    '........rrrrrrrrrrrr',
    '......ss.sssssssssss.ss',
    '.......ssskskssskskss',
    '.........ssksssssksS',
    '.........skskssskskS',
    '..........ssskkkkSS',
    '..........rrrrrrrrr',
    '.........sjgggggggGs',
    '.........sjgggggggGs',
    '..........yyyyooyyy',
    '.......GGrrgggggGrrGG',
    '.......GGwwrr...rrwwGG',
  ];
  const below = (n, rows) => new Array(n).fill('').concat(rows);
  const ELF_LEGS = {
    ahead: below(26, ['............rr....rr', '............ww....ww', '...........GGGG..GGGG', '...........GGGG..GGGG']),
    aheadA: below(26, ['............rr....rr', '...........GGGG...ww', '...........GGGG..GGGG', '.................GGGG']),
    aheadB: below(26, ['............rr....rr', '............ww...GGGG', '...........GGGG..GGGG', '...........GGGG']),
    side: below(26, ['.............rrr', '.............www', '...........GGGGG', '...........GGGGG']),
    sideA: below(26, ['...........rr...rr', '..........ww.....ww', '........GGGG....GGG', '........GGG.....GGG']),
    sideB: below(26, ['............rr.rr', '............ww.ww', '..........GGGGGGGG', '...............GGG']),
  };
  // a candy cane with its hook at column x, standing from row 9 to the snow
  const elfCane = (x, hook) => {
    const pad = '.'.repeat(x), rows = [pad + hook[0], pad + hook[1], pad + hook[2]];
    for (let y = 12; y < 28; y++) rows.push('.'.repeat(x + hook[3]) + ((y >> 1) & 1 ? 'c' : 'w'));
    return below(9, rows);
  };
  const ELF_CANE = {
    down: elfCane(22, ['wwcc', 'c..w', 'c..c', 0]),
    up: elfCane(6, ['ccww', 'w..c', 'c..c', 3]),
    left: elfCane(3, ['wwcc', 'c..w', 'c..c', 3]),
    dazed: below(26, ['.........................wwcc', '.........................c..w', '.......................wwc..c', '.......................ccwwcc']),
  };
  function renderElf(cane) {
    const pal = palette({ g: '#3a9a4c', G: '#256b36', j: '#6cc47a', r: '#d0303a', s: '#f8d0a8', S: '#dca880', h: '#c86a2c', H: '#96501f',
      o: '#f0c838', w: '#f4f1ea', c: '#d0283a', y: '#5a3a22', W: '#ffffff' });
    const L = ELF_LEGS, make = (body, legs, way, flip) => picture32(cane ? [body, legs, ELF_CANE[way]] : [body, legs], pal, flip);
    return {
      down: [make(ELF_FRONT, L.ahead, 'down'), make(ELF_FRONT, L.aheadA, 'down'), make(ELF_FRONT, L.aheadB, 'down')],
      up: [make(ELF_BACK, L.ahead, 'up'), make(ELF_BACK, L.aheadA, 'up'), make(ELF_BACK, L.aheadB, 'up')],
      left: [make(ELF_SIDE, L.side, 'left'), make(ELF_SIDE, L.sideA, 'left'), make(ELF_SIDE, L.sideB, 'left')],
      right: [make(ELF_SIDE, L.side, 'left', true), make(ELF_SIDE, L.sideA, 'left', true), make(ELF_SIDE, L.sideB, 'left', true)],
      dazed: [make(ELF_DAZED, [], 'dazed')],
    };
  }

  // ---------- Halloween costumes at 32 x 32 ----------
  // Each is laid over the look (or the coworker) drawn bald, or with their own hair where
  // it says `own`, in the costume's colours (its `pal` in COSTUMES, then any more here). '.'
  // leaves what's underneath and '_' rubs it out (long hair under a mask). A
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
      blit(img, b, 0, 0, pal, flip);
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
  // a player in a costume, over the look they made
  function renderLookCostume(look, key) {
    return COSTUME32[key] ? costumeSheet32(look, key, lookColours(look)) : renderLook(look);
  }
  // a coworker in a costume (or the ghost, a sheet of its own)
  function renderCostume(gender, look, key) {
    if (gender === 'ghost') return renderGhost();
    return COSTUME32[key] ? costumeSheet32(COWORKER32[gender] || COWORKER32.male, key, look) : renderSprites(gender, look);
  }
  function renderGhost() {
    const pal = palette(), make = (rows, flip) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32; cv.hi = 2;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(32, 32), b = new Array(1024).fill(null);
      lay32(b, rows, 0);
      blit(img, b, 0, 0, pal, flip);
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
    LOOKS, UI, COSTUMES, DECOR_CH, renderFloor, renderFloorPart, renderSprites, renderCostume, renderDog, renderReindeer, renderElf, lightsShowing, BULBS, LIGHTS, renderMini, renderTileAs,
    LOOK: { skins: SKINS, hairs: HAIRS, hairColours: HAIR_COLOURS, hats: HATS, shirts: SHIRTS, shirtColours: SHIRT_COLOURS, pants: PANTS, pantsColours: PANTS_COLOURS, extras: EXTRAS, flairs: FLAIRS },
    LOOK_PARTS: LOOK_PARTS.map(([k, list]) => [k, list.length]), LOOK_ITEMS, CROWN, SANTA, ANTLERS, GHOST_MASK, HAUNTED_MASK, RIBBON, GOLD_RIBBON, CANDY_CANE, STAR_TRAIL, SWEEPER, CARD_STORM, BIG_COLS, BAUBLE32, SANTA_END32, SWEEPER32, lookFix, lookCode, lookFrom, lookLike, lookColours, renderLook, lookPixels, renderLookCostume,
    SWEATERS,
  };
})();
