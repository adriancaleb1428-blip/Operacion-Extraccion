/**
 * Campo de flujo (pathfinding barato) para que los zombis rodeen edificios en un mapa grande.
 *
 *  1. Al crearse, "rasteriza" los colisionadores en una malla de celdas de 1 m (inflados por el radio de un zombi).
 *  2. `update()` hace una búsqueda en anchura (BFS) desde la celda del JUGADOR: cada celda guarda su distancia.
 *  3. `direction()` devuelve, para cualquier posición, el paso hacia la celda vecina con menor distancia.
 *
 * Un solo BFS (~100 mil celdas) sirve para TODOS los zombis y solo se recalcula cuando el jugador cambia de celda.
 */
export class FlowField {
  /** @param {import('../systems/CollisionSystem.js').CollisionSystem} collision */
  constructor(collision, { cell = 1, radius = 0.7 } = {}) {
    const b = collision.bounds;
    this.x0 = b.minX; this.z0 = b.minZ; this.cell = cell;
    this.w = Math.ceil((b.maxX - b.minX) / cell);
    this.h = Math.ceil((b.maxZ - b.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.dist = new Int32Array(this.w * this.h).fill(-1);
    this.queue = new Int32Array(this.w * this.h);
    this.lastCell = -1;
    this.timer = 0;
    this._rasterize(collision.colliders, radius);
  }

  _rasterize(colliders, r) {
    const { x0, z0, cell, w, h } = this;
    for (const c of colliders) {
      const i0 = Math.max(0, Math.floor((c.minX - r - x0) / cell)), i1 = Math.min(w - 1, Math.floor((c.maxX + r - x0) / cell));
      const j0 = Math.max(0, Math.floor((c.minZ - r - z0) / cell)), j1 = Math.min(h - 1, Math.floor((c.maxZ + r - z0) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
          const dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
          if (dx * dx + dz * dz < r * r) this.blocked[j * w + i] = 1;
        }
      }
    }
  }

  cellIndex(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  /** Recalcula las distancias desde el objetivo (jugador) si cambió de celda (con un pequeño límite de frecuencia). */
  update(target, dt = 0) {
    this.timer += dt;
    const ci = this.cellIndex(target.x, target.z);
    if (ci < 0 || (ci === this.lastCell && this.timer < 2) || (ci !== this.lastCell && this.timer < 0.2 && this.lastCell >= 0)) return;
    this.lastCell = ci;
    this.timer = 0;
    this._bfs(ci);
  }

  _bfs(start) {
    const { w, h, blocked, dist, queue } = this;
    dist.fill(-1);
    let head = 0, tail = 0;
    dist[start] = 0;           // la celda del jugador cuenta como libre aunque esté pegada a una pared
    queue[tail++] = start;
    while (head < tail) {
      const c = queue[head++];
      const i = c % w, j = (c / w) | 0, d = dist[c] + 1;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const n = nj * w + ni;
          if (dist[n] >= 0 || blocked[n]) continue;
          // sin "cortar esquinas": un paso diagonal exige que las dos celdas ortogonales estén libres
          if (di && dj && (blocked[j * w + ni] || blocked[nj * w + i])) continue;
          dist[n] = d;
          queue[tail++] = n;
        }
      }
    }
  }

  /**
   * Dirección unitaria (x,z) hacia la mejor celda vecina, escrita en `out`. Devuelve false si no hay camino.
   */
  direction(x, z, out) {
    const c = this.cellIndex(x, z);
    if (c < 0) return false;
    const { w, h, dist } = this;
    const i = c % w, j = (c / w) | 0;
    let best = dist[c] >= 0 ? dist[c] : Infinity, bi = -1, bj = -1;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const d = dist[nj * w + ni];
        if (d >= 0 && d < best) { best = d; bi = ni; bj = nj; }
      }
    }
    if (bi < 0) return false;
    const tx = this.x0 + (bi + 0.5) * this.cell - x, tz = this.z0 + (bj + 0.5) * this.cell - z;
    const len = Math.hypot(tx, tz) || 1;
    out.x = tx / len; out.z = tz / len;
    return true;
  }
}
