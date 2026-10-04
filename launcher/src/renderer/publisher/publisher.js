'use strict';
/* Outil de publication (fenêtre auteur) : window.pub, voir preload/publisher.js. */
const $ = (id) => document.getElementById(id);
const VERSION_RE = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;
const REPO_RE = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const num1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

let st = null;          // état renvoyé par pub:state
let gameSource = '';
let detectedVersion = null;
let setupPath = '';
let lastResult = null;
let versionTouched = false;

function fmtSize(b) {
  if (!Number.isFinite(b)) return '';
  return b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${num1.format(b / 1048576)} Mo`;
}
function parseV(v) { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; }
function cmp(a, b) {
  const x = parseV(a), y = parseV(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
let toastTimer = 0;
function toast(text) {
  $('toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 5000);
}
function showError(e) {
  const msg = String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  $('form-error').textContent = msg;
  $('form-error').hidden = false;
}
function clearError() { $('form-error').hidden = true; }
async function call(fn) {
  clearError();
  try { return await fn(); } catch (e) { showError(e); return undefined; }
}

/* --------------------------------------------------------- rendu --- */
function renderKey() {
  $('key-none').hidden = st.hasKey;
  $('key-some').hidden = !st.hasKey;
  if (!st.hasKey) return;
  $('key-fp').textContent = st.fingerprint;
  $('key-match').hidden = !st.keyMatchesLauncher;
  $('key-mismatch').hidden = st.keyMatchesLauncher;
  if (!st.keyMatchesLauncher) {
    $('key-mismatch').textContent = st.launcherFingerprint
      ? `Ce launcher fait confiance à une autre clé (${st.launcherFingerprint}) : les joueurs refuseront vos publications tant que le launcher n'est pas recompilé avec votre clé publique (bouton « Copier la clé publique »). « Tester avec ce launcher » fonctionne quand même.`
      : 'Launcher provisoire, sans clé de confiance : les joueurs recevront vos mises à jour avec un launcher compilé avec votre clé publique (bouton « Copier la clé publique »). « Tester avec ce launcher » fonctionne déjà.';
  }
  $('key-storage').textContent = st.encrypted
    ? 'Clé chiffrée par Windows pour votre session. Gardez une sauvegarde hors de ce PC (clé USB, gestionnaire de mots de passe).'
    : 'Clé enregistrée sans chiffrement sur ce PC. Gardez une sauvegarde hors de ce PC.';
}
function renderGame() {
  const inst = st.installed;
  const useInst = gameSource === 'installed';
  $('src-installed').disabled = !inst;
  $('src-installed').checked = useInst;
  $('src-html').checked = !useInst;
  $('src-inst-version').textContent = inst ? `(${inst.version})` : '(aucun)';
  $('html-field').hidden = useInst;
  $('game-path').textContent = !useInst && gameSource ? gameSource : 'Aucun fichier choisi';
  $('game-detected').textContent = !useInst && detectedVersion ? `Version inscrite dans le fichier : ${detectedVersion}` : '';
  const older = !useInst && inst && detectedVersion && cmp(detectedVersion, inst.version) < 0;
  $('game-older').hidden = !older;
  if (older) $('game-older').textContent = `Ce fichier contient un jeu plus ancien (${detectedVersion}) que le jeu installé (${inst.version}) : le publier remettrait un ancien jeu chez les joueurs. Choisissez plutôt « Le jeu installé ».`;
  $('game-last').textContent = st.lastGameVersion ? `Dernière version publiée : ${st.lastGameVersion}` : `Aucune publication depuis ce PC pour l’instant${inst ? ` (jeu installé : ${inst.version})` : ''}.`;
  if (!versionTouched) {
    let v = st.suggestedVersion;
    if (detectedVersion && cmp(detectedVersion, v) > 0) v = detectedVersion;
    $('game-version').value = v;
  }
}
function renderLauncher() {
  const last = st.lastLauncher;
  $('launcher-last').textContent = last
    ? `Dernier launcher annoncé : ${last.version}. Il reste annoncé dans les prochaines publications tant que vous n'en joignez pas un nouveau.`
    : `Ce launcher est en version ${st.launcherVersion}. Joignez un installateur seulement si vous avez recompilé le launcher.`;
  $('setup-path').textContent = setupPath || 'Aucun · le launcher actuel reste annoncé';
  $('setup-clear').hidden = !setupPath;
  $('setup-fields').hidden = !setupPath;
}
function renderOnline() {
  const g = st.github || {};
  $('gh-linked').hidden = !g.linked;
  $('gh-unlinked').hidden = !!g.linked;
  if (g.linked) $('gh-linked-text').textContent = `Relié à GitHub : ${g.repo || st.repo || '—'}${g.login ? ` (compte ${g.login})` : ''}.${g.encrypted ? '' : ' Jeton enregistré sans chiffrement.'}`;
  $('publish-online').hidden = !g.linked;
  const create = $('create');
  create.classList.toggle('secondary', !!g.linked);
  create.textContent = g.linked ? 'Créer seulement (test sur ce PC)' : 'Créer la publication';
  $('create-note').textContent = g.linked
    ? (st.lastOnline ? `Dernière mise en ligne : ${st.lastOnline.version}.` : '')
    : 'Reliez GitHub à l’étape 5 pour publier en un clic. Sans cela, la publication est créée sur ce PC et se met en ligne à la main.';
}
function renderHost() {
  const repo = $('repo').value.trim();
  if (!repo) $('repo-url').textContent = 'Sans dépôt, les fichiers sont référencés en chemin relatif (test local uniquement).';
  else if (!REPO_RE.test(repo)) $('repo-url').textContent = 'Format attendu : pseudo/depot (exemple : mon-pseudo/zombie-survival).';
  else $('repo-url').textContent = `Adresse fixe des mises à jour : https://github.com/${repo}/releases/latest/download/latest.json`;
  $('repo').classList.toggle('invalid', !!repo && !REPO_RE.test(repo));
  $('out-dir').textContent = st.outDir;
}
function renderActive(s) {
  const src = s && s.source;
  $('active-source').textContent = src ? `${src.url || '—'}${src.custom ? ' (test)' : ''}` : '—';
}
function renderMaps() {
  const m = st.maps || { list: [], missing: [] };
  const list = $('maps-list');
  list.textContent = '';
  m.list.forEach((e, i) => {
    const li = document.createElement('li');
    const a = document.createElement('span');
    const b = document.createElement('b'); b.textContent = `${i + 1}. ${e.name}`;
    a.append(b, ` · ${e.id}`);
    const c = document.createElement('span'); c.textContent = e.from;
    li.append(a, c);
    list.append(li);
  });
  $('maps-note').textContent = m.custom
    ? 'Cartes du menu du jeu dans la prochaine version, dans cet ordre (liste réglée dans les Mod Tools).'
    : 'Les cartes du jeu installé sont reprises telles quelles. Les Mod Tools permettent d’en ajouter, d’en retirer et de les modifier.';
  $('maps-missing').hidden = !(m.missing && m.missing.length);
  if (m.missing && m.missing.length) $('maps-missing').textContent = `Cartes introuvables : ${m.missing.join(', ')}. Corrigez la liste dans les Mod Tools avant de publier.`;
  $('maps-actions').hidden = !st.author;
}
function renderAll() { renderKey(); renderGame(); renderMaps(); renderLauncher(); renderHost(); renderOnline(); }

