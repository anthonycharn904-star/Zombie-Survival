'use strict';
/* Scène de la Mère-Vase : capture, image par image, de la vraie scène du jeu du kit 2.0.7 (Marécages maudits), pour le
   fond animé du launcher. Rien n'est inventé : la carte, la bête, les Noyés, la pluie, l'orage et la brume sont ceux du
   jeu ; le script ne fait que placer la scène, fixer la caméra et faire avancer le temps.

   Il exécute le jeu du kit (copie vérifiée par preparer.sh) : autorisé par Anthony le 1er novembre 2026 (« Tu peux y
   aller ! »). Il faut aussi une machine libre (voir README.md).
     bash maquettes/launcher/scene-bete/preparer.sh            (copie vérifiée du jeu du kit)
     node maquettes/launcher/scene-bete/capturer.js --cadrage  (un seul passage, une image par 1/3 s : le cadrage)
     node maquettes/launcher/scene-bete/capturer.js --essai    (essai court : 640 × 248, 3 s)
     node maquettes/launcher/scene-bete/capturer.js            (la capture : 1 600 × 620, 12 s à 30 images/s)
   Options : --largeur, --hauteur, --duree (s), --avant (s avant le bond), --chasse (s de jeu avant la chasse
   relancée), --graine, --forcer (garde de charge levée, seulement avec l'accord d'Anthony).

   Ce que fait le jeu (ma09_beast.js, ma15_noyes.js du kit) : le joueur hors de l'eau, des Noyés le regardent depuis
   l'eau (état « stare ») ; la bête éveillée chasse le plus proche (« festin », 9 m/s), bondit (clip « ruee », 1,9 s :
   jaillit, impact à 0,7 s, retombe) et engloutit jusqu'à 3 Noyés à l'impact (maNoyeEaten : gerbe de sang, lambeaux
   du ciré) ; après 2,2 s de repos, elle peut recommencer sur un autre.
   La mise en scène : le joueur sur un ponton près d'une barque amarrée (invulnérable, caché) ; quatre à six Noyés
   sortis devant lui, en eau profonde ; la bête éveillée au large ; une averse avec orage (ZS.marais.meteo.orage()) ;
   la chasse relancée seulement après --chasse s de jeu (les Noyés ont fini de sortir et regardent : la fenêtre
   commence dans le calme) ; au moment du bond, un éclair dans les nuages, dont la lumière vient de derrière la bête.
   Caméra fixe (vertige d'Anthony) : au ras de l'eau, au-dessus de l'eau libre juste devant le ponton, face aux Noyés
   (ils regardent le joueur : on voit leurs yeux) et à la bête, qui bondit vers eux, donc vers nous ; ni planche ni
   barque entre elle et les Noyés (contrôlé) ; ni secousse (FX.shake remis à 0), ni arme, ni HUD, ni corps du joueur.
   Les éclairs (décisions d'Anthony du 1er novembre 2026 pour la carte, appliquées au fond) :
     · au plus trois éclats par seconde (« flashs limités », son réglage par défaut ; le kit va jusqu'à 13 à 15) : un
       arc en retour n'est gardé que s'il part au moins ECART s après le précédent, tous éclairs confondus ;
     · une seconde version, sans éclairs, de la même scène : l'interrupteur « Éclairs de l'orage » du launcher doit
       aussi agir sur la vidéo ;
     · les éclairs restent ceux du jeu, dans les nuages (validé par Anthony le 2 novembre 2026). Pas d'impact au sol : ses gerbes, sa vapeur, ses brûlures (et
       ses morts) ne pourraient pas disparaître de la version sans éclairs.
   Trois passages avec la même graine, sur le seul temps du jeu (la même partie à chaque fois) : le premier, sans
   rendu, repère l'instant du bond ; le deuxième rend la fenêtre utile avec les éclairs, le troisième sans. Le script
   vérifie que la scène est la même, image par image, et compte les éclats sur les images.
   Sorties dans scene-bete/sortie/ (hors de Git) : images/, images-sans-eclairs/, journal.json (événements et éclairs,
   instants pour caler le tonnerre du launcher), eclats.json (luminance image par image, éclats par seconde),
   scene.json (réglages). */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const ICI = __dirname, REPO = path.join(ICI, '..', '..', '..');
const JEU = path.join(ICI, 'kit', 'jeu');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ESSAI = argv.includes('--essai'), CADRAGE = argv.includes('--cadrage'), PETIT = ESSAI || CADRAGE;
const O = {
  largeur: +val('--largeur', PETIT ? 640 : 1600), hauteur: +val('--hauteur', PETIT ? 248 : 620),
  duree: +val('--duree', ESSAI ? 3 : 12), avant: +val('--avant', 2.5), chasse: +val('--chasse', 6), graine: +val('--graine', 7), fps: 30,
};
const OUT = path.join(ICI, 'sortie', CADRAGE ? 'cadrage' : ESSAI ? 'essai' : 'capture');
// la caméra : places essayées devant le ponton (m vers le large, m de côté), hauteur au-dessus de l'eau, point visé
const CAMERA = { d: [6, 4, 9, 12], s: [7, -7, 10, -10, 4, -4, 13, -13], h: 1.1, vise: 1.7 };
const ECART = 0.36;                                  // entre deux départs d'éclat : au plus trois par seconde, avec de la marge
const SEUILS = [0.1, 0.05, 0.02, 0.01, 0.005];       // variations de luminance relative comptées (0,1 : le seuil du WCAG)

