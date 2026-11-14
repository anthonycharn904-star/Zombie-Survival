
/* ================================================================ La Mère-Vase ==
   La bête du marais (modèle, squelette, animations : mere-vase.js ; voix : mere-vase-audio.js).
   Ici : où elle est, ce qu'elle fait, ce qu'elle entend, comment elle attaque, comment on la blesse.

   Menace (MAM.attn, de 0 à 100) : ce que la bête sait de vous. Elle monte quand on est sur l'eau
   (moteur, plus encore à l'arrêt moteur tournant ; tirs, explosions, projecteur ; nager), plus vite
   en eau profonde et dans La Fosse, et plus on reste longtemps sur l'eau ; elle retombe à terre.
   Les hauts-fonds, les bancs et les abords des rives la font monter beaucoup moins.
     0-20  calme      rien
     20-40 éveil      au loin : une plainte, une gerbe dans la brume
     40-60 rôde       des bulles qui crèvent près de la barque, des ronds, un grondement sous l'eau ;
                      les grenouilles se taisent, les lucioles s'éteignent
     60-80 traque     elle suit la barque : une ombre sous la surface, un sillage en V, elle passe
                      dessous (la coque cogne, tout vibre), le fond sonore monte
     80-   attaque    elle fonce sous l'eau (10 m/s : sillage, leurres qui filent, remous), l'ambiance se
                      tait 0,4 s, puis la ruée (MM 2.1.3) : elle jaillit à 5-12 m, cri, gerbe, le corps se
                      dresse, la gueule béante monte au-dessus de sa proie, se tourne vers elle et se
                      referme sur elle (0,7 s). La barque est détruite d'un coup, le pilote jeté à l'eau
                      (−25) ; un nageur, ou le joueur au bout d'un ponton, est saisi et dévoré (scène, fin
                      de partie).
   Le naufragé : elle lui laisse le temps de gagner le haut-fond le plus proche à la nage (la distance à
   la nage ordinaire, +10 %, +8 s ; l'indication dit de quel côté), en tournant autour de lui à vue ; s'il
   est encore en eau profonde au bout du délai, elle se jette sur lui. La barque revient à son ponton une
   minute plus tard. Combat de boss : l'ancienne attaque (remontée, 1,8 s gueule ouverte, morsure).
   Une traversée normale (15 à 30 s moteur lancé, en eau libre) monte à 25-45 : des signes, parfois
   son dos au loin, pas d'attaque. Attendre au milieu, faire demi-tour dans La Fosse, tirer depuis la
   barque, nager : c'est là qu'elle vient.
   Kit MM 2.1.1 (« le monstre n'apparaît pas », Anthony, 26 octobre 2026). Deux causes en MM 2.1.0 :
   - elle se pilotait à vue (10 à 25 m devant la tête) : une île ou un banc entre elle et sa cible, et
     elle n'arrivait jamais (au ponton sud du Bourg : jamais à moins de 156 m en 3 min, la menace au
     maximum ; au large, elle chargeait parfois dans le mauvais sens). Elle suit maintenant l'eau
     (ma12_nav.js : grille de 4 m, plus court chemin, approche par son côté d'un banc) ;
   - elle restait loin (45-90 m), profonde et noire : rien à voir avant la gueule. Elle se montre
     maintenant : réveillée à 80-120 m de nage de la cible, elle rôde à 24-46 m et, dès le premier
     palier, fait surface en passant, à découvert (dos, crête, branchies, jet d'embruns), toutes les
     15-24 s ; ses leurres éclairent l'eau, sa tête et la barque (plus vifs quand elle va mordre).
   Mesures (barque à l'arrêt, moteur au ralenti, 60 et 144 images/s) : au large, premier passage
   vers 20-30 s, attaque vers 40-60 s ; à quai, premier passage vers 35-60 s, attaque vers 1 min 15 à
   2 min 20 ; à la nage, passage vers 10-30 s, dévoré vers 20-45 s ; traversée ordinaire (17-25 s) :
   menace 25-42, des signes seulement. À pied dans l'eau, près de l'eau profonde : elle vient voir et
   passe en surface (vers 55-85 s), sans attaquer (la menace s'arrête à 45).

   Kit 2.0.7 (Anthony, 30 octobre 2026 : « le monstre sous-marin attrapera et tuera également les Noyés ; il
   priorisera le ou les joueurs d'abord, mais si le joueur a quitté sa barque, il se mettra à engloutir les
   Noyés ») : éveillée, et le joueur hors de l'eau (à terre, sur un ponton, la barque quittée), elle chasse les
   Noyés restés à la surface (état « festin ») : elle fonce sur le plus proche et se jette dessus (la ruée) ;
   la gueule se referme sur lui, il disparaît dans la gueule en se débattant. Puis le suivant. Le joueur
   revient sur l'eau (barque, nage) : elle le reprend pour cible aussitôt. Ses ruées sur la barque ou un
   nageur engloutissent aussi les Noyés qui sont à portée de la gueule. Le combat de boss n'en tient pas
   compte. Réglages : MA_CFG.feast.

   Combat de boss (MA_BOSS) : architecture et réglages seulement (phases à seuils de vie, agressivité,
   attaques permises, blindage, points faibles), rien ne le déclenche dans la carte : il se lance
   par MA_BOSS.start() (quêtes, Mod Tools). Hors combat, la bête ne meurt pas : blessée, elle fuit.
   ================================================================================== */
const MA_CFG = {
  scale: 1,
  // profondeur de la racine (milieu du dos) : croisière, traque, leurres, remontée, surface (le dos
  // émerge), plongée ; show : en passant, la crête et le dos crèvent l'eau ; near : près de la cible,
  // assez haut pour que la lueur des leurres se voie à travers l'eau
  depth: { cruise: -3.5, stalk: -2.5, lure: -2.2, rise: -1.2, surface: -0.75, dive: -6, show: -0.35, near: -1.7 },
  minDepth: 3.2,                    // eau qu'il lui faut pour circuler cachée
  attackDepth: 1.5,                 // eau qu'il lui faut pour attaquer (MM 2.1.0 : 1,9 ; les barques à quai étaient hors d'atteinte)
  speed: { rode: 2.4, traque: 5.2, charge: 10, fuite: 7.5, retraite: 4.5, approche: 7.5, montre: 3.0 },
  turn: { rode: 0.45, traque: 0.9, charge: 1.2 },
  roam: [24, 46],                   // m : où elle rôde autour de la cible (devant elle, de préférence)
  wake: [80, 120],                  // m : où l'éveil la trouve quand La Fosse est loin (hors de vue, en eau profonde)
  // apparitions : elle fait surface en passant, de profil (dos, crête, leurres), puis replonge
  show: { first: [2, 6], every: [15, 24], dur: 6.5, near: 18, far: 52 },
  attn: {
    motor: 0.8, idle: 0.9, drift: 0.35, swim: 3.4, shot: 3.2, blast: 14, light: 0.12,
    wade: 0.5, wadeCap: 45,         // à pied dans l'eau, près de l'eau profonde : elle vient voir, sans attaquer (MM 2.1.1)
    trip: 40,                       // s : à ce temps passé sur l'eau, ce qu'elle entend est doublé
    deep: 1.6, fosse: 2.6, shallow: 0.4, bar: 0.45, shore: 0.4,
    land: 6, roundK: 0.05, after: 52, flee: 25,
  },
  // lumière des leurres (lumière ponctuelle, couleur sRGB, portée en m) ; lueur sous l'eau (taches à la surface)
  light: { color: 0x7dffcf, dist: 30 },
  breach: 0.12,                     // jaillissement d'avertissement : probabilité par seconde (traque, une fois par traversée)
  // La ruée (MM 2.1.3, Anthony : « qu'il se lance sur le joueur, comme le monstre du lac de Resident Evil 4 »).
  // Approche à 10 m/s sous l'eau (sillage, leurres verts qui foncent), un silence de 0,4 s (l'ambiance se
  // tait), puis elle jaillit à 5-12 m : cri, gerbe ; la gueule béante monte au-dessus de sa proie (rise et
  // over : m au-dessus de sa tête), se tourne vers elle et se referme sur elle en dur s (elle s'arrête à
  // stop m devant ses yeux : à la première personne, on est dans la gueule ; noir à l'impact). Le corps se
  // dresse de pitch rad (l'arrière plonge), puis s'abat (pitchEnd) ; warp : jaillissement et frappe rapides. Barque :
  // détruite d'un coup, le pilote jeté à l'eau ; nageur ou joueur au bout d'un ponton : dévoré. Elle vise
  // où sera la barque : un virage serré au dernier moment la fait manquer (elle s'écrase à côté). Le combat
  // de boss garde l'ancienne attaque (préparation de 1,8 s, gueule ouverte : la fenêtre pour viser).
  leap: { at: 88, range: [5, 12.5], dur: 0.7, hush: 0.4, rise: 2.6, over: 2.6, back: 3.2, stop: 0.35, endUp: 0.05, warp: 0.45, pitch: 0.7, pitchEnd: 0.25, hit: 2.6, dmg: 25 },
  // Après la barque détruite : elle laisse au naufragé le temps d'atteindre le haut-fond le plus proche à la
  // nage ordinaire (1,5 m/s ; 2,1 avec Maj), ×1,1, + 8 s pour s'orienter (de 18 à 90 s) ; l'indication dit
  // de quel côté il est et à quelle distance. Pendant ce temps, elle le chasse à vue (dos, leurres,
  // grondements) ; s'il est encore en eau profonde au bout du délai, elle se jette sur lui.
  grace: { speed: 1.5, k: 1.1, plus: 8, min: 18, max: 90 },
  // la barque détruite revient à son ponton au bout de 60 s, quand personne n'est à moins de 35 m
  wreck: { back: 60, far: 35 },
  attack: { cooldown: 14, boat: [30, 44], boatGrab: [10, 16], bite: 45, dockBite: 55, bump: 5, reach: 3.4,
    lunge: 2.35, lungeBoat: 2.9, home: 1.1 },        // détente : distance parcourue avant la morsure (m), correction de visée (rad/s)
  fleeAt: 2200,                     // dégâts encaissés (hors boss) avant de fuir
  // kit 2.0.7 : les Noyés comme proies (le joueur hors de l'eau) : à moins de range m d'elle, à la surface ;
  // vitesse d'approche, abandon au bout de give s, repos après une prise, gueule : rayon des prises en passant
  feast: { range: 90, speed: 9, give: 22, cool: 2.2, by: 2.4 },
  victimYaw: 0,                     // dévoration : orientation du corps de la victime (face à la caméra de la scène)
  boss: {
    hp: 42000,
    phases: [
      { at: 1.0, name: 'L’éveil de la Mère-Vase', aggression: 1.0, cooldown: 14, attacks: ['barque', 'joueur'], armor: 1.0 },
      { at: 0.66, name: 'La colère', aggression: 1.35, cooldown: 10, attacks: ['barque', 'joueur', 'ponton'], armor: 0.9 },
      { at: 0.33, name: 'L’agonie', aggression: 1.7, cooldown: 7, attacks: ['barque', 'joueur', 'ponton'], armor: 0.8 },
    ],
    weak: { oeil: 3, gueule: 2.2, leurre: 1.5, branchie: 1.6, tete: 1.2, machoire: 1, corps: 1, queue: 0.8, patte: 0.8 },
  },
};
const MAM = { attn: 0, level: 0, water: 0, trip: 0, signT: 6, bumpT: 0, quietT: 0, dread: 0, shots: 0, lastShotT: -9 };
const MAB = {
  mv: null, snd: null, obj: null, on: false, err: null, state: 'dormant', t: 0, x: 600, z: 590, y: -10, yaw: 0, v: 0, yr: 0, showT: 4,
  tx: 600, tz: 590, ty: -10, cool: 0, fear: 0, fearT: 0, hurtT: 0, hit: null, biteL: new THREE.Vector3(), headL: new THREE.Vector3(),
  victim: null, cine: null, painT: 0, roarT: 0, signs: [], menuT: 0,
};
const MA_BOSS = { on: false, hp: 0, maxHp: 0, phase: 0, dead: false, bar: null };
const _mbV = new THREE.Vector3(), _mbV2 = new THREE.Vector3(), _mbV3 = new THREE.Vector3(), _mbV4 = new THREE.Vector3(), _mbQ = new THREE.Quaternion();
const maFwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)];

/* ---------------------------------------------------------------- Peau par morceaux --
   Jeu 2.0.7 (décision d'Anthony du 13 novembre 2026, « Par morceaux en jeu ») : la peau de la Mère-Vase (quatre
   textures de 2048 × 1024 en qualité haute : 91 % du temps de sa création, 4 s sur son PC) ne se calcule plus au
   chargement. La bête est créée avec une peau provisoire (teinte moyenne, relief plat, sans les pores lumineux), puis
   sa peau se calcule par morceaux pendant la partie (MereVase.skinTexturesSteps : retouches/modules.py), quelques
   millisecondes par image (5 ms, 10 ms quand le joueur est sur l'eau ou qu'elle s'éveille). À la fin, les textures
   remplacent les provisoires une par une (mêmes réglages : le programme ne change pas, rien à recompiler), chacune
   envoyée tout de suite à la carte graphique. Une fois par session : la bête est gardée d'une partie à l'autre. */
const MA_PEAU = { gen: null, q: null, t0: 0, calc: 0, pret: false, pose: null, n: 0, envoi: null, prov: null, moy: 0 };
function maPeauProvisoire() {
  const tex = (rgb, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(c);                // mêmes réglages que les textures du module (son toTex)
    t.flipY = false; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  };
  return { map: tex([44, 43, 32], true), normalMap: tex([128, 128, 255], false), roughnessMap: tex([140, 140, 140], false), emissiveMap: tex([0, 0, 0], true) };
}
/* Une texture envoyée tout de suite à la carte graphique (sinon, au premier rendu de la bête : un à-coup à son
   apparition) : une image de 1 × 1 pixel d'un carré qui la porte. Ses deux programmes (sRGB, linéaire) sont compilés
   au chargement (compile : sans rendu), avec la peau provisoire. */
