import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Carga de modelos GLB con control de errores y reporte HONESTO del origen de cada recurso:
 *   'real'        -> GLB cargado correctamente (modelo final)
 *   'placeholder' -> GLB cargado, pero marcado como provisional (asset.extras.placeholder)
 *   'fallback'    -> el GLB no existe / falló: se usa geometría programada (NO es un GLB)
 */
export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.report = []; // [{ role, url, status, error? }]
  }

  /**
   * @param {string} url ruta del .glb
   * @param {string} role descripción para el reporte (p. ej. "arma: rifle")
   * @param {() => THREE.Object3D} fallbackFactory crea un modelo de emergencia si el GLB falla
   */
  load(url, role, fallbackFactory) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = this.loader
      .loadAsync(url)
      .then((gltf) => {
        const status = gltf.asset?.extras?.placeholder ? 'placeholder' : 'real';
        this.report.push({ role, url, status });
        return { scene: gltf.scene, animations: gltf.animations ?? [], status };
      })
      .catch((error) => {
        console.warn(`[AssetLoader] No se pudo cargar ${url}. Se usa geometría de emergencia (NO es un GLB).`, error);
        this.report.push({ role, url, status: 'fallback', error: String(error?.message ?? error) });
        return { scene: fallbackFactory(), animations: [], status: 'fallback' };
      });
    this.cache.set(url, p);
    return p;
  }

  /** Resumen legible, p. ej. para el menú de créditos. */
  summary() {
    const count = (s) => this.report.filter((r) => r.status === s).length;
    return { real: count('real'), placeholder: count('placeholder'), fallback: count('fallback'), total: this.report.length };
  }
}

// ---------- modelos de emergencia (solo si falta/falla el GLB) ----------
const box = (w, h, d, x, y, z, color) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  return m;
};

export function createFallbackZombie() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.65, 0.3, 0, 1.17, 0, 0x5a3d2e), box(0.27, 0.3, 0.27, 0, 1.65, 0.05, 0x7c9a6b));
  const legL = box(0.22, 0.85, 0.26, -0.15, 0.425, 0, 0x2d3a4a); legL.name = 'legL';
  const legR = box(0.22, 0.85, 0.26, 0.15, 0.425, 0, 0x2d3a4a); legR.name = 'legR';
  g.add(legL, legR, box(0.14, 0.14, 0.6, -0.35, 1.3, 0.3, 0x7c9a6b), box(0.14, 0.14, 0.6, 0.35, 1.3, 0.3, 0x7c9a6b));
  return g;
}

export function createFallbackWeapon(length = 0.9) {
  const g = new THREE.Group();
  g.add(box(0.06, 0.1, length, 0, 0, 0, 0x2b2e33), box(0.05, 0.16, 0.07, 0, -0.12, length * 0.1, 0x1a1c1f));
  return g;
}
