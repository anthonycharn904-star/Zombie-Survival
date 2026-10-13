'use strict';
/* Tailles (jeu 2.0.3) : node tzeval.js <fichier.js> ; le fichier est le corps d'une fonction async
   exécutée au menu (boucle et rendu coupés). Affiche son résultat et les erreurs de la page. */
const path = require('path'), http = require('http'), fs = require('fs');
const REPO = path.join(__dirname, '..', '..');                       // racine du dépôt
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const ROOT = path.join(REPO, 'launcher', 'game');                     // jeu préparé : cd launcher && node scripts/prepare-game.js
const BODY = fs.readFileSync(process.argv[2], 'utf8');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.ZS_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.VW || 960), height: +(process.env.VH || 540) } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));
  page.on('console', (m) => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || (m.type() === 'log' && /^\[t\]/.test(m.text()))) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; });
  try {
    const r = await page.evaluate(`(async () => {\n${BODY}\n})()`);
    console.log(JSON.stringify(r, null, 1));
  } catch (e) { console.log('ERREUR', e.message); }
  if (process.env.SHOT) {
    await page.evaluate(() => { const st = G.state; G.state = 'shot'; renderEnabled = true; render(); renderEnabled = false; G.state = st; });
    await page.screenshot({ path: process.env.SHOT });
  }
  if (errs.length) console.log('ERREURS/JOURNAL\n' + errs.slice(0, 40).join('\n'));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
