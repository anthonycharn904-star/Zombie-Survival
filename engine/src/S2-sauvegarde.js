/* ==================================================================== 29 SAUVEGARDE ==
   Sauvegarder et quitter, reprise des parties solo (jeu 2.0.7, demande d'Anthony du 3 novembre 2026 ; audit et plan :
   docs/integration/10-sauvegarde-partie.md de la session d'intégration) : sauvegarde manuelle et de secours, reprise,
   conditions, menus simples (la session Interface les reprendra dans sa refonte).
   · un seul système : serializeGame et restoreSave (section 11, écrits pour l'ancien rechargement à chaud de
     claude.ai) restent le contributeur « base » ; ce module y ajoute le joueur, les bonus, les fenêtres, la boîte et
     la manche en cours, par un registre de contributeurs (sauveEnregistrer) ouvert aux cartes et aux modules futurs ;
   · deux façons de reprendre, à l'essai (SAUVE.mode) : 'entre' (sauvegarde permise seulement entre deux manches,
     reprise au début de la manche suivante) et 'manche' (sauvegarde aussi pendant la manche : progression de la
     manche et zombies vivants recréés, qui sortent de terre à leur place ou reviennent par leur fenêtre) ;
   · décisions d'Anthony du 3 novembre : pas de sauvegarde en plein combat (SAUVE.calme sans coup reçu, aucun zombie
     à moins de SAUVE.distance) ; reprise avec toute la santé ; aucun zombie recréé à moins de SAUVE.ecart du joueur ;
     aucune sauvegarde pendant les manches spéciales (chiens, et celles des cartes) ni pendant un boss ;
   · une sauvegarde par carte et par type ; consommée à la reprise ; effacée à la fin de la partie ; une nouvelle partie
     sur une carte sauvegardée demande confirmation ;
   · secours (pour un plantage) : écrite sans bruit aux mêmes conditions que la manuelle, dès que possible après la fin
     de chaque manche, après un moment important (porte, courant, atout, Glas, arme au mur, boîte), toutes les
     SAUVE.secours.intervalle secondes et à la fermeture normale de la fenêtre ; effacée quand le joueur tombe à terre,
     quitte sans sauvegarder, sauvegarde lui-même, meurt, ou ferme la fenêtre en plein combat (pas de retour en
     arrière volontaire) ; « Reprendre la partie interrompue » au menu ;
   · fichier : enveloppe { format, type, jeu, carte, cree, apercu, etat, somme } ; somme FNV-1a de l'état ; la copie
     précédente est gardée (.bak) et sert si la principale est abîmée ; rien n'est effacé sur un échec ;
   · stockage : dans le launcher (1.4.0 et plus récent), des fichiers du dossier utilisateur, écrits de façon atomique
     avec une copie (launcher/src/main/sauvegardes.js, zsLauncher.sauvegardes) ; sinon (navigateur, launcher plus
     ancien) le localStorage de l'origine du jeu ; une sauvegarde restée dans le localStorage passe dans les fichiers
     au démarrage suivant ;
   · la reprise attend : la partie s'ouvre en pause, le joueur clique sur « Reprendre ».
   ============================================================================ */
const SAUVE = {
  format: 1,
  mode: 'manche',                              // 'manche' : aussi pendant la manche ; 'entre' : entre deux manches
  calme: 5,                                    // s sans coup reçu avant de pouvoir sauvegarder
  distance: 8,                                 // m : aucun zombie vivant plus près du joueur
  ecart: 6,                                    // m : un zombie recréé plus près reprend par un point d'apparition
  cle: 'zs.partie.',                           // localStorage : zs.partie.<carte>.<type>, copie en .bak
  contributeurs: new Map(),
  empreintes: {},
  derniere: null,                              // dernier résultat (interface, essais)
  secours: { intervalle: 90, t: 0, manche: -1, attente: null, derniere: null },
  typeForce: null,                             // type imposé au zombie recréé (zoneZombieType, hooks-sauvegarde.py)
  reprise: false,                              // reprise en cours : startGame ne demande pas la souris (hooks-sauvegarde.py)
  sortieOk: false,                             // fermeture de la fenêtre confirmée
  index: new Map(),                            // sauvegardes présentes ('carte.type' → résumé), tenu à jour
};
/* Moments importants (compteurs de Life) : une sauvegarde de secours suit dès que possible. */
const SAUVE_IMPORTANTS = new Set(['doors', 'power', 'perks', 'upgrades', 'wallbuys', 'boxes']);
const SAUVE_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/* Somme FNV-1a sur 32 bits, en hexadécimal : repère une sauvegarde abîmée (pas une protection contre la triche). */
function sauveSomme(txt) {
  let h = 0x811c9dc5;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
function sauveDate(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getDate()} ${SAUVE_MOIS[d.getMonth()]} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}
function sauveNomCarte(id) { const m = MAPS.byId[id]; return m ? m.name : id; }
/* Empreinte de la carte (une fois par carte et par partie du jeu) : signalée, jamais bloquante seule. */
function sauveEmpreinte(id) {
  if (SAUVE.empreintes[id]) return SAUVE.empreintes[id];
  let e = 'inconnue';
  try { const m = MAPS.byId[id]; if (m) e = sauveSomme(JSON.stringify(m.open ? { id: m.id, name: m.name, base: m.base } : serializeMap(m))); } catch (err) { /* carte ouverte */ }
  return (SAUVE.empreintes[id] = e);
}

