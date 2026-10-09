'use strict';
/* Zombies par pièce (jeu 1.8.0), dans la fenêtre du jeu du launcher : sur Bunker 7, l'Infirmerie fait
   sortir des Savants, la salle des machines des Lacérés, l'Entrepôt des Sentinelles, la salle
   d'arrivée des Fantassins ; la Bunker 7 publiée reprend ces types ; format de carte. Modèles
   dessinés (pièces de leur modèle seulement). Le Lacéré touché aux jambes rampe (le Fantassin non) ;
   les seringues du Savant rendent 0,25 % des PV ; les chargeurs de la Sentinelle ajoutent un
   chargeur ; 3 lanternes éclairent au plus ; fiches de l'écran Modèles ; éliminations par type.
     xvfb-run -a node e2e/zone-zombies.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-pieces-'));
const USER = path.join(TMP, 'joueur');
const PUBLISHED_B7 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'bunker7-publiee-1.5.0.json'), 'utf8'));

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const report = (r) => {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
  };
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));

    // ------------------------------------------------------------ données
    (await game.evaluate((published) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const types = ZOMBIE_TYPES.map((t) => `${t.id}:${t.num}`).join(' ');
      ok(types === 'fantassin:00 lacere:00-A savant:00-C sentinelle:00-D', 'quatre fiches : Fantassin 00, Lacéré 00-A, Savant 00-C, Sentinelle 00-D', types);
      ok(ZOMBIE_TYPES.slice(1).every((t) => t.mult.hp === 1 && t.mult.speed === 1 && t.mult.damage === 1 && t.headMult === 2 && !t.helmet && t.cls === 'Variante du Fantassin' && t.from === 1),
        'variantes : mêmes PV, vitesse, dégâts et tête ×2 que le Fantassin, sans casque, dès la manche 1');
      const zoneOf = (m) => Object.fromEntries(m.zones.map((z) => [z.name, z.zombie || '-']));
      const b7 = normalizeMap(BUNKER7);
      const want = { "Salle d'arrivée": '-', 'Entrepôt': 'sentinelle', 'Infirmerie': 'savant', 'Salle des machines': 'lacere' };
      ok(JSON.stringify(zoneOf(b7)) === JSON.stringify(want), 'Bunker 7 : Infirmerie → Savant, machines → Lacéré, Entrepôt → Sentinelle, arrivée → Fantassin', zoneOf(b7));
      ok(JSON.stringify(zoneOf(normalizeMap(serializeMap(b7)))) === JSON.stringify(want), 'type de chaque pièce écrit et relu à l’identique');
      ok(published.zones.every((z) => z.zombie === undefined) && JSON.stringify(zoneOf(normalizeMap(published))) === JSON.stringify(want), 'Bunker 7 publiée (sans types) : elle reprend ceux de la carte intégrée, pièce par pièce');
      const own = JSON.parse(JSON.stringify(published));
      own.zones.find((z) => z.name === 'Infirmerie').zombie = 'fantassin';
      ok(JSON.stringify(zoneOf(normalizeMap(own))) === JSON.stringify({ ...want, 'Entrepôt': '-', 'Infirmerie': 'fantassin', 'Salle des machines': '-' }), 'une Bunker 7 qui nomme déjà un type garde ses choix (rien n’est ajouté)');
      const bad = JSON.parse(JSON.stringify(BUNKER7));
      bad.zones[1].zombie = 'dragon';
      ok(normalizeMap(bad).zones[1].zombie === undefined, 'type inconnu ignoré');
      ok(normalizeMap({ ...BUNKER7, id: 'autre' }).zones.filter((z) => z.zombie).length === 3 && normalizeMap({ ...published, id: 'autre' }).zones.every((z) => !z.zombie), 'une autre carte n’a de types que ceux qu’elle nomme');
      return out;
    }, PUBLISHED_B7)).forEach(report);

    // --------------------------------------------- apparitions et modèles
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      G.roundT = 1e9;
      __zs.openAll();
      const seen = {}, wrong = [];
      for (const w of World.windows) {
        const z = spawnZombie(w, 100);
        const want = LAYOUT.zones[w.zone].zombie || 'fantassin';
        seen[LAYOUT.zones[w.zone].name] = z.type.id;
        if (z.type.id !== want) wrong.push([w.x, w.z, z.type.id, want]);
      }
      ok(wrong.length === 0 && Object.keys(seen).length === 4, `chaque fenêtre fait sortir le zombie de sa pièce (${World.windows.length} fenêtres)`, { seen, wrong });
      __zs.step(30, 1 / 60);
      // pièces dessinées : celles du modèle du zombie, aucune d'un autre modèle
      const e = new THREE.Matrix4(), scaleOf = (m, i) => { m.getMatrixAt(i, e); return Math.abs(e.determinant()); };
      const bad = [];
      for (const z of Zombies.list) {
        for (const model in ZR.models) {
          for (const { def, m, pair } of ZR.models[model]) {
            const idx = pair ? [z.slot * 2, z.slot * 2 + 1] : [z.slot];
            for (const i of idx) {
              const drawn = i < m.count && scaleOf(m, i) > 1e-9;
              const should = model === z.type.model && !(def.helmet && !z.helmetOn) && !def.stump && !(def.head && z.headless);
              if (drawn !== should) bad.push([z.type.id, model, def.geo, i, drawn]);
            }
          }
        }
      }
      ok(bad.length === 0, 'chaque zombie est dessiné avec les pièces de son modèle seulement', bad.slice(0, 6));
      const calls = ZR.parts.filter((m) => m.visible).length;
      ok(calls <= ZR.parts.length && ZR.parts.length === Object.values(ZPARTS).reduce((a, l) => a + l.length, 0), `rendu instancié : ${ZR.parts.length} maillages pour toute la horde, ${calls} dessinés`);
      clearZombies();
      // un zombie entré dans la salle, à 3 m devant le joueur
      const put = (zone, d = 3, hp = zombieHpForRound(1)) => {
        const zi = LAYOUT.zones.findIndex((zz) => zz.name === zone);
        const w = World.windows.find((ww) => ww.zone === zi);
        const z = spawnZombie(w, hp);
        leaveWindow(z);
        z.outside = false; z.state = 'chase'; z.t = 0;
        z.pos.set(player.pos.x, player.gy, player.pos.z - d); z.gy = player.gy; z.yaw = 0;
        z.k = nearestNode(z.pos.x, z.pos.z, player.gy);
        animateZombie(z, 0);
        return z;
      };
      const shoot = (z, y) => {
        const s = curSlot(), o = new THREE.Vector3(player.pos.x, z.pos.y + y, player.pos.z), t = new THREE.Vector3(z.pos.x, z.pos.y + y, z.pos.z);
        const d = t.sub(o).normalize();
        hitscan(s, o.x, o.y, o.z, d.x, d.y, d.z, o);
      };
      // ----- Lacéré : tir dans les jambes → à terre, il rampe
      const L = put('Salle des machines', 3, 1000);
      const hp0 = L.hp;
      shoot(L, 0.4);
      const fell = { crawl: L.crawl, alive: L.alive, hp: hp0 - L.hp };
      __zs.step(60, 1 / 60);
      const h = zombieHead(L, new THREE.Vector3()).y - L.gy;
      const d0 = Math.hypot(L.pos.x - player.pos.x, L.pos.z - player.pos.z);
      __zs.step(120, 1 / 60);
      const d1 = Math.hypot(L.pos.x - player.pos.x, L.pos.z - player.pos.z);
      const v = (d0 - d1) / 2;
      ok(fell.crawl && fell.alive && fell.hp > 0, 'Lacéré : un tir dans les jambes (sans le tuer) le met à terre', fell);
      ok(h < 0.6 && v > 0.2 && v < 0.9 && L.speed > v, `Lacéré à terre : tête à ${h.toFixed(2)} m du sol, il rampe vers vous à ${v.toFixed(2)} m/s (debout : ${L.speed.toFixed(2)})`, { h, v, speed: L.speed });
      const hpH = L.hp;
      shoot(L, h);
      ok(L.hp < hpH, 'Lacéré à terre : on le touche encore', { before: hpH, after: L.hp });
      L.pos.set(player.pos.x, player.gy, player.pos.z - 0.9);
      __zs.god(false);
      player.hp = player.maxHp;
      __zs.step(110, 1 / 60);
      const hurt = player.maxHp - player.hp;
      __zs.god(true);
      ok(hurt >= RULES.zombieHit - 1e-6 || player.lastHit > 0, 'Lacéré à terre : il frappe depuis le sol (30 dégâts)', { hurt, state: L.state });
      clearZombies();
      const F = put("Salle d'arrivée");
      shoot(F, 0.4);
      ok(F.alive && !F.crawl, 'Fantassin : un tir dans les jambes ne le fait pas ramper');
      clearZombies();
      // ----- Savant : seringue lâchée à l'intérieur, 0,25 % des PV, seulement si l'on est blessé
      const keep = ZOMBIE_TYPE_BY_ID.savant.drop.chance;
      ZOMBIE_TYPE_BY_ID.savant.drop.chance = 1;
      ZOMBIE_TYPE_BY_ID.sentinelle.drop.chance = 1;
      const S = put('Infirmerie', 2);
      killZombie(S, { kind: 'bullet', dx: 0, dz: -1 });
      const syr = Pickups.list.find((p) => p.item === 'syringe');
      ok(syr && Math.hypot(syr.x - S.pos.x, syr.z - S.pos.z) < 0.01 && syr.g.parent === scene, 'Savant tué : une seringue tombe au sol, là où il meurt', syr && { x: syr.x, z: syr.z });
      player.hp = player.maxHp;
      __zs.tp(syr.x, syr.z);
      __zs.step(10, 1 / 60);
      ok(Pickups.list.includes(syr), 'PV pleins : la seringue reste au sol');
      __zs.god(false);
      player.hp = 50; player.lastHit = G.time;
      __zs.step(2, 1 / 60);
      const healed = player.hp - 50;
      __zs.god(true);
      ok(!Pickups.list.includes(syr) && Math.abs(healed - player.maxHp * 0.0025) < 1e-6, `blessé : la seringue est ramassée et rend ${healed.toFixed(2)} PV (0,25 % de ${player.maxHp})`, { healed });
      // tué dehors, derrière une fenêtre de l'Infirmerie : la seringue tombe juste devant, dedans
      const zi = LAYOUT.zones.findIndex((zz) => zz.name === 'Infirmerie');
      const win = World.windows.find((w) => w.zone === zi);
      const S2 = spawnZombie(win, 100);
      __zs.step(100, 1 / 60);
      killZombie(S2, { kind: 'bullet', dx: 0, dz: 1 });
      const syr2 = Pickups.list.find((p) => p.item === 'syringe');
      ok(syr2 && zoneAt(syr2.x, syr2.z, syr2.gy) === zi && Math.hypot(syr2.x - (win.x + 0.5), syr2.z - (win.z + 0.5)) < 1.2, 'Savant tué dehors : la seringue tombe devant la fenêtre, à l’intérieur', syr2 && { x: syr2.x, z: syr2.z, win: [win.x, win.z] });
      __zs.step(60 * 31, 1 / 60);
      ok(!Pickups.list.includes(syr2), 'une seringue non ramassée disparaît au bout de 30 s');
      // ----- Sentinelle : chargeur, un chargeur de plus pour l'arme en main
      const T = put('Entrepôt', 2);
      killZombie(T, { kind: 'bullet', dx: 0, dz: -1 });
      const mag = Pickups.list.find((p) => p.item === 'mag');
      const s = curSlot(), full = wstat(s, 'res'), size = wstat(s, 'mag');
      s.res = full - 20;
      __zs.tp(mag.x, mag.z);
      __zs.step(2, 1 / 60);
      ok(!Pickups.list.includes(mag) && s.res === full - 20 + size, `Sentinelle tuée : chargeur ramassé, +${size} balles de réserve (${wstat(s, 'name')})`, { res: s.res, full, size });
      const T2 = put('Entrepôt', 2);
      killZombie(T2, { kind: 'bullet', dx: 0, dz: -1 });
      const mag2 = Pickups.list.find((p) => p.item === 'mag');
      Arms.slots.forEach((sl) => { if (sl) sl.res = wstat(sl, 'res'); });
      __zs.tp(mag2.x, mag2.z);
      __zs.step(2, 1 / 60);
      ok(Pickups.list.includes(mag2), 'réserve pleine : le chargeur reste au sol');
      ZOMBIE_TYPE_BY_ID.savant.drop.chance = keep;
      ZOMBIE_TYPE_BY_ID.sentinelle.drop.chance = 0.25;
      ok(ZOMBIE_TYPE_BY_ID.savant.drop.chance === 0.35 && PICKUPS.syringe.heal === 0.0025, 'règles : seringue 35 % des Savants, 0,25 % des PV ; chargeur 25 % des Sentinelles');
      clearPickups(); clearZombies();
      // ----- lanternes : 3 lumières au plus, sur les Sentinelles les plus proches ; nombre de lumières fixe
      const nLights = () => { let n = 0; scene.traverse((o) => { if (o.isPointLight) n++; }); return n; };
      const n0 = nLights();
      const sent = [];
      for (let i = 0; i < 5; i++) sent.push(put('Entrepôt', 2 + i * 1.5));
      __zs.step(2, 1 / 60);
      const lit = Lanterns.lights.filter((o) => o.light.intensity > 0);
      const nearest = sent.slice(0, 3);
      const L0 = variantGeometries('sentinelle').lanternPos, w = new THREE.Vector3();
      const near = lit.every((o) => nearest.some((z) => w.copy(L0).applyMatrix4(z.rig.hips.matrixWorld).distanceTo(o.light.position) < 0.01));
      ok(Lanterns.lights.length === 3 && lit.length === 3 && near && nLights() === n0, '5 Sentinelles : 3 lanternes éclairent (les plus proches), les autres brillent seulement ; nombre de lumières inchangé', { lit: lit.length, n0, n1: nLights() });
      clearZombies();
      __zs.step(2, 1 / 60);
      ok(Lanterns.lights.every((o) => o.light.intensity === 0), 'sans Sentinelle : lanternes éteintes');
      // ----- éliminations par type
      const life0 = { all: Life.data.kills, sav: Life.data.types.savant || 0 };
      for (let i = 0; i < 2; i++) { const z = put('Infirmerie', 2); killZombie(z, { kind: 'knife', dx: 0, dz: -1 }); }
      const f = put("Salle d'arrivée", 2); killZombie(f, { kind: 'knife', dx: 0, dz: -1 });
      ok(Life.data.kills === life0.all + 3 && Life.data.types.savant === life0.sav + 2 && specimenKills(ZOMBIE_TYPE_BY_ID.savant) === life0.sav + 2
        && specimenKills(BASE_TYPE) === Life.data.kills - Object.values(Life.data.types).reduce((a, b) => a + b, 0), 'éliminations comptées par type (fiches de l’écran Modèles)', { kills: Life.data.kills, types: Life.data.types });
      clearPickups(); clearZombies();
      return out;
    })).forEach(report);

    // ------------------------------------------------------ écran Modèles
    await game.evaluate(() => { quitToMenu(); });
    await game.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 30000 });
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    const tabs = await game.evaluate(() => [...document.querySelectorAll('#md-tabs .md-tab')].map((b) => b.textContent));
    report({ ok: tabs.join('|') === 'N°00Le Fantassin|N°00-ALe Lacéré|N°00-CLe Savant|N°00-DLa Sentinelle|N°03Le Molosse|N°K-01L’Archéologue|N°K-02L’Ouvrier|N°K-03Le Villageois|N°K-04Le Rôdeur des sables|N°K-05Le Gardien à tête de chacal|N°K-06Le Pilote', label: 'écran Modèles : onglets N°00, 00-A, 00-C, 00-D, N°03 Le Molosse, puis Khamsin (K-01 à K-06, jeu 2.0.0)', extra: tabs });
    for (const [id, name, must] of [
      ['lacere', 'Le Lacéré', ['Tête nue, veste ouverte sur les côtes', 'Jambes déchiquetées', 'Salle des machines']],
      ['savant', 'Le Savant', ['Blouse claire jusqu’aux genoux', 'seringue', '0,25', 'Infirmerie']],
      ['sentinelle', 'La Sentinelle', ['Longue capote et lanterne allumée', 'chargeur', 'Entrepôt']],
    ]) {
      await game.click(`#md-tabs [data-id="${id}"]`);
      await new Promise((r) => setTimeout(r, 900));
      const md = await game.evaluate(() => ({
        name: document.querySelector('#md-sheet .md-name').textContent, tag: document.querySelector('#md-sheet .md-tagline').textContent,
        text: document.getElementById('md-sheet').textContent, chips: [...document.querySelectorAll('#md-anims .md-chip')].map((b) => b.textContent),
        probe: __zs.modelProbe(), meshes: Models.spec.root.children.filter((m) => m.isInstancedMesh && m.count === m.userData.mul).length,
        parts: ZPARTS[Models.sel].length,
      }));
      const okText = md.name === name && /Variante du Fantassin/.test(md.tag) && must.every((t) => md.text.includes(t)) && md.text.includes('Stats identiques au Fantassin');
      report({ ok: okText && md.probe && md.probe.changed > 0.03 && md.meshes === md.parts, label: `fiche ${name} : texte de la fiche, pièces où il apparaît, modèle 3D dessiné`, extra: { name: md.name, tag: md.tag, probe: md.probe, meshes: md.meshes } });
      if (id === 'lacere') {
        report({ ok: md.chips.includes('Rampe') && md.chips.includes('Tir dans les jambes') && !md.chips.includes('Tir dans le casque'), label: 'fiche du Lacéré : animation « Rampe » et bouton « Tir dans les jambes »', extra: md.chips });
        await game.click('#md-anims [data-action="legs"]');
        await new Promise((r) => setTimeout(r, 1200));
        const low = await game.evaluate(() => Models.spec.crawling());
        report({ ok: low, label: 'fiche du Lacéré : le tir dans les jambes le fait ramper' });
      }
    }
    await game.keyboard.press('Escape');
    await game.waitForFunction(() => !document.getElementById('menu').hidden);
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Zombies par pièce : apparitions, modèles, bonus et fiches conformes.');
  process.exit(failures ? 1 : 0);
})();
