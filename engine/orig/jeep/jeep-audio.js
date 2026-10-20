/*
 * jeep-audio.js — son en temps réel d'une jeep 4x4 des années 1940 (Web Audio, sans fichier son).
 *
 * Synthèse physique d'après le moteur d'origine : 4 cylindres en ligne de 2,2 L à soupapes
 * latérales (« Go Devil »), ordre d'allumage 1-3-4-2, ralenti 600 tr/min, 60 ch à 4 000 tr/min,
 * démarreur 6 V. Chaque explosion produit une impulsion dans l'échappement (durée liée à l'angle
 * de vilebrequin), filtrée par les résonances du tuyau et du silencieux. S'y ajoutent l'admission,
 * les poussoirs mécaniques, le démarreur, le sifflement de boîte (1re et marche arrière à denture
 * droite), les pneus sur le sable, les cliquetis de carrosserie, le klaxon et les retours de flamme.
 *
 * Utilisation avec Three.js (son 3D qui suit la jeep) :
 *   const listener = new THREE.AudioListener(); camera.add(listener);
 *   const sound = await createJeepAudio(listener.context);   // après un clic du joueur
 *   const pos = new THREE.PositionalAudio(listener);
 *   pos.setNodeSource(sound.output); pos.setRefDistance(4);
 *   jeep.object.add(pos);
 *   // à chaque image :
 *   sound.update(driveState);      // l'objet renvoyé par drive.update(...) (jeep-archeo.js)
 *   sound.horn(true|false);        // klaxon
 *   sound.clunk(1);                // choc (collision, réception de saut), 0..2
 *   sound.setSurface(0.4);         // 1 = sable, 0.4 = roche lisse, 1.5 = gravier
 *   sound.setMix({ rattles: 0.5 }); // dosage des couches (voir setMix plus bas)
 *
 * Sans Three.js : sound.output.connect(audioContext.destination).
 * Sans le modèle de conduite : sound.update({ engine: 'running', rpm: 1800, throttle: 0.5, speed: 8, gear: 2 }).
 *   engine : 'off' | 'cranking' (démarreur) | 'running'
 *   rpm    : tours/min du moteur        throttle : 0..1 (charge)
 *   speed  : m/s (signe = sens)         gear     : -1 (arrière), 1, 2, 3
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------------------------
  // Cœur DSP. Cette fonction est sérialisée (toString) pour tourner dans l'AudioWorklet : elle ne
  // doit dépendre d'aucune variable extérieure.
  // ---------------------------------------------------------------------------------------------
  function JeepDSPFactory() {
    'use strict';
    const TAU = 2 * Math.PI;
    const PI = Math.PI;
    const DN = 1e-18; // évite les nombres dénormalisés dans les filtres

    class Biquad {
      constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
      set(type, f, q, sr) {
        const w = TAU * Math.min(Math.max(f, 5), sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
        let b0, b1, b2;
        if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
        else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
        else { b0 = al; b1 = 0; b2 = -al; } // passe-bande, gain 0 dB au centre
        const a0 = 1 + al;
        this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
        return this;
      }
      run(x) {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
        return y;
      }
    }

    const ORDER_GAIN = [1.0, 0.91, 1.07, 0.95];      // déséquilibre réaliste entre cylindres (1, 3, 4, 2)
    const ORDER_OFF = [0, 0.035, -0.025, 0.045];     // petits écarts de calage (rad de vilebrequin)
    const NP = 10;                                   // impulsions simultanées max

    // correction polyBLEP d'un front (réduit le repliement du klaxon)
    function blep(t, dt) {
      if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
      if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
      return 0;
    }
    // gain qui ramène la crête d'un résonateur passe-bande excité par une impulsion à ~1
    function ringGain(f, q, sr) { return 2 * q / Math.sin(TAU * Math.min(f, sr * 0.45) / sr); }

    class JeepDSP {
      constructor(sr, seed) {
        this.sr = sr;
        this.seed = (seed >>> 0) || 0x2545f491;
        // consignes reçues du jeu
        this.rpmT = 0; this.loadT = 0; this.speedT = 0; this.gear = 1; this.engine = 'off'; this.shifting = false;
        this.hornOn = false; this.master = 1; this.surface = 1;
        // valeurs lissées
        this.rpm = 0; this.load = 0; this.spd = 0; this.wander = 0;
        this.kRpm = 1 - Math.exp(-1 / (sr * 0.035));
        this.kLoad = 1 - Math.exp(-1 / (sr * 0.05));
        this.kSpd = 1 - Math.exp(-1 / (sr * 0.12));
        this.kWander = 1 - Math.exp(-1 / (sr * 0.22));
        this.gWander = 1 / (0.577 * Math.sqrt(this.kWander / (2 - this.kWander))); // écart-type ramené à 1
        // gains par couche (réglables depuis le jeu avec setMix)
        this.mix = { exhaust: 1, intake: 1, mechanical: 1, starter: 1, gearbox: 1, tires: 1, rattles: 1, horn: 1, clunks: 1 };
        // vilebrequin
        this.theta = 0; this.nextFire = 0.4; this.fireIdx = 0; this.nextTick = 0.1;
        // état moteur
        this.comb = false; this.starter = 0; this.starterOn = false; this.zing = 0;
        this.catchT = 0; this.catchBoost = 0; this.wasTurning = false; this.lastLoadHigh = 0; this.prevLoad = 0;
        // impulsions d'échappement
        this.pA = new Float64Array(NP); this.pR = new Float64Array(NP); this.pD = new Float64Array(NP);
        this.pKr = new Float64Array(NP); this.pKd = new Float64Array(NP);
        // excitations ponctuelles
        this.tickIn = 0; this.knockEnv = 0; this.kKnock = Math.exp(-1 / (sr * 0.0022));
        this.popEnv = 0; this.kPop = Math.exp(-1 / (sr * 0.012)); this.pops = [];
        this.thumpEnv = 0; this.thumpPh = 0; this.thumpF = 70; this.kThump = Math.exp(-1 / (sr * 0.07)); this.clickIn = 0;
        this.rattleIn = [0, 0, 0, 0]; this.gritIn = 0;
        // phases d'oscillateurs
        this.phMesh = 0; this.phComm = 0; this.phWhine = 0; this.phXfer = 0; this.phGear = 0; this.phHorn = 0; this.hornT = 0;
        this.hornEnv = 0; this.hornF = 330; this.whineLvl = 0; this.whineTeeth = 23; this.xferLvl = 0;
        // niveaux dérivés (mis à jour tous les 32 échantillons)
        this.ctr = 0; this.mechLevel = 0; this.mechRoar = 0; this.intakeLevel = 0; this.idleWobble = 0;
        this.rattleRate = 0; this.gritRate = 0; this.rollLvl = 0; this.rumbleLvl = 0; this.r4Gain = 0.1;
        this.gEx = 0.62; this.gStarter = 0.5; this.windLvl = 0;
        // filtres
        const B = () => new Biquad();
        this.fLow = B().set('lp', 160, 0.7, sr);          // corps de l'impulsion (« pouf »)
        this.fMuff = B().set('lp', 900, 0.7, sr);         // silencieux
        this.fR0 = B().set('bp', 55, 1.2, sr);            // poitrine / caisse
        this.fR1 = B().set('bp', 95, 1.6, sr);            // tuyau d'échappement (1er mode)
        this.fR2 = B().set('bp', 235, 2.4, sr);           // 2e mode
        this.fR3 = B().set('bp', 480, 3.2, sr);           // chambre du silencieux
        this.fR4 = B().set('bp', 1150, 4.0, sr);          // claquement métallique
        this.fIntake = B().set('bp', 560, 1.1, sr);
        this.fIntakeLp = B().set('lp', 2200, 0.7, sr);
        this.fMech = B().set('bp', 1600, 0.8, sr);
        this.fTick1 = B().set('bp', 2900, 9, sr);
        this.fTick2 = B().set('bp', 4700, 11, sr);
        this.fKnock = B().set('bp', 3300, 1.0, sr);
        this.fBrush = B().set('bp', 3500, 1.5, sr);
        this.fRoll = B().set('lp', 650, 0.7, sr);
        this.fRollHp = B().set('hp', 120, 0.7, sr);
        this.fRumble = B().set('lp', 65, 0.8, sr);
        this.fWind = B().set('bp', 900, 0.5, sr);
        this.fGrit = B().set('bp', 2700, 2.0, sr);
        this.fRat = [B().set('bp', 1180, 38, sr), B().set('bp', 1640, 42, sr), B().set('bp', 2230, 40, sr), B().set('bp', 3050, 45, sr)];
        this.gRat = [ringGain(1180, 38, sr), ringGain(1640, 42, sr), ringGain(2230, 40, sr), ringGain(3050, 45, sr)];
        this.gTick1 = ringGain(2900, 9, sr); this.gTick2 = ringGain(4700, 11, sr);
        this.gGrit = ringGain(2700, 2, sr);
        this.fClick = B().set('bp', 1700, 6, sr); this.gClick = ringGain(1700, 6, sr);
        this.fPop = B().set('bp', 1800, 1.4, sr);
        this.fH1 = B().set('bp', 950, 2.0, sr);
        this.fH2 = B().set('bp', 2400, 3.5, sr);
        this.fHlp = B().set('lp', 4800, 0.7, sr);
        this.fDC = B().set('hp', 22, 0.7, sr);
        this.fOut = B().set('lp', 9000, 0.7, sr);
      }

      // --- hasard rapide et reproductible ---
      rand() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0; return this.seed / 4294967296; }
      noise() { return this.rand() * 2 - 1; }
      gauss() { return (this.rand() + this.rand() + this.rand() - 1.5) * 2; }

      message(m) {
        if (!m) return;
        if (m.t === 's') {
          if (typeof m.rpm === 'number') this.rpmT = Math.max(0, m.rpm);
          if (typeof m.load === 'number') this.loadT = Math.min(1, Math.max(0, m.load));
          if (typeof m.speed === 'number') this.speedT = m.speed;
          if (typeof m.gear === 'number' && m.gear !== this.gear) {
            if (this.comb && m.gear !== 0) this.clunk(0.7);
            this.gear = m.gear;
          }
          if (m.engine) this.setEngine(m.engine);
          this.shifting = !!m.shifting;
        } else if (m.t === 'horn') this.hornOn = !!m.on;
        else if (m.t === 'clunk') this.clunk(m.v || 1);
        else if (m.t === 'vol') this.master = m.v;
        else if (m.t === 'surface') this.surface = m.v;
        else if (m.t === 'mix' && m.v) { for (const k in m.v) if (k in this.mix) this.mix[k] = +m.v[k]; }
      }

      setEngine(e) {
        if (e === this.engine) return;
        const prev = this.engine;
        this.engine = e;
        if (e === 'cranking') { this.starterOn = true; this.comb = false; this.clunk(0.45); }
        else if (e === 'running') {
          this.starterOn = false; this.comb = true;
          if (prev === 'cranking') { this.catchT = 1.0; this.catchBoost = 3; this.zing = 1; }
        } else { this.starterOn = false; this.comb = false; if (prev === 'cranking') this.zing = 1; }
      }

      clunk(v) {
        this.thumpEnv = Math.max(this.thumpEnv, 0.32 * v); this.thumpF = 72; this.thumpPh = 0;
        this.clickIn += 0.5 * v;
      }

      addPulse(A, tr, td) {
        let k = 0, best = 1e9;
        for (let i = 0; i < NP; i++) { const e = this.pD[i]; if (e < best) { best = e; k = i; } }
        this.pA[k] = A; this.pR[k] = 1; this.pD[k] = 1;
        this.pKr[k] = Math.exp(-1 / (tr * this.sr)); this.pKd[k] = Math.exp(-1 / (td * this.sr));
      }

      fire() {
        const slot = this.fireIdx;
        const w = Math.max(this.rpm, 60) * TAU / 60;
        let td = Math.max(0.0008, 1.25 / w / 2.6);              // décroissance liée à ~70° de vilebrequin
        let A, tr;
        let p = 1;
        if (this.catchT > 0) p = 0.4 + 0.6 * (1 - this.catchT);  // le moteur « prend » en hésitant
        const idleish = 1 - this.load;
        if (this.comb && this.rand() < p && this.rand() > 0.012 * idleish) {
          A = (0.32 + 1.05 * Math.pow(this.load, 0.8)) * ORDER_GAIN[slot];
          A *= 1 + (0.05 + 0.16 * idleish) * this.gauss();           // variabilité de combustion
          if (this.rand() < 0.045 * idleish) A *= 0.45;               // explosion faible au ralenti
          if (this.catchBoost > 0) { A *= 1.55; this.catchBoost--; }  // premières explosions riches
          tr = 0.00025 + 0.00035 * idleish;
          this.knockEnv = Math.max(this.knockEnv, 0.55 * A);
        } else {
          A = 0.085 * ORDER_GAIN[slot] * (this.starter > 0.1 ? 1.4 : 1); tr = 0.0022; td *= 1.5; // compression seule
        }
        this.addPulse(A, tr, td);
        this.fireIdx = (slot + 1) & 3;
        this.nextFire += PI + ORDER_OFF[this.fireIdx] - ORDER_OFF[slot];
      }

      tick() {
        if (this.mechLevel > 0) this.tickIn += this.mechLevel * (0.5 + 0.5 * this.rand());
        this.nextTick += PI * 0.5 * (1 + 0.05 * (this.rand() - 0.5));
      }

      control(dtBlock) {
        const rpm = this.rpm, load = this.load, sr = this.sr;
        const turning = rpm > 30;
        this.fMuff.set('lp', 600 + 1900 * load + 0.12 * rpm, 0.7, sr);
        this.r4Gain = 0.06 + 0.16 * load;
        const r = Math.min(1, rpm / 4000);
        this.mechLevel = turning ? 0.09 + 0.14 * r : 0;
        this.mechRoar = turning ? 0.022 + 0.09 * Math.pow(r, 1.4) : 0;
        this.intakeLevel = this.comb ? 0.07 + 0.45 * load * load : (turning ? 0.02 : 0);
        this.idleWobble = this.comb ? 14 * Math.max(0, 1 - rpm / 1400) * (1 - load) : 0;
        // sifflement de boîte : 1re et marche arrière à denture droite
        let wl = 0, teeth = 23;
        if (this.gear === 1) { wl = 0.03; teeth = 23; } else if (this.gear === -1) { wl = 0.045; teeth = 27; } else if (this.gear === 2) { wl = 0.008; teeth = 19; }
        const moving = Math.abs(this.spd) > 0.3;
        this.whineLvl = (moving && !this.shifting) ? wl * (0.35 + 0.65 * load) * Math.min(1, rpm / 900) : 0;
        this.whineTeeth = teeth;
        const sp = Math.abs(this.spd);
        this.xferLvl = 0.011 * Math.min(1, sp / 6);
        const vib = (this.comb ? 0.5 * Math.max(0, 1 - rpm / 1800) + 0.12 : 0) + Math.min(1, sp / 12) * 0.8 + this.starter * 0.3;
        this.rattleRate = vib * 8;
        this.gritRate = sp * 5 * this.surface;
        this.rollLvl = 0.12 * Math.pow(Math.min(1, sp / 16), 1.2);
        this.rumbleLvl = 0.15 * Math.min(1, sp / 10);
        this.windLvl = 0.05 * Math.min(2.2, (sp / 25) * (sp / 25)); // véhicule ouvert : le vent monte vite
        // retours de flamme au lever de pied
        if (load > 0.5) this.lastLoadHigh = 0.35; else this.lastLoadHigh = Math.max(0, this.lastLoadHigh - dtBlock);
        if (this.comb && this.prevLoad >= 0.15 && load < 0.15 && this.lastLoadHigh > 0 && rpm > 2200) {
          const n = 1 + Math.floor(this.rand() * 3);
          for (let i = 0; i < n; i++) this.pops.push(Math.floor((0.08 + this.rand() * 0.55) * sr));
          this.lastLoadHigh = 0;
        }
        this.prevLoad = load;
        if (this.catchT > 0) this.catchT = Math.max(0, this.catchT - dtBlock);
        // dernier soubresaut à l'arrêt
        if (turning) this.wasTurning = true;
        if (this.wasTurning && !this.comb && !this.starterOn && rpm < 60) {
          this.wasTurning = false;
          this.thumpEnv = Math.max(this.thumpEnv, 0.28); this.thumpF = 34; this.thumpPh = 0;
          for (let i = 0; i < 4; i++) this.rattleIn[i] += 0.04 * this.rand();
        }
      }

      render(out) {
        const n = out.length, sr = this.sr, inv = 1 / sr, mx = this.mix;
        for (let i = 0; i < n; i++) {
          if ((this.ctr++ & 31) === 0) this.control(32 * inv);
          // lissage des consignes
          this.rpm += (this.rpmT - this.rpm) * this.kRpm;
          this.load += (this.loadT - this.load) * this.kLoad;
          this.spd += (this.speedT - this.spd) * this.kSpd;
          this.wander += (this.noise() - this.wander) * this.kWander;
          const wn = this.wander * this.gWander;                 // bruit lent, écart-type ~1
          // démarreur : attaque 30 ms, relâche 120 ms
          this.starter += ((this.starterOn ? 1 : 0) - this.starter) * (this.starterOn ? 0.0007 : 0.00018);
          let rpm = this.rpm;
          if (this.starter > 0.001 && !this.comb) rpm *= 1 + 0.32 * Math.sin(2 * this.theta + 0.7) * this.starter; // compressions qui freinent
          rpm += this.idleWobble * wn;                           // ralenti qui « galope » un peu
          if (rpm < 0) rpm = 0;
          this.theta += rpm * TAU / 60 * inv;
          while (this.theta >= this.nextFire) this.fire();
          while (this.theta >= this.nextTick) this.tick();
          if (this.theta > 1e6) { const d = 4e5 * PI; this.theta -= d; this.nextFire -= d; this.nextTick -= d; }

          // --- échappement : impulsions + résonances du tuyau et du silencieux ---
          let ex = 0;
          for (let k = 0; k < NP; k++) {
            if (this.pD[k] > 1e-5) {
              this.pR[k] *= this.pKr[k]; this.pD[k] *= this.pKd[k];
              ex += this.pA[k] * (1 - this.pR[k]) * this.pD[k];
            }
          }
          if (this.pops.length) {
            for (let k = this.pops.length - 1; k >= 0; k--) {
              if (--this.pops[k] <= 0) { this.pops.splice(k, 1); this.addPulse(2.3, 0.00008, 0.0012); this.popEnv = 1; }
            }
          }
          const exIn = ex + DN;
          let exh = 0.55 * this.fMuff.run(this.fLow.run(exIn) + 0.35 * exIn)
            + 0.8 * this.fR0.run(exIn) + 1.0 * this.fR1.run(exIn) + 0.55 * this.fR2.run(exIn)
            + 0.3 * this.fR3.run(exIn) + this.r4Gain * this.fR4.run(exIn);
          if (this.popEnv > 1e-4) { exh += this.fPop.run(this.noise() * this.popEnv) * 0.35; this.popEnv *= this.kPop; }
          let s = exh * this.gEx * mx.exhaust;

          // --- admission : 4 aspirations par cycle ---
          if (this.intakeLevel > 0) {
            const ph = ((this.theta + 0.9) % PI) / PI;
            const e = Math.sin(PI * ph), env = e * e * e * e;
            s += this.fIntakeLp.run(this.fIntake.run(this.noise())) * this.intakeLevel * (0.25 + env) * mx.intake;
          }
          // --- mécanique : rumeur, poussoirs, cognement de combustion ---
          let mech = 0;
          if (this.mechRoar > 0) mech += this.fMech.run(this.noise()) * this.mechRoar;
          const ti = this.tickIn; this.tickIn = 0;
          mech += 0.6 * this.fTick1.run(ti * this.gTick1 + DN) + 0.4 * this.fTick2.run(ti * this.gTick2 + DN);
          if (this.knockEnv > 1e-4) { mech += this.fKnock.run(this.noise() * this.knockEnv) * 0.09; this.knockEnv *= this.kKnock; }
          s += mech * mx.mechanical;
          // --- démarreur 6 V ---
          if (this.starter > 0.002 || this.zing > 0.002) {
            const zingMul = this.starterOn ? 1 : 1 + 0.8 * (1 - this.zing);
            const crankRps = Math.max(rpm, 40) / 60;
            this.phMesh += crankRps * 97 * zingMul * inv; this.phMesh -= Math.floor(this.phMesh);
            this.phComm += crankRps * 10.8 * 24 * zingMul * inv; this.phComm -= Math.floor(this.phComm);
            const a = TAU * this.phMesh;
            const buzz = Math.sin(a) + 0.33 * Math.sin(3 * a) + 0.2 * Math.sin(5 * a);
            const strain = 0.75 + 0.25 * Math.sin(2 * this.theta + 0.7 + PI);
            const lvl = this.starter * strain + (this.starterOn ? 0 : this.zing * 0.6);
            s += lvl * (0.11 * buzz + 0.07 * Math.sin(TAU * this.phComm) + 0.16 * this.fBrush.run(this.noise())) * this.gStarter * mx.starter;
            if (!this.starterOn) this.zing *= 0.99965;
          }
          // --- boîte (1re / arrière à denture droite) et boîte de transfert ---
          if (this.whineLvl > 0) {
            this.phWhine += rpm / 60 * this.whineTeeth * (1 + 0.004 * wn) * inv; this.phWhine -= Math.floor(this.phWhine);
            s += Math.sin(TAU * this.phWhine) * this.whineLvl * mx.gearbox;
          }
          if (this.xferLvl > 0) {
            this.phXfer += Math.abs(this.spd) / (TAU * 0.343) * 4.88 * 29 * inv; this.phXfer -= Math.floor(this.phXfer);
            s += Math.sin(TAU * this.phXfer) * this.xferLvl * mx.gearbox;
          }
          // --- pneus sur le sable, gravillons ---
          let tire = 0;
          if (this.rollLvl > 0) tire += this.fRollHp.run(this.fRoll.run(this.noise())) * this.rollLvl * this.surface;
          if (this.rumbleLvl > 0) tire += this.fRumble.run(this.noise()) * this.rumbleLvl;
          if (this.windLvl > 0) tire += this.fWind.run(this.noise()) * this.windLvl * (1 + 0.3 * wn);
          if (this.gritRate > 0 && this.rand() < this.gritRate * inv) this.gritIn += 0.4 + 0.6 * this.rand();
          const gi = this.gritIn; this.gritIn = 0;
          tire += this.fGrit.run(gi * this.gGrit + DN) * 0.03;
          s += tire * mx.tires;
          // --- cliquetis de carrosserie ---
          if (this.rattleRate > 0 && this.rand() < this.rattleRate * inv) this.rattleIn[(this.rand() * 4) | 0] += 0.4 + 0.6 * this.rand();
          let rat = 0;
          for (let k = 0; k < 4; k++) { const ri = this.rattleIn[k]; this.rattleIn[k] = 0; rat += this.fRat[k].run(ri * this.gRat[k] + DN); }
          s += rat * 0.035 * mx.rattles;
          // --- claquements : vitesse, pédale de démarreur, dernier soubresaut ---
          let cl = 0;
          if (this.thumpEnv > 1e-4) {
            this.thumpPh += this.thumpF * inv; if (this.thumpPh >= 1) this.thumpPh -= 1;
            cl += Math.sin(TAU * this.thumpPh) * this.thumpEnv; this.thumpEnv *= this.kThump;
          }
          const ci = this.clickIn; this.clickIn = 0; cl += this.fClick.run(ci * this.gClick + DN) * 0.12;
          s += cl * mx.clunks;
          // --- klaxon 6 V à vibreur ---
          this.hornEnv += ((this.hornOn ? 1 : 0) - this.hornEnv) * (this.hornOn ? 0.0035 : 0.0009);
          if (this.hornEnv > 1e-4) {
            this.hornF += ((this.hornOn ? 372 : 340) - this.hornF) * 0.0009;
            const dt = this.hornF * inv, duty = 0.2;
            this.phHorn += dt; if (this.phHorn >= 1) this.phHorn -= 1;
            let t2 = this.phHorn - duty; if (t2 < 0) t2 += 1;
            const pulse = (this.phHorn < duty ? 1 : -0.25) + 0.625 * blep(this.phHorn, dt) - 0.625 * blep(t2, dt);
            this.hornT += inv; if (this.hornT > 1000) this.hornT = 0;
            const rough = 1 + 0.12 * Math.sin(TAU * 41 * this.hornT);
            const h = this.fHlp.run(0.35 * pulse + this.fH1.run(pulse) + 0.6 * this.fH2.run(pulse));
            s += h * this.hornEnv * rough * 0.42 * mx.horn;
          } else { this.hornF = 330; }
          // --- sortie : coupe-continu, adoucissement, limiteur doux ---
          let y = this.fOut.run(this.fDC.run(s)) * this.master;
          y = Math.tanh(y * 1.15) / 1.15;
          out[i] = y;
        }
      }
    }
    return JeepDSP;
  }

  // ---------------------------------------------------------------------------------------------
  // AudioWorklet (temps réel) avec repli ScriptProcessor si le navigateur ou la page l'interdit.
  // ---------------------------------------------------------------------------------------------
  const PROCESSOR_SOURCE =
    'const JeepDSP = (' + JeepDSPFactory.toString() + ')();\n' +
    'class JeepEngineProcessor extends AudioWorkletProcessor {\n' +
    '  constructor(o) { super(); const p = (o && o.processorOptions) || {}; this.dsp = new JeepDSP(sampleRate, p.seed || 12345); this.port.onmessage = (e) => this.dsp.message(e.data); }\n' +
    '  process(inputs, outputs) { const o = outputs[0]; if (o && o[0]) { this.dsp.render(o[0]); for (let c = 1; c < o.length; c++) o[c].set(o[0]); } return true; }\n' +
    '}\n' +
    "registerProcessor('jeep-engine', JeepEngineProcessor);\n";

  // un seul chargement du module par AudioContext (plusieurs jeeps possibles)
  const modules = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function loadModule(ctx) {
    let p = modules && modules.get(ctx);
    if (!p) {
      const url = URL.createObjectURL(new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' }));
      p = ctx.audioWorklet.addModule(url);
      p.then(() => URL.revokeObjectURL(url), () => URL.revokeObjectURL(url));
      if (modules) modules.set(ctx, p);
    }
    return p;
  }
  let instances = 0;

  async function createJeepAudio(ctx, opts) {
    opts = opts || {};
    const seed = opts.seed || 12345 + 7919 * instances++; // chaque jeep a ses propres irrégularités
    const output = ctx.createGain();
    output.gain.value = opts.volume == null ? 0.9 : opts.volume;
    let node = null, post = null, mode = 'worklet';
    if (ctx.audioWorklet && !opts.forceScriptProcessor) {
      try {
        await loadModule(ctx);
        node = new AudioWorkletNode(ctx, 'jeep-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { seed: seed } });
        post = (m) => node.port.postMessage(m);
      } catch (err) { node = null; }
    }
    if (!node) { // repli : même DSP sur le fil principal
      mode = 'script';
      const JeepDSP = JeepDSPFactory();
      const dsp = new JeepDSP(ctx.sampleRate, seed);
      node = ctx.createScriptProcessor(1024, 1, 1);
      node.onaudioprocess = (e) => dsp.render(e.outputBuffer.getChannelData(0));
      post = (m) => dsp.message(m);
    }
    node.connect(output);
    return {
      output, node, mode,
      /** à appeler à chaque image avec l'état du véhicule */
      update(st) {
        if (!st) return;
        const msg = { t: 's', rpm: st.rpm, load: st.throttle, speed: st.speed, gear: st.gear, engine: st.engine, shifting: st.shifting };
        post(msg);
      },
      horn(on) { post({ t: 'horn', on: !!on }); },
      clunk(strength) { post({ t: 'clunk', v: strength || 1 }); },
      /** 1 = sable (défaut), 0.4 = roche lisse, 1.5 = gravier */
      setSurface(v) { post({ t: 'surface', v: v }); },
      setVolume(v) { output.gain.value = v; },
      /** dosage des couches, 0 à 2 (1 = défaut) : exhaust, intake, mechanical, starter, gearbox, tires, rattles, horn, clunks */
      setMix(m) { post({ t: 'mix', v: m }); },
      dispose() { try { node.disconnect(); output.disconnect(); } catch (e) { /* déjà déconnecté */ } }
    };
  }

  const api = { createJeepAudio: createJeepAudio, JeepDSPFactory: JeepDSPFactory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.createJeepAudio = createJeepAudio; root.JeepAudio = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
