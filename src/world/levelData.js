/**
 * DATOS DEL NIVEL (posiciones, distribución de zombis, suministros, obstáculos).
 * Es solo datos + utilidades puras (sin three.js) para poder validarlos en tests.
 *
 * Sistema de coordenadas: X = este(+)/oeste(-),  Z = sur(+)/norte(-).  El jugador empieza al sur
 * (z ≈ +96) mirando al norte (-Z) y debe llegar a la zona de extracción en z ≈ -92.
 */

export const WORLD = { minX: -100, maxX: 100, minZ: -106, maxZ: 106 };

// Calles: avenidas N-S (x) y calles transversales E-O (z), con su ancho.
export const AVENUES = [{ x: -60, w: 12 }, { x: 0, w: 14 }, { x: 60, w: 12 }];
export const CROSS_STREETS = [{ z: 70, w: 12 }, { z: 30, w: 12 }, { z: -10, w: 12 }, { z: -50, w: 12 }];

// Manzanas (espacios entre calles)
export const BLOCK_X = [[-100, -66], [-54, -7], [7, 54], [66, 100]];
export const BLOCK_Z = [[76, 106], [36, 64], [-4, 24], [-44, -16], [-106, -56]];

export const PLAYER_START = { x: 0, z: 96, yaw: 0 };
export const EXTRACTION = { x: 0, z: -92, radius: 5 };
export const SAFE_ZONE = { x1: -18, x2: 18, z1: 84, z2: 104, gateHalfWidth: 5 };

// ---------- generador pseudoaleatorio con semilla (el mundo es siempre el mismo) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Divide un rectángulo en nx*nz solares separados por callejones de `gap` metros. */
function splitLots(x1, x2, z1, z2, nx, nz, gap, rng, hMin, hMax, inset = 1) {
  const lots = [];
  const wx = (x2 - x1 - 2 * inset - gap * (nx - 1)) / nx;
  const wz = (z2 - z1 - 2 * inset - gap * (nz - 1)) / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const bx1 = x1 + inset + i * (wx + gap);
      const bz1 = z1 + inset + j * (wz + gap);
      lots.push({
        x1: bx1, x2: bx1 + wx, z1: bz1, z2: bz1 + wz,
        h: Math.round(hMin + rng() * (hMax - hMin)),
        style: Math.floor(rng() * 3),
      });
    }
  }
  return lots;
}

/** Edificios del nivel. */
export function generateBuildings() {
  const rng = mulberry32(20240613);
  const b = [];
  const [c0, c1, c2, c3] = BLOCK_X;
  const [r0, r1, r2, r3, r4] = BLOCK_Z;

  // Fila sur (inicio): columnas exteriores + flancos de la zona segura
  b.push(...splitLots(c0[0], c0[1], r0[0], r0[1], 1, 2, 2, rng, 12, 26));
  b.push(...splitLots(-54, -22, r0[0], r0[1], 1, 2, 2, rng, 10, 22));
  b.push(...splitLots(22, 54, r0[0], r0[1], 1, 2, 2, rng, 10, 22));
  b.push(...splitLots(c3[0], c3[1], r0[0], r0[1], 1, 2, 2, rng, 12, 26));

  // Fila 1 (z 36..64): parque en col1 -> sin edificios
  b.push(...splitLots(c0[0], c0[1], r1[0], r1[1], 1, 2, 2, rng, 14, 34));
  b.push(...splitLots(c2[0], c2[1], r1[0], r1[1], 2, 1, 2, rng, 16, 36));
  b.push(...splitLots(c3[0], c3[1], r1[0], r1[1], 1, 2, 2, rng, 14, 30));

  // Fila 2 (z -4..24): estacionamiento en col2
  b.push(...splitLots(c0[0], c0[1], r2[0], r2[1], 1, 2, 2, rng, 12, 28));
  b.push(...splitLots(c1[0], c1[1], r2[0], r2[1], 2, 1, 2, rng, 18, 38));
  b.push(...splitLots(c3[0], c3[1], r2[0], r2[1], 1, 2, 2, rng, 12, 28));

  // Fila 3 (z -44..-16): obra en col1, patio de contenedores en col2
  b.push(...splitLots(c0[0], c0[1], r3[0], r3[1], 1, 2, 2, rng, 12, 30));
  b.push(...splitLots(c3[0], c3[1], r3[0], r3[1], 1, 2, 2, rng, 12, 30));

  // Fila norte (extracción): flancos de la plaza
  b.push(...splitLots(c0[0], c0[1], r4[0], r4[1], 1, 3, 2, rng, 14, 32));
  b.push(...splitLots(-54, -26, r4[0], r4[1], 1, 3, 2, rng, 14, 30));
  b.push(...splitLots(26, 54, r4[0], r4[1], 1, 3, 2, rng, 14, 30));
  b.push(...splitLots(c3[0], c3[1], r4[0], r4[1], 1, 3, 2, rng, 14, 32));
  return b;
}

