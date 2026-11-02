// v1.2 dans le prototype assemblé (logique + mini-moteur + effets + sons + interface) :
// seconde moitié de la phase 1 (double sort sous le joueur, 1 à 2 s d'écart) et meute de chiens zombies qui reste
// jusqu'à la mort du boss (répit, phase 3, rituel, phase 5 dans le bunker), puis tombe en cendres à la défaite.
// node proto/dev/test-v12-assemblage.js
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
  // vue libre (caméra de démonstration), sans l'arme en 1re personne
  const vue = async (nom, cam, cible, lieu) => {
    await p.evaluate(([cam, cible, lieu]) => {
      const c = BOSS.camera; c.position.set(cam.x, cam.y, cam.z); c.lookAt(cible.x, cible.y, cible.z); c.updateMatrixWorld();
      BOSS.renderer.render(BOSS.monde.scenes[lieu], c); BOSS.fx.rendreEcran(BOSS.renderer);
    }, [cam, cible, lieu]);
    await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 });
  };

  // ── 0. versions, sons, journal ──
  const r0 = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    window.LOG = [];
    BOSS.combat.on('*', (t, d) => { if (t === 'meute' || t === 'chien' || t === 'action' || t === 'projectile' || t === 'zone' || t === 'etat') LOG.push({ type: t, d: JSON.parse(JSON.stringify(d || {})), temps: BOSS.temps(), j: { x: BOSS.joueur.position.x, z: BOSS.joueur.position.z } }); });
    while (BOSS.bots.liste().length) BOSS.retirerBot();
    BOSS.invincible(true);
    if (BOSS.audio) await BOSS.audio.precharger();
    window.MORSURES = 0;
    if (BOSS.audio) { const f = BOSS.audio.morsureChien; BOSS.audio.morsureChien = (q, l) => { MORSURES++; return f(q, l); }; }
    const sons = ['chien_faille', 'chien_hurlement', 'chien_grognement', 'chien_aboiement', 'chien_morsure', 'chien_mort'];
    const charges = BOSS.audio ? sons.filter((k) => !!BOSS.audio.jouer(k, { plein: true, volume: 0 })) : [];
    return { versions: [BOSS.audio && BOSS.audio.version, BOSS.hud.version, BOSS.fx.version || null], sons: charges.length };
  });
  ok(/^1\.([2-9]|\d\d)\./.test(r0.versions[0]) && /^1\.([2-9]|\d\d)\./.test(r0.versions[1]), 'audio et interface en 1.2 ou plus', r0.versions);
  ok(r0.sons === 6, 'les 6 sons des chiens sont chargés et jouables', r0.sons);

  // ── 1. première moitié de la phase 1 : un seul sort par invocation, pas de chiens ──
  const r1 = await p.evaluate(() => {
    BOSS.lancerCombat('phase1');
    const t0 = BOSS.temps();
    BOSS.avancer(60 * 16, 1 / 60);
    const inv = LOG.filter((x) => x.type === 'action' && x.d.id === 'invocation' && x.temps > t0);
    const lancers = inv.filter((x) => x.d.etape === 'lancer').length, recups = inv.filter((x) => x.d.etape === 'recuperation').length;
    return { lancers, recups, chiens: BOSS.zombies.nombre(null, 'chien'), seconde: !!BOSS.etat().secondeMoitie, meute: BOSS.etat().meute };
  });
  ok(r1.recups >= 2 && r1.lancers === r1.recups && r1.chiens === 0 && !r1.seconde, 'avant 50 % : un sort par invocation, aucun chien', r1);

  // ── 2. le boss passe sous 50 % : meute lâchée, double sort ──
  const r2 = await p.evaluate(() => {
    const e = BOSS.etat(), t0 = BOSS.temps();
    BOSS.combat.forcer('pvSegment', 0.45 * e.barre.max);
    BOSS.avancer(60 * 4, 1 / 60);
    const ev = LOG.filter((x) => x.temps >= t0);
    return {
      seconde: !!BOSS.etat().secondeMoitie,
      meute: ev.filter((x) => x.type === 'meute').map((x) => x.d.etat + ':' + x.d.max),
      chiens: ev.filter((x) => x.type === 'chien').map((x) => x.d.etat),
      vivants: BOSS.zombies.nombre(null, 'chien'),
      toast: document.querySelector('.b7h-toasts').textContent,
      objectif: document.querySelector('.b7h-objectif span').textContent
    };
  });
  ok(r2.seconde && r2.meute[0] === 'dechainee:2', 'sous 50 % : seconde moitié, meute « dechainee » (2 chiens en solo)', r2);
  ok(r2.chiens.filter((x) => x === 'faille').length === 2 && r2.chiens.filter((x) => x === 'apparition').length === 2 && r2.vivants === 2, 'deux failles puis deux chiens', r2.chiens);
  ok(/chiens/.test(r2.toast) && /chiens/.test(r2.objectif), 'message et objectif de la seconde moitié', { toast: r2.toast, objectif: r2.objectif });

  // ── 3. double sort sous le joueur, 1 à 2 s d'écart ──
  const r3 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    const J = BOSS.joueur;
    for (let i = 0; i < 60 * 24; i++) BOSS.avancer(1, 1 / 60);
    const inv = LOG.filter((x) => x.type === 'action' && x.d.id === 'invocation' && x.temps > t0);
    // regroupe par action : une action commence à chaque première « preparation » qui suit une « recuperation » (ou le début)
    const paires = []; let cur = null;
    inv.forEach((x) => {
      if (x.d.etape === 'preparation' && (!cur || cur.fini)) { cur = { etapes: [], lancers: [], fini: false }; paires.push(cur); }
      if (!cur) return;
      cur.etapes.push(x.d.etape);
      if (x.d.etape === 'lancer') cur.lancers.push(x.temps);
      if (x.d.etape === 'recuperation') cur.fini = true;
    });
    const completes = paires.slice(1).filter((q) => q.fini);   // la 1re peut avoir commencé avant la fenêtre
    const zones = LOG.filter((x) => x.type === 'zone' && x.temps > t0).map((x) => Math.hypot(x.d.position.x - x.j.x, x.d.position.z - x.j.z));
    return { n: completes.length, etapes: completes.map((q) => q.etapes.join('>')), ecarts: completes.filter((q) => q.lancers.length === 2).map((q) => +(q.lancers[1] - q.lancers[0]).toFixed(2)),
      zones: zones.map((d) => +d.toFixed(2)), chiens: BOSS.zombies.nombre(null, 'chien'), morsures: MORSURES };
  });
  const paireOk = r3.etapes.length >= 2 && r3.etapes.every((s) => s === 'preparation>lancer>preparation>lancer>recuperation');
  ok(paireOk, 'chaque invocation : préparation › lancer › préparation › lancer › récupération', r3.etapes);
  ok(r3.ecarts.length >= 2 && r3.ecarts.every((x) => x >= 1.0 - 0.05 && x <= 2.0 + 0.05), 'entre les deux sorts : 1 à 2 s', r3.ecarts);
  ok(r3.zones.length >= 3 && r3.zones.every((d) => d <= 1.6), 'les zones tombent sous le joueur (≤ 1,6 m de lui)', r3.zones);
  ok(r3.morsures >= 1, 'les chiens rattrapent le joueur et mordent (son de morsure)', r3.morsures);
  // capture : zones sous le joueur, chiens qui arrivent
  await p.evaluate(() => { const J = BOSS.joueur.position; BOSS.joueur.teleporter({ x: J.x, y: 0, z: J.z }, 0, 'salle'); });
  {
    const q = await p.evaluate(() => ({ x: BOSS.joueur.position.x, z: BOSS.joueur.position.z }));
    await vue('v12-01-double-sort-et-meute', { x: q.x + 5.5, y: 4.2, z: q.z + 5.5 }, { x: q.x, y: 0.4, z: q.z }, 'salle');
  }

  // ── 4. un chien tué revient (10 à 15 s) ──
  const r4 = await p.evaluate(() => {
    const ids0 = BOSS.zombies.liste().filter((z) => z.type === 'chien').map((z) => z.id);
    const t0 = BOSS.temps();
    BOSS.zombies.toucher(ids0[0], 1e6, 'corps', { joueur: 'j1' });
    let tNouveau = null;
    for (let i = 0; i < 60 * 20 && tNouveau == null; i++) {
      BOSS.avancer(1, 1 / 60);
      if (LOG.some((x) => x.type === 'chien' && x.d.etat === 'apparition' && x.temps > t0)) tNouveau = BOSS.temps() - t0;
    }
    const morts = LOG.filter((x) => x.type === 'chien' && x.d.etat === 'mort' && x.temps >= t0).length;
    return { morts, tNouveau: tNouveau && +tNouveau.toFixed(1), vivants: BOSS.zombies.nombre(null, 'chien'), cfg: BOSS_B7_CONFIG.chiens.reapparition };
  });
  ok(r4.morts === 1 && r4.tNouveau != null && r4.tNouveau >= r4.cfg[0] && r4.tNouveau <= r4.cfg[1] + 1.5 && r4.vivants === 2, 'chien tué → remplaçant après ' + r4.cfg.join('–') + ' s (+ faille)', r4);

  // ── 5. fin de la phase 1 → répit : les zombies brûlent, les chiens restent ──
  const r5 = await p.evaluate(() => {
    const avant = BOSS.zombies.liste().filter((z) => z.type === 'chien').map((z) => z.id).sort();
    const t0 = BOSS.temps();
    BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    BOSS.avancer(60 * 3, 1 / 60);
    const apres = BOSS.zombies.liste().filter((z) => z.type === 'chien').map((z) => z.id).sort();
    return { etat: BOSS.etat().etat, avant, apres, fins: LOG.filter((x) => x.type === 'chien' && x.d.etat === 'fin' && x.temps >= t0).length, zombies: BOSS.zombies.nombre('salle', 'zombie') };
  });
  ok(r5.etat === 'repit' && JSON.stringify(r5.avant) === JSON.stringify(r5.apres) && r5.fins === 0 && r5.zombies === 0, 'répit : zombies en cendres, mêmes chiens vivants', r5);

  // ── 6. phase 3 et rituel (allerA) : meute présente ──
  const r6 = await p.evaluate(() => {
    const res = {};
    ['phase3', 'rituel'].forEach((e) => {
      BOSS.lancerCombat(e);
      BOSS.avancer(60 * 5, 1 / 60);
      res[e] = { chiens: BOSS.zombies.nombre('salle', 'chien'), active: !!(BOSS.etat().meute && BOSS.etat().meute.active) };
    });
    return res;
  });
  ok(r6.phase3.chiens === 2 && r6.rituel.chiens === 2 && r6.phase3.active && r6.rituel.active, 'phase 3 et rituel : la meute chasse', r6);
  {
    const q = await p.evaluate(() => { const A = BOSS_B7_ARENE.salle; return { x: A.origine.x + A.cercle.x, z: A.origine.z + A.cercle.z }; });
    await p.evaluate((q) => { BOSS.joueur.teleporter({ x: q.x, y: 0, z: q.z + 1 }, 0, 'salle'); BOSS.avancer(60, 1 / 60); }, q);
    await vue('v12-02-meute-rituel', { x: q.x - 6.5, y: 3.4, z: q.z + 6.5 }, { x: q.x, y: 0.5, z: q.z }, 'salle');
  }

  // ── 7. phase 5 : la meute revient dans le bunker ──
  const r7 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    BOSS.lancerCombat('phase5');
    let tBunker = null;
    for (let i = 0; i < 60 * 12 && tBunker == null; i++) {
      BOSS.avancer(1, 1 / 60);
      if (BOSS.zombies.nombre('bunker', 'chien') >= 2) tBunker = BOSS.temps() - t0;
    }
    BOSS.avancer(30, 1 / 60);
    return { tBunker: tBunker && +tBunker.toFixed(1), salle: BOSS.zombies.nombre('salle', 'chien'), bunker: BOSS.zombies.nombre('bunker', 'chien'),
      chiens: BOSS.zombies.liste().filter((z) => z.type === 'chien').map((z) => ({ x: z.position.x, z: z.position.z })), j: { x: BOSS.joueur.position.x, z: BOSS.joueur.position.z } };
  });
  ok(r7.tBunker != null && r7.salle === 0 && r7.bunker === 2, 'phase 5 : 2 chiens dans le bunker (après ' + r7.tBunker + ' s), plus aucun dans la salle', r7);
  if (r7.chiens.length) {
    const c = r7.chiens[0];
    await p.evaluate((c) => { BOSS.joueur.teleporter({ x: c.x + 3, y: 0, z: c.z + 3 }, Math.atan2(-3, -3), 'bunker'); BOSS.avancer(2, 1 / 60); }, c);
    const c2 = await p.evaluate(() => { const l = BOSS.zombies.liste().filter((z) => z.type === 'chien'); const z = l[0]; return z ? { x: z.position.x, z: z.position.z } : null; });
    if (c2) await vue('v12-03-chien-bunker', { x: c2.x + 2.4, y: 1.6, z: c2.z + 2.4 }, { x: c2.x, y: 0.5, z: c2.z }, 'bunker');
  }

  // ── 8. défaite : les chiens tombent en cendres, la meute se dissipe, plus d'apparition ──
  const r8 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    for (let k = 0; k < 400 && BOSS.etat().etat === 'phase5'; k++) { BOSS.combat.toucherBoss({ joueur: 'j1', degats: 400, zone: 'corps' }); BOSS.avancer(2, 1 / 60); }
    BOSS.avancer(60 * 3, 1 / 60);
    const fins = LOG.filter((x) => x.type === 'chien' && x.d.etat === 'fin' && x.temps >= t0).map((x) => x.d.raison);
    const dissipee = LOG.some((x) => x.type === 'meute' && x.d.etat === 'dissipee' && x.temps >= t0);
    const t1 = BOSS.temps();
    BOSS.avancer(60 * 20, 1 / 60);
    const nouvelles = LOG.filter((x) => x.type === 'chien' && (x.d.etat === 'faille' || x.d.etat === 'apparition') && x.temps > t1).length;
    return { etat: BOSS.etat().etat, fins, dissipee, vivants: BOSS.zombies.nombre(null, 'chien'), nouvelles };
  });
  ok(r8.fins.length === 2 && r8.fins.every((x) => x === 'defaite') && r8.dissipee && r8.vivants === 0 && r8.nouvelles === 0, 'défaite : chiens en cendres, meute dissipée, plus aucune faille', r8);
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
