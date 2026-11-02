'use strict';
/* Banc d'essai des mains (jeu 2.0.6) : images et mesures de la prise des armes, dans Chromium sans tête
   (rendu logiciel). Il fonctionne aussi dans le bac à sable de Claude Code : il prend le Chromium « sans
   tête » de Playwright et retire DISPLAY et WAYLAND_DISPLAY (sinon WebGL manque sous WSL).

     node engine/tools/mains.js <dossier> [--armes stg44,mp40] [--main] [--vues] [--recharge] [--tir] [--mesures]
                                          [--avant f.js] [--script f.js]

   --main      la main seule dans ses poses, repères anatomiques marqués (main.png)
   --vues      par arme : vue du joueur et cinq vues de chaque main (vues-<arme>.png)
   --pouces    par arme : vues rapprochées de chaque pouce (côté du pouce, dessus, dessous, bout ; puis
               l'arme cachée : côté, paume, bout ; repère de la main, donc les mêmes pour les deux mains)
               (pouces-<arme>.png)
   --recharge  par arme : rechargement tactique et à vide, image par image (recharge-<arme>[-vide].png)
   --tir       par arme : rafale de tir, index et détente (tir-<arme>.png)
   --mesures   par arme : pénétrations, contacts, articulations, poignets (mesures.json)
   --avant     script exécuté avant tout le reste (corps de fonction async : essai d'une modification)
   --script    script exécuté à la fin (corps de fonction async ; rend { shots: [{ name, url }], data })
   Sans option : --vues --mesures. Il faut préparer le jeu d'abord (cd launcher && node scripts/prepare-game.js). */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const ROOT = path.join(REPO, 'launcher', 'game');

const argv = process.argv.slice(2);
const OUT = argv[0];
if (!OUT || OUT.startsWith('--')) { console.error('usage : node engine/tools/mains.js <dossier> [options]'); process.exit(2); }
const opt = (n) => argv.includes(n);
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const all = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
const jobs = { main: opt('--main'), vues: opt('--vues'), pouces: opt('--pouces'), recharge: opt('--recharge'), tir: opt('--tir'), mesures: opt('--mesures') };
if (!Object.values(jobs).some(Boolean) && !all('--script').length) jobs.vues = jobs.mesures = true;
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

/* ------------------------------------------------------------- aides injectées dans la page */
const HELPERS = `
window.HS = (function () {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const H = {};
  H.begin = function () {
    if (G.state !== 'playing') __zs.start();
    __zs.god(true);
    if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
    G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9;
    clearZombies();
  };
  H.give = function (id, tier = 0, n = 60) { __zs.give(id, tier); Input.rmb = false; Input.lmb = false; __zs.step(n, 1 / 60); };
  const grab = () => renderer.domElement.toDataURL('image/png');
  H.size = function (w, h) { renderer.setSize(w, h, false); renderer.setPixelRatio(1); };
  H.fps = function (w = 960, h = 540) {
    H.size(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
    renderEnabled = true; render(); renderEnabled = false;
    return grab();
  };
  // caméra libre dans la scène de la vue : fond neutre, lampe frontale
  const oc = new THREE.PerspectiveCamera(30, 1, 0.005, 10);
  const lamp = new THREE.DirectionalLight(0xffffff, 0.9), fill = new THREE.AmbientLight(0xffffff, 0.35);
  H.orbitDir = function (t, dir, dist, w = 360, h = 360, fov = 30) {
    H.size(w, h);
    oc.fov = fov; oc.aspect = w / h; oc.updateProjectionMatrix();
    oc.position.copy(t).addScaledVector(dir.clone().normalize(), dist); oc.lookAt(t);
    lamp.position.copy(oc.position).add(V(0.2, 0.4, 0)); lamp.target.position.copy(t);
    vmScene.add(lamp, lamp.target, fill);
    const bg = vmScene.background; vmScene.background = new THREE.Color(0x6a7078);
    renderer.clear(); renderer.render(vmScene, oc);
    const u = grab();
    vmScene.background = bg; vmScene.remove(lamp, lamp.target, fill);
    return u;
  };
  H.handC = function (left) { const a = left ? Arms.armL : Arms.armR; a.hand.body.updateMatrixWorld(true); return a.hand.body.localToWorld(V(0, -0.01, -0.05)); };
  // vues d'une main dans le repère de l'arme
  H.handViews = function (left, dist = 0.3, size = 360) {
    const c = H.handC(left), gq = new THREE.Quaternion(); Arms.gun.getWorldQuaternion(gq);
    const dirs = { gauche: [-1, 0.15, 0.1], droite: [1, 0.15, 0.1], dessous: [0.15, -1, 0.2], avant: [0.1, 0.05, -1], arrière: [0.25, 0.5, 1] };
    return Object.entries(dirs).map(([n, d]) => ({ label: (left ? 'G ' : 'D ') + n, url: H.orbitDir(c, V(...d).normalize().applyQuaternion(gq), dist, size, size) }));
  };
  H.montage = async function (items, cols, cw, ch) {
    const rows = Math.ceil(items.length / cols), c = document.createElement('canvas');
    c.width = cols * cw; c.height = rows * ch;
    const g = c.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < items.length; i++) {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = items[i].url; });
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, s = Math.min(cw / im.width, ch / im.height);
      g.drawImage(im, x + (cw - im.width * s) / 2, y + (ch - im.height * s) / 2, im.width * s, im.height * s);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, cw, 22);
      g.fillStyle = '#ffe'; g.font = '15px sans-serif'; g.fillText(items[i].label || '', x + 6, y + 16);
      g.strokeStyle = '#000'; g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    }
    return c.toDataURL('image/png');
  };
  return H;
})();`;

