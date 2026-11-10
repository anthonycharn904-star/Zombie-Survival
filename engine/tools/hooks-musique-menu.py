# Points d'accroche du jeu 2.0.7 : musique du menu. Exécuté par build.py après hooks-sauvegarde.py.
# Demande d'Anthony du 3 novembre 2026 (paquet musique-menu-zombie-survival : engine/orig/musique-menu-zombie-survival/,
# inséré tel quel). Le branchement est dans le module src/S3-musique-menu.js.

# au menu (démarrage, retour d'une partie) : la musique, sans la relancer si elle joue déjà
ins_after("""  sauveMenu();                                 // jeu 2.0.7 : « Continuer la partie » (section 29)
""", """  menuMusique();                               // jeu 2.0.7 : musique du menu (section 30)
""")
# début d'une partie : fondu de sortie
ins_after("""function startGame(save) {
  Sound.init();
""", """  menuMusiqueArret();                          // jeu 2.0.7 : musique du menu (section 30)
""")
