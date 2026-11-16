import * as THREE from 'three';
import {
  VEHICLES, BARRIERS, FIRE_BARRELS, HAZARD_ZONES, SAFE_ZONE, HELICOPTER, POLE, EXT_COMPOUND, EXT_GATE, extractionWalls,
  generateBuildings, generateLamps, generateYardProps, buildColliders,
} from './levelData.js';
import { createFacadeTextures, createRoofTexture, createHazardTexture, createSignTexture } from './Textures.js';
import { mergeStaticMeshes } from './StaticBatcher.js';
import {
  mat, part, createVehicle, createBarrier, createContainer, createTree, createRubble, createBench,
  createLamp, createFireBarrel, createHelicopter, disposeProps,
} from './Props.js';

/**
 * Construye la ciudad abandonada a partir de levelData.js y registra los colisionadores.
 * Responsabilidad: SOLO geometría estática y decoración. La lógica de juego vive en otros módulos.
 */
export class WorldBuilder {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.flames = [];
    this.fireLights = [];
    this.disposables = [];
    this.facadeCache = new Map();
  }

  build() {
    this._buildings();
    this._vehiclesAndProps();
    this._safeZone();
    this._hazardZones();
    this._fireBarrels();
    this._extractionCompound();
    this.disposables.push(...mergeStaticMeshes(this.root)); // rendimiento: menos draw calls
    this.collision.addBoxes(buildColliders());
    return this;
  }

  // ---- edificios con fachada texturizada (materiales compartidos por tamaño de repetición) ----
  _facadeMaterial(style, ru, rv) {
    const key = `${style}|${ru}|${rv}`;
    if (!this.facadeCache.has(key)) {
      const t = this._textures[style];
      const map = t.map.clone(); map.repeat.set(ru, rv); map.needsUpdate = true;
      const em = t.emissiveMap.clone(); em.repeat.set(ru, rv); em.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.95, metalness: 0.02 });
      this.facadeCache.set(key, m);
      this.disposables.push(map, em, m);
    }
    return this.facadeCache.get(key);
  }

  _buildings() {
    this._textures = {};
    for (const s of [0, 1, 2]) this._textures[s] = createFacadeTextures(s);
    for (const t of Object.values(this._textures)) this.disposables.push(t.map, t.emissiveMap);
    const roofTex = createRoofTexture();
    this.disposables.push(roofTex);
    const roof = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
    this.disposables.push(roof);

    for (const b of generateBuildings()) {
      const w = b.x2 - b.x1, d = b.z2 - b.z1, h = b.h;
      const rv = Math.max(1, Math.round(h / 4));
      const mx = this._facadeMaterial(b.style, Math.max(1, Math.round(d / 4)), rv); // caras ±X
      const mz = this._facadeMaterial(b.style, Math.max(1, Math.round(w / 4)), rv); // caras ±Z
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz]);
      mesh.position.set((b.x1 + b.x2) / 2, h / 2, (b.z1 + b.z2) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.disposables.push(mesh.geometry);
      // pequeños detalles de azotea (tanque / aire acondicionado)
      if (h > 14) part(this.root, Math.min(4, w * 0.25), 1.6, Math.min(4, d * 0.25), mesh.position.x + w * 0.2, h + 0.8, mesh.position.z - d * 0.15, mat(0x44464a, { metal: 0.4 }));
    }
  }

  _vehiclesAndProps() {
    const yard = generateYardProps();
    for (const v of [...VEHICLES, ...yard.vehicles]) this.root.add(createVehicle(v));
    for (const b of BARRIERS) this.root.add(createBarrier(b));
    for (const c of yard.containers) this.root.add(createContainer(c));
    for (const t of yard.trees) this.root.add(createTree(t));
    for (const r of yard.rubble) this.root.add(createRubble(r));
    for (const b of yard.benches) this.root.add(createBench(b));
    for (const l of generateLamps()) this.root.add(createLamp(l));
    this.root.add(createHelicopter(HELICOPTER));
  }

  /** Zona segura de inicio: vallas, puerta, letrero, tiendas y reflector. */
  _safeZone() {
    const s = SAFE_ZONE;
    const fence = mat(0x4a4d52, { rough: 0.5, metal: 0.7 });
    const cx = (s.x1 + s.x2) / 2, w = s.x2 - s.x1, zc = (s.z1 + s.z2) / 2, d = s.z2 - s.z1;
    const wire = new THREE.MeshStandardMaterial({ color: 0x6a6e74, transparent: true, opacity: 0.35, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide });
    this.disposables.push(wire);
    const fenceWall = (x, z, ww, dd) => {
      part(this.root, ww, 2.6, dd, x, 1.3, z, wire, { cast: false });
      const posts = Math.max(2, Math.round(Math.max(ww, dd) / 3));
      for (let i = 0; i <= posts; i++) {
        const o = (i / posts - 0.5) * Math.max(ww, dd);
        part(this.root, 0.14, 3, 0.14, ww > dd ? x + o : x, 1.5, ww > dd ? z : z + o, fence);
      }
    };
    fenceWall(s.x1, zc, 0.1, d); fenceWall(s.x2, zc, 0.1, d); fenceWall(cx, s.z2, w, 0.1);
    fenceWall((s.x1 - 12) / 2, s.z1, -12 - s.x1, 0.1); // tramos norte, dejando libre la puerta
    fenceWall((12 + s.x2) / 2, s.z1, s.x2 - 12, 0.1);

    // Puerta: postes y letrero
    const g = s.gateHalfWidth;
    part(this.root, 0.4, 4.4, 0.4, -g - 0.2, 2.2, s.z1, mat(0x3a3c40, { metal: 0.6 }));
    part(this.root, 0.4, 4.4, 0.4, g + 0.2, 2.2, s.z1, mat(0x3a3c40, { metal: 0.6 }));
    part(this.root, g * 2 + 1, 0.4, 0.4, 0, 4.4, s.z1, mat(0x3a3c40, { metal: 0.6 }));
    const tex = createSignTexture('ZONA SEGURA', { bg: '#0d1a22', fg: '#9fe0ff', border: '#3aa0d8', size: 58 });
    this.disposables.push(tex);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(g * 2 - 0.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
    sign.position.set(0, 3.6, s.z1 + 0.25);
    sign.rotation.y = Math.PI; // mira hacia el interior de la zona segura (+Z) ... se ve desde dentro y fuera
    const sign2 = sign.clone(); sign2.rotation.y = 0; sign2.position.z = s.z1 - 0.25;
    this.root.add(sign, sign2);

    // Tiendas militares y suministros decorativos (sin munición: la munición está en el escenario)
    const canvas = mat(0x4a5238, { rough: 1 });
    for (const [x, z] of [[-12, s.z2 - 6], [12, s.z2 - 5]]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(3, 2.6, 4), canvas);
      tent.rotation.y = Math.PI / 4; tent.position.set(x, 1.3, z); tent.castShadow = true;
      this.root.add(tent);
      this.disposables.push(tent.geometry);
    }
    part(this.root, 2.4, 1.2, 1.2, 0, 0.6, s.z2 - 3, mat(0x5a4a2a, { rough: 1 }));

    // Reflector de la zona segura (única luz cálida de inicio)
    part(this.root, 0.2, 6, 0.2, POLE.x, 3, POLE.z, mat(0x2a2c30, { metal: 0.6 }));
    part(this.root, 1.2, 0.4, 0.6, POLE.x, 6.1, POLE.z, mat(0xfff2c0, { emissive: 0xffe9a0, emissiveIntensity: 1.5 }), { cast: false });
    const light = new THREE.PointLight(0xffe2a8, 420, 46, 2);
    light.position.set(POLE.x + 2, 6, POLE.z + 1);
    this.root.add(light);
    this.fireLights.push({ light, base: 420, flicker: 0.04 });
  }

  /** Recinto de extracción: muros altos de concreto con UNA entrada estrecha en el lado oeste. */
  _extractionCompound() {
    const concrete = mat(0x6b6d6f, { rough: 1 });
    const trim = mat(0x2a2b2d, { rough: 0.9 });
    for (const w of extractionWalls()) {
      const sx = w.maxX - w.minX, sz = w.maxZ - w.minZ, h = w.maxY;
      part(this.root, sx, h, sz, (w.minX + w.maxX) / 2, h / 2, (w.minZ + w.maxZ) / 2, concrete, { receive: true });
      part(this.root, sx + 0.1, 0.3, sz + 0.1, (w.minX + w.maxX) / 2, h + 0.15, (w.minZ + w.maxZ) / 2, trim);
    }
    // Pilares de la entrada y un letrero pequeño y desgastado (solo se lee de cerca)
    const g = EXT_GATE, c = EXT_COMPOUND;
    for (const z of [g.z1 - 0.4, g.z2 + 0.4]) part(this.root, 1.2, 6, 1.2, c.x1, 3, z, trim);
    const tex = createSignTexture('RESCATE', { bg: '#1a1410', fg: '#d8c8a0', border: '#8a6a2a', size: 70, w: 256, h: 96 });
    this.disposables.push(tex);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(c.x1 - 0.7, 5.4, (g.z1 + g.z2) / 2);
    sign.rotation.y = -Math.PI / 2;
    this.root.add(sign);
    this.disposables.push(sign.geometry, sign.material);
  }

  _hazardZones() {
    for (const z of HAZARD_ZONES) {
      const tex = createHazardTexture(z.label);
      this.disposables.push(tex);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(z.x, 0.04, z.z);
      this.root.add(m);
      this.disposables.push(m.geometry, m.material);
      // cinta/conos en las esquinas
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 8), mat(0xe0661a, { rough: 0.6 }));
        cone.position.set(z.x + (sx * z.w) / 2, 0.35, z.z + (sz * z.d) / 2);
        this.root.add(cone);
        this.disposables.push(cone.geometry);
      }
    }
  }

  _fireBarrels() {
    // Solo algunos barriles llevan PointLight (límite de luces para rendimiento)
    const lit = new Set([0, 1]);
    FIRE_BARRELS.forEach((f, i) => {
      const barrel = createFireBarrel(f);
      this.root.add(barrel);
      this.flames.push(barrel.getObjectByName('flame'));
      if (lit.has(i)) {
        const light = new THREE.PointLight(0xff8a30, 70, 22, 2);
        light.position.set(f.x, 1.7, f.z);
        this.root.add(light);
        this.fireLights.push({ light, base: 70, flicker: 0.35 });
      }
    });
  }

  update(time) {
    this.flames.forEach((f, i) => {
      f.scale.set(1 + Math.sin(time * 11 + i) * 0.12, 1 + Math.sin(time * 15 + i * 2) * 0.2, 1 + Math.cos(time * 9 + i) * 0.12);
    });
    this.fireLights.forEach((l, i) => {
      l.light.intensity = l.base * (1 + (Math.sin(time * 17 + i * 3) + Math.sin(time * 7.3 + i)) * 0.5 * l.flicker);
    });
  }

  dispose() {
    this.scene.remove(this.root);
    for (const d of this.disposables) d.dispose?.();
    this.disposables.length = 0;
    disposeProps();
  }
}
