#!/usr/bin/env python3
"""Sans usage depuis le jeu 2.0.5 : les reflets calculés d'avance sont retirés (le module les préfiltre au
chargement, comme dans le fichier) ; outil gardé pour mémoire.
Jeu 2.0.4 : src/P2-khepesh-reflets.js = les reflets du bronze du khépesh, calculés d'avance.
Le fichier d'Anthony dessine une « salle chaude éclairée aux torches » (texEnvironnement) et la
préfiltre au chargement avec THREE.PMREMGenerator (three r128). On croyait que ce préfiltrage prenait 25 à
30 s en rendu logiciel ; mesuré ensuite : 1 à 2 s (le reste est la compilation des matières du bronze). Ici : le même code (texte exact du fichier, extrait
de orig/khepesh-melee.js) passe une fois dans PMREMGenerator (Chromium sans tête), l'image cubeUV
obtenue (768 × 768, sRGB, 8 bits) est relue et rangée sans perte (WebP sans perte, vérifié).
Usage : make-khepesh-env.py [--keep-raw]   (le jeu doit être dans launcher/game : prepare-game.js)"""
import base64, hashlib, io, json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
KH = os.path.dirname(HERE)
ORIG = os.path.join(KH, 'orig', 'khepesh-melee.js')
OUT = os.path.join(KH, 'src', 'P2-khepesh-reflets.js')
s = open(ORIG, encoding='utf-8').read()
def cut(a, b):
    assert s.count(a) == 1, a
    i = s.index(a); return s[i:s.index(b, i)]
body = (cut('    function toile(w, h) {', '    function texCouleur(tex) {')
        + cut('    function texCouleur(tex) {', '    /* ------------------------------------------------------- textures procédurales */')
        + cut('    function texEnvironnement() {', '    var tex = { bronze:') + r'''
var pm = new THREE.PMREMGenerator(renderer);
var envTex = texEnvironnement();
var rt = pm.fromEquirectangular(envTex);
const W = rt.width, H = rt.height, buf = new Uint8Array(W * H * 4);
renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
const tx = rt.texture;
let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
return { W, H, mapping: tx.mapping, encoding: tx.encoding, format: tx.format, type: tx.type, minF: tx.minFilter, magF: tx.magFilter, b64: btoa(bin) };
''')
gen = os.path.join(HERE, 'khepesh-env', 'envgen.js')        # fichier de travail (ignoré par git)
os.makedirs(os.path.dirname(gen), exist_ok=True)
open(gen, 'w', encoding='utf-8').write(body)
r = subprocess.run(['node', os.path.join(HERE, 'tzeval.js'), gen], capture_output=True, text=True, timeout=900)
txt = r.stdout
j = json.loads(txt[:txt.rindex('}') + 1])
assert (j['W'], j['H'], j['mapping'], j['encoding'], j['format'], j['type'], j['minF'], j['magF']) == (768, 768, 306, 3001, 1023, 1009, 1003, 1003), {k: v for k, v in j.items() if k != 'b64'}
raw = base64.b64decode(j['b64'])
alpha = raw[3::4]
assert set(alpha) <= {0, 255}, 'alpha inattendu'
rgb = bytes(b for i in range(0, len(raw), 4) for b in raw[i:i + 3])
# lignes dans l'ordre de readPixels (bas en haut) : la texture est chargée avec flipY = false
im = Image.frombytes('RGB', (768, 768), rgb)
bio = io.BytesIO(); im.save(bio, 'WEBP', lossless=True, quality=100, method=6)
webp = bio.getvalue()
assert Image.open(io.BytesIO(webp)).convert('RGB').tobytes() == rgb, 'WebP pas sans perte'
sha_rgb = hashlib.sha256(rgb).hexdigest()
b64 = base64.b64encode(webp).decode('ascii')
lines = [b64[i:i + 2000] for i in range(0, len(b64), 2000)]
js = ('/* -------------------------------------------- Khépesh : reflets du bronze (2.0.4) ---\n'
      '   La « salle chaude éclairée aux torches » du fichier d\'Anthony (texEnvironnement : reflets dorés du\n'
      '   bronze), préfiltrée par THREE.PMREMGenerator de three r128 exactement comme le module le fait à son\n'
      '   chargement, calculée une fois pour toutes (tools/make-khepesh-env.py) : image cubeUV de 768 × 768,\n'
      '   sRGB, lignes de bas en haut (flipY : false), rangée sans perte en WebP. Au chargement de Khamsin,\n'
      '   le préfiltrage prenait 25 à 30 s en rendu logiciel (compilation des shaders de flou) ; le résultat\n'
      '   est le même, au pixel près. Empreinte des pixels RGB : ' + sha_rgb[:8] + '…' + sha_rgb[-4:] + '. */\n'
      'const KHEPESH_ENV_SRC = \'data:image/webp;base64,\'\n'
      + ''.join(f"  + '{l}'\n" for l in lines).rstrip('\n') + ';\n'
      '/* Texture des reflets (une seule, partagée) : CubeUVReflectionMapping, comme la sortie de PMREMGenerator. */\n'
      'function khepeshEnv() {\n'
      '  if (KHEPESH.env) return KHEPESH.env;\n'
      '  const img = new Image();\n'
      '  const t = new THREE.Texture(img);\n'
      '  t.mapping = THREE.CubeUVReflectionMapping; t.encoding = THREE.sRGBEncoding;\n'
      '  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false;\n'
      '  t.name = \'khepesh.env\';\n'
      '  img.onload = () => { t.needsUpdate = true; KHEPESH.envReady = true; };\n'
      '  img.src = KHEPESH_ENV_SRC;\n'
      '  return (KHEPESH.env = share(t));\n'
      '}\n')
open(OUT, 'w', encoding='utf-8').write(js)
print(f'{OUT} : {len(js.encode())} octets (WebP {len(webp)} octets), pixels RGB {sha_rgb}')
