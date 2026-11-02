/*!
 * proto-joueur.js — Joueur FPS du prototype : souris verrouillée, ZQSD et WASD (touches physiques), sprint,
 * saut, collisions, PV avec régénération façon CoD, invulnérabilité, verrouillage des commandes, rotation de
 * caméra forcée (séquences), réactions aux coups (secousse, recul de caméra), vignette de dégâts.
 *
 *   const j = ProtoB7Joueur.creer(THREE, { monde, camera, element: renderer.domElement, id: 'j1', lieu: 'salle',
 *                                          position: {x,y,z}, lacet: 0, pvMax: 100, vignette: true });
 *   j.mettreAJour(dt, temps)            // déplacement, caméra, régénération
 *   j.infligerDegats(fraction, { source, ignorerReductions, direction })   // fraction des PV max
 *   j.blessureCritique(fraction)        // PV = min(PV, fraction × PV max), ne tue jamais
 *   j.teleporter(pos, lacet, lieu) ; j.regarder(point, duree) ; j.definirControle(bool) ; j.definirInvulnerable(bool)
 *   j.vue()                             // { id, position, vitesse, lacet, vivant, aTerre, lieu, pvFraction }
 *   j.flou(duree) ; j.flouRestant()     // vision brouillée (décharge du Survolté, v1.3) : flou + éblouissement qui s'estompe
 *   j.etourdir(duree) ; j.etourdiRestant()   // v1.4 : ni déplacement, ni saut, ni tir, ni rechargement ; vue libre qui tremble,
 *                                            // voile électrique bref (l'arme lit j.etourdiT)
 *   j.tirerVers(position)               // v1.4 (crochets) : déplacement forcé, sans résolution de collision ; vitesse remise à 0
 *   j.projeter(vx, vz, duree)           // v1.5 (charge du Démembré) : projeté à (vx, vz) m/s pendant `duree` s, commandes coupées,
 *                                       // collisions comprises ; un mur de la salle heurté → j.surImpactMur({ x, z, vitesse }) et
 *                                       // évènement 'impactMur' (fin de la projection) ; j.projectionRestante()
 *   j.entree                            // { tir, viser, recharger, interagir, sprint, ... } (lu par l'arme, l'interaction)
 *   j.on('degats' | 'mort' | 'teleport' | 'reapparition', fn)
 * Global : ProtoB7Joueur.
 */
