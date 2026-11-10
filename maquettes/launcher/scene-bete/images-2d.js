'use strict';
/* Essai de la chaîne vidéo sans le kit : une suite d'images tirée du fond 2D actuel de la maquette D (marais.js et la
   capture retenue), pour essayer encoder.js et le lecteur vidéo de D avant la vraie capture. Léger (2D).
     node maquettes/launcher/scene-bete/images-2d.js [--duree 12] [--largeur 1600] [--hauteur 620]
   Sortie : scene-bete/sortie/essai-2d/images/ (hors de Git). */
const path = require('path'), fs = require('fs'), os = require('os');
const ICI = __dirname, REPO = path.join(ICI, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const DUREE = +val('--duree', 12), W = +val('--largeur', 1600), H = +val('--hauteur', 620), FPS = 30;
const IMG = path.join(ICI, '..', 'ressources', 'marecages', '13_la_mere_vase_se_jette_sur_un_noye.jpg');
const OUT = path.join(ICI, 'sortie', 'essai-2d', 'images');
if (!fs.existsSync(IMG)) { console.error('capture retenue absente : ' + IMG); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
    if (fs.existsSync(p)) return p;
  }
  return '/opt/pw-browsers/chromium';
}
(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const img = 'data:image/jpeg;base64,' + fs.readFileSync(IMG).toString('base64');
  await page.setContent(`<!doctype html><body style="margin:0;background:#000"><img id="i" src="${img}" hidden><canvas id="c" style="display:block;width:${W}px;height:${H}px"></canvas></body>`);
  await page.addScriptTag({ path: path.join(ICI, '..', 'D-hybride', 'marais.js') });
  await page.evaluate(async () => { const im = document.getElementById('i'); await im.decode(); window.S = Marais.create(document.getElementById('c'), im); });
  const n = Math.round(DUREE * FPS);
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(([t, dt]) => { S.pas(t, dt); return document.getElementById('c').toDataURL('image/jpeg', 0.9); }, [i / FPS, 1 / FPS]);
    fs.writeFileSync(path.join(OUT, `img_${String(i + 1).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log(`${n} images de ${W} × ${H} dans ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
