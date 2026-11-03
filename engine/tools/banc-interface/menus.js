'use strict';
/* Banc des menus du jeu (refonte de l'interface) : captures et mesures du menu principal, de la sélection des
   cartes (survol, choix) et des options, à plusieurs tailles de fenêtre. Aucun fichier du jeu n'est modifié.

     node engine/tools/banc-interface/menus.js <dossier> [--tailles 1920x1080,1280x720,3440x1440,960x540]
          [--apercus <dossier d'essai>] [--launcher] [--reprendre] [--ecrans] [--videos] [--memoire]

   --apercus : sert apercus/ depuis un dossier d'essai (manifeste et vidéos) et contrôle le lecteur : une seule vidéo,
   déchargée en quittant la sélection, repli sur l'image si la vidéo est illisible (khamsin : vidéo lisible ;
   ombre : fichier cassé). --launcher : faux window.zsLauncher (le bouton Quitter apparaît, rien ne quitte).
   --reprendre : une partie sauvegardée (le bouton Reprendre apparaît ; jamais cliqué).
   --videos : avec le vrai manifeste (launcher/game/apercus/), chaque carte qui a une vidéo déclarée est survolée :
   la vidéo doit jouer, seule, et disparaître en quittant la sélection ; une capture par carte.
   --memoire : 30 ouvertures de la sélection, chaque carte à vidéo survolée, puis fermeture ; tas JavaScript (après
   ramasse-miettes), nœuds du document, vidéos et toiles comptés avant et après (fuites).
   --ecrans : à la première taille, le menu sur Khamsin et sur Ombre éternelle (ambiance 2D), puis les autres
   écrans (Statistiques, Modèles, Ranking, Amélioration d'arme, Options), une partie lancée puis mise en pause,
   et la fin de partie.

   LOURD : le jeu entier en rendu logiciel (SwiftShader), au menu seulement (aucune partie lancée), environ 3 Go.
   Toujours par la file commune des tâches lourdes (consigne d'Anthony du 2 novembre 2026) :
     ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "banc des menus" -- node engine/tools/banc-interface/menus.js <dossier>
   Hors de la file, il refuse de partir. Souris verrouillée refusée, bandeau #lockhint masqué. Il faut préparer le jeu
   d'abord (node launcher/scripts/prepare-game.js). Résultat : images PNG et mesures.json dans <dossier>. */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(REPO, 'launcher', 'game');
const argv = process.argv.slice(2);
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage : node engine/tools/banc-interface/menus.js <dossier> [--tailles 1920x1080,…]'); process.exit(2); }
const OUT = path.resolve(argv[0]);
if (OUT === path.resolve(REPO) || OUT.startsWith(path.resolve(REPO) + path.sep)) { console.error('le dossier de sortie doit être hors du dépôt'); process.exit(2); }
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const TAILLES = val('--tailles', '1920x1080,1280x720,3440x1440,960x540').split(',').map((t) => t.split('x').map(Number));
const APERCUS = argv.includes('--apercus') ? path.resolve(val('--apercus')) : null;
const LAUNCHER = argv.includes('--launcher'), REPRENDRE = argv.includes('--reprendre'), ECRANS = argv.includes('--ecrans'), VIDEOS = argv.includes('--videos'), MEMOIRE = argv.includes('--memoire');
if (!(process.env.ZS_LOURD_CLASSE === 'jeu' && process.env.ZS_LOURD_PLACE && fs.existsSync(process.env.ZS_LOURD_PLACE))) {
  console.error('banc lourd : le lancer par la file commune (~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "…" -- node …)');
  process.exit(3);
}
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
fs.mkdirSync(OUT, { recursive: true });

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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = APERCUS && rel.startsWith('/apercus/') ? APERCUS : ROOT;
  const p = path.join(base, base === ROOT ? rel : rel.slice('/apercus'.length));
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