function maPeauEnvoi(t, compile) {
  try {
    const E = MA_PEAU.envoi || (MA_PEAU.envoi = { rt: new THREE.WebGLRenderTarget(1, 1), sc: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2),
      mats: {}, geo: new THREE.PlaneGeometry(2, 2) });
    const cle = t.encoding === THREE.sRGBEncoding ? 's' : 'l';
    const m = E.mats[cle] || (E.mats[cle] = new THREE.MeshBasicMaterial({ fog: false, depthTest: false, depthWrite: false }));
    m.map = t; m.needsUpdate = !m.userData.fait; m.userData.fait = true;
    const me = new THREE.Mesh(E.geo, m); me.frustumCulled = false; me.position.z = -1;
    E.sc.add(me);
    if (compile) renderer.compile(E.sc, E.cam);
    else { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(E.rt); renderer.render(E.sc, E.cam); renderer.setRenderTarget(prev); }
    E.sc.remove(me);                                   // (la matière garde sa texture : le même programme resservira)
  } catch (e) { maErr('marais : envoi de la peau de la Mère-Vase', e); }
}
/* Chaque image, dans le marais (maUpdate) : un morceau de peau, ou une texture posée. */
function maPeauPas() {
  const P = MA_PEAU;
  if (P.pose) { maPeauPose(); return; }
  if (!P.gen) return;
  // budget par image : 5 ms (deux morceaux d'environ 2 ms en qualité haute), 10 ms quand le joueur est sur l'eau ou
  // qu'elle s'éveille ; un morceau n'est lancé que s'il tient dans le budget, d'après leur durée moyenne (au moins un)
  const vite = maPlayerOnWater() || (MAB.state !== 'dormant' && MAB.state !== 'devore') || MAM.attn > 20;
  const budget = vite ? 10 : 5, t0 = performance.now();
  try {
    for (let k = 0; ; k++) {
      const t1 = performance.now();
      const r = P.gen.next();
      P.n++;
      P.moy = P.moy ? P.moy * 0.9 + (performance.now() - t1) * 0.1 : performance.now() - t1;
      if (r.done) { P.gen = null; P.pose = [['map', 0], ['normalMap', 1], ['roughnessMap', 2], ['emissiveMap', 3]].map(([k2, i]) => [k2, i, r.value[k2]]); break; }
      if (performance.now() - t0 + P.moy > budget) break;
    }
  } catch (e) { P.gen = null; maErr('marais : la peau de la Mère-Vase (elle garde sa peau provisoire)', e); }
  P.calc += performance.now() - t0;
}
function maPeauPose() {
  const P = MA_PEAU, M = MAB.mv && MAB.mv.materials;
  if (!M) { P.pose = null; return; }
  const [k, i, t] = P.pose.shift(), old = M.skin[k];
  share(t);
  M.skin[k] = t; M.textures[i] = t;
  maPeauEnvoi(t);
  if (old && old !== t) old.dispose();                 // la provisoire
  if (P.pose.length) return;
  P.pose = null; P.pret = true;
  const s = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  try { console.info(`[chargement] marais : peau de la Mère-Vase prête en partie, ${s(performance.now() - P.t0)} après le chargement (${s(P.calc)} de calcul en ${P.n} morceaux, qualité ${P.q})`); } catch (e) { /* console absente */ }
}

/* ---------------------------------------------------------------- Création -- */
function maBeastInit(root) {
  // kit MM 2.1.1 : un échec ne passe plus inaperçu (la carte se jouait sans la bête, sans un mot) : la
  // raison est gardée (MAB.err), dite au début de la partie et dans le diagnostic (F8)
  if (typeof MereVase === 'undefined') { MAB.err = 'mere-vase.js ne s’est pas chargé (erreur dans la page)'; maErr('marais : ' + MAB.err); return; }
  if (!MAB.mv) {
    const q0 = settings.quality === 'high' ? 'high' : settings.quality === 'low' ? 'low' : 'medium';
    for (const q of q0 === 'low' ? ['low'] : [q0, 'low']) {
      try {
        // jeu 2.0.7 : peau provisoire, la vraie se calcule par morceaux en partie (maPeauPas) ; sans le générateur du
        // module (retouches/modules.py), la création d'avant, d'un trait
        const prov = typeof MereVase.skinTexturesSteps === 'function' ? maPeauProvisoire() : null;
        MAB.mv = MereVase.create(THREE, { renderer, quality: q, shadows: settings.quality !== 'low' && q === q0, linear: true, glow: 1.7, wet: 0.75, skinTextures: prov || undefined });
        MAB.err = q === q0 ? null : `chargée en qualité basse (échec en ${q0})`;
        if (prov) {
          Object.assign(MA_PEAU, { gen: MereVase.skinTexturesSteps(THREE, q), q, t0: performance.now(), calc: 0, n: 0, pret: false, pose: null, moy: 0 });
          MA_PEAU.prov = prov;                         // les deux programmes de l'envoi : compilés par maPrewarm (ma04)
        }
        break;
      } catch (e) { MAB.mv = null; MAB.err = `création (${q}) : ${(e && e.message) || e}`; maErr('marais : la Mère-Vase', e); }
    }
    if (!MAB.mv) return;
    // matières et géométrie gardées d'une partie à l'autre (la scène les jette sinon)
    share(MAB.mv.mesh.geometry);
    for (const m of MAB.mv.materials.list) { share(m); _linDone.add(m); if (m.map) share(m.map); }
    for (const t of MAB.mv.materials.textures) share(t);
    MAB.obj = MAB.mv.object;
    MAB.obj.scale.setScalar(MA_CFG.scale);
    MAB.obj.rotation.order = 'YXZ';                 // le cap, puis le tangage (la ruée : le corps se dresse)
    // kit MM 2.1.1 : la nageoire en ruban, plus sombre (hors de l'eau, sous le projecteur de la barque, elle
    // ressortait en voile claire, plus visible que la bête)
    MAB.mv.materials.fin.color.setRGB(0.32, 0.32, 0.3);
    MAB.mv.on('*', (name) => maBeastEvent(name));
    // repères au repos : la morsure et la tête dans le repère de la bête
    MAB.obj.position.set(0, 0, 0); MAB.obj.rotation.set(0, 0, 0); MAB.obj.updateMatrixWorld(true);
    MAB.mv.anchors.bite.getWorldPosition(MAB.biteL); MAB.mv.anchors.head.getWorldPosition(MAB.headL);
  }
  maNavInit();
  root.add(MAB.obj);
  root.add(maBeastShadowInit());
  root.add(maBeastGlowInit());
  MAB.mv.setWater(MA.water, 0.55);
  maBeastReset();
  maVictimPrepare();
}
function maBeastUnload() {
  if (MAB.obj && MAB.obj.parent) MAB.obj.parent.remove(MAB.obj);
  if (MAB.shadow && MAB.shadow.g.parent) MAB.shadow.g.parent.remove(MAB.shadow.g);
  if (MAB.glow && MAB.glow.g.parent) { MAB.glow.light.intensity = 0; MAB.glow.g.parent.remove(MAB.glow.g); }
  if (MAB.snd) { MAB.snd.drone(0); }
  maCineEnd(true);
  maBossBar(false);
  MAB.on = false;
  MAB.nav = null; MA_NAV.dep = MA_NAV.lake = MA_NAV.g = MA_NAV.from = MA_NAV.stamp = MA_NAV.closed = MA_NAV.lm = MA_NAV.lmDeep = null;
}
function maBeastReset() {
  Object.assign(MAB, { state: 'dormant', t: 0, x: MA.fosse.x, z: MA.fosse.z, y: MA_CFG.depth.dive * 1.6, yaw: 0, v: 0, yr: 0, cool: 8, fear: 0, fearT: 0, hurtT: 0, hit: null, painT: 0, roarT: 0, showT: 4, nav: null, far: false, leap: null, grace: null, tgt: null, pitch: 0, prey: null });
  MAB.on = !!MAB.mv;
  if (MAB.obj) { MAB.obj.visible = false; MAB.mv.clearOverrides(); MAB.mv.play('repos', { restart: true }); }
  MA_BOSS.on = false; MA_BOSS.dead = false;
  maBossBar(false);
  maCineEnd(true);
}
function maBeastSave() { return { boss: MA_BOSS.on ? { hp: Math.round(MA_BOSS.hp), phase: MA_BOSS.phase } : null }; }
function maBeastLoad(s) { if (s && s.boss) { MA_BOSS.start({ hp: s.boss.hp }); MA_BOSS.phase = s.boss.phase | 0; } }
/* L'ombre sous la surface : trois taches sombres et floues (tête, corps, queue) posées sur l'eau,
   alignées sur l'échine ; d'autant plus nettes qu'elle nage près de la surface (de 6 m à 1,5 m). */
function maShadowTexture() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTex(c, { clamp: true });
}
function maBeastShadowInit() {
  if (!MAB.shadow) {
    const tex = share(maShadowTexture()), g = new THREE.Group();
    g.name = 'ombre de la bête';
    MAB.shadow = { g, parts: [] };
    for (const [w, l] of [[3.2, 5.5], [4.6, 8], [2.2, 7]]) {
      const mat = share(new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: true }));
      _linDone.add(mat);
      const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(share(geo), mat);
      m.scale.set(w, 1, l); m.renderOrder = 3; m.frustumCulled = false;
      g.add(m); MAB.shadow.parts.push(m);
    }
  }
  return MAB.shadow.g;
}
const _mbS = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function maBeastShadowUpdate() {
  const S = MAB.shadow;
  if (!S) return;
  const vis = MAB.obj && MAB.obj.visible && MAB.state !== 'dormant';
  S.g.visible = vis;
  if (!vis) return;
  const P = [maBeastAnchor('head', _mbS[0]), maBeastAnchor('chest', _mbS[1]), maBeastAnchor('tail', _mbS[2])];
  for (let i = 0; i < 3; i++) {
    const m = S.parts[i], a = P[i], b = i < 2 ? P[i + 1] : P[1];
    const d = MA.water - a.y, k = d < 0.4 ? 0 : 1 - owSmoothstep(1.5, 6.5, d);
    m.material.opacity = 0.62 * k * (i === 1 ? 1 : 0.85);
    const cx = i === 2 ? lerp(a.x, P[1].x, 0.25) : lerp(a.x, b.x, i === 0 ? 0.2 : 0.5), cz = i === 2 ? lerp(a.z, P[1].z, 0.25) : lerp(a.z, b.z, i === 0 ? 0.2 : 0.5);
    m.position.set(cx, MA.water + 0.015, cz);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  }
}
/* La lueur des leurres (kit MM 2.1.1). La nuit, la bête est presque noire : on la voit à sa lumière.
   - sous l'eau : des taches vertes à la surface, au-dessus des leurres et de la tête, d'autant plus
     nettes qu'elle est près de la surface (de 5,5 m à 0,4 m) : « une lumière qui bouge sous l'eau » ;
   - une lumière ponctuelle entre les leurres (posée au ras de l'eau quand elle est dessous : la surface
     s'éclaire par en dessous) : elle éclaire sa tête, l'eau autour, la barque.
   L'intensité dit son humeur : faible quand elle rôde, vive quand elle passe ou guette, éclatante quand
   elle se prépare à mordre (le signal pour fuir). */
