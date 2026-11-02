#!/usr/bin/env python3
"""Marécages Maudits : essaie l'étape (etape.py) sur le jeu construit par un autre chantier, sans rien écrire chez lui.
KH est le dossier engine de ce chantier (pour signaler ses modules modifiés), les sources du marais sont les nôtres.
Usage : sur-autres.py JEU.html DOSSIER_ENGINE [SORTIE.html]"""
import os, sys
ICI = os.path.dirname(os.path.abspath(__file__))
MA = os.path.dirname(ICI)
jeu, kh = sys.argv[1], os.path.abspath(sys.argv[2])
ns = {'__name__': '__marecages__', 's': open(jeu, encoding='utf-8').read(), 'KH': kh, 'os': os, 'sys': sys, 'MA_RACINE': MA}
try:
    exec(compile(open(os.path.join(MA, 'etape.py'), encoding='utf-8').read(), 'etape.py', 'exec'), ns)
except SystemExit as e:
    print(e); sys.exit(1)
if len(sys.argv) > 3:
    open(sys.argv[3], 'w', encoding='utf-8').write(ns['s'])
print('étape réussie')
