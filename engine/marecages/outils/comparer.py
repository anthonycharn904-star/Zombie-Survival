#!/usr/bin/env python3
"""Marécages Maudits : rapport des différences avec le kit 2.0.7 « Stryges » (1er novembre 2026).

  1. Reconstruction fidèle : les sources du kit telles quelles (sa copie de référence), ses retouches moins GAME_VERSION,
     construites par notre étape sur le jeu officiel, puis emballées comme le fait le launcher (polices et three.js
     locaux). Comparée au jeu du kit (jeu/index.html) : seules les différences attendues sont admises (numéro du jeu,
     en-têtes des trois modules autonomes).
  2. Construction adaptée (les sources de engine/marecages) : écarts avec la reconstruction fidèle, fichier par fichier
     (sources et retouches), le réétiquetage des versions de travail mis à part.
Écrit le rapport (Markdown) et les différences détaillées dans DOSSIER.

Usage : comparer.py KIT DOSSIER   (KIT : le dossier « kit-2.0.7-stryges » de la copie privée)"""
import difflib, glob, hashlib, os, re, shutil, subprocess, sys, tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
MA = os.path.dirname(ICI)
KIT, OUT = sys.argv[1], sys.argv[2]
sys.dont_write_bytecode = True                         # pas de __pycache__ dans le dépôt
sys.path.insert(0, ICI)
from etiquettes import reetiqueter
os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp(prefix='ma-comparer-')
PY = [sys.executable, '-I']

def lire(p):
    return open(p, encoding='utf-8').read()

def sha(b):
    return hashlib.sha256(b).hexdigest()

# ---------------------------------------------------------------- 1. reconstruction fidèle --
F = os.path.join(tmp, 'fidele')
os.makedirs(os.path.join(F, 'src')); os.makedirs(os.path.join(F, 'orig')); os.makedirs(os.path.join(F, 'retouches'))
for p in glob.glob(os.path.join(KIT, 'sources', 'src', 'ma', 'ma*.js')):
    shutil.copyfile(p, os.path.join(F, 'src', os.path.basename(p)))
for f in ['mere-vase.js', 'mere-vase-audio.js', 'barque.js']:
    shutil.copyfile(os.path.join(KIT, 'sources', 'src', f), os.path.join(F, 'orig', f))
subprocess.run(PY + [os.path.join(ICI, 'generer-retouches.py'), KIT, '--brut', os.path.join(F, 'retouches')], check=True, capture_output=True)
shutil.copyfile(os.path.join(MA, 'retouches', 'controle.py'), os.path.join(F, 'retouches', 'controle.py'))
fid = os.path.join(tmp, 'fidele.html')
r = subprocess.run(PY + [os.path.join(MA, 'construire.py'), '--racine', F, '--fidele', '--out', fid], capture_output=True, text=True)
if r.returncode:
    sys.exit('reconstruction fidèle impossible :\n' + r.stdout + r.stderr)

def emballer(t):
    """Ce que fait le launcher pour la version hors ligne (2.0.6 publiée) : polices et three.js locaux."""
    fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
             '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Big+Shoulders+Stencil+Display:wght@700;900&family=Special+Elite&display=swap">\n')
    three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
    if t.count(fonts) != 1 or t.count(three) != 1:
        sys.exit('emballage : lignes des polices ou de three.js introuvables')
    return t.replace(fonts, '<link rel="stylesheet" href="fonts/fonts.css">\n').replace(three, '<script src="lib/three.min.js"></script>\n')

