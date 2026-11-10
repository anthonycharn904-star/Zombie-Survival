'use strict';
/* Scène de la Mère-Vase : de la suite d'images capturées à la vidéo du fond animé (WebM, VP9), en boucle sans coupure,
   et à l'image fixe de secours. Léger : ffmpeg seul, aucun navigateur, aucun script du kit.

     node maquettes/launcher/scene-bete/encoder.js <dossier d'images> [--fps 30] [--fondu 1] [--qualite 28]
                                                   [--debit 8000000] [--sortie <fichier .webm>]
                                                   [--journal <journal.json de capturer.js>]

   À côté de la vidéo, <sortie>.json : la boucle (images, fondu) et, avec --journal, l'instant de chaque éclair dans la
   boucle (le tonnerre du launcher part dessus ; un éclair effacé à plus de moitié par le fondu n'a pas de tonnerre).

   La boucle (fondu cuit dans le fichier, la balise <video loop> suffit) : N images capturées, M images de fondu (M ≤ L) ;
   la vidéo fait L = N − M images : O[i] = F[i] pour i ≥ M, et O[i] = mélange de F[i + L] (la suite de la fin) et de
   F[i] (le début), de 0 à 1, pour i < M. Au raccord, O[L − 1] = F[L − 1] est suivie de O[0] = F[L] : deux images qui
   se suivent dans la capture. L'image de secours (affiche) est F[M], une image pure.

   L'encodage passe par ffmpeg (paquet Ubuntu) depuis le 2 novembre 2026, avec l'accord d'Anthony. Avant, MediaRecorder
   (Chromium) datait chaque image à l'horloge réelle : 327 images au lieu de 330 et des écarts de 15 à 82 ms entre deux
   images sur la vidéo d'essai.
   - Toutes les images sont d'abord décodées une fois (ffprobe) : une image illisible ou d'une autre taille arrête tout,
     car ffmpeg la remplacerait sans rien dire (par sa voisine, ou mise à l'échelle) et le compte des images resterait
     juste.
   - ffmpeg décode les images, ce script fait le fondu (mêmes poids qu'avant) et passe les images brutes à l'encodeur :
     VP9 (libvpx) en deux passes, en qualité contrainte (mode CQ de libvpx, choisi quand -crf et -b:v sont donnés
     ensemble). --qualite (le CRF, de 0 à 63, plus petit = plus fidèle) fixe le niveau visé, --debit (bits par seconde)
     plafonne le débit moyen. Loin du plafond, libvpx code plus fin que le CRF : sur l'essai 2D au CRF 40, 270 images sur
     330 au niveau de quantification 139 au lieu de 160 ; il code plus grossier quand le plafond mord.
   - Exactement --fps images par seconde ; image clé imposée au début seulement (libvpx en ajoute aux éclairs).
   - Couleurs inscrites dans le fichier : matrice BT.709 en plage limitée, primaires BT.709, transfert sRGB (celui des
     images).
   - La vidéo s'écrit dans <sortie>.partiel.webm (ignoré par Git comme tout .webm), est relue, puis renommée : une
     erreur ne remplace rien. ffmpeg et ce script tournent en priorité basse (nice 10).
   Codes de sortie : 0 réussi ; 2 réglages, journal, images ou outils invalides (rien n'est écrit) ; 1 erreur d'encodage
   ou vidéo relue non conforme ; 129, 130 ou 143 arrêté par un signal (vidéo partielle et journal des passes effacés).
   Mesures du 2 novembre 2026, sur les 360 images d'essai en 2D (1 600 × 620, boucle de 330 images ; README, §3 bis) :
   mêmes images et mêmes réglages donnent le même fichier, à l'octet (ffmpeg 6.1.1, libvpx 1.14.0, ces options) ;
   environ 0,6 Go de mémoire au plus (commande directe, sous le seuil de 1 Go) ; 1 à 2 min. CRF 40 : 2,4 Mo, plus
   fidèle que l'ancienne vidéo (3,7 Mo) ; CRF 44 : sa fidélité moyenne, 1,7 Mo ; CRF 32 : 4,2 Mo.
   Réglages par défaut, choisis par Anthony le 2 novembre 2026 sur la vraie capture (boucle de 7,7 s), parmi les CRF
   28, 32, 36 et 40 regardés agrandis deux fois : CRF 28 (4,5 Mo par version, le plus d'écume et de pluie gardé) et
   fondu d'une seconde. Le CRF 28 dépasse 4,5 Mbit/s en moyenne : le plafond est à 8 Mbit/s pour ne pas le brider. */