// ------------------------------------------------------------------ garde : autorisation et machine libre
if (!fs.existsSync(path.join(JEU, 'index.html'))) { console.error('copie du jeu du kit absente : lancer preparer.sh'); process.exit(2); }
// Le 1er novembre 2026, deux ou trois instances du jeu en même temps (7 à 8 Go chacune avant le refus de la souris
// verrouillée ; celle-ci et celles d'autres sessions) ont saturé les 16 Go d'Ubuntu et son échange, jusqu'au
// redémarrage d'Ubuntu à 21 h 26. Depuis le 2 novembre, la capture passe par la file commune des tâches lourdes
// (consigne d'Anthony) : ~/outils/bin/zs-lourd --classe jeu --memoire 4000 -- node …/capturer.js (README, §3).
// Sous la file (ZS_LOURD_CLASSE = jeu et sa fiche ZS_LOURD_PLACE présente, effacée à la fin du travail), la file a
// déjà décidé du départ : la garde de départ ne joue pas, et la capture ne s'arrête en cours de route que sous le seuil
// d'alerte de la file (1,5 Go). Hors de la file : 10 Go libres exigés au départ, charge et Blender contrôlés, arrêt
// sous 2,5 Go (memoire() avant chaque appel à la page). Choix d'Anthony du 2 novembre 2026.
const SOUS_FILE = process.env.ZS_LOURD_CLASSE === 'jeu' && !!process.env.ZS_LOURD_PLACE && fs.existsSync(process.env.ZS_LOURD_PLACE);
const MEMOIRE_DEPART = 10, MEMOIRE_MIN = SOUS_FILE ? 1.5 : 2.5;
const memoire = () => { try { return Number(/MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) / 1048576; } catch (e) { return os.freemem() / 2 ** 30; } };
const parFil = os.loadavg()[0] / os.cpus().length, dispo = memoire();
const blender = !SOUS_FILE && (() => { try { return /blender/i.test(execSync('ps -eo comm', { encoding: 'utf8' })); } catch (e) { return false; } })();
if (!SOUS_FILE && (parFil > 0.5 || dispo < MEMOIRE_DEPART || blender) && !argv.includes('--forcer')) {
  console.error(`machine occupée (charge ${parFil.toFixed(2)} par fil, ${dispo.toFixed(1)} Go disponibles${blender ? ', Blender en cours' : ''}) : capture non lancée.`);
  console.error('La lancer par la file commune : ~/outils/bin/zs-lourd --classe jeu --memoire 4000 --nom "…" -- node maquettes/launcher/scene-bete/capturer.js … (README, §3).');
  process.exit(3);
}
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(JEU, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(JEU) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

/* ------------------------------------------------------------------ dans la page : la mise en scène (jeu du kit) */
/* Les éclairs : « limites » (au plus un départ d'éclat toutes les ECART s, tous éclairs confondus) ou « aucun » (ni
   lumière ni canal visible). Le jeu puise son hasard de la même façon dans les deux cas : la même partie. */
function flashs(mode, ECART) {
  const departs = window.__departs = [], eclairs = window.__eclairs = [], tonnerres = window.__tonnerres = [];
  const garder = (L) => {
    const t0 = G.time, out = [];
    let dernier = -Infinity;
    for (const p of L.slice().sort((a, b) => a[0] - b[0])) {
      if (p[1] < 0.12) { out.push(p); continue; }                                   // la lueur du traceur : pas un éclat
      if (p[0] >= dernier && p[0] - dernier < 0.02) { out.push(p); continue; }     // le courant qui prolonge l'arc gardé
      const t = t0 + p[0];
      if (departs.every((x) => Math.abs(t - x) >= ECART)) { out.push(p); dernier = p[0]; departs.push(+t.toFixed(4)); }
    }
    return mode === 'aucun' ? out.map(([t, a, r, d]) => [t, 0, r, d]) : out;
  };
  const pc = maPulsesCloud, pg = maPulsesGround, fc = maFlashCloud, bi = maBoltI;
  window.maPulsesCloud = function () { return garder(pc.apply(this, arguments)); };
  window.maPulsesGround = function () { return garder(pg.apply(this, arguments)); };
  if (mode === 'aucun') window.maBoltI = function (slot) { return bi.call(this, slot, 0); };
  // chaque éclair : instant, départs de ses éclats, direction, distance (le tonnerre du launcher se calera dessus)
  window.maFlashCloud = function () {
    const d0 = departs.length, n = MA_OR.fl.length, r = fc.apply(this, arguments);
    if (MA_OR.fl.length > n) {
      const f = MA_OR.fl[MA_OR.fl.length - 1], th = tonnerres[tonnerres.length - 1], t = +G.time.toFixed(3);
      eclairs.push({ t, departs: departs.slice(d0), k: +f.k.toFixed(3), dir: f.dir.toArray().map((v) => +v.toFixed(3)), d: th && th.t === t ? th.d : null });
    }
    return r;
  };
  // le tonnerre du jeu se calcule par tranches d'horloge réelle (3 à 8 ms par image) : retiré (la vidéo est muette ;
  // il décalerait le hasard d'un passage à l'autre) ; on garde le lieu de chaque éclair
  window.maThunderJob = function (ch, at, x, z, d) { tonnerres.push({ t: +G.time.toFixed(3), x: Math.round(x), z: Math.round(z), d: Math.round(d) }); };
  window.maStrikePlan = function () { return null; };   // pas d'impact au sol
}
function miseEnScene(o) {
  const R = { etapes: [] }, note = (m, d) => R.etapes.push(d ? `${m} ${JSON.stringify(d)}` : m);
  // 0. un déroulé reproductible, sur le seul temps du jeu
  window.frame = function () {};                     // la boucle du jeu s'arrête : le temps n'avance que par __zs.step
  window.requestAnimationFrame = () => 0;
  window.__annulerImages();                          // y compris l'image déjà demandée par la boucle
  // les minuteries du jeu (bulles de la bête, fins de sons…) partent au temps du jeu, pas à l'heure réelle
  const file = [];
  let seq = 0;
  window.setTimeout = function (fn, ms, ...a) { seq++; file.push({ id: 1e7 + seq, seq, due: G.time + (+ms || 0) / 1000, fn, a }); return 1e7 + seq; };
  window.clearTimeout = function (id) { const i = file.findIndex((x) => x.id === id); if (i >= 0) file.splice(i, 1); };
  window.__minuteries = function () {
    for (;;) {
      let k = -1;
      for (let i = 0; i < file.length; i++) if (file[i].due <= G.time + 1e-9 && (k < 0 || file[i].due < file[k].due || (file[i].due === file[k].due && file[i].seq < file[k].seq))) k = i;
      if (k < 0) return;
      const T = file.splice(k, 1)[0];
      if (typeof T.fn === 'function') { try { T.fn(...T.a); } catch (e) { console.error(e); } }
    }
  };
  // le rendu a son propre hasard (three.js nomme avec Math.random les objets qu'il crée en rendant ; le premier passage
  // ne rend rien) : celui du jeu reste le même d'un passage à l'autre
  let sr = (o.graine ^ 0x5bd1e995) >>> 0;
  window.__hasardRendu = () => { sr = (sr + 0x6d2b79f5) | 0; let t = Math.imul(sr ^ (sr >>> 15), 1 | sr); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  flashs(o.eclairs, o.ecart);
  window.__jeu = true;                               // la mise en scène puise dans le hasard du jeu
  __graine(o.graine);                                // le hasard repart de la graine, quelle que soit la durée du menu
  if (!__zs.map('marais')) throw new Error('carte « marais » introuvable dans le jeu du kit');
  __zs.start(); __zs.god(true);
  // les sons de pluie se calculent par tranches d'horloge réelle (3 ms par pas) ; à la fin du calcul, le jeu tire leurs
  // départs dans son hasard (maWxAudioStart), à un pas qui dépendait de la vitesse de la machine : finis tout de suite
  if (typeof maWxAudioPrep === 'function') maWxAudioPrep(1e9);
  const journal = window.__journal = [];
  for (const ev of ['bete', 'noye', 'attaque', 'foudre', 'meteo']) maOn(ev, (d) => journal.push({ t: +G.time.toFixed(3), ev, d: JSON.parse(JSON.stringify(d || {})) }));
  pas(60);                                           // une seconde : le marais se met en place
  // 1. un ponton au bord d'une eau profonde, près d'une barque amarrée
  let spot = null;
  for (const V of VEH.list.filter((v) => v.T && v.T.boat)) {
    const bx = V.group.position.x, bz = V.group.position.z;
    for (let r = 1; r <= 6 && !spot; r += 0.5) for (let a = 0; a < 16 && !spot; a++) {
      const x = bx + Math.cos(a / 16 * Math.PI * 2) * r, z = bz + Math.sin(a / 16 * Math.PI * 2) * r;
      if (!maOnFloor(x, z)) continue;
      const dir = Math.atan2(bx - x, bz - z);         // de la planche vers la barque : vers le large
      const fx = x + Math.sin(dir) * 18, fz = z + Math.cos(dir) * 18;
      if (maDepthAround(fx, fz, 6) >= MA_CFG.attackDepth) spot = { x, z, dir, boat: [bx, bz] };
    }
    if (spot) break;
  }
  if (!spot) throw new Error('aucun ponton au bord d’une eau profonde près d’une barque');
  __zs.tp(spot.x, spot.z, spot.dir + Math.PI);       // le joueur regarde le large (yaw du jeu : -Z en face)
  pas(10);
  if (maPlayerOnWater()) throw new Error('le joueur n’est pas sur le ponton');
  note('ponton', { x: +spot.x.toFixed(1), z: +spot.z.toFixed(1) });
  // 2. des Noyés en eau profonde devant le ponton (ils sortent, puis regardent le joueur : « stare »). Réglage de
  //    mise en scène, sans effet sur l'image : ils regardent 25 à 35 s au lieu de 4 à 8 (la bête a le temps de venir)
  MA_NOYE.stare = [25, 35];
  const fwd = [Math.sin(spot.dir), Math.cos(spot.dir)], side = [fwd[1], -fwd[0]];
  const noyes = [], places = [];
  for (const [d, s] of [[11, -5], [14, 3], [17, -1], [20, 6], [13, 9], [22, -7]].slice(0, o.noyes)) {
    const x = spot.x + fwd[0] * d + side[0] * s, z = spot.z + fwd[1] * d + side[1] * s;
    if (maDepthAround(x, z, 3) < MA_NOYE.spawnDepth) continue;
    const zb = maNoyeSpawn(x, z, Math.atan2(spot.x - x, spot.z - z));
    if (zb) { noyes.push(zb); places.push([x, z]); }
  }
  if (noyes.length < 2) throw new Error(`trop peu de Noyés placés (${noyes.length})`);
  note('noyés', { n: noyes.length });
  // 3. l'averse et l'orage du jeu
  ZS.marais.meteo.orage();
  // 4. la bête éveillée au large, derrière les Noyés
  const bx = spot.x + fwd[0] * 36 + side[0] * 4, bz = spot.z + fwd[1] * 36 + side[1] * 4;
  Object.assign(MAB, { x: bx, z: bz, y: MA.water - 3, tx: bx, tz: bz, yaw: Math.atan2(spot.x - bx, spot.z - bz), cool: 0 });
  MAM.attn = Math.max(MAM.attn, 30);
  maBeastSetState('rode');
  note('bête', { x: +bx.toFixed(1), z: +bz.toFixed(1), etat: MAB.state });
  // 5. la caméra fixe, au ras de l'eau, juste devant le ponton, côté large : face aux Noyés et à la bête. Au-dessus de
  //    l'eau libre (au moins 0,5 m d'eau tout autour), à 4,5 m au moins de la barque, ni planche ni haut-fond entre
  //    elle et les Noyés
  const mid = places.reduce((a, p) => [a[0] + p[0] / places.length, a[1] + p[1] / places.length], [0, 0]);
  const prof = (x, z, r) => { let m = maDepth(x, z); for (let i = 0; i < 8; i++) m = Math.min(m, maDepth(x + Math.cos(i / 8 * Math.PI * 2) * r, z + Math.sin(i / 8 * Math.PI * 2) * r)); return m; };
  const libre = (x, z, r) => !maOnFloor(x, z) && prof(x, z, r) > 0.5;
  let pose = null;
  for (const cd of o.camera.d) for (const cs of o.camera.s) {
    if (pose) break;
    const x = spot.x + fwd[0] * cd + side[0] * cs, z = spot.z + fwd[1] * cd + side[1] * cs;
    if (!libre(x, z, 1.5) || Math.hypot(x - spot.boat[0], z - spot.boat[1]) < 4.5) continue;
    let ok = true;
    for (let k = 1; k < 16 && ok; k++) { const u = k / 16; ok = libre(x + (mid[0] - x) * u, z + (mid[1] - z) * u, 0.6); }
    if (ok) pose = { x, z, d: cd, s: cs };
  }
  if (!pose) throw new Error('aucune place pour la caméra devant le ponton (eau libre, vue dégagée sur les Noyés)');
  note('caméra', { d: pose.d, s: pose.s });
  const cam = new THREE.PerspectiveCamera(o.fov, o.largeur / o.hauteur, 0.1, 900);
  cam.position.set(pose.x, MA.water + o.camera.h, pose.z);
  cam.lookAt(mid[0], MA.water + o.camera.vise, mid[1]);
  window.__chasse = o.chasse;
  window.__cam = cam; viewCamera = cam;
  vmScene.visible = false;                           // ni arme ni bras
  window.persoBeforeRender = () => { if (PERSO.av && PERSO.av.g) PERSO.av.g.visible = false; };   // ni corps du joueur
  if (window.Couteau) Couteau.rendreVue = () => {};
  if (window.Khepesh) Khepesh.rendreVue = () => {};
  window.__scene = { spot, mid, fwd, side, cam: cam.position.toArray().map((v) => +v.toFixed(2)) };
  window.__jeu = false;
  return R;
}
/* n pas de jeu de 1/60 s, chacun suivi des minuteries arrivées à échéance. */
function pas(n) {
  for (let i = 0; i < n; i++) {
    FX.shake = 0; __zs.step(1, 1 / 60); FX.shake = 0;
    __minuteries();
    if (MAB.state === 'ruee' && window.__bond === undefined) window.__bond = +G.time.toFixed(4);
    // au moment où elle jaillit (une fois) : un éclair dans les nuages, dont la lumière vient de derrière elle
    if (MAB.state === 'ruee' && !window.__eclair && window.__cam) {
      window.__eclair = true;
      const C = window.__cam, n0 = MA_OR.fl.length;
      if (MA_OR.P) {
        maFlashCloud(MA_OR.P);
        const f = MA_OR.fl[MA_OR.fl.length - 1], E = window.__eclairs[window.__eclairs.length - 1];
        if (MA_OR.fl.length > n0 && f) {
          const dx = MAB.x - C.position.x, dz = MAB.z - C.position.z;
          f.dir.set(dx, Math.hypot(dx, dz) * 0.47, dz).normalize();
          if (E) { E.dir = f.dir.toArray().map((v) => +v.toFixed(3)); E.bond = true; }
        }
      }
    }
  }
}
/* Avance de n images (30 images/s, deux pas de jeu par image) ; passé --chasse s de jeu, la chasse est relancée tant
   qu'elle n'a pas commencé. */
function avancer(n) {
  window.__jeu = true;
  try {
    for (let i = 0; i < n; i++) {
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }   // pas de pause (pas de souris dans le banc)
      if (!['festin', 'ruee'].includes(MAB.state) && MAB.cool <= 0.5 && !window.__eclair && G.time >= window.__chasse) maBeastFeast(true);
      pas(2);
    }
  } finally { window.__jeu = false; }
  const C = window.__cam, d = C ? +Math.hypot(MAB.x - C.position.x, MAB.z - C.position.z).toFixed(1) : null;   // la bête, à d m de la caméra
  return { t: +G.time.toFixed(3), bete: MAB.state, manges: MA_NOYES.eaten, bond: window.__bond, d, y: +(MAB.y - MA.water).toFixed(1) };
}
/* L'image (JPEG), sa luminance relative (4 × 2 tuiles, puis l'image entière) et l'état de la scène (même scène d'un
   passage à l'autre). */
function rendre(qualite) {
  const hasard = Math.random;
  Math.random = window.__hasardRendu;
  try { render(); } finally { Math.random = hasard; }
  const c = renderer.domElement;
  if (!window.__lum) {
    const k = document.createElement('canvas'); k.width = 64; k.height = 24;
    window.__lum = k.getContext('2d', { willReadFrequently: true }); window.__lum.imageSmoothingQuality = 'high';
  }
  const g = window.__lum;
  g.drawImage(c, 0, 0, 64, 24);
  const d = g.getImageData(0, 0, 64, 24).data, lum = new Array(9).fill(0);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let y = 0; y < 24; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4, L = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
    lum[((y / 12) | 0) * 4 + ((x / 16) | 0)] += L / 192; lum[8] += L / 1536;
  }
  const s = [G.time.toFixed(4), MAB.state, MAB.x.toFixed(4), MAB.y.toFixed(4), MAB.z.toFixed(4), MA_NOYES.eaten];
  for (const z of Zombies.list) if (z && z.noye) s.push(`${z.alive ? 1 : 0}:${(z.hx || 0).toFixed(3)}:${(z.hz || 0).toFixed(3)}`);
  return { url: c.toDataURL('image/jpeg', qualite), lum: lum.map((v) => +v.toFixed(5)), etat: s.join(' ') };
}
/* Fin d'un passage : le journal, et chaque éclair avec son côté dans l'image (0 à gauche, 1 à droite ; null derrière). */
function bilan() {
  const C = window.__cam;
  for (const E of window.__eclairs) {
    const p = C.position.clone().addScaledVector(new THREE.Vector3(...E.dir), 1000).project(C);
    E.x = p.z < 1 ? +((p.x + 1) / 2).toFixed(3) : null;
  }
  return { journal: window.__journal, eclairs: window.__eclairs, departs: window.__departs, tonnerres: window.__tonnerres, bond: window.__bond, scene: window.__scene, horsJeu: window.__horsJeu };
}

