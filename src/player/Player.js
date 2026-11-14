import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { PLAYER_START } from '../world/levelData.js';
import { CameraController } from './CameraController.js';
import { MovementController } from './MovementController.js';

/**
 * Jugador: posición en el suelo (x,z), cámara a la altura de los ojos y movimiento.
 * `position` es un THREE.Vector3 con los pies del jugador (y = 0).
 */
export class Player {
  constructor(camera, domElement, collision) {
    this.camera = camera;
    this.position = new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z);
    this.radius = CONFIG.player.radius;
    this.cameraController = new CameraController(camera, domElement);
    this.movement = new MovementController(collision);
    this.speed = 0;
    this.bobTime = 0;
    this.reset();
  }

  reset() {
    this.position.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.movement.reset();
    this.cameraController.setOrientation(PLAYER_START.yaw, 0);
    this.speed = 0;
    this._syncCamera(0);
  }

  /** @param {{forward:number,strafe:number}} axis */
  update(dt, axis) {
    this.speed = this.movement.update(dt, this.position, axis, this.cameraController.yaw);
    this.bobTime += dt * this.speed * 1.9;
    this._syncCamera(this.speed / CONFIG.player.speed);
  }

  _syncCamera(moveFactor) {
    const bob = Math.sin(this.bobTime * 2) * CONFIG.player.bobAmount * moveFactor;
    this.camera.position.set(this.position.x, CONFIG.player.eyeHeight + bob, this.position.z);
  }

  dispose() {
    this.cameraController.dispose();
  }
}
