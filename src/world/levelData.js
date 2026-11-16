/**
 * DATOS DEL NIVEL (calles, edificios, vehículos, zombis, suministros).
 * Todo se genera de forma DETERMINISTA (semillas fijas): el mundo es siempre el mismo.
 * Es solo datos + utilidades puras (sin three.js) para poder validarlo en tests.
 *
 * Coordenadas: X = este(+)/oeste(-),  Z = sur(+)/norte(-).
 * El jugador empieza al SUR (z ≈ +150) y la zona de extracción está ESCONDIDA al NORESTE,
 * dentro de un recinto amurallado con una única entrada (ver EXT_COMPOUND / EXT_GATE).
 */

export const WORLD = { minX: -160, maxX: 160, minZ: -160, maxZ: 160 };

// ---------- calles ----------
export const AVENUES = [-110, -55, 0, 55, 110].map((x) => ({ x, w: x === 0 ? 14 : 12 }));      // N-S
export const CROSS_STREETS = [-110, -55, 0, 55, 110].map((z) => ({ z, w: 12 }));                 // E-O (ascendente en z)

/** Tramos libres entre calles (las manzanas). */
function gaps(min, max, roads, key) {
  const out = [];
  let cur = min;
  for (const r of roads) {
    out.push([cur, r[key] - r.w / 2]);
    cur = r[key] + r.w / 2;
  }
  out.push([cur, max]);
  return out;
}
export const BLOCK_X = gaps(WORLD.minX, WORLD.maxX, AVENUES, 'x');            // oeste -> este
export const BLOCK_Z = gaps(WORLD.minZ, WORLD.maxZ, CROSS_STREETS, 'z');      // norte -> sur

// Tipo de cada manzana [fila norte->sur][columna oeste->este]
//  b = edificios · park/parking/construction/containers = patios abiertos · START = zona segura · EXT = extracción
const KINDS = [
  ['b', 'b', 'b', 'b', 'b', 'EXT'],
  ['b', 'b', 'b', 'b', 'construction', 'b'],
  ['b', 'parking', 'b', 'containers', 'b', 'b'],
  ['b', 'b', 'park', 'parking', 'b', 'b'],
  ['b', 'construction', 'b', 'b', 'containers', 'b'],
  ['b', 'b', 'START', 'START', 'b', 'b'],
];
const blockRect = (ix, iz) => ({ x1: BLOCK_X[ix][0], x2: BLOCK_X[ix][1], z1: BLOCK_Z[iz][0], z2: BLOCK_Z[iz][1] });

// ---------- puntos clave ----------
export const PLAYER_START = { x: 0, z: 150, yaw: 0 };
export const SAFE_ZONE = { x1: -18, x2: 18, z1: 128, z2: 156, gateHalfWidth: 5 };
export const POLE = { x: -8, z: SAFE_ZONE.z1 + 6 };   // poste del reflector

// Zona de extracción ESCONDIDA: recinto amurallado en la esquina nordeste, entrada por el lado oeste.
export const EXT_COMPOUND = { x1: 122, x2: 156, z1: -156, z2: -122 };
export const EXT_GATE = { z1: -146, z2: -141 };        // hueco de 5 m en el muro oeste
export const EXTRACTION = { x: 142, z: -140, radius: 5 };
export const HELICOPTER = { x: 150, z: -150, L: 8, W: 2.6, H: 3.2 };

// ---------- generador pseudoaleatorio con semilla ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tamaños ----------
export const VEHICLE_SIZES = {
  car: { L: 4.4, W: 1.9, H: 1.5 },
  van: { L: 5.2, W: 2.1, H: 2.1 },
  truck: { L: 7.5, W: 2.5, H: 3.0 },
  bus: { L: 11, W: 2.6, H: 3.2 },
  wreck: { L: 4.2, W: 1.9, H: 1.3 },
};
export const CONTAINER_SIZE = { L: 6.1, W: 2.44, H: 2.6 };
const CAR_COLORS = [0x7a2020, 0x2f4f6f, 0x3a5a3a, 0x8a8a8a, 0xb0a070, 0x9a7a1a, 0x6a2a6a, 0x4a5a6a, 0x5a1a1a, 0x8a6a2a, 0x2a2a3a, 0x1f4a4a, 0x7a7a2a, 0x3a3a3a, 0x8a2a2a, 0x6a6a7a];

