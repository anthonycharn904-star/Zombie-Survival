# Banc de l'interface

Outils d'analyse du chantier interface : couche HUD en 16:9 et en 21:9, propositions de mise en page, champ de vision. Ils ne font pas partie du jeu : `build.py` ne les lit pas, et ils n'écrivent rien dans le dépôt (le dossier de sortie doit être hors du dépôt). Analyse et décisions : `docs/audit-interface.md`.

## Préalable

Le jeu préparé (`launcher/game/`) et Playwright (`launcher/node_modules/`, installé par `npm ci` dans `launcher/`, avec l'accord d'Anthony) :

```bash
cd launcher && node scripts/prepare-game.js
```

## Banc de la couche HUD (léger)

```bash
python3 engine/tools/banc-interface/fabrique.py <dossier>
node engine/tools/banc-interface/capture.js <dossier>
```

- `fabrique.py` écrit dans `<dossier>` :
  - `hud.html`, la couche HUD autonome : styles et balisage du HUD du jeu préparé tels quels, module des points d'Anthony tel quel (`engine/orig/hud-points/`), polices incluses, `banc.js` ;
  - `comparaison-hud.html`, la page interactive, en un seul fichier ;
  - `schema-fov.html` et `fov.md`, le schéma et la table des deux modes du champ de vision ;
  - `planche-hud.html` et `planche-echelle.html`, les planches des captures.
- `capture.js` fait les captures avec le Chromium « sans tête » de Playwright, sans WebGL (22 s le 31 octobre 2026, machine chargée). Elles vont dans `<dossier>/captures/` : variantes, `mesures.json`, schéma, planches, et `comparaison-apercu.png` qui contrôle la page interactive. Il retire `DISPLAY` et `WAYLAND_DISPLAY` et trouve seul ce Chromium (`ZS_CHROMIUM` en impose un autre).
- `banc.js` est le script de la couche HUD : il la remplit de valeurs d'exemple et applique les variantes. Ce sont des réglages de la page, pas du jeu :
  - zone du HUD : plein écran, 21:9 ou 16:9 ;
  - échelle : mixte (actuelle) ou unique, à la règle du module des points ;
  - taille ; échelle étendue au reste du HUD ;
  - cadre 16:9, emplacement réservé de la jauge du boss, distances au centre.
- `comparaison.js` porte les commandes de la page interactive. Elle s'ouvre dans un navigateur, sans serveur :
  - touches `1` à `4` : propositions ; `H` : panneau ; `P` : plein écran ;
  - « écran réel » montre le HUD à la taille de la fenêtre, mise à l'échelle de Windows comprise ;
  - les autres écrans sont simulés, puis réduits pour tenir dans la fenêtre.

**Limite** : la couche HUD est rendue sans la scène 3D ni ce que le jeu dessine dans ses canevas. La mini-carte et la boussole y sont des repères de même taille et de même place.

## Banc 3D du champ de vision (lourd)

Depuis le 2 novembre 2026, il passe par la file commune des tâches lourdes (consigne d'Anthony), en classe `jeu` :

```bash
~/outils/bin/zs-lourd --classe jeu --memoire 4000 --nom "banc 3D : champ de vision" -- node engine/tools/banc-interface/vue3d.js <dossier> [--carte bunker7]
```

Il capture la même vue du jeu dans trois cas :
- en 2560 × 1440 ;
- en 3440 × 1440 avec le champ actuel ;
- en 3440 × 1440 avec le champ Hor+, simulé par le seul réglage.

Le jeu entier tourne en rendu logiciel, pendant plusieurs minutes.
- **Mémoire.** L'estimation de 1,5 Go (31 octobre) était trop basse. Une page du jeu 2.0.6, souris verrouillée refusée, a pris de 1,4 à 2,5 Go cette nuit sous la file (pics des autres sessions), et les tampons en 3440 × 1440 ajoutent de 0,3 à 0,5 Go. Il faut compter environ 3 Go, d'où le budget de 4 000 Mo. Après le premier passage, l'ajuster d'après la colonne `pic_go` du journal (`zs-lourd journal 5`).
- **Souris verrouillée.** Elle est refusée dans la page (2 novembre 2026). Le bandeau « Souris libre » est masqué avant chaque capture.
- **Garde.** Hors de la file, le script refuse de partir si la machine est chargée : plus de 0,5 de charge par fil, ou moins de 3 Go disponibles. `--forcer` passe outre, seulement avec l'accord d'Anthony.
  - Sous la file, cette garde ne joue plus : la file a déjà décidé du départ, et elle laisse tourner un jeu à côté de rendus Blender. L'outil se reconnaît sous la file quand `ZS_LOURD_CLASSE` vaut `jeu` et que le fichier `ZS_LOURD_PLACE` existe. Adaptation faite le 2 novembre 2026 avec l'accord d'Anthony, comme pour la capture de la Mère-Vase (`maquettes/launcher/scene-bete/README.md`, §2 bis).
- Pas encore lancé au 2 novembre 2026.

## Effets sur les autres sessions (vérifiés le 31 octobre 2026)

- **Lecture** :
  - `launcher/game/` et `engine/orig/hud-points/` de ce worktree ;
  - `launcher/node_modules/playwright-core` ;
  - le Chromium du cache de Playwright (`~/.cache/ms-playwright`).
- **Écriture** :
  - le dossier de sortie donné, refusé s'il est dans le dépôt ;
  - le profil temporaire de Chromium, créé par Playwright dans `$TMPDIR` sous un nom unique, puis effacé.
- **Réseau** : aucun pour la couche HUD (`file://`). Le banc 3D ouvre un serveur local sur `127.0.0.1`, à un port choisi par le système, fermé à la fin.
- **Aucun chemin absolu** : le dépôt est trouvé depuis l'emplacement des scripts, donc les outils marchent dans n'importe quel worktree.
