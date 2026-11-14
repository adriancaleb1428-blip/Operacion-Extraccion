/**
 * Generador de modelos GLB PROVISIONALES (placeholders).
 *
 * Crea archivos .glb reales (formato glTF 2.0 binario) a partir de cajas simples, para que el
 * juego pueda cargar y probar el pipeline GLTFLoader aunque todavía no existan los modelos finales.
 *
 * Cada GLB generado incluye  asset.extras.placeholder = true  y el juego lo detecta para mostrar
 * "PROVISIONAL" en el reporte de recursos. Para usar modelos reales basta con sobrescribir los
 * archivos en public/assets/models/ (ver README.md) — no hay que tocar el código.
 *
 * Uso:  npm run gen:models
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'models');

// ---------- utilidades de color / geometría ----------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexToLinear = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => srgbToLinear(v / 255));

function quatFromEuler(x = 0, y = 0, z = 0) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

function boxBuffers([w, h, d], [ox, oy, oz]) {
  const pos = [], nor = [], idx = [];
  FACES.forEach((f, i) => {
    f.v.forEach((v) => {
      pos.push(ox + (v[0] * w) / 2, oy + (v[1] * h) / 2, oz + (v[2] * d) / 2);
      nor.push(...f.n);
    });
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

/**
 * Construye un GLB. parts: [{ name, size:[w,h,d], pos:[x,y,z], offset:[ox,oy,oz], rot:[rx,ry,rz], color, emissive, metal, rough, parent }]
 * `pos` es el pivote del nodo (útil para animar piernas/brazos desde la cadera/hombro) y `offset` el centro de la caja respecto al pivote.
 */
function buildGLB(name, parts) {
  const materials = [];
  const matIndex = new Map();
  const getMat = (p) => {
    const key = [p.color, p.emissive ?? 0, p.metal ?? 0, p.rough ?? 0.8].join('|');
    if (!matIndex.has(key)) {
      const m = {
        name: `mat_${materials.length}`,
        pbrMetallicRoughness: { baseColorFactor: [...hexToLinear(p.color), 1], metallicFactor: p.metal ?? 0.1, roughnessFactor: p.rough ?? 0.8 },
      };
      if (p.emissive) m.emissiveFactor = hexToLinear(p.emissive);
      matIndex.set(key, materials.length);
      materials.push(m);
    }
    return matIndex.get(key);
  };

  const bufferViews = [], accessors = [], meshes = [], nodes = [];
  const chunks = [];
  let byteOffset = 0;
  const pushBuffer = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
    chunks.push(bytes);
    byteOffset += bytes.length; // todos los tamaños son múltiplos de 4
    return bufferViews.length - 1;
  };

  const nodeIndexByName = new Map();
  parts.forEach((p) => {
    const g = boxBuffers(p.size, p.offset ?? [0, 0, 0]);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g.pos[i + k]); max[k] = Math.max(max[k], g.pos[i + k]); }
    const bvPos = pushBuffer(g.pos, 34962), bvNor = pushBuffer(g.nor, 34962), bvIdx = pushBuffer(g.idx, 34963);
    accessors.push({ bufferView: bvPos, componentType: 5126, count: 24, type: 'VEC3', min, max });
    const aPos = accessors.length - 1;
    accessors.push({ bufferView: bvNor, componentType: 5126, count: 24, type: 'VEC3' });
    const aNor = accessors.length - 1;
    accessors.push({ bufferView: bvIdx, componentType: 5123, count: 36, type: 'SCALAR' });
    const aIdx = accessors.length - 1;
    meshes.push({ name: p.name, primitives: [{ attributes: { POSITION: aPos, NORMAL: aNor }, indices: aIdx, material: getMat(p) }] });
    nodes.push({ name: p.name, mesh: meshes.length - 1, translation: p.pos ?? [0, 0, 0], rotation: quatFromEuler(...(p.rot ?? [0, 0, 0])) });
    nodeIndexByName.set(p.name, nodes.length - 1);
  });

  const rootChildren = nodes.map((_, i) => i);
  nodes.push({ name, children: rootChildren });
  const json = {
    asset: { version: '2.0', generator: 'Operacion Extraccion - generate-placeholder-models.mjs', extras: { placeholder: true, note: 'Modelo PROVISIONAL generado con cajas. Reemplazar por un GLB real.' } },
    scene: 0,
    scenes: [{ name, nodes: [nodes.length - 1] }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  let bin = Buffer.concat(chunks);
  bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii'); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.write('JSON', 4, 'ascii');
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4, 'ascii');
  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}

const FORCE = process.argv.includes('--force');

/** ¿El archivo existente es un modelo REAL (no provisional)? Entonces no se sobrescribe sin --force. */
function isRealModel(file) {
  try {
    const b = readFileSync(file);
    const len = b.readUInt32LE(12);
    return !JSON.parse(b.toString('utf8', 20, 20 + len)).asset?.extras?.placeholder;
  } catch { return false; }
}

