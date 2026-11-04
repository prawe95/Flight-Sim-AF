import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export const TimeOfDay = {
  DAY: 'DAY',
  SUNSET: 'SUNSET',
  NIGHT: 'NIGHT'
};

/**
 * Dynamic Environment
 * Manages Sky shader, atmospheric scattering, sun/moon lighting,
 * procedural clouds, and time of day transitions.
 */
export class Environment {
  constructor(scene) {
    this.scene = scene;

    this.timeOfDay = TimeOfDay.DAY;

    this.sun = new THREE.Vector3();
    this.sky = null;
    this.dirLight = null;
    this.hemiLight = null;
    this.ambientLight = null;

    this.cloudsGroup = new THREE.Group();
    this.cloudList = [];

    this._initSky();
    this._initLighting();
    this._initClouds();
    this.setTimeOfDay(TimeOfDay.DAY);
  }

  _initSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8.0;
    uniforms['rayleigh'].value = 2.0;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;
  }

  _initLighting() {
    // Hemisphere light for soft ambient sky/ground bounce
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x445544, 0.6);
    this.hemiLight.position.set(0, 500, 0);
    this.scene.add(this.hemiLight);

    // Directional sunlight casting shadows
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 4000;
    this.dirLight.shadow.camera.left = -400;
    this.dirLight.shadow.camera.right = 400;
    this.dirLight.shadow.camera.top = 400;
    this.dirLight.shadow.camera.bottom = -400;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Subtle ambient light
    this.ambientLight = new THREE.AmbientLight(0x334455, 0.3);
    this.scene.add(this.ambientLight);

    // Fog for atmospheric depth
    this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.00012);
  }

  _initClouds() {
    this.scene.add(this.cloudsGroup);

    // Create stylized puffy cloud clusters
    const cloudGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
      transparent: true,
      opacity: 0.9
    });

    const numClouds = 60;
    const spreadX = 14000;
    const spreadZ = 14000;

    for (let i = 0; i < numClouds; i++) {
      const cluster = new THREE.Group();
      const numPuffs = 6 + Math.floor(Math.random() * 8);
      const baseScale = 70 + Math.random() * 80;

      for (let j = 0; j < numPuffs; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        const offsetX = (Math.random() - 0.5) * baseScale * 2.2;
        const offsetY = (Math.random() - 0.5) * baseScale * 0.4;
        const offsetZ = (Math.random() - 0.5) * baseScale * 1.6;
        const puffScale = (0.5 + Math.random() * 0.7) * baseScale;

        puff.position.set(offsetX, offsetY, offsetZ);
        puff.scale.set(puffScale * 1.4, puffScale * 0.6, puffScale);
        cluster.add(puff);
      }

      cluster.position.set(
        (Math.random() - 0.5) * spreadX,
        1200 + Math.random() * 400, // Clouds float at 1200m - 1600m
        (Math.random() - 0.5) * spreadZ
      );

      this.cloudsGroup.add(cluster);
      this.cloudList.push(cluster);
    }
  }

  setTimeOfDay(time) {
    this.timeOfDay = time;
    const uniforms = this.sky.material.uniforms;

    let elevation = 45;
    let azimuth = 180;
    let sunColor = 0xffffff;
    let sunIntensity = 1.4;
    let hemiSky = 0xffffff;
    let hemiGround = 0x445544;
    let fogColor = 0xcce0ff;
    let fogDensity = 0.00010;

    if (time === TimeOfDay.DAY) {
      elevation = 55;
      azimuth = 160;
      sunColor = 0xfffaed;
      sunIntensity = 1.5;
      hemiSky = 0xe8f4ff;
      hemiGround = 0x3d5236;
      fogColor = 0xcfe2f3;
      uniforms['turbidity'].value = 6;
      uniforms['rayleigh'].value = 1.8;
    } else if (time === TimeOfDay.SUNSET) {
      elevation = 3.5;
      azimuth = 240;
      sunColor = 0xff8c42;
      sunIntensity = 1.3;
      hemiSky = 0xff9977;
      hemiGround = 0x2e2025;
      fogColor = 0xfaaf78;
      fogDensity = 0.00013;
      uniforms['turbidity'].value = 10;
      uniforms['rayleigh'].value = 3.5;
    } else if (time === TimeOfDay.NIGHT) {
      elevation = -12;
      azimuth = 200;
      sunColor = 0x223355;
      sunIntensity = 0.15;
      hemiSky = 0x0a1020;
      hemiGround = 0x05070a;
      fogColor = 0x060c18;
      fogDensity = 0.00014;
      uniforms['turbidity'].value = 15;
      uniforms['rayleigh'].value = 0.5;
    }

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(this.sun);

    // Update lights
    this.dirLight.color.setHex(sunColor);
    this.dirLight.intensity = sunIntensity;
    this.hemiLight.color.setHex(hemiSky);
    this.hemiLight.groundColor.setHex(hemiGround);

    this.scene.fog.color.setHex(fogColor);
    this.scene.fog.density = fogDensity;
  }

  update(dt, targetPosition) {
    // Keep directional sunlight tracking near the aircraft for crisp shadows
    if (targetPosition) {
      this.dirLight.position.set(
        targetPosition.x + this.sun.x * 1200,
        targetPosition.y + Math.max(100, this.sun.y * 1200),
        targetPosition.z + this.sun.z * 1200
      );
      this.dirLight.target.position.copy(targetPosition);
    }

    // Slowly drift clouds across the sky
    const windSpeed = 8.0; // m/s
    for (let i = 0; i < this.cloudList.length; i++) {
      const c = this.cloudList[i];
      c.position.x += windSpeed * dt;
      if (c.position.x > 8000) {
        c.position.x = -8000;
      }
    }
  }
}
