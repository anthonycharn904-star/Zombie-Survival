# Cadence des armes et nombre d'images par seconde

Mesures du 2 novembre 2026, jeu 2.0.7 (chantier `chantier/bunker7`). Demande d'Anthony du 1er novembre 2026, à propos du calibrage du boss de Bunker 7 : « Signale toute dépendance de la cadence des armes au nombre d'images par seconde. »

## Constat

La cadence réelle des armes dépend du nombre d'images par seconde. Le système d'armes du jeu 1.9.0 (section 08) en est la cause :

- `tryFire`, appelé une fois par image, ne tire que si `G.time ≥ Arms.nextFire` ;
- `fireWeapon` pose `Arms.nextFire = G.time + 60 / rpm` (cadence × 1,33 avec Double coup).

Un tir part donc au plus une fois par image, et l'intervalle entre deux tirs est arrondi à l'image supérieure :

> cadence réelle = images par seconde ÷ ⌈ images par seconde × 60 / rpm ⌉

Quand ce produit tombe juste sur un nombre entier, l'arrondi du temps du jeu (une somme de pas d'une image, en virgule flottante) ajoute souvent une image de plus : à 60 images/s, la STG-44 (10 balles/s sur sa fiche) devrait tirer toutes les 6 images, elle tire toutes les 7.

## Mesures

Dans la page du jeu (Chromium sans tête, sans rendu) : chaque arme sans le Glas (« — ») et au palier I, détente tenue (cliquée à chaque image pour les armes semi-automatiques), chargeur toujours plein, 5 s de jeu par mesure, avec un pas de 1/30 à 1/240 s ; cadence = (tirs − 1) ÷ (dernier tir − premier tir), en balles par seconde. Entre parenthèses : l'écart à la fiche. Les mesures suivent la formule à l'image près, sauf les cas « produit entier » décrits plus haut.

| Arme | Palier | Tir | Fiche (balles/s) | 30 i/s | 60 i/s | 120 i/s | 144 i/s | 240 i/s |
|---|---|---|---|---|---|---|---|---|
| M1911 | — | semi | 7,00 | 6,00 (−14 %) | 6,67 (−5 %) | 6,67 (−5 %) | 6,86 (−2 %) | 6,86 (−2 %) |
| M1911 | I | semi | 7,00 | 6,00 (−14 %) | 6,67 (−5 %) | 6,67 (−5 %) | 6,86 (−2 %) | 6,86 (−2 %) |
| Kar98k | — | semi | 0,87 | 0,86 (−1 %) | 0,86 (−1 %) | 0,86 | 0,86 (−1 %) | 0,87 |
| Kar98k | I | semi | 1,17 | 1,15 (−1 %) | 1,15 (−1 %) | 1,17 | 1,16 (−1 %) | 1,17 |
| Gewehr 43 | — | semi | 5,50 | 5,00 (−9 %) | 5,46 (−1 %) | 5,46 (−1 %) | 5,33 (−3 %) | 5,46 (−1 %) |
| Gewehr 43 | I | semi | 6,33 | 6,00 (−5 %) | 6,00 (−5 %) | 6,32 | 6,26 (−1 %) | 6,32 |
| MP40 | — | auto | 9,17 | 7,50 (−18 %) | 8,57 (−7 %) | 8,57 (−7 %) | 9,00 (−2 %) | 8,89 (−3 %) |
| MP40 | I | auto | 10,33 | 10,00 (−3 %) | 10,00 (−3 %) | 10,00 (−3 %) | 10,29 | 10,00 (−3 %) |
| Thompson | — | auto | 11,67 | 10,00 (−14 %) | 10,00 (−14 %) | 10,91 (−6 %) | 11,08 (−5 %) | 11,43 (−2 %) |
| Thompson | I | auto | 12,67 | 10,00 (−21 %) | 12,00 (−5 %) | 12,00 (−5 %) | 12,00 (−5 %) | 12,63 |
| M1897 Trench | — | semi | 1,25 | 1,25 | 1,22 (−2 %) | 1,24 (−1 %) | 1,24 (−1 %) | 1,24 |
| M1897 Trench | I | semi | 1,25 | 1,25 | 1,22 (−2 %) | 1,24 (−1 %) | 1,24 (−1 %) | 1,24 |
| Double canon | — | semi | 4,33 | 4,29 (−1 %) | 4,29 (−1 %) | 4,29 (−1 %) | 4,24 (−2 %) | 4,29 (−1 %) |
| Double canon | I | semi | 4,33 | 4,29 (−1 %) | 4,29 (−1 %) | 4,29 (−1 %) | 4,24 (−2 %) | 4,29 (−1 %) |
| STG-44 | — | auto | 10,00 | 10,00 | 8,57 (−14 %) | 9,23 (−8 %) | 9,60 (−4 %) | 9,60 (−4 %) |
| STG-44 | I | auto | 11,00 | 10,00 (−9 %) | 10,00 (−9 %) | 10,91 (−1 %) | 10,29 (−6 %) | 10,91 (−1 %) |
| BAR | — | auto | 8,00 | 7,50 (−6 %) | 7,50 (−6 %) | 7,50 (−6 %) | 8,00 | 8,00 |
| BAR | I | auto | 8,67 | 7,50 (−13 %) | 8,57 (−1 %) | 8,57 (−1 %) | 8,47 (−2 %) | 8,57 (−1 %) |
| PPSh-41 | — | auto | 15,83 | 15,00 (−5 %) | 15,00 (−5 %) | 15,00 (−5 %) | 14,40 (−9 %) | 15,00 (−5 %) |
| PPSh-41 | I | auto | 16,67 | 15,00 (−10 %) | 15,00 (−10 %) | 15,00 (−10 %) | 16,00 (−4 %) | 16,00 (−4 %) |
| Type 100 | — | auto | 12,50 | 10,00 (−20 %) | 12,00 (−4 %) | 12,00 (−4 %) | 12,00 (−4 %) | 12,00 (−4 %) |
| Type 100 | I | auto | 13,33 | 10,00 (−25 %) | 12,00 (−10 %) | 12,00 (−10 %) | 13,09 (−2 %) | 13,33 |
| FG42 | — | auto | 12,00 | 10,00 (−17 %) | 10,00 (−17 %) | 10,91 (−9 %) | 12,00 | 12,00 |
| FG42 | I | auto | 13,00 | 10,00 (−23 %) | 12,00 (−8 %) | 12,00 (−8 %) | 12,00 (−8 %) | 12,63 (−3 %) |
| MG42 | — | auto | 18,33 | 15,00 (−18 %) | 15,00 (−18 %) | 17,14 (−6 %) | 18,00 (−2 %) | 17,14 (−6 %) |
| MG42 | I | auto | 19,17 | 15,00 (−22 %) | 15,00 (−22 %) | 17,14 (−11 %) | 18,00 (−6 %) | 18,46 (−4 %) |
| Panzerschreck | — | semi | 0,67 | 0,65 (−2 %) | 0,66 (−1 %) | 0,66 (−1 %) | 0,67 | 0,67 |
| Panzerschreck | I | semi | 0,67 | 0,65 (−2 %) | 0,66 (−1 %) | 0,66 (−1 %) | 0,67 | 0,67 |
| Désintégrateur | — | semi | 3,83 | 3,75 (−2 %) | 3,75 (−2 %) | 3,75 (−2 %) | 3,79 (−1 %) | 3,81 (−1 %) |
| Désintégrateur | I | semi | 4,67 | 4,29 (−8 %) | 4,62 (−1 %) | 4,62 (−1 %) | 4,64 | 4,62 (−1 %) |
| Onde de choc | — | semi | 1,17 | 1,15 (−1 %) | 1,15 (−1 %) | 1,17 | 1,16 (−1 %) | 1,17 |
| Onde de choc | I | semi | 1,17 | 1,15 (−1 %) | 1,15 (−1 %) | 1,17 | 1,16 (−1 %) | 1,17 |
| Thompson + Double coup | I | auto | 16,85 | 15,00 (−11 %) | 15,00 (−11 %) | 15,00 (−11 %) | 16,00 (−5 %) | 16,00 (−5 %) |

