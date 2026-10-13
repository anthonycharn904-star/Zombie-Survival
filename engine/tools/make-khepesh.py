#!/usr/bin/env python3
"""Jeu 2.0.4 : src/P0-khepesh.js = le fichier d'Anthony (orig/khepesh-melee.js, 1 241 lignes,
2c656871…c412) avec les seuls changements d'intégration, comme pour le couteau « Fossoyeur » :
fonction du script du jeu, son dans le bus des effets du jeu, couleurs sRGB → linéaire, debug.jouer,
nettoyer(). Modèle, animations, sang, sons et réglages restent ceux du fichier.
Chaque remplacement doit trouver son texte exactement une fois."""
import hashlib, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KH = os.path.dirname(HERE)
SRC = os.path.join(KH, 'orig', 'khepesh-melee.js')
OUT = os.path.join(KH, 'src', 'P0-khepesh.js')
SHA = '2c656871a460e93475fce631b73bcfe67698bd1aab143609a5dd1926ca8bc412'

raw = open(SRC, 'rb').read()
if hashlib.sha256(raw).hexdigest() != SHA:
    sys.exit('fichier du khépesh inattendu (empreinte)')
s = raw.decode('utf-8')

def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f'REMPLACEMENT INTROUVABLE ({n} au lieu de 1) :\n{old[:300]}')
    s = s.replace(old, new)

# 1. fonction du script du jeu (plus de window.creerKhepesh) ; note d'intégration dans l'en-tête
rep("""     getSol(zombie)               y du sol sous ce zombie (flaques à la bonne hauteur)
   ========================================================================== */
(function (global) {
  'use strict';
""", """     getSol(zombie)               y du sol sous ce zombie (flaques à la bonne hauteur)
   Intégré au jeu 2.0.4 le 13 octobre 2026 (demande d'Anthony : arme de corps-à-corps principale de la
   deuxième carte, Khamsin, « identique au fichier ») : fonction du script du jeu (plus de
   window.creerKhepesh) ; option audio : le contexte et le bus des effets du jeu (volume général, son
   étouffé, compresseur) au lieu d'un contexte à part ; couleurs du fichier converties de sRGB en
   linéaire (three r128 sans gestion des couleurs, comme pour le couteau) ; debug.jouer(nom) pour les
   essais ; nettoyer() efface le sang (gouttes, flaques, saignements) au changement de carte et à chaque
   partie. Modèle, animations, sang, sons et réglages : ceux du fichier. Réglages et règles du jeu :
   KHEPESH, buildKhepesh, khepeshChoose (bloc suivant, « Khépesh : règles du jeu »).
   ========================================================================== */
const creerKhepesh = (function () {
  'use strict';
""")
rep("""  global.creerKhepesh = creerKhepesh;
  if (typeof module !== 'undefined' && module.exports) module.exports = creerKhepesh;
})(typeof window !== 'undefined' ? window : globalThis);
""", """  return creerKhepesh;
})();
""")

# 2. son du jeu : son contexte et son bus des effets (option audio, comme le couteau)
rep("""      volume: 0.7,
      secousseCamera: true,""", """      volume: 0.7,
      audio: null,              // function() → { ctx, sortie } : contexte et bus du jeu (null tant qu'il n'y en a pas)
      secousseCamera: true,""")