function save(relPath, buffer) {
  const full = resolve(ROOT, relPath);
  if (existsSync(full) && !FORCE && isRealModel(full)) {
    console.log(`  ↷ ${relPath}  (modelo real existente: no se sobrescribe; usa --force para forzar)`);
    return;
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buffer);
  console.log(`  ✔ ${relPath}  (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ---------- ARMAS (apuntan hacia -Z, convención de la cámara de three.js) ----------
const METAL = 0x2b2e33, DARK = 0x1a1c1f, TAN = 0x6b5a3a;

const rifle = [
  { name: 'receiver', size: [0.07, 0.11, 0.42], pos: [0, 0, 0], color: METAL, metal: 0.6, rough: 0.5 },
  { name: 'handguard', size: [0.08, 0.075, 0.26], pos: [0, -0.005, -0.32], color: TAN, rough: 0.9 },
  { name: 'barrel', size: [0.028, 0.028, 0.3], pos: [0, 0.01, -0.6], color: DARK, metal: 0.8, rough: 0.35 },
  { name: 'muzzle', size: [0.04, 0.04, 0.05], pos: [0, 0.01, -0.77], color: DARK, metal: 0.8, rough: 0.35 },
  { name: 'stock', size: [0.055, 0.13, 0.26], pos: [0, -0.02, 0.33], color: TAN, rough: 0.9 },
  { name: 'magazine', size: [0.05, 0.17, 0.075], pos: [0, -0.13, -0.06], rot: [0.22, 0, 0], color: DARK, metal: 0.4 },
  { name: 'grip', size: [0.045, 0.11, 0.05], pos: [0, -0.1, 0.14], rot: [-0.3, 0, 0], color: DARK },
  { name: 'sight', size: [0.03, 0.045, 0.12], pos: [0, 0.085, -0.1], color: DARK, metal: 0.5 },
  { name: 'accent', size: [0.072, 0.012, 0.1], pos: [0, 0.058, 0.02], color: 0xc9892a, emissive: 0x3a2308 },
];

const pistol = [
  { name: 'slide', size: [0.036, 0.05, 0.2], pos: [0, 0.02, -0.02], color: 0x3b3f45, metal: 0.7, rough: 0.4 },
  { name: 'frame', size: [0.034, 0.03, 0.17], pos: [0, -0.012, -0.01], color: DARK, metal: 0.4 },
  { name: 'barrelTip', size: [0.022, 0.022, 0.03], pos: [0, 0.022, -0.125], color: DARK, metal: 0.8 },
  { name: 'grip', size: [0.036, 0.12, 0.058], pos: [0, -0.07, 0.07], rot: [-0.22, 0, 0], color: 0x2c2218, rough: 0.9 },
  { name: 'sightFront', size: [0.008, 0.012, 0.012], pos: [0, 0.05, -0.1], color: 0xffffff, emissive: 0x333333 },
  { name: 'sightRear', size: [0.018, 0.012, 0.012], pos: [0, 0.05, 0.07], color: 0xffffff, emissive: 0x333333 },
];

// ---------- ZOMBIS (miran hacia +Z, ~1.8 m de alto) ----------
function zombie({ skin, shirt, pants, eyes = 0xff2a1a, blood = 0x5a0d0d, scale = 1 }) {
  const s = (v) => v.map((x) => x * scale);
  return [
    { name: 'legL', size: s([0.22, 0.85, 0.26]), pos: s([-0.15, 0.85, 0]), offset: s([0, -0.425, 0]), color: pants },
    { name: 'legR', size: s([0.22, 0.85, 0.26]), pos: s([0.15, 0.85, 0]), offset: s([0, -0.425, 0]), color: pants },
    { name: 'torso', size: s([0.52, 0.64, 0.3]), pos: s([0, 0.85, 0]), offset: s([0, 0.32, 0]), rot: [0.14, 0, 0], color: shirt, rough: 0.95 },
    { name: 'blood', size: s([0.3, 0.2, 0.02]), pos: s([0.05, 1.2, 0.2]), rot: [0.14, 0, 0], color: blood, rough: 1 },
    { name: 'head', size: s([0.27, 0.3, 0.27]), pos: s([0, 1.5, 0.08]), offset: s([0, 0.15, 0]), color: skin },
    { name: 'eyeL', size: s([0.05, 0.04, 0.02]), pos: s([-0.065, 1.62, 0.225]), color: eyes, emissive: eyes },
    { name: 'eyeR', size: s([0.05, 0.04, 0.02]), pos: s([0.065, 1.62, 0.225]), color: eyes, emissive: eyes },
    { name: 'armL', size: s([0.14, 0.64, 0.14]), pos: s([-0.35, 1.42, 0.05]), offset: s([0, -0.32, 0]), rot: [-1.35, 0, 0.12], color: skin },
    { name: 'armR', size: s([0.14, 0.64, 0.14]), pos: s([0.35, 1.42, 0.05]), offset: s([0, -0.32, 0]), rot: [-1.2, 0, -0.12], color: skin },
  ];
}

console.log('Generando modelos GLB provisionales en public/assets/models/ ...');
save('weapons/rifle.glb', buildGLB('Rifle_PLACEHOLDER', rifle));
save('weapons/pistol.glb', buildGLB('Pistol_PLACEHOLDER', pistol));
save('zombies/zombie_a.glb', buildGLB('Zombie_A_PLACEHOLDER', zombie({ skin: 0x7c9a6b, shirt: 0x5a3d2e, pants: 0x2d3a4a })));
save('zombies/zombie_b.glb', buildGLB('Zombie_B_PLACEHOLDER', zombie({ skin: 0xa8b59a, shirt: 0x7a1f1f, pants: 0x333333, scale: 1.04 })));
save('zombies/zombie_c.glb', buildGLB('Zombie_C_PLACEHOLDER', zombie({ skin: 0x6b8f6b, shirt: 0x2f4a6b, pants: 0x4a3b2a, scale: 0.96 })));
console.log('Listo. Son modelos PROVISIONALES: sobrescribe los archivos con GLB reales cuando los tengas.');
