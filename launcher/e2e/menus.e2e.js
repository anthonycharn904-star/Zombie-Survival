'use strict';
/* Refonte de l'interface du jeu (chantier interface), dans la fenêtre du jeu du launcher : menu principal vertical
   (ordre des maquettes, surlignage, flèches), rapport opérationnel de la carte chargée (vraies données), ambiance 2D
   par carte ; sélection des cartes en trois zones (rail, dossiers numérotés, aperçu et fiche), survol sans choix,
   choix au clic, Options du rail et retour par Échap ; manifeste des aperçus ; réglages « Réduire les animations »,
   « Sons des menus », « Fond du menu » (enregistrés à part, zs.interface) ; fond figé sous les écrans ; fiches à rail
   (Statistiques, Modèles, Ranking, Amélioration d'arme) ; pause et fin de partie (boutons du menu, flèches,
   Options et Échap) ; écran de chargement « Ouverture du jeu… » ; rendu sans erreur.
     xvfb-run -a node e2e/menus.e2e.js   (Linux sans écran)
   Les blocs « game.evaluate » sont synchrones : engine/tools/banc-interface/essai-page.js les rejoue aussi dans une page
   seule (souris verrouillée refusée, 2,5 s entre deux blocs). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-menus-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = [];
    const report = (r) => res.push(r);
    const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
    // ------------------------------------------------------------------ menu principal
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      const survol = (e) => e.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      ok(IFC.pret && document.getElementById('menu').classList.contains('ifc') && document.getElementById('mapsel').classList.contains('ifc'), 'interface montée (menu et sélection)');
      const ordre = [...document.querySelectorAll('#menu .actions .btn')].filter((b) => !b.hidden && b.offsetParent !== null).map((b) => b.id);
      ok(ordre[0] === 'btn-play' && ordre.indexOf('btn-mods') === 1 && ordre.slice(2, 5).join() === 'btn-stats,btn-models,btn-ranking' && ordre.indexOf('btn-options') === 5,
        'menu vertical dans l’ordre des maquettes (Jouer, Amélioration d’arme, Statistiques, Modèles, Ranking, Options)', ordre);
      const tete = document.querySelector('#menu .ifc-tete');
      ok(tete && tete.contains(document.getElementById('menu-title')) && tete.contains(document.getElementById('menu-eyebrow')) && document.getElementById('menu-title').classList.contains('ifc-logo'),
        'logo et ligne d’accroche en haut à gauche');
      const d = document.getElementById('dossier'), map = CUR.map;
      ok(d.classList.contains('ifc-rapport') && d.querySelector('.ifc-r-zone').textContent === map.name && /Type/.test(d.querySelector('.ifc-faits').textContent)
        && d.contains(document.getElementById('best')) && d.contains(document.getElementById('menu-lead')) && d.querySelector('.ifc-r-cmd .keys') && d.querySelector('.ifc-r-plan canvas, .ifc-r-plan img'),
        `rapport opérationnel de la carte chargée (${map.name} : plan, type, record, briefing, commandes repliées)`);
      ok(document.getElementById('loading').textContent === 'Ouverture du jeu…', 'écran de chargement : « Ouverture du jeu… »', document.getElementById('loading').textContent);
      const fondEl = document.getElementById('ifc-fond');
      IFC.images = 3; IFC.depuis = performance.now() - 1000;
      ok(IFC.fond === 'illustration' && IFC.fondPret && !fondEl.hidden && /fonds\/menu\.jpg/.test(fondEl.style.backgroundImage) && document.body.classList.contains('ifc-illu') && ifcFige() === true,
        'fond du menu : l’illustration (par défaut), la scène 3D n’est plus dessinée derrière', { fond: IFC.fond, pret: IFC.fondPret, image: fondEl.style.backgroundImage });
      ok(IFC_AMB.toile && !IFC_AMB.toile.hidden && IFC_AMB.sorte === IFC_FOND.ambiance && IFC_AMB.parts.length > 0, `ambiance 2D accordée à l’illustration (${IFC_AMB.sorte})`);
      survol(document.getElementById('btn-stats'));
      ok(document.getElementById('btn-stats').classList.contains('ifc-actif') && document.querySelectorAll('#menu .ifc-actif').length === 1, 'survol : un seul bouton surligné');
      document.getElementById('btn-play').focus();
      touche(document.activeElement, 'ArrowDown');
      const apres = document.activeElement.id;
      touche(document.activeElement, 'ArrowUp');
      ok(apres === 'btn-mods' && document.activeElement.id === 'btn-play' && document.getElementById('btn-play').classList.contains('ifc-actif'), 'flèches bas et haut entre les boutons', apres);
      const ex = document.getElementById('btn-exit');
      ok(window.zsLauncher ? !ex.hidden && ordre[ordre.length - 1] === 'btn-exit' : ex.hidden, 'Quitter : dernier bouton dans le launcher (caché dans un navigateur)', ordre);
      ok(vis('menu') && G.state === 'menu', 'le menu reste affiché');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------------ sélection des cartes
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      const vider = () => { clearTimeout(IFC.survolMinuteur); ifcMontrer(IFC.survol || MapSel.sel, true); };   // le délai de 90 ms du survol
      const nom = () => document.querySelector('#mapsel .ifc-f-nom').textContent;
      const carte = (id) => document.querySelector(`#ms-grid .ms-card[data-id="${id}"]`);
      document.getElementById('btn-play').click();
      const debut = MapSel.sel;
      ok(vis('mapsel') && document.querySelectorAll('#ms-grid .ms-card').length === MAPS.list.length, 'Jouer ouvre la sélection : une fiche par carte du catalogue');
      const rail = document.querySelector('#mapsel .ifc-rail'), cur = rail && rail.querySelector('.ifc-liens [aria-current]');
      ok(rail && cur && cur.textContent === document.getElementById('btn-play').textContent && rail.contains(document.getElementById('btn-ms-back')), 'rail de la sélection : Jouer en évidence, Retour');
      ok(document.querySelector('#ms-grid .ms-card .ifc-onglet').textContent === 'Dossier 01' && nom() === MAPS.byId[debut].name && /Carte choisie/.test(document.querySelector('.ifc-f-choix').textContent),
        'dossiers numérotés ; la fiche montre la carte choisie');
      const autre = MAPS.list.find((id) => id !== debut);
      carte(autre).dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vider();
      ok(IFC.survol === autre && carte(autre).classList.contains('ifc-survol') && nom() === MAPS.byId[autre].name && MapSel.sel === debut
        && document.querySelector('#mapsel .ifc-fiche').classList.contains('ifc-survol') && document.querySelector('.ifc-f-choix').textContent.includes(MAPS.byId[debut].name),
        'survol : l’aperçu et la fiche changent, la carte choisie ne change pas', { survol: IFC.survol, sel: MapSel.sel });
      const couche = document.querySelector('.ifc-couche.on');
      ok(couche && couche.querySelector('img, canvas') && document.querySelector('.ifc-apercu-note').textContent === 'Aperçu fixe', 'aperçu : image de la carte, « Aperçu fixe »');
      document.getElementById('ms-grid').dispatchEvent(new PointerEvent('pointerleave'));
      vider();
      ok(nom() === MAPS.byId[debut].name, 'la souris quitte la liste : retour à la carte choisie');
      carte(autre).click();
      vider();
      ok(MapSel.sel === autre && carte(autre).getAttribute('aria-selected') === 'true' && nom() === MAPS.byId[autre].name && /Carte choisie/.test(document.querySelector('.ifc-f-choix').textContent),
        'clic : la carte est choisie (tampon, fiche)');
      ok(IFC_AMB.toile.hidden && !IFC_AMB.raf, 'ambiance arrêtée sous la sélection');
      IFC.images = 3; IFC.depuis = performance.now() - 1000;
      ok(ifcFige() === true, 'fond 3D figé sous la sélection (ifcFige)');
      // Options depuis le rail : Échap ramène à la sélection, choix gardé
      [...rail.querySelectorAll('.ifc-liens .ifc-item')].find((b) => b.textContent === document.getElementById('btn-options').textContent).click();
      ok(vis('options') && optionsReturn === 'mapsel', 'Options depuis le rail de la sélection');
      touche(document.body, 'Escape');
      ok(vis('mapsel') && MapSel.sel === autre && document.querySelector('#ms-grid .ms-card .ifc-onglet'), 'Échap dans les Options : retour à la sélection, choix gardé');
      // flèches sur la liste : la carte suivante, puis la précédente, est choisie (fiche à jour)
      const [c0, c1] = MAPS.list;
      carte(c0).click(); carte(c0).focus();
      touche(carte(c0), 'ArrowDown');
      vider();
      const bas = { sel: MapSel.sel, nom: nom(), focus: document.activeElement.dataset.id };
      touche(document.activeElement, 'ArrowUp');
      vider();
      ok(bas.sel === c1 && bas.nom === MAPS.byId[c1].name && bas.focus === c1 && MapSel.sel === c0 && nom() === MAPS.byId[c0].name, 'flèches sur la liste des cartes : choix et fiche suivent', bas);
      carte(debut).click();
      touche(document.body, 'Escape');
      ok(vis('menu') && !IFC.video && document.querySelectorAll('#mapsel video').length === 0, 'Échap : retour au menu, sélection fermée');
      return out;
    })).forEach(report);
    await game.waitForFunction(() => IFC.manifeste !== null, null, { timeout: 30000 }).catch(() => {});   // manifeste lu à la première sélection
    await attendre(500);
    // ------------------------------------------------------------------ manifeste, réglages
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      const decl = IFC.manifeste || {};
      ok(['bunker7', 'khamsin', 'ombre'].every((id) => decl[id] && decl[id].video && decl[id].affiche), 'manifeste des aperçus lu : vidéo et affiche des trois cartes intégrées', decl);
      const m = ifcValiderManifeste({ version: 1, cartes: { khamsin: { video: 'khamsin.webm', affiche: '../x.jpg', cadrage: '50% 40%' }, 'Mauvais id': { video: 'a.webm' }, ombre: { video: 'ombre.exe' } } });
      ok(m.khamsin && m.khamsin.video === 'khamsin.webm' && m.khamsin.affiche === null && m.khamsin.cadrage === '50% 40%' && !m['Mauvais id'] && !m.ombre,
        'manifeste validé (noms de fichiers, cadrage, identifiants)', m);
      document.getElementById('btn-options').click();
      const calme = document.getElementById('opt-calme'), sons = document.getElementById('opt-sons-menu'), fond = document.getElementById('opt-fond');
      ok(vis('options') && calme && sons && fond && document.getElementById('options').classList.contains('ifc'), 'Options : trois réglages « Menus »');
      const avant = { calme: calme.checked, sons: sons.checked, fond: fond.value };
      if (calme.checked) calme.click();
      calme.click();
      const t1 = ifcBalance(5), t2 = ifcBalance(9);
      ok(document.body.classList.contains('ifc-calme') && store.get('zs.interface', {}).calme === true && t1 === t2, 'Réduire les animations : classe, enregistré, balancement de la caméra arrêté');
      calme.click();
      ok(!document.body.classList.contains('ifc-calme') && store.get('zs.interface', {}).calme === false && ifcBalance(12) === 12, 'Réduire les animations : décoché, balancement rendu');
      fond.value = 'scene'; fond.dispatchEvent(new Event('change'));
      const scene = { fond: IFC.fond, cache: document.getElementById('ifc-fond').hidden, illu: document.body.classList.contains('ifc-illu'), sorte: ifcAmbianceSorte(CUR.map) };
      fond.value = 'fixe'; fond.dispatchEvent(new Event('change'));
      ok(scene.fond === 'scene' && scene.cache && !scene.illu && scene.sorte === (CUR.map.open ? IFC_AMBIANCE_BASES[CUR.map.base] || null : 'poussiere') && IFC.fixe && store.get('zs.interface', {}).fond === 'fixe',
        'Fond du menu : scène de la carte (illustration retirée, ambiance de la carte), puis scène figée, enregistré', scene);
      fond.value = avant.fond; fond.dispatchEvent(new Event('change'));
      // sons joués par le clic de validation (Sound.ui) : comptés aux départs d'oscillateur
      Sound.init();
      const P = OscillatorNode.prototype, s0 = P.start;
      let n = 0;
      P.start = function (...a) { n++; return s0.apply(this, a); };
      if (sons.checked) sons.click();
      Sound.ui();
      const eteint = n, enregistre = store.get('zs.interface', {}).sons;
      sons.click();
      Sound.ui();
      P.start = s0;
      ok(eteint === 0 && n > 0 && enregistre === false && IFC.sons, 'Sons des menus : éteints, le clic de validation se tait hors partie ; rallumés, il sonne', { eteint, n });
      if (avant.sons !== sons.checked) sons.click();
      ok(!IFC.fixe && JSON.stringify(settings) === JSON.stringify(Object.assign({}, SETTINGS_DEFAULT, store.get('zs.settings', {}))), 'réglages du jeu (zs.settings) inchangés');
      touche(document.body, 'Escape');
      ok(vis('menu'), 'Échap dans les Options : retour au menu');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------------ aperçus vidéo (protocole du jeu, Blob, VP9)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      document.getElementById('btn-play').click();
      ok(!document.getElementById('mapsel').hidden && IFC.apercu === MapSel.sel, 'sélection rouverte : aperçu de la carte choisie');
      return out;
    })).forEach(report);
    await game.waitForFunction(() => document.querySelector('#mapsel .ifc-apercu.ifc-video-on') && IFC.video && IFC.video.v.currentTime > 0.2, null, { timeout: 60000 }).catch(() => {});
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const a = IFC.manifeste[MapSel.sel], img = document.querySelector('#mapsel .ifc-couche.on img');
      ok(document.querySelector('#mapsel .ifc-apercu.ifc-video-on') && IFC.video && IFC.video.v.src.startsWith('blob:') && !IFC.video.v.paused && document.querySelectorAll('video').length === 1
        && img && img.src.endsWith(`apercus/${a.affiche}`),
        `aperçu vidéo de ${MapSel.sel} : lu depuis un Blob, seul, affiche dessous`, { t: IFC.video && IFC.video.v.currentTime, img: img && img.src });
      const autre = Object.keys(IFC.manifeste).find((id) => id !== MapSel.sel && MAPS.byId[id] && IFC.manifeste[id].video);
      document.querySelector(`#ms-grid .ms-card[data-id="${autre}"]`).dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      window.__ifcEssaiAutre = autre;
      return out;
    })).forEach(report);
    await game.waitForFunction(() => IFC.apercu === window.__ifcEssaiAutre && document.querySelector('#mapsel .ifc-apercu.ifc-video-on'), null, { timeout: 60000 }).catch(() => {});
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      const autre = window.__ifcEssaiAutre;
      ok(IFC.apercu === autre && document.querySelector('#mapsel .ifc-apercu.ifc-video-on') && document.querySelectorAll('video').length === 1, `survol : la vidéo de ${autre} remplace la précédente (une seule)`);
      touche(document.body, 'Escape');
      ok(!document.getElementById('menu').hidden && !IFC.video && document.querySelectorAll('video').length === 0, 'Échap : la vidéo est arrêtée et retirée');
      delete window.__ifcEssaiAutre;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------------ fiches à rail
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      for (const id of ['stats', 'models', 'ranking', 'mods']) {
        document.getElementById(`btn-${id}`).click();
        const e = document.getElementById(id), cur = e.querySelector('.ifc-liens [aria-current]');
        ok(vis(id) && e.querySelector('.ifc-coquille > .ifc-rail') && cur && cur.textContent === document.getElementById(`btn-${id}`).textContent
          && e.querySelector('.ifc-rail').contains(document.getElementById(`btn-${id}-back`)) && e.querySelector('.sheet-actions').hidden,
          `${id} : rail (écran en cours en évidence, Retour), fiche à droite`);
        document.getElementById(`btn-${id}-back`).click();
        ok(vis('menu'), `${id} : Retour ramène au menu`);
      }
      document.getElementById('btn-stats').click();
      [...document.querySelectorAll('#stats .ifc-liens .ifc-item')].find((b) => b.textContent === document.getElementById('btn-options').textContent).click();
      ok(vis('options') && optionsReturn === 'stats', 'Options depuis le rail des Statistiques');
      touche(document.body, 'Escape');
      ok(vis('stats'), 'Échap : retour aux Statistiques');
      touche(document.body, 'Escape');
      ok(vis('menu'), 'Échap : retour au menu');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------------ pause et fin de partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      // Entrée sur la carte qui a le focus (la carte du menu) alors qu'une autre est choisie : elle est choisie et la partie part
      document.getElementById('btn-play').click();
      const ici = G.mapId, ailleurs = MAPS.list.find((id) => id !== ici);
      document.querySelector(`#ms-grid .ms-card[data-id="${ailleurs}"]`).click();
      const c = document.querySelector(`#ms-grid .ms-card[data-id="${ici}"]`);
      c.focus();
      touche(c, 'Enter');
      ok(MapSel.sel === ici && (G.state === 'playing' || G.state === 'paused'), 'Entrée sur la carte qui a le focus : elle est choisie et la partie part', { sel: MapSel.sel, etat: G.state });
      __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      ok(G.state === 'playing' && IFC_AMB.toile.hidden && ifcFige() === false && document.getElementById('ifc-fond').hidden, 'en partie : ni illustration, ni ambiance, ni fond figé');
      pauseGame();
      const pb = [...document.querySelectorAll('#pause .panel .btn')];
      ok(vis('pause') && document.getElementById('pause').classList.contains('ifc-panneau') && pb.every((b) => b.classList.contains('ifc-item')), 'pause : boutons du menu');
      document.getElementById('btn-resume').focus();
      touche(document.activeElement, 'ArrowDown');
      ok(document.activeElement.id === 'btn-pause-options' && document.getElementById('btn-pause-options').classList.contains('ifc-actif'), 'pause : flèche bas', document.activeElement.id);
      document.getElementById('btn-pause-options').click();
      touche(document.body, 'Escape');
      ok(vis('pause') && G.state === 'paused', 'Options de la pause : Échap ramène à la pause');
      touche(document.body, 'Escape');
      ok(G.state === 'paused' && vis('pause'), 'Échap juste après l’ouverture de la pause : ignoré (la touche qui libère la souris)');
      IFC.pauseT = performance.now() - 1000;
      touche(document.body, 'Escape');
      ok(G.state === 'playing' && !vis('pause'), 'Échap dans la pause : la partie reprend');
      if (!Input.locked) {
        // le navigateur ne rend pas la souris sur Échap : le premier clic la reprend, sans tirer
        renderer.domElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        ok(!Input.lmb && !IFC.repriseEchap, 'après la reprise par Échap : le premier clic reprend la souris sans tirer', { lmb: Input.lmb });
        Input.lmb = false;
      }
      ok(/reprendre/.test([...document.querySelectorAll('#dossier .keys dt')].find((d) => d.textContent === 'Échap').nextElementSibling.textContent), 'commandes : « Échap : pause · reprendre »');
      resumeGame(); G.god = false; gameOver();
      ok(G.state === 'gameover', 'fin de partie déclarée (l’écran vient 1,6 s plus tard)');
      return out;
    })).forEach(report);
    await attendre(2500);   // gameOver montre son écran après 1,6 s
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      ok(vis('gameover') && document.getElementById('gameover').classList.contains('ifc-panneau') && [...document.querySelectorAll('#gameover .panel .btn')].every((b) => b.classList.contains('ifc-item')),
        'fin de partie : écran et boutons du menu');
      quitToMenu();
      ok(vis('menu') && G.state === 'menu' && document.querySelector('.ifc-r-zone').textContent === CUR.map.name && !IFC_AMB.toile.hidden === !!ifcAmbianceSorte(CUR.map),
        'retour au menu : rapport et ambiance de la carte');
      return out;
    })).forEach(report);
    for (const r of res) {
      if (!r.ok) failures++;
      console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
    }
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Menus : conformes (menu vertical, rapport, sélection, survol, réglages, fiches, pause, fin de partie).');
  process.exit(failures ? 1 : 0);
})();
