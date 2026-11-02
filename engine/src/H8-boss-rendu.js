/* ================================================================= 23 RENDU DU BOSS ==
   Le Septième dans le jeu (jeu 2.0.7, étape 5 du brief ; suivi : SUIVI-BOSS-B7.md) : modèle, tirs, effets, sons, interface.
   · Modèle (BossB7Modele, du paquet, tel quel) : créé une fois avec le combat ; placé, orienté et animé à chaque image par
     la vue de la logique (etat().boss) ; dans la scène seulement quand le joueur est dans son lieu (salle ou Bunker 7).
     Gouttes de sang des lames : dessinées par les effets (gouttes: false, comme le brief).
   · Tirs (§11.2 du brief, une seule porte : combat.toucherBoss) : tant qu'il est présent, le Septième a une entrée dans la
     liste des zombies, comme le Gardien de Khamsin (b7boss ; sa place de rendu est cachée). Toutes les armes du jeu le
     trouvent donc sans liste à tenir : balles (plombs, pénétration, chute des dégâts, Double coup), projectiles,
     explosions et grenades, couteau, Onde de choc. Rayons contre ses sphères de touche (modele.hitboxes : tête, corps),
     seulement s'il est présent, visible et dans le lieu du joueur. Dégâts transmis : ceux d'un zombie touché au corps (le
     multiplicateur de tête du jeu n'est pas appliqué : la logique applique le sien), type « balle », « explosif » ou
     « melee » ; Onde de choc (elle tue d'un coup) : 1 393 par souffle, 2 786 améliorée (D5) ; Bombe et onde du Glas : sans
     effet ; Mort instantanée : sans effet sur lui. Aucun point par touche (D7). Marqueur de touche du jeu seulement si le
     coup porte ; sinon, l'impact « bouclier » des effets. Sang, étincelles et bouclier : dessinés par les effets.
   · Effets (BossB7Fx) : une couche par lieu (groupes posés à l'origine du monde), dans la scène seulement quand le joueur est
     dans ce lieu pendant le combat (leurs 3 lampes ne comptent qu'alors ; chute de lumière physique de la démo, comme les
     lampes de la salle : B7S_MARQUE). L'obscurité des effets (capture des âmes, phase 5)
     assombrit la brume du lieu du joueur (celle du jeu, par la propriété fog des groupes) et les lampes de ce lieu
     (fx.facteurLumiere : lampes de la salle ; lampes et hémisphère de Bunker 7) ; voile d'écran dessiné après l'arme
     (rendreEcran). Aucune secousse de caméra (vertige d'Anthony) : surSecousse n'est pas fourni.
   · Sons : branchés sur le combat (b7Sons) ; auditeur aux yeux du joueur.
   · Interface (BossB7Hud) : dans le HUD du jeu (cachée avec lui) ; touche d'interaction F ; noms des deux armes merveilles ;
     barres de vie du Septième et des mini-boss vidées vers la droite (remplissages retournés par un style ajouté,
     b7h-css-jeu, qui met aussi en rouge les bonus de la victoire).
   · Fin du combat (« termine », « echec ») : le Septième n'est plus dans Zombies.list (il ne prend plus de place de zombie)
     et ses couches d'effets quittent la scène ; la musique et l'interface finissent leur fondu (b7VueMaj).
   · Interaction (achever le rituel près du cadavre) : F maintenue.
   ============================================================================ */
