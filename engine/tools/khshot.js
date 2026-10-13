'use strict';
/* Images de Khamsin depuis des caméras libres : node khshot.js <dossier> "nom:x,y,z:lx,ly,lz;…" [code avant] */
const path = require('path'), http = require('http'), fs = require('fs');
const REPO = path.join(__dirname, '..', '..');                       // racine du dépôt
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const ROOT = path.join(REPO, 'launcher', 'game');                     // jeu préparé : cd launcher && node scripts/prepare-game.js
const DIR = path.resolve(process.argv[2]);
fs.mkdirSync(DIR, { recursive: true });
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
  const page = await browser.newPage({ viewport: { width: +(process.env.KW || 960), height: +(process.env.KH || 540) } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; settings.quality = 'medium'; __zs.map('khamsin'); __zs.start(); __zs.god(true); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } G.roundState = 'pre'; G.roundT = 1e9; HUD.el.hud.hidden = true; });
  if (process.argv[4]) console.log(JSON.stringify(await page.evaluate(process.argv[4])));
  for (const spec of process.argv[3].split(';')) {
    const [name, a, b] = spec.split(':');
    const [x, y, z] = a.split(',').map(Number), [lx, ly, lz] = b.split(',').map(Number);
    await page.evaluate(([x, y, z, lx, ly, lz]) => {
      const cam = window.__shotCam || (window.__shotCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4300));
      cam.position.set(x, y, z); cam.lookAt(lx, ly, lz); cam.updateMatrixWorld();
      camera.position.set(x, y, z);
      __zs.tp(x, z); owUpdateTerrainLod(true); owUpdateRoads(); owApplyGrade(0); OW.sky.position.copy(cam.position);
      camera.position.set(x, y, z); owUpdateRoads();
      ZS.setViewCamera(cam);
      const st = G.state; G.state = 'shot'; renderEnabled = true; render(); renderEnabled = false; G.state = st;
    }, [x, y, z, lx, ly, lz]);
    await page.screenshot({ path: path.join(DIR, `${name}.png`) });
    console.log(`image ${name}.png`);
  }
  if (errs.length) console.log('ERREURS', errs.join('\n'));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
