/* ------------------------------------------------- Lune : survivre dehors --
   Oxygène (choix d'Anthony : 4 minutes) : la jauge baisse dehors, se remplit dans la base (air
   respirable), une bouteille neuve aux postes d'oxygène (250 points) ; à zéro, la vie s'en va.
   Son (choix d'Anthony : « combinaison seulement ») : dehors, rien du monde ne s'entend ; le souffle,
   les alarmes, et ses propres gestes étouffés par la combinaison (arme, pas). Dans la base, le son
   normal. */
const LUO = { max: 240, o2: 240, warn: 0, hurtT: 0, breathT: 0, el: null, fill: null, txt: null, muffled: null, mT: 0 };
/* Dans la base (volume pressurisé) : le moyeu, les quatre modules, les sas jusqu'à leur porte.
   Jeu 2.0.3 : le moyeu et chaque module à leur pose (le point ramené dans leur repère d'origine). */
const _luIn = new THREE.Vector3();
function luInsideAt(x, y, z) {
  const B = LUPL.base, N = LUPL.nodes || {};
  if (!B || !OW_BASES[OW.baseId] || !OW_BASES[OW.baseId].places) return false;
  if (!N.hub || !owNodeHidden(N.hub)) {
    const q = owLoc(N.hub, x, y, z, _luIn), dx = q.x - B.x, dz = q.z - B.z;
    if (q.y >= B.y - 1 && q.y <= B.y + 6 && Math.abs(dx) <= 30 && Math.abs(dz) <= 30 && luOctD(dx, dz)[0] < B.ap + 0.3) return q.y < B.y + B.h + 2;
  }
  for (const [dir, nx, nz] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['o', -1, 0]]) {
    const A = B[dir], n = N.arm && N.arm[dir];
    if (!A || owNodeHidden(n)) continue;
    const q = owLoc(n, x, y, z, _luIn), dx = q.x - B.x, dz = q.z - B.z;
    if (q.y < B.y - 1 || q.y > B.y + 6 || Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
    const s = dx * nx + dz * nz, l = -dx * nz + dz * nx;
    if (s >= A.s0 - 0.5 && s <= A.s1 + (A.air ? 4.4 : 0) && Math.abs(l) < B.aw + 0.2) return q.y < B.y + B.ah + 0.6;
  }
  return false;
}
/* Un son du monde s'entend-il ? Dehors, non ; dans la base, ceux de la base. */
function luHears(pos) {
  if (!LU.inside) return false;
  return luInsideAt(pos.x, pos.y === undefined ? LUPL.base.y + 1 : pos.y, pos.z);
}
const luO2Text = () => { const s = Math.ceil(LUO.o2); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---- Jauge d'oxygène (en bas à gauche, au-dessus des atouts) */
function luO2Hud(on) {
  if (on && !LUO.el) {
    const st = document.createElement('style');
    st.textContent = `.lu-o2 { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #cfeee0; text-shadow: 0 2px 0 rgba(0,0,0,0.6); letter-spacing: 0.08em; }
.lu-o2 .l { font-size: 15px; }
.lu-o2 .b { width: 168px; height: 9px; background: rgba(0,0,0,0.55); box-shadow: 0 0 0 1px rgba(160,230,200,0.55); }
.lu-o2 .b i { display: block; height: 100%; width: 100%; background: #5fd8a8; transition: background 0.3s; }
.lu-o2 .t { font-size: 16px; font-variant-numeric: tabular-nums; min-width: 3.2em; }
.lu-o2.low .b i { background: #f0a33a; } .lu-o2.low { color: #f5d6a0; }
.lu-o2.crit .b i { background: #e2402a; } .lu-o2.crit { color: #ffb4a4; animation: luo2 0.8s steps(1) infinite; }
.lu-o2.in .l::after { content: ' · air'; font-weight: 600; color: #9fd8ff; }
@keyframes luo2 { 50% { opacity: 0.45; } }
#hud .lu-visor { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 72% 82% at 50% 48%, transparent 76%, rgba(10,14,20,0.35) 92%, rgba(4,6,10,0.75) 100%); }
#hud .lu-visor.in { opacity: 0; }`;
    document.head.appendChild(st);
    const bl = $('bl');
    LUO.el = el('div', 'lu-o2');
    LUO.el.innerHTML = '<span class="l">O₂</span><span class="b"><i></i></span><span class="t">4:00</span>';
    LUO.fill = LUO.el.querySelector('.b i'); LUO.txt = LUO.el.querySelector('.t');
    bl.insertBefore(LUO.el, bl.firstChild);
    LUO.visor = el('div', 'lu-visor');
    $('hud').insertBefore(LUO.visor, $('hud').firstChild);
  }
  if (LUO.el) { LUO.el.hidden = !on; LUO.visor.hidden = !on; }
}
function luO2HudUpdate() {
  if (!LUO.el || LUO.el.hidden) return;
  const k = LUO.o2 / LUO.max;
  LUO.fill.style.width = `${(k * 100).toFixed(1)}%`;
  LUO.txt.textContent = luO2Text();
  LUO.el.classList.toggle('low', LUO.o2 < 60 && LUO.o2 >= 20);
  LUO.el.classList.toggle('crit', LUO.o2 < 20);
  LUO.el.classList.toggle('in', !!LU.inside);
  LUO.visor.classList.toggle('in', !!LU.inside);
}
/* ---- Chaque image : dedans ou dehors, oxygène, souffle, étouffement */
function luLife(dt) {
  const p = player;
  LU.inside = luInsideAt(p.pos.x, p.gy + p.y + 1.2, p.pos.z);
  // étouffement des sons : la combinaison dehors (redit chaque seconde : d'autres effets le changent)
  LUO.mT -= dt;
  if (LUO.muffled !== !LU.inside || LUO.mT <= 0) { LUO.muffled = !LU.inside; LUO.mT = 1; Sound.setMuffle(LU.inside ? (p.down ? true : false) : 520); }
  if (G.state !== 'playing') { luO2HudUpdate(); return; }
  if (LU.inside) LUO.o2 = Math.min(LUO.max, LUO.o2 + dt * 30);
  else if (!p.down) LUO.o2 = Math.max(0, LUO.o2 - dt * (p.sprinting ? 1.25 : 1));
  // alertes de la combinaison
  const lv = LUO.o2 <= 0 ? 4 : LUO.o2 < 10 ? 3 : LUO.o2 < 30 ? 2 : LUO.o2 < 60 ? 1 : 0;
  if (lv > LUO.warn) {
    luSuitBeep(lv);
    if (lv === 1) HUD.banner('Oxygène', 'Une minute · rentrez à la base ou changez de bouteille', 'power');
    else if (lv === 2) HUD.banner('Oxygène', '30 secondes', 'power');
    else if (lv === 4) HUD.banner('Plus d’oxygène', 'Vous suffoquez', 'power');
  }
  LUO.warn = lv;
  if (LUO.o2 <= 0 && !p.down) {
    LUO.hurtT -= dt;
    if (LUO.hurtT <= 0) { LUO.hurtT = 0.5; playerDamage(p.maxHp * 0.05, true); }
  } else LUO.hurtT = 0;
  // souffle dans le casque (dehors) : plus court en courant, haletant sans oxygène
  if (!LU.inside && !p.down) {
    LUO.breathT -= dt;
    if (LUO.breathT <= 0) { const fast = p.sprinting || LUO.o2 < 20; LUO.breathT = fast ? rand(1.6, 2.0) : rand(3.2, 4.2); luBreath(fast, LUO.o2 <= 0); }
  }
  luO2HudUpdate();
}
/* Souffle : inspiration puis expiration (bruit filtré), dans le casque. */
function luBreath(fast, gasp) {
  const B = Sound.suitBus && Sound.suitBus();
  if (!B) return;
  const ctx = B.ctx, t = ctx.currentTime, v = (gasp ? 0.05 : 0.026) * (fast ? 1.4 : 1);
  const len = Math.floor(ctx.sampleRate * 1.6), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const seg = (t0, dur, f0, f1, peak) => {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + dur); f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(B.sortie);
    s.start(t0); s.stop(t0 + dur + 0.05);
  };
  const a = fast ? 0.42 : 0.75;
  seg(t, a, 700, 1300, v);
  seg(t + a + 0.12, a * 1.3, 1100, 520, v * 1.15);
}
/* Bip de la combinaison (alertes : 1 à 4 bips, plus aigus). */
function luSuitBeep(n) {
  const B = Sound.suitBus && Sound.suitBus();
  if (!B) return;
  const ctx = B.ctx, t = ctx.currentTime;
  for (let i = 0; i < Math.min(4, n); i++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1320 + n * 120;
    g.gain.setValueAtTime(0.0001, t + i * 0.18); g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.18 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.12);
    o.connect(g); g.connect(B.sortie); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.14);
  }
}
/* Grondement transmis par le sol et la coque (explosion du dépôt entendue de la base, départs). */
function luRumble(k = 1, dur = 2.4) {
  const B = Sound.suitBus && Sound.suitBus();
  if (!B) return;
  const ctx = B.ctx, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(24, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * k, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(B.sortie); o.start(t); o.stop(t + dur + 0.05);
  const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.04); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
  s.connect(f); f.connect(g2); g2.connect(B.sortie); s.start(t); s.stop(t + dur);
}
function luLifeReset() { LUO.o2 = LUO.max; LUO.warn = 0; LUO.hurtT = 0; LUO.breathT = 2; }
