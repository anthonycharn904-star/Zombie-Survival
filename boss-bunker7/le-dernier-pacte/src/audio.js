/*!
 * audio.js — Boss de Bunker 7 (« Le Septième ») : musique par phase et effets sonores (Web Audio).
 * Contrat : API.md §10. Lit le manifeste de audio/out/manifest.json (133 sons, tous synthétisés).
 * v1.3 (API.md §15.6) : cuves siphonnées, arrivée et mort des mini-boss, leurs boucles (bourdon du Survolté, compteur
 * Geiger et râle de l'Irradié), flaque toxique ; capacités signalées par le jeu via sonMiniBoss(type, quoi, position, options).
 * v1.4 (API.md §16.8) : Le Démembré (cri, râle et pas boiteux en boucle, fléau, impact, mort), boules et zones radioactives de
 * l'Irradié, étourdissement du Survolté (chez le joueur étourdi), paliers de la phase 5, crochets (lancer, accroche, traction, raté).
 * v1.5 (API.md §17.5) : surcharge du Survolté et murs électrifiés (une boucle par mur, éclairs, chocs, extinction), infection
 * (onde, grésillement sur les entités irradiées les plus proches si ctx.positionZombie est fourni), arrachement du bras, bras posé
 * (palpitation), petits Démembrés (sortie, effondrement), charge du géant (élan, percussion, joueur projeté contre un mur),
 * intangibilité de la phase 5 (évanouissement, présence invisible en boucle, traversées des murs, resurgissement). Illusions retirées.
 * Branché sur les évènements de la logique (BossB7Logique) : enchaînements musicaux calés à l'échantillon
 * (répit 15,0 s → phase 2 ; absence 30,0 s → retour en rage), couches qui suivent la capture du rituel et la
 * distance du boss, effets positionnels (gain selon la distance, panoramique selon l'orientation du joueur).
 * Script classique → globalThis.BossB7Audio ; CommonJS → module.exports. Aucune dépendance.
 */
