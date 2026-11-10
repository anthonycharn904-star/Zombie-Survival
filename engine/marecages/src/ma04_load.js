
/* ------------------------------------------------------------ Chargement --
   Même déroulé que la Lune (luLoad) : base, relief retouché par les Mod Tools, terrain, ciel, eau,
   lieux (bâtiments, pontons, pierres), végétation, éléments de la carte (armes, atouts, boîte,
   barques, disjoncteurs, Le Glas), lumières, la bête. */
function maLoad(map, opts = {}) {
  // restes de Khamsin (owLoad n'appelle pas owUnload entre deux mondes ouverts) : tempête, faisceau, Gardien
  if (KHS.snd) KHS.snd.g.gain.value = 0;
  for (const m of KHS.walls ? KHS.walls.meshes : []) m.visible = false;
  if (KHS.streaks) KHS.streaks.mesh.visible = false;
  if (KHE.pts) KHE.pts.visible = false;
  KHSAN.under = false; if (KHP.el) khFade(false, 0.01);
  if (KHG.R) { KHG.R.root.visible = false; KHG.tornado.group.visible = false; } KHG.e = null; khBossBar(null);
  if (KHQ.hud) KHQ.hud.hidden = true; khPlaneSound(false); KHT.ride = null; KHSAN.view = 'surface';
  OW.beam = null; OW.mapMode = null; ZONE.circles = []; OW.stormVmax = 0; OW.stormDark = 0; OW.sandWall = null;
  owUseBase(map.base);
  // kit MM 2.1.5 : les tronçons de route d'un autre monde ouvert (Khamsin, la Lune) restaient listés ; dans le
  // marais (pas de routes de base), owUpdateRoads les cherchait dans des morceaux de terrain qui n'existent
  // plus : erreur à chaque passage, la suite de la mise à jour du marais (lumières, brume) ne se faisait plus
  OW.roadParts = [];
  const places = owBaseHasPlaces();
  if (!map.menuCam) map.menuCam = { pos: [455, 3.2, 812], look: [528, 3.5, 700], sway: [3, 1.2], auto: true };
  owBoxRelease();
  owLogUndoAll();
  registerCustomModels(map);
  registerCustomTextures(map);
  KHS.every = 0;                                       // pas de tempête de sable dans le marais
  if (!opts.editor) OWMOD.live = false;
  if (owModsActive(map) || OWMOD.on) { owApplyMods(map); OWH.bg = null; }
  else OW.roadsUser = [];
  OW.locsShown = owNamedLocs(map);
  const root = new THREE.Group();
  root.name = 'monde';
  owBuildTerrainChunks(root);
  for (const ch of OWTER.chunks) ch.mesh.material = maTerrainMat();
  owBuildUserRoads(root);
  maBuildSky(root);
  OWL.lamps = [];
  OW.placesRoot = root;
  if (places) { maBuildPlaces(root); owItemsWrite(); }
  else { owItemsBegin(); MA_PL.docks = {}; MA_PL.spots = {}; MA_PL.lamps = []; }
  maHooksReset();
  maBuildNature(root, places);
  owLightsInit(root);
  owBuildElements(root, map, { perProp: !!opts.editor });
  World.root = root;
  linearizeTree(root);
  scene.add(root);
  // après la conversion des couleurs : l'eau (couleurs déjà linéaires), la brume, les feux follets
  maBuildWater(root);
  maBuildMist(root);
  maBuildWisps(root);
  maFxInit(root);
  maNoyeGlowInit(root);                                // kit MM 2.1.6 : yeux des Noyés (dans la scène dès le chargement : précompilés)
  maStrygeFxInit(root);                                // kit 2.0.7 : yeux et traînées des Stryges (même chose)
  if (!opts.editor) maArrInit(root);                    // kit 2.0.7 : l'arrivée des Stryges (plumes, ondes, lueurs ; ma19)
  // kit 2.0.7 : la pluie (rideau, impacts, sons calculés), le temps qu'il fait, l'orage (éclairs, brûlures :
  // précompilés aussi) ; pas dans l'éditeur des Mod Tools
  maWxUnload();
  MA.wxErr = false; MA.arrErr = false;
  if (!opts.editor) { maStormInit(root); maWxInit(root); }
  for (const p of FX.sprites || []) maHFogLite(p.s.material);    // kit MM 2.1.5 : fumées et gerbes sans les bancs de brume
  // kit MM 2.1.4 : les sillages des barques existent dès le chargement (leur matière est compilée avec le
  // reste) : créés au premier départ d'une barque, ils compilaient un shader en pleine partie
  for (const V of VEH.list) if (V.T.boat) maWakeFor(V).mesh.visible = false;
  owSandPool();
  camera.near = 0.1; camera.far = 2600; camera.updateProjectionMatrix();
  OW.lastLoc = null;
  owHud(!opts.editor);
  OWNAV.ready = false;
  Zombies.flowT = 0; Zombies.lastCell = -1;
  owShadows();
  owUpdateTerrainLod(true);
  MA.dread = 0;
  maApplyLight();
  maHFogUpdate(0);
  maSkyFollow();
  if (!opts.editor && places) maBeastInit(root);
  if (!opts.editor) { maMudPool(); maPrewarm(); try { maWxSelfTest(); } catch (e) { maErr('marais : test du rendu de la pluie', e); } }
  maDiagInstaller();                                    // diagnostic (ma11) : seulement s'il est permis
}
/* Kit MM 2.1.4 : tout compiler au chargement. Une matière se compile (son shader) au premier rendu qui la
   montre, et une lumière qui apparaît ou disparaît fait recompiler toutes les matières éclairées. En pleine
   partie, cela gelait l'image (la bête qui se réveille : 24 shaders, plus de 6 s sur la machine de test ;
   la ruée, l'épave, les embruns) et le pilote graphique pouvait y perdre le contexte WebGL (jeu figé ou
   planté). Ici, au chargement : toutes les matières de la scène, avec les lumières de la partie, puis une
   image avec la bête devant la caméra (ses ombres). Le nombre de lumières ne change plus ensuite. */
