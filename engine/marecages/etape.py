# Marécages Maudits : étape de construction (chantier/marecages, 1er novembre 2026).
#
# Prend le jeu que vient de construire engine/tools/build.py (le texte « s ») et y ajoute la carte des Marécages
# Maudits, comme le faisait le kit « Zombie Survival 2.0.7 - a publier (Stryges) » (tools/build_swamp.py) sur le jeu
# 2.0.6 publié :
#   1. les retouches du script (retouches/kit.py), une par une, chacune contrôlée (voir plus bas) ;
#   2. les sources du marais (src/ma*.js), avant la fin du monde ouvert ;
#   3. les trois modules autonomes (orig/ : la Mère-Vase, son audio, la barque), insérés tels quels, empreintes
#      contrôlées, chacun dans son <script>, avant le script du jeu ;
#   4. les retouches de l'en-tête HTML (retouches/kit.py, HTML_PATCHES).
# Contrôles (décision d'Anthony du 1er novembre : une accroche qui ne tient plus doit arrêter la construction avec un
# message clair, jamais être ignorée) : version et interface du jeu validées ; noms du moteur dont le marais dépend
# toujours déclarés ; chaque motif trouvé exactement une fois, dans la déclaration où il a été validé ; modules
# modifiés depuis la validation signalés ; aucun nom déclaré deux fois ; pas de console.error remplacé.
#
# Exécutée par build.py (une ligne, à la fin, à proposer à Claude 5) ou par engine/marecages/construire.py, qui
# construit sans toucher build.py. Variables attendues : s (le jeu), KH (le dossier engine). Facultative : MA_RACINE
# (le dossier des sources du marais ; par défaut engine/marecages).

