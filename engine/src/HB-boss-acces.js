/* ============================================================== 26 ACCÈS AU BOSS ==
   Déclenchement et fin du combat du boss de Bunker 7 (jeu 2.0.7, étape 8 du brief, §7 ; suivi : SUIVI-BOSS-B7.md).
   · Digi pass de Bunker 7 (décisions d'Anthony du 1er novembre 2026) : en plus de son code secret, il accepte le code du
     boss, une fois par partie (ensuite : « Code erroné »), et le combat démarre (fondu, salle secrète). Le code du boss
     ne s'écrit nulle part en clair : le jeu ne garde que son empreinte (B7_CODE_EMPREINTE : FNV-1a 32 bits salée, comme
     le digi pass ; outil : engine/tools/empreinte-code-boss.js). Le digi pass reste en place quel que soit le code tapé ;
     il disparaît quand les deux codes ont été tapés dans la partie (son code secret ne le fait plus disparaître à lui
     seul). Ailleurs (autre carte, boss absent) : le digi pass d'avant.
   · Phase 5 : toutes les portes de Bunker 7 s'ouvrent, gratuitement, sans compter dans les statistiques du joueur.
   · Points de Bunker 7 (réveil de la phase 5, apparitions du Septième, retour après la victoire, zombies du combat et
     failles des chiens de la phase 5) : BOSS_B7_ARENE.bunker7 (engine/boss-b7/arene.js).
   · Première entrée dans la salle pendant le combat (introduction : écran noir) : les matières de la salle, du Septième,
     de ses effets, des mini-boss et des petits Démembrés sont compilées d'un coup (b7Precompiler), une fois par session,
     au lieu d'à-coups pendant le combat.
   · Fin de partie pendant le combat (étape 9) : la musique et les sons du combat s'éteignent (le jeu joue sa fin de
     partie) ; retour au menu (Mod Tools compris) : le combat est remis à zéro comme à une nouvelle partie (ni musique,
     ni Septième, ni effets, ni voile, ni obscurité au menu).
   ============================================================================ */
