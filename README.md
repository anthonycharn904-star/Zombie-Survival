# Zombie-Survival
Prototype de mon jeu "Zombie Survival", qui j'espère deviendra un grand jeu dans le futur ! Mais toujours free-to-play

Survie par manches dans le style du mode Zombies : barricades, armes au mur, boîte mystère, atouts, courant, Amplificateur. Un seul fichier HTML (Three.js r128), sons synthétisés, textures générées au démarrage.

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| `game/zombie-survival.html` | **Le jeu.** Version navigateur : c'est le fichier à modifier. La version actuelle est dans `GAME_VERSION`. |
| `launcher/` | Launcher Windows (Electron) : installe le jeu hors ligne, le met à jour (mises à jour signées) et contient l'outil de publication. |

## Jouer dans le navigateur

Ouvrir `game/zombie-survival.html` dans Chrome, Edge ou Firefox. Une connexion internet est nécessaire (Three.js et les polices viennent d'internet ; le launcher, lui, les embarque).

## Launcher

Prérequis : Node.js 22 ou plus récent. Sous Windows, rien d'autre. Sous Linux, l'installateur se compile aussi, avec wine en 32 bits (`wine32`).

```sh
cd launcher
npm install
npm test            # tests unitaires (signature des mises à jour, paquetage du jeu, publication, configuration)
npm start           # lance le launcher en mode développement
npm run dist:win    # fabrique dist/Zombie-Survival-Setup-<version>.exe
```

`npm start` et `npm run dist:win` préparent d'abord `launcher/game/` : la version hors ligne de `game/zombie-survival.html`, livrée avec l'installateur.

- Version du launcher : champ `version` de `launcher/package.json`.
- Identifiant de l'application : `fr.zombiesurvival.launcher`. Ne pas le changer, sinon Windows considère le nouveau launcher comme une autre application et la mise à jour automatique ne remplace plus l'ancien.
- Configuration des mises à jour : `launcher/config/default.json`. Elle contient l'adresse du manifeste et la clé **publique** qui vérifie les signatures. Pour la réécrire : `npm run configure -- pseudo/depot cle-publique.pem`.

## Publier une nouvelle version du jeu

1. Modifier `game/zombie-survival.html`.
2. Dans le launcher : Réglages → « Outil de publication » (ou `npm run publier`). Choisir le fichier du jeu et le numéro de version. L'outil réécrit `GAME_VERSION`, fabrique le zip et signe `latest.json`.
3. Sur GitHub, créer une release dont le tag est exactement `v<version>` (par exemple `v1.0.3`), y déposer les fichiers produits, et la marquer « Latest ».

Les joueurs reçoivent la mise à jour par l'adresse fixe `https://github.com/anthonycharn904-star/zombie-survival/releases/latest/download/latest.json`. Le dépôt qui porte les releases doit donc rester public.

## Sécurité

La clé **privée** de signature ne doit jamais entrer dans ce dépôt. Le launcher la garde chiffrée par Windows sur le PC de l'auteur. `.gitignore` bloque les fichiers `*.pem`, `*.key`, `*.p12` et `*.pfx`. Sans cette clé, personne ne peut publier une mise à jour acceptée par le launcher. Si elle est perdue, il faut en créer une nouvelle et diffuser un launcher configuré avec la nouvelle clé publique.

## Provenance (3 octobre 2026)

Les sources d'origine n'existaient que dans un espace de travail temporaire. Ce dépôt a été reconstitué à partir de la release publique `v1.0.2`, puis vérifié :

- `game/zombie-survival.html` : une fois repassé dans le code de paquetage du launcher, il redonne exactement l'`index.html` publié dans `zombie-survival-1.0.2.zip`.
- `launcher/` : code, configuration, polices, Three.js, icône et images de l'installateur proviennent de `Zombie-Survival-Setup-1.1.0.exe`. La configuration de compilation (`package.json`) a été reconstituée. Avec elle, `npm run dist:win` reproduit le launcher 1.1.0 à l'octet près, y compris l'exécutable et ses réglages de sécurité Electron. Seul diffère le jeu livré avec l'installateur, qui est maintenant la version de `game/`.
- Les tests d'origine sont perdus. `launcher/test/` contient des tests réécrits. Les tests de bout en bout (Playwright + Electron) n'ont pas été refaits.
