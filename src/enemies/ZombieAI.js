/**
 * IA de los zombis (RF05). Máquina de estados mínima:
 *
 *   INACTIVO ──(jugador dentro del rango de detección)──▶ ACTIVO
 *   ACTIVO   ──(jugador a más de detect * loseFactor)──▶ INACTIVO
 *   cualquiera ──(2 impactos)──▶ ELIMINADO  (deja de moverse, de perseguir y de tocar al jugador)
 *
 * La clase trabaja con números/objetos simples {x,z} para poder probarse sin renderizar.
 */
export const ZombieState = Object.freeze({
  IDLE: 'INACTIVO',
  ACTIVE: 'ACTIVO',
  DEAD: 'ELIMINADO',
});

export class ZombieAI {
  /**
   * @param {import('../systems/CollisionSystem.js').CollisionSystem} collision
   * @param {import('./FlowField.js').FlowField} [flow] pathfinding opcional (sin él, persecución en línea recta)
   */
  constructor(collision, flow = null) {
    this.collision = collision;
    this.flow = flow;
    this._dir = { x: 0, z: 0 };
  }

  /** Actualiza el estado (INACTIVO/ACTIVO) según la distancia al jugador. Devuelve el estado. */
  updateState(zombie, player) {
    if (zombie.state === ZombieState.DEAD) return zombie.state;
    const d = Math.hypot(player.x - zombie.position.x, player.z - zombie.position.z);
    if (zombie.state === ZombieState.IDLE && d <= zombie.detectionRange) {
      zombie.activate();
    } else if (zombie.state === ZombieState.ACTIVE && d > zombie.detectionRange * zombie.loseFactor) {
      zombie.deactivate();
    }
    return zombie.state;
  }

  /** Mueve al zombi hacia el jugador (solo si está ACTIVO), respetando obstáculos y límites. */
  move(zombie, player, dt) {
    if (zombie.state !== ZombieState.ACTIVE) return;
    const px = zombie.position.x, pz = zombie.position.z;
    let dx = player.x - px, dz = player.z - pz;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist; dz /= dist;

    // Lejos del jugador se sigue el campo de flujo (rodea edificios); de cerca, línea recta
    const usedFlow = this.flow && dist > 4 && this.flow.direction(px, pz, this._dir);
    if (usedFlow) { dx = this._dir.x; dz = this._dir.z; }

    // Sin pathfinding: si estuvo atascado contra una pared, rodear unos instantes (gira la dirección ±70°)
    if (!usedFlow && zombie.steerTimer > 0) {
      zombie.steerTimer -= dt;
      const a = zombie.steerSign * 1.2;
      const c = Math.cos(a), s = Math.sin(a);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
    }
    zombie.heading = Math.atan2(dx, dz); // dirección actualizada cada frame

    const step = zombie.speed * dt;
    zombie.position.x += dx * step;
    zombie.position.z += dz * step;
    this.collision.resolveCircle(zombie.position, zombie.radius);

    // Detección de atasco: avanzó mucho menos de lo esperado
    const moved = Math.hypot(zombie.position.x - px, zombie.position.z - pz);
    if (moved < step * 0.35 && dist > 1.5) {
      zombie.stuckTime += dt;
      if (zombie.stuckTime > 0.35 && zombie.steerTimer <= 0) {
        zombie.steerTimer = 0.9;
        zombie.steerSign = zombie.steerSign === 1 ? -1 : 1;
        zombie.stuckTime = 0;
      }
    } else {
      zombie.stuckTime = 0;
    }
  }

  /** Atajo: estado + movimiento. */
  update(zombie, player, dt) {
    this.updateState(zombie, player);
    this.move(zombie, player, dt);
  }
}