// ---------- VEHÍCULOS ABANDONADOS ----------
// rot 0 = eje largo en Z; rot 90 = eje largo en X. (Solo ortogonales -> colisiones AABB exactas)
export const VEHICLE_SIZES = {
  car: { L: 4.4, W: 1.9, H: 1.5 },
  van: { L: 5.2, W: 2.1, H: 2.1 },
  truck: { L: 7.5, W: 2.5, H: 3.0 },
  bus: { L: 11, W: 2.6, H: 3.2 },
  wreck: { L: 4.2, W: 1.9, H: 1.3 },
};

export const VEHICLES = [
  // Calle de acceso (z=70)
  { t: 'car', x: -30, z: 70, rot: 90, c: 0x7a2020 }, { t: 'van', x: 20, z: 72, rot: 90, c: 0x8a8a8a },
  { t: 'car', x: 38, z: 68, rot: 90, c: 0x2f4f6f }, { t: 'wreck', x: -45, z: 72, rot: 90, c: 0x4a3a2a },
  // Avenida central (x=0), de sur a norte
  { t: 'car', x: -4.5, z: 56, rot: 0, c: 0x3a5a3a }, { t: 'van', x: 3.5, z: 48, rot: 0, c: 0xb0a070 },
  { t: 'bus', x: -2.5, z: 40, rot: 0, c: 0x9a7a1a }, { t: 'car', x: 4.5, z: 22, rot: 0, c: 0x6a2a6a },
  { t: 'truck', x: -4, z: 4, rot: 0, c: 0x4a5a6a }, { t: 'bus', x: -1, z: -22, rot: 90, c: 0x5a1a1a },
  { t: 'car', x: 3, z: -36, rot: 0, c: 0x8a6a2a }, { t: 'car', x: -5, z: -30, rot: 0, c: 0x2a2a3a },
  // Avenida oeste (x=-60)
  { t: 'car', x: -62, z: 52, rot: 0, c: 0x7a7a2a }, { t: 'van', x: -57.5, z: 22, rot: 0, c: 0x3a3a3a },
  { t: 'truck', x: -61, z: -4, rot: 0, c: 0x5a4a3a }, { t: 'car', x: -58, z: -30, rot: 0, c: 0x1f4a4a },
  { t: 'wreck', x: -62, z: -62, rot: 0, c: 0x4a2a2a },
  // Avenida este (x=60)
  { t: 'car', x: 57.5, z: 52, rot: 0, c: 0x4a2a5a }, { t: 'car', x: 62, z: 8, rot: 0, c: 0x8a2a2a },
  { t: 'van', x: 58, z: -20, rot: 0, c: 0x6a6a7a }, { t: 'bus', x: 61, z: -48, rot: 0, c: 0x2a5a3a },
  // Calles transversales
  { t: 'car', x: -30, z: 28, rot: 90, c: 0x9a9a3a }, { t: 'car', x: 30, z: 33, rot: 90, c: 0x3a6a8a },
  { t: 'van', x: -42, z: 32, rot: 90, c: 0x7a4a2a }, { t: 'car', x: 44, z: 28, rot: 90, c: 0x5a5a5a },
  { t: 'car', x: -30, z: -9, rot: 90, c: 0x8a3a3a }, { t: 'truck', x: 35, z: -12, rot: 90, c: 0x3a4a3a },
  { t: 'car', x: -44, z: -8, rot: 90, c: 0x2a4a7a }, { t: 'car', x: 25, z: -50, rot: 90, c: 0x6a5a2a },
  { t: 'car', x: -35, z: -48, rot: 90, c: 0x5a2a2a }, { t: 'wreck', x: 46, z: -52, rot: 90, c: 0x3a3a2a },
  // Plaza de extracción
  { t: 'car', x: -12, z: -66, rot: 90, c: 0x7a2020 }, { t: 'car', x: 10, z: -72, rot: 0, c: 0x4a4a4a },
  { t: 'van', x: -6, z: -80, rot: 0, c: 0x8a7a5a }, { t: 'car', x: 15, z: -84, rot: 90, c: 0x2a3a5a },
  { t: 'wreck', x: -16, z: -88, rot: 90, c: 0x4a3a3a },
];

