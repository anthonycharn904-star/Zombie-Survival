'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes : panneaux (outil, sélection, carte), barre
   d'état. Les objets de la bibliothèque gardent les panneaux habituels.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { h, round, deg, rad, wrapRad } = MT.util;
  const S = MT.state, UI = MT.ui, O = MT.ow;
  const OU = (O.ui = {});
  const { field, num, slider, select, check, text, seg, btn, section, kField, setK, decFr } = UI.f;
  const commit = (label, kind, fn, detail) => UI.edit.commit(label, kind, fn, detail);
  const ELKINDS_DESERT = ['wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker'];
  const ELKINDS_MOON = ['wallbuy', 'perk', 'box', 'breaker', 'oxy'];
  const elKinds = () => (O.moon() ? ELKINDS_MOON : ELKINDS_DESERT);
  const FACE_NAME = (f) => (f[0] === 1 ? 'est' : f[0] === -1 ? 'ouest' : f[1] === 1 ? 'sud' : 'nord');
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('fr-BE', { maximumFractionDigits: d }) : '—');
  const where = (x, z) => { const w = O.where(x, z); return w ? ` · ${w}` : ''; };
  const perkOptions = () => Object.entries(ZS.PERKS).filter(([id]) => ZS.ELIXIRS && ZS.ELIXIRS[id]).map(([id, p]) => [id, `${p.name} — ${p.cost} pts${p.power ? ' · courant' : ''}`]);
  const weaponOptions = () => Object.entries(ZS.WEAPONS).map(([id, w]) => [id, `${w.name} — ${ZS.wallbuyPrice({ w: id })} pts`]);
  const vehOptions = () => Object.entries(ZS.VEH_TYPES).map(([id, t]) => [id, `${t.name}${t.cost ? ` — ${t.cost} pts` : ''}`]);
  const degOf = (r) => (((deg(r) % 360) + 360) % 360);

  /* ------------------------------------------------------ sélection --- */
  OU.focusSel = () => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    let p = null;
    if (s.kind === 'prop') { const pr = m.props[s.list[0]]; if (pr) p = { x: pr.x, z: pr.z, dist: 12 }; }
    else if (s.kind === 'place') {
      // pièce du décor : assez loin pour la voir entière (une tente, une salle des turbines…)
      const e = O.get(s);
      if (e && e.foot) { const d = Math.hypot(e.foot[2][0] - e.foot[0][0], e.foot[2][1] - e.foot[0][1]); p = { x: e.x, z: e.z, dist: Math.max(9, Math.min(90, d * 1.3)) }; }
    } else { const e = O.get(s); if (e) { const [x, z] = O.posOf(s.kind, e); p = { x, z, dist: s.kind === 'vehicle' ? 16 : 9 }; } }
    if (p) MT.emit('focus', p);
  };
  const head = (title, sub, actions = []) => h('div', { class: 'p-head sel' }, h('div', null, h('h2', null, title), sub ? h('p', null, sub) : null), h('div', { class: 'p-head-actions' },
    h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Montrer (F)', onclick: OU.focusSel }, UI.icon('eye')), ...actions));
  const delBtn = () => h('button', { type: 'button', class: 'mt-icon-btn sm danger', title: 'Supprimer (Suppr)', onclick: () => MT.deleteSelection() }, UI.icon('trash'));
  const rotBtn = (label = 'Tourner') => btn(label, () => O.rotate(1), { ic: 'rotate', title: 'R' });

  /* ------------------------------------------------------ panneau outil --- */
  OU.toolPanel = () => {
    if (S.tool === 'props') return UI.panels.propsPanel();
    if (S.tool === 'elements') return elementsPanel();
    if (S.tool === 'terrain') return terrainPanel();
    if (S.tool === 'ground') return groundPanel();
    if (S.tool === 'roads') return roadsPanel();
    if (S.tool === 'buildings') return buildingsPanel();
    return selectPanel();
  };
  /* ---- niveau 2 : relief, sol, routes, bâtiments */
  function terrainPanel() {
    const b = S.opts.ow.brush, TR = O.terrain;
    return [
      section('Pinceau',
        seg(b.op, TR.OPS, (v) => { b.op = v; MT.emit('tool-opts'); }),
        field('Taille', slider({ value: b.size, min: 4, max: 160, step: 1, fmt: (v) => `${Math.round(v)} m`, onCommit: (v) => { b.size = Math.round(v); MT.emit('preview'); } }), '[ et ] pour changer'),
        field('Force', slider({ value: b.strength, min: 0.05, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)} %`, onCommit: (v) => { b.strength = v; } })),
        h('p', { class: 'p-note' }, b.op === 'flatten' ? 'Aplanir : vers la hauteur du point où l’on commence à peindre.' : b.op === 'smooth' ? 'Adoucir : arrondit les creux et les bosses.' : b.op === 'reset' ? 'Effacer : rend au terrain sa forme d’origine (celle du jeu).' : 'Clic droit dans le plan : l’inverse (en 3D, il sert à regarder). Tenir le pinceau immobile continue de monter ou de creuser.')),
      section('Protégé',
        h('p', { class: 'p-note' }, S.map.base === 'desert' ? 'Les routes du désert et les pyramides ne bougent pas (le cercle du pinceau devient rouge au-dessus).'
          : S.map.base === 'lune' ? 'La fosse, ses gradins et ses rampes ne bougent pas (le cercle du pinceau devient rouge au-dessus) ; le bord de la carte non plus.'
            : S.map.base === 'ombre' ? 'La fosse, ses gradins, ses rampes et les lieux d’Ombre éternelle (base, plateau, tour, crête, dépôt) ne bougent pas : le cercle du pinceau devient rouge au-dessus.'
              : 'Les sept lieux de Khamsin, ses routes et les pyramides ne bougent pas (le cercle du pinceau devient rouge au-dessus) : leurs bâtiments y sont posés.'),
        h('p', { class: 'p-note' }, 'Les routes et bâtiments ajoutés suivent : le terrain est aplani sous eux après chaque coup de pinceau.')),
    ];
  }
  function groundPanel() {
    const o = S.opts.ow.paint, TR = O.terrain;
    const sw = h('div', { class: 'kinds' }, Object.entries(TR.PAINT).map(([id, [name, col]]) => h('button', {
      type: 'button', class: `kind-btn ${o.bio === id ? 'on' : ''}`, onclick: () => { o.bio = id; MT.emit('tool-opts'); },
    }, h('i', { style: { background: col, borderRadius: '2px' } }), h('span', null, name))));
    return [
      section('Sol', sw, h('p', { class: 'p-note' }, O.moon() ? 'Couleur du régolithe (le relief garde ses pentes : une paroi trop raide redevient de la roche). Clic droit dans le plan : sol d’origine.' : 'Couleur du terrain et conduite des véhicules (le sable damé et les graviers roulent mieux que le sable). Clic droit dans le plan : sol d’origine. L’eau, les routes et les pistes ne se peignent pas.')),
      section('Pinceau', field('Taille', slider({ value: o.size, min: 4, max: 160, step: 1, fmt: (v) => `${Math.round(v)} m`, onCommit: (v) => { o.size = Math.round(v); MT.emit('preview'); } }), '[ et ] pour changer')),
    ];
  }
  function roadsPanel() {
    const o = S.opts.ow.road;
    return [
      section('Tracé',
        seg(o.kind, [['road', 'Route goudronnée'], ['track', 'Piste']], (v) => { o.kind = v; o.w = v === 'road' ? 8 : 6; MT.emit('tool-opts'); }),
        field('Largeur', slider({ value: o.w, min: 3, max: 14, step: 0.5, fmt: (v) => `${v} m`, onCommit: (v) => { o.w = v; } })),
        h('p', { class: 'p-note' }, 'Cliquez point par point, dans le plan ou en 3D ; double-clic ou Entrée pour finir. Le terrain est aplani le long de la route (pente bornée), sauf sous les lieux de la base.'),
        MT.preview.road ? h('div', { class: 'p-actions' }, btn(`Finir (${MT.preview.road.pts.length} points)`, () => O.terrain.finishRoad(), { kind: 'primary' }), btn('Annuler', () => O.terrain.cancelRoad())) : null),
      section('Routes de la carte', h('p', { class: 'p-note' }, `${(S.map.roads || []).length} sur ${ZS.OPEN_LIMITS.roads}. Outil Sélection : cliquez une route pour glisser ses points, changer sa largeur ou la supprimer.`)),
    ];
  }
  function buildingsPanel() {
    const o = S.opts.ow.bld, cat = ZS.ow.BUILDINGS;
    const list = h('div', { class: 'ow-blds' }, Object.entries(cat).map(([id, T]) => h('button', {
      type: 'button', class: `ow-bld ${o.type === id ? 'on' : ''}`, onclick: () => { if (o.type !== id) o.dims = null; o.type = id; MT.emit('tool-opts'); MT.emit('preview'); },
    }, h('b', null, T.name), h('small', null, `${T.w} × ${T.d} m · ${T.desc}`))));
    return [
      section('Catalogue', list),
      bldDimsSection(o.type, o.dims || {}, (d) => { o.dims = d && Object.keys(d).length ? d : null; MT.emit('tool-opts'); MT.emit('preview'); }, 'Cotes à la pose'),
      section('Pose',
        field('Orientation', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, ['entrée au sud', 'entrée à l’ouest', 'entrée au nord', 'entrée à l’est'][o.rot]), btn('Tourner', () => O.terrain.rotateTool(1), { ic: 'rotate', title: 'R' }))),
        h('p', { class: 'p-note' }, `Le terrain est aplani sous le bâtiment. Murs, portes, fenêtres et toits sont pleins : on y entre, les zombies en font le tour, on pose des armes sur ses murs (outil Éléments).${O.moon() ? ' Sur la Lune, un module n’est pas pressurisé : l’oxygène ne s’y recharge pas (seulement dans la base Séléné et aux postes d’oxygène).' : ''}`),
        h('p', { class: 'p-note' }, `${(S.map.buildings || []).length} sur ${ZS.OPEN_LIMITS.buildings}. ${O.moon() ? 'Pas sur un lieu de la base, ni dans la fosse ou sur son bord.' : 'Pas sur un lieu de la base, une route d’origine ni dans l’eau.'}`)),
    ];
  }
  /* Cotes d'un bâtiment (jeu 2.0.3) : largeur et profondeur en mètres entiers (avant rotation : la
     façade d'entrée est la largeur), hauteur des murs. cur : { w, d, h } réglés ; apply(dims). */
  function bldDimsSection(type, cur, apply, title = 'Cotes') {
    const T = ZS.ow.BUILDINGS[type] || ZS.ow.ALL_BUILDINGS && ZS.ow.ALL_BUILDINGS[type];
    const L = ZS.ow.bldLimits && MT.sizesOk() ? ZS.ow.bldLimits(type) : null;
    if (!T || !L) return null;
    const val = { w: cur.w || T.w, d: cur.d || T.d, h: L.h ? cur.h || L.h0 : null };
    const put = (k, v) => { const d = ZS.ow.bldDims({}, { ...cur, [k]: v }, type); apply(d); };
    const fixed = (a) => a[0] === a[1];
    return section(title,
      field('Largeur', fixed(L.w) ? h('span', { class: 'f-hint' }, `${val.w} m (fixe)`) : num({ value: val.w, min: L.w[0], max: L.w[1], step: 1, unit: 'm', digits: 0, onCommit: (v) => put('w', Math.round(v)) }), `Façade d’entrée · de ${L.w[0]} à ${L.w[1]} m`),
      field('Profondeur', fixed(L.d) ? h('span', { class: 'f-hint' }, `${val.d} m (fixe)`) : num({ value: val.d, min: L.d[0], max: L.d[1], step: 1, unit: 'm', digits: 0, onCommit: (v) => put('d', Math.round(v)) }), fixed(L.d) ? null : `De ${L.d[0]} à ${L.d[1]} m`),
      L.h ? field('Hauteur des murs', num({ value: val.h, min: L.h[0], max: L.h[1], step: 0.1, unit: 'm', digits: 1, onCommit: (v) => put('h', round(v, 1)) }), `De ${decFr(L.h[0], 1)} à ${decFr(L.h[1], 1)} m · catalogue : ${decFr(L.h0, 1)} m`) : null,
      h('div', { class: 'p-actions' }, btn(`Cotes du catalogue (${T.w} × ${T.d} m)`, () => apply({}), { ic: 'rotate', disabled: !Object.keys(cur).length })),
      h('p', { class: 'p-note' }, T.house ? 'Portes et fenêtres gardent leur place le long des murs (une ouverture qui ne tient plus est retirée).' : T.tent ? 'Les murets de la tente suivent la hauteur.' : T.tank ? 'Le diamètre de la cuve suit la profondeur.' : 'Le terrain est aplani sous le bâtiment.'));
  }
  function selectPanel() {
    const m = S.map;
    const rows = elKinds().concat(O.ok2() ? (O.moon() ? ['building', 'loc'] : ['building', 'road', 'loc']) : []).map((k) => {
      const arr = O.arr(k), cur = S.sel && S.sel.kind === k ? S.sel.i : -1;
      const go = (d) => {
        if (!arr.length) return;
        const i = cur < 0 ? (d > 0 ? 0 : arr.length - 1) : (cur + d + arr.length) % arr.length;
        MT.select({ kind: k, i });
        OU.focusSel();
      };
      return h('div', { class: 'ow-count' },
        h('i', { style: { background: O.COLOR[k] } }), h('span', null, O.PLURAL[k]), h('b', null, String(arr.length)),
        h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Précédent', disabled: !arr.length, onclick: () => go(-1) }, UI.icon('up')),
        h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Suivant', disabled: !arr.length, onclick: () => go(1) }, UI.icon('down')));
    });
    if (O.moon()) {
      rows.push(h('div', { class: 'ow-count' },
        h('i', { style: { background: O.COLOR.glas } }), h('span', null, 'Le Glas'), h('b', null, m.glas ? '1' : '0'),
        h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Montrer', disabled: !m.glas, onclick: () => { MT.select({ kind: 'glas' }); OU.focusSel(); } }, UI.icon('eye'))));
    }
    return [
      section('Éléments de la carte', ...rows,
        h('div', { class: 'p-actions' },
          btn('Départ du joueur', () => { MT.select({ kind: 'spawn' }); OU.focusSel(); }, { ic: 'walk' }),
          btn(`Tous les objets (${m.props.length})`, () => { if (m.props.length) MT.select({ kind: 'prop', list: m.props.map((_, i) => i) }); }, { disabled: !m.props.length }))),
      decorSection(),
      section('Carte ouverte',
        h('p', { class: 'p-note' }, O.moon()
          ? `Base : ${baseName(m)}. ${m.base === 'lune' ? 'Le relief de la Lune (fosse et rampes, crête, cratères) sans les lieux d’Ombre éternelle' : 'La base Séléné, la fosse, le pont, le convoyeur, la catapulte, la crête solaire, la tour, le plateau d’extraction, le dépôt et l’anomalie, la quête de l’atterrisseur'} viennent du jeu ; ${m.base === 'lune' ? 'la fosse reste fixe' : O.surfOk() ? 'la fosse reste fixe ; tout le décor des lieux se retouche, surface par surface (Sélection : cliquez un module de la base, un mur, la coupole, la tour…), et le jeu suit' : O.placeOk() ? 'la fosse et les lieux liés à la quête restent fixes ; le reste du décor des lieux se retouche (Sélection : cliquez un mât, l’abri, une balise…)' : 'la fosse et les lieux restent fixes'}. Ici : relief (T), sol (P), bâtiments (B), éléments de jeu (G : départ, armes, atouts, boîte, disjoncteurs, postes d’oxygène, Le Glas, lieux), objets (O), règles.`
          : O.ok2()
            ? `Base : ${baseName(m)}. ${m.base === 'desert' ? 'Le désert de Khamsin sans ses lieux (relief, Nil, oasis)' : 'Les sept lieux de Khamsin, leur sanctuaire et leur quête'} viennent du jeu ; le relief des lieux, les routes d’origine et les pyramides restent fixes${O.placeOk() && m.base !== 'desert' ? `, le décor des lieux se retouche (Sélection : cliquez une tente, une caisse, une maison${O.surfOk() ? ', ou un seul de ses murs' : ''}…)` : ''}. Ici : relief (T), sol (P), routes (L), bâtiments (B), éléments de jeu (G), objets (O), départ et règles.`
            : `Relief, routes, bâtiments, sanctuaire et quête viennent du jeu (base : ${baseName(m)}). Vous placez ici les éléments de jeu, les objets de la bibliothèque, le départ et les règles.`),
        h('p', { class: 'p-note' }, `Plan : molette pour le zoom (de ${O.moon() ? '1,4 km' : '4 km'} à quelques mètres), double-clic pour y aller en 3D. 3D : ZQSD/WASD pour voler (Maj : très vite), molette pour avancer vers le curseur.`)),
    ];
  }
  const baseName = (m) => ({ khamsin: 'Khamsin', desert: 'Désert vierge', ombre: 'Ombre éternelle', lune: 'Lune vierge' }[m.base] || m.base);

  function elementsPanel() {
    const o = S.opts.ow;
    if (!O.KIND_KEYS.includes(o.kind)) o.kind = 'wallbuy';          // genre d'un autre monde (véhicule sur la Lune…)
    const kinds = h('div', { class: 'kinds' }, O.KIND_KEYS.map((k, i) => h('button', {
      type: 'button', class: `kind-btn ${o.kind === k ? 'on' : ''}`, title: `${O.LABEL[k]} (${i + 1})`,
      onclick: () => { o.kind = k; MT.emit('tool-opts'); MT.emit('preview'); },
    }, h('i', { style: { background: O.COLOR[k] } }), h('span', null, O.LABEL[k]))));
    const opts = [];
    const count = (k) => { const a = O.arr(k); return a ? h('p', { class: 'p-note' }, `Sur la carte : ${a.length} (${O.limit(k)} au plus).`) : null; };
    const faceRow = () => field('Sens', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, `face ${FACE_NAME(o.face)}`), rotBtn()), 'Sans mur : le côté où se tient le joueur');
    switch (o.kind) {
      case 'wallbuy': opts.push(field('Arme', select({ value: o.weapon, options: weaponOptions(), onChange: (v) => { o.weapon = v; } }), 'Prix modifiable ensuite (onglet Sélection).'), count('wallbuy')); break;
      case 'perk': opts.push(field('Atout', select({ value: o.perk, options: perkOptions(), onChange: (v) => { o.perk = v; } })), faceRow(), count('perk')); break;
      case 'box': opts.push(faceRow(), count('box')); break;
      case 'vehicle':
        opts.push(field('Véhicule', select({ value: o.vehicle, options: vehOptions(), onChange: (v) => { o.vehicle = v; MT.emit('preview'); } })),
          field('Cap', num({ value: degOf(o.yaw), min: 0, max: 360, step: 15, unit: '°', digits: 1, onCommit: (v) => { o.yaw = round(wrapRad(rad(v)), 4); MT.emit('preview'); } }), 'R : +15° · Maj+R : +90°'), count('vehicle'));
        break;
      case 'fuel': opts.push(count('fuel')); break;
      case 'loc': opts.push(count('loc')); break;
      case 'breaker': opts.push(faceRow(), count('breaker'), h('p', { class: 'p-note' }, `Le courant revient quand tous les disjoncteurs de la carte sont enclenchés (F maintenue 4 s chacun). Aucun disjoncteur : cochez « Courant allumé dès le départ » (onglet Carte), sinon ${O.moon() ? 'atouts électriques, Le Glas, ascenseur de la tour et atterrisseur restent' : 'atouts électriques, sanctuaire et batterie de l’avion restent'} sans courant.`)); break;
      case 'oxy': opts.push(faceRow(), count('oxy'), h('p', { class: 'p-note' }, 'Dehors, l’oxygène dure 4 minutes ; il se recharge seul dans la base Séléné. Un poste rend le plein (4 min) pour 250 points. Répartissez-en entre les lieux éloignés de la base.')); break;
      case 'glas': opts.push(faceRow(), h('p', { class: 'p-note' }, S.map.glas ? 'La carte a déjà sa cloche : un clic la déplace ici.' : 'Pas encore de cloche sur cette carte.'), h('p', { class: 'p-note' }, 'Mêmes paliers qu’ailleurs (Tocsin, Bourdon, Glas). Sur la Lune, sans air, on ne l’entend pas dehors.')); break;
      default: break;
    }
    return [section('Élément', kinds, h('p', { class: 'p-note' }, O.HELP[o.kind])), opts.length ? section('Réglages', ...opts) : null];
  }

  /* ------------------------------------------------- panneau sélection --- */
  OU.inspector = () => {
    const s = S.sel, m = S.map;
    if (!s) {
      // décor de la base retouché ou retiré (jeu 2.0.3) : la liste, pour remettre une pièce retirée
      const ed = m && m.placeEdits && Object.keys(m.placeEdits).length;
      return [h('div', { class: 'p-empty' },
        h('p', null, 'Rien de sélectionné.'),
        h('p', { class: 'p-note' }, `Outil Sélection (V) : cliquez sur une arme, un atout, une boîte, un véhicule, un objet${O.surfOk() ? ', le décor de la base (une surface, une pièce ou une construction entière)' : O.placeOk() ? ', une pièce du décor (tente, caisse, maison…)' : ''}… dans le plan ou en 3D.`)), ed ? decorSection() : null];
    }
    if (s.kind === 'prop') return s.list.length > 1 ? UI.panels.propsMulti(s.list) : UI.panels.propInspector(s.list[0]);
    const e = O.get(s);
    if (!e) return [];
    const set = (label, fn) => commit(label, 'ow-el', (mm) => fn(O.get(s, mm)));
    // taille (jeu 2.0.3) ; Le Glas et la boîte : la place est revérifiée à la nouvelle taille
    const kSet = (label) => (k) => {
      set(label, (x) => setK(x, k));
      if (s.kind === 'glas' || s.kind === 'box') { const x = O.get(s); const r = x ? O.place(s.kind, x.x, x.z, x.face, x.k || 1) : null; if (r && !r.ok && r.why) MT.toast(`${r.why} (à cette taille)`, 'warn'); }
    };
    switch (s.kind) {
      case 'spawn': return [head('Départ du joueur', `x ${fmt(e.pos[0])} · z ${fmt(e.pos[1])}${where(e.pos[0], e.pos[1])}`), section('Réglages',
        field('Position', h('span', { class: 'f-inline' },
          num({ value: e.pos[0], min: 1, max: m.w - 1, step: 0.25, unit: 'x', width: '82px', onCommit: (v) => moveNum(s, v, e.pos[1]) }),
          num({ value: e.pos[1], min: 1, max: m.h - 1, step: 0.25, unit: 'z', width: '82px', onCommit: (v) => moveNum(s, e.pos[0], v) }))),
        field('Regard', num({ value: degOf(e.yaw), min: 0, max: 360, step: 15, unit: '°', digits: 1, onCommit: (v) => set('Regard du départ', (x) => { x.yaw = round(wrapRad(rad(v)), 4); }) }), '0° : vers le haut du plan (nord) · R : +15°'))];
      case 'wallbuy': {
        const def = ZS.WEAPONS[e.w];
        return [head('Arme au mur', `${def ? def.name : e.w} · face ${FACE_NAME([e.nx, e.nz])}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
          field('Arme', select({ value: e.w, options: Object.entries(ZS.WEAPONS).map(([id, x]) => [id, x.name]), onChange: (v) => set('Arme au mur', (x) => { x.w = v; }) })),
          field('Prix', h('span', { class: 'f-inline' },
            check({ checked: typeof e.cost === 'number', label: 'personnalisé', onChange: (v) => set('Prix de l’arme', (x) => { if (v) x.cost = ZS.wallbuyPrice({ w: x.w }); else delete x.cost; }) }),
            typeof e.cost === 'number' ? num({ value: e.cost, min: 0, max: 99999, step: 50, unit: 'pts', digits: 0, onCommit: (v) => set('Prix de l’arme', (x) => { x.cost = Math.round(v); }) }) : h('small', { class: 'f-hint' }, `${ZS.wallbuyPrice(e)} pts (prix habituel)`)),
          'Les munitions coûtent la moitié du prix.'),
          field('Hauteur du dessin', slider({ value: e.h || 1.6, min: 0.6, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)} m`, onCommit: (v) => set('Hauteur du dessin', (x) => { x.h = round(v, 2); }) }), 'Centre du dessin au-dessus du sol'),
          kField(e, kSet('Taille de l’arme au mur'), 'Taille du dessin à la craie'),
          h('p', { class: 'p-note' }, 'Glissez l’arme pour la changer de mur : elle se recale sur la face visible du mur le plus proche.'))];
      }
      case 'perk': {
        const def = ZS.PERKS[e.p];
        return [head('Atout', `${def ? def.name : e.p} · ${def ? def.cost : '?'} pts${def && def.power ? ' · demande le courant' : ''}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
          field('Atout', select({ value: e.p, options: perkOptions(), onChange: (v) => set('Atout', (x) => { x.p = v; }) })),
          field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME(e.face)), rotBtn())),
          field('Plafond', h('span', { class: 'f-inline' },
            check({ checked: typeof e.roomH === 'number', label: 'bas', onChange: (v) => set('Plafond', (x) => { if (v) x.roomH = 3.2; else delete x.roomH; }) }),
            typeof e.roomH === 'number' ? num({ value: e.roomH, min: 2.2, max: 30, step: 0.1, unit: 'm', onCommit: (v) => set('Plafond', (x) => { x.roomH = round(v, 2); }) }) : h('small', { class: 'f-hint' }, 'à l’air libre ou sous un haut plafond')),
          'La machine est réduite pour tenir sous un plafond bas.'),
          kField(e, kSet('Taille de l’atout'), perkNote(e)),
          def ? h('p', { class: 'p-note' }, def.desc) : null)];
      }
      case 'box': return [head('Emplacement de la boîte mystère', `n° ${s.i + 1} sur ${m.boxes.length}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        check({ checked: m.boxStart === s.i, label: 'La boîte commence ici', onChange: (v) => { if (v) commit('Départ de la boîte', 'ow-el', (mm) => { mm.boxStart = s.i; }); } }),
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME(e.face)), rotBtn('Tourner'))),
        kField(e, kSet('Taille de la boîte'), 'Taille de la boîte à cet emplacement ; agrandie, elle avance vers sa face (son dos reste en place)'),
        h('p', { class: 'p-note' }, 'La boîte part ailleurs après quelques tirages (ours en peluche) : sur un désert de 4 × 3 km, répartissez les emplacements entre les lieux.'))];
      case 'vehicle': {
        const T = ZS.VEH_TYPES[e.type];
        return [head(T ? T.name : e.type, `x ${fmt(e.x)} · z ${fmt(e.z)}${where(e.x, e.z)}`, [h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Dupliquer (Ctrl+D)', onclick: () => MT.duplicateSelection() }, UI.icon('copy')), delBtn()]), section('Réglages',
          field('Véhicule', select({ value: e.type, options: vehOptions(), onChange: (v) => set('Véhicule', (x) => { x.type = v; }) })),
          field('Cap', num({ value: degOf(e.yaw), min: 0, max: 360, step: 15, unit: '°', digits: 1, onCommit: (v) => set('Cap du véhicule', (x) => { x.yaw = round(wrapRad(rad(v)), 4); }) }), 'R : +15° · Maj+R : +90°'),
          T ? h('p', { class: 'p-note' }, `${fmt(T.len, 1)} × ${fmt(T.wid, 1)} m · réservoir ${Math.round(T.fuel / 1000)} km${T.cost ? ` · à acheter (${T.cost} pts)` : ''}${e.type === 'truck' ? ' · démarre avec le courant' : ''}.`) : null)];
      }
      case 'fuel': return [head('Jerricans', `n° ${s.i + 1} sur ${m.fuel.length}${where(e.x, e.z)}`, [delBtn()]), section('Réglages', kField(e, kSet('Taille des jerricans')), h('p', { class: 'p-note' }, 'Font le plein du véhicule le plus proche (à moins de 14 m) quand on appuie sur F.'))];
      case 'loc': return [head('Lieu nommé', `x ${fmt(e.x)} · z ${fmt(e.z)}`, [delBtn()]), section('Réglages',
        field('Nom', text({ value: e.name, maxLength: 40, onCommit: (v) => commit('Nom du lieu', 'settings', (mm) => { const L = mm.locs[s.i]; L.name = v.trim().slice(0, 40) || L.name; }) }), 'Affiché en entrant dans le cercle, et sur la mini-carte (numéro)'),
        field('Rayon', slider({ value: e.r, min: 15, max: 600, step: 5, fmt: (v) => `${Math.round(v)} m`, onCommit: (v) => commit('Rayon du lieu', 'settings', (mm) => { mm.locs[s.i].r = Math.round(v); }) })),
        h('p', { class: 'p-note' }, 'Glissez le centre (outil Sélection) pour le déplacer.'))];
      case 'road': {
        const len = e.pts.reduce((a, p, k) => (k ? a + Math.hypot(p[0] - e.pts[k - 1][0], p[1] - e.pts[k - 1][1]) : 0), 0);
        const tset = (label, fn) => { const before = O.terrainRect('road', { ...e, pts: e.pts.map((p) => p.slice()) }); commit(label, 'ow-terrain', (mm) => fn(mm.roads[s.i]), { rect: O.unionRect(before, O.terrainRect('road', e)) }); };
        return [head(e.kind === 'road' ? 'Route goudronnée' : 'Piste', `${e.pts.length} points · ${Math.round(len)} m`, [delBtn()]), section('Réglages',
          field('Genre', seg(e.kind, [['road', 'Route'], ['track', 'Piste']], (v) => tset('Genre de la route', (r) => { r.kind = v; }))),
          field('Largeur', slider({ value: e.w, min: 3, max: 14, step: 0.5, fmt: (v) => `${v} m`, onCommit: (v) => tset('Largeur de la route', (r) => { r.w = v; }) })),
          h('div', { class: 'p-actions' },
            btn('Enlever le dernier point', () => { if (e.pts.length > 2) tset('Raccourcir la route', (r) => { r.pts.pop(); }); }, { disabled: e.pts.length <= 2 }),
            btn('Inverser le sens', () => tset('Inverser la route', (r) => { r.pts.reverse(); }))),
          h('p', { class: 'p-note' }, 'Glissez ses points dans le plan (points jaunes). Pour la prolonger : outil Routes, une nouvelle route depuis son bout.'))];
      }
      case 'building': {
        const T = ZS.ow.BUILDINGS[e.type] || { name: e.type, w: 0, d: 0 };
        const W0 = e.w || T.w, D0 = e.d || T.d;
        // cotes (jeu 2.0.3) : la place est revérifiée ; le sol garde sa hauteur
        const setDims = (d) => {
          const r = ZS.ow.buildingPlace(e.type, e.x, e.z, e.rot, d);
          if (!r.ok) { MT.toast(r.why, 'warn'); UI.renderPanel(); return; }
          const before = O.terrainRect('building', { ...e });
          commit('Cotes du bâtiment', 'ow-terrain', (mm) => {
            const b = mm.buildings[s.i];
            delete b.w; delete b.d; delete b.h;
            Object.assign(b, { x: r.b.x, z: r.b.z }, O.bldDims(r.b));
          }, { rect: O.unionRect(before, O.terrainRect('building', { ...e, ...r.b, y: e.y })) });
        };
        return [head(T.name, `${W0} × ${D0} m${e.h ? ` · murs de ${decFr(e.h, 1)} m` : ''} · sol à ${fmt(e.y, 2)} m${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
          field('Modèle', select({ value: e.type, options: Object.entries(ZS.ow.BUILDINGS).map(([id, x]) => [id, `${x.name} (${x.w} × ${x.d} m)`]), onChange: (v) => {
            const r = ZS.ow.buildingPlace(v, e.x, e.z, e.rot);
            if (!r.ok) { MT.toast(r.why, 'warn'); UI.renderPanel(); return; }
            const before = O.terrainRect('building', { ...e });
            // un autre modèle : les cotes du catalogue
            commit('Modèle du bâtiment', 'ow-terrain', (mm) => { const b = mm.buildings[s.i]; delete b.w; delete b.d; delete b.h; Object.assign(b, { type: v, x: r.b.x, z: r.b.z, y: r.b.y }); }, { rect: O.unionRect(before, O.terrainRect('building', r.b)) });
          } })),
          field('Orientation', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, ['entrée au sud', 'entrée à l’ouest', 'entrée au nord', 'entrée à l’est'][e.rot]), rotBtn())),
          field('Hauteur du sol', num({ value: e.y, min: -10, max: 120, step: 0.1, unit: 'm', onCommit: (v) => commit('Hauteur du bâtiment', 'ow-terrain', (mm) => { mm.buildings[s.i].y = round(v, 3); }, { rect: O.terrainRect('building', e) }) }), 'Relevée à la pose ; le terrain est aplani à cette hauteur'),
          h('p', { class: 'p-note' }, 'Glissez-le pour le déplacer (le terrain suit). Posez des armes au mur, des atouts, la boîte… dedans avec l’outil Éléments.')),
          bldDimsSection(e.type, O.bldDims(e), setDims)];
      }
      case 'place': return placeInspector(s, e);
      case 'breaker': return [head('Disjoncteur', `${s.i + 1} sur ${m.breakers.length} · face ${FACE_NAME([e.nx, e.nz])}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        field('Nom', text({ value: e.name, maxLength: 40, onCommit: (v) => set('Nom du disjoncteur', (x) => { x.name = v.trim().slice(0, 40) || x.name; }) }), 'Affiché quand on le vise : « Maintenez F pour enclencher le disjoncteur (…) »'),
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME([e.nx, e.nz])), rotBtn())),
        kField(e, kSet('Taille du disjoncteur')),
        h('p', { class: 'p-note' }, `Tous enclenchés (${m.breakers.length}) : le courant revient (${O.moon() ? 'atouts, Le Glas, ascenseur de la tour, projecteurs, atterrisseur' : 'atouts, sanctuaire, batterie de l’avion, camion blindé'}).`))];
      case 'oxy': return [head('Poste d’oxygène', `n° ${s.i + 1} sur ${(m.oxy || []).length} · face ${FACE_NAME(e.face)}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME(e.face)), rotBtn())),
        kField(e, kSet('Taille du poste d’oxygène')),
        h('p', { class: 'p-note' }, 'F : une bouteille neuve (4 min d’oxygène) pour 250 points. Dans la base Séléné, inutile : l’air recharge seul.'),
        h('p', { class: 'p-note' }, 'Glissez-le pour le changer de mur : il se recale dos au mur le plus proche.'))];
      case 'glas': return [head('Le Glas', `face ${FACE_NAME(e.face)}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME(e.face)), rotBtn())),
        kField(e, kSet('Taille du Glas'), `Beffroi de ${decFr(5.6 * (e.k || 1), 1)} m ; il lui faut ${decFr(5 * (e.k || 1), 1)} × ${decFr(5 * (e.k || 1), 1)} m de sol plat`),
        h('p', { class: 'p-note' }, 'La cloche qui reforge les armes : muette sans courant, trois paliers (5 000, +10 000, +20 000 points). Une seule par carte.'),
        h('p', { class: 'p-note' }, `Glissez-la sur un autre sol plat et libre de ${decFr(5 * (e.k || 1), 1)} × ${decFr(5 * (e.k || 1), 1)} m.`))];
      default: return [];
    }
  };
  /* ---- Décor des lieux de la base (jeu 2.0.3) : ce qu'un clic sélectionne (surface, pièce,
     construction), nœuds retouchés ou retirés (pour les remettre). */
  function setLevel(v) {
    S.opts.ow.placeLevel = v;
    // en remontant (surface → pièce → construction), la sélection suit
    const s = S.sel;
    if (s && s.kind === 'place' && v !== 'surface') { const k = O.placeLift(s.i, v); if (k >= 0 && k !== s.i) { MT.select({ kind: 'place', i: k }); return; } }
    MT.emit('tool-opts');
    UI.renderPanel();
  }
  const levelField = () => {
    if (!O.surfOk()) return null;
    const L = O.PLACE_LEVELS.find((q) => q[0] === O.placeLevel()) || O.PLACE_LEVELS[1];
    return h('div', { class: 'ow-level-box' }, h('span', { class: 'ow-level-lbl' }, 'Un clic sur le décor choisit :'), seg(L[0], O.PLACE_LEVELS, setLevel, 'ow-level'), h('small', { class: 'f-hint' }, L[2]));
  };
  const editWord = (x) => (!x ? '' : x.hide ? 'retirée' : Object.keys(x).length === 1 && x.m ? 'matières' : 'retouchée');
  function decorSection() {
    if (!O.placeOk() || !ZS.ow.on) return null;
    const D = O.placeDesc(), m = S.map;
    if (!D.length) return null;                                   // désert vierge, Lune vierge : pas de lieux
    const E = m.placeEdits || {}, edited = D.filter((d) => E[d.id]), gone = edited.filter((d) => E[d.id].hide);
    const nP = D.filter((d) => !d.surf).length, nS = D.length - nP;
    const rows = edited.slice(0, 80).map((d) => h('div', { class: 'ow-decor-row' },
      h('span', null, h('b', null, d.name), h('small', null, `${d.surf ? `surface de « ${D[d.parent] ? D[d.parent].name : '?'} »` : d.placeName || 'lieu'} · ${editWord(E[d.id])}`)),
      E[d.id].hide
        ? h('button', { type: 'button', class: 'mt-icon-btn sm', title: Object.keys(E[d.id]).length > 1 ? 'Remettre (avec ses retouches)' : 'Remettre', onclick: () => { O.placeUnhide(d.i); UI.renderPanel(); } }, UI.icon('eye'))
        : h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Montrer', onclick: () => { MT.select({ kind: 'place', i: d.i }); OU.focusSel(); } }, UI.icon('eye')),
      h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Rétablir l’origine (sans aucune retouche)', onclick: () => { O.placeReset([d.i], `Rétablir : ${d.name.toLowerCase()}`); UI.renderPanel(); } }, UI.icon('rotate'))));
    const word = (n, a, b) => `${n} ${n > 1 ? b : a}`;
    return section('Décor de la base',
      check({ checked: S.opts.ow.placePick, label: 'Sélectionnable (clic dans le plan ou en 3D)', onChange: (v) => { S.opts.ow.placePick = v; if (!v && S.sel && S.sel.kind === 'place') MT.select(null); MT.emit('tool-opts'); } }),
      levelField(),
      h('p', { class: 'p-note' }, O.surfOk()
        ? `${word(nP, 'pièce', 'pièces')} dans les lieux (tentes, caisses, maisons, modules de la base…) et ${word(nS, 'surface', 'surfaces')} (murs, toits, poutres, faces…) : ${word(edited.length - gone.length, 'retouchée', 'retouchées')}, ${word(gone.length, 'retirée', 'retirées')}. Chacune se déplace, se tourne, change de taille, de texture ou de teinte, se remplace par un objet ou se retire. Ce qui en dépend dans la partie suit (air de la base, échelle de la tour, quête…), et les éléments de jeu posés dedans aussi.`
        : `${D.length} pièces dans les lieux (tentes, caisses, fûts, lampadaires, maisons…) : ${edited.length - gone.length} retouchée${edited.length - gone.length > 1 ? 's' : ''}, ${gone.length} retirée${gone.length > 1 ? 's' : ''}. Cliquez-en une pour la déplacer, la tourner, changer sa taille ou la retirer ; celles liées à la quête restent à leur place.`),
      rows.length ? h('div', { class: 'ow-decor-list' }, ...rows) : null,
      edited.length > rows.length ? h('p', { class: 'p-note' }, `… et ${edited.length - rows.length} autres.`) : null,
      edited.length ? h('div', { class: 'p-actions' }, btn('Tout le décor d’origine', () => { O.placeReset(null, 'Tout le décor d’origine'); MT.toast('Décor d’origine partout (Ctrl+Z pour annuler).', 'info'); UI.renderPanel(); }, { ic: 'rotate' })) : null);
  }
  /* Ce qui porte la sélection, de la construction jusqu'à elle (chaque niveau se sélectionne). */
  function crumbs(i) {
    const D = O.placeDesc(), chain = O.placeChain(i);
    if (chain.length < 2) return null;
    return h('nav', { class: 'ow-crumbs', 'aria-label': 'Ce qui porte la sélection' }, chain.map((k, n) => [
      n ? h('span', { class: 'sep', 'aria-hidden': 'true' }, '›') : null,
      k === i ? h('b', null, D[k].name) : h('button', { type: 'button', title: D[k].surf ? 'Sélectionner cette surface' : 'Sélectionner cette pièce', onclick: () => MT.select({ kind: 'place', i: k }) }, D[k].name),
    ]));
  }
  /* Ce que le jeu fait de ce nœud ou de ce qui le porte (air, quête…). */
  function logicNote(i) {
    const D = O.placeDesc(), chain = O.placeChain(i).reverse();
    const k = chain.find((q) => D[q] && D[q].logic);
    if (k === undefined) return null;
    return h('p', { class: 'p-note ow-logic' }, h('b', null, 'Dans la partie : '), k === i ? D[k].logic : `${D[k].logic.replace(/\.$/, '')} (« ${D[k].name} »).`);
  }
  /* Pièces posées dedans et surfaces : liste cliquable (recherche au-delà de 24). */
  function kidsSection(e) {
    const D = O.placeDesc(), E = S.map.placeEdits || {};
    const kids = (e.kids || []).filter((k) => D[k] && (O.surfOk() || !D[k].surf));
    if (!kids.length) return null;
    const nP = kids.filter((k) => !D[k].surf).length, nS = kids.length - nP;
    const list = h('div', { class: 'ow-decor-list ow-kids' });
    let q = '';
    const fill = () => {
      list.textContent = '';
      const nq = q.trim().toLowerCase();
      const shown = nq ? kids.filter((k) => D[k].name.toLowerCase().includes(nq)) : kids;
      for (const k of shown.slice(0, 200)) {
        const d = D[k], w = editWord(E[d.id]);
        list.append(h('button', { type: 'button', class: `ow-kid ${d.surf ? 'surf' : 'piece'} ${E[d.id] && E[d.id].hide ? 'gone' : ''}`, onclick: () => { MT.select({ kind: 'place', i: k }); OU.focusSel(); } },
          h('b', null, d.name), h('small', null, `${d.surf ? 'surface' : 'pièce posée dedans'}${w ? ` · ${w}` : ''}`)));
      }
      if (shown.length > 200) list.append(h('p', { class: 'p-note' }, `… et ${shown.length - 200} autres : affinez la recherche.`));
      if (!shown.length) list.append(h('p', { class: 'p-note' }, 'Rien ne correspond.'));
    };
    fill();
    const search = kids.length > 24 ? h('input', { type: 'search', class: 'f-text ow-kids-search', placeholder: 'Chercher : mur, toit, poutre, sol…', spellcheck: false, oninput: (ev) => { q = ev.target.value; fill(); } }) : null;
    const parts = [nP ? `${nP} pièce${nP > 1 ? 's' : ''} posée${nP > 1 ? 's' : ''} dedans` : '', nS ? `${nS} surface${nS > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    return section('Ce qu’elle porte', h('p', { class: 'p-note' }, `${parts}. Cliquez pour la sélectionner (une surface retirée se remet d’ici).`), search, list);
  }
  /* Matières (interface 7) : chaque texture de la sélection, remplacée (bibliothèque, image importée)
     et teintée ; sur une pièce, pour toutes ses surfaces et ce qu'elle porte. */
  function matSection(s, e) {
    if (!O.surfOk() || !e.mats || !e.mats.length) return null;
    const own = (e.edit && e.edit.m) || {}, inh = O.placeInheritedMats(s.i);
    const tn = (id) => MT.texName(id).replace(/\s*\((Khamsin|Lune)\)$/, '');
    const swatch = (id) => {
      const sw = h('span', { class: 'tex-swatch sm' }), u = MT.texThumb(id);
      if (typeof u === 'string') sw.style.backgroundImage = `url(${u})`;
      else if (u && u.nodeType) { u.classList.add('lib-canvas'); sw.append(u); }
      return sw;
    };
    const rows = e.mats.slice(0, 24).map((tex) => {
      const o = own[tex], q = o || inh[tex] || null;
      const cur = q && q.t && ZS.TEXLIB[q.t] ? q.t : tex, col = q && typeof q.c === 'number' ? q.c : null;
      const changed = cur !== tex;
      const name = h('span', { class: 'ow-mat-name', title: `${MT.texName(tex)}${changed ? ` → ${MT.texName(cur)}` : ''}` }, h('b', null, tn(tex)), changed ? h('small', null, `→ ${tn(cur)}`) : null,
        !o && inh[tex] ? h('small', null, `de « ${inh[tex].from} »`) : null, q && q.t && !ZS.TEXLIB[q.t] ? h('small', { class: 'warn' }, `${q.t} introuvable`) : null);
      return h('div', { class: 'ow-mat' }, swatch(cur), name,
        h('span', { class: 'ow-mat-acts' },
          h('button', { type: 'button', class: 'mt-btn sm', title: 'Une autre texture de la bibliothèque (ou une de vos images)', onclick: async () => { const id = await UI.pick('tex', cur, `Texture à la place de « ${tn(tex)} »`); if (id) O.placeSetMat(s.i, tex, { t: id === tex ? null : id }, `Texture : ${tn(id)}`); } }, 'Texture…'),
          h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Importer une image pour cette matière', onclick: () => UI.importImage((id) => O.placeSetMat(s.i, tex, { t: id }, 'Image importée')) }, UI.icon('image')),
          UI.f.color({ value: col !== null ? col : 0xffffff, onCommit: (v) => O.placeSetMat(s.i, tex, { c: ZS.parseColor(v, 0xffffff) }, 'Teinte') }),
          col !== null && o ? h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Sans teinte', onclick: () => O.placeSetMat(s.i, tex, { c: null }, 'Sans teinte') }, UI.icon('close')) : null,
          o ? h('button', { type: 'button', class: 'mt-icon-btn sm', title: inh[tex] ? `Matière de « ${inh[tex].from} »` : 'Matière d’origine', onclick: () => O.placeSetMat(s.i, tex, null, 'Matière d’origine', true) }, UI.icon('rotate')) : null));
    });
    return section('Matières', ...rows,
      e.mats.length > rows.length ? h('p', { class: 'p-note' }, `… et ${e.mats.length - rows.length} autres (sélectionnez une surface).`) : null,
      h('p', { class: 'p-note' }, e.surf
        ? 'Texture : une autre de la bibliothèque, ou une de vos images (« Mes images », ou le bouton image pour en importer une), à sa taille réelle. Teinte : colore la texture. Rien que sur cette surface.'
        : 'Texture et teinte de toutes les surfaces de cette matière dans la pièce, et dans ce qu’elle porte (une surface garde la sienne si vous la changez ensuite). Pour une seule surface : choisissez « Surface » (un clic choisit), puis cliquez-la.'));
  }
  /* Inspecteur d'un nœud du décor (pièce ou surface) : ce qui le porte, place, hauteur, rotation, taille,
     matières, remplacer par un objet, ce qu'il porte, retirer, rétablir. */
  function placeInspector(s, e) {
    const D = O.placeDesc(), parent = e.parent >= 0 ? D[e.parent] : null;
    const what = e.surf ? 'surface' : 'pièce';
    const sub = `${e.placeName || 'Lieu de la base'}${e.surf ? ` · surface de « ${parent ? parent.name : '?'} »` : parent ? ` · posée dans « ${parent.name} »` : ''}`;
    if (e.locked) {
      return [head(e.name, sub), section('Pièce fixe',
        h('p', { class: 'p-note' }, e.locked),
        h('p', { class: 'p-note' }, 'Les autres pièces du décor (tentes, caisses, lampadaires, maisons…) se déplacent, se tournent, changent de taille ou se retirent.'))];
    }
    const up = parent ? h('button', { type: 'button', class: 'mt-icon-btn sm', title: `Sélectionner « ${parent.name} » (ce qui la porte)`, onclick: () => MT.select({ kind: 'place', i: parent.i }) }, UI.icon('up')) : null;
    if (e.hidden) {
      const gonePar = parent && O.get({ kind: 'place', i: parent.i }) && O.get({ kind: 'place', i: parent.i }).hidden;
      return [head(e.name, `${sub} · retirée`, [up]), crumbs(s.i), section(e.surf ? 'Surface retirée' : 'Pièce retirée',
        h('p', { class: 'p-note' }, gonePar ? `« ${parent.name} », qui la porte, est retirée aussi : remettez-la d’abord.` : 'Elle n’est plus dans la carte (ni dans la partie).'),
        h('div', { class: 'p-actions' },
          btn('Remettre', () => O.placeUnhide(s.i), { ic: 'eye', kind: 'primary', disabled: !(e.edit && e.edit.hide), title: 'Avec ses autres retouches (place, taille, matières)' }),
          btn('Rétablir l’origine', () => O.placeReset([s.i], `Rétablir : ${e.name.toLowerCase()}`), { ic: 'rotate', disabled: !e.edit }))), logicNote(s.i)];
    }
    const ed = e.edit || {};
    const mut = (fn) => (mm) => {
      const E = mm.placeEdits || (mm.placeEdits = {}), x = { ...(E[e.id] || {}) };
      fn(x); O.placeClean(x, e);
      if (Object.keys(x).length) E[e.id] = x; else delete E[e.id];
    };
    const liveSet = (label, fn) => UI.edit.live(label, 'ow-live', mut(fn), { kind: 'place', i: s.i, live: true });
    const set = (label, fn) => O.placeEdit(s.i, label, fn);
    const dims = [e.box[3] - e.box[0], e.box[4] - e.box[1], e.box[5] - e.box[2]].map((v) => Math.max(0, round(v, 3)));
    const curS = () => { const x = ((S.map.placeEdits || {})[e.id] || {}); return ZS.propScale ? ZS.propScale({ s: x.s }) : [1, 1, 1]; };
    const kidsP = (e.kids || []).filter((k) => D[k] && !D[k].surf).length;
    const follows = O.surfOk();
    return [
      head(e.name, sub, [up, delBtn()]),
      crumbs(s.i),
      O.surfOk() ? section('Sélection', levelField()) : null,
      logicNote(s.i),
      section('Place',
        field('Position', h('span', { class: 'f-inline' },
          num({ value: e.x, min: 1, max: S.map.w - 1, step: 0.25, unit: 'x', width: '82px', onCommit: (v) => moveNum(s, v, e.z) }),
          num({ value: e.z, min: 1, max: S.map.h - 1, step: 0.25, unit: 'z', width: '82px', onCommit: (v) => moveNum(s, e.x, v) })),
          parent ? `Suit « ${parent.name} » quand elle bouge` : 'Glissez-la dans le plan ou en 3D : elle garde sa hauteur au-dessus du terrain'),
        field('Hauteur', num({ value: ed.dy || 0, min: -60, max: 200, step: 0.1, unit: 'm', onLive: (v) => liveSet('Hauteur', (x) => { x.dy = round(v, 3); }), onCommit: (v) => set('Hauteur', (x) => { x.dy = round(v, 3); }) }), 'Ajoutée à sa hauteur d’origine · Page haut / bas'),
        field('Rotation', num({ value: degOf(ed.r || 0), min: -360, max: 720, step: 15, unit: '°', digits: 1, onLive: (v) => liveSet('Tourner', (x) => { x.r = rad(v); }), onCommit: (v) => set('Tourner', (x) => { x.r = rad(v); }) }), 'Par rapport à l’origine · R : +15° · Maj+R : +90°')),
      MT.sizesOk() ? section('Taille', ...UI.f.sizeFields(dims, curS, (f, isLive) => (isLive ? liveSet : set)('Taille', (x) => { x.s = f; }),
        { note: `À l’origine : ${decFr(dims[0])} × ${decFr(dims[1])} × ${decFr(dims[2])} m (largeur × hauteur × profondeur). ${e.surf ? 'Ses cases (mur, sol…) suivent la taille.' : `Ses murs, ses sols et ses solides suivent la taille${kidsP ? ', et ce qui est posé dedans aussi' : ''}.`}` })) : null,
      matSection(s, e),
      O.surfOk() ? section('Remplacer',
        h('div', { class: 'p-actions' }, btn('Remplacer par un objet…', async () => { const id = await UI.pick('model', null, `Remplacer « ${e.name} » par un objet`); if (id) O.placeReplace(s.i, id); }, { ic: 'props' })),
        h('p', { class: 'p-note' }, `Un objet de la bibliothèque (ou un de vos modèles .glb) prend sa place : même pied, même rotation, même encombrement. La ${what} est retirée (elle se remet depuis la liste « Décor de la base »).`)) : null,
      kidsSection(e),
      section(e.surf ? 'Surface du décor' : 'Pièce du décor',
        h('div', { class: 'p-actions' },
          btn('Rétablir l’origine', () => O.placeReset([s.i], `Rétablir : ${e.name.toLowerCase()}`), { ic: 'rotate', disabled: !e.edit }),
          btn('Retirer', () => O.remove('place', s.i), { ic: 'trash', title: 'Suppr' })),
        kidsP ? h('p', { class: 'p-note' }, 'Ce qui est posé dedans la suit : déplacé, tourné, mis à l’échelle et retiré avec elle.') : null,
        h('p', { class: 'p-note' }, follows
          ? `Les éléments de jeu posés ${e.surf ? 'contre elle' : 'dedans'} (départ, armes au mur, atouts, boîtes, disjoncteurs, objets…) la suivent quand elle bouge, tourne ou change de taille.`
          : 'Les armes au mur, atouts, boîtes et autres éléments de jeu posés contre elle ne la suivent pas : déplacez-les aussi (la vérification signale une arme restée sans mur).'),
        h('p', { class: 'p-note' }, `Identifiant : ${e.id}${e.edit ? ' · retouchée par cette carte' : ' · d’origine'}`)),
    ];
  }
  /* Atout : taille obtenue sous le plafond (réduite quand il est trop bas). */
  function perkNote(e) {
    const D = ZS.ELIXIRS && ZS.ELIXIRS[e.p];
    if (!D) return null;
    const k = e.k || 1, roomH = e.roomH || 6, sz = Math.min(k, (roomH - 0.05) / D.h);
    return sz < k - 1e-3 ? `Réduit à ×${decFr(sz)} sous ${decFr(roomH)} m de plafond · ${decFr(D.w * sz)} × ${decFr(D.h * sz)} m` : `Machine de ${decFr(D.w * sz)} × ${decFr(D.h * sz)} m (largeur × hauteur)`;
  }
  function moveNum(s, x, z) {
    MT.begin('Déplacer');
    const r = O.moveTo(s, x, z);
    MT.commit();
    if (!r.ok && r.why) MT.toast(r.why, 'warn');
    UI.renderPanel();
  }

  /* ------------------------------------------------------ panneau carte --- */
  OU.mapPanel = () => {
    const m = S.map, r = m.rules;
    const set = (label, fn) => commit(label, 'settings', fn);
    const base = ZS.MAPS_ALL && ZS.MAPS_ALL.byId[m.base];
    let baseThumb = base && base.thumb;
    if (!baseThumb && ZS.ow && ZS.ow.baseThumb) { try { baseThumb = ZS.ow.baseThumb(m.base); } catch (e) { baseThumb = null; } }
    // sans vignette à elle, le menu du jeu montre celle de la base (plan du désert)
    const shown = m.thumb || baseThumb;
    const thumb = h('div', { class: 'map-thumb' }, shown ? h('img', { src: shown, alt: '' }) : h('span', null, 'Pas de vignette'));
    return [
      section('Carte',
        field('Nom', text({ value: m.name, maxLength: 60, onCommit: (v) => set('Nom de la carte', (mm) => { mm.name = v.trim() || mm.name; }) })),
        field('Identifiant', h('span', { class: 'f-inline' }, h('code', null, S.id || m.id), btn('Changer…', () => UI.renameMap())), m.id === m.base ? 'Même identifiant que la carte du jeu : publiée, elle la remplace' : 'Nom du fichier ; sert aussi aux records des joueurs'),
        field('Description', h('textarea', { class: 'f-text', rows: 3, maxLength: 400, value: m.description, onchange: (e) => set('Description', (mm) => { mm.description = e.target.value.slice(0, 400); }) }), 'Affichée sous le nom dans le menu du jeu'),
        field('Surtitre', text({ value: m.eyebrow, maxLength: 80, onCommit: (v) => set('Surtitre', (mm) => { mm.eyebrow = v.trim() || mm.eyebrow; }) }), 'Au-dessus du nom, dans le dossier du menu'),
        field('Consigne', h('textarea', { class: 'f-text', rows: 3, maxLength: 300, value: m.lead, onchange: (e) => set('Consigne', (mm) => { mm.lead = e.target.value.slice(0, 300) || mm.lead; }) }), 'Le but de la partie, dans le dossier du menu'),
        field('Auteur', text({ value: m.author, maxLength: 60, placeholder: 'Votre pseudo', onCommit: (v) => set('Auteur', (mm) => { mm.author = v.trim(); }) })),
        field('Monde', h('span', { class: 'f-hint' }, `${baseName(m)} · ${fmt(m.w / 1000, 1)} × ${fmt(m.h / 1000, 1)} km · ${{
          desert: 'relief, Nil, oasis, routes d’origine et pyramides du jeu, sans les lieux',
          lune: 'relief de la Lune (fosse, crête, cratères), 1/6 g, sans air ni son dehors, oxygène 4 min ; sans les lieux',
          ombre: 'lieux, quête de l’atterrisseur, dépôt et anomalie du jeu ; 1/6 g, sans air ni son dehors, oxygène 4 min',
        }[m.base] || 'relief, routes, lieux, sanctuaire et quête du jeu'}`))),
      section('Règles de la partie',
        field('Points au départ', num({ value: r.startPoints, min: 0, max: 1000000, step: 100, unit: 'pts', digits: 0, onCommit: (v) => set('Points au départ', (mm) => { mm.rules.startPoints = Math.round(v); }) })),
        field('Arme de départ', select({ value: r.startWeapon, options: Object.entries(ZS.WEAPONS).map(([id, w]) => [id, w.name]), onChange: (v) => set('Arme de départ', (mm) => { mm.rules.startWeapon = v; }) })),
        check({ checked: r.powerOn, label: 'Courant allumé dès le départ', onChange: (v) => set('Courant au départ', (mm) => { mm.rules.powerOn = v; }) }),
        O.moon() ? null : field('Tempêtes de sable', select({ value: r.storms, options: [[0, 'Aucune'], ...[2, 3, 4, 5, 6, 8, 10].map((n) => [n, `Toutes les ${n} manches${n === 4 ? ' (Khamsin)' : ''}`])], onChange: (v) => set('Tempêtes', (mm) => { mm.rules.storms = parseInt(v, 10) || 0; }) }), 'Sans tempête : ni Rôdeurs, ni fragments du Sceptre (quête facultative)'),
        field('Armes de la boîte', UI.panels.boxWeapons(r), 'Aucune cochée : toutes les armes habituelles')),
      section('Menu du jeu',
        thumb,
        h('div', { class: 'p-actions' },
          btn('Vignette depuis la vue 3D', () => {
            const hv = MT.v3.helpers.visible;
            MT.v3.helpers.visible = false;
            let url;
            try { url = ZS.capture(MT.v3.cam, 320, 180); } finally { MT.v3.helpers.visible = hv; }
            set('Vignette', (mm) => { mm.thumb = url; });
            MT.toast('Vignette prise depuis la caméra 3D.', 'ok');
          }, { ic: 'camera', disabled: !MT.v3.visible }),
          baseThumb && m.thumb !== baseThumb ? btn('Plan en relief', () => set('Vignette', (mm) => { mm.thumb = baseThumb; })) : null),
        h('div', { class: 'p-actions' },
          btn('Caméra du menu = vue 3D', () => {
            const c = MT.v3.cam, f = new THREE.Vector3(); c.getWorldDirection(f);
            const pos = [round(c.position.x, 2), round(c.position.y, 2), round(c.position.z, 2)];
            const look = [round(c.position.x + f.x * 40, 2), round(c.position.y + f.y * 40, 2), round(c.position.z + f.z * 40, 2)];
            set('Caméra du menu', (mm) => { mm.menuCam = { pos, look, sway: [2, 1] }; });
            MT.toast('Le menu du jeu montrera cette vue (avec un léger balancement).', 'ok');
          }, { ic: 'camera', disabled: !MT.v3.visible }),
          m.menuCam && !m.menuCam.auto ? btn('Automatique', () => set('Caméra du menu', (mm) => { mm.menuCam = null; })) : null),
        h('p', { class: 'p-note' }, m.menuCam && !m.menuCam.auto ? 'Caméra du menu réglée à la main.' : O.moon() ? 'Caméra du menu automatique : au-dessus du dépôt, vers la fosse et la Terre.' : 'Caméra du menu automatique : depuis le camp, vers le plateau des pyramides.')),
    ];
  };

  /* -------------------------------------------------------- barre d'état --- */
  OU.cursor = (p) => {
    if (!p || !ZS.ow.on) return null;
    const y = p.view === '3d' ? p.wy : ZS.ow.ground(p.wx, p.wz);
    return { cell: `x ${Math.round(p.wx)} · z ${Math.round(p.wz)} · h ${fmt(y, 2)} m`, tile: '', zone: O.where(p.wx, p.wz) };
  };
})();
