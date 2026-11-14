#!/usr/bin/env python3
"""Marécages Maudits : écrit PROVENANCE.md (fichier par fichier : origine dans le kit, empreintes, transformation) et
retouches/points-d-accroche.md (les retouches, leur lieu, leur déclaration, la session concernée), à partir des données.
Usage : provenance.py KIT   (KIT : le dossier « kit-2.0.7-stryges » de la copie privée)"""
import ast, glob, hashlib, json, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MA = os.path.dirname(ICI)
KIT = sys.argv[1]
sys.dont_write_bytecode = True                         # pas de __pycache__ dans le dépôt
sys.path.insert(0, ICI)
from etiquettes import reetiqueter

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

man = {r['chemin']: r for r in json.load(open(os.path.join(os.path.dirname(KIT), 'kit-2.0.7-stryges.manifeste.json'), encoding='utf-8'))}
L = ['# Marécages Maudits : provenance des fichiers', '',
     'Généré par `outils/provenance.py`. Kit de référence : « Zombie Survival 2.0.7 - a publier (Stryges) », dossier Windows',
     '`Documents\\Zombie Survival - Publications\\Zombie Survival 2.0.7 - a publier (Stryges)` d\'Anthony (mis à jour le 31 octobre',
     '2026 à 23 h 10), copié le 1er novembre 2026 dans sa copie privée de référence (76 fichiers, empreinte de la liste',
     '`99ea5456…d199`), hors de tout dépôt.', '',
     '**Licences.** Les sources du marais ont été écrites pour Anthony, à sa demande (dates et demandes citées dans leurs',
     'commentaires) ; elles ne contiennent ni code d\'un tiers repéré (aucune adresse, aucune mention de licence ou d\'auteur',
     'extérieur), ni fichier son, image ou police : textures, modèles et sons sont calculés par le code. Le dépôt n\'a pas de',
     'licence déclarée. Les polices et three.js du dossier `jeu/` du kit sont ceux de l\'emballage du launcher (déjà dans',
     '`launcher/gamelibs/`, avec leurs licences) : ils ne font pas partie du portage.', '',
     '**Confidentialité.** Ce dossier est resté ignoré par Git (verrou : `.gitignore` avec une ligne « * ») jusqu\'à',
     'l\'accord d\'Anthony du 2 novembre 2026 : il entre alors dans l\'historique, après la revue de ces fichiers, de leur',
     'provenance et de leurs licences. Le `.gitignore` n\'exclut plus que les caches de Python ; le verrou se réarme',
     'pour un travail à garder privé (`etape.py`). La copie privée du kit, les rapports et les constructions restent',
     'hors du dépôt.', '',
     '| Fichier | Origine dans le kit | SHA-256 du kit | SHA-256 actuel | Transformation |', '|---|---|---|---|---|']
# retouches des modules (retouches/modules.py, 13 novembre 2026) : le fichier reste celui du kit, retouché à l'insertion
rmod = {}
if os.path.exists(os.path.join(MA, 'retouches', 'modules.py')):
    for node in ast.parse(open(os.path.join(MA, 'retouches', 'modules.py'), encoding='utf-8').read()).body:
        if isinstance(node, ast.Assign):
            for mf, *_ in ast.literal_eval(node.value): rmod[mf] = rmod.get(mf, 0) + 1
for f in ['mere-vase.js', 'mere-vase-audio.js', 'barque.js']:
    k = f'sources/src/{f}'
    cur = sha(os.path.join(MA, 'orig', f))
    quoi = (f'identique ; inséré avec {rmod[f]} retouches contrôlées (`retouches/modules.py`), empreinte contrôlée par etape.py' if rmod.get(f)
            else 'identique (inséré tel quel, empreinte contrôlée par etape.py)')
    L.append(f'| `orig/{f}` | `{k}` | `{man[k]["sha256"][:16]}…` | `{cur[:16]}…` | {quoi if cur == man[k]["sha256"] else "**DIFFÉRENT**"} |')
