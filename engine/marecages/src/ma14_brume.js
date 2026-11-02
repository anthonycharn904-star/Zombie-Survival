
/* ------------------------------------------------- Brume du marais (kit MM 2.1.5) --
   Demande d'Anthony du 27 octobre 2026 : « davantage de brume marécageuse partout, au niveau des
   îles comme au niveau de l'eau ». Deux étages :
   · une nappe dans tous les rendus avec brouillard : densité qui décroît avec la hauteur au-dessus
     de l'eau (exponentielle, échelle de 3 m), intégrée exactement le long du regard (le fond des
     îles, les troncs, les berges s'y noient, les cimes et les toits en sortent), en bancs qui
     dérivent avec le vent (bruit de valeur à deux octaves, pris en trois points du regard : on
     traverse les bancs), plus claire du côté de la lune. Elle s'ajoute au brouillard de la carte ;
     sa couleur se mêle à celle du brouillard selon la part de chacun ;
   · les nappes de sprites (ma03) : plus nombreuses sur l'eau, et des écharpes basses sur les îles.
   Moteur : les morceaux de shader du brouillard (fog_*) de three r128 sont complétés une fois, au
   chargement du script, avant toute compilation. Un seul tableau d'uniformes (MA_HF, Float32Array
   partagé par référence par toutes les matières : UniformsUtils.clone ne copie pas les tableaux
   typés). Hors du marais, MA_HF[0] = 0 : la branche n'est pas prise, le rendu des autres cartes est
   inchangé (même facteur, même couleur). Les matières additives (halos des lampes, lueurs, feux
   follets) : HFOG_ADD, la brume les éteint au lieu de les teinter. Les particules et les sprites (gouttes,
   embruns, fumées, nappes) : HFOG_LITE, sans les bancs (trois bruits de moins par point : près de la
   caméra, leurs couches se superposent ; la mesure en rendu logiciel montrait l'image de l'impact de la
   ruée 2,6 fois plus longue). */
function maHFogLite(m) { if (m) { m.defines = Object.assign({}, m.defines, { HFOG_LITE: '' }); m.needsUpdate = true; } return m; }
const MA_HF = new Float32Array(20);
/* [0] force (0 : éteinte), densité de la nappe basse (1/m), 1/sa hauteur d'échelle, son niveau (l'eau ; sur
       une île, il suit le sol sous la caméra : la nappe colle à la terre ferme où l'on marche)
   [1] couleur de la brume (couleur d'écran, comme fogColor), part des bancs (0 : uniforme)
   [2] décalage du vent (dans le bruit), échelle du bruit (1/m), densité du voile haut (1/m)
   [3] direction de la lune, diffusion vers l'avant
   [4] 1/hauteur d'échelle du voile haut, son niveau (l'eau), 1 : bancs pris en un seul point (qualité basse) */
