# Tête du Septième (boss de Bunker 7) — sculpture, cuisson, vérification

Tête du **Septième**, l'antagoniste monstrueux de Bunker 7 : personnage entièrement inventé, qui ne représente
aucune personne réelle (voir `boss/DESIGN.md`, « Apparence du Septième »). Sculptée par fonctions de distance
(SDF), maillée, dépliée et texturée hors ligne, puis empaquetée dans `out/boss-tete.js` (`BOSS_B7_TETE`).
Contrat de données : `out/CONTRAT.md` (inchangé dans sa forme : le modèle du corps la lit telle quelle).

## Ce que contient la tête

- Homme d'environ 55 ans, émacié : crâne entièrement rasé et un peu allongé (haut et arrière), orbites profondes,
  pommettes hautes et saillantes, joues creuses, nez long et mince légèrement busqué, lèvres minces et sombres,
  menton anguleux, oreilles normales, cou mince **fermé en bas** (fond plat à bord arrondi, sombre).
- Aucun cheveu, aucune moustache, aucune barbe : chaume gris très court peint sur la mâchoire seulement (rien
  au-dessus de la lèvre), sourcils gris clairsemés, ombre bleutée très légère du crâne rasé.
- **Sceau à sept branches inventé** gravé en cicatrices sur le crâne et le haut du front : nœud central en haricot
  cabossé (boucle fermée, sans point central) d'où partent sept branches sinueuses toutes différentes, ponctuées de
  renflements, prolongées pour certaines de points brûlés (9 au total). Bourrelets nacrés en relief, sillon central
  incandescent rouge-orangé (texture d'émission). Dessin à plat : `out/rendus/sceau_dessin_2d.png`.
- **Cicatrice chirurgicale** de la tempe droite à la mâchoire (≈ 20 cm, devant l'oreille puis le long de la
  mâchoire) : incision croûteuse, bords gonflés violacés, 26 agrafes d'acier en relief (canal métal de l'ORM).
- Peau très pâle gris-bleuté, cernes violacés, veines sombres autour des yeux et sur les tempes ; yeux séparés :
  sclère sombre injectée de sang, iris rouge incandescent.
- Bouche entrouverte (fente + cavité) : morphose de mâchoire (31 mm au menton), dents jaunies, langue, fond de
  gorge rougeoyant.

