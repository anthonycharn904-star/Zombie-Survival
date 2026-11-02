/* ================================================================ Confort (Marécages Maudits) ==
   Décisions d'Anthony du 1er novembre 2026, pour l'intégration du marais dans le moteur :
     · « les secousses de caméra devront être désactivées par défaut » ; réactivables plus tard dans les réglages du
       jeu. Les animations des créatures et de la barque restent : seule la caméra ne bouge plus d'elle-même (secousses
       des attaques, de la bête, de la foudre, de la barque ; balancement de la nage ; roulis et à-coups de la barque
       dans la vue du barreur ; vue secouée du nageur tenu sous l'eau) ;
     · « limite les flashs lumineux excessifs ou répétitifs » et « une option permettant de réduire les effets lumineux
       intenses pour les joueurs sensibles » : la lumière des éclairs (orage, éclair rouge des Stryges) passe par une
       garde (maFlashGarde, plus bas) ; les scintillements tirés au hasard à chaque image deviennent des battements lents.
   Les deux réglages sont lus dans ceux du jeu (settings, enregistrés sous « zs.settings ») ; le jour où le menu des
   options les proposera (session Interface), il suffira qu'il y écrive :
     settings.shake   = true         secousses et balancements de la caméra du marais, comme dans le kit
     settings.flashes = 'reduced'    effets lumineux réduits ('limited', ou rien : limités, le réglage par défaut)
   Les secousses du jeu de base (dégâts, explosions, véhicules de Khamsin) ne dépendent pas de ces réglages : les
   brancher aussi changerait les autres cartes (décision d'Anthony).
   ============================================================================================ */
function maSecoue() { return settings.shake === true; }
/* Une secousse du marais : FX.shake comme dans le kit (même force, même plafond), seulement si elle est réglée. */
function maSecousse(v, max = 1) { if (maSecoue()) FX.shake = Math.min(max, FX.shake + v); }
/* Les mouvements continus de la caméra (balancement, roulis) : leur part, 1 si réglés, 0 sinon. */
function maBalance() { return maSecoue() ? 1 : 0; }
/* Les secousses et à-coups de la vue venus du jeu de base (coups reçus, morsures, grenades et explosions, Glas,
   véhicules) : coupés dans le marais tant que settings.shake n'est pas réglé (décision d'Anthony du 2 novembre 2026),
   inchangés sur les autres cartes. Appelée là où le moteur les applique à la caméra (retouches/confort.py). */
function maSecousseVue() { return OW.on && OW.worldId === 'marais' && !maSecoue() ? 0 : 1; }
function maFlashsReduits() { return settings.flashes === 'reduced'; }
/* L'éblouissement (voile blanc du HUD, HUD.flash du jeu de base) : moins fort, ou rien en effets réduits. */
function maEblouir() { if (maFlashsReduits()) return; HUD.flashK = Math.max(HUD.flashK || 0, 0.45); }
/* Un scintillement tiré au hasard à chaque image (strobe) devient un battement lent (2,4 battements par seconde au
   plus) entre lo et 1 ; en effets réduits, une lueur fixe. */
function maBat(lo, t) { return maFlashsReduits() ? (1 + lo) / 2 : lo + (1 - lo) * (0.5 + 0.5 * Math.sin(t * 15)); }

/* ---------------------------------------------------------------- Garde des flashs --
   Toute la lumière des éclairs du marais (la scène, le ciel, la brume, l'eau, la pluie : MA_OR.F, ma18 ; l'éclair rouge
   d'une Stryge, ma19, y passe aussi) est réglée ici, une fois par image, après leur somme. On suit y, ce qui éclaire
   le plus l'écran : l'ambiante (brume, ciel, eau), plus 0,15 × la directe et 0,3 × le ciel.
     · chaque éclair suit une enveloppe (maFlashV) : il s'allume d'un coup mais s'éteint moins vite entre deux arcs en
       retour (60 ms), si bien que des arcs très rapprochés se fondent en un éclair qui vacille ;
     · le pic est adouci au-delà d'un plafond (tangente hyperbolique) ;
     · un flash, comme le compte le critère 2.3.1 des WCAG, est une montée de la lumière puis une descente d'au moins
       un seuil. La lumière ne peut monter de plus de th (0,1) que pendant une « montée » permise : au plus 0,1 s, finie
       dès qu'elle redescend de th, et permise seulement 0,55 s après le début de la précédente ; le reste du temps,
       elle ne fait que baisser (ou monter de moins de th). Un éclair qui tombe hors d'une montée permise n'allume pas
       la scène (supprimé, jamais retardé). D'où, quel que soit le seuil à partir de th, jamais plus de 3 flashs dans
       une seconde (deux débuts espacés de 1,1 s, moins une montée de 0,1 s ; essais/flashs.js le vérifie).
   Effets réduits : l'éclair monte en 60 ms et redescend en 350 ms, une montée au plus toutes les 2 s et seulement après
   1 s de pénombre (jamais plus d'un flash par seconde), plafond bas, lumière rouge désaturée (les flashs rouges
   saturés sont les plus pénibles), pas de voile blanc.
   Les formes des éclairs, leurs impacts, leur tonnerre et les dégâts ne changent pas. */
