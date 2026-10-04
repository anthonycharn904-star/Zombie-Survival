'use strict';
/* =========================================================================
   Mod Tools — démarrage, gestion des cartes (atelier, cartes du jeu,
   publication), partie de test, fermeture.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { h, $, slug, fmtDate, deep, clamp } = MT.util;
  const S = MT.state, UI = MT.ui;
  const LAST = 'mt.last';
  const remember = (id) => { try { localStorage.setItem(LAST, id); } catch (e) { /* rien */ } };

  /* --------------------------------------------------- ouvrir une carte -- */
  MT.openWorkspaceMap = async (id) => {
    let map;
    try { map = await MT.readWorkspaceMap(id); } catch (e) { MT.toast(`Carte « ${id} » illisible : ${e.message}`, 'error'); return false; }
    try {
      const rec = await MT.api.readRecovery(id);
      if (rec && rec.text && Date.parse(rec.at) > (Date.parse(map.updated || '') || 0)) {
        const ok = await UI.confirm(`Une copie de secours de « ${map.name} » (${fmtDate(rec.at)}) contient des modifications qui n’ont pas été enregistrées. La reprendre ?`, { ok: 'Reprendre la copie de secours', cancel: 'Ouvrir la version enregistrée', title: 'Copie de secours' });
        if (ok) {
          MT.openMap(ZS.normalizeMap(JSON.parse(rec.text)), { id, source: 'workspace' });
          S.savedRev = -1;
          MT.emit('history');
          remember(id);
          return true;
        }
        await MT.api.writeRecovery(id, null);
      }
    } catch (e) { console.warn('Copie de secours illisible', e); }
    MT.openMap(map, { id, source: 'workspace' });
    remember(id);
    return true;
  };
  MT.openGameMap = (id) => {
    const m = ZS.MAPS.byId[id];
    if (!m) return false;
    MT.openMap(ZS.normalizeMap(deep(ZS.serializeMap(m))), { id, source: 'game' });
    remember(id);
    return true;
  };
  /* Avant de quitter la carte en cours : enregistrer ? */
  MT.confirmLeave = async () => {
    if (!MT.isDirty()) return true;
    const r = await UI.choice(`Enregistrer les modifications de « ${S.map.name} » ?`, [
      { label: 'Annuler', value: null }, { label: 'Ne pas enregistrer', value: 'discard', kind: 'danger' }, { label: 'Enregistrer', value: 'save', kind: 'primary' },
    ], 'Modifications non enregistrées');
    if (!r) return false;
    if (r === 'save') return UI.save();
    try { await MT.api.writeRecovery(S.id || S.map.id, null); } catch (e) { /* rien */ }
    return true;
  };
  async function openAny(id) {
    if (S.known.some((k) => k.id === id)) return MT.openWorkspaceMap(id);
    return MT.openGameMap(id);
  }

  /* ---------------------------------------------------- nouvelle carte -- */
  UI.newMap = async () => {
    if (!(await MT.confirmLeave())) return;
    const nameI = h('input', { type: 'text', class: 'f-text', value: 'Nouvelle carte', maxLength: 60 });
    const wI = h('input', { type: 'number', class: 'f-num', value: 40, min: ZS.MAP_MIN, max: ZS.MAP_MAX });
    const hI = h('input', { type: 'number', class: 'f-num', value: 30, min: ZS.MAP_MIN, max: ZS.MAP_MAX });
    const sources = [['room', 'Une pièce de départ (prête à tester)'], ['empty', 'Terrain vide'], ...[...new Set([...S.known.map((k) => k.id), ...Object.keys(ZS.MAPS.byId)])].map((id) => [`copy:${id}`, `Copie de « ${(S.known.find((k) => k.id === id) || ZS.MAPS.byId[id] || { name: id }).name} »`])];
    const srcS = h('select', { class: 'f-select' }, sources.map(([v, l]) => h('option', { value: v }, l)));
    const sizeRow = h('div', null, UI.f.field('Largeur (x)', wI), UI.f.field('Hauteur (z)', hI));
    srcS.addEventListener('change', () => { sizeRow.hidden = srcS.value.startsWith('copy:'); });
    UI.modal({
      title: 'Nouvelle carte',
      body: h('div', null, UI.f.field('Nom', nameI), UI.f.field('Départ', srcS), sizeRow,
        h('p', { class: 'p-note' }, '1 case = 1 m. Bunker 7 fait 52 × 31. Vous pourrez redimensionner plus tard (onglet Carte).')),
      buttons: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: async () => {
        const name = nameI.value.trim() || 'Nouvelle carte';
        const W = clamp(parseInt(wI.value, 10) || 40, ZS.MAP_MIN, ZS.MAP_MAX), H = clamp(parseInt(hI.value, 10) || 30, ZS.MAP_MIN, ZS.MAP_MAX);
        let map;
        const src = srcS.value;
        if (src.startsWith('copy:')) {
          const from = src.slice(5);
          try { map = S.known.some((k) => k.id === from) ? await MT.readWorkspaceMap(from) : ZS.normalizeMap(deep(ZS.serializeMap(ZS.MAPS.byId[from]))); } catch (e) { MT.toast(e.message, 'error'); return false; }
          map.name = name;
          map.thumb = null;
          map.menuCam = map.menuCam || null;
        } else if (src === 'empty') {
          const grid = Array.from({ length: H }, () => ' '.repeat(W));
          map = ZS.normalizeMap({ id: 'nouvelle', name, grid, spawn: { pos: [W / 2, H / 2], yaw: 0 }, seed: Math.floor(Math.random() * 1e9) });
        } else {
          map = ZS.blankMap(W, H, name);
          map.seed = Math.floor(Math.random() * 1e9);
        }
        const id = MT.uniqueId(slug(name) || 'carte');
        map.id = id;
        map.author = map.author || '';
        map.updated = '';
        MT.openMap(map, { id, source: 'new' });
        MT.setTool(src === 'empty' ? 'build' : 'select');
        if (src === 'empty') { S.opts.build.shape = 'room'; MT.emit('tool-opts'); MT.toast('Glissez dans le plan pour tracer une première pièce.', 'info'); }
        return true;
      } }],
    });
  };

  /* ------------------------------------------------ gestionnaire de cartes -- */
  UI.mapManager = async () => {
    await MT.refreshKnown();
    await MT.loadPublishSet();
    let selected = S.id || null;
    const listBox = h('div', { class: 'mm-list' });
    const detail = h('div', { class: 'mm-detail' });
    const pubBox = h('div', { class: 'mm-pub' });
    const entries = () => {
      const out = new Map();
      for (const k of S.known) out.set(k.id, { id: k.id, name: k.name || k.id, ws: true, game: !!ZS.MAPS.byId[k.id], updated: k.updated, recovery: k.recovery });
      for (const id of Object.keys(ZS.MAPS.byId)) {
        const m = ZS.MAPS.byId[id];
        const e = out.get(id);
        if (e) e.game = true;
        else out.set(id, { id, name: m.name, ws: false, game: true, updated: m.updated, builtin: m.source === 'builtin' });
      }
      return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    };
    const drawList = () => {
      listBox.textContent = '';
      const all = entries();
      const group = (title, items) => {
        if (!items.length) return;
        listBox.append(h('h4', null, title));
        for (const e of items) {
          const inPub = S.publish.maps.includes(e.id);
          listBox.append(h('button', {
            type: 'button', class: `mm-item ${e.id === selected ? 'on' : ''}`, onclick: () => { selected = e.id; drawList(); drawDetail(); },
            ondblclick: async () => { if (e.id === S.id && !MT.isDirty()) { close(); return; } if (await MT.confirmLeave()) { close(); await openAny(e.id); } },
          },
          h('span', { class: 'mm-name' }, e.name, e.id === S.id ? h('em', null, ' · ouverte') : null),
          h('span', { class: 'mm-meta' }, e.id, e.updated ? ` · ${fmtDate(e.updated)}` : ''),
          h('span', { class: 'mm-badges' }, inPub ? h('i', { class: 'b-pub' }, 'Dans le jeu') : null, e.ws && e.game ? h('i', { class: 'b-mod' }, 'Modifiée') : null, e.recovery ? h('i', { class: 'b-rec' }, 'Copie de secours') : null)));
        }
      };
      group('Mon atelier', all.filter((e) => e.ws));
      group('Cartes du jeu installé', all.filter((e) => !e.ws));
    };
    const drawDetail = async () => {
      detail.textContent = '';
      const e = entries().find((x) => x.id === selected);
      if (!e) { detail.append(h('p', { class: 'p-note' }, 'Choisissez une carte à gauche.')); return; }
      let map = null;
      try { map = e.id === S.id ? S.map : e.ws ? await MT.readWorkspaceMap(e.id) : ZS.MAPS.byId[e.id]; } catch (err) { detail.append(h('p', { class: 'p-bad' }, `Carte illisible : ${err.message}`)); }
      if (e.id !== selected) return;
      let v = null;
      try { if (map) v = ZS.validateMap(map); } catch (err) { v = null; }
      const inPub = S.publish.maps.includes(e.id);
      detail.append(
        h('div', { class: 'mm-thumb' }, map && map.thumb ? h('img', { src: map.thumb, alt: '' }) : h('span', null, 'Pas de vignette')),
        h('h3', null, map ? map.name : e.name),
        h('p', { class: 'mm-sub' }, `${e.id}${map ? ` · ${map.w} × ${map.h} · ${map.props.length} objets · ${map.lights.length} lumières` : ''}`),
        map && map.description ? h('p', { class: 'mm-desc' }, map.description) : null,
        h('p', { class: 'mm-src' }, e.ws ? (e.game ? 'Dans votre atelier · remplace la version du jeu à la prochaine publication' : 'Dans votre atelier') : e.builtin ? 'Carte intégrée au jeu (pas encore modifiée)' : 'Carte du jeu installé (pas encore modifiée)'),
        v ? h('p', { class: v.errors.length ? 'p-bad' : 'p-ok' }, v.errors.length ? `${v.errors.length} erreur${v.errors.length > 1 ? 's' : ''} : ${v.errors[0].msg}` : `Jouable${v.warnings.length ? ` · ${v.warnings.length} conseil${v.warnings.length > 1 ? 's' : ''}` : ''}`) : null,
        h('div', { class: 'p-actions' },
          UI.f.btn(e.id === S.id ? 'Déjà ouverte' : 'Ouvrir', async () => { if (e.id === S.id) { close(); return; } if (await MT.confirmLeave()) { close(); await openAny(e.id); } }, { kind: 'primary', disabled: e.id === S.id && !MT.isDirty() && false }),
          UI.f.btn('Dupliquer…', () => duplicate(e, map), { ic: 'copy', disabled: !map }),
          UI.f.btn('Exporter…', () => exportMap(e, map), { ic: 'upload', disabled: !map }),
          e.ws ? UI.f.btn('Supprimer…', () => removeMap(e), { ic: 'trash', kind: 'danger' }) : null),
        h('label', { class: 'f-check mm-pubcheck' }, (() => {
          const c = h('input', { type: 'checkbox', checked: inPub });
          c.addEventListener('change', async () => {
            if (c.checked) {
              if (v && v.errors.length) { c.checked = false; MT.toast(`Carte pas jouable : ${v.errors[0].msg}`, 'error'); return; }
              if (!e.ws && !e.game) { c.checked = false; return; }
              await MT.savePublishSet([...S.publish.maps, e.id]);
            } else {
              if (S.publish.maps.length <= 1) { c.checked = true; MT.toast('Le jeu doit garder au moins une carte.', 'warn'); return; }
              await MT.savePublishSet(S.publish.maps.filter((x) => x !== e.id));
            }
            drawList(); drawPub();
          });
          return c;
        })(), h('i'), h('span', null, 'Dans le jeu : publiée avec la prochaine version')),
      );
    };
    const drawPub = () => {
      pubBox.textContent = '';
      const list = S.publish.maps;
      pubBox.append(h('h4', null, 'Menu du jeu (prochaine publication)'),
        h('p', { class: 'p-note' }, 'Ces cartes seront dans la prochaine version publiée, dans cet ordre. Les joueurs les reçoivent avec la mise à jour du jeu.'));
      const ol = h('ol', { class: 'mm-publist' });
      list.forEach((id, i) => {
        const name = (S.known.find((k) => k.id === id) || ZS.MAPS.byId[id] || { name: id }).name;
        const missing = !S.known.some((k) => k.id === id) && !ZS.MAPS.byId[id];
        ol.append(h('li', { class: missing ? 'missing' : '' }, h('span', null, name, missing ? ' (introuvable)' : ''),
          h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Monter', disabled: i === 0, onclick: async () => { const l = list.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; await MT.savePublishSet(l); drawPub(); } }, UI.icon('up')),
          h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Descendre', disabled: i === list.length - 1, onclick: async () => { const l = list.slice(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; await MT.savePublishSet(l); drawPub(); } }, UI.icon('down'))));
      });
      pubBox.append(ol, h('div', { class: 'p-actions' }, UI.f.btn('Publier une version du jeu…', async () => {
        if (MT.isDirty()) { const ok = await UI.confirm('La carte ouverte a des modifications non enregistrées : elles ne seront pas publiées. Continuer ?', { ok: 'Continuer' }); if (!ok) return; }
        const r = await MT.api.openPublisher();
        if (r === false) MT.toast('Ouvrez l’outil de publication depuis le launcher (réglages → Outil de publication).', 'warn');
      }, { ic: 'upload', kind: 'primary' })));
    };
    const duplicate = async (e, map) => {
      const name = `${map.name} (copie)`;
      const copy = ZS.normalizeMap(deep(ZS.serializeMap(map)));
      copy.id = MT.uniqueId(slug(name));
      copy.name = name;
      try {
        await MT.api.saveMap(copy.id, MT.mapJson(copy));
        await MT.refreshKnown();
        selected = copy.id;
        drawList(); drawDetail();
        MT.toast(`Copie créée : ${name}`, 'ok');
      } catch (err) { MT.toast(`Copie impossible : ${err.message}`, 'error'); }
    };
    const exportMap = async (e, map) => {
      try {
        const src = e.id === S.id ? S.map : map;
        const json = MT.mapJson(ZS.normalizeMap(deep(ZS.serializeMap(src))));
        const r = await MT.api.exportMap(e.id, json);
        if (r) MT.toast(`Carte exportée : ${r}`, 'ok');
      } catch (err) { MT.toast(`Export impossible : ${err.message}`, 'error'); }
    };
    const removeMap = async (e) => {
      const ok = await UI.confirm(`Supprimer « ${e.name} » de votre atelier ? Le fichier est mis à la corbeille de l’atelier${e.game ? ' ; la version du jeu installé reste disponible' : ''}.`, { ok: 'Supprimer', danger: true });
      if (!ok) return;
      try {
        await MT.api.deleteMap(e.id);
        if (S.publish.maps.includes(e.id) && !ZS.MAPS.byId[e.id]) await MT.savePublishSet(S.publish.maps.filter((x) => x !== e.id));
        await MT.refreshKnown();
        if (e.id === S.id) { S.source = e.game ? 'game' : 'new'; S.savedRev = -1; MT.emit('history'); }
        drawList(); drawDetail(); drawPub();
        MT.toast(`Supprimée : ${e.name}`, 'ok');
      } catch (err) { MT.toast(`Suppression impossible : ${err.message}`, 'error'); }
    };
    const importMap = async () => {
      let f;
      try { f = await MT.api.importMap(); } catch (err) { MT.toast(err.message, 'error'); return; }
      if (!f) return;
      let map;
      try { map = ZS.normalizeMap(JSON.parse(f.text)); } catch (err) { MT.toast(`Fichier de carte illisible : ${err.message}`, 'error'); return; }
      if (!(await MT.confirmLeave())) return;
      let id = map.id && map.id !== 'sans-nom' ? map.id : slug(map.name);
      if (S.known.some((k) => k.id === id) || ZS.MAPS.byId[id]) {
        const r = await UI.choice(`Une carte « ${id} » existe déjà.`, [{ label: 'Annuler', value: null }, { label: 'Garder les deux', value: 'both' }, { label: 'Remplacer', value: 'replace', kind: 'danger' }], 'Importer une carte');
        if (!r) return;
        if (r === 'both') id = MT.uniqueId(id);
      }
      map.id = id;
      close();
      MT.openMap(map, { id, source: 'new' });
      MT.toast(`Carte importée : ${map.name} (pensez à l’enregistrer)`, 'ok');
    };
    const close = UI.modal({
      title: 'Cartes', wide: true, cls: 'mm',
      body: h('div', { class: 'mm-root' },
        h('div', { class: 'mm-bar' },
          UI.f.btn('Nouvelle carte…', () => { close(); UI.newMap(); }, { ic: 'plus', kind: 'primary' }),
          UI.f.btn('Importer…', importMap, { ic: 'folder' }),
          MT.api.dev ? null : UI.f.btn('Ouvrir le dossier', () => MT.api.openFolder(), { ic: 'folder', title: 'Dossier de l’atelier dans l’explorateur' })),
        h('div', { class: 'mm-cols' }, listBox, h('div', { class: 'mm-right' }, detail, pubBox))),
    });
    drawList(); drawDetail(); drawPub();
  };

  /* ------------------------------------------------------- partie test -- */
  const saved = {};
  function setGameButtons(test) {
    for (const id of ['btn-quit', 'btn-go-menu']) {
      const b = document.getElementById(id);
      if (!b) continue;
      if (test) { if (!(id in saved)) saved[id] = b.textContent; b.textContent = 'Retour aux Mod Tools'; } else if (id in saved) b.textContent = saved[id];
    }
  }
  MT.test = (fromCam = false) => {
    if (!S.map || ZS.G.state !== 'editor') return;
    if (S.pending) MT.commit();
    MT.validateNow();
    if (S.issues.errors.length) {
      UI.setTab('issues');
      MT.toast(`Impossible de tester : ${S.issues.errors[0].msg}`, 'error');
      return;
    }
    const copy = ZS.normalizeMap(JSON.parse(JSON.stringify(MT.exportMapObject(deep(S.map)))));
    let at = null;
    if (fromCam) {
      const c = MT.v3.cam.position;
      if (MT.tileAt(Math.floor(c.x), Math.floor(c.z)) === '.') at = [c.x, c.z, MT.v3.yaw];
      else MT.toast('La caméra n’est pas au-dessus d’un sol : départ normal.', 'warn');
    }
    MT.v3.setActive(false);
    $('mt').hidden = true;
    document.body.classList.remove('mt-on');
    ZS.setViewCamera(null);
    ZS.setRenderEnabled(true);
    ZS.setViewport(null);
    setGameButtons(true);
    try {
      ZS.playTest(copy, { at });
    } catch (e) {
      console.error(e);
      MT.toast(`Le test a échoué : ${e.message}`, 'error');
      backToEditor();
    }
  };
  function backToEditor() {
    setGameButtons(false);
    try { ZS.Sound.suspend(); } catch (e) { /* rien */ }
    ZS.exitLock();
    ZS.G.state = 'editor';
    ZS.showScreen(null);
    $('mt').hidden = false;
    document.body.classList.add('mt-on');
    MT.v3.worldDirty = true;
    MT.v3.setActive(true);
    UI.layout();
  }

  /* ---------------------------------------------------------- démarrage -- */
  async function start() {
    if (start.done) return;
    start.done = true;
    window.ZSEditor = {
      frame(dt) { MT.v3.frame(dt); MT.plan.frame(); },
      afterRender() {},
      backToEditor,
    };
    UI.build();
    MT.plan.init($('mt-plan'));
    MT.v3.init();
    ZS.G.editorSession = true;
    ZS.G.state = 'editor';
    ZS.showScreen(null);
    MT.v3.setActive(true);
    UI.layout();
    window.addEventListener('error', (e) => { if (ZS.G.state === 'editor' && e.message) MT.toast(`Erreur : ${e.message}`, 'error'); });
    window.addEventListener('unhandledrejection', (e) => { if (ZS.G.state === 'editor') MT.toast(`Erreur : ${e.reason && e.reason.message ? e.reason.message : e.reason}`, 'error'); });
    MT.api.onCloseRequest(() => UI.quit());
    await MT.loadLibrary();
    await MT.loadModelLibrary();
    await MT.refreshKnown();
    await MT.loadPublishSet();
    let last = null;
    try { last = localStorage.getItem(LAST); } catch (e) { last = null; }
    let ok = false;
    if (last && S.known.some((k) => k.id === last)) ok = await MT.openWorkspaceMap(last);
    else if (last && ZS.MAPS.byId[last]) ok = MT.openGameMap(last);
    if (!ok) {
      const first = S.known.find((k) => k.id === ZS.MAPS.list[0]) ? null : ZS.MAPS.list[0];
      if (first) ok = MT.openGameMap(first);
      else if (S.known.length) ok = await MT.openWorkspaceMap(S.known[0].id);
    }
    if (!ok) { MT.openMap(ZS.blankMap(32, 24, 'Nouvelle carte'), { id: MT.uniqueId('nouvelle-carte'), source: 'new' }); }
    UI.layout();
    MT.toast(`Mod Tools prêts · ${S.map.name}`, 'ok');
    document.documentElement.dataset.modtools = 'ready';
  }
  if (window.ZS && window.ZS.ready) start();
  else window.addEventListener('zs:ready', start, { once: true });
})();