kit_html = lire(os.path.join(KIT, 'jeu', 'index.html'))
fid_html = emballer(lire(fid))
a, b = fid_html.split('\n'), kit_html.split('\n')
sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
ecarts = [(tag, a[i1:i2], b[j1:j2]) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal']
ATTENDU = [
    (["const GAME_VERSION = '2.0.6';"], ["const GAME_VERSION = '2.0.7';"]),
    *[([f'/* Marécages Maudits : engine/marecages/orig/{f}, inséré tel quel (kit 2.0.7 « Stryges », empreinte contrôlée) */'],
       [f'/* jeu 2.0.7 : src/{f}, inséré tel quel par tools/build_swamp.py */']) for f in ['mere-vase.js', 'mere-vase-audio.js', 'barque.js']],
]
reste = [(t, x, y) for t, x, y in ecarts if (x, y) not in ATTENDU]
fidele_ok = not reste and len(ecarts) == len(ATTENDU)

# ---------------------------------------------------------------- 2. construction adaptée --
ada = os.path.join(tmp, 'adapte.html')
r2 = subprocess.run(PY + [os.path.join(MA, 'construire.py'), '--out', ada], capture_output=True, text=True)
adapte_ok = r2.returncode == 0
lignes = []
def diff_fichier(nom, avant, apres, sortie):
    d = list(difflib.unified_diff(avant.split('\n'), apres.split('\n'), f'kit (réétiqueté) : {nom}', f'adapté : {nom}', n=2, lineterm=''))
    if d:
        open(os.path.join(OUT, sortie), 'w', encoding='utf-8').write('\n'.join(d) + '\n')
    plus = sum(1 for l in d if l.startswith('+') and not l.startswith('+++'))
    moins = sum(1 for l in d if l.startswith('-') and not l.startswith('---'))
    return plus, moins
detail = []
os.makedirs(os.path.join(OUT, 'diff'), exist_ok=True)
for p in sorted(glob.glob(os.path.join(KIT, 'sources', 'src', 'ma', 'ma*.js'))):
    f = os.path.basename(p)
    k = lire(p)
    rk = reetiqueter(k)
    n_et = sum(1 for x, y in zip(k.split('\n'), rk.split('\n')) if x != y)
    cur = os.path.join(MA, 'src', f)
    plus, moins = diff_fichier(f, rk, lire(cur), f'diff/{f}.diff') if os.path.exists(cur) else ('absent', '')
    detail.append((f, n_et, plus, moins))
nouveaux = sorted(set(os.path.basename(p) for p in glob.glob(os.path.join(MA, 'src', '*.js'))) - set(d[0] for d in detail))
gen = os.path.join(tmp, 'gen')
kit_py = lire(os.path.join(MA, 'retouches', 'kit.py'))
subprocess.run(PY + [os.path.join(ICI, 'generer-retouches.py'), KIT, '--brut', gen], check=True, capture_output=True)
brut_py = lire(os.path.join(gen, 'kit.py'))
p_r, m_r = diff_fichier('retouches/kit.py', reetiqueter(brut_py.split('\n', 4)[4]), kit_py.split('\n', 5)[5], 'diff/retouches-kit.py.diff')
orig_ok = all(sha(open(os.path.join(MA, 'orig', f), 'rb').read()) == sha(open(os.path.join(KIT, 'sources', 'src', f), 'rb').read())
              for f in ['mere-vase.js', 'mere-vase-audio.js', 'barque.js'])

R = ['# Marécages Maudits : différences avec le kit 2.0.7 « Stryges »', '',
     f'Kit : `{KIT}` (copie de référence ; `jeu/index.html` SHA-256 {sha(kit_html.encode())}).', '',
     '## 1. Reconstruction fidèle (sources du kit telles quelles, par notre étape, sur le jeu officiel)', '',
     f'- Résultat : {"**conforme**" if fidele_ok else "**écarts inattendus**"} ({len(ecarts)} différence(s) de lignes, {len(ATTENDU)} attendues).',
     '- Différences attendues : le numéro (`GAME_VERSION` reste celui de l\'atelier, retouche du kit retirée) et le commentaire',
     '  d\'en-tête des trois modules autonomes. L\'emballage (polices, three.js) est celui du launcher, appliqué avant la comparaison.']
for t, x, y in reste[:20]:
    R.append(f'- **inattendu** ({t}) : `{x[:2]}` → `{y[:2]}`')
R += ['', '## 2. Construction adaptée', '',
      f'- Construction : {"réussie" if adapte_ok else "**refusée**"}.' + ('' if adapte_ok else '\n\n```\n' + (r2.stdout + r2.stderr).strip()[-1500:] + '\n```'),
      f'- Modules autonomes (`orig/`) : {"identiques au kit" if orig_ok else "**différents du kit**"}.',
      f'- Retouches (`retouches/kit.py`, réétiquetage mis à part) : +{p_r} / −{m_r} lignes (détail : `diff/retouches-kit.py.diff`).',
      f'- Fichiers ajoutés : {", ".join(nouveaux) if nouveaux else "aucun"}.', '',
      '| Fichier | Lignes réétiquetées | Adaptations (+ / −) |', '|---|---:|---:|']
for f, n_et, plus, moins in detail:
    R.append(f'| `{f}` | {n_et} | {"—" if plus == 0 and moins == 0 else f"+{plus} / −{moins}"} |')
R.append('')
open(os.path.join(OUT, 'rapport-differences.md'), 'w', encoding='utf-8').write('\n'.join(R) + '\n')
for nom, p in [('fidele.html', fid), ('adapte.html', ada)]:
    if os.path.exists(p):
        shutil.copyfile(p, os.path.join(OUT, nom))
print('\n'.join(R))
print(f'\n(rapport et différences : {OUT})')
sys.exit(0 if fidele_ok else 1)
