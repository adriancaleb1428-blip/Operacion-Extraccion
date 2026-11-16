/**
 * Entrada del jugador: teclado (WASD, 1, 2) y mouse (clic izquierdo, movimiento).
 *
 * RF01: cada clic izquierdo produce EXACTAMENTE un disparo. Se usa el evento `mousedown`, que se
 * emite una sola vez por pulsación; mantener el botón NO repite el evento (no hay fuego automático).
 */
export class InputManager {
  /** @param {HTMLElement|Window} target */
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.enabled = false; // el juego lo activa solo mientras se juega
    this.look = { x: 0, y: 0 }; // acumulado de movimiento del mouse (para la inercia del arma)
    this.onFire = null;         // () => void
    this.onSelectSlot = null;   // (slot:number) => void
    this.onCycleWeapon = null;  // (dir:+1|-1) => void  (rueda del mouse)
    this._lastWheel = 0;

    this._onKeyDown = (e) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.onSelectSlot?.(1);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') this.onSelectSlot?.(2);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      if (e.button === 0 && this.enabled) this.onFire?.();
    };
    this._onMouseMove = (e) => {
      if (!this.enabled) return;
      this.look.x += e.movementX || 0;
      this.look.y += e.movementY || 0;
    };
    // Rueda del mouse: cambia de arma (con un pequeño límite para que un giro de trackpad no la cambie varias veces)
    this._onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const now = performance.now();
      if (Math.abs(e.deltaY) < 1 || now - this._lastWheel < 150) return;
      this._lastWheel = now;
      this.onCycleWeapon?.(e.deltaY > 0 ? 1 : -1);
    };
    this._onBlur = () => this.keys.clear();
    this._onContext = (e) => { if (this.enabled) e.preventDefault(); };

    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('contextmenu', this._onContext);
    target.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** Eje de movimiento: forward (+1 = W, -1 = S) y strafe (+1 = D, -1 = A). */
  get axis() {
    return {
      forward: (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0),
      strafe: (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0),
    };
  }

  /** Devuelve y reinicia el movimiento de mouse acumulado. */
  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = this.look.y = 0;
    return l;
  }

  clear() {
    this.keys.clear();
    this.look.x = this.look.y = 0;
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('mousedown', this._onMouseDown);
    this.target.removeEventListener('mousemove', this._onMouseMove);
    this.target.removeEventListener('contextmenu', this._onContext);
    this.target.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
  }
}
