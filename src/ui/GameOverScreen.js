/** Pantalla GAME OVER (RF09): reiniciar o volver al menú principal. */
export class GameOverScreen {
  constructor({ onRestart, onMenu }) {
    this.root = document.getElementById('gameover');
    document.getElementById('btn-gameover-restart').addEventListener('click', onRestart);
    document.getElementById('btn-gameover-menu').addEventListener('click', onMenu);
  }

  show() {
    this.root.classList.remove('hidden');
    document.getElementById('btn-gameover-restart').focus({ preventScroll: true });
  }

  hide() {
    this.root.classList.add('hidden');
  }
}