(function (root) {
  'use strict';
  var U = root.ProtoB7Commun;

  var REGLAGES = {
    marche: 4.6, sprint: 6.6, recul: 3.8, lateral: 4.3, visee: 0.62,
    acceleration: 38, freinage: 30, accelerationAir: 6,
    saut: 4.7, gravite: 14, hauteurYeux: 1.62, rayon: 0.35,
    sensibilite: 0.0022,
    delaiRegen: 3.5, vitesseRegen: 0.5,            // PV max par seconde après le délai
    fov: 75, fovVisee: 55
  };

  function creer(THREE, o) {
    o = o || {};
    var R = {};
    for (var k in REGLAGES) R[k] = o.reglages && o.reglages[k] != null ? o.reglages[k] : REGLAGES[k];
    var monde = o.monde, camera = o.camera, element = o.element || (typeof document !== 'undefined' ? document.body : null);
    var j = {
      id: o.id || 'j1', lieu: o.lieu || 'salle', reglages: R,
      position: new THREE.Vector3(o.position ? o.position.x : 0, o.position ? o.position.y || 0 : 0, o.position ? o.position.z : 0),
      vitesse: new THREE.Vector3(), lacet: o.lacet || 0, tangage: 0,
      pvMax: o.pvMax || 100, pv: o.pvMax || 100, vivant: true, aTerre: false,
      invulnerable: false, invulnerableJusqua: 0, controle: true, auSol: true,
      dernierDegat: -99, temps: 0, mort: false,
      atouts: {}, entree: { avant: 0, droite: 0, sprint: false, saut: false, tir: false, viser: false, recharger: false, interagir: false },
      camera: camera
    };
    var ecout = {};
    j.on = function (t, f) { (ecout[t] = ecout[t] || []).push(f); return function () { ecout[t] = ecout[t].filter(function (x) { return x !== f; }); }; };
    function emettre(t, d) { (ecout[t] || []).forEach(function (f) { try { f(d); } catch (e) { setTimeout(function () { throw e; }); } }); }

    // ── commandes (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY) ──
    var touches = {};
    var verrou = false;
    function onKey(e, bas) {
      if (e.repeat && bas) return;
      touches[e.code] = bas;
      if (e.code === 'KeyR' && bas) j.entree.recharger = true;
      if (e.code === 'Space' && bas) j.entree.saut = true;
      if (['Space', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0 && verrou) e.preventDefault();
    }
    var kd = function (e) { onKey(e, true); }, ku = function (e) { onKey(e, false); };
    var mm = function (e) {
      if (!verrou || !j.controle || regard) return;
      j.lacet -= e.movementX * R.sensibilite * (j.entree.viser ? 0.7 : 1);
      j.tangage -= e.movementY * R.sensibilite * (j.entree.viser ? 0.7 : 1);
      j.tangage = U.clamp(j.tangage, -1.5, 1.5);
    };
    var md = function (e) {
      if (!verrou) { if (element && element.requestPointerLock && o.verrouAuClic !== false) { try { element.requestPointerLock(); } catch (er) { /* */ } } return; }
      if (e.button === 0) j.entree.tir = true;
      if (e.button === 2) j.entree.viser = true;
    };
    var mu = function (e) { if (e.button === 0) j.entree.tir = false; if (e.button === 2) j.entree.viser = false; };
    var plc = function () { verrou = typeof document !== 'undefined' && document.pointerLockElement === element; if (!verrou) { j.entree.tir = false; j.entree.viser = false; } };
    var cm = function (e) { e.preventDefault(); };
    j.attacher = function () {
      if (typeof window === 'undefined') return;
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      document.addEventListener('mousemove', mm); element.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
      document.addEventListener('pointerlockchange', plc); element.addEventListener('contextmenu', cm);
    };
    j.detacher = function () {
      if (typeof window === 'undefined') return;
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      document.removeEventListener('mousemove', mm); element.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu);
      document.removeEventListener('pointerlockchange', plc); element.removeEventListener('contextmenu', cm);
    };
    j.verrouille = function () { return verrou; };
    if (o.clavier !== false) j.attacher();

    // ── vignette de dégâts (DOM) ──
    var vig = null;
    if (o.vignette !== false && typeof document !== 'undefined') {
      vig = document.createElement('div');
      vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .08s linear;' +
        'background:radial-gradient(ellipse at center, rgba(120,0,0,0) 45%, rgba(150,0,0,.55) 78%, rgba(90,0,0,.9) 100%)';
      (o.conteneur || document.body).appendChild(vig);
    }
    var flashDegats = 0;

    // ── vision brouillée (v1.3, décharge du Survolté) : couche floutée + éblouissement cyan, DOM par-dessus le canevas
    //    (le rendu WebGL n'est pas touché ; l'interface, au-dessus, reste nette). Opacités précalculées : aucune allocation. ──
    var flouEl = null, eblouEl = null, flouT = 0, flouD = 0, flouAge = 99, pasFlou = -1, pasEblou = -1, OPA = [];
    for (var qo = 0; qo <= 40; qo++) OPA.push(String(qo / 40));
    if (o.flou !== false && typeof document !== 'undefined') {
      flouEl = document.createElement('div');
      flouEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:rgba(150,220,255,0.10);' +
        '-webkit-backdrop-filter:blur(7px) brightness(1.3) saturate(0.5);backdrop-filter:blur(7px) brightness(1.3) saturate(0.5)';
      eblouEl = document.createElement('div');
      eblouEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;mix-blend-mode:screen;' +
        'background:radial-gradient(ellipse at center, rgba(240,253,255,0.95) 0%, rgba(160,232,255,0.62) 32%, rgba(70,180,255,0.28) 68%, rgba(30,100,210,0.08) 100%)';
      (o.conteneur || document.body).appendChild(flouEl); (o.conteneur || document.body).appendChild(eblouEl);
    }
    /** Vision brouillée pendant `duree` s (la plus longue l'emporte) : éblouissement immédiat, flou qui s'estompe sur la fin. */
    j.flou = function (duree) {
      duree = duree > 0 ? duree : 1;
      if (duree >= flouT) { flouT = duree; flouD = duree; }
      flouAge = 0;
      return flouT;
    };
    j.flouRestant = function () { return flouT; };
    // ── étourdissement (v1.4, décharge du Survolté) : ni déplacement, ni saut, ni tir, ni rechargement ; la vue reste libre mais
    //    tremble ; voile électrique bref (éclairs SVG redessinés à chaque étourdissement, pas à chaque image) ──
    j.etourdiT = 0;
    var voileEl = null, voileAge = 99, pasVoile = -1, eclairs = [], etourdiD = 1;
    if (o.etourdissement !== false && typeof document !== 'undefined' && document.createElementNS) {
      voileEl = document.createElement('div');
      voileEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;mix-blend-mode:screen;' +
        'background:radial-gradient(ellipse at center, rgba(110,215,255,0.04) 35%, rgba(70,180,255,0.32) 80%, rgba(150,230,255,0.55) 100%)';
      var NSV = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NSV, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
      for (var ke = 0; ke < 8; ke++) {
        var pl = document.createElementNS(NSV, 'polyline');
        pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', ke % 2 ? '#f2fdff' : '#6fe0ff'); pl.setAttribute('stroke-width', ke % 2 ? '0.25' : '0.6'); pl.setAttribute('stroke-linejoin', 'bevel');
        svg.appendChild(pl); eclairs.push(pl);
      }
      voileEl.appendChild(svg);
      (o.conteneur || document.body).appendChild(voileEl);
    }
    function dessinerEclairs() {
      for (var k = 0; k < eclairs.length; k++) {
        var bord = k % 4, x = bord === 0 ? 0 : bord === 1 ? 100 : 10 + Math.random() * 80, y = bord === 2 ? 0 : bord === 3 ? 100 : 10 + Math.random() * 80;
        var tx = 32 + Math.random() * 36, ty = 32 + Math.random() * 36, pts = [];
        for (var q = 0; q <= 7; q++) { var f = q / 7 * 0.7; pts.push((x + (tx - x) * f + (q ? (Math.random() - 0.5) * 7 : 0)).toFixed(1) + ',' + (y + (ty - y) * f + (q ? (Math.random() - 0.5) * 7 : 0)).toFixed(1)); }
        eclairs[k].setAttribute('points', pts.join(' '));
      }
    }
    /** Étourdi pendant `duree` s (la plus longue l'emporte). Sans effet sur un joueur mort. */
    j.etourdir = function (duree) {
      if (!j.vivant) return 0;
      duree = duree > 0 ? duree : 1;
      if (duree > j.etourdiT) { j.etourdiT = duree; etourdiD = duree; }
      voileAge = 0; dessinerEclairs();
      emettre('etourdi', { duree: duree });
      return j.etourdiT;
    };
    j.etourdiRestant = function () { return j.etourdiT; };
    function majEtourdi(dt) {
      if (j.etourdiT > 0) j.etourdiT = Math.max(0, j.etourdiT - dt);
      if (voileAge >= 99) return;
      voileAge += dt;
      var k = Math.max(0, 1 - voileAge / 0.4), op = k * (0.75 + 0.25 * Math.sin(voileAge * 60));
      if (voileEl) { var pv = Math.round(Math.max(0, op) * 40); if (pv !== pasVoile) { pasVoile = pv; voileEl.style.opacity = OPA[pv]; } }
      if (voileAge > 0.45) { voileAge = 99; if (voileEl && pasVoile !== 0) { pasVoile = 0; voileEl.style.opacity = OPA[0]; } }
    }
    // ── projection (v1.5, charge du Démembré) : vitesse imposée qui faiblit, petit décollage, commandes coupées ; collisions comprises ──
    var projT = 0, projD = 0, projVx = 0, projVz = 0;
    j.projeter = function (vx, vz, duree) {
      if (!j.vivant || !isFinite(vx) || !isFinite(vz) || !(duree > 0)) return false;
      projVx = vx; projVz = vz; projT = duree; projD = duree;
      j.vitesse.x = vx; j.vitesse.z = vz;
      if (j.auSol) { j.vitesse.y = 2.4; j.auSol = false; }
      j.secousse(0.07, 0.45);
      emettre('projection', { vx: vx, vz: vz, duree: duree });
      return true;
    };
    j.projectionRestante = function () { return projT; };
    j.surImpactMur = null;                                // posé par l'adaptateur (dégâts impactMur de la charge)
    // ── déplacement forcé (v1.4, traction des crochets du Septième) : place le joueur sans résolution de collision ; vitesse
    //    horizontale remise à zéro (ni saut de vitesse ni balancement de caméra) ; position invalide refusée ──
    var forceT = 0;
    j.tirerVers = function (p) {
      if (!p || !isFinite(p.x) || !isFinite(p.z) || (p.y != null && !isFinite(p.y))) return false;
      j.position.x = p.x; j.position.z = p.z;
      if (p.y != null) j.position.y = Math.max(0, p.y);
      j.vitesse.x = 0; j.vitesse.z = 0; if (j.vitesse.y > 0) j.vitesse.y = 0; projT = 0;
      forceT = 0.15;                                     // la résolution des collisions reprend 0,15 s après le dernier appel
      return true;
    };
    function majFlou(dt) {
      if (flouT <= 0 && flouAge >= 99) return;
      flouT = Math.max(0, flouT - dt); flouAge += dt;
      var kf = flouD > 0 ? flouT / flouD : 0;
      var opF = Math.min(1, kf * 1.8), e0 = Math.max(0, 1 - flouAge / 0.45), opE = Math.min(1, e0 * e0 * 0.85 + 0.18 * kf);
      if (flouEl) { var p1 = Math.round(opF * 40); if (p1 !== pasFlou) { pasFlou = p1; flouEl.style.opacity = OPA[p1]; } }
      if (eblouEl) { var p2 = Math.round(opE * 40); if (p2 !== pasEblou) { pasEblou = p2; eblouEl.style.opacity = OPA[p2]; } }
      if (flouT <= 0 && flouAge > 0.5) flouAge = 99;
    }

    // ── regard forcé ──
    var regard = null;   // { l0, t0, l1, t1, t, d }
    j.regarder = function (p, duree) {
      var eye = j.position.y + R.hauteurYeux;
      var dx = p.x - j.position.x, dz = p.z - j.position.z, dy = (p.y != null ? p.y : eye) - eye;
      var l1 = Math.atan2(-dx, -dz);                          // caméra : regarde vers −Z local
      var t1 = Math.atan2(dy, Math.hypot(dx, dz));
      regard = { l0: j.lacet, t0: j.tangage, l1: j.lacet + U.angleDiff(j.lacet, l1), t1: U.clamp(t1, -1.4, 1.4), t: 0, d: Math.max(0.05, duree || 0.8) };
    };

    // ── secousse, recul ──
    var secousse = { f: 0, t: 0 }, reculT = 0, reculL = 0;
    j.secousse = function (force, duree) { if (force > secousse.f) { secousse.f = force; secousse.t = duree || 0.4; secousse.d = secousse.t; } };
    j.recul = function (dTangage, dLacet) { reculT += dTangage; reculL += dLacet; };

    // ── dégâts ──
    j.estInvulnerable = function () { return j.invulnerable || j.temps < j.invulnerableJusqua; };
    j.infligerDegats = function (fraction, opts) {
      opts = opts || {};
      if (!j.vivant || j.estInvulnerable() || !(fraction > 0)) return 0;
      var f = fraction;
      if (!opts.ignorerReductions && j.atouts.mastodonte) f *= 1;          // PV max déjà augmentés par l'atout
      var avant = j.pv;
      j.pv = Math.max(0, j.pv - f * j.pvMax);
      j.dernierDegat = j.temps;
      flashDegats = Math.min(1, flashDegats + 0.35 + f * 1.5);
      j.secousse(0.012 + f * 0.08, 0.25 + f * 0.6);
      if (opts.direction) {                                                  // recul de caméra vers l'impact
        j.recul(0.02 + f * 0.1, 0);
      }
      emettre('degats', { fraction: f, avant: avant / j.pvMax, apres: j.pv / j.pvMax, source: opts.source });
      if (j.pv <= 0) {
        if (j.atouts.reanimation) {                                          // réanimation automatique (atout)
          j.atouts.reanimation = false; j.pv = j.pvMax * 0.5; j.invulnerableJusqua = j.temps + 3;
          emettre('reanime', {});
        } else { j.vivant = false; j.mort = true; j.controle = false; emettre('mort', { source: opts.source }); }
      }
      return f;
    };
    j.blessureCritique = function (fractionRestante) {
      if (!j.vivant) return;
      var cible = Math.max(1e-6, fractionRestante) * j.pvMax;
      if (j.pv > cible) j.pv = cible;
      j.dernierDegat = j.temps;
      flashDegats = 1;
      j.secousse(0.09, 0.7);
      j.recul(0.12, (Math.random() - 0.5) * 0.1);
      emettre('degats', { fraction: 0, critique: true, apres: j.pv / j.pvMax });
    };
    j.soigner = function () { j.pv = j.pvMax; };
    j.reapparaitre = function (pos, lacet, lieu) {
      j.vivant = true; j.mort = false; j.pv = j.pvMax; j.controle = true; j.aTerre = false; j.etourdiT = 0; projT = 0;
      if (pos) j.teleporter(pos, lacet, lieu);
      emettre('reapparition', {});
    };
    j.definirControle = function (b) { j.controle = !!b; if (!b) { j.entree.tir = false; } };
    j.definirInvulnerable = function (b) { j.invulnerable = !!b; };
    j.teleporter = function (p, lacet, lieu) {
      var ancien = j.lieu;
      j.position.set(p.x, p.y || 0, p.z);
      j.vitesse.set(0, 0, 0); projT = 0;
      if (lacet != null) { j.lacet = lacet + Math.PI; j.tangage = 0; }     // lacet de l'arène : 0 = regarde +Z ; caméra : −Z
      if (lieu) j.lieu = lieu; else if (monde && monde.lieuDe) j.lieu = monde.lieuDe(p.x);
      regard = null;
      emettre('teleport', { de: ancien, vers: j.lieu });
    };
    j.donnerAtout = function (id) {
      if (j.atouts[id]) return false;
      j.atouts[id] = true;
      if (id === 'mastodonte') { var f = j.pv / j.pvMax; j.pvMax = 250; j.pv = f * j.pvMax; }
      return true;
    };

    // ── vue pour l'adaptateur (objet réutilisé) ──
    var V = { id: j.id, position: { x: 0, y: 0, z: 0 }, vitesse: { x: 0, y: 0, z: 0 }, lacet: 0, vivant: true, aTerre: false, lieu: j.lieu, pvFraction: 1, humain: true };
    j.vue = function () {
      V.position.x = j.position.x; V.position.y = j.position.y; V.position.z = j.position.z;
      V.vitesse.x = j.vitesse.x; V.vitesse.y = j.vitesse.y; V.vitesse.z = j.vitesse.z;
      V.lacet = j.lacet + Math.PI;                 // convention arène (0 = regarde +Z)
      V.vivant = j.vivant; V.aTerre = j.aTerre; V.lieu = j.lieu; V.pvFraction = j.pv / j.pvMax;
      return V;
    };
    j.directionRegard = function (out) {
      var cp = Math.cos(j.tangage);
      out.x = -Math.sin(j.lacet) * cp; out.y = Math.sin(j.tangage); out.z = -Math.cos(j.lacet) * cp;
      return out;
    };
    j.positionYeux = function (out) { out.x = j.position.x; out.y = j.position.y + R.hauteurYeux; out.z = j.position.z; return out; };

    // ── mise à jour ──
    var pos2 = { x: 0, z: 0 }, bob = 0, roulis = 0, fov = R.fov, valide = { x: 0, y: 0, z: 0, ok: false };
    j.mettreAJour = function (dt, temps) {
      // dt négatif ou invalide (1re image d'une boucle requestAnimationFrame : l'horodatage peut précéder performance.now())
      // → 0. Sinon acc × dt < 0 et 0 / 0 rendaient la vitesse, puis la position et la caméra, NaN pour toujours (écran noir).
      if (!(dt > 0)) dt = 0;
      j.temps = temps != null ? temps : j.temps + dt;
      var ent = j.entree;
      // lecture clavier (touches physiques)
      var av = (touches.KeyW || touches.ArrowUp ? 1 : 0) - (touches.KeyS || touches.ArrowDown ? 1 : 0);
      var dr = (touches.KeyD || touches.ArrowRight ? 1 : 0) - (touches.KeyA || touches.ArrowLeft ? 1 : 0);
      if (o.clavier !== false) { ent.avant = av; ent.droite = dr; ent.sprint = !!(touches.ShiftLeft || touches.ShiftRight); ent.interagir = !!(touches.KeyF || touches.KeyE); }
      var actif = j.controle && j.vivant, bouge = actif && !(j.etourdiT > 0) && !(projT > 0);   // étourdi ou projeté : la vue reste libre, le reste est bloqué
      if (!bouge) { ent.saut = false; }
      // regard forcé
      if (regard) {
        regard.t += dt;
        var k = U.smooth(0, 1, regard.t / regard.d);
        j.lacet = U.lerp(regard.l0, regard.l1, k); j.tangage = U.lerp(regard.t0, regard.t1, k);
        if (regard.t >= regard.d + (j.controle ? 0 : 1e9)) regard = null;
      }
      // déplacement
      var avant = bouge ? ent.avant : 0, droite = bouge ? ent.droite : 0;
      var sprint = bouge && ent.sprint && avant > 0 && !ent.viser;
      var vmax = avant < 0 ? R.recul : sprint ? R.sprint : R.marche;
      if (avant === 0 && droite !== 0) vmax = R.lateral;
      if (ent.viser) vmax *= R.visee;
      var fx = -Math.sin(j.lacet), fz = -Math.cos(j.lacet), rx = Math.cos(j.lacet), rz = -Math.sin(j.lacet);
      var wx = fx * avant + rx * droite, wz = fz * avant + rz * droite, wl = Math.hypot(wx, wz);
      if (wl > 1e-6) { wx = wx / wl * vmax; wz = wz / wl * vmax; } else { wx = 0; wz = 0; }
      var acc = j.auSol ? (wl > 0 ? R.acceleration : R.freinage) : R.accelerationAir;
      var dvx = wx - j.vitesse.x, dvz = wz - j.vitesse.z, dvl = Math.hypot(dvx, dvz), maxdv = acc * dt;
      if (dvl > maxdv && dvl > 1e-9) { dvx *= maxdv / dvl; dvz *= maxdv / dvl; }
      j.vitesse.x += dvx; j.vitesse.z += dvz;
      if (projT > 0) { projT = Math.max(0, projT - dt); var kpj = projD > 0 ? 0.4 + 0.6 * projT / projD : 0; j.vitesse.x = projVx * kpj; j.vitesse.z = projVz * kpj; }
      if (ent.saut && j.auSol && bouge) { j.vitesse.y = R.saut; j.auSol = false; }
      ent.saut = false;
      j.vitesse.y -= R.gravite * dt;
      j.position.x += j.vitesse.x * dt; j.position.y += j.vitesse.y * dt; j.position.z += j.vitesse.z * dt;
      var sol = 0;
      if (j.position.y <= sol) { j.position.y = sol; j.vitesse.y = 0; j.auSol = true; }
      if (forceT > 0) forceT = Math.max(0, forceT - dt);
      if (monde && !(forceT > 0)) {
        pos2.x = j.position.x; pos2.z = j.position.z;
        if (monde.resoudre(j.lieu, pos2, R.rayon)) {
          var murTouche = projT > 0 && monde.contactMur;          // v1.5 : projeté contre un mur de la salle (pas un pilier)
          // annule la composante de vitesse qui pousse dans l'obstacle
          var cx = pos2.x - j.position.x, cz = pos2.z - j.position.z, cl = Math.hypot(cx, cz);
          if (cl > 1e-6) { var nx = cx / cl, nz = cz / cl, vn = j.vitesse.x * nx + j.vitesse.z * nz; if (vn < 0) { j.vitesse.x -= vn * nx; j.vitesse.z -= vn * nz; } }
          j.position.x = pos2.x; j.position.z = pos2.z;
          if (murTouche) {
            var vImp = Math.hypot(projVx, projVz) * (projD > 0 ? 0.4 + 0.6 * projT / projD : 0);
            projT = 0; j.vitesse.x = 0; j.vitesse.z = 0;
            j.secousse(0.12, 0.6); flashDegats = Math.min(1, flashDegats + 0.4);
            emettre('impactMur', { x: j.position.x, z: j.position.z, vitesse: vImp });
            if (j.surImpactMur) { try { j.surImpactMur({ x: j.position.x, z: j.position.z, vitesse: vImp }); } catch (e) { setTimeout(function () { throw e; }); } }
          }
        }
      }
      // garde-fou : jamais de position ni de vitesse invalides (sinon la caméra devient NaN et l'image reste noire)
      if (!isFinite(j.position.x) || !isFinite(j.position.y) || !isFinite(j.position.z) || !isFinite(j.vitesse.x) || !isFinite(j.vitesse.y) || !isFinite(j.vitesse.z)) {
        if (valide.ok) { j.position.x = valide.x; j.position.y = valide.y; j.position.z = valide.z; } else { j.position.x = 0; j.position.y = 0; j.position.z = 0; }
        j.vitesse.x = 0; j.vitesse.y = 0; j.vitesse.z = 0;
        if (typeof console !== 'undefined') console.warn('ProtoB7Joueur : position invalide corrigée');
      } else { valide.x = j.position.x; valide.y = j.position.y; valide.z = j.position.z; valide.ok = true; }
      if (!isFinite(j.lacet)) j.lacet = 0;
      if (!isFinite(j.tangage)) j.tangage = 0;
      // régénération
      if (j.vivant && j.pv < j.pvMax && j.temps - j.dernierDegat > R.delaiRegen) j.pv = Math.min(j.pvMax, j.pv + R.vitesseRegen * j.pvMax * dt);
      // recul de l'arme (revient progressivement)
      var rr = Math.min(1, dt * 14);
      j.tangage += reculT * rr; j.lacet += reculL * rr; reculT -= reculT * rr; reculL -= reculL * rr;
      j.tangage = U.clamp(j.tangage, -1.5, 1.5);
      // caméra
      if (camera) {
        if (!isFinite(bob)) bob = 0;
        if (!isFinite(roulis)) roulis = 0;
        if (!isFinite(fov)) fov = R.fov;
        var v = Math.hypot(j.vitesse.x, j.vitesse.z);
        if (j.auSol) bob += dt * v * 1.9;
        var amp = Math.min(1, v / 6) * (ent.viser ? 0.25 : 1);
        var by = Math.abs(Math.sin(bob)) * 0.045 * amp, bx = Math.sin(bob) * 0.025 * amp;
        var sx = 0, sy = 0;
        if (secousse.t > 0) { secousse.t -= dt; var f = secousse.f * (secousse.t / (secousse.d || 1)); sx = (Math.random() - 0.5) * f; sy = (Math.random() - 0.5) * f; if (secousse.t <= 0) secousse.f = 0; }
        if (j.etourdiT > 0) { var ke2 = Math.min(1, j.etourdiT / 0.25) * 0.018, tt = j.temps; sx += ke2 * (Math.sin(tt * 71) * 0.6 + Math.sin(tt * 43.7) * 0.4); sy += ke2 * (Math.sin(tt * 59.3) * 0.6 + Math.sin(tt * 37.1) * 0.4); }
        camera.position.set(j.position.x + rx * bx, j.position.y + R.hauteurYeux + by - (j.vivant ? 0 : 1.2), j.position.z + rz * bx);
        roulis += ((actif ? -droite * 0.02 : 0) - roulis) * Math.min(1, dt * 6);
        camera.rotation.set(j.tangage + sy, j.lacet + sx, roulis + (j.vivant ? 0 : 0.6), 'YXZ');
        var cible = ent.viser ? R.fovVisee : (sprint ? R.fov + 4 : R.fov);
        fov += (cible - fov) * Math.min(1, dt * 10);
        if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }
      majFlou(dt);
      majEtourdi(dt);
      // vignette
      flashDegats = Math.max(0, flashDegats - dt * 1.6);
      if (vig) {
        var bas = j.pv / j.pvMax < 0.35 ? (0.35 - j.pv / j.pvMax) / 0.35 * (0.75 + 0.25 * Math.sin(j.temps * 6)) : 0;
        vig.style.opacity = Math.min(1, flashDegats * 0.9 + bas * 0.8).toFixed(3);
      }
    };
    j.dispose = function () {
      j.detacher(); if (vig && vig.parentNode) vig.parentNode.removeChild(vig);
      if (flouEl && flouEl.parentNode) flouEl.parentNode.removeChild(flouEl); if (eblouEl && eblouEl.parentNode) eblouEl.parentNode.removeChild(eblouEl);
      if (voileEl && voileEl.parentNode) voileEl.parentNode.removeChild(voileEl);
    };
    return j;
  }

  var API = { creer: creer, REGLAGES: REGLAGES };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Joueur = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
