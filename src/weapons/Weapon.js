import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Un arma en primera persona: datos (de CONFIG.WEAPONS) + el modelo 3D (GLB) ya normalizado.
 * El modelo debe apuntar hacia -Z (convención de three.js); si un GLB real apunta a otro lado,
 * se corrige con `model.rotationY` en la configuración.
 */
export class Weapon {
  /**
   * @param {object} config entrada de CONFIG.WEAPONS
   * @param {THREE.Object3D} modelScene escena del GLB cargado
   * @param {'real'|'placeholder'|'fallback'} status origen del modelo
   * @param {THREE.Texture} flashTexture textura del fogonazo
   */
  constructor(config, modelScene, status, flashTexture) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.slot = config.slot;
    this.range = config.range;
    this.damage = config.damage;
    this.modelStatus = status;

    // root = punto de anclaje en la vista; animaciones de balanceo/retroceso mueven este nodo
    this.root = new THREE.Group();
    this.root.name = `viewmodel_${config.id}`;
    this.basePosition = new THREE.Vector3(...config.model.viewPosition);
    this.root.position.copy(this.basePosition);

    const model = modelScene.clone(true);
    this._normalize(model, config.model.length, THREE.MathUtils.degToRad(config.model.rotationY ?? 0));
    this.root.add(model);
    this.model = model;

    // Posición de la boca del cañón (a partir del tamaño real normalizado)
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.012, -config.model.length / 2 - 0.02);
    this.root.add(this.muzzle);

    // Fogonazo: dos planos cruzados con textura radial aditiva
    this.flash = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: flashTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: config.flash });
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
      p.rotation.z = rot;
      this.flash.add(p);
    }
    this.flash.position.copy(this.muzzle.position);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.flashMaterial = mat;

    this.root.visible = false;
  }

  /** Escala el GLB para que su largo (eje Z) sea `length` y lo centra en el origen. */
  _normalize(obj, length, rotationY) {
    obj.rotation.y = rotationY;
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj).getSize(_size);
    const s = _size.z > 1e-4 ? length / _size.z : 1;
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj).getCenter(_center);
    obj.position.sub(_center);
    obj.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }

  dispose() {
    this.flash.children.forEach((c) => c.geometry.dispose());
    this.flashMaterial.dispose();
  }
}
