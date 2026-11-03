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
# jeu 2.0.5 : halo du globe de Vif-Argent rétabli, numéro 2.0.5 (construction 1)
exec(open(os.path.join(HERE, 'hooks-elixirs.py'), encoding='utf-8').read())
# jeu 2.0.6 : prise des armes (pouce, prises déclarées, solveur anatomique, détente, poignets)
exec(open(os.path.join(HERE, 'hooks-prehension.py'), encoding='utf-8').read())
# jeu 2.0.6 : Anthony, le personnage jouable (ses bras sur la préhension, son corps en vue FPS)
exec(open(os.path.join(HERE, 'hooks-personnage.py'), encoding='utf-8').read())
# jeu 2.0.6 : rechargements et boisson d'atout retravaillés (gestes)
exec(open(os.path.join(HERE, 'hooks-gestes.py'), encoding='utf-8').read())
# jeu 2.0.6 : glissade, annulation de glissade et sprint tactique (paquet mouvement-cod)
exec(open(os.path.join(HERE, 'hooks-glissade.py'), encoding='utf-8').read())
# jeu 2.0.6 : HUD « portrait + points » (paquet hud-points)
exec(open(os.path.join(HERE, 'hooks-points.py'), encoding='utf-8').read())
# refonte de l'interface du jeu (chantier interface) : menu vertical, sélection des cartes en trois zones
exec(open(os.path.join(HERE, 'hooks-interface.py'), encoding='utf-8').read())

# --- le module
parts = sorted(glob.glob(os.path.join(KH, 'src', '*.js')))
module = ''.join(open(p, encoding='utf-8').read().rstrip('\n') + '\n\n' for p in parts)
module += '/* ====================================================== fin du monde ouvert == */\n\n'
ins_before('/* ------------------------------------------------- Catalogue des cartes -- */', module)

# jeu 2.0.6 : la jeep d'archéologie (fichiers fournis par Anthony, orig/jeep/) insérée telle quelle, chaque
# fichier dans son propre <script>, avant le script du jeu (règles 1 à 3 de son INTEGRATION.md : ni retouche,
# ni découpe, ni recopie à la main ; empreintes contrôlées). Branchement : src/70-vehicles.js.
import hashlib
JEEP = [('jeep-archeo.js', '89308fd43594673847e6e2831ca02e95df20102e6668c965b68ae412ef72971d'),
        ('jeep-audio.js', '28cdb2b71b3fb568565b5d459fcfdfd875fcac95a2587dfa7ed9163a65a87c89')]
jeep = ''
for name, sha in JEEP:
    raw = open(os.path.join(KH, 'orig', 'jeep', name), 'rb').read()
    if hashlib.sha256(raw).hexdigest() != sha:
        sys.exit(f'fichier de la jeep inattendu (empreinte) : orig/jeep/{name}')
    txt = raw.decode('utf-8')
    if '</script' in txt.lower():
        sys.exit(f'orig/jeep/{name} contient une balise de fin de script')
    jeep += f'<script>/* jeu 2.0.6 : engine/orig/jeep/{name}, inséré tel quel par engine/tools/build.py */\n{txt}</script>\n'
ins_before('<script>/* GLTFLoader de three.js r128', jeep)

# jeu 2.0.6 : Anthony, le personnage jouable (fichiers fournis par Anthony, orig/survivant/), inséré tel quel
# de la même façon : données de la tête, données des matières, puis le code (son INTEGRATION.md : ne pas
# réécrire survivant.js, ne pas retoucher les données à la main ; les données avant le code).
# Branchement : src/H1-personnage.js.
SURVIVANT = [('survivant-tete.js', 'a54e1725626932bc8ca78ecb132602277ce168695d5c475c77137eec984d9812'),
             ('survivant-matieres.js', 'a86a58f62f7b1f29a4578f72895f2e66b7f7ef5435b6e3a02484773957626204'),
             ('survivant.js', 'e3f272eb1b15f588eecf684e42763aed162d6dea7dd51a2f272de03938bd4251')]   # glissade (19 octobre 2026)
