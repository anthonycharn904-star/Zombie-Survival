/*!
 * arene.js — Données éditables de l'arène du boss de Bunker 7 (salle secrète) et points de la carte.
 * Coordonnées de la salle : repère LOCAL, sol à y = 0, centre de la salle en (0, 0, 0), +Z = nord.
 * La position réelle de la salle dans le monde du jeu est donnée par `salle.origine` (à régler à
 * l'intégration : la salle doit être hors des zones jouables, par exemple sous la carte).
 * Les angles de lacet (yaw) sont en radians : 0 = regarde vers +Z, π/2 = regarde vers +X.
 * Tout est modifiable (Mod Tools) : listes explicites ci-dessous, générées une fois par `construire()`.
 * Script classique → globalThis.BOSS_B7_ARENE ; CommonJS → module.exports.
 *
 * Zombie Survival (jeu 2.0.7) : copie réglée du paquet d'Anthony (boss-bunker7/le-dernier-pacte/src/arene.js). Deux
 * différences : (étape 4, décision D12 d'Anthony du 1er novembre 2026) `salle.origine` = (26 ; 0 ; 100), au niveau du
 * sol, à 57 m au sud du mur sud de Bunker 7 (grille de 52 × 31 cases), hors de ses abords (34 m autour de la grille) et
 * dans la brume : le jeu ajoute la salle à la grille de la carte (lignes 82 à 117), sans toucher à la carte elle-même ;
 * (étape 8) les points de Bunker 7 (`bunker7`), remplis avec de vraies positions de la carte.
 */
