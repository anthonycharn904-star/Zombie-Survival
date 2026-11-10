// v1.4 dans le prototype assemblé (logique + mini-moteur + modèle + effets + sons + interface) :
// 3e cuve et Le Démembré (25 %), Survolté (étourdissement, plusieurs cibles), Irradié (vitesse, aura de 6 m, boules et zones
// jusqu'à sa mort), salves de murs de la phase 3, zombies pendant la faiblesse, paliers de la phase 5 (lames bleues à 50 %,
// lames rouges à 1 %, illusions aux lames vertes dissipées par une balle, crochets).     node proto/dev/test-v14-assemblage.js
// v1.5 : les illusions sont retirées (intangibilité au palier 2 : voir test-v15-assemblage.js) ; ce test vérifie le reste de la
// v1.4 sur une version ≥ 1.4 et, au palier 2, l'absence d'illusions.
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

  // ── 0. versions, sons, aides ──
  const r0 = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    window.LOG = [];
    BOSS.combat.on('*', (t, d) => { if (['tube', 'miniBoss', 'protection', 'action', 'etat', 'palier', 'illusion', 'crochet', 'frappe', 'bloc', 'joueurTouche'].indexOf(t) >= 0) LOG.push({ type: t, d: JSON.parse(JSON.stringify(d || {})), temps: BOSS.temps() }); });
    while (BOSS.bots.liste().length) BOSS.retirerBot();
    BOSS.invincible(true);
    if (BOSS.audio) await BOSS.audio.precharger();
    window.CAPA = [];
    if (BOSS.audio) { const f = BOSS.audio.sonMiniBoss; BOSS.audio.sonMiniBoss = (type, quoi, pos, opt) => { CAPA.push({ type, quoi, etat: opt && opt.etat, id: opt && opt.id, cible: opt && opt.cible, n: opt && opt.intensite, temps: BOSS.temps() }); return f(type, quoi, pos, opt); }; }
    window.DEG = [];
    BOSS.zombies.brancherDegats((z, id, f, src, info) => DEG.push({ type: z.type, id, f, src, etourdi: info && info.etourdissement, temps: BOSS.temps() }));
    // avance image par image jusqu'à ce que pred() soit vrai (au plus s secondes) ; renvoie le temps écoulé ou null
    window.attendre = (pred, s, chaqueImage) => { const t0 = BOSS.temps(); for (let i = 0; i < Math.round(s * 60); i++) { if (chaqueImage) chaqueImage(i); BOSS.avancer(1, 1 / 60); if (pred()) return +(BOSS.temps() - t0).toFixed(2); } return null; };
    window.mbVivant = () => BOSS.zombies.liste().find((v) => v.miniBoss);
    window.seuilSuivant = () => {         // PV du Septième juste sous le prochain seuil de mini-boss
      const e = BOSS.combat.etat(), S = BOSS_B7_CONFIG.miniBoss.seuils, k = e.tubes.filter((t) => t.etat !== 'intact').length;
      BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
      return k;
    };
    const sons = ['demembre_cri', 'demembre_mort', 'demembre_fleau', 'demembre_impact', 'demembre_rale', 'irradie_boule', 'irradie_boule_impact', 'zone_radioactive',
      'survolte_etourdi', 'crochet_lancer', 'crochet_accroche', 'crochet_traction', 'crochet_rate', 'palier_lames_rouges', 'palier_crochets'];   // v1.5 : sans les 4 sons des illusions
    const charges = BOSS.audio ? sons.filter((k) => { const h = BOSS.audio.jouer(k, { plein: true, volume: 0 }); if (h) h.stop(0); return !!h; }) : [];
    return { versions: { logique: BossB7Logique.version, modele: BossB7Modele.version, audio: BOSS.audio && BOSS.audio.version, hud: BOSS.hud.version, fx: BossB7Fx.version },
      crochetModele: BossB7Modele.actions.indexOf('crochet') >= 0, sons: charges.length, chargement: document.getElementById('chargement').textContent };
  });
  const v14 = (v) => { const m = /^(\d+)\.(\d+)\./.exec(v || ''); return !!m && (+m[1] > 1 || (+m[1] === 1 && +m[2] >= 4)); };
  ok(v14(r0.versions.logique) && /^2\.([2-9]|\d\d)\./.test(r0.versions.modele) && v14(r0.versions.audio) && v14(r0.versions.hud) && v14(r0.versions.fx) && r0.crochetModele, 'versions v1.4 ou plus (logique, modèle 2.2+ avec le crochet, effets, sons, interface)', r0.versions);
  const nSons = +((/(\d+) sons/.exec(r0.chargement) || [])[1] || 0);
  ok(r0.sons === 15 && nSons >= 114, 'les 15 sons de la v1.4 encore utilisés sont chargés (114 au total en v1.4, 133 en v1.5)', { sons: r0.sons, chargement: r0.chargement });

  // ── 1. phase 2 : trois cuves, trois repères ; 75 % : Le Survolté étourdit et frappe plusieurs joueurs ──
  const r1 = await p.evaluate(() => {
    BOSS.lancerCombat('phase2'); BOSS.avancer(60, 1 / 60);
    const e = BOSS.combat.etat();
    const avant = { tubes: e.tubes.map((t) => t.id + ':' + t.etat + ':' + t.miniBoss), monde: BOSS.monde.etatTubes().map((t) => t.etat), seuils: document.querySelectorAll('.b7h-seuil').length };
    seuilSuivant();
    const tl = attendre(() => !!mbVivant(), 14);
    const z = mbVivant();
    // un coéquipier à côté du joueur, les deux à 6 m du Survolté et en vue : une décharge doit les toucher tous les deux
    BOSS.ajouterBot();
    BOSS.avancer(60 * 2.6, 1 / 60);                     // il finit de sortir de sa cuve
    BOSS.invincible(false);
    let etourdi = 0, tEt = null;
    const t0 = BOSS.temps();
    attendre(() => { const d = DEG.filter((x) => x.src === 'decharge' && x.temps >= t0); return d.length && new Set(d.map((x) => x.id)).size >= 2; }, 25, (i) => {
      BOSS.joueur.soigner();
      const m = mbVivant(); if (!m) return;
      if (i % 30 === 0) {
        const j = BOSS.joueur.position, dx = j.x - m.position.x, dz = j.z - m.position.z, l = Math.hypot(dx, dz) || 1;
        const q = { x: m.position.x + dx / l * 6, z: m.position.z + dz / l * 6 }, g = BOSS.monde.grilles.salle.plusProcheLibre(q.x, q.z, 4) || q;
        BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(m.position.x - g.x, m.position.z - g.z), 'salle');
        const bt = BOSS.bots.liste()[0]; if (bt) BOSS.jeu.teleporter(bt.id, { x: g.x + 1.2, y: 0, z: g.z + 0.6 }, 0, 'salle');
      }
      const r = BOSS.joueur.etourdiRestant(); if (r > etourdi) { etourdi = r; tEt = BOSS.temps(); }
    });
    etourdi = Math.max(etourdi, BOSS.joueur.etourdiRestant());   // la décharge qui arrête l'attente a pu étourdir à la dernière image
    BOSS.invincible(true);
    const dech = DEG.filter((x) => x.src === 'decharge' && x.temps >= t0);
    const parTemps = {}; dech.forEach((x) => { const k = x.temps.toFixed(2); (parTemps[k] = parTemps[k] || new Set()).add(x.id); });
    const multi = Object.values(parTemps).some((s) => s.size >= 2);
    return { avant, tl, type: z && z.type, multi, cibles: [...new Set(dech.map((x) => x.id))], etourdi: +etourdi.toFixed(2), etourdiInfo: dech.length ? dech[0].etourdi : null,
      capaEtourdi: CAPA.filter((c) => c.quoi === 'etourdi' && c.temps >= t0).map((c) => c.cible), alerte: document.querySelector('.b7h-alerte') ? document.querySelector('.b7h-alerte').textContent : null };
  });
  ok(r1.avant.tubes.join() === 'tube0:intact:survolte,tube1:intact:irradie,tube2:intact:demembre' && r1.avant.monde.join() === 'intact,intact,intact' && r1.avant.seuils === 3, 'phase 2 : trois cuves intactes (Survolté, Irradié, Démembré), repères 75/50/25 %', r1.avant);
  ok(r1.type === 'survolte' && r1.multi && r1.cibles.length >= 2, 'Survolté : une même décharge touche le joueur et le coéquipier', { multi: r1.multi, cibles: r1.cibles });
  ok(r1.etourdi > 0.8 && r1.etourdiInfo === 1 && r1.capaEtourdi.indexOf('j1') >= 0, 'Survolté : le joueur touché est étourdi 1 s (son « étourdi » chez lui)', r1);
  const r1b = await p.evaluate(() => {
    BOSS.retirerBot();
    const m = mbVivant(); if (m) BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(30, 1 / 60);
    return { protege: BOSS.combat.etat().boss.protege };
  });
  ok(!r1b.protege, 'Survolté abattu : protection levée', r1b);

  // ── 2. 50 % : L'Irradié, plus rapide, aura de 6 m, boules et zones qui restent jusqu'à sa mort ──
  const r2 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    seuilSuivant();
    attendre(() => !!mbVivant(), 16);
    BOSS.avancer(60 * 2.6, 1 / 60);
    // vitesse : le joueur à 14 m, immobile ; on mesure son déplacement sur 1,5 s
    let m = mbVivant();
    const j0 = BOSS.joueur.position, dx = j0.x - m.position.x, dz = j0.z - m.position.z, l = Math.hypot(dx, dz) || 1;
    const q = BOSS.monde.grilles.salle.plusProcheLibre(m.position.x + dx / l * 14, m.position.z + dz / l * 14, 5) || { x: m.position.x + dx / l * 14, z: m.position.z + dz / l * 14 };
    BOSS.joueur.teleporter({ x: q.x, y: 0, z: q.z }, 0, 'salle');
    BOSS.avancer(20, 1 / 60);
    m = mbVivant(); const a = { x: m.position.x, z: m.position.z };
    BOSS.avancer(90, 1 / 60);
    m = mbVivant(); const vitesse = Math.hypot(m.position.x - a.x, m.position.z - a.z) / 1.5;
    // boules : au moins deux salves (2 boules chacune en solo, un signal « lancer » par salve), zones créées
    const tB = BOSS.temps();
    attendre(() => CAPA.filter((c) => c.type === 'irradie' && c.quoi === 'boule' && c.etat === 'lancer' && c.temps >= tB).length >= 2, 16, (i) => {
      const mm = mbVivant(); if (!mm || i % 40) return;
      const jj = BOSS.joueur.position, ex = jj.x - mm.position.x, ez = jj.z - mm.position.z, ll = Math.hypot(ex, ez) || 1;
      const g = BOSS.monde.grilles.salle.plusProcheLibre(mm.position.x + ex / ll * 10, mm.position.z + ez / ll * 10, 5); if (g) BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, 0, 'salle');
    });
    const lancers = CAPA.filter((c) => c.type === 'irradie' && c.quoi === 'boule' && c.etat === 'lancer' && c.temps >= tB).map((c) => ({ t: +c.temps.toFixed(1), n: c.n }));
    BOSS.avancer(60 * 1.5, 1 / 60);
    const zones = BOSS.zombies.zones().length;
    // aura : le joueur à 5 m (dans les 6 m) pendant 1,5 s
    const tA = BOSS.temps();
    for (let i = 0; i < 90; i++) { const mm = mbVivant(); if (i % 15 === 0) BOSS.joueur.teleporter({ x: mm.position.x + 5, y: 0, z: mm.position.z }, -Math.PI / 2, 'salle'); BOSS.avancer(1, 1 / 60); }
    const aura = DEG.filter((d) => d.src === 'aura' && d.temps >= tA).length;
    const nommesZ = (BOSS.audio ? BOSS.audio.stats().nommes : []).filter((n) => /^zone:/.test(n)).length;
    // zones toujours là 10 s plus tard (pas d'extinction tant qu'il vit)
    BOSS.avancer(60 * 4, 1 / 60);
    const zones2 = BOSS.zombies.zones().filter((z) => !z.extinction).length;
    return { vitesse: +vitesse.toFixed(2), lancers, zones, zones2, aura, nommesZ, rayon: BOSS_B7_CONFIG.miniBoss.irradie.aura.rayon, vmax: BOSS_B7_CONFIG.miniBoss.irradie.vitesse };
  });
  ok(r2.vitesse > 3.6 && r2.vitesse <= r2.vmax + 0.3, 'Irradié : il marche à ≈ ' + r2.vmax + ' m/s (v1.3 : 2,8)', { mesuree: r2.vitesse });
  ok(r2.lancers.length >= 2 && r2.lancers.every((x) => x.n === 2) && r2.lancers[1].t - r2.lancers[0].t <= 7.5, 'Irradié : une salve de 2 boules en solo toutes les ≈ 6 s', r2.lancers);
  ok(r2.zones >= 2 && r2.zones2 >= r2.zones && r2.nommesZ >= 2, 'Irradié : chaque boule laisse une zone radioactive qui reste (une boucle sonore par zone)', { zones: r2.zones, plusTard: r2.zones2, boucles: r2.nommesZ });
  ok(r2.aura >= 3 && r2.rayon === 6, 'Irradié : l’aura blesse à 5 m (rayon 6 m)', { ticks: r2.aura, rayon: r2.rayon });
  {
    const q = await p.evaluate(() => { const m = mbVivant(); return m ? { x: m.position.x, z: m.position.z } : null; });
    if (q) await vue('v14-21-irradie-zones', { x: q.x + 6, y: 9, z: q.z + 6 }, { x: q.x, y: 0, z: q.z }, 'salle');
  }
  const r2b = await p.evaluate(() => {
    const m = mbVivant(), t0 = BOSS.temps();
    const debuts = CAPA.filter((c) => c.quoi === 'zone' && c.etat === 'debut').map((c) => c.id);
    BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(60 * 3, 1 / 60);
    const fins = CAPA.filter((c) => c.quoi === 'zone' && c.etat === 'fin' && c.temps >= t0).map((c) => c.id);
    return { debuts: debuts.length, fins: fins.length, toutes: debuts.every((id) => fins.indexOf(id) >= 0), restantes: BOSS.zombies.zones().filter((z) => !z.extinction).length,
      boucles: (BOSS.audio ? BOSS.audio.stats().nommes : []).filter((n) => /^zone:/.test(n)).length, protege: BOSS.combat.etat().boss.protege };
  });
  ok(r2b.toutes && r2b.restantes === 0 && r2b.boucles === 0 && !r2b.protege, 'Irradié abattu : toutes ses zones s’éteignent (sons compris), protection levée', r2b);

  // ── 3. 25 % : Le Démembré sort de la 3e cuve ; fléau en arc ; puis fin normale de la phase 2 ──
  const r3 = await p.evaluate(() => {
    const t0 = BOSS.temps();
    seuilSuivant();
    attendre(() => !!mbVivant(), 16);
    const ev = LOG.filter((x) => x.temps >= t0);
    BOSS.avancer(60 * 2.6, 1 / 60);
    const barres = Array.from(document.querySelectorAll('.b7h-mb')).map((x) => x.querySelector('.n').textContent + ':' + x.style.getPropertyValue('--c'));
    const z = mbVivant();
    // le joueur à 2 m devant lui, immobile : le fléau doit partir et toucher
    const tF = BOSS.temps();
    attendre(() => DEG.some((d) => d.src === 'fleau' && d.temps >= tF), 12, (i) => {
      const m = mbVivant(); if (!m || i % 20) return;
      BOSS.joueur.teleporter({ x: m.position.x + Math.sin(m.lacet) * 1.8, y: 0, z: m.position.z + Math.cos(m.lacet) * 1.8 }, m.lacet + Math.PI, 'salle');
    });
    return { tubes: ev.filter((x) => x.type === 'tube').map((x) => x.d.id + ':' + x.d.etat), libere: (ev.find((x) => x.type === 'miniBoss' && x.d.etat === 'libere') || {}).d,
      type: z && z.type, nom: z && z.nom, barres, fleau: CAPA.filter((c) => c.type === 'demembre' && c.temps >= tF).map((c) => c.quoi + ':' + (c.etat || '')),
      degFleau: DEG.filter((d) => d.src === 'fleau' && d.temps >= tF).map((d) => +d.f.toFixed(2)), nommes: BOSS.audio ? BOSS.audio.stats().nommes : [] };
  });
  ok(r3.tubes.join() === 'tube2:siphon,tube2:fissure,tube2:eclate' && r3.libere && r3.libere.type === 'demembre' && r3.type === 'demembre', '25 % : il siphonne la 3e cuve, Le Démembré en sort', { tubes: r3.tubes, libere: r3.libere });
  ok(r3.barres.length === 1 && /Démembré/.test(r3.barres[0]) && /e3b65c/i.test(r3.barres[0]), 'barre « Le Démembré » à sa couleur', r3.barres);
  ok(r3.fleau.indexOf('fleau:preparation') >= 0 && r3.degFleau.length >= 1 && r3.degFleau[0] === 0.3, 'Démembré : fléau annoncé puis coup de 30 % en arc', { capa: r3.fleau.slice(0, 6), degats: r3.degFleau });
  ok(r3.nommes.some((n) => /^mb:.*:rale$/.test(n)), 'sons : râle et pas boiteux sur le Démembré', r3.nommes);
  {
    await p.evaluate(() => {
      const m = mbVivant(); if (!m) return;
      const q = { x: m.position.x + Math.sin(m.lacet) * 6, z: m.position.z + Math.cos(m.lacet) * 6 }, g = BOSS.monde.grilles.salle.plusProcheLibre(q.x, q.z, 4) || q;
      BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(m.position.x - g.x, m.position.z - g.z), 'salle');
      BOSS.avancer(2, 1 / 60);
    });
    await vueJoueur('v14-20-demembre-barre');
  }
  const r3b = await p.evaluate(() => {
    const m = mbVivant(); BOSS.zombies.toucher(m.id, 1e7, 'corps', { joueur: 'j1' });
    BOSS.avancer(60, 1 / 60);
    const protege = BOSS.combat.etat().boss.protege;
    BOSS.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
    attendre(() => BOSS.combat.etat().etat !== 'phase2', 8);
    return { protege, etat: BOSS.combat.etat().etat, tubes: BOSS.combat.etat().tubes.map((t) => t.etat) };
  });
  ok(!r3b.protege && r3b.etat === 'transition23' && r3b.tubes.join() === 'eclate,eclate,eclate', 'après les trois mini-boss, la phase 2 se termine normalement', r3b);

  // ── 4. phase 3 sous 50 % : salves de 4 blocs, quasi simultanées, message une fois ──
  const r4 = await p.evaluate(() => {
    BOSS.lancerCombat('phase3'); BOSS.avancer(30, 1 / 60);
    const e = BOSS.combat.etat(); BOSS.combat.forcer('pvSegment', 0.49 * e.barre.max);
    const t0 = BOSS.temps();
    attendre(() => { const a = BOSS.combat.etat().boss.action; return a && a.id === 'arrachement' && a.donnees && a.donnees.salve; }, 15);
    const a = BOSS.combat.etat().boss.action;
    const blocs = a && a.donnees && a.donnees.blocs ? a.donnees.blocs.length : 0;
    attendre(() => LOG.filter((x) => x.type === 'bloc' && x.d.etat === 'vol' && x.temps >= t0).length >= 4, 6);
    const vols = LOG.filter((x) => x.type === 'bloc' && x.d.etat === 'vol' && x.temps >= t0).map((x) => x.temps);
    return { salve: !!(a && a.donnees && a.donnees.salve), blocs, ecart: vols.length >= 4 ? +(vols[3] - vols[0]).toFixed(2) : null, toast: document.querySelector('.b7h-toasts').textContent };
  });
  ok(r4.salve && r4.blocs === 4 && r4.ecart != null && r4.ecart <= 0.6, 'phase 3 sous 50 % : salve de 4 blocs lancés en moins de 0,6 s', r4);
  ok(/plusieurs blocs/.test(r4.toast), 'message des salves', r4.toast.slice(0, 160));
  {
    const q = await p.evaluate(() => { const j = BOSS.joueur.position, bp = BOSS.combat.etat().boss.position; return { j: { x: j.x, z: j.z }, b: bp }; });
    await vue('v14-22-salve', { x: q.j.x - (q.b.x - q.j.x) * 0.25, y: 4.5, z: q.j.z - (q.b.z - q.j.z) * 0.25 }, { x: q.b.x, y: 2, z: q.b.z }, 'salle');
  }

  // ── 5. faiblesse : des zombies apparaissent ──
  const r5 = await p.evaluate(() => {
    BOSS.lancerCombat('faiblesse'); const t = attendre(() => BOSS.zombies.nombre('salle', 'zombie') >= 3, 10);
    return { t, zombies: BOSS.zombies.nombre('salle', 'zombie'), objectif: document.querySelector('.b7h-objectif span').textContent };
  });
  ok(r5.t != null && /zombies/.test(r5.objectif), 'faiblesse : des zombies apparaissent pendant qu’il est à terre', r5);

  // ── 6. phase 5 : lames bleues (2 coups), rouges (1 %), illusions, crochets ──
  const r6 = await p.evaluate(() => {
    BOSS.lancerCombat('phase5'); BOSS.avancer(60 * 3, 1 / 60);
    const e = BOSS.combat.etat();
    const d0 = { palier: e.boss.palier, couleur: e.boss.couleurLames, modele: BOSS.modele.couleurLames(), reps: document.querySelectorAll('.b7h-jauge .rep').length,
      aide: document.querySelector('.b7h-jauge .palier').textContent };
    // un coup au palier 0 : 50 %
    BOSS.invincible(false); BOSS.joueur.soigner();
    const t0 = BOSS.temps();
    attendre(() => LOG.some((x) => x.type === 'frappe' && x.d.reussie && x.temps >= t0), 25, (i) => {
      BOSS.joueur.soigner();                             // chiens et zombies : PV pleins juste avant le coup
      if (i % 30) return;
      const bp = BOSS.combat.etat().boss.position; if (!bp) return;
      const g = BOSS.monde.grilles.bunker.plusProcheLibre(bp.x + 1.6, bp.z + 0.4, 3); if (g) BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(bp.x - g.x, bp.z - g.z), 'bunker');
    });
    const f0 = LOG.find((x) => x.type === 'frappe' && x.d.reussie && x.temps >= t0);
    const pv0 = BOSS.joueur.pv / BOSS.joueur.pvMax;
    BOSS.invincible(true);
    return { d0, frappe: f0 && f0.d, pv0: +pv0.toFixed(2) };
  });
  ok(r6.d0.palier === 0 && r6.d0.couleur === 'bleu' && r6.d0.modele === 'bleu' && r6.d0.reps === 3 && /Lames bleues/.test(r6.d0.aide), 'phase 5, palier 0 : lames bleu très clair (modèle compris), repères 25/50/75 %, aide', r6.d0);
  ok(r6.frappe && r6.frappe.speciale === false && Math.abs(r6.pv0 - 0.5) < 0.06, 'lames bleues : un coup enlève 50 % (deux coups tuent)', { frappe: r6.frappe, pv: r6.pv0 });
  {
    const q = await p.evaluate(() => { const bp = BOSS.combat.etat().boss.position; BOSS.joueur.soigner(); return bp; });
    await vue('v14-23-lames-bleues', { x: q.x + 2.2, y: 1.7, z: q.z + 2.2 }, { x: q.x, y: 1.2, z: q.z }, 'bunker');
  }
  const r7 = await p.evaluate(() => {
    BOSS.joueur.soigner();
    BOSS.avancer(60 * 10.5, 1 / 60);                   // laisse finir une éventuelle disparition
    BOSS.combat.forcer('jauge', 0.27); BOSS.avancer(3, 1 / 60);
    const e1 = BOSS.combat.etat();
    const p1 = { palier: e1.boss.palier, couleur: e1.boss.couleurLames, modele: BOSS.modele.couleurLames(), aide: document.querySelector('.b7h-jauge .palier').textContent };
    // un coup au palier 1 : 1 %
    BOSS.invincible(false); BOSS.joueur.soigner();
    const t0 = BOSS.temps();
    attendre(() => LOG.some((x) => x.type === 'frappe' && x.d.reussie && x.temps >= t0), 30, (i) => {
      BOSS.joueur.soigner();
      if (i % 30) return;
      const b = BOSS.combat.etat().boss; if (!b.present || !b.visible) return;
      const g = BOSS.monde.grilles.bunker.plusProcheLibre(b.position.x + 1.6, b.position.z + 0.4, 3); if (g) BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(b.position.x - g.x, b.position.z - g.z), 'bunker');
    });
    const f1 = LOG.find((x) => x.type === 'frappe' && x.d.reussie && x.temps >= t0);
    const pv1 = BOSS.joueur.pv / BOSS.joueur.pvMax;
    BOSS.invincible(true); BOSS.joueur.soigner();
    return { p1, frappe: f1 && f1.d, pv1: +pv1.toFixed(3), sonPalier: LOG.some((x) => x.type === 'palier' && x.d.numero === 1) };
  });
  ok(r7.p1.palier === 1 && r7.p1.couleur === 'rouge' && r7.p1.modele === 'rouge' && /Lames rouges/.test(r7.p1.aide) && r7.sonPalier, 'palier 1 (25 %) : lames rouges, aide « 1 % »', r7.p1);
  ok(r7.frappe && r7.frappe.speciale === true && r7.pv1 > 0 && r7.pv1 <= 0.011, 'lames rouges : un coup laisse à 1 %', { frappe: r7.frappe, pv: r7.pv1 });
  const r8 = await p.evaluate(() => {
    BOSS.avancer(60 * 10.5, 1 / 60);
    BOSS.combat.forcer('jauge', 0.52);
    BOSS.avancer(60 * 2, 1 / 60);
    const e = BOSS.combat.etat();
    return { palier: e.boss.palier, illusions: (e.illusions || []).length, api: 'illusions' in BOSS, aide: document.querySelector('.b7h-jauge .palier').textContent,
      sons: (BOSS.audio ? BOSS.audio.stats().nommes : []).filter((n) => /^ill:/.test(n)).length };
  });
  ok(r8.palier === 2 && r8.illusions === 0 && !r8.api && r8.sons === 0 && /Intangible/.test(r8.aide), 'palier 2 (50 %) : plus d’illusions en v1.5 (intangibilité : test-v15-assemblage.js)', r8);
  const r9 = await p.evaluate(() => {
    BOSS.combat.forcer('jauge', 0.77);
    BOSS.avancer(3, 1 / 60);
    const palier = BOSS.combat.etat().boss.palier;
    // le joueur à ~10 m du Septième, en vue, immobile : un crochet doit l'accrocher et le ramener
    const t0 = BOSS.temps();
    let place = false, alerte = '';
    BOSS.invincible(false);                              // un joueur invulnérable n'est pas une cible de crochet
    attendre(() => LOG.some((x) => x.type === 'crochet' && x.d.etat === 'arrivee' && x.temps >= t0), 30, (i) => {
      BOSS.joueur.soigner();
      const b = BOSS.combat.etat().boss;
      if (LOG.some((x) => x.type === 'crochet' && x.d.etat === 'accroche' && x.temps >= t0)) { const t = document.querySelector('.b7h-alerte').textContent; if (t) alerte = t; return; }
      if (i % 45 || !b.present || !b.visible) return;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, q = { x: b.position.x + Math.sin(a) * 10, y: 0, z: b.position.z + Math.cos(a) * 10 };
        const g = BOSS.monde.grilles.bunker.plusProcheLibre(q.x, q.z, 1.5);
        if (g && Math.hypot(g.x - b.position.x, g.z - b.position.z) > 6 && BOSS.monde.visible(b.position, { x: g.x, y: 0, z: g.z }, 'bunker')) { BOSS.joueur.teleporter({ x: g.x, y: 0, z: g.z }, Math.atan2(b.position.x - g.x, b.position.z - g.z), 'bunker'); place = true; break; }
      }
    });
    const ev = LOG.filter((x) => x.type === 'crochet' && x.temps >= t0).map((x) => x.d.etat);
    const tA = BOSS.temps();
    attendre(() => LOG.some((x) => x.type === 'frappe' && x.temps >= tA), 3);
    const fr = LOG.find((x) => x.type === 'frappe' && x.temps >= tA);
    BOSS.avancer(30, 1 / 60);
    BOSS.invincible(true); BOSS.joueur.soigner();
    return { palier, place, ev, frappe: fr && fr.d, controle: BOSS.joueur.controle !== false, alerte, aide: document.querySelector('.b7h-jauge .palier').textContent };
  });
  ok(r9.palier === 3 && /Crochets/.test(r9.aide), 'palier 3 (75 %) : crochets, aide « un pas de côté »', { palier: r9.palier, aide: r9.aide });
  ok(r9.ev.indexOf('lancer') >= 0 && r9.ev.indexOf('accroche') >= 0 && r9.ev.indexOf('arrivee') >= 0 && r9.frappe && r9.frappe.reussie, 'crochet : lancé, accroché, ramené devant lui, puis il frappe aussitôt', { ev: r9.ev, frappe: r9.frappe });
  ok(/Accroché/.test(r9.alerte) && r9.controle, 'interface « Accroché ! » pendant la traction, commandes rendues après le coup', { alerte: r9.alerte, controle: r9.controle });
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