## Conséquences

- **Armes automatiques** : jusqu'à −25 % à 30 images/s (Type 100 au palier I), de −1 à −22 % à 60 images/s (MG42 : −18 et −22 %). L'écart diminue avec le nombre d'images, mais sans régularité : la STG-44 tire 10 balles/s à 30 images/s, 8,57 à 60 et 9,23 à 120.
- **Armes semi-automatiques et lentes** : peu touchées dès 60 images/s (2 % au plus), sauf le M1911 (−5 %) et le Gewehr 43 au palier I (−5 %).
- **D'un PC à l'autre**, l'équilibre des armes change : plus d'images par seconde, plus de dégâts par seconde.
- **Boss de Bunker 7** (critère 45 du brief) : avec la Thompson au palier I, 1 320 dégâts/s de 60 à 144 images/s (phase 1 : 28,5 s de tir) ; 1 100 à 30 images/s (34,2 s) ; 1 389 à 240 images/s (27,1 s) ; sur la fiche : 1 393 (27,0 s). `DPS_REFERENCE` reste à 1 393 (décision d'Anthony du 1er novembre 2026 : l'équilibrage sera vérifié en jeu avant tout changement).

## Autres dépendances au nombre d'images

- **Pas de temps plafonné à 0,05 s** (`frame`, lu dans le code) : sous 20 images/s, tout le jeu ralentit (son temps avance moins vite que le temps réel), le combat du boss compris, sans que ses règles changent.
- **Logique du boss** : elle avance avec le pas du jeu ; ses durées ne dépendent pas des images (mesuré à 60 images/s : répit 15,00 s, absence 30,00 s, capture 29,98 s) ; ses décisions sont prises une fois par image (précision d'une image). Pas mesurée à d'autres fréquences.

## Correction possible (non faite : mécanique du jeu, décision d'Anthony)

Reporter au tir suivant le reste du délai, tant que la détente reste tenue, au lieu de repartir de l'image du tir :

```js
// fireWeapon : au lieu de Arms.nextFire = G.time + 60 / rpm
Arms.nextFire = Math.max(Arms.nextFire, G.time - pas) + 60 / rpm;   // pas : durée de l'image ; pas de rattrapage après un relâchement
```

La cadence moyenne suivrait alors la fiche à toute fréquence d'images au moins égale à la cadence de l'arme (MG42 au palier I : 19,2 balles/s ; au-dessous de 20 images/s, il faudrait plusieurs tirs par image). Les armes automatiques tireraient un peu plus vite qu'aujourd'hui à 60 images/s (jusqu'à +22 %) : leur équilibre change, à essayer en jeu avant de décider ; l'essai `weapons` et ces mesures seraient à refaire.
