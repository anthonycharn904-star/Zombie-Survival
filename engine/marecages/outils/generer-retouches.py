#!/usr/bin/env python3
"""Marécages Maudits : prépare les retouches du kit 2.0.7 « Stryges » pour l'atelier (1er novembre 2026).

Lit sources/tools/patches.py de la copie de référence du kit (par l'arbre syntaxique, sans l'exécuter) et écrit :
  - retouches/kit.py      : seulement s'il n'existe pas (ensuite, c'est lui qu'on adapte, à la main ; ses contrôles
                            sont recalculés à partir de lui) ; le texte du kit, moins la retouche du numéro (GAME_VERSION, décision d'Anthony du
                            1er novembre : les numéros sont l'affaire de Claude 5), avec les mentions de versions
                            de travail réétiquetées (voir reetiqueter) ;
  - retouches/controle.py : pour chaque retouche, ce que l'étape vérifie à la construction : le lieu (jeu 1.9.0,
                            fichier d'accroche, module), la déclaration qui doit l'englober, la session qui
                            travaille sur ce code, et l'empreinte des modules visés au moment de la validation.
Avec --brut DOSSIER : écrit seulement DOSSIER/kit.py, sans réétiquetage (reconstruction fidèle au kit).

Usage : generer-retouches.py KIT [--brut DOSSIER]   (KIT : le dossier « kit-2.0.7-stryges » de la copie privée)"""
import ast, glob, hashlib, os, re, subprocess, sys, tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
MA = os.path.dirname(ICI)                                  # engine/marecages
ENG = os.path.dirname(MA)                                  # engine
REPO = os.path.dirname(ENG)
args = sys.argv[1:]
KIT = args[0]
BRUT = args[args.index('--brut') + 1] if '--brut' in args else None
PATCHES_PY = os.path.join(KIT, 'sources', 'tools', 'patches.py')

def lire(p):
    return open(p, encoding='utf-8').read()

sys.dont_write_bytecode = True                         # pas de __pycache__ dans le dépôt
sys.path.insert(0, ICI)
from etiquettes import reetiqueter                       # « jeu 2.1.x » → « kit MM 2.1.x », « jeu 2.0.7 » → « kit 2.0.7 »

# ---------------------------------------------------------------- le texte du kit, sans l'exécuter --
src = lire(PATCHES_PY)
sha_kit = hashlib.sha256(src.encode('utf-8')).hexdigest()
tree = ast.parse(src)
listes = {'PATCHES': [], 'HTML_PATCHES': []}
noeuds = []                                                # (liste, noeud du tuple)
for node in tree.body:
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        nom = node.targets[0].id
    elif isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name):
        nom = node.target.id
    else:
        sys.exit(f'patches.py : instruction inattendue ligne {node.lineno}')
    if nom not in listes or not isinstance(node.value, ast.List):
        sys.exit(f'patches.py : liste inattendue ligne {node.lineno}')
    for e in node.value.elts:
        t = ast.literal_eval(e)
        if not (isinstance(t, tuple) and len(t) == 3 and all(isinstance(x, str) for x in t)):
            sys.exit(f'patches.py : retouche mal formée ligne {e.lineno}')
        listes[nom].append(t)
        noeuds.append((nom, e))
PATCHES, HTML_PATCHES = listes['PATCHES'], listes['HTML_PATCHES']
noms = [t[0] for t in PATCHES + HTML_PATCHES]
if len(noms) != 105 or len(set(noms)) != 105:
    sys.exit(f'patches.py : 105 retouches de noms distincts attendues, {len(noms)} trouvées ({len(set(noms))} noms)')

# le texte transformé : la retouche du numéro retirée (ses lignes, de la parenthèse ouvrante à la virgule)
lignes = src.split('\n')
gv = [e for n, e in noeuds if ast.literal_eval(e)[0] == 'GAME_VERSION']
if len(gv) != 1:
    sys.exit('patches.py : la retouche GAME_VERSION est introuvable')
