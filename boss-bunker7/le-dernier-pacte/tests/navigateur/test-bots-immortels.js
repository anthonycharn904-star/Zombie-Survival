// Coéquipiers simulés immortels (essais du combat complet, demande d'Anthony) : réglage par défaut de la page,
// case du panneau P, coups qui portent sans jamais tuer, régénération, retour à la normale (?bots=mortels ou case décochée).
// node proto/dev/test-bots-immortels.js
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RACINE = path.resolve(__dirname, '../..');
let ko = 0; const ok = (c, l, x) => { console.log((c ? 'ok    ' : 'ÉCHEC ') + l + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) ko++; };
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  const p = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(RACINE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = 'http://127.0.0.1:' + srv.address().port + '/prototype/index.html?auto=1';
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|TUNNEL/.test(m.text())) err.push(m.text()); });
  await p.goto(url);
  await p.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  const r1 = await p.evaluate(() => ({ api: BOSS.botsImmortels(), case: document.getElementById('dbgBotsImmortels').checked, bouton: document.getElementById('jouerCoop').textContent }));
  ok(r1.api === true && r1.case === true && /immortels/.test(r1.bouton), 'par défaut : coéquipiers immortels (case cochée, bouton « immortels »)', r1);
  const r2 = await p.evaluate(() => {
    document.getElementById('accueil').hidden = true;
    while (BOSS.bots.liste().length < 3) BOSS.ajouterBot();
    BOSS.lancerCombat('phase1'); BOSS.avancer(30, 1 / 60);
    const b = BOSS.bots.liste()[0];
    const d1 = BOSS.jeu.infligerDegats(b.id, 5, { source: 'test' });          // 500 % des PV max
    const apres = { vivant: b.vivant, pv: b.pv };
    BOSS.jeu.blessureCritique(b.id, 0.01);
    const crit = b.pv;
    BOSS.avancer(60 * 6, 1 / 60);                                              // > 3,5 s sans coup : régénération
    return { d1, apres, crit, regen: Math.round(b.pv), vue: BOSS.jeu.joueurs().filter((j) => j.id === b.id)[0].vivant };
  });
  ok(r2.d1 > 0 && r2.apres.vivant && r2.apres.pv === 1 && r2.vue, 'coup mortel : le coup porte, PV bloqués à 1, toujours vivant', r2);
  ok(r2.crit <= 1 && r2.regen > r2.crit + 5, 'frappe à 1 % puis la régénération reprend (des zombies peuvent le toucher entre-temps)', { crit: r2.crit, regen: r2.regen });
  const r3 = await p.evaluate(() => {
    BOSS.lancerCombat('phase5');
    let morts = 0;
    for (let i = 0; i < 60 * 90; i++) { BOSS.avancer(1, 1 / 60); if (i % 60 === 0) morts = Math.max(morts, BOSS.bots.liste().filter((b) => !b.vivant).length); }
    return { morts, pvMin: Math.min.apply(null, BOSS.bots.liste().map((b) => b.pv)), etat: BOSS.etat().etat };
  });
  ok(r3.morts === 0, '90 s de phase 5 (chiens, zombies, frappes) : aucun coéquipier mort', r3);
  const r35 = await p.evaluate(() => {
    BOSS.lancerCombat('phase2'); BOSS.avancer(30, 1 / 60);
    BOSS.jeu.infligerDegats('j1', 5, { source: 'test' });
    const mort = !BOSS.joueur.vivant;
    BOSS.avancer(60 * 3, 1 / 60);
    const encoreMort = !BOSS.joueur.vivant;
    BOSS.avancer(60 * 3.5, 1 / 60);
    const j = BOSS.joueur.position, b = BOSS.bots.liste().filter((x) => x.vivant)[0];
    return { mort, encoreMort, revenu: BOSS.joueur.vivant, etat: BOSS.etat().etat, distBot: b ? +Math.hypot(j.x - b.position.x, j.z - b.position.z).toFixed(1) : null,
      toast: document.querySelector('.b7h-toasts').textContent };
  });
  ok(r35.mort && r35.encoreMort && r35.revenu && r35.etat === 'phase2' && r35.distBot != null && r35.distBot < 8, 'joueur tombé avec des coéquipiers immortels : de retour au combat 6 s plus tard, près d’eux', r35);
  const r4 = await p.evaluate(() => {
    const c = document.getElementById('dbgBotsImmortels');
    c.checked = false; c.dispatchEvent(new Event('change'));
    const b = BOSS.bots.liste()[1];
    BOSS.jeu.infligerDegats(b.id, 5, { source: 'test' });
    const mortel = { etat: BOSS.botsImmortels(), vivant: b.vivant, bouton: document.getElementById('jouerCoop').textContent };
    c.checked = true; c.dispatchEvent(new Event('change'));
    BOSS.avancer(2, 1 / 60);
    return { mortel, ranime: b.vivant, pv: Math.round(b.pv) };
  });
  ok(r4.mortel.etat === false && r4.mortel.vivant === false && !/immortels/.test(r4.mortel.bouton), 'case décochée : un coup mortel tue de nouveau', r4.mortel);
  ok(r4.ranime && r4.pv > 0, 'case recochée : le coéquipier mort se relève', r4);
  await p.close();
  const p2 = await b.newPage();
  await p2.goto(url + '&bots=mortels');
  await p2.waitForFunction(() => window.pret || window.erreur, null, { timeout: 240000 });
  const r5 = await p2.evaluate(() => ({ api: BOSS.botsImmortels(), case: document.getElementById('dbgBotsImmortels').checked }));
  ok(r5.api === false && r5.case === false, '?bots=mortels : coéquipiers mortels', r5);
  ok(err.length === 0, 'aucune erreur console', err.slice(0, 4));
  await b.close(); srv.close(); console.log(ko ? ko + ' ÉCHEC(S)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
});