// ======================================================================= EDIFICIOS
/** Divide un rectángulo en nx*nz solares separados por callejones de `gap` metros. */
function splitLots(x1, x2, z1, z2, nx, nz, gap, rng, hMin, hMax, inset = 1) {
  const lots = [];
  const wx = (x2 - x1 - 2 * inset - gap * (nx - 1)) / nx;
  const wz = (z2 - z1 - 2 * inset - gap * (nz - 1)) / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const bx1 = x1 + inset + i * (wx + gap);
      const bz1 = z1 + inset + j * (wz + gap);
      lots.push({ x1: bx1, x2: bx1 + wx, z1: bz1, z2: bz1 + wz, h: Math.round(hMin + rng() * (hMax - hMin)), style: Math.floor(rng() * 3) });
    }
  }
  return lots;
}

export function generateBuildings() {
  const rng = mulberry32(20240613);
  const out = [];
  for (let iz = 0; iz < BLOCK_Z.length; iz++) {
    for (let ix = 0; ix < BLOCK_X.length; ix++) {
      const kind = KINDS[iz][ix];
      const r = blockRect(ix, iz);
      if (kind === 'b') {
        const w = r.x2 - r.x1, d = r.z2 - r.z1;
        out.push(...splitLots(r.x1, r.x2, r.z1, r.z2, w > 60 ? 3 : w > 40 ? 2 : 1, d > 60 ? 3 : d > 40 ? 2 : 1, 2, rng, 12, 34));
      } else if (kind === 'START') {
        // Solo flancos: el centro es la zona segura
        const left = ix === 2;
        out.push(...splitLots(left ? r.x1 : 22, left ? -22 : r.x2, r.z1, r.z2, 1, 2, 2, rng, 10, 22));
      }
    }
  }
  return out;
}

// ======================================================================= PATIOS ABIERTOS
export function generateYardProps() {
  const rng = mulberry32(777);
  const vehicles = [], containers = [], trees = [], rubble = [], benches = [];
  const color = () => CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];

  for (let iz = 0; iz < BLOCK_Z.length; iz++) {
    for (let ix = 0; ix < BLOCK_X.length; ix++) {
      const kind = KINDS[iz][ix];
      const r = blockRect(ix, iz);
      const w = r.x2 - r.x1, h = r.z2 - r.z1, cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;

      if (kind === 'parking') {
        for (const z of [r.z1 + h * 0.25, r.z1 + h * 0.75]) {
          for (let x = r.x1 + 8; x <= r.x2 - 6; x += 7) {
            if (rng() < 0.22) continue; // plazas vacías
            vehicles.push({ t: rng() < 0.2 ? 'van' : 'car', x, z, rot: 0, c: color() });
          }
        }
      } else if (kind === 'containers') {
        for (const z of [r.z1 + 8, r.z2 - 8]) {
          for (let x = r.x1 + 9; x <= r.x2 - 8; x += 11) containers.push({ x, z, rot: 90, c: color(), stacked: rng() < 0.4 });
        }
        containers.push({ x: r.x1 + w * 0.3, z: cz, rot: 90, c: 0x7a3a1a, stacked: false }, { x: r.x1 + w * 0.72, z: cz, rot: 90, c: 0x2a5a5a, stacked: true });
      } else if (kind === 'construction') {
        containers.push({ x: r.x1 + w * 0.2, z: r.z1 + h * 0.18, rot: 90, c: 0x9a6a1a, stacked: false }, { x: r.x1 + w * 0.65, z: r.z1 + h * 0.3, rot: 90, c: 0x3a5a7a, stacked: false }, { x: r.x1 + w * 0.8, z: r.z1 + h * 0.8, rot: 90, c: 0x5a3a3a, stacked: true });
        rubble.push({ x: r.x1 + w * 0.3, z: r.z1 + h * 0.65, w: 5, d: 3.4, h: 1.3 }, { x: r.x1 + w * 0.75, z: r.z1 + h * 0.55, w: 3.6, d: 4, h: 1.1 }, { x: r.x1 + w * 0.45, z: r.z1 + h * 0.85, w: 3, d: 2.6, h: 0.9 });
      } else if (kind === 'park') {
        const fountain = { x: cx, z: cz, w: 5, d: 5, h: 1.2 };
        rubble.push(fountain);
        for (let i = 0; i < 18; i++) {
          const x = r.x1 + 4 + rng() * (w - 8), z = r.z1 + 4 + rng() * (h - 8);
          if (Math.hypot(x - fountain.x, z - fountain.z) < 6) continue;
          trees.push({ x, z, h: 4 + rng() * 3 });
        }
        benches.push({ x: cx + 8, z: cz, w: 1.8, d: 0.6 }, { x: cx - 8, z: cz + 6, w: 0.6, d: 1.8 }, { x: cx, z: cz - 9, w: 1.8, d: 0.6 });
      }
    }
  }
  return { vehicles, containers, trees, rubble, benches };
}