e = gv[0]
if lignes[e.end_lineno - 1].rstrip() != lignes[e.end_lineno - 1].rstrip().rstrip(',') + ',':
    sys.exit('patches.py : la retouche GAME_VERSION ne finit pas par une virgule')
retiree = lignes[e.lineno - 1:e.end_lineno]
lignes[e.lineno - 1:e.end_lineno] = []
texte = '\n'.join(lignes)
entete = ('# Marécages Maudits : retouches du moteur, reprises du kit « Zombie Survival 2.0.7 - a publier (Stryges) »\n'
          f'# (sources/tools/patches.py, SHA-256 {sha_kit}), par engine/marecages/outils/generer-retouches.py.\n'
          '# Écarts avec le kit : la retouche GAME_VERSION est retirée (les numéros sont gérés par Claude 5, décision\n'
          "# d'Anthony du 1er novembre 2026) ; " + ('rien d\'autre (copie brute).\n' if BRUT else
          '« jeu 2.1.x » devient « kit MM 2.1.x » et « jeu 2.0.7 » devient « kit 2.0.7 »\n'
          '# (versions de travail, jamais publiées : voir engine/marecages/LISEZ-MOI.md). Lu par l\'étape sans être exécuté.\n'))
sortie = entete + (texte if BRUT else reetiqueter(texte))
if BRUT:
    os.makedirs(BRUT, exist_ok=True)
    open(os.path.join(BRUT, 'kit.py'), 'w', encoding='utf-8').write(sortie)
    print(f'{BRUT}/kit.py : {len(noms) - 1} retouches, sans réétiquetage')
    sys.exit(0)

# vérification : le texte écrit redonne les retouches du kit (moins GAME_VERSION), réétiquetées
t2 = ast.parse(sortie)
relu = []
for node in t2.body:
    for el in node.value.elts:
        relu.append(ast.literal_eval(el))
attendu = [(n, reetiqueter(o), reetiqueter(nw)) for n, o, nw in PATCHES + HTML_PATCHES if n != 'GAME_VERSION']
# les motifs ne contiennent aucune mention de version de travail, sauf ceux des retouches enchaînées (le texte
# posé par une retouche précédente) : réétiquetés de la même façon, ils restent cohérents
if sorted(relu) != sorted(attendu):
    sys.exit('retouches/kit.py : relecture différente des retouches du kit')

# les retouches que l'étape appliquera : celles de retouches/kit.py s'il existe déjà (adapté), sinon celles du kit
KITPY = os.path.join(MA, 'retouches', 'kit.py')
if os.path.exists(KITPY):
    t3 = ast.parse(lire(KITPY))
    L3 = {'PATCHES': [], 'HTML_PATCHES': []}
    for node in t3.body:
        L3[(node.targets[0] if isinstance(node, ast.Assign) else node.target).id] += list(ast.literal_eval(node.value))
    if [t[0] for t in L3['PATCHES'] + L3['HTML_PATCHES']] != [t[0] for t in attendu]:
        sys.exit('retouches/kit.py : ses retouches ne sont plus celles du kit (noms ou ordre) : à revoir à la main')
    PATCHES, HTML_PATCHES = L3['PATCHES'], L3['HTML_PATCHES']
    garde_kitpy = True
else:
    PATCHES = [t for t in PATCHES if t[0] != 'GAME_VERSION']
    garde_kitpy = False

# les retouches écrites pour l'intégration (retouches/confort.py, décision d'Anthony du 2 novembre 2026), après celles du kit
CONFORT = []
CPY = os.path.join(MA, 'retouches', 'confort.py')
if os.path.exists(CPY):
    for node in ast.parse(lire(CPY)).body:
        CONFORT += list(ast.literal_eval(node.value))
if len({t[0] for t in CONFORT} | set(noms)) != len(CONFORT) + len(set(noms)):
    sys.exit('retouches/confort.py : un nom de retouche est déjà pris')