const B7V = {
  modele: null, fx: null, hud: null, err: null,
  fxSalle: null, fxBunker: null,              // groupes des deux couches d'effets (origine du monde)
  ent: null, type: null,                      // le Septième dans Zombies.list (tirs) et son type
  touche: false,                              // le dernier coup sur le Septième a-t-il porté ? (marqueur de touche)
  kBunker: 1,                                 // facteur de lumière de Bunker 7 appliqué (obscurité des effets)
  ctx: { modele: null, temps: 0, joueurLocal: { id: 'j1', position: { x: 0, y: 0, z: 0 }, lieu: 'bunker' }, joueurs: null },
  ctxA: { auditeur: { position: { x: 0, y: 0, z: 0 }, lacet: 0, lieu: 'bunker' }, joueurLocalId: 'j1', positionZombie: null },
  ctxH: { joueurLocalId: 'j1', positionLocale: { x: 0, y: 0, z: 0 }, etourdi: 0 },
};
const _b7vP = { x: 0, y: 0, z: 0 };
const b7Attacher = (o, oui) => { if (oui) { if (o.parent !== scene) scene.add(o); } else if (o.parent) o.parent.remove(o); };

/* ------------------------------------------------------------- Création --- */
/* Modèle, effets et interface : une fois, avec le combat (première partie sur Bunker 7). Sans eux, pas de boss. */
function b7VueCreer() {
  const V = B7V;
  if (V.modele) return true;
  if (V.err) return false;
  try {
    if (typeof BossB7Modele !== 'object' || typeof BossB7Fx !== 'object' || typeof BossB7Hud !== 'object') throw new Error('modules de rendu du boss absents');
    const qualite = settings.quality === 'low' ? 'basse' : 'haute';
    const m = BossB7Modele.creer(THREE, { renderer, tete: window.BOSS_B7_TETE || null, qualite, ombres: false, gouttes: false });
    m.object.traverse((o) => { for (const mt of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) _linDone.add(mt); });
    V.modele = m; V.ctx.modele = m;
    // effets : une couche par lieu ; sa brume est celle du jeu quand le joueur est dans ce lieu, sinon une brume de côté
    // aux valeurs du lieu (l'obscurité y revient quand elle retombe)
    const a = (CUR.map || BUNKER7).ambiance || DEFAULT_AMBIANCE;
    const brumeSalle = new THREE.FogExp2(new THREE.Color(B7S_AMB.brume).convertSRGBToLinear().getHex(), B7S_AMB.densite);
    const brumeBunker = new THREE.FogExp2(new THREE.Color(parseColor(a.fog, 0x05070b)).convertSRGBToLinear().getHex(), a.fogDensity);
    const fxS = new THREE.Group(), fxB = new THREE.Group();
    fxS.name = 'boss-b7-effets-salle'; fxB.name = 'boss-b7-effets-bunker';
    Object.defineProperty(fxS, 'fog', { get: () => (B7.lieu === 'salle' ? scene.fog : brumeSalle), set() {} });
    Object.defineProperty(fxB, 'fog', { get: () => (B7.lieu === 'bunker' ? scene.fog : brumeBunker), set() {} });
    V.fxSalle = fxS; V.fxBunker = fxB;
    V.fx = BossB7Fx.creer(THREE, {
      scenes: { salle: fxS, bunker: fxB }, renderer, camera, config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE, qualite, ecranSepare: true,
      mareBras: false,                           // étape 6 : le bras posé du module des zombies a sa mare (comme le prototype)
      monde: { dalle: (id) => (B7S.monde ? B7S.monde.dalle(id) : null), positionZombie: b7PositionZombie, lieuDe: b7LieuDe, tir: b7TirDecor },
    });
    V.fx.brancher(B7.combat);
    // étape 6 : ses lampes (3 par lieu) prennent la chute de lumière physique de la démo, comme celles de la salle (en
    // anciennes unités, les effets divisent déjà leur intensité par π) ; sinon, à 3–5 m, elles éclairent 4 à 7 fois trop
    for (const g of [fxS, fxB]) g.traverse((o) => { if (o.isPointLight) o.decay = B7S_MARQUE; });
    V.hud = BossB7Hud.creer({ racine: HUD.el.hud, config: BOSS_B7_CONFIG, toucheInteraction: 'F', noms: { raygun: WEAPONS.raygun.name, blaster: WEAPONS.blaster.name } });
    V.hud.brancher(B7.combat);
    // style ajouté autour de l'interface (demandes d'Anthony du 2 novembre 2026) : (1) barre de vie du Septième vidée vers la
    // droite, dans le sens de ses segments (la phase 1, à gauche, se vide la première) ; le paquet ancre le remplissage de
    // chaque segment à gauche : chaque segment est retourné (miroir, sans texte dedans), remplissage, traînée des dégâts et
    // repères des mini-boss ensemble ; de même la barre de chaque mini-boss (son cadre intérieur, sans texte) ; (2) bonus de
    // la victoire en rouge (classes posées par b7BonusRouge, section 21)
    const st = document.createElement('style');
    st.id = 'b7h-css-jeu';
    st.textContent = '.b7h-seg,.b7h-mb .b span{transform:scaleX(-1)}'
      + '#pu-active.b7-insta .pu.insta,#pu-active.b7-double .pu.double{color:var(--blood-hi);text-shadow:0 0 10px rgba(226,49,58,.55)}';
    document.head.appendChild(st);
    V.ctxA.positionZombie = b7PositionZombie;
    return true;
  } catch (e) {
    V.err = String((e && e.message) || e);
    console.error('[boss B7] rendu', e);
    return false;
  }
}
/* Tir des effets contre le décor (ondulation d'un mur traversé par le Septième intangible). */
function b7TirDecor(lieu, o, d, max) {
  raycast(o.x, o.y, o.z, d.x, d.y, d.z, max || 60);
  return RAY.hit ? { point: { x: RAY.x, y: RAY.y, z: RAY.z }, normale: { x: RAY.nx, y: RAY.ny, z: RAY.nz } } : null;
}
/* Nouvelle partie : effets et modèle remis à zéro, interface vidée (combat « inactif »), le Septième hors de la liste. */
function b7VueRemettre() {
  const V = B7V;
  if (!V.modele) return;
  if (V.ent && !V.ent.removed) removeZombie(V.ent);
  V.ent = null; V.touche = false;
  const e = B7.combat.etat();
  V.ctx.joueurLocal.lieu = B7.lieu;
  try {
    V.fx.reinitialiser(); V.modele.reinitialiser();
    V.fx.mettreAJour(0, e, V.ctx);               // obscurité retombée : brume et facteur de lumière rendus (vision 0)
  } catch (err) { console.error('[boss B7] rendu', err); }
  V.ctxH.etourdi = 0;
  V.hud.mettreAJour(60, e, V.ctxH);               // minuteries de l'interface échues (marque de touche, « Immunisé », message…)
  b7Attacher(V.modele.object, false); b7Attacher(V.fxSalle, false); b7Attacher(V.fxBunker, false);
  if (V.kBunker < 1) b7LumieresBunker(1);
}