// ======================================================================= CALLES
const nearRoad = (v, roads, key, margin) => roads.some((r) => Math.abs(v - r[key]) < r.w / 2 + margin);
const inStartArea = (x, z) => z > 112 && Math.abs(x) < 30;
const inExtArea = (x, z) => x > 112 && z < -112;

/** Vehículos abandonados en avenidas y calles transversales. rot 0 = eje largo en Z, 90 = en X. */
export const VEHICLES = (() => {
  const rng = mulberry32(1337);
  const out = [];
  const pick = () => { const r = rng(); return r < 0.55 ? 'car' : r < 0.7 ? 'van' : r < 0.8 ? 'truck' : r < 0.87 ? 'bus' : 'wreck'; };
  for (const a of AVENUES) {
    for (let z = -150; z < 150; z += 22 + rng() * 14) {
      if (nearRoad(z, CROSS_STREETS, 'z', 9) || inStartArea(a.x, z) || inExtArea(a.x, z)) continue;
      out.push({ t: pick(), x: a.x + (rng() < 0.5 ? -1 : 1) * (2.4 + rng() * 2), z, rot: 0, c: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] });
    }
  }
  for (const s of CROSS_STREETS) {
    for (let x = -150; x < 150; x += 24 + rng() * 14) {
      if (nearRoad(x, AVENUES, 'x', 9) || inStartArea(x, s.z) || inExtArea(x, s.z)) continue;
      const t = pick() === 'bus' ? 'car' : pick();
      out.push({ t, x, z: s.z + (rng() < 0.5 ? -1 : 1) * (2.2 + rng() * 2), rot: 90, c: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] });
    }
  }
  return out;
})();

// ---------- barreras y obstáculos ----------
// type: jersey (concreto), crate, dumpster, sandbag. w/d = tamaño en X/Z. Siempre alineadas a los ejes.
export const BARRIERS = (() => {
  const rng = mulberry32(4711);
  const out = [];
  // Retenes (chokepoints) en las avenidas: línea de barreras con un paso de 3 m en el centro
  const chokes = [[0, 80], [0, 28], [0, -30], [0, -80], [-55, 30], [-55, -80], [55, 80], [55, -30], [110, 30], [-110, -30], [110, -80], [-55, 130], [-110, 80], [55, 135]];
  for (const [ax, z] of chokes) {
    const a = AVENUES.find((v) => v.x === ax);
    const segW = a.w / 2 - 1.5;
    out.push({ t: 'jersey', x: ax - 1.5 - segW / 2, z, w: segW, d: 0.7 }, { t: 'jersey', x: ax + 1.5 + segW / 2, z, w: segW, d: 0.7 });
  }
  // Puerta de la zona segura
  const s = SAFE_ZONE;
  out.push({ t: 'sandbag', x: -8.5, z: s.z1, w: 7, d: 0.9 }, { t: 'sandbag', x: 8.5, z: s.z1, w: 7, d: 0.9 });
  // Contenedores de basura y cajas en los bordes de las calles
  for (let i = 0; i < 70; i++) {
    const avenue = rng() < 0.55;
    let x, z;
    if (avenue) { const a = AVENUES[Math.floor(rng() * AVENUES.length)]; x = a.x + (rng() < 0.5 ? -1 : 1) * (a.w / 2 - 1.4); z = -150 + rng() * 300; if (nearRoad(z, CROSS_STREETS, 'z', 2)) continue; }
    else { const c = CROSS_STREETS[Math.floor(rng() * CROSS_STREETS.length)]; z = c.z + (rng() < 0.5 ? -1 : 1) * (c.w / 2 - 1.4); x = -150 + rng() * 300; if (nearRoad(x, AVENUES, 'x', 2)) continue; }
    if (inStartArea(x, z) || inExtArea(x, z)) continue;
    out.push(rng() < 0.4 ? { t: 'dumpster', x, z, w: 2.4, d: 1.4 } : { t: 'crate', x, z, w: 1.4, d: 1.4 });
  }
  // Interior del recinto de extracción: algo de cobertura (sin bloquear el camino de la puerta al helipuerto)
  out.push({ t: 'jersey', x: 131, z: -131, w: 4, d: 0.7 }, { t: 'crate', x: 128, z: -150, w: 1.4, d: 1.4 }, { t: 'crate', x: 133, z: -152, w: 1.4, d: 1.4 }, { t: 'sandbag', x: 148, z: -128, w: 5, d: 0.8 });
  return out;
})();