# ---------------------------------------------------------------- le jeu officiel, pour situer chaque retouche --
tmp = tempfile.mkdtemp(prefix='ma-gen-')
officiel = os.path.join(tmp, 'officiel.html')
subprocess.run([sys.executable, '-I', os.path.join(ENG, 'tools', 'build.py'), '--out', officiel], check=True, capture_output=True,
               env=dict(os.environ, ZS_SANS_MARECAGES='1'))            # le jeu officiel, sans la carte
s = lire(officiel)
k = s.find("const GAME_VERSION = '")
i = s.rfind('<script>', 0, k) + len('<script>')
j = s.find('</script>', k)
js, head = s[i:j], s[:i - len('<script>')]

# où commence chaque module dans le script principal (build.py : texte du module, sans les retours finaux)
mods = {}
for p in sorted(glob.glob(os.path.join(ENG, 'src', '*.js'))):
    t = lire(p).rstrip('\n')
    a = js.find(t)
    if a < 0 or js.find(t, a + 1) >= 0:
        sys.exit(f'module introuvable ou en double dans le jeu construit : {os.path.basename(p)}')
    mods['src/' + os.path.basename(p)] = (a, a + len(t), hashlib.sha256(open(p, 'rb').read()).hexdigest())

# le jeu 1.9.0 et les fichiers d'accroche, un par un (comme build.py), pour dater un motif du jeu de base
raw190 = subprocess.run(['git', '-C', REPO, 'show', '69fe3cc:game/zombie-survival.html'], capture_output=True, check=True).stdout.decode('utf-8')
env = {'s': raw190}
def _rep(old, new, count=1):
    if env['s'].count(old) != count:
        sys.exit(f'accroche introuvable en rejouant les fichiers d\'accroche : {old[:80]!r}')
    env['s'] = env['s'].replace(old, new)
env.update({'rep': _rep, 'ins_after': lambda a, t: _rep(a, a + t), 'ins_before': lambda a, t: _rep(a, t + a)})
HOOKS = re.findall(r"exec\(open\(os\.path\.join\(HERE, '([^']+)'\)", lire(os.path.join(ENG, 'tools', 'build.py')))
date = {}
for n, o, nw in PATCHES + HTML_PATCHES + CONFORT:
    if raw190.count(o):
        date[n] = 'jeu 1.9.0'
for h in HOOKS:
    exec(lire(os.path.join(ENG, 'tools', h)), env)
    for n, o, nw in PATCHES + HTML_PATCHES + CONFORT:
        if n not in date and env['s'].count(o):
            date[n] = h

# la déclaration de premier niveau qui englobe une position (les fonctions du jeu sont en début de ligne)
DECL = re.compile(r'(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+(?!(?:float|int|bool|vec[234]|mat[234])\b)([A-Za-z_$][\w$]*)')
def englobant(txt, p):
    ls = txt.rfind('\n', 0, p) + 1
    while ls > 0:
        m = DECL.match(txt, ls)
        if m:
            return m.group(1) or m.group(2)
        ls = txt.rfind('\n', 0, ls - 1) + 1
    return '(début du script)'

# noms déclarés au premier niveau (const/let/var/function/class en début de ligne, comme engine/tools/dupcheck.py)
def declares(code):
    out = set()
    for line in code.split('\n'):
        m = re.match(r'(const|let|var)\s+(.*)', line)
        if m:
            depth, cur, parts = 0, '', []
            for ch in m.group(2):
                if ch in '([{': depth += 1
                elif ch in ')]}': depth -= 1
                if ch == ',' and depth == 0: parts.append(cur); cur = ''
                else: cur += ch
                if ch == ';' and depth == 0: break
            parts.append(cur)
            for q in parts:
                n = re.match(r'\s*([A-Za-z_$][\w$]*)\s*(=|;|$)', q)
                if n: out.add(n.group(1))
            continue
        m = re.match(r'(?:async\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)', line)
        if m: out.add(m.group(2))
    return out
