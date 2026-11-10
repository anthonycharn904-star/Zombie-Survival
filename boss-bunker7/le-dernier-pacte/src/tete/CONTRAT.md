# Contrat de données — `BOSS_B7_TETE` (tête du Septième, boss de Bunker 7)

Fichier : `boss/tete/out/boss-tete.js` (≈ 2,0 Mo). Script classique → `globalThis.BOSS_B7_TETE` ; CommonJS →
`module.exports`. Généré par `boss/tete/bpack.py` ; vérifié par `node boss/tete/verif_contrat.js` (55 contrôles,
résultat dans `out/verif_contrat.txt`). Personnage entièrement inventé : il ne représente aucune personne réelle.

Même contrat que la tête précédente (DESIGN.md, « Contrat de données de la tête ») : aucun champ retiré, renommé
ou réencodé. Seuls changent le contenu (nouveau visage, textures) et trois ajouts facultatifs : `cou.ferme`,
`orm` (description des canaux) et le canal B de l'ORM (métal des agrafes).

## Repères et unités

- Toutes les positions sont dans le **repère du corps du boss**, en **mètres** : pieds à y = 0 en pose de
  référence, +Y en haut, +Z vers l'avant (regard), +X = gauche du personnage (convention d'Anthony).
- `origin` = HEAD_ORIGIN = `[0, 1.620, 0.064]` : milieu des deux globes oculaires.
- Les deltas de la morphose sont dans les mêmes axes, en 1/100 mm.
- Os à utiliser : `head` (0, 1.544, −0.012), `neck` (0, 1.437, −0.034), `chest` (sous le col).

## Champs communs avec `SURVIVANT_TETE` (mêmes encodages)

