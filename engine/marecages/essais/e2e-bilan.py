#!/usr/bin/env python3
"""Marécages Maudits : bilan de e2e-comparer.sh. Pour chaque essai et chaque vérification, compare le jeu officiel et le jeu
avec le marais. Seules comptent les différences : un bloc qui échoue ici quel que soit le jeu (pas de launcher, pas de
clavier entre deux blocs) échoue des deux côtés.
Trois sortes d'écarts :
- vérification réussie d'un côté, ratée ou absente de l'autre : différence réelle ;
- même vérification, même résultat, mais une valeur mesurée dans son texte change (temps, tirage, physique) : bruit
  d'une exécution à l'autre, compté à part ;
- bloc en erreur d'un seul côté, ou avec un autre message : différence réelle.
Écrit DOSSIER/bilan.md ; avec deux autres sous-dossiers A et B (deux passages du même jeu, pour mesurer le bruit),
DOSSIER/bilan-A-B.md.
Lit les blocs de e2e-page.js (bNN.json) et les sections de e2e-tranche.js (sNN.json).
Usage : e2e-bilan.py DOSSIER [A B]   (par défaut : officiel marais)"""
import difflib, glob, json, os, re, sys

OUT = sys.argv[1]
NA, NB = sys.argv[2:4] if len(sys.argv) > 3 else ('officiel', 'marais')
DEFAUT = (NA, NB) == ('officiel', 'marais')
TA, TB = ('sur le jeu officiel', 'avec le marais') if DEFAUT else (f'dans {NA}', f'dans {NB}')
NOMBRE = re.compile(r'\d+(?:[.,]\d+)?')


def resultats(jeu):
    R = {}
    for d in sorted(glob.glob(os.path.join(OUT, jeu, '*'))):
        if not os.path.isdir(d):
            continue
        v = {}
        for j in sorted(glob.glob(os.path.join(d, '[bs][0-9]*.json'))):
            try:
                data = json.load(open(j, encoding='utf-8'))
            except Exception:
                continue
            if isinstance(data, list):
                for x in data:
                    if isinstance(x, dict) and 'label' in x:
                        v[(os.path.basename(j)[:-5], x['label'])] = bool(x.get('ok'))
        erreurs = {}
        jt = os.path.join(d, 'journal.txt')
        if os.path.exists(jt):
            for l in open(jt, encoding='utf-8', errors='replace'):
                if l.startswith('ERREUR '):
                    b, _, msg = l[7:].rstrip('\n').partition(' ')
                    erreurs.setdefault(b, msg)
        R[os.path.basename(d)] = (v, erreurs)
    return R


def apparier(va, vb):
    """Écarts d'un essai. Une vérification présente d'un seul côté est rapprochée de la plus semblable de l'autre côté, dans
    le même bloc (texte aux nombres effacés, ressemblance de 0,85 au moins) : même résultat = valeur mesurée seulement."""
    reelles = [(k, va[k], vb[k]) for k in sorted(set(va) & set(vb)) if va[k] != vb[k]]
    seul_a = [k for k in va if k not in vb]
    seul_b = [k for k in vb if k not in va]
    paires = sorted(((difflib.SequenceMatcher(None, NOMBRE.sub('#', x[1]), NOMBRE.sub('#', y[1])).ratio(), x, y)
                     for x in seul_a for y in seul_b if x[0] == y[0]), reverse=True)
    pris, mesures = set(), []
    for r, x, y in paires:
        if r < 0.85 or x in pris or y in pris:
            continue
        pris |= {x, y}
        if va[x] == vb[y]:
            mesures.append((x[0], x[1], y[1]))
        else:
            reelles.append((x, va[x], vb[y]))
    reelles += [(k, va[k], None) for k in seul_a if k not in pris] + [(k, None, vb[k]) for k in seul_b if k not in pris]
    return reelles, mesures


def etat(ok):
    return 'absente' if ok is None else 'oui' if ok else 'non'


def ecart(a, b):
    ta, tb = a.split(), b.split()
    return ' ; '.join(f'{" ".join(ta[i1:i2])} → {" ".join(tb[j1:j2])}'
                      for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ta, tb).get_opcodes() if op != 'equal')


A, B = resultats(NA), resultats(NB)
L = ['# Blocs des essais E2 dans la page : ' + ('jeu officiel et jeu avec le marais' if DEFAUT else f'{NA} et {NB}'), '',
     f'| Essai | {"Officiel" if DEFAUT else NA} | {"Avec le marais" if DEFAUT else NB} | Différences réelles | Valeurs mesurées seulement |', '|---|---:|---:|---|---:|']
reels, bruit, detail = [], [], []
for e in sorted(set(A) | set(B), key=lambda x: list(A).index(x) if x in A else 99):
    va, ea = A.get(e, ({}, {}))
    vb, eb = B.get(e, ({}, {}))
    reelles, mesures = apparier(va, vb)
    note = []
    if reelles:
        note.append(f'{len(reelles)} vérification(s) : ' + ' ; '.join(f'{k[0]} · {k[1]} ({etat(x)} → {etat(y)})' for k, x, y in reelles[:6]))
    seul_b = sorted(set(eb) - set(ea))
    seul_a = sorted(set(ea) - set(eb))
    autre = sorted(b for b in set(ea) & set(eb) if ea[b] != eb[b])
    if seul_b:
        note.append(f'blocs en erreur seulement {TB} : ' + ', '.join(f'{b} ({eb[b][:120]})' for b in seul_b))
    if seul_a:
        note.append(f'blocs en erreur seulement {TA} : ' + ', '.join(seul_a))
    if autre:
        note.append('blocs en erreur avec un autre message : ' + ', '.join(f'{b} ({ea[b][:80]} → {eb[b][:80]})' for b in autre))
    if note:
        reels.append(e)
    elif mesures:
        bruit.append(e)
    if mesures:
        detail.append(f'- {e} :')
        detail += [f'  - {b} · {ecart(x, y)}' for b, x, y in sorted(mesures)]
    L.append(f'| {e} | {sum(va.values())}/{len(va)} | {sum(vb.values())}/{len(vb)} | {" ; ".join(note) if note else "aucune"} | {len(mesures) or ""} |')
L += ['', f'Essais avec une différence réelle : {", ".join(reels) if reels else "aucun"}.',
      f'Essais dont seule une valeur mesurée change (même résultat des deux côtés) : {", ".join(bruit) if bruit else "aucun"}.', '']
if detail:
    L += [f'Valeurs mesurées qui changent ({NA} → {NB}), vérification réussie ou ratée des deux côtés :', ''] + detail
open(os.path.join(OUT, 'bilan.md' if DEFAUT else f'bilan-{NA}-{NB}.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('\n'.join(L))