function maPrewarm() {
  if (typeof renderer === 'undefined' || !renderer || !renderer.compile) return;
  const t0 = performance.now(), info = renderer.info, p0 = info.programs ? info.programs.length : 0;
  try {
    renderer.compile(scene, camera);
    const o = MAB.obj;
    if (o && MAB.mv && o.parent) {
      const vis = o.visible, px = o.position.x, py = o.position.y, pz = o.position.z;
      const d = camera.getWorldDirection(new THREE.Vector3());
      o.position.set(camera.position.x + d.x * 25, MA.water - 1.5, camera.position.z + d.z * 25);
      o.visible = true; o.updateMatrixWorld(true);
      renderer.render(scene, camera);
      o.visible = vis; o.position.set(px, py, pz); o.updateMatrixWorld(true);
    }
  } catch (e) { console.warn('marais : précompilation', e); }
  MA.prewarm = { ms: Math.round(performance.now() - t0), programs: (info.programs ? info.programs.length : 0) - p0 };
}
/* Retour à une autre carte : sons du marais, bête, nage. */
function maUnload() {
  if (MA_DIAG.on) maDiagToggle(false);                  // le panneau de diagnostic ne sert que dans le marais
  maNoyesReset();
  maStrygesReset();
  maSwimEnd(true);
  maBeastUnload();
  maWreckClear();
  maBlackoutClear();
  maAmbStop();
  maWxUnload();                                         // kit 2.0.7 : la pluie et l'orage se taisent
  MA.dread = 0; MA.inside = 0;
  maHFogOff();                                          // kit MM 2.1.5 : la nappe de brume ne suit pas dans les autres cartes
  if (MA.drops && MA.drops.points.parent) MA.drops.points.parent.remove(MA.drops.points);
  if (MA.spray && MA.spray.points.parent) MA.spray.points.parent.remove(MA.spray.points);
  if (MA.mudFX && MA.mudFX.points.parent) MA.mudFX.points.parent.remove(MA.mudFX.points);
  if (MA.hudEl) MA.hudEl.hidden = true;
  Sound.setMuffle(false);
}