async function refresh() {
  st = await window.pub.state();
  if (!gameSource) {
    const inst = st.installed;
    const remembered = st.gameSource && st.gameSource !== 'installed' && st.gameSourceExists ? st.gameSource : null;
    // un fichier mémorisé n'est repris que s'il est plus récent que le jeu installé
    if (remembered && (!inst || (st.gameSourceVersion && cmp(st.gameSourceVersion, inst.version) > 0))) { gameSource = remembered; detectedVersion = st.gameSourceVersion; }
    else if (inst) gameSource = 'installed';
    else if (remembered) { gameSource = remembered; detectedVersion = st.gameSourceVersion; }
  }
  if (!$('repo').value && st.repo) $('repo').value = st.repo;
  renderAll();
}

function renderResult(r) {
  lastResult = r;
  const card = $('result');
  card.hidden = false;
  card.classList.remove('failed');
  $('res-title').firstChild.textContent = 'Publication';
  $('res-version').textContent = `${r.version} prête`;
  $('res-dir').textContent = r.dir;
  $('res-progress').hidden = true;
  $('res-online-error').hidden = true;
  $('res-online-actions').hidden = true;
  $('res-manual').hidden = false;
  const files = $('res-files');
  files.textContent = '';
  for (const name of r.upload) {
    const li = document.createElement('li');
    const a = document.createElement('span'); a.textContent = name;
    const b = document.createElement('span');
    b.textContent = name === 'latest.json' ? 'manifeste signé' : name.endsWith('.zip') ? `jeu · ${fmtSize(r.gameSize)}` : 'installateur du launcher';
    li.append(a, b);
    files.append(li);
  }
  const how = $('res-howto');
  how.textContent = '';
  const step = (...parts) => {
    const li = document.createElement('li');
    for (const p of parts) {
      if (typeof p === 'string') li.append(p);
      else { const c = document.createElement('code'); c.textContent = p.code; li.append(c); }
    }
    how.append(li);
  };
  if (st && st.github && st.github.linked) {
    step('Pour l’envoyer aux joueurs sans passer par GitHub : « Réessayer la mise en ligne » ci-dessus, ou publiez la prochaine version avec « Publier pour tous les joueurs ».');
  } else if (r.repo) {
    step('« Ouvrir GitHub » prépare une nouvelle release avec le tag ', { code: `v${r.version}` }, '.');
    step('Glissez les ', String(r.upload.length), ' fichiers ci-dessus dans la zone « Attach binaries ».');
    step('Laissez « Set as the latest release » coché, puis « Publish release ».');
    step('Les launchers installent la mise à jour à leur prochain démarrage (ou via « Vérifier maintenant »).');
  } else {
    step('Aucun dépôt GitHub indiqué : cette publication sert au test local (bouton « Tester avec ce launcher »).');
    step('Pour la mettre en ligne, indiquez votre dépôt à l’étape 5 et recréez la publication.');
  }
  $('res-github').disabled = !r.repo;
  if (st && st.github && st.github.linked) { $('res-online-actions').hidden = false; $('res-release').hidden = true; }
  card.scrollIntoView({ block: 'start' });
}

