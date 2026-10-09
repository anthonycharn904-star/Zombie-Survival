'use strict';
/* =========================================================================
   Mod Tools — vue 3D
   Le rendu est celui du moteur du jeu (même scène, mêmes matériaux) avec une
   caméra libre. Le monde est reconstruit après chaque modification (quelques
   dizaines de millisecondes) ; déplacer un objet ou régler une lumière ne
   reconstruit rien.
   Souris : clic droit maintenu = regarder (+ ZQSD/WASD, A/E pour descendre/
   monter, Maj = vite), clic milieu = glisser la vue, molette = avancer vers
   le curseur, Alt+clic gauche = tourner autour du point visé.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp } = MT.util;
  const S = MT.state;
  const V = (MT.v3 = {
    cam: null, yaw: 0, pitch: -0.7, keys: Object.create(null), drag: null, canvas: null,
    helpers: null, sel: null, cells: null, ghost: null, ghostKey: '',
    visible: true, active: false, hovering: false,
    editLight: true, fog: false, power: false, animate: false, labels: true, speed: 9,
    worldDirty: true, propsDirty: false, helpersDirty: true, rebuildAt: 0, lastMove: null, lastBuildMs: 0,
    lightBase: [], t: 0,
  });
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* ------------------------------------------------- ressources aides -- */
  let BULB_TEX = null;
  function bulbTexture() {
    if (BULB_TEX) return BULB_TEX;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,10,10,0.75)'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffe28a'; g.lineWidth = 4; g.beginPath(); g.arc(32, 28, 13, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.beginPath(); g.moveTo(24, 40); g.lineTo(40, 40); g.moveTo(25, 46); g.lineTo(39, 46); g.stroke();
    BULB_TEX = new THREE.CanvasTexture(c);
    BULB_TEX.encoding = THREE.sRGBEncoding;
    return BULB_TEX;
  }
  function textSprite(text, color = '#f0e6cc') {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '400 40px "Special Elite", "Courier New", monospace';
    const w = Math.ceil(g.measureText(text).width) + 28;
    c.width = w; c.height = 60;
    g.fillStyle = 'rgba(7,9,10,0.72)'; g.fillRect(0, 0, w, 60);
    g.font = '400 40px "Special Elite", "Courier New", monospace';
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 14, 32);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
    sp.scale.set((w / 60) * 0.5, 0.5, 1);
    sp.renderOrder = 10;
    sp.userData.noPick = true;
    return sp;
  }
  function disposeTree(o) {
    o.traverse((c) => {
      if (c.userData && c.userData.keep) return;
      if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose();
      const mats = c.userData.keepMat ? [] : Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      for (const m of mats) { if (m.map && m.map !== BULB_TEX) m.map.dispose(); m.dispose(); }
    });
  }
  const GEO = {};
  function geo() {
    if (!GEO.disc) {
      GEO.disc = new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2);
      GEO.cone = new THREE.ConeGeometry(0.14, 0.32, 10);
      GEO.arrow = new THREE.ConeGeometry(0.22, 0.6, 12).rotateX(-Math.PI / 2);
      GEO.ring = new THREE.RingGeometry(0.34, 0.46, 24).rotateX(-Math.PI / 2);
    }
    return GEO;
  }

  /* --------------------------------------------------------- caméra --- */
  function applyCamera() {
    V.cam.rotation.set(V.pitch, V.yaw, 0, 'YXZ');
    V.cam.updateMatrixWorld();
  }
  function forward(out) { return out.set(-Math.sin(V.yaw) * Math.cos(V.pitch), Math.sin(V.pitch), -Math.cos(V.yaw) * Math.cos(V.pitch)); }
  V.lookAtPoint = (x, y, z) => {
    const p = V.cam.position, dx = x - p.x, dy = y - p.y, dz = z - p.z;
    V.yaw = Math.atan2(-dx, -dz);
    V.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    applyCamera();
    MT.emit('camera3d');
  };
  const OWV = () => (S.map && S.map.open && MT.ow && MT.ow.v3 ? MT.ow.v3 : null);
  V.overview = () => {
    const m = S.map;
    if (!m) return;
    if (OWV()) { OWV().overview(); return; }
    const span = Math.max(m.w, m.h), E = MT.levelY();
    V.cam.position.set(m.w / 2, E + Math.max(10, span * 0.62), m.h + span * 0.18);
    V.lookAtPoint(m.w / 2, E, m.h * 0.48);
  };
  V.topView = () => {
    const m = S.map;
    if (!m) return;
    if (OWV()) { OWV().topView(); return; }
    const span = Math.max(m.w, m.h * V.cam.aspect);
    V.cam.position.set(m.w / 2, MT.levelY() + Math.max(12, span * 0.95), m.h / 2 + 0.01);
    V.yaw = 0; V.pitch = -Math.PI / 2 + 0.001;
    applyCamera();
    MT.emit('camera3d');
  };
  V.focusOn = (x, y, z, dist = 7) => {
    const f = forward(tmpV);
    if (f.y > -0.35) { V.pitch = -0.6; forward(f); }
    V.cam.position.set(x - f.x * dist, y - f.y * dist, z - f.z * dist);
    applyCamera();
    MT.emit('camera3d');
  };
  V.walkView = () => {
    if (OWV()) { OWV().walkView(); return; }
    const sp = S.map.spawn;
    if (MT.lvOf(sp) !== S.level && MT.hasLevel(MT.lvOf(sp))) MT.setLevel(MT.lvOf(sp));
    V.cam.position.set(sp.pos[0], MT.levelY(MT.lvOf(sp)) + 1.65, sp.pos[1]);
    V.yaw = sp.yaw; V.pitch = -0.05;
    applyCamera();
    MT.emit('camera3d');
  };

  /* ------------------------------------------------------- détection --- */
  function setRay(e) {
    const r = V.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, V.cam);
  }
  function ignored(o) {
    let cur = o, prop = false;
    while (cur) {
      if (!cur.visible) return true;
      if (cur.userData && cur.userData.noPick) return true;
      if (cur.userData && (typeof cur.userData.prop === 'number' || cur.userData.mt)) prop = true;
      cur = cur.parent;
    }
    if (o.isSprite) return !(o.userData && o.userData.mt);
    if (o.isLine || o.isPoints) return true;
    if (o.isInstancedMesh && o.count === 0) return true;
    const m = o.material;
    if (!prop && m && m.transparent && m.depthWrite === false) return true;
    return false;
  }
  function raycast(e) {
    if (OWV()) {
      const p = OWV().pick(e);
      return p ? { point: new THREE.Vector3(p.wx, p.wy, p.wz), distance: p.dist } : null;
    }
    setRay(e);
    const targets = [V.helpers];
    if (ZS.World.root) targets.push(ZS.World.root);
    const hits = ray.intersectObjects(targets, true);
    for (const h of hits) if (!ignored(h.object)) return h;
    return null;
  }
  function planePick(e, y) {
    setRay(e);
    const d = ray.ray.direction, o = ray.ray.origin;
    if (Math.abs(d.y) < 1e-5) return null;
    const t = (y - o.y) / d.y;
    if (t < 0 || t > 2000) return null;
    const wx = o.x + d.x * t, wz = o.z + d.z * t;
    return { x: Math.floor(wx), z: Math.floor(wz), wx, wy: y, wz, face: null, ny: 1, view: '3d' };
  }
  /* Point visé (voir tools.js pour le format). */
  V.pick = (e) => {
    if (OWV()) return OWV().pick(e);
    const h = raycast(e);
    if (!h) return planePick(e, MT.levelY());
    const p = h.point;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
    let prop = null, light = null, mt = null, top = false;
    for (let o = h.object; o; o = o.parent) {
      const u = o.userData || {};
      if (typeof u.prop === 'number') { prop = u.prop; break; }
      if (typeof u.light === 'number') { light = u.light; break; }
      if (u.mt) { mt = u.mt; break; }
      if (u.wallTops) { top = true; break; }
    }
    if (h.object.isSprite) n.set(0, 1, 0);
    const horiz = Math.abs(n.y) < 0.5;
    const cx = Math.floor(p.x - n.x * 0.02), cz = Math.floor(p.z - n.z * 0.02);
    return {
      x: cx, z: cz, wx: p.x, wy: p.y, wz: p.z, view: '3d', ny: top ? 0 : n.y,
      face: horiz ? [Math.round(n.x), Math.round(n.z)] : null, prop, light, mt, dist: h.distance,
    };
  };

  /* ------------------------------------------------------------ souris -- */
  const evInfo = (e) => ({ button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, view: '3d' });
  function onDown(e) {
    if (!V.active || !S.map) return;
    V.canvas.focus({ preventScroll: true });
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
      const mode = e.button === 2 ? 'look' : e.button === 1 ? 'pan' : 'orbit';
      let pivot = null;
      if (mode === 'orbit') { const h = raycast(e); pivot = h ? h.point.clone() : V.cam.position.clone().add(forward(tmpV).multiplyScalar(10)); }
      V.drag = { mode, x: e.clientX, y: e.clientY, moved: false, pivot };
      V.canvas.setPointerCapture(e.pointerId);
      V.canvas.classList.add(mode === 'look' ? 'looking' : 'panning');
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const p = V.pick(e);
    if (MT.tools.down(p, evInfo(e))) {
      V.drag = { mode: 'tool' };
      const d = MT.tools.drag;
      if (d && d.planeY !== undefined && d.start) { const pp = planePick(e, d.planeY); if (pp) d.start = [pp.wx, pp.wz]; }
      V.canvas.setPointerCapture(e.pointerId);
    }
  }
  function onMove(e) {
    if (!V.active) return;
    const d = V.drag;
    if (d && d.mode !== 'tool') {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) + Math.abs(dy) > 0) d.moved = true;
      if (d.mode === 'look') {
        V.yaw -= dx * 0.0042; V.pitch = clamp(V.pitch - dy * 0.0042, -1.55, 1.55);
      } else if (d.mode === 'pan') {
        const k = 0.0016 * Math.max(4, V.cam.position.y + 6) * (V.keys.ShiftLeft ? 2.5 : 1);
        const right = tmpV.set(Math.cos(V.yaw), 0, -Math.sin(V.yaw));
        const up = tmpV2.set(0, 1, 0).applyEuler(V.cam.rotation);
        V.cam.position.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      } else if (d.mode === 'orbit') {
        const off = V.cam.position.clone().sub(d.pivot);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta -= dx * 0.006;
        sph.phi = clamp(sph.phi - dy * 0.006, 0.05, Math.PI - 0.05);
        off.setFromSpherical(sph);
        V.cam.position.copy(d.pivot).add(off);
        V.lookAtPoint(d.pivot.x, d.pivot.y, d.pivot.z);
      }
      applyCamera();
      MT.emit('camera3d');
      return;
    }
    V.lastMove = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, button: e.button };
  }
  function onUp(e) {
    const d = V.drag;
    V.drag = null;
    V.canvas.classList.remove('looking', 'panning');
    try { V.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* rien */ }
    if (!d) return;
    if (d.mode === 'tool') {
      const pd = MT.tools.drag;
      const p = pd && pd.planeY !== undefined ? planePick(e, pd.planeY) : V.pick(e);
      MT.tools.up(p, evInfo(e));
    }
  }
  function onWheel(e) {
    if (!V.active) return;
    e.preventDefault();
    const h = raycast(e);
    const dist = h ? h.distance : 12;
    const step = clamp(dist * 0.16, 0.25, OWV() ? 400 : 30) * Math.sign(-e.deltaY) * (V.keys.ShiftLeft ? 2.5 : 1);
    if (step > 0 && h && dist - step < 0.4) return;
    setRay(e);
    V.cam.position.addScaledVector(ray.ray.direction, step);
    applyCamera();
    MT.emit('camera3d');
  }
  /* Survol traité une fois par image (un lancer de rayon). */
  function processHover() {
    const e = V.lastMove;
    if (!e) return;
    V.lastMove = null;
    const ev = { button: 0, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, view: '3d' };
    const d = MT.tools.drag;
    let p;
    if (V.drag && V.drag.mode === 'tool' && d && d.planeY !== undefined) p = planePick(e, d.planeY);
    else p = V.pick(e);
    MT.tools.move(p, ev);
    MT.emit('cursor', p);
  }

  /* --------------------------------------------------------- clavier --- */
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  /* Renvoie true si la touche sert à se déplacer en 3D (survol de la vue ou clic droit maintenu). */
  V.key = (e, down) => {
    if (!MOVE_KEYS.has(e.code)) return false;
    if (!down) { V.keys[e.code] = false; return false; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const looking = V.drag && V.drag.mode === 'look';
    if (!looking && !V.hovering) return false;
    if (!looking && (e.code === 'Space' || e.code.startsWith('Arrow'))) return false;
    V.keys[e.code] = true;
    return !e.code.startsWith('Shift');
  };
  function moveCamera(dt) {
    const k = V.keys;
    if (!V.drag || V.drag.mode !== 'look') {
      if (!V.hovering) return;
    }
    let fx = 0, fz = 0, fy = 0;
    if (k.KeyW || k.ArrowUp) fz += 1;
    if (k.KeyS || k.ArrowDown) fz -= 1;
    if (k.KeyD || k.ArrowRight) fx += 1;
    if (k.KeyA || k.ArrowLeft) fx -= 1;
    if (k.KeyE || k.Space) fy += 1;
    if (k.KeyQ) fy -= 1;
    if (!fx && !fy && !fz) return;
    const sp = (OWV() ? OWV().speed : V.speed) * (k.ShiftLeft || k.ShiftRight ? 3 : 1) * dt;
    const f = forward(tmpV), right = tmpV2.set(Math.cos(V.yaw), 0, -Math.sin(V.yaw));
    V.cam.position.addScaledVector(f, fz * sp).addScaledVector(right, fx * sp);
    V.cam.position.y += fy * sp;
    applyCamera();
    MT.emit('camera3d');
  }
  window.addEventListener('blur', () => { for (const c in V.keys) V.keys[c] = false; });

  /* ------------------------------------------- monde et mises à jour --- */
  function schedule(ms) {
    const t = performance.now() + ms;
    V.rebuildAt = V.rebuildAt ? Math.min(V.rebuildAt, t) : t;
  }
  function onChange(kind, detail) {
    if (!S.map) return;
    if (OWV()) { OWV().onChange(kind, detail); return; }
    if (kind === 'prop-move') { applyPropTransforms(detail && detail.list); V.selDirty = true; return; }
    if (kind === 'light-live') { applyLightLive(detail); V.selDirty = true; V.helpersDirty = true; return; }
    if (kind === 'ambiance') { ZS.applyAmbiance(S.map.ambiance); applyOverrides(); return; }
    if (kind === 'props') { V.propsDirty = true; V.selDirty = true; schedule(20); return; }
    V.worldDirty = true;
    V.helpersDirty = true;
    V.selDirty = true;
    schedule(detail && detail.live ? 260 : detail && (detail.history || detail.load) ? 0 : 40);
  }
  function rebuild() {
    if (!S.map) return;
    if (OWV()) { OWV().rebuild(); return; }
    if (V.owLoaded) { V.owLoaded = false; V.cam.near = 0.05; V.cam.far = 700; V.cam.updateProjectionMatrix(); }
    const t0 = performance.now();
    if (V.worldDirty) {
      ZS.buildWorld(S.map, { editor: true });
      V.worldDirty = false;
      V.propsDirty = false;
      V.lightBase = S.map.lights.map((l) => l.pos.slice());
      if (V.power) ZS.powerOnQuiet();
      applyOverrides();
      applyCutaway();
    } else if (V.propsDirty) {
      ZS.rebuildProps();
      V.propsDirty = false;
      applyCutaway();
    }
    V.helpersDirty = true;
    V.selDirty = true;
    V.lastBuildMs = performance.now() - t0;
  }
  V.forceRebuild = () => { V.worldDirty = true; rebuild(); };
  /* Coupe : les niveaux au-dessus du niveau affiché sont cachés (on le voit d'en haut). */
  function applyCutaway() {
    const root = ZS.World.root;
    if (!root || !S.map || S.map.open) return;
    const cut = S.level;
    root.traverse((o) => { if (o.userData && o.userData.lv !== undefined) o.visible = o.userData.lv <= cut; });
  }
  V.applyCutaway = applyCutaway;
  function propGroup(i) {
    const P = ZS.World.props;
    if (!P) return null;
    const c = P.children[i];
    if (c && c.userData.prop === i) return c;
    return P.children.find((g) => g.userData.prop === i) || null;
  }
  function applyPropTransforms(list) {
    const m = S.map;
    for (const i of list || []) {
      const g = propGroup(i), pr = m.props[i];
      if (!g || !pr) continue;
      g.position.set(pr.x, MT.levelY(MT.lvOf(pr)) + (pr.y || 0), pr.z);
      g.rotation.set(0, pr.r || 0, 0);
      g.scale.setScalar(pr.s || 1);
    }
  }
  function applyLightLive(detail) {
    const i = detail ? detail.i : -1, l = S.map.lights[i], wl = ZS.World.lights[i], base = V.lightBase[i];
    if (!l || !wl || !base) { V.worldDirty = true; schedule(60); return; }
    const dx = l.pos[0] - base[0], dy = l.pos[1] - base[1], dz = l.pos[2] - base[2];
    const yOff = l.fixture === 'neon' ? -0.15 : l.fixture === 'wall' ? 0 : -0.25;
    wl.light.position.set(l.pos[0], MT.levelY(MT.lvOf(l)) + l.pos[1] + yOff, l.pos[2]);
    wl.fixture.position.set(dx, dy, dz);
    if (!wl.haloBase) wl.haloBase = wl.halo.position.clone();
    wl.halo.position.set(wl.haloBase.x + dx, wl.haloBase.y + dy, wl.haloBase.z + dz);
    const powered = V.power && l.powered !== undefined && l.powered !== null;
    const col = powered ? l.powered : l.color;
    // comme le moteur : lumière et halo en couleur brute, ampoule en linéaire
    wl.light.color.setHex(col);
    wl.halo.material.color.setHex(col);
    wl.bulbMat.color.setHex(col).convertSRGBToLinear();
    wl.color = col;
    wl.base = l.intensity;
    wl.light.intensity = l.intensity;
    wl.light.distance = powered ? (l.poweredRange || l.range) : l.range;
    wl.flicker = l.flicker;
  }
  /* Réglages d'affichage propres à l'éditeur (brouillard, lumière d'appoint). */
  function applyOverrides() {
    const m = S.map;
    if (!m || m.open) return;
    // sans le brouillard de la carte : un voile léger garde la profondeur au loin
    ZS.scene.fog.density = V.fog ? m.ambiance.fogDensity : Math.min(0.012, m.ambiance.fogDensity);
    if (ZS.HEMI) ZS.HEMI.intensity = V.editLight ? Math.max(m.ambiance.hemi, 1.05) : m.ambiance.hemi;
  }
  V.setOption = (k, v) => {
    V[k] = v;
    if (k === 'power') {
      if (v) ZS.powerOnQuiet();
      else if (OWV()) { V.owElDirty = true; schedule(0); }
      else { ZS.resetLights(); for (const pm of ZS.Features.perkMachines) ZS.lightMachine(pm, !ZS.PERKS[pm.id].power); V.worldDirty = true; schedule(0); }
    }
    if (k === 'labels') V.helpersDirty = true;
    applyOverrides();
    MT.emit('view-options');
  };

  /* ------------------------------------------------------------- aides --- */
  function rebuildHelpers() {
    V.helpersDirty = false;
    const m = S.map;
    for (const c of [...V.helpers.children]) {
      if (c === V.sel || c === V.cells || c === V.ghost) continue;
      V.helpers.remove(c);
      disposeTree(c);
    }
    if (!m) return;
    if (OWV()) { V.helpers.add(OWV().helpers()); return; }
    const G0 = geo();
    const group = new THREE.Group();
    group.name = 'marqueurs';
    // lumières : une icône (utile pour celles sans luminaire)
    const bulbMat = new THREE.SpriteMaterial({ map: bulbTexture(), transparent: true, depthWrite: false, fog: false });
    const E = MT.levelY();
    m.lights.forEach((l, i) => {
      if (!MT.here(l)) return;
      const sp = new THREE.Sprite(i === 0 ? bulbMat : bulbMat.clone());
      sp.position.set(l.pos[0], E + l.pos[1] + (l.fixture === 'wall' ? 0.28 : 0.24), l.pos[2]);
      sp.scale.set(0.32, 0.32, 1);
      sp.userData.mt = { kind: 'light', i };
      group.add(sp);
    });
    // apparitions au sol
    const riserMat = new THREE.MeshBasicMaterial({ color: 0x3fa83a, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
    const riserArrow = new THREE.MeshBasicMaterial({ color: 0x8dff74, fog: false });
    m.risers.forEach((r, i) => {
      if (!MT.here(r)) return;
      const d = new THREE.Mesh(G0.disc, riserMat);
      d.position.set(r[0] + 0.5, E + 0.025, r[1] + 0.5);
      d.userData.mt = { kind: 'riser', i };
      d.userData.sharedGeo = true;
      const a = new THREE.Mesh(G0.cone, riserArrow);
      a.position.set(r[0] + 0.5, E + 0.2, r[1] + 0.5);
      a.userData.mt = { kind: 'riser', i };
      a.userData.sharedGeo = true;
      group.add(d, a);
    });
    // départ du joueur
    const sp = m.spawn;
    if (MT.here(sp)) {
      const ring = new THREE.Mesh(G0.ring, new THREE.MeshBasicMaterial({ color: 0x2fa84a, fog: false, side: THREE.DoubleSide }));
      ring.position.set(sp.pos[0], E + 0.03, sp.pos[1]);
      ring.userData.mt = { kind: 'spawn' }; ring.userData.sharedGeo = true;
      const arr = new THREE.Mesh(G0.arrow, new THREE.MeshBasicMaterial({ color: 0x8dff74, fog: false }));
      arr.position.set(sp.pos[0] - Math.sin(sp.yaw) * 0.55, E + 0.3, sp.pos[1] - Math.cos(sp.yaw) * 0.55);
      arr.rotation.y = sp.yaw;
      arr.userData.mt = { kind: 'spawn' }; arr.userData.sharedGeo = true;
      group.add(ring, arr);
    }
    // noms des pièces
    if (V.labels) {
      const A = MT.analysis();
      const acc = A.zones.map(() => [0, 0, 0]);
      for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) { const zi = MT.zoneIndexAt(x, z); if (zi >= 0) { acc[zi][0] += x + 0.5; acc[zi][1] += z + 0.5; acc[zi][2]++; } }
      A.zones.forEach((zone, i) => {
        if (zone.auto || acc[i][2] < 2) return;
        const t = textSprite(zone.name);
        t.position.set(acc[i][0] / acc[i][2], E + MT.wallHeight() + 0.6, acc[i][1] / acc[i][2]);
        group.add(t);
      });
    }
    V.helpers.add(group);
  }
  function selectionBoxes() {
    const s = S.sel, m = S.map, out = [];
    if (!s || !m) return out;
    if (OWV()) return OWV().selectionBoxes();
    const H = MT.wallHeight();
    let E = MT.levelY();
    const el = { light: m.lights, perk: m.perks, riser: m.risers, box: m.boxes, wallbuy: m.wallbuys, sign: m.signs, door: m.doors, stair: m.stairs || [] }[s.kind];
    if (el && el[s.i]) E = MT.levelY(MT.lvOf(el[s.i]));
    else if (s.kind === 'amp' && m.amp) E = MT.levelY(MT.lvOf(m.amp));
    else if (s.kind === 'power' && m.power) E = MT.levelY(MT.lvOf(m.power));
    else if (s.kind === 'spawn') E = MT.levelY(MT.lvOf(m.spawn));
    const cellBox = (x, z, y0, y1, pad = 0.04) => out.push(new THREE.Box3(new THREE.Vector3(x - pad, E + y0, z - pad), new THREE.Vector3(x + 1 + pad, E + y1, z + 1 + pad)));
    const faceBox = (cell, n, y0, y1) => {
      const cx = cell[0] + 0.5 + n[0] * 0.5, cz = cell[1] + 0.5 + n[1] * 0.5;
      const hx = n[0] ? 0.06 : 0.5, hz = n[0] ? 0.5 : 0.06;
      out.push(new THREE.Box3(new THREE.Vector3(cx - hx, E + y0, cz - hz), new THREE.Vector3(cx + hx, E + y1, cz + hz)));
    };
    switch (s.kind) {
      case 'prop':
        for (const i of s.list) { const g = propGroup(i); if (g) { const b = new THREE.Box3().setFromObject(g); if (!b.isEmpty()) out.push(b.expandByScalar(0.02)); } }
        break;
      case 'light': { const l = m.lights[s.i]; if (l) out.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(l.pos[0], E + l.pos[1], l.pos[2]), new THREE.Vector3(0.5, 0.5, 0.5))); break; }
      case 'stair': { const st = (m.stairs || [])[s.i]; if (st) for (const [x, z] of ZS.stairPlan(st).footprint) cellBox(x, z, 0, H + (ZS.SLAB || 0.3), 0.02); break; }
      case 'perk': { const p = m.perks[s.i]; if (p) cellBox(p.cell[0], p.cell[1], 0, 2.3); break; }
      case 'riser': { const r = m.risers[s.i]; if (r) cellBox(r[0], r[1], 0, 0.5); break; }
      case 'box': case 'amp': { const b = s.kind === 'box' ? m.boxes[s.i] : m.amp; if (b) for (const c of b.cells) cellBox(c[0], c[1], 0, s.kind === 'box' ? 1.1 : 1.6); break; }
      case 'wallbuy': { const w = m.wallbuys[s.i]; if (w) faceBox(w.cell, w.n, 1.1, 2.2); break; }
      case 'power': if (m.power) faceBox(m.power.cell, m.power.n, 0.6, 2.2); break;
      case 'sign': { const g = m.signs[s.i]; if (g) out.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(g.pos[0], E + g.pos[1], g.pos[2]), new THREE.Vector3(g.n[0] ? 0.1 : 1.8, 0.5, g.n[0] ? 1.8 : 0.1))); break; }
      case 'door': { const d = m.doors[s.i]; if (d) for (const [x, z] of d.cells) cellBox(x, z, 0, 2.65, 0.02); break; }
      case 'spawn': out.push(new THREE.Box3(new THREE.Vector3(m.spawn.pos[0] - 0.35, E, m.spawn.pos[1] - 0.35), new THREE.Vector3(m.spawn.pos[0] + 0.35, E + 1.8, m.spawn.pos[1] + 0.35))); break;
      case 'cell': cellBox(s.x, s.z, 0, H, 0.01); break;
      default: break;
    }
    return out;
  }
  function rebuildSelection() {
    V.selDirty = false;
    if (V.sel) { V.helpers.remove(V.sel); disposeTree(V.sel); V.sel = null; }
    const boxes = selectionBoxes();
    if (!boxes.length) return;
    const g = new THREE.Group();
    g.userData.noPick = true;
    for (const b of boxes) {
      const h = new THREE.Box3Helper(b, 0xffd27a);
      h.material.depthTest = false; h.material.transparent = true; h.material.fog = false;
      h.renderOrder = 20;
      g.add(h);
    }
    V.sel = g;
    V.helpers.add(g);
  }
  function rebuildCells() {
    if (V.cells) { V.helpers.remove(V.cells); disposeTree(V.cells); V.cells = null; }
    if (OWV()) { const g = OWV().elementGhost(); if (g) { V.cells = g; V.helpers.add(g); } return; }
    const pv = MT.preview;
    if (!pv.cells || !pv.cells.length || pv.cells.length > 3000 || !S.map) return;
    const pos = [];
    const y = MT.levelY() + 0.035;
    for (const [x, z] of pv.cells) {
      if (!MT.inb(x, z)) continue;
      const a = 0.04, b = 0.96;
      pos.push(x + a, y, z + a, x + b, y, z + a, x + b, y, z + a, x + b, y, z + b, x + b, y, z + b, x + a, y, z + b, x + a, y, z + b, x + a, y, z + a);
    }
    if (!pos.length) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const col = pv.tone === 'erase' ? 0xff6060 : pv.tone === 'element' ? 0x7cc8ff : 0xffd27a;
    const lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.9, fog: false }));
    lines.renderOrder = 19;
    lines.userData.noPick = true;
    V.cells = lines;
    V.helpers.add(lines);
  }
  function updateGhost() {
    const gh = S.tool === 'props' ? MT.preview.ghost : null;
    const key = gh ? `${gh.m}` : '';
    if (key !== V.ghostKey) {
      if (V.ghost) { V.helpers.remove(V.ghost); V.ghost.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); V.ghost = null; }
      V.ghostKey = key;
      if (gh) {
        V.ghost = ZS.makePropObject({ m: gh.m });
        V.ghost.userData.noPick = true;
        V.helpers.add(V.ghost);
      }
    }
    if (V.ghost && gh) {
      V.ghost.position.set(gh.x, OWV() ? OWV().propGhostY(gh) : MT.levelY() + (gh.y || 0), gh.z);
      V.ghost.rotation.set(0, gh.r || 0, 0);
      V.ghost.scale.setScalar(gh.s || 1);
    }
  }

  /* --------------------------------------------------------- démarrage --- */
  V.init = () => {
    V.cam = new THREE.PerspectiveCamera(62, 1, 0.05, 700);
    V.cam.rotation.order = 'YXZ';
    V.helpers = new THREE.Group();
    V.helpers.name = 'mod-tools';
    ZS.scene.add(V.helpers);
    V.canvas = ZS.renderer.domElement;
    V.canvas.tabIndex = 0;
    V.canvas.addEventListener('pointerdown', onDown);
    V.canvas.addEventListener('pointermove', onMove);
    V.canvas.addEventListener('pointerup', onUp);
    V.canvas.addEventListener('pointercancel', onUp);
    V.canvas.addEventListener('wheel', onWheel, { passive: false });
    V.canvas.addEventListener('contextmenu', (e) => { if (V.active) e.preventDefault(); });
    V.canvas.addEventListener('pointerenter', () => { V.hovering = true; });
    V.canvas.addEventListener('pointerleave', () => {
      V.hovering = false;
      if (!V.drag) { for (const c in V.keys) V.keys[c] = false; MT.tools.move(null, { view: '3d' }); MT.emit('cursor', null); }
    });
    V.canvas.addEventListener('dblclick', (e) => {
      if (!V.active || e.altKey) return;
      const h = raycast(e);
      if (h) V.focusOn(h.point.x, h.point.y, h.point.z, Math.min(8, h.distance));
    });
    MT.on('change', onChange);
    MT.on('map', () => { if (OWV()) { OWV().onMap(); return; } V.worldDirty = true; V.rebuildAt = 0; rebuild(); V.overview(); });
    MT.on('selection', () => { V.selDirty = true; });
    MT.on('preview', () => { V.cellsDirty = true; });
    MT.on('tool', () => { V.cellsDirty = true; });
    MT.on('focus', (f) => {
      if (!f || !Number.isFinite(f.x)) return;
      if (OWV()) OWV().focus(f.x, f.z, f.dist || 26, f.y !== undefined ? f.y : null);
      else V.focusOn(f.x + 0.5, f.y !== undefined ? f.y : MT.levelY() + 0.5, f.z + 0.5, 9);
    });
    MT.on('look-at', (f) => { if (OWV()) OWV().focus(f.x, f.z, 30); else V.focusOn(f.x, MT.levelY() + 0.4, f.z, 10); });
    // changement de niveau : la caméra monte ou descend d'autant, la coupe suit
    let lastLevel = 0;
    MT.on('level', (lv) => {
      const dy = MT.levelY(lv) - MT.levelY(lastLevel);
      lastLevel = lv;
      if (dy) { V.cam.position.y += dy; applyCamera(); MT.emit('camera3d'); }
      applyCutaway();
      V.helpersDirty = true; V.selDirty = true; V.cellsDirty = true;
    });
    MT.on('map', () => { lastLevel = 0; });
    MT.on('resized', (dx, dz) => { V.cam.position.x += dx; V.cam.position.z += dz; applyCamera(); });
    V.cam.position.set(0, 10, 10);
    applyCamera();
  };
  V.resize = (w, h) => {
    if (!V.cam) return;
    V.cam.aspect = Math.max(0.1, w / Math.max(1, h));
    V.cam.updateProjectionMatrix();
  };
  /* Appelé par le moteur à chaque image (état « editor »). */
  V.frame = (dt) => {
    if (!V.active) return;
    V.t += dt;
    if (V.rebuildAt && performance.now() >= V.rebuildAt) { V.rebuildAt = 0; rebuild(); }
    if (OWV() && ZS.ow.on) ZS.ow.frame(dt, V.cam);
    processHover();
    moveCamera(dt);
    if (V.helpersDirty) rebuildHelpers();
    if (V.selDirty) rebuildSelection();
    if (V.cellsDirty) { V.cellsDirty = false; rebuildCells(); }
    updateGhost();
    if (V.animate) ZS.updateLights(dt, V.t);
    applyOverrides();
  };
  /* Pour les cartes ouvertes (ow-view.js). */
  V.int = { setRay, ray, applyCamera, forward, textSprite, disposeTree, schedule };
  V.setActive = (on) => {
    V.active = on;
    V.helpers.visible = on;
    if (on) { ZS.setViewCamera(V.cam); if (V.worldDirty) rebuild(); }
  };
})();
