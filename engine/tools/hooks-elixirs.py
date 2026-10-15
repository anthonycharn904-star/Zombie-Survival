# Points d'accroche du jeu 2.0.5 (construction 1) : correctif du halo du globe de Vif-Argent.
# Exécuté par build.py après hooks-khepesh.py.

# Halo du globe de Vif-Argent : jamais affiché depuis le jeu 1.8.0 (commit 7c76a22). Un commentaire
# de fin de ligne avalait les deux instructions qui placent le halo au centre du globe et l'ajoutent
# à la machine : le halo était créé et animé, mais jamais dessiné. On passe à la ligne avant ces deux
# instructions, sans rien changer d'autre (couleur, taille, position, opacité, animation).
rep("  const globeHalo = elixSprite(PERKS[id].color, 0.9, 0.8);   // teinte foncée : violette même sur un mur clair globeHalo.position.set(0, 2.02, zc); root.add(globeHalo);\n",
    "  const globeHalo = elixSprite(PERKS[id].color, 0.9, 0.8);   // teinte foncée : violette même sur un mur clair\n"
    "  globeHalo.position.set(0, 2.02, zc); root.add(globeHalo);\n")

# Numéro : jeu 2.0.5, construction 1 ; interface des Mod Tools inchangée (9).
rep("const GAME_VERSION = '2.0.4';", "const GAME_VERSION = '2.0.5';")
rep("const GAME_BUILD = 2;", "const GAME_BUILD = 1;")
