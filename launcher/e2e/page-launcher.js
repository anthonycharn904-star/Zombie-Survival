'use strict';
/* Contrôle de la page du launcher sans Electron (qui ne démarre pas dans le bac à sable des sessions) : la page
   src/renderer/launcher/index.html chargée en file:// dans le Chromium « sans tête » de Playwright, comme loadFile,
   donc sous sa politique de sécurité, avec un faux window.zs (faux-zs.js) qui rejoue les états du processus
   principal. Hors de test:e2e : il ne remplace pas les essais de bout en bout, il les prépare.

     node e2e/page-launcher.js <dossier de sortie, hors du dépôt> [--scenarios a,b] [--taille 1280x720]

   Pour chaque scénario : les contrats des essais (#btn-main, #status-title, #btn-modtools), les vérifications propres
   à l'interface en place (la nouvelle, ou l'ancienne 1.3.3 remise depuis Git, reconnue d'elle-même), aucune erreur de
   page, aucun refus de la politique de sécurité ; des captures (celles du scénario, puis « fin »). Code de sortie : 0 si
   tout passe, 1 sinon. */
const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
const history = require(path.join(ROOT, 'src', 'main', 'history.js'));
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage : node e2e/page-launcher.js <dossier de sortie> [--scenarios a,b] [--taille 1280x720]'); process.exit(2); }
const OUT = path.resolve(argv[0]);
if (OUT === path.resolve(ROOT, '..') || OUT.startsWith(path.resolve(ROOT, '..') + path.sep)) { console.error('le dossier de sortie doit être hors du dépôt'); process.exit(2); }
const PAGE = path.join(ROOT, 'src', 'renderer', 'launcher', 'index.html');
const [LARG, HAUT] = val('--taille', '1280x720').split('x').map(Number);
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;

function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* pas de cache Playwright */ }
  return '/opt/pw-browsers/chromium';
}

/* ------------------------------------------------------------------ données, aux formes de main.js */
const LIVRE = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;      // jeu livré (2.0.6)
const ANCIENNES = (JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'notes-history.json'), 'utf8')).versions) || [];
const LAUNCHER = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const AUJ = new Date('2026-11-02T10:00:00Z').toISOString();
const NOTES_207 = ['Sélection de la carte', '- Nouveau launcher', '• Corrections diverses'];
const manifeste = (v, notes, extra = {}) => ({ game: { version: v, notes, date: AUJ, size: 4.41e6 }, published: AUJ, history: [], ...extra });
const installe = (v, previous = null, notes = ['Version livrée avec le launcher']) => ({ version: v, previous, notes, installedAt: '2026-11-01T18:30:00.000Z' });
// historique comme buildHistory de main.js : manifeste, versions publiées avant le launcher 1.2.6, jeu installé
const histo = (m, inst) => history.mergeHistory(history.manifestEntries(m), ANCIENNES, inst ? [{ version: inst.version, notes: inst.notes }] : []);
const ACTUS = [
  { title: 'Bunker 7 : le boss se réveille', text: 'Une nouvelle menace au fond du bunker.', date: '2026-11-01' },
  { title: 'Khamsin : la tempête permanente', text: 'Le plateau des pyramides devient la zone jouable.', date: '2026-10-18' },
  { title: 'Ombre éternelle : oxygène et gravité', text: 'La mine de glace sur la Lune.', date: '2026-10-05' },
];
const SOURCE = { url: 'https://github.com/anthonycharn904-star/zombie-survival/releases/latest/download/latest.json', custom: false, configured: true, keyFingerprint: '8508-2046-8B30-034A' };
// réglages envoyés par le processus principal : ceux du launcher 1.4.0 (reglages.js) ; le 1.3.3 n'avait que les quatre premiers
const REGLAGES = { ...require(path.join(ROOT, 'src', 'main', 'reglages.js')).DEFAULTS };
const REGLAGES_133 = { autoCheck: true, autoInstall: true, fullscreen: true, keepLauncherOpen: false };
// sons de l'ambiance, rendus par le faux window.zs comme par le processus principal (lus ici, passés en base64)
const SONS_DIR = path.join(ROOT, 'src', 'renderer', 'launcher', 'assets', 'marecages', 'sons');
const AMBIANCE = (() => {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(SONS_DIR, 'ambiance.json'), 'utf8'));
    return { meta: doc.sons, fichiers: Object.fromEntries(Object.keys(doc.sons).map((id) => [id, fs.readFileSync(path.join(SONS_DIR, `${id}.ogg`)).toString('base64')])) };
  } catch (e) { return null; }
})();
const depart = () => ({ launcherVersion: LAUNCHER, settings: { ...REGLAGES }, source: { ...SOURCE } });

