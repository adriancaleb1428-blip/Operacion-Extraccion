import * as THREE from 'three';

/**
 * Sistema de colisiones sencillo: el mundo es un conjunto de cajas alineadas a los ejes (AABB).
 *  - Jugador y zombis son círculos en el plano XZ -> `resolveCircle` los empuja fuera de las cajas
 *    (así se "deslizan" por las paredes en lugar de quedarse pegados).
 *  - Los disparos usan `raycast` (rayo 3D contra las cajas) para saber si una pared tapa al zombi.
 */
export class CollisionSystem {
  /** @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds límites del escenario */
  constructor(bounds) {
    this.bounds = bounds;
    this.colliders = [];
    this._box = new THREE.Box3();
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._min = new THREE.Vector3();
    this._max = new THREE.Vector3();
  }

  addBox(box, tag = 'solid') {
    this.colliders.push({ minY: 0, maxY: 3, ...box, tag });
  }

  addBoxes(list) {
    for (const b of list) this.addBox(b, b.tag);
  }

  clear() {
    this.colliders.length = 0;
  }

  /** Mantiene un círculo (x,z,radio) dentro de los límites del escenario. */
  clampToBounds(p, radius = 0) {
    const b = this.bounds;
    p.x = Math.min(Math.max(p.x, b.minX + radius), b.maxX - radius);
    p.z = Math.min(Math.max(p.z, b.minZ + radius), b.maxZ - radius);
    return p;
  }

  /**
   * Empuja el círculo `p` ({x,z}) fuera de todas las cajas que lo solapan. Modifica `p` y lo devuelve.
   * Se repite unas pasadas para resolver esquinas entre varias cajas.
   */
  resolveCircle(p, radius) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of this.colliders) {
        if (p.x < c.minX - radius || p.x > c.maxX + radius || p.z < c.minZ - radius || p.z > c.maxZ + radius) continue;
        const cx = Math.min(Math.max(p.x, c.minX), c.maxX);
        const cz = Math.min(Math.max(p.z, c.minZ), c.maxZ);
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * radius;
          p.z = cz + (dz / d) * radius;
        } else {
          // El centro quedó dentro de la caja: salir por el lado de menor penetración
          const left = p.x - c.minX, right = c.maxX - p.x, up = p.z - c.minZ, down = c.maxZ - p.z;
          const m = Math.min(left, right, up, down);
          if (m === left) p.x = c.minX - radius;
          else if (m === right) p.x = c.maxX + radius;
          else if (m === up) p.z = c.minZ - radius;
          else p.z = c.maxZ + radius;
        }
        moved = true;
      }
      this.clampToBounds(p, radius);
      if (!moved) break;
    }
    return p;
  }

  /** ¿El círculo solapa alguna caja? (para validar posiciones en tests) */
  overlapsCircle(x, z, radius) {
    return this.colliders.some((c) => {
      const cx = Math.min(Math.max(x, c.minX), c.maxX);
      const cz = Math.min(Math.max(z, c.minZ), c.maxZ);
      return (x - cx) ** 2 + (z - cz) ** 2 < radius * radius;
    });
  }

  /**
   * Distancia al primer colisionador que intercepta el rayo (origin + dir * t), o Infinity.
   * Se usa para que las paredes/vehículos bloqueen los disparos.
   */
  raycast(origin, direction, maxDistance = Infinity) {
    this._ray.origin.copy(origin);
    this._ray.direction.copy(direction);
    let best = Infinity;
    for (const c of this.colliders) {
      this._box.min.set(c.minX, c.minY, c.minZ);
      this._box.max.set(c.maxX, c.maxY, c.maxZ);
      const hit = this._ray.intersectBox(this._box, this._hit);
      if (hit) {
        const d = hit.distanceTo(origin);
        if (d < best && d <= maxDistance) best = d;
      }
    }
    return best;
  }
}