/* ------------------------------------------------------------------ éclats comptés sur les images */
/* Transitions d'une suite de luminances : variations opposées d'au moins « seuil » (luminance relative), à partir du
   dernier creux ou de la dernière crête. Un éclat : une montée puis une descente (WCAG 2.3.1 ; la plus sombre des deux
   images sous 0,8, toujours le cas ici). */
function transitions(s, seuil) {
  const T = [];
  let mode = 0, lo = s[0], hi = s[0];
  for (let i = 1; i < s.length; i++) {
    const v = s[i];
    if (v > hi) hi = v;
    if (v < lo) lo = v;
    if (mode <= 0 && v - lo >= seuil) { T.push(i); mode = 1; hi = v; }
    else if (mode >= 0 && hi - v >= seuil) { T.push(i); mode = -1; lo = v; }
  }
  return T;
}
/* Le plus d'éclats dans une seconde (fps images), sur l'image entière et sur chaque tuile. */
function eclatsParSeconde(lum, seuil, fps) {
  let pire = 0;
  for (let k = 0; k < 9; k++) {
    const T = transitions(lum.map((v) => v[k]), seuil);
    for (let a = 0, b = 0; a < T.length; a++) { while (b < T.length && T[b] - T[a] < fps) b++; pire = Math.max(pire, b - a); }
  }
  return Math.ceil(pire / 2);
}

