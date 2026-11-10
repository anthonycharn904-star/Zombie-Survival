# Points d'accroche du jeu 2.0.7 : sauvegarder et quitter, reprise des parties solo. Exécuté par build.py après
# hooks-manches.py. Demande d'Anthony du 3 novembre 2026 ; le système est dans le module src/S2-sauvegarde.js (section 29).
# Menus simples, dans le balisage existant (la refonte de la session Interface les reprend : ses classes s'appliquent aux
# boutons de #pause et à btn-resume-save, déjà dans son ordre du menu).

# styles : informations de la sauvegarde sous « Continuer la partie », raisons et messages
ins_before("""</style>
</head>""", """/* jeu 2.0.7 : sauvegarder et quitter (section 29) */
.save-info { font-size: 0.72em; opacity: 0.78; letter-spacing: 0; }
#pause-save-why, #menu-save-done { max-width: 30em; }
""")
# menu principal : message après une sauvegarde ou une reprise impossible
rep("""        <button class="btn" id="btn-exit" type="button" hidden>Quitter</button>
      </div>
""", """        <button class="btn" id="btn-exit" type="button" hidden>Quitter</button>
      </div>
      <p class="meta" id="menu-save-done" hidden></p>
""")
# pause : « Sauvegarder et quitter » et la raison quand c'est impossible
rep("""    <button class="btn" id="btn-restart" type="button">Recommencer</button>
""", """    <button class="btn" id="btn-restart" type="button">Recommencer</button>
    <button class="btn" id="btn-save-quit" type="button">Sauvegarder et quitter</button>
    <p class="meta" id="pause-save-why" hidden></p>
""")
# confirmation : un écran à part (Échap l'annule sans reprendre la partie)
rep("""    <button class="btn" id="btn-exit-pause" type="button" hidden>Quitter le jeu</button>
  </div>
</section>
""", """    <button class="btn" id="btn-exit-pause" type="button" hidden>Quitter le jeu</button>
  </div>
</section>

<section id="confirm" class="screen panel-screen" hidden aria-labelledby="confirm-title">
  <div class="panel">
    <h2 id="confirm-title"></h2>
    <p class="meta" id="confirm-text"></p>
    <button class="btn primary" id="btn-confirm-yes" type="button"></button>
    <button class="btn" id="btn-confirm-alt" type="button" hidden></button>
    <button class="btn" id="btn-confirm-no" type="button">Annuler</button>
  </div>
</section>
""")
rep("""  for (const s of ['menu', 'mapsel', 'stats', 'models', 'ranking', 'mods', 'pause', 'options', 'gameover', 'loading', 'nogl']) {""",
    """  for (const s of ['menu', 'mapsel', 'stats', 'models', 'ranking', 'mods', 'pause', 'options', 'gameover', 'loading', 'nogl', 'confirm']) {""")
# menu principal : « Continuer la partie » sur la sauvegarde la plus récente
rep("""  const resume = $('btn-resume-save');
  if (G.save && G.save.round) { resume.hidden = false; resume.textContent = `Reprendre à la manche ${G.save.round}`; }
  else resume.hidden = true;
""", """  sauveMenu();                                 // jeu 2.0.7 : « Continuer la partie » (section 29)
""")
rep("""  click('btn-resume-save', () => { const s = G.save; G.save = null; startGame(s); });""",
    """  click('btn-resume-save', sauveMenuContinuer);   // jeu 2.0.7 : sauvegarde de la carte (section 29)""")
# pause : sauvegarder et quitter ; quitter au menu sans sauvegarder demande confirmation
rep("""  click('btn-quit', quitToMenu);
""", """  click('btn-quit', sauveQuitterSansSauver);      // jeu 2.0.7 : confirmation (section 29)
  click('btn-save-quit', () => { sauverEtQuitter(); });
  click('btn-confirm-yes', () => sauveConfirmFin('oui'));
  click('btn-confirm-alt', () => sauveConfirmFin('autre'));
  click('btn-confirm-no', () => sauveConfirmFin(null));
""")
rep("""      $(id).addEventListener('click', () => { Sound.ui(); Life.save(); exitLock(); window.zsLauncher.quit(); });""",
    """      const quitter = () => { Life.save(); exitLock(); window.zsLauncher.quit(); };
      $(id).addEventListener('click', () => { Sound.ui(); if (id === 'btn-exit-pause') sauveQuitterJeu(quitter); else quitter(); });   // jeu 2.0.7""")
