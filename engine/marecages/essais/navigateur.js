'use strict';
/* Marécages Maudits : essais du jeu dans un Chromium sans tête (2 novembre 2026 ; option (a) choisie par Anthony).
   Sans dépendance : le protocole de débogage de Chromium passe par deux tubes (--remote-debugging-pipe), sans socket ;
   le jeu est emballé comme le fait le launcher (launcher/src/main/gamepack.js, réutilisé tel quel) et servi en local.
   Règles du 2 novembre 2026 (consigne zs-lourd, règle 5 et son complément) : la souris verrouillée est refusée avant
   le chargement du jeu (il passe en souris libre, sans pause), le bandeau « Souris libre » est masqué dès le menu.
   À lancer par la file commune, jamais directement :

     ~/outils/bin/zs-lourd --classe jeu --memoire 3000 --nom "Marécages : essais en navigateur" -- \
       node engine/marecages/essais/navigateur.js JEU.html DOSSIER [--vue 640x360] [--images 54] [--etapes …]

   Étapes (toutes par défaut) : menu (la carte au menu), global (rien d'installé au chargement du jeu), charger (une
   partie dans le marais), confort (secousses), diag (F8, Maj+F8), eclairs (lumière mesurée à l'écran pendant un
   éclair au sol : comme le kit, « limités », « réduits »), autres (Bunker 7 et Khamsin après le marais).
   Écrit dans DOSSIER : resultats.json, rapport.md, journal.txt, des images JPEG. Ne touche ni au dépôt ni au jeu installé.
   Mesuré le 2 novembre 2026 (640 × 360, toutes les étapes) : 3 min 29 s, 2,1 Go au plus : déclarer 3 000 Mo. */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), vm = require('vm');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const JEU = args[0], OUT = args[1];
