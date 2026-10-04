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
function renderAll() { renderKey(); renderGame(); renderMaps(); renderLauncher(); renderHost(); }

async function refresh() {
  st = await window.pub.state();
  if (!gameSource && st.gameSource) gameSource = st.gameSource;
  if (!gameSource && st.installed && st.installed.editor) gameSource = 'installed';
  if (!$('repo').value && st.repo) $('repo').value = st.repo;
  renderAll();
}

function renderResult(r) {
  lastResult = r;
  $('result').hidden = false;
  $('res-version').textContent = r.version;
  $('res-dir').textContent = r.dir;
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
  if (r.repo) {
    step('« Ouvrir GitHub » prépare une nouvelle release avec le tag ', { code: `v${r.version}` }, '.');
    step('Glissez les ', String(r.upload.length), ' fichiers ci-dessus dans la zone « Attach binaries ».');
    step('Laissez « Set as the latest release » coché, puis « Publish release ».');
    step('Les launchers installent la mise à jour à leur prochain démarrage (ou via « Vérifier maintenant »).');
  } else {
    step('Aucun dépôt GitHub indiqué : cette publication sert au test local (bouton « Tester avec ce launcher »).');
    step('Pour la mettre en ligne, indiquez votre dépôt à l’étape 4 et recréez la publication.');
  }
  $('res-github').disabled = !r.repo;
  $('result').scrollIntoView({ block: 'start' });
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
      if ($('src-installed').checked) gameSource = 'installed';
      else if (gameSource === 'installed') gameSource = st.gameSource && st.gameSource !== 'installed' ? st.gameSource : '';
      detectedVersion = null;
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
    const version = $('game-version').value.trim();
    const repo = $('repo').value.trim();
    if (!st.hasKey) throw new Error('Étape 1 : générez ou importez une clé de signature.');
    if (!gameSource) throw new Error('Étape 2 : choisissez le contenu du jeu.');
    if (st.maps && st.maps.missing && st.maps.missing.length) throw new Error(`Étape 3 : cartes introuvables (${st.maps.missing.join(', ')}).`);
    if (!VERSION_RE.test(version)) throw new Error('Étape 2 : numéro de version attendu sous la forme 1.0.1.');
    if (setupPath && !VERSION_RE.test($('launcher-version').value.trim())) throw new Error('Étape 3 : indiquez la version du launcher (forme 1.0.1).');
    if (repo && !REPO_RE.test(repo)) throw new Error('Étape 4 : dépôt GitHub attendu sous la forme pseudo/depot.');
    const btn = $('create');
    btn.disabled = true;
    btn.textContent = 'Création…';
    try {
      const r = await window.pub.create({
        gameSource, version, notes: $('game-notes').value, newsTitle: $('news-title').value.trim(), newsText: $('news-text').value.trim(),
        allowSame: $('allow-same').checked, repo, outDir: st.outDir,
        setupPath: setupPath || null, launcherVersion: $('launcher-version').value.trim(), launcherNotes: $('launcher-notes').value,
      });
      renderResult(r);
      versionTouched = false;
      await refresh();
      toast(`Publication ${r.version} créée.`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Créer la publication';
    }
  }));
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