const path = require('path'), fs = require('fs'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const refus = (texte) => { console.error(texte); process.exit(2); };
const DOSSIER = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : '');
const FPS = +val('--fps', 30), FONDU = +val('--fondu', 1), QUALITE = +val('--qualite', 28), DEBIT = +val('--debit', 8000000);
const SORTIE = path.resolve(val('--sortie', path.join(DOSSIER, '..', 'fond-marais.webm')));
const JOURNAL = val('--journal', null);
if (!argv[0] || !fs.existsSync(DOSSIER)) refus('usage : node encoder.js <dossier d’images img_00001.jpg…> [options]');
if (!(FPS > 0) || !(FONDU >= 0) || !(Number.isInteger(QUALITE) && QUALITE >= 0 && QUALITE <= 63) || !(DEBIT > 0) || !/\.webm$/.test(SORTIE)) {
  refus('réglages invalides : --fps > 0, --fondu ≥ 0, --qualite entier de 0 à 63, --debit > 0, --sortie en .webm');
}
// le journal est lu avant l'encodage : une erreur ne laisse pas une vidéo neuve avec une chronologie périmée
let J = null;
if (JOURNAL) { try { J = JSON.parse(fs.readFileSync(JOURNAL, 'utf8')); } catch (e) { refus(`journal illisible : ${JOURNAL} (${e.message})`); } }
const images = fs.readdirSync(DOSSIER).filter((f) => /^img_\d+\.(jpe?g|png|webp)$/.test(f)).sort();
const M = Math.round(FONDU * FPS), N = images.length, L = N - M;
if (L < FPS || M > L) refus(`trop peu d'images (${N}) pour ${M} images de fondu : il en faut au moins ${M + Math.max(M, Math.ceil(FPS))}`);
// ffmpeg lit la suite par un motif (img_%05d.jpg) : numéros qui se suivent, même largeur, même extension
const [, chiffres, EXT] = /^img_(\d+)\.(\w+)$/.exec(images[0]);
const PREMIER = +chiffres, nom = (k) => `img_${String(PREMIER + k).padStart(chiffres.length, '0')}.${EXT}`;
const rompue = images.findIndex((f, k) => f !== nom(k));
if (rompue >= 0) refus(`suite d'images rompue : ${images[rompue]} au lieu de ${nom(rompue)}`);
const MOTIF = path.join(DOSSIER.replace(/%/g, '%%'), `img_%0${chiffres.length}d.${EXT}`);
const ff = spawnSync('ffmpeg', ['-hide_banner', '-h', 'encoder=libvpx-vp9'], { encoding: 'utf8' });
if (ff.error || ff.status || !/^Encoder libvpx-vp9 /m.test(ff.stdout || '')) refus('ffmpeg avec libvpx-vp9 introuvable (paquet Ubuntu ffmpeg)');
if (spawnSync('ffprobe', ['-version']).error) refus('ffprobe introuvable (paquet Ubuntu ffmpeg)');
// toutes les images décodées une fois : le numéro (pts) et la taille de chacune, sans erreur de décodage tolérée
const essai = spawnSync('ffprobe', ['-v', 'error', '-err_detect', 'explode', '-f', 'image2', '-framerate', String(FPS), '-start_number', String(PREMIER),
  '-i', MOTIF, '-show_entries', 'frame=pts,width,height', '-of', 'json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
let decodees = [];
try { decodees = JSON.parse(essai.stdout).frames || []; } catch (e) { /* sortie illisible : refusée ci-dessous */ }
const W = decodees[0] && decodees[0].width, H = decodees[0] && decodees[0].height;
const fautive = images.findIndex((f, k) => !decodees[k] || +decodees[k].pts !== k || decodees[k].width !== W || decodees[k].height !== H);
if (essai.error || essai.status || !(W > 0 && H > 0) || fautive >= 0 || decodees.length !== N) {
  refus(`image illisible ou d'une autre taille : ${images[fautive >= 0 ? fautive : 0]} (${decodees.length} images lues sur ${N}${essai.stderr ? ' ; ' + essai.stderr.trim().split('\n')[0] : ''})`);
}
const T = W * H * 3;                                   // octets d'une image brute (RVB, 8 bits)
const sonde = (args) => {
  const r = spawnSync('ffprobe', ['-v', 'error', ...args, '-of', 'json'], { encoding: 'utf8' });
  if (r.error || r.status) throw new Error(`ffprobe : ${r.error ? r.error.message : r.stderr.trim()}`);
  return JSON.parse(r.stdout);
};

// images brutes d'un flux, une à une (les morceaux du tube ne tombent pas sur les limites des images)
async function* trames(flux) {
  let t = Buffer.allocUnsafe(T), n = 0;
  for await (const morceau of flux) {
    for (let p = 0; p < morceau.length;) {
      const k = Math.min(T - n, morceau.length - p);
      morceau.copy(t, n, p, p + k); n += k; p += k;
      if (n === T) { yield t; t = Buffer.allocUnsafe(T); n = 0; }
    }
  }
  if (n) throw new Error(`image incomplète en fin de flux (${n} octets sur ${T})`);
}
// image du fondu : la suite de la fin, puis le début par-dessus avec le poids a
const melange = (fin, debut, a) => {
  const o = Buffer.allocUnsafe(T);
  for (let k = 0; k < T; k++) o[k] = Math.round(fin[k] + (debut[k] - fin[k]) * a);
  return o;
};

(async () => {
  const t0 = Date.now();
  try { if (os.getPriority() < 10) os.setPriority(10); } catch (e) { /* priorité laissée telle quelle */ }
  const enfants = new Set(), dossierPasses = fs.mkdtempSync(path.join(os.tmpdir(), 'encoder-vp9-')), passes = path.join(dossierPasses, 'passe');
  const partiel = SORTIE.replace(/\.webm$/, '.partiel.webm');
  const ffmpeg = (args, stdio) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', ...args], { stdio });
    enfants.add(p); p.on('close', () => enfants.delete(p));
    return p;
  };
  const fini = (p, quoi) => {
    const f = new Promise((ok, ko) => { p.on('error', ko); p.on('close', (code, sig) => (code === 0 ? ok() : ko(new Error(`${quoi} : ffmpeg ${sig ? 'tué (' + sig + ')' : 'code ' + code}`)))); });
    f.catch(() => {});                                 // attendue plus loin ; évite une alerte si une autre erreur passe avant
    return f;
  };
  // décodage : s'arrête à la première erreur (le compte des images le dit), au cas où une image changerait en route
  const decoder = (debut, nombre) => ffmpeg(['-xerror', '-err_detect', 'explode', '-framerate', String(FPS), '-start_number', String(PREMIER + debut), '-i', MOTIF,
    '-frames:v', String(nombre), '-sws_flags', 'accurate_rnd+full_chroma_int+bitexact', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], ['ignore', 'pipe', 'inherit']);
  // arrêté de l'extérieur : pas de ffmpeg orphelin, pas de vidéo partielle ni de journal des passes laissés derrière
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    process.on(sig, () => {
      for (const p of enfants) p.kill('SIGKILL');
      fs.rmSync(partiel, { force: true }); fs.rmSync(dossierPasses, { recursive: true, force: true });
      process.exit(code);
    });
  }
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  let s;
  try {
    // la fin de la capture (les M images qui se mêlent au début de la boucle), gardée pour les deux passes
    const fin = [];
    if (M) {
      const d = decoder(L, M), fd = fini(d, 'décodage de la fin de la capture');
      for await (const t of trames(d.stdout)) fin.push(t);
      await fd;
      if (fin.length !== M) throw new Error(`fin de la capture : ${fin.length} images décodées sur ${M}`);
    }
    for (const passe of [1, 2]) {
      const e = ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0',
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+bitexact,format=yuv420p',
        '-c:v', 'libvpx-vp9', '-crf', String(QUALITE), '-b:v', String(DEBIT), '-deadline', 'good', '-cpu-used', passe === 1 ? '4' : '1',
        '-row-mt', '1', '-tile-columns', '2', '-threads', '4', '-auto-alt-ref', '1', '-lag-in-frames', '25', '-g', String(L),
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
        '-pass', String(passe), '-passlogfile', passes, '-an',
        ...(passe === 1 ? ['-f', 'null', '-'] : ['-fflags', '+bitexact', '-f', 'webm', '-y', partiel])], ['pipe', 'ignore', 'inherit']);
      const fe = fini(e, `encodage, passe ${passe}`);
      let tout = false;                                // toutes les images données : la fin de ffmpeg est alors normale
      const arret = new Promise((ok, ko) => e.on('close', (code) => { if (!tout) ko(new Error(`encodage, passe ${passe} : ffmpeg arrêté (code ${code}) avant la fin des images`)); }));
      arret.catch(() => {});
      e.stdin.on('error', () => { /* tube rompu : l'arrêt de ffmpeg le dit */ });
      const d = decoder(0, L), fd = fini(d, `décodage, passe ${passe}`);
      let i = 0;
      for await (const t of trames(d.stdout)) {
        const a = (i + 0.5) / M;                       // de la suite de la fin vers le début
        if (!e.stdin.write(i < M ? melange(fin[i], t, a) : t)) await Promise.race([new Promise((ok) => e.stdin.once('drain', ok)), arret]);
        i++;
      }
      await fd;
      if (i !== L) throw new Error(`décodage, passe ${passe} : ${i} images sur ${L}`);
      tout = true; e.stdin.end();
      await fe;
      console.log(`passe ${passe} faite (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    // contrôle avant de remplacer quoi que ce soit : la vidéo se relit (images comptées une à une, dimensions, couleurs)
    s = sonde(['-count_packets', '-select_streams', 'v:0', '-show_entries',
      'stream=codec_name,width,height,nb_read_packets,color_range,color_space,color_transfer,color_primaries:format=duration', partiel]);
    const v = s.streams[0];
    if (v.codec_name !== 'vp9' || v.width !== W || v.height !== H || +v.nb_read_packets !== L) throw new Error(`vidéo relue non conforme : ${JSON.stringify(v)}`);
  } catch (err) {
    for (const p of enfants) p.kill('SIGKILL');
    fs.rmSync(partiel, { force: true });
    throw err;
  } finally {
    fs.rmSync(dossierPasses, { recursive: true, force: true });
  }
  // les éclairs dans la boucle : l'image j de la capture est l'image j de la vidéo (M ≤ j < L), ou s'y mêle pendant le
  // fondu (j < M : elle apparaît ; j ≥ L : elle s'efface, au début de la vidéo)
  const boucle = { fps: FPS, images: L, fondu: M, duree: +(L / FPS).toFixed(3), eclairs: [] };
  if (J) {
    for (const E of J.eclairs || []) {
      if (!E.departs || !E.departs.length) continue;               // aucun éclat gardé : pas d'éclair, pas de tonnerre
      const j = Math.round(E.departs[0] * FPS);
      let image = -1, poids = 0;
      if (j >= M && j < L) { image = j; poids = 1; } else if (j >= 0 && j < M) { image = j; poids = (j + 0.5) / M; } else if (j >= L && j < N) { image = j - L; poids = 1 - (j - L + 0.5) / M; }
      if (image >= 0 && poids >= 0.5) boucle.eclairs.push({ t: +(image / FPS).toFixed(3), x: E.x, d: E.d, bond: !!E.bond });
    }
    boucle.eclairs.sort((a, b) => a.t - b.t);
  }
  const affiche = SORTIE.replace(/\.webm$/, '-affiche.jpg'), v = s.streams[0];
  fs.copyFileSync(path.join(DOSSIER, images[M]), affiche);
  fs.writeFileSync(SORTIE.replace(/\.webm$/, '.json'), JSON.stringify(boucle, null, 1));
  fs.renameSync(partiel, SORTIE);
  console.log(`${path.basename(SORTIE)} : ${L} images (${(L / FPS).toFixed(1)} s, fondu de ${M} images), ${W} × ${H}, VP9 en deux passes (CRF ${QUALITE}), ${(fs.statSync(SORTIE).size / 1e6).toFixed(2)} Mo ; relue : ${v.nb_read_packets} images, ${(+s.format.duration).toFixed(3)} s, couleurs ${v.color_space}/${v.color_primaries}/${v.color_transfer}/${v.color_range} ; affiche ${path.basename(affiche)} ; éclairs dans la boucle : ${J ? boucle.eclairs.length : '—'} ; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch((e) => { console.error(e); process.exit(1); });