const MA_HF_GLSL = `
uniform vec4 uHFog[ 5 ];
float hfHash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float hfNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( hfHash( i ), hfHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hfHash( i + vec2( 0.0, 1.0 ) ), hfHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float hfField( vec2 p ) {
	vec2 q = p * uHFog[ 2 ].z + uHFog[ 2 ].xy;
	return 0.62 * hfNoise( q ) + 0.38 * hfNoise( q * 2.7 + vec2( 17.3, -9.1 ) - uHFog[ 2 ].xy * 0.7 );
}
float hfLayer( float a, float b, float hc, float hp, float L ) {
	float e = b * ( hp - hc ), F = abs( e ) < 1e-3 ? 1.0 - 0.5 * e : ( 1.0 - exp( - e ) ) / e;
	return a * L * exp( - b * hc ) * F;
}
float hfTau( vec3 d ) {
	float L = length( d );
	vec3 dir = d / max( L, 1e-4 );
	vec2 c = cameraPosition.xz;
	#ifdef HFOG_LITE
		float n = 0.5;
	#else
		float n = uHFog[ 4 ].z > 0.5 ? hfField( c + dir.xz * min( L, 26.0 ) )
			: 0.3 * hfField( c + dir.xz * min( L, 8.0 ) ) + 0.35 * hfField( c + dir.xz * min( L, 26.0 ) ) + 0.35 * hfField( c + dir.xz * min( L, 64.0 ) );
	#endif
	float nG = max( 0.1, 1.0 + 3.2 * uHFog[ 1 ].w * ( n - 0.5 ) ), nH = 1.0 + 0.8 * uHFog[ 1 ].w * ( n - 0.5 );
	float yc = cameraPosition.y, yp = yc + d.y;
	float bG = uHFog[ 0 ].z * mix( 1.25, 0.72, clamp( nG * 0.5, 0.0, 1.0 ) );
	float tG = hfLayer( uHFog[ 0 ].y * nG, bG, max( yc - uHFog[ 0 ].w, 0.0 ), max( yp - uHFog[ 0 ].w, -0.4 ), L );
	float tH = hfLayer( uHFog[ 2 ].w * nH, uHFog[ 4 ].x, max( yc - uHFog[ 4 ].y, 0.0 ), max( yp - uHFog[ 4 ].y, -0.4 ), L );
	return uHFog[ 0 ].x * ( tG + tH );
}
vec3 hfColor( vec3 d ) {
	float m = max( dot( d / max( length( d ), 1e-4 ), uHFog[ 3 ].xyz ), 0.0 );
	m *= m;
	return uHFog[ 1 ].rgb * ( 1.0 + uHFog[ 3 ].w * m * m );
}
`;
(function maHFogPatch() {
  const C = THREE.ShaderChunk;
  if (C.fog_fragment.indexOf('uHFog') >= 0) return;
  C.fog_pars_vertex += '\n#ifdef USE_FOG\n\tvarying vec3 vHFogW;\n#endif';
  C.fog_vertex += '\n#ifdef USE_FOG\n\tvHFogW = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;\n#endif';
  C.fog_pars_fragment += '\n#ifdef USE_FOG\n\tvarying vec3 vHFogW;\n' + MA_HF_GLSL + '\n#endif';
  C.fog_fragment = [
    '#ifdef USE_FOG',
    '\t#ifdef FOG_EXP2',
    '\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );',
    '\t#else',
    '\t\tfloat fogFactor = smoothstep( fogNear, fogFar, fogDepth );',
    '\t#endif',
    '\tvec3 fogTint = fogColor;',
    '\t#ifdef FOG_EXP2',
    '\tif ( uHFog[ 0 ].x > 0.0 ) {',
    '\t\tfloat hfT = hfTau( vHFogW ), hfF = fogDensity * fogDensity * fogDepth * fogDepth, hfS = hfF + hfT;',
    '\t\tfogFactor = 1.0 - exp( - hfS );',
    '\t\tfogTint = mix( fogColor, hfColor( vHFogW ), hfT / max( hfS, 1e-5 ) );',
    '\t}',
    '\t#endif',
    '\t#ifdef HFOG_ADD',
    '\t\tif ( uHFog[ 0 ].x > 0.0 ) gl_FragColor.rgb *= 1.0 - fogFactor; else gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );',
    '\t#else',
    '\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );',
    '\t#endif',
    '#endif',
  ].join('\n');
  // l'uniforme dans toutes les matières qui ont le brouillard (copiées à chaque construction de programme)
  const U = { value: MA_HF };
  THREE.UniformsLib.fog.uHFog = U;
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && u.fogColor && !u.uHFog) u.uHFog = U; }
})();
/* Réglages (MA_HFOG) ; maHFogUpdate chaque image dans le marais ; maHFogOff en le quittant. Nappe basse :
   0,02/m au ras de l'eau (ou du sol de l'île où l'on marche), hauteur d'échelle 1 m : le pied des choses
   s'y noie, la tête en sort ; voile haut : 0,006/m, 4,5 m. Depuis une barque (yeux à 1,3 m), avec le
   brouillard de la carte, un point au ras de l'eau garde la moitié de sa couleur à 36 m (avant : 90 m),
   un point à hauteur des yeux à 49 m. À pied sur une île (yeux à 1,7 m) : le sol à 41 m, une tête à
   60 m. Bancs : densité de la nappe basse de 0,1 à 2,6 fois la moyenne. */
