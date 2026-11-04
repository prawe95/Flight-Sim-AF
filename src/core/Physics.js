import * as THREE from 'three';

/**
 * 6-DOF Aerodynamic Physics Engine
 * Simulates lift, drag, thrust, gravity, rotational inertia, control moments,
 * stall dynamics, ground reactions, and landing gear.
 */
export class AircraftPhysics {
  constructor() {
    // Aircraft physical specifications (High-performance jet / aerobatic trainer)
    this.mass = 4500;             // kg
    this.wingArea = 25.0;         // m^2
    this.wingspan = 10.5;         // m
    this.aspectRatio = (this.wingspan * this.wingspan) / this.wingArea;
    this.maxThrust = 62000;       // Newtons (~14,000 lbf full military thrust)
    this.afterburnerThrust = 92000; // Newtons with boost (~20,600 lbf)

    // Aerodynamic Coefficients
    this.liftSlope = 5.2;         // dCL/dAlpha (per radian)
    this.stallAoA = THREE.MathUtils.degToRad(16.5); // ~16.5 deg
    this.cd0 = 0.022;             // Parasite drag coefficient (clean)
    this.cdGear = 0.035;          // Additional drag with landing gear down
    this.cdFlaps = 0.045;         // Additional drag with full flaps
    this.cdBrakes = 0.080;        // Airbrake drag
    this.oswaldEfficiency = 0.82; // Oswald wing efficiency factor

    // Control Authority Coefficients
    this.pitchAuthority = 1.6;
    this.rollAuthority = 2.4;
    this.yawAuthority = 0.85;

    // Angular Damping
    this.pitchDamping = 3.2;
    this.rollDamping = 4.0;
    this.yawDamping = 2.6;

    // State Vectors (World coordinates)
    this.position = new THREE.Vector3(0, 2.0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.quaternion = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3(0, 0, 0); // (pitch rate, yaw rate, roll rate in body)

    // Aircraft Controls & Systems State
    this.throttle = 0.0;          // 0.0 to 1.0 (up to 1.15 for afterburner)
    this.targetThrottle = 0.0;
    this.flaps = 0;               // 0: Clean (0°), 1: Takeoff (15°), 2: Landing (30°)
    this.gear = 1.0;              // 1.0 = fully extended, 0.0 = fully retracted
    this.targetGear = 1.0;
    this.airbrake = 0.0;          // 0.0 to 1.0

    // Flight Telemetry / Outputs for HUD
    this.airspeed = 0;            // m/s
    this.airspeedKnots = 0;       // knots (1 m/s = 1.94384 kts)
    this.altitude = 0;            // m
    this.altitudeFeet = 0;        // feet
    this.verticalSpeed = 0;       // m/s
    this.verticalSpeedFPM = 0;    // ft/min
    this.mach = 0;
    this.gForce = 1.0;
    this.maxG = 1.0;
    this.minG = 1.0;
    this.aoa = 0;                 // angle of attack (rad)
    this.aoaDeg = 0;
    this.heading = 0;             // compass degrees 0-360
    this.pitchDeg = 0;
    this.rollDeg = 0;
    this.isStalling = false;
    this.isGrounded = true;
    this.isCrashed = false;
    this.crashReason = '';

    // Landing gear geometry
    this.gearHeight = 2.0;        // Distance from CG to ground when gear compressed
    this.landingTolerance = 8.5;  // Max descent velocity on touchdown (m/s) (~1670 ft/min)

    // Temp scratch vectors
    this._vLocal = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._forces = new THREE.Vector3();
    this._torques = new THREE.Vector3();
    this._invQuat = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
  }

  /**
   * Reset plane state to specified preset
   */
  reset(preset = 'runway') {
    this.isCrashed = false;
    this.crashReason = '';
    this.angularVelocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.maxG = 1.0;
    this.minG = 1.0;

    if (preset === 'runway') {
      // Ready on runway 09 heading South along runway (+Z)
      this.position.set(0, this.gearHeight, -1400);
      this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      this.velocity.set(0, 0, 0);
      this.throttle = 0.0;
      this.targetThrottle = 0.0;
      this.gear = 1.0;
      this.targetGear = 1.0;
      this.flaps = 1; // 15° for takeoff
      this.isGrounded = true;
    } else if (preset === 'cruise') {
      // Airborne at 1200m altitude (~4000 ft) over city
      this.position.set(0, 1200, -800);
      this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      this.velocity.set(0, 0, 140); // ~270 knots
      this.throttle = 0.7;
      this.targetThrottle = 0.7;
      this.gear = 0.0;
      this.targetGear = 0.0;
      this.flaps = 0;
      this.isGrounded = false;
    } else if (preset === 'approach') {
      // Final approach: 3.5km north of runway, descending on glideslope
      this.position.set(0, 240, -3200);
      this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      this.velocity.set(0, -3.5, 75); // ~145 knots on glideslope
      this.throttle = 0.55;
      this.targetThrottle = 0.55;
      this.gear = 1.0;
      this.targetGear = 1.0;
      this.flaps = 2; // Full landing flaps
      this.isGrounded = false;
    }
  }

  setThrottle(val) {
    this.targetThrottle = THREE.MathUtils.clamp(val, 0.0, 1.15);
  }

  stepThrottle(delta) {
    this.targetThrottle = THREE.MathUtils.clamp(this.targetThrottle + delta, 0.0, 1.15);
  }

  /**
   * Main physics step
   */
  update(dt, input, terrainElevationFunc) {
    if (this.isCrashed) return;

    // Constrain dt to prevent numerical instability
    dt = Math.min(dt, 0.05);

    // Apply immediate step from key tap if any
    if (input.throttleStep) {
      this.stepThrottle(input.throttleStep);
    }

    // Update throttle smoothly towards target on continuous hold
    // 0.6 per second ramp when holding key (full throttle in ~1.7 seconds)
    if (input.throttleDelta !== 0) {
      this.targetThrottle = THREE.MathUtils.clamp(
        this.targetThrottle + input.throttleDelta * dt * 0.6,
        0.0,
        1.15 // Afterburner boost above 1.0
      );
    }
    // Fast spool-up: reaches target within ~0.5s
    this.throttle += (this.targetThrottle - this.throttle) * Math.min(1, dt * 15.0);

    // Update landing gear transition
    if (input.wasPressed('KeyG')) {
      this.targetGear = this.targetGear > 0.5 ? 0.0 : 1.0;
    }
    this.gear += (this.targetGear - this.gear) * Math.min(1, dt * 0.8);

    // Flaps toggle
    if (input.wasPressed('KeyF')) {
      this.flaps = (this.flaps + 1) % 3;
    }

    // Airbrake
    this.airbrake += ((input.brakes ? 1.0 : 0.0) - this.airbrake) * Math.min(1, dt * 6.0);

    // Aircraft body directions in world space
    this._forward.set(0, 0, 1).applyQuaternion(this.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.quaternion);

    // Local body velocities
    this._invQuat.copy(this.quaternion).invert();
    this._vLocal.copy(this.velocity).applyQuaternion(this._invQuat);

    const uForward = this._vLocal.z;
    const vLateral = this._vLocal.x;
    const wVertical = this._vLocal.y;

    this.airspeed = this.velocity.length();
    this.airspeedKnots = this.airspeed * 1.94384;
    this.altitude = this.position.y;
    this.altitudeFeet = this.altitude * 3.28084;
    this.verticalSpeed = this.velocity.y;
    this.verticalSpeedFPM = this.verticalSpeed * 196.85;

    // Speed of sound lapse with altitude
    const speedOfSound = 340.0 * Math.sqrt(Math.max(0.7, 1.0 - 0.0000225 * this.altitude));
    this.mach = this.airspeed / speedOfSound;

    // Air density with altitude
    const airDensity = 1.225 * Math.exp(-Math.max(0, this.altitude) / 8500.0);
    const q = 0.5 * airDensity * (this.airspeed * this.airspeed);

    // Angle of Attack (AoA)
    if (Math.abs(uForward) > 0.5) {
      this.aoa = Math.atan2(-wVertical, Math.max(0.1, uForward));
    } else {
      this.aoa = 0;
    }
    this.aoaDeg = THREE.MathUtils.radToDeg(this.aoa);

    // Stall check
    const criticalAoA = this.stallAoA + (this.flaps * 0.04);
    this.isStalling = Math.abs(this.aoa) > criticalAoA && !this.isGrounded && this.airspeed > 10;

    // Lift Coefficient CL
    let cl = 0;
    const flapLiftBonus = this.flaps === 1 ? 0.35 : (this.flaps === 2 ? 0.65 : 0.0);
    if (Math.abs(this.aoa) < criticalAoA) {
      cl = this.liftSlope * this.aoa + flapLiftBonus;
    } else {
      const sign = Math.sign(this.aoa);
      cl = (this.liftSlope * criticalAoA * 0.6 + flapLiftBonus * 0.5) * sign * Math.cos(this.aoa);
    }

    // Drag Coefficient CD
    const inducedDragFactor = (cl * cl) / (Math.PI * this.aspectRatio * this.oswaldEfficiency);
    let cd = this.cd0 + inducedDragFactor;
    cd += this.gear * this.cdGear;
    cd += (this.flaps / 2.0) * this.cdFlaps;
    cd += this.airbrake * this.cdBrakes;

    if (this.mach > 0.85) {
      const trans = Math.min(1.5, Math.max(0, this.mach - 0.85));
      cd += trans * trans * 0.15;
    }

    const liftMagnitude = cl * q * this.wingArea;
    const dragMagnitude = cd * q * this.wingArea;

    // Thrust calculation
    let currentThrust = 0;
    if (this.throttle <= 1.0) {
      currentThrust = this.throttle * this.maxThrust;
    } else {
      const abFactor = (this.throttle - 1.0) / 0.15;
      currentThrust = this.maxThrust + abFactor * (this.afterburnerThrust - this.maxThrust);
    }

    // Sum forces
    this._forces.set(0, 0, 0);

    // Thrust along fuselage forward
    this._forces.addScaledVector(this._forward, currentThrust);

    // Drag opposite to velocity
    if (this.airspeed > 0.05) {
      this._forces.addScaledVector(this.velocity, -dragMagnitude / this.airspeed);
    }

    // Lift perpendicular to velocity in body UP direction
    if (this.airspeed > 0.05) {
      const liftDir = new THREE.Vector3().copy(this._up).addScaledVector(
        this.velocity,
        -this._up.dot(this.velocity) / (this.airspeed * this.airspeed)
      );
      if (liftDir.lengthSq() > 0.0001) {
        liftDir.normalize();
        this._forces.addScaledVector(liftDir, liftMagnitude);
      }
    }

    // Gravity
    const gravityForce = this.mass * 9.80665;
    this._forces.y -= gravityForce;

    // G-Force
    const feltAcceleration = liftMagnitude / (this.mass * 9.80665);
    this.gForce = THREE.MathUtils.lerp(this.gForce, this.isGrounded ? 1.0 : Math.max(-2, feltAcceleration), dt * 10);
    this.maxG = Math.max(this.maxG, this.gForce);
    this.minG = Math.min(this.minG, this.gForce);

    // --- CONTROL MOMENTS (AERODYNAMIC TORQUES) ---
    const controlEffectiveness = THREE.MathUtils.clamp(this.airspeed / 80.0, 0.08, 1.4);

    let pitchInput = input.pitch; // W: -1 (pitch down), S: +1 (pitch up)
    let rollInput = input.roll;   // A: -1 (roll left), D: +1 (roll right)
    let yawInput = input.yaw;     // Q: -1 (yaw left), E: +1 (yaw right)

    // Fly-By-Wire Auto-Stabilization when airborne
    if (input.flightAssist && !this.isGrounded) {
      if (Math.abs(rollInput) < 0.05) {
        const rollAngle = Math.atan2(this._right.y, this._up.y);
        rollInput -= THREE.MathUtils.clamp(rollAngle * 1.5, -0.6, 0.6);
      }
      if (Math.abs(pitchInput) < 0.05) {
        pitchInput += this.angularVelocity.x * 0.35;
      }
    }

    // Rotational torques around body axes:
    // pitchInput = +1 (S: nose up) -> negative rotation around X brings +Z towards +Y
    const pitchTorque = -pitchInput * this.pitchAuthority * controlEffectiveness;
    // rollInput = +1 (D: bank right) -> negative rotation around Z banks right
    const rollTorque = -rollInput * this.rollAuthority * controlEffectiveness;
    // yawInput = +1 (E: yaw right) -> positive rotation around Y turns right
    const yawTorque = yawInput * this.yawAuthority * controlEffectiveness;

    // Natural aerodynamic alignment
    let weatherVaneYaw = 0;
    let weatherVanePitch = 0;
    if (this.airspeed > 15.0) {
      const beta = Math.asin(THREE.MathUtils.clamp(vLateral / this.airspeed, -1, 1));
      weatherVaneYaw = beta * 1.5 * controlEffectiveness;
      weatherVanePitch = (this.aoa - 0.03) * 1.2 * controlEffectiveness;
    }

    const angAccelX = pitchTorque + weatherVanePitch - this.angularVelocity.x * this.pitchDamping;
    const angAccelY = yawTorque + weatherVaneYaw - this.angularVelocity.y * this.yawDamping;
    const angAccelZ = rollTorque - this.angularVelocity.z * this.rollDamping;

    this.angularVelocity.x += angAccelX * dt;
    this.angularVelocity.y += angAccelY * dt;
    this.angularVelocity.z += angAccelZ * dt;

    // --- GROUND HANDLING & TOUCHDOWN PHYSICS ---
    const groundHeight = terrainElevationFunc ? terrainElevationFunc(this.position.x, this.position.z) : 0;
    const targetGroundY = groundHeight + this.gearHeight;
    const isTouchingGround = (this.position.y <= targetGroundY + 0.08);

    if (isTouchingGround && this.gear > 0.5) {
      // If we just touched down this frame from airborne:
      if (!this.isGrounded && this.velocity.y < -0.5) {
        if (this.velocity.y < -this.landingTolerance) {
          this.crash(`Hard touchdown! Sink rate: ${(-this.verticalSpeedFPM).toFixed(0)} ft/min`);
          return;
        }
        if (Math.abs(this._right.y) > 0.40 || Math.abs(this._forward.y) > 0.45) {
          this.crash('Wing strike / cartwheel on touchdown!');
          return;
        }
      }

      // If downward or resting:
      if (this.velocity.y <= 0.01) {
        this.isGrounded = true;
        this.position.y = targetGroundY;
        this.velocity.y = 0;

        // Ground supports the plane: normal force cancels net downward force
        if (this._forces.y < 0) {
          this._forces.y = 0;
        }

        // Steer nosewheel with Q/E
        if (Math.abs(yawInput) > 0.05) {
          this.angularVelocity.y = yawInput * 0.9 * Math.min(1.0, this.airspeed / 12.0);
        }

        // Rolling friction & wheel brakes
        let frictionCoeff = 0.02;
        if (input.brakes) {
          frictionCoeff = 0.45;
        }
        const groundDecel = frictionCoeff * 9.80665;
        const forwardSpeed = this.velocity.dot(this._forward);
        if (Math.abs(forwardSpeed) > 0.05) {
          this.velocity.addScaledVector(this._forward, -Math.sign(forwardSpeed) * groundDecel * dt);
        } else if (this.throttle < 0.05) {
          this.velocity.set(0, 0, 0);
        }

        // Landing gear keeps wings level on runway
        this.angularVelocity.z = 0;
        const rollAngle = Math.atan2(this._right.y, this._up.y);
        if (Math.abs(rollAngle) > 0.001) {
          const levelQuat = new THREE.Quaternion().setFromAxisAngle(this._forward, -rollAngle * 0.25);
          this.quaternion.multiply(levelQuat);
        }

        // Clamp pitch rocking on ground when taxiing or stopped (< 45 kts)
        if (this.airspeedKnots < 45) {
          this.angularVelocity.x = 0;
          const currentPitch = this._forward.y;
          if (Math.abs(currentPitch) > 0.001) {
            const pitchLevelQuat = new THREE.Quaternion().setFromAxisAngle(this._right, currentPitch * 0.25);
            this.quaternion.multiply(pitchLevelQuat);
          }
        }
      } else {
        // Positive upward velocity: lifting off runway into air!
        this.isGrounded = false;
      }
    } else if (isTouchingGround && this.gear <= 0.5) {
      // Belly contact
      if (this.airspeed > 25) {
        this.crash('Belly crash! Landing gear retracted.');
        return;
      } else {
        this.isGrounded = true;
        this.position.y = groundHeight + 0.4;
        this.velocity.multiplyScalar(0.9);
        if (this._forces.y < 0) this._forces.y = 0;
      }
    } else {
      // Airborne
      this.isGrounded = false;
    }

    // Integrate linear acceleration & velocity
    this.acceleration.copy(this._forces).divideScalar(this.mass);
    this.velocity.addScaledVector(this.acceleration, dt);
    this.position.addScaledVector(this.velocity, dt);

    // Prevent ground penetration
    if (this.gear > 0.5 && this.position.y < targetGroundY) {
      this.position.y = targetGroundY;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // Integrate angular velocity
    const rotSpeed = this.angularVelocity.length();
    if (rotSpeed > 0.00001) {
      this._axis.copy(this.angularVelocity).normalize();
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(this._axis, rotSpeed * dt);
      this.quaternion.multiply(deltaQuat);
      this.quaternion.normalize();
    }

    // Update telemetry angles
    const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ');
    this.pitchDeg = THREE.MathUtils.radToDeg(-euler.x);
    this.rollDeg = THREE.MathUtils.radToDeg(-euler.z);

    let headingRad = Math.atan2(this._forward.x, this._forward.z);
    let headingDeg = THREE.MathUtils.radToDeg(headingRad);
    if (headingDeg < 0) headingDeg += 360;
    this.heading = headingDeg;
  }

  crash(reason) {
    this.isCrashed = true;
    this.crashReason = reason;
    this.velocity.set(0, 0, 0);
  }
}
