# Points d'accroche du jeu 2.0.7 : voix enregistrées de l'annonceur des bonus. Exécuté par build.py après hooks-points.py.
# Demande d'Anthony du 2 novembre 2026 (paquet annonceur-voix-B : engine/orig/annonceur-voix-B/voix/, inséré tel quel).
# Le branchement est dans le module src/S0-annonceur.js ; les règles, le bandeau et les effets des bonus ne changent pas.

# ramassage d'un bonus : la voix enregistrée (sinon la synthèse vocale d'avant), même réglage, une annonce coupe l'autre
rep("""  Sound.say(POWERUPS[type].say);
""", """  annonceBonus(type);                        // jeu 2.0.7 : voix enregistrées de l'annonceur (section 27)
""")
# apparition d'un bonus : les voix se décodent avant son ramassage (une fois par contexte audio)
rep("""  Sound.powerupSpawn({ x, y: gy, z });
""", """  Sound.powerupSpawn({ x, y: gy, z });
  annoncePrepare();                          // jeu 2.0.7 : voix enregistrées de l'annonceur (section 27)
""")
# le bonus « Double points » s'appelle « Points doubles », comme sa voix : bandeau, bonus actifs, synthèse de repli
# (décision d'Anthony du 2 novembre 2026)
rep("""  double: { name: 'Double points', say: 'Double points !', duration: 30 },
""", """  double: { name: 'Points doubles', say: 'Points doubles !', duration: 30 },
""")
rep("""    if (G.timers.double > 0) pu.push(['double', 'Double points', G.timers.double]);
""", """    if (G.timers.double > 0) pu.push(['double', 'Points doubles', G.timers.double]);
""")
# courant rétabli : plus d'annonce vocale, sa musique à la place ; le bandeau, le bruit du levier et les jingles des
# atouts restent (demandes d'Anthony du 4 novembre 2026 : « tu laisses l'animation mais plus d'annonceur », puis la
# musique « qui se jouera à chaque fois quand le ou les joueurs activeront le courant », pour toutes les cartes)
rep("""  Sound.say('Courant rétabli');
}""", """  mancheCourant();                             // jeu 2.0.7 : musique du courant rétabli, plus d'annonce vocale (section 28)
}""")
