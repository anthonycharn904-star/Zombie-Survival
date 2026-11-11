/* ============================================================ 32 MACHINE DE MORT ==
   Le bonus « Machine de mort » (jeu 2.0.7, demande d'Anthony du 4 novembre 2026 : « La machine de mort sera présente
   pour toutes les maps, ainsi que les futures maps »). Son paquet « machine-de-mort-zombie-survival »
   (engine/orig/machine-de-mort/ : machine-de-mort.js, inséré tel quel par build.py, son INTEGRATION.md et ses licences) :
   mitrailleuse rotative MDM-6, logique (30 s, 700 cartouches, 1 800 coups/min), modèle, effets, sons et HUD.
   Branchement sur les systèmes du jeu, sans système parallèle (son brief, § 3) :
   · bonus : POWERUPS.deathmachine, dans le même tirage que les cinq autres (choix d'Anthony) ; au sol, l'entrée du
     jeu (durée de 26 s, ramassage, sauvegarde) porte la miniature dorée du paquet (halo, colonne, étincelles,
     clignotement) ; au ramassage, l'annonceur du jeu (voix « Machine de mort ! » du paquet annonceur-voix-B) et son
     bandeau ; un second bonus pendant l'usage : 30 s et 700 cartouches (réglage du paquet) ;
   · arme : celle du joueur est rangée telle quelle (rechargement annulé, chargeur et réserve inchangés) et ressort à la
     fin (chargeur vide, 30 s écoulées, joueur à terre, véhicule, fin de partie) ; jamais dans l'inventaire, aux murs
     ni dans la boîte ; pendant l'usage (Arms.state « mdm ») : ni tir de l'arme, ni rechargement, visée, changement
     d'arme, couteau ou grenade, ni achat qui occupe les mains (armsBusy) ; déplacement × 0,88 ;
   · tir : chaque coup du paquet passe par le tir du jeu (hitscan : murs, étages, eau des Marécages, casque, tête,
     pénétration de 2 zombies, Mort instantanée, Points doubles, points, boss), avec ses caractéristiques (MDM_ARME,
     150 dégâts : choix d'Anthony) ; impacts sur le décor et traçantes du jeu ; flamme, fumée et douilles du paquet ;
     aucune secousse de caméra (vertige d'Anthony) ;
   · vue FPS : dans la vue des armes du jeu (vmScene, champ de 72° pendant l'usage, celui du réglage du paquet), les bras
     d'Anthony posés par le paquet (poignée arrière, poignée avant) ; vue TPS : un second modèle allégé dans les mains
     du corps (persoEtatLocal, persoArme) ;
   · HUD : compteur et barre du paquet en bas à droite, munitions de l'arme du jeu cachées ; « Machine de mort » et son
     temps dans les bonus actifs du jeu (icône dorée du paquet) ;
   · sons du paquet dans le bus des effets du jeu (volume général, étouffement sur la Lune et à terre) ;
   · sauvegarde refusée pendant l'usage (choix d'Anthony) ; le bonus au sol, lui, se sauvegarde comme les autres.
   Une instance pour la session, créée au premier lancement d'une partie (modèle, sons, programmes compilés d'avance).
   ============================================================================ */
