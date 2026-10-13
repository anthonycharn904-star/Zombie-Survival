/* ----------------------------------------------------------------- Quête --
   Planche « Sortir du Khamsin » (page 5) : la partie se gagne en décollant de l'aérodrome. Trois
   pièces à réunir, un boss à abattre pour calmer la tempête, une course contre la montre à la fin.
     ① carburant d'aviation : la cuve derrière le garage du relais Km 47 (C) ;
     ② batterie de démarrage : la centrale du Nil (E), chargée une fois le courant rétabli ;
     ③ clé de contact : sur le pilote, qui erre autour du bassin de l'oasis (D) ;
   poser ①, ② et ③ sur l'avion (G) : avion prêt ; tuer le Gardien au sanctuaire (B) : la tempête
   tombe 4 minutes ; rejoindre l'avion, tenir 60 s pendant le démarrage, décoller.
   Optionnel : les trois fragments du Sceptre, dans les tombes de la nécropole (F) qui brillent
   pendant les tempêtes (dégâts doublés sur le Gardien pendant ses fenêtres de tir). */
const KHQ = {
  have: { fuel: false, battery: false, key: false },          // pièces portées
  placed: { fuel: false, battery: false, key: false },        // pièces posées sur l'avion
  ready: false, sceptre: false, frags: [false, false, false], charge: 0, charging: false,
  pilot: null, key: null, escape: null, won: false, fail: 0,
  hud: null, hudKey: '', fx: null, items: null,
};
const KHQ_PARTS = [
  { id: 'fuel', n: '①', name: 'Carburant d’aviation', where: 'Relais Km 47 · cuve derrière le garage', short: 'carburant' },
  { id: 'battery', n: '②', name: 'Batterie de démarrage', where: 'Centrale du Nil · courant rétabli', short: 'batterie' },
  { id: 'key', n: '③', name: 'Clé de contact', where: 'Oasis de Sekhet · sur le pilote', short: 'clé' },
];
const KHQ_RULES = { charge: 45, fill: 4, place: 1.5, wake: 3, start: 60, pilotNear: 150, pilotFar: 320, frag: 1.2 };

