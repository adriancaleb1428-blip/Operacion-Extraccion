import './styles/main.css';
import { Game } from './game/Game.js';

/** Punto de entrada: crea el juego y muestra un error legible si WebGL o la carga fallan. */
const root = document.getElementById('game-root');
const game = new Game(root);

game.init().catch((err) => {
  console.error('[Operación Extracción] Error al iniciar:', err);
  document.getElementById('loading')?.classList.remove('hidden');
  const e = document.getElementById('loading-error');
  if (e) {
    e.textContent = `No se pudo iniciar el juego: ${err?.message ?? err}. Comprueba que tu navegador soporte WebGL2.`;
    e.classList.remove('hidden');
  }
  document.querySelector('#loading .spinner')?.classList.add('hidden');
});

if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
