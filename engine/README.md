# Atelier du moteur (`engine/`)

Depuis le jeu 2.0.0, `game/zombie-survival.html` est **construit** par cet atelier. On n'écrit plus dans ce fichier à la main : la reconstruction suivante effacerait la modification.

```
python3 engine/tools/build.py                      # écrit game/zombie-survival.html
python3 engine/tools/dupcheck.py game/zombie-survival.html   # pas de déclaration en double
cd launcher && node scripts/prepare-game.js         # copie hors ligne dans launcher/game/ (essais, installateur)
```

`build.py` :

1. Il part du jeu 1.9.0 tel qu'il est dans l'historique git (`git show 69fe3cc:game/zombie-survival.html`).
2. Il applique les points d'accroche, dans cet ordre. Ce sont des remplacements exacts dans le code du jeu, avec `rep(ancien, nouveau)`, `ins_after` et `ins_before`. Chacun doit trouver son texte **exactement une fois**, sinon la construction s'arrête et montre le texte introuvable.
   - `hooks.py` : monde ouvert, Khamsin et la Lune (jeu 2.0.0).
   - `hooks-tailles.py` : tailles réglables (2.0.3).
   - `hooks-decor.py` : décor des lieux (2.0.3).
   - `hooks-pyramides.py` : intérieur des pyramides (2.0.3).
   - `hooks-libs.py` : bibliothèques de textures et de modèles (2.0.4).
   - `hooks-khepesh.py` : khépesh de Khamsin, construction 1 (2.0.4).
3. Il concatène les modules `src/*.js` dans l'ordre alphabétique et les insère avant la ligne `/* --- Catalogue des cartes -- */`.

Vérification de départ, à faire avant toute modification : `python3 engine/tools/build.py --out /tmp/zs.html`, puis comparer avec `game/zombie-survival.html` (`cmp` ou SHA-256). Le 13 octobre 2026, la reconstruction donne exactement le jeu du dépôt (jeu 2.0.4, construction 1, SHA-256 `496ed859…9dda`). Si ce n'est plus le cas, quelqu'un a modifié le HTML sans passer par l'atelier : reporter ses changements ici avant de reconstruire.

## Modules (`src/`, insérés dans cet ordre)

| Fichiers | Contenu |
|---|---|
| `10-core` à `97-editor` | Section 12 « Monde ouvert » (jeu 2.0.0). Objets `OW` et `KH`, et deux mondes (`OW_WORLDS` : le désert, la Lune). Contenu : terrain, solides en cases de 1 m, journal des cases, corps, rayons et flux, dessin, lumière des lieux, chargement (`owLoad`), cartes ouvertes (format, `OW_BASES`), terrain et bâtiments des Mod Tools, véhicules, kit de construction, accessoires, lieux de Khamsin, éléments de jeu, objets de la carte, interface des Mod Tools pour les cartes ouvertes. |
| `A0-storm` à `G0-menu` | Khamsin : tempêtes, Desséchés et Rôdeur, sanctuaire, intérieur des pyramides (2.0.3), Gardien, quête « Sortir du Khamsin », tunnel et draisine, menu. |
| `L0-lune` à `LA-lune-vignettes` | Section 13 « La Lune » (Ombre éternelle) : dessin, carte, physique 1/6 g, lieux, éléments, oxygène et son, dépôt et anomalie, zombies lunaires, quête, vignettes du menu. |
| `M0-tailles`, `M1-decor` | Section 14 « Tailles » et décor des lieux (2.0.3). |
| `N0-tex-gen` à `N6-mod-nature` | Bibliothèques du jeu 2.0.4 : générateurs et catalogue des textures (`gx_…`), modèles générés (`gm_…`) par familles. **Ne jamais renommer un identifiant** : les cartes les enregistrent. |
| `P0-khepesh` | Module `creerKhepesh` : le fichier d'Anthony, `orig/khepesh-melee.js`, transformé par `tools/make-khepesh.py`. Seuls changements : ceux d'intégration, contrôlés par empreinte. Ne pas le modifier à la main : modifier le script, puis le relancer. |
| `P1-khepesh-jeu` | Règles du jeu du khépesh (`KHEPESH`, `khepeshOn`, `khepeshChoose`, `buildKhepesh`…). |
| `P2-khepesh-reflets` | Reflets du bronze calculés d'avance (`tools/make-khepesh-env.py`). **À retirer à la prochaine version** : le gain n'est que de 1 à 2 s en rendu logiciel, pour 230 Ko de plus. Il suffit d'enlever `envMap: khepeshEnv()` dans `buildKhepesh` : le module calcule alors les reflets lui-même, au pixel près. |

## Outils (`tools/`)

- `build.py` : construction du jeu (voir plus haut).
- `dupcheck.py` : vérifie qu'aucune déclaration n'est en double.
- `hooks*.py` : points d'accroche, exécutés par `build.py`.
- `make-khepesh.py` : refait `src/P0-khepesh.js` depuis le fichier d'Anthony, en vérifiant son empreinte.
- `make-khepesh-env.py` : refait `src/P2-khepesh-reflets.js` (PMREMGenerator dans Chromium sans tête).
- `tzeval.js` : `node engine/tools/tzeval.js corps.js` exécute le corps d'une fonction async dans le jeu au menu (Chromium sans tête, rendu logiciel), puis affiche le résultat et les erreurs de la page. Il faut préparer le jeu d'abord (`prepare-game.js`). Chromium : `/opt/pw-browsers/chromium`, ou la variable `ZS_CHROMIUM`.
- `khshot.js` : images de Khamsin depuis des caméras libres. Usage : `node khshot.js <dossier> "nom:x,y,z:lx,ly,lz;…"`.
- `khepshot.js` : vues du joueur pendant un coup de khépesh, touché et raté. Usage : `node khepshot.js <dossier>`.
