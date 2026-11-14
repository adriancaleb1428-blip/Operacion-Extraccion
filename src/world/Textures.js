import * as THREE from 'three';
import { AVENUES, CROSS_STREETS, BLOCK_X, BLOCK_Z, WORLD, mulberry32 } from './levelData.js';

/** Texturas generadas con canvas (no se requieren archivos de imagen). */

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function finish(tex, { repeat = false, aniso = 8, srgb = true } = {}) {
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

/** Ruido de granulado para dar aspecto de asfalto/concreto. */
function speckle(g, w, h, rng, count, alpha, light = 255) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rng() * 90 + (light - 90));
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rng()})`;
    g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
}

/** Textura del suelo de toda la ciudad: asfalto, aceras, líneas, pasos de cebra, manchas y grietas. */
export function createGroundTexture() {
  const SIZE = 2048;
  const c = makeCanvas(SIZE, SIZE);
  const g = c.getContext('2d');
  const sx = SIZE / (WORLD.maxX - WORLD.minX);
  const sz = SIZE / (WORLD.maxZ - WORLD.minZ);
  const X = (x) => (x - WORLD.minX) * sx;
  const Z = (z) => (z - WORLD.minZ) * sz;
  const rng = mulberry32(99);

  // asfalto
  g.fillStyle = '#2a2c30';
  g.fillRect(0, 0, SIZE, SIZE);
  speckle(g, SIZE, SIZE, rng, 60000, 0.35, 140);

  // manzanas = acera de concreto
  g.fillStyle = '#585a5c';
  for (const [x1, x2] of BLOCK_X) for (const [z1, z2] of BLOCK_Z) g.fillRect(X(x1), Z(z1), X(x2) - X(x1), Z(z2) - Z(z1));
  // plaza y zona segura (suelo de concreto claro) conectados con la acera
  g.fillStyle = '#4d4f52';
  g.fillRect(X(-24), Z(-106), X(24) - X(-24), Z(-56) - Z(-106));
  g.fillRect(X(-22), Z(76), X(22) - X(-22), Z(106) - Z(76));
  speckle(g, SIZE, SIZE, rng, 30000, 0.25, 160);

  // bordillos
  g.strokeStyle = '#8a8c8e';
  g.lineWidth = 3;
  for (const [x1, x2] of BLOCK_X) for (const [z1, z2] of BLOCK_Z) g.strokeRect(X(x1), Z(z1), X(x2) - X(x1), Z(z2) - Z(z1));

  // líneas centrales amarillas discontinuas
  g.strokeStyle = '#b89a2a';
  g.lineWidth = 4;
  g.setLineDash([22, 26]);
  for (const a of AVENUES) { g.beginPath(); g.moveTo(X(a.x), 0); g.lineTo(X(a.x), SIZE); g.stroke(); }
  for (const s of CROSS_STREETS) { g.beginPath(); g.moveTo(0, Z(s.z)); g.lineTo(SIZE, Z(s.z)); g.stroke(); }
  g.setLineDash([]);

  // pasos de cebra en los cruces
  g.fillStyle = 'rgba(210,210,200,0.75)';
  for (const a of AVENUES) {
    for (const s of CROSS_STREETS) {
      const half = a.w / 2;
      for (let i = -half + 1; i < half - 0.5; i += 1.6) {
        g.fillRect(X(a.x + i), Z(s.z - s.w / 2 - 3.2), 0.9 * sx, 2.6 * sz);
        g.fillRect(X(a.x + i), Z(s.z + s.w / 2 + 0.6), 0.9 * sx, 2.6 * sz);
      }
    }
  }

  // manchas de aceite, sangre seca y grietas
  for (let i = 0; i < 90; i++) {
    const x = rng() * SIZE, z = rng() * SIZE, r = 6 + rng() * 26;
    const grad = g.createRadialGradient(x, z, 0, x, z, r);
    const blood = rng() < 0.3;
    grad.addColorStop(0, blood ? 'rgba(70,8,8,0.6)' : 'rgba(10,10,12,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, z - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(8,8,10,0.7)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) {
    let x = rng() * SIZE, z = rng() * SIZE;
    g.beginPath(); g.moveTo(x, z);
    for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 40; z += (rng() - 0.5) * 40; g.lineTo(x, z); }
    g.stroke();
  }

  // zona de extracción: parche con marcas
  return finish(new THREE.CanvasTexture(c), { aniso: 16 });
}

/** Fachadas de edificios: devuelve { map, emissiveMap } (ventanas encendidas al azar). */
export function createFacadeTextures(style) {
  const palettes = [
    { wall: '#6d6a64', win: '#15181c', trim: '#4a4844' },
    { wall: '#7a5a4a', win: '#14171a', trim: '#4f3a30' },
    { wall: '#575d66', win: '#101418', trim: '#3a3f46' },
  ];
  const p = palettes[style % palettes.length];
  const S = 256;
  const c = makeCanvas(S, S), e = makeCanvas(S, S);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  const rng = mulberry32(31 + style * 17);
  g.fillStyle = p.wall; g.fillRect(0, 0, S, S);
  speckle(g, S, S, rng, 2500, 0.4, 150);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const cols = 4, rows = 4, cw = S / cols, rh = S / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.2, y = j * rh + rh * 0.2, w = cw * 0.6, h = rh * 0.55;
      g.fillStyle = p.trim; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = p.win; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(120,140,170,0.18)'; g.fillRect(x, y, w, h * 0.4);
      if (rng() < 0.14) { // ventana encendida
        const warm = rng() < 0.7;
        g.fillStyle = warm ? '#e8b25a' : '#9ec4ff';
        g.fillRect(x, y, w, h);
        ge.fillStyle = warm ? '#8a5a1a' : '#3a5a8a';
        ge.fillRect(x, y, w, h);
      } else if (rng() < 0.12) { // ventana rota
        g.fillStyle = '#050607'; g.fillRect(x + w * 0.2, y, w * 0.8, h * 0.5);
      }
    }
  }
  // manchas de humedad
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(0,0,0,${0.08 + rng() * 0.12})`;
    g.fillRect(rng() * S, rng() * S, 6 + rng() * 14, 40 + rng() * 120);
  }
  return { map: finish(new THREE.CanvasTexture(c), { repeat: true }), emissiveMap: finish(new THREE.CanvasTexture(e), { repeat: true }) };
}

