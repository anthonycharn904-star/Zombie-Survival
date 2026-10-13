#!/usr/bin/env python3
"""Atelier du moteur (depuis le jeu 2.0.0) : construit game/zombie-survival.html à partir du jeu 1.9.0 (commit 69fe3cc)
+ les points d'accroche du monde ouvert (HOOKS) + le module src/*.js (section 12 MONDE OUVERT),
inséré avant le catalogue des cartes. Chaque remplacement doit trouver son texte exactement une fois.
Usage : build.py [--base FICHIER] [--out FICHIER]"""
import glob, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KH = os.path.dirname(HERE)
REPO = os.path.dirname(KH)                     # racine du dépôt (engine/ est dedans)
GAME = os.path.join(REPO, 'game/zombie-survival.html')

args = sys.argv[1:]
base_path = args[args.index('--base') + 1] if '--base' in args else None
out_path = args[args.index('--out') + 1] if '--out' in args else GAME
if base_path:
    s = open(base_path, encoding='utf-8').read()
else:
    # base : le jeu 1.9.0 (commit 69fe3cc), avant le monde ouvert ; tout le 2.0.0 passe par hooks.py et src/
    s = subprocess.run(['git', '-C', REPO, 'show', '69fe3cc:game/zombie-survival.html'], capture_output=True, check=True).stdout.decode('utf-8')

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'ACCROCHE INTROUVABLE ({n} au lieu de {count}) :\n{old[:300]}')
    s = s.replace(old, new)

def ins_after(anchor, text):
    rep(anchor, anchor + text)

def ins_before(anchor, text):
    rep(anchor, text + anchor)

exec(open(os.path.join(HERE, 'hooks.py'), encoding='utf-8').read())
# jeu 2.0.3 : tailles réglables (objets, textures, bâtiments, éléments)
exec(open(os.path.join(HERE, 'hooks-tailles.py'), encoding='utf-8').read())
# jeu 2.0.3 : décor des lieux retouchable (pièces sélectionnables dans les Mod Tools)
exec(open(os.path.join(HERE, 'hooks-decor.py'), encoding='utf-8').read())
# jeu 2.0.3 : intérieur des pyramides de Khamsin (herses payantes, boîte, interface 8)
exec(open(os.path.join(HERE, 'hooks-pyramides.py'), encoding='utf-8').read())
# jeu 2.0.4 : grandes bibliothèques de textures et de modèles (interface 9, textures lumineuses)
exec(open(os.path.join(HERE, 'hooks-libs.py'), encoding='utf-8').read())
# jeu 2.0.4 refait : le khépesh, arme de corps-à-corps du désert de Khamsin (construction 1)
exec(open(os.path.join(HERE, 'hooks-khepesh.py'), encoding='utf-8').read())

# --- le module
parts = sorted(glob.glob(os.path.join(KH, 'src', '*.js')))
module = ''.join(open(p, encoding='utf-8').read().rstrip('\n') + '\n\n' for p in parts)
module += '/* ====================================================== fin du monde ouvert == */\n\n'
ins_before('/* ------------------------------------------------- Catalogue des cartes -- */', module)

open(out_path, 'w', encoding='utf-8').write(s)
print(f'{out_path} : {len(s.encode("utf-8"))} octets, {s.count(chr(10))} lignes, module {len(parts)} fichiers')
