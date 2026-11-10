'use strict';
/* Essai de bout en bout de l'interface du launcher 1.4.0 (direction D de la maquette) dans la vraie fenêtre :
   taille et redimensionnement de la fenêtre, bouton Agrandir ou Restaurer (état renvoyé par le processus
   principal), écran d'ouverture, pages de la barre latérale, réglage du fond animé (enregistré dans
   settings.json), fond en pause hors de l'accueil ; fond des Marécages Maudits : vidéo lue dans les fichiers du
   launcher (media-src 'self'), sons de l'ambiance passés par le préchargement et décodés, réglages du fond
   enregistrés ; aucune erreur de page ni refus de la politique de sécurité.
   Sans réseau : la source des mises à jour du dossier de l'essai (config.json) ne répond pas, le launcher reste
   hors ligne avec le jeu livré. Les états simulés (téléchargement, erreurs, partie) se contrôlent sans Electron
   avec e2e/page-launcher.js.
     xvfb-run -a node e2e/launcher-interface.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-interface-'));
const USER = path.join(TMP, 'joueur');
const SHOTS = process.env.ZS_E2E_SHOTS || '';
let failures = 0;
const ok = (cond, label, extra) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`); if (!cond) failures++; };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// la fenêtre du launcher, côté processus principal
const LANCEUR = "BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/launcher/index.html'))";
const principal = (app, corps, arg) => app.evaluate(new Function('electron', 'arg', `const { BrowserWindow, screen } = electron; const w = ${LANCEUR}; ${corps}`), arg);

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  // source des mises à jour : un port local fermé (refus immédiat, aucune version en ligne)
  fs.writeFileSync(path.join(USER, 'config.json'), JSON.stringify({ updateUrl: 'http://127.0.0.1:9/latest.json' }));
  let app = null;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    // écouteurs posés sur le contexte avant la première fenêtre : Playwright ne transmet que les messages émis après
    // l'abonnement, et ne signale la fenêtre qu'une fois le chargement de index.html commencé
    const erreurs = [];
    app.context().on('weberror', (e) => erreurs.push(e.error().message));
    app.context().on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) erreurs.push(m.text()); });
    const launcher = await app.firstWindow({ timeout: 30000 });
    const statut = () => launcher.evaluate(() => window.zs.status());
    const dom = (fn, arg) => launcher.evaluate(fn, arg);

    /* ---- la fenêtre : 1 280 × 720 (ou la zone de travail), redimensionnable jusqu'à 960 × 600, agrandissable */
    const f = await principal(app, 'const z = screen.getPrimaryDisplay().workAreaSize; return { taille: w.getSize(), min: w.getMinimumSize(), redim: w.isResizable(), agrandir: w.isMaximizable(), zone: [z.width, z.height] };');
    const attendue = [Math.min(1280, f.zone[0]), Math.min(720, f.zone[1])], mini = [Math.min(960, f.zone[0]), Math.min(600, f.zone[1])];
    ok(f.redim && f.agrandir && f.taille.join('x') === attendue.join('x') && f.min.join('x') === mini.join('x'), 'fenêtre : 1 280 × 720, redimensionnable (960 × 600 au plus petit), agrandissable', f);

    /* ---- ouverture : écran de titre, puis l'état du launcher (hors ligne, jeu livré jouable) */
    await launcher.waitForFunction(() => document.getElementById('d-ouverture').classList.contains('fini'), null, { timeout: 15000 });
    let s = null;
    for (let i = 0; i < 120 && !(s && ['offline', 'error'].includes(s.phase)); i++) { s = await statut(); if (!['offline', 'error'].includes(s.phase)) await pause(500); }
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 30000 });
    const accueil = await dom(() => ({ titre: document.getElementById('status-title').textContent, jeu: document.getElementById('d-v-jeu').textContent, mission: document.getElementById('d-mission-v').textContent,
      modtools: document.getElementById('d-nav-modtools').hidden && document.getElementById('btn-modtools').hidden, chrono: document.querySelectorAll('#d-chrono > li').length }));
    ok(s && s.phase === 'offline' && accueil.titre === 'Hors ligne' && accueil.jeu === s.installed.version && accueil.mission === `Jeu ${s.installed.version}`, 'ouverture : écran de titre terminé, hors ligne, jeu livré jouable', { phase: s && s.phase, ...accueil });
    ok(accueil.modtools && accueil.chrono === (s.history || []).length && accueil.chrono > 0, 'joueur : pas de Mod Tools ; historique des versions dans la page des mises à jour', accueil);
    await shot(launcher, 'interface-1-accueil');

    /* ---- Agrandir ou Restaurer : la page demande, le processus principal agit et renvoie l'état de la fenêtre.
       Sans gestionnaire de fenêtres (Xvfb), une fenêtre ne s'agrandit pas : les appels sont relevés et les
       événements maximize et unmaximize émis à la main. */
    ok(s.windowState && s.windowState.maximized === false && await dom(() => !document.getElementById('d-agrandir').hidden), 'fenêtre : état envoyé à la page, bouton Agrandir', s.windowState);
    await principal(app, "w.__appels = []; w.maximize = function () { this.__appels.push('maximize'); }; w.unmaximize = function () { this.__appels.push('unmaximize'); };");
    await launcher.click('#d-agrandir');
    await pause(300);
    await principal(app, "w.isMaximized = () => true; w.emit('maximize');");
    await pause(300);
    let a = await dom(() => ({ agrandie: document.getElementById('fenetre').classList.contains('agrandie'), titre: document.getElementById('d-agrandir').title }));
    ok(a.agrandie && a.titre === 'Restaurer' && (await statut()).windowState.maximized === true, 'fenêtre agrandie : la page montre « Restaurer »', a);
    await launcher.click('#d-agrandir');
    await pause(300);
    await principal(app, "w.isMaximized = () => false; w.emit('unmaximize');");
    await pause(300);
    a = await dom(() => ({ agrandie: document.getElementById('fenetre').classList.contains('agrandie'), titre: document.getElementById('d-agrandir').title }));
    const appels = await principal(app, 'const r = w.__appels; delete w.maximize; delete w.unmaximize; delete w.isMaximized; delete w.__appels; return r;');
    ok(!a.agrandie && a.titre === 'Agrandir' && JSON.stringify(appels) === '["maximize","unmaximize"]', 'bouton Agrandir puis Restaurer : maximize puis unmaximize', { ...a, appels });

    /* ---- au plus petit (960 × 600) : rien ne déborde, le bouton Jouer reste visible et cliquable */
    await principal(app, 'w.setSize(arg[0], arg[1]);', mini);
    await launcher.waitForFunction((m) => innerWidth === m[0] && innerHeight === m[1], mini, { timeout: 10000 });
    const petit = await dom(() => {
      const b = document.getElementById('btn-main').getBoundingClientRect(), c = document.getElementById('d-contenu');
      const cible = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { cote: Math.round(document.querySelector('.d-cote').getBoundingClientRect().width), deborde: c.scrollWidth > c.clientWidth || document.documentElement.scrollWidth > innerWidth,
        jouer: b.bottom <= innerHeight && !!cible && !!cible.closest('#btn-main') };
    });
    ok(!petit.deborde && petit.jouer && petit.cote === 210, 'fenêtre au plus petit : pas de débordement, bouton Jouer visible', petit);
    await shot(launcher, 'interface-2-petite');
    await principal(app, 'w.setSize(arg[0], arg[1]);', attendue);
    await launcher.waitForFunction((m) => innerWidth === m[0] && innerHeight === m[1], attendue, { timeout: 10000 });

    /* ---- pages de la barre latérale */
    const pages = [['actus', 'Actualités'], ['maj', 'Mises à jour'], ['installation', 'Installation'], ['reglages', 'Paramètres'], ['accueil', 'Accueil']];
    const vues = [];
    for (const [sec, nom] of pages) {
      await launcher.click(`.d-nav [data-section="${sec}"]`);
      vues.push(await dom((x) => {
        const c = document.getElementById('d-contenu');
        const v = [...document.querySelectorAll('.d-page')].filter((e) => !e.hidden).map((e) => e.dataset.page).join();
        return `${v === x[0] && document.getElementById('d-fil').textContent === x[1] && c.scrollWidth <= c.clientWidth ? 'ok' : 'ÉCHEC'}:${v}`;
      }, [sec, nom]));
      if (sec === 'installation') await shot(launcher, 'interface-3-installation');
    }
    ok(vues.every((v) => v.startsWith('ok')), 'barre latérale : chaque page s’ouvre, sans défilement horizontal', vues);

    /* ---- fond : animé à l'accueil seulement quand la fenêtre est visible et au premier plan ; en pause ailleurs */
    await principal(app, 'w.focus();');
    await pause(500);
    const fond = await dom(() => ({ visible: document.hasFocus() && !document.hidden, anime: document.getElementById('d-hero').dataset.anime }));
    ok(fond.anime === (fond.visible ? 'oui' : 'non'), 'accueil : fond animé si la fenêtre est visible et au premier plan', fond);
    await launcher.click('.d-nav [data-section="actus"]');
    ok(await dom(() => document.getElementById('d-hero').dataset.anime) === 'non', 'autre page : fond en pause');

    /* ---- réglage du fond animé : enregistré dans settings.json, image fixe à l'accueil */
    await launcher.click('.d-nav [data-section="reglages"]');
    ok(await dom(() => { const i = document.querySelector('[data-reglage="fondAnime"]'); return !i.closest('[data-ligne]').hidden && i.checked; }), 'paramètres : « Fond d’écran animé », allumé par défaut');
    const reglages = () => JSON.parse(fs.readFileSync(path.join(USER, 'settings.json'), 'utf8'));
    await launcher.click('label:has([data-reglage="fondAnime"])');
    await pause(500);
    const r1 = (() => { try { return reglages(); } catch (e) { return null; } })();
    await launcher.click('.d-nav [data-section="accueil"]');
    const fixe = await dom(() => { const h = document.getElementById('d-hero'); return { fixe: h.classList.contains('fond-fixe'), anime: h.dataset.anime }; });
    ok(r1 && r1.fondAnime === false && (await statut()).settings.fondAnime === false && fixe.fixe && fixe.anime === 'non', 'fond animé coupé : enregistré, image fixe à l’accueil', { reglages: r1, ...fixe });
    await launcher.click('.d-nav [data-section="reglages"]');
    await launcher.click('label:has([data-reglage="fondAnime"])');
    await pause(500);
    ok(reglages().fondAnime === true, 'fond animé rallumé : enregistré');
    await shot(launcher, 'interface-4-parametres');

    /* ---- fond des Marécages Maudits (par défaut) : la vidéo se lit dans la vraie fenêtre, quel que soit le focus
       (sous Xvfb, la fenêtre peut ne pas l'avoir) ; les sons passent par le préchargement et se décodent */
    await launcher.click('.d-nav [data-section="accueil"]');
    const lu = await dom(async () => {
      const v = window.ZS_FOND.video().video, t0 = v.currentTime;
      await v.play().catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
      return { fond: document.getElementById('d-hero').dataset.fond, erreur: v.error ? v.error.code : null, pret: v.readyState, avance: +(v.currentTime - t0).toFixed(2), duree: v.duration };
    });
    ok(lu.fond === 'marais' && !lu.erreur && lu.pret >= 2 && lu.avance > 0 && Math.abs(lu.duree - 7.7) < 0.1, 'Marécages : fond par défaut, vidéo lue dans les fichiers du launcher (media-src)', lu);
    const amb = await dom(async () => {
      const r = await window.zs.ambiance(), c = new AudioContext();
      const ids = Object.keys(r.fichiers).sort();
      const decodes = await Promise.all(ids.map((id) => c.decodeAudioData(r.fichiers[id].slice(0)).then((b) => b.duration > 0, () => false)));
      c.close();
      return { ids: ids.length, meta: Object.keys(r.meta).length, decodes: decodes.filter(Boolean).length, octets: ids.reduce((n, id) => n + r.fichiers[id].byteLength, 0) };
    });
    ok(amb.ids === 11 && amb.meta === 11 && amb.decodes === 11 && amb.octets > 1e6, 'sons de l’ambiance : 11 fichiers passés par le préchargement et décodés', amb);
    await launcher.click('.d-nav [data-section="reglages"]');
    await launcher.click('label:has([data-reglage="fondEclairs"])');
    // le volume ne se règle que sons allumés (ils restent une affaire de la page : rien dans settings.json)
    await launcher.click('label:has(#d-sons)');
    await dom(() => { const i = document.getElementById('d-volume'); i.value = '35'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    await launcher.click('label:has(#d-sons)');
    await launcher.selectOption('[data-reglage="fond"]', 'bunker');
    await pause(600);
    const r2 = reglages();
    await launcher.click('.d-nav [data-section="accueil"]');
    const bunker = await dom(() => document.getElementById('d-hero').dataset.fond);
    ok(r2.fond === 'bunker' && r2.fondEclairs === false && r2.volumeSons === 35 && !('fondSons' in r2) && bunker === 'bunker', 'réglages du fond : Bunker 7, éclairs coupés, volume 35 %, enregistrés dans settings.json (pas les sons)', { ...r2, accueil: bunker });
    await launcher.click('.d-nav [data-section="reglages"]');
    await launcher.selectOption('[data-reglage="fond"]', 'marais');
    await pause(400);
    await launcher.click('label:has([data-reglage="fondEclairs"])');
    await pause(400);
    const r3 = reglages();
    ok(r3.fond === 'marais' && r3.fondEclairs === true, 'réglages du fond : retour aux Marécages Maudits, éclairs rallumés', r3);

    ok(!erreurs.length, 'aucune erreur de page ni refus de la politique de sécurité', erreurs.slice(0, 5));
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Interface du launcher : tous les essais sont passés.');
  process.exit(failures ? 1 : 0);
})();