/* ------------------------------------------------------------- Chaque image --- */
/* (b7Update, après la logique) : le Septième dans la liste des zombies, modèle, effets, sons, interface, interaction. */
function b7VueMaj(dt, e) {
  const V = B7V;
  if (!V.modele) return;
  b7BossEntree(e);
  if (!e) return;
  const vue = e.boss;
  vue.temps = e.temps;
  V.modele.update(dt, vue);
  const p = player, C = V.ctx, J = C.joueurLocal;
  J.position.x = p.pos.x; J.position.y = p.gy + p.y; J.position.z = p.pos.z; J.lieu = B7.lieu;
  C.temps = G.time; C.joueurs = b7Joueurs();
  V.fx.mettreAJour(dt, e, C);
  if (B7.audio) {
    const A = V.ctxA.auditeur;
    A.position.x = camera.position.x; A.position.y = camera.position.y; A.position.z = camera.position.z;
    A.lacet = p.yaw; A.lieu = B7.lieu;                       // le prototype passe lacet + π : la convention de la caméra du jeu
    B7.audio.mettreAJour(dt, e, V.ctxA);
  }
  const H = V.ctxH;
  H.positionLocale.x = J.position.x; H.positionLocale.y = J.position.y; H.positionLocale.z = J.position.z;
  H.etourdi = B7J.etourdiT;                                  // étape 6 : « Étourdi » (décharge du Survolté)
  V.hud.mettreAJour(dt, e, H);
  if (e.interaction) B7.combat.interagir(B7.id, key('KeyF') && !p.down && G.state === 'playing', dt);
}
/* Le Septième dans Zombies.list tant qu'il est présent : les armes du jeu le visent comme un zombie (rayons et dégâts :
   b7BossRayon, b7BossDegats). Sa place de rendu est cachée (son modèle est à part). */
