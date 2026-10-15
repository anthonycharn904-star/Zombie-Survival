'use strict';
/* Planches du khépesh en partie (vue du joueur) : node khepshot.js <dossier> */
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
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 180000 });
  const info = await page.evaluate(async () => {
    window.frame = function () {}; renderEnabled = false; settings.quality = 'medium';
    __zs.map('khamsin'); __zs.start(); __zs.god(true);
    if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
    G.roundState = 'pre'; G.roundT = 1e9; clearZombies(); HUD.el.hud.hidden = true;
    window.__run = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { update(1 / 60); endFrameInput(); } };
    window.__mk = (dist, ang, hp) => {
      const a = player.yaw - ang, fx = -Math.sin(a), fz = -Math.cos(a);
      const x = player.pos.x + fx * dist, z = player.pos.z + fz * dist, gy = owGroundAt(0, x, z);
      const zb = spawnZombie({ riser: true, x, z, y: gy, li: 0, k: owLocate(x, z, gy), layer: 0, zone: 0 }, hp);
      zb.state = 'chase'; zb.t = 0; zb.pos.set(x, gy, z); zb.gy = gy; zb.speed = 0.0001; zb.hp = zb.maxHp = hp;
      zb.yaw = Math.atan2(player.pos.x - x, player.pos.z - z);
      return zb;
    };
    window.__draw = () => { renderEnabled = true; render(); renderEnabled = false; };
    __zs.tp(2160, 1480, 0.6); player.pitch = -0.08; __run(0.5);
    return { gy: player.gy };
  });
  console.log(JSON.stringify(info));
  const seq = async (name, setup, times) => {
    await page.evaluate(setup);
    let t = 0;
    for (const at of times) {
      await page.evaluate((dt) => { __run(dt); __draw(); }, at - t); t = at;
      await page.screenshot({ path: path.join(DIR, `${name}-${String(Math.round(at * 1000)).padStart(4, '0')}.png`) });
    }
  };
  // touché : trois zombies dans l'arc
  await seq('touche', () => {
    Khepesh.annuler(); Arms.state = 'idle'; clearZombies(); __run(0.2);
    __mk(1.35, 0, 5000); __mk(1.8, 0.45, 5000); __mk(2.1, -0.4, 5000);
    __run(0.3);
    Input.keys.KeyV = true; Input.down.KeyV = true; update(1 / 60); endFrameInput(); Input.keys.KeyV = false;
  }, [0.10, 0.20, 0.27, 0.31, 0.36, 0.45, 0.55, 0.66, 0.80, 1.00, 1.6, 3.0]);
  // raté : personne
  await seq('rate', () => {
    Khepesh.annuler(); Arms.state = 'idle'; clearZombies(); __run(0.2);
    Input.keys.KeyV = true; Input.down.KeyV = true; update(1 / 60); endFrameInput(); Input.keys.KeyV = false;
  }, [0.18, 0.30, 0.40, 0.50, 0.62, 0.75, 0.90, 1.05]);
  if (errs.length) console.log('ERREURS\n' + errs.join('\n'));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
