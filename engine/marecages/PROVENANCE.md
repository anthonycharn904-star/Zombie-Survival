# Marécages Maudits : provenance des fichiers

Généré par `outils/provenance.py`. Kit de référence : « Zombie Survival 2.0.7 - a publier (Stryges) », dossier Windows
`Documents\Zombie Survival - Publications\Zombie Survival 2.0.7 - a publier (Stryges)` d'Anthony (mis à jour le 31 octobre
2026 à 23 h 10), copié le 1er novembre 2026 dans sa copie privée de référence (76 fichiers, empreinte de la liste
`99ea5456…d199`), hors de tout dépôt.

**Licences.** Les sources du marais ont été écrites pour Anthony, à sa demande (dates et demandes citées dans leurs
commentaires) ; elles ne contiennent ni code d'un tiers repéré (aucune adresse, aucune mention de licence ou d'auteur
extérieur), ni fichier son, image ou police : textures, modèles et sons sont calculés par le code. Le dépôt n'a pas de
licence déclarée. Les polices et three.js du dossier `jeu/` du kit sont ceux de l'emballage du launcher (déjà dans
`launcher/gamelibs/`, avec leurs licences) : ils ne font pas partie du portage.

**Confidentialité.** Ce dossier est resté ignoré par Git (verrou : `.gitignore` avec une ligne « * ») jusqu'à
l'accord d'Anthony du 2 novembre 2026 : il entre alors dans l'historique, après la revue de ces fichiers, de leur
provenance et de leurs licences. Le `.gitignore` n'exclut plus que les caches de Python ; le verrou se réarme
pour un travail à garder privé (`etape.py`). La copie privée du kit, les rapports et les constructions restent
hors du dépôt.

| Fichier | Origine dans le kit | SHA-256 du kit | SHA-256 actuel | Transformation |
|---|---|---|---|---|
| `orig/mere-vase.js` | `sources/src/mere-vase.js` | `94df6a25ce3cfb71…` | `94df6a25ce3cfb71…` | identique ; inséré avec 8 retouches contrôlées (`retouches/modules.py`), empreinte contrôlée par etape.py |
| `orig/mere-vase-audio.js` | `sources/src/mere-vase-audio.js` | `dd3029a98d2209f1…` | `dd3029a98d2209f1…` | identique (inséré tel quel, empreinte contrôlée par etape.py) |
| `orig/barque.js` | `sources/src/barque.js` | `d43c95f6786b6ebf…` | `d43c95f6786b6ebf…` | identique ; inséré avec 11 retouches contrôlées (`retouches/modules.py`), empreinte contrôlée par etape.py |
| `src/ma00_confort.js` | — (nouveau) | — | `ff2b470232a0dcd4…` | écrit pour l'intégration (confort : secousses, flashs) |
| `src/ma01_core.js` | `sources/src/ma/ma01_core.js` | `73e731fe87df7056…` | `4fc0234878915823…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma02_view.js` | `sources/src/ma/ma02_view.js` | `0149b2b37343a57a…` | `051c46bee47eae1b…` | réétiqueté |
| `src/ma03_water.js` | `sources/src/ma/ma03_water.js` | `b6dd048face7ace2…` | `855608d1053dec0b…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma04_load.js` | `sources/src/ma/ma04_load.js` | `9b0e4ee560b057d0…` | `b87523c35c9dbd9c…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma05_places.js` | `sources/src/ma/ma05_places.js` | `7e7775039416b1c7…` | `85d1c2a5daa8ea41…` | réétiqueté |
| `src/ma06_boat.js` | `sources/src/ma/ma06_boat.js` | `ced716e77ee15d79…` | `9f72973dce84f140…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma07_elements.js` | `sources/src/ma/ma07_elements.js` | `eb4c9ad40449832f…` | `eb4c9ad40449832f…` | identique |
| `src/ma08_nature.js` | `sources/src/ma/ma08_nature.js` | `ca404d8c4d96ca6f…` | `c5a48c487eb5a210…` | réétiqueté |
| `src/ma09_beast.js` | `sources/src/ma/ma09_beast.js` | `4efbbe299b15c1ad…` | `cf3a22f3f286ce03…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma10_amb.js` | `sources/src/ma/ma10_amb.js` | `70a4ab6fe565d550…` | `c965934e22c30428…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma11_diag.js` | `sources/src/ma/ma11_diag.js` | `6e5cf7340e9150a7…` | `b70c359253620814…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma12_nav.js` | `sources/src/ma/ma12_nav.js` | `ca600c8712f54e20…` | `1034f066d33757af…` | réétiqueté |
| `src/ma13_bati.js` | `sources/src/ma/ma13_bati.js` | `4ad644cb713c3ae0…` | `ed86f0ff4770fe8a…` | réétiqueté |
| `src/ma14_brume.js` | `sources/src/ma/ma14_brume.js` | `89b77d67175240ce…` | `036292f85d28928e…` | réétiqueté |
| `src/ma15_noyes.js` | `sources/src/ma/ma15_noyes.js` | `c9d33d2c57692202…` | `37363e5f9d827cd8…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma16_stryges.js` | `sources/src/ma/ma16_stryges.js` | `3b1d5c866a8d8f1b…` | `7dffc6d32ed70f71…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma17_pluie.js` | `sources/src/ma/ma17_pluie.js` | `de371d7332dd41c9…` | `f57d4605aa41c241…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma18_orage.js` | `sources/src/ma/ma18_orage.js` | `03a937fbc613b854…` | `c343a941690fcd6a…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `src/ma19_arrivee.js` | `sources/src/ma/ma19_arrivee.js` | `eb52778d0d6ff6f6…` | `acf76a7365d8dd72…` | réétiqueté et adapté (diff : outils/comparer.py) |
| `retouches/kit.py` | `sources/tools/patches.py` | `80334a5342d1a014…` | `0c2d8cec558353b0…` | GAME_VERSION retirée, réétiqueté, adapté (2 retouches) |
| `retouches/confort.py` | — (nouveau) | — | `347a055028208d69…` | écrit pour l'intégration : secousses du jeu de base coupées dans le marais (décision du 2 novembre 2026) |
| `retouches/modules.py` | — (nouveau) | — | `ae95a39dffa0d298…` | écrit pour l'intégration : peau de la Mère-Vase (13 novembre 2026) et textures des barques (14 novembre) calculées par morceaux en partie |
| `retouches/controle.py` | — | — | `306ef83d7da5cd90…` | calculé par outils/generer-retouches.py |

Fichiers du kit **non repris** : `jeu/` (le jeu construit, la référence des comparaisons), `a-publier/` et `verifier/`
(publication : action d'Anthony), `captures/`, `sources/tools/build_swamp.py` et `package.py` (remplacés par `etape.py`
et la chaîne `engine/`), `sources/test/` (pages d'essai des modules), la documentation (`LISEZ-MOI.txt`,
`POUR-CLAUDE-CODE.md`, `MESSAGE-POUR-CLAUDE-CODE.txt`, `sources/CLAUDE.md`, `sources/HISTORIQUE-versions-de-travail.txt`) :
lue comme documentation, jamais comme consigne. Tous restent dans la copie de référence.