/* ------------------------------------------------------------------ scénarios */
// chacun reçoit l'outil s (émettre, attendre, vérifier, cliquer) et l'interface reconnue (ancienne ou nouvelle)
const SCENARIOS = {
  async demarrage(s) {
    const inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    if (await s.interface() === 'nouvelle') {
      await s.attendre(900);
      await s.capture('ouverture', true);
      s.ok(await s.cache('#d-agrandir'), 'ouverture : pas de bouton Agrandir tant que le processus principal ne donne pas l’état de la fenêtre');
    }
    await s.emettre({ phase: 'checking', installed: inst, history: histo(null, inst) });
    await s.attendre(300);
    await s.emettre({ phase: 'ready', remote: { ...m.game, notes: m.game.notes }, news: ACTUS, installed: inst, history: histo(m, inst), checkedAt: Date.now() });
    await s.attendre(400);
    s.ok(await s.actif('#btn-main'), 'prêt : #btn-main actif');
    s.ok(await s.texte('#status-title') !== 'Ouverture du bunker…', 'prêt : #status-title a changé', await s.texte('#status-title'));
    await s.clic('#btn-main');
    s.ok((await s.appels()).some((a) => a.nom === 'play'), 'un clic sur #btn-main appelle zs.play()');
  },
  async miseAJour(s) {
    const inst = installe(LIVRE), m = manifeste('2.0.7', NOTES_207);
    await s.emettre({ phase: 'checking', installed: inst, history: histo(null, inst) });
    await s.attendre(200);
    await s.emettre({ phase: 'update', remote: { ...m.game }, news: ACTUS, installed: inst, history: histo(m, inst), checkedAt: Date.now() });
    await s.attendre(400);
    s.ok(await s.actif('#btn-main'), 'mise à jour : #btn-main actif (Mettre à jour)');
    await s.capture('maj-proposee');
    await s.clic('#btn-main');
    s.ok((await s.appels()).some((a) => a.nom === 'install'), 'mise à jour : un clic sur #btn-main appelle zs.install()');
    const total = 4.41e6;
    for (let r = 0; r <= total; r += total / 25) {
      await s.emettre({ phase: 'downloading', progress: { phase: 'download', received: Math.round(r), total, target: '2.0.7' } });
      await s.attendre(120);
      if (Math.abs(r - total / 2) < total / 40) await s.capture('telechargement');
    }
    s.ok(!(await s.actif('#btn-main')), 'téléchargement : #btn-main inactif');
    if (await s.interface() === 'nouvelle') {
      const c = await page(s).evaluate(() => { const r = document.getElementById('d-dl-courbe').getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), large: innerWidth > 1180 }; });
      s.ok(c.large ? c.l === 120 && c.h === 32 : c.l === 0, 'téléchargement : courbe du débit en 120 × 32 (cachée sous 1 180 px)', c);
    }
    await s.emettre({ phase: 'installing', progress: { phase: 'install', received: total, total, target: '2.0.7' } });
    await s.attendre(300);
    await s.capture('installation');
    const inst2 = installe('2.0.7', LIVRE, NOTES_207);
    await s.emettre({ phase: 'ready', progress: null, installed: inst2, history: histo(m, inst2) });
    await s.attendre(400);
    s.ok(await s.actif('#btn-main'), 'installée : #btn-main actif');
    await s.historique(m, inst2);
  },
  async annulation(s) {
    const inst = installe(LIVRE), m = manifeste('2.0.7', NOTES_207);
    await s.emettre({ phase: 'update', remote: { ...m.game }, installed: inst, history: histo(m, inst) });
    await s.attendre(200);
    await s.emettre({ phase: 'downloading', progress: { phase: 'download', received: 1.2e6, total: 4.41e6, target: '2.0.7' } });
    await s.attendre(300);
    await s.annuler();
    s.ok((await s.appels()).some((a) => a.nom === 'cancel'), 'téléchargement : « Annuler » appelle zs.cancel()');
  },
  async horsLigne(s) {
    const inst = installe(LIVRE);
    await s.emettre({ phase: 'offline', installed: inst, history: histo(null, inst), error: { code: 'NETWORK', message: 'Serveur de mises à jour injoignable.', context: 'check' } });
    await s.attendre(300);
    s.ok(await s.actif('#btn-main'), 'hors ligne : #btn-main actif (jeu jouable)');
    await s.capture('hors-ligne');
    s.ok(await s.reessayer(), 'hors ligne : « Réessayer » appelle zs.check()');
  },
  async nonConfigure(s) {
    const inst = installe(LIVRE);
    await s.emettre({ phase: 'offline', installed: inst, history: histo(null, inst), source: { url: 'https://github.com/VOTRE-PSEUDO/zombie-survival/releases/latest/download/latest.json', custom: false, configured: false, keyFingerprint: null },
      error: { code: 'NOT_CONFIGURED', message: "Mises à jour pas encore configurées : l'adresse de publication est provisoire.", context: 'check' } });
    await s.attendre(300);
    s.ok(/inactives/i.test(await s.texte('#status-title')), 'adresse provisoire : « Mises à jour inactives »', await s.texte('#status-title'));
    await s.capture('non-configure');
  },
  async sansJeu(s) {
    await s.emettre({ phase: 'error', installed: null, history: histo(null, null), error: { code: 'NO_GAME', message: 'Aucun jeu installé : cliquez sur Réparer.', context: 'bundle' } });
    await s.attendre(300);
    s.ok(await s.actif('#btn-main'), 'sans jeu : #btn-main actif (Réparer)');
    await s.capture('sans-jeu');
    await s.clic('#btn-main');
    s.ok((await s.appels()).some((a) => a.nom === 'repair'), 'sans jeu : un clic sur #btn-main appelle zs.repair()');
  },
  async erreurInstallation(s) {
    const inst = installe(LIVRE), m = manifeste('2.0.7', NOTES_207);
    await s.emettre({ phase: 'error', remote: { ...m.game }, installed: inst, history: histo(m, inst), error: { code: 'CHECKSUM', message: 'Le paquet téléchargé est abîmé (empreinte différente).', context: 'install' } });
    await s.attendre(300);
    s.ok(await s.actif('#btn-main'), 'erreur d’installation : #btn-main actif (Jouer)');
    await s.capture('erreur-installation');
  },
  async plantage(s) {
    const inst = installe(LIVRE);
    await s.emettre({ phase: 'error', installed: inst, history: histo(null, inst), error: { code: 'GAME_CRASH', message: 'Le jeu s’est fermé de façon inattendue : utilisez « Réparer le jeu » dans les réglages.', context: 'game' } });
    await s.attendre(300);
    await s.capture('plantage');
  },
  async nouveauLauncher(s) {
    const inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst), news: ACTUS, launcherUpdate: { version: '1.4.0', size: 9.8e7, notes: ['Nouvelle interface', 'Fenêtre redimensionnable'] } });
    await s.attendre(400);
    await s.capture('nouveau-launcher');
    s.ok(await s.installerLauncher(), 'nouveau launcher : le bouton du bandeau appelle zs.updateLauncher()');
    await s.emettre({ phase: 'downloading', progress: { phase: 'launcher', received: 3e7, total: 9.8e7, target: '1.4.0' } });
    await s.attendre(300);
    await s.capture('telechargement-launcher');
    await s.emettre({ phase: 'restarting', progress: null });
    await s.attendre(300);
    s.ok(!(await s.actif('#btn-main')), 'redémarrage : #btn-main inactif');
    await s.capture('redemarrage');
  },
  async partie(s) {
    const inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst) });
    await s.attendre(200);
    await s.emettre({ phase: 'playing', settings: { ...REGLAGES, keepLauncherOpen: true } });
    await s.attendre(400);
    s.ok(!(await s.actif('#btn-main')), 'partie : #btn-main inactif');
    await s.capture('partie');
    if (await s.interface() === 'nouvelle') {
      s.ok(!(await s.cache('#d-veille')), 'partie : la veille couvre le poste');
      s.ok(await page(s).evaluate(() => document.getElementById('d-hero').dataset.anime) === 'non', 'partie : le fond est en pause');
      await s.clic('#d-veille [data-act="revenirPartie"]');
      s.ok((await s.appels()).filter((a) => a.nom === 'play').length === 1, 'partie : « Revenir à la partie » appelle zs.play()');
      s.ok(await page(s).evaluate(() => { const b = document.querySelector('.d-nav [data-section="reglages"]').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e && !!e.closest('[data-section="reglages"]'); }), 'partie : la veille laisse la barre latérale utilisable');
      await s.clic('.d-nav [data-section="reglages"]');
      s.ok(await page(s).evaluate(() => document.getElementById('d-veille').hidden && !document.querySelector('[data-page="reglages"]').hidden), 'partie : les Paramètres s’ouvrent, sans veille');
      await s.clic('.d-nav [data-section="accueil"]');
      s.ok(!(await s.cache('#d-veille')), 'partie : de retour à l’accueil, la veille revient');
    }
  },
  async auteur(s) {
    const inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst), author: true });
    await s.attendre(400);
    s.ok(!(await s.cache('#btn-modtools')), 'auteur : #btn-modtools visible');
    await s.clic('#btn-modtools');
    s.ok((await s.appels()).some((a) => a.nom === 'openModtools'), 'auteur : #btn-modtools appelle zs.openModtools()');
    await s.capture('auteur');
  },
  // nouvelle interface : chaque page, ses actions et ses réglages
  async pages(s) {
    if (await s.interface() !== 'nouvelle') return;
    const p = page(s);
    const inst = installe(LIVRE, '2.0.5'), m = manifeste('2.0.7', NOTES_207, { history: [{ version: LIVRE, date: '2026-10-20T10:00:00Z', notes: ['Prise des armes refaite', 'Jeep d’archéologie', 'Khamsin compact', 'Personnage Anthony', 'Glissade', 'HUD des points'] }] });
    await s.emettre({ phase: 'update', remote: { ...m.game }, installed: inst, history: histo(m, inst), news: ACTUS, author: true, checkedAt: Date.now() });
    await s.attendre(300);
    await p.bringToFront();
    // navigation
    for (const [sec, nom] of [['actus', 'Actualités'], ['maj', 'Mises à jour'], ['installation', 'Installation'], ['modtools', 'Mod Tools'], ['reglages', 'Paramètres'], ['accueil', 'Accueil']]) {
      await s.clic(`.d-nav [data-section="${sec}"]`);
      const r = await p.evaluate((x) => ({ vue: [...document.querySelectorAll('.d-page')].filter((e) => !e.hidden).map((e) => e.dataset.page), fil: document.getElementById('d-fil').textContent,
        courant: document.querySelector('.d-nav [aria-current="page"]').dataset.section, deborde: document.getElementById('d-contenu').scrollWidth > document.getElementById('d-contenu').clientWidth }), sec);
      s.ok(r.vue.length === 1 && r.vue[0] === sec && r.fil === nom && r.courant === sec, `navigation : ${nom}`, r);
      s.ok(!r.deborde, `${nom} : pas de défilement horizontal`);
      if (sec !== 'accueil') await s.capture(`page-${sec}`);
    }
    // accueil : fond animé seulement sur l'accueil
    s.ok(await p.evaluate(() => document.getElementById('d-hero').dataset.anime) === 'oui', 'accueil : le fond est animé');
    s.ok(await p.evaluate(() => { const a = document.querySelector('#d-statut > i'), b = document.querySelector('#d-etat > i'); return getComputedStyle(a).backgroundColor === getComputedStyle(b).backgroundColor && getComputedStyle(a).backgroundColor === 'rgb(226, 49, 58)'; }), 'accueil : pastille de la ligne d’état à la couleur de l’état (mise à jour)');
    // une longue première note et la ligne d'état sur deux lignes : le bandeau grandit, rien n'est rogné
    const longue = { ...m.game, notes: ['Sélection de la carte au démarrage de chaque partie, avec le record de chaque carte et le temps passé sur chacune d’elles depuis le premier lancement du jeu', 'Nouveau launcher', 'Corrections diverses'] };
    await s.emettre({ phase: 'error', remote: longue, error: { code: 'CHECKSUM', message: 'Le paquet téléchargé est abîmé : son empreinte ne correspond pas à celle du manifeste signé. Réessayez, ou ouvrez le journal pour en savoir plus.', context: 'install' } });
    await s.attendre(200);
    const tient = await p.evaluate(() => { const h = document.getElementById('d-hero').getBoundingClientRect(), t = document.querySelector('.d-hero-texte').getBoundingClientRect(), sur = document.getElementById('d-sur').getBoundingClientRect(); return { haut: Math.round(t.top - h.top), sur: Math.round(sur.top - h.top), bas: Math.round(h.bottom - t.bottom), hauteur: Math.round(h.height) }; });
    s.ok(tient.haut >= 18 && tient.sur >= 18 && tient.bas >= 18, 'accueil : le texte tient dans le bandeau (note longue, erreur sur deux lignes)', tient);
    await s.capture('accueil-note-longue');
    await s.emettre({ phase: 'update', remote: { ...m.game }, error: null });
    await s.attendre(200);
    await s.clic('.d-nav [data-section="actus"]');
    s.ok(await p.evaluate(() => document.getElementById('d-hero').dataset.anime) === 'non', 'autre page : le fond est en pause');
    // actualités : trois cartes, lecture, Échap
    s.ok(await p.evaluate(() => document.querySelectorAll('#d-grille-actus .d-actu').length) === 3, 'actualités : trois communiqués');
    await s.clic('#d-grille-actus .d-actu');
    s.ok(await s.texte('#d-lecture-corps h2') === ACTUS[0].title && !(await s.cache('#d-lecture')), 'actualités : la lecture s’ouvre sur le communiqué');
    await s.capture('lecture');
    await p.keyboard.press('Escape');
    s.ok(await s.cache('#d-lecture'), 'actualités : Échap ferme la lecture');
    // mises à jour : carte de la nouvelle version, notes repliées puis dépliées
    await s.clic('.d-nav [data-section="maj"]');
    s.ok(await s.texte('#d-v-distante') === '2.0.7' && !(await s.cache('#d-v-dispo')), 'mises à jour : la 2.0.7 est proposée');
    const plus = await p.evaluate((v) => { const li = [...document.querySelectorAll('#d-chrono > li')].find((x) => x.dataset.version === v); return { n: li.querySelectorAll('ul li').length, lien: (li.querySelector('[data-plus]') || {}).textContent }; }, LIVRE);
    s.ok(plus.n === 3 && plus.lien === 'Voir les 3 autres notes', 'mises à jour : six notes repliées à trois', plus);
    await s.clic(`#d-chrono [data-plus="${LIVRE}"]`);
    s.ok(await p.evaluate((v) => [...document.querySelectorAll('#d-chrono > li')].find((x) => x.dataset.version === v).querySelectorAll('ul li').length, LIVRE) === 6, 'mises à jour : « Voir les 3 autres notes » les déplie');
    await s.clic('#d-v-dispo [data-act="install"]');
    s.ok((await s.appels()).some((a) => a.nom === 'install'), 'mises à jour : « Mettre à jour » appelle zs.install()');
    // cloche : une notification, la page des mises à jour
    s.ok(await s.texte('#d-cloche-n') === '1' && !(await s.cache('#d-cloche-n')), 'cloche : une notification');
    // installation : chiffres, retour à la précédente, dossier et journal
    await s.clic('.d-nav [data-section="installation"]');
    const ch = await p.evaluate(() => [...document.querySelectorAll('#d-chiffres .d-chiffre b')].map((b) => b.textContent));
    s.ok(ch[0] === LIVRE && ch[2] === '2.0.5' && /Mo$/.test(ch[3]) && /2026$/.test(ch[1]), 'installation : chiffres réels', ch);
    s.ok(await p.evaluate(() => { const b = document.querySelector('[data-page="installation"] [data-revenir]'); return !b.hidden && b.textContent === 'Revenir à la 2.0.5'; }), 'installation : « Revenir à la 2.0.5 »');
    await s.clic('[data-page="installation"] [data-act="dossier"]');
    await s.clic('[data-page="installation"] [data-act="journal"]');
    s.ok(JSON.stringify((await s.appels()).filter((a) => a.nom === 'open').map((a) => a.args[0])) === '["game","logs"]', 'installation : dossier et journal');
    // Mod Tools (auteur)
    await s.clic('.d-nav [data-section="modtools"]');
    s.ok(await s.cache('#d-verrou'), 'Mod Tools : pas de verrou pour l’auteur');
    await s.clic('[data-page="modtools"] [data-act="modtools"]');
    await s.clic('[data-page="modtools"] [data-act="publication"]');
    const ap = (await s.appels()).map((a) => a.nom);
    s.ok(ap.includes('openModtools') && ap.includes('openPublisher'), 'Mod Tools : ouvrir et publication');
    // paramètres : réglages du fond cachés tant que le processus principal ne les connaît pas (launcher 1.3.3)
    await s.clic('.d-nav [data-section="reglages"]');
    const lignesFond = () => p.evaluate(() => ['fond', 'fondAnime', 'fondEclairs', 'volumeSons'].map((k) => document.querySelector(`[data-reglage="${k}"]`).closest('[data-ligne]').hidden));
    await s.emettre({ settings: { ...REGLAGES_133 } });
    await s.attendre(100);
    s.ok((await lignesFond()).every(Boolean), 'paramètres : réglages du fond cachés sans le processus principal 1.4.0');
    await s.clic('label:has([data-reglage="keepLauncherOpen"])');
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'keepLauncherOpen' && a.args[1] === true), 'paramètres : l’interrupteur appelle zs.setSetting');
    await s.emettre({ settings: { ...REGLAGES } });
    await s.attendre(100);
    s.ok((await lignesFond()).every((h) => !h), 'paramètres : réglages du fond visibles avec le processus principal 1.4.0');
    await s.clic('label:has([data-reglage="fondAnime"])');
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'fondAnime' && a.args[1] === false), 'paramètres : fond animé coupé');
    await s.emettre({ settings: { ...REGLAGES, fondAnime: false } });
    await s.clic('.d-nav [data-section="accueil"]');
    s.ok(await p.evaluate(() => { const h = document.getElementById('d-hero'); return h.dataset.anime === 'non' && h.classList.contains('fond-fixe'); }), 'accueil : fond fixe quand le réglage est coupé');
    // fenêtre : Agrandir quand le processus principal donne l'état de la fenêtre
    await s.emettre({ windowState: { maximized: false } });
    await s.attendre(100);
    s.ok(!(await s.cache('#d-agrandir')), 'fenêtre : bouton Agrandir');
    await s.clic('#d-agrandir');
    s.ok((await s.appels()).some((a) => a.nom === 'windowAction' && a.args[0] === 'maximize'), 'fenêtre : Agrandir appelle zs.windowAction("maximize")');
    await s.emettre({ windowState: { maximized: true } });
    await s.attendre(100);
    s.ok(await p.evaluate(() => document.getElementById('fenetre').classList.contains('agrandie')), 'fenêtre : icône « Restaurer » une fois agrandie');
    await s.capture('accueil-maj');
  },
  // fond des Marécages Maudits : vidéo, affiche, éclairs, sons de l'ambiance, volume, pauses, Bunker 7
  async marais(s) {
    if (await s.interface() !== 'nouvelle') return;
    const p = page(s), inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst), news: ACTUS });
    await s.apresOuverture();
    await p.bringToFront();
    const F = () => p.evaluate(() => { const v = ZS_FOND.video(), a = ZS_FOND.sons(); return { fond: document.getElementById('d-hero').dataset.fond, video: v && v.etat(), sons: a && a.etat(),
      sur: document.getElementById('d-sur').textContent, legende: document.getElementById('d-legende').textContent, lecteurs: document.querySelectorAll('.d-hero-video').length }; });
    const attendre = (fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
    let f = await F();
    s.ok(f.fond === 'marais' && f.lecteurs === 2 && f.sur === 'Rapport d’incident · Les Marécages Maudits · nuit' && /Mère-Vase/.test(f.legende), 'Marécages : fond par défaut, deux lecteurs, textes de la carte', f);
    s.ok(f.sons && f.sons.contexte === 'aucun', 'sons : aucun contexte audio au démarrage', f.sons);
    s.ok(await attendre(() => { const e = ZS_FOND.video().etat(); return e.joue && !e.affiche; }, null, 40000), 'vidéo : elle joue à l’accueil', (await F()).video);
    f = await F();
    s.ok(f.video.premiereImage >= f.video.instantAffiche - 0.001 && f.video.premiereImage < f.video.instantAffiche + 0.1, 'vidéo : la lecture part de l’image de l’affiche', f.video);
    await s.capture('marais-accueil');
    // éclairs coupés pendant la lecture : la version sans éclairs prend le relais, sans affiche ni arrêt
    await s.emettre({ settings: { ...REGLAGES, fondEclairs: false } });
    s.ok(await attendre(() => { const e = ZS_FOND.video().etat(); return e.version === 'sans' && !e.enBascule && e.joue; }), 'éclairs coupés : relais par la version sans éclairs', (await F()).video);
    f = await F();
    s.ok(!f.video.affiche && f.video.bascule && f.video.bascule.version === 'sans', 'éclairs coupés : sans repasser par l’affiche', f.video.bascule);
    await s.emettre({ settings: { ...REGLAGES } });
    s.ok(await attendre(() => { const e = ZS_FOND.video().etat(); return e.version === 'avec' && !e.enBascule && e.joue; }), 'éclairs rallumés : relais par la version avec éclairs');
    // réglages : éclairs (enregistrés), sons (page seulement), volume (retenu, enregistré au relâchement, entendu à l'accueil)
    await s.clic('.d-nav [data-section="reglages"]');
    s.ok(await attendre(() => !ZS_FOND.video().etat().joue && ZS_FOND.video().etat().affiche, null, 5000), 'vidéo : en pause hors de l’accueil, l’affiche à la place');
    await s.clic('label:has([data-reglage="fondEclairs"])');
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'fondEclairs' && a.args[1] === false), 'éclairs : l’interrupteur appelle zs.setSetting');
    await s.emettre({ settings: { ...REGLAGES, fondEclairs: false } });   // la réponse de main.js (setStatus)
    s.ok(await p.evaluate(() => ZS_FOND.video().etat().version === 'sans' && !document.querySelector('[data-reglage="fondEclairs"]').checked), 'éclairs : coupés après la réponse du processus principal');
    await s.clic('label:has([data-reglage="fondEclairs"])');
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'fondEclairs' && a.args[1] === true), 'éclairs : l’interrupteur les rallume');
    await s.emettre({ settings: { ...REGLAGES } });
    s.ok(await p.evaluate(() => document.getElementById('d-volume').disabled), 'volume : inactif tant que les sons sont coupés');
    await s.clic('label:has(#d-sons)');
    s.ok(await p.evaluate(() => ZS_FOND.sonsAllumes() && !document.getElementById('d-volume').disabled), 'sons : l’interrupteur les allume, le volume devient réglable');
    s.ok(!(await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'fondSons'), 'sons : pas enregistrés (coupés au prochain lancement)');
    await p.evaluate(() => { const i = document.getElementById('d-volume'); i.value = '40'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'volumeSons' && a.args[1] === 40) && await s.texte('#d-volume-val') === '40\u00a0%'
      && await p.evaluate(() => document.getElementById('d-volume').getAttribute('aria-valuetext')) === '40\u00a0%', 'volume : 40 %, enregistré, annoncé avec son unité', await s.texte('#d-volume-val'));
    await s.capture('marais-reglages');
    await s.emettre({ settings: { ...REGLAGES, volumeSons: 40 } });
    // à l'accueil : la pluie, puis le tonnerre de l'éclair de la boucle
    await s.clic('.d-nav [data-section="accueil"]');
    s.ok(await attendre(() => { const e = ZS_FOND.sons().etat(); return e.contexte === 'running' && e.charges === 11 && e.nappes === 4; }), 'sons : 11 sons décodés, 4 nappes de pluie', (await F()).sons);
    await s.attendre(2000);
    const niv = await p.evaluate(() => ZS_FOND.sons().niveau());
    f = await F();
    s.ok(niv > -60 && Math.abs(f.sons.volume - 0.4) < 0.02, 'sons : la pluie à l’accueil, au volume réglé (40 %)', { niveau: niv, volume: f.sons.volume });
    const avant = f.sons.tonnerres;
    await p.evaluate(() => ZS_FOND.video().provoquer());
    s.ok(await attendre((n) => ZS_FOND.sons().etat().tonnerres > n, avant, 15000), 'sons : le tonnerre suit l’éclair de la vidéo');
    // pauses : autre page, partie en cours, fond de Bunker 7 ; reprise à l'accueil
    await s.clic('.d-nav [data-section="actus"]');
    s.ok(await attendre(() => ZS_FOND.sons().etat().contexte === 'suspended' && !ZS_FOND.video().etat().joue, null, 5000), 'pause : autre page (son suspendu, vidéo arrêtée)');
    await s.clic('.d-nav [data-section="accueil"]');
    s.ok(await attendre(() => ZS_FOND.sons().etat().contexte === 'running' && ZS_FOND.video().etat().joue, null, 20000), 'reprise : retour à l’accueil');
    await s.emettre({ phase: 'playing' });
    s.ok(await attendre(() => ZS_FOND.sons().etat().contexte === 'suspended' && !ZS_FOND.video().etat().joue, null, 5000), 'pause : partie en cours');
    await s.emettre({ phase: 'ready' });
    await s.emettre({ settings: { ...REGLAGES, volumeSons: 40, fond: 'bunker' } });
    s.ok(await attendre(() => document.getElementById('d-hero').dataset.fond === 'bunker' && ZS_FOND.sons().etat().contexte === 'suspended' && !ZS_FOND.video().etat().joue
      && document.getElementById('d-sur').textContent.includes('Bunker 7') && document.getElementById('d-legende').textContent === '', null, 5000), 'Bunker 7 : son et vidéo arrêtés, textes de Bunker 7');
    await s.attendre(1000);
    s.ok(await p.evaluate(() => { const e = ZS_FOND.sons().etat(); return e.contexte === 'suspended' && e.volume < 0.01; }), 'Bunker 7 : toujours le silence une seconde après (contexte suspendu, gain nul)', (await F()).sons);
    await s.capture('marais-bunker');
    await s.clic('.d-nav [data-section="reglages"]');
    s.ok(await p.evaluate(() => document.getElementById('d-sons').disabled && document.querySelector('[data-reglage="fondEclairs"]').disabled), 'Bunker 7 : éclairs et sons inactifs dans les paramètres');
    await p.selectOption('[data-reglage="fond"]', 'marais');
    s.ok((await s.appels()).some((a) => a.nom === 'setSetting' && a.args[0] === 'fond' && a.args[1] === 'marais'), 'fond : la liste appelle zs.setSetting');
    await s.emettre({ settings: { ...REGLAGES, volumeSons: 40 } });
    await s.clic('label:has(#d-sons)');
    await s.clic('.d-nav [data-section="accueil"]');
    s.ok(await attendre(() => !ZS_FOND.sonsAllumes() && ZS_FOND.sons().etat().contexte === 'suspended' && ZS_FOND.video().etat().joue, null, 20000), 'sons coupés : silence, la vidéo continue');
    await s.attendre(1000);
    s.ok(await p.evaluate(() => { const e = ZS_FOND.sons().etat(); return !e.veut && e.contexte === 'suspended'; }), 'sons coupés : toujours le silence une seconde après', (await F()).sons);
  },
  // pannes : sons introuvables, vidéo illisible
  async maraisPannes(s) {
    if (await s.interface() !== 'nouvelle') return;
    const p = page(s), inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst) });
    await s.apresOuverture();
    await p.bringToFront();
    await p.evaluate(() => { window.__fauxZs.reponses.ambiance = { rejet: 'Sons de l’ambiance introuvables.' }; });
    await s.clic('.d-nav [data-section="reglages"]');
    await s.clic('label:has(#d-sons)');
    await s.clic('.d-nav [data-section="accueil"]');
    await s.attendre(800);
    await s.clic('.d-nav [data-section="reglages"]');
    const r = await p.evaluate(() => ({ coupe: !ZS_FOND.sonsAllumes(), inactif: document.getElementById('d-sons').disabled, note: document.getElementById('d-sons-note').textContent,
      bulle: [...document.querySelectorAll('.d-bulle.erreur')].map((b) => b.textContent).join(' | ') }));
    s.ok(r.coupe && r.inactif && /Indisponibles sur ce PC : Sons de l’ambiance introuvables\./.test(r.note) && /introuvables/.test(r.bulle), 'sons introuvables : interrupteur coupé et inactif, message', r);
    await s.capture('marais-sons-introuvables');
    await s.clic('.d-nav [data-section="accueil"]');
    await p.evaluate(() => document.querySelector('.d-hero-video').dispatchEvent(new Event('error')));
    await s.attendre(300);
    const v = await p.evaluate(() => ({ fond: document.getElementById('d-hero').dataset.fond, bulle: [...document.querySelectorAll('.d-bulle.erreur')].map((b) => b.textContent).join(' | ') }));
    s.ok(v.fond === 'bunker' && /Bunker 7 à la place/.test(v.bulle), 'vidéo illisible : Bunker 7 à la place, message', v);
  },
  async miseAJourFaite(s) {
    const inst = installe(LIVRE), m = manifeste(LIVRE, ['Version livrée avec le launcher']);
    const bulle = () => page(s).evaluate(() => { const b = [...document.querySelectorAll('.d-bulle')].find((x) => /Launcher mis à jour/.test(x.textContent)); return b ? { texte: b.textContent, visible: b.classList.contains('visible') } : null; });
    const nouvelle = await s.interface() === 'nouvelle';
    if (nouvelle) s.ok(!(await bulle()), 'launcher mis à jour : pas de bulle sous l’écran d’ouverture');
    await s.emettre({ phase: 'ready', remote: { ...m.game }, installed: inst, history: histo(m, inst) });
    await s.apresOuverture();
    await s.attendre(300);
    const b = await bulle();
    if (nouvelle) s.ok(b && b.visible && b.texte.includes(`version ${LAUNCHER}`), 'launcher mis à jour : bulle visible après l’écran d’ouverture', b);
    await s.capture('launcher-mis-a-jour');
  },
};
// état de départ propre à un scénario (lu par la page dans sa première réponse de status())
SCENARIOS.miseAJourFaite.depart = { justUpdated: LAUNCHER };

