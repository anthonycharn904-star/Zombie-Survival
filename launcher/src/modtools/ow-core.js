'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes (Khamsin) : noyau
   Une carte ouverte garde le monde de sa base (relief, routes, lieux, sanctuaire,
   quête : dans le code du jeu 2.0.0) et porte ce que l'auteur change : départ,
   armes au mur, atouts, emplacements de la boîte mystère, véhicules, jerricans,
   disjoncteurs, objets de la bibliothèque, règles. Le moteur expose ZS.ow
   (interface 3) : monde sans partie, place d'un élément, plan, vérification.
   Ce fichier : éléments (liste, création, déplacement, rotation, suppression),
   sélection, fichier enregistré.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { clamp, round, deep, rad, wrapRad } = MT.util;
  const S = MT.state;
  const O = (MT.ow = MT.ow || {});

  /* Le moteur sait-il ouvrir les cartes ouvertes ? (jeu 2.0.0, interface 3) */
  O.ok = () => (ZS.editorApi || 1) >= 3 && !!ZS.ow && typeof ZS.openNormalize === 'function';

  /* --------------------------------------------------------- éléments -- */
  O.KINDS = ['spawn', 'wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'loc'];
  O.LABEL = { spawn: 'Départ du joueur', wallbuy: 'Arme au mur', perk: 'Atout', box: 'Boîte mystère', vehicle: 'Véhicule', fuel: 'Jerricans', breaker: 'Disjoncteur', prop: 'Objet', loc: 'Lieu nommé', road: 'Route', building: 'Bâtiment' };
  O.PLURAL = { wallbuy: 'Armes au mur', perk: 'Atouts', box: 'Emplacements de la boîte', vehicle: 'Véhicules', fuel: 'Jerricans', breaker: 'Disjoncteurs', prop: 'Objets', loc: 'Lieux nommés', road: 'Routes et pistes', building: 'Bâtiments' };
  O.LIST = { wallbuy: 'wallbuys', perk: 'perks', box: 'boxes', vehicle: 'vehicles', fuel: 'fuel', breaker: 'breakers', prop: 'props', loc: 'locs', road: 'roads', building: 'buildings' };
  O.COLOR = { spawn: '#2fa84a', wallbuy: '#f0ecdc', perk: '#b3231f', box: '#2f6fc8', vehicle: '#8d9a52', fuel: '#e07a24', breaker: '#e8c22a', prop: '#a5804c', loc: '#ffe7b0', road: '#3a3430', building: '#c8b08a' };
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
  };
  O.arr = (kind, m = S.map) => (m && O.LIST[kind] ? m[O.LIST[kind]] : null);
  O.limit = (kind) => (ZS.OPEN_LIMITS && O.LIST[kind] ? ZS.OPEN_LIMITS[O.LIST[kind]] : Infinity);
  O.get = (sel, m = S.map) => {
    if (!sel || !m) return null;
    if (sel.kind === 'spawn') return m.spawn;
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
    if (kind === 'perk' || kind === 'box') return e.face;
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
      case 'road': return `${e.kind === 'road' ? 'Route' : 'Piste'} n° ${i + 1}`;
      case 'building': return (ZS.ow.BUILDINGS[e.type] || { name: e.type }).name;
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
  O.place = (kind, x, z, face) => {
    if (!ZS.ow || !ZS.ow.on) return { ok: false, why: 'Monde pas encore chargé.' };
    if (kind === 'loc') { const ok = x > 0 && z > 0 && x < S.map.w && z < S.map.h; return { ok, x: round(x, 1), z: round(z, 1), why: ok ? '' : 'Hors de la carte.' }; }
    const k = kind === 'spawn' ? 'spawn' : kind;
    return ZS.ow.place(k, x, z, { face: face || S.opts.ow.face });
  };
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
     (seul l'objet 3D suit ; les cases suivent au relâcher). Renvoie { ok, why }. */
  O.moveTo = (sel, x, z, live = false) => {
    const m = S.map, e = O.get(sel);
    if (!e) return { ok: false };
    const kind = sel.kind;
    if (kind === 'building') {
      const before = O.terrainRect('building', e);
      const r = ZS.ow.buildingPlace(e.type, x, z, e.rot);
      if (!r.ok) return r;
      if (r.b.x === e.x && r.b.z === e.z) return r;
      Object.assign(e, { x: r.b.x, z: r.b.z, y: r.b.y });
      if (live) MT.touch('ow-live', { kind, i: sel.i, live });
      else MT.touch('ow-terrain', { rect: unionR(before, O.terrainRect('building', e)) });
      return r;
    }
    if (kind === 'loc') { e.x = round(clamp(x, 0, m.w), 1); e.z = round(clamp(z, 0, m.h), 1); MT.touch('settings', { kind, i: sel.i, live }); return { ok: true }; }
    if (kind === 'road') return { ok: false };
    const face = kind === 'perk' || kind === 'box' ? e.face : kind === 'breaker' ? [e.nx, e.nz] : null;
    const r = O.place(kind, x, z, face);
    if (!r.ok) return r;
    switch (kind) {
      case 'spawn': m.spawn.pos = [r.x, r.z]; break;
      case 'wallbuy': Object.assign(e, { x: r.x, y: r.y, z: r.z, nx: r.nx, nz: r.nz }); break;
      case 'perk': Object.assign(e, { x: r.x, y: r.y, z: r.z, face: (r.face || e.face).slice() }); break;
      case 'breaker': { const f = r.face || [e.nx, e.nz]; Object.assign(e, { x: r.x, y: r.y, z: r.z, nx: f[0], nz: f[1] }); break; }
      case 'box': case 'fuel': Object.assign(e, { x: r.x, y: r.y, z: r.z }); break;
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
    MT.edit('Tourner', (mm) => {
      const x = O.get(s, mm);
      if (s.kind === 'perk' || s.kind === 'box') x.face = O.turnFace(x.face, dir);
      else if (s.kind === 'breaker') { const f = O.turnFace([x.nx, x.nz], dir); x.nx = f[0]; x.nz = f[1]; }
      else if (s.kind === 'vehicle') x.yaw = round(wrapRad(x.yaw + rad(big ? 90 : 15) * dir), 4);
      else if (s.kind === 'spawn') x.yaw = round(wrapRad(x.yaw + rad(big ? 90 : 15) * dir), 4);
      else if (s.kind === 'building') {
        const before = O.terrainRect('building', x);
        const r = ZS.ow.buildingPlace(x.type, x.x, x.z, (x.rot + (dir > 0 ? 1 : 3)) % 4);
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
    if (!s || !m || s.kind !== 'prop') return;
    MT.edit('Hauteur', () => { for (const i of s.list) { const p = m.props[i]; p.y = round(clamp((p.y || 0) + dy, -20, 60)); if (!p.y) delete p.y; } }, 'prop-move', { list: s.list });
  };

  /* ---------------------------------------------------------- fichier -- */
  /* Version enregistrable : modèles importés utilisés embarqués, date. */
  O.exportObject = (m = S.map) => {
    const models = {};
    for (const p of m.props) {
      if (!/^u_/.test(p.m) || models[p.m]) continue;
      const t = S.modelLib[p.m] || (m.custom && m.custom.models && m.custom.models[p.m]);
      if (t) models[p.m] = { name: t.name, data: t.data, scale: t.scale, offset: t.offset.slice(), box: t.box.slice(), solid: t.solid !== false, wall: !!t.wall };
    }
    m.custom = { models };
    m.updated = new Date().toISOString();
    return ZS.openSerialize(m);
  };
  /* Nombre d'éléments (pour les listes). */
  O.count = (m = S.map) => (m ? m.wallbuys.length + m.perks.length + m.boxes.length + m.vehicles.length + m.fuel.length + m.breakers.length : 0);
  O.summary = (m = S.map) => {
    if (!m) return '';
    const nb = (m.buildings || []).length, nr = (m.roads || []).length;
    return `${(m.w / 1000).toLocaleString('fr-BE')} × ${(m.h / 1000).toLocaleString('fr-BE')} km · ${m.props.length} objet${m.props.length > 1 ? 's' : ''} · ${O.count(m)} éléments${nb ? ` · ${nb} bâtiment${nb > 1 ? 's' : ''}` : ''}${nr ? ` · ${nr} route${nr > 1 ? 's' : ''}` : ''}`;
  };

  /* Vérification : avec le monde chargé, le sol sous chaque élément ; sinon la forme. Les limites
     du format s'ajoutent (le moteur coupe au-delà). */
  O.validate = (m = S.map) => {
    const v = ZS.ow && ZS.ow.on && MT.v3 && MT.v3.owLoaded ? ZS.ow.validate(m) : ZS.openValidate(m);
    for (const k of ['wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'prop', 'road', 'building', 'loc']) {
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
