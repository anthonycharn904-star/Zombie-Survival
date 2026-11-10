
/* ------------------------------------------------- Éléments de la carte --
   Comme ceux que posent les Mod Tools (owBuildElements) : hauteurs prises sur les sols des lieux
   (y nul). Disposition : départ au bourg (armes faibles, Quick Revive à la chapelle, la boîte sur la
   place) ; ce qui vaut le voyage est ailleurs (Mastodonte et Rechargement rapide à la station, qui
   a le courant ; Staminup à la scierie ; Double coup sur l'Enlisée ; Le Glas sur l'îlot des
   pierres, le plus loin). Onze barques aux pontons (l'Enlisée est le carrefour : trois pontons), jerricans au bourg et à la station. */
Object.assign(MARAIS, {
  wallbuys: [
    { w: 'kar98k', x: 466, y: null, z: 706.5, nx: 1, nz: 0, h: 1.55 },
    { w: 'mp40', x: 571, y: null, z: 699.5, nx: -1, nz: 0, h: 1.55 },
    { w: 'trench', x: 258, y: null, z: 553.6, nx: 1, nz: 0, h: 1.55 },
    { w: 'stg44', x: 273, y: null, z: 573, nx: 0, nz: 1, h: 1.6 },
    { w: 'thompson', x: 741, y: null, z: 487.2, nx: -1, nz: 0, h: 1.55 },
    { w: 'bar', x: 758, y: null, z: 509.6, nx: -1, nz: 0, h: 1.55 },
    { w: 'dbarrel', x: 457.4, y: null, z: 451, nx: 0, nz: 1, h: 1.5 },
    { w: 'ppsh', x: 459, y: null, z: 452.6, nx: 1, nz: 0, h: 1.5 },
    { w: 'mg42', x: 768, y: null, z: 509.6, nx: -1, nz: 0, h: 1.55 },
  ],
  perks: [
    { p: 'souffle', x: 536, y: null, z: 688.5, face: [-1, 0], roomH: 4.4 },
    { p: 'cuirasse', x: 754, y: null, z: 487.2, face: [-1, 0], roomH: 4.2 },
    { p: 'mainleste', x: 754, y: null, z: 491.6, face: [-1, 0], roomH: 4.2 },
    { p: 'endurance', x: 281, y: null, z: 573, face: [0, 1], roomH: 3.6 },
    { p: 'detente', x: 458, y: null, z: 453.4, face: [-1, 0], roomH: 6 },
  ],
  boxes: [
    { x: 520.5, y: null, z: 704.5, face: [0, -1] },
    { x: 272.6, y: null, z: 579.4, face: [1, 0] },
    { x: 484.5, y: null, z: 486.5, face: [0, 1] },
    { x: 766, y: null, z: 509.4, face: [0, -1] },
  ],
  boxStart: 0,
  vehicles: [
    { type: 'barque', x: 521.6, z: 782.8, yaw: -3.142 },
    { type: 'barque', x: 512.4, z: 782.8, yaw: -3.142 },
    { type: 'barque', x: 495.4, z: 615.2, yaw: 0 },
    { type: 'barque', x: 339.8, z: 557.4, yaw: -1.571 },
    { type: 'barque', x: 730.4, z: 430.2, yaw: 0 },
    { type: 'barque', x: 474.6, z: 512.8, yaw: -3.142 },
    { type: 'barque', x: 570.6, z: 276.8, yaw: -3.142 },
    { type: 'barque', x: 612.8, z: 671.4, yaw: -1.571 },
    { type: 'barque', x: 648.2, z: 502.6, yaw: 1.571 },
    { type: 'barque', x: 469.4, z: 382.2, yaw: 0 },
    { type: 'barque', x: 555.8, z: 447.4, yaw: -1.571 },
  ],
  fuel: [
    { x: 517, y: null, z: 779.5 },
    { x: 735, y: null, z: 434.5 },
  ],
  breakers: [
    { x: 726.5, y: null, z: 504, nx: 0, nz: 1, name: 'abri du groupe électrogène, mur nord' },
    { x: 729.5, y: null, z: 504, nx: 0, nz: 1, name: 'abri du groupe électrogène, mur nord' },
    { x: 744, y: null, z: 484, nx: 0, nz: -1, name: 'station de pompage, façade nord' },
  ],
  glas: { x: 566, y: null, z: 227, face: [0, 1] },
});
/* Éléments propres au marais (appelés par owBuildFeatures) : Le Glas au milieu des pierres. */
function maBuildFeatures(group, map) {
  Features.amp = null;
  if (map.glas) luGlas(group, { ...map.glas, y: owElemY(map.glas) });
}
