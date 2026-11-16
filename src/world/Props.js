import * as THREE from 'three';
import { VEHICLE_SIZES, CONTAINER_SIZE } from './levelData.js';

/**
 * Constructores de objetos de escenografía (vehículos, barreras, árboles...) hechos con cajas.
 * Todos comparten UNA geometría de caja unitaria y materiales cacheados -> poca memoria.
 */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const matCache = new Map();

export function mat(color, { rough = 0.85, metal = 0.1, emissive = 0x000000, emissiveIntensity = 1 } = {}) {
  const key = `${color}|${rough}|${metal}|${emissive}|${emissiveIntensity}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity }));
  }
  return matCache.get(key);
}

export function disposeProps() {
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
}

export function part(parent, w, h, d, x, y, z, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function cylinder(parent, r, h, x, y, z, material, rotX = 0) {
  const m = new THREE.Mesh(UNIT_CYL, material);
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  m.castShadow = true;
  parent.add(m);
  return m;
}

const GLASS = () => mat(0x10161c, { rough: 0.2, metal: 0.6 });
const TIRE = () => mat(0x0c0c0d, { rough: 0.95 });

/** Vehículo abandonado. rot: 0 -> eje largo en Z; 90 -> eje largo en X. */
export function createVehicle(v, sizes = VEHICLE_SIZES) {
  const { L, W, H } = sizes[v.t];
  const g = new THREE.Group();
  const body = mat(v.c, { rough: 0.55, metal: 0.45 });
  const rust = mat(0x4a2c1c, { rough: 1 });
  const wheelR = v.t === 'bus' || v.t === 'truck' ? 0.55 : 0.36;

  if (v.t === 'bus') {
    part(g, W, H - wheelR * 0.4, L, 0, (H + wheelR * 0.4) / 2 - 0.1, 0, body);
    for (let i = -4; i <= 4; i++) { // ventanas laterales
      part(g, W + 0.04, 0.9, 0.9, 0, H * 0.68, i * 1.15, GLASS(), { cast: false });
    }
    part(g, W - 0.2, 0.9, 0.05, 0, H * 0.68, L / 2 + 0.01, GLASS(), { cast: false });
  } else if (v.t === 'truck') {
    part(g, W, 2.2, 2.4, 0, 1.55, -L / 2 + 1.2, body);                       // cabina
    part(g, W - 0.3, 0.9, 0.05, 0, 2.0, -L / 2 - 0.01, GLASS(), { cast: false });
    part(g, W, H - 0.4, L - 2.8, 0, (H - 0.4) / 2 + 0.55, 1.4, mat(0x8a8a82, { rough: 0.9 })); // caja de carga
  } else if (v.t === 'van') {
    part(g, W, H - 0.55, L, 0, (H - 0.55) / 2 + 0.55, 0, body);
    part(g, W - 0.2, 0.7, 0.06, 0, H - 0.65, -L / 2 - 0.01, GLASS(), { cast: false });
  } else {
    // auto / chasis destruido
    part(g, W, 0.62, L, 0, 0.7, 0, v.t === 'wreck' ? rust : body);
    part(g, W - 0.15, 0.58, L * 0.5, 0, 1.28, L * 0.05, v.t === 'wreck' ? mat(0x2a2220) : GLASS());
    part(g, W - 0.1, 0.05, L * 0.28, 0, 1.58, L * 0.05, body, { cast: false });
  }

  // ruedas
  const zs = v.t === 'bus' ? [-3.6, 3.4] : v.t === 'truck' ? [-2.4, 1.2, 2.8] : [-L * 0.32, L * 0.32];
  for (const z of zs) for (const sx of [-1, 1]) {
    const w = cylinder(g, wheelR, 0.3, sx * (W / 2 - 0.05), wheelR, z, TIRE(), 0);
    w.rotation.z = Math.PI / 2;
  }
  // luces traseras rotas / faros apagados (emisivo tenue)
  if (v.t !== 'wreck') part(g, W - 0.5, 0.12, 0.05, 0, 0.78, -L / 2 - 0.02, mat(0x601010, { emissive: 0x300505 }), { cast: false });

  const rotY = v.rot === 90 ? Math.PI / 2 : 0;
  g.rotation.y = rotY;
  g.position.set(v.x, 0, v.z);
  g.rotation.z = 0; // el chasis no se inclina para que el AABB sea exacto
  return g;
}

export function createBarrier(b) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z);
  if (b.t === 'jersey') {
    const concrete = mat(0x8c8c88, { rough: 0.95 });
    const n = Math.max(1, Math.round(Math.max(b.w, b.d) / 1.5));
    const along = b.w >= b.d;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * (Math.max(b.w, b.d) / n);
      part(g, along ? Math.max(b.w, b.d) / n - 0.05 : b.w, 0.55, along ? b.d : Math.max(b.w, b.d) / n - 0.05, along ? o : 0, 0.28, along ? 0 : o, concrete);
      part(g, along ? Math.max(b.w, b.d) / n - 0.05 : b.w * 0.6, 0.5, along ? b.d * 0.55 : Math.max(b.w, b.d) / n - 0.05, along ? o : 0, 0.8, along ? 0 : o, concrete);
      part(g, along ? 0.5 : b.w + 0.01, 0.12, along ? b.d + 0.01 : 0.5, along ? o : 0, 0.6, along ? 0 : o, mat(0xc03a1a, { rough: 0.7 }), { cast: false });
    }
  } else if (b.t === 'sandbag') {
    const sand = mat(0x7a6a48, { rough: 1 });
    part(g, b.w, 0.55, b.d, 0, 0.28, 0, sand);
    part(g, b.w * 0.85, 0.5, b.d * 0.8, 0, 0.8, 0, sand);
  } else if (b.t === 'dumpster') {
    part(g, b.w, 1.2, b.d, 0, 0.7, 0, mat(0x2a5a3a, { rough: 0.7, metal: 0.4 }));
    part(g, b.w + 0.1, 0.1, b.d + 0.1, 0, 1.35, 0, mat(0x1a3a28));
  } else {
    part(g, b.w, b.w, b.d, 0, b.w / 2, 0, mat(0x8a6a3a, { rough: 0.9 }));
    part(g, b.w + 0.02, 0.1, b.d + 0.02, 0, b.w * 0.5, 0, mat(0x5a4222), { cast: false });
  }
  return g;
}

export function createContainer(c) {
  const g = new THREE.Group();
  const { L, W, H } = CONTAINER_SIZE;
  const metal = mat(c.c, { rough: 0.6, metal: 0.5 });
  const levels = c.stacked ? 2 : 1;
  for (let i = 0; i < levels; i++) {
    part(g, L, H, W, 0, H / 2 + i * H, 0, metal);
    for (let k = -2; k <= 2; k++) part(g, 0.08, H - 0.1, W + 0.06, k * (L / 5.5), H / 2 + i * H, 0, mat(0x000000, { rough: 1 }), { cast: false }).material = mat(0x1a1a1a);
  }
  g.rotation.y = c.rot === 90 ? 0 : Math.PI / 2; // L está en X por defecto; rot 0 -> eje largo en Z
  g.position.set(c.x, 0, c.z);
  return g;
}

export function createTree(t) {
  const g = new THREE.Group();
  const bark = mat(0x2a2018, { rough: 1 });
  part(g, 0.35, t.h, 0.35, 0, t.h / 2, 0, bark);
  for (let i = 0; i < 4; i++) { // ramas secas
    const a = (i / 4) * Math.PI * 2 + t.x;
    const br = part(g, 0.14, 1.8, 0.14, Math.cos(a) * 0.5, t.h * (0.65 + 0.1 * (i % 2)), Math.sin(a) * 0.5, bark);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
  g.position.set(t.x, 0, t.z);
  return g;
}

export function createRubble(r) {
  const g = new THREE.Group();
  const stone = mat(0x6a655c, { rough: 1 });
  part(g, r.w, r.h * 0.6, r.d, 0, r.h * 0.3, 0, stone);
  part(g, r.w * 0.6, r.h * 0.7, r.d * 0.6, r.w * 0.05, r.h * 0.65, 0, mat(0x59554e, { rough: 1 }));
  part(g, 0.3, r.h * 1.3, 0.3, r.w * 0.3, r.h * 0.65, r.d * 0.2, mat(0x3a2a22)); // varilla/viga
  g.position.set(r.x, 0, r.z);
  return g;
}

export function createBench(b) {
  const g = new THREE.Group();
  const wood = mat(0x4a3622, { rough: 1 });
  const alongX = b.w >= b.d;
  part(g, b.w, 0.1, b.d, 0, 0.45, 0, wood);
  part(g, alongX ? b.w : 0.08, 0.5, alongX ? 0.08 : b.d, 0, 0.75, alongX ? -b.d / 2 : -b.w / 2, wood);
  part(g, alongX ? 0.1 : b.w, 0.45, alongX ? b.d : 0.1, alongX ? -b.w / 2 + 0.1 : 0, 0.22, alongX ? 0 : -b.d / 2 + 0.1, mat(0x222222, { metal: 0.6 }));
  part(g, alongX ? 0.1 : b.w, 0.45, alongX ? b.d : 0.1, alongX ? b.w / 2 - 0.1 : 0, 0.22, alongX ? 0 : b.d / 2 - 0.1, mat(0x222222, { metal: 0.6 }));
  g.position.set(b.x, 0, b.z);
  return g;
}

/** Farola: poste + brazo + cabeza con foco apagado/tenue. */
export function createLamp(l) {
  const g = new THREE.Group();
  const metal = mat(0x2a2c30, { rough: 0.6, metal: 0.7 });
  part(g, 0.18, 7, 0.18, 0, 3.5, 0, metal);
  const dir = l.dir ?? (l.x < 0 ? 1 : -1); // brazo hacia la calle
  part(g, 1.6, 0.12, 0.12, dir * 0.8, 6.9, 0, metal);
  part(g, 0.6, 0.15, 0.3, dir * 1.5, 6.82, 0, mat(0xcfc6a0, { emissive: Math.random() < 0.25 ? 0x7a6a30 : 0x1a1608, emissiveIntensity: 1 }), { cast: false });
  g.position.set(l.x, 0, l.z);
  return g;
}

/** Barril con fuego (la luz PointLight se añade aparte en WorldBuilder). */
export function createFireBarrel(f) {
  const g = new THREE.Group();
  cylinder(g, 0.4, 1.0, 0, 0.5, 0, mat(0x6a2a1a, { rough: 0.7, metal: 0.5 }));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 7), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.y = 1.35;
  flame.name = 'flame';
  g.add(flame);
  g.position.set(f.x, 0, f.z);
  return g;
}

/** Helicóptero de extracción (decorativo). Mira hacia +Z. */
export function createHelicopter(h) {
  const g = new THREE.Group();
  const body = mat(0x3a4a3a, { rough: 0.5, metal: 0.5 });
  part(g, 2.2, 1.9, 4.6, 0, 1.6, 0.4, body);
  part(g, 2.0, 1.4, 1.8, 0, 1.55, 3.1, GLASS());
  part(g, 0.5, 0.6, 3.6, 0, 1.9, -3.2, body);
  part(g, 0.1, 1.4, 0.8, 0, 2.4, -4.4, body);
  part(g, 0.3, 0.4, 0.3, 0, 3.0, 0, mat(0x1a1a1a));
  part(g, 9.5, 0.06, 0.35, 0, 3.15, 0, mat(0x1a1a1a)).rotation.y = 0.5;
  part(g, 9.5, 0.06, 0.35, 0, 3.15, 0, mat(0x1a1a1a)).rotation.y = 0.5 + Math.PI / 2;
  for (const sx of [-1, 1]) part(g, 0.1, 0.1, 4.2, sx * 1.2, 0.35, 0.3, mat(0x222222));
  part(g, 0.7, 0.3, 0.1, 0, 1.0, 3.95, mat(0x9fe8a0, { emissive: 0x2a8a3a, emissiveIntensity: 1.4 }), { cast: false });
  g.position.set(h.x, 0, h.z);
  g.rotation.y = 0;
  return g;
}