(function (root) {
  'use strict';

  function construire(p) {
    p = p || {};
    var A = p.apotheme || 15;              // distance du centre au milieu de chaque mur (salle octogonale)
    var H = p.hauteur || 8;
    var cos225 = Math.cos(Math.PI / 8);
    var sommets = [];
    for (var k = 0; k < 8; k++) {
      var a = (k + 0.5) * Math.PI / 4;     // sommets entre deux murs
      sommets.push({ x: +(Math.sin(a) * A / cos225).toFixed(4), z: +(Math.cos(a) * A / cos225).toFixed(4) });
    }
    // Portions de murs arrachables : 3 par mur, dalles posées devant le mur porteur (le trou laissé est un
    // renfoncement de 0,6 m, jamais une ouverture : pas de sortie de l'arène, collisions inchangées).
    var dalles = [];
    var murs = [];
    for (var m = 0; m < 8; m++) {
      var th = m * Math.PI / 4;
      var n = { x: Math.sin(th), z: Math.cos(th) };            // normale sortante du mur
      var t = { x: Math.cos(th), z: -Math.sin(th) };           // tangente
      murs.push({ id: 'mur' + m, normale: { x: +n.x.toFixed(4), z: +n.z.toFixed(4) }, centre: { x: +(n.x * A).toFixed(3), z: +(n.z * A).toFixed(3) } });
      [-4, 0, 4].forEach(function (off, j) {
        var c = A - 0.3;                                        // centre de la dalle (épaisseur 0,6)
        dalles.push({
          id: 'm' + m + '-' + j, mur: m,
          centre: { x: +(n.x * c + t.x * off).toFixed(3), y: 2.0, z: +(n.z * c + t.z * off).toFixed(3) },
          normale: { x: +(-n.x).toFixed(4), z: +(-n.z).toFixed(4) },    // vers l'intérieur de la salle
          largeur: 3.2, hauteur: 2.6, epaisseur: 0.6,
          actif: !(m === 0 && j === 1)       // v1.4 : la dalle derrière la 3e cuve (milieu du mur nord) n'est jamais arrachée
        });
      });
    }
    var piliers = [45, 135, 225, 315].map(function (deg, i) {
      var a = deg * Math.PI / 180;
      return { id: 'pilier' + i, x: +(Math.sin(a) * 9.5).toFixed(3), z: +(Math.cos(a) * 9.5).toFixed(3), rayon: 0.85, hauteur: H };
    });
    var breches = [];
    for (var b = 0; b < 8; b++) {
      var tb = b * Math.PI / 4;
      breches.push({ id: 'breche' + b, x: +(Math.sin(tb) * 13.0).toFixed(3), y: 0, z: +(Math.cos(tb) * 13.0).toFixed(3) });
    }
    breches[0].z = 11.0;                     // v1.4 : la brèche nord avance de 2 m, devant la 3e cuve qui occupe le milieu du mur
    return {
      version: 1,
      salle: {
        nom: 'Chambre du Pacte',
        origine: p.origine || { x: 0, y: 0, z: 0 },   // position du centre de la salle dans le monde du jeu
        forme: 'octogone', apotheme: A, hauteur: H,
        sommets: sommets,                  // contour intérieur (sol), sens horaire vu de dessus
        murs: murs,
        limiteJoueurs: A - 0.7,            // apothème jouable (devant les dalles)
        piliers: piliers,
        dalles: dalles,
        // Le boss flotte autour de ces ancres en phases 1 et 2 (y = hauteur des pieds ajoutée par la config)
        ancres: [{ x: 0, z: 0 }, { x: 0, z: 4.5 }, { x: 4.5, z: 0 }, { x: 0, z: -4.5 }, { x: -4.5, z: 0 }],
        centre: { x: 0, y: 0, z: 0 },
        cercle: { x: 0, z: 0, rayon: 4.5 },        // rituel de la phase 4 (le rayon de la config prime)
        arriveeJoueurs: [                           // téléportation au début du combat (face au centre)
          { x: -3, y: 0, z: -11, lacet: 0 }, { x: 3, y: 0, z: -11, lacet: 0 },
          { x: -1, y: 0, z: -12.2, lacet: 0 }, { x: 1, y: 0, z: -12.2, lacet: 0 }
        ],
        retourSalle: [                              // retour après la défaite (autour du cadavre)
          { x: -2.2, y: 0, z: -5.5, lacet: 0.35 }, { x: 2.2, y: 0, z: -5.5, lacet: -0.35 },
          { x: -4.8, y: 0, z: -2.5, lacet: 1.1 }, { x: 4.8, y: 0, z: -2.5, lacet: -1.1 }
        ],
        breches: breches,                           // grilles au sol d'où sortent les zombies « normaux »
        cadavre: { x: 0, y: 0, z: 0.6, lacet: Math.PI },
        // v1.3 : les cuves vertes (dos au mur) ; chacune retient un mini-boss que le Septième libère en phase 2 en la
        // siphonnant (API.md §15). Rayon et hauteur du verre (m). v1.4 : 3e cuve au milieu du mur nord, entre la table de
        // laboratoire et la cage (API.md §16.1).
        tubes: [
          { id: 'tube0', x: 11.918, y: 0, z: 4.937, lacet: 4.32, rayon: 0.85, hauteur: 2.6, miniBoss: 'survolte' },
          { id: 'tube1', x: -11.918, y: 0, z: -4.937, lacet: 1.178, rayon: 0.85, hauteur: 2.6, miniBoss: 'irradie' },
          { id: 'tube2', x: 0, y: 0, z: 13.1, lacet: Math.PI, rayon: 1.3, hauteur: 4.4, miniBoss: 'demembre' }   // v1.5 : cuve géante (Démembré ×2)
        ],
        autel: { x: -4.8, y: 0, z: 12.3, lacet: Math.PI },   // récompenses qui n'entrent pas dans l'inventaire (dégage la brèche nord)
        lumieres: [
          { type: 'lustre', x: 0, y: 7.2, z: 0 },
          { type: 'brasero', x: 6.72, y: 0, z: 6.72 }, { type: 'brasero', x: -6.72, y: 0, z: 6.72 },
          { type: 'brasero', x: 6.72, y: 0, z: -6.72 }, { type: 'brasero', x: -6.72, y: 0, z: -6.72 }
        ]
      },
      // Points de la carte Bunker 7 utilisés par la phase 5 et le retour final. À REMPLIR avec les vraies
      // positions de Bunker 7 lors de l'intégration (le prototype fournit les siennes, sur sa maquette).
      // Zombie Survival (étape 8) : points de Bunker 7, au centre de cases libres (coordonnées du monde : x = colonne + 0,5,
      // z = ligne + 0,5), loin des caisses, des machines, des boîtes et du Glas (docs/audit-bunker7.md) ; lacet π : regard
      // au nord, comme le départ de la carte.
      bunker7: {
        arriveeJoueurs: [                  // où les joueurs se réveillent après la capture de leur âme : Salle d'arrivée
          { x: 24.5, y: 0, z: 21.5, lacet: Math.PI }, { x: 22.5, y: 0, z: 21.5, lacet: Math.PI },
          { x: 26.5, y: 0, z: 21.5, lacet: Math.PI }, { x: 24.5, y: 0, z: 23.5, lacet: Math.PI }
        ],
        apparitionsBoss: [                 // où le boss peut apparaître / réapparaître (≥ 6 points répartis) : les 4 pièces
          { x: 16.5, y: 0, z: 5.5 }, { x: 30.5, y: 0, z: 5.5 }, { x: 36.5, y: 0, z: 9.5 },   // Salle des machines
          { x: 40.5, y: 0, z: 14.5 }, { x: 44.5, y: 0, z: 24.5 },                           // Entrepôt
          { x: 8.5, y: 0, z: 14.5 }, { x: 10.5, y: 0, z: 24.5 },                            // Infirmerie
          { x: 30.5, y: 0, z: 25.5 }                                                        // Salle d'arrivée
        ],
        retourJoueurs: [                   // où les joueurs reprennent la partie après la victoire : Salle d'arrivée
          { x: 24.5, y: 0, z: 17.5, lacet: Math.PI }, { x: 22.5, y: 0, z: 17.5, lacet: Math.PI },
          { x: 26.5, y: 0, z: 17.5, lacet: Math.PI }, { x: 24.5, y: 0, z: 15.5, lacet: Math.PI }
        ],
        apparitionsZombies: [              // phase 5 : sorties de terre des zombies du combat (étape 9) et failles des chiens
          { x: 19.5, y: 0, z: 15.5 }, { x: 31.5, y: 0, z: 15.5 },                           // Salle d'arrivée
          { x: 45.5, y: 0, z: 16.5 }, { x: 36.5, y: 0, z: 24.5 },                           // Entrepôt
          { x: 6.5, y: 0, z: 16.5 }, { x: 14.5, y: 0, z: 21.5 },                            // Infirmerie
          { x: 20.5, y: 0, z: 5.5 }, { x: 34.5, y: 0, z: 9.5 }                              // Salle des machines
        ]
      }
    };
  }

  var ARENE = construire({ origine: { x: 26, y: 0, z: 100 } });   // Zombie Survival : salle secrète de Bunker 7 (étape 4)
  ARENE.construire = construire;
  if (typeof module === 'object' && module && module.exports) module.exports = ARENE;
  if (root) root.BOSS_B7_ARENE = ARENE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
