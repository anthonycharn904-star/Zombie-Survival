# Rapport technique : Chromium sans tête, souris verrouillée et flot d'évènements de souris

Pour : Claude Code 5 (développement, moteur du jeu). Rédigé par la session du boss de Bunker 7 (worktree `~/dev/zs-bunker7`, branche `chantier/bunker7`), les 1er et 2 novembre 2026, à la demande d'Anthony. Rien n'est fusionné ; les worktrees des autres sessions n'ont pas été touchés.

## Résumé

Le jeu demande la souris verrouillée (« pointer lock ») à chaque partie : `startGame` appelle `requestLock`. Le Chromium « sans tête » de Playwright (`headless_shell` 141, Linux, rendu logiciel) l'accorde sans geste de l'utilisateur, puis produit en boucle des évènements « souris déplacée » synthétiques : environ 160 000 par seconde. Son processus principal occupe alors plus d'un cœur et grossit d'environ 40 Mo par seconde ; la page grossit aussi, surtout pendant un long script synchrone, où les évènements s'accumulent.

Un essai long, celui du boss (environ trois minutes de jeu simulé), a saturé la mémoire d'Ubuntu le 1er novembre 2026 : son navigateur a été tué par le système à 21 h 35 (environ 18 Go), et très probablement déjà à 20 h 42.

Correction : refuser le verrou dans la page. La mémoire reste stable et les essais vont deux fois plus vite. Le jeu n'est pas modifié.

## Symptômes

