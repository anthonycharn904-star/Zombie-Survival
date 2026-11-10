// Fin du combat dans le prototype : interaction près du cadavre → récompenses → message → retour à Bunker 7.
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RACINE = path.resolve(__dirname, '../..'), SORTIE = path.resolve(__dirname, '../../captures/tests');
let ko = 0; const ok = (c, l, x) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + l + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) ko++; };
const srv = http.createServer((q, r) => { const p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg' }[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL/.test(m.text())) err.push(m.text()); });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/prototype/index.html?auto=1');
  await p.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  const r = await p.evaluate(async () => {
    document.getElementById('accueil').hidden = true;
    const rec = [], msg = [], etats = [];
    BOSS.combat.on('recompense', (e) => rec.push(e)); BOSS.combat.on('message', (e) => msg.push(e)); BOSS.combat.on('etat', (e) => etats.push(e.vers));
    BOSS.lancerCombat('conclusion'); BOSS.avancer(30);
    const A = BOSS_B7_ARENE.salle, c = A.cadavre, o = A.origine;
    BOSS.joueur.teleporter({ x: o.x + c.x + 1.2, y: 0, z: o.z + c.z - 1.2 }, null, 'salle');
    const inter0 = BOSS.etat().interaction;
    let t = 0; const dt = 1 / 30, vus = {};
    for (let i = 0; i < 30 * 70; i++) {
      BOSS.joueur.entree.interagir = BOSS.etat().etat === 'conclusion';
      BOSS.avancer(1, dt); t += dt;
      const e = BOSS.etat(); vus[e.etat] = vus[e.etat] || Math.round(t * 10) / 10;
      if (e.etat === 'message' && !vus.capture) { vus.capture = 1; }
      if (e.etat === 'termine') break;
    }
    return { inter0: !!inter0, vus, rec: rec.filter((x) => x.joueur === 'j1').map((x) => x.type + ':' + x.id + (x.repli ? '(autel)' : '')), msg: msg.map((m) => m.lignes), etats,
      lieu: BOSS.joueur.lieu, drapeau: BOSS.jeu.lireDrapeau(BOSS_B7_CONFIG.general.drapeauTermine), atouts: BOSS.jeu.listeAtouts(), message: document.querySelector('.b7h-message').textContent };
  });
  ok(r.inter0, 'invite d’interaction près du cadavre');
  ok(r.vus.recompenses != null && r.vus.message != null && r.vus.termine != null, 'conclusion → récompenses → message → terminé', r.vus);
  const armes = r.rec.filter((x) => x.startsWith('arme:')), atouts = r.rec.filter((x) => x.startsWith('atout:')), bonus = r.rec.filter((x) => x.startsWith('bonus:'));
  ok(armes.length === 2 && atouts.length === r.atouts.length && bonus.length === 9, '2 armes merveilles PaP 3, tous les atouts, 9 bonus', { armes, atouts: atouts.length + '/' + r.atouts.length, bonus: bonus.length });
  ok(r.msg.length === 1 && r.msg[0][1].indexOf('Khamsin') >= 0, 'message final affiché (Khamsin)', r.msg[0]);
  ok(r.lieu === 'bunker' && r.drapeau === true, 'retour dans Bunker 7, drapeau « terminé » posé', { lieu: r.lieu, drapeau: r.drapeau });
  await p.screenshot({ path: path.join(SORTIE, '21-message-final.png'), timeout: 180000 });
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
