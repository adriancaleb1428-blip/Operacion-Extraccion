/** Estados globales de la aplicación. Un solo lugar decide qué se actualiza y qué se muestra. */
export const GameState = Object.freeze({
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
  GAME_OVER: 'GAME_OVER',
});

/** Etapas de la misión (RF08). */
export const MissionStage = Object.freeze({
  START: 'INICIO',
  DEVELOPMENT: 'DESARROLLO',
  FINAL: 'FINAL',
});

export class StateMachine {
  constructor(initial = GameState.LOADING) {
    this.current = initial;
    this.listeners = new Set();
  }

  is(...states) {
    return states.includes(this.current);
  }

  set(next) {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, prev);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
