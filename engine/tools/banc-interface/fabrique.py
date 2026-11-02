#!/usr/bin/env python3
"""Banc de l'interface : fabrique les pages du banc dans <dossier>, à partir du jeu préparé (launcher/game/).

    python3 engine/tools/banc-interface/fabrique.py <dossier>

Pages écrites dans <dossier> (rien dans le dépôt) :
  hud.html             couche HUD autonome : styles et balisage du HUD du jeu tels quels, module des points d'Anthony
                       tel quel (engine/orig/hud-points/), polices incluses, banc.js ; servie aux captures
  comparaison-hud.html page interactive autonome (un seul fichier) : variantes du HUD, carte, écran simulé
  schema-fov.html      schéma à géométrie exacte des deux modes du champ de vision
  fov.md               table des champs de vision des deux modes (reprise dans docs/audit-interface.md)
  planche-hud.html, planche-echelle.html : planches des captures faites ensuite par capture.js
Il faut préparer le jeu d'abord (cd launcher && node scripts/prepare-game.js)."""
import base64, json, math, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(ICI, '..', '..', '..'))
JEU = os.path.join(REPO, 'launcher', 'game')
if len(sys.argv) < 2 or sys.argv[1].startswith('-'):
    sys.exit('usage : python3 engine/tools/banc-interface/fabrique.py <dossier>')
OUT = os.path.abspath(sys.argv[1])
if OUT == REPO or OUT.startswith(REPO + os.sep):
    sys.exit('le dossier de sortie doit être hors du dépôt (ex. : le dossier temporaire de la session)')
os.makedirs(OUT, exist_ok=True)
lire = lambda p: open(p, encoding='utf-8').read()
fr = lambda x, n=1: f'{x:.{n}f}'.replace('.', ',')

# ------------------------------------------------------------------ couche HUD autonome
jeu = lire(os.path.join(JEU, 'index.html'))
style = re.search(r'<style>(.*?)</style>', jeu, re.S).group(1)
a, b = jeu.index('<div id="hud" hidden>'), jeu.index('\n<div id="rankup"')
hud = jeu[a:b].replace('<div id="hud" hidden>', '<div id="hud">', 1)
polices = lire(os.path.join(JEU, 'fonts', 'fonts.css'))
def police(m):
    data = base64.b64encode(open(os.path.join(JEU, 'fonts', m.group(1)), 'rb').read()).decode()
    return f"url(data:font/woff2;base64,{data})"
