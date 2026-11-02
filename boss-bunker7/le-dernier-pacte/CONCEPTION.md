# Le Dernier Pacte — conception du combat final de Bunker 7

Boss : **Le Septième**, antagoniste original de Zombie Survival. Ancien directeur du programme occulte de Bunker 7, il s'est soumis lui-même au Pacte et s'est lié aux âmes des morts du bunker. Taille humaine (1,75 m), crâne rasé gravé d'un sceau à sept branches qui luit, yeux incandescents, long manteau de cuir en lambeaux, étole rituelle, fioles d'âmes. Il ne dit aucun mot : seulement des vocalises.

Choix de contenu : aucune personne réelle n'est représentée (ni nom, ni visage). Aucun symbole nazi réel n'apparaît (croix gammée, runes, aigle, croix, insignes). Les symboles occultes sont tous inventés : cercles, arcs, points, spirales et le sceau à sept branches. Aucune pose ne ressemble à un salut : un contrôle automatique vérifie chaque pose où un bras est tendu.

Tous les chiffres ci-dessous viennent de `src/config.js` (configuration centrale). Ils s'ajustent sans toucher au code.

## Version 1.5 (demande d'Anthony après la v1.4)

Choix d'Anthony : le bras du Démembré libère un **flot continu plafonné** de Démembrés ; les zombies irradiés ont une **lueur verte et une petite aura**.

1. **Rages des mini-boss**, une seule fois chacun, quand il passe sous **la moitié de ses PV** :
   - **Le Survolté** se fige, bras levés, **invulnérable 2,5 s** (« Invulnérable » sur sa barre) : un rayon d'énergie part du torse du Septième jusqu'à lui, il s'illumine. L'effet est **seulement visuel** : les PV du Septième ne bougent pas. Puis il **électrifie les 8 murs** de la salle (pas le sol) jusqu'à sa mort : arcs qui courent sur les murs et la bordure du plafond, dalles bleutées, éclairs au hasard, grésillement continu de chaque mur, et un **liseré lumineux au sol à 2,2 m des murs**. Un joueur à moins de 2,2 m d'un mur perd **≈ 12 % de ses PV par seconde** (choc visible et audible). Bandeau « Murs électrifiés : restez loin des murs ». À sa mort, les murs s'éteignent en 1 s.
   - **L'Irradié** pousse un cri (1,2 s, il reste vulnérable) : une onde verte rejoint chaque zombie et chaque chien zombie de la salle, qui deviennent **irradiés jusqu'à sa mort** : lueur verte, grésillement, **aura de 1,5 m (≈ 4 % des PV par seconde)**. Tout zombie ou chien qui apparaît dans la salle pendant ce temps l'est aussitôt. À sa mort, tous redeviennent normaux.
   - **Le Démembré** (voir 2) se fige, **invulnérable 2,4 s**, **s'arrache le bras** et le **lance au milieu de la salle** (vol en cloche de 1,2 s). Le bras reste au sol, dans une mare de sang, tendons qui palpitent. Il en sort **un Démembré de taille normale toutes les 2,5 s** (au plus 6 vivants en solo, +2 par joueur), qui sort du sol en griffant : 250 PV, 4 m/s, fléau de 2,4 m (10 %). **Sans bras**, le géant **charge** : il gratte le sol 0,8 s, tête basse, puis fonce à 13 m/s en ligne droite (16 m au plus). Touché : **35 %** des PV et **projeté** ; projeté contre un mur : **+10 %**. S'il heurte lui-même un mur, il reste étourdi 1,2 s. À sa mort, le bras se flétrit et tous les petits Démembrés s'effondrent : **fin du 3e combat de mini-boss**.
