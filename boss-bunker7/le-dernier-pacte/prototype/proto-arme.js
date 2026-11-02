/*!
 * proto-arme.js — Arme hitscan du prototype : modèle vu à la 1re personne (fusil générique + mains gantées),
 * cadence, chargeur, rechargement, visée, recul, flamme de bouche, lumière de tir, traçantes, impacts
 * (étincelles, poussière, trous, sang sombre). Les cibles sont fournies par des « fournisseurs » :
 *
 *   const arme = ProtoB7Arme.creer(THREE, { joueur, monde, camera, compat });
 *   arme.ajouterFournisseur({ nom: 'boss', intersecter(o, d, max) → { distance, point, normale, zone, cible } | null,
 *                             toucher(hit, degats, info) });
 *   arme.ajouterFournisseur(ProtoB7Arme.fournisseurSpheres(() => modele.hitboxes(), (hit, degats) => combat.toucherBoss(...)));
 *   arme.mettreAJour(dt, temps)          // lit joueur.entree (tir, viser, recharger) ; v1.4 : rien pendant l'étourdissement (joueur.etourdiT)
 *   arme.rendreVue(renderer)              // dessine le modèle 1re personne par-dessus l'image (efface la profondeur)
 *   arme.effets                           // Object3D des traçantes / impacts (suit automatiquement le lieu du joueur)
 *   arme.definirPap(n) ; arme.on('tir'|'touche'|'impact'|'rechargement', fn)
 * Global : ProtoB7Arme.
 */
