'use strict';
/* Banc de l'interface : captures et mesures de la couche HUD, du schéma du champ de vision et des planches, dans le
   Chromium « sans tête » de Playwright, sans WebGL (rendu 2D seulement : léger).

     python3 engine/tools/banc-interface/fabrique.py <dossier>
     node engine/tools/banc-interface/capture.js <dossier>

   Écrit dans <dossier>/captures/ : les captures des variantes, mesures.json, schema-fov.png, planche-hud.png,
   planche-echelle.png et comparaison-apercu.png (contrôle de la page interactive). Retire DISPLAY et WAYLAND_DISPLAY
   et prend seul le Chromium de Playwright (ZS_CHROMIUM pour en imposer un). */
const path = require('path'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
if (!process.argv[2] || process.argv[2].startsWith('--')) { console.error('usage : node engine/tools/banc-interface/capture.js <dossier>'); process.exit(2); }
const OUT = path.resolve(process.argv[2]);                 // un dossier relatif deviendrait le nom d'hôte de l'adresse file://
if (!fs.existsSync(path.join(OUT, 'hud.html'))) { console.error('pages absentes : lancer d’abord fabrique.py ' + OUT); process.exit(2); }
const CAP = path.join(OUT, 'captures');
fs.mkdirSync(CAP, { recursive: true });
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

const T = { '1280x720': [1280, 720], '1920x1080': [1920, 1080], '2560x1440': [2560, 1440], '3840x2160': [3840, 2160], '3440x1440': [3440, 1440] };
const P = { actuel: { zone: 'plein', echelle: 'actuelle' }, p1: { zone: '16:9', echelle: 'actuelle' }, p2: { zone: 'plein', echelle: 'unique' }, p12: { zone: '16:9', echelle: 'unique' } };
const CAS = [
  ['actuel', 'bunker', '1920x1080'], ['actuel', 'bunker', '2560x1440'], ['actuel', 'khamsin', '2560x1440'],
  ['actuel', 'khamsin', '3440x1440'], ['p1', 'khamsin', '3440x1440'], ['p2', 'khamsin', '3440x1440'], ['p12', 'khamsin', '3440x1440'],
  ['p12', 'bunker', '3440x1440', { boss: true }, 'p12-boss-bunker-3440x1440'],
  ['actuel', 'bunker', '1280x720'], ['actuel', 'bunker', '3840x2160'],
  ['p2', 'bunker', '1280x720'], ['p2', 'bunker', '1920x1080'], ['p2', 'bunker', '2560x1440'], ['p2', 'bunker', '3840x2160'],
];
const NOMS = { actuel: 'HUD actuel', p1: 'Proposition 1 · zone 16:9', p2: 'Proposition 2 · échelle unique', p12: 'Propositions 1 et 2' };

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  const mesures = {};
  const attendrePolices = async (page) => page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  for (const [v, sc, t, extra, nomFichier] of CAS) {
    const [W, H] = T[t];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('file://' + path.join(OUT, 'hud.html'));
    const etiquette = `${NOMS[v]}\n${W} × ${H}${t === '3440x1440' ? ' (21:9)' : ' (16:9)'}`;
    await page.evaluate((cfg) => appliquer(cfg), Object.assign({ scene: sc, cadre: t === '3440x1440', etiquette }, P[v], extra || {}));
    await attendrePolices(page);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const nom = nomFichier || `${v}-${sc}-${t}`;
    await page.screenshot({ path: path.join(CAP, nom + '.png'), animations: 'disabled' });
    mesures[nom] = await page.evaluate(() => mesurer());
    if (errs.length) console.log('ERREURS', nom, errs.join(' | '));
    await page.close();
  }
  fs.writeFileSync(path.join(CAP, 'mesures.json'), JSON.stringify(mesures, null, 1));
  // schéma et planches (pages fabriquées par fabrique.py, qui citent les captures ci-dessus)
  for (const [src, png] of [['schema-fov.html', 'schema-fov.png'], ['planche-hud.html', 'planche-hud.png'], ['planche-echelle.html', 'planche-echelle.png']]) {
    const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
    await page.goto('file://' + path.join(OUT, src));
    await attendrePolices(page);
    await page.screenshot({ path: path.join(CAP, png), fullPage: true, animations: 'disabled' });
    await page.close();
  }
  // contrôle de la page interactive : « les deux », écran 3440 × 1440 simulé, distances et boss
  const page = await browser.newPage({ viewport: { width: 1720, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.join(OUT, 'comparaison-hud.html'));
  await page.waitForFunction(() => /×/.test(document.getElementById('info').textContent), null, { timeout: 30000 });
  await page.keyboard.press('4');
  await page.selectOption('#c-ecran', '3440x1440');
  for (const id of ['#c-cadre', '#c-mesures', '#c-boss']) await page.check(id);
  await page.waitForFunction(() => /3\D?440/.test(document.getElementById('info').textContent), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(CAP, 'comparaison-apercu.png') });
  const infoTexte = await page.textContent('#info');
  if (errs.length) console.log('ERREURS comparaison', errs.join(' | '));
  await browser.close();
  console.log(`${CAS.length} captures, schéma, 2 planches et l'aperçu de la page interactive en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('page interactive :', infoTexte);
})().catch((e) => { console.error(e); process.exit(1); });