/* ---- Construction (à chaque chargement) : vanne de la cuve, chargeur, fragments, pièces de l'avion */
function owBuildQuest(root) {
  const g = new THREE.Group();
  g.name = 'quête';
  root.add(g);
  const P = KH.places, std = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.6, metalness: 0.2 }, o));
  const at = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
  KHQ.items = {};
  // ① vanne et flexible sur la cuve d'aviation (relais) ; le fût rempli (jeu 2.0.3 : ils suivent la cuve)
  {
    const T = P.C.fuelTank, y = P.C.y, N = T.node, f = (m) => owFollow(N, m);
    f(at(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), std(0x6a6a64, { metalness: 0.6 }), T.x, y + 0.85, T.z + 0.2));
    const wheel = f(at(new THREE.TorusGeometry(0.16, 0.025, 6, 16), std(0xb03a28), T.x, y + 1.1, T.z - 0.02));
    const drum = f(at(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 14), std(0x9c2f22, { metalness: 0.35 }), T.x - 1.4, y + 0.44, T.z - 0.9));
    drum.visible = false;
    KHQ.items.wheel = wheel; KHQ.items.drum = drum;
    const q = owPt(N, T.x, y, T.z - 1.3);
    Features.interactables.push({
      kind: 'quest', x: q.x, z: q.z, y: q.y, r: 1.6, hold: true,
      prompt() {
        if (KHQ.have.fuel || KHQ.placed.fuel) return null;
        return { text: 'Maintenez F pour remplir un fût de carburant d’aviation', sub: `Pièce ① de l’avion · ${Math.round(((KHQ.fillT || 0) / KHQ_RULES.fill) * 100)} %` };
      },
      useHold(dt) {
        if (KHQ.have.fuel || KHQ.placed.fuel) return;
        KHQ.fillT = (KHQ.fillT || 0) + dt;
        wheel.rotation.z += dt * 4;
        if (Math.random() < dt * 3) Sound.gulp(0);
        if (KHQ.fillT >= KHQ_RULES.fill) { KHQ.fillT = 0; khTake('fuel'); drum.visible = false; }
      },
    });
  }
  // ② chargeur de la batterie (poste de commande de la centrale) : il suit le poste (jeu 2.0.3)
  {
    const B = P.E.battery, y = B.y, N = B.node, f = (m) => owFollow(N, m);
    f(at(new THREE.BoxGeometry(1.2, 0.8, 0.6), std(0x4a5a52, { metalness: 0.5 }), B.x, y + 0.4, B.z));
    const bat = f(at(new THREE.BoxGeometry(0.62, 0.34, 0.36), std(0x22282c, { metalness: 0.3 }), B.x, y + 0.97, B.z));
    for (const s of [-1, 1]) f(at(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), std(s > 0 ? 0xb03a28 : 0x222222), B.x + s * 0.2, y + 1.17, B.z));
    const lamp = f(at(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), B.x + 0.45, y + 0.7, B.z + 0.31));
    owLate(N, () => owFill(OW.surf, B.x - 0.6, B.z - 0.3, B.x + 0.6, B.z + 0.3, OWK.LOW, { base: y, top: y + 0.8, mat: OWM.METAL }));
    KHQ.items.bat = bat; KHQ.items.batLamp = lamp;
    const q = owPt(N, B.x, y, B.z - 0.9);
    Features.interactables.push({
      kind: 'quest', x: q.x, z: q.z, y: q.y, r: 1.5,
      prompt() {
        if (KHQ.have.battery || KHQ.placed.battery) return null;
        if (!G.power) return { text: KHF.breakers.length ? `Batterie de démarrage déchargée : rétablissez le courant (${khBreakersWord(KHF.breakers.length)})` : 'Batterie de démarrage déchargée : pas de courant sur cette carte', disabled: true };
        if (KHQ.charge < 1) return { text: `Batterie en charge… ${Math.round(KHQ.charge * 100)} %`, disabled: true, sub: 'Pièce ② de l’avion' };
        return { text: 'Appuyez sur F pour prendre la batterie de démarrage', sub: 'Pièce ② de l’avion' };
      },
      use() { if (!KHQ.have.battery && !KHQ.placed.battery && KHQ.charge >= 1) { khTake('battery'); bat.visible = false; } },
    });
  }
  // fragments du Sceptre : sur les sarcophages des tombes 1, 3 et 5 (ils n'apparaissent qu'en tempête)
  KHQ.fragMeshes = [];
  [0, 2, 4].forEach((ti, i) => {
    const T = P.F.tombs[ti], cx = (T.x0 + T.x1) / 2, y = T.y, z = T.z0 + 2.1;
    const fr = new THREE.Group();
    const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 8), std(0xd4a640, { roughness: 0.3, metalness: 0.85, emissive: 0x5ff2e2, emissiveIntensity: 0.6 }));
    shard.rotation.z = 0.9 + i * 0.5; fr.add(shard);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ff2e2, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.set(1.4, 1.4, 1); fr.add(halo);
    fr.position.set(cx, y + 1.45, z);
    g.add(fr);
    owFollow(T.node, fr);                              // jeu 2.0.3 : le fragment suit son tombeau
    // la tombe brille (visible de loin dans la poussière)
    const door = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ff2e2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    door.position.set(cx, y + 1.6, T.z1 + 0.6); door.scale.set(7, 5, 1);
    g.add(door);
    owFollow(T.node, door);
    KHQ.fragMeshes.push({ fr, shard, halo, door, i });
    const q = owPt(T.node, cx, y, T.z0 + 3.3);
    Features.interactables.push({
      kind: 'quest', x: q.x, z: q.z, y: q.y, r: 1.6,
      prompt() {
        if (KHQ.frags[i] || !KHS.on) return null;
        return { text: 'Appuyez sur F pour prendre le fragment du Sceptre', sub: `${KHQ.frags.filter(Boolean).length + 1} / 3 · dégâts doublés sur le Gardien une fois reconstitué` };
      },
      use() { if (!KHQ.frags[i] && KHS.on) khTakeFrag(i); },
    });
  });
  // avion : pièces posées (fût contre le fuselage, batterie sous le nez, voyant du tableau de bord), hélices
  {
    const A = P.G.plane, y = A.y;
    const drum = at(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 14), std(0x9c2f22, { metalness: 0.35 }), A.x + 2, y + 0.44, A.z + 2.3);
    const bat = at(new THREE.BoxGeometry(0.62, 0.34, 0.36), std(0x22282c), A.x - 9.9, y + 0.5, A.z);
    const keyLamp = at(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), A.x - 6.6, y + 3.0, A.z - 0.9);
    drum.visible = bat.visible = false;
    KHQ.items.pDrum = drum; KHQ.items.pBat = bat; KHQ.items.pKey = keyLamp;
    const spots = { fuel: [A.x + 2, A.z + 2.9], battery: [A.x - 10.5, A.z], key: [A.x - 5.4, A.z - 2.4] };
    for (const part of KHQ_PARTS) {
      const [x, z] = spots[part.id];
      Features.interactables.push({
        kind: 'quest', x, z, y, r: 1.6, hold: true,
        prompt() {
          if (KHQ.placed[part.id]) {
            if (part.id === 'key') return khEscapePrompt();
            return null;
          }
          if (!KHQ.have[part.id]) return { text: `Il manque la pièce ${part.n} : ${part.name.toLowerCase()}`, disabled: true, sub: part.where };
          return { text: `Maintenez F pour poser ${part.n} ${part.name.toLowerCase()}`, sub: `Avion de transport KH-47 · ${Math.round(((KHQ.placeT || 0) / KHQ_RULES.place) * 100)} %` };
        },
        useHold(dt) {
          if (KHQ.placed[part.id]) { if (part.id === 'key') khEscapeHold(dt); return; }
          if (!KHQ.have[part.id]) return;
          KHQ.placeT = (KHQ.placeT || 0) + dt;
          if (KHQ.placeT >= KHQ_RULES.place) { KHQ.placeT = 0; khPlace(part.id); }
        },
      });
    }
  }
  // autel : réveiller le Gardien (face nord de l'autel)
  {
    const A = KHSAN.altar, E = KHSY + 0.4;
    Features.interactables.push({
      kind: 'quest', x: A.x, z: A.z - 1.9, y: E, r: 1.6, hold: true,
      prompt() {
        if (KHG.e && !KHG.e.removed) return null;
        if (KHG.dead && KHS.calmT > 0) return { text: 'Le Gardien est tombé : rejoignez l’avion', disabled: true };
        if (!KHQ.ready) return { text: 'Le Gardien dort. Réparez d’abord l’avion : sa mort ne donne que 4 minutes de calme', disabled: true };
        return { text: 'Maintenez F pour réveiller le Gardien', sub: `${Math.round(((KHQ.wakeT || 0) / KHQ_RULES.wake) * 100)} %${KHQ.sceptre ? ' · Sceptre reconstitué : dégâts ×2 pendant les fenêtres de tir' : ' · Sceptre incomplet (fragments à la nécropole, en tempête)'}` };
      },
      useHold(dt) {
        if ((KHG.e && !KHG.e.removed) || !KHQ.ready || (KHG.dead && KHS.calmT > 0)) return;
        KHQ.wakeT = (KHQ.wakeT || 0) + dt;
        if (KHQ.wakeT >= KHQ_RULES.wake) { KHQ.wakeT = 0; khWakeGardien(); }
      },
    });
  }
  // hélices de l'avion (elles tournent au démarrage)
  KHQ.props = [];
  {
    const A = P.G.plane, yc = A.y + 2.6 + 1.45 - 0.55;
    for (const sd of [-1, 1]) {
      const hub = new THREE.Group();
      hub.position.set(A.x - 4.2, yc, A.z + sd * 4.6);
      for (let b = 0; b < 4; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.2), std(0x2a2826, { roughness: 0.5 }));
        bl.position.y = 0.95; const arm = new THREE.Group(); arm.rotation.x = (b / 4) * TAU; arm.add(bl); hub.add(arm);
      }
      g.add(hub);
      KHQ.props.push(hub);
    }
  }
  linearizeTree(g);
  KHQ.group = g;
  khQuestLook();
}