const B7_CODE_EMPREINTE = 0xf82e5eae;         // empreinte du code du boss, donnée par Anthony le 1er novembre 2026 (un seul code à 4 chiffres, distinct du code secret)
const B7A = {
  empreinte: B7_CODE_EMPREINTE,
  codes: { secret: false, boss: false },      // codes tapés dans la partie
  compile: false, ms: 0, programmes: 0,       // matières compilées à la première entrée dans la salle (une fois)
};
function b7CodeEmpreinte(code) {
  let h = 0x811c9dc5;
  for (const ch of `zs-boss-b7:${code}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
/* Le code du boss peut-il servir ici ? Bunker 7 avec sa salle (une grille modifiée peut la refuser), combat créé,
   empreinte posée. */
function b7AccesBoss() { return B7A.empreinte != null && b7Carte() && B7S.actif && !!B7.combat; }

/* ----------------------------------------------------------- Digi pass --- */
/* Code tapé (updateKeypad) : 'secret' (celui du digi pass), 'boss' (une fois par partie, si le combat peut démarrer) ou
   null (« Code erroné »). */
function b7CodeDigipass(code) {
  if (digipassHash(code) === DIGIPASS_HASH) return 'secret';
  if (b7AccesBoss() && !B7A.codes.boss && B7.etat === 'inactif' && b7CodeEmpreinte(code) === B7A.empreinte
    && B7.drapeaux[B7.combat.config.general.drapeauTermine] !== true) return 'boss';
  return null;
}
/* Code accepté (fin du « OK » du clavier) : le code secret fait ce qu'il faisait (unlockDigipass) ; celui du boss lance
   le combat. Les deux tapés : le digi pass disparaît. */
function b7CodeAccepte(quoi) {
  if (quoi !== 'boss') { unlockDigipass(); return; }
  closeKeypad();
  B7A.codes.boss = true;
  if (!B7.combat.demarrer()) b7Journal('erreur', 'code du boss accepté, mais le combat ne démarre pas');
  if (B7A.codes.secret) b7DigipassDisparait();
}
/* Code secret tapé (unlockDigipass) : le digi pass reste-t-il ? Oui là où le code du boss sert, tant qu'il n'a pas été
   tapé dans la partie. */
function b7DigipassReste() {
  B7A.codes.secret = true;
  return b7AccesBoss() && !B7A.codes.boss;
}
/* Le digi pass disparaît (comme au jeu d'avant après son code) : caché, bouffée, étincelles. */
function b7DigipassDisparait() {
  const dp = Features.digipass;
  if (!dp || dp.gone) return;
  hideDigipass();
  const p = dp.root.position, n = LAYOUT.digipass.n;
  spawnPuff(p.x + n[0] * 0.2, p.y, p.z + n[1] * 0.2, 0.45, 0.8, 0xc8d4dc, 0.45, 0.3);
  sparkBurst(p.x + n[0] * 0.05, p.y, p.z + n[1] * 0.05, n[0], 0, n[1], 10);
}

/* ----------------------------------------------------------- Phase 5 --- */
/* Entrée en phase 5 (évènement « etat » du combat) : toutes les portes s'ouvrent, offertes par le combat (les
   statistiques du joueur ne les comptent pas ; un passage de débris dont la charge bipe a été payé : il compte). */
function b7OuvrirPortes() {
  let n = 0;
  for (const id in World.doors) { const d = World.doors[id]; if (!d.opened) { const paye = d.charge; openDoor(d); if (!paye) n++; } }
  if (n) { G.stats.doors -= n; Life.add('doors', -n); }
}
function b7AccesEtat(d) {
  if (d.vers === 'phase5') b7OuvrirPortes();
}

/* ------------------------------------------------- Fin de partie, menu --- */
/* Fin de partie (gameOver) : la logique n'est plus mise à jour, sa musique jouerait jusqu'à la partie suivante ; elle
   s'éteint en fondu avec les autres sons du combat. Le décor reste tel quel derrière l'écran de fin. */
function b7FinDePartie() {
  if (B7.audio && B7.combat && B7.etat !== 'inactif') B7.audio.stop(1.5);
}
/* Retour au menu (quitToMenu), pendant le combat ou après une fin de partie : le combat est remis à zéro comme à une
   nouvelle partie (b7NouvellePartie : sons éteints, Septième et effets retirés, voile et obscurité levés, salle à neuf). */
function b7RetourMenu() {
  if (B7.combat && (B7.etat !== 'inactif' || B7.e)) b7NouvellePartie();
}

/* ----------------------------------------------------------- Matières --- */
/* Première entrée dans la salle pendant le combat (b7SalleAvantRendu, écran noir de l'introduction) : la salle est dans la
   scène avec ses lampes ; le Septième, les effets et un exemplaire de chaque mini-boss et du petit Démembré y sont posés le
   temps de compiler toutes leurs matières (renderer.compile parcourt toute la scène), puis retirés. */
function b7Precompiler() {
  B7A.compile = true;
  const t0 = performance.now(), n0 = renderer.info.programs ? renderer.info.programs.length : 0;
  const poses = [];
  for (const g of [B7V.modele && B7V.modele.object, B7V.fxSalle, B7E.gS]) if (g && g.parent !== scene) { scene.add(g); poses.push(g); }
  const ids = [];
  if (B7E.Z) {
    for (const type of B7_TYPES_ENT) {                // au centre de la salle, jamais vus par la logique
      const id = B7E.Z.apparaitre({ position: { x: B7S.O.x, y: 0, z: B7S.O.z }, lieu: 'salle', effet: 'normal', type, miniBoss: type !== 'demembre_petit' });
      if (id != null) ids.push(id);
    }
  }
  try { renderer.compile(scene, camera); } catch (e) { console.error('[boss B7] compilation des matières', e); }
  for (const id of ids) B7E.Z.retirer(id, { effet: 'silencieux' });
  for (const g of poses) scene.remove(g);
  B7A.ms = Math.round(performance.now() - t0);
  B7A.programmes = (renderer.info.programs ? renderer.info.programs.length : 0) - n0;
}