// ---------- BARRERAS Y OBSTÁCULOS ----------
// type: jersey (barrera de concreto), crate, dumpster, sandbag, barrel (barril con fuego), lamp
// w/d = tamaño en X/Z (m). Se colocan axis-aligned.
export const BARRIERS = [
  // Retén en la avenida central (z=10): paso libre de ~3 m en el centro
  { t: 'jersey', x: -4.4, z: 10, w: 5.2, d: 0.7 }, { t: 'jersey', x: 4.9, z: 10, w: 4.2, d: 0.7 },
  { t: 'sandbag', x: -1.2, z: 8.6, w: 1.6, d: 0.7 },
  // Acceso a la plaza (z=-62)
  { t: 'jersey', x: -14, z: -62, w: 20, d: 0.7 }, { t: 'jersey', x: 14, z: -62, w: 20, d: 0.7 },
  // Zona segura: sacos y barricadas junto a la puerta
  { t: 'sandbag', x: -8.5, z: 84, w: 7, d: 0.9 }, { t: 'sandbag', x: 8.5, z: 84, w: 7, d: 0.9 },
  // Cajas / contenedores de basura en calles
  { t: 'dumpster', x: -20, z: 74, w: 2.4, d: 1.4 }, { t: 'dumpster', x: 46, z: 74, w: 2.4, d: 1.4 },
  { t: 'crate', x: 12, z: 64.5, w: 1.4, d: 1.4 }, { t: 'crate', x: -48, z: 36, w: 1.4, d: 1.4 },
  { t: 'crate', x: 52, z: 31, w: 1.4, d: 1.4 }, { t: 'dumpster', x: 20, z: -4.5, w: 2.4, d: 1.4 },
  { t: 'jersey', x: -58, z: 38, w: 4, d: 0.7 }, { t: 'jersey', x: 58, z: 34, w: 4, d: 0.7 },
  { t: 'jersey', x: -20, z: -50, w: 4, d: 0.7 }, { t: 'crate', x: 8, z: -46, w: 1.4, d: 1.4 },
  { t: 'sandbag', x: 3, z: -14, w: 4, d: 0.8 }, { t: 'dumpster', x: -32, z: -44.5, w: 2.4, d: 1.4 },
  // Plaza
  { t: 'crate', x: -8, z: -70, w: 1.4, d: 1.4 }, { t: 'crate', x: 4, z: -76, w: 1.4, d: 1.4 },
  { t: 'sandbag', x: 0, z: -84, w: 6, d: 0.8 },
];

export const FIRE_BARRELS = [
  { x: -12, z: 92 }, { x: 12, z: 92 }, { x: 5.5, z: -14 }, { x: -3, z: -78 }, { x: -58, z: 20 }, { x: 8, z: -66 },
];