polices = re.sub(r"url\('([^']+\.woff2)'\)", police, polices)
module = lire(os.path.join(REPO, 'engine', 'orig', 'hud-points', 'hud-points.js'))
banc = lire(os.path.join(ICI, 'banc.js'))
script = lambda js: '<script>' + js.replace('</script', '<\\/script') + '</script>'
doc_hud = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Couche HUD</title>
<style>{polices}</style>
<style>{style}</style>
</head><body>
<div id="game"></div>
{hud}
{script(module)}
{script(banc)}
</body></html>
"""
open(os.path.join(OUT, 'hud.html'), 'w', encoding='utf-8').write(doc_hud)

# ------------------------------------------------------------------ page de comparaison (un seul fichier)
doc_js = json.dumps(doc_hud, ensure_ascii=False).replace('</', '<\\/').replace('<!--', '<\\!--')
comparaison = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparaison du HUD</title>
<style>{polices}
:root {{ color-scheme: dark; --fond: #0b0d0c; --panneau: rgba(12, 14, 13, .9); --trait: rgba(232, 223, 200, .18);
  --papier: #e8dfc8; --papier-2: #c9bd9f; --accent: #ffcf6a; --sang: #b8141d; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; height: 100%; background: var(--fond); color: var(--papier); font: 500 15px/1.3 'Barlow Condensed', system-ui, sans-serif; overflow: hidden; }}
#scene {{ position: fixed; inset: 0; overflow: hidden; }}
#scene iframe {{ position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; background: #000; pointer-events: none; }}
#scene.reel iframe {{ width: 100%; height: 100%; }}
#scene.simule iframe {{ box-shadow: 0 0 0 1px var(--trait), 0 10px 40px rgba(0, 0, 0, .6); }}
#panneau {{ position: fixed; left: 12px; top: 12px; width: 300px; max-height: calc(100% - 24px); overflow: auto; z-index: 10;
  padding: 12px 14px 10px; background: var(--panneau); border: 1px solid var(--trait); border-radius: 6px; box-shadow: 0 8px 30px rgba(0, 0, 0, .5); }}
#panneau[hidden] {{ display: none; }}
h1 {{ margin: 0 0 2px; font: 900 22px/1.05 'Big Shoulders Stencil Display', sans-serif; letter-spacing: .04em; text-transform: uppercase; }}
.sous {{ margin: 0 0 10px; color: var(--papier-2); font-size: 13px; }}
fieldset {{ margin: 0 0 10px; padding: 0; border: 0; }}
legend {{ padding: 0; margin: 0 0 5px; font-weight: 700; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--papier-2); }}
.presets {{ display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }}
button {{ font: inherit; font-weight: 600; color: var(--papier); background: rgba(232, 223, 200, .06); border: 1px solid var(--trait); border-radius: 4px; padding: 6px 8px; cursor: pointer; text-align: left; }}
button:hover {{ background: rgba(232, 223, 200, .12); }}
button[aria-pressed="true"] {{ border-color: var(--accent); background: rgba(255, 207, 106, .14); color: #fff; }}
button kbd {{ font: 700 11px/1 'Barlow Condensed', sans-serif; color: var(--accent); margin-right: 4px; }}
label {{ display: flex; align-items: center; gap: 8px; margin: 4px 0; }}
label > span {{ flex: 0 0 74px; color: var(--papier-2); }}
select, input[type=range] {{ flex: 1; min-width: 0; font: inherit; color: var(--papier); background: #151816; border: 1px solid var(--trait); border-radius: 4px; padding: 3px 4px; accent-color: var(--accent); }}
label.case {{ align-items: flex-start; }}
label.case input {{ margin: 2px 0 0; accent-color: var(--accent); }}
output {{ min-width: 38px; text-align: right; font-variant-numeric: tabular-nums; }}
#info {{ margin: 8px 0 6px; padding: 6px 8px; font-variant-numeric: tabular-nums; background: rgba(232, 223, 200, .05); border-left: 2px solid var(--accent); }}
.aide {{ margin: 0; color: var(--papier-2); font-size: 12.5px; }}
.aide kbd {{ font: 700 12px/1 'Barlow Condensed', sans-serif; color: var(--accent); }}
#rappel {{ position: fixed; left: 12px; top: 12px; z-index: 10; padding: 4px 8px; font-size: 13px; color: var(--papier-2); background: var(--panneau); border: 1px solid var(--trait); border-radius: 4px; }}
</style></head><body>
<div id="scene" class="reel"><iframe id="hud" title="Couche HUD du jeu"></iframe></div>
<aside id="panneau" aria-label="Réglages de la comparaison">
  <h1>HUD · 16:9 et 21:9</h1>
  <p class="sous">Couche HUD du jeu 2.0.6 (vrais styles, vrai module des points), valeurs d'exemple, sans la scène 3D. Rien de cela n'est dans le jeu.</p>
  <fieldset><legend>Propositions</legend>
    <div class="presets">
      <button type="button" data-preset="0"><kbd>1</kbd>Actuel</button>
      <button type="button" data-preset="1"><kbd>2</kbd>Zone 16:9</button>
      <button type="button" data-preset="2"><kbd>3</kbd>Échelle unique</button>
      <button type="button" data-preset="3"><kbd>4</kbd>Les deux</button>
    </div>
  </fieldset>
  <fieldset><legend>Réglages (piste de personnalisation)</legend>
    <label><span>Zone du HUD</span><select id="c-zone"><option value="plein">Plein écran (actuel)</option><option value="21:9">Zone 21:9</option><option value="16:9">Zone 16:9</option></select></label>
    <label><span>Échelle</span><select id="c-echelle"><option value="actuelle">Mixte (actuelle)</option><option value="unique">Unique (hauteur ÷ 1080)</option></select></label>
    <label><span>Taille</span><input type="range" id="c-taille" min="0.8" max="1.3" step="0.05" value="1"><output id="c-taille-v">100 %</output></label>
    <label class="case"><input type="checkbox" id="c-tout"> Échelle aussi pour l'invite, les bonus, le lieu, la bannière, la mini-carte et la boussole</label>
  </fieldset>
  <fieldset><legend>Vue</legend>
    <label><span>Carte</span><select id="c-scene"><option value="bunker">Bunker 7 (invite, bonus)</option><option value="khamsin">Khamsin (mini-carte, boussole)</option></select></label>
    <label><span>Écran</span><select id="c-ecran">
      <option value="reel">Écran réel (cette fenêtre)</option>
      <option value="1280x720">1280 × 720 (16:9)</option><option value="1920x1080">1920 × 1080 (16:9)</option>
      <option value="2560x1440">2560 × 1440 (16:9)</option><option value="3840x2160">3840 × 2160 (16:9)</option>
      <option value="2560x1080">2560 × 1080 (21:9)</option><option value="3440x1440">3440 × 1440 (21:9)</option>
      <option value="5120x1440">5120 × 1440 (32:9)</option></select></label>
    <label class="case"><input type="checkbox" id="c-cadre"> Cadre de la zone 16:9</label>
    <label class="case"><input type="checkbox" id="c-mesures"> Distances au centre (parcours du regard)</label>
    <label class="case"><input type="checkbox" id="c-boss"> Jauge du boss : emplacement réservé</label>
  </fieldset>
  <div id="info">…</div>
  <p class="aide"><kbd>1</kbd>–<kbd>4</kbd> propositions · <kbd>H</kbd> cacher ce panneau · <kbd>P</kbd> plein écran.
  En « écran réel », mettre le navigateur en plein écran et son zoom à 100 % (Ctrl+0) : la page montre alors le HUD tel que le jeu l'afficherait sur cet écran, mise à l'échelle de Windows comprise.</p>
</aside>
<div id="rappel" hidden><kbd>H</kbd> réglages</div>
{script('const HUD_DOC = ' + doc_js + ';')}
{script(lire(os.path.join(ICI, 'comparaison.js')))}
</body></html>
"""
open(os.path.join(OUT, 'comparaison-hud.html'), 'w', encoding='utf-8').write(comparaison)