/* ---- Pièces : prises, posées */
function khTake(id) {
  KHQ.have[id] = true;
  const P = KHQ_PARTS.find((q) => q.id === id);
  HUD.banner(`Pièce ${P.n} : ${P.name}`, 'À poser sur l’avion, à l’aérodrome', 'power');
  Sound.ui();
  khQuestLook();
}
function khPlace(id) {
  KHQ.have[id] = false; KHQ.placed[id] = true;
  const n = KHQ_PARTS.filter((q) => KHQ.placed[q.id]).length;
  Sound.boardPlace(KH.places.G.plane);
  if (n >= 3) {
    KHQ.ready = true;
    HUD.banner('L’avion est prêt', 'Il ne manque que le calme : abattez le Gardien au sanctuaire (plateau des pyramides)', 'power');
  } else HUD.banner(`Pièce posée (${n}/3)`, KHQ_PARTS.filter((q) => !KHQ.placed[q.id]).map((q) => `${q.n} ${q.short}`).join(' · ') + ' à trouver', 'power');
  khQuestLook();
}
function khTakeFrag(i) {
  KHQ.frags[i] = true;
  const n = KHQ.frags.filter(Boolean).length;
  if (n >= 3) { KHQ.sceptre = true; HUD.banner('Sceptre du Gardien reconstitué', 'Dégâts doublés sur le Gardien pendant ses fenêtres de tir', 'power'); }
  else HUD.banner(`Fragment du Sceptre (${n}/3)`, 'Les autres brillent dans les tombes de la nécropole, pendant la tempête', 'power');
  Sound.glasChime ? Sound.glasChime(player.pos) : Sound.ui();
  khQuestLook();
}
/* Apparence des pièces (visibles ou non) selon l'état de la quête. */
function khQuestLook() {
  const I = KHQ.items;
  if (!I) return;
  I.drum.visible = false;
  I.bat.visible = !KHQ.have.battery && !KHQ.placed.battery;
  I.batLamp.material.color.setHex(KHQ.charge >= 1 ? 0x40ff60 : G.power ? 0xffb030 : 0xff2a1a);
  I.pDrum.visible = KHQ.placed.fuel; I.pBat.visible = KHQ.placed.battery;
  I.pKey.material.color.setHex(KHQ.placed.key ? 0x40ff60 : 0xff2a1a);
  KHQ.hudKey = '';
}

