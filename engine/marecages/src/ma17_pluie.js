/* ================================================================ La pluie ==
   Kit 2.0.7. Demande d'Anthony (31 octobre 2026) : « Ajoute de la pluie dans la carte, ainsi qu'un gros
   orage. Une pluie assez intensive, et assez réaliste. Les gouttes d'eau qui tombent sur le bois doivent
   être différentes de la goutte d'eau qui tombe sur de la boue, tout comme elle doit être différente quand
   elle tombe sur l'eau du marécage elle-même. […] Que ce soit pour la pluie ou l'orage, crée ou importe des
   sons réels, ça doit être réel, et impressionnant à voir et entendre. » Choisi avec lui : la pluie tombe
   par épisodes (des averses, avec ou sans orage, et du temps sec entre deux : la brume, la lune et les
   étoiles d'avant).

   Le temps (MA_WX) : temps sec (2 min 30 à 5 min ; le premier, 25 à 45 s), puis une averse (3 min 30 à 7 min) :
   le ciel se couvre (20 s), la pluie monte (25 à 50 s), un à trois moments forts séparés d'accalmies, la
   fin (30 à 60 s) ; six averses sur dix (et toujours la première) portent un orage (ma18). Pendant l'averse :
   la lune et les étoiles disparaissent, la lumière baisse, le brouillard et la brume s'épaississent, le vent
   se lève et penche la pluie, le sol se mouille (plus sombre, plus brillant ; il sèche lentement ensuite).

   Ce qu'on voit :
     · le rideau de pluie : des milliers de traits (un volume proche de 22 m, un lointain de 72 m), calculés
       par la carte graphique (aucun calcul par goutte) ; ils tombent à 8 à 10 m/s, penchés par le vent ;
       pas de pluie sous un toit (une carte des toits du marais, 1 m) ; ils s'éclairent aux lanternes, dans
       le faisceau du projecteur de la barque et, d'un coup, à chaque éclair ;
     · les impacts, autour de la caméra (jusqu'à 2 200 par seconde à 9 m), différents selon la surface :
         eau : une couronne puis une petite colonne d'eau qui jaillit, coiffée d'une goutte (le rond qui
               s'élargit est dans l'eau elle-même : ronds de pluie calculés sur toute la surface proche) ;
         bois (pontons, passerelles, barques) : la goutte éclate à plat, une gerbe de gouttelettes claires
               qui rebondissent ;
         boue (terre, mousse, berges) : une gerbe basse et sombre de grosses gouttes de vase, un petit
               cratère ;
     · l'eau du marais sous l'averse : ronds de pluie partout près de soi, reflets brouillés (ma03) ;
     · le sol (ma01) et les planches, rondins, bardages, toits, pierres, aciers (maWxWetMats) se mouillent :
       plus sombres, plus lisses, ils brillent sous les lanternes et les éclairs ; ils sèchent lentement ;
       sous un toit, rien ;
     · les grillons et les oiseaux se taisent sous l'averse, les grenouilles reprennent après (ma10).
   Ce qu'on entend (sons calculés au chargement, voir plus bas) : la pluie sur l'eau, le bois, la boue, le
   feuillage, le lointain, le toit (à l'intérieur), mêlés selon ce qui entoure le joueur (dans un rayon de
   7 m) ; de grosses gouttes toutes proches, une à une ; dedans, le dehors est étouffé. La pluie reste sous le
   tonnerre (MA_WXC.vol) : une forte averse vers −27 dBFS à la sortie du jeu (−24 dBFS mesurés avec l'ancien réglage).
   Pas de pluie dans l'éditeur des Mod Tools.

   31 octobre, 2e version (chez Anthony, Windows et Firefox : « un son assez étourdissant (vent/pluie) mais je ne
   vois pas de pluie ni l'orage » ; pas reproduit ici, Firefox et Chromium, 1280×635 à 2000×762, qualités basse à
   haute, son à 44,1 et 48 kHz) :
     · le rideau : le toit est testé dans le fragment (plus de lecture de texture dans le sommet) ; au chargement,
       maWxSelfTest dessine le rideau seul dans une petite cible et compte ce qui sort : rien ? la version simple
       (ni texture, ni lanternes) le remplace ; le résultat est dans F8 (« rendu de la pluie ») et la console ;
     · la pluie se voit dès qu'elle s'entend : la part des traits suit I^0,75 (et les impacts, les ronds dans
       l'eau), les sons suivent I (avant : I^0,7 à I^0,85, ils montaient avant le rideau) ; sons −2,7 dB ;
     · le vent de l'orage (ma10) : +3 à +6 dB au plus fort (avant : jusqu'à +10 dB) ;
     · l'orage s'annonce (ma18) : un premier éclair dans les nuages 3 à 9 s après son début, un premier moment
       fort dans le premier tiers, des éclairs épars entre deux ; la première averse arrive plus tôt. Mesuré
       sur 20 parties : premières gouttes à 51-70 s, premier éclair à 63-93 s, premier impact au sol à 82-115 s ;
     · les bancs de la chapelle (cases basses au milieu d'un bloc) étaient hors de la carte des toits : il y
       pleuvait ; la carte gagne de proche en proche les meubles, puis les murs ;
     · une erreur dans l'orage, les impacts ou les sons n'arrête plus le reste (signalée une fois : F8, console).
   Réglages : MA_WXC. Crochets : maOn('meteo', …). Console : ZS.marais.meteo (etat, pluie, orage, sec, eclair).
   ============================================================================================ */
const MA_WXC = {
  dry: [150, 300], firstDry: [25, 45],               // s : temps sec (le premier : la première averse arrive vite ; 35-70 s avant le 31 octobre)
  shower: [210, 420], rampIn: [25, 50], rampOut: [30, 60],
  peak: [0.62, 1.0], lull: [0.3, 0.6],               // intensité des moments forts, des accalmies (1 : diluvienne)
  stormP: 0.6,                                       // part des averses avec un orage (la première en a toujours un)
  coverLead: 20, coverOut: 50,                       // s : le ciel se couvre avant les gouttes ; il se dégage ensuite
  fall: [8.2, 9.8],                                  // m/s : vitesse des gouttes
  near: [11, 7, 0.032, 0.0042], far: [36, 15, 0.06, 0.0085],   // volumes : demi-largeur, demi-hauteur (m), pose (s), épaisseur (m)
  streaks: { high: [15000, 6000], medium: [10500, 4000], low: [4800, 1800] },
  splash: { r: 9, rate: 3000, n: 2600 },             // m, impacts par seconde à pleine intensité, réserve
  fogK: 0.6, hfK: 0.5, moonK: 0.72, wetIn: 40, wetOut: 170,
  vol: 0.55,                                         // force des sons de pluie (le tonnerre doit passer au-dessus ; 0,75 avant le 31 octobre au soir : trop fort)
};
const MA_WX = { ep: 'sec', t: 0, dur: 60, I: 0, It: 0, cover: 0.3, cover0: 0.3, wet: 0, keys: null, n: 0, force: null, gust: 0, gT: 0, armB: 0,
  wind: [0, 0], windA: 0, windS: 0.6, rain: null, splash: null, roofTex: null, sur: { water: 0, wood: 0, mud: 1, leaves: 0, t: 0 }, spawnAcc: 0, t0: 0, nSpl: 0, ready: false };
const MA_WXU = {
  uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uI: { value: 0 }, uWater: { value: 0 },
  uBox0: { value: new THREE.Vector4() }, uBox1: { value: new THREE.Vector4() }, uFall: { value: new THREE.Vector2(8.2, 9.8) }, uWind: { value: new THREE.Vector2() },
  uRoof: { value: null }, uAmb: { value: new THREE.Vector3() }, uFlashC: { value: new THREE.Vector3() }, uFlashD: { value: new THREE.Vector3(0, 1, 0) },
  uLamp: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -500, 0, 1)) }, uLampC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
  uSpotP: { value: new THREE.Vector4(0, -500, 0, 0) }, uSpotD: { value: new THREE.Vector4(0, -1, 0, 0.9) }, uFog: { value: 0.01 }, uPx: { value: 0.001 }, uScale: { value: 600 },
  uRes: { value: new THREE.Vector2(1280, 720) },
};
/* L'éclairage d'une goutte (traits et impacts) : le ciel, l'éclair (plus fort à contre-jour : la goutte diffuse
   vers l'avant), les quatre lanternes allumées les plus proches, le projecteur de la barque. */
const MA_WX_LIGHT_GLSL = `
uniform vec3 uAmb, uFlashC, uFlashD; uniform vec4 uLamp[4]; uniform vec3 uLampC[4]; uniform vec4 uSpotP, uSpotD;
vec3 maWxLight(vec3 p, vec3 V) {
  vec3 c = uAmb + uFlashC * (0.45 + 1.6 * pow(max(dot(V, uFlashD), 0.0), 3.0));
  for (int i = 0; i < 4; i++) {
    vec3 L = uLamp[i].xyz - p; float d2 = dot(L, L);
    c += uLampC[i] / (1.0 + d2 / (uLamp[i].w * uLamp[i].w)) * (0.35 + 1.8 * pow(max(dot(V, L * inversesqrt(max(d2, 1e-4))), 0.0), 4.0));
  }
  vec3 S = uSpotP.xyz - p; float sd = length(S); vec3 Sn = S / max(sd, 1e-3);
  float cs = dot(-Sn, uSpotD.xyz);
  c += vec3(1.0, 0.93, 0.8) * uSpotP.w * smoothstep(uSpotD.w, uSpotD.w + 0.06, cs) / (1.0 + sd * sd / 90.0) * (0.4 + 1.8 * pow(max(dot(V, Sn), 0.0), 3.0));
  return c;
}`;

/* ---------------------------------------------------------------- Le temps --
   Courbe d'une averse : [t, intensité] (le ciel se couvre, montée, moments forts et accalmies, fin). */
