/* --------------------------------------------- Lune : quitter la Lune --
   « Plateau d'extraction — atterrisseur à réparer pour quitter la carte » : trois pièces.
     ① la centrale inertielle    sur la plate-forme de la tour relais (+118 m : l'ascenseur, avec le
                                 courant ; l'échelle de service est celle des morts)
     ② la valve de tuyère         au fond d'ombre éternelle, dans la cabine de la foreuse
     ③ l'oxygène liquide          une cuve intacte prise dans l'anomalie : trois balles la font sortir
                                 de son orbite, elle retombe (parabole), on la ramasse
   Puis le courant (crête solaire), la séquence de décollage (45 s à tenir près de l'atterrisseur) et le
   départ : l'étage de remontée s'arrache, sans flamme ni fumée, un éclair bleu et la poussière qui
   s'éloigne en paraboles. Ascenseur de la tour, capsules de la catapulte, bande du convoyeur. */
const LUQ = { have: {}, placed: {}, ready: false, seq: null, won: false, cine: null, items: {}, lox: null, hud: null, hudKey: '' };
const LUQ_PARTS = [
  { id: 'nav', n: '①', name: 'Centrale inertielle', where: 'plate-forme de la tour relais' },
  { id: 'valve', n: '②', name: 'Valve de tuyère', where: 'cabine de la foreuse, au fond' },
  { id: 'lox', n: '③', name: 'Oxygène liquide', where: 'une cuve dans l’anomalie : tirez dessus' },
];
const LUQ_RULES = { seq: 45, place: 1.5 };