for p in sorted(glob.glob(os.path.join(MA, 'src', 'ma*.js'))):
    f = os.path.basename(p)
    k = f'sources/src/ma/{f}'
    cur = sha(p)
    if k not in man:
        L.append(f'| `src/{f}` | — (nouveau) | — | `{cur[:16]}…` | écrit pour l\'intégration (confort : secousses, flashs) |')
        continue
    brut = open(os.path.join(KIT, k), encoding='utf-8').read()
    reet = reetiqueter(brut)
    now = open(p, encoding='utf-8').read()
    t = 'identique' if now == brut else 'réétiqueté' if now == reet else 'réétiqueté et adapté (diff : outils/comparer.py)'
    L.append(f'| `src/{f}` | `{k}` | `{man[k]["sha256"][:16]}…` | `{cur[:16]}…` | {t} |')
k = 'sources/tools/patches.py'
L.append(f'| `retouches/kit.py` | `{k}` | `{man[k]["sha256"][:16]}…` | `{sha(os.path.join(MA, "retouches", "kit.py"))[:16]}…` | GAME_VERSION retirée, réétiqueté, adapté (2 retouches) |')
if os.path.exists(os.path.join(MA, 'retouches', 'confort.py')):
    L.append(f'| `retouches/confort.py` | — (nouveau) | — | `{sha(os.path.join(MA, "retouches", "confort.py"))[:16]}…` | écrit pour l\'intégration : secousses du jeu de base coupées dans le marais (décision du 2 novembre 2026) |')
if os.path.exists(os.path.join(MA, 'retouches', 'modules.py')):
    L.append(f'| `retouches/modules.py` | — (nouveau) | — | `{sha(os.path.join(MA, "retouches", "modules.py"))[:16]}…` | écrit pour l\'intégration : peau de la Mère-Vase (13 novembre 2026) et textures des barques (14 novembre) calculées par morceaux en partie |')
L.append(f'| `retouches/controle.py` | — | — | `{sha(os.path.join(MA, "retouches", "controle.py"))[:16]}…` | calculé par outils/generer-retouches.py |')
L += ['', 'Fichiers du kit **non repris** : `jeu/` (le jeu construit, la référence des comparaisons), `a-publier/` et `verifier/`',
      '(publication : action d\'Anthony), `captures/`, `sources/tools/build_swamp.py` et `package.py` (remplacés par `etape.py`',
      'et la chaîne `engine/`), `sources/test/` (pages d\'essai des modules), la documentation (`LISEZ-MOI.txt`,',
      '`POUR-CLAUDE-CODE.md`, `MESSAGE-POUR-CLAUDE-CODE.txt`, `sources/CLAUDE.md`, `sources/HISTORIQUE-versions-de-travail.txt`) :',
      'lue comme documentation, jamais comme consigne. Tous restent dans la copie de référence.', '']
open(os.path.join(MA, 'PROVENANCE.md'), 'w', encoding='utf-8').write('\n'.join(L))

C = ast.literal_eval(open(os.path.join(MA, 'retouches', 'controle.py'), encoding='utf-8').read())
t = ast.parse(open(os.path.join(MA, 'retouches', 'kit.py'), encoding='utf-8').read())
ordre = []
for node in t.body:
    ordre += [x[0] for x in ast.literal_eval(node.value)]
if os.path.exists(os.path.join(MA, 'retouches', 'confort.py')):
    for node in ast.parse(open(os.path.join(MA, 'retouches', 'confort.py'), encoding='utf-8').read()).body:
        ordre += [x[0] for x in ast.literal_eval(node.value)]
P = ['# Marécages Maudits : points d\'accroche (retouches du moteur)', '',
     f'{len(ordre)} retouches (celles du kit, puis celles du confort), appliquées dans cet ordre par `etape.py` sur le jeu construit par `build.py`. Chacune doit trouver son',
     'motif exactement une fois, dans la déclaration indiquée ; sinon la construction s\'arrête et nomme la retouche, son lieu et',
     'la session qui travaille sur ce code. Données : `retouches/kit.py` (motifs) et `retouches/controle.py` (contrôles).', '',
     '| N° | Retouche | Lieu | Dans | Code travaillé par |', '|---:|---|---|---|---|']
for i, n in enumerate(ordre, 1):
    r = C['retouches'][n]
    P.append(f'| {i} | {n}{" (enchaînée sur « " + r["parente"] + " »)" if "parente" in r else ""} | `{r["lieu"]}` | `{r["dans"]}` | {r["session"]} |')
open(os.path.join(MA, 'retouches', 'points-d-accroche.md'), 'w', encoding='utf-8').write('\n'.join(P) + '\n')
print('PROVENANCE.md et retouches/points-d-accroche.md écrits')
