import * as THREE from 'three';
import { AircraftPhysics } from '../core/Physics.js';

/**
 * Airplane Entity
 * High-detail 3D modern supersonic jet fighter with functional control surfaces
 * (ailerons, elevators, rudder, airbrake), retractable landing gear, animated afterburners,
 * wingtip vapor trails, and navigation lights.
 */
export class Airplane {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Aerodynamic Physics core
    this.physics = new AircraftPhysics();

    // Animated control surface references
    this.leftAileron = null;
    this.rightAileron = null;
    this.leftElevator = null;
    this.rightElevator = null;
    this.rudder = null;
    this.airbrakeFlap = null;

    // Landing gear references
    this.noseGear = null;
    this.leftGear = null;
    this.rightGear = null;
    this.wheels = [];

    // Engine flames
    this.afterburners = [];
    this.afterburnerLight = null;

    // Wingtip trails
    this.trailLeft = null;
    this.trailRight = null;
    this.trailPointsLeft = [];
    this.trailPointsRight = [];
    this.maxTrailPoints = 60;

    // Cockpit & navigation lights
    this.strobeLights = [];

    this._buildJetModel();
    this._initWingTrails();
  }

  _buildJetModel() {
    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a535f, // Matte military grey
      roughness: 0.35,
      metalness: 0.65
    });

    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.4,
      metalness: 0.6
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      roughness: 0.1,
      metalness: 0.95,
      transparent: true,
      opacity: 0.65
    });

    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x1f2124,
      roughness: 0.6,
      metalness: 0.8
    });

    const wheelRubberMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.9
    });

    const gearStrutMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      metalness: 0.9,
      roughness: 0.2
    });

    // 1. Fuselage Main Body
    // Fuselage length ~ 16m, diameter ~ 1.8m
    const fuselageGeo = new THREE.CylinderGeometry(0.7, 0.95, 12, 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
    fuselage.position.set(0, 0, 0);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.group.add(fuselage);

    // Nose cone (Radome) pointing towards +Z (Physics forward is +Z)
    const noseGeo = new THREE.ConeGeometry(0.7, 4.5, 16);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, darkAccentMat);
    nose.position.set(0, -0.05, 8.25);
    nose.castShadow = true;
    this.group.add(nose);

    // Pitot tube needle on nose tip
    const pitotGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
    pitotGeo.rotateX(Math.PI / 2);
    const pitot = new THREE.Mesh(pitotGeo, gearStrutMat);
    pitot.position.set(0, -0.05, 11.0);
    this.group.add(pitot);

    // 2. Cockpit Canopy & Interior
    const canopyGeo = new THREE.SphereGeometry(0.72, 16, 16);
    canopyGeo.scale(0.85, 0.95, 2.8);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.65, 3.2);
    canopy.castShadow = true;
    this.group.add(canopy);

    // Ejection seat headrest inside cockpit
    const seatGeo = new THREE.BoxGeometry(0.5, 0.8, 0.4);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1f });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.6, 2.8);
    this.group.add(seat);

    // HUD glass plate in front of pilot
    const hudPlateGeo = new THREE.BoxGeometry(0.35, 0.35, 0.03);
    const hudPlateMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.45
    });
    const hudPlate = new THREE.Mesh(hudPlateGeo, hudPlateMat);
    hudPlate.position.set(0, 0.85, 4.6);
    hudPlate.rotation.x = -0.3;
    this.group.add(hudPlate);

    // 3. Jet Intakes (Port & Starboard)
    [-1, 1].forEach((side) => {
      const intakeGeo = new THREE.BoxGeometry(0.65, 0.75, 4.2);
      const intake = new THREE.Mesh(intakeGeo, darkAccentMat);
      intake.position.set(side * 0.9, -0.1, 1.8);
      intake.castShadow = true;
      this.group.add(intake);
    });

    // 4. Main Swept Wings
    // Wing group left
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0, -4.8);      // Trailing root
    wingShape.lineTo(-5.8, -3.2);   // Wingtip trailing
    wingShape.lineTo(-5.8, -2.4);   // Wingtip leading
    wingShape.lineTo(0, 1.8);       // Leading root
    wingShape.closePath();

    const extrudeSettings = { depth: 0.16, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2);

    const leftWingMesh = new THREE.Mesh(wingGeo, bodyMat);
    leftWingMesh.position.set(0, -0.05, 0);
    leftWingMesh.castShadow = true;
    leftWingMesh.receiveShadow = true;
    this.group.add(leftWingMesh);

    // Right wing (mirror)
    const rightWingShape = new THREE.Shape();
    rightWingShape.moveTo(0, 0);
    rightWingShape.lineTo(0, -4.8);
    rightWingShape.lineTo(5.8, -3.2);
    rightWingShape.lineTo(5.8, -2.4);
    rightWingShape.lineTo(0, 1.8);
    rightWingShape.closePath();

    const rightWingGeo = new THREE.ExtrudeGeometry(rightWingShape, extrudeSettings);
    rightWingGeo.rotateX(Math.PI / 2);

    const rightWingMesh = new THREE.Mesh(rightWingGeo, bodyMat);
    rightWingMesh.position.set(0, -0.05, 0);
    rightWingMesh.castShadow = true;
    rightWingMesh.receiveShadow = true;
    this.group.add(rightWingMesh);

    // 5. Control Surfaces (Ailerons)
    const aileronGeo = new THREE.BoxGeometry(2.2, 0.12, 0.6);

    // Left Aileron
    this.leftAileron = new THREE.Mesh(aileronGeo, darkAccentMat);
    this.leftAileron.position.set(-4.2, -0.05, -3.2);
    this.group.add(this.leftAileron);

    // Right Aileron
    this.rightAileron = new THREE.Mesh(aileronGeo, darkAccentMat);
    this.rightAileron.position.set(4.2, -0.05, -3.2);
    this.group.add(this.rightAileron);

    // 6. Horizontal Tail Stabilizers (Elevators)
    const elevatorGeo = new THREE.BoxGeometry(2.0, 0.12, 1.4);

    this.leftElevator = new THREE.Mesh(elevatorGeo, darkAccentMat);
    this.leftElevator.position.set(-2.0, 0.05, -6.2);
    this.leftElevator.castShadow = true;
    this.group.add(this.leftElevator);

    this.rightElevator = new THREE.Mesh(elevatorGeo, darkAccentMat);
    this.rightElevator.position.set(2.0, 0.05, -6.2);
    this.rightElevator.castShadow = true;
    this.group.add(this.rightElevator);

    // 7. Twin Vertical Tail Fins & Rudder
    [-1.2, 1.2].forEach((xPos, idx) => {
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(-1.8, 0);
      finShape.lineTo(-1.2, 2.6);
      finShape.lineTo(0.2, 2.6);
      finShape.closePath();

      const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
      finGeo.rotateY(Math.PI / 2);
      const fin = new THREE.Mesh(finGeo, bodyMat);
      fin.position.set(xPos, 0.4, -4.5);
      fin.rotation.z = (xPos > 0 ? -0.14 : 0.14); // Outward canted twin vertical tails
      fin.castShadow = true;
      this.group.add(fin);
    });

    // Central rudder / dual rudders
    const rudderGeo = new THREE.BoxGeometry(0.12, 1.8, 0.6);
    this.rudder = new THREE.Mesh(rudderGeo, darkAccentMat);
    this.rudder.position.set(0, 1.4, -5.8);
    this.group.add(this.rudder);

    // 8. Airbrake flap on spine
    const brakeGeo = new THREE.BoxGeometry(0.8, 0.1, 1.6);
    this.airbrakeFlap = new THREE.Mesh(brakeGeo, darkAccentMat);
    this.airbrakeFlap.position.set(0, 0.82, -1.5);
    this.group.add(this.airbrakeFlap);

    // 9. Twin Jet Engine Nozzles & Afterburner Glow
    [-0.55, 0.55].forEach((xOff) => {
      // Nozzle ring
      const nozzleGeo = new THREE.CylinderGeometry(0.52, 0.58, 1.4, 16);
      nozzleGeo.rotateX(Math.PI / 2);
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(xOff, -0.05, -6.5);
      this.group.add(nozzle);

      // Flame cone (Inner core + outer plume)
      const flameGeo = new THREE.ConeGeometry(0.48, 3.2, 16);
      flameGeo.rotateX(-Math.PI / 2); // Points backward (-Z)
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0x44aaff, // Cyan / blue afterburner core
        transparent: true,
        opacity: 0.85
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(xOff, -0.05, -8.0);
      flame.scale.set(0.1, 0.1, 0.1);
      this.group.add(flame);
      this.afterburners.push(flame);
    });

    // 10. Retractable Tricycle Landing Gear
    // Nose Gear
    this.noseGear = new THREE.Group();
    this.noseGear.position.set(0, -0.4, 4.8);
    const nStrutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6);
    const nStrut = new THREE.Mesh(nStrutGeo, gearStrutMat);
    nStrut.position.y = -0.8;
    this.noseGear.add(nStrut);

    const nWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12);
    nWheelGeo.rotateZ(Math.PI / 2);
    const nWheel = new THREE.Mesh(nWheelGeo, wheelRubberMat);
    nWheel.position.y = -1.6;
    this.noseGear.add(nWheel);
    this.wheels.push(nWheel);
    this.group.add(this.noseGear);

    // Main Left Gear
    this.leftGear = new THREE.Group();
    this.leftGear.position.set(-1.4, -0.4, -0.8);
    const lStrut = new THREE.Mesh(nStrutGeo, gearStrutMat);
    lStrut.position.y = -0.8;
    this.leftGear.add(lStrut);

    const lWheel = new THREE.Mesh(nWheelGeo, wheelRubberMat);
    lWheel.position.y = -1.6;
    this.leftGear.add(lWheel);
    this.wheels.push(lWheel);
    this.group.add(this.leftGear);

    // Main Right Gear
    this.rightGear = new THREE.Group();
    this.rightGear.position.set(1.4, -0.4, -0.8);
    const rStrut = new THREE.Mesh(nStrutGeo, gearStrutMat);
    rStrut.position.y = -0.8;
    this.rightGear.add(rStrut);

    const rWheel = new THREE.Mesh(nWheelGeo, wheelRubberMat);
    rWheel.position.y = -1.6;
    this.rightGear.add(rWheel);
    this.wheels.push(rWheel);
    this.group.add(this.rightGear);

    // 11. Navigation Lights
    const navGeo = new THREE.SphereGeometry(0.12, 6, 6);
    // Port (Left wingtip) - Red
    const redNav = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff0022 }));
    redNav.position.set(-5.8, -0.05, -2.8);
    this.group.add(redNav);

    // Starboard (Right wingtip) - Green
    const greenNav = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x00ff44 }));
    greenNav.position.set(5.8, -0.05, -2.8);
    this.group.add(greenNav);

    // Tail Strobe - White
    const strobe = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, 2.4, -5.8);
    this.group.add(strobe);
    this.strobeLights.push(strobe);
  }

  _initWingTrails() {
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xebf4ff,
      transparent: true,
      opacity: 0.65,
      linewidth: 2
    });

    const geoLeft = new THREE.BufferGeometry();
    const posLeft = new Float32Array(this.maxTrailPoints * 3);
    geoLeft.setAttribute('position', new THREE.BufferAttribute(posLeft, 3));
    this.trailLeft = new THREE.Line(geoLeft, trailMat);
    this.trailLeft.frustumCulled = false;
    this.scene.add(this.trailLeft);

    const geoRight = new THREE.BufferGeometry();
    const posRight = new Float32Array(this.maxTrailPoints * 3);
    geoRight.setAttribute('position', new THREE.BufferAttribute(posRight, 3));
    this.trailRight = new THREE.Line(geoRight, trailMat);
    this.trailRight.frustumCulled = false;
    this.scene.add(this.trailRight);
  }

  update(dt, input, terrainElevationFunc) {
    // 1. Step aerodynamic physics
    this.physics.update(dt, input, terrainElevationFunc);

    // 2. Sync 3D object transform with physics state
    this.group.position.copy(this.physics.position);
    this.group.quaternion.copy(this.physics.quaternion);

    // 3. Animate control surfaces
    // Ailerons (Roll: A / D)
    const rollAngle = input.roll * 0.45;
    if (this.leftAileron && this.rightAileron) {
      this.leftAileron.rotation.x = rollAngle;
      this.rightAileron.rotation.x = -rollAngle;
    }

    // Elevators (Pitch: W / S)
    const pitchAngle = input.pitch * 0.48;
    if (this.leftElevator && this.rightElevator) {
      this.leftElevator.rotation.x = -pitchAngle;
      this.rightElevator.rotation.x = -pitchAngle;
    }

    // Rudder (Yaw: Q / E)
    const yawAngle = input.yaw * 0.42;
    if (this.rudder) {
      this.rudder.rotation.y = -yawAngle;
    }

    // Airbrake flap
    if (this.airbrakeFlap) {
      this.airbrakeFlap.rotation.x = this.physics.airbrake * 0.75;
    }

    // 4. Animate landing gear extension / retraction
    const gearT = this.physics.gear; // 1.0 = down, 0.0 = up
    if (this.noseGear && this.leftGear && this.rightGear) {
      // Gear pivots backward up into fuselage
      const rotAngle = (1.0 - gearT) * (Math.PI / 2);
      this.noseGear.rotation.x = -rotAngle;
      this.leftGear.rotation.z = rotAngle * 0.9;
      this.rightGear.rotation.z = -rotAngle * 0.9;

      this.noseGear.visible = gearT > 0.05;
      this.leftGear.visible = gearT > 0.05;
      this.rightGear.visible = gearT > 0.05;
    }

    // Wheel spin when on ground
    if (this.physics.isGrounded) {
      const spinDelta = (this.physics.airspeed / 0.3) * dt;
      this.wheels.forEach(w => {
        w.rotation.x += spinDelta;
      });
    }

    // 5. Animate Afterburners
    const throttle = this.physics.throttle;
    const flameVisible = throttle > 0.15;
    const flameScale = THREE.MathUtils.lerp(0.2, 1.4, Math.max(0, throttle - 0.2) / 0.95);
    const pulse = 1.0 + Math.sin(Date.now() * 0.04) * 0.08;

    this.afterburners.forEach((flame) => {
      flame.visible = flameVisible;
      if (flameVisible) {
        flame.scale.set(flameScale * 0.9 * pulse, flameScale * 0.9 * pulse, flameScale * 1.5 * pulse);
        // Turn orange-yellow if boosted, cyan at cruising throttle
        if (throttle > 0.95) {
          flame.material.color.setHex(0xff7722);
        } else {
          flame.material.color.setHex(0x3399ff);
        }
      }
    });

    // 6. Navigation strobe flash
    const strobeFlash = (Math.floor(Date.now() / 600) % 2) === 0;
    this.strobeLights.forEach(s => {
      s.visible = strobeFlash;
    });

    // 7. Wingtip Vapor Trails
    this._updateWingTrails();
  }

  _updateWingTrails() {
    // Generate trails when pulling high Gs (> 2.2G) or in high-speed turns
    const shouldEmit = Math.abs(this.physics.gForce - 1.0) > 1.2 && this.physics.airspeed > 60;

    const leftTipLocal = new THREE.Vector3(-5.8, -0.05, -3.0).applyQuaternion(this.physics.quaternion).add(this.physics.position);
    const rightTipLocal = new THREE.Vector3(5.8, -0.05, -3.0).applyQuaternion(this.physics.quaternion).add(this.physics.position);

    if (shouldEmit) {
      this.trailPointsLeft.unshift(leftTipLocal.clone());
      this.trailPointsRight.unshift(rightTipLocal.clone());
    } else if (this.trailPointsLeft.length > 0) {
      this.trailPointsLeft.pop();
      this.trailPointsRight.pop();
    }

    if (this.trailPointsLeft.length > this.maxTrailPoints) {
      this.trailPointsLeft.pop();
      this.trailPointsRight.pop();
    }

    // Update line buffers
    const pLeft = this.trailLeft.geometry.attributes.position.array;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const pt = this.trailPointsLeft[i] || leftTipLocal;
      pLeft[i * 3] = pt.x;
      pLeft[i * 3 + 1] = pt.y;
      pLeft[i * 3 + 2] = pt.z;
    }
    this.trailLeft.geometry.attributes.position.needsUpdate = true;

    const pRight = this.trailRight.geometry.attributes.position.array;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const pt = this.trailPointsRight[i] || rightTipLocal;
      pRight[i * 3] = pt.x;
      pRight[i * 3 + 1] = pt.y;
      pRight[i * 3 + 2] = pt.z;
    }
    this.trailRight.geometry.attributes.position.needsUpdate = true;
  }
}
