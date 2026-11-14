import * as THREE from 'three';

/**
 * Disparo con Raycaster (RF07).
 *
 * Cada llamada a `fire()` equivale a UN clic: consume 1 bala, lanza un rayo desde el centro de la
 * cámara y comprueba si impacta contra el hitbox de un zombi vivo ANTES que contra una pared/vehículo.
 *   - impacto en zombi  -> zombie.takeDamage(1)  (con 2 de vida muere en el 2º impacto)
 *   - impacto en pared  -> no se daña a nadie (solo efecto visual)
 *   - sin munición      -> no dispara ni gasta nada
 */
export class ShootingSystem {
  /**
   * @param {{ammo: import('./AmmoSystem.js').AmmoSystem, collision: import('../systems/CollisionSystem.js').CollisionSystem,
   *          zombies: {hitboxes: THREE.Object3D[]}}} deps
   */
  constructor({ ammo, collision, zombies }) {
    this.ammo = ammo;
    this.collision = collision;
    this.zombies = zombies;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0;
    this.shotsFired = 0;
  }

  /**
   * @param {{id:string, range:number, damage:number}} weapon
   * @param {THREE.Vector3} origin  posición de la cámara
   * @param {THREE.Vector3} direction  dirección normalizada
   * @returns {{fired:boolean, reason?:string, hit:boolean, killed:boolean, zombie:object|null, point:THREE.Vector3|null, surfacePoint:THREE.Vector3|null}}
   */
  fire(weapon, origin, direction) {
    const result = { fired: false, hit: false, killed: false, zombie: null, point: null, surfacePoint: null };
    if (!this.ammo.consume(weapon.id)) {
      result.reason = 'NO_AMMO';
      return result;
    }
    result.fired = true;
    this.shotsFired++;

    // Los hitboxes se mueven con la IA: se refresca su matriz del mundo para que el rayo use la
    // posición actual y no la del último frame renderizado.
    for (const h of this.zombies.hitboxes) h.updateWorldMatrix(true, false);
    this.raycaster.set(origin, direction);
    this.raycaster.far = weapon.range;
    const hits = this.raycaster.intersectObjects(this.zombies.hitboxes, false);
    const wallDistance = this.collision.raycast(origin, direction, weapon.range);

    if (hits.length > 0 && hits[0].distance < wallDistance) {
      const zombie = hits[0].object.userData.zombie;
      const dmg = zombie.takeDamage(weapon.damage);
      result.hit = dmg.hit;
      result.killed = dmg.killed;
      result.zombie = zombie;
      result.point = hits[0].point.clone();
    } else if (Number.isFinite(wallDistance)) {
      result.surfacePoint = origin.clone().addScaledVector(direction, wallDistance);
    }
    return result;
  }
}
