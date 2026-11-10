/* ============================================================ 30 MUSIQUE DU MENU ==
   Musique du menu (jeu 2.0.7, demande d'Anthony du 3 novembre 2026 : « Elle sera jouable tout le temps jusqu'au
   moment où le joueur sera dans une partie »). Son paquet « musique-menu-zombie-survival » (engine/orig/musique-menu-
   zombie-survival/ : musique/menu.mp3, composition originale synthétisée, et sa consigne LISEZMOI-CLAUDE-CODE.md) ;
   le fichier est inséré tel quel par build.py, en base 64 (MENU_MUSIQUE_MP3). Selon la consigne (cas 2 : le jeu
   n'utilise pas le module audio-zombies.js du paquet) :
   · boucle exacte de 0,5 s à 96,5 s du fichier (AudioBufferSourceNode : loopStart, loopEnd ; le fichier a 0,5 s de
     marge de chaque côté) ; elle ne repart jamais du début en changeant de sous-menu ;
   · au menu (refreshMenu : démarrage, retour d'une partie, sauvegarde reprise impossible) : fondu d'entrée de 2 s ;
     sans effet si elle joue déjà ; au tout premier clic ou à la première touche si le navigateur bloque le son ;
   · au début d'une partie (startGame, reprise d'une sauvegarde comprise) : fondu de sortie d'1 s ; la musique
     d'arrivée suit au début de la première manche (section 28) ;
   · dans le bus de la musique (Sound.musiqueBus : réglage « Musique ») ; jamais dans les Mod Tools.
   ============================================================================ */
const MENU_MUSIQUE = {
  gain: 1,                                    // volume avant le réglage « Musique » (1 : le fichier tel quel)
  boucle: [0.5, 96.5],                        // s du fichier (consigne du paquet)
  entree: 2, sortie: 1,                       // fondus, en secondes
  ctx: null, prep: null, buf: null, src: null, g: null, on: false, err: null,
};
const menuMusiqueModTools = () => !!window.zsModtools || (typeof CUR !== 'undefined' && !!CUR.editor);
function menuMusiquePrepare() {
  const b = Sound.musiqueBus && Sound.musiqueBus();
  if (!b || typeof MENU_MUSIQUE_MP3 !== 'string') return null;
  if (MENU_MUSIQUE.prep && MENU_MUSIQUE.ctx === b.ctx) return MENU_MUSIQUE.prep;
  const ctx = b.ctx;
  MENU_MUSIQUE.ctx = ctx; MENU_MUSIQUE.buf = null; MENU_MUSIQUE.err = null;
  try {
    MENU_MUSIQUE.prep = sonMp3(ctx, MENU_MUSIQUE_MP3).then((buf) => { if (MENU_MUSIQUE.ctx === ctx) MENU_MUSIQUE.buf = buf; }, (e) => { MENU_MUSIQUE.err = String((e && e.message) || e); });
  } catch (e) { MENU_MUSIQUE.err = String((e && e.message) || e); MENU_MUSIQUE.prep = Promise.resolve(); }
  return MENU_MUSIQUE.prep;
}
/* Au menu : la musique en boucle, avec son fondu d'entrée ; rien si elle joue déjà. */
function menuMusique() {
  if (G.state !== 'menu' || menuMusiqueModTools() || MENU_MUSIQUE.on) return;
  Sound.init();
  const prep = menuMusiquePrepare();
  if (!prep) return;
  MENU_MUSIQUE.on = true;
  prep.then(() => {
    const b = Sound.musiqueBus && Sound.musiqueBus(), buf = MENU_MUSIQUE.buf;
    if (!MENU_MUSIQUE.on || G.state !== 'menu' || !b || !buf || MENU_MUSIQUE.src) { if (!buf) MENU_MUSIQUE.on = false; return; }
    const ctx = b.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    src.buffer = buf; src.loop = true; src.loopStart = MENU_MUSIQUE.boucle[0]; src.loopEnd = Math.min(MENU_MUSIQUE.boucle[1], buf.duration);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(MENU_MUSIQUE.gain, t + MENU_MUSIQUE.entree);
    src.connect(g); g.connect(b.sortie);
    src.start(t, MENU_MUSIQUE.boucle[0]);
    MENU_MUSIQUE.src = src; MENU_MUSIQUE.g = g;
  });
}
/* Début d'une partie : fondu de sortie. */
function menuMusiqueArret(fondu = MENU_MUSIQUE.sortie) {
  MENU_MUSIQUE.on = false;
  const src = MENU_MUSIQUE.src, g = MENU_MUSIQUE.g;
  MENU_MUSIQUE.src = null; MENU_MUSIQUE.g = null;
  if (!src) return;
  try {
    const t = src.context.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fondu);
    src.stop(t + fondu + 0.05);
  } catch (e) { try { src.stop(); } catch (e2) { /* déjà arrêtée */ } }
}
/* Le navigateur bloque le son tant que le joueur n'a ni cliqué ni appuyé : le premier geste le libère (Sound.init
   relance le contexte audio) ; la musique, déjà programmée, part alors. */
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (G.state === 'menu' && !menuMusiqueModTools()) { Sound.init(); menuMusique(); } }, { capture: true });
