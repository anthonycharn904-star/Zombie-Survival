// v1.1 dans le prototype assemblé (logique + mini-moteur + effets + sons + interface) :
// sprinteurs, zombies qui traquent en phase 3, piliers détruits par 3 blocs, horde de la phase 4,
// « Munitions max » à chaque fin de phase (ramassage → munitions pleines + annonce), téléportation sur dégâts + cercle rituel.
// node proto/dev/test-v11-assemblage.js
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RACINE = path.resolve(__dirname, '../..'), SORTIE = path.resolve(__dirname, '../../captures/tests');
let ko = 0; const ok = (c, l, x) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + l + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) ko++; };
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(RACINE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.listen(0, '127.0.0.1', async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL/.test(m.text())) err.push(m.text()); });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/prototype/index.html?auto=1');
  await p.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  const e0 = await p.evaluate(() => window.erreur || null);
  if (e0) { console.log('ERREUR', e0); process.exit(2); }
  const shot = async (nom) => { await p.evaluate(() => BOSS.rendre()); await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 }); };
  // vue libre (caméra de démonstration) : position, point visé, lieu ; sans l'arme en 1re personne
  const vue = async (nom, cam, cible, lieu) => {
    await p.evaluate(([cam, cible, lieu]) => {
      const c = BOSS.camera; c.position.set(cam.x, cam.y, cam.z); c.lookAt(cible.x, cible.y, cible.z); c.updateMatrixWorld();
      BOSS.renderer.render(BOSS.monde.scenes[lieu], c); BOSS.fx.rendreEcran(BOSS.renderer);
    }, [cam, cible, lieu]);
    await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 });
  };

  // ── 0. réglages, sons, journal ──
  const r0 = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    window.LOG = [];
    BOSS.combat.on('*', (t, d) => { if (t === 'pilier' || t === 'bonus' || t === 'teleport') LOG.push({ type: t, d: JSON.parse(JSON.stringify(d || {})), temps: BOSS.temps() }); });
    while (BOSS.bots.liste().length) BOSS.retirerBot();
    BOSS.invincible(true);
    if (BOSS.audio) await BOSS.audio.precharger();
    const annonces = [];
    if (BOSS.audio) { const f = BOSS.audio.annoncerBonus; BOSS.audio.annoncerBonus = (t) => { annonces.push(t); return f(t); }; }
    window.ANNONCES = annonces;
    return { musique: BOSS.audio ? BOSS.audio.getVolume('musique') : null, versions: [BOSS.audio && BOSS.audio.version, BOSS.hud.version],
      annonce: !!(BOSS.audio && BOSS_SONS_MANIFESTE_OK()), curseur: +document.querySelector('[data-vol="musique"]').value };
    function BOSS_SONS_MANIFESTE_OK() { try { return BOSS.audio.stats && BOSS.audio.pret !== undefined && !!BOSS.audio.jouer('annonce_munitions_max', { plein: true, volume: 0 }); } catch (e) { return false; } }
  });
  ok(r0.musique === 1.4 && r0.curseur === 1.4, 'musique du combat à 1,4 (v1.0 : 0,85, soit ≈ +4,3 dB), curseur du panneau aligné', r0);
  ok(r0.annonce, 'son « annonce_munitions_max » chargé et jouable', r0);
  ok(r0.versions.every((v) => /^1\.([1-9]|\d\d)\./.test(v || '')), 'modules audio et interface en 1.1 ou plus', r0.versions);

  // ── 1. sprinteurs agressifs (phase 1) ──
  const r1 = await p.evaluate(() => {
    BOSS.lancerCombat('phase1');
    BOSS.avancer(60 * 12, 1 / 60);
    // le joueur s'enfuit à l'opposé de la meute : on mesure la course des zombies qui le rattrapent
    const A = BOSS_B7_ARENE.salle, O = A.origine, zs = BOSS.zombies.liste();
    let gx = 0, gz = 0; zs.forEach((z) => { gx += z.position.x / zs.length; gz += z.position.z / zs.length; });
    const ux = O.x - gx, uz = O.z - gz, ul = Math.hypot(ux, uz) || 1;
    BOSS.joueur.teleporter({ x: O.x + ux / ul * 10, y: 0, z: O.z + uz / ul * 10 }, 0, 'salle');
    BOSS.avancer(90, 1 / 60);                     // ils finissent leur coup en cours (≈ 0,6 s), se retournent et accélèrent
    const j = BOSS.joueur.position;
    const pos = () => { const m = {}; BOSS.zombies.liste().forEach((z) => { m[z.id] = { x: z.position.x, z: z.position.z, d: Math.hypot(z.position.x - j.x, z.position.z - j.z), etat: z.etat }; }); return m; };
    const a = pos(); BOSS.avancer(30, 1 / 60); const c = pos();
    const v = Object.keys(a).filter((id) => c[id] && a[id].d > 3 && c[id].d > 3).map((id) => Math.hypot(c[id].x - a[id].x, c[id].z - a[id].z) / 0.5).filter((x) => x > 0.5).sort((x, y) => x - y);
    const rapproches = Object.keys(a).filter((id) => c[id] && c[id].d < a[id].d).length;
    let cx = 0, cz = 0, nz = 0; BOSS.zombies.liste().forEach((z) => { cx += z.position.x; cz += z.position.z; nz++; });
    return { n: Object.keys(a).length, v: v.map((x) => +x.toFixed(2)), max: v.length ? v[v.length - 1] : 0, med: v.length ? v[Math.floor(v.length / 2)] : 0, rapproches,
      j: { x: j.x, z: j.z }, g: { x: cx / Math.max(1, nz), z: cz / Math.max(1, nz) } };
  });
  ok(r1.n >= 3 && r1.max >= 5.5 && r1.med >= 4.5, 'zombies au sprint (≈ 6 m/s ; joueur : 4,6 en marche, 6,6 au sprint)', r1);
  ok(r1.rapproches >= Math.ceil(r1.n * 0.6), 'ils foncent sur le joueur', { rapproches: r1.rapproches, n: r1.n });
  {                                                 // derrière le joueur, la meute qui fonce sur lui
    const dx = r1.g.x - r1.j.x, dz = r1.g.z - r1.j.z, l = Math.hypot(dx, dz) || 1;
    await vue('v11-01-sprinteurs', { x: r1.j.x - dx / l * 1.5, y: 2.1, z: r1.j.z - dz / l * 1.5 }, { x: r1.g.x, y: 0.9, z: r1.g.z }, 'salle');
  }

  // ── 2. phase 1 terminée → « Munitions max » au sol ; ramassage → munitions pleines + annonce ──
  const r2 = await p.evaluate(() => {
    const a = BOSS.arme;
    BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9 }); BOSS.avancer(10, 1 / 60);
    const bonus = BOSS.jeu.bonus(), ev = LOG.filter((x) => x.type === 'bonus');
    a.munitions = 4; a.reserve = 0;
    const avant = { m: a.munitions, r: a.reserve };
    const q = bonus[0];
    const vu = document.querySelector('.b7h-toasts').textContent;
    return { etat: BOSS.etat().etat, bonus, ev: ev.map((x) => x.d), avant, toast: vu, pos: q && q.position };
  });
  ok(r2.etat === 'repit' && r2.bonus.length === 1 && r2.bonus[0].type === 'munitions-max' && r2.ev.length === 1 && r2.ev[0].mode === 'depose', 'fin de la phase 1 : un « Munitions max » posé au sol (pas activé d’office)', r2);
  ok(/Munitions max/.test(r2.toast), 'message « Bonus Munitions max au sol »', r2.toast);
  // vue sur le bonus (le joueur reste à l'écart pour ne pas le ramasser)
  await p.evaluate((q) => { BOSS.joueur.teleporter({ x: q.x + 6, y: 0, z: q.z + 6 }, 0, 'salle'); BOSS.avancer(20, 1 / 60); }, r2.pos);
  await vue('v11-02-bonus-au-sol', { x: r2.pos.x + 2.6, y: 2.0, z: r2.pos.z + 2.6 }, { x: r2.pos.x, y: 0.9, z: r2.pos.z }, 'salle');
  const r2b = await p.evaluate((q) => {
    const a = BOSS.arme;
    BOSS.joueur.teleporter({ x: q.x, y: 0, z: q.z }, null, 'salle'); BOSS.avancer(20, 1 / 60);
    return { m: a.munitions, r: a.reserve, max: a.reglages.reserveMax, ch: a.reglages.chargeur, reste: BOSS.jeu.bonus().length, ramasses: BOSS.bonusRamasses.slice(), annonces: ANNONCES.slice(), toast: document.querySelector('.b7h-toasts').textContent };
  }, r2.pos);
  ok(r2b.m === r2b.ch && r2b.r === r2b.max && r2b.reste === 0, 'ramassé : chargeur et réserve pleins, bonus retiré', r2b);
  ok(r2b.ramasses.length === 1 && r2b.annonces.length === 1 && r2b.annonces[0] === 'munitions-max', 'annonce vocale « Munitions max ! » au ramassage', { ramasses: r2b.ramasses, annonces: r2b.annonces });

  // ── 3. phase 3 : les zombies traquent le joueur ; un pilier tombe après 3 blocs ──
  const r3 = await p.evaluate(() => {
    BOSS.lancerCombat('phase3');
    const A = BOSS_B7_ARENE.salle, O = A.origine, P0 = A.piliers[0], c = { x: O.x + P0.x, z: O.z + P0.z }, r = P0.rayon;
    let maxZ = 0, coups = 0, detruitA = null, t = 0;
    const touches = () => LOG.filter((x) => x.type === 'pilier' && x.d.id === P0.id);
    for (let i = 0; i < 60 * 150 && (detruitA == null || t < 20); i++) {
      if (i % 15 === 0) {                          // caché derrière le pilier 0, à l'opposé du boss
        const bp = BOSS.etat().boss.position, dx = c.x - bp.x, dz = c.z - bp.z, l = Math.hypot(dx, dz) || 1;
        BOSS.joueur.teleporter({ x: c.x + dx / l * (r + 0.85), y: 0, z: c.z + dz / l * (r + 0.85) }, Math.atan2(-dx, -dz), 'salle');
      }
      BOSS.avancer(1, 1 / 60); t += 1 / 60;
      maxZ = Math.max(maxZ, BOSS.zombies.nombre('salle'));
      const tt = touches(); coups = tt.length;
      if (detruitA == null && tt.some((x) => x.d.etat === 'detruit')) detruitA = +t.toFixed(2);
    }
    const tt = touches(), st = BOSS.etat().piliers.filter((q) => q.id === P0.id)[0], m = BOSS.monde.etatPiliers().filter((q) => q.id === P0.id)[0];
    return { maxZ, detruitA, evs: tt.map((x) => x.d.etat + ':' + x.d.coups), etat: st, monde: { etat: m.etat, collision: m.collision }, etatCombat: BOSS.etat().etat };
  });
  ok(r3.maxZ >= 4, 'phase 3 : des zombies apparaissent et traquent le joueur', r3.maxZ);
  ok(r3.detruitA != null && r3.evs.join(',') === 'touche:1,touche:2,detruit:3', 'pilier 0 : touché, touché, détruit au 3e bloc', r3);
  ok(r3.etat && r3.etat.etat === 'detruit' && r3.monde.etat === 'detruit', 'état détruit dans la logique et dans le monde (moignon)', r3);
  const r3b = await p.evaluate(() => {
    BOSS.avancer(60 * 3, 1 / 60);
    const A = BOSS_B7_ARENE.salle, O = A.origine, P0 = A.piliers[0];
    BOSS.joueur.teleporter({ x: O.x + P0.x * 0.25, y: 0, z: O.z + P0.z * 0.25 }, Math.atan2(P0.x, P0.z), 'salle');
    BOSS.avancer(2, 1 / 60);
    return { etats: BOSS.monde.etatPiliers().map((q) => q.etat), p0: { x: O.x + P0.x, z: O.z + P0.z }, p1: { x: O.x + A.piliers[1].x, z: O.z + A.piliers[1].z }, o: { x: O.x, z: O.z } };
  });
  {                                                 // pilier effondré au premier plan, un pilier intact derrière
    const q = r3b.p0, o = r3b.o, dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
    await vue('v11-03-pilier-effondre', { x: o.x + dx / l * (l - 5.5) - dz / l * 2.0, y: 3.0, z: o.z + dz / l * (l - 5.5) + dx / l * 2.0 }, { x: q.x, y: 0.6, z: q.z }, 'salle');
  }
  r3b.etats = r3b.etats || [];
  ok(r3b.etats.filter((x) => x === 'detruit').length >= 1, 'pilier effondré visible', r3b.etats);

  // ── 4. phase 4 : la horde (solo : config.phase4.apparitions.max) ──
  const r4 = await p.evaluate(() => {
    BOSS.lancerCombat('rituel');
    const A = BOSS_B7_ARENE.salle, O = A.origine;
    let pire = 0;
    for (let i = 0; i < 60 * 30; i++) {
      if (i % 30 === 0) BOSS.joueur.teleporter({ x: O.x + A.cercle.x, y: 0, z: O.z + A.cercle.z + 1 }, 0, 'salle');
      BOSS.avancer(1, 1 / 60); pire = Math.max(pire, BOSS.zombies.nombre('salle'));
    }
    return { pire, max: BOSS_B7_CONFIG.phase4.apparitions.max, intervalle: BOSS_B7_CONFIG.phase4.apparitions.intervalle, etat: BOSS.etat().etat, capture: BOSS.etat().capture && BOSS.etat().capture.etat };
  });
  ok(r4.pire >= r4.max - 2, 'phase 4 : jusqu’à ' + r4.max + ' zombies en même temps (v1.0 : 12)', r4);
  await p.evaluate(() => { const A = BOSS_B7_ARENE.salle, O = A.origine; BOSS.joueur.teleporter({ x: O.x + A.cercle.x, y: 0, z: O.z + A.cercle.z + 1 }, 0, 'salle'); BOSS.avancer(1, 1 / 60); });
  {                                                 // vue plongeante sur le cercle et la horde
    const A = await p.evaluate(() => { const A = BOSS_B7_ARENE.salle; return { x: A.origine.x + A.cercle.x, z: A.origine.z + A.cercle.z }; });
    await vue('v11-04-horde-rituel', { x: A.x + 7.5, y: 7.5, z: A.z + 7.5 }, { x: A.x, y: 0.3, z: A.z }, 'salle');
  }

  // ── 5. phase 5 : un chargeur sur le boss → téléportation ailleurs dans le bunker + cercle rituel au sol ──
  const r5 = await p.evaluate(() => {
    BOSS.lancerCombat('phase5');
    let i = 0;
    const loin = () => {                          // le joueur se tient loin du boss : pas de frappe pendant la rafale
      const bp = BOSS.etat().boss.position, pts = BOSS.monde.points.bunker.arrivee.concat(BOSS_B7_ARENE.bunker7.apparitionsBoss || []);
      let best = null, bd = -1; pts.forEach((q) => { const d = Math.hypot(q.x - bp.x, q.z - bp.z); if (d > bd) { bd = d; best = q; } });
      BOSS.joueur.teleporter({ x: best.x, y: 0, z: best.z }, null, 'bunker'); return bd;
    };
    while (i++ < 60 * 20 && !(BOSS.etat().boss.present && BOSS.etat().boss.visible && BOSS.etat().boss.vulnerable && BOSS.etat().tempsEtat > BOSS_B7_CONFIG.phase5.teleportDegats.delaiMin + 0.2)) { if (i % 30 === 0) loin(); BOSS.avancer(1, 1 / 60); }
    const ecart = loin();
    const b0 = Object.assign({}, BOSS.etat().boss.position), sols0 = BOSS.fx.stats().sols, n0 = LOG.filter((x) => x.type === 'teleport' && x.d.raison === 'degats').length;
    for (let k = 0; k < 30; k++) { BOSS.combat.toucherBoss({ joueur: 'j1', degats: 35, zone: 'corps', position: BOSS.etat().boss.position }); BOSS.avancer(6, 1 / 60); }
    let j = 0;
    while (j++ < 60 * 3 && !LOG.some((x) => x.type === 'teleport' && x.d.raison === 'degats' && x.d.sens === 'arrivee')) BOSS.avancer(1, 1 / 60);
    BOSS.avancer(36, 1 / 60);                     // le cercle d'arrivée est entièrement tracé (≈ 0,35 s)
    const tp = LOG.filter((x) => x.type === 'teleport' && x.d.raison === 'degats');
    const arr = tp.filter((x) => x.d.sens === 'arrivee')[0];
    return { tp: tp.slice(n0).map((x) => x.d.sens + '@' + x.d.lieu), b0, b1: arr && arr.d.position, sols: [sols0, BOSS.fx.stats().sols], toast: document.querySelector('.b7h-toasts').textContent, ecart: +ecart.toFixed(1) };
  });
  const dtp = r5.b1 ? Math.hypot(r5.b1.x - r5.b0.x, r5.b1.z - r5.b0.z) : 0;
  ok(r5.tp.indexOf('depart@bunker') >= 0 && r5.tp.indexOf('arrivee@bunker') >= 0 && dtp > 6, 'chargeur vidé sur lui : il se téléporte ailleurs dans le bunker', { tp: r5.tp, distance: +dtp.toFixed(1) });
  ok(r5.sols[1] >= r5.sols[0] + 2, 'cercles rituels au sol (départ et arrivée)', r5.sols);
  ok(/téléporte/.test(r5.toast), 'message « il se téléporte… retrouvez-le »', r5.toast);
  // vue sur le cercle d'arrivée (le joueur s'en approche : le noir de la phase 5 ne laisse voir qu'à quelques mètres)
  {
    const q = r5.b1 || r5.b0;
    await p.evaluate((q) => { BOSS.joueur.teleporter({ x: q.x + 2.5, y: 0, z: q.z + 2.5 }, Math.atan2(-2.5, -2.5), 'bunker'); BOSS.avancer(2, 1 / 60); }, q);
    await vue('v11-05-cercle-teleport', { x: q.x + 1.2, y: 4.6, z: q.z + 1.2 }, { x: q.x, y: 0, z: q.z }, 'bunker');
  }

  // ── 6. bonus de chaque fin de phase dans le prototype (repli : lieux) ──
  const r6 = await p.evaluate(() => LOG.filter((x) => x.type === 'bonus').map((x) => x.d.phase + ':' + x.d.lieu + ':' + x.d.mode));
  ok(r6.length >= 2 && r6.every((x) => /depose$/.test(x)), 'bonus de fin de phase posés au sol', r6);
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
