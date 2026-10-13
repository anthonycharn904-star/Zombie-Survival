# Jeu 2.0.3 : intérieur des pyramides de Khamsin (src/C5-pyramides.js). Exécuté par build.py après
# hooks-decor.py : interface 8 des Mod Tools (prix des herses), la boîte mystère ne part pas derrière
# une herse fermée.
rep("const EDITOR_API = 7;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe (jeu 2.0.3, launcher 1.3.2)",
    "const EDITOR_API = 8;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe, 8 : intérieur des pyramides, prix des herses (jeu 2.0.3, launcher 1.3.2)")
rep("""        let n = randInt(0, box.locs.length - 1);
        if (n === box.cur) n = (n + 1 + randInt(0, box.locs.length - 2)) % box.locs.length;""",
    """        // jeu 2.0.3 : pas derrière une porte encore fermée (herse d'une pyramide)
        const free = box.locs.map((L, i) => i).filter((i) => i !== box.cur && !(box.locs[i].locked && box.locs[i].locked()));
        let n = free.length ? free[randInt(0, free.length - 1)] : randInt(0, box.locs.length - 1);
        if (!free.length && n === box.cur) n = (n + 1 + randInt(0, box.locs.length - 2)) % box.locs.length;""")