# pause : état du bouton et raison
rep("""  showScreen('pause');
  HUD.el.lockhint.hidden = true;""", """  showScreen('pause');
  sauvePause();                                // jeu 2.0.7 : sauvegarder et quitter (section 29)
  HUD.el.lockhint.hidden = true;""")
# nouvelle partie sur une carte sauvegardée : continuer, ou la remplacer après confirmation
rep("""  if (!map || G.state !== 'menu') return;
  Sound.ui();
  G.save = null;
""", """  if (!map || G.state !== 'menu') return;
  if (sauveAvantNouvelle(map)) return;         // jeu 2.0.7 : partie sauvegardée sur cette carte (section 29)
  Sound.ui();
  G.save = null;
""")
# début d'une partie : le message du menu s'efface
rep("""  newGame(save);
  if (!save) { Life.add('games'); Life.mapGame(G.mapId); }
""", """  newGame(save);
  if (!save) { Life.add('games'); Life.mapGame(G.mapId); }
  $('menu-save-done').hidden = true; G.tempsAvant = 0;   // jeu 2.0.7 : sauvegarde (section 29)
""")
# fin de la partie : ses sauvegardes sont effacées (pas de retour en arrière)
rep("""  Life.best(rounds);
  Life.save();
""", """  Life.best(rounds);
  Life.save();
  sauveFinPartie();                            // jeu 2.0.7 : sauvegarde (section 29)
""")
# à terre : la sauvegarde de secours est effacée (elle revient quand la partie est de nouveau calme)
rep("""function goDown() {
  G.stats.downs++;
""", """function goDown() {
  G.stats.downs++;
  sauveSecoursEfface();                        // jeu 2.0.7 : sauvegarde de secours (section 29)
""")
# zombie recréé à la reprise : il garde son type (sinon tiré au hasard selon le lieu)
rep("""function zoneZombieType(zi) {
""", """function zoneZombieType(zi) {
  if (SAUVE.typeForce) return SAUVE.typeForce;  // jeu 2.0.7 : zombie recréé par la sauvegarde (section 29)
""")
# démarrage : sauvegardes passées dans les fichiers du launcher, « Continuer » depuis l'accueil du launcher
rep("""  refreshMenu();
  showScreen('menu');
  requestAnimationFrame(frame);
}
""", """  refreshMenu();
  showScreen('menu');
  requestAnimationFrame(frame);
  sauveDemarrage();                            // jeu 2.0.7 : sauvegardes (section 29)
}
""")
# reprise d'une sauvegarde : la partie repart en pause, sans demander la souris verrouillée (bug relevé par Anthony le
# 4 novembre 2026 : demandée par startGame puis accordée pendant la pause, elle cachait le curseur et envoyait les clics au
# jeu au lieu du bouton Reprendre ; la partie se remettait sans cesse en pause). Le bouton Reprendre la demande, au clic.
rep("""  lastT = performance.now();
  requestLock();
}
function pauseGame() {""", """  lastT = performance.now();
  if (!SAUVE.reprise) requestLock();           // jeu 2.0.7 : reprise d'une sauvegarde, en pause (section 29)
}
function pauseGame() {""")
# souris verrouillée accordée hors du jeu (pause, menu, fin de partie : demande partie juste avant) : rendue aussitôt
rep("""  Input.locked = document.pointerLockElement === renderer.domElement;
  if (Input.locked) setFallback(false);
""", """  Input.locked = document.pointerLockElement === renderer.domElement;
  if (Input.locked && G.state !== 'playing') { exitLock(); return; }   // jeu 2.0.7 : jamais verrouillée hors du jeu (section 29)
  if (Input.locked) setFallback(false);
""")
