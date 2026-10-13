/* ==========================================================================
   KHÉPESH — épée-faucille de bronze, arme de mêlée de base de la carte Égypte
   --------------------------------------------------------------------------
   Modèle établi d'après les pièces de musée :
     · longueur totale 57,5 cm (Louvre E 25689, au nom de Ramsès II ; Toutânkhamon : 59,5 cm)
     · poignée de 12,5 cm, plaquettes d'ébène (poignée noire du khépesh de Toutânkhamon)
     · fût droit et émoussé de 2,3 cm de large, gravé d'un lotus sur une longue tige
     · lame en croissant de 5 cm de large (4,8 à 5,6 cm selon les pièces), tranchante sur le bord
       convexe seulement ; la courbe intérieure et le bout restent émoussés (ils crochètent un
       bouclier ou un bras) ; une longue rainure gravée suit la courbe
     · une seule pièce de bronze coulé (poignée, fût, lame)
   Touche V : taille plongeante en diagonale, résultat décidé quand la lame arrive :
     TOUCHÉ : la lame mord (gel d'impact), le crochet tire dans la plaie, arrachage, secoué du sang
     RATÉ   : la lame passe dans le vide, l'élan emporte le bras vers le bas, rattrapage en revers
   Jusqu'à 3 zombies dans l'arc (dégâts 100 / 75 / 50 %, du plus proche au plus loin).
   Chaque zombie tranché saigne : gerbe, jets pulsés, plaie qui coule pendant qu'il marche,
   flaques et traînées au sol, et des dégâts pendant quelques secondes (onSaignement).
   Compatible three.js r128 → r16x. Script classique : définit window.creerKhepesh.

   Un appui pendant la taille, après l'impact, est gardé : la taille suivante part dès que le
   retour en garde le permet (enchainement: true).
   Intégration : mêmes principes que le couteau Fossoyeur (update(dt) après la rotation de la
   caméra, abaissementArme pour ton arme, occupe pour bloquer le tir). En plus :
     onHit(zombie, info)          info.degats (déjà multipliés par info.facteur), info.rang
     onSaignement(zombie, degats) retire ces PV ; renvoie false si le zombie n'existe plus
     getSol(zombie)               y du sol sous ce zombie (flaques à la bonne hauteur)
   ========================================================================== */