/* ------------------------------------------------------------------ déroulé */
/* La garde de mémoire, avant chaque appel à la page : sous MEMOIRE_MIN Go disponibles, la capture s'arrête (le
   navigateur est fermé par l'arrêt du processus), plutôt que de saturer Ubuntu. */
let memoirePlancher = Infinity;
function garde() {
  const m = memoire();
  memoirePlancher = Math.min(memoirePlancher, m);
  if (m < MEMOIRE_MIN && !argv.includes('--forcer')) {
    console.error(`mémoire presque pleine (${m.toFixed(1)} Go disponibles) : capture arrêtée pour ne pas saturer Ubuntu.`);
    process.exit(4);
  }
}
async function ouvrir(browser) {
  const page = await browser.newPage({ viewport: { width: O.largeur, height: O.hauteur } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  // la souris verrouillée est refusée : accordée (startGame la demande), le Chromium sans tête boucle sur des « souris
  // déplacée » synthétiques et sa mémoire gonfle (incident du 1er novembre) ; le jeu passe en mode sans verrou (setFallback)
  await page.addInitScript(() => { Element.prototype.requestPointerLock = () => Promise.reject(new DOMException('refusée par la capture', 'NotAllowedError')); });
  // les images demandées par la page (requestAnimationFrame) sont suivies : la mise en scène annule celles qui attendent
  // (__annulerImages). Sinon, la dernière image de la boucle du jeu, déjà demandée, passe une fois après la mise en
  // scène : un pas de jeu (orage, bête…) hors de nos pas, à un moment qui dépend de l'affichage
  await page.addInitScript(() => {
    const demander = window.requestAnimationFrame.bind(window), annuler = window.cancelAnimationFrame.bind(window);
    const attente = new Set();
    window.requestAnimationFrame = (f) => { const id = demander((t) => { attente.delete(id); f(t); }); attente.add(id); return id; };
    window.cancelAnimationFrame = (id) => { attente.delete(id); annuler(id); };
    window.__annulerImages = () => { for (const id of attente) annuler(id); attente.clear(); };
  });
  // le son du jeu : un contexte audio hors ligne (48 kHz, jamais démarré, horloge figée). Le contexte réel dépend du
  // périphérique (fréquence, démarrage) et le jeu remplit son bruit avec Math.random (3 s × la fréquence) : la météo
  // changeait d'un lancement à l'autre. La vidéo est muette.
  await page.addInitScript(() => {
    const Hors = window.OfflineAudioContext;
    window.AudioContext = window.webkitAudioContext = function () {
      const c = new Hors(2, 48000, 48000);
      c.resume = c.suspend = c.close = () => Promise.resolve();
      return c;
    };
  });
  // le hasard du jeu : une graine ; __graine le fait repartir au début de la mise en scène (la même partie à chaque
  // passage). Seule la simulation y puise (window.__jeu : mise en scène et avancer) ; un appel venu d'ailleurs (une
  // animation sur l'heure réelle, une minuterie d'avant la mise en scène…) prend un autre hasard, et il est noté
  await page.addInitScript((seed) => {
    const suite = (e) => () => { e.s = (e.s + 0x6d2b79f5) | 0; let t = Math.imul(e.s ^ (e.s >>> 15), 1 | e.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const J = { s: seed >>> 0 }, jeu = suite(J), ailleurs = suite({ s: (seed ^ 0x9e3779b9) >>> 0 });
    const hors = window.__horsJeu = { n: 0, piles: {} };
    Math.random = () => {
      if (window.__jeu) return jeu();
      if (window.__cam) {                              // après la mise en scène : d'où vient l'appel (300 premiers)
        if (++hors.n <= 300) {
          const p = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/\(.*\//, '(').slice(0, 90)).join(' < ');
          hors.piles[p] = (hors.piles[p] || 0) + 1;
        }
      }
      return ailleurs();
    };
    window.__graine = (g) => { J.s = g >>> 0; };
  }, O.graine);
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.ZS && ZS.G && ZS.G.state === 'menu', null, { timeout: 900000, polling: 1000 });
  for (const f of [flashs, miseEnScene, pas, avancer, rendre, bilan]) await page.addScriptTag({ content: f.toString() });
  return { page, erreurs };
}
/* Un dossier de sortie déjà rempli est mis de côté (renommé), jamais effacé. */
function dossierNeuf(d) {
  if (fs.existsSync(d) && fs.readdirSync(d).length) fs.renameSync(d, `${d}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  fs.mkdirSync(OUT, { recursive: true });
  // muet, sans lecture automatique (le contexte audio du jeu est de toute façon hors ligne : voir ouvrir)
  const browser = await chromium.launch({ executablePath: chromiumPath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--autoplay-policy=user-gesture-required', '--mute-audio'] });
  const t0 = Date.now(), regl = { ...O, noyes: 6, fov: 42, ecart: ECART, camera: CAMERA };
  if (CADRAGE) {
    // un seul passage, une image toutes les 10 images de jeu (1/3 s), jusqu'à 4 s après le premier Noyé englouti
    const dossier = dossierNeuf(path.join(OUT, 'images'));
    const { page, erreurs } = await ouvrir(browser);
    garde();
    const prep = await page.evaluate((o) => miseEnScene(o), { ...regl, eclairs: 'limites' });
    const liste = [];
    let fin = null, t1 = null;
    for (let i = 1; i <= 120; i++) {
      garde();
      const e = await page.evaluate(() => avancer(10)), r = await page.evaluate((q) => rendre(q), 0.9);
      fs.writeFileSync(path.join(dossier, `img_${String(i).padStart(5, '0')}.jpg`), Buffer.from(r.url.split(',')[1], 'base64'));
      liste.push({ image: i, t: e.t, bete: e.bete, manges: e.manges, d: e.d, y: e.y });
      if (t1 === null) t1 = e.t - 1 / 3;                // fin de la mise en scène
      // jusqu'à la fin de la fenêtre que rendra la capture (« avant » s avant le bond, pas avant la fin de la mise en
      // scène, puis --duree s), et au moins 4 s après le premier Noyé englouti
      if (fin === null && e.manges > 0 && e.bond !== undefined) fin = Math.max(e.t + 4, Math.max(e.bond - O.avant, t1 + 1 / 30) + O.duree);
      if (fin !== null && e.t >= fin) break;
    }
    const res = await page.evaluate(() => bilan());
    fs.writeFileSync(path.join(OUT, 'cadrage.json'), JSON.stringify({ reglages: regl, etapes: prep.etapes, images: liste, scene: res.scene, journal: res.journal, eclairs: res.eclairs, horsJeu: res.horsJeu }, null, 1));
    await browser.close(); server.close();
    console.log('cadrage :', prep.etapes.join(' · '), `· bond à ${res.bond} s · hasard pris hors du jeu : ${res.horsJeu.n} fois · ${liste.length} images (une par 1/3 s) dans ${dossier} en ${((Date.now() - t0) / 60000).toFixed(1)} min · mémoire disponible au plus bas : ${memoirePlancher.toFixed(1)} Go · ${SOUS_FILE ? 'sous la file zs-lourd' : 'hors de la file'}`);
    if (erreurs.length) console.log('ERREURS DE PAGE', erreurs.slice(0, 5).join(' | '));
    return;
  }
  const DOSSIERS = { limites: dossierNeuf(path.join(OUT, 'images')), aucun: dossierNeuf(path.join(OUT, 'images-sans-eclairs')) };
  // passage 1 : repérage sans rendu (l'instant du bond et de l'engloutissement)
  let { page, erreurs } = await ouvrir(browser);
  garde();
  const prep = await page.evaluate((o) => miseEnScene(o), { ...regl, eclairs: 'limites' });
  let bond = null, mange = null;
  for (let i = 0; i < 30 * 60 && mange === null; i += 15) {
    garde();
    const e = await page.evaluate(() => avancer(15));
    if (bond === null && e.bond !== undefined) bond = e.bond;
    if (e.manges > 0) mange = e.t;
  }
  const rep = await page.evaluate(() => bilan());
  await page.close();
  console.log('repérage :', prep.etapes.join(' · '), `· bond à ${bond} s · englouti à ${mange} s (temps de jeu) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (erreurs.length) console.log('ERREURS DE PAGE (repérage)', erreurs.slice(0, 5).join(' | '));
  if (bond === null || mange === null) { console.error('la bête n’a pas englouti de Noyé en 60 s de jeu : changer --graine'); fs.writeFileSync(path.join(OUT, 'journal-reperage.json'), JSON.stringify(rep, null, 1)); process.exit(1); }
  // passages 2 et 3 : même graine, même mise en scène ; on avance sans rendre jusqu'à « avant » s du bond (pas avant la
  // fin de la mise en scène), puis on rend
  const n = Math.round(O.duree * O.fps), P = {};
  let debut = bond - O.avant;
  for (const mode of ['limites', 'aucun']) {
    ({ page, erreurs } = await ouvrir(browser));
    garde();
    await page.evaluate((o) => miseEnScene(o), { ...regl, eclairs: mode });
    let t = 0;
    while (t < debut - 1 / 30) { garde(); t = (await page.evaluate(() => avancer(1))).t; }
    const lum = [], etats = [];
    for (let i = 0; i < n; i++) {
      garde();
      if (i) await page.evaluate(() => avancer(1));
      const r = await page.evaluate((q) => rendre(q), 0.92);
      fs.writeFileSync(path.join(DOSSIERS[mode], `img_${String(i + 1).padStart(5, '0')}.jpg`), Buffer.from(r.url.split(',')[1], 'base64'));
      lum.push(r.lum); etats.push(r.etat);
      if (i % 30 === 0) console.log(`${mode === 'aucun' ? 'sans éclairs' : 'avec éclairs'} · image ${i + 1}/${n} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    P[mode] = { lum, etats, ...(await page.evaluate(() => bilan())), erreurs: erreurs.slice() };
    await page.close();
  }
  await browser.close(); server.close();
  // l'instant réel de la première image (la mise en scène peut finir après « avant » s du bond)
  debut = parseFloat(P.limites.etats[0]);
  if (bond - debut < O.avant - 0.05) console.log(`la fenêtre commence ${(bond - debut).toFixed(2)} s avant le bond (au lieu de ${O.avant} s) : la mise en scène finit à ${debut.toFixed(2)} s`);
  // contrôles : la même partie aux trois passages, la même scène image par image ; les éclats
  const A = P.limites, B = P.aucun;
  const ecarts = A.etats.reduce((s, e, i) => s + (e !== B.etats[i] ? 1 : 0), 0);
  const memeJournal = JSON.stringify(A.journal) === JSON.stringify(B.journal);
  const eclats = {};
  for (const mode of ['limites', 'aucun']) {
    const L = P[mode].lum, toute = L.map((v) => v[8]);
    eclats[mode] = { parSeconde: Object.fromEntries(SEUILS.map((s) => [s, eclatsParSeconde(L, s, O.fps)])),
      luminance: { min: Math.min(...toute), max: Math.max(...toute) }, images: L };
  }
  const deb = (t) => +(t - debut).toFixed(3);
  fs.writeFileSync(path.join(OUT, 'journal.json'), JSON.stringify({ debut, fps: O.fps, images: n, bond, mange,
    eclairs: A.eclairs.map((E) => ({ ...E, dans: deb(E.t), departs: E.departs.map(deb) })),
    tonnerres: A.tonnerres, evenements: A.journal }, null, 1));
  fs.writeFileSync(path.join(OUT, 'eclats.json'), JSON.stringify({ ecart: ECART, seuils: SEUILS, ...eclats }));
  fs.writeFileSync(path.join(OUT, 'scene.json'), JSON.stringify({ reglages: regl, scene: A.scene, bond, mange, debut,
    controle: { bondRepere: bond, bondAvecEclairs: A.bond, bondSansEclairs: B.bond, imagesDifferentes: ecarts, memeJournal },
    horsJeu: { limites: A.horsJeu, aucun: B.horsJeu },
    date: new Date().toISOString() }, null, 1));
  for (const mode of ['limites', 'aucun']) if (P[mode].erreurs.length) console.log(`ERREURS DE PAGE (${mode})`, P[mode].erreurs.slice(0, 5).join(' | '));
  console.log(`éclairs pendant la fenêtre : ${A.eclairs.filter((E) => E.t >= debut && E.t <= debut + O.duree).length} · départs d'éclat : ${A.departs.filter((t) => t >= debut && t <= debut + O.duree).length}`);
  console.log('éclats par seconde au plus (avec éclairs) :', SEUILS.map((s) => `${s} → ${eclats.limites.parSeconde[s]}`).join(' · '));
  console.log('éclats par seconde au plus (sans éclairs) :', SEUILS.map((s) => `${s} → ${eclats.aucun.parSeconde[s]}`).join(' · '));
  console.log(`hasard pris hors du jeu (avec / sans éclairs) : ${A.horsJeu.n} / ${B.horsJeu.n} fois`);
  console.log(`même partie : bond ${bond} / ${A.bond} / ${B.bond} s · images d'état différent : ${ecarts} sur ${n} · même journal : ${memeJournal ? 'oui' : 'NON'}`);
  console.log(`${n} images par version dans ${OUT} en ${((Date.now() - t0) / 60000).toFixed(1)} min · mémoire disponible au plus bas : ${memoirePlancher.toFixed(1)} Go · ${SOUS_FILE ? 'sous la file zs-lourd' : 'hors de la file'}`);
  const ok = A.bond === bond && B.bond === bond && ecarts === 0 && memeJournal && eclats.limites.parSeconde[0.1] <= 3;
  if (!ok) { console.error('CONTRÔLE NON CONFORME : voir scene.json et eclats.json'); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