rep("""    var audio = { ctx: null, maitre: null, bruit: null };
    function ctxAudio() {
      if (!o.son) return null;
      if (!audio.ctx) {
        var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        try { audio.ctx = new AC(); } catch (e) { return null; }
        audio.maitre = audio.ctx.createGain(); audio.maitre.gain.value = o.volume; audio.maitre.connect(audio.ctx.destination);
        var n = audio.ctx.sampleRate, b = audio.ctx.createBuffer(1, n, n), d = b.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        audio.bruit = b;
      }
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return audio.ctx;
    }""", """    var audio = { ctx: null, maitre: null, bruit: null, externe: false };
    function ctxAudio() {
      if (!o.son) return null;
      if (!audio.ctx) {
        var sortie = null;
        if (o.audio) {
          // son du jeu : son contexte et son bus des effets (rien tant que le jeu n'a pas de son)
          var ext = o.audio();
          if (!ext || !ext.ctx) return null;
          audio.ctx = ext.ctx; audio.externe = true; sortie = ext.sortie || null;
        } else {
          var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
          if (!AC) return null;
          try { audio.ctx = new AC(); } catch (e) { return null; }
        }
        audio.maitre = audio.ctx.createGain(); audio.maitre.gain.value = o.volume; audio.maitre.connect(sortie || audio.ctx.destination);
        var n = audio.ctx.sampleRate, b = audio.ctx.createBuffer(1, n, n), d = b.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        audio.bruit = b;
      }
      if (audio.ctx.state === 'closed') return null;
      if (audio.ctx.state === 'suspended' && !audio.externe) audio.ctx.resume();   // le contexte du jeu, c'est le jeu qui le gère
      return audio.ctx;
    }""")
rep("""        if (audio.ctx && audio.ctx.close) audio.ctx.close();""",
    """        if (audio.ctx && audio.ctx.close && !audio.externe) audio.ctx.close();""")

# 3. couleurs : three r128 (celui du jeu) n'a pas de gestion des couleurs ; le jeu donne ses couleurs en
#    sRGB et les convertit en linéaire (rendu en sRGB) : même traitement que pour le couteau
rep("""      flaque: new THREE.MeshStandardMaterial({ color: 0x1c0202, metalness: 0.1, roughness: 0.16, transparent: true, opacity: 0.94, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    };
    if (o.couleurs) {""", """      flaque: new THREE.MeshStandardMaterial({ color: 0x1c0202, metalness: 0.1, roughness: 0.16, transparent: true, opacity: 0.94, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    };
    // three.js sans gestion des couleurs (r128, celui du jeu) : les couleurs ci-dessus sont des sRGB, à
    // convertir comme le jeu le fait pour ses matières (comme pour le couteau)
    if (!(THREE.ColorManagement && THREE.ColorManagement.enabled)) {
      Object.keys(M).forEach(function (k) { if (M[k].color) M[k].color.convertSRGBToLinear(); });
    }
    if (o.couleurs) {""")

# 4. essais (debug.jouer) ; nettoyer() : sang effacé au changement de carte et à chaque partie
rep("""        duree: DUREE, contact: T_CONTACT, poses: POSES, seq: SEQ, branche: function () { return branche; }
      },
      detruire: function () {""", """        duree: DUREE, contact: T_CONTACT, poses: POSES, seq: SEQ, branche: function () { return branche; },
        jouer: jouer
      },
      // jeu : efface le sang de la scène (gouttes, flaques, saignements en cours, lame) ; au changement de
      // carte et à chaque partie (les particules et les flaques sont dans la scène du monde)
      nettoyer: function () {
        for (var k = 0; k < NP; k++) { pVie[k] = 0; pAlpha[k] = 0; pPos[k * 3 + 1] = -9999; }
        geoP.attributes.position.needsUpdate = true; geoP.attributes.aAlpha.needsUpdate = true;
        for (var f = 0; f < NF; f++) { fl[f].vie = 0; fl[f].r = 0; flaques.setMatrixAt(f, mF.makeScale(0, 0, 0)); }
        flaques.instanceMatrix.needsUpdate = true;
        saignes.length = 0; touches = []; impacts.length = 0;
        sangLame = 0; delaiSechage = 0; M.sang.opacity = 0; M.sang.visible = false;
      },
      detruire: function () {""")

open(OUT, 'w', encoding='utf-8').write(s)
print(f'{OUT} : {len(s.encode("utf-8"))} octets, {s.count(chr(10))} lignes')
