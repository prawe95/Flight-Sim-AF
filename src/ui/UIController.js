import { CameraMode } from '../core/CameraManager.js';
import { TimeOfDay } from '../world/Environment.js';

/**
 * UIController
 * Manages modern glassmorphic UI overlay, primary flight instrument cluster,
 * interactive throttle slider, camera switching, presets, and dialogs.
 */
export class UIController {
  constructor(app) {
    this.app = app;
    this.dom = {};

    this._bindDOM();
    this._setupEvents();
  }

  _bindDOM() {
    this.dom.camButtons = document.querySelectorAll('[data-cam]');
    this.dom.timeButtons = document.querySelectorAll('[data-time]');
    this.dom.soundBtn = document.getElementById('btn-sound');
    this.dom.assistBtn = document.getElementById('btn-assist');
    this.dom.helpBtn = document.getElementById('btn-help');
    this.dom.invertBtn = document.getElementById('btn-invert');
    this.dom.modalHelp = document.getElementById('modal-help');
    this.dom.modalCrash = document.getElementById('modal-crash');
    this.dom.crashReason = document.getElementById('crash-reason');
    this.dom.crashStats = document.getElementById('crash-stats');
    this.dom.btnRespawn = document.getElementById('btn-respawn');
    this.dom.closeHelp = document.getElementById('close-help');

    // Quick spawn presets
    this.dom.presetRunway = document.getElementById('preset-runway');
    this.dom.presetCruise = document.getElementById('preset-cruise');
    this.dom.presetApproach = document.getElementById('preset-approach');

    // On-screen touch buttons
    this.dom.btnThrottleUp = document.getElementById('touch-throt-up');
    this.dom.btnThrottleDown = document.getElementById('touch-throt-down');
    this.dom.btnPitchUp = document.getElementById('touch-pitch-up');
    this.dom.btnPitchDown = document.getElementById('touch-pitch-down');
    this.dom.btnRollLeft = document.getElementById('touch-roll-left');
    this.dom.btnRollRight = document.getElementById('touch-roll-right');
    this.dom.btnYawLeft = document.getElementById('touch-yaw-left');
    this.dom.btnYawRight = document.getElementById('touch-yaw-right');
    this.dom.btnGear = document.getElementById('touch-gear');
    this.dom.btnBrakes = document.getElementById('touch-brakes');

    // Primary Flight Instruments Cluster
    this.dom.dashSpeedKts = document.getElementById('dash-speed-kts');
    this.dom.dashSpeedKmh = document.getElementById('dash-speed-kmh');
    this.dom.dashSpeedBadge = document.getElementById('dash-speed-badge');
    this.dom.speedBarFill = document.getElementById('speed-bar-fill');
    this.dom.dashAltFt = document.getElementById('dash-alt-ft');
    this.dom.dashAltM = document.getElementById('dash-alt-m');
    this.dom.dashVsi = document.getElementById('dash-vsi');
    this.dom.dashGearBadge = document.getElementById('dash-gear-badge');
    this.dom.dashFlapsBadge = document.getElementById('dash-flaps-badge');
    this.dom.dashThrottlePercent = document.getElementById('dash-throttle-percent');
    this.dom.throttleBarFill = document.getElementById('throttle-bar-fill');
    this.dom.throttleBarTrack = document.getElementById('throttle-bar-track');
    this.dom.throtPresetBtns = document.querySelectorAll('.btn-throt-preset');
    this.dom.guideText = document.getElementById('guide-text');
  }