const MA_FLG = { dt: 1 / 60, montee: false, tS: -99, haut: 0, bas: 0, y: 0, sombre: 99, retenu: false, k: 1,
  lim: { th: 0.1, gap: 0.55, R: 0.1, calme: 0, cap: 2.6, att: 0, rel: 0.06 },
  red: { th: 0.1, gap: 2.0, R: 0.15, calme: 1.0, cap: 0.9, att: 0.06, rel: 0.35 } };
function maFlashCfg() { return maFlashsReduits() ? MA_FLG.red : MA_FLG.lim; }
/* L'enveloppe d'un éclair (o : l'éclair, sa trace dans o.env), v : la valeur de ses impulsions à cet instant. */
function maFlashV(o, v) {
  const C = maFlashCfg(), dt = MA_FLG.dt;
  let e = o.env || 0;
  if (v > e) e = C.att > 0 ? e + (v - e) * (1 - Math.exp(-dt / C.att)) : v;
  else e = Math.max(v, e * Math.exp(-dt / C.rel));
  o.env = e;
  return e;
}
/* Après la somme des éclairs de l'image (maFlashUpdate) : plafond, montées permises, couleur en effets réduits. */
function maFlashGarde() {
  const F = MA_OR.F, C = maFlashCfg(), Q = MA_FLG, t = OW.t || 0;
  if (t < Q.tS) Q.tS = -99;                                  // nouvelle partie : l'horloge du monde est repartie
  const y0 = F.amb + 0.15 * F.i + 0.3 * F.sky;
  let y = y0;
  if (y > 1e-4) { const k = C.cap * Math.tanh(y / C.cap) / y; F.i *= k; F.amb *= k; F.sky *= k; y *= k; }
  let out = y;
  if (Q.montee && (t - Q.tS > C.R || Q.haut - y >= C.th)) { Q.montee = false; Q.bas = Math.min(Q.y, y); }   // fin de la montée
  if (Q.montee) Q.haut = Math.max(Q.haut, y);
  else {
    const plafond = Math.max(Q.y, Q.bas + 0.95 * C.th);      // hors d'une montée : baisser, ou monter de moins de th
    if (Q.retenu && y <= plafond) Q.retenu = false;          // l'éclair retenu est retombé
    if (y > plafond) {
      if (!Q.retenu && y - Q.bas >= C.th && t - Q.tS >= C.gap && Q.sombre >= C.calme) { Q.montee = true; Q.tS = t; Q.haut = y; }
      else { out = plafond; Q.retenu = true; }
    }
    if (!Q.montee) Q.bas = Math.min(Q.bas, out);
  }
  if (out < y) { const k = out / y; F.i *= k; F.amb *= k; F.sky *= k; }
  Q.sombre = out < 1e-3 ? Q.sombre + Q.dt : 0;
  Q.y = out;
  Q.k = y0 > 1e-4 ? out / y0 : 1;                            // part gardée (lumières locales des impacts : image suivante)
  if (maFlashsReduits() && F.i + F.amb > 0) {                // effets réduits : la lumière rouge d'une Stryge, désaturée
    const l = (F.col.r + F.col.g + F.col.b) / 3;
    F.col.setRGB(lerp(F.col.r, l, 0.65), lerp(F.col.g, l, 0.65), lerp(F.col.b, l, 0.65));
  }
}
function maFlashReset() { const Q = MA_FLG; Q.montee = Q.retenu = false; Q.tS = -99; Q.haut = Q.bas = Q.y = 0; Q.sombre = 99; Q.k = 1; }
