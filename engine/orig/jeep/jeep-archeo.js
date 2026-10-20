/*
 * jeep-archeo.js — jeep 4x4 d'expédition archéologique (années 1940) pour Three.js, sans fichier externe.
 * Compatible Three.js r128 (la version des artefacts Claude) et les versions récentes.
 *
 * Utilisation :
 *   const jeep = createArcheoJeep(THREE);           // le modèle 3D (≈ 15 600 triangles, 31 draw calls)
 *   scene.add(jeep.object);
 *   const drive = createJeepDrive();                // conduite : 60 ch, 3 rapports, pont 4,88
 *   drive.startEngine();                            // démarreur ~1 s, puis ralenti accéléré (starter)
 *   // à chaque image (dt en secondes ; jusqu'à 0,25 s, découpé en sous-pas de 1/60 s) :
 *   const st = drive.update(dt, { throttle, brake, steer });   // 0..1, 0..1, -1 gauche .. +1 droite
 *   jeep.object.rotation.y += st.yawRate * dt;
 *   jeep.object.translateZ(st.speed * dt);          // l'avant de la jeep est l'axe +Z
 *   jeep.update(dt, st);                             // roues, volant, caisse, lanterne, fanion
 *   sound.update(st);                                // voir jeep-audio.js
 *
 * Repères fournis : jeep.seatEye (caméra du conducteur), jeep.exhaust (fumée), jeep.dustEmitters (poussière).
 * Réglages : createJeepDrive({ maxLateral: 9, brakeDecel: 7 }) rend la conduite plus « arcade » ;
 *            toutes les valeurs par défaut sont lisibles dans drive.params.
 * Options : createArcheoJeep(THREE, { lights: true })  ajoute deux vrais projecteurs (plus coûteux) ;
 *           jeep.setHeadlights(true|false)            allume les phares.
 * Dessin original inspiré des 4x4 légers des années 1940 (pas de logo ni de calandre de marque).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------------------------
  // Modèle 3D. Unités : mètres. Origine au sol, au centre entre les essieux. Avant = +Z, gauche = +X.
  // ---------------------------------------------------------------------------------------------
  function createArcheoJeep(THREE, options) {
    const O = Object.assign({ shadows: true, lights: false, headlights: false }, options || {});
    const COL = Object.assign({
      paint: 0xa8915f,      // sable délavé
      paintDark: 0x7f6b45,
      dust: 0x9f8a63,
      metal: 0x45433d,      // châssis, ferrures
      steel: 0x6b6a62,
      rubber: 0x262321,
      rim: 0x7a6c4e,
      canvas: 0xcbb68c,
      canvasDark: 0x9c8962,
      seat: 0x5f5139,
      wood: 0x94704a,
      woodDark: 0x5f4429,
      straw: 0xc9ad62,
      rope: 0xb39a69,
      terracotta: 0xb0633b,
      glass: 0xa9c4cf,
      lamp: 0xfff0c8,
      red: 0x8f1d14,
      olive: 0x55583a,
      brass: 0xb08d3c,
      flag: 0xc58a2e,
      flagStripe: 0x7d2318
    }, O.colors || {});

    const legacyLights = parseInt(THREE.REVISION, 10) < 155;
    const std = (c, r, m, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, extra || {}));
    const MAT = {
      paint: std(COL.paint, 0.82, 0.12),
      paintDark: std(COL.paintDark, 0.85, 0.12),
      dust: std(COL.dust, 0.95, 0.02),
      metal: std(COL.metal, 0.62, 0.45),
      steel: std(COL.steel, 0.45, 0.6),
      rubber: std(COL.rubber, 0.95, 0.0),
      rim: std(COL.rim, 0.8, 0.15),
      canvas: std(COL.canvas, 1.0, 0.0),
      canvasDark: std(COL.canvasDark, 1.0, 0.0),
      seat: std(COL.seat, 0.9, 0.0),
      wood: std(COL.wood, 0.9, 0.0, { flatShading: true }),
      woodDark: std(COL.woodDark, 0.9, 0.0, { flatShading: true }),
      straw: std(COL.straw, 1.0, 0.0, { flatShading: true }),
      rope: std(COL.rope, 1.0, 0.0),
      terracotta: std(COL.terracotta, 0.85, 0.0),
      glass: std(COL.glass, 0.08, 0.0, { transparent: true, opacity: 0.32, depthWrite: false }),
      lamp: std(COL.lamp, 0.2, 0.0, { emissive: new THREE.Color(COL.lamp), emissiveIntensity: 0.05 }),
      red: std(COL.red, 0.35, 0.0, { emissive: new THREE.Color(COL.red), emissiveIntensity: 0.25 }),
      olive: std(COL.olive, 0.7, 0.2),
      brass: std(COL.brass, 0.4, 0.7),
      flag: std(COL.flag, 1.0, 0.0, { side: THREE.DoubleSide }),
      flagStripe: std(COL.flagStripe, 1.0, 0.0, { side: THREE.DoubleSide })
    };

    // --- outils de construction : chaque pièce est rangée par matériau puis fusionnée ---------------
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    let parentM = null;
    function bucketsNew() { return {}; }
    let B = bucketsNew();
    function put(key, geo, m) {
      const mm = parentM ? parentM.clone().multiply(m) : m;
      geo.applyMatrix4(mm);
      (B[key] || (B[key] = [])).push(geo);
    }
    function M(x, y, z, rx, ry, rz, sx, sy, sz) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
      return new THREE.Matrix4().compose(V3(x, y, z), q, V3(sx || 1, sy || 1, sz || 1));
    }
    const box = (k, w, h, d, x, y, z, rx, ry, rz) => put(k, new THREE.BoxGeometry(w, h, d), M(x, y, z, rx, ry, rz));
    const cyl = (k, rt, rb, h, seg, x, y, z, rx, ry, rz) => put(k, new THREE.CylinderGeometry(rt, rb, h, seg), M(x, y, z, rx, ry, rz));
    function bar(k, a, b, r, seg, r2) {
      const A = V3(a[0], a[1], a[2]), Bp = V3(b[0], b[1], b[2]);
      const d = Bp.clone().sub(A), len = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize());
      put(k, new THREE.CylinderGeometry(r2 == null ? r : r2, r, len, seg || 8), new THREE.Matrix4().compose(A.clone().add(Bp).multiplyScalar(0.5), q, V3(1, 1, 1)));
    }
    function tilted(pivot, rx, fn) { // construit des pièces dans un repère tourné autour d'une charnière (axe X)
      const prev = parentM;
      parentM = new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2])
        .multiply(new THREE.Matrix4().makeRotationX(rx))
        .multiply(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
      if (prev) parentM = prev.clone().multiply(parentM);
      fn();
      parentM = prev;
    }
    function merge(list) {
      let count = 0;
      const parts = list.map((g0) => {
        const g = g0.index ? g0.toNonIndexed() : g0;
        if (!g.attributes.normal) g.computeVertexNormals();
        count += g.attributes.position.count;
        return g;
      });
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
      let o = 0;
      parts.forEach((g, i) => {
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
        if (g !== list[i]) g.dispose();
        list[i].dispose();
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.computeBoundingBox(); out.computeBoundingSphere();
      return out;
    }
    function flush(group, name) { // une mesh par matériau
      Object.keys(B).forEach((k) => {
        const mesh = new THREE.Mesh(merge(B[k]), MAT[k]);
        mesh.name = name + ':' + k;
        mesh.castShadow = O.shadows && k !== 'glass';
        mesh.receiveShadow = O.shadows;
        group.add(mesh);
      });
      B = bucketsNew();
    }

    // --- dimensions (Willys MB : empattement 80 po, voie 49 po, pneus 6.00-16) -----------------------
    const R = 0.343, TRACK = 0.62, AXF = 1.015, AXR = -1.015;
    const root = new THREE.Group(); root.name = 'JeepArcheo';
    const body = new THREE.Group(); body.name = 'carrosserie';
    root.add(body);

    // ===== châssis, essieux, suspension, échappement =====
    box('metal', 0.07, 0.11, 3.05, 0.40, 0.435, 0.075);
    box('metal', 0.07, 0.11, 3.05, -0.40, 0.435, 0.075);
    [1.52, 0.35, -0.55, -1.42].forEach((z) => box('metal', 0.80, 0.06, 0.08, 0, 0.44, z));
    [AXF, AXR].forEach((z) => {
      bar('metal', [-0.60, R, z], [0.60, R, z], 0.045, 10);
      cyl('metal', 0.12, 0.12, 0.17, 14, -0.1, R, z, 0, 0, Math.PI / 2);
      bar('metal', [-0.1, R, z], [-0.1, 0.43, z > 0 ? z - 0.45 : z + 0.45], 0.035, 8); // arbre de transmission
      [0.42, -0.42].forEach((x) => {
        box('steel', 0.05, 0.035, 0.95, x, 0.39, z);           // ressorts à lames
        box('steel', 0.045, 0.03, 0.70, x, 0.365, z);
        bar('metal', [x * 0.95, R + 0.02, z + 0.12], [x * 0.95, 0.47, z + 0.30], 0.02, 8); // amortisseur
      });
    });
    bar('metal', [-0.55, 0.37, AXF + 0.18], [0.55, 0.37, AXF + 0.18], 0.014, 6);   // barre de direction
    cyl('metal', 0.08, 0.08, 0.55, 12, -0.30, 0.40, -0.30, Math.PI / 2, 0, 0);      // silencieux
    bar('metal', [-0.30, 0.40, -0.02], [-0.16, 0.44, 0.60], 0.025, 8);
    bar('metal', [-0.30, 0.40, -0.58], [-0.46, 0.36, -1.47], 0.025, 8);               // sortie à l'arrière droit

    // ===== caisse =====
    const side = new THREE.Shape();
    side.moveTo(0.31, 0.50);
    side.lineTo(-0.6147, 0.50);
    side.absarc(-1.015, 0.343, 0.43, 0.3653, 2.7763, false);  // passage de roue arrière
    side.lineTo(-1.50, 0.50);
    side.lineTo(-1.50, 0.99);
    side.lineTo(-0.72, 0.99);
    side.quadraticCurveTo(-0.62, 0.99, -0.60, 0.90);         // découpe d'accès (pas de portes)
    side.lineTo(-0.56, 0.84);
    side.quadraticCurveTo(-0.52, 0.80, -0.45, 0.80);
    side.lineTo(0.02, 0.80);
    side.quadraticCurveTo(0.12, 0.80, 0.16, 0.88);
    side.lineTo(0.22, 0.99);
    side.lineTo(0.31, 1.0);
    side.lineTo(0.31, 0.50);
    const sideGeo = () => new THREE.ExtrudeGeometry(side, { depth: 0.03, bevelEnabled: false, curveSegments: 7 });
    put('paint', sideGeo(), M(0.665, 0, 0, 0, -Math.PI / 2, 0));
    put('paint', sideGeo(), M(-0.635, 0, 0, 0, -Math.PI / 2, 0));
    box('paint', 1.30, 0.03, 1.81, 0, 0.545, -0.595);                 // plancher
    box('paint', 1.30, 0.46, 0.03, 0, 0.76, -1.50);                   // panneau arrière
    box('paint', 1.30, 0.45, 0.10, 0, 0.775, 0.30);                   // tablier
    [0.53, -0.53].forEach((x) => box('paintDark', 0.22, 0.25, 0.86, x, 0.67, AXR)); // passages de roue intérieurs
    bar('paint', [0.65, 0.99, -1.50], [0.65, 0.99, -0.72], 0.016, 6);  // bords roulés
    bar('paint', [-0.65, 0.99, -1.50], [-0.65, 0.99, -0.72], 0.016, 6);
    bar('paint', [-0.65, 0.99, -1.50], [0.65, 0.99, -1.50], 0.016, 6);
    // poussière en bas de caisse
    box('paintDark', 0.006, 0.07, 0.62, 0.668, 0.535, 0.0);
    box('paintDark', 0.006, 0.07, 0.62, -0.668, 0.535, 0.0);
    // capot, flancs moteur, ailes plates
    box('paint', 0.86, 0.04, 1.205, 0, 0.99, 0.9475);
    bar('paintDark', [0, 1.012, 0.36], [0, 1.012, 1.54], 0.011, 6);       // charnière centrale
    [0.33, -0.33].forEach((x) => box('metal', 0.05, 0.05, 0.03, x, 0.965, 1.565));  // attaches de capot
    [0.43, -0.43].forEach((x) => {
      box('paint', 0.03, 0.17, 1.205, x, 0.895, 0.9475);
      [0.62, 0.72, 0.82].forEach((z) => box('paintDark', 0.034, 0.10, 0.025, x, 0.90, z)); // ouïes
    });
    [0.615, -0.615].forEach((x) => {
      box('paint', 0.37, 0.025, 1.25, x, 0.815, 0.94);                 // aile
      box('paint', 0.37, 0.15, 0.025, x, 0.75, 1.555, -0.22, 0, 0);     // bavolet avant
      box('paintDark', 0.372, 0.006, 0.30, x, 0.829, 1.38);             // sable sur l'aile
    });
    // calandre à barres horizontales (dessin original)
    box('metal', 0.80, 0.40, 0.06, 0, 0.76, 1.50);                      // radiateur
    box('paintDark', 0.88, 0.035, 0.04, 0, 0.962, 1.565);
    box('paintDark', 0.88, 0.035, 0.04, 0, 0.556, 1.565);
    box('paintDark', 0.035, 0.44, 0.04, 0.425, 0.759, 1.565);
    box('paintDark', 0.035, 0.44, 0.04, -0.425, 0.759, 1.565);
    for (let i = 0; i < 7; i++) box('paint', 0.80, 0.022, 0.03, 0, 0.60 + i * 0.053, 1.57);
    box('paint', 0.03, 0.40, 0.035, 0, 0.759, 1.572);
    // phares sur les ailes
    [0.615, -0.615].forEach((x) => {
      cyl('paintDark', 0.085, 0.07, 0.13, 16, x, 0.905, 1.49, Math.PI / 2, 0, 0);
      put('steel', new THREE.TorusGeometry(0.083, 0.011, 6, 18), M(x, 0.905, 1.555));
      cyl('lamp', 0.074, 0.074, 0.012, 16, x, 0.905, 1.556, Math.PI / 2, 0, 0);
      box('metal', 0.04, 0.07, 0.05, x, 0.84, 1.49);
    });
    // pare-chocs, crochets, sac à eau en toile accroché à l'avant
    box('paintDark', 1.62, 0.12, 0.10, 0, 0.47, 1.645);
    [0.40, -0.40].forEach((x) => box('metal', 0.06, 0.06, 0.12, x, 0.47, 1.56));
    [0.48, -0.48].forEach((x) => put('metal', new THREE.TorusGeometry(0.04, 0.012, 6, 10, Math.PI), M(x, 0.47, 1.70, 0, Math.PI / 2, -Math.PI / 2)));
    put('canvasDark', new THREE.SphereGeometry(1, 10, 6), M(0.27, 0.70, 1.615, 0.08, 0, 0.06, 0.10, 0.13, 0.035));
    cyl('woodDark', 0.012, 0.012, 0.04, 6, 0.30, 0.585, 1.62);
    bar('rope', [0.20, 0.86, 1.60], [0.34, 0.86, 1.60], 0.006, 5);
    bar('rope', [0.20, 0.86, 1.60], [0.22, 0.78, 1.61], 0.005, 4);
    bar('rope', [0.34, 0.86, 1.60], [0.32, 0.78, 1.61], 0.005, 4);
    // arrière : feux, butoirs, crochet d'attelage
    [0.56, -0.56].forEach((x) => { box('red', 0.07, 0.07, 0.03, x, 0.885, -1.522); box('paintDark', 0.18, 0.10, 0.10, x, 0.47, -1.55); });
    box('metal', 0.10, 0.08, 0.10, 0, 0.46, -1.55);
    put('metal', new THREE.TorusGeometry(0.045, 0.012, 6, 12), M(0, 0.46, -1.62, Math.PI / 2, 0, 0));
    // jerrican sur le panneau arrière
    box('metal', 0.36, 0.035, 0.18, -0.42, 0.50, -1.59);
    box('olive', 0.32, 0.46, 0.15, -0.42, 0.75, -1.59);
    box('olive', 0.30, 0.012, 0.02, -0.42, 0.75, -1.667, 0, 0, 0.88);
    box('olive', 0.30, 0.012, 0.02, -0.42, 0.75, -1.667, 0, 0, -0.88);
    [-0.50, -0.42, -0.34].forEach((x) => bar('olive', [x, 0.98, -1.56], [x, 0.98, -1.62], 0.012, 5));
    bar('metal', [-0.58, 0.88, -1.668], [-0.26, 0.88, -1.668], 0.01, 5);
    // support de roue de secours
    box('metal', 0.12, 0.12, 0.10, 0.28, 0.76, -1.55);

    // ===== tableau de bord, sièges, volant, leviers =====
    box('paintDark', 1.18, 0.20, 0.03, 0, 0.88, 0.245);
    [0.25, 0.12, -0.02].forEach((x, i) => {
      cyl('metal', 0.035, 0.035, 0.03, 12, x, 0.905, 0.232, Math.PI / 2, 0, 0);
      cyl('lamp', 0.028, 0.028, 0.005, 12, x, 0.905, 0.215, Math.PI / 2, 0, 0);
      if (i === 2) box('metal', 0.08, 0.05, 0.02, -0.25, 0.89, 0.232);
    });
    [0.29, -0.29].forEach((x) => {
      box('metal', 0.34, 0.12, 0.34, x, 0.61, -0.18);
      box('seat', 0.42, 0.09, 0.42, x, 0.715, -0.18);
      box('seat', 0.42, 0.42, 0.07, x, 0.95, -0.43, -0.18, 0, 0);
      bar('metal', [x - 0.2, 0.73, -0.40], [x - 0.2, 1.14, -0.47], 0.012, 6);
      bar('metal', [x + 0.2, 0.73, -0.40], [x + 0.2, 1.14, -0.47], 0.012, 6);
    });
    bar('metal', [0.29, 0.86, 0.24], [0.29, 1.02, 0.0], 0.022, 8);      // colonne de direction
    bar('steel', [0.05, 0.56, 0.08], [0.0, 0.86, -0.02], 0.009, 6);       // levier de vitesses
    cyl('rubber', 0.022, 0.022, 0.04, 8, 0.0, 0.875, -0.025);
    bar('steel', [-0.06, 0.56, 0.06], [-0.09, 0.78, 0.0], 0.008, 6);      // levier de transfert
    cyl('rubber', 0.018, 0.018, 0.035, 8, -0.09, 0.79, 0.0);

    // ===== outils d'archéologue sur le flanc gauche : pioche et pelle =====
    bar('wood', [0.69, 0.80, -0.66], [0.69, 0.80, -1.40], 0.017, 7);
    put('steel', new THREE.CylinderGeometry(0.004, 0.022, 0.13, 6), M(0.69, 0.885, -0.66));
    put('steel', new THREE.CylinderGeometry(0.022, 0.004, 0.13, 6), M(0.69, 0.725, -0.66));
    box('steel', 0.03, 0.05, 0.05, 0.69, 0.80, -0.66);
    bar('wood', [0.693, 0.93, -0.74], [0.693, 0.93, -1.27], 0.015, 7);
    put('steel', new THREE.TorusGeometry(0.035, 0.008, 5, 10), M(0.693, 0.93, -0.70, 0, Math.PI / 2, 0));
    box('steel', 0.012, 0.18, 0.22, 0.695, 0.93, -1.37);
    [-0.95, -1.20].forEach((z) => box('metal', 0.04, 0.20, 0.03, 0.675, 0.87, z));

    // ===== chargement : caisses, amphore, tamis, corde, bâche roulée =====
    function crate(x, y0, z, w, h, d, lidOpen) {
      box('wood', w, h, d, x, y0 + h / 2, z);
      for (let i = 1; i < 3; i++) {
        box('woodDark', w + 0.004, 0.012, d + 0.004, x, y0 + h * i / 3, z);
      }
      box('woodDark', 0.03, h + 0.004, d + 0.006, x - w / 2 + 0.015, y0 + h / 2, z);
      box('woodDark', 0.03, h + 0.004, d + 0.006, x + w / 2 - 0.015, y0 + h / 2, z);
      if (lidOpen) {
        box('wood', w, 0.02, d, x, y0 + h + 0.01 + Math.sin(1.15) * d / 2, z - d / 2 - Math.cos(1.15) * d / 2 + 0.01, -1.15, 0, 0);
        box('rope', w - 0.04, 0.03, d - 0.04, x, y0 + h - 0.02, z);
      } else {
        box('wood', w + 0.02, 0.025, d + 0.02, x, y0 + h + 0.012, z);
      }
    }
    crate(-0.20, 0.56, -1.12, 0.40, 0.30, 0.42, true);
    crate(0.21, 0.56, -1.13, 0.38, 0.34, 0.42, false);
    // amphore (tour de potier)
    const amph = [[0.0, 0.0], [0.035, 0.0], [0.05, 0.03], [0.10, 0.12], [0.135, 0.25], [0.13, 0.34], [0.09, 0.42], [0.045, 0.46], [0.04, 0.53], [0.055, 0.555], [0.05, 0.57], [0.035, 0.56]];
    put('terracotta', new THREE.LatheGeometry(amph.map((p) => new THREE.Vector2(p[0], p[1])), 16), M(-0.20, 0.62, -1.10, 0.12, 0, 0.08));
    [1, -1].forEach((sgn) => put('terracotta', new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI), M(-0.20 + sgn * 0.065, 1.10, -1.06, 0, 0, sgn > 0 ? -Math.PI / 2 : Math.PI / 2)));
    // tamis posé sur la caisse fermée, corde par-dessus
    const sx = 0.21, sy = 0.95, sz = -1.13;
    tilted([sx, sy, sz], 0.0, () => {
      [[0, 0.27], [0, -0.27]].forEach((p) => box('wood', 0.56, 0.06, 0.03, sx, sy, sz + p[1]));
      [[0.27, 0], [-0.27, 0]].forEach((p) => box('wood', 0.03, 0.06, 0.56, sx + p[0], sy, sz));
      for (let i = -4; i <= 4; i++) {
        box('steel', 0.004, 0.004, 0.52, sx + i * 0.055, sy - 0.02, sz);
        box('steel', 0.52, 0.004, 0.004, sx, sy - 0.02, sz + i * 0.055);
      }
    });
    put('rope', new THREE.TorusGeometry(0.11, 0.022, 6, 18), M(0.24, 0.99, -1.10, Math.PI / 2, 0, 0));
    put('rope', new THREE.TorusGeometry(0.085, 0.02, 6, 16), M(0.25, 1.025, -1.11, Math.PI / 2, 0, 0));
    // capote repliée sur le panneau arrière, arceaux couchés
    [0.62, -0.62].forEach((x) => bar('metal', [x, 1.03, -0.95], [x, 1.03, -1.47], 0.013, 6));
    bar('metal', [-0.62, 1.03, -0.95], [0.62, 1.03, -0.95], 0.013, 6);
    [0.62, -0.62].forEach((x) => box('metal', 0.04, 0.05, 0.05, x, 1.005, -1.47));
    cyl('canvasDark', 0.075, 0.075, 1.26, 12, 0, 1.08, -1.46, 0, 0, Math.PI / 2);
    [0.38, -0.38, 0].forEach((x) => put('woodDark', new THREE.TorusGeometry(0.078, 0.008, 5, 14), M(x, 1.08, -1.46, 0, Math.PI / 2, 0)));

    // ===== pare-brise rabattable, légèrement incliné =====
    tilted([0, 1.0, 0.28], -0.10, () => {
      box('paint', 1.30, 0.04, 0.045, 0, 1.02, 0.28);
      box('paint', 1.30, 0.035, 0.035, 0, 1.315, 0.28);
      box('paint', 0.035, 0.33, 0.035, 0.635, 1.165, 0.28);
      box('paint', 0.035, 0.33, 0.035, -0.635, 1.165, 0.28);
      box('paint', 0.03, 0.28, 0.03, 0, 1.165, 0.28);
      box('glass', 0.59, 0.25, 0.008, 0.31, 1.168, 0.28);
      box('glass', 0.59, 0.25, 0.008, -0.31, 1.168, 0.28);
      bar('steel', [0.18, 1.29, 0.30], [0.40, 1.21, 0.30], 0.005, 4);
      bar('steel', [-0.44, 1.29, 0.30], [-0.22, 1.21, 0.30], 0.005, 4);
    });

    // ===== fanion de l'expédition =====
    bar('steel', [0.62, 0.99, -1.47], [0.62, 1.95, -1.47], 0.007, 5);
    const flag = new THREE.Group(); flag.position.set(0.62, 1.88, -1.47);
    const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0.07); flagShape.lineTo(-0.34, 0); flagShape.lineTo(0, -0.07); flagShape.lineTo(0, 0.07);
    const flagMesh = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), MAT.flag);
    flagMesh.rotation.y = -Math.PI / 2;
    const stripe = new THREE.Shape(); stripe.moveTo(0, 0.025); stripe.lineTo(-0.22, 0.0); stripe.lineTo(0, -0.025); stripe.lineTo(0, 0.025);
    const stripeMesh = new THREE.Mesh(new THREE.ShapeGeometry(stripe), MAT.flagStripe);
    stripeMesh.rotation.y = -Math.PI / 2; stripeMesh.position.x = 0.001;
    flag.add(flagMesh, stripeMesh);
    body.add(flag);

    flush(body, 'caisse');

    // ===== volant (animé) =====
    const steerMount = new THREE.Group();
    steerMount.position.set(0.29, 1.03, -0.015);
    steerMount.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, 0.16, -0.24).normalize());
    const steeringWheel = new THREE.Group(); steerMount.add(steeringWheel);
    put('rubber', new THREE.TorusGeometry(0.19, 0.013, 7, 28), M(0, 0, 0));
    [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6].forEach((a) => bar('steel', [0, 0, 0], [Math.cos(a) * 0.185, Math.sin(a) * 0.185, 0], 0.009, 5));
    cyl('steel', 0.035, 0.035, 0.05, 10, 0, 0, 0, Math.PI / 2, 0, 0);
    flush(steeringWheel, 'volant');
    body.add(steerMount);

    // ===== lanterne qui se balance =====
    const lantern = new THREE.Group(); lantern.position.set(-0.69, 1.30, 0.27);
    put('brass', new THREE.TorusGeometry(0.025, 0.004, 4, 10, Math.PI), M(0, -0.02, 0));
    put('brass', new THREE.ConeGeometry(0.05, 0.05, 10), M(0, -0.06, 0));
    cyl('lamp', 0.034, 0.034, 0.075, 10, 0, -0.125, 0);
    cyl('brass', 0.05, 0.05, 0.02, 10, 0, -0.175, 0);
    [0, 1, 2, 3].forEach((i) => { const a = i * Math.PI / 2 + 0.4; bar('brass', [Math.cos(a) * 0.043, -0.085, Math.sin(a) * 0.043], [Math.cos(a) * 0.043, -0.165, Math.sin(a) * 0.043], 0.004, 4); });
    flush(lantern, 'lanterne');
    body.add(lantern);

    // ===== roues =====
    function wheelParts() {
      const prof = [[0.205, -0.068], [0.24, -0.080], [0.29, -0.083], [0.322, -0.077], [0.338, -0.064], [0.343, -0.040], [0.344, 0], [0.343, 0.040], [0.338, 0.064], [0.322, 0.077], [0.29, 0.083], [0.24, 0.080], [0.205, 0.068]];
      const tire = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), 28);
      tire.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      const treads = [tire];
      const N = 22;
      for (let i = 0; i < N; i++) {
        for (let row = 0; row < 2; row++) {
          const a = (i + row * 0.5) / N * Math.PI * 2;
          const g = new THREE.BoxGeometry(0.062, 0.02, 0.05);
          g.applyMatrix4(new THREE.Matrix4().compose(V3(row ? -0.036 : 0.036, Math.cos(a) * 0.345, Math.sin(a) * 0.345),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, row ? 0.35 : -0.35, 0)), V3(1, 1, 1)));
          treads.push(g);
        }
      }
      const rimList = [];
      const rimDisc = new THREE.CylinderGeometry(0.205, 0.205, 0.13, 22, 1, true); rimDisc.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); rimList.push(rimDisc);
      const face = new THREE.CylinderGeometry(0.2, 0.2, 0.012, 22); face.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.045, 0, 0)); rimList.push(face);
      const ring = new THREE.TorusGeometry(0.15, 0.012, 6, 22); ring.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0.052, 0, 0)); rimList.push(ring);
      const hub = new THREE.CylinderGeometry(0.075, 0.09, 0.07, 14); hub.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(0.08, 0, 0)); rimList.push(hub);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const nut = new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6);
        nut.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.06, Math.cos(a) * 0.11, Math.sin(a) * 0.11));
        rimList.push(nut);
      }
      return { tire: merge(treads), rim: merge(rimList) };
    }
    const WG = wheelParts();
    function makeWheel(name, x, z, steer) {
      const pivot = new THREE.Group(); pivot.name = name; pivot.position.set(x, R, z);
      const spin = new THREE.Group(); pivot.add(spin);
      const holder = new THREE.Group(); if (x < 0) holder.rotation.y = Math.PI; spin.add(holder);
      const t = new THREE.Mesh(WG.tire, MAT.rubber), r = new THREE.Mesh(WG.rim, MAT.rim);
      t.castShadow = r.castShadow = O.shadows; t.receiveShadow = r.receiveShadow = O.shadows;
      holder.add(t, r);
      root.add(pivot);
      return { pivot: pivot, spin: spin, steer: steer };
    }
    const wheels = {
      fl: makeWheel('roue AVG', TRACK, AXF, true), fr: makeWheel('roue AVD', -TRACK, AXF, true),
      rl: makeWheel('roue ARG', TRACK, AXR, false), rr: makeWheel('roue ARD', -TRACK, AXR, false)
    };
    const spare = new THREE.Group(); spare.position.set(0.28, 0.76, -1.60); spare.rotation.y = Math.PI / 2;
    spare.add(new THREE.Mesh(WG.tire, MAT.rubber), new THREE.Mesh(WG.rim, MAT.rim));
    spare.children.forEach((m) => { m.castShadow = O.shadows; });
    body.add(spare);

    // ===== repères utiles au jeu =====
    const exhaust = new THREE.Object3D(); exhaust.name = 'pot'; exhaust.position.set(-0.46, 0.36, -1.50); body.add(exhaust);
    const seatEye = new THREE.Object3D(); seatEye.name = 'yeux conducteur'; seatEye.position.set(0.29, 1.48, -0.42); body.add(seatEye);
    const dustL = new THREE.Object3D(); dustL.position.set(TRACK, 0.05, AXR - 0.25); root.add(dustL);
    const dustR = new THREE.Object3D(); dustR.position.set(-TRACK, 0.05, AXR - 0.25); root.add(dustR);

    // ===== phares réels (optionnels) =====
    const spots = [];
    if (O.lights) {
      [0.615, -0.615].forEach((x) => {
        const sp = new THREE.SpotLight(0xfff0c8, legacyLights ? 1.4 : 30, 40, 0.45, 0.55, legacyLights ? 1 : 2);
        sp.position.set(x, 0.905, 1.58);
        sp.target.position.set(x * 1.4, 0.2, 12);
        sp.visible = false;
        body.add(sp, sp.target);
        spots.push(sp);
      });
    }
    function setHeadlights(on) {
      MAT.lamp.emissiveIntensity = on ? 2.2 : 0.05;
      spots.forEach((s) => { s.visible = !!on; });
    }
    setHeadlights(!!O.headlights);

    // ===== animation =====
    let spinA = 0, t = 0;
    const lant = { ax: 0, vx: 0, az: 0, vz: 0 };
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
    function update(dt, st) {
      st = st || {};
      dt = clamp(dt || 0, 0, 0.25);
      t += dt;
      const v = st.speed || 0, steer = st.steerAngle || 0, yaw = st.yawRate || 0, acc = st.accel || 0;
      spinA += v / R * dt;
      for (const k in wheels) {
        const w = wheels[k];
        w.spin.rotation.x = spinA;
        if (w.steer) w.pivot.rotation.y = steer;
      }
      steeringWheel.rotation.z = steer * 12;
      // caisse : tremblement du moteur, cabrage à l'accélération, roulis en virage
      const running = st.engine === 'running', cranking = st.engine === 'cranking';
      const rpm = st.rpm || 0;
      const shake = cranking ? 0.0045 : running ? 0.003 * Math.max(0.3, 1 - rpm / 2200) : 0;
      const k = Math.min(1, dt * 6);
      body.rotation.x += (clamp(-acc * 0.006, -0.035, 0.035) - body.rotation.x) * k;
      body.rotation.z += (clamp(yaw * v * 0.012, -0.06, 0.06) - body.rotation.z) * k;
      body.position.y = shake * Math.sin(t * 71) + shake * 0.6 * Math.sin(t * 43.7);
      body.rotation.z += shake * 0.8 * Math.sin(t * 57.3);
      // lanterne : pendule (L = 15 cm) poussé par les accélérations
      const g = 9.81 / 0.15, damp = 2.2, n = Math.max(1, Math.ceil(dt * 60 - 1e-9)), h = dt / n;
      for (let i = 0; i < n; i++) {
        lant.vx += (-g * Math.sin(lant.ax) - damp * lant.vx + acc / 0.15 * 0.6) * h;
        lant.vz += (-g * Math.sin(lant.az) - damp * lant.vz - yaw * v / 0.15 * 0.6) * h;
        lant.ax = clamp(lant.ax + lant.vx * h, -0.9, 0.9); lant.az = clamp(lant.az + lant.vz * h, -0.9, 0.9);
      }
      lantern.rotation.set(lant.ax + shake * 2 * Math.sin(t * 31), 0, lant.az);
      // fanion
      flag.rotation.y = Math.sin(t * (6 + Math.abs(v) * 0.6)) * (0.12 + Math.min(0.25, Math.abs(v) * 0.02));
    }

    let tris = 0, draws = 0;
    root.traverse((o) => {
      if (o.isMesh) {
        draws++;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });

    return {
      object: root, body: body, wheels: wheels, steeringWheel: steeringWheel, lantern: lantern,
      exhaust: exhaust, seatEye: seatEye, dustEmitters: [dustL, dustR], materials: MAT,
      update: update, setHeadlights: setHeadlights,
      stats: { triangles: Math.round(tris), drawCalls: draws },
      size: { length: 3.45, width: 1.62, height: 1.40, wheelRadius: R },
      dispose() {
        root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
        Object.keys(MAT).forEach((k) => MAT[k].dispose());
      }
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Conduite : physique simple mais calée sur la vraie mécanique (60 ch, 3 rapports, pont 4,88).
  // ---------------------------------------------------------------------------------------------
  function createJeepDrive(options) {
    const P = Object.assign({
      mass: 1150,               // kg : 1 113 kg à vide + conducteur
      wheelRadius: 0.343,       // m : pneus 6.00-16
      wheelbase: 2.03,          // m : 80 pouces
      idleRPM: 600,             // tr/min (valeur constructeur)
      maxRPM: 4300,
      gears: [2.665, 1.564, 1.0], reverse: 3.554, finalDrive: 4.88, efficiency: 0.85,
      rollingResistance: 0.035, // sable tassé, piste
      dragArea: 1.45,           // Cx × S en m² (≈ 0,8 × 1,8 m², pare-brise levé)
      brakeDecel: 6.0,          // m/s², freins à tambour
      maxSteer: 0.42,           // rad aux roues avant : cercle de braquage ≈ 11 m
      maxLateral: 7.0,          // m/s² : au-delà, le braquage est limité (sinon la jeep tournerait sur place à 60 km/h)
      steerSpeed: 2.2,          // rad/s
      upshiftRPM: 3200, downshiftRPM: 1300, shiftTime: 0.6,
      crankTime: [0.9, 1.6],    // s de démarreur avant que le moteur prenne
      chokeTime: 3.5            // s de ralenti accéléré après le démarrage
    }, options || {});
    // couple en N·m : 105 lb·ft (142 N·m) à 2 000 tr/min, 60 ch à 4 000 tr/min
    const TQ = [[0, 0], [300, 70], [600, 118], [1000, 130], [1500, 138], [2000, 142], [2500, 140], [3000, 133], [3500, 121], [4000, 107], [4300, 92], [4600, 0]];
    function torqueAt(rpm) {
      if (rpm <= 0) return 0;
      for (let i = 1; i < TQ.length; i++) {
        if (rpm <= TQ[i][0]) { const a = TQ[i - 1], b = TQ[i]; return a[1] + (b[1] - a[1]) * (rpm - a[0]) / (b[0] - a[0]); }
      }
      return 0;
    }
    const ratio = (g) => (g === -1 ? P.reverse : g >= 1 ? P.gears[g - 1] : 0);
    const rpmAtSpeed = (v, g) => Math.abs(v) / P.wheelRadius * 60 / (2 * Math.PI) * ratio(g) * P.finalDrive;
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

    const s = {
      engine: 'off',      // 'off' | 'cranking' | 'running'
      rpm: 0, speed: 0, speedKmh: 0, accel: 0,
      gear: 1, shifting: false,
      throttle: 0, brake: 0,
      steerAngle: 0, yawRate: 0
    };
    let crankLeft = 0, choke = 0, shiftLeft = 0, pendingGear = 1, reverseHold = 0;

    function startEngine() {
      if (s.engine === 'off' && s.rpm < 80) {
        s.engine = 'cranking';
        crankLeft = P.crankTime[0] + Math.random() * (P.crankTime[1] - P.crankTime[0]);
      }
    }
    function stopEngine() { if (s.engine !== 'off') { s.engine = 'off'; s.shifting = false; shiftLeft = 0; } }

    /**
     * input : { throttle 0..1, brake 0..1, steer -1 (gauche) .. +1 (droite) }
     * Frein maintenu à l'arrêt = marche arrière (le frein sert alors d'accélérateur).
     * Frein + gaz à l'arrêt = moteur débrayé (on peut faire rugir le moteur sur place).
     */
    function step(dt, input) {
      dt = clamp(dt || 0, 0, 0.05);
      input = input || {};
      const thrIn = clamp(input.throttle || 0, 0, 1), brkIn = clamp(input.brake || 0, 0, 1), steerIn = clamp(input.steer || 0, -1, 1);
      const v = s.speed, absV = Math.abs(v);

      // direction
      const steerMax = Math.min(P.maxSteer, Math.atan(P.maxLateral * P.wheelbase / Math.max(1e-3, v * v)));
      const steerTarget = -steerIn * steerMax;
      s.steerAngle += clamp(steerTarget - s.steerAngle, -P.steerSpeed * dt, P.steerSpeed * dt);

      // moteur
      if (s.engine === 'cranking') {
        crankLeft -= dt;
        if (crankLeft <= 0) { s.engine = 'running'; choke = P.chokeTime; }
      }
      if (choke > 0) choke = Math.max(0, choke - dt);
      const running = s.engine === 'running';

      // marche arrière / marche avant
      if (absV < 0.3 && brkIn > 0.5 && thrIn < 0.05) reverseHold += dt;
      else if (thrIn > 0.05 || absV > 0.5) reverseHold = 0;
      if (running && s.gear !== -1 && reverseHold > 0.4 && absV < 0.3) { s.gear = -1; reverseHold = 0; shiftLeft = 0; s.shifting = false; }
      let throttle = thrIn, brake = brkIn;
      if (s.gear === -1) {
        throttle = brkIn; brake = thrIn;
        if (thrIn > 0.05 && absV < 0.3) { s.gear = 1; throttle = thrIn; brake = 0; }
      }

      // passages de vitesses automatiques (boîte à crabots lente : on lâche les gaz)
      if (shiftLeft > 0) {
        shiftLeft -= dt;
        if (shiftLeft <= 0) { s.gear = pendingGear; s.shifting = false; }
      } else if (running && s.gear >= 1) {
        const rw = rpmAtSpeed(v, s.gear);
        if (s.gear < 3 && rw > P.upshiftRPM && throttle > 0.1) { pendingGear = s.gear + 1; shiftLeft = P.shiftTime; s.shifting = true; }
        else if (s.gear > 1 && ((rw < P.downshiftRPM && throttle > 0.4) || rw < 950)) { pendingGear = s.gear - 1; shiftLeft = P.shiftTime * 0.8; s.shifting = true; }
      }

      const effThrottle = running && !s.shifting ? throttle : 0;
      const idle = P.idleRPM + (choke > 0 ? 420 * Math.min(1, choke / 2.5) : 0);
      const freeRev = absV < 0.3 && brake > 0.5 && throttle > 0.02;
      const wheelRPM = rpmAtSpeed(v, s.gear);
      let target, rise = 2600, fall = 2000;
      if (s.engine === 'cranking') { target = 150; rise = 900; }
      else if (!running) { target = 0; fall = s.rpm * 2.2 + 250; }
      else if (s.shifting) target = Math.max(idle, rpmAtSpeed(v, pendingGear));
      else if (freeRev) target = idle + throttle * (P.maxRPM - 300 - idle);
      else {
        const launch = idle + effThrottle * 1500;          // patinage d'embrayage au départ
        target = Math.max(wheelRPM, launch);
        if (wheelRPM >= launch) { rise = 8000; fall = 8000; } // embrayé : le moteur suit les roues
      }
      target = Math.min(target, P.maxRPM);
      s.rpm += clamp(target - s.rpm, -fall * dt, rise * dt);
      if (s.rpm < 0) s.rpm = 0;

      // forces
      let F = 0;
      if (running && !s.shifting && !freeRev) {
        const dir = s.gear === -1 ? -1 : 1;
        const governor = clamp((P.maxRPM + 100 - wheelRPM) / 200, 0, 1); // plus de couple au-delà du régime maxi
        F = torqueAt(s.rpm) * effThrottle * governor * ratio(s.gear) * P.finalDrive * P.efficiency / P.wheelRadius * dir;
        if (effThrottle < 0.05 && wheelRPM > idle + 50) F -= Math.sign(v) * (12 + s.rpm * 0.006) * ratio(s.gear) * P.finalDrive / P.wheelRadius;
      }
      const resist = (P.rollingResistance * P.mass * 9.81 + 0.5 * 1.2 * P.dragArea * v * v) / P.mass + brake * P.brakeDecel;
      let nv = v + F / P.mass * dt;
      const dec = resist * dt;
      if (nv > 0) nv = Math.max(0, nv - dec); else if (nv < 0) nv = Math.min(0, nv + dec);
      s.accel = (nv - v) / Math.max(dt, 1e-6);
      s.speed = nv;
      s.speedKmh = nv * 3.6;
      s.throttle = effThrottle;
      s.brake = brake;
      s.yawRate = nv * Math.tan(s.steerAngle) / P.wheelbase;
      return s;
    }

    // Images lentes : on découpe en sous-pas de 1/60 s pour que le temps simulé reste le temps réel.
    function update(dt, input) {
      dt = clamp(dt || 0, 0, 0.25);
      const n = Math.max(1, Math.ceil(dt * 60 - 1e-9)), v0 = s.speed;
      for (let i = 0; i < n; i++) step(dt / n, input);
      if (dt > 0) s.accel = (s.speed - v0) / dt;
      return s;
    }

    return {
      state: s, params: P, update: update, torqueAt: torqueAt, rpmAtSpeed: rpmAtSpeed,
      startEngine: startEngine, stopEngine: stopEngine,
      toggleEngine() { if (s.engine === 'off') startEngine(); else stopEngine(); }
    };
  }

  const api = { createArcheoJeep: createArcheoJeep, createJeepDrive: createJeepDrive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.createArcheoJeep = createArcheoJeep; root.createJeepDrive = createJeepDrive; root.JeepArcheo = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
