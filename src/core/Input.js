/**
 * Input Manager for Flight Simulator
 * Handles keyboard, mouse, and touch inputs.
 * Standard controls:
 * - W / S: Pitch down / Pitch up (Elevator)
 * - A / D: Roll left / Roll right (Ailerons)
 * - Q / E: Yaw left / Yaw right (Rudder)
 * - Shift / Ctrl (or Space / Z): Throttle Up / Down
 * - C: Camera mode switch
 * - G: Landing gear toggle
 * - B: Airbrake / Wheel brakes
 * - F: Flaps cycle
 * - R: Reset / Respawn
 * - Mouse drag (Right button or left in orbit): Free camera look
 */

export class InputManager {
  constructor(canvasElement) {
    this.canvas = canvasElement || window;

    this.keys = {};
    this.keyPressEvents = {};

    // Flight axes (-1 to +1)
    this.pitch = 0;       // W (-1) / S (+1) or vice versa depending on inverted
    this.roll = 0;        // A (-1) / D (+1)
    this.yaw = 0;         // Q (-1) / E (+1)
    this.throttleDelta = 0; // Shift (+1) / Ctrl (-1)
    this.brakes = false;

    // Mouse / Camera look
    this.mouse = {
      isDown: false,
      button: 0, // 0: left, 2: right
      deltaX: 0,
      deltaY: 0,
      currentX: 0,
      currentY: 0,
      accumulatedX: 0,
      accumulatedY: 0,
      wheelDelta: 0
    };

    // User settings
    this.invertPitch = false; // standard flight stick: W = push stick forward = nose down (-), S = pull stick back = nose up (+)
    this.mouseSensitivity = 0.003;
    this.flightAssist = true; // Fly-By-Wire auto-stabilization when controls released

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keys[code]) {
        this.keyPressEvents[code] = true;
      }
      this.keys[code] = true;

      // Prevent scrolling on space / arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse events for camera look
    window.addEventListener('mousedown', (e) => {
      // Don't trigger if clicked on UI buttons
      if (e.target.closest && e.target.closest('.ui-interactive')) return;
      this.mouse.isDown = true;
      this.mouse.button = e.button;
      this.mouse.currentX = e.clientX;
      this.mouse.currentY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      this.mouse.isDown = false;
      this.mouse.deltaX = 0;
      this.mouse.deltaY = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mouse.isDown) {
        const dx = e.movementX || (e.clientX - this.mouse.currentX);
        const dy = e.movementY || (e.clientY - this.mouse.currentY);
        this.mouse.deltaX += dx;
        this.mouse.deltaY += dy;
        this.mouse.accumulatedX += dx * this.mouseSensitivity;
        this.mouse.accumulatedY += dy * this.mouseSensitivity;
        this.mouse.currentX = e.clientX;
        this.mouse.currentY = e.clientY;
      }
    });

    window.addEventListener('wheel', (e) => {
      this.mouse.wheelDelta = Math.sign(e.deltaY);
    }, { passive: true });

    // Context menu prevent on right-click inside canvas for seamless camera pan
    window.addEventListener('contextmenu', (e) => {
      if (!e.target.closest || !e.target.closest('.ui-interactive')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Consume a single-press trigger event (e.g. 'KeyC', 'KeyG')
   */
  wasPressed(keyCode) {
    if (this.keyPressEvents[keyCode]) {
      this.keyPressEvents[keyCode] = false;
      return true;
    }
    return false;
  }

  /**
   * Update axes every frame with smooth keyboard response
   */
  update(dt) {
    // Pitch: W = nose down (-1), S = nose up (+1)
    let targetPitch = 0;
    if (this.keys['KeyW'] || this.keys['ArrowDown']) targetPitch -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowUp']) targetPitch += 1;
    if (this.invertPitch) targetPitch *= -1;

    // Roll: A = roll left (-1), D = roll right (+1)
    let targetRoll = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) targetRoll -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) targetRoll += 1;

    // Yaw: Q = yaw left (-1), E = yaw right (+1)
    let targetYaw = 0;
    if (this.keys['KeyQ']) targetYaw -= 1;
    if (this.keys['KeyE']) targetYaw += 1;

    // Throttle input: Shift / Space / PageUp to increase; Ctrl / Z / PageDown to decrease
    this.throttleDelta = 0;
    this.throttleStep = 0;

    if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['Space']) {
      this.throttleDelta += 1.0;
    }
    if (this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyZ']) {
      this.throttleDelta -= 1.0;
    }

    // Immediate throttle jump on initial key tap
    if (this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight') || this.wasPressed('Space')) {
      this.throttleStep = 0.33;
    } else if (this.wasPressed('ControlLeft') || this.wasPressed('ControlRight') || this.wasPressed('KeyZ')) {
      this.throttleStep = -0.33;
    }

    // Brakes
    this.brakes = !!(this.keys['KeyB'] || this.keys['KeyX']);

    // Smooth control deflection response (simulates hydraulic actuator speed)
    const responseSpeed = 10.0;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * responseSpeed);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * responseSpeed);
    this.yaw += (targetYaw - this.yaw) * Math.min(1, dt * responseSpeed);

    // Reset mouse delta per frame
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
    this.mouse.wheelDelta = 0;
  }

  resetMouseAccumulator() {
    this.mouse.accumulatedX = 0;
    this.mouse.accumulatedY = 0;
  }
}