/* --------------------------------------------------------------------------- travaux */
const JOB = {
  main: `
HS.begin(); HS.give('m1911', 0, 20);
Arms.root.visible = false;
const hand = buildHand(false), holder = new THREE.Group();
holder.add(hand.wrist); vmScene.add(holder); holder.position.set(0, 0, -0.5);
const cols = { web: 0xff0000, palm: 0x00ff00, heel: 0x0000ff, mcpI: 0xffff00, mcpM: 0xff00ff, mcpL: 0x00ffff };
const REP = typeof PR_REP !== 'undefined' ? PR_REP : {};
for (const [k, c] of Object.entries(cols)) if (REP[k]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.position.fromArray(REP[k]); m.renderOrder = 10; hand.body.add(m); }
const views = { paume: [0, -1, 0.001], dos: [0, 1, 0.001], 'côté pouce': [-1, 0, 0], 'côté auriculaire': [1, 0, 0], 'bout des doigts': [0, 0.2, -1] };
const items = [];
for (const pose of (window.MAINS_POSES || ['open', 'relax', 'fist', 'pistol', 'pinch', 'mag'])) {
  setHandPose(hand, HAND_POSES[pose]); holder.updateMatrixWorld(true);
  for (const [n, d] of Object.entries(views)) items.push({ label: pose + ' · ' + n, url: HS.orbitDir(new THREE.Vector3(0, 0, -0.55), new THREE.Vector3(...d).normalize(), 0.42, 280, 280) });
}
vmScene.remove(holder); Arms.root.visible = true;
return { shots: [{ name: 'main', url: await HS.montage(items, 5, 280, 280) }] };`,
  pouces: `
HS.begin();
const shots = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
for (const id of ARMES) {
  HS.give(id, 0, 90);
  const items = [{ label: id + ' · vue du joueur', url: HS.fps(480, 270) }];
  for (const arm of [Arms.armR, Arms.armL]) {
    if (!arm.root.visible) continue;
    const h = arm.hand, q = new THREE.Quaternion(); h.wrist.updateMatrixWorld(true); h.wrist.getWorldQuaternion(q);
    const T = HAND.thumb, c = h.thumb[1].getWorldPosition(V()).lerp(h.thumb[2].localToWorld(V(0, 0, -T.L[2])), 0.4), s = arm.left ? 1 : -1, S = arm.left ? 'G ' : 'D ';
    const view = (n, d, hide) => { if (hide) Arms.gun.visible = false; const u = HS.orbitDir(c, V(...d).normalize().applyQuaternion(q), 0.24, 270, 270); Arms.gun.visible = true; return { label: S + n, url: u }; };
    items.push(view('côté du pouce', [s, 0.3, 0.15]), view('dessus', [s * 0.3, 1, 0.3]), view('dessous', [s * 0.3, -1, 0.3]), view('bout', [s * 0.3, 0.2, -1]));
    items.push(view('pouce seul · côté', [s, 0.3, 0.15], true), view('pouce seul · paume', [-s * 0.3, -1, -0.1], true), view('pouce seul · bout', [s * 0.3, 0.2, -1], true));
  }
  shots.push({ name: 'pouces-' + id, url: await HS.montage(items, 4, 270, 270) });
}
return { shots };`,
  vues: `
HS.begin();
const shots = [];
for (const id of ARMES) {
  HS.give(id, 0, 90);
  const items = [{ label: id + ' · vue du joueur', url: HS.fps(720, 405) }, ...HS.handViews(false)];
  if (Arms.armL.root.visible) items.push(...HS.handViews(true));
  shots.push({ name: 'vues-' + id, url: await HS.montage(items, 4, 360, 360) });
}
return { shots };`,
  recharge: `
HS.begin();
const shots = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
for (const id of ARMES) for (const empty of [false, true]) {
  HS.give(id, 0, 60);
  const s = curSlot(); if (!empty && wstat(s, 'mag') < 2) continue;
  s.mag = empty ? 0 : 1; s.res = 999; __zs.step(5);
  startReload();
  const items = [], dur = Arms.dur, N = 16;
  for (let i = 0; i < N; i++) {
    const tt = (dur * i) / (N - 1);
    while (Arms.state === 'reload' && Arms.t < tt) __zs.step(1, 1 / 60);
    if (i % 2 === 0) items.push({ label: id + ' t=' + Arms.t.toFixed(2) + ' joueur', url: HS.fps(480, 270) });
    else items.push({ label: id + ' t=' + Arms.t.toFixed(2) + ' côté', url: HS.orbitDir(V(0.02, -0.16, -0.42), V(-0.95, -0.15, 0.32), 0.85, 480, 270, 40) });
  }
  shots.push({ name: 'recharge-' + id + (empty ? '-vide' : ''), url: await HS.montage(items, 4, 480, 270) });
}
return { shots };`,
  tir: `
HS.begin();
const shots = [];
for (const id of ARMES) {
  HS.give(id, 0, 60);
  const s = curSlot(); s.mag = wstat(s, 'mag'); s.res = 999;
  const items = [];
  Input.lmb = true; Input.lmbDown = true;
  for (let i = 0; i < 8; i++) {
    __zs.step(1, 1 / 60); Input.lmbDown = false;
    const g = Arms.gun, gq = new THREE.Quaternion(); g.updateMatrixWorld(true); g.getWorldQuaternion(gq);
    const tp = triggerPoint(g, g.userData), c = tp ? tp.clone().applyMatrix4(g.matrixWorld) : HS.handC(false);
    const url = HS.orbitDir(c, new THREE.Vector3(0.75, -0.3, -0.6).normalize().applyQuaternion(gq), 0.2, 300, 300);
    items.push({ label: id + ' ' + (i * 1000 / 60).toFixed(0) + ' ms · détente ' + (Arms.trigK || 0).toFixed(2), url });
    if (i % 2) __zs.step(2, 1 / 60);
  }
  Input.lmb = false;
  shots.push({ name: 'tir-' + id, url: await HS.montage(items, 4, 300, 300) });
}
return { shots };`,
  mesures: `
HS.begin();
const data = {}, D = 180 / Math.PI;
for (const id of ARMES) {
  HS.give(id, 0, 90);
  const g = Arms.gun, hold = gunHold(g), out = { fit: hold.fit || null };
  if (typeof prMeasureHold === 'function') out.mesures = prMeasureHold(g, hold);
  const wr = {};
  for (const arm of [Arms.armR, Arms.armL]) {
    if (!arm.root.visible) continue;
    const w = arm.hand.wrist; w.updateMatrixWorld(true);
    const fa = w.position.clone().sub(arm.elbow.position).normalize(), q = w.quaternion;
    const z = new THREE.Vector3(0, 0, -1).applyQuaternion(q), y = new THREE.Vector3(0, 1, 0).applyQuaternion(q), x = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    wr[arm.left ? 'G' : 'D'] = { pli: Math.round(Math.atan2(-fa.dot(y), fa.dot(z)) * D), incl: Math.round(Math.atan2(arm.left ? -fa.dot(x) : fa.dot(x), fa.dot(z)) * D) };
  }
  out.poignets = wr;
  data[id] = out;
}
return { data };`,
};

