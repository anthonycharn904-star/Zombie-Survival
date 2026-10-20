'use strict';
/* HUD « portrait + points » (jeu 2.0.6), dans la fenêtre du jeu du launcher : paquet d'Anthony chargé (hud-points.js
   1.0.0, police Teko et portrait intégrés) ; en bas à gauche, au-dessus du bloc des manches, sans le recouvrir ;
   portrait d'Anthony, points en jaune, haut des chiffres sur le haut du portrait ; l'ancien affichage masqué ; caché
   au menu, en pause et en fin de partie ; gains (une bulle par image, double points compris), achat (bulle rouge),
   achat refusé (secousse rouge, rien ne change) ; digi pass « ∞ » ; nouvelle partie sans bulle ; partie de test
   des Mod Tools ; coéquipier (coop) ; clics et pointeur laissés au jeu ; rendu sans erreur.
     xvfb-run -a node e2e/hud-points.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-hudpts-'));
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
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const H = PTS_HUD.hud, root = H && H.element, bl = document.getElementById('bl');
      const val = root && root.querySelector('.zs-points__row--local .zs-points__value'), face = root && root.querySelector('.zs-points__row--local .zs-points__face');
      const shown = () => !root.classList.contains('zs-points--hidden');
      const box = (e) => e.getBoundingClientRect();
      const step = (n) => __zs.step(n, 1 / 60);
      // bulles en vol : animations de bulle en cours (gain ou dépense)
      const bulles = (kind) => root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.classList.contains('zs-points__pop--' + kind)).map((a) => a.effect.target.textContent);
      const calme = () => { for (const a of root.getAnimations({ subtree: true })) a.finish(); };
      ok(typeof PointsHud === 'object' && PointsHud.version === '1.0.0' && H && root.parentNode === bl && document.body.classList.contains('zs-pts') && !PTS_HUD.err,
        'paquet chargé (hud-points.js 1.0.0), HUD créé dans le bloc du bas à gauche', PTS_HUD.err);
      ok(getComputedStyle(document.getElementById('points-wrap')).display === 'none', 'ancien affichage des points (en bas à droite) masqué');
      persoBeforeRender(); ptsHudFrame();
      ok(!shown(), 'au menu : HUD des points caché');
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); G.round = 1; HUD.round(false); step(10);
      const st = getComputedStyle(val), img = face.querySelector('img');
      ok(shown() && val.textContent === String(RULES.startPoints) && G.points === RULES.startPoints && st.color === 'rgb(249, 220, 62)' && /ZS Teko/.test(st.fontFamily) && img.src === PointsHud.PORTRAIT_ANTHONY,
        `en partie : portrait d'Anthony, « ${val.textContent} » en jaune (police Teko)`, { txt: val.textContent, color: st.color });
      const f = box(face), v = box(val), b = box(bl), r = box(root);
      ok(Math.abs(f.left - b.left) < 1.5 && r.bottom <= b.top - 10 && f.width >= 52 && f.width <= 120 && Math.abs(v.top - f.top) < 0.09 * f.height,
        `en bas à gauche, au-dessus des manches (${(b.top - r.bottom).toFixed(0)} px), portrait de ${f.width.toFixed(0)} px, chiffres calés sur son haut`, { f, v, b, r });
      const all = [root, ...root.querySelectorAll('*')].every((e) => getComputedStyle(e).pointerEvents === 'none');
      ok(all, 'clics et verrouillage du pointeur laissés au jeu (pointer-events: none)');
      // gains : une bulle par image (les gains d'une même image se regroupent)
      calme(); const p0 = G.points;
      for (let i = 0; i < 8; i++) addPoints(10);
      step(1);
      const g = bulles('gain');
      ok(G.points === p0 + 80 && val.textContent === String(p0 + 80) && g.length === 1 && g[0] === '+80', `gains : ${p0} → ${val.textContent}, une bulle « ${g[0]} » pour huit touches dans la même image`, g);
      calme(); G.timers.double = 5; const p1 = G.points; addPoints(50); step(1); G.timers.double = 0;
      const g2 = bulles('gain');
      ok(G.points === p1 + 100 && g2[0] === '+100', `double points : bulle « ${g2[0]} »`, g2);
      // achat
      calme(); const p2 = G.points, okBuy = trySpend(250); step(1);
      const s = bulles('spend');
      ok(okBuy && G.points === p2 - 250 && val.textContent === String(p2 - 250) && s.length === 1 && s[0] === '−250', `achat : ${p2} → ${val.textContent}, bulle rouge « ${s[0]} »`, s);
      // achat refusé
      calme(); const p3 = G.points, no = trySpend(p3 + 1000); step(1);
      const shake = val.getAnimations().some((a) => a.playState === 'running');
      ok(!no && G.points === p3 && val.textContent === String(p3) && shake && bulles('spend').length === 0, 'achat refusé : le nombre tremble en rouge, rien ne change');
      // pause, reprise
      calme(); pauseGame(); persoBeforeRender(); ptsHudFrame(); const enPause = shown();
      resumeGame(); step(1);
      ok(!enPause && shown(), 'caché en pause, revenu à la reprise');
      // digi pass, puis nouvelle partie
      unlockDigipass(); step(1);
      const inf = val.textContent, pts = G.points, spent = trySpend(1e6); step(1);
      ok(inf === '∞' && spent && G.points === pts && val.textContent === '∞', 'digi pass : « ∞ », achats sans dépense');
      calme(); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } step(2);
      ok(val.textContent === String(G.points) && G.points === RULES.startPoints && !G.cheat && bulles('gain').length + bulles('spend').length === 0,
        `nouvelle partie : « ${val.textContent} », sans bulle`);
      // coop : un coéquipier au-dessus du joueur
      const j2 = ptsHudCoequipier({ id: 'j2', name: 'Joueur 2', points: 500 });
      const rows = [...root.querySelectorAll('.zs-points__row')];
      const c2 = j2 && getComputedStyle(j2.element.querySelector('.zs-points__value')).color;
      ok(j2 && rows.length === 2 && rows[0] === j2.element && rows[1].classList.contains('zs-points__row--local') && c2 === 'rgb(134, 224, 112)' && box(j2.element).height < box(rows[1]).height,
        'coop : un coéquipier au-dessus du joueur, plus petit, en vert', c2);
      H.removePlayer('j2');
      ok(root.querySelectorAll('.zs-points__row').length === 1, 'coop : coéquipier retiré');
      // fin de partie, menu
      G.state = 'gameover'; persoBeforeRender(); ptsHudFrame(); const fin = shown();
      G.state = 'playing'; quitToMenu(); persoBeforeRender(); ptsHudFrame();
      ok(!fin && !shown(), 'caché en fin de partie et au menu');
      renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Mod Tools : partie de test (bouton Test)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const root = PTS_HUD.hud.element, val = root.querySelector('.zs-points__row--local .zs-points__value');
      ZS.playTest(MAPS.byId.bunker7); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.step(5, 1 / 60);
      ok(G.editorSession && !root.classList.contains('zs-points--hidden') && val.textContent === String(G.points), `Mod Tools, partie de test : HUD affiché, « ${val.textContent} »`);
      ZS.stopTest(); persoBeforeRender(); ptsHudFrame();
      ok(root.classList.contains('zs-points--hidden'), 'Mod Tools : caché au retour dans l’éditeur');
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
  console.log(failures ? `${failures} échec(s).` : 'HUD des points : conforme (portrait, points, bulles, refus, visibilité, digi pass, coop).');
  process.exit(failures ? 1 : 0);
})();
