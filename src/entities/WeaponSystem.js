import * as THREE from 'three';

const BULLET_SPEED = 900;        // m/s muzzle velocity
const BULLET_LIFE = 2.4;         // seconds before the tracer is recycled
const BULLET_GRAVITY = 9.80665;  // slight ballistic drop
const BULLET_DAMAGE = 100;       // a direct hit wrecks a tower
const FIRE_INTERVAL = 0.085;     // ~700 rounds per minute
const RELOAD_TIME = 1.6;
const AMMO_MAX = 600;
const MAX_BULLETS = 100;
const MAX_GROUND_MARKS = 90;

/**
 * WeaponSystem
 * Twin cannon fire, tracer projectiles, terrain impact scars, building damage
 * and destruction effects. Left mouse button fires; rounds inherit the
 * aircraft's velocity so they behave correctly at high speed.
 */
export class WeaponSystem {
  constructor(scene, airplane, city, terrain, audio) {
    this.scene = scene;
    this.airplane = airplane;
    this.city = city;
    this.terrain = terrain;
    this.audio = audio;

    this.ammo = AMMO_MAX;
    this.ammoMax = AMMO_MAX;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;

    this.gunSide = 1;
    this.effects = [];

    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._forward = new THREE.Vector3();
    this._muzzleLocal = new THREE.Vector3();
    this._muzzleWorld = new THREE.Vector3();
    this._from = new THREE.Vector3();
    this._to = new THREE.Vector3();

    this._createBullets();
    this._createGroundMarks();
    this._createEffectResources();
  }

  reset() {
    this.ammo = AMMO_MAX;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;

    for (let i = 0; i < this.bullets.length; i++) {
      this._deactivateBullet(this.bullets[i]);
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this._removeEffect(i);
    }
  }

  _createBullets() {
    const geo = new THREE.CylinderGeometry(0.075, 0.075, 3.2, 6);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.bulletGeo = geo;
    this.bulletMat = mat;
    this.bullets = [];

    for (let i = 0; i < MAX_BULLETS; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      this.bullets.push({
        mesh,
        active: false,
        velocity: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        life: 0
      });
    }
  }