const MA_GLOW_K = { ruee: 1.4, festin: 1.1, chasse: 1, rode: 0.45, affleure: 1, traque: 0.7, guet: 1.15, charge: 1, remontee: 1, prepare: 1.3, attaque: 0.9, mord: 0.9, surgit: 1, plonge: 0.35, retraite: 0.25, fuite: 0.15, blesse: 0.6, devore: 0.8 };
const MA_LIGHT_K = { ruee: 2.2, festin: 1.8, chasse: 1.6, rode: 0.5, affleure: 1.7, traque: 1.1, guet: 2.2, charge: 1.8, remontee: 2.4, prepare: 3.2, attaque: 2.6, mord: 2.6, surgit: 2.4, plonge: 0.6, retraite: 0.4, fuite: 0.2, blesse: 1.2, devore: 2.2 };
function maGlowTexture() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.15)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTex(c, { clamp: true });
}
function maBeastGlowInit() {
  if (!MAB.glow) {
    const tex = share(maGlowTexture()), g = new THREE.Group(), col = new THREE.Color(MA_CFG.light.color).convertSRGBToLinear();
    g.name = 'lueur de la bête';
    const parts = [];
    for (const [size, k] of [[3.4, 1], [3.4, 1], [7.5, 0.45]]) {
      const mat = share(new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
      mat.defines = { HFOG_ADD: '' };                     // kit MM 2.1.5 : la brume l'éteint (lumière ajoutée)
      _linDone.add(mat);
      const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(share(geo), mat);
      m.scale.set(size, 1, size); m.renderOrder = 4; m.frustumCulled = false; m.userData.k = k;
      g.add(m); parts.push(m);
    }
    const light = new THREE.PointLight(col, 0, MA_CFG.light.dist, 2);
    light.name = 'lumière des leurres';
    g.add(light);
    MAB.glow = { g, parts, light, k: 0, l: 0, t: 0 };
  }
  MAB.glow.light.intensity = 0;
  return MAB.glow.g;
}
function maBeastGlowUpdate(dt, menu) {
  const L = MAB.glow, B = MAB;
  if (!L) return;
  L.t += dt;
  const st = menu ? 'guet' : B.state;
  const vis = B.obj && B.obj.visible && (menu || B.state !== 'dormant');
  L.k = damp(L.k, vis ? (MA_GLOW_K[st] !== undefined ? MA_GLOW_K[st] : 0.3) : 0, 2.2, dt);
  L.l = damp(L.l, vis ? (MA_LIGHT_K[st] !== undefined ? MA_LIGHT_K[st] : 0.3) : 0, 2.6, dt);
  // kit MM 2.1.4 : la lumière reste toujours dans la scène (intensité 0 quand la bête est loin ou endormie) ;
  // seules les taches (non éclairées) se cachent. En cachant le groupe entier, le nombre de lumières
  // changeait : toutes les matières éclairées se recompilaient au réveil de la bête (plusieurs secondes de
  // gel, et sur certains pilotes la perte du contexte WebGL : le jeu figé ou planté).
  if (!vis && L.k < 0.01) { if (L.shown !== false) { L.shown = false; for (const m of L.parts) m.visible = false; } L.light.intensity = 0; return; }
  if (L.shown !== true) { L.shown = true; for (const m of L.parts) m.visible = true; }
  const A = B.mv.anchors, P = [A.lureL.getWorldPosition(_mbS[0]), A.lureR.getWorldPosition(_mbS[1]), A.head.getWorldPosition(_mbS[2])];
  const pul = 0.82 + 0.18 * Math.sin(L.t * 2.3) * Math.sin(L.t * 0.67 + 1);
  for (let i = 0; i < 3; i++) {
    const m = L.parts[i], a = P[i], dep = MA.water - a.y;
    // sous l'eau : la tache s'avive en remontant ; hors de l'eau : un reflet sous les leurres
    const k = dep < -0.15 ? 0.3 : 1 - owSmoothstep(0.4, 5.5, dep);
    m.material.opacity = clamp(L.k * k * m.userData.k * pul, 0, 1);
    m.position.set(a.x, MA.water + 0.03, a.z);
  }
  const mx = (P[0].x + P[1].x) / 2, my = (P[0].y + P[1].y) / 2, mz = (P[0].z + P[1].z) / 2, dep = MA.water - my;
  L.light.position.set(mx, Math.max(my + 0.4, MA.water + 0.35), mz);
  const flare = st === 'prepare' ? 0.85 + 0.3 * Math.sin(L.t * 9) : 1;
  // tout près de la caméra (la ruée), la lumière s'atténue : sinon la barque vire au vert vif
  const near = st === 'ruee' ? clamp((Math.hypot(mx - camera.position.x, my - camera.position.y, mz - camera.position.z) - 1) / 5, 0.3, 1) : 1;
  L.light.intensity = L.l * (1 - owSmoothstep(0.8, 6, dep)) * pul * flare * near;
}
/* La cible regarde-t-elle par là (angle de la caméra à l'horizontale, cos > c) ? */
function maInView(x, z, c = 0.5) {
  const d = camera.getWorldDirection(_mbV3), dx = x - camera.position.x, dz = z - camera.position.z, dl = Math.hypot(dx, dz) || 1, fl = Math.hypot(d.x, d.z) || 1;
  return (d.x * dx + d.z * dz) / (dl * fl) > c;
}
/* Où rôder : un point d'eau profonde à 28-55 m de la cible, dans son champ de vision de préférence
   (sinon n'importe où autour). */
function maRoamPoint(px, pz) {
  const C = MA_CFG, B = MAB;
  // par l'eau (kit MM 2.1.1) : du côté d'où elle vient (le bout de son plus court chemin vers la cible),
  // un point à 28-55 m de la cible, devant elle et à découvert de préférence
  const P = maNavPath(B.x, B.z, px, pz, C.minDepth), ex = P ? P.gx : px, ez = P ? P.gz : pz, mid = (C.roam[0] + C.roam[1]) / 2;
  const pt = maNavRing(ex, ez, 0, C.roam[1] + 10, C.minDepth, (x, z) => {
    const d = Math.hypot(x - px, z - pz);
    return (d >= C.roam[0] && d <= C.roam[1] ? 2 : -Math.abs(d - mid) / 20) + (maInView(x, z, 0.35) ? 1 : 0) + (maWaterLine(px, pz, x, z) ? 0.8 : 0) + Math.random() * 0.6;
  });
  if (pt) return pt;
  const d = camera.getWorldDirection(_mbV3), a0 = Math.atan2(d.z, d.x);
  for (let i = 0; i < 24; i++) {
    const a = i < 14 ? a0 + rand(-0.9, 0.9) : Math.random() * TAU, r = rand(C.roam[0], C.roam[1]);
    const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (maDepth(x, z) >= C.minDepth && maInLake(x, z)) return [x, z];
  }
  return maDeepNear(px, pz, C.roam[0], C.roam[1] + 30);
}
/* Faire surface en passant ? (chaque 15-24 s sur l'eau, dès le premier palier, à 16-70 m) */
function maShowReady(dt, onWater, dP) {
  const S = MA_CFG.show;
  if (!(onWater || maPlayerWading()) || MAM.level < 1 || MA_BOSS.on) return false;
  MAB.showT -= dt;
  if (MAB.showT > 0) return false;
  if (dP < S.near || dP > S.far || maDepth(MAB.x, MAB.z) < 2.6 || !maWaterLine(MAB.x, MAB.z, player.pos.x, player.pos.z)) { MAB.showT = 0.8; return false; }
  return true;
}
/* Son : la voix de la bête sur le bus des effets (créée au premier besoin). */
function maBeastSnd() {
  if (MAB.snd) return MAB.snd;
  const b = Sound.bus();
  if (!b || typeof MereVaseAudio === 'undefined') return null;
  try { MAB.snd = MereVaseAudio.create(b.ctx, b.sortie, { volume: 1 }); } catch (e) { MAB.snd = null; }
  return MAB.snd;
}
/* Jouer un son de la bête depuis un point : distance, côté, eau entre elle et l'oreille. */
function maBeastSay(name, x, y, z, o = {}) {
  const S = maBeastSnd();
  if (!S) return;
  const L = camera.position, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz, (y - L.y) * 0.5);
  const yaw = VEH.drive ? VEH.drive.yaw + VEH.lookYaw : player.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const pan = d > 0.5 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8 : 0;
  const ref = o.ref || 14, gain = (o.vol || 1) / (1 + Math.pow(Math.max(0, d - 2) / ref, 1.5));
  const under = y < MA.water - 0.3;
  S.play(name, { gain: clamp(gain, 0, 1.6), pan, lp: under ? 900 : clamp(20000 - d * 60, 2500, 20000), under, wet: clamp(0.15 + d / 120, 0.15, 0.9), rate: o.rate || rand(0.94, 1.06) });
}

/* -------------------------------------------------------------- La menace -- */
function maThreatReset() { Object.assign(MAM, { attn: 0, level: 0, water: 0, trip: 0, signT: 6, bumpT: 0, quietT: 0, dread: 0, shots: 0, lastShotT: -9, breached: false }); MA.dread = 0; }
/* Où est la cible principale (le joueur), et comment elle fait du bruit. */
function maWaterK(x, z) {
  const C = MA_CFG.attn, d = maDepth(x, z), F = MA.fosse;
  let k = d > MA_CFG.minDepth ? C.deep : d > 1.6 ? 1 : d > 0.9 ? C.bar : C.shallow;
  if (Math.hypot(x - F.x, z - F.z) < F.r * 1.2) k = C.fosse;
  // près d'une rive (terre à moins de 15 m) : elle s'approche mal
  const I = maIslandAt(x, z, 1.35);
  if (I) k *= C.shore + (1 - C.shore) * 0.5;
  return k;
}
function maThreatUpdate(dt) {
  if (!MAB.on || G.state !== 'playing') return;
  const C = MA_CFG.attn, p = player, V = VEH.drive, onWater = maPlayerOnWater();
  const roundK = 1 + C.roundK * Math.max(0, G.round - 1);
  const bossK = MA_BOSS.on ? MA_CFG.boss.phases[MA_BOSS.phase].aggression : 1;
  if (onWater) {
    MAM.trip += dt;
    const wk = maWaterK(p.pos.x, p.pos.z), tripK = 1 + MAM.trip / C.trip;
    let g;
    if (MA_SWIM.on) g = C.swim;
    else if (V && V.T.boat) {
      const thr = Math.abs(V.thr || 0), sp = Math.abs(V.v);
      g = V.motor ? (sp < 0.8 ? C.idle : C.motor * (0.4 + 0.6 * thr)) : C.drift;
      if (V.lights) g += C.light;
    } else g = C.drift;
    MAM.rate = g * wk * tripK * roundK * bossK;
    MAM.attn += MAM.rate * dt;
  } else if (maPlayerWading()) {
    // kit MM 2.1.1 : on patauge au bord de l'eau profonde : elle entend, vient voir et se montre, sans
    // pouvoir attaquer (la menace s'arrête à 45 : ni traque ni attaque ; les hauts-fonds restent un refuge)
    MAM.trip = Math.max(0, MAM.trip - dt);
    if (MAM.attn < C.wadeCap) { MAM.rate = C.wade * roundK; MAM.attn = Math.min(C.wadeCap, MAM.attn + MAM.rate * dt); }
    else { MAM.rate = -C.land * 0.5; MAM.attn = Math.max(C.wadeCap, MAM.attn - C.land * 0.5 * dt); }
  } else {
    MAM.rate = MAM.attn > (MA_BOSS.on ? 35 : 0) ? -C.land : 0;
    MAM.trip = Math.max(0, MAM.trip - dt * 3);
    if (MAM.trip <= 0) MAM.breached = false;
    // à terre : elle perd la trace (sauf près de l'eau profonde, où un tir l'attire encore)
    MAM.attn = Math.max(MA_BOSS.on ? 35 : 0, MAM.attn - C.land * dt);
  }
  MAM.attn = clamp(MAM.attn, 0, 100);
  const lv = MAM.attn >= 80 ? 4 : MAM.attn >= 60 ? 3 : MAM.attn >= 40 ? 2 : MAM.attn >= 20 ? 1 : 0;
  if (lv !== MAM.level) { const old = MAM.level; MAM.level = lv; maEmit('menace', { level: lv, from: old, attn: MAM.attn }); }
  // effroi (brouillard, lucioles, ambiance) : selon la menace et la distance de la bête
  const d = Math.hypot(MAB.x - p.pos.x, MAB.z - p.pos.z);
  const near = MAB.state === 'dormant' ? 0 : 1 - owSmoothstep(30, 140, d);
  MAM.dread = damp(MAM.dread, owSmoothstep(25, 95, MAM.attn) * (0.35 + 0.65 * near), 0.8, dt);
  MA.dread = MAM.dread;
  maSigns(dt, onWater);
}
/* À pied dans l'eau (les pieds au fond, pas sur un ponton), à moins de 20 m d'eau assez profonde pour elle ? */
function maPlayerWading() {
  if (MA_SWIM.on || VEH.drive) return false;
  const p = player;
  if (p.gy > MA.water - 0.2 || maDepth(p.pos.x, p.pos.z) < 0.25) return false;
  return maDepthAround(p.pos.x, p.pos.z, 20) > MA_CFG.attackDepth + 0.5;
}
/* Un tir ou une explosion près de l'eau : elle l'entend (appelé par hitscan, explode). */
function maNoise(x, z, kind) {
  if (!OW.on || OW.worldId !== 'marais' || !MAB.on) return;
  const C = MA_CFG.attn;
  // à terre loin de l'eau profonde, presque rien ; sur l'eau ou sur un ponton, beaucoup
  const nearDeep = maPlayerOnWater() || maDepthAround(x, z, 12) > 1.6;
  const k = nearDeep ? 1 : 0.15;
  MAM.attn = clamp(MAM.attn + (kind === 'blast' ? C.blast : C.shot) * k * (G.time - MAM.lastShotT < 0.5 ? 0.6 : 1), 0, 100);
  MAM.lastShotT = G.time;
}
/* Profondeur maximale autour d'un point (8 directions). */
function maDepthAround(x, z, r) {
  let m = maDepth(x, z);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; m = Math.max(m, maDepth(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
  return m;
}
/* Les signes : selon le niveau, programmés (rarement au début, de plus en plus souvent). */
function maSigns(dt, onWater) {
  MAM.signT -= dt;
  const p = player, lv = MAM.level;
  if (MAM.signT > 0 || lv === 0) return;
  const S = maBeastSnd();
  const dB = Math.hypot(MAB.x - p.pos.x, MAB.z - p.pos.z);
  if (lv === 1) {
    MAM.signT = rand(16, 28);
    // au loin, dans la brume : une plainte, ou une gerbe (la queue qui frappe l'eau)
    if (Math.random() < 0.55) maBeastSay('appel', MAB.x, MA.water - 2, MAB.z, { vol: 0.9, ref: 40 });
    else { const pt = maFarWater(p.pos.x, p.pos.z, 55, 95); if (pt) { maSplash(pt[0], pt[1], 2.2); maBeastSay('claque', pt[0], MA.water, pt[1], { vol: 1.2, ref: 30 }); } }
  } else if (lv === 2) {
    MAM.signT = rand(8, 14);
    const r = Math.random();
    if (onWater && r < 0.45) {
      // des bulles qui crèvent près de la barque (elle souffle dessous)
      const pt = maFarWater(p.pos.x, p.pos.z, 7, 16);
      if (pt) { for (let i = 0; i < 4; i++) setTimeout(() => maBubbles(pt[0] + rand(-1, 1), pt[1] + rand(-1, 1), 6, 1.4), i * 260); maBeastSay('bulles', pt[0], MA.water - 0.4, pt[1], { vol: 1.1, ref: 10 }); }
    } else if (r < 0.75) maBeastSay('grondement', MAB.x, MAB.y, MAB.z, { vol: 1.1, ref: 30 });
    else { const pt = maFarWater(p.pos.x, p.pos.z, 30, 60); if (pt) { maSplash(pt[0], pt[1], 1.8); maBeastSay('claque', pt[0], MA.water, pt[1], { vol: 1, ref: 25 }); } }
  } else {
    MAM.signT = rand(5, 9);
    if (dB < 40) maBeastSay(Math.random() < 0.6 ? 'grondement' : 'souffle', MAB.x, MAB.y, MAB.z, { vol: 1.3, ref: 18 });
    else maBeastSay('appel', MAB.x, MAB.y, MAB.z, { vol: 1.1, ref: 30 });
  }
}
/* Un point d'eau profonde entre rmin et rmax d'un point (ou null). */
function maFarWater(x, z, rmin, rmax) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * TAU, r = rand(rmin, rmax), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (maDepth(px, pz) > 1.5) return [px, pz];
  }
  return null;
}

/* ------------------------------------------------------------ La bête bouge -- */
/* Monde → repère de la bête : position de la morsure, de la tête (après la pose courante). */
function maBeastAnchor(name, out) {
  MAB.obj.updateMatrixWorld(true);
  return MAB.mv.anchors[name].getWorldPosition(out);
}
/* Le point où la tête doit arriver pour mordre (x, z) : la racine recule de la longueur du cou. */
function maRootFor(x, z, yaw) { const [fx, fz] = maFwd(yaw), d = MAB.biteL.z * MA_CFG.scale; return [x - fx * d, z - fz * d]; }
/* Avancer vers (tx, tz) à la vitesse v, en tournant au plus de turn rad/s, par l'eau d'au moins
   minDepth mètres : tout droit si la voie est libre, sinon par le chemin (ma12_nav.js) ; à vue (le
   côté le plus profond devant la tête) s'il n'y a aucun chemin. */