const MDM_ARME = { id: 'deathmachine', name: 'Machine de mort', kind: 'lmg', auto: true, dmg: 150, pen: 2, rpm: 1800, falloff: null, mobility: 1 };
const MDM = {
  inst: null, err: null,
  slot: { id: 'deathmachine', def: MDM_ARME, tier: 0 },   // « emplacement » passé au tir du jeu (hitscan, wstat)
  vitesse: 0.88,              // déplacement pendant l'usage (réglage du paquet)
  fov: 72, fov0: 52,          // champ vertical de la vue des armes pendant l'usage (réglage du paquet) ; celui du jeu
  vue: { p: [0.165, -0.275, -0.33], r: [0.05, 0.09, -0.04] },   // position de hanche du paquet (repère de la caméra)
  attente: false,             // ramassée pendant un geste (atout, grenade, couteau) : sortie dès la fin du geste
  sol: [],                    // miniatures au sol : { p (entrée de Powerups.list), b, son, pris }
  corps: null,                // second modèle, dans les mains du corps (vue TPS)
  temoin: null,               // miniature de la précompilation, gardée (cachée) : ses programmes ne sont jamais libérés
  sw: { x: 0, y: 0, k: 0 },   // balancement de la vue (comme updateViewmodel)
};
POWERUPS.deathmachine = { name: 'Machine de mort', say: 'Machine de mort !' };
const mdmActif = () => !!(MDM.inst && MDM.inst.actif);
const mdmVitesse = () => (MDM.inst ? MDM.inst.vitesseDeplacement : 1);
function mdmLin(o) { o.traverse((x) => { for (const m of Array.isArray(x.material) ? x.material : x.material ? [x.material] : []) _linDone.add(m); }); }

/* ------------------------------------------------------------- création --- */
/* L'instance de la session, une fois : préparée au menu (mdmAuMenu, section 43), sinon au premier lancement d'une
   partie (startGame) ; ensuite, rien. */
function mdmCreer() {
  if (MDM.inst || MDM.err) return !!MDM.inst;
  if (typeof MachineDeMort !== 'object' || !vmScene || !vmCamera) { MDM.err = 'paquet absent'; return false; }
  const bus = Sound.bus && Sound.bus();
  try {
    MDM.fov0 = vmCamera.fov;
    const M = MachineDeMort.creer({
      THREE, renderer, scene: vmScene, camera: vmCamera,
      bras: PERSO.on && PERSO.arms ? PERSO.arms : null,
      qualite: settings.quality === 'low' ? 'basse' : 'haute',
      sons: bus ? { contexte: bus.ctx, sortie: bus.sortie } : false,
      hud: { parent: HUD.el.hud, icone: false, banniere: false },     // bandeau et icône : ceux du jeu
      tir: { degats: MDM_ARME.dmg, penetration: MDM_ARME.pen, traceuseTous: 0, impacts: false },   // traçantes et impacts du jeu
      config: { cadence: MDM_ARME.rpm },
      vue: { position: MDM.vue.p, rotation: MDM.vue.r, geree: true },  // balancement du jeu (mdmVue)
      jeu: { tirer: mdmTirer, rangerArme: mdmRanger, ressortirArme: mdmRessortir, sol: () => -50 },   // douilles : dans la vue
    });
    mdmLin(M.vue);
    // compilation d'avance : l'arme dans la vue des armes, la miniature dans le monde (pas d'à-coup au premier bonus)
    try { M.prechauffer(); } catch (e) { console.warn('[machine de mort] précompilation de la vue', e); }
    try {
      const b = MachineDeMort3D.creerBonus(THREE, { renderer, scene, position: new THREE.Vector3(0, -1000, 0), duree: 1e9 });
      mdmLin(b.objet);
      MachineDeMort3D.prechauffer(THREE, renderer, scene, camera, [b.objet]);
      MDM.temoin = b;                                            // pas libérée : les miniatures suivantes réutilisent ses programmes
      MDM.corps = MachineDeMort3D.creerArme(THREE, { renderer, qualite: 'basse' });   // le modèle du corps (vue TPS)
      mdmLin(MDM.corps.objet);
      MachineDeMort3D.prechauffer(THREE, renderer, scene, camera, [MDM.corps.objet]);
    } catch (e) { console.warn('[machine de mort] précompilation de la miniature et du modèle du corps', e); }
    if (!document.getElementById('mdm-css')) {
      const st = document.createElement('style'); st.id = 'mdm-css';
      st.textContent = 'body.zs-mdm-actif #weapon{visibility:hidden}.pu.deathmachine b img{width:1.5em;height:1.5em;vertical-align:-0.35em}';
      document.head.append(st);
    }
    MDM.inst = M;
    return true;
  } catch (e) {
    MDM.err = String((e && e.message) || e);
    console.error('[machine de mort]', e);
    return false;
  }
}
/* Lancement d'une partie (startGame) : l'instance (une fois), puis tout est remis à zéro (clearPowerups l'a déjà fait au
   retour au menu ; une nouvelle partie depuis la pause aussi). */