export const FIRE_BARRELS = [
  { x: 3, z: -28 }, { x: -3, z: -78 }, { x: 3, z: 82 }, { x: -57, z: 32 }, { x: 57, z: -32 }, { x: 112, z: 32 },
  { x: 112, z: -82 }, { x: -12, z: 150 }, { x: 12, z: 150 }, { x: 136, z: -126 },
];

// Zonas de peligro (decal + conos). Son zonas con zombis más densos.
export const HAZARD_ZONES = [
  { x: 0, z: 4, w: 12, d: 10, label: 'PELIGRO' },
  { x: -55, z: 60, w: 10, d: 10, label: 'ZONA INFECTADA' },
  { x: 55, z: -60, w: 10, d: 10, label: 'BIOPELIGRO' },
  { x: 0, z: -125, w: 14, d: 10, label: 'PELIGRO' },
  { x: 110, z: -60, w: 10, d: 10, label: 'ZONA INFECTADA' },
  { x: -110, z: 100, w: 10, d: 8, label: 'BIOPELIGRO' },
];

/** Farolas en los bordes de las avenidas (dir = hacia dónde apunta el brazo: +1 → +X). */
export function generateLamps() {
  const lamps = [];
  for (const a of AVENUES) {
    for (const side of [-1, 1]) {
      for (let z = -150 + (side > 0 ? 16 : 0); z < 150; z += 32) {
        const x = a.x + side * (a.w / 2 + 0.5);
        if (nearRoad(z, CROSS_STREETS, 'z', 1.5) || (z > SAFE_ZONE.z1 - 1 && Math.abs(x) < 22)) continue;
        lamps.push({ x, z, dir: -side });
      }
    }
  }
  return lamps;
}

// ======================================================================= COLISIONADORES
export const vehicleBox = (v) => {
  const s = VEHICLE_SIZES[v.t];
  const hx = (v.rot === 90 ? s.L : s.W) / 2, hz = (v.rot === 90 ? s.W : s.L) / 2;
  return { minX: v.x - hx, maxX: v.x + hx, minZ: v.z - hz, maxZ: v.z + hz, minY: 0, maxY: s.H };
};
export const barrierBox = (b) => ({
  minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: 0,
  maxY: b.t === 'jersey' ? 1.0 : b.t === 'sandbag' ? 1.1 : b.t === 'dumpster' ? 1.5 : 1.2,
});
export function containerBox(c) {
  const hx = (c.rot === 90 ? CONTAINER_SIZE.L : CONTAINER_SIZE.W) / 2, hz = (c.rot === 90 ? CONTAINER_SIZE.W : CONTAINER_SIZE.L) / 2;
  return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz, minY: 0, maxY: c.stacked ? CONTAINER_SIZE.H * 2 : CONTAINER_SIZE.H };
}