function maWxKeys() {
  const C = MA_WXC, a = rand(C.rampIn[0], C.rampIn[1]), b = rand(C.rampOut[0], C.rampOut[1]), dur = rand(C.shower[0], C.shower[1]);
  const k = [[0, 0], [C.coverLead, 0]], body = dur - a - b, np = 1 + Math.floor(Math.random() * 3);
  let t = C.coverLead + a;
  k.push([t, rand(C.peak[0], C.peak[1]) * 0.85]);
  for (let i = 0; i < np; i++) {
    const seg = body / np;
    k.push([t + seg * rand(0.25, 0.5), rand(C.peak[0], C.peak[1])]);
    if (i < np - 1) k.push([t + seg * rand(0.7, 0.95), rand(C.lull[0], C.lull[1])]);
    t += seg;
  }
  k.push([C.coverLead + dur - b, rand(C.peak[0], C.peak[1]) * 0.8], [C.coverLead + dur, 0]);
  return { k, dur: C.coverLead + dur, a, b };
}
function maWxCurve(K, t) {
  if (!K) return 0;
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [t0, v0] = K[i - 1], [t1, v1] = K[i]; return lerp(v0, v1, smooth(clamp((t - t0) / Math.max(1e-3, t1 - t0), 0, 1))); }
  return 0;
}
/* Épisode suivant (sec → averse → sec…). first : la première averse de la partie. */
function maWxNext(to) {
  const C = MA_WXC, W = MA_WX;
  W.ep = to || (W.ep === 'averse' ? 'sec' : 'averse'); W.t = 0;
  if (W.ep === 'sec') {
    W.dur = W.n === 0 ? rand(C.firstDry[0], C.firstDry[1]) : rand(C.dry[0], C.dry[1]);
    W.cover0 = rand(0.12, 0.45); W.keys = null;
    if (typeof maStormEnd === 'function') maStormEnd(false);
    maEmit('meteo', { what: 'sec', dur: Math.round(W.dur) });
  } else {
    const S = maWxKeys();
    W.keys = S.k; W.dur = S.dur; W.n++;
    const storm = W.force !== null ? W.force : W.n === 1 || Math.random() < C.stormP;      // force : imposé (console)
    W.force = null;
    // l'orage arrive quand la pluie est bien là (la première averse de la partie : 6 à 25 s après les premières gouttes)
    if (storm && typeof maStormPlan === 'function') maStormPlan(C.coverLead + S.a * (W.n === 1 ? rand(0.25, 0.5) : rand(0.2, 0.9)), S.dur - C.coverLead - S.a - S.b * 0.5);
    maEmit('meteo', { what: 'averse', n: W.n, dur: Math.round(S.dur), orage: storm });
  }
}
function maWxReset() {
  const W = MA_WX;
  W.n = 0; W.I = 0; W.It = 0; W.wet = 0; W.cover = W.cover0 = 0.3; W.force = null;
  W.ep = 'averse'; maWxNext('sec');
  if (typeof maStormReset === 'function') maStormReset();
}
/* Chaque image (menu compris) : épisode, intensité, vent, ciel, sol mouillé. */
function maWxStep(dt) {
  const C = MA_WXC, W = MA_WX;
  W.t += dt;
  if (W.t >= W.dur) maWxNext();
  const rain = W.ep === 'averse';
  W.It = rain ? maWxCurve(W.keys, W.t) : 0;
  const boost = typeof maStormRainBoost === 'function' ? maStormRainBoost() : 0;
  // de petites variations rapides (des rideaux plus denses qui passent)
  W.gT -= dt;
  if (W.gT <= 0) { W.gT = rand(1.5, 5); W.gust = rand(-0.12, 0.12); }
  W.I = damp(W.I, clamp(W.It * (1 + W.gust) + boost * W.It, 0, 1), 1.2, dt);
  // le ciel se couvre avant la pluie, se dégage après
  const cT = rain ? (W.t < C.coverLead ? lerp(W.cover0, 1, W.t / C.coverLead) : 1) : W.cover0;
  W.cover = damp(W.cover, cT, rain ? 0.6 : 1 / C.coverOut * 3, dt);
  // le vent : sa direction tourne lentement ; il forcit sous l'averse et dans l'orage
  W.windA += dt * 0.02 * Math.sin(OW.t * 0.013);
  const stormW = typeof maStormWind === 'function' ? maStormWind() : 0;
  W.windS = damp(W.windS, 0.6 + 2.6 * W.I + stormW, 0.4, dt);
  const g = 1 + 0.35 * Math.sin(OW.t * 0.71) * Math.sin(OW.t * 0.23 + 1.3);
  W.wind[0] = Math.cos(W.windA + 0.6) * W.windS * g; W.wind[1] = Math.sin(W.windA + 0.6) * W.windS * g;
  // le sol se mouille vite, sèche lentement
  W.wet = clamp(W.wet + (W.I > 0.05 ? dt / C.wetIn * W.I * 1.5 : -dt / C.wetOut), 0, 1);
}

/* ---------------------------------------------------------------- Carte des toits --
   1 m par case : la hauteur du dessus du toit (0 : à ciel ouvert), en huitièmes de mètre depuis l'eau − 2 m. */
function maWxRoofTex() {
  const S = 1024, data = new Uint8Array(S * S * 4), L = OW.surf, kd = new Uint8Array(S * S).fill(255);
  for (let ci = 0; ci < L.chunks.length; ci++) {
    const ch = L.chunks[ci];
    if (!ch) continue;
    const cx0 = (ci % L.CW) * 64, cz0 = Math.floor(ci / L.CW) * 64;
    if (cx0 >= S || cz0 >= S) continue;
    for (let i = 0; i < 4096; i++) {
      const k = ch.kind[i], x = cx0 + (i & 63), z = cz0 + (i >> 6);
      if (x >= S || z >= S) continue;
      kd[z * S + x] = k;
      if (!(ch.ceil[i] > 0) || (k !== OWK.FLOOR && k !== OWK.RAMP)) continue;
      const top = ch.roof[i] > ch.ceil[i] ? ch.roof[i] : ch.ceil[i] + 0.3;
      data[(z * S + x) * 4] = clamp(Math.round((top - (MA.water - 2)) * 8), 1, 255);
    }
  }
  // les meubles d'une pièce couverte (bancs de la chapelle, lits, tables : cases basses), puis ses murs, portes et
  // fenêtres : sous le même toit que les cases voisines. Les meubles d'abord, de proche en proche (un bloc de bancs
  // de 3 cases : son milieu ne touche aucune case de plancher ; 31 octobre : il pleuvait sur les bancs, dans la
  // chapelle), puis les murs, deux fois (ceux qui ne touchent que des meubles).
  const low = [], wall = [];
  for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) {
    const k = kd[z * S + x];
    if (k === OWK.LOW) low.push(z * S + x);
    else if (k === OWK.SOLID || k === OWK.WINDOW || k === OWK.DOOR) wall.push(z * S + x);
  }
  const grow = (list) => {
    const add = [];
    for (const c of list) {
      if (data[c * 4]) continue;
      let m = 0;
      for (let dz = -S; dz <= S; dz += S) for (let dx = -1; dx <= 1; dx++) { const v = data[(c + dz + dx) * 4]; if (v > m) m = v; }
      if (m) add.push(c, m);
    }
    for (let i = 0; i < add.length; i += 2) data[add[i] * 4] = add[i + 1];
    return add.length;
  };
  for (let p = 0; p < 4 && grow(low); p++);
  grow(wall); grow(wall);
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

/* ---------------------------------------------------------------- Le rideau de pluie -- */
function maWxBuildRain(root) {
  const C = MA_WXC, Q = C.streaks[settings.quality] || C.streaks.medium, n = Q[0] + Q[1], nv = n * 4;
  const pos = new Float32Array(nv * 3), seed = new Float32Array(nv * 4), crn = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(n * 6) : new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    const s0 = Math.random(), s1 = Math.random(), s2 = Math.random(), s3 = Math.random(), L = i < Q[0] ? 0 : 1;
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v;
      seed[k * 4] = s0; seed[k * 4 + 1] = s1; seed[k * 4 + 2] = s2; seed[k * 4 + 3] = s3;
      crn[k * 3] = v & 1 ? 1 : -1; crn[k * 3 + 1] = v >> 1; crn[k * 3 + 2] = L;
    }
    const b = i * 4, j = i * 6;
    idx[j] = b; idx[j + 1] = b + 1; idx[j + 2] = b + 2; idx[j + 3] = b + 1; idx[j + 4] = b + 3; idx[j + 5] = b + 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aCrn', new THREE.BufferAttribute(crn, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = maWxRainMat(false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.name = 'pluie';
  mesh.visible = true;
  root.add(mesh);
  return { mesh, mat, n, safe: false };
}
/* La matière du rideau. Kit 2.0.7 (31 octobre, 2e version) : chez Anthony (Windows, Firefox), on entendait la
   pluie sans la voir. Le test du toit se fait maintenant dans le fragment (plus de lecture de texture dans le
   sommet : certaines cartes ou certains réglages de confidentialité de Firefox n'en donnent pas), et une
   version simple (safe : ni texture, ni boucle sur les lanternes) sert de secours si le test au chargement
   (maWxSelfTest) ne voit rien sortir de la normale.
   Densité : la part des traits suit uI^0,75 (la pluie se voit dès qu'elle s'entend). Un trait masqué
   (au-delà de la densité, hors du volume) est écarté dès le sommet : ni fragments, ni calcul de lumière. */