function maBeastSteer(dt, v, turn, minDepth) {
  const B = MAB, [fx, fz] = maFwd(B.yaw);
  const aim = maNavAim(B.tx, B.tz, minDepth);
  let want = aim ? Math.atan2(aim[0] - B.x, aim[1] - B.z) : Math.atan2(B.tx - B.x, B.tz - B.z);
  // sans chemin : le haut-fond devant la tête, choisir le côté le plus profond
  const look = 10 + v * 1.5, hx = B.x + fx * (MAB.headL.z + look), hz = B.z + fz * (MAB.headL.z + look);
  if (!aim && maDepth(hx, hz) < minDepth) {
    let best = want, bd = -1;
    for (const s of [-1, 1]) for (const a of [0.5, 1.0, 1.6, 2.3]) {
      const ang = B.yaw + s * a, [ax, az] = maFwd(ang), d = maDepth(B.x + ax * (MAB.headL.z + look), B.z + az * (MAB.headL.z + look));
      if (d > bd + 0.01) { bd = d; best = ang; }
    }
    want = best;
  }
  const dyaw = wrapAngle(want - B.yaw);
  B.yr = damp(B.yr, clamp(dyaw * 1.4, -turn, turn), 3, dt);
  B.yaw = wrapAngle(B.yaw + B.yr * dt);
  B.v = damp(B.v, v, 1.2, dt);
  const [nx, nz] = maFwd(B.yaw);
  const px = B.x + nx * B.v * dt, pz = B.z + nz * B.v * dt;
  // ne monte pas sur les berges : si la tête irait dans moins de 1,2 m d'eau, elle s'arrête
  if (maDepth(px + nx * MAB.headL.z, pz + nz * MAB.headL.z) > 1.2 || maDepth(px, pz) > maDepth(B.x, B.z)) { B.x = px; B.z = pz; }
  else B.v *= 0.5;
}
function maBeastSetState(s) {
  const B = MAB;
  if (B.state === s) return;
  maEmit('bete', { state: s, from: B.state, x: Math.round(B.x), z: Math.round(B.z) });   // un seul événement par changement (MM 2.1.0 : deux pour « surgit »)
  if (B.state === 'ruee') B.mv.set({ headPitch: null });   // la tête n'est plus pointée sur la proie
  B.state = s; B.t = 0;
  if (s === 'rode') B.fresh = true;          // un nouveau point où rôder (MM 2.1.1 : l'ancien la renvoyait vers La Fosse au réveil)
  if (s === 'charge' && !MA_BOSS.on) maBeastSay('remous', B.x, MA.water - 1, B.z, { vol: 1.5, ref: 30 });   // elle fonce : l'eau qui bouillonne
  const mv = B.mv;
  switch (s) {
    case 'rode': case 'traque': case 'retraite': case 'fuite': case 'charge': case 'festin': mv.play(maBeastWeak() ? 'affaibli' : 'nage'); break;
    case 'guet': mv.play('guet'); break;
    case 'remontee': mv.play('remontee'); break;
    case 'prepare': mv.play('preparation'); maBeastSay('grondement', B.x, MA.water, B.z, { vol: 1.5, ref: 16 }); break;
    case 'attaque': mv.play('attaqueBarque'); B.hit = null; break;
    case 'mord': mv.play('attaqueJoueur'); B.hit = null; break;
    case 'plonge': mv.play('plongee', { next: maBeastWeak() ? 'affaibli' : 'nage' }); break;
    case 'surgit': mv.play('surgissement', { next: 'nage' }); break;
    case 'affleure': B.showYaw = null; B.slap = false; mv.play(maBeastWeak() ? 'affaibli' : 'nage'); break;
    case 'ruee': mv.play('nage'); B.leap = { go: false }; MA_AMB.duckT = MA_CFG.leap.hush + 0.15; break;   // le silence, puis le bond (maLeapLaunch)
    case 'chasse': mv.play(maBeastWeak() ? 'affaibli' : 'nage'); B.growlT = 1.5; break;
    case 'devore': mv.play('devoration'); break;
    case 'blesse': mv.play('degats', { next: maBeastWeak() ? 'affaibli' : 'nage' }); break;
    case 'mort': mv.play('mort'); break;
    default: mv.play('repos');
  }
}
/* Chaque image. */
function maBeastUpdate(dt) {
  const B = MAB;
  if (!B.on || !B.mv) return;
  if (G.state !== 'playing') return;
  B.t += dt; B.cool -= dt; B.hurtT -= dt; B.painT -= dt; B.roarT -= dt;
  B.fearT -= dt; if (B.fearT <= 0) B.fear = Math.max(0, B.fear - dt * 60);
  const p = player, C = MA_CFG, V = VEH.drive, onWater = maPlayerOnWater();
  const px = p.pos.x, pz = p.pos.z, dP = Math.hypot(px - B.x, pz - B.z);
  const lv = MAM.level, bossP = MA_BOSS.on ? C.boss.phases[MA_BOSS.phase] : null;
  const cooldown = bossP ? bossP.cooldown : C.attack.cooldown;
  switch (B.state) {
    case 'dormant': {
      B.ty = C.depth.dive * 1.6;
      if (lv >= 1 || MA_BOSS.on) {
        // elle se réveille au fond de La Fosse si la cible en est proche ; sinon, elle était déjà dans
        // les parages : en eau profonde, à 80-120 m, hors de vue (kit MM 2.1.1 : depuis La Fosse, il lui
        // fallait jusqu'à 2 min 30 pour rejoindre l'Îlot des Pierres)
        const F = MA.fosse, fp = Math.hypot(px - F.x, pz - F.z) < 150 ? maNavPath(F.x, F.z, px, pz, C.minDepth) : null;
        const pt = fp && fp.len < 150 ? null
          : maNavRing(px, pz, C.wake[0], C.wake[1], C.minDepth, (x, z) => Math.random() - (maInView(x, z, 0.3) ? 0.5 : 0)) || maDeepNear(px, pz, C.wake[0], C.wake[1]);
        B.x = pt ? pt[0] : F.x; B.z = pt ? pt[1] : F.z; B.y = C.depth.dive; B.yaw = Math.atan2(px - B.x, pz - B.z);
        B.showT = rand(C.show.first[0], C.show.first[1]);
        maBeastSetState('rode');
      }
      break;
    }
    case 'rode': {
      if (!onWater && maBeastFeast()) break;                // kit 2.0.7 : le joueur à terre, les Noyés deviennent ses proies
      // rôde en eau profonde à 28-55 m de la cible (devant elle de préférence) ; plus haut quand elle est
      // proche (la lueur des leurres se voit sous l'eau) ; vite quand elle est encore loin
      B.ty = dP < 80 ? C.depth.near : C.depth.cruise;
      if (B.fresh || B.t > 14 || Math.hypot(B.tx - B.x, B.tz - B.z) < 10 || maDepth(B.tx, B.tz) < C.minDepth) {
        const pt = maRoamPoint(px, pz) || [MA.fosse.x, MA.fosse.z];
        B.tx = pt[0]; B.tz = pt[1]; B.t = 0.01; B.fresh = false;
      }
      const vr = C.speed.rode + clamp((dP - 60) / 50, 0, 1) * (C.speed.approche - C.speed.rode);
      maBeastSteer(dt, vr, vr > 4 ? 0.8 : C.turn.rode, C.minDepth);
      if (maShowReady(dt, onWater, dP)) { maBeastSetState('affleure'); break; }
      if (lv >= 3 && onWater) maBeastSetState('traque');
      else if (lv === 0 && !MA_BOSS.on && dP > 120) { B.obj.visible = false; maBeastSetState('dormant'); }
      break;
    }
    case 'traque': {
      // tourne autour de la cible à 12-18 m, juste sous la surface (lueur des leurres) ; le dos affleure
      // 3,5 s toutes les 13 s ; passe dessous de temps en temps (la coque cogne)
      const ang = G.time * 0.21 + 1.3, R = 15 + 3 * Math.sin(G.time * 0.37);
      const under = (G.time % 22) < 4.5, crest = !under && (G.time % 13) > 9.5;
      B.ty = under ? C.depth.stalk : crest ? C.depth.show : C.depth.near;
      B.tx = under ? px : px + Math.cos(ang) * R; B.tz = under ? pz : pz + Math.sin(ang) * R;
      const vs = Math.max(C.speed.traque, V ? Math.abs(V.v) * 0.9 : 0);
      maBeastSteer(dt, vs, C.turn.traque, C.attackDepth + 0.6);
      maBeastWakeFx(dt);
      // passage sous la barque
      if (V && V.T.boat && dP < 4 && B.t > 1) {
        MAM.bumpT -= dt;
        if (MAM.bumpT <= 0) { MAM.bumpT = rand(6, 10); maBoatBump(V, 1); }
      }
      if (!onWater) { if (!maBeastFeast()) maBeastSetState(lv >= 2 ? 'rode' : 'retraite'); break; }
      // une fois par traversée : elle jaillit de l'eau, à distance (un avertissement, sans attaque)
      if (!MAM.breached && lv === 3 && B.t > 3 && dP > 14 && dP < 60 && maDepth(B.x, B.z) > 3.2 && maInView(B.x, B.z, 0.45) && Math.random() < dt * C.breach) { MAM.breached = true; maBeastSetState('surgit'); break; }
      if (lv >= 4 && B.cool <= 0) maBeastSetState(MA_BOSS.on && V && Math.abs(V.v) < 0.8 && !MA_SWIM.on && Math.random() < 0.5 ? 'guet' : 'charge');
      else if (lv <= 1) maBeastSetState('rode');
      break;
    }
    case 'guet': {
      // embuscade : elle se poste devant la barque arrêtée, leurres à la surface (des lumières sur l'eau)
      B.ty = C.depth.lure;
      if (B.t < 0.1) {
        // devant la barque arrêtée (22 m) ; la cible hors d'atteinte (B.far) : l'eau assez profonde la plus
        // proche d'elle (kit MM 2.1.1 : elle attend au bord du haut-fond, leurres allumés, au lieu de repartir)
        const [fx, fz] = V && !B.far ? vehFwd(V.yaw) : [0, 0], ax = px + fx * 22, az = pz + fz * 22;
        let k = B.far ? -1 : maNavNearest(ax, az, C.attackDepth + 1, 4);
        if (k < 0) k = maNavNearest(px, pz, C.attackDepth + 0.5, 15);
        const pt = k >= 0 ? [maNavX(k), maNavZ(k)] : maDeepNear(ax, az, 0, 10, C.attackDepth + 1) || [ax, az];
        B.tx = pt[0]; B.tz = pt[1];
      }
      if (Math.hypot(B.tx - B.x, B.tz - B.z) > 3) maBeastSteer(dt, B.far ? 4 : 2.5, 0.6, C.attackDepth + (B.far ? 0.5 : 1));
      else { B.v = damp(B.v, 0, 1, dt); B.yaw = wrapAngle(B.yaw + clamp(wrapAngle(Math.atan2(px - B.x, pz - B.z) - B.yaw), -0.3, 0.3) * dt); }
      // trop près des leurres, ou le temps passe : elle charge
      const dHead = maHeadDist(px, pz);
      if (dHead < 10 || B.t > 16 || (MAM.attn >= 100 && B.t > (B.far ? 8 : 0)) || !onWater) { B.far = false; if (onWater || !maBeastFeast()) maBeastSetState(onWater ? 'charge' : 'retraite'); }
      break;
    }
    case 'charge': {
      // se placer pour mordre : la tête vers la cible, depuis l'eau profonde ; vite (MM 2.1.3 : 10 m/s, plus
      // près de la surface : le sillage et les leurres se voient foncer)
      const tgt = maAttackTarget(MA_BOSS.on ? 3.2 : C.leap.hush + C.leap.dur + 0.3);
      if (!tgt) { maBeastSetState('retraite'); break; }
      B.ty = MA_BOSS.on ? C.depth.stalk + 0.4 : C.depth.stalk + 0.8;
      const yaw = Math.atan2(tgt.x - B.x, tgt.z - B.z), [rx, rz] = maRootFor(tgt.x, tgt.z, yaw);
      const dHead = maHeadDist(tgt.x, tgt.z), facing = Math.abs(wrapAngle(yaw - B.yaw));
      // tout près (moins de 14 m), de côté : à 10 m/s, elle tournait autour de sa proie sans jamais lui
      // faire face (rayon de virage 8 m) ; elle ralentit, vire sec et pointe la tête droit sur elle
      const close = !MA_BOSS.on && dHead < 14;
      B.tx = close ? tgt.x : rx; B.tz = close ? tgt.z : rz;
      maBeastSteer(dt, MA_BOSS.on ? 7 : close && facing > 0.5 ? 4 : C.speed.charge, close ? 2.4 : C.turn.charge, C.attackDepth);
      maBeastWakeFx(dt);
      // la ruée (hors combat de boss) : à portée de bond, face à la cible
      if (!MA_BOSS.on && MAM.attn >= C.leap.at && B.cool <= 0 && dHead < C.leap.range[1] && (dHead < C.leap.range[0] || facing < 0.5)) { B.tgt = tgt; maBeastSetState('ruee'); break; }
      if (MA_BOSS.on && dHead < 9 && facing < 0.6 && MAM.attn >= 92) { maBeastSetState('remontee'); break; }
      if (B.t > 3 && dHead > 9 && maNavStuck(rx, rz)) { B.far = true; maBeastSetState('guet'); break; }   // hors d'atteinte : elle attend au plus près, leurres allumés
      if (B.t > 20 || !onWater && !tgt.dock) { MAM.attn = Math.min(MAM.attn, 70); if (onWater || !maBeastFeast()) maBeastSetState('retraite'); }
      break;
    }
    case 'remontee': {
      // elle remonte en se plaçant : face à la cible, à la distance de sa détente
      const tgt = maAttackTarget(Math.max(0, 1 - B.t) + 2.17);
      B.ty = C.depth.rise;
      if (tgt) maBeastPoise(dt, tgt, 3.2);
      if (B.t > 1.0) maBeastSetState('prepare');
      break;
    }
    case 'prepare': {
      // 1,8 s : se dresse, gronde, ouvre la gueule (le temps de fuir) ; elle garde la cible en face
      const tgt = maAttackTarget(Math.max(0, 1.75 - B.t) + 0.42);
      B.ty = C.depth.surface;
      if (tgt) maBeastPoise(dt, tgt, 1.8);
      else B.v = damp(B.v, 0, 2, dt);
      if (B.t > 1.75) {
        if (!tgt) { maBeastSetState('plonge'); break; }
        maBeastSetState(tgt.kind === 'barque' ? 'attaque' : 'mord');
        B.tgt = tgt;
      }
      break;
    }
    case 'attaque': case 'mord': {
      // détente : la tête part vers la cible (la racine avance), en corrigeant un peu sa visée
      B.ty = C.depth.surface;
      const lunge = B.t < 0.45 ? 6.5 : B.t < 1.3 ? 1.0 : 0;
      const tg = B.tgt && (B.tgt.boat ? B.tgt.boat : B.tgt.kind === 'nageur' || B.tgt.dock ? player.pos : null);
      if (tg && B.t < 0.4) { const want = Math.atan2(tg.x - B.x, tg.z - B.z); B.yaw = wrapAngle(B.yaw + clamp(wrapAngle(want - B.yaw), -C.attack.home * dt, C.attack.home * dt)); }
      const [fx, fz] = maFwd(B.yaw);
      B.x += fx * lunge * dt; B.z += fz * lunge * dt;
      // la barque saisie suit la gueule : soulevée, l'avant en l'air, secouée, puis lâchée
      if (B.hit && B.hit.boat) {
        const BV = B.hit.boat, held = B.t > 0.45 && B.t < 1.5 && !BV.capsized;
        if (held) { const H = maBeastAnchor('bite', _mbV); BV.x = damp(BV.x, H.x, 2.5, dt); BV.z = damp(BV.z, H.z, 2.5, dt); }
        BV.grab = damp(BV.grab || 0, held ? 1 : 0, held ? 6 : 3, dt);
        if (!held && B.t >= 1.5 && !B.hit.dropped) { B.hit.dropped = true; BV.hv -= 2.5; maSplash(BV.x, BV.z, 1.6); }
      }
      if (B.t > (B.state === 'attaque' ? 1.9 : 1.3)) maBeastAfterAttack();
      break;
    }
    case 'affleure': {
      // elle passe en surface, de profil : le dos et la crête crèvent l'eau, sillage, leurres allumés ;
      // un souffle quand la tête sort (un jet d'embruns, le bruit), la queue claque en replongeant (6,5 s)
      const S = C.show;
      if (B.showYaw === null) {
        const a = Math.atan2(px - B.x, pz - B.z), side = (s) => { const [fx, fz] = maFwd(a + s * 1.35); return maDepth(B.x + fx * 20, B.z + fz * 20); };
        B.showYaw = a + (side(1) >= side(-1) ? 1 : -1) * 1.35;               // presque de profil, un peu vers la cible
        B.blow = false;
        maRipple(B.x, B.z, 0.05);
      }
      if (!B.blow && B.t > 1.0) {
        B.blow = true;
        const H = maBeastAnchor('head', _mbV);
        maSplash(H.x, H.z, 1.3, { up: 1.7 });
        maBeastSay('souffle', H.x, MA.water, H.z, { vol: 1.6, ref: 34 });
      }
      const [fx, fz] = maFwd(B.showYaw);
      B.tx = B.x + fx * 30; B.tz = B.z + fz * 30;
      const up = B.t < S.dur - 1.3;
      B.ty = up ? C.depth.show : C.depth.cruise;
      maBeastSteer(dt, C.speed.montre, 0.5, 2.6);
      maBeastWakeFx(dt);
      if (!up && !B.slap) { B.slap = true; const T = maBeastAnchor('tail', _mbV); maSplash(T.x, T.z, 2.2); maBeastSay('claque', T.x, MA.water, T.z, { vol: 1.4, ref: 30 }); }
      if (B.t > S.dur) { B.showT = rand(S.every[0], S.every[1]); maBeastSetState(lv >= 3 && onWater ? 'traque' : 'rode'); }
      break;
    }
    case 'ruee': {
      const L = B.leap;
      if (!L || !L.go) {
        // le silence avant le bond : elle fonce encore sous l'eau, sur l'endroit où sera sa proie
        const tgt = maAttackTarget(C.leap.hush - B.t + C.leap.dur) || B.tgt;
        if (tgt) {
          B.tgt = tgt;
          const yaw = Math.atan2(tgt.x - B.x, tgt.z - B.z), [rx, rz] = maRootFor(tgt.x, tgt.z, yaw);
          B.tx = rx; B.tz = rz;
          maBeastSteer(dt, C.speed.charge, 2.4, C.attackDepth);
        }
        B.ty = C.depth.stalk + 0.8;
        maBeastWakeFx(dt);
        if (B.t >= C.leap.hush) maLeapLaunch();
        break;
      }
      maLeapStep(dt);
      break;
    }
    case 'chasse': {
      // le naufragé : elle tourne autour de lui à 14-26 m, juste sous la surface, le dos qui crève l'eau
      // par moments, leurres allumés, grondements ; au bout du délai (B.cool), s'il nage encore, la ruée
      const ang = G.time * 0.33 + 0.7, R = 20 + 6 * Math.sin(G.time * 0.45);
      B.tx = px + Math.cos(ang) * R; B.tz = pz + Math.sin(ang) * R;
      B.ty = (G.time % 9) > 5.5 ? C.depth.show : C.depth.near;
      maBeastSteer(dt, 4.5, 1.0, C.attackDepth + 0.6);
      maBeastWakeFx(dt);
      B.growlT -= dt;
      if (B.growlT <= 0) { B.growlT = rand(3.5, 6.5); maBeastSay(Math.random() < 0.55 ? 'grondement' : 'souffle', B.x, MA.water, B.z, { vol: 1.35, ref: 22 }); }
      MAM.attn = Math.max(MAM.attn, 90);
      if (!onWater) {
        // il a pied (ou il est sorti de l'eau) : de rage, elle se jette au bord du haut-fond, sans l'atteindre
        if (dP < 45 && maDepth(B.x, B.z) > 2.4) { B.yaw = Math.atan2(px - B.x, pz - B.z); maBeastSetState('surgit'); }
        else if (!maBeastFeast()) maBeastSetState('retraite');
        MAM.attn = Math.min(MAM.attn, 45); B.cool = Math.max(B.cool, 12);
        break;
      }
      if (B.cool <= 0) maBeastSetState('charge');
      break;
    }
    case 'surgit': {
      // jaillit : la racine monte au ras de l'eau (jusqu'à +0,85 m), l'élan vers l'avant ; le corps se cabre (animation), retombe
      B.ty = C.depth.surface + 1.6 * owSmoothstep(0.25, 0.85, B.t) * (1 - owSmoothstep(1.7, 2.6, B.t));
      B.v = damp(B.v, 3.5, 1.5, dt);
      { const [fx, fz] = maFwd(B.yaw); if (maDepth(B.x + fx * 8, B.z + fz * 8) > 2.5) { B.x += fx * B.v * dt; B.z += fz * B.v * dt; } }
      if (B.t > 3.3) { MAM.attn = Math.min(MAM.attn, 70); maBeastSetState('plonge'); }
      break;
    }
    case 'plonge': {
      B.ty = C.depth.dive;
      const [fx, fz] = maFwd(B.yaw); B.v = damp(B.v, 3, 1, dt); B.x += fx * B.v * dt; B.z += fz * B.v * dt;
      if (B.t > 2.2) maBeastSetState('retraite');
      break;
    }
    case 'retraite': case 'fuite': {
      if (B.state === 'retraite' && !onWater && B.t > 1.5 && maBeastFeast()) break;   // kit 2.0.7
      // s'éloigner de 70 m en eau profonde, puis rôder
      B.ty = B.state === 'fuite' ? C.depth.dive : C.depth.cruise;
      if (B.t < 0.1) { const pt = maDeepNear(B.x * 2 - px, B.z * 2 - pz, 0, 40) || [MA.fosse.x, MA.fosse.z]; B.tx = pt[0]; B.tz = pt[1]; }
      maBeastSteer(dt, B.state === 'fuite' ? C.speed.fuite : C.speed.retraite, C.turn.traque, C.minDepth);
      if (B.t > (B.state === 'fuite' ? 40 : 9)) maBeastSetState('rode');
      break;
    }
    case 'festin': {
      // kit 2.0.7 : elle chasse un Noyé (le joueur est hors de l'eau) ; le joueur revient sur l'eau : c'est lui
      const z = B.prey;
      if (onWater) { maBeastPreyDrop(); maBeastSetState(lv >= 3 ? 'traque' : 'rode'); break; }
      if (!z || !z.alive || z.removed || !z.noye || B.t > C.feast.give) { maBeastPreyDrop(); if (!maBeastFeast(true)) maBeastSetState('rode'); break; }
      const yaw = Math.atan2(z.hx - B.x, z.hz - B.z), [rx, rz] = maRootFor(z.hx, z.hz, yaw);
      const dHead = maHeadDist(z.hx, z.hz), facing = Math.abs(wrapAngle(yaw - B.yaw)), close = dHead < 14;
      B.tx = close ? z.hx : rx; B.tz = close ? z.hz : rz;
      B.ty = C.depth.stalk + 0.8;
      maBeastSteer(dt, close && facing > 0.5 ? 4 : C.feast.speed, close ? 2.4 : C.turn.charge, C.attackDepth);
      maBeastWakeFx(dt);
      if (B.cool <= 0 && dHead < C.leap.range[1] && (dHead < C.leap.range[0] || facing < 0.5)) { B.tgt = { kind: 'noye', x: z.hx, z: z.hz, noye: z }; maBeastSetState('ruee'); break; }
      if (B.t > 3 && dHead > 9 && maNavStuck(rx, rz)) { maBeastPreyDrop(); if (!maBeastFeast(true, z)) maBeastSetState('rode'); }   // hors d'atteinte : un autre
      break;
    }
    case 'devore': maDevourUpdate(dt); break;
    case 'blesse': {
      B.ty = C.depth.stalk;
      B.v = damp(B.v, 0.5, 2, dt);
      if (B.t > 0.9) maBeastSetState(B.fear > C.fleeAt && !MA_BOSS.on ? 'fuite' : 'traque');
      break;
    }
    case 'mort': {
      // remonte le ventre en l'air, dérive
      B.ty = -0.2;
      B.v = damp(B.v, 0, 0.5, dt);
      break;
    }
    default: break;
  }
  // profondeur (la racine) : entre le fond (+1,1 m) et la surface (−0,6 m) ; visibilité, animation
  // (en passant, « affleure », le dos sort de 0,5 m : la racine monte jusqu'à 0,3 m sous la surface)
  const leaping = B.state === 'ruee' && B.leap && B.leap.go;
  const floorY = MA.water - maDepth(B.x, B.z) + 1.1, ceilY = B.state === 'mort' ? -0.2 : B.state === 'surgit' ? MA.water + 2 : leaping ? MA.water + 3 : B.state === 'affleure' ? MA.water - 0.3 : MA.water - 0.6;
  const ty = Math.min(ceilY, Math.max(leaping ? B.y : B.ty, floorY));
  B.y = leaping ? ty : damp(B.y, ty, B.state === 'surgit' ? 6 : B.state === 'prepare' || B.state === 'attaque' || B.state === 'mord' || B.state === 'remontee' ? 2.5 : B.state === 'affleure' ? 1.6 : B.state === 'ruee' ? 3 : 0.9, dt);
  const far = Math.hypot(camera.position.x - B.x, camera.position.z - B.z) > 260;
  B.obj.visible = B.state !== 'dormant' && !far;
  if (!leaping) B.pitch = damp(B.pitch || 0, 0, 2.5, dt);
  B.obj.position.set(B.x, B.y, B.z);
  B.obj.rotation.set(-(B.pitch || 0), B.yaw, 0);
  B.mv.drive({ speed: B.v, turn: clamp(B.yr * 1.6, -1, 1) });
  if (B.obj.visible || B.state === 'devore') B.mv.update(dt);
  maBeastShadowUpdate();
  maBeastGlowUpdate(dt, false);
  // fond sonore de l'approche
  const S = MAB.snd;
  if (S) {
    const d = Math.hypot(camera.position.x - B.x, camera.position.z - B.z);
    const lvl = B.state === 'dormant' || (B.state === 'ruee' && !(B.leap && B.leap.go)) ? 0 : clamp((MAM.attn - 35) / 65, 0, 1) * (1 - owSmoothstep(40, 160, d));
    const yaw = VEH.drive ? VEH.drive.yaw + VEH.lookYaw : player.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    S.drone(lvl, { pan: d > 1 ? clamp(((B.x - camera.position.x) * rx + (B.z - camera.position.z) * rz) / d, -1, 1) : 0, lp: 300 + 900 * (1 - owSmoothstep(10, 80, d)) });
  }
  // barre de vie du combat
  if (MA_BOSS.on) maBossBar(true);
}
/* ------------------------------------------------------------- La ruée (MM 2.1.3) --
   Le bond : le centre de la gueule suit une courbe tracée au départ (Bézier cubique) : il jaillit presque
   à la verticale, monte au-dessus de la proie (de rise à over m au-dessus d'elle), puis plonge sur sa
   tête et s'arrête juste devant ses yeux : à la première personne, on voit la gueule s'élever, se
   tourner vers soi, puis se refermer sur soi. Le temps est déformé (warp) : jaillissement rapide, un
   instant suspendu au sommet, frappe rapide. La racine suit la gueule ; la tête est tournée vers la
   proie (headPitch corrigé à chaque image) ; l'animation « ruee » fait le reste (cou cabré, mâchoire
   béante, demi-mandibules écartées, fermeture à l'impact). */
