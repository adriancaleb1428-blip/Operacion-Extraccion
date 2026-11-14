/**
 * Munición independiente por arma (RF02).
 * No existe recarga manual: la única forma de recuperar munición es recoger cajas del escenario.
 * Valores iniciales y máximos: CONFIG.WEAPONS[i].ammo  (src/config.js).
 */
export class AmmoSystem {
  /** @param {Array<{id:string, ammo:{initial:number,max:number}}>} weaponConfigs */
  constructor(weaponConfigs) {
    this.configs = new Map(weaponConfigs.map((w) => [w.id, w.ammo]));
    this.counts = new Map();
    this.reset();
  }

  reset() {
    for (const [id, a] of this.configs) this.counts.set(id, a.initial);
  }

  get(id) {
    return this.counts.get(id) ?? 0;
  }

  max(id) {
    return this.configs.get(id)?.max ?? 0;
  }

  canFire(id) {
    return this.get(id) > 0;
  }

  /** Descuenta UNA bala. Devuelve false (y no hace nada) si no hay munición. */
  consume(id) {
    if (!this.canFire(id)) return false;
    this.counts.set(id, this.get(id) - 1);
    return true;
  }

  isFull(id) {
    return this.get(id) >= this.max(id);
  }

  /** Suma munición sin superar el máximo. Devuelve cuántas balas se añadieron realmente. */
  add(id, amount) {
    const before = this.get(id);
    const after = Math.min(this.max(id), before + amount);
    this.counts.set(id, after);
    return after - before;
  }
}
