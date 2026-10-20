/* ======================================================================== 20 POINTS ==
   HUD « portrait + points » (jeu 2.0.6, demande d'Anthony du 20 octobre 2026). Son paquet (engine/orig/hud-points/ :
   hud-points.js, police Teko et portrait d'Anthony intégrés, et la licence de la police) est inséré tel quel par
   build.py ; ce module le branche sur le jeu sans le retoucher (son INTEGRATION.md, étape 5, « solution
   recommandée ») :
   · une seule source de vérité : G.points (addPoints, trySpend, double points, digi pass : tout reste au jeu) ; le
     HUD reçoit le total une fois par image (ptsHudFrame) et calcule lui-même la bulle « +X » ou « −X » de la
     différence : les gains d'une même image (plombs d'un fusil à pompe) font une seule bulle, comme l'ancien
     affichage qui les regroupait ;
   · achat refusé (trySpend sans assez de points) : secousse rouge (HUD.denied) ;
   · nouvelle partie, sauvegarde reprise : total posé sans bulle ; digi pass : « ∞ » (le module n'affiche que des
     nombres : le texte est remplacé après lui) ;
   · place : en bas à gauche, au-dessus du bloc des manches (atouts, compteur de manches, oxygène sur la Lune), à
     gauche aligné sur lui ; il monte avec lui quand des atouts ou l'oxygène s'y ajoutent ;
   · visible en partie seulement : caché au menu, en pause, en fin de partie, pendant les scènes, dans les Mod Tools
     (hors partie de test) ; l'ancien affichage des points (en bas à droite) est masqué, sa valeur reste tenue à jour ;
   · coop (préparée) : ptsHudCoequipier ajoute un coéquipier au-dessus du joueur (son API addPlayer).
   Sans le module (fichier absent, erreur à la création) : l'affichage d'avant reste.
   ============================================================================ */
const PTS_HUD = {
  on: true,                                   // false : l'affichage des points d'avant (en bas à droite)
  ecart: 12,                                  // px entre le haut du bloc des manches et le bas du portrait
  nom: 'Anthony',
  hud: null, val: null, vu: null, err: null,
};
const ptsHudOn = () => !!PTS_HUD.hud;
/* Création, une fois (HUD.init, au chargement) : dans le bloc du bas à gauche, juste au-dessus de son contenu. */
function ptsHudInit() {
  if (!PTS_HUD.on || PTS_HUD.hud || typeof PointsHud !== 'object' || !PointsHud || typeof PointsHud.create !== 'function') return;
  try {
    const H = PointsHud.create({ points: Math.max(0, G.points | 0), name: PTS_HUD.nom, container: $('bl'), left: 0, bottom: `calc(100% + ${PTS_HUD.ecart}px)` });
    PTS_HUD.hud = H;
    PTS_HUD.val = H.local.element.querySelector('.zs-points__value');
    H.setVisible(false); PTS_HUD.vu = false;
    document.body.classList.add('zs-pts');
  } catch (e) {
    console.warn('HUD des points', e);
    PTS_HUD.err = String((e && e.message) || e); PTS_HUD.hud = null;
    document.body.classList.remove('zs-pts');
  }
}
/* Digi pass : « ∞ » à la place du nombre (après chaque rendu du module). */
function ptsHudInfini() {
  const v = PTS_HUD.val;
  if (v && G.cheat && v.textContent !== '∞') v.textContent = '∞';
}
function ptsHudSync(popup) {
  const H = PTS_HUD.hud;
  if (!H) return;
  try {
    if (H.getPoints() !== G.points) H.setPoints(G.points, { popup });
  } catch (e) {
    if (!PTS_HUD.err) { console.error('HUD des points', e); PTS_HUD.err = String((e && e.message) || e); }
  }
  ptsHudInfini();
}
/* Chaque image (update et render) : visibilité, puis total du jeu (bulle de la différence). */
function ptsHudFrame() {
  const H = PTS_HUD.hud;
  if (!H) return;
  const vu = G.state === 'playing' && !HUD.el.hud.hidden && !viewCamera;
  if (vu !== PTS_HUD.vu) { H.setVisible(vu); PTS_HUD.vu = vu; }
  ptsHudSync(true);
}
/* Nouvelle partie, sauvegarde reprise, digi pass : le total posé sans bulle, nombre ou « ∞ » redessiné. */
function ptsHudFull() {
  const H = PTS_HUD.hud;
  if (!H) return;
  ptsHudSync(false);
  if (!G.cheat) H.setName(PTS_HUD.nom);                       // redessine le nombre (après un « ∞ »)
  ptsHudInfini();
  ptsHudFrame();
}
/* Achat refusé : secousse rouge du nombre (le jeu n'a rien changé). */
function ptsHudRefuse() { if (PTS_HUD.hud) PTS_HUD.hud.refuse(); }
/* Coop (préparée) : un coéquipier au-dessus du joueur, plus petit (vert, bleu, blanc) ; même objet que le joueur
   local (setPoints, refuse…). o : { id, name, points, portrait, color }. */
function ptsHudCoequipier(o) { return PTS_HUD.hud ? PTS_HUD.hud.addPlayer(o) : null; }
