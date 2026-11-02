// Gros plans du boss dans le prototype assemblé (code actuel) : node proto/dev/vues-boss.js
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RACINE = path.resolve(__dirname, '../..'), SORTIE = path.resolve(__dirname, '../../captures/tests');
const srv = http.createServer((q, r) => { const p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg' }[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL/.test(m.text())) err.push(m.text()); });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/prototype/index.html?auto=1&obscurite=0');
  await p.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  await p.evaluate(() => { document.getElementById('accueil').hidden = true; BOSS.invincible(true); });
  const scenes = [
    { nom: 'gros-plan-phase1', etat: 'phase1', avance: 200, d: 3.2, angle: 0.35, h: 1.4 },
    { nom: 'gros-plan-ailes', etat: 'phase2', ames: true, avance: 150, d: 4.5, angle: 0.5, h: 1.5 },
    { nom: 'gros-plan-rage', etat: 'phase3', avance: 140, d: 4.0, angle: -0.4, h: 1.3 },
    { nom: 'gros-plan-lames', etat: 'phase5', avance: 330, d: 3.0, angle: 0.3, h: 1.2 },
    { nom: 'gros-plan-faiblesse', etat: 'faiblesse', avance: 150, d: 3.0, angle: 0.2, h: 1.1 }
  ];
  for (const s of scenes) {
    const r = await p.evaluate((s) => {
      BOSS.lancerCombat(s.etat); if (s.ames) BOSS.combat.forcer('ames', 10);
      BOSS.avancer(s.avance);
      const e = BOSS.etat(), b = e.boss, la = (b.lacet || 0) + s.angle;
      BOSS.joueur.teleporter({ x: b.position.x + Math.sin(la) * s.d, y: 0, z: b.position.z + Math.cos(la) * s.d }, null, b.lieu);
      BOSS.avancer(2); const b2 = BOSS.etat().boss;
      BOSS.joueur.regarder({ x: b2.position.x, y: b2.position.y + s.h, z: b2.position.z }, 0.02); BOSS.avancer(3);
      BOSS.arme.rendreVue = BOSS.arme.rendreVue; BOSS.pas(1);
      return { etat: BOSS.etat().etat, loco: b2.locomotion, action: b2.action && b2.action.id, lames: b2.lames, ailes: b2.ailes, visible: b2.visible };
    }, s);
    await p.screenshot({ path: path.join(SORTIE, s.nom + '.png'), timeout: 180000 });
    console.log(s.nom, JSON.stringify(r));
  }
  console.log('erreurs', JSON.stringify(err.slice(0, 5)));
  await b.close(); srv.close();
});
