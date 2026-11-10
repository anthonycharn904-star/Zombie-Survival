'use strict';
/* Maquettes du launcher : données. Elles sont réelles, sauf celles marquées « exemple » ou « simulée ».
   Relevées le 31 octobre 2026 : launcher/config/default.json (source, clé), launcher/game (taille installée),
   paquet compressé du jeu (mesuré), README « Historique » (résumés des versions 1.5.1 à 2.0.6),
   launcher/config/notes-history.json (notes publiées des versions 1.0.2 à 1.5.0, ajoutées par assembler.py). */
window.ZSM_DONNEES = {
  jeu: { version: '2.0.6', construction: 1, editeur: 9, date: '2026-10-20' },
  launcher: '1.3.3',
  tailleInstallee: 8.26e6,
  paquet: 4.32e6,
  dossier: '%APPDATA%\\Zombie Survival',
  source: {
    nom: 'GitHub · releases/latest',
    url: 'https://github.com/anthonycharn904-star/zombie-survival/releases/latest/download/latest.json',
    empreinte: '8508-2046-8B30-034A',
  },
  reglages: { fullscreen: true, keepLauncherOpen: false, autoCheck: true, autoInstall: true },   // DEFAULT_SETTINGS du launcher
  // versions fictives des scénarios de la maquette
  simule: { jeu: '2.0.7', launcher: '1.4.0', taille: 4.41e6 },
  cartes: [
    { id: 'bunker7', nom: 'Bunker 7', genre: 'Carte à grille', lieu: 'Bunker militaire',
      texte: 'Salles, couloirs et abords : 22 bâtiments abandonnés, des zombies propres à chaque pièce, le Glas.', image: 'bunker' },
    { id: 'khamsin', nom: 'Khamsin', genre: 'Monde ouvert', lieu: 'Désert égyptien',
      texte: "Le plateau des pyramides, cerné par une tempête permanente et mortelle ; trois jeeps d'archéologie.", image: null },
    { id: 'ombre', nom: 'Ombre éternelle', genre: 'Monde ouvert', lieu: 'Lune',
      texte: "Une mine de glace en gradins, une gravité de 1/6 g, l'oxygène compté.", image: 'lune' },
  ],
  // résumés d'après le README (exemple : les notes publiées par Anthony peuvent différer)
  historique: [
    { version: '2.0.6', date: '2026-10-20', exemple: true, notes: [
      'Prise des armes refaite : prises déclarées pour les 16 armes, mains et pouces anatomiques.',
      'Khamsin ramené au plateau des pyramides, cerné par une tempête permanente et mortelle.',
      "Jeep d'archéologie pour les trois 4×4 de Khamsin.",
      'Anthony, premier personnage jouable : corps visible, vue TPS (touche T), au volant.',
      'Rechargements et boisson retravaillés ; rechargement du corps en vue TPS.',
      'Glissade, annulation de glissade et sprint tactique.',
      'Nouveau HUD des points : portrait et points.'] },
    { version: '2.0.4', date: '2026-10-13', exemple: true, notes: [
      'Le khépesh, arme de corps-à-corps de Khamsin.',
      'Bibliothèques de textures et de modèles pour les cartes.',
      'Mod Tools : flèches de déplacement, vue XY.'] },
    { version: '2.0.3', date: '2026-10-12', exemple: true, notes: [
      'Mod Tools : tailles réglables des objets, textures, bâtiments et éléments.'] },
    { version: '2.0.0', date: '2026-10-09', exemple: true, notes: [
      'Deux nouvelles cartes en monde ouvert : Khamsin, le désert égyptien, et Ombre éternelle, sur la Lune.'] },
    { version: '1.9.0', date: '2026-10-08', exemple: true, notes: [
      'Animations des zombies refaites.', 'Manches de chiens.', 'Grenade Mk 2 et lancer animé.', 'Couteau « Fossoyeur » ZS-1.'] },
    { version: '1.8.0', date: '2026-10-06', exemple: true, notes: [
      'Des zombies propres à chaque pièce de Bunker 7, dont Le Lacéré et Le Savant.'] },
    { version: '1.7.0', date: '2026-10-05', exemple: true, notes: [
      'Les abords de Bunker 7 : 22 bâtiments abandonnés, tous différents.'] },
    { version: '1.6.0', date: '2026-10-05', exemple: true, notes: [
      'Atouts renommés : Mastodonte, Rechargement rapide, Double coup, Quick Revive, Staminup.'] },
    { version: '1.5.1', date: '2026-10-05', exemple: true, notes: ['Le digi pass revient.'] },
  ],
  // actualités : exemples (le vrai launcher les reçoit du fichier de mise à jour signé : titre, texte, date)
  actus: [
    { titre: 'Khamsin se resserre autour des pyramides', date: '2026-10-20', image: 'khamsin', categorie: 'Carte',
      texte: 'La partie se joue désormais sur le plateau des pyramides. Au-delà, la tempête ne pardonne pas : la traverser est possible, y survivre ne l’est pas.' },
    { titre: 'Anthony prend les commandes', date: '2026-10-20', image: 'portrait', categorie: 'Personnage',
      texte: 'Premier personnage jouable : son corps en vue FPS, la vue TPS sur la touche T, et le volant de la jeep d’archéologie.' },
    { titre: 'Le khépesh tranche dans le désert', date: '2026-10-13', image: 'khamsin', categorie: 'Arme',
      texte: 'L’arme de corps-à-corps de Khamsin, en bronze, remplace le couteau sur cette carte et sur celles qui en dérivent.' },
    { titre: 'Bienvenue dans le nouveau launcher', date: '2026-10-31', image: 'icone', categorie: 'Launcher',
      texte: 'Actualités, notes de version, installation et Mod Tools réunis dans une seule application. Maquette en cours d’étude.' },
  ],
};
