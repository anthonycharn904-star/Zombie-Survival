// (créer d'abord le dossier captures/tests) Test du prototype assemblé : chargement, chaque état, captures, puis combat complet simulé (coéquipiers, temps accéléré).
// node proto/dev/test-assemblage.js [rapide]
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RACINE = path.resolve(__dirname, '../..');              // scratchpad/
const SORTIE = path.resolve(__dirname, '../../captures/tests');
const RAPIDE = process.argv.includes('rapide');
let echecs = 0;
const ok = (c, l, x) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + l + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) echecs++; };
function serveur() {
  const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png' };
  const s = http.createServer((q, r) => {
    const p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(RACINE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  return new Promise((res) => s.listen(0, '127.0.0.1', () => res(s)));
}
(async () => {
  const srv = await serveur();
  const url = 'http://127.0.0.1:' + srv.address().port + '/prototype/index.html?auto=1';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL/.test(m.text())) erreurs.push(m.text()); });
  p.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  const err = await p.evaluate(() => window.erreur || null);
  ok(!err, 'chargement de la page', err);
  console.log('   chargé en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s ; ' + await p.textContent('#chargement'));
  await p.evaluate(() => { document.getElementById('accueil').hidden = true; });
  // introduction depuis le bunker
  await p.evaluate(() => { BOSS.invincible(true); BOSS.lancerCombat('introduction'); });
  await p.waitForTimeout(50);
  const intro = await p.evaluate(() => { const r = []; for (let i = 0; i < 18; i++) { BOSS.pas(30); const e = BOSS.etat(); r.push(e.etat + '@' + e.lieu); } return r; });
  ok(intro.some((s) => s.startsWith('introduction@salle')) && intro[intro.length - 1].startsWith('phase1'), 'introduction : quête → téléportation → phase 1', intro);
  await p.screenshot({ path: path.join(SORTIE, '01-phase1.png'), timeout: 180000 });
  const ETATS = RAPIDE ? ['phase2', 'phase3', 'rituel', 'phase5'] : ['repit', 'phase2', 'absence', 'phase3', 'rituel', 'faiblesse', 'transition45', 'phase5', 'defaite', 'conclusion'];
  let n = 2;
  for (const s of ETATS) {
    const r = await p.evaluate((s) => {
      BOSS.lancerCombat(s);
      if (s === 'phase2') { BOSS.combat.forcer('ames', 10); }
      BOSS.pas(s === 'transition45' ? 150 : 120);
      // le joueur regarde le boss
      const e = BOSS.etat(), b = e.boss.position;
      if (e.boss.present && e.lieu === BOSS.joueur.lieu) { BOSS.joueur.regarder({ x: b.x, y: b.y + 1.3, z: b.z }, 0.05); }
      BOSS.pas(20);
      const e2 = BOSS.etat();
      return { etat: e2.etat, lieu: e2.lieu, joueur: BOSS.joueur.lieu, boss: e2.boss.present ? e2.boss.locomotion + (e2.boss.action ? ':' + e2.boss.action.id : '') : 'absent', hud: [...document.querySelectorAll('.b7h .on')].map((x) => x.className.split(' ')[0]).join(',') };
    }, s);
    ok(r.etat !== 'echec', 'état ' + s, r);
    await p.screenshot({ path: path.join(SORTIE, String(n++).padStart(2, '0') + '-' + s + '.png'), timeout: 180000 });
  }
  ok(erreurs.length === 0, 'aucune erreur console pendant les états', erreurs.slice(0, 5));
  // combat complet : 3 coéquipiers, joueur invincible qui ne tire pas (les bots font le travail), pas de rendu par pas
  if (!RAPIDE) {
    // par tranches de 30 s de jeu : un seul evaluate de 15 min bloquerait la page trop longtemps
    await p.evaluate(() => { while (BOSS.bots.liste().length < 3) BOSS.ajouterBot(); BOSS.invincible(true); BOSS.lancerCombat('introduction'); window.FC = { durees: {}, dernier: null, t: 0 }; });
    await new Promise((r) => setTimeout(r, 30));
    let fin = null;
    for (let k = 0; k < 60 && !fin; k++) {
      fin = await p.evaluate(() => {
        const F = FC, pasS = 1 / 30;
        for (let i = 0; i < 900; i++) {
          BOSS.avancer(1, pasS); F.t += pasS;
          const e = BOSS.etat();
          if (e.etat !== F.dernier) { F.durees[e.etat] = Math.round(F.t); F.dernier = e.etat; }
          if (e.etat === 'conclusion' && e.tempsEtat > 1) {   // le joueur va au cadavre (sinon validation automatique après 120 s)
            const A = BOSS_B7_ARENE.salle, cx = A.origine.x + A.cadavre.x, cz = A.origine.z + A.cadavre.z, j = BOSS.joueur.position;
            if (Math.hypot(j.x - cx, j.z - cz) > 2) BOSS.joueur.teleporter({ x: cx + 1.2, y: 0, z: cz - 1.2 }, null, 'salle');
          }
          BOSS.joueur.entree.interagir = e.etat === 'conclusion';   // touche E maintenue (lue par la boucle du prototype)
          if (e.etat === 'termine' || e.etat === 'echec') return { durees: F.durees, fin: e.etat, t: Math.round(F.t) };
        }
        return F.t > 24 * 60 ? { durees: F.durees, fin: BOSS.etat().etat, t: Math.round(F.t) } : null;   // v1.2 : chiens → plus long avec les coéquipiers simulés
      });
    }
    ok(fin.fin === 'termine', 'combat complet avec 3 coéquipiers simulés (temps de jeu ' + fin.t + ' s)', fin.durees);
    await p.screenshot({ path: path.join(SORTIE, '20-termine.png'), timeout: 180000 });
  }
  ok(erreurs.length === 0, 'aucune erreur console au total', erreurs.slice(0, 5));
  await b.close(); srv.close();
  console.log(echecs ? echecs + ' ÉCHEC(S)' : 'Tout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