2. **Le Démembré géant** : **2 fois plus grand et plus large** (≈ 3,9 m), sa cuve agrandie en conséquence (rayon 1,3 m, 4,4 m de haut). Son **fléau porte à 6 m** (2,6 m avant), préparation 0,7 s. Cri, râle, fléau et mort plus graves.
3. **« Munitions max »** au sol à la mort de **chaque** mini-boss (là où il tombe, 30 s).
4. **Phase 5 : les illusions sont supprimées.** À la place, à partir de **50 %** de la jauge, **intangibilité** : quand plus aucun joueur n'est à moins de 10 m de lui depuis 1,5 s, il s'efface (0,7 s, fumée sombre) et devient **invisible et intangible** : les balles le traversent, la jauge ne bouge pas, on l'entend seulement (présence sonore à 8 m). Il fonce en ligne droite à 6,5 m/s vers le joueur le plus proche **en traversant les murs** (le mur ondule, poussière, son de pierre). **Après avoir passé un mur**, dès qu'un joueur est à 6 m en vue, il **resurgit** (fumée rouge sombre), **fond sur lui** (jusqu'à 1,8 m) et **frappe** (règle du palier : 1 % des PV). Entre sa réapparition et le coup : 1 s, assez pour s'écarter. S'il n'est près d'aucun joueur, il **recommence** (pas avant 6 s). Les crochets du palier 75 % restent.

## Version 1.4 (demande d'Anthony après la v1.3)

Choix d'Anthony : zones radioactives sans plafond ; 2 boules par salve en solo, +1 par joueur ; salves de 4 blocs en phase 3 ; illusions dissipées par une balle et de retour 8 s plus tard.

1. **Troisième cuve** au milieu du mur nord, l'endroit vide de la photo d'Anthony, entre la table de laboratoire et la cage. Elle retient **Le Démembré** (fiche N°02, « brute », 1,95 m). Quand le Septième n'a plus que **25 %** de ses PV de phase 2, il la siphonne comme les deux autres. Le Démembré a 5 705 PV en solo et avance à 4,2 m/s d'une démarche lourde et boiteuse, l'épaule gauche affaissée. Son bras gauche pend, relié par des tendons, et se balance. **Fléau** : il fait tournoyer ce bras pendant 0,55 s, puis frappe en arc large (150°, 2,6 m) pour 30 % des PV. Son bras ne se détache jamais (pas de faiblesse).
2. **L'Irradié**, nettement renforcé :
   - il marche à **4,4 m/s** (avant 2,8) ;
   - son aura passe de 3 à **6 m** ;
   - toutes les 6 s, il lance une salve de boules radioactives en cloche : **2 en solo, +1 par joueur**. En solo, la 2e boule vise là où tu vas. Le point d'impact est marqué au sol dès le lancer ;
   - chaque impact crée une **zone radioactive** de 2,5 m qui reste **jusqu'à sa mort**, sans plafond. Les dégâts montent avec le temps passé dedans : la traverser coûte peu, y rester ≈ 5,5 s tue.
3. **Le Survolté** court à **5,4 m/s** (avant 4,2). Sa décharge touche **chaque joueur** à 8 m en vue, en même temps, et **étourdit 1 s** : ni déplacement, ni saut, ni tir, ni rechargement, la vue tremble.
4. **Phase 3, sous 50 % de ses PV** : chaque arrachement devient une **salve de 4 blocs**. Il désigne 4 dalles à la fois, les arrache ensemble et les lance à 0,12 s d'écart (≈ 0,4 s pour les quatre). Les blocs sont **répartis entre les joueurs** : 4 sur le joueur seul, 2 + 2 à deux, 1 chacun à quatre. Les visées sont décalées : rester immobile fait tout encaisser, bouger en évite la plupart. Chaque bloc enlève toujours au moins 25 %, et les piliers les arrêtent.
5. **Phase 4** : des zombies arrivent aussi pendant que le Septième est affaibli à terre (un toutes les 1,2 s, 10 au plus en solo).
6. **Phase 5**, selon la jauge « Rompre le pacte ». Un palier atteint reste acquis, même quand la jauge redescend.
   - **Au début** : lames **bleu très clair** (verre glacé, veines presque blanches). Chaque coup enlève 50 % des PV : **deux coups tuent**.
   - **25 %** : les lames s'embrasent et redeviennent **rouges**. **Chaque coup laisse à 1 %**, et un joueur déjà sous 5 % meurt. Après un coup, il disparaît 10 s comme avant.
   - **50 %** : des **illusions** du Septième apparaissent dans tout le bunker (3 en solo, +1 par joueur). Elles traquent chacune un joueur et font ses gestes, sans aucun dégât, avec des **lames vertes**. Une balle en dissipe une dans une bouffée de fumée verte ; elle revient ailleurs 8 s plus tard. Elles ne remplissent pas la jauge. *(Supprimées en v1.5 : intangibilité à la place.)*
   - **75 %** : il lance des **crochets**, au plus une fois toutes les 15 s, un vers chaque joueur à 4–22 m en vue. Un pas de côté les évite. Un joueur accroché perd ses commandes et il est tiré devant le Septième, qui frappe aussitôt (règle du palier : 1 %).

## Version 1.3 (demande d'Anthony après la v1.2)

D'après les deux fiches d'Anthony (N°06 « Le Survolté », N°04 « L'Irradié »). Choix d'Anthony : un mini-boss à la fois ; le Septième continue d'attaquer pendant qu'ils sont là ; d'abord Le Survolté, puis L'Irradié.

1. **Deux cuves vertes** entièrement modélisées, dos au mur (à la place des anciennes cuves brisées) : socle, cylindre de verre, liquide vert lumineux qui bouillonne, câbles, et dans chacune un mini-boss endormi qui flotte. Elles restent des obstacles, intactes ou brisées.
2. **Phase 2, quand le Septième a perdu 25 % de ses PV** : ses PV s'arrêtent net à 75 % (même un énorme coup ne fait pas sauter ce seuil) et il devient **protégé**. Il se tourne vers la cuve du Survolté, lève les bras et la **siphonne** à distance : un flot d'énergie verte part de la cuve jusqu'à ses mains, le liquide bouillonne et baisse, le verre se fend, puis la cuve **éclate** (gerbe de verre, éclaboussure verte, onde) et **Le Survolté** en sort à quatre pattes avant de se redresser.
3. **À 50 %** (atteignable seulement après la mort du Survolté) : même chose avec la seconde cuve, d'où sort **L'Irradié**.
4. **Tant qu'un mini-boss vit, le Septième est invulnérable** (« Protégé : abattez Le Survolté ») et **continue d'attaquer** : sorts, absorptions d'âmes, ailes et piqué. Un lien d'énergie pulsé relie sa poitrine au mini-boss et un voile l'entoure. À la mort du mini-boss, le voile se brise et ses PV repartent du seuil.
5. **Le Survolté** (électricien de ligne foudroyé, 1,80 m) : 4 900 PV en solo, rapide (4,2 m/s). Il se tient à 5–7 m de sa cible ; toutes les 4 s, après 0,7 s de charge bien audible, il lance une **décharge** (8 m au plus, en ligne de vue) : 15 % des PV et **vision brouillée** 1 s ; puis il reste **2 s immobile** (le moment de le punir). Coup au contact : 24 %. Spasmes, arcs électriques entre ses mains et le sol.
6. **L'Irradié** (technicien de centrale, 1,90 m) : 7 350 PV en solo, lent (2,8 m/s), pas traînants. **Aura** de 3 m : 7 % des PV par seconde. Coup au contact : 16 %. À sa mort, **flaque toxique** de 2,5 m pendant 5 s. On l'abat à distance.
7. Chaque mini-boss a **sa barre de PV à son nom sous celle du Septième** (cyan pour Le Survolté, vert pour L'Irradié ; « Abattu » puis disparition 3 s après sa mort), une carte de titre et un message à sa libération, **ses sons** (cuve aspirée, verre qui se fend, éclatement, cri, bourdon électrique, charge, décharge, spasmes, mort en court-circuit ; compteur Geiger qui s'affole quand on approche, respiration gargouillante, mort, flaque qui grésille) et **ses animations**.

## Version 1.2 (demande d'Anthony après la v1.1)

1. **Seconde moitié de la phase 1** (PV de la phase 1 sous 50 %) : chaque sort devient une **paire de sorts lancés sous le joueur**, à 1 à 2 s d'écart. Le point d'impact est choisi au moment du tir, là où se trouve le joueur : le cercle maudit apparaît sous ses pieds, marqué 0,6 s avant de s'activer (plus le temps de vol), puis le second tombe là où il s'est réfugié. Un pilier entre le boss et le joueur arrête le sort.
2. **Chiens zombies**, lâchés au même moment et présents **jusqu'à la mort du boss, sans exception** : 2 en même temps en solo, +1 par joueur supplémentaire. Chacun jaillit d'une faille de braises qui s'ouvre au sol 0,9 s avant lui. Un chien tué est remplacé 10 à 15 s plus tard. Ils ne sont touchés par aucun « nettoyage » (répit, retour en rage, explosion du rituel, capture des âmes), suivent les joueurs dans Bunker 7 en phase 5 (ils y reviennent 4 s après le réveil) et tombent en cendres à la mort du boss. Chien du prototype : 70 PV, 7,4 m/s (plus rapide que le sprint du joueur, 6,6 m/s), morsure de 5 % des PV toutes les 0,9 s.

Réglage fait pour garder le combat jouable : avec les chiens prévus au départ (100 PV, 10 % par morsure, remplaçant après 4 à 7 s), le robot de test ne gagnait plus qu'une fois sur 5 en solo. Le nombre de chiens reste celui choisi par Anthony ; leurs PV, leurs dégâts et leur délai de retour ont été baissés.

## Version 1.1 (demandes d'Anthony après la v1.0)

1. **Zombies au sprint et agressifs** pendant tout le combat : ≈ 6 m/s, poursuite immédiate. Le joueur marche à 4,6 m/s et sprinte à 6,6 m/s : on ne les distance qu'en sprintant, sans tirer.
2. **Phase 3** : chaque pilier qui reçoit **3 blocs** s'effondre (fissures après le 1er et le 2e, effondrement au 3e) et ne protège plus. Des zombies arrivent 5 s après le retour en rage et traquent les joueurs (8 au plus en solo).
3. **Musique plus forte** : ≈ +4,3 dB, avec un limiteur pour ne jamais saturer.
4. **« Munitions max » à la fin de chaque phase** : posé au sol (sous le boss, près du point de réveil en phase 5, près du cadavre à la fin). Le ramasser remplit chargeur et réserve de tous ; l'annonceur dit « Munitions max ! ».
5. **Phase 4** : la horde passe de 12 à **22** zombies simultanés en solo, un nouveau chaque seconde. Le cercle n'est contesté qu'à partir de 6 zombies dedans.
6. **Phase 5** : s'il encaisse **≈ 18 balles en 3 s** (630 dégâts, +75 % par joueur supplémentaire), il se téléporte ailleurs dans le bunker (12 à 32 m du tireur) et reprend sa traque. Un **cercle rituel** se dessine au sol au départ et à l'arrivée. Criblé pendant l'élan de sa frappe, il s'enfuit au lieu de frapper.

Ajustements faits pour garder le combat jouable avec ces changements : PV de la phase 3 de 12 600 à 10 500 (le temps passé sur les zombies rallongeait la phase d'un tiers), invulnérabilité après la frappe spéciale de 1,5 à 3 s (à 1 % des PV, des sprinteurs achevaient presque toujours le joueur).

## Déroulé

**Quête accomplie** → fondu et téléportation dans la **Chambre du Pacte** (salle secrète octogonale, invisible depuis la carte) → présentation du boss → Phase 1 → **répit de 15 s** → Phase 2 → **absence de 30 s** puis retour en rage → Phase 3 → rituel de 30 s (Phase 4) → boss affaibli → capture des âmes → Phase 5 dans Bunker 7 plongé dans le noir → défaite → retour dans la salle → interaction sur le cadavre → récompenses → message final → retour dans Bunker 7, la partie continue.

| Phase | Mécanique | Ce que voient et entendent les joueurs | Comment le battre |
|---|---|---|---|
| Introduction | Téléportation de tous les joueurs ; le boss se forme au centre, en lévitation | Distorsion, fondu au noir, énergie qui converge, rugissement, carte de titre, bandes cinéma | Joueurs invulnérables et sans contrôle (≈ 7 s) |
| 1 · L'Invocation des morts | Sorts lancés vers le sol : chaque impact crée une zone maudite (dégâts par seconde) et fait émerger 2 à 3 zombies. Un trait direct punit l'immobilité. **Sous 50 % de ses PV** : chaque sort devient une paire lancée sous le joueur (1 à 2 s d'écart) et la **meute de chiens zombies** est lâchée (jusqu'à la mort du boss) | Bras levés, énergie dans les mains, projectile avec traînée, cercle marqué au sol avant activation, sol qui craque | Tirer sur le boss entre les sorts : 9 450 PV en solo |
| Répit | Exactement 15 s, zombies retirés | Compte à rebours, musique tendue, coup final qui lance la phase 2 | Recharger, se soigner |
| 2 · L'Absorption des âmes | Invocations plus nombreuses. Toutes les 3 à 4 s, il saisit jusqu'à 4 zombies et arrache leur âme. Après **10 âmes** (compteur fiable), ses ailes apparaissent et il **pique** sur un joueur. **À 75 % puis à 50 % de ses PV**, il siphonne une cuve qui libère un mini-boss (Le Survolté, puis L'Irradié) : invulnérable tant que le mini-boss vit, il continue d'attaquer | Zombies figés et soulevés, âmes spectrales qui volent jusqu'à sa poitrine, aura qui grandit. Ailes en 3D qui se déploient. Ligne de visée rouge au sol pendant 1,1 s, verrouillée 0,4 s avant la charge, cri d'alerte reconnaissable | Tirer pendant les absorptions (**+50 % de dégâts**). Esquiver le piqué de côté (60 % des PV). Il perd ses ailes après chaque piqué et doit réabsorber 10 âmes. **Abattre chaque mini-boss** pour pouvoir le blesser de nouveau. 23 100 PV en solo |
| 3 · La Colère du bunker | Il disparaît **30 s** : les zombies continuent d'affluer. Puis il revient en rage et réduit tous les zombies en cendres ; **5 s plus tard, de nouveaux zombies arrivent et traquent les joueurs** (8 au plus en solo). Il **arrache des portions de mur** et les projette (≥ **25 %** des PV max par impact, sans réduction par les atouts). Un bloc qui heurte un **pilier** s'y écrase ; **au 3e bloc, le pilier s'effondre** et ne protège plus jusqu'à la fin du combat. Onde de choc si on reste collé à lui | Compte à rebours, cœur qui accélère, retour spectaculaire. Il désigne une dalle : fissures lumineuses, arrachement en gerbe de débris, bloc qui flotte, projection, impact. Pilier touché : éclats, poussière, fissures ; effondré : nuage de poussière, secousse, tas de gravats. Les dalles des murs se reforment après 14 s | Esquiver les blocs (au plus 2 en l'air à la fois, trajectoire prévisible), se cacher derrière les piliers tant qu'ils tiennent, tenir les zombies à distance. Il résiste plus (×0,6) : 10 500 PV en solo |
| 4 · Le Rituel de purification | Il disparaît et un cercle de 4,5 m se dessine au centre. Il faut le **tenir 30 s** face à une **horde de 22 zombies** (un nouveau chaque seconde, +4 par joueur supplémentaire). Cercle vide 1 s : la progression redescend (règle affichée). Six zombies dans le cercle : capture « contestée » (en pause). En coop, être plusieurs ne va pas plus vite | Cercle tracé en plusieurs étapes, glyphes qui s'allument, anneau de progression, temps restant. À la fin : faisceau vers le plafond, tremblement, explosion de lumière | Tenir le cercle, tuer les zombies qui y entrent |
| Faiblesse | Ramené de force, il est **inoffensif** : il flotte difficilement, s'effondre à moitié, ses pouvoirs vacillent | Lent, souffrant, étincelles instables | 4 200 PV en solo, dégâts ×1,25 |
| Transition | Capture des âmes des joueurs (scénarisée, inévitable, ≈ 5 s) | Vrilles vers chaque joueur, sons étouffés, écran qui sombre dans le noir | — |
| 5 · Le Dernier Pacte | Les joueurs se réveillent dans Bunker 7 avec une **visibilité très réduite** (≈ 7 m). Il les traque partout avec **deux lames** rouge sang. Sa **frappe spéciale** laisse le joueur à **1 %** de ses PV (invulnérable 3 s, pas de seconde frappe spéciale avant 15 s), puis il disparaît 10 s et revient. **Criblé de balles** (≈ 18 balles en 3 s), il se **téléporte** ailleurs dans le bunker, même pendant l'élan de sa frappe, et reprend sa traque (au plus une fois toutes les 5 s) | Brouillard, voile, distorsion, murmures qui montent quand il approche. Lames qui saignent (gouttes au sol). Lueur rouge et cri strident avant la frappe, vignette « état critique » et battement de cœur. **Cercle rituel** rouge-orangé au sol à chaque téléportation (départ et arrivée), message « retrouvez-le » | Remplir la jauge « Rompre le pacte » : 6 300 dégâts. Elle **redescend** (12 %/s) si personne ne le touche pendant 2 s, et reste **gelée** pendant ses disparitions et ses téléportations (puis 8 s, ou jusqu'au prochain tir qui le touche) |
| Fin | Il s'effondre, les lames se désintègrent, retour dans la salle, cadavre au sol | Pouvoirs qui s'éteignent, ambiance qui s'apaise, fumée | **Maintenir E** près du corps (2,5 s), validé pour tous les joueurs |
| Récompenses | Chaque joueur reçoit une fois : les **2 armes merveilles PaP 3**, **tous les atouts** de la carte et les **9 bonus**. Si l'inventaire est plein, l'arme va sur l'autel et n'est jamais perdue | Colonne de lumière, cloches, liste des récompenses | — |
| Message | « Félicitations ! Vous avez terminé l'histoire principale de Bunker 7 ! La suite de votre aventure vous attend sur Khamsin… » (texte exact dans la config) | Apparition soignée en haut de l'écran, 10 s, son dédié | La partie continue (manches, secrets), le combat ne peut plus se relancer |

**Fin de chaque phase** (1 à 5) : un bonus **« Munitions max »** apparaît au sol pendant 30 s ; le ramasser remplit les munitions de tous, et l'annonceur le dit.

## Coop

- Nombre de joueurs n : PV × (1 + (n − 1)), jauge × (1 + 1,5 × (n − 1)), +4 zombies simultanés par joueur supplémentaire, seuil de téléportation sur dégâts × (1 + 0,75 × (n − 1)).
- La mise à l'échelle suit les arrivées et les départs en cours de combat (sans soin brutal ni saut de phase). Mourir puis réapparaître ne change rien.
- Le boss alterne ses cibles. Les téléportations utilisent 4 points par lieu. L'interaction finale vaut pour tous, et les récompenses sont données une seule fois par joueur.

## Durées mesurées (simulation, v1.5)

Moyennes sur les combats gagnés, 40 graines par mode (simulateur de la logique, robots « moyens » ; `NG=40 node tests/logique/campagne.js`).

| | Victoires (5 graines de réf. · 40) | Phase 1 | Phase 2 (dont mini-boss) | Phase 3 | Phase 4 (dont faiblesse) | Phase 5 | Total |
|---|---|---|---|---|---|---|---|
| Solo, tir continu | 5/5 · 37/40 | 40 s | 166 s (91 s) | 68 s | 53 s (14 s) | 62 s | ≈ 8,2 min |
| 4 joueurs, tir continu | 5/5 · 40/40 | 29 s | 146 s (82 s) | 55 s | 49 s (10 s) | 67 s | ≈ 7,4 min |
| Solo, arme du prototype (30 balles, 2,1 s de rechargement) | **0/5 · 6/40** | 112 s | 308 s (176 s) | 148 s | 92 s (54 s) | 95 s | ≈ 14,3 min |
| 4 joueurs, arme du prototype | 5/5 · 35/40 | 51 s | 248 s (142 s) | 102 s | 59 s (21 s) | 109 s | ≈ 11,2 min |
| Prototype complet (navigateur) : joueur passif + 3 coéquipiers simulés immortels | victoire | 62 s | 244 s | 110 s | 60 s (21 s) | 261 s | ≈ 14 min |

Mini-boss (solo, arme du prototype, combats gagnés) : Survolté 41–66 s, Irradié 44–58 s, Démembré 52–64 s.

**Réglage appliqué** après une première mesure de la v1.5 telle que demandée (solo, arme du prototype : 2/40 ; coop 4 : 35/40) : petits Démembrés de 450 à **250 PV**, leur fléau de 15 à **10 %**. Rien d'autre n'a été touché.

**Le solo avec l'arme du prototype reste très dur : 6 victoires sur 40** (v1.4 : 9/40). Morts sur 40 combats : 26 en phase 2, 5 en phase 1, 2 en phase 3, 1 pendant la faiblesse ; par cause : **21 par les zombies ordinaires**, 3 par la décharge du Survolté, 3 par le piqué, 2 par le fléau du Démembré, 2 par des blocs, 1 par un petit Démembré, 1 au contact du Démembré, 1 par un chien. Les nouvelles mécaniques blessent peu le robot (somme des dégâts par combat, en PV max : murs ≈ 0 %, aura des irradiés ≈ 1 %, petits Démembrés ≈ 5 %, charges ≈ 11 %) ; c'est la durée de la phase 2 (≈ 5 min avec trois mini-boss) sous un flux continu de zombies au sprint qui use le robot. L'objectif « solo ≥ 3/5 » ne s'atteint pas en jouant seulement sur les PV, dégâts et distances des mécaniques v1.5. Leviers, à décider par Anthony : dégâts des zombies ordinaires en phase 2 (`zombies.*`), leur nombre (`phase2.invocation.zombiesMax`), `miniBoss.*.pv` (phase 2 plus courte).

La fente du resurgissement (phase 5) ne change pas ces taux : les robots fuient 0,45 s après la réapparition et l'esquivent tous ; un joueur qui ne bouge pas est touché.

## Durées mesurées (simulation, v1.4)

Moyennes sur les combats gagnés, 40 graines par mode (simulateur de la logique, robots « moyens »).

| | Victoires (5 graines de réf. · 40) | Phase 1 | Phase 2 (dont mini-boss) | Phase 3 | Phase 4 (dont faiblesse) | Phase 5 | Total |
|---|---|---|---|---|---|---|---|
| Solo, tir continu | 4/5 · 38/40 | 40 s | 154 s (78 s) | 67 s | 53 s (14 s) | 61 s | ≈ 8 min |
| 4 joueurs, tir continu | 5/5 · 40/40 | 29 s | 139 s (76 s) | 54 s | 48 s (10 s) | 64 s | ≈ 7,3 min |
| Solo, arme du prototype (30 balles, 2,1 s de rechargement) | **1/5 · 9/40** | 117 s | 278 s (143 s) | 149 s | 85 s (46 s) | 139 s | ≈ 14,5 min |
| 4 joueurs, arme du prototype | 5/5 · 37/40 | 51 s | 250 s (135 s) | 110 s | 60 s (22 s) | 137 s | ≈ 11,8 min |
| Prototype complet (navigateur) : joueur passif + 3 coéquipiers simulés immortels | victoire | 61 s | 265 s | 111 s | 55 s (21 s) | 272 s | ≈ 14,5 min |

**La v1.4 rend le solo nettement plus dur.** Avec l'arme du prototype, le robot gagne 9 combats sur 40, contre environ 60 % en v1.3 (24/40). Ses morts sur 40 combats : 20 par des zombies (17 en phase 2), 5 par des blocs, 4 par la décharge, 1 par un chien, 1 par un piqué. Deux causes :
- **l'étourdissement du Survolté** (1 s toutes les 4 s) : le robot reste figé pendant que les zombies du Septième arrivent, et meurt 8 à 20 s après la libération, quels que soient les PV du Survolté ;
- **les salves de la phase 3** : en esquivant, il prend encore ≈ 2 blocs sur 4.

Variantes essayées sur 40 graines (solo, arme du prototype) :

| Variante | Réf. | 40 graines |
|---|---|---|
| v1.4 telle quelle | 1/5 | 9/40 |
| PV et dégâts allégés seulement (PV des mini-boss ÷ 2, phases 2 et 3 plus courtes, décharge 8 %) | 2/5 | 15/40 |
| Étourdissement 0,5 s | 1/5 | 10/40 |
| Étourdissement 0,5 s et salves plus douces (`predictions` [0, 0,3, 0,6, 0,9], `intervalle` [7, 9]) | 4/5 | 17/40 |

Le robot n'est pas un vrai joueur : il ne sort pas de portée pendant la charge de 0,7 s du Survolté, alors qu'un joueur attentif peut le faire. Les réglages restent ceux demandés par Anthony ; les leviers sont `miniBoss.survolte.decharge.etourdissement`, `phase3.salve.predictions` et `intervalle`, puis les PV et dégâts.

### Mesures de la v1.3 (pour comparaison)

| | Phase 1 | Phase 2 (dont mini-boss) | Phase 3 | Phase 4 | Phase 5 | Total | Victoires |
|---|---|---|---|---|---|---|---|
| Solo, robot « moyen », tir continu (5 graines) | 35–46 s | 119–131 s (Survolté 19–22 s, Irradié 23–26 s) | 65–68 s | 47–48 s | 29–69 s | ≈ 6,7 à 7,6 min | 5/5 |
| Solo, robot « moyen », arme du prototype : 30 balles, 2,1 s de rechargement (15 graines, combats gagnés) | 101–147 s | 205–247 s (Survolté 34–62 s, Irradié 41–54 s) | 149–161 s | 53–55 s | 68–152 s | 12 à 13,7 min | 11/15 |
| 4 joueurs, tir continu (5 graines) | 28–29 s | 112–116 s (18–21 s, 23–27 s) | 52–55 s | 47 s | 43–86 s | ≈ 6,5 à 7,2 min | 5/5 |
| 4 joueurs, arme du prototype (15 graines) | 47–52 s | 184–201 s (29–36 s, 43–50 s) | 93–99 s | 53–54 s | 58–124 s | 9,2 à 10,2 min | 15/15 |
| Prototype complet (navigateur) : joueur passif + 3 coéquipiers simulés immortels, qui abattent eux-mêmes les mini-boss | 67 s | 207 s | 110 s | 34 s (+ 18 s de faiblesse) | 258 s | ≈ 13,4 min | victoire |

La v1.3 rallonge la phase 2 d'environ 100 s en solo avec l'arme du prototype (v1.2 : 118–133 s) : ≈ 80 à 110 s de mini-boss et ≈ 10 s de siphons. En solo avec l'arme du prototype, les 4 échecs sur 15 arrivent en phase 1 (2, zombies), en phase 2 (1, décharge du Survolté) et en phase 5 (1). Le Survolté inflige au robot 105 à 180 % de ses PV par combat (la régénération du joueur rattrape entre deux décharges) ; L'Irradié, que le robot tient hors de son aura, 0 à 37 %. Réglages : `phase2.pv` (raccourcir la phase 2), `miniBoss.survolte.pv` / `irradie.pv`, `miniBoss.survolte.decharge.*`, `miniBoss.irradie.vitesse` / `aura.*` (le rendre plus menaçant), `phase1.secondeMoitie.doubleSort.ecart`, `chiens.profil`, `phase5.frappe.invulnerabilite`.

Les coéquipiers simulés du prototype visent mal dans le noir, et chaque téléportation sur dégâts leur fait perdre le boss : leur phase 5 dure bien plus longtemps que celle des robots de la logique. Les robots ne remplacent pas de vrais joueurs : ces durées servent à comparer les réglages entre eux. Les PV se règlent dans `config.js` (par phase, et `phase5.jauge.degatsRequis`).
