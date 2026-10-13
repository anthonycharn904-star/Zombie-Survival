/* ------------------------------------------------------ Bâtiments ajoutés --
   Catalogue des bâtiments qu'une carte ouverte peut poser (Mod Tools, niveau 2) : maisons, atelier,
   hangar, tentes, conteneur, cuve, abri, ruine, muret. Faits avec les pièces des lieux (owHouse,
   owTent, owContainer…) : murs, portes, fenêtres et toits sont de vrais solides (on y entre, on y
   pose des armes au mur, les zombies en font le tour). Le terrain est aplani sous chacun.
   Un bâtiment de la carte : { type, x, z, rot, y? } — (x, z) : centre de l'emprise, rot : quarts de
   tour dans le sens des aiguilles d'une montre (vu du plan), y : hauteur du sol (relevée à la pose). */
const OWBLD = {
  maison: {
    name: 'Maison en pisé', w: 8, d: 6, desc: 'Une porte, trois fenêtres, toit plat',
    house: { h: 3.2, wall: 'kh_mudbrick', roof: 'flat', roofTex: 'kh_mudbrick', parapet: 0.3, floorTex: 'kh_floor', doors: [['s', 3, 2]], wins: [['n', 3, 2, 1.0, 2.1], ['e', 2, 2, 1.0, 2.1], ['w', 2, 2, 1.0, 2.1]] },
  },
  maison_blanche: {
    name: 'Maison blanchie', w: 10, d: 8, desc: 'Deux portes, fenêtres, toit en terrasse',
    house: { h: 3.4, wall: 'kh_whitewash', roof: 'flat', roofTex: 'kh_whitewash', parapet: 0.5, floorTex: 'kh_floor', doors: [['s', 2, 2], ['n', 6, 2]], wins: [['s', 6, 2, 1.0, 2.2], ['e', 3, 2, 1.0, 2.2], ['w', 3, 2, 1.0, 2.2]] },
  },
  atelier: {
    name: 'Atelier en tôle', w: 12, d: 9, desc: 'Grande porte, toit à deux pans',
    house: { h: 4.2, wall: 'kh_concrete', roof: 'gable', rise: 1.4, roofTex: 'kh_sheet', floorTex: 'kh_floor', doors: [['w', 2, 5, 3.6]], wins: [['n', 4, 4, 2.4, 3.4], ['s', 4, 4, 2.4, 3.4]] },
  },
  hangar: {
    name: 'Hangar', w: 20, d: 14, desc: 'Grand portail (12 m), toit à deux pans',
    house: { h: 6, wall: 'kh_sheet', wallHex: 0xd8d0c0, roof: 'gable', rise: 2.2, roofTex: 'kh_sheet', floorTex: 'kh_floor', doors: [['s', 4, 12, 5], ['n', 9, 2]], wins: [['e', 5, 4, 3.6, 4.8], ['w', 5, 4, 3.6, 4.8]] },
  },
  ruine: {
    name: 'Ruine', w: 9, d: 8, desc: 'Murs de briques crues sans toit',
    house: { h: 2.5, wall: 'kh_mudbrick', roof: 'none', floorTex: 'kh_floor', doors: [['s', 3, 2], ['e', 4, 2]], wins: [['n', 3, 2, 0.9, 1.9]] },
  },
  tente: { name: 'Tente militaire', w: 6, d: 5, desc: 'Ouverte sur un côté', tent: { h: 2.9, wallH: 1.2, hex: 0xcfbf98 } },
  grande_tente: { name: 'Tente-réfectoire', w: 14, d: 9, desc: 'Grande tente ouverte', tent: { h: 4.4, wallH: 1.9, hex: 0xdcccaa } },
  conteneur: { name: 'Conteneur', w: 6, d: 3, desc: 'Portes ouvertes au bout', container: { hex: 0x35607d } },
  conteneur_rouge: { name: 'Conteneur rouge', w: 12, d: 3, desc: 'Long, portes ouvertes au bout', container: { hex: 0x8d3a28 } },
  cuve: { name: 'Cuve de carburant', w: 8, d: 3, desc: 'Sur berceaux de béton', tank: { r: 1.3, hex: 0xd8d2c4 } },
  abri: { name: 'Abri', w: 4, d: 4, desc: 'Toit de tôle sur poteaux', shelter: { h: 2.8 } },
  muret: { name: 'Muret de sacs de sable', w: 6, d: 1, desc: 'Couvre à hauteur de taille', sandbags: { rows: 3 } },
};
/* Lune (Ombre éternelle, Lune vierge) : modules de la base Séléné et leurs voisins. */
Object.assign(OWBLD, {
  lu_module: { world: 'lune', name: 'Module habitable', w: 16, d: 5, desc: 'Panneaux blancs, porte à chaque bout, hublots', house: { h: 3.4, wall: 'lu_panel', roof: 'flat', roofTex: 'lu_panel', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['w', 1.4, 2.2, 2.6], ['e', 1.4, 2.2, 2.6]], wins: [['n', 3, 2, 1.4, 2.3], ['n', 11, 2, 1.4, 2.3], ['s', 7, 2, 1.4, 2.3]] } },
  lu_hangar: { world: 'lune', name: 'Hangar lunaire', w: 18, d: 12, desc: 'Grand portail (10 m), toit plat', house: { h: 5.5, wall: 'lu_panel', roof: 'flat', roofTex: 'lu_panel_dark', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['s', 4, 10, 4.6], ['n', 8, 2.2, 2.6]] } },
  lu_abri: { world: 'lune', name: 'Abri blindé', w: 6, d: 6, desc: 'Métal brossé, une porte, un hublot', house: { h: 2.9, wall: 'lu_metal', roof: 'flat', roofTex: 'lu_metal', floorTex: 'lu_floor', inTex: 'lu_panel_dark', doors: [['s', 2, 2.2, 2.4]], wins: [['n', 2, 2, 1.5, 2.2]] } },
  lu_reservoir: { world: 'lune', name: 'Réservoir d’oxygène', w: 9, d: 3, desc: 'Cuve couchée sur berceaux', tank: { r: 1.4, hex: 0xeaeae4 } },
  lu_conteneur: { world: 'lune', name: 'Conteneur de fret', w: 6, d: 3, desc: 'Portes ouvertes au bout', container: { hex: 0xd0d0c8 } },
  lu_solaire: { world: 'lune', name: 'Panneaux solaires', w: 8, d: 6, desc: 'Rangées nord-sud tournées vers le Soleil (est)', solar: { tilt: 0.26 } },
});
/* Catalogue d'un monde (le désert ou la Lune). */
function owBuildingsOf(world) {
  const out = {};
  for (const id in OWBLD) if ((OWBLD[id].world || 'khamsin') === world) out[id] = OWBLD[id];
  return out;
}
const OWBLD_SIDES = ['n', 'e', 's', 'w'];
/* Cotes réglables de chaque genre de bâtiment (jeu 2.0.3) : largeur et profondeur en mètres entiers
   (avant rotation), hauteur des murs (h0 : celle du catalogue) ; h null : hauteur fixe. */