# ------------------------------------------------------------------ champ de vision : table des deux modes
A0 = 16 / 9
tn = lambda deg: math.tan(math.radians(deg) / 2)
dg = lambda x: math.degrees(2 * math.atan(x))
def modes(H, a):
    """Mode actuel (horizontal fixe) et mode Hor+ (champ d'un écran 16:9, élargi au-delà) : (horizontal, vertical)."""
    v_act = dg(tn(H) / a)
    v_hp = dg(tn(H) / min(a, A0))
    return (H, v_act), (dg(tn(v_hp) * a), v_hp)
ECRANS = [('4:3', 1024, 768), ('16:10', 1920, 1200), ('16:9', 2560, 1440), ('21:9', 2560, 1080), ('21:9', 3440, 1440), ('32:9', 5120, 1440)]
lignes = ['| Écran | Réglage | Actuel : horizontal × vertical | Hor+ : horizontal × vertical | Tailles à l\'écran, Hor+ / actuel | Étirement des bords (1 / cos), actuel → Hor+ |',
          '|---|---|---|---|---|---|']
for nom, w, h in ECRANS:
    for H in (70, 90, 115):
        (ha, va), (hh, vh) = modes(H, w / h)
        k = tn(va) / tn(vh)
        e1, e2 = 1 / math.cos(math.radians(ha / 2)), 1 / math.cos(math.radians(hh / 2))
        lignes.append(f'| {nom} {w} × {h} | {H} | {fr(ha)}° × {fr(va)}° | {fr(hh)}° × {fr(vh)}° | ×{fr(k, 2)} | {fr(e1, 2)} → {fr(e2, 2)} |')
open(os.path.join(OUT, 'fov.md'), 'w', encoding='utf-8').write('\n'.join(lignes) + '\n')

