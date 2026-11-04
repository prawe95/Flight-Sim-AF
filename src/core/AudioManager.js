import * as THREE from 'three';

/**
 * Procedural Web Audio API Sound Synthesizer for Flight Simulator
 * Zero external audio assets required.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Audio nodes
    this.masterGain = null;

    // Engine sound nodes
    this.engineGain = null;
    this.engineRumbleOsc = null;
    this.engineWhineOsc1 = null;
    this.engineWhineOsc2 = null;
    this.engineNoiseNode = null;
    this.engineNoiseFilter = null;

    // Wind sound nodes
    this.windGain = null;
    this.windFilter = null;
    this.windNoiseNode = null;

    // Stall alarm
    this.stallOsc = null;
    this.stallGain = null;
    this.stallBeepTimer = 0;

    // Previous landing state
    this.wasGrounded = true;
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this._setupEngine();
      this._setupWind();
      this._setupStallAlarm();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio could not initialize:', e);
    }
  }

  _setupEngine() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineGain.connect(this.masterGain);

    // Deep jet engine rumble
    this.engineRumbleOsc = this.ctx.createOscillator();
    this.engineRumbleOsc.type = 'sawtooth';
    this.engineRumbleOsc.frequency.value = 55; // Hz

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 140;

    this.engineRumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(this.engineGain);
    this.engineRumbleOsc.start();

    // High turbine whine 1
    this.engineWhineOsc1 = this.ctx.createOscillator();
    this.engineWhineOsc1.type = 'sine';
    this.engineWhineOsc1.frequency.value = 600;

    const whineGain1 = this.ctx.createGain();
    whineGain1.gain.value = 0.15;
    this.engineWhineOsc1.connect(whineGain1);
    whineGain1.connect(this.engineGain);
    this.engineWhineOsc1.start();

    // High turbine whine 2
    this.engineWhineOsc2 = this.ctx.createOscillator();
    this.engineWhineOsc2.type = 'triangle';
    this.engineWhineOsc2.frequency.value = 1200;

    const whineGain2 = this.ctx.createGain();
    whineGain2.gain.value = 0.08;
    this.engineWhineOsc2.connect(whineGain2);
    whineGain2.connect(this.engineGain);
    this.engineWhineOsc2.start();

    // Jet exhaust pinkish noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
    }

    this.engineNoiseNode = this.ctx.createBufferSource();
    this.engineNoiseNode.buffer = noiseBuffer;
    this.engineNoiseNode.loop = true;

    this.engineNoiseFilter = this.ctx.createBiquadFilter();
    this.engineNoiseFilter.type = 'bandpass';
    this.engineNoiseFilter.frequency.value = 400;
    this.engineNoiseFilter.Q.value = 1.0;

    this.engineNoiseNode.connect(this.engineNoiseFilter);
    this.engineNoiseFilter.connect(this.engineGain);
    this.engineNoiseNode.start();
  }

  _setupWind() {
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windGain.connect(this.masterGain);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windNoiseNode = this.ctx.createBufferSource();
    this.windNoiseNode.buffer = noiseBuffer;
    this.windNoiseNode.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 800;

    this.windNoiseNode.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windNoiseNode.start();
  }

  _setupStallAlarm() {
    this.stallGain = this.ctx.createGain();
    this.stallGain.gain.value = 0.0;
    this.stallGain.connect(this.masterGain);

    this.stallOsc = this.ctx.createOscillator();
    this.stallOsc.type = 'square';
    this.stallOsc.frequency.value = 750; // Hz
    this.stallOsc.connect(this.stallGain);
    this.stallOsc.start();
  }

  playTouchdownScreech() {
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);
    } catch (e) {}
  }

  playCrashSound() {
    if (!this.ctx || this.isMuted) return;

    try {
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 1.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start();
    } catch (e) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.5;
    }
    return this.isMuted;
  }

  update(dt, airplane) {
    if (!this.isInitialized) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const physics = airplane.physics;
    const throttle = physics.throttle;
    const airspeed = physics.airspeed;
    const isStalling = physics.isStalling;

    // Detect touchdown for tire screech
    if (physics.isGrounded && !this.wasGrounded && airspeed > 35) {
      this.playTouchdownScreech();
    }
    this.wasGrounded = physics.isGrounded;

    const time = this.ctx.currentTime;

    // Modulate engine sounds based on throttle
    if (this.engineGain) {
      const targetGain = 0.12 + (throttle * 0.28);
      this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : targetGain, time, 0.08);

      // Rumble pitch (45 to 80 Hz)
      const rumbleFreq = 48 + throttle * 40;
      this.engineRumbleOsc.frequency.setTargetAtTime(rumbleFreq, time, 0.08);

      // Turbine whine pitch (500 to 2200 Hz)
      const whine1Freq = 500 + throttle * 1500;
      const whine2Freq = 1000 + throttle * 2800;
      this.engineWhineOsc1.frequency.setTargetAtTime(whine1Freq, time, 0.08);
      this.engineWhineOsc2.frequency.setTargetAtTime(whine2Freq, time, 0.08);

      // Noise filter
      const noiseFreq = 300 + throttle * 700;
      this.engineNoiseFilter.frequency.setTargetAtTime(noiseFreq, time, 0.08);
    }

    // Modulate wind sound based on airspeed
    if (this.windGain) {
      const windFactor = THREE.MathUtils.clamp(airspeed / 180.0, 0, 1.5);
      const targetWindGain = Math.pow(windFactor, 1.8) * 0.35;
      this.windGain.gain.setTargetAtTime(this.isMuted ? 0 : targetWindGain, time, 0.1);

      const targetWindFilter = 300 + windFactor * 2500;
      this.windFilter.frequency.setTargetAtTime(targetWindFilter, time, 0.1);
    }

    // Stall alarm beeping
    if (this.stallGain) {
      if (isStalling && !this.isMuted) {
        this.stallBeepTimer += dt;
        // Beep at 3Hz
        const beepOn = (Math.floor(this.stallBeepTimer * 6) % 2) === 0;
        this.stallGain.gain.setValueAtTime(beepOn ? 0.35 : 0.0, time);
      } else {
        this.stallGain.gain.setValueAtTime(0.0, time);
        this.stallBeepTimer = 0;
      }
    }
  }
}