/* ------------------------------------------------------------ Chaque image -- */
function maUpdateView(dt) {
  if (!OW.on) return;
  OW.t += dt;
  maSkyFollow();
  OWTER.t -= dt;
  if (OWTER.t <= 0) { OWTER.t = 0.1; maTerrainLod(); owUpdateRoads(); }
  owLightsUpdate(dt);
  if (MA.waterU) MA.waterU.uT.value = OW.t;
  maWaterHulls();                                       // kit 2.0.7 : pas d'eau dans les coques
  // kit 2.0.7 : l'arrivée des Stryges (avant la météo : la lumière de leur éclair est prise dans la même image)
  if (!MA.arrErr) { try { maArrUpdate(dt); } catch (e) { MA.arrErr = true; maErr('marais : arrivée des Stryges', e); } }
  // kit 2.0.7 : la pluie, l'orage (avant la brume et la lumière) ; une erreur ici ne doit pas arrêter le reste du marais
  if (!MA.wxErr) {
    try { maWxUpdate(dt); } catch (e) {
      MA.wxErr = true; maErr('marais : la météo est arrêtée', e);
      try { maWxAudioStop(); if (MA_WX.rain) MA_WX.rain.mesh.visible = false; if (MA_WX.splash) MA_WX.splash.pts.visible = false; } catch (e2) { /* rien */ }
    }
  }
  maDropsUpdate(dt);
  maHFogUpdate(dt);
  maMistUpdate(dt);
  maWispsUpdate(dt);
  maNatureUpdate(dt);
  maApplyLight();
  maBlackoutUpdate(dt);
  if (G.state !== 'playing') {
    // menu, fin de partie : la bête rôde au loin dans le menu (les leurres dans la brume)
    if (G.state === 'menu') maBeastMenu(dt);
    maAmbUpdate(dt, true);
  }
}
/* Niveau de détail du terrain (kit MM 2.1.4) : comme owUpdateTerrainLod, mais un seul morceau fin construit
   par passage, deux fois plus souvent. En barque, la caméra file : deux morceaux d'un coup faisaient un
   à-coup de 10 à 30 ms sur la machine de test. */
function maTerrainLod() {
  const cx = camera.position.x, cz = camera.position.z, L = owLodDistances(), S = OWTER.size;
  let built = 0;
  for (const ch of OWTER.chunks) {
    const dx = Math.max(ch.x0 - cx, 0, cx - (ch.x0 + S)), dz = Math.max(ch.z0 - cz, 0, cz - (ch.z0 + S));
    const d = Math.hypot(dx, dz), lod = d < L[0] ? 0 : d < L[1] ? 1 : d < L[2] ? 2 : 3;
    if (lod === ch.lod) continue;
    if (!ch.geo[lod]) {
      if (lod <= 1 && built >= 1) continue;
      ch.geo[lod] = owChunkGeometry(ch, owLodStep(lod));
      built++;
    }
    ch.mesh.geometry = ch.geo[lod];
    ch.lod = lod;
    for (let l = 0; l < 2; l++) if (l < lod - 1 && ch.geo[l]) { ch.geo[l].dispose(); ch.geo[l] = null; }
  }
}
function maUpdate(dt) {
  maUpdateView(dt);
  if (OW.sandFX) OW.sandFX.update(dt);
  owVehUpdate(dt);
  maWreckUpdate(dt);
  maPlayerWater(dt);
  maBoatExitCam(dt);
  maThreatUpdate(dt);
  maBeastUpdate(dt);
  maNoyesUpdate(dt);                                    // kit MM 2.1.6 : les Noyés (après la barque : ils s'y agrippent)
  maStrygesUpdate(dt);                                  // kit 2.0.7 : les Stryges (après la barque : elles visent le barreur)
  maAmbUpdate(dt, false);
  maHooksUpdate(dt);
  // nom du lieu en entrant
  const near = owNearestNamed(player.pos.x, player.pos.z);
  const inside = near && near.d < 0 ? near.loc : null;
  if (inside && inside !== OW.lastLoc) { HUD.zone(inside.name); maEmit('ile', { id: inside.id, nom: inside.name }); }
  OW.lastLoc = inside || (!near || near.d > 30 ? null : OW.lastLoc);
  owUpdateHud(dt);
}
/* Gouttes : chute, puis elles crèvent la surface (petit rond) au lieu de couler jusqu'au fond. */
function maDropsUpdate(dt) { maPoolUpdate(MA.drops, dt); maPoolUpdate(MA.spray, dt); }
function maPoolUpdate(P, dt) {
  if (!P || !P.active) return;
  let any = 0, rips = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) continue;
    const k = i * 3;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.pos[k + 1] = -100; continue; }
    any = 1;
    P.vel[k + 1] -= 9.8 * dt;
    P.pos[k] += P.vel[k] * dt; P.pos[k + 1] += P.vel[k + 1] * dt; P.pos[k + 2] += P.vel[k + 2] * dt;
    const g = Math.max(MA.water, owGroundAt(0, P.pos[k], P.pos[k + 2]));
    if (P.pos[k + 1] < g && P.vel[k + 1] < 0) {
      if (g <= MA.water + 0.01 && rips < 3 && Math.random() < 0.25) { maRipple(P.pos[k], P.pos[k + 2], 0.006); rips++; }
      P.life[i] = 0; P.pos[k + 1] = -100;
    }
  }
  P.geo.attributes.position.needsUpdate = true;
  P.active = any;
}

