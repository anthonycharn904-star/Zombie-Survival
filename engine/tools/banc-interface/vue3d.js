'use strict';
/* Banc de l'interface : la même vue du jeu en 2560 × 1440 (16:9), en 3440 × 1440 avec le champ de vision actuel et en
   3440 × 1440 avec le champ Hor+ simulé par le seul réglage (settings.fov = 106,69 en 21:9 donne le champ vertical
   d'un réglage de 90 en 16:9 : 58,72°). Aucun fichier du jeu n'est modifié.

     node engine/tools/banc-interface/vue3d.js <dossier> [--carte bunker7] [--forcer]

   LOURD : le jeu entier en rendu logiciel (SwiftShader), plusieurs minutes, environ 3 Go (estimation du 2 novembre
   2026 : une page du jeu, souris verrouillée refusée, plus les tampons en 3440 × 1440). Depuis le 2 novembre, il passe
   par la file commune des tâches lourdes (consigne d'Anthony) :
     ~/outils/bin/zs-lourd --classe jeu --memoire 4000 --nom "banc 3D : champ de vision" -- node engine/tools/banc-interface/vue3d.js <dossier>
   Sous la file (ZS_LOURD_CLASSE = jeu et sa fiche ZS_LOURD_PLACE présente), la file a déjà décidé du départ : la garde
   de charge ne joue pas (choix d'Anthony du 2 novembre 2026). Hors de la file, il refuse de partir si la machine est
   chargée (charge par fil > 0,5 ou moins de 3 Go disponibles) ; --forcer passe outre, seulement avec son accord.
   Pas encore lancé (2 novembre 2026). Il faut préparer le jeu d'abord (cd launcher && node scripts/prepare-game.js). */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(REPO, 'launcher', 'game');
const argv = process.argv.slice(2);
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage : node engine/tools/banc-interface/vue3d.js <dossier> [--carte bunker7] [--forcer]'); process.exit(2); }
const OUT = path.resolve(argv[0]);
// comme fabrique.py : rien n'est écrit dans le dépôt
if (OUT === path.resolve(REPO) || OUT.startsWith(path.resolve(REPO) + path.sep)) { console.error('le dossier de sortie doit être hors du dépôt (ex. : le dossier temporaire de la session)'); process.exit(2); }
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const CARTE = val('--carte', 'bunker7');

// garde de charge, hors de la file seulement : moyenne sur 1 minute rapportée au nombre de fils, mémoire disponible
const SOUS_FILE = process.env.ZS_LOURD_CLASSE === 'jeu' && !!process.env.ZS_LOURD_PLACE && fs.existsSync(process.env.ZS_LOURD_PLACE);
const parFil = os.loadavg()[0] / os.cpus().length;
const dispo = (() => { try { return Number(/MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) / 1048576; } catch (e) { return os.freemem() / 2 ** 30; } })();
if (!SOUS_FILE && (parFil > 0.5 || dispo < 3) && !argv.includes('--forcer')) {
  console.error(`machine chargée (charge ${parFil.toFixed(2)} par fil, ${dispo.toFixed(1)} Go disponibles) : banc 3D non lancé.`);
  console.error('Le lancer par la file commune : ~/outils/bin/zs-lourd --classe jeu --memoire 4000 --nom "…" -- node engine/tools/banc-interface/vue3d.js <dossier>.');
  process.exit(3);
}
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
fs.mkdirSync(OUT, { recursive: true });

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

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const vf169 = 2 * Math.atan(Math.tan(Math.PI / 4) / (16 / 9));                          // 58,72° en radians
const horPlus = (2 * Math.atan(Math.tan(vf169 / 2) * (3440 / 1440)) * 180) / Math.PI;   // 106,69°
const VUES = [
  { nom: '16x9-2560x1440', w: 2560, h: 1440, fov: 90 },
  { nom: '21x9-actuel-3440x1440', w: 3440, h: 1440, fov: 90 },
  { nom: '21x9-horplus-3440x1440', w: 3440, h: 1440, fov: horPlus },
];
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
  const page = await browser.newPage({ viewport: { width: VUES[0].w, height: VUES[0].h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // souris verrouillée refusée : accordée (startGame la demande), le Chromium sans tête boucle sur des « souris déplacée »
  // synthétiques et sa mémoire gonfle (incident du 1er novembre 2026)
  await page.addInitScript(() => { Element.prototype.requestPointerLock = () => Promise.reject(new DOMException('refusée par le banc', 'NotAllowedError')); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 900000, polling: 1000 });
  console.log(`menu en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.evaluate((carte) => {
    window.frame = function () {};                 // plus de boucle d'images : une image à la demande
    renderEnabled = false;
    __zs.map(carte); __zs.start(); __zs.god(true);
  }, CARTE);
  for (const v of VUES) {
    await page.setViewportSize({ width: v.w, height: v.h });
    const etat = await page.evaluate((fov) => {
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      onResize(); settings.fov = fov;
      __zs.step(90, 1 / 60);                         // 1,5 s simulée : le champ de vision rejoint sa cible, HUD à jour
      clearZombies();
      HUD.el.lockhint.hidden = true;                 // pas de verrouillage du pointeur dans le banc
      renderEnabled = true; render(); renderEnabled = false;
      return { fovVertical: camera.fov, aspect: camera.aspect, etat: G.state };
    }, v.fov);
    const f = `${CARTE}-${v.nom}.png`;
    await page.screenshot({ path: path.join(OUT, f), animations: 'disabled' });
    console.log('capture', f, JSON.stringify(etat));
  }
  if (errs.length) console.log('ERREURS', errs.join(' | '));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