function maLeapLaunch() {
  const B = MAB, C = MA_CFG.leap;
  const T = maAttackTarget(C.dur) || B.tgt;
  if (!T) { maBeastSetState('plonge'); return; }
  B.tgt = T;
  const M = maMaw(new THREE.Vector3()), Hd = maPlayerHead(new THREE.Vector3());
  // là où sera la tête du pilote (T est la barque à la fin du bond)
  if (T.kind === 'barque' && T.boat) { Hd.x += T.x - T.boat.x; Hd.z += T.z - T.boat.z; }
  // kit 2.0.7 : un Noyé, sa tête au ras de l'eau
  if (T.kind === 'noye' && T.noye) Hd.set(T.noye.hx, Math.max(MA.water + 0.05, T.noye.ey + 0.02), T.noye.hz);
  let dx = Hd.x - M.x, dz = Hd.z - M.z;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const E = [Hd.x - dx * C.stop, Hd.y + C.endUp, Hd.z - dz * C.stop];
  const back = Math.min(C.back, dl * 0.45);
  const P1 = [M.x + dx * dl * 0.08, Hd.y + C.rise, M.z + dz * dl * 0.08];
  const P2 = [E[0] - dx * back, E[1] + C.over, E[2] - dz * back];
  B.yr = 0;      // le cap vers la proie : en 0,18 s (pas d'un coup : de côté, le corps pivoterait d'un bloc)
  B.leap = { go: true, t: 0, P: [[M.x, M.y, M.z], P1, P2, E], aim: [Hd.x, Hd.y, Hd.z], hit: false, tgt: T, look: 0.32, yaw0: B.yaw, yaw1: Math.atan2(dx, dz) };
  B.mv.play('ruee', { next: 'nage' });
  MA_AMB.duckT = 0;
  maLeapSpray(M, 1);
  maSecousse(0.7 * maNearK(M));
  maEmit('attaque', { kind: 'ruee', cible: T.kind });
  if (T.kind === 'noye') MAM.attn = Math.max(MAM.attn, 25);   // elle reste éveillée tant qu'elle chasse
}
function maLeapStep(dt) {
  const B = MAB, C = MA_CFG.leap, L = B.leap;
  L.t += dt;
  B.v = 9; B.yr = 0;
  if (L.t <= C.dur + 0.02) {
    const tau = clamp(L.t / C.dur, 0, 1), u = clamp(tau + C.warp * Math.sin(TAU * tau) / TAU, 0, 1);
    // le corps se dresse hors de l'eau (l'arrière plonge), puis s'abat vers l'avant
    B.yaw = wrapAngle(L.yaw0 + wrapAngle(L.yaw1 - L.yaw0) * owSmoothstep(0, 0.18, L.t));
    B.pitch = C.pitch * owSmoothstep(0, 0.32, tau) - (C.pitch - C.pitchEnd) * owSmoothstep(0.45, 1, tau);
    B.obj.rotation.set(-B.pitch, B.yaw, 0);
    const W = maBez3(L.P, u, _mbV3), M = maMaw(_mbV);
    B.x += W.x - M.x; B.z += W.z - M.z; B.y += W.y - M.y;
    // la tête vers la proie : l'axe de la gueule (du gosier au centre de la gueule) vers sa tête
    if (L.t > 0.08) {
      const Th = maBeastAnchor('throat', _mbV2), A = L.aim;
      const ax = M.x - Th.x, ay = M.y - Th.y, az = M.z - Th.z;
      const cur = Math.atan2(ay, Math.hypot(ax, az)), want = Math.atan2(A[1] - M.y, Math.hypot(A[0] - M.x, A[2] - M.z));
      B.mv.set({ headPitch: clamp(B.mv.state.params.headPitch + (want - cur), -1.3, 0.9) });
    }
    // de l'eau qui ruisselle de la tête et du cou pendant qu'elle monte
    if (L.t < C.dur * 0.75) { L.dripT = (L.dripT || 0) - dt; if (L.dripT <= 0) { L.dripT = 0.035; maLeapDrip(); } }
  } else {
    // après l'impact : emportée par l'élan, elle retombe et s'enfonce
    B.mv.set({ headPitch: null });
    B.pitch = damp(B.pitch, -0.3, 3, dt);
    const [fx, fz] = maFwd(B.yaw), k = 1 - owSmoothstep(0, 0.9, L.t - C.dur);
    B.x += fx * 4 * k * dt; B.z += fz * 4 * k * dt;
    B.y = damp(B.y, MA_CFG.depth.stalk, 2.6, dt);
    if (!L.down && L.t > C.dur + 0.3) { L.down = true; const Ch = maBeastAnchor('chest', _mbV2); maLeapSpray(Ch, 0.8); }
    if (L.t > C.dur + 1.15) { if (!L.hit) maLeapImpact(); maLeapEnd(); }
  }
  // le regard est attiré vers elle (une fraction de seconde), si elle surgit hors du champ
  if (L.look > 0) { L.look -= dt; maLookAt(maBeastAnchor('head', _mbV2), dt); }
}
/* Centre de la gueule : entre la lèvre (ancre « mouth ») et le bout de la mâchoire (« bite »). */
function maMaw(out) { maBeastAnchor('mouth', out); MAB.mv.anchors.bite.getWorldPosition(_mbV4); return out.add(_mbV4).multiplyScalar(0.5); }
/* La tête du joueur : l'œil (la caméra) à la première personne ; sinon, au-dessus de lui (vue à la
   troisième personne, vue de poursuite de la barque : la bête vise le joueur, pas la caméra). */