/* ---------------------------------------------------------------- stockage ---- */
/* Stockage du navigateur (jeu hors du launcher, ou launcher plus ancien). */
const sauveNavigateur = {
  nom: 'navigateur',
  cle: (carte, type) => `${SAUVE.cle}${carte}.${type}`,
  lireTexte(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  /* Lit et vérifie : la principale, sinon la copie. { ok, env, source, erreur } */
  lire(carte, type) {
    const k = this.cle(carte, type);
    const essai = (txt, source) => {
      if (txt == null) return { ok: false, erreur: 'absente', source };
      let env;
      try { env = JSON.parse(txt); } catch (e) { return { ok: false, erreur: 'illisible', source }; }
      if (!env || typeof env !== 'object' || !env.etat || typeof env.somme !== 'string') return { ok: false, erreur: 'incomplète', source };
      if (sauveSomme(JSON.stringify(env.etat)) !== env.somme) return { ok: false, erreur: 'abîmée (somme)', source };
      return { ok: true, env, source };
    };
    const a = essai(this.lireTexte(k), 'principale');
    if (a.ok || a.erreur === 'absente') return Promise.resolve(a.ok ? a : this.lireCopie(k, a, essai));
    return Promise.resolve(this.lireCopie(k, a, essai));
  },
  lireCopie(k, a, essai) {
    const b = essai(this.lireTexte(`${k}.bak`), 'copie');
    if (b.ok) return Object.assign(b, { avertissement: a.erreur === 'absente' ? null : `sauvegarde principale ${a.erreur} : copie précédente utilisée` });
    return a.erreur === 'absente' ? a : { ok: false, erreur: a.erreur, source: 'principale' };
  },
  /* Écrit, garde la précédente en copie, relit et vérifie. Sur un échec, la précédente reste. */
  ecrire(carte, type, env) {
    const k = this.cle(carte, type), txt = JSON.stringify(env);
    try {
      const avant = localStorage.getItem(k);
      if (avant != null) localStorage.setItem(`${k}.bak`, avant);
      localStorage.setItem(k, txt);
      if (localStorage.getItem(k) !== txt) throw new Error('relecture différente');
      return Promise.resolve({ ok: true, octets: txt.length });
    } catch (e) {
      return Promise.resolve({ ok: false, erreur: `écriture impossible : ${(e && e.message) || e}` });
    }
  },
  /* Efface une sauvegarde consommée ou remplacée (principale et copie). */
  effacer(carte, type) {
    const k = this.cle(carte, type);
    try { localStorage.removeItem(k); localStorage.removeItem(`${k}.bak`); } catch (e) { /* stockage indisponible */ }
    return Promise.resolve(true);
  },
  /* Résumés des sauvegardes présentes, la plus récente d'abord. */
  liste() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const m = k && k.startsWith(SAUVE.cle) && !k.endsWith('.bak') && k.slice(SAUVE.cle.length).match(/^([a-z0-9_-]+)\.(manuelle|secours)$/i);
        if (!m) continue;
        try { const env = JSON.parse(localStorage.getItem(k)); if (env && env.apercu) out.push({ carte: m[1], type: m[2], apercu: env.apercu, cree: env.cree, jeu: env.jeu }); } catch (e) { /* illisible : montrée à la reprise */ }
      }
    } catch (e) { /* stockage indisponible */ }
    out.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
    return Promise.resolve(out);
  },
  /* Accès brut (essais : fichier abîmé, copie) : texte lu ; texte écrit sans contrôle ; null : effacé. */
  brut(carte, type, copie, texte) {
    const k = this.cle(carte, type) + (copie ? '.bak' : '');
    try {
      if (texte === undefined) return Promise.resolve(localStorage.getItem(k));
      if (texte === null) localStorage.removeItem(k); else localStorage.setItem(k, texte);
      return Promise.resolve(true);
    } catch (e) { return Promise.resolve(false); }
  },
};
/* Fichiers du launcher : écriture atomique, copie, vérification (launcher/src/main/sauvegardes.js). */
function sauveFichiers(api) {
  const panne = (e) => ({ ok: false, erreur: `launcher : ${(e && e.message) || e}` });
  return {
    nom: 'fichiers',
    lire: (carte, type) => api.lire(carte, type).then((r) => {
      if (!r || !r.ok) return r || { ok: false, erreur: 'illisible' };
      try { return { ok: true, env: JSON.parse(r.texte), source: r.source, avertissement: r.avertissement || null }; } catch (e) { return { ok: false, erreur: 'illisible', source: r.source }; }
    }, panne),
    ecrire: (carte, type, env) => api.ecrire(carte, type, JSON.stringify(env)).catch(panne),
    effacer: (carte, type) => api.supprimer(carte, type).catch(() => false),
    liste: () => api.liste().then((l) => (l || []).filter((x) => x.etat !== 'abîmée'), () => []),
    brut: (carte, type, copie, texte) => api.brut(carte, type, copie, texte),
  };
}
const sauveStock = window.zsLauncher && window.zsLauncher.sauvegardes ? sauveFichiers(window.zsLauncher.sauvegardes) : sauveNavigateur;
/* Les opérations passent une à une, dans l'ordre où le jeu les demande (une sauvegarde consommée est effacée avant que
   la suivante s'écrive, quel que soit le transport) ; l'index des sauvegardes présentes (choix de la carte, sans
   attendre) est tenu à jour par la liste, l'écriture et l'effacement. */
{
  const S = sauveStock, lire = S.lire.bind(S), ecrire = S.ecrire.bind(S), effacer = S.effacer.bind(S), liste = S.liste.bind(S), brut = S.brut.bind(S);
  let file = Promise.resolve();
  const tour = (f) => { const r = file.then(f, f); file = r.then(() => null, () => null); return r; };
  S.lire = (carte, type) => tour(() => lire(carte, type));
  S.ecrire = (carte, type, env) => tour(() => ecrire(carte, type, env)).then((w) => { if (w && w.ok) SAUVE.index.set(`${carte}.${type}`, { carte, type, apercu: env.apercu, cree: env.cree }); return w; });
  S.effacer = (carte, type) => { SAUVE.index.delete(`${carte}.${type}`); return tour(() => effacer(carte, type)); };
  S.liste = () => tour(() => liste()).then((l) => { SAUVE.index = new Map(l.map((x) => [`${x.carte}.${x.type}`, x])); return l; });
  S.brut = (carte, type, copie, texte) => tour(() => brut(carte, type, copie, texte));
}

/* ------------------------------------------------------------- contributeurs ---- */
/* Interface d'extension (cartes, modules, Mod Tools) :
   sauveEnregistrer(nom, { version, refus() → null | texte, capter() → données simples, restaurer(donnees, version) }).
   capter ne renvoie que des nombres, textes, booléens, tableaux et objets simples (jamais d'objet three.js). */
