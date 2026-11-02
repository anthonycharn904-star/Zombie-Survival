/*!
 * proto-adaptateur.js — Adaptateur `jeu` du prototype (contrat API.md §3) : relie la logique du boss au joueur,
 * aux coéquipiers simulés, aux zombies, à la navigation et aux systèmes simulés du jeu (inventaire limité à
 * 3 armes, atouts, bonus, points, manches, apparitions normales, drapeaux de sauvegarde). Tout est visible à
 * l'écran (panneau « Jeu ») pour vérifier les récompenses et les appels.
 *
 *   const jeu = ProtoB7Adaptateur.creer({ monde, joueur, arme, bots, zombies, arene, ui: true,
 *                                         surBonus(type, joueurId), zombiesCombat: { vitesse: 'sprint', agressif: true } });
 *   combat = BossB7Logique.creerCombat({ config, arene, jeu });
 *   jeu.mettreAJour(dt, temps)    // apparitions normales, bonus au sol (durée, ramassage), durées des bonus, panneau
 *   jeu.faireApparaitreBonus({ type, position, lieu, duree }) → true ; jeu.bonus() → bonus au sol (v1.1, API §13)
 *   chiens zombies (v1.2, API §14.3) : faireApparaitreZombie({ …, type: 'chien', profil }) ; zombies() porte `type` ;
 *   jeu.attaqueZombie(z, joueurId) : dégâts de l'attaque (z.degats = profil.degats des chiens, sinon jeu.degatsZombie) ;
 *   jeu.zombieTue(z, tueurId) : points (100 par chien, 60 par zombie) — à brancher sur surAttaque / surMort du module zombies.
 *   mini-boss (v1.3, API §15) : faireApparaitreZombie({ …, type: 'survolte' | 'irradie', miniBoss: true, nom, profil }) ;
 *   zombies() porte pv, pvMax, type, nom ; coup au contact via jeu.attaqueZombie (source 'contact', profil.degatsContact) ;
 *   dégâts des capacités (décharge, aura, flaque) appliqués ici par infligerDegats (sources 'decharge', 'aura', 'flaque'),
 *   branchés sur zombies.brancherDegats ; une décharge qui touche le joueur local lui brouille la vue (joueur.flou).
 *   500 points par mini-boss tué.
 *   v1.4 (API §16) : Le Démembré (type 'demembre', fléau : source 'fleau') ; dégâts des boules ('boule') et des zones radioactives
 *   ('zone') ; étourdissement des joueurs touchés par la décharge (info.etourdissement → joueur.etourdir / coéquipier.etourdir) ;
 *   jeu.tirerJoueur(id, position) : déplacement forcé (traction des crochets), joueur comme coéquipiers.
 *   v1.5 (API §17.1) : rages via jeu.effetZombie(id, 'surcharge' | 'arrachement' | 'infection', params) et entités irradiées
 *   (jeu.effetZombie(zid, 'irradie', { actif, aura, couleur })) — exécutées par le module zombies ; petits Démembrés
 *   (faireApparaitreZombie({ type: 'demembre_petit', effet: 'bras', … }) : ni mini-boss ni zombie, 100 points) ;
 *   retirerZombie(id, { effet: 'effondrement', points: false }) ; charge du Démembré : dégâts (source 'charge') et projection du
 *   joueur ou du coéquipier (e.projeter(vx, vz, duree)) ; un mur heurté pendant la projection → zombies.impactMur(id) (source
 *   'impactMur'). Les crochets surImpactMur du joueur et des coéquipiers sont posés ici.
 * Global : ProtoB7Adaptateur.
 */
