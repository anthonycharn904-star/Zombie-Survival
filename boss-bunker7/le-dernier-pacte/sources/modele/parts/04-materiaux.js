  // ============================================================================================
  // Palette du Septième, textures de détail procédurales (drap, grain du cuir, pores) et retouches de
  // shader communes : dissolution (cendres / brume de sang), sceaux occultes brûlés dans le cuir (motif
  // inventé : anneaux, sceau à sept branches courbes, points, cercles, arcs, spirales), doublure, déchirures,
  // flottement, trou de la bouche, veines lumineuses ; glyphes brodés de l'étole ; sur la tête de
  // remplacement : sceau à sept branches gravé en cicatrices lumineuses et cicatrice agrafée.
  // ============================================================================================
  const PAL = {
    peau: hexc(0x929aa6), peauOmbre: hexc(0x636b78), peauFroide: hexc(0x8190a3), peauRose: hexc(0x958a8f),
    veine: hexc(0x2b2537), ongle: hexc(0x171214), levre: hexc(0x4c3f47), chaume: hexc(0x6f7276),
    manteau: hexc(0x2a221d), manteauClair: hexc(0x4d3e33), manteauSombre: hexc(0x14100e), doublure: hexc(0x2c1816),
    tunique: hexc(0x2e2a27), tuniqueSombre: hexc(0x1d1a18), tuniqueClair: hexc(0x433d37),
    pantalon: hexc(0x262422), pantalonSombre: hexc(0x171615),
    botte: hexc(0x1b1613), botteReflet: hexc(0x3b2f27), semelle: hexc(0x0d0b0a),
    cuir: hexc(0x2b1d15), cuirClair: hexc(0x4a3324),
    metal: hexc(0x5f5b55), rouille: hexc(0x5a3824), fer: hexc(0x34312e),
    etole: hexc(0x6a1114), etoleSombre: hexc(0x3a080a), broderie: hexc(0x8e6c2e),
    bandage: hexc(0xb1ab98), bandageSale: hexc(0x5e5444), verre: hexc(0x50675f), ame: hexc(0x2f6a5e),
    cendre: hexc(0x75706a), poussiere: hexc(0x625a4d), sangSec: hexc(0x3c0f0c), brule: hexc(0x120d0b),
    os: hexc(0x39332e), osClair: hexc(0x625950), membrane: hexc(0x1a0605),
    gant: hexc(0x15110f), gantSombre: hexc(0x0b0909), gantUse: hexc(0x3b332d)
  };

  // ---------------------------------------------------------------- textures de détail (CPU, 256²)
  const DETAIL_CACHE = new Map();
  function texturesDetail(THREE) {
    const key = THREE.REVISION;
    if (DETAIL_CACHE.has(key)) return DETAIL_CACHE.get(key);
    const S = 256;
    const make = (heightFn, albedoFn, strength) => {
      const H = new Float32Array(S * S), A = new Float32Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { H[y * S + x] = heightFn(x, y); A[y * S + x] = albedoFn(x, y, H[y * S + x]); }
      const dN = new Uint8Array(S * S * 4), dA = new Uint8Array(S * S * 4);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const hx = H[y * S + ((x + 1) % S)] - H[y * S + ((x + S - 1) % S)];
        const hy = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
        let nx = -hx * strength, ny = -hy * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * S + x) * 4;
        dN[i] = (nx * 0.5 + 0.5) * 255; dN[i + 1] = (ny * 0.5 + 0.5) * 255; dN[i + 2] = (nz * 0.5 + 0.5) * 255; dN[i + 3] = 255;
        const a = clamp(A[y * S + x], 0, 1) * 255;
        dA[i] = dA[i + 1] = dA[i + 2] = a; dA[i + 3] = 255;
      }
      const tex = (data) => {
        const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
        t.anisotropy = 4;
        if ('colorSpace' in t) t.colorSpace = THREE.NoColorSpace || ''; else t.encoding = THREE.LinearEncoding;
        t.needsUpdate = true;
        return t;
      };
      return { d: tex(dA), n: tex(dN) };
    };
    const per = (x, y, f, seed) => {   // bruit de valeur périodique (période S / f)
      const P = f, u = x / S * P, v = y / S * P, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      const h = (a, b) => hash3(((a % P) + P) % P, ((b % P) + P) % P, 0, seed);
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      return lerp(lerp(h(i, j), h(i + 1, j), su), lerp(h(i, j + 1), h(i + 1, j + 1), su), sv);
    };
    const T = {
      // sergé de laine (côtes diagonales serrées, fibres, petites bouloches)
      laine: make((x, y) => 0.5 + 0.32 * Math.sin(TAU * (x + y) / 8) + 0.18 * (per(x, y, 64, 3) - 0.5) + 0.12 * per(x, y, 16, 5),
        (x, y, h) => 0.78 + 0.06 * (h - 0.5) + 0.1 * (per(x, y, 32, 7) - 0.5) - 0.06 * Math.max(0, per(x, y, 128, 9) - 0.7), 2.2),
      // drap fin (toile : fils croisés)
      drap: make((x, y) => 0.5 + 0.22 * Math.sin(TAU * x / 4) * Math.sin(TAU * y / 4) + 0.2 * (per(x, y, 64, 11) - 0.5),
        (x, y, h) => 0.8 + 0.05 * (h - 0.5) + 0.08 * (per(x, y, 32, 13) - 0.5), 1.6),
      // cuir : grain grumeleux et petites rides
      cuir: make((x, y) => { const a = per(x, y, 32, 17), b = per(x, y, 64, 19); return 0.6 * (1 - Math.abs(a - 0.5) * 2) + 0.4 * b + 0.25 * Math.abs(Math.sin(TAU * (x * 0.3 + y) / 64 + per(x, y, 8, 23) * 3)) ; },
        (x, y, h) => 0.8 + 0.06 * (h - 0.6) + 0.06 * (per(x, y, 16, 21) - 0.5), 2.6),
      // peau : pores et ridules
      peau: make((x, y) => 0.5 + 0.25 * per(x, y, 32, 29) + 0.25 * per(x, y, 128, 31) - 0.4 * Math.max(0, per(x, y, 96, 37) - 0.75),
        (x, y, h) => 0.8 + 0.05 * (h - 0.5) - 0.05 * Math.max(0, per(x, y, 96, 37) - 0.72), 1.8)
    };
    DETAIL_CACHE.set(key, T);
    return T;
  }

  // ---------------------------------------------------------------- GLSL commun
  const GLSL_BRUIT = `
float bH3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bN3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bH3(i), bH3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(bH3(i + vec3(0.0, 1.0, 0.0)), bH3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(bH3(i + vec3(0.0, 0.0, 1.0)), bH3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(bH3(i + vec3(0.0, 1.0, 1.0)), bH3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float bF3(vec3 p){ return bN3(p) * 0.5 + bN3(p * 2.03 + 3.1) * 0.3 + bN3(p * 4.11 + 7.7) * 0.2; }
`;
  const GLSL_SCEAUX = `
// Motifs occultes INVENTÉS, faits uniquement de cercles, arcs, points et spirales (aucune lettre, rune, croix,
// roue à rayons droits ni symbole réel). Distances dans le repère du motif (rayon ≈ 1).
float bArc(vec2 p, vec2 c, float r, float a0, float a1){
  vec2 d = p - c;
  float t = mod(atan(d.y, d.x) - a0, 6.2831853);
  if (t <= a1 - a0) return abs(length(d) - r);
  vec2 e0 = c + r * vec2(cos(a0), sin(a0)), e1 = c + r * vec2(cos(a1), sin(a1));
  return min(length(p - e0), length(p - e1));
}
float bPoint(vec2 p, vec2 c, float r){ return max(length(p - c) - r, 0.0); }
float bSpirale(vec2 p, vec2 c, float r, float tours){
  vec2 d = p - c; float rr = length(d), a = atan(d.y, d.x); if (a < 0.0) a += 6.2831853;
  float tot = tours * 6.2831853, k = r * 0.88 / tot, r0 = r * 0.12, best = 9.0;
  for (int i = 0; i < 4; i++) { float th = a + 6.2831853 * float(i); if (th <= tot) best = min(best, abs(rr - (r0 + k * th))); }
  return best;
}
// sceau à sept branches COURBES de Bunker 7 : anneau central, sept branches incurvées de longueurs inégales et de
// sens alternés, terminées par un point (création)
float bSceau7c(vec2 q){
  float r = length(q);
  if (r > 1.15) return 9.0;
  float a = atan(q.y, q.x);
  float d = abs(r - 0.17);
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float th0 = 1.5707963 + fk * 0.8975979;
    float sk = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
    float L = 0.62 + 0.05 * mod(fk * 3.0, 5.0);
    float kc = sk * (0.55 + 0.35 * mod(fk * 2.0, 3.0) / 2.0);
    float rc = clamp(r, 0.17, L);
    float th = th0 + kc * (rc - 0.17) * (rc - 0.17);
    float da = a - th; da = da - 6.2831853 * floor((da + 3.1415927) / 6.2831853);
    if (r >= 0.17 && r <= L && cos(da) > 0.0) d = min(d, abs(sin(da)) * r);
    float thL = th0 + kc * (L - 0.17) * (L - 0.17);
    d = min(d, bPoint(q, L * vec2(cos(thL), sin(thL)), 0.055));
  }
  return d;
}
// sceau des vêtements : deux anneaux, sceau à sept branches courbes, couronne de points, cercles et petits arcs
float bSceauD(vec2 p, float graine){
  float r = length(p);
  if (r > 1.15) return 9.0;
  float a = atan(p.y, p.x);
  float d = min(abs(r - 1.0), abs(r - 0.885));
  d = min(d, bSceau7c(p / 0.8) * 0.8);
  float n = 21.0, cell = floor((a + 3.1415927) / 6.2831853 * n);
  float ac = (cell + 0.5) / n * 6.2831853 - 3.1415927;
  vec2 c = 0.9425 * vec2(cos(ac), sin(ac));
  float h = fract(sin((cell + 1.0) * 12.9898 + graine * 4.1414) * 43758.5453);
  if (h < 0.45) d = min(d, bPoint(p, c, 0.02));
  else if (h < 0.8) d = min(d, abs(length(p - c) - 0.028));
  else d = min(d, bArc(p, c, 0.034, ac + 0.6, ac + 3.6));
  return d;
}
// glyphes brodés de l'étole (une case = un glyphe, choisi par la graine de la case)
float bGlyphe(vec2 q, float cel){
  float h = fract(sin(cel * 12.9898 + 7.13) * 43758.5453), h2 = fract(sin(cel * 39.3468 + 1.7) * 24634.6345);
  float rt = (h2 - 0.5) * 1.4, cs = cos(rt), sn = sin(rt);
  vec2 p = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  float t = floor(h * 9.0), d = 9.0;
  if (t < 1.0) { d = min(bArc(p, vec2(0.0), 0.8, 0.5, 5.2), abs(length(p) - 0.28)); d = min(d, bPoint(p, vec2(0.66, 0.36), 0.09)); }
  else if (t < 2.0) { d = min(bSpirale(p, vec2(0.0), 0.8, 2.2), bPoint(p, vec2(0.62, -0.6), 0.09)); }
  else if (t < 3.0) { d = min(bArc(p, vec2(-0.25, 0.0), 0.6, 1.05, 5.24), bArc(p, vec2(0.25, 0.0), 0.6, -2.09, 2.09)); d = min(d, min(bPoint(p, vec2(0.0, 0.72), 0.09), bPoint(p, vec2(0.0, -0.72), 0.09))); }
  else if (t < 4.0) { d = min(abs(length(p) - 0.3), bArc(p, vec2(0.0), 0.62, 1.75, 4.54)); d = min(d, min(bArc(p, vec2(0.0), 0.62, 4.89, 7.68), bArc(p, vec2(0.0), 0.88, 3.49, 5.93))); }
  else if (t < 5.0) { d = min(abs(length(p - vec2(-0.25, -0.15)) - 0.5), abs(length(p - vec2(0.48, 0.45)) - 0.2)); d = min(d, min(bArc(p, vec2(0.48, 0.45), 0.38, 3.49, 7.5), bPoint(p, vec2(-0.25, -0.15), 0.1))); }
  else if (t < 6.0) { d = min(min(bArc(p, vec2(-0.5, 0.1), 0.25, 0.0, 3.1416), bArc(p, vec2(0.0, 0.1), 0.25, 3.1416, 6.2832)), bArc(p, vec2(0.5, 0.1), 0.25, 0.0, 3.1416)); d = min(d, min(min(bPoint(p, vec2(-0.5, -0.32), 0.09), bPoint(p, vec2(0.5, -0.32), 0.09)), bPoint(p, vec2(0.0, 0.6), 0.09))); }
  else if (t < 7.0) { d = min(bSpirale(p, vec2(-0.2, 0.15), 0.55, 1.6), bArc(p, vec2(0.2, -0.2), 0.62, 4.71, 6.98)); d = min(d, bPoint(p, vec2(0.55, 0.6), 0.08)); }
  else if (t < 8.0) { d = min(abs(length(p) - 0.85), abs(length(p) - 0.55)); d = min(d, min(bPoint(p, vec2(0.3, 0.3), 0.1), bPoint(p, vec2(-0.32, -0.3), 0.06))); }
  else { d = min(bArc(p, vec2(0.0, -0.4), 1.0, 0.61, 2.53), abs(length(p) - 0.12)); d = min(d, min(min(bPoint(p, vec2(-0.55, -0.35), 0.09), bPoint(p, vec2(0.0, -0.58), 0.09)), bPoint(p, vec2(0.55, -0.35), 0.09))); }
  return d;
}
`;

  /**
   * Retouche de shader commune. flags : { FLOT, TROU, SCEAUX, DOUBLURE, DECHIRURES, LUEUR, EMISMASQUE,
   * MEMBRANE, DEPTH }. U : objet d'uniformes partagés (mêmes objets { value } pour tous les matériaux).
   */
  function patchBoss(THREE, mat, flags, U, tag) {
    const defs = Object.keys(flags).filter((k) => flags[k]).map((k) => '#define BOSS_' + k + '\n').join('');
    mat.customProgramCacheKey = () => 'boss-' + (tag || '') + '-' + Object.keys(flags).filter((k) => flags[k]).join('-');
    mat.onBeforeCompile = (sh) => {
      for (const k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
${defs}
attribute vec3 aBoss;
varying vec3 vPosB;
varying vec3 vNorB;
varying vec3 vBoss;
uniform float uTemps;
uniform float uFlotAmp;
`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosB = position; vNorB = normal; vBoss = aBoss;
#ifdef BOSS_FLOT
if (aBoss.x > 0.0) {
  float ph = position.x * 11.0 + position.z * 9.0 + position.y * 4.0;
  transformed += normal * (sin(uTemps * 3.3 + ph) * 0.6 + sin(uTemps * 5.9 + ph * 1.73) * 0.4) * aBoss.x * uFlotAmp;
}
#endif
`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
${defs}
varying vec3 vPosB;
varying vec3 vNorB;
varying vec3 vBoss;
uniform float uTemps;
uniform float uDissol;
uniform vec3 uDissolCoul;
uniform float uPuis;
uniform vec3 uSceauCoul;
uniform float uVeine;
uniform vec3 uVeineCoul;
uniform vec3 uDoublure;
uniform vec3 uFlash;
${GLSL_BRUIT}
#if defined(BOSS_MEMBRANE) || defined(BOSS_LAME) || defined(BOSS_LAMEPOI)
uniform float uForm;
#endif
#if defined(BOSS_LAME) || defined(BOSS_LAMEPOI)
uniform float uFiss;
uniform float uEffrit;
uniform float uPouls;
uniform vec3 uLameReg;
float bossEffrit(){ return bF3(vPosB * 16.0) * 0.7 + (1.0 - clamp(vBoss.x, 0.0, 1.0)) * 0.3; }
#endif
#ifdef BOSS_MEMBRANE
float bossTrouMem(){ return bF3(vPosB * 6.5 + vec3(0.0, uTemps * 0.04, 0.0)) * 0.72 + bF3(vPosB * 19.0) * 0.28 + (1.0 - clamp(vBoss.y, 0.0, 1.0)) * 0.22; }
#endif
#if defined(BOSS_SCEAUX) || defined(BOSS_ETOLE) || defined(BOSS_TETE7)
${GLSL_SCEAUX}
#endif
#ifdef BOSS_TETE7
uniform vec3 uCicatrice[6];
#endif
float bossDissVal(){
  float d = length((vPosB - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0));
  return clamp(0.6 * bF3(vPosB * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0);
}
`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float bossDv = 1.0;
if (uDissol > 0.0) { bossDv = bossDissVal() - (uDissol * 1.08 - 0.04); if (bossDv < 0.0) discard; }
#ifdef BOSS_TROU
if (vBoss.y > 0.5) discard;
#endif
#ifdef BOSS_ETOLE
if (vBoss.z < 0.04 && fract(vBoss.x * 15.0 + 0.25) < 0.42 + 6.0 * (0.04 - vBoss.z)) discard;   // frange au bout de l'étole
#endif
#ifdef BOSS_LAME
float bossLf = uForm * 1.1 - 0.02 - vBoss.x;
if (bossLf < 0.0) discard;
float bossLe = bossEffrit() - (uEffrit * 1.08 - 0.03);
if (uEffrit > 0.0 && bossLe < 0.0) discard;
#endif
#ifdef BOSS_LAMEPOI
if (uEffrit > 0.0 && bF3(vPosB * 60.0) * 0.8 + 0.25 - uEffrit * 1.1 < 0.0) discard;
#endif
#ifdef BOSS_MEMBRANE
float bossTm = bossTrouMem();
if (bossTm > 0.655) discard;
float bossFormBord = uForm * 1.12 - vBoss.x;
if (bossFormBord < 0.0) discard;
#endif
#ifdef BOSS_DECHIRURES
float bossTrou = 9.0;
{
  vec3 c0 = vec3(0.262, 0.52, 0.06); vec3 c1 = vec3(-0.15, 0.40, -0.22); vec3 c2 = vec3(0.12, 1.06, -0.17); vec3 c3 = vec3(-0.27, 0.70, 0.10); vec3 c4 = vec3(0.05, 0.30, -0.28);
  float n = (bF3(vPosB * 26.0) - 0.5) * 0.55;
  bossTrou = min(bossTrou, length(vPosB - c0) / 0.045 + n);
  bossTrou = min(bossTrou, length(vPosB - c1) / 0.06 + n);
  bossTrou = min(bossTrou, length(vPosB - c2) / 0.03 + n);
  bossTrou = min(bossTrou, length(vPosB - c3) / 0.05 + n);
  bossTrou = min(bossTrou, length(vPosB - c4) / 0.07 + n);
  if (bossTrou < 1.0) discard;
}
#endif
`)
        .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef BOSS_DOUBLURE
if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, uDoublure * (0.75 + 0.5 * bN3(vPosB * 40.0)), 0.85);
#endif
#ifdef BOSS_DECHIRURES
diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(1.0, 1.35, bossTrou));
#endif
#ifdef BOSS_ETOLE
float bossBrod = 0.0;
{
  float eu = vBoss.x, ev = vBoss.y;
  float bord = min(eu, 1.0 - eu);
  float lis = 1.0 - smoothstep(0.016, 0.026, abs(bord - 0.08));
  float cel = floor(ev / 0.078);
  vec2 q = vec2((eu - 0.5) * 0.088, (fract(ev / 0.078) - 0.5) * 0.078) / 0.026;
  float d = abs(q.x) < 1.4 ? bGlyphe(q, cel) : 9.0;
  float gl = 1.0 - smoothstep(0.075, 0.13, d);
  bossBrod = max(lis, gl);
  float fil = 0.72 + 0.5 * bN3(vPosB * 420.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.21, 0.09) * fil, bossBrod * 0.9);
}
#endif
#ifdef BOSS_BANDAGE
{
  // bandes enroulées en spirale autour de l'axe de l'avant-bras (pose de référence)
  float sxB = vPosB.x >= 0.0 ? 1.0 : -1.0;
  vec3 shB = vec3(0.185 * sxB, 1.418, -0.035), adB = vec3(0.34202 * sxB, -0.93969, 0.0);
  vec3 rB = vPosB - shB;
  float sB = dot(rB, adB);
  vec3 radB = rB - adB * sB;
  vec3 e1B = normalize(cross(adB, vec3(0.0, 0.0, 1.0)));
  float angB = atan(dot(radB, cross(adB, e1B)), dot(radB, e1B));
  float fB = fract(sB / 0.019 + sxB * angB / 6.2831853);
  float bordB = smoothstep(0.78, 0.97, fB);
  float clairB = 1.0 - smoothstep(0.0, 0.18, fB);
  float trameB = 0.9 + 0.1 * sin(sB * 1400.0 + angB * 40.0) * sin(angB * 90.0 - sB * 900.0);
  diffuseColor.rgb *= trameB * (1.0 - 0.55 * bordB) * (1.0 + 0.18 * clairB);
}
#endif
#ifdef BOSS_TETE7
float bossT7c = 0.0, bossT7r = 0.0, bossAgr = 0.0;
{
  vec3 dp = vPosB - vec3(0.0, 1.786, 0.008);
  if (vPosB.y > 1.70 && dot(normalize(vNorB), vec3(0.0, 0.928, 0.372)) > 0.05) {
    vec2 q = vec2(dp.x, dot(dp, vec3(0.0, -0.372, 0.928))) / 0.058;
    float wob = (bN3(vPosB * 380.0) - 0.5) * 0.014;
    float d = bSceau7c(q) + wob;
    bossT7c = 1.0 - smoothstep(0.018, 0.036, d);
    bossT7r = (1.0 - smoothstep(0.036, 0.075, d)) * (1.0 - bossT7c);
  }
  float dmin = 9.0, sAt = 0.0, acc = 0.0;
  for (int i = 0; i < 5; i++) {
    vec3 a = uCicatrice[i], ba = uCicatrice[i + 1] - uCicatrice[i];
    float L = max(length(ba), 1e-5);
    float h = clamp(dot(vPosB - a, ba) / (L * L), 0.0, 1.0);
    float dd = length(vPosB - a - ba * h);
    if (dd < dmin) { dmin = dd; sAt = acc + h * L; }
    acc += L;
  }
  float cic = 1.0 - smoothstep(0.0007, 0.0015, dmin);
  float bour = (1.0 - smoothstep(0.0015, 0.0032, dmin)) * (1.0 - cic);
  float stp = abs(fract(sAt / 0.0088) - 0.5);
  bossAgr = (1.0 - smoothstep(0.07, 0.1, stp)) * (1.0 - smoothstep(0.0036, 0.0044, dmin)) * step(0.005, sAt) * step(sAt, acc - 0.005);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.9, 0.92) + vec3(0.04, 0.0, 0.0), bour * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.05, 0.05), cic * 0.85);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.05, 0.03), bossT7c * 0.92);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.86, 0.86), bossT7r * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.33, 0.32), bossAgr);
}
#endif
#ifdef BOSS_SCEAUX
float bossSc = 0.0;
{
  float ds = 9.0;
  if (vNorB.z < -0.2 && vPosB.z < -0.03) {
    ds = min(ds, bSceauD(vec2(vPosB.x, vPosB.y - 1.265) / 0.15, 1.0) * 0.15);
    ds = min(ds, bSceauD(vec2(vPosB.x - 0.155, vPosB.y - 0.64) / 0.095, 2.0) * 0.095);
    ds = min(ds, bSceauD(vec2(vPosB.x + 0.155, vPosB.y - 0.64) / 0.095, 3.0) * 0.095);
  }
  if (vNorB.z > 0.25 && vPosB.z > 0.02) {
    ds = min(ds, bSceauD(vec2(vPosB.x - 0.235, vPosB.y - 0.56) / 0.062, 5.0) * 0.062);
    ds = min(ds, bSceauD(vec2(vPosB.x + 0.235, vPosB.y - 0.56) / 0.062, 6.0) * 0.062);
  }
  float wob = (bN3(vPosB * 90.0) - 0.5) * 0.0012;
  float ch = 1.0 - smoothstep(0.0024, 0.0062, ds + wob);
  bossSc = 1.0 - smoothstep(0.0007, 0.0024, ds + wob);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.22 + vec3(0.03, 0.012, 0.006), ch * 0.9);
}
#endif
`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef BOSS_LAME
roughnessFactor = mix(roughnessFactor, 0.85, vBoss.z);
#endif
#ifdef BOSS_TETE7
roughnessFactor = mix(roughnessFactor, 0.32, bossAgr);
#endif
#ifdef BOSS_ETOLE
roughnessFactor = mix(roughnessFactor, 0.72, bossBrod);
#endif
`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
#ifdef BOSS_TETE7
metalnessFactor = mix(metalnessFactor, 0.85, bossAgr);
#endif
#ifdef BOSS_ETOLE
metalnessFactor = mix(metalnessFactor, 0.06, bossBrod);
#endif
`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef BOSS_EMISMASQUE
totalEmissiveRadiance *= vBoss.z;
#endif
#ifdef BOSS_SCEAUX
if (gl_FrontFacing) totalEmissiveRadiance += uSceauCoul * bossSc * (0.025 + uPuis * uPuis * 1.3 * (0.8 + 0.2 * sin(uTemps * 6.0 + vPosB.y * 23.0)));
#endif
#ifdef BOSS_LUEUR
totalEmissiveRadiance += uVeineCoul * vBoss.z * uVeine * (0.75 + 0.25 * sin(uTemps * 4.0 + vPosB.y * 30.0 + vPosB.x * 20.0));
#endif
#ifdef BOSS_TETE7
totalEmissiveRadiance += vec3(1.5, 0.36, 0.07) * bossT7c * (0.35 + 0.9 * clamp(uPuis + uVeine, 0.0, 1.2)) * (0.85 + 0.15 * sin(uTemps * 2.7));
#endif
#ifdef BOSS_ETOLE
totalEmissiveRadiance += uSceauCoul * bossBrod * (0.003 + uPuis * uPuis * 0.06) * (0.8 + 0.2 * sin(uTemps * 5.0 + vBoss.y * 9.0));
#endif
#ifdef BOSS_LAME
{
  float sangL = 1.0 - vBoss.z;
  float vnL = abs(bF3(vPosB * 6.0 + vec3(0.0, uTemps * 0.12, 0.0)) - 0.5);
  float veL = 1.0 - smoothstep(0.0, 0.014, vnL);
  float finL = 1.0 - clamp(vBoss.y, 0.0, 1.0);
  float fresL = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
  float frontL = 1.0 - smoothstep(0.0, 0.07, bossLf);
  float fissL = uFiss * (1.0 - smoothstep(0.0, 0.025, abs(bF3(vPosB * 20.0 + 3.3) - 0.5))) * smoothstep(0.0, 0.3, uFiss * 1.3 - bF3(vPosB * 3.0) * 0.8);
  // uLameReg (palette, v2.2) : x = lueur de base du verre, y = reflet de bord, z = force des veines ; rouge : (0, 0,1, 1)
  totalEmissiveRadiance += uVeineCoul * sangL * (veL * (0.12 + 0.6 * uPouls) * (0.6 + 0.6 * uVeine) * uLameReg.z + finL * finL * finL * 0.1 + fresL * uLameReg.y + uLameReg.x + frontL * 3.0 + fissL * 5.0);
  if (uEffrit > 0.0) totalEmissiveRadiance += uVeineCoul * (1.0 - smoothstep(0.0, 0.05, bossLe)) * 3.0;
}
#endif
#ifdef BOSS_MEMBRANE
{
  float vn = abs(bF3(vPosB * 9.0 + 1.7) - 0.5);
  float ve = 1.0 - smoothstep(0.0, 0.018, vn);
  float ve2 = 1.0 - smoothstep(0.0, 0.012, abs(bF3(vPosB * 23.0 + 4.1) - 0.5));
  float bord = 1.0 - smoothstep(0.0, 0.22, vBoss.y);
  float bt = smoothstep(0.6, 0.655, bossTm);
  float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
  float fb = 1.0 - smoothstep(0.0, 0.06, bossFormBord);
  float pulse = 0.65 + 0.35 * sin(uTemps * 4.5 + vPosB.x * 7.0 + vPosB.y * 3.0);
  diffuseColor.rgb *= 1.0 - 0.6 * bt;
  totalEmissiveRadiance += uVeineCoul * ((ve * 0.55 + ve2 * 0.25) * (0.08 + 0.35 * uVeine) * pulse + bord * 0.22 + bt * 0.45 + fres * 0.06 + fb * 2.0);
}
#endif
if (uDissol > 0.0) totalEmissiveRadiance += uDissolCoul * ((1.0 - smoothstep(0.0, 0.035, bossDv)) * 3.2 + (1.0 - smoothstep(0.0, 0.12, bossDv)) * 0.6);
totalEmissiveRadiance += uFlash;
`);
    };
    return mat;
  }
  // matériau de profondeur (ombres) qui suit la dissolution et le flottement
  function depthBoss(THREE, flags, U, tag) {
    const rev = parseInt(THREE.REVISION, 10);
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    if (rev < 129) m.skinning = true;
    const f = { FLOT: !!flags.FLOT, DEPTH: true };
    const defs = Object.keys(f).filter((k) => f[k]).map((k) => '#define BOSS_' + k + '\n').join('');
    m.customProgramCacheKey = () => 'bossdepth-' + (tag || '') + (f.FLOT ? '-flot' : '');
    m.onBeforeCompile = (sh) => {
      for (const k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
${defs}
attribute vec3 aBoss;
varying vec3 vPosB;
uniform float uTemps;
uniform float uFlotAmp;
`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosB = position;
#ifdef BOSS_FLOT
if (aBoss.x > 0.0) {
  float ph = position.x * 11.0 + position.z * 9.0 + position.y * 4.0;
  transformed += normal * (sin(uTemps * 3.3 + ph) * 0.6 + sin(uTemps * 5.9 + ph * 1.73) * 0.4) * aBoss.x * uFlotAmp;
}
#endif
`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vPosB;
uniform float uDissol;
${GLSL_BRUIT}
float bossDissVal(){
  float d = length((vPosB - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0));
  return clamp(0.6 * bF3(vPosB * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0);
}
`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uDissol > 0.0 && bossDissVal() - (uDissol * 1.08 - 0.04) < 0.0) discard;
`);
    };
    return m;
  }

  /** Matériaux PBR du corps : couleurs de sommets × texture de détail, retouches communes. */
  function materiauxCorps(THREE, U, opts) {
    const rev = parseInt(THREE.REVISION, 10);
    const TD = texturesDetail(THREE);
    const defs = {
      peau: { r: 0.6, tex: 'peau', tile: 0.035, ns: 0.55, f: { LUEUR: true, TROU: true, TETE7: !!(opts && opts.teteRemplacement) } },
      manteau: { r: 0.66, tex: 'cuir', tile: 0.05, ns: 0.75, double: true, morph: true, f: { SCEAUX: true, DOUBLURE: true, DECHIRURES: true, FLOT: true } },
      tunique: { r: 0.93, tex: 'drap', tile: 0.03, ns: 0.7, f: {} },
      pantalon: { r: 0.92, tex: 'drap', tile: 0.035, ns: 0.6, double: true, f: {} },
      botte: { r: 0.55, tex: 'cuir', tile: 0.06, ns: 0.55, f: {} },
      cuir: { r: 0.62, tex: 'cuir', tile: 0.04, ns: 0.6, f: {} },
      gant: { r: 0.5, tex: 'cuir', tile: 0.022, ns: 0.45, f: {} },
      metal: { r: 0.48, m: 0.75, tex: 'cuir', tile: 0.02, ns: 0.25, f: {} },
      yeux: { r: 0.22, f: { EMISMASQUE: true }, emis: 0xff2a12 },
      bouche: { r: 0.75, f: {} },
      lambeaux: { r: 0.7, tex: 'cuir', tile: 0.05, ns: 0.75, double: true, f: { DOUBLURE: true, FLOT: true } },
      etole: { r: 0.88, tex: 'drap', tile: 0.012, ns: 0.6, double: true, f: { ETOLE: true } },
      ame: { r: 0.3, f: { EMISMASQUE: true }, emis: 0x34e6c2, emisI: 1.15 },
      verre: { r: 0.06, f: {}, transparent: 0.32 },
      bandage: { r: 0.95, tex: 'drap', tile: 0.008, ns: 0.8, f: { BANDAGE: true } }
    };
    const out = {};
    for (const k in defs) {
      const d = defs[k];
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: d.r, metalness: d.m || 0,
        side: d.double ? THREE.DoubleSide : THREE.FrontSide
      });
      if (d.transparent) { m.transparent = true; m.opacity = d.transparent; m.depthWrite = false; }
      if (d.morph && rev < 129) m.morphTargets = true;
      if (d.tex && TD[d.tex]) {
        const T = TD[d.tex];
        const rep = 1 / d.tile;
        const td = T.d.clone(), tn = T.n.clone();
        td.needsUpdate = true; tn.needsUpdate = true;
        td.repeat.set(rep, rep); tn.repeat.set(rep, rep);
        m.map = td; m.roughnessMap = td; m.normalMap = tn;
        m.normalScale.set(d.ns, d.ns);
        m.color.setScalar(1 / 0.8);
        m.roughness = Math.min(1, d.r / 0.8);
      }
      if (d.emis) { m.emissive.setHex(d.emis); m.emissiveIntensity = d.emisI || 2.5; }
      if (rev < 129) m.skinning = true;
      patchBoss(THREE, m, d.f, U, k);
      m.name = 'boss-' + k;
      m.userData.flags = d.f;
      out[k] = m;
    }
    return out;
  }