  _createGroundMarkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Dark scorched crater with a warm rim
    const grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
    grad.addColorStop(0, 'rgba(8, 6, 4, 0.98)');
    grad.addColorStop(0.35, 'rgba(28, 20, 14, 0.92)');
    grad.addColorStop(0.68, 'rgba(72, 52, 34, 0.55)');
    grad.addColorStop(0.88, 'rgba(40, 30, 20, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();

    // Radial cracks around the impact
    ctx.strokeStyle = 'rgba(18, 13, 9, 0.7)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.25;
      const inner = 12 + Math.random() * 8;
      const outer = 34 + Math.random() * 24;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(angle) * inner, 64 + Math.sin(angle) * inner);
      ctx.lineTo(64 + Math.cos(angle) * outer, 64 + Math.sin(angle) * outer);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  _createGroundMarks() {
    const texture = this._createGroundMarkTexture();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });

    this.groundMarkGeo = geo;
    this.groundMarkMat = mat;
    this.groundMarks = [];
    this.groundMarkIndex = 0;

    for (let i = 0; i < MAX_GROUND_MARKS; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.groundMarks.push(mesh);
    }
  }

  _createEffectResources() {
    this.effectSphereGeo = new THREE.SphereGeometry(1, 8, 8);
  }

  _surfaceHeight(x, z) {
    const elevation = this.terrain.getElevation(x, z);
    // Rounds splash at the ocean surface instead of the sea floor
    if (elevation < -2.0) return -2.0;
    // City roads and the runway sit just above the terrain mesh
    return Math.max(elevation, 0.1);
  }

  _getFreeBullet() {
    for (let i = 0; i < this.bullets.length; i++) {
      if (!this.bullets[i].active) return this.bullets[i];
    }
    // Recycle the oldest active tracer if the pool is exhausted
    return this.bullets[0];
  }

  _deactivateBullet(bullet) {
    bullet.active = false;
    bullet.mesh.visible = false;
  }

  update(dt, input) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = AMMO_MAX;
      }
    }

    if (input && input.mouse) {
      if (input.mouse.leftDown || input.mouse.firePressed) {
        this._tryFire();
      }
      // The edge-triggered press only lasts for one frame
      input.mouse.firePressed = false;
    }

    this._updateBullets(dt);
    this._updateEffects(dt);
  }

  _tryFire() {
    const phys = this.airplane.physics;

    if (phys.isCrashed || this.reloading || this.ammo <= 0 || this.fireCooldown > 0) {
      return;
    }

    this.ammo--;
    this.fireCooldown = FIRE_INTERVAL;
    this.gunSide *= -1;

    // Plane model forward is +Z; alternate between left and right cannon
    this._forward.set(0, 0, 1).applyQuaternion(phys.quaternion).normalize();
    this._muzzleLocal.set(this.gunSide * 1.45, 0.05, 5.4);
    this._muzzleWorld.copy(this._muzzleLocal).applyQuaternion(phys.quaternion).add(phys.position);

    const bullet = this._getFreeBullet();
    bullet.active = true;
    bullet.life = BULLET_LIFE;
    bullet.prev.copy(this._muzzleWorld);
    bullet.mesh.position.copy(this._muzzleWorld);
    bullet.mesh.visible = true;

    // Inherit aircraft velocity plus muzzle velocity
    bullet.velocity.copy(phys.velocity).addScaledVector(this._forward, BULLET_SPEED);
    bullet.mesh.quaternion.setFromUnitVectors(this._zAxis, this._forward);

    this._spawnMuzzleFlash(this._muzzleWorld, this._forward);
    if (this.audio) this.audio.playGunSound();

    if (this.ammo <= 0) {
      this.reloading = true;
      this.reloadTimer = RELOAD_TIME;
    }
  }

  _updateBullets(dt) {
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      if (!bullet.active) continue;

      bullet.life -= dt;
      if (bullet.life <= 0) {
        this._deactivateBullet(bullet);
        continue;
      }

      // Sub-step fast tracers so they cannot tunnel through towers or terrain
      const travel = bullet.velocity.length() * dt;
      const steps = Math.min(8, Math.max(1, Math.ceil(travel / 22)));
      const subDt = dt / steps;
      let consumed = false;

      for (let s = 0; s < steps && !consumed; s++) {
        this._from.copy(bullet.mesh.position);
        bullet.velocity.y -= BULLET_GRAVITY * subDt;
        this._to.copy(this._from).addScaledVector(bullet.velocity, subDt);

        const buildingHit = this.city.raycastSegment(this._from, this._to);
        const groundHit = this._segmentGroundHit(this._from, this._to);

        if (buildingHit && (!groundHit || buildingHit.t <= groundHit.t)) {
          this._onBuildingHit(buildingHit);
          consumed = true;
        } else if (groundHit) {
          this._onGroundHit(groundHit.point);
          consumed = true;
        } else {
          bullet.mesh.position.copy(this._to);
        }
      }

      if (consumed) {
        this._deactivateBullet(bullet);
      } else {
        // Keep the tracer aligned with its current flight path
        this._forward.copy(bullet.velocity).normalize();
        bullet.mesh.quaternion.setFromUnitVectors(this._zAxis, this._forward);
      }
    }
  }

  _segmentGroundHit(from, to) {
    const groundFrom = this._surfaceHeight(from.x, from.z);
    const groundTo = this._surfaceHeight(to.x, to.z);

    if (from.y > groundFrom && to.y > groundTo) {
      return null;
    }

    let t = 0;
    if (from.y > groundFrom) {
      const denom = (from.y - groundFrom) - (to.y - groundTo);
      t = denom > 1e-6 ? (from.y - groundFrom) / denom : 0;
      t = THREE.MathUtils.clamp(t, 0, 1);
    }

    const point = new THREE.Vector3().lerpVectors(from, to, t);
    point.y = THREE.MathUtils.lerp(groundFrom, groundTo, t) + 0.02;
    return { t, point };
  }

  _onGroundHit(point) {
    this._spawnGroundMark(point);
    this._spawnDust(point);
    if (this.audio) this.audio.playImpactSound();
  }

  _onBuildingHit(hit) {
    const building = hit.building;
    const result = this.city.damageBuilding(building, BULLET_DAMAGE, hit.point);

    this._spawnSparks(hit.point, 0xffbb66, 4, 20);
    this._spawnSmoke(hit.point, 2.0 + Math.random() * 2.0, 0x3a332c, 0.45, 0.9);

    if (result.destroyed) {
      const size = Math.max(20, Math.min(55, building.width * 0.8));
      this._spawnExplosion(hit.point, size);
      if (this.audio) this.audio.playExplosionSound();
    } else if (this.audio) {
      this.audio.playImpactSound();
    }
  }

  _spawnGroundMark(point) {
    const mark = this.groundMarks[this.groundMarkIndex];
    this.groundMarkIndex = (this.groundMarkIndex + 1) % this.groundMarks.length;

    const size = 4.5 + Math.random() * 3.5;
    mark.position.set(point.x, this._surfaceHeight(point.x, point.z) + 0.08, point.z);
    mark.rotation.y = Math.random() * Math.PI * 2;
    mark.scale.set(size, 1, size);
    mark.visible = true;
  }

  _spawnMuzzleFlash(position, forward) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(this.effectSphereGeo, material);
    mesh.position.copy(position).addScaledVector(forward, 1.0);
    mesh.scale.setScalar(0.6 + Math.random() * 0.4);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: 0.07,
      maxLife: 0.07,
      velocity: null,
      gravity: 0,
      startScale: mesh.scale.x,
      endScale: mesh.scale.x * 3.0,
      opacity: 0.95,
      fadePower: 1
    });
  }

  _spawnSparks(position, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(this.effectSphereGeo, material);
      const size = 0.25 + Math.random() * 0.35;
      const life = 0.22 + Math.random() * 0.28;
      mesh.position.copy(position);
      mesh.scale.setScalar(size);
      this.scene.add(mesh);

      this.effects.push({
        mesh,
        life,
        maxLife: life,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          Math.random() * speed * 0.8,
          (Math.random() - 0.5) * speed
        ),
        gravity: 24,
        startScale: size,
        endScale: size * 0.25,
        opacity: 0.95,
        fadePower: 1
      });
    }
  }

  _spawnSmoke(position, size, color, opacity, life) {
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      roughness: 1.0
    });

    const mesh = new THREE.Mesh(this.effectSphereGeo, material);
    mesh.position.copy(position);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life,
      maxLife: life,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        1.5 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2.5
      ),
      gravity: -1.0,
      startScale: size,
      endScale: size * 4.0,
      opacity,
      fadePower: 1.5
    });
  }

  _spawnDust(point) {
    const material = new THREE.MeshStandardMaterial({
      color: 0x6a5944,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      roughness: 1.0
    });

    const mesh = new THREE.Mesh(this.effectSphereGeo, material);
    mesh.position.copy(point);
    mesh.scale.setScalar(1.4);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: 0.55,
      maxLife: 0.55,
      velocity: new THREE.Vector3(0, 3.0, 0),
      gravity: 2.0,
      startScale: 1.4,
      endScale: 6.0,
      opacity: 0.55,
      fadePower: 1.5
    });
  }

  _spawnExplosion(position, size) {
    // Bright expanding fireball
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(this.effectSphereGeo, material);
    mesh.position.copy(position);
    mesh.scale.setScalar(size * 0.25);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: 0.55,
      maxLife: 0.55,
      velocity: null,
      gravity: 0,
      startScale: size * 0.25,
      endScale: size * 1.5,
      opacity: 0.95,
      fadePower: 2
    });

    // Billowing smoke cloud around the collapsing tower
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Vector3(
        position.x + (Math.random() - 0.5) * size,
        position.y + (Math.random() - 0.5) * size * 0.5,
        position.z + (Math.random() - 0.5) * size
      );
      this._spawnSmoke(puff, size * 0.22, 0x2f2a25, 0.5, 1.4 + Math.random() * 1.2);
    }
  }

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;

      const k = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - k;

      if (effect.velocity) {
        effect.velocity.y -= effect.gravity * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
      }

      if (effect.endScale !== null) {
        const scale = effect.startScale + (effect.endScale - effect.startScale) * progress;
        effect.mesh.scale.setScalar(scale);
      }

      if (effect.mesh.material) {
        effect.mesh.material.opacity = effect.opacity * Math.pow(k, effect.fadePower);
      }

      if (effect.life <= 0) {
        this._removeEffect(i);
      }
    }
  }

  _removeEffect(index) {
    const effect = this.effects[index];
    this.scene.remove(effect.mesh);
    if (effect.mesh.material) effect.mesh.material.dispose();
    this.effects.splice(index, 1);
  }
}