function owBldLimits(type) {
  const T = OWBLD[type];
  if (!T) return null;
  if (T.house) return { w: [3, 60], d: [3, 60], h: [2.2, 12], h0: T.house.h || 3.2 };
  if (T.tent) return { w: [3, 40], d: [3, 40], h: [1.8, 10], h0: T.tent.h };
  if (T.shelter) return { w: [2, 30], d: [2, 30], h: [2, 8], h0: T.shelter.h };
  if (T.container) return { w: [3, 40], d: [2, 6], h: null };
  if (T.tank) return { w: [3, 40], d: [2, 10], h: null };
  if (T.solar) return { w: [3, 60], d: [3, 60], h: null };
  if (T.sandbags) return { w: [2, 40], d: [1, 1], h: null };
  return { w: [T.w, T.w], d: [T.d, T.d], h: null };
}
/* Recopie dans o les cotes de b qui diffèrent du catalogue (w, d : mètres entiers ; h : 0,1 m près). */
function owBldDims(o, b, type = o.type) {
  const T = OWBLD[type], L = owBldLimits(type);
  if (!T || !L || !b) return o;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  if (ok(b.w)) { const w = Math.round(clamp(b.w, L.w[0], L.w[1])); if (w !== T.w) o.w = w; }
  if (ok(b.d)) { const d = Math.round(clamp(b.d, L.d[0], L.d[1])); if (d !== T.d) o.d = d; }
  if (L.h && ok(b.h)) { const h = Math.round(clamp(b.h, L.h[0], L.h[1]) * 10) / 10; if (Math.abs(h - L.h0) > 0.05) o.h = h; }
  return o;
}
/* Cotes d'un bâtiment posé : [largeur, profondeur] avant rotation, hauteur des murs (ou null). */
function owBldSize(b) {
  const T = OWBLD[b.type], L = owBldLimits(b.type);
  return [b.w || T.w, b.d || T.d, L && L.h ? b.h || L.h0 : null];
}
/* Ouvertures d'une maison du catalogue portées à d'autres cotes (W × D, murs de H) : chaque ouverture
   garde sa place relative le long de son côté et sa largeur (réduite si le côté est trop court) ;
   portes et fenêtres restent sous le haut des murs. Les portes d'abord ; une ouverture qui en
   chevaucherait une autre sur le même côté (côté devenu trop court) est retirée. { doors, wins } */