/** Muros del recinto de extracción (con el hueco de la entrada en el lado oeste). */
export function extractionWalls() {
  const c = EXT_COMPOUND, g = EXT_GATE, t = 0.4, H = 5;
  return [
    { minX: c.x1 - t, maxX: c.x2 + t, minZ: c.z2 - t, maxZ: c.z2 + t, minY: 0, maxY: H },            // sur
    { minX: c.x1 - t, maxX: c.x2 + t, minZ: c.z1 - t, maxZ: c.z1 + t, minY: 0, maxY: H },            // norte
    { minX: c.x2 - t, maxX: c.x2 + t, minZ: c.z1, maxZ: c.z2, minY: 0, maxY: H },                    // este
    { minX: c.x1 - t, maxX: c.x1 + t, minZ: c.z1, maxZ: g.z1, minY: 0, maxY: H },                    // oeste (tramo norte)
    { minX: c.x1 - t, maxX: c.x1 + t, minZ: g.z2, maxZ: c.z2, minY: 0, maxY: H },                    // oeste (tramo sur)
  ];
}

let _colliders = null;
/** Todos los colisionadores estáticos del mundo (AABB). Los usan WorldBuilder, el juego y los tests. */
export function buildColliders() {
  if (_colliders) return _colliders.map((c) => ({ ...c }));
  const out = [];
  const add = (b, tag) => out.push({ ...b, tag });
  for (const b of generateBuildings()) add({ minX: b.x1, maxX: b.x2, minZ: b.z1, maxZ: b.z2, minY: 0, maxY: b.h }, 'building');
  const yard = generateYardProps();
  for (const v of [...VEHICLES, ...yard.vehicles]) add(vehicleBox(v), 'vehicle');
  for (const b of BARRIERS) add(barrierBox(b), 'barrier');
  for (const c of yard.containers) add(containerBox(c), 'container');
  for (const r of yard.rubble) add({ minX: r.x - r.w / 2, maxX: r.x + r.w / 2, minZ: r.z - r.d / 2, maxZ: r.z + r.d / 2, minY: 0, maxY: r.h }, 'rubble');
  for (const t of yard.trees) add({ minX: t.x - 0.35, maxX: t.x + 0.35, minZ: t.z - 0.35, maxZ: t.z + 0.35, minY: 0, maxY: t.h }, 'tree');
  for (const b of yard.benches) add({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: 0, maxY: 0.9 }, 'bench');
  for (const l of generateLamps()) add({ minX: l.x - 0.2, maxX: l.x + 0.2, minZ: l.z - 0.2, maxZ: l.z + 0.2, minY: 0, maxY: 7 }, 'lamp');
  for (const f of FIRE_BARRELS) add({ minX: f.x - 0.4, maxX: f.x + 0.4, minZ: f.z - 0.4, maxZ: f.z + 0.4, minY: 0, maxY: 1.0 }, 'barrel');
  // Zona segura: vallas (la puerta queda abierta en el centro de la valla norte)
  const s = SAFE_ZONE, t = 0.25;
  add({ minX: s.x1 - t, maxX: s.x1 + t, minZ: s.z1, maxZ: s.z2 + t, minY: 0, maxY: 3 }, 'fence');
  add({ minX: s.x2 - t, maxX: s.x2 + t, minZ: s.z1, maxZ: s.z2 + t, minY: 0, maxY: 3 }, 'fence');
  add({ minX: s.x1, maxX: s.x2, minZ: s.z2 - t, maxZ: s.z2 + t, minY: 0, maxY: 3 }, 'fence');
  add({ minX: s.x1, maxX: -12, minZ: s.z1 - t, maxZ: s.z1 + t, minY: 0, maxY: 3 }, 'fence');
  add({ minX: 12, maxX: s.x2, minZ: s.z1 - t, maxZ: s.z1 + t, minY: 0, maxY: 3 }, 'fence');
  add({ minX: POLE.x - 0.15, maxX: POLE.x + 0.15, minZ: POLE.z - 0.15, maxZ: POLE.z + 0.15, minY: 0, maxY: 6 }, 'pole');
  // Recinto de extracción + helicóptero
  for (const w of extractionWalls()) add(w, 'wall');
  const h = HELICOPTER;
  add({ minX: h.x - h.W / 2, maxX: h.x + h.W / 2, minZ: h.z - h.L / 2, maxZ: h.z + h.L / 2, minY: 0, maxY: h.H }, 'helicopter');
  _colliders = out;
  return out.map((c) => ({ ...c }));
}