Budget : tête 14 904 triangles (9 648 sommets), dents 3 360, langue 624 ; textures 2048² (albédo, normales,
émission), 1024² (ORM), 512² (œil, émission de l'œil) ; fichier JS 2,0 Mo (textures incluses en data URI ; copies
séparées dans `out/textures/`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `bmodel.py` | SDF de la tête (`base_sdf`, bouche `mouth_carve`) : `head_sdf_coarse` (maillage) et `head_sdf` (avec marques) |
| `bmarques.py` | sceau à sept branches (dessin 2D → projection sur le crâne) et cicatrice agrafée : relief SDF fin et champs pour les textures |
| `bcommun.py` | outils de sculpture repris d'Anthony (paupières, oreille, superellipsoïdes, sillons) ; rampe C1 `ramp1` (évite un pli des normales au plan médian du crâne) |
| `bbouche.py` | poids de la mâchoire, morphose, dents, langue |
| `bskin.py`, `beyes.py` | masques et cartes (albédo, relief, rugosité, émission, métal) ; textures des yeux |
| `bbake.py` → `btex.py` → `beyes.py` → `bpack.py` | chaîne de cuisson (voir ci-dessous) ; `bmanifold.py` soude les sommets quasi confondus et sépare les arêtes pincées par la décimation |
| `verif_contrat.js` | 55 contrôles du fichier livré (champs, encodages, bornes, maillage fermé et manifold, fond du cou, morphose = rotation, poids) → `out/verif_contrat.txt` |
| `bverif_marques.py` | contrôles du sceau (7 branches exactement, un seul anneau, aucun croisement, aucune symétrie de rotation, aucune branche rectiligne, placement) et de la cicatrice → `out/verif_marques.txt` |
| `bverif_sdf.py` | continuité de la SDF (repère les boîtes de région trop serrées) |
| `bpreview.py`, `bpreview_bouche.py`, `vue_sculpt.html`, `shoot.js` | aperçus rapides de la sculpture (sans textures) |
| `apercu.html`, `shoot_apercu.js`, `rendus.py` | visionneur Three.js r128 qui décode le contrat ; rendus de contrôle |
| `bake_lib.py`, `mesh.py`, `sdf.py` | bibliothèques reprises du pipeline d'Anthony (inchangées) |
| `travail/` | données intermédiaires (≈ 360 Mo, régénérables) et essai dans le visionneur du modèle — à ne pas livrer |

## Régénérer

Dépendances Python : numpy, scipy, numba, scikit-image, fast-simplification, trimesh, xatlas, Pillow.

```
cd boss/tete
python3 bbake.py 0.6 15000 2048     # maillage 0,6 mm → ≈ 15 000 triangles, réparation, UV, texels (≈ 4 min)
AO_REDO=1 python3 btex.py           # textures de la tête (≈ 1 min 20)
python3 beyes.py                    # textures des yeux
python3 bpack.py out/boss-tete.js   # empaquetage (contrat)
node verif_contrat.js out/boss-tete.js > out/verif_contrat.txt
python3 bverif_marques.py out/rendus/sceau_dessin_2d.png > out/verif_marques.txt
python3 rendus.py                   # rendus (serveur statique : python3 -m http.server 8791 depuis scratchpad/)
```
Aperçu rapide de la sculpture seule : `python3 bpreview.py 0.9 90000 travail/prev.bin` puis
`node shoot.js image.png '[[0,0.04,0.78,0,22]]' 1 travail/prev.bin`.

## Vérifications faites

- Contrat : 55/55 (dont : maillage fermé et manifold, fond du cou plat à `cou.yBas`, morphose du menton = rotation
  `machoire` à 0,01 mm près, aucun sommet du haut du visage ni des oreilles entraîné par la mâchoire, poids de peau).
- Sceau : squelette du dessin = 7 extrémités, 7 jonctions sur le nœud, un seul anneau ; caps de départ irréguliers
  (38 à 66°), sept longueurs différentes, courbures et départs de sens alternés, aucune branche rectiligne. Revue à
  l'œil : ni étoile ni polygone (pentagramme, heptagramme), ni rune (aucun trait droit, aucune fourche), ni soleil
  noir (pas de rayons identiques ni de roue tournante, pas de cercles concentriques), ni croix gammée ou autre
  croix, ni chandelier, ni symbole religieux connu.
- Rendus regardés (éclairage sombre froid + contre-jour rouge, et neutre) : face, 3/4 des deux côtés, profil,
  contre-plongée, dos du crâne, dessus, gros plans du sceau et de la cicatrice, bouche ouverte de face, de 3/4 et en
  contre-plongée → `out/rendus/planche_eclairage_boss.png`, `out/rendus/planche_eclairage_neutre.png`. Fond du cou
  vu d'en dessous : fermé, sans bord. Tête affichée par le modèle du corps (r128, r186) sans erreur.
- Corrigés en cours de route : bosses rondes à l'angle de la mâchoire, bourrelet de la nuque, pommettes en boule
  puis pli trop net sous la pommette, ligne verticale sur le crâne (pli des normales fines dû au rétrécissement
  « egg » des superellipsoïdes), bande rouge sur la nuque (masque de bouche sans limite arrière), tendons du cou
  qui dépassaient sous le fond, coins des paupières pincés par la décimation, sceau trop régulier (lisible comme un
  soleil) redessiné, agrafes trop fines, iris trop orangé, dents visibles dans la fente bouche fermée.

## Limites connues

- Bouche fermée : la fente labiale (1,4 mm) laisse deviner un liseré de dent sous un éclairage direct de face.
- Bouche grande ouverte : les commissures s'étirent (quelques triangles allongés visibles de très près, de 3/4).
- Le relief fin (sceau, agrafes) est dans la carte de normales : la silhouette reste lisse ; de loin, le sceau se
  lit surtout par son émission.
- L'intensité d'émission (sceau, iris) est à régler dans le moteur selon l'exposition et la présence d'un bloom.
