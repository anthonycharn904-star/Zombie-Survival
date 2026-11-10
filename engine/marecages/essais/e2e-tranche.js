'use strict';
/* Marécages Maudits : une section d'un essai E2 rejouée telle quelle dans la page du jeu, avec les clics et le clavier de
   Playwright (2 novembre 2026, accord d'Anthony : « Oui, tu peux continuer »). e2e-page.js ne rejoue que les blocs
   « game.evaluate » : les vérifications faites dans Node après des clics (écran Modèles de dogs et de zone-zombies) lui
   échappent. Ici, la page tient lieu de fenêtre du jeu du launcher (« game ») : mêmes appels (evaluate, waitForFunction,
   click, keyboard), même code d'essai, lu dans launcher/e2e au moment du jeu.
   - Jeu servi : launcher/game (préparé par prepare-game.js), comme pour mains.js.
   - Comme dans la méthode E2 : fenêtre de 1280 × 720, délai de 180 s (rendu logiciel), boucle du jeu active.
   - Chaque section part d'une page neuve, au menu. Pas de launcher : seules les sections qui partent du menu du jeu
     s'y prêtent.
   - Consigne zs-lourd : refus-souris.js (souris verrouillée refusée avant tout script du jeu, bandeau « Souris libre »
     masqué) ; la page est contrôlée avant chaque section, et rien ne tourne si le refus manque.
   À lancer par la file commune, jamais directement (e2e-comparer.sh --sections le fait) :

     ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "Marécages : e2e-sections" -- \
       node engine/marecages/essais/e2e-tranche.js DOSSIER essai[:marqueur] …

   La section va du commentaire « // ---… <marqueur> » (par défaut « écran Modèles ») jusqu'avant « if (errors.length) »,
   « } catch » ou la section suivante. Résultats : DOSSIER/<essai>/s01.json (vérifications) et journal.txt (lignes
   « ERREUR s01 … »), lus par e2e-bilan.py ; erreurs JavaScript de la page dans journal.txt. */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
require('./refus-souris');                     // avant playwright-core : chaque nouvelle page reçoit le refus
const REPO = path.join(__dirname, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const ROOT = path.join(REPO, 'launcher', 'game');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const [OUT, ...SPECS] = process.argv.slice(2);
if (!OUT || !SPECS.length) { console.error('usage : node e2e-tranche.js DOSSIER essai[:marqueur] …'); process.exit(2); }

function chromiumPath() {                      // comme mains.js
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

function section(essai, marqueur) {
  const L = fs.readFileSync(path.join(REPO, 'launcher', 'e2e', `${essai}.e2e.js`), 'utf8').split('\n');
  const debuts = L.flatMap((l, i) => (/^\s*\/\/ -{3,}/.test(l) && l.includes(marqueur) ? [i] : []));
  if (debuts.length !== 1) throw new Error(`${essai}.e2e.js : ${debuts.length} sections « ${marqueur} » (il en faut une)`);
  let fin = debuts[0] + 1;
  while (fin < L.length && !/^\s*(\/\/ -{3,}|if \(errors\.length\)|\} catch)/.test(L[fin])) fin++;
  return { lignes: `${debuts[0] + 1}-${fin}`, code: L.slice(debuts[0], fin).join('\n') };
}

(async () => {
  const t0 = Date.now();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = Object.assign({}, process.env); delete env.DISPLAY; delete env.WAYLAND_DISPLAY;
  const browser = await chromium.launch({ executablePath: chromiumPath(), env,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
  for (const spec of SPECS) {
    const [essai, marqueur = 'écran Modèles'] = spec.split(':');
    const dir = path.join(OUT, essai);
    fs.mkdirSync(dir, { recursive: true });
    const journal = [], res = [], errs = [];
    const note = (s) => { journal.push(s); console.log(`${essai} · ${s}`); };
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    try {
      const s = section(essai, marqueur);
      note(`section « ${marqueur} », lignes ${s.lignes} de ${essai}.e2e.js`);
      const t1 = Date.now();
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
      await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 400000, polling: 1000 });
      note(`menu en ${((Date.now() - t1) / 1000).toFixed(0)} s`);
      const refus = await page.evaluate(() => /refusée/.test(String(Element.prototype.requestPointerLock))
        && [...document.querySelectorAll('style')].some((st) => st.textContent.includes('#lockhint{display:none')));
      if (!refus) throw new Error('souris verrouillée non refusée ou bandeau visible : section non jouée');
      note('souris verrouillée refusée, bandeau « Souris libre » masqué');
      const t2 = Date.now();
      await new AsyncFunction('game', 'report', `'use strict';\n${s.code}`)(page, (r) => res.push({ ok: !!r.ok, label: r.label, extra: r.extra }));
      note(`section jouée en ${((Date.now() - t2) / 1000).toFixed(0)} s`);
    } catch (e) {
      journal.push(`ERREUR s01 ${String(e && e.message || e).split('\n')[0].slice(0, 400)}`);
      console.log(`${essai} · ERREUR ${String(e && e.message || e).slice(0, 2000)}`);
    }
    if (errs.length) journal.push('ERREURS DE LA PAGE', ...errs.slice(0, 30));
    fs.writeFileSync(path.join(dir, 's01.json'), JSON.stringify(res, null, 1));
    fs.writeFileSync(path.join(dir, 'journal.txt'), journal.join('\n') + '\n');
    const ok = res.filter((r) => r.ok).length;
    console.log(`${essai} : ${ok}/${res.length} vérifications · section « ${marqueur} »${errs.length ? ` · ${errs.length} erreur(s) de la page` : ''}`);
    for (const r of res.filter((x) => !x.ok)) console.log(`   ÉCHEC s01 ${r.label}  →  ${JSON.stringify(r.extra === undefined ? null : r.extra).slice(0, 600)}`);
    await page.close();
  }
  await browser.close(); server.close();
  console.log(`fini en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch((e) => { console.error(e); process.exit(1); });