function maPlayerHead(out) {
  const p = player, V = VEH.drive, fps = V ? VEH.view === 1 : PERSO.vue !== 'tps';
  if (fps && !viewCamera) return out.copy(camera.position);
  return out.set(p.pos.x, V ? MA.water + 1.0 : MA_SWIM.on ? MA.water + 0.2 : p.gy + 1.6, p.pos.z);
}
/* Bézier cubique (P : 4 points [x, y, z]) en u. */
function maBez3(P, u, out) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return out.set(a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1], a * P[0][2] + b * P[1][2] + c * P[2][2] + d * P[3][2]);
}
/* L'eau qui jaillit avec elle : une couronne de gros paquets d'eau et de gouttes, une gerbe basse, de la
   bruine (k : 0 à 1). */
function maLeapSpray(P, k) {
  maFxInit();
  const y = MA.water + 0.05;
  for (let i = 0, n = Math.round(130 * k); i < n; i++) {
    const a = Math.random() * TAU, r = rand(0.5, 2.6), up = rand(2.5, 8) * k, out = rand(0.6, 3.4);
    MA.spray.emit(P.x + Math.cos(a) * r, y + rand(0, 0.8), P.z + Math.sin(a) * r, Math.cos(a) * out, up, Math.sin(a) * out, rand(0.8, 1.6));
  }
  for (let i = 0, n = Math.round(160 * k); i < n; i++) {
    const a = Math.random() * TAU, r = rand(0.3, 2.8), up = rand(3, 9.5) * k, out = rand(0.5, 4);
    MA.drops.emit(P.x + Math.cos(a) * r, y + rand(0, 1), P.z + Math.sin(a) * r, Math.cos(a) * out, up, Math.sin(a) * out, rand(0.7, 1.6));
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + rand(-0.4, 0.4), r = rand(0.8, 1.8);
    spawnPuff(P.x + Math.cos(a) * r, y + 1.1, P.z + Math.sin(a) * r, rand(2.4, 3.4) * k, 0.55, 0xc8d4cc, 0.3 * k, 1.4, false, MA.splashTex);
  }
  spawnPuff(P.x, y + 1.2, P.z, 5.5 * k, 1.3, 0x8c9a92, 0.2 * k, 0.5, false, TEX.smoke);
  maRipple(P.x, P.z, 0.45 * k); maRipple(P.x + rand(-1, 1), P.z + rand(-1, 1), 0.3 * k);
  maBubbles(P.x, P.z, 12, 2.2);
  maBeastSay('eclaboussure', P.x, MA.water, P.z, { vol: 1.5 * k, ref: 18 });
}
/* L'eau qui ruisselle de la tête, du cou et des pattes pendant le bond. */
function maLeapDrip() {
  for (const a of ['mouth', 'head', 'chest', 'clawL', 'clawR']) {
    const P = maBeastAnchor(a, _mbV2);
    if (P.y < MA.water + 0.2) continue;
    for (let i = 0; i < 3; i++) MA.spray.emit(P.x + rand(-1, 1), P.y + rand(-0.5, 0.1), P.z + rand(-1, 1), rand(-0.6, 0.6), rand(-1.2, 0.8), rand(-0.6, 0.6), rand(0.5, 1.0));
    for (let i = 0; i < 3; i++) MA.drops.emit(P.x + rand(-1.1, 1.1), P.y + rand(-0.5, 0.2), P.z + rand(-1.1, 1.1), rand(-0.5, 0.5), rand(-1.5, 0.6), rand(-0.5, 0.5), rand(0.5, 1.0));
  }
}
/* Tourner la vue vers un point (boat : regard de la vue embarquée ; à pied, à la nage : le joueur). */
function maLookAt(P, dt) {
  const cam = camera.position, want = Math.atan2(-(P.x - cam.x), -(P.z - cam.z)), pitch = clamp(Math.atan2(P.y - cam.y, Math.hypot(P.x - cam.x, P.z - cam.z)), -0.5, 0.6), k = 1 - Math.exp(-14 * dt);
  const V = VEH.drive;
  if (V) {
    const err = wrapAngle(want - (V.yaw + VEH.lookYaw));
    if (Math.abs(err) > 0.5) VEH.lookYaw += err * k;
    VEH.lookPitch += (pitch - VEH.lookPitch) * k;
  } else {
    const err = wrapAngle(want - player.yaw);
    if (Math.abs(err) > 0.5) player.yaw += err * k;
    player.pitch += (pitch - player.pitch) * k;
  }
}
function maLeapImpact() {
  const B = MAB, C = MA_CFG.leap, L = B.leap, p = player;
  if (!L || L.hit) return;
  L.hit = true;
  const H = maMaw(_mbV), T = L.tgt, fps = VEH.drive ? VEH.view === 1 : PERSO.vue !== 'tps';
  maSplash(H.x, H.z, 2.2);
  // kit 2.0.7 : les Noyés à portée de la gueule sont engloutis (la proie, ou ceux qui sont près de la barque)
  const eaten = maNoyesEngulf(H, MA_CFG.feast.by, T && T.kind === 'noye' ? T.noye : null);
  if (T && T.kind === 'noye') {
    maSecousse(0.6 * maNearK(H));
    MAM.attn = Math.max(MAM.attn, 25);
    if (eaten) { maBeastSay('saisie', H.x, H.y, H.z, { vol: 1.5, ref: 14 }); B.cool = MA_CFG.feast.cool; maEmit('attaque', { kind: 'noye', n: eaten }); }
    else { maBeastSay('retombe', H.x, MA.water, H.z, { vol: 1.5, ref: 20 }); B.cool = MA_CFG.feast.cool; maEmit('attaque', { kind: 'rate', cible: 'noye' }); }
    maBeastPreyDrop();
    return;
  }
  maSecousse(1);
  if (T && T.kind === 'barque' && T.boat && !T.boat.wrecked && Math.hypot(T.boat.x - H.x, T.boat.z - H.z) < T.boat.T.len / 2 + C.hit) {
    const V = T.boat, wasDriven = V === VEH.drive;
    maBeastSay('saisie', H.x, H.y, H.z, { vol: 1.7, ref: 10 });   // la mâchoire qui se referme : le craquement
    maBoatWreck(V, H);
    if (wasDriven) {
      // la gueule s'est refermée sur la vue : noir, puis on est dans l'eau, au milieu des débris
      if (fps) maBlackout(0.16, 0.55);
      // le naufragé : le temps d'atteindre le haut-fond le plus proche à la nage, puis elle revient
      const G0 = MA_CFG.grace, S = {}, dist = maShoreDist(p.pos.x, p.pos.z, S);
      B.cool = clamp((dist / G0.speed) * G0.k + G0.plus, G0.min, G0.max);
      B.grace = { t0: G.time, dur: B.cool, dist: Math.round(dist) };
      MAM.attn = 100;
      // de quel côté (par rapport au regard) et à quelle distance
      let where = '';
      if (S.x !== undefined) {
        const dx = S.x - p.pos.x, dz = S.z - p.pos.z, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), m = Math.max(5, Math.round(dist / 5) * 5);
        where = ` : ${Math.abs(a) < 0.6 ? 'droit devant' : Math.abs(a) > 2.4 ? 'derrière vous' : a > 0 ? 'à droite' : 'à gauche'}, ${m} m`;
      }
      HUD.hint(`La barque est détruite ! Nagez jusqu’à la rive${where} (Maj : plus vite)`, 6);
    }
    return;
  }
  if (T && (T.kind === 'nageur' || T.dock) && !p.down && Math.hypot(p.pos.x - H.x, p.pos.z - H.z) < C.hit + 0.6 && (MA_SWIM.on || T.dock)) { if (fps) maBlackout(0.08, 0.3); B.leap = null; B.mv.set({ headPitch: null }); maDevourStart(); return; }
  // raté : elle s'écrase dans l'eau à côté ; la vague secoue la barque
  maBeastSay('retombe', H.x, MA.water, H.z, { vol: 1.7, ref: 20 });
  const V = VEH.drive;
  if (V && V.T.boat) { const d = Math.hypot(V.x - H.x, V.z - H.z), k = 1 - owSmoothstep(3, 14, d); V.hv += 2.6 * k; V.rv += (Math.random() < 0.5 ? -1 : 1) * 3.2 * k; maBoatDamage(V, 8 * k, 'bete'); }
  MAM.attn = Math.min(MAM.attn, 72);
  B.cool = Math.max(B.cool, 6);
  maEmit('attaque', { kind: 'rate' });
}
function maLeapEnd() {
  const B = MAB;
  B.leap = null; B.mv.set({ headPitch: null });
  if (MA_SWIM.on && B.cool > 0) maBeastSetState('chasse');
  else if (maPlayerOnWater()) maBeastSetState('traque');
  else if (!maBeastFeast(true)) maBeastSetState('plonge');                // kit 2.0.7 : le Noyé suivant
}
/* Kit 2.0.7 : chasser les Noyés (le joueur hors de l'eau, la bête éveillée, hors combat de boss). Proie : un
   Noyé vivant à la surface (il regarde le joueur depuis l'eau), à moins de feast.range m, de préférence le
   plus proche d'elle ; force : sans attendre le repos (le suivant, après une prise). */
function maBeastFeast(force = false, skip = null) {
  const B = MAB;
  if (MA_BOSS.on || B.state === 'dormant' || B.state === 'devore' || (!force && (B.state === 'ruee' || B.cool > 0.5))) return false;
  if (maPlayerOnWater() || G.state !== 'playing') return false;
  let best = null, bd = MA_CFG.feast.range;
  for (const z of Zombies.list) {
    if (!z.noye || !z.alive || z.removed || z === skip || (z.ns !== 'stare' && z.ns !== 'stalk')) continue;
    if (z.ey < z.wl - 0.25) continue;
    const d = Math.hypot(z.hx - B.x, z.hz - B.z);
    if (d >= bd || maDepthAround(z.hx, z.hz, 6) < MA_CFG.attackDepth) continue;
    bd = d; best = z;
  }
  if (!best) return false;
  B.prey = best; best.prey = true;
  maBeastSetState('festin');
  return true;
}
function maBeastPreyDrop() { if (MAB.prey) MAB.prey.prey = false; MAB.prey = null; }
/* Noir plein écran (la mâchoire se referme sur la vue) : hold s, puis il s'efface en fade s. Il couvre
   le réticule, pas les textes du HUD (l'indication « nagez jusqu'à la rive » reste lisible). */
function maBlackout(hold, fade) {
  let el = MA.black;
  if (!el) {
    el = MA.black = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none';
    const f = document.getElementById('zone-name');           // au-dessus du réticule, sous les textes
    if (f && f.parentNode) f.parentNode.insertBefore(el, f); else { el.style.position = 'fixed'; document.body.append(el); }
  }
  MA.blackT = hold; MA.blackF = Math.max(0.05, fade); MA.blackK = 1; el.style.opacity = '1';
}
function maBlackoutUpdate(dt) {
  if (!MA.black || !(MA.blackK > 0)) return;
  if (MA.blackT > 0) MA.blackT -= dt; else MA.blackK = Math.max(0, MA.blackK - dt / MA.blackF);
  MA.black.style.opacity = MA.blackK.toFixed(3);
}
function maBlackoutClear() { if (MA.black) { MA.blackK = 0; MA.black.style.opacity = '0'; } }
/* Distance à la nage (m) jusqu'au haut-fond le plus proche (moins de 0,85 m d'eau) : grille de navigation ;
   out (facultatif) reçoit l'endroit (x, z). */
function maShoreDist(x, z, out) {
  const N = MA_NAV;
  if (!N.dep) return 60;
  const nx = N.nx, nz = N.nz, s = maNavCell(x, z), gen = ++N.gen, Gc = N.g, ST = N.stamp, CL = N.closed;
  N.hn = 0; ST[s] = gen; Gc[s] = 0; maNavPush(0, s);
  while (N.hn > 0) {
    const k = maNavPop();
    if (CL[k] === gen) continue;
    CL[k] = gen;
    if (N.dep[k] < 0.85) { if (out) { out.x = maNavX(k); out.z = maNavZ(k); } return Gc[k] * N.C; }
    if (Gc[k] * N.C > 400) break;
    const i = k % nx, j = (k - i) / nx;
    for (let d = 0; d < 8; d++) {
      const a = i + MA_NAV_D[d][0], b = j + MA_NAV_D[d][1];
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const m = b * nx + a, ng = Gc[k] + (d >= 4 ? Math.SQRT2 : 1);
      if (CL[m] !== gen && (ST[m] !== gen || ng < Gc[m])) { ST[m] = gen; Gc[m] = ng; maNavPush(ng, m); }
    }
  }
  return 400;
}
/* En garde : face à la cible, la racine à la distance où la détente porte la gueule sur elle (elle
   avance de 2,3 à 2,7 m avant que la mâchoire ne se referme). Elle se décale au besoin (vitesse speed). */
