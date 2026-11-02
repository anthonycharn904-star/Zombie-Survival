/* ============================================================== 25 PANNEAU DE TEST DU BOSS ==
   Panneau de test développeur du combat du boss de Bunker 7 (jeu 2.0.7, étape 7 du brief, §14 ; suivi : SUIVI-BOSS-B7.md),
   comme le panneau P du prototype d'Anthony (prototype/index.html) : aller à chaque état du combat, joueur invincible,
   raccourcis (âmes, segment à 1 PV, tirs sur le Septième, seuil suivant des mini-boss, mini-boss à 49 % pour sa rage,
   mini-boss tué, phase 3 sous 50 % pour les salves, palier suivant de la phase 5), vitesse du temps, volumes du combat,
   drapeau « combat terminé » remis à zéro, état du combat en direct. Sans lui, chaque vérification demande un combat
   complet (≈ 14 min).
   · Seulement dans une partie de test des Mod Tools (G.editorSession : le launcher n'installe les Mod Tools que chez
     l'auteur), sur Bunker 7 avec le combat. F8 l'ouvre et le ferme (P et Échap restent la pause du jeu).
   · Ouvert : la souris est libérée sans mettre le jeu en pause (souris libre du jeu) ; les clics, la molette et les
     mouvements de la souris sur le panneau ne vont pas au jeu. Fermé : la souris est reprise.
   · Phase 5, défaite, fin : tant que les points de Bunker 7 (arene.bunker7) sont vides (étape 8 du suivi), le joueur est
     posé au départ de Bunker 7.
   · Vitesse du temps : la boucle du jeu passe par b7Pas (×0,5 : un pas plus court ; ×2 et ×4 : plusieurs pas par
     image, chacun de la durée normale) ; ×1 hors du panneau.
   ============================================================================ */
const B7P = { el: null, ouvert: false, vitesse: 1, txt: null, inv: null, god: false };   // god : invincibilité donnée par le panneau
const B7P_ETATS = ['introduction', 'phase1', 'repit', 'phase2', 'transition23', 'absence', 'retour', 'phase3', 'transition34', 'rituel',
  'rituel_fin', 'faiblesse', 'transition45', 'phase5', 'defaite', 'retour_salle', 'conclusion', 'termine'];
const B7P_CSS = `#b7p{position:fixed;right:10px;top:10px;bottom:10px;width:280px;overflow:auto;z-index:100;background:rgba(12,9,8,.92);border:1px solid #5a4636;padding:10px;font:12px system-ui,sans-serif;color:#e9dcc6;user-select:none}
#b7p[hidden]{display:none}
#b7p h3{margin:10px 0 5px;font:600 13px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#d08a52}
#b7p h3:first-child{margin-top:0}
#b7p button{margin:2px;padding:4px 7px;font:12px system-ui,sans-serif;color:#eee;background:#2a2220;border:1px solid #4a3a33;cursor:pointer}
#b7p button:hover{background:#3a2e2a}
#b7p button.on{background:#5a3a22;border-color:#d08a52}
#b7p label{display:block;margin:4px 0}
#b7p input[type=range]{width:150px;vertical-align:middle}
#b7p pre{margin:6px 0 0;font:11px/1.35 ui-monospace,Consolas,monospace;white-space:pre-wrap;color:#cbbca4}
#b7p .aide{color:#9c8e7a;font-size:11px}`;

