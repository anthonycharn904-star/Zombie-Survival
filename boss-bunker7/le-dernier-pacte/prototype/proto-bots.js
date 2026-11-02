/*!
 * proto-bots.js — Coéquipiers simulés (coop) du prototype. Ils se déplacent (navigation A*), tirent sur la cible
 * qu'on leur désigne (le boss) ou sur le zombie le plus proche, esquivent les dangers annoncés (cercles, lignes),
 * vont dans un cercle donné (rituel). Mêmes états qu'un joueur : PV, régénération, invulnérabilité, contrôle.
 *
 *   const B = ProtoB7Bots.creer(THREE, { monde, zombies, compat, surTir(bot, tir), immortels: false });
 *   B.immortels(true|false) → état ; immortels : les coups les blessent mais leurs PV ne descendent jamais sous 1 (essais d'Anthony)
 *   v1.3 : l'aura de l'Irradié et les flaques toxiques (zombies.dangersZone) s'ajoutent d'office aux dangers évités ;
 *   les mini-boss sont des cibles comme les autres (zombies.plusProche).
 *   v1.4 : zones radioactives (zombies.dangersZone) évitées comme l'aura ; b.etourdir(duree) / b.etourdiRestant() (ni déplacement ni
 *   tir, le corps tremble) ; b.tirerVers(position) : déplacement forcé (crochets), sans résolution de collision.
 *   v1.5 : b.projeter(vx, vz, duree) (charge du Démembré : projeté, collisions comprises ; un mur de la salle heurté →
 *   B.surImpactMur(bot, { x, z, vitesse }), posé par l'adaptateur) ; situation.murs = { distance } (murs électrifiés) : ils
 *   restent à plus de distance + 0,5 m du plan des murs de l'octogone (arene.salle) ; trajectoire d'une charge annoncée
 *   (zombies.dangersZone, type 'ligne') évitée comme les autres dangers.
 *   B.ajouter({ id: 'bot1', lieu, position, lacet, couleur });
 *   B.mettreAJour(dt, temps, situation)
 *     situation = { cible: { position, rayon, tirable } | null, dangers: [ { type: 'cercle', centre, rayon }, { type: 'ligne', a, b, largeur } ],
 *                   cercle: { centre, rayon } | null, distanceCible: [7, 12], tirer: true, precision: 0.7, reaction: 0.35 }
 *   B.liste() → bots ; chaque bot : infligerDegats, blessureCritique, teleporter, definirControle, definirInvulnerable, regarder, vue()
 *   tir = { cible: 'boss' | 'zombie', id, chien, degats, zone, point, origine, direction, touche }   (chien = true : chien zombie, visé en priorité sous 8 m)
 * Global : ProtoB7Bots.
 */
