/**
 * Audio sintetizado con Web Audio (no requiere archivos). Los sonidos finales se pueden añadir
 * en public/assets/audio/ y reemplazar las funciones de aquí.
 * El AudioContext se crea tras un gesto del usuario (política de autoplay de los navegadores).
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noise = null;
  }

  /** Llamar dentro de un evento de clic/tecla. */
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startAmbient();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  _startAmbient() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = this.ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(); lfo.start();
  }

  _tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.3, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  _burst({ dur = 0.15, freq = 2500, vol = 0.5, q = 0.7, type = 'lowpass', delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  shot(weaponId) {
    if (weaponId === 'rifle') {
      this._burst({ dur: 0.16, freq: 3200, vol: 0.7 });
      this._tone({ type: 'triangle', f0: 150, f1: 40, dur: 0.18, vol: 0.6 });
    } else {
      this._burst({ dur: 0.1, freq: 4500, vol: 0.6 });
      this._tone({ type: 'triangle', f0: 220, f1: 60, dur: 0.12, vol: 0.5 });
    }
  }
  empty() { this._tone({ type: 'square', f0: 1700, f1: 1500, dur: 0.04, vol: 0.12 }); }
  switchWeapon() { this._burst({ dur: 0.05, freq: 3000, vol: 0.25, type: 'highpass' }); this._tone({ type: 'square', f0: 900, f1: 600, dur: 0.05, vol: 0.1, delay: 0.05 }); }
  hit() { this._burst({ dur: 0.08, freq: 900, vol: 0.5 }); this._tone({ type: 'sine', f0: 180, f1: 70, dur: 0.1, vol: 0.4 }); }
  zombieDie() { this._tone({ type: 'sawtooth', f0: 130, f1: 35, dur: 0.7, vol: 0.28 }); this._burst({ dur: 0.35, freq: 400, vol: 0.3, delay: 0.05 }); }
  growl() { this._tone({ type: 'sawtooth', f0: 85, f1: 55, dur: 0.7, vol: 0.14 }); this._tone({ type: 'sawtooth', f0: 90, f1: 60, dur: 0.6, vol: 0.1, delay: 0.1 }); }
  pickup() { [660, 880, 1320].forEach((f, i) => this._tone({ type: 'sine', f0: f, f1: f, dur: 0.14, vol: 0.2, delay: i * 0.07 })); }
  gameOver() { this._tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 1.4, vol: 0.35 }); this._burst({ dur: 0.5, freq: 600, vol: 0.5 }); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this._tone({ type: 'triangle', f0: f, f1: f, dur: 0.35, vol: 0.25, delay: i * 0.14 })); }
}