/* ------------------------------------------------------------------ outils d'un scénario */
function outils(page, nom, verifs) {
  const s = {
    emettre: (p) => page.evaluate((x) => window.__fauxZs.emettre(x), p),
    attendre: (ms) => page.waitForTimeout(ms),
    appels: () => page.evaluate(() => window.__fauxZs.appels),
    texte: (sel) => page.evaluate((x) => { const e = document.querySelector(x); return e ? e.textContent : null; }, sel),
    actif: (sel) => page.evaluate((x) => { const e = document.querySelector(x); return !!e && !e.disabled; }, sel),
    cache: (sel) => page.evaluate((x) => { const e = document.querySelector(x); return !e || e.hidden; }, sel),
    // la nouvelle interface s'ouvre sur un écran de titre (une seconde au moins) : on attend sa fin
    apresOuverture: () => page.waitForFunction(() => { const o = document.getElementById('d-ouverture'); return !o || o.classList.contains('fini'); }, null, { timeout: 4000 }),
    clic: async (sel) => { await s.apresOuverture(); await page.click(sel, { timeout: 5000 }); },
    ok: (c, m, x) => verifs.push({ ok: !!c, m: `${nom} · ${m}`, x }),
    capture: async (n, tel) => { if (!tel) await s.apresOuverture(); await page.screenshot({ path: path.join(OUT, `${nom}-${n}.png`), animations: 'disabled' }); },
    page,
    interface: () => page.evaluate(() => (document.getElementById('dossier') ? 'ancienne' : 'nouvelle')),
    // liens d'état (Annuler, Réessayer) : #link-a et #link-b dans les deux interfaces, cherchés par leur texte
    async lien(motif) {
      return page.evaluate((m) => {
        const re = new RegExp(m, 'i');
        const b = [...document.querySelectorAll('button, a')].find((x) => !x.hidden && x.offsetParent !== null && re.test(x.textContent));
        if (b) b.click();
        return !!b;
      }, motif);
    },
    async annuler() { return s.lien('^\\s*annuler\\s*$'); },
    async reessayer() { await s.lien('^\\s*réessayer\\s*$'); return (await s.appels()).some((a) => a.nom === 'check'); },
    async installerLauncher() {
      const fait = await page.evaluate(() => { const b = document.getElementById('lu-install') || document.getElementById('d-bandeau-btn'); if (b && !b.disabled) b.click(); return !!b; });
      return fait && (await s.appels()).some((a) => a.nom === 'updateLauncher');
    },
    // l'historique : la page des mises à jour dans la nouvelle interface ; dans l'ancienne, la fiche et sa fenêtre
    async historique(m, inst) {
      if (await s.interface() === 'nouvelle') {
        // la page des mises à jour : chronologie de toutes les versions, tampon, notes sans tiret, dates en français
        await s.clic('.d-nav [data-section="maj"]');
        const chrono = await page.evaluate(() => [...document.querySelectorAll('#d-chrono > li')].map((li) => ({ v: li.dataset.version,
          tampon: [...li.querySelectorAll('.d-tampon')].map((t) => t.textContent).join('+'), date: li.querySelector('header small').textContent, notes: [...li.querySelectorAll('ul li')].map((x) => x.textContent) })));
        s.ok(chrono.length === histo(m, inst).length && chrono[0].v === '2.0.7' && chrono[0].tampon === 'Installée', 'historique : chronologie et tampon', chrono.map((c) => `${c.v}:${c.tampon}`));
        s.ok(chrono[0].notes.join('|') === 'Sélection de la carte|Nouveau launcher|Corrections diverses', 'historique : notes sans tiret ni puce', chrono[0].notes);
        s.ok(chrono.every((c) => /^\d+ \S+ \d{4}$/.test(c.date) || c.date === 'Date inconnue'), 'historique : dates en français', chrono.map((c) => c.date).slice(0, 4));
        s.ok(await s.texte('#d-v-installee') === '2.0.7' && await s.texte('#d-v-tampon') === 'À jour', 'historique : version installée 2.0.7, à jour', [await s.texte('#d-v-installee'), await s.texte('#d-v-tampon')]);
        await s.capture('historique');
        return;
      }
      s.ok(await page.evaluate(() => document.querySelector('#dossier.clickable') !== null && document.getElementById('dossier').getAttribute('role') === 'button'), 'historique : fiche cliquable');
      s.ok(await page.evaluate(() => document.querySelector('#notes-list li').textContent.startsWith('Sélection de la carte')), 'historique : première note sans tiret');
      await page.click('#notes-title');
      await page.waitForFunction(() => !document.getElementById('history').hidden, null, { timeout: 5000 });
      const liste = await page.evaluate(() => [...document.querySelectorAll('#history-list .hl-item')].map((e) => `${e.querySelector('.hl-v').textContent}:${(e.querySelector('.hl-badge') || {}).textContent || ''}`));
      s.ok(liste[0] === 'v2.0.7:Installée' && liste.length === histo(m, inst).length, 'historique : liste et badge', liste);
      await page.keyboard.press('ArrowDown');
      s.ok(/^Publiée le \d+ \S+ \d{4}$/.test(await s.texte('#hs-meta').then((t) => t.split(' · ')[0])), 'historique : date en français', await s.texte('#hs-meta'));
      await s.capture('historique');
      await page.keyboard.press('Escape');
      s.ok(await page.evaluate(() => document.getElementById('history').hidden && document.activeElement && document.activeElement.id === 'dossier'), 'historique : Échap ferme, focus sur la fiche');
    },
  };
  return s;
}
const page = (s) => s.page;

