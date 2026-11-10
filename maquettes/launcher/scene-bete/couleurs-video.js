'use strict';
/* Couleurs d'une vidéo telles que Chromium les rend (le moteur du launcher) : pour quelques images pures de la boucle,
   l'image de la vidéo dessinée dans un canevas est comparée à l'image source, décodée par Chromium lui-même.
     node maquettes/launcher/scene-bete/couleurs-video.js <dossier img_*.jpg> <video.webm> [--fps 30] [--fondu 1] [--images 40,90,…]
   Pour chaque image : la source la plus proche parmi i−3…i+3 (une vidéo au rythme irrégulier montre parfois une
   voisine), PSNR, biais moyen par canal, biais de luminance dans les zones sombres (luminance de la source < 50). */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const DOSSIER = path.resolve(argv[0]), VIDEO = path.resolve(argv[1]);
const FPS = +val('--fps', 30), M = Math.round(+val('--fondu', 1) * FPS);
const images = fs.readdirSync(DOSSIER).filter((f) => /^img_\d+\.(jpe?g|png)$/.test(f)).sort();
const L = images.length - M;
const choix = val('--images', null) ? val('--images').split(',').map(Number) : [40, 90, 140, 190, 240, 290, L - 8].filter((i) => i >= M + 3 && i < L - 3);
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('headless_shell introuvable');
}
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><body style="margin:0"></body>'); return; }
  const p = u === '/video.webm' ? VIDEO : path.join(DOSSIER, path.basename(u));
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  const taille = fs.statSync(p).size, plage = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  const type = p.endsWith('.webm') ? 'video/webm' : 'image/jpeg';
  if (plage) {                                         // le lecteur vidéo demande des plages
    const a = +plage[1], b = plage[2] ? +plage[2] : taille - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${taille}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    fs.createReadStream(p, { start: a, end: b }).pipe(res);
  } else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes' }); fs.createReadStream(p).pipe(res); }
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const res = await page.evaluate(async ({ choix, images, FPS }) => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = '/video.webm';
    document.body.appendChild(v);
    await new Promise((ok, ko) => { v.onloadeddata = ok; v.onerror = () => ko(new Error('vidéo illisible')); });
    const W = v.videoWidth, H = v.videoHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const pixels = (src) => { g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
    const charger = (src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = src; });
    const sortie = [];
    for (const i of choix) {
      v.currentTime = (i + 0.5) / FPS;
      await new Promise((ok) => { v.onseeked = ok; });
      await new Promise((ok) => setTimeout(ok, 150));
      const pv = pixels(v);
      let best = null;
      for (let k = i - 3; k <= i + 3; k++) {
        const ps = pixels(await charger('/' + images[k]));
        let se = 0, b = [0, 0, 0], sb = 0, ns = 0;
        for (let p = 0; p < pv.length; p += 4) {
          for (let ch = 0; ch < 3; ch++) { const d = pv[p + ch] - ps[p + ch]; se += d * d; b[ch] += d; }
          const ys = 0.299 * ps[p] + 0.587 * ps[p + 1] + 0.114 * ps[p + 2];
          if (ys < 50) { sb += 0.299 * (pv[p] - ps[p]) + 0.587 * (pv[p + 1] - ps[p + 1]) + 0.114 * (pv[p + 2] - ps[p + 2]); ns++; }
        }
        const n = pv.length / 4, mse = se / (3 * n);
        const r = { image: i, source: k, psnr: +(10 * Math.log10(255 * 255 / mse)).toFixed(2), biais: b.map((x) => +(x / n).toFixed(3)), biaisSombre: +(sb / ns).toFixed(3), partSombre: +(ns / n).toFixed(3) };
        if (!best || r.psnr > best.psnr) best = r;
      }
      sortie.push(best);
    }
    return { W, H, duree: v.duration, sortie };
  }, { choix, images, FPS });
  await browser.close(); server.close();
  const moy = (f) => +(res.sortie.reduce((s, x) => s + f(x), 0) / res.sortie.length).toFixed(3);
  console.log(JSON.stringify({ video: VIDEO, W: res.W, H: res.H, duree: res.duree, images: res.sortie,
    moyenne: { psnr: moy((x) => x.psnr), biais: [0, 1, 2].map((c) => moy((x) => x.biais[c])), biaisSombre: moy((x) => x.biaisSombre) },
    decalees: res.sortie.filter((x) => x.source !== x.image).map((x) => `${x.image}→${x.source}`), erreurs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