function sauveEnregistrer(nom, c) { SAUVE.contributeurs.set(nom, Object.assign({ version: 1 }, c)); }

const sauvePlusProche = () => {
  let d = Infinity;
  for (const z of Zombies.list) if (z.alive && !z.dog) d = Math.min(d, Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z));
  return d;
};
/* Conditions communes ; null si la sauvegarde est permise, sinon la raison affichée. */
function sauveRefus() {
  if (G.editorSession) return 'Partie de test des Mod Tools : elle ne se sauvegarde pas.';
  if (G.state !== 'playing' && G.state !== 'paused') return 'Aucune partie en cours.';
  if (player.down || player.hp <= 0) return 'Impossible à terre.';
  if (G.dogRound) return 'Manche spéciale en cours (chiens) : sauvegarde impossible pendant les manches spéciales.';
  if (SAUVE.mode === 'entre' && G.roundState === 'active') return 'La sauvegarde est possible entre deux manches seulement.';
  if (G.time - player.lastHit < SAUVE.calme) return 'Vous venez d’être touché : mettez-vous à l’abri quelques secondes.';
  const d = sauvePlusProche();
  if (d < SAUVE.distance) return `Des zombies sont trop près (${d.toFixed(0)} m) : éloignez-vous pour sauvegarder.`;
  if (Arms.state === 'drink') return 'Atout en cours de consommation.';
  if (Features.box && Features.box.state !== 'idle') return 'La boîte mystère est en cours.';
  if (Features.amp && (Features.amp.state === 'raise' || Features.amp.state === 'ritual')) return 'Le Glas est en cours.';
  if (typeof Keypad !== 'undefined' && Keypad.open) return 'Digi pass en cours de saisie.';
  if (OW.on && VEH.drive) return 'Descendez du véhicule pour sauvegarder.';
  for (const [nom, c] of SAUVE.contributeurs) {
    if (typeof c.refus !== 'function') continue;
    let r = null;
    try { r = c.refus(); } catch (e) { r = `Contributeur « ${nom} » en erreur.`; }
    if (r) return r;
  }
  return null;
}
/* Joueur : place, regard ; la santé repart pleine à la reprise (décision d'Anthony). */
sauveEnregistrer('joueur', {
  capter: () => ({ x: +player.pos.x.toFixed(3), z: +player.pos.z.toFixed(3), gy: +(+player.gy || 0).toFixed(3), layer: player.layer | 0, yaw: +player.yaw.toFixed(4), pitch: +player.pitch.toFixed(4) }),
  restaurer(d) {
    if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    if (OW.on) placePlayer(d.x, d.z, d.layer ? -1 : 0);
    else {
      player.pos.set(d.x, 0, d.z);
      player.k = nearestNode(d.x, d.z, d.gy);
      player.gy = d.gy;
      settleBody(player, 0.3);
      player.pos.y = player.gy;
    }
    player.yaw = +d.yaw || 0; player.pitch = clamp(+d.pitch || 0, -1.5, 1.5);
    player.hp = player.maxHp; player.lastHit = -99;
  },
});
/* Bonus : durées restantes, rythme des apparitions, bonus posés au sol. */
sauveEnregistrer('bonus', {
  capter: () => ({
    insta: +G.timers.insta.toFixed(2), double: +G.timers.double.toFixed(2),
    acc: Powerups.acc, threshold: Powerups.threshold, drops: Powerups.drops, bag: Powerups.bag.slice(),
    sol: Powerups.list.map((p) => ({ type: p.type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), gy: +p.gy.toFixed(2), reste: +Math.max(0, p.life - p.t).toFixed(1) })),
  }),
  restaurer(d) {
    if (!d) return;
    G.timers.insta = Math.max(0, +d.insta || 0); G.timers.double = Math.max(0, +d.double || 0);
    if (Number.isFinite(d.acc)) Powerups.acc = d.acc;
    if (Number.isFinite(d.threshold)) Powerups.threshold = d.threshold;
    if (Number.isFinite(d.drops)) Powerups.drops = d.drops;
    if (Array.isArray(d.bag)) Powerups.bag = d.bag.filter((t) => POWERUPS[t]);
    for (const p of d.sol || []) {
      if (!POWERUPS[p.type] || !(p.reste > 0)) continue;
      spawnPowerup(p.type, p.x, p.z, p.gy);
      const q = Powerups.list[Powerups.list.length - 1];
      q.life = p.reste; q.t = 0;
    }
  },
});
/* Carte : planches des fenêtres, tirages de la boîte. */
sauveEnregistrer('carte', {
  capter: () => ({
    fenetres: World.windows.map((w) => w.planks.map((p) => (p.state === 'on' || p.state === 'repair' ? 1 : 0))),
    boite: Features.box ? { uses: Features.box.uses } : null,
  }),
  restaurer(d) {
    if (!d) return;
    (d.fenetres || []).forEach((pl, i) => {
      const w = World.windows[i];
      if (!w || !Array.isArray(pl) || pl.length !== w.planks.length) return;
      w.planks.forEach((p, j) => {
        if (pl[j]) { p.state = 'on'; p.m.visible = true; p.m.position.copy(p.rest); p.m.rotation.set(0, p.ry, p.tilt); } else { p.state = 'gone'; p.m.visible = false; }
      });
      w.boards = pl.reduce((a, b) => a + (b ? 1 : 0), 0);
    });
    if (d.boite && Features.box) Features.box.uses = d.boite.uses | 0;
  },
});
/* Manche : où en est la partie (entre deux manches ou pendant), et les zombies vivants (mode 'manche'). */
sauveEnregistrer('manche', {
  capter() {
    const etat = { round: G.round, state: G.roundState, t: +G.roundT.toFixed(2) };
    if (G.roundState !== 'active') return etat;
    Object.assign(etat, { total: G.total, spawned: G.spawned, killed: G.killed, spawnDelay: G.spawnDelay, spawnT: +G.spawnT.toFixed(2), zombieHp: G.zombieHp, repairPts: G.repairPts });
    etat.zombies = Zombies.list.filter((z) => z.alive && !z.dog).map((z) => ({
      type: z.type && z.type.id, hp: Math.max(1, Math.round(z.hp)), maxHp: Math.round(z.maxHp || z.hp),
      x: +z.pos.x.toFixed(2), z: +z.pos.z.toFixed(2), gy: +(+z.gy || 0).toFixed(2), layer: z.layer | 0,
      speedType: z.speedType, win: z.outside && z.win ? World.windows.indexOf(z.win) : -1,
    }));
    return etat;
  },
  restaurer(d) {
    if (!d || !Number.isInteger(d.round)) return;
    if (d.state !== 'active') {
      // entre deux manches (ou avant la première) : la manche suivante commence comme à la reprise d'avant
      G.round = Math.max(0, d.round); G.roundState = 'pre'; G.roundT = 2.2;
      return;
    }
    G.round = d.round; G.roundState = 'active'; G.dogRound = false;
    G.total = d.total | 0; G.spawned = d.spawned | 0; G.killed = d.killed | 0;
    G.spawnDelay = +d.spawnDelay || G.spawnDelay; G.spawnT = Math.max(1.5, +d.spawnT || 0); G.zombieHp = +d.zombieHp || G.zombieHp; G.repairPts = d.repairPts | 0;
    for (const s of d.zombies || []) sauveRecreer(s);
  },
});
/* Un zombie sauvegardé revient : par sa fenêtre s'il attendait dehors, sinon il sort de terre à sa place ; trop près
   du joueur, il reprend par un point d'apparition. Limites de l'essai : il revient debout (pas rampant), avec son
   casque, à la vitesse de sa catégorie. */
