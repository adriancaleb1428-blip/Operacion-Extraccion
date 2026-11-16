import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GameState, MissionStage, StateMachine } from './GameState.js';
import { SceneManager } from './SceneManager.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { AssetLoader } from '../systems/AssetLoader.js';
import { InputManager } from '../systems/InputManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { ParticleSystem } from '../systems/Effects.js';
import { Environment } from '../world/Environment.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { Collectibles } from '../world/Collectibles.js';
import { ExtractionZone } from '../world/ExtractionZone.js';
import { WORLD, ZOMBIE_SPAWNS, SAFE_ZONE, PLAYER_START } from '../world/levelData.js';
import { Player } from '../player/Player.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { AmmoSystem } from '../weapons/AmmoSystem.js';
import { ShootingSystem } from '../weapons/ShootingSystem.js';
import { ZombieManager } from '../enemies/ZombieManager.js';
import { ZombieState } from '../enemies/ZombieAI.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { VictoryScreen } from '../ui/VictoryScreen.js';

const STAGE_TEXT = {
  [MissionStage.START]: 'Sal de la zona segura. La radio capta una señal de rescate al NORESTE: la zona de extracción está escondida.',
  [MissionStage.DEVELOPMENT]: 'Los zombis te han olido. Cruza la ciudad, junta munición y encuentra la entrada a la zona de extracción.',
  [MissionStage.FINAL]: '¡Señal fuerte! La estación de rescate está cerca: busca la entrada en su muro.',
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const compassName = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/**
 * Orquestador del juego: crea los sistemas, conecta eventos y ejecuta el bucle principal.
 * La lógica específica vive en sus módulos (armas, zombis, mundo, UI...).
 */
export class Game {
  /** @param {HTMLElement} root contenedor del canvas */
  constructor(root) {
    this.root = root;
    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    this.requiresLock = !params.has('nolock'); // ?nolock permite probar sin captura de mouse
    this.state = new StateMachine(GameState.LOADING);
    this._last = 0; // marca de tiempo del frame anterior (ms)
    this.time = 0;
    this.rafId = 0;
    this.running = false;

    // estadísticas de la partida
    this.stage = MissionStage.START;
    this.kills = 0;
    this.shots = 0;
    this.runTime = 0;
    this._lastFullMsg = -10;
    this._lastAlert = -10;
    this._objVec = new THREE.Vector3();
  }

  async init() {
    this.menu = new Menu({
      onPlay: () => this.startGame(),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.toMenu(),
    });
    this.menu.showLoading('Construyendo la ciudad…');

    this.view = new SceneManager(this.root);
    const { scene, camera } = this.view;
    this.collision = new CollisionSystem(WORLD);
    this.environment = new Environment(scene);
    this.world = new WorldBuilder(scene, this.collision).build();
    this.extraction = new ExtractionZone(scene);
    this.particles = new ParticleSystem(scene);
    this.collectibles = new Collectibles(scene, this.particles);

    this.menu.showLoading('Cargando modelos 3D (GLB)…');
    this.assets = new AssetLoader();
    this.zombies = new ZombieManager({ scene, collision: this.collision, assets: this.assets });
    this.zombies.onStateChange = (z, st) => this._onZombieState(z, st);
    await this.zombies.spawnAll(ZOMBIE_SPAWNS);
    this.weapons = new WeaponManager(this.view.weaponScene);
    await this.weapons.load(this.assets);

    this.ammo = new AmmoSystem(CONFIG.WEAPONS);
    this.shooting = new ShootingSystem({ ammo: this.ammo, collision: this.collision, zombies: this.zombies });
    this.audio = new AudioManager();
    this.player = new Player(camera, this.view.renderer.domElement, this.collision);
    this.hud = new HUD();
    this.gameOverScreen = new GameOverScreen({ onRestart: () => this.restart(), onMenu: () => this.toMenu() });
    this.victoryScreen = new VictoryScreen({ onRestart: () => this.restart(), onMenu: () => this.toMenu() });

    // --- entrada ---
    this.input = new InputManager(window);
    this.input.onFire = () => this.handleFire();
    this.input.onSelectSlot = (slot) => this.handleSelectWeapon(slot);
    this.input.onCycleWeapon = (dir) => this.handleCycleWeapon(dir);

    // --- captura de mouse: perderla durante la partida = pausa ---
    const cc = this.player.cameraController;
    cc.onUnlock = () => { if (this.requiresLock && this.state.is(GameState.PLAYING)) this.state.set(GameState.PAUSED); };
    cc.onError = () => {
      if (this.state.is(GameState.PLAYING)) this.state.set(GameState.PAUSED);
      const p = document.querySelector('#pause p');
      if (p) p.textContent = 'El navegador no permitió capturar el mouse. Espera un instante y pulsa CONTINUAR otra vez (usa Chrome/Edge/Firefox de escritorio).';
    };

    this.state.onChange((next, prev) => this._onStateChange(next, prev));
    this.menu.setAssetReport(this.assets.report);
    this._logAssetReport();
    this.view.resize();

    if (this.debug) window.__game = this;
    this.menu.hideLoading();
    this.state.set(GameState.MENU);
    this.running = true;
    this._last = performance.now();
    this._loop();
  }

  _logAssetReport() {
    const s = this.assets.summary();
    console.info(`[Recursos 3D] reales: ${s.real} · provisionales: ${s.placeholder} · emergencia (sin GLB): ${s.fallback}`);
    for (const r of this.assets.report) console.info(` - ${r.role}: ${r.url} [${r.status}]`);
  }

  // ------------------------------------------------------------------ estados / pantallas
  _onStateChange(next) {
    const playing = next === GameState.PLAYING;
    this.input.enabled = playing;
    if (!playing) this.input.clear();
    this.view.showWeapon = next !== GameState.MENU;

    this.menu.hidePause(); this.gameOverScreen.hide(); this.victoryScreen.hide();
    if (next === GameState.MENU) { this.menu.showMenu(); this.hud.hide(); }
    else this.menu.hideMenu();
    if (playing) this.hud.show();
    if (next === GameState.PAUSED) {
      this.menu.showPause();
      const p = document.querySelector('#pause p');
      if (p) p.textContent = 'Haz clic en CONTINUAR para volver a capturar el mouse.';
    }
    if (next === GameState.GAME_OVER) { this.hud.hide(); this.gameOverScreen.show(); }
    if (next === GameState.VICTORY) {
      this.hud.hide();
      this.victoryScreen.show({ seconds: this.runTime, kills: this.kills, shots: this.shots });
    }
  }

  /** JUGAR (desde el menú): inicia la partida y captura el mouse (dentro del gesto de clic). */
  startGame() {
    this.audio.unlock();
    this._resetRun();
    this.state.set(GameState.PLAYING);
    if (this.requiresLock) this.player.cameraController.lock();
    this._announceStage(true);
  }

  /** Reinicia la partida (desde GAME OVER / victoria). */
  restart() {
    this.audio.unlock();
    this._resetRun();
    this.state.set(GameState.PLAYING);
    if (this.requiresLock) this.player.cameraController.lock();
    this._announceStage(true);
  }

  resume() {
    this.audio.unlock();
    if (this.requiresLock) this.player.cameraController.lock();
    this.state.set(GameState.PLAYING);
  }

  toMenu() {
    this.player.cameraController.unlock();
    this._resetRun();
    this.state.set(GameState.MENU);
  }

  _resetRun() {
    this.player.reset();
    this.ammo.reset();
    this.zombies.resetAll();
    this.collectibles.reset();
    this.particles.clear();
    this.weapons.select(1, true);
    this.hud.reset();
    this.stage = MissionStage.START;
    this.kills = 0; this.shots = 0; this.runTime = 0;
    this.hud.setWeapon(this.weapons.current, this.ammo);
    this.hud.setCounts(this.zombies.aliveCount, 0);
    this.hud.setMission(this.stage, STAGE_TEXT[this.stage]);
  }

  _announceStage(first = false) {
    if (first) {
      this.hud.toast('Misión: llega a la zona de extracción (haz verde al norte)', 'mission', 5200);
      this.hud.toast('WASD mover · Mouse apuntar · Clic disparar · 1/2 cambiar arma', 'info', 7000);
      this.hud.toast('No hay recarga: recoge cajas de munición', 'pickup', 7000);
    }
  }

  _setStage(stage) {
    if (stage === this.stage) return;
    this.stage = stage;
    this.hud.setMission(stage, STAGE_TEXT[stage]);
    if (stage === MissionStage.DEVELOPMENT) {
      // MODO CAZA: al salir de la zona segura todos los zombis detectan al jugador desde mucho más lejos
      this.zombies.setHunt(true);
      this.hud.toast('¡Los zombis han olido tu salida! Vienen hacia ti', 'warn', 4000);
    } else {
      this.hud.toast('¡Señal de rescate fuerte! Busca la entrada', 'mission', 3500);
    }
  }

  // ------------------------------------------------------------------ acciones del jugador
  handleSelectWeapon(slot) {
    if (!this.state.is(GameState.PLAYING)) return;
    if (this.weapons.select(slot)) {
      this.audio.switchWeapon();
      this.hud.setWeapon(this.weapons.current, this.ammo);
    }
  }

  /** Rueda del mouse: pasa al arma siguiente/anterior (solo hay 2 armas, así que alterna). */
  handleCycleWeapon(dir) {
    const slots = this.weapons.weapons.map((w) => w.slot);
    const i = slots.indexOf(this.weapons.current.slot);
    this.handleSelectWeapon(slots[(i + dir + slots.length) % slots.length]);
  }

  /** Un clic = un disparo. Sin munición no se dispara. */
  handleFire() {
    if (!this.state.is(GameState.PLAYING)) return;
    const weapon = this.weapons.current;
    const cam = this.view.camera;
    const origin = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3());
    cam.updateMatrixWorld(true);
    const r = this.shooting.fire(weapon, origin, dir);

    if (!r.fired) {
      this.audio.empty();
      this.hud.toast('SIN MUNICIÓN — busca una caja de suministros', 'warn', 1500);
      return;
    }
    this.shots++;
    this.weapons.kick();
    this.audio.shot(weapon.id);
    this.hud.setAmmo(weapon, this.ammo);

    if (r.hit) {
      this.hud.hitMarker(r.killed);
      this.audio.hit();
      this.particles.emit(r.point, r.killed ? 26 : 12, 0xff2a1a, 3.2, 0.45, 7);
      if (r.killed) {
        this.kills++;
        this.audio.zombieDie();
        this.hud.setCounts(this.zombies.aliveCount, this.kills);
        this.hud.toast('Zombi eliminado', 'info', 1100);
      }
    } else if (r.surfacePoint) {
      this.particles.emit(r.surfacePoint, 7, 0xd8d2c4, 2.2, 0.3, 8);
    }
  }

  _onZombieState(zombie, st) {
    if (st === ZombieState.ACTIVE) {
      this.audio.growl();
      if (this.time - this._lastAlert > 4) {
        this._lastAlert = this.time;
        this.hud?.toast('¡Un zombi te ha detectado!', 'warn', 1600);
      }
    }
  }

  _tryCollect(item) {
    const id = item.def.weapon;
    const cfg = CONFIG.WEAPONS.find((w) => w.id === id);
    if (this.ammo.isFull(id)) {
      if (this.time - this._lastFullMsg > 3) {
        this._lastFullMsg = this.time;
        this.hud.toast(`Munición de ${cfg.name} llena`, 'info', 1600);
      }
      return false;
    }
    const added = this.ammo.add(id, CONFIG.COLLECTIBLES.ammoBox[id]);
    this.audio.pickup();
    this.hud.toast(`+${added} munición · ${cfg.name}`, 'pickup', 2200);
    this.hud.setAmmo(this.weapons.current, this.ammo);
    return true;
  }

  gameOver() {
    this.state.set(GameState.GAME_OVER);
    this.audio.gameOver();
    this.player.cameraController.unlock();
  }

  victory() {
    this.state.set(GameState.VICTORY);
    this.audio.victory();
    this.player.cameraController.unlock();
  }

  // ------------------------------------------------------------------ bucle principal
  _loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._loop);
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05); // tope: evita saltos tras pestañas inactivas
    this._last = now;
    this.time += dt;
    this.update(dt);
    this.view.render();
  };

  update(dt) {
    const s = this.state.current;
    const camPos = this.view.camera.position;
    this.environment.update(camPos);
    this.world.update(this.time);
    this.extraction.update(this.time);
    this.particles.update(dt);

    if (s === GameState.MENU) { this._updateMenuScene(dt); return; }
    if (s === GameState.PLAYING) this._updatePlaying(dt);
    else this.weapons.update(dt, { speed: 0, lookX: 0, lookY: 0 });
  }

  /** Fondo animado del menú: cámara paseando por la avenida con zombis inactivos. */
  _updateMenuScene(dt) {
    const t = this.time;
    const cam = this.view.camera;
    cam.position.set(6 * Math.sin(t * 0.11), 3.4 + Math.sin(t * 0.2) * 0.4, 58 + 24 * Math.sin(t * 0.06));
    cam.lookAt(-2 + 5 * Math.sin(t * 0.09), 4.5, cam.position.z - 28);
    for (const z of this.zombies.zombies) z.update(dt, t);
    this.collectibles.update(dt, t, { x: 1e5, z: 1e5 }, () => false);
  }

  _updatePlaying(dt) {
    const player = this.player;
    this.runTime += dt;

    // 1) jugador
    player.update(dt, this.input.axis);

    // 2) zombis (estado + persecución)
    this.zombies.update(dt, this.time, player.position);

    // 3) derrota: un zombi vivo toca al jugador (se comprueba antes que la victoria)
    if (this.zombies.findContact(player.position, player.radius)) { this.gameOver(); return; }

    // 4) suministros
    this.collectibles.update(dt, this.time, player.position, (it) => this._tryCollect(it));

    // 5) misión
    const dExtract = Math.hypot(this.extraction.center.x - player.position.x, this.extraction.center.z - player.position.z);
    if (this.stage === MissionStage.START && player.position.z < SAFE_ZONE.z1 - 3) this._setStage(MissionStage.DEVELOPMENT);
    if (this.stage !== MissionStage.FINAL && dExtract < CONFIG.mission.finalStageDistance) this._setStage(MissionStage.FINAL);
    if (this.extraction.contains(player.position)) { this.victory(); return; }

    // 6) arma y HUD
    const look = this.input.consumeLook();
    this.weapons.update(dt, { speed: player.speed, lookX: look.x, lookY: look.y });
    this._updateHud(dt, dExtract);
  }

  _updateHud(dt, dExtract) {
    const p = this.player.position;
    const yaw = this.player.cameraController.yaw;
    this.hud.update(dt);
    this.hud.updateRadar(p, yaw, this.zombies.zombies.filter((z) => z.isAlive));
    const th = this.zombies.threat(p, 25);
    this.hud.setThreat(th.count, th.nearest);
    this.hud.setCounts(this.zombies.aliveCount, this.kills);
    // Brújula: rumbo hacia donde mira el jugador. La extracción está ESCONDIDA: lejos solo se da una dirección
    // aproximada (8 puntos cardinales); la distancia y la flecha aparecen únicamente con "señal fuerte" (< 80 m).
    const ex = this.extraction.center;
    const heading = compassName((-yaw * 180) / Math.PI);
    const bearing = (Math.atan2(ex.x - p.x, -(ex.z - p.z)) * 180) / Math.PI;      // 0° = norte, horario
    const lookBearing = (-yaw * 180) / Math.PI;
    const rel = ((bearing - lookBearing) * Math.PI) / 180;                        // ángulo del objetivo respecto a la mira
    this.hud.setHeading(heading);
    this.hud.setSignal(dExtract < CONFIG.mission.finalStageDistance, dExtract, rel, compassName(bearing));
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input?.dispose();
    this.player?.dispose();
    this.weapons?.dispose();
    this.zombies?.dispose();
    this.collectibles?.dispose();
    this.extraction?.dispose();
    this.particles?.dispose();
    this.world?.dispose();
    this.environment?.dispose();
    this.view?.dispose();
  }
}