function maBeastPoise(dt, tgt, speed) {
  const B = MAB, C = MA_CFG.attack, want = Math.atan2(tgt.x - B.x, tgt.z - B.z);
  B.yaw = wrapAngle(B.yaw + clamp(wrapAngle(want - B.yaw), -1.4 * dt, 1.4 * dt));
  const [fx, fz] = maFwd(B.yaw), D = MAB.biteL.z * MA_CFG.scale + (tgt.kind === 'barque' ? C.lungeBoat : C.lunge);
  const dx = tgt.x - fx * D - B.x, dz = tgt.z - fz * D - B.z, d = Math.hypot(dx, dz);
  const step = Math.min(d, speed * dt);
  if (d > 1e-3) { B.x += (dx / d) * step; B.z += (dz / d) * step; }
  B.v = damp(B.v, Math.min(speed, d * 2), 3, dt);
}
/* Affaiblie (combat de boss, sous le tiers de sa vie) : nage lourde, tête basse. */
const maBeastWeak = () => MA_BOSS.on && !MA_BOSS.dead && MA_BOSS.hp < MA_BOSS.maxHp * 0.33;
/* Distance de la tête (la morsure) à un point. */
function maHeadDist(x, z) { const H = maBeastAnchor('bite', _mbV2); return Math.hypot(H.x - x, H.z - z); }
/* Un point d'eau assez profonde pour elle entre rmin et rmax de (x, z). */
function maDeepNear(x, z, rmin, rmax, minD = MA_CFG.minDepth) {
  let best = null, bd = -1;
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * TAU, r = rand(rmin, rmax), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (!maInLake(px, pz)) continue;
    const d = maDepth(px, pz);
    if (d >= minD) return [px, pz];
    if (d > bd) { bd = d; best = [px, pz]; }
  }
  return bd > 2 ? best : null;
}
/* Cible d'une attaque : la barque du joueur, le joueur à la nage, ou au bout d'un ponton (au bord de
   l'eau profonde). Plus tard (coop) : le plus proche des joueurs. */
function maAttackTarget(lead = 0) {
  const p = player, V = VEH.drive;
  if (V && V.T.boat) {
    // barque lancée : elle vise où la barque sera au moment de la morsure (on l'évite en virant)
    if (lead > 0 && Math.abs(V.v) > 0.8) { const [fx, fz] = vehFwd(V.yaw), L = V.v * Math.min(lead, 3.4); return { kind: 'barque', x: V.x + fx * L, z: V.z + fz * L, boat: V }; }
    return { kind: 'barque', x: V.x, z: V.z, boat: V };
  }
  if (MA_SWIM.on) return { kind: 'nageur', x: p.pos.x, z: p.pos.z };
  if (MAM.attn >= 95 && maDepthAround(p.pos.x, p.pos.z, 3) > MA_CFG.attackDepth && Math.abs(p.gy - MA.water) < 1.6) return { kind: 'ponton', x: p.pos.x, z: p.pos.z, dock: true };
  return null;
}
function maBeastAfterAttack() {
  if (MAB.hit && MAB.hit.boat) MAB.hit.boat.grab = 0;
  MAB.cool = MA_BOSS.on ? MA_CFG.boss.phases[MA_BOSS.phase].cooldown : MA_CFG.attack.cooldown;
  MAM.attn = Math.min(MAM.attn, MA_CFG.attn.after);
  maBeastSetState('plonge');
}
/* Sillage en V et rides au-dessus d'elle quand elle nage près de la surface. */
function maBeastWakeFx(dt) {
  const B = MAB;
  if (B.y < -3.2 || B.v < 1.5) return;
  B.wakeT = (B.wakeT || 0) - dt * B.v;
  if (B.wakeT > 0) return;
  B.wakeT = 2.2;
  const H = maBeastAnchor('head', _mbV);
  const [fx, fz] = maFwd(B.yaw);
  const k = clamp((B.y + 3.2) / 2, 0.2, 1);
  maRipple(H.x, H.z, 0.05 * k);
  maRipple(H.x - fx * 5 - fz * 2.5, H.z - fz * 5 + fx * 2.5, 0.035 * k);
  maRipple(H.x - fx * 5 + fz * 2.5, H.z - fz * 5 - fx * 2.5, 0.035 * k);
  if (Math.random() < 0.3) maBubbles(H.x, H.z, 3, 1.2);
}
/* Éclats de bois : le plat-bord et le bordé cèdent sous les dents (vers le haut et à l'opposé de la gueule). */
function maBoatSplinters(V, n, H) {
  const mat = V.barque && V.barque.materials ? V.barque.materials.wood : MAT.gib;
  for (let i = 0; i < n; i++) {
    const dx = V.x - H.x, dz = V.z - H.z, dl = Math.hypot(dx, dz) || 1;
    spawnDebris(mat, rand(0.03, 0.06), rand(0.02, 0.04), rand(0.18, 0.5), V.x + rand(-0.8, 0.8), MA.water + 0.6 + rand(0, 0.4), V.z + rand(-0.8, 0.8),
      (dx / dl) * rand(1, 4) + rand(-1.5, 1.5), rand(2.5, 6), (dz / dl) * rand(1, 4) + rand(-1.5, 1.5), rand(1.6, 2.6));
  }
}
/* La bête passe sous la barque : coup de dos, la coque cogne, tout vibre. */
function maBoatBump(V, k) {
  V.hv += 1.6 * k; V.rv += (Math.random() < 0.5 ? -1 : 1) * 1.8 * k; V.pv += 0.6 * k;
  V.v *= 0.75;
  maBoatDamage(V, MA_CFG.attack.bump * k, 'bete');
  maSecousse(0.45 * k);
  maBeastSay('coque', V.x, MA.water - 1, V.z, { vol: 1.5, ref: 8 });
  if (V.bsnd) V.bsnd.clunk(1.2);
  maSplash(V.x + rand(-1.5, 1.5), V.z + rand(-1.5, 1.5), 0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => maBubbles(V.x + rand(-3, 3), V.z + rand(-3, 3), 5, 1), 300 + i * 300);
  maEmit('attaque', { kind: 'bosse', boat: V.id });
}

/* -------------------------------------------- Événements des animations -- */
function maBeastEvent(name) {
  const B = MAB, C = MA_CFG;
  if (!B.obj) return;
  const H = maBeastAnchor('bite', _mbV);
  switch (name) {
    case 'eclaboussure': case 'retombe': maSplash(H.x, H.z, name === 'retombe' ? 3 : 2.4); maBeastSay(name, H.x, MA.water, H.z, { vol: 1.4, ref: 18 }); maSecousse(0.3 * maNearK(H)); break;
    case 'jaillit': B.roarT = 1.5; maBeastSay('ruee', H.x, Math.max(H.y, MA.water), H.z, { vol: 1.5, ref: 30 }); break;   // la ruée : le choc
    case 'cri': if (B.roarT <= 0) { B.roarT = 1.5; maBeastSay('cri', H.x, H.y, H.z, { vol: 1.6, ref: 26 }); maSecousse(0.25 * maNearK(H)); } break;
    case 'grondement': maBeastSay('grondement', H.x, H.y, H.z, { vol: 1.4, ref: 16 }); break;
    case 'douleur': if (B.painT <= 0) { B.painT = 0.6; maBeastSay('douleur', H.x, H.y, H.z, { vol: 1.4, ref: 20 }); } break;
    case 'impact': if (B.state === 'ruee') maLeapImpact(); else maBeastStrike('impact'); break;
    case 'arrache': maBeastStrike('arrache'); break;
    case 'morsure': maBeastStrike('morsure'); break;
    case 'saisie': case 'secousse': case 'avale': case 'plonge': maDevourEvent(name); break;
    case 'fin': maEmit('boss', { what: 'mort' }); break;
    default: break;
  }
}
const maNearK = (P) => 1 - owSmoothstep(8, 40, Math.hypot(P.x - camera.position.x, P.z - camera.position.z));
/* Le coup porte-t-il ? Distance de la gueule à la barque, au joueur (au moment de l'animation). */
function maBeastStrike(kind) {
  const B = MAB, C = MA_CFG.attack, H = maBeastAnchor('bite', _mbV), p = player, V = VEH.drive;
  const reach = C.reach;
  if (kind === 'impact' || kind === 'arrache') {
    const boat = (B.tgt && B.tgt.boat) || null;
    if (kind === 'impact') {
      maSplash(H.x, H.z, 2.6);
      maBeastSay('impact', H.x, MA.water, H.z, { vol: 1.5, ref: 14 });
      if (boat && !boat.capsized && H.y > MA.water - 2.2 && Math.hypot(boat.x - H.x, boat.z - H.z) < reach + boat.T.len / 2 - 0.6) {
        B.hit = { boat };
        maBoatDamage(boat, rand(C.boat[0], C.boat[1]), 'bete');
        maBoatSplinters(boat, 12, H);
        boat.hv += 3.2; boat.rv += (Math.random() < 0.5 ? -1 : 1) * 3.4; boat.pv -= 1.2; boat.v *= 0.2;
        if (boat === VEH.drive) { playerDamage(18); maSecousse(1); maEblouir(); }   // confort (ma00) : voile blanc atténué
        if (boat.bsnd) boat.bsnd.clunk(1.8);
        maEmit('attaque', { kind: 'barque', boat: boat.id, hull: boat.hull });
      } else maEmit('attaque', { kind: 'rate' });
    } else if (B.hit && B.hit.boat && !B.hit.boat.capsized && H.y > MA.water - 2.5 && Math.hypot(B.hit.boat.x - H.x, B.hit.boat.z - H.z) < reach + 2.5) {
      const bt = B.hit.boat;
      maBeastSay('arrache', H.x, MA.water, H.z, { vol: 1.4, ref: 12 });
      maBoatDamage(bt, rand(C.boatGrab[0], C.boatGrab[1]), 'bete');
      maBoatSplinters(bt, 8, H);
      bt.rv += 2.2; bt.hv -= 1.5;
      if (bt === VEH.drive) { maSecousse(1); playerDamage(8); }
    }
    return;
  }
  // morsure : nageur (saisi, dévoré), joueur en barque ou au bout d'un ponton (blessé)
  maSplash(H.x, H.z, 1.6);
  maBeastSay('morsure', H.x, H.y, H.z, { vol: 1.6, ref: 12 });
  const d = Math.hypot(p.pos.x - H.x, p.pos.z - H.z), dy = Math.abs(MA.water + 0.5 - H.y);
  if (d < 2.8 && dy < 2.2) {
    if (MA_SWIM.on && !p.down) { maDevourStart(); return; }
    if (V && V.T.boat) { playerDamage(C.bite); maBoatDamage(V, 12, 'bete'); }
    else { playerDamage(C.dockBite); const k = 4 / (d || 1); p.vel.x += (p.pos.x - H.x) * k; p.vel.z += (p.pos.z - H.z) * k; }
    maSecousse(1); HUD.hurt && HUD.hurt();
    bloodBurst(p.pos.x, p.gy + 1, p.pos.z, p.pos.x - H.x, p.pos.z - H.z, 10, 1.2);
    maEmit('attaque', { kind: 'morsure' });
  } else maEmit('attaque', { kind: 'rate' });
}

/* --------------------------------------------------------- Blessures --
   Les balles s'arrêtent dans l'eau (un mètre au plus) : il faut qu'elle sorte la tête. Points
   faibles (le modèle les donne) : yeux ×3, gueule ouverte ×2,2, branchies ×1,6, leurres ×1,5. */
function maRayMonster(ox, oy, oz, dx, dy, dz, maxT) {
  if (!MAB.on || !MAB.obj || !MAB.obj.visible || MAB.state === 'dormant' || MAB.state === 'devore') return null;
  const h = MAB.mv.hitTest(ox, oy, oz, dx, dy, dz, maxT);
  if (!h) return null;
  return { t: h.t, part: h.part, mult: h.mult, x: h.x, y: h.y, z: h.z, under: h.y < MA.water - 0.15 };
}
/* Où une balle touche l'eau (t), ou Infinity. */
function maRayWater(oy, dy) { return dy < -1e-4 && oy > MA.water ? (oy - MA.water) / -dy : Infinity; }
function maBeastDamage(amount, part, info = {}) {
  const B = MAB, C = MA_CFG;
  if (!B.on || B.state === 'dormant' || B.state === 'mort' || B.state === 'devore') return false;
  const weak = C.boss.weak[part] || 1, armor = MA_BOSS.on ? C.boss.phases[MA_BOSS.phase].armor : 1;
  const d = Math.min(amount, 5000) * weak * armor * (info.under ? 0.5 : 1);
  B.mv.flash(clamp(d / 600, 0.3, 1));
  B.hurtT = 0.2;
  addPoints(RULES.pointsHit);
  MAM.attn = clamp(MAM.attn + 2.5, 0, 100);
  if (B.painT <= 0 && (part === 'oeil' || part === 'gueule' || d > 400)) maBeastEvent('douleur');
  maEmit('blessure', { amount: d, part });
  if (MA_BOSS.on) {
    MA_BOSS.hp = Math.max(0, MA_BOSS.hp - d);
    const frac = MA_BOSS.hp / MA_BOSS.maxHp, P = C.boss.phases;
    let ph = 0; for (let i = 0; i < P.length; i++) if (frac <= P[i].at) ph = i;
    if (ph !== MA_BOSS.phase) {
      MA_BOSS.phase = ph;
      HUD.banner(P[ph].name, 'La Mère-Vase', 'warn');
      maBeastEvent('cri');
      if (B.state !== 'attaque' && B.state !== 'mord' && B.state !== 'devore' && maDepth(B.x, B.z) > 4) maBeastSetState('surgit');
      maEmit('boss', { what: 'phase', phase: ph });
    }
    if (MA_BOSS.hp <= 0 && !MA_BOSS.dead) { maBeastDie(); return true; }
    if (frac < 0.15 && B.state !== 'blesse') B.mv.set({ limp: 0.6 });
  } else {
    B.fear += d; B.fearT = 30;
    if (B.fear > C.fleeAt) { HUD.hint('La bête plonge et s’éloigne', 2); MAM.attn = C.attn.flee; maBeastSetState('fuite'); B.fear = 0; return false; }
  }
  if (d > 900 && B.state !== 'attaque' && B.state !== 'mord') maBeastSetState('blesse');
  return false;
}
function maBeastDie() {
  MA_BOSS.dead = true;
  maBeastSetState('mort');
  addPoints(5000);
  G.stats.kills++;
  HUD.banner('La Mère-Vase', 'Elle remonte, le ventre en l’air', 'power');
  maEmit('boss', { what: 'vaincue' });
  setTimeout(() => maBossBar(false), 4000);
}
/* Explosions (grenades, roquettes) : elle les entend de loin ; la plus proche de ses parties (tête,
   poitrine, queue) encaisse. Sous l'eau, l'onde porte plus loin. */
