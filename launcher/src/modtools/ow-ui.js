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
  const { field, num, slider, select, check, text, seg, btn, section } = UI.f;
  const commit = (label, kind, fn, detail) => UI.edit.commit(label, kind, fn, detail);
  const ELKINDS = ['wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker'];
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
    else { const e = O.get(s); if (e) { const [x, z] = O.posOf(s.kind, e); p = { x, z, dist: s.kind === 'vehicle' ? 16 : 9 }; } }
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
    return selectPanel();
  };
  function selectPanel() {
    const m = S.map;
    const rows = ELKINDS.map((k) => {
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
    return [
      section('Éléments de la carte', ...rows,
        h('div', { class: 'p-actions' },
          btn('Départ du joueur', () => { MT.select({ kind: 'spawn' }); OU.focusSel(); }, { ic: 'walk' }),
          btn(`Tous les objets (${m.props.length})`, () => { if (m.props.length) MT.select({ kind: 'prop', list: m.props.map((_, i) => i) }); }, { disabled: !m.props.length }))),
      section('Carte ouverte',
        h('p', { class: 'p-note' }, `Relief, routes, bâtiments, sanctuaire et quête viennent du jeu (base : ${baseName(m)}). Vous placez ici les éléments de jeu, les objets de la bibliothèque, le départ et les règles.`),
        h('p', { class: 'p-note' }, 'Plan : molette pour le zoom (de 4 km à quelques mètres), double-clic pour y aller en 3D. 3D : ZQSD/WASD pour voler (Maj : très vite), molette pour avancer vers le curseur.')),
    ];
  }
  const baseName = (m) => (m.base === 'khamsin' ? 'Khamsin' : m.base);

  function elementsPanel() {
    const o = S.opts.ow;
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
      case 'breaker': opts.push(faceRow(), count('breaker'), h('p', { class: 'p-note' }, 'Le courant revient quand tous les disjoncteurs de la carte sont enclenchés (F maintenue 4 s chacun). Aucun disjoncteur : cochez « Courant allumé dès le départ » (onglet Carte), sinon atouts électriques, sanctuaire et batterie de l’avion restent sans courant.')); break;
      default: break;
    }
    return [section('Élément', kinds, h('p', { class: 'p-note' }, O.HELP[o.kind])), opts.length ? section('Réglages', ...opts) : null];
  }

  /* ------------------------------------------------- panneau sélection --- */
  OU.inspector = () => {
    const s = S.sel, m = S.map;
    if (!s) {
      return [h('div', { class: 'p-empty' },
        h('p', null, 'Rien de sélectionné.'),
        h('p', { class: 'p-note' }, 'Outil Sélection (V) : cliquez sur une arme, un atout, une boîte, un véhicule, un objet… dans le plan ou en 3D.'))];
    }
    if (s.kind === 'prop') return s.list.length > 1 ? UI.panels.propsMulti(s.list) : UI.panels.propInspector(s.list[0]);
    const e = O.get(s);
    if (!e) return [];
    const set = (label, fn) => commit(label, 'ow-el', (mm) => fn(O.get(s, mm)));
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
          def ? h('p', { class: 'p-note' }, def.desc) : null)];
      }
      case 'box': return [head('Emplacement de la boîte mystère', `n° ${s.i + 1} sur ${m.boxes.length}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        check({ checked: m.boxStart === s.i, label: 'La boîte commence ici', onChange: (v) => { if (v) commit('Départ de la boîte', 'ow-el', (mm) => { mm.boxStart = s.i; }); } }),
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME(e.face)), rotBtn('Tourner'))),
        h('p', { class: 'p-note' }, 'La boîte part ailleurs après quelques tirages (ours en peluche) : sur un désert de 4 × 3 km, répartissez les emplacements entre les lieux.'))];
      case 'vehicle': {
        const T = ZS.VEH_TYPES[e.type];
        return [head(T ? T.name : e.type, `x ${fmt(e.x)} · z ${fmt(e.z)}${where(e.x, e.z)}`, [h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Dupliquer (Ctrl+D)', onclick: () => MT.duplicateSelection() }, UI.icon('copy')), delBtn()]), section('Réglages',
          field('Véhicule', select({ value: e.type, options: vehOptions(), onChange: (v) => set('Véhicule', (x) => { x.type = v; }) })),
          field('Cap', num({ value: degOf(e.yaw), min: 0, max: 360, step: 15, unit: '°', digits: 1, onCommit: (v) => set('Cap du véhicule', (x) => { x.yaw = round(wrapRad(rad(v)), 4); }) }), 'R : +15° · Maj+R : +90°'),
          T ? h('p', { class: 'p-note' }, `${fmt(T.len, 1)} × ${fmt(T.wid, 1)} m · réservoir ${Math.round(T.fuel / 1000)} km${T.cost ? ` · à acheter (${T.cost} pts)` : ''}${e.type === 'truck' ? ' · démarre avec le courant' : ''}.`) : null)];
      }
      case 'fuel': return [head('Jerricans', `n° ${s.i + 1} sur ${m.fuel.length}${where(e.x, e.z)}`, [delBtn()]), section('Infos', h('p', { class: 'p-note' }, 'Font le plein du véhicule le plus proche (à moins de 14 m) quand on appuie sur F.'))];
      case 'breaker': return [head('Disjoncteur', `${s.i + 1} sur ${m.breakers.length} · face ${FACE_NAME([e.nx, e.nz])}${where(e.x, e.z)}`, [delBtn()]), section('Réglages',
        field('Nom', text({ value: e.name, maxLength: 40, onCommit: (v) => set('Nom du disjoncteur', (x) => { x.name = v.trim().slice(0, 40) || x.name; }) }), 'Affiché quand on le vise : « Maintenez F pour enclencher le disjoncteur (…) »'),
        field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, FACE_NAME([e.nx, e.nz])), rotBtn())),
        h('p', { class: 'p-note' }, `Tous enclenchés (${m.breakers.length}) : le courant revient (atouts, sanctuaire, batterie de l’avion, camion blindé).`))];
      default: return [];
    }
  };
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
    const thumb = h('div', { class: 'map-thumb' }, m.thumb ? h('img', { src: m.thumb, alt: '' }) : h('span', null, 'Pas de vignette'));
    const base = ZS.MAPS_ALL && ZS.MAPS_ALL.byId[m.base];
    const baseThumb = base && base.thumb;
    return [
      section('Carte',
        field('Nom', text({ value: m.name, maxLength: 60, onCommit: (v) => set('Nom de la carte', (mm) => { mm.name = v.trim() || mm.name; }) })),
        field('Identifiant', h('span', { class: 'f-inline' }, h('code', null, S.id || m.id), btn('Changer…', () => UI.renameMap())), m.id === m.base ? 'Même identifiant que la carte du jeu : publiée, elle la remplace' : 'Nom du fichier ; sert aussi aux records des joueurs'),
        field('Description', h('textarea', { class: 'f-text', rows: 3, maxLength: 400, value: m.description, onchange: (e) => set('Description', (mm) => { mm.description = e.target.value.slice(0, 400); }) }), 'Affichée sous le nom dans le menu du jeu'),
        field('Surtitre', text({ value: m.eyebrow, maxLength: 80, onCommit: (v) => set('Surtitre', (mm) => { mm.eyebrow = v.trim() || mm.eyebrow; }) }), 'Au-dessus du nom, dans le dossier du menu'),
        field('Consigne', h('textarea', { class: 'f-text', rows: 3, maxLength: 300, value: m.lead, onchange: (e) => set('Consigne', (mm) => { mm.lead = e.target.value.slice(0, 300) || mm.lead; }) }), 'Le but de la partie, dans le dossier du menu'),
        field('Auteur', text({ value: m.author, maxLength: 60, placeholder: 'Votre pseudo', onCommit: (v) => set('Auteur', (mm) => { mm.author = v.trim(); }) })),
        field('Monde', h('span', { class: 'f-hint' }, `${baseName(m)} · ${fmt(m.w / 1000, 1)} × ${fmt(m.h / 1000, 1)} km · relief, routes, lieux, sanctuaire et quête du jeu`))),
      section('Règles de la partie',
        field('Points au départ', num({ value: r.startPoints, min: 0, max: 1000000, step: 100, unit: 'pts', digits: 0, onCommit: (v) => set('Points au départ', (mm) => { mm.rules.startPoints = Math.round(v); }) })),
        field('Arme de départ', select({ value: r.startWeapon, options: Object.entries(ZS.WEAPONS).map(([id, w]) => [id, w.name]), onChange: (v) => set('Arme de départ', (mm) => { mm.rules.startWeapon = v; }) })),
        check({ checked: r.powerOn, label: 'Courant allumé dès le départ', onChange: (v) => set('Courant au départ', (mm) => { mm.rules.powerOn = v; }) }),
        field('Tempêtes de sable', select({ value: r.storms, options: [[0, 'Aucune'], ...[2, 3, 4, 5, 6, 8, 10].map((n) => [n, `Toutes les ${n} manches${n === 4 ? ' (Khamsin)' : ''}`])], onChange: (v) => set('Tempêtes', (mm) => { mm.rules.storms = parseInt(v, 10) || 0; }) }), 'Sans tempête : ni Rôdeurs, ni fragments du Sceptre (quête facultative)'),
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
        h('p', { class: 'p-note' }, m.menuCam && !m.menuCam.auto ? 'Caméra du menu réglée à la main.' : 'Caméra du menu automatique : depuis le camp, vers le plateau des pyramides.')),
    ];
  };

  /* -------------------------------------------------------- barre d'état --- */
  OU.cursor = (p) => {
    if (!p || !ZS.ow.on) return null;
    const y = p.view === '3d' ? p.wy : ZS.ow.ground(p.wx, p.wz);
    return { cell: `x ${Math.round(p.wx)} · z ${Math.round(p.wz)} · h ${fmt(y, 2)} m`, tile: '', zone: O.where(p.wx, p.wz) };
  };
})();
