import * as THREE from 'three';

/**
 * Partículas baratas: un único THREE.Points con un pool fijo (sin crear objetos por frame).
 * Se usan para chispas de impacto en zombis, polvo en paredes y el estallido al recoger cajas.
 */
export class ParticleSystem {
  constructor(scene, capacity = 320) {
    this.scene = scene;
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseColor = new Float32Array(capacity * 3);
    this.gravity = new Float32Array(capacity);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.positions.fill(0, 0, this.positions.length);
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  /** Emite `count` partículas desde `pos` con velocidad aleatoria `speed`. */
  emit(pos, count, color, speed = 3, life = 0.5, gravity = 6, up = 0.5) {
    this._c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.positions[i * 3] = pos.x; this.positions[i * 3 + 1] = pos.y; this.positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + up * 0.5;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.velocities[i * 3] = Math.cos(a) * s * (1 - e * 0.4);
      this.velocities[i * 3 + 1] = e * s;
      this.velocities[i * 3 + 2] = Math.sin(a) * s * (1 - e * 0.4);
      this.baseColor[i * 3] = this._c.r; this.baseColor[i * 3 + 1] = this._c.g; this.baseColor[i * 3 + 2] = this._c.b;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.gravity[i] = gravity;
    }
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) { this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0; continue; }
      this.life[i] -= dt;
      this.velocities[i * 3 + 1] -= this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.colors[i * 3] = this.baseColor[i * 3] * f;
      this.colors[i * 3 + 1] = this.baseColor[i * 3 + 1] * f;
      this.colors[i * 3 + 2] = this.baseColor[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.colors.fill(0);
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