/* ---- Le pilote : il erre autour du bassin ; abattu, il lâche la clé de contact */
function khPilotTick(dt) {
  if (KHQ.have.key || KHQ.placed.key || KHQ.key) return;
  const O = KH.oasis, d = Math.hypot(player.pos.x - O.x, player.pos.z - O.z), z = KHQ.pilot;
  if (z && (z.removed || !z.alive)) {
    if (!z.alive && !z.removed || (z.removed && z.hp <= 0)) khDropKey(z.pos.x, z.pos.z, z.gy);
    KHQ.pilot = null;
    return;
  }
  if (z && d > KHQ_RULES.pilotFar) { removeZombie(z); KHQ.pilot = null; return; }
  if (!z && d < KHQ_RULES.pilotNear && (player.layer | 0) === 0 && G.state === 'playing') {
    // il sort du sable de l'autre côté du bassin
    const a = Math.atan2(player.pos.z - O.z, player.pos.x - O.x) + Math.PI + rand(-0.5, 0.5);
    const x = O.x + Math.cos(a) * (O.rx + 9), zz = O.z + Math.sin(a) * (O.rz + 9), cx = Math.floor(x), cz = Math.floor(zz);
    if (!owWalkCell(0, cx, cz)) return;
    const y = owGroundAt(0, x, zz);
    const e = spawnZombie({ riser: true, x, z: zz, li: 0, k: owK(0, cx, cz), zone: 3, layer: 0, y }, khHp(Math.max(1, G.round)));
    if (!e) return;
    hideZombieSlot(e.slot);
    e.type = KH_PILOTE_TYPE; e.model = 'kh_pilote'; e.pilot = true;
    e.maxHp = e.hp = khHp(Math.max(1, G.round)) * KH_PILOTE_TYPE.mult.hp;
    e.look = khLook(randomZombieLook(), e.type);
    paintZombieSlot(e.slot, e.look, ZR, 'kh_pilote');
    e.wa = a;
    if (G.roundState === 'active') G.total++;
    KHQ.pilot = e;
    HUD.hint('Le pilote erre autour du bassin : abattez-le pour la clé de contact', 3.5);
  }
}
/* Tant qu'il ne vous a pas vu (et qu'on ne lui a pas tiré dessus), il fait le tour du bassin. */
function khPilotWander(z, dt) {
  if (!z.alive || z.state === 'rise' || z.hurt) return false;
  const d = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
  if ((d < 26 && (player.layer | 0) === 0) || z.hp < z.maxHp) { z.hurt = true; return false; }
  const O = KH.oasis;
  z.wa += dt * 0.022;
  const tx = O.x + Math.cos(z.wa) * (O.rx + 9), tz = O.z + Math.sin(z.wa) * (O.rz + 9);
  const sp = 0.9;
  z.t += dt;
  z.yaw = turnTo(z.yaw, Math.atan2(tx - z.pos.x, tz - z.pos.z), 2 * dt);
  z.pos.x += Math.sin(z.yaw) * sp * dt; z.pos.z += Math.cos(z.yaw) * sp * dt;
  settleBody(z, 0.3); z.pos.y = z.gy;
  z.moving = sp; z.state = 'chase'; z.speedType = 'walk';
  animateZombie(z, dt);
  return true;
}
function khDropKey(x, z, y) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14), mat); ring.position.y = 0.06; g.add(ring);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.008), mat); blade.position.y = -0.02; g.add(blade);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.006), new THREE.MeshStandardMaterial({ color: 0xa8432a, roughness: 0.8 })); tag.position.set(0.08, 0.08, 0); g.add(tag);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffcf86, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.9, 0.9, 1); g.add(halo);
  g.position.set(x, y + 0.35, z);
  linearizeTree(g);
  (KHQ.group || scene).add(g);
  const it = {
    kind: 'quest', x, z, y, r: 1.6,
    prompt() { return KHQ.key ? { text: 'Appuyez sur F pour prendre la clé de contact', sub: 'Pièce ③ de l’avion' } : null; },
    use() { if (!KHQ.key) return; g.parent && g.parent.remove(g); KHQ.key = null; khTake('key'); const i = Features.interactables.indexOf(it); if (i >= 0) Features.interactables.splice(i, 1); },
  };
  Features.interactables.push(it);
  KHQ.key = { g, it };
  HUD.hint('Le pilote a lâché la clé de contact', 3);
}