function maExplode(x, y, z, radius, damage) {
  maNoise(x, z, 'blast');
  if (!MAB.on || !MAB.obj || !MAB.obj.visible || MAB.state === 'dormant') return;
  const wet = y < MA.water - 0.15, R = radius * (wet ? 1.4 : 1) + 2;
  let d = Infinity;
  for (const [a, r] of [['head', 0.9], ['chest', 1.5], ['tail', 0.7]]) { const P = maBeastAnchor(a, _mbV); d = Math.min(d, Math.hypot(P.x - x, P.y - y, P.z - z) - r); }
  if (d > R) return;
  const f = 1 - clamp(d / R, 0, 1);
  maBeastDamage(damage * (0.3 + 0.7 * f), 'corps', { kind: 'explosive' });
}

/* ------------------------------------------------------ Combat de boss --
   MA_BOSS.start({ hp }) : la bête devient mortelle, sa barre de vie s'affiche, elle vient (traque).
   Phases (MA_CFG.boss.phases) : seuils de vie, agressivité (vitesse à laquelle elle vous entend),
   délai entre deux attaques, attaques permises, blindage. Événements : maOn('boss', fn). */
Object.assign(MA_BOSS, {
  start(o = {}) {
    if (!MAB.on) return false;
    MA_BOSS.on = true; MA_BOSS.dead = false; MA_BOSS.phase = 0;
    MA_BOSS.maxHp = o.maxHp || MA_CFG.boss.hp; MA_BOSS.hp = Math.min(MA_BOSS.maxHp, o.hp || MA_BOSS.maxHp);
    MAM.attn = Math.max(MAM.attn, 62);
    if (MAB.state === 'dormant') { MAB.x = MA.fosse.x; MAB.z = MA.fosse.z; MAB.y = MA_CFG.depth.dive; }
    maBeastSetState('traque');
    maBossBar(true);
    maEmit('boss', { what: 'debut' });
    return true;
  },
  stop() { MA_BOSS.on = false; maBossBar(false); maEmit('boss', { what: 'fin' }); },
});
function maBossBar(show) {
  show = show && MA_BOSS.on && G.state === 'playing';
  if (!MA_BOSS.bar) {
    if (!show) return;
    const b = el('div', 'kh-boss');
    Object.assign(b.style, { position: 'absolute', left: '50%', top: 'calc(64px + env(safe-area-inset-top, 0px))', transform: 'translateX(-50%)', width: 'min(560px, 70vw)', textAlign: 'center', pointerEvents: 'none', textShadow: '0 2px 0 rgba(0,0,0,0.6)' });
    b.innerHTML = '<div style="font-weight:700;font-size:15px;letter-spacing:0.18em;text-transform:uppercase;color:#f5e6cf">La Mère-Vase</div>'
      + '<div style="position:relative;height:10px;margin-top:5px;background:rgba(0,0,0,0.6);box-shadow:0 0 0 1px rgba(150,230,190,0.55)"><i style="position:absolute;left:0;top:0;bottom:0;background:#8fe0b4"></i>'
      + '<b style="position:absolute;left:66%;top:-2px;bottom:-2px;width:2px;background:rgba(245,230,207,0.7)"></b><b style="position:absolute;left:33%;top:-2px;bottom:-2px;width:2px;background:rgba(245,230,207,0.7)"></b></div>'
      + '<div class="ma-boss-sub" style="margin-top:4px;font-size:13px;letter-spacing:0.1em;color:#8fe0b4"></div>';
    $('hud').append(b);
    MA_BOSS.bar = { el: b, fill: b.querySelector('i'), sub: b.querySelector('.ma-boss-sub'), last: '' };
  }
  const B = MA_BOSS.bar;
  B.el.hidden = !show;
  if (!show) return;
  B.fill.style.width = `${clamp(MA_BOSS.hp / Math.max(1, MA_BOSS.maxHp), 0, 1) * 100}%`;
  const sub = MA_BOSS.dead ? 'Vaincue' : MA_CFG.boss.phases[MA_BOSS.phase].name;
  if (sub !== B.last) { B.sub.textContent = sub; B.last = sub; }
}

/* ----------------------------------------------------- La dévoration --
   Un nageur saisi : scène de 3,6 s, synchronisée sur l'animation « devoration » (événements
   saisie, secousse, avale, plonge). Le corps de la victime (le modèle d'Anthony, une seconde
   instance) est tenu dans la gueule (ancre « bite ») et se débat ; caméra de cinéma à côté de la
   tête ; puis le noir et la fin de partie. Hors scène, l'instance attend cachée. */
function maVictimPrepare() {
  if (MAB.victim || !PERSO.on || typeof createSurvivor !== 'function') return;
  try {
    const av = persoCreerAvatar('haute', false);
    av.hero.object.visible = false;
    av.cut.value = 0;
    MAB.victim = av;
  } catch (e) { console.warn('marais : victime', e); MAB.victim = null; }
}
function maDevourStart() {
  const B = MAB, p = player;
  maEmit('devoration', { what: 'debut' });
  B.devour = { t: 0, phase: 'approche', px: p.pos.x, pz: p.pos.z, held: false, swallowed: false, end: false };
  // la bête face au nageur, la gueule à 1,5 m de lui
  B.yaw = Math.atan2(p.pos.x - B.x, p.pos.z - B.z);
  const [rx, rz] = maRootFor(p.pos.x, p.pos.z, B.yaw), [fx, fz] = maFwd(B.yaw);
  B.x = rx - fx * 1.2; B.z = rz - fz * 1.2; B.y = MA_CFG.depth.surface; B.v = 0;
  maBeastSetState('devore');
  // le joueur ne contrôle plus rien
  KHP.busy = 99; p.grabT = 99; p.vel.set(0, 0, 0);
  Arms.root.visible = false;
  HUD.el.hud.hidden = true;
  maSecousse(1);
  maCineStart();
}
function maCineStart() {
  if (!MAB.cine) MAB.cine = new THREE.PerspectiveCamera(56, camera.aspect, 0.08, 2600);
  const C = MAB.cine;
  C.aspect = camera.aspect; C.updateProjectionMatrix();
  C.position.copy(camera.position); C.quaternion.copy(camera.quaternion);
  viewCamera = C;
}
function maCineEnd(force) {
  if (viewCamera && viewCamera === MAB.cine) {
    if (!force) { camera.position.copy(MAB.cine.position); camera.quaternion.copy(MAB.cine.quaternion); }
    viewCamera = null;
  }
  if (MAB.victim) MAB.victim.hero.object.visible = false;
  if (KHP.busy >= 90) KHP.busy = 0;
  if (player.grabT >= 90) player.grabT = 0;
  if (MAB.devour) MAB.devour = null;
}
function maDevourUpdate(dt) {
  const B = MAB, D = B.devour, p = player;
  if (!D) { maBeastSetState('plonge'); return; }
  D.t += dt;
  // la bête avance sur sa proie pendant la détente, puis tient sa position (la scène bouge avec elle)
  if (D.t < 0.32) { const [fx, fz] = maFwd(B.yaw); B.x += fx * 4 * dt; B.z += fz * 4 * dt; }
  else if (D.t > 3.0) { const [fx, fz] = maFwd(B.yaw); B.v = damp(B.v, 4, 1, dt); B.x += fx * B.v * dt; B.z += fz * B.v * dt; B.ty = -4; }
  B.ty = D.t > 3.0 ? -4 : MA_CFG.depth.surface;
  const bite = maBeastAnchor('bite', _mbV), head = maBeastAnchor('head', _mbV2);
  const cam = B.cine, [fx, fz] = maFwd(B.yaw), rx = fz, rz = -fx;
  // caméra de côté, au ras de l'eau, qui se rapproche et monte (la morsure, elle, s'est vue à la première personne)
  {
    const k = owSmoothstep(0, 2.6, D.t), side = lerp(10.5, 6.4, k), back = lerp(2.0, -0.8, k), up = lerp(1.2, 2.4, k);
    cam.position.set(bite.x + rx * side - fx * back, Math.max(MA.water + 0.5, bite.y + up), bite.z + rz * side - fz * back);
    cam.lookAt(lerp(bite.x, head.x, 0.3), bite.y + 0.3, lerp(bite.z, head.z, 0.3));
  }
  if (FX.shake > 0.01 && maSecoue()) { const sh = FX.shake * FX.shake; cam.rotation.x += rand(-1, 1) * sh * 0.03; cam.rotation.y += rand(-1, 1) * sh * 0.03; }   // confort (ma00)
  // la victime : saisie par les jambes au bout du museau, la tête en bas, elle pend devant la gueule et se
  // débat ; secouée avec la tête, puis avalée (elle glisse vers le gosier et disparaît)
  const V = B.victim;
  if (V && D.held && !D.swallowed) {
    const o = V.hero.object, th = maBeastAnchor('throat', _mbV2), mo = maBeastAnchor('mouth', _mbV3);
    const dx = mo.x - bite.x, dy = mo.y - bite.y, dz = mo.z - bite.z, dl = Math.hypot(dx, dy, dz) || 1;
    const hx = mo.x + (dx / dl) * 0.95, hy = mo.y + (dy / dl) * 0.95 - 0.15, hz = mo.z + (dz / dl) * 0.95;      // juste devant le bout du museau
    const s = owSmoothstep(2.35, 2.62, D.t), hip = 0.95 * o.scale.y;
    const shake = D.t > 0.8 && D.t < 2.1 ? 1 : 0.35, sw = Math.sin(D.t * 13) * 0.3 * shake;
    o.rotation.set(Math.PI + 0.15 + sw * 0.5, Math.atan2(rx, rz) + MA_CFG.victimYaw + sw * 0.6, Math.sin(D.t * 9) * 0.25 * shake, 'YXZ');
    _mbQ.setFromEuler(o.rotation);
    const up = _mbV4.set(0, hip, 0).applyQuaternion(_mbQ);            // des pieds aux hanches, dans le monde
    const px = lerp(hx, th.x, s), py = lerp(hy, th.y, s), pz = lerp(hz, th.z, s);
    o.position.set(px - up.x, py - up.y, pz - up.z);
    maVictimFlail(V, D.t);
    o.visible = s < 0.97;
  }
  // fin : le noir, puis la fin de partie
  if (D.t > 3.25 && !D.end) { D.end = true; khFade(true, 0.6); }
  if (D.t > 4.1 && D.end !== 'done') {
    D.end = 'done';
    maCineEnd(false);
    HUD.el.hud.hidden = false;
    maDevourDeath();
  }
}
/* La victime se débat : bras et jambes agités (rotations des os, en plus de la pose de repos). */
function maVictimFlail(V, t) {
  const Bn = V.hero.bones;
  const set = (n, x, y, z) => { if (Bn[n]) Bn[n].rotation.set(x, y, z); };
  const a = Math.sin(t * 17), b = Math.sin(t * 13 + 1), c = Math.sin(t * 11 + 2);
  set('armL', -1.2 + 0.6 * a, 0.3, 0.9 + 0.4 * b); set('armR', -1.0 + 0.6 * b, -0.3, -0.9 - 0.4 * c);
  set('foreL', -0.6 - 0.5 * c, 0, 0); set('foreR', -0.5 - 0.5 * a, 0, 0);
  set('thighL', 0.5 * a, 0, 0.15); set('thighR', -0.5 * b, 0, -0.15);
  set('shinL', 0.6 + 0.5 * b, 0, 0); set('shinR', 0.6 + 0.5 * c, 0, 0);
  set('spine', 0.25 * c, 0.2 * a, 0); set('head', 0.4 * b, 0.5 * a, 0);
}
function maDevourEvent(name) {
  const B = MAB, D = B.devour, p = player;
  if (!D) return;
  const bite = maBeastAnchor('bite', _mbV);
  if (name === 'saisie') {
    D.held = true;
    maBeastSay('saisie', bite.x, bite.y, bite.z, { vol: 1.8, ref: 10 });
    maSplash(bite.x, bite.z, 2.4);
    bloodBurst(bite.x, bite.y, bite.z, 0, 0, 16, 1.4);
    maSecousse(1);
    if (B.victim) { B.victim.hero.object.visible = true; }
    Sound.playerHurt && Sound.playerHurt();
    p.hp = Math.max(1, p.hp - 60);
  } else if (name === 'secousse') {
    maBeastSay('secousse', bite.x, bite.y, bite.z, { vol: 1.7, ref: 10 });
    maSplash(bite.x, bite.z, 1.8);
    bloodBurst(bite.x, bite.y, bite.z, rand(-1, 1), rand(-1, 1), 12, 1.2);
    maSecousse(1);
  } else if (name === 'avale') {
    maBeastSay('avale', bite.x, bite.y, bite.z, { vol: 1.8, ref: 10 });
    setTimeout(() => { if (B.devour) B.devour.swallowed = true; if (B.victim) B.victim.hero.object.visible = false; }, 260);
  } else if (name === 'plonge') {
    maBeastSay('plonge', bite.x, MA.water, bite.z, { vol: 1.6, ref: 14 });
    maSplash(bite.x, bite.z, 2.8);
  }
}
/* Fin de partie sans relève possible (comme la mort dans la tempête). */
function maDevourDeath() {
  const p = player;
  maSwimEnd(true);
  p.hp = 0;
  G.stats.downs++;
  Life.add('downs');
  maEmit('devoration', { what: 'fin' });
  gameOver();
  const t = $('go-title'); if (t) t.textContent = 'Dévoré par la Mère-Vase';
  setTimeout(() => khFade(false, 0.8), 400);
  maBeastSetState('retraite');
}

/* ---------------------------------------------------------------- Au menu --
   La bête au loin, dans la brume : les leurres qui flottent, une échine qui affleure. */
function maBeastMenu(dt) {
  const B = MAB;
  if (!B.mv || !B.obj) return;
  B.menuT += dt;
  if (!B.obj.parent) return;
  B.obj.visible = true;
  const t = B.menuT * 0.05;
  B.x = 585 + Math.cos(t) * 26; B.z = 760 + Math.sin(t) * 12; B.yaw = Math.atan2(-Math.sin(t) * 26, Math.cos(t) * 12) + Math.PI;
  B.y = -1.9;
  B.obj.position.set(B.x, B.y, B.z); B.obj.rotation.set(0, B.yaw, 0);
  if (B.mv.state.clip !== 'guet') B.mv.play('guet');
  B.mv.drive({ speed: 1.2, turn: 0.2 });
  B.mv.update(dt);
  maBeastShadowUpdate();
  maBeastGlowUpdate(dt, true);
}
