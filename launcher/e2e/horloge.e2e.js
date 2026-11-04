'use strict';
/* Easter egg de l'horloge de la gare (jeu 2.0.7, demande d'Anthony du 4 novembre 2026), dans la fenêtre du jeu du
   launcher, sur Bunker 7 : horloge 3D dans les abords (l'ancienne plate retirée des abords seulement), visible depuis
   la Salle d'arrivée ; petite aiguille sur 12, grande sur 3 ; un cran par tir sur le cadran (plombs comptés une fois),
   rien à côté, à travers un mur, ni pendant le combat du boss ; sur 12 : son de réussite, « Atout gratuit » et
   « Munitions max » au sol, atteignables ; une seule fois ; au ramassage, le joueur boit un atout qu'il n'a pas (fiole
   à sa couleur, sans courant), même un atout sans machine sur la carte ; à terre pendant la boisson, l'atout reste dû ;
   bonus jamais tiré au hasard ; remise sur 3 h à chaque partie ; ni lampe ni secousse ; rendu sans erreur.
     xvfb-run -a node e2e/horloge.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-horloge-'));
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
    // ------------------------------------------------------------ construction : horloge, aiguilles, bonus, fenêtres
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const H = HORL;
      const Q = window.__horl = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
          player.gy = 0; placePlayer(25.5, 26.2);   // Salle d'arrivée, 0,8 m derrière la fenêtre (25, 27), face à la gare
        },
        // tir depuis les yeux du joueur vers (x, y, z) (un tir : un numéro ; plombs : plusieurs rayons du même tir)
        tir(x = H.cx, y = H.cy, z = H.cz, plombs = 1) {
          G.stats.shots++;
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          for (let i = 0; i < plombs; i++) {
            let dx = x - ex, dy = y - ey + i * 0.04, dz = z - ez; const L = Math.hypot(dx, dy, dz);
            hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
          }
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        lampes() { let n = 0; scene.traverse((o) => { if (o.isLight) n++; }); return n; },
        vise() { player.yaw = Math.atan2(player.pos.x - H.cx, player.pos.z - H.cz); player.pitch = Math.atan2(H.cy - player.gy - PLAYER_EYE, Math.hypot(player.pos.x - H.cx, player.pos.z - H.cz)); },
      };
      Q.partie();
      const gare = World.outskirts && World.outskirts.buildings.filter((b) => b.id === 'ruin_station');
      ok(gare && gare.length === 1 && H.retires === 3 && H.pivot && H.cadre.parent === OUTSKIRTS.group && H.groupe === OUTSKIRTS.group,
        'horloge 3D posée sur la gare des abords (l’ancienne horloge plate retirée : 3 pièces)', { retires: H.retires });
      const lib = modelParts('ruin_station').parts.filter((q) => q.f === 'paint' && H.vieux.includes(q.c)).length;
      ok(lib === 3, 'modèle de la gare intact dans la bibliothèque des Mod Tools (horloge plate gardée)');
      const petite = H.cadre.children.find((m) => m.geometry === H.geos.petite);
      ok(H.cran === 3 && !H.fait && Math.abs(H.pivot.rotation.z + Math.PI / 2) < 1e-6 && petite && Math.abs(petite.rotation.z) < 1e-6 && horlActive(),
        'petite aiguille sur 12, grande sur 3, horloge active');
      ok(Object.values(H.mats).every((m) => _linDone.has(m) && SHARED.has(m)) && Object.values(H.geos).every((g) => SHARED.has(g)),
        'matières converties une fois et partagées avec le cache des abords');
      // vue depuis les fenêtres de la Salle d'arrivée : rien de la grille entre les yeux et le cadran
      const vues = World.windows.filter((w) => {
        const ex = w.x + 0.5 - w.nx * 1.3, ez = w.z + 0.5 - w.nz * 1.3, ey = PLAYER_EYE;
        let dx = H.cx - ex, dy = H.cy - ey, dz = H.cz - ez; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
        raycast(ex, ey, ez, dx, dy, dz, 140);
        return (!RAY.hit || RAY.t > L) && horlRayon(ex, ey, ez, dx, dy, dz, 140) > 0 && zoneAt(ex, ez, 0) === LAYOUT.startZone;
      });
      ok(vues.length >= 1, `horloge visible et atteignable depuis ${vues.length} fenêtre(s) de la Salle d'arrivée (≈ ${Math.hypot(H.cx - 25.5, H.cz - 26.2).toFixed(0)} m)`);
      // bonus « atout gratuit » : déclaré, jamais tiré au hasard
      let tires = 0, vu = false;
      for (let i = 0; i < 40; i++) {
        Powerups.bag = []; Powerups.drops = 0; Powerups.acc = Powerups.threshold;
        maybeDropPowerup(player.pos.x, player.pos.z, player.gy); tires++;
        if (Powerups.bag.includes('freeperk') || Powerups.list.some((p) => p.type === 'freeperk')) vu = true;
        clearPowerups();
      }
      ok(POWERUPS.freeperk && POWERUPS.freeperk.name === 'Atout gratuit' && !vu, `« Atout gratuit » déclaré, absent des ${tires} tirages au hasard`);
      Powerups.drops = 0;
      // programmes de l'horloge et de la fiole compilés dès la première image, le joueur tournant le dos à la gare
      Q.partie(); player.yaw = 0; player.pitch = 0; __zs.step(1);
      const chauffe = H.chauffe && H.chauffe.parent === H.cadre;
      renderEnabled = true; render(); renderEnabled = false;
      const prog = (m) => { const p = renderer.properties.get(m); return !!(p && p.currentProgram); };
      const compiles = Object.values(H.mats).every(prog) && prog(MAT.bottleGlass) && prog(MAT.powerup);
      Q.pas(2);
      const cull = []; H.cadre.traverse((m) => { if (m.isMesh) cull.push(m.frustumCulled); });
      ok(chauffe && compiles && !H.chauffe.parent && cull.every(Boolean), 'programmes de l’horloge et de la fiole compilés à la première image (pas de saccade au premier regard vers la gare)', { chauffe, compiles });
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ tirs : un cran par tir, rien à côté ni à travers un mur
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__horl, H = HORL;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const l0 = Q.lampes(), tics = [], t0 = window.horlSonTic;
      window.horlSonTic = function () { tics.push(H.cran); return t0.apply(this, arguments); };
      let shake = 0;
      try {
        Q.tir(); ok(H.cran === 4 && tics.length === 1, 'un tir sur le cadran : la grande aiguille avance d’une heure (4), déclic');
        Q.tir(H.cx, H.cy, H.cz, 8); ok(H.cran === 5 && tics.length === 2, 'un tir de fusil à pompe (8 plombs sur le cadran) : un seul cran (5)');
        Q.tir(H.cx + H.nz * 1.2, H.cy, H.cz - H.nx * 1.2); ok(H.cran === 5, 'tir sur la façade, à côté du cadran : rien');
        // derrière un mur de la Salle d'arrivée : le rayon bute sur la grille
        const sv = player.pos.clone();
        let mur = null;
        for (const x of [21.5, 22.5, 23.5, 27.5, 28.5, 30.5, 31.5]) {
          placePlayer(x, 26.2);
          const ex = player.pos.x, ey = PLAYER_EYE, ez = player.pos.z; let dx = H.cx - ex, dy = H.cy - ey, dz = H.cz - ez; const L = Math.hypot(dx, dy, dz);
          raycast(ex, ey, ez, dx / L, dy / L, dz / L, 140);
          if (RAY.hit && RAY.t < L) { mur = x; break; }
        }
        if (mur != null) Q.tir();
        ok(mur != null && H.cran === 5, `tir vers le cadran à travers un mur (joueur en x = ${mur}) : rien`);
        placePlayer(sv.x, sv.z);
        // combat du boss : aucun bonus (D3), l'horloge ignore les tirs
        const a0 = B7.actif; B7.actif = true;
        try { Q.tir(); } finally { B7.actif = a0; }
        ok(H.cran === 5, 'pendant le combat du boss : l’horloge ignore les tirs');
        // vrai tir de l'arme (fireWeapon), dispersion ramenée sur le cadran
        Q.vise(); Q.pas(1); Q.vise(); Q.pas(1);
        const s = Arms.slots[Arms.cur], sd = spreadDir, mag0 = s.mag = Math.max(s.mag, 3);
        spreadDir = () => { const ex = camera.position.x, ey = camera.position.y, ez = camera.position.z; let dx = H.cx - ex, dy = H.cy - ey, dz = H.cz - ez; const L = Math.hypot(dx, dy, dz); return { x: dx / L, y: dy / L, z: dz / L }; };
        try { fireWeapon(s); } finally { spreadDir = sd; }
        ok(H.cran === 6 && s.mag === mag0 - 1, 'tir de l’arme en main (fireWeapon) : un cran (6)');
        for (let i = 0; i < 20; i++) { Q.pas(1); shake = Math.max(shake, FX.shake); }
        ok(Math.abs(H.angle - Math.PI) < 1e-3, `l'aiguille saute sur 6 h (${(H.angle * 6 / Math.PI).toFixed(2)})`);
      } finally { window.horlSonTic = t0; }
      ok(shake === 0 && Q.lampes() === l0, `ni secousse ni lampe ajoutée (${l0} lampes)`);
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ midi : réussite, bonus, une seule fois, ramassage
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__horl, H = HORL;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const reussites = [], r0 = window.horlSonReussite;
      window.horlSonReussite = function () { reussites.push(G.time); return r0.apply(this, arguments); };
      let b = [];
      try {
        clearPowerups();
        for (let i = 0; i < 6; i++) Q.tir();
        b = Powerups.list.map((p) => ({ type: p.type, x: p.x, z: p.z, gy: p.gy, life: p.life }));
        ok(H.cran === 12 && H.fait && reussites.length === 1, 'sur 12 avec la petite : réussite, son joué une fois');
        Q.tir(); Q.tir();
        ok(H.cran === 12 && reussites.length === 1 && Powerups.list.length === 2, 'tirs suivants : rien (une fois par partie)');
      } finally { window.horlSonReussite = r0; }
      const zj = zoneAt(player.pos.x, player.pos.z, player.gy);
      const bon = (p) => locateNode(p.x, p.z, p.gy, true) >= 0 && zoneAt(p.x, p.z, p.gy) === zj && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) >= 1.35;
      ok(b.length === 2 && b.some((p) => p.type === 'freeperk') && b.some((p) => p.type === 'ammo') && b.every(bon) && Math.hypot(b[0].x - b[1].x, b[0].z - b[1].z) >= 1.35 && b.every((p) => p.life === HORL.vie),
        `« Atout gratuit » et « Munitions max » au sol, dans la salle du joueur, à ${b.map((p) => Math.hypot(p.x - player.pos.x, p.z - player.pos.z).toFixed(1)).join(' et ')} m (${HORL.vie} s)`, b);
      Q.pas(20);
      ok(Math.abs(H.angle - 2 * Math.PI) < 1e-3, 'grande aiguille sur midi');
      // ramassage : l'atout, puis les munitions
      const avant = new Set(player.perks), s = Arms.slots[Arms.cur];
      const fp = Powerups.list.find((p) => p.type === 'freeperk');
      placePlayer(fp.x, fp.z); Q.pas(2);
      const ban = HUD.el.banner.textContent;
      Q.pas(40);
      const bu = Arms.state === 'drink' ? Arms.drinkId : null, liq = Arms.bottle.userData.liquid.material, ete = Arms.bottle.userData.label.material;
      Q.pas(200);
      const neufs = [...player.perks].filter((id) => !avant.has(id));
      ok(/Atout gratuit/.test(ban) && bu && neufs.length === 1 && neufs[0] === bu && liq === bottleMats(bu).liquid && ete === bottleMats(bu).label && Arms.state === 'idle',
        `ramassage : « Atout gratuit », puis il boit ${bu && PERKS[bu].name} (fiole à sa couleur et à son étiquette), qu'il n'avait pas`, { ban, bu, neufs });
      s.res = 0; G.grenades = 0;
      const am = Powerups.list.find((p) => p.type === 'ammo');
      placePlayer(am.x, am.z); Q.pas(3);
      ok(s.res > 0 && G.grenades === RULES.maxGrenades, 'ramassage : « Munitions max » (réserves et grenades)');
      renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ cas : tous les atouts, nouvelle partie, autre carte
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__horl, H = HORL;
      Q.partie();
      ok(H.cran === 3 && !H.fait && H.dernier === -1 && Math.abs(H.pivot.rotation.z + Math.PI / 2) < 1e-6 && Powerups.list.length === 0, 'nouvelle partie : grande aiguille remise sur 3, bonus retirés');
      // le joueur a déjà tous les atouts : seulement « Munitions max »
      for (const id of Object.keys(PERKS)) player.perks.add(id);
      for (let i = 0; i < 9; i++) Q.tir();
      ok(H.fait && Powerups.list.length === 1 && Powerups.list[0].type === 'ammo', 'tous les atouts déjà pris : seulement « Munitions max »');
      // Quick Revive épuisé : jamais donné en cadeau
      player.perks.clear(); for (const id of Object.keys(PERKS)) if (id !== 'souffle') player.perks.add(id);
      player.souffleUses = 3;
      ok(atgLibres().length === 0, 'Quick Revive épuisé (3 relevés) : pas d’atout gratuit possible');
      player.souffleUses = 0;
      ok(atgLibres().join() === 'souffle', 'sinon, le seul atout qui manque');
      // à terre pendant la boisson (vraie chute, Quick Revive) : la fiole tombe, l'atout reste dû, rien n'est bu à terre ;
      // relevé (les atouts sont perdus, comme toujours), il boit l'atout dû
      player.perks.clear(); player.perks.add('souffle'); player.souffleUses = 0;
      applyPowerup('freeperk'); Q.pas(40);
      const b1 = Arms.state === 'drink' ? Arms.drinkId : null;
      goDown(); Q.pas(2);
      const tombee = !!(Arms.ev & DRINK_EV.dropped);
      Q.pas(60);
      const aTerre = player.down && !player.perks.has(b1) && Arms.state !== 'drink' && ATG.attente === 1;
      let rebu = null;
      for (let i = 0; i < 400 && !rebu; i++) { Q.pas(1); if (!player.down && Arms.state === 'drink') rebu = Arms.drinkId; }
      Q.pas(200);
      ok(b1 && b1 !== 'souffle' && tombee && aTerre && rebu && player.perks.size === 1 && player.perks.has(rebu) && Arms.state === 'idle' && ATG.attente === 0,
        `à terre pendant la boisson : la fiole tombe, rien n'est bu à terre ; relevé, il boit l'atout dû (${rebu && PERKS[rebu].name})`, { b1, tombee, aTerre, rebu, a: [...player.perks] });
      // pendant un rechargement : la boisson attend la fin (le chargeur est rempli, rien n'est coupé)
      player.perks.clear(); player.souffleUses = 0;
      const sR = Arms.slots[Arms.cur]; sR.mag = 0; sR.res = Math.max(sR.res, 40);
      startReload();
      const enRecharge = Arms.state === 'reload';
      applyPowerup('freeperk');
      let plein = null;
      for (let i = 0; i < 600 && plein === null; i++) { Q.pas(1); if (Arms.state === 'drink') plein = sR.mag; }
      Q.pas(200);
      ok(enRecharge && plein === wstat(sR, 'mag') && player.perks.size === 1, `ramassage pendant un rechargement : la boisson attend la fin du rechargement (chargeur à ${plein})`, { enRecharge, plein });
      // un atout à venir, sans machine sur la carte : offert aussi
      for (const id of Object.keys(PERKS)) player.perks.add(id);
      PERKS.essai = { name: 'Atout d’essai', cost: 0, color: '#3a7bd5', glow: '#8fbaff', core: '#e8f0ff', glyph: 'E', power: true, desc: 'Atout à venir (essai)' };
      let futur = false;
      try {
        const surCarte = (LAYOUT.perks || []).some((q) => q.p === 'essai');
        applyPowerup('freeperk'); Q.pas(40);
        const bu = Arms.state === 'drink' && Arms.drinkId;
        Q.pas(220);
        futur = !surCarte && bu === 'essai' && player.perks.has('essai');
      } finally { delete PERKS.essai; player.perks.delete('essai'); HUD.perks(); }
      ok(futur, 'un atout à venir, sans machine sur la carte, est offert et bu aussi');
      // tous les atouts : un bandeau, pas de boisson
      applyPowerup('freeperk'); Q.pas(40);
      ok(Arms.state !== 'drink' && /tous les atouts/.test(HUD.el.banner.textContent), 'tous les atouts déjà pris au ramassage : « Vous avez déjà tous les atouts »', HUD.el.banner.textContent);
      player.perks.clear(); HUD.perks();
      // autre carte : horloge inactive
      const m0 = G.mapId; G.mapId = 'autre';
      const inactive = !horlActive(); G.mapId = m0;
      ok(inactive, 'hors de Bunker 7 : horloge inactive');
      Q.partie();
      ok(H.cran === 3 && !H.fait, 'et de nouveau 3 h à la partie suivante');
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
  console.log(failures ? `${failures} échec(s).` : 'Horloge de la gare : conforme (modèle, aiguilles, tirs, réussite, bonus, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