(async () => {
  const t0 = Date.now();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = Object.assign({}, process.env); delete env.DISPLAY; delete env.WAYLAND_DISPLAY;
  const browser = await chromium.launch({ executablePath: chromiumPath(), env, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 400000, polling: 1000 });
  console.log(`menu en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; });
  // Chromium sans tête : la souris verrouillée (pointer lock, demandée par le jeu à chaque partie) y boucle sur des
  // évènements de souris synthétiques (processus du navigateur à plus d'un cœur, mémoire qui gonfle de 40 Mo/s jusqu'à
  // l'arrêt du système sur un long essai). Le banc la refuse : le jeu passe en souris libre, comme quand un navigateur
  // refuse le verrou.
  await page.evaluate(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new DOMException('banc sans tête : souris non verrouillée', 'NotSupportedError')); }; });
  await page.evaluate(HELPERS);
  const armes = val('--armes') ? val('--armes').split(',') : null;
  await page.evaluate((a) => { window.ARMES = a || Object.keys(WEAPONS); }, armes);
  const run = async (name, body) => {
    const t1 = Date.now();
    try {
      const r = await page.evaluate(`(async () => {\n${body}\n})()`);
      for (const s of (r && r.shots) || []) fs.writeFileSync(path.join(OUT, s.name + '.png'), Buffer.from(s.url.split(',')[1], 'base64'));
      if (r && r.data !== undefined) fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(r.data, null, 1));
      console.log(`${name} : ${((r && r.shots) || []).length} image(s) en ${((Date.now() - t1) / 1000).toFixed(0)} s`);
      if (r && r.data !== undefined && opt('--bavard')) console.log(JSON.stringify(r.data).slice(0, 6000));
    } catch (e) { console.log('ERREUR', name, e.message.slice(0, 3000)); }
  };
  for (const f of all('--avant')) await run(path.basename(f, '.js'), fs.readFileSync(f, 'utf8'));
  for (const [k, on] of Object.entries(jobs)) if (on) await run(k, JOB[k]);
  for (const f of all('--script')) await run(path.basename(f, '.js'), fs.readFileSync(f, 'utf8'));
  if (errs.length) console.log('ERREURS DE LA PAGE\n' + errs.slice(0, 30).join('\n'));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