def _marecages(s, racine, fidele=False):
    import ast, glob, hashlib, os, re, sys

    def stop(msg):
        sys.exit('MARÉCAGES MAUDITS : ' + msg + '\n  (engine/marecages/LISEZ-MOI.md, « Quand une retouche ne tient plus »)')

    def donnees(p):
        txt = open(p, encoding='utf-8').read()
        return ast.parse(txt), txt

    # -- les retouches et leurs contrôles (des données : lues, jamais exécutées)
    arbre, _ = donnees(os.path.join(racine, 'retouches', 'kit.py'))
    listes = {'PATCHES': [], 'HTML_PATCHES': []}
    for node in arbre.body:
        cible = node.targets[0] if isinstance(node, ast.Assign) else node.target
        listes[cible.id] += list(ast.literal_eval(node.value))
    # les retouches écrites pour l'intégration (confort, décision d'Anthony du 2 novembre 2026), après celles du kit
    confort = []
    if os.path.exists(os.path.join(racine, 'retouches', 'confort.py')):
        for node in donnees(os.path.join(racine, 'retouches', 'confort.py'))[0].body:
            confort += list(ast.literal_eval(node.value))
    C = ast.literal_eval(open(os.path.join(racine, 'retouches', 'controle.py'), encoding='utf-8').read())
    R = C['retouches']
    for n, o, nw in listes['PATCHES'] + listes['HTML_PATCHES'] + confort:
        if n not in R:
            stop(f'la retouche « {n} » n\'a pas de contrôle (retouches/controle.py) : relancer outils/generer-retouches.py')

    # -- 1. version et interface du jeu (les retouches ont été validées sur celles-ci)
    v = re.findall(r"const GAME_VERSION = '([^']+)';", s)
    e = re.findall(r'const EDITOR_API = (\d+);', s)
    if len(v) != 1 or len(e) != 1:
        stop(f'GAME_VERSION ou EDITOR_API introuvable ou en double ({len(v)}, {len(e)})')
    ok = C['jeu_valide']
    if v[0] not in ok['version'] or int(e[0]) not in ok['editor_api']:
        stop(f'jeu {v[0]}, interface {e[0]} : les retouches ont été validées le {C["valide_le"]} pour les versions '
             f'{", ".join(ok["version"])} et les interfaces {", ".join(map(str, ok["editor_api"]))}. Revalider (outils/generer-retouches.py, '
             'essais), puis ajouter ce numéro à jeu_valide dans retouches/controle.py')

    # -- le script du jeu (celui qui déclare GAME_VERSION) et l'en-tête HTML
    k = s.find("const GAME_VERSION = '")
    i = s.rfind('<script>', 0, k) + len('<script>')
    j = s.find('</script>', k)
    head, js, rest = s[:i - len('<script>')], s[i:j], s[j:]
    MARQUE = '/* ====================================================== fin du monde ouvert == */'
    if js.count(MARQUE) != 1:
        stop(f'la fin du monde ouvert (« {MARQUE} ») est présente {js.count(MARQUE)} fois dans le script du jeu au lieu d\'une')

    # -- 2. les noms du moteur dont le marais dépend
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
                    nm = re.match(r'\s*([A-Za-z_$][\w$]*)\s*(=|;|$)', q)
                    if nm: out.add(nm.group(1))
                continue
            m = re.match(r'(?:async\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)', line)
            if m: out.add(m.group(2))
        return out
    moteur = set()
    for b in re.finditer(r'<script>(.*?)</script>', s, re.S):
        moteur |= declares(b.group(1))
    manque = {n: d for n, d in C['dependances'].items() if n not in moteur}
    if manque:
        lignes = [f'  {n} (déclaré dans {d[0]} à la validation ; utilisé par {", ".join(d[1])})' for n, d in sorted(manque.items())]
        stop(f'{len(manque)} nom(s) du moteur utilisé(s) par le marais ne sont plus déclarés :\n' + '\n'.join(lignes))

    # -- modules modifiés depuis la validation (signalés ; leurs retouches restent contrôlées une par une)
    changes = []
    for f, h in C['modules'].items():
        p = os.path.join(KH, f)
        if not os.path.exists(p):
            stop(f'le module {f}, visé par des retouches, n\'existe plus')
        if hashlib.sha256(open(p, 'rb').read()).hexdigest() != h:
            changes.append(f)

    # -- la déclaration de premier niveau qui englobe une position
    DECL = re.compile(r'(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+(?!(?:float|int|bool|vec[234]|mat[234])\b)([A-Za-z_$][\w$]*)')
    def englobant(txt, p):
        ls = txt.rfind('\n', 0, p) + 1
        while ls > 0:
            m = DECL.match(txt, ls)
            if m:
                return m.group(1) or m.group(2)
            ls = txt.rfind('\n', 0, ls - 1) + 1
        return '(début du script)'

    def retouche(txt, n, o, nw, ou):
        c, r = txt.count(o), R[n]
        if c != 1 or englobant(txt, txt.find(o)) != r['dans']:
            mod = r['lieu']
            etat = (' ; ce module a changé depuis la validation' if mod in changes else ' ; ce module n\'a pas changé') if mod.startswith('src/') else ''
            quoi = (f'son motif est présent {c} fois {ou} au lieu d\'une' if c != 1 else
                    f'son motif est dans {englobant(txt, txt.find(o))}() au lieu de {r["dans"]}()')
            stop(f'la retouche « {n} » ne tient plus : {quoi}.\n'
                 f'  validée dans : {mod}, {r["dans"]}(){etat}{" ; enchaînée sur « " + r["parente"] + " »" if "parente" in r else ""}\n'
                 f'  code travaillé par : {r["session"]}\n'
                 f'  motif (début) : {o[:240]!r}\n'
                 '  À faire : reprendre ce motif dans engine/marecages/retouches/kit.py, relancer outils/generer-retouches.py,\n'
                 '  puis les essais du marais (sa version ancienne est dans la copie de référence du kit).')
        return txt.replace(o, nw)

    # -- 3. les retouches du script, dans l'ordre du kit, puis celles du confort
    for n, o, nw in listes['PATCHES'] + confort:
        js = retouche(js, n, o, nw, 'dans le script du jeu')

    # -- 4. les sources du marais, avant la fin du monde ouvert (comme le kit : à la suite, puis un retour à la ligne)
    parts = sorted(glob.glob(os.path.join(racine, 'src', 'ma*.js')))
    code = {os.path.basename(p): open(p, encoding='utf-8').read() for p in parts}
    for f, c in code.items():
        if re.search(r'console\.error\s*=(?!=)', c) and not fidele:
            stop(f'src/{f} remplace console.error (interdit : décision d\'Anthony du 1er novembre 2026)')
        if '</script' in c.lower():
            stop(f'src/{f} contient une balise de fin de script')
    js = js.replace(MARQUE, ''.join(code.values()) + '\n' + MARQUE)

    # -- 5. les modules autonomes, tels quels (empreintes du kit), avant le script du jeu
    ORIG = [('mere-vase.js', '94df6a25ce3cfb7152e8be7309f138efe9753707388368663c395463db8b1f25'),
            ('mere-vase-audio.js', 'dd3029a98d2209f1607805f70c59eb659c66d1a28b9864661709b4879b67269d'),
            ('barque.js', 'd43c95f6786b6ebf04c9c8dbd21bd59027be5140fcb7b4af7ca8654879ebaa49')]
    extra = ''
    for f, h in ORIG:
        raw = open(os.path.join(racine, 'orig', f), 'rb').read()
        if hashlib.sha256(raw).hexdigest() != h:
            stop(f'orig/{f} n\'est plus le fichier du kit (empreinte)')
        txt = raw.decode('utf-8')
        if '</script' in txt.lower():
            stop(f'orig/{f} contient une balise de fin de script')
        extra += f'<script>\n/* Marécages Maudits : engine/marecages/orig/{f}, inséré tel quel (kit 2.0.7 « Stryges », empreinte contrôlée) */\n{txt}\n</script>\n'

    # -- 6. l'en-tête HTML (comme le kit : motif cherché dans l'en-tête seulement)
    for n, o, nw in listes['HTML_PATCHES']:
        c = head.count(o)
        if c != 1:
            stop(f'la retouche HTML « {n} » ne tient plus : son motif est présent {c} fois dans l\'en-tête au lieu d\'une.\n'
                 f'  validée dans : {R[n]["lieu"]} ; code travaillé par : {R[n]["session"]}\n  motif (début) : {o[:240]!r}')
        head = head.replace(o, nw)

    s = head + extra + '<script>' + js + rest

    # -- 7. après coup : aucun nom déclaré deux fois dans le script du jeu (une fonction en double en écraserait une autre)
    vus, doubles = {}, set()
    k = s.find("const GAME_VERSION = '")
    js2 = s[s.rfind('<script>', 0, k) + len('<script>'):s.find('</script>', k)]
    for ln, line in enumerate(js2.split('\n'), 1):
        for n in declares(line):
            if n in vus: doubles.add(n)
            vus[n] = ln
    if doubles:
        stop(f'nom(s) déclaré(s) deux fois dans le script du jeu : {", ".join(sorted(doubles))}')
    nb = {'base': sum(1 for n, o, nw in listes['PATCHES'] if not R[n]['lieu'].startswith('src/')),
          'mod': sum(1 for n, o, nw in listes['PATCHES'] if R[n]['lieu'].startswith('src/'))}
    print(f'Marécages Maudits : {len(listes["PATCHES"])} retouches du script ({nb["base"]} dans le jeu de base, {nb["mod"]} dans '
          f'des modules) et {len(listes["HTML_PATCHES"])} de l\'en-tête, plus {len(confort)} de confort ; {len(parts)} sources, 3 modules autonomes ; '
          f'jeu {v[0]}, interface {e[0]} ; {len(C["dependances"])} noms du moteur présents')
    if changes:
        print(f'  modules modifiés depuis la validation du {C["valide_le"]} (retouches retrouvées, à revalider par les essais) : {", ".join(changes)}')
    return s