/* ---- Le Gardien : réveillé à l'autel ; sa mort ouvre la fenêtre de 4 minutes */
function khWakeGardien() {
  for (const s of KHSAN.statues) for (const m of s.eyes) m.material.color.setHex(0x5ff2e2);
  HUD.banner('Le Gardien s’éveille', 'Ses fissures s’allument après chaque coup de sceptre : tirez à ce moment-là', 'warn');
  const e = khGardienSpawn(2120, 1222, 'arena');
  if (e) e.yaw = 0;
  khGardienSound('roar', { x: 2120, z: 1222 });
}
function khQuestOnGardien() {
  KHQ.escape = null; KHQ.fail = 0;
}
/* ---- Évasion : démarrer les moteurs (F maintenue), tenir 60 s, décoller (pendant le calme) */
function khEscapePrompt() {
  if (!KHQ.ready) return null;
  if (KHQ.escape && KHQ.escape.t >= KHQ_RULES.start) return { text: 'Maintenez F pour décoller', sub: 'Les moteurs tournent : on part !' };
  if (KHQ.escape) return { text: `Démarrage des moteurs… ${Math.max(0, Math.ceil(KHQ_RULES.start - KHQ.escape.t))} s`, disabled: true, sub: 'Défendez l’avion' };
  if (!(KHG.dead && KHS.calmT > 0)) return { text: 'Impossible de décoller dans la tempête : abattez d’abord le Gardien (sanctuaire)', disabled: true };
  return { text: 'Maintenez F pour démarrer les moteurs', sub: `60 s de démarrage à tenir · calme : ${khClock(KHS.calmT)}` };
}
function khEscapeHold(dt) {
  if (!KHQ.ready || KHQ.won) return;
  if (KHQ.escape && KHQ.escape.t >= KHQ_RULES.start) { KHQ.goT = (KHQ.goT || 0) + dt; if (KHQ.goT >= 0.6) khVictory(); return; }
  if (KHQ.escape || !(KHG.dead && KHS.calmT > 0)) return;
  KHQ.startT = (KHQ.startT || 0) + dt;
  if (KHQ.startT < 1) return;
  KHQ.startT = 0;
  KHQ.escape = { t: 0 };
  HUD.banner('Démarrage des moteurs', 'Tenez 60 s : les morts accourent au bruit', 'warn');
  // le bruit des moteurs : les morts accourent
  if (G.roundState !== 'active') startRound(G.round + 1);
  G.total = Math.max(G.total, G.spawned + 36); G.spawnDelay = Math.min(G.spawnDelay, 0.7);
  khPlaneSound(true);
}
const khClock = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---- Chaque image */
function khQuestUpdate(dt) {
  // batterie : en charge dès que le courant est rétabli
  if (G.power && KHQ.charge < 1 && !KHQ.have.battery && !KHQ.placed.battery) {
    const c0 = KHQ.charge;
    KHQ.charge = Math.min(1, KHQ.charge + dt / KHQ_RULES.charge);
    if (c0 < 1 && KHQ.charge >= 1) HUD.hint('La batterie de démarrage est chargée (centrale du Nil)', 3);
    if (Math.floor(c0 * 20) !== Math.floor(KHQ.charge * 20)) khQuestLook();
  }
  khPilotTick(dt);
  // fragments : visibles en tempête seulement ; les tombes brillent
  const t = OW.t;
  for (const F of KHQ.fragMeshes || []) {
    const on = KHS.on && !KHQ.frags[F.i];
    F.fr.visible = on;
    F.door.material.opacity = on ? 0.55 + 0.25 * Math.sin(t * 3 + F.i) : 0;
    if (on) { F.shard.rotation.y += dt * 1.2; F.fr.position.y += Math.sin(t * 2 + F.i) * 0.002; }
  }
  if (KHQ.key) { KHQ.key.g.rotation.y += dt * 2; }
  // évasion : 60 s de démarrage (le compte s'arrête si on s'éloigne de l'avion), puis décoller
  const E = KHQ.escape, A = KH.places.G.plane;
  if (E && !KHQ.won) {
    const d = Math.hypot(player.pos.x - A.x, player.pos.z - A.z);
    if (d < 70 && (player.layer | 0) === 0) E.t += dt;
    else if (!E.warnT || G.time - E.warnT > 6) { E.warnT = G.time; HUD.hint('Revenez à l’avion : le démarrage attend', 2.5); }
    if (E.t >= KHQ_RULES.start && !E.done) { E.done = true; HUD.banner('Les moteurs tournent', 'Maintenez F à la porte du poste de pilotage pour décoller', 'power'); }
    // le calme est fini avant le décollage : la tempête revient, le Gardien se reforme
    if (KHS.calmT <= 0 && KHG.dead) {
      KHQ.escape = null; KHG.dead = false; KHQ.fail++;
      khPlaneSound(false);
      HUD.banner('Trop tard', 'La tempête revient : il faudra abattre le Gardien de nouveau', 'warn');
      khStormStart();
    }
  }
  if (KHG.dead && KHS.calmT <= 0 && !KHQ.escape && !KHQ.won) KHG.dead = false;       // le calme passé, le Gardien se reforme
  for (const h of KHQ.props || []) h.rotation.x += dt * (KHQ.escape ? Math.min(40, 4 + (KHQ.escape.t || 0) * 2) : 0);
  if (KHQ.escape) khPlaneSound(true, clamp(KHQ.escape.t / 20, 0, 1));
  khObjectivesHud(dt);
}