function sauveRecreer(s) {
  let sp = null;
  const win = s.win >= 0 ? World.windows[s.win] : null;
  const pres = Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < SAUVE.ecart;
  if (win && !pres) sp = win;
  else if (!pres) {
    let li = 0;
    if (!OW.on) { let bd = Infinity; LVY.forEach((y, i) => { const dd = Math.abs(y - s.gy); if (dd < bd) { bd = dd; li = i; } }); }
    sp = { riser: true, x: s.x, z: s.z, zone: -1, li, k: nearestNode(s.x, s.z, s.gy), layer: s.layer | 0, y: s.gy };
  } else sp = pickSpawnPoint();
  if (!sp) return null;
  SAUVE.typeForce = sauveTypeParId(s.type);
  let z = null;
  try { z = spawnZombie(sp, 1); } finally { SAUVE.typeForce = null; }
  if (!z) return null;
  z.hp = s.hp; z.maxHp = Math.max(s.maxHp || s.hp, s.hp);
  if (s.speedType && SPEEDS[s.speedType]) { z.speedType = s.speedType; z.speed = rand(SPEEDS[z.speedType][0], SPEEDS[z.speedType][1]) * z.type.mult.speed; }
  return z;
}

/* Type de zombie par son identifiant : Bunker 7 et cartes des Mod Tools, Khamsin et Marécages, Lune. */
function sauveTypeParId(id) {
  if (!id) return null;
  if (ZOMBIE_TYPE_BY_ID[id]) return ZOMBIE_TYPE_BY_ID[id];
  for (const liste of [typeof KH_TYPES !== 'undefined' ? KH_TYPES : [], typeof LU_TYPES !== 'undefined' ? LU_TYPES : []]) {
    const t = liste.find((x) => x && x.id === id);
    if (t) return t;
  }
  return null;
}
/* Marécages Maudits (branche de la session Marécages) : refus tant que le joueur nage, que la Mère-Vase chasse ou
   attaque, ou pendant son combat. Lu à l'exécution : rien ne se passe sur les cartes qui n'ont pas ces systèmes. */
sauveEnregistrer('marecages', {
  refus() {
    if (!OW.on || OW.worldId !== 'marais') return null;
    if (typeof MA_SWIM !== 'undefined' && MA_SWIM.on) return 'Vous nagez : sortez de l’eau pour sauvegarder.';
    if (typeof MA_BOSS !== 'undefined' && MA_BOSS.on) return 'Combat de la Mère-Vase en cours : sauvegarde impossible pendant un boss.';
    if (typeof MAB !== 'undefined' && MAB.on && MAB.state !== 'dormant' && MAB.state !== 'rode') return 'La Mère-Vase attaque : mettez-vous à l’abri pour sauvegarder.';
    return null;
  },
  capter: () => null,
  restaurer() {},
});

/* Horloge de la gare et « Atout gratuit » (chantier Bunker 7, sections 34 et 35, s'ils sont dans le jeu) : l'aiguille et
   l'easter egg fait reprennent avec la partie (sinon il se referait) ; refus tant qu'un atout gratuit reste à boire
   (de 0,4 à 2,75 s : la boisson elle-même est déjà refusée, Arms.state « drink »). */
if (typeof HORL === 'object') sauveEnregistrer('horloge', {
  version: 1,
  refus: () => (typeof ATG === 'object' && (ATG.attente > 0 || ATG.boit) ? 'Atout gratuit en cours : attendez la fin de la boisson.' : null),
  capter: () => ({ cran: HORL.cran, fait: HORL.fait }),
  restaurer(d) {
    if (!d) return;
    HORL.cran = clamp(d.cran | 0, HORL.depart, HORL.midi); HORL.fait = !!d.fait; HORL.t = 1;
    HORL.de = HORL.cran * Math.PI / 6; horlPoser(HORL.de);
  },
});

/* Boss, quête et easter eggs secondaires de Bunker 7 (chantier Bunker 7, sections 21 à 41, s'ils sont dans le jeu).
   Décisions d'Anthony des 9 et 10 novembre 2026 :
   · refus pendant le combat du boss et ses scènes, du début à la fin de la quête « Le Dernier Pacte », pendant
     l'hallucination du Visionnaire, et tant qu'un nuage toxique des caisses dure ;
   · ce qui est fait est gardé : la quête finie (elle ne se refait pas), les dégâts du camion (ou son épave), les ampoules
     touchées, les caisses à logo tirées et celles cassées, les têtes touchées ; chaque easter egg réussi. Au retour, les
     zombies reviennent sans état toxique ; ni son, ni effet, ni récompense rejoués. */
