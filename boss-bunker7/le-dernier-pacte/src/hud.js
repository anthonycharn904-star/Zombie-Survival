/*!
 * hud.js — Boss de Bunker 7 (« Le Septième ») : interface du combat en DOM/CSS, sans Three.js.
 * Contrat : API.md §11. Lit uniquement combat.etat() et les évènements de la logique.
 * Barre de vie à segments, nom et phase, comptes à rebours (répit, absence), capture du cercle rituel (anneau,
 * état, règle, temps restant), jauge du pacte (phase 5), état critique du joueur, invite d'interaction, cartes
 * de titre, bandes cinéma, récompenses, message final, avertissements.
 * v1.3 : barres des mini-boss sous celle du Septième (nom + PV à leur couleur), ligne « Protégé : abattez … »,
 * repères des seuils de mini-boss sur le segment de la phase 2, carte et messages à la libération et à la mort.
 * v1.4 : 3e mini-boss (générique), message des salves de murs (phase 3), objectif de la faiblesse (zombies), paliers de la
 * phase 5 (repères 25/50/75 % sur la jauge, ligne d'aide et message par palier), joueur accroché par un crochet, étourdi.
 * v1.5 : rages des mini-boss (messages, « Invulnérable » sur leur barre), bandeau « Murs électrifiés », palier 2 = intangibilité.
 * Script classique → globalThis.BossB7Hud ; CommonJS → module.exports.
 */