// Zonas de peligro (decal + advertencia). Son zonas con mayor densidad de zombis.
export const HAZARD_ZONES = [
  { x: 0, z: 2, w: 12, d: 10, label: 'PELIGRO' },
  { x: -58, z: 20, w: 10, d: 10, label: 'ZONA INFECTADA' },
  { x: 0, z: -76, w: 16, d: 12, label: 'PELIGRO' },
  { x: 30, z: 30, w: 8, d: 6, label: 'BIOPELIGRO' },
];

// Farolas (poste apagado, algunas con luz tenue emisiva)
export function generateLamps() {
  const lamps = [];
  for (let z = 100; z > -100; z -= 22) { lamps.push({ x: -8.2, z }); lamps.push({ x: 8.2, z: z - 11 }); }
  for (const cx of [-60, 60]) for (let z = 80; z > -100; z -= 30) lamps.push({ x: cx + 7, z });
  return lamps.filter((l) => !(l.z > SAFE_ZONE.z1 - 1 && Math.abs(l.x) < 22));
}

// ---------- ZOMBIS (distribución estratégica; todos empiezan INACTIVOS) ----------
// detect opcional: sobrescribe la distancia de detección del tipo.
export const ZOMBIE_SPAWNS = [
  // Calle de acceso: primer contacto, lejos de la zona segura
  { x: -24, z: 70, type: 'walker' },
  { x: 26, z: 71, type: 'walker' },
  // Avenida central
  { x: 3, z: 52, type: 'walker' },
  { x: -5.5, z: 46, type: 'walker' },
  { x: 30, z: 11, type: 'walker' },                // estacionamiento (emboscada)
  // Rutas laterales
  { x: -58, z: 52, type: 'walker' },
  { x: 58, z: 45, type: 'runner' },
  { x: -59, z: 10, type: 'walker', detect: 14 },
  // Retén (chokepoint) de la avenida
  { x: 0, z: 16, type: 'walker' },
  { x: 3, z: 4, type: 'runner' },
  // Centro-norte
  { x: -34, z: 30, type: 'walker' },
  { x: 2, z: -17, type: 'lurker' },
  { x: 30, z: -30, type: 'runner' },              // patio de contenedores
  { x: -20, z: -48, type: 'walker' },
  { x: 22, z: -52, type: 'walker' },
  // Plaza de extracción
  { x: -3, z: -66, type: 'walker' },
  { x: 4, z: -68, type: 'walker' },
  { x: -12, z: -78, type: 'runner' },
  { x: 14, z: -80, type: 'walker' },
  { x: 0, z: -88, type: 'lurker' },
];

// ---------- CAJAS DE MUNICIÓN ----------
export const AMMO_BOXES = [
  { weapon: 'rifle', x: 7, z: 79 },   // primera caja, justo fuera de la puerta de la zona segura
  { weapon: 'pistol', x: -12, z: 70 },
  { weapon: 'rifle', x: 12, z: 75 },
  { weapon: 'rifle', x: 5.5, z: 58 },
  { weapon: 'pistol', x: -63, z: 40 },
  { weapon: 'rifle', x: -60, z: 12 },
  { weapon: 'rifle', x: 58, z: 22 },
  { weapon: 'pistol', x: -20, z: 33 },
  { weapon: 'rifle', x: 28, z: -9 },
  { weapon: 'pistol', x: 0, z: -29 },
  { weapon: 'rifle', x: -30, z: -53 },
  { weapon: 'pistol', x: 26, z: -48 },
  { weapon: 'rifle', x: 0, z: -58 },
];

// ---------- helpers puros ----------
export const vehicleBox = (v) => {
  const s = VEHICLE_SIZES[v.t];
  const hx = (v.rot === 90 ? s.L : s.W) / 2;
  const hz = (v.rot === 90 ? s.W : s.L) / 2;
  return { minX: v.x - hx, maxX: v.x + hx, minZ: v.z - hz, maxZ: v.z + hz, minY: 0, maxY: s.H };
};

export const barrierBox = (b) => ({
  minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: 0,
  maxY: b.t === 'jersey' ? 1.0 : b.t === 'sandbag' ? 1.1 : b.t === 'dumpster' ? 1.5 : 1.2,
});