/* ---- Objets de quête : boîtes posées (centrale, valve), cuve en orbite, interactions au plateau */
function luBuildQuest(root) {
  const g = new THREE.Group(); g.name = 'quête';
  const mk = (col, w, h, d, emis) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.5, emissive: emis || 0x000000, emissiveIntensity: 0.6 })); m.castShadow = true; return m; };
  const T = LUPL.tower, N = LUPL.nodes || {};
  // ① centrale inertielle : boîtier blanc, voyant vert, sur la plate-forme (jeu 2.0.3 : elle la suit)
  const nav = new THREE.Group(); nav.add(mk(0xe8e8e2, 0.6, 0.4, 0.5)); const led = mk(0x2aff6a, 0.06, 0.06, 0.02, 0x2aff6a); led.position.set(0.15, 0.1, 0.26); nav.add(led);
  nav.position.set(T.x + 2.5, T.top + 0.2, T.z + 2.5); g.add(nav);
  owFollow(N.platform, nav);
  // ② valve de tuyère : sur l'établi de la cabine de la foreuse (ils suivent la cabine)
  const H = LUPL.drillHut;
  const valve = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.8 })); valve.add(body);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc83a2a, roughness: 0.5 })); wheel.position.y = 0.34; wheel.rotation.x = Math.PI / 2; valve.add(wheel);
  owLate(N.cabin, () => owFollow(N.cabin, K_luBench(g, H.x0 + 2.5, H.y, H.z0 + 5.6)));
  valve.position.set(H.x0 + 2.5, H.y + 1.15, H.z0 + 5.6); g.add(valve);
  owFollow(N.cabin, valve);
  // ③ cuve d'oxygène liquide : en orbite dans l'anomalie (à 70 m de l'axe, +6 m), visible après l'explosion
  const lox = new THREE.Group(); const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 16), new THREE.MeshStandardMaterial({ color: 0xeaf2f8, roughness: 0.3, metalness: 0.5, emissive: 0x2a6aff, emissiveIntensity: 0.25 }));
  tank.rotation.z = Math.PI / 2; lox.add(tank);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), tank.material); cap.position.x = 1.1; lox.add(cap);
  const cap2 = cap.clone(); cap2.position.x = -1.1; lox.add(cap2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x6aa8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(4, 4, 1); lox.add(glow);
  g.add(lox);
  LUQ.items = { nav, valve, lox };
  LUQ.lox = { g: lox, hits: 0, free: false, vy: 0, vx: 0, vz: 0, landed: false, r: 70, y: 6, w: 0.05, ph: 2.2 };
  linearizeTree(g); luSunifyTree(g);
  root.add(g);
  // prises (à la pose de ce qui les porte)
  const pNav = owPt(N.platform, T.x + 2.5, T.top, T.z + 2.5), pValve = owPt(N.cabin, H.x0 + 2.5, H.y, H.z0 + 5.6);
  Features.interactables.push(
    { kind: 'quest', x: pNav.x, z: pNav.z, y: pNav.y, r: 1.6, prompt() { return !LUQ.have.nav && !LUQ.placed.nav ? { text: 'Appuyez sur F pour prendre la centrale inertielle' } : null; }, use() { if (!LUQ.have.nav && !LUQ.placed.nav) luTake('nav'); } },
    { kind: 'quest', x: pValve.x, z: pValve.z, y: pValve.y, r: 1.7, prompt() { return !LUQ.have.valve && !LUQ.placed.valve ? { text: 'Appuyez sur F pour prendre la valve de tuyère' } : null; }, use() { if (!LUQ.have.valve && !LUQ.placed.valve) luTake('valve'); } },
    { kind: 'quest', get x() { return LUQ.lox.g.position.x; }, get z() { return LUQ.lox.g.position.z; }, get y() { return LUQ.lox.g.position.y - 0.6; }, r: 2.2,
      prompt() { return LUQ.lox.landed && !LUQ.have.lox && !LUQ.placed.lox ? { text: 'Appuyez sur F pour prendre la cuve d’oxygène liquide' } : null; }, use() { if (LUQ.lox.landed && !LUQ.have.lox && !LUQ.placed.lox) luTake('lox'); } },
  );
  // atterrisseur : poser les pièces, puis lancer la séquence (au pied de son échelle, à sa pose)
  const L = LUPL.lander, pL = owPt(N.lander, L.x, L.y, L.z + 5.2);
  Features.interactables.push({
    kind: 'quest', x: pL.x, z: pL.z, y: pL.y, r: 2.6, hold: true,
    prompt() { return luLanderPrompt(); },
    useHold(dt) { luLanderHold(dt); },
  });
  // ascenseur de la tour (en bas et en haut), à la pose de sa cage
  const pLo = owPt(N.lift, T.x, T.y0, T.z + 6.2), pHi = owPt(N.lift, T.x, T.top, T.z + 2.4);
  Features.interactables.push(
    { kind: 'lift', x: pLo.x, z: pLo.z, y: pLo.y, r: 1.8, prompt() { return owNodeHidden(N.lift) ? null : luLiftPrompt(false); }, use() { if (!owNodeHidden(N.lift)) luLiftGo(true); } },
    { kind: 'lift', x: pHi.x, z: pHi.z, y: pHi.y, r: 1.6, prompt() { return owNodeHidden(N.lift) ? null : luLiftPrompt(true); }, use() { if (!owNodeHidden(N.lift)) luLiftGo(false); } },
  );
  luQuestLook();
}
function K_luBench(g, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x5a5e62, roughness: 0.6, metalness: 0.4 }));
  m.position.set(x, y + 0.45, z); g.add(m);
  owFill(OW.surf, x - 0.8, z - 0.35, x + 0.8, z + 0.35, OWK.LOW, { base: y, top: y + 0.9, mat: OWM.METAL });
  return m;
}
/* Atterrisseur à sa pose (jeu 2.0.3). */
function luLanderW() { const L = LUPL.lander; return L ? owPt(LUPL.nodes && LUPL.nodes.lander, L.x, L.y, L.z) : null; }
function luTake(id) {
  LUQ.have[id] = true;
  const p = LUQ_PARTS.find((q) => q.id === id);
  Sound.buy();
  HUD.banner(p.name, 'À poser sur l’atterrisseur · plateau d’extraction', 'power');
  luQuestLook();
}
function luQuestLook() {
  const I = LUQ.items;
  if (!I.nav) return;
  I.nav.visible = !LUQ.have.nav && !LUQ.placed.nav;
  I.valve.visible = !LUQ.have.valve && !LUQ.placed.valve;
  I.lox.visible = LUA.done && !LUQ.have.lox && !LUQ.placed.lox;
  LUQ.ready = LUQ_PARTS.every((p) => LUQ.placed[p.id]);
}
function luLanderPrompt() {
  const miss = LUQ_PARTS.filter((p) => !LUQ.placed[p.id]);
  const carry = miss.filter((p) => LUQ.have[p.id]);
  if (carry.length) return { text: `Maintenez F pour poser : ${carry[0].name.toLowerCase()}`, sub: `${3 - miss.length}/3 pièces en place` };
  if (miss.length) return { text: `Il manque ${miss.length === 1 ? 'une pièce' : `${miss.length} pièces`} à l’atterrisseur`, disabled: true, sub: miss.map((p) => `${p.n} ${p.name}`).join(' · ') };
  if (!G.power) return { text: 'L’atterrisseur est réparé : il faut du courant pour la séquence (crête solaire)', disabled: true };
  if (LUQ.seq && LUQ.seq.t < LUQ_RULES.seq) return { text: `Séquence de décollage… ${Math.ceil(LUQ_RULES.seq - LUQ.seq.t)} s`, disabled: true, sub: 'Défendez l’atterrisseur' };
  if (LUQ.seq) return { text: 'Maintenez F pour décoller', sub: 'Le moteur est prêt : on quitte la Lune' };
  return { text: 'Maintenez F pour lancer la séquence de décollage', sub: '45 s à tenir près de l’atterrisseur' };
}
function luLanderHold(dt) {
  if (LUQ.won) return;
  const carry = LUQ_PARTS.find((p) => LUQ.have[p.id] && !LUQ.placed[p.id]);
  if (carry) {
    LUQ.placeT = (LUQ.placeT || 0) + dt;
    if (LUQ.placeT >= LUQ_RULES.place) { LUQ.placeT = 0; LUQ.have[carry.id] = false; LUQ.placed[carry.id] = true; Sound.buy(); HUD.banner(carry.name, `En place · ${LUQ_PARTS.filter((p) => LUQ.placed[p.id]).length}/3`, 'power'); luQuestLook(); }
    return;
  }
  if (!LUQ.ready || !G.power) return;
  if (LUQ.seq && LUQ.seq.t >= LUQ_RULES.seq) { LUQ.goT = (LUQ.goT || 0) + dt; if (LUQ.goT >= 0.6) luVictory(); return; }
  if (LUQ.seq) return;
  LUQ.startT = (LUQ.startT || 0) + dt;
  if (LUQ.startT < 1) return;
  LUQ.startT = 0;
  LUQ.seq = { t: 0 };
  HUD.banner('Séquence de décollage', 'Tenez 45 s : les morts viennent au plateau', 'warn');
  if (G.roundState !== 'active') startRound(G.round + 1);
  G.total = Math.max(G.total, G.spawned + 30); G.spawnDelay = Math.min(G.spawnDelay, 0.8);
}
/* ---- Chaque image : cuve en orbite (et sa chute), séquence, ascenseur, capsules, convoyeur, plots */
function luQuestUpdate(dt) {
  const X = LUQ.lox;
  if (X && X.g && LUA.done && !LUQ.have.lox && !LUQ.placed.lox) {
    if (!X.free) {
      const a = X.ph + LUA.t * X.w, T = LUA.boomT;
      let x = LUA.x + Math.cos(a) * X.r, y = X.y + Math.sin(LUA.t * 0.4) * 1.5, z = LUA.z + Math.sin(a) * X.r;
      if (T < 4) { const D = luDepotW() || LUPL.depot, k = smooth(clamp(T / 4, 0, 1)); x = lerp(D.x, x, k); y = lerp(D.y + 4, y, k); z = lerp(D.z, z, k); }
      X.g.position.set(x, y, z);
      X.g.rotation.set(LUA.t * 0.3, LUA.t * 0.5, 0);
      X.vx = -Math.sin(a) * X.r * X.w; X.vz = Math.cos(a) * X.r * X.w; X.vy = 0;
    } else if (!X.landed) {
      // hors de l'orbite : une parabole (l'anomalie ne la reprend pas : la cuve est trop lourde)
      X.vy -= LU.g * dt;
      X.g.position.x += X.vx * dt; X.g.position.y += X.vy * dt; X.g.position.z += X.vz * dt;
      const fl = owFloorBelow(X.g.position.x, X.g.position.z, X.g.position.y + 0.5);
      if (X.g.position.y < fl + 0.6) { X.g.position.y = fl + 0.6; X.landed = true; X.g.rotation.set(0, X.g.rotation.y, 0); luLoxSettle(X); HUD.hint('La cuve d’oxygène liquide est retombée', 3); }
    }
  }
  // séquence de décollage (le compte s'arrête si on s'éloigne)
  const S = LUQ.seq, L = luLanderW();
  if (S && !LUQ.won && L) {
    const d = Math.hypot(player.pos.x - L.x, player.pos.z - L.z);
    if (d < 65) S.t += dt;
    else if (!S.warnT || G.time - S.warnT > 6) { S.warnT = G.time; HUD.hint('Revenez à l’atterrisseur : la séquence attend', 2.5); }
    if (S.t >= LUQ_RULES.seq && !S.done) { S.done = true; HUD.banner('Moteur prêt', 'Maintenez F à l’échelle de l’atterrisseur pour décoller', 'power'); }
  }
  luLiftUpdate(dt);
  luCataUpdate(dt);
  luBelt(dt);
  for (const m of LU.padMeshes || []) { m.flash = Math.max(0, (m.flash || 0) - dt * 2); m.disk.material.opacity = 0.55 + 0.3 * Math.sin(OW.t * 3 + m.pad.a) + m.flash * 0.4; }
  luObjectivesHud(dt);
  luVictoryCam(dt);
}
/* Tombée sur une paroi trop raide (ou dans les restes du dépôt) : elle roule jusqu'au sol praticable
   le plus proche, plus bas de préférence. */