/* Le panneau est-il permis ? Partie de test des Mod Tools, sur Bunker 7, avec le combat. */
function b7PanneauPermis() {
  return !!G.editorSession && b7Carte() && B7S.actif && !!B7.combat && (G.state === 'playing' || G.state === 'paused');
}
function b7PanneauCreer() {
  if (B7P.el) return;
  const st = document.createElement('style');
  st.textContent = B7P_CSS;
  document.head.appendChild(st);
  const P = document.createElement('aside');
  P.id = 'b7p'; P.hidden = true;
  const etats = B7P_ETATS.map((n) => `<button data-d="etat:${n}">${n}</button>`).join('');
  P.innerHTML = `<h3>Aller à l’état</h3>${etats}
<h3>Combat</h3><button data-d="ames">+10 âmes (ailes)</button><button data-d="pv1">Segment à 1 PV</button><button data-d="tirs">10 tirs sur le Septième</button>
<label><input type="checkbox" data-d="invincible"> joueur invincible</label>
<h3>Mini-boss (phase 2)</h3><button data-d="mbSeuil">Seuil suivant (75 %, 50 %, 25 %)</button><button data-d="mbRage">Mini-boss à 49 % (rage)</button><button data-d="mbTuer">Tuer le mini-boss</button>
<h3>Phases 3 et 5</h3><button data-d="salves">Phase 3 sous 50 % (salves)</button><button data-d="palier">Palier suivant (phase 5)</button>
<h3>Temps</h3><button data-d="v0.5">×0,5</button><button data-d="v1" class="on">×1</button><button data-d="v2">×2</button><button data-d="v4">×4</button>
<h3>Sons du combat</h3><label>Musique <input type="range" min="0" max="2" step="0.05" value="1.4" data-vol="musique"></label><label>Effets <input type="range" min="0" max="1.2" step="0.05" value="1" data-vol="effets"></label>
<h3>Partie</h3><button data-d="drapeau">Drapeau « combat terminé » remis à zéro</button>
<h3>État</h3><pre></pre><div class="aide">F8 : fermer le panneau · P, Échap : pause</div>`;
  // la souris sur le panneau ne va pas au jeu (regard, tir, molette, menu contextuel)
  for (const t of ['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu', 'click']) P.addEventListener(t, (e) => e.stopPropagation());
  P.querySelectorAll('button[data-d]').forEach((b) => b.addEventListener('click', () => { b7PanneauAction(b.dataset.d); b.blur(); }));
  B7P.inv = P.querySelector('input[data-d=invincible]');
  B7P.inv.addEventListener('change', () => { G.god = B7P.god = B7P.inv.checked; B7P.inv.blur(); });
  P.querySelectorAll('input[data-vol]').forEach((r) => r.addEventListener('input', () => { if (B7.audio) B7.audio.setVolume(r.dataset.vol, +r.value); }));
  document.body.appendChild(P);
  B7P.el = P; B7P.txt = P.querySelector('pre');
}
/* F8 : ouvre ou ferme le panneau ; ouvert, la souris est libre et le jeu continue. */
function b7PanneauBasculer(ouvrir = !B7P.ouvert) {
  if (ouvrir && !b7PanneauPermis()) return false;
  b7PanneauCreer();
  B7P.ouvert = ouvrir;
  B7P.el.hidden = !ouvrir;
  if (ouvrir) {
    B7P.inv.checked = !!G.god;
    Input.fallback = true;                           // souris libre posée avant de la lâcher : le jeu ne se met pas en pause
    exitLock();
    HUD.el.lockhint.hidden = true;
    b7PanneauEtat();
  } else {
    setFallback(false);
    if (G.state === 'playing') requestLock();
  }
  return true;
}
window.addEventListener('keydown', (e) => {
  if (e.code !== 'F8' || e.repeat) return;
  if (!B7P.ouvert && !b7PanneauPermis()) return;
  e.preventDefault();
  b7PanneauBasculer();
});
// état en direct (4 fois par seconde, pause comprise) ; fermé dès qu'il n'est plus permis (fin du test, autre carte)
setInterval(() => {
  if (!B7P.ouvert) return;
  if (!b7PanneauPermis()) { b7PanneauBasculer(false); b7PanneauRemettre(); return; }
  b7PanneauEtat();
}, 250);
/* Fin d'une partie de test, nouvelle partie : vitesse × 1 ; l'invincibilité donnée par le panneau est retirée (sinon elle
   suivrait le joueur dans les parties suivantes, sur toutes les cartes, sans case pour la décocher). */
function b7PanneauRemettre() {
  b7PanneauVitesse(1);
  if (!B7P.god) return;
  G.god = B7P.god = false;
  if (B7P.inv) B7P.inv.checked = false;
}
function b7PanneauVitesse(v) {
  B7P.vitesse = v;
  if (B7P.el) B7P.el.querySelectorAll('button[data-d^=v]').forEach((b) => b.classList.toggle('on', +b.dataset.d.slice(1) === v));
}