function maWxRainMat(safe) {
  const vs = [
    'attribute vec4 aSeed; attribute vec3 aCrn;',
    'uniform float uT, uI, uWater, uFog, uPx; uniform vec3 uCam; uniform vec4 uBox0, uBox1; uniform vec2 uFall, uWind;',
    safe ? 'uniform vec3 uAmb, uFlashC, uFlashD;' : MA_WX_LIGHT_GLSL,
    'varying vec3 vC; varying vec2 vUv; varying float vA; varying vec3 vW;',
    'void main() {',
    '  vec4 B = aCrn.z < 0.5 ? uBox0 : uBox1;',
    '  float show = step(aSeed.w, pow(max(uI, 0.0), 0.75) * (aCrn.z < 0.5 ? 1.0 : 0.85));',
    '  float v = mix(uFall.x, uFall.y, fract(aSeed.w * 7.13 + aSeed.x));',
    '  vec3 vel = vec3(uWind.x, -v, uWind.y), ext = vec3(B.x, B.y, B.x);',
    '  vec3 rel = mod(aSeed.xyz * 2.0 * ext + vel * uT - uCam + ext, 2.0 * ext) - ext;',
    '  vec3 head = uCam + rel, tail = head - vel * B.z;',
    // pas de pluie sous l'eau (le toit : dans le fragment)
    '  float a = show * step(uWater - 0.03, head.y);',
    '  float dist = length(head - cameraPosition);',
    '  a *= smoothstep(0.5, 2.0, dist) * (1.0 - smoothstep(0.72, 1.0, length(rel.xz) / B.x)) * (1.0 - smoothstep(0.75, 1.0, abs(rel.y) / B.y));',
    '  a *= exp(-uFog * uFog * dist * dist * 0.6);',
    '  if (a < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vC = vec3(0.0); vUv = vec2(0.0); vA = 0.0; vW = vec3(0.0); return; }',
    '  vec4 h = modelViewMatrix * vec4(head, 1.0), t = modelViewMatrix * vec4(tail, 1.0);',
    '  vec4 me = aCrn.y < 0.5 ? t : h;',
    '  vec2 d = h.xy / max(0.05, -h.z) - t.xy / max(0.05, -t.z);',
    '  d = dot(d, d) > 1e-10 ? normalize(d) : vec2(0.0, 1.0);',
    '  float px = max(0.05, -me.z) * uPx, wid = max(B.w, px * 1.15);',
    '  a *= B.w / wid;',
    '  me.xy += vec2(-d.y, d.x) * wid * aCrn.x;',
    '  gl_Position = projectionMatrix * me;',
    // (plafonné : une goutte toute proche dans l'éclair ne doit pas devenir un trait blanc qui barre l'écran)
    safe ? '  vC = min(uAmb + uFlashC * (0.45 + 1.6 * pow(max(dot(normalize(head - cameraPosition), uFlashD), 0.0), 3.0)), vec3(1.1));'
      : '  vC = min(maWxLight(head, normalize(head - cameraPosition)), vec3(1.1));',
    '  vA = a; vUv = aCrn.xy; vW = aCrn.y < 0.5 ? tail : head;',
    '}',
  ].join('\n');
  const fs = [
    safe ? '' : 'uniform sampler2D uRoof; uniform float uWater;',
    'varying vec3 vC; varying vec2 vUv; varying float vA; varying vec3 vW;',
    'void main() {',
    // le toit d'abord (lecture sans condition), puis les rejets : sous un toit, pas de pluie
    safe ? '' : '  float rh = texture2D(uRoof, (floor(vW.xz) + 0.5) / 1024.0).r;',
    safe ? '' : '  if (rh > 0.0 && vW.y < uWater - 2.0 + rh * 255.0 / 8.0) discard;',
    '  float k = exp(-vUv.x * vUv.x * 3.0) * smoothstep(0.0, 0.4, vUv.y) * (0.5 + 0.5 * vUv.y);',
    '  gl_FragColor = vec4(vC * k * vA, 1.0);',
    '  #include <encodings_fragment>',
    '}',
  ].join('\n');
  return new THREE.ShaderMaterial({
    uniforms: MA_WXU, vertexShader: vs, fragmentShader: fs,
    // les deux faces : le sens du ruban à l'écran dépend de la chute (sinon une moitié des traits est écartée)
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
  });
}
/* Le rideau se voit-il sur cette machine ? Au chargement : une image du rideau seul (pleine averse, éclairé
   en blanc), dans une petite cible, vue d'en haut de la carte (ni toit, ni eau), lue en retour. Si rien ne
   sort de la version normale (programme refusé par le pilote, ou autre), la version simple la remplace ; le
   résultat va dans F8 (« rendu de la pluie ») et dans la console. */
function maWxDrawTest(mat, live) {
  const W = MA_WX, U = MA_WXU, C = MA_WXC, w = 96, h = 64, out = { lit: 0, prog: '—', err: null };
  if (live) return maWxDrawLive(mat, out, w, h);
  let rt = null;
  const keep = {};
  for (const k of ['uI', 'uT', 'uFog', 'uPx']) keep[k] = U[k].value;
  const vk = {};
  for (const k of ['uCam', 'uAmb', 'uFlashC', 'uWind', 'uBox0', 'uBox1', 'uFall', 'uSpotP']) vk[k] = U[k].value.clone();
  const lk = U.uLampC.value.map((v) => v.clone());
  const prevRT = renderer.getRenderTarget(), prevCC = renderer.getClearColor(new THREE.Color()), prevCA = renderer.getClearAlpha();
  try {
    rt = new THREE.WebGLRenderTarget(w, h);
    rt.texture.encoding = renderer.outputEncoding;      // la même variante de programme qu'à l'écran
    const cam = new THREE.PerspectiveCamera(60, w / h, 0.1, 200);
    cam.position.set(300, MA.water + 70, 300); cam.lookAt(300, MA.water + 70, 280); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    U.uI.value = 1; U.uT.value = 7.3; U.uFog.value = 0; U.uPx.value = 2 * Math.tan(Math.PI / 6) / h;
    U.uCam.value.copy(cam.position); U.uAmb.value.set(1, 1, 1); U.uFlashC.value.set(0, 0, 0); U.uWind.value.set(0, 0); U.uSpotP.value.w = 0;
    U.uBox0.value.set(C.near[0], C.near[1], C.near[2], C.near[3]); U.uBox1.value.set(C.far[0], C.far[1], C.far[2], C.far[3]); U.uFall.value.set(C.fall[0], C.fall[1]);
    for (const v of U.uLampC.value) v.set(0, 0, 0);
    const sc = new THREE.Scene(), m = new THREE.Mesh(W.rain.mesh.geometry, mat);
    m.frustumCulled = false; sc.add(m);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    renderer.render(sc, cam);
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 24) out.lit++;
    const pm = renderer.properties.get(mat), P = pm && pm.currentProgram;
    out.prog = !P ? 'absent' : P.diagnostics && !P.diagnostics.runnable ? 'refusé par le pilote' : 'compilé';
    if (P && P.diagnostics && !P.diagnostics.runnable) out.log = String(P.diagnostics.programLog || '').slice(0, 200) + ' ' + String(P.diagnostics.vertexShader.log || '').slice(0, 300) + ' ' + String(P.diagnostics.fragmentShader.log || '').slice(0, 300);
  } catch (e) { out.err = String((e && e.message) || e).slice(0, 200); }
  finally {
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevCC, prevCA);
    if (rt) rt.dispose();
    for (const k in keep) U[k].value = keep[k];
    for (const k in vk) U[k].value.copy(vk[k]);
    U.uLampC.value.forEach((v, i) => v.copy(lk[i]));
  }
  return out;
}
/* En jeu, une fois par chargement : la première fois que l'averse est forte (I > 0,4) et qu'on est dehors, le rideau
   seul, vu de la caméra du jeu, avec les réglages du moment (rien de changé). Rien ne sort ? Les réglages vont à la
   console, la version simple est essayée, F8 le dit (« vu en jeu »). */
