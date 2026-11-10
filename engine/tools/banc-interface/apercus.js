'use strict';
/* Aperçus vidéo des cartes (refonte de l'interface, phase C ; accord d'Anthony du 3 novembre 2026) : filme une
   carte dans le vrai jeu, image par image, caméra pilotée par des plans, temps du jeu piloté et hasard figé, puis
   encode la vidéo (VP9, muette, fondus entre les plans, boucle sans saut) et son affiche. Aucun fichier du jeu
   n'est modifié ; la caméra et le temps sont ceux du menu (lumières, faisceau de la boîte, ciel, terrain), sans
   joueur, sans HUD, sans zombies, sans secousse ni zoom, sans les coupures au hasard des lampes.

     node engine/tools/banc-interface/apercus.js <dossier> --carte bunker7 --plans <plans.json> [--essai] [--taille 1280x720] [--ips 24]

   <plans.json> : { "<carte>": [ { "nom", "de": { x, z, h }, "a": { x, z, h }, "vise": { x, z, h }, "vise2": { x, z, h }, "duree" } ] }
   (h : hauteur au-dessus du sol local ; la caméra va de « de » à « a » en « duree » secondes, en regardant « vise » puis « vise2 »).
   --essai : trois images par plan (début, milieu, fin) et une planche <carte>-essai.jpg, pour choisir les plans ;
   avec --png, ces images sont en PNG, sans perte (images fixes à retoucher, comme le fond du menu : le JPEG de la
   capture laisse des blocs de couleur dans les blancs saturés, que l'étalonnage fait ressortir).
   Sinon : toutes les images dans <dossier>/<carte>/, puis <dossier>/<carte>.webm et <dossier>/<carte>.jpg (affiche).

   LOURD : le jeu entier en rendu logiciel ; toujours par la file commune (consigne d'Anthony du 2 novembre 2026) :
     ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "aperçu …" -- node engine/tools/banc-interface/apercus.js …
   Souris verrouillée refusée. Il faut préparer le jeu d'abord (node launcher/scripts/prepare-game.js). */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(REPO, 'launcher', 'game');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
if (!argv[0] || argv[0].startsWith('--') || !val('--carte') || !val('--plans')) {
  console.error('usage : node engine/tools/banc-interface/apercus.js <dossier> --carte <id> --plans <plans.json> [--essai] [--taille 1280x720] [--ips 24]');
  process.exit(2);
}
const OUT = path.resolve(argv[0]);
if (OUT === path.resolve(REPO) || OUT.startsWith(path.resolve(REPO) + path.sep)) { console.error('le dossier de sortie doit être hors du dépôt'); process.exit(2); }
const CARTE = val('--carte'), ESSAI = argv.includes('--essai'), PNG = argv.includes('--png'), IPS = Number(val('--ips', 24));
const [W, H] = val('--taille', '1280x720').split('x').map(Number);
const PLANS = JSON.parse(fs.readFileSync(path.resolve(val('--plans')), 'utf8'))[CARTE];
if (!Array.isArray(PLANS) || !PLANS.length) { console.error(`aucun plan pour « ${CARTE} »`); process.exit(2); }
if (!(process.env.ZS_LOURD_CLASSE === 'jeu' && process.env.ZS_LOURD_PLACE && fs.existsSync(process.env.ZS_LOURD_PLACE))) {
  console.error('outil lourd : le lancer par la file commune (~/outils/bin/zs-lourd --classe jeu --memoire 3500 --nom "…" -- node …)');
  process.exit(3);
}
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
const DIR = path.join(OUT, CARTE);
fs.mkdirSync(DIR, { recursive: true });

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

