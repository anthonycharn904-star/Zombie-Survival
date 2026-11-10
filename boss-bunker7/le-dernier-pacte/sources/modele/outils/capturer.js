// Captures de l'aperçu du modèle avec Playwright (Chromium, rendu logiciel). Usage :
//   node capturer.js travaux.json [three=r186] [tete=auto] [qualite=haute] [lames=auto] [allege=0]
// travaux.json : [{ fichier: 'captures/modele/x.png', planche: { lignes: [...], cols, w, h, titre } }
//               | { fichier, multi: { instances, vues, sombre, ... } } (plusieurs instances, apercu.plancheMulti) | { eval: 'js' }]
// Le serveur statique doit servir le dossier scratchpad/ sur le port 8794.
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const travaux = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const three = process.argv[3] || 'r186', tete = process.argv[4] || 'aucune', qualite = process.argv[5] || 'haute', lames = process.argv[6] || 'auto', allege = process.argv[7] === '1' ? '1' : '0';
  const racine = path.resolve(__dirname, '../../..');           // dossier boss/
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.type() + ': ' + m.text()); });
  const url = 'http://127.0.0.1:8794/boss/src/modele/apercu.html?three=' + three + '&tete=' + tete + '&qualite=' + qualite + '&lames=' + lames + '&allege=' + allege + '&w=900&h=700';
  await page.goto(url);
  await page.waitForFunction(() => window.apercu && window.apercu.pret === true, null, { timeout: 240000 });
  const t0 = Date.now();
  for (const tr of travaux) {
    if (tr.eval) { const r = await page.evaluate(tr.eval); console.log(JSON.stringify(r)); continue; }
    const data = tr.multi ? await page.evaluate((s) => window.apercu.plancheMulti(s), tr.multi) : await page.evaluate((s) => window.apercu.planche(s), tr.planche);
    if (tr.multi) console.log('instances', JSON.stringify(await page.evaluate(() => window.__multiInfo)));
    const f = path.resolve(racine, tr.fichier);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
    console.log('écrit', tr.fichier, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
  const st = await page.evaluate(() => window.apercu.stats());
  console.log('stats', JSON.stringify(st));
  console.log(erreurs.length ? erreurs.slice(0, 25).join('\n') : 'aucune erreur');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
