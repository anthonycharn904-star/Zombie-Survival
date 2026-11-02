#!/usr/bin/env python3
"""Marécages Maudits : première reprise des sources du kit 2.0.7 « Stryges » (1er novembre 2026).

  - orig/ : mere-vase.js, mere-vase-audio.js, barque.js, copiés octet pour octet (insérés tels quels par l'étape,
    empreintes contrôlées, comme la jeep d'Anthony) ;
  - src/  : les 19 fichiers ma01…ma19, avec les mentions de versions de travail réétiquetées (« jeu 2.1.x » devient
    « kit MM 2.1.x », « jeu 2.0.7 » devient « kit 2.0.7 », « (2.1.3) » devient « (MM 2.1.3) » ; voir etiquettes.py). Les adaptations viennent
    ensuite, à la main, dans src/ (rapport : outils/comparer.py).
Ne remplace jamais un fichier existant différent (les adaptations seraient perdues) ; vérifie que chaque mention réétiquetée
est dans un commentaire.

Usage : reprendre-sources.py KIT   (KIT : le dossier « kit-2.0.7-stryges » de la copie privée)"""
import glob, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MA = os.path.dirname(ICI)
KIT = sys.argv[1]
SRC = os.path.join(KIT, 'sources', 'src')
sys.dont_write_bytecode = True                         # pas de __pycache__ dans le dépôt
sys.path.insert(0, ICI)
from etiquettes import MENTIONS, commentaires, reetiqueter

def ecrire(d, data):
    """Écrit d, sauf s'il existe : identique, rien à faire ; différent, refus (une adaptation serait perdue)."""
    if os.path.exists(d):
        if open(d, 'rb').read() != data:
            sys.exit(f'{os.path.relpath(d, MA)} existe déjà avec un autre contenu : rien n\'est remplacé')
        return False
    open(d, 'wb').write(data)
    return True

os.makedirs(os.path.join(MA, 'orig'), exist_ok=True)
os.makedirs(os.path.join(MA, 'src'), exist_ok=True)
for f in ['mere-vase.js', 'mere-vase-audio.js', 'barque.js']:
    ecrire(os.path.join(MA, 'orig', f), open(os.path.join(SRC, f), 'rb').read())
total = 0
for p in sorted(glob.glob(os.path.join(SRC, 'ma', 'ma*.js'))):
    f = os.path.basename(p)
    d = os.path.join(MA, 'src', f)
    code = open(p, encoding='utf-8').read()
    com = commentaires(code)
    hors = [m.start() for m in MENTIONS.finditer(code) if not any(a <= m.start() < b for a, b in com)]
    if hors:
        sys.exit(f'{f} : mention de version hors d\'un commentaire (position {hors[0]}) : à traiter à la main')
    n = len(MENTIONS.findall(code))
    ecrire(d, reetiqueter(code).encode('utf-8'))
    total += n
    print(f'src/{f} : {n} mentions réétiquetées')
print(f'{total} mentions réétiquetées dans 19 fichiers ; orig/ : 3 fichiers copiés tels quels')
