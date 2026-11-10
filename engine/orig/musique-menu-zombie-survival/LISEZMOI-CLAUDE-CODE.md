# Musique du menu de Zombie Survival — consignes d'intégration (pour Claude Code)

Musique originale du menu principal, demandée par Anthony : elle tourne **en boucle, sans blanc ni accroc**, depuis l'écran titre jusqu'au début de la partie. Ré mineur, 80 bpm, boucle de 96 s (boîte à musique hantée → chœur → la horde → retour au début).

## Contenu

```
musique-menu-zombie-survival/
├── LISEZMOI-CLAUDE-CODE.md      ← ce fichier
└── audio/
    ├── musique/menu.mp3         ← la musique (2,3 Mo, 97 s : boucle de 96 s + 0,5 s de marge de chaque côté)
    ├── audio-zombies.js         ← module audio v1.6.0 (remplace l'ancienne version, script classique)
    ├── audio-zombies.mjs        ← le même module en ES module (si le jeu fait `import`)
    └── audio-zombies-sons.js    ← seulement si le jeu est ouvert en double-cliquant sur index.html (file://)
```

## Point important : la boucle

Ne joue **jamais** `menu.mp3` avec `<audio loop>` ni en relançant le fichier à la fin : un MP3 commence et finit par un peu de silence d'encodage, et le fichier contient en plus 0,5 s de marge avant et après la boucle. La boucle exacte va de **0,5 s à 96,5 s** du fichier. Le module v1.6.0 la joue correctement (`AudioBufferSourceNode` avec `loopStart = 0.5`, `loopEnd = 96.5`).

## Ce qu'il faut faire, dans l'ordre

### Cas 1 — le jeu utilise déjà le module `audio-zombies.js` (paquet de sons de Zombie Survival)

1. Copier `audio/musique/menu.mp3` dans le dossier `musique/` du jeu (à côté de `arrivee.mp3`, `manche-a.mp3`, `manche-b.mp3`).
2. Remplacer `audio-zombies.js` (et `audio-zombies.mjs` s'il est utilisé) par ceux de ce ZIP. Le reste de l'API ne change pas ; `preload()` charge maintenant 13 sons au lieu de 12.
3. Si le jeu charge `audio-zombies-sons.js` (jeu ouvert en `file://`), le remplacer aussi : l'ancien ne contient pas la musique du menu.
4. À l'affichage de l'écran titre (y compris au chargement de la page), appeler :

   ```js
   sons.menu();          // fondu d'entrée de 2 s ; sans effet si le menu joue déjà
   ```

   Le navigateur bloque le son tant que le joueur n'a ni cliqué ni appuyé sur une touche : la musique démarre d'elle-même au premier clic ou à la première touche. Aucun code supplémentaire n'est nécessaire.

5. **Ne rien ajouter pour l'arrêter** : `sons.arrivee()`, déjà appelé quand le joueur apparaît dans la map, éteint le menu avec un fondu d'1 s pendant que la musique d'arrivée démarre. `sons.changementManche()` l'éteint aussi.
6. Retour au menu après une partie (mort, abandon, fin) : appeler `sons.menu()`. Il coupe en fondu la musique et les annonces de la partie, puis relance la musique du menu.
7. Changer de sous-menu (options, choix de la map…) : **ne pas** appeler `sons.arreterMenu()` puis `sons.menu()`, sinon la boucle repart du début. Laisser jouer.

Membres ajoutés en v1.6.0 :

| Membre | Rôle |
|---|---|
| `sons.menu(fondu = 2)` | lance la musique du menu en boucle ; coupe d'abord la partie en cours ; sans effet si elle joue déjà |
| `sons.arreterMenu(fondu = 1)` | l'arrête (par exemple pour un écran de chargement silencieux) |
| `sons.enMenu` | `true` pendant qu'elle joue ou attend le premier clic |
| évènements `menu` / `menu-fin` | `sons.on('menu', (e) => …)` : `{ debut, boucle: [0.5, 96.5], duree: 96 }` ; `menu-fin` : `{}` |

`sons.stop()` coupe aussi le menu. Le volume suit le canal « musique » (`sons.setVolume('musique', v)`).

### Cas 2 — le jeu n'utilise pas ce module

Jouer le fichier avec Web Audio, en bouclant entre 0,5 s et 96,5 s :

```js
const ctx = new AudioContext();                     // ou l'AudioContext du jeu
const buf = await ctx.decodeAudioData(await (await fetch('audio/musique/menu.mp3')).arrayBuffer());
const gain = ctx.createGain(); gain.connect(ctx.destination);
let source = null;

function jouerMenu() {                              // à l'écran titre
  if (source) return;                               // déjà en cours : ne pas relancer
  source = ctx.createBufferSource();
  source.buffer = buf; source.loop = true; source.loopStart = 0.5; source.loopEnd = 96.5;
  source.connect(gain);
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.8, t + 2);
  source.start(t, 0.5);                             // démarre au début de la boucle
}
function arreterMenu() {                            // au début de la partie
  if (!source) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 1);
  source.stop(t + 1.05); source = null;
}
// le navigateur exige un geste du joueur : appeler ctx.resume() dans le premier clic ou appui de touche
addEventListener('pointerdown', () => ctx.resume(), { once: true });
addEventListener('keydown', () => ctx.resume(), { once: true });
```

## Vérifications à faire et à rapporter à Anthony

| # | Critère | Comment vérifier |
|---|---|---|
| 1 | Chargement | aucun message `AudioZombies :` dans la console ; `preload()` résout `{ charges: 13, total: 13 }` (cas 1) |
| 2 | Démarrage | sur l'écran titre, la musique part au premier clic ou à la première touche |
| 3 | Boucle | après 96 s (1 min 36), elle reprend au début sans blanc ni accroc |
| 4 | Sous-menus | passer dans les options et revenir ne la relance pas |
| 5 | Début de partie | au clic sur « Jouer », elle s'éteint en fondu d'1 s pendant que la musique d'arrivée démarre ; `sons.enMenu === false` |
| 6 | Retour au menu | après une partie, `sons.menu()` relance la musique du menu |
| 7 | Volume | le curseur « musique » des options agit aussi sur le menu |

## Licence

Composition originale, entièrement synthétisée (aucun échantillon ni banque de sons), écrite pour Zombie Survival : utilisable, modifiable et distribuable avec le jeu, y compris dans un jeu vendu.