function maWxDrawLive(mat, out, w, h) {
  let rt = null;
  const U = MA_WXU, amb = U.uAmb.value.clone(), fog = U.uFog.value;
  const prevRT = renderer.getRenderTarget(), prevCC = renderer.getClearColor(new THREE.Color()), prevCA = renderer.getClearAlpha();
  try {
    // la lumière seule est forcée (blanche, sans brouillard) : on cherche si les traits sortent, pas s'ils sont clairs
    U.uAmb.value.set(1, 1, 1); U.uFog.value = 0;
    rt = new THREE.WebGLRenderTarget(w, h);
    rt.texture.encoding = renderer.outputEncoding;
    const sc = new THREE.Scene(), m = new THREE.Mesh(MA_WX.rain.mesh.geometry, mat);
    m.frustumCulled = false; sc.add(m);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    // de là où est la caméra du jeu, mais à l'horizontale (regard au sol : peu de traits entre l'œil et le sol)
    const G0 = viewCamera || camera, cam = new THREE.PerspectiveCamera(G0.fov || 60, w / h, G0.near || 0.1, G0.far || 2600);
    const d = G0.getWorldDirection(new THREE.Vector3());
    cam.position.copy(G0.position); cam.lookAt(G0.position.x + (Math.abs(d.x) + Math.abs(d.z) > 1e-3 ? d.x : 1), G0.position.y, G0.position.z + d.z);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    renderer.render(sc, cam);
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 24) out.lit++;
  } catch (e) { out.err = String((e && e.message) || e).slice(0, 200); }
  finally { renderer.setRenderTarget(prevRT); renderer.setClearColor(prevCC, prevCA); if (rt) rt.dispose(); U.uAmb.value.copy(amb); U.uFog.value = fog; }
  return out;
}
function maWxProbe() {
  const W = MA_WX, U = MA_WXU;
  if (!W.rain || W.probe || W.I < 0.4 || (MA.inside || 0) > 0.2 || G.state !== 'playing' || !W.rain.mesh.visible || (viewCamera || camera).position.y < MA.water + 0.5) return;
  const r = maWxDrawTest(W.rain.mat, true);
  W.probe = { lit: r.lit, err: r.err, mode: W.rain.safe ? 'simple' : 'normal' };
  if (r.lit >= 40) { console.info(`marais : la pluie se voit en jeu (${r.lit} px au test, intensité ${W.I.toFixed(2)})`); return; }
  const v = (x) => (x && x.toArray ? x.toArray().map((n) => +n.toFixed(4)) : typeof x === 'number' ? +x.toFixed(5) : x);
  maErr('marais : la pluie ne se voit pas en jeu (' + r.lit + ' px' + (r.err ? ', ' + r.err : '') + ') · ' + JSON.stringify({ uI: v(U.uI.value), uT: v(U.uT.value), uCam: v(U.uCam.value), uWater: v(U.uWater.value), uFog: v(U.uFog.value), uPx: v(U.uPx.value), uAmb: v(U.uAmb.value), uBox0: v(U.uBox0.value), uFall: v(U.uFall.value), uWind: v(U.uWind.value), cam: v((viewCamera || camera).position), fov: (viewCamera || camera).fov, h: renderer.domElement.height }));
  if (!W.rain.safe) {
    const safe = maWxRainMat(true), r2 = maWxDrawTest(safe, true);
    W.probe.simple = r2.lit;
    if (r2.lit >= 40) { W.rain.mesh.material = safe; W.rain.mat.dispose(); W.rain.mat = safe; W.rain.safe = true; W.probe.mode = 'simple'; }
    else safe.dispose();
  }
}
function maWxSelfTest() {
  const W = MA_WX;
  if (!W.rain || typeof renderer === 'undefined' || !renderer) return null;
  const R = { mode: 'normal', normal: maWxDrawTest(W.rain.mat), simple: null, gl: renderer.capabilities ? (renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1') + ', ' + renderer.capabilities.maxVertexTextures + ' textures de sommet' : '?' };
  if (R.normal.lit < 40) {
    const safe = maWxRainMat(true), r2 = maWxDrawTest(safe);
    R.simple = r2;
    if (r2.lit >= 40) { W.rain.mesh.material = safe; W.rain.mat.dispose(); W.rain.mat = safe; W.rain.safe = true; R.mode = 'simple'; }
    else { safe.dispose(); R.mode = 'invisible'; }
  }
  R.ok = R.mode !== 'invisible';
  // les autres nuanceurs de la pluie et de l'orage (compilés par maPrewarm) : les impacts, les éclairs
  const st = (m) => { if (!m) return '—'; const pm = renderer.properties.get(m), P = pm && pm.currentProgram; return !P ? 'absent' : P.diagnostics && !P.diagnostics.runnable ? 'REFUSÉ' : 'compilé'; };
  R.splash = st(W.splash && W.splash.pts.material);
  R.bolt = st(typeof MA_OR !== 'undefined' && MA_OR.mesh ? MA_OR.mesh.mesh.material : null);
  W.test = R;
  const bad = R.mode !== 'normal' || R.splash === 'REFUSÉ' || R.bolt === 'REFUSÉ';
  const msg = `marais : rendu de la pluie ${R.mode === 'normal' ? 'normal' : R.mode === 'simple' ? 'SIMPLE (la version normale ne s’affiche pas sur cette machine)' : 'IMPOSSIBLE sur cette machine'} · test ${R.normal.lit} px (${R.normal.prog}${R.normal.err ? ', ' + R.normal.err : ''})${R.simple ? ` · simple ${R.simple.lit} px (${R.simple.prog})` : ''} · impacts : ${R.splash} · éclairs : ${R.bolt} · ${R.gl}`;
  if (!bad) console.info(msg); else maErr(msg + (R.normal.log ? ' · ' + R.normal.log : ''));
  return R;
}

/* ---------------------------------------------------------------- Les impacts --
   Une réserve de points (position, instant, surface, taille, hasard, durée) : la carte graphique dessine
   chaque impact selon son âge ; la surface décide du dessin (0 eau, 1 bois, 2 boue). */
const MA_WX_SPL = [
  // durée (s), taille du dessin (m) : eau, bois, boue
  [0.34, 0.26], [0.22, 0.3], [0.28, 0.24],
];
function maWxBuildSplash(root) {
  const N = MA_WXC.splash.n, P = new Float32Array(N * 4), Q = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) P[i * 4 + 3] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aP', new THREE.BufferAttribute(P, 4));
  geo.setAttribute('aQ', new THREE.BufferAttribute(Q, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: MA_WXU,
    vertexShader: [
      'attribute vec4 aP; attribute vec4 aQ;',
      'uniform float uT, uScale;',
      MA_WX_LIGHT_GLSL,
      'varying vec3 vC; varying vec4 vQ; varying float vK;',
      'void main() {',
      '  float age = uT - aP.w;',
      '  vQ = aQ; vK = age / max(aQ.w, 1e-3); vC = vec3(0.0);',
      '  if (age < 0.0 || age > aQ.w) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
      '  vec3 p = aP.xyz + vec3(0.0, aQ.y * 0.36, 0.0);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = clamp(aQ.y * uScale / max(0.05, -mv.z), 0.0, 110.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  vC = maWxLight(p, normalize(p - cameraPosition));',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vC; varying vec4 vQ; varying float vK;',
      'float maDot(vec2 uv, vec2 c, float r) { return smoothstep(r, r * 0.35, length(uv - c)); }',
      'void main() {',
      '  vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);',
      '  float k = vK, t = vQ.x, rnd = vQ.z, a = 0.0;',
      '  vec3 alb;',
      '  if (t < 0.5) {',
      // eau : une couronne (vue de biais), puis la colonne qui jaillit et sa goutte
      '    vec2 q = (uv - vec2(0.5, 0.12)) * vec2(1.0, 3.4);',
      '    float cr = 0.07 + 0.3 * sqrt(k);',
      '    float ring = smoothstep(0.06, 0.0, abs(length(q) - cr)) * step(0.1, uv.y) * (1.0 - k);',
      '    float u = clamp((k - 0.18) / 0.78, 0.0, 1.0), jh = 0.34 * sin(3.14159 * u) * (0.7 + 0.6 * rnd);',
      '    float jet = smoothstep(0.04, 0.012, abs(uv.x - 0.5)) * step(0.12, uv.y) * step(uv.y, 0.12 + jh) * step(0.18, k);',
      '    float dr = maDot(uv, vec2(0.5 + (rnd - 0.5) * 0.06, 0.15 + jh), 0.065) * step(0.22, k);',
      '    a = max(ring * 0.85, max(jet * 0.75, dr));',
      '    alb = vec3(0.78, 0.86, 0.9);',
      '  } else if (t < 1.5) {',
      // bois : la goutte éclate à plat, des gouttelettes claires partent et rebondissent
      '    for (int i = 0; i < 9; i++) {',
      '      float fi = float(i), an = fract(rnd * 7.3 + fi * 0.618) * 6.2832;',
      '      float sp = 0.22 + 0.32 * fract(rnd * 3.1 + fi * 0.37), vy = 0.55 + 0.9 * fract(rnd * 5.7 + fi * 0.71);',
      '      vec2 c = vec2(0.5 + cos(an) * sp * k, 0.08 + max(0.0, vy * k - 1.7 * k * k) * 0.6);',
      '      a = max(a, maDot(uv, c, 0.045 + 0.015 * fract(fi * 0.41 + rnd)) * (1.0 - 0.5 * k));',
      '    }',
      '    float fl = smoothstep(0.045, 0.0, abs(uv.y - 0.08)) * smoothstep(0.42, 0.05, abs(uv.x - 0.5)) * (1.0 - smoothstep(0.0, 0.32, k));',
      '    a = max(a, fl * 0.85);',
      '    alb = vec3(0.88, 0.9, 0.92);',
      '  } else {',
      // boue : une gerbe basse et sombre de grosses gouttes de vase, un petit cratère
      '    for (int i = 0; i < 6; i++) {',
      '      float fi = float(i), an = fract(rnd * 4.1 + fi * 0.618) * 6.2832;',
      '      float sp = 0.1 + 0.22 * fract(rnd * 9.3 + fi * 0.37), vy = 0.35 + 0.55 * fract(rnd * 2.9 + fi * 0.71);',
      '      vec2 c = vec2(0.5 + cos(an) * sp * k, 0.07 + max(0.0, vy * k - 1.25 * k * k) * 0.5);',
      '      a = max(a, maDot(uv, c, 0.06 + 0.02 * fract(fi * 0.53 + rnd)));',
      '    }',
      '    vec2 q = (uv - vec2(0.5, 0.07)) * vec2(1.0, 4.2);',
      '    a = max(a, smoothstep(0.05, 0.0, abs(length(q) - 0.1 - 0.14 * k)) * (1.0 - k) * 0.9);',
      '    alb = vec3(0.34, 0.29, 0.22);',
      '  }',
      '  if (a < 0.02) discard;',
      // l'eau et les gouttelettes renvoient la lumière (un peu plus que leur part : on les voit briller sous la pluie)
      '  vec3 c = alb * (vC * (t < 1.5 ? 2.4 : 1.6) + (t < 1.5 ? 0.03 : 0.018));',
      '  gl_FragColor = vec4(c, a * (1.0 - k * 0.45));',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    transparent: true, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 7; pts.name = 'impacts de pluie';
  root.add(pts);
  return { pts, geo, P, Q, N, next: 0 };
}
/* Surface sous (x, z) : [0 eau | 1 bois | 2 boue, hauteur] ; null : sous un toit, un mur, un tronc. */
function maWxSurface(x, z) {
  for (const V of VEH.list) if (V.T.boat && !V.wrecked && Math.abs(V.x - x) < 3 && Math.abs(V.z - z) < 3 && vehInside(V, x, z, -0.12)) return [1, V.y + 0.28];
  const cx = Math.floor(x), cz = Math.floor(z), k = owKind(OW.surf, cx, cz);
  if (k === OWK.FLOOR || k === OWK.RAMP) return owCeilAt(0, x, z) < Infinity ? null : [1, owGroundAt(0, x, z)];
  if (k === OWK.WATER) return [0, MA.water];
  if (k !== OWK.TERRAIN) return null;
  const g = owH(x, z);
  return g < MA.water - 0.02 ? [0, MA.water] : [2, g];
}
function maWxSplashes(dt) {
  const S = MA_WX.splash, W = MA_WX;
  if (!S) return;
  const C = MA_WXC.splash, cam = (viewCamera || camera).position;
  W.spawnAcc += C.rate * Math.pow(W.I, 0.75) * dt * (settings.quality === 'low' ? 0.55 : 1);     // comme la densité du rideau
  let n = Math.min(260, Math.floor(W.spawnAcc));
  W.spawnAcc -= n;
  if (n <= 0) return;
  const yaw = VEH.drive ? VEH.drive.yaw + VEH.lookYaw : player.yaw, P = S.P, Q = S.Q, T = OW.t;
  while (n-- > 0) {
    // plutôt devant la caméra, plutôt près (on ne voit les impacts que de près)
    const front = Math.random() < 0.72, a = front ? yaw + Math.PI + rand(-0.95, 0.95) : rand(0, TAU), r = C.r * Math.pow(Math.random(), 0.75) + 0.25;
    const x = cam.x - Math.sin(a) * r, z = cam.z - Math.cos(a) * r, s = maWxSurface(x, z);
    if (!s || s[1] > cam.y + 1.2) continue;
    const i = S.next; S.next = (S.next + 1) % S.N;
    const d = MA_WX_SPL[s[0]];
    P[i * 4] = x; P[i * 4 + 1] = s[1] + 0.005; P[i * 4 + 2] = z; P[i * 4 + 3] = T - Math.random() * 0.016;
    Q[i * 4] = s[0]; Q[i * 4 + 1] = d[1] * rand(0.75, 1.3); Q[i * 4 + 2] = Math.random(); Q[i * 4 + 3] = d[0] * rand(0.8, 1.25);
    W.nSpl++;
  }
  S.geo.attributes.aP.needsUpdate = true; S.geo.attributes.aQ.needsUpdate = true;
}

/* ---------------------------------------------------------------- Les matériaux mouillés --
   Planches, rondins, bardage, bardeaux, tôle, béton, pierre, acier : sous la pluie (MA.terWet, comme le sol), plus
   sombres et plus lisses (les lanternes, le projecteur et les éclairs s'y reflètent). Pas sous un toit (la carte
   des toits, prise un peu en avant de la surface : l'intérieur d'un mur reste sec) ; les murs, un peu. */
const MA_WX_WET = ['ma_deck', 'ma_planks', 'ma_logs', 'ma_siding', 'ma_shingle', 'ma_tin', 'ma_concrete', 'ma_stone', 'ma_rust', 'ma_steel', 'ma_hull'];
function maWxWetMats() {
  MA.terWet = MA.terWet || { value: 0 };
  for (const id of MA_WX_WET) {
    if (!TEXLIB[id]) continue;
    const m = levelMaterial(id);
    if (!m || !m.isMeshStandardMaterial || m.userData.maWet) continue;
    m.userData.maWet = true;
    const prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      sh.uniforms.uWet = MA.terWet; sh.uniforms.uRoofW = MA_WXU.uRoof; sh.uniforms.uWaterW = MA_WXU.uWater;
      sh.vertexShader = 'varying vec3 vMaWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMaWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vMaWp; uniform float uWet, uWaterW; uniform sampler2D uRoofW;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', [
        '#include <normal_fragment_maps>',
        '  if (uWet > 0.001) {',
        '    vec3 maWN = inverseTransformDirection(normal, viewMatrix);',
        '    vec2 maQ = vMaWp.xz + maWN.xz * 0.6;',
        '    float maRh = texture2D(uRoofW, (floor(maQ) + 0.5) / 1024.0).r, maRoofY = maRh > 0.0 ? uWaterW - 2.0 + maRh * 255.0 / 8.0 : -1e4;',
        '    float maWk = uWet * (1.0 - step(vMaWp.y + 0.25, maRoofY)) * mix(0.35, 1.0, smoothstep(0.3, 0.8, maWN.y));',
        '    diffuseColor.rgb *= 1.0 - 0.3 * maWk;',
        '    roughnessFactor = mix(roughnessFactor, 0.36, maWk);',
        '  }',
      ].join('\n'));
    };
    m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '|marais-mouille-1'; };
    m.needsUpdate = true;
  }
}

/* ---------------------------------------------------------------- Chargement, chaque image -- */
function maWxInit(root) {
  const W = MA_WX;
  W.stormErr = W.splErr = false; MA_WXA.err = false; W.test = null; W.probe = null;
  maWxWetMats();
  if (!W.roofTex || W.roofTex.map !== OW.surf) { if (W.roofTex) W.roofTex.t.dispose(); W.roofTex = { t: maWxRoofTex(), map: OW.surf }; }
  MA_WXU.uRoof.value = W.roofTex.t;
  MA_WXU.uWater.value = MA.water;
  W.rain = maWxBuildRain(root);
  W.splash = maWxBuildSplash(root);
  maWxAudioPrep(200);                                   // les sons de pluie : 200 ms au chargement, la suite par tranches
  maWxReset();
  W.ready = true;
}
function maWxUnload() {
  const W = MA_WX;
  W.ready = false; W.I = 0; W.cover = 0;
  if (MA.terWet) MA.terWet.value = 0;                 // (les planches mouillées sont partagées avec les autres cartes)
  maWxAudioStop();
  if (typeof maStormUnload === 'function') maStormUnload();
}
/* Chaque image (maUpdateView, menu compris) : le temps, les uniformes du rideau et des impacts, les sons. */
function maWxUpdate(dt) {
  const W = MA_WX, C = MA_WXC, U = MA_WXU;
  if (!W.ready) return;
  maWxStep(dt);
  // l'orage à part : une erreur dans l'orage ne doit pas éteindre la pluie (signalée une fois, F8 et console)
  if (typeof maStormUpdate === 'function' && !W.stormErr) { try { maStormUpdate(dt); } catch (e) { W.stormErr = true; maErr('marais : orage arrêté', e); } }
  const cam = (viewCamera || camera);
  U.uT.value = OW.t % 4000; U.uCam.value.copy(cam.position); U.uI.value = W.I;
  U.uBox0.value.set(C.near[0], C.near[1], C.near[2], C.near[3]); U.uBox1.value.set(C.far[0], C.far[1], C.far[2], C.far[3]);
  U.uFall.value.set(C.fall[0], C.fall[1]); U.uWind.value.set(W.wind[0], W.wind[1]);
  const h = renderer.domElement.height || 720, tf = Math.tan(THREE.MathUtils.degToRad(cam.fov || 70) / 2);
  U.uPx.value = 2 * tf / h; U.uScale.value = h / (2 * tf);
  U.uRes.value.set(renderer.domElement.width || 1280, h);
  U.uFog.value = scene.fog ? scene.fog.density : 0.01;
  // lumière des gouttes : le ciel (bas), l'éclair, les lanternes, le projecteur
  const F = typeof maStormFlash === 'function' ? maStormFlash() : null, amb = 0.055 + 0.03 * (1 - W.cover);
  U.uAmb.value.set(amb * 0.85, amb, amb * 0.95);
  if (F && F.i > 0) { U.uFlashC.value.set(F.col.r, F.col.g, F.col.b).multiplyScalar(Math.min(F.i, 8) * 0.075); U.uFlashD.value.copy(F.dir); } else U.uFlashC.value.set(0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const L = OWL.pool && OWL.pool[i];
    if (L && L.intensity > 0) { U.uLamp.value[i].set(L.position.x, L.position.y, L.position.z, 3.2); U.uLampC.value[i].set(L.color.r, L.color.g, L.color.b).multiplyScalar(L.intensity * 0.11); }
    else { U.uLamp.value[i].set(0, -500, 0, 1); U.uLampC.value[i].set(0, 0, 0); }
  }
  const S = VEH.light;
  if (S && S.intensity > 0) {
    _maWxV.copy(S.target.position).sub(S.position).normalize();
    U.uSpotP.value.set(S.position.x, S.position.y, S.position.z, S.intensity * 0.09); U.uSpotD.value.set(_maWxV.x, _maWxV.y, _maWxV.z, Math.cos(S.angle));
  } else U.uSpotP.value.w = 0;
  if (W.rain) W.rain.mesh.visible = W.I > 0.004;
  if (W.splash) W.splash.pts.visible = W.I > 0.004;
  // l'eau du marais : ronds de pluie, reflet de l'éclair (ma03)
  if (MA.waterU && MA.waterU.uRainR) {
    MA.waterU.uRainR.value = Math.min(1, Math.pow(W.I, 0.75) * 1.15);
    if (F && F.sky > 0.001) MA.waterU.uSkyF.value.setRGB(F.col.r, F.col.g, F.col.b).multiplyScalar(0.35 * F.sky * (0.6 + Math.min(2.5, F.amb)));
    else MA.waterU.uSkyF.value.setRGB(0, 0, 0);
  }
  // l'arme en main s'éclaire à l'éclair (le moteur amortit sa lumière : l'éclat de l'image d'avant est retiré)
  if (typeof Arms !== 'undefined' && Arms.hemi && Arms.keyLight && G.state === 'playing') {
    const e = Math.exp(-4 * dt), prev = W.armB || 0, b = F && F.i > 0 ? Math.min(3, F.amb * 0.5 + F.i * 0.12) * (1 - 0.8 * (MA.inside || 0)) : 0;
    Arms.hemi.intensity = Math.max(0, Arms.hemi.intensity - prev * e * 0.6) + b * 0.6;
    Arms.keyLight.intensity = Math.max(0, Arms.keyLight.intensity - prev * e) + b;
    W.armB = b;
  }
  if (!W.probe && W.I > 0.4) { try { maWxProbe(); } catch (e) { W.probe = { lit: -1, err: String(e) }; } }
  if (!W.splErr) { try { maWxSplashes(dt); } catch (e) { W.splErr = true; maErr('marais : impacts de pluie arrêtés', e); } }
  if (!MA_WXA.err) { try { maWxAudioUpdate(dt); } catch (e) { MA_WXA.err = true; maWxAudioStop(); maErr('marais : sons de la pluie arrêtés', e); } }   // un navigateur qui refuse : la pluie se tait (rien ne reste bloqué fort), le jeu continue
}
const _maWxV = new THREE.Vector3();
/* Ce que la pluie fait au ciel et à la lumière (maApplyLight) : couvert (la lune s'efface), brouillard plus
   épais, sol mouillé ; puis l'éclair (ma18). */
function maWxLightK() { return { cover: MA_WX.cover, I: MA_WX.I, wet: MA_WX.wet }; }

/* ---------------------------------------------------------------- Sons de pluie (calculés) --
   Des milliers d'impacts tirés au hasard, chacun selon la physique de la surface touchée :
     · l'eau : le choc (clic bref) puis, souvent, la bulle d'air piégée qui chante (fréquence de Minnaert : la
       petite bulle à 10-15 kHz, la moyenne à 3-7 kHz, la grosse goutte qui fait « plic » à 0,8-2,4 kHz ; le son
       monte pendant qu'elle se referme), le clapot grave, le grésillement des gouttes lointaines ;
     · le bois : un tic sec qui fait sonner la planche (modes d'une poutre libre : 1 ; 2,76 ; 5,4 ; 8,9, très
       amortis : bois mouillé), l'eau qui gicle ; de temps en temps une grosse goutte tombée d'une branche ;
     · la boue : un « tchop » sourd (bruit passe-bas), l'éclaboussure, le grésillement des roseaux et des
       herbes, quelques flaques qui font « plic » ;
     · le feuillage : des tics brefs, aigus, très serrés, et les gouttes qui tombent de feuille en feuille ;
     · le lointain : un ruissellement grenu (bruit par grains, coupé dans le grave et l'aigu), qui enfle
       par rafales ;
     · le toit (à l'intérieur) : le tambourinement des bardeaux (modes graves, longs), la caisse de la pièce
       qui résonne, une goutte qui tombe dans une flaque de temps en temps.
   Chaque son d'impact vient d'une banque de réponses calculées une fois (planches, bulles, chocs sourds),
   posée à un instant tiré au hasard, avec sa force et son côté. Chaque tampon boucle sans couture (ce qui
   dépasse la fin reprend au début) ; les durées diffèrent (7,3 ; 6,1 ; 6,7 ; 5,9 ; 8,9 ; 7,7 s) : leur
   mélange ne se répète pas. Le calcul se fait par tranches (générateurs), quelques millisecondes par image. */
function maWxRand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MA_WX_NT = (() => { const r = maWxRand(911), a = new Float32Array(1 << 16); for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1; return a; })();
function maWxBuf(n) { return [new Float32Array(n), new Float32Array(n)]; }
const maWxPan = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
/* Ajoute la réponse ir (force amp, côté pan) à l'échantillon at, en bouclant. */
function maWxAdd(B, ir, at, amp, pan) {
  const L = B[0], R = B[1], n = L.length, m = ir.length, g = maWxPan(pan), gl = g[0] * amp, gr = g[1] * amp;
  let j = at % n;
  for (let i = 0; i < m; i++) { const v = ir[i]; L[j] += v * gl; R[j] += v * gr; if (++j >= n) j = 0; }
}
/* Réponses : bruit qui décroît (passe-bas lp, passe-haut hp d'un pôle), sinus amorti (glissando), modes. */
function maWxIrBurst(fs, tau, lp, hp, o) {
  const len = Math.max(4, Math.ceil(tau * 3.2)), ir = new Float32Array(len), k = Math.exp(-1 / Math.max(1, tau));
  let a = 1, y = 0, y2 = 0;
  for (let i = 0; i < len; i++) { y += lp * (MA_WX_NT[(o + i) & 65535] - y); y2 += hp * (y - y2); ir[i] = (y - y2) * a; a *= k; }
  return ir;
}
function maWxIrTone(fs, f0, f1, tau, att) {
  const len = Math.max(8, Math.ceil(tau * 3.4)), ir = new Float32Array(len), k = Math.exp(-1 / Math.max(1, tau)), df = (f1 - f0) / len;
  let c = 1, s = 0, a = 1, w = 2 * Math.PI * f0 / fs, cw = Math.cos(w), sw = Math.sin(w);
  for (let i = 0; i < len; i++) {
    if (df !== 0 && (i & 15) === 0) { w = 2 * Math.PI * (f0 + df * i) / fs; cw = Math.cos(w); sw = Math.sin(w); }
    const nc = c * cw - s * sw; s = c * sw + s * cw; c = nc;
    ir[i] = s * a * (i < att ? i / att : 1); a *= k;
  }
  return ir;
}
function maWxIrModes(fs, f, t, a, tick) {
  let len = 0;
  for (const x of t) len = Math.max(len, Math.ceil(x * fs * 3.2));
  const ir = new Float32Array(len);
  f.forEach((fi, m) => { const one = maWxIrTone(fs, Math.min(fi, fs * 0.45), Math.min(fi, fs * 0.45), t[m] * fs, 2); for (let i = 0; i < one.length; i++) ir[i] += one[i] * a[m]; });
  if (tick) { const b = maWxIrBurst(fs, fs * 0.0002, 0.7, 0.2, (f[0] * 7) | 0); for (let i = 0; i < b.length; i++) ir[i] += b[i] * tick; }
  return ir;
}
/* Ramène le tampon à la force voulue (moyenne quadratique), sans écrêter. */
function maWxNorm(B, rms) {
  let s = 0, n = 0;
  for (const c of B) for (let i = 0; i < c.length; i += 3) { s += c[i] * c[i]; n++; }
  const k = rms / Math.sqrt(s / Math.max(1, n) + 1e-12);
  for (const c of B) for (let i = 0; i < c.length; i++) { const v = c[i] * k; c[i] = v > 0.95 ? 0.95 + (v - 0.95) * 0.1 : v < -0.95 ? -0.95 + (v + 0.95) * 0.1 : v; }
  return B;
}
/* Filtres d'un pôle (deux passes : pas de saut à la reprise de la boucle) ; résonateur (la caisse d'une pièce). */
function maWxHP(c, fs, fc) {
  const k = Math.exp(-2 * Math.PI * fc / fs);
  let y = 0, x0 = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < c.length; i++) { const x = c[i]; y = k * (y + x - x0); x0 = x; if (pass) c[i] = y; }
}
function maWxLP(c, fs, fc) {
  const k = 1 - Math.exp(-2 * Math.PI * fc / fs);
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < c.length; i++) { y += k * (c[i] - y); if (pass) c[i] = y; }
}
function maWxReso(c, fs, f, q, mix) {
  const w = 2 * Math.PI * f / fs, r = Math.exp(-w / (2 * q)), a1 = 2 * r * Math.cos(w), a2 = -r * r, g = (1 - r) * 2;
  let y1 = 0, y2 = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < c.length; i++) { const y = g * c[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = y; if (pass) c[i] += mix * y; }
}
const MA_WX_SLICE = 600;                                 // impacts entre deux pauses du calcul
function* maWxGenWater(fs, sec, R) {
  const n = Math.round(fs * sec), B = maWxBuf(n);
  const clicks = [], small = [], mid = [], plink = [], fizz = [], crack = [];
  for (let i = 0; i < 32; i++) clicks.push(maWxIrBurst(fs, fs * (0.0002 + R() * 0.0004), 0.45 + 0.5 * R(), 0.15, (R() * 65536) | 0));
  for (let i = 0; i < 64; i++) { const f = Math.min(fs * 0.45, 9000 + R() * 6500), t = 0.0015 + R() * 0.0025; small.push(maWxIrTone(fs, f, Math.min(fs * 0.47, f * (1.1 + R() * 0.4)), fs * t, 5)); }
  for (let i = 0; i < 64; i++) { const f = 2200 + R() * 5600, t = 0.0025 + R() * 0.004; mid.push(maWxIrTone(fs, f, f * (1.1 + R() * 0.45), fs * t, 6)); }
  for (let i = 0; i < 64; i++) { const f = 600 + R() * 2000, t = 0.005 + R() * 0.011; plink.push(maWxIrTone(fs, f, f * (1.15 + R() * 0.5), fs * t, 8)); }
  for (let i = 0; i < 12; i++) fizz.push(maWxIrBurst(fs, fs * 0.00012, 0.9, 0.25, (R() * 65536) | 0));
  for (let i = 0; i < 24; i++) crack.push(maWxIrBurst(fs, fs * (0.0015 + R() * 0.003), 0.3 + R() * 0.3, 0.08, (R() * 65536) | 0));
  const pick = (a) => a[(R() * a.length) | 0];
  for (let e = 0, m = Math.round(1700 * sec); e < m; e++) {
    const at = (R() * n) | 0, d = 0.25 + 6 * Math.sqrt(R()), amp = 0.35 / (0.4 + d), pan = (R() * 2 - 1) * 0.85, br = 1 / (1 + d * 0.35);
    maWxAdd(B, pick(clicks), at, amp, pan);
    maWxAdd(B, pick(crack), at + 2, amp * 0.25, pan);
    if (R() < 0.66) {
      const r = R(), dl = (fs * (0.0008 + R() * 0.0035)) | 0, k = amp * (0.5 + 0.5 * br);
      if (r < 0.55) maWxAdd(B, pick(small), at + dl, k * 0.6 * br, pan);
      else if (r < 0.92) maWxAdd(B, pick(mid), at + dl, k * 0.45, pan);
      else maWxAdd(B, pick(plink), at + dl, k * 0.45, pan);
    }
    if (e % MA_WX_SLICE === 0) yield;
  }
  for (let e = 0, m = Math.round(26 * sec); e < m; e++) maWxAdd(B, maWxIrBurst(fs, fs * (0.02 + R() * 0.05), 0.012 + R() * 0.02, 0.002, (R() * 65536) | 0), (R() * n) | 0, 0.05 + R() * 0.05, R() * 1.6 - 0.8);
  yield;
  for (let e = 0, m = Math.round(6000 * sec); e < m; e++) { maWxAdd(B, pick(fizz), (R() * n) | 0, 0.015 + R() * 0.025, R() * 2 - 1); if (e % (MA_WX_SLICE * 8) === 0) yield; }
  return maWxNorm(B, 0.12);
}
function* maWxGenWood(fs, sec, R) {
  const n = Math.round(fs * sec), B = maWxBuf(n), planks = [];
  // 48 planches, chacune en 6 variantes (bois mouillé : très amorti) : pas de note qui ressort de la pluie
  for (let p = 0; p < 48; p++) {
    const f1 = 300 + R() * 1100, t1 = 0.002 + R() * 0.0035, pan = R() * 1.8 - 0.9, d = 0.3 + R() * 4, irs = [];
    for (let v = 0; v < 6; v++) {
      const j = () => 0.94 + R() * 0.12;
      const f = [f1 * j(), f1 * (2.7 + R() * 0.15) * j(), f1 * (5.2 + R() * 0.4) * j(), f1 * (8.6 + R() * 0.6) * j()], t = [t1, t1 * 0.6, t1 * 0.42, t1 * 0.3];
      irs.push(maWxIrModes(fs, f, t, [0.55, 0.35 + R() * 0.25, 0.22 + R() * 0.15, 0.1 + R() * 0.08], 1.1));
    }
    planks.push({ irs, pan, d, big: maWxIrModes(fs, [f1 * 0.8, f1 * 2.2, f1 * 4.3], [t1 * 2.2, t1 * 1.5, t1], [0.9, 0.5, 0.25], 1.3) });
    if (p % 4 === 3) yield;
  }
  const splat = [];
  for (let i = 0; i < 24; i++) splat.push(maWxIrBurst(fs, fs * (0.0015 + R() * 0.004), 0.45 + R() * 0.3, 0.25, (R() * 65536) | 0));
  const tick = [];
  for (let i = 0; i < 8; i++) tick.push(maWxIrBurst(fs, fs * 0.0002, 0.6, 0.15, (R() * 65536) | 0));
  const hit = (bigOne) => {
    const P = planks[(R() * planks.length) | 0], at = (R() * n) | 0, pan = Math.max(-1, Math.min(1, P.pan + (R() - 0.5) * 0.5)), amp = (0.3 / (0.5 + P.d)) * (0.4 + R() * 0.9) * (bigOne ? 2.6 : 1);
    maWxAdd(B, bigOne ? P.big : P.irs[(R() * P.irs.length) | 0], at, amp, pan);
    if (R() < 0.8 || bigOne) maWxAdd(B, splat[(R() * splat.length) | 0], at + ((fs * 0.0004) | 0), amp * (bigOne ? 0.5 : 0.3), pan);
  };
  for (let e = 0, m = Math.round(1300 * sec); e < m; e++) { hit(false); if (e % MA_WX_SLICE === 0) yield; }
  for (let e = 0, m = Math.round(6 * sec); e < m; e++) hit(true);
  for (let e = 0, m = Math.round(3000 * sec); e < m; e++) { maWxAdd(B, tick[(R() * tick.length) | 0], (R() * n) | 0, 0.01 + R() * 0.015, R() * 2 - 1); if (e % (MA_WX_SLICE * 8) === 0) yield; }
  return maWxNorm(B, 0.12);
}
function* maWxGenMud(fs, sec, R) {
  const n = Math.round(fs * sec), B = maWxBuf(n), thup = [], splat = [], reed = [], puddle = [];
  for (let i = 0; i < 24; i++) thup.push(maWxIrBurst(fs, fs * (0.003 + R() * 0.006), 0.04 + R() * 0.08, 0.004, (R() * 65536) | 0));
  for (let i = 0; i < 12; i++) splat.push(maWxIrBurst(fs, fs * (0.0015 + R() * 0.0015), 0.25, 0.05, (R() * 65536) | 0));
  for (let i = 0; i < 8; i++) reed.push(maWxIrBurst(fs, fs * (0.0001 + R() * 0.0001), 0.95, 0.4, (R() * 65536) | 0));
  for (let i = 0; i < 12; i++) { const f = 1200 + R() * 2300, t = 0.004 + R() * 0.006; puddle.push(maWxIrTone(fs, f, f * (1.15 + R() * 0.2), fs * t, 6)); }
  const pick = (a) => a[(R() * a.length) | 0];
  yield;
  for (let e = 0, m = Math.round(1500 * sec); e < m; e++) {
    const at = (R() * n) | 0, d = 0.3 + 5 * Math.sqrt(R()), amp = 0.4 / (0.5 + d), pan = (R() * 2 - 1) * 0.85;
    maWxAdd(B, pick(thup), at, amp, pan);
    maWxAdd(B, pick(splat), at + ((fs * 0.0004) | 0), amp * 0.3, pan);
    if (e % MA_WX_SLICE === 0) yield;
  }
  for (let e = 0, m = Math.round(2600 * sec); e < m; e++) { maWxAdd(B, pick(reed), (R() * n) | 0, 0.015 + R() * 0.03, R() * 2 - 1); if (e % (MA_WX_SLICE * 8) === 0) yield; }
  for (let e = 0, m = Math.round(45 * sec); e < m; e++) maWxAdd(B, pick(puddle), (R() * n) | 0, 0.03 + R() * 0.04, R() * 1.6 - 0.8);
  return maWxNorm(B, 0.1);
}
function* maWxGenLeaves(fs, sec, R) {
  const n = Math.round(fs * sec), B = maWxBuf(n), tick = [], hiss = [], drip = [];
  for (let i = 0; i < 24; i++) tick.push(maWxIrBurst(fs, fs * (0.0004 + R() * 0.001), 0.5 + R() * 0.3, 0.2, (R() * 65536) | 0));
  for (let i = 0; i < 8; i++) hiss.push(maWxIrBurst(fs, fs * 0.00015, 0.85, 0.35, (R() * 65536) | 0));
  for (let i = 0; i < 8; i++) {
    const a = maWxIrBurst(fs, fs * 0.006, 0.08, 0.004, (R() * 65536) | 0), f = 900 + R() * 900, b = maWxIrTone(fs, f, f * 1.2, fs * 0.006, 6), d0 = (fs * 0.002) | 0, ir = new Float32Array(Math.max(a.length, b.length + d0));
    for (let k = 0; k < a.length; k++) ir[k] += a[k];
    for (let k = 0; k < b.length; k++) ir[k + d0] += b[k] * 0.4;
    drip.push(ir);
  }
  const pick = (a) => a[(R() * a.length) | 0];
  yield;
  for (let e = 0, m = Math.round(2400 * sec); e < m; e++) { maWxAdd(B, pick(tick), (R() * n) | 0, 0.03 + R() * 0.06, R() * 2 - 1); if (e % MA_WX_SLICE === 0) yield; }
  for (let e = 0, m = Math.round(6000 * sec); e < m; e++) { maWxAdd(B, pick(hiss), (R() * n) | 0, 0.006 + R() * 0.01, R() * 2 - 1); if (e % (MA_WX_SLICE * 8) === 0) yield; }
  for (let e = 0, m = Math.round(10 * sec); e < m; e++) maWxAdd(B, pick(drip), (R() * n) | 0, 0.12 + R() * 0.1, R() * 1.6 - 0.8);
  return maWxNorm(B, 0.08);
}
function* maWxGenWash(fs, sec, R, rms = 0.1) {
  const n = Math.round(fs * sec), B = maWxBuf(n), gr = Math.max(8, (fs * 0.0016) | 0), gust = [];
  // rafales : quelques ondes lentes (bouclées : un nombre entier de périodes sur la durée)
  for (let k = 0; k < 3; k++) gust.push({ c: Math.max(1, Math.round(sec * (0.06 + R() * 0.2))), ph: R() * 6.283, a: 0.08 + R() * 0.1 });
  for (const c of B) {
    const st = { g: 1, o: 0, m: 1 };
    for (let i0 = 0; i0 < n; i0 += 131072) { maWxGrains(c, i0, Math.min(n, i0 + 131072), gr, gust, st, R); yield; }
    maWxHP(c, fs, 170); yield;
    maWxLP(c, fs, 7200); yield;
    maWxLP(c, fs, 9000); yield;
  }
  return maWxNorm(B, rms);
}
/* Ajoute s (bouclé) à d, × k. */
function maWxMixInto(d, s, k) { const m = s.length; for (let i = 0; i < d.length; i++) d[i] += s[i % m] * k; }
/* Le ruissellement : du bruit par grains (force tirée au hasard pour chaque grain), modulé par les rafales. */
function maWxGrains(c, i0, i1, gr, gust, st, R) {
  const n = c.length;
  for (let i = i0; i < i1; i++) {
    if (i % gr === 0) { st.g = -Math.log(1 - R() * 0.98) * 0.7; st.o = (R() * 65536) | 0; }
    if ((i & 255) === 0) { st.m = 1; for (const q of gust) st.m += q.a * Math.sin(q.ph + 6.283 * q.c * i / n); }
    c[i] = MA_WX_NT[(st.o + i) & 65535] * st.g * st.m;
  }
}
function* maWxGenRoof(fs, sec, R) {
  const n = Math.round(fs * sec), B = maWxBuf(n), panels = [];
  for (let p = 0; p < 16; p++) {
    const f1 = 150 + R() * 260, t1 = 0.007 + R() * 0.009;
    const f = [f1, f1 * (2.2 + R() * 0.2), f1 * (3.8 + R() * 0.3), f1 * (5.5 + R() * 0.4)], t = [t1, t1 * 0.7, t1 * 0.5, t1 * 0.4];
    panels.push({ ir: maWxIrModes(fs, f, t, [0.6, 0.4, 0.25, 0.12], 0.9), pan: R() * 1.6 - 0.8 });
    if (p % 4 === 3) yield;
  }
  const tap = [];
  for (let i = 0; i < 16; i++) tap.push(maWxIrBurst(fs, fs * (0.0005 + R() * 0.001), 0.35 + R() * 0.3, 0.12, (R() * 65536) | 0));
  for (let e = 0, m = Math.round(1400 * sec); e < m; e++) {
    const P = panels[(R() * panels.length) | 0], at = (R() * n) | 0, a = 0.05 + R() * 0.08, pan = P.pan + (R() - 0.5) * 0.4;
    maWxAdd(B, P.ir, at, a, pan);
    maWxAdd(B, tap[(R() * tap.length) | 0], at, a * 1.5, pan);
    if (e % MA_WX_SLICE === 0) yield;
  }
  for (const c of B) { maWxReso(c, fs, 92, 1.6, 0.05); yield; maWxHP(c, fs, 70); yield; maWxLP(c, fs, 7000); yield; }
  const drip = [];
  for (let r = 0; r < 3; r++) { const f = 900 + R() * 500; drip.push(maWxIrTone(fs, f, f * 1.25, fs * 0.025, 8)); }
  for (let e = 0, m = Math.max(1, Math.round(0.35 * sec)); e < m; e++) {
    const at = (R() * n) | 0, ir = drip[(R() * drip.length) | 0], pan = R() * 1.2 - 0.6;
    for (let r = 0; r < 3; r++) maWxAdd(B, ir, at + ((fs * 0.03 * r) | 0), 0.06 * Math.pow(0.35, r), pan);
  }
  const W = yield* maWxGenWash(fs, sec * 0.5, R);
  for (let c = 0; c < 2; c++) { maWxLP(W[c], fs, 1100); yield; maWxMixInto(B[c], W[c], 0.35); yield; }
  return maWxNorm(B, 0.14);
}
/* Les six nappes (tampons stéréo bruts, 48 kHz). */
const MA_WX_LAYERS = [['water', maWxGenWater, 7.3], ['wood', maWxGenWood, 6.1], ['mud', maWxGenMud, 6.7], ['leaves', maWxGenLeaves, 5.9], ['wash', maWxGenWash, 8.9], ['roof', maWxGenRoof, 7.7]];
/* Calcul par tranches : budget en ms par appel ; renvoie true quand tout est prêt (out : id → tampon). */
function maWxGenJob(fs, seed) {
  const J = { fs, out: {}, i: 0, it: null, done: false, ms: 0 };
  J.step = (budget) => {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    while (!J.done) {
      if (!J.it) { const [id, fn, sec] = MA_WX_LAYERS[J.i]; J.id = id; J.it = fn(fs, sec, maWxRand(seed * 977 + J.i * 131)); }
      const r = J.it.next();
      if (r.done) { J.out[J.id] = r.value; J.it = null; if (++J.i >= MA_WX_LAYERS.length) J.done = true; }
      if ((typeof performance !== 'undefined' ? performance : Date).now() - t0 > budget) break;
    }
    J.ms += (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return J.done;
  };
  return J;
}
function maWxGenAll(fs = 48000, seed = 1) { const J = maWxGenJob(fs, seed); while (!J.step(1e9)); return J.out; }

/* ---------------------------------------------------------------- Le mélange --
   Les six nappes bouclent ensemble ; leur force suit l'intensité et ce qui entoure le joueur (dans un rayon
   de 7 m : eau, bois, boue ; les arbres à moins de 9 m ; le toit au-dessus de lui). Dedans, le dehors passe
   par un filtre (étouffé). De grosses gouttes toutes proches, une par une, sur ce qu'il y a là. */
const MA_WXA = { job: null, raw: null, ctx: null, out: null, outF: null, layers: null, dropT: 0, lvl: 0 };
const MA_WXA_K = { water: 0.9, wood: 1.0, mud: 0.8, leaves: 0.55, wash: 0.75, roof: 1.1 };
function maWxAudioPrep(budget) {
  const A = MA_WXA;
  if (A.raw) return true;
  if (!A.job) A.job = maWxGenJob(48000, (Math.random() * 1e6) | 0);
  if (A.job.step(budget)) { A.raw = A.job.out; A.job = null; return true; }
  return false;
}
function maWxAudioStart() {
  const A = MA_WXA, b = Sound.bus();
  if (!b || !A.raw) return null;
  if (A.out && A.ctx === b.ctx) return A;
  if (A.out) maWxAudioStop();
  const ctx = b.ctx, t = ctx.currentTime;
  A.ctx = ctx;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.7; hp.connect(b.sortie);   // (comme l'ambiance, ma10 : rien de sourd sous 40 Hz)
  A.out = ctx.createGain(); A.out.gain.value = 0; A.out.connect(hp); A.hp = hp;
  A.outF = ctx.createBiquadFilter(); A.outF.type = 'lowpass'; A.outF.frequency.value = 20000; A.outF.Q.value = 0.5; A.outF.connect(A.out);
  A.layers = {};
  for (const id in A.raw) {
    const B = A.raw[id], buf = ctx.createBuffer(2, B[0].length, 48000);
    buf.copyToChannel(B[0], 0); buf.copyToChannel(B[1], 1);
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(g); g.connect(id === 'roof' ? A.out : A.outF);
    s.start(t, Math.random() * buf.duration);
    A.layers[id] = { s, g };
  }
  return A;
}
function maWxAudioStop() {
  const A = MA_WXA;
  if (!A.out) return;
  const L = A.layers, out = A.out, hp = A.hp;
  A.out = null; A.layers = null; A.hp = null;
  try { for (const k in L) { L[k].s.stop(); L[k].g.disconnect(); } out.disconnect(); if (hp) hp.disconnect(); } catch (e) { /* déjà arrêtés */ }
}
/* Ce qui entoure le joueur (toutes les 0,3 s) : parts d'eau, de bois, de boue ; arbres proches. */
function maWxSurround() {
  const S = MA_WX.sur, p = (viewCamera || camera).position;
  let w = 0, d = 0, m = 0, tot = 0;
  for (const [r, n, k] of [[1.2, 6, 1.6], [3.2, 10, 1], [6.5, 14, 0.6]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r, s = maWxSurface(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      if (!s) continue;
      tot += k;
      if (s[0] === 0) w += k; else if (s[0] === 1) d += k; else m += k;
    }
  }
  const V = VEH.drive;
  if (V && V.T.boat) { d += tot * 0.6; tot *= 1.6; }        // en barque : la pluie sur la coque, tout autour de soi
  const T = tot || 1;
  S.water = w / T; S.wood = d / T; S.mud = m / T;
  let tr = 0;
  for (const t of MA.trees || []) { const dx = t.x - p.x, dz = t.z - p.z; if (Math.abs(dx) < 10 && Math.abs(dz) < 10) tr += 1 - Math.min(1, Math.hypot(dx, dz) / 10); }
  S.leaves = clamp(tr / 2.5, 0, 1);
}
function maWxAudioUpdate(dt) {
  const A = MA_WXA, W = MA_WX;
  if (!A.raw && !maWxAudioPrep(3)) return;
  if (!maWxAudioStart()) return;
  if (typeof MA_OR !== 'undefined' && !MA_OR.snd && !MA_OR.sndErr) maOrBus();      // le son de l'orage, prêt avant le premier éclair
  const ctx = A.ctx, t = ctx.currentTime, S = W.sur, I = W.I, ins = MA.inside || 0;
  S.t -= dt;
  if (S.t <= 0) { S.t = 0.3; maWxSurround(); }
  const on = G.state === 'playing' || G.state === 'menu' || G.state === 'gameover';
  A.lvl = damp(A.lvl, on && OW.on && OW.worldId === 'marais' ? MA_WXC.vol : 0, 1.5, dt);
  A.out.gain.setTargetAtTime(A.lvl, t, 0.2);
  A.outF.frequency.setTargetAtTime(lerp(20000, 950, ins), t, 0.25);
  // la force suit l'intensité (pas plus vite que le rideau : on ne doit pas entendre une averse qu'on ne voit pas)
  const K = MA_WXA_K, I2 = I, set = (id, v) => A.layers[id].g.gain.setTargetAtTime(Number.isFinite(v) ? v * K[id] : 0, t, 0.35);
  set('water', I2 * (0.12 + 0.88 * S.water));
  set('wood', I2 * S.wood);
  set('mud', I2 * S.mud);
  set('leaves', I2 * S.leaves);
  set('wash', Math.pow(I, 0.9) * (1 - 0.35 * ins));
  set('roof', I2 * ins);
  // grosses gouttes, une par une, tout près (sur ce qu'il y a là)
  A.dropT -= dt * I * (ins > 0.5 ? 0.15 : 1);
  if (A.dropT <= 0) { A.dropT = rand(0.08, 0.45); maWxDrop(S, ins); }
}
/* Une grosse goutte, à 0,5-3 m : « plic » sur l'eau, « toc » sur le bois, « tchac » dans la boue ; dedans, une
   goutte qui tombe du toit dans une flaque. */
function maWxDrop(S, ins) {
  const A = MA_WXA, ctx = A.ctx, t = ctx.currentTime + 0.01, r = Math.random();
  const kind = ins > 0.5 ? 'drip' : r < S.water ? 'water' : r < S.water + S.wood ? 'wood' : 'mud';
  const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, lvl = rand(0.04, 0.11);
  if (p) { p.pan.value = rand(-0.85, 0.85); g.connect(p); p.connect(ins > 0.5 ? A.out : A.outF); } else g.connect(A.outF);
  const end = t + 0.5;
  if (kind === 'water' || kind === 'drip') {
    const o = ctx.createOscillator(), f = kind === 'drip' ? rand(850, 1300) : rand(700, 2100);
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rand(1.25, 1.7), t + 0.06);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, kind === 'drip' ? 0.04 : 0.018);
    o.connect(g); o.start(t); o.stop(end);
  } else {
    const s = ctx.createBufferSource(); s.buffer = MA_AMB.noise || null;
    if (!s.buffer) return;
    const f = ctx.createBiquadFilter();
    if (kind === 'wood') { f.type = 'bandpass'; f.frequency.value = rand(700, 1600); f.Q.value = 4; }
    else { f.type = 'lowpass'; f.frequency.value = rand(450, 900); f.Q.value = 0.8; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * (kind === 'wood' ? 2.2 : 1.6), t + 0.002); g.gain.setTargetAtTime(0, t + 0.004, kind === 'wood' ? 0.012 : 0.03);
    s.connect(f); f.connect(g); s.start(t, Math.random() * 2); s.stop(end);
  }
  setTimeout(() => { try { g.disconnect(); if (p) p.disconnect(); } catch (e) { /* */ } }, 1200);
}