function mdmNouvellePartie() {
  if (!MDM.inst && !MDM.err) {                 // pas encore préparée au menu : créée ici, temps noté (section 43)
    const t = performance.now();
    mdmCreer();
    if (typeof chgMdm === 'function') chgMdm(performance.now() - t);
  }
  mdmVider();
}
/* Préparation au menu (section 43, pendant un temps mort) : l'instance, ses environnements et ses précompilations,
   qui gelaient le lancement de la première carte de la session. Seulement quand l'audio du jeu existe (sinon le paquet
   serait créé sans sons) ; renvoie vrai si elle vient d'être créée. */
function mdmAuMenu() {
  if (MDM.inst || MDM.err || G.state !== 'menu') return false;
  if (!(Sound.bus && Sound.bus())) return false;
  return mdmCreer();
}
/* Remise à zéro (clearPowerups : nouvelle partie, retour au menu, autre carte) : l'arme et les miniatures retirées. */
function mdmVider() {
  MDM.attente = false;
  if (MDM.inst && MDM.inst.actif) MDM.inst.perdre('partie');
  for (const v of MDM.sol) mdmSolRetirer(v);
  MDM.sol.length = 0;
}

/* ------------------------------------------------------------- l'arme --- */
/* Début de l'usage (évènement « debut » du paquet) : l'arme du joueur est rangée telle quelle. */
function mdmRanger() {
  if (Arms.rl && typeof rlEnd === 'function') rlEnd();       // rechargement annulé : chargeur et réserve inchangés
  Arms.state = 'mdm'; Arms.t = 0; Arms.dur = 0; Arms.autoReloadAt = -1;
  player.ads = 0;
  Arms.holder.visible = false;
  // ses bras : dépliés (un bras replié pour une arme d'une main reste à l'échelle 1e-5) et à leur pose de liaison ; le
  // paquet les pose ensuite sur les poignées (bras.update)
  if (PERSO.arms && PERSO.armsBind) for (const b of PERSO.arms.skeleton.bones) { if (PERSO.armsBind[b.name]) b.position.copy(PERSO.armsBind[b.name]); b.scale.setScalar(1); }
  vmCamera.fov = MDM.fov; vmCamera.updateProjectionMatrix();
  document.body.classList.add('zs-mdm-actif');
}
/* Fin de l'usage (évènement « fin ») : l'arme d'avant ressort, avec son chargeur et sa réserve. */
function mdmRessortir() {
  vmCamera.fov = MDM.fov0; vmCamera.updateProjectionMatrix();
  document.body.classList.remove('zs-mdm-actif');
  if (Arms.state === 'mdm') { Arms.state = 'swapIn'; Arms.t = 0; Arms.dur = 0.3 * swapFactor(); }
  Arms.holder.visible = !!Arms.gun;
  HUD.weapon();
}
/* Un coup (jusqu'à 30 par seconde) : la direction du paquet (repère de la vue, dispersion comprise) passe dans le monde ;
   le tir du jeu fait le reste. Les traçantes partent de la bouche de la machine (ou du corps, en vue TPS). */