(function (root) {
  'use strict';
  var U = root.ProtoB7Commun;
  var PI = Math.PI;

  function creer(THREE, o) {
    o = o || {};
    var C = o.compat || U.compat(THREE), monde = o.monde, zombies = o.zombies;
    var surTir = o.surTir || function () {};
    var B = { bots: [] };
    // Essais du combat complet (demande d'Anthony) : coéquipiers immortels. Les coups portent (frappe à 1 %, blocs, morsures),
    // la régénération reprend, mais les PV ne descendent jamais sous PV_MIN_IMMORTEL : ils ne meurent pas.
    var immortels = o.immortels === true, PV_MIN_IMMORTEL = 1;
    var R = U.rng(4242);

    function modele(couleur) {
      var g = new THREE.Group();
      var mTenue = new THREE.MeshStandardMaterial({ color: C.couleur(couleur), roughness: 0.85 });
      var mPeau = new THREE.MeshStandardMaterial({ color: C.couleur(0xb08670), roughness: 0.8 });
      var mNoir = new THREE.MeshStandardMaterial({ color: C.couleur(0x1d1b19), roughness: 0.7, metalness: 0.2 });
      var torse = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 10), mTenue); torse.position.y = 1.2; g.add(torse);
      var bassin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.2, 10), mNoir); bassin.position.y = 0.86; g.add(bassin);
      var tete = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mPeau); tete.position.y = 1.65; g.add(tete);
      var casque = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, PI * 2, 0, PI / 2), mTenue); casque.position.y = 1.68; g.add(casque);
      function membre(x, y, L, r, mat) { var piv = new THREE.Group(); piv.position.set(x, y, 0); var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, L, 8), mat); m.position.y = -L / 2; piv.add(m); g.add(piv); return piv; }
      var jG = membre(0.09, 0.8, 0.78, 0.07, mTenue), jD = membre(-0.09, 0.8, 0.78, 0.07, mTenue);
      var bG = membre(0.25, 1.45, 0.6, 0.05, mTenue), bD = membre(-0.25, 1.45, 0.6, 0.05, mTenue);
      var fusil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.8), mNoir); fusil.position.set(-0.05, 1.22, 0.32); g.add(fusil);
      var marque = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 20), new THREE.MeshBasicMaterial({ color: C.couleur(couleur) }));
      marque.rotation.x = PI / 2; marque.position.y = 2.05; g.add(marque);
      g.rotation.order = 'YXZ';                         // v1.5 : lacet d'abord, puis bascules dans le repère du corps (projection)
      return { groupe: g, jG: jG, jD: jD, bG: bG, bD: bD, fusil: fusil, tete: tete };
    }

    B.ajouter = function (opts) {
      var m = modele(opts.couleur || [0x3a6ea5, 0xa5823a, 0x6e3aa5][B.bots.length % 3]);
      var b = {
        id: opts.id || ('bot' + (B.bots.length + 1)), lieu: opts.lieu || 'salle', modele: m,
        position: new THREE.Vector3(opts.position.x, 0, opts.position.z), vitesse: new THREE.Vector3(), lacet: opts.lacet || 0,
        pvMax: 100, pv: 100, vivant: true, aTerre: false, controle: true, invulnerable: false, invulnerableJusqua: 0,
        dernierDegat: -99, temps: 0, chemin: null, cheminT: 0, but: null, butT: 0, tir: 0, phase: R() * 6, mortT: 0,
        danger: null, dangerReaction: 0, regard: null, atouts: {}, armes: [], tirs: 0, etourdiT: 0, forceT: 0,
        projT: 0, projD: 0, projVx: 0, projVz: 0                                  // v1.5 : projection (charge)
      };
      var V = { id: b.id, position: { x: 0, y: 0, z: 0 }, vitesse: { x: 0, y: 0, z: 0 }, lacet: 0, vivant: true, aTerre: false, lieu: b.lieu, pvFraction: 1, bot: true };
      b.vue = function () {
        V.position.x = b.position.x; V.position.y = 0; V.position.z = b.position.z;
        V.vitesse.x = b.vitesse.x; V.vitesse.z = b.vitesse.z; V.lacet = b.lacet; V.vivant = b.vivant; V.aTerre = b.aTerre; V.lieu = b.lieu; V.pvFraction = b.pv / b.pvMax;
        return V;
      };
      b.estInvulnerable = function () { return b.invulnerable || b.temps < b.invulnerableJusqua; };
      b.infligerDegats = function (f) {
        if (!b.vivant || b.estInvulnerable() || !(f > 0)) return 0;
        b.pv = Math.max(immortels ? PV_MIN_IMMORTEL : 0, b.pv - f * b.pvMax); b.dernierDegat = b.temps;
        if (b.pv <= 0) { b.vivant = false; b.mortT = 0; }
        return f;
      };
      b.blessureCritique = function (fr) { if (!b.vivant) return; b.pv = Math.min(b.pv, Math.max(1e-6, fr) * b.pvMax); b.dernierDegat = b.temps; };
      b.teleporter = function (p, lacet, lieu) { b.position.set(p.x, 0, p.z); b.vitesse.set(0, 0, 0); b.projT = 0; if (lacet != null) b.lacet = lacet; b.lieu = lieu || (monde && monde.lieuDe ? monde.lieuDe(p.x) : b.lieu); b.chemin = null; placer(b); };
      b.definirControle = function (x) { b.controle = !!x; };
      b.definirInvulnerable = function (x) { b.invulnerable = !!x; };
      b.regarder = function (p) { b.regard = p ? { x: p.x, z: p.z } : null; };
      b.etourdir = function (d) { if (!b.vivant) return 0; d = d > 0 ? d : 1; if (d > b.etourdiT) b.etourdiT = d; return b.etourdiT; };
      b.etourdiRestant = function () { return b.etourdiT; };
      b.tirerVers = function (p) { if (!p || !isFinite(p.x) || !isFinite(p.z)) return false; b.position.x = p.x; b.position.z = p.z; b.vitesse.set(0, 0, 0); b.chemin = null; b.forceT = 0.15; b.projT = 0; return true; };
      b.projeter = function (vx, vz, d) { if (!b.vivant || !isFinite(vx) || !isFinite(vz) || !(d > 0)) return false; b.projVx = vx; b.projVz = vz; b.projT = d; b.projD = d; b.vitesse.set(vx, 0, vz); b.chemin = null; return true; };
      b.projectionRestante = function () { return b.projT; };
      b.donnerAtout = function (id) { if (b.atouts[id]) return false; b.atouts[id] = true; if (id === 'mastodonte') { var f = b.pv / b.pvMax; b.pvMax = 250; b.pv = f * 250; } return true; };
      B.bots.push(b);
      placer(b);
      return b;
    };
    function placer(b) { if (monde) { var sc = monde.scenes[b.lieu]; if (b.modele.groupe.parent !== sc) sc.add(b.modele.groupe); } }
    B.retirer = function (id) { B.bots = B.bots.filter(function (b) { if (b.id === id && b.modele.groupe.parent) b.modele.groupe.parent.remove(b.modele.groupe); return b.id !== id; }); };
    B.liste = function () { return B.bots; };
    /** Coéquipiers immortels (essais) : B.immortels(true|false) ; sans argument, renvoie l'état. Activer ranime ceux qui sont morts. */
    B.immortels = function (on) {
      if (on != null) { immortels = !!on; if (immortels) B.bots.forEach(ranimer); }
      return immortels;
    };
    function ranimer(b) {
      if (b.vivant) return;
      b.vivant = true; b.aTerre = false; b.mortT = 0; b.pv = b.pvMax * 0.5; b.dernierDegat = b.temps;
      b.modele.groupe.rotation.z = 0; b.modele.groupe.position.y = 0;
    }
    B.obtenir = function (id) { for (var i = 0; i < B.bots.length; i++) if (B.bots[i].id === id) return B.bots[i]; return null; };

    // distance d'un point à un danger (négative = dedans)
    function marge(d, x, z) {
      if (d.type === 'cercle') return Math.hypot(x - d.centre.x, z - d.centre.z) - d.rayon;
      var ax = d.a.x, az = d.a.z, ex = d.b.x - ax, ez = d.b.z - az, l2 = ex * ex + ez * ez;
      var t = l2 > 0 ? U.clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1) : 0;
      return Math.hypot(x - (ax + ex * t), z - (az + ez * t)) - (d.largeur || 1.5);
    }
    function sortie(d, x, z, out) {
      if (d.type === 'cercle') { var vx = x - d.centre.x, vz = z - d.centre.z, l = Math.hypot(vx, vz) || 1; out.x = vx / l; out.z = vz / l; return; }
      var ex = d.b.x - d.a.x, ez = d.b.z - d.a.z, l2 = Math.hypot(ex, ez) || 1, nx = -ez / l2, nz = ex / l2;
      var s = (x - d.a.x) * nx + (z - d.a.z) * nz >= 0 ? 1 : -1;
      out.x = nx * s; out.z = nz * s;
    }

    var _o = { x: 0, y: 0, z: 0 }, _d = { x: 0, y: 0, z: 0 }, _s = { x: 0, z: 0 }, _p = { x: 0, z: 0 }, _n = { x: 0, z: 0 };
    // v1.5 : murs électrifiés (situation.murs = { distance }) : distance au plan du mur le plus proche (apothème le long de sa
    // normale) ; les coéquipiers restent au-delà de distance + 0,5 m. Repli si le monde ne fournit pas distanceMur.
    var AR = root.BOSS_B7_ARENE && root.BOSS_B7_ARENE.salle;
    function distanceMur(lieu, x, z, out) {
      if (monde && monde.distanceMur) return monde.distanceMur(lieu, x, z, out);
      if (lieu !== 'salle' || !AR) return Infinity;
      var O = AR.origine || { x: 0, z: 0 }, A = AR.apotheme || 15, best = Infinity;
      for (var k = 0; k < 8; k++) { var th = k * PI / 4, nx = Math.sin(th), nz = Math.cos(th), d = A - ((x - O.x) * nx + (z - O.z) * nz); if (d < best) { best = d; if (out) { out.x = nx; out.z = nz; } } }
      return best;
    }
    B.surImpactMur = null;                              // posé par l'adaptateur (dégâts impactMur de la charge)
    var dangersTous = [];
    function dangersAvecZones(sit) {
      dangersTous.length = 0;
      var D = sit.dangers;
      if (D) for (var q = 0; q < D.length; q++) dangersTous.push(D[q]);
      if (zombies && zombies.dangersZone) zombies.dangersZone(dangersTous);
      return dangersTous;
    }
    B.mettreAJour = function (dt, temps, sit) {
      sit = sit || {};
      for (var i = 0; i < B.bots.length; i++) {
        var b = B.bots[i];
        b.temps = temps;
        var m = b.modele;
        if (!b.vivant && immortels) ranimer(b);
        if (!b.vivant) {
          b.mortT += dt;
          m.groupe.rotation.z = U.lerp(m.groupe.rotation.z, PI / 2, Math.min(1, dt * 5)); m.groupe.position.y = 0.15;
          if (sit.reapparitionBots && b.mortT > 12) { b.vivant = true; b.pv = b.pvMax; m.groupe.rotation.z = 0; m.groupe.position.y = 0; }
          continue;
        }
        if (b.pv < b.pvMax && temps - b.dernierDegat > 3.5) b.pv = Math.min(b.pvMax, b.pv + 0.5 * b.pvMax * dt);
        if (b.etourdiT > 0) b.etourdiT = Math.max(0, b.etourdiT - dt);
        if (b.forceT > 0) b.forceT = Math.max(0, b.forceT - dt);
        var actif = b.controle && !(b.etourdiT > 0) && !(b.projT > 0);                 // étourdi ou projeté : ni déplacement ni tir
        var vx = 0, vz = 0, vmax = 4.4;
        if (actif) {
          // 1) dangers annoncés : sortir perpendiculairement (après le temps de réaction)
          var pire = null, pm = 1e9;
          var dangers = dangersAvecZones(sit);
          for (var k = 0; k < dangers.length; k++) { var mg = marge(dangers[k], b.position.x, b.position.z); if (mg < 1.2 && mg < pm) { pm = mg; pire = dangers[k]; } }
          if (pire) {
            if (b.danger !== pire) { b.danger = pire; b.dangerReaction = sit.reaction != null ? sit.reaction : 0.35; }
            b.dangerReaction -= dt;
            if (b.dangerReaction <= 0) { sortie(pire, b.position.x, b.position.z, _s); vx = _s.x * 6.2; vz = _s.z * 6.2; vmax = 6.2; }
          } else b.danger = null;
          // 2) but : cercle de capture, sinon distance de combat autour de la cible
          if (!pire || b.dangerReaction > 0) {
            b.butT -= dt;
            if (!b.but || b.butT <= 0 || (b.but.lieu !== b.lieu)) {
              var but = null;
              if (sit.cercle) { var an = R() * PI * 2, rr = Math.sqrt(R()) * sit.cercle.rayon * 0.6; but = { x: sit.cercle.centre.x + Math.cos(an) * rr, z: sit.cercle.centre.z + Math.sin(an) * rr }; }
              else if (sit.cible && sit.cible.position) {
                var dc = sit.distanceCible || [7, 12], a0 = Math.atan2(b.position.x - sit.cible.position.x, b.position.z - sit.cible.position.z) + (R() - 0.5) * 1.6;
                var r0 = dc[0] + R() * (dc[1] - dc[0]);
                but = { x: sit.cible.position.x + Math.sin(a0) * r0, z: sit.cible.position.z + Math.cos(a0) * r0 };
              } else if (sit.aller) but = { x: sit.aller.x, z: sit.aller.z };
              if (but && monde) { var g = monde.grilles[b.lieu], q = g && g.plusProcheLibre(but.x, but.z, 6); if (q) { but.x = q.x; but.z = q.z; } }
              if (but && sit.murs) {                                           // v1.5 : but ramené hors de la bande des murs électrifiés
                for (var it = 0; it < 3; it++) { var dmb = distanceMur(b.lieu, but.x, but.z, _n), lim = sit.murs.distance + 0.9; if (dmb >= lim) break; but.x -= _n.x * (lim - dmb); but.z -= _n.z * (lim - dmb); }
              }
              b.but = but ? { x: but.x, z: but.z, lieu: b.lieu } : null; b.butT = sit.cercle ? 2.5 : 1.6 + R() * 1.5;
              b.chemin = b.but && monde ? monde.chemin(b.position, b.but, b.lieu) : null;
            }
            if (b.but) {
              var cible = b.chemin && b.chemin.length ? b.chemin[0] : b.but;
              var ex = cible.x - b.position.x, ez = cible.z - b.position.z, el = Math.hypot(ex, ez);
              if (el < 0.4 && b.chemin && b.chemin.length) b.chemin.shift();
              if (el > 0.25) { vx += ex / el * vmax; vz += ez / el * vmax; }
            }
            // recul face aux zombies proches
            if (zombies) { var zp = zombies.plusProche(b.position.x, b.position.z, b.lieu, 2.5); if (zp) { var fx = b.position.x - zp.position.x, fz = b.position.z - zp.position.z, fl = Math.hypot(fx, fz) || 1; vx += fx / fl * 3; vz += fz / fl * 3; } }
          }
          if (sit.murs) {
            var dmr = distanceMur(b.lieu, b.position.x, b.position.z, _n), limr = sit.murs.distance + 0.5;
            if (dmr < limr + 0.6) {                                           // v1.5 : murs électrifiés : rester au-delà de distance + 0,5 m
              var vn = vx * _n.x + vz * _n.z; if (vn > 0) { vx -= vn * _n.x; vz -= vn * _n.z; }
              if (dmr < limr + 0.25) { var kmr = Math.min(1, (limr + 0.25 - dmr) / 0.6); vx -= _n.x * 6.2 * kmr; vz -= _n.z * 6.2 * kmr; vmax = Math.max(vmax, 6.2); }
            }
          }
          var vl = Math.hypot(vx, vz); if (vl > vmax) { vx *= vmax / vl; vz *= vmax / vl; }
        }
        b.vitesse.x += (vx - b.vitesse.x) * Math.min(1, dt * 8); b.vitesse.z += (vz - b.vitesse.z) * Math.min(1, dt * 8);
        if (b.etourdiT > 0 || b.forceT > 0) { b.vitesse.x *= Math.max(0, 1 - dt * 12); b.vitesse.z *= Math.max(0, 1 - dt * 12); }
        if (b.projT > 0) { b.projT = Math.max(0, b.projT - dt); var kpb = b.projD > 0 ? 0.4 + 0.6 * b.projT / b.projD : 0; b.vitesse.x = b.projVx * kpb; b.vitesse.z = b.projVz * kpb; }   // v1.5 : projeté
        b.position.x += b.vitesse.x * dt; b.position.z += b.vitesse.z * dt;
        if (monde && !(b.forceT > 0)) {
          _p.x = b.position.x; _p.z = b.position.z;
          var heurte = monde.resoudre(b.lieu, _p, 0.35) && b.projT > 0 && monde.contactMur;   // v1.5 : projeté contre un mur de la salle
          b.position.x = _p.x; b.position.z = _p.z;
          if (heurte) {
            var vImp = Math.hypot(b.projVx, b.projVz) * (b.projD > 0 ? 0.4 + 0.6 * b.projT / b.projD : 0);
            b.projT = 0; b.vitesse.set(0, 0, 0);
            if (B.surImpactMur) { try { B.surImpactMur(b, { x: b.position.x, z: b.position.z, vitesse: vImp }); } catch (e) { setTimeout(function () { throw e; }); } }
          }
        }
        // orientation : vers la cible si elle est tirable, sinon dans le sens de la marche
        var vise = null;
        if (b.regard) vise = b.regard;
        else if (sit.cible && sit.tirer !== false && sit.cible.tirable !== false) vise = sit.cible.position;
        // v1.2 : un chien zombie à moins de 8 m passe avant tout (boss compris), sinon le zombie le plus proche
        var chien = zombies ? zombies.plusProche(b.position.x, b.position.z, b.lieu, 8, 'chien') : null;
        var zc = chien || (zombies ? zombies.plusProche(b.position.x, b.position.z, b.lieu, 14) : null);
        if (chien && !b.regard) vise = chien.position;
        if (!vise && zc) vise = zc.position;
        var lac = vise ? Math.atan2(vise.x - b.position.x, vise.z - b.position.z) : (Math.hypot(b.vitesse.x, b.vitesse.z) > 0.3 ? Math.atan2(b.vitesse.x, b.vitesse.z) : b.lacet);
        b.lacet += U.angleDiff(b.lacet, lac) * Math.min(1, dt * 8);
        // tir (10 coups/s), précision réglable
        b.tir -= dt;
        if (actif && sit.tirer !== false && b.tir <= 0) {
          b.tir += 0.1;
          var cibleTir = null, type = null;
          if (sit.cible && sit.cible.tirable !== false && (!monde || monde.visible(b.position, sit.cible.position, b.lieu))) { cibleTir = sit.cible; type = 'boss'; }
          if (zc && (chien || !cibleTir || Math.hypot(zc.position.x - b.position.x, zc.position.z - b.position.z) < 4) && (zc !== chien || !monde || monde.visible(b.position, zc.position, b.lieu))) { cibleTir = { position: zc.position, rayon: 0.3, id: zc.id, chien: zc === chien }; type = 'zombie'; }
          if (cibleTir) {
            b.tirs++;
            var touche = R() < (sit.precision != null ? sit.precision : 0.7);
            _o.x = b.position.x; _o.y = 1.45; _o.z = b.position.z;
            var hy = type === 'boss' ? (cibleTir.position.y || 0) + 1.2 : cibleTir.chien ? 0.55 + (cibleTir.position.y || 0) : 1.1;
            _d.x = cibleTir.position.x - _o.x; _d.y = hy - _o.y; _d.z = cibleTir.position.z - _o.z;
            var dl = Math.hypot(_d.x, _d.y, _d.z) || 1; _d.x /= dl; _d.y /= dl; _d.z /= dl;
            surTir(b, { cible: type, id: cibleTir.id || null, chien: !!cibleTir.chien, degats: 35, zone: R() < 0.12 ? 'tete' : 'corps', touche: touche, origine: _o, direction: _d, distance: dl });
          }
        } else if (b.tir < 0) b.tir = 0;
        // animation simple
        var v = Math.hypot(b.vitesse.x, b.vitesse.z);
        b.phase += dt * v * 3.2;
        var a = Math.sin(b.phase) * Math.min(1, v / 4) * 0.7;
        m.jG.rotation.x = a; m.jD.rotation.x = -a;
        m.bG.rotation.x = -1.2; m.bD.rotation.x = -1.3; m.bG.rotation.z = 0.35; m.bD.rotation.z = -0.15;
        m.groupe.position.set(b.position.x, Math.abs(Math.sin(b.phase)) * 0.03, b.position.z);
        var tr = b.etourdiT > 0 ? 0.06 * Math.min(1, b.etourdiT / 0.25) : 0;                // étourdi : le corps tremble
        var kpj = b.projT > 0 && b.projD > 0 ? b.projT / b.projD : 0;
        if (kpj > 0) {                                                                       // v1.5 : projeté : basculé dans le sens de la projection, décollé du sol
          var phj = Math.atan2(b.projVx, b.projVz) - b.lacet, inc = 0.8 * Math.sin(PI * Math.min(1, (1 - kpj) * 1.3 + 0.15));
          m.groupe.rotation.set(inc * Math.cos(phj), b.lacet, -inc * Math.sin(phj));
          m.groupe.position.y += 0.35 * Math.sin(PI * (1 - kpj));
        } else m.groupe.rotation.set(tr * Math.sin(temps * 61), b.lacet + tr * Math.sin(temps * 47), tr * Math.sin(temps * 53));
        placer(b);
      }
    };
    B.vues = function () { var r = []; for (var i = 0; i < B.bots.length; i++) r.push(B.bots[i].vue()); return r; };
    return B;
  }

  var API = { creer: creer };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Bots = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