/* Dans la page : caméra du plan à l'instant u (0 à 1), temps du menu avancé de dt, une image rendue et lue. */
function poser({ plan, u, dt, lire }) {
  const sol = (x, z) => (OW.on ? owGroundAt(0, x, z) : 0);
  const mix = (a, b, k) => a + (b - a) * k;
  const p = { x: mix(plan.de.x, plan.a.x, u), z: mix(plan.de.z, plan.a.z, u) };
  // hauteur : interpolée entre les deux extrémités (pas de tangage sur le relief), jamais sous 0,8 m du sol
  p.y = Math.max(mix(sol(plan.de.x, plan.de.z) + plan.de.h, sol(plan.a.x, plan.a.z) + plan.a.h, u), sol(p.x, p.z) + 0.8);
  const v2 = plan.vise2 || plan.vise;
  const l = { x: mix(plan.vise.x, v2.x, u), z: mix(plan.vise.z, v2.z, u) };
  l.y = mix(sol(plan.vise.x, plan.vise.z) + plan.vise.h, sol(v2.x, v2.z) + v2.h, u);
  camera.position.set(p.x, p.y, p.z);
  camera.lookAt(l.x, l.y, l.z);
  camera.updateMatrixWorld();
  // ce que la caméra du menu anime (menuCamera, sans son placement)
  G.menuT += dt;
  // lampes : le vacillement continu reste, les coupures au hasard sont retirées (une salle qui s'éteint trois
  // images, rejouée à chaque boucle, ferait un éclat ; Anthony a le vertige et veut peu de flashs)
  for (const L of World.lights) L.out = 0;
  const hasard = Math.random;
  Math.random = () => 1;
  updateLights(dt, G.menuT);
  Math.random = hasard;
  if (Features.box) Features.box.beam.material.opacity = 0.2 + Math.sin(G.menuT * 2.2) * 0.06;
  if (OW.on) owUpdateView(dt);
  renderEnabled = true; render(); renderEnabled = false;
  return lire === 'png' ? renderer.domElement.toDataURL('image/png') : lire ? renderer.domElement.toDataURL('image/jpeg', 0.92) : null;
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: chromiumPath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(600000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  await page.addInitScript(() => {
    // souris verrouillée refusée (incident du 1er novembre 2026) ; hasard figé (mêmes images d'une capture à l'autre)
    Element.prototype.requestPointerLock = () => Promise.reject(new DOMException('refusée par la capture', 'NotAllowedError'));
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#lockhint { display: none !important; }'; document.head.append(st); });
    let s = 0x2f6b1d3;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 900000, polling: 1000 });
  const ok = await page.evaluate((id) => {
    window.frame = function () {};                 // plus de boucle d'images : le temps est piloté par la capture
    renderEnabled = false;
    if (!MAPS.byId[id]) return false;
    __zs.map(id);
    showScreen(null);                              // seul le canevas est lu : aucun écran par-dessus
    return true;
  }, CARTE);
  if (!ok) { console.error(`carte inconnue : ${CARTE}`); process.exit(2); }
  console.log(`carte ${CARTE} chargée en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const ecrire = (f, data) => fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
  const dt = 1 / IPS;
  // mise en route de chaque plan : terrain fin autour du départ, shaders compilés, textures arrivées
  const preparer = async (plan) => {
    await page.evaluate((plan) => {
      camera.position.set(plan.de.x, 0, plan.de.z);
      if (OW.on) { owUpdateTerrainLod(true); owUpdateRoads(); }
    }, plan);
    for (let k = 0; k < 4; k++) { await page.evaluate(poser, { plan, u: 0, dt, lire: false }); await new Promise((r) => setTimeout(r, 400)); }
  };
  const bilan = { carte: CARTE, taille: `${W}x${H}`, ips: IPS, plans: [] };
  if (ESSAI) {
    const fichiers = [];
    for (const [i, plan] of PLANS.entries()) {
      await preparer(plan);
      for (const u of [0, 0.5, 1]) {
        const f = path.join(DIR, `essai-${i + 1}-${u}.${PNG ? 'png' : 'jpg'}`);
        ecrire(f, await page.evaluate(poser, { plan, u, dt, lire: PNG ? 'png' : true }));
        fichiers.push([`${i + 1}. ${plan.nom} (${u === 0 ? 'début' : u === 1 ? 'fin' : 'milieu'})`, f]);
      }
      console.log(`plan ${i + 1} : ${plan.nom}`);
    }
    const planche = path.join(OUT, `${CARTE}-essai.jpg`);
    execFileSync('montage', ['-font', 'DejaVu-Sans', '-pointsize', '15', '-fill', '#e8dfc8', '-background', '#111',
      ...fichiers.flatMap(([l, f]) => ['-label', l, f]), '-geometry', '640x360+6+6', '-tile', '3x', planche]);
    console.log(`planche ${planche}`);
  } else {
    for (const [i, plan] of PLANS.entries()) {
      await preparer(plan);
      const n = Math.max(2, Math.round((plan.duree || 4) * IPS));
      const d0 = Date.now();
      for (let k = 0; k < n; k++) {
        ecrire(path.join(DIR, `p${i + 1}-${String(k + 1).padStart(4, '0')}.jpg`), await page.evaluate(poser, { plan, u: k / (n - 1), dt, lire: true }));
      }
      const s = (Date.now() - d0) / 1000;
      bilan.plans.push({ nom: plan.nom, images: n, secondes: Math.round(s), parImage: +(s / n).toFixed(2) });
      console.log(`plan ${i + 1} : ${plan.nom}, ${n} images en ${s.toFixed(0)} s`);
    }
    encoder(bilan);
  }
  bilan.erreurs = errs;
  bilan.duree = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(OUT, `${CARTE}-bilan.json`), JSON.stringify(bilan, null, 2));
  if (errs.length) console.log('ERREURS', errs.join(' | '));
  console.log(`fini en ${bilan.duree} s`);
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });

/* Vidéo : les plans enchaînés par des fondus de F secondes ; le début du premier plan est rejoué en fondu à la fin,
   et la vidéo commence F secondes plus loin : la boucle reprend sans saut. Affiche : le milieu du premier plan. */
function encoder(bilan) {
  const F = 0.6, n = PLANS.length, L = PLANS.map((p) => Math.max(2, Math.round((p.duree || 4) * IPS)) / IPS);
  const ins = [], filtres = [];
  PLANS.forEach((p, i) => ins.push('-framerate', String(IPS), '-i', path.join(DIR, `p${i + 1}-%04d.jpg`)));
  filtres.push(`[0:v]split[s0a][s0b]`, `[s0a]trim=start=${F},setpts=PTS-STARTPTS[t0]`, `[s0b]trim=end=${F},setpts=PTS-STARTPTS[h0]`);
  let cur = '[t0]', len = L[0] - F;
  for (let i = 1; i < n; i++) {
    const out = `[x${i}]`;
    filtres.push(`${cur}[${i}:v]xfade=transition=fade:duration=${F}:offset=${(len - F).toFixed(3)}${out}`);
    cur = out; len += L[i] - F;
  }
  filtres.push(`${cur}[h0]xfade=transition=fade:duration=${F}:offset=${(len - F).toFixed(3)},format=yuv420p[v]`);
  const webm = path.join(OUT, `${CARTE}.webm`), jpg = path.join(OUT, `${CARTE}.jpg`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ins, '-filter_complex', filtres.join(';'), '-map', '[v]',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-cpu-used', '2', '-g', String(IPS * 2), '-an', webm]);
  const milieu = path.join(DIR, `p1-${String(Math.max(1, Math.round(L[0] * IPS / 2))).padStart(4, '0')}.jpg`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', milieu, '-q:v', '4', jpg]);
  bilan.video = { fichier: webm, octets: fs.statSync(webm).size, secondes: +len.toFixed(2) };
  bilan.affiche = { fichier: jpg, octets: fs.statSync(jpg).size };
  console.log(`vidéo ${webm} : ${(bilan.video.octets / 1048576).toFixed(2)} Mo, ${len.toFixed(1)} s ; affiche ${jpg}`);
}
