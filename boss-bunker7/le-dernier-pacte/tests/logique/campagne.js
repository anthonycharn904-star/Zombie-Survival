'use strict';
// Campagne d'équilibrage (v1.5, API.md §17.7), depuis la racine du paquet : NG=40 node tests/logique/campagne.js
// MODES=1:0,1:30,4:0,4:30 (joueurs:chargeur ; 0 = tir continu, 30 = arme du prototype) → victoires (5 graines de référence,
// 15, NG), durées par phase (victoires), mini-boss, morts par phase et par cause. SURCHARGES='{"miniBoss":{...}}' pour essayer
// un réglage sans toucher à src/config.js. Une campagne complète (4 modes × 40 combats) prend quelques minutes.
var path = require('path');
var M = require(path.join(process.cwd(), 'tests/logique/mesures.js'));
var G = [1939, 7, 99, 404, 2718, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11];
var NG = +(process.env.NG || 15);
for (var gi = 12; G.length < NG; gi++) G.push(gi * 101 + 17);
var surch = process.env.SURCHARGES ? JSON.parse(process.env.SURCHARGES) : undefined;
(process.env.MODES || '1:0,1:30,4:0,4:30').split(',').forEach(function (md) {
  var n = +md.split(':')[0], ch = +md.split(':')[1];
  var l = G.map(function (g) { return M.mesurer({ n: n, graine: g, chargeur: ch, surcharges: surch ? JSON.parse(JSON.stringify(surch)) : undefined }); });
  function v(sous) { return sous.filter(function (m) { return m.fin === 'termine'; }).length; }
  var g = l.filter(function (m) { return m.fin === 'termine'; });
  function st(k) { if (!g.length) return '-'; var x = g.map(function (m) { return m[k]; }); var moy = x.reduce(function (a, b) { return a + b; }, 0) / x.length; return Math.min.apply(null, x).toFixed(0) + '–' + Math.max.apply(null, x).toFixed(0) + ' (' + moy.toFixed(0) + ')'; }
  var mp = {}, mc = {};
  l.forEach(function (m) { for (var k in m.mortsPhase) mp[k] = (mp[k] || 0) + m.mortsPhase[k]; for (var c in m.mortsCause) mc[c] = (mc[c] || 0) + m.mortsCause[c]; });
  var sansMort = l.filter(function (m) { return m.morts === 0; }).length;
  console.log('■ ' + (n === 1 ? 'solo' : 'coop ' + n) + ', ' + (ch ? 'chargeur ' + ch : 'tir continu') + ' : ' + v(l.slice(0, 5)) + '/5, ' + v(l.slice(0, 15)) + '/15, ' + v(l) + '/' + l.length + ' victoires (sans mort ' + sansMort + '/' + l.length + ')');
  console.log('   durées (victoires, min–max (moy), s) : total ' + st('total') + ' · P1 ' + st('phase1') + ' · P2 ' + st('phase2') + ' (protection ' + st('protection') + ') · P3 ' + st('phase3') + ' · P4 ' + st('p4') + ' (faiblesse ' + st('faiblesse') + ') · P5 ' + st('phase5'));
  console.log('   mini-boss : Survolté ' + st('dureeSurvolte') + ' · Irradié ' + st('dureeIrradie') + ' · Démembré ' + st('dureeDemembre') + ' · salves ' + st('salves') + ' · zombies de la faiblesse ' + st('zombiesFaiblesse') + ' · crochets ' + st('accroches') + '/' + st('crochets'));
  function tous(k) { var x = l.map(function (m) { return m[k]; }); return (x.reduce(function (a, b) { return a + b; }, 0) / x.length); }
  console.log('   v1.5 (moyennes, tous combats) : murs ' + (tous('degatsMurs') * 100).toFixed(0) + ' % · zombies irradiés ' + (tous('degatsIrradies') * 100).toFixed(0) + ' % · petits ' + tous('petitsTues').toFixed(1) + '/' + tous('petits').toFixed(1) +
    ' (' + (tous('degatsPetits') * 100).toFixed(0) + ' %) · charges ' + tous('chargesTouches').toFixed(1) + '/' + tous('charges').toFixed(1) + ' touches (' + (tous('degatsCharge') * 100).toFixed(0) + ' %, ' + tous('impactsMur').toFixed(1) + ' contre le mur) · intangible ' +
    tous('intangibilites').toFixed(1) + ' (' + tous('frappesResurgissement').toFixed(1) + ' frappes au resurgissement) · munitions max ' + tous('munitionsMax').toFixed(1) + ' · tirs ' + st('tirs') + ' (victoires)');
  console.log('   morts par phase ' + JSON.stringify(mp) + ' · par cause ' + JSON.stringify(mc));
});