function luLoxSettle(X) {
  const p = X.g.position, ok = (x, z) => owWalkCell(0, Math.floor(x), Math.floor(z)) || Number.isFinite(luDeckY(x, z));
  if (ok(p.x, p.z)) return;
  let best = null, bs = Infinity;
  for (let r = 1; r <= 24 && !best; r++) {
    for (let i = 0; i < 8 * r; i++) {
      const a = (i / (8 * r)) * TAU, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (x < 4 || z < 4 || x > OW.W - 4 || z > OW.D - 4 || !ok(x, z)) continue;
      const y = owFloorBelow(x, z, p.y + 2), s = r + Math.max(0, y - p.y) * 3;
      if (s < bs) { bs = s; best = [x, y, z]; }
    }
  }
  if (best) p.set(best[0], best[1] + 0.6, best[2]);
}
/* Rayon d'une arme (hitscan) : touche-t-il la cuve en orbite ? (sphère de 1,3 m autour d'elle) */
function luLoxRay(ox, oy, oz, dx, dy, dz, maxT) {
  const X = LUQ.lox;
  if (!X || X.free || !LUA.done || !X.g.visible) return;
  const p = X.g.position, cx = p.x - ox, cy = p.y - oy, cz = p.z - oz, t = cx * dx + cy * dy + cz * dz;
  if (t < 0 || t > maxT) return;
  const qx = cx - dx * t, qy = cy - dy * t, qz = cz - dz * t;
  if (qx * qx + qy * qy + qz * qz < 1.69) { luLoxHit(); Arms.shotHit = true; HUD.hitmarker(false); }
}
/* La cuve est touchée (rayon des armes contre elle) : au troisième coup, elle quitte l'orbite. */
function luLoxHit() {
  const X = LUQ.lox;
  if (!X || X.free || !LUA.done) return false;
  X.hits++;
  sparkBurst(X.g.position.x, X.g.position.y, X.g.position.z, 0, 1, 0, 4);
  if (X.hits >= 3) { X.free = true; X.vy = 1.5; HUD.hint('La cuve quitte l’anomalie', 2.5); }
  return true;
}