/* Mesures dans la page : chevauchements entre zones, débordements de la fenêtre et des textes. */
function mesurer(zones) {
  const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { s, x: b.left, y: b.top, r: b.right, b: b.bottom }; };
  const bs = zones.map(r).filter(Boolean), chev = [], hors = [];
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (a.x < -1 || a.y < -1 || a.r > innerWidth + 1 || a.b > innerHeight + 1) hors.push(a.s);
    for (let j = i + 1; j < bs.length; j++) {
      const c = bs[j], w = Math.min(a.r, c.r) - Math.max(a.x, c.x), h = Math.min(a.b, c.b) - Math.max(a.y, c.y);
      if (w > 1 && h > 1) chev.push(`${a.s} × ${c.s}`);
    }
  }
  const textes = [...document.querySelectorAll('.ifc-item, .ms-name, .ifc-f-nom, .ifc-r-zone, .ifc-logo, .panel h2')]
    .filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.className);
  const ecran = document.querySelector('.screen:not([hidden])');
  return { chevauchements: chev, horsFenetre: hors, textesCoupes: textes, defile: ecran ? ecran.scrollHeight > ecran.clientHeight + 1 : false,
    police: getComputedStyle(document.querySelector('#menu')).fontSize };
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--expose-gc'] });
  const [w0, h0] = TAILLES[0];
  const page = await browser.newPage({ viewport: { width: w0, height: h0 } });
  page.setDefaultTimeout(300000);                  // 3440 × 1440 en rendu logiciel : clics et attentes très lents
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  // souris verrouillée refusée (incident du 1er novembre 2026) ; le bandeau qui la propose est masqué
  await page.addInitScript((launcher) => {
    if (launcher) window.zsLauncher = { quit() { console.log('quitter (faux launcher du banc)'); } };
    Element.prototype.requestPointerLock = () => Promise.reject(new DOMException('refusée par le banc', 'NotAllowedError'));
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#lockhint { display: none !important; }'; document.head.append(s); });
  }, LAUNCHER);
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 900000, polling: 1000 });
  console.log(`menu en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (REPRENDRE) await page.evaluate(() => { G.save = { round: 7 }; refreshMenu(); showScreen('menu'); });
  // en rendu logiciel, une image du jeu prend plusieurs secondes : la boucle est espacée (une image toutes les
  // 1,2 s au moins, deux fois la durée d'une image) pour laisser au navigateur le temps de composer les captures ; la logique des écrans est inchangée
  await page.evaluate(() => {
    // la lecture d'un pixel attend que le rendu logiciel ait fini l'image : sans elle, la durée mesurée n'est que
    // celle de l'envoi des commandes, et en 3440 × 1440 les images s'empilent jusqu'à bloquer la page
    const f0 = frame, gl = renderer.getContext(), px = new Uint8Array(4); let der = 0, pause = 1200;
    window.frame = function (t) {
      if (performance.now() - der < pause) { requestAnimationFrame(window.frame); return; }
      const d = performance.now(); f0(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); der = performance.now();
      pause = Math.max(1200, 2 * (der - d));
    };
  });
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const images = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const cliche = async (nom, w, h) => { const f = `${w}x${h}-${nom}.png`; await page.screenshot({ path: path.join(OUT, f), animations: 'disabled', timeout: 180000 }); console.log('capture', f); };
  const mesures = {};
  for (const [w, h] of TAILLES) {
    const m = mesures[`${w}x${h}`] = {};
    await page.setViewportSize({ width: w, height: h });
    await page.mouse.move(w / 2, h / 2);
    await images(3);
    await attendre(600);
    // menu principal : JOUER surligné (focus), puis survol de Statistiques
    m.menu = await page.evaluate(mesurer, ['.ifc-tete', '.ifc-nav', '.ifc-pied', '#dossier']);
    m.menu.ordre = await page.evaluate(() => [...document.querySelectorAll('#menu .actions .btn')].filter((b) => !b.hidden).map((b) => b.id));
    m.menu.actif = await page.evaluate(() => (document.querySelector('#menu .ifc-actif') || {}).id);
    m.menu.rapport = await page.evaluate(() => ({ zone: document.querySelector('.ifc-r-zone').textContent, faits: document.querySelector('#dossier .ifc-faits').textContent, plan: !!document.querySelector('.ifc-r-plan canvas, .ifc-r-plan img') }));
    await cliche('menu', w, h);
    await page.hover('#btn-stats');
    await attendre(400);
    m.menu.survol = await page.evaluate(() => (document.querySelector('#menu .ifc-actif') || {}).id);
    await cliche('menu-survol', w, h);
    // clavier : deux fois flèche bas depuis JOUER
    await page.mouse.move(w / 2, h / 2);
    await page.evaluate(() => document.getElementById('btn-play').focus());
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    m.menu.clavier = await page.evaluate(() => document.activeElement.id);
    // sélection des cartes
    await page.click('#btn-play');
    await page.waitForFunction(() => !document.getElementById('mapsel').hidden);
    await attendre(700);
    m.selection = await page.evaluate(mesurer, ['.ifc-rail', '.ifc-liste-col', '.ifc-fiche-col']);
    m.selection.fiche = await page.evaluate(() => document.querySelector('.ifc-f-nom').textContent);
    await cliche('selection', w, h);
    const ids = await page.evaluate(() => [...document.querySelectorAll('#ms-grid .ms-card')].map((c) => c.dataset.id));
    const autre = ids.find((id) => id !== 'bunker7') || ids[0];
    await page.hover(`#ms-grid .ms-card[data-id="${autre}"]`);
    await attendre(800);
    m.selection.survol = await page.evaluate(() => ({ sel: MapSel.sel, fiche: document.querySelector('.ifc-f-nom').textContent, choix: document.querySelector('.ifc-f-choix').textContent,
      couches: [...document.querySelectorAll('.ifc-couche')].map((c) => `${c.classList.contains('on') ? 'on' : 'off'}:${c.firstChild ? c.firstChild.tagName : '-'}`),
      fige: IFC.images }));
    await cliche('selection-survol', w, h);
    const der = ids[ids.length - 1];
    await page.click(`#ms-grid .ms-card[data-id="${der}"]`);
    await page.mouse.move(w - 20, h - 20);
    await attendre(800);
    m.selection.choix = await page.evaluate(() => ({ sel: MapSel.sel, fiche: document.querySelector('.ifc-f-nom').textContent, choix: document.querySelector('.ifc-f-choix').textContent }));
    await cliche('selection-choix', w, h);
    if (VIDEOS) {
      m.videos = {};
      await page.waitForFunction(() => IFC.manifeste, null, { timeout: 30000 });
      const decl = await page.evaluate(() => Object.keys(IFC.manifeste).filter((id) => IFC.manifeste[id].video && MAPS.byId[id]));
      for (const id of decl) {
        await page.hover(`#ms-grid .ms-card[data-id="${id}"]`);
        const joue = await page.waitForFunction((id) => IFC.apercu === id && document.querySelector('.ifc-apercu.ifc-video-on') && IFC.video && IFC.video.v.currentTime > 0.3, id, { timeout: 120000 }).then(() => true, () => false);
        m.videos[id] = { joue, n: await page.evaluate(() => document.querySelectorAll('video').length), affiche: await page.evaluate(() => (document.querySelector('.ifc-couche.on img') || {}).src || '') };
        await cliche(`selection-video-${id}`, w, h);
      }
      await page.mouse.move(w - 20, h - 20);
    }
    if (APERCUS) {
      // lecteur : vidéo lisible (khamsin), puis fichier cassé (ombre) : l'image reste ; une seule vidéo à la fois
      await page.hover('#ms-grid .ms-card[data-id="khamsin"]');
      const vu = await page.waitForFunction(() => document.querySelector('.ifc-apercu.ifc-video-on'), null, { timeout: 60000 }).then(() => true, () => false);
      m.lecteur = { joue: vu, video: await page.evaluate(() => ({ n: document.querySelectorAll('video').length, t: IFC.video ? IFC.video.v.currentTime : -1, src: IFC.video ? IFC.video.v.src.slice(0, 5) : '' })) };
      await cliche('selection-video', w, h);
      await page.hover('#ms-grid .ms-card[data-id="ombre"]');
      await attendre(4000);
      m.lecteur.casse = await page.evaluate(() => ({ n: document.querySelectorAll('video').length, on: !!document.querySelector('.ifc-apercu.ifc-video-on'),
        image: !!document.querySelector('.ifc-couche.on img, .ifc-couche.on canvas'), note: getComputedStyle(document.querySelector('.ifc-apercu-note')).display }));
      await page.hover('#ms-grid .ms-card[data-id="khamsin"]');
      await page.waitForFunction(() => document.querySelector('.ifc-apercu.ifc-video-on'), null, { timeout: 60000 }).catch(() => {});
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('menu').hidden);
      m.lecteur.quitte = await page.evaluate(() => ({ n: document.querySelectorAll('video').length, video: !!IFC.video }));
      await page.click('#btn-play');
      await page.waitForFunction(() => !document.getElementById('mapsel').hidden);
      await page.mouse.move(w - 20, h - 20);
      await attendre(500);
    }
    await page.click(`#ms-grid .ms-card[data-id="bunker7"]`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('menu').hidden);
    // options
    await page.click('#btn-options');
    await page.waitForFunction(() => !document.getElementById('options').hidden);
    await attendre(300);
    await cliche('options', w, h);
    await page.keyboard.press('Escape');
    m.options = { echapRetour: await page.evaluate(() => !document.getElementById('menu').hidden) };
    console.log(`${w}x${h}`, JSON.stringify(m));
  }
  if (ECRANS) {
    const [w, h] = TAILLES[0], e = mesures.ecrans = {};
    await page.setViewportSize({ width: w, height: h });
    await page.mouse.move(w / 2, h / 2);
    for (const id of ['khamsin', 'ombre']) {
      // la première image d'un monde ouvert compile ses shaders (plusieurs dizaines de secondes en rendu logiciel) :
      // attendre deux images réellement rendues après le chargement
      const f0 = await page.evaluate((id) => { __zs.map(id); showScreen('menu'); return renderer.info.render.frame; }, id);
      await page.waitForFunction((f0) => renderer.info.render.frame >= f0 + 2, f0, { polling: 500 });
      await attendre(1500);
      e[id] = await page.evaluate(() => ({ zone: document.querySelector('.ifc-r-zone').textContent, ambiance: IFC_AMB.sorte, toile: !IFC_AMB.toile.hidden, anime: !!IFC_AMB.raf, n: IFC_AMB.parts.length }));
      await cliche(`menu-${id}`, w, h);
    }
    await page.evaluate(() => { __zs.map('bunker7'); showScreen('menu'); });
    await images(3);
    for (const [b, ecran] of [['#btn-stats', 'stats'], ['#btn-models', 'models'], ['#btn-ranking', 'ranking'], ['#btn-mods', 'mods']]) {
      await page.click(b);
      await page.waitForFunction((x) => !document.getElementById(x).hidden, ecran);
      await attendre(ecran === 'models' ? 2500 : 600);
      e[ecran] = await page.evaluate(mesurer, ['.screen:not([hidden]) .sheet']);
      e[ecran].rail = await page.evaluate(() => (document.querySelector('.screen:not([hidden]) .ifc-liens .ifc-actif') || {}).textContent || null);
      e[ecran].focus = await page.evaluate(() => { const f = document.activeElement, s = document.querySelector('.screen:not([hidden])'); return s && s.contains(f) && f.getClientRects().length ? (f.id || f.textContent.trim().slice(0, 30)) : null; });
      await cliche(ecran, w, h);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('menu').hidden);
    }
    // partie lancée, pause, puis fin de partie (mêmes écrans que le joueur ; aucune règle changée)
    await page.evaluate(() => { __zs.start(); __zs.god(true); });
    await page.waitForFunction(() => G.state === 'playing');
    await images(3);
    await page.evaluate(() => pauseGame());
    await page.waitForFunction(() => !document.getElementById('pause').hidden);
    await attendre(500);
    await cliche('pause', w, h);
    await page.evaluate(() => { resumeGame(); G.god = false; gameOver(); });
    await page.waitForFunction(() => !document.getElementById('gameover').hidden, null, { timeout: 60000 }).catch(() => {});
    await attendre(1500);
    e.fin = await page.evaluate(() => ({ etat: G.state, montre: !document.getElementById('gameover').hidden }));
    Object.assign(e.fin, await page.evaluate(mesurer, ['#gameover .panel']));   // titre coupé : textesCoupes
    await cliche('fin', w, h);
    await page.evaluate(() => quitToMenu());
    await page.waitForFunction(() => !document.getElementById('menu').hidden);
    console.log('écrans', JSON.stringify(e));
  }
  if (MEMOIRE) {
    const releve = () => page.evaluate(() => { if (window.gc) { gc(); gc(); } return { tas: Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10,
      noeuds: document.getElementsByTagName('*').length, videos: document.querySelectorAll('video').length, toiles: document.querySelectorAll('canvas').length }; });
    const [w, h] = TAILLES[0];
    await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction(() => !document.getElementById('menu').hidden);
    const avant = await releve(), tours = 30;
    for (let k = 0; k < tours; k++) {
      await page.click('#btn-play');
      await page.waitForFunction(() => !document.getElementById('mapsel').hidden);
      for (const id of await page.evaluate(() => Object.keys(IFC.manifeste || {}).filter((x) => MAPS.byId[x]))) {
        await page.hover(`#ms-grid .ms-card[data-id="${id}"]`);
        await page.waitForFunction((id) => IFC.apercu === id, id);
        await attendre(250);
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('menu').hidden);
    }
    await attendre(1500);
    mesures.memoire = { tours, avant, apres: await releve() };
    console.log('mémoire', JSON.stringify(mesures.memoire));
  }
  mesures.erreurs = errs;
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(mesures, null, 2));
  if (errs.length) console.log('ERREURS', errs.join(' | '));
  console.log(`fini en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