(function (global) {
  'use strict';

  function creerKhepesh(THREE, options) {
    if (!THREE) throw new Error('creerKhepesh : passe l’objet THREE en premier argument');
    var o = Object.assign({
      camera: null,             // THREE.PerspectiveCamera du joueur (obligatoire)
      scene: null,              // THREE.Scene (obligatoire)
      renderer: null,           // conseillé : reflets du bronze et taille des particules
      touche: 'KeyV',
      ecouterClavier: true,     // false si tu appelles toi-même khepesh.frapper()
      portee: 2.4,              // m entre l'œil du joueur et la surface du zombie (lame de 57 cm)
      angleCone: 62,            // ° demi-angle de l'arc de taille
      ciblesMax: 3,             // zombies tranchés par coup, au plus
      facteurs: [1, 0.75, 0.5], // part des dégâts du 1er, 2e, 3e zombie (du plus proche au plus loin)
      degats: 150,
      saignement: { part: 0.5, duree: 4, pas: 0.5 },   // PV retirés = part × dégâts du coup, sur « duree » s, par tranches de « pas » s
      onSaignement: null,       // function(zombie, degats, info) : retire ces PV ; renvoyer false arrête le saignement
      vueSeparee: false,        // true : le bras a sa propre scène et sa propre caméra → khepesh.rendreVue(renderer)
      fovVue: 72,               // champ vertical (°) de cette vue ; les poses sont réglées pour 72°
      choisirCible: null,       // function('contact') → [{ cible, point, rayon }, …] ; sinon recherche interne (getTargets)
      couleurs: null,           // { gant: 0x3b2a1d, manche: 0x4f5638 } : couleurs sRGB des bras du jeu
      enchainement: true,       // un nouvel appui pendant le retour en garde relance un coup aussitôt
      getTargets: function () { return []; },
      getHitPoint: null,        // function(zombie) -> THREE.Vector3 monde (sinon position + hauteurImpact)
      getSol: null,             // function(zombie) -> y du sol sous ce zombie (sinon hauteurSol)
      hauteurImpact: 1.3,
      rayonCible: 0.35,
      bloque: null,             // function(origine, point) -> true si un mur bloque le coup
      onHit: null,              // function(zombie, info)
      onMiss: null,
      gravite: 9.81,
      hauteurSol: null,
      son: true,
      volume: 0.7,
      secousseCamera: true,
      secousseFOV: true,
      modeCamera: 'reinitialise',
      envMap: null
    }, options || {});
    o.saignement = Object.assign({ part: 0.5, duree: 4, pas: 0.5 }, o.saignement || {});

    var camera = o.camera, scene = o.scene;
    if (!camera || !scene) throw new Error('creerKhepesh : camera et scene sont obligatoires');
    if (!camera.parent && !o.vueSeparee) scene.add(camera);

    var V3 = THREE.Vector3, Q = THREE.Quaternion;
    var DEG = Math.PI / 180;

    /* ------------------------------------------------------------------ outils */
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function lisse(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function alea(seed) {
      var s = seed >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0; var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function interp(pts, x) { // Catmull-Rom sur une liste [[x,y],...] triée
      if (x <= pts[0][0]) return pts[0][1];
      var n = pts.length;
      if (x >= pts[n - 1][0]) return pts[n - 1][1];
      var i = 0; while (i < n - 2 && x > pts[i + 1][0]) i++;
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      var t = (x - p1[0]) / (p2[0] - p1[0]);
      var m1 = (p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1) * (p2[0] - p1[0]);
      var m2 = (p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1) * (p2[0] - p1[0]);
      var t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
    }
    var E = {
      lin: function (t) { return t; },
      inQuad: function (t) { return t * t; },
      outQuad: function (t) { return t * (2 - t); },
      inCubic: function (t) { return t * t * t; },
      outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
      inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
      outQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
      inQuart: function (t) { return t * t * t * t; },
      outExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
      inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
      outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
      inBack: function (t) { var c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; }
    };
    function toile(w, h) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    function texCouleur(tex) {
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    /* ------------------------------------------------------- textures procédurales */
    function texBronze() { // rugosité du bronze : polissage dans la longueur, piqûres, zones lustrées (roughnessMap)
      var c = toile(256, 512), g = c.getContext('2d'), r = alea(41);
      g.fillStyle = 'rgb(96,96,96)'; g.fillRect(0, 0, 256, 512);
      for (var i = 0; i < 900; i++) {                 // stries de polissage le long de la lame
        var v = 78 + r() * 40; g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.3)';
        g.lineWidth = 0.6 + r() * 1.4; var x = r() * 256, y = r() * 512;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 20 + r() * 90); g.stroke();
      }
      for (var j = 0; j < 260; j++) {                 // piqûres du métal coulé
        var px = r() * 256, py = r() * 512, pr = 0.6 + r() * 2.2;
        g.fillStyle = 'rgba(170,170,170,' + (0.2 + r() * 0.4) + ')'; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      }
      for (var k = 0; k < 14; k++) {                  // plages lustrées par l'usage
        var lx = r() * 256, ly = r() * 512, gr = g.createRadialGradient(lx, ly, 0, lx, ly, 30 + r() * 60);
        gr.addColorStop(0, 'rgba(40,40,40,0.45)'); gr.addColorStop(1, 'rgba(40,40,40,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    }
    function texEbene() { // ébène : brun noir, fil serré dans la longueur
      var c = toile(128, 512), g = c.getContext('2d'), r = alea(7);
      g.fillStyle = '#1b130d'; g.fillRect(0, 0, 128, 512);
      for (var i = 0; i < 140; i++) {
        var x = r() * 128, l = 0.5 + r() * 1.6, v = r();
        g.strokeStyle = v < 0.5 ? 'rgba(8,5,3,0.55)' : 'rgba(58,38,24,0.35)';
        g.lineWidth = l; g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 10, 170, x + (r() - 0.5) * 10, 340, x + (r() - 0.5) * 8, 512); g.stroke();
      }
      for (var j = 0; j < 90; j++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r() * 128, r() * 512, 1, 2 + r() * 4); }
      return texCouleur(new THREE.CanvasTexture(c));
    }
    function texLotus() { // gravure du fût : un lotus sur une longue tige (khépesh de Toutânkhamon)
      var c = toile(64, 512), g = c.getContext('2d');
      g.clearRect(0, 0, 64, 512);
      g.strokeStyle = 'rgba(38,46,24,0.92)'; g.fillStyle = 'rgba(38,46,24,0.92)'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(32, 506); g.bezierCurveTo(31, 380, 33, 250, 32, 150); g.stroke();      // tige
      g.lineWidth = 1.6;                                                                               // calice : deux sépales
      g.beginPath(); g.moveTo(32, 150); g.quadraticCurveTo(18, 140, 12, 112); g.quadraticCurveTo(24, 122, 32, 138); g.stroke();
      g.beginPath(); g.moveTo(32, 150); g.quadraticCurveTo(46, 140, 52, 112); g.quadraticCurveTo(40, 122, 32, 138); g.stroke();
      [[-14, 34], [-7, 26], [0, 22], [7, 26], [14, 34]].forEach(function (p) {                         // pétales en éventail
        g.beginPath(); g.moveTo(32, 136); g.quadraticCurveTo(32 + p[0] * 0.7, 136 - p[1] * 1.3, 32 + p[0] * 1.1, 136 - p[1] * 2.6); g.stroke();
      });
      g.beginPath(); g.moveTo(10, 86); g.quadraticCurveTo(32, 64, 54, 86); g.stroke();                  // arc qui ferme la corolle
      g.lineWidth = 1.2; g.strokeRect(3, 4, 58, 504);                                                   // filet du cadre
      return texCouleur(new THREE.CanvasTexture(c));
    }
    function texSang() { // sang sur la lame (alphaMap) : u = du dos (0) au tranchant (1), v = de la poignée (0) au bout (1)
      var c = toile(128, 512), g = c.getContext('2d'), r = alea(29);
      g.fillStyle = '#000'; g.fillRect(0, 0, 128, 512);
      for (var i = 0; i < 90; i++) {                  // le croissant, surtout près du tranchant
        var y = 20 + Math.pow(r(), 1.3) * 270, x = 40 + Math.pow(r(), 0.6) * 88, rx = 6 + r() * 22, ry = 8 + r() * 34;
        var gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)), a = 0.35 + r() * 0.55;
        gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      }
      for (var j = 0; j < 30; j++) {                  // coulures vers le dos et le long du fût
        var x0 = 30 + r() * 90, y0 = 60 + r() * 220, len = 40 + r() * 230, w = 1.5 + r() * 4.5;
        g.strokeStyle = 'rgba(255,255,255,' + (0.45 + r() * 0.5) + ')'; g.lineWidth = w; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x0, y0);
        g.bezierCurveTo(x0 - r() * 20, y0 + len * 0.3, x0 - r() * 30, y0 + len * 0.7, x0 - r() * 34, y0 + len); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x0 - 17, y0 + len, w * 1.3, 0, Math.PI * 2); g.fill();
      }
      return new THREE.CanvasTexture(c);
    }
    function texPoint() { // sprite rond doux
      var c = toile(64, 64), g = c.getContext('2d');
      var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    }
    function texEnvironnement() { // salle chaude éclairée aux torches : reflets dorés du bronze
      var c = toile(512, 256), g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#c7b496'); gr.addColorStop(0.4, '#6e5a44'); gr.addColorStop(0.52, '#35291d'); gr.addColorStop(1, '#0e0a07');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      function boite(x, y, w, h, coul, flou) {
        if ('filter' in g) g.filter = 'blur(' + flou + 'px)';
        g.fillStyle = coul; g.fillRect(x, y, w, h);
        if ('filter' in g) g.filter = 'none';
      }
      boite(80, 30, 110, 50, 'rgba(255,236,200,1)', 8);
      boite(330, 44, 30, 110, 'rgba(255,190,120,0.95)', 6);
      boite(190, 100, 270, 9, 'rgba(255,214,160,0.6)', 3);
      boite(12, 120, 46, 70, 'rgba(255,140,70,0.5)', 10);
      var t = new THREE.CanvasTexture(c);
      t.mapping = THREE.EquirectangularReflectionMapping;
      return texCouleur(t);
    }

    var tex = { bronze: texBronze(), ebene: texEbene(), lotus: texLotus(), sang: texSang(), point: texPoint() };
    var envMap = o.envMap;
    if (!envMap && o.renderer && THREE.PMREMGenerator) {
      try {
        var pm = new THREE.PMREMGenerator(o.renderer);
        var envTex = texEnvironnement();
        envMap = pm.fromEquirectangular(envTex).texture;
        envTex.dispose(); pm.dispose();
      } catch (e) { envMap = null; }
    }

    /* ---------------------------------------------------------------- matériaux */
    function mat(p) { var m = new THREE.MeshStandardMaterial(p); if (envMap) { m.envMap = envMap; } return m; }
    var M = {
      bronze: mat({ color: 0xc98f52, metalness: 1.0, roughness: 0.55, roughnessMap: tex.bronze, envMapIntensity: 1.6 }),
      fil: mat({ color: 0xf2c88e, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.5 }),
      patine: mat({ color: 0x6a4728, metalness: 0.85, roughness: 0.55, envMapIntensity: 0.7 }),
      ebene: mat({ color: 0xffffff, map: tex.ebene, metalness: 0.0, roughness: 0.4, envMapIntensity: 0.55 }),
      gravure: mat({ color: 0xffffff, map: tex.lotus, transparent: true, metalness: 0.5, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
      gant: mat({ color: 0x25272a, metalness: 0.0, roughness: 0.9, envMapIntensity: 0.45 }),
      gantPaume: mat({ color: 0x161719, metalness: 0.0, roughness: 0.68, envMapIntensity: 0.5 }),
      coque: mat({ color: 0x353c2f, metalness: 0.1, roughness: 0.5, envMapIntensity: 0.6 }),
      sangle: mat({ color: 0x4b5240, metalness: 0.0, roughness: 0.9, envMapIntensity: 0.35 }),
      veste: mat({ color: 0x2a3023, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.3 }),
      sang: mat({ color: 0x420404, metalness: 0.0, roughness: 0.24, transparent: true, opacity: 0, alphaMap: tex.sang, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, envMapIntensity: 0.55 }),
      flaque: new THREE.MeshStandardMaterial({ color: 0x1c0202, metalness: 0.1, roughness: 0.16, transparent: true, opacity: 0.94, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    };
    if (o.couleurs) {
      var enLin = function (hex) { var c = new THREE.Color(hex); return c.convertSRGBToLinear ? c.convertSRGBToLinear() : c; };
      if (o.couleurs.gant !== undefined) {
        M.gant.color.copy(enLin(o.couleurs.gant));
        M.gantPaume.color.copy(M.gant.color).multiplyScalar(0.6);
        M.coque.color.copy(M.gant.color).multiplyScalar(0.8);
      }
      if (o.couleurs.manche !== undefined) M.veste.color.copy(enLin(o.couleurs.manche));
    }

    /* ============================================================ LE KHÉPESH */
    // Repère : +Y = de la poignée vers la lame, +X = côté où le croissant se recourbe (le tranchant y
    // fait face au coup), Z = épaisseur. Le haut de la poignée est en y = 0, le pommeau en y ≈ -0,136,
    // le fût monte jusqu'à y = 0,235, le croissant culmine à y ≈ 0,43 : 56,7 cm au total.
    // Le croissant suit un arc de 17 cm de rayon sur 135° : il part vers le haut, se penche vers l'avant
    // et finit en crochet tourné vers le bas. Sa largeur passe de 2,3 cm (le fût) à 5,2 cm, puis se resserre
    // jusqu'au bout arrondi.
    var YF = 0.235, S1 = 0.36, RC = 0.17, BALAYAGE = 135 * DEG;
    var largeur = [[0, 0.0115], [0.12, 0.0148], [0.3, 0.021], [0.5, 0.026], [0.68, 0.0245], [0.84, 0.0185], [0.94, 0.0115], [0.985, 0.0058], [1, 0.0028]];
    var bI = new THREE.Vector2(), bE = new THREE.Vector2();
    function bords(s) {                          // points du dos (bI, côté creux) et du bord extérieur (bE, convexe) à l'abscisse s
      if (s <= S1) {
        var k = s / S1, y = k * YF, w = 0.0115;   // fût de 2,3 cm
        bI.set(w, y); bE.set(-w, y);
      } else {
        var t = (s - S1) / (1 - S1), th = Math.PI - t * BALAYAGE, w2 = interp(largeur, t);
        var cx = RC + RC * Math.cos(th), cy = YF + RC * Math.sin(th), nx = Math.cos(th), ny = Math.sin(th);
        bI.set(cx - w2 * nx, cy - w2 * ny); bE.set(cx + w2 * nx, cy + w2 * ny);
      }
    }
    function demiEp(u, s) {                      // demi-épaisseur : u = 0 dos, u = 1 bord extérieur
      var fut = 0.0028 + 0.0017 * Math.sin(Math.PI * u);     // fût : barre lenticulaire de 9 mm, bords émoussés
      var dos = 0.0024 - 0.0006 * Math.min(1, u / 0.72);       // croissant : dos de 4,8 mm qui s'amincit…
      var lame = u <= 0.72 ? dos : lerp(0.0018, 0.00012, Math.pow((u - 0.72) / 0.28, 0.85));   // …puis le biseau du tranchant
      if (u > 0.18 && u < 0.3) lame -= 0.00045 * Math.sin(Math.PI * (u - 0.18) / 0.12) * lisse(S1 + 0.04, S1 + 0.1, s) * (1 - lisse(0.9, 0.96, s));   // rainure gravée
      var bout = 1 - 0.35 * lisse(0.9, 1, s);                  // le bout s'amincit, arrondi et émoussé
      var k = lisse(S1 - 0.02, S1 + 0.07, s);
      return Math.max(0.00012, lerp(fut, lame * bout, k));
    }
    function posLame(u, s, face, out) {
      bords(s);
      out[0] = lerp(bI.x, bE.x, u); out[1] = lerp(bI.y, bE.y, u); out[2] = face * demiEp(u, s);
      return out;
    }
    function lin(a, b, n) { var r = []; for (var i = 0; i < n; i++) r.push(a + (b - a) * i / (n - 1)); return r; }
    // grille des deux faces d'une bande (us × ss) ; fermetures : 'u0' (dos), 'u1' (bord), 's1' (bout)
    function grille(us, ss, fermetures) {
      var pos = [], uv = [], idx = [], tmp = [0, 0, 0], nu = us.length, ns = ss.length;
      function face(signe) {
        var base = pos.length / 3;
        for (var j = 0; j < ns; j++) for (var i = 0; i < nu; i++) { posLame(us[i], ss[j], signe, tmp); pos.push(tmp[0], tmp[1], tmp[2]); uv.push(us[i], ss[j]); }
        for (var j2 = 0; j2 < ns - 1; j2++) for (var i2 = 0; i2 < nu - 1; i2++) {
          var a = base + j2 * nu + i2, b = a + 1, c = a + nu + 1, d = a + nu;
          if (signe > 0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
        }
      }
      face(1); face(-1);
      function bande(points, inverse) {          // relie face + et face − le long d'une suite de (u, s)
        var b2 = pos.length / 3;
        points.forEach(function (us2) {
          posLame(us2[0], us2[1], 1, tmp); pos.push(tmp[0], tmp[1], tmp[2]); uv.push(us2[0], us2[1]);
          posLame(us2[0], us2[1], -1, tmp); pos.push(tmp[0], tmp[1], tmp[2]); uv.push(us2[0], us2[1]);
        });
        for (var j = 0; j < points.length - 1; j++) {
          var p0 = b2 + j * 2, p1 = p0 + 1, p2 = p0 + 3, p3 = p0 + 2;
          if (inverse) idx.push(p0, p2, p3, p0, p1, p2); else idx.push(p0, p3, p2, p0, p2, p1);
        }
      }
      if (fermetures.indexOf('u0') >= 0) bande(ss.map(function (s) { return [us[0], s]; }), true);
      if (fermetures.indexOf('u1') >= 0) bande(ss.map(function (s) { return [us[nu - 1], s]; }), false);
      if (fermetures.indexOf('s1') >= 0) bande(us.map(function (u) { return [u, ss[ns - 1]]; }), true);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }

    function plaqueFut(u0, u1, s0, s1, face) {   // morceau de la surface du fût, décollé de 0,05 mm, UV 0→1
      var nu = 9, ns = 40, pos = [], uv = [], idx = [], tmp = [0, 0, 0];
      for (var j = 0; j < ns; j++) for (var i = 0; i < nu; i++) {
        var u = lerp(u0, u1, i / (nu - 1)), sv = lerp(s0, s1, j / (ns - 1));
        posLame(u, sv, face, tmp); pos.push(tmp[0], tmp[1], tmp[2] + face * 0.00005); uv.push(face > 0 ? 1 - i / (nu - 1) : i / (nu - 1), j / (ns - 1));
      }
      for (var j2 = 0; j2 < ns - 1; j2++) for (var i2 = 0; i2 < nu - 1; i2++) {
        var a = j2 * nu + i2, b = a + 1, c = a + nu + 1, d = a + nu;
        if (face > 0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    }
    function boite(lx, ly, lz, r) { return boiteArrondie(lx - 1.96 * r, ly - 1.96 * r, lz, r, 3); }   // dimensions finales exactes
    function construireKhepesh() {
      var g = new THREE.Group(); g.name = 'khepesh';
      // échantillons : serrés dans le croissant (la courbe), plus lâches le long du fût
      var ssFut = lin(0, S1, 26), ssCroissant = lin(S1, 1, 130).slice(1);
      var ss = ssFut.concat(ssCroissant), ssC = [S1].concat(ssCroissant);
      var usCorps = lin(0, 0.72, 16), usBord = lin(0.72, 1, 12);
      var geoCorps = grille(usCorps, ss, ['u0', 's1']);           // dos et cœur de la lame, tout du long
      var geoBordFut = grille(usBord, ssFut, ['u1']);             // bord extérieur du fût : émoussé, bronze brut
      var geoFil = grille(usBord, ssC, ['u1', 's1']);             // tranchant du croissant : bronze avivé
      g.add(new THREE.Mesh(geoCorps, M.bronze), new THREE.Mesh(geoBordFut, M.bronze), new THREE.Mesh(geoFil, M.fil));
      var sang1 = new THREE.Mesh(geoCorps, M.sang), sang2 = new THREE.Mesh(geoFil, M.sang);
      sang1.renderOrder = 2; sang2.renderOrder = 2; g.add(sang1, sang2);

      // lotus gravé sur les deux faces du fût (la plaque épouse le bombé de la barre)
      [1, -1].forEach(function (cote) {
        var m = new THREE.Mesh(plaqueFut(0.16, 0.84, 0.035 / YF * S1, 0.24 / YF * S1, cote), M.gravure);
        m.renderOrder = 1; g.add(m);
      });

      // poignée : âme et rebords de bronze coulés avec la lame, plaquettes d'ébène, rivets, pommeau
      var ame = new THREE.Mesh(boite(0.0212, 0.128, 0.0098, 0.0024), M.bronze);
      ame.position.set(0, -0.064, 0); g.add(ame);
      var geoPlaq = boite(0.0172, 0.112, 0.0066, 0.0028);
      [1, -1].forEach(function (cote) {
        var p = new THREE.Mesh(geoPlaq, M.ebene); p.position.set(0, -0.064, cote * 0.0068); g.add(p);
        [-0.022, -0.064, -0.106].forEach(function (y) {
          var rv = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.patine);
          rv.rotation.x = cote > 0 ? Math.PI / 2 : -Math.PI / 2; rv.scale.set(1, 0.55, 1);
          rv.position.set(0, y, cote * 0.0101); g.add(rv);
        });
      });
      var collet = new THREE.Mesh(boite(0.0236, 0.011, 0.0122, 0.0026), M.bronze);   // talon du fût sur la poignée
      collet.position.set(0, -0.001, 0); g.add(collet);
      var pommeau = new THREE.Mesh(boite(0.0252, 0.010, 0.0215, 0.0040), M.patine);
      pommeau.position.set(0, -0.1315, 0); g.add(pommeau);

      g.userData = { sang: [sang1, sang2] };
      return g;
    }

    /* ======================================================= MAIN GANTÉE */
    // Repère du poing : le manche suit l'axe Y (lame vers +Y), +X = devant du poing (côté tranchant),
    // +Z = dos de la main, -Z = paume. L'avant-bras part du poignet W vers (-cos30°, -sin30°, 0).
    var POIGNET = new V3(-0.074, -0.004, 0.012);
    var DEVIATION = 30 * DEG;
    var DIR_AVANTBRAS = new V3(-Math.cos(DEVIATION), -Math.sin(DEVIATION), 0);

    function tubeVariable(points, rayons, segs, radial) {
      var courbe = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
      var cadres = courbe.computeFrenetFrames(segs, false);
      var pos = [], nor = [], idx = [], p = new V3(), n = new V3();
      for (var i = 0; i <= segs; i++) {
        var t = i / segs; courbe.getPointAt(t, p);
        var r = interp(rayons, t);
        var N = cadres.normals[i], B = cadres.binormals[i];
        for (var j = 0; j <= radial; j++) {
          var v = j / radial * Math.PI * 2, c = Math.cos(v), s = Math.sin(v);
          n.set(c * N.x + s * B.x, c * N.y + s * B.y, c * N.z + s * B.z);
          pos.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z); nor.push(n.x, n.y, n.z);
        }
      }
      for (var i2 = 0; i2 < segs; i2++) {
        for (var j2 = 0; j2 < radial; j2++) {
          var a = i2 * (radial + 1) + j2, b = a + radial + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setIndex(idx);
      return { geo: geo, courbe: courbe };
    }
    function boiteArrondie(lx, ly, lz, r, seg) { // boîte aux arêtes arrondies (extrusion)
      var f = new THREE.Shape(), x = -lx / 2 + r, y = -ly / 2 + r, w = lx - 2 * r, h = ly - 2 * r;
      f.moveTo(x, y - r); f.lineTo(x + w, y - r); f.quadraticCurveTo(x + w + r, y - r, x + w + r, y);
      f.lineTo(x + w + r, y + h); f.quadraticCurveTo(x + w + r, y + h + r, x + w, y + h + r);
      f.lineTo(x, y + h + r); f.quadraticCurveTo(x - r, y + h + r, x - r, y + h);
      f.lineTo(x - r, y); f.quadraticCurveTo(x - r, y - r, x, y - r);
      var geo = new THREE.ExtrudeGeometry(f, { depth: Math.max(0.0002, lz - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: seg || 4, curveSegments: 6 });
      geo.translate(0, 0, -(lz - 2 * r) / 2);
      return geo;
    }

    function construireMain() {
      var g = new THREE.Group(); g.name = 'main-gantee';
      // doigts : enroulés autour du manche (ellipse 1.12 × 0.8), assez épais pour se toucher
      var doigts = [
        { y: 0.0305, r: 0.0098, fin: -163 }, { y: 0.0105, r: 0.0102, fin: -166 },
        { y: -0.0095, r: 0.0096, fin: -160 }, { y: -0.0282, r: 0.0086, fin: -146 }
      ];
      function ellipsoide(rx, ry, rz, materiau, seg) {
        var m = new THREE.Mesh(new THREE.SphereGeometry(1, seg || 22, Math.round((seg || 22) * 0.7)), materiau);
        m.scale.set(rx, ry, rz); return m;
      }
      doigts.forEach(function (d, k) {
        var rm = 0.0128 + (k === 3 ? 0.0006 : 0);
        var ax = rm * 1.12 + d.r + 0.0003, az = rm * 0.8 + d.r + 0.0003;
        var angles = [104, 66, 24, -26, -78, -122, d.fin];
        var echelle = [1.12, 1.06, 1.03, 1.0, 0.99, 0.98, 0.96];
        var pts = angles.map(function (a, i) {
          var t = a * DEG;
          var px = ax * echelle[i] * Math.cos(t), pz = az * echelle[i] * Math.sin(t);
          if (i === 0) { px -= 0.007; pz += 0.002; }
          return new V3(px, d.y + (i - 3) * 0.00035 * (k - 1.5), pz);
        });
        var rr = [[0, d.r * 1.08], [0.12, d.r * 1.12], [0.3, d.r * 0.98], [0.4, d.r * 1.05], [0.55, d.r * 0.94], [0.68, d.r * 0.97], [0.85, d.r * 0.88], [1, d.r * 0.84]];
        var t = tubeVariable(pts, rr, 44, 14);
        g.add(new THREE.Mesh(t.geo, M.gant));
        var bout = new THREE.Mesh(new THREE.SphereGeometry(d.r * 0.84, 14, 10), M.gant);
        bout.position.copy(pts[pts.length - 1]); g.add(bout);
        // renfort de gant sur la phalange moyenne
        var renfort = ellipsoide(d.r * 1.0, d.r * 0.92, d.r * 0.5, M.gantPaume, 16);
        var pj = t.courbe.getPointAt(0.37); renfort.position.copy(pj);
        var dirOut = new V3(pj.x, 0, pj.z).normalize(); renfort.position.addScaledVector(dirOut, d.r * 0.5);
        renfort.lookAt(renfort.position.clone().add(dirOut)); g.add(renfort);
        // jointure (bosse de l'articulation métacarpienne)
        var jointure = ellipsoide(d.r * 1.05, d.r * 0.98, d.r * 0.95, M.gant, 16);
        jointure.position.copy(pts[0]).add(new V3(0.002, 0, 0.0015)); g.add(jointure);
      });

      // dos de la main : volume bombé qui file vers le poignet
      var dos = ellipsoide(0.047, 0.047, 0.0165, M.gant, 28);
      dos.position.set(-0.037, 0.001, 0.0205); dos.rotation.y = -0.08; g.add(dos);
      // talon de la main (côté paume, derrière le manche)
      var talon = ellipsoide(0.033, 0.043, 0.0165, M.gantPaume, 24);
      talon.position.set(-0.045, -0.006, -0.004); g.add(talon);
      // éminence thénar + pouce replié sur l'index
      var thenar = ellipsoide(0.027, 0.019, 0.016, M.gantPaume, 20);
      thenar.position.set(-0.041, 0.03, -0.002); thenar.rotation.z = 0.35; g.add(thenar);
      var ptsP = [new V3(-0.05, 0.035, 0.004), new V3(-0.031, 0.048, -0.01), new V3(-0.009, 0.048, -0.019), new V3(0.011, 0.042, -0.0235), new V3(0.022, 0.035, -0.0225)];
      var pouce = tubeVariable(ptsP, [[0, 0.0128], [0.35, 0.0106], [0.7, 0.0094], [1, 0.0085]], 32, 14);
      g.add(new THREE.Mesh(pouce.geo, M.gant));
      var bp = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), M.gant); bp.position.copy(ptsP[4]); g.add(bp);
      var onglePouce = ellipsoide(0.0075, 0.006, 0.003, M.gantPaume, 12);
      onglePouce.position.copy(ptsP[3]).add(new V3(0.004, 0.006, -0.002)); g.add(onglePouce);

      // protections : plaque dorsale rembourrée + coques de jointures
      var plaque = ellipsoide(0.03, 0.041, 0.0045, M.coque, 24);
      plaque.position.set(-0.038, 0.001, 0.0352); plaque.rotation.y = -0.1; g.add(plaque);
      for (var kq = 0; kq < 4; kq++) {
        var c = new THREE.Mesh(boiteArrondie(0.014, 0.0165, 0.0065, 0.003, 3), M.coque);
        c.position.set(-0.009, doigts[kq].y, 0.0385);
        c.rotation.y = -0.45; g.add(c);
      }

      // poignet du gant + sangle auto-agrippante
      var poignet = new THREE.Group(); poignet.position.copy(POIGNET);
      poignet.quaternion.setFromUnitVectors(new V3(0, 1, 0), DIR_AVANTBRAS);
      var revers = new THREE.Mesh(new THREE.CylinderGeometry(0.0325, 0.0345, 0.034, 20, 1, true), M.gant);
      revers.position.y = 0.012; revers.scale.set(1, 1, 0.82); poignet.add(revers);
      var sangle = new THREE.Mesh(new THREE.CylinderGeometry(0.0352, 0.0356, 0.013, 20, 1, true), M.sangle);
      sangle.position.y = 0.016; sangle.scale.set(1, 1, 0.84); poignet.add(sangle);
      var languette = new THREE.Mesh(boiteArrondie(0.016, 0.013, 0.004, 0.0015, 2), M.sangle);
      languette.position.set(0.0, 0.016, 0.031); poignet.add(languette);
      g.add(poignet);
      return g;
    }

    function construireAvantBras() {
      var g = new THREE.Group(); g.name = 'avant-bras';
      // le cylindre suit +Y local ; on l'aligne ensuite sur la direction de l'avant-bras
      var manche = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.049, 0.42, 22, 10, true), M.veste);
      manche.position.y = 0.21 + 0.03; manche.scale.set(1, 1, 0.86); g.add(manche);
      var pos = manche.geometry.attributes.position, v = new V3();
      for (var i = 0; i < pos.count; i++) { // plis du tissu
        v.fromBufferAttribute(pos, i);
        var t = (v.y + 0.21) / 0.42, ang = Math.atan2(v.z, v.x);
        var pli = 0.0026 * Math.sin(t * 38 + ang * 2) * (1 - t) + 0.0016 * Math.sin(ang * 5 + t * 9);
        var rr = Math.sqrt(v.x * v.x + v.z * v.z), k = (rr + pli) / rr;
        pos.setXYZ(i, v.x * k, v.y, v.z * k);
      }
      manche.geometry.computeVertexNormals();
      var poignetVeste = new THREE.Mesh(new THREE.TorusGeometry(0.0365, 0.0045, 8, 24), M.veste);
      poignetVeste.rotation.x = Math.PI / 2; poignetVeste.position.y = 0.032; poignetVeste.scale.set(1, 0.86, 1);
      g.add(poignetVeste);
      var avantBras = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.031, 0.05, 16, 1, true), M.gant);
      avantBras.position.y = 0.02; avantBras.scale.set(1, 1, 0.82); g.add(avantBras);
      return g;
    }
    /* ================================================================ RIG */
    var rig = new THREE.Group(); rig.name = 'khepesh-viewmodel'; rig.visible = false;
    var sceneVue = null, cameraVue = null, lumVue = null;
    if (o.vueSeparee) {
      sceneVue = new THREE.Scene();
      cameraVue = new THREE.PerspectiveCamera(o.fovVue, camera.aspect || 1, 0.01, 10);
      sceneVue.add(cameraVue);
      lumVue = { hemi: new THREE.HemisphereLight(0xd8d2c4, 0x1e1712, 0.6), cle: new THREE.DirectionalLight(0xffe2c0, 0.6) };
      lumVue.cle.position.set(0.6, 1, 0.4);
      sceneVue.add(lumVue.hemi, lumVue.cle);
    }
    var porteur = cameraVue || camera;
    porteur.add(rig);
    var balance = new THREE.Group(); rig.add(balance);
    var bras = new THREE.Group(); balance.add(bras);
    var avantBras = construireAvantBras();
    avantBras.position.copy(POIGNET);
    avantBras.quaternion.setFromUnitVectors(new V3(0, 1, 0), DIR_AVANTBRAS);
    bras.add(avantBras);
    var pivotPoignet = new THREE.Group(); pivotPoignet.position.copy(POIGNET); bras.add(pivotPoignet);
    var contenuMain = new THREE.Group(); contenuMain.position.copy(POIGNET).negate(); pivotPoignet.add(contenuMain);
    var main = construireMain(); contenuMain.add(main);
    var arme = construireKhepesh(); arme.position.set(0, 0.048, 0); contenuMain.add(arme);
    rig.traverse(function (m) { if (m.isMesh) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; } });
    var tmpA = new V3(), tmpB = new V3(), tmpC = new V3();

    /* ------------------------------------------------------------ traînée de la lame */
    var NT = 20;
    var traineePos = new Float32Array(NT * 2 * 3), traineeA = new Float32Array(NT * 2);
    var geoTrainee = new THREE.BufferGeometry();
    geoTrainee.setAttribute('position', new THREE.BufferAttribute(traineePos, 3));
    geoTrainee.setAttribute('aAlpha', new THREE.BufferAttribute(traineeA, 1));
    var idxT = [];
    for (var it2 = 0; it2 < NT - 1; it2++) { var a0 = it2 * 2; idxT.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    geoTrainee.setIndex(idxT);
    var matTrainee = new THREE.ShaderMaterial({
      uniforms: { uCouleur: { value: new THREE.Color(0xffe6c4) } },
      vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCouleur; varying float vA; void main(){ gl_FragColor = vec4(uCouleur * vA, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    var trainee = new THREE.Mesh(geoTrainee, matTrainee); trainee.frustumCulled = false; trainee.renderOrder = 5;
    rig.add(trainee);
    var traineeForce = 0, traineeVide = true, traineeActive = 0;
    // la traînée suit le tranchant du croissant ; le sang de la lame tombe du bout (le crochet)
    var baseLame = new V3(0.007, 0.33, 0), pointe = new V3(0.262, 0.398, 0), crochet = new V3(0.292, 0.352, 0), dernierePointe = new V3();
    function majTrainee(dt) {
      var b = rig.worldToLocal(arme.localToWorld(tmpA.copy(baseLame)));
      var p = rig.worldToLocal(arme.localToWorld(tmpB.copy(pointe)));
      if (traineeVide) {
        for (var i = 0; i < NT; i++) traineePos.set([b.x, b.y, b.z, p.x, p.y, p.z], i * 6);
        dernierePointe.copy(p); traineeVide = false;
      }
      var vit = dt > 0 ? p.distanceTo(dernierePointe) / dt : 0; dernierePointe.copy(p);
      var cible = clamp((vit - 1.4) / 4.0, 0, 1) * traineeActive;
      traineeForce = lerp(traineeForce, cible, 1 - Math.exp(-dt * 30));
      traineePos.copyWithin(6, 0, (NT - 1) * 6);
      traineePos.set([b.x, b.y, b.z, p.x, p.y, p.z], 0);
      for (var k = 0; k < NT; k++) {
        var f = Math.pow(1 - k / (NT - 1), 1.5) * traineeForce;
        traineeA[k * 2] = f * 0.1; traineeA[k * 2 + 1] = f * 0.5;
      }
      geoTrainee.attributes.position.needsUpdate = true; geoTrainee.attributes.aAlpha.needsUpdate = true;
    }

    /* ------------------------------------------------------------ sang : gouttes et flaques */
    var NP = 1400;
    var pPos = new Float32Array(NP * 3), pTaille = new Float32Array(NP), pAlpha = new Float32Array(NP), pCoul = new Float32Array(NP * 3);
    var pVit = [], pVie = new Float32Array(NP), pVieMax = new Float32Array(NP), pTailleBase = new Float32Array(NP), pPose = new Float32Array(NP);
    var pSol = new Float32Array(NP), pFlaque = new Float32Array(NP);
    for (var ip = 0; ip < NP; ip++) { pVit.push(new V3()); pPos[ip * 3 + 1] = -9999; pSol[ip] = NaN; }
    var geoP = new THREE.BufferGeometry();
    geoP.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geoP.setAttribute('aTaille', new THREE.BufferAttribute(pTaille, 1));
    geoP.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
    geoP.setAttribute('aCouleur', new THREE.BufferAttribute(pCoul, 3));
    var matP = new THREE.ShaderMaterial({
      uniforms: { uEchelle: { value: 600 } },
      vertexShader: 'attribute float aTaille; attribute float aAlpha; attribute vec3 aCouleur; varying float vA; varying vec3 vC; uniform float uEchelle;' +
        'void main(){ vA = aAlpha; vC = aCouleur; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.0, aTaille * uEchelle / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard; float a = vA * smoothstep(0.25, 0.08, d); gl_FragColor = vec4(vC * (0.75 + 0.5 * smoothstep(0.25, 0.0, d)), a); }',
      transparent: true, depthWrite: false
    });
    var particules = new THREE.Points(geoP, matP); particules.frustumCulled = false; particules.renderOrder = 4;
    scene.add(particules);
    var curseurP = 0;
    function emettreSang(origine, dir, n, opt) {
      opt = opt || {};
      var r = Math.random, sol = opt.sol !== undefined && opt.sol !== null ? opt.sol : (o.hauteurSol !== null ? o.hauteurSol : NaN);
      for (var i = 0; i < n; i++) {
        var k = curseurP; curseurP = (curseurP + 1) % NP;
        pPos[k * 3] = origine.x; pPos[k * 3 + 1] = origine.y; pPos[k * 3 + 2] = origine.z;
        var v = pVit[k];
        v.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(opt.dispersion || 2.4);
        v.addScaledVector(dir, (opt.vitesse || 3) * (0.5 + r()));
        v.y += opt.montee !== undefined ? opt.montee : 1.0;
        pVieMax[k] = pVie[k] = (opt.vie || 0.9) * (0.6 + r() * 0.8); pPose[k] = 0;
        pTailleBase[k] = (opt.taille || 0.022) * (0.4 + r() * 1.1);
        pSol[k] = sol; pFlaque[k] = opt.flaque || 0;
        var sombre = 0.55 + r() * 0.35;
        pCoul[k * 3] = 0.42 * sombre + 0.05; pCoul[k * 3 + 1] = 0.02 * sombre; pCoul[k * 3 + 2] = 0.025 * sombre;
      }
    }
    // flaques : taches posées à plat sur le sol, qui grandissent sous un zombie qui saigne et s'effacent lentement
    var NF = 180, DUREE_FLAQUE = 14;
    var formeFlaque = new THREE.Shape(), rf = alea(5);
    for (var af = 0; af <= 28; af++) {
      var ang = af / 28 * Math.PI * 2, rr = 1 + 0.18 * Math.sin(ang * 3 + 1.3) + 0.1 * Math.sin(ang * 7) + (rf() - 0.5) * 0.12;
      if (af === 0) formeFlaque.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); else formeFlaque.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    var geoFlaque = new THREE.ShapeGeometry(formeFlaque, 3); geoFlaque.rotateX(-Math.PI / 2);
    var flaques = new THREE.InstancedMesh(geoFlaque, M.flaque, NF); flaques.frustumCulled = false; flaques.renderOrder = 3;
    if (flaques.instanceMatrix.setUsage) flaques.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    var fl = [], mF = new THREE.Matrix4(), qF = new Q(), sF = new V3(), pF = new V3(), YAXE = new V3(0, 1, 0);
    for (var ifl = 0; ifl < NF; ifl++) { fl.push({ x: 0, y: 0, z: 0, r: 0, rMax: 0, vie: 0, rot: 0 }); flaques.setMatrixAt(ifl, mF.makeScale(0, 0, 0)); }
    scene.add(flaques);
    var curseurF = 0;
    function poserFlaque(x, y, z, r) {
      for (var i = 0; i < NF; i++) {                 // une flaque proche grossit au lieu d'en créer une autre
        var f = fl[i];
        if (f.vie > 0 && Math.abs(f.y - y) < 0.05 && (f.x - x) * (f.x - x) + (f.z - z) * (f.z - z) < f.rMax * f.rMax * 0.6) {
          f.rMax = Math.min(0.3, Math.sqrt(f.rMax * f.rMax + r * r * 0.5)); f.vie = DUREE_FLAQUE; return;
        }
      }
      var g2 = fl[curseurF]; curseurF = (curseurF + 1) % NF;
      g2.x = x; g2.y = y + 0.002; g2.z = z; g2.r = r * 0.3; g2.rMax = r; g2.vie = DUREE_FLAQUE; g2.rot = Math.random() * Math.PI * 2;
    }
    function majFlaques(dt) {
      for (var i = 0; i < NF; i++) {
        var f = fl[i];
        if (f.vie <= 0) continue;
        f.vie -= dt;
        f.r += (f.rMax - f.r) * (1 - Math.exp(-dt * 6));
        var e = f.vie <= 0 ? 0 : f.r * (f.vie < 2 ? f.vie / 2 : 1);
        qF.setFromAxisAngle(YAXE, f.rot); sF.set(e, 1, e * 0.8); pF.set(f.x, f.y, f.z);
        flaques.setMatrixAt(i, mF.compose(pF, qF, sF));
      }
      flaques.instanceMatrix.needsUpdate = true;
    }
    function majParticules(dt) {
      var g = o.gravite;
      for (var k = 0; k < NP; k++) {
        if (pVie[k] <= 0) { pAlpha[k] = 0; continue; }
        pVie[k] -= dt;
        var v = pVit[k];
        if (pPose[k] === 0) {
          v.y -= g * dt; v.multiplyScalar(1 - 0.6 * dt);
          pPos[k * 3] += v.x * dt; pPos[k * 3 + 1] += v.y * dt; pPos[k * 3 + 2] += v.z * dt;
          var sol = pSol[k];
          if (sol === sol && pPos[k * 3 + 1] < sol + 0.004) {   // touche le sol : goutte posée, parfois une flaque
            pPos[k * 3 + 1] = sol + 0.004; v.set(0, 0, 0); pPose[k] = 1;
            pVie[k] = Math.max(pVie[k], 1.2); pVieMax[k] = pVie[k]; pTailleBase[k] *= 1.5;
            if (pFlaque[k] > 0 && Math.random() < pFlaque[k]) poserFlaque(pPos[k * 3], sol, pPos[k * 3 + 2], 0.035 + Math.random() * 0.05);
          }
        }
        var vie = clamp(pVie[k] / pVieMax[k], 0, 1);
        pAlpha[k] = vie < 0.35 ? vie / 0.35 : 1;
        pTaille[k] = pTailleBase[k] * (0.7 + 0.3 * vie);
      }
      geoP.attributes.position.needsUpdate = true; geoP.attributes.aAlpha.needsUpdate = true;
      geoP.attributes.aTaille.needsUpdate = true; geoP.attributes.aCouleur.needsUpdate = true;
      if (o.renderer && o.renderer.getDrawingBufferSize) {
        var s = o.renderer.getDrawingBufferSize(new THREE.Vector2());
        matP.uniforms.uEchelle.value = s.y / (2 * Math.tan((camera.fov * DEG) / 2));
      } else if (typeof window !== 'undefined') {
        matP.uniforms.uEchelle.value = window.innerHeight * (window.devicePixelRatio || 1) / (2 * Math.tan((camera.fov * DEG) / 2));
      }
    }

    /* =========================================================== AUDIO */
    var audio = { ctx: null, maitre: null, bruit: null };
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
    }
    function bruit(t0, duree, type, f0, f1, q, gain, att) {
      var c = audio.ctx, s = c.createBufferSource(); s.buffer = audio.bruit; s.loop = true;
      var f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + duree);
      var g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + (att || 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
      s.connect(f); f.connect(g); g.connect(audio.maitre);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + duree + 0.05);
    }
    function ton(t0, duree, type, f0, f1, gain, att) {
      var c = audio.ctx, osc = c.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + duree);
      var g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + (att || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
      osc.connect(g); g.connect(audio.maitre); osc.start(t0); osc.stop(t0 + duree + 0.05);
    }
    var SONS = {
      sortie: function (t) { bruit(t, 0.16, 'bandpass', 2400, 1800, 2.0, 0.07, 0.01); ton(t + 0.02, 0.55, 'sine', 1180, 1172, 0.035, 0.004); ton(t + 0.02, 0.4, 'sine', 2950, 2935, 0.012, 0.004); },
      elan: function (t) { bruit(t, 0.32, 'bandpass', 360, 1500, 1.0, 0.52, 0.09); },
      impact: function (t) {
        ton(t, 0.24, 'sine', 118, 36, 1.0); ton(t, 0.1, 'square', 72, 38, 0.15);
        bruit(t, 0.05, 'highpass', 1500, 800, 0.8, 0.55, 0.003);
        bruit(t + 0.008, 0.32, 'bandpass', 620, 280, 2.6, 0.52, 0.01);
        ton(t + 0.006, 0.5, 'sine', 1262, 1240, 0.045, 0.003);
      },
      impact2: function (t) { ton(t, 0.16, 'sine', 140, 45, 0.6); bruit(t + 0.005, 0.24, 'bandpass', 700, 320, 2.4, 0.4, 0.01); },
      crochet: function (t) { bruit(t, 0.28, 'bandpass', 380, 210, 3.2, 0.42, 0.04); bruit(t + 0.05, 0.22, 'bandpass', 900, 480, 2.0, 0.17, 0.03); },
      arrachage: function (t) { bruit(t, 0.26, 'bandpass', 940, 250, 2.4, 0.52, 0.015); bruit(t + 0.03, 0.17, 'bandpass', 700, 2200, 1, 0.2, 0.03); },
      secoue: function (t) {
        bruit(t, 0.1, 'bandpass', 1200, 3000, 1.2, 0.22, 0.02);
        for (var i = 0; i < 4; i++) bruit(t + 0.06 + Math.random() * 0.14, 0.012, 'bandpass', 2600, 2400, 4, 0.08, 0.002);
      },
      rate: function (t) { bruit(t, 0.46, 'bandpass', 400, 2000, 0.9, 0.56, 0.06); bruit(t + 0.26, 0.32, 'lowpass', 700, 400, 0.7, 0.1, 0.05); },
      moulinet: function (t) { bruit(t, 0.3, 'bandpass', 680, 1700, 1.4, 0.22, 0.08); bruit(t + 0.15, 0.24, 'bandpass', 1050, 2200, 1.4, 0.16, 0.05); },
      rangement: function (t) { bruit(t, 0.2, 'lowpass', 600, 350, 0.7, 0.09, 0.04); ton(t + 0.12, 0.4, 'sine', 1180, 1172, 0.022, 0.004); }
    };
    function jouer(nom) {
      var c = ctxAudio(); if (!c || !SONS[nom]) return;
      try { SONS[nom](c.currentTime + 0.005); } catch (e) { /* audio indisponible */ }
    }
    /* ======================================================= ANIMATION */
    // Une clé = position de la main dans le repère caméra (m), direction de la lame,
    // direction du coude (où part l'avant-bras), et deux réglages de poignet (flick, roulis).
    var mTmp = new THREE.Matrix4(), bP = new V3(), bD = new V3(), bX = new V3(), bZ = new V3();
    function baseMain(Y, h, outQ, outD) {
      // la lame suit exactement Y (normalisé) ; l'avant-bras part vers h en respectant l'angle anatomique (120°)
      bP.copy(h).addScaledVector(Y, -h.dot(Y));
      if (bP.lengthSq() < 1e-8) bP.set(1, 0, 0).addScaledVector(Y, -Y.x);
      bP.normalize();
      bD.copy(Y).multiplyScalar(-Math.sin(DEVIATION)).addScaledVector(bP, Math.cos(DEVIATION)).normalize();
      bX.copy(bD).addScaledVector(Y, Math.sin(DEVIATION)).multiplyScalar(-1 / Math.cos(DEVIATION)).normalize();
      bZ.crossVectors(bX, Y).normalize();
      mTmp.makeBasis(bX, Y, bZ);
      if (outD) outD.copy(bD);
      return outQ.setFromRotationMatrix(mTmp);
    }
    function cles(def) {
      return def.map(function (k) {
        var Y = new V3().fromArray(k.lame).normalize(), D = new V3();
        var q = baseMain(Y, new V3().fromArray(k.coude).normalize(), new Q(), D);
        // W : direction de la lame perpendiculaire à l'avant-bras (la pronation du poignet)
        var W = Y.clone().addScaledVector(D, Math.sin(DEVIATION)).normalize();
        return { t: k.t, p: new V3().fromArray(k.p), q: q, D: D, W: W, flick: (k.flick || 0) * DEG, roulis: (k.roulis || 0) * DEG, ease: E[k.ease || 'inOutSine'] };
      });
    }
    function slerpVec(a, b, t, out) { // interpolation sur la sphère (t peut sortir de [0,1] pour les dépassements)
      var th = Math.acos(clamp(a.dot(b), -1, 1));
      if (th < 1e-4) return out.copy(a).lerp(b, t).normalize();
      var s = Math.sin(th);
      return out.copy(a).multiplyScalar(Math.sin((1 - t) * th) / s).addScaledVector(b, Math.sin(t * th) / s).normalize();
    }
    var POSES = {
      cache:     { p: [0.26, -0.45, -0.25], lame: [0.25, -0.9, -0.35], coude: [0.6, 0.2, 0.75] },     // lame vers le bas, hors champ
      leve:      { p: [0.24, -0.20, -0.33], lame: [0.1, 0.96, -0.25], coude: [0.62, -0.4, 0.68] },     // dressée à droite
      arme:      { p: [0.25, -0.10, -0.30], lame: [0.42, 0.86, 0.28], coude: [0.8, -0.25, 0.55] },     // ramenée par-dessus l'épaule
      contact:   { p: [0.22, -0.16, -0.38], lame: [-0.60, 0.70, -0.38], coude: [0.75, 0.6, 0.3] },     // le croissant arrive de plat au centre
      // TOUCHÉ : la lame mord, le crochet tire dans la plaie, arrachage, secoué
      morsure:   { p: [0.16, -0.19, -0.41], lame: [-0.72, 0.55, -0.42], coude: [0.8, 0.48, 0.38] },
      crochet:   { p: [0.20, -0.22, -0.34], lame: [-0.50, 0.66, -0.56], coude: [0.7, 0.0, 0.7] },
      arrache:   { p: [0.22, -0.13, -0.31], lame: [-0.05, 0.92, -0.40], coude: [0.6, -0.4, 0.7] },
      secoue:    { p: [0.23, -0.20, -0.32], lame: [0.25, 0.75, -0.62], coude: [0.5, -0.55, 0.67] },
      garde:     { p: [0.23, -0.19, -0.34], lame: [0.05, 0.95, -0.30], coude: [0.55, -0.5, 0.67] },
      // RATÉ : la lame passe, l'élan emporte le bras vers le bas à gauche, rattrapage en revers
      elan:      { p: [-0.04, -0.24, -0.38], lame: [-0.80, -0.38, -0.46], coude: [0.75, -0.1, 0.65] },
      emporte:   { p: [-0.09, -0.28, -0.35], lame: [-0.55, -0.72, -0.42], coude: [0.65, -0.3, 0.7] },
      revers:    { p: [0.10, -0.16, -0.36], lame: [-0.15, 0.90, -0.40], coude: [0.62, -0.30, 0.73] }
    };
    function k(t, nom, extra) { var b = POSES[nom], r = { t: t, p: b.p, lame: b.lame, coude: b.coude }; return Object.assign(r, extra || {}); }
    var TC = 0.30;                                // la lame arrive dans la zone de frappe
    var T_CONTACT = { touche: TC, rate: TC };
    var debut = [
      k(0.0, 'cache'),
      k(0.09, 'leve', { ease: 'outCubic' }),
      k(0.20, 'arme', { ease: 'inOutSine', flick: 12 }),
      k(TC, 'contact', { ease: 'inCubic', flick: -8 })
    ];
    var SEQ = {
      touche: cles(debut.concat([
        k(TC + 0.05, 'morsure', { ease: 'outExpo', flick: -10 }),
        k(TC + 0.20, 'crochet', { ease: 'inOutCubic', flick: 16 }),
        k(TC + 0.30, 'arrache', { ease: 'outQuart', flick: 22 }),
        k(TC + 0.40, 'secoue', { ease: 'outCubic', flick: -28 }),
        k(TC + 0.56, 'garde', { ease: 'outBack', flick: 4 }),
        k(TC + 0.76, 'cache', { ease: 'inCubic' })
      ])),
      rate: cles(debut.concat([
        k(TC + 0.14, 'elan', { ease: 'outCubic', flick: -14 }),
        k(TC + 0.26, 'emporte', { ease: 'inOutSine', flick: -20 }),
        k(TC + 0.46, 'revers', { ease: 'inOutCubic', flick: 6 }),
        k(TC + 0.64, 'garde', { ease: 'outBack', flick: 2 }),
        k(TC + 0.84, 'cache', { ease: 'inCubic' })
      ]))
    };
    var DUREE = { touche: SEQ.touche[SEQ.touche.length - 1].t, rate: SEQ.rate[SEQ.rate.length - 1].t };
    var FENETRE = { touche: TC + 0.36, rate: TC + 0.48 };   // à partir de là, un nouvel appui relance un coup
    var poseCourante = { p: new V3(), q: new Q(), flick: 0, roulis: 0 };
    function catmull(p0, p1, p2, p3, t, out) {
      var t2 = t * t, t3 = t2 * t;
      out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      return out;
    }
    var iY = new V3(), iD = new V3(), iW = new V3();
    function evaluer(seq, t, out) {
      var n = seq.length;
      if (t <= seq[0].t) { var a0 = seq[0]; out.p.copy(a0.p); out.q.copy(a0.q); out.flick = a0.flick; out.roulis = a0.roulis; return out; }
      if (t >= seq[n - 1].t) { var z = seq[n - 1]; out.p.copy(z.p); out.q.copy(z.q); out.flick = z.flick; out.roulis = z.roulis; return out; }
      var i = 0; while (i < n - 2 && t > seq[i + 1].t) i++;
      var a = seq[i], b = seq[i + 1];
      var u = (t - a.t) / (b.t - a.t), e = b.ease(u), ec = clamp(e, -0.25, 1.25);
      catmull(seq[Math.max(0, i - 1)].p, a.p, b.p, seq[Math.min(n - 1, i + 2)].p, e, out.p);
      // Rotation interpolée comme un vrai bras : l'avant-bras balaie le grand cercle entre les deux clés,
      // la pronation tourne autour de lui, et la lame garde ses 120° avec l'avant-bras.
      // (Un slerp direct des quaternions faisait passer l'avant-bras par l'axe de la caméra pendant le raté.)
      slerpVec(a.D, b.D, ec, iD); slerpVec(a.W, b.W, ec, iW);
      iW.addScaledVector(iD, -iW.dot(iD)).normalize();
      iY.copy(iD).multiplyScalar(-Math.sin(DEVIATION)).addScaledVector(iW, Math.cos(DEVIATION));
      baseMain(iY, iD, out.q);
      out.flick = lerp(a.flick, b.flick, e); out.roulis = lerp(a.roulis, b.roulis, e);
      return out;
    }
    var axeFlick = new V3(0, 0, 1), qFlick = new Q(), qRoulis = new Q();
    function appliquerPose(pose) {
      bras.position.copy(pose.p); bras.quaternion.copy(pose.q);
      qFlick.setFromAxisAngle(axeFlick, pose.flick);
      qRoulis.setFromAxisAngle(DIR_AVANTBRAS, pose.roulis);
      pivotPoignet.quaternion.copy(qRoulis).multiply(qFlick);
    }

    /* ------------------------------------------------- caméra : ressorts amortis */
    function ressort(k, amort) { return { x: 0, v: 0, k: k, c: 2 * Math.sqrt(k) * amort }; }
    var R = { tangage: ressort(170, 0.5), lacet: ressort(170, 0.5), roulis: ressort(150, 0.45), fov: ressort(140, 0.6) };
    function impulsion(r, v) { r.v += v; }
    function majRessort(r, dt) { var a = -r.k * r.x - r.c * r.v; r.v += a * dt; r.x += r.v * dt; }
    var tremblement = 0;
    var qSecousse = new Q(), qSecousseInv = new Q(), eSecousse = new THREE.Euler(0, 0, 0, 'YXZ'), secousseAppliquee = false;
    var fovDecalage = 0;   // part du champ de vision ajoutée par la secousse (retirée par retirerSecousse)
    /* ===================================================== LOGIQUE DE MÊLÉE */
    var etat = 'repos', tSeq = 0, branche = 'rate', geleImpact = 0, echelleTemps = 1;
    var evenementsFaits = {}, demandeEnAttente = false, resultat = null;
    var sangLame = 0, delaiSechage = 0;
    var camPos = new V3(), camDir = new V3(), camDroite = new V3(), vecT = new V3(), pointImpact = new V3();
    var impacts = [], touches = [];            // coups à porter (décalés le long de l'arc) ; zombies tranchés par ce coup

    function vivant(c) { return !!c && !(c.alive === false || c.dead === true || c.mort === true); }
    function pointDeFrappe(t, out) {
      if (o.getHitPoint) { var p = o.getHitPoint(t); if (p) return out.copy(p); }
      var src = t.position || (t.object3D && t.object3D.position) || (t.mesh && t.mesh.position);
      if (!src) return null;
      out.copy(src); out.y += (t.hauteurImpact !== undefined ? t.hauteurImpact : o.hauteurImpact);
      return out;
    }
    function solDe(c) {
      if (o.getSol) { var y = o.getSol(c); if (y !== undefined && y !== null) return y; }
      return o.hauteurSol;
    }
    function reperesCamera() {
      camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
      camDroite.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(new Q()));
    }
    // tous les zombies dans l'arc, du plus proche au plus loin (au plus ciblesMax)
    function chercherCibles() {
      reperesCamera();
      var liste = (o.getTargets && o.getTargets()) || [], res = [];
      for (var i = 0; i < liste.length; i++) {
        var t = liste[i], p = new V3();
        if (!vivant(t) || !pointDeFrappe(t, p)) continue;
        vecT.subVectors(p, camPos);
        var d = vecT.length(), r = t.radius !== undefined ? t.radius : o.rayonCible;
        if (d - r > o.portee) continue;
        var ang = vecT.angleTo(camDir) / DEG, tol = o.angleCone + Math.atan2(r, Math.max(d, 0.01)) / DEG;
        if (ang > tol) continue;
        if (o.bloque && o.bloque(camPos.clone(), p.clone())) continue;
        res.push({ cible: t, point: p, distance: d, rayon: r });
      }
      res.sort(function (a, b) { return a.distance - b.distance; });
      return res.slice(0, o.ciblesMax);
    }
    function ciblesJeu() {
      reperesCamera();
      var r = null;
      try { r = o.choisirCible('contact'); } catch (e) { console.error(e); }
      if (!r) return [];
      if (!Array.isArray(r)) r = [r];
      var res = [];
      r.forEach(function (x) {
        if (!x || !x.cible) return;
        var p = x.point ? new V3().copy(x.point) : pointDeFrappe(x.cible, new V3());
        if (!p) return;
        res.push({ cible: x.cible, point: p, distance: p.distanceTo(camPos), rayon: x.rayon !== undefined ? x.rayon : (x.cible.radius !== undefined ? x.cible.radius : o.rayonCible) });
      });
      res.sort(function (a, b) { return a.distance - b.distance; });
      return res.slice(0, o.ciblesMax);
    }

    var poseDepart = { p: new V3(), q: new Q(), flick: 0, roulis: 0 }, qFondu = new Q(), tFondu = 0, DUREE_FONDU = 0.1, abaisseDepart = 0;
    function fondre() {
      poseDepart.p.copy(poseCourante.p); poseDepart.q.copy(poseCourante.q); poseDepart.flick = poseCourante.flick;
      poseDepart.roulis = Math.atan2(Math.sin(poseCourante.roulis), Math.cos(poseCourante.roulis));
      tFondu = DUREE_FONDU;
    }
    function frapper() {
      var relance = false;
      if (etat !== 'repos') {
        if (o.enchainement && tSeq >= FENETRE[branche] && geleImpact <= 0) relance = true;
        else {
          // appui anticipé (après l'impact) : gardé en mémoire, le coup suivant part dès que la fenêtre s'ouvre
          if (tSeq > T_CONTACT[branche] || tSeq > DUREE[branche] - 0.16) demandeEnAttente = true;
          return false;
        }
      }
      if (relance) { fondre(); abaisseDepart = abaissement(); } else { tFondu = 0; abaisseDepart = 0; }
      etat = 'actif'; tSeq = 0; evenementsFaits = {}; demandeEnAttente = false;
      branche = 'rate'; resultat = null; impacts.length = 0; touches = [];
      rig.visible = true; traineeVide = true;
      if (!relance) appliquerPose(evaluer(SEQ[branche], 0, poseCourante));
      jouer('sortie');
      if (o.secousseCamera) impulsion(R.roulis, -8);
      return true;
    }

    function resoudreContact() {
      var cibles = o.choisirCible ? ciblesJeu() : chercherCibles();
      if (!cibles.length) {
        resultat = 'rate';
        jouer('rate');
        if (o.secousseCamera) { impulsion(R.roulis, 80); impulsion(R.lacet, 34); impulsion(R.tangage, -30); if (o.secousseFOV) impulsion(R.fov, 40); }
        if (o.onMiss) { try { o.onMiss(); } catch (e0) { console.error(e0); } }
        return;
      }
      branche = 'touche'; resultat = 'touche';
      // la taille va de droite à gauche : la lame traverse les zombies dans cet ordre, à quelques centisecondes d'écart
      var ordre = cibles.map(function (c, i) { c.rang = i; c.cote = tmpA.subVectors(c.point, camPos).dot(camDroite); return c; });
      ordre.sort(function (a, b) { return b.cote - a.cote; });
      ordre.forEach(function (c, i) { impacts.push({ c: c, delai: i * 0.035 }); });
      geleImpact = Math.min(0.13, 0.09 + 0.02 * (cibles.length - 1));
      jouer('impact');
      if (o.secousseCamera) {
        impulsion(R.tangage, -36); impulsion(R.lacet, 46); impulsion(R.roulis, -52);
        if (o.secousseFOV) impulsion(R.fov, -70);
        tremblement = 0.17;
      }
      majImpacts(0);
    }
    function majImpacts(dt) {
      for (var i = impacts.length - 1; i >= 0; i--) {
        impacts[i].delai -= dt;
        if (impacts[i].delai <= 0) { var imp = impacts.splice(i, 1)[0]; porterCoup(imp.c); }
      }
    }
    function porterCoup(c) {
      var facteur = o.facteurs[Math.min(c.rang, o.facteurs.length - 1)], degats = Math.round(o.degats * facteur);
      var sol = solDe(c.cible);
      vecT.subVectors(c.point, camPos).normalize();
      pointImpact.copy(c.point).addScaledVector(vecT, -c.rayon * 0.85);
      // gerbe dans le sens de la taille (vers la gauche et le bas), plus une giclée vers le joueur
      var dirSang = vecT.clone().multiplyScalar(-0.3).addScaledVector(camDroite, -0.9); dirSang.y -= 0.1;
      emettreSang(pointImpact, dirSang, 70, { vitesse: 2.8, dispersion: 2.8, montee: 1.7, vie: 1.1, taille: 0.03, sol: sol, flaque: 0.35 });
      emettreSang(pointImpact, vecT.clone().multiplyScalar(-1), 24, { vitesse: 1.6, dispersion: 1.2, montee: 0.6, vie: 0.6, taille: 0.05, sol: sol, flaque: 0.3 });
      emettreSang(pointImpact, dirSang, 14, { vitesse: 0.7, dispersion: 0.8, montee: 0.3, vie: 0.35, taille: 0.12 });
      if (c.rang > 0) jouer('impact2');
      sangLame = Math.min(0.8, sangLame + (c.rang === 0 ? 0.4 : 0.15)); delaiSechage = 10;
      ajouterSaignement(c.cible, degats, dirSang);
      touches.push(c.cible);
      if (o.onHit) {
        try { o.onHit(c.cible, { point: pointImpact.clone(), direction: vecT.clone(), degats: degats, facteur: facteur, rang: c.rang, distance: c.distance }); } catch (e) { console.error(e); }
      }
    }

    /* ---------------------------------------------- saignement des zombies tranchés */
    var saignes = [], pPlaie = new V3(), dGoutte = new V3();
    function ajouterSaignement(cible, degatsCoup, dirCoup) {
      var total = Math.round(degatsCoup * o.saignement.part), s = null;
      for (var i = 0; i < saignes.length; i++) if (saignes[i].cible === cible) { s = saignes[i]; break; }
      if (!s) { s = { cible: cible, restant: 0, debit: 0, temps: 0, accu: 0, goutteT: 0, jets: 0, jetT: 0, dir: new V3(), actif: true }; saignes.push(s); }
      s.restant = Math.min(s.restant + total, Math.round(total * 1.5));   // un nouveau coup ravive la plaie, sans cumul sans fin
      s.temps = 0; s.accu = 0; s.debit = s.restant / o.saignement.duree; s.actif = true;
      s.jets = 4; s.jetT = 0.14; s.dir.copy(dirCoup).normalize();
    }
    function majSaignements(dt) {
      var D = o.saignement.duree;
      for (var i = saignes.length - 1; i >= 0; i--) {
        var s = saignes[i], c = s.cible;
        s.temps += dt;
        var reste = D - s.temps, enVie = vivant(c);
        if (!enVie || !pointDeFrappe(c, pPlaie)) { if (!enVie) s.restant = 0; if (s.temps > D + 0.5 || !enVie) { saignes.splice(i, 1); continue; } }
        pPlaie.y -= 0.12;                                   // la plaie : poitrine, ventre
        var sol = solDe(c), intensite = clamp(reste / D, 0, 1);
        if (s.jets > 0) {                                   // le cœur pompe encore : jets par saccades
          s.jetT -= dt;
          if (s.jetT <= 0) { s.jetT = 0.17; s.jets--; emettreSang(pPlaie, s.dir, 16, { vitesse: 2.2, dispersion: 0.9, montee: 0.8, vie: 1.1, taille: 0.017, sol: sol, flaque: 0.3 }); }
        }
        s.goutteT -= dt;
        if (s.goutteT <= 0 && reste > -1.5) {               // la plaie coule : gouttes qui laissent une traînée quand il marche
          s.goutteT = 0.045 + (1 - intensite) * 0.12;
          dGoutte.set((Math.random() - 0.5) * 0.3, -0.25, (Math.random() - 0.5) * 0.3);
          emettreSang(pPlaie, dGoutte, intensite > 0.35 ? 2 : 1, { vitesse: 0.25, dispersion: 0.25, montee: 0.0, vie: 1.6, taille: 0.012 + 0.009 * intensite, sol: sol, flaque: 0.55 });
        }
        if (s.restant > 0) {                                // dégâts par tranches régulières
          s.accu += dt;
          if (s.accu >= o.saignement.pas || reste <= 0) {
            var dose = reste <= 0 ? s.restant : Math.min(s.restant, s.debit * s.accu);
            s.accu = 0; s.restant -= dose;
            var suite = true;
            if (o.onSaignement && dose > 0) { try { suite = o.onSaignement(c, dose, { reste: s.restant, temps: s.temps }); } catch (e) { console.error(e); } }
            if (suite === false) s.restant = 0;
          }
        }
        if (reste <= -1.5) saignes.splice(i, 1);
      }
    }
    // l'arrachage rouvre les plaies : une giclée de chaque zombie tranché par ce coup
    function jaillir() {
      touches.forEach(function (c) {
        if (!vivant(c) || !pointDeFrappe(c, pPlaie)) return;
        pPlaie.y -= 0.1;
        dGoutte.subVectors(camPos, pPlaie).normalize().multiplyScalar(0.6).addScaledVector(camDroite, 0.4);
        emettreSang(pPlaie, dGoutte, 34, { vitesse: 2.0, dispersion: 1.4, montee: 1.1, vie: 1.0, taille: 0.024, sol: solDe(c), flaque: 0.3 });
      });
    }

    var vPointe = new V3(), vDernierePointeMonde = new V3(), pointeMonde = new V3();
    function evenements() {
      function une(nom, t, fn) { if (!evenementsFaits[nom] && tSeq >= t) { evenementsFaits[nom] = true; fn(); } }
      une('elan', 0.16, function () { jouer('elan'); });
      une('contact', TC, resoudreContact);
      if (branche === 'touche') {
        une('crochet', TC + 0.08, function () { jouer('crochet'); if (o.secousseCamera) { impulsion(R.roulis, 30); impulsion(R.lacet, -22); } });
        une('arrachage', TC + 0.20, function () {
          jouer('arrachage');
          if (o.secousseCamera) { impulsion(R.lacet, -56); impulsion(R.tangage, 18); }
          projeterDepuisLame(18, 1.6); jaillir();
        });
        une('secoue', TC + 0.38, function () { jouer('secoue'); sangLame = Math.max(0, sangLame - 0.15); projeterDepuisLame(22, 2.6); });
        une('rangement', TC + 0.60, function () { jouer('rangement'); });
      } else {
        une('emporte', TC + 0.18, function () { if (o.secousseCamera) { impulsion(R.roulis, 36); impulsion(R.tangage, -12); } });
        une('revers', TC + 0.30, function () { jouer('moulinet'); });
        une('rangement', TC + 0.68, function () { jouer('rangement'); });
      }
    }
    function versMonde(v) {
      if (cameraVue) { camera.updateMatrixWorld(); v.applyMatrix4(camera.matrixWorld); }
      return v;
    }
    function projeterDepuisLame(n, force) {
      if (sangLame < 0.08) return;
      versMonde(arme.localToWorld(pointeMonde.copy(crochet)));
      vPointe.copy(pointeMonde).sub(vDernierePointeMonde);
      var dir = vPointe.lengthSq() > 1e-8 ? vPointe.normalize() : camDir;
      emettreSang(pointeMonde, dir, Math.round(n * Math.min(1, sangLame + 0.3)), { vitesse: force, dispersion: 0.8, montee: 0.2, vie: 0.8, taille: 0.009, flaque: 0.15 });
    }
    function abaissement() {
      if (etat === 'repos') return 0;
      var fin = DUREE[branche];
      if (tSeq < 0.06) return Math.max(abaisseDepart, E.outCubic(tSeq / 0.06));
      if (tSeq > fin - 0.17) return 1 - E.inOutSine(clamp((tSeq - (fin - 0.17)) / 0.17, 0, 1));
      return 1;
    }

    var fwdPrec = null, vFwd = new V3(), qInvCam = new Q(), balY = 0, balX = 0;
    function balancement(dt) {
      // inertie : le couteau traîne légèrement derrière la caméra quand elle tourne
      camera.getWorldDirection(vFwd);
      var cibleX = 0, cibleY = 0;
      if (fwdPrec && dt > 0) {
        camera.getWorldQuaternion(qInvCam); if (qInvCam.invert) qInvCam.invert(); else qInvCam.inverse();
        var local = fwdPrec.clone().applyQuaternion(qInvCam);
        var vx = Math.atan2(local.x, -local.z) / dt, vy = Math.atan2(local.y, -local.z) / dt;
        cibleY = clamp(vx * 0.03, -0.09, 0.09); cibleX = clamp(-vy * 0.03, -0.07, 0.07);
      }
      fwdPrec = (fwdPrec || new V3()).copy(vFwd);
      var k = 1 - Math.exp(-dt * 10);
      balY += (cibleY - balY) * k; balX += (cibleX - balX) * k;
      balance.rotation.set(balX, balY, 0);
    }

    function retirerSecousse() {
      if (secousseAppliquee) { camera.quaternion.multiply(qSecousseInv); secousseAppliquee = false; }
      if (fovDecalage !== 0) { camera.fov -= fovDecalage; fovDecalage = 0; camera.updateProjectionMatrix(); }
    }
    function appliquerSecousseCamera(dt) {
      if (o.modeCamera === 'incremental') retirerSecousse();
      majRessort(R.tangage, dt); majRessort(R.lacet, dt); majRessort(R.roulis, dt); majRessort(R.fov, dt);
      var tx = 0, ty = 0;
      if (tremblement > 0) { tremblement -= dt; var a = 0.012 * clamp(tremblement / 0.14, 0, 1); tx = (Math.random() - 0.5) * a; ty = (Math.random() - 0.5) * a; }
      if (o.secousseCamera) {
        eSecousse.set(R.tangage.x * DEG + tx, R.lacet.x * DEG + ty, R.roulis.x * DEG, 'YXZ');
        qSecousse.setFromEuler(eSecousse);
        camera.quaternion.multiply(qSecousse);
        qSecousseInv.copy(qSecousse); qSecousseInv.invert ? qSecousseInv.invert() : qSecousseInv.inverse();
        secousseAppliquee = true;
      }
      if (o.secousseFOV) {
        // base = champ de vision du jeu, sans notre secousse de l'image précédente (si retirerSecousse n'a pas été appelé)
        var f = camera.fov - fovDecalage + R.fov.x;
        if (Math.abs(f - camera.fov) > 1e-4) { camera.fov = f; camera.updateProjectionMatrix(); }
        fovDecalage = R.fov.x;
      }
    }
    var gouttesLame = 0;
    function update(dtReel) {
      var dt = clamp(dtReel || 0, 0, 1 / 20) * echelleTemps;
      var dtAnim = dt;
      if (geleImpact > 0) { geleImpact -= dt; dtAnim = dt * 0.04; }
      if (etat === 'actif') {
        if (rig.visible) versMonde(arme.localToWorld(vDernierePointeMonde.copy(crochet)));
        tSeq += dtAnim;
        evenements();
        if (branche === 'touche') traineeActive = (tSeq > 0.14 && tSeq < TC + 0.04) ? 1 : (tSeq > TC + 0.18 && tSeq < TC + 0.34 ? 0.6 : 0);
        else traineeActive = (tSeq > 0.14 && tSeq < TC + 0.28) ? 1 : (tSeq > TC + 0.30 && tSeq < TC + 0.46 ? 0.5 : 0);
        evaluer(SEQ[branche], tSeq, poseCourante);
        if (tFondu > 0) {
          tFondu = Math.max(0, tFondu - dtAnim);
          var kf = 1 - tFondu / DUREE_FONDU; kf = kf * kf * (3 - 2 * kf);
          poseCourante.p.lerpVectors(poseDepart.p, poseCourante.p, kf);
          qFondu.copy(poseDepart.q).slerp(poseCourante.q, kf); poseCourante.q.copy(qFondu);
          poseCourante.flick = lerp(poseDepart.flick, poseCourante.flick, kf);
          poseCourante.roulis = lerp(poseDepart.roulis, poseCourante.roulis, kf);
        }
        appliquerPose(poseCourante);
        if (demandeEnAttente && o.enchainement && tSeq >= FENETRE[branche] && geleImpact <= 0 && tSeq < DUREE[branche]) { demandeEnAttente = false; frapper(); }
        else if (tSeq >= DUREE[branche]) {
          etat = 'repos'; rig.visible = false; traineeForce = 0;
          if (demandeEnAttente) { demandeEnAttente = false; frapper(); }
        }
      }
      majImpacts(dt);
      if (rig.visible) {
        balancement(dt);
        rig.updateMatrixWorld(true);
        majTrainee(dtAnim);
        // le sang ruisselle et goutte du crochet pendant que la lame est sortie
        if (sangLame > 0.25) { gouttesLame -= dt; if (gouttesLame <= 0) { gouttesLame = 0.16 + Math.random() * 0.2; projeterDepuisLame(1, 0.2); } }
      } else { fwdPrec = null; }
      majSaignements(dt);
      majParticules(dt);
      majFlaques(dt);
      if (delaiSechage > 0) delaiSechage -= dt; else sangLame = Math.max(0, sangLame - dt * 0.03);
      M.sang.opacity = sangLame;
      M.sang.visible = sangLame > 0.01;
      appliquerSecousseCamera(dt);
    }

    function rendreVue(r) {
      if (!sceneVue || !rig.visible || !r) return;
      if (cameraVue.aspect !== camera.aspect) { cameraVue.aspect = camera.aspect; cameraVue.updateProjectionMatrix(); }
      var ac = r.autoClear; r.autoClear = false;
      r.clearDepth();
      r.render(sceneVue, cameraVue);
      r.autoClear = ac;
    }
    function annuler() {
      etat = 'repos'; tSeq = 0; rig.visible = false; demandeEnAttente = false; traineeForce = 0; tFondu = 0; geleImpact = 0;
      impacts.length = 0; tremblement = 0;
      ['tangage', 'lacet', 'roulis', 'fov'].forEach(function (n) { R[n].x = 0; R[n].v = 0; });
      retirerSecousse();
    }
    function surTouche(e) {
      if (e.code === o.touche || (o.touche === 'KeyV' && (e.key === 'v' || e.key === 'V'))) {
        if (e.repeat) return;
        frapper();
      }
    }
    if (o.ecouterClavier && typeof window !== 'undefined') window.addEventListener('keydown', surTouche);

    return {
      rig: rig, modele: arme, main: main,
      sceneVue: sceneVue, cameraVue: cameraVue, lumieres: lumVue, rendreVue: rendreVue, annuler: annuler,
      update: update,
      frapper: frapper,
      get occupe() { return etat !== 'repos'; },
      get abaissementArme() { return abaissement(); },
      get dernierResultat() { return resultat; },
      get sangSurLame() { return sangLame; },
      set sangSurLame(v) { sangLame = clamp(v, 0, 0.95); delaiSechage = 10; },
      get saignements() { return saignes.filter(function (s) { return s.restant > 0; }).length; },
      echelleTemps: function (s) { echelleTemps = clamp(s, 0.02, 2); },
      regler: function (opts) {
        Object.assign(o, opts || {});
        if (opts && opts.saignement) o.saignement = Object.assign({ part: 0.5, duree: 4, pas: 0.5 }, opts.saignement);
        if (audio.maitre && opts && opts.volume !== undefined) audio.maitre.gain.value = opts.volume;
      },
      retirerSecousse: retirerSecousse,
      activerSon: function () { ctxAudio(); },
      debug: {
        poser: function (nomBranche, t) {
          branche = nomBranche; rig.visible = true;
          appliquerPose(evaluer(SEQ[nomBranche], t, poseCourante));
          rig.updateMatrixWorld(true);
        },
        poserLibre: function (pz) {   // pose libre (réglage des clés) : { p, lame, coude, flick, roulis }
          rig.visible = true;
          var Y = new V3().fromArray(pz.lame).normalize(), h = new V3().fromArray(pz.coude).normalize();
          appliquerPose({ p: new V3().fromArray(pz.p), q: baseMain(Y, h, new Q()), flick: (pz.flick || 0) * DEG, roulis: (pz.roulis || 0) * DEG });
          rig.updateMatrixWorld(true);
        },
        duree: DUREE, contact: T_CONTACT, poses: POSES, seq: SEQ, branche: function () { return branche; }
      },
      detruire: function () {
        if (typeof window !== 'undefined') window.removeEventListener('keydown', surTouche);
        retirerSecousse();
        porteur.remove(rig); scene.remove(particules); scene.remove(flaques);
        rig.traverse(function (m) { if (m.geometry) m.geometry.dispose(); });
        Object.keys(M).forEach(function (kk) { M[kk].dispose(); });
        Object.keys(tex).forEach(function (kk) { tex[kk].dispose(); });
        geoP.dispose(); matP.dispose(); geoFlaque.dispose();
        if (audio.ctx && audio.ctx.close) audio.ctx.close();
      }
    };
  }

  global.creerKhepesh = creerKhepesh;
  if (typeof module !== 'undefined' && module.exports) module.exports = creerKhepesh;
})(typeof window !== 'undefined' ? window : globalThis);