/* ------------------------------------------------- mise en ligne --- */
const STEP_TEXT = {
  create: 'Création et signature de la version sur ce PC',
  prepare: 'Préparation sur GitHub (brouillon, invisible des joueurs)',
  publish: 'Publication pour tous les joueurs',
  verify: 'Vérification de l’adresse des mises à jour',
};
const prog = { items: {}, current: null };
function progressItem(key, text) {
  const li = document.createElement('li');
  li.append(text);
  li.append(document.createElement('em'));
  $('res-progress').append(li);
  prog.items[key] = li;
}
function progressMark(key, cls, extra) {
  const li = prog.items[key];
  if (!li) return;
  li.className = cls;
  if (extra !== undefined) li.querySelector('em').textContent = extra;
}
function progressStart(version, withCreate) {
  const card = $('result');
  card.hidden = false;
  card.classList.remove('failed');
  $('res-title').firstChild.textContent = 'Mise en ligne';
  $('res-version').textContent = `${version} en cours…`;
  $('res-dir').textContent = '';
  const ol = $('res-progress');
  ol.textContent = '';
  ol.hidden = false;
  prog.items = {};
  prog.current = null;
  $('res-online-error').hidden = true;
  $('res-online-actions').hidden = true;
  $('res-manual').hidden = true;
  if (withCreate) { progressItem('create', STEP_TEXT.create); progressMark('create', 'doing'); prog.current = 'create'; }
  card.scrollIntoView({ block: 'start' });
}
function onProgress(p) {
  if (p.step === 'created') {
    if (prog.items.create) progressMark('create', 'done', '');
    progressItem('prepare', STEP_TEXT.prepare);
    const names = (p.files || []).filter((n) => n !== 'latest.json').concat('latest.json');
    for (const n of names) progressItem(`up:${n}`, `Envoi de ${n}`);
    progressItem('publish', STEP_TEXT.publish);
    progressItem('verify', STEP_TEXT.verify);
    prog.current = null;
    return;
  }
  const key = p.step === 'upload' ? `up:${p.name}` : p.step;
  if (prog.current && prog.current !== key) progressMark(prog.current, 'done', '');
  prog.current = key;
  progressMark(key, 'doing', p.step === 'upload' && p.total ? `${Math.floor((p.sent / p.total) * 100)} %` : '');
}
function progressEnd(r, online, error) {
  lastResult = r;
  const card = $('result');
  $('res-dir').textContent = r ? r.dir : '';
  if (online) {
    if (prog.current) progressMark(prog.current, online.verified ? 'done' : 'fail', '');
    $('res-title').firstChild.textContent = 'Version';
    $('res-version').textContent = `${r.version} en ligne`;
    if (!online.verified) {
      $('res-online-error').hidden = false;
      $('res-online-error').textContent = `Publiée, mais l’adresse des mises à jour ne renvoie pas encore cette version (${online.detail || 'délai'}). Regardez de nouveau dans quelques minutes : rien d’autre à faire.`;
    } else {
      const li = document.createElement('li');
      li.className = 'done';
      li.textContent = 'Les launchers des joueurs l’installeront à leur prochain démarrage.';
      $('res-progress').append(li);
    }
    $('res-online-actions').hidden = false;
    $('res-retry').hidden = true;
    $('res-release').hidden = !online.release;
    $('res-release').dataset.url = online.release || '';
    $('res-manual').hidden = true;
    toast(`Version ${r.version} en ligne.`);
  } else {
    if (prog.current) progressMark(prog.current, 'fail', '');
    card.classList.add('failed');
    $('res-title').firstChild.textContent = r ? 'Version' : 'Mise en ligne';
    $('res-version').textContent = r ? `${r.version} créée, pas encore en ligne` : 'impossible';
    $('res-online-error').hidden = false;
    $('res-online-error').textContent = `${error} Rien n’a été montré aux joueurs.`;
    $('res-online-actions').hidden = !r;
    $('res-retry').hidden = !r;
    $('res-release').hidden = true;
  }
}
function readForm() {
  const version = $('game-version').value.trim();
  const repo = $('repo').value.trim();
  if (!st.hasKey) throw new Error('Étape 1 : générez ou importez une clé de signature.');
  if (!gameSource) throw new Error('Étape 2 : choisissez le contenu du jeu.');
  if (st.maps && st.maps.missing && st.maps.missing.length) throw new Error(`Étape 3 : cartes introuvables (${st.maps.missing.join(', ')}).`);
  if (!VERSION_RE.test(version)) throw new Error('Étape 2 : numéro de version attendu sous la forme 1.0.1.');
  if (setupPath && !VERSION_RE.test($('launcher-version').value.trim())) throw new Error('Étape 4 : indiquez la version du launcher (forme 1.0.1).');
  if (repo && !REPO_RE.test(repo)) throw new Error('Étape 5 : dépôt GitHub attendu sous la forme pseudo/depot.');
  return {
    gameSource, version, notes: $('game-notes').value, newsTitle: $('news-title').value.trim(), newsText: $('news-text').value.trim(),
    allowSame: $('allow-same').checked, repo, outDir: st.outDir,
    setupPath: setupPath || null, launcherVersion: $('launcher-version').value.trim(), launcherNotes: $('launcher-notes').value,
  };
}

