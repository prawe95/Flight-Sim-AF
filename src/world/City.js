import * as THREE from 'three';

/**
 * Modern Metropolis City Generator
 * Creates downtown skyscrapers, mid-rise office blocks, antenna towers with
 * flashing warning lights, rooftop helipads, road grid, and traffic light streams.
 */
export class City {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // City bounding boxes for flight collision detection
    this.buildingColliders = [];

    // Animated warning beacons & traffic
    this.warningLights = [];
    this.trafficCars = [];

    // City placement area (West of runway, spanning X: -2800 to -700, Z: -2200 to 1800)
    this.originX = -1800;
    this.originZ = 0;
    this.cityWidth = 2400; // X spread
    this.cityLength = 3600; // Z spread

    this._createBuildings();
    this._createRoads();
    this._createTraffic();
  }

  _createFacadeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base building concrete/steel color
    ctx.fillStyle = '#1c242c';
    ctx.fillRect(0, 0, 512, 1024);

    // Glass curtain windows
    const cols = 16;
    const rows = 48;
    const colW = 512 / cols;
    const rowH = 1024 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLit = Math.random() > 0.45;
        if (isLit) {
          // Warm interior office lights
          const warmTones = ['#fffae0', '#ffe8a8', '#d0e8ff', '#94c2ff', '#ffe0b2'];
          ctx.fillStyle = warmTones[Math.floor(Math.random() * warmTones.length)];
        } else {
          // Dark glass tint
          ctx.fillStyle = '#0f161e';
        }
        ctx.fillRect(c * colW + 4, r * rowH + 3, colW - 8, rowH - 6);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  _createBuildings() {
    const facadeTex = this._createFacadeTexture();

    const glassMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.25,
      metalness: 0.75
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x454b54,
      roughness: 0.85,
      metalness: 0.15
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x22262b,
      roughness: 0.9
    });

    const beaconGeo = new THREE.SphereGeometry(1.2, 6, 6);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // City grid: blocks of buildings
    const blockSizeX = 140;
    const blockSizeZ = 160;
    const roadWidth = 35;

    const startX = this.originX - this.cityWidth / 2;
    const endX = this.originX + this.cityWidth / 2;
    const startZ = this.originZ - this.cityLength / 2;
    const endZ = this.originZ + this.cityLength / 2;

    for (let x = startX; x < endX; x += (blockSizeX + roadWidth)) {
      for (let z = startZ; z < endZ; z += (blockSizeZ + roadWidth)) {
        // Distance to city center affects building height (tallest in center)
        const distFromCenter = Math.hypot(x - this.originX, z - this.originZ);
        const centerFactor = Math.max(0.15, 1.0 - (distFromCenter / 2000));

        // Subdivide block into 2 to 4 towers
        const numTowers = 2 + Math.floor(Math.random() * 3);

        for (let t = 0; t < numTowers; t++) {
          const bW = 35 + Math.random() * 30;
          const bD = 35 + Math.random() * 30;
          // Skyscraper heights: 70m to 420m
          const bH = (70 + Math.random() * 220 + (centerFactor * 160)) * (0.8 + Math.random() * 0.4);

          const posX = x + (Math.random() - 0.5) * (blockSizeX - bW);
          const posZ = z + (Math.random() - 0.5) * (blockSizeZ - bD);

          // Main tower body
          const tower = new THREE.Mesh(boxGeo, glassMat);
          tower.scale.set(bW, bH, bD);
          tower.position.set(posX, bH / 2, posZ);
          tower.castShadow = true;
          tower.receiveShadow = true;
          this.group.add(tower);

          // Roof detail
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(bW * 0.7, 5, bD * 0.7);
          roof.position.set(posX, bH + 2.5, posZ);
          this.group.add(roof);

          // Tall towers get spires & flashing red warning beacons
          if (bH > 180) {
            const spireHeight = 25 + Math.random() * 35;
            const spireGeo = new THREE.CylinderGeometry(0.5, 2.0, spireHeight, 8);
            const spire = new THREE.Mesh(spireGeo, concreteMat);
            spire.position.set(posX, bH + spireHeight / 2, posZ);
            this.group.add(spire);

            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(posX, bH + spireHeight + 1, posZ);
            this.group.add(beacon);
            this.warningLights.push(beacon);
          }

          // Register collision bounding box (AABB)
          this.buildingColliders.push({
            minX: posX - bW / 2,
            maxX: posX + bW / 2,
            minZ: posZ - bD / 2,
            maxZ: posZ + bD / 2,
            height: bH + (bH > 180 ? 40 : 5)
          });
        }
      }
    }
  }

  _createRoads() {
    // City asphalt ground plane
    const roadGeo = new THREE.PlaneGeometry(this.cityWidth + 200, this.cityLength + 200);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1f2329,
      roughness: 0.95
    });

    const roadBase = new THREE.Mesh(roadGeo, roadMat);
    roadBase.position.set(this.originX, 0.08, this.originZ);
    roadBase.receiveShadow = true;
    this.group.add(roadBase);
  }

  _createTraffic() {
    // Animated traffic headlights & taillights streaming on major boulevards
    const carCount = 80;
    const carGeo = new THREE.BoxGeometry(2, 1, 4);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 }); // White headlight
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 }); // Red taillight

    for (let i = 0; i < carCount; i++) {
      const isEastWest = Math.random() > 0.5;
      const speed = (20 + Math.random() * 25);
      const direction = Math.random() > 0.5 ? 1 : -1;

      const mat = direction > 0 ? headMat : tailMat;
      const car = new THREE.Mesh(carGeo, mat);

      if (isEastWest) {
        car.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.position.set(
          this.originX + (Math.random() - 0.5) * this.cityWidth,
          1.0,
          this.originZ + (Math.floor(Math.random() * 12) - 6) * 220
        );
      } else {
        car.rotation.y = direction > 0 ? 0 : Math.PI;
        car.position.set(
          this.originX + (Math.floor(Math.random() * 10) - 5) * 200,
          1.0,
          this.originZ + (Math.random() - 0.5) * this.cityLength
        );
      }

      this.group.add(car);
      this.trafficCars.push({
        mesh: car,
        isEastWest,
        speed: speed * direction,
        boundsMin: isEastWest ? this.originX - this.cityWidth / 2 : this.originZ - this.cityLength / 2,
        boundsMax: isEastWest ? this.originX + this.cityWidth / 2 : this.originZ + this.cityLength / 2
      });
    }
  }

  checkCollision(planePos, radius = 4.0) {
    const px = planePos.x;
    const py = planePos.y;
    const pz = planePos.z;

    for (let i = 0; i < this.buildingColliders.length; i++) {
      const b = this.buildingColliders[i];
      if (
        px + radius >= b.minX && px - radius <= b.maxX &&
        pz + radius >= b.minZ && pz - radius <= b.maxZ &&
        py - radius <= b.height
      ) {
        return true;
      }
    }
    return false;
  }

  update(dt) {
    // Flash red obstacle warning beacons on skyscrapers
    const t = Date.now() * 0.004;
    const isLit = (Math.sin(t) > 0.2);
    for (let i = 0; i < this.warningLights.length; i++) {
      this.warningLights[i].visible = isLit;
    }

    // Animate city traffic cars
    for (let i = 0; i < this.trafficCars.length; i++) {
      const car = this.trafficCars[i];
      if (car.isEastWest) {
        car.mesh.position.x += car.speed * dt;
        if (car.mesh.position.x > car.boundsMax) car.mesh.position.x = car.boundsMin;
        if (car.mesh.position.x < car.boundsMin) car.mesh.position.x = car.boundsMax;
      } else {
        car.mesh.position.z += car.speed * dt;
        if (car.mesh.position.z > car.boundsMax) car.mesh.position.z = car.boundsMin;
        if (car.mesh.position.z < car.boundsMin) car.mesh.position.z = car.boundsMax;
      }
    }
  }
}
