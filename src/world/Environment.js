import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WORLD, mulberry32 } from './levelData.js';
import { createGroundTexture, createSkyTexture, createFacadeTextures } from './Textures.js';
import { mat, part } from './Props.js';

/**
 * Ambientación general: cielo crepuscular, niebla, luna, luces, suelo y muros perimetrales
 * con siluetas de ciudad a lo lejos. (Pocas luces: 1 hemisférica + 1 direccional con sombras.)
 */
export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.disposables = [];
    this.root = new THREE.Group();
    scene.add(this.root);

    scene.fog = new THREE.FogExp2(0x2d2f38, 0.0125);

    // --- cielo (esfera con degradado, centrada en la cámara) ---
    const skyTex = createSkyTexture();
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.render.far * 0.9, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.sky.renderOrder = -10;
    this.root.add(this.sky);
    this.disposables.push(skyTex, this.sky.geometry, this.sky.material);

    // luna
    const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
    moon.position.set(-160, 190, -240);
    this.sky.add(moon);
    this.disposables.push(moon.geometry, moon.material);

    // --- luces ---
    const hemi = new THREE.HemisphereLight(0x8d9bc0, 0x2b2a2e, 1.55);
    this.root.add(hemi);
    this.sun = new THREE.DirectionalLight(0xb7c4ff, 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
    const r = CONFIG.render.shadowRadius;
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sunOffset = new THREE.Vector3(-45, 90, 35);
    this.root.add(this.sun, this.sun.target);

    // --- suelo ---
    const groundTex = createGroundTexture();
    const w = WORLD.maxX - WORLD.minX, d = WORLD.maxZ - WORLD.minZ;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.92, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2);
    ground.receiveShadow = true;
    this.root.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.03;
    this.root.add(outer);
    this.disposables.push(groundTex, ground.geometry, ground.material, outer.geometry, outer.material);

    this._buildPerimeter();
  }

  /** Muros altos en el borde del mapa + siluetas de edificios lejanos (decorativas). */
  _buildPerimeter() {
    const wall = mat(0x3a3b3e, { rough: 1 });
    const t = 1.2, h = 7, ext = 6;
    const cx = (WORLD.minX + WORLD.maxX) / 2, cz = (WORLD.minZ + WORLD.maxZ) / 2;
    const W = WORLD.maxX - WORLD.minX + ext, D = WORLD.maxZ - WORLD.minZ + ext;
    part(this.root, W, h, t, cx, h / 2, WORLD.minZ - t / 2, wall, { receive: true });
    part(this.root, W, h, t, cx, h / 2, WORLD.maxZ + t / 2, wall, { receive: true });
    part(this.root, t, h, D, WORLD.minX - t / 2, h / 2, cz, wall, { receive: true });
    part(this.root, t, h, D, WORLD.maxX + t / 2, h / 2, cz, wall, { receive: true });

    // Siluetas lejanas con ventanas encendidas (un material por estilo)
    const rng = mulberry32(4242);
    const styles = [0, 1, 2].map((s) => {
      const tex = createFacadeTextures(s);
      this.disposables.push(tex.map, tex.emissiveMap);
      return tex;
    });
    for (let i = 0; i < 70; i++) {
      const side = i % 4;
      const along = rng();
      const dist = 12 + rng() * 55;
      const bw = 14 + rng() * 22, bd = 14 + rng() * 22, bh = 30 + rng() * 70;
      let x, z;
      if (side === 0) { x = WORLD.minX + along * (WORLD.maxX - WORLD.minX); z = WORLD.minZ - dist; }
      else if (side === 1) { x = WORLD.minX + along * (WORLD.maxX - WORLD.minX); z = WORLD.maxZ + dist; }
      else if (side === 2) { x = WORLD.minX - dist; z = WORLD.minZ + along * (WORLD.maxZ - WORLD.minZ); }
      else { x = WORLD.maxX + dist; z = WORLD.minZ + along * (WORLD.maxZ - WORLD.minZ); }
      const s = styles[i % 3];
      const m = new THREE.MeshStandardMaterial({ map: s.map.clone(), emissiveMap: s.emissiveMap.clone(), emissive: 0xffffff, color: 0x888890, roughness: 1 });
      m.map.repeat.set(Math.round(bw / 4), Math.round(bh / 4));
      m.emissiveMap.repeat.copy(m.map.repeat);
      m.map.needsUpdate = m.emissiveMap.needsUpdate = true;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
      b.position.set(x, bh / 2, z);
      this.root.add(b);
      this.disposables.push(b.geometry, m, m.map, m.emissiveMap);
    }
  }

  /** La luz direccional y el cielo siguen a la cámara (sombras nítidas cerca del jugador). */
  update(focus) {
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.copy(this.sun.target.position).add(this.sunOffset);
    this.sky.position.set(focus.x, 0, focus.z);
  }

  dispose() {
    this.scene.remove(this.root);
    for (const d of this.disposables) d.dispose?.();
    this.scene.fog = null;
  }
}