/* ---- Ascenseur de la tour : 12 s de montée ; le courant d'abord */
const LUL = { ride: null };
function luLiftPrompt(top) {
  if (LUL.ride) return null;
  if (!G.power) return { text: 'Ascenseur sans courant (crête solaire)', disabled: true };
  return { text: top ? 'Appuyez sur F pour redescendre' : 'Appuyez sur F pour monter au sommet de la tour', sub: top ? '' : 'Plate-forme à +118 m : le perchoir' };
}
function luLiftGo(up) {
  if (LUL.ride || !G.power || KHP.busy > 0) return;
  const T = LUPL.tower;
  LUL.ride = { up, t: 0, dur: 12 };
  KHP.busy = 99;
  player.vel.set(0, 0, 0); player.vy = 0; player.y = 0; player.grounded = true;
  Sound.door ? Sound.door() : Sound.ui();
}
function luLiftUpdate(dt) {
  const R = LUL.ride;
  if (!R) return;
  const T = LUPL.tower, N = LUPL.nodes && LUPL.nodes.lift;
  R.t += dt;
  const k = smooth(clamp(R.t / R.dur, 0, 1)), y = R.up ? lerp(T.y0, T.top, k) : lerp(T.top, T.y0, k);
  const p = owPt(N, T.x, y, T.z + 1.2);             // jeu 2.0.3 : dans la cage, à sa pose
  player.pos.set(p.x, p.y, p.z); player.gy = p.y; player.y = 0; player.layer = 0;
  if (R.t >= R.dur) {
    LUL.ride = null; KHP.busy = 0;
    const q = R.up ? owPt(N, T.x + 0.5, T.top, T.z + 1.5) : owPt(N, T.x, T.y0, T.z + 7.2);
    placePlayer(q.x, q.z);
  }
}
/* ---- Catapulte : une capsule part toutes les 40 à 60 s (accélération jusqu'à 60 m/s au bout) */
function luCataUpdate(dt) {
  const C = LU.cataRun;
  if (!C || owNodeHidden(LUPL.nodes && LUPL.nodes.cata)) return;
  C.next -= dt;
  const run = C.caps.find((c) => c.t >= 0);
  if (!run && C.next <= 0) {
    const c = C.caps[(C.i = ((C.i || 0) + 1) % C.caps.length)];
    c.t = 0; c.s = 0; c.v = 0;
    C.next = rand(40, 60);
    const st = owPt(LUPL.nodes && LUPL.nodes.cata, LU.cata.x0, 0, LU.cata.z0), ds = Math.hypot(player.pos.x - st.x, player.pos.z - st.z);
    if (ds < 60 && !LU.inside) luRumble(0.4 * (1 - ds / 60), 1.5);
  }
  const a = (60 * 60) / (2 * C.L);
  for (const c of C.caps) {
    if (c.t < 0) { c.m.visible = false; c.glow.material.opacity = 0; continue; }
    c.t += dt; c.v = Math.min(60, c.v + a * dt); c.s += c.v * dt;
    const u = c.s / C.L;
    luCataPlace(c, u);
    c.glow.material.opacity = clamp(c.v / 30, 0, 0.9);
    // sur la voie au départ : ce qui est dans le berceau est fauché
    if (c.s < 12 && !player.down) { const p = player, d = Math.hypot(p.pos.x - c.m.position.x, p.pos.z - c.m.position.z); if (d < 2 && Math.abs(p.gy + 1 - c.m.position.y) < 2.5) playerDamage(80, true); }
    if (u > 1.5) { c.t = -1; c.m.visible = false; }
  }
  // la suivante attend au berceau
  if (!run) { const w = C.caps[((C.i || 0) + 1) % C.caps.length]; luCataPlace(w, 0); w.m.visible = true; }
}
/* ---- Convoyeur : la bande monte (2,5 m/s) ; ce qui s'y tient monte avec elle */
function luBelt(dt) {
  const C = LU.conv, u = LUPL.conv;
  if (!u) return;
  const on = (b) => { if ((b.layer | 0) !== 1) return false; const L = OW.under, ch = owChunk(L, Math.floor(b.pos.x), Math.floor(b.pos.z)); return !!ch && ch.dir[owIdx(Math.floor(b.pos.x), Math.floor(b.pos.z))] === 7; };
  const [ux, uz] = owDir(LUPL.nodes && LUPL.nodes.conv, u.ux, u.uz);    // jeu 2.0.3 : le sens suit le convoyeur
  if (on(player) && player.grounded && !KHP.busy) { player.pos.x += ux * C.belt * dt; player.pos.z += uz * C.belt * dt; }
  for (const z of Zombies.list) if (z.alive && !z.luAir && on(z)) { z.pos.x += ux * C.belt * dt; z.pos.z += uz * C.belt * dt; }
}