/* ------------------------------------------------- Partie : remise à zéro -- */
function maResetWorld() {
  maSwimEnd(true);
  maHooksReset();
  maThreatReset();
  maBeastReset();
  MA.dread = 0;
  MA.mudHint = false; MA.mudT = 0;
  maWreckClear();
  maBlackoutClear();
  maNoyesReset();
  maStrygesReset();
  maWxReset();                                          // kit 2.0.7 : nouvelle partie : temps sec, puis la première averse (avec orage)
  // kit MM 2.1.4 : la voix de la bête prête dès le début (bruits et réverbération calculés : 50 à 100 ms au
  // premier signe, en pleine traversée, sinon)
  maBeastSnd();
  // kit MM 2.1.1 : la bête n'a pas pu se charger → on le dit (le détail : F8)
  if (!MAB.mv && MAB.err && OW.on && OW.worldId === 'marais') setTimeout(() => { if (G.state === 'playing') HUD.hint('La Mère-Vase n’a pas pu se charger : F8 pour le détail', 8); }, 1500);
}
function maOnRound(n) {
  // la bête s'enhardit de manche en manche (réglage : MA_CFG.roundK)
  if (n >= 2) maEmit('manche', { n });
}
function maSerialize() {
  return {
    veh: VEH.list.map((V) => V.wrecked ? { x: V.sp.x, z: V.sp.z, yaw: V.sp.yaw, fuel: Math.round(V.T.fuel), hull: 100, cap: false }
      : { x: +V.x.toFixed(2), z: +V.z.toFixed(2), yaw: +V.yaw.toFixed(3), fuel: Math.round(V.fuel), hull: Math.round(V.hull || 100), cap: !!V.capsized }),
    menace: Math.round(MAM.attn || 0), bete: maBeastSave(),
  };
}
function maRestore(s) {
  if (!s) return;
  try {
    (s.veh || []).forEach((v, i) => {
      const V = VEH.list[i];
      if (!V || !Number.isFinite(v.x) || !Number.isFinite(v.z)) return;
      V.x = v.x; V.z = v.z; V.yaw = v.yaw || 0; V.fuel = clamp(v.fuel | 0, 0, V.T.fuel);
      if (V.T.boat) { V.hull = clamp(+v.hull || 100, 1, 100); V.capsized = false; V.wrecked = false; V.group.visible = true; }
      vehPose(V, 0, true);
    });
    MAM.attn = clamp(+s.menace || 0, 0, 60);
    maBeastLoad(s.bete);
  } catch (e) { console.warn('marais : sauvegarde', e); }
}

/* ------------------------------------------------------------ Zombies --
   Les noyés du marais : pêcheurs, ouvriers de la station, gens du bourg (modèles des Desséchés,
   teintes de vase et de chair gorgée d'eau, yeux jaune pâle). Ils sortent de la vase ou de l'eau
   peu profonde, près de l'île du joueur (jamais sur une île qu'ils ne peuvent pas rejoindre). */
const MA_EYE_LIN = new THREE.Color(0xd8e06a).convertSRGBToLinear().getHex();
const maZombieType = () => { const x = Math.random(); return KH_TYPES[x < 0.45 ? 1 : x < 0.8 ? 2 : 0]; };
function maLook(look, type) {
  look.eyes = MA_EYE_LIN;
  look.skin = pick([0xb8c4ae, 0xa8b49c, 0xc0c8b4, 0x9ca690]);
  look.cloth = pick([0x7a7c66, 0x6c6e5a, 0x8a8670, 0x5e6250]);
  look.helmet = false;
  return look;
}
function maSpeedType(r) {
  const x = Math.random();
  if (r < 4) return 'walk';
  if (r < 8) return x < 0.4 ? 'walk' : x < 0.75 ? 'jog' : 'run';
  return x < 0.15 ? 'walk' : x < 0.45 ? 'jog' : 'run';
}
/* Point de sortie : à pied, 16 à 38 m, sur la terre ou dans l'eau peu profonde, joignable (champ de
   flux). Kit MM 2.1.6 : sur l'eau (barque, nage), aucun : ce sont les Noyés (ma15) ; les zombies ordinaires
   reviennent quand on prend pied (ceux qui sont déjà sortis attendent sur la rive). Avant, ils sortaient
   sur l'île vers laquelle allait la barque. */