- Essai figé en plein bloc, machine au repos ; dans le journal du noyau (`dmesg | grep -i oom`, en retard d'environ 55 minutes sous WSL), un `headless_shell` tué (7,9 Go de mémoire anonyme) à côté de son processus principal (7,25 Go).
- Pendant un essai :
  - processus principal du navigateur (sans `--type=`, fil `CrBrowserMain`) entre 100 et 120 % d'un cœur ;
  - sa mémoire grossit de 25 à 40 Mo/s, celle de la page de 5 à 160 Mo/s selon le moment ;
  - le tas JavaScript reste constant (215 Mo) ;
  - les messages de la console de la page arrivent avec des dizaines de secondes de retard.

## Diagnostic

1. **Surveillance de `/proc`** (mémoire résidente et temps de calcul de chaque processus `headless_shell` et de chaque fil, toutes les 10 s) : le fil principal du navigateur est occupé, sa mémoire et celle de la page gonflent, le tas JavaScript ne bouge pas.
2. **Sonde dans la page** (enveloppes de `Storage.setItem`, `console.*`, `speechSynthesis.speak`, `URL.createObjectURL`, `postMessage`) : aucun flot de ce côté.
3. **Trace Chromium** (`browser.startTracing`, catégories `input`, `mojom`, `ipc`), sur 5 s de partie de Bunker 7 simulées en 0,8 s :
   - 579 Mo de trace ;
   - 130 883 `RenderWidgetHostViewBase::OnMouseEvent` dans le fil principal du navigateur ;
   - autant de `InputRouterImpl::FilterAndSendWebInputEvent` vers la page ;
   - des `EventLatency` de type `MOUSE_MOVED_EVENT`.
4. **Essai ciblé** :
   - au menu : 0 % ;
   - partie lancée : `document.pointerLockElement` est le canvas 500 ms plus tard ; navigateur à 114 % d'un cœur, +79 Mo en 5 s ;
   - après `document.exitPointerLock()` : 0 %, mémoire rendue (99 Mo).

Mécanisme probable, non vérifié dans le code de Chromium : une fois le verrou accordé, le navigateur recentre le curseur après chaque mouvement, et la plateforme sans écran (Ozone headless) renvoie ce recentrage comme un nouveau mouvement ; d'où la boucle.

## Correction (branche `chantier/bunker7`, non fusionnée)

`engine/tools/mains.js` (et donc `e2e-page.js`, qui le lance) et `engine/tools/tzeval.js`, puis, le 2 novembre avec l'accord d'Anthony (« OK pour khshot.js et khepshot.js »), `engine/tools/khshot.js` et `engine/tools/khepshot.js`, juste après le chargement du jeu, avant toute partie :

```js
await page.evaluate(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new DOMException('banc sans tête : souris non verrouillée', 'NotSupportedError'));
  };
});
```

Le jeu traite ce refus comme celui d'un navigateur qui refuse le verrou : `requestLock` → `setFallback(true)`, mode « souris libre ». Avec Playwright, `page.addInitScript` ferait la même chose pour toutes les pages, avant leur chargement.

## Résultats mesurés

Même machine, priorité minimale (`nice -n 19`, `ionice -c 3`), sauf l'essai de `khshot.js` et `khepshot.js` du 2 novembre, lancé par `zs-lourd` à sa priorité (`nice -n 10`, plus `ionice -c2 -n7` quand le système le permet).

| Mesure | Souris verrouillée | Souris refusée |
|---|---|---|
| Blocs 1 et 4 de l'essai du boss (48 s) | navigateur 89 → 1 369 Mo, environ 1 cœur ; page 2 383 Mo ; mémoire libre 13,1 → 9,4 Go | navigateur 90 Mo, au repos ; page 854 Mo ; 13,0 → 12,0 Go |
| Essai du boss complet (8 blocs) | arrêté à 2 min 52 s (navigateur 5,3 Go, page 8 Go, mémoire libre 0,3 Go) ; le 1er novembre, tué par le système | 1 min 18 s à 1 min 31 s ; navigateur 91 Mo, page 1,7 Go au plus, rendu environ 1 Go |
| Les 12 essais habituels dans la page (`e2e-page.js`) | 13 min 30 s (machine chargée par une autre session) | 7 min (machine peu chargée) |
| Résultats de ces 12 essais | 460 sur 460 | 460 sur 460 (le bloc `zombie-anims` b04 reste l'échec connu de ce mode) |
| `khshot.js` (2 vues de Khamsin) puis `khepshot.js` (20 vues du khépesh), 2 novembre, un travail `zs-lourd` | pas mesuré (le relancer ainsi ferait gonfler la mémoire) | 40 s et 61 s ; pic de mémoire 1,56 Go pour les deux ; dans `khshot.js`, sonde lue après le départ de la partie (son 3e argument, le « code avant ») : `document.pointerLockElement` nul, souris libre, partie en cours, bandeau masqué ; `khepshot.js` : même bloc, sans sonde (il ne prend que son dossier) ; aucune exception dans la page pour les deux, aucune erreur dans la console pour `khepshot.js` (le seul qui l'écoute) ; images normales |

## Ce qui n'est pas concerné

- Le jeu des joueurs (Windows, launcher Electron) : le verrou y est natif ; aucun signe de boucle dans les essais d'Anthony.
- La méthode E2, côté Electron (sous Linux, rendu logiciel) : **pas mesuré**. Le launcher peut accorder le verrou sans geste de l'utilisateur, et l'essai `boss-b7`, aux blocs synchrones les plus longs, ne le refuse pas. Le Chromium complet d'Electron sous X11 recentre le curseur normalement, ce qui rend la boucle peu probable ; à confirmer au prochain passage E2, en relevant la mémoire des processus d'Electron (ou `document.pointerLockElement` pendant un essai). Après la fermeture du launcher, cinq essais E2 (`modtools-decor`, `modtools-desert`, `modtools-khamsin`, `modtools-ombre`, `modtools-sizes`) ouvrent aussi le jeu publié dans un Chromium de Playwright sans tête ; deux y lancent une partie : voir la section suivante.

## À examiner dans les autres sessions, sans modifier leurs worktrees

Tout outil qui ouvre le jeu dans un Chromium sans tête et lance une partie (`__zs.start()`, `startGame`, bouton Jouer, partie de test des Mod Tools, `ZS.playTest`) :

1. **Lire le code.** Le jeu demande-t-il le verrou dans ce chemin ? Le banc le refuse-t-il ? À voir :
   - les copies de `tzeval.js`, `mains.js`, `e2e-page.js`, `khshot.js` et `khepshot.js` de chaque worktree ;
   - les essais E2 `launcher/e2e/modtools-desert.e2e.js` et `modtools-ombre.e2e.js`, dans toutes les branches (`chantier/bunker7` comprise : pas changés, l'accord d'Anthony ne visant que `khshot.js` et `khepshot.js`) : après la fermeture du launcher, ils ouvrent le jeu publié dans un Chromium de Playwright sans tête (`chromium.launch` sur `/opt/pw-browsers/chromium`, sans option `headless`) et y lancent une partie (`__zs.start()`, lignes 286 et 251) sans refuser le verrou ; la partie ne dure qu'un contrôle avant `browser.close()` : risque faible, non mesuré ; correction proposée à Anthony le 2 novembre : le même refus, injecté avant `__zs.start()` ;
   - les outils de capture de la session Interface (fond animé, cadrage) ;
   - les outils et essais de la session Marécages (`engine/marecages/outils`, `essais`) ;
   - tout script Playwright privé.
2. **Mesurer** (deux minutes), avec un essai qui démarre une partie, de l'une de ces deux façons :
   - relever toutes les 10 s la mémoire résidente (`/proc/<pid>/status`) et le temps de calcul (`/proc/<pid>/stat`) des processus `headless_shell` ; un processus principal qui gonfle en occupant un cœur signe le défaut ;
   - lire `document.pointerLockElement` une seconde après le début de la partie.
3. **Corriger** par la même ligne, injectée avant la partie, ou par `page.addInitScript`.
4. **À proposer à Anthony** : une aide commune pour ouvrir le jeu dans le banc (serveur, Chromium, refus du verrou, garde de mémoire), plutôt qu'une copie par outil.

Dans la page, le refus supprime aussi le passage « verrou perdu → pause » du jeu, qu'Electron peut prendre ; l'essai `boss-b7` simule cette perte quand la fenêtre passe en arrière-plan (critère 11). Avec le verrou refusé, une partie lancée dans le banc affiche aussi le bandeau « souris libre » (`#lockhint`) : `tzeval.js`, `khshot.js` et `khepshot.js` le masquent pour leurs captures de la page (dans les deux derniers, il était déjà caché avec le HUD).

## Fichiers

- `engine/tools/mains.js`, `engine/tools/tzeval.js`, `engine/tools/khshot.js`, `engine/tools/khepshot.js` : la correction.
- `engine/README.md` : outils d'essai, paragraphe « Souris verrouillée ».
- `SUIVI-BOSS-B7.md` : étape 9, outils d'essai.
