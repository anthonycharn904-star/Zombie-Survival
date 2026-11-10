  // ============================================================================================
  // API publique (boss/API.md §6, §16.6) : BossB7Modele.creer(THREE, options) →
  //   { object, update(dt, vue), reagir(dirX, dirZ, force), flash(couleur, intensite), points, hitboxes(), dispose(),
  //     couleurLames(nom) }
  // options : renderer, tete (données BOSS_B7_TETE ; un ancien module « BossTete » est aussi accepté), qualite
  // ('haute' | 'moyenne' | 'basse'), ombres (true), gouttes (true), solY (nombre ou fonction (x, z) → y : sol sous le
  // boss, pour les poses au sol et les gouttes de sang ; à défaut vue.sol, sinon la hauteur des pieds), couleursLineaires,
  // v2.2 : couleurLames ('rouge' par défaut | 'bleu' | 'vert'), allege (false ; instance légère pour les illusions).
  // ============================================================================================
  const VERSION = '2.3.0';   // 2.3 : actions evanouissement et resurgissement (v1.5 du combat) ; 2.2 : couleur des lames, crochet, allégé ; 2.1 : siphon

  function creer(THREE, options) {
    const O = Object.assign({ qualite: 'haute', ombres: true, renderer: null, tete: null, gouttes: true, solY: null, couleurLames: null, allege: false }, options || {});
    O.altitudeIncluse = true;                 // vue.position = pieds du modèle (pas d'altitude séparée)
    O.allege = !!O.allege;
    // allégé : sans ombres sauf demande explicite (ni projection, ni réception, ni matériaux de profondeur)
    if (O.allege && !(options && options.ombres != null)) O.ombres = false;
    const q = { haute: 1, moyenne: 0.72, basse: 0.5 }[O.qualite] || 1;
    const linear = O.couleursLineaires != null ? O.couleursLineaires : wantsLinear(THREE, O.renderer);
    const T = tableSquelette();
    const sk = makeSkeleton(THREE, T);
    const I = sk.index, W = sk.world, B = sk.byName;
    const U = {
      uTemps: { value: 0 }, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.0, 0.32, 0.06) },
      uPuis: { value: 0 }, uSceauCoul: { value: new THREE.Color(1.6, 0.28, 0.05) },
      uVeine: { value: 0 }, uVeineCoul: { value: new THREE.Color(1.4, 0.18, 0.04) },
      uDoublure: { value: new THREE.Color().fromArray(linear ? PAL.doublure.map(toLin) : PAL.doublure) },
      uFlotAmp: { value: 0.012 }, uFlash: { value: new THREE.Color(0, 0, 0) },
      uCicatrice: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3(0, -10, 0)) }
    };
    // tête : données du contrat BOSS_B7_TETE, ancien module (creer), ou tête de remplacement procédurale
    let teteMod = null;
    try {
      if (O.tete && O.tete.pos && O.tete.idx && O.tete.bbox) teteMod = creerTeteB7(THREE, O.tete, O, U, W.head, linear, I);
      else if (O.tete && typeof O.tete.creer === 'function') teteMod = O.tete.creer(THREE, { renderer: O.renderer, qualite: O.qualite, donnees: O.teteDonnees });
    } catch (err) {
      teteMod = null;
      if (typeof console !== 'undefined') console.warn('BossB7Modele : tête inutilisable, tête de remplacement', err);
    }
    // géométries du corps : construites une fois par configuration (densité, espace de couleur, tête, allègement) et
    // partagées par les instances identiques (illusions) ; chaque instance a ses matériaux, son squelette, ses maillages
    const cleCorps = ['corps', THREE.REVISION, q, linear ? 1 : 0, teteMod ? 'b7' : 'remplacement', O.allege ? 'allege' : 'complet'].join('|');
    const resCorps = prendreRessource(THREE, cleCorps, () => {
      const bd = new Builder(THREE, q);
      const Q = { sansCou: !!teteMod };
      construireCorps(bd, THREE, I, W, Q);
      construireManteau(bd, THREE, I, W, Q);
      construireEtole(bd, THREE, I, W, Q);
      construireMains(bd, THREE, I, W);
      if (!teteMod) construireTete(bd, THREE, I, W, Q);
      if (O.allege) {
        // allégé : pièces métalliques fondues dans le cuir, bandages dans le drap (mêmes couleurs de sommets) ; fioles de
        // la ceinture et gemme de la broche omises (avec la tête cuite, « yeux » ne contient que la gemme) → 13 maillages
        // du corps ramenés à 8, même silhouette
        bd.fusionner('cuir', 'metal'); bd.fusionner('tunique', 'bandage'); bd.retirer('verre'); bd.retirer('ame');
        if (teteMod) bd.retirer('yeux');
      }
      return { geos: bd.geometries(linear), cicatrice: Q.cicatrice || null, liberer: (e) => { for (const k in e.geos) e.geos[k].geo.dispose(); } };
    });
    const GEO = resCorps.valeur;
    if (GEO.cicatrice) GEO.cicatrice.forEach((p, i) => U.uCicatrice.value[i].set(p[0], p[1], p[2]));

    const MAT = materiauxCorps(THREE, U, { teteRemplacement: !teteMod });
    const meshes = {};
    for (const k in GEO.geos) meshes[k] = maillageSkinne(THREE, GEO.geos[k], MAT[k], k);
    const object = new THREE.Group();
    object.name = 'BossB7Modele';
    const corps = new THREE.Group();
    corps.name = 'boss-corps';
    corps.scale.setScalar(ECHELLE);
    object.add(corps);
    corps.add(sk.bones[0]);
    let trisCorps = 0;
    for (const k in meshes) {
      const m = meshes[k];
      m.castShadow = !!O.ombres && k !== 'yeux' && k !== 'bouche' && k !== 'verre' && k !== 'ame';
      if (k === 'verre') m.renderOrder = 3;
      m.receiveShadow = !!O.ombres;
      if (O.ombres) m.customDepthMaterial = depthBoss(THREE, MAT[k].userData.flags || {}, U, k);
      corps.add(m);
      trisCorps += m.geometry.index.count / 3;
    }
    object.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(sk.bones);
    for (const k in meshes) meshes[k].bind(skeleton);
    if (teteMod) {
      B.head.add(teteMod.objet);
      if (teteMod.peauSkinnee) { corps.add(teteMod.peauSkinnee); corps.updateMatrixWorld(true); teteMod.peauSkinnee.bind(skeleton); }
    }

    // ---------------------------------------------------------------- ancres (Object3D qui suivent les os)
    const ancres = {};
    const local = (bone, p) => { const w = W[bone]; return [p[0] - w[0], p[1] - w[1], p[2] - w[2]]; };
    const ancre = (nom, bone, p, z, y) => {
      const o = new THREE.Object3D(); o.name = 'ancre-' + nom;
      const l = local(bone, p); o.position.set(l[0], l[1], l[2]);
      if (z) {
        const Z = vnorm(z), Y0 = y ? vnorm(y) : [0, 1, 0], X = vnorm(vcross(Y0, Z)), Y = vcross(Z, X);
        o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])));
      }
      B[bone].add(o); ancres[nom] = o; return o;
    };
    for (const [S, G, sx] of [['L', 'G', 1], ['R', 'D', -1]]) {
      const d = [ARM_DIR[0] * sx, ARM_DIR[1], 0], pl = sx > 0 ? PAUME_L : miroir(PAUME_L);
      ancre('main' + G, 'hand' + S, vadd(vadd(W['hand' + S], vscale(d, 0.055)), vscale(pl, 0.02)), pl, d);
      ancre('oeil' + G, 'oeil' + G, vadd(W['oeil' + G], [0, 0, 0.012]), [0, 0, 1]);
      ancre('pied' + G, 'foot' + S, vadd(W['foot' + S], [0, -0.075, 0.05]), [0, 0, 1]);
      const A = AILE.doigts[1], tip = sx > 0 ? A.tip : miroir(A.tip);
      ancre('aile' + G, 'aileD2b' + S, tip, sx > 0 ? A.dir : miroir(A.dir));
    }
    ancre('poitrine', 'chest', [0, 1.33, 0.135], [0, 0, 1]);
    ancre('dos', 'chest', [0, 1.3, -0.15], [0, 0, -1]);
    ancre('tete', 'head', [0, 1.68, 0.0], [0, 0, 1]);
    ancre('bouche', 'head', [0, 1.599, 0.086], [0, 0, 1]);
    if (teteMod && teteMod.ancres) for (const k of ['bouche', 'oeilG', 'oeilD']) {
      const a = teteMod.ancres[k];
      if (a && ancres[k]) { ancres[k].parent.remove(ancres[k]); ancres[k].position.set(0, 0, 0); ancres[k].quaternion.identity(); a.add(ancres[k]); }
    }
    // lames : garde (lameG/lameD) et pointe (pointeLameG/pointeLameD), placées par le module des lames
    for (const G of ['G', 'D']) {
      ancres['lame' + G] = new THREE.Object3D(); ancres['lame' + G].name = 'ancre-lame' + G;
      ancres['pointeLame' + G] = new THREE.Object3D(); ancres['pointeLame' + G].name = 'ancre-pointeLame' + G;
      ancres['main' + G].add(ancres['lame' + G]); ancres['main' + G].add(ancres['pointeLame' + G]);
    }

    // ---------------------------------------------------------------- zones de tir : sphères qui suivent les os
    const SPHERES = [
      ['tete', 'head', [0, 1.675, 0.008], 0.125],
      ['corps', 'chest', [0, 1.31, 0.0], 0.215], ['corps', 'spine', [0, 1.13, 0.01], 0.2], ['corps', 'hips', [0, 0.93, 0.0], 0.215],
      ['corps', 'thighL', [0.095, 0.70, 0.012], 0.13], ['corps', 'thighR', [-0.095, 0.70, 0.012], 0.13],
      ['corps', 'shinL', [0.1, 0.3, 0.0], 0.1], ['corps', 'shinR', [-0.1, 0.3, 0.0], 0.1]
    ];
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const ad = [ARM_DIR[0] * sx, ARM_DIR[1], 0], sh = [0.185 * sx, 1.418, -0.035];
      SPHERES.push(['corps', 'arm' + S, vadd(sh, vscale(ad, L_UPPER * 0.55)), 0.085]);
      SPHERES.push(['corps', 'fore' + S, vadd(vadd(sh, vscale(ad, L_UPPER)), vscale(ad, L_FORE * 0.5)), 0.075]);
    }
    const hitAncres = [], hitListe = [];
    for (const [zone, bone, p, r] of SPHERES) {
      const o = new THREE.Object3D(); o.name = 'hitbox-' + zone + '-' + bone;
      const l = local(bone, p); o.position.set(l[0], l[1], l[2]);
      B[bone].add(o);
      hitAncres.push({ o: o, r: r });
      hitListe.push({ zone: zone, type: 'sphere', centre: { x: 0, y: 0, z: 0 }, rayon: r * ECHELLE, os: bone });
    }

    // ---------------------------------------------------------------- ailes, lames, voile, aura
    // teinte : couleurs liées à la palette des lames de CETTE instance (dissolution et halo quand les lames sont là)
    const teinte = { nom: 'rouge', dissol: new THREE.Color(0.9, 0.02, 0.01), aura: new THREE.Color(0.8, 0.03, 0.02) };
    const ctxM = { THREE: THREE, B: B, I: I, W: W, objet: object, corps: corps, U: U, MAT: MAT, opts: O, q: q, linear: linear, skeleton: skeleton, ancres: ancres, teinte: teinte };
    // allégé : pas d'ailes (les illusions n'en ont jamais) ; leurs os sortent de l'arbre mis à jour à chaque image
    const ailes = O.allege ? null : creerAiles(THREE, ctxM);
    if (O.allege) for (const S of ['L', 'R']) { const r = B['aileRac' + S]; if (r && r.parent) r.parent.remove(r); }
    const lames = creerLames(THREE, ctxM);
    const voile = creerVoile(THREE, ctxM);
    const aura = creerAura(THREE, ctxM);

    const M = { B: B, W: W, objet: object, corps: corps, U: U, MAT: MAT, maillages: meshes, opts: O, tete: teteMod, ailes: ailes, lames: lames, voile: voile, aura: aura, machoireForcee: null, lueurForcee: null, teinte: teinte };
    const anim = creerAnimateur(THREE, M);
    const traduire = creerSequenceur();

    let tris = trisCorps, trisTete = 0;
    for (const x of [ailes, lames, voile, aura]) if (x && x.triangles) tris += x.triangles;
    if (teteMod) {
      teteMod.objet.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.index) trisTete += o.geometry.index.count / 3; });
      if (teteMod.peauSkinnee) trisTete += teteMod.peauSkinnee.geometry.index.count / 3;
      tris += trisTete;
    }

    const flashCoul = new THREE.Color(0, 0, 0), vTmp = new THREE.Vector3(), sTmp = new THREE.Vector3(), qTmp = new THREE.Quaternion();
    const st = { horloge: 0, flash: 0, pret: false, libere: false };
    const modele = {
      version: VERSION,
      object: object,
      points: {
        mainG: ancres.mainG, mainD: ancres.mainD, tete: ancres.tete, bouche: ancres.bouche, poitrine: ancres.poitrine, dos: ancres.dos,
        piedG: ancres.piedG, piedD: ancres.piedD, lameG: ancres.lameG, lameD: ancres.lameD, pointeLameG: ancres.pointeLameG, pointeLameD: ancres.pointeLameD,
        oeilG: ancres.oeilG, oeilD: ancres.oeilD, aileG: ancres.aileG, aileD: ancres.aileD
      },
      /** vue = combat.etat().boss (+ vue.temps, vue.sol facultatif) ; dt en secondes */
      update: function (dt, vue) {
        dt = clamp(+dt || 0, 0, 0.1);
        st.horloge += dt;
        if (!vue) { object.visible = false; return; }
        // couleur des lames : vue.couleurLames ('bleu' | 'rouge' | 'vert' ; null = rouge) ; clé absente : couleur inchangée
        if (vue.couleurLames !== undefined) lames.palette(vue.couleurLames);
        let solY = vue.sol;
        if (solY == null && O.solY != null) solY = typeof O.solY === 'function' ? O.solY(vue.position ? vue.position.x : 0, vue.position ? vue.position.z : 0) : O.solY;
        const E = traduire(vue, st.horloge, dt, solY);
        M.solCourant = solY;
        anim.appliquer(E, dt);
        if (st.flash > 0.001) {
          st.flash *= Math.exp(-dt / 0.085);
          U.uFlash.value.copy(flashCoul).multiplyScalar(st.flash);
        } else if (st.flash !== 0) { st.flash = 0; U.uFlash.value.setRGB(0, 0, 0); }
      },
      /** sursaut à l'impact : (dirX, dirZ) = direction de la balle dans le monde (du tireur vers le boss) */
      reagir: function (dirX, dirZ, force) { anim.sursaut(+dirX || 0, 0, +dirZ || 0, force == null ? 0.6 : +force); },
      /** éclair d'émission bref sur tout le corps (dégâts, immunité) */
      flash: function (couleur, intensite) {
        if (couleur == null) flashCoul.setRGB(1.0, 0.25, 0.08);
        else if (couleur.isColor) flashCoul.copy(couleur);
        else if (typeof couleur === 'object') flashCoul.setRGB(couleur.r || 0, couleur.g || 0, couleur.b || 0);
        else flashCoul.set(couleur);
        if (linear && !(THREE.ColorManagement && THREE.ColorManagement.enabled) && flashCoul.convertSRGBToLinear && !(couleur && couleur.isColor)) flashCoul.convertSRGBToLinear();
        st.flash = Math.max(st.flash, intensite == null ? 1 : Math.max(0, +intensite));
        U.uFlash.value.copy(flashCoul).multiplyScalar(st.flash);
      },
      /** zones de tir à jour (repère monde). Le tableau et ses objets sont réutilisés d'un appel à l'autre. */
      hitboxes: function () {
        object.getWorldScale(sTmp);
        const ech = sTmp.x * corps.scale.x;
        for (let i = 0; i < hitAncres.length; i++) {
          hitAncres[i].o.getWorldPosition(vTmp);
          const h = hitListe[i];
          h.centre.x = vTmp.x; h.centre.y = vTmp.y; h.centre.z = vTmp.z;
          h.rayon = hitAncres[i].r * ech;
        }
        return hitListe;
      },
      /** remet la simulation (manteau, particules, fondus) à zéro */
      reinitialiser: function () { anim.reinitialiser(); },
      /** couleur des lames : couleurLames('bleu' | 'rouge' | 'vert') la change aussitôt (null ou inconnu = 'rouge') et la
       *  renvoie ; couleurLames() sans argument renvoie la couleur courante. Uniformes et couleurs de matériau seulement. */
      couleurLames: function (nom) { return arguments.length ? lames.palette(nom) : lames.paletteCourante(); },
      allege: O.allege,
      /** promesse résolue quand les textures de la tête sont chargées */
      pret: teteMod && teteMod.pret ? teteMod.pret : Promise.resolve(),
      // accès avancés (outils, débogage)
      os: B, squelette: skeleton, maillages: meshes, materiaux: MAT, uniformes: U, tete: teteMod, ailes: ailes, lames: lames, voile: voile, aura: aura, animateur: anim,
      teteType: teteMod ? (O.tete && O.tete.pos ? 'BOSS_B7_TETE' : 'module') : 'remplacement',
      stats: { triangles: Math.round(tris), trianglesCorps: Math.round(trisCorps), trianglesTete: Math.round(trisTete), trianglesAiles: ailes ? ailes.triangles : 0, trianglesLames: lames ? lames.triangles : 0, os: sk.bones.length, appelsDessin: 0, allege: O.allege },
      dispose: function () {
        if (st.libere) return;
        st.libere = true;
        resCorps.rendre();   // géométries du corps : libérées avec la dernière instance qui les utilise
        for (const k in meshes) { if (meshes[k].customDepthMaterial) meshes[k].customDepthMaterial.dispose(); }
        for (const k in MAT) { const m = MAT[k]; if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); m.dispose(); }
        for (const x of [ailes, lames, voile, aura]) if (x && x.dispose) x.dispose();
        if (teteMod && teteMod.dispose) teteMod.dispose();
        if (skeleton.boneTexture) skeleton.boneTexture.dispose();
        if (object.parent) object.parent.remove(object);
      }
    };
    let dc = 0;
    object.traverse((o) => { if (o.isMesh && o.material && o.material.visible !== false) dc++; });
    modele.stats.appelsDessin = dc;
    void qTmp;
    modele.update(0, { present: true, visible: true, position: { x: 0, y: 0, z: 0 }, lacet: 0, locomotion: 'levitation', action: null, ailes: 'absentes', lames: 'absentes' });
    modele.reinitialiser();
    return modele;
  }