function maPickSpawn() {
  const p = player, others = Zombies.list.filter((z) => z.alive && z.state === 'rise');
  if (maPlayerOnWater()) return null;
  for (let tries = 0; tries < 36; tries++) {
    const behind = Math.random() < 0.6;
    const a = p.yaw + Math.PI + (behind ? rand(-1.7, 1.7) : rand(-Math.PI, Math.PI));
    const d = rand(16, 38);
    const x = p.pos.x - Math.sin(a) * d, z = p.pos.z - Math.cos(a) * d;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (owKind(OW.surf, cx, cz) !== OWK.TERRAIN || !owWalkCell(0, cx, cz)) continue;
    const g = owGroundAt(0, x, z);
    if (Math.abs(g - p.gy) > 6) continue;
    if (OWNAV.ready && owFlowAt(owK(0, cx, cz)) > 70) continue;          // pas joignable d'ici
    if (others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 3)) continue;
    const near = khNearestLoc(x, z);
    return { riser: true, x, z, li: 0, k: owK(0, cx, cz), zone: OW.locs.indexOf(near.loc), layer: 0, y: Math.max(g, MA.water - 0.6) };
  }
  return null;
}
/* Les zombies ne sont pas recyclés pendant que le joueur est sur l'eau : ils l'attendent sur la rive. */
const maHoldZombies = () => OW.on && OW.worldId === 'marais' && maPlayerOnWater();
/* Marcher dans le marais. Kit MM 2.1.2 (Anthony, 27 octobre 2026 : « la passerelle ralentit les joueurs,
   le marais non : l'effet inverse ») : en MM 2.1.0-2.1.1, la vitesse suivait la profondeur d'eau sous la
   position, planches ou pas : sur la partie des pontons et passerelles au-dessus de l'eau, jusqu'à
   −45 % ; sur la vase, rien. Désormais :
     plancher (passerelle, ponton, maison, marches) : vitesse normale, au-dessus de l'eau comme ailleurs ;
     sol du marais (le joueur) : vase et berge détrempée −38 %, mousse −25 %, tourbe −15 % ; la pierre, rien ;
     eau (0,15 à 0,9 m) : le joueur au moins autant que dans la vase, jusqu'à −45 % ; les zombies de 0 à −45 %.
   Les zombies ne sont pas ralentis par le sol (comme la boue d'Origins : le marais est le détour,
   les passerelles le chemin). Réglages : MA_SOIL_K. */
const MA_SOIL_K = { [OWB.MUD]: 0.62, [OWB.REEDS]: 0.62, [OWB.SILT]: 0.62, [OWB.MOSS]: 0.75, [OWB.PEAT]: 0.85 };
/* Sur un plancher, une marche, un bord de ponton (pas sur le sol ni dans l'eau) ? */
function maOnFloor(x, z) {
  const k = owKind(OW.surf, Math.floor(x), Math.floor(z));
  return k !== OWK.TERRAIN && k !== OWK.WATER;
}
/* Dans l'eau (zombies et joueur) : 1 sur un plancher ou hors de l'eau. */
function maWadeK(x, z) {
  if (maOnFloor(x, z)) return 1;
  const d = maDepth(x, z);
  return d < 0.15 ? 1 : 1 - 0.45 * owSmoothstep(0.15, 0.85, d);
}
/* Le joueur : l'eau et le sol du marais. */
function maWalkK(x, z) {
  if (maOnFloor(x, z)) return 1;
  const d = maDepth(x, z);
  if (d >= 0.15) return Math.min(MA_SOIL_K[OWB.MUD], 1 - 0.45 * owSmoothstep(0.15, 0.85, d));
  const k = MA_SOIL_K[owBioAt(x, z)];
  return k === undefined ? 1 : k;
}

/* ---------------------------------------------------------- Menu, astuces -- */
function maMenuTips(map) {
  for (const id of ['tip-storm', 'tip-planks', 'tip-moon', 'tip-o2']) { const e = $(id); if (e) e.hidden = true; }
  const set = (id, txt) => { const e = $(id); if (!e) return; e.hidden = !txt; if (txt) e.textContent = txt; };
  set('tip-box', `La boîte mystère (${RULES.boxCost} points) change d’île.`);
  const B = map.breakers || [];
  set('tip-power', map.rules && map.rules.powerOn ? 'Courant rétabli dès le départ.' : B.length ? `${khBreakersWord(B.length).replace(/^./, (c) => c.toUpperCase())} à la Station Héron : le courant des atouts et du Glas.` : 'Pas de courant à rétablir.');
  set('tip-veh', 'Barques : F pour monter ou descendre (au ponton), Z/S gaz, Q/D barre, C vue. En vue embarquée, on tire.');
  set('tip-swamp', 'On patauge dans les hauts-fonds ; au-delà, l’eau est profonde : on nage, lentement.');
  set('tip-beast', 'Sur l’eau, le moteur, les tirs et le temps attirent ce qui vit dessous. Traversez vite ; les hauts-fonds protègent.');
}
