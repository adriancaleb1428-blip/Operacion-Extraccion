import { CONFIG } from '../config.js';

/**
 * Movimiento WASD relativo a la orientación de la cámara, con aceleración suave
 * y colisiones contra el escenario (el jugador no atraviesa paredes ni obstáculos).
 */
export class MovementController {
  /** @param {import('../systems/CollisionSystem.js').CollisionSystem} collision */
  constructor(collision) {
    this.collision = collision;
    this.vx = 0;
    this.vz = 0;
  }

  reset() {
    this.vx = this.vz = 0;
  }

  /**
   * @param {{x:number,z:number}} position posición (se modifica)
   * @param {{forward:number, strafe:number}} axis entrada
   * @param {number} yaw orientación horizontal de la cámara (rad)
   * @returns {number} velocidad actual (m/s)
   */
  update(dt, position, axis, yaw) {
    const { speed, acceleration, radius } = CONFIG.player;
    // Vectores forward/right sobre el plano XZ
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = fx * axis.forward + rx * axis.strafe;
    let dz = fz * axis.forward + rz * axis.strafe;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; } // diagonales no son más rápidas

    // Aceleración hacia la velocidad deseada (frenado suave al soltar)
    const tx = dx * speed, tz = dz * speed;
    const k = Math.min(1, acceleration * dt / speed);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;

    position.x += this.vx * dt;
    position.z += this.vz * dt;
    this.collision.resolveCircle(position, radius);
    return Math.hypot(this.vx, this.vz);
  }
}
