import { CONFIG } from '../config.js';

/**
 * HUD durante la partida: mira, arma y munición, misión, radar de amenazas, mensajes (toasts),
 * marcador de impacto y viñetas de peligro. Solo escribe en el DOM cuando algo cambia.
 */
export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.root = $('hud');
    this.el = {
      weaponName: $('weapon-name'), ammoCur: $('ammo-current'), ammoMax: $('ammo-max'), ammoBox: this.root.querySelector('.ammo'),
      ammoWarn: $('ammo-warning'), stage: $('mission-stage'), missionText: $('mission-text'), arrow: $('objective-arrow'),
      dist: $('objective-dist'), heading: $('heading'), objective: this.root.querySelector('.objective'), threatCount: $('threat-count'), threat: $('threat'), left: $('zombies-left'), kills: $('kills'),
      toasts: $('toasts'), hit: $('hitmarker'), danger: $('vignette-danger'), hurt: $('vignette-hurt'), radar: $('radar'),
    };
    this.slots = [1, 2].map((n) => ({ box: this.root.querySelector(`.slot[data-slot="${n}"]`), name: $(`slot${n}-name`), ammo: $(`slot${n}-ammo`) }));
    CONFIG.WEAPONS.forEach((w, i) => { this.slots[i].name.textContent = w.id === 'rifle' ? 'FUSIL' : 'PISTOLA'; });
    this.radarCtx = this.el.radar.getContext('2d');
    this._hitTimer = 0;
    this._cache = {};
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  _set(key, el, value) {
    if (this._cache[key] !== value) { this._cache[key] = value; el.textContent = value; }
  }

  /** @param {import('../weapons/Weapon.js').Weapon} weapon  @param {import('../weapons/AmmoSystem.js').AmmoSystem} ammo */
  setWeapon(weapon, ammo) {
    this._set('wname', this.el.weaponName, weapon.name);
    this.slots.forEach((s, i) => s.box.classList.toggle('active', CONFIG.WEAPONS[i].id === weapon.id));
    this.setAmmo(weapon, ammo);
  }

  setAmmo(weapon, ammo) {
    const cur = ammo.get(weapon.id);
    this._set('ammo', this.el.ammoCur, String(cur));
    this._set('ammomax', this.el.ammoMax, `/ ${ammo.max(weapon.id)}`);
    this.el.ammoBox.classList.toggle('low', cur <= 3);
    this._set('warn', this.el.ammoWarn, cur === 0 ? 'SIN MUNICIÓN — busca cajas' : cur <= 3 ? 'MUNICIÓN BAJA' : '');
    CONFIG.WEAPONS.forEach((w, i) => this._set(`slotammo${i}`, this.slots[i].ammo, String(ammo.get(w.id))));
  }

  setMission(stage, text) {
    this._set('stage', this.el.stage, stage);
    this._set('mtext', this.el.missionText, text);
  }

  setHeading(name) {
    this._set('heading', this.el.heading, name);
  }

  /**
   * Señal de radio de la extracción. Lejos: solo una dirección aproximada. Cerca ("señal fuerte"):
   * distancia y flecha relativa a hacia dónde mira el jugador.
   */
  setSignal(strong, distance, relativeAngle, cardinal) {
    this.el.arrow.style.display = strong ? 'inline-block' : 'none';
    this.el.objective.classList.toggle('strong', strong);
    this._set('dist', this.el.dist, strong ? `Señal fuerte: ${Math.round(distance)} m` : `Señal débil hacia el ${cardinal}`);
    if (strong) this.el.arrow.style.transform = `rotate(${relativeAngle - Math.PI / 2}rad)`;
  }

  setCounts(left, kills) {
    this._set('left', this.el.left, String(left));
    this._set('kills', this.el.kills, String(kills));
  }

  /** Mensaje temporal (kind: info | pickup | warn | mission). */
  toast(text, kind = 'info', ms = 2600) {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  }

  clearToasts() { this.el.toasts.replaceChildren(); }

  hitMarker(kill = false) {
    this.el.hit.classList.toggle('kill', kill);
    this.el.hit.classList.add('show');
    this._hitTimer = CONFIG.combat.hitMarkerSeconds;
  }

  flashHurt() {
    this.el.hurt.style.opacity = '1';
    setTimeout(() => (this.el.hurt.style.opacity = '0'), 250);
  }

  /** Radar: puntos rojos = zombis activos, ámbar = inactivos. Rotado con la cámara. */
  updateRadar(playerPos, yaw, zombies, range = 32) {
    const c = this.radarCtx, s = this.el.radar.width, h = s / 2;
    c.clearRect(0, 0, s, s);
    c.strokeStyle = 'rgba(110,200,150,0.25)'; c.lineWidth = 1;
    for (const r of [0.33, 0.66, 1]) { c.beginPath(); c.arc(h, h, (h - 2) * r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(h, 4); c.lineTo(h, s - 4); c.moveTo(4, h); c.lineTo(s - 4, h); c.stroke();
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    for (const z of zombies) {
      const dx = z.position.x - playerPos.x, dz = z.position.z - playerPos.z;
      if (Math.hypot(dx, dz) > range) continue;
      // al rotar por -yaw, "adelante" queda hacia arriba del radar
      const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      const px = h + (rx / range) * (h - 4), py = h + (rz / range) * (h - 4);
      c.fillStyle = z.state === 'ACTIVO' ? '#ff3b2a' : '#ffb347';
      c.beginPath(); c.arc(px, py, z.state === 'ACTIVO' ? 4 : 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#7dffb0';
    c.beginPath(); c.moveTo(h, h - 7); c.lineTo(h - 5, h + 5); c.lineTo(h + 5, h + 5); c.closePath(); c.fill();
  }

  setThreat(count, nearest) {
    this._set('tcount', this.el.threatCount, String(count));
    this.el.threat.classList.toggle('danger', nearest < 9);
    this.el.danger.style.opacity = nearest < 9 ? String(Math.min(1, (9 - nearest) / 6)) : '0';
  }

  update(dt) {
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this.el.hit.classList.remove('show');
    }
  }

  reset() {
    this.clearToasts();
    this.el.danger.style.opacity = '0';
    this.el.hit.classList.remove('show');
    this._cache = {};
  }
}
