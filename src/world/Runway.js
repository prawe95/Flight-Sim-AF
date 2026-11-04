import * as THREE from 'three';

/**
 * Runway & Airfield Complex
 * Complete runway system with threshold markings, skid marks, taxiways,
 * runway lighting, PAPI glideslope indicator, control tower, and hangars.
 */
export class Runway {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.length = 3200; // meters (Z axis: -1600 to +1600)
    this.width = 60;   // meters
    this.center = new THREE.Vector3(0, 0.1, 0);

    // Dynamic runway lighting references
    this.papiLights = [];
    this.approachStrobes = [];
    this.beaconLight = null;

    this._createRunwaySurface();
    this._createTaxiways();
    this._createRunwayLighting();
    this._createPAPI();
    this._createDistanceMarkers();
    this._createAirportBuildings();
  }

  _createRunwayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Dark weathered asphalt
    ctx.fillStyle = '#232528';
    ctx.fillRect(0, 0, 512, 2048);

    // Asphalt noise & grain
    const imgData = ctx.getImageData(0, 0, 512, 2048);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 16;
      data[i] = Math.min(255, Math.max(0, data[i] + grain));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain));
    }
    ctx.putImageData(imgData, 0, 0);

    // White threshold bars (piano keys) at both ends
    ctx.fillStyle = '#ffffff';
    const numBars = 10;
    const barWidth = 24;
    const barGap = 16;
    const totalBarsWidth = numBars * barWidth + (numBars - 1) * barGap;
    const startX = (512 - totalBarsWidth) / 2;

    // Threshold North
    for (let i = 0; i < numBars; i++) {
      ctx.fillRect(startX + i * (barWidth + barGap), 30, barWidth, 120);
    }
    // Threshold South
    for (let i = 0; i < numBars; i++) {
      ctx.fillRect(startX + i * (barWidth + barGap), 2048 - 150, barWidth, 120);
    }

    // Runway designator numbers: "09" and "27"
    ctx.font = 'bold 72px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(256, 210);
    ctx.fillText('09', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(256, 2048 - 210);
    ctx.rotate(Math.PI);
    ctx.fillText('27', 0, 0);
    ctx.restore();

    // Aiming point marking blocks (large solid rectangles)
    ctx.fillRect(140, 360, 50, 180);
    ctx.fillRect(322, 360, 50, 180);
    ctx.fillRect(140, 2048 - 540, 50, 180);
    ctx.fillRect(322, 2048 - 540, 50, 180);

    // Touchdown zone skid marks (black rubber tracks)
    ctx.fillStyle = 'rgba(10, 10, 12, 0.45)';
    for (let i = 0; i < 40; i++) {
      const rw1 = 8 + Math.random() * 14;
      const rx1 = 155 + (Math.random() - 0.5) * 30;
      const ry1 = 300 + Math.random() * 350;
      ctx.fillRect(rx1, ry1, rw1, 60 + Math.random() * 120);

      const rx2 = 335 + (Math.random() - 0.5) * 30;
      const ry2 = 300 + Math.random() * 350;
      ctx.fillRect(rx2, ry2, rw1, 60 + Math.random() * 120);

      // South touchdown zone
      ctx.fillRect(rx1, 2048 - ry1 - 120, rw1, 60 + Math.random() * 120);
      ctx.fillRect(rx2, 2048 - ry2 - 120, rw1, 60 + Math.random() * 120);
    }

    // Centerline dashed white stripes - frequent dashes for clear motion cues
    ctx.fillStyle = '#ffffff';
    const stripeLength = 22;
    const stripeGap = 16;
    const stripeWidth = 10;
    for (let y = 160; y < 2048 - 160; y += (stripeLength + stripeGap)) {
      ctx.fillRect(256 - stripeWidth / 2, y, stripeWidth, stripeLength);
    }

    // White continuous edge lines
    ctx.fillRect(24, 0, 8, 2048);
    ctx.fillRect(512 - 32, 0, 8, 2048);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  _createRunwaySurface() {
    const geo = new THREE.PlaneGeometry(this.width, this.length);
    geo.rotateX(-Math.PI / 2);

    const tex = this._createRunwayTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.15, 0);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Shoulder / blast pads
    const shoulderGeo = new THREE.PlaneGeometry(this.width + 24, this.length + 80);
    shoulderGeo.rotateX(-Math.PI / 2);
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.95
    });
    const shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderMesh.position.set(0, 0.1, 0);
    shoulderMesh.receiveShadow = true;
    this.group.add(shoulderMesh);
  }

  _createTaxiways() {
    // Parallel taxiway along East side
    const taxiwayGeo = new THREE.PlaneGeometry(30, this.length);
    taxiwayGeo.rotateX(-Math.PI / 2);
    const taxiwayMat = new THREE.MeshStandardMaterial({
      color: 0x282a2e,
      roughness: 0.88
    });
    const taxiway = new THREE.Mesh(taxiwayGeo, taxiwayMat);
    taxiway.position.set(90, 0.12, 0);
    taxiway.receiveShadow = true;
    this.group.add(taxiway);

    // High speed exit connectors (3 connectors)
    [-1000, 0, 1000].forEach((zPos) => {
      const connGeo = new THREE.PlaneGeometry(60, 24);
      connGeo.rotateX(-Math.PI / 2);
      const conn = new THREE.Mesh(connGeo, taxiwayMat);
      conn.position.set(45, 0.13, zPos);
      conn.receiveShadow = true;
      this.group.add(conn);
    });

    // Apron / parking ramp
    const apronGeo = new THREE.PlaneGeometry(160, 800);
    apronGeo.rotateX(-Math.PI / 2);
    const apron = new THREE.Mesh(apronGeo, taxiwayMat);
    apron.position.set(200, 0.12, 0);
    apron.receiveShadow = true;
    this.group.add(apron);
  }

  _createRunwayLighting() {
    const edgeGeo = new THREE.SphereGeometry(0.35, 6, 6);
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2288ff });

    const halfLen = this.length / 2;
    const halfWidth = this.width / 2;

    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // Edge lights with vertical posts (spaced every 30m for vivid motion parallax)
    for (let z = -halfLen; z <= halfLen; z += 30) {
      // Left edge post & bulb
      const p1 = new THREE.Mesh(postGeo, postMat);
      p1.position.set(-halfWidth - 1.2, 0.35, z);
      this.group.add(p1);

      const l1 = new THREE.Mesh(edgeGeo, whiteMat);
      l1.position.set(-halfWidth - 1.2, 0.75, z);
      this.group.add(l1);

      // Right edge post & bulb
      const p2 = new THREE.Mesh(postGeo, postMat);
      p2.position.set(halfWidth + 1.2, 0.35, z);
      this.group.add(p2);

      const l2 = new THREE.Mesh(edgeGeo, whiteMat);
      l2.position.set(halfWidth + 1.2, 0.75, z);
      this.group.add(l2);
    }

    // Runway Distance Remaining Signs (black box signs along left/right edge every 250m)
    const signGeo = new THREE.BoxGeometry(1.2, 1.4, 0.3);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let z = -1250; z <= 1250; z += 250) {
      const signL = new THREE.Mesh(signGeo, signMat);
      signL.position.set(-halfWidth - 4.0, 0.7, z);
      this.group.add(signL);

      const signR = new THREE.Mesh(signGeo, signMat);
      signR.position.set(halfWidth + 4.0, 0.7, z);
      this.group.add(signR);
    }

    // Threshold lights North (Green entry) & South (Red end)
    for (let x = -halfWidth; x <= halfWidth; x += 6) {
      const t1 = new THREE.Mesh(edgeGeo, greenMat);
      t1.position.set(x, 0.4, -halfLen);
      this.group.add(t1);

      const t2 = new THREE.Mesh(edgeGeo, redMat);
      t2.position.set(x, 0.4, halfLen);
      this.group.add(t2);
    }

    // Taxiway edge lights (Blue)
    for (let z = -halfLen; z <= halfLen; z += 50) {
      const tb1 = new THREE.Mesh(edgeGeo, blueMat);
      tb1.position.set(106, 0.4, z);
      this.group.add(tb1);

      const tb2 = new THREE.Mesh(edgeGeo, blueMat);
      tb2.position.set(74, 0.4, z);
      this.group.add(tb2);
    }

    // Approach Lighting System (ALS) extending 400m before runway 09 threshold
    for (let z = -halfLen - 400; z < -halfLen; z += 50) {
      for (let offset = -12; offset <= 12; offset += 6) {
        const strobe = new THREE.Mesh(edgeGeo, whiteMat);
        strobe.position.set(offset, 0.5, z);
        this.group.add(strobe);
        this.approachStrobes.push(strobe);
      }
    }
  }

  _createPAPI() {
    // 4 PAPI indicator lights installed beside runway at Z = -1200m (Touchdown zone)
    const papiX = -this.width / 2 - 14;
    const papiZ = -1200;

    const housingGeo = new THREE.BoxGeometry(1.2, 0.6, 1.2);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0xdddd00 }); // Aviation yellow
    const bulbGeo = new THREE.SphereGeometry(0.35, 8, 8);

    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(housingGeo, housingMat);
      box.position.set(papiX - (i * 3.5), 0.4, papiZ);
      this.group.add(box);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(papiX - (i * 3.5), 0.55, papiZ + 0.6);
      this.group.add(bulb);

      this.papiLights.push({
        mesh: bulb,
        material: bulbMat,
        angleThreshold: 2.6 + (i * 0.25) // 2.6°, 2.85°, 3.1°, 3.35°
      });
    }
  }

  _createAirportBuildings() {
    // 1. Control Tower
    const towerGroup = new THREE.Group();
    towerGroup.position.set(220, 0, -400);

    // Tower base shaft
    const shaftGeo = new THREE.CylinderGeometry(4.5, 6.5, 60, 16);
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 });
    const shaft = new THREE.Mesh(shaftGeo, concreteMat);
    shaft.position.y = 30;
    shaft.castShadow = true;
    towerGroup.add(shaft);

    // Control cab (glass observation deck)
    const cabGeo = new THREE.CylinderGeometry(9, 6.5, 8, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75
    });
    const cab = new THREE.Mesh(cabGeo, glassMat);
    cab.position.y = 64;
    towerGroup.add(cab);

    // Roof & radar dome
    const domeGeo = new THREE.SphereGeometry(3.5, 12, 12);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 70;
    towerGroup.add(dome);

    // Rotating aerodrome beacon
    const beaconGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.beaconLight = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconLight.position.y = 74;
    towerGroup.add(this.beaconLight);

    this.group.add(towerGroup);

    // 2. Large Hangars
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x6e7882, roughness: 0.5, metalness: 0.5 });
    [-200, 200].forEach((zOff) => {
      const hangarGroup = new THREE.Group();
      hangarGroup.position.set(240, 0, zOff);

      const archGeo = new THREE.CylinderGeometry(25, 25, 90, 24, 1, false, 0, Math.PI);
      archGeo.rotateZ(Math.PI / 2);
      archGeo.rotateY(Math.PI / 2);
      const hangar = new THREE.Mesh(archGeo, hangarMat);
      hangar.position.y = 0;
      hangar.castShadow = true;
      hangarGroup.add(hangar);

      this.group.add(hangarGroup);
    });

    // 3. Windsock
    const sockGroup = new THREE.Group();
    sockGroup.position.set(-60, 0, -800);
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8);
    const pole = new THREE.Mesh(poleGeo, concreteMat);
    pole.position.y = 4;
    sockGroup.add(pole);

    const coneGeo = new THREE.ConeGeometry(0.8, 4, 8);
    coneGeo.rotateX(-Math.PI / 2);
    const sockMat = new THREE.MeshStandardMaterial({ color: 0xff4400 });
    const sock = new THREE.Mesh(coneGeo, sockMat);
    sock.position.set(0, 8, 2);
    sockGroup.add(sock);
    this.group.add(sockGroup);
  }

  _createDistanceMarkers() {
    // Tall vivid side markers every 100m from -1400 to +1400
    // These scroll past camera giving clear motion parallax
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.5, 8);
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const whiteMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const halfW = this.width / 2;

    for (let z = -1400; z <= 1400; z += 100) {
      const isHundred = (Math.abs(z) % 500 === 0);
      const mat = isHundred ? orangeMat : whiteMat2;

      // Left side pole
      const pL = new THREE.Mesh(poleGeo, mat);
      pL.position.set(-halfW - 6, 2.25, z);
      this.group.add(pL);

      // Right side pole
      const pR = new THREE.Mesh(poleGeo, mat);
      pR.position.set(halfW + 6, 2.25, z);
      this.group.add(pR);

      // Top cap ball
      const capGeo = new THREE.SphereGeometry(0.35, 8, 6);
      const capL = new THREE.Mesh(capGeo, mat);
      capL.position.set(-halfW - 6, 4.7, z);
      this.group.add(capL);
      const capR = new THREE.Mesh(capGeo, mat);
      capR.position.set(halfW + 6, 4.7, z);
      this.group.add(capR);
    }

    // Trees alongside runway for depth parallax
    const trunkGeo  = new THREE.CylinderGeometry(0.3, 0.5, 5, 7);
    const crownGeo  = new THREE.ConeGeometry(2.5, 7, 7);
    const trunkMat  = new THREE.MeshStandardMaterial({ color: 0x5c3d1a });
    const crownMat  = new THREE.MeshStandardMaterial({ color: 0x1a6b1a });

    for (let z = -1400; z <= 1400; z += 40) {
      [-100, 100].forEach(xOff => {
        const jx = xOff + (Math.random() - 0.5) * 10;
        const jz = z + (Math.random() - 0.5) * 15;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(jx, 2.5, jz);
        this.group.add(trunk);
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(jx, 8.0, jz);
        this.group.add(crown);
      });
    }
  }

  update(dt, aircraftPos) {
    // Rotate beacon light on tower
    if (this.beaconLight) {
      const t = Date.now() * 0.003;
      this.beaconLight.material.color.setHex(Math.sin(t) > 0 ? 0x00ff66 : 0xffffff);
    }

    // Dynamic PAPI glideslope calculation
    // Aircraft approach angle to touchdown zone (-1200m Z, 0m Y)
    if (aircraftPos && this.papiLights.length > 0) {
      const dz = aircraftPos.z - (-1200);
      const dy = aircraftPos.y;
      if (dz < -50) {
        // Approaching from North (negative Z)
        const distance = Math.abs(dz);
        const glideAngleDeg = THREE.MathUtils.radToDeg(Math.atan2(dy, distance));

        this.papiLights.forEach((papi) => {
          if (glideAngleDeg > papi.angleThreshold) {
            // Above angle: White light
            papi.material.color.setHex(0xffffff);
          } else {
            // Below angle: Red light
            papi.material.color.setHex(0xff2222);
          }
        });
      }
    }
  }
}
