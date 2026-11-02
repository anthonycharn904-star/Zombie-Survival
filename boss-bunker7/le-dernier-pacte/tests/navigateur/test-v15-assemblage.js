// v1.5 dans le prototype assemblé (logique + mini-moteur + modèle + effets + sons + interface) : rages des mini-boss à 50 %
// (Le Survolté puise sa force dans le Septième puis électrifie les murs ; L'Irradié irradie zombies et chiens, nouveaux compris ;
// Le Démembré géant s'arrache le bras, d'où sort un flot plafonné de petits Démembrés, puis charge et projette), Munitions max
// à chaque mini-boss abattu, intangibilité de la phase 5 à la place des illusions.     node proto/dev/test-v15-assemblage.js
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
  const vue = async (nom, cam, cible, lieu) => {
    await p.evaluate(([cam, cible, lieu]) => {
      const c = BOSS.camera; c.position.set(cam.x, cam.y, cam.z); c.lookAt(cible.x, cible.y, cible.z); c.updateMatrixWorld();
      BOSS.renderer.render(BOSS.monde.scenes[lieu], c); BOSS.fx.rendreEcran(BOSS.renderer);
    }, [cam, cible, lieu]);
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 });
  };
  const vueJoueur = async (nom) => { await p.waitForTimeout(900); await p.evaluate(() => BOSS.rendre()); await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 }); };

  // ── 0. versions, sons ──
  const r0 = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    window.LOG = [];
    BOSS.combat.on('*', (t, d) => { if (['tube', 'miniBoss', 'murs', 'mursChoc', 'infection', 'bras', 'petitDemembre', 'intangible', 'bonus', 'action', 'etat', 'palier', 'frappe', 'joueurTouche'].indexOf(t) >= 0) LOG.push({ type: t, d: JSON.parse(JSON.stringify(d || {})), temps: BOSS.temps() }); });
    while (BOSS.bots.liste().length) BOSS.retirerBot();
    BOSS.invincible(true);
    if (BOSS.audio) await BOSS.audio.precharger();
    window.CAPA = [];
    if (BOSS.audio) { const f = BOSS.audio.sonMiniBoss; BOSS.audio.sonMiniBoss = (type, quoi, pos, opt) => { CAPA.push({ type, quoi, etat: opt && opt.etat, id: opt && opt.id, cible: opt && opt.cible, temps: BOSS.temps() }); return f(type, quoi, pos, opt); }; }
    window.DEG = [];
    BOSS.zombies.brancherDegats((z, id, f, src, info) => DEG.push({ type: z.type, zid: z.id, id, f, src, projection: !!(info && info.projection), temps: BOSS.temps() }));
    window.attendre = (pred, s, chaqueImage) => { const t0 = BOSS.temps(); for (let i = 0; i < Math.round(s * 60); i++) { if (chaqueImage) chaqueImage(i); BOSS.avancer(1, 1 / 60); if (pred()) return +(BOSS.temps() - t0).toFixed(2); } return null; };
    window.mbVivant = () => BOSS.zombies.liste().find((v) => v.miniBoss && v.vivant !== false);
    window.mbEtat = (type) => (BOSS.combat.etat().miniBoss || []).find((m) => m.type === type && m.etat === 'actif');
    window.seuilSuivant = () => BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
    // PV d'un mini-boss juste sous la moitié (petits coups : pas de dépassement)
    window.sousMoitie = (id) => { for (let k = 0; k < 200; k++) { const v = BOSS.zombies.liste().find((x) => x.id === id); if (!v || v.pv / v.pvMax < 0.495) break; BOSS.zombies.toucher(id, 0.02 * v.pvMax, 'corps', { joueur: 'j1' }); } };
    window.ARE = BOSS_B7_ARENE.salle;
    // distance au mur le plus proche de la salle octogonale (comme la logique : apothème le long de la normale)
    window.distMur = (q) => { let m = 1e9; ARE.murs.forEach((w) => { m = Math.min(m, ARE.apotheme - ((q.x - ARE.origine.x) * w.normale.x + (q.z - ARE.origine.z) * w.normale.z)); }); return m; };
    window.placer = (x, z, lacet) => { const g = BOSS.monde.grilles.salle.plusProcheLibre(x, z, 3) || { x, z }; BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, lacet || 0, 'salle'); return g; };
    window.nommes = (re) => (BOSS.audio ? BOSS.audio.stats().nommes : []).filter((n) => re.test(n));
    const nouveaux = ['survolte_surcharge', 'murs_electrification', 'murs_boucle', 'murs_arc', 'murs_choc', 'murs_extinction', 'irradie_infection', 'zombie_irradie',
      'demembre_arrachement', 'bras_lancer', 'bras_impact', 'bras_pulsation', 'petit_sortie', 'petit_effondrement', 'demembre_charge', 'demembre_percussion',
      'projection_mur', 'bras_fletri', 'intangible_debut', 'intangible_boucle', 'traversee_mur', 'resurgissement', 'palier_intangible'];
    const retires = ['illusion_apparition', 'illusion_dissipation', 'illusion_murmure', 'palier_illusions'];
    const essai = (k) => { const h = BOSS.audio.jouer(k, { plein: true, volume: 0 }); if (h) h.stop(0); return !!h; };
    return { versions: { logique: BossB7Logique.version, modele: BossB7Modele.version, audio: BOSS.audio && BOSS.audio.version, hud: BOSS.hud.version, fx: BossB7Fx.version },
      actions: ['evanouissement', 'resurgissement'].every((a) => BossB7Modele.actions.indexOf(a) >= 0),
      nouveaux: BOSS.audio ? nouveaux.filter(essai).length : 0, retires: BOSS.audio ? retires.filter(essai).length : -1,
      chargement: document.getElementById('chargement').textContent, illusionsApi: 'illusions' in BOSS };
  });
  ok(r0.versions.logique === '1.5.0' && r0.versions.modele === '2.3.0' && r0.versions.audio === '1.5.0' && r0.versions.hud === '1.5.0' && r0.versions.fx === '1.5.0' && r0.actions,
    'versions v1.5 (logique, modèle 2.3 avec évanouissement et resurgissement, effets, sons, interface)', r0.versions);
  const SALLE = await p.evaluate(() => { const S = BOSS_B7_ARENE.salle; return { centre: { x: S.origine.x + (S.centre ? S.centre.x : 0), z: S.origine.z + (S.centre ? S.centre.z : 0) } }; });
  ok(r0.nouveaux === 23 && r0.retires === 0 && /133 sons/.test(r0.chargement) && !r0.illusionsApi, 'les 23 sons de la v1.5 sont chargés (133 au total), ceux des illusions sont retirés', { nouveaux: r0.nouveaux, retires: r0.retires, chargement: r0.chargement });

  // ── 1. Le Survolté à 50 % : invulnérable, puise dans le Septième, puis murs électrifiés jusqu'à sa mort ──
  const r1 = await p.evaluate(() => {
    BOSS.lancerCombat('phase2'); BOSS.avancer(60, 1 / 60);
    seuilSuivant();
    attendre(() => !!mbVivant(), 14);
    BOSS.avancer(60 * 2.6, 1 / 60);
    const m = mbVivant();
    placer(ARE.origine.x + 3, ARE.origine.z - 5);           // loin des murs
    const fx0 = BOSS.fx.stats(), t0 = BOSS.temps();
    sousMoitie(m.id);
    BOSS.avancer(2, 1 / 60);
    const s1 = mbEtat('survolte'), pv1 = mbVivant().pv;
    const coup = BOSS.zombies.toucher(m.id, 0.2 * m.pvMax, 'corps', { joueur: 'j1' });
    BOSS.avancer(20, 1 / 60);
    const pv2 = mbVivant().pv, fx1 = BOSS.fx.stats();
    const barre = document.querySelector('.b7h-mb');
    const pendant = { invul: !!(s1 && s1.invulnerable), rage: s1 && s1.rage, coup, pv: [Math.round(pv1), Math.round(pv2)], classe: !!(barre && barre.classList.contains('invul')),
      etiquette: barre ? barre.textContent : '', toast: document.querySelector('.b7h-toasts').textContent, rubans: [fx0.rubans, fx1.rubans], taches: [fx0.taches, fx1.taches],
      ev: LOG.filter((x) => x.temps >= t0 && (x.type === 'miniBoss' || x.type === 'murs')).map((x) => x.type + ':' + (x.d.etat || '') + ':' + (x.d.capacite || '')) };
    const tE = attendre(() => { const e = BOSS.combat.etat(); return e.murs && e.murs.etat === 'electrifies'; }, 4);
    BOSS.avancer(30, 1 / 60);
    const e = BOSS.combat.etat(), danger = document.querySelector('.b7h-danger');
    return { pendant, tE: tE == null ? null : +(tE + 22 / 60).toFixed(2), murs: e.murs, invulApres: !!(mbEtat('survolte') || {}).invulnerable,
      banniere: !!(danger && danger.classList.contains('on')) && /Murs électrifiés/.test(danger.textContent), boucles: nommes(/^mur:/).length };
  });
  ok(r1.pendant.ev.indexOf('miniBoss:rage:surcharge') >= 0 && r1.pendant.invul && r1.pendant.coup && r1.pendant.coup.immunise && r1.pendant.pv[0] === r1.pendant.pv[1],
    'Survolté à 50 % : rage « surcharge », invulnérable (une balle ne lui enlève rien)', r1.pendant);
  ok(r1.pendant.classe && /Invulnérable/.test(r1.pendant.etiquette) && /puise sa force/.test(r1.pendant.toast), 'interface : « Invulnérable » sur sa barre, message de la surcharge', { etiquette: r1.pendant.etiquette, toast: r1.pendant.toast.slice(0, 120) });
  ok(r1.pendant.taches[1] > r1.pendant.taches[0] || r1.pendant.rubans[1] > r1.pendant.rubans[0], 'effets : le rayon puisé dans le Septième est dessiné', { rubans: r1.pendant.rubans, taches: r1.pendant.taches });
  ok(r1.tE != null && Math.abs(r1.tE - 2.5) < 0.3 && r1.murs.etat === 'electrifies' && !r1.invulApres, 'au bout de 2,5 s : murs électrifiés, il redevient vulnérable', { t: r1.tE, murs: r1.murs, invulnerable: r1.invulApres });
  ok(r1.banniere && r1.boucles === 8, 'bandeau « Murs électrifiés », un grésillement sur chacun des 8 murs', { banniere: r1.banniere, boucles: r1.boucles });
  {
    const q = await p.evaluate(() => { const m = mbVivant(); return { x: m.position.x, z: m.position.z }; });
    await vue('v15-21-murs-electrifies', { x: -4, y: 3.2, z: -6 }, { x: 14.5, y: 2.2, z: 6 }, 'salle');
  }
  const r1b = await p.evaluate(() => {
    // au centre : rien ; à 1,2 m du mur sud : 12 %/s par tics de 0,25 s, choc signalé (au plus un toutes les 0,5 s)
    BOSS.invincible(false); BOSS.joueur.soigner();
    const g0 = placer(ARE.origine.x + 2, ARE.origine.z - 4), t0 = BOSS.temps();
    BOSS.avancer(60, 1 / 60);
    const auCentre = LOG.filter((x) => x.type === 'joueurTouche' && x.d.source === 'murs' && x.temps >= t0).length;
    BOSS.joueur.soigner();
    const g = placer(ARE.origine.x + 1, ARE.origine.z - (ARE.apotheme - 1.2), 0), dMur = distMur(g), t1 = BOSS.temps();
    for (let i = 0; i < 60; i++) { if (i % 15 === 0) BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, 0, 'salle'); BOSS.avancer(1, 1 / 60); }
    const touches = LOG.filter((x) => x.type === 'joueurTouche' && x.d.source === 'murs' && x.temps >= t1);
    const chocs = LOG.filter((x) => x.type === 'mursChoc' && x.temps >= t1).map((x) => x.d.joueur + ':' + x.d.mur);
    BOSS.invincible(true); BOSS.joueur.soigner();
    // un coéquipier posé contre un mur s'en éloigne
    BOSS.ajouterBot();
    const bt = BOSS.bots.liste()[0], gb = BOSS.monde.grilles.salle.plusProcheLibre(-8, -(ARE.apotheme - 1.0) + 0.0, 2) || { x: -8, z: -13.8 };
    BOSS.jeu.teleporter(bt.id, { x: gb.x, y: 0, z: gb.z }, 0, 'salle');
    const d0 = distMur(bt.position);
    BOSS.avancer(60 * 4, 1 / 60);
    const d1 = distMur(BOSS.bots.liste()[0].position);
    BOSS.retirerBot();
    return { auCentre, dMur: +dMur.toFixed(2), total: +touches.reduce((s, x) => s + x.d.fraction, 0).toFixed(3), tics: touches.length, chocs, bot: [+d0.toFixed(2), +d1.toFixed(2)] };
  });
  ok(r1b.auCentre === 0 && r1b.dMur < 2.2 && r1b.tics >= 3 && Math.abs(r1b.total - 0.12) <= 0.035 && r1b.chocs.length >= 1 && r1b.chocs[0] === 'j1:mur4',
    'murs électrifiés : rien au centre ; à 1,2 m d’un mur ≈ 12 %/s et un choc signalé', r1b);
  ok(r1b.bot[1] >= 2.2, 'un coéquipier posé contre un mur électrifié s’en éloigne', { distanceAuMur: r1b.bot });
  const r1c = await p.evaluate(() => {
    const m = mbVivant(), t0 = BOSS.temps();
    placer(ARE.origine.x + 2, ARE.origine.z - 4);
    BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(60 * 1.6, 1 / 60);
    const ev = LOG.filter((x) => x.temps >= t0 && (x.type === 'murs' || x.type === 'bonus')).map((x) => x.type + ':' + (x.d.etat || x.d.source + ':' + x.d.miniBoss + ':' + x.d.type));
    const bonus = BOSS.jeu.bonus().filter((x) => x.type === 'munitions-max');
    const danger = document.querySelector('.b7h-danger');
    // ramassage : chargeur et réserve vides → pleins
    const A = BOSS.arme; A.munitions = 2; A.reserve = 10;
    const n0 = BOSS.bonusRamasses.length;
    if (bonus[0]) BOSS.joueur.teleporter({ x: bonus[0].position.x, y: 0, z: bonus[0].position.z }, 0, 'salle');
    BOSS.avancer(10, 1 / 60);
    return { ev, bonus: bonus.length, murs: BOSS.combat.etat().murs, banniere: !!(danger && danger.classList.contains('on')), boucles: nommes(/^mur:/).length,
      ramasse: BOSS.bonusRamasses.slice(n0).map((x) => x.type), munitions: [A.munitions, A.reglages.chargeur, A.reserve, A.reglages.reserveMax], protege: BOSS.combat.etat().boss.protege };
  });
  ok(r1c.ev.indexOf('murs:extinction') >= 0 && r1c.ev.indexOf('murs:eteints') >= 0 && r1c.murs === null && !r1c.banniere && r1c.boucles === 0 && !r1c.protege,
    'Survolté abattu : les murs s’éteignent (bandeau et sons compris), protection levée', r1c);
  ok(r1c.ev.indexOf('bonus:miniBoss:survolte:munitions-max') >= 0 && r1c.bonus === 1 && r1c.ramasse[0] === 'munitions-max' && r1c.munitions[0] === r1c.munitions[1] && r1c.munitions[2] === r1c.munitions[3],
    'Munitions max posé là où il tombe ; ramassé : chargeur et réserve pleins', { ev: r1c.ev, ramasse: r1c.ramasse, munitions: r1c.munitions });

  // ── 2. L'Irradié à 50 % : zombies et chiens irradiés jusqu'à sa mort, nouveaux compris ──
  const r2 = await p.evaluate(() => {
    seuilSuivant();
    attendre(() => !!mbVivant(), 16);
    BOSS.avancer(60 * 2.6, 1 / 60);
    const m = mbVivant();
    placer(ARE.origine.x - 2, ARE.origine.z - 6);
    const ids = [];
    [[-6, -2, 'zombie'], [-4, -9, 'zombie'], [5, -8, 'zombie'], [2, -10, 'chien'], [-8, -6, 'chien']].forEach(([x, z, type]) => {
      const g = BOSS.monde.grilles.salle.plusProcheLibre(x, z, 3) || { x, z };
      const id = BOSS.jeu.faireApparaitreZombie({ position: { x: g.x, y: 0, z: g.z }, lieu: 'salle', type, effet: 'normal' }); if (id != null) ids.push(id);
    });
    BOSS.avancer(60 * 2, 1 / 60);
    const t0 = BOSS.temps();
    sousMoitie(m.id);
    BOSS.avancer(2, 1 / 60);
    const s1 = mbEtat('irradie');
    const coup = BOSS.zombies.toucher(m.id, 1, 'corps', { joueur: 'j1' });
    const tI = attendre(() => LOG.some((x) => x.type === 'infection' && x.d.etat === 'debut' && x.temps >= t0), 3);
    BOSS.avancer(2, 1 / 60);
    const e = BOSS.combat.etat(), salle = BOSS.zombies.liste().filter((v) => !v.miniBoss && v.lieu === 'salle' && v.vivant !== false && (v.type === 'zombie' || v.type === 'chien'));
    const inf = e.infection || { ids: [] }, irr = BOSS.zombies.irradies().map((x) => x.id);
    const tous = salle.every((v) => inf.ids.indexOf(v.id) >= 0 && irr.indexOf(v.id) >= 0);
    const debut = LOG.find((x) => x.type === 'infection' && x.d.etat === 'debut' && x.temps >= t0);
    // un zombie qui apparaît maintenant est irradié aussitôt
    const g = BOSS.monde.grilles.salle.plusProcheLibre(6, -3, 3), nid = BOSS.jeu.faireApparaitreZombie({ position: { x: g.x, y: 0, z: g.z }, lieu: 'salle', type: 'zombie', effet: 'normal' });
    const tN = attendre(() => BOSS.zombies.irradies().some((x) => x.id === nid), 1);
    return { rage: LOG.some((x) => x.type === 'miniBoss' && x.d.etat === 'rage' && x.d.capacite === 'infection' && x.temps >= t0), vulnerable: !(s1 && s1.invulnerable), coup: coup && !coup.immunise,
      tI, debut: debut && debut.d.nombre, salle: salle.length, crees: ids.length, tous, irr: irr.length, aura: BOSS.zombies.irradies()[0], nouveau: tN,
      toast: document.querySelector('.b7h-toasts').textContent };
  });
  ok(r2.rage && r2.vulnerable && r2.coup && r2.tI != null && Math.abs(r2.tI - 1.2) < 0.3, 'Irradié à 50 % : cri d’infection (il reste vulnérable), infection 1,2 s plus tard', { tI: r2.tI, vulnerable: r2.vulnerable });
  ok(r2.tous && r2.salle >= 2 && r2.debut >= r2.salle && r2.aura && r2.aura.rayon === 1.5 && r2.aura.degatsParSeconde === 0.04,
    'tous les zombies et chiens de la salle sont irradiés (aura 1,5 m, 4 %/s)', { salle: r2.salle, debut: r2.debut, irradies: r2.irr, aura: r2.aura });
  ok(r2.nouveau != null && r2.nouveau <= 0.5, 'un zombie qui apparaît pendant l’infection est irradié aussitôt', { t: r2.nouveau });
  ok(/contamine/.test(r2.toast), 'message de l’infection', r2.toast.slice(0, 140));
  const r2b = await p.evaluate(() => {
    // aura d'un zombie irradié : le joueur à 1 m de lui
    BOSS.invincible(false); BOSS.joueur.soigner();
    const irr = BOSS.zombies.irradies().map((x) => x.id), z = BOSS.zombies.liste().find((v) => irr.indexOf(v.id) >= 0 && v.type === 'zombie');
    const t0 = BOSS.temps();
    for (let i = 0; i < 90; i++) {
      BOSS.joueur.soigner();
      if (i % 10 === 0) { const zz = BOSS.zombies.obtenir(z.id); if (zz && zz.actif) BOSS.joueur.teleporter({ x: zz.position.x + 1.0, y: 0, z: zz.position.z }, -Math.PI / 2, 'salle'); }
      BOSS.avancer(1, 1 / 60);
    }
    BOSS.invincible(true); BOSS.joueur.soigner();
    const aura = DEG.filter((d) => d.src === 'aura' && d.zid === z.id && d.temps >= t0);
    return { tics: aura.length, total: +aura.reduce((s, d) => s + d.f, 0).toFixed(3), boucles: nommes(/^irr:/).length };
  });
  ok(r2b.tics >= 4 && r2b.total > 0.03 && r2b.total < 0.09 && r2b.boucles >= 1, 'un zombie irradié blesse à 1 m (≈ 4 %/s), grésillement sur les irradiés proches', r2b);
  {
    const q = await p.evaluate(() => { const j = BOSS.joueur.position; return { x: j.x, z: j.z }; });
    await vue('v15-22-zombies-irradies', { x: q.x + 4.5, y: 2.6, z: q.z - 3.5 }, { x: q.x - 2, y: 0.9, z: q.z + 2 }, 'salle');
  }
  const r2c = await p.evaluate(() => {
    const m = mbVivant(), t0 = BOSS.temps();
    BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(60 * 1.0, 1 / 60);
    const salle = BOSS.zombies.liste().filter((v) => !v.miniBoss && v.lieu === 'salle' && v.vivant !== false);
    return { fin: LOG.some((x) => x.type === 'infection' && x.d.etat === 'fin' && x.temps >= t0), infection: BOSS.combat.etat().infection, irr: BOSS.zombies.irradies().length,
      eteints: salle.every((v) => { const z = BOSS.zombies.obtenir(v.id); return z && !z.irrActif; }), boucles: nommes(/^irr:/).length,
      bonus: LOG.some((x) => x.type === 'bonus' && x.d.source === 'miniBoss' && x.d.miniBoss === 'irradie' && x.temps >= t0), protege: BOSS.combat.etat().boss.protege };
  });
  ok(r2c.fin && r2c.infection === null && r2c.irr === 0 && r2c.eteints && r2c.boucles === 0 && !r2c.protege, 'Irradié abattu : plus aucun zombie irradié (lueurs et sons compris), protection levée', r2c);
  ok(r2c.bonus, 'Munitions max à la mort de l’Irradié', r2c.bonus);

  // ── 3. Le Démembré géant : cuve géante, taille ×2, fléau de 6 m ; à 50 % arrachement, flot de petits, charge ──
  const r3 = await p.evaluate(() => {
    BOSS.zombies.tuerTous && BOSS.zombies.tuerTous('cendres');
    BOSS.avancer(60, 1 / 60);
    const cuves = BOSS.monde.tubes.map((t) => t.id + ':' + t.rayon + ':' + t.hauteur);
    const t0 = BOSS.temps();
    seuilSuivant();
    attendre(() => !!mbVivant(), 18);
    BOSS.avancer(60 * 3.0, 1 / 60);
    const v = mbVivant(), z = BOSS.zombies.obtenir(v.id);
    const box = new BOSS.THREE.Box3().setFromObject(z.groupe), taille = box.getSize(new BOSS.THREE.Vector3());
    // fléau à 4,5 m devant lui
    const tF = BOSS.temps();
    attendre(() => DEG.some((d) => d.src === 'fleau' && d.temps >= tF), 12, (i) => {
      const m = BOSS.zombies.obtenir(v.id); if (!m || i % 20) return;
      BOSS.joueur.teleporter({ x: m.position.x + Math.sin(m.lacet) * 4.5, y: 0, z: m.position.z + Math.cos(m.lacet) * 4.5 }, m.lacet + Math.PI, 'salle');
    });
    const fl = DEG.find((d) => d.src === 'fleau' && d.temps >= tF);
    const zf = BOSS.zombies.obtenir(v.id), dj = fl ? Math.hypot(BOSS.joueur.position.x - zf.position.x, BOSS.joueur.position.z - zf.position.z) : null;
    return { cuves, type: v.type, echelle: +(z.scale || 0).toFixed(2), hauteur: +taille.y.toFixed(2), largeur: +Math.max(taille.x, taille.z).toFixed(2), fleau: fl && +fl.f.toFixed(2), distance: dj && +dj.toFixed(2),
      tubes: LOG.filter((x) => x.type === 'tube' && x.temps >= t0).map((x) => x.d.id + ':' + x.d.etat) };
  });
  ok(r3.type === 'demembre' && r3.tubes.join() === 'tube2:siphon,tube2:fissure,tube2:eclate' && /^tube2:1\.3:4\.4$/.test(r3.cuves[2]), '25 % : Le Démembré sort de la cuve géante (rayon 1,3 m, 4,4 m de haut)', { cuves: r3.cuves, tubes: r3.tubes });
  ok(r3.hauteur > 3.2 && r3.fleau === 0.3 && r3.distance > 3.0, 'géant (≈ 2× en hauteur et en largeur) : son fléau touche à plus de 3 m (portée 6 m)', r3);
  {
    await p.evaluate(() => {
      const m = mbVivant(); if (!m) return;
      const q = { x: m.position.x + Math.sin(m.lacet) * 7.5, z: m.position.z + Math.cos(m.lacet) * 7.5 }, g = BOSS.monde.grilles.salle.plusProcheLibre(q.x, q.z, 4) || q;
      BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(m.position.x - g.x, m.position.z - g.z), 'salle');
      const g2 = BOSS.monde.grilles.salle.plusProcheLibre(m.position.x + 2.5, m.position.z + 1.0, 3);
      if (g2) BOSS.jeu.faireApparaitreZombie({ position: { x: g2.x, y: 0, z: g2.z }, lieu: 'salle', type: 'zombie', effet: 'normal' });   // pour l'échelle
      BOSS.avancer(20, 1 / 60);
    });
    await vueJoueur('v15-23-demembre-geant');
  }
  const r3b = await p.evaluate(() => {
    const m = mbVivant(), t0 = BOSS.temps();
    placer(ARE.origine.x + 6, ARE.origine.z - 9);
    sousMoitie(m.id);
    BOSS.avancer(2, 1 / 60);
    const s1 = mbEtat('demembre'), coup = BOSS.zombies.toucher(m.id, 0.1 * m.pvMax, 'corps', { joueur: 'j1' });
    attendre(() => LOG.some((x) => x.type === 'bras' && x.d.etat === 'pose' && x.temps >= t0), 4);
    const ev = LOG.filter((x) => x.type === 'bras' && x.temps >= t0).map((x) => ({ e: x.d.etat, t: +(x.temps - t0).toFixed(2), p: x.d.position && { x: +x.d.position.x.toFixed(1), z: +x.d.position.z.toFixed(1) } }));
    const bras = BOSS.zombies.bras();
    return { rage: LOG.some((x) => x.type === 'miniBoss' && x.d.etat === 'rage' && x.d.capacite === 'arrachement' && x.temps >= t0), invul: !!(s1 && s1.invulnerable), immunise: !!(coup && coup.immunise),
      ev, bras: bras.map((x) => x.etat + ':' + x.position.x.toFixed(1) + ',' + x.position.z.toFixed(1)), toast: document.querySelector('.b7h-toasts').textContent,
      capa: CAPA.filter((c) => c.type === 'demembre' && c.quoi === 'arrachement' && c.temps >= t0).map((c) => c.etat) };
  });
  const pose = r3b.ev.find((x) => x.e === 'pose');
  ok(r3b.rage && r3b.invul && r3b.immunise && /arrache le bras/.test(r3b.toast), 'Démembré à 50 % : rage « arrachement », invulnérable, message', { rage: r3b.rage, invul: r3b.invul, immunise: r3b.immunise, toast: r3b.toast.slice(0, 100) });
  ok(r3b.ev.map((x) => x.e).join() === 'arrache,lance,pose' && pose && Math.abs(pose.t - 2.4) < 0.1 && Math.hypot(pose.p.x - SALLE.centre.x, pose.p.z - SALLE.centre.z) < 0.2 && r3b.bras.length === 1 && /^pose:/.test(r3b.bras[0]),
    'il arrache son bras et le lance au centre de la salle (posé à 2,4 s)', { ev: r3b.ev, bras: r3b.bras, capa: r3b.capa });
  {
    await p.evaluate(() => { BOSS.avancer(60 * 3.6, 1 / 60); });
    await vue('v15-24-bras-petits', { x: SALLE.centre.x + 5.5, y: 3.4, z: SALLE.centre.z - 5.5 }, { x: SALLE.centre.x, y: 0.4, z: SALLE.centre.z }, 'salle');
  }
  const r3c = await p.evaluate(() => {
    // flot de petits Démembrés : un toutes les 2,5 s, au plus 6 en solo (le joueur, invulnérable, ne les tue pas)
    const t0 = BOSS.temps();
    let max = 0;
    attendre(() => false, 16, (i) => { if (i % 30 === 0) { placer(ARE.origine.x + 9, ARE.origine.z - 7); } max = Math.max(max, BOSS.combat.etat().petits.length); });
    const apps = LOG.filter((x) => x.type === 'petitDemembre' && x.d.etat === 'apparition').map((x) => x.temps);
    const ecarts = apps.slice(1).map((t, k) => +(t - apps[k]).toFixed(2));
    const petits = BOSS.zombies.liste().filter((v) => v.type === 'demembre_petit' && v.vivant !== false);
    const geant = BOSS.zombies.obtenir(mbVivant().id), petit = petits.length ? BOSS.zombies.obtenir(petits[0].id) : null;
    return { n: BOSS.combat.etat().petits.length, max, apparitions: apps.length, ecarts: ecarts.slice(0, 6), vivants: petits.length, ratio: petit ? +(geant.scale / petit.scale).toFixed(2) : null,
      miniBoss: petits.some((v) => v.miniBoss), pv: petits[0] && petits[0].pvMax };
  });
  ok(r3c.max === 6 && r3c.n === 6 && r3c.vivants === 6 && r3c.ecarts.length >= 4 && r3c.ecarts.every((x) => Math.abs(x - 2.5) < 0.05) && !r3c.miniBoss && r3c.pv === 250,
    'flot de petits Démembrés : un toutes les 2,5 s depuis le bras, plafonné à 6 en solo (250 PV)', r3c);
  ok(r3c.ratio != null && r3c.ratio > 1.8 && r3c.ratio < 2.2, 'le géant est 2× plus grand que les petits Démembrés', { ratio: r3c.ratio });
  const r3d = await p.evaluate(() => {
    // charge du Démembré sans bras : le joueur entre lui et le mur sud
    BOSS.invincible(false); BOSS.joueur.soigner();
    const t0 = BOSS.temps(), id = mbVivant().id;
    let prep = null, avant = null, apres = null, proj = 0;
    attendre(() => DEG.some((d) => d.src === 'charge' && d.temps >= t0) && BOSS.temps() - (DEG.find((d) => d.src === 'charge' && d.temps >= t0).temps) > 0.6, 30, (i) => {
      BOSS.joueur.soigner();
      const ch = DEG.find((d) => d.src === 'charge' && d.temps >= t0);
      if (ch) { proj = Math.max(proj, BOSS.joueur.projectionRestante ? BOSS.joueur.projectionRestante() : 0); if (!apres && BOSS.temps() - ch.temps > 0.55) apres = { x: BOSS.joueur.position.x, z: BOSS.joueur.position.z }; return; }
      const c = CAPA.filter((x) => x.type === 'demembre' && x.quoi === 'charge' && x.temps >= t0);
      if (c.length) { if (!prep) prep = c[0].etat; avant = { x: BOSS.joueur.position.x, z: BOSS.joueur.position.z }; return; }
      if (i % 40 === 0) {
        const m = BOSS.zombies.obtenir(id);
        const g = BOSS.monde.grilles.salle.plusProcheLibre(m.position.x * 0.3, -(ARE.apotheme - 4.5), 3);   // entre lui et le mur sud
        if (g && Math.hypot(g.x - m.position.x, g.z - m.position.z) > 5) BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(m.position.x - g.x, m.position.z - g.z), 'salle');
      }
    });
    BOSS.avancer(60, 1 / 60);
    const etourdi = BOSS.joueur.etourdiRestant();
    BOSS.invincible(true); BOSS.joueur.soigner();
    const ch = DEG.filter((d) => d.src === 'charge' && d.temps >= t0), mur = DEG.filter((d) => d.src === 'impactMur' && d.temps >= t0);
    return { prep, charge: ch.map((d) => +d.f.toFixed(2)), projection: ch.some((d) => d.projection), proj: +proj.toFixed(2),
      deplace: avant && apres ? +Math.hypot(apres.x - avant.x, apres.z - avant.z).toFixed(2) : null, mur: mur.map((d) => +d.f.toFixed(2)),
      capa: CAPA.filter((x) => (x.quoi === 'charge' || x.quoi === 'projection') && x.temps >= t0).map((x) => x.type + ':' + x.quoi + ':' + (x.etat || '')).slice(0, 8),
      sons: nommes(/^charge:/).length };
  });
  ok(r3d.prep === 'preparation' && r3d.charge[0] === 0.35 && r3d.projection && (r3d.proj > 0 || (r3d.deplace != null && r3d.deplace > 2)),
    'charge du Démembré sans bras : annoncée, 35 % et le joueur est projeté', r3d);
  ok(r3d.mur.length === 0 || r3d.mur[0] === 0.1, 'projeté contre un mur : 10 % de plus (si le mur est sur la trajectoire)', { impactMur: r3d.mur, capa: r3d.capa });
  const r3e = await p.evaluate(() => {
    const m = mbVivant(), t0 = BOSS.temps(), n = BOSS.combat.etat().petits.length;
    BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(60 * 2.5, 1 / 60);
    const eff = LOG.filter((x) => x.type === 'petitDemembre' && x.d.etat === 'effondrement' && x.temps >= t0).length;
    const r = { n, eff, petits: BOSS.combat.etat().petits.length, vivants: BOSS.zombies.liste().filter((v) => v.type === 'demembre_petit' && v.vivant !== false && v.etat !== 'effondrement').length,
      fletri: LOG.some((x) => x.type === 'bras' && x.d.etat === 'fletri' && x.temps >= t0), bonus: LOG.some((x) => x.type === 'bonus' && x.d.source === 'miniBoss' && x.d.miniBoss === 'demembre' && x.temps >= t0),
      bonusTotal: LOG.filter((x) => x.type === 'bonus' && x.d.source === 'miniBoss').length, protege: BOSS.combat.etat().boss.protege };
    BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
    attendre(() => BOSS.combat.etat().etat !== 'phase2', 8);
    r.etat = BOSS.combat.etat().etat;
    return r;
  });
  ok(r3e.fletri && r3e.eff === r3e.n && r3e.n === 6 && r3e.petits === 0 && r3e.vivants === 0 && !r3e.protege, 'Démembré abattu : le bras se flétrit, tous les petits s’effondrent', r3e);
  ok(r3e.bonus && r3e.bonusTotal === 3 && r3e.etat === 'transition23', 'Munitions max à chacun des 3 mini-boss ; la phase 2 se termine normalement', { bonus: r3e.bonusTotal, etat: r3e.etat });

  // ── 4. phase 5, palier 2 : intangibilité (plus d'illusions) ──
  const r4 = await p.evaluate(() => {
    BOSS.lancerCombat('phase5'); BOSS.avancer(60 * 3, 1 / 60);
    BOSS.combat.forcer('jauge', 0.52); BOSS.avancer(3, 1 / 60);
    BOSS.invincible(false); BOSS.joueur.soigner();
    const e = BOSS.combat.etat();
    // le joueur à plus de 10 m, hors de sa vue : il s'évanouit, traverse les murs, resurgit et frappe
    const cacher = () => {
      const bp = BOSS.combat.etat().boss.position;
      for (let r = 12; r <= 20; r += 1) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, g = BOSS.monde.grilles.bunker.plusProcheLibre(bp.x + Math.sin(a) * r, bp.z + Math.cos(a) * r, 1);
        if (!g || Math.hypot(g.x - bp.x, g.z - bp.z) < 11.5 || BOSS.monde.visible(bp, { x: g.x, y: 0, z: g.z }, 'bunker')) continue;
        BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, 0, 'bunker'); return g;
      }
      return null;
    };
    const t0 = BOSS.temps();
    let cache = null;
    const tD = attendre(() => LOG.some((x) => x.type === 'intangible' && x.d.etat === 'debut' && x.temps >= t0), 15, (i) => { BOSS.joueur.soigner(); if (i % 20 === 0) cache = cacher() || cache; });
    BOSS.avancer(3, 1 / 60);
    const e1 = BOSS.combat.etat(), b1 = e1.boss;
    const tir = BOSS.combat.toucherBoss({ joueur: 'j1', degats: 100, zone: 'corps' });
    const pendant = { intangible: b1.intangible, visible: b1.visible, locomotion: b1.locomotion, modele: BOSS.modele.object.visible, tir: tir.raison, gelee: e1.jauge && e1.jauge.gelee,
      boucle: nommes(/^intangible$/).length, aide: document.querySelector('.b7h-jauge .palier').innerHTML,
      evanouissement: LOG.some((x) => x.type === 'action' && x.d.id === 'evanouissement') };
    return { palier: e.boss.palier, illusions: (e.illusions || []).length, aide: document.querySelector('.b7h-jauge .palier').textContent, cache: !!cache, tD, pendant };
  });
  ok(r4.palier === 2 && r4.illusions === 0 && /Intangible/.test(r4.aide), 'palier 2 (50 %) : plus d’illusions, aide « Intangible »', { palier: r4.palier, illusions: r4.illusions, aide: r4.aide });
  ok(r4.cache && r4.tD != null && r4.pendant.evanouissement && r4.pendant.intangible && !r4.pendant.visible && r4.pendant.locomotion === 'intangible' && !r4.pendant.modele,
    'joueur loin et caché : il s’évanouit puis devient invisible (modèle masqué)', { tD: r4.tD, pendant: r4.pendant });
  ok(r4.pendant.tir === 'absent' && r4.pendant.gelee && r4.pendant.boucle === 1 && /écoutez-le venir/.test(r4.pendant.aide), 'invisible : intangible aux balles, jauge gelée, présence sonore, interface « écoutez-le venir »', r4.pendant);
  {
    const q = await p.evaluate(() => { BOSS.avancer(20, 1 / 60); const bp = BOSS.combat.etat().boss.position, j = BOSS.joueur.position; return { b: bp, j: { x: j.x, z: j.z } }; });
    const dx = q.j.x - q.b.x, dz = q.j.z - q.b.z, l = Math.hypot(dx, dz) || 1;
    await vue('v15-25-intangible', { x: q.b.x - dz / l * 4.5, y: 2.0, z: q.b.z + dx / l * 4.5 }, { x: q.b.x, y: 1.3, z: q.b.z }, 'bunker');
  }
  const r4b = await p.evaluate(() => {
    const t0 = BOSS.temps() - 2;
    const tF = attendre(() => LOG.some((x) => x.type === 'intangible' && x.d.etat === 'fin' && x.temps >= t0), 14, () => BOSS.joueur.soigner());
    const fin = LOG.find((x) => x.type === 'intangible' && x.d.etat === 'fin' && x.temps >= t0);
    const j = BOSS.joueur.position, dist = fin ? Math.hypot(fin.d.position.x - j.x, fin.d.position.z - j.z) : null;
    const tA = BOSS.temps();
    let dPrep = null, visible = null, modele = null;
    attendre(() => LOG.some((x) => x.type === 'frappe' && x.temps >= tA), 3, () => {
      BOSS.joueur.soigner();
      const b = BOSS.combat.etat().boss, a = b.action;
      if (a && a.id === 'frappe' && a.etape === 'preparation' && dPrep == null) { dPrep = Math.hypot(b.position.x - BOSS.joueur.position.x, b.position.z - BOSS.joueur.position.z); visible = b.visible; modele = BOSS.modele.object.visible; }
    });
    const fr = LOG.find((x) => x.type === 'frappe' && x.temps >= tA);
    BOSS.joueur.soigner();
    const trav = LOG.filter((x) => x.type === 'intangible' && x.d.etat === 'traversee' && x.temps >= t0).length;
    return { tF, trav, dist: dist && +dist.toFixed(2), resurg: LOG.some((x) => x.type === 'action' && x.d.id === 'resurgissement' && x.temps >= t0), frappe: fr && { joueur: fr.d.joueur, reussie: fr.d.reussie, palier: fr.d.palier },
      dPrep: dPrep && +dPrep.toFixed(2), visible, modele };
  });
  ok(r4b.tF != null && r4b.trav >= 1 && r4b.dist != null && r4b.dist <= 6.5, 'il traverse au moins un mur et resurgit près du joueur', r4b);
  ok(r4b.resurg && r4b.visible && r4b.modele && r4b.dPrep != null && r4b.dPrep <= 2.0 && r4b.frappe && r4b.frappe.joueur === 'j1' && r4b.frappe.reussie,
    'il redevient visible (resurgissement), fond sur le joueur immobile et le frappe', r4b);
  {
    const q = await p.evaluate(() => { const bp = BOSS.combat.etat().boss.position, j = BOSS.joueur.position; BOSS.joueur.teleporter({ x: j.x, y: 0, z: j.z }, Math.atan2(bp.x - j.x, bp.z - j.z), 'bunker'); BOSS.avancer(1, 1 / 60); return true; });
    await vueJoueur('v15-26-resurgissement');
  }
  const r4c = await p.evaluate(() => {
    // personne près de lui : il recommence (recharge 6 s après le resurgissement)
    const t0 = BOSS.temps();
    const cacher = () => {
      const bp = BOSS.combat.etat().boss.position;
      for (let r = 12; r <= 20; r += 1) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, g = BOSS.monde.grilles.bunker.plusProcheLibre(bp.x + Math.sin(a) * r, bp.z + Math.cos(a) * r, 1);
        if (!g || Math.hypot(g.x - bp.x, g.z - bp.z) < 11.5) continue;
        BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, 0, 'bunker'); return g;
      }
      return null;
    };
    const tD = attendre(() => LOG.some((x) => x.type === 'intangible' && x.d.etat === 'debut' && x.temps >= t0), 28, (i) => { BOSS.joueur.soigner(); if (i % 20 === 0) cacher(); });
    BOSS.invincible(true); BOSS.joueur.soigner();
    const fin = LOG.filter((x) => x.type === 'intangible' && x.d.etat === 'fin').map((x) => x.temps), deb = LOG.filter((x) => x.type === 'intangible' && x.d.etat === 'debut').map((x) => x.temps);
    return { tD, ecart: fin.length && deb.length >= 2 ? +(deb[deb.length - 1] - fin[0]).toFixed(2) : null, sonPalier: LOG.some((x) => x.type === 'palier' && x.d.numero === 2) };
  });
  ok(r4c.tD != null && r4c.ecart != null && r4c.ecart >= 6 - 0.05, 'loin de tout joueur, il redevient invisible (pas avant 6 s de recharge ; après un coup réussi, il disparaît d’abord 10 s)', r4c);
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