if (typeof B7 === 'object') sauveEnregistrer('boss-b7', {
  version: 1,
  refus: () => (B7.actif || B7.cine ? 'Combat du boss en cours : sauvegarde impossible pendant un boss.' : null),
  // le boss se fait une fois par partie : code du boss déjà tapé, combat terminé (sinon il se referait après une reprise)
  capter: () => ({ codes: typeof B7A === 'object' ? { secret: !!B7A.codes.secret, boss: !!B7A.codes.boss } : null,
    termine: !!(B7.combat && B7.drapeaux[B7.combat.config.general.drapeauTermine]) }),
  restaurer(d) {
    if (!d) return;
    if (d.codes && typeof B7A === 'object') { B7A.codes.secret = !!d.codes.secret; B7A.codes.boss = !!d.codes.boss; }
    if (d.termine && B7.combat) B7.drapeaux[B7.combat.config.general.drapeauTermine] = true;
    const dp = Features.digipass;                // les deux codes tapés : le digi pass avait disparu
    if (d.codes && d.codes.boss && d.codes.secret && dp && !dp.gone) hideDigipass();
  },
});
if (typeof QP === 'object') sauveEnregistrer('quete', {
  version: 1,
  refus: () => (QP.etape !== 'attente' && QP.etape !== 'fini' ? '« Le Dernier Pacte » en cours : sauvegarde impossible jusqu’à la fin de la quête.' : null),
  capter: () => ({ fini: QP.etape === 'fini' }),
  restaurer(d) { if (d && d.fini) QP.etape = 'fini'; },
});
if (typeof VS === 'object') sauveEnregistrer('visionnaire', {
  refus: () => (VS.on ? 'Vous êtes dans l’hallucination : sauvegarde impossible avant le réveil.' : null),
  capter: () => null,                          // VS.fait : déjà dans serializeGame (accroche du chantier Bunker 7)
  restaurer() {},
});
if (typeof CAM === 'object') sauveEnregistrer('camion', {
  version: 1,
  capter: () => ({ degats: Math.round(CAM.degats), fait: CAM.fait }),
  restaurer(d) {
    if (!d || !CAM.racine) return;
    if (d.fait) {
      CAM.fait = true; CAM.etat = 'detruit'; CAM.degats = CAM.pv; CAM.t = CAM.feu;   // épave éteinte, sans explosion
      if (CAM.bache) CAM.bache.visible = false;
      if (CAM.vitres) CAM.vitres.visible = false;
      camNoircir(1);
      return;
    }
    CAM.degats = clamp(+d.degats || 0, 0, CAM.pv - 1);
    const k = CAM.degats / CAM.pv;
    CAM.etat = k >= 0.75 ? 'flammes' : k >= 0.5 ? 'fume' : 'neuf';
  },
});
if (typeof AMP === 'object') sauveEnregistrer('ampoules', {
  version: 1,
  capter: () => ({ touchees: AMP.touchees ? AMP.touchees.map((v, i) => (v ? i : -1)).filter((i) => i >= 0) : [], fait: AMP.fait }),
  restaurer(d) {
    if (!d || G.mapId !== BUNKER7.id || !World.lights || !World.lights.length) return;
    ampEtat();
    for (const i of d.touchees || []) if (i >= 0 && i < AMP.touchees.length) AMP.touchees[i] = true;
    AMP.fait = !!d.fait;
  },
});
if (typeof CX === 'object') sauveEnregistrer('caisses', {
  version: 1,
  refus: () => (CX.nuages.length ? 'Nuage toxique en cours : attendez qu’il se dissipe pour sauvegarder.' : null),
  capter: () => ({ choisies: CX.choisies.map((c) => CX.liste.indexOf(c)), cassees: CX.liste.map((c, i) => (c.cassee ? i : -1)).filter((i) => i >= 0), fait: CX.fait }),
  restaurer(d) {
    if (!d || !cxCarte() || !Array.isArray(d.choisies) || !d.choisies.length) return;
    const ok = (i) => Number.isInteger(i) && i >= 0 && i < CX.liste.length && CX.liste[i].mesh;
    if (!d.choisies.every(ok)) return;         // carte changée : on garde le tirage de la reprise
    for (const c of CX.choisies) { c.toxique = false; c.mesh.material = MAT.crate; }
    CX.choisies = d.choisies.map((i) => CX.liste[i]);
    for (const c of CX.choisies) { c.toxique = true; c.mesh.material = cxMatiere(); }
    for (const i of d.cassees || []) {
      if (!ok(i)) continue;
      const c = CX.liste[i];
      c.cassee = true; c.mesh.visible = false; solidTop[c.k] = 0.95;   // il ne reste que la grande caisse
    }
    CX.fait = !!d.fait;
  },
});
/* Têtes : le modèle se décode à part (GLTFLoader.parse, asynchrone) ; à la première partie d'une session, les têtes
   n'existent qu'un peu après la reprise : leur état attend qu'elles soient posées (relevé par la session Bunker 7). */
const SAUVE_TETES = { attente: null, carte: null, t0: 0 };
function sauveTetesAppliquer(d) {
  for (const t of TB.tetes) if ((d.touchees || []).includes(t.nom)) { t.touchee = true; t.g.visible = false; }
  TB.fait = !!d.fait;
}
function sauveTetesAttendre() {
  const A = SAUVE_TETES;
  if (!A.attente) return;
  if (G.mapId !== A.carte || G.state === 'menu' || performance.now() - A.t0 > 120000) { A.attente = null; return; }   // partie quittée
  if (TB.tetes.length) { sauveTetesAppliquer(A.attente); A.attente = null; return; }
  requestAnimationFrame(sauveTetesAttendre);
}
if (typeof TB === 'object') sauveEnregistrer('tetes', {
  version: 1,
  capter: () => (SAUVE_TETES.attente ? SAUVE_TETES.attente : { touchees: TB.tetes.filter((t) => t.touchee).map((t) => t.nom), fait: TB.fait }),
  restaurer(d) {
    SAUVE_TETES.attente = null;
    if (!d) return;
    if (TB.tetes.length) { sauveTetesAppliquer(d); return; }
    if (!tbCarte()) return;
    Object.assign(SAUVE_TETES, { attente: d, carte: G.mapId, t0: performance.now() });
    TB.fait = !!d.fait;                        // aucune tête ne doit rapporter la récompense une seconde fois
    requestAnimationFrame(sauveTetesAttendre);
  },
});

