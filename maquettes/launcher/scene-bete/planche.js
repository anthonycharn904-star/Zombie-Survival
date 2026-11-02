'use strict';
/* Scène de la Mère-Vase : planche de contrôle des images capturées (une grille JPEG, numéro et instant sous chaque
   image). Avec deux dossiers, les deux versions côte à côte, image par image (avec et sans éclairs). Léger : rendu 2D
   dans le Chromium sans tête, aucun script du kit.

     node maquettes/launcher/scene-bete/planche.js <dossier> [<dossier 2>] [--n 12] [--images 1,30,60] [--colonnes 3]
                                                   [--largeur 480] [--fps 30] [--sortie <fichier .jpg>] */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const opts = new Set(['--n', '--images', '--colonnes', '--largeur', '--fps', '--sortie']);
const dossiers = argv.filter((a, i) => !a.startsWith('--') && !opts.has(argv[i - 1])).map((d) => path.resolve(d));
if (!dossiers.length || !dossiers.every((d) => fs.existsSync(d))) { console.error('usage : node planche.js <dossier> [<dossier 2>] [options]'); process.exit(2); }
const liste = fs.readdirSync(dossiers[0]).filter((f) => /^img_\d+\.(jpe?g|png)$/.test(f)).sort();
const N = +val('--n', 12), FPS = +val('--fps', 30), LARG = +val('--largeur', 480);
const choisies = val('--images', null) ? val('--images').split(',').map((x) => liste[+x - 1]).filter(Boolean)
  : Array.from({ length: Math.min(N, liste.length) }, (_, k) => liste[Math.round(k * (liste.length - 1) / Math.max(1, Math.min(N, liste.length) - 1))]);
const COL = +val('--colonnes', dossiers.length > 1 ? 2 : 3);
const SORTIE = path.resolve(val('--sortie', path.join(dossiers[0], '..', 'planche.jpg')));
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* pas de cache Playwright */ }
  return '/opt/pw-browsers/chromium';
}
// les images servies par la même origine que la page (un canevas qui dessine des fichiers locaux serait « sali »)
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><body style="margin:0"><canvas id="c"></canvas></body>'); return; }
  const m = /^\/(\d+)\/(img_\d+\.(?:jpe?g|png))$/.exec(u), p = m && path.join(dossiers[+m[1]], m[2]);
  if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': p.endsWith('.png') ? 'image/png' : 'image/jpeg' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const url = await page.evaluate(async ({ choisies, n, COL, LARG, FPS, noms }) => {
    const charger = (src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = src; });
    const cases = [];
    for (const f of choisies) for (let d = 0; d < n; d++) cases.push({ f, d, im: await charger(`/${d}/${f}`) });
    const h = Math.round(LARG * cases[0].im.naturalHeight / cases[0].im.naturalWidth), leg = 22, m = 6;
    const lignes = Math.ceil(cases.length / COL), c = document.getElementById('c');
    c.width = COL * (LARG + m) + m; c.height = lignes * (h + leg + m) + m;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0d0c'; g.fillRect(0, 0, c.width, c.height);
    g.font = '13px sans-serif'; g.textBaseline = 'middle';
    cases.forEach((k, i) => {
      const x = m + (i % COL) * (LARG + m), y = m + Math.floor(i / COL) * (h + leg + m), num = +k.f.match(/\d+/)[0];
      g.drawImage(k.im, x, y, LARG, h);
      g.fillStyle = '#c9c2a8';
      g.fillText(`${noms[k.d]}image ${num} · ${((num - 1) / FPS).toFixed(2)} s`, x + 4, y + h + leg / 2);
    });
    return c.toDataURL('image/jpeg', 0.88);
  }, { choisies, n: dossiers.length, COL, LARG, FPS, noms: dossiers.length > 1 ? dossiers.map((d) => path.basename(d) + ' · ') : [''] });
  fs.writeFileSync(SORTIE, Buffer.from(url.split(',')[1], 'base64'));
  await browser.close(); server.close();
  console.log(`${path.basename(SORTIE)} : ${choisies.length} images × ${dossiers.length} dossier(s), ${(fs.statSync(SORTIE).size / 1024).toFixed(0)} Ko`);
})().catch((e) => { console.error(e); process.exit(1); });
