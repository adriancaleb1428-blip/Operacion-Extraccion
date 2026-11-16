import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { ZombieState } from './ZombieAI.js';

const HURT_COLOR = new THREE.Color(0xff1a00);
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/**
 * Un zombi: contiene el modelo 3D (GLB clonado), un "hitbox" invisible para el Raycaster
 * y los datos de comportamiento (estado, vida, velocidad, rango de detección).
 */
export class Zombie {
  /**
   * @param {object} opts
   * @param {number} opts.id
   * @param {{x:number,z:number}} opts.spawn
   * @param {string} opts.typeName  clave de CONFIG.ZOMBIE_TYPES
   * @param {{scene:THREE.Object3D, animations:THREE.AnimationClip[]}} opts.model  GLB ya cargado
   * @param {number} [opts.detect]  rango de detección propio (sobrescribe el del tipo)
   */
  constructor({ id, spawn, typeName, model, detect, modelRotationY = 0 }) {
    const type = CONFIG.ZOMBIE_TYPES[typeName];
    this.id = id;
    this.typeName = typeName;
    this.spawn = { x: spawn.x, z: spawn.z };

    // --- datos de juego ---
    this.maxHealth = CONFIG.combat.zombieHealth; // RF07: 2 puntos de resistencia
    this.health = this.maxHealth;
    this.speed = type.speed;
    this.detectionRange = detect ?? type.detect;
    this.loseFactor = type.loseFactor;
    this.baseDetect = this.detectionRange;   // valores propios (el modo caza los amplía temporalmente)
    this.baseLoseFactor = this.loseFactor;
    this.radius = 0.45;
    this.state = ZombieState.IDLE;
    this.heading = 0;
    this.stuckTime = 0;
    this.steerTimer = 0;
    this.steerSign = 1;
    this.onStateChange = null; // callback (zombie, newState)

    // --- representación 3D ---
    this.group = new THREE.Group();
    this.group.position.set(spawn.x, 0, spawn.z);
    this.position = this.group.position;
    this.group.rotation.y = Math.random() * Math.PI * 2;

    this.body = new THREE.Group();
    this.group.add(this.body);
    this.visual = cloneSkinned(model.scene);
    this._normalizeModel(this.visual, type.height, modelRotationY);
    this.body.add(this.visual);

    // Materiales propios para poder teñir de rojo al recibir un impacto sin afectar a otros zombis
    this.materials = [];
    this.visual.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => m.clone());
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
      for (const m of cloned) if (m.emissive) this.materials.push({ m, base: m.emissive.clone() });
    });

    // Hitbox invisible (cilindro) usado por el Raycaster: barato y fiable con cualquier modelo
    this.hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, type.height, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitbox.position.y = type.height / 2;
    this.hitbox.userData.zombie = this;
    this.group.add(this.hitbox);

    // --- animación: clips del GLB si existen; si no, animación procedural por nombre de nodo ---
    this.mixer = null;
    this.actions = {};
    this._setupAnimation(model.animations ?? []);
    this.walkPhase = Math.random() * 10;
    this.hurt = 0;
    this.deathT = 0;
    this.corpseTime = 0;
  }

  get isAlive() {
    return this.state !== ZombieState.DEAD;
  }

  /** Escala el modelo a la altura deseada, centra en XZ y apoya los pies en y=0. */
  _normalizeModel(obj, targetHeight, rotationY) {
    obj.rotation.y = rotationY;
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj);
    _box.getSize(_size);
    const s = _size.y > 1e-4 ? targetHeight / _size.y : 1;
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj);
    obj.position.x -= (_box.min.x + _box.max.x) / 2;
    obj.position.z -= (_box.min.z + _box.max.z) / 2;
    obj.position.y -= _box.min.y;
  }

  _setupAnimation(clips) {
    if (clips.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.visual);
      // Prioridad por nombre (los packs traen muchos clips: Crawl, Walk, Run, Idle, Death...)
      const pick = (names) => { for (const n of names) { const c = clips.find((k) => k.name.toLowerCase() === n || k.name.toLowerCase().endsWith('_' + n) || k.name.toLowerCase().endsWith('|' + n)); if (c) return c; } return null; };
      const walk = pick(['walk', 'run', 'shamble']) ?? clips.find((c) => /walk|run/i.test(c.name)) ?? clips[0];
      const idle = pick(['idle']) ?? clips.find((c) => /idle|stand/i.test(c.name)) ?? walk;
      this.actions.idle = this.mixer.clipAction(idle);
      this.actions.walk = this.mixer.clipAction(walk);
      this.actions.idle.play();
      return;
    }
    // Procedural (modelos provisionales con nodos legL/legR/armL/armR)
    this.limbs = {};
    for (const n of ['legL', 'legR', 'armL', 'armR']) {
      const node = this.visual.getObjectByName(n);
      if (node) this.limbs[n] = { node, base: node.rotation.clone() };
    }
  }

  /** Modo caza: amplía el rango de detección (nunca lo reduce). Con `null` vuelve a los valores propios. */
  setHunt(hunt) {
    this.detectionRange = hunt ? Math.max(this.baseDetect, hunt.range) : this.baseDetect;
    this.loseFactor = hunt ? hunt.loseFactor : this.baseLoseFactor;
  }

  activate() {
    if (this.state !== ZombieState.IDLE) return;
    this.state = ZombieState.ACTIVE;
    this.actions.walk?.reset().play();
    this.actions.idle?.fadeOut(0.2);
    this.onStateChange?.(this, this.state);
  }

  deactivate() {
    if (this.state !== ZombieState.ACTIVE) return;
    this.state = ZombieState.IDLE;
    this.actions.idle?.reset().fadeIn(0.2).play();
    this.actions.walk?.fadeOut(0.2);
    this.onStateChange?.(this, this.state);
  }

  /**
   * Aplica daño por un impacto válido. Devuelve { hit, killed }.
   * Con 2 de vida, el zombi muere exactamente con el 2º impacto.
   */
  takeDamage(amount = CONFIG.combat.damagePerHit) {
    if (!this.isAlive) return { hit: false, killed: false };
    this.health = Math.max(0, this.health - amount);
    this.hurt = 1;
    if (this.health <= 0) {
      this.die();
      return { hit: true, killed: true };
    }
    return { hit: true, killed: false };
  }

  die() {
    this.state = ZombieState.DEAD;
    this.hitbox.layers.set(31); // ya no es un objetivo del Raycaster
    this.mixer?.stopAllAction();
    this.onStateChange?.(this, this.state);
  }

  /** Reinicia el zombi a su estado original (reinicio de partida). */
  reset() {
    this.health = this.maxHealth;
    this.state = ZombieState.IDLE;
    this.setHunt(null);
    this.position.set(this.spawn.x, 0, this.spawn.z);
    this.hitbox.layers.set(0);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.stuckTime = 0; this.steerTimer = 0; this.hurt = 0; this.deathT = 0;
    for (const { m, base } of this.materials) m.emissive.copy(base);
    this.group.visible = true;
    if (this.mixer) { this.mixer.stopAllAction(); this.actions.idle?.reset().play(); }
  }

  /** Animación visual (no afecta a la lógica). */
  update(dt, time) {
    // Parpadeo rojo al recibir un impacto
    if (this.hurt > 0) {
      this.hurt = Math.max(0, this.hurt - dt * 4);
      for (const { m, base } of this.materials) m.emissive.copy(base).lerp(HURT_COLOR, this.hurt);
    }

    if (this.state === ZombieState.DEAD) {
      this.deathT = Math.min(1, this.deathT + dt * 1.6);
      const e = 1 - (1 - this.deathT) ** 3;
      this.body.rotation.x = -e * (Math.PI / 2 - 0.05); // cae de espaldas
      this.body.position.y = e * 0.18;
      return;
    }

    if (this.state === ZombieState.ACTIVE) {
      // Girar suavemente hacia la dirección de movimiento
      let diff = this.heading - this.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.group.rotation.y += diff * Math.min(1, dt * 8);
      this.walkPhase += dt * this.speed * 3.2;
      this.mixer?.update(dt);
      this._poseWalk(this.walkPhase, 1);
      this.body.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.05;
    } else {
      // INACTIVO: permanece en su sitio, balanceo leve
      this.mixer?.update(dt);
      this._poseWalk(time * 1.1 + this.id, 0.12);
      this.body.rotation.z = Math.sin(time * 0.9 + this.id) * 0.04;
    }
  }

  _poseWalk(phase, amp) {
    if (!this.limbs) return;
    const s = Math.sin(phase) * amp;
    const { legL, legR, armL, armR } = this.limbs;
    if (legL) legL.node.rotation.x = legL.base.x + s * 0.7;
    if (legR) legR.node.rotation.x = legR.base.x - s * 0.7;
    if (armL) armL.node.rotation.x = armL.base.x + s * 0.25;
    if (armR) armR.node.rotation.x = armR.base.x - s * 0.25;
  }

  dispose() {
    for (const { m } of this.materials) m.dispose();
    this.hitbox.geometry.dispose();
    this.hitbox.material.dispose();
    this.mixer?.stopAllAction();
  }
}
