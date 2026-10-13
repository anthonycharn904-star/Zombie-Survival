# Jeu 2.0.3 : décor des lieux de la base retouchable (pièces et surfaces sélectionnables dans les Mod
# Tools, matières, plus de pièce fixe). Exécuté par build.py après hooks-tailles.py ; le moteur est
# dans src/M1-decor.js.
rep("const EDITOR_API = 5;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles (jeu 2.0.3, launcher 1.3.2)",
    "const EDITOR_API = 7;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe (jeu 2.0.3, launcher 1.3.2)")
rep("    reliefAt: owEditorReliefAt, protectAt: (x, z) => owProtectMask()[owPointIndex(x, z)] / 255, get baseId() { return OW.baseId; }, baseThumb: owBaseThumb,",
    "    reliefAt: owEditorReliefAt, protectAt: (x, z) => owProtectMask()[owPointIndex(x, z)] / 255, get baseId() { return OW.baseId; }, baseThumb: owBaseThumb,\n"
    "    /* interfaces 6 et 7 (jeu 2.0.3) : décor des lieux de la base. Nœuds : les pièces (0 … placeCount.items − 1)\n"
    "       puis leurs surfaces ; placeHit : le nœud sous la souris dans la vue 3D (objet et triangle touchés). */\n"
    "    placeItems: owEditorPlaceItems, placeState: owEditorPlaceState, placeLocal: owEditorPlaceLocal, placePose: owEditorPlacePose, placeAt: owEditorPlaceAt,\n"
    "    placeHit: owEditorPlaceHit, placeMatrices: owEditorPlaceMatrices, get placeCount() { return { items: OWPI.list.length, prims: OWPI.prims.length }; },\n"
    "    get placeRoot() { return OWPI.root; }, placeObj: (i) => { const n = owNodeAt(i); return n ? (n.item ? n.item.group : n.group) : null; },")
