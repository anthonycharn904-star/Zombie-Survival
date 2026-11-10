'use strict';
/* Blocs « (await game.evaluate(() => { … })).forEach(report); » d'un essai de bout en bout, rejoués dans la page du jeu
   (Chromium sans tête, souris verrouillée refusée, bandeau #lockhint masqué), dans l'ordre, avec une pause de 2,5 s
   entre deux blocs (les attentes de l'essai, la fin de partie montrée après 1,6 s). Ne remplace pas la méthode E2 : ni launcher, ni Mod Tools.

     node engine/tools/banc-interface/essai-page.js <dossier> <essai>      ex. : … /tmp/ep menus

   LOURD : par la file commune (classe jeu) :
     ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "essai menus (page)" -- node engine/tools/banc-interface/essai-page.js <dossier> menus */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(REPO, 'launcher', 'game');
const [OUTARG, ESSAI] = process.argv.slice(2);
if (!OUTARG || !ESSAI) { console.error('usage : node engine/tools/banc-interface/essai-page.js <dossier> <essai>'); process.exit(2); }
const OUT = path.resolve(OUTARG);
if (OUT === path.resolve(REPO) || OUT.startsWith(path.resolve(REPO) + path.sep)) { console.error('le dossier de sortie doit être hors du dépôt'); process.exit(2); }
if (!(process.env.ZS_LOURD_CLASSE === 'jeu' && process.env.ZS_LOURD_PLACE && fs.existsSync(process.env.ZS_LOURD_PLACE))) {
  console.error('outil lourd : le lancer par la file commune (~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "…" -- node …)');
  process.exit(3);
}
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
fs.mkdirSync(OUT, { recursive: true });

/* Les blocs : de « (await game.evaluate(() => { » à la ligne « })).forEach(report); » de même retrait. */
function blocs(file) {
  const L = fs.readFileSync(file, 'utf8').split('\n'), out = [];
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(/^(\s*)\(await game\.evaluate\(\(\) => \{\s*$/);
    if (!m) continue;
    let j = i + 1;
    while (j < L.length && L[j] !== `${m[1]}})).forEach(report);`) j++;
    out.push(`(() => {\n${L.slice(i + 1, j).join('\n')}\n})()`);
    i = j;
  }
  return out;
}
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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  const B = blocs(path.join(REPO, 'launcher', 'e2e', `${ESSAI}.e2e.js`));
  if (!B.length) { console.error(`aucun bloc dans ${ESSAI}.e2e.js`); process.exit(2); }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(600000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = () => Promise.reject(new DOMException('refusée par l’essai', 'NotAllowedError'));
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#lockhint { display: none !important; }'; document.head.append(s); });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 900000, polling: 1000 });
  const res = [];
  for (const [i, b] of B.entries()) {
    try { res.push(...(await page.evaluate(b))); } catch (e) { res.push({ ok: false, label: `bloc ${i + 1} : erreur`, extra: String(e.message || e).slice(0, 300) }); }
    await new Promise((r) => setTimeout(r, 2500));
  }
  let echecs = 0;
  for (const r of res) { if (!r.ok) echecs++; console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`); }
  if (errs.length) { echecs++; console.log(`ÉCHEC  erreurs dans la page → ${JSON.stringify(errs.slice(0, 5))}`); }
  console.log(`${res.length - res.filter((r) => !r.ok).length} sur ${res.length} vérifications réussies, ${B.length} blocs.`);
  fs.writeFileSync(path.join(OUT, `${ESSAI}.json`), JSON.stringify({ res, errs }, null, 2));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