/* ---- Objectifs (à gauche) et repères de la mini-carte */
function luObjectives() {
  const L = [];
  for (const p of LUQ_PARTS) {
    if (LUQ.placed[p.id]) continue;
    const where = p.id === 'lox' && !LUA.done ? 'au dépôt d’oxygène' : p.id === 'lox' && LUQ.lox && LUQ.lox.landed ? 'retombée : à ramasser' : p.where;
    L.push([LUQ.have[p.id] ? '►' : '·', `${p.n} ${p.name}${LUQ.have[p.id] ? ' : à poser sur l’atterrisseur' : ` · ${where}`}`]);
  }
  const placed = LUQ_PARTS.filter((p) => LUQ.placed[p.id]).length;
  if (!LUQ.ready) L.push(['·', `Réparer l’atterrisseur (${placed}/3) · plateau d’extraction`]);
  else if (!G.power) L.push(['►', 'Rétablir le courant · crête solaire']);
  else if (!LUQ.seq) L.push(['►', 'Lancer la séquence de décollage · atterrisseur']);
  else if (LUQ.seq.t < LUQ_RULES.seq) L.push(['►', `Tenir : ${khClock(LUQ_RULES.seq - LUQ.seq.t)}`]);
  else L.push(['►', 'Décoller !']);
  return L;
}
function luObjectivesHud(dt) {
  if (!LUQ.hud) {
    const b = el('div', 'lu-quest');
    Object.assign(b.style, { position: 'absolute', left: 'calc(26px + env(safe-area-inset-left, 0px))', top: 'calc(62px + env(safe-area-inset-top, 0px))', maxWidth: 'min(430px, 44vw)', pointerEvents: 'none',
      font: `600 13px/1.45 ${FONT_HUD}`, letterSpacing: '0.04em', color: '#e8eef2', textShadow: '0 1px 0 rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)' });
    $('hud').append(b);
    LUQ.hud = b;
  }
  LUQ.hud.hidden = !OW.on || OW.worldId !== 'lune' || !owBaseHasPlaces() || G.state !== 'playing' || LUQ.won;
  if (LUQ.hud.hidden) return;
  LUQ.hudT = (LUQ.hudT || 0) - dt;
  if (LUQ.hudT > 0) return;
  LUQ.hudT = 0.5;
  const L = luObjectives(), key = L.map((l) => l.join(' ')).join('|');
  if (key === LUQ.hudKey) return;
  LUQ.hudKey = key;
  LUQ.hud.innerHTML = '<div style="font-size:11px;letter-spacing:0.22em;color:#f0a33a">QUITTER LA LUNE</div>' + L.map(([m, t]) => `<div><span style="display:inline-block;width:1.2em;color:${m === '►' ? '#46b8ff' : '#9aa4ac'}">${m}</span>${t}</div>`).join('');
}
function luQuestMapMarks(g, X, Z, S) {
  const mark = (x, z, col, txt) => {
    const px = X(x), pz = Z(z);
    if (px < -8 || pz < -8 || px > S + 8 || pz > S + 8) return;
    g.fillStyle = col; g.strokeStyle = '#0b0c0e'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, pz, 6, 0, TAU); g.fill(); g.stroke();
    if (txt) { g.fillStyle = '#0b0c0e'; g.font = `700 9px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, px, pz + 0.5); }
  };
  const I = LUQ.items;
  if (!I.nav) return;
  if (!LUQ.have.nav && !LUQ.placed.nav) mark(I.nav.position.x, I.nav.position.z, '#f0a33a', '1');
  if (!LUQ.have.valve && !LUQ.placed.valve) mark(I.valve.position.x, I.valve.position.z, '#f0a33a', '2');
  if (LUA.done && !LUQ.have.lox && !LUQ.placed.lox) mark(I.lox.position.x, I.lox.position.z, '#46b8ff', '3');
  if (LUPL.lander) { const L = luLanderW(); mark(L.x, L.z, '#ffffff', '▲'); }
}

/* ---- Départ : l'étage de remontée s'élève, la caméra le suit depuis le plateau, puis l'écran de fin */
function luVictory() {
  if (LUQ.won) return;
  LUQ.won = true;
  LUQ.cine = { t: 0 };
  clearZombies();
  G.roundState = 'pre'; G.roundT = 1e9;
  HUD.el.hud.hidden = true;
  Arms.root.visible = false;
  KHP.busy = 99;
  store.set('zs.ombre.wins', (store.get('zs.ombre.wins', 0) | 0) + 1);
  const L = luLanderW();
  if (!LUQ.ascent) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 2.4, 6), luSunify(new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.5, metalness: 0.2 })));
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x9fd0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    fl.position.y = -1.6; fl.scale.set(3, 5, 1);
    g.add(cab, fl);
    World.root.add(g);
    LUQ.ascent = { g, fl };
  }
  LUQ.ascent.g.position.set(L.x, L.y + 5, L.z);
  const P = owSandPool();
  for (let i = 0; i < 120; i++) { const a = rand(0, TAU), v = rand(4, 16); P.emit(L.x + Math.cos(a) * 3, L.y + 0.2, L.z + Math.sin(a) * 3, Math.cos(a) * v, rand(1, 7), Math.sin(a) * v, rand(3, 6)); }
}
function luVictoryCam(dt) {
  const C = LUQ.cine;
  if (!C) return;
  C.t += dt;
  const L = luLanderW(), t = C.t, h = Math.max(0, t - 0.6) ** 2 * 1.6 + Math.max(0, t - 0.6) * 2;
  if (LUQ.ascent) { LUQ.ascent.g.position.set(L.x + t * 0.3, L.y + 5 + h, L.z); LUQ.ascent.fl.material.opacity = 0.6 + 0.3 * Math.sin(t * 40); }
  camera.position.set(L.x - 38, L.y + 6 + Math.min(h * 0.25, 20), L.z + 34);
  camera.lookAt(L.x, L.y + 5 + h, L.z);
  Arms.root.visible = false; HUD.el.hud.hidden = true;
  if (t > 6 && !C.faded) { C.faded = true; khFade(true, 1.2); }
  if (t > 7.5 && !C.done) {
    C.done = true;
    KHP.busy = 0;
    G.state = 'playing';
    gameOver();
    renderer.domElement.classList.remove('downed');
    $('go-title').textContent = 'Évasion réussie';
    $('go-rounds').textContent = `Vous avez quitté la Lune à la manche ${Math.max(1, G.round)}`;
    setTimeout(() => khFade(false, 0.6), 1700);
  }
}

/* ---- Manches, remise à zéro, sauvegarde */
function luOnRound(n) {
  if (n === 1 && !LUA.done && owBaseHasPlaces()) LUA.armT = 3.5;       // le dépôt saute sous les yeux du joueur
}
function luResetWorld() {
  luLifeReset();
  if (owBaseHasPlaces()) {
    luDepotState(false);
    LUA.armT = -1;
    for (const p of LUQ_PARTS) { LUQ.have[p.id] = false; LUQ.placed[p.id] = false; }
    LUQ.ready = false; LUQ.seq = null; LUQ.won = false; LUQ.cine = null; LUQ.placeT = LUQ.startT = LUQ.goT = 0; LUQ.hudKey = '';
    if (LUQ.lox) Object.assign(LUQ.lox, { hits: 0, free: false, landed: false });
    if (LUQ.ascent) { LUQ.ascent.g.parent && LUQ.ascent.g.parent.remove(LUQ.ascent.g); LUQ.ascent = null; }
    LUL.ride = null;
    if (LU.cataRun) { for (const c of LU.cataRun.caps) c.t = -1; LU.cataRun.next = rand(8, 14); }
    luQuestLook();
  }
}
function luSerialize() {
  return { o2: Math.round(LUO.o2), depot: LUA.done, have: { ...LUQ.have }, placed: { ...LUQ.placed }, lox: LUQ.lox ? { free: LUQ.lox.free, landed: LUQ.lox.landed, x: LUQ.lox.g.position.x, y: LUQ.lox.g.position.y, z: LUQ.lox.g.position.z } : null };
}
function luRestore(s) {
  try {
    LUO.o2 = clamp(+s.o2 || LUO.max, 0, LUO.max);
    if (s.depot) luDepotState(true, 60);
    for (const p of LUQ_PARTS) { LUQ.have[p.id] = !!(s.have && s.have[p.id]); LUQ.placed[p.id] = !!(s.placed && s.placed[p.id]); }
    if (s.lox && LUQ.lox && s.lox.landed) { LUQ.lox.free = true; LUQ.lox.landed = true; LUQ.lox.g.position.set(s.lox.x, s.lox.y, s.lox.z); }
    luQuestLook();
  } catch (e) { console.warn('Lune : sauvegarde illisible', e); }
}

/* ---- Menu : consignes de la Lune */
function luMenuTips(map) {
  for (const id of ['tip-veh', 'tip-storm', 'tip-planks']) { const e = $(id); if (e) e.hidden = true; }
  const places = (OW_BASES[map.base] || {}).places;
  const set = (id, txt) => { const e = $(id); if (!e) return; e.hidden = !txt; if (txt) e.textContent = txt; };
  set('tip-box', `La boîte mystère (${RULES.boxCost} points) : une caisse de ravitaillement qui change de lieu.`);
  const B = map.breakers || [];
  set('tip-power', map.rules && map.rules.powerOn ? 'Courant rétabli dès le départ.' : B.length ? `${khBreakersWord(B.length).replace(/^./, (c) => c.toUpperCase())} au poste de la crête solaire : le courant des atouts${places ? ', de l’ascenseur et de l’atterrisseur' : ''}.` : 'Pas de disjoncteur sur cette carte : les atouts électriques restent sans courant.');
  set('tip-moon', '1/6 g : sauts de 3 m, chutes mortelles à 50 m. Les plots bleus propulsent d’un gradin à l’autre.');
  set('tip-o2', `Oxygène : 4 min dehors ; recharge dans la base, bouteille aux postes (${LU_OXY.cost} points). Dehors, aucun son.`);
}
