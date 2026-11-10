  // ============================================================================================
  // Tête cuite BOSS_B7_TETE (contrat : boss/DESIGN.md). Décodage du maillage quantifié, des textures (albédo,
  // normales, ORM, émission), de la morphose « bouche » (mâchoire ouverte), des dents (l'arcade du bas tourne
  // avec la mâchoire), de la cavité buccale, des yeux (iris incandescent, cornée) et des extensions facultatives
  // (« cligne », cils). Les positions du contrat sont dans le repère du CORPS (1,75 m). La peau (avec le cou)
  // est un SkinnedMesh du squelette du boss, pondéré par les poids « peau » du contrat (head / neck / chest) :
  // le bas du cou suit la poitrine et reste dans le col quand la tête bascule. Yeux, dents et cavité sont
  // rigides sur l'os « head » (repère local du squelette de 1,80 m, groupe du corps à l'échelle 1,75 / 1,80).
  // Méthode de rendu de la peau reprise de la tête du survivant (lumière enveloppante, occlusion cuite).
  // ============================================================================================
  // émission (sceau, iris) : ≈ 2 au repos, ≈ 3,2 au plus fort (rugissements), 0 à la mort
  const LUEUR_PEAU_B7 = 2.0, LUEUR_PEAU_B7_MAX = 3.2, LUEUR_YEUX_B7 = 2.6, LUEUR_YEUX_B7_MAX = 3.6, LUEUR_REPOS = 0.385;
  function b64octets(s) {
    let bin;
    if (typeof atob === 'function') bin = atob(s);
    else bin = Buffer.from(s, 'base64').toString('binary');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  const b64u16 = (s) => new Uint16Array(b64octets(s).buffer);
  const b64u32 = (s) => new Uint32Array(b64octets(s).buffer);
  const b64i16 = (s) => new Int16Array(b64octets(s).buffer);
  const b64i8 = (s) => new Int8Array(b64octets(s).buffer);

  function couleurTete(THREE, hex, linear) {
    const c = new THREE.Color(hex);
    const auto = THREE.ColorManagement && (THREE.ColorManagement.enabled === true || THREE.ColorManagement.legacyMode === false);
    if (linear && !auto && c.convertSRGBToLinear) c.convertSRGBToLinear();
    return c;
  }
  function espaceTexture(THREE, tex, srgb) {
    if ('colorSpace' in tex) tex.colorSpace = srgb ? (THREE.SRGBColorSpace || 'srgb') : (THREE.NoColorSpace || '');
    else tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  }
  // Peau : lumière enveloppante (cire translucide) + diffusion au terminateur, occlusion cuite sur la lumière
  // directe dans les creux. Compatible r128 (geometry.normal) et r150+ (geometryNormal). Ajoute l'éclair uFlash.
  function retoucheePeauB7(THREE, U) {
    return function (shader) {
      shader.uniforms.uFlash = U.uFlash;
      shader.uniforms.uDissol = U.uDissol; shader.uniforms.uDissolCoul = U.uDissolCoul;
      // dissolution du corps (apparition, téléportations) : même bruit que les vêtements, position du repère du corps
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPosT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosT = position;');
      let chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
      const wrap = (nrm, brdf) => '{ float wNdL = dot( ' + nrm + ', directLight.direction );\n' +
        '  vec3 wrapI = directLight.color * ( max( ( wNdL + 0.4 ) / 1.4, 0.0 ) * 0.65 + max( wNdL, 0.0 ) * 0.35 );\n' +
        '  vec3 scat = directLight.color * vec3( 0.10, 0.08, 0.085 ) * max( 0.0, 1.0 - abs( wNdL * 1.8 - 0.15 ) ) * 0.5;\n' +
        '  #ifndef PHYSICALLY_CORRECT_LIGHTS\n  wrapI *= PI; scat *= PI;\n  #endif\n' +
        '  reflectedLight.directDiffuse += ( wrapI + scat ) * ' + brdf + '( material.diffuseColor ); }';
      const a = 'reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );';
      const b = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      if (chunk.indexOf(a) >= 0) chunk = chunk.replace(a, wrap('geometry.normal', 'BRDF_Diffuse_Lambert'));
      else if (chunk.indexOf(b) >= 0) chunk = chunk.replace(b, wrap('geometryNormal', 'BRDF_Lambert'));
      else chunk = null;
      if (chunk) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uFlash;\nuniform float uDissol;\nuniform vec3 uDissolCoul;\nvarying vec3 vPosT;\n' + GLSL_BRUIT +
          'float bossDissT(){ float d = length((vPosT - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0)); return clamp(0.6 * bF3(vPosT * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0); }')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat bossDvT = 1.0;\nif (uDissol > 0.0) { bossDvT = bossDissT() - (uDissol * 1.08 - 0.04); if (bossDvT < 0.0) discard; }')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' +
          '#ifdef USE_AOMAP\n  { float occD = smoothstep( 0.2, 0.72, ambientOcclusion );\n' +
          '    reflectedLight.directDiffuse *= mix( 0.1, 1.0, occD );\n    reflectedLight.directSpecular *= mix( 0.03, 1.0, occD ); }\n#endif')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uFlash;\n' +
          'if (uDissol > 0.0) totalEmissiveRadiance += uDissolCoul * ((1.0 - smoothstep(0.0, 0.035, bossDvT)) * 3.2 + (1.0 - smoothstep(0.0, 0.12, bossDvT)) * 0.6);');
    };
  }
  // texture de repli dessinée (œil incandescent) quand les données n'en fournissent pas
  function texOeilRepli(THREE, emission) {
    if (typeof document === 'undefined') return new THREE.Texture();
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = emission ? '#000' : '#2a1412'; g.fillRect(0, 0, 128, 128);
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 30);
    gr.addColorStop(0, emission ? '#000' : '#050101');
    gr.addColorStop(0.25, emission ? '#ff6a10' : '#c2380c');
    gr.addColorStop(0.8, emission ? '#a01800' : '#5e1206');
    gr.addColorStop(1, emission ? '#000' : '#2a1412');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 30, 0, TAU); g.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // Ressources de la tête partagées par les instances de même configuration (données, version de three, qualité des
  // textures, espace de couleur, allègement, anisotropie) : géométries (peau et morphoses, dents, cavité, yeux, cornée,
  // cils), textures, promesse de chargement, position de repos de l'ancre de la bouche. Rien n'y est modifié en cours de
  // jeu : matériaux, maillages, morphoses actives et ancres appartiennent à chaque instance (creerTeteB7).
  function ressourcesTeteB7(THREE, D, O, osTete, linear, I, aniso) {
    const rev = parseInt(THREE.REVISION, 10);
    const basse = O.qualite === 'basse';
    const geoms = [], texs = [], promesses = [];
    // repère du corps (1,75 m) → repère local de l'os de la tête (squelette de 1,80 m)
    const vl = (x, y, z, out, k) => { out[k] = x / ECHELLE - osTete[0]; out[k + 1] = y / ECHELLE - osTete[1]; out[k + 2] = z / ECHELLE - osTete[2]; };
    const pl = (p) => [p[0] / ECHELLE - osTete[0], p[1] / ECHELLE - osTete[1], p[2] / ECHELLE - osTete[2]];
    const maxTex = basse ? 512 : 0;
    function texture(cles, srgb, repli) {
      let src = null;
      for (const k of cles) if (D.tex && D.tex[k]) { src = D.tex[k]; break; }
      let tex;
      if (!src || typeof document === 'undefined') tex = repli ? repli() : new THREE.Texture();
      else {
        let res;
        promesses.push(new Promise((r) => { res = r; }));
        tex = new THREE.TextureLoader().load(src, (t) => {
          const im = t.image;
          if (maxTex && im && im.width > maxTex) {
            const c = document.createElement('canvas'); c.width = c.height = maxTex;
            c.getContext('2d').drawImage(im, 0, 0, maxTex, maxTex);
            t.image = c; t.needsUpdate = true;
          }
          res();
        }, undefined, () => res());
      }
      espaceTexture(THREE, tex, srgb && linear);
      tex.anisotropy = aniso;
      texs.push(tex);
      return tex;
    }

    // ---------------------------------------------------------------- peau
    const nv = D.nv, bb = D.bbox;
    const q = b64u16(D.pos), nq = b64i8(D.nrm), uq = b64u16(D.uv);
    const iq = nv >= 65536 ? b64u32(D.idx) : b64u16(D.idx);
    const pos = new Float32Array(nv * 3), posC = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      const x = bb[0] + (bb[3] - bb[0]) * q[i * 3] / 65535, y = bb[1] + (bb[4] - bb[1]) * q[i * 3 + 1] / 65535, z = bb[2] + (bb[5] - bb[2]) * q[i * 3 + 2] / 65535;
      vl(x, y, z, pos, i * 3);
      posC[i * 3] = x / ECHELLE; posC[i * 3 + 1] = y / ECHELLE; posC[i * 3 + 2] = z / ECHELLE;   // repère du groupe « corps »
      const nx = nq[i * 3] / 127, ny = nq[i * 3 + 1] / 127, nz = nq[i * 3 + 2] / 127, nl = Math.hypot(nx, ny, nz) || 1;
      nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
      uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
    }
    // peau skinnée (poids du contrat) si possible, sinon rigide sur l'os de la tête
    const W8 = D.peau && D.peau.poids && D.peau.os && I ? b64octets(D.peau.poids) : null;
    const skinnee = !!(W8 && W8.length >= nv * 3 && D.peau.os.every((n) => I[n] != null));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(skinnee ? posC : pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (skinnee) {
      const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), os = D.peau.os.map((n) => I[n]);
      for (let i = 0; i < nv; i++) {
        let t = 0;
        for (let k = 0; k < 3; k++) { si[i * 4 + k] = os[k]; sw[i * 4 + k] = W8[i * 3 + k]; t += W8[i * 3 + k]; }
        for (let k = 0; k < 3; k++) sw[i * 4 + k] = t > 0 ? sw[i * 4 + k] / t : (k === 0 ? 1 : 0);
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv2', new THREE.BufferAttribute(uv, 2));        // aoMap en r128
    if (rev >= 151) geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(iq, 1));
    // morphoses : deltas en 1/100 mm (repère du corps) → mètres du repère local ; normales recalculées
    const morphs = [], noms = [];
    const normalesMorph = (dp) => {
      const tmp = new THREE.BufferGeometry();
      const p2 = new Float32Array(pos.length);
      for (let i = 0; i < p2.length; i++) p2[i] = pos[i] + dp[i];   // (repère local : mêmes axes et même échelle que le corps)
      tmp.setAttribute('position', new THREE.BufferAttribute(p2, 3));
      tmp.setIndex(new THREE.BufferAttribute(iq, 1));
      tmp.computeVertexNormals();
      const n2 = tmp.attributes.normal.array, dn = new Float32Array(n2.length);
      // seuls les sommets déplacés changent de normale (évite les écarts de lissage ailleurs)
      for (let i = 0; i < nv; i++) {
        const m = Math.abs(dp[i * 3]) + Math.abs(dp[i * 3 + 1]) + Math.abs(dp[i * 3 + 2]);
        if (m < 1e-6) continue;
        const w = Math.min(1, m / 0.0015);
        for (let k = 0; k < 3; k++) dn[i * 3 + k] = (n2[i * 3 + k] - nrm[i * 3 + k]) * w;
      }
      tmp.dispose();
      return dn;
    };
    const ajouterMorph = (M, nom) => {
      if (!M || !M.idx || !M.delta) return -1;
      const idx = b64u16(M.idx), d = b64i16(M.delta), dp = new Float32Array(nv * 3);
      for (let j = 0; j < idx.length; j++) for (let k = 0; k < 3; k++) dp[idx[j] * 3 + k] = d[j * 3 + k] * 1e-5 / ECHELLE;
      morphs.push({ p: dp, n: normalesMorph(dp) }); noms.push(nom);
      return morphs.length - 1;
    };
    const iBouche = ajouterMorph(D.bouche, 'bouche');
    const iCligne = ajouterMorph(D.cligne, 'cligne');
    if (morphs.length) {
      geo.morphAttributes.position = morphs.map((m, i) => { const a = new THREE.BufferAttribute(m.p, 3); a.name = noms[i]; return a; });
      geo.morphAttributes.normal = morphs.map((m, i) => { const a = new THREE.BufferAttribute(m.n, 3); a.name = noms[i]; return a; });
      geo.morphTargetsRelative = true;
    }
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 0.05;
    geoms.push(geo);
    const tex = { albedo: texture(['albedo'], true), normal: texture(['normal'], false), emission: texture(['emission', 'emissif'], true), orm: texture(['orm'], false) };

    // ---------------------------------------------------------------- mâchoire, dents, cavité
    const J = D.machoire || { pivot: [0, 1.5995, 0.0015], axe: [1, 0, 0], angle: 0.42 };
    const pivotL = pl(J.pivot), axeJ = vnorm([J.axe[0], J.axe[1], J.axe[2]]), angMax = J.angle != null ? J.angle : 0.42;
    const geoSimple = (V, Ix, decal) => {
      const n = V.length / 3, a = new Float32Array(V.length);
      for (let i = 0; i < n; i++) vl(V[i * 3], V[i * 3 + 1], V[i * 3 + 2], a, i * 3);
      if (decal) for (let i = 0; i < n; i++) { a[i * 3] -= decal[0]; a[i * 3 + 1] -= decal[1]; a[i * 3 + 2] -= decal[2]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      g.setIndex(Ix);
      g.computeVertexNormals();
      geoms.push(g);
      return g;
    };
    let geoDentsHaut = null, geoDentsBas = null, geoCavite = null;
    if (D.dents && !O.allege) {           // allégé (illusions) : pas de dents (invisibles à distance, 2 appels de dessin)
      if (D.dents.haut && D.dents.haut.v && D.dents.haut.v.length) geoDentsHaut = geoSimple(D.dents.haut.v, D.dents.haut.i);
      if (D.dents.bas && D.dents.bas.v && D.dents.bas.v.length) geoDentsBas = geoSimple(D.dents.bas.v, D.dents.bas.i, pivotL);
    }
    // cavité buccale : rouge très sombre ; les sommets de « caviteBas » suivent la mâchoire (morphose calculée)
    if (D.cavite && D.cavite.v && D.cavite.v.length) {
      const g = geoSimple(D.cavite.v, D.cavite.i);
      if (D.caviteBas && D.caviteBas.length) {
        const P2 = g.attributes.position.array, dp = new Float32Array(P2.length);
        const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axeJ[0], axeJ[1], axeJ[2]), angMax), v = new THREE.Vector3();
        for (const i of D.caviteBas) {
          v.set(P2[i * 3] - pivotL[0], P2[i * 3 + 1] - pivotL[1], P2[i * 3 + 2] - pivotL[2]).applyQuaternion(qa);
          dp[i * 3] = v.x + pivotL[0] - P2[i * 3]; dp[i * 3 + 1] = v.y + pivotL[1] - P2[i * 3 + 1]; dp[i * 3 + 2] = v.z + pivotL[2] - P2[i * 3 + 2];
        }
        const a = new THREE.BufferAttribute(dp, 3); a.name = 'bouche';
        g.morphAttributes.position = [a]; g.morphTargetsRelative = true;
      }
      geoCavite = g;
    }

    // ---------------------------------------------------------------- yeux : globe à iris émissif, cornée
    const Y = D.yeux || {};
    const er = (Y.rayon || (D.eye && D.eye.r) || 0.0117) / ECHELLE;
    const centres = [Y.gauche || [0.0306, 1.6209, 0.0637], Y.droit || [-0.0306, 1.6209, 0.0637]];
    tex.oeil = texture(['oeil'], true, () => texOeilRepli(THREE, false));
    tex.oeilEmission = texture(['oeilEmission', 'oeilEmissif'], true, () => texOeilRepli(THREE, true));
    const ri = er * 0.5, zi = Math.sqrt(er * er - ri * ri);
    const oeilGeo = new THREE.SphereGeometry(er, basse ? 18 : 26, basse ? 12 : 16);
    oeilGeo.rotateX(Math.PI / 2);
    {
      const p = oeilGeo.attributes.position, uvs = oeilGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i); let z = p.getZ(i); const rr = Math.hypot(x, y);
        if (z > 0 && rr < ri) z = zi + er * 0.019 * (1 - (rr / ri) * (rr / ri));
        p.setXYZ(i, x, y, z);
        uvs.setXY(i, 0.5 + x / (2.1 * er), 0.5 + y / (2.1 * er));
      }
      oeilGeo.computeVertexNormals();
    }
    geoms.push(oeilGeo);
    const rc = er * 0.66, th = Math.asin(Math.min(0.99, ri / rc)) * 1.04, z0 = zi - rc * Math.cos(Math.asin(Math.min(0.99, ri / rc)));
    const corneeGeo = new THREE.SphereGeometry(rc, 22, 8, 0, TAU, 0, th);
    corneeGeo.rotateX(Math.PI / 2); corneeGeo.translate(0, 0, z0);
    geoms.push(corneeGeo);

    // ---------------------------------------------------------------- cils (extension facultative, ancien format)
    let geoCils = null;
    if (!basse && D.cils && D.cils.v && D.tex && D.tex.cils) {
      const L = D.cils, lv = L.v, n = lv.length / 3;
      const LP = new Float32Array(n * 6), LU = new Float32Array(n * 4), LB = new Float32Array(n * 6), LN = new Float32Array(n * 6), LI = [];
      for (let s = 0; s < 2; s++) {
        const sx = s === 0 ? 1 : -1, c = pl(centres[s]);
        for (let v = 0; v < n; v++) {
          const o = s * n + v;
          LP[o * 3] = c[0] + sx * lv[v * 3] / 1000; LP[o * 3 + 1] = c[1] + lv[v * 3 + 1] / 1000; LP[o * 3 + 2] = c[2] + lv[v * 3 + 2] / 1000;
          if (L.cligne) { LB[o * 3] = sx * L.cligne[v * 3] / 100000; LB[o * 3 + 1] = L.cligne[v * 3 + 1] / 100000; LB[o * 3 + 2] = L.cligne[v * 3 + 2] / 100000; }
          LU[o * 2] = L.uv[v * 2]; LU[o * 2 + 1] = L.uv[v * 2 + 1];
          LN[o * 3 + 1] = 0.3; LN[o * 3 + 2] = 0.95;
        }
        for (let t = 0; t < L.i.length; t += 3) {
          if (s === 0) LI.push(L.i[t], L.i[t + 1], L.i[t + 2]); else LI.push(n + L.i[t], n + L.i[t + 2], n + L.i[t + 1]);
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(LP, 3));
      lg.setAttribute('normal', new THREE.BufferAttribute(LN, 3));
      lg.setAttribute('uv', new THREE.BufferAttribute(LU, 2));
      lg.setIndex(LI);
      if (L.cligne) { const a = new THREE.BufferAttribute(LB, 3); a.name = 'cligne'; lg.morphAttributes.position = [a]; lg.morphTargetsRelative = true; }
      lg.computeBoundingSphere();
      geoms.push(lg);
      geoCils = lg;
      tex.cils = texture(['cils'], true);
    }

    // ---------------------------------------------------------------- ancre de la bouche (centre des lèvres), bouche fermée
    const bL = pl([0, (J.pivot[1] || 1.5995) + 0.0045 * ECHELLE, 0.086]);
    let boucheRepos;
    {
      // la bouche se trouve devant le pivot de la mâchoire : on prend le point le plus en avant du bas du visage
      let best = -Infinity, by = bL[1], bz = bL[2];
      const yRef = pivotL[1] + 0.004;
      for (let i = 0; i < nv; i++) {
        const y = pos[i * 3 + 1], x = pos[i * 3];
        if (Math.abs(x) < 0.006 && Math.abs(y - yRef) < 0.012 && pos[i * 3 + 2] > best) { best = pos[i * 3 + 2]; by = y; bz = pos[i * 3 + 2]; }
      }
      boucheRepos = [0, by, Number.isFinite(best) ? bz - 0.004 : bL[2]];
    }
    return {
      geo: geo, skinnee: skinnee, nv: nv, noms: noms, iBouche: iBouche, iCligne: iCligne, pivotL: pivotL, axe: axeJ, angMax: angMax,
      geoDentsHaut: geoDentsHaut, geoDentsBas: geoDentsBas, geoCavite: geoCavite, oeilGeo: oeilGeo, corneeGeo: corneeGeo, geoCils: geoCils,
      centres: centres.map(pl), tex: tex, boucheRepos: boucheRepos,
      pret: promesses.length ? Promise.all(promesses) : Promise.resolve(),
      liberer: () => { geoms.forEach((g) => g.dispose()); texs.forEach((t) => t.dispose()); }
    };
  }

  function creerTeteB7(THREE, D, O, U, osTete, linear, I) {
    const rev = parseInt(THREE.REVISION, 10);
    const basse = O.qualite === 'basse';
    const ombres = O.ombres !== false;
    const aniso = O.renderer && O.renderer.capabilities ? Math.min(8, O.renderer.capabilities.getMaxAnisotropy()) : 4;
    // géométries et textures : partagées entre instances de même configuration (illusions) ; le reste est à l'instance
    const cle = ['tete', idDonnees(D), THREE.REVISION, basse ? 'basse' : 'haute', linear ? 1 : 0, O.allege ? 'allege' : 'complet', aniso].join('|');
    const res = prendreRessource(THREE, cle, () => ressourcesTeteB7(THREE, D, O, osTete, linear, I, aniso));
    const R = res.valeur, T = R.tex;
    const objet = new THREE.Group();
    objet.name = 'boss-tete';
    const mats = {}, meshes = {};

    // ---------------------------------------------------------------- peau
    const peauM = new THREE.MeshStandardMaterial({
      map: T.albedo, normalMap: T.normal, roughness: 1.0, metalness: 0.0, aoMapIntensity: 0.85,
      emissive: new THREE.Color(1, 1, 1), emissiveMap: T.emission, emissiveIntensity: LUEUR_PEAU_B7
    });
    peauM.aoMap = T.orm; peauM.roughnessMap = T.orm;
    peauM.onBeforeCompile = retoucheePeauB7(THREE, U);
    peauM.customProgramCacheKey = () => 'boss-b7-peau';
    peauM.name = 'boss-tete-peau';
    if (rev < 129 && R.noms.length) { peauM.morphTargets = true; peauM.morphNormals = true; }
    if (rev < 129 && R.skinnee) peauM.skinning = true;
    mats.peau = peauM;
    const peau = R.skinnee ? new THREE.SkinnedMesh(R.geo, peauM) : new THREE.Mesh(R.geo, peauM);
    peau.name = 'boss-tete-peau';
    peau.castShadow = ombres; peau.receiveShadow = ombres;
    if (R.skinnee) peau.frustumCulled = false; else objet.add(peau);   // la peau skinnée va dans le groupe du corps (voir creer)
    meshes.peau = peau;

    // ---------------------------------------------------------------- mâchoire : pivot qui porte l'arcade du bas
    const pivotL = R.pivotL, axe = new THREE.Vector3(R.axe[0], R.axe[1], R.axe[2]), angMax = R.angMax;
    const machoire = new THREE.Object3D();
    machoire.name = 'boss-machoire';
    machoire.position.set(pivotL[0], pivotL[1], pivotL[2]);
    objet.add(machoire);
    if (R.geoDentsHaut || R.geoDentsBas) {
      const dentsM = new THREE.MeshStandardMaterial({ color: couleurTete(THREE, 0xa89c84, linear), roughness: 0.55, metalness: 0.0 });
      dentsM.name = 'boss-dents';
      mats.dents = dentsM;
      if (R.geoDentsHaut) { const m = new THREE.Mesh(R.geoDentsHaut, dentsM); m.name = 'boss-dents-haut'; m.receiveShadow = ombres; objet.add(m); meshes.dentsHaut = m; }
      if (R.geoDentsBas) { const m = new THREE.Mesh(R.geoDentsBas, dentsM); m.name = 'boss-dents-bas'; m.receiveShadow = ombres; machoire.add(m); meshes.dentsBas = m; }
    }
    if (R.geoCavite) {
      const cavM = new THREE.MeshStandardMaterial({ color: couleurTete(THREE, 0x2a0606, linear), roughness: 0.7, metalness: 0, emissive: couleurTete(THREE, 0x3a0400, linear), emissiveIntensity: 0.6 });
      if (rev < 129 && R.geoCavite.morphAttributes.position) cavM.morphTargets = true;
      cavM.name = 'boss-cavite';
      mats.cavite = cavM;
      const m = new THREE.Mesh(R.geoCavite, cavM); m.name = 'boss-cavite'; objet.add(m); meshes.cavite = m;
    }

    // ---------------------------------------------------------------- yeux : globe à iris émissif, cornée
    const oeilM = new THREE.MeshStandardMaterial({
      map: T.oeil, roughness: 0.3, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveMap: T.oeilEmission, emissiveIntensity: LUEUR_YEUX_B7
    });
    oeilM.name = 'boss-yeux';
    mats.yeux = oeilM;
    let corneeM = null;
    if (!basse) {
      corneeM = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      corneeM.name = 'boss-cornee';
      mats.cornee = corneeM;
    }
    const ancres = {};
    R.centres.forEach((L, k) => {
      const piv = new THREE.Object3D(); piv.name = k === 0 ? 'boss-oeilG' : 'boss-oeilD';
      piv.position.set(L[0], L[1], L[2]);
      const globe = new THREE.Mesh(R.oeilGeo, oeilM); globe.name = 'boss-globe'; globe.receiveShadow = ombres; piv.add(globe);
      if (corneeM) { const co = new THREE.Mesh(R.corneeGeo, corneeM); co.name = 'boss-cornee'; co.renderOrder = 2; piv.add(co); }
      objet.add(piv);
      ancres[k === 0 ? 'oeilG' : 'oeilD'] = piv;
    });

    // ---------------------------------------------------------------- cils (extension facultative, ancien format)
    if (R.geoCils) {
      const cilsM = new THREE.MeshStandardMaterial({ map: T.cils, roughness: 0.6, metalness: 0, alphaTest: 0.35, side: THREE.DoubleSide });
      if (rev < 129 && R.geoCils.morphAttributes.position) cilsM.morphTargets = true;
      cilsM.name = 'boss-cils';
      mats.cils = cilsM;
      const m = new THREE.Mesh(R.geoCils, cilsM); m.name = 'boss-tete-cils'; objet.add(m); meshes.cils = m;
    }

    // ---------------------------------------------------------------- ancre de la bouche (centre des lèvres)
    const bouche = new THREE.Object3D(); bouche.name = 'boss-bouche';
    bouche.position.set(R.boucheRepos[0], R.boucheRepos[1], R.boucheRepos[2]);
    objet.add(bouche);
    ancres.bouche = bouche;
    const boucheFermee = bouche.position.clone();

    // ---------------------------------------------------------------- commandes
    const iBouche = R.iBouche, iCligne = R.iCligne;
    const etat = { machoire: 0, cligne: 0, lueur: 1 };
    const oeilBase = new THREE.Color(1, 1, 1), oeilMort = linear ? new THREE.Color(toLin(0.6), toLin(0.56), toLin(0.55)) : new THREE.Color(0.6, 0.56, 0.55);
    const qj = new THREE.Quaternion(), vj = new THREE.Vector3();
    function setMachoire(v) {
      v = clamp(+v || 0, 0, 1);
      etat.machoire = v;
      if (iBouche >= 0) peau.morphTargetInfluences[iBouche] = v;
      if (meshes.cavite && meshes.cavite.morphTargetInfluences) meshes.cavite.morphTargetInfluences[0] = v;
      machoire.quaternion.setFromAxisAngle(axe, angMax * v);
      // l'ancre suit la lèvre inférieure à mi-ouverture
      qj.setFromAxisAngle(axe, angMax * v * 0.5);
      vj.copy(boucheFermee).sub(machoire.position).applyQuaternion(qj).add(machoire.position);
      bouche.position.copy(vj);
    }
    function setCligne(v) {
      v = clamp(+v || 0, 0, 1);
      etat.cligne = v;
      if (iCligne >= 0) peau.morphTargetInfluences[iCligne] = v;
      if (meshes.cils && meshes.cils.morphTargetInfluences) meshes.cils.morphTargetInfluences[0] = v;
    }
    function setLueur(v) {
      // v = lueur / 2,6 (≈ 0,385 au repos, 1 au plus fort, 0 à la mort)
      v = Math.max(0, +v || 0);
      etat.lueur = v;
      const r = v <= LUEUR_REPOS ? v / LUEUR_REPOS : 1, h = v > LUEUR_REPOS ? clamp((v - LUEUR_REPOS) / (1 - LUEUR_REPOS), 0, 1.2) : 0;
      peauM.emissiveIntensity = LUEUR_PEAU_B7 * r + (LUEUR_PEAU_B7_MAX - LUEUR_PEAU_B7) * h;
      oeilM.emissiveIntensity = LUEUR_YEUX_B7 * r + (LUEUR_YEUX_B7_MAX - LUEUR_YEUX_B7) * h;
      oeilM.color.copy(oeilMort).lerp(oeilBase, r);
    }
    if (peau.morphTargetInfluences) for (let i = 0; i < peau.morphTargetInfluences.length; i++) peau.morphTargetInfluences[i] = 0;
    setMachoire(0); setCligne(0); setLueur(1);
    let tris = R.skinnee ? R.geo.index.count / 3 : 0;
    objet.traverse((m) => { if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3; });
    let libere = false;
    return {
      objet: objet, peauSkinnee: R.skinnee ? peau : null, ancres: ancres, maillages: meshes, materiaux: mats, etat: etat, pret: R.pret,
      stats: { triangles: Math.round(tris), sommetsPeau: R.nv, morphoses: R.noms.slice() },
      setMachoire: setMachoire, setCligne: setCligne, setLueur: setLueur,
      dispose: () => {
        if (libere) return;
        libere = true;
        if (objet.parent) objet.parent.remove(objet); if (R.skinnee && peau.parent) peau.parent.remove(peau);
        for (const k in mats) mats[k].dispose();
        res.rendre();   // géométries et textures : libérées avec la dernière instance qui les utilise
      }
    };
  }
