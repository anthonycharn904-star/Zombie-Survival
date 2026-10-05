'use strict';
/* Interface du launcher : affiche l'état envoyé par le processus principal
   (window.zs, voir preload/launcher.js) et déclenche les actions. */
const $ = (id) => document.getElementById(id);
const NB = ' ';

/* ---------------------------------------------------------- formats --- */
const num1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function fmtSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}${NB}Ko`;
  return `${num1.format(bytes / 1048576)}${NB}Mo`;
}
function fmtDate(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? dateFmt.format(t) : (value || '');
}
function fmtEta(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return `environ ${Math.max(1, Math.round(sec))}${NB}s`;
  return `environ ${Math.round(sec / 60)}${NB}min`;
}
function parseV(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ''));
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function newer(a, b) {
  const x = parseV(a), y = parseV(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
/* Une note par ligne : le tiret ou la puce tapés en tête de ligne font double emploi avec la puce de la liste. */
function cleanNote(n) { return String(n).replace(/^\s*[-–—•*]+\s*/, ''); }
const plural = (n, word) => `${n}${NB}${word}${n > 1 ? 's' : ''}`;
function describeSource(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest\/download\/latest\.json$/i.exec(url || '');
  if (m) return { main: `github.com/${m[1]}/${m[2]}`, sub: 'Dernière release publiée sur GitHub' };
  if (/^file:/i.test(url || '')) {
    let p = url;
    try { p = decodeURIComponent(new URL(url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); } catch (e) { /* adresse brute */ }
    return { main: p, sub: 'Dossier local (test)' };
  }
  return { main: url || '—', sub: '' };
}

/* ------------------------------------------------- vitesse / ETA --- */
const rate = { target: null, t: 0, bytes: 0, bps: 0 };
function trackRate(p) {
  const now = performance.now();
  const key = `${p.phase}:${p.target}`;
  if (rate.target !== key || p.received < rate.bytes) {
    Object.assign(rate, { target: key, t: now, bytes: p.received, bps: 0 });
    return;
  }
  const dt = (now - rate.t) / 1000;
  if (dt < 0.25) return;
  const inst = (p.received - rate.bytes) / dt;
  rate.bps = rate.bps ? rate.bps * 0.7 + inst * 0.3 : inst;
  rate.t = now;
  rate.bytes = p.received;
}

/* ------------------------------------------------------------- état --- */
let current = null;
let mainAction = null;
let linkActions = [null, null];
let pending = false;

function setLink(i, label, action) {
  const el = $(i === 0 ? 'link-a' : 'link-b');
  el.hidden = !label;
  el.textContent = label || '';
  linkActions[i] = action || null;
}
function setMain(label, { kind = 'play', disabled = false, action = null, progress = null } = {}) {
  const b = $('btn-main');
  $('btn-main-label').textContent = label;
  b.dataset.kind = kind;
  b.disabled = disabled || pending;
  b.style.setProperty('--p', progress == null ? 0 : Math.max(0, Math.min(100, progress)));
  mainAction = action;
}
function setProgress(value) {
  const box = $('progress'), bar = $('progress-bar');
  if (value === null || value === undefined) { box.hidden = true; return; }
  box.hidden = false;
  box.classList.toggle('indeterminate', value === 'indeterminate');
  if (value !== 'indeterminate') bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function render(s) {
  current = s;
  pending = false;
  const inst = s.installed;
  const rem = s.remote;
  const err = s.error;
  const hasUpdate = !!(inst && rem && !rem.cached && newer(rem.version, inst.version));
  let tone = 'idle', title = '', detail = '';
  setLink(0, null); setLink(1, null);
  setProgress(null);

  switch (s.phase) {
    case 'starting':
      title = 'Ouverture du bunker…';
      setMain('Jouer', { disabled: true });
      break;
    case 'checking':
      tone = 'busy'; title = 'Vérification';
      detail = 'Recherche de mises à jour…';
      setProgress('indeterminate');
      if (inst) setMain('Jouer', { action: () => window.zs.play() });
      else setMain('Jouer', { disabled: true });
      break;
    case 'ready':
      tone = 'ok'; title = 'Prêt';
      detail = inst ? `Version ${inst.version} installée · à jour` : '';
      setMain('Jouer', { action: () => window.zs.play() });
      break;
    case 'update':
      tone = 'update'; title = 'Mise à jour disponible';
      detail = rem ? `Version ${inst ? inst.version : '—'} → ${rem.version}${rem.size ? ` · ${fmtSize(rem.size)}` : ''}` : '';
      setMain('Mettre à jour', { kind: 'update', action: () => window.zs.install() });
      if (inst) setLink(0, `Jouer à la ${inst.version}`, () => window.zs.play());
      break;
    case 'downloading': {
      const p = s.progress || { received: 0, total: 0 };
      const launcher = p.phase === 'launcher';
      tone = 'busy'; title = launcher ? 'Téléchargement du launcher' : 'Téléchargement';
      trackRate(p);
      const pct = p.total ? (p.received / p.total) * 100 : 0;
      const parts = [`${fmtSize(p.received)} sur ${fmtSize(p.total)}`];
      if (rate.bps > 0) parts.push(`${fmtSize(rate.bps)}/s`, fmtEta((p.total - p.received) / rate.bps));
      detail = parts.filter(Boolean).join(' · ');
      setProgress(pct);
      setMain(`${Math.floor(pct)}${NB}%`, { kind: 'progress', disabled: true, progress: pct });
      setLink(0, 'Annuler', () => window.zs.cancel());
      break;
    }
    case 'installing':
      tone = 'busy'; title = 'Installation';
      detail = s.progress && s.progress.target ? `Version ${s.progress.target} : vérification et extraction…` : 'Remise en état du jeu…';
      setProgress('indeterminate');
      setMain('Installation', { kind: 'progress', disabled: true, progress: 100 });
      break;
    case 'restarting':
      tone = 'busy'; title = 'Redémarrage';
      detail = 'Installation du nouveau launcher…';
      setProgress('indeterminate');
      setMain('Redémarrage', { disabled: true });
      break;
    case 'playing':
      tone = 'ok'; title = 'Partie en cours';
      detail = inst ? `Version ${inst.version}` : '';
      setMain('En jeu', { disabled: true });
      break;
    case 'offline':
      if (err && err.code === 'NOT_CONFIGURED') {
        title = 'Mises à jour inactives';
        detail = `Adresse de publication provisoire · version ${inst ? inst.version : '—'} jouable`;
      } else {
        title = 'Hors ligne';
        detail = `${err ? err.message : 'Serveur de mises à jour injoignable.'} Version ${inst ? inst.version : '—'} jouable.`;
        setLink(0, 'Réessayer', () => window.zs.check());
      }
      setMain('Jouer', { disabled: !inst, action: () => window.zs.play() });
      break;
    case 'error':
    default: {
      tone = 'error'; title = 'Erreur';
      detail = err ? err.message : 'Erreur inconnue.';
      if (inst) {
        setMain('Jouer', { action: () => window.zs.play() });
        const ctx = err && err.context;
        if (ctx === 'install') setLink(0, 'Réessayer', () => window.zs.install());
        else if (ctx === 'launcher') setLink(0, 'Réessayer', () => window.zs.updateLauncher());
        else if (ctx === 'check') setLink(0, 'Réessayer', () => window.zs.check());
      } else {
        setMain('Réparer', { kind: 'repair', action: () => window.zs.repair() });
      }
      setLink(1, 'Ouvrir le journal', () => window.zs.open('logs'));
    }
  }

  const st = $('status');
  st.dataset.tone = tone;
  $('status-title').textContent = title;
  $('status-detail').textContent = detail;
  $('status-detail').title = detail;

  // versions
  $('chip-game').textContent = inst ? `Jeu ${inst.version}` : 'Jeu non installé';
  $('chip-launcher').textContent = `Launcher ${s.launcherVersion}`;
  $('chip-game').classList.toggle('hot', hasUpdate);
  if (hasUpdate) $('chip-game').textContent = `Jeu ${inst.version} → ${rem.version}`;

  $('btn-modtools').hidden = !s.author;
  $('btn-modtools').disabled = !inst || ['downloading', 'installing', 'restarting'].includes(s.phase);

  renderNotes(s, hasUpdate);
  renderNews(s.news || []);
  renderBanner(s);
  renderDrawer(s);
}

function renderNotes(s, hasUpdate) {
  const inst = s.installed, rem = s.remote;
  const list = $('notes-list');
  list.textContent = '';
  const add = (text, cls) => { const li = document.createElement('li'); li.textContent = cls ? text : cleanNote(text); if (cls) li.className = cls; list.append(li); };
  const heading = (text) => { const h = document.createElement('h4'); h.textContent = text; list.append(h); };
  // notes publiées de la version installée (historique) : elles passent avant la note
  // « Version livrée avec le launcher » d'un jeu installé depuis l'installateur
  const published = inst && (s.history || []).find((e) => e.version === inst.version && e.notes.length);
  const instNotes = published ? published.notes : (inst && inst.notes) || [];
  if (hasUpdate) {
    $('notes-stamp').textContent = `v${rem.version}`;
    $('notes-meta').textContent = `Nouvelle version${rem.date ? ` du ${fmtDate(rem.date)}` : ''} · installée${NB}: ${inst.version}`;
    (rem.notes && rem.notes.length ? rem.notes : ['Aucune note pour cette version.']).forEach((n) => add(n));
    if (instNotes.length) {
      heading(`Version ${inst.version}`);
      instNotes.forEach((n) => add(n));
    }
  } else if (inst) {
    $('notes-stamp').textContent = `v${inst.version}`;
    $('notes-meta').textContent = `Version installée${inst.installedAt ? ` le ${fmtDate(inst.installedAt)}` : ''}`;
    if (instNotes.length) instNotes.forEach((n) => add(n));
    else add('Aucune note pour cette version.', 'empty');
  } else {
    $('notes-stamp').textContent = '—';
    $('notes-meta').textContent = 'Aucune version installée';
    add('Le jeu sera installé dès que le serveur de mises à jour sera joignable.', 'empty');
  }
  // la fiche ouvre l'historique de toutes les versions publiées
  const count = (s.history || []).length;
  const d = $('dossier');
  d.classList.toggle('clickable', count > 0);
  $('notes-more').hidden = count === 0;
  $('notes-count').textContent = plural(count, 'version');
  if (count > 0) { d.setAttribute('role', 'button'); d.tabIndex = 0; } else { d.removeAttribute('role'); d.removeAttribute('tabindex'); }
  if (hist.open) renderHistory(false);
}

/* ------------------------------------------ historique des mises à jour --- */
const hist = { open: false, sel: null, key: '' };
const historyEntries = () => (current && current.history) || [];
function badgeOf(version) {
  const inst = current && current.installed, rem = current && current.remote;
  if (inst && version === inst.version) return { cls: 'installed', text: 'Installée' };
  if (inst && rem && !rem.cached && version === rem.version && newer(rem.version, inst.version)) return { cls: 'new', text: 'Nouvelle' };
  return null;
}
function openHistory() {
  const list = historyEntries();
  if (!list.length || hist.open) return;
  if ($('drawer').classList.contains('open')) openDrawer(false, false);
  const inst = current && current.installed;
  hist.sel = inst && list.some((e) => e.version === inst.version) ? inst.version : list[0].version;
  hist.open = true;
  hist.key = '';
  $('history').hidden = false;
  $('veil').hidden = false;
  $('content').inert = true;
  $('dock').inert = true;
  renderHistory(false);
  const b = $('history-list').querySelector('[aria-selected="true"]');
  if (b) { b.focus(); b.scrollIntoView({ block: 'nearest' }); }
}
function closeHistory() {
  if (!hist.open) return;
  hist.open = false;
  $('history').hidden = true;
  $('veil').hidden = true;
  $('content').inert = false;
  $('dock').inert = false;
  $('dossier').focus();
}
/* Liste des versions (reconstruite seulement si les versions ou leurs états changent : l'état du
   launcher est renvoyé plusieurs fois par seconde pendant un téléchargement). */
function renderHistory(swap) {
  const list = historyEntries();
  if (!list.some((e) => e.version === hist.sel)) hist.sel = list.length ? list[0].version : null;
  const key = JSON.stringify([list, list.map((e) => badgeOf(e.version)), hist.sel]);
  if (key === hist.key) return;
  hist.key = key;
  const hadFocus = $('history-list').contains(document.activeElement);
  $('history-count').textContent = plural(list.length, 'version');
  const ol = $('history-list');
  ol.textContent = '';
  for (const e of list) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hl-item';
    b.setAttribute('role', 'option');
    b.dataset.version = e.version;
    const v = document.createElement('span'); v.className = 'hl-v'; v.textContent = `v${e.version}`;
    b.append(v);
    const badge = badgeOf(e.version);
    if (badge) { const t = document.createElement('span'); t.className = `hl-badge ${badge.cls}`; t.textContent = badge.text; b.append(t); }
    const d = document.createElement('span'); d.className = 'hl-date';
    d.textContent = `${e.date ? fmtDate(e.date) : 'Date inconnue'} · ${plural(e.notes.length, 'note')}`;
    b.append(d);
    li.append(b);
    ol.append(li);
  }
  markSelected(hadFocus);
  renderSheet(swap);
}
function markSelected(focus) {
  for (const b of $('history-list').querySelectorAll('.hl-item')) {
    const on = b.dataset.version === hist.sel;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) { b.focus(); b.scrollIntoView({ block: 'nearest' }); }
  }
}
function renderSheet(swap) {
  const e = historyEntries().find((x) => x.version === hist.sel);
  const ul = $('hs-notes');
  ul.textContent = '';
  if (!e) return;
  $('hs-stamp').textContent = `v${e.version}`;
  const badge = badgeOf(e.version);
  const parts = [e.date ? `Publiée le ${fmtDate(e.date)}` : 'Date de publication inconnue'];
  if (badge) parts.push(badge.cls === 'installed' ? 'version installée' : 'pas encore installée');
  $('hs-meta').textContent = parts.join(' · ');
  const add = (text, cls) => { const li = document.createElement('li'); li.textContent = text; if (cls) li.className = cls; ul.append(li); };
  if (e.notes.length) e.notes.forEach((n) => add(cleanNote(n)));
  else add('Aucune note pour cette version.', 'empty');
  ul.scrollTop = 0;
  if (swap) {
    const sheet = $('history-sheet');
    sheet.classList.remove('swap');
    void sheet.offsetWidth;
    sheet.classList.add('swap');
  }
}
function selectHistory(version, focus) {
  if (!version) return;
  const changed = version !== hist.sel;
  hist.sel = version;
  markSelected(focus);
  if (changed) { hist.key = JSON.stringify([historyEntries(), historyEntries().map((e) => badgeOf(e.version)), hist.sel]); renderSheet(true); }
}

function renderNews(news) {
  const box = $('news'), list = $('news-list');
  box.hidden = !news.length;
  list.textContent = '';
  for (const n of news.slice(0, 6)) {
    const li = document.createElement('li');
    if (n.date) { const t = document.createElement('time'); t.textContent = fmtDate(n.date); li.append(t); }
    const strong = document.createElement('strong'); strong.textContent = n.title; li.append(strong);
    if (n.text) { const p = document.createElement('p'); p.textContent = n.text; li.append(p); }
    list.append(li);
  }
}

function renderBanner(s) {
  const show = !!s.launcherUpdate && !['downloading', 'installing', 'restarting', 'playing'].includes(s.phase);
  $('launcher-banner').hidden = !show;
  if (show) {
    $('lu-version').textContent = s.launcherUpdate.version;
    $('lu-install').disabled = s.phase === 'checking';
    const notes = (s.launcherUpdate.notes || []).join('\n');
    $('launcher-banner').title = notes;
  }
}

function renderDrawer(s) {
  const set = s.settings || {};
  for (const k of ['fullscreen', 'keepLauncherOpen', 'autoCheck', 'autoInstall']) {
    const el = $(`set-${k}`);
    if (el && document.activeElement !== el) el.checked = !!set[k];
  }
  $('set-autoInstall').disabled = !set.autoCheck;
  const busy = ['checking', 'downloading', 'installing', 'restarting', 'playing', 'starting'].includes(s.phase);
  $('act-check').disabled = busy;
  $('act-repair').disabled = busy;
  const inst = s.installed;
  const rb = $('act-rollback');
  rb.hidden = !(inst && inst.previous);
  rb.disabled = busy;
  if (inst && inst.previous) rb.textContent = `Revenir à la ${inst.previous}`;
  $('act-folder').disabled = !inst;
  const src = s.source || {};
  const desc = describeSource(src.url);
  $('source-url').textContent = desc.main;
  $('source-url').title = src.url || '';
  $('source-sub').textContent = desc.sub;
  $('source-sub').hidden = !desc.sub;
  $('source-key').textContent = src.keyFingerprint || 'aucune';
  $('source-custom').hidden = !src.custom;
  $('source-reset-row').hidden = !src.custom;
  $('act-reset-source').disabled = busy;
  $('source-placeholder').hidden = !!src.configured || !!src.custom;
  $('versions-line').textContent = `Launcher ${s.launcherVersion}${inst ? ` · jeu ${inst.version}` : ''}`;
}

/* ---------------------------------------------------------- tiroir --- */
function openDrawer(open, restoreFocus = true) {
  if (open && hist.open) closeHistory();
  const d = $('drawer');
  d.classList.toggle('open', open);
  d.inert = !open;
  $('veil').hidden = !open;
  $('content').inert = open;
  $('btn-settings').setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => $('drawer-close').focus(), 60);
  else if (restoreFocus) $('btn-settings').focus();
}

/* ----------------------------------------------------------- toast --- */
let toastTimer = 0;
function toast(html) {
  const t = $('toast');
  t.textContent = '';
  t.append(...html);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}

/* ---------------------------------------------------------- actions --- */
function guard(fn) {
  return async () => {
    try { await fn(); } catch (e) { console.error(e); }
  };
}
function bind() {
  $('win-min').addEventListener('click', () => window.zs.windowAction('minimize'));
  $('win-close').addEventListener('click', () => window.zs.windowAction('close'));
  $('btn-main').addEventListener('click', guard(async () => {
    if (!mainAction || pending) return;
    const action = mainAction;
    pending = true;
    $('btn-main').disabled = true;
    setTimeout(() => { if (pending && current) render(current); }, 1500);
    await action();
  }));
  $('link-a').addEventListener('click', guard(() => linkActions[0] && linkActions[0]()));
  $('link-b').addEventListener('click', guard(() => linkActions[1] && linkActions[1]()));
  $('lu-install').addEventListener('click', guard(() => window.zs.updateLauncher()));
  $('btn-folder').addEventListener('click', guard(() => window.zs.open('game')));
  $('btn-settings').addEventListener('click', () => openDrawer(!$('drawer').classList.contains('open')));
  $('drawer-close').addEventListener('click', () => openDrawer(false));
  $('veil').addEventListener('click', () => { if (hist.open) closeHistory(); else openDrawer(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (hist.open) closeHistory();
    else if ($('drawer').classList.contains('open')) openDrawer(false);
  });
  // fiche des notes : ouvre l'historique (sauf clic sur la barre de défilement des notes)
  $('dossier').addEventListener('click', (e) => {
    const sc = $('notes-list');
    if (e.target === sc && e.offsetX >= sc.clientWidth) return;
    if ($('dossier').classList.contains('clickable')) openHistory();
  });
  $('dossier').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === $('dossier') && $('dossier').classList.contains('clickable')) { e.preventDefault(); openHistory(); }
  });
  $('history-close').addEventListener('click', closeHistory);
  $('history-list').addEventListener('click', (e) => {
    const b = e.target.closest('.hl-item');
    if (b) selectHistory(b.dataset.version, true);
  });
  $('history-list').addEventListener('keydown', (e) => {
    const list = historyEntries();
    const i = list.findIndex((x) => x.version === hist.sel);
    let j = -1;
    if (e.key === 'ArrowDown') j = Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    else return;
    e.preventDefault();
    if (j >= 0) selectHistory(list[j].version, true);
  });
  for (const k of ['fullscreen', 'keepLauncherOpen', 'autoCheck', 'autoInstall']) {
    $(`set-${k}`).addEventListener('change', guard(() => window.zs.setSetting(k, $(`set-${k}`).checked)));
  }
  $('act-check').addEventListener('click', guard(() => window.zs.check()));
  $('act-repair').addEventListener('click', guard(() => window.zs.repair()));
  $('act-rollback').addEventListener('click', guard(() => window.zs.rollback()));
  $('act-folder').addEventListener('click', guard(() => window.zs.open('game')));
  $('act-logs').addEventListener('click', guard(() => window.zs.open('logs')));
  $('act-reset-source').addEventListener('click', guard(() => window.zs.resetSource()));
  $('act-publisher').addEventListener('click', guard(() => window.zs.openPublisher()));
  $('btn-modtools').addEventListener('click', async () => {
    try { await window.zs.openModtools(); } catch (e) {
      const b = document.createElement('b');
      b.textContent = String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      toast([b]);
    }
  });
  // Pas de menu contextuel ni de glisser-déposer de fichiers dans le launcher.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}

bind();
window.zs.onStatus(render);
window.zs.status().then((s) => {
  render(s);
  if (s.justUpdated) {
    const b = document.createElement('b');
    b.textContent = `Launcher mis à jour${NB}: version ${s.justUpdated}`;
    toast([b]);
  }
}).catch((e) => console.error(e));
