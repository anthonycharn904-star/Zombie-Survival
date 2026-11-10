// v1.3 dans le prototype assemblé (logique + mini-moteur + modèle + effets + sons + interface) :
// cuves modélisées et intactes au début de la phase 2 ; à 75 % des PV du Septième (phase 2) il est protégé et siphonne
// la 1re cuve, qui éclate et libère Le Survolté (barre de PV à son nom sous celle du boss, sons, capacités) ; le Septième
// continue d'attaquer ; mort du Survolté → protection levée ; à 50 % : 2e cuve, L'Irradié (aura, flaque) ; puis la phase 2
// se termine normalement. Réinitialisation des cuves avec allerA.     node proto/dev/test-v13-assemblage.js
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
  // vue libre (caméra de démonstration, interface DOM comprise), sans l'arme en 1re personne
  const vue = async (nom, cam, cible, lieu) => {
    await p.evaluate(([cam, cible, lieu]) => {
      const c = BOSS.camera; c.position.set(cam.x, cam.y, cam.z); c.lookAt(cible.x, cible.y, cible.z); c.updateMatrixWorld();
      BOSS.renderer.render(BOSS.monde.scenes[lieu], c); BOSS.fx.rendreEcran(BOSS.renderer);
    }, [cam, cible, lieu]);
    await p.waitForTimeout(900);                    // transitions CSS de l'interface (temps réel)
    await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 });
  };
  // vue du joueur (caméra du joueur, arme comprise)
  const vueJoueur = async (nom) => { await p.waitForTimeout(900); await p.evaluate(() => BOSS.rendre()); await p.screenshot({ path: path.join(SORTIE, nom + '.png'), timeout: 180000 }); };

  // ── 0. versions, sons, cuves au repos ──
  const r0 = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    window.LOG = [];
    BOSS.combat.on('*', (t, d) => { if (['tube', 'miniBoss', 'protection', 'action', 'etat', 'immunise', 'degats'].indexOf(t) >= 0) LOG.push({ type: t, d: JSON.parse(JSON.stringify(d || {})), temps: BOSS.temps() }); });
    while (BOSS.bots.liste().length) BOSS.retirerBot();
    BOSS.invincible(true);
    if (BOSS.audio) await BOSS.audio.precharger();
    window.CAPA = [];
    if (BOSS.audio) { const f = BOSS.audio.sonMiniBoss; BOSS.audio.sonMiniBoss = (type, quoi, pos, opt) => { CAPA.push({ type, quoi, etat: opt && opt.etat, temps: BOSS.temps() }); return f(type, quoi, pos, opt); }; }
    window.DEG = [];
    BOSS.zombies.brancherDegats((z, id, f, src) => DEG.push({ type: z.type, id, f, src, temps: BOSS.temps() }));
    const sons = ['tube_siphon', 'tube_fissure', 'tube_eclatement', 'miniboss_apparition', 'survolte_bourdon', 'survolte_charge', 'survolte_decharge', 'survolte_spasme',
      'survolte_cri', 'survolte_mort', 'irradie_geiger', 'irradie_rale', 'irradie_cri', 'irradie_mort', 'flaque_toxique'];
    const charges = BOSS.audio ? sons.filter((k) => { const h = BOSS.audio.jouer(k, { plein: true, volume: 0 }); if (h) h.stop(0); return !!h; }) : [];
    BOSS.lancerCombat('phase2');
    BOSS.avancer(60 * 2, 1 / 60);
    const e = BOSS.etat();
    return { versions: { logique: BossB7Logique.version, modele: BossB7Modele.version, audio: BOSS.audio && BOSS.audio.version, hud: BOSS.hud.version, fx: BossB7Fx.version },
      siphonModele: BossB7Modele.actions.indexOf('siphon') >= 0, sons: charges.length,
      tubes: e.tubes.map((t) => t.id + ':' + t.etat + ':' + t.miniBoss), monde: BOSS.monde.etatTubes().map((t) => t.etat + ':' + t.niveau),
      protege: e.boss.protege, mb: e.miniBoss.length, seuils: document.querySelectorAll('.b7h-seuil').length, barres: document.querySelectorAll('.b7h-mb').length };
  });
  const v13 = (v) => /^1\.([3-9]|\d\d)\./.test(v || '');   // v1.3 ou plus récent (la v1.4 garde tout le déroulé de la v1.3)
  ok(v13(r0.versions.logique) && v13(r0.versions.audio) && v13(r0.versions.hud) && /^2\.([1-9]|\d\d)\./.test(r0.versions.modele) && v13(r0.versions.fx) && r0.siphonModele, 'versions v1.3 ou plus (logique, audio, interface, effets ; modèle 2.1+ avec l’action siphon)', r0.versions);
  ok(r0.sons === 15, 'les 15 sons de la v1.3 sont chargés et jouables', r0.sons);
  ok(r0.tubes.slice(0, 2).join() === 'tube0:intact:survolte,tube1:intact:irradie' && r0.monde.every((x) => /^intact/.test(x)) && !r0.protege && r0.mb === 0, 'début de phase 2 : cuves intactes (Survolté, Irradié en tête), pas de protection', r0);
  ok(r0.seuils === r0.tubes.length && r0.barres === 0, 'interface : un repère par seuil de mini-boss sur le segment de la phase 2, aucune barre de mini-boss', r0);
  {
    const q = await p.evaluate(() => { const t = BOSS_B7_ARENE.salle.tubes[0]; return { x: t.x, z: t.z, l: t.lacet }; });
    await vue('v13-10-cuves-intactes', { x: q.x + Math.sin(q.l + 0.2) * 5.2, y: 2.2, z: q.z + Math.cos(q.l + 0.2) * 5.2 }, { x: q.x, y: 1.6, z: q.z }, 'salle');
  }

  // ── 1. 75 % : PV bloqués au seuil, protection, siphon de la 1re cuve, Le Survolté libéré ──
  const r1 = await p.evaluate(() => {
    const max = BOSS.etat().barre.max, t0 = BOSS.temps();
    const coup = BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });     // un coup énorme ne saute pas le seuil
    const pvApres = BOSS.combat.etat().barre.valeur;     // instantané immédiat (BOSS.etat() = celui de la dernière image)
    BOSS.avancer(1, 1 / 60);
    const protegeDe = BOSS.etat().boss.protege;
    const refus = BOSS.combat.toucherBoss({ joueur: 'j1', degats: 500, zone: 'tete' });
    let libere = null, vuSiphonTube = false, vuSiphonModele = false, captureSiphon = false;
    for (let i = 0; i < 60 * 14 && !libere; i++) {
      BOSS.avancer(1, 1 / 60);
      const a = BOSS.etat().boss.action;
      if (a && a.id === 'siphon' && a.etape === 'aspiration' && !captureSiphon && a.progression > 0.45) { captureSiphon = true; window.SIPHON_T = BOSS.temps(); break; }
      if (BOSS.audio && BOSS.audio.stats().nommes.indexOf('tube:tube0') >= 0) vuSiphonTube = true;
      libere = LOG.find((x) => x.type === 'miniBoss' && x.d.etat === 'libere' && x.temps >= t0);
    }
    return { max, coup, pvApres: +(pvApres / max).toFixed(4), protegeDe, refus, statut: document.querySelector('.b7h-etatboss').textContent,
      objectif: document.querySelector('.b7h-objectif span').textContent, captureSiphon, sonTube: vuSiphonTube };
  });
  ok(r1.coup.applique && r1.pvApres === 0.75 && r1.protegeDe, 'coup énorme : PV bloqués à 75 %, le Septième devient protégé', r1);
  ok(!r1.refus.applique && r1.refus.raison === 'invulnerable', 'protégé : toucherBoss refusé (« invulnerable »)', r1.refus);
  ok(/Protégé/.test(r1.statut) && /siphonne/.test(r1.objectif), 'interface : « Protégé » et objectif du siphon', { statut: r1.statut, objectif: r1.objectif });
  ok(r1.captureSiphon, 'action siphon : aspiration en cours', r1.captureSiphon);
  {
    // caméra dans la salle, derrière le boss et décalée sur le côté : le boss, le flot et la cuve dans le même cadre
    const q = await p.evaluate(() => { const t = BOSS_B7_ARENE.salle.tubes[0], bp = BOSS.etat().boss.position; return { t: { x: t.x, z: t.z }, b: bp }; });
    const dx = q.t.x - q.b.x, dz = q.t.z - q.b.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    let cx = q.b.x - ux * 4.2 - uz * 3.2, cz = q.b.z - uz * 4.2 + ux * 3.2;
    const rc = Math.hypot(cx, cz); if (rc > 10.5) { cx *= 10.5 / rc; cz *= 10.5 / rc; }
    await vue('v13-11-siphon', { x: cx, y: 2.8, z: cz }, { x: q.b.x + dx * 0.55, y: 1.7, z: q.b.z + dz * 0.55 }, 'salle');
  }
  const r1b = await p.evaluate(() => {
    const t0 = window.SIPHON_T - 3.5;
    let libere = null, sonTube = false;
    for (let i = 0; i < 60 * 10 && !libere; i++) {
      BOSS.avancer(1, 1 / 60);
      if (BOSS.audio && BOSS.audio.stats().nommes.indexOf('tube:tube0') >= 0) sonTube = true;
      libere = LOG.find((x) => x.type === 'miniBoss' && x.d.etat === 'libere');
    }
    BOSS.avancer(2, 1 / 60);
    const ev = LOG.filter((x) => x.temps >= t0);
    const z = BOSS.zombies.liste().find((v) => v.miniBoss);
    const e = BOSS.etat();
    return {
      etapes: ev.filter((x) => x.type === 'action' && x.d.id === 'siphon').map((x) => x.d.etape),
      tubes: ev.filter((x) => x.type === 'tube').map((x) => x.d.id + ':' + x.d.etat),
      libere: libere && libere.d, protection: ev.filter((x) => x.type === 'protection').map((x) => x.d.actif + ':' + x.d.miniBoss),
      zombie: z && { id: z.id, type: z.type, nom: z.nom, pv: z.pv, pvMax: z.pvMax },
      etatTubes: e.tubes.map((t) => t.etat), monde: BOSS.monde.etatTubes().map((t) => t.etat), mb: e.miniBoss.map((m) => m.type + ':' + m.etat),
      sonTube, nommes: BOSS.audio ? BOSS.audio.stats().nommes : [], attendu: BOSS_B7_CONFIG.miniBoss.survolte.pv
    };
  });
  ok(r1b.etapes.join('>') === 'aspiration>eclatement>recuperation' || r1b.etapes.join('>') === 'approche>aspiration>eclatement>recuperation', 'siphon : approche › aspiration › éclatement › récupération', r1b.etapes);
  ok(r1b.tubes.join() === 'tube0:siphon,tube0:fissure,tube0:eclate' && r1b.etatTubes.slice(0, 2).join() === 'eclate,intact' && r1b.monde.slice(0, 2).join() === 'eclate,intact' && r1b.etatTubes.slice(1).every((x) => x === 'intact'), 'cuve 1 : siphon › fissure › éclatée (logique et monde), les autres intactes', r1b);
  ok(r1b.libere && r1b.libere.type === 'survolte' && r1b.libere.nom === 'Le Survolté' && r1b.zombie && r1b.zombie.type === 'survolte' && r1b.zombie.pvMax === r1b.attendu && r1b.libere.pvMax === r1b.attendu, '1er mini-boss : Le Survolté libéré devant sa cuve (PV de la config, solo)', { libere: r1b.libere, zombie: r1b.zombie });
  ok(r1b.protection.join() === 'true:survolte', 'protection { actif: true, miniBoss: survolte }', r1b.protection);
  ok(r1b.sonTube && r1b.nommes.some((n) => /^mb:.*:bourdon$/.test(n)), 'sons : aspiration de la cuve, bourdon électrique sur le Survolté', r1b.nommes);

  // ── 2. barre du Survolté, le Septième continue d'attaquer, capacités du Survolté ──
  const r2 = await p.evaluate(() => {
    const mb = () => BOSS.zombies.liste().find((v) => v.miniBoss);
    const lig = () => Array.from(document.querySelectorAll('.b7h-mb')).map((e) => ({ nom: e.querySelector('.n').textContent, w: e.querySelector('.b i').style.width, c: e.style.getPropertyValue('--c'), mort: e.classList.contains('mort') }));
    const avant = lig();
    BOSS.avancer(45, 1 / 60);                       // il sort de la cuve (intouchable 0,5 s)
    const z = mb();
    BOSS.zombies.toucher(z.id, z.pvMax * 0.4, 'corps', { joueur: 'j1' });
    BOSS.avancer(2, 1 / 60);
    const apres = lig();
    const t0 = BOSS.temps();
    BOSS.invincible(false);
    let flou = 0;
    for (let i = 0; i < 60 * 22; i++) {
      BOSS.joueur.soigner();
      BOSS.avancer(1, 1 / 60);
      flou = Math.max(flou, BOSS.joueur.flouRestant ? BOSS.joueur.flouRestant() : 0);
    }
    BOSS.invincible(true);
    const attaques = LOG.filter((x) => x.type === 'action' && x.temps >= t0 && ['invocation', 'trait', 'absorption', 'pique', 'transformation_ailes'].indexOf(x.d.id) >= 0).map((x) => x.d.id + '/' + x.d.etape);
    const e = BOSS.etat();
    return { avant, apres, attaques: attaques.slice(0, 12), nAttaques: attaques.length, protege: e.boss.protege, pv: +(e.barre.valeur / e.barre.max).toFixed(4),
      capa: CAPA.filter((c) => c.temps >= t0 && c.type === 'survolte').map((c) => c.quoi), deg: DEG.filter((d) => d.temps >= t0 && d.type === 'survolte').map((d) => d.src), flou: +flou.toFixed(2),
      statut: document.querySelector('.b7h-etatboss').textContent, objectif: document.querySelector('.b7h-objectif span').textContent, vivant: !!mb() };
  });
  ok(r2.avant.length === 1 && r2.avant[0].nom === 'Le Survolté' && parseFloat(r2.avant[0].w) === 100 && /38d9ff/i.test(r2.avant[0].c), 'barre « Le Survolté » sous celle du boss, pleine, à sa couleur', r2.avant);
  ok(r2.apres.length === 1 && Math.abs(parseFloat(r2.apres[0].w) - 60) < 1.5, 'barre du Survolté : 60 % après 40 % de dégâts', r2.apres);
  ok(/Protégé/.test(r2.statut) && /Survolt/.test(r2.statut) && /Abattez Le Survolté/.test(r2.objectif), 'interface : « Protégé : abattez Le Survolté » et objectif', { statut: r2.statut, objectif: r2.objectif });
  ok(r2.nAttaques >= 2 && r2.protege && r2.pv === 0.75, 'le Septième continue d’attaquer pendant que le Survolté vit (PV figés à 75 %)', { attaques: r2.attaques, pv: r2.pv });
  ok(r2.capa.indexOf('charge') >= 0 && r2.capa.indexOf('decharge') >= 0 && r2.capa.indexOf('spasme') >= 0, 'Survolté : charge, décharge, spasmes signalés (sons)', r2.capa.slice(0, 16));
  ok(r2.deg.indexOf('decharge') >= 0 && r2.flou > 0, 'Survolté : une décharge touche le joueur et lui brouille la vue', { deg: r2.deg.slice(0, 8), flou: r2.flou });
  {
    const q = await p.evaluate(() => {
      BOSS.avancer(70, 1 / 60);                     // la vue brouillée par la dernière décharge se dissipe (joueur invincible : plus de flou)
      const z = BOSS.zombies.liste().find((v) => v.miniBoss), j = BOSS.joueur.position;
      // le joueur à 7 m du Survolté, face à lui (vue du joueur, interface comprise)
      const dx = j.x - z.position.x, dz = j.z - z.position.z, l = Math.hypot(dx, dz) || 1;
      const q = { x: z.position.x + dx / l * 7, z: z.position.z + dz / l * 7 }, g = BOSS.monde.grilles.salle.plusProcheLibre(q.x, q.z, 4) || q;
      BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(z.position.x - g.x, z.position.z - g.z), 'salle');
      BOSS.avancer(2, 1 / 60);
      const z2 = BOSS.zombies.liste().find((v) => v.miniBoss);
      BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(z2.position.x - g.x, z2.position.z - g.z), 'salle');
      BOSS.avancer(1, 1 / 60);
      return true;
    });
    await vueJoueur('v13-12-survolte-barre');
  }

  // ── 3. mort du Survolté : protection levée, PV repartent de 75 %, barre « Abattu » puis retirée ──
  const r3 = await p.evaluate(() => {
    const z = BOSS.zombies.liste().find((v) => v.miniBoss), t0 = BOSS.temps(), pts0 = BOSS.jeu.etat.points.j1 || 0;
    BOSS.zombies.toucher(z.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(30, 1 / 60);
    const ev = LOG.filter((x) => x.temps >= t0);
    const e = BOSS.etat();
    const barreMort = Array.from(document.querySelectorAll('.b7h-mb')).map((x) => ({ mort: x.classList.contains('mort'), s: x.querySelector('.s').textContent, w: x.querySelector('.b i').style.width }));
    const coup = BOSS.combat.toucherBoss({ joueur: 'j1', degats: 300, zone: 'corps' });
    const pv = BOSS.combat.etat().barre.valeur / BOSS.combat.etat().barre.max;
    BOSS.avancer(60 * 3.5, 1 / 60);
    return { mort: ev.filter((x) => x.type === 'miniBoss').map((x) => x.d.etat + ':' + x.d.type), protection: ev.filter((x) => x.type === 'protection').map((x) => x.d.actif + ':' + x.d.miniBoss),
      protege: e.boss.protege, coup, pv: +pv.toFixed(4), barreMort, barresApres: document.querySelectorAll('.b7h-mb').length, points: (BOSS.jeu.etat.points.j1 || 0) - pts0,
      nommes: BOSS.audio ? BOSS.audio.stats().nommes : [], statut: document.querySelector('.b7h-etatboss').textContent };
  });
  ok(r3.mort.join() === 'mort:survolte' && r3.protection.join() === 'false:survolte' && !r3.protege, 'Survolté abattu : miniBoss « mort », protection levée', r3);
  ok(r3.coup.applique && r3.pv < 0.75 && r3.pv > 0.7, 'le Septième reprend des dégâts à partir de 75 %', { coup: r3.coup, pv: r3.pv });
  ok(r3.barreMort.length === 1 && r3.barreMort[0].mort && parseFloat(r3.barreMort[0].w) === 0 && r3.barresApres === 0, 'barre du Survolté : vide et « Abattu », retirée après 3 s', r3.barreMort);
  ok(r3.points >= 500, '500 points pour le mini-boss', r3.points);
  ok(!r3.nommes.some((n) => /^mb:/.test(n)) && !/Protégé/.test(r3.statut), 'sons du Survolté coupés, plus de « Protégé »', { nommes: r3.nommes, statut: r3.statut });

  // ── 4. 50 % : 2e cuve, L'Irradié (aura, flaque à sa mort) ──
  const r4 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    const coup = BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
    const pv = BOSS.combat.etat().barre.valeur / BOSS.combat.etat().barre.max;
    let libere = null;
    for (let i = 0; i < 60 * 16 && !libere; i++) { BOSS.avancer(1, 1 / 60); libere = LOG.find((x) => x.type === 'miniBoss' && x.d.etat === 'libere' && x.temps >= t0); }
    BOSS.avancer(6, 1 / 60);
    const ev = LOG.filter((x) => x.temps >= t0), e = BOSS.etat(), z = BOSS.zombies.liste().find((v) => v.miniBoss);
    return { coup: coup.applique, pv: +pv.toFixed(4), tubes: ev.filter((x) => x.type === 'tube').map((x) => x.d.id + ':' + x.d.etat), libere: libere && libere.d,
      zombie: z && { type: z.type, nom: z.nom, pvMax: z.pvMax }, etatTubes: e.tubes.map((t) => t.etat), monde: BOSS.monde.etatTubes().map((t) => t.etat),
      barres: Array.from(document.querySelectorAll('.b7h-mb')).map((x) => x.querySelector('.n').textContent + ':' + x.style.getPropertyValue('--c')),
      nommes: BOSS.audio ? BOSS.audio.stats().nommes : [] };
  });
  ok(r4.coup && r4.pv === 0.5, 'coup énorme : PV bloqués à 50 %', r4);
  ok(r4.tubes.join() === 'tube1:siphon,tube1:fissure,tube1:eclate' && r4.etatTubes.slice(0, 2).join() === 'eclate,eclate' && r4.monde.slice(0, 2).join() === 'eclate,eclate', 'cuve 2 : siphon › fissure › éclatée', r4.tubes);
  ok(r4.libere && r4.libere.type === 'irradie' && r4.zombie && r4.zombie.type === 'irradie' && r4.barres.length === 1 && /Irradi/.test(r4.barres[0]) && /8cff2e/i.test(r4.barres[0]), '2e mini-boss : L’Irradié libéré, sa barre à son nom et à sa couleur', { libere: r4.libere, barres: r4.barres });
  ok(r4.nommes.some((n) => /^mb:.*:geiger$/.test(n)) && r4.nommes.some((n) => /^mb:.*:rale$/.test(n)), 'sons : compteur Geiger et râle sur l’Irradié', r4.nommes);
  {
    await p.evaluate(() => {
      const z = BOSS.zombies.liste().find((v) => v.miniBoss), j = BOSS.joueur.position;
      const dx = j.x - z.position.x, dz = j.z - z.position.z, l = Math.hypot(dx, dz) || 1;
      const q = { x: z.position.x + dx / l * 5, z: z.position.z + dz / l * 5 }, g = BOSS.monde.grilles.salle.plusProcheLibre(q.x, q.z, 4) || q;
      BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(z.position.x - g.x, z.position.z - g.z), 'salle');
      BOSS.avancer(1, 1 / 60);
    });
    await vueJoueur('v13-13-irradie-barre');
  }
  const r5 = await p.evaluate(() => {
    BOSS.avancer(60 * 2.6, 1 / 60);                  // il finit de sortir de sa cuve (2,4 s), aura active ensuite
    const z = BOSS.zombies.liste().find((v) => v.miniBoss), t0 = BOSS.temps();
    // le joueur dans l'aura (à 1,5 m de l'Irradié)
    for (let i = 0; i < 60 * 2; i++) {
      const m = BOSS.zombies.liste().find((v) => v.miniBoss);
      if (i % 20 === 0) BOSS.joueur.teleporter({ x: m.position.x + 1.5, y: 0, z: m.position.z }, -Math.PI / 2, 'salle');
      BOSS.avancer(1, 1 / 60);
    }
    const aura = DEG.filter((d) => d.temps >= t0 && d.src === 'aura').length;
    const m = BOSS.zombies.liste().find((v) => v.miniBoss), mp = { x: m.position.x, z: m.position.z };
    const t1 = BOSS.temps();
    BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    for (let i = 0; i < 60 * 2.5; i++) { if (i % 20 === 0) BOSS.joueur.teleporter({ x: mp.x + 0.6, y: 0, z: mp.z + 0.3 }, 0, 'salle'); BOSS.avancer(1, 1 / 60); }
    const flaque = DEG.filter((d) => d.temps >= t1 && d.src === 'flaque').length;
    const capa = CAPA.filter((c) => c.temps >= t1 && c.type === 'irradie').map((c) => c.quoi + ':' + c.etat);
    const nommes = BOSS.audio ? BOSS.audio.stats().nommes : [];
    const e = BOSS.etat();
    return { aura, flaque, capa: capa.slice(0, 6), sonFlaque: nommes.indexOf('flaque') >= 0, protege: e.boss.protege,
      ev: LOG.filter((x) => x.temps >= t1 && (x.type === 'miniBoss' || x.type === 'protection')).map((x) => x.type + ':' + (x.d.etat || x.d.actif)) };
  });
  ok(r5.aura >= 3, 'Irradié : l’aura blesse le joueur à 1,5 m', r5.aura);
  ok(r5.flaque >= 2 && r5.capa.some((c) => /^flaque:debut/.test(c)) && r5.sonFlaque, 'Irradié abattu : flaque toxique (dégâts, son en boucle)', r5);
  ok(r5.ev.join() === 'miniBoss:mort,protection:false' && !r5.protege, 'Irradié abattu : protection levée', r5.ev);

  // ── 5. fin de la phase 2 normale, puis réinitialisation des cuves avec allerA ──
  const r6 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    BOSS.avancer(60 * 4, 1 / 60);
    // v1.4 : d'autres mini-boss peuvent suivre (3e cuve à 25 %) : on les libère et on les abat avant le dernier coup
    for (let k = 0; k < 4; k++) {
      BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
      if (!BOSS.combat.etat().boss.protege) break;
      for (let i = 0; i < 60 * 16 && !BOSS.zombies.liste().find((v) => v.miniBoss); i++) BOSS.avancer(1, 1 / 60);
      BOSS.avancer(45, 1 / 60);
      const mb = BOSS.zombies.liste().find((v) => v.miniBoss); if (mb) BOSS.zombies.toucher(mb.id, 1e7, 'corps', { joueur: 'j1' });
      BOSS.avancer(60, 1 / 60);
    }
    BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
    for (let i = 0; i < 60 * 8 && BOSS.etat().etat === 'phase2'; i++) BOSS.avancer(1, 1 / 60);
    const fin = BOSS.etat().etat, tubesFin = BOSS.etat().tubes.map((t) => t.etat);
    BOSS.lancerCombat('phase3'); BOSS.avancer(30, 1 / 60);
    const p3 = { tubes: BOSS.etat().tubes.map((t) => t.etat), monde: BOSS.monde.etatTubes().map((t) => t.etat), mb: BOSS.etat().miniBoss.length, protege: BOSS.etat().boss.protege };
    BOSS.lancerCombat('phase2'); BOSS.avancer(30, 1 / 60);
    const p2 = { tubes: BOSS.etat().tubes.map((t) => t.etat), monde: BOSS.monde.etatTubes().map((t) => t.etat), mb: BOSS.etat().miniBoss.length, protege: BOSS.etat().boss.protege,
      seuils: Array.from(document.querySelectorAll('.b7h-seuil')).map((s) => s.classList.contains('passe')) };
    return { fin, tubesFin, p3, p2 };
  });
  ok(r6.fin === 'transition23' && r6.tubesFin.every((x) => x === 'eclate'), 'après les mini-boss, la phase 2 se termine normalement', r6);
  ok(r6.p3.tubes.every((x) => x === 'eclate') && r6.p3.monde.every((x) => x === 'eclate') && r6.p3.mb === 0 && !r6.p3.protege, 'allerA(phase3) : cuves brisées, aucun mini-boss', r6.p3);
  ok(r6.p2.tubes.every((x) => x === 'intact') && r6.p2.monde.every((x) => x === 'intact') && r6.p2.mb === 0 && r6.p2.seuils.every((x) => x === false), 'allerA(phase2) : cuves remises à neuf, repères de seuil réarmés', r6.p2);
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
