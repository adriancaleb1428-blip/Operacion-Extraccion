/** Pantalla de victoria (RF08): "¡MISIÓN COMPLETADA! Has llegado a la zona de extracción." */
export class VictoryScreen {
  constructor({ onRestart, onMenu }) {
    this.root = document.getElementById('victory');
    this.stats = document.getElementById('victory-stats');
    document.getElementById('btn-victory-restart').addEventListener('click', onRestart);
    document.getElementById('btn-victory-menu').addEventListener('click', onMenu);
  }

  show({ seconds, kills, shots }) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.stats.textContent = `Tiempo: ${m}:${s} · Zombis eliminados: ${kills} · Disparos: ${shots}`;
    this.root.classList.remove('hidden');
    document.getElementById('btn-victory-restart').focus({ preventScroll: true });
  }

  hide() {
    this.root.classList.add('hidden');
  }
}