/* ---------------------------------------------------------------- F8, console -- */
function maWxDiag() {
  const W = MA_WX, left = Math.max(0, W.dur - W.t), mm = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
  const K = W.keys && W.keys.length > 3 ? W.keys : null, ph = W.t < MA_WXC.coverLead ? 'le ciel se couvre' : K && W.t < K[2][0] ? 'la pluie arrive' : K && W.t > K[K.length - 2][0] ? 'elle se calme'
    : W.I > 0.75 ? 'diluvienne' : W.I > 0.45 ? 'forte' : 'modérée';
  const ep = W.ep === 'averse' ? `averse n° ${W.n} (${ph})` : 'temps sec';
  const A = MA_WXA, T = W.test, R = W.rain;
  // le rendu (test au chargement : maWxSelfTest), ce qui s'est arrêté, le son
  const rd = (!T ? 'non testé' : T.mode === 'normal' ? `normal (test ${T.normal.lit} px)` : T.mode === 'simple' ? `SIMPLE : la version normale ne s’affiche pas ici (${T.normal.prog}, ${T.normal.lit} px)` : `INVISIBLE sur cette machine (${T.normal.prog}, ${T.normal.lit} px)`)
    + (T && T.splash === 'REFUSÉ' ? ', impacts REFUSÉS par le pilote' : '') + (T && T.bolt === 'REFUSÉ' ? ', éclairs REFUSÉS par le pilote' : '')
    + (!W.probe ? '' : W.probe.lit >= 40 ? `, vu en jeu (${W.probe.lit} px)` : `, INVISIBLE EN JEU (${W.probe.lit} px${W.probe.mode === 'simple' ? ' ; version simple : ' + W.probe.simple + ' px, elle le remplace' : ''} : voir la console)`);
  const stop = [W.stormErr && 'orage', W.splErr && 'impacts', A.err && 'sons', MA.wxErr && 'météo'].filter(Boolean);
  return `météo : ${ep} · intensité ${fmtNum(W.I, 2)} (traits ${R ? Math.round(R.n * Math.pow(W.I, 0.75)) : 0}${R && !R.mesh.visible ? ', cachés' : ''}), ciel couvert ${fmtNum(W.cover, 2)}, sol mouillé ${fmtNum(W.wet, 2)}, vent ${fmtNum(W.windS, 1)} m/s · ${mm(left)} avant ${W.ep === 'averse' ? 'le temps sec' : 'l’averse'} · rendu de la pluie ${rd} · impacts ${W.nSpl} · sons ${A.raw ? 'prêts' : A.job ? 'en calcul' : '—'}, volume ${fmtNum(A.lvl, 2)}${A.ctx ? `, ${A.ctx.state} ${A.ctx.sampleRate} Hz` : ''} (eau ${fmtNum(W.sur.water, 2)}, bois ${fmtNum(W.sur.wood, 2)}, boue ${fmtNum(W.sur.mud, 2)}, arbres ${fmtNum(W.sur.leaves, 2)})${stop.length ? ' · ARRÊTÉ : ' + stop.join(', ') : ''}`;
}
MA_API.meteo = {
  get etat() { return { episode: MA_WX.ep, intensite: MA_WX.I, couvert: MA_WX.cover, mouille: MA_WX.wet, reste: Math.max(0, MA_WX.dur - MA_WX.t), orage: typeof maStormState === 'function' ? maStormState() : null, rendu: MA_WX.test ? MA_WX.test.mode : null }; },
  /* le test du rendu de la pluie, refait maintenant (résultat dans la console et F8) */
  test() { return maWxSelfTest(); },
  /* une averse tout de suite (avec ou sans orage) ; le temps sec ; un orage tout de suite */
  // la pluie forte en quelques secondes (le ciel déjà couvert) ; l'orage : le premier moment fort dans 8 à 14 s
  pluie(orage = false) { MA_WX.force = !!orage; maWxNext('averse'); MA_WX.t = Math.max(MA_WXC.coverLead, MA_WX.keys[2][0] - 4); MA_WX.cover = 1; return this.etat; },
  orage() { MA_WX.force = true; maWxNext('averse'); MA_WX.t = Math.max(MA_WXC.coverLead, MA_WX.keys[2][0] - 4); MA_WX.cover = 1; if (typeof maStormNow === 'function') maStormNow(true); return this.etat; },
  sec() { maWxNext('sec'); return this.etat; },
  eclair(x, z, o) { return typeof maStrikeAt === 'function' ? maStrikeAt(x, z, o || {}) : null; },
};
