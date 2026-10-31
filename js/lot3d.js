// The parking lot in 3D, for Christmas: the lot js/hd.js paints flat, built instead as a
// little cel-shaded diorama (three flat bands of light, thick black outlines) and seen
// from high up to the south, like an old Diablo game. It's laid out from the Parking Lot's
// rows in js/maps.js, a metre to a tile, and people are dressed from the same specs as the
// flat art (HD.person). It only draws: where everyone is and which way they face come from
// js/game.js, as they do for the flat lot.
// Needs Three.js (js/vendor/three.min.js), which js/game.js only fetches at Christmas.
//
//   const lot = LOT3D.create(floor, { touch })         // throws if there's no WebGL, or only a slow software one
//   lot.canvas                                          // goes on the page
//   lot.resize(cssWidth, cssHeight)
//   lot.setZoom(i, now)                                 // 0 far (the default), 1 mid, 2 close
//   lot.draw({ t, alpha, focus: [px, py], people: [{ key, spec, px, py, dir, walk, skate }] })
//   lot.toScreen(px, py, height)                        // -> [x, y] on the 320 x 240 screen
//   lot.drawGame(kind, f)                               // a winter game instead (js/winter3d.js) -> its stage, or null
//
// px, py are game pixels as everywhere in js/game.js (16 to a tile, a tile's top-left
// corner). t is the game's tick and alpha how far the screen is into the next one (0 to
// 1): everyone is drawn that far between where they were last tick and where they are
// now, so movement stays smooth however fast the screen refreshes. walk is -1 for someone
// coasting on skates (anything else: their legs follow how far they've actually gone).
// During a hockey game (js/hockey.js) draw also takes view ({ dist, pitch }: the camera
// lower than the zoom's) and puck ([px, py]), and each player face (which way they face,
// an angle as in FACING), stick ({ k, a, p, hand }: what they're doing with it), down (0
// to 1, knocked over), fall (which side they go over on), ring (their team's colour) and
// full (they have the puck: the ring is filled in).
window.LOT3D = (function () {
  const TAU = Math.PI * 2;
  const SW = 320, SH = 240;
  const FACING = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
  const BULBS = ['#ff4a4a', '#ffd23a', '#4ae06a', '#4aa8ff', '#ff7ad8', '#ff9a2a'];
  const CARS = ['#c8352f', '#2f6fc0', '#d4d8e0', '#2e7a52', '#f2f2f4', '#e0a030', '#6a4aa8', '#3a3f4a', '#2a9ab0'];
  // the light out here: always dusk, the sun low in the west, the lamps, windows and
  // strings of lights all on
  const DUSK = { bg: '#262a4c', sky: '#8890c8', gnd: '#262840', hemi: 0.44, sun: 0.34, sunC: '#ff9e6a', lamp: 1.2, halo: 0.85, win: 1, warm: 1 };
  // how far back the camera sits and how steeply it looks down, from far to close; far
  // shows about 18 tiles across where you stand, near the flat lot's 20
  const ZOOMS = [{ dist: 26, pitch: 0.92 }, { dist: 18.5, pitch: 0.86 }, { dist: 12, pitch: 0.76 }];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function create(floor, opts) {
    opts = opts || {};
    const T = window.THREE, V3 = T.Vector3;
    const touch = !!opts.touch;
    // a browser with no graphics card to hand (after a driver update, say) draws WebGL on the
    // processor, far too slowly for all this: then this throws, and the lot is drawn flat
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mixc = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();
    const R = rng(20261130);

    // ---------- the cel look ----------
    // three flat bands of light, and a black hull pushed out along the normals
    const GRAD = new T.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, T.RedFormat);
    GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    const OL_MAT = new T.ShaderMaterial({
      uniforms: { t: { value: 0.02 }, col: { value: new T.Color('#16121c') } },
      vertexShader: [
        'uniform float t;',
        'void main() {',
        '  vec4 p = vec4(position, 1.0); vec3 nn = normal;',
        '#ifdef USE_INSTANCING',
        '  p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn;',
        '#endif',
        '  vec4 mv = modelViewMatrix * p;',
        '  mv.xyz += normalize(normalMatrix * nn) * t;',
        '  gl_Position = projectionMatrix * mv;',
        '}'].join('\n'),
      fragmentShader: 'uniform vec3 col; void main() { gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    });
    // the hull uses normals averaged across hard edges, so boxes don't crack at the corners
    const olCache = new WeakMap();
    function olGeo(geo) {
      let g = olCache.get(geo);
      if (g) return g;
      g = new T.BufferGeometry();
      g.setAttribute('position', geo.attributes.position);
      if (geo.index) g.setIndex(geo.index);
      const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count, acc = new Map(), keys = [];
      for (let i = 0; i < n; i++) {
        const k = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
        keys.push(k);
        let a = acc.get(k);
        if (!a) acc.set(k, (a = new V3()));
        a.x += nor.getX(i); a.y += nor.getY(i); a.z += nor.getZ(i);
      }
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = acc.get(keys[i]).clone().normalize(); out[i * 3] = a.x; out[i * 3 + 1] = a.y; out[i * 3 + 2] = a.z; }
      g.setAttribute('normal', new T.BufferAttribute(out, 3));
      olCache.set(geo, g);
      return g;
    }
    const mats = new Map();
    function toon(col, map, side) {
      const k = (col || 'map') + '|' + (map ? map.uuid : '') + '|' + (side || 0);
      if (!mats.has(k)) mats.set(k, new T.MeshToonMaterial({ color: col || 0xffffff, map: map || null, gradientMap: GRAD, side: side || T.FrontSide }));
      return mats.get(k);
    }
    const basic = (col) => { const k = 'b' + col; if (!mats.has(k)) mats.set(k, new T.MeshBasicMaterial({ color: col })); return mats.get(k); };
    function mesh(geo, mat, o) {
      o = o || {};
      const m = new T.Mesh(geo, mat);
      m.castShadow = o.cast !== false; m.receiveShadow = true;
      if (o.ol !== false) m.add(new T.Mesh(olGeo(geo), OL_MAT));
      return m;
    }
    const at = (m, x, y, z, sx, sy, sz) => { m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); return m; };
    const SPH = new T.SphereGeometry(1, 20, 14);
    const HEMI = new T.SphereGeometry(1, 20, 8, 0, TAU, 0, Math.PI / 2);
    const ball = (mat, x, y, z, sx, sy, sz, o) => at(mesh(SPH, mat, o), x, y, z, sx, sy, sz);
    const box = (w, h, d, mat, o) => mesh(new T.BoxGeometry(w, h, d), mat, o);
    const cyl = (r0, r1, h, mat, o, seg, open) => mesh(new T.CylinderGeometry(r0, r1, h, seg || 12, 1, !!open), mat, o);
    function rod(a, b, r, mat, o) {
      const d = new V3().subVectors(b, a), len = d.length();
      const m = mesh(new T.CylinderGeometry(r, r, len, 8), mat, o);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
      return m;
    }
    const ring = (rad, tube, mat, y) => { const t = at(mesh(new T.TorusGeometry(rad, tube, 8, 22), mat), 0, y, 0); t.rotation.x = Math.PI / 2; return t; };

    // ---------- fewer draws ----------
    // Each little mesh is a draw of its own (its outline another, its shadow a third), and
    // it's how many draws there are, not how big they are, that keeps the browser busy. So
    // once they're placed, pieces that never move against each other are welded together:
    // one mesh per material and one outline for each lot of them.
    const weldable = (m) => m.isMesh && !m.isInstancedMesh && m.visible && m.material !== OL_MAT && !Array.isArray(m.material) &&
      !m.material.transparent && !!m.geometry.attributes.normal && m.children.every((c) => c.material === OL_MAT) && m.matrixWorld.determinant() > 0;
    // one geometry from [{ geo, m }], each moved by its matrix
    function weld(list) {
      let nv = 0, ni = 0;
      for (const { geo } of list) { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
      const uv = list.every(({ geo }) => geo.attributes.uv);
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = uv ? new Float32Array(nv * 2) : null;
      const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni), v = new V3(), nm = new T.Matrix3();
      let o = 0, oi = 0;
      for (const { geo, m } of list) {
        const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, I = geo.index, n = P.count, k = I ? I.count : n;
        nm.getNormalMatrix(m);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m).toArray(pos, (o + i) * 3);
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize().toArray(nor, (o + i) * 3);
          if (uv) { uvs[(o + i) * 2] = U.getX(i); uvs[(o + i) * 2 + 1] = U.getY(i); }
        }
        for (let i = 0; i < k; i++) idx[oi + i] = o + (I ? I.getX(i) : i);
        o += n; oi += k;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      if (uv) g.setAttribute('uv', new T.BufferAttribute(uvs, 2));
      g.setIndex(new T.BufferAttribute(idx, 1));
      return g;
    }
    // weld `meshes` (wherever they hang) into `space`, kept apart by key(mesh) as well as by
    // material and shadows
    function merge(space, meshes, key) {
      space.updateMatrixWorld(true);
      const inv = space.matrixWorld.clone().invert(), lots = new Map();
      const put = (k, mat, cast, recv, from) => {
        if (!lots.has(k)) lots.set(k, { mat, cast, recv, list: [] });
        lots.get(k).list.push({ geo: from.geometry, m: inv.clone().multiply(from.matrixWorld) });
      };
      for (const m of meshes) {
        const k = key ? key(m) : '';
        put(k + m.material.uuid + m.castShadow + m.receiveShadow, m.material, m.castShadow, m.receiveShadow, m);
        for (const ol of m.children) put(k + 'outline', OL_MAT, false, false, ol);
        m.removeFromParent();
      }
      for (const { mat, cast, recv, list } of lots.values()) {
        const w = new T.Mesh(weld(list), mat);
        w.castShadow = cast; w.receiveShadow = recv;
        space.add(w);
      }
    }

    // ---------- textures, all painted here ----------
    const texCache = new Map();
    function tex(key, w, h, draw, rx, ry, ox) {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.offset.x = ox || 0; t.anisotropy = ANISO;
      texCache.set(key, t);
      return t;
    }
    // a little grit over everything: every pixel nudged lighter or darker
    function grit(g, w, h, amt, seed) {
      const img = g.getImageData(0, 0, w, h), d = img.data, r = rng(seed || 1);
      for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(img, 0, 0);
    }
    // buffalo check (the snowman's scarf)
    const plaid = (base, dark, rx, ry) => {
      const t = tex('plaid' + base + dark + rx + ry, 32, 32, (g) => {
        g.fillStyle = base; g.fillRect(0, 0, 32, 32);
        g.fillStyle = dark; g.globalAlpha = 0.55; g.fillRect(0, 0, 16, 32); g.fillRect(0, 0, 32, 16);
        g.globalAlpha = 1; g.fillRect(0, 0, 16, 16);
        g.fillStyle = '#ffffff'; g.globalAlpha = 0.18; g.fillRect(23, 0, 1, 32); g.fillRect(0, 23, 32, 1); g.globalAlpha = 1;
      }, rx || 6, ry || 4);
      t.magFilter = T.NearestFilter;
      return t;
    };
    const knit = (base) => tex('knit' + base, 64, 16, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = mixc(base, '#000000', 0.25);
      for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.5, h);
    }, 6, 1);
    // shirts: stripes all the way round, a sweater's band of diamonds across the
    // chest (and ribs at the hem), and a hi-vis vest's two silver stripes
    const bands = (base, stripe, n) => tex('bands' + base + stripe + n, 16, 64, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = stripe; for (let i = 0; i < n; i++) g.fillRect(0, (i + 0.25) * h / n, w, h / n / 2);
    });
    const sweater = (base, acc) => tex('sweater' + base + acc, 128, 64, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = acc; g.fillRect(0, 24, w, 2); g.fillRect(0, 36, w, 2);
      for (let x = 4; x < w; x += 8) { g.beginPath(); g.moveTo(x, 27); g.lineTo(x + 3.5, 31); g.lineTo(x, 35); g.lineTo(x - 3.5, 31); g.closePath(); g.fill(); }
      g.fillStyle = mixc(base, '#000000', 0.22); for (let x = 0; x < w; x += 4) g.fillRect(x, h - 7, 1.5, 7);
    });
    const hivis = (base) => tex('hivis' + base, 16, 64, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (const y of [30, 41]) { g.fillStyle = '#3a3440'; g.fillRect(0, y - 1, w, 6); g.fillStyle = '#e8ecf2'; g.fillRect(0, y, w, 4); }
    });
    // wood: planks with a gap between them, grain running along them, a knot or two and nail heads
    const planks = (base, n, across, rx, ry) => tex('planks' + base + n + across + rx + ry, 256, 128, (g, w, h) => {
      const r = rng(n * 31 + w);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const ph = h / n;
      for (let i = 0; i < n; i++) {
        const y0 = i * ph;
        g.fillStyle = mixc(base, r() < 0.5 ? '#000000' : '#ffffff', r() * 0.12); g.fillRect(0, y0, w, ph);
        for (let k = 0; k < 9; k++) {
          const y = y0 + 2 + r() * (ph - 4), amp = 0.6 + r() * 1.8, fr = 0.01 + r() * 0.03;
          g.strokeStyle = mixc(base, '#2a1608', 0.25 + r() * 0.25); g.lineWidth = 0.6 + r();
          g.beginPath();
          for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * fr + k) * amp);
          g.stroke();
        }
        if (r() < 0.6) {
          const kx = r() * w, ky = y0 + ph * (0.3 + r() * 0.4);
          g.fillStyle = mixc(base, '#2a1608', 0.55); g.beginPath(); g.ellipse(kx, ky, 4 + r() * 3, 2 + r() * 1.5, 0, 0, TAU); g.fill();
          g.strokeStyle = mixc(base, '#2a1608', 0.35); g.lineWidth = 1; g.beginPath(); g.ellipse(kx, ky, 8, 4, 0, 0, TAU); g.stroke();
        }
        g.fillStyle = '#3a3a40';
        for (const x of [6, w - 6]) { g.beginPath(); g.arc(x, y0 + ph / 2, 1.6, 0, TAU); g.fill(); }
        g.fillStyle = mixc(base, '#1a0c04', 0.6); g.fillRect(0, y0, w, 2);
      }
      grit(g, w, h, 14, n);
      if (across) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(g.canvas, 0, 0); g.save(); g.translate(w, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0, h, w); g.restore(); }
    }, rx || 1, ry || 1);
    // bark and needles are grey, so the trees' own greens and browns tint them
    const bark = tex('bark', 64, 128, (g, w, h) => {
      g.fillStyle = '#d0c8c0'; g.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.6 ? 'rgba(60,50,40,.45)' : 'rgba(255,255,255,.3)'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 10 + r() * 30); }
      grit(g, w, h, 20, 6);
    }, 3, 1);
    const needles = tex('needles', 128, 128, (g, w, h) => {
      g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let i = 0; i < 900; i++) {
        const x = r() * w, y = r() * h, len = 6 + r() * 9, a = Math.PI / 2 + (r() - 0.5) * 0.9;
        const v = r(); g.strokeStyle = v < 0.55 ? 'rgba(70,70,70,.55)' : v < 0.85 ? 'rgba(150,150,150,.6)' : 'rgba(255,255,255,.7)';
        g.lineWidth = 1 + r() * 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
    }, 4, 1);
    const snowTex = tex('snow', 128, 128, (g, w, h) => {
      g.fillStyle = '#f2f6fa'; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, rad = 8 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, r() < 0.5 ? 'rgba(200,216,236,.5)' : 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.7 ? '#ffffff' : '#c4d8f0'; g.fillRect(r() * w, r() * h, 1, 1); }
      grit(g, w, h, 8, 12);
    }, 2, 2);
    const rock = tex('rock', 64, 64, (g, w, h) => {
      g.fillStyle = '#9a9ea8'; g.fillRect(0, 0, w, h);
      const r = rng(13);
      for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? 'rgba(50,52,60,.3)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 6, 0, TAU); g.fill(); }
      grit(g, w, h, 30, 14);
    });
    // car glass: dark, with a bright streak where the sky catches it
    const glassTex = tex('glass', 64, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a7290'); gr.addColorStop(1, '#2a3a50');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(w * 0.15, 0); g.lineTo(w * 0.4, 0); g.lineTo(w * 0.15, h); g.lineTo(-w * 0.1, h); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.58, 0); g.lineTo(w * 0.33, h); g.lineTo(w * 0.25, h); g.fill();
    });
    const plate = (i) => tex('plate' + i, 64, 32, (g, w, h) => {
      g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#24408a'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
      g.fillStyle = '#24408a'; g.font = '800 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['HKN 101', 'BRR 777', 'EH 2024', 'TOQ 42', 'MAPL 1'][i % 5], w / 2, h / 2 + 1);
    });
    const shingles = tex('shingles', 128, 128, (g, w, h) => {
      g.fillStyle = '#4a3a34'; g.fillRect(0, 0, w, h);
      const r = rng(17);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
        g.fillStyle = mixc('#5a4840', '#2a2020', r() * 0.5); g.fillRect(x + 1, y + 1, 14, 14);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 13, 16, 3);
      }
      grit(g, w, h, 16, 18);
    }, 3, 2);

    // a torso as a lathe, so fabric runs evenly from hem to collar
    function torsoGeo(r, h) {
      const prof = [[0.02, 0], [0.55, 0.015], [0.86, 0.06], [0.97, 0.14], [1, 0.26], [1, 0.42], [1.02, 0.58], [1.03, 0.72], [0.98, 0.84], [0.82, 0.93], [0.55, 0.985], [0.25, 1], [0.02, 1]];
      return new T.LatheGeometry(prof.map(([a, b]) => new T.Vector2(a * r, b * h)), 24);
    }

    // ---------- people ----------
    // Built from an HD.person spec, in the colours the flat art uses: the hair, head thing,
    // shirt and pants the character editor has (a coworker's office clothes, or a player's
    // look). Everyone's the same size. Legs bend at the knee and arms at the elbow;
    // everything above the waist sits in `upper` so it can twist against the hips. Shoes
    // and skates are both there; the skates show on ice, and turn at the ankle.
    const HIP_Y = 0.62, THIGH = 0.27, SHIN = 0.24, BLADE = 0.16; // hip height, hip to knee, knee to ankle, ankle to the ice
    function buildPerson(p) {
      const female = p.female;
      const root = new T.Group(), body = new T.Group();
      root.add(body);
      const rig = new T.Group(), upper = new T.Group();
      body.add(rig); rig.add(upper);
      const skinM = toon(p.skin.f), hairM = toon(p.hairC.f), pantsM = toon(p.pants.f);
      const shirt = { stripes: () => bands(p.coat.f, p.acc.f, 8), sweater: () => sweater(p.coat.f, p.acc.f), hivis: () => hivis(p.coat.f) }[p.outfit];
      const coatM = shirt ? toon(null, shirt()) : toon(p.coat.f);
      const sleeveM = p.outfit === 'stripes' ? toon(null, bands(p.coat.f, p.acc.f, 4)) : toon(p.arms.f);

      const r = 0.245 * (female ? 0.9 : 1);
      const tb = 0.58, th = 0.72, top = tb + th;

      // legs: thigh, knee, shin, and shoes or skates (bare below shorts or a skirt)
      const hips = {}, knees = {}, boots = [], skates = [];
      const bare = p.legs === 'shorts' || p.legs === 'skirt', shinM = bare ? skinM : pantsM, legR = bare ? 0.8 : 1;
      for (const s of [-1, 1]) {
        const hip = new T.Group(), knee = new T.Group();
        hip.position.set(s * 0.115 * (female ? 0.9 : 1), HIP_Y, 0); rig.add(hip);
        hip.add(at(cyl(0.1, 0.092, THIGH, p.legs === 'skirt' ? skinM : pantsM, null, 10, true), 0, -THIGH / 2, 0));
        knee.position.y = -THIGH; hip.add(knee);
        knee.add(ball(shinM, 0, 0, 0, 0.093 * legR, 0.093 * legR, 0.093 * legR, { ol: false }));
        knee.add(at(cyl(0.092 * legR, 0.086 * legR, 0.23, shinM, null, 10, true), 0, -0.115, 0));
        const bt = new T.Group(), sk = new T.Group();
        knee.add(bt); knee.add(sk); boots.push(bt); skates.push(sk);
        bt.add(ball(toon(p.boot.f), 0, -0.26, 0.045, 0.12, 0.1, 0.18));
        bt.add(at(box(0.22, 0.03, 0.34, toon(p.sole.f), { ol: false }), 0, -0.345, 0.045));
        sk.position.y = -SHIN;
        sk.add(at(cyl(0.1, 0.11, 0.16, toon(p.skate.f), null, 10), 0, SHIN - 0.2, 0));
        sk.add(ball(toon(p.skate.f), 0, SHIN - 0.27, 0.05, 0.11, 0.08, 0.17));
        sk.add(at(box(0.03, 0.06, 0.4, toon(p.blade.f)), 0, SHIN - 0.37, 0.04));
        sk.visible = false;
        hips[s] = hip; knees[s] = knee;
      }
      rig.add(ball(pantsM, 0, 0.64, 0, r * 0.88, 0.13, r * 0.7));

      // torso, and a skirt or overalls
      const torso = at(mesh(torsoGeo(r, th), coatM), 0, tb, 0);
      torso.scale.z = 0.8; upper.add(torso);
      if (p.legs === 'skirt') { const sk = at(cyl(r * 0.92, 0.3, 0.27, pantsM, null, 18), 0, 0.55, 0); sk.scale.z = 0.85; rig.add(sk); }
      if (p.legs === 'overalls') {
        const band = at(cyl(r * 1.03, r * 0.97, 0.14, pantsM, null, 20), 0, tb + 0.08, 0);
        band.scale.z = 0.82; upper.add(band);
        upper.add(at(box(0.24, 0.26, 0.03, pantsM), 0, tb + 0.24, r * 0.84));
        // the straps, up over the shoulders and down the back
        for (const s of [-1, 1]) for (const z of [-1, 1]) {
          const pts = [[0.08, tb + 0.3, 0.84], [0.09, top - 0.12, 0.8], [0.1, top - 0.03, 0.55]].map(([x, y, d]) => new V3(s * x, y, z * r * d));
          upper.add(rod(pts[0], pts[1], 0.018, pantsM)); upper.add(rod(pts[1], pts[2], 0.018, pantsM));
          if (z > 0) upper.add(ball(toon('#e8c87a'), s * 0.08, tb + 0.33, r * 0.84 + 0.02, 0.02, 0.02, 0.012, { ol: false }));
        }
        for (const s of [-1, 1]) upper.add(rod(new V3(s * 0.1, top - 0.03, r * 0.55), new V3(s * 0.1, top - 0.03, -r * 0.55), 0.018, pantsM));
      }

      // arms: upper arm, elbow, forearm, hand
      const arms = {}, elbows = {}, sx = r + 0.06, sy = tb + th * 0.84, armR = 0.092;
      for (const s of [-1, 1]) {
        const sh = new T.Group(), el = new T.Group();
        sh.position.set(s * sx, sy, 0); sh.rotation.z = s * 0.12; upper.add(sh);
        // (a T-shirt's sleeves stop short of the elbow, with the arm bare below)
        const tee = p.outfit === 'tee', lowM = tee ? skinM : sleeveM, lowR = tee ? armR * 0.82 : armR;
        sh.add(ball(sleeveM, 0, 0, 0, armR + 0.02, armR + 0.02, armR + 0.02));
        if (tee) sh.add(at(cyl(armR + 0.012, armR + 0.006, 0.12, sleeveM, null, 10, true), 0, -0.06, 0));
        sh.add(at(cyl(lowR, lowR * 0.95, 0.22, lowM, null, 10, true), 0, -0.11, 0));
        el.position.y = -0.22; sh.add(el);
        el.add(ball(lowM, 0, 0, 0, lowR * 0.96, lowR * 0.96, lowR * 0.96, { ol: false }));
        el.add(at(cyl(lowR * 0.95, lowR * 0.88, 0.2, lowM, null, 10, true), 0, -0.1, 0));
        el.add(ball(skinM, 0, -0.23, 0.01, 0.068, 0.08, 0.072));
        arms[s] = sh; elbows[s] = el;
      }

      // the shirt's neckline: a tie (with a suit's white shirt behind it), a crew neck, a
      // necklace, a hood, or the shirt under a hi-vis vest
      const vee = (rad, col, y) => { const v = at(new T.Mesh(new T.CircleGeometry(rad, 3), basic(col)), 0, y, r * 0.82 + 0.008); v.rotation.set(-0.12, 0, -Math.PI / 2); upper.add(v); };
      if (p.outfit === 'suit') vee(0.15, '#f4f4f8', top - 0.1);
      if (p.outfit === 'tie' || p.outfit === 'suit') {
        const accM = toon(p.acc.f), len = p.outfit === 'suit' ? 0.2 : 0.46;
        const tie = at(box(0.05, len, 0.015, accM, { ol: false }), 0, top - 0.05 - len / 2, r * 0.82 + 0.014);
        tie.rotation.x = -0.08; upper.add(tie);
        upper.add(ball(accM, 0, top - 0.045, r * 0.74, 0.034, 0.03, 0.022));
        upper.add(ring(r * 0.58, 0.03, toon(p.outfit === 'suit' ? '#f4f4f8' : p.coat.f), top - 0.02));
      }
      if (['tee', 'stripes', 'sweater'].includes(p.outfit)) upper.add(ring(r * 0.56, 0.028, toon(p.outfit === 'tee' ? p.acc.f : mixc(p.coat.f, '#000000', 0.2)), top - 0.02));
      if (p.outfit === 'blouse') { vee(0.08, p.skin.f, top - 0.06); upper.add(ball(toon(p.acc.f), 0, top - 0.13, r * 0.82 + 0.012, 0.02, 0.024, 0.012, { ol: false })); }
      if (p.outfit === 'hivis') vee(0.1, p.arms.f, top - 0.07);
      if (p.outfit === 'hoodie') {
        const hood = ring(r * 0.66, 0.07, coatM, top - 0.02);
        hood.position.z = -0.03; upper.add(hood);
        upper.add(ball(coatM, 0, top - 0.15, -r * 0.74, 0.17, 0.13, 0.07));
        upper.add(at(box(0.26, 0.11, 0.03, toon(mixc(p.coat.f, '#000000', 0.18))), 0, tb + 0.14, r * 0.8 + 0.01));
        for (const s of [-1, 1]) upper.add(rod(new V3(s * 0.04, top - 0.03, r * 0.76), new V3(s * 0.045, top - 0.2, r * 0.84), 0.009, toon(p.acc.f), { ol: false }));
      }

      // the head
      const head = new T.Group();
      head.position.set(0, top + 0.3, 0); upper.add(head);
      if (female) head.scale.setScalar(0.96);
      head.add(ball(skinM, 0, 0, 0, 0.27, 0.285, 0.26));
      for (const s of [-1, 1]) head.add(ball(skinM, s * 0.265, -0.02, 0, 0.05, 0.07, 0.04));
      const face = { ol: false, cast: false };
      for (const s of [-1, 1]) {
        head.add(ball(basic('#16121c'), s * 0.092, -0.005, 0.236, 0.03, 0.044, 0.022, face));
        head.add(ball(basic('#ffffff'), s * 0.092 + 0.01, 0.012, 0.252, 0.009, 0.011, 0.006, face));
        const brow = at(box(0.075, 0.02, 0.02, basic(p.brow), face), s * 0.094, 0.05, 0.236);
        brow.rotation.z = -s * 0.12; head.add(brow);
        // cheeks red from the cold
        head.add(ball(toon(mixc(p.skin.f, '#e0484a', 0.45)), s * 0.155, -0.07, 0.205, 0.055, 0.035, 0.02, face));
      }
      head.add(ball(toon(mixc(p.skin.f, '#e0484a', 0.28)), 0, -0.045, 0.262, 0.05, 0.048, 0.045));
      head.add(ball(basic('#5a2a2a'), 0, -0.135, 0.226, 0.04, 0.014, 0.012, face));

      // hair
      const hat = p.hat !== 'none', hair = p.hair;
      if (hair === 'bald') head.add(ball(hairM, 0, -0.07, -0.05, 0.28, 0.17, 0.25));
      else head.add(ball(hairM, 0, 0.01, -0.035, 0.285, 0.29, 0.272));
      if (!hat && !['bald', 'buzz', 'spiky', 'curly'].includes(hair)) head.add(ball(hairM, 0, 0.17, 0.13, 0.22, 0.09, 0.12));
      if (hair === 'spiky' && !hat) for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU, sp = at(mesh(new T.ConeGeometry(0.06, 0.18, 6), hairM), Math.cos(a) * 0.13, 0.27, Math.sin(a) * 0.13 + 0.02);
        sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); head.add(sp);
      }
      if (hair === 'curly') for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        head.add(ball(hairM, Math.cos(a) * 0.22, 0.12 + (hat ? -0.05 : 0.06) * (i % 2), Math.sin(a) * 0.2 - 0.03, 0.09, 0.09, 0.09));
      }
      if (hair === 'long') { head.add(ball(hairM, 0, -0.26, -0.11, 0.27, 0.32, 0.17)); for (const s of [-1, 1]) head.add(ball(hairM, s * 0.22, -0.2, 0, 0.08, 0.2, 0.12)); }
      if (hair === 'bob') { head.add(ball(hairM, 0, -0.13, -0.1, 0.28, 0.19, 0.18)); for (const s of [-1, 1]) head.add(ball(hairM, s * 0.22, -0.12, 0.02, 0.1, 0.17, 0.15)); }
      if (hair === 'ponytail') {
        for (let i = 0; i < 4; i++) head.add(ball(hairM, 0, -0.02 - i * 0.11, -0.29 - i * 0.03, 0.09 - i * 0.008, 0.08, 0.08 - i * 0.006));
        head.add(ball(toon(p.acc.f), 0, 0.02, -0.27, 0.05, 0.05, 0.03));
      }
      if (hair === 'bun') head.add(ball(hairM, 0, 0.27, -0.12, 0.12, 0.11, 0.12));

      // the head thing: a toque, a cap, a hard hat, a cowboy hat or the crown, or glasses,
      // shades, headphones or a bow with the hair showing
      const hatM = toon(p.hatC.f);
      if (p.hat === 'toque') {
        head.add(at(mesh(HEMI, toon(null, knit(p.hatC.f))), 0, 0.085, 0, 0.29, 0.31, 0.285));
        head.add(at(cyl(0.296, 0.3, 0.1, toon(mixc(p.hatC.f, '#000000', 0.12)), null, 22), 0, 0.11, 0));
        head.add(ball(toon(p.pomT.f), 0, 0.43, 0, 0.085, 0.085, 0.085));
      }
      if (p.hat === 'cap') {
        head.add(at(mesh(HEMI, hatM), 0, 0.06, -0.005, 0.292, 0.27, 0.285));
        const peak = at(cyl(0.2, 0.2, 0.024, hatM, null, 18), 0, 0.075, 0.2);
        peak.scale.z = 0.9; peak.rotation.x = 0.1; head.add(peak);
        head.add(ball(hatM, 0, 0.33, 0, 0.03, 0.02, 0.03));
      }
      if (p.hat === 'hardhat') {
        head.add(at(mesh(HEMI, hatM), 0, 0.07, 0, 0.31, 0.33, 0.305));
        head.add(at(mesh(HEMI, hatM), 0, 0.07, 0, 0.055, 0.35, 0.33)); // the ridge over the top
        const brim = at(cyl(0.36, 0.36, 0.022, hatM, null, 22), 0, 0.075, 0.025);
        brim.scale.z = 1.08; head.add(brim);
      }
      if (p.hat === 'cowboy') {
        const brim = at(cyl(0.5, 0.5, 0.025, hatM, null, 24), 0, 0.09, 0);
        brim.scale.z = 0.88; head.add(brim);
        head.add(at(cyl(0.21, 0.25, 0.24, hatM, null, 18), 0, 0.22, 0));
        head.add(at(cyl(0.255, 0.26, 0.05, toon('#5c4c3a'), { ol: false }, 18), 0, 0.13, 0));
        head.add(ball(toon(mixc(p.hatC.f, '#000000', 0.25)), 0, 0.335, 0, 0.15, 0.03, 0.11, { ol: false })); // the crease
      }
      if (p.hat === 'crown') {
        // the Office Champion's: a gold band round a red velvet cap, five points with a pearl on
        // each, and a ruby out front between two sapphires
        head.add(at(mesh(HEMI, toon('#b83028')), 0, 0.2, 0, 0.215, 0.17, 0.215));
        head.add(at(cyl(0.25, 0.235, 0.1, hatM, null, 20), 0, 0.19, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU, x = Math.sin(a) * 0.235, z = Math.cos(a) * 0.235;
          head.add(at(mesh(new T.ConeGeometry(0.055, 0.13, 4), hatM), x, 0.3, z));
          head.add(ball(toon('#efe6d2'), x, 0.375, z, 0.026, 0.026, 0.026));
        }
        head.add(ball(toon('#c8282e'), 0, 0.19, 0.25, 0.035, 0.035, 0.02, { ol: false }));
        for (const s of [-1, 1]) head.add(ball(toon('#3a6ad8'), Math.sin(s * 0.6) * 0.245, 0.19, Math.cos(s * 0.6) * 0.245, 0.022, 0.022, 0.022, { ol: false }));
      }
      if (p.wear === 'glasses' || p.wear === 'shades') {
        const fm = basic('#16121c'), thin = { ol: false, cast: false };
        for (const s of [-1, 1]) {
          head.add(at(mesh(new T.TorusGeometry(0.048, 0.009, 6, 16), fm, thin), s * 0.092, -0.005, 0.27));
          if (p.wear === 'shades') head.add(at(new T.Mesh(new T.CircleGeometry(0.046, 16), basic('#1c1a26')), s * 0.092, -0.005, 0.271));
          head.add(rod(new V3(s * 0.14, 0, 0.262), new V3(s * 0.24, 0.005, 0.17), 0.008, fm, thin));
          head.add(rod(new V3(s * 0.24, 0.005, 0.17), new V3(s * 0.274, 0, 0.03), 0.008, fm, thin));
        }
        head.add(rod(new V3(-0.044, 0, 0.272), new V3(0.044, 0, 0.272), 0.008, fm, thin));
      }
      if (p.wear === 'headphones') {
        head.add(mesh(new T.TorusGeometry(0.315, 0.022, 6, 20, Math.PI), hatM));
        for (const s of [-1, 1]) { const cup = at(cyl(0.08, 0.08, 0.06, toon('#c8352f'), null, 14), s * 0.3, -0.02, 0); cup.rotation.z = Math.PI / 2; head.add(cup); }
      }
      if (p.wear === 'bow') {
        const bow = new T.Group();
        bow.position.set(0.17, 0.26, 0); bow.rotation.z = -0.5; head.add(bow);
        for (const s of [-1, 1]) { const loop = ball(hatM, s * 0.06, 0, 0, 0.065, 0.045, 0.03); loop.rotation.z = s * 0.3; bow.add(loop); }
        bow.add(ball(hatM, 0, 0, 0, 0.025, 0.03, 0.03));
      }

      // each part that moves as one (the head, a shin, a boot) welded into a mesh per material
      root.updateMatrixWorld(true);
      const parts = [];
      root.traverse((o) => { if (!o.isMesh) parts.push(o); });
      for (const g of parts) {
        const ms = g.children.filter(weldable);
        if (ms.length > 1) merge(g, ms);
      }

      return {
        root, body, rig, upper, hips, knees, arms, elbows, head, boots, skates,
        ang: 0, w: 0, glide: 0, cyc: 0, spd: 0, phase: R() * TAU, seen: 0,
        tick: null, prev: new V3(), cur: new V3(), last: null,
      };
    }

    // ---------- the lot ----------
    const TILES = floor.tiles, MW = TILES[0].length, MH = TILES.length;
    const tAt = (x, y) => (TILES[y] || '')[x] || ' ';
    let WALL = 0;
    while (WALL < MH && /^#+$/.test(TILES[WALL].replace(/X/g, '#'))) WALL++;
    const TX = (c) => c + 0.5 - MW / 2, TZ = (r) => r + 0.5 - MH / 2; // a tile's centre
    const findTiles = (ch) => { const out = []; TILES.forEach((row, y) => [...row].forEach((t, x) => { if (t === ch) out.push([x, y]); })); return out; };
    const topLeft = (ch) => findTiles(ch).filter(([x, y]) => tAt(x - 1, y) !== ch && tAt(x, y - 1) !== ch);
    const floorAt = (x, y) => ((floor.floor || [])[y] || '')[x];
    const paved = (x, y) => y >= WALL && (floorAt(x, y) === ',' || ',cLB~n'.includes(tAt(x, y)));
    const scene = new T.Scene();
    const WHITE = toon('#ffffff'), snowM = toon(null, snowTex);
    const mtx = (x, y, z, sx, sy, sz, ry) => new T.Matrix4().compose(new V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry || 0, 0)), new V3(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz));
    // many copies of one thing in one go (trees, snow, icicles, boards, bulbs), each with its own outline
    function instanced(geo, mat, list, o) {
      o = o || {};
      if (!list.length) return null;
      const im = new T.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, new T.Color(it.c)); });
      im.castShadow = o.cast !== false; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
      if (o.ol !== false) {
        const h = new T.InstancedMesh(olGeo(geo), OL_MAT, list.length);
        list.forEach((it, i) => h.setMatrixAt(i, it.m));
        h.frustumCulled = false; scene.add(h);
      }
      return im;
    }
    const lumps = [], bulbs = [];
    function snowbank(x, z, n, sx, sz, size) {
      for (let i = 0; i < n; i++) {
        const rr = (0.3 + R() * 0.5) * (size || 1);
        lumps.push({ m: mtx(x + (R() - 0.5) * sx, rr * 0.22, z + (R() - 0.5) * sz, rr * 1.2, rr * 0.6, rr, R() * TAU) });
      }
    }

    // the ground: gritty asphalt where it's been plowed, with cracks, patches, oil and salt
    // stains and buried parking lines, a ragged heap of snow along the plow's edge, and soft
    // drifts everywhere else, trodden with footprints out to the stand, the tree and the fire
    const PX = 32;
    const groundTex = tex('ground', MW * PX, MH * PX, (g, GW, GH) => {
      const blob = (x, y, rad, col) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      };
      g.fillStyle = '#e8eef5'; g.fillRect(0, 0, GW, GH);
      for (let i = 0; i < 220; i++) blob(R() * GW, R() * GH, (1.5 + R() * 4) * PX, R() < 0.5 ? 'rgba(255,255,255,.6)' : 'rgba(196,212,232,.45)');
      // the woods' floor, in the trees' shade
      for (let y = WALL; y < MH; y++) for (let x = 0; x < MW; x++) if (tAt(x, y) === ' ') blob((x + 0.5) * PX, (y + 0.5) * PX, PX * 1.1, 'rgba(150,170,200,.45)');
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (paved(x, y)) { g.fillStyle = '#8c97a6'; g.fillRect(x * PX, y * PX, PX + 1, PX + 1); }
      const onLot = () => { for (;;) { const x = R() * MW, y = WALL + R() * (MH - WALL); if (paved(Math.floor(x), Math.floor(y))) return [x * PX, y * PX]; } };
      // patches of newer, darker asphalt
      for (let i = 0; i < 16; i++) { const [x, y] = onLot(), w = (1 + R() * 3) * PX, h = (0.8 + R() * 2) * PX; g.fillStyle = 'rgba(50,56,70,.22)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(30,34,44,.35)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); }
      // salt and slush
      for (let i = 0; i < 90; i++) { const [x, y] = onLot(); blob(x, y, (0.4 + R() * 1.6) * PX, 'rgba(236,240,246,.42)'); }
      // oil
      for (let i = 0; i < 26; i++) { const [x, y] = onLot(); blob(x, y, (0.3 + R() * 0.5) * PX, 'rgba(24,26,36,.28)'); }
      // stones in the asphalt
      for (let i = 0; i < 9000; i++) { const [x, y] = onLot(); g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(20,24,32,.25)'; g.fillRect(x, y, 1.5, 1.5); }
      // cracks
      for (let i = 0; i < 46; i++) {
        let [x, y] = onLot(), a = R() * TAU;
        const pts = [[x, y]];
        for (let k = 0; k < 6 + R() * 12; k++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * PX * 0.35; y += Math.sin(a) * PX * 0.35; pts.push([x, y]); }
        for (const [col, off, lw] of [['rgba(255,255,255,.18)', 1, 1.2], ['rgba(28,30,40,.6)', 0, 1.3]]) {
          g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off)));
          g.stroke();
        }
      }
      // the parking lines, worn through in places
      g.lineWidth = 0.12 * PX; g.setLineDash([PX * 0.5, PX * 0.12, PX * 0.9, PX * 0.2]);
      for (const [x, y] of topLeft('c')) for (const lx of [x - 0.05, x + 2.05]) {
        g.strokeStyle = 'rgba(226,190,80,' + (0.45 + R() * 0.25) + ')';
        g.beginPath(); g.moveTo(lx * PX, (y + 0.1) * PX); g.lineTo(lx * PX, (y + 2.9) * PX); g.stroke();
      }
      g.setLineDash([]);
      // tire tracks, packed slush along every third open row of the lot
      const lotEnd = TILES[WALL + 1].lastIndexOf(',') + 1, open = [];
      for (let y = WALL; y < MH; y++) if ([...TILES[y]].every((t, x) => x < 1 || x >= lotEnd || t === ',')) open.push(y);
      for (const y of open.filter((_, i) => i % 3 === 1)) for (const off of [0, 1.5]) {
        for (const [col, lw, dy] of [['rgba(236,240,246,.3)', 0.34, 0.05], ['rgba(60,68,84,.22)', 0.18, 0]]) {
          g.strokeStyle = col; g.lineWidth = lw * PX; g.beginPath(); g.moveTo(PX, (y + off + dy) * PX);
          g.bezierCurveTo(lotEnd * 0.3 * PX, (y - 2.5 + off + dy) * PX, lotEnd * 0.65 * PX, (y + 2.5 + off + dy) * PX, lotEnd * PX, (y + off + dy) * PX); g.stroke();
        }
      }
      // the plowed edge: chunks of snow heaped up, with their shadows
      for (let y = WALL; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (!paved(x, y)) continue;
        const edge = (ex, ey) => {
          for (let k = 0; k < 4; k++) {
            const cx = ex() * PX, cy = ey() * PX, rad = (0.14 + R() * 0.24) * PX;
            g.fillStyle = 'rgba(110,130,165,.45)'; g.beginPath(); g.arc(cx + rad * 0.3, cy + rad * 0.45, rad, 0, TAU); g.fill();
            g.fillStyle = '#f2f6fa'; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
          }
        };
        if (!paved(x + 1, y)) edge(() => x + 1 - R() * 0.15, () => y + R());
        if (!paved(x - 1, y)) edge(() => x + R() * 0.15, () => y + R());
        if (!paved(x, y + 1)) edge(() => x + R(), () => y + 1 - R() * 0.15);
      }
      // footprints, left and right, along trodden paths
      const prints = (x0, y0, x1, y1) => {
        const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), n = Math.floor(len / 0.32);
        for (let i = 0; i < n; i++) {
          const t = i / n, s = i % 2 ? 1 : -1, wob = Math.sin(t * 9 + x0) * 0.25;
          const x = (x0 + (x1 - x0) * t - Math.sin(a) * (s * 0.09 + wob)) * PX, y = (y0 + (y1 - y0) * t + Math.cos(a) * (s * 0.09 + wob)) * PX;
          g.fillStyle = 'rgba(130,150,185,.5)'; g.beginPath(); g.ellipse(x, y, 0.11 * PX, 0.06 * PX, a, 0, TAU); g.fill();
        }
      };
      for (const ch of 'hYfs') for (const [x, y] of topLeft(ch)) for (let k = 0; k < 3; k++) prints(lotEnd + 0.3, y + 0.5 + k * 0.6, x + 0.5 + (R() - 0.5), y + 1.5);
      for (let i = 0; i < 10; i++) { const y = WALL + R() * (MH - WALL), x = lotEnd + R() * (MW - lotEnd - 1); prints(x, y, x + (R() - 0.5) * 6, y + (R() - 0.5) * 6); }
      // sparkle
      for (let i = 0; i < 9000; i++) {
        const x = R() * MW, y = R() * MH;
        if (paved(Math.floor(x), Math.floor(y))) continue;
        g.fillStyle = R() < 0.7 ? '#ffffff' : '#bcd2ee'; g.fillRect(x * PX, y * PX, 1.4, 1.4);
      }
      grit(g, GW, GH, 12, 21);
    });
    const ground = new T.Mesh(new T.PlaneGeometry(MW, MH), toon(null, groundTex));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const outerTex = tex('outer', 128, 128, (g, w, h) => { const img = snowTex.image; g.drawImage(img, 0, 0, w, h); }, 60, 60);
    const outer = new T.Mesh(new T.PlaneGeometry(400, 400), toon(null, outerTex));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; scene.add(outer);

    // ---- the office along the north edge: brick, lit windows with stone sills, the doors,
    // the sign, a wreath, downpipes and lamps by the door ----
    let facadeMat;
    {
      const FZ = WALL - MH / 2, FH = 5, FPX = 40;
      const doors = findTiles('X').map((d) => d[0]), d0 = Math.min(...doors), d1 = Math.max(...doors) + 1;
      const wins = [];
      for (let x = 1.5; x + 2 < MW; x += 4) if (!(x + 2 > d0 - 0.6 && x < d1 + 0.6)) wins.push(x);
      const draw = (g, mask) => {
        const W2 = MW * FPX, H2 = FH * FPX, r = rng(23);
        g.fillStyle = mask ? '#000000' : '#d6ccc0'; g.fillRect(0, 0, W2, H2);
        if (!mask) {
          // running bond: a brick a quarter metre high and half a metre long, each its own shade
          const bh = FPX * 0.2, bw = FPX * 0.45;
          for (let row = 0, y = 0; y < H2; row++, y += bh) for (let x = row % 2 ? -bw / 2 : 0; x < W2; x += bw) {
            g.fillStyle = mixc('#a5624c', r() < 0.5 ? '#5a2a20' : '#d89070', r() * 0.3);
            g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
          }
          // the concrete footing, and soot and drips
          g.fillStyle = '#8a8680'; g.fillRect(0, H2 - FPX * 0.45, W2, FPX * 0.45);
          g.fillStyle = 'rgba(40,30,30,.18)';
          for (let i = 0; i < 40; i++) g.fillRect(r() * W2, FPX * 0.3, 2 + r() * 4, FPX * (1 + r() * 3));
        }
        for (const x of wins) {
          const px = x * FPX, top = (FH - 3.4) * FPX, h = 2.2 * FPX;
          if (!mask) {
            g.fillStyle = '#c8c0b4'; g.fillRect(px - 8, top - 10, 2 * FPX + 16, 8); // the lintel
            g.fillStyle = '#efe6d2'; g.fillRect(px - 4, top - 4, 2 * FPX + 8, h + 8);
          }
          g.fillStyle = mask ? '#ffffff' : '#ffd77a'; g.fillRect(px, top, 2 * FPX, h);
          if (!mask) {
            g.fillStyle = '#eaa84c'; g.fillRect(px, top + h * 0.62, 2 * FPX, h * 0.38);
            g.fillStyle = 'rgba(120,70,40,.35)'; g.fillRect(px + 6, top + h * 0.2, 14, h * 0.8); g.fillRect(px + 2 * FPX - 20, top + h * 0.25, 12, h * 0.75); // someone's plant and a lamp inside
            g.fillStyle = '#efe6d2'; g.fillRect(px + FPX - 2, top, 4, h); g.fillRect(px, top + h * 0.45, 2 * FPX, 4);
            g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(px + 6, top); g.lineTo(px + 22, top); g.lineTo(px + 6, top + 26); g.fill();
          }
        }
        const dx0 = d0 * FPX, dx1 = d1 * FPX, dtop = (FH - 2.6) * FPX;
        if (!mask) { g.fillStyle = '#343c4a'; g.fillRect(dx0 - 10, dtop - 10, dx1 - dx0 + 20, FH * FPX - dtop + 10); }
        for (let x = dx0; x < dx1; x += FPX) {
          g.fillStyle = mask ? '#ffffff' : '#ffd77a'; g.fillRect(x + 4, dtop, FPX - 8, FH * FPX - dtop);
          if (!mask) { g.fillStyle = '#c8ccd8'; g.fillRect(x + (x === dx0 ? FPX - 12 : 8), dtop + FPX * 1.2, 4, FPX * 0.5); }
        }
        if (!mask) grit(g, W2, H2, 16, 24);
      };
      facadeMat = new T.MeshToonMaterial({
        map: tex('facade', MW * FPX, FH * FPX, (g) => draw(g, false)), gradientMap: GRAD,
        emissive: '#ffcf7a', emissiveMap: tex('facadeGlow', MW * FPX, FH * FPX, (g) => draw(g, true)), emissiveIntensity: 0.15,
      });
      const front = new T.Mesh(new T.PlaneGeometry(MW, FH), facadeMat);
      front.position.set(0, FH / 2, FZ); front.receiveShadow = true; scene.add(front);
      scene.add(at(box(MW + 0.4, FH, 10, toon('#7d5a4a'), { ol: false }), 0, FH / 2, FZ - 5.02));
      scene.add(at(box(MW + 0.8, 0.35, 10.4, snowM, { ol: false }), 0, FH + 0.17, FZ - 5));
      scene.add(at(box(MW + 0.8, 0.3, 0.3, toon('#3c404c')), 0, FH - 0.05, FZ + 0.05));
      for (let x = -MW / 2; x < MW / 2; x += 0.7) lumps.push({ m: mtx(x + R() * 0.3, FH + 0.3, FZ + 0.1, 0.45 + R() * 0.2, 0.18, 0.3, R()) });
      // stone sills with snow on, under every window
      const sills = [], sillSnow = [];
      for (const x of wins) { const cx = x + 1 - MW / 2; sills.push({ m: mtx(cx, FH - 3.45, FZ + 0.08, 1, 1, 1), c: '#c8c0b4' }); sillSnow.push({ m: mtx(cx, FH - 3.38, FZ + 0.1, 1, 1, 1) }); }
      instanced(new T.BoxGeometry(2.2, 0.1, 0.16), WHITE, sills);
      instanced(new T.BoxGeometry(2.0, 0.06, 0.14), snowM, sillSnow, { ol: false, cast: false });
      // downpipes, every so often (but not down the middle of the doorway)
      for (let x = -MW / 2 + 3.5; x < MW / 2; x += 12) {
        if (x > d0 - MW / 2 - 1.2 && x < d1 - MW / 2 + 1.2) continue;
        scene.add(at(cyl(0.06, 0.06, FH - 0.2, toon('#5a606c'), null, 8), x, (FH - 0.2) / 2, FZ + 0.1));
        lumps.push({ m: mtx(x, 0.06, FZ + 0.05, 0.3, 0.18, 0.2) });
      }
      const iceGeo = new T.ConeGeometry(0.06, 1, 5);
      iceGeo.rotateX(Math.PI);
      const icicles = [];
      for (let x = -MW / 2 + 0.2; x < MW / 2; x += 0.3 + R() * 0.4) { const len = 0.15 + R() * 0.55; icicles.push({ m: mtx(x, FH - 0.2 - len / 2, FZ + 0.12, 1, len, 1), c: '#d4ecfb' }); }
      instanced(iceGeo, WHITE, icicles, { cast: false });
      // the roofline: a bulb every half tile, swagged from tile to tile
      for (let x = -MW / 2; x < MW / 2; x += 0.5) bulbs.push({ p: new V3(x + 0.25, FH - 0.32 - (Math.round(x * 2) % 2 ? 0.1 : 0.04), FZ + 0.2), c: BULBS[Math.abs(Math.round(x * 2)) % BULBS.length] });
      const cx = (d0 + d1) / 2 - MW / 2, cw = d1 - d0 + 1.2;
      scene.add(at(box(cw, 0.45, 1.3, toon('#24408a')), cx, 3.0, FZ + 0.65));
      scene.add(at(box(cw - 0.1, 0.1, 1.2, snowM, { ol: false }), cx, 3.27, FZ + 0.65));
      const sign = new T.Mesh(new T.PlaneGeometry(cw, 0.45), new T.MeshBasicMaterial({ map: tex('sign', 256, 36, (g, w, h) => {
        g.fillStyle = '#24408a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff'; g.font = '900 24px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HAAKON', w / 2, h / 2 + 1);
      }) }));
      sign.position.set(cx, 3.0, FZ + 1.31); scene.add(sign);
      for (const s of [-1, 1]) {
        scene.add(at(box(0.16, 0.28, 0.14, toon('#2a2e38')), cx + s * (cw / 2 + 0.3), 2.5, FZ + 0.08));
        scene.add(at(box(0.1, 0.16, 0.06, basic('#fff2c8'), { ol: false }), cx + s * (cw / 2 + 0.3), 2.48, FZ + 0.16));
      }
      scene.add(at(mesh(new T.TorusGeometry(0.36, 0.11, 8, 22), toon('#2f7a48', needles)), cx, 4.15, FZ + 0.12));
      for (const s of [-1, 1]) scene.add(ball(toon('#c8202a'), cx + s * 0.1, 3.82, FZ + 0.24, 0.1, 0.07, 0.05));
      for (let i = 0; i < 7; i++) { const a = R() * TAU; scene.add(ball(basic('#e03a3a'), cx + Math.cos(a) * 0.36, 4.15 + Math.sin(a) * 0.36, FZ + 0.24, 0.035, 0.035, 0.035, { ol: false, cast: false })); }
      scene.add(at(box(d1 - d0 - 0.3, 0.03, 0.7, toon('#8a2a2a'), { ol: false }), cx, 0.015, FZ + 0.45));
    }

    // ---- the rink: ice, wooden boards with snow on the rail, gates where the map has them, nets ----
    const bt = findTiles('B'), bx = bt.map((b) => b[0]), by = bt.map((b) => b[1]);
    const RINK = {
      x: (TX(Math.min(...bx)) + TX(Math.max(...bx))) / 2, z: (TZ(Math.min(...by)) + TZ(Math.max(...by))) / 2,
      w: Math.max(...bx) - Math.min(...bx), h: Math.max(...by) - Math.min(...by), r: 1.125,
    };
    RINK.tall = RINK.h > RINK.w; // running north to south
    const rinkShape = new T.Shape();
    {
      const w = RINK.w / 2, h = RINK.h / 2, r = RINK.r;
      rinkShape.moveTo(-w + r, -h); rinkShape.lineTo(w - r, -h); rinkShape.quadraticCurveTo(w, -h, w, -h + r);
      rinkShape.lineTo(w, h - r); rinkShape.quadraticCurveTo(w, h, w - r, h); rinkShape.lineTo(-w + r, h);
      rinkShape.quadraticCurveTo(-w, h, -w, h - r); rinkShape.lineTo(-w, -h + r); rinkShape.quadraticCurveTo(-w, -h, -w + r, -h);
    }
    // each net's goal line, through the middle of its two tiles (side by side in the end of a
    // rink running north to south)
    const nets = topLeft('n').map(([x, y]) => (tAt(x + 1, y) === 'n' ? new V3(TX(x) + 0.5, 0, TZ(y)) : new V3(TX(x), 0, TZ(y) + 0.5)));
    const iceTex = tex('ice', RINK.w * 60, RINK.h * 60, (g, w, h) => {
      g.fillStyle = '#d6ebf7'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {
        const x = R() * w, ww = 40 + R() * 160;
        g.fillStyle = i % 2 ? 'rgba(240,250,255,.6)' : 'rgba(255,255,255,.45)';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + ww, 0); g.lineTo(x + ww - 300, h); g.lineTo(x - 300, h); g.fill();
      }
      // the lines, under the scratches: drawn as if the rink ran east to west (lw long by lh
      // across), and turned for one that runs north to south
      const lw = RINK.tall ? h : w, lh = RINK.tall ? w : h;
      g.save();
      if (RINK.tall) { g.translate(w, 0); g.rotate(Math.PI / 2); }
      g.fillStyle = 'rgba(200,40,42,.75)'; g.fillRect(lw / 2 - 7, 0, 14, lh);
      g.fillStyle = 'rgba(40,80,170,.6)'; g.fillRect(lw * 0.34 - 9, 0, 18, lh); g.fillRect(lw * 0.66 - 9, 0, 18, lh);
      g.strokeStyle = 'rgba(40,80,170,.6)'; g.lineWidth = 7; g.beginPath(); g.arc(lw / 2, lh / 2, 90, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(40,80,170,.6)'; g.beginPath(); g.arc(lw / 2, lh / 2, 9, 0, TAU); g.fill();
      for (const n of nets) {
        const nx = (RINK.tall ? n.z - RINK.z + RINK.h / 2 : n.x - RINK.x + RINK.w / 2) * 60, right = RINK.tall ? n.z < RINK.z : n.x < RINK.x;
        g.fillStyle = 'rgba(200,40,42,.6)'; g.fillRect(nx - 4, 24, 8, lh - 48);
        g.fillStyle = 'rgba(120,175,230,.5)'; g.beginPath(); g.arc(nx, lh / 2, 84, right ? -Math.PI / 2 : Math.PI / 2, right ? Math.PI / 2 : Math.PI * 1.5); g.fill();
        for (const dz of [-1, 1]) {
          const fx = nx + (right ? 1 : -1) * 150, fy = lh / 2 + dz * 110;
          g.strokeStyle = 'rgba(200,40,42,.55)'; g.lineWidth = 5; g.beginPath(); g.arc(fx, fy, 70, 0, TAU); g.stroke();
          g.fillStyle = 'rgba(200,40,42,.6)'; g.beginPath(); g.arc(fx, fy, 8, 0, TAU); g.fill();
        }
      }
      g.restore();
      g.fillStyle = 'rgba(36,64,138,.22)'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HAAKON', w / 2, h / 2 - 140);
      // skate marks: long sweeping curves, short stops, and a few hairline cracks
      for (let i = 0; i < 520; i++) {
        g.strokeStyle = R() < 0.7 ? 'rgba(150,175,198,.3)' : 'rgba(255,255,255,.55)'; g.lineWidth = 0.8 + R();
        g.beginPath(); g.arc(R() * w, R() * h, 30 + R() * 220, R() * 6, R() * 6 + 0.25 + R() * 0.8); g.stroke();
      }
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 12); g.stroke(); }
      for (let i = 0; i < 14; i++) {
        let x = R() * w, y = R() * h; g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); }
        g.stroke();
      }
      // snow scraped up against the boards
      const edge = 26, grd = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(246,250,253,.95)'); gr.addColorStop(1, 'rgba(246,250,253,0)'); return gr; };
      g.fillStyle = grd(0, 0, 0, edge); g.fillRect(0, 0, w, edge);
      g.fillStyle = grd(0, h, 0, h - edge); g.fillRect(0, h - edge, w, edge);
      g.fillStyle = grd(0, 0, edge, 0); g.fillRect(0, 0, edge, h);
      g.fillStyle = grd(w, 0, w - edge, 0); g.fillRect(w - edge, 0, edge, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(R() * w, R() * h, 1.2, 1.2); }
    }, 1 / RINK.w, 1 / RINK.h);
    iceTex.offset.set(0.5, 0.5);
    const ice = new T.Mesh(new T.ShapeGeometry(rinkShape, 12), toon(null, iceTex));
    ice.rotation.x = -Math.PI / 2; ice.position.set(RINK.x, 0.02, RINK.z); ice.receiveShadow = true; scene.add(ice);
    {
      // the boards, a plank a metre long at a time; signs painted on the inside of the straight runs
      const pts = rinkShape.getSpacedPoints(Math.round((RINK.w + RINK.h) * 2.2));
      const boards = [], rails = [], caps = [], signs = [[], []];
      let len = 0, k = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        const ax = RINK.x + p.x, az = RINK.z - p.y, bx2 = RINK.x + q.x, bz = RINK.z - q.y;
        const mx = (ax + bx2) / 2, mz = (az + bz) / 2;
        if (tAt(Math.floor(mx + MW / 2), Math.floor(mz + MH / 2)) === '~') continue; // a gate
        len = Math.hypot(bx2 - ax, bz - az) + 0.02;
        const ang = -Math.atan2(bz - az, bx2 - ax);
        boards.push({ m: mtx(mx, 0.275, mz, 1, 1, 1, ang), c: mixc('#ffffff', '#c8b8a0', R() * 0.5) });
        rails.push({ m: mtx(mx, 0.57, mz, 1, 1, 1, ang) });
        if (i % 3 !== 1) caps.push({ m: mtx(mx, 0.62, mz, 0.9, 1, 1, ang) });
        const lx = (p.x + q.x) / 2, ly = (p.y + q.y) / 2, long = Math.abs(lx) < RINK.w / 2 - RINK.r;
        if ((long || Math.abs(ly) < RINK.h / 2 - RINK.r) && i % 4 === 0) {
          // facing in, toward the middle of the ice
          const face = long ? [0, Math.sign(RINK.z - mz)] : [Math.sign(RINK.x - mx), 0];
          signs[k++ % 2].push({ m: mtx(mx + face[0] * 0.045, 0.3, mz + face[1] * 0.045, 1, 1, 1, Math.atan2(face[0], face[1])) });
        }
      }
      instanced(new T.BoxGeometry(len, 0.55, 0.08), toon(null, planks('#c09468', 3, false)), boards);
      instanced(new T.BoxGeometry(len, 0.06, 0.13), toon(null, planks('#8a5a34', 1, false, 1, 0.3)), rails, { ol: false });
      instanced(new T.BoxGeometry(len, 0.05, 0.14), snowM, caps, { ol: false, cast: false });
      ['HAAKON', 'HAPPY HOLIDAYS'].forEach((str, i) => {
        const t = tex('board' + i, 256, 64, (g, w, h) => {
          g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
          g.fillStyle = i ? '#c8202a' : '#24408a'; g.font = '900 ' + (i ? 30 : 40) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(str, w / 2, h / 2 + 2);
          g.globalCompositeOperation = 'destination-out';
          const r = rng(i + 3);
          for (let j = 0; j < 140; j++) { g.fillStyle = 'rgba(0,0,0,' + r() * 0.5 + ')'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 2); } // weathered
          g.globalCompositeOperation = 'source-over';
        });
        instanced(new T.PlaneGeometry(len * 0.92, 0.32), new T.MeshToonMaterial({ map: t, gradientMap: GRAD, transparent: true }), signs[i], { ol: false, cast: false });
      });
    }
    const netTex = tex('net', 32, 32, (g) => { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.strokeRect(1, 1, 30, 30); }, 6, 5);
    for (const n of nets) {
      const g = new T.Group();
      // (built opening east, then turned to face the middle of the ice)
      g.position.copy(n); g.rotation.y = RINK.tall ? (n.z < RINK.z ? -Math.PI / 2 : Math.PI / 2) : n.x < RINK.x ? 0 : Math.PI; scene.add(g);
      const red = toon('#c8262a'), P = (a, b, c) => new V3(a, b, c);
      for (const s of [-1, 1]) {
        g.add(rod(P(0, 0, s * 0.62), P(0, 0.88, s * 0.62), 0.035, red));
        g.add(rod(P(0, 0.03, s * 0.62), P(-0.6, 0.03, s * 0.5), 0.03, red));
        g.add(rod(P(0, 0.88, s * 0.62), P(-0.35, 0.6, s * 0.52), 0.03, red));
      }
      g.add(rod(P(0, 0.88, -0.62), P(0, 0.88, 0.62), 0.035, red));
      g.add(rod(P(-0.6, 0.03, -0.5), P(-0.6, 0.03, 0.5), 0.03, red));
      const nm = new T.Mesh(new T.BoxGeometry(0.56, 0.84, 1.18), new T.MeshBasicMaterial({ map: netTex, transparent: true, side: T.DoubleSide, depthWrite: false }));
      nm.position.set(-0.3, 0.44, 0); g.add(nm);
    }
    // a stick leaning on the outside of the boards by each gate (beside its first tile: west
    // of a gate in the north or south side, north of one in the east or west)
    const [bx0, bx1, by0, by1] = [Math.min(...bx), Math.max(...bx), Math.min(...by), Math.max(...by)];
    findTiles('~').filter(([x, y]) => ((x === bx0 || x === bx1) && tAt(x, y - 1) === 'B') || ((y === by0 || y === by1) && tAt(x - 1, y) === 'B')).forEach(([x, y]) => {
      const side = x === bx0 || x === bx1, out = side ? (x === bx1 ? 1 : -1) : y === by1 ? 1 : -1;
      // along the boards (a) and out from them (o), as a point
      const pt = (a, o, h) => (side ? new V3(TX(x) + out * o, h, TZ(y) + a) : new V3(TX(x) + a, h, TZ(y) + out * o));
      scene.add(rod(pt(-1.2, 0.25, 0.05), pt(-1.05, 0.1, 1.15), 0.022, toon('#d8b07a')));
      const blade = box(side ? 0.035 : 0.3, 0.07, side ? 0.3 : 0.035, toon('#22222a'));
      blade.position.copy(pt(-1.35, 0.27, 0.05)); scene.add(blade);
    });

    // ---- cars, two tiles by three, nosed in toward the edges; some are pickups ----
    topLeft('c').forEach(([x, y], ci) => {
      const g = new T.Group();
      g.position.set(x - MW / 2 + 1, 0, y - MH / 2 + 1.5); g.rotation.y = y < MH / 2 ? Math.PI : 0; scene.add(g);
      const paint = toon(CARS[Math.floor(R() * CARS.length)]), dark = toon('#22262e'), glass = toon(null, glassTex), chrome = toon('#c9d0d8'), pickup = R() < 0.3;
      g.add(at(box(1.7, 0.55, 2.85, paint), 0, 0.55, 0));
      for (const z of [1.45, -1.45]) {
        g.add(at(box(1.74, 0.16, 0.12, dark), 0, 0.38, z)); // bumpers
        const pl = at(new T.Mesh(new T.PlaneGeometry(0.42, 0.13), toon(null, plate(ci))), 0, 0.5, z + Math.sign(z) * 0.005);
        pl.rotation.y = z > 0 ? 0 : Math.PI; g.add(pl);
      }
      g.add(at(box(0.9, 0.18, 0.03, dark, { ol: false }), 0, 0.62, 1.43)); // the grille
      for (const s of [-1, 1]) g.add(at(box(0.08, 0.1, 0.16, paint), s * 0.92, 1.05, pickup ? 0.75 : 0.5)); // mirrors
      if (pickup) {
        g.add(at(box(1.6, 0.6, 1.05, paint), 0, 1.12, 0.3));
        g.add(at(box(1.62, 0.34, 0.86, glass, { ol: false }), 0, 1.17, 0.3));
        g.add(at(box(1.4, 0.34, 1.07, glass, { ol: false }), 0, 1.17, 0.3));
        g.add(at(box(1.5, 0.1, 1.0, snowM, { ol: false }), 0, 1.47, 0.3));
        g.add(at(box(1.5, 0.14, 1.1, snowM, { ol: false }), 0, 0.88, -0.8));
        g.add(at(box(1.66, 0.12, 0.06, dark), 0, 0.88, -1.42)); // tailgate rail
      } else {
        g.add(at(box(1.5, 0.5, 1.5, paint), 0, 1.05, -0.15));
        g.add(at(box(1.52, 0.3, 1.3, glass, { ol: false }), 0, 1.08, -0.15));
        g.add(at(box(1.36, 0.3, 1.52, glass, { ol: false }), 0, 1.08, -0.15));
        g.add(at(box(1.4, 0.12, 1.4, snowM, { ol: false }), 0, 1.36, -0.15));
        for (let i = 0; i < 3; i++) g.add(ball(snowM, (R() - 0.5) * 0.8, 1.43, -0.15 + (R() - 0.5) * 0.8, 0.3, 0.1, 0.25, { ol: false }));
        g.add(ball(snowM, 0, 0.84, 0.95, 0.6, 0.07, 0.35, { ol: false }));
      }
      // wipers (some frozen standing up)
      const up = R() < 0.3;
      for (const s of [-1, 1]) { const wp = at(box(0.5, 0.025, 0.03, dark, { ol: false }), s * 0.3, up ? 1.05 : 0.85, pickup ? 0.86 : 0.62); wp.rotation.z = up ? s * 1.2 : s * 0.1; g.add(wp); }
      for (const [wx, wz] of [[-0.82, 0.92], [0.82, 0.92], [-0.82, -0.92], [0.82, -0.92]]) {
        const w = at(cyl(0.3, 0.3, 0.26, dark, null, 12), wx, 0.3, wz);
        w.rotation.z = Math.PI / 2; g.add(w);
        const hub = at(cyl(0.14, 0.14, 0.02, chrome, { ol: false }, 10), wx + Math.sign(wx) * 0.135, 0.3, wz);
        hub.rotation.z = Math.PI / 2; g.add(hub);
        lumps.push({ m: mtx(g.position.x, 0, g.position.z, 1, 1, 1, g.rotation.y).multiply(mtx(wx, 0.02, wz + (wz > 0 ? 0.32 : -0.32), 0.2, 0.08, 0.14)) }); // snow banked against the tires
      }
      for (const s of [-1, 1]) {
        g.add(at(box(0.32, 0.12, 0.04, basic('#fff2b0'), { ol: false }), s * 0.58, 0.66, 1.44));
        g.add(at(box(0.3, 0.12, 0.04, basic('#d02a2a'), { ol: false }), s * 0.6, 0.66, -1.44));
      }
    });

    // ---- lamp posts with wreaths, and strings of lights criss-crossing the rink ----
    const lamps = [];
    const haloTex = tex('halo', 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    const posts = findTiles('L').map(([x, y]) => new V3(TX(x), 4.4, TZ(y)));
    for (const p of posts) {
      const iron = toon('#2a3442');
      scene.add(at(box(0.36, 0.3, 0.36, toon(null, rock)), p.x, 0.15, p.z));
      scene.add(at(cyl(0.12, 0.14, 0.4, iron, null, 8), p.x, 0.5, p.z));
      scene.add(at(cyl(0.07, 0.09, 4.0, iron, null, 8), p.x, 2.4, p.z));
      scene.add(at(box(0.36, 0.16, 0.36, iron), p.x, 4.45, p.z));
      const cap = at(mesh(new T.ConeGeometry(0.3, 0.22, 4), iron), p.x, 4.64, p.z);
      cap.rotation.y = Math.PI / 4; scene.add(cap);
      scene.add(at(box(0.28, 0.06, 0.28, basic('#fff2c8'), { ol: false }), p.x, 4.35, p.z));
      scene.add(at(mesh(new T.TorusGeometry(0.22, 0.07, 6, 16), toon('#2f7a48', needles)), p.x, 3.0, p.z + 0.1));
      scene.add(ball(toon('#c8202a'), p.x, 2.8, p.z + 0.17, 0.07, 0.05, 0.04));
      lumps.push({ m: mtx(p.x, 0.32, p.z, 0.24, 0.06, 0.24) });
      const l = new T.PointLight('#ffd59a', 0, 14, 1.6);
      l.position.set(p.x, 4.1, p.z); scene.add(l); lamps.push(l);
    }
    // every post to every other one across the rink, as in the flat art
    for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++) {
      if (posts[i].x === posts[j].x) continue;
      const A = posts[i], B = posts[j], n = Math.round(A.distanceTo(B) / 0.6), pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n, p = new V3().lerpVectors(A, B, t); p.y -= 1.1 * 4 * t * (1 - t); pts.push(p); }
      scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: '#1c1a22' })));
      pts.forEach((p, k) => { if (k && k < n) bulbs.push({ p: new V3(p.x, p.y - 0.07, p.z), c: BULBS[(k + i) % BULBS.length] }); });
    }

    // ---- pines: the woods on every blank tile round the edge, and more behind ----
    {
      // the trees on the map's own woods tiles are slimmer and stand back a little, so their
      // branches don't hang over the path beside them
      const spots = [], jit = () => (R() - 0.5) * 0.7;
      for (let y = WALL; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (tAt(x, y) !== ' ') continue;
        const ox = x < MW / 2 ? -0.3 : 0.3, oz = y === MH - 1 ? 0.3 : 0;
        spots.push([TX(x) + ox + (R() - 0.5) * 0.2, TZ(y) + oz + (R() - 0.5) * 0.3, 0.62 + R() * 0.12]);
      }
      const deep = touch ? 4 : 6;
      for (let y = 0; y < MH + deep; y++) for (let k = 1; k <= deep; k++) {
        if (R() < 0.75) spots.push([TX(-k) + jit(), TZ(y) + jit()]);
        if (R() < 0.75) spots.push([TX(MW - 1 + k) + jit(), TZ(y) + jit()]);
      }
      for (let x = 0; x < MW; x++) for (let k = 1; k < deep; k++) if (R() < 0.75) spots.push([TX(x) + jit(), TZ(MH - 1 + k) + jit()]);
      const parts = [{ geo: new T.CylinderGeometry(0.16, 0.2, 0.7, 7), y: 0.35, list: [], mat: toon(null, bark) }];
      for (let i = 0; i < 4; i++) {
        const w = 1.2 - i * 0.26, h = 1.15 - i * 0.12, y = 0.5 + i * 0.6;
        parts.push({ geo: new T.ConeGeometry(w, h, 10), y: y + h / 2, list: [], green: true, mat: toon(null, needles) });
        parts.push({ geo: new T.ConeGeometry(w * 0.5, h * 0.4, 10), y: y + h - h * 0.2, list: [], snow: true, mat: snowM });
      }
      for (const [x, z, slim] of spots) {
        const s = slim || 0.85 + R() * 0.6, M = mtx(x, 0, z, s, s * (0.9 + R() * 0.25), s, R() * TAU), green = mixc('#3f8c5c', '#2a6a44', R());
        for (const p of parts) p.list.push({ m: M.clone().multiply(mtx(0, p.y, 0, 1)), c: p.green ? green : p.snow ? null : '#8a6040' });
        if (!slim && R() < 0.3) lumps.push({ m: mtx(x + 0.6, 0.08, z + 0.5, 0.5, 0.2, 0.4, R()) });
      }
      for (const p of parts) instanced(p.geo, p.mat, p.list, { ol: !p.snow });
    }

    // ---- the big spruce, strung with lights: tall, but not so wide it swallows anyone
    // standing near it ----
    for (const [x, y] of findTiles('Y')) {
      const g = new T.Group(), SPREAD = 1.4;
      g.position.set(TX(x), 0, TZ(y)); g.scale.set(SPREAD, 2.1, SPREAD); scene.add(g);
      g.add(at(cyl(0.16, 0.2, 0.7, toon('#8a6040', bark), null, 8), 0, 0.35, 0));
      for (let i = 0; i < 3; i++) {
        const w = 1.25 - i * 0.32, h = 1.3 - i * 0.18, ty = 0.55 + i * 0.75;
        g.add(at(mesh(new T.ConeGeometry(w, h, 12), toon('#357a52', needles)), 0, ty + h / 2, 0));
        g.add(at(mesh(new T.ConeGeometry(w * 0.45, h * 0.36, 12), snowM, { ol: false }), 0, ty + h - h * 0.18, 0));
        for (let k = 0; k < 12; k++) {
          const a = R() * TAU, t = 0.15 + R() * 0.7, rr = (w * (1 - t) + 0.04) * SPREAD;
          bulbs.push({ p: new V3(TX(x) + Math.cos(a) * rr, (ty + t * h) * 2.1, TZ(y) + Math.sin(a) * rr), c: BULBS[k % BULBS.length] });
        }
      }
      g.add(at(mesh(new T.OctahedronGeometry(0.2), basic('#ffd23a')), 0, 3.22, 0));
      // presents underneath
      [['#c8202a', '#f0d040'], ['#2f6fc0', '#f4f2ec'], ['#3f8c5c', '#c8202a']].forEach(([c, rb], i) => {
        const a = i * 2.1 + 0.4, px = Math.cos(a) * 0.55, pz = Math.sin(a) * 0.55 + 0.25, s = 0.16 + i * 0.03;
        const p = at(box(s, s * 0.8, s, toon(c)), px, s * 0.4, pz); g.add(p);
        g.add(at(box(s + 0.01, s * 0.8 + 0.01, 0.04, toon(rb), { ol: false }), px, s * 0.4, pz));
      });
      snowbank(TX(x), TZ(y), 4, 0.5, 0.5, 0.8);
    }

    // ---- the hot chocolate stand ----
    const steam = [], warm = [];
    for (const [hx, hy] of topLeft('h')) {
      let hw = 0, hh = 0;
      while (tAt(hx + hw, hy) === 'h') hw++;
      while (tAt(hx, hy + hh) === 'h') hh++;
      const cx = hx - MW / 2 + hw / 2, cz = hy - MH / 2 + hh / 2, w = hw;
      const wall = toon(null, planks('#a87448', 6, true, 1, 1)), dark = toon('#6a4428', planks('#8a6040', 1, false));
      scene.add(at(box(w, 2.3, 1.1, wall), cx, 1.15, cz - 0.4));
      scene.add(at(box(w, 1.0, 0.5, toon(null, planks('#c09468', 4, false))), cx, 0.5, cz + 0.45));
      scene.add(at(box(w + 0.1, 0.08, 0.62, dark), cx, 1.04, cz + 0.45));
      for (const s of [-1, 1]) scene.add(rod(new V3(cx + s * (w / 2 - 0.05), 1.05, cz + 0.65), new V3(cx + s * (w / 2 - 0.05), 2.3, cz + 0.65), 0.05, dark));
      const roof = at(box(w + 0.5, 0.14, 2.0, toon(null, shingles)), cx, 2.42, cz);
      roof.rotation.x = 0.1; scene.add(roof);
      const rs = at(box(w + 0.4, 0.12, 1.4, snowM, { ol: false }), cx, 2.53, cz - 0.25);
      rs.rotation.x = 0.1; scene.add(rs);
      const awning = at(box(w + 0.3, 0.05, 0.62, toon(null, tex('awning', 64, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#c8202a'; g.fillRect(i * 8, 0, 8, 8); } }))), cx, 2.2, cz + 1.0);
      awning.rotation.x = 0.38; scene.add(awning);
      const sign = new T.Mesh(new T.PlaneGeometry(w * 0.77, 0.42), toon(null, tex('cocoa', 256, 48, (g, sw, sh) => {
        g.fillStyle = '#6a4428'; g.fillRect(0, 0, sw, sh);
        g.strokeStyle = '#f0d040'; g.lineWidth = 2; g.strokeRect(3, 3, sw - 6, sh - 6);
        g.fillStyle = '#f4f1ea'; g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HOT CHOCOLATE', sw / 2, sh / 2 + 1);
      })));
      sign.position.set(cx, 2.82, cz + 0.42); scene.add(sign);
      // a chalkboard on the side
      const board = new T.Mesh(new T.PlaneGeometry(0.6, 0.8), toon(null, tex('chalk', 96, 128, (g, cw2, ch2) => {
        g.fillStyle = '#2a302c'; g.fillRect(0, 0, cw2, ch2); g.strokeStyle = '#8a6040'; g.lineWidth = 6; g.strokeRect(0, 0, cw2, ch2);
        g.fillStyle = '#f4f1ea'; g.font = '700 15px system-ui, sans-serif'; g.textAlign = 'center';
        ['FREE FOR', 'HAAKON', 'STAFF', '', 'MARSH-', 'MALLOWS!'].forEach((l, i) => g.fillText(l, cw2 / 2, 22 + i * 17));
      })));
      board.position.set(cx + w / 2 + 0.01, 1.4, cz - 0.4); board.rotation.y = Math.PI / 2; scene.add(board);
      scene.add(at(cyl(0.22, 0.2, 0.36, toon('#c9d0d8'), null, 14), cx - w * 0.27, 1.26, cz + 0.4));
      ['#c8202a', '#f4f1ea', '#2f7a48', '#c8202a'].forEach((c, i) => scene.add(at(cyl(0.055, 0.045, 0.13, toon(c), null, 10), cx + 0.1 + (i - 0.5) * 0.25, 1.15, cz + 0.5)));
      for (let i = 0; i < 4; i++) {
        const s = new T.Mesh(SPH, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
        s.userData = { x: cx - w * 0.27 + (R() - 0.5) * 0.15, z: cz + 0.4, off: i / 4 }; scene.add(s); steam.push(s);
      }
      const l = new T.PointLight('#ffb060', 0.3, 6, 2);
      l.position.set(cx, 1.8, cz + 0.9); scene.add(l); warm.push(l);
    }

    // ---- the snowman, in a top hat and a red scarf (and a HAAKON lanyard) ----
    for (const [x, y] of findTiles('s')) {
      const g = new T.Group();
      g.position.set(TX(x), 0, TZ(y)); g.rotation.y = -0.4; scene.add(g);
      g.add(ball(snowM, 0, 0.45, 0, 0.5, 0.47, 0.5)); g.add(ball(snowM, 0, 1.12, 0, 0.36)); g.add(ball(snowM, 0, 1.64, 0, 0.26));
      const coal = basic('#22222c'), dot = { ol: false, cast: false };
      for (const s of [-1, 1]) g.add(ball(coal, s * 0.09, 1.7, 0.225, 0.035, 0.035, 0.03, dot));
      for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; g.add(ball(coal, Math.sin(a) * 0.12, 1.55 - Math.cos(a) * 0.03, 0.235, 0.02, 0.02, 0.02, dot)); }
      for (let i = 0; i < 3; i++) g.add(ball(coal, 0, 0.95 + i * 0.13, 0.35 - Math.abs(i - 1) * 0.02, 0.035, 0.035, 0.03, dot));
      const nose = at(mesh(new T.ConeGeometry(0.045, 0.3, 8), toon('#f08a24')), 0, 1.63, 0.38);
      nose.rotation.x = Math.PI / 2; g.add(nose);
      for (const s of [-1, 1]) {
        g.add(rod(new V3(s * 0.3, 1.18, 0), new V3(s * 0.78, 1.52, 0.05), 0.022, toon('#6a4428')));
        g.add(rod(new V3(s * 0.62, 1.42, 0.04), new V3(s * 0.7, 1.62, 0.06), 0.014, toon('#6a4428')));
      }
      g.add(at(cyl(0.3, 0.3, 0.03, toon('#2a2a34'), null, 20), 0, 1.86, 0));
      g.add(at(cyl(0.18, 0.18, 0.36, toon('#2a2a34'), null, 18), 0, 2.04, 0));
      g.add(at(cyl(0.182, 0.182, 0.06, toon('#c82c34'), { ol: false }, 18), 0, 1.92, 0));
      g.add(ring(0.24, 0.06, toon(null, plaid('#d83a3a', '#5a1010', 5, 1)), 1.42));
      const tail = at(box(0.11, 0.3, 0.04, toon(null, plaid('#d83a3a', '#5a1010', 1, 2))), 0.1, 1.27, 0.26);
      tail.rotation.z = 0.15; g.add(tail);
      const lanyard = at(mesh(new T.TorusGeometry(0.2, 0.012, 4, 20, Math.PI), toon('#24408a'), { ol: false }), 0, 1.36, 0.17);
      lanyard.rotation.z = Math.PI; lanyard.rotation.x = -0.35; g.add(lanyard);
      g.add(at(box(0.1, 0.13, 0.015, toon('#f4f1ea')), 0, 1.13, 0.36));
      snowbank(TX(x), TZ(y), 3, 0.4, 0.4, 0.8);
    }

    // ---- the fire pit, the benches either side of it, and a woodpile ----
    const flames = [], fires = [], embers = [];
    for (const [x, y] of findTiles('f')) {
      const fx = TX(x), fz = TZ(y);
      const ash = new T.Mesh(new T.CircleGeometry(0.5, 20), toon('#3a3434'));
      ash.rotation.x = -Math.PI / 2; ash.position.set(fx, 0.02, fz); scene.add(ash);
      for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; const st = ball(toon(null, rock), fx + Math.cos(a) * 0.55, 0.09, fz + Math.sin(a) * 0.55, 0.17, 0.12, 0.14); st.rotation.y = R() * 3; scene.add(st); }
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        scene.add(rod(new V3(fx + Math.cos(a) * 0.4, 0.06, fz + Math.sin(a) * 0.4), new V3(fx - Math.cos(a) * 0.4, 0.14, fz - Math.sin(a) * 0.4), 0.07, toon('#4a3020', bark)));
      }
      for (let i = 0; i < 14; i++) { const e = ball(basic(R() < 0.5 ? '#ff7a2a' : '#ffc040'), fx + (R() - 0.5) * 0.6, 0.04, fz + (R() - 0.5) * 0.6, 0.03, 0.02, 0.03, { ol: false, cast: false }); scene.add(e); embers.push(e); }
      for (const [c, s, h] of [['#ffcf4a', 0.2, 0.75], ['#ff8a2a', 0.26, 0.6], ['#f04a20', 0.16, 0.45]]) {
        const f = new T.Mesh(new T.ConeGeometry(s, h, 8), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92 }));
        f.position.set(fx + (R() - 0.5) * 0.15, 0.15 + h / 2, fz + (R() - 0.5) * 0.15); scene.add(f); flames.push(f);
      }
      const l = new T.PointLight('#ff9a3c', 1.3, 8, 2);
      l.position.set(fx, 1.1, fz); scene.add(l); fires.push(l);
    }
    // the woodpile, and the chopping block (with the axe in it) on its east end
    for (const [x, y] of topLeft('w')) {
      const logM = toon('#9a6a44', bark), endM = toon(null, tex('rings', 32, 32, (g) => {
        g.fillStyle = '#d9b27a'; g.fillRect(0, 0, 32, 32);
        g.strokeStyle = 'rgba(120,80,40,.6)'; g.lineWidth = 1; for (let k = 3; k < 16; k += 3) { g.beginPath(); g.arc(16, 16, k, 0, TAU); g.stroke(); }
      })), wx = TX(x), wz = TZ(y);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const lg = at(cyl(0.12, 0.12, 0.9, logM, null, 10), wx, 0.12 + row * 0.21, wz - 0.4 + (i + row * 0.5) * 0.25);
        lg.rotation.z = Math.PI / 2; scene.add(lg);
        for (const s of [-1, 1]) { const e = at(new T.Mesh(new T.CircleGeometry(0.1, 10), endM), wx + s * 0.452, lg.position.y, lg.position.z); e.rotation.y = s * Math.PI / 2; scene.add(e); }
      }
      scene.add(ball(snowM, wx, 0.72, wz - 0.05, 0.5, 0.08, 0.5));
      const bx = wx + 1;
      scene.add(at(cyl(0.22, 0.24, 0.4, toon('#9a6a44', bark), null, 12), bx, 0.2, wz));
      const top = at(new T.Mesh(new T.CircleGeometry(0.22, 12), endM), bx, 0.405, wz);
      top.rotation.x = -Math.PI / 2; scene.add(top);
      scene.add(rod(new V3(bx + 0.02, 0.42, wz), new V3(bx + 0.35, 0.95, wz + 0.1), 0.025, toon('#a8743e')));
      scene.add(at(box(0.04, 0.14, 0.16, toon('#c9d0d8')), bx, 0.46, wz));
    }
    // park benches, facing the fire when there's one in the row (someone's left their skate guards on one)
    findTiles('b').forEach(([x, y], i) => {
      const fire = findTiles('f').find(([, fy]) => fy === y), g = new T.Group();
      g.position.set(TX(x), 0, TZ(y)); g.rotation.y = fire ? (fire[0] > x ? Math.PI / 2 : -Math.PI / 2) : 0; scene.add(g);
      const iron = toon('#2c3340'), wood = toon(null, planks('#9a6438', 1, false, 1, 1));
      for (const s of [-1, 1]) { g.add(at(box(0.06, 0.45, 0.42, iron), s * 0.7, 0.225, 0)); g.add(at(box(0.06, 0.5, 0.06, iron), s * 0.7, 0.7, -0.2)); }
      for (const z of [-0.12, 0.08]) g.add(at(box(1.6, 0.05, 0.16, wood), 0, 0.47, z));
      for (const yy of [0.68, 0.86]) g.add(at(box(1.6, 0.12, 0.04, wood), 0, yy, -0.22));
      g.add(ball(snowM, -0.3, 0.5, 0, 0.35, 0.04, 0.15, { ol: false }));
      if (i === 0) for (const s of [-1, 1]) g.add(at(box(0.08, 0.06, 0.32, toon('#d02a2a')), 0.35 + s * 0.08, 0.53, 0));
    });

    // ---- snowbanks where the map has them ----
    for (const [x, y] of findTiles('*')) snowbank(TX(x), TZ(y), 5, 0.5, 0.5);
    for (const [x, y] of findTiles('*').filter(([, y]) => y < MH / 2).slice(0, 1)) {
      // somebody's given up on shovelling and left it stuck in the heap
      const sh = new T.Group();
      sh.position.set(TX(x), 0.3, TZ(y)); sh.rotation.set(-0.3, 0.4, 0.15); scene.add(sh);
      sh.add(at(cyl(0.025, 0.025, 1.2, toon('#8a5a32'), null, 6), 0, 0.75, 0));
      sh.add(at(box(0.16, 0.04, 0.04, toon('#22222a')), 0, 1.36, 0));
      sh.add(at(box(0.42, 0.36, 0.04, toon('#e0a020')), 0, 0.1, 0));
    }
    instanced(SPH, snowM, lumps);

    // ---- the bulbs, twinkling, with halos that come up as it gets dark ----
    const bulbMesh = instanced(SPH, new T.MeshBasicMaterial({ color: '#ffffff' }), bulbs.map((b) => ({ m: mtx(b.p.x, b.p.y, b.p.z, 0.07, 0.09, 0.07), c: b.c })), { ol: false, cast: false });
    const haloGeo = new T.BufferGeometry();
    haloGeo.setAttribute('position', new T.Float32BufferAttribute(bulbs.flatMap((b) => [b.p.x, b.p.y, b.p.z]), 3));
    haloGeo.setAttribute('color', new T.Float32BufferAttribute(bulbs.flatMap((b) => new T.Color(b.c).toArray()), 3));
    const halos = new T.Points(haloGeo, new T.PointsMaterial({ size: 0.9, map: haloTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.2 }));
    halos.frustumCulled = false; scene.add(halos);
    let twinkled = -1;
    function twinkle(t) {
      const k = Math.floor(t / 20);
      if (k === twinkled || !bulbMesh) return;
      twinkled = k;
      const col = new T.Color(), hc = haloGeo.attributes.color;
      bulbs.forEach((b, i) => {
        const on = (k + i * 3) % 7 !== 0;
        col.set(b.c); if (!on) col.multiplyScalar(0.3);
        bulbMesh.setColorAt(i, col);
        hc.setXYZ(i, col.r * (on ? 1 : 0.3), col.g * (on ? 1 : 0.3), col.b * (on ? 1 : 0.3));
      });
      bulbMesh.instanceColor.needsUpdate = true; hc.needsUpdate = true;
    }

    // ---- falling snow: fine flakes and fat ones, drifting east on a light wind, in a box
    // that wraps round wherever the camera is looking ----
    const flakeTex = tex('flake', 32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    });
    const SNOW_W = 60, SNOW_D = 52, SNOW_H = 16;
    const snowfall = [[touch ? 3000 : 7000, 0.15, 1], [touch ? 700 : 1600, 0.34, 1.5]].map(([n, size, speed]) => {
      const pos = new Float32Array(n * 3), spd = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * SNOW_W; pos[i * 3 + 1] = R() * SNOW_H; pos[i * 3 + 2] = (R() - 0.5) * SNOW_D; spd[i] = speed * (0.7 + R() * 0.6); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size, map: flakeTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
      pts.frustumCulled = false; scene.add(pts);
      return { n, pos, spd, geo };
    });

    // ---- light ----
    const hemi = new T.HemisphereLight(DUSK.sky, DUSK.gnd, DUSK.hemi);
    scene.add(hemi);
    const sun = new T.DirectionalLight(DUSK.sunC, DUSK.sun);
    sun.castShadow = true;
    sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 });
    sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.06;
    scene.add(sun); scene.add(sun.target);
    scene.background = new T.Color(DUSK.bg);
    scene.fog = new T.Fog(DUSK.bg, 32, 85);
    lamps.forEach((l) => (l.intensity = DUSK.lamp));
    warm.forEach((l) => (l.intensity = DUSK.warm));
    halos.material.opacity = DUSK.halo;
    facadeMat.emissiveIntensity = DUSK.win;

    // everything that never moves welded together, in patches 16 metres square so what's off
    // screen still isn't drawn (the embers flicker, so they stay apart)
    scene.updateMatrixWorld(true);
    const still = [], wp = new V3();
    scene.traverse((o) => { if (weldable(o) && !embers.includes(o)) still.push(o); });
    merge(scene, still, (m) => { wp.setFromMatrixPosition(m.matrixWorld); return Math.floor(wp.x / 16) + ',' + Math.floor(wp.z / 16) + '|'; });

    // ---------- the camera: high up to the south, following you ----------
    const camera = new T.PerspectiveCamera(30, SW / SH, 0.5, 220);
    const cam = { dist: ZOOMS[0].dist, pitch: ZOOMS[0].pitch };
    let zoom = ZOOMS[0], cssH = 0;
    const focus = new V3(), want = new V3(), fPrev = new V3(), fCur = new V3();
    let primed = false, fTick = null, last = 0, frame = 0;
    const people = new Map(), puck = { mesh: null, tick: null, prev: new V3(), cur: new V3() };
    const world = (px, py, h) => new V3((px + 8) / 16 - MW / 2, h || 0, (py + 8) / 16 - MH / 2);
    // where something is this frame: between last tick's place and this tick's (a jump of
    // more than a tile and a half, like coming through a door, isn't smoothed)
    function between(o, tick, alpha, now, prev, cur) {
      if (o.tick === null || o.tick === undefined) { prev.copy(now); cur.copy(now); }
      else if (o.tick !== tick) { prev.copy(cur); cur.copy(now); if (prev.distanceTo(cur) > 1.5) prev.copy(cur); }
      o.tick = tick;
      return prev.clone().lerp(cur, alpha);
    }

    // bend a leg so its ankle comes to `foot`, with the knee pointing along `fwd` (both in the
    // rig's own terms): the thigh and shin (a and b long) are the two sides of a triangle with
    // the hip, and the hip turns that triangle to face the foot. An arm works the same way,
    // with its elbow pointing along `fwd`
    const _d = new V3(), _n = new V3(), _x = new V3(), _y = new V3(), _z = new V3(), _m = new T.Matrix4();
    function reach(hip, knee, foot, fwd, a, b) {
      _d.subVectors(foot, hip.position);
      const D = clamp(_d.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
      _d.normalize();
      const atHip = Math.acos(clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1));
      const atKnee = Math.acos(clamp((a * a + b * b - D * D) / (2 * a * b), -1, 1));
      _n.crossVectors(_d, fwd).normalize();
      _y.copy(_d).applyAxisAngle(_n, atHip).negate(); // up the thigh
      _z.crossVectors(_n, _y).negate(); // the way the knee points
      _x.crossVectors(_y, _z);
      hip.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      knee.rotation.set(Math.PI - atKnee, 0, 0);
    }
    // A skating stroke, as a share of the whole cycle: each leg pushes, then lifts and comes
    // back under you, then carries you while the other one does the same.
    const PUSH = 0.32, LIFT = 0.18;
    const ease = (x) => x * x * (3 - 2 * x);
    const _h = new V3(), _f = new V3(), _k = new V3(), _inv = new T.Matrix4(), _rq = new T.Quaternion(), _q = new T.Quaternion(), _e = new T.Euler();
    const _g = new V3(), _s = new V3(), _u = new V3(), UP = new V3(0, 1, 0);

    // A hockey stick (it.stick: { k, a, p, hand }, see js/hockey.js): for each thing they do
    // with it, where the blade's heel and the top hand go, in the body's own terms (facing
    // +z, their left +x) for a left shot; a right shot is the mirror image. The stick runs
    // from the heel through the top hand, and both hands are reached on to it.
    const STICK_L = 1.05;
    const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const mix2 = (A, B, k) => [lerp3(A[0], B[0], k), lerp3(A[1], B[1], k)];
    const READY = [[0.24, 0.02, 0.62], [-0.04, 0.92, 0.2]], WOUND = [[0.62, 1.45, -0.3], [-0.05, 1, 0.18]], STRIKE = [[0.2, 0.02, 0.55], [0, 0.9, 0.25]];
    // a swing from `from` through the strike and on to `to`, then back to the ready
    const swing = (from, to, a) => (a < 0.25 ? mix2(from, STRIKE, ease(a / 0.25)) : a < 0.7 ? mix2(STRIKE, to, ease((a - 0.25) / 0.45)) : mix2(to, READY, ease((a - 0.7) / 0.3)));
    function stickPose(k, a, p) {
      switch (k) {
        // stickhandling: a is how far through the side-to-side (the blade's middle where
        // js/hockey.js keeps the puck)
        case 'carry': return [[0.19 + Math.sin(a) * 0.13, 0.02, 0.5 + Math.cos(2 * a) * 0.04], [-0.04 + Math.sin(a) * 0.05, 0.92, 0.2]];
        case 'wind': return mix2(READY, WOUND, ease(a));
        case 'shot': return swing(mix2(READY, WOUND, p || 0), [[-0.35, 0.75, 0.85], [-0.25, 1.05, 0.35]], a);
        case 'pass': return swing(READY, [[-0.1, 0.12, 0.85], [-0.05, 0.95, 0.3]], a);
        case 'poke': return mix2(READY, [[0.12, 0.02, 1.15], [0, 0.9, 0.6]], Math.sin(Math.PI * a));
        case 'check': return mix2(READY, [[0.55, 0.3, 0.3], [-0.12, 1.05, 0.3]], Math.sin(Math.PI * a));
        case 'cheer': return mix2(READY, [[0.15, 2.05, 0.15], [0.05, 1.45, 0.15]], ease(Math.min(1, a * 4)));
        case 'down': return [[0.7, 0.03, 0.35], [0.45, 0.03, -0.65]];
        default: return READY;
      }
    }
    function holdStick(person, st) {
      const hand = st.hand || 1;
      if (!person.stick) {
        const shaft = new T.Group(), tape = toon('#22222a');
        shaft.add(at(box(0.03, STICK_L, 0.022, toon('#d8b07a')), 0, STICK_L / 2, 0));
        shaft.add(at(box(0.034, 0.1, 0.026, tape, { ol: false }), 0, STICK_L - 0.05, 0)); // tape round the knob
        person.stick = { shaft, blade: box(0.27, 0.075, 0.016, tape) };
        person.body.add(shaft); person.body.add(person.stick.blade);
      }
      const { shaft, blade } = person.stick, [heel, top] = stickPose(st.k, st.a, st.p);
      shaft.visible = blade.visible = true;
      _s.set(heel[0] * hand, heel[1], heel[2]);
      _u.set(top[0] * hand - _s.x, top[1] - _s.y, top[2] - _s.z).normalize(); // up the shaft
      shaft.position.copy(_s); shaft.quaternion.setFromUnitVectors(UP, _u);
      // the blade lies flat, pointing away from the hands
      const bl = Math.hypot(_u.x, _u.z) || 1, bx = -_u.x / bl, bz = -_u.z / bl;
      blade.position.set(_s.x + bx * 0.13, _s.y + 0.035, _s.z + bz * 0.13); blade.rotation.y = Math.atan2(-bz, bx);
      if (st.k === 'down') return; // they've let go of it
      // the top hand near the end, the other a little over halfway up, elbows out, down and back
      const { rig, upper } = person;
      rig.updateMatrix(); upper.updateMatrix();
      _inv.multiplyMatrices(rig.matrix, upper.matrix).invert();
      _rq.copy(rig.quaternion).multiply(upper.quaternion).invert();
      for (const [side, along] of [[-hand, STICK_L - 0.06], [hand, STICK_L * 0.6]]) {
        _g.copy(_s).addScaledVector(_u, along).applyMatrix4(_inv);
        _k.set(side * 0.6, -0.4, -0.7).normalize().applyQuaternion(_rq);
        reach(person.arms[side], person.elbows[side], _g, _k, 0.22, 0.25);
      }
    }

    // How someone moves: their legs keep pace with how far they've actually gone (a stride
    // is a little longer the faster they go, so feet don't slide), easing in and out as
    // they start and stop. Walking bends the knees and elbows and twists the shoulders
    // against the hips; at running pace they lean in and pump their arms. On skates they
    // crouch, leaning in from the hips, and each foot in turn pushes out to the side and
    // back with the toe turned out and the blade on its inside edge, lifts and swings back
    // under them, then carries them while the other pushes; the body sways over whichever
    // skate it's on and the arms swing across with the legs. Coasting, both skates are side
    // by side, one a little ahead. Their feet are set on the ice and the legs bent to reach,
    // so the blades stay flat on it.
    function pose(person, it, pos, dt, t) {
      const sk = !!it.skate, coast = sk && it.walk < 0;
      if (person.skates[0].visible !== sk) {
        person.skates.forEach((s) => (s.visible = sk));
        person.boots.forEach((b) => (b.visible = !sk));
      }
      person.root.position.copy(pos);
      const d = person.last ? Math.hypot(pos.x - person.last.x, pos.z - person.last.z) : 0;
      person.last = (person.last || new V3()).copy(pos);
      const moved = d < 1.5 ? d : 0;
      person.spd += (moved / Math.max(dt, 1e-3) - person.spd) * (1 - Math.exp(-dt * 10));
      const going = person.spd > 0.6;
      const to = it.face !== undefined ? it.face : FACING[it.dir];
      if (to !== undefined) person.ang += wrapAngle(to - person.ang) * (1 - Math.exp(-dt * 15));
      person.root.rotation.y = person.ang;
      person.w += ((going && !coast ? 1 : 0) - person.w) * (1 - Math.exp(-dt * 8));
      person.glide += ((going && coast ? 1 : 0) - person.glide) * (1 - Math.exp(-dt * 6));
      // on skates a push carries you a long way, so the legs keep to a skater's unhurried
      // rhythm, only a little quicker the faster you go
      const stride = sk ? Math.max(2.5, person.spd / clamp(0.8 + person.spd * 0.05, 0.9, 1.5)) : clamp(1.5 + person.spd * 0.17, 1.7, 2.9);
      if (!coast) person.cyc = (person.cyc + (moved / stride) * TAU) % (TAU * 64);
      const w = person.w, gl = person.glide, c = person.cyc, run = clamp((person.spd - 3) / 3.5, 0, 1);
      const { rig, upper, hips, knees, arms, elbows, head } = person;
      // breathing while standing still
      rig.scale.y = 1 + Math.sin(t * 2.2 + person.phase) * 0.012 * (1 - w);
      if (sk) {
        const act = Math.max(w, gl);
        // with a hockey stick, lower and further forward, and further still into a check
        const hold = it.stick ? 1 : 0, lunge = hold && it.stick.k === 'check' ? Math.sin(Math.PI * it.stick.a) : 0;
        // the hips over the skate that's carrying you, lowest as the other one finishes its push
        const sway = -Math.sin(c) * 0.06 * w;
        const hipH = 0.685 - 0.04 * act - 0.05 * hold - 0.03 * w * (1 + Math.cos(2 * (c - PUSH * TAU))) / 2;
        const lean = 0.1 + 0.3 * w + 0.22 * gl + 0.2 * hold + 0.3 * lunge;
        rig.rotation.set(lean, 0, -sway * 1.2);
        _h.set(0, HIP_Y * rig.scale.y, 0).applyEuler(rig.rotation);
        rig.position.set(sway, hipH, 0).sub(_h);
        rig.updateMatrix(); _inv.copy(rig.matrix).invert(); _rq.copy(rig.quaternion).invert();
        for (const s of [-1, 1]) {
          const q = (c / TAU + (s > 0 ? 0 : 0.5)) % 1;
          let out = 0, back = 0, lift = 0;
          if (q < PUSH) out = back = ease(q / PUSH);
          else if (q < PUSH + LIFT) { const k = ease((q - PUSH) / LIFT); out = 1 - k; back = 1 - 1.4 * k; lift = Math.sin(Math.PI * (q - PUSH) / LIFT); }
          else back = -0.4 * (1 - (q - PUSH - LIFT) / (1 - PUSH - LIFT));
          // where the ankle goes, in the body's terms: out, back and up as above, or side by
          // side (one a little ahead) when coasting
          _f.set(s * (Math.abs(hips[s].position.x) + 0.02 + 0.15 * out * w), BLADE + 0.02 + 0.08 * lift * w, -0.1 * back * w + s * 0.07 * gl);
          const toe = s * (0.06 + 0.5 * out * w);
          _k.set(Math.sin(toe), 0, Math.cos(toe)).applyQuaternion(_rq);
          reach(hips[s], knees[s], _f.applyMatrix4(_inv), _k, THIGH, SHIN);
          // the skate turns at the ankle to stay flat, tipped on to its inside edge as it pushes
          _q.setFromEuler(_e.set(0, toe, s * 0.3 * out * w, 'YXZ')).premultiply(_rq);
          person.skates[s > 0 ? 1 : 0].quaternion.copy(hips[s].quaternion).multiply(knees[s].quaternion).invert().multiply(_q);
          // arms hang down (not along the leaning back) and swing across, each with the
          // other leg; a little out for balance when coasting
          const fwd = s * Math.sin(c) * w;
          arms[s].rotation.set(lean * 0.8 - 0.8 * fwd + 0.1 * gl, 0, s * (0.16 - 0.2 * fwd + 0.2 * gl));
          elbows[s].rotation.x = -0.25 - 0.35 * act;
        }
        upper.rotation.y = -Math.sin(c) * 0.12 * w * (1 - 0.5 * hold) + (hold ? it.stick.hand || 1 : 0) * 0.5 * lunge; // leading with a shoulder into a check
        head.rotation.x = -lean * 0.75; // looking where they're going
      } else {
        for (const s of [-1, 1]) {
          const ph = c + (s > 0 ? 0 : Math.PI);
          hips[s].rotation.set(-Math.sin(ph) * (0.45 + 0.3 * run) * w, 0, 0);
          knees[s].rotation.x = (0.08 + Math.max(0, Math.cos(ph)) * (0.65 + 0.7 * run)) * w;
          arms[s].rotation.x = Math.sin(ph) * (0.45 + 0.35 * run) * w;
          arms[s].rotation.z = s * (0.12 + 0.04 * run * w);
          elbows[s].rotation.x = -(0.12 + (0.25 + 0.9 * run) * w + Math.max(0, -Math.sin(ph)) * 0.3 * w);
        }
        rig.rotation.set((0.04 + 0.12 * run) * w, 0, Math.sin(c) * 0.035 * w + Math.sin(t * 0.7 + person.phase) * 0.015 * (1 - w));
        upper.rotation.y = Math.sin(c) * (0.1 + 0.08 * run) * w;
        rig.position.set(0, ((Math.cos(2 * c) + 1) / 2) * (0.03 + 0.04 * run) * w - 0.02 * w, 0);
        head.rotation.x = 0;
      }
      if (it.stick) holdStick(person, it.stick);
      else if (person.stick) person.stick.shaft.visible = person.stick.blade.visible = false;
      // knocked over (it.down, 0 to 1): tipped on to one side (it.fall) on the ice, arms and
      // legs out
      const dn = ease(clamp(it.down || 0, 0, 1));
      if (dn > 0) {
        _h.set(0, HIP_Y * rig.scale.y, 0).applyEuler(rig.rotation);
        _g.copy(rig.position).add(_h); // where the hips are
        rig.rotation.set(rig.rotation.x * (1 - dn), rig.rotation.y, rig.rotation.z * (1 - dn) + (it.fall || 1) * 1.4 * dn);
        _h.set(0, HIP_Y * rig.scale.y, 0).applyEuler(rig.rotation);
        rig.position.set(_g.x, _g.y + (0.26 - _g.y) * dn, _g.z).sub(_h);
        for (const s of [-1, 1]) {
          hips[s].quaternion.slerp(_q.setFromEuler(_e.set(-0.3, 0, s * 0.2)), dn);
          knees[s].rotation.x *= 1 - 0.7 * dn;
          arms[s].quaternion.slerp(_q.setFromEuler(_e.set(-0.6, 0, s * 1.1)), dn);
          elbows[s].rotation.x += (-0.5 - elbows[s].rotation.x) * dn;
        }
      }
      // a ring of a team's colour on the ice round their feet
      // their team's ring on the ice round them, filled in while they have the puck (it.full)
      if (it.ring && !person.ring) {
        const mat = new T.MeshBasicMaterial({ color: it.ring, transparent: true, opacity: 0.8, depthWrite: false });
        person.ring = new T.Mesh(new T.RingGeometry(0.42, 0.52, 28), mat);
        person.ring.rotation.x = -Math.PI / 2; person.ring.position.y = 0.04; person.root.add(person.ring);
        person.disc = new T.Mesh(new T.CircleGeometry(0.42, 28), mat);
        person.ring.add(person.disc);
      }
      if (person.ring) {
        person.ring.visible = !!it.ring; person.disc.visible = !!it.full;
        if (it.ring) person.ring.material.color.set(it.ring);
      }
      // a look about while standing still (the head steadies against the twist)
      head.rotation.y = -upper.rotation.y * 0.8 + Math.sin(t * 0.55 + person.phase) * 0.3 * (1 - w) * (1 - gl);
    }

    function draw(f) {
      const now = performance.now(), dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016, t = now / 1000;
      const alpha = clamp(f.alpha || 0, 0, 1);
      last = now; frame++;

      // the view follows you (or whatever f.focus is), but stops short of the edges of the
      // lot; f.view ({ dist, pitch }) holds it at a view of its own instead of the zoom's
      const zv = f.view || zoom;
      cam.dist += (zv.dist - cam.dist) * (1 - Math.exp(-dt * 5));
      cam.pitch += (zv.pitch - cam.pitch) * (1 - Math.exp(-dt * 5));
      const fo = { tick: fTick };
      const p = between(fo, f.t, alpha, world(f.focus[0], f.focus[1]), fPrev, fCur);
      fTick = fo.tick;
      const mx = 0.35 * cam.dist, top = 0.17 * cam.dist, bot = 0.25 * cam.dist;
      want.set(clamp(p.x, -MW / 2 + mx, MW / 2 - mx), 0, clamp(p.z, WALL - MH / 2 + top, MH / 2 - bot));
      if (!primed) { focus.copy(want); primed = true; }
      else focus.lerp(want, 1 - Math.exp(-dt * 7));
      camera.position.set(focus.x, Math.sin(cam.pitch) * cam.dist, focus.z + Math.cos(cam.pitch) * cam.dist);
      camera.lookAt(focus);
      sun.position.set(focus.x - 30, 14, focus.z + 8); sun.target.position.copy(focus); // low in the west, for long shadows
      // outlines about a pixel and a half wide, however close the camera is
      if (cssH) OL_MAT.uniforms.t.value = clamp((1.5 * 2 * cam.dist * Math.tan((camera.fov * Math.PI) / 360)) / cssH, 0.008, 0.035);

      for (const it of f.people) {
        let person = people.get(it.key);
        if (!person) { person = buildPerson(it.spec); people.set(it.key, person); scene.add(person.root); person.ang = it.face !== undefined ? it.face : FACING[it.dir] || 0; }
        person.seen = frame; person.root.visible = true;
        pose(person, it, between(person, f.t, alpha, world(it.px, it.py), person.prev, person.cur), dt, t);
      }
      // a puck (f.puck: [px, py], during a hockey game), half again as big as a real one so
      // it can be seen from up here
      if (f.puck && !puck.mesh) { puck.mesh = at(cyl(0.06, 0.06, 0.038, toon('#18181e'), null, 16), 0, 0, 0); scene.add(puck.mesh); }
      if (puck.mesh) {
        puck.mesh.visible = !!f.puck;
        if (f.puck) puck.mesh.position.copy(between(puck, f.t, alpha, world(f.puck[0], f.puck[1], 0.04), puck.prev, puck.cur));
        else puck.tick = null;
      }
      // anyone who's gone in (or offline) is hidden, and dropped after a while
      for (const [key, person] of people) {
        if (person.seen === frame) continue;
        person.root.visible = false; person.tick = null; person.last = null;
        if (frame - person.seen > 600) { scene.remove(person.root); people.delete(key); }
      }

      flames.forEach((fl, i) => { const s = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12; fl.scale.set(s, 1 + Math.sin(t * (11 + i * 2)) * 0.18, s); });
      fires.forEach((l) => (l.intensity = 1.25 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.1));
      embers.forEach((e, i) => (e.visible = Math.sin(t * (3 + (i % 5)) + i) > -0.3));
      steam.forEach((s) => {
        const k = (t * 0.35 + s.userData.off) % 1;
        s.position.set(s.userData.x + Math.sin(t + k * 6) * 0.06, 1.5 + k * 1.1, s.userData.z);
        s.scale.setScalar(0.07 + k * 0.12); s.material.opacity = 0.55 * (1 - k);
      });
      twinkle(f.t);
      for (const sf of snowfall) {
        const pos = sf.pos;
        for (let i = 0; i < sf.n; i++) {
          let y = pos[i * 3 + 1] - sf.spd[i] * dt;
          if (y < 0) y += SNOW_H;
          pos[i * 3 + 1] = y;
          let x = pos[i * 3] + (0.35 + Math.sin(t * 0.7 + i) * 0.25) * dt, z = pos[i * 3 + 2];
          if (x - focus.x > SNOW_W / 2) x -= SNOW_W; else if (x - focus.x < -SNOW_W / 2) x += SNOW_W;
          if (z - focus.z > SNOW_D / 2) z -= SNOW_D; else if (z - focus.z < -SNOW_D / 2) z += SNOW_D;
          pos[i * 3] = x; pos[i * 3 + 2] = z;
        }
        sf.geo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    }

    function resize(w, h) {
      if (!w || !h) return;
      cssH = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function setZoom(i, now) {
      zoom = ZOOMS[clamp(i | 0, 0, ZOOMS.length - 1)];
      if (now) { cam.dist = zoom.dist; cam.pitch = zoom.pitch; }
    }

    const v = new V3();
    function toScreen(px, py, h) {
      // over whoever's standing there, drawn where they're drawn (the nearest, when two are
      // close together, as skaters fighting for the puck are)
      const pos = world(px, py, h), at = new V3(pos.x, 0, pos.z);
      let best = 1.2;
      for (const person of people.values()) {
        const d = person.seen === frame ? person.root.position.distanceTo(at) : Infinity;
        if (d < best) { best = d; pos.copy(person.root.position); pos.y = h; }
      }
      v.copy(pos).project(camera);
      return [(v.x * 0.5 + 0.5) * SW, (-v.y * 0.5 + 0.5) * SH];
    }

    // ---------- the winter games ----------
    // The games played at the lot's props are drawn by js/winter3d.js, each on a little stage
    // of its own (a scene and a camera), built the first time it's played from the same kit
    // as the lot and drawn with the same renderer.
    const kit = {
      T, V3, TAU, SW, SH, R, rng, clamp, ease, mixc, GRAD, OL_MAT, olGeo, toon, basic, mesh, at, ball, box, cyl, rod, ring, mtx, tex, grit,
      plaid, knit, planks, bark, needles, snowTex, snowM, rock, shingles, haloTex, flakeTex, SPH, HEMI, DUSK, FACING, BULBS, CARS, buildPerson, pose,
    };
    const stages = {};
    let gameLast = 0;
    function drawGame(kind, f) {
      const make = window.WINTER3D && window.WINTER3D[kind];
      if (!make) return null;
      const st = stages[kind] || (stages[kind] = make(kit));
      const now = performance.now(), dt = gameLast ? Math.min((now - gameLast) / 1000, 0.05) : 0.016;
      gameLast = now;
      const cam = st.camera, el = renderer.domElement, aspect = el.width && el.height ? el.width / el.height : SW / SH;
      if (Math.abs(cam.aspect - aspect) > 1e-3) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
      st.draw(f, dt, now / 1000);
      // outlines about a pixel and a half wide where the stage is looking
      if (cssH) OL_MAT.uniforms.t.value = clamp((1.5 * 2 * st.dist * Math.tan((cam.fov * Math.PI) / 360)) / cssH, 0.002, 0.035);
      renderer.render(st.scene, cam);
      return st;
    }

    return { canvas: renderer.domElement, resize, draw, toScreen, setZoom, drawGame };
  }

  return { create };
})();