const _mdmD = new THREE.Vector3(), _mdmQ = new THREE.Quaternion(), _mdmB = new THREE.Vector3();
function mdmTirer(t) {
  cameraBasis();
  camera.getWorldQuaternion(_mdmQ);
  _mdmD.copy(t.direction).applyQuaternion(_mdmQ).normalize();
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let mw = muzzleWorld();                                        // vue TPS : la bouche de l'arme du corps
  if (!persoTps()) { MDM.inst.arme.bouche.getWorldPosition(_mdmB); mw = camera.localToWorld(_mdmB); }
  G.stats.shots++;
  Life.add('shots');
  if (OW.on && OW.worldId === 'marais') maNoise(ox, oz, 'shot');   // la bête des Marécages entend les coups de feu
  Arms.shotHit = false;
  hitscan(MDM.slot, ox, oy, oz, _mdmD.x, _mdmD.y, _mdmD.z, mw);
  if (Arms.shotHit) countHit();
  return null;
}
/* Ramassage du bonus (applyPowerup) : l'arme sort, ou elle est rechargée (30 s, 700) si elle est déjà en main ; pendant un
   geste (atout, grenade, couteau, arme qui change), elle attend la fin du geste. */
function mdmRamasse() {
  if (!MDM.inst && !mdmCreer()) return;
  if (MDM.inst.actif) { MDM.inst.activer(); return; }
  MDM.attente = true;
}

/* ------------------------------------------------------------- chaque image --- */
/* updateArms : vrai tant que la machine de mort tient les mains (le reste d'updateArms ne tourne pas). */
function mdmArmes(dt) {
  if (Arms.state !== 'mdm') return false;
  player.ads = 0;
  return true;
}
/* update, après updateArms : la logique du paquet, la vue, les miniatures au sol. */
function mdmMaj(dt) {
  const M = MDM.inst;
  if (!M) return;
  mdmSol(dt);
  if (MDM.attente && ['idle', 'reload', 'swapIn'].includes(Arms.state) && !player.down && !(OW.on && owDriving())) { MDM.attente = false; M.activer(); }
  if (M.actif && (player.down || (OW.on && owDriving()))) M.perdre(player.down ? 'a-terre' : 'vehicule');
  // boss de Bunker 7 (s'il est dans le jeu) : téléportation, scène, commandes coupées : perdue (son brief, § 4.6)
  if (M.actif && typeof B7 !== 'undefined' && (B7.cine || B7.bloque)) M.perdre('cinematique');
  const sprint = GL.actif && GL.out ? !GL.out.weapon.canFire : player.sprinting;   // sprint, glissade : le rotor ralentit
  const bloque = sprint || Keypad.open || G.state !== 'playing';
  M.maj(dt, { tir: Input.lmb && !bloque, bloque, vitesse: Math.hypot(player.vel.x, player.vel.z), joueurs: [] });
  if (M.actif) mdmVue(dt, sprint);
  if (MDM.corps) MDM.corps.maj(dt, { regime: M.logique.regime, chaleur: M.logique.chaleur, munitions: M.munitions, avance: M.logique.tirsTotal });
}
/* Vue (geree) : position de hanche du paquet, balancement du regard et sprint comme les armes du jeu (updateViewmodel). */
function mdmVue(dt, sprint) {
  const S = MDM.sw, v = MDM.inst.vue;
  S.x = damp(S.x, clamp(-Input.dx * 0.00035, -0.04, 0.04), 9, dt);
  S.y = damp(S.y, clamp(Input.dy * 0.00035, -0.04, 0.04), 9, dt);
  S.k = damp(S.k, sprint ? 1 : 0, 10, dt);
  const [px, py, pz] = MDM.vue.p, [rx, ry, rz] = MDM.vue.r;
  v.position.set(px + S.x - 0.05 * S.k, py + S.y - 0.06 * S.k, pz);
  v.rotation.set(rx + S.y * 1.1 - 0.15 * S.k, ry + S.x * 1.4 + 0.45 * S.k, rz + 0.15 * S.k);
}

