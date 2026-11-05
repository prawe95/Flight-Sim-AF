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

    // Destruction state / effects
    this.destroyedCount = 0;
    this.debris = [];
    this.debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    this.debrisMat = new THREE.MeshStandardMaterial({
      color: 0x2c2925,
      roughness: 0.95,
      metalness: 0.08
    });
    this.scorchedMat = new THREE.MeshStandardMaterial({
      color: 0x171412,
      roughness: 1.0,
      metalness: 0.05
    });

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
          let spire = null;
          let beacon = null;
          if (bH > 180) {
            const spireHeight = 25 + Math.random() * 35;
            const spireGeo = new THREE.CylinderGeometry(0.5, 2.0, spireHeight, 8);
            spire = new THREE.Mesh(spireGeo, concreteMat);
            spire.position.set(posX, bH + spireHeight / 2, posZ);
            this.group.add(spire);

            beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(posX, bH + spireHeight + 1, posZ);
            this.group.add(beacon);
            this.warningLights.push(beacon);
          }

          // Register collision bounding box (AABB) and destructible building state
          this.buildingColliders.push({
            minX: posX - bW / 2,
            maxX: posX + bW / 2,
            minZ: posZ - bD / 2,
            maxZ: posZ + bD / 2,
            height: bH + (bH > 180 ? 40 : 5),
            maxHeight: bH,
            width: bW,
            depth: bD,
            centerX: posX,
            centerZ: posZ,
            mesh: tower,
            roof,
            spire,
            beacon,
            health: 100,
            destroyed: false,
            collapsing: false,
            collapseTime: 0
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

  /**
   * Sweep-test a bullet path against every building AABB.
   * Returns the nearest hit so fast projectiles cannot tunnel through towers.
   */
  raycastSegment(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;

    let best = null;
    let bestT = Infinity;

    for (let i = 0; i < this.buildingColliders.length; i++) {
      const b = this.buildingColliders[i];
      const t = this._segmentAabb(from, dx, dy, dz, b);
      if (t !== null && t < bestT) {
        bestT = t;
        best = b;
      }
    }

    if (!best) return null;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      building: best,
      t: bestT,
      distance: bestT * length,
      point: new THREE.Vector3(
        from.x + dx * bestT,
        from.y + dy * bestT,
        from.z + dz * bestT
      )
    };
  }

  _segmentAabb(origin, dx, dy, dz, b) {
    const o = [origin.x, origin.y, origin.z];
    const d = [dx, dy, dz];
    const min = [b.minX, 0, b.minZ];
    const max = [b.maxX, b.height, b.maxZ];

    let tmin = 0;
    let tmax = 1;

    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(d[axis]) < 1e-9) {
        if (o[axis] < min[axis] || o[axis] > max[axis]) return null;
        continue;
      }

      let t1 = (min[axis] - o[axis]) / d[axis];
      let t2 = (max[axis] - o[axis]) / d[axis];
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }

      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    return tmin;
  }

  /**
   * Apply bullet damage to a building. Towers collapse once their health is gone.
   */
  damageBuilding(building, amount, hitPoint) {
    if (!building || building.destroyed) {
      return { destroyed: false };
    }

    building.health -= amount;

    if (building.health <= 0) {
      building.destroyed = true;
      building.collapsing = true;
      building.collapseTime = 0;
      this.destroyedCount++;

      // Scorch the tower, snap off its rooftop details and throw debris
      building.mesh.material = this.scorchedMat;
      if (building.roof) building.roof.visible = false;
      if (building.spire) building.spire.visible = false;
      if (building.beacon) {
        building.beacon.visible = false;
        const idx = this.warningLights.indexOf(building.beacon);
        if (idx >= 0) this.warningLights.splice(idx, 1);
      }

      this._spawnBuildingDebris(building);
      return { destroyed: true };
    }

    return { destroyed: false, health: building.health };
  }

  _spawnBuildingDebris(building) {
    const count = 10 + Math.floor(Math.random() * 7);
    const spread = Math.max(building.width, building.depth) * 0.6;

    for (let i = 0; i < count; i++) {
      const chunk = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      const size = 2 + Math.random() * 7;
      chunk.scale.set(size, size * (0.6 + Math.random()), size);
      chunk.position.set(
        building.centerX + (Math.random() - 0.5) * building.width,
        6 + Math.random() * building.maxHeight * 0.45,
        building.centerZ + (Math.random() - 0.5) * building.depth
      );
      chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      chunk.castShadow = true;
      this.group.add(chunk);

      this.debris.push({
        mesh: chunk,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * spread * 0.9,
          8 + Math.random() * 22,
          (Math.random() - 0.5) * spread * 0.9
        ),
        angular: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        ),
        life: 4.5 + Math.random() * 3.0
      });
    }
  }

  _updateDestruction(dt) {
    for (let i = 0; i < this.buildingColliders.length; i++) {
      const b = this.buildingColliders[i];
      if (!b.collapsing) continue;

      b.collapseTime += dt;
      const t = Math.min(1, b.collapseTime / 2.4);
      const eased = 1 - Math.pow(1 - t, 3);
      const scaleY = THREE.MathUtils.lerp(1, 0.12, eased);

      b.mesh.scale.y = b.maxHeight * scaleY;
      b.mesh.position.y = (b.maxHeight * scaleY) / 2;
      b.mesh.rotation.z = 0.05 * eased;
      b.height = b.maxHeight * scaleY;

      if (t >= 1) {
        b.collapsing = false;
      }
    }
  }

  _updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;

      d.velocity.y -= 26 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.angular.x * dt;
      d.mesh.rotation.y += d.angular.y * dt;
      d.mesh.rotation.z += d.angular.z * dt;

      // Settle on the street instead of falling through it
      if (d.mesh.position.y < 1.5) {
        d.mesh.position.y = 1.5;
        d.velocity.multiplyScalar(0.35);
        d.velocity.y = Math.abs(d.velocity.y) * 0.3;
        d.angular.multiplyScalar(0.8);
        d.life -= dt * 2.0;
      }

      if (d.life <= 0) {
        this.group.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }
  }

  update(dt) {
    // Animate collapsing towers and falling debris
    this._updateDestruction(dt);
    this._updateDebris(dt);

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