const MA_HFOG = { dG: 0.02, hG: 1.0, dH: 0.006, hH: 4.5, bank: 1, noise: 1 / 34, wind: [0.42, 0.17], col: 0x5a6a62, dread: 0x2c3830, fwd: 0.7, k: 1, yG: 0 };
const _hfC = new THREE.Color(), _hfC2 = new THREE.Color(), _hfV = new THREE.Vector3();
function maHFogUpdate(dt) {
  const H = MA_HFOG, F = MA_HF, dread = MA.dread || 0;
  // niveau de la nappe basse : l'eau, ou le sol sous la caméra quand on est à pied sur une île
  const onFoot = G.state === 'playing' && !VEH.drive && !MA_SWIM.on;
  const gy = onFoot ? clamp(owH(camera.position.x, camera.position.z) - MA.water, 0, 3) : 0;
  H.yG = dt > 0 ? H.yG + (gy - H.yG) * Math.min(1, dt * 1.2) : gy;
  // kit 2.0.7 : sous l'averse (ma17), la nappe basse s'éclaircit un peu (la pluie la lave), le voile haut
  // s'épaissit (le rideau de pluie au loin : les îles s'effacent) et se grise ; l'éclair (ma18) l'allume, de
  // son côté ; le vent de l'orage pousse les bancs
  const W = typeof MA_WX !== 'undefined' && MA_WX.ready ? MA_WX : null, rI = W ? W.I : 0;
  const FL = W && typeof maStormFlash === 'function' ? maStormFlash() : null, fa = FL ? FL.amb : 0, fi = FL ? FL.i : 0;
  F[0] = H.k; F[1] = H.dG * (1 + 0.25 * dread) * (1 - 0.25 * rI); F[2] = 1 / H.hG; F[3] = MA.water + H.yG;
  _hfC.setHex(H.col).lerp(_hfC2.setHex(H.dread), dread * 0.55);
  if (rI > 0) _hfC.lerp(_hfC2.setHex(0x4c5456), rI * 0.4);
  if (fa > 0.001) { const red = typeof maFlashRed === 'function' ? maFlashRed() : 0; _hfC.lerp(_hfC2.setRGB(lerp(0.62, 0.7, red), lerp(0.68, 0.12, red), lerp(0.76, 0.13, red)), Math.min(0.85, fa * 0.25)); }
  F[4] = _hfC.r; F[5] = _hfC.g; F[6] = _hfC.b; F[7] = H.bank;
  const wk = 1 + (W ? Math.max(0, W.windS - 0.6) * 0.5 : 0);
  F[8] += H.wind[0] * dt * H.noise * wk; F[9] += H.wind[1] * dt * H.noise * wk; F[10] = H.noise; F[11] = H.dH * (1 + 2 * MA_WXC.hfK * rI);
  if (F[8] > 1000) F[8] -= 1000;
  if (F[9] > 1000) F[9] -= 1000;
  const m = maDir(MA.moon.az, MA.moon.el, _hfV);
  if (fi > 0.001) m.multiplyScalar(0.3).addScaledVector(FL.dir, fi).normalize();
  F[12] = m.x; F[13] = m.y; F[14] = m.z; F[15] = H.fwd * (1 - 0.6 * dread) * (1 + Math.min(2, fi * 0.4));
  F[16] = 1 / H.hH; F[17] = MA.water; F[18] = settings.quality === 'low' ? 1 : 0;
}
function maHFogOff() { MA_HF.fill(0); }
/* Épaisseur optique de la brume entre la caméra et un point (même calcul que le shader, sans les bancs) :
   pour les essais et les réglages. */
function maHFogTau(px, py, pz) {
  const F = MA_HF;
  if (!(F[0] > 0)) return 0;
  const c = camera.position, L = Math.hypot(px - c.x, py - c.y, pz - c.z);
  const layer = (a, b, y0) => { const hc = Math.max(c.y - y0, 0), hp = Math.max(py - y0, -0.4), e = b * (hp - hc), Fe = Math.abs(e) < 1e-3 ? 1 - 0.5 * e : (1 - Math.exp(-e)) / e; return a * L * Math.exp(-b * hc) * Fe; };
  return F[0] * (layer(F[1], F[2], F[3]) + layer(F[11], F[16], F[17]));
}