// ======================================================================= SUMINISTROS Y ZOMBIS
const _cols = buildColliders();
const freeAt = (x, z, r) => !_cols.some((c) => {
  const cx = Math.min(Math.max(x, c.minX), c.maxX), cz = Math.min(Math.max(z, c.minZ), c.maxZ);
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
});
const inBounds = (x, z, m = 4) => x > WORLD.minX + m && x < WORLD.maxX - m && z > WORLD.minZ + m && z < WORLD.maxZ - m;
const inSafe = (x, z) => x > SAFE_ZONE.x1 - 3 && x < SAFE_ZONE.x2 + 3 && z > SAFE_ZONE.z1 - 3;
const inExtCompound = (x, z, m = 0) => x > EXT_COMPOUND.x1 - m && x < EXT_COMPOUND.x2 + m && z > EXT_COMPOUND.z1 - m && z < EXT_COMPOUND.z2 + m;

function streetPoint(rng) {
  if (rng() < 0.5) {
    const a = AVENUES[Math.floor(rng() * AVENUES.length)];
    return { x: a.x + (rng() - 0.5) * (a.w - 3), z: WORLD.minZ + 8 + rng() * (WORLD.maxZ - WORLD.minZ - 16) };
  }
  const s = CROSS_STREETS[Math.floor(rng() * CROSS_STREETS.length)];
  return { x: WORLD.minX + 8 + rng() * (WORLD.maxX - WORLD.minX - 16), z: s.z + (rng() - 0.5) * (s.w - 3) };
}

/** Cajas de munición (una por arma): repartidas por las calles, separadas ≥ 24 m. */
export const AMMO_BOXES = (() => {
  const rng = mulberry32(9001);
  const out = [{ weapon: 'rifle', x: 3.5, z: 123 }, { weapon: 'pistol', x: -3.5, z: 123 }]; // fuera de la puerta de la zona segura
  for (let tries = 0; tries < 6000 && out.length < 32; tries++) {
    const p = streetPoint(rng);
    if (!inBounds(p.x, p.z) || inSafe(p.x, p.z) || inExtCompound(p.x, p.z, 6) || !freeAt(p.x, p.z, 1.0)) continue;
    if (out.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 24)) continue;
    out.push({ weapon: rng() < 0.55 ? 'rifle' : 'pistol', x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  }
  return out;
})();

/**
 * Zombis: guardianes cerca de las cajas, grupos en las calles y 4 dentro del recinto de extracción.
 * Todos empiezan INACTIVOS y a más de 45 m del jugador. `detect` opcional sobrescribe el rango del tipo.
 */
export const ZOMBIE_SPAWNS = (() => {
  const rng = mulberry32(31337);
  const out = [
    { x: 134, z: -131, type: 'walker' }, { x: 149, z: -131, type: 'runner' },
    { x: 131, z: -146, type: 'walker' }, { x: 144, z: -151, type: 'lurker' },
  ];
  const type = () => { const r = rng(); return r < 0.64 ? 'walker' : r < 0.84 ? 'runner' : 'lurker'; };
  const ok = (x, z) => inBounds(x, z) && !inSafe(x, z) && !inExtCompound(x, z, 2)
    && Math.hypot(x - PLAYER_START.x, z - PLAYER_START.z) > 45 && freeAt(x, z, 0.6)
    && !out.some((o) => Math.hypot(o.x - x, o.z - z) < 3);
  // guardianes de cajas
  for (const b of AMMO_BOXES.slice(2)) {
    if (rng() > 0.55) continue;
    const a = rng() * Math.PI * 2, d = 5 + rng() * 4;
    const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
    if (ok(x, z)) out.push({ x: +x.toFixed(1), z: +z.toFixed(1), type: type() });
  }
  // grupos en las calles hasta completar 50
  for (let tries = 0; tries < 8000 && out.length < 50; tries++) {
    const p = streetPoint(rng);
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n && out.length < 50; i++) {
      const x = p.x + (rng() - 0.5) * 7, z = p.z + (rng() - 0.5) * 7;
      if (ok(x, z)) out.push({ x: +x.toFixed(1), z: +z.toFixed(1), type: type() });
    }
  }
  return out;
})();