# ZS_SANS_MARECAGES=1 : le jeu sans la carte (outils du chantier qui partent du jeu officiel, vérification de départ :
# ZS_SANS_MARECAGES=1 python3 engine/tools/build.py --out /tmp/zs.html, puis cmp avec game/zombie-survival.html).
if os.environ.get('ZS_SANS_MARECAGES') == '1':
    print('Marécages Maudits : étape sautée (ZS_SANS_MARECAGES=1) : jeu sans la carte')
else:
    # carte privée (décision d'Anthony du 1er novembre 2026) : tant que le verrou est armé (une ligne « * » dans
    # engine/marecages/.gitignore), build.py n'écrit jamais la carte dans game/zombie-survival.html, le fichier suivi par
    # Git. Verrou retiré le 2 novembre 2026, avec son accord (le dossier entre dans l'historique) ; on peut le réarmer
    # pour un travail à garder privé.
    _ma_racine = globals().get('MA_RACINE') or os.path.join(KH, 'marecages')
    _ma_verrou = os.path.join(_ma_racine, '.gitignore')
    _ma_arme = os.path.exists(_ma_verrou) and any(l.strip() == '*' for l in open(_ma_verrou, encoding='utf-8'))
    if (globals().get('out_path') and globals().get('GAME') and _ma_arme
            and os.path.abspath(out_path) == os.path.abspath(GAME)):
        sys.exit('MARÉCAGES MAUDITS : la carte est privée (verrou armé : ligne « * » dans engine/marecages/.gitignore) :\n'
                 '  build.py n\'écrit pas game/zombie-survival.html, le fichier suivi par Git. Avec la carte : python3\n'
                 '  engine/tools/build.py --out FICHIER (hors du dépôt) ou python3 engine/marecages/construire.py ; sans elle :\n'
                 '  ZS_SANS_MARECAGES=1 python3 engine/tools/build.py')
    del _ma_verrou, _ma_arme
    # MA_FIDELE (outils/comparer.py seulement) : reconstruction fidèle au kit, dont ma11 remplace console.error
    s = _marecages(s, _ma_racine, bool(globals().get('MA_FIDELE')))
    del _ma_racine
del _marecages