  _setupEvents() {
    // Camera buttons
    this.dom.camButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.cam;
        this.app.cameraManager.setMode(mode);
        this.updateCameraPills();
      });
    });

    // Time of day buttons
    this.dom.timeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const time = btn.dataset.time;
        this.app.environment.setTimeOfDay(time);
        this.dom.timeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Audio toggle
    if (this.dom.soundBtn) {
      this.dom.soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.audio.init();
        const isMuted = this.app.audio.toggleMute();
        this.dom.soundBtn.textContent = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
        this.dom.soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // Flight assist toggle
    if (this.dom.assistBtn) {
      this.dom.assistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.input.flightAssist = !this.app.input.flightAssist;
        this.dom.assistBtn.textContent = this.app.input.flightAssist ? '⚡ FBW: ON' : '⚡ FBW: OFF';
        this.dom.assistBtn.classList.toggle('active', this.app.input.flightAssist);
      });
    }

    // Invert pitch toggle
    if (this.dom.invertBtn) {
      this.dom.invertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.input.invertPitch = !this.app.input.invertPitch;
        this.dom.invertBtn.textContent = this.app.input.invertPitch ? 'Invert Pitch: ON (W Up / S Down)' : 'Invert Pitch: OFF (W Down / S Up)';
      });
    }

    // Help modal toggle
    if (this.dom.helpBtn && this.dom.modalHelp) {
      this.dom.helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.modalHelp.classList.toggle('hidden');
      });
    }

    if (this.dom.closeHelp && this.dom.modalHelp) {
      this.dom.closeHelp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.modalHelp.classList.add('hidden');
      });
    }

    // Quick presets
    if (this.dom.presetRunway) {
      this.dom.presetRunway.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.spawn('runway');
      });
    }
    if (this.dom.presetCruise) {
      this.dom.presetCruise.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.spawn('cruise');
      });
    }
    if (this.dom.presetApproach) {
      this.dom.presetApproach.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.spawn('approach');
      });
    }

    // Respawn button
    if (this.dom.btnRespawn) {
      this.dom.btnRespawn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.modalCrash.classList.add('hidden');
        this.app.spawn('runway');
      });
    }

    // Instant Throttle Preset Buttons ([0% IDLE], [50%], [100% TAKEOFF], [BOOST])
    this.dom.throtPresetBtns.forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const throt = parseFloat(btn.dataset.throt);
        this.app.airplane.physics.setThrottle(throt);
      });
    });

    // Interactive Click/Drag on Throttle Slider Track
    if (this.dom.throttleBarTrack) {
      const handleTrackClick = (e) => {
        const rect = this.dom.throttleBarTrack.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetThrot = fraction > 0.88 ? 1.15 : fraction;
        this.app.airplane.physics.setThrottle(targetThrot);
      };
      this.dom.throttleBarTrack.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        handleTrackClick(e);
      });
    }

    // Touch / On-screen Throttle button clicks
    if (this.dom.btnThrottleUp) {
      this.dom.btnThrottleUp.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.app.airplane.physics.stepThrottle(0.25);
      });
    }
    if (this.dom.btnThrottleDown) {
      this.dom.btnThrottleDown.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.app.airplane.physics.stepThrottle(-0.25);
      });
    }

    // Key pointer bindings for flight stick & pedals
    const bindTouchKey = (element, keyName) => {
      if (!element) return;
      const start = (e) => {
        e.stopPropagation();
        this.app.input.keys[keyName] = true;
      };
      const end = (e) => {
        e.stopPropagation();
        this.app.input.keys[keyName] = false;
      };
      element.addEventListener('pointerdown', start);
      element.addEventListener('pointerup', end);
      element.addEventListener('pointerleave', end);
      element.addEventListener('pointercancel', end);
    };

    bindTouchKey(this.dom.btnPitchDown, 'KeyW');
    bindTouchKey(this.dom.btnPitchUp, 'KeyS');
    bindTouchKey(this.dom.btnRollLeft, 'KeyA');
    bindTouchKey(this.dom.btnRollRight, 'KeyD');
    bindTouchKey(this.dom.btnYawLeft, 'KeyQ');
    bindTouchKey(this.dom.btnYawRight, 'KeyE');
    bindTouchKey(this.dom.btnBrakes, 'KeyB');

    if (this.dom.btnGear) {
      this.dom.btnGear.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.app.input.keyPressEvents['KeyG'] = true;
      });
    }
  }

  updateCameraPills() {
    const currentMode = this.app.cameraManager.mode;
    this.dom.camButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cam === currentMode);
    });
  }

  showCrash(reason, airplane) {
    if (this.dom.modalCrash) {
      this.dom.crashReason.textContent = reason || 'Aircraft destroyed';
      this.dom.crashStats.textContent = `Airspeed: ${airplane.physics.airspeedKnots.toFixed(0)} kts | Max G: ${airplane.physics.maxG.toFixed(1)}G | Alt: ${airplane.physics.altitudeFeet.toFixed(0)} ft`;
      this.dom.modalCrash.classList.remove('hidden');
    }
  }

  /**
   * Update primary flight instruments and guidance every frame
   */
  update(airplane) {
    const phys = airplane.physics;
    const kts = phys.airspeedKnots;
    const kmh = (kts * 1.852).toFixed(0);
    const altFt = phys.altitudeFeet;
    const altM = phys.altitude.toFixed(0);
    const vsi = phys.verticalSpeedFPM;
    const throttle = phys.throttle;

    // 1. Airspeed Readouts
    if (this.dom.dashSpeedKts) {
      this.dom.dashSpeedKts.textContent = kts.toFixed(0);
    }
    if (this.dom.dashSpeedKmh) {
      this.dom.dashSpeedKmh.textContent = `${kmh} km/h`;
    }

    // Speed status badge & bar
    if (this.dom.dashSpeedBadge) {
      if (phys.isGrounded) {
        if (kts < 3) {
          this.dom.dashSpeedBadge.textContent = 'PARKED';
          this.dom.dashSpeedBadge.className = 'speed-badge badge-idle';
        } else if (kts < 105) {
          this.dom.dashSpeedBadge.textContent = 'TAXI / ROLL';
          this.dom.dashSpeedBadge.className = 'speed-badge badge-idle';
        } else {
          this.dom.dashSpeedBadge.textContent = 'ROTATE NOW (S)';
          this.dom.dashSpeedBadge.className = 'speed-badge badge-takeoff';
        }
      } else {
        if (phys.mach >= 1.0) {
          this.dom.dashSpeedBadge.textContent = `SUPERSONIC (M${phys.mach.toFixed(2)})`;
          this.dom.dashSpeedBadge.className = 'speed-badge badge-takeoff';
        } else {
          this.dom.dashSpeedBadge.textContent = 'AIRBORNE';
          this.dom.dashSpeedBadge.className = 'speed-badge badge-airborne';
        }
      }
    }

    if (this.dom.speedBarFill) {
      const pct = Math.min(100, (kts / 320) * 100);
      this.dom.speedBarFill.style.width = `${pct}%`;
    }

    // 2. Altitude Readouts
    if (this.dom.dashAltFt) {
      this.dom.dashAltFt.textContent = altFt.toFixed(0);
    }
    if (this.dom.dashAltM) {
      this.dom.dashAltM.textContent = `${altM} m AGL`;
    }
    if (this.dom.dashVsi) {
      const sign = vsi >= 0 ? '+' : '';
      this.dom.dashVsi.textContent = `${sign}${vsi.toFixed(0)} fpm`;
    }

    // Gear & Flaps
    if (this.dom.dashGearBadge) {
      const gearText = phys.gear > 0.8 ? 'GEAR: DOWN' : (phys.gear < 0.2 ? 'GEAR: UP' : 'GEAR: TRANSIT');
      this.dom.dashGearBadge.textContent = gearText;
    }
    if (this.dom.dashFlapsBadge) {
      const flapsText = phys.flaps === 0 ? 'FLAPS: 0°' : (phys.flaps === 1 ? 'FLAPS: 15°' : 'FLAPS: 30°');
      this.dom.dashFlapsBadge.textContent = flapsText;
    }

    // 3. Throttle
    if (this.dom.dashThrottlePercent) {
      const throtPct = Math.min(100, Math.floor(throttle * 100));
      const boostText = throttle > 1.0 ? ' 🔥 BOOST' : '';
      this.dom.dashThrottlePercent.textContent = `${throtPct}%${boostText}`;
    }
    if (this.dom.throttleBarFill) {
      const fillPct = Math.min(100, (throttle / 1.15) * 100);
      this.dom.throttleBarFill.style.width = `${fillPct}%`;
    }

    // 4. Flight Guidance Text
    if (this.dom.guideText) {
      if (phys.isGrounded) {
        if (throttle < 0.15) {
          this.dom.guideText.innerHTML = 'Advance Throttle to <strong>100%</strong> (Click <strong>[100% TAKEOFF]</strong> or hold <strong>[Shift]</strong>).';
        } else if (kts < 105) {
          this.dom.guideText.innerHTML = `Accelerating down runway (<strong>${kts.toFixed(0)} KTS</strong>)... Steer with <strong>[Q / E]</strong>. Rotate at 110 KTS!`;
        } else {
          this.dom.guideText.innerHTML = '🚀 <strong>110 KTS REACHED!</strong> Pull back on stick <strong>[S]</strong> now to rotate and lift off!';
        }
      } else {
        if (phys.isStalling) {
          this.dom.guideText.innerHTML = '⚠️ <strong>STALL WARNING:</strong> Push nose down with <strong>[W]</strong> and advance throttle!';
        } else if (phys.gear > 0.5 && altFt > 80) {
          this.dom.guideText.innerHTML = '✈️ <strong>AIRBORNE:</strong> Press <strong>[G]</strong> to retract landing gear and reduce drag.';
        } else {
          this.dom.guideText.innerHTML = '✈️ <strong>FLYING:</strong> [W/S] Pitch &bull; [A/D] Roll &bull; [Q/E] Yaw &bull; [C] Change Camera View.';
        }
      }
    }
  }
}
