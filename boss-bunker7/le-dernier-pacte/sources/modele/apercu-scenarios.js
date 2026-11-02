// Scénarios d'aperçu : chaque action du boss jouée comme la logique l'enverrait (étapes et durées de config.js,
// locomotion, hauteur des pieds, ailes, lames, cible). Utilisé par apercu.html et par les captures automatiques.
// y : hauteur des pieds au-dessus du sol (nombre, ou [début, fin] interpolé sur l'étape).
// sansDuree : étapes dont la logique ne connaît pas la durée (crochet : lancer, traction) → duree null, progression 0.
// couleurLames : couleur des lames de la vue (null = rouge) ; apercu.html peut l'imposer (?lames=, liste « Lames »).
(function (root) {
  'use strict';
  const S = {
    apparition: { loco: 'levitation', y: 1.25, etapes: [['formation', 2.6], ['presentation', 3.4]] },
    invocation: { loco: 'levitation', y: 1.25, etapes: [['preparation', 1.1], ['lancer', 0.35], ['recuperation', 0.6]], cible: [2.2, 0, 4.2] },
    trait: { loco: 'levitation', y: 1.25, etapes: [['preparation', 0.7], ['lancer', 0.25], ['recuperation', 0.4]], cible: [0.8, 0, 7], joueur: 'j1' },
    souffrance: { loco: 'levitation', y: 1.25, etapes: [['souffrance', 1.6], ['colere', 1.4]] },
    recharge: { loco: 'levitation', y: 1.6, etapes: [['boucle', 6]] },
    absorption: { loco: 'levitation', y: 1.25, etapes: [['saisie', 0.9], ['extraction', 2.4], ['fin', 0.5]], ames: { debut: 1.2, pas: 0.45, n: 4, depart: 3 } },
    transformation_ailes: { loco: 'levitation', y: 1.4, etapes: [['cambrure', 0.6], ['deploiement', 0.9], ['rugissement', 0.6]], ailes: { cambrure: 'apparition', deploiement: 'apparition', rugissement: 'apparition', apres: 'deployees' }, puissance: 1 },
    pique: { loco: 'ailes', ailesDef: 'deployees', etapes: [['montee', 0.9, [1.4, 3.4]], ['visee', 1.1, 3.4], ['charge', 0.6, [3.4, 0.35]], ['impact', 0.4, 0], ['etourdi', 1.4, [0.0, 0.3]], ['retour', 1.0, [0.3, 1.25]]],
      ailes: { montee: 'deployees', visee: 'deployees', charge: 'deployees', impact: 'deployees', etourdi: 'dissipation', retour: 'absentes' }, cible: [0, 0, 8], joueur: 'j1', vitesse: { charge: [0, -4.8, 23.5] }, puissance: 1 },
    effondrement: { loco: 'levitation', y: 1.25, etapes: [['souffrance', 2.2]] },
    teleport_depart: { loco: 'levitation', y: 1.25, etapes: [['implosion', 1.2]] },
    teleport_arrivee: { loco: 'rage', y: 0.7, etapes: [['apparition', 0.9]] },
    retour_rage: { loco: 'rage', etapes: [['descente', 1.2, [2.6, 0.7]], ['deflagration', 0.8, 0.7], ['rugissement', 1.0, 0.7]] },
    arrachement: { loco: 'rage', y: 0.7, etapes: [['designation', 0.8], ['fracture', 0.6], ['levitation', 0.75], ['projection', 0.35], ['recuperation', 0.5]],
      cible: { designation: [6.5, 2.0, 12.5], fracture: [6.5, 2.0, 12.5], levitation: [0.6, 3.4, 1.0], projection: [-0.8, 0, 8], recuperation: [-0.8, 0, 8] }, joueurEtapes: { projection: 'j1', recuperation: 'j1' } },
    onde_choc: { loco: 'rage', y: 0.7, etapes: [['preparation', 0.8], ['frappe', 0.2], ['recuperation', 0.6]] },
    faiblesse: { loco: 'affaibli', etapes: [['chute', 1.5, [2.2, 0.55]], ['boucle', 6, 0.55]] },
    rituel_ames: { loco: 'levitation', etapes: [['elevation', 1.0, [0.6, 2.0]], ['incantation', 2.6, 2.0], ['capture', 1.6, 2.0]] },
    transformation_lames: { loco: 'traque', y: 0.25, etapes: [['formation', 2.0]], lames: { formation: 'formation', apres: 'actives' } },
    frappe: { loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['preparation', 0.6], ['frappe', 0.18], ['recuperation', 0.5]], donnees: { reussie: true }, joueur: 'j1', cible: [0, 0, 2.2] },
    frappe_ratee: { id: 'frappe', loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['preparation', 0.6], ['frappe', 0.18], ['recuperation', 1.2]], donnees: { reussie: false }, joueur: 'j1', cible: [0, 0, 2.2] },
    frappe_ordinaire: { loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['preparation', 0.45], ['frappe', 0.15], ['recuperation', 0.5]], joueur: 'j1', cible: [0, 0, 2.0] },
    defaite: { loco: 'traque', lamesDef: 'actives', etapes: [['chancelle', 1.5, 0.25], ['genoux', 1.2, [0.25, 0.0]], ['chute', 1.3, 0.0], ['mort', 3.0, 0.0]],
      lames: { chancelle: 'actives', genoux: 'desintegration', chute: 'desintegration', mort: 'absentes' }, locoEtapes: { mort: 'mort' } },
    // v1.4 : crochet du palier 3 (preparation 0,7 s ; lancer et traction sans durée connue de la logique)
    crochet: { loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['preparation', 0.7], ['lancer', 0.75], ['traction', 1.6]], sansDuree: { lancer: 1, traction: 1 },
      cible: [0.9, 0, 7.5], joueur: 'j1' },
    // v1.4 : apparition et dissipation d'une illusion (vue construite par le prototype : lames actives, traque)
    illusion_apparition: { id: 'teleport_arrivee', loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['apparition', 1.0]], couleurLames: 'vert' },
    illusion_dissipation: { id: 'teleport_depart', loco: 'traque', y: 0.25, lamesDef: 'actives', etapes: [['implosion', 0.8]], couleurLames: 'vert' }
  };
  const LOCOS = {
    levitation: { loco: 'levitation', y: 1.25 },
    ailes: { loco: 'ailes', y: 1.6, ailesDef: 'deployees', puissance: 0.4 },
    rage: { loco: 'rage', y: 0.7 },
    affaibli: { loco: 'affaibli', y: 0.55 },
    traque: { loco: 'traque', y: 0.25, lamesDef: 'actives', vitesseLoco: [0, 0, 4.0] },
    mort: { loco: 'mort', y: 0.0 }
  };
  // vue (etat().boss) d'un scénario au temps t (secondes depuis le début de l'action)
  function vueAu(nom, t, base) {
    const v = base || {};
    const L = nom.indexOf('loco:') === 0 ? LOCOS[nom.slice(5)] : null;
    v.present = true; v.visible = true; v.lieu = 'salle';
    v.position = v.position || { x: 0, y: 0, z: 0 };
    v.vitesse = v.vitesse || { x: 0, y: 0, z: 0 };
    v.vitesse.x = 0; v.vitesse.y = 0; v.vitesse.z = 0;
    v.lacet = 0; v.vulnerable = true; v.multiplicateur = 1; v.puissance = 0; v.ames = 0; v.affaiblissement = 0;
    v.ailes = 'absentes'; v.lames = 'absentes'; v.regard = null; v.action = null; v.couleurLames = null;
    if (L) {
      v.locomotion = L.loco; v.position.y = L.y; v.ailes = L.ailesDef || 'absentes'; v.lames = L.lamesDef || 'absentes'; v.puissance = L.puissance || 0;
      if (L.vitesseLoco) { v.vitesse.x = L.vitesseLoco[0]; v.vitesse.y = L.vitesseLoco[1]; v.vitesse.z = L.vitesseLoco[2]; }
      return v;
    }
    const sc = S[nom];
    let t0 = 0, k = 0;
    while (k < sc.etapes.length - 1 && t >= t0 + sc.etapes[k][1]) { t0 += sc.etapes[k][1]; k++; }
    const [etape, duree, yE] = sc.etapes[k];
    const te = Math.max(0, Math.min(duree, t - t0)), p = duree > 0 ? te / duree : 1;
    const yv = yE != null ? yE : sc.y;
    v.position.y = Array.isArray(yv) ? yv[0] + (yv[1] - yv[0]) * (p * p * (3 - 2 * p)) : yv;
    v.locomotion = (sc.locoEtapes && sc.locoEtapes[etape]) || sc.loco;
    v.ailes = sc.ailes ? (sc.ailes[etape] || sc.ailesDef || 'absentes') : (sc.ailesDef || 'absentes');
    v.lames = sc.lames ? (sc.lames[etape] || sc.lamesDef || 'absentes') : (sc.lamesDef || 'absentes');
    v.puissance = sc.puissance || 0;
    if (nom === 'pique' || nom === 'transformation_ailes') v.puissance = 1;
    let cible = null;
    if (sc.cible) cible = Array.isArray(sc.cible) ? sc.cible : sc.cible[etape] || null;
    const joueur = (sc.joueurEtapes && sc.joueurEtapes[etape]) || (sc.joueurEtapes ? null : sc.joueur) || null;
    v.action = { id: sc.id || nom, etape: etape, t: te, duree: duree, progression: p, cible: cible ? { x: cible[0], y: cible[1], z: cible[2] } : null, cibleJoueur: joueur, donnees: sc.donnees || {} };
    if (sc.sansDuree && sc.sansDuree[etape]) { v.action.duree = null; v.action.progression = 0; }
    v.couleurLames = sc.couleurLames || null;
    if (sc.vitesse && sc.vitesse[etape]) { const w = sc.vitesse[etape]; v.vitesse.x = w[0]; v.vitesse.y = w[1]; v.vitesse.z = w[2]; }
    if (sc.ames) { const a = sc.ames; v.ames = a.depart + Math.max(0, Math.min(a.n, Math.floor((t - a.debut) / a.pas) + 1)); v.puissance = v.ames / 10; }
    if (etape === 'mort') v.action = { id: 'defaite', etape: 'mort', t: te, duree: duree, progression: p, cible: null, cibleJoueur: null, donnees: {} };
    return v;
  }
  function dureeTotale(nom) { if (nom.indexOf('loco:') === 0) return 6; return S[nom].etapes.reduce((s, e) => s + e[1], 0); }
  // instants représentatifs : milieu et fin de chaque étape (au plus 6)
  function instants(nom) {
    if (nom.indexOf('loco:') === 0) return [0.5, 2.0, 3.5];
    const out = []; let t0 = 0;
    for (const [, d] of S[nom].etapes) { out.push(t0 + d * 0.5); out.push(t0 + d * 0.98); t0 += d; }
    return out;
  }
  root.APERCU_SCENARIOS = { actions: S, locomotions: LOCOS, vueAu: vueAu, dureeTotale: dureeTotale, instants: instants, noms: Object.keys(S).concat(Object.keys(LOCOS).map((k) => 'loco:' + k)) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
