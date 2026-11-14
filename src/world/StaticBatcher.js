import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Optimización de rendimiento: fusiona todas las mallas ESTÁTICAS de un grupo que comparten
 * material en una sola malla (vehículos, barreras, farolas, etc. pasan de cientos de draw calls
 * a unas pocas decenas). Se excluyen las mallas con material múltiple (edificios), las animadas
 * (llamas) y las marcadas con userData.noMerge.
 *
 * @returns {THREE.BufferGeometry[]} geometrías nuevas (para liberarlas en dispose)
 */
export function mergeStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const merged = [];

  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.name === 'flame' || o.userData.noMerge) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, meshes: [] });
    buckets.get(key).meshes.push(o);
  });

  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const geos = b.meshes.map((m) => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, m.matrixWorld)));
    const geometry = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geometry) continue; // atributos incompatibles: se deja sin fusionar
    for (const m of b.meshes) m.parent.remove(m);
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.renderOrder = b.order;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    merged.push(geometry);
  }
  return merged;
}
