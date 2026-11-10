#!/usr/bin/env python3
"""Marécages Maudits : construit le jeu avec la carte, sans toucher engine/tools/build.py (1er novembre 2026).

Lance build.py (jeu officiel, vers un fichier temporaire), puis exécute etape.py sur son résultat, avec les mêmes noms
que build.py : c'est exactement ce que fera la ligne proposée pour la fin de build.py.
  --out FICHIER   où écrire le jeu (par défaut : ~/dev/zs-verif-logs/marecages/constructions/zombie-survival-marecages.html,
                  hors du dépôt : utile pour comparer, sans toucher le jeu suivi) ;
  --racine DOSS   sources du marais prises ailleurs (outils/comparer.py : reconstruction fidèle au kit) ;
  --fidele        avec --racine seulement : sources du kit telles quelles (son ma11 remplace console.error) ;
  --base FICHIER  passé à build.py (jeu de base autre que le 1.9.0 de l'historique).
N'écrit jamais dans game/zombie-survival.html : depuis le 2 novembre 2026 (la ligne est dans build.py), c'est build.py
qui l'écrit, carte comprise."""
import hashlib, os, subprocess, sys, tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
KH = os.path.dirname(ICI)
REPO = os.path.dirname(KH)
args = sys.argv[1:]
out = args[args.index('--out') + 1] if '--out' in args else os.path.expanduser('~/dev/zs-verif-logs/marecages/constructions/zombie-survival-marecages.html')
racine = os.path.abspath(args[args.index('--racine') + 1]) if '--racine' in args else ICI
if os.path.abspath(out) == os.path.join(REPO, 'game', 'zombie-survival.html'):
    sys.exit('construire.py : refus d\'écrire dans game/zombie-survival.html (fichier suivi par Git)')
tmp = tempfile.mkdtemp(prefix='ma-construire-')
officiel = os.path.join(tmp, 'officiel.html')
cmd = [sys.executable, '-I', os.path.join(KH, 'tools', 'build.py'), '--out', officiel]
if '--base' in args:
    cmd += ['--base', args[args.index('--base') + 1]]
r = subprocess.run(cmd, capture_output=True, text=True, env=dict(os.environ, ZS_SANS_MARECAGES='1'))   # le jeu officiel, sans la carte
sys.stdout.write(r.stdout)
if r.returncode:
    sys.exit(r.stderr or 'build.py a échoué')
if '--fidele' in args and racine == ICI:
    sys.exit('construire.py : --fidele ne vaut qu\'avec --racine (jamais pour les sources du dépôt)')
ns = {'__name__': '__marecages__', 's': open(officiel, encoding='utf-8').read(), 'KH': KH, 'os': os, 'sys': sys, 'MA_RACINE': racine,
      'MA_FIDELE': '--fidele' in args}
exec(compile(open(os.path.join(ICI, 'etape.py'), encoding='utf-8').read(), os.path.join(ICI, 'etape.py'), 'exec'), ns)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
data = ns['s'].encode('utf-8')
open(out, 'wb').write(data)
print(f'{out} : {len(data)} octets, {ns["s"].count(chr(10))} lignes, SHA-256 {hashlib.sha256(data).hexdigest()}')
