/**
 * Menú principal (JUGAR / INSTRUCCIONES / CRÉDITOS), pantalla de carga y pantalla de pausa.
 * Solo manipula el DOM; la lógica de juego se conecta mediante callbacks.
 */
export class Menu {
  /** @param {{onPlay:()=>void, onResume:()=>void, onQuitToMenu:()=>void}} handlers */
  constructor({ onPlay, onResume, onQuitToMenu }) {
    this.$ = (id) => document.getElementById(id);
    this.loading = this.$('loading');
    this.menu = this.$('menu');
    this.pause = this.$('pause');
    this.instructions = this.$('panel-instructions');
    this.credits = this.$('panel-credits');

    this.$('btn-play').addEventListener('click', onPlay);
    this.$('btn-instructions').addEventListener('click', () => this._panel(this.instructions));
    this.$('btn-credits').addEventListener('click', () => this._panel(this.credits));
    this.menu.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this._panel(null)));
    this.$('btn-resume').addEventListener('click', onResume);
    this.$('btn-pause-menu').addEventListener('click', onQuitToMenu);
  }

  _panel(panel) {
    this.instructions.classList.toggle('hidden', panel !== this.instructions);
    this.credits.classList.toggle('hidden', panel !== this.credits);
  }

  showLoading(text) {
    this.loading.classList.remove('hidden');
    if (text) this.$('loading-text').textContent = text;
  }

  hideLoading() {
    this.loading.classList.add('hidden');
  }

  showError(message) {
    const e = this.$('loading-error');
    e.textContent = message;
    e.classList.remove('hidden');
    this.loading.querySelector('.spinner')?.classList.add('hidden');
  }

  showMenu() {
    this._panel(null);
    this.menu.classList.remove('hidden');
  }

  hideMenu() {
    this.menu.classList.add('hidden');
  }

  showPause() { this.pause.classList.remove('hidden'); }
  hidePause() { this.pause.classList.add('hidden'); }

  /** Estado honesto de los modelos: reales / provisionales / de emergencia. */
  setAssetReport(report) {
    const roles = (status) => report.filter((r) => r.status === status).map((r) => r.role);
    const ph = roles('placeholder'), fb = roles('fallback'), real = roles('real');
    const parts = [];
    if (real.length) parts.push(`${real.length} modelo(s) GLB reales`);
    if (ph.length) parts.push(`${ph.length} modelo(s) GLB PROVISIONALES`);
    if (fb.length) parts.push(`${fb.length} sin GLB (geometría de emergencia)`);
    const text = `Modelos 3D cargados: ${parts.join(' · ') || 'ninguno'}`;
    this.$('asset-status').textContent = text;
    // Lista de recursos construida con nodos DOM (sin innerHTML)
    const box = this.$('credits-assets');
    box.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'Recursos 3D (estado actual)';
    box.appendChild(title);
    for (const r of report) {
      box.appendChild(document.createElement('br'));
      box.appendChild(document.createTextNode(`• ${r.role} → ${r.url.split('/assets/')[1] ?? r.url} [${r.status}]`));
    }
  }
}
