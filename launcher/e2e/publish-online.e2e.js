'use strict';
/* Essai de bout en bout : publier pour tous les joueurs en un clic, contre un faux GitHub.
     xvfb-run -a node e2e/publish-online.e2e.js   (Linux sans écran)
   Vérifie : l'outil propose le jeu installé (pas un ancien fichier mémorisé), refuse de publier
   un ancien jeu, se relie à GitHub (nom exact du dépôt), publie (brouillon → fichiers → version
   en ligne), et un launcher de joueur installe seul la nouvelle version au démarrage. Puis le
   launcher installe seul un nouveau launcher annoncé, une seule fois par version.
   Launcher 1.2.6 : un launcher déjà en ligne reste annoncé même s'il est plus ancien que celui qui
   publie (lien « Nouveau joueur ? ») et l'outil avertit quand aucun launcher n'est annoncé ; la
   publication joint les notes des versions précédentes, et le joueur les voit dans la page « Mises à
   jour » du launcher (bouton « Notes de version » de l'accueil), même hors ligne avec le jeu livré.
   Launcher 1.4.0 : nouvelle interface (barre latérale et pages) ; les contrôles de l'ancienne fiche des
   notes et de sa fenêtre d'historique portent sur l'accueil et la page des mises à jour. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { _electron: electron } = require('playwright-core');
const { fakeGitHub } = require('./fake-github');
const publisher = require('../src/main/publisher');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-pub-'));
const APP = path.join(TMP, 'app');
const TOKEN = 'github_pat_essai_0123456789abcdef';
let failures = 0;
const SHOTS = process.env.ZS_E2E_SHOTS || '';
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };
const ok = (cond, label, extra) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`); if (!cond) failures++; };

function makeApp(publicPem, updateUrl) {
  fs.mkdirSync(path.join(APP, 'config'), { recursive: true });
  for (const d of ['src', 'gamelibs', 'game']) fs.cpSync(path.join(ROOT, d), path.join(APP, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(APP, 'config', 'default.json'), JSON.stringify({ updateUrl, publicKey: publicPem }, null, 2));
  fs.copyFileSync(path.join(ROOT, 'config', 'notes-history.json'), path.join(APP, 'config', 'notes-history.json'));
}
// erreurs JavaScript de toutes les fenêtres (launcher, outil de publication)
const pageErrors = [];
const watched = new WeakSet();
const watch = (page) => { if (watched.has(page)) return; watched.add(page); page.on('pageerror', (e) => pageErrors.push(`${page.url()} : ${e.message}`)); };
async function launch(userData, env) {
  const args = [APP];
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
  const app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: userData, ...env }, timeout: 60000 });
  app.on('window', watch);
  const launcher = await app.firstWindow({ timeout: 30000 });
  watch(launcher);
  await launcher.waitForLoadState('domcontentloaded');
  return { app, launcher };
}
const closeAll = async (app) => {
  await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.allowClose = true; }).catch(() => {});
  await app.close().catch(() => {});
};
const statusOf = (launcher) => launcher.evaluate(() => window.zs.status());
async function waitStatus(launcher, pred, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let s = null;
  while (Date.now() < end) {
    s = await statusOf(launcher).catch(() => null);
    if (s && pred(s)) return s;
    await new Promise((r) => setTimeout(r, 500));
  }
  return s;
}

(async () => {
  const gh = await fakeGitHub({ token: TOKEN });
  const env = { ZS_GITHUB_API: gh.base, ZS_GITHUB_WEB: gh.base };
  const latestUrl = `${gh.base}/${gh.repo.toLowerCase()}/releases/latest/download/latest.json`;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  makeApp(publicPem, latestUrl);
  const bundled = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;
  const next = publisher.nextPatch(bundled);
  try {
    /* ---- nouveau joueur, aucune version encore en ligne : jeu livré avec l'installateur.
       L'accueil montre les notes publiées de cette version (pas « Version livrée avec le
       launcher ») et l'historique est disponible hors ligne. */
    const fresh = path.join(TMP, 'nouveau-joueur');
    fs.mkdirSync(fresh, { recursive: true });
    const p0 = await launch(fresh, env);
    const s0 = await waitStatus(p0.launcher, (s) => s.installed && s.installed.version === bundled && Array.isArray(s.history) && s.history.length > 0, 60000);
    await p0.launcher.waitForFunction(() => document.querySelectorAll('#d-chrono > li').length > 0, null, { timeout: 30000 });
    const seedBundled = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'notes-history.json'), 'utf8')).versions.find((e) => e.version === bundled);
    const card0 = await p0.launcher.evaluate(() => ({ first: document.getElementById('d-mission-t').textContent, count: document.querySelectorAll('#d-chrono > li').length }));
    const first0 = seedBundled ? seedBundled.notes[0].replace(/^\s*[-–—•*]+\s*/, '') : 'Version livrée avec le launcher';
    ok(s0 && card0.first === first0 && card0.count === s0.history.length, 'nouveau joueur hors ligne : notes publiées du jeu livré à l’accueil, historique disponible', { ...card0, history: s0 && s0.history.map((e) => e.version) });
    await shot(p0.launcher, 'hist-0-nouveau-joueur');
    await closeAll(p0.app);

    /* ---- auteur : clé, ancien fichier mémorisé, outil de publication */
    const author = path.join(TMP, 'auteur');
    const pubDir = path.join(author, 'publisher');
    fs.mkdirSync(pubDir, { recursive: true });
    fs.writeFileSync(path.join(pubDir, 'signing-key.pem'), privatePem);
    const oldHtml = path.join(TMP, 'ancien-jeu.html');
    fs.writeFileSync(oldHtml, fs.readFileSync(path.join(ROOT, '..', 'game', 'zombie-survival.html'), 'utf8').replace(/const GAME_VERSION = '[^']+'/, "const GAME_VERSION = '1.0.2'"));
    // dernier launcher annoncé : déjà en ligne, plus ancien que le launcher qui publie
    const oldSetup = { version: '1.0.0', file: `${gh.base}/${gh.repo}/releases/download/v1.0.0/Zombie-Survival-Setup-1.0.0.exe`, size: 1000, sha256: 'b'.repeat(64), notes: ['Ancien launcher'] };
    fs.writeFileSync(path.join(pubDir, 'settings.json'), JSON.stringify({ repo: gh.repo.toLowerCase(), gameSource: oldHtml, lastGameVersion: '1.0.2', outDir: path.join(TMP, 'publications'), lastLauncher: oldSetup }));
    const pastVersions = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'notes-history.json'), 'utf8')).versions.map((e) => e.version);
    let { app, launcher } = await launch(author, env);
    await launcher.waitForFunction(() => document.getElementById('status-title').textContent !== 'Ouverture du jeu…', null, { timeout: 60000 });
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.evaluate(() => window.zs.openPublisher())]);
    await pub.waitForFunction(() => document.getElementById('src-installed') && document.getElementById('game-version').value, null, { timeout: 30000 });
    const def = await pub.evaluate(() => ({ installed: document.getElementById('src-installed').checked, version: document.getElementById('game-version').value, online: !document.getElementById('publish-online').hidden, unlinked: !document.getElementById('gh-unlinked').hidden }));
    ok(def.installed && def.version === bundled && !def.online && def.unlinked, 'outil : jeu installé proposé (pas l’ancien fichier mémorisé), numéro = version installée, pas encore relié', def);
    // numéro trop petit : refusé
    await pub.fill('#game-version', '1.0.3');
    await pub.click('#create');
    await pub.waitForFunction(() => !document.getElementById('form-error').hidden && /trop petit/.test(document.getElementById('form-error').textContent), null, { timeout: 15000 });
    ok(true, 'numéro plus petit que le jeu publié : refusé');
    await pub.fill('#game-version', next);
    await pub.setViewportSize({ width: 1100, height: 900 }).catch(() => {});
    await shot(pub, 'pub-1-non-relie');
    // ancien fichier choisi exprès : avertissement et refus
    await pub.click('#src-html');
    const warn = await pub.evaluate(() => ({ text: document.getElementById('game-older').textContent, shown: !document.getElementById('game-older').hidden }));
    ok(warn.shown && /plus ancien \(1\.0\.2\)/.test(warn.text), 'ancien fichier : avertissement affiché', warn.text);
    await pub.click('#create');
    await pub.waitForFunction(() => !document.getElementById('form-error').hidden, null, { timeout: 15000 });
    ok(/plus ancien que le jeu installé/.test(await pub.evaluate(() => document.getElementById('form-error').textContent)), 'ancien fichier : publication refusée');
    await shot(pub, 'pub-2-ancien-fichier');
    await pub.click('#src-installed');
    // liaison GitHub
    await pub.fill('#gh-token', 'github_pat_mauvais_0123456789abcd');
    await pub.click('#gh-link');
    await pub.waitForFunction(() => !document.getElementById('form-error').hidden && /jeton/.test(document.getElementById('form-error').textContent), null, { timeout: 15000 });
    ok(true, 'liaison : mauvais jeton refusé');
    await pub.fill('#gh-token', TOKEN);
    await pub.click('#gh-link');
    await pub.waitForFunction(() => !document.getElementById('gh-linked').hidden, null, { timeout: 15000 });
    const linked = await pub.evaluate(() => ({ text: document.getElementById('gh-linked-text').textContent, repo: document.getElementById('repo').value, input: document.getElementById('gh-token').value }));
    ok(linked.text.includes(gh.repo) && linked.repo === gh.repo && linked.input === '', 'liaison : nom exact du dépôt, champ du jeton vidé', linked);
    const tokenFiles = fs.readdirSync(pubDir).filter((n) => /github-token/.test(n));
    ok(tokenFiles.length === 1 && !fs.readFileSync(path.join(pubDir, 'settings.json'), 'utf8').includes(TOKEN), 'jeton gardé à part, absent des réglages', tokenFiles);
    // historique joint : annoncé sous les notes
    const histLine = await pub.evaluate(() => document.getElementById('notes-history').textContent);
    ok(histLine.includes(`${pastVersions.length} versions précédentes (${pastVersions[0]} à ${pastVersions[pastVersions.length - 1]})`), 'outil : notes des versions précédentes annoncées sous les notes', histLine);
    ok(/Dernier launcher annoncé : 1\.0\.0/.test(await pub.evaluate(() => document.getElementById('launcher-last').textContent)), 'outil : le launcher déjà en ligne reste annoncé (plus ancien que celui qui publie)');
    const noLauncher = await pub.evaluate(() => {
      const keep = st.lastLauncher;
      st.lastLauncher = null; renderLauncher();
      const el = document.getElementById('launcher-last');
      const r = { text: el.textContent, warn: el.classList.contains('warn'), path: document.getElementById('setup-path').textContent };
      st.lastLauncher = keep; renderLauncher();
      return r;
    });
    ok(/^Aucun launcher n'est annoncé/.test(noLauncher.text) && noLauncher.warn && noLauncher.path === 'Aucun', 'outil : sans launcher annoncé, avertissement (pas de lien « Nouveau joueur ? »)', noLauncher);
    // publication en un clic (deux clics : armer puis confirmer)
    await pub.fill('#game-notes', 'Sélection de la carte\n- Statistiques');
    await pub.click('#publish-online');
    await shot(pub, 'pub-3-relie');
    ok(/Confirmer/.test(await pub.evaluate(() => document.getElementById('publish-online').textContent)), 'premier clic : demande de confirmation');
    await pub.click('#publish-online');
    await pub.waitForFunction(() => /en ligne|pas encore en ligne|impossible/.test(document.getElementById('res-version').textContent), null, { timeout: 60000 });
    const res = await pub.evaluate(() => ({ title: document.getElementById('res-title').textContent, steps: [...document.querySelectorAll('#res-progress li')].map((l) => `${l.className}:${l.firstChild.textContent}`), err: document.getElementById('res-online-error').hidden ? '' : document.getElementById('res-online-error').textContent }));
    ok(new RegExp(`${next.replace(/\./g, '\\.')} en ligne`).test(res.title) && !res.err && res.steps.every((s) => s.startsWith('done:')), 'publication en ligne : toutes les étapes faites', res);
    await shot(pub, 'pub-4-en-ligne');
    const rel = gh.state.releases.find((r) => r.tag_name === `v${next}`);
    ok(rel && !rel.draft && rel.assets.map((a) => a.name).join() === `zombie-survival-${next}.zip,latest.json`, 'faux GitHub : version publiée, zip puis latest.json', rel && rel.assets.map((a) => a.name));
    ok(rel && rel.body.startsWith('- Sélection de la carte\n- Statistiques\n\n**Nouveau joueur ?** Téléchargez [Zombie-Survival-Setup-1.0.0.exe]'), 'notes de version reprises, lien « Nouveau joueur ? » du launcher en ligne', rel && rel.body);
    const pubManifest = JSON.parse(JSON.parse(fs.readFileSync(path.join(TMP, 'publications', `v${next}`, 'latest.json'), 'utf8')).signed);
    ok(JSON.stringify((pubManifest.history || []).map((e) => e.version)) === JSON.stringify(pastVersions) && pubManifest.launcher && pubManifest.launcher.version === '1.0.0', 'manifeste : notes des versions précédentes jointes, launcher en ligne annoncé', { history: (pubManifest.history || []).map((e) => e.version), launcher: pubManifest.launcher && pubManifest.launcher.version });
    const onlineHistory = (JSON.parse(fs.readFileSync(path.join(pubDir, 'settings.json'), 'utf8')).onlineHistory || []).map((e) => e.version);
    ok(onlineHistory[0] === next && onlineHistory.length === pastVersions.length + 1, 'auteur : versions en ligne retenues pour la publication suivante', onlineHistory);
    await closeAll(app);

    /* ---- joueur : le launcher installe seul la nouvelle version au démarrage */
    if (process.env.ZS_E2E_DEBUG) gh.server.on('request', (req) => console.log('FAUX GITHUB', req.method, req.url));
    const player = path.join(TMP, 'joueur');
    fs.mkdirSync(player, { recursive: true });
    ({ app, launcher } = await launch(player, env));
    const playerLog = () => { try { const d = path.join(player, 'logs'); return fs.readdirSync(d).map((n) => fs.readFileSync(path.join(d, n), 'utf8')).join('\n'); } catch (e) { return String(e); } };
    const ps = await waitStatus(launcher, (s) => (s.installed && s.installed.version === next) || s.phase === 'error', 120000);
    if (!ps.installed || ps.installed.version !== next) { console.log('ÉTAT', JSON.stringify(ps)); console.log(playerLog()); }
    ok(ps.installed && ps.installed.version === next && ps.remote && ps.remote.version === next, 'joueur : nouvelle version installée seule au démarrage', { installed: ps.installed && ps.installed.version, remote: ps.remote && ps.remote.version });
    /* ---- joueur : historique des mises à jour (page « Mises à jour », depuis le bouton « Notes de version » de l'accueil) */
    await launcher.waitForFunction(() => document.querySelectorAll('#d-chrono > li').length > 0 && document.getElementById('d-mission-t').textContent !== '', null, { timeout: 30000 });
    const card = await launcher.evaluate(() => ({ bouton: (document.querySelector('.d-cta [data-aller="maj"]') || {}).textContent, versions: document.querySelectorAll('#d-chrono > li').length, first: document.getElementById('d-mission-t').textContent }));
    ok(card.bouton === 'Notes de version' && card.versions === pastVersions.length + 1 && card.first === 'Sélection de la carte', 'accueil : notes de la version installée, bouton « Notes de version », toutes les versions', card);
    await shot(launcher, 'hist-1-fiche');
    await launcher.click('.d-cta [data-aller="maj"]');
    await launcher.waitForFunction(() => !document.querySelector('[data-page="maj"]').hidden, null, { timeout: 5000 });
    const readHist = () => launcher.evaluate(() => ({
      items: [...document.querySelectorAll('#d-chrono > li')].map((li) => `${li.dataset.version}${[...li.querySelectorAll('header .d-tampon')].map((t) => `:${t.textContent}`).join('')}`),
      installee: (document.querySelector('#d-chrono > li.installee') || { dataset: {} }).dataset.version,
      page: (document.querySelector('.d-nav [aria-current="page"]') || { dataset: {} }).dataset.section, fil: document.getElementById('d-fil').textContent,
      carte: [document.getElementById('d-v-installee').textContent, document.getElementById('d-v-tampon').textContent, document.getElementById('d-v-dispo').hidden],
    }));
    const entree = (v) => launcher.evaluate((x) => {
      const li = [...document.querySelectorAll('#d-chrono > li')].find((e) => e.dataset.version === x);
      return li ? { date: li.querySelector('header small').textContent, notes: [...li.querySelectorAll('ul li')].map((l) => l.textContent), plus: (li.querySelector('[data-plus]') || {}).textContent || null } : null;
    }, v);
    let h = await readHist();
    ok(JSON.stringify(h.items) === JSON.stringify([`${next}:Installée`, ...pastVersions]) && h.installee === next && h.page === 'maj' && h.fil === 'Mises à jour', 'historique : toutes les versions, la version installée repérée', h);
    await shot(launcher, 'hist-2-ouvert');
    let e = await entree(pastVersions[0]);
    ok(e && /^\d+ \S+ \d{4}$/.test(e.date) && e.notes.length > 0, 'historique : version précédente, date en français, ses notes', e);
    const oldest = await launcher.evaluate(() => {
      const l = document.querySelector('#d-chrono > li:last-child');
      l.scrollIntoView({ block: 'nearest' });
      const r = l.getBoundingClientRect(), c = document.getElementById('d-contenu').getBoundingClientRect();
      return { v: l.dataset.version, visible: r.top >= c.top - 1 && r.top < c.bottom };
    });
    ok(oldest.v === pastVersions[pastVersions.length - 1] && oldest.visible, 'historique : la plus ancienne version en bas de la chronologie', oldest);
    const longue = ((await statusOf(launcher)).history || []).find((x) => x.notes.length > 4);
    if (longue) await launcher.click(`#d-chrono [data-plus="${longue.version}"]`);
    e = longue ? await entree(longue.version) : null;
    // toutes les notes, dans l'ordre, tirets et puces de tête retirés (les notes à tiret de 1.5.0 sont dans la partie dépliée)
    const attendues = longue ? longue.notes.map((n) => n.replace(/^\s*[-–—•*]+\s*/, '')) : [];
    ok(longue && e && e.notes.join('\n') === attendues.join('\n') && e.plus === null, 'historique : « Voir les N autres notes » déplie toutes les notes (tirets de tête retirés)', longue && { version: longue.version, montrees: e && e.notes, attendues });
    await shot(launcher, 'hist-3-ancienne');
    await launcher.click('.d-nav [data-section="accueil"]');
    const back = await launcher.evaluate(() => ({ accueil: !document.querySelector('[data-page="accueil"]').hidden, maj: !document.querySelector('[data-page="maj"]').hidden, jouer: !document.getElementById('btn-main').disabled }));
    ok(back.accueil && !back.maj && back.jouer, 'navigation : retour à l’accueil, bouton Jouer actif', back);
    await launcher.focus('.d-cta [data-aller="maj"]');
    await launcher.keyboard.press('Enter');
    ok(await launcher.evaluate(() => !document.querySelector('[data-page="maj"]').hidden), 'bouton « Notes de version » : Entrée ouvre aussi les mises à jour');
    h = await readHist();
    ok(h.carte[0] === next && h.carte[1] === 'À jour' && h.carte[2] === true, 'mises à jour : version installée à jour, aucune autre proposée', h.carte);
    await closeAll(app);

    /* ---- nouveau launcher annoncé : installation automatique, une fois par version */
    const fakeSetup = path.join(TMP, 'Zombie-Survival-Setup-9.9.9.exe');
    fs.writeFileSync(fakeSetup, crypto.randomBytes(4096));
    const outDir = path.join(TMP, 'publications-2');
    const v2 = publisher.nextPatch(next);
    const r2 = await publisher.createRelease({ source: { folderPath: path.join(player, 'game', 'versions', next) }, version: v2, notes: ['Nouveau launcher'], outDir, privatePem, libsDir: path.join(ROOT, 'gamelibs'), repo: gh.repo, webBase: gh.base, launcher: { setupPath: fakeSetup, version: '9.9.9', notes: ['Essai'] } });
    const { createClient } = require('../src/main/github');
    await createClient({ token: TOKEN, apiBase: gh.base, webBase: gh.base }).publish({ repo: gh.repo, version: v2, dir: r2.dir, files: r2.upload, notes: ['Nouveau launcher'] });
    const rel2 = gh.state.releases.find((r) => r.tag_name === `v${v2}`);
    ok(rel2 && /^- Nouveau launcher\n\n\*\*Nouveau joueur \?\*\* Téléchargez \[Zombie-Survival-Setup-9\.9\.9\.exe\]\(https?:\/\/[^)]+\/releases\/download\/v[\d.]+\/Zombie-Survival-Setup-9\.9\.9\.exe\)/.test(rel2.body), 'page de la version : lien d’installation pour les nouveaux joueurs', rel2 && rel2.body);
    const logFile = () => { const d = path.join(player, 'logs'); return fs.readdirSync(d).map((n) => fs.readFileSync(path.join(d, n), 'utf8')).join('\n'); };
    ({ app, launcher } = await launch(player, env));
    await waitStatus(launcher, (s) => s.launcherUpdate && s.launcherUpdate.version === '9.9.9' && !['checking', 'starting', 'downloading'].includes(s.phase), 60000);
    await new Promise((r) => setTimeout(r, 1000));
    const guard = JSON.parse(fs.readFileSync(path.join(player, 'cache', 'launcher-autoupdate.json'), 'utf8'));
    ok(guard.version === '9.9.9' && /Launcher 9\.9\.9 téléchargé/.test(logFile()), 'nouveau launcher : téléchargé et lancé sans clic', guard);
    await closeAll(app);
    ({ app, launcher } = await launch(player, env));
    await waitStatus(launcher, (s) => s.launcherUpdate && !['checking', 'starting', 'downloading', 'installing'].includes(s.phase), 60000);
    await new Promise((r) => setTimeout(r, 1000));
    ok(/installation automatique déjà tentée/.test(logFile()), 'même version au démarrage suivant : pas de nouvelle tentative (pas de boucle)');
    await closeAll(app);
    ok(!pageErrors.length, 'aucune erreur JavaScript dans les fenêtres du launcher et de l’outil de publication', pageErrors.slice(0, 5));
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    await gh.close();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Publication en un clic : tous les essais sont passés.');
  process.exit(failures ? 1 : 0);
})();