function owBldOpenings(house, T, W, D, H) {
  const taken = { n: [], e: [], s: [], w: [] };
  const place = (list) => {
    const out = [];
    for (const op of list || []) {
      const [side, s, w, ...rest] = op, along = side === 'n' || side === 's';
      const L0 = along ? T.w : T.d, L1 = along ? W : D, w1 = Math.min(w, L1 - 2);
      if (w1 < 0.8) continue;
      const rel = L0 - w > 0.01 ? s / (L0 - w) : 0.5;
      const s1 = L1 - w1 - 1 > 1 ? clamp(Math.round(rel * (L1 - w1) * 10) / 10, 1, L1 - w1 - 1) : (L1 - w1) / 2;
      if ((taken[side] || []).some(([a, b]) => s1 < b + 0.3 && s1 + w1 > a - 0.3)) continue;
      const r = rest.slice();
      if (r.length >= 2) { r[1] = Math.min(r[1], H - 0.3); if (r[1] - r[0] < 0.4) continue; }
      else if (r.length === 1 || H < 2.6) r[0] = Math.min(r.length ? r[0] : 2.3, H - 0.3);
      if (taken[side]) taken[side].push([s1, s1 + w1]);
      out.push([side, s1, w1, ...r]);
    }
    return out;
  };
  const doors = place(house.doors);
  return { doors, wins: place(house.wins) };
}
/* Emprise d'un bâtiment (mètres entiers) : { x0, z0, x1, z1, w, d } après rotation. */
function owBldRect(b) {
  const T = OWBLD[b.type];
  if (!T) return null;
  const W0 = b.w || T.w, D0 = b.d || T.d;                // jeu 2.0.3 : cotes de ce bâtiment
  const q = ((b.rot | 0) % 4 + 4) % 4, w = q % 2 ? D0 : W0, d = q % 2 ? W0 : D0;
  const x0 = Math.round(b.x - w / 2), z0 = Math.round(b.z - d / 2);
  return { x0, z0, x1: x0 + w, z1: z0 + d, w, d, q };
}
/* Une ouverture [côté, début, largeur, …] tournée d'un quart de tour (D : profondeur avant le tour). */
function owBldTurnOpening(op, D) {
  const [side, s, w] = op, rest = op.slice(3);
  if (side === 'n') return ['e', s, w, ...rest];
  if (side === 'e') return ['s', D - s - w, w, ...rest];
  if (side === 's') return ['w', s, w, ...rest];
  return ['n', D - s - w, w, ...rest];
}
const owBldTurnSide = (side, q) => OWBLD_SIDES[(OWBLD_SIDES.indexOf(side) + q) % 4];
/* Hauteur du sol d'un bâtiment : celle de la carte, sinon la moyenne du terrain sous lui. */
function owBldY(b, R = owBldRect(b)) {
  if (typeof b.y === 'number' && Number.isFinite(b.y)) return b.y;
  return R ? owPadY(R.x0, R.z0, R.x1, R.z1) : 0;
}
/* Construit les bâtiments de la carte (cases dans le journal B, un groupe par bâtiment). */
function owBuildBuildings(root, map) {
  (map.buildings || []).forEach((b, i) => {
    const T = OWBLD[b.type], R = owBldRect(b);
    if (!T || !R) return;
    const y = owBldY(b, R);
    const K = owKit(`bâtiment ${i + 1}`);
    const [W0, D0, H0] = owBldSize(b);
    if (T.house) {
      // cotes de ce bâtiment (jeu 2.0.3) : ouvertures replacées, puis tournées avec lui
      const resized = W0 !== T.w || D0 !== T.d || Math.abs(H0 - (T.house.h || 3.2)) > 0.05;
      const ops = resized ? owBldOpenings(T.house, T, W0, D0, H0) : { doors: T.house.doors || [], wins: T.house.wins || [] };
      let doors = ops.doors, wins = ops.wins, D = D0;
      for (let k = 0; k < R.q; k++) {
        doors = doors.map((op) => owBldTurnOpening(op, D));
        wins = wins.map((op) => owBldTurnOpening(op, D));
        D = D === D0 ? W0 : D0;
      }
      owHouse(K, { ...T.house, h: H0, x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1, y, doors, wins });
    } else if (T.tent) {
      owTent(K, R.x0, R.z0, R.x1, R.z1, y, H0, T.tent.wallH * (H0 / T.tent.h), owBldTurnSide('s', R.q), T.tent.hex);
    } else if (T.container) {
      owContainer(K, R.x0, R.z0, R.x1, R.z1, y, T.container.hex, '', R.q >= 2 ? 1 : 0);
    } else if (T.tank) {
      owTank(K, (R.x0 + R.x1) / 2, y, (R.z0 + R.z1) / 2, T.tank.r * (D0 / T.d), Math.max(R.w, R.d) - 0.4, R.w >= R.d, T.tank.hex);
    } else if (T.shelter) {
      const h = H0;
      for (const [px, pz] of [[R.x0 + 0.2, R.z0 + 0.2], [R.x1 - 0.35, R.z0 + 0.2], [R.x0 + 0.2, R.z1 - 0.35], [R.x1 - 0.35, R.z1 - 0.35]]) K.box('kh_planks', 0x6b4a30, px, y, pz, px + 0.15, y + h, pz + 0.15);
      K.box('kh_sheet', 0xffffff, R.x0 - 0.3, y + h, R.z0 - 0.3, R.x1 + 0.3, y + h + 0.12, R.z1 + 0.3);
      K.box('kh_concrete', 0xd8d0c0, R.x0, y - 0.25, R.z0, R.x1, y + 0.05, R.z1, { skip: ['bottom'] });
      K.solid(R.x0, R.z0, R.x1, R.z1, OWK.FLOOR, { base: y + 0.05, ceil: y + h, roof: y + h + 0.12, mat: OWM.STONE });
    } else if (T.solar) {
      // rangées nord-sud (tous les 3 m), panneaux de 2 m tournés vers l'est et levés de 15° : le Soleil rasant
      const n = Math.max(1, Math.floor(R.w / 3)), len = R.d - 0.6;
      for (let r = 0; r < n; r++) {
        const cx = R.x0 + ((r + 0.5) * R.w) / n, cz = (R.z0 + R.z1) / 2;
        K.geo('lu_solar', 0xffffff, new THREE.BoxGeometry(0.06, 2.0, len), mtx(cx, y + 1.45, cz, 0, 0, T.solar.tilt));
        for (let p = R.z0 + 0.6; p <= R.z1 - 0.5; p += 2.4) K.box('lu_metal', 0x8a8e92, cx - 0.06, y, p - 0.06, cx + 0.06, y + 1.2, p + 0.06);
        K.box('lu_metal', 0x8a8e92, cx - 0.05, y + 1.15, R.z0 + 0.3, cx + 0.05, y + 1.25, R.z1 - 0.3);
        K.solid(cx - 0.6, R.z0 + 0.3, cx + 0.6, R.z1 - 0.3, OWK.LOW, { base: y, top: y + 2.4, mat: OWM.METAL });
      }
    } else if (T.sandbags) {
      if (R.w >= R.d) owSandbags(K, R.x0, (R.z0 + R.z1) / 2, R.x1, (R.z0 + R.z1) / 2, y, T.sandbags.rows);
      else owSandbags(K, (R.x0 + R.x1) / 2, R.z0, (R.x0 + R.x1) / 2, R.z1, y, T.sandbags.rows);
    }
    const g = K.build(root);
    g.userData.at = [b.x, y, b.z];
    owTagEl(g, 'building', i);
  });
}
/* Terrain aplani sous les bâtiments (avant les morceaux du terrain) : rect, la zone à refaire. */
function owBldPads(map, rect, mask) {
  for (const b of map.buildings || []) {
    const R = owBldRect(b);
    if (!R) continue;
    if (rect && (R.x1 + 8 < rect[0] || R.x0 - 8 > rect[2] || R.z1 + 8 < rect[1] || R.z0 - 8 > rect[3])) continue;
    const y = owBldY(b, R);
    owLevelMasked(R.x0 - 1, R.z0 - 1, R.x1 + 1, R.z1 + 1, y - 0.08, 6, mask);
  }
}
/* owLevel, sans toucher aux points protégés (mask : 0 protégé, 255 libre). */
function owLevelMasked(x0, z0, x1, z1, y, blend, mask) {
  const H = OW.H;
  owEachPoint(x0 - blend, z0 - blend, x1 + blend, z1 + blend, (k, x, z) => {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz);
    let w = 1 - owSmoothstep(0, blend, d);
    if (mask) w *= mask[k] / 255;
    if (w > 0) H[k] = lerp(H[k], y, w);
  });
}
