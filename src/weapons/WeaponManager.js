import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createFallbackWeapon } from '../systems/AssetLoader.js';
import { Weapon } from './Weapon.js';

/** Textura radial para el fogonazo (se genera con canvas: no requiere archivos). */
function createFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,200,90,0.8)');
  grad.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Gestiona las armas de primera persona (RF01):
 *  - carga los GLB, los coloca en la vista y los renderiza en una escena aparte (no atraviesan paredes)
 *  - selección con teclas 1/2 con animación visible de cambio
 *  - balanceo al caminar, inercia al girar la cámara y retroceso al disparar
 */
export class WeaponManager {
  /** @param {THREE.Scene} weaponScene escena del viewmodel */
  constructor(weaponScene) {
    this.weaponScene = weaponScene;
    this.group = new THREE.Group();
    this.weaponScene.add(this.group);
    this.weapons = [];
    this.current = null;

    this.equipT = 1;      // 0 -> recién cambiada, 1 -> lista
    this.kickAmount = 0;  // retroceso
    this.flashTime = 0;
    this.bobPhase = 0;
    this.sway = new THREE.Vector2();
    this.flashTexture = null;
  }

  async load(assets) {
    this.flashTexture = createFlashTexture();
    for (const cfg of CONFIG.WEAPONS) {
      const data = await assets.load(cfg.model.path, `arma: ${cfg.id}`, () => createFallbackWeapon(cfg.model.length));
      const weapon = new Weapon(cfg, data.scene, data.status, this.flashTexture);
      this.weapons.push(weapon);
      this.group.add(weapon.root);
    }
    this.weapons.sort((a, b) => a.slot - b.slot);
    this.select(1, true);
  }

  /** Selecciona por slot (1 = principal, 2 = secundaria). Devuelve true si cambió el arma. */
  select(slot, silent = false) {
    const next = this.weapons.find((w) => w.slot === slot);
    if (!next || next === this.current) return false;
    if (this.current) this.current.root.visible = false;
    this.current = next;
    next.root.visible = true;
    this.equipT = silent ? 1 : 0; // animación de "sacar" el arma
    this.flashTime = 0;
    next.flash.visible = false;
    return true;
  }

  /** Dispara la animación de retroceso + fogonazo. */
  kick() {
    this.kickAmount = 1;
    this.flashTime = 0.045;
    if (this.current) {
      this.current.flash.visible = true;
      this.current.flash.rotation.z = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.6;
      this.current.flash.scale.setScalar(s);
    }
  }

  /**
   * @param {number} dt
   * @param {{speed:number, lookX:number, lookY:number}} motion velocidad del jugador y delta del mouse
   */
  update(dt, motion) {
    const w = this.current;
    if (!w) return;
    this.equipT = Math.min(1, this.equipT + dt / 0.28);
    const e = 1 - (1 - this.equipT) ** 3;

    // balanceo al caminar
    const moving = Math.min(1, motion.speed / CONFIG.player.speed);
    this.bobPhase += dt * (6 + moving * 5);
    const bobX = Math.cos(this.bobPhase) * 0.006 * moving;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.008 * moving;

    // inercia al girar la cámara
    this.sway.x = THREE.MathUtils.clamp(this.sway.x - motion.lookX * 0.00018, -0.05, 0.05);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + motion.lookY * 0.00018, -0.04, 0.04);
    this.sway.multiplyScalar(Math.max(0, 1 - dt * 9));

    this.kickAmount = Math.max(0, this.kickAmount - dt * 9);
    const k = this.kickAmount;

    w.root.position.set(
      w.basePosition.x + bobX + this.sway.x,
      w.basePosition.y + bobY + this.sway.y - (1 - e) * 0.32,
      w.basePosition.z + k * w.config.kick,
    );
    w.root.rotation.set(k * 0.07 - (1 - e) * 0.7, this.sway.x * 1.5, 0);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) w.flash.visible = false;
    }
  }

  dispose() {
    for (const w of this.weapons) w.dispose();
    this.flashTexture?.dispose();
    this.weaponScene.remove(this.group);
  }
}