| Champ | Contenu |
|---|---|
| `version` | 1 |
| `nv`, `nf` | 9 648 sommets (après coutures UV), 14 904 triangles |
| `bbox` | `[minx, miny, minz, maxx, maxy, maxz]` en m (y de 1,348 à 1,747) |
| `origin` | HEAD_ORIGIN |
| `eye` | `{ x: 0.0315, r: 0.012, lid: 0.0123, amande: {...} }` (m). `amande` (mm, repère de l'œil) = constantes des paupières si le moteur veut une ombre de paupière : `rr` 15,5, `cm` canthus médial, `cl` canthus latéral, `hUp` 3,4, `hLo` 6,4 |
| `pos` | base64 Uint16 × 3 par sommet, quantifié dans `bbox` : `p = min + (max − min) × q / 65535` |
| `nrm` | base64 Int8 × 3 par sommet (× 127, à renormaliser) |
| `uv` | base64 Uint16 × 2 par sommet (÷ 65535). Un seul jeu d'UV (en r128, copier en `uv2` pour `aoMap`) |
| `idx` | base64 Uint16 (Uint32 si nv ≥ 65 536) |
| `tex.albedo` | WebP 2048², **sRGB** |
| `tex.normal` | JPEG 2048², linéaire, espace tangent convention Three.js (`perturbNormal2Arb`), `normalScale = (1, 1)`. Porte tout le relief fin : sillons et bourrelets du sceau, cicatrice, agrafes, pores, rides |
| `tex.orm` | WebP 1024², linéaire : R = occlusion, G = rugosité, **B = métal (1 sur les agrafes, 0 ailleurs)** → `aoMap` + `roughnessMap`, `roughness: 1`, et au choix `metalness: 0` (agrafes en acier mat, suffisant) ou `metalnessMap: orm, metalness: 1` |

## Champs propres au boss

| Champ | Contenu |
|---|---|
| `tex.emission` | WebP 2048², **sRGB** : sillons du sceau incandescents (rouge-orangé, plus chauds près du nœud central), légère lueur dans la peau autour, fond de gorge rougeoyant ; noir ailleurs. `emissiveMap`, `emissive = blanc`, `emissiveIntensity` ≈ 1,5–3 (une pulsation lente est bienvenue) |
| `tex.oeil` | WebP 512², sRGB : sclère sombre injectée de sang, iris rouge sombre, pupille noire |
| `tex.oeilEmission` | WebP 512², sRGB : iris rouge incandescent (rouge-orangé près de la pupille, rouge profond au bord), vaisseaux à peine lumineux |
| `yeux` | `{ gauche: [0.0315, 1.62, 0.064], droit: [−0.0315, 1.62, 0.064], rayon: 0.012 }` (gauche = +X) |
| `bouche` | morphose « mâchoire ouverte » : `idx` b64 Uint16 (1 656 sommets), `delta` b64 Int16 (dx, dy, dz en 1/100 mm, relatifs), `n`. Influence 0 → 1 : 31 mm d'ouverture au menton |
| `machoire` | `{ pivot: [0, 1.592, −0.006], axe: [1, 0, 0], angle: 0.25 }` : rotation qui donne la même position que la morphose pour tout ce qui est rigide (menton, dents du bas, langue) |
| `dents.haut`, `dents.bas` | `{ v: [x, y, z, ...] (m), i: [...] (index), c: [teinte 0..1 par sommet] }` ; `dents.bas.vOuvert` = positions bouche grande ouverte. `dents.couleur` = `#7d6e51`. Bords libres placés hors de la fente labiale : bouche fermée, on ne voit presque que le noir de la cavité |
| `cavite` | langue : `{ v, i, vOuvert, couleur: '#3a1a1c' }` (m) ; `caviteBas` = tous ses sommets (elle suit entièrement la mâchoire). Les parois de la bouche font partie du maillage de la tête (texturées sombres) |
| `peau` | poids de peau suggérés : `{ os: ['head', 'neck', 'chest'], poids: b64 Uint8 × 3 par sommet (somme 255) }` — visage et crâne sur `head`, cou sous la mâchoire sur `neck`, bas du cou sur `chest` |
| `cou` | `{ yBas: 1.348, rayonBas: 0.0535, centreZ: −0.034, ferme: true }` : le cou est **fermé** en bas (fond plat à bord arrondi, sombre, à y = 1,348) — plus de bord ouvert ni dentelé quand la tête bascule en arrière |
| `orm` | `{ r: 'occlusion', g: 'rugosite', b: 'metal (agrafes)' }` (description, facultatif) |
| `nom` | `'tete du Septieme (boss de Bunker 7)'` |

Le maillage de la peau est fermé et manifold (chaque arête partagée par deux triangles, après fusion des sommets
dupliqués par les coutures UV) : contrôlé par `verif_contrat.js`.

## Animer la bouche

Même poids `k` (0..1) partout :
- tête : `morphTargetInfluences[0] = k` (morphose relative, `morphTargetsRelative = true`) ;
- dents du bas et langue : position = `lerp(v, vOuvert, k)` (identique à la morphose, conseillé) ou
  rotation de `k × machoire.angle` autour de `machoire.pivot` / `axe` (écart ≤ 0,7 mm à mi-ouverture) ;
- dents du haut : fixes (os `head`).

## Rendu conseillé

- Tête : `MeshStandardMaterial({ map: albedo, normalMap: normal, aoMap: orm, roughnessMap: orm, roughness: 1,
  metalness: 0, emissiveMap: emission, emissive: 0xffffff, emissiveIntensity: 2 })`, skinnée avec `peau` ou
  rigide sur l'os `head` (le fond du cou est fermé dans les deux cas). Facultatif : `metalnessMap: orm,
  metalness: 1` pour des agrafes métalliques (utile surtout avec une carte d'environnement).
- Yeux : sphère de rayon `yeux.rayon` à chaque position, pôle tourné vers +Z, UV en projection frontale
  `u = 0,5 + x_local / 0,0248`, `v = 0,5 + y_local / 0,0248` (x_local, y_local en m depuis le centre de l'œil) ;
  `map: oeil`, `emissiveMap: oeilEmission`, `emissiveIntensity` ≈ 3, `roughness` 0,25. Un halo additif rouge devant
  chaque œil renforce l'effet sans post-traitement.
- Dents : couleur `dents.couleur` × teinte de sommet `(c, 0,95 c, 0,82 c)`, rugosité ≈ 0,4. Langue : `cavite.couleur`.
- Peau : l'albédo est gris-bleuté très pâle ; sous un éclairage de scène chaud, une lumière d'appoint froide garde la
  pâleur voulue. Pas de cils séparés ni de clignement ; aucun cheveu (crâne rasé, sourcils gris clairsemés peints).

## Décodage minimal (Three.js r128 ou récent)

```js
function b64bytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function decodeTete(THREE, D) {
  const nv = D.nv, bb = D.bbox;
  const q = new Uint16Array(b64bytes(D.pos).buffer), nq = new Int8Array(b64bytes(D.nrm).buffer), uq = new Uint16Array(b64bytes(D.uv).buffer);
  const iq = nv < 65536 ? new Uint16Array(b64bytes(D.idx).buffer) : new Uint32Array(b64bytes(D.idx).buffer);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = bb[k] + (bb[k + 3] - bb[k]) * q[i * 3 + k] / 65535;
    const nx = nq[i * 3] / 127, ny = nq[i * 3 + 1] / 127, nz = nq[i * 3 + 2] / 127, l = Math.hypot(nx, ny, nz) || 1;
    nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l;
    uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('uv2', new THREE.BufferAttribute(uv, 2));            // aoMap en r128
  g.setIndex(new THREE.BufferAttribute(iq, 1));
  const bi = nv < 65536 ? new Uint16Array(b64bytes(D.bouche.idx).buffer) : new Uint32Array(b64bytes(D.bouche.idx).buffer);
  const bd = new Int16Array(b64bytes(D.bouche.delta).buffer), mo = new Float32Array(nv * 3);
  for (let j = 0; j < bi.length; j++) for (let k = 0; k < 3; k++) mo[bi[j] * 3 + k] = bd[j * 3 + k] / 100000;   // 1/100 mm → m
  g.morphAttributes.position = [new THREE.BufferAttribute(mo, 3)];
  g.morphTargetsRelative = true;
  // poids de peau : const w = b64bytes(D.peau.poids) → skinWeight = w[i*3+k] / 255 pour les os D.peau.os[k]
  return g;
}
```
En r128 : `material.morphTargets = true` (et `skinning = true` si `SkinnedMesh`). Textures couleur : `encoding =
sRGBEncoding` (r128) ou `colorSpace = SRGBColorSpace` (r152+) ; normales et ORM en linéaire.

Compatibilité vérifiée avec le décodeur du modèle (`boss/src/modele/apercu.html?tete=b7`, r128 et r186) : tête
chargée (`BOSS_B7_TETE`), aucune erreur de console.

## Écarts au contrat de `DESIGN.md`

Aucun champ retiré ni renommé. Ajouts : `eye.amande`, `peau`, `cou` (avec `ferme`), `orm`, `dents.*.c`,
`dents.couleur`, `dents.bas.vOuvert`, `cavite.vOuvert`, `cavite.couleur`, `bouche.n`, `nom`. Pas de champs de
clignement ni de cils (`blink*`, `lash`, `hairL`, `flow` de `SURVIVANT_TETE`) : le boss ne cligne pas, il n'a pas
de cheveux.
