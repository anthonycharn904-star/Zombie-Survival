'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes (Khamsin) : noyau
   Une carte ouverte garde le monde de sa base (relief, routes, lieux, sanctuaire,
   quête : dans le code du jeu 2.0.0) et porte ce que l'auteur change : départ,
   armes au mur, atouts, emplacements de la boîte mystère, véhicules, jerricans,
   disjoncteurs, objets de la bibliothèque, règles. Le moteur expose ZS.ow
   (interface 3) : monde sans partie, place d'un élément, plan, vérification.
   Ce fichier : éléments (liste, création, déplacement, rotation, suppression),
   sélection, fichier enregistré ; décor des lieux de la base (jeu 2.0.3,
   interface 6 : tentes, caisses, lampadaires, maisons… retouchés par la carte ;
   interface 7 : chaque surface, les matières, plus de pièce fixe).
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp, round, deep, rad, wrapRad } = MT.util;
  const S = MT.state;
  const O = (MT.ow = MT.ow || {});

  /* Le moteur sait-il ouvrir les cartes ouvertes ? (jeu 2.0.0, interface 3) */
  O.ok = () => (ZS.editorApi || 1) >= 3 && !!ZS.ow && typeof ZS.openNormalize === 'function';
  /* Monde d'une carte ouverte : « khamsin » (le désert) ou « lune » (Ombre éternelle, Lune vierge ;
     interface 4 du moteur, jeu 2.0.0 du 9 octobre au soir). */
  O.world = (m = S.map) => {
    const B = m && ZS.ow && ZS.ow.BASES ? ZS.ow.BASES[m.base] : null;
    return B && B.world ? B.world : 'khamsin';
  };
  O.moon = (m = S.map) => O.world(m) === 'lune';
  O.okMoon = () => (ZS.editorApi || 1) >= 4 && !!ZS.ow && !!ZS.ow.BASES && !!ZS.ow.BASES.lune;
  /* Décor des lieux de la base sélectionnable et retouchable (jeu 2.0.3, interface 6). */
  O.placeOk = () => (ZS.editorApi || 1) >= 6 && !!ZS.ow && typeof ZS.ow.placeItems === 'function';

  /* --------------------------------------------------------- éléments -- */
  O.KINDS = ['spawn', 'wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'oxy', 'glas', 'loc'];
  O.LABEL = { spawn: 'Départ du joueur', wallbuy: 'Arme au mur', perk: 'Atout', box: 'Boîte mystère', vehicle: 'Véhicule', fuel: 'Jerricans', breaker: 'Disjoncteur', oxy: 'Poste d’oxygène', glas: 'Le Glas', prop: 'Objet', loc: 'Lieu nommé', road: 'Route', building: 'Bâtiment', place: 'Décor de la base' };
  O.PLURAL = { wallbuy: 'Armes au mur', perk: 'Atouts', box: 'Emplacements de la boîte', vehicle: 'Véhicules', fuel: 'Jerricans', breaker: 'Disjoncteurs', oxy: 'Postes d’oxygène', glas: 'Le Glas', prop: 'Objets', loc: 'Lieux nommés', road: 'Routes et pistes', building: 'Bâtiments', place: 'Décor de la base' };
  O.LIST = { wallbuy: 'wallbuys', perk: 'perks', box: 'boxes', vehicle: 'vehicles', fuel: 'fuel', breaker: 'breakers', oxy: 'oxy', prop: 'props', loc: 'locs', road: 'roads', building: 'buildings' };
  O.COLOR = { spawn: '#2fa84a', wallbuy: '#f0ecdc', perk: '#b3231f', box: '#2f6fc8', vehicle: '#8d9a52', fuel: '#e07a24', breaker: '#e8c22a', oxy: '#5fd8a8', glas: '#d9a441', prop: '#a5804c', loc: '#ffe7b0', road: '#3a3430', building: '#c8b08a', place: '#d6b46a' };
  /* Niveau 2 (relief, sol, routes, bâtiments, lieux) : demande le moteur du jeu 2.0.0 complet. */
  O.ok2 = () => O.ok() && typeof ZS.ow.sculpt === 'function';
  /* Ce qui change le terrain (routes, bâtiments) : la zone à refaire. */
  O.terrainRect = (kind, e) => {
    if (!e) return null;
    if (kind === 'road') return ZS.ow.modsRect({ roads: [e] });
    if (kind === 'building') { const R = ZS.ow.bldRect(e); return R ? [R.x0 - 10, R.z0 - 10, R.x1 + 10, R.z1 + 10] : null; }
    return null;
  };
  const unionR = (a, b) => (a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : a || b);
  O.unionRect = unionR;
  O.HELP = {
    spawn: 'Clic sur le sol : le joueur commence ici. R : tourner son regard.',
    wallbuy: 'Clic près d’un mur : l’arme se dessine à la craie sur la face visible du mur, avec du sol devant.',
    perk: 'Clic près d’un mur : la machine se pose dos au mur. Loin d’un mur : posée sur le sol, face selon la rotation (R).',
    box: 'Clic sur le sol : un emplacement de la boîte mystère (deux cases, du sol devant). Elle voyage d’un emplacement à l’autre. R : sens.',
    vehicle: 'Clic sur le terrain : un véhicule (pas dans l’eau, pas sur une pente trop forte). R : +15°, Maj+R : +90°.',
    fuel: 'Clic sur le sol : une pile de jerricans (plein du véhicule le plus proche, à moins de 14 m).',
    breaker: 'Clic près d’un mur : une armoire électrique. Tous les disjoncteurs enclenchés : le courant revient.',
    loc: 'Clic : un lieu nommé (cercle). Son nom s’affiche en entrant dedans et sur la mini-carte du joueur.',
    oxy: 'Clic près d’un mur : un râtelier de bouteilles, dos au mur. Loin d’un mur : posé sur le sol, face selon la rotation (R). Une bouteille neuve (4 min d’oxygène) pour 250 points.',
    glas: 'Clic sur un sol plat et libre de 5 × 5 m : la cloche (une seule par carte ; poser ailleurs la déplace). R : sens. Elle se réveille avec le courant.',
  };
  O.arr = (kind, m = S.map) => (m && O.LIST[kind] ? m[O.LIST[kind]] : null);
  O.limit = (kind) => (ZS.OPEN_LIMITS && O.LIST[kind] ? ZS.OPEN_LIMITS[O.LIST[kind]] : Infinity);
  O.get = (sel, m = S.map) => {
    if (!sel || !m) return null;
    if (sel.kind === 'spawn') return m.spawn;
    if (sel.kind === 'place') return O.placeView(sel.i, m);
    if (sel.kind === 'glas') return m.glas || null;
    const a = O.arr(sel.kind, m);
    return a ? a[sel.i] || null : null;
  };
  /* Position (x, z) d'un élément. */
  O.posOf = (kind, e) => {
    if (kind === 'spawn') return [e.pos[0], e.pos[1]];
    if (kind === 'road') { const p = e.pts[Math.floor(e.pts.length / 2)]; return [p[0], p[1]]; }
    return [e.x, e.z];
  };
  /* Sens (vers le joueur) d'un élément : [fx, fz] ; null pour un véhicule (lacet). */
  O.faceOf = (kind, e) => {
    if (kind === 'wallbuy' || kind === 'breaker') return [e.nx, e.nz];
    if (kind === 'perk' || kind === 'box' || kind === 'oxy' || kind === 'glas') return e.face;
    if (kind === 'spawn') return [-Math.sin(e.yaw), -Math.cos(e.yaw)];
    return null;
  };
  O.weaponName = (id) => (ZS.WEAPONS[id] ? ZS.WEAPONS[id].name : id);
  O.perkName = (id) => (ZS.PERKS[id] ? ZS.PERKS[id].name : id);
  O.vehName = (t) => (ZS.VEH_TYPES[t] ? ZS.VEH_TYPES[t].name : t);
  /* Titre court d'un élément (listes, plan, problèmes). */
  O.title = (kind, e, i) => {
    switch (kind) {
      case 'wallbuy': return O.weaponName(e.w);
      case 'perk': return O.perkName(e.p);
      case 'box': return `Boîte n° ${i + 1}${S.map && S.map.boxStart === i ? ' (départ)' : ''}`;
      case 'vehicle': return O.vehName(e.type);
      case 'fuel': return `Jerricans n° ${i + 1}`;
      case 'breaker': return `Disjoncteur ${i + 1} · ${e.name}`;
      case 'spawn': return 'Départ du joueur';
      case 'loc': return e.name;
      case 'oxy': return `Poste d’oxygène n° ${i + 1}`;
      case 'glas': return 'Le Glas';
      case 'road': return `${e.kind === 'road' ? 'Route' : 'Piste'} n° ${i + 1}`;
      case 'building': return (ZS.ow.BUILDINGS[e.type] || { name: e.type }).name;
      case 'place': return e.name;
      default: return '';
    }
  };
  /* Lieux de la base (les sept de Khamsin ; aucun pour le désert vierge), puis ceux de la carte. */
  O.baseLocs = () => {
    try { return O.ok2() && ZS.ow.namedLocs ? ZS.ow.namedLocs().filter((L) => !L.user) : ZS.ow.locs(); } catch (e) { return []; }
  };
  O.allLocs = (m = S.map) => O.baseLocs().concat(((m && m.locs) || []).map((L) => ({ name: L.name, x: L.x, z: L.z, r: L.r, user: true })));
  /* Lieu le plus proche (« Camp de fouilles », « à 120 m de l’Oasis de Sekhet »), ou rien. */
  O.where = (x, z) => {
    if (!ZS.ow || !ZS.ow.on) return '';
    let best = null, bd = Infinity;
    for (const L of O.allLocs()) { const d = Math.hypot(x - L.x, z - L.z) - L.r; if (d < bd) { bd = d; best = L; } }
    if (!best) return '';
    return bd <= 0 ? best.name : `à ${Math.round(bd)} m · ${best.name}`;
  };

  /* Options de l'outil Éléments (genre, arme, atout, véhicule, sens). */
  S.opts.ow = { kind: 'wallbuy', weapon: 'mp40', perk: 'souffle', vehicle: 'jeep', face: [0, 1], yaw: 0 };
  const FACES = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  O.turnFace = (f, dir = 1) => {
    const cur = Math.max(0, FACES.findIndex((d) => d[0] === f[0] && d[1] === f[1]));
    return FACES[(cur + (dir > 0 ? 1 : 3)) % 4].slice();
  };

  /* Place proposée par le moteur pour un genre d'élément en (x, z). */
  O.place = (kind, x, z, face, size = 1) => {
    if (!ZS.ow || !ZS.ow.on) return { ok: false, why: 'Monde pas encore chargé.' };
    if (kind === 'loc') { const ok = x > 0 && z > 0 && x < S.map.w && z < S.map.h; return { ok, x: round(x, 1), z: round(z, 1), why: ok ? '' : 'Hors de la carte.' }; }
    const k = kind === 'spawn' ? 'spawn' : kind;
    return ZS.ow.place(k, x, z, { face: face || S.opts.ow.face, k: size });   // k : taille (jeu 2.0.3)
  };
  /* Cotes d'un bâtiment (w, d, h) quand elles diffèrent du catalogue (jeu 2.0.3). */
  O.bldDims = (b) => { const o = {}; for (const k of ['w', 'd', 'h']) if (b && typeof b[k] === 'number') o[k] = b[k]; return o; };
  /* Nouvel élément d'après une place (r : résultat de O.place). */
  O.make = (kind, r, m = S.map) => {
    const o = S.opts.ow;
    switch (kind) {
      case 'wallbuy': return { w: o.weapon, x: r.x, y: r.y, z: r.z, nx: r.nx, nz: r.nz, h: 1.6 };
      case 'perk': return { p: o.perk, x: r.x, y: r.y, z: r.z, face: (r.face || o.face).slice() };
      case 'box': return { x: r.x, y: r.y, z: r.z, face: (r.face || o.face).slice() };
      case 'vehicle': return { type: o.vehicle, x: r.x, z: r.z, yaw: round(o.yaw, 4) };
      case 'fuel': return { x: r.x, y: r.y, z: r.z };
      case 'breaker': {
        const f = r.face || o.face;
        return { x: r.x, y: r.y, z: r.z, nx: f[0], nz: f[1], name: `disjoncteur ${(m.breakers || []).length + 1}` };
      }
      case 'loc': return { name: `Lieu ${(m.locs || []).length + 1}`, x: r.x, z: r.z, r: 120 };
      case 'oxy': case 'glas': return { x: r.x, y: r.y, z: r.z, face: (r.face || o.face).slice() };
      default: return null;
    }
  };
  /* Pose un élément du genre choisi en (x, z). Renvoie la sélection, ou null (raison en toast). */
  O.add = (kind, x, z) => {
    const m = S.map;
    if (!m) return null;
    const r = O.place(kind, x, z);
    if (!r.ok) { MT.toast(r.why || 'Impossible ici.', 'warn'); return null; }
    if (kind === 'spawn') {
      MT.edit('Départ du joueur', (mm) => { mm.spawn.pos = [r.x, r.z]; }, 'ow-el');
      MT.select({ kind: 'spawn' });
      return S.sel;
    }
    if (kind === 'glas') {
      // une seule cloche : poser ailleurs la déplace
      const had = !!m.glas, e = O.make('glas', r);
      if (had && m.glas.k) e.k = m.glas.k;
      MT.edit(had ? 'Déplacer : Le Glas' : 'Poser : Le Glas', (mm) => { mm.glas = e; }, 'ow-el');
      if (had) MT.toast('Le Glas déplacé : une seule cloche par carte.', 'info');
      MT.select({ kind: 'glas' });
      return S.sel;
    }
    const arr = O.arr(kind);
    if (arr.length >= O.limit(kind)) { MT.toast(`${O.PLURAL[kind]} : ${O.limit(kind)} au plus.`, 'warn'); return null; }
    if (kind === 'perk' && arr.some((p) => p.p === S.opts.ow.perk)) MT.toast(`${O.perkName(S.opts.ow.perk)} est déjà sur la carte : une machine suffit.`, 'warn');
    const e = O.make(kind, r);
    let idx = -1;
    MT.edit(`Poser : ${O.LABEL[kind].toLowerCase()}`, (mm) => { O.arr(kind, mm).push(e); idx = O.arr(kind, mm).length - 1; }, 'ow-el');
    MT.select({ kind, i: idx });
    return S.sel;
  };
  /* Retire l'élément (kind, i). */
  O.remove = (kind, i) => {
    const m = S.map;
    if (!m || kind === 'spawn') return false;
    if (kind === 'place') {
      const d = O.placeDesc()[i];
      if (!d) return false;
      const ok = O.placeEdit(i, `Retirer : ${d.name.toLowerCase()}`, (e) => { e.hide = true; }, { follow: false });
      if (ok && S.sel && S.sel.kind === 'place') MT.select(null);
      return !!ok;
    }
    if (kind === 'glas') {
      if (!m.glas) return false;
      MT.edit('Retirer : Le Glas', (mm) => { mm.glas = null; }, 'ow-el');
      if (S.sel && S.sel.kind === 'glas') MT.select(null);
      return true;
    }
    const arr = O.arr(kind);
    if (!arr || !arr[i]) return false;
    const rect = O.terrainRect(kind, arr[i]);
    MT.edit(`Retirer : ${O.LABEL[kind].toLowerCase()}`, (mm) => {
      O.arr(kind, mm).splice(i, 1);
      if (kind === 'box') mm.boxStart = clamp(mm.boxStart > i ? mm.boxStart - 1 : mm.boxStart, 0, Math.max(0, mm.boxes.length - 1));
    }, kind === 'prop' ? 'props' : rect ? 'ow-terrain' : kind === 'loc' ? 'settings' : 'ow-el', rect ? { rect } : null);
    if (S.sel && S.sel.kind === kind) MT.select(null);
    return true;
  };

  /* Déplace l'élément sel vers (x, z) : le moteur le recale (mur, sol). live : pendant un glisser
     (seul l'objet 3D suit ; les cases suivent au relâcher). fol : décor de la base, ce qui le suit
     (O.placeFollowPlan, relevé au début du glisser). Renvoie { ok, why }. */
  O.moveTo = (sel, x, z, live = false, fol = undefined) => {
    const m = S.map, e = O.get(sel);
    if (!e) return { ok: false };
    const kind = sel.kind;
    if (kind === 'building') {
      const before = O.terrainRect('building', e);
      const r = ZS.ow.buildingPlace(e.type, x, z, e.rot, O.bldDims(e));
      if (!r.ok) return r;
      if (r.b.x === e.x && r.b.z === e.z) return r;
      Object.assign(e, { x: r.b.x, z: r.b.z, y: r.b.y });
      if (live) MT.touch('ow-live', { kind, i: sel.i, live });
      else MT.touch('ow-terrain', { rect: unionR(before, O.terrainRect('building', e)) });
      return r;
    }
    if (kind === 'loc') { e.x = round(clamp(x, 0, m.w), 1); e.z = round(clamp(z, 0, m.h), 1); MT.touch('settings', { kind, i: sel.i, live }); return { ok: true }; }
    if (kind === 'place') {
      // pièce du décor : sa retouche s'écrit dans le repère d'origine de ce qui la porte (tente, maison…)
      if (e.locked) return { ok: false, why: `Fixe : ${e.locked}` };
      // les éléments de jeu posés dedans suivent (depuis leur place d'avant le geste)
      const plan = fol !== undefined ? fol : O.placeFollowPlan([sel.i], S.pending ? S.pending.before : m);
      const [lx, lz] = ZS.ow.placeLocal(sel.i, clamp(x, 1, m.w - 1), clamp(z, 1, m.h - 1), m);
      const E = m.placeEdits || (m.placeEdits = {}), ne = { ...deep(E[e.id] || {}), x: round(lx, 3), z: round(lz, 3) };
      O.placeClean(ne, e);
      if (Object.keys(ne).length) E[e.id] = ne; else delete E[e.id];
      for (const P of plan || []) { const B = O.placeMatrix(P.i, m); if (!B.hidden) O.placeFollowApply(m, P.fol, P.A, B.M); }
      MT.touch(live ? 'ow-live' : 'ow-el', { kind, i: sel.i, live });
      return { ok: true };
    }
    if (kind === 'road') return { ok: false };
    const face = kind === 'perk' || kind === 'box' || kind === 'oxy' || kind === 'glas' ? e.face : kind === 'breaker' ? [e.nx, e.nz] : null;
    const r = O.place(kind, x, z, face, e.k || 1);
    if (!r.ok) return r;
    switch (kind) {
      case 'spawn': m.spawn.pos = [r.x, r.z]; break;
      case 'wallbuy': Object.assign(e, { x: r.x, y: r.y, z: r.z, nx: r.nx, nz: r.nz }); break;
      case 'perk': Object.assign(e, { x: r.x, y: r.y, z: r.z, face: (r.face || e.face).slice() }); break;
      case 'breaker': { const f = r.face || [e.nx, e.nz]; Object.assign(e, { x: r.x, y: r.y, z: r.z, nx: f[0], nz: f[1] }); break; }
      case 'box': case 'fuel': Object.assign(e, { x: r.x, y: r.y, z: r.z }); break;
      case 'oxy': case 'glas': Object.assign(e, { x: r.x, y: r.y, z: r.z, face: (r.face || e.face).slice() }); break;
      case 'vehicle': Object.assign(e, { x: r.x, z: r.z }); break;
      default: return { ok: false };
    }
    MT.touch(live ? 'ow-live' : 'ow-el', { kind, i: sel.i, live });
    return r;
  };

  /* -------------------------------------------------------- sélection -- */
  O.fixSelection = () => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    let ok = true;
    if (s.kind === 'prop') { s.list = s.list.filter((i) => i < m.props.length); ok = s.list.length > 0; }
    else if (s.kind === 'place') { const e = O.get(s); ok = !!e && !e.hidden; }
    else if (s.kind !== 'spawn') ok = !!O.get(s);
    if (!ok) { S.sel = null; MT.emit('selection'); }
  };
  O.deleteSelection = () => {
    const s = S.sel;
    if (!s || s.kind === 'spawn') return false;
    if (s.kind === 'prop') {
      const set = new Set(s.list);
      MT.edit('Supprimer', (m) => { m.props = m.props.filter((_, i) => !set.has(i)); }, 'props');
      MT.select(null);
      return true;
    }
    return O.remove(s.kind, s.i);
  };
  O.duplicateSelection = () => {
    const s = S.sel;
    if (!s) return false;
    if (s.kind === 'place') { MT.toast('Le décor de la base ne se duplique pas : « Remplacer par un objet… » (inspecteur), ou posez un objet de la bibliothèque (outil Objets) ou un bâtiment (outil Bâtiments).', 'info'); return false; }
    if (s.kind === 'prop') {
      return MT.edit('Dupliquer', (m) => {
        const start = m.props.length;
        for (const i of s.list) { const p = deep(m.props[i]); p.x = round(p.x + 1); p.z = round(p.z + 1); m.props.push(p); }
        S.sel = { kind: 'prop', list: s.list.map((_, k) => start + k) };
        MT.emit('selection');
      }, 'props');
    }
    if (s.kind === 'vehicle') {
      const v = O.get(s);
      if (!v || S.map.vehicles.length >= O.limit('vehicle')) return false;
      const r = O.place('vehicle', v.x + Math.cos(v.yaw) * 3.5, v.z - Math.sin(v.yaw) * 3.5);
      if (!r.ok) { MT.toast(r.why, 'warn'); return false; }
      MT.edit('Dupliquer', (m) => { m.vehicles.push({ ...deep(v), x: r.x, z: r.z }); S.sel = { kind: 'vehicle', i: m.vehicles.length - 1 }; }, 'ow-el');
      MT.emit('selection');
      return true;
    }
    return false;
  };

  /* Rotation : objets (pas de l'outil), atout, boîte, disjoncteur (quart de tour), véhicule et
     départ (15°, Maj : 90°). Sans sélection : le sens de l'élément à poser. */
  O.rotate = (dir = 1, big = false) => {
    const m = S.map, s = S.sel;
    if (!m) return;
    if (S.tool === 'props' && !(s && s.kind === 'prop' && MT.tools.drag)) {
      const step = big ? 90 : S.opts.props.rotStep;
      S.opts.props.rot = ((S.opts.props.rot + dir * step) % 360 + 360) % 360;
      MT.emit('tool-opts'); MT.emit('preview');
      return;
    }
    if (S.tool === 'elements' && !(s && s.kind !== 'prop')) {
      const o = S.opts.ow;
      if (o.kind === 'vehicle' || o.kind === 'spawn') o.yaw = round(wrapRad(o.yaw + rad(big ? 90 : 15) * dir), 4);
      else o.face = O.turnFace(o.face, dir);
      MT.emit('tool-opts'); MT.emit('preview');
      return;
    }
    if (!s) return;
    if (s.kind === 'prop') { MT.tools.rotateProps(dir, big); return; }
    const e = O.get(s);
    if (!e) return;
    if (s.kind === 'place') { O.placeEdit(s.i, 'Tourner', (x) => { x.r = (x.r || 0) + rad(big ? 90 : 15) * dir; }); return; }
    MT.edit('Tourner', (mm) => {
      const x = O.get(s, mm);
      if (s.kind === 'perk' || s.kind === 'box' || s.kind === 'oxy' || s.kind === 'glas') x.face = O.turnFace(x.face, dir);
      else if (s.kind === 'breaker') { const f = O.turnFace([x.nx, x.nz], dir); x.nx = f[0]; x.nz = f[1]; }
      else if (s.kind === 'vehicle') x.yaw = round(wrapRad(x.yaw + rad(big ? 90 : 15) * dir), 4);
      else if (s.kind === 'spawn') x.yaw = round(wrapRad(x.yaw + rad(big ? 90 : 15) * dir), 4);
      else if (s.kind === 'building') {
        const before = O.terrainRect('building', x);
        const r = ZS.ow.buildingPlace(x.type, x.x, x.z, (x.rot + (dir > 0 ? 1 : 3)) % 4, O.bldDims(x));
        if (!r.ok) { MT.toast(r.why, 'warn'); return false; }
        Object.assign(x, { x: r.b.x, z: r.b.z, rot: r.b.rot, y: r.b.y });
        S.owRect = unionR(before, O.terrainRect('building', x));
      } else return false;
      return true;
    }, s.kind === 'building' ? 'ow-terrain' : 'ow-el', s.kind === 'building' ? { get rect() { return S.owRect; } } : null);
  };
  /* Flèches : objets (pas de la grille), éléments (le moteur les recale). */
  O.nudge = (dx, dz, fine) => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    const step = fine ? 0.05 : S.opts.props.snap || 0.25;
    if (s.kind === 'prop') {
      MT.edit('Déplacer', () => { for (const i of s.list) { m.props[i].x = round(m.props[i].x + dx * step); m.props[i].z = round(m.props[i].z + dz * step); } }, 'prop-move', { list: s.list });
      return;
    }
    const e = O.get(s);
    if (!e) return;
    const [x, z] = O.posOf(s.kind, e);
    MT.begin('Déplacer');
    const r = O.moveTo(s, x + dx * Math.max(step, 0.25), z + dz * Math.max(step, 0.25));
    MT.commit();
    if (!r.ok && r.why) MT.toast(r.why, 'warn');
  };
  O.raise = (dy) => {
    const s = S.sel, m = S.map;
    if (s && m && s.kind === 'place') { O.placeEdit(s.i, 'Hauteur', (x) => { x.dy = round(clamp((x.dy || 0) + dy, -60, 200), 3); }); return; }
    if (!s || !m || s.kind !== 'prop') return;
    MT.edit('Hauteur', () => { for (const i of s.list) { const p = m.props[i]; p.y = round(clamp((p.y || 0) + dy, -20, 60)); if (!p.y) delete p.y; } }, 'prop-move', { list: s.list });
  };

  /* ------------------------------------------- décor des lieux (jeu 2.0.3) --
     Interface 6 du moteur : les pièces des lieux de la base (tentes, caisses, lampadaires, maisons,
     modules de la base lunaire…). Interface 7 : leurs surfaces aussi (un mur, un toit, une poutre, une
     face…), chacune sélectionnable et retouchable seule ; les matières (texture, teinte, image
     importée) ; plus de pièce fixe : ce qui en dépend dans le jeu suit. La carte porte les retouches,
     placeEdits : { id: { x, z, dy, r, s, hide, m } } (place du pied, hauteur ajoutée, rotation, taille,
     retirée, matières { texture: { t, c } }). Nœuds : les pièces (0 … n − 1), puis les surfaces. Ce
     qui est posé dans une pièce la suit ; sa retouche s'écrit dans le repère d'origine de ce qui la
     porte. Les éléments de jeu posés dedans (armes au mur, atouts, boîtes, départ, objets…) suivent
     aussi. Sélection : { kind: 'place', i } (indice du nœud). */
  S.opts.ow.placePick = true;
  S.opts.ow.placeLevel = 'piece';             // ce qu'un clic sur le décor sélectionne
  const PC = { st: null, rev: -1, map: null, root: null };
  O.placeDesc = () => (O.placeOk() && ZS.ow.on ? ZS.ow.placeItems() : []);
  /* Surfaces, matières, pièces libres (jeu 2.0.3, interface 7). */
  O.surfOk = () => O.placeOk() && (ZS.editorApi || 1) >= 7 && typeof ZS.ow.placeHit === 'function' && typeof ZS.ow.placeMatrices === 'function';
  O.PLACE_LEVELS = [
    ['surface', 'Surface', 'Un clic sélectionne une surface : un mur, un toit, une poutre, une face…'],
    ['piece', 'Pièce', 'Un clic sélectionne une pièce : une tente, une caisse, une maison, un module…'],
    ['construction', 'Construction', 'Un clic sélectionne la construction entière : la pièce et tout ce qu’elle porte (la base, une tente et ses tables…)'],
  ];
  O.placeLevel = () => (O.surfOk() ? S.opts.ow.placeLevel : 'piece');
  /* Nœud du niveau demandé qui contient le nœud i (une surface → sa pièce → la construction). */
  O.placeLift = (i, level = O.placeLevel()) => {
    const D = O.placeDesc();
    let k = i;
    if (!D[k]) return -1;
    if (level === 'surface') return k;
    if (D[k].surf) k = D[k].parent;
    if (level === 'construction') while (D[k] && D[k].parent >= 0) k = D[k].parent;
    return D[k] ? k : -1;
  };
  /* Ce qui porte le nœud i, de la construction jusqu'à lui. */
  O.placeChain = (i) => { const D = O.placeDesc(), out = []; for (let k = i; k >= 0 && D[k] && out.length < 32; k = D[k].parent) out.unshift(k); return out; };
  /* Pose de chaque nœud d'après la carte (pied, lacet, facteurs, empreinte au sol, retiré…). */
  O.placeState = (m = S.map) => {
    if (!O.placeOk() || !ZS.ow.on || !m) return [];
    if (m === S.map && PC.st && PC.rev === S.rev && PC.map === m && PC.root === ZS.ow.placeRoot && PC.st.length === O.placeDesc().length) return PC.st;
    const st = ZS.ow.placeState(m);
    if (m === S.map) { PC.st = st; PC.rev = S.rev; PC.map = m; PC.root = ZS.ow.placeRoot; }
    return st;
  };
  /* Vue d'un nœud : identité (x, y, z d'origine dans ax, ay, az), pose actuelle, retouche. */
  O.placeView = (i, m = S.map) => {
    const d = O.placeDesc()[i];
    if (!d) return null;
    const st = O.placeState(m)[i] || {};
    return { ...d, ...st, ax: d.x, ay: d.y, az: d.z, edit: (m && m.placeEdits && m.placeEdits[d.id]) || null };
  };
  /* Retouche nettoyée : rien de ce qui vaut l'origine (place, hauteur, rotation, taille, matières vides). */
  O.placeClean = (e, d) => {
    const ox = d.ax !== undefined ? d.ax : d.x, oz = d.az !== undefined ? d.az : d.z;      // pied d'origine (vue ou liste du moteur)
    if (e.x === undefined || e.z === undefined || (Math.abs(e.x - ox) < 1e-3 && Math.abs(e.z - oz) < 1e-3)) { delete e.x; delete e.z; }
    if (e.dy !== undefined && !(Math.abs(e.dy) >= 1e-3)) delete e.dy;
    if (e.r !== undefined) { e.r = round(wrapRad(e.r), 4); if (Math.abs(e.r) < 1e-4) delete e.r; }
    if (e.s !== undefined) { const s = ZS.normPropScale ? ZS.normPropScale(e.s) : e.s; if (s === undefined) delete e.s; else e.s = s; }
    if (e.hide !== true) delete e.hide;
    // interface 8 : prix d'une porte payante (herse d'une pyramide) ; celui d'origine ne s'écrit pas
    if (e.cost !== undefined) {
      const c = Math.round(Number(e.cost));
      if (!Number.isFinite(c) || !d.door || c === d.door.cost) delete e.cost; else e.cost = clamp(c, 0, 1000000);
    }
    if (e.m !== undefined) {
      const mo = {};
      for (const [tex, q] of Object.entries(e.m && typeof e.m === 'object' ? e.m : {})) {
        if (!q || typeof q !== 'object') continue;
        const o = {};
        if (typeof q.t === 'string' && q.t !== tex) o.t = q.t;
        if (typeof q.c === 'number' && Number.isFinite(q.c)) o.c = Math.round(q.c) & 0xffffff;
        if (Object.keys(o).length) mo[tex] = o;
      }
      if (Object.keys(mo).length) e.m = mo; else delete e.m;
    }
    return e;
  };
  /* Matrice du nœud i d'après la carte m : { M (THREE.Matrix4 : repère d'origine → monde), hidden }. */
  O.placeMatrix = (i, m = S.map) => {
    const r = O.surfOk() ? ZS.ow.placeMatrices([i], m)[0] : null;
    return { M: r && r.M ? new THREE.Matrix4().fromArray(r.M) : new THREE.Matrix4(), hidden: !!(r && r.hidden) };
  };

  /* ---- Les éléments de jeu posés dans une pièce (ou contre une surface) la suivent (interface 7) :
     ceux dans son empreinte au sol (élargie de 1,2 m) et entre son pied et son sommet (1,5 m de plus). */
  const gy = (x, z) => { try { return ZS.ow.ground(x, z); } catch (e) { return 0; } };
  const FOLLOW = ['wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'oxy', 'prop'];
  /* Distance d'un point à une empreinte (quatre coins) : 0 dedans. */
  const quadDist = (f, x, z) => {
    let inside = false, d = Infinity;
    for (let a = 0, b = 3; a < 4; b = a++) {
      const [ax, az] = f[a], [bx, bz] = f[b];
      if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
      const ex = ax - bx, ez = az - bz, l2 = ex * ex + ez * ez || 1e-9, t = clamp(((x - bx) * ex + (z - bz) * ez) / l2, 0, 1);
      d = Math.min(d, Math.hypot(x - bx - ex * t, z - bz - ez * t));
    }
    return inside ? 0 : d;
  };
  const inQuad = (f, x, z, pad) => quadDist(f, x, z) <= pad;
  /* Éléments de la carte avec leur point (x, y, z) : [{ kind, i, x, y, z }]. */
  function followables(m) {
    const out = [{ kind: 'spawn', i: 0, x: m.spawn.pos[0], z: m.spawn.pos[1], y: gy(m.spawn.pos[0], m.spawn.pos[1]) }];
    for (const k of FOLLOW) (O.arr(k, m) || []).forEach((e, i) => {
      const y = k === 'prop' ? gy(e.x, e.z) + (e.y || 0) : Number.isFinite(e.y) ? e.y : gy(e.x, e.z);
      out.push({ kind: k, i, x: e.x, z: e.z, y });
    });
    if (m.glas) out.push({ kind: 'glas', i: 0, x: m.glas.x, z: m.glas.z, y: Number.isFinite(m.glas.y) ? m.glas.y : gy(m.glas.x, m.glas.z) });
    return out;
  }
  const elOf = (m, kind, i) => (kind === 'spawn' ? m.spawn : kind === 'glas' ? m.glas : (O.arr(kind, m) || [])[i]);
  /* Ce qui suit chacun des nœuds de nodes (chaque élément suit le plus petit qui le contient) :
     [{ i, A (matrice avant), fol: [{ kind, i, orig }] }]. m : la carte avant la retouche. */
  O.placeFollowPlan = (nodes, m = S.map) => {
    if (!O.surfOk() || !m || !nodes.length) return [];
    const st = O.placeState(m), D = O.placeDesc(), best = new Map();
    for (const n of nodes) {
      const q = st[n];
      if (!q || q.hidden || !q.foot || !D[n]) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of q.foot) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const area = (x1 - x0) * (z1 - z0);
      for (const F of followables(m)) {
        if (F.x < x0 - 1.2 || F.x > x1 + 1.2 || F.z < z0 - 1.2 || F.z > z1 + 1.2) continue;
        if (F.y < q.y0 - 1.5 || F.y > q.y1 + 1.5 || !inQuad(q.foot, F.x, F.z, 1.2)) continue;
        const key = `${F.kind}:${F.i}`, cur = best.get(key);
        if (!cur || area < cur.area) best.set(key, { n, area, F });
      }
    }
    const by = new Map();
    for (const { n, F } of best.values()) {
      if (!by.has(n)) by.set(n, []);
      by.get(n).push({ kind: F.kind, i: F.i, orig: deep(elOf(m, F.kind, F.i)) });
    }
    return [...by.entries()].map(([i, fol]) => ({ i, fol, A: O.placeMatrix(i, m).M }));
  };
  /* Les éléments fol suivent le passage de la matrice A à B (déplacés, tournés ; leur taille reste). */
  O.placeFollowApply = (mm, fol, A, B) => {
    if (!fol || !fol.length || !A || !B) return 0;
    const Dm = B.clone().multiply(A.clone().invert()), e = Dm.elements, yaw = Math.atan2(-e[2], e[0]);
    if (Dm.equals(new THREE.Matrix4())) return 0;
    const v = new THREE.Vector3();
    const pt = (x, y, z) => v.set(x, y, z).applyMatrix4(Dm);
    // sens d'un élément contre un mur : tourné, puis ramené au plus proche des quatre
    const dir = (fx, fz) => { const X = e[0] * fx + e[8] * fz, Z = e[2] * fx + e[10] * fz; return Math.abs(X) >= Math.abs(Z) ? [X < 0 ? -1 : 1, 0] : [0, Z < 0 ? -1 : 1]; };
    const W = mm.w || 4096, H = mm.h || 3072;
    const XZ = (x, p) => { x.x = round(clamp(p.x, 1, W - 1), 3); x.z = round(clamp(p.z, 1, H - 1), 3); };
    let n = 0;
    for (const F of fol) {
      const x = elOf(mm, F.kind, F.i), o = F.orig;
      if (!x || !o) continue;
      n++;
      switch (F.kind) {
        case 'spawn': { const p = pt(o.pos[0], gy(o.pos[0], o.pos[1]), o.pos[1]); x.pos = [round(clamp(p.x, 1, W - 1), 3), round(clamp(p.z, 1, H - 1), 3)]; x.yaw = round(wrapRad(o.yaw + yaw), 4); break; }
        case 'vehicle': { XZ(x, pt(o.x, gy(o.x, o.z), o.z)); x.yaw = round(wrapRad(o.yaw + yaw), 4); break; }
        case 'prop': {
          const p = pt(o.x, gy(o.x, o.z) + (o.y || 0), o.z);
          XZ(x, p);
          const dy = p.y - gy(x.x, x.z);
          if (Math.abs(dy) > 0.01) x.y = round(clamp(dy, -20, 60), 3); else delete x.y;
          const r = wrapRad((o.r || 0) + yaw);
          if (Math.abs(r) > 1e-4) x.r = round(r, 4); else delete x.r;
          break;
        }
        default: {
          const p = pt(o.x, Number.isFinite(o.y) ? o.y : gy(o.x, o.z), o.z);
          XZ(x, p);
          if (Number.isFinite(o.y)) x.y = round(p.y, 3);
          if (F.kind === 'wallbuy' || F.kind === 'breaker') { const [nx, nz] = dir(o.nx, o.nz); x.nx = nx; x.nz = nz; }
          else if (Array.isArray(o.face)) x.face = dir(o.face[0], o.face[1]);
          break;
        }
      }
    }
    return n;
  };
  /* Modifie la retouche du nœud i (fn(retouche, nœud) ; false : rien), en un geste annulable. Les
     éléments de jeu posés dedans suivent (follow : false pour une retouche qui ne bouge rien). */
  O.placeEdit = (i, label, fn, { follow = true } = {}) => {
    const d = O.placeDesc()[i];
    if (!d || !S.map) return false;
    if (d.locked) { MT.toast(`${d.name} reste à sa place : ${d.locked}`, 'warn'); return false; }
    // avant le geste (un champ qui suit la saisie a déjà retouché la carte : on part d'avant)
    const plan = follow ? O.placeFollowPlan([i], S.pending ? S.pending.before : S.map) : [];
    return MT.edit(label, (mm) => {
      const E = mm.placeEdits || (mm.placeEdits = {}), e = deep(E[d.id] || {});
      if (fn(e, d) === false) return false;
      O.placeClean(e, d);
      if (Object.keys(e).length) E[d.id] = e; else delete E[d.id];
      for (const P of plan) { const B = O.placeMatrix(P.i, mm); if (!B.hidden) O.placeFollowApply(mm, P.fol, P.A, B.M); }
      return true;
    }, 'ow-el', { kind: 'place', i });
  };
  /* Remet des nœuds à l'origine (sans retouche) : liste d'indices, ou tous (null) ; ce qui était posé
     dedans revient avec eux. */
  O.placeReset = (list = null, label = 'Décor d’origine') => {
    const D = O.placeDesc(), m = S.map, E = (m && m.placeEdits) || {};
    const ids = list ? list.map((i) => D[i] && D[i].id).filter((id) => id && E[id]) : Object.keys(E);
    if (!ids.length) return false;
    const at = new Map(D.map((d) => [d.id, d.i]));
    const plan = O.placeFollowPlan(ids.map((id) => at.get(id)).filter((i) => i !== undefined), m);
    return MT.edit(label, (mm) => {
      for (const id of ids) delete mm.placeEdits[id];
      for (const P of plan) { const B = O.placeMatrix(P.i, mm); if (!B.hidden) O.placeFollowApply(mm, P.fol, P.A, B.M); }
    }, 'ow-el', { kind: 'place' });
  };
  /* Remet un nœud retiré, avec ses autres retouches (place, taille, matières). */
  O.placeUnhide = (i) => {
    const d = O.placeDesc()[i];
    return !!d && O.placeEdit(i, `Remettre : ${d.name.toLowerCase()}`, (x) => { if (!x.hide) return false; delete x.hide; return true; }, { follow: false });
  };
  /* Matières héritées par le nœud i (retouches de ce qui le porte) : { texture: { t, c, from } }. */
  O.placeInheritedMats = (i, m = S.map) => {
    const D = O.placeDesc(), E = (m && m.placeEdits) || {}, out = {};
    const chain = O.placeChain(i).slice(0, -1);
    for (const k of chain) { const q = E[D[k].id] && E[D[k].id].m; if (q) for (const [tex, o] of Object.entries(q)) out[tex] = { ...o, from: D[k].name }; }
    return out;
  };
  /* Matière tex du nœud i : patch ({ t, c } ; null ou undefined : retiré) sur sa matière actuelle
     (la sienne, sinon celle héritée) ; reset : il reprend celle héritée (ou l'origine). */
  O.placeSetMat = (i, tex, patch, label, reset = false) => {
    const inh = O.placeInheritedMats(i)[tex];
    return O.placeEdit(i, label, (x) => {
      const mo = { ...(x.m || {}) };
      if (reset) delete mo[tex];
      else {
        const base = mo[tex] || (inh ? { t: inh.t, c: inh.c } : {});
        const q = { ...base, ...patch };
        for (const k of Object.keys(q)) if (q[k] === undefined || q[k] === null) delete q[k];
        mo[tex] = q;
      }
      x.m = mo;
    }, { follow: false });
  };
  /* Remplace le nœud i par un objet de la bibliothèque : même pied, même rotation, même encombrement ;
     le nœud est retiré, l'objet sélectionné. */
  O.placeReplace = (i, model) => {
    const m = S.map, d = O.placeDesc()[i], st = O.placeState()[i], def = ZS.MODELS[model];
    if (!m || !d || !st || !def || st.hidden) return false;
    if (m.props.length >= O.limit('prop')) { MT.toast(`Objets : ${O.limit('prop')} au plus sur une carte ouverte.`, 'warn'); return false; }
    const mb = MT.modelBox(model), [a, b] = ZS.SIZE_RULES ? ZS.SIZE_RULES.prop : [0.1, 10];
    const dims = [(d.box[3] - d.box[0]) * st.s[0], (d.box[4] - d.box[1]) * st.s[1], (d.box[5] - d.box[2]) * st.s[2]];
    const md = [mb.max.x - mb.min.x, mb.max.y - mb.min.y, mb.max.z - mb.min.z];
    const f = dims.map((v, k) => round(clamp(md[k] > 1e-3 && v > 0.02 ? v / md[k] : 1, a, b), 3));
    // centre de l'empreinte (monde) ; l'origine du modèle est décalée de son centre, tourné et mis à l'échelle
    const cx = st.foot.reduce((s, p) => s + p[0], 0) / 4, cz = st.foot.reduce((s, p) => s + p[1], 0) / 4;
    const ox = ((mb.min.x + mb.max.x) / 2) * f[0], oz = ((mb.min.z + mb.max.z) / 2) * f[2], c = Math.cos(st.r), sn = Math.sin(st.r);
    const px = cx - (c * ox + sn * oz), pz = cz - (-sn * ox + c * oz);
    const pr = { m: model, x: round(clamp(px, 1, m.w - 1), 3), z: round(clamp(pz, 1, m.h - 1), 3) };
    const y = st.y0 - mb.min.y * f[1] - gy(pr.x, pr.z);
    if (Math.abs(y) > 0.01) pr.y = round(clamp(y, -20, 60), 3);
    if (Math.abs(st.r) > 1e-4) pr.r = round(wrapRad(st.r), 4);
    MT.setPropScale(pr, f);
    let idx = -1;
    MT.edit(`Remplacer : ${d.name.toLowerCase()} → ${def.name.toLowerCase()}`, (mm) => {
      const E = mm.placeEdits || (mm.placeEdits = {});
      E[d.id] = { ...deep(E[d.id] || {}), hide: true };
      mm.props.push(pr);
      idx = mm.props.length - 1;
    }, 'ow-el', { kind: 'place', i });
    if (idx >= 0) { MT.select({ kind: 'prop', list: [idx] }); MT.pushRecent('model', model); }
    return idx >= 0;
  };
  /* Nœud du décor sous un point du plan, au niveau choisi (surface, pièce ou construction), ou null :
     le plus proche (à tol près), les petits d'abord (un mur fin près du clic passe devant le sol qu'il
     borde ; un poteau à côté ne passe pas devant le mur cliqué). */
  O.placeHit = (wx, wz, tol = 0) => {
    if (!S.opts.ow.placePick || !O.placeOk() || !ZS.ow.on) return null;
    const st = O.placeState(), D = O.placeDesc(), lvl = O.placeLevel();
    let best = -1, rank = Infinity;
    st.forEach((q, i) => {
      const d = D[i];
      if (q.hidden || !d || !q.foot) return;
      if (lvl === 'surface' ? !d.surf : d.surf || (lvl === 'construction' && d.parent >= 0)) return;
      const f = q.foot;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of f) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      if (wx < x0 - tol || wx > x1 + tol || wz < z0 - tol || wz > z1 + tol) return;
      const dist = quadDist(f, wx, wz);
      if (dist > tol) return;
      const r = dist + 0.05 * Math.sqrt(Math.max(0, (x1 - x0) * (z1 - z0)));
      if (r < rank) { rank = r; best = i; }
    });
    return best >= 0 ? { kind: 'place', i: best } : null;
  };

  /* ---------------------------------------------------------- fichier -- */
  /* Version enregistrable : modèles importés utilisés embarqués, images importées des matières du
     décor (jeu 2.0.3) aussi, date. */
  O.exportObject = (m = S.map) => {
    const models = {}, textures = {};
    for (const p of m.props) {
      if (!/^u_/.test(p.m) || models[p.m]) continue;
      const t = S.modelLib[p.m] || (m.custom && m.custom.models && m.custom.models[p.m]);
      if (t) models[p.m] = { name: t.name, data: t.data, scale: t.scale, offset: t.offset.slice(), box: t.box.slice(), solid: t.solid !== false, wall: !!t.wall };
    }
    for (const e of Object.values(m.placeEdits || {})) {
      for (const q of Object.values((e && e.m) || {})) {
        const id = q && q.t;
        if (typeof id !== 'string' || !/^u_/.test(id) || textures[id]) continue;
        const t = S.library[id] || (m.custom && m.custom.textures && m.custom.textures[id]);
        if (t && typeof t.data === 'string') textures[id] = { name: t.name, data: t.data, size: t.size.slice(), rough: t.rough, fit: !!t.fit };
      }
    }
    m.custom = Object.keys(textures).length ? { models, textures } : { models };
    m.updated = new Date().toISOString();
    return ZS.openSerialize(m);
  };
  /* Nombre d'éléments (pour les listes). */
  O.count = (m = S.map) => (m ? m.wallbuys.length + m.perks.length + m.boxes.length + m.vehicles.length + m.fuel.length + m.breakers.length + (m.oxy || []).length + (m.glas ? 1 : 0) : 0);
  O.summary = (m = S.map) => {
    if (!m) return '';
    const nb = (m.buildings || []).length, nr = (m.roads || []).length;
    return `${(m.w / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} × ${(m.h / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} km · ${m.props.length} objet${m.props.length > 1 ? 's' : ''} · ${O.count(m)} éléments${nb ? ` · ${nb} bâtiment${nb > 1 ? 's' : ''}` : ''}${nr ? ` · ${nr} route${nr > 1 ? 's' : ''}` : ''}`;
  };

  /* Vérification : avec le monde chargé, le sol sous chaque élément ; sinon la forme. Les limites
     du format s'ajoutent (le moteur coupe au-delà). */
  O.validate = (m = S.map) => {
    const v = ZS.ow && ZS.ow.on && MT.v3 && MT.v3.owLoaded ? ZS.ow.validate(m) : ZS.openValidate(m);
    for (const k of ['wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'oxy', 'prop', 'road', 'building', 'loc']) {
      const a = O.arr(k, m);
      if (a && a.length > O.limit(k)) v.errors.push({ msg: `${O.PLURAL[k]} : ${a.length}, ${O.limit(k)} au plus (les suivants seraient ignorés).`, at: null });
    }
    return v;
  };

  /* Partie de test : copie de la carte et point de départ (la caméra 3D si demandé). */
  O.testPrep = (fromCam) => {
    let copy;
    try { copy = ZS.openNormalize(JSON.parse(JSON.stringify(O.exportObject(deep(S.map))))); } catch (e) {
      console.error(e);
      MT.toast(`Test impossible : carte illisible (${e.message}).`, 'error');
      return null;
    }
    const notes = [];
    let at = null;
    if (fromCam && MT.v3.cam) {
      const c = MT.v3.cam.position, r = O.place('spawn', c.x, c.z);
      if (r.ok) at = [r.x, r.z, MT.v3.yaw, 0];
      else notes.push('La caméra n’est pas au-dessus d’un sol praticable : départ normal.');
    }
    return { copy, at, errors: S.issues.errors, notes };
  };
})();