/* ------------------------------------------------------------- bonus au sol --- */
/* buildPowerupModel : l'entrée du jeu n'a pas de modèle ; la miniature du paquet la suit (mdmSol). */
function mdmModeleSol() { return new THREE.Group(); }
function mdmSolRetirer(v) {
  if (v.son) v.son.arreter(0.05);
  if (v.b.objet.parent) v.b.objet.parent.remove(v.b.objet);
  v.b.dispose();
}
const _mdmP = new THREE.Vector3(), _mdmR = new THREE.Vector3();
function mdmSol(dt) {
  const M = MDM.inst;
  for (const p of Powerups.list) {
    if (p.type !== 'deathmachine' || p.mdm) continue;
    const b = MachineDeMort3D.creerBonus(THREE, { renderer, scene, position: new THREE.Vector3(p.x, p.gy, p.z), duree: Math.max(0.5, p.life - p.t), clignote: 6 });
    mdmLin(b.objet);
    scene.add(b.objet);
    p.mdm = { p, b, son: M.sons ? M.sons.boucleBonus() : null, pris: false };
    MDM.sol.push(p.mdm);
  }
  camera.getWorldPosition(_mdmP); _mdmR.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_mdmQ));
  for (let i = MDM.sol.length - 1; i >= 0; i--) {
    const v = MDM.sol[i];
    if (!v.pris && !Powerups.list.includes(v.p)) {             // ramassée (éclair du paquet) ou disparue
      if (v.p.pris) { v.pris = true; v.b.ramasser(0); if (v.son) v.son.arreter(0.05); if (M.sons) M.sons.ramassage(); }
      else { mdmSolRetirer(v); MDM.sol.splice(i, 1); continue; }
    }
    v.b.maj(dt, { joueurs: [] });
    if (v.son && !v.pris) {
      const d = v.b.objet.position.distanceTo(_mdmP), dir = v.b.objet.position.clone().sub(_mdmP).normalize();
      v.son.position(d, dir.dot(_mdmR));
    }
    if (v.b.termine) { mdmSolRetirer(v); MDM.sol.splice(i, 1); }
  }
}
/* Bonus actifs du HUD : l'icône dorée du paquet. */
function mdmIconeHtml() { return typeof MachineDeMortHud === 'object' ? `<img src="${MachineDeMortHud.ICONE}" alt="">` : '⚙'; }

/* ------------------------------------------------------------- corps (vue TPS) --- */
/* Le corps tient un second modèle, allégé, pendant l'usage : main droite sur la poignée arrière (origine du modèle,
   +Z vers l'avant comme le repère du corps), main gauche sur la poignée avant. */
function mdmCorpsArme() {
  if (!MDM.corps) { MDM.corps = MachineDeMort3D.creerArme(THREE, { renderer, qualite: 'basse' }); mdmLin(MDM.corps.objet); }
  const A = MDM.corps, wrap = new THREE.Group(), fore = new THREE.Object3D();
  wrap.add(A.objet); wrap.scale.setScalar(1 / PERSO.taille);
  A.objet.updateMatrixWorld(true);                         // modèle seul : son repère est celui du monde
  fore.position.copy(A.ancres.gauche.getWorldPosition(new THREE.Vector3()));
  A.objet.add(fore);
  A.objet.userData.parts = {};
  return { gun: A.objet, wrap, fore, fore0: fore.position.clone(), mag: fore.position.clone(), muzzle: A.bouche };
}
{
  const etat0 = persoEtatLocal, arme0 = persoArme;
  persoEtatLocal = function () {
    const E = etat0();
    if (mdmActif()) { E.arme = { id: 'deathmachine', tier: 0 }; E.ads = 0; E.rl = null; E.cyc = null; }
    return E;
  };
  persoArme = function (av, E, geste) {
    if (E.arme && E.arme.id === 'deathmachine' && !av.guns['deathmachine:0'] && av.local) av.guns['deathmachine:0'] = mdmCorpsArme();
    return arme0(av, E, geste);
  };
}

/* ------------------------------------------------------------- sauvegarde --- */
sauveEnregistrer('machine-de-mort', {
  version: 1,
  refus: () => (mdmActif() || MDM.attente ? 'Machine de mort en main : attendez qu’elle se range.' : null),
  capter: () => null,
  restaurer() {},
});
