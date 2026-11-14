import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AMMO_BOXES } from './levelData.js';
import { mat, part } from './Props.js';

const WEAPON_COLORS = { rifle: 0xffb030, pistol: 0x40d0ff };

/**
 * Cajas de suministro de munición (RF10). Cada caja es para UN arma concreta (color distinto).
 * Se detectan por proximidad; al recogerse desaparecen con un efecto de partículas.
 */
export class Collectibles {
  /** @param {THREE.Scene} scene  @param {import('../systems/Effects.js').ParticleSystem} particles */
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.items = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this._beamGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 12, 1, true);
    this._ringGeo = new THREE.RingGeometry(0.75, 0.95, 28);
    this._beamMats = {};
    for (const [id, color] of Object.entries(WEAPON_COLORS)) {
      this._beamMats[id] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    }

    for (const def of AMMO_BOXES) this._create(def);
  }

  _create(def) {
    const color = WEAPON_COLORS[def.weapon] ?? 0xffffff;
    const g = new THREE.Group();
    const crate = new THREE.Group();
    part(crate, 0.75, 0.42, 0.5, 0, 0, 0, mat(0x3a4a2a, { rough: 0.8 }));
    part(crate, 0.78, 0.1, 0.52, 0, 0.1, 0, mat(color, { rough: 0.5, emissive: color, emissiveIntensity: 0.9 }), { cast: false });
    part(crate, 0.12, 0.08, 0.54, 0.2, 0.0, 0, mat(0x1a1a1a), { cast: false });
    crate.position.y = 0.9;
    g.add(crate);
    const beam = new THREE.Mesh(this._beamGeo, this._beamMats[def.weapon]);
    beam.position.y = 4.5;
    g.add(beam);
    const ring = new THREE.Mesh(this._ringGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    g.add(ring);
    g.position.set(def.x, 0, def.z);
    this.group.add(g);
    this.items.push({ def, group: g, crate, ring, collected: false, phase: Math.random() * 6.28, color });
  }

  /**
   * Anima las cajas y detecta recogidas.
   * @param {(item) => boolean} tryCollect callback: devuelve true si realmente se recogió (p. ej. si había espacio de munición)
   */
  update(dt, time, playerPos, tryCollect) {
    const r2 = CONFIG.COLLECTIBLES.pickupRadius ** 2;
    for (const it of this.items) {
      if (it.collected) continue;
      it.crate.position.y = 0.9 + Math.sin(time * 2 + it.phase) * 0.12;
      it.crate.rotation.y += dt * 1.2;
      it.ring.material.opacity = 0.55 + Math.sin(time * 3 + it.phase) * 0.25;
      const dx = playerPos.x - it.def.x, dz = playerPos.z - it.def.z;
      if (dx * dx + dz * dz <= r2 && tryCollect(it)) {
        it.collected = true;
        it.group.visible = false;
        this.particles.emit(new THREE.Vector3(it.def.x, 1, it.def.z), 36, it.color, 4.5, 0.9, 3, 1.2);
      }
    }
  }

  get remaining() {
    return this.items.filter((i) => !i.collected).length;
  }

  reset() {
    for (const it of this.items) { it.collected = false; it.group.visible = true; }
  }

  dispose() {
    this.scene.remove(this.group);
    this._beamGeo.dispose(); this._ringGeo.dispose();
    for (const m of Object.values(this._beamMats)) m.dispose();
    for (const it of this.items) it.ring.material.dispose();
  }
}
