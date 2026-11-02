# Boss de Bunker 7 : essais à faire sous Windows

Ce que les essais automatiques ne peuvent pas juger : ils tournent en rendu logiciel, sans son ni vraie carte graphique. Liste demandée par Anthony le 1er novembre 2026, à garder à jour. Elle concerne le jeu 2.0.7, branche `chantier/bunker7` ; le détail du combat est dans `SUIVI-BOSS-B7.md` et dans le README (« Boss de Bunker 7 »).

## Préparer

- **Deux façons de jouer le combat** :
  - partie normale sur Bunker 7, avec le code du boss au digi pass (une fois par partie) ;
  - partie de test des Mod Tools (Bunker 7, bouton Test). **F8** y ouvre le panneau du boss : aller à un état, vitesse × 0,5 à × 4, joueur invincible, mini-boss, volumes. Il se referme seul à la fin du test.
- **Installer ce jeu** : tant que la session d'intégration n'a pas posé les numéros, il porte ceux du jeu 2.0.6 (2.0.6, interface 9, construction 1). Un launcher qui a déjà un jeu à ces numéros ne le remplace pas par celui-ci, et les Mod Tools prennent alors le jeu installé : la façon d'installer ce jeu pour les essais (numéros posés, ou construction d'essai) est à décider avec Anthony avant de faire l'installateur.
- **Images par seconde** : la barre de jeu Xbox de Windows (Win + G, widget « Performances ») ou l'affichage de la carte graphique (NVIDIA, AMD).
- **Pour chaque problème** : noter l'heure, la phase et ce qu'on voyait, faire une capture (Win + Maj + S) et me le dire.

## 1. Fluidité

Viser 60 images par seconde en 1920 × 1080, effets et ombres réglés comme d'habitude.

- [ ] Première entrée dans la salle (écran noir de l'introduction) : aucun à-coup ensuite. La compilation des matières se fait pendant le noir.
- [ ] Phase 1, de près et de loin du Septième.
- [ ] Rituel, avec ses 22 zombies au sprint : le moment le plus chargé.
- [ ] Rages des mini-boss : murs électrifiés (Survolté), infection verte (Irradié), bras et petits Démembrés.
- [ ] Phase 5 dans Bunker 7 : obscurité, traque, sorties de terre.
- [ ] Fenêtre plus petite que 600 px de haut : l'interface du combat se chevauche-t-elle ? (problème connu, mise en page du paquet)
- [ ] Mémoire (Gestionnaire des tâches, processus du jeu) : sur Bunker 7, puis après être passé sur Khamsin. En quittant Bunker 7, seuls les sons décodés (≈ 173 Mo) sont libérés ; la salle, le modèle et les effets restent pour la session.

## 2. Sons

Aucun son du combat n'a encore été écouté par personne.

- [ ] Musique de chaque phase et ses enchaînements : introduction, phase 1, répit (la phase 2 tombe pile à la fin), phase 2, absence, phase 3, rituel, faiblesse, phase 5, défaite, victoire.
- [ ] Volumes : le combat face aux sons du jeu ; réglages Musique et Effets du jeu ; étouffement quand le joueur est à terre.
- [ ] Sorts, impacts, ailes, piqué, blocs arrachés, piliers, cuves (siphon, fissure, éclatement), crochets.
- [ ] Mini-boss : boucles sonores qui les suivent, rages, morts ; murs électrifiés ; aura et zones de L'Irradié.
- [ ] Chiens (failles, morsures) ; zombies qui sortent de terre en phase 5 (son au point de sortie) ; Septième invisible (on doit l'entendre).
- [ ] Annonces (« Munitions max », etc.) : pas deux voix l'une sur l'autre.
- [ ] Pause, fin de partie et menu : la musique du combat s'arrête (corrigé à l'étape 9).

## 3. Animations

- [ ] Le Septième : déplacements, sorts, ailes et piqué, frappes, lames bleues puis rouges, crochet, téléportations, intangibilité (il s'efface, traverse les murs, resurgit), faiblesse, défaite.
- [ ] Mini-boss : sortie de cuve, déplacements, capacités, rages, morts (flaque toxique, effondrement).
- [ ] Petits Démembrés, chiens (failles), zombies (brèches de la salle, sorties de terre).
- [ ] Joueur :
  - étourdissement : voile électrique, la vue ne tremble pas ;
  - vision brouillée ;
  - projection par la charge : glissade à plat ;
  - crochet : traction, caméra libre ;
  - jamais de secousse de caméra (vertige).
- [ ] Scènes (introduction, capture des âmes, défaite) : regard tourné doucement vers le Septième, jamais pendant un crochet.

## 4. Progression du combat

- [ ] Un combat complet sans le panneau : durée totale, difficulté, enchaînements, aucune attente sans rien à faire.
- [ ] Calibrage, décision du 1er novembre 2026 à revoir en jeu :
  - finir la phase 1 à la Thompson au palier I du Glas, en tir continu : environ 28,5 s attendues à 60 images/s (27 s sur la fiche) ;
  - le noter à tes images par seconde (voir `docs/cadence-armes.md`).
- [ ] Mort à différents moments : fin de partie habituelle, sans blocage. À terre avec Quick Revive : relevé, le combat continue.
- [ ] Quitter au menu en plein combat : rien du combat ne reste au menu (corrigé à l'étape 9) ; nouvelle partie : le combat repart.
- [ ] Fin :
  - rituel achevé (F maintenue), message, retour dans Bunker 7 ;
  - les deux armes merveilles au palier III au sol, ramassées dans l'emplacement 1 puis 2 ;
  - les 5 atouts, les bonus ;
  - les manches qui reprennent.
- [ ] Code du boss :
  - une fois par partie, ensuite « Code erroné » ;
  - le digi pass ne disparaît qu'avec les deux codes ;
  - après la victoire, plus de combat dans la partie.

## 5. Comportement des zombies

- [ ] Phase 5, décision du 2 novembre 2026 : les zombies du combat sortent de terre dans les pièces, à 8 m au moins du joueur, même à terre. L'émergence du paquet accompagne chaque sortie : le sol se fend et rougeoie, avec poussière, braises et un bref éclair, plus son son. L'apparition est-elle crédible, lisible dans l'obscurité, ni trop ni pas assez visible ?
- [ ] Dans la salle :
  - les zombies foncent sur le joueur dès leur apparition et contournent les piliers ;
  - aucun ne reste bloqué (gravats, cuves, autel) ;
  - les brèches s'ouvrent.
- [ ] Chiens : meute à 50 % de la phase 1, ils restent jusqu'à la fin, reviennent en phase 5 dans Bunker 7.
- [ ] Infection (Irradié) : zombies et chiens verts, petite aura ; normaux à sa mort.
- [ ] Phase 5 : portes toutes ouvertes ; le Septième suit les couloirs, ne passe pas à travers les murs (sauf invisible).

## 6. Choix à rejuger en jeu

- [ ] « Munitions max » : réserves et grenades, pas les chargeurs (règle du jeu gardée le 1er novembre 2026, pour toutes les cartes).
- [ ] `DPS_REFERENCE` = 1 393 (gardé provisoirement) ; voir le calibrage plus haut.
- [ ] Obscurité de la phase 5 : brume plus dense, lampes à 75 %, voile sur les bords ; assez sombre, ou trop ?
- [ ] Mesures d'équilibrage du paquet (zombies, dégâts, chargeurs) face aux règles du jeu.
