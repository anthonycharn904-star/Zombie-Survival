# Noms déclarés au niveau du script (const/let/var/function/class en début de ligne) : doublons ?
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
# le script principal : le bloc <script> qui déclare GAME_VERSION (depuis le jeu 2.0.6, les données du
# personnage forment un bloc presque aussi gros : le plus gros bloc ne suffit plus à le reconnaître)
blocs = [b for b in re.finditer(r'<script>(.*?)</script>', src, re.S) if 'const GAME_VERSION' in b.group(1)]
m = blocs[0] if len(blocs) == 1 else max(re.finditer(r'<script>(.*?)</script>', src, re.S), key=lambda x: len(x.group(1)))
code = m.group(1)
names = {}
for ln, line in enumerate(code.split('\n'), 1):
    mm = re.match(r'(const|let|var)\s+(.*)', line)
    if mm:
        rest = mm.group(2)
        # déclarateurs au premier niveau : on coupe aux virgules hors parenthèses/accolades/crochets
        depth, cur, parts = 0, '', []
        for ch in rest:
            if ch in '([{': depth += 1
            elif ch in ')]}': depth -= 1
            if ch == ',' and depth == 0: parts.append(cur); cur = ''
            else: cur += ch
            if ch == ';' and depth == 0: break
        parts.append(cur)
        for p in parts:
            n = re.match(r'\s*([A-Za-z_$][\w$]*)\s*(=|;|$)', p)
            if n: names.setdefault(n.group(1), []).append(ln)
        continue
    mm = re.match(r'(?:async\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)', line)
    if mm: names.setdefault(mm.group(2), []).append(ln)
d = {k: v for k, v in names.items() if len(v) > 1}
print('doublons :', d if d else 'aucun')