# ------------------------------------------------------------------ schéma du champ de vision (géométrie exacte)
A219, H = 3440 / 1440, 90
(_, v169), _ = modes(H, A0)
(_, v219), (hplus, _) = modes(H, A219)
k = tn(v169) / tn(v219)
F = {'169': (tn(H), tn(H) / A0), 'vm': (tn(H), tn(H) / A219), 'hp': (tn(H) / A0 * A219, tn(H) / A0)}
U, cx, cy = 560, 900, 372
def rect(w, h, cls):
    return f'<rect class="{cls}" x="{cx - w * U:.1f}" y="{cy - h * U:.1f}" width="{2 * w * U:.1f}" height="{2 * h * U:.1f}"/>'
def silhouette(x, y, s, cls='sil'):
    hh = 0.18 * s                               # silhouette d'1,8 m vue à 10 m : 0,18 unité du plan image
    return (f'<g class="{cls}"><circle cx="{x:.1f}" cy="{y - hh * 0.9:.1f}" r="{hh * 0.1:.1f}"/>'
            f'<rect x="{x - hh * 0.13:.1f}" y="{y - hh * 0.8:.1f}" width="{hh * 0.26:.1f}" height="{hh * 0.45:.1f}" rx="{hh * 0.05:.1f}"/>'
            f'<rect x="{x - hh * 0.11:.1f}" y="{y - hh * 0.36:.1f}" width="{hh * 0.09:.1f}" height="{hh * 0.36:.1f}"/>'
            f'<rect x="{x + hh * 0.02:.1f}" y="{y - hh * 0.36:.1f}" width="{hh * 0.09:.1f}" height="{hh * 0.36:.1f}"/></g>')
def ecran(x0, y0, wpx, hpx, half_w, half_h, titre, sous):
    s = (hpx / 2) / half_h                      # px (réduits) par unité du plan image
    sx, sy = x0 + wpx / 2, y0 + hpx / 2
    out = [f'<g><rect class="ecr" x="{x0}" y="{y0}" width="{wpx}" height="{hpx}"/>',
           f'<clipPath id="c{x0}"><rect x="{x0}" y="{y0}" width="{wpx}" height="{hpx}"/></clipPath><g clip-path="url(#c{x0})">',
           f'<rect x="{x0}" y="{y0}" width="{wpx}" height="{hpx / 2}" fill="#1d2023"/><rect x="{x0}" y="{sy}" width="{wpx}" height="{hpx / 2}" fill="#2a2620"/>']
    for d in (2, 3, 4, 6, 10, 20):              # lignes du sol à d m (yeux à 1,7 m) et du plafond (3 m)
        yy = sy + (1.7 / d) * s
        if yy < y0 + hpx: out.append(f'<line class="sol" x1="{x0}" x2="{x0 + wpx}" y1="{yy:.1f}" y2="{yy:.1f}"/>')
        yy = sy - (1.3 / d) * s
        if yy > y0: out.append(f'<line class="pla" x1="{x0}" x2="{x0 + wpx}" y1="{yy:.1f}" y2="{yy:.1f}"/>')
    for gx in range(-12, 13):                   # piliers tous les 1,5 m à 6 m de distance
        xx = sx + (gx * 1.5 / 6) * s
        out.append(f'<line class="pil" x1="{xx:.1f}" x2="{xx:.1f}" y1="{sy - (1.3 / 6) * s:.1f}" y2="{sy + (1.7 / 6) * s:.1f}"/>')
    out.append(silhouette(sx - 0.05 * s, sy + (1.7 / 10) * s, s))
    out.append(silhouette(sx + 0.62 * s, sy + (1.7 / 10) * s, s, 'sil bord'))
    out.append('</g>')
    out.append(f'<text class="t" x="{x0}" y="{y0 - 34}">{titre}</text><text class="s" x="{x0}" y="{y0 - 12}">{sous}</text></g>')
    return ''.join(out)
