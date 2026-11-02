# Audio du boss de Bunker 7

133 entrées dans `out/manifest.json` (MP3 48 kHz dans `out/`) : 119 effets, boucles et ambiances (chiens de la v1.2,
cuves et mini-boss de la v1.3, sons de la v1.4 sans les illusions, 23 sons de la v1.5), 13 musiques, et
`annonce_munitions_max` (voix de l'annonceur, ajoutée à la main en v1.1, conservée par la chaîne). Les clés retirées
(`RETIRES` dans `lib/sortie.py` : les 4 sons d'illusion de la v1.4) ne sont ni produites ni conservées. Tout est synthétisé par les
scripts de ce dossier (aucun échantillon, aucune banque de sons, aucune voix qui prononce des mots, aucune mélodie
existante). Leitmotif : le motif de boîte à musique de l'arrivée (Ré–Fa–Mi–La–Do♯), faussé en phase 5, résolu en
ré majeur dans `mus_victoire`.

## Dossiers

| Dossier | Contenu |
|---|---|
| `out/` | livrables MP3 + `manifest.json` |
| `masters/` | maîtres WAV 24 bits (boucles : la boucle exacte, sans contexte) + `meta/` |
| `lib/` | synthèse : `dsp.py`, `instr.py` (repris des jingles), `voix.py` (vocalises), `sfx.py` (effets), `musique.py` (mixage, boucles), `sortie.py` (mesure BS.1770, limiteur, export) |
| `effets.py`, `musique.py` | une recette par clé |
| `verifier.py` | contrôle des fichiers décodés → `verif/rapport.txt`, `verif/rapport.json`, `png/jointures/` |
| `png/` | planches de spectrogrammes de tous les sons |

Régénérer : `python3 effets.py [clés…]`, `python3 musique.py [clés…]`, puis
`python3 -c "import sys; sys.path.insert(0,'.'); from lib.sortie import manifeste; manifeste()"` et `python3 verifier.py`.
`manifeste()` reconstruit le manifeste à partir de `masters/meta/` **et conserve telles quelles les entrées qu'elle ne
produit pas** (sans `masters/meta/<clé>.json`, comme `annonce_munitions_max`) ; il avertit si leur fichier manque.
Depuis la v1.2, l'export contrôle la **crête vraie** du MP3 décodé (≤ −1 dBTP, suréchantillonnage ×4) au lieu de la
crête échantillon.
Dépendances : numpy, scipy, numba, soundfile, matplotlib, ffmpeg (libmp3lame). Rendu déterministe (graines fixes).

## Manifeste

`{ cle: { fichier, duree, echantillons, boucle, stereo, pic, lufs, mesure, crete, creteVraie, categorie, description,
[boucleDebut, boucleFin, dureeFichier], [notes] } }`

- `pic` : instant (s) du transitoire principal. Pour caler un son sur un évènement visuel : le lancer à `t − pic`.
- `lufs` : sonie mesurée après décodage ; `mesure` = `integree` (boucles, musiques) ou `momentanee-max` (effets brefs).
- `crete` : crête échantillon après décodage MP3 (toutes ≤ −1 dBFS) ; `creteVraie` : suréchantillonnée ×4.
- `categorie` : `effet`, `boucle`, `ambiance`, `musique`.

## Utilisation (lecteur Web Audio)

- **Effets mono** = sons positionnels (PannerNode / `THREE.PositionalAudio`). **Stéréo** = sons « plein écran »
  (cinématiques, récompenses, ambiances, musiques).
- **Boucles** (18 fichiers) : le MP3 contient 0,1 s de contexte de chaque côté. Toujours boucler entre les points du
  manifeste : `src.loop = true; src.loopStart = boucleDebut; src.loopEnd = boucleFin; src.start(t, boucleDebut)`.
  La jointure est alors exacte, même si le navigateur ne retire pas le retard de l'encodeur MP3.
- **Couches synchronisées** : `mus_rituel_tension` (sur `mus_rituel`) et `mus_phase5_traque` (sur `mus_phase5`) ont
  exactement le même nombre d'échantillons et la même grille : les démarrer au même instant d'horloge que la base
  et régler seulement leur gain (progression de la capture ; proximité du boss).
- **Durées exactes** : `mus_repit` = 15,000 s (vide à partir de 14,75 s ; lancer `mus_phase2` à +15,0 s pile, sans
  fondu : son temps 1 est le coup qui ouvre la phase 2). `mus_absence` = 30,000 s (vide de 29,5 à 30,0 s ; lancer
  `retour_rage` à +30,0 s, son pic est à 0,8 s).
- `mus_intro` : à lancer au début de l'apparition (après le fondu de téléportation) ; son impact à 6,0 s correspond
  à la fin de l'introduction (2,6 + 3,4 s dans `config.js`) et au début de la phase 1.
- `interaction_maintien` : monter `playbackRate` de 1 à ≈ 1,5 avec la progression ; `rituel_boucle` : 1 → 1,12 possible.
- Niveaux de départ conseillés (gains de bus) : musique 0,8, effets 1, ambiances 0,7 ; boucles de phase à −18 LUFS,
  couches à −20, cues non bouclées à −15/−16, gros impacts et cris ≈ −10 LUFS momentané max, petits sons −17 à −22.

## Vérifié (`verifier.py`, sur les MP3 décodés comme dans le navigateur)

- 73/73 : crête ≤ −1 dBFS, longueur décodée = longueur du maître, durée annoncée exacte (`mus_repit` 720 000
  échantillons, `mus_absence` 1 440 000), couches de même longueur que leur base.
- Attaque dans les 10 ms pour tous les effets ponctuels, sauf les montées voulues (liste `ATTAQUE_LENTE`).
- Les 24 `pic` annoncés : niveau sur 10 ms au pic ≥ −6 dB du maximum du son (la plupart à 0 dB).
- 18 boucles : rendues 3 fois bout à bout entre `boucleDebut` et `boucleFin` ; aucun saut d'échantillon anormal à la
  jonction, erreur de codage à la jonction égale à celle du même passage lu en continu (×0,9 à ×1,4),
  spectrogrammes des jonctions dans `png/jointures/`.
- Spectrogrammes de tous les sons (planches dans `png/`) relus ; corrections faites : sous-graves trop longs des
  impacts (ajout d'un « coup » médium audible sur petits haut-parleurs), limiteur qui écrasait le début des sons
  courts, crescendos du répit et de l'absence, embrasement immédiat de `zombies_cendres`, bourdons rendus
  exactement périodiques.

## v1.2 — chiens zombies (API.md §14.6)

Six effets mono positionnels (recettes `chien_*` à la fin de `effets.py`, section « CHIENS ZOMBIES ») :

| Clé | Durée | Sonie | Crête vraie | Notes |
|---|---|---|---|---|
| `chien_faille` | 1,20 s | −15,4 LUFS M | −1,5 dBTP | sceau qui craque (0 s), fissure, feu grave qui monte ; `pic` 0,9 s = jaillissement (= `chiens.faille.duree`) |
| `chien_hurlement` | 2,50 s | −14,4 LUFS M | −5,7 dBTP | meute : 4 voix (sol, sol♯, la, ré ; une lointaine) qui se cassent ; hurlement court : fondu de 0,4 s vers 1,3 s |
| `chien_grognement` | boucle 2,00 s | −21,4 LUFS I (M −18,5) | −1,9 dBTP | expiration roulée + inspiration rauque ; périodique par construction ; `boucleDebut` 0,1 / `boucleFin` 2,1 |
| `chien_aboiement` | 0,50 s | −15,4 LUFS M | −5,3 dBTP | varier la vitesse (0,85–1,1) pour les aboiements aléatoires |
| `chien_morsure` | 0,35 s | −16,4 LUFS M | −1,8 dBTP | `pic` 0 s ; claquement (aigus +12,5 dB au-dessus du lit) ; varier la vitesse (0,92–1,08) |
| `chien_mort` | 1,20 s | −15,5 LUFS M | −1,9 dBTP | jappement étranglé, `pic` 0,38 s = chute de la carcasse, cendres, râle |

Briques ajoutées : `voix()` accepte une pulsation roulée de la gorge (`roule`, `roule_prof`) et des courbes pour
`rauque`/`sous` (voix qui se casse) — sans changer les sons existants (vérifié : écart ≤ 2·10⁻⁷ avec les maîtres) ;
`sfx.py` : `gargouillis`, `claquement_dents`, `os_cliquetis`, `place_circulaire`. Les six sons passent un passe-haut à
32 Hz (aucune énergie infrasonore). Spectrogrammes : `python3 spectres_chiens.py` → `png/chiens/` (un par son, la boucle
×3, planche, zooms) ; jonction de la boucle : `png/jointures/chien_grognement.png`, rendu ×3 : `verif/chien_grognement_x3.wav`.
`verifier.py` cherche aussi les clics (pointes au-dessus de 5 kHz, +18 dB sur la médiane locale) : aucun dans le
grognement ni le hurlement ; dans les autres chiens, les pointes trouvées sont les craquements et braises voulus.

## v1.3 — cuves et mini-boss (API.md §15.6)

Recettes à la fin de `effets.py` (section « CUVES ET MINI-BOSS ») ; mono et positionnels sauf `miniboss_apparition`.

| Clé | Durée | Sonie | Crête vraie | Lecture |
|---|---|---|---|---|
| `tube_siphon` | 2,20 s | −15,4 LUFS M | −3,3 dBTP | `tube` « siphon » ; sommet à 2,2 s (= étape aspiration) |
| `tube_fissure` | 0,80 s | −15,5 LUFS M | −2,4 dBTP | `tube` « fissure » (1,32 s), par-dessus le siphon ; `pic` 0 |
| `tube_eclatement` | 1,50 s | −11,5 LUFS M | −2,2 dBTP | `tube` « eclate » ; `pic` 0 |
| `miniboss_apparition` | 2,50 s stéréo | −12,5 LUFS M | −2,3 dBTP | `miniBoss` « libere », non positionnel ; ré mineur, leitmotiv ré–fa–mi |
| `survolte_bourdon` | boucle 2,00 s | −22,4 LUFS I | −9,1 dBTP | sur le Survolté vivant |
| `survolte_charge` | 0,80 s | −15,4 LUFS M | −3,4 dBTP | ≈ 0,8 s avant la décharge ; la fin = le claquement |
| `survolte_decharge` | 0,60 s | −12,6 LUFS M | −1,3 dBTP | `decharge` ; `pic` 0 ; sifflement 4,2 → 1,5 kHz |
| `survolte_spasme` | 0,40 s | −16,5 LUFS M | −2,4 dBTP | `spasme` ; varier la vitesse |
| `survolte_cri` | 1,50 s | −13,5 LUFS M | −4,1 dBTP | libération, ≈ 0,2 s après le stinger |
| `survolte_mort` | 1,50 s | −14,3 LUFS M | −1,1 dBTP | mort ; `pic` 0 (court-circuit), chute à 0,55 s |
| `irradie_geiger` | boucle 2,00 s | −24,9 LUFS I | −2,5 dBTP | aura ; plus fort sous 3 m (voir limites) |
| `irradie_rale` | boucle 3,00 s | −22,4 LUFS I | −2,6 dBTP | sur l'Irradié vivant |
| `irradie_cri` | 2,00 s | −13,5 LUFS M | −1,8 dBTP | libération |
| `irradie_mort` | 1,80 s | −14,5 LUFS M | −1,8 dBTP | mort ; `pic` 0,45 s (éclatement) ; puis `flaque_toxique` |
| `flaque_toxique` | boucle 2,00 s | −22,4 LUFS I | −2,0 dBTP | pendant `flaque.duree` (5 s) |

Briques ajoutées dans `sfx.py` : `bulle`, `verre`, `tessons`, `arc_electrique`, `tic_geiger`, `friture` ; dans `effets.py` :
`_electrise` (voix modulée par le 100 Hz, hachures, blocage d'échantillons), `_rafale` (claquement d'arc). Toutes les
boucles sont périodiques par construction (fréquences multiples de 1/L, bruit périodique, placement circulaire,
traitements à mémoire appliqués en circulaire) ; passe-haut 32 Hz partout. Spectrogrammes :
`python3 spectres_lot.py png/v13 <clés…> -- <clé:t0:t1:fmax:nperseg>…` → `png/v13/` ; jonctions dans `png/jointures/`.
`verifier.py` : contrôle strict des clics au-dessus de 9 kHz pour les sons continus (`chien_grognement`,
`chien_hurlement`, `irradie_rale`), pointes aiguës listées pour tous les sons v1.2/v1.3 (ce sont les craquements,
tics et grésillements voulus), tolérance d'une trame MP3 sur la longueur des entrées externes.

## v1.4 — Démembré, mini-boss renforcés, crochets, illusions, paliers (API.md §16.8)

Recettes à la fin de `effets.py` (section « v1.4 ») ; mono et positionnels sauf `survolte_etourdi` et les paliers
(stéréo, non positionnels). Les sons ponctuels passent par `_fin14` : passe-haut 32 Hz et passe-bas 16 kHz (le MP3 coupe
ces aigus ; sans ce filtre, le limiteur d'export écrasait les transitoires pour des crêtes qui disparaissent au codage).

| Clé | Durée | Sonie | Crête vraie | Lecture |
|---|---|---|---|---|
| `demembre_cri` | 1,60 s | −13,5 LUFS M | −1,8 dBTP | libération |
| `demembre_mort` | 1,80 s | −13,5 M | −1,8 | mort ; `pic` 0,8 s (effondrement), genoux à 0,45 s |
| `demembre_fleau` | 0,60 s | −14,9 M | −1,9 | `fleau` 'preparation' ; `pic` 0,55 s = fleau.preparation = le coup |
| `demembre_impact` | 0,60 s | −13,8 M | −1,6 | `impact` ; `pic` 0 |
| `demembre_rale` | boucle 3,00 s | −22,4 LUFS I | −4,0 | Démembré vivant ; pas boiteux dans la boucle |
| `irradie_boule` | 0,60 s | −15,5 M | −2,0 | `boule` 'lancer' ; départ de la gerbe à 0,12 s |
| `irradie_boule_impact` | 1,00 s | −15,9 M | −1,8 | `boule` 'impact' ; `pic` 0 |
| `zone_radioactive` | boucle 2,00 s | −27,4 LUFS I | −5,0 | une par zone ; départ aléatoire, vitesse 0,94–1,06 |
| `survolte_etourdi` | 1,00 s stéréo | −14,4 M | −2,2 | joueur étourdi (local), non positionnel |
| `crochet_lancer` | 0,70 s | −15,4 M | −4,0 | `crochet` 'lancer' (claquement à 0,09 s) |
| `crochet_accroche` | 0,60 s | −14,7 M | −1,6 | 'accroche' ; `pic` 0, la chaîne se tend à 0,22 s |
| `crochet_traction` | 1,50 s | −16,4 M | −2,0 | après 'accroche' ; couper à 'arrivee' (fondu 0,1 s) |
| `crochet_rate` | 0,80 s | −15,4 M | −4,1 | 'rate' ; `pic` 0 |
| `illusion_apparition` | 1,00 s | −15,4 M | −2,0 | 'apparition'/'retour' ; `pic` 0,85 s (matérialisation) |
| `illusion_dissipation` | 0,80 s | −15,4 M | −3,7 | 'dissipation' ; `pic` 0 |
| `illusion_murmure` | boucle 3,00 s | −27,4 LUFS I | −9,9 | sur chaque illusion ; volume ≤ 0,55, portée courte |
| `palier_lames_rouges` | 2,20 s stéréo | −13,4 M | −4,9 | `palier` 1 |
| `palier_illusions` | 2,20 s stéréo | −13,4 M | −5,5 | `palier` 2 |
| `palier_crochets` | 1,80 s stéréo | −13,4 M | −3,8 | `palier` 3 |

Illusion contre vrai boss : `boss_souffle` a son centre de gravité spectral à 770 Hz et beaucoup d'énergie sous 150 Hz
(−8,6 dB du total) ; `illusion_murmure` est à 2,3 kHz, sans rien sous 150 Hz (−30,9 dB), fait de chuchotements et de
souffles à l'envers, et 5 dB plus bas à volume égal. Briques ajoutées dans `sfx.py` : `maillon`, `chaine`, `grincement`,
`pas_lourd`, `flanger`. Spectrogrammes : `png/v14/` (un par son, 3 planches, 5 zooms) ; jonctions dans `png/jointures/`.

## v1.5 — rages des mini-boss, murs électrifiés, Démembré géant, intangibilité (API.md §17.5)

Recettes à la fin de `effets.py` (section « v1.5 »). Retirés : `illusion_apparition`, `illusion_dissipation`,
`illusion_murmure`, `palier_illusions` (recettes, fichiers, maîtres et métadonnées supprimés). Le Démembré étant
géant (×2), `demembre_cri`, `demembre_mort`, `demembre_rale` (fondamentale −27 %, formants −20 %, pas de colosse) et
`demembre_fleau` (sommet à 0,7 s = nouvelle `fleau.preparation`) ont été refaits sous les mêmes clés.

| Clé | Durée | Sonie | Crête vraie | Forme |
|---|---|---|---|---|
| `survolte_surcharge` | 2,50 s | −14,4 LUFS M | −5,6 dBTP | mono |
| `murs_electrification` | 2,00 s | −12,3 M | −1,8 | stéréo |
| `murs_boucle` | 2,00 s | −28,4 LUFS I | −8,0 | boucle, une par mur |
| `murs_arc` | 0,60 s | −15,4 M | −1,3 | mono |
| `murs_choc` | 0,45 s | −15,6 M | −1,8 | mono |
| `murs_extinction` | 1,30 s | −15,4 M | −3,8 | stéréo |
| `irradie_infection` | 1,80 s | −13,6 M | −1,9 | stéréo |
| `zombie_irradie` | 1,50 s | −30,5 I | −7,4 | boucle, une par entité |
| `demembre_arrachement` | 1,80 s | −12,9 M | −1,6 | mono, `pic` 1,2 s |
| `bras_lancer` | 1,20 s | −15,5 M | −1,9 | mono |
| `bras_impact` | 1,20 s | −14,8 M | −1,8 | mono |
| `bras_pulsation` | 2,00 s | −24,4 I | −4,6 | boucle |
| `petit_sortie` | 1,20 s | −15,5 M | −1,9 | mono |
| `petit_effondrement` | 1,00 s | −16,5 M | −1,7 | mono |
| `demembre_charge` | 2,00 s | −13,5 M | −1,9 | mono, `pic` 0,8 s |
| `demembre_percussion` | 0,60 s | −14,4 M | −1,8 | mono |
| `projection_mur` | 0,70 s | −12,5 M | −1,9 | mono |
| `bras_fletri` | 1,50 s | −16,5 M | −1,9 | mono |
| `intangible_debut` | 1,00 s | −15,6 M | −1,8 | mono |
| `intangible_boucle` | 3,00 s | −24,4 I | −3,1 | boucle |
| `traversee_mur` | 0,90 s | −15,5 M | −3,3 | mono |
| `resurgissement` | 1,40 s | −11,4 M | −1,9 | mono |
| `palier_intangible` | 2,20 s | −13,4 M | −3,3 | stéréo |

`intangible_boucle` : énergie au-dessus de 1,5 kHz à −16 dB du total, au-dessus de 3 kHz à −47 dB, centre spectral
440 Hz (`boss_souffle` : 770 Hz) — des graves se localisent mal ; la portée courte fait le reste. Spectrogrammes :
`png/v15/` (27 sons, 4 planches, 5 zooms) ; `png/v14/` regénéré sans les illusions.

## Limites

- Personne n'a écouté ces sons : la qualité est jugée sur les spectrogrammes et les mesures. Les vocalises du boss
  sont synthétiques (source glottique + formants) : crédibles comme créature, pas comme voix humaine.
- Les sons très brefs et très percussifs n'atteignent pas toujours leur sonie cible sans écrêter : `boss_impact_balle`
  −21,5 LUFS (cible −18), `ame_arrivee` −16,1 (cible −15). À compenser au mixage si besoin.
- Plusieurs effets v1.0 contiennent beaucoup d'énergie infrasonore (< 25 Hz, venue du bruit brun des grondements) :
  `bloc_impact`, `intro_transition`, `zombie_emergence`, `onde_choc`, `ailes_deploiement`, `mur_fissure`, `bloc_lancer`,
  `zombies_cendres`, `ailes_battement`… Inaudible et sans effet sur la sonie mesurée, mais elle consomme de la marge de
  crête quand plusieurs sons se superposent. Correctif possible : passe-haut ~30 Hz dans `grondement()`/`brun()` puis
  ré-export (non fait : hors du périmètre v1.2).
- `mus_absence` a une crête vraie de −0,92 dBTP (crête échantillon −1,16 dBFS, conforme au contrat v1.0) ; un ré-export
  avec la chaîne v1.2 la ramènerait sous −1 dBTP.
- Chiens : un seul fichier par son (pas de variantes) ; le grognement répète le même cycle de 2 s.
- `irradie_geiger` reste à −24,9 LUFS I : des tics de compteur ont un facteur de crête énorme (crête −2,5 dBTP pour cette
  sonie) ; ils restent bien audibles, mais toute hausse de gain en jeu doit rester sous ≈ +2 dB pour ne pas écrêter.
- `irradie_rale` suit la consigne « à travers un masque » alors que la fiche montre le masque pendu sur la poitrine.
