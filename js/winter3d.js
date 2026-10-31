// The winter games out in the parking lot (ChopGame, MallowGame, SpruceGame, SnowmanGame,
// CocoaGame and SnowballGame in js/game.js), drawn in 3D in the lot's own look: js/lot3d.js
// lends its kit (the cel-shaded materials and outlines, its textures, people) and its
// renderer. Each game is a little stage of its own, built the first time it's played and
// posed every frame from what the game hands it. The games themselves (the rules, the
// controls and every word on the screen) are all in js/game.js; this only draws. Without
// WebGL nothing here runs, and the games draw themselves flat.
//
//   WINTER3D[kind](kit) -> stage: { scene, camera, dist, draw(f, dt, t), ... }
//
// Each stage measures in the flat game's own pixels (its 320 x 240 screen), turned into
// metres at a scale of its own, so everything is where the game thinks it is. dist is how
// far the camera is from what it's looking at (the outlines are sized by it).
window.WINTER3D = (function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- what every stage has ----------
  // Dusk, as out in the lot: night overhead going pink down at the tree line, the low sun
  // in the west and a soft fill from the sky, woods all round, snow underfoot and more
  // coming down. o: { at: [x, y, z] (about where the camera looks), fov, light (how much
  // brighter than the lot), woods: [near, far, how many], fall: [w, h, d] (the box of falling
  // snow round `at`), shadow (how far the sun's shadows reach) }.
  function stage(K, o) {
    const { T, V3, DUSK: D } = K, [ax, ay, az] = o.at, lit = o.light || 1;
    const scene = new T.Scene();
    scene.background = new T.Color(D.bg);
    scene.fog = new T.Fog(D.bg, o.fog ? o.fog[0] : 16, o.fog ? o.fog[1] : 60);
    const camera = new T.PerspectiveCamera(o.fov || 30, K.SW / K.SH, 0.05, 400);
    scene.add(new T.HemisphereLight(D.sky, D.gnd, 0.85 * lit));
    const sun = new T.DirectionalLight(D.sunC, 0.6 * lit), sh = o.shadow || 5;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 90 });
    sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.03;
    sun.position.set(ax - 30, 14, az + 8); sun.target.position.set(ax, 0, az);
    scene.add(sun, sun.target);
    // the sky, as the flat games paint it
    const sky = new T.Mesh(new T.SphereGeometry(200, 24, 16), new T.MeshBasicMaterial({ map: skyTex(K), side: T.BackSide, fog: false, depthWrite: false }));
    sky.position.set(ax, 0, az); sky.renderOrder = -1; scene.add(sky);
    const ground = new T.Mesh(new T.PlaneGeometry(260, 260), K.toon(null, snowGround(K)));
    ground.rotation.x = -Math.PI / 2; ground.position.set(ax, 0, az); ground.receiveShadow = true; scene.add(ground);
    const wd = o.woods || [12, 30, 160];
    woods(K, scene, ax, az, wd[0], wd[1], wd[2], o.seed || 1);
    // falling snow: fine flakes and fat ones drifting east, wrapping round in a box
    const [bw, bh, bd] = o.fall || [8, 5, 8], R = K.rng(o.seed || 1);
    const falls = [[o.flakes || 900, (o.flake || 0.05), 0.9], [Math.round((o.flakes || 900) / 4), (o.flake || 0.05) * 2, 1.3]].map(([n, size, speed]) => {
      const pos = new Float32Array(n * 3), spd = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = ax + (R() - 0.5) * bw; pos[i * 3 + 1] = R() * bh; pos[i * 3 + 2] = az + (R() - 0.5) * bd; spd[i] = speed * (0.7 + R() * 0.6); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size, map: K.flakeTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
      pts.frustumCulled = false; scene.add(pts);
      return { n, pos, spd, geo };
    });
    function fall(dt, t) {
      for (const f of falls) {
        const p = f.pos;
        for (let i = 0; i < f.n; i++) {
          let y = p[i * 3 + 1] - f.spd[i] * dt;
          if (y < 0) y += bh;
          p[i * 3 + 1] = y;
          let x = p[i * 3] + (0.3 + Math.sin(t * 0.7 + i) * 0.2) * dt;
          if (x > ax + bw / 2) x -= bw;
          p[i * 3] = x;
        }
        f.geo.attributes.position.needsUpdate = true;
      }
    }
    const v = new V3();
    return {
      scene, camera, sun, ground, fall, dist: 5,
      // where a point in the stage is on the 320 x 240 screen
      screen(x, y, z) { v.set(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * K.SW, (-v.y * 0.5 + 0.5) * K.SH]; },
      look(p, at) { camera.position.set(p[0], p[1], p[2]); camera.lookAt(at[0], at[1], at[2]); camera.updateMatrixWorld(); },
    };
  }
  // night overhead, then purple, and pink along the tree line
  function skyTex(K) {
    return K.tex('w3sky', 8, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h / 2);
      [[0, '#141a38'], [0.5, '#1c2448'], [0.64, '#28305a'], [0.76, '#3a3866'], [0.86, '#54426c'], [0.94, '#704e70'], [1, '#8a5a78']].forEach(([s, c]) => gr.addColorStop(s, c));
      g.fillStyle = gr; g.fillRect(0, 0, w, h / 2);
      g.fillStyle = '#262840'; g.fillRect(0, h / 2, w, h / 2);
      const R = K.rng(4);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + R() * 0.5) + ')'; g.fillRect(Math.floor(R() * w), Math.floor(R() * h * 0.3), 1, 1); }
    });
  }
  function snowGround(K) {
    return K.tex('w3ground', 256, 256, (g, w, h) => {
      g.fillStyle = '#eef3f9'; g.fillRect(0, 0, w, h);
      const R = K.rng(21);
      for (let i = 0; i < 40; i++) {
        const x = R() * w, y = R() * h, rad = 10 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, R() < 0.5 ? 'rgba(196,212,234,.5)' : 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { g.save(); g.translate(dx, dy); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = R() < 0.7 ? '#ffffff' : '#c4d8f0'; g.fillRect(R() * w, R() * h, 1, 1); }
      K.grit(g, w, h, 6, 22);
    }, 70, 70);
  }
  // many copies of one thing (trees, mostly), each with its own outline
  function instanced(K, scene, geo, mat, list, o) {
    const { T } = K;
    o = o || {};
    const im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, new T.Color(it.c)); });
    im.castShadow = o.cast !== false; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    if (o.ol !== false) {
      const h = new T.InstancedMesh(K.olGeo(geo), K.OL_MAT, list.length);
      list.forEach((it, i) => h.setMatrixAt(i, it.m));
      h.frustumCulled = false; scene.add(h);
    }
    return im;
  }
  // pines in a ring round (cx, cz), from r0 to r1 out, as the lot's woods are made
  function woods(K, scene, cx, cz, r0, r1, n, seed) {
    const { T } = K, R = K.rng(seed * 7 + 3);
    const parts = [{ geo: new T.CylinderGeometry(0.16, 0.2, 0.7, 7), y: 0.35, list: [], mat: K.toon(null, K.bark) }];
    for (let i = 0; i < 4; i++) {
      const w = 1.2 - i * 0.26, h = 1.15 - i * 0.12, y = 0.5 + i * 0.6;
      parts.push({ geo: new T.ConeGeometry(w, h, 10), y: y + h / 2, list: [], green: true, mat: K.toon(null, K.needles) });
      parts.push({ geo: new T.ConeGeometry(w * 0.5, h * 0.4, 10), y: y + h - h * 0.2, list: [], snow: true, mat: K.snowM });
    }
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = r0 + Math.sqrt(R()) * (r1 - r0), s = 1 + R() * 0.9;
      const M = K.mtx(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d, s, s * (0.9 + R() * 0.3), s, R() * TAU), green = K.mixc('#3f8c5c', '#2a6a44', R());
      for (const p of parts) p.list.push({ m: M.clone().multiply(K.mtx(0, p.y, 0, 1)), c: p.green ? green : p.snow ? null : '#8a6040' });
    }
    for (const p of parts) instanced(K, scene, p.geo, p.mat, p.list, { ol: !p.snow, cast: false });
  }
  // a little spruce of its own (trunk, three tiers, snow on each), h metres tall and r round
  // at the bottom
  function spruce(K, h, r) {
    const { T } = K, g = new T.Group(), s = h / 3.3, sw = (r || 1.25 * s) / 1.25, green = K.toon('#357a52', K.needles);
    g.add(K.at(K.cyl(0.16 * sw, 0.2 * sw, 0.7 * s, K.toon('#8a6040', K.bark), null, 8), 0, 0.35 * s, 0));
    for (let i = 0; i < 3; i++) {
      const w = (1.25 - i * 0.32) * sw, ch = (1.3 - i * 0.18) * s, ty = (0.55 + i * 0.75) * s;
      g.add(K.at(K.mesh(new T.ConeGeometry(w, ch, 12), green), 0, ty + ch / 2, 0));
      g.add(K.at(K.mesh(new T.ConeGeometry(w * 0.45, ch * 0.36, 12), K.snowM, { ol: false }), 0, ty + ch - ch * 0.18, 0));
    }
    return g;
  }
  // a park bench, as in the lot (sitting on it you'd face +z)
  function bench(K) {
    const g = new K.T.Group(), iron = K.toon('#2c3340'), wood = K.toon(null, K.planks('#9a6438', 1, false, 1, 1));
    for (const s of [-1, 1]) { g.add(K.at(K.box(0.06, 0.45, 0.42, iron), s * 0.7, 0.225, 0)); g.add(K.at(K.box(0.06, 0.5, 0.06, iron), s * 0.7, 0.7, -0.2)); }
    for (const z of [-0.12, 0.08]) g.add(K.at(K.box(1.6, 0.05, 0.16, wood), 0, 0.47, z));
    for (const y of [0.68, 0.86]) g.add(K.at(K.box(1.6, 0.12, 0.04, wood), 0, y, -0.22));
    g.add(K.ball(K.snowM, -0.3, 0.5, 0, 0.35, 0.04, 0.15, { ol: false }));
    return g;
  }
  // a lamp post with its warm light (and a wreath on it)
  function lampPost(K, scene, x, z, power) {
    const { T, V3 } = K, iron = K.toon('#2a3442');
    scene.add(K.at(K.cyl(0.07, 0.09, 4.0, iron, null, 8), x, 2.0, z));
    scene.add(K.at(K.box(0.36, 0.16, 0.36, iron), x, 4.05, z));
    const cap = K.at(K.mesh(new T.ConeGeometry(0.3, 0.22, 4), iron), x, 4.24, z);
    cap.rotation.y = Math.PI / 4; scene.add(cap);
    scene.add(K.at(K.box(0.28, 0.06, 0.28, K.basic('#fff2c8'), { ol: false }), x, 3.95, z));
    scene.add(K.at(K.mesh(new T.TorusGeometry(0.22, 0.07, 6, 16), K.toon('#2f7a48', K.needles)), x, 2.6, z + 0.1));
    const halo = new T.Sprite(new T.SpriteMaterial({ map: K.haloTex, color: '#ffd59a', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7 }));
    halo.position.set(x, 3.9, z); halo.scale.set(1.6, 1.6, 1); scene.add(halo);
    const l = new T.PointLight('#ffd59a', power || 1, 12, 1.4);
    l.position.copy(new V3(x, 3.7, z)); scene.add(l);
    return l;
  }
  // a car under a heap of snow
  function car(K, scene, x, z, col, ry) {
    const { T } = K, g = new T.Group(), paint = K.toon(col), dark = K.toon('#22262e'), glass = K.toon(null, K.tex('w3glass', 32, 32, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#5a7290'); gr.addColorStop(1, '#2a3a50'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    }));
    g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g);
    g.add(K.at(K.box(1.7, 0.55, 3.9, paint), 0, 0.55, 0));
    g.add(K.at(K.box(1.5, 0.48, 2.0, glass), 0, 1.06, -0.15));
    for (const sx of [-1, 1]) for (const sz of [-1.25, 1.25]) { const w = K.at(K.cyl(0.32, 0.32, 0.22, dark, null, 12), sx * 0.8, 0.32, sz); w.rotation.z = Math.PI / 2; g.add(w); }
    g.add(K.ball(K.snowM, 0, 1.32, -0.15, 0.85, 0.16, 1.15));
    g.add(K.ball(K.snowM, 0, 0.84, 1.3, 0.85, 0.1, 0.6));
    g.add(K.ball(K.snowM, 0, 0.84, -1.6, 0.85, 0.1, 0.4));
    return g;
  }
  // People from the lot's own builder (HD.person specs), a figure for each key, at a size of
  // their own. Their legs keep up with how far they actually go, as out in the lot. Anyone
  // not posed since the last sweep() is put away (until they're wanted again).
  function crowd(K, parent) {
    const figs = new Map(), at = new K.V3();
    let frame = 0;
    return {
      get(key, spec, scale) {
        let f = figs.get(key);
        if (!f) {
          const p = K.buildPerson(spec), wrap = new K.T.Group();
          wrap.scale.setScalar(scale || 1); wrap.add(p.root); parent.add(wrap);
          f = { p, wrap, s: scale || 1 };
          figs.set(key, f);
        }
        return f;
      },
      // it: { face (which way they face, an angle: 0 is toward +z) }
      pose(f, x, y, z, it, dt, t) {
        f.wrap.visible = true; f.seen = frame;
        K.pose(f.p, it, at.set(x / f.s, y / f.s, z / f.s), dt, t);
      },
      sweep() {
        for (const f of figs.values()) if (f.seen !== frame && f.wrap.visible) { f.wrap.visible = false; f.p.last = null; }
        frame++;
      },
    };
  }
  // a candy cane h metres tall, its foot at the origin and its hook curling over toward -x
  function cane(K, h) {
    const { T, V3 } = K, hr = h * 0.14, pts = [];
    for (let i = 0; i <= 3; i++) pts.push(new V3(0, (h - hr) * i / 3, 0));
    for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI; pts.push(new V3(-hr + Math.cos(a) * hr, h - hr + Math.sin(a) * hr, 0)); }
    pts.push(new V3(-hr * 2, h - hr * 1.6, 0));
    const stripes = K.tex('w3cane', 128, 32, (g, w, hh) => {
      g.fillStyle = '#f8f8f8'; g.fillRect(0, 0, w, hh);
      g.fillStyle = '#e03030';
      for (let x = 0; x < w; x++) for (let y = 0; y < hh; y++) if (((x / w) * 9 + y / hh) % 1 < 0.42) g.fillRect(x, y, 1, 1);
    });
    return K.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, h * 0.065, 8), K.toon(null, stripes));
  }
  // a five-pointed star, r across its points, facing +z
  function starGeo(K, r, depth) {
    const { T } = K, s = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, rr = i & 1 ? r * 0.45 : r;
      if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  // keeps a mesh for each of a game's things (pieces of log, decorations, snowballs) while
  // the game has it, made by make(thing) the first time it's seen
  function keeper(parent, make) {
    const live = new Map();
    return function (list, place) {
      const seen = new Set();
      for (const it of list) {
        let m = live.get(it);
        if (!m) { m = make(it); parent.add(m); live.set(it, m); }
        seen.add(it);
        place(m, it);
      }
      for (const [it, m] of live) if (!seen.has(it)) { parent.remove(m); live.delete(it); }
    };
  }

  // ---------- wood chopping ----------
  // ChopGame's screen at 120 pixels to the metre: the chopping block's top at y 176, the
  // middle of the screen (x 160) the middle of the block. Looking down at it from where
  // you'd stand to chop, the log on the block, its crack running away from you across its
  // top, the axe over it in your mittens and the woodpile growing off to the right.
  function chop(K) {
    const { T, toon, basic, mesh, at, ball, box, cyl } = K;
    const S = 1 / 120, CX = 160, BLOCK = 176, LOG_H = 44, HB = 0.42, H = LOG_H * S;
    const st = stage(K, { at: [0, 0.6, 0], fov: 38, light: 1.15, woods: [8, 24, 190], seed: 2, fall: [4, 3, 4] });
    const { scene } = st;
    st.dist = 2.6;
    const lamp = new T.PointLight('#ffd59a', 0.55, 9, 1.2);
    lamp.position.set(1.6, 2.6, 1.8); scene.add(lamp);
    const rings = K.tex('w3rings', 64, 64, (g) => {
      g.fillStyle = '#e0b878'; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(150,100,50,.55)'; g.lineWidth = 1.5;
      for (let k = 6; k < 32; k += 6) { g.beginPath(); g.arc(32, 32, k, 0, TAU); g.stroke(); }
      g.fillStyle = '#c89858'; g.beginPath(); g.arc(32, 32, 3, 0, TAU); g.fill();
    });
    const endM = toon(null, rings), barkM = toon('#8a5a34', K.bark), logEnds = [barkM, endM, endM];
    // the block, sunk in the snow
    scene.add(at(mesh(new T.CylinderGeometry(0.335, 0.36, HB, 20), [toon('#9a6a44', K.bark), endM, endM]), 0, HB / 2, 0));
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; scene.add(K.ball(K.snowM, Math.cos(a) * 0.38, 0.03, Math.sin(a) * 0.38, 0.2, 0.08, 0.16, { ol: false })); }
    // the log on it: its top, the crack (wider the more it's opened) and any knot
    const logG = new T.Group(); scene.add(logG);
    const logM = mesh(new T.CylinderGeometry(1, 1, 1, 22), logEnds); logG.add(logM);
    const crackM = basic('#2a180c'), UNIT = new T.BoxGeometry(1, 1, 1);
    const crackTop = new T.Mesh(UNIT, crackM), crackFront = new T.Mesh(UNIT, crackM);
    logG.add(crackTop, crackFront);
    const knot = new T.Mesh(new T.CircleGeometry(1, 14), basic('#5a3418')), knotEye = new T.Mesh(new T.CircleGeometry(1, 10), crackM);
    knot.rotation.x = knotEye.rotation.x = -Math.PI / 2; logG.add(knot, knotEye);
    // the axe: its origin at the middle of its edge, which runs along the crack
    const axe = new T.Group(); scene.add(axe);
    const shape = new T.Shape();
    [[-0.1, 0], [0.1, 0], [0.065, 0.07], [0.045, 0.125], [-0.045, 0.125], [-0.065, 0.07]].forEach(([u, w], i) => (i ? shape.lineTo(u, w) : shape.moveTo(u, w)));
    const headGeo = new T.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
    headGeo.rotateY(Math.PI / 2); headGeo.translate(-0.02, 0, 0);
    axe.add(mesh(headGeo, toon('#8890a0')));
    axe.add(at(box(0.043, 0.014, 0.2, basic('#e8f0f8'), { ol: false }), 0, 0.007, 0));
    axe.add(at(box(0.044, 0.03, 0.094, toon('#c03028'), { ol: false }), 0, 0.1, 0));
    axe.add(at(box(0.05, 0.05, 0.1, toon('#5a606c')), 0, 0.15, 0));
    axe.add(at(cyl(0.017, 0.021, 0.62, toon('#b07840'), null, 8), 0, 0.46, 0));
    // your mittens on the handle, your sleeves coming in from where you stand
    const mitt = toon('#c84030'), sleeve = toon('#34405a');
    for (const [y, s] of [[0.56, 1], [0.69, -1]]) {
      axe.add(ball(mitt, 0, y, 0.01, 0.055, 0.062, 0.06));
      axe.add(ball(mitt, s * 0.04, y + 0.02, 0.04, 0.022, 0.03, 0.022));
      axe.add(K.rod(new K.V3(0, y - 0.01, 0.05), new K.V3(s * 0.02, y - 0.04, 0.15), 0.044, sleeve));
    }
    // the woodpile off to the right, a split log at a time
    const pile = [];
    for (let i = 0; i < 40; i++) {
      const row = Math.floor(i / 5), m = at(mesh(new T.CylinderGeometry(0.056, 0.056, 0.36, 10), logEnds), 0.66 + (i % 5) * 0.12 + (row & 1) * 0.06, 0.058 + row * 0.1, -0.45);
      m.rotation.x = Math.PI / 2; m.rotation.y = (i * 1.7) % 1; scene.add(m); pile.push(m);
    }
    // the bits flying off: halves of a split log (its fresh face pale) and splinters
    const half = (p) => {
      const g = new T.Group(), side = p.vx < 0 ? -1 : 1, r = p.r * S;
      const shell = mesh(new T.CylinderGeometry(r, r, H, 14, 1, false, side < 0 ? Math.PI : 0, Math.PI), logEnds);
      const face = new T.Mesh(new T.PlaneGeometry(2 * r, H), toon('#e0b878'));
      face.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      shell.add(face); shell.position.x = side < 0 ? r / 2 : -r / 2;
      g.add(shell); g.userData.r = r;
      return g;
    };
    const pieces = keeper(scene, (p) => (p.chip ? mesh(new T.BoxGeometry(p.w * S, p.h * S, 0.03), toon('#c89858')) : half(p)));

    st.draw = function (f, dt, t) {
      // the log, dropping on to the block
      const L = f.log;
      logG.visible = !!L;
      if (L) {
        const r = L.w / 2 * S, cx = L.crack * S, cw = Math.max(1, Math.round((L.tol - 3) / 2)) * S, chord = Math.sqrt(Math.max(0, r * r - cx * cx));
        logG.position.y = HB + f.drop * f.drop * 0.6 * S;
        logM.scale.set(r, H, r); logM.position.y = H / 2;
        crackTop.scale.set(cw, 0.004, chord * 1.96); crackTop.position.set(cx, H + 0.002, 0);
        const len = (9 + (L.tol - 5) * 2) * S;
        crackFront.scale.set(cw, len, 0.006); crackFront.position.set(cx, H - len / 2, chord); crackFront.rotation.y = Math.asin(clamp(cx / r, -1, 1));
        knot.visible = knotEye.visible = L.knot !== null;
        if (L.knot !== null) {
          knot.position.set(L.knot * S, H + 0.003, 0); knot.scale.set(3.5 * S, 3.5 * S, 1);
          knotEye.position.set(L.knot * S, H + 0.004, 0); knotEye.scale.set(1.5 * S, 1.5 * S, 1);
        }
      }
      // the axe, leaning back toward you, swaying as you heft it
      // (the higher it goes, the less of it there is to see: it'd be off the top otherwise)
      const up = (BLOCK - f.ay) * S;
      axe.position.set((f.ax - CX) * S, HB + (up > 0.55 ? 0.55 + (up - 0.55) * 0.6 : up), 0);
      axe.rotation.set(0.3 + f.power * 0.25, 0, -f.sway * 0.004);
      pile.forEach((m, i) => (m.visible = i < f.pile));
      pieces(f.pieces, (m, p) => {
        let y = HB + (BLOCK - p.y) * S;
        const low = p.chip ? 0.02 : m.userData.r * 0.8;
        if (y <= low) { y = low; if (m.userData.land === undefined) m.userData.land = p.a; } // (landed in the snow)
        m.position.set((p.x - CX) * S, y, p.chip ? 0.05 : 0);
        m.rotation.z = -(m.userData.land === undefined ? p.a : m.userData.land);
        if (!p.chip) m.scale.x = p.w * S / m.userData.r;
      });
      const sh = f.shake > 0.5 ? f.shake * 0.004 : 0;
      st.look([0.75 + (Math.random() - 0.5) * sh, 1.45 + (Math.random() - 0.5) * sh, 2.4], [0.05, 0.78, 0]);
      st.fall(dt, t);
    };
    return st;
  }

  // ---------- toasting marshmallows ----------
  // MallowGame's screen at 100 pixels to the metre: the fire's base at y 202 in the middle.
  // The fire pit in front of you, the marshmallow on the end of a stick coming in from the
  // right, its four sides toasting as it turns, and a bench behind the fire.
  function mallow(K) {
    const { T, toon, at, ball, rod } = K;
    const S = 1 / 100, MX = 160, Y = (py) => 0.1 + (202 - py) * S;
    const TOAST = [[0, [246, 242, 232]], [0.35, [240, 216, 156]], [0.62, [218, 156, 70]], [0.85, [146, 84, 36]], [1, [46, 28, 18]]];
    const toast = (v, out) => {
      v = clamp(v, 0, 1);
      let i = 0;
      while (i < TOAST.length - 2 && v > TOAST[i + 1][0]) i++;
      const [a, ca] = TOAST[i], [b, cb] = TOAST[i + 1], k = (v - a) / (b - a);
      for (let c = 0; c < 3; c++) out[c] = (ca[c] + (cb[c] - ca[c]) * k) / 255;
      return out;
    };
    const st = stage(K, { at: [0, 0.6, 0], light: 0.95, woods: [7, 24, 180], seed: 3, fall: [6, 4, 5] });
    const { scene } = st;
    st.dist = 4.5;
    st.look([0, 1.55, 4.45], [0, 0.92, 0]);
    const b = bench(K); b.position.set(0, 0, -1.7); scene.add(b);
    for (const s of [-1, 1]) { const b2 = bench(K); b2.position.set(s * 2.1, 0, -0.2); b2.rotation.y = -s * Math.PI / 2; scene.add(b2); }
    // the fire pit: ash, a ring of stones and the logs
    const ash = new T.Mesh(new T.CircleGeometry(0.5, 20), toon('#3a3434'));
    ash.rotation.x = -Math.PI / 2; ash.position.y = 0.012; scene.add(ash);
    for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; const s = ball(toon('#7a7e8a', K.rock), Math.cos(a) * 0.56, 0.07, Math.sin(a) * 0.46, 0.12, 0.09, 0.11); s.rotation.y = a * 2; scene.add(s); }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + 0.3;
      scene.add(rod(new K.V3(Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.3), new K.V3(-Math.cos(a) * 0.38, 0.14, -Math.sin(a) * 0.3), 0.055, toon('#4a3020', K.bark)));
    }
    const glow = new T.Mesh(new T.CircleGeometry(2, 32), new T.MeshBasicMaterial({ map: K.haloTex, color: '#f8a03c', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; scene.add(glow);
    const light = new T.PointLight('#ff9a3c', 1, 7, 1.4);
    light.position.set(0, 0.45, 0.3); scene.add(light);
    // the flames: tongues of red, orange and yellow, as tall as the fire is big
    const CONE = new T.ConeGeometry(1, 1, 8); CONE.translate(0, 0.5, 0);
    const FLAME = ['#d84818', '#f89828', '#f8e870'];
    const flameMats = FLAME.map((c) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92, depthWrite: false }));
    function tongue(parent, x, y, z) {
      const g = new T.Group(); g.position.set(x, y, z); parent.add(g);
      const cones = flameMats.map((m, k) => { const c = new T.Mesh(CONE, m); c.renderOrder = 2 + k; c.position.z = k * 0.012; g.add(c); return c; });
      return { g, size(w, h) { g.visible = h > 0.005; cones.forEach((c, k) => c.scale.set(w * [1, 0.66, 0.33][k], h * [1, 0.7, 0.4][k], w * [1, 0.66, 0.33][k])); } };
    }
    const tongues = [];
    for (let i = 0; i < 7; i++) tongues.push(tongue(scene, (-36 + i * 12) * S, 0.11, i % 2 ? -0.08 : 0.06));
    // embers drifting up
    const EMB = 200, epos = new Float32Array(EMB * 3), ecol = new Float32Array(EMB * 3), eg = new T.BufferGeometry();
    eg.setAttribute('position', new T.BufferAttribute(epos, 3)); eg.setAttribute('color', new T.BufferAttribute(ecol, 3));
    const embers = new T.Points(eg, new T.PointsMaterial({ size: 0.035, vertexColors: true, map: K.flakeTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    embers.frustumCulled = false; scene.add(embers);
    const hot = new T.Color('#f8c048'), cool = new T.Color('#c05020');
    // the marshmallow: a soft-edged cylinder lying along the stick, each side coloured by
    // how toasted it is (the one facing the fire, the one facing you, the top, the back)
    const MR = 0.12, ML = 0.25, RR = 0.05, prof = [[0, -ML / 2]];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; prof.push([MR - RR + Math.sin(a) * RR, -ML / 2 + RR - Math.cos(a) * RR]); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; prof.push([MR - RR + Math.cos(a) * RR, ML / 2 - RR + Math.sin(a) * RR]); }
    prof.push([0, ML / 2]);
    const mg = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 32);
    mg.rotateZ(-Math.PI / 2);
    const mcol = new Float32Array(mg.attributes.position.count * 3);
    mg.setAttribute('color', new T.BufferAttribute(mcol, 3));
    const held = new T.Group(); scene.add(held);
    const mm = K.mesh(mg, new T.MeshToonMaterial({ vertexColors: true, gradientMap: K.GRAD }));
    held.add(mm);
    held.add(rod(new K.V3(-0.05, 0, 0), new K.V3(1.9, -0.46, 0.8), 0.013, toon('#8a6038')));
    const burn = [];
    for (let i = 0; i < 4; i++) burn.push(tongue(held, -0.09 + i * 0.06, MR * 0.6, 0.02));
    const sideCol = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], c3 = [0, 0, 0];
    function colour(f) {
      for (let k = 0; k < 4; k++) toast(f.sides[(f.turn + k) % 4], sideCol[k]);
      const p = mg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        // (which way this bit faces: 0 the fire, 1 you, 2 up, 3 away)
        const kf = Math.atan2(p.getZ(i), -p.getY(i)) / (Math.PI / 2), k0 = Math.floor(kf), w = clamp((kf - k0 - 0.4) / 0.2, 0, 1);
        const A = sideCol[(k0 + 4) % 4], B = sideCol[(k0 + 5) % 4];
        for (let c = 0; c < 3; c++) c3[c] = A[c] + (B[c] - A[c]) * w;
        mcol[i * 3] = c3[0]; mcol[i * 3 + 1] = c3[1]; mcol[i * 3 + 2] = c3[2];
      }
      mg.attributes.color.needsUpdate = true;
    }

    st.draw = function (f, dt, t) {
      const fire = f.fire, fh = (8 + fire * 26 + (f.warn ? 6 : 0)) * S;
      tongues.forEach((tg, i) => {
        const hh = fh * (0.55 + 0.45 * Math.abs(Math.sin(f.t * 0.17 + i * 1.7))) * (i === 0 || i === 6 ? 0.6 : 1);
        tg.size(0.09, hh); tg.g.rotation.z = Math.sin(f.t * 0.2 + i) * 0.12;
      });
      light.intensity = 0.4 + fire * 0.7 + Math.sin(t * 13) * 0.08;
      glow.material.opacity = 0.18 + fire * 0.16 + Math.sin(f.t * 0.3) * 0.03;
      const n = Math.min(EMB, f.embers.length);
      for (let i = 0; i < n; i++) {
        const e = f.embers[i], c = e.life > 30 ? hot : cool;
        epos[i * 3] = (e.x - MX) * S; epos[i * 3 + 1] = Y(e.y); epos[i * 3 + 2] = Math.sin(i * 12.9) * 0.25;
        ecol[i * 3] = c.r; ecol[i * 3 + 1] = c.g; ecol[i * 3 + 2] = c.b;
      }
      eg.setDrawRange(0, n); eg.attributes.position.needsUpdate = eg.attributes.color.needsUpdate = true;
      held.position.set(0, Y(f.y), 0);
      mm.rotation.x = -f.roll / 8 * Math.PI / 2;
      colour(f);
      burn.forEach((tg, i) => { tg.size(0.05, f.burning ? (10 + Math.abs(Math.sin(f.t * 0.3 + i * 2)) * 10) * S : 0); });
      st.fall(dt, t);
    };
    return st;
  }

  // ---------- decorating the spruce ----------
  // SpruceGame's screen at 100 pixels to the metre: the trunk's foot at y 214 in the middle.
  // The tree turns in front of you (decorations are hung on it all the way round, where the
  // front of it is), your mitten holding up the next one; the star swings over the top at
  // the end. Its tiers (f.tiers, the game's) are made the first time it's drawn.
  function spruceGame(K) {
    const { T, V3, toon, basic, mesh, at, ball, box, cyl } = K;
    const S = 1 / 100, CX = 160, Y = (py) => (214 - py) * S, MID = 0.055;
    const BALLS = { red: '#e03838', gold: '#f0c030', blue: '#3c7ce8', purple: '#a050d8', silver: '#d8e0e8' };
    const BULB = ['#f8f040', '#f05050', '#60e070', '#60b0f8'];
    const st = stage(K, { at: [0, 1, 0], light: 1.05, woods: [8, 26, 190], seed: 4, fall: [6, 4, 6] });
    const { scene } = st;
    st.dist = 5.6;
    st.look([0, 1.45, 5.6], [0, 0.88, 0]);
    lampPost(K, scene, -2.6, -1.2, 0.8);
    const tree = new T.Group(); scene.add(tree);
    let rAt = null, bulbs = null;
    const spot = (a, py, out) => { const r = (rAt(py) + 3) * S; return out.set(r * Math.sin(a), Y(py), r * Math.cos(a)); };
    function build(f) {
      rAt = f.rAt;
      tree.add(at(cyl(0.08, 0.1, 0.22, toon('#6a4428', K.bark), null, 10), 0, 0.11, 0));
      const green = toon('#357a52', K.needles);
      for (const [y0, y1, hw] of f.tiers) {
        // a cone with its bottom edge scalloped into branch tips
        const h = (y1 - y0) * S, r = hw * S, geo = new T.ConeGeometry(r, h, 28, 1);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          if (p.getY(i) > -h / 2 + 1e-4 || Math.hypot(x, z) < r * 0.5) continue;
          const k = Math.round(Math.atan2(x, z) / (TAU / 28));
          if (k & 1) { p.setX(i, x * 0.86); p.setZ(i, z * 0.86); p.setY(i, -h / 2 + 0.035); }
        }
        geo.computeVertexNormals();
        tree.add(at(mesh(geo, green), 0, Y(y1) + h / 2, 0));
        tree.add(at(mesh(new T.ConeGeometry(r * 0.42, h * 0.34, 16), K.snowM, { ol: false }), 0, Y(y0) - h * 0.17, 0));
        for (let k = 0; k < 14; k += 2) { const a = k * TAU / 28; tree.add(ball(K.snowM, Math.sin(a) * r * 0.97, Y(y1) + 0.03, Math.cos(a) * r * 0.97, 0.045, 0.018, 0.045, { ol: false })); }
      }
      // presents underneath, turning with it
      [['#c8202a', '#f0d040'], ['#2f6fc0', '#f4f2ec'], ['#3f8c5c', '#c8202a'], ['#a050d8', '#f0d040']].forEach(([c, rb], i) => {
        const a = i * 1.7 + 0.4, s = 0.16 + (i % 3) * 0.04, px = Math.sin(a) * 0.7, pz = Math.cos(a) * 0.7;
        const g = new T.Group(); g.position.set(px, s * 0.4, pz); g.rotation.y = a; tree.add(g);
        g.add(box(s, s * 0.8, s, toon(c)));
        g.add(box(s + 0.01, s * 0.8 + 0.01, 0.04, toon(rb), { ol: false }));
        g.add(box(0.04, s * 0.8 + 0.012, s + 0.01, toon(rb), { ol: false }));
      });
      tree.add(at(K.ball(K.snowM, 0, 0, 0, 1.3, 0.12, 1.3, { ol: false }), 0, 0, 0));
      // the lights already on it, all the way round (where the game has them)
      const list = f.bulbs.map((b) => { const r = (rAt(b.y) + 1) * S; return { m: K.mtx(r * Math.sin(b.a), Y(b.y), r * Math.cos(b.a), 0.018), c: '#ffffff' }; });
      bulbs = instanced(K, tree, K.SPH, new T.MeshBasicMaterial({ color: '#ffffff' }), list, { ol: false, cast: false });
    }
    // the decorations: baubles, candy canes and bows, each hanging from where its origin is
    function deco(k) {
      const g = new T.Group();
      if (BALLS[k]) {
        g.add(ball(toon(BALLS[k]), 0, -0.058, 0, 0.05, 0.05, 0.05));
        g.add(at(cyl(0.014, 0.014, 0.016, toon('#b8a060'), null, 8), 0, -0.006, 0));
        g.add(ball(basic('#ffffff'), -0.018, -0.042, 0.038, 0.01, 0.012, 0.006, { ol: false, cast: false }));
      } else if (k === 'cane') {
        const c = cane(K, 0.15); c.position.set(0.02, -0.14, 0); g.add(c);
      } else {
        const red = toon('#d02830');
        for (const s of [-1, 1]) { const l = ball(red, s * 0.042, -0.03, 0, 0.042, 0.028, 0.016); l.rotation.z = s * 0.35; g.add(l); }
        for (const s of [-1, 1]) { const tl = at(box(0.018, 0.06, 0.008, red), s * 0.02, -0.07, 0); tl.rotation.z = s * 0.4; g.add(tl); }
        g.add(ball(toon('#f05858'), 0, -0.03, 0.006, 0.017, 0.02, 0.016));
      }
      return g;
    }
    const hung = keeper(tree, (o) => deco(o.k)), falling = keeper(tree, (o) => deco(o.k));
    // your mitten at the front of the tree, holding up the next one
    const hand = new T.Group(); scene.add(hand);
    const mitt = toon('#c84030');
    hand.add(ball(mitt, 0, 0.05, 0.01, 0.045, 0.05, 0.045));
    hand.add(ball(mitt, 0.035, 0.04, 0.03, 0.017, 0.024, 0.017));
    const cuffM = at(cyl(0.04, 0.044, 0.05, toon('#20242c'), null, 10), 0, 0.1, 0.02);
    hand.add(cuffM);
    const holding = {};
    // the star: swinging over the top, then on it (or off it), and where it goes till then
    const star = mesh(starGeo(K, 0.11, 0.035), toon('#f8d840'));
    const starGlow = new T.Sprite(new T.SpriteMaterial({ map: K.haloTex, color: '#ffe680', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.8 }));
    starGlow.scale.set(0.6, 0.6, 1); star.add(starGlow);
    const ghost = mesh(starGeo(K, 0.06, 0.02), toon('#686048'));
    const guide = new T.Mesh(new T.BoxGeometry(0.006, 1, 0.006), new T.MeshBasicMaterial({ color: '#f8d840', transparent: true, opacity: 0.5 }));
    scene.add(star, ghost, guide);
    const col = new T.Color(), dark = new T.Color('#183a20'), tmp = new V3();

    st.draw = function (f, dt, t) {
      if (!rAt) build(f);
      tree.rotation.y = f.rot;
      // the lights twinkling, a few at a time
      const k = f.t >> 4;
      for (let i = 0; i < f.bulbs.length; i++) bulbs.setColorAt(i, (k + i) % 5 ? col.set(BULB[i % 4]) : dark);
      bulbs.instanceColor.needsUpdate = true;
      hung(f.hung, (m, o) => { spot(o.a, o.y, m.position); m.rotation.y = o.a; });
      falling(f.falling, (m, o) => {
        if (m.userData.r === undefined) m.userData.r = (rAt(o.y0) + 3) * S;
        const r = m.userData.r;
        m.position.set(r * Math.sin(o.a), Y(o.y), r * Math.cos(o.a)); m.rotation.y = o.a; m.rotation.z += 0.08;
      });
      // the mitten, at the front of the tree (in front of the branches)
      hand.visible = f.state === 'play';
      if (hand.visible) {
        hand.position.set(0, Y(f.hy), (rAt(f.hy) + 3) * S + 0.04);
        for (const kd in holding) holding[kd].visible = false;
        if (!holding[f.cur]) { holding[f.cur] = deco(f.cur); hand.add(holding[f.cur]); }
        holding[f.cur].visible = true;
      }
      ghost.visible = !f.star;
      ghost.position.set(0, Y(28), 0);
      star.visible = guide.visible = !!f.star;
      if (f.star) {
        star.position.set((f.star.x - CX) * S, Y(f.star.y), 0.02);
        star.rotation.z = f.star.off ? star.rotation.z - 0.12 : 0;
        guide.visible = !f.star.drop;
        const top = Y(f.star.y) - 0.12, bot = Y(28) + 0.12;
        guide.scale.y = Math.max(0.01, top - bot); guide.position.set(star.position.x, (top + bot) / 2, 0.02);
      }
      st.fall(dt, t);
      tree.updateMatrixWorld();
    };
    // where (the middle of) a decoration hung at angle a, py down the screen, is on the
    // screen right now, and whether it's on the side facing you
    st.at = (a, py) => {
      spot(a, py, tmp).y -= MID;
      tree.localToWorld(tmp);
      const front = tmp.z > 0;
      return [...st.screen(tmp.x, tmp.y, tmp.z), front];
    };
    // how many screen pixels to a game pixel at the front of the tree
    st.scale = (py) => {
      const z = (rAt(py) + 3) * S, a = st.screen(0, Y(py), z), b = st.screen(0.2, Y(py), z);
      return (b[0] - a[0]) / (0.2 / S);
    };
    st.hand = (py) => st.screen(0, Y(py) - MID, (rAt(py) + 3) * S + 0.04);
    return st;
  }

  // ---------- building a snowman ----------
  // SnowmanGame's field at 36 pixels to the metre (its middle, x 160 y 132, in the middle),
  // seen from high up to the south: fresh snow over the grass where it hasn't been rolled
  // up yet, a low fence round it, its spruces, and you pushing the ball. Then, beside a
  // measuring stick, the snowman stacked up at its true size (a pixel to 1.6 cm, as the
  // game measures it).
  function snowman(K) {
    const { T, V3, toon, basic, mesh, at, ball, cyl, rod } = K;
    const S = 1 / 36, B = 0.016, SX = 110, FLOOR = 204;
    const fx = (px) => (px - 160) * S, fz = (py) => (py - 132) * S;
    const st = stage(K, { at: [0, 0, 0], light: 1.1, woods: [7.5, 26, 210], seed: 5, fall: [12, 6, 10], flake: 0.06, shadow: 7 });
    const { scene } = st;
    const field = new T.Group(), built = new T.Group();
    scene.add(field, built);
    const crew = crowd(K, field);
    // the snowballs' snow, with bits of grass and leaves rolled up in it so you can see them turn
    const ballTex = K.tex('w3snowball', 128, 64, (g, w, h) => {
      g.fillStyle = '#f6f9fd'; g.fillRect(0, 0, w, h);
      const R = K.rng(31);
      for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(176,196,222,' + (0.25 + R() * 0.3) + ')'; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 7, 0, TAU); g.fill(); }
      for (let i = 0; i < 18; i++) { g.fillStyle = R() < 0.5 ? '#7d8c6a' : '#8a6a44'; g.fillRect(R() * w, 6 + R() * (h - 12), 2 + R() * 2, 1 + R() * 2); }
    });
    const ballM = toon(null, ballTex);
    let fieldTex = null, cv = null, g2 = null, prev = null, grid = null;
    // the field: paints each patch of it, snow or the bare grass where it's been rolled up
    // (with a lip of snow along the edge of what's left)
    function paintCell(gx, gy) {
      const C = 16, x = gx * C, y = gy * C, at2 = (i, j) => (i < 0 || j < 0 || i >= grid.GW || j >= grid.GH ? 1 : grid.snow[j * grid.GW + i]);
      if (grid.snow[gy * grid.GW + gx]) {
        g2.fillStyle = '#f2f6fc'; g2.fillRect(x, y, C, C);
        g2.fillStyle = 'rgba(190,206,230,.6)'; g2.fillRect(x + (gx * 7 + gy * 3) % 13, y + (gx * 5 + gy * 11) % 13, 2, 2);
      } else {
        g2.fillStyle = '#7d8c6a'; g2.fillRect(x, y, C, C);
        g2.fillStyle = '#6a7858';
        for (let k = 0; k < 3; k++) g2.fillRect(x + (gx * 3 + gy * 5 + k * 7) % 14, y + (gx * 5 + gy + k * 5) % 14, 2, 2);
        g2.fillStyle = '#8e9c78'; g2.fillRect(x + (gx * 11 + gy * 3) % 13, y + (gx + gy * 7) % 13, 2, 1);
        g2.fillStyle = 'rgba(214,224,240,.9)';
        if (at2(gx - 1, gy)) g2.fillRect(x, y, 3, C);
        if (at2(gx + 1, gy)) g2.fillRect(x + C - 3, y, 3, C);
        if (at2(gx, gy - 1)) g2.fillRect(x, y, C, 3);
        if (at2(gx, gy + 1)) g2.fillRect(x, y + C - 3, C, 3);
      }
    }
    function makeField(f) {
      grid = { GW: f.GW, GH: f.GH };
      const W = f.GW * f.CELL * S, D = f.GH * f.CELL * S;
      cv = document.createElement('canvas'); cv.width = f.GW * 16; cv.height = f.GH * 16; g2 = cv.getContext('2d');
      fieldTex = new T.CanvasTexture(cv); fieldTex.anisotropy = 4;
      const plane = new T.Mesh(new T.PlaneGeometry(W, D), toon(null, fieldTex));
      plane.rotation.x = -Math.PI / 2; plane.position.set(fx(f.X0) + W / 2, 0.005, fz(f.Y0) + D / 2); plane.receiveShadow = true; field.add(plane);
      // a low fence round it
      const wood = toon('#8a6040', K.bark), x0 = fx(f.X0) - 0.15, x1 = fx(f.X0) + W + 0.15, z0 = fz(f.Y0) - 0.15, z1 = fz(f.Y0) + D + 0.15;
      const side = (ax, az, bx, bz) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.1);
        for (let i = 0; i <= n; i++) field.add(at(cyl(0.035, 0.04, 0.42, wood, null, 6), lerp(ax, bx, i / n), 0.21, lerp(az, bz, i / n)));
        for (const y of [0.18, 0.34]) field.add(K.rod(new V3(ax, y, az), new V3(bx, y, bz), 0.02, wood));
      };
      side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0);
    }
    function refresh(f) {
      grid.snow = f.snow;
      let any = false;
      if (!prev) { prev = new Uint8Array(f.snow.length).fill(2); }
      for (let gy = 0; gy < f.GH; gy++) for (let gx = 0; gx < f.GW; gx++) {
        const i = gy * f.GW + gx;
        if (prev[i] === f.snow[i]) continue;
        prev[i] = f.snow[i]; any = true;
        for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const x = gx + dx, y = gy + dy;
          if (x >= 0 && y >= 0 && x < f.GW && y < f.GH) paintCell(x, y);
        }
      }
      if (any) fieldTex.needsUpdate = true;
    }
    // the spruces in the way (made again for each game, as they're somewhere else every time)
    let treesOf = null;
    const treeG = new T.Group(); field.add(treeG);
    // the ball you're rolling, and the ones you've stood up
    const live = ball(ballM, 0, 0, 0, 1, 1, 1); field.add(live);
    let liveOf = null;
    const lastAt = new V3(), axis = new V3(), q = new T.Quaternion();
    const madeG = [0, 1, 2].map(() => { const m = ball(ballM, 0, 0, 0, 1, 1, 1); field.add(m); return m; });
    const madeOf = [];
    // the snowman, built
    const stick = K.tex('w3stick', 32, 512, (g, w, h) => {
      g.fillStyle = '#f0d860'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#181820';
      for (let c = 10; c < 262; c += 10) { const y = h - (c / 262) * h; g.fillRect(0, y - 1, c % 50 ? w * 0.4 : w, c % 50 ? 2 : 4); }
    });
    built.add(at(K.box(0.09, 2.62, 0.06, toon(null, stick)), (40 - SX) * B, 1.31, 0));
    built.add(at(K.box(0.2, 0.06, 0.2, toon('#6a4428')), (40 - SX) * B, 0.03, 0));
    const tower = [0, 1, 2].map(() => { const m = ball(ballM, 0, 0, 0, 1, 1, 1); built.add(m); return m; });
    const coal = basic('#22222c'), dot = { ol: false, cast: false };
    const face = new T.Group(); built.add(face);
    for (const s of [-1, 1]) face.add(ball(coal, s * 0.35, 0.25, 0.9, 0.1, 0.1, 0.08, dot));
    for (let i = 0; i < 5; i++) { const a = -0.55 + i * 0.275; face.add(ball(coal, Math.sin(a) * 0.45, -0.3 - Math.cos(a) * 0.08, 0.86, 0.06, 0.06, 0.05, dot)); }
    const nose = at(mesh(new T.ConeGeometry(0.12, 0.8, 8), toon('#f08a24')), 0.15, 0.02, 1.15);
    nose.rotation.set(Math.PI / 2, 0, -0.5); face.add(nose);
    face.add(at(cyl(0.95, 0.95, 0.08, toon('#2a2a34'), null, 20), 0, 0.88, 0));
    face.add(at(cyl(0.6, 0.6, 0.95, toon('#2a2a34'), null, 18), 0, 1.38, 0));
    face.add(at(cyl(0.61, 0.61, 0.16, toon('#c82c34'), { ol: false }, 18), 0, 1.0, 0));
    const body = new T.Group(); built.add(body);
    for (let i = -1; i <= 1; i++) body.add(ball(coal, 0, i * 0.35, Math.sqrt(1 - i * i * 0.1225), 0.07, 0.07, 0.06, dot));
    for (const s of [-1, 1]) {
      body.add(rod(new V3(s * 0.8, 0.2, 0), new V3(s * 1.7, 0.85, 0.05), 0.04, toon('#6a4428')));
      body.add(rod(new V3(s * 1.4, 0.65, 0.04), new V3(s * 1.55, 1.0, 0.06), 0.028, toon('#6a4428')));
    }
    const scarf = at(mesh(new T.TorusGeometry(0.62, 0.14, 8, 24), toon(null, K.plaid('#d83a3a', '#5a1010', 5, 1))), 0, 0.82, 0);
    scarf.rotation.x = Math.PI / 2; body.add(scarf);
    const tail = at(K.box(0.22, 0.6, 0.08, toon(null, K.plaid('#d83a3a', '#5a1010', 1, 2))), 0.25, 0.5, 0.86);
    tail.rotation.z = 0.15; body.add(tail);
    const dashes = [];
    for (let i = 0; i < 24; i++) { const d = at(K.box(0.03, 0.012, 0.012, basic('#f8e040'), dot), 0, 0, 0); built.add(d); dashes.push(d); }

    st.draw = function (f, dt, t) {
      const fieldOn = f.phase === 'field';
      field.visible = fieldOn; built.visible = !fieldOn;
      if (fieldOn) {
        if (!fieldTex) makeField(f);
        refresh(f);
        if (treesOf !== f.trees) {
          treesOf = f.trees;
          treeG.clear();
          for (const o of f.trees) { const s = spruce(K, 1.9, (o.r + 2) * S); s.position.set(fx(o.x), 0, fz(o.y)); s.rotation.y = o.x; treeG.add(s); }
        }
        // the ball, turning as it rolls (a new one starts fresh)
        const b = f.ball, R = f.r * S;
        live.visible = f.rolling;
        live.scale.setScalar(R);
        const nx = fx(b.x), nz = fz(b.y);
        if (liveOf !== b) { liveOf = b; lastAt.set(nx, 0, nz); }
        const dx = nx - lastAt.x, dz = nz - lastAt.z, d = Math.hypot(dx, dz);
        if (d > 1e-5) { axis.set(dz, 0, -dx).normalize(); live.quaternion.premultiply(q.setFromAxisAngle(axis, d / R)); }
        lastAt.set(nx, 0, nz);
        live.position.set(nx, R, nz);
        madeG.forEach((m, i) => {
          const o = f.made[i];
          m.visible = !!o;
          if (!o) { madeOf[i] = null; return; }
          if (madeOf[i] !== o) { madeOf[i] = o; m.quaternion.copy(live.quaternion); }
          m.scale.setScalar(o.r * S); m.position.set(fx(o.x), o.r * S, fz(o.y));
        });
        // you, pushing it, a little smaller than out in the lot
        const me = crew.get(f.me.key, f.me.spec, 0.75);
        crew.pose(me, fx(f.you.x), 0, fz(f.you.y), { face: K.FACING[f.you.dir] }, dt, t);
        const p = me.p;
        for (const s of [-1, 1]) { p.arms[s].rotation.set(-1.15, 0, s * 0.12); p.elbows[s].rotation.x = -0.25; }
        p.rig.rotation.x += 0.2;
        st.look([0, 9.6, 6.6], [0, 0, 0.3]);
        st.dist = 11.5;
      } else {
        // stacked up one at a time; one too big for the ball under it rolls off and lands beside
        const tt = f.tt;
        let off = 0;
        tower.forEach((m, i) => {
          const b = f.made[i], at0 = i * 40;
          m.visible = !!b && tt >= at0;
          if (!m.visible) return;
          let x = SX, y = b.ty - (1 - Math.min(1, (tt - at0) / 10)) * 60;
          if (!b.stand && tt > at0 + 10) {
            const k = Math.min(1, (tt - at0 - 10) / 20);
            x += k * (f.made[0].r + b.r + 16 + off); y += k * (FLOOR - b.r - y);
            off += b.r * 2 + 6;
          }
          m.scale.setScalar(b.r * B);
          m.position.set((x - SX) * B, (FLOOR - y) * B, 0);
          m.rotation.set(0, 0, -(x - SX) / b.r);
        });
        const dressed = tt > f.made.length * 40 && f.tower.length;
        face.visible = body.visible = false;
        dashes.forEach((d) => (d.visible = false));
        if (dressed) {
          const hd = f.tower[f.tower.length - 1];
          face.visible = true; face.scale.setScalar(hd.r * B); face.position.set(0, (FLOOR - hd.ty) * B, 0);
          if (f.tower.length >= 2) {
            const bd = f.tower[f.tower.length - 2];
            body.visible = true; body.scale.setScalar(bd.r * B); body.position.set(0, (FLOOR - bd.ty) * B, 0);
          }
          const hy = f.height / 100, x0 = (40 - SX) * B + 0.06;
          dashes.forEach((d, i) => { const x = x0 + i * 0.05; d.visible = x < 0; d.position.set(x, hy, 0.05); });
        }
        st.look([0.62, 1.45, 6.0], [0.62, 1.15, 0]);
        st.dist = 6;
      }
      crew.sweep();
      st.fall(dt, t);
    };
    // where a spot on the field (and h up from it, all in the game's pixels) is on the screen
    st.at = (px, py, h) => st.screen(fx(px), (h || 0) * S, fz(py));
    // where a height (in cm) on the measuring stick is, and the top of the snowman
    st.mark = (cm) => st.screen((40 - SX) * B - 0.05, cm / 100, 0);
    return st;
  }

  // ---------- the hot chocolate stand ----------
  // Behind the counter, looking out: the urn and its tap, the glass mug under it, the
  // toppings along the counter on the right, and your coworkers lined up out front in the
  // snow, the one being served at the counter. The mug is CocoaGame's (44 pixels tall on
  // its screen, 15 cm here).
  function cocoa(K) {
    const { T, V3, toon, basic, mesh, at, ball, box, cyl, rod } = K;
    const st = stage(K, { at: [0, 1, -1.5], fov: 44, light: 1.05, woods: [10, 28, 170], seed: 6, fall: [8, 4, 7], fog: [12, 50] });
    const { scene } = st;
    st.dist = 2.2;
    const TOP = 1.0, MH = 0.15, BX = [0.7, 0.86, 1.01];
    // the counter, its posts, the awning over you and the lot behind
    const wood = toon(null, K.planks('#a87448', 4, false, 1, 1)), darkWood = toon('#6a4428', K.planks('#8a6040', 1, false));
    scene.add(at(box(3.4, 0.06, 0.8, toon(null, K.planks('#c89060', 3, true, 2, 1))), 0, TOP - 0.03, 0));
    scene.add(at(box(3.4, TOP - 0.06, 0.06, wood), 0, (TOP - 0.06) / 2, -0.37));
    scene.add(at(box(3.4, 0.5, 0.06, darkWood), 0, TOP - 0.31, 0.37));
    for (const s of [-1, 1]) scene.add(at(box(0.12, 2.4, 0.12, darkWood), s * 1.5, 1.2, -0.37));
    const awning = toon(null, K.tex('w3awning', 64, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#c8202a'; g.fillRect(i * 8, 0, 8, 8); } }, 4, 1));
    scene.add(at(box(3.6, 0.05, 1.4, awning), 0, 2.32, 0.2));
    for (let i = 0; i < 18; i++) {
      const sc = at(mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 12, 1, false, Math.PI / 2, Math.PI), toon(i % 2 ? '#f4f1ea' : '#c8202a')), -1.7 + i * 0.2, 2.29, -0.5);
      sc.rotation.x = Math.PI / 2; scene.add(sc);
    }
    scene.add(at(box(3.6, 0.12, 0.04, toon('#c8202a')), 0, 2.25, -0.5));
    lampPost(K, scene, -2.8, -3.5, 1.2);
    car(K, scene, 3.2, -7.5, '#2f6fc0', 0.1);
    car(K, scene, -4.8, -9, '#c8352f', -0.2);
    // the urn and its tap, on a riser so the mug fits under
    const steel = toon('#b8c0cc');
    const UX = 0.4, UZ = -0.16;
    scene.add(at(box(0.36, 0.14, 0.3, darkWood), UX, TOP + 0.07, UZ - 0.02));
    scene.add(at(cyl(0.16, 0.16, 0.46, steel, null, 20), UX, TOP + 0.37, UZ));
    scene.add(at(cyl(0.17, 0.17, 0.04, toon('#8890a0'), null, 20), UX, TOP + 0.62, UZ));
    scene.add(ball(toon('#20242c'), UX, TOP + 0.66, UZ, 0.04, 0.03, 0.04));
    const label = new T.Mesh(new T.PlaneGeometry(0.2, 0.08), toon(null, K.tex('w3urn', 128, 48, (g, w, h) => {
      g.fillStyle = '#7a3a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f8e8c8'; g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('COCOA', w / 2, h / 2 + 1);
    })));
    label.position.set(UX, TOP + 0.42, UZ + 0.163); scene.add(label);
    const SPOUT_Y = TOP + MH + 0.08;
    scene.add(rod(new V3(UX, SPOUT_Y + 0.04, UZ + 0.15), new V3(UX, SPOUT_Y + 0.04, UZ + 0.27), 0.016, toon('#20242c')));
    scene.add(at(cyl(0.016, 0.012, 0.05, toon('#20242c'), null, 8), UX, SPOUT_Y + 0.02, UZ + 0.27));
    scene.add(at(box(0.012, 0.06, 0.03, toon('#c8202a')), UX, SPOUT_Y + 0.085, UZ + 0.25));
    const MX = UX, MZ = UZ + 0.27;
    const steamM = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
    const steam = [0, 1, 2].map((i) => { const s = new T.Mesh(K.SPH, steamM.clone()); scene.add(s); return s; });
    // the toppings: a bag of marshmallows, a can of whipped cream, a jar of candy canes
    const bag = new T.Group(); bag.position.set(BX[0], TOP, 0.02); bag.rotation.y = -0.2; scene.add(bag);
    bag.add(at(box(0.15, 0.2, 0.08, toon('#f0e8e0')), 0, 0.1, 0));
    bag.add(at(box(0.15, 0.04, 0.085, toon('#e86a8a'), { ol: false }), 0, 0.17, 0));
    for (let i = 0; i < 4; i++) bag.add(at(cyl(0.025, 0.025, 0.03, toon('#fbf6f2'), null, 10), -0.04 + (i % 2) * 0.08, 0.06 + (i >> 1) * 0.06, 0.042));
    const can = new T.Group(); can.position.set(BX[1], TOP, 0); scene.add(can);
    can.add(at(cyl(0.045, 0.045, 0.22, toon('#d8dce4'), null, 14), 0, 0.11, 0));
    can.add(at(cyl(0.03, 0.045, 0.05, toon('#c8202a'), null, 14), 0, 0.245, 0));
    can.add(at(cyl(0.008, 0.012, 0.04, toon('#f4f4f8'), null, 8), 0, 0.29, 0));
    const jar = new T.Group(); jar.position.set(BX[2], TOP, 0.03); scene.add(jar);
    const glassM = new T.MeshToonMaterial({ color: '#a8d0e8', gradientMap: K.GRAD, transparent: true, opacity: 0.4, depthWrite: false });
    jar.add(at(K.mesh(new T.CylinderGeometry(0.07, 0.07, 0.16, 16, 1, true), glassM), 0, 0.08, 0));
    for (let i = 0; i < 3; i++) { const c = cane(K, 0.2); c.position.set(-0.03 + i * 0.03, 0.02, (i - 1) * 0.02); c.rotation.y = i * 1.2; jar.add(c); }
    // the mug: glass, the hot chocolate in it, the line the order asks for and the toppings
    const mug = new T.Group(); mug.position.set(MX, TOP, MZ); scene.add(mug);
    const R0 = 0.05, R1 = 0.06;
    const glass = K.mesh(new T.LatheGeometry([[0, 0.008], [R0 - 0.004, 0.008], [R0 - 0.004, 0.006], [R0, 0], [R1, MH], [R1 - 0.004, MH], [R0 - 0.004, 0.01]].map(([r, y]) => new T.Vector2(r, y)), 28),
      new T.MeshToonMaterial({ color: '#cbdbe6', gradientMap: K.GRAD, transparent: true, opacity: 0.38, depthWrite: false, side: T.DoubleSide }));
    mug.add(glass);
    const handle = at(K.mesh(new T.TorusGeometry(0.035, 0.009, 8, 16, Math.PI), new T.MeshToonMaterial({ color: '#cbdbe6', gradientMap: K.GRAD, transparent: true, opacity: 0.6, depthWrite: false })), R1 - 0.003, MH / 2, 0);
    handle.rotation.z = -Math.PI / 2; mug.add(handle);
    const choc = at(cyl(1, 1, 1, toon('#5e3218'), { ol: false }, 24), 0, 0, 0); mug.add(choc);
    const froth = new T.Mesh(new T.CircleGeometry(1, 24), toon('#9a5a30'));
    froth.rotation.x = -Math.PI / 2; mug.add(froth);
    const lineM = basic('#d02828'), dashes = [];
    for (let i = 0; i < 14; i++) { const d = new T.Mesh(new T.BoxGeometry(0.012, 0.004, 0.003), lineM); mug.add(d); dashes.push(d); }
    const cream = new T.Group(); mug.add(cream);
    const creamM = toon('#f8f8f8');
    cream.add(K.ball(creamM, 0, 0.012, 0, 0.055, 0.025, 0.055), K.ball(creamM, 0, 0.034, 0, 0.04, 0.022, 0.04), K.ball(creamM, 0.004, 0.052, 0, 0.022, 0.02, 0.022));
    const mallows = [];
    for (let i = 0; i < 6; i++) { const m = at(cyl(0.013, 0.013, 0.016, toon('#f8f0f0'), null, 10), 0, 0, 0); m.rotation.set(1.2 + i, i * 0.7, 0.4); mug.add(m); mallows.push(m); }
    const mugCane = cane(K, 0.16); mugCane.rotation.y = Math.PI; mug.add(mugCane);
    const stream = at(cyl(1, 1, 1, toon('#6a3a1c'), { ol: false }, 8), 0, 0, 0); scene.add(stream);
    const puddle = new T.Mesh(new T.CircleGeometry(1, 20), toon('#6a3a1c'));
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(0.16, 0.06, 1); puddle.position.set(MX, TOP + 0.002, MZ); scene.add(puddle);
    // the line: each in a place of their own, walking up as it moves along, and off to the
    // left when they've been served (or given up)
    const crew = crowd(K, scene), SLOTS = [[-0.62, -1.3], [-0.12, -2.3], [0.36, -3.3]];
    const walkers = new Map(), spare = new Map();
    let figs = 0;
    function figFor(name, spec) {
      const free = spare.get(name);
      return free && free.length ? free.pop() : crew.get(name + '#' + ++figs, spec);
    }

    st.draw = function (f, dt, t) {
      // the line
      const ids = new Set();
      f.line.forEach((c, i) => {
        ids.add(c);
        let w = walkers.get(c);
        if (!w) { w = { fig: figFor(c.name, f.who(c.name)), name: c.name, x: -3.6, z: -3.6 - i * 0.2 }; walkers.set(c, w); }
        w.tx = SLOTS[Math.min(i, 2)][0]; w.tz = SLOTS[Math.min(i, 2)][1]; w.front = i === 0; w.gone = false;
      });
      for (const [id, w] of walkers) {
        if (!ids.has(id) && !w.gone) { w.gone = true; w.tx = -4.6; w.tz = -1.6; }
        const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz), step = Math.min(d, 1.5 * dt);
        if (d > 1e-3) { w.x += dx / d * step; w.z += dz / d * step; }
        if (w.gone && d < 0.05) { walkers.delete(id); (spare.get(w.name) || spare.set(w.name, []).get(w.name)).push(w.fig); continue; }
        crew.pose(w.fig, w.x, 0, w.z, { face: d > 0.05 ? Math.atan2(dx, dz) : 0 }, dt, t);
        const p = w.fig.p;
        p.head.rotation.y = 0;
        if (w.front && f.verdict && d < 0.05) {
          if (!f.verdict.s) p.head.rotation.y = Math.sin(t * 14) * 0.45; // shaking their head
          else if (f.verdict.s === 3) for (const s of [-1, 1]) { p.arms[s].rotation.set(2.7, 0, s * 0.35); p.elbows[s].rotation.x = -0.3; }
        }
      }
      // the mug
      const m = f.mug;
      mug.visible = !!m && !m.spilled; puddle.visible = !!m && !!m.spilled;
      if (mug.visible) {
        const lv = clamp(m.level, 0, 1.02), h = Math.max(0.001, lv * (MH - 0.01)), r = lerp(R0, R1, lv) - 0.005;
        choc.visible = froth.visible = lv > 0.005;
        choc.scale.set(lerp(R0, R1, lv / 2) - 0.005, h, lerp(R0, R1, lv / 2) - 0.005); choc.position.y = 0.01 + h / 2;
        froth.scale.set(r, r, 1); froth.position.y = 0.011 + h;
        const top = 0.012 + h;
        dashes.forEach((d) => (d.visible = !!f.order));
        if (f.order) {
          const y = 0.01 + f.order.fill * (MH - 0.01), rr = lerp(R0, R1, f.order.fill) + 0.002;
          dashes.forEach((d, i) => { const a = i / dashes.length * TAU; d.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr); d.rotation.y = a + Math.PI / 2; });
        }
        cream.visible = m.cream; cream.position.y = top;
        mallows.forEach((mm, i) => {
          mm.visible = i < m.mallows;
          const a = i * 2.4, rr = (i % 3) * 0.016 + 0.008;
          mm.position.set(Math.cos(a) * rr, top + 0.006 + (m.cream ? 0.03 : 0) + Math.floor(i / 3) * 0.01, Math.sin(a) * rr);
        });
        mugCane.visible = m.cane; mugCane.position.set(-0.03, top - 0.05, 0.01);
      }
      // the stream from the tap, thinner as it stops
      stream.visible = !!m && !m.spilled && (f.pouring || f.drip > 0);
      if (stream.visible) {
        const from = SPOUT_Y, to = TOP + 0.012 + clamp(m.level, 0, 1) * (MH - 0.01), w = f.pouring ? 0.007 : 0.0035;
        stream.scale.set(w, Math.max(0.001, from - to), w); stream.position.set(MX, (from + to) / 2, MZ);
      }
      steam.forEach((s, i) => {
        const k = (t * 0.35 + i / 3) % 1;
        s.position.set(UX + Math.sin(t + k * 6) * 0.03, TOP + 0.7 + k * 0.4, UZ);
        s.scale.setScalar(0.03 + k * 0.06); s.material.opacity = 0.45 * (1 - k);
      });
      crew.sweep();
      st.look([0.3, 1.55, 1.9], [0.2, 1.25, -0.7]);
      st.fall(dt, t);
    };
    // where the front of the line's head is, and the toppings, on the screen
    st.pts = () => {
      const w = [...walkers.values()].find((x) => x.front && !x.gone);
      const head = w ? st.screen(w.x, 1.95, w.z) : null;
      return { head, bag: st.screen(BX[0], TOP, 0.1), can: st.screen(BX[1], TOP, 0.1), jar: st.screen(BX[2], TOP, 0.1), mug: st.screen(MX, TOP, MZ + 0.08) };
    };
    return st;
  }

  // ---------- the snowball fight ----------
  // SnowballGame's screen, x at 3 cm to the pixel across the lot and its y up the lot at 11.4
  // cm to the pixel from your wall (at y 206): you behind your wall (seen from just behind
  // you), the forts across the lot with coworkers popping up behind them, and the
  // snowballs going back and forth. Their throws leave a mark on your wall where they'll land.
  function snowball(K) {
    const { T, toon, at, ball, box, cyl } = K;
    const SX = 0.03, WALL = 206, Z = (py) => -(WALL - py) * 0.114, X = (px) => (px - 160) * SX, WH = 1.25;
    const st = stage(K, { at: [0, 1, -8], fov: 38, light: 1.1, woods: [20, 45, 260], seed: 7, fall: [16, 7, 26], flake: 0.07, flakes: 1600, fog: [22, 70], shadow: 14 });
    const { scene } = st;
    st.dist = 10;
    const bricks = (key, rx, ry) => toon(null, K.tex(key, 128, 64, (g, w, h) => {
      g.fillStyle = '#f2f6fa'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,170,205,.6)'; g.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const y = row * 16; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (row % 2) * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
      }
      K.grit(g, w, h, 8, 3);
    }, rx, ry));
    // a wall of packed snow, rounded over the top
    function wall(w, h, d, mat) {
      const g = new T.Group();
      g.add(at(box(w, h - d / 2, d, mat), 0, (h - d / 2) / 2, 0));
      const top = at(cyl(d / 2, d / 2, w, mat, null, 12), 0, h - d / 2, 0);
      top.rotation.z = Math.PI / 2; g.add(top);
      return g;
    }
    scene.add(wall(11.5, WH, 0.55, bricks('w3wall', 10, 1)));
    lampPost(K, scene, -6.5, -10.5, 1.4); lampPost(K, scene, 6.5, -10.5, 1.4);
    car(K, scene, -3.6, -17.5, '#8a2a2a', 0.05); car(K, scene, 3.3, -17, '#2a4a8a', -0.08); car(K, scene, 8, -19, '#e0a030', 0.2);
    const crew = crowd(K, scene);
    const fortM = bricks('w3fort', 2, 1);
    const forts = [];
    const youBall = ball(toon('#ffffff'), 0, 0, 0, 0.06, 0.06, 0.06);
    // snowballs, theirs and yours, and the marks where theirs will land
    const flying = keeper(scene, () => ball(toon('#ffffff'), 0, 0, 0, 0.065, 0.065, 0.065));
    const markM = new T.MeshBasicMaterial({ color: '#3c4664', transparent: true, opacity: 0.45, depthWrite: false });
    const marks = keeper(scene, () => { const m = new T.Mesh(new T.CircleGeometry(1, 20), markM.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m; });
    let fortsOf = null;

    st.draw = function (f, dt, t) {
      if (fortsOf !== f.forts) {
        fortsOf = f.forts;
        forts.forEach((o) => scene.remove(o.g));
        forts.length = 0;
        f.forts.forEach((o) => { const g = wall(o.hw * 2 * SX, 1.1, 0.6, fortM); g.position.set(X(o.x), 0, Z(o.y)); scene.add(g); forts.push({ g }); });
      }
      // them, popping up behind their forts: winding up with a snowball, throwing, or
      // getting one in the face
      f.forts.forEach((o, i) => {
        const fig = crew.get('fort' + i + ':' + o.name, f.who(o.name));
        crew.pose(fig, X(o.x + o.dx), -(1 - o.up) * 1.15, Z(o.y) - 0.6, { face: 0 }, dt, t);
        const p = fig.p;
        if (!fig.hold) {
          fig.hold = ball(toon('#ffffff'), 0, -0.27, 0.03, 0.06, 0.06, 0.06); p.elbows[-1].add(fig.hold);
          fig.splat = ball(toon('#f8fbff'), 0.02, -0.02, 0.24, 0.17, 0.14, 0.07); p.head.add(fig.splat);
        }
        fig.hold.visible = o.state === 'wind';
        fig.splat.visible = o.state === 'hit';
        if (o.state === 'wind') { p.arms[-1].rotation.set(2.5, 0, -0.35); p.elbows[-1].rotation.x = -1.0; }
        else if (o.state === 'after' && o.st < 12) { p.arms[-1].rotation.set(-1.3, 0, -0.1); p.elbows[-1].rotation.x = -0.1; }
        else if (o.state === 'hit') { p.head.rotation.x = -0.35; for (const s of [-1, 1]) p.arms[s].rotation.set(-0.4, 0, s * 0.9); }
      });
      // you, behind your wall: ducking down to pack snowballs, or up and throwing
      const me = crew.get(f.me.key, f.me.spec), yx = X(f.px);
      crew.pose(me, yx, 0, 0.75, { face: Math.PI }, dt, t);
      const p = me.p;
      if (!me.hold) { me.hold = youBall; p.elbows[-1].add(youBall); youBall.position.set(0, -0.27, 0.03); }
      youBall.visible = !f.duck && f.cool > 6;
      if (f.duck) {
        // crouched down behind it, packing snow
        p.rig.position.y -= 0.38; p.rig.rotation.x = 0.3;
        for (const s of [-1, 1]) {
          p.hips[s].rotation.set(-1.4, 0, 0); p.knees[s].rotation.x = 2.3;
          p.arms[s].rotation.set(-0.9 + Math.sin(f.pack * 0.45 + (s > 0 ? Math.PI : 0)) * 0.25, 0, s * 0.1); p.elbows[s].rotation.x = -0.6;
        }
      } else if (f.cool > 6) { p.arms[-1].rotation.set(-1.4, 0, -0.1); p.elbows[-1].rotation.x = -0.1; }
      flying([...f.mine, ...f.theirs], (m, b) => {
        if (b.y0 !== undefined && b.dur === undefined) {
          // yours, straight up the lot from your hand
          const k = (b.y0 - b.y) / (b.y0 - 50);
          m.position.set(X(b.x), 1.55 + Math.sin(Math.min(1, k) * Math.PI) * 1.0, Z(b.y) + 3 * (1 - Math.min(1, k * 4)));
        } else {
          const k = b.t / b.dur, z0 = Z(b.y0 + 22) - 0.4;
          m.position.set(lerp(X(b.x0), X(b.tx), k), lerp(1.7, 1.4, k) + Math.sin(k * Math.PI) * 2.2, lerp(z0, 0.2, k));
        }
      });
      marks(f.theirs, (m, b) => {
        const k = b.t / b.dur, r = (4 + k * 7) * SX;
        m.position.set(X(b.tx), WH + 0.005, 0); m.scale.set(r, r * 0.8, 1);
        m.material.color.set(k > 0.6 ? '#d23232' : '#3c4664'); m.material.opacity = k > 0.6 ? 0.75 : 0.45;
      });
      crew.sweep();
      const cx = yx * 0.6;
      st.look([cx, 3.3, 5.8], [cx, 1.0, -9]);
      st.fall(dt, t);
    };
    // where a coworker's head is behind a fort at (x, y) on the flat game's screen
    st.over = (px, py, up) => st.screen(X(px), 2.05 + (up || 0), Z(py) - 0.6);
    return st;
  }

  return { chop, mallow, spruce: spruceGame, snowman, cocoa, snowball };
})();
