'use strict';
/* La machine de mort (jeu 2.0.7), dans la fenêtre du jeu du launcher : les critères de son INTEGRATION.md (§ 8) qui se
   vérifient dans la page.
   Chargement (paquet tel quel, instance au lancement de la partie, 18 sons) ; tirage (avec les cinq autres bonus) ;
   miniature au sol ; ramassage (annonce, bandeau, arme du joueur rangée telle quelle) ; mains sur les poignées ; tir par
   le tir du jeu (dégâts, points, munitions du paquet) ; arrêt ; chargeur vide et minuteur (l'arme d'avant revient avec
   ses munitions) ; blocages (visée, achats) ; perte à terre ; renouvellement ; HUD (munitions du jeu cachées, bonus
   actifs) ; déplacement × 0,88 ; vue TPS (le corps la tient) ; sauvegarde refusée pendant l'usage ; aucun programme
   compilé au premier ramassage ; rendu sans erreur.
     xvfb-run -a node e2e/machine-de-mort.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-mdm-'));
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
    // bloc 1 : chargement, tirage, miniature, ramassage, mains, tir, arrêt
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const image = () => { renderEnabled = true; render(); renderEnabled = false; };
      ok(typeof MachineDeMort === 'object' && typeof MachineDeMort.creer === 'function' && MachineDeMort.VERSION === '1.0.0' && !MDM.inst,
        'paquet chargé tel quel (MachineDeMort 1.0.0), pas d’instance avant la première partie');
      ok(POWERUPS.deathmachine && POWERUPS.deathmachine.name === 'Machine de mort' && !WEAPONS.deathmachine && !BOX_POOL.includes('deathmachine'),
        'bonus « Machine de mort » parmi les bonus ; ni dans les armes ni dans la boîte');
      __zs.map('bunker7'); __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      ok(MDM.inst && !MDM.err && MDM.inst.vue.parent === vmCamera && vmCamera.parent === vmScene, 'instance créée au lancement de la partie, arme dans la vue des armes', MDM.err);
      // tirage : le sac des bonus la contient (une chance sur six)
      const auHasard = Object.keys(POWERUPS).filter((k) => POWERUPS[k].tirage !== false);   // l'atout gratuit (easter eggs) n'en est pas
      Powerups.bag = []; const vus = new Set();
      for (let i = 0; i < 12; i++) { if (!Powerups.bag.length) Powerups.bag = shuffle(auHasard.slice()); vus.add(Powerups.bag.pop()); }
      ok(vus.has('deathmachine') && auHasard.length === 6, 'tirage : avec les cinq autres bonus', [...vus]);
      image(); const prog0 = renderer.info.programs.length;
      return MDM.inst.sons.charger().then((c) => {
        ok(c && c.charges === 18 && c.total === 18, `18 sons du paquet décodés (${c && c.charges}/${c && c.total})`, c);
        // miniature au sol, devant le joueur
        __zs.drop('deathmachine'); __zs.step(2);
        const p = Powerups.list.find((x) => x.type === 'deathmachine'), v = MDM.sol[0];
        ok(p && v && v.p === p && v.b.objet.parent === scene && p.m.children.length === 0, 'miniature dorée du paquet au sol, sur l’entrée du jeu (sans son modèle)');
        image();
        ok(renderer.info.programs.length === prog0, `miniature : aucun programme compilé (précompilés au lancement)`, { avant: prog0, apres: renderer.info.programs.length });
        return Promise.resolve(annoncePrepare()).then(() => {           // voix décodées pendant que le bonus est au sol
        // ramassage : le joueur sur la miniature
        const s0 = curSlot(), mag0 = s0.mag, res0 = s0.res, dits = [], say0 = Sound.say;
        Sound.say = (t) => dits.push(t);
        player.pos.x = p.x; player.pos.z = p.z; __zs.step(3);
        Sound.say = say0;
        const M = MDM.inst;
        ok(!Powerups.list.includes(p) && v.pris && M.actif && Arms.state === 'mdm' && !Arms.holder.visible,
          'ramassage : l’arme du joueur rangée, la machine de mort sort', { etat: M.etat, arms: Arms.state });
        ok(document.getElementById('banner-title').textContent === 'Machine de mort' && (ANNONCE.joue === 'deathmachine' || dits.includes('Machine de mort !')),
          'ramassage : bandeau et annonce « Machine de mort ! » (voix de l’annonceur)', { voix: ANNONCE.joue, dits });
        ok(document.body.classList.contains('zs-mdm-actif') && getComputedStyle(document.getElementById('weapon')).visibility === 'hidden'
          && M.hud && M.munitions === 700, 'HUD : munitions de l’arme du jeu cachées, compteur du paquet à 700');
        ok(Math.abs(vmCamera.fov - MDM.fov) < 1e-6, `vue des armes à ${MDM.fov}° pendant l’usage`);
        __zs.step(45);                                                  // sortie (0,6 s)
        PERSO.arms.object.updateMatrixWorld(true);
        const dR = PERSO.arms.anchors.right.getWorldPosition(new THREE.Vector3()).distanceTo(M.arme.ancres.droite.getWorldPosition(new THREE.Vector3()));
        const dL = PERSO.arms.anchors.left.getWorldPosition(new THREE.Vector3()).distanceTo(M.arme.ancres.gauche.getWorldPosition(new THREE.Vector3()));
        ok(M.etat === 'active' && dR < 0.005 && dL < 0.01, `mains sur les poignées : droite ${(dR * 1000).toFixed(1)} mm, gauche ${(dL * 1000).toFixed(1)} mm`, { etat: M.etat });
        // pu-active : « Machine de mort » et son temps
        const pu = document.getElementById('pu-active').textContent;
        ok(/Machine de mort/.test(pu), `bonus actifs : « ${pu.replace(/\s+/g, ' ').trim()} »`);
        ok(Math.abs(mdmVitesse() - 0.88) < 1e-9 && persoEtatLocal().arme.id === 'deathmachine', 'déplacement × 0,88 ; le corps tient la machine de mort (vue TPS)');
        ok(/Machine de mort en main/.test(sauveRefus() || ''), `sauvegarde refusée pendant l’usage (« ${sauveRefus()} »)`);
        // blocages : visée, achats
        Input.rmb = true; __zs.step(10); const ads = player.ads; Input.rmb = false;
        ok(ads === 0 && armsBusy(), 'pas de visée ; achats qui occupent les mains refusés (armsBusy)');
        // tir : un zombie devant le joueur, détente tenue 1 s
        cameraBasis();
        const sp = pickSpawnPoint(), z = sp ? spawnZombie(sp, 1e6) : null;   // un zombie dans la pièce, 4 m devant
        const coups = [], dz0 = damageZombie;
        window.damageZombie = function (zz, d, o) { if (o && o.slot === MDM.slot) coups.push(d); return dz0.apply(this, arguments); };
        if (z) { z.outside = false; z.state = 'chase'; z.gy = player.gy; z.pos.set(player.pos.x + _fwd.x * 4, player.gy, player.pos.z + _fwd.z * 4); z.hp = 1e6; }
        const tirs0 = G.stats.shots, m0 = M.munitions, pts0 = G.points;
        Input.lmb = true; __zs.step(60); Input.lmb = false;
        window.damageZombie = dz0;
        const tires = m0 - M.munitions;
        ok(tires > 15 && tires <= 30 && G.stats.shots - tirs0 === tires, `tir : ${tires} coups en 1 s (montée du rotor, puis 30 par seconde), comptés par le jeu`, { tires, shots: G.stats.shots - tirs0 });
        ok(!z || (coups.length > 0 && coups.every((d) => d >= 150) && G.points > pts0), `dégâts par le tir du jeu : ${coups.length} touches, ${coups[0] || '—'} chacune, points gagnés`, { z: !!z, coups: coups.length });
        const reg0 = M.logique.regime; __zs.step(30);
        ok(M.logique.regime < reg0 && M.munitions === m0 - tires, 'détente lâchée : le rotor ralentit, plus aucun coup');
        // l'arme du joueur n'a pas bougé
        ok(curSlot() === s0 && s0.mag === mag0 && s0.res === res0, 'arme du joueur rangée telle quelle (chargeur et réserve)');
        image();
        return out;
        });
      });
    })).forEach(report);
    // bloc 2 : chargeur vide, minuteur, renouvellement, perte à terre, fin
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const M = MDM.inst, s0 = curSlot(), mag0 = s0.mag, res0 = s0.res;
      // les zombies tués pendant ce bloc ne lâchent aucun bonus (une autre machine de mort ramassée la renouvellerait)
      const lacher0 = maybeDropPowerup; window.maybeDropPowerup = () => {};
      // chargeur vide : détente tenue jusqu'au bout
      const fins = []; const off = M.on('fin', (d) => fins.push(d.raison));
      Input.lmb = true; for (let i = 0; i < 60 * 30 && M.actif; i++) __zs.step(1); Input.lmb = false;
      ok(!M.actif && fins[0] === 'vide' && M.munitions === 0, `chargeur vide : rangée (« ${fins[0]} »)`, fins);
      __zs.step(30);
      ok(Arms.state === 'idle' && Arms.holder.visible && curSlot() === s0 && s0.mag === mag0 && s0.res === res0 && !document.body.classList.contains('zs-mdm-actif') && Math.abs(vmCamera.fov - MDM.fov0) < 1e-6,
        'l’arme d’avant revient avec ses munitions ; HUD et vue du jeu rétablis', { arms: Arms.state, mag: s0.mag });
      ok(sauveRefus() === null || !/Machine de mort/.test(sauveRefus()), 'après l’usage : la sauvegarde ne la refuse plus');
      // minuteur : sans tirer, rangée à 30 s
      mdmRamasse(); __zs.step(2);
      ok(M.actif && M.munitions === 700, 'second ramassage : elle ressort, 700 cartouches');
      let t = 0; for (; t < 60 * 32 && M.actif; t++) __zs.step(1);
      ok(!M.actif && fins[1] === 'expire' && t / 60 > 29.5 && t / 60 < 31.5, `minuteur : rangée à ${(t / 60).toFixed(1)} s sans tirer (« ${fins[1]} »)`, fins);
      __zs.step(30);
      // renouvellement : un second bonus pendant l'usage remet 30 s et 700
      mdmRamasse(); __zs.step(60 * 10); Input.lmb = true; __zs.step(60); Input.lmb = false;
      const avant = { t: M.tempsRestant, m: M.munitions };
      mdmRamasse(); __zs.step(1);
      ok(avant.t < 21 && avant.m < 700 && M.tempsRestant > 29.5 && M.munitions === 700, `renouvellement : ${avant.t.toFixed(1)} s et ${avant.m} → ${M.tempsRestant.toFixed(1)} s et ${M.munitions}`);
      // à terre (atout de réanimation) : perdue tout de suite ; relevé, l'arme d'avant
      player.perks.add('souffle'); player.souffleUses = 0; goDown(); __zs.step(1);
      const perdue = !M.actif && fins.includes('a-terre');
      revivePlayer(); __zs.step(30);
      ok(perdue && Arms.state !== 'mdm' && curSlot() === s0, 'joueur à terre : perdue tout de suite ; relevé, il a l’arme d’avant', fins);
      // fin de partie : perdue
      mdmRamasse(); __zs.step(2); const avantFin = M.actif;
      gameOver();
      ok(avantFin && !M.actif && fins.includes('fin-de-partie'), 'fin de partie : perdue', fins);
      startGame(null); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      // bonus au sol ramassé puis nouvelle partie : rien ne reste
      __zs.drop('deathmachine'); __zs.step(2); mdmRamasse(); __zs.step(2);
      const enSol = MDM.sol.length;
      quitToMenu();
      ok(enSol === 1 && !M.actif && MDM.sol.length === 0 && Arms.state !== 'mdm', 'retour au menu : arme rangée, miniatures retirées');
      off(); window.maybeDropPowerup = lacher0;
      renderEnabled = true; render(); renderEnabled = false;
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
  console.log(failures ? `${failures} échec(s).` : 'Machine de mort : conforme (paquet, bonus, ramassage, mains, tir, fins, renouvellement, perte, HUD, TPS, sauvegarde).');
  process.exit(failures ? 1 : 0);
})();