if (!JEU || !OUT || JEU.startsWith('--')) { console.error('usage : node navigateur.js JEU.html DOSSIER [--vue 640x360] [--images 54] [--etapes menu,global,…]'); process.exit(2); }
const [VW, VH] = opt('--vue', '640x360').split('x').map(Number);
const NIMG = Number(opt('--images', 54));
const ETAPES = opt('--etapes', 'menu,global,charger,confort,diag,eclairs,autres').split(',');
const HS = process.env.ZS_CHROMIUM || (() => {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  for (const d of fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : []) {
    const p = path.join(base, d, 'chrome-linux', 'headless_shell');
    if (d.startsWith('chromium_headless_shell-') && fs.existsSync(p)) return p;
  }
  return null;
})();
if (!HS) { console.error('Chromium sans tête de Playwright introuvable (ZS_CHROMIUM)'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const T0 = performance.now(), sec = () => ((performance.now() - T0) / 1000).toFixed(1);
const journal = [];
const dire = (m) => { const l = `[${sec()} s] ${m}`; journal.push(l); console.log(l); };

/* ---------------------------------------------------------------- le jeu, emballé comme par le launcher -- */
function gamepack() {
  // gamepack.js, tel quel, sans yazl (la bibliothèque des zips, inutile ici et absente de ce worktree)
  const src = fs.readFileSync(path.join(REPO, 'launcher', 'src', 'main', 'gamepack.js'), 'utf8');
  const motif = "const yazl = require('yazl');";
  if (src.split(motif).length !== 2) throw new Error('gamepack.js : la ligne de yazl a changé');
  const m = { exports: {} };
  vm.runInThisContext(`(function (module, exports, require) {${src.replace(motif, 'const yazl = null;')}\n})`)(m, m.exports, require);
  return m.exports;
}
const RACINE = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'ma-navigateur-'));
const WEB = path.join(RACINE, 'jeu');
{
  const { files } = gamepack().collectPackage({ htmlPath: JEU, libsDir: path.join(REPO, 'launcher', 'gamelibs'),
    notes: ['Essai des Marécages'], maps: { index: ['bunker7', 'khamsin', 'ombre'], files: [] } });   // comme prepare-game.js
  for (const f of files) { const p = path.join(WEB, f.name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const serveur = http.createServer((req, res) => {
  const p = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(WEB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

/* ---------------------------------------------------------------- Chromium et son protocole, par deux tubes -- */
function lancer() {
  const env = { ...process.env };
  delete env.DISPLAY; delete env.WAYLAND_DISPLAY;                      // sinon ANGLE cherche X11 et WebGL manque
  const cp = spawn(HS, ['--headless', '--no-sandbox', '--remote-debugging-pipe', `--user-data-dir=${path.join(RACINE, 'profil')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--disable-extensions', '--disable-component-update',
    '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--mute-audio', '--hide-scrollbars', '--force-color-profile=srgb', '--no-proxy-server',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
    '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], env });
  const ecrire = cp.stdio[3], lire = cp.stdio[4];
  let buf = Buffer.alloc(0), id = 0;
  const attente = new Map(), ecoutes = [];
  lire.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    let i;
    while ((i = buf.indexOf(0)) >= 0) {
      const msg = JSON.parse(buf.subarray(0, i).toString('utf8'));
      buf = buf.subarray(i + 1);
      if (msg.id && attente.has(msg.id)) { const w = attente.get(msg.id); attente.delete(msg.id); if (msg.error) w.rej(new Error(msg.error.message)); else w.res(msg.result); }
      else for (const f of ecoutes) f(msg);
    }
  });
  cp.stderr.on('data', () => {});
  const envoyer = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const m = { id: ++id, method, params };
    if (sessionId) m.sessionId = sessionId;
    attente.set(m.id, { res, rej });
    ecrire.write(JSON.stringify(m) + '\0');
  });
  return { cp, envoyer, ecouter: (f) => ecoutes.push(f) };
}

/* ---------------------------------------------------------------- mémoire du navigateur et de ses enfants -- */
function memoire(pid) {
  const enfants = new Map();
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; if (!enfants.has(pp)) enfants.set(pp, []); enfants.get(pp).push(+d); } catch (e) { /* fini */ }
  }
  let total = 0;
  const pile = [pid];
  while (pile.length) {
    const p = pile.pop();
    try { const m = fs.readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+) kB/); if (m) total += +m[1]; } catch (e) { /* fini */ }
    for (const c of enfants.get(p) || []) pile.push(c);
  }
  return Math.round(total / 1024);                                     // Mo
}

/* ---------------------------------------------------------------- aides dans la page -- */
const AIDES = `window.__ma = {
  dessiner() { renderEnabled = true; try { render(); } finally { renderEnabled = false; } },
  /* luminance relative de l'image (sRGB décodé), sur tout l'écran et par tuile de 3 × 3 (chacune proche de la surface
     de 10° du critère 2.3.1) ; le voile blanc du HUD (#fff6e0, opacité HUD.flashK) est ajouté par-dessus */
  lum(nx = 3, ny = 3) {
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const L = __ma.lin || (__ma.lin = Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }));
    const t = new Float64Array(nx * ny), n = new Float64Array(nx * ny);
    let s = 0, m = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4, Y = 0.2126 * L[px[i]] + 0.7152 * L[px[i + 1]] + 0.0722 * L[px[i + 2]];
      s += Y; m++;
      const k = Math.min(ny - 1, Math.floor((y / h) * ny)) * nx + Math.min(nx - 1, Math.floor((x / w) * nx));
      t[k] += Y; n[k]++;
    }
    const a = HUD.flashK || 0, eff = (v) => v * (1 - a) + a * 0.926;
    return { y: eff(s / m), tuiles: Array.from(t, (v, k) => eff(v / n[k])), voile: a, w, h };
  },
  arreter() { window.frame = function () {}; renderEnabled = false; },
  calme() { G.roundState = 'pre'; G.roundT = 1e9; clearZombies(); __zs.god(true); },
};`;

/* ---------------------------------------------------------------- les flashs, comme le critère 2.3.1 -- */
function flashs(ys, dt, th = 0.1) {
  const t = [];
  let bas = ys[0], haut = ys[0], monte = false;
  ys.forEach((y, n) => {
    if (!monte) { bas = Math.min(bas, y); if (y - bas >= th) { monte = true; haut = y; } }
    else { haut = Math.max(haut, y); if (haut - y >= th && Math.min(haut, y) < 0.8) { t.push(n * dt); monte = false; bas = y; } }
  });
  let max = 0;
  for (let b = 0, a = 0; b < t.length; b++) { while (t[b] - t[a] >= 1) a++; max = Math.max(max, b - a + 1); }
  return { n: t.length, max };
}

(async () => {
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const B = lancer();
  const res = { jeu: JEU, vue: `${VW}x${VH}`, etapes: {}, erreurs: [], avertissements: 0, memoire: { pic: 0 } };
  let etape = 'démarrage';
  const echant = setInterval(() => { const m = memoire(B.cp.pid); res.memoire.pic = Math.max(res.memoire.pic, m); res.memoire.fin = m; }, 2000);
  const { targetId } = await B.envoyer('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await B.envoyer('Target.attachToTarget', { targetId, flatten: true });
  const P = (m, p) => B.envoyer(m, p, S);
  B.ecouter((msg) => {
    if (msg.sessionId !== S) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      res.erreurs.push({ etape, t: sec(), texte: ((d.exception && d.exception.description) || d.text || '').split('\n').slice(0, 4).join(' | ') });
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const texte = msg.params.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ');
      if (msg.params.type === 'error' || msg.params.type === 'assert') res.erreurs.push({ etape, t: sec(), texte: texte.slice(0, 400) });
      else if (msg.params.type === 'warning') res.avertissements++;
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error' && !/favicon/.test(msg.params.entry.url || '')) {
      res.erreurs.push({ etape, t: sec(), texte: `${msg.params.entry.source} : ${msg.params.entry.text} ${msg.params.entry.url || ''}`.slice(0, 300) });
    }
  });
  await P('Runtime.enable'); await P('Page.enable'); await P('Log.enable');
  await P('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  // règle 5 (2 novembre 2026) : la souris verrouillée refusée avant tout script du jeu
  await P('Page.addScriptToEvaluateOnNewDocument', { source: "Element.prototype.requestPointerLock = () => Promise.reject(new Error('souris verrouillée refusée (essai sans tête)'));" });
  const ev = async (code, delai = 600000) => {
    const r = await Promise.race([P('Runtime.evaluate', { expression: `(async () => {\n${code}\n})()`, awaitPromise: true, returnByValue: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`délai dépassé (${delai / 1000} s)`)), delai))]);
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  const attendre = async (cond, delai, pas = 500) => {
    const t1 = performance.now();
    for (;;) {
      let v = false;
      try { v = await ev(`return !!(${cond});`, 60000); } catch (e) { /* page occupée */ }
      if (v) return (performance.now() - t1) / 1000;
      if (performance.now() - t1 > delai) throw new Error(`attente trop longue (${delai / 1000} s) : ${cond}`);
      await new Promise((r) => setTimeout(r, pas));
    }
  };
  const image = async (nom) => {
    const { data } = await P('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(OUT, nom), Buffer.from(data, 'base64'));
    return nom;
  };
  const faire = async (nom, f) => {
    if (!ETAPES.includes(nom)) return;
    etape = nom;
    const t1 = performance.now(), e0 = res.erreurs.length;
    dire(`étape ${nom}…`);
    try { res.etapes[nom] = { ...(await f()), duree_s: +((performance.now() - t1) / 1000).toFixed(1) }; }
    catch (e) { res.etapes[nom] = { echec: String(e.message || e).slice(0, 600), duree_s: +((performance.now() - t1) / 1000).toFixed(1) }; }
    res.etapes[nom].erreurs_page = res.erreurs.length - e0;
    dire(`étape ${nom} : ${res.etapes[nom].echec ? 'ÉCHEC ' + res.etapes[nom].echec : 'faite'} (${res.etapes[nom].duree_s} s, ${res.etapes[nom].erreurs_page} erreur(s) de la page, mémoire ${res.memoire.fin || '?'} Mo)`);
  };

  try {
    // ---------------------------------------------------------------- démarrage du jeu, jusqu'au menu
    await P('Page.navigate', { url: `http://127.0.0.1:${serveur.address().port}/index.html` });
    res.menu_s = await attendre("window.ZS && ZS.G && ZS.G.state === 'menu'", 400000);
    await ev(`${AIDES}\nconst st = document.createElement('style'); st.textContent = '#lockhint{display:none!important}'; document.head.appendChild(st); __ma.arreter(); return true;`);
    dire(`menu atteint en ${res.menu_s.toFixed(1)} s`);

    await faire('menu', async () => {
      const r = await ev(`openMapSelect();
        const carte = document.querySelector('#ms-grid .ms-card[data-id="marais"]');
        if (carte) { carte.click(); carte.scrollIntoView({ block: 'start' }); }
        const cartes = [...document.querySelectorAll('#ms-grid .ms-card')].map((c) => ({ id: c.dataset.id, nom: (c.querySelector('.ms-name') || {}).textContent, dev: !!c.querySelector('.ms-dev') }));
        __ma.dessiner();
        return { liste: MAPS.list.slice(), cartes, marais: !!MAPS.byId.marais, dev: !!(MAPS.byId.marais && MAPS.byId.marais.dev), version: ZS.version, interface: ZS.editorApi, construction: ZS.build };`);
      r.image = await image('01-menu-cartes.jpg');
      await ev(`showScreen('menu'); return true;`);
      return r;
    });

    await faire('global', async () => ev(`
      const avant = { panneau: !!MA_DIAG.el };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8', bubbles: true }));
      return { console_error_natif: /\\[native code\\]/.test(Function.prototype.toString.call(console.error)), diag_installe: MA_DIAG.installed, render_enveloppe: !!render.__diag,
        f8_sans_effet: !MA_DIAG.on && !MA_DIAG.el && !avant.panneau, brouillard_de_hauteur: THREE.ShaderChunk.fog_fragment.includes('uHFog'),
        textures_marais: Object.keys(TEXLIB).filter((k) => k.startsWith('ma_')).length, glHooked: MA_DIAG.glHooked };`));

    await faire('charger', async () => {
      const t1 = performance.now();
      await ev(`MapSel.sel = 'marais'; playSelectedMap(); return true;`);
      const s = await attendre("ZS.G.state === 'playing' && ZS.G.mapId === 'marais'", 900000);
      const r = await ev(`__ma.arreter(); __ma.calme(); __zs.step(20);
        __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], CUR.map.spawn.yaw); player.pitch = 0.04; __zs.step(6);
        const t0 = performance.now(); __ma.dessiner(); const img = performance.now() - t0;
        return { monde: OW.worldId, carte: G.mapId, joueur: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)], barques: VEH.list.filter((V) => V.T && V.T.boat).length,
          bete: !!MAB.mv, bete_err: MAB.err || null, meteo: ZS.marais.meteo.etat.episode, diag_installe: MA_DIAG.installed, gl_ecoute: MA_DIAG.glHooked,
          programmes: renderer.info.programs ? renderer.info.programs.length : null, premiere_image_ms: Math.round(img), lum: __ma.lum().y };`);
      r.chargement_s = +((performance.now() - t1) / 1000).toFixed(1); r.attente_s = +s.toFixed(1);
      r.image = await image('02-marais-depart.jpg');
      return r;
    });

    await faire('confort', async () => ev(`
      const a = FX.shake; maSecousse(1); const b = FX.shake;
      settings.shake = true; maSecousse(0.5); const c = FX.shake; settings.shake = false; FX.shake = 0;
      // secousses et à-coups du jeu de base (2 novembre 2026) : la vraie caméra (updateCamera), secousse et à-coup forcés
      const vue = (reg) => { settings.shake = reg; const R = []; for (let i = 0; i < 6; i++) { FX.shake = 1; player.punch = 0.1; updateCamera(1 / 60); R.push([camera.rotation.x, camera.rotation.y, camera.rotation.z]); } return R; };
      const ecart = (R) => Math.max(...[0, 1, 2].map((k) => Math.max(...R.map((r) => r[k])) - Math.min(...R.map((r) => r[k]))));
      const sans = vue(false), avec = vue(true);
      settings.shake = false; FX.shake = 0; player.punch = 0; updateCamera(1 / 60);
      return { defaut_sans_secousse: a === b, reglee: Math.abs(c - Math.min(1, b + 0.5)) < 1e-9, balance_defaut: maBalance(), flashs: settings.flashes || 'limited (défaut)',
        jeu_de_base: { secousse_vue_defaut: maSecousseVue(), ecart_rotation_defaut: +ecart(sans).toFixed(5), ecart_rotation_reglee: +ecart(avec).toFixed(5),
          a_coup_defaut: +(sans[0][0] - (player.pitch + player.recoil)).toFixed(4) } };`));

    await faire('diag', async () => {
      const r = await ev(`
        const f8 = (shift) => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8', shiftKey: !!shift, bubbles: true }));
        f8(); const joueur = { installe: MA_DIAG.installed, panneau: MA_DIAG.on };
        store.set('zs.diag', 'marais'); maDiagInstaller(); f8();
        const active = { installe: MA_DIAG.installed, panneau: MA_DIAG.on, texte: MA_DIAG.el ? MA_DIAG.el.textContent.split('\\n')[0] : null };
        const attn = MAM.attn; f8(true); const majf8 = MAM.attn === attn;
        maDiagDraw(); __ma.dessiner();
        return { joueur, active, majf8_sans_effet_hors_mod_tools: majf8, console_error_natif: /\\[native code\\]/.test(Function.prototype.toString.call(console.error)) };`);
      r.image = await image('03-diagnostic-f8.jpg');
      await ev(`if (MA_DIAG.on) maDiagToggle(false); store.set('zs.diag', ''); return true;`);
      return r;
    });

    await faire('eclairs', async () => {
      // un éclair au sol à 20 m devant le joueur, les mêmes arcs pour les trois réglages : cinq arcs en retour en 0,36 s et
      // un courant prolongé (dans les bornes du kit : 1 à 6 arcs, 30 à 140 ms), puis un second éclair (trois arcs) 1 s après
      const out = {}, dt = 1 / 30;
      await ev(`ZS.marais.meteo.sec(); __ma.orig = { V: maFlashV, Gd: maFlashGarde, E: maEblouir, B: maBat }; return true;`);
      for (const mode of ['kit', 'limited', 'reduced']) {
        await ev(`
          const O = __ma.orig;
          if (${JSON.stringify(mode)} === 'kit') { maFlashV = (o, v) => v; maFlashGarde = () => { MA_FLG.k = 1; }; maEblouir = () => HUD.flash(); maBat = (lo) => lo + (1 - lo) * Math.random(); settings.flashes = 'limited'; }
          else { maFlashV = O.V; maFlashGarde = O.Gd; maEblouir = O.E; maBat = O.B; settings.flashes = ${JSON.stringify(mode)}; }
          __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], CUR.map.spawn.yaw); player.pitch = 0.04; __ma.calme();
          __zs.step(90, 1 / 30); maFlashReset(); HUD.flashK = 0; FX.shake = 0;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          let S1 = null, S2 = null;
          for (const d of [20, 22, 18, 24, 16]) { const n0 = MA_OR.strikes.length; if (ZS.marais.meteo.eclair(player.pos.x + fx * d, player.pos.z + fz * d, { at: 0.05 }) && MA_OR.strikes.length > n0) { S1 = MA_OR.strikes[MA_OR.strikes.length - 1]; break; } }
          for (const d of [26, 28, 24, 30]) { const n0 = MA_OR.strikes.length; if (ZS.marais.meteo.eclair(player.pos.x + fx * d + fz * 6, player.pos.z + fz * d - fx * 6, { at: 1.05 }) && MA_OR.strikes.length > n0) { S2 = MA_OR.strikes[MA_OR.strikes.length - 1]; break; } }
          if (!S1) throw new Error('aucun point d’impact devant le joueur');
          S1.pulses = [[-0.03, 0.07, 0.004, 0.012], [0, 1, 0.0006, 0.03], [0.07, 0.8, 0.0006, 0.03], [0.16, 0.65, 0.0006, 0.035], [0.24, 0.9, 0.0006, 0.03], [0.36, 0.5, 0.0006, 0.04], [0.37, 0.3, 0.02, 0.15]];
          if (S2) S2.pulses = [[0, 0.9, 0.0006, 0.03], [0.09, 0.7, 0.0006, 0.035], [0.2, 0.6, 0.0006, 0.04]];
          __ma.S = [S1 && Math.hypot(S1.x - player.pos.x, S1.z - player.pos.z), S2 && Math.hypot(S2.x - player.pos.x, S2.z - player.pos.z)];
          return true;`);
        const ys = [], tuiles = [], voiles = [];
        let best = { y: -1, i: -1 };
        for (let i = 0; i < NIMG; i++) {
          const r = await ev(`__zs.step(1, ${dt}); __ma.dessiner(); return __ma.lum();`, 300000);
          ys.push(r.y); tuiles.push(r.tuiles); voiles.push(r.voile);
          if (r.y > best.y && i < 20) { best = { y: r.y, i }; if (i >= 1 && i <= 3) await image(`04-eclair-${mode}.jpg`); }
        }
        const fond = await ev(`return { distances: __ma.S };`);
        const parTuile = tuiles[0].map((_, k) => flashs(tuiles.map((t) => t[k]), dt));
        out[mode] = { images: NIMG, pas_s: +dt.toFixed(4), distances_m: fond.distances.map((d) => d && +d.toFixed(1)), fond: +ys[0].toFixed(4),
          pic: +Math.max(...ys).toFixed(4), pic_tuile: +Math.max(...tuiles.flat()).toFixed(4), voile_max: +Math.max(...voiles).toFixed(2),
          flashs_ecran: flashs(ys, dt), flashs_tuile_max: parTuile.reduce((m, f) => (f.max > m.max ? f : m), { n: 0, max: 0 }),
          courbe: ys.map((y) => +y.toFixed(4)) };
        dire(`  éclairs « ${mode} » : pic ${out[mode].pic}, ${out[mode].flashs_ecran.n} flash(s) à l'écran (au plus ${out[mode].flashs_ecran.max} par seconde), tuile la plus touchée : ${out[mode].flashs_tuile_max.max} par seconde`);
      }
      await ev(`const O = __ma.orig; maFlashV = O.V; maFlashGarde = O.Gd; maEblouir = O.E; maBat = O.B; settings.flashes = undefined; return true;`);
      return out;
    });

    await faire('autres', async () => {
      const out = {};
      for (const id of ['bunker7', 'khamsin']) {
        const t1 = performance.now();
        await ev(`quitToMenu(); MapSel.sel = ${JSON.stringify(id)}; playSelectedMap(); return true;`);
        await attendre(`ZS.G.state === 'playing' && ZS.G.mapId === ${JSON.stringify(id)}`, 900000);
        const r = await ev(`__ma.arreter(); __ma.calme(); __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], CUR.map.spawn.yaw); player.pitch = 0; __zs.step(8);
          if (OW.on && typeof owUpdateTerrainLod === 'function') { owUpdateTerrainLod(true); if (typeof owUpdateRoads === 'function') owUpdateRoads(); }
          __ma.dessiner();
          return { carte: G.mapId, monde_ouvert: OW.on, monde: OW.worldId || null, panneau_diag: MA_DIAG.on, secousse_vue: maSecousseVue(), brouillard: scene.fog ? +(scene.fog.density || 0).toFixed(5) : null, lum: __ma.lum().y };`);
        r.chargement_s = +((performance.now() - t1) / 1000).toFixed(1);
        r.image = await image(`0${id === 'bunker7' ? 5 : 6}-${id}.jpg`);
        out[id] = r;
      }
      return out;
    });
  } catch (e) {
    res.arret = String(e.message || e);
    dire(`ARRÊT : ${res.arret}`);
  }
  clearInterval(echant);
  res.memoire.fin = memoire(B.cp.pid);
  res.duree_s = +((performance.now() - T0) / 1000).toFixed(1);
  try { await B.envoyer('Browser.close'); } catch (e) { /* déjà fermé */ }
  setTimeout(() => { try { B.cp.kill('SIGKILL'); } catch (e) { /* fini */ } }, 5000).unref();
  serveur.close();
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(OUT, 'journal.txt'), journal.join('\n') + '\n');
  {
    const E = res.etapes, L = [`# Marécages Maudits : essais en navigateur`, '', `Jeu : \`${JEU}\` (SHA-256 ${require('crypto').createHash('sha256').update(fs.readFileSync(JEU)).digest('hex')}).`,
      `Vue ${res.vue}, Chromium sans tête (SwiftShader), souris verrouillée refusée. Durée ${res.duree_s} s, mémoire au plus ${res.memoire.pic} Mo, ${res.erreurs.length} erreur(s) de la page, ${res.avertissements} avertissement(s).${res.arret ? ` **Arrêt : ${res.arret}**` : ''}`, '',
      '| Étape | Durée (s) | Erreurs de la page | Résultat |', '|---|---:|---:|---|'];
    for (const [k, v] of Object.entries(E)) {
      const r = { ...v }; delete r.duree_s; delete r.erreurs_page;
      if (k === 'eclairs') for (const m of Object.keys(r)) if (r[m] && r[m].courbe) { r[m] = { ...r[m] }; delete r[m].courbe; }
      L.push(`| ${k} | ${v.duree_s} | ${v.erreurs_page} | \`${JSON.stringify(r).replace(/\|/g, '/').slice(0, 900)}\` |`);
    }
    if (E.eclairs && !E.eclairs.echec) {
      L.push('', '| Éclairs | Fond | Pic (écran) | Pic (tuile) | Voile blanc | Flashs à l\'écran (au plus par seconde) | Tuile la plus touchée (au plus par seconde) |', '|---|---:|---:|---:|---:|---:|---:|');
      for (const m of ['kit', 'limited', 'reduced']) { const d = E.eclairs[m]; if (d) L.push(`| ${m} | ${d.fond} | ${d.pic} | ${d.pic_tuile} | ${d.voile_max} | ${d.flashs_ecran.n} (${d.flashs_ecran.max}) | ${d.flashs_tuile_max.n} (${d.flashs_tuile_max.max}) |`); }
    }
    if (res.erreurs.length) { L.push('', '## Erreurs de la page'); for (const e of res.erreurs.slice(0, 40)) L.push(`- [${e.etape}, ${e.t} s] ${e.texte}`); }
    L.push('', '## Images', ...fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg')).sort().map((f) => `- \`${f}\``), '');
    fs.writeFileSync(path.join(OUT, 'rapport.md'), L.join('\n'));
  }
  fs.rmSync(RACINE, { recursive: true, force: true });
  dire(`fini en ${res.duree_s} s ; mémoire au plus ${res.memoire.pic} Mo ; ${res.erreurs.length} erreur(s) de la page ; résultats dans ${OUT}`);
  process.exit(res.arret ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