/* ---- Objectifs (à gauche, sous le nom du lieu) */
function khObjectives() {
  const L = [], done = (b) => (b ? '✓' : '·');
  for (const p of KHQ_PARTS) {
    if (KHQ.placed[p.id]) continue;
    const extra = p.id === 'battery' && !KHQ.have.battery ? (G.power ? ` (${Math.round(KHQ.charge * 100)} %)` : ' · courant d’abord') : '';
    L.push([KHQ.have[p.id] ? '►' : '·', `${p.n} ${p.name}${KHQ.have[p.id] ? ' : à poser sur l’avion' : ` · ${p.where}`}${extra}`]);
  }
  const placed = KHQ_PARTS.filter((p) => KHQ.placed[p.id]).length;
  if (!KHQ.ready) L.push([done(false), `Réparer l’avion (${placed}/3) · aérodrome`]);
  else if (!(KHG.dead && KHS.calmT > 0) && !KHQ.escape) L.push(['►', 'Abattre le Gardien · autel du sanctuaire']);
  if (KHG.dead && KHS.calmT > 0 && !KHQ.won) {
    if (!KHQ.escape) L.push(['►', `Démarrer l’avion · calme ${khClock(KHS.calmT)}`]);
    else if (KHQ.escape.t < KHQ_RULES.start) L.push(['►', `Tenir pendant le démarrage : ${khClock(KHQ_RULES.start - KHQ.escape.t)} · calme ${khClock(KHS.calmT)}`]);
    else L.push(['►', `Décoller ! · calme ${khClock(KHS.calmT)}`]);
  }
  const nf = KHQ.frags.filter(Boolean).length;
  if (!KHQ.sceptre) L.push(['·', `Sceptre du Gardien (${nf}/3, optionnel) · nécropole, en tempête`]);
  return L;
}
function khObjectivesHud(dt) {
  if (!KHQ.hud) {
    const hud = $('hud');
    const b = el('div', 'kh-quest');
    Object.assign(b.style, { position: 'absolute', left: 'calc(26px + env(safe-area-inset-left, 0px))', top: 'calc(62px + env(safe-area-inset-top, 0px))', maxWidth: 'min(430px, 44vw)', pointerEvents: 'none',
      font: `600 13px/1.45 ${FONT_HUD}`, letterSpacing: '0.04em', color: '#f5e6cf', textShadow: '0 1px 0 rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)' });
    hud.append(b);
    KHQ.hud = b;
  }
  KHQ.hud.hidden = !OW.on || G.state !== 'playing' || KHQ.won;
  if (KHQ.hud.hidden) return;
  KHQ.hudT = (KHQ.hudT || 0) - dt;
  if (KHQ.hudT > 0) return;
  KHQ.hudT = 0.5;
  const L = khObjectives(), key = L.map((l) => l.join(' ')).join('|');
  if (key === KHQ.hudKey) return;
  KHQ.hudKey = key;
  KHQ.hud.innerHTML = `<div style="font-size:11px;letter-spacing:0.22em;color:#e9884d">SORTIR DU KHAMSIN</div>` + L.map(([m, t]) => `<div><span style="display:inline-block;width:1.2em;color:${m === '►' ? '#5ff2e2' : '#c8b490'}">${m}</span>${t}</div>`).join('');
}
/* Repères de la quête sur la mini-carte : pièces à prendre, avion, pilote, fragments (en tempête). */
function khQuestMapMarks(g, X, Z, S) {
  const mark = (x, z, col, txt) => {
    const px = X(x), pz = Z(z);
    if (px < -8 || pz < -8 || px > S + 8 || pz > S + 8) return;
    g.fillStyle = col; g.strokeStyle = '#120e0b'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, pz, 6, 0, TAU); g.fill(); g.stroke();
    if (txt) { g.fillStyle = '#120e0b'; g.font = `700 9px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, px, pz + 0.5); }
  };
  const P = KH.places;
  if (!KHQ.have.fuel && !KHQ.placed.fuel) { const q = owPt(P.C.fuelTank.node, P.C.fuelTank.x, 0, P.C.fuelTank.z); mark(q.x, q.z, '#f5c88d', '1'); }
  if (!KHQ.have.battery && !KHQ.placed.battery) { const q = owPt(P.E.battery.node, P.E.battery.x, 0, P.E.battery.z); mark(q.x, q.z, G.power ? '#f5c88d' : '#8a7a64', '2'); }
  if (KHQ.pilot && KHQ.pilot.alive) mark(KHQ.pilot.pos.x, KHQ.pilot.pos.z, '#e2402a', '3');
  if (KHQ.key) mark(KHQ.key.g.position.x, KHQ.key.g.position.z, '#f5c88d', '3');
  if (!KHQ.ready || (KHG.dead && KHS.calmT > 0)) mark(P.G.plane.x, P.G.plane.z, '#5fa8ff', '✈');
  if (KHS.on) for (const F of KHQ.fragMeshes || []) if (!KHQ.frags[F.i]) mark(F.fr.position.x, F.fr.position.z, '#5ff2e2', '');
}

/* ---- Victoire : l'avion roule et décolle (vue de côté), puis l'écran de fin */
function khVictory() {
  if (KHQ.won) return;
  KHQ.won = true;
  KHQ.cine = { t: 0 };
  clearZombies();
  G.roundState = 'pre'; G.roundT = 1e9;
  HUD.el.hud.hidden = true;
  Arms.root.visible = false;
  KHP.busy = 99;
  store.set('zs.khamsin.wins', (store.get('zs.khamsin.wins', 0) | 0) + 1);
}
/* Caméra et avion pendant le décollage (appelé après la mise à jour du joueur). */
function khVictoryCam(dt) {
  const C = KHQ.cine;
  if (!C) return;
  C.t += dt;
  const A = KH.places.G.plane, plane = KH.places.G.planeGroup;
  const t = C.t, acc = 9, s = 0.5 * acc * Math.min(t, 7) ** 2 + Math.max(0, t - 7) * acc * 7;     // distance parcourue
  const lift = Math.max(0, t - 5.2), h = lift * lift * 2.2 + lift * 3;
  if (plane) {
    plane.position.set(A.x - s, A.y + h, A.z);
    plane.rotation.z = -clamp(lift * 0.12, 0, 0.22);     // nez vers le haut (le nez est vers -x)
    plane.updateMatrixWorld(true);
    for (const p of KHQ.props) { p.position.x = A.x - 4.2 - s; p.position.y = A.y + 2.6 + 1.45 - 0.55 + h; p.rotation.x += dt * 60; }
  }
  const px = A.x - s, py = A.y + 3 + h;
  camera.position.set(A.x - 60, A.y + 4 + Math.min(h * 0.4, 12), A.z + 32);
  camera.lookAt(px, py, A.z);
  khPlaneSound(true, 1);
  Arms.root.visible = false; HUD.el.hud.hidden = true;
  if (t > 6.5 && !C.faded) { C.faded = true; khFade(true, 1.2); }
  if (t > 8 && !C.done) {
    C.done = true;
    khPlaneSound(false);
    KHP.busy = 0;
    G.state = 'playing';
    gameOver();
    renderer.domElement.classList.remove('downed');
    $('go-title').textContent = 'Évasion réussie';
    $('go-rounds').textContent = `Vous avez quitté le Khamsin à la manche ${Math.max(1, G.round)}`;
    setTimeout(() => khFade(false, 0.6), 1700);
  }
}
/* Moteurs de l'avion (synthétisés) : montée en régime au démarrage. */
function khPlaneSound(on, k = 0) {
  const bus = Sound.bus();
  if (!bus) return;
  if (!on) { if (KHQ.snd) { const S = KHQ.snd; S.out.gain.setTargetAtTime(0, S.ctx.currentTime, 0.4); setTimeout(() => { try { S.o1.stop(); S.o2.stop(); S.n.stop(); } catch (e) { /* déjà arrêté */ } }, 1500); KHQ.snd = null; } return; }
  if (!KHQ.snd) {
    const ctx = bus.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(bus.sortie);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g1 = ctx.createGain(), g2 = ctx.createGain(); g1.gain.value = 0.3; g2.gain.value = 0.12;
    o1.connect(g1); o2.connect(g2); g1.connect(lp); g2.connect(lp); lp.connect(out);
    const n = ctx.createBufferSource(), len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.08; n.connect(nf); nf.connect(ng); ng.connect(out);
    o1.start(); o2.start(); n.start();
    KHQ.snd = { ctx, out, o1, o2, n, lp };
  }
  const S = KHQ.snd, t = S.ctx.currentTime, A = KH.places.G.plane, d = KHQ.cine ? 20 : Math.hypot(player.pos.x - A.x, player.pos.z - A.z);
  const f = 38 + k * 46;
  S.o1.frequency.setTargetAtTime(f, t, 0.3); S.o2.frequency.setTargetAtTime(f * 2.02, t, 0.3);
  S.lp.frequency.setTargetAtTime(400 + k * 900, t, 0.3);
  S.out.gain.setTargetAtTime(clamp(1.2 - d / 120, 0, 1) * (0.12 + k * 0.16), t, 0.25);
}

/* ---- Sauvegarde, remise à zéro */
function khSerialize() {
  if (OW.worldId === 'lune') return { lu: luSerialize() };   // Lune : oxygène, dépôt, pièces de l'atterrisseur
  return {
    have: { ...KHQ.have }, placed: { ...KHQ.placed }, ready: KHQ.ready, sceptre: KHQ.sceptre, frags: KHQ.frags.slice(), charge: KHQ.charge,
    veh: VEH.list.map((V) => ({ x: +V.x.toFixed(2), z: +V.z.toFixed(2), yaw: +V.yaw.toFixed(3), fuel: Math.round(V.fuel), bought: V.bought })),
    pyr: khPyrSave(),                                    // jeu 2.0.3 : herses des pyramides ouvertes
  };
}
function khRestore(s) {
  if (OW.worldId === 'lune') { if (s.lu) luRestore(s.lu); return; }
  try {
    for (const p of KHQ_PARTS) { KHQ.have[p.id] = !!(s.have && s.have[p.id]); KHQ.placed[p.id] = !!(s.placed && s.placed[p.id]); }
    KHQ.ready = KHQ_PARTS.every((p) => KHQ.placed[p.id]);
    KHQ.frags = [0, 1, 2].map((i) => !!(s.frags && s.frags[i]));
    KHQ.sceptre = KHQ.frags.every(Boolean);
    KHQ.charge = clamp(+s.charge || 0, 0, 1);
    (s.veh || []).forEach((v, i) => {
      const V = VEH.list[i];
      if (!V || !Number.isFinite(v.x) || !Number.isFinite(v.z)) return;
      V.x = v.x; V.z = v.z; V.yaw = v.yaw || 0; V.fuel = clamp(v.fuel | 0, 0, V.T.fuel); V.bought = !!v.bought || !V.T.cost;
      vehPose(V, 0, true);
    });
    if (G.power && KHSAN.door) { const D = KHSAN.door; OW.doors[D.i].open = true; D.slab.position.y = D.y - 3.25; D.opening = false; }
    khPyrRestore(s.pyr);
    khQuestLook();
  } catch (e) { console.warn('Khamsin : sauvegarde illisible', e); }
}
function khQuestReset() {
  for (const p of KHQ_PARTS) { KHQ.have[p.id] = false; KHQ.placed[p.id] = false; }
  KHQ.ready = false; KHQ.sceptre = false; KHQ.frags = [false, false, false]; KHQ.charge = 0;
  KHQ.escape = null; KHQ.won = false; KHQ.fail = 0; KHQ.cine = null; KHQ.fillT = KHQ.placeT = KHQ.wakeT = KHQ.startT = KHQ.goT = 0;
  if (KHQ.pilot && !KHQ.pilot.removed) removeZombie(KHQ.pilot);
  KHQ.pilot = null;
  if (KHQ.key) { KHQ.key.g.parent && KHQ.key.g.parent.remove(KHQ.key.g); const i = Features.interactables.indexOf(KHQ.key.it); if (i >= 0) Features.interactables.splice(i, 1); KHQ.key = null; }
  const pg = KH.places.G && KH.places.G.planeGroup;
  const A = KH.places.G && KH.places.G.plane;
  if (pg && A) { pg.position.set(A.x, A.y, A.z); pg.rotation.set(0, 0, 0); pg.updateMatrixWorld(true); }
  if (A) for (const p of KHQ.props || []) { p.position.x = A.x - 4.2; p.position.y = A.y + 2.6 + 1.45 - 0.55; }
  khPlaneSound(false);
  if (KHQ.hud) KHQ.hudKey = '';
  for (const s of KHSAN.statues) for (const m of s.eyes) m.material.color.setHex(0x0c1412);
  khQuestLook();
}
