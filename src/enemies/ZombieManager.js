import { CONFIG } from '../config.js';
import { createFallbackZombie } from '../systems/AssetLoader.js';
import { Zombie } from './Zombie.js';
import { ZombieAI, ZombieState } from './ZombieAI.js';
import { FlowField } from './FlowField.js';

/**
 * Crea y gestiona todos los zombis: carga de modelos, actualización de IA, separación entre
 * zombis, contacto con el jugador (GAME OVER) y reinicio de la partida.
 */
export class ZombieManager {
  constructor({ scene, collision, assets }) {
    this.scene = scene;
    this.collision = collision;
    this.assets = assets;
    this.flow = new FlowField(collision);          // se construye con los colisionadores ya cargados
    this.ai = new ZombieAI(collision, this.flow);
    this.zombies = [];
    this._alive = [];
    this._hitboxes = [];
    this.onStateChange = null; // (zombie, state)
  }

  /** Carga los GLB necesarios (uno por modelo distinto) y crea los zombis. */
  async spawnAll(spawns) {
    const modelKeys = [...new Set(spawns.map((s) => CONFIG.ZOMBIE_TYPES[s.type].model))];
    const models = {};
    await Promise.all(
      modelKeys.map(async (key) => {
        const cfg = CONFIG.ZOMBIE_MODELS[key];
        models[key] = await this.assets.load(cfg.path, `zombi: ${key}`, createFallbackZombie);
      }),
    );

    spawns.forEach((s, i) => {
      const key = CONFIG.ZOMBIE_TYPES[s.type].model;
      const z = new Zombie({
        id: i,
        spawn: s,
        typeName: s.type,
        model: models[key],
        detect: s.detect,
        modelRotationY: ((CONFIG.ZOMBIE_MODELS[key].rotationY ?? 0) * Math.PI) / 180,
      });
      z.onStateChange = (zomb, st) => {
        this._rebuildCaches();
        this.onStateChange?.(zomb, st);
      };
      this.scene.add(z.group);
      this.zombies.push(z);
    });
    this._rebuildCaches();
  }

  _rebuildCaches() {
    this._alive = this.zombies.filter((z) => z.isAlive);
    this._hitboxes = this._alive.map((z) => z.hitbox);
  }

  /** Hitboxes de los zombis vivos (objetivos del Raycaster). */
  get hitboxes() {
    return this._hitboxes;
  }

  get aliveCount() {
    return this._alive.length;
  }

  /** @param {{x:number,z:number}} player */
  update(dt, time, player) {
    if (this._alive.some((z) => z.state === ZombieState.ACTIVE)) this.flow.update(player, dt);
    for (const z of this._alive) this.ai.update(z, player, dt);
    this._separate();
    for (const z of this.zombies) z.update(dt, time);
  }

  /** MODO CAZA (al salir de la zona segura): los zombis detectan al jugador desde mucho más lejos. */
  setHunt(on) {
    for (const z of this.zombies) z.setHunt(on ? CONFIG.HUNT : null);
  }

  /** Evita que los zombis activos se amontonen en el mismo punto. */
  _separate() {
    const a = this._alive;
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) {
        const zi = a[i], zj = a[j];
        if (zi.state !== ZombieState.ACTIVE && zj.state !== ZombieState.ACTIVE) continue;
        const dx = zj.position.x - zi.position.x, dz = zj.position.z - zi.position.z;
        const d = Math.hypot(dx, dz), min = zi.radius + zj.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d, nz = dz / d;
          if (zi.state === ZombieState.ACTIVE) { zi.position.x -= nx * push; zi.position.z -= nz * push; this.collision.resolveCircle(zi.position, zi.radius); }
          if (zj.state === ZombieState.ACTIVE) { zj.position.x += nx * push; zj.position.z += nz * push; this.collision.resolveCircle(zj.position, zj.radius); }
        }
      }
    }
  }

  /** Devuelve el primer zombi VIVO que toca al jugador (RF09) o null. */
  findContact(player, playerRadius) {
    const reach = Math.max(CONFIG.combat.contactDistance, playerRadius + 0.5);
    for (const z of this._alive) {
      if (Math.hypot(z.position.x - player.x, z.position.z - player.z) <= reach) return z;
    }
    return null;
  }

  /** Cantidad de zombis vivos a menos de `radius` y distancia al más cercano. */
  threat(player, radius) {
    let count = 0, nearest = Infinity;
    for (const z of this._alive) {
      const d = Math.hypot(z.position.x - player.x, z.position.z - player.z);
      if (d < nearest) nearest = d;
      if (d <= radius) count++;
    }
    return { count, nearest };
  }

  resetAll() {
    for (const z of this.zombies) z.reset();
    this._rebuildCaches();
  }

  dispose() {
    for (const z of this.zombies) {
      this.scene.remove(z.group);
      z.dispose();
    }
    this.zombies.length = 0;
    this._rebuildCaches();
  }
}
