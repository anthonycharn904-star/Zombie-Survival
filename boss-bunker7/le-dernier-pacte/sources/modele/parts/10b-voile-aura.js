  // ============================================================================================
  // Voile protecteur (bouclier ∈ [0, 1]) : coque translucide à effet de bord qui suit le corps et
  // s'allume en éclats là où elle est touchée (impactVoile(pointMonde), et automatiquement à chaque
  // touche quand le voile est levé). Aura intégrée : halo additif, braises qui montent, fumée légère,
  // étincelles instables quand il est affaibli. Les grands effets restent au module d'effets.
  // ============================================================================================
  function creerVoile(THREE, C) {
    const N_IMP = 8;
    const UV = { uTemps: C.U.uTemps, uForce: { value: 0 }, uCoul: { value: new THREE.Color(0.85, 0.16, 0.12) }, uCoulImp: { value: new THREE.Color(1.0, 0.55, 0.25) }, uImp: { value: [] } };
    for (let i = 0; i < N_IMP; i++) UV.uImp.value.push(new THREE.Vector4(0, -10, 0, -100));
    const mat = new THREE.ShaderMaterial({
      uniforms: UV, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTemps; uniform float uForce; uniform vec3 uCoul; uniform vec3 uCoulImp; uniform vec4 uImp[${N_IMP}];
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float bord = pow(f, 2.6);
          float flux = n3(vL * 5.0 + vec3(0.0, -uTemps * 0.6, 0.0)) * 0.6 + n3(vL * 13.0 + vec3(uTemps * 0.3, 0.0, 0.0)) * 0.4;
          float cell = abs(fract(vL.y * 9.0 + n3(vL * 3.0) * 2.0) - 0.5);
          float base = uForce * (bord * (0.55 + 0.6 * flux) + 0.035 * flux + 0.05 * (1.0 - smoothstep(0.0, 0.04, cell)) * bord);
          float imp = 0.0;
          for (int i = 0; i < ${N_IMP}; i++) {
            float age = uTemps - uImp[i].w;
            if (age < 0.0 || age > 0.9) continue;
            float d = distance(vL, uImp[i].xyz);
            float onde = exp(-pow(d - age * 1.6, 2.0) / 0.0025) * exp(-age * 4.0);
            float eclat = (1.0 - smoothstep(0.0, 0.16 + age * 0.3, d)) * exp(-age * 9.0);
            float fissure = (1.0 - smoothstep(0.0, 0.06, abs(n3(vL * 22.0 + uImp[i].xyz * 7.0) - 0.5))) * (1.0 - smoothstep(0.0, 0.32, d)) * exp(-age * 5.0);
            imp += onde * 0.9 + eclat * 1.6 + fissure * 1.4;
          }
          vec3 c = uCoul * base + uCoulImp * imp * (0.35 + 0.65 * max(uForce, 0.4));
          float a = clamp(base + imp, 0.0, 1.0);
          if (a < 0.002) discard;
          gl_FragColor = vec4(c, a);
        }`
    });
    const R = [0.6, 1.02, 0.52], CY = 1.0;
    const geo = new THREE.SphereGeometry(1, Math.max(16, Math.round(28 * C.q)), Math.max(10, Math.round(18 * C.q)));
    geo.scale(R[0], R[1], R[2]);
    const m = new THREE.Mesh(geo, mat);
    m.name = 'boss-voile';
    m.position.set(0, CY, 0.02);
    m.renderOrder = 5; m.frustumCulled = false; m.visible = false;
    C.B.root.add(m);
    let iImp = 0;
    const tv = new THREE.Vector3();
    const poser = (local) => {
      // ramène le point sur la coque (ellipsoïde)
      const l = Math.hypot(local.x / R[0], local.y / R[1], local.z / R[2]) || 1;
      local.set(local.x / l, local.y / l, local.z / l);
      UV.uImp.value[iImp].set(local.x, local.y, local.z, C.U.uTemps.value);
      iImp = (iImp + 1) % N_IMP;
    };
    return {
      mesh: m, uniformes: UV, triangles: geo.index.count / 3,
      impact(p) { m.updateMatrixWorld(true); tv.set(p.x, p.y, p.z); m.worldToLocal(tv); poser(tv); },
      impactDirection(dirLocal, force, n) {
        // dirLocal : direction de la balle dans le repère du boss ; l'impact est du côté d'où elle vient
        const k = n || iImp + 1;
        tv.set(-dirLocal.x + (hash3(k, 1, 7, 951) - 0.5) * 0.4, -dirLocal.y + 0.3 + (hash3(k, 2, 7, 951) - 0.5) * 0.5, -dirLocal.z + (hash3(k, 3, 7, 951) - 0.5) * 0.4);
        poser(tv);
      },
      maj(ctx) {
        const f = ctx.bouclier * (1 - ctx.dissol);
        UV.uForce.value = f * (0.85 + 0.15 * Math.sin(ctx.temps * 3.1));
        let actif = f > 0.005;
        if (!actif) for (let i = 0; i < N_IMP; i++) if (ctx.temps - UV.uImp.value[i].w < 0.9) { actif = true; break; }
        m.visible = actif;
      },
      reinitialiser() { for (const v of UV.uImp.value) v.set(0, -10, 0, -100); },
      dispose() { geo.dispose(); mat.dispose(); }
    };
  }

  function creerAura(THREE, C) {
    const lin = C.linear;
    const L3 = (r, g, b) => lin ? [r, g, b] : [Math.pow(r, 1 / 2.2), Math.pow(g, 1 / 2.2), Math.pow(b, 1 / 2.2)];
    const grp = new THREE.Group(); grp.name = 'boss-aura';
    C.B.root.add(grp);
    // halo : trois plans croisés autour de l'axe du corps, dégradé radial additif
    const UH = { uTemps: C.U.uTemps, uInt: { value: 0 }, uCoul: { value: new THREE.Color().fromArray(L3(0.75, 0.12, 0.05)) }, uInstable: { value: 0 } };
    const matH = new THREE.ShaderMaterial({
      uniforms: UH, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUV; void main(){ vUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTemps; uniform float uInt; uniform vec3 uCoul; uniform float uInstable; varying vec2 vUV;
        void main(){ vec2 c = (vUV - 0.5) * vec2(2.0, 2.0); float r = length(c * vec2(1.0, 0.72));
          float n = sin(atan(c.y, c.x) * 5.0 + uTemps * 1.3) * 0.06 + sin(atan(c.y, c.x) * 11.0 - uTemps * 2.1) * 0.04;
          float a = pow(max(0.0, 1.0 - r + n), 2.2) * uInt;
          float fl = 1.0 - uInstable * step(0.62, fract(sin(floor(uTemps * 14.0) * 12.9898) * 43758.5453));
          a *= fl;
          if (a < 0.003) discard; gl_FragColor = vec4(uCoul * a, a); }`
    });
    // les trois plans (1,7 × 2,5 m, tournés de 60°) forment une seule géométrie : un seul appel de dessin (v2.2)
    const gH = new THREE.BufferGeometry();
    {
      const P = [], UVh = [], IX = [];
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), b = i * 4;
        for (const [x, y, u, v] of [[-0.85, 1.25, 0, 1], [0.85, 1.25, 1, 1], [-0.85, -1.25, 0, 0], [0.85, -1.25, 1, 0]]) { P.push(x * c, y, -x * s); UVh.push(u, v); }
        IX.push(b, b + 2, b + 1, b + 2, b + 3, b + 1);
      }
      gH.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      gH.setAttribute('uv', new THREE.Float32BufferAttribute(UVh, 2));
      gH.setIndex(IX);
    }
    { const m = new THREE.Mesh(gH, matH); m.name = 'boss-aura-halo'; m.position.set(0, 1.05, -0.02); m.frustumCulled = false; m.renderOrder = 3; grp.add(m); }
    // braises et étincelles (points) dans le repère du monde
    const NB = Math.max(16, Math.round(44 * C.q));
    const geoB = new THREE.BufferGeometry();
    geoB.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
    geoB.setAttribute('aVie', new THREE.BufferAttribute(new Float32Array(NB), 1));
    geoB.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(NB), 1));
    const hauteur = C.opts.renderer && C.opts.renderer.domElement ? C.opts.renderer.domElement.height || 800 : 800;
    const UB = { uEchelle: { value: hauteur * 0.9 }, uCoul: { value: new THREE.Color().fromArray(L3(1.0, 0.42, 0.12)) } };
    const matB = new THREE.ShaderMaterial({
      uniforms: UB, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aVie; attribute float aTaille; uniform float uEchelle; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aVie; gl_PointSize = max(1.0, aTaille * uEchelle / max(0.2, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCoul; varying float vA; void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); float a = vA * max(0.0, 1.0 - r) ; if (a < 0.01) discard; gl_FragColor = vec4(uCoul * a * (1.0 + 1.5 * (1.0 - r)), a); }'
    });
    const pts = new THREE.Points(geoB, matB); pts.frustumCulled = false; pts.matrixAutoUpdate = false; pts.renderOrder = 4;
    C.objet.add(pts);
    const braises = [];
    for (let i = 0; i < NB; i++) braises.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0.02 });
    // fumée légère au bas du manteau (quads croisés, mélange normal sombre)
    const NF = 14;
    const geoF = new THREE.BufferGeometry();
    geoF.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 12), 3));
    geoF.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(NF * 8), 2));
    geoF.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(NF * 4), 1));
    const ixF = new Uint16Array(NF * 6);
    for (let i = 0; i < NF; i++) ixF.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    geoF.setIndex(new THREE.BufferAttribute(ixF, 1));
    for (let i = 0; i < NF; i++) geoF.attributes.aUV.array.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    const matF = new THREE.ShaderMaterial({
      uniforms: { uCoul: { value: new THREE.Color().fromArray(L3(0.03, 0.012, 0.012)) }, uTemps: C.U.uTemps },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute vec2 aUV; attribute float aAlpha; varying vec2 vUV; varying float vA; void main(){ vUV = aUV; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCoul; uniform float uTemps; varying vec2 vUV; varying float vA; void main(){ vec2 c = vUV * 2.0 - 1.0; float r = length(c); float n = sin(c.x * 6.0 + uTemps) * sin(c.y * 5.0 - uTemps * 0.7) * 0.15; float a = vA * pow(max(0.0, 1.0 - r + n), 1.6); if (a < 0.004) discard; gl_FragColor = vec4(uCoul, a); }'
    });
    const fum = new THREE.Mesh(geoF, matF); fum.frustumCulled = false; fum.matrixAutoUpdate = false; fum.renderOrder = 2;
    C.objet.add(fum);
    const fumees = [];
    for (let i = 0; i < NF; i++) fumees.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.2, a: 0 });
    const R = rng(9091);
    let accB = 0, accF = 0, iB = 0, iF = 0, accE = 0;
    const tv = new THREE.Vector3();
    const COUL_SANG = L3(0.8, 0.03, 0.02), COUL_RAGE = L3(0.95, 0.12, 0.04), COUL_CALME = L3(0.75, 0.14, 0.05);
    const spawnCorps = (out, y0, y1, r) => { const a = R() * TAU, rr = r * (0.5 + 0.5 * R()); out.set(Math.sin(a) * rr, lerp(y0, y1, R()), Math.cos(a) * rr); C.corps.localToWorld(out); return out; };
    return {
      triangles: 6 + NF * 2,
      maj(ctx) {
        const A = ctx.A, au = Math.max(0, A[ctx.OFF.au]);
        const intens = au * (0.35 + 0.75 * ctx.puis) * (1 + 0.6 * ctx.rage) * (1 - 0.5 * ctx.faib) * (1 - ctx.dissol);
        UH.uInt.value = 0.16 * intens * (0.85 + 0.15 * Math.sin(ctx.temps * 2.3));
        UH.uInstable.value = clamp(ctx.faib * 1.4 - 0.4, 0, 0.8);
        // lames présentes : halo à la teinte des lames (C.teinte, palette de l'instance) ; sinon énergie du boss
        if (ctx.sang && C.teinte) UH.uCoul.value.copy(C.teinte.aura);
        else UH.uCoul.value.fromArray(ctx.sang ? COUL_SANG : ctx.rage > 0.5 ? COUL_RAGE : COUL_CALME);
        grp.visible = UH.uInt.value > 0.002;
        pts.matrix.copy(C.objet.matrixWorld).invert(); pts.matrixWorldNeedsUpdate = true;
        fum.matrix.copy(pts.matrix); fum.matrixWorldNeedsUpdate = true;
        const dt = ctx.dt;
        // braises montantes ; étincelles instables quand il est affaibli
        accB += dt * (6 + 18 * intens);
        while (accB >= 1 && intens > 0.02) {
          accB -= 1;
          const b = braises[iB]; iB = (iB + 1) % NB;
          spawnCorps(b.p, 0.25, 1.7, 0.42);
          b.v.set((R() - 0.5) * 0.25, 0.3 + 0.5 * R(), (R() - 0.5) * 0.25); b.vie = 1; b.t = 0.012 + 0.018 * R();
        }
        if (ctx.faib > 0.4) {
          accE += dt * ctx.faib * 3;
          if (accE >= 1 && R() < 0.5) {
            accE = 0;
            spawnCorps(tv, 0.6, 1.5, 0.3);
            for (let k = 0; k < 6; k++) { const b = braises[iB]; iB = (iB + 1) % NB; b.p.copy(tv); b.v.set((R() - 0.5) * 2.5, R() * 2, (R() - 0.5) * 2.5); b.vie = 0.6; b.t = 0.01; }
          }
        }
        const P = geoB.attributes.position.array, V = geoB.attributes.aVie.array, Tl = geoB.attributes.aTaille.array;
        for (let i = 0; i < NB; i++) {
          const b = braises[i];
          if (b.vie > 0) {
            b.vie -= dt * 0.7; b.v.y -= (b.t < 0.011 ? 4 : -0.1) * dt;
            b.v.x += bruit1(ctx.temps * 2 + i, 931) * dt * 0.6; b.v.z += bruit1(ctx.temps * 2 + i + 50, 933) * dt * 0.6;
            b.p.addScaledVector(b.v, dt);
          }
          P[i * 3] = b.p.x; P[i * 3 + 1] = b.p.y; P[i * 3 + 2] = b.p.z;
          V[i] = b.vie > 0 ? Math.min(1, b.vie * 2) * Math.min(1, (1 - b.vie) * 8) * (0.4 + 0.6 * clamp(intens, 0, 1.5)) : 0;
          Tl[i] = b.t;
        }
        geoB.attributes.position.needsUpdate = true; geoB.attributes.aVie.needsUpdate = true; geoB.attributes.aTaille.needsUpdate = true;
        // fumée sombre qui s'échappe du bas du manteau en lévitation
        accF += dt * 3 * ctx.lev * (0.5 + 0.5 * Math.min(1, au));
        while (accF >= 1) {
          accF -= 1;
          const f = fumees[iF]; iF = (iF + 1) % NF;
          spawnCorps(f.p, 0.15, 0.55, 0.3);
          f.v.set((R() - 0.5) * 0.15, 0.06 + 0.12 * R(), (R() - 0.5) * 0.15); f.vie = 1; f.r = 0.18 + 0.15 * R(); f.a = R() * TAU;
        }
        const PF = geoF.attributes.position.array, AF = geoF.attributes.aAlpha.array;
        for (let k = 0; k < NF; k++) {
          const f = fumees[k];
          if (f.vie > 0) { f.vie -= dt / 2.6; f.p.addScaledVector(f.v, dt); f.r += dt * 0.08; }
          const r = f.r, o = k * 12, cx = Math.cos(f.a) * r, cz = Math.sin(f.a) * r;
          PF[o] = f.p.x - cx; PF[o + 1] = f.p.y - r; PF[o + 2] = f.p.z - cz;
          PF[o + 3] = f.p.x + cx; PF[o + 4] = f.p.y - r; PF[o + 5] = f.p.z + cz;
          PF[o + 6] = f.p.x + cx; PF[o + 7] = f.p.y + r; PF[o + 8] = f.p.z + cz;
          PF[o + 9] = f.p.x - cx; PF[o + 10] = f.p.y + r; PF[o + 11] = f.p.z - cz;
          const a = f.vie > 0 ? Math.sin(Math.PI * f.vie) * 0.35 * (1 - ctx.dissol) : 0;
          AF[k * 4] = AF[k * 4 + 1] = AF[k * 4 + 2] = AF[k * 4 + 3] = a;
        }
        geoF.attributes.position.needsUpdate = true; geoF.attributes.aAlpha.needsUpdate = true;
      },
      reinitialiser() { for (const b of braises) b.vie = 0; for (const f of fumees) f.vie = 0; },
      dispose() { gH.dispose(); matH.dispose(); geoB.dispose(); matB.dispose(); geoF.dispose(); matF.dispose(); }
    };
  }
