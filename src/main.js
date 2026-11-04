import * as THREE from 'three';
import { InputManager } from './core/Input.js';
import { CameraManager, CameraMode } from './core/CameraManager.js';
import { AudioManager } from './core/AudioManager.js';
import { Environment, TimeOfDay } from './world/Environment.js';
import { Terrain } from './world/Terrain.js';
import { Runway } from './world/Runway.js';
import { City } from './world/City.js';
import { Airplane } from './entities/Airplane.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { UIController } from './ui/UIController.js';

class FlightSimulatorApp {
  constructor() {
    this.canvas3d = document.getElementById('canvas-3d');
    this.canvasHud = document.getElementById('canvas-hud');
    this.canvasMinimap = document.getElementById('canvas-minimap');

    // 1. Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 40000);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas3d,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // 2. Core Subsystems
    this.input = new InputManager(this.canvas3d);
    this.cameraManager = new CameraManager(this.camera, this.canvas3d);
    this.audio = new AudioManager();

    // 3. World Entities
    this.environment = new Environment(this.scene);
    this.terrain = new Terrain(this.scene);
    this.runway = new Runway(this.scene);
    this.city = new City(this.scene);
    this.airplane = new Airplane(this.scene);

    // 4. UI & Displays
    this.hud = new HUD(this.canvasHud);
    this.minimap = new Minimap(this.canvasMinimap);
    this.ui = new UIController(this);

    // 5. Clock & Loop
    this.clock = new THREE.Clock();
    this.prevTime = performance.now();

    // Spawn on runway by default
    this.spawn('runway');

    this._setupWindowEvents();
    this._startLoop();

    // Audio init on first user interaction
    const initAudioOnce = () => {
      this.audio.init();
      window.removeEventListener('click', initAudioOnce);
      window.removeEventListener('keydown', initAudioOnce);
    };
    window.addEventListener('click', initAudioOnce);
    window.addEventListener('keydown', initAudioOnce);
  }

  spawn(preset) {
    this.airplane.physics.reset(preset);
    this.cameraManager.setMode(CameraMode.CHASE);
    this.ui.updateCameraPills();
    this.input.resetMouseAccumulator();
  }

  _setupWindowEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(w, h);
      this.hud.resize();
    });
  }

  _startLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      const dt = Math.min(this.clock.getDelta(), 0.08);

      // Handle keyboard camera toggle (Key C)
      if (this.input.wasPressed('KeyC')) {
        this.cameraManager.nextMode();
        this.ui.updateCameraPills();
      }

      // Handle quick respawn key (Key R)
      if (this.input.wasPressed('KeyR')) {
        this.spawn('runway');
        const crashModal = document.getElementById('modal-crash');
        if (crashModal) crashModal.classList.add('hidden');
      }

      // Update input axes
      this.input.update(dt);

      // Check collision with city skyscrapers
      if (!this.airplane.physics.isCrashed) {
        if (this.city.checkCollision(this.airplane.physics.position)) {
          this.airplane.physics.crash('Mid-air collision with skyscraper!');
          this.audio.playCrashSound();
          this.ui.showCrash('Mid-air collision with skyscraper!', this.airplane);
        }
      }

      // Update airplane entity and aerodynamics
      const terrainHeightFunc = (x, z) => this.terrain.getElevation(x, z);
      this.airplane.update(dt, this.input, terrainHeightFunc);

      // Check crash from physics (e.g. hard landing or ground strike)
      if (this.airplane.physics.isCrashed && document.getElementById('modal-crash').classList.contains('hidden')) {
        this.audio.playCrashSound();
        this.ui.showCrash(this.airplane.physics.crashReason, this.airplane);
      }

      // Update camera
      this.cameraManager.update(dt, this.airplane, this.input);

      // Update environment lighting and cloud drifting
      this.environment.update(dt, this.airplane.physics.position);

      // Update runway lights & PAPI glideslope calculation
      this.runway.update(dt, this.airplane.physics.position);

      // Update city traffic & obstacle beacons
      this.city.update(dt);

      // Update sound modulation
      this.audio.update(dt, this.airplane);

      // Update primary flight dashboard UI & guidance
      this.ui.update(this.airplane);

      // Render 3D scene
      this.renderer.render(this.scene, this.camera);

      // Render 2D Heads-Up Display
      this.hud.render(this.airplane, this.runway, this.camera);

      // Render tactical radar minimap
      this.minimap.render(this.airplane, this.runway, this.city);
    };

    requestAnimationFrame(animate);
  }
}

// Start Simulator
window.addEventListener('DOMContentLoaded', () => {
  new FlightSimulatorApp();
});