perso = ''
for name, sha in SURVIVANT:
    raw = open(os.path.join(KH, 'orig', 'survivant', name), 'rb').read()
    if hashlib.sha256(raw).hexdigest() != sha:
        sys.exit(f'fichier du personnage inattendu (empreinte) : orig/survivant/{name}')
    txt = raw.decode('utf-8')
    if '</script' in txt.lower():
        sys.exit(f'orig/survivant/{name} contient une balise de fin de script')
    perso += f'<script>/* jeu 2.0.6 : engine/orig/survivant/{name}, inséré tel quel par engine/tools/build.py */\n{txt}</script>\n'
ins_before('<script>/* GLTFLoader de three.js r128', perso)

# jeu 2.0.6 : course, sprint tactique, glissade et annulation (paquet mouvement-cod d'Anthony, orig/mouvement/),
# inséré tel quel de la même façon, après le personnage : le contrôleur, puis ses effets (poussière, sons).
# Son INTEGRATION.md : copier les fichiers, régler le contrôleur par ses options. Branchement : src/H4-glissade.js.
MOUVEMENT = [('mouvement-cod.js', '5b87f6a66d4397c9d46a502cc14505469a846d81b0d203f164a3e71731936ecf'),
             ('mouvement-effets.js', '0e960daf9fb93c63180bbbc7c5d61787f72420c4ed1e146ca1f44900d07de819')]
mvt = ''
for name, sha in MOUVEMENT:
    raw = open(os.path.join(KH, 'orig', 'mouvement', name), 'rb').read()
    if hashlib.sha256(raw).hexdigest() != sha:
        sys.exit(f'fichier du mouvement inattendu (empreinte) : orig/mouvement/{name}')
    txt = raw.decode('utf-8')
    if '</script' in txt.lower():
        sys.exit(f'orig/mouvement/{name} contient une balise de fin de script')
    mvt += f'<script>/* jeu 2.0.6 : engine/orig/mouvement/{name}, inséré tel quel par engine/tools/build.py */\n{txt}</script>\n'
ins_before('<script>/* GLTFLoader de three.js r128', mvt)

# jeu 2.0.6 : HUD « portrait + points » (paquet hud-points d'Anthony, orig/hud-points/), inséré tel quel de la même
# façon, avec la licence de sa police (Teko, SIL OFL 1.1 : elle doit accompagner le fichier ; le jeu étant un seul
# fichier HTML, elle y est recopiée en commentaire, juste avant le script). Branchement : src/H5-points.js.
HUDPTS = [('hud-points.js', 'ba202a76382d6ded63a8b639802e5e57b6bc03930d2bf7f1ffb30450bafaf08c'),
          ('LICENCE-Teko-OFL.txt', '87373a80b1915a60ddb8386983b57c403c210c3bfa29742eeccf88f9cd27b5ea')]
hp = {}
for name, sha in HUDPTS:
    raw = open(os.path.join(KH, 'orig', 'hud-points', name), 'rb').read()
    if hashlib.sha256(raw).hexdigest() != sha:
        sys.exit(f'fichier du HUD des points inattendu (empreinte) : orig/hud-points/{name}')
    hp[name] = raw.decode('utf-8')
if '</script' in hp['hud-points.js'].lower() or '-->' in hp['LICENCE-Teko-OFL.txt']:
    sys.exit('orig/hud-points : balise de fin de script dans le module, ou fin de commentaire dans la licence')
ins_before('<script>/* GLTFLoader de three.js r128',
           '<!-- jeu 2.0.6 : police Teko du HUD des points (intégrée à hud-points.js), engine/orig/hud-points/LICENCE-Teko-OFL.txt :\n'
           + hp['LICENCE-Teko-OFL.txt'] + '-->\n'
           + '<script>/* jeu 2.0.6 : engine/orig/hud-points/hud-points.js, inséré tel quel par engine/tools/build.py */\n'
           + hp['hud-points.js'] + '</script>\n')

open(out_path, 'w', encoding='utf-8').write(s)
print(f'{out_path} : {len(s.encode("utf-8"))} octets, {s.count(chr(10))} lignes, module {len(parts)} fichiers')
