import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from '../config.js';

/**
 * Cámara en primera persona (RF06) basada en PointerLockControls:
 *  - el mouse gira la cámara horizontal y verticalmente
 *  - la rotación vertical está limitada (±pitchLimit) para evitar giros incorrectos
 */
export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = CONFIG.player.mouseSensitivity;
    this.controls.minPolarAngle = Math.PI / 2 - CONFIG.player.pitchLimit;
    this.controls.maxPolarAngle = Math.PI / 2 + CONFIG.player.pitchLimit;
    this.camera.rotation.order = 'YXZ';
    this.onLock = null;
    this.onUnlock = null;
    this.onError = null;
    this._lock = () => this.onLock?.();
    this._unlock = () => this.onUnlock?.();
    this._error = () => this.onError?.();
    this.controls.addEventListener('lock', this._lock);
    this.controls.addEventListener('unlock', this._unlock);
    // PointerLockControls solo escribe en consola si falla; escuchamos el evento del documento
    this._doc = domElement.ownerDocument;
    this._doc.addEventListener('pointerlockerror', this._error);
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  /** Pide la captura del mouse. Debe llamarse dentro de un gesto del usuario (clic). */
  lock() {
    try {
      // requestPointerLock devuelve una promesa en navegadores modernos: se captura el rechazo
      const p = this.controls.domElement.requestPointerLock?.();
      p?.catch?.(() => this.onError?.());
    } catch (e) {
      this.onError?.(e);
    }
  }

  unlock() {
    if (this.controls.isLocked) this.controls.unlock();
  }

  get yaw() {
    return this.camera.rotation.y;
  }

  /** Orienta la cámara (yaw = giro horizontal, pitch = vertical) en radianes. */
  setOrientation(yaw, pitch = 0) {
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  dispose() {
    this.controls.removeEventListener('lock', this._lock);
    this.controls.removeEventListener('unlock', this._unlock);
    this._doc.removeEventListener('pointerlockerror', this._error);
    this.controls.dispose();
  }
}