schema = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>{polices}
body {{ margin: 0; background: #0b0d0c; color: #e8dfc8; font-family: 'Barlow Condensed', sans-serif; }}
svg {{ display: block; }}
.f169 {{ fill: none; stroke: #e8dfc8; stroke-width: 3; }}
.fvm {{ fill: rgba(226, 49, 58, .12); stroke: #e2313a; stroke-width: 3; }}
.fhp {{ fill: none; stroke: #8dff74; stroke-width: 3; stroke-dasharray: 14 9; }}
.lab {{ font-size: 24px; font-weight: 600; }} .num {{ font-size: 20px; fill: #c9bd9f; }}
.t {{ font-size: 26px; font-weight: 700; fill: #e8dfc8; letter-spacing: .04em; }} .s {{ font-size: 19px; fill: #c9bd9f; }}
.ecr {{ fill: none; stroke: #e8dfc8; stroke-width: 2; }}
.sol {{ stroke: rgba(232, 223, 200, .25); stroke-width: 1.5; }} .pla {{ stroke: rgba(160, 200, 255, .18); stroke-width: 1.5; }}
.pil {{ stroke: rgba(214, 173, 87, .35); stroke-width: 2; }}
.sil {{ fill: #b8141d; }} .sil.bord {{ fill: #d6ad57; }}
h1 {{ font-family: 'Big Shoulders Stencil Display', sans-serif; font-weight: 900; font-size: 44px; margin: 26px 40px 4px; letter-spacing: .04em; text-transform: uppercase; }}
p {{ margin: 0 40px 10px; font-size: 21px; color: #c9bd9f; max-width: 1700px; line-height: 1.35; }}
</style></head><body>
<h1>Champ de vision : les deux modes (réglage 90°)</h1>
<p>Géométrie exacte (projection du jeu), scène fictive : piliers à 6 m, silhouettes d'1,80 m à 10 m, yeux à 1,70 m, plafond à 3 m.
Mode actuel : le réglage fixe le champ horizontal de l'écran ; en 21:9, la vue perd du haut et du bas et tout est grossi ×{fr(k, 2)}.
Mode Hor+ : le réglage fixe le champ d'un écran 16:9 ; sur un écran plus large, la vue garde la hauteur du 16:9 et s'élargit. Jusqu'au 16:9, les deux modes sont identiques.</p>
<svg width="1800" height="1720" viewBox="0 0 1800 1720">
  {rect(*F['hp'], 'fhp')}{rect(*F['169'], 'f169')}{rect(*F['vm'], 'fvm')}
  <text class="lab" x="{cx - F['hp'][0] * U + 8:.0f}" y="{cy - F['hp'][1] * U - 12:.0f}" fill="#8dff74">21:9, mode Hor+ : {fr(hplus)}° × {fr(v169)}°</text>
  <text class="lab" x="{cx - F['169'][0] * U + 8:.0f}" y="{cy - F['169'][1] * U + 30:.0f}" fill="#e8dfc8">16:9, les deux modes : 90,0° × {fr(v169)}°</text>
  <text class="lab" x="{cx - F['vm'][0] * U + 8:.0f}" y="{cy + F['vm'][1] * U - 12:.0f}" fill="#e2313a">21:9, mode actuel : 90,0° × {fr(v219)}° (bande grossie ×{fr(k, 2)} pour remplir l'écran)</text>
  <text class="num" x="{cx:.0f}" y="{cy + F['hp'][1] * U + 34:.0f}" text-anchor="middle">Le cadre est le plan de l'image : ce que chaque caméra voit, à la même échelle.</text>
  {ecran(40, 870, 640, 360, F['169'][0], F['169'][1], '16:9 · 2560 × 1440', f'90,0° × {fr(v169)}° : les deux modes')}
  {ecran(720, 870, 860, 360, F['vm'][0], F['vm'][1], '21:9 · 3440 × 1440 · mode actuel', f'90,0° × {fr(v219)}° : tout est grossi ×{fr(k, 2)}, haut et bas coupés')}
  {ecran(470, 1340, 860, 360, F['hp'][0], F['hp'][1], '21:9 · 3440 × 1440 · mode Hor+', f'{fr(hplus)}° × {fr(v169)}° : mêmes tailles qu’en 16:9, côtés en plus')}
</svg></body></html>"""
open(os.path.join(OUT, 'schema-fov.html'), 'w', encoding='utf-8').write(schema)

# ------------------------------------------------------------------ planches des captures (faites par capture.js)
TETE = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>{polices}
body {{ margin: 0; padding: 20px 30px 30px; background: #0b0d0c; color: #e8dfc8; font-family: 'Barlow Condensed', sans-serif; width: 1740px; }}
h1 {{ font-family: 'Big Shoulders Stencil Display', sans-serif; font-weight: 900; font-size: 40px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; }}
p {{ margin: 0 0 16px; font-size: 19px; color: #c9bd9f; }}
.g {{ display: grid; gap: 18px; }} .g2 {{ grid-template-columns: 1fr 1fr; }} figure {{ margin: 0; }}
img {{ display: block; width: 100%; height: auto; box-shadow: 0 0 0 1px rgba(232,223,200,.25); }}
figcaption {{ font-size: 20px; font-weight: 600; margin-top: 6px; }}
h2 {{ margin: 6px 0 0; font-size: 22px; letter-spacing: .1em; text-transform: uppercase; color: #c9bd9f; }}</style></head><body>"""
fig = lambda f, c: f'<figure><img src="captures/{f}.png"><figcaption>{c}</figcaption></figure>'
planche = TETE + """<h1>HUD : zone 16:9 et échelle unique (3440 × 1440)</h1>
<p>Vrais styles du jeu 2.0.6, vrai module des points, polices du jeu ; valeurs d'exemple, fond neutre quadrillé (100 px), sans la scène 3D. Cadre bleu : zone 16:9.</p>
<div class="g">""" + ''.join(fig(f, c) for f, c in [
    ('actuel-khamsin-2560x1440', 'Référence · 2560 × 1440 (16:9, même hauteur que l’écran 21:9) · HUD actuel'),
    ('actuel-khamsin-3440x1440', '3440 × 1440 · HUD actuel'),
    ('p1-khamsin-3440x1440', 'Proposition 1 · zone 16:9 : les coins reviennent là où ils sont en 2560 × 1440'),
    ('p2-khamsin-3440x1440', 'Proposition 2 · échelle unique : manche, atouts et arme suivent la hauteur, comme le module des points (×1,33 en 1440p)'),
    ('p12-khamsin-3440x1440', 'Propositions 1 et 2'),
    ('p12-boss-bunker-3440x1440', 'Propositions 1 et 2 sur Bunker 7, avec l’emplacement réservé de la jauge du boss (contenu à définir avec la session Bunker 7)'),
]) + '</div></body></html>'
open(os.path.join(OUT, 'planche-hud.html'), 'w', encoding='utf-8').write(planche)
TAILLES = [('1280x720', '1280 × 720 (fenêtre du jeu par défaut)'), ('1920x1080', '1920 × 1080'), ('2560x1440', '2560 × 1440'), ('3840x2160', '3840 × 2160 (4K à 100 %)')]
echelle = TETE + """<h1>HUD : échelle actuelle et échelle unique (16:9)</h1>
<p>Chaque capture est réduite à la même largeur : à gauche, la manche, les atouts et l'arme rapetissent quand la hauteur de l'écran grandit, alors que le portrait suit la hauteur ; à droite, tout garde les proportions du 1080p (règle du module des points : 6,4 % de la hauteur, de 52 à 120 px).</p>
<div class="g g2"><h2>Échelle actuelle (mixte)</h2><h2>Échelle unique</h2>""" + ''.join(
    fig(f'actuel-bunker-{t}', c) + fig(f'p2-bunker-{t}', c) for t, c in TAILLES) + '</div></body></html>'
open(os.path.join(OUT, 'planche-echelle.html'), 'w', encoding='utf-8').write(echelle)
print(f'pages écrites dans {OUT} : hud.html ({len(doc_hud) // 1024} Ko), comparaison-hud.html ({len(comparaison) // 1024} Ko), '
      f'schema-fov.html, fov.md, planche-hud.html, planche-echelle.html')
print(f'champ vertical à 90 : 16:9 {fr(v169, 2)}°, 21:9 actuel {fr(v219, 2)}°, 21:9 Hor+ horizontal {fr(hplus, 2)}° ; grossissement ×{fr(k, 3)}')
