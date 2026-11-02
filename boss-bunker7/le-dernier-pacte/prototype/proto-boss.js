/*!
 * proto-boss.js — Prototype jouable du boss fight de Bunker 7 (« Le Septième »), assemblage complet :
 * mini-moteur (monde, joueur, arme, zombies, coéquipiers simulés, adaptateur `jeu`) + logique du combat
 * (BossB7Logique) + modèle 3D animé (BossB7Modele + tête) + effets (BossB7Fx) + sons (BossB7Audio) + interface
 * (BossB7Hud). Contrat : API.md §12. Rien ici n'est le jeu d'Anthony : c'est la démonstration de référence que
 * Claude Code reproduit dans Zombie Survival.
 * Global : ProtoB7Boss.lancer(THREE, options) → Promise<api> ; l'API est aussi exposée dans window.BOSS.
 */
(function (root) {
  'use strict';

  var PHASE_DE_ETAT = { introduction: 'phase1', phase1: 'phase1', repit: 'phase2', phase2: 'phase2', transition23: 'phase2',
    absence: 'absence', retour: 'phase3', phase3: 'phase3', transition34: 'phase3', rituel: 'rituel', rituel_fin: 'rituel',
    faiblesse: 'faiblesse', transition45: 'faiblesse', phase5: 'phase5', defaite: 'phase5' };

  async function lancer(THREE, o) {
    o = o || {};
    var U = root.ProtoB7Commun, CP = U.compat(THREE);
    var C = root.BOSS_B7_CONFIG, A = root.BOSS_B7_ARENE;
    var auto = !!o.auto;
    var W = o.largeur || 0, H = o.hauteur || 0;

    // ── rendu ──
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.captures });
    renderer.setPixelRatio(W ? 1 : Math.min(1.5, root.devicePixelRatio || 1));
    renderer.setSize(W || root.innerWidth, H || root.innerHeight);
    CP.configurerRendu(renderer);
    (o.conteneur || document.body).appendChild(renderer.domElement);
    var camera = new THREE.PerspectiveCamera(75, (W || root.innerWidth) / (H || root.innerHeight), 0.05, 260);

    // ── mini-moteur ──
    var monde = root.ProtoB7Monde.creer(THREE, { arene: A, renderer: renderer, qualite: o.qualite || 'haute' });
    var temps = 0, vitesseTemps = 1;
    var depart = monde.points.bunker.arrivee[0];
    var joueur = root.ProtoB7Joueur.creer(THREE, { monde: monde, camera: camera, element: renderer.domElement, id: 'j1', lieu: 'bunker',
      position: depart, lacet: depart.lacet, clavier: !auto, verrouAuClic: false });
    joueur.teleporter(depart, depart.lacet, 'bunker');
    var arme = root.ProtoB7Arme.creer(THREE, { joueur: joueur, monde: monde, camera: camera, compat: CP });
    var jeu = null, combat = null, modele = null;
    var zombies = root.ProtoB7Zombies.creer(THREE, {
      monde: monde, compat: CP, max: 40,
      halosIrradies: false,                 // v1.5 : la lueur verte au sol des entités irradiées est dessinée par fx.js (lueursIrradies)
      // v1.2 : les chiens mordent avec profil.degats (jeu.attaqueZombie) et rapportent 100 points (jeu.zombieTue)
      surAttaque: function (z, id) {
        if (jeu) jeu.attaqueZombie(z, id);
        if (z && z.type === 'chien' && audio && audio.morsureChien) audio.morsureChien(z.position, z.lieu);
      },
      surMort: function (z, tueur) { if (jeu) jeu.zombieTue(z, tueur); },
      // v1.3 : capacités des mini-boss (charge, décharge, spasme, aura, flaque) → sons positionnels (API.md §15.6)
      surCapacite: function (z, quoi, info) {
        if (!audio || !audio.sonMiniBoss || !z || quoi === 'aura') return;
        var p = info && info.position && (info.position.x || info.position.z) ? info.position : z.position;
        // v1.4 : une zone radioactive a son propre identifiant (boucle par zone) ; 'etourdi' désigne le joueur étourdi (info.cible)
        audio.sonMiniBoss(z.type, quoi, p, { lieu: z.lieu, id: quoi === 'zone' && info && info.id != null ? info.id : z.id, etat: info && info.etat,
          intensite: info && info.intensite, duree: info && info.duree, cible: info && info.cible });
      }
    });
    var bots = root.ProtoB7Bots.creer(THREE, {
      monde: monde, zombies: zombies, compat: CP,
      immortels: !!o.botsImmortels,          // essais d'Anthony : coéquipiers simulés qui ne meurent pas (option de la page)
      surTir: function (b, t) {
        var fin = { x: t.origine.x + t.direction.x * Math.min(30, t.distance), y: t.origine.y + t.direction.y * Math.min(30, t.distance), z: t.origine.z + t.direction.z * Math.min(30, t.distance) };
        if (b.lieu === joueur.lieu && Math.random() < 0.35) arme.traceur(t.origine, fin);
        if (!t.touche) return;
        if (t.cible === 'zombie') zombies.toucher(t.id, jeu.mortInstantanee() ? 1e6 : t.degats, t.zone, { joueur: b.id });
        else if (t.cible === 'boss' && t.id != null && situation.cible.miniBoss) zombies.toucher(t.id, t.degats, t.zone, { joueur: b.id });   // v1.3 : le mini-boss tient lieu de cible
        else if (t.cible === 'boss' && combat) {
          var hb = modele.hitboxes(), h = hb[t.zone === 'tete' ? 0 : Math.min(hb.length - 1, 1)] || hb[0];
          combat.toucherBoss({ joueur: b.id, degats: t.degats, zone: t.zone, position: h ? h.centre : fin, type: 'balle' });
        }
      }
    });
    var audio = null, hud = null, bonusRamasses = [];
    jeu = root.ProtoB7Adaptateur.creer({ monde: monde, joueur: joueur, arme: arme, bots: bots, zombies: zombies, arene: A, ui: !!o.panneauJeu,
      horloge: function () { return temps; },
      // v1.1 : « Munitions max » ramassé (par le joueur ou un coéquipier) → annonce vocale, tintement, message
      surBonus: function (type, qui) {
        bonusRamasses.push({ type: type, joueur: qui, t: temps });
        if (audio && audio.annoncerBonus) audio.annoncerBonus(type);
        if (hud) hud.toast((root.BossB7Hud.NOMS[type] || type) + ' !' + (qui && qui !== 'j1' ? ' (ramassé par ' + qui + ')' : ''), 2.5);
      } });
    arme.ajouterFournisseur({
      nom: 'zombies', lieu: function () { return joueur.lieu; },
      intersecter: function (or, d, max) { return zombies.intersecter(or, d, max, joueur.lieu); },
      toucher: function (h, deg, info) { return zombies.toucher(h.cible, jeu.mortInstantanee() ? 1e6 : deg, h.zone, info); }
    });

    // ── combat, modèle, effets, interface, sons ──
    combat = root.BossB7Logique.creerCombat({ config: C, arene: A, jeu: jeu, graine: o.graine });
    modele = root.BossB7Modele.creer(THREE, { renderer: renderer, tete: root.BOSS_B7_TETE || null, qualite: o.qualite || 'haute', ombres: false, gouttes: false });
    monde.scenes.salle.add(modele.object);
    if (modele.pret && modele.pret.then) { try { await modele.pret; } catch (e) { /* tête de remplacement */ } }
    var etatCourant = combat.etat();
    arme.ajouterFournisseur(root.ProtoB7Arme.fournisseurSpheres('boss',
      function () { var b = etatCourant.boss; return b && b.present && b.visible ? modele.hitboxes() : null; },
      function (h, deg, info) {
        var r = combat.toucherBoss({ joueur: info.joueur || 'j1', degats: deg, zone: h.zone, position: { x: h.point.x, y: h.point.y, z: h.point.z }, type: 'balle' });
        return { applique: r.applique, immunise: r.raison === 'invulnerable' };
      },
      function () { return etatCourant.boss.lieu; }));
    // v1.5 : les illusions de la phase 5 sont supprimées (intangibilité à la place, API.md §17.3) : plus d'instances du modèle ni de
    // tirs sur des illusions

    var fx = root.BossB7Fx.creer(THREE, {
      scenes: monde.scenes, renderer: renderer, camera: camera, config: C, arene: A, qualite: o.qualiteFx || o.qualite || 'haute', ecranSepare: true, obscurite: o.obscurite !== false,
      mareBras: false,                       // v1.5 : le bras posé du prototype a déjà sa mare de sang
      lueursIrradies: true,
      monde: {
        tir: monde.tir,                      // v1.5 : ondulation de sortie quand le Septième intangible traverse un mur
        dalle: monde.dalle,
        positionZombie: function (id) { var z = zombies.obtenir ? zombies.obtenir(id) : null; return z && z.actif ? z.position : null; },
        lieuDe: function (p) { return monde.lieuDe(p.x); }
      },
      surSecousse: function (f, d) { joueur.secousse(f * 0.06, d); }
    });
    fx.brancher(combat);
    hud = root.BossB7Hud.creer({ racine: o.racineHud || document.body, config: C, toucheInteraction: 'E' });
    hud.brancher(combat);
    if (o.sons && root.BossB7Audio) {
      try {
        audio = root.BossB7Audio.creer({ manifeste: o.sons.manifeste, base: o.sons.base, sons: o.sons.donnees || {}, config: C, arene: A });
        audio.brancher(combat);
      } catch (e) { console.warn('sons indisponibles : ' + e.message); audio = null; }
    }

    // ── journal des évènements (tests) et suivi des phases ──
    var evenements = [], dernierePhase = 'phase1', fini = false;
    combat.on('*', function (t, d) {
      evenements.push(t + (d && d.vers ? ':' + d.vers : d && d.etat ? ':' + d.etat : d && d.etape ? ':' + (d.id || '') + '/' + d.etape : ''));
      if (evenements.length > 600) evenements.shift();
    });
    // v1.1 : un bloc qui frappe un pilier marque la pierre au point d'impact réel
    combat.on('pilier', function (d) { if (d && d.etat === 'touche' && monde.impactPilier) monde.impactPilier(d.id, d.pointImpact, d.coups); });
    combat.on('etat', function (e) {
      if (PHASE_DE_ETAT[e.vers]) dernierePhase = PHASE_DE_ETAT[e.vers];
      if (e.vers === 'echec') afficherEchec(true);
      if (e.vers === 'termine') { fini = true; jeu.apparitionsNormales(true, { max: 10, intervalle: 2.5, lieu: 'bunker' }); }
    });

    // ── coéquipiers simulés : situation ──
    var situationMurs = { distance: 2.2 };
    var situation = { cible: { position: { x: 0, y: 0, z: 0 }, rayon: 0.5, tirable: false, id: null, miniBoss: false }, dangers: [], cercle: null, distanceCible: [7, 12], tirer: true, precision: 0.7, reaction: 0.4 };
    var cercleRituel = { centre: { x: A.salle.origine.x + A.salle.cercle.x, z: A.salle.origine.z + A.salle.cercle.z }, rayon: C.phase4.rayon };
    function miniBossVivant(e) {
      var l = e.miniBoss;
      if (l) for (var i = 0; i < l.length; i++) if (l[i].etat === 'actif' && l[i].position && l[i].lieu === 'salle') return l[i];
      return null;
    }
    function situationBots(e) {
      var b = e.boss, s = situation, mb = b.protege ? miniBossVivant(e) : null;
      // v1.3 : tant que le Septième est protégé, les coéquipiers concentrent leur tir sur le mini-boss (hors de l'aura de l'Irradié)
      var c = mb ? mb.position : b.position;
      s.cible.position.x = c.x; s.cible.position.y = mb ? 0 : b.position.y; s.cible.position.z = c.z;
      s.cible.tirable = mb ? true : !!(b.present && b.visible && b.vulnerable !== false);
      s.cible.id = mb ? mb.id : null; s.cible.miniBoss = !!mb;
      s.dangers.length = 0;
      (e.zones || []).forEach(function (z) { s.dangers.push({ type: 'cercle', centre: z.position, rayon: z.rayon }); });
      if (e.pique && e.pique.depart && e.pique.arrivee) s.dangers.push({ type: 'ligne', a: e.pique.depart, b: e.pique.arrivee, largeur: 2.8 });
      (e.blocs || []).forEach(function (k) { if ((k.etat === 'levitation' || k.etat === 'vol') && k.pointImpact) s.dangers.push({ type: 'cercle', centre: k.pointImpact, rayon: 2.4 }); });
      var act = b.action;
      if (act && (act.id === 'onde_choc' || act.id === 'frappe' || act.id === 'frappe_ordinaire') && act.etape === 'preparation') s.dangers.push({ type: 'cercle', centre: b.position, rayon: act.id === 'onde_choc' ? C.phase3.ondeChoc.rayon : 3.2 });
      s.cercle = e.etat === 'rituel' ? cercleRituel : null;
      s.distanceCible = mb ? (mb.type === 'irradie' ? [6, 10] : [7, 11]) : e.etat === 'faiblesse' ? [3, 6] : e.etat === 'phase5' ? [3, 8] : [7, 12];
      // v1.5 : murs électrifiés par Le Survolté : les coéquipiers restent loin des murs (seulement tant qu'ils le sont)
      s.murs = e.murs && (e.murs.etat === 'electrifies' || e.murs.etat === 'charge') ? (situationMurs.distance = e.murs.distance || C.miniBoss.murs.distance, situationMurs) : undefined;
      return s;
    }

    // ── boucle ──
    var CTX = { modele: modele, temps: 0, joueurLocal: { id: 'j1', position: joueur.position, lieu: 'bunker' }, joueurs: null };
    var CTXA = { auditeur: { position: { x: 0, y: 0, z: 0 }, lacet: 0, lieu: 'bunker' }, joueurLocalId: 'j1',
      // v1.5 : positions des entités irradiées (grésillement des zombies infectés par L'Irradié, API.md §17.5)
      positionZombie: function (id) { var z = zombies.obtenir(id); return z && z.actif ? z.position : null; } };
    var CTXH = { joueurLocalId: 'j1', positionLocale: joueur.position, etourdi: 0 };
    var autel = monde.autelSalle || { x: A.salle.origine.x + A.salle.autel.x, z: A.salle.origine.z + A.salle.autel.z };
    var veillePas = 0;
    // Essais avec coéquipiers immortels : si le joueur tombe alors qu'un coéquipier est debout, l'échec ne peut plus arriver ;
    // le joueur revient donc au combat près d'un coéquipier après REAPPARITION_ESSAI s, invulnérable 2 s.
    var REAPPARITION_ESSAI = 6, mortJoueurT = 0, mortAnnoncee = false, invulRetourT = 0, invincibleDemande = false;
    function reapparitionEssai(dt, e) {
      if (invulRetourT > 0) { invulRetourT -= dt; if (invulRetourT <= 0 && !invincibleDemande) joueur.definirInvulnerable(false); }
      var actif = e.etat !== 'inactif' && e.etat !== 'termine' && e.etat !== 'echec';
      var debout = null, L = bots.liste();
      for (var i = 0; i < L.length; i++) if (L[i].vivant) { debout = L[i]; break; }
      if (joueur.vivant || !actif || !bots.immortels() || !debout) { mortJoueurT = 0; mortAnnoncee = false; return; }
      mortJoueurT += dt;
      if (!mortAnnoncee) { mortAnnoncee = true; hud.toast('Tu es tombé : retour au combat dans ' + REAPPARITION_ESSAI + ' s (coéquipiers immortels)', 3.5); }
      if (mortJoueurT < REAPPARITION_ESSAI) return;
      var lieu = debout.lieu, g = monde.grilles[lieu], an = Math.random() * Math.PI * 2;
      var q = { x: debout.position.x + Math.cos(an) * 1.6, z: debout.position.z + Math.sin(an) * 1.6 };
      var libre = g && g.plusProcheLibre(q.x, q.z, 4);
      if (libre) { q.x = libre.x; q.z = libre.z; }
      joueur.reapparaitre({ x: q.x, y: 0, z: q.z }, joueur.lacet, lieu);
      joueur.definirInvulnerable(true); invulRetourT = 2;
      mortJoueurT = 0; mortAnnoncee = false;
      hud.toast('De retour au combat', 2);
    }
    function pas(dtReel) {
      var dt = Math.min(0.05, dtReel > 0 ? dtReel : 0) * vitesseTemps;     // jamais négatif ni invalide
      temps += dt;
      combat.mettreAJour(dt);
      var e = combat.etat();
      etatCourant = e;
      monde.appliquerBlocs(e.blocs, temps);
      if (e.piliers && monde.appliquerPiliers) monde.appliquerPiliers(e.piliers, temps);   // v1.1 : piliers endommagés / effondrés
      if (e.tubes && monde.appliquerTubes) monde.appliquerTubes(e.tubes, temps);         // v1.3 : cuves siphonnées / brisées
      monde.mettreAJour(dt, temps);
      joueur.mettreAJour(dt, temps);
      arme.mettreAJour(dt, temps);
      var js = jeu.joueurs();
      zombies.mettreAJour(dt, temps, js);
      bots.mettreAJour(dt, temps, situationBots(e));
      jeu.mettreAJour(dt, temps);
      var sc = monde.scenes[e.boss.lieu] || monde.scenes.salle;
      if (modele.object.parent !== sc) sc.add(modele.object);
      var vue = e.boss; vue.temps = e.temps;
      modele.update(dt, vue);
      CTX.temps = temps; CTX.joueurLocal.lieu = joueur.lieu; CTX.joueurs = js;
      fx.mettreAJour(dt, e, CTX);
      monde.intensiteLumieres('salle', fx.facteurLumiere('salle'));
      monde.intensiteLumieres('bunker', fx.facteurLumiere('bunker'));
      // interaction : achever le rituel près du cadavre (maintenir E), ramasser l'autel
      var maintenu = !!joueur.entree.interagir && joueur.vivant;
      if (e.interaction) combat.interagir('j1', maintenu, dt);
      if (maintenu && joueur.lieu === 'salle' && Math.hypot(joueur.position.x - autel.x, joueur.position.z - autel.z) < 2.6) jeu.ramasserAutel('j1');
      CTXH.etourdi = joueur.etourdiRestant ? joueur.etourdiRestant() : 0;     // v1.4 : « Étourdi » (Survolté)
      hud.mettreAJour(dt, e, CTXH);
      if (audio) {
        joueur.positionYeux(CTXA.auditeur.position);
        CTXA.auditeur.lacet = joueur.lacet + Math.PI; CTXA.auditeur.lieu = joueur.lieu;
        audio.mettreAJour(dt, e, CTXA);
      }
      reapparitionEssai(dt, e);
      veillePas++;
      return e;
    }
    var infoRendu = { appels: 0, triangles: 0 };
    function rendre() {
      var sc = monde.scenes[joueur.lieu];
      renderer.render(sc, camera);
      var r = renderer.info.render, c = r.calls, t = r.triangles;
      arme.rendreVue(renderer);
      fx.rendreEcran(renderer);
      infoRendu.appels = c + r.calls; infoRendu.triangles = t + r.triangles;
      return infoRendu;
    }
    var enCours = false, dernier = 0, fps = 0, fpsN = 0, fpsT = 0;
    var surImage = [];
    function boucle(now) {
      if (!enCours) return;
      // l'horodatage de la 1re image peut précéder performance.now() pris au démarrage : dt négatif → 0
      var dt = (now - dernier) / 1000; dernier = now;
      if (!(dt > 0)) dt = 0; else if (dt > 0.1) dt = 0.1;
      pas(dt);
      rendre();
      fpsN++; fpsT += dt; if (fpsT > 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
      for (var i = 0; i < surImage.length; i++) surImage[i](dt, etatCourant);
      requestAnimationFrame(boucle);
    }
    function demarrerBoucle() { if (enCours || auto) return; enCours = true; dernier = performance.now(); requestAnimationFrame(boucle); }

    // ── déroulé : quête accomplie dans le bunker → combat ──
    function lancerCombat(depuis) {
      afficherEchec(false);
      fini = false;
      if (audio) audio.stop(0.3);
      if (!depuis || depuis === 'introduction') {
        combat.allerA('inactif');
        var p = monde.points.bunker.arrivee[0];
        joueur.reapparaitre(p, p.lacet, 'bunker');
        placerBots('bunker');
        hud.toast('Quête principale accomplie : le sceau du Pacte s’éveille…', 3.5);
        setTimeout(function () { combat.demarrer(); }, auto ? 0 : 2200);
      } else {
        if (combat.etat().etat === 'inactif') combat.demarrer();
        combat.allerA(depuis);
        if (!joueur.vivant) { var l = combat.etat().lieu, q = l === 'bunker' ? monde.points.bunker.arrivee[0] : monde.points.salle.arrivee[0]; joueur.reapparaitre(q, q.lacet, l); }
      }
    }
    function placerBots(lieu) {
      bots.liste().forEach(function (b, i) { var p = monde.points[lieu].arrivee[(i + 1) % monde.points[lieu].arrivee.length]; jeu.teleporter(b.id, p, p.lacet, lieu); });
    }
    function reessayer() {
      var q = dernierePhase === 'absence' ? 'phase3' : dernierePhase;
      var l = q === 'phase5' ? 'bunker' : 'salle', p = monde.points[l].arrivee[0];
      joueur.reapparaitre(p, p.lacet, l);
      bots.liste().forEach(function (b, i) { var pp = monde.points[l].arrivee[(i + 1) % 4]; jeu.teleporter(b.id, pp, pp.lacet, l); });
      zombies.tuerTous('silencieux');
      afficherEchec(false);
      combat.allerA(q);
    }
    var ecranEchec = null;
    function afficherEchec(on) {
      if (!ecranEchec) {
        ecranEchec = document.createElement('div');
        ecranEchec.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(20,0,0,.62);text-align:center;color:#f2e2c8;font:15px/1.5 system-ui,sans-serif';
        ecranEchec.innerHTML = '<div><div style="font:500 64px/1 Teko,Oswald,sans-serif;letter-spacing:.04em;color:#ff7a5c">LE SEPTIÈME L’EMPORTE</div>' +
          '<p>Tous les joueurs sont tombés.</p><button data-r="phase">Réessayer la phase</button> <button data-r="tout">Recommencer le combat</button></div>';
        ecranEchec.querySelectorAll('button').forEach(function (b) {
          b.style.cssText = 'margin:6px;padding:9px 16px;font:600 14px system-ui,sans-serif;color:#fff;background:#5a1c14;border:1px solid #c0704a;cursor:pointer';
          b.addEventListener('click', function (ev) { ev.stopPropagation(); if (b.dataset.r === 'phase') reessayer(); else lancerCombat('introduction'); if (o.surReprise) o.surReprise(); });
        });
        document.body.appendChild(ecranEchec);
      }
      ecranEchec.style.display = on ? 'flex' : 'none';
      if (on && document.exitPointerLock) document.exitPointerLock();
    }

    root.addEventListener('resize', function () {
      if (W) return;
      renderer.setSize(root.innerWidth, root.innerHeight); camera.aspect = root.innerWidth / root.innerHeight; camera.updateProjectionMatrix();
    });

    var api = {
      THREE: THREE, renderer: renderer, camera: camera, monde: monde, joueur: joueur, arme: arme, zombies: zombies, bots: bots, jeu: jeu,
      combat: combat, modele: modele, fx: fx, hud: hud, audio: audio, evenements: evenements,
      pas: function (n, dt) { var e; for (var i = 0; i < (n || 1); i++) e = pas(dt || 1 / 60); rendre(); return e; },
      /** avance la simulation sans rendre l'image (tests rapides) */
      avancer: function (n, dt) { var e; for (var i = 0; i < (n || 1); i++) e = pas(dt || 1 / 60); return e; },
      rendre: rendre, temps: function () { return temps; }, etat: function () { return etatCourant; },
      fps: function () { return fps; }, info: function () { return infoRendu; },
      demarrerBoucle: demarrerBoucle, lancerCombat: lancerCombat, reessayer: reessayer,
      vitesse: function (v) { if (v != null) vitesseTemps = v; return vitesseTemps; },
      ajouterBot: function () {
        var n = bots.liste().length; if (n >= 3) return false;
        var l = joueur.lieu, p = monde.points[l].arrivee[(n + 1) % monde.points[l].arrivee.length];
        bots.ajouter({ id: 'bot' + (n + 1), lieu: l, position: p, lacet: p.lacet });
        return true;
      },
      retirerBot: function () { var l = bots.liste(); if (l.length) bots.retirer(l[l.length - 1].id); },
      /** coéquipiers simulés immortels (true/false) ; sans argument, renvoie l'état */
      botsImmortels: function (on) { return bots.immortels(on); },
      invincible: function (on) { invincibleDemande = !!on; joueur.definirInvulnerable(!!on); jeu.invulnerable = on ? function () {} : jeuInvulnerable; },
      surImage: function (fn) { surImage.push(fn); },
      bonusRamasses: bonusRamasses,
      fini: function () { return fini; }
    };
    var jeuInvulnerable = jeu.invulnerable;
    root.BOSS = api;
    return api;
  }

  var API = { lancer: lancer };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Boss = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
