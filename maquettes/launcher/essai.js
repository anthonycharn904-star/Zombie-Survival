'use strict';
/* Maquettes du launcher : essai des parcours simulés dans les quatre directions (Chromium sans tête, 2D, temps
   accéléré ×5). Il clique comme un joueur : navigation, Jouer, mise à jour, erreur et nouvel essai, première
   installation, nouveau launcher, mode auteur. Aucune erreur de page tolérée.

     python3 maquettes/launcher/assembler.py [<dossier>]
     node maquettes/launcher/essai.js [<dossier>] */
const path = require('path'), fs = require('fs'), os = require('os');
const ICI = __dirname, REPO = path.join(ICI, '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const ARGS = process.argv.slice(2), choix = (() => { const i = ARGS.indexOf('--directions'); return i >= 0 ? ARGS[i + 1].split(',') : null; })();
const OUT = path.resolve(ARGS[0] && !ARGS[0].startsWith('--') ? ARGS[0] : path.join(ICI, 'sortie'));
const DIRS = { 'A-militaire': 'a', 'B-aaa-moderne': 'b', 'C-nouvelle-generation': 'c', 'D-hybride': 'd' };
const BANDEAU = { a: '#a-alerte-btn', b: '#b-bandeau-btn', c: '#c-alerte-btn', d: '#d-bandeau-btn' };
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

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  let total = 0, echecs = 0;
  for (const [d, k] of Object.entries(DIRS)) {
    if (choix && !choix.includes(d[0])) continue;
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    const ok = (c, m, x) => { total++; if (!c) echecs++; console.log(`${c ? '  ok ' : '  ÉCHEC'} ${d} · ${m}${!c && x !== undefined ? ' · ' + JSON.stringify(x) : ''}`); };
    const phase = (p, ms = 8000) => page.waitForFunction((x) => ZSM.etat.phase === x, p, { timeout: ms }).then(() => true, () => false);
    const jouer = `#${k}-jouer`;
    await page.goto('file://' + path.join(OUT, d + '.html') + '?vite');
    ok(await phase('pret'), 'démarrage normal → prêt');
    for (const s of ['actus', 'maj', 'installation', 'modtools', 'reglages', 'accueil']) {
      await page.click(`#zsm-fenetre [data-section="${s}"]`);
      ok(await page.evaluate((x) => !document.querySelector(`#zsm-fenetre [data-page="${x}"]`).hidden, s), `navigation : ${s}`);
    }
    await page.click(jouer);
    ok(await phase('partie'), 'Jouer → partie en cours (simulée)');
    ok(await page.evaluate(() => document.querySelectorAll('.zsm-toast--simulation').length > 0), 'bulle « Simulation » affichée');
    await page.evaluate(() => ZSM.actions.terminerPartie());
    ok(await phase('pret'), 'fin de partie → vérification → prêt');
    await page.click('[data-scenario="maj"]');
    ok(await phase('maj'), 'scénario : mise à jour disponible');
    await page.click(jouer);
    ok(await phase('telechargement', 3000), 'Mettre à jour → téléchargement');
    ok(await phase('pret', 15000) && await page.evaluate(() => ZSM.etat.installe.version === ZSM.D.simule.jeu), 'téléchargement, signature, installation → 2.0.7 (simulée) installée');
    await page.click('[data-scenario="erreur"]');
    ok(await phase('maj'), 'scénario : erreur (mise à jour proposée)');
    await page.click(jouer);
    ok(await phase('erreur', 15000), 'téléchargement interrompu → erreur');
    await page.evaluate(() => ZSM.actions.reessayer());
    ok(await phase('pret', 15000), 'Réessayer → installation → prêt');
    await page.click('[data-scenario="premiere"]');
    ok(await phase('absent'), 'scénario : première installation → jeu absent');
    await page.click(jouer);
    ok(await phase('pret', 15000) && await page.evaluate(() => ZSM.etat.installe.version === ZSM.D.jeu.version), 'Installer → 2.0.6 installée');
    await page.click('[data-scenario="launcher"]');
    ok(await phase('pret') && await page.isVisible(BANDEAU[k]), 'scénario : nouveau launcher → bandeau visible');
    await page.click(BANDEAU[k]);
    ok(await phase('redemarrage', 15000), 'Installer et redémarrer → téléchargement → redémarrage');
    ok(await phase('pret', 15000) && await page.evaluate(() => ZSM.etat.launcherVersion === ZSM.D.simule.launcher), 'launcher 1.4.0 (simulé) après redémarrage');
    await page.click('[data-scenario="hors-ligne"]');
    ok(await phase('hors-ligne'), 'scénario : hors ligne');
    await page.uncheck('#zsm-auteur');
    ok(await page.evaluate(() => document.querySelector('#zsm-fenetre [data-section="modtools"]').hidden), 'mode joueur : Mod Tools cachés');
    await page.check('#zsm-auteur');
    await page.selectOption('#zsm-taille', '1080x660');
    ok(await page.evaluate(() => document.getElementById('zsm-fenetre').getBoundingClientRect().width > 1070), 'fenêtre à la taille actuelle (1 080 × 660)');
    if (k === 'd') {
      // fenêtre redimensionnable : poignée d'angle, puis Agrandir et retour
      await page.selectOption('#zsm-taille', '1280x720');
      const g = await page.locator('.zsm-poignee').boundingBox();
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
      await page.mouse.move(g.x + g.width / 2 + 60, g.y + g.height / 2 + 40, { steps: 6 }); await page.mouse.up();
      const t = await page.evaluate(() => ZSM.taille()), [tw, th] = t.split('x').map(Number);
      ok(Math.abs(tw - 1400) <= 2 && Math.abs(th - 800) <= 2, 'poignée : 1 280 × 720 → 1 400 × 800 (à 2 px près)', t);
      await page.click('#d-agrandir');
      ok(await page.evaluate(() => ZSM.taille() === 'remplir' && document.getElementById('zsm-fenetre').getBoundingClientRect().width === innerWidth), 'Agrandir : la fenêtre remplit la page');
      await page.click('#d-agrandir');
      ok(await page.evaluate(() => ZSM.taille()) === t, 'Agrandir une seconde fois : retour à la taille d’avant', t);
      // fond animé des Marécages maudits : il ne tourne que si on le voit. Ses ressources (capture, vidéos, sons) sont
      // hors de Git : sans elles (clone propre), D montre Bunker 7 ; le repli est vérifié et ces contrôles sont sautés
      await page.click('[data-scenario="normal"]'); await phase('pret');
      await page.click('#zsm-fenetre [data-section="accueil"]');
      const ressources = await page.evaluate(() => ({ scene: !!D_FOND.scene(), sons: !!D_FOND.sons() }));
      if (!ressources.scene) {
        ok(await page.evaluate(() => D_FOND.actuel() === 'bunker' && document.getElementById('d-hero').dataset.fond === 'bunker'), 'ressources de la carte absentes (hors de Git) : fond de Bunker 7');
        console.log(`  sauté ${d} · fond animé et sons : ressources de la carte absentes (hors de Git)`);
      } else {
        const tourne = () => page.evaluate(() => D_FOND.scene().enCours());
        ok(await page.evaluate(() => D_FOND.actuel() === 'marais') && await tourne(), 'fond des Marécages animé sur l’accueil');
        // vidéo : la lecture repart de l'instant de l'affiche, et l'affiche ne s'efface qu'à cette image (pas de saut)
        const avecVideo = await page.evaluate(() => D_FOND.video());
        const departAffiche = async (quand) => {
          const vu = await page.waitForFunction(() => { const e = D_FOND.scene().etat(); return e.premiereImage !== null && !e.affiche; }, null, { timeout: 15000, polling: 100 }).then(() => true, () => false);
          const e = await page.evaluate(() => D_FOND.scene().etat());
          // la lecture part aussitôt : la première image présentée est celle de l'affiche ou l'une des suivantes
          ok(vu && e.premiereImage >= e.instantAffiche - 0.001 && e.premiereImage - e.instantAffiche < 0.1, `vidéo, ${quand} : départ depuis l’affiche, sans saut (première image à ${e.premiereImage} s, affiche à ${e.instantAffiche} s)`, e);
        };
        if (avecVideo) await departAffiche('démarrage');
        await page.click('#zsm-fenetre [data-section="actus"]');
        ok(!(await tourne()), 'fond en pause hors de l’accueil');
        await page.click('#zsm-fenetre [data-section="accueil"]');
        ok(await tourne(), 'fond relancé au retour sur l’accueil');
        await page.click('#d-reduire');
        ok(!(await tourne()), 'fond en pause, fenêtre réduite (simulée)');
        await page.click('#d-retablir');
        ok(await tourne(), 'fond relancé, fenêtre rétablie');
        if (avecVideo) await departAffiche('reprise après la fenêtre réduite');
        const masquer = (h) => page.evaluate((x) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => x }); document.dispatchEvent(new Event('visibilitychange')); }, h);
        await masquer(true);
        ok(!(await tourne()), 'fond en pause, fenêtre masquée (visibilitychange)');
        await masquer(false);
        ok(await tourne(), 'fond relancé, fenêtre de nouveau visible');
        await page.click(jouer); await phase('partie');
        ok(!(await tourne()), 'fond en pause pendant une partie');
        await page.evaluate(() => ZSM.actions.terminerPartie()); await phase('pret');
        ok(await tourne(), 'fond relancé après la partie');
        await page.click('#zsm-fenetre [data-section="reglages"]');
        await page.click('label:has([data-reglage="fondAnime"])');
        await page.click('#zsm-fenetre [data-section="accueil"]');
        ok(!(await tourne()), 'réglage « Fond d’écran animé » coupé : image fixe');
        await page.click('#zsm-fenetre [data-section="reglages"]');
        await page.click('label:has([data-reglage="fondAnime"])');
        await page.selectOption('#d-fond', 'bunker');
        ok(await page.evaluate(() => D_FOND.actuel() === 'bunker' && document.getElementById('d-hero').dataset.fond === 'bunker'), 'réglage « Fond de l’accueil » : Bunker 7');
        await page.selectOption('#d-fond', 'marais');
        if (ressources.sons) {
          ok(await page.evaluate(() => ZSM.etat.reglages.fondSons === false && D_FOND.sons() && D_FOND.sons().etat().contexte === 'aucun' && document.getElementById('d-volume').disabled),
            'sons de l’ambiance coupés au démarrage : aucun contexte audio, volume inactif');
        } else {
          ok(await page.evaluate(() => document.querySelector('[data-reglage="fondSons"]').disabled), 'sons non exportés (hors de Git) : interrupteur inactif, expliqué');
        }
        await page.click('label:has([data-reglage="fondEclairs"])');
        ok(await page.evaluate(() => ZSM.etat.reglages.fondEclairs === false), 'réglage « Éclairs de l’orage » coupé');
        const video = await page.evaluate(() => D_FOND.video()), etatVideo = () => page.evaluate(() => D_FOND.scene().etat());
        if (video) {
          ok(await page.evaluate(() => { const e = D_FOND.scene().etat(); return ZSM.IMG.marais_video_sans ? e.version === 'sans' : !e.joue; }),
            'vidéo, éclairs coupés : la même scène sans éclairs (ou l’affiche, sans cette version)', await etatVideo());
        }
        await page.click('label:has([data-reglage="fondEclairs"])');
        await page.click('#zsm-fenetre [data-section="accueil"]');
        ok(await tourne(), `fond relancé (${video ? 'vidéo' : 'scène 2D'})`);
        if (video) ok((await etatVideo()).version === 'avec', 'vidéo, éclairs rallumés : la version avec éclairs', await etatVideo());
        // bascule pendant la lecture, sur l'accueil : relais au même instant de la boucle, sans l'affiche et sans arrêt
        if (video && await page.evaluate(() => !!ZSM.IMG.marais_video_sans)) {
          const basculeEnLecture = async (allumes, attendue, depuis = null) => {
            if (depuis !== null) await page.evaluate(async (t) => { D_FOND.scene().video.currentTime = t; await new Promise((ok) => setTimeout(ok, 400)); }, depuis);
            const n0 = await page.evaluate(() => {
              const img = document.querySelector('.d-hero-affiche'), s = D_FOND.scene();
              window.__afficheVue = false; window.__arret = false;
              window.__obs = new MutationObserver(() => { if (!img.hidden) window.__afficheVue = true; });
              window.__obs.observe(img, { attributes: true, attributeFilter: ['hidden'] });
              window.__guet = setInterval(() => { if (!s.enCours()) window.__arret = true; }, 20);
              return s.etat().bascule ? s.etat().bascule.n : 0;
            });
            await page.evaluate((x) => D_FOND.scene().regler({ eclairs: x }), allumes);
            const fini = await page.waitForFunction((n) => { const e = D_FOND.scene().etat(); return !e.enBascule && e.bascule && e.bascule.n > n; }, n0, { timeout: 20000, polling: 50 }).then(() => true, () => false);
            const r = await page.evaluate(() => { clearInterval(window.__guet); window.__obs.disconnect(); return { e: D_FOND.scene().etat(), afficheVue: window.__afficheVue, arret: window.__arret, enCours: D_FOND.scene().enCours() }; });
            const b = r.e.bascule || {}, ecart = b.duree ? (((b.a - b.de) % b.duree) + b.duree) % b.duree : -1;
            ok(fini && r.e.version === attendue && r.enCours && !r.afficheVue && !r.arret && ecart > 0 && ecart < 0.1,
              `vidéo, bascule en lecture vers « ${attendue} »${depuis !== null ? ' depuis ' + depuis + ' s' : ''} : relais au même instant (de ${b.de} s à ${b.a} s, ${b.essais} recherche(s), ${b.delai} s), sans l’affiche ni arrêt`, r);
          };
          await basculeEnLecture(false, 'sans');
          await basculeEnLecture(true, 'avec');
          await basculeEnLecture(false, 'sans', 6.5);                // tard dans la boucle : longue recherche (une seule image clé)
          await basculeEnLecture(true, 'avec', 7.55);                // à cheval sur le retour au début de la boucle
        }
        // les sons de l'ambiance (kit 2.0.7) : allumés par l'interrupteur, seulement quand la scène est visible
        if (!ressources.sons) console.log(`  sauté ${d} · sons de l’ambiance : non exportés (hors de Git)`);
        else {
          const sons = () => page.evaluate(() => D_FOND.sons().etat());
          const attendre = (f, a, ms = 15000) => page.waitForFunction(f, a, { timeout: ms, polling: 100 }).then(() => true, () => false);
          const etatSons = (c) => attendre((x) => D_FOND.sons().etat().contexte === x, c, 4000);
          await page.click('#zsm-fenetre [data-section="reglages"]');
          await page.click('label:has([data-reglage="fondSons"])');
          ok(await page.evaluate(() => ZSM.etat.reglages.fondSons === true && !document.getElementById('d-volume').disabled && D_FOND.sons().etat().contexte === 'aucun'),
            'interrupteur allumé hors de l’accueil : volume actif, toujours rien qui joue', await sons());
          await page.click('#zsm-fenetre [data-section="accueil"]');
          ok(await attendre(() => { const e = D_FOND.sons().etat(); return e.contexte === 'running' && e.charges === e.attendus && e.nappes === 4; }), 'sur l’accueil : 11 sons décodés, 4 nappes de pluie en boucle', await sons());
          await page.waitForTimeout(1700);
          const niv = await page.evaluate(() => D_FOND.sons().niveau()), e1 = await sons();
          ok(niv > -60 && niv < -6 && Math.abs(e1.volume - 0.8) < 0.02, `la pluie s’entend, après une montée de 1,5 s (volume du jeu, 80 %) : ${niv} dB, volume ${e1.volume}`, e1);
          await page.evaluate(() => D_FOND.scene().provoquer());
          ok(await attendre((n) => D_FOND.sons().etat().tonnerres > n, e1.tonnerres, 4000), 'un éclair de la scène appelle son tonnerre', await sons());
          ok((await sons()).voix >= 1, 'le tonnerre est programmé (arrivée du son après l’éclair)', await sons());
          await page.click('#d-reduire');
          ok(await etatSons('suspended'), 'son suspendu, fenêtre réduite', await sons());
          ok((await sons()).voix === 0, 'tonnerres en cours arrêtés à la pause', await sons());
          await page.click('#d-retablir');
          ok(await etatSons('running'), 'son repris, fenêtre rétablie', await sons());
          await masquer(true);
          ok(await etatSons('suspended'), 'son suspendu, fenêtre masquée', await sons());
          await masquer(false);
          ok(await etatSons('running'), 'son repris, fenêtre visible', await sons());
          await page.click(jouer); await phase('partie');
          ok(await etatSons('suspended'), 'son suspendu pendant une partie', await sons());
          await page.evaluate(() => ZSM.actions.terminerPartie()); await phase('pret');
          ok(await etatSons('running'), 'son repris après la partie', await sons());
          await page.click('#zsm-fenetre [data-section="reglages"]');
          ok(await etatSons('suspended'), 'son suspendu hors de l’accueil', await sons());
          await page.evaluate(() => { const v = document.getElementById('d-volume'); v.value = 30; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change')); });
          await page.click('label:has([data-reglage="fondEclairs"])');
          await page.click('#zsm-fenetre [data-section="accueil"]');
          ok(await attendre(() => Math.abs(D_FOND.sons().etat().volume - 0.3) < 0.02, null, 4000), 'volume réglé à 30 % (réglage enregistré, montée jusqu’à 0,3)', [await page.evaluate(() => ZSM.etat.reglages.volumeSons), await sons()]);
          const n2 = (await sons()).tonnerres;
          await page.evaluate(() => D_FOND.scene().provoquer()); await page.waitForTimeout(1500);
          ok((await sons()).tonnerres === n2, 'éclairs coupés : pas de tonnerre', await sons());
          await page.click('#zsm-fenetre [data-section="reglages"]');
          await page.click('label:has([data-reglage="fondEclairs"])');
          await page.click('label:has([data-reglage="fondAnime"])');
          await page.click('#zsm-fenetre [data-section="accueil"]');
          await page.waitForTimeout(1700);
          const niv2 = await page.evaluate(() => D_FOND.sons().niveau());
          ok(!(await tourne()) && (await sons()).contexte === 'running' && niv2 > -66, `image fixe : la pluie continue (${niv2} dB), sans éclair`, await sons());
          await page.click('#zsm-fenetre [data-section="reglages"]');
          await page.click('label:has([data-reglage="fondAnime"])');
          await page.click('label:has([data-reglage="fondSons"])');
          await page.click('#zsm-fenetre [data-section="accueil"]');
          ok(await etatSons('suspended') && (await sons()).voix === 0 && await page.evaluate(() => document.getElementById('d-volume').disabled), 'interrupteur coupé : plus de son, volume inactif', await sons());
        }
      }
    }
    ok(erreurs.length === 0, 'aucune erreur de page', erreurs);
    await page.close();
  }
  await browser.close();
  console.log(`${total - echecs} vérifications sur ${total}`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
