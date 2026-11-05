import * as THREE from 'three';

export const CameraMode = {
  CHASE: 'CHASE',
  COCKPIT: 'COCKPIT',
  ORBIT: 'ORBIT',
  FLYBY: 'FLYBY',
  WING: 'WING'
};

/**
 * CameraManager
 * Handles dynamic camera modes, smooth damping, mouse look, speed-dependent FOV,
 * and high-G head bobbing.
 */
export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.mode = CameraMode.CHASE;
    this.modesList = [CameraMode.CHASE, CameraMode.COCKPIT, CameraMode.ORBIT, CameraMode.FLYBY, CameraMode.WING];

    // Offsets & distances
    this.chaseDistance = 18.0;
    this.chaseHeight = 4.2;
    this.cockpitOffset = new THREE.Vector3(0, 1.35, 1.2); // Inside canopy
    this.wingOffset = new THREE.Vector3(6.5, 0.4, -2.5);  // Wingtip camera

    // Orbit parameters
    this.orbitDistance = 22.0;
    this.orbitYaw = 0;
    this.orbitPitch = 0.2;

    // Cockpit mouse-look
    this.cockpitLookYaw = 0;
    this.cockpitLookPitch = 0;

    // Flyby tracking position
    this.flybyPos = new THREE.Vector3();
    this.hasFlybyPoint = false;

    // Base FOV
    this.baseFov = 60;
    this.currentFov = 60;

    // Smoothed state
    this.currentPos = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();

    // Temp vectors
    this._idealPos = new THREE.Vector3();
    this._idealTarget = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  nextMode() {
    const idx = this.modesList.indexOf(this.mode);
    const nextIdx = (idx + 1) % this.modesList.length;
    this.setMode(this.modesList[nextIdx]);
  }

  setMode(mode) {
    if (this.modesList.includes(mode)) {
      this.mode = mode;
      if (mode === CameraMode.FLYBY) {
        this.hasFlybyPoint = false;
      }
    }
  }

  update(dt, airplane, input) {
    const planePos = airplane.physics.position;
    const planeQuat = airplane.physics.quaternion;
    const planeSpeed = airplane.physics.airspeed;
    const gForce = airplane.physics.gForce;

    // Compute plane directions
    this._forward.set(0, 0, 1).applyQuaternion(planeQuat);
    this._up.set(0, 1, 0).applyQuaternion(planeQuat);
    this._right.set(1, 0, 0).applyQuaternion(planeQuat);

    // Dynamic FOV based on speed and boost
    const speedRatio = Math.min(1.5, planeSpeed / 180.0);
    const targetFov = this.baseFov + (speedRatio * 18.0);
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 4.0);
    this.camera.fov = this.currentFov;

    switch (this.mode) {
      case CameraMode.CHASE:
        this._updateChase(dt, planePos, planeQuat, planeSpeed, input);
        break;

      case CameraMode.COCKPIT:
        this._updateCockpit(dt, planePos, planeQuat, gForce, input);
        break;

      case CameraMode.ORBIT:
        this._updateOrbit(dt, planePos, planeQuat, input);
        break;

      case CameraMode.FLYBY:
        this._updateFlyby(dt, planePos, airplane.physics.velocity);
        break;

      case CameraMode.WING:
        this._updateWing(dt, planePos, planeQuat);
        break;
    }

    this.camera.updateProjectionMatrix();
  }

  _updateChase(dt, planePos, planeQuat, speed, input) {
    // Distance expands slightly with speed
    const dist = this.chaseDistance + Math.min(12, speed * 0.05);
    const height = this.chaseHeight;

    // Mouse look offset when right-dragging (left button is the trigger)
    if (input.mouse.rightDown && (input.mouse.accumulatedX !== 0 || input.mouse.accumulatedY !== 0)) {
      const yaw = -input.mouse.accumulatedX;
      const pitch = THREE.MathUtils.clamp(input.mouse.accumulatedY, -1.2, 1.2);
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      this._idealPos.set(0, height, -dist).applyQuaternion(rot).applyQuaternion(planeQuat).add(planePos);
    } else {
      input.mouse.accumulatedX *= (1 - Math.min(1, dt * 5.0));
      input.mouse.accumulatedY *= (1 - Math.min(1, dt * 5.0));
      // Calculate ideal position behind plane
      this._idealPos.copy(planePos)
        .addScaledVector(this._forward, -dist)
        .addScaledVector(this._up, height);
    }

    // Look ahead of plane
    this._idealTarget.copy(planePos).addScaledVector(this._forward, 25.0);

    // On ground: use very slow follow so motion parallax is clearly visible.
    // In the air: fast follow for tight maneuvering.
    const isGrounded = speed < 5; // effectively parked/slow taxi
    const posLerp   = isGrounded ? Math.min(1, dt * 2.5)  : Math.min(1, dt * 10.0);
    const tgtLerp   = isGrounded ? Math.min(1, dt * 4.0)  : Math.min(1, dt * 14.0);

    this.currentPos.lerp(this._idealPos, posLerp);
    this.currentTarget.lerp(this._idealTarget, tgtLerp);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);

    // Subtle camera bank alignment
    const camUp = new THREE.Vector3(0, 1, 0).lerp(this._up, 0.45).normalize();
    this.camera.up.copy(camUp);
  }

  _updateCockpit(dt, planePos, planeQuat, gForce, input) {
    // Mouse look inside cockpit (right-drag only)
    if (input.mouse.rightDown) {
      this.cockpitLookYaw = -input.mouse.accumulatedX * 1.5;
      this.cockpitLookPitch = THREE.MathUtils.clamp(-input.mouse.accumulatedY * 1.5, -1.0, 1.2);
    } else {
      // Return smoothly to center forward
      this.cockpitLookYaw *= (1 - Math.min(1, dt * 5.0));
      this.cockpitLookPitch *= (1 - Math.min(1, dt * 5.0));
    }

    // G-force head bobbing (G-load pulls head downward)
    const gHeadDrop = (gForce - 1.0) * 0.04;

    const cockpitLocal = this.cockpitOffset.clone();
    cockpitLocal.y -= THREE.MathUtils.clamp(gHeadDrop, -0.15, 0.2);

    // World cockpit position
    const camPos = cockpitLocal.applyQuaternion(planeQuat).add(planePos);
    this.camera.position.copy(camPos);

    // Cockpit forward direction combined with mouse look
    const lookEuler = new THREE.Euler(this.cockpitLookPitch, this.cockpitLookYaw, 0, 'YXZ');
    const lookQuat = new THREE.Quaternion().setFromEuler(lookEuler);
    const finalQuat = planeQuat.clone().multiply(lookQuat);

    const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(finalQuat);
    const targetPos = camPos.clone().addScaledVector(forwardDir, 50.0);

    this.camera.lookAt(targetPos);
    const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(finalQuat);
    this.camera.up.copy(upDir);
  }

  _updateOrbit(dt, planePos, planeQuat, input) {
    // Adjust orbit yaw/pitch with right-mouse drag
    if (input.mouse.rightDown) {
      this.orbitYaw -= input.mouse.deltaX * 0.008;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + input.mouse.deltaY * 0.008, -1.4, 1.4);
    }

    // Zoom with mouse wheel
    if (input.mouse.wheelDelta !== 0) {
      this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance + input.mouse.wheelDelta * 3.0, 8.0, 60.0);
    }

    const x = this.orbitDistance * Math.cos(this.orbitPitch) * Math.sin(this.orbitYaw);
    const y = this.orbitDistance * Math.sin(this.orbitPitch);
    const z = this.orbitDistance * Math.cos(this.orbitPitch) * Math.cos(this.orbitYaw);

    this.camera.position.set(planePos.x + x, planePos.y + y, planePos.z + z);
    this.camera.lookAt(planePos);
    this.camera.up.set(0, 1, 0);
  }

  _updateFlyby(dt, planePos, planeVel) {
    // If no flyby waypoint or plane moved far past it, pick a new point ahead of plane
    const dist = this.camera.position.distanceTo(planePos);
    if (!this.hasFlybyPoint || dist > 1800) {
      const speed = Math.max(80, planeVel.length());
      // Station camera 600m ahead along velocity vector, offset laterally by 80m and elevation 25m
      const forwardNorm = planeVel.clone().normalize();
      if (forwardNorm.lengthSq() < 0.1) forwardNorm.set(0, 0, 1);

      const sideNorm = new THREE.Vector3(-forwardNorm.z, 0, forwardNorm.x).normalize();
      this.flybyPos.copy(planePos)
        .addScaledVector(forwardNorm, 450 + speed * 1.5)
        .addScaledVector(sideNorm, 70.0);
      this.flybyPos.y = Math.max(15, planePos.y - 10.0);

      this.camera.position.copy(this.flybyPos);
      this.hasFlybyPoint = true;
    }

    // Smoothly track plane
    this.currentTarget.lerp(planePos, Math.min(1, dt * 15.0));
    this.camera.lookAt(this.currentTarget);
    this.camera.up.set(0, 1, 0);
  }

  _updateWing(dt, planePos, planeQuat) {
    // Fixed on wingtip looking inward and slightly forward toward cockpit
    const wingPos = this.wingOffset.clone().applyQuaternion(planeQuat).add(planePos);
    this.camera.position.copy(wingPos);

    const lookTarget = planePos.clone().addScaledVector(this._forward, 12.0);
    this.camera.lookAt(lookTarget);
    this.camera.up.copy(this._up);
  }
}
