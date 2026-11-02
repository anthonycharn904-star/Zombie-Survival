/* ============================================================================================
   Barque à moteur des Marécages Maudits : modèle 3D, animations, son du moteur.
   Module autonome (aucune dépendance au jeu) : Barque.create(THREE, opts), Barque.createAudio(ctx, dest).

   Modèle : esquif de bois à clins de 4,4 m (bordés peints vert-de-gris, usés jusqu'au bois à la
   ligne de flottaison, algues), varangues, trois bancs, plancher à claire-voie, hors-bord deux
   temps à barre franche (capot, embase, hélice tripale), réservoir, lanterne de proue et projecteur,
   avirons, cordage, seau. Repère : x à droite, y en haut, l'avant vers -z ; y = 0 : ligne de
   flottaison au repos. Unités : mètres.

   const B = Barque.create(THREE, { quality: 'medium' | 'high' | 'low', seed, paint: 0x4f6356 })
     B.object        groupe à poser (le jeu le place et l'oriente)
     B.update(dt, s) s = { speed (m/s), throttle (-1..1), steer (-1..1), rpm (0..1), on (moteur),
                           lights (lanterne et projecteur allumés), damage (0..1), sway (roulis supplémentaire) }
     B.anchors       seat (yeux du pilote), helm (main sur la barre), prop (hélice), bow (étrave),
                     light (projecteur), lantern (lanterne)
     B.size          { len, wid, draft, freeboard }
     B.materials, B.stats, B.dispose()
   const S = Barque.createAudio(ctx, dest)
     S.update({ rpm, load, speed, on, under })   chaque image
     S.start(), S.stop()   tirer sur le lanceur, couper le moteur
     S.slap(k), S.clunk(k), S.scrape(k)          clapot, choc, raclement de la coque
     S.dispose()
   ============================================================================================ */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // bruit de valeur 2D raccordable (textures)
  function vnoise(w, h, oct, R) {
    const out = new Float32Array(w * h); let tot = 0;
    for (const [sx, sy, amp] of oct) {
      const g = new Float32Array(sx * sy); for (let i = 0; i < g.length; i++) g[i] = R();
      for (let y = 0; y < h; y++) {
        const fy = (y / h) * sy, y0 = Math.floor(fy), ty = fy - y0, y1 = (y0 + 1) % sy, sy2 = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < w; x++) {
          const fx = (x / w) * sx, x0 = Math.floor(fx), tx = fx - x0, x1 = (x0 + 1) % sx, sx2 = tx * tx * (3 - 2 * tx);
          const a = g[y0 * sx + x0], b = g[y0 * sx + x1], c = g[y1 * sx + x0], d = g[y1 * sx + x1];
          out[y * w + x] += amp * ((a + (b - a) * sx2) * (1 - sy2) + (c + (d - c) * sx2) * sy2);
        }
      }
      tot += amp;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------------------------------------------------------------- textures
  /* Bordé extérieur : u = longueur (proue 0 → poupe 1), v = du fond (0) au plat-bord (1).
     Clins (bandes), peinture écaillée vert-de-gris, bois gris dessous, bande d'algues et de vase
     sous la ligne de flottaison (v ≈ 0.38), coulures. */
  function hullTexture(THREE, R, paint, px) {
    const W = px, H = px / 2, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const n1 = vnoise(W, H, [[6, 3, 1], [24, 12, 0.5], [96, 48, 0.25]], R), n2 = vnoise(W, H, [[3, 2, 1], [12, 6, 0.6], [48, 24, 0.3]], R);
    const P = [(paint >> 16) & 255, (paint >> 8) & 255, paint & 255];
    const strakes = 6;
    for (let y = 0; y < H; y++) {
      const v = y / H, sv = v * strakes, si = Math.floor(sv), sf = sv - si;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, u = x / W;
        const grain = 0.5 + 0.5 * Math.sin(u * 220 + Math.sin(v * 31 + si) * 2 + n1[i] * 6);
        let wood = [92 + grain * 22, 84 + grain * 18, 70 + grain * 14];
        // peinture : présente sauf où l'usure (bruit) dépasse un seuil, plus usée en bas et aux arêtes des clins
        const wear = n2[i] * 0.9 + (1 - v) * 0.2 + (sf > 0.88 ? 0.16 : 0) - 0.1;
        const pk = 1 - smooth(0.62, 0.7, wear);
        let r = lerp(wood[0], P[0] * (0.85 + 0.25 * n1[i]), pk), gg = lerp(wood[1], P[1] * (0.85 + 0.25 * n1[i]), pk), b = lerp(wood[2], P[2] * (0.85 + 0.25 * n1[i]), pk);
        // ombre sous le recouvrement du clin au-dessus, lumière sur son arête
        const lap = sf < 0.08 ? 0.55 + sf * 5 : sf > 0.93 ? 1.18 : 1;
        r *= lap; gg *= lap; b *= lap;
        // flottaison : algues et vase sous v 0.4, ligne de vase sombre
        const wl = 0.4 + 0.04 * Math.sin(u * 14 + n2[i] * 4);
        if (v < wl) { const k = smooth(wl, wl - 0.12, v); r = lerp(r, 46 + n1[i] * 20, k * 0.85); gg = lerp(gg, 52 + n1[i] * 26, k * 0.85); b = lerp(b, 30 + n1[i] * 12, k * 0.85); }
        const line = Math.exp(-Math.pow((v - wl) / 0.012, 2));
        r = lerp(r, 34, line * 0.6); gg = lerp(gg, 32, line * 0.6); b = lerp(b, 24, line * 0.6);
        // coulures de rouille sous les rivets (au plat-bord)
        const drip = Math.max(0, Math.sin(u * 61 + 1.3)) > 0.985 && v > 0.55 ? (v - 0.55) * 1.4 * n1[i] : 0;
        r = lerp(r, 96, drip); gg = lerp(gg, 56, drip); b = lerp(b, 34, drip);
        const k4 = i * 4; d[k4] = r; d[k4 + 1] = gg; d[k4 + 2] = b; d[k4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  /* Bois nu, grisé, humide (intérieur, bancs, plancher) : lames, nœuds, taches sombres. */
  function woodTexture(THREE, R, px, tone) {
    const W = px, H = px, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const n = vnoise(W, H, [[4, 16, 1], [16, 64, 0.4], [64, 128, 0.2]], R), m = vnoise(W, H, [[3, 3, 1], [9, 9, 0.6]], R);
    const T = tone || [104, 92, 76];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = x / W, v = y / H;
      const board = Math.floor(u * 5), bf = u * 5 - board;
      const grain = 0.5 + 0.5 * Math.sin(v * 90 + Math.sin(u * 13 + board * 2) * 3 + n[i] * 8);
      let k = (0.72 + 0.22 * grain) * (0.85 + 0.3 * ((board * 0.37) % 1));
      if (bf < 0.03 || bf > 0.97) k *= 0.45;
      const wet = smooth(0.55, 0.75, m[i]);
      const k4 = i * 4;
      d[k4] = T[0] * k * (1 - 0.35 * wet); d[k4 + 1] = T[1] * k * (1 - 0.3 * wet); d[k4 + 2] = T[2] * k * (1 - 0.28 * wet); d[k4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  /* Capot du moteur : peinture olive fanée, bande crème usée, rouille aux angles (u, v : boîte dépliée). */
  function cowlTexture(THREE, R) {
    const W = 256, H = 256, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const n = vnoise(W, H, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.25]], R);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = y / H;
      let r = 58, gg = 68, b = 54;
      const stripe = Math.abs(v - 0.62) < 0.05;
      if (stripe) { r = 176; gg = 164; b = 128; }
      const rust = smooth(0.6, 0.78, n[i]);
      r = lerp(r, 104, rust); gg = lerp(gg, 58, rust); b = lerp(b, 34, rust);
      const k = 0.85 + 0.3 * n[i], k4 = i * 4;
      d[k4] = r * k; d[k4 + 1] = gg * k; d[k4 + 2] = b * k; d[k4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------------------------------------------------------------- forme de la coque
  const LEN = 4.4, Z0 = -2.2, Z1 = 2.2;
  const halfBeam = (u) => {                                   // demi-largeur au plat-bord (u : 0 étrave → 1 tableau)
    const a = u < 0.5 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.5)), 0.85) : 1;
    return 0.06 + 0.72 * a - 0.08 * smooth(0.8, 1, u);
  };
  const bottomBeam = (u) => halfBeam(u) * lerp(0.35, 0.74, smooth(0, 0.4, u));
  const sheer = (u) => 0.34 + 0.24 * Math.pow(1 - u, 3) + 0.02 * u;     // tonture : la proue se relève
  const keel = (u) => -0.17 + 0.42 * Math.pow(Math.max(0, (0.28 - u) / 0.28), 1.7);   // relevé d'étrave
  // point de la section (t : 0 quille → 1 plat-bord), côté s (+1 tribord)
  function sectionPt(u, t, s, inset) {
    const B = halfBeam(u), Bb = bottomBeam(u), H = sheer(u), K = keel(u);
    // fond presque plat jusqu'au bouchain (t 0.35), puis muraille évasée, légèrement bombée
    let x, y;
    if (t < 0.35) { const k = t / 0.35; x = Bb * k; y = K + 0.035 * k * k; }
    else { const k = (t - 0.35) / 0.65; x = lerp(Bb, B, Math.pow(k, 0.85)) + 0.035 * Math.sin(Math.PI * k); y = lerp(K + 0.035, H, k); }
    if (inset) { x = Math.max(0, x - inset * (t < 0.35 ? 0.3 : 1)); y += inset * (t < 0.35 ? 1 : 0.25); }
    return [s * x, y, Z0 + LEN * u];
  }

  // ---------------------------------------------------------------- création
  function create(THREE, opts) {
    const O = Object.assign({ quality: 'medium', seed: 7, paint: 0x4f6356 }, opts || {});
    const R = rng(O.seed), hi = O.quality === 'high', lo = O.quality === 'low';
    const px = hi ? 1024 : lo ? 256 : 512;
    const object = new THREE.Group(); object.name = 'barque';
    const tex = {
      hull: hullTexture(THREE, rng(O.seed + 1), O.paint, px),
      inner: woodTexture(THREE, rng(O.seed + 2), px / 2, [96, 86, 72]),
      plank: woodTexture(THREE, rng(O.seed + 3), px / 2, [112, 100, 84]),
      cowl: cowlTexture(THREE, rng(O.seed + 4)),
    };
    const M = {
      hull: new THREE.MeshStandardMaterial({ map: tex.hull, roughness: 0.82, metalness: 0 }),
      inner: new THREE.MeshStandardMaterial({ map: tex.inner, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ map: tex.plank, roughness: 0.88, metalness: 0 }),
      cowl: new THREE.MeshStandardMaterial({ map: tex.cowl, roughness: 0.5, metalness: 0.15 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x55574f, roughness: 0.55, metalness: 0.55 }),
      rust: new THREE.MeshStandardMaterial({ color: 0x5e3a24, roughness: 0.85, metalness: 0.25 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1c1d1a, roughness: 0.7, metalness: 0.1 }),
      red: new THREE.MeshStandardMaterial({ color: 0x7a2618, roughness: 0.6, metalness: 0.2 }),
      rope: new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.95, metalness: 0 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x6a665a, emissive: 0xfff0d0, emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 }),
      water: new THREE.MeshStandardMaterial({ color: 0x0f130d, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.7, depthWrite: false }),
    };
    const geos = [];
    const mesh = (geo, mat, parent, name) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; (parent || object).add(m); geos.push(geo); return m; };

    // ---- coque : bordé extérieur, vaigrage intérieur, plat-bord, tableau
    const NS = hi ? 44 : lo ? 18 : 30, NT = hi ? 14 : lo ? 7 : 10;
    function hullSurface(inset, flip, mat, uvScale) {
      const pos = [], uv = [], idx = [];
      const cols = 2 * NT + 1;                               // de bâbord (plat-bord) à tribord (plat-bord)
      for (let i = 0; i <= NS; i++) {
        const u = i / NS;
        for (let j = 0; j < cols; j++) {
          const s = j < NT ? -1 : 1, t = j < NT ? (NT - j) / NT : (j - NT) / NT;
          const p = sectionPt(u, t, s, inset);
          pos.push(p[0], p[1], p[2]);
          uv.push(u * uvScale[0], (s < 0 ? t : t) * uvScale[1]);
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return mesh(g, mat);
    }
    const outer = hullSurface(0, true, M.hull, [1, 1]);
    outer.name = 'coque';
    hullSurface(0.028, false, M.inner, [3, 1.2]);
    // plat-bord : bande qui ferme le dessus des bordés, un peu plus large (liston)
    {
      const pos = [], uv = [], idx = [];
      for (const s of [-1, 1]) {
        const base = pos.length / 3;
        for (let i = 0; i <= NS; i++) {
          const u = i / NS, o = sectionPt(u, 1, s, 0), n = sectionPt(u, 1, s, 0.028);
          pos.push(o[0] + s * 0.02, o[1] + 0.015, o[2], n[0] - s * 0.012, n[1] + 0.015, n[2], o[0] + s * 0.022, o[1] - 0.045, o[2]);
          uv.push(u * 6, 0, u * 6, 0.1, u * 6, 0.2);
        }
        for (let i = 0; i < NS; i++) {
          const a = base + i * 3, b = a + 3;
          if (s > 0) idx.push(a, b + 1, a + 1, a, b, b + 1, a + 2, b, a, a + 2, b + 2, b);
          else idx.push(a, a + 1, b + 1, a, b + 1, b, a + 2, a, b, a + 2, b, b + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      mesh(g, M.wood, object, 'plat-bord');
    }
    // tableau arrière (planche épaisse), étrave (pièce de bois à la proue)
    {
      const shape = new THREE.Shape();
      const pts = [];
      for (let j = 0; j <= NT; j++) { const p = sectionPt(1, j / NT, 1, 0); pts.push([p[0], p[1]]); }
      shape.moveTo(-pts[NT][0], pts[NT][1]);
      for (let j = NT; j >= 0; j--) shape.lineTo(-pts[j][0], pts[j][1]);
      for (let j = 0; j <= NT; j++) shape.lineTo(pts[j][0], pts[j][1]);
      shape.lineTo(-pts[NT][0], pts[NT][1]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
      g.translate(0, 0, Z1 - 0.02);
      mesh(g, M.wood, object, 'tableau');
      const st = new THREE.BoxGeometry(0.07, 0.62, 0.08); st.rotateX(-0.35); st.translate(0, keel(0.02) + 0.3, Z0 + 0.06);
      mesh(st, M.wood, object, 'étrave');
    }
    // ---- membrures (varangues) et plancher à claire-voie
    {
      const parts = [];
      for (let k = 1; k < 9; k++) {
        const u = 0.08 + k * 0.1;
        const pts = [];
        for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push(sectionPt(u, t, 1, 0.058)); }
        for (const s of [-1, 1]) for (let j = 0; j < 10; j++) {
          const a = pts[j], b = pts[j + 1], dx = s * (b[0] - a[0]), dy = b[1] - a[1], l = Math.hypot(dx, dy);
          const g = new THREE.BoxGeometry(0.03, l + 0.01, 0.045);
          const m = new THREE.Matrix4().makeRotationZ(Math.atan2(-dx, dy)).setPosition(s * (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.012, a[2]);
          g.applyMatrix4(m); parts.push(g);
        }
      }
      for (const g of parts) mesh(g, M.wood);
      // plancher : lattes le long de la barque, entre u 0.2 et 0.92
      for (let k = -3; k <= 3; k++) {
        const x = k * 0.13, u0 = 0.22, u1 = 0.93, y = keel(0.5) + 0.075;
        const g = new THREE.BoxGeometry(0.1, 0.02, LEN * (u1 - u0));
        g.translate(x, y, Z0 + LEN * (u0 + u1) / 2);
        mesh(g, M.wood);
      }
    }
    // ---- bancs (proue, milieu, poupe) avec leurs taquets
    const thwart = (u, w, d) => {
      const p = sectionPt(u, 0.8, 1, 0.03), y = p[1] - 0.02;
      const g = new THREE.BoxGeometry(p[0] * 2 - 0.02, 0.04, d);
      g.translate(0, y, p[2]); mesh(g, M.wood);
      for (const s of [-1, 1]) { const c = new THREE.BoxGeometry(0.04, 0.1, d * 0.8); c.translate(s * (p[0] - 0.085), y - 0.07, p[2]); mesh(c, M.wood); }
      return y;
    };
    thwart(0.22, 1, 0.26);
    thwart(0.52, 1, 0.3);
    const seatY = thwart(0.85, 1, 0.32);
    // eau au fond (flaque) : reflète, bouge un peu
    {
      const g = new THREE.CircleGeometry(0.3, 18); g.scale(1, 1.9, 1); g.rotateX(-Math.PI / 2); g.translate(0.05, keel(0.8) + 0.088, 1.15);
      const w = mesh(g, M.water, object, 'flaque'); w.castShadow = false;
    }

    // ---- hors-bord (pivote autour de son axe vertical sur le tableau)
    const motor = new THREE.Group(); motor.name = 'hors-bord';
    motor.position.set(0, sheer(1) + 0.02, Z1 + 0.06);
    object.add(motor);
    {
      // serre-joint sur le tableau
      const cl = new THREE.BoxGeometry(0.2, 0.16, 0.12); cl.translate(0, -0.02, -0.02); mesh(cl, M.metal, motor);
      for (const s of [-1, 1]) { const sc = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8); sc.rotateX(Math.PI / 2); sc.translate(s * 0.07, -0.08, -0.08); mesh(sc, M.rust, motor); }
      // tête motrice et capot arrondi
      const cow = new THREE.BoxGeometry(0.36, 0.38, 0.46, 3, 3, 3);
      const pa = cow.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        const k = 1 - 0.18 * Math.pow(Math.abs(y / 0.19), 3) - 0.1 * Math.pow(Math.abs(z / 0.23), 4);
        pa.setXYZ(i, x * k, y, z * (1 - 0.08 * Math.pow(Math.abs(x / 0.18), 2)));
      }
      cow.computeVertexNormals(); cow.translate(0, 0.36, 0.22);
      mesh(cow, M.cowl, motor, 'capot');
      const band = new THREE.BoxGeometry(0.37, 0.05, 0.47); band.translate(0, 0.17, 0.22); mesh(band, M.dark, motor);
      // fût (arbre) et embase en torpille, aileron, plaque anti-cavitation
      const sh = new THREE.BoxGeometry(0.11, 0.78, 0.15); sh.translate(0, -0.22, 0.24); mesh(sh, M.metal, motor);
      const plate = new THREE.BoxGeometry(0.26, 0.012, 0.3); plate.translate(0, -0.55, 0.26); mesh(plate, M.metal, motor);
      const torp = new THREE.CylinderGeometry(0.06, 0.05, 0.36, 12); torp.rotateX(Math.PI / 2); torp.translate(0, -0.66, 0.24); mesh(torp, M.metal, motor);
      const skeg = new THREE.BoxGeometry(0.018, 0.16, 0.2); skeg.translate(0, -0.76, 0.26); mesh(skeg, M.metal, motor);
      // échappement : petite grille, poignée de lanceur (corde)
      const pull = new THREE.BoxGeometry(0.08, 0.025, 0.025); pull.translate(0.0, 0.4, -0.02); mesh(pull, M.dark, motor);
    }
    // hélice tripale
    const prop = new THREE.Group(); prop.name = 'hélice';
    prop.position.set(0, -0.66, 0.44);
    motor.add(prop);
    {
      const hub = new THREE.CylinderGeometry(0.03, 0.022, 0.08, 10); hub.rotateX(Math.PI / 2); mesh(hub, M.metal, prop);
      for (let b = 0; b < 3; b++) {
        const bl = new THREE.BoxGeometry(0.075, 0.13, 0.008); bl.translate(0, 0.075, 0); bl.rotateY(0.45);
        bl.rotateZ((b / 3) * TAU); mesh(bl, M.metal, prop);
      }
    }
    // barre franche avec poignée d'accélérateur (vers l'avant, à gauche du pilote)
    const tiller = new THREE.Group(); tiller.name = 'barre';
    tiller.position.set(0, 0.24, -0.02); tiller.rotation.x = 0.12;
    motor.add(tiller);
    {
      const arm = new THREE.CylinderGeometry(0.022, 0.028, 0.62, 10); arm.rotateX(Math.PI / 2); arm.translate(0, 0, -0.31); mesh(arm, M.dark, tiller);
      const grip = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 12); grip.rotateX(Math.PI / 2); grip.translate(0, 0, -0.58); mesh(grip, M.rust, tiller);
    }
    // réservoir (jerrican rouge rouillé) et durite
    {
      const tk = new THREE.BoxGeometry(0.3, 0.24, 0.42); tk.translate(0.42, keel(0.9) + 0.2, Z1 - 0.42); mesh(tk, M.red);
      const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8); cap.translate(0.48, keel(0.9) + 0.34, Z1 - 0.56); mesh(cap, M.dark);
      const hosePts = [new THREE.Vector3(0.42, keel(0.9) + 0.3, Z1 - 0.25), new THREE.Vector3(0.3, keel(0.9) + 0.45, Z1 - 0.1), new THREE.Vector3(0.12, sheer(1) + 0.1, Z1 + 0.02), new THREE.Vector3(0.05, sheer(1) + 0.3, Z1 + 0.18)];
      const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 16, 0.012, 6, false); mesh(hose, M.dark);
    }
    // ---- lanterne de proue (sur un bout de mât) et projecteur à main (sur une ferrure)
    const lanternG = new THREE.Group(); lanternG.name = 'lanterne';
    {
      const pole = new THREE.CylinderGeometry(0.018, 0.022, 0.75, 8); pole.translate(0, sheer(0.1) + 0.3, Z0 + 0.5); mesh(pole, M.wood);
      const hook = new THREE.BoxGeometry(0.015, 0.015, 0.22); hook.translate(0, sheer(0.1) + 0.66, Z0 + 0.4); mesh(hook, M.metal);
      lanternG.position.set(0, sheer(0.1) + 0.65, Z0 + 0.3);
      object.add(lanternG);
      const cage = new THREE.CylinderGeometry(0.055, 0.06, 0.16, 8, 1, true); cage.translate(0, -0.12, 0); mesh(cage, M.glass, lanternG);
      const top = new THREE.ConeGeometry(0.07, 0.07, 8); top.translate(0, -0.02, 0); mesh(top, M.metal, lanternG);
      const bot = new THREE.CylinderGeometry(0.065, 0.065, 0.03, 8); bot.translate(0, -0.21, 0); mesh(bot, M.metal, lanternG);
      const ring = new THREE.TorusGeometry(0.03, 0.006, 6, 12); ring.translate(0, 0.03, 0); mesh(ring, M.metal, lanternG);
    }
    const spot = new THREE.Group(); spot.name = 'projecteur';
    spot.position.set(0.32, sheer(0.12) + 0.06, Z0 + 0.62);
    object.add(spot);
    {
      const br = new THREE.BoxGeometry(0.04, 0.12, 0.04); br.translate(0, 0.02, 0); mesh(br, M.metal, spot);
      const body = new THREE.CylinderGeometry(0.075, 0.06, 0.18, 14); body.rotateX(Math.PI / 2); body.translate(0, 0.12, 0); mesh(body, M.dark, spot);
      const lens = new THREE.CircleGeometry(0.068, 16); lens.rotateY(Math.PI); lens.translate(0, 0.12, -0.091); mesh(lens, M.lens, spot);
    }
    // ---- avirons, cordage, seau, ancre
    {
      for (const s of [-1, 1]) {
        const oar = new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8); oar.rotateX(Math.PI / 2); oar.rotateY(s * 0.04); oar.translate(s * 0.33, keel(0.5) + 0.12, 0.05); mesh(oar, M.wood);
        const blade = new THREE.BoxGeometry(0.14, 0.012, 0.5); blade.translate(s * 0.33 + s * 0.04, keel(0.5) + 0.12, -1.1); mesh(blade, M.wood);
      }
      const coil = new THREE.TorusGeometry(0.13, 0.025, 6, 18); coil.rotateX(Math.PI / 2); coil.translate(-0.1, keel(0.2) + 0.12, Z0 + 0.95); mesh(coil, M.rope);
      const coil2 = new THREE.TorusGeometry(0.1, 0.022, 6, 16); coil2.rotateX(Math.PI / 2); coil2.translate(-0.12, keel(0.2) + 0.16, Z0 + 0.95); mesh(coil2, M.rope);
      const bucket = new THREE.CylinderGeometry(0.13, 0.1, 0.24, 12, 1, true); bucket.translate(-0.42, keel(0.7) + 0.2, 0.95); mesh(bucket, M.metal);
      const anchor = new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6); anchor.translate(0.2, keel(0.25) + 0.12, Z0 + 1.05); anchor.rotateZ(1.2); mesh(anchor, M.rust);
    }

    // ---- ancres pour le jeu
    const anchor = (name, parent, x, y, z) => { const a = new THREE.Object3D(); a.name = name; a.position.set(x, y, z); parent.add(a); return a; };
    const anchors = {
      seat: anchor('yeux', object, -0.22, seatY + 0.86, Z1 - 0.62),
      helm: anchor('main', tiller, 0, 0, -0.58),
      prop: anchor('hélice', prop, 0, 0, 0),
      bow: anchor('étrave', object, 0, 0.02, Z0 + 0.15),
      light: anchor('faisceau', spot, 0, 0.12, -0.1),
      lantern: anchor('flamme', lanternG, 0, -0.12, 0),
    };

    // ---- animation
    let pr = 0, swing = 0, swingV = 0, vib = 0, time = 0, lastSpeed = 0;
    function update(dt, s) {
      s = s || {};
      dt = Math.min(dt || 0, 0.1);
      time += dt;
      const rpm = clamp(s.rpm || 0, 0, 1), on = !!s.on;
      // hélice : régime (ralenti 900 tr/min réduit, plein 4 500) ; image floue au-delà
      pr += dt * (on ? (6 + rpm * 70) : 0) * (s.throttle < 0 ? -1 : 1);
      prop.rotation.z = pr;
      // le moteur pivote avec la barre (barre à droite : poupe pousse à gauche)
      motor.rotation.y = clamp(s.steer || 0, -1, 1) * 0.55;
      // vibration du moteur (le capot tremble au ralenti)
      vib = on ? (0.0025 + rpm * 0.002) : 0;
      motor.position.x = Math.sin(time * 61) * vib;
      motor.rotation.z = Math.sin(time * 47) * vib * 2;
      // relevage : moteur relevé quand il est coupé (hélice hors de l'eau)
      motor.rotation.x = damp(motor.rotation.x, on ? 0 : -0.55, 2, dt);
      // lanterne : pendule (accélérations de la barque, roulis)
      const acc = ((s.speed || 0) - lastSpeed) / Math.max(dt, 1e-3); lastSpeed = s.speed || 0;
      swingV += (-swing * 14 - swingV * 1.6 + clamp(acc, -6, 6) * 0.05 + (s.sway || 0) * 2) * dt;
      swing += swingV * dt;
      lanternG.rotation.x = clamp(swing, -0.6, 0.6);
      lanternG.rotation.z = Math.sin(time * 1.3) * 0.04 + (s.sway || 0) * 0.3;
      // lumières
      const L = !!s.lights;
      M.glass.emissiveIntensity = L ? 1.6 + 0.25 * Math.sin(time * 9.7) * Math.sin(time * 4.1) : 0.05;
      M.lens.emissiveIntensity = L ? 2.2 : 0;
      // dégâts : la coque s'assombrit (eau, éclats)
      const dmg = clamp(s.damage || 0, 0, 1);
      M.hull.color.setScalar(1 - dmg * 0.35);
    }
    function damp(a, b, k, dt) { return b + (a - b) * Math.exp(-k * dt); }
    update(0, {});

    // ---- un maillage par matière et par pièce mobile (coque, moteur, hélice, barre, lanterne,
    // projecteur) : de ~200 pièces à une vingtaine d'appels de dessin, sans rien changer à l'image
    const partsBefore = geos.length;
    function mergeChildren(parent) {
      const byMat = new Map();
      for (const ch of parent.children) {
        if (!ch.isMesh || ch.material === M.water) continue;
        if (!byMat.has(ch.material)) byMat.set(ch.material, []);
        byMat.get(ch.material).push(ch);
      }
      for (const [mat, list] of byMat) {
        if (list.length < 2) continue;
        let n = 0;
        const parts = list.map((m) => {
          m.updateMatrix();
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          g.applyMatrix4(m.matrix);
          n += g.attributes.position.count;
          return g;
        });
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let o = 0;
        for (const g of parts) {
          const c = g.attributes.position.count;
          pos.set(g.attributes.position.array, o * 3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
          o += c;
          g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        const mm = new THREE.Mesh(geo, mat);
        mm.castShadow = list.some((m) => m.castShadow); mm.receiveShadow = true;
        mm.name = list.map((m) => m.name).find((x) => x) || '';
        for (const old of list) {
          parent.remove(old);
          const i = geos.indexOf(old.geometry);
          if (i >= 0) geos.splice(i, 1);
          old.geometry.dispose();
        }
        parent.add(mm);
        geos.push(geo);
      }
    }
    for (const g of [object, motor, prop, tiller, lanternG, spot]) mergeChildren(g);
    // détails (métal, cordages, réservoir, lanterne, projecteur, hélice) : cachés au loin (setDetail)
    const detail = [];
    object.traverse((o) => { if (o.isMesh && o.material !== M.hull && o.material !== M.inner && o.material !== M.wood && o.material !== M.cowl) detail.push(o); });
    let detailOn = true;
    function setDetail(on) { on = !!on; if (on === detailOn) return; detailOn = on; for (const o of detail) o.visible = on; }

    let tris = 0;
    object.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    return {
      object, update, setDetail, anchors, motor, prop, tiller, lantern: lanternG, spot, materials: M, textures: tex,
      size: { len: LEN, wid: halfBeam(0.7) * 2 + 0.1, draft: 0.17, freeboard: sheer(0.6) },
      // place du barreur (banc de poupe, à gauche de la barre) et fond de la barque, dans le repère du modèle
      seat: { x: -0.2, y: seatY + 0.02, z: Z0 + LEN * 0.85 }, floorY: keel(0.7) + 0.085,
      stats: { triangles: Math.round(tris), meshes: geos.length, parts: partsBefore },
      dispose() { for (const g of geos) g.dispose(); for (const k in M) M[k].dispose(); for (const k in tex) tex[k].dispose(); if (object.parent) object.parent.remove(object); },
    };
  }

  // ---------------------------------------------------------------- son du moteur
  /* Hors-bord monocylindre deux temps : une explosion par tour (ralenti 1 000 tr/min : 17 Hz ;
     plein régime 5 200 : 87 Hz). Train d'impulsions (dent de scie saturée) dans deux résonances
     d'échappement, demi-harmonique (« ring-ding » du deux temps), sifflement d'admission modulé au
     régime, gargouillis de l'échappement dans l'eau (bruit grave modulé), sillage, clapot sur la coque. */
  function createAudio(ctx, dest, opts) {
    const O = Object.assign({ volume: 1 }, opts || {});
    const out = ctx.createGain(); out.gain.value = 0; out.connect(dest);
    const master = ctx.createGain(); master.gain.value = O.volume; master.connect(out);
    const SR = ctx.sampleRate;
    const noiseBuf = (() => { const n = SR * 2, b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const brownBuf = (() => { const n = SR * 3, b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0); let v = 0; for (let i = 0; i < n; i++) { v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; } return b; })();
    const t0 = ctx.currentTime;
    const nodes = [];
    const src = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, Math.random()); nodes.push(s); return s; };
    const bq = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    // moteur : impulsions
    const engine = ctx.createGain(); engine.gain.value = 0; engine.connect(master);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 17; osc.start(t0); nodes.push(osc);
    const sub = ctx.createOscillator(); sub.type = 'square'; sub.frequency.value = 8.5; sub.start(t0); nodes.push(sub);
    const shaper = ctx.createWaveShaper();
    { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.45); } shaper.curve = c; }
    const pre = ctx.createGain(); pre.gain.value = 0.9; osc.connect(pre);
    const subG = ctx.createGain(); subG.gain.value = 0.35; sub.connect(subG); subG.connect(pre);
    pre.connect(shaper);
    const ex1 = bq('bandpass', 420, 2.2), ex2 = bq('bandpass', 1150, 3.5), lowB = bq('lowpass', 260, 0.9);
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain(); g1.gain.value = 0.8; g2.gain.value = 0.32; g3.gain.value = 0.9;
    shaper.connect(ex1); ex1.connect(g1); g1.connect(engine);
    shaper.connect(ex2); ex2.connect(g2); g2.connect(engine);
    shaper.connect(lowB); lowB.connect(g3); g3.connect(engine);
    // sifflement d'admission modulé au régime
    const hiss = src(noiseBuf), hissF = bq('bandpass', 2600, 1.2), hissAM = ctx.createGain(); hissAM.gain.value = 0;
    hiss.connect(hissF); hissF.connect(hissAM); hissAM.connect(engine);
    const am = ctx.createGain(); am.gain.value = 0.04; osc.connect(am); am.connect(hissAM.gain);
    // gargouillis d'échappement sous l'eau
    const burb = src(brownBuf), burbF = bq('lowpass', 180, 1.5), burbAM = ctx.createGain(); burbAM.gain.value = 0;
    burb.connect(burbF); burbF.connect(burbAM); burbAM.connect(master);
    const am2 = ctx.createGain(); am2.gain.value = 0.5; sub.connect(am2); am2.connect(burbAM.gain);
    // eau : sillage (bruit de surface) et étrave
    const wake = src(noiseBuf), wakeF = bq('bandpass', 700, 0.6), wakeG = ctx.createGain(); wakeG.gain.value = 0;
    wake.connect(wakeF); wakeF.connect(wakeG); wakeG.connect(master);
    const swash = src(brownBuf), swashF = bq('lowpass', 420, 0.7), swashG = ctx.createGain(); swashG.gain.value = 0;
    swash.connect(swashF); swashF.connect(swashG); swashG.connect(master);
    let rpm = 0, on = false, starting = 0, alive = true;
    const T = () => ctx.currentTime;
    const burst = (dur, f, q, peak, type) => {
      const s = ctx.createBufferSource(); s.buffer = type === 'b' ? brownBuf : noiseBuf;
      const f1 = bq(type === 'b' ? 'lowpass' : 'bandpass', f, q), g = ctx.createGain(); g.gain.value = 0;
      s.connect(f1); f1.connect(g); g.connect(master);
      const t = T(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
      setTimeout(() => { try { s.disconnect(); f1.disconnect(); g.disconnect(); } catch (e) { /* rien */ } }, (dur + 0.3) * 1000);
    };
    out.gain.setTargetAtTime(1, t0, 0.2);
    return {
      output: out,
      start() {
        // tirage du lanceur : deux tours qui toussent, puis le moteur prend
        on = true; starting = 1.1;
        const t = T();
        for (let i = 0; i < 3; i++) setTimeout(() => burst(0.18, 380, 1.5, 0.45, 'n'), i * 260);
        engine.gain.setTargetAtTime(0.05, t, 0.1);
      },
      stop() { on = false; },
      update(s) {
        if (!alive) return;
        s = s || {};
        const t = T();
        if (s.on !== undefined && !!s.on !== on && !starting) on = !!s.on;
        if (starting > 0) starting = Math.max(0, starting - 1 / 60);
        const target = on ? clamp(0.12 + 0.88 * (s.rpm || 0), 0, 1) : 0;
        rpm += (target - rpm) * (on ? 0.08 : 0.04);
        const f = 15 + rpm * 74;                                   // explosions par seconde
        osc.frequency.setTargetAtTime(Math.max(4, f), t, 0.05);
        sub.frequency.setTargetAtTime(Math.max(2, f / 2), t, 0.05);
        ex1.frequency.setTargetAtTime(380 + rpm * 260, t, 0.1);
        ex2.frequency.setTargetAtTime(1000 + rpm * 700, t, 0.1);
        const load = clamp(s.load || 0, 0, 1);
        const lv = on || rpm > 0.02 ? (0.16 + 0.22 * rpm + 0.1 * load) * (starting > 0 ? 0.5 : 1) : 0;
        engine.gain.setTargetAtTime(lv, t, 0.08);
        hissAM.gain.setTargetAtTime(on ? 0.03 + 0.06 * rpm : 0, t, 0.1);
        burbAM.gain.setTargetAtTime(on ? 0.25 + 0.4 * rpm : 0, t, 0.1);
        const sp = clamp((s.speed || 0) / 6.5, 0, 1.3);
        wakeG.gain.setTargetAtTime(0.06 * sp, t, 0.2);
        wakeF.frequency.setTargetAtTime(500 + 900 * sp, t, 0.2);
        swashG.gain.setTargetAtTime(0.12 * sp + 0.03, t, 0.3);
      },
      slap(k) { burst(0.22, 520, 0.8, 0.35 * clamp(k, 0, 2), 'b'); burst(0.12, 1600, 1, 0.12 * clamp(k, 0, 2), 'n'); },
      clunk(k) { burst(0.4, 160, 1.2, 0.9 * clamp(k, 0, 2), 'b'); burst(0.15, 1300, 2, 0.35 * clamp(k, 0, 2), 'n'); },
      scrape(k) { burst(0.6, 900, 0.7, 0.3 * clamp(k, 0, 2), 'n'); burst(0.5, 220, 1, 0.4 * clamp(k, 0, 2), 'b'); },
      setVolume(v) { master.gain.setTargetAtTime(clamp(v, 0, 2), T(), 0.1); },
      get rpm() { return rpm; },
      dispose() {
        alive = false;
        out.gain.setTargetAtTime(0, T(), 0.08);
        setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* rien */ } } try { out.disconnect(); } catch (e) { /* rien */ } }, 400);
      },
    };
  }

  const api = { create, createAudio, LENGTH: LEN, VERSION: '1.0.0' };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.Barque = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined);