/* ------------------------------------------------------------ capture, reprise ---- */
function sauveCapter(type) {
  const etat = { base: serializeGame(), mode: SAUVE.mode, tempsJeu: Math.round((G.tempsAvant || 0) + G.time) };
  for (const [nom, c] of SAUVE.contributeurs) etat[nom] = { v: c.version, d: c.capter() };
  const finie = G.roundState !== 'active';
  return {
    format: SAUVE.format, type,
    jeu: { version: GAME_VERSION, construction: GAME_BUILD, interface: EDITOR_API },
    carte: { id: G.mapId, nom: sauveNomCarte(G.mapId), empreinte: sauveEmpreinte(G.mapId) },
    cree: new Date().toISOString(),
    apercu: { carte: G.mapId, nom: sauveNomCarte(G.mapId), manche: Math.max(1, finie ? G.round + 1 : G.round), points: G.points, tempsJeu: etat.tempsJeu, mode: SAUVE.mode },
    etat, somme: sauveSomme(JSON.stringify(etat)),
  };
}
const sauveVersion = (v) => String(v || '0').split('.').map((n) => n | 0);
function sauvePlusRecente(a, b) {
  const x = sauveVersion(a), y = sauveVersion(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
/* Peut-on reprendre cette sauvegarde avec ce jeu ? null si oui, sinon la raison. */
function sauveCompatible(env) {
  if (!env || env.format > SAUVE.format) return 'Sauvegarde d’un format plus récent : mettez le jeu à jour.';
  if (sauvePlusRecente(env.jeu && env.jeu.version, GAME_VERSION)) return `Sauvegarde faite avec le jeu ${env.jeu.version}, plus récent que celui-ci (${GAME_VERSION}).`;
  const m = MAPS.byId[env.carte && env.carte.id];
  if (!m) return `Carte introuvable : ${(env.carte && env.carte.nom) || '?'}.`;
  return null;
}
/* Après chargement de la carte : partie neuve avec la base, puis chaque contributeur, puis la pause. */
function sauveAppliquer(env) {
  const e = env.etat;
  SAUVE.reprise = true;                        // la partie repart en pause : souris libre, Reprendre la verrouille
  try { startGame(e.base); } finally { SAUVE.reprise = false; }
  G.tempsAvant = +e.tempsJeu || 0;
  G.time = 0;
  const ordre = ['carte', 'bonus', 'joueur', 'manche'];   // le joueur avant la manche : les zombies se recréent loin de lui
  const noms = [...ordre.filter((n) => SAUVE.contributeurs.has(n)), ...[...SAUVE.contributeurs.keys()].filter((n) => !ordre.includes(n))];
  for (const nom of noms) {
    const c = SAUVE.contributeurs.get(nom), x = e[nom];
    if (!x || typeof c.restaurer !== 'function') continue;
    try { c.restaurer(x.d, x.v); } catch (err) { console.warn(`sauvegarde : « ${nom} » non restauré`, err); }
  }
  HUD.full();
  SAUVE.secours.t = 0; SAUVE.secours.manche = -1; SAUVE.secours.attente = 'reprise';   // secours dès que possible
  pauseGame();
  $('pause-title').textContent = 'Partie reprise';
}

/* -------------------------------------------------------------- API et menus ---- */
/* Pause : bouton « Sauvegarder et quitter » et sa raison quand elle est impossible. */
function sauvePause() {
  const b = $('btn-save-quit'), why = $('pause-save-why');
  if (!b) return;
  $('pause-title').textContent = 'Pause';
  b.hidden = !!G.editorSession;                // partie de test des Mod Tools : jamais sauvegardée
  if (G.editorSession) { $('pause-save-why').hidden = true; return; }
  const r = sauveRefus();
  b.disabled = !!r;
  why.hidden = !r; why.textContent = r ? `Sauvegarde impossible : ${r}` : '';
}
async function sauverEtQuitter() {
  const r = sauveRefus();
  if (r) { sauvePause(); return (SAUVE.derniere = { ok: false, raison: r }); }
  const carte = G.mapId, env = sauveCapter('manuelle');
  const w = await sauveStock.ecrire(carte, 'manuelle', env);
  const v = w.ok ? await sauveStock.lire(carte, 'manuelle') : null;
  if (!w.ok || !v.ok || v.env.somme !== env.somme) {
    const erreur = (w.ok ? `vérification : ${v.erreur || 'différente'}` : w.erreur);
    const why = $('pause-save-why'); why.hidden = false; why.textContent = `Échec de la sauvegarde (${erreur}) : la partie continue.`;
    return (SAUVE.derniere = { ok: false, erreur });
  }
  sauveStock.effacer(carte, 'secours');       // la sauvegarde manuelle la remplace
  quitToMenu();
  $('menu-save-done').hidden = false;
  $('menu-save-done').textContent = `Partie sauvegardée : ${env.apercu.nom}, manche ${env.apercu.manche}.`;
  return (SAUVE.derniere = { ok: true, carte, apercu: env.apercu, octets: w.octets });
}
/* Reprend la sauvegarde d'une carte : chargement, partie, pause ; la sauvegarde est consommée une fois reprise. */
async function sauveContinuer(carte, type = 'manuelle') {
  const r = await sauveStock.lire(carte, type);
  if (!r.ok) return sauveErreurMenu(`Sauvegarde ${r.erreur} : reprise impossible. Elle n’a pas été effacée.`, r);
  const pb = sauveCompatible(r.env);
  if (pb) return sauveErreurMenu(pb, r);
  const map = MAPS.byId[carte];
  const lancer = () => {
    try { sauveAppliquer(r.env); } catch (e) {
      console.error(e);
      try { quitToMenu(); } catch (e2) { /* déjà au menu */ }
      return sauveErreurMenu(`Reprise impossible (${(e && e.message) || e}). La sauvegarde est gardée.`, r);
    }
    sauveStock.effacer(carte, type);
    return (SAUVE.derniere = { ok: true, carte, source: r.source, avertissement: r.avertissement || null });
  };
  G.save = null;
  store.set('zs.map', carte);
  if (G.mapId === carte) return lancer();
  $('loading').textContent = `Chargement : ${map.name}…`;
  showScreen('loading');
  return new Promise((ok) => setTimeout(() => {
    try { loadMap(map); } catch (e) { console.error(e); refreshMenu(); showScreen('menu'); ok(sauveErreurMenu('Chargement de la carte impossible.', r)); return; }
    refreshMenu();
    ok(lancer());
  }, 30));
}
function sauveErreurMenu(texte, r) {
  refreshMenu(); showScreen('menu');
  const p = $('menu-save-done'); p.hidden = false; p.textContent = texte;
  return (SAUVE.derniere = { ok: false, erreur: texte, source: r && r.source });
}
/* Menu principal : « Continuer la partie » sur la sauvegarde la plus récente (carte, manche, date). */
function sauveMenu() {
  const b = $('btn-resume-save');
  if (!b) return;
  if (G.save && G.save.round) {                // ancien rechargement à chaud de claude.ai
    b.hidden = false; b.textContent = `Reprendre à la manche ${G.save.round}`; b.dataset.carte = ''; return;
  }
  sauveStock.liste().then((l) => {
    const s = l.find((x) => MAPS.byId[x.carte]);
    b.hidden = !s;
    if (!s) return;
    b.dataset.carte = s.carte; b.dataset.type = s.type;
    b.replaceChildren(document.createTextNode(s.type === 'secours' ? 'Reprendre la partie interrompue' : 'Continuer la partie'), Object.assign(document.createElement('span'), {
      className: 'save-info', textContent: ` · ${s.apercu.nom}, manche ${s.apercu.manche}, ${sauveDate(s.cree)}`,
    }));
  });
}
function sauveMenuContinuer() {
  const b = $('btn-resume-save');
  if (G.save && G.save.round && !b.dataset.carte) { const s = G.save; G.save = null; startGame(s); return; }
  if (b.dataset.carte) sauveContinuer(b.dataset.carte, b.dataset.type || 'manuelle');
}
/* Confirmation : un écran à part (#confirm), pour qu'Échap annule sans reprendre la partie. */
const SAUVE_CONFIRM = { retour: null, oui: null, autre: null };
function sauveConfirmer({ titre, texte, oui, autre, retour, faire, alt }) {
  SAUVE_CONFIRM.retour = retour; SAUVE_CONFIRM.oui = faire; SAUVE_CONFIRM.autre = alt || null;
  $('confirm-title').textContent = titre; $('confirm-text').textContent = texte;
  $('btn-confirm-yes').textContent = oui;
  $('btn-confirm-alt').hidden = !autre; $('btn-confirm-alt').textContent = autre || '';
  showScreen('confirm');
}
function sauveConfirmFin(choix) {
  const f = choix === 'oui' ? SAUVE_CONFIRM.oui : choix === 'autre' ? SAUVE_CONFIRM.autre : null, retour = SAUVE_CONFIRM.retour;
  SAUVE_CONFIRM.oui = SAUVE_CONFIRM.autre = SAUVE_CONFIRM.retour = null;
  if (f) f(); else if (retour) showScreen(retour);
}
/* Pause : « Quitter au menu » demande confirmation (la partie en cours sera perdue) ; une partie de test des Mod Tools
   revient à l'éditeur sans confirmation, comme avant. */
function sauveQuitterSansSauver() {
  if (G.editorSession) { quitToMenu(); return; }
  sauveConfirmer({ titre: 'Quitter sans sauvegarder ?', texte: 'La partie en cours sera perdue.', oui: 'Quitter sans sauvegarder', retour: 'pause', faire: () => { sauveSecoursEfface(); quitToMenu(); } });
}
/* Pause : « Quitter le jeu » demande la même confirmation. */
function sauveQuitterJeu(quitter) {
  sauveConfirmer({ titre: 'Quitter le jeu sans sauvegarder ?', texte: 'La partie en cours sera perdue.', oui: 'Quitter le jeu', retour: 'pause', faire: () => { sauveSecoursEfface(); quitter(); } });
}
/* Choix de la carte : une sauvegarde existe ? continuer, ou nouvelle partie qui la remplace (après confirmation). */
function sauveAvantNouvelle(map) {
  if (SAUVE.nouvelleOk === map.id) { SAUVE.nouvelleOk = null; sauveStock.effacer(map.id, 'manuelle'); sauveStock.effacer(map.id, 'secours'); return false; }
  const e = SAUVE.index.get(`${map.id}.manuelle`) || SAUVE.index.get(`${map.id}.secours`);
  if (!e) return false;
  const type = e.type, ap = e.apercu;
  sauveConfirmer({
    titre: `Partie sauvegardée sur ${map.name}`,
    texte: ap ? `Manche ${ap.manche}, ${ap.points} points. Une nouvelle partie remplacera cette sauvegarde.` : 'Cette sauvegarde est abîmée. Une nouvelle partie la remplacera.',
    oui: type === 'secours' ? 'Reprendre la partie interrompue' : 'Continuer la partie', autre: 'Nouvelle partie', retour: 'mapsel',
    faire: () => sauveContinuer(map.id, type),
    alt: () => { SAUVE.nouvelleOk = map.id; playSelectedMap(); },
  });
  return true;
}
/* Fin de la partie : ses sauvegardes de la carte sont effacées (pas de retour en arrière). */
function sauveFinPartie() {
  if (G.editorSession || !G.mapId) return;
  sauveStock.effacer(G.mapId, 'manuelle'); sauveStock.effacer(G.mapId, 'secours');
}
/* --------------------------------------------------------------- secours ---- */
function sauveSecoursEcrire(raison) {
  const S = SAUVE.secours, carte = G.mapId, env = sauveCapter('secours');
  env.raison = raison;
  S.t = G.time; if (G.roundState !== 'active') S.manche = G.round;
  return sauveStock.ecrire(carte, 'secours', env).then((w) => {
    S.derniere = { ok: w.ok, raison, carte, manche: env.apercu.manche, cree: env.cree, erreur: w.erreur || null };
    if (w.ok) document.dispatchEvent(new CustomEvent('zs:secours', { detail: S.derniere }));
    return S.derniere;
  });
}
/* Une fois par seconde : fin de manche, moment important, intervalle ; seulement quand la sauvegarde est permise. */
function sauveSecoursTick() {
  const S = SAUVE.secours;
  if (G.state !== 'playing' || G.editorSession || !G.mapId) return null;
  if (G.time < S.t) { S.t = 0; S.manche = -1; }                  // nouvelle partie
  if (G.roundState === 'intermission' && S.manche !== G.round) S.attente = S.attente || 'manche';
  if (G.time - S.t >= S.intervalle) S.attente = S.attente || 'periodique';
  if (!S.attente || sauveRefus()) return null;
  const raison = S.attente;
  S.attente = null;
  return sauveSecoursEcrire(raison);
}
function sauveSecoursEfface() {
  if (G.mapId && !G.editorSession) sauveStock.effacer(G.mapId, 'secours');
  SAUVE.secours.attente = null;
}
setInterval(sauveSecoursTick, 1000);
{ const add0 = Life.add.bind(Life); Life.add = (k, n) => { add0(k, n); if (SAUVE_IMPORTANTS.has(k) && G.state === 'playing') SAUVE.secours.attente = SAUVE.secours.attente || k; }; }
/* Fermeture normale de la fenêtre pendant une partie : secours à jour si c'est permis, sinon effacée (fermer en plein
   combat ne doit pas ramener en arrière). Un plantage ne passe pas par ici : la dernière secours reste. */
window.addEventListener('pagehide', () => {
  if ((G.state !== 'playing' && G.state !== 'paused') || G.editorSession || !G.mapId) return;
  if (sauveRefus()) { sauveSecoursEfface(); return; }
  sauveSecoursEcrire('fermeture');
});

/* Fermeture de la fenêtre du jeu (croix, Alt+F4) : le launcher la retient et la demande au jeu (zsLauncher.onCloseRequest).
   Partie en cours : la pause, puis « Sauvegarder et quitter », « Quitter sans sauvegarder » ou « Annuler ». */
function sauveFermetureDemandee() {
  const quitter = () => { SAUVE.sortieOk = true; Life.save(); exitLock(); window.zsLauncher.quit(); };
  if ((G.state !== 'playing' && G.state !== 'paused') || G.editorSession) { quitter(); return; }
  if (G.state === 'playing') pauseGame();
  const r = sauveRefus();
  const sansSauver = () => { sauveSecoursEfface(); quitter(); };
  sauveConfirmer(r ? {
    titre: 'Quitter le jeu ?', texte: `La partie en cours sera perdue (sauvegarde impossible : ${r}).`, oui: 'Quitter sans sauvegarder', retour: 'pause', faire: sansSauver,
  } : {
    titre: 'Quitter le jeu ?', texte: 'Vous pouvez sauvegarder la partie avant de quitter.', oui: 'Sauvegarder et quitter', autre: 'Quitter sans sauvegarder', retour: 'pause',
    faire: () => sauverEtQuitter().then((x) => { if (x.ok) quitter(); }), alt: sansSauver,
  });
}
if (window.zsLauncher && typeof window.zsLauncher.onCloseRequest === 'function') {
  window.zsLauncher.onCloseRequest(() => {
    try { sauveFermetureDemandee(); } catch (e) { console.error(e); window.zsLauncher.quit(); }
  });
}

/* Démarrage : une sauvegarde restée dans le stockage du navigateur (jeu lancé par un launcher plus ancien) passe dans
   les fichiers ; « Continuer » depuis l'accueil du launcher (#continuer=<carte>&type=<type>) reprend aussitôt. */
function sauveDemarrage() {
  const importer = sauveStock.nom !== 'fichiers' ? Promise.resolve() : sauveStock.liste().then(() => {
    const attente = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const m = (localStorage.key(i) || '').match(/^zs\.partie\.([a-z0-9_-]+)\.(manuelle|secours)$/);
        if (!m || SAUVE.index.has(`${m[1]}.${m[2]}`)) continue;
        attente.push(sauveNavigateur.lire(m[1], m[2]).then((r) => (r.ok ? sauveStock.ecrire(m[1], m[2], r.env).then((w) => { if (w.ok) sauveNavigateur.effacer(m[1], m[2]); }) : null)));
      }
    } catch (e) { /* stockage indisponible */ }
    return Promise.all(attente);
  });
  return importer.then(() => {
    sauveMenu();
    const h = new URLSearchParams(location.hash.slice(1)), carte = h.get('continuer');
    if (!carte || !/^[a-z0-9_-]{1,64}$/.test(carte)) return null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* adresse gardée */ }
    return sauveContinuer(carte, h.get('type') === 'secours' ? 'secours' : 'manuelle');
  });
}

/* Échap sur la confirmation : annule (sans reprendre la partie ni fermer la sélection). */
document.addEventListener('keydown', (e) => {
  const c = $('confirm');
  if (e.code === 'Escape' && c && !c.hidden) { e.preventDefault(); e.stopImmediatePropagation(); Sound.ui(); sauveConfirmFin(null); }
}, true);
/* API pour l'interface (session Interface) et les essais. */
window.ZSPartie = {
  etat: () => sauveStock.liste(),
  peutSauvegarder: () => { const r = sauveRefus(); return { ok: !r, raison: r }; },
  sauvegarderEtQuitter: sauverEtQuitter,
  quitterSansSauvegarder: () => quitToMenu(),
  continuer: (carte, type) => sauveContinuer(carte, type),
  effacer: (carte, type = 'manuelle') => sauveStock.effacer(carte, type),
  enregistrer: sauveEnregistrer,
  sur: (fn) => document.addEventListener('zs:secours', (e) => fn(e.detail)),   // sauvegarde de secours écrite
};