function b7BossEntree(e) {
  const V = B7V, b = e && e.boss;
  let z = V.ent;
  // combat fini (« termine », « echec ») : son cadavre reste présent pour la logique, mais il ne prend plus de place de
  // zombie (23 en même temps au lieu de 24 pour le reste de la partie : défaut relevé le 2 novembre 2026)
  if (!b || !b.present || !B7.actif) { if (z && !z.removed) removeZombie(z); V.ent = null; return; }
  if (!z || z.removed) {
    if (!ZR.free.length) { const c = Zombies.list.find((q) => !q.alive && !q.boss); if (c) removeZombie(c); else return; }
    const slot = ZR.free.pop();
    hideZombieSlot(slot);
    if (!V.type) V.type = Object.assign({}, BASE_TYPE, { id: 'b7_septieme', name: BOSS_B7_CONFIG.general.nomAffiche || 'Le Septième', headMult: 1, boss: true });
    z = V.ent = {
      id: ++Zombies.seq, slot, type: V.type, model: 'b7_septieme', boss: true, b7boss: true, alive: true, outside: false, layer: 0,
      hp: 1e9, maxHp: 1e9, pos: new THREE.Vector3(), gy: 0, k: -1, yaw: 0, state: 'chase', st: 0, t: 0, ph: 0, phase: 0, window: 0,
      win: null, gib: 0, headless: false, crawl: false, stagger: 0, flinch: 0, knockX: 0, knockZ: 0, knockT: 0, reelT: 0, called: null,
      look: { skin: 0xffffff, cloth: 0xffffff, eyes: 0xffffff, helmet: false, helmetColor: 0 }, helmetOn: false, dog: true, speedType: 'walk',
      speed: 1, moving: 0, vx: 0, vz: 0, nukeT: 0, losT: 0, los: true, farT: 0, stuck: 0, stuckT: 9, lastX: 0, lastZ: 0, scale: 1,
    };
    Zombies.list.push(z);
  }
  z.pos.set(b.position.x, b.position.y || 0, b.position.z);
  z.k = nearestNode(z.pos.x, z.pos.z, 0);
  z.gy = z.k >= 0 ? surfY(z.k, z.pos.x, z.pos.z) : 0;
  z.yaw = isFinite(b.lacet) ? b.lacet : z.yaw;
  z.lastX = z.pos.x; z.lastZ = z.pos.z;
}
/* Rayon d'une arme contre les sphères de touche du Septième (tête, corps) ; t ou -1. Directions normalisées. */
function b7BossRayon(z, ox, oy, oz, dx, dy, dz, extra) {
  _hitHead = false; _hitLeg = false; _hitArm = 0;
  const e = B7.e, M = B7V.modele;
  if (!e || !M || z.removed || !e.boss.present || !e.boss.visible || e.boss.lieu !== B7.lieu) return -1;
  let best = -1, tete = false;
  for (const s of M.hitboxes()) {
    const cx = s.centre.x - ox, cy = s.centre.y - oy, cz = s.centre.z - oz, t = cx * dx + cy * dy + cz * dz;
    if (t < 0) continue;
    const r = s.rayon + (extra || 0), d2 = cx * cx + cy * cy + cz * cz - t * t;
    if (d2 > r * r) continue;
    const t0 = Math.max(0, t - Math.sqrt(r * r - d2));
    if (best < 0 || t0 < best) { best = t0; tete = s.zone === 'tete'; }
  }
  _hitHead = tete;
  return best;
}
/* Dégâts d'une arme du jeu sur le Septième : la porte unique du brief (combat.toucherBoss). Ne le tue jamais ici. */
function b7BossDegats(z, amount, info) {
  B7V.touche = false;
  const C = B7.combat, k = info && info.kind;
  if (!C || z.removed || !(amount > 0) || k === 'nuke' || k === 'glas' || k === 'vehicle') return false;
  let degats = amount, type = 'balle';
  if (k === 'explosive') type = 'explosif';
  else if (k === 'knife') type = 'melee';
  else if (k === 'blast') degats = C.config.dpsReference * (info.slot && info.slot.up ? 2 : 1);   // D5 : l'Onde de choc tue d'un coup
  const p = _b7vP;
  if (info.hx != null) { p.x = info.hx; p.y = info.hy; p.z = info.hz; }
  else {
    const L = B7V.modele.hitboxes(), c = (L.find((h) => h.zone === 'corps') || L[0]).centre;
    p.x = c.x; p.y = c.y; p.z = c.z;
  }
  const r = C.toucherBoss({ joueur: B7.id, degats, zone: k === 'bullet' && info.head ? 'tete' : 'corps', position: { x: p.x, y: p.y, z: p.z }, type });
  B7V.touche = !!(r && r.applique);
  return false;
}

