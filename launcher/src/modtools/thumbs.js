'use strict';
/* =========================================================================
   Mod Tools — vignettes des textures et des modèles (launcher 1.3.3)
   Les bibliothèques du jeu 2.0.4 comptent des milliers de textures et de
   modèles : une vignette est faite quand on la voit (les dernières demandées
   d'abord, une petite tranche de travail par image), puis gardée dans la base
   IndexedDB du poste (clé : version du jeu, genre, taille, identifiant) et,
   pour les plus récentes, en mémoire. Images et modèles importés : jamais
   gardés (ils changent sans changer d'identifiant).
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const TB = (MT.thumbs = { made: 0, hits: 0 });
  const key = (kind, id, px) => `${ZS.version}|${ZS.editorApi}|${kind}|${px}|${id}`;
  const volatile = (kind, id) => /^u_/.test(id) || (kind === 'tex' && ZS.TEXLIB[id] && ZS.TEXLIB[id].image) || (kind === 'model' && ZS.MODELS[id] && ZS.MODELS[id].glb);

  /* ---------------------------------------------------------- mémoire -- */
  const MEM = new Map(), MEM_MAX = 2500;
  const remember = (k, v) => { MEM.delete(k); MEM.set(k, v); if (MEM.size > MEM_MAX) MEM.delete(MEM.keys().next().value); };
  TB.peek = (kind, id, px) => MEM.get(key(kind, id, px));

  /* -------------------------------------------------------- IndexedDB -- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const rq = indexedDB.open('mt-vignettes', 1);
        rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains('v')) rq.result.createObjectStore('v'); };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => resolve(null);
        rq.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  async function idbGet(k) {
    const d = await db();
    if (!d) return null;
    return new Promise((res) => { try { const r = d.transaction('v').objectStore('v').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { res(null); } });
  }
  async function idbPut(k, v) {
    const d = await db();
    if (!d) return;
    try { d.transaction('v', 'readwrite').objectStore('v').put(v, k); } catch (e) { /* plein : tant pis */ }
  }
  /* Vide le cache (bouton du navigateur) : utile après une mise à jour qui change une texture sans changer de numéro. */
  TB.clear = async () => {
    MEM.clear();
    const d = await db();
    if (!d) return;
    await new Promise((res) => { try { const t = d.transaction('v', 'readwrite'); t.objectStore('v').clear(); t.oncomplete = res; t.onerror = res; } catch (e) { res(); } });
  };

  /* ------------------------------------------------------- fabrication -- */
  function texCanvas(id, px) {
    if (typeof ZS.textureThumbRaw === 'function') return ZS.textureThumbRaw(id, px);
    return ZS.textureThumb(id, px);
  }
  function makeTex(id, px) {
    const d = ZS.TEXLIB[id];
    if (!d) return Promise.resolve('');
    if (d.image) {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(img, 0, 0, px, px); res(c.toDataURL('image/jpeg', 0.86)); };
        img.onerror = () => res('');
        img.src = d.image;
      });
    }
    return Promise.resolve(texCanvas(id, px).toDataURL('image/jpeg', 0.86));
  }
  const R = { r: null, scene: null, cam: null, px: 0 };
  function renderer(px) {
    if (!R.r) {
      R.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      R.r.outputEncoding = THREE.sRGBEncoding;
      R.r.toneMapping = THREE.ACESFilmicToneMapping;
      R.r.toneMappingExposure = 1.25;
      R.scene = new THREE.Scene();
      R.scene.background = new THREE.Color(0x1d2122).convertSRGBToLinear();
      R.scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3226, 1.25));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
      sun.position.set(3, 6, 4);
      R.scene.add(sun);
      R.cam = new THREE.PerspectiveCamera(28, 1, 0.05, 400);
    }
    if (R.px !== px) { R.r.setSize(px, px); R.px = px; }
    return R.r;
  }
  function makeModel(id, px) {
    const def = ZS.MODELS[id];
    if (!def) return Promise.resolve('');
    const go = () => {
      const r = renderer(px), obj = ZS.makePropObject({ m: id });
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const dir = def.decal && !def.wall ? new THREE.Vector3(0.15, 1, 0.35) : def.wall ? new THREE.Vector3(0.6, 0.35, 1.5) : new THREE.Vector3(1.1, 0.75, 1.5);
      dir.normalize();
      const radius = Math.max(0.2, sz.length() / 2);
      const dist = (radius / Math.sin((R.cam.fov * Math.PI) / 360)) * 1.02;
      R.cam.position.copy(c).addScaledVector(dir, dist);
      R.cam.lookAt(c);
      R.cam.near = Math.max(0.01, dist - radius * 2); R.cam.far = dist + radius * 3;
      R.cam.updateProjectionMatrix();
      R.scene.add(obj);
      r.render(R.scene, R.cam);
      const url = r.domElement.toDataURL('image/jpeg', 0.84);
      R.scene.remove(obj);
      obj.traverse((o) => { if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose(); });
      return url;
    };
    if (def.glb) return ZS.glbReady(id).then(() => go());
    return Promise.resolve(go());              // tout de suite : la tranche de 12 ms compte ce travail
  }

  /* --------------------------------------------------------------- file -- */
  // les dernières demandes passent d'abord (ce qui vient d'apparaître à l'écran) ; une demande dont le
  // demandeur n'est plus visible (alive() faux) est sautée. Tranches de 12 ms entre deux images (pas
  // liées au rendu de la scène : la vue 3D peut être lente, les vignettes avancent quand même).
  const Q = [], WAIT = new Map();
  let timer = 0;
  const later = (fn) => setTimeout(fn, 0);
  function pump() {
    timer = 0;
    const t0 = performance.now();
    while (Q.length && performance.now() - t0 < 12) {
      const job = Q.pop();
      const waiters = WAIT.get(job.k) || [];
      if (!waiters.some((w) => !w.alive || w.alive())) { WAIT.delete(job.k); continue; }
      WAIT.delete(job.k);
      const done = (url) => {
        url = url || '';
        if (url) { remember(job.k, url); if (!volatile(job.kind, job.id)) idbPut(job.k, url); }
        TB.made++;
        for (const w of waiters) w.res(url);
      };
      let p;
      try { p = job.kind === 'tex' ? makeTex(job.id, job.px) : makeModel(job.id, job.px); } catch (e) { console.warn(`Vignette ${job.id}`, e); p = Promise.resolve(''); }
      p.then(done, (e) => { console.warn(`Vignette ${job.id}`, e); done(''); });
    }
    if (Q.length) timer = later(pump);
  }
  /* Vignette (data URL JPEG, '' si impossible) ; alive() : le demandeur en a-t-il encore besoin ? */
  TB.get = (kind, id, px = 128, alive = null) => {
    const k = key(kind, id, px);
    const m = MEM.get(k);
    if (m) { TB.hits++; return Promise.resolve(m); }
    return new Promise((res) => {
      const w = { res, alive };
      if (WAIT.has(k)) { WAIT.get(k).push(w); return; }
      WAIT.set(k, [w]);
      const enqueue = () => { Q.push({ k, kind, id, px }); if (!timer) timer = later(pump); };
      if (volatile(kind, id)) { enqueue(); return; }
      idbGet(k).then((url) => {
        if (url) {
          remember(k, url);
          TB.hits++;
          const ws = WAIT.get(k) || [];
          WAIT.delete(k);
          for (const x of ws) x.res(url);
        } else enqueue();
      });
    });
  };
  /* Vignettes en attente (essais). */
  TB.queue = () => Q.length;
  /* Oublie les vignettes d'une image ou d'un modèle importé (remplacé). */
  TB.forget = (id) => { for (const k of [...MEM.keys()]) if (k.endsWith(`|${id}`)) MEM.delete(k); };
  MT.on('library', () => { for (const k of [...MEM.keys()]) if (/\|u_[^|]*$/.test(k)) MEM.delete(k); });
})();