(function (root) {
  'use strict';

  var ATOUTS = ['mastodonte', 'reanimation', 'cadence', 'sprint', 'recharge', 'vigueur'];
  var NOMS_ATOUTS = { mastodonte: 'Mastodonte (PV ×2,5)', reanimation: 'Réanimation', cadence: 'Cadence', sprint: 'Sprint prolongé', recharge: 'Recharge rapide', vigueur: 'Vigueur' };
  var DUREES_BONUS = { 'mort-instantanee': 30, 'points-doubles': 30, 'vente-flash': 30, 'machine-de-mort': 30 };

  function creer(o) {
    var monde = o.monde, joueur = o.joueur, arme = o.arme, bots = o.bots, zombies = o.zombies, arene = o.arene || root.BOSS_B7_ARENE;
    var jeu = {
      etat: {
        points: { }, inventaires: {}, atouts: {}, bonusActifs: {}, manchesSuspendues: false, drapeaux: {},
        apparitions: { actif: false, max: 0, intervalle: 2, lieu: 'salle', minuteur: 0 }, journal: []
      },
      degatsZombie: o.degatsZombie != null ? o.degatsZombie : 0.2
    };
    var E = jeu.etat;
    var invMax = o.inventaireMax || 3;
    // zombies du combat (v1.1) : vitesse et agressivité par défaut des apparitions normales
    var cfgZ = o.zombiesCombat || (o.config && o.config.zombies) || (root.BOSS_B7_CONFIG && root.BOSS_B7_CONFIG.zombies) || { vitesse: 'sprint', agressif: true };
    E.apparitions.vitesse = cfgZ.vitesse != null ? cfgZ.vitesse : 'sprint';
    E.apparitions.agressif = cfgZ.agressif != null ? !!cfgZ.agressif : true;
    var surBonus = o.surBonus || null;
    function armes() { var l = []; if (arme) l.push(arme); if (o.armes) for (var k in o.armes) if (o.armes[k] && l.indexOf(o.armes[k]) < 0) l.push(o.armes[k]); return l; }
    /** Chargeur et réserve pleins pour tous les joueurs (armes connues ; les coéquipiers simulés ont des munitions illimitées). */
    function munitionsMax() {
      armes().forEach(function (a) { if (a.remplirMunitions) a.remplirMunitions(); else a.munitions = a.reglages.chargeur; });
      if (bots) bots.liste().forEach(function (b) { if (b.munitions != null && b.chargeur != null) b.munitions = b.chargeur; if (b.reserveMax != null) b.reserve = b.reserveMax; });
    }
    function tous() { var l = [joueur]; if (bots) l = l.concat(bots.liste()); return l; }
    function entite(id) { if (joueur && joueur.id === id) return joueur; return bots ? bots.obtenir(id) : null; }
    function initJoueur(id) {
      if (!E.inventaires[id]) E.inventaires[id] = [{ id: 'fusil', pap: 0 }];
      if (!E.atouts[id]) E.atouts[id] = [];
      if (E.points[id] == null) E.points[id] = 500;
    }
    tous().forEach(function (e) { initJoueur(e.id); });
    function log(niveau, msg) {
      var ligne = { t: Date.now(), niveau: niveau, msg: msg };
      E.journal.push(ligne); if (E.journal.length > 60) E.journal.shift();
      if (niveau === 'erreur') console.error('[jeu] ' + msg); else if (niveau === 'avertissement') console.warn('[jeu] ' + msg);
      majPanneau();
    }

    // ── obligatoires ──
    var cacheJoueurs = [];
    jeu.joueurs = function () {
      cacheJoueurs.length = 0;
      cacheJoueurs.push(joueur.vue());
      if (bots) bots.liste().forEach(function (b) { initJoueur(b.id); cacheJoueurs.push(b.vue()); });
      return cacheJoueurs;
    };
    jeu.infligerDegats = function (id, fraction, opts) { var e = entite(id); return e ? e.infligerDegats(fraction, opts || {}) : 0; };
    jeu.blessureCritique = function (id, fr) { var e = entite(id); if (e) e.blessureCritique(fr); };
    jeu.teleporter = function (id, p, lacet, lieu) { var e = entite(id); if (e) e.teleporter(p, lacet, lieu); };
    jeu.controle = function (id, actif) { var e = entite(id); if (e) e.definirControle(actif); };
    jeu.invulnerable = function (id, actif) { var e = entite(id); if (e) e.definirInvulnerable(actif); };
    jeu.faireApparaitreZombie = function (p) {
      var MB = zombies.PROFILS_MB || {}, type = p.type === 'chien' ? 'chien' : MB[p.type] ? p.type : 'zombie';   // mini-boss : survolte, irradie, demembre ; v1.5 : demembre_petit
      var petit = type === 'demembre_petit';                                          // ni mini-boss ni zombie (§17.1)
      return zombies.apparaitre({ position: p.position, lieu: p.lieu || monde.lieuDe(p.position.x), effet: p.effet || 'normal', source: p.source || null, vitesse: p.vitesse, agressif: !!p.agressif,
        type: type, miniBoss: !petit && (!!p.miniBoss || !!MB[type]), nom: p.nom || null, profil: p.profil || null, pv: p.pv, pvMax: p.pvMax });
    };
    jeu.zombies = function () { return zombies.liste(); };
    jeu.effetZombie = function (id, effet, params) { return zombies.effet(id, effet, params); };
    jeu.retirerZombie = function (id, opts) {
      var z = zombies.obtenir(id);
      var r = zombies.retirer(id, opts || {});
      if (r && opts && opts.points && z && z.cible) ajouterPoints(joueur.id, pointsPour(z));
      return r;
    };
    /** Attaque d'un zombie, morsure d'un chien ou coup d'un mini-boss sur un joueur (rappel surAttaque du module zombies). */
    jeu.attaqueZombie = function (z, id) {
      var f = z && z.degats != null ? z.degats : jeu.degatsZombie;
      return jeu.infligerDegats(id, f, { source: z && z.miniBoss ? 'contact' : z && z.type === 'chien' ? 'chien' : 'zombie' });
    };
    function pointsPour(z) { return z && z.miniBoss ? 500 : z && (z.type === 'chien' || z.type === 'demembre_petit') ? 100 : 60; }
    /** Zombie, chien ou mini-boss tué par un joueur (rappel surMort) : 500 par mini-boss, 100 par chien ou petit Démembré, 60 par zombie. */
    jeu.zombieTue = function (z, tueur) { if (tueur) ajouterPoints(tueur, pointsPour(z)); };
    // dégâts des capacités des mini-boss (décharge, aura, flaque, boules, zones, fléau) : infligerDegats ; effets de la décharge :
    // vision brouillée du joueur local, étourdissement (joueur ou coéquipier). Renvoie false si les effets ne s'appliquent pas.
    if (zombies && zombies.brancherDegats) zombies.brancherDegats(function (z, id, fraction, source, info) {
      var e = entite(id);
      if (!e || !e.vivant) return false;
      var invul = e.estInvulnerable ? e.estInvulnerable() : false;
      jeu.infligerDegats(id, fraction, { source: source });
      if (invul) return false;
      if (source === 'decharge' && e === joueur && info && info.flou > 0 && joueur.flou) joueur.flou(info.flou);
      if (info && info.etourdissement > 0 && e.etourdir) e.etourdir(info.etourdissement);
      // v1.5 : charge du Démembré : projeté dans le sens de la charge (écarté vers l'extérieur), collisions comprises
      if (source === 'charge' && info && info.projection && info.projection.duree > 0 && e.projeter) e.projeter(info.projection.vx, info.projection.vz, info.projection.duree);
      return true;
    });
    // v1.5 : un joueur (ou un coéquipier) projeté qui heurte un mur de la salle → impactMur (dégâts en plus, rappel 'projection')
    if (zombies && zombies.impactMur) {
      if (joueur) joueur.surImpactMur = function (d) { zombies.impactMur(joueur.id, d); };
      if (bots) bots.surImpactMur = function (b, d) { zombies.impactMur(b.id, d); };
    }
    /** Mini-boss vivants (instantané pour l'interface du prototype) : [{ id, type, nom, pv, pvMax }]. */
    jeu.miniBoss = function () { return zombies.liste().filter(function (v) { return v.miniBoss; }).map(function (v) { return { id: v.id, type: v.type, nom: v.nom, pv: v.pv, pvMax: v.pvMax }; }); };
    // ── optionnelles ──
    jeu.regarder = function (id, point, duree) { var e = entite(id); if (e && e.regarder) e.regarder(point, duree); };
    /** v1.4 (§16.5, traction des crochets) : place le joueur (ou le coéquipier) à `position` sans résolution de collision ; vitesse remise à 0. */
    jeu.tirerJoueur = function (id, position) { var e = entite(id); return e && e.tirerVers ? e.tirerVers(position) : false; };
    jeu.chemin = function (a, b, lieu) { return monde.chemin(a, b, lieu); };
    jeu.positionValide = function (p, lieu) { return monde.positionValide(p, lieu); };
    jeu.visible = function (a, b, lieu) { return monde.visible(a, b, lieu); };
    jeu.apparitionsNormales = function (actif, p) {
      p = p || {};
      E.apparitions.actif = !!actif;
      if (p.max != null) E.apparitions.max = p.max;
      if (p.intervalle != null) E.apparitions.intervalle = p.intervalle;
      if (p.lieu) E.apparitions.lieu = p.lieu;
      if (p.vitesse != null) E.apparitions.vitesse = p.vitesse;
      if (p.agressif != null) E.apparitions.agressif = !!p.agressif;
      E.apparitions.minuteur = 0.5;
      log('info', 'apparitions normales ' + (actif ? 'actives (' + E.apparitions.lieu + ', max ' + E.apparitions.max + ')' : 'arrêtées'));
      return true;
    };
    jeu.suspendreManches = function (actif) { E.manchesSuspendues = !!actif; log('info', 'manches ' + (actif ? 'suspendues' : 'reprises')); };
    jeu.listeAtouts = function () { return ATOUTS.slice(); };
    jeu.donnerArme = function (id, armeId, p) {
      initJoueur(id);
      var inv = E.inventaires[id];
      for (var i = 0; i < inv.length; i++) if (inv[i].id === armeId) { inv[i].pap = Math.max(inv[i].pap, (p && p.pap) || 0); log('info', id + ' : ' + armeId + ' déjà possédée, améliorée'); return true; }
      if (inv.length >= invMax) { log('avertissement', id + ' : inventaire plein, ' + armeId + ' refusée'); return false; }
      inv.push({ id: armeId, pap: (p && p.pap) || 0 });
      if (id === joueur.id && arme && p && p.pap) arme.definirPap(p.pap);
      log('info', id + ' reçoit ' + armeId + ' (PaP ' + ((p && p.pap) || 0) + ')');
      return true;
    };
    jeu.donnerAtout = function (id, atout) {
      initJoueur(id);
      if (E.atouts[id].indexOf(atout) >= 0) return false;
      E.atouts[id].push(atout);
      var e = entite(id); if (e && e.donnerAtout) e.donnerAtout(atout); else if (e) { e.atouts = e.atouts || {}; e.atouts[atout] = true; }
      log('info', id + ' reçoit l’atout ' + atout);
      return true;
    };
    jeu.activerBonus = function (bonusId, p) {
      var t = (o.horloge ? o.horloge() : 0);
      if (DUREES_BONUS[bonusId]) E.bonusActifs[bonusId] = t + DUREES_BONUS[bonusId];
      if (bonusId === 'munitions-max') munitionsMax();
      if (bonusId === 'bombe-nucleaire') { zombies.tuerTous('cendres'); tous().forEach(function (e) { ajouterPoints(e.id, 400); }); }
      if (bonusId === 'points-bonus') tous().forEach(function (e) { ajouterPoints(e.id, 500); });
      if (bonusId === 'atout-gratuit') tous().forEach(function (e) { var libres = ATOUTS.filter(function (a) { return (E.atouts[e.id] || []).indexOf(a) < 0; }); if (libres.length) jeu.donnerAtout(e.id, libres[0]); });
      log('info', 'bonus activé : ' + bonusId + (p && p.joueur ? ' (par ' + p.joueur + ')' : ''));
    };
    var surAutel = [];
    jeu.deposerRecompense = function (r) {
      var obj = monde.autel.deposer(r);
      surAutel.push({ objet: obj, donnees: r });
      log('avertissement', 'récompense déposée sur l’autel : ' + r.id + (r.pap ? ' PaP ' + r.pap : '') + ' pour ' + (r.joueur || '?'));
      return obj;
    };
    /** Ramasser ce qui est sur l'autel (prototype : quand le joueur est proche et maintient l'interaction). */
    jeu.ramasserAutel = function (id) {
      var inv = E.inventaires[id];
      for (var i = 0; i < surAutel.length; i++) {
        var s = surAutel[i];
        if (s.donnees.joueur && s.donnees.joueur !== id) continue;
        if (inv.length >= invMax) inv.shift();        // échange avec l'arme la plus ancienne
        inv.push({ id: s.donnees.id, pap: s.donnees.pap || 0 });
        monde.autel.retirer(s.objet); surAutel.splice(i, 1);
        log('info', id + ' ramasse ' + s.donnees.id + ' sur l’autel');
        return true;
      }
      return false;
    };
    jeu.lireDrapeau = function (cle) {
      if (E.drapeaux[cle] != null) return E.drapeaux[cle];
      try { var v = root.localStorage && root.localStorage.getItem('protoB7:' + cle); if (v != null) return JSON.parse(v); } catch (e) { /* stockage indisponible */ }
      return false;
    };
    jeu.ecrireDrapeau = function (cle, v) {
      E.drapeaux[cle] = v;
      if (o.persisterDrapeaux) { try { root.localStorage.setItem('protoB7:' + cle, JSON.stringify(v)); } catch (e) { /* */ } }
      log('info', 'drapeau ' + cle + ' = ' + JSON.stringify(v));
    };
    jeu.pointsBunker = function (type) {
      var P = monde.points.bunker;
      return (P[type] || []).map(function (p) { return { x: p.x, y: p.y, z: p.z, lacet: p.lacet }; });
    };
    jeu.journal = function (niveau, msg) { log(niveau || 'info', msg); };

    // ── points, bonus actifs, apparitions normales ──
    function ajouterPoints(id, n) { initJoueur(id); var t = o.horloge ? o.horloge() : 0; E.points[id] += n * (E.bonusActifs['points-doubles'] > t ? 2 : 1); }
    jeu.ajouterPoints = ajouterPoints;
    jeu.mortInstantanee = function () { var t = o.horloge ? o.horloge() : 0; return E.bonusActifs['mort-instantanee'] > t; };
    var pointsUtilises = 0;
    jeu.mettreAJour = function (dt, temps) {
      var A = E.apparitions;
      if (A.actif) {
        A.minuteur -= dt;
        if (A.minuteur <= 0) {
          A.minuteur = A.intervalle;
          if (zombies.nombre(A.lieu, 'zombie') < A.max) {           // les chiens ne comptent pas dans le plafond
            var pts = A.lieu === 'salle' ? monde.points.salle.breches : monde.points.bunker.zombies;
            var js = jeu.joueurs().filter(function (j) { return j.vivant && j.lieu === A.lieu; });
            var cands = pts.filter(function (p) { return js.every(function (j) { return Math.hypot(j.position.x - p.x, j.position.z - p.z) > 7; }); });
            if (!cands.length) cands = pts;
            var p = cands[(pointsUtilises++) % cands.length];
            zombies.apparaitre({ position: { x: p.x, y: 0, z: p.z }, lieu: A.lieu, effet: A.lieu === 'salle' ? 'breche' : 'emergence', vitesse: A.vitesse, agressif: A.agressif });
          }
        }
      }
      for (var b in E.bonusActifs) if (E.bonusActifs[b] < temps) delete E.bonusActifs[b];
      majBonusAuSol(dt);
      panneauT -= dt; if (panneauT <= 0) { panneauT = 0.25; majPanneau(temps); }
    };

    // ── bonus au sol (v1.1, API §13) : apparaît, tourne, clignote les 5 dernières secondes, ramassé au contact ──
    var bonusAuSol = [], prochainBonus = 1, RAYON_RAMASSAGE = 1.5;
    jeu.faireApparaitreBonus = function (b) {
      if (!b || !b.position) return false;
      var lieu = b.lieu || monde.lieuDe(b.position.x), duree = b.duree != null ? +b.duree : 30, type = b.type || 'munitions-max';
      var e = { id: 'bonus' + (prochainBonus++), type: type, position: { x: b.position.x, y: b.position.y || 0, z: b.position.z }, lieu: lieu, duree: duree, restant: duree, visuel: null };
      e.visuel = monde.creerBonus ? monde.creerBonus({ id: e.id, type: type, position: e.position, lieu: lieu, duree: duree }) : null;
      bonusAuSol.push(e);
      log('info', 'bonus au sol : ' + type + ' (' + lieu + ', ' + duree + ' s)');
      return true;
    };
    /** Bonus au sol : [{ id, type, position, lieu, restant }]. */
    jeu.bonus = function () { return bonusAuSol.map(function (e) { return { id: e.id, type: e.type, position: { x: e.position.x, y: e.position.y, z: e.position.z }, lieu: e.lieu, restant: e.restant }; }); };
    function ramasseur(e) {
      if (joueur && joueur.vivant && joueur.lieu === e.lieu && Math.hypot(joueur.position.x - e.position.x, joueur.position.z - e.position.z) <= RAYON_RAMASSAGE) return joueur.id;
      if (bots) { var L = bots.liste(); for (var i = 0; i < L.length; i++) { var bt = L[i]; if (bt.vivant && bt.lieu === e.lieu && Math.hypot(bt.position.x - e.position.x, bt.position.z - e.position.z) <= RAYON_RAMASSAGE) return bt.id; } }
      return null;
    }
    function appliquerBonus(type, qui) {
      if (type === 'munitions-max') { munitionsMax(); log('info', 'bonus ramassé : munitions max (' + qui + ') — chargeurs et réserves pleins'); }
      else jeu.activerBonus(type, { joueur: qui });
      if (surBonus) { try { surBonus(type, qui); } catch (err) { log('erreur', 'surBonus : ' + (err && err.message ? err.message : err)); } }
    }
    function majBonusAuSol(dt) {
      for (var i = bonusAuSol.length - 1; i >= 0; i--) {
        var e = bonusAuSol[i];
        e.restant -= dt;
        if (e.visuel) e.visuel.restant = e.restant;
        var qui = e.restant > 0 ? ramasseur(e) : null;
        if (qui) { bonusAuSol.splice(i, 1); if (e.visuel) e.visuel.ramasser(); appliquerBonus(e.type, qui); }
        else if (e.restant <= 0) { bonusAuSol.splice(i, 1); if (e.visuel) e.visuel.retirer(); log('info', 'bonus expiré : ' + e.type); }
      }
    }

    // ── panneau « Jeu » (inventaires, atouts, bonus, points, journal) ──
    var panneau = null, panneauT = 0;
    if (o.ui !== false && typeof document !== 'undefined') {
      panneau = document.createElement('div');
      panneau.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;max-width:420px;font:12px/1.4 ui-monospace,Consolas,monospace;color:#e8e2d4;' +
        'background:rgba(10,8,8,.72);border:1px solid rgba(255,255,255,.12);padding:8px 10px;pointer-events:none;white-space:pre-wrap';
      (o.conteneur || document.body).appendChild(panneau);
    }
    function majPanneau(temps) {
      if (!panneau) return;
      var t = temps != null ? temps : (o.horloge ? o.horloge() : 0);
      var lignes = [];
      tous().forEach(function (e) {
        initJoueur(e.id);
        lignes.push(e.id + '  PV ' + Math.round(e.pv) + '/' + e.pvMax + '  points ' + E.points[e.id] + (e.vivant ? '' : '  (mort)'));
        lignes.push('  armes : ' + E.inventaires[e.id].map(function (a) { return a.id + (a.pap ? ' PaP' + a.pap : ''); }).join(', '));
        if (E.atouts[e.id].length) lignes.push('  atouts : ' + E.atouts[e.id].join(', '));
      });
      if (arme) lignes.push('munitions : ' + arme.munitions + ' / ' + (isFinite(arme.reserve) ? arme.reserve : '∞') + (arme.enRechargement ? ' (recharge)' : ''));
      if (bonusAuSol && bonusAuSol.length) lignes.push('au sol : ' + bonusAuSol.map(function (e) { return e.type + ' ' + Math.max(0, Math.ceil(e.restant)) + ' s'; }).join(', '));
      var bon = Object.keys(E.bonusActifs).map(function (b) { return b + ' ' + Math.max(0, Math.ceil(E.bonusActifs[b] - t)) + ' s'; });
      if (bon.length) lignes.push('bonus : ' + bon.join(', '));
      lignes.push('manches : ' + (E.manchesSuspendues ? 'suspendues' : 'actives') + '   apparitions : ' + (E.apparitions.actif ? 'oui (' + E.apparitions.lieu + ')' : 'non') + '   zombies : ' + zombies.nombre(null, 'zombie') + '   chiens : ' + zombies.nombre(null, 'chien'));
      zombies.liste().forEach(function (v) { if (v.miniBoss) lignes.push((v.nom || v.type) + ' : ' + Math.ceil(v.pv) + ' / ' + Math.ceil(v.pvMax) + ' PV'); });
      if (surAutel.length) lignes.push('autel : ' + surAutel.map(function (s) { return s.donnees.id; }).join(', '));
      var j = E.journal.slice(-6).map(function (l) { return (l.niveau === 'avertissement' ? '! ' : '· ') + l.msg; });
      panneau.textContent = lignes.concat(j).join('\n');
    }
    jeu.panneau = panneau;
    jeu.surAutel = surAutel;
    return jeu;
  }

  var API = { creer: creer, ATOUTS: ATOUTS, NOMS_ATOUTS: NOMS_ATOUTS };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Adaptateur = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
