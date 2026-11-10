"""Marécages Maudits : réétiquetage des mentions de versions de travail (1er novembre 2026).

« jeu 2.1.x » : versions de travail des Marécages Maudits (dossiers « Marécages Maudits 2.1.x (non signée) »), jamais
publiées ; « jeu 2.0.7 » : le kit « Zombie Survival 2.0.7 - a publier (Stryges) », non publié. Dans le code adapté,
« jeu » ne désigne plus que les vrais numéros du jeu (2.0.6, puis ceux que choisira Claude 5)."""
import re

def reetiqueter(t):
    t = re.sub(r'\b([Jj])eu (2\.1\.\d+)\b', lambda m: ('Kit' if m.group(1) == 'J' else 'kit') + ' MM ' + m.group(2), t)
    t = re.sub(r'\b([Jj])eu 2\.0\.7\b', lambda m: ('Kit' if m.group(1) == 'J' else 'kit') + ' 2.0.7', t)
    t = NU.sub(lambda m: 'MM ' + m.group(0), t)            # « (2.1.3) », « en 2.1.0 » : versions de travail aussi
    return t

NU = re.compile(r'(?<![\w.\-])(?<!MM )2\.1\.\d+\b')
MENTIONS = re.compile(r'\b[Jj]eu 2\.(?:1\.\d+|0\.7)\b|(?<![\w.\-])(?<!MM )2\.1\.\d+\b')

def commentaires(code):
    """Intervalles des commentaires d'un fichier JavaScript : chaînes, gabarits (et leurs ${…} imbriqués) et expressions
    régulières sautés."""
    out, i, n = [], 0, len(code)
    pile = []                                              # gabarits ouverts : profondeur d'accolades de chaque ${…}
    prev = ''                                              # dernier caractère significatif (division ou expression régulière)
    def gabarit(i):
        # dans un gabarit, après l'accent grave : jusqu'à sa fin ou jusqu'à un ${ (renvoie la position et l'état)
        while i < n:
            if code[i] == '\\': i += 2; continue
            if code[i] == '`': return i + 1, False
            if code.startswith('${', i): return i + 2, True
            i += 1
        return n, False
    while i < n:
        c = code[i]
        if c == '/' and code.startswith('//', i):
            j = code.find('\n', i); j = n if j < 0 else j
            out.append((i, j)); i = j; continue
        if c == '/' and code.startswith('/*', i):
            j = code.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append((i, j)); i = j; continue
        if c in '\'"':
            q, i = c, i + 1
            while i < n and code[i] != q:
                i += 2 if code[i] == '\\' else 1
            i += 1; prev = q; continue
        if c == '`':
            i, ouvert = gabarit(i + 1)
            if ouvert: pile.append(0)
            prev = '`'; continue
        if pile and c == '{': pile[-1] += 1
        if pile and c == '}':
            if pile[-1] == 0:
                pile.pop()
                i, ouvert = gabarit(i + 1)
                if ouvert: pile.append(0)
                prev = '`'; continue
            pile[-1] -= 1
        if c == '/' and (prev == '' or prev in '(,=:[!&|?{};+-*%<>~^'):
            i += 1
            cls = False
            while i < n and (code[i] != '/' or cls):
                if code[i] == '\\': i += 1
                elif code[i] == '[': cls = True
                elif code[i] == ']': cls = False
                i += 1
            i += 1; prev = '/'; continue
        if not c.isspace():
            prev = c
        i += 1
    return out