/* ------------------------------------------------------------- Lumières et rendu --- */
/* (update, après updateLights) : obscurité et éclats des effets sur les lampes du lieu du joueur. Les lampes de Bunker 7
   viennent d'être remises à leur valeur par updateLights : on les multiplie une fois par image. */
function b7Lumieres() {
  const V = B7V;
  if (!V.fx || !b7Carte()) return;
  const actif = !!B7.e;                          // hors combat : pleine lumière (les effets ne sont plus mis à jour)
  if (B7S.monde) b7SalleIntensite(actif ? V.fx.facteurLumiere('salle') : 1);
  const k = actif ? V.fx.facteurLumiere('bunker') : 1;
  if (k < 1 || V.kBunker < 1) b7LumieresBunker(k);
}
function b7LumieresBunker(k) {
  if (k < 1) for (const l of World.lights) l.light.intensity *= k;   // scintillement gardé (updateLights vient de les poser)
  if (HEMI && CUR.map) HEMI.intensity = CUR.map.ambiance.hemi * k;
  B7V.kBunker = k;
}
/* Avant le rendu (b7SalleAvantRendu) : modèle et couches d'effets dans la scène selon le lieu du joueur et le combat. */
function b7VueAvantRendu(dans) {
  const V = B7V;
  if (!V.modele) return;
  const e = B7.e, combat = !!e && B7.actif && b7Carte() && G.state !== 'editor';   // combat fini : ni Septième ni effets dans la scène
  const lieu = dans ? 'salle' : 'bunker';
  b7Attacher(V.modele.object, combat && e.boss.lieu === lieu);
  b7Attacher(V.fxSalle, combat && dans);
  b7Attacher(V.fxBunker, combat && !dans && (e.lieu === 'bunker' || e.boss.lieu === 'bunker'));
  if (B7E.gS) b7Attacher(B7E.gS, dans && G.state !== 'editor');   // étape 6 : mini-boss, petits Démembrés et leurs effets
}
/* Après l'arme (fin de render) : voile d'écran des effets (obscurité, fondus, capture des âmes, éclairs). */
function b7RenduEcran() {
  if (B7V.fx && B7.e && b7Carte() && G.state !== 'editor') B7V.fx.rendreEcran(renderer);
}