# identifiants utilisés, hors commentaires et chaînes (approximatif : un nom de propriété « .x » est ignoré)
def utilises(code):
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.S)
    code = re.sub(r'//[^\n]*', ' ', code)
    code = re.sub(r"'(?:\\.|[^'\\\n])*'|\"(?:\\.|[^\"\\\n])*\"", "''", code)
    code = re.sub(r'(?<=[{,])(\s*)[A-Za-z_$][\w$]*(\s*):(?!:)', r'\1\2:', code)      # clés d'objets littéraux
    locaux = set(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)', code))      # déclarés dans le marais, même dans une fonction
    return set(re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)', code)) - locaux

# la session qui travaille sur ce code (pour les messages d'erreur ; indicatif)
ZOMBIES = {'damageZombie', 'killZombie', 'onZombieKilled', 'updateZombie', 'rayHitZombie', 'startCrawl', 'zPartVisible', 'gibArm',
           'zLegHit', 'dogRoundStart', 'updateDogSpawns', 'endRound', 'startRound', 'newGame', 'aliveCount', 'chase', 'setModelAnim',
           'MAT_Z', 'specimenFiche', 'SPECIMEN', 'Zombies'}
def session(lieu, dans):
    if lieu == 'src/H1-personnage.js':
        return 'Animations (Claude 1)'
    if lieu.startswith('src/'):
        return 'Khamsin et cartes ouvertes (Claude 2)'
    if dans in ZOMBIES or dans.startswith('dog') or 'Zombie' in dans:
        return 'zombies et manches (Bunker 7, Claude 3, accroche aussi ce code)'
    if dans == 'boot':
        return 'interface des Mod Tools, window.ZS (Claude 2 et Claude 5)'
    if dans in ('HUD', 'refreshMenu', 'showScreen', 'openMapSelect', 'selectSpecimen', 'SPECIMEN_FACTS') or lieu == 'html':
        return 'Interface (Claude 4)'
    if dans in ('BUILTIN_MAPS', 'loadMapCatalog', 'GAME_VERSION'):
        return 'Intégration (Claude 5)'
    return 'moteur commun (Claude 5 ; Animations pour les armes et le joueur)'

controle, applis = {}, list(PATCHES)
cur = js
for idx, (n, o, nw) in enumerate(PATCHES):
    if n == 'GAME_VERSION':
        continue
    c = cur.count(o)
    if c != 1:
        sys.exit(f'retouche « {n} » : {c} occurrences dans le jeu officiel au lieu de 1')
    p, pj = cur.find(o), js.find(o)
    if pj >= 0:
        # dans un module (position dans le script officiel, avant toute retouche), sinon dans le jeu de base
        lieu = next((f for f, (a, b, h) in mods.items() if a <= pj < b), None) or date.get(n, '??')
        controle[n] = {'lieu': lieu, 'dans': englobant(cur, p)}
    else:
        # enchaînée : son motif vient d'une retouche précédente (celle qui a posé sa plus longue ligne nouvelle)
        lig = max((l for l in o.split('\n') if l.strip() and l not in js), key=len, default=o)
        par = next((PATCHES[q][0] for q in range(idx - 1, -1, -1) if lig in PATCHES[q][2]), None)
        if par is None:
            sys.exit(f'retouche « {n} » : motif absent du jeu officiel et d\'aucune retouche précédente')
        controle[n] = {'lieu': controle[par]['lieu'], 'parente': par, 'dans': englobant(cur, p)}
    cur = cur.replace(o, nw)
for n, o, nw in CONFORT:
    if cur.count(o) != 1:
        sys.exit(f'retouche de confort « {n} » : {cur.count(o)} occurrences au lieu de 1')
    p, pj = cur.find(o), js.find(o)
    lieu = next((f for f, (a, b, h) in mods.items() if a <= pj < b), None) if pj >= 0 else None
    controle[n] = {'lieu': lieu or date.get(n, '??'), 'dans': englobant(cur, p)}
    cur = cur.replace(o, nw)