export function createRoofTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d'), rng = mulberry32(5);
  g.fillStyle = '#2b2c2e'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, rng, 1500, 0.5, 120);
  return finish(new THREE.CanvasTexture(c), { repeat: true });
}

/** Franjas amarillo/negro con texto de advertencia para zonas de peligro. */
export function createHazardTexture(label) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(120,10,10,0.35)'; g.fillRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.rect(0, 0, W, 26); g.rect(0, H - 26, W, 26); g.clip();
  for (let x = -H; x < W + H; x += 44) {
    g.fillStyle = '#d8b020'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 22 - H, H); g.lineTo(x - H, H); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(210,60,40,0.9)'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = 'rgba(230,70,50,0.9)'; g.font = 'bold 62px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('⚠ ' + label, W / 2, H / 2);
  return finish(new THREE.CanvasTexture(c));
}

/** Degradado de cielo crepuscular (para una esfera con BackSide). */
export function createSkyTexture() {
  const c = makeCanvas(16, 256), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#06080f');
  grad.addColorStop(0.35, '#121a2c');
  grad.addColorStop(0.62, '#3a3a4a');
  grad.addColorStop(0.78, '#7a5240');
  grad.addColorStop(0.9, '#c07a4a');
  grad.addColorStop(1, '#6a4a3a');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Letrero rectangular con texto (señales, "EXTRACCIÓN", "ZONA SEGURA"). */
export function createSignTexture(text, { bg = '#101418', fg = '#e8e8e8', border = '#d8b020', w = 512, h = 128, size = 64 } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = `bold ${size}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  return finish(new THREE.CanvasTexture(c));
}