(function (root) {
  'use strict';
  var VERSION = '1.5.0';

  var NOMS = {
    'merveille-1': 'Arme merveille I', 'merveille-2': 'Arme merveille II',
    'munitions-max': 'Munitions max', 'mort-instantanee': 'Mort instantanée', 'points-doubles': 'Points doubles',
    'bombe-nucleaire': 'Bombe nucléaire', 'charpentier': 'Charpentier', 'vente-flash': 'Vente flash',
    'points-bonus': 'Points bonus', 'atout-gratuit': 'Atout gratuit', 'machine-de-mort': 'Machine de mort'
  };
  var TEXTES_CAPTURE = {
    formation: 'Le cercle se forme…',
    libre: 'Entrez dans le cercle',
    capture: 'Purification en cours',
    conteste: 'Contesté ! Chassez les zombies du cercle',
    recul: 'Le cercle faiblit : revenez !',
    reinitialisation: 'Le rituel repart de zéro',
    termine: 'Rituel accompli'
  };
  // Objectif affiché en haut à gauche, selon l'état du combat (clair et court : ce qu'il faut faire maintenant)
  var OBJECTIFS = {
    introduction: 'Le Pacte vous a attirés dans la Chambre du Pacte…',
    phase1: 'Survivez aux morts invoqués et tirez sur le Septième',
    phase1b: 'Esquivez ses doubles sorts, abattez ses chiens et tirez sur le Septième',   // v1.2 : seconde moitié de la phase 1
    repit: 'Répit : rechargez et soignez-vous',
    phase2: 'Frappez-le pendant qu’il absorbe les âmes · évitez son piqué',
    phase2siphon: 'Il siphonne une cuve : préparez-vous',                                  // v1.3 : seuil atteint, siphon en cours
    phase2mb: 'Abattez {nom} : tant qu’il vit, le Septième est invulnérable',              // v1.3 : un mini-boss est dans l'arène
    transition23: 'Il est blessé…',
    absence: 'Il a disparu : tenez bon jusqu’à son retour',
    retour: 'Il revient, enragé',
    phase3: 'Esquivez ses blocs, abattez-le, tenez les zombies à distance',
    transition34: 'Il s’effondre…',
    rituel: 'Tenez le cercle rituel face à la horde',
    rituel_fin: 'La purification le ramène de force',
    faiblesse: 'Il est sans défense : frappez-le et tenez les zombies à distance',   // v1.4 : des zombies apparaissent pendant la faiblesse
    transition45: 'Il arrache vos âmes…',
    phase5: 'Dans le noir, trouvez-le et rompez le pacte sans relâche',
    defaite: 'Le pacte se brise',
    retour_salle: '',
    conclusion: 'Approchez du corps et achevez le rituel',
    recompenses: '', message: '', termine: '', echec: '', inactif: ''
  };
  var REGLES = {
    decroissance: 'Cercle vide : la purification redescend.',
    pause: 'Cercle vide : la purification se fige.',
    reinitialisation: 'Cercle vide : la purification repart de zéro.'
  };
  var CSS = [
    '.b7h{position:fixed;inset:0;pointer-events:none;z-index:40;color:#efe6d6;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}',
    '.b7h *{box-sizing:border-box}',
    '.b7h-t{font-family:"Teko","Oswald","Arial Narrow",sans-serif;font-weight:500;letter-spacing:.04em;text-transform:uppercase}',
    '.b7h-cine{position:absolute;left:0;right:0;height:0;background:#000;transition:height .6s ease}',
    '.b7h-cine.h{top:0}.b7h-cine.b{bottom:0}.b7h.cinema .b7h-cine{height:9vh}',
    '.b7h-boss{position:absolute;top:18px;left:50%;width:min(720px,86vw);transform:translateX(-50%);opacity:0;transition:opacity .5s}',
    '.b7h-boss.on{opacity:1}',
    '.b7h-ligne{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:5px;text-shadow:0 1px 3px #000}',
    '.b7h-nom{font-size:26px;line-height:1;color:#f3e3c4}',
    '.b7h-nom small{font-size:15px;color:#c98d5c;margin-left:8px;letter-spacing:.08em}',
    '.b7h-phase{font-size:17px;line-height:1;color:#d7c3a0}',
    '.b7h-barre{display:flex;gap:3px;height:12px;padding:2px;background:rgba(10,6,6,.78);border:1px solid rgba(214,120,70,.45);box-shadow:0 0 14px rgba(0,0,0,.6)}',
    '.b7h-seg{position:relative;flex:1 1 0;background:rgba(80,20,14,.55);overflow:hidden}',
    '.b7h-seg i{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(#e2683a,#9b1f12);transition:width .12s linear}',
    '.b7h-seg b{position:absolute;left:0;top:0;bottom:0;width:100%;background:rgba(255,230,190,.55);transition:width .9s ease .25s}',
    '.b7h-seg.vide i,.b7h-seg.vide b{width:0!important}',
    '.b7h-etatboss{margin-top:5px;font-size:15px;line-height:1;color:#c8b28c;min-height:15px;text-shadow:0 1px 3px #000}',
    '.b7h-etatboss .x{color:#ffd27a}',
    '.b7h-chrono{position:absolute;top:92px;left:50%;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .4s;text-shadow:0 2px 8px #000}',
    '.b7h-chrono.on{opacity:1}',
    '.b7h-chrono span{display:block;font-size:16px;color:#d9c39d}',
    '.b7h-chrono strong{display:block;font-size:64px;line-height:.9;color:#fff1d8}',
    '.b7h-capture{position:absolute;right:28px;top:50%;transform:translateY(-50%);width:210px;text-align:center;opacity:0;transition:opacity .4s}',
    '.b7h-capture.on{opacity:1}',
    '.b7h-anneau{width:120px;height:120px;margin:0 auto;display:block}',
    '.b7h-anneau circle{fill:none;stroke-width:9}',
    '.b7h-anneau .fond{stroke:rgba(255,255,255,.14)}',
    '.b7h-anneau .val{stroke:#f4dc96;stroke-linecap:round;transform:rotate(-90deg);transform-origin:60px 60px;transition:stroke .3s}',
    '.b7h-capture.conteste .val{stroke:#e0533a}.b7h-capture.recul .val{stroke:#9fa6b8}',
    '.b7h-pct{position:relative;margin-top:-82px;height:82px;font-size:34px;color:#fff3d6}',
    '.b7h-capture p{margin:6px 0 0;text-shadow:0 1px 3px #000}',
    '.b7h-capture .titre{font-size:20px;color:#f4dc96}.b7h-capture.conteste .titre{color:#ff7a5c}',
    '.b7h-capture .regle{font-size:12px;color:#b9ab95}',
    '.b7h-jauge{position:absolute;bottom:92px;left:50%;width:min(520px,80vw);transform:translateX(-50%);opacity:0;transition:opacity .4s;text-align:center}',
    '.b7h-jauge.on{opacity:1}',
    '.b7h-jauge .lib{display:flex;justify-content:space-between;font-size:18px;color:#f0c9b8;text-shadow:0 1px 3px #000}',
    '.b7h-jauge .tube{height:10px;margin-top:4px;background:rgba(20,8,10,.8);border:1px solid rgba(220,60,60,.5);overflow:hidden}',
    '.b7h-jauge .tube i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7b0d17,#e2364a);transition:width .1s linear}',
    '.b7h-jauge.baisse .tube{animation:b7h-clign .6s infinite}',
    '.b7h-jauge.gel .tube i{background:linear-gradient(90deg,#3d4c6e,#7f93c2)}',
    '.b7h-jauge .aide{font-size:12px;color:#c3aea4;margin-top:4px}',
    // v1.4 : paliers de la phase 5 (repères sur la jauge, ligne d'aide du palier), accroché, étourdi
    '.b7h-jauge .tube{position:relative}',
    '.b7h-jauge .rep{position:absolute;top:-1px;bottom:-1px;width:2px;margin-left:-1px;background:#f6e6c8;opacity:.75;z-index:2}',
    '.b7h-jauge .rep.passe{opacity:.25}',
    '.b7h-jauge .palier{margin-top:5px;font-size:15px;line-height:1.1;color:#e6d8c2;text-transform:none;font-family:system-ui,sans-serif;letter-spacing:0}',
    '.b7h-jauge .palier b{font-weight:600}',
    '.b7h-alerte{position:absolute;left:50%;top:calc(50% + 54px);transform:translateX(-50%);font-size:24px;color:#ffd27a;opacity:0;transition:opacity .15s;text-shadow:0 0 10px #000,0 0 3px #000}',
    '.b7h-alerte.on{opacity:1}',
    // v1.5 : murs électrifiés (bandeau sous les barres des mini-boss) ; barre d'un mini-boss invulnérable
    '.b7h-danger{margin-top:7px;font-size:15px;line-height:1;color:#7fe8ff;letter-spacing:.1em;text-shadow:0 0 8px #0af,0 1px 3px #000;display:none;animation:b7h-danger 1.1s ease-in-out infinite}',
    '.b7h-danger.on{display:block}',
    '.b7h-mb.invul .b{border-style:dashed;box-shadow:0 0 12px var(--c)}',
    '.b7h-mb.invul .s{color:#fff}',
    '@keyframes b7h-danger{0%,100%{opacity:.75}50%{opacity:1}}',
    '.b7h-critique{position:absolute;inset:0;opacity:0;transition:opacity .25s;box-shadow:inset 0 0 22vmin 6vmin rgba(150,0,0,.85)}',
    '.b7h-critique.on{opacity:1;animation:b7h-pouls .9s infinite}',
    '.b7h-critique div{position:absolute;top:58%;left:50%;transform:translateX(-50%);font-size:26px;color:#ff6b5c;text-shadow:0 0 12px #600}',
    '.b7h-inter{position:absolute;top:62%;left:50%;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .3s}',
    '.b7h-inter.on{opacity:1}',
    '.b7h-inter p{margin:0;font-size:16px;text-shadow:0 1px 4px #000}',
    '.b7h-inter kbd{display:inline-block;min-width:26px;padding:1px 7px;margin:0 4px;border:1px solid #d8c7a4;border-bottom-width:3px;border-radius:4px;font:600 15px/1.4 system-ui,sans-serif;color:#fff}',
    '.b7h-inter .tube{width:240px;height:6px;margin:8px auto 0;background:rgba(255,255,255,.15)}',
    '.b7h-inter .tube i{display:block;height:100%;width:0;background:#f4dc96}',
    '.b7h-titre{position:absolute;top:30%;left:0;right:0;text-align:center;opacity:0;transition:opacity .5s;text-shadow:0 3px 18px #000}',
    '.b7h-titre.on{opacity:1}',
    '.b7h-titre h1{margin:0;font-size:clamp(46px,8vw,96px);line-height:.9;color:#f6e6c8;font-weight:500}',
    '.b7h-titre h2{margin:10px 0 0;font-size:clamp(20px,3vw,32px);line-height:1;color:#d58a5a;font-weight:400;letter-spacing:.14em}',
    '.b7h-toasts{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}',
    '.b7h-toast{padding:5px 12px;background:rgba(12,8,8,.78);border:1px solid rgba(214,150,90,.4);font-size:13px;color:#ecd9b8;transition:opacity .4s}',
    '.b7h-recomp{position:absolute;right:26px;top:22%;width:270px;opacity:0;transition:opacity .5s}',
    '.b7h-recomp.on{opacity:1}',
    '.b7h-recomp h3{margin:0 0 8px;font-size:24px;color:#f4dc96;text-shadow:0 1px 4px #000}',
    '.b7h-recomp ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}',
    '.b7h-recomp li{display:flex;align-items:center;gap:9px;padding:4px 9px;background:linear-gradient(90deg,rgba(60,42,16,.85),rgba(20,14,8,.4));border-left:3px solid #e8c36c;animation:b7h-entree .45s ease-out both;font-size:14px}',
    '.b7h-recomp li span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#d8b46c;min-width:44px}',
    '.b7h-recomp li em{font-style:normal;color:#b4a68d;font-size:12px;margin-left:auto}',
    '.b7h-message{position:absolute;top:7%;left:50%;width:min(980px,92vw);transform:translateX(-50%);text-align:center;opacity:0;transition:opacity 1.2s;text-shadow:0 2px 14px #000,0 0 30px rgba(0,0,0,.8)}',
    '.b7h-message.on{opacity:1}',
    '.b7h-message p{margin:0 0 10px;animation:b7h-revele 1.4s ease-out both}',
    '.b7h-message .l0{font-size:clamp(30px,4.6vw,56px);line-height:1;color:#f7dc8f}',
    '.b7h-message .l1{font-size:clamp(22px,3vw,36px);line-height:1.05;color:#f2e7d1;animation-delay:.9s}',
    '.b7h-message .l2{font:italic clamp(14px,1.6vw,19px)/1.4 Georgia,serif;color:#d9c7a8;animation-delay:1.8s}',
    '.b7h-marque{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0}',
    '.b7h-marque::before,.b7h-marque::after{content:"";position:absolute;left:12px;top:-2px;width:2px;height:30px;background:#fff;transform:rotate(45deg)}',
    '.b7h-marque::after{transform:rotate(-45deg)}',
    '.b7h-marque.tete::before,.b7h-marque.tete::after{background:#ff5a4a}',
    '.b7h-objectif{position:absolute;left:22px;top:84px;max-width:min(300px,34vw);font-size:19px;line-height:1.1;color:#e9d7b5;text-shadow:0 1px 4px #000;opacity:0;transition:opacity .5s,top .3s}',
    '.b7h.avecmb .b7h-objectif{top:152px}',   // v1.3 : sous les barres des mini-boss
    '.b7h.avecjauge .b7h-toasts{bottom:205px}',   // v1.5 : au-dessus de la jauge du pacte et de ses aides (phase 5)
    '.b7h-objectif.on{opacity:1}',
    '.b7h-objectif small{display:block;font-size:12px;letter-spacing:.2em;color:#c98d5c;margin-bottom:3px}',
    // v1.3 : mini-boss (une barre par mini-boss, à sa couleur --c) et Septième protégé
    '.b7h-boss.protege .b7h-seg i{background:linear-gradient(#8fa3c4,#3b4c6b)}',
    '.b7h-boss.protege .b7h-barre{border-color:var(--mbc,#9fd0ff);animation:b7h-protege 1.4s ease-in-out infinite}',
    '.b7h-seuil{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:#f6e6c8;box-shadow:0 0 4px #000;z-index:2;transition:opacity .4s}',
    '.b7h-seuil.passe{opacity:.25}',
    '.b7h-mbs{display:flex;flex-direction:column;gap:7px;margin-top:9px}',
    '.b7h-mb{--c:#9fd0ff;transition:opacity .8s}',
    '.b7h-mb.mort{opacity:.4}',
    '.b7h-mb .l{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:3px;text-shadow:0 1px 3px #000}',
    '.b7h-mb .n{font-size:20px;line-height:1;color:var(--c)}',
    '.b7h-mb .s{font-size:13px;line-height:1;color:#c8b28c;letter-spacing:.12em}',
    '.b7h-mb .b{position:relative;height:10px;background:rgba(6,10,12,.82);border:1px solid var(--c);box-shadow:0 0 12px rgba(0,0,0,.6)}',
    '.b7h-mb .b span{position:absolute;left:2px;right:2px;top:2px;bottom:2px;overflow:hidden}',
    '.b7h-mb .b i,.b7h-mb .b b{position:absolute;left:0;top:0;bottom:0;width:100%}',
    '.b7h-mb .b i{background:var(--c);transition:width .12s linear}',
    '.b7h-mb .b b{background:rgba(255,255,255,.5);transition:width .9s ease .25s}',
    '.b7h-mb.entree{animation:b7h-mbentree .5s ease-out both}',
    '.b7h-immun{position:absolute;left:50%;top:calc(50% + 26px);transform:translateX(-50%);font-size:18px;color:#9fd0ff;opacity:0;transition:opacity .2s;text-shadow:0 0 8px #034}',
    '@keyframes b7h-pouls{0%,100%{opacity:.75}50%{opacity:1}}',
    '@keyframes b7h-protege{0%,100%{box-shadow:0 0 6px rgba(0,0,0,.6)}50%{box-shadow:0 0 16px var(--mbc,#9fd0ff)}}',
    '@keyframes b7h-mbentree{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
    '@keyframes b7h-clign{0%,100%{border-color:rgba(220,60,60,.5)}50%{border-color:#ff4a4a}}',
    '@keyframes b7h-entree{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}',
    '@keyframes b7h-revele{from{opacity:0;letter-spacing:.3em;filter:blur(6px)}to{opacity:1;filter:none}}',
    '@media (prefers-reduced-motion:reduce){.b7h *{animation:none!important;transition:none!important}}'
  ].join('\n');

  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function fr(x, d) { return x.toFixed(d == null ? 0 : d).replace('.', ','); }
  // v1.4 : paliers de la phase 5 (jauge « Rompre le pacte ») : ligne d'aide permanente et message au passage
  var AIDES_PALIER = {
    0: '<b style="color:#bfeeff">Lames bleues</b> : deux coups vous tuent.',
    1: '<b style="color:#ff6a55">Lames rouges</b> : chaque coup vous laisse à 1 %.',
    2: '<b style="color:#c9a6ff">Intangible</b> : invisible, il traverse les murs et surgit pour frapper.',
    3: '<b style="color:#ffb36b">Crochets</b> : un pas de côté l’évite.'
  };
  // v1.5 : rages des mini-boss (à la moitié de leurs PV)
  var MESSAGES_RAGE = {
    surcharge: 'Le Survolté puise sa force dans le Septième : il est invulnérable un instant !',
    infection: 'L’Irradié contamine les zombies et les chiens : ils irradient jusqu’à sa mort !',
    arrachement: 'Le Démembré s’arrache le bras : d’autres Démembrés vont en sortir !'
  };
  var MESSAGES_PALIER = {
    1: ['Lames rouges', 'Chaque coup est presque mortel', 'Ses lames virent au rouge : chaque coup vous laisse à 1 % !'],
    2: ['Intangible', 'Il traverse les murs', 'Il devient invisible et traverse les murs : il surgit pour frapper !'],
    3: ['Crochets', 'Un pas de côté l’évite', 'Il lance des crochets pour vous ramener à lui : esquivez de côté !']
  };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function creer(o) {
    o = o || {};
    var C = o.config || root.BOSS_B7_CONFIG || {};
    var racine = o.racine || document.body;
    var touche = o.toucheInteraction || 'E';
    var noms = {}; var k;
    for (k in NOMS) noms[k] = NOMS[k];
    if (o.noms) for (k in o.noms) noms[k] = o.noms[k];
    if (!document.getElementById('b7h-css')) { var st = el('style', null, document.head, CSS); st.id = 'b7h-css'; }

    var R = el('div', 'b7h', racine);
    el('div', 'b7h-cine h', R); el('div', 'b7h-cine b', R);
    var critique = el('div', 'b7h-critique', R, '<div class="b7h-t">État critique</div>');
    // barre du boss
    var boss = el('div', 'b7h-boss', R);
    var ligne = el('div', 'b7h-ligne', boss);
    var nom = el('div', 'b7h-nom b7h-t', ligne);
    var phase = el('div', 'b7h-phase b7h-t', ligne);
    var barre = el('div', 'b7h-barre', boss);
    var etatBoss = el('div', 'b7h-etatboss b7h-t', boss);
    var mbs = el('div', 'b7h-mbs b7h-t', boss);      // v1.3 : barres des mini-boss, sous la ligne d'état du Septième
    var danger = el('div', 'b7h-danger b7h-t', boss, 'Murs électrifiés : restez loin des murs');   // v1.5
    var segs = [], seuils = [], lignesMb = {}, passeMb = 0;
    var SEUILS_MB = (C.miniBoss && C.miniBoss.actif !== false && C.miniBoss.seuils) || [];
    // compte à rebours
    var chrono = el('div', 'b7h-chrono b7h-t', R, '<span></span><strong></strong>');
    // capture
    var cap = el('div', 'b7h-capture b7h-t', R,
      '<svg class="b7h-anneau" viewBox="0 0 120 120"><circle class="fond" cx="60" cy="60" r="50"/><circle class="val" cx="60" cy="60" r="50" stroke-dasharray="314.16" stroke-dashoffset="314.16"/></svg>' +
      '<div class="b7h-pct"></div><p class="titre"></p><p class="detail"></p><p class="regle" style="text-transform:none;font-family:system-ui,sans-serif;letter-spacing:0"></p>');
    var capVal = cap.querySelector('.val'), capPct = cap.querySelector('.b7h-pct'), capTitre = cap.querySelector('.titre'),
      capDetail = cap.querySelector('.detail'), capRegle = cap.querySelector('.regle');
    capRegle.textContent = REGLES[(C.phase4 && C.phase4.regleAbandon) || 'decroissance'] || '';
    // jauge du pacte
    var jauge = el('div', 'b7h-jauge b7h-t', R, '<div class="lib"><span>Rompre le pacte</span><span class="v"></span></div><div class="tube"><i></i></div><div class="aide" style="text-transform:none;font-family:system-ui,sans-serif;letter-spacing:0">Frappez-le sans relâche : la jauge redescend dès que les dégâts s’arrêtent.</div>');
    var jaugeI = jauge.querySelector('.tube i'), jaugeV = jauge.querySelector('.v'), jaugeAide = jauge.querySelector('.aide');
    // v1.4 : repères des paliers sur la jauge et ligne d'aide du palier courant
    var PAL = (C.phase5 && C.phase5.paliers) || null, SEUILS_PAL = (PAL && PAL.seuils) || [], repPal = [];
    (function () {
      var tube = jauge.querySelector('.tube');
      for (var q = 0; q < SEUILS_PAL.length; q++) { var f = +SEUILS_PAL[q]; if (!(f > 0 && f < 1)) continue; var m = el('div', 'rep', tube); m.style.left = (f * 100).toFixed(1) + '%'; repPal.push({ e: m, f: f }); }
    })();
    var jaugePalier = el('div', 'palier', jauge);
    var alerte = el('div', 'b7h-alerte b7h-t', R);    // v1.4 : « Accroché ! », « Étourdi »
    // interaction
    var inter = el('div', 'b7h-inter b7h-t', R, '<p></p><div class="tube"><i></i></div>');
    var interP = inter.querySelector('p'), interI = inter.querySelector('.tube i');
    // titre, toasts, récompenses, message, marqueurs
    var titre = el('div', 'b7h-titre b7h-t', R, '<h1></h1><h2></h2>');
    var toasts = el('div', 'b7h-toasts', R);
    var recomp = el('div', 'b7h-recomp b7h-t', R, '<h3>Récompenses</h3><ul></ul>');
    var recompUl = recomp.querySelector('ul');
    var message = el('div', 'b7h-message b7h-t', R);
    var marque = el('div', 'b7h-marque', R);
    var immun = el('div', 'b7h-immun b7h-t', R, 'Immunisé');
    var objectif = el('div', 'b7h-objectif b7h-t', R, '<small>Objectif</small><span></span>');
    var objectifs = {}, piliersDetruits = 0; for (k in OBJECTIFS) objectifs[k] = OBJECTIFS[k];
    if (o.objectifs) for (k in o.objectifs) objectifs[k] = o.objectifs[k];

    var joueurLocal = null, minuteurs = [], debranchements = [];
    var titreFin = 0, marqueFin = 0, immunFin = 0, recompFin = 0, messageFin = 0, horloge = 0, jaugeVue = 0;
    var dernier = {};
    function poser(cle, valeur, fn) { if (dernier[cle] !== valeur) { dernier[cle] = valeur; fn(valeur); } }
    function basculer(e, on) { if (e.classList.contains('on') !== !!on) e.classList.toggle('on', !!on); }

    function construireSegments(n) {
      barre.innerHTML = ''; segs = []; seuils = [];
      for (var i = 0; i < n; i++) { var s = el('div', 'b7h-seg', barre, '<b></b><i></i>'); segs.push({ e: s, i: s.querySelector('i'), b: s.querySelector('b') }); }
      // v1.3 : repères des seuils de mini-boss sur le segment de la phase 2 (index 1) ; le remplissage part de la gauche
      if (n > 1) for (var k = 0; k < SEUILS_MB.length; k++) {
        var f = +SEUILS_MB[k];
        if (!(f > 0 && f < 1)) continue;
        var m = el('div', 'b7h-seuil', segs[1].e); m.style.left = (f * 100).toFixed(1) + '%';
        seuils.push({ e: m, f: f });
      }
    }
    // v1.3 : une ligne par mini-boss de etat.miniBoss (nom, PV, couleur) ; créée à son arrivée, retirée quand il quitte la liste
    function ligneMiniBoss(m) {
      var cle = String(m.id), L = lignesMb[cle];
      if (L) return L;
      var e = el('div', 'b7h-mb entree', mbs, '<div class="l"><span class="n"></span><span class="s">Mini-boss</span></div><div class="b"><span><b></b><i></i></span></div>');
      e.style.setProperty('--c', m.couleur || '#9fd0ff');
      e.querySelector('.n').textContent = m.nom || m.type || 'Mini-boss';
      L = lignesMb[cle] = { e: e, i: e.querySelector('.b i'), b: e.querySelector('.b b'), s: e.querySelector('.s'), w: '', mort: false, invul: false, passe: 0 };
      return L;
    }
    function majMiniBoss(liste) {
      passeMb++;
      var n = liste ? liste.length : 0, cle;
      for (var i = 0; i < n; i++) {
        var m = liste[i], L = ligneMiniBoss(m);
        L.passe = passeMb;
        var f = m.pvMax > 0 ? Math.max(0, Math.min(1, (m.pv || 0) / m.pvMax)) : 0;
        if (m.etat === 'mort') f = 0;
        var w = (f * 100).toFixed(1) + '%';
        if (L.w !== w) { L.w = w; L.i.style.width = w; L.b.style.width = w; }
        var mort = m.etat === 'mort', invul = !mort && !!m.invulnerable;   // v1.5 : invulnérable pendant sa rage (surcharge, arrachement)
        if (L.mort !== mort || L.invul !== invul) {
          L.mort = mort; L.invul = invul;
          L.e.classList.toggle('mort', mort); L.e.classList.toggle('invul', invul);
          L.s.textContent = mort ? 'Abattu' : invul ? 'Invulnérable' : 'Mini-boss';
        }
      }
      for (cle in lignesMb) {
        if (lignesMb[cle].passe !== passeMb) { var x = lignesMb[cle].e; if (x.parentNode) x.parentNode.removeChild(x); delete lignesMb[cle]; }
      }
      var avec = mbs.children.length > 0;
      if (R.classList.contains('avecmb') !== avec) R.classList.toggle('avecmb', avec);
    }
    function miniBossVivant(etat) {
      var l = etat.miniBoss;
      if (l) for (var i = 0; i < l.length; i++) if (l[i].etat === 'actif') return l[i];
      return null;
    }
    function afficherTitre(texte, sous, duree) {
      titre.querySelector('h1').textContent = texte || '';
      titre.querySelector('h2').textContent = sous || '';
      basculer(titre, true);
      titreFin = horloge + (duree || 3);
    }
    function toast(texte, duree) {
      var t = el('div', 'b7h-toast', toasts); t.textContent = texte;
      minuteurs.push(setTimeout(function () { t.style.opacity = '0'; }, (duree || 3) * 1000));
      minuteurs.push(setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, (duree || 3) * 1000 + 500));
      while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
    }
    function nomRecompense(r) {
      var n = noms[r.id] || (r.type === 'atout' ? String(r.id).replace(/[-_]/g, ' ') : String(r.id));
      if (r.type === 'arme') n += ' · Pack-a-Punch ' + ((C.conclusion && C.conclusion.recompenses && (C.conclusion.recompenses.armes.filter(function (a) { return a.id === r.id; })[0] || {}).pap) || 3);
      return n;
    }

    var gestionnaires = {
      titre: function (e) { afficherTitre(e.texte, e.sousTexte, e.duree); },
      avertissement: function (e) { if (e.texte) toast(e.texte, 3.5); },
      degats: function (e) {
        if (e.joueur !== joueurLocal) return;
        marque.classList.toggle('tete', e.zone === 'tete');
        marqueFin = horloge + 0.12;
      },
      immunise: function (e) { if (!e.joueur || e.joueur === joueurLocal) immunFin = horloge + 0.6; },
      recompense: function (e) {
        if (e.joueur !== joueurLocal) return;
        basculer(recomp, true);
        var li = el('li', null, recompUl);
        var type = e.type === 'arme' ? 'Arme' : e.type === 'atout' ? 'Atout' : 'Bonus';
        li.innerHTML = '<span></span><b></b><em></em>';
        li.querySelector('span').textContent = type;
        li.querySelector('b').textContent = nomRecompense(e);
        li.querySelector('em').textContent = e.repli ? 'sur l’autel' : (e.donne === false ? 'déjà possédé' : '');
        while (recompUl.children.length > 14) recompUl.removeChild(recompUl.firstChild);
        recompFin = horloge + 12;
      },
      message: function (e) {
        message.innerHTML = '';
        (e.lignes || []).forEach(function (l, i) { var p = el('p', 'l' + Math.min(2, i), message); p.textContent = l; });
        basculer(message, true);
        messageFin = horloge + (e.duree || 10);
      },
      // v1.1 : piliers qui s'effondrent, bonus « Munitions max » de fin de phase
      pilier: function (e) {
        if (e.etat !== 'detruit') return;
        piliersDetruits++;
        toast(piliersDetruits >= 4 ? 'Le dernier pilier s’effondre : plus aucun abri !' : 'Un pilier s’effondre : il ne vous protège plus (' + piliersDetruits + '/4)', 3.5);
      },
      // v1.3 : cuves siphonnées et mini-boss de la phase 2
      tube: function (e) {
        if (e.etat === 'siphon') toast('Le Septième siphonne une cuve : il est invulnérable !', 3);
      },
      miniBoss: function (e) {
        if (e.etat === 'rage' && MESSAGES_RAGE[e.capacite]) { toast(MESSAGES_RAGE[e.capacite], 4.5); return; }   // v1.5
        if (e.etat === 'libere') {
          afficherTitre(e.nom || 'Mini-boss', 'Mini-boss libéré', 2.6);
          toast((e.nom || 'Le mini-boss') + ' est libéré : abattez-le pour blesser de nouveau le Septième !', 5);
        } else if (e.etat === 'mort') toast((e.nom || 'Le mini-boss') + ' est abattu : le Septième est de nouveau vulnérable !', 4);
      },
      // v1.5 : murs électrifiés par Le Survolté
      murs: function (e) {
        if (e.etat === 'electrifies') { afficherTitre('Murs électrifiés', 'Éloignez-vous des murs', 2.4); toast('Les murs sont électrifiés jusqu’à la mort du Survolté : ne les longez plus !', 5); }
        else if (e.etat === 'extinction') toast('Les murs ne sont plus électrifiés.', 3);
      },
      // v1.4 : paliers de la phase 5 (le palier 0 part à l'entrée en phase 5 : pas de message, l'aide le dit)
      palier: function (e) {
        var n = +e.numero || 0;
        if (n >= 1 && MESSAGES_PALIER[n]) { afficherTitre(MESSAGES_PALIER[n][0], MESSAGES_PALIER[n][1], 2.8); toast(MESSAGES_PALIER[n][2], 5); }
      },
      // v1.4 : crochets (le joueur local accroché le voit au centre de l'écran ; voir mettreAJour)
      crochet: function (e) {
        if (e.etat === 'accroche' && e.joueur === joueurLocal) toast('Le crochet vous a attrapé : il vous ramène vers lui !', 3);
      },
      // v1.2 : la meute est lâchée (seconde moitié de la phase 1) et reste jusqu'à la mort du boss
      meute: function (e) {
        if (e.etat === 'dechainee') toast('Le Septième lâche ses chiens : ils vous traqueront jusqu’à sa mort !', 4.5);
      },
      teleport: function (e) {
        if (e.raison === 'degats' && e.sens === 'depart') toast('Blessé, il se téléporte ailleurs dans le bunker : retrouvez-le !', 3);
      },
      bonus: function (e) {
        var n = noms[e.type] || e.type;
        if (e.mode === 'depose') toast('Bonus « ' + n + ' » au sol : ramassez-le !', 4);
        else toast(n + ' !', 2.5);
      },
      etat: function (e) {
        titreFin = 0;
        if (e.vers === 'phase1' || e.vers === 'introduction' || e.vers === 'inactif') piliersDetruits = 0;                                            // une carte de titre ne survit pas à un changement d'état
        if (e.vers !== 'phase3') salveAnnoncee = false;
        if (e.vers === 'phase5') { jaugeAide.style.display = ''; minuteurs.push(setTimeout(function () { jaugeAide.style.display = 'none'; }, 9000)); }
        if (e.vers === 'termine' || e.vers === 'inactif' || e.vers === 'echec') { recompFin = Math.min(recompFin, horloge + 4); }
        if (e.vers === 'echec') toast('Le combat a été interrompu.', 4);
      }
    };

    var salveAnnoncee = false;   // v1.4 : message des salves de murs, une fois par phase 3
    var api = {
      version: VERSION,
      element: R,
      brancher: function (combat) {
        var offs = Object.keys(gestionnaires).map(function (t) { return combat.on(t, function (d) { gestionnaires[t](d || {}); }); });
        var f = function () { offs.forEach(function (x) { if (typeof x === 'function') x(); }); };
        debranchements.push(f);
        return f;
      },
      mettreAJour: function (dt, etat, ctx) {
        horloge += dt || 0;
        ctx = ctx || {};
        if (ctx.joueurLocalId) joueurLocal = ctx.joueurLocalId;
        if (!etat) return;
        R.classList.toggle('cinema', etat.controleJoueurs === false && etat.etat !== 'inactif');
        var b = etat.barre, bs = etat.boss || {};
        var mbVivant = bs.protege ? miniBossVivant(etat) : null;
        var obj = (etat.etat === 'phase1' && etat.secondeMoitie && objectifs.phase1b) ? objectifs.phase1b : (objectifs[etat.etat] || '');
        if (etat.etat === 'phase2' && bs.protege) {        // v1.3 : un mini-boss doit mourir avant que le Septième reprenne des dégâts
          if (mbVivant && objectifs.phase2mb) obj = objectifs.phase2mb.replace('{nom}', mbVivant.nom || 'le mini-boss');
          else if (!mbVivant && objectifs.phase2siphon) obj = objectifs.phase2siphon;
        }
        poser('objectif', obj, function (v) { objectif.querySelector('span').textContent = v; basculer(objectif, !!v); });
        // barre du boss
        basculer(boss, b && b.visible);
        if (b && b.visible) {
          poser('nom', C.general ? C.general.nomAffiche : '', function () { nom.innerHTML = ''; nom.appendChild(document.createTextNode(C.general.nomAffiche)); var sm = el('small', null, nom); sm.textContent = b.titre && b.titre !== C.general.nomAffiche ? b.titre : (C.general.sousTitre || ''); });
          poser('phase', etat.phase, function (p) { phase.textContent = p ? 'Phase ' + p + ' / 5' : ''; });
          var n = (b.segments || []).length;
          if (segs.length !== n) construireSegments(n);
          for (var i = 0; i < n; i++) {
            var s = segs[i], vide = i < b.segment;
            s.e.style.flexGrow = String(b.segments[i] || 1);
            if (s.e.classList.contains('vide') !== vide) s.e.classList.toggle('vide', vide);
            var f = i === b.segment ? Math.max(0, Math.min(1, b.max ? b.valeur / b.max : 0)) : (i < b.segment ? 0 : 1);
            var w = (f * 100).toFixed(1) + '%';
            if (s.i.style.width !== w) { s.i.style.width = w; s.b.style.width = w; }
          }
          for (var q = 0; q < seuils.length; q++) {          // v1.3 : seuil franchi (segment de la phase 2 entamé sous le repère, ou dépassé)
            var passe = b.segment > 1 || (b.segment === 1 && b.max > 0 && b.valeur / b.max <= seuils[q].f + 1e-6);
            if (seuils[q].e.classList.contains('passe') !== passe) seuils[q].e.classList.toggle('passe', passe);
          }
          poser('protege', !!bs.protege, function (v) { boss.classList.toggle('protege', v); });
          poser('protegeCouleur', mbVivant ? mbVivant.couleur || '' : '', function (v) { if (v) boss.style.setProperty('--mbc', v); else boss.style.removeProperty('--mbc'); });
          var txt = '';
          if (!bs.present) txt = 'Absent';
          else if (bs.protege) txt = mbVivant ? 'Protégé : abattez <span class="x" style="color:' + (mbVivant.couleur || '#9fd0ff') + '">' + esc(mbVivant.nom || 'le mini-boss') + '</span>' : 'Protégé : il siphonne une cuve';
          else if (bs.vulnerable === false) txt = 'Invulnérable';
          else if (bs.multiplicateur > 1.01) txt = 'Point faible exposé <span class="x">×' + fr(bs.multiplicateur, 2).replace(/0$/, '') + '</span>';
          else if (bs.multiplicateur < 0.99) txt = 'Résistant';
          if (bs.locomotion === 'affaibli') txt = 'Affaibli : frappez !';
          poser('etatBoss', txt, function (v) { etatBoss.innerHTML = v; });
        }
        majMiniBoss(b && b.visible ? etat.miniBoss : null);
        var mursActifs = !!(etat.murs && etat.murs.etat === 'electrifies');   // v1.5
        if (danger.classList.contains('on') !== mursActifs) danger.classList.toggle('on', mursActifs);
        poser('immunTxt', bs.protege ? 'Protégé' : 'Immunisé', function (v) { immun.textContent = v; });
        // compte à rebours
        var cr = etat.compteARebours;
        basculer(chrono, cr != null && cr > 0);
        if (cr != null && cr > 0) {
          poser('chronoLib', etat.etat, function (v) { chrono.querySelector('span').textContent = v === 'repit' ? 'Répit' : v === 'absence' ? 'Il reviendra dans' : 'Temps'; });
          poser('chronoVal', Math.ceil(cr), function (v) { chrono.querySelector('strong').textContent = v; });
        }
        // capture du cercle
        var c = etat.capture;
        basculer(cap, !!c && (etat.etat === 'rituel' || (etat.etat === 'rituel_fin' && etat.tempsEtat < 2.5)));
        if (c) {
          var pr = Math.max(0, Math.min(1, c.progression || 0));
          var off = (314.16 * (1 - pr)).toFixed(1);
          if (capVal.getAttribute('stroke-dashoffset') !== off) capVal.setAttribute('stroke-dashoffset', off);
          poser('capPct', Math.floor(pr * 100), function (v) { capPct.textContent = v + ' %'; });
          poser('capEtat', c.etat, function (v) {
            cap.classList.toggle('conteste', v === 'conteste'); cap.classList.toggle('recul', v === 'recul' || v === 'reinitialisation');
            capTitre.textContent = TEXTES_CAPTURE[v] || '';
          });
          var dureeCap = (C.phase4 && C.phase4.duree) || 30;
          var detail = c.etat === 'formation' ? '' : Math.ceil((1 - pr) * dureeCap) + ' s restantes' + (c.joueursDedans > 1 ? ' · ' + c.joueursDedans + ' dans le cercle' : '');
          poser('capDetail', detail, function (v) { capDetail.textContent = v; });
        }
        // v1.4 : salves de murs de la phase 3 (message à la première salve)
        if (etat.etat === 'phase3' && !salveAnnoncee && bs.action && bs.action.id === 'arrachement' && bs.action.donnees && bs.action.donnees.salve) {
          salveAnnoncee = true;
          toast('Il arrache maintenant plusieurs blocs à la fois : ne restez jamais immobiles !', 5);
        }
        // jauge du pacte
        var j = etat.jauge;
        basculer(jauge, !!j && etat.etat === 'phase5');
        var avecJ = !!j && etat.etat === 'phase5';
        if (R.classList.contains('avecjauge') !== avecJ) R.classList.toggle('avecjauge', avecJ);
        if (j) {
          var pl = bs.palier != null ? bs.palier : null;      // v1.4 : palier acquis (0–3)
          for (var r = 0; r < repPal.length; r++) { var ps = pl != null && pl > r; if (repPal[r].e.classList.contains('passe') !== ps) repPal[r].e.classList.toggle('passe', ps); }
          var cleAide = pl == null ? null : pl + (bs.intangible ? 'i' : '');   // v1.5 : rappel quand il est invisible
          poser('jaugePalier', cleAide, function () { jaugePalier.innerHTML = (pl != null && AIDES_PALIER[pl] ? AIDES_PALIER[pl] : '') + (bs.intangible ? ' <b style="color:#c9a6ff">Il est invisible : écoutez-le venir.</b>' : ''); });
          jaugeVue += ((j.valeur || 0) - jaugeVue) * Math.min(1, (dt || 0.016) * 12);
          jaugeI.style.width = (jaugeVue * 100).toFixed(1) + '%';
          poser('jaugeV', Math.floor((j.valeur || 0) * 100), function (v) { jaugeV.textContent = v + ' %'; });
          if (jauge.classList.contains('baisse') !== !!j.enBaisse) jauge.classList.toggle('baisse', !!j.enBaisse);
          if (jauge.classList.contains('gel') !== !!j.gelee) jauge.classList.toggle('gel', !!j.gelee);
        }
        // v1.4 : joueur local accroché par un crochet, ou étourdi (ctx.etourdi : secondes restantes, fourni par le jeu)
        var accroche = false, cr0 = etat.crochets;
        if (cr0 && joueurLocal) for (var c0 = 0; c0 < cr0.length; c0++) if (cr0[c0].joueur === joueurLocal && (cr0[c0].etat === 'accroche' || cr0[c0].etat === 'traction')) accroche = true;
        var txtAlerte = accroche ? 'Accroché !' : (ctx.etourdi > 0 ? 'Étourdi' : '');
        poser('alerte', txtAlerte, function (v) { if (v) alerte.textContent = v; basculer(alerte, !!v); });
        // état critique du joueur local
        var jl = etat.joueurs && joueurLocal ? etat.joueurs[joueurLocal] : null;
        basculer(critique, !!(jl && jl.critique));
        // invite d'interaction
        var it = etat.interaction, proche = !!it;
        if (it && ctx.positionLocale && it.position) {
          var dx = ctx.positionLocale.x - it.position.x, dz = ctx.positionLocale.z - it.position.z;
          proche = Math.sqrt(dx * dx + dz * dz) <= (it.rayon || 2.6) + 0.4;
        }
        basculer(inter, proche);
        if (it && proche) {
          poser('interTxt', it.texte || '', function (v) { interP.innerHTML = 'Maintenir <kbd></kbd> ' + ''; interP.querySelector('kbd').textContent = touche; interP.appendChild(document.createTextNode(v ? '— ' + v.replace(/^Maintenir la touche d’interaction pour /, '') : '')); });
          interI.style.width = ((it.progression || 0) * 100).toFixed(1) + '%';
        }
        // minuteries visuelles
        basculer(titre, horloge < titreFin);
        marque.style.opacity = horloge < marqueFin ? '1' : '0';
        immun.style.opacity = horloge < immunFin ? '1' : '0';
        if (horloge > recompFin) basculer(recomp, false);
        if (horloge > messageFin) basculer(message, false);
      },
      /** Affiche une carte de titre à la main. */
      titre: afficherTitre,
      toast: toast,
      dispose: function () {
        debranchements.forEach(function (f) { f(); });
        minuteurs.forEach(function (t) { clearTimeout(t); });
        if (R.parentNode) R.parentNode.removeChild(R);
      }
    };
    return api;
  }

  var BossB7Hud = { version: VERSION, creer: creer, NOMS: NOMS, OBJECTIFS: OBJECTIFS, AIDES_PALIER: AIDES_PALIER, MESSAGES_PALIER: MESSAGES_PALIER, MESSAGES_RAGE: MESSAGES_RAGE };
  if (typeof module === 'object' && module && module.exports) module.exports = BossB7Hud;
  if (root) root.BossB7Hud = BossB7Hud;
})(typeof globalThis !== 'undefined' ? globalThis : this);