/* -------------------------------------------------------- actions --- */
let replaceArmed = 0;
function bind() {
  $('key-generate').addEventListener('click', () => call(async () => { st = await window.pub.generateKey(false); renderAll(); toast('Clé générée. Sauvegardez-la maintenant.'); }));
  $('key-import').addEventListener('click', () => call(async () => { st = await window.pub.importKey(); renderAll(); }));
  $('key-copy').addEventListener('click', () => call(async () => { if (await window.pub.copyPublicKey()) toast('Clé publique copiée dans le presse-papiers.'); }));
  $('key-export').addEventListener('click', () => call(async () => { const p = await window.pub.exportKey(); if (p) toast(`Clé sauvegardée : ${p}`); }));
  $('key-replace').addEventListener('click', () => call(async () => {
    const b = $('key-replace');
    if (!replaceArmed) {
      b.classList.add('armed');
      b.textContent = 'Confirmer : l’ancienne clé sera perdue';
      replaceArmed = setTimeout(() => { replaceArmed = 0; b.classList.remove('armed'); b.textContent = 'Remplacer la clé…'; }, 5000);
      return;
    }
    clearTimeout(replaceArmed); replaceArmed = 0;
    b.classList.remove('armed'); b.textContent = 'Remplacer la clé…';
    st = await window.pub.generateKey(true);
    renderAll();
    toast('Nouvelle clé générée.');
  }));
  $('game-pick').addEventListener('click', () => call(async () => {
    const r = await window.pub.pickGame();
    if (!r) return;
    gameSource = r.path;
    detectedVersion = r.version;
    versionTouched = false;
    renderGame();
  }));
  for (const id of ['src-installed', 'src-html']) {
    $(id).addEventListener('change', () => {
      if ($('src-installed').checked) { gameSource = 'installed'; detectedVersion = null; }
      else if (gameSource === 'installed') {
        const rem = st.gameSource && st.gameSource !== 'installed' && st.gameSourceExists ? st.gameSource : '';
        gameSource = rem;
        detectedVersion = rem ? st.gameSourceVersion : null;
      }
      renderGame();
    });
  }
  $('maps-open').addEventListener('click', () => call(() => window.pub.openModtools()));
  window.addEventListener('focus', () => { refresh().catch(() => {}); });
  $('game-version').addEventListener('input', () => {
    versionTouched = true;
    $('game-version').classList.toggle('invalid', !VERSION_RE.test($('game-version').value.trim()));
  });
  $('setup-pick').addEventListener('click', () => call(async () => {
    const p = await window.pub.pickSetup();
    if (!p) return;
    setupPath = p;
    const m = /(\d+\.\d+\.\d+)/.exec(p.split(/[\\/]/).pop() || '');
    if (m) $('launcher-version').value = m[1];
    renderLauncher();
  }));
  $('setup-clear').addEventListener('click', () => { setupPath = ''; renderLauncher(); });
  $('repo').addEventListener('input', renderHost);
  $('out-pick').addEventListener('click', () => call(async () => { const d = await window.pub.pickOutDir(); if (d) { st.outDir = d; renderHost(); } }));
  $('create').addEventListener('click', () => call(async () => {
    const form = readForm();
    const btn = $('create');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Création…';
    try {
      const r = await window.pub.create(form);
      renderResult(r);
      versionTouched = false;
      await refresh();
      toast(`Publication ${r.version} créée.`);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      renderOnline();
    }
  }));
  let onlineArmed = 0;
  const disarm = () => { clearTimeout(onlineArmed); onlineArmed = 0; const b = $('publish-online'); b.classList.remove('armed'); b.textContent = 'Publier pour tous les joueurs'; };
  $('publish-online').addEventListener('click', () => call(async () => {
    const form = readForm();
    const b = $('publish-online');
    if (!onlineArmed) {
      b.classList.add('armed');
      b.textContent = `Confirmer : envoyer la ${form.version} à tous les joueurs`;
      onlineArmed = setTimeout(disarm, 7000);
      return;
    }
    disarm();
    b.disabled = true; $('create').disabled = true;
    b.textContent = 'Publication…';
    progressStart(form.version, true);
    try {
      const r = await window.pub.publishOnline(form);
      versionTouched = false;
      progressEnd(r, r.online || null, r.onlineError || null);
      await refresh();
    } catch (e) {
      progressEnd(null, null, String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      b.disabled = false; $('create').disabled = false;
      b.textContent = 'Publier pour tous les joueurs';
    }
  }));
  $('res-retry').addEventListener('click', () => call(async () => {
    if (!lastResult) return;
    const r = lastResult;
    $('res-retry').disabled = true;
    progressStart(r.version, false);
    try {
      const online = await window.pub.upload({ dir: r.dir, version: r.version, upload: r.upload, notes: r.notes || [] });
      progressEnd(r, online, null);
      await refresh();
    } catch (e) {
      progressEnd(r, null, String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally { $('res-retry').disabled = false; }
  }));
  $('res-release').addEventListener('click', () => call(() => window.pub.openUrl($('res-release').dataset.url)));
  $('gh-token-page').addEventListener('click', () => call(() => window.pub.openUrl(st.github && st.github.tokenUrl)));
  $('gh-link').addEventListener('click', () => call(async () => {
    const input = $('gh-token');
    const repo = $('repo').value.trim() || st.repo;
    if (!REPO_RE.test(repo || '')) throw new Error('Étape 5 : indiquez d’abord le dépôt GitHub (pseudo/depot).');
    const btn = $('gh-link');
    btn.disabled = true; btn.textContent = 'Vérification…';
    try {
      st = await window.pub.githubLink(input.value, repo);
      input.value = '';
      if (st.repo) $('repo').value = st.repo;
      renderAll();
      toast('Launcher relié à GitHub.');
    } finally { btn.disabled = false; btn.textContent = 'Vérifier et enregistrer'; }
  }));
  $('gh-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('gh-link').click(); });
  $('gh-unlink').addEventListener('click', () => call(async () => { st = await window.pub.githubUnlink(); renderAll(); toast('Launcher délié de GitHub.'); }));
  window.pub.onProgress(onProgress);
  $('res-open').addEventListener('click', () => call(() => lastResult && window.pub.openDir(lastResult.dir)));
  $('res-test').addEventListener('click', () => call(async () => {
    if (!lastResult) return;
    await window.pub.testLocal(lastResult.dir);
    toast('Launcher pointé vers cette publication : regardez la fenêtre du launcher.');
  }));
  $('res-github').addEventListener('click', () => call(() => lastResult && window.pub.openGithub(lastResult.repo, lastResult.version)));
}

bind();
window.pub.onStatus(renderActive);
window.pub.launcherStatus().then(renderActive).catch(() => {});
refresh().catch(showError);
