/*!
 * hud-points.js v1.0.0 — Zombie Survival
 * Portrait carré du joueur + points, coin inférieur gauche de l'écran.
 * Disposition : coéquipiers empilés au-dessus (petits), joueur local en bas (grand, points en jaune).
 * Aucune dépendance. Script classique → window.PointsHud ; CommonJS → module.exports ; ES module → hud-points.mjs.
 * Police intégrée : Teko SemiBold (600), © 2023 The Teko Project Authors, SIL Open Font License 1.1
 *   (texte complet dans LICENCE-Teko-OFL.txt, à garder avec ce fichier).
 * Portrait intégré : rendu du modèle 3D d'Anthony (survivant.js), WebP 256 × 256, fond transparent.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.PointsHud = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';

  var VERSION = '1.0.0';
  var FONT_URL = 'data:font/woff2;base64,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';
  var PORTRAIT_ANTHONY = 'data:image/webp;base64,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';
  var PORTRAIT_SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#77706a"/><stop offset="1" stop-color="#2f2a27"/></linearGradient></defs>' +
    '<path fill="url(#g)" d="M32 10c-7.9 0-13.4 6.2-13.4 14.6 0 6 2.8 11.3 6.9 14v3.6C16.3 44.1 9 49.6 7 57.4V64h50v-6.6c-2-7.8-9.3-13.3-18.5-15.2v-3.6c4.1-2.7 6.9-8 6.9-14C45.4 16.2 39.9 10 32 10z"/></svg>');

  // Couleurs par défaut, prises sur la référence : joueur local jaune, coéquipiers vert, bleu, blanc.
  var COLOR_LOCAL = '#f9dc3e';
  var COLOR_MATES = ['#86e070', '#6cc7f2', '#f0f0f0'];
  var COLOR_SPEND = '#ff4d3d';
  var MINUS = '−';
  var STYLE_ID = 'zs-points-style';
  var FAMILY = "'ZS Teko', Teko, 'Bahnschrift SemiCondensed', Bahnschrift, 'Arial Narrow', 'Roboto Condensed', Oswald, Impact, sans-serif";
  var styleUsers = 0;
  var idCounter = 0;

  // Métriques de Teko : chiffres de 0,636 em de haut, ascendante 0,958, descendante 0,475.
  // Avec line-height .636 et top .0765em, la boîte du nombre épouse exactement la hauteur des chiffres.
  var CSS = [
    "@font-face{font-family:'ZS Teko';src:url(" + FONT_URL + ") format('woff2');font-weight:600;font-style:normal;font-display:block}",
    '.zs-points{--zs-s:clamp(52px,6.4vh,120px);--zs-left:clamp(12px,3.4vw,72px);--zs-bottom:clamp(12px,5vh,96px);',
    'position:fixed;left:calc(env(safe-area-inset-left,0px) + var(--zs-left));bottom:calc(env(safe-area-inset-bottom,0px) + var(--zs-bottom));',
    'z-index:30;display:flex;flex-direction:column;align-items:flex-start;gap:calc(var(--zs-s)*.05);margin:0;padding:0;border:0;background:none;box-sizing:content-box;width:auto;height:auto;text-transform:none;',
    'pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;',
    'font-family:' + FAMILY + ';font-weight:600;font-style:normal;line-height:1;letter-spacing:normal;',
    'opacity:1;visibility:visible;transition:opacity .2s ease,visibility 0s linear 0s}',
    '.zs-points--in-container{position:absolute}',
    '.zs-points--hidden{opacity:0;visibility:hidden;transition:opacity .2s ease,visibility 0s linear .2s}',
    '.zs-points__row,.zs-points__slot,.zs-points__face,.zs-points__score,.zs-points__value,.zs-points__pops,.zs-points__pop{margin:0;padding:0;border:0;background-color:transparent;box-sizing:content-box;float:none;line-height:1;font-family:inherit;font-weight:inherit;font-style:normal;letter-spacing:normal;text-transform:none}',
    '.zs-points__row{display:flex;align-items:center;gap:calc(var(--zs-s)*.12);--zs-face:calc(var(--zs-s)*.59);--zs-font:calc(var(--zs-s)*.6)}',
    '.zs-points__row--local{align-items:flex-start;--zs-face:var(--zs-s);--zs-font:calc(var(--zs-s)*.82)}',
    '.zs-points__row--mate+.zs-points__row--local{margin-top:calc(var(--zs-s)*.05)}',
    '.zs-points__slot{flex:none;width:var(--zs-s);display:flex;justify-content:flex-end}',
    '.zs-points__face{position:relative;flex:none;width:var(--zs-face);height:var(--zs-face);overflow:hidden;',
    'border-radius:calc(var(--zs-s)*.045);',
    'background:radial-gradient(62% 58% at 26% 62%,rgba(255,132,48,.42),rgba(255,132,48,0) 72%),',
    'radial-gradient(130% 120% at 50% 30%,#2c2622 0%,#15110f 68%,#0c0a09 100%);',
    'box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 calc(var(--zs-s)*.03) calc(var(--zs-s)*.14) rgba(0,0,0,.6)}',
    ".zs-points__face::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;border-radius:inherit;",
    'box-shadow:inset 0 0 calc(var(--zs-s)*.12) rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.08)}',
    '.zs-points__face img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;max-width:none;border:0;margin:0;padding:0}',
    '.zs-points__score{position:relative;flex:none;display:flex;align-items:flex-start;font-size:var(--zs-font);color:var(--zs-color);white-space:nowrap}',
    '.zs-points__value{display:block;position:relative;top:.0765em;font-size:1em;color:inherit;line-height:.636;letter-spacing:.01em;transform-origin:0 60%;',
    'text-shadow:0 0 .03em rgba(0,0,0,.95),0 .03em .07em rgba(0,0,0,.8),0 0 .2em var(--zs-glow)}',
    '.zs-points__pops{position:absolute;left:100%;top:50%;width:0;height:0;font-size:1em}',
    '.zs-points__pop{position:absolute;left:0;top:-.2415em;font-size:.5em;line-height:.636;letter-spacing:.01em;white-space:nowrap;opacity:0;',
    'color:var(--zs-color);text-shadow:0 0 .05em rgba(0,0,0,.95),0 .04em .1em rgba(0,0,0,.8),0 0 .25em var(--zs-glow)}',
    '.zs-points__pop--spend{color:' + COLOR_SPEND + ';text-shadow:0 0 .05em rgba(0,0,0,.95),0 .04em .1em rgba(0,0,0,.8),0 0 .25em rgba(255,77,61,.5)}'
  ].join('');

  function hasDom() { return typeof document !== 'undefined' && !!document.createElement; }
  var canAnimate = hasDom() && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function cssLen(v) { return typeof v === 'number' ? v + 'px' : String(v); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function toPoints(v, what) {
    var n = Number(v);
    if (!isFinite(n)) throw new TypeError('PointsHud: ' + (what || 'points') + ' doit être un nombre fini (reçu ' + v + ')');
    return Math.max(0, Math.round(n));
  }
  function toAmount(v, what) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) throw new TypeError('PointsHud: ' + (what || 'montant') + ' doit être un nombre positif ou nul (reçu ' + v + ')');
    return Math.round(n);
  }

  var colorCtx = null;
  function glowOf(color) {
    var c = String(color).trim(), m;
    if (!/^#|^rgb/i.test(c)) {
      try { colorCtx = colorCtx || document.createElement('canvas').getContext('2d'); } catch (e) { colorCtx = null; }
      if (colorCtx) { colorCtx.fillStyle = '#000'; colorCtx.fillStyle = c; c = colorCtx.fillStyle; }
    }
    if ((m = /^#([0-9a-f]{3})$/i.exec(c))) c = '#' + m[1].replace(/(.)/g, '$1$1');
    if ((m = /^#([0-9a-f]{6})/i.exec(c))) { var x = parseInt(m[1], 16); return 'rgba(' + (x >> 16) + ',' + ((x >> 8) & 255) + ',' + (x & 255) + ',.55)'; }
    if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c))) return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',.55)';
    return 'transparent';
  }

  function injectStyle() {
    styleUsers++;
    if (document.getElementById(STYLE_ID)) return;
    var s = el('style'); s.id = STYLE_ID; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function releaseStyle() {
    styleUsers = Math.max(0, styleUsers - 1);
    if (styleUsers === 0) { var s = document.getElementById(STYLE_ID); if (s && s.parentNode) s.parentNode.removeChild(s); }
  }

  // ───────────── une ligne : portrait + points ─────────────
  function Row(hud, o, isLocal) {
    this.hud = hud;
    this.local = isLocal;
    this.id = o.id != null ? String(o.id) : (isLocal ? 'local' : 'p' + (++idCounter));
    this.points = toPoints(o.points != null ? o.points : 500, 'points');
    this.name = o.name || (isLocal ? 'Anthony' : 'Joueur');
    this.pool = []; this.live = []; this.bumpAnim = null;

    this.el = el('div', 'zs-points__row ' + (isLocal ? 'zs-points__row--local' : 'zs-points__row--mate'));
    this.el.setAttribute('data-player', this.id);
    var slot = el('div', 'zs-points__slot');
    this.face = el('div', 'zs-points__face');
    this.img = el('img');
    this.img.alt = ''; this.img.draggable = false; this.img.decoding = 'async';
    var img = this.img;
    this.img.onerror = function () { if (img.src !== PORTRAIT_SILHOUETTE) img.src = PORTRAIT_SILHOUETTE; };
    this.face.appendChild(this.img); slot.appendChild(this.face);
    this.score = el('div', 'zs-points__score');
    this.value = el('span', 'zs-points__value');
    this.pops = el('span', 'zs-points__pops');
    this.pops.setAttribute('aria-hidden', 'true');
    this.score.appendChild(this.value); this.score.appendChild(this.pops);
    this.el.appendChild(slot); this.el.appendChild(this.score);

    this.setPortrait(o.portrait || (isLocal ? PORTRAIT_ANTHONY : PORTRAIT_SILHOUETTE));
    this.setColor(o.color || (isLocal ? COLOR_LOCAL : COLOR_MATES[(hud._mateCount++) % COLOR_MATES.length]));
    this.render();
  }

  Row.prototype.render = function () {
    var txt = this.hud._format(this.points);
    this.value.textContent = txt;
    this.el.setAttribute('aria-label', this.name + ' : ' + txt + ' points');
  };
  Row.prototype.setPortrait = function (url) { this.img.src = url || PORTRAIT_SILHOUETTE; };
  Row.prototype.setColor = function (c) {
    this.color = String(c);
    this.el.style.setProperty('--zs-color', this.color);
    this.el.style.setProperty('--zs-glow', glowOf(this.color));
  };
  Row.prototype.setName = function (n) { this.name = String(n); this.render(); };

  Row.prototype.set = function (v, o) {
    o = o || {};
    var next = toPoints(v, 'points'), delta = next - this.points;
    if (delta === 0) return this.points;
    this.points = next;
    this.render();
    if (o.popup !== false) this.feedback(delta);
    this.hud._emit({ id: this.id, local: this.local, points: next, delta: delta, reason: o.reason });
    return next;
  };
  Row.prototype.add = function (n, o) {
    var d = Number(n);
    if (!isFinite(d)) throw new TypeError('PointsHud: addPoints attend un nombre fini (reçu ' + n + ')');
    return this.set(this.points + Math.round(d), o);
  };
  Row.prototype.spend = function (n, o) {
    o = o || {};
    var cost = toAmount(n, 'coût');
    if (cost > this.points) { if (o.feedback !== false) this.refuse(); return false; }
    this.set(this.points - cost, o);
    return true;
  };

  Row.prototype.feedback = function (delta) {
    if (!canAnimate || !this.hud._popups) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    var reduced = this.hud._reduced();
    this.popup((delta > 0 ? '+' : MINUS) + this.hud._format(Math.abs(delta)), delta > 0 ? 'gain' : 'spend', reduced);
    if (reduced) return;
    if (this.bumpAnim) this.bumpAnim.cancel();
    this.bumpAnim = delta > 0
      ? this.value.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' })
      : this.value.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(.05em)', offset: 0.3 }, { transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
  };

  Row.prototype.popup = function (text, kind, reduced) {
    var p;
    if (this.pool.length) p = this.pool.pop();
    else if (this.live.length >= this.hud._maxPopups) { p = this.live.shift(); if (p._anim) p._anim.cancel(); }
    else { p = el('span'); this.pops.appendChild(p); }
    p.className = 'zs-points__pop zs-points__pop--' + kind;
    p.textContent = text;
    this.live.push(p);
    var x0 = 0.45, frames;
    if (reduced) {
      var t = 'translate(' + x0 + 'em,0)';
      frames = [{ transform: t, opacity: 0 }, { transform: t, opacity: 1, offset: 0.15 }, { transform: t, opacity: 1, offset: 0.6 }, { transform: t, opacity: 0 }];
    } else {
      // gains : partent vers la droite en montant ; dépenses : vers la droite en descendant
      var a = (kind === 'gain' ? rand(-50, 12) : rand(18, 48)) * Math.PI / 180, d = rand(1.3, 2.0);
      var dx = Math.cos(a) * d, dy = Math.sin(a) * d;
      var tr = function (k, s) { return 'translate(' + (x0 + dx * k).toFixed(3) + 'em,' + (dy * k).toFixed(3) + 'em) scale(' + s + ')'; };
      frames = [
        { transform: 'translate(.2em,0) scale(.7)', opacity: 0 },
        { transform: tr(0, 1.08), opacity: 1, offset: 0.12 },
        { transform: tr(0.45, 1), opacity: 1, offset: 0.5 },
        { transform: tr(1, 0.94), opacity: 0 }
      ];
    }
    var self = this, anim = p.animate(frames, { duration: kind === 'gain' ? 1000 : 1150, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
    p._anim = anim;
    anim.onfinish = function () {
      if (p._anim !== anim) return;
      anim.cancel(); p._anim = null;
      var i = self.live.indexOf(p); if (i >= 0) self.live.splice(i, 1);
      self.pool.push(p);
    };
  };

  Row.prototype.refuse = function () {
    if (!canAnimate) return;
    if (this.bumpAnim) this.bumpAnim.cancel();
    var c = this.color, r = COLOR_SPEND;
    var frames = this.hud._reduced()
      ? [{ color: r }, { color: r, offset: 0.5 }, { color: c }]
      : [
          { transform: 'translateX(0)', color: r },
          { transform: 'translateX(-.06em)', color: r, offset: 0.15 },
          { transform: 'translateX(.05em)', color: r, offset: 0.35 },
          { transform: 'translateX(-.035em)', color: r, offset: 0.55 },
          { transform: 'translateX(.02em)', color: r, offset: 0.75 },
          { transform: 'translateX(0)', color: c }
        ];
    this.bumpAnim = this.value.animate(frames, { duration: 460, easing: 'linear' });
  };

  Row.prototype.destroy = function () {
    if (this.bumpAnim) this.bumpAnim.cancel();
    for (var i = 0; i < this.live.length; i++) if (this.live[i]._anim) this.live[i]._anim.cancel();
    this.live.length = 0; this.pool.length = 0;
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  };

  function handleOf(hud, row) {
    return {
      get id() { return row.id; },
      get local() { return row.local; },
      element: row.el,
      getPoints: function () { return row.points; },
      setPoints: function (v, o) { return row.set(v, o); },
      addPoints: function (n, o) { return row.add(n, o); },
      spend: function (n, o) { return row.spend(n, o); },
      canAfford: function (n) { return row.points >= toAmount(n, 'coût'); },
      refuse: function () { row.refuse(); },
      setPortrait: function (url) { row.setPortrait(url); },
      setColor: function (c) { row.setColor(c); },
      setName: function (n) { row.setName(n); },
      remove: function () { return row.local ? false : hud._removePlayer(row.id); }
    };
  }

  // ───────────── création du HUD ─────────────
  function create(options) {
    if (!hasDom()) throw new Error('PointsHud.create doit être appelé dans un navigateur (document introuvable)');
    var o = options || {};
    var container = o.container || document.body;
    if (!container) throw new Error('PointsHud: document.body n’existe pas encore — appeler create() après le chargement du DOM');

    injectStyle();
    var listeners = [];
    var mql = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    var motion = o.motion || 'auto';
    var rows = [];
    var disposed = false;

    var hud = {
      _mateCount: 0,
      _popups: o.popups !== false,
      _maxPopups: Math.max(1, o.maxPopups || 12),
      _format: typeof o.format === 'function' ? function (n) { return String(o.format(n)); } : function (n) { return String(n); },
      _reduced: function () { return motion === 'reduced' || (motion === 'auto' && !!(mql && mql.matches)); },
      _emit: function (e) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (err) { setTimeout(function () { throw err; }); } } }
    };

    var rootEl = el('div', 'zs-points');
    rootEl.setAttribute('role', 'group');
    rootEl.setAttribute('aria-label', 'Points');
    if (container !== document.body && container !== document.documentElement) {
      rootEl.classList.add('zs-points--in-container');
      if (typeof getComputedStyle === 'function' && getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }
    if (o.size != null) rootEl.style.setProperty('--zs-s', cssLen(o.size));
    if (o.left != null) rootEl.style.setProperty('--zs-left', cssLen(o.left));
    if (o.bottom != null) rootEl.style.setProperty('--zs-bottom', cssLen(o.bottom));
    if (o.zIndex != null) rootEl.style.zIndex = String(o.zIndex);
    if (o.className) rootEl.className += ' ' + o.className;

    var localRow = new Row(hud, { id: o.id, name: o.name, points: o.points, color: o.color, portrait: o.portrait }, true);
    rows.push(localRow);
    rootEl.appendChild(localRow.el);
    container.appendChild(rootEl);
    var local = handleOf(hud, localRow);
    var handles = {}; handles[localRow.id] = local;

    function find(id) { for (var i = 0; i < rows.length; i++) if (rows[i].id === String(id)) return rows[i]; return null; }

    var api = {
      version: VERSION,
      element: rootEl,
      local: local,
      // raccourcis vers le joueur local
      getPoints: local.getPoints,
      setPoints: local.setPoints,
      addPoints: local.addPoints,
      spend: local.spend,
      canAfford: local.canAfford,
      refuse: local.refuse,
      setPortrait: local.setPortrait,
      setColor: local.setColor,
      setName: local.setName,
      // coéquipiers (au-dessus du joueur local, dans l'ordre d'ajout)
      addPlayer: function (p) {
        p = p || {};
        if (p.id != null && find(p.id)) throw new Error('PointsHud: un joueur « ' + p.id + ' » existe déjà');
        var row = new Row(hud, p, false);
        rows.splice(rows.length - 1, 0, row);
        rootEl.insertBefore(row.el, localRow.el);
        return (handles[row.id] = handleOf(hud, row));
      },
      getPlayer: function (id) { return handles[String(id)] || null; },
      removePlayer: function (id) {
        var row = find(id);
        if (!row || row.local) return false;
        row.destroy(); rows.splice(rows.indexOf(row), 1); delete handles[row.id];
        return true;
      },
      players: function () { return rows.map(function (r) { return handles[r.id]; }); },
      setVisible: function (v) { rootEl.classList.toggle('zs-points--hidden', !v); },
      isVisible: function () { return !rootEl.classList.contains('zs-points--hidden'); },
      setPopups: function (v) { hud._popups = !!v; },
      setMotion: function (m) { motion = m === 'full' || m === 'reduced' ? m : 'auto'; },
      onChange: function (fn) {
        listeners.push(fn);
        return function off() { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        for (var i = 0; i < rows.length; i++) rows[i].destroy();
        rows.length = 0; listeners.length = 0;
        if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
        releaseStyle();
      }
    };
    hud._removePlayer = api.removePlayer;
    return api;
  }

  return {
    version: VERSION,
    create: create,
    createPointsHud: create,
    PORTRAIT_ANTHONY: PORTRAIT_ANTHONY,
    PORTRAIT_SILHOUETTE: PORTRAIT_SILHOUETTE,
    COLORS: { local: COLOR_LOCAL, mates: COLOR_MATES.slice(), spend: COLOR_SPEND }
  };
});
