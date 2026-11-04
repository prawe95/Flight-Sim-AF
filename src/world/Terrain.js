import * as THREE from 'three';

/**
 * Terrain Generator
 * Creates vast realistic ground with flat airport plains, rolling hills,
 * distant mountains, and water body.
 */
export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.size = 24000; // 24km x 24km
    this.segments = 160;

    this.mesh = null;
    this.waterMesh = null;

    this._createTerrain();
    this._createWater();
  }

  /**
   * Elevation mathematical function
   * Flat in center for airport & metropolis (radius ~ 3200m).
   * Rolling hills beyond, high mountain ridges on north and east rims.
   */
  getElevation(x, z) {
    const distFromCenter = Math.sqrt(x * x + z * z);

    // Keep airport and downtown city flat
    if (distFromCenter < 3000) {
      return 0;
    }

    // Blend smoothly into hills
    const blend = THREE.MathUtils.clamp((distFromCenter - 3000) / 2500, 0, 1);

    // Mountain ridges on north (Z < -4000) and west (X < -4000)
    let height = 0;

    // Layer 1: Rolling hills
    height += Math.sin(x * 0.0008) * Math.cos(z * 0.0008) * 120;
    height += Math.sin(x * 0.002 + 1.2) * Math.sin(z * 0.002 + 0.8) * 45;

    // Layer 2: Big mountain ranges in Northwest and North
    if (z < -3500 || x < -3500) {
      const mWeight = Math.min(1.0, Math.max(0, (-z - 3500) / 3000) + Math.max(0, (-x - 3500) / 3000));
      const ridge = Math.abs(Math.sin(x * 0.0006) + Math.cos(z * 0.0006));
      height += ridge * 850 * mWeight;
    }

    // Ocean depression on East side (X > 4500)
    if (x > 4000) {
      const waterSlope = (x - 4000) / 2000;
      height -= waterSlope * 180;
    }

    return Math.max(-50, height * blend);
  }

  _createTerrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base lush green-olive field tone
    ctx.fillStyle = '#445e34';
    ctx.fillRect(0, 0, 1024, 1024);

    // Agricultural field grid & varied soil patches
    const gridSize = 64;
    const shades = ['#3f592f', '#496338', '#546b3e', '#5a6639', '#4d5d36', '#3b4e2c'];

    for (let gx = 0; gx < 1024; gx += gridSize) {
      for (let gy = 0; gy < 1024; gy += gridSize) {
        ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
        ctx.fillRect(gx + 1, gy + 1, gridSize - 2, gridSize - 2);

        // Subtle dirt track borders
        ctx.strokeStyle = 'rgba(70, 60, 45, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(gx, gy, gridSize, gridSize);
      }
    }

    // Noise mottling overlay
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    return texture;
  }

  _createTerrain() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const colorLow = new THREE.Color(0x3e562f);  // Valley green
    const colorMid = new THREE.Color(0x5c5a45);  // Mountain rock
    const colorSnow = new THREE.Color(0xecf0f1); // Snowcap

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getElevation(x, z);
      pos.setY(i, y);

      // Vertex color according to altitude
      const c = new THREE.Color();
      if (y < 250) {
        c.copy(colorLow);
      } else if (y < 650) {
        const t = (y - 250) / 400;
        c.lerpColors(colorLow, colorMid, t);
      } else {
        const t = Math.min(1.0, (y - 650) / 250);
        c.lerpColors(colorMid, colorSnow, t);
      }
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const groundTex = this._createTerrainTexture();

    const mat = new THREE.MeshStandardMaterial({
      map: groundTex,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: false
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  _createWater() {
    // Water bay on the East side
    const waterGeo = new THREE.PlaneGeometry(12000, 24000);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1b4353,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(10000, -2, 0);
    this.scene.add(this.waterMesh);
  }
}
