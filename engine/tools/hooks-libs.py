# Jeu 2.0.4 : grandes bibliothèques de textures et de modèles (src/N0-tex-gen.js, N1-tex-cat.js, N2-…).
# Exécuté par build.py après hooks-pyramides.py : version 2.0.4, interface 9 des Mod Tools, textures
# lumineuses (canal de lumière propre des générateurs), exports pour le navigateur des Mod Tools.
rep("const GAME_VERSION = '2.0.3';", "const GAME_VERSION = '2.0.4';")
rep("const EDITOR_API = 8;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe, 8 : intérieur des pyramides, prix des herses (jeu 2.0.3, launcher 1.3.2)",
    "const EDITOR_API = 9;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe, 8 : intérieur des pyramides, prix des herses (jeu 2.0.3, launcher 1.3.2) ; 9 : bibliothèques de textures et de modèles (jeu 2.0.4, launcher 1.3.3)")
rep("""    const [w, h] = texResolution(d);
    const c = makeCanvas(w, h);
    d.gen(c.getContext('2d', { willReadFrequently: true }), w, h, mulberry32(hashStr(d.id)));
    t = new THREE.CanvasTexture(c);
  }""", """    const [w, h] = texResolution(d);
    const c = makeCanvas(w, h);
    // jeu 2.0.4 : texture lumineuse (d.glow) — son canal de lumière propre est dessiné en même temps
    let gc = null;
    if (d.glow) { gc = makeCanvas(w, h); const gg = gc.getContext('2d', { willReadFrequently: true }); gg.fillStyle = '#000'; gg.fillRect(0, 0, w, h); }
    d.gen(c.getContext('2d', { willReadFrequently: true }), w, h, mulberry32(hashStr(d.id)), gc ? gc.getContext('2d', { willReadFrequently: true }) : undefined);
    t = new THREE.CanvasTexture(c);
    if (gc) {
      const tl = new THREE.CanvasTexture(gc);
      tl.wrapS = tl.wrapT = THREE.RepeatWrapping; tl.anisotropy = 8; tl.encoding = THREE.sRGBEncoding;
      LEVEL_TEX[`${id}#lum`] = share(tl);
    }
  }""")
rep("""  const m = new THREE.MeshStandardMaterial({ map: levelTexture(id), vertexColors: true, roughness: d.rough, metalness: d.metal || 0 });
  share(m);
  LEVEL_MAT[id] = m;""", """  const m = new THREE.MeshStandardMaterial({ map: levelTexture(id), vertexColors: true, roughness: d.rough, metalness: d.metal || 0 });
  // jeu 2.0.4 : texture lumineuse (néons, écrans, vitraux, lave…) : sa lumière propre ne dépend pas de l'éclairage
  if (d.glow && LEVEL_TEX[`${id}#lum`]) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = LEVEL_TEX[`${id}#lum`]; m.emissiveIntensity = d.glow; }
  share(m);
  LEVEL_MAT[id] = m;""")
rep("  normalizeMap, serializeMap, validateMap, analyzeMap, blankMap, buildWorld, disposeWorld, textureThumb, modelParts, PropBatch,",
    "  normalizeMap, serializeMap, validateMap, analyzeMap, blankMap, buildWorld, disposeWorld, textureThumb, modelParts, PropBatch,\n"
    "  /* interface 9 (jeu 2.0.4) : bibliothèques de textures et de modèles (métadonnées des filtres, vignettes sans cache) */\n"
    "  LIB_FACETS, textureThumbRaw, get libStats() { return { gen: GX.n, families: GX.fams.size, textures: Object.keys(TEXLIB).length, genModels: MD.n, modelFamilies: MD.fams.size, models: Object.keys(MODELS).length, ms: GX.ms }; },")