// ---------- PROPS DE MANZANAS ABIERTAS (estacionamiento, parque, obra, patio de contenedores) ----------
export const CONTAINER_SIZE = { L: 6.1, W: 2.44, H: 2.6 };
export const HELICOPTER = { x: 0, z: -101, L: 8, W: 2.6, H: 3.2 };

export function generateYardProps() {
  const rng = mulberry32(777);
  const vehicles = [], containers = [], trees = [], rubble = [], benches = [];
  const colors = [0x6a3a2a, 0x2a4a6a, 0x4a5a3a, 0x7a6a2a, 0x5a2a2a, 0x3a3a4a];

  // Estacionamiento: x 7..54, z -4..24 (dos filas de autos con pasillo central)
  for (const z of [2, 18]) {
    for (let i = 0; i < 6; i++) {
      if (rng() < 0.22) continue; // plazas vacías
      vehicles.push({ t: rng() < 0.2 ? 'van' : 'car', x: 14 + i * 7, z, rot: 0, c: colors[Math.floor(rng() * colors.length)] });
    }
  }

  // Patio de contenedores: x 7..54, z -44..-16
  const cx = [15, 26, 37, 48];
  for (const z of [-40, -22]) for (const x of cx) containers.push({ x, z, rot: 90, c: colors[Math.floor(rng() * colors.length)], stacked: rng() < 0.4 });
  containers.push({ x: 21, z: -31, rot: 90, c: 0x7a3a1a, stacked: false }, { x: 42, z: -31, rot: 90, c: 0x2a5a5a, stacked: true });

  // Obra: x -54..-7, z -44..-16
  containers.push({ x: -46, z: -40, rot: 90, c: 0x9a6a1a, stacked: false }, { x: -28, z: -38, rot: 90, c: 0x3a5a7a, stacked: false }, { x: -20, z: -22, rot: 90, c: 0x5a3a3a, stacked: true });
  rubble.push({ x: -40, z: -26, w: 5, d: 3.4, h: 1.3 }, { x: -14, z: -34, w: 3.6, d: 4, h: 1.1 }, { x: -34, z: -20, w: 3, d: 2.6, h: 0.9 });

  // Parque: x -54..-7, z 36..64 (árboles secos, fuente destruida, bancas)
  const fountain = { x: -30, z: 50, w: 5, d: 5, h: 1.2 };
  rubble.push(fountain);
  for (let i = 0; i < 16; i++) {
    const x = -50 + rng() * 40, z = 40 + rng() * 22;
    if (Math.hypot(x - fountain.x, z - fountain.z) < 6) continue;
    trees.push({ x, z, h: 4 + rng() * 3 });
  }
  benches.push({ x: -22, z: 50, w: 1.8, d: 0.6 }, { x: -38, z: 56, w: 0.6, d: 1.8 }, { x: -44, z: 44, w: 1.8, d: 0.6 });
  return { vehicles, containers, trees, rubble, benches };
}

export function containerBox(c) {
  const hx = (c.rot === 90 ? CONTAINER_SIZE.L : CONTAINER_SIZE.W) / 2;
  const hz = (c.rot === 90 ? CONTAINER_SIZE.W : CONTAINER_SIZE.L) / 2;
  return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz, minY: 0, maxY: c.stacked ? CONTAINER_SIZE.H * 2 : CONTAINER_SIZE.H };
}

/** Todos los colisionadores estáticos del mundo (AABB). Los usan WorldBuilder y los tests. */
export function buildColliders() {
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
  add({ minX: -8.15, maxX: -7.85, minZ: 89.85, maxZ: 90.15, minY: 0, maxY: 6 }, 'pole'); // poste del reflector
  // Helicóptero de extracción (decorativo pero sólido)
  const h = HELICOPTER;
  add({ minX: h.x - h.W / 2, maxX: h.x + h.W / 2, minZ: h.z - h.L / 2, maxZ: h.z + h.L / 2, minY: 0, maxY: h.H }, 'helicopter');
  return out;
}
