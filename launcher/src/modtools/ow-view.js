'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes : vue 3D
   Le monde est celui du jeu (ZS.ow.load : relief, routes, lieux, sanctuaire,
   quête, puis les éléments de la carte, un groupe par objet posé). Une
   modification refait seulement les éléments (quelques dizaines de ms) ; un
   glisser déplace l'objet 3D sans rien refaire. La caméra libre va vite (le
   désert fait 4 × 3 km) ; le moteur suit sa position (détail du terrain, ciel).
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp, debounce, deep } = MT.util;
  const S = MT.state;
  const O = MT.ow;
  const W3 = (O.v3 = { speed: 36, loading: null });
  const UP = new THREE.Vector3(0, 1, 0);
  const V = () => MT.v3;

  /* ----------------------------------------------------- chargement -- */
  function overlay(on, text) {
    const pane = document.getElementById('mt-3d-pane');
    if (!pane) return;
    let el = document.getElementById('mt-ow-loading');
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = MT.util.h('div', { id: 'mt-ow-loading', class: 'mt-ow-loading', role: 'status' }); pane.append(el); }
    el.textContent = text;
  }
  /* Monde de la carte (la première fois : relief et lieux, quelques secondes), puis les éléments. */
  W3.rebuild = () => {
    const v = V(), t0 = performance.now();
    if (v.worldDirty || !v.owLoaded || !ZS.ow.on) {
      ZS.ow.load(S.map);
      W3.prevMods = modsOf(S.map);
      v.worldDirty = false; v.owLoaded = true; v.owElDirty = false; v.propsDirty = false;
      v.cam.near = 0.1; v.cam.far = ZS.ow.far || 4300; v.cam.updateProjectionMatrix();
      if (v.power) ZS.powerOnQuiet();
      overlay(false);
      MT.emit('ow-world');
      MT.validateNow();
    } else if (v.owElDirty || v.propsDirty) {
      ZS.ow.rebuild(S.map);
      v.owElDirty = false; v.propsDirty = false;
      if (v.power) ZS.powerOnQuiet();
      MT.emit('ow-elements');
    }
    v.helpersDirty = true; v.selDirty = true;
    v.lastBuildMs = performance.now() - t0;
  };
  /* Nouvelle carte ouverte : écran d'attente le temps du premier chargement, puis vue d'ensemble. */
  W3.onMap = () => {
    const v = V();
    v.worldDirty = true;
    const first = !ZS.ow.on;
    const moon = O.moon();
    overlay(true, first || W3.lastWorld !== O.world() ? (moon ? 'Chargement de la Lune : relief, fosse, lieux et ombres du Soleil rasant…' : 'Chargement du désert : relief, routes et lieux…') : 'Chargement de la carte…');
    W3.lastWorld = O.world();
    v.rebuildAt = 0;
    setTimeout(() => {
      try { W3.rebuild(); } catch (e) { console.error(e); overlay(false); MT.toast(`Monde illisible : ${e.message}`, 'error'); return; }
      W3.overview();
      MT.plan.need = true;
    }, 40);
  };
  const scheduleProps = debounce(() => { V().propsDirty = true; V().rebuildAt = performance.now(); }, 260);
  /* Modifications : objet qui suit (glisser), ou éléments refaits. */
  /* Ce que la carte change au terrain (pour « annuler » : refaire la zone des deux versions). */
  const modsOf = (m) => ({ terrain: m.terrain, ground: m.ground, roads: deep(m.roads || []), buildings: deep(m.buildings || []) });
  W3.onChange = (kind, detail) => {
    const v = V();
    if (kind === 'ow-terrain' && O.ok2()) {
      // terrain déjà refait (fin d'un coup de pinceau), ou à refaire dans la zone (route, bâtiment)
      if (!(detail && detail.done)) { try { ZS.ow.apply(S.map, detail && detail.rect ? detail.rect : ZS.ow.modsRect(S.map)); } catch (e) { console.error(e); } }
      W3.prevMods = modsOf(S.map);
      v.owElDirty = true; v.helpersDirty = true; v.selDirty = true;
      v.rebuildAt = performance.now() + 20;
      MT.plan.need = true;
      return;
    }
    if (detail && detail.history && O.ok2() && W3.prevMods) {
      // annuler, rétablir : grilles relues, terrain refait là où l'une ou l'autre version le change
      try { ZS.ow.reapply(S.map, W3.prevMods); } catch (e) { console.error(e); }
      W3.prevMods = modsOf(S.map);
    }
    if (kind === 'ow-live' && detail) {
      const e = O.get(detail);
      if (e) {
        if (detail.kind === 'spawn' || detail.kind === 'road' || detail.kind === 'loc') v.helpersDirty = true;
        else if (!ZS.ow.pose(detail.kind, detail.i, e)) v.helpersDirty = true;
      }
      v.selDirty = true;
      return;
    }
    if (kind === 'prop-move') {
      for (const i of (detail && detail.list) || []) { const pr = S.map.props[i]; if (pr) ZS.ow.poseProp(i, pr); }
      v.selDirty = true;
      if (!(detail && detail.live)) scheduleProps();
      return;
    }
    if (kind === 'settings') { v.helpersDirty = true; return; }
    if (detail && detail.load) return;           // la carte : W3.onMap
    v.owElDirty = true;
    v.helpersDirty = true; v.selDirty = true;
    const t = performance.now() + (detail && detail.live ? 200 : 25);
    v.rebuildAt = v.rebuildAt ? Math.min(v.rebuildAt, t) : t;
  };

  /* --------------------------------------------------------- caméra --- */
  const groundY = (x, z) => { try { return ZS.ow.on ? ZS.ow.ground(x, z) : 0; } catch (e) { return 0; } };
  W3.overview = () => {
    const v = V(), sp = S.map.spawn, yaw = sp.yaw;
    const x = sp.pos[0] + Math.sin(yaw) * 150, z = sp.pos[1] + Math.cos(yaw) * 150;
    v.cam.position.set(x, groundY(sp.pos[0], sp.pos[1]) + 95, z);
    v.lookAtPoint(sp.pos[0], groundY(sp.pos[0], sp.pos[1]), sp.pos[1]);
  };
  W3.topView = () => {
    const v = V(), c = v.cam.position;
    c.y = groundY(c.x, c.z) + 260;
    v.yaw = 0; v.pitch = -Math.PI / 2 + 0.001;
    v.int.applyCamera();
    MT.emit('camera3d');
  };
  W3.walkView = () => {
    const v = V(), sp = S.map.spawn;
    v.cam.position.set(sp.pos[0], groundY(sp.pos[0], sp.pos[1]) + 1.65, sp.pos[1]);
    v.yaw = sp.yaw; v.pitch = -0.05;
    v.int.applyCamera();
    MT.emit('camera3d');
  };
  /* Montrer un point (plan : double-clic, problème, sélection) : vue plongeante à dist mètres. */
  W3.focus = (x, z, dist = 26, y = null) => {
    V().focusOn(x, y === null ? groundY(x, z) + 1 : y, z, dist);
  };

  /* ------------------------------------------------------- détection --- */
  function skip(o) {
    for (let c = o; c; c = c.parent) {
      if (!c.visible) return true;
      if (c.userData && c.userData.noPick) return true;
    }
    if (o.isLine || o.isPoints) return true;
    if (o.isSprite) return !(o.userData && o.userData.mt);
    return false;
  }
  /* Point visé : le monde (terrain, bâtiments : le moteur), ou un élément, un objet, un marqueur. */
  W3.pick = (e) => {
    const v = V();
    v.int.setRay(e);
    const R = v.int.ray, o = R.ray.origin, d = R.ray.direction;
    let best = null;
    if (ZS.ow.on) {
      const w = ZS.ow.ray(o.x, o.y, o.z, d.x, d.y, d.z, 4500);
      if (w.hit) best = { t: w.t, x: w.x, y: w.y, z: w.z, n: [w.nx, w.ny, w.nz] };
    }
    // pendant un glisser, seul le monde compte (l'objet déplacé ne doit pas se viser lui-même)
    const d0 = MT.tools.drag, dragging = !!(d0 && /^ow-(el|props)$/.test(d0.mode));
    const targets = dragging ? [] : [v.helpers];
    if (ZS.ow.root && !dragging) targets.push(ZS.ow.root);
    const hits = targets.length ? R.intersectObjects(targets, true) : [];
    for (const h of hits) {
      if (best && h.distance > best.t + 0.25) break;
      if (skip(h.object)) continue;
      let el = null, prop = null, mt = null;
      for (let q = h.object; q; q = q.parent) {
        const u = q.userData || {};
        if (u.el) { el = u.el; break; }
        if (typeof u.prop === 'number') { prop = u.prop; break; }
        if (u.mt) { mt = u.mt; break; }
      }
      if (!el && prop === null && !mt) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
      best = { t: h.distance, x: h.point.x, y: h.point.y, z: h.point.z, n: [n.x, n.y, n.z], el, prop, mt };
      break;
    }
    if (!best) {
      // rien sous le curseur (ciel) : le plan horizontal à hauteur du sol sous la caméra
      const gy = groundY(o.x, o.z);
      if (Math.abs(d.y) < 1e-4 || (gy - o.y) / d.y < 0) return null;
      const t = (gy - o.y) / d.y;
      best = { t, x: o.x + d.x * t, y: gy, z: o.z + d.z * t, n: [0, 1, 0] };
    }
    const horiz = Math.abs(best.n[1]) < 0.5;
    return {
      x: Math.floor(best.x), z: Math.floor(best.z), wx: best.x, wy: best.y, wz: best.z, view: '3d', ny: best.n[1],
      face: horiz ? [Math.round(best.n[0]), Math.round(best.n[2])] : null, el: best.el || null, prop: typeof best.prop === 'number' ? best.prop : null, mt: best.mt || null, dist: best.t,
    };
  };

  /* ------------------------------------------------------------ aides --- */
  const MAT = {};
  function mats() {
    if (MAT.ok) return MAT;
    MAT.ok = true;
    MAT.ring = new THREE.MeshBasicMaterial({ color: 0x2fa84a, fog: false, side: THREE.DoubleSide });
    MAT.arrow = new THREE.MeshBasicMaterial({ color: 0x8dff74, fog: false });
    MAT.spot = new THREE.MeshBasicMaterial({ color: 0x2f6fc8, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
    MAT.spotEdge = new THREE.LineBasicMaterial({ color: 0x7cb8ff, fog: false });
    MAT.good = new THREE.MeshBasicMaterial({ color: 0x4fd06a, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    MAT.bad = new THREE.MeshBasicMaterial({ color: 0xe04a3a, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    MAT.box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    MAT.plane = new THREE.PlaneGeometry(1, 1);
    MAT.disc = new THREE.RingGeometry(0.34, 0.5, 28).rotateX(-Math.PI / 2);
    MAT.cone = new THREE.ConeGeometry(0.24, 0.7, 12).rotateX(-Math.PI / 2);
    return MAT;
  }
  /* Étiquette de taille constante à l'écran (noms des lieux, numéros des emplacements). */
  function label(text, color = '#f0e6cc', size = 0.034) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '600 40px "Barlow Condensed", "Arial Narrow", sans-serif';
    const w = Math.ceil(g.measureText(text).width) + 26;
    c.width = w; c.height = 58;
    g.fillStyle = 'rgba(7,9,10,0.7)'; g.fillRect(0, 0, w, 58);
    g.font = '600 40px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 13, 31);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false, sizeAttenuation: false }));
    sp.scale.set((w / 58) * size, size, 1);
    sp.renderOrder = 12;
    sp.userData.noPick = true;
    return sp;
  }
  /* Repères : départ, emplacements de la boîte (sauf celui où elle est), noms des lieux. */
  W3.helpers = () => {
    const v = V(), m = S.map, M = mats();
    const group = new THREE.Group();
    group.name = 'marqueurs';
    const sp = m.spawn, gy = groundY(sp.pos[0], sp.pos[1]);
    const ring = new THREE.Mesh(M.disc, M.ring);
    ring.position.set(sp.pos[0], gy + 0.04, sp.pos[1]);
    ring.scale.setScalar(1.6);
    ring.userData.mt = { kind: 'spawn' }; ring.userData.sharedGeo = true; ring.userData.keepMat = true;
    const arr = new THREE.Mesh(M.cone, M.arrow);
    arr.position.set(sp.pos[0] - Math.sin(sp.yaw) * 1.1, gy + 0.45, sp.pos[1] - Math.cos(sp.yaw) * 1.1);
    arr.rotation.y = sp.yaw;
    arr.userData.mt = { kind: 'spawn' }; arr.userData.sharedGeo = true; arr.userData.keepMat = true;
    group.add(ring, arr);
    const box = ZS.ow.box;
    m.boxes.forEach((b, i) => {
      if (box && i === m.boxStart) return;          // la vraie boîte est là
      const y = Number.isFinite(b.y) ? b.y : groundY(b.x, b.z);
      const g = new THREE.Group();
      g.position.set(b.x, y, b.z);
      g.rotation.y = Math.atan2(b.face[0], b.face[1]);
      const mesh = new THREE.Mesh(M.box, M.spot);
      mesh.scale.set(1.6, 0.8, 0.8);
      mesh.userData.sharedGeo = true; mesh.userData.keepMat = true;
      g.add(mesh);
      g.userData.mt = { kind: 'box', i };
      if (v.labels) { const t = label(`Boîte n° ${i + 1}`, '#a8ccff', 0.028); t.position.set(0, 1.5, 0); g.add(t); }
      group.add(g);
    });
    if (v.labels) {
      for (const L of O.allLocs(m)) {
        const t = label(L.name);
        t.position.set(L.x, groundY(L.x, L.z) + 34, L.z);
        group.add(t);
      }
    }
    return group;
  };
  /* Boîtes de la sélection (contour). */
  W3.selectionBoxes = () => {
    const s = S.sel, m = S.map, out = [];
    if (!s || !m) return out;
    const objs = ZS.ow.objs || {};
    const fromObj = (o) => { if (!o) return false; const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return false; out.push(b.expandByScalar(0.06)); return true; };
    if (s.kind === 'prop') {
      const P = ZS.ow.props;
      for (const i of s.list) { const g = P && P.children.find((c) => c.userData.prop === i); fromObj(g); }
      return out;
    }
    if (s.kind === 'spawn') {
      const gy = groundY(m.spawn.pos[0], m.spawn.pos[1]);
      out.push(new THREE.Box3(new THREE.Vector3(m.spawn.pos[0] - 0.45, gy, m.spawn.pos[1] - 0.45), new THREE.Vector3(m.spawn.pos[0] + 0.45, gy + 1.85, m.spawn.pos[1] + 0.45)));
      return out;
    }
    const e = O.get(s);
    if (!e) return out;
    if (s.kind === 'box' && !(ZS.ow.box && s.i === m.boxStart)) {
      const y = Number.isFinite(e.y) ? e.y : groundY(e.x, e.z), hx = e.face[0] ? 0.4 : 0.8, hz = e.face[0] ? 0.8 : 0.4;
      out.push(new THREE.Box3(new THREE.Vector3(e.x - hx, y, e.z - hz), new THREE.Vector3(e.x + hx, y + 0.85, e.z + hz)));
      return out;
    }
    const o = (objs[s.kind] || [])[s.kind === 'glas' ? 0 : s.i];
    if (!fromObj(o)) {
      const y = Number.isFinite(e.y) ? e.y : groundY(e.x, e.z);
      out.push(new THREE.Box3(new THREE.Vector3(e.x - 0.5, y, e.z - 0.5), new THREE.Vector3(e.x + 0.5, y + 2, e.z + 0.5)));
    }
    return out;
  };
  /* Fantôme de l'élément à poser (vert : possible, rouge : impossible). */
  W3.elementGhost = () => {
    if (O.terrain && ['terrain', 'ground', 'roads', 'buildings'].includes(S.tool)) return O.terrain.ghost3d();
    const pv = MT.preview.ow;
    if (!pv || S.tool !== 'elements') return null;
    const M = mats(), ok = !!pv.ok;
    const x = ok ? pv.x : pv.wx, z = ok ? pv.z : pv.wz;
    const y = ok && Number.isFinite(pv.y) ? pv.y : groundY(x, z);
    const g = new THREE.Group();
    g.userData.noPick = true;
    g.position.set(x, y, z);
    const mesh = new THREE.Mesh(M.box, ok ? M.good : M.bad);
    mesh.userData.sharedGeo = true; mesh.userData.keepMat = true;
    const face = pv.face || (pv.nx !== undefined ? [pv.nx, pv.nz] : [0, 1]);
    g.rotation.y = Math.atan2(face[0], face[1]);
    switch (pv.kind) {
      case 'wallbuy': {
        const p = new THREE.Mesh(M.plane, ok ? M.good : M.bad);
        p.userData.sharedGeo = true; p.userData.keepMat = true;
        p.scale.set(1.6, 0.8, 1); p.position.set(0, 1.6, 0.03);
        g.add(p);
        return g;
      }
      case 'perk': mesh.scale.set(1.3, 2.4, 1.1); mesh.position.z = 0.55; break;
      case 'box': mesh.scale.set(1.6, 0.8, 0.8); break;
      case 'breaker': mesh.scale.set(0.9, 1.8, 0.4); mesh.position.z = 0.2; break;
      case 'fuel': mesh.scale.set(0.9, 0.5, 0.6); break;
      case 'vehicle': {
        const T = ZS.VEH_TYPES[pv.type] || { len: 4.5, wid: 1.9, hgt: 2 };
        mesh.scale.set(T.wid, T.hgt, T.len);
        g.rotation.y = pv.yaw || 0;
        break;
      }
      case 'spawn': mesh.scale.set(0.7, 1.8, 0.7); break;
      case 'oxy': mesh.scale.set(1.3, 1.9, 0.45); mesh.position.z = 0.22; break;
      case 'glas': mesh.scale.set(4.7, 5.6, 4.7); break;
      default: break;
    }
    g.add(mesh);
    return g;
  };
  /* Fantôme d'un objet à poser (outil Objets) : hauteur du sol sous lui. */
  W3.propGhostY = (gh) => groundY(gh.x, gh.z) + (gh.y || 0);

  /* ------------------------------------------------------- démarrage --- */
  MT.on('ow-world', () => { MT.plan.need = true; });
})();