(function (root) {
  'use strict';
  var U = root.ProtoB7Commun;
  var PI = Math.PI;

  // reserveMax : munitions de réserve (40 chargeurs ≈ 2 min de tir continu : un joueur seul tient une phase ; le bonus « Munitions max » la remplit)
  var REGLAGES = { degats: 35, cadence: 10, chargeur: 30, rechargement: 2.1, portee: 150, dispersion: 0.012, dispersionVisee: 0.0025, recul: 0.011, reserveMax: 1200 };

  function creer(THREE, o) {
    o = o || {};
    var C = o.compat || U.compat(THREE);
    var R = {};
    for (var k in REGLAGES) R[k] = o.reglages && o.reglages[k] != null ? o.reglages[k] : REGLAGES[k];
    var joueur = o.joueur, monde = o.monde, camera = o.camera;
    var a = { reglages: R, munitions: R.chargeur, reserve: R.reserveMax, enRechargement: false, pap: 0, fournisseurs: [], tirs: 0, actif: true };
    var ecout = {};
    a.on = function (t, f) { (ecout[t] = ecout[t] || []).push(f); };
    function emettre(t, d) { (ecout[t] || []).forEach(function (f) { try { f(d); } catch (e) { setTimeout(function () { throw e; }); } }); }

    // ── modèle 1re personne (scène séparée, rendue après le monde) ──
    var sceneVue = new THREE.Scene();
    var camVue = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    sceneVue.add(new THREE.HemisphereLight(C.couleur(0x8090a8), C.couleur(0x201812), 1.6));
    var dl = new THREE.DirectionalLight(C.couleur(0xffd8b0), 2.2); dl.position.set(1, 2, 1); sceneVue.add(dl);
    var lumTir = new THREE.PointLight(C.couleur(0xffb060), 0, 3, 2); lumTir.position.set(0.15, -0.1, -0.9); sceneVue.add(lumTir);
    var support = new THREE.Group(); sceneVue.add(support);
    var fusil = new THREE.Group(); support.add(fusil);
    function m(c, r, me, em) { var x = new THREE.MeshStandardMaterial({ color: C.couleur(c), roughness: r, metalness: me || 0 }); if (em) { x.emissive = C.couleur(em); x.emissiveIntensity = 0; } return x; }
    var mAcier = m(0x2e3033, 0.42, 0.6), mBois = m(0x5a3a22, 0.7, 0), mGant = m(0x2a2522, 0.85, 0), mManche = m(0x4a4a36, 0.95, 0), mPap = m(0x3a2a6a, 0.3, 0.5, 0x6a3cff);
    a.materiaux = { acier: mAcier, bois: mBois, pap: mPap };
    function boite(w, h, d, mat, x, y, z, rx) { var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); me.position.set(x, y, z); if (rx) me.rotation.x = rx; fusil.add(me); return me; }
    function cyl(r1, r2, L, mat, x, y, z) { var me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, L, 12), mat); me.rotation.x = PI / 2; me.position.set(x, y, z); fusil.add(me); return me; }
    // fusil (repère : canon vers −Z, poignée près de l'origine)
    boite(0.055, 0.075, 0.34, mAcier, 0, 0.0, -0.12);                 // carcasse
    cyl(0.011, 0.011, 0.46, mAcier, 0, 0.018, -0.5);                 // canon
    cyl(0.017, 0.017, 0.05, mAcier, 0, 0.018, -0.74);                // cache-flamme
    boite(0.06, 0.05, 0.3, mBois, 0, -0.008, -0.42);                  // garde-main
    boite(0.045, 0.16, 0.08, mBois, 0, -0.09, 0.02, 0.35);            // poignée
    var chargeur = boite(0.03, 0.17, 0.06, mAcier, 0, -0.11, -0.2, -0.15);
    boite(0.05, 0.09, 0.26, mBois, 0, -0.03, 0.2, 0.08);              // crosse
    boite(0.008, 0.03, 0.01, mAcier, 0, 0.06, -0.68);                 // guidon
    boite(0.03, 0.02, 0.02, mAcier, 0, 0.05, -0.02);                  // hausse
    var bandePap = boite(0.062, 0.012, 0.25, mPap, 0, 0.042, -0.18);  // liseré « Pack-a-Punch »
    bandePap.visible = false;
    // mains gantées et manches
    var mainD = new THREE.Group(); fusil.add(mainD); mainD.position.set(0.0, -0.07, 0.03);
    mainD.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.1), mGant));
    var avD = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 10), mManche); avD.rotation.x = PI / 2.3; avD.position.set(0.05, -0.08, 0.2); mainD.add(avD);
    var mainG = new THREE.Group(); fusil.add(mainG); mainG.position.set(0.0, -0.04, -0.42);
    mainG.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.11), mGant));
    var avG = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 10), mManche); avG.rotation.set(PI / 2.6, 0, 0.5); avG.position.set(-0.11, -0.1, 0.17); mainG.add(avG);
    // flamme de bouche
    var texFlash = (function () {
      var c = U.canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,200,90,0.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr; g.beginPath();
      for (var i = 0; i < 10; i++) { var an = i / 10 * PI * 2, r = i % 2 ? 12 : 32; g.lineTo(32 + Math.cos(an) * r, 32 + Math.sin(an) * r); }
      g.fill(); return U.tex(THREE, C, c, { clamp: true });
    })();
    var flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFlash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    flash.position.set(0, 0.018, -0.8); flash.scale.set(0.16, 0.16, 1); flash.visible = false; fusil.add(flash);
    var bouche = new THREE.Object3D(); bouche.position.set(0, 0.018, -0.78); fusil.add(bouche);
    a.sceneVue = sceneVue; a.fusil = fusil;

    // ── effets dans le monde : traçantes, étincelles, impacts ──
    var effets = new THREE.Group(); effets.name = 'effetsArme'; a.effets = effets;
    var NT = 24, trac = new THREE.BufferGeometry(), tracP = new Float32Array(NT * 6), tracC = new Float32Array(NT * 6), tracVie = new Float32Array(NT), tracI = 0;
    trac.setAttribute('position', new THREE.BufferAttribute(tracP, 3)); trac.setAttribute('color', new THREE.BufferAttribute(tracC, 3));
    var traceurs = new THREE.LineSegments(trac, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    traceurs.frustumCulled = false; effets.add(traceurs);
    var NS = 160, sg = new THREE.BufferGeometry(), sP = new Float32Array(NS * 3), sC = new Float32Array(NS * 3), sV = new Float32Array(NS * 3), sVie = new Float32Array(NS), sI = 0;
    sg.setAttribute('position', new THREE.BufferAttribute(sP, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sC, 3));
    var texPt = (function () { var c = U.canvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return U.tex(THREE, C, c, { clamp: true }); })();
    var etincelles = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.05, map: texPt, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    etincelles.frustumCulled = false; effets.add(etincelles);
    var ND = 48, decals = [], dI = 0;
    var texTrou = (function () { var c = U.canvas(64, 64), g = c.getContext('2d'); var gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(15,12,10,0.9)'); gr.addColorStop(0.6, 'rgba(40,34,30,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return U.tex(THREE, C, c, { clamp: true }); })();
    var mDecal = new THREE.MeshBasicMaterial({ map: texTrou, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    var gDecal = new THREE.PlaneGeometry(0.09, 0.09);
    for (var i = 0; i < ND; i++) { var dm = new THREE.Mesh(gDecal, mDecal); dm.visible = false; effets.add(dm); decals.push(dm); }
    var lumMonde = new THREE.PointLight(C.couleur(0xffa860), 0, 9, 2); effets.add(lumMonde);
    var lieuEffets = null;

    // ── tir ──
    var _o = { x: 0, y: 0, z: 0 }, _d = { x: 0, y: 0, z: 0 }, _bouche = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
    var attente = 0, reload = 0, kick = 0, flashT = 0, sway = 0;
    a.ajouterFournisseur = function (f) { a.fournisseurs.push(f); return f; };
    a.retirerFournisseur = function (f) { a.fournisseurs = a.fournisseurs.filter(function (x) { return x !== f; }); };
    a.recharger = function () {
      if (a.enRechargement || a.munitions >= R.chargeur) return;
      if (!(a.reserve > 0)) { emettre('vide', {}); return; }          // plus rien en réserve
      a.enRechargement = true; reload = R.rechargement; emettre('rechargement', {});
    };
    /** Chargeur et réserve pleins (bonus « Munitions max ») ; interrompt un rechargement en cours. */
    a.remplirMunitions = function () {
      a.enRechargement = false; reload = 0;
      a.munitions = R.chargeur; a.reserve = R.reserveMax;
      emettre('munitions', { munitions: a.munitions, reserve: a.reserve });
    };
    a.definirPap = function (n) {
      a.pap = n || 0; bandePap.visible = a.pap > 0;
      mPap.emissiveIntensity = a.pap > 0 ? 0.6 + 0.4 * a.pap : 0;
      R.degats = REGLAGES.degats * (1 + a.pap); R.chargeur = REGLAGES.chargeur + a.pap * 10; a.munitions = R.chargeur;
      var base = o.reglages && o.reglages.reserveMax != null ? o.reglages.reserveMax : REGLAGES.reserveMax;
      R.reserveMax = base * R.chargeur / REGLAGES.chargeur; a.reserve = R.reserveMax;
    };
    function aleaDisque(r) { var an = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * r; return [Math.cos(an) * rr, Math.sin(an) * rr]; }
    a.tirer = function () {
      if (!joueur || !joueur.vivant) return false;
      if (a.enRechargement) return false;
      if (a.munitions <= 0) { a.recharger(); return false; }
      a.munitions--; a.tirs++;
      joueur.positionYeux(_o); joueur.directionRegard(_d);
      // dispersion dans un cône
      var disp = joueur.entree.viser ? R.dispersionVisee : R.dispersion * (1 + Math.min(1, Math.hypot(joueur.vitesse.x, joueur.vitesse.z) / 6));
      var e = aleaDisque(disp), rx = Math.cos(joueur.lacet), rz = -Math.sin(joueur.lacet);
      // vecteur « haut » de la visée = droite × direction
      var ux = -rz * _d.y, uy = rz * _d.x - rx * _d.z, uz = rx * _d.y, ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      _d.x += rx * e[0] + ux * e[1]; _d.y += uy * e[1]; _d.z += rz * e[0] + uz * e[1];
      var l = Math.hypot(_d.x, _d.y, _d.z); _d.x /= l; _d.y /= l; _d.z /= l;
      var mur = monde ? monde.tir(joueur.lieu, _o, _d, R.portee) : null;
      var max = mur ? mur.distance : R.portee, best = null, fbest = null;
      for (var i = 0; i < a.fournisseurs.length; i++) {
        var f = a.fournisseurs[i];
        if (f.lieu && f.lieu() !== joueur.lieu) continue;
        var h = f.intersecter(_o, _d, max);
        if (h && h.distance < max) { max = h.distance; best = h; fbest = f; }
      }
      var fin;
      if (best) {
        fin = best.point;
        var res = fbest.toucher(best, R.degats, { joueur: joueur.id, origine: _o, direction: _d });
        impact(best.point, best.normale, res && res.immunise ? 'bouclier' : (best.materiau || 'chair'));
        emettre('touche', { fournisseur: fbest.nom, hit: best, resultat: res });
      } else if (mur) {
        fin = mur.point;
        impact(mur.point, mur.normale, mur.surface);
        emettre('impact', mur);
      } else fin = { x: _o.x + _d.x * R.portee, y: _o.y + _d.y * R.portee, z: _o.z + _d.z * R.portee };
      // traçante depuis la bouche (position monde du modèle 1re personne)
      fusil.updateMatrixWorld(true);
      bouche.getWorldPosition(_bouche);                 // repère caméra de la scène de vue
      _bouche.applyMatrix4(camera.matrixWorld);         // → monde
      if (Math.random() < 0.6) traceur(_bouche, fin);
      kick = 1; flashT = 0.05;
      joueur.recul(R.recul * (joueur.entree.viser ? 0.6 : 1), (Math.random() - 0.5) * R.recul * 0.6);
      lumMonde.position.set(_bouche.x, _bouche.y, _bouche.z); lumMonde.intensity = 6;
      emettre('tir', { munitions: a.munitions });
      return true;
    };
    function traceur(p0, p1) {
      var i = tracI++ % NT, k = i * 6;
      tracP[k] = p0.x; tracP[k + 1] = p0.y; tracP[k + 2] = p0.z; tracP[k + 3] = p1.x; tracP[k + 4] = p1.y; tracP[k + 5] = p1.z;
      tracVie[i] = 0.06;
      trac.attributes.position.needsUpdate = true;
    }
    function impact(p, n, type) {
      var col = type === 'chair' ? [0.25, 0.02, 0.01] : type === 'bouclier' ? [0.6, 0.85, 1.3] : type === 'energie' ? [1.2, 0.25, 0.1] : type === 'metal' ? [1.4, 0.9, 0.5] : [0.9, 0.75, 0.55];
      var nb = type === 'chair' ? 10 : type === 'bouclier' ? 14 : 8;
      for (var i = 0; i < nb; i++) {
        var s = sI++ % NS;
        sP[s * 3] = p.x + n.x * 0.02; sP[s * 3 + 1] = p.y + n.y * 0.02; sP[s * 3 + 2] = p.z + n.z * 0.02;
        var v = type === 'chair' ? 1.2 : 3.2;
        sV[s * 3] = (n.x + (Math.random() - 0.5) * 1.4) * v; sV[s * 3 + 1] = (n.y + (Math.random() - 0.2) * 1.2) * v; sV[s * 3 + 2] = (n.z + (Math.random() - 0.5) * 1.4) * v;
        sC[s * 3] = col[0]; sC[s * 3 + 1] = col[1]; sC[s * 3 + 2] = col[2];
        sVie[s] = 0.25 + Math.random() * 0.3;
      }
      if (type !== 'chair' && type !== 'bouclier' && type !== 'energie') {
        var d = decals[dI++ % ND];
        d.visible = true; d.position.set(p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004);
        _n.set(n.x, n.y, n.z); _q.setFromUnitVectors(_z, _n); d.quaternion.copy(_q); d.rotateZ(Math.random() * PI * 2);
        d.scale.setScalar(0.7 + Math.random() * 0.6);
      }
    }
    a.impact = impact;
    a.traceur = function (p0, p1) { traceur(p0, p1); };

    // ── fournisseur générique : liste de sphères { zone, centre, rayon } ──
    a.mettreAJour = function (dt, temps) {
      if (!joueur) return;
      if (monde && joueur.lieu !== lieuEffets) { lieuEffets = joueur.lieu; monde.scenes[lieuEffets].add(effets); }
      var ent = joueur.entree;
      var etourdi = joueur.etourdiT > 0;                         // v1.4 : étourdi (décharge du Survolté) : ni tir ni rechargement
      if (ent.recharger) { ent.recharger = false; if (!etourdi) a.recharger(); }
      if (a.enRechargement && !etourdi) {
        reload -= dt;
        if (reload <= 0) { a.enRechargement = false; var pris = Math.min(R.chargeur - a.munitions, a.reserve); a.munitions += pris; a.reserve -= pris; emettre('recharge', { reserve: a.reserve }); }
      }
      attente -= dt;
      var peut = a.actif && joueur.controle && joueur.vivant && !etourdi && !(ent.sprint && ent.avant > 0 && !ent.viser);
      if (ent.tir && peut) {
        while (attente <= 0) { attente += 1 / R.cadence; if (!a.tirer()) { attente = Math.max(attente, 0.05); break; } }
      } else if (attente < 0) attente = 0;
      // effets
      for (var i = 0; i < NT; i++) if (tracVie[i] > 0) { tracVie[i] -= dt; var k = U.clamp(tracVie[i] / 0.06, 0, 1); for (var c = 0; c < 2; c++) { tracC[i * 6 + c * 3] = 1.0 * k; tracC[i * 6 + c * 3 + 1] = 0.75 * k; tracC[i * 6 + c * 3 + 2] = 0.4 * k; } }
      trac.attributes.color.needsUpdate = true;
      for (var s = 0; s < NS; s++) {
        if (sVie[s] <= 0) continue;
        sVie[s] -= dt;
        if (sVie[s] <= 0) { sP[s * 3 + 1] = -999; continue; }
        sV[s * 3 + 1] -= 9 * dt;
        sP[s * 3] += sV[s * 3] * dt; sP[s * 3 + 1] += sV[s * 3 + 1] * dt; sP[s * 3 + 2] += sV[s * 3 + 2] * dt;
      }
      sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;
      lumMonde.intensity = Math.max(0, lumMonde.intensity - dt * 120);
      // animation du modèle 1re personne
      kick = Math.max(0, kick - dt * 16);
      flashT -= dt;
      flash.visible = flashT > 0; if (flash.visible) { flash.material.rotation = Math.random() * PI; flash.scale.setScalar(0.12 + Math.random() * 0.08); }
      lumTir.intensity = flashT > 0 ? 3 : 0;
      var v = Math.hypot(joueur.vitesse.x, joueur.vitesse.z), sprint = ent.sprint && ent.avant > 0 && !ent.viser;
      sway += dt * (1 + v * 1.4);
      var vis = ent.viser ? 1 : 0;
      a._vis = (a._vis || 0) + (vis - (a._vis || 0)) * Math.min(1, dt * 12);
      var sp = (a._sp || 0) + ((sprint ? 1 : 0) - (a._sp || 0)) * Math.min(1, dt * 8); a._sp = sp;
      var rl = a.enRechargement ? Math.sin(U.clamp(1 - reload / R.rechargement, 0, 1) * PI) : 0;
      var bx = Math.sin(sway * 1.0) * 0.006 * (1 + v * 0.3) * (1 - a._vis * 0.8), by = Math.abs(Math.cos(sway * 1.0)) * 0.006 * (1 + v * 0.3) * (1 - a._vis * 0.8);
      support.position.set(U.lerp(0.17, 0.0, a._vis) + bx + sp * 0.05, U.lerp(-0.17, -0.065, a._vis) + by - rl * 0.12 - sp * 0.04, U.lerp(-0.3, -0.22, a._vis) + kick * 0.035);
      support.rotation.set(kick * 0.05 + rl * 0.7 - sp * 0.25, U.lerp(0.05, 0, a._vis) + sp * 0.55, sp * 0.35 + rl * 0.25);
      chargeur.position.y = -0.11 - (rl > 0.5 ? (rl - 0.5) * 0.4 : 0);
      if (camera) { camVue.fov = camera.fov * 0.86; camVue.aspect = camera.aspect; camVue.updateProjectionMatrix(); }
      support.visible = joueur.vivant;
    };
    /** Dessine le modèle 1re personne par-dessus l'image du monde. */
    a.rendreVue = function (renderer) {
      var ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(sceneVue, camVue);
      renderer.autoClear = ac;
    };
    return a;
  }

  /** Fournisseur de cibles à partir d'une liste de sphères (ex. modele.hitboxes()). */
  function fournisseurSpheres(nom, getSpheres, onTouche, getLieu) {
    var hit = { distance: 0, point: { x: 0, y: 0, z: 0 }, normale: { x: 0, y: 0, z: 0 }, zone: 'corps', cible: null, materiau: 'chair' };
    return {
      nom: nom,
      lieu: getLieu || null,
      intersecter: function (o, d, max) {
        var L = getSpheres(), best = max, trouve = false;
        if (!L) return null;
        for (var i = 0; i < L.length; i++) {
          var s = L[i], cx = s.centre.x - o.x, cy = s.centre.y - o.y, cz = s.centre.z - o.z;
          var t = cx * d.x + cy * d.y + cz * d.z;
          if (t < 0) continue;
          var d2 = cx * cx + cy * cy + cz * cz - t * t, r2 = s.rayon * s.rayon;
          if (d2 > r2) continue;
          var t0 = t - Math.sqrt(r2 - d2);
          if (t0 < best) {
            best = t0; trouve = true;
            hit.distance = t0; hit.point.x = o.x + d.x * t0; hit.point.y = o.y + d.y * t0; hit.point.z = o.z + d.z * t0;
            var nx = hit.point.x - s.centre.x, ny = hit.point.y - s.centre.y, nz = hit.point.z - s.centre.z, l = Math.hypot(nx, ny, nz) || 1;
            hit.normale.x = nx / l; hit.normale.y = ny / l; hit.normale.z = nz / l;
            hit.zone = s.zone || 'corps'; hit.cible = s;
          }
        }
        return trouve ? hit : null;
      },
      toucher: function (h, degats, info) { return onTouche ? onTouche(h, degats, info) : null; }
    };
  }

  var API = { creer: creer, fournisseurSpheres: fournisseurSpheres, REGLAGES: REGLAGES };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Arme = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
