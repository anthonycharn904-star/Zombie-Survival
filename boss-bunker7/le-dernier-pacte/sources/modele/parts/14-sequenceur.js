  // ============================================================================================
  // Séquenceur : traduit la vue publique (combat.etat().boss, API.md §2 et §5) en commande interne de
  // l'animateur : clip de poses, temps normalisé u, temps de l'étape, visée, couches (rage, faiblesse,
  // voile, puissance), états des ailes et des lames avec leur avancement. Aucune allocation par image :
  // la commande est un objet unique réutilisé.
  // Chaque étape → [clip, u0, u1, options, duréeNominale] : u = u0 + (u1 − u0) × progression de l'étape ; une étape sans
  // durée connue (duree null, progression 0 : crochet « lancer ») avance avec action.t / duréeNominale puis tient la fin.
  // 'boucle' : clip en boucle sur l'horloge du modèle ; 'cycle' : clip en boucle depuis le début de l'étape (crochet
  // « traction », durée inconnue) ; 'extraction' : prise qui se resserre puis tient.
  // ============================================================================================
  const ACTIONS_API = ['apparition', 'invocation', 'trait', 'souffrance', 'recharge', 'absorption', 'transformation_ailes', 'pique',
    'effondrement', 'teleport_depart', 'teleport_arrivee', 'retour_rage', 'arrachement', 'onde_choc', 'faiblesse', 'rituel_ames',
    'transformation_lames', 'frappe', 'frappe_ordinaire', 'defaite', 'siphon', 'crochet', 'evanouissement', 'resurgissement'];
  const LOCOMOTIONS_API = ['aucune', 'levitation', 'ailes', 'rage', 'affaibli', 'traque', 'mort'];
  const SEQ_V = 1, SEQ_J = 2;   // options : V = la main droite vise action.cible ; J = cible = un joueur (viser la poitrine)
  const SEQ = {
    apparition: { formation: ['apparition', 0, 0.86], presentation: ['presentation', 0, 1] },
    invocation: { preparation: ['incantation', 0, 1], lancer: ['projection', 0, 1, SEQ_V], recuperation: ['retour-incantation', 0, 1] },
    trait: { preparation: ['trait-preparation', 0, 1, SEQ_V | SEQ_J], lancer: ['trait-lancer', 0, 1, SEQ_V | SEQ_J], recuperation: ['retour-incantation', 0.2, 1] },
    souffrance: { souffrance: ['souffrance-colere', 0, 0.45], colere: ['souffrance-colere', 0.45, 1] },
    recharge: { boucle: ['meditation', 'boucle'] },
    absorption: { saisie: ['absorption', 0, 0.22], extraction: ['absorption', 'extraction'], fin: ['absorption', 0.9, 1] },
    transformation_ailes: { cambrure: ['transformation-ailes', 0, 0.56], deploiement: ['transformation-ailes', 0.56, 0.74], rugissement: ['transformation-ailes', 0.74, 1] },
    pique: { montee: ['envol', 0, 1], visee: ['verrouillage', 0, 1], charge: ['pique', 0, 1], impact: ['impact-pique', 0, 1], etourdi: ['etourdi', 0, 1], retour: ['remontee', 0, 1] },
    effondrement: { souffrance: ['souffrance', 0, 1] },
    teleport_depart: { implosion: ['teleport-sortie', 0, 1] },
    teleport_arrivee: { apparition: ['teleport-entree', 0, 1] },
    retour_rage: { descente: ['retour-rage', 0, 0.3], deflagration: ['retour-rage', 0.3, 0.5], rugissement: ['retour-rage', 0.5, 1] },
    arrachement: { designation: ['designation-mur', 0, 1, SEQ_V], fracture: ['saisie-mur', 0, 0.5, SEQ_V], levitation: ['saisie-mur', 0.5, 1], projection: ['lancer', 0, 0.62, SEQ_V | SEQ_J], recuperation: ['lancer', 0.62, 1] },
    onde_choc: { preparation: ['repulsion', 0, 0.52], frappe: ['repulsion', 0.52, 0.64], recuperation: ['repulsion', 0.64, 1] },
    faiblesse: { chute: ['ramene', 0, 1], boucle: ['faible', 'boucle'] },
    rituel_ames: { elevation: ['rituel-ames', 0, 0.2], incantation: ['rituel-ames', 0.2, 0.8], capture: ['rituel-ames', 0.8, 1] },
    transformation_lames: { formation: ['formation-lames', 0, 1] },
    frappe: { preparation: ['frappe-preparation', 0, 1], frappe: ['frappe', 0, 1], recuperation: ['frappe-recuperation', 0, 1] },
    frappe_ordinaire: { preparation: ['frappe-ord-preparation', 0, 1], frappe: ['frappe-ord', 0, 1], recuperation: ['frappe-ord-recuperation', 0, 1] },
    defaite: { chancelle: ['defaite', 0, 0.3], genoux: ['defaite', 0.3, 0.64], chute: ['defaite', 0.64, 1], mort: ['cadavre', 'boucle'] },
    // v1.3 (API.md §15.2) : siphon d'une cuve à distance (le boss est déjà tourné vers elle) : les bras se lèvent et s'ouvrent,
    // les doigts crochus tirent le liquide par saccades, puis ramènent l'énergie à la poitrine quand la cuve éclate
    siphon: { approche: ['absorption', 0, 0.22], aspiration: ['absorption', 0.22, 0.82], eclatement: ['absorption', 0.82, 0.93], recuperation: ['absorption', 0.93, 1] },
    // v1.4 (API.md §16.5, §16.6) : crochet (palier 3), lames actives. preparation : bras droit tendu vers le joueur visé
    // (cible = ses pieds, visée à hauteur de poitrine), poing serré ; lancer (durée inconnue : geste en 0,42 s puis bras
    // tendu qui tient la chaîne) ; traction (durée inconnue) : il tire à deux mains vers lui, par à-coups, en boucle
    crochet: { preparation: ['crochet-visee', 0, 1, SEQ_V | SEQ_J], lancer: ['crochet-lancer', 0, 1, SEQ_V | SEQ_J, 0.42], traction: ['crochet-traction', 'cycle'] },
    // v1.5 (API.md §17.3) : intangibilité de la phase 5 : il s'efface (fondu de « disparition », sans la vrille de la téléportation),
    // puis resurgit (fondu de « reapparition », lames comprises)
    evanouissement: { fondu: ['disparition', 0, 1] },
    resurgissement: { apparition: ['reapparition', 0, 1] }
  };
  const LOCO = { aucune: 'flotte', levitation: 'flotte', ailes: 'flotte-ailes', rage: 'rage', affaibli: 'faible', traque: 'traque', mort: 'cadavre' };
  const RAGE_ACTIONS = { retour_rage: 1, arrachement: 1, onde_choc: 1 };
  const SANS_VOILE = { apparition: 1, teleport_depart: 1, teleport_arrivee: 1, defaite: 1, evanouissement: 1, resurgissement: 1 };
  // part de chaque étape dans l'avancement global des ailes / lames quand l'action les fait apparaître
  const AILES_ETAPES = { cambrure: [0, 0.35], deploiement: [0.35, 0.85], rugissement: [0.85, 1] };
  const DUREE_AILES_APPARITION = 2.1, DUREE_AILES_DISSIPATION = 1.2, DUREE_LAMES_FORMATION = 2.0, DUREE_LAMES_DESINTEGRATION = 2.0;
  const ETAT_AILES = { absentes: 'aucune', apparition: 'apparition', deployees: 'deployees', dissipation: 'disparition' };
  const ETAT_LAMES = { absentes: 'aucune', formation: 'formation', actives: 'actives', desintegration: 'destruction' };

  function creerSequenceur() {
    const E = {
      present: true, position: { x: 0, y: 0, z: 0 }, cap: 0, altitude: 0,
      action: 'flotte', u: null, tAction: 0, dureeAction: 1,
      main: 'droite', puissance: 0, rage: 0, faiblesse: 0, bouclier: 0,
      ailes: { etat: 'aucune', t: 1 }, lames: { etat: 'aucune', t: 1 },
      vitesse: { x: 0, y: 0, z: 0 }, regard: null, visee: null, pulseAme: 0
    };
    const visee = { x: 0, y: 0, z: 0 }, regard = { x: 0, y: 0, z: 0 };
    const st = { ailes: 'absentes', tAiles: 0, lames: 'absentes', tLames: 0, ames: -1, tAction: 0, idAction: null, etAction: null };
    return function traduire(vue, temps, dt, solY) {
      const a = vue.action || null;
      E.present = vue.present !== false && vue.visible !== false;
      const p = vue.position || E.position;
      E.position.x = p.x || 0; E.position.y = p.y || 0; E.position.z = p.z || 0;
      E.cap = vue.lacet || 0;
      // hauteur au-dessus du sol (seulement utile aux poses posées au sol)
      E.altitude = solY != null && Number.isFinite(solY) ? Math.max(0, E.position.y - solY) : 0;
      const v = vue.vitesse;
      E.vitesse.x = v ? v.x || 0 : 0; E.vitesse.y = v ? v.y || 0 : 0; E.vitesse.z = v ? v.z || 0 : 0;
      if (vue.regard) { regard.x = vue.regard.x; regard.y = vue.regard.y; regard.z = vue.regard.z; E.regard = regard; } else E.regard = null;
      // temps passé dans l'étape (si la vue ne le donne pas, on le mesure)
      const id = a ? a.id : null, et = a ? a.etape : null;
      if (id !== st.idAction || et !== st.etAction) { st.idAction = id; st.etAction = et; st.tAction = 0; } else st.tAction += dt;
      const tEt = a && a.t != null ? a.t : st.tAction;
      const dEt = a && a.duree > 0 ? a.duree : 1;
      const prog = a ? clamp(a.progression != null ? a.progression : tEt / dEt, 0, 1) : 0;
      // ---- clip et u
      const def = a && SEQ[a.id] ? SEQ[a.id][a.etape] : null;
      E.visee = null; E.u = null;
      if (def) {
        let clip = def[0];
        if (a.id === 'frappe' && a.etape === 'recuperation' && a.donnees && a.donnees.reussie === false) clip = 'frappe-ratee';
        if (a.id === 'teleport_arrivee' && (vue.lames === 'actives' || vue.lames === 'formation')) clip = 'reapparition';
        E.action = clip;
        if (def[1] === 'boucle') { E.tAction = temps; E.dureeAction = 0; }
        else if (def[1] === 'cycle') { E.tAction = tEt; E.dureeAction = 0; }
        else if (def[1] === 'extraction') { E.u = 0.36 + 0.46 * smooth(0, 1, Math.min(1, tEt / 1.4)); E.tAction = tEt; E.dureeAction = dEt; }
        else {
          const sansDuree = !(a.duree > 0) || !Number.isFinite(a.duree);
          const p = sansDuree && def[4] > 0 ? clamp(tEt / def[4], 0, 1) : prog;
          E.u = def[1] + (def[2] - def[1]) * p; E.tAction = tEt; E.dureeAction = sansDuree && def[4] > 0 ? def[4] : dEt;
        }
        const opt = def[3] || 0;
        if ((opt & SEQ_V) && a.cible) {
          visee.x = a.cible.x; visee.y = a.cible.y + ((opt & SEQ_J) && a.cibleJoueur != null ? 1.15 : 0); visee.z = a.cible.z;
          E.visee = visee;
        }
      } else {
        E.action = LOCO[vue.locomotion] || 'flotte';
        E.tAction = temps; E.dureeAction = 0;
      }
      // ---- couches
      E.puissance = clamp(vue.puissance || 0, 0, 1);
      if (vue.lames === 'actives') E.puissance = Math.max(E.puissance, 0.75);
      E.rage = vue.locomotion === 'rage' || (a && RAGE_ACTIONS[a.id]) ? 1 : 0;
      E.faiblesse = vue.locomotion === 'affaibli' || (a && a.id === 'faiblesse') ? 1 : clamp(vue.affaiblissement || 0, 0, 1) * 0.45;
      if (vue.locomotion === 'mort' || (a && a.id === 'defaite')) E.faiblesse = 0;
      E.bouclier = E.present && vue.vulnerable === false && !(a && SANS_VOILE[a.id]) && vue.locomotion !== 'mort' ? 0.32 : 0;
      // ---- âmes absorbées : une secousse de la poitrine à chaque nouvelle âme
      const ames = vue.ames | 0;
      E.pulseAme = st.ames >= 0 && ames > st.ames ? 1 : 0;
      st.ames = ames;
      // ---- ailes
      const ea = vue.ailes || 'absentes';
      if (ea !== st.ailes) { st.ailes = ea; st.tAiles = 0; } else st.tAiles += dt;
      E.ailes.etat = ETAT_AILES[ea] || 'aucune';
      if (ea === 'apparition') {
        const r = a && a.id === 'transformation_ailes' ? AILES_ETAPES[a.etape] : null;
        E.ailes.t = r ? r[0] + (r[1] - r[0]) * prog : clamp(st.tAiles / DUREE_AILES_APPARITION, 0, 1);
      } else if (ea === 'dissipation') E.ailes.t = clamp(st.tAiles / DUREE_AILES_DISSIPATION, 0, 1);
      else E.ailes.t = 1;
      // ---- lames
      const el = vue.lames || 'absentes';
      if (el !== st.lames) { st.lames = el; st.tLames = 0; } else st.tLames += dt;
      E.lames.etat = ETAT_LAMES[el] || 'aucune';
      if (el === 'formation') E.lames.t = a && a.id === 'transformation_lames' ? prog : clamp(st.tLames / DUREE_LAMES_FORMATION, 0, 1);
      else if (el === 'desintegration') E.lames.t = clamp(st.tLames / DUREE_LAMES_DESINTEGRATION, 0, 1);
      else E.lames.t = 1;
      return E;
    };
  }