for n, o, nw in HTML_PATCHES:
    if head.count(o) != 1:
        sys.exit(f'retouche HTML « {n} » : {head.count(o)} occurrences dans l\'en-tête au lieu de 1')
    controle[n] = {'lieu': 'html (' + date.get(n, '?') + ')', 'dans': 'html'}
    head = head.replace(o, nw)
for n, c in controle.items():
    c['session'] = session('html' if c['dans'] == 'html' else c['lieu'], c['dans'])
modules_vises = sorted({c['lieu'] for c in controle.values() if c['lieu'].startswith('src/')})
moteur = set()
for b in re.finditer(r'<script>(.*?)</script>', s, re.S):
    moteur |= declares(b.group(1))
decl_mod = {}
for p in sorted(glob.glob(os.path.join(ENG, 'src', '*.js'))):
    for n in declares(lire(p)):
        decl_mod.setdefault(n, 'src/' + os.path.basename(p))
sources = {os.path.basename(p): lire(p) for p in sorted(glob.glob(os.path.join(MA, 'src', 'ma*.js'))) + sorted(glob.glob(os.path.join(MA, 'orig', '*.js')))}
propres = set()
for c in sources.values():
    propres |= declares(c)
deps = {}
for f, c in sources.items():
    for n in sorted((utilises(c) & moteur) - propres):
        deps.setdefault(n, []).append(f)

out = ['# Marécages Maudits : contrôles des retouches (engine/marecages/outils/generer-retouches.py, à refaire après',
       '# chaque revalidation). Pour chaque retouche du kit : lieu (jeu 1.9.0, fichier d\'accroche ou module), déclaration',
       '# de premier niveau qui doit englober son motif au moment où elle s\'applique, session qui travaille sur ce code.',
       '# Données seulement : lues par l\'étape sans être exécutées.',
       '{',
       f" 'valide_le': '2026-11-01', 'jeu_valide': {{'version': ['2.0.6', '2.0.7'], 'editor_api': [9, 10]}},",
       f" 'kit_patches_sha256': {sha_kit!r},",
       " 'modules': {"]
for f in modules_vises:
    out.append(f'  {f!r}: {mods[f][2]!r},')
out.append(' },')
out.append(" 'dependances': {                  # nom du moteur : (où il est déclaré à la validation, fichiers du marais qui l'utilisent)")
for n in sorted(deps):
    out.append(f'  {n!r}: ({decl_mod.get(n, "jeu de base")!r}, {deps[n]!r}),')
out.append(' },')
out.append(" 'retouches': {")
for n, o, nw in PATCHES + HTML_PATCHES + CONFORT:
    if n in controle:
        out.append(f'  {n!r}: {controle[n]!r},')
out.append(' },')
out.append('}')
os.makedirs(os.path.join(MA, 'retouches'), exist_ok=True)
if not garde_kitpy:
    open(KITPY, 'w', encoding='utf-8').write(sortie)
elif reetiqueter(texte) != lire(KITPY).split('\n', 5)[5]:
    print('retouches/kit.py : adapté à la main, gardé tel quel (écarts avec le kit : outils/comparer.py)')
open(os.path.join(MA, 'retouches', 'controle.py'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
ast.literal_eval('\n'.join(l for l in out if not l.startswith('#')))
from collections import Counter
cl = Counter(c['lieu'] for c in controle.values())
print(f'retouches/kit.py : {len(attendu)} retouches ({len(PATCHES)} du script, {len(HTML_PATCHES)} du HTML) ; retirée : GAME_VERSION')
print('retouches/controle.py : lieux', dict(cl.most_common()))
print('modules visés :', ', '.join(modules_vises))
print('retouches de confort :', len(CONFORT), '(' + ' ; '.join(n + ' → ' + controle[n]['lieu'] + ', ' + controle[n]['dans'] for n, o, nw in CONFORT) + ')')
print(f'dépendances : {len(deps)} noms du moteur utilisés par les sources du marais')
