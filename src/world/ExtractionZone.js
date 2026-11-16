import * as THREE from 'three';
import { EXTRACTION } from './levelData.js';
import { createSignTexture } from './Textures.js';
import { mat, part } from './Props.js';

/**
 * Zona de extracción (RF08): plataforma circular verde, haz de luz visible desde lejos,
 * letrero y luz verde. `contains()` decide si el jugador completó la misión.
 */
export class ExtractionZone {
  constructor(scene) {
    this.scene = scene;
    this.center = new THREE.Vector3(EXTRACTION.x, 0, EXTRACTION.z);
    this.radius = EXTRACTION.radius;
    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    this.disposables = [];

    const green = 0x35ff7a;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(this.radius, 40), new THREE.MeshBasicMaterial({ color: green, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.radius - 0.35, this.radius, 48), new THREE.MeshBasicMaterial({ color: green, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;
    const inner = new THREE.Mesh(new THREE.RingGeometry(this.radius * 0.45, this.radius * 0.5, 40), ring.material);
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.07;
    this.group.add(disc, ring, inner);

    // Haz de luz corto (la zona está escondida: solo se ve al acercarse)
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.0, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x18d86a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.beam.position.y = 13; // haz corto y afectado por la niebla: no se ve desde lejos
    this.group.add(this.beam);

    // Letrero sobre postes
    const signTex = createSignTexture('EXTRACCIÓN', { bg: '#0c1a10', fg: '#6dffa0', border: '#35ff7a', size: 70 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 5.2, this.radius + 0.5);
    sign.rotation.y = 0;
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z -= 0.05;
    this.group.add(sign, back);
    const pole = mat(0x2a2c30, { metal: 0.6 });
    part(this.group, 0.2, 5.2, 0.2, -2.8, 2.6, this.radius + 0.45, pole);
    part(this.group, 0.2, 5.2, 0.2, 2.8, 2.6, this.radius + 0.45, pole);

    this.light = new THREE.PointLight(green, 160, 30, 2);
    this.light.position.set(0, 4, 0);
    this.group.add(this.light);

    scene.add(this.group);
    this.disposables.push(disc.geometry, disc.material, ring.geometry, ring.material, inner.geometry, this.beam.geometry, this.beam.material, sign.geometry, sign.material, signTex);
  }

  /** ¿El jugador está dentro de la zona? (plano XZ) */
  contains(p) {
    return Math.hypot(p.x - this.center.x, p.z - this.center.z) <= this.radius;
  }

  update(time) {
    this.beam.material.opacity = 0.15 + Math.sin(time * 2.2) * 0.04;
    this.light.intensity = 150 + Math.sin(time * 3) * 30;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const d of this.disposables) d.dispose?.();
  }
}