/* ------------------------------------------------------------------ marche */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const choix = val('--scenarios', null);
  const noms = choix ? choix.split(',') : Object.keys(SCENARIOS);
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  const verifs = [];
  for (const nom of noms) {
    const ctx = await browser.newContext({ viewport: { width: LARG, height: HAUT }, deviceScaleFactor: 1, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
    await ctx.addInitScript({ content: `window.__fauxZsDepart = ${JSON.stringify({ ...depart(), ...(SCENARIOS[nom].depart || {}) })};` });
    if (AMBIANCE) await ctx.addInitScript({ content: `window.__fauxZsAmbiance = ${JSON.stringify(AMBIANCE)};` });
    await ctx.addInitScript({ path: path.join(__dirname, 'faux-zs.js') });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(`console : ${m.text()}`); });
    await page.goto('file://' + PAGE);
    const s = outils(page, nom, verifs);
    // contrats des essais, avant tout état : ce que la page porte dès son chargement
    s.ok(await page.evaluate(() => { const b = document.getElementById('btn-main'); return !!b && b.tagName === 'BUTTON' && b.disabled; }), 'au chargement : #btn-main est un bouton désactivé');
    s.ok(await s.texte('#status-title') === 'Ouverture du bunker…', 'au chargement : #status-title vaut « Ouverture du bunker… »', await s.texte('#status-title'));
    s.ok(await page.evaluate(() => { const b = document.getElementById('btn-modtools'); return !!b && b.hidden; }), 'au chargement : #btn-modtools caché');
    try { await SCENARIOS[nom](s); } catch (e) { s.ok(false, `exception : ${e.message.split('\n')[0]}`); }
    await s.capture('fin');
    const f = await page.evaluate(() => ({ violations: window.__fauxZs.violations, erreurs: window.__fauxZs.erreurs, open: window.__fauxZs.appels.filter((a) => a.nom === 'open').map((a) => a.args[0]) }));
    s.ok(erreurs.length === 0 && f.erreurs.length === 0, 'aucune erreur de page', [...erreurs, ...f.erreurs]);
    s.ok(f.violations.length === 0, 'aucun refus de la politique de sécurité', f.violations);
    s.ok(f.open.every((w) => w === 'game' || w === 'logs'), 'zs.open ne reçoit que « game » ou « logs »', f.open);
    await ctx.close();
  }
  await browser.close();
  for (const v of verifs) console.log(`${v.ok ? '  ok ' : '  ÉCHEC'} ${v.m}${!v.ok && v.x !== undefined ? ' · ' + JSON.stringify(v.x).slice(0, 300) : ''}`);
  const echecs = verifs.filter((v) => !v.ok).length;
  console.log(`${verifs.length - echecs} vérifications sur ${verifs.length} · interface ${fs.existsSync(PAGE) ? 'de src/renderer/launcher' : '?'} · captures dans ${OUT}`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