(function (root) {
  'use strict';
  var VERSION = '1.5.0';

  // Étapes d'action du boss → son (vocalises et gestes). Les évènements physiques ont leur propre table.
  var SONS_ACTIONS = {
    'apparition/formation': { cle: 'boss_apparition', plein: true },
    'invocation/preparation': { cle: 'incantation_charge' },
    'invocation/lancer': { cle: 'incantation_lancer' },
    'trait/preparation': { cle: 'incantation_charge', vitesse: 1.35, volume: 0.8 },
    'trait/lancer': { cle: 'trait_maudit' },
    'souffrance/souffrance': { cle: 'boss_douleur_1' },
    'souffrance/colere': { cle: 'boss_rugissement' },
    'transformation_ailes/rugissement': { cle: 'boss_rugissement' },
    'pique/visee': { cle: 'pique_alerte', volume: 1.15 },
    'pique/charge': { cle: 'pique_charge' },
    'effondrement/souffrance': { cle: 'boss_douleur_2' },
    'retour_rage/rugissement': { cle: 'boss_rugissement', volume: 0.9 },
    'onde_choc/preparation': { cle: 'incantation_charge', vitesse: 0.75 },
    'faiblesse/chute': { cle: 'boss_faible' },
    'frappe/preparation': { cle: 'frappe_preparation', volume: 1.15 },
    'frappe_ordinaire/preparation': { cle: 'lame_mouvement_1' },
    'frappe_ordinaire/frappe': { cle: 'lame_mouvement_2' },
    'defaite/chancelle': { cle: 'boss_douleur_1', vitesse: 0.85 },
    'siphon/approche': { cle: 'absorption_debut', vitesse: 0.9 }        // v1.3 : il tend les bras vers la cuve
  };
  // v1.3 : sons propres à chaque mini-boss (API.md §15.6)
  var SONS_MB = {
    survolte: { cri: 'survolte_cri', mort: 'survolte_mort', boucles: [{ cle: 'survolte_bourdon', nom: 'bourdon', volume: 0.95, ref: 3, portee: 26 }] },
    irradie: { cri: 'irradie_cri', mort: 'irradie_mort', boucles: [{ cle: 'irradie_geiger', nom: 'geiger', volume: 0.6, ref: 3, portee: 22 },
      { cle: 'irradie_rale', nom: 'rale', volume: 0.85, ref: 3, portee: 22 }] },
    demembre: { cri: 'demembre_cri', mort: 'demembre_mort', boucles: [{ cle: 'demembre_rale', nom: 'rale', volume: 0.9, ref: 3, portee: 24 }] }   // v1.4
  };
  var SONS_PALIER = { 1: 'palier_lames_rouges', 2: 'palier_intangible', 3: 'palier_crochets' };   // v1.4 (stéréo) ; v1.5 : palier 2 = intangibilité
  var SONS_RAGE = { surcharge: 'survolte_surcharge', infection: 'irradie_cri', arrachement: 'demembre_arrachement' };   // v1.5 : rages des mini-boss
  // États de la logique qui se passent dans la salle secrète (ambiance de la salle)
  var ETATS_SALLE = { introduction: 1, phase1: 1, repit: 1, phase2: 1, transition23: 1, absence: 1, retour: 1, phase3: 1,
    transition34: 1, rituel: 1, rituel_fin: 1, faiblesse: 1, transition45: 1, retour_salle: 1, conclusion: 1, recompenses: 1, message: 1 };

  function creer(o) {
    o = o || {};
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!o.context && !AC) throw new Error('BossB7Audio : Web Audio indisponible');
    var ctx = o.context || new AC();
    var ctxPropre = !o.context;
    var M = o.manifeste || {};
    var base = o.base == null ? '' : String(o.base);
    var sons = o.sons || {};
    var C = o.config || root.BOSS_B7_CONFIG || {};
    var A = o.arene || root.BOSS_B7_ARENE || null;
    var rituelPos = A ? { x: A.salle.origine.x + A.salle.cercle.x, y: A.salle.origine.y + 0.5, z: A.salle.origine.z + A.salle.cercle.z } : { x: 0, y: 0.5, z: 0 };
    // v1.1 : musique 1,4 (≈ +4,3 dB par rapport à la v1.0, 0,85) pour une immersion totale ; le limiteur final évite toute saturation
    var vol = { general: 1, musique: 1.4, effets: 1, ambiance: 0.7 };
    if (o.volumes) for (var vk in o.volumes) if (vk in vol) vol[vk] = Math.max(0, +o.volumes[vk] || 0);

    // ── graphe : bus → filtre maître (étouffement) → compresseur doux → limiteur → sortie ──
    var maitre = ctx.createGain(), filtre = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), limiteur = ctx.createDynamicsCompressor();
    filtre.type = 'lowpass'; filtre.frequency.value = 20000; filtre.Q.value = 0.7;
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    limiteur.threshold.value = -1.5; limiteur.knee.value = 0; limiteur.ratio.value = 20; limiteur.attack.value = 0.001; limiteur.release.value = 0.08;
    maitre.connect(filtre); filtre.connect(comp); comp.connect(limiteur); limiteur.connect(o.destination || ctx.destination);
    var bus = { musique: ctx.createGain(), effets: ctx.createGain(), ambiance: ctx.createGain(), cinema: ctx.createGain() };
    for (var bk in bus) if (bk !== 'cinema') bus[bk].connect(maitre);
    bus.cinema.connect(comp);                // séquences plein écran déjà étouffées : hors du filtre maître
    function appliquerVolumes() {
      maitre.gain.value = vol.general; bus.musique.gain.value = vol.musique; bus.effets.gain.value = vol.effets; bus.ambiance.gain.value = vol.ambiance;
      bus.cinema.gain.value = vol.general * vol.effets;
    }
    appliquerVolumes();

    var tampons = {}, chargement = null, detruit = false, debranchements = [];
    var auditeur = { position: { x: 0, y: 1.6, z: 0 }, lacet: 0, lieu: 'salle' };
    var etatCourant = null, joueurLocal = null;
    var actifs = [];                         // poignées positionnelles à mettre à jour
    var parCle = {};                         // poignées nommées (boucles suivies : projectile:id, zone:id, bloc:id…)
    var musiques = { base: null, couche: null, cleBase: null };
    var programmes = [];                     // { t (horloge audio), fn }
    var dernierImpact = 0, dernierImmunise = 0, prochainBattement = 0, prochaineGoutte = 0, obscuriteJouee = false;
    var etatLogique = 'inactif';

    function avertir(m) { if (typeof console !== 'undefined' && console.warn) console.warn('BossB7Audio : ' + m); }
    function maintenant() { return ctx.currentTime; }

    // ── chargement ──
    function decoder(arr) {
      return new Promise(function (res, rej) { var p = ctx.decodeAudioData(arr, res, rej); if (p && p.then) p.then(res, rej); });
    }
    function charger(cle) {
      var src = sons[cle], p;
      if (src != null && typeof src !== 'string') p = Promise.resolve(src.slice ? src.slice(0) : src);
      else {
        var url = src != null ? src : base + (M[cle] && M[cle].fichier);
        p = fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' : HTTP ' + r.status); return r.arrayBuffer(); });
      }
      return p.then(decoder).then(function (b) { tampons[cle] = b; return b; });
    }

    // ── lecture ──
    function positionDe(h) { return typeof h.position === 'function' ? h.position() : h.position; }
    function spatialiser(h, immediat) {
      var p = positionDe(h);
      if (!p || h.plein) return;
      var lieuOk = !h.lieu || h.lieu === auditeur.lieu;
      var dx = p.x - auditeur.position.x, dy = (p.y || 0) - auditeur.position.y, dz = p.z - auditeur.position.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var ref = h.ref || 3, portee = h.portee || 45;
      var g = d <= ref ? 1 : ref / (ref + 1.0 * (d - ref));
      if (d > portee) g *= Math.max(0, 1 - (d - portee) / 10);
      if (!lieuOk) g = 0;
      var rx = -Math.cos(auditeur.lacet), rz = Math.sin(auditeur.lacet);
      var pan = d > 0.3 ? (dx * rx + dz * rz) / Math.max(0.001, Math.sqrt(dx * dx + dz * dz)) : 0;
      var cible = g * h.volume;
      if (immediat) h.gain.gain.value = cible;
      else h.gain.gain.setTargetAtTime(cible, maintenant(), 0.05);
      if (h.pan) h.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan * 0.85)), maintenant(), 0.05);
    }
    /** Joue un son. opts : position ({x,y,z} ou fonction), lieu, volume, vitesse, bus, quand, plein (non positionnel),
     *  boucle (défaut : manifeste), fondu (entrée, s). Renvoie une poignée { stop(fondu), volume(v), vitesse(r) } ou null. */
    function jouer(cle, opts) {
      opts = opts || {};
      var b = tampons[cle], m = M[cle];
      if (!b || !m || detruit) return null;
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b;
      var boucle = opts.boucle != null ? opts.boucle : !!m.boucle;
      if (boucle) {
        src.loop = true;
        src.loopStart = m.boucleDebut != null ? m.boucleDebut : 0;
        src.loopEnd = m.boucleFin != null ? m.boucleFin : b.duration;
      }
      if (opts.vitesse) src.playbackRate.value = opts.vitesse;
      var plein = opts.plein != null ? opts.plein : (m.stereo || !opts.position);
      var pan = null;
      src.connect(g);
      if (!plein && ctx.createStereoPanner) { pan = ctx.createStereoPanner(); g.connect(pan); pan.connect(bus[opts.bus || 'effets']); }
      else g.connect(bus[opts.bus || (m.categorie === 'musique' ? 'musique' : m.categorie === 'ambiance' ? 'ambiance' : 'effets')]);
      var t0 = Math.max(maintenant(), opts.quand || 0);
      var h = { cle: cle, source: src, gain: g, pan: pan, position: opts.position || null, lieu: opts.lieu || null, plein: plein,
        volume: opts.volume != null ? opts.volume : 1, ref: opts.ref, portee: opts.portee, debut: t0, arrete: false };
      if (plein) {
        if (opts.fondu) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(h.volume, t0 + opts.fondu); }
        else g.gain.value = h.volume;
      } else spatialiser(h, true);
      var depart = boucle ? (m.boucleDebut || 0) : 0;
      src.start(t0, depart + (opts.decalage || 0));
      h.stop = function (fondu) {
        if (h.arrete) return; h.arrete = true;
        var f = fondu == null ? 0.15 : fondu, now = maintenant(), v = g.gain.value;
        g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(v, now); g.gain.linearRampToValueAtTime(0, now + f + 0.01);
        try { src.stop(now + f + 0.05); } catch (e) { /* déjà arrêtée */ }
      };
      h.volumeCible = function (v, tau) { h.volume = v; if (h.plein) g.gain.setTargetAtTime(v, maintenant(), tau || 0.1); };
      h.vitesse = function (r) { src.playbackRate.setTargetAtTime(r, maintenant(), 0.08); };
      src.onended = function () {
        h.arrete = true;
        try { g.disconnect(); if (pan) pan.disconnect(); } catch (e) { /* */ }
        var i = actifs.indexOf(h); if (i >= 0) actifs.splice(i, 1);
      };
      if (!plein) actifs.push(h);
      return h;
    }
    function nomme(nom, h) { if (parCle[nom] && parCle[nom] !== h) parCle[nom].stop(0.2); if (h) parCle[nom] = h; else delete parCle[nom]; return h; }
    function arreterNomme(nom, fondu) { if (parCle[nom]) { parCle[nom].stop(fondu); delete parCle[nom]; } }
    function plus(t, fn) { programmes.push({ t: t, fn: fn }); }

    // ── musique ──
    function musique(cle, opts) {
      opts = opts || {};
      var quand = opts.quand || maintenant();
      if (musiques.base && musiques.cleBase === cle && !opts.relancer) return musiques.base;
      arreterMusique(opts.fonduSortie != null ? opts.fonduSortie : 1.2, quand);
      var h = jouer(cle, { bus: 'musique', plein: true, quand: quand, fondu: opts.fondu || 0, volume: opts.volume != null ? opts.volume : 1 });
      musiques.base = h; musiques.cleBase = cle; musiques.couche = null;
      if (opts.couche) musiques.couche = jouer(opts.couche, { bus: 'musique', plein: true, quand: quand, volume: 0 });
      return h;
    }
    function arreterMusique(fondu, quand) {
      var f = fondu == null ? 1.2 : fondu;
      [musiques.base, musiques.couche].forEach(function (h) {
        if (!h) return;
        if (quand && quand > maintenant() + 0.01) plus(quand, function () { h.stop(f); });
        else h.stop(f);
      });
      musiques.base = null; musiques.couche = null; musiques.cleBase = null;
    }
    function etouffer(actif, duree) {
      var now = maintenant(), f = filtre.frequency;
      f.cancelScheduledValues(now); f.setValueAtTime(f.value, now);
      f.exponentialRampToValueAtTime(actif ? 520 : 20000, now + (duree || 1.5));
    }
    function ambiance(cle) {
      if (parCle.ambiance && parCle.ambiance.cle === cle) return;
      arreterNomme('ambiance', 2.0);
      if (cle) nomme('ambiance', jouer(cle, { bus: 'ambiance', plein: true, fondu: 2.0, volume: 1 }));
    }

    // ── états de la logique → musique ──
    function changerEtat(de, vers) {
      etatLogique = vers;
      var now = maintenant(), I = C.introduction || {};
      if (ETATS_SALLE[vers] && vers !== 'transition45') ambiance('amb_salle');
      switch (vers) {
        case 'introduction':
          jouer('intro_transition', { plein: true });
          arreterMusique(0.8);
          musique('mus_intro', { quand: now + (I.fondu || 1.4) });
          break;
        case 'phase1': musique('mus_phase1', { fonduSortie: 4.0 }); break;
        case 'repit':
          musique('mus_repit', { fonduSortie: 1.0 });
          // le temps 1 de la phase 2 tombe pile à la fin du répit (15,0 s)
          var tRepit = now + ((C.repit && C.repit.duree) || 15);
          plus(tRepit - 0.05, function () { if (etatLogique === 'repit' || etatLogique === 'phase2') musique('mus_phase2', { quand: tRepit, fonduSortie: 0.05 }); });
          break;
        case 'phase2': if (musiques.cleBase !== 'mus_phase2') musique('mus_phase2', { fonduSortie: 0.3 }); break;
        case 'transition23': case 'transition34': arreterMusique(1.8); break;
        case 'absence':
          musique('mus_absence', { fonduSortie: 0.5 });
          var tAbs = now + ((C.absence && C.absence.duree) || 30);
          plus(tAbs - 0.05, function () { if (etatLogique === 'absence' || etatLogique === 'retour') jouer('retour_rage', { plein: true, quand: tAbs }); });
          break;
        case 'phase3': musique('mus_phase3', { fonduSortie: 0.6 }); break;
        case 'rituel': musique('mus_rituel', { couche: 'mus_rituel_tension', fonduSortie: 1.0 }); break;
        case 'rituel_fin': arreterMusique(0.8); break;
        case 'faiblesse': musique('mus_faiblesse', { fondu: 0.5 }); break;
        case 'transition45': arreterMusique(2.0); ambiance(null); etouffer(true, 2.2); break;
        case 'phase5':
          etouffer(false, 1.2);
          musique('mus_phase5', { couche: 'mus_phase5_traque', fondu: 2.5 });
          ambiance('amb_bunker_sombre');
          nomme('proche', jouer('boss_proche', { position: function () { return etatCourant && etatCourant.boss.position; }, lieu: 'bunker', volume: 0, ref: 4, portee: 30 }));
          break;
        case 'defaite':
          arreterMusique(0.6); arreterNomme('proche', 0.5); arreterNomme('critique', 0.5);
          musique('mus_defaite', { fonduSortie: 0.6 });
          break;
        case 'retour_salle': etouffer(false, 0.5); break;
        case 'recompenses':
          musique('mus_victoire', { fonduSortie: 1.5 });
          jouer('recompense', { plein: true });
          break;
        case 'termine': arreterMusique(5.0); ambiance(null); break;
        case 'echec': case 'inactif': toutArreter(1.5); break;
      }
    }

    // ── évènements → effets ──
    function posBoss() { return etatCourant && etatCourant.boss && etatCourant.boss.position; }
    function lieuBoss() { return etatCourant && etatCourant.boss ? etatCourant.boss.lieu : null; }
    function trouve(liste, id) { if (!liste) return null; for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i]; return null; }
    var gestionnaires = {
      etat: function (e) { changerEtat(e.de, e.vers); },
      action: function (e) {
        var s = SONS_ACTIONS[e.id + '/' + e.etape];
        if (!s) return;
        jouer(s.cle, { position: posBoss, lieu: lieuBoss(), plein: !!s.plein, volume: s.volume, vitesse: s.vitesse, ref: 5 });
      },
      degats: function (e) {
        var now = maintenant();
        if (now - dernierImpact < 0.07) return;
        dernierImpact = now;
        jouer('boss_impact_balle', { position: e.position || posBoss(), lieu: lieuBoss(), volume: 0.9, vitesse: 0.92 + Math.random() * 0.16 });
      },
      immunise: function (e) {
        var now = maintenant();
        if (now - dernierImmunise < 0.15) return;
        dernierImmunise = now;
        jouer('boss_immunise', { position: e.position || posBoss(), lieu: lieuBoss(), vitesse: 0.95 + Math.random() * 0.1 });
      },
      projectile: function (e) {
        if (e.type !== 'invocation') return;
        var id = e.id;
        nomme('projectile:' + id, jouer('projectile_boucle', { position: function () { var p = trouve(etatCourant && etatCourant.projectiles, id); return p ? p.position : e.position; }, lieu: 'salle', volume: 0.8 }));
      },
      projectileImpact: function (e) {
        arreterNomme('projectile:' + e.id, 0.05);
        jouer(e.type === 'trait' ? 'impact_magique' : 'impact_magique', { position: e.position, lieu: 'salle', volume: e.type === 'trait' ? 0.7 : 1, vitesse: e.type === 'trait' ? 1.2 : 1 });
      },
      zone: function (e) { nomme('zone:' + e.id, jouer('zone_maudite', { position: e.position, lieu: 'salle', volume: 0.75, fondu: 0.3 })); },
      zoneFin: function (e) { arreterNomme('zone:' + e.id, 0.6); },
      invocation: function (e) { jouer('zombie_emergence', { position: e.position, lieu: lieuBoss() || 'salle', vitesse: 0.9 + Math.random() * 0.2 }); },
      absorption: function (e) { if (e.etat === 'debut') jouer('absorption_debut', { position: posBoss, lieu: lieuBoss(), ref: 6 }); },
      ameExtraite: function (e) { jouer('ame_extraction', { position: e.position, lieu: lieuBoss(), vitesse: 0.9 + Math.random() * 0.25 }); },
      ameAbsorbee: function () { jouer('ame_arrivee', { position: posBoss, lieu: lieuBoss(), volume: 1.1, ref: 6 }); },
      ailes: function (e) {
        if (e.etat === 'apparition') jouer('ailes_deploiement', { position: posBoss, lieu: lieuBoss(), ref: 8 });
        else if (e.etat === 'dissipation') jouer('ailes_dissipation', { position: posBoss, lieu: lieuBoss(), ref: 6 });
      },
      piqueImpact: function (e) { jouer('pique_impact', { position: e.position, lieu: lieuBoss(), ref: 8 }); },
      teleport: function (e) {
        jouer(e.sens === 'depart' ? 'teleport_depart' : 'teleport_arrivee', { position: e.position, lieu: e.lieu, ref: 8, portee: 60 });
      },
      zombiesCendres: function () { jouer('zombies_cendres', { plein: true }); },
      bloc: function (e) {
        var nom = 'bloc:' + e.id;
        if (e.etat === 'fissure') jouer('mur_fissure', { position: e.position, lieu: 'salle', ref: 6 });
        else if (e.etat === 'arrache') { jouer('mur_arrachement', { position: e.position, lieu: 'salle', ref: 7 }); }
        else if (e.etat === 'levitation') nomme(nom, jouer('bloc_levitation', { position: function () { var b = trouve(etatCourant && etatCourant.blocs, e.id); return b && b.position ? b.position : e.position; }, lieu: 'salle', ref: 6 }));
        else if (e.etat === 'vol') { arreterNomme(nom, 0.2); jouer('bloc_lancer', { position: e.position, lieu: 'salle', ref: 7 }); }
        else if (e.etat === 'reconstruction') { arreterNomme(nom, 0.2); jouer('bloc_reconstruction', { position: e.position, lieu: 'salle', volume: 0.7 }); }
        else arreterNomme(nom, 0.3);
      },
      blocImpact: function (e) { arreterNomme('bloc:' + e.id, 0.05); jouer('bloc_impact', { position: e.position, lieu: 'salle', ref: 9, portee: 60 }); },
      ondeChoc: function (e) { jouer('onde_choc', { position: e.position, lieu: lieuBoss(), ref: 8 }); },
      rituel: function (e) {
        var cercle = function () { return rituelPos; };
        if (e.etat === 'formation') jouer('rituel_apparition', { plein: true });
        else if (e.etat === 'actif') nomme('rituel', jouer('rituel_boucle', { position: cercle, lieu: 'salle', ref: 7, fondu: 0.5, volume: 0.9 }));
        else if (e.etat === 'fin') { arreterNomme('rituel', 0.6); jouer('rituel_fin', { plein: true }); }
      },
      capture: function (e) {
        if (e.etat === 'conteste') jouer('rituel_conteste', { plein: true, volume: 0.8 });
        else if (e.etat === 'recul' || e.etat === 'reinitialisation') jouer('rituel_recul', { plein: true, volume: 0.8 });
      },
      cinematique: function (e) {
        if (e.nom === 'capture_ames' && e.actif) jouer('capture_ames', { plein: true, bus: 'cinema' });
      },
      obscurite: function (e) { if (e.intensite > 0.3 && !obscuriteJouee) { obscuriteJouee = true; jouer('obscurite', { plein: true }); } if (e.intensite === 0) obscuriteJouee = false; },
      lames: function (e) {
        if (e.etat === 'formation') jouer('lames_apparition', { position: posBoss, lieu: lieuBoss(), ref: 6 });
        else if (e.etat === 'desintegration') jouer('lames_desintegration', { position: posBoss, lieu: lieuBoss(), ref: 6 });
      },
      frappe: function (e) { jouer(e.reussie ? 'frappe_impact' : 'frappe_ratee', { position: posBoss, lieu: lieuBoss(), ref: 6, volume: 1.1 }); },
      critique: function (e) {
        if (e.joueur !== joueurLocal) return;
        if (e.actif) nomme('critique', jouer('etat_critique', { plein: true, bus: 'effets', volume: 0.9 }));
        else arreterNomme('critique', 0.6);
      },
      defaite: function () { jouer('boss_defaite', { plein: true }); },
      interaction: function (e) {
        if (e.etat === 'progression') nomme('interaction', jouer('interaction_maintien', { plein: true, volume: 0.7 }));
        else if (e.etat === 'terminee') arreterNomme('interaction', 0.2);
      },
      recompense: function (e) {
        if (e.joueur !== joueurLocal) return;
        var now = maintenant(), t = Math.max(now, dernierRecompense + 0.22);
        dernierRecompense = t;
        jouer('recompense_objet', { plein: true, quand: t, volume: 0.85 });
      },
      message: function () { jouer('message_final', { plein: true }); },
      // v1.1 : piliers de la Chambre du Pacte (3 blocs → effondrement)
      pilier: function (e) {
        var p = e.pointImpact || e.position;
        if (e.etat === 'touche') {
          jouer('mur_fissure', { position: p, lieu: 'salle', ref: 7, volume: 1.0, vitesse: 0.82 + Math.random() * 0.08 });
        } else if (e.etat === 'detruit') {
          var c = e.position || p, t = maintenant();
          jouer('mur_arrachement', { position: c, lieu: 'salle', ref: 10, portee: 70, volume: 1.15, vitesse: 0.68 });
          jouer('bloc_impact', { position: c, lieu: 'salle', ref: 10, portee: 70, volume: 1.0, vitesse: 0.62, quand: t + 0.28 });
          jouer('onde_choc', { position: c, lieu: 'salle', ref: 9, portee: 70, volume: 0.7, vitesse: 0.78, quand: t + 0.55 });
          jouer('bloc_reconstruction', { position: c, lieu: 'salle', ref: 6, volume: 0.55, vitesse: 0.7, quand: t + 1.1 });   // gravats qui retombent
        }
      },
      // v1.1 : « Munitions max » posé à la fin d'une phase (l'annonce vocale se joue au ramassage : annoncerBonus)
      bonus: function (e) {
        if (e.mode === 'depose' && e.position) {
          jouer('recompense_objet', { position: e.position, lieu: e.lieu, ref: 6, portee: 40, volume: 1.4 });
          jouer('recompense_objet', { position: e.position, lieu: e.lieu, ref: 6, portee: 40, volume: 1.0, vitesse: 0.75, quand: maintenant() + 0.16 });
        }
      },
      // v1.3 : cuves siphonnées, mini-boss libérés et abattus (API.md §15)
      tube: function (e) {
        var p = e.position ? { x: e.position.x, y: (e.position.y || 0) + 1.3, z: e.position.z } : null;
        if (!p) return;
        if (e.etat === 'siphon') nomme('tube:' + e.id, jouer('tube_siphon', { position: p, lieu: 'salle', ref: 6, portee: 55 }));
        else if (e.etat === 'fissure') jouer('tube_fissure', { position: p, lieu: 'salle', ref: 6, portee: 55 });
        else if (e.etat === 'eclate') { arreterNomme('tube:' + e.id, 0.08); jouer('tube_eclatement', { position: p, lieu: 'salle', ref: 9, portee: 70, volume: 1.1 }); }
      },
      miniBoss: function (e) {
        var S = SONS_MB[e.type], p = e.position ? { x: e.position.x, y: (e.position.y || 0) + 1.5, z: e.position.z } : null;
        if (!S) return;
        if (e.etat === 'rage') {                          // v1.5 : rage à la moitié de ses PV
          var cr = SONS_RAGE[e.capacite];
          if (cr && p) jouer(cr, { position: p, lieu: e.lieu || 'salle', ref: 6, portee: 60, volume: e.capacite === 'infection' ? 1.1 : 1.0 });
          if (e.capacite === 'surcharge') { var bo = parCle['mb:' + e.id + ':bourdon']; if (bo) { var vb = bo.volume; bo.volume = vb * 0.5; plus(maintenant() + 2.5, function () { bo.volume = vb; }); } }   // bourdon −6 dB pendant la surcharge
          return;
        }
        if (e.etat === 'libere') {
          jouer('miniboss_apparition', { plein: true, volume: 0.95 });
          if (p) jouer(S.cri, { position: p, lieu: e.lieu || 'salle', ref: 6, portee: 60, quand: maintenant() + 0.2 });
        } else if (e.etat === 'mort') {
          arreterBouclesMb(e.id, e.type === 'irradie' ? 0.3 : 0.1);
          if (p) jouer(S.mort, { position: p, lieu: e.lieu || 'salle', ref: 6, portee: 50 });
          if (e.type === 'irradie' && p) flaque(p, e.lieu || 'salle', null);     // la flaque toxique s'étend sous le cadavre
          if (e.type === 'irradie') arreterZones(1.5);                            // v1.4 : ses zones radioactives s'éteignent avec lui
        }
      },
      protection: function (e) {
        if (e.actif === false && posBoss()) jouer('impact_magique', { position: posBoss, lieu: lieuBoss(), ref: 7, volume: 0.9, vitesse: 0.72 });   // le voile se brise
      },
      // v1.4 : paliers de la phase 5 (v1.5 : intangibilité à la place des illusions), crochets (API.md §16.5, §17.3)
      palier: function (e) { var cle = SONS_PALIER[+e.numero || 0]; if (cle) jouer(cle, { plein: true, volume: 1.0 }); },
      // v1.5 : intangibilité de la phase 5 (la présence invisible en boucle suit boss.intangible : voir majIntangible)
      intangible: function (e) {
        var p = e.position ? { x: e.position.x, y: (e.position.y || 0) + 1.3, z: e.position.z } : posBoss();
        if (e.etat === 'debut') jouer('intangible_debut', { position: p || posBoss, lieu: lieuBoss() || 'bunker', ref: 5, portee: 40 });
        else if (e.etat === 'traversee' && p) jouer('traversee_mur', { position: p, lieu: lieuBoss() || 'bunker', ref: 4, portee: 25, vitesse: 0.95 + Math.random() * 0.1 });
        else if (e.etat === 'fin') jouer('resurgissement', { position: p || posBoss, lieu: lieuBoss() || 'bunker', ref: 6, portee: 50 });
      },
      // v1.5 : murs électrifiés (Survolté) : déflagration, une boucle par mur, extinction
      murs: function (e) {
        if (e.etat === 'electrifies') { jouer('murs_electrification', { plein: true, volume: 1.0 }); demarrerMurs(); }
        else if (e.etat === 'extinction') { arreterMurs(1.0); jouer('murs_extinction', { plein: true, volume: 0.9 }); }
        else if (e.etat === 'eteints') arreterMurs(0.3);
      },
      mursChoc: function (e) {
        if (!e.position) return;
        var local = e.joueur === joueurLocal;
        jouer('murs_choc', { position: { x: e.position.x, y: (e.position.y || 0) + 1.2, z: e.position.z }, plein: local, lieu: 'salle', ref: 3, portee: 25, vitesse: 0.94 + Math.random() * 0.12 });
      },
      // v1.5 : infection (L'Irradié) : onde au début, fin des grésillements à la fin
      infection: function (e) {
        if (e.etat === 'debut') jouer('irradie_infection', { plein: true, volume: 0.95 });
        else if (e.etat === 'fin') arreterIrradies(0.3);
      },
      // v1.5 : bras du Démembré : lancer, chute au centre, palpitation, flétrissement
      bras: function (e) {
        var p = e.position ? { x: e.position.x, y: (e.position.y || 0) + 0.4, z: e.position.z } : null;
        if (e.etat === 'lance' && p) jouer('bras_lancer', { position: p, lieu: 'salle', ref: 5, portee: 45 });
        else if (e.etat === 'pose' && p) {
          jouer('bras_impact', { position: p, lieu: 'salle', ref: 6, portee: 55 });
          nomme('bras', jouer('bras_pulsation', { position: p, lieu: 'salle', ref: 3, portee: 22, volume: 0.9, fondu: 0.5, quand: maintenant() + 0.4 }));
        } else if (e.etat === 'fletri') { arreterNomme('bras', 0.3); if (p) jouer('bras_fletri', { position: p, lieu: 'salle', ref: 4, portee: 35 }); }
      },
      petitDemembre: function (e) {
        if (!e.position) return;
        var p = { x: e.position.x, y: 0.6, z: e.position.z };
        if (e.etat === 'apparition') jouer('petit_sortie', { position: p, lieu: 'salle', ref: 4, portee: 35, vitesse: 0.9 + Math.random() * 0.2 });
        else if (e.etat === 'effondrement') jouer('petit_effondrement', { position: p, lieu: 'salle', ref: 3, portee: 30, vitesse: 0.92 + Math.random() * 0.16, quand: maintenant() + Math.random() * 0.4 });
      },
      crochet: function (e) {
        var p = e.position ? { x: e.position.x, y: e.position.y != null ? e.position.y : 1.2, z: e.position.z } : posBoss();
        if (e.etat === 'lancer') jouer('crochet_lancer', { position: p || posBoss, lieu: 'bunker', ref: 5, portee: 40 });
        else if (e.etat === 'accroche') {
          jouer('crochet_accroche', { position: p, lieu: 'bunker', ref: 5, portee: 40 });
          nomme('traction:' + e.id, jouer('crochet_traction', { position: posBoss, lieu: 'bunker', ref: 5, portee: 40, quand: maintenant() + 0.2 }));
        } else if (e.etat === 'arrivee') arreterNomme('traction:' + e.id, 0.1);
        else if (e.etat === 'rate') { arreterNomme('traction:' + e.id, 0.1); jouer('crochet_rate', { position: p, lieu: 'bunker', ref: 4, portee: 35 }); }
      },
      // v1.2 : meute de chiens zombies (API.md §14)
      meute: function (e) {
        if (e.etat !== 'dechainee') return;
        var t = maintenant();                           // la meute est lâchée : hurlements qui se répondent
        jouer('chien_hurlement', { plein: true, volume: 0.85, vitesse: 0.93 });
        jouer('chien_hurlement', { plein: true, volume: 0.55, vitesse: 1.07, quand: t + 0.4 });
      },
      chien: function (e) {
        if (!e.position) return;
        if (e.etat === 'faille') jouer('chien_faille', { position: e.position, lieu: e.lieu, ref: 6, portee: 50 });
        else if (e.etat === 'apparition') {
          var h = jouer('chien_hurlement', { position: e.position, lieu: e.lieu, ref: 5, portee: 45, volume: 0.8, vitesse: 0.95 + Math.random() * 0.12 });
          if (h) plus(maintenant() + 1.3, function () { h.stop(0.4); });          // hurlement court (manifeste : notes)
        } else if (e.etat === 'mort' || (e.etat === 'fin' && e.raison === 'defaite')) {
          jouer('chien_mort', { position: e.position, lieu: e.lieu, ref: 4, portee: 35, vitesse: 0.92 + Math.random() * 0.16 });
        }
      }
    };
    // v1.2 : grognement en boucle sur le chien vivant le plus proche (suit sa position), aboiements aléatoires
    var chienProche = { id: null, lieu: null, p: { x: 0, y: 0, z: 0 } }, prochainAboiement = 0;
    function positionChienProche() {
      var M8 = etatCourant && etatCourant.meute, l = M8 && M8.chiens;
      if (l) for (var i = 0; i < l.length; i++) if (l[i].id === chienProche.id) { chienProche.p.x = l[i].position.x; chienProche.p.y = l[i].position.y; chienProche.p.z = l[i].position.z; break; }
      return chienProche.p;
    }
    function majChiens(etat, now) {
      var M8 = etat.meute, l = M8 && M8.active !== false ? M8.chiens : null, best = null, dMin = 1e18;
      if (l) for (var i = 0; i < l.length; i++) {
        var c = l[i];
        if (c.lieu !== auditeur.lieu || !c.position) continue;
        var dx = c.position.x - auditeur.position.x, dz = c.position.z - auditeur.position.z, d2 = dx * dx + dz * dz;
        if (d2 < dMin) { dMin = d2; best = c; }
      }
      if (!best || dMin > 30 * 30) { if (parCle.grognement) arreterNomme('grognement', 0.5); return; }
      chienProche.id = best.id; chienProche.lieu = best.lieu;
      if (!parCle.grognement) nomme('grognement', jouer('chien_grognement', { position: positionChienProche, lieu: best.lieu, ref: 3, portee: 25, volume: 0.9 }));
      if (parCle.grognement) parCle.grognement.lieu = best.lieu;
      if (now >= prochainAboiement) {
        prochainAboiement = now + 1.5 + Math.random() * 2.5;
        var c2 = l[Math.floor(Math.random() * l.length) % l.length];
        if (c2 && c2.lieu === auditeur.lieu && c2.position) {
          var p = { x: c2.position.x, y: c2.position.y, z: c2.position.z };
          jouer('chien_aboiement', { position: p, lieu: c2.lieu, ref: 4, portee: 35, vitesse: 0.85 + Math.random() * 0.25 });
          if (Math.random() < 0.35) jouer('chien_aboiement', { position: p, lieu: c2.lieu, ref: 4, portee: 35, vitesse: 0.85 + Math.random() * 0.25, quand: now + 0.25 + Math.random() * 0.1 });
        }
      }
    }
    // v1.3 : boucles sur chaque mini-boss vivant de etat.miniBoss (position suivie), coupées à sa mort ou à sa disparition
    var bouclesMb = {}, passeMb = 0, flaqueFin = 0;
    function arreterBouclesMb(id, fondu) {
      var B = bouclesMb[String(id)];
      if (!B) return;
      for (var i = 0; i < B.noms.length; i++) arreterNomme(B.noms[i], fondu);
      delete bouclesMb[String(id)];
    }
    function majMiniBoss(etat, now) {
      passeMb++;
      var l = etat.miniBoss, cle;
      if (l) for (var i = 0; i < l.length; i++) {
        var m = l[i];
        if (m.etat !== 'actif' || !m.position || !SONS_MB[m.type]) continue;
        cle = String(m.id);
        var B = bouclesMb[cle];
        if (!B) {
          B = bouclesMb[cle] = { type: m.type, lieu: m.lieu || 'salle', p: { x: m.position.x, y: 1.3, z: m.position.z }, noms: [], passe: 0, d: 99 };
          (function (B) {
            var pos = function () { return B.p; };
            SONS_MB[m.type].boucles.forEach(function (b) {
              var nom = 'mb:' + cle + ':' + b.nom;
              B.noms.push(nom);
              nomme(nom, jouer(b.cle, { position: pos, lieu: B.lieu, ref: b.ref, portee: b.portee, volume: b.volume, fondu: 0.4 }));
            });
          })(B);
        }
        B.passe = passeMb; B.lieu = m.lieu || 'salle';
        if (m.type === 'demembre') {                    // v1.4 : râle et pas boiteux plus bas quand il ne bouge pas
          if (B.vt == null) { B.vt = now; B.vx = m.position.x; B.vz = m.position.z; }
          else if (now - B.vt >= 0.15) {
            var vit = Math.sqrt((m.position.x - B.vx) * (m.position.x - B.vx) + (m.position.z - B.vz) * (m.position.z - B.vz)) / (now - B.vt);
            B.vt = now; B.vx = m.position.x; B.vz = m.position.z;
            var hr = parCle['mb:' + cle + ':rale']; if (hr) hr.volume = vit > 0.4 ? 0.9 : 0.45;
          }
        }
        B.p.x = m.position.x; B.p.z = m.position.z;
        var dx = m.position.x - auditeur.position.x, dz = m.position.z - auditeur.position.z;
        B.d = Math.sqrt(dx * dx + dz * dz);
        if (m.type === 'irradie') {                     // le compteur s'affole quand on approche, et plus encore dans l'aura
          var R = (C.miniBoss && C.miniBoss.irradie && C.miniBoss.irradie.aura && C.miniBoss.irradie.aura.rayon) || 3;
          var g = parCle['mb:' + cle + ':geiger'];
          if (g) { g.volume = 0.45 + 0.85 * Math.max(0, Math.min(1, (R + 3 - B.d) / 3)); if (g.dansAura !== (B.d <= R)) { g.dansAura = B.d <= R; g.vitesse(g.dansAura ? 1.3 : 1.0); } }
        }
      }
      for (cle in bouclesMb) if (bouclesMb[cle].passe !== passeMb) arreterBouclesMb(cle, 0.3);
      if (parCle.flaque && now >= flaqueFin) arreterNomme('flaque', 0.5);
    }
    // v1.4 : une boucle « zone_radioactive » par zone de l'Irradié (départ et vitesse au hasard : pas d'addition en phase)
    function arreterZones(fondu) { Object.keys(parCle).forEach(function (k) { if (k.indexOf('zone:') === 0) arreterNomme(k, fondu); }); }
    function boucleAleatoire(cle) { var m = M[cle]; return m && m.boucleFin != null ? Math.random() * Math.max(0, m.boucleFin - (m.boucleDebut || 0) - 0.05) : 0; }
    // v1.5 : murs électrifiés : une boucle par mur de l'octogone (au milieu du mur, à hauteur d'homme), éclairs au hasard
    var mursPos = [], prochainArc = 0;
    (function () {
      var SA = A && A.salle, ap = (SA && SA.apotheme) || 15, o = (SA && SA.origine) || { x: 0, y: 0, z: 0 };
      var murs = SA && SA.murs ? SA.murs : null;
      for (var m = 0; m < 8; m++) {
        var n = murs && murs[m] ? murs[m].normale : { x: Math.sin(m * Math.PI / 4), z: Math.cos(m * Math.PI / 4) };
        mursPos.push({ x: o.x + n.x * (ap - 0.4), y: (o.y || 0) + 1.6, z: o.z + n.z * (ap - 0.4) });
      }
    })();
    function demarrerMurs() {
      for (var m = 0; m < mursPos.length; m++) if (!parCle['mur:' + m]) nomme('mur:' + m, jouer('murs_boucle', { position: mursPos[m], lieu: 'salle', ref: 3, portee: 18, volume: 0.9,
        fondu: 0.5, decalage: boucleAleatoire('murs_boucle'), vitesse: 0.94 + Math.random() * 0.12 }));
      prochainArc = maintenant() + 0.6;
    }
    function arreterMurs(fondu) { for (var m = 0; m < mursPos.length; m++) arreterNomme('mur:' + m, fondu); }
    function majMurs(etat, now) {
      var actifs = etat.murs && etat.murs.etat === 'electrifies';
      if (actifs && !parCle['mur:0']) demarrerMurs();     // reprise (le jeu a manqué l'évènement)
      if (!actifs && parCle['mur:0'] && !(etat.murs && etat.murs.etat === 'extinction')) arreterMurs(0.5);
      if (actifs && now >= prochainArc) {
        prochainArc = now + 1 + Math.random() * 2;
        var q = mursPos[Math.floor(Math.random() * mursPos.length) % mursPos.length];
        jouer('murs_arc', { position: { x: q.x, y: 1 + Math.random() * 3, z: q.z }, lieu: 'salle', ref: 4, portee: 30, vitesse: 0.9 + Math.random() * 0.2 });
      }
    }
    // v1.5 : grésillement sur les entités irradiées les plus proches de l'auditeur (au plus 5), si le jeu donne leurs positions
    var irradies = {}, passeIrr = 0, positionZombie = null, _pz = { x: 0, y: 0, z: 0 };
    function arreterIrradies(fondu) { for (var k in irradies) { arreterNomme('irr:' + k, fondu); delete irradies[k]; } }
    var _proches = [];
    function majIrradies(etat) {
      var inf = etat.infection, ids = inf && inf.active ? inf.ids : null;
      if (!ids || !ids.length || !positionZombie) { if (Object.keys(irradies).length) arreterIrradies(0.3); return; }
      passeIrr++;
      _proches.length = 0;
      for (var i = 0; i < ids.length; i++) {
        var p = positionZombie(ids[i]);
        if (!p) continue;
        var dx = p.x - auditeur.position.x, dz = p.z - auditeur.position.z;
        _proches.push({ id: ids[i], d: dx * dx + dz * dz, x: p.x, z: p.z });
      }
      _proches.sort(function (a, b) { return a.d - b.d; });
      for (var k = 0; k < Math.min(5, _proches.length); k++) {
        var z = _proches[k], cle = String(z.id), B = irradies[cle];
        if (z.d > 14 * 14) break;
        if (!B) {
          B = irradies[cle] = { p: { x: z.x, y: 1.0, z: z.z }, passe: 0 };
          (function (B) {
            nomme('irr:' + cle, jouer('zombie_irradie', { position: function () { return B.p; }, lieu: 'salle', ref: 1.5, portee: 10, volume: 0.8,
              fondu: 0.3, decalage: boucleAleatoire('zombie_irradie'), vitesse: 0.9 + Math.random() * 0.2 }));
          })(B);
        }
        B.passe = passeIrr; B.p.x = z.x; B.p.z = z.z;
      }
      for (var c in irradies) if (irradies[c].passe !== passeIrr) { arreterNomme('irr:' + c, 0.3); delete irradies[c]; }
    }
    // v1.5 : présence invisible du Septième intangible (boucle de portée courte qui suit sa position)
    function majIntangible(b) {
      var on = !!(b && b.intangible && b.present);
      if (on && !parCle.intangible) nomme('intangible', jouer('intangible_boucle', { position: posBoss, lieu: b.lieu || 'bunker', ref: 1.5, portee: 8, volume: 1.0, fondu: 0.4,
        decalage: boucleAleatoire('intangible_boucle') }));
      if (!on && parCle.intangible) arreterNomme('intangible', 0.3);
      if (parCle.intangible && b) parCle.intangible.lieu = b.lieu || 'bunker';
    }
    // flaque toxique de l'Irradié : boucle au sol pendant flaque.duree s (ou jusqu'à options.etat 'fin')
    function flaque(position, lieu, duree) {
      var F = (C.miniBoss && C.miniBoss.irradie && C.miniBoss.irradie.flaque) || {}, d = duree || F.duree || 5;
      flaqueFin = maintenant() + d;
      if (parCle.flaque) { var h = parCle.flaque; if (h.position && position) { h.position.x = position.x; h.position.z = position.z; } return h; }
      return nomme('flaque', jouer('flaque_toxique', { position: { x: position.x, y: 0.2, z: position.z }, lieu: lieu, ref: 3, portee: 20, volume: 0.9, fondu: 0.4 }));
    }
    var ANNONCES = { 'munitions-max': 'annonce_munitions_max' };
    var dernierRecompense = 0;

    function toutArreter(fondu) {
      arreterMusique(fondu);
      Object.keys(parCle).forEach(function (k) { arreterNomme(k, fondu); });
      actifs.slice().forEach(function (h) { h.stop(fondu); });
      programmes.length = 0;
      etouffer(false, 0.3);
    }

    var api = {
      version: VERSION,
      context: ctx,
      output: maitre,
      /** Charge et décode tous les sons du manifeste. → Promise<{ charges, total }> */
      precharger: function () {
        if (chargement) return chargement;
        var cles = Object.keys(M);
        chargement = Promise.all(cles.map(function (k) {
          return charger(k).then(function () { return true; }, function (e) { avertir('son introuvable « ' + k + ' » : ' + (e && e.message || e)); return false; });
        })).then(function (r) { return { charges: r.filter(Boolean).length, total: cles.length }; });
        return chargement;
      },
      /** Réactive l'AudioContext (dans un clic). */
      deverrouiller: function () { return ctx.state === 'suspended' && ctx.resume ? ctx.resume() : Promise.resolve(); },
      /** S'abonne aux évènements de la logique. Renvoie la fonction de désabonnement. */
      brancher: function (combat) {
        var offs = Object.keys(gestionnaires).map(function (type) {
          return combat.on(type, function (d) { try { gestionnaires[type](d || {}); } catch (e) { avertir(type + ' : ' + e.message); } });
        });
        var r = function () { offs.forEach(function (f) { if (typeof f === 'function') f(); }); };
        debranchements.push(r);
        return r;
      },
      /** Chaque image : position et orientation de l'auditeur, couches musicales, boucles qui suivent. */
      mettreAJour: function (dt, etat, ctxt) {
        if (detruit) return;
        etatCourant = etat || etatCourant;
        ctxt = ctxt || {};
        if (ctxt.joueurLocalId) joueurLocal = ctxt.joueurLocalId;
        if (ctxt.positionZombie) positionZombie = ctxt.positionZombie;   // v1.5 : grésillement des entités irradiées
        if (ctxt.auditeur) {
          var a = ctxt.auditeur;
          auditeur.position = a.position || auditeur.position;
          auditeur.lacet = a.lacet != null ? a.lacet : auditeur.lacet;
          auditeur.lieu = a.lieu || auditeur.lieu;
        }
        var now = maintenant();
        if (programmes.length) {
          var reste = [];
          programmes.forEach(function (p) { if (p.t <= now + 0.06) p.fn(); else reste.push(p); });
          programmes = reste;
        }
        for (var i = 0; i < actifs.length; i++) spatialiser(actifs[i], false);
        if (!etat) return;
        var b = etat.boss || {};
        // couche du rituel : suit la progression de la capture
        if (musiques.couche && musiques.cleBase === 'mus_rituel') {
          var cap = etat.capture, k = 0;
          if (cap) k = cap.etat === 'capture' ? 0.35 + 0.65 * cap.progression : cap.etat === 'conteste' ? 0.9 : 0.15 + 0.4 * cap.progression;
          musiques.couche.volumeCible(Math.min(1, k), 0.4);
        }
        if (parCle.rituel && etat.capture) parCle.rituel.vitesse(1 + 0.12 * (etat.capture.progression || 0));
        if (parCle.interaction && etat.interaction) parCle.interaction.vitesse(1 + 0.5 * (etat.interaction.progression || 0));
        // phase 5 : couche de traque et murmures selon la distance du boss
        if (etat.etat === 'phase5' && b.position) {
          var dx = b.position.x - auditeur.position.x, dz = b.position.z - auditeur.position.z, d = Math.sqrt(dx * dx + dz * dz);
          var proche = b.present && b.visible && b.lieu === auditeur.lieu ? Math.max(0, Math.min(1, (22 - d) / 16)) : 0;
          if (musiques.couche && musiques.cleBase === 'mus_phase5') musiques.couche.volumeCible(proche, 0.5);
          if (parCle.proche) parCle.proche.volume = 0.5 + 0.7 * proche;
        }
        // souffle du boss (présent et visible), battements d'ailes, gouttes de sang des lames
        var souffle = b.present && b.visible && b.locomotion !== 'mort' && etat.etat !== 'inactif';
        if (souffle && !parCle.souffle) nomme('souffle', jouer('boss_souffle', { position: posBoss, lieu: b.lieu, volume: 0.55, ref: 3, portee: 25 }));
        if (!souffle && parCle.souffle) arreterNomme('souffle', 0.5);
        if (parCle.souffle) parCle.souffle.lieu = b.lieu;
        if (b.ailes === 'deployees' && now >= prochainBattement) {
          prochainBattement = now + 0.8 + Math.random() * 0.35;
          jouer('ailes_battement', { position: posBoss, lieu: b.lieu, volume: 0.7, vitesse: 0.92 + Math.random() * 0.16, ref: 6 });
        }
        if (b.lames === 'actives' && b.visible && now >= prochaineGoutte) {
          prochaineGoutte = now + 0.35 + Math.random() * 0.6;
          jouer('goutte_sang', { position: posBoss, lieu: b.lieu, volume: 0.45, vitesse: 0.85 + Math.random() * 0.4, ref: 2, portee: 12 });
        }
        majChiens(etat, now);
        majMiniBoss(etat, now);
        majMurs(etat, now); majIrradies(etat); majIntangible(b);   // v1.5
      },
      /** v1.3 : capacité d'un mini-boss signalée par le jeu (API.md §15.6). type 'survolte' | 'irradie' ;
       *  quoi : 'charge' (≈ 0,7 s avant la décharge), 'decharge' (au tir), 'spasme', 'flaque' ; position {x,y,z} ;
       *  options : { lieu, id (mini-boss), etat ('debut' | 'tick' | 'fin' pour la flaque), intensite (0..1, spasme), duree }. */
      sonMiniBoss: function (type, quoi, position, options) {
        options = options || {};
        var p = position ? { x: position.x, y: position.y != null ? position.y : 1.3, z: position.z } : null, lieu = options.lieu || 'salle';
        if (quoi === 'charge' && type === 'survolte') {
          var b = options.id != null ? parCle['mb:' + options.id + ':bourdon'] : null;   // le bourdon monte de 3 dB et accélère pendant la charge
          if (b) { var v0 = b.volume; b.volume = v0 * 1.41; b.vitesse(1.05); plus(maintenant() + 0.85, function () { b.volume = v0; b.vitesse(1); }); }
          return jouer('survolte_charge', { position: p, plein: !p, lieu: lieu, ref: 4, portee: 40, decalage: 0.1 });   // sommet calé sur la décharge (0,7 s)
        }
        if (quoi === 'decharge' && type === 'survolte') return jouer('survolte_decharge', { position: p, plein: !p, lieu: lieu, ref: 5, portee: 55, vitesse: 0.96 + Math.random() * 0.08 });
        if (quoi === 'spasme' && type === 'survolte') return jouer('survolte_spasme', { position: p, plein: !p, lieu: lieu, ref: 3, portee: 30, volume: 0.6 + 0.4 * (options.intensite != null ? options.intensite : 1), vitesse: 0.9 + Math.random() * 0.2 });
        if (quoi === 'flaque' && type === 'irradie') {
          if (options.etat === 'fin') { arreterNomme('flaque', 0.5); return null; }
          if (options.etat === 'tick') return parCle.flaque || null;
          return p ? flaque(p, lieu, options.duree) : null;
        }
        // v1.4 (API.md §16.2) : Démembré, boules et zones de l'Irradié, étourdissement du Survolté
        if (quoi === 'fleau' && (type === 'demembre' || type === 'demembre_petit')) {   // sommet du son à 0,7 s = préparation du géant ; petits : 0,6 s
          if (options.etat !== 'preparation') return null;
          return type === 'demembre' ? jouer('demembre_fleau', { position: p, plein: !p, lieu: lieu, ref: 5, portee: 40, vitesse: 0.97 + Math.random() * 0.06 })
            : jouer('demembre_fleau', { position: p, plein: !p, lieu: lieu, ref: 3, portee: 25, volume: 0.6, vitesse: 1.17 });
        }
        if (quoi === 'impact' && (type === 'demembre' || type === 'demembre_petit')) return jouer('demembre_impact', { position: p, plein: !p, lieu: lieu, ref: 4, portee: 35,
          volume: type === 'demembre' ? 1 : 0.6, vitesse: type === 'demembre' ? 0.85 + Math.random() * 0.1 : 1.05 + Math.random() * 0.1 });
        if (quoi === 'charge' && type === 'demembre') {  // v1.5 : charge du géant sans bras
          var nomC = 'charge:' + (options.id != null ? options.id : 'd');
          if (options.etat === 'preparation') return nomme(nomC, jouer('demembre_charge', { position: p, plein: !p, lieu: lieu, ref: 6, portee: 50 }));
          if (options.etat === 'impact') return jouer('demembre_percussion', { position: p, plein: !p, lieu: lieu, ref: 4, portee: 35, vitesse: 0.95 + Math.random() * 0.1 });
          if (options.etat === 'mur') { arreterNomme(nomC, 0.15); return jouer('bloc_impact', { position: p, plein: !p, lieu: lieu, ref: 7, portee: 50, volume: 0.9, vitesse: 0.78 }); }
          return null;
        }
        if (quoi === 'projection' && options.etat === 'mur') return jouer('projection_mur', { position: p, plein: options.cible != null && options.cible === joueurLocal, lieu: lieu, ref: 4, portee: 30 });
        if (quoi === 'boule' && type === 'irradie') {
          if (options.etat === 'impact') return jouer('irradie_boule_impact', { position: p, plein: !p, lieu: lieu, ref: 4, portee: 40, vitesse: 0.94 + Math.random() * 0.12 });
          return jouer('irradie_boule', { position: p, plein: !p, lieu: lieu, ref: 4, portee: 40, vitesse: 0.92 + Math.random() * 0.16 });
        }
        if (quoi === 'zone' && type === 'irradie') {
          var nomZ = 'zone:' + (options.id != null ? options.id : 'x');
          if (options.etat === 'fin') { arreterNomme(nomZ, options.duree != null ? options.duree : 1.5); return null; }
          if (!p) return null;
          return nomme(nomZ, jouer('zone_radioactive', { position: { x: p.x, y: 0.3, z: p.z }, lieu: lieu, ref: 3, portee: 20, volume: 0.9, fondu: 0.5,
            decalage: boucleAleatoire('zone_radioactive'), vitesse: 0.94 + Math.random() * 0.12 }));
        }
        if (quoi === 'etourdi' && type === 'survolte') {   // seulement chez le joueur étourdi (stéréo, non positionnel)
          if (options.cible != null && joueurLocal != null && options.cible !== joueurLocal) return null;
          return jouer('survolte_etourdi', { plein: true, volume: 0.9 });
        }
        return null;
      },
      /** v1.2 : morsure d'un chien zombie (le jeu l'appelle à chaque morsure) ; sans position : non positionnel. */
      morsureChien: function (position, lieu) {
        return jouer('chien_morsure', { position: position ? { x: position.x, y: position.y || 0, z: position.z } : null, plein: !position,
          lieu: lieu || auditeur.lieu, ref: 3, portee: 20, vitesse: 0.92 + Math.random() * 0.16 });
      },
      jouer: jouer,
      musique: musique,
      /** v1.1 : annonce vocale d'un bonus (« Munitions max ! ») — à appeler au ramassage, sauf si le jeu a déjà son propre annonceur. */
      annoncerBonus: function (type) {
        var cle = ANNONCES[type];
        if (!cle) return null;
        jouer('recompense_objet', { plein: true, bus: 'cinema', volume: 0.9 });
        return jouer(cle, { plein: true, bus: 'cinema', volume: 1.0, quand: maintenant() + 0.05 });
      },
      setVolume: function (canal, v) { if (!(canal in vol)) throw new Error('BossB7Audio : canal inconnu « ' + canal + ' »'); vol[canal] = Math.max(0, +v || 0); appliquerVolumes(); },
      getVolume: function (canal) { return vol[canal]; },
      stop: function (fondu) { toutArreter(fondu == null ? 0.5 : fondu); },
      get pret() { return Object.keys(M).every(function (k) { return !!tampons[k]; }); },
      get musiqueEnCours() { return musiques.cleBase; },
      stats: function () { return { actifs: actifs.length, nommes: Object.keys(parCle), musique: musiques.cleBase, programmes: programmes.length }; },
      dispose: function () {
        if (detruit) return;
        toutArreter(0.05);
        detruit = true;
        debranchements.forEach(function (f) { f(); });
        try { maitre.disconnect(); comp.disconnect(); limiteur.disconnect(); } catch (e) { /* */ }
        if (ctxPropre && ctx.close) setTimeout(function () { ctx.close(); }, 120);
      }
    };
    return api;
  }

  var BossB7Audio = { version: VERSION, creer: creer, SONS_ACTIONS: SONS_ACTIONS };
  if (typeof module === 'object' && module && module.exports) module.exports = BossB7Audio;
  if (root) root.BossB7Audio = BossB7Audio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