/* ------------------------------------------------------------- Actions --- */
function b7PanneauAction(d) {
  const C = B7.combat;
  if (!C) return;
  if (d.startsWith('etat:')) { b7PanneauAller(d.slice(5)); return; }
  if (d[0] === 'v' && d.length > 1 && !isNaN(+d.slice(1))) { b7PanneauVitesse(+d.slice(1)); b7PanneauEtat(); return; }
  const e = C.etat(), cfg = C.config;
  switch (d) {
    case 'ames': C.forcer('ames', 10); break;
    case 'pv1': C.forcer('pvSegment', 1); break;
    case 'tirs': {                                   // 10 balles du prototype (120), à l'échelle de DPS_REFERENCE
      const M = B7V.modele, b = e.boss;
      if (!M || !b.present || !b.visible) break;
      const hb = M.hitboxes();
      for (let i = 0; i < 10; i++) { const h = hb[i % hb.length]; C.toucherBoss({ joueur: B7.id, degats: 120 * cfg.dpsReference / 350, zone: h.zone, position: { x: h.centre.x, y: h.centre.y, z: h.centre.z }, type: 'balle' }); }
      break;
    }
    case 'mbSeuil': {                                // PV du Septième juste sous le prochain seuil de mini-boss (phase 2)
      if (e.etat !== 'phase2') b7PanneauAller('phase2');
      const e2 = C.etat(), S = (cfg.miniBoss || {}).seuils || [];
      const k = (e2.tubes || []).filter((t) => t.etat !== 'intact').length;
      if (k < S.length && !e2.boss.protege) C.forcer('pvSegment', Math.max(1, (S[k] - 0.01) * e2.barre.max));
      break;
    }
    case 'mbRage':                                   // PV du mini-boss juste sous la moitié : sa rage
      for (const m of e.miniBoss || []) {
        const z = m.etat === 'actif' && B7E.ents.get(m.id), q = z && B7E.Z.obtenir(m.id);
        for (let k = 0; q && k < 200 && q.pv / q.pvMax >= 0.495; k++) {
          damageZombie(z, 0.02 * q.pvMax, { kind: 'bullet', dx: 0, dz: 1 });
          if (!B7V.touche) break;                    // invulnérable (rage déjà lancée)
        }
      }
      break;
    case 'mbTuer':
      for (const m of e.miniBoss || []) { const z = m.etat === 'actif' && B7E.ents.get(m.id); if (z && z.alive) damageZombie(z, 1e9, { kind: 'bullet', dx: 0, dz: 1 }); }
      break;
    case 'salves':                                   // phase 3, PV sous 50 % : les arrachements deviennent des salves
      if (e.etat !== 'phase3') b7PanneauAller('phase3');
      C.forcer('pvSegment', 0.49 * C.etat().barre.max);
      break;
    case 'palier': {                                 // jauge de la phase 5 juste au-dessus du seuil du palier suivant
      if (e.etat !== 'phase5') b7PanneauAller('phase5');
      const e5 = C.etat(), SP = ((cfg.phase5 || {}).paliers || {}).seuils || [], np = e5.boss.palier || 0;
      if (np < SP.length) C.forcer('jauge', Math.min(0.99, SP[np] + 0.02));
      break;
    }
    case 'drapeau': B7.drapeaux[cfg.general.drapeauTermine] = false; break;
  }
  b7PanneauEtat();
}
/* Aller à un état : comme le prototype (le combat démarre s'il ne l'est pas ; « introduction » repart de Bunker 7). */
function b7PanneauAller(n) {
  const C = B7.combat;
  if (n === 'introduction') { C.allerA('inactif'); b7AuDepart(); C.demarrer(); return; }
  if (C.etat().etat === 'inactif') C.demarrer();
  C.allerA(n);
  if (C.etat().lieu === 'bunker' && !(BOSS_B7_ARENE.bunker7.arriveeJoueurs || []).length) b7AuDepart();   // points de Bunker 7 : étape 8
}
/* Boucle du jeu (frame) : la vitesse du temps du panneau (×1 sinon). */
function b7Pas(dt) {
  const v = B7P.vitesse;
  if (v === 1) { update(dt); return; }
  if (v < 1) { update(dt * v); return; }
  for (let i = 0; i < v && G.state === 'playing'; i++) {
    if (i) endFrameInput();                          // les commandes de l'image ne comptent qu'une fois
    update(dt);
  }
}

/* ------------------------------------------------------------- État --- */
function b7PanneauEtat() {
  const C = B7.combat;
  if (!B7P.txt || !C) return;
  const e = C.etat(), b = e.boss, f = (x, n = 0) => (x == null ? '-' : (+x).toFixed(n));
  const L = [`état ${e.etat} (${f(e.tempsEtat, 1)} s) · vitesse ×${B7P.vitesse}`, `phase ${e.phase} · lieu du combat ${e.lieu} · joueur ${B7.lieu}`];
  L.push(`Septième ${b.present ? b.locomotion : 'absent'}${b.action ? ` · ${b.action.id}/${b.action.etape}` : ''}${b.protege ? ' · PROTÉGÉ' : ''}${b.intangible ? ' · intangible' : ''}`);
  L.push(`âmes ${b.ames} · ailes ${b.ailes} · lames ${b.lames}${b.palier != null ? ` · palier ${b.palier}` : ''}`);
  if (e.barre) L.push(`barre ${f(e.barre.valeur)} / ${f(e.barre.max)} (segment ${e.barre.segment})`);
  if (e.capture) L.push(`capture ${e.capture.etat} ${f(e.capture.progression * 100)} %`);
  if (e.jauge) L.push(`jauge ${f(e.jauge.valeur * 100)} %`);
  for (const m of e.miniBoss || []) L.push(`${m.nom} ${f(Math.ceil(m.pv))} / ${f(Math.ceil(m.pvMax))} PV${m.etat === 'mort' ? ' (mort)' : ''}${m.invulnerable ? ' · invulnérable' : ''}`);
  let zb = 0, ch = 0;
  for (const z of Zombies.list) if (z.alive && z.b7) { if (z.dog) ch++; else zb++; }
  L.push(`zombies ${zb} · chiens ${ch} · entités du module ${B7E.Z ? B7E.Z.liste().length : 0}`);
  L.push(`joueur ${Math.ceil(player.hp)} / ${player.maxHp} PV${G.god ? ' (invincible)' : ''}${B7J.etourdiT > 0 ? ' · étourdi' : ''}`);
  L.push(`drapeau terminé : ${B7.drapeaux[C.config.general.drapeauTermine] ? 'oui' : 'non'}`);
  B7P.txt.textContent = L.join('\n');
}
