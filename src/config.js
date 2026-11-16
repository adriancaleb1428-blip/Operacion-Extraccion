/**
 * CONFIGURACIÓN CENTRAL DEL JUEGO
 * ---------------------------------------------------------------------------
 * Aquí se ajusta casi todo el balance sin tocar la lógica:
 *   - Munición inicial / máxima por arma  -> WEAPONS[i].ammo
 *   - Munición que da cada caja           -> COLLECTIBLES.ammoBox
 *   - Distancia de detección y velocidad  -> ZOMBIE_TYPES (y `detect` por zombi en levelData.js)
 *   - Rutas de los modelos GLB            -> WEAPONS[i].model.path / ZOMBIE_MODELS
 * Las posiciones de zombis, cajas y obstáculos están en src/world/levelData.js.
 */

const BASE = import.meta.env?.BASE_URL ?? './';
const asset = (p) => `${BASE}assets/${p}`;

export const CONFIG = {
  player: {
    eyeHeight: 1.7,      // altura de los ojos (m)
    radius: 0.45,        // radio de colisión (m)
    speed: 5.0,          // velocidad máxima (m/s)
    acceleration: 38,    // aceleración / frenado -> movimiento fluido
    bobAmount: 0.045,    // balanceo de cámara al caminar
    pitchLimit: 1.45,    // límite vertical (rad) ~ 83°
    mouseSensitivity: 1, // multiplicador de PointerLockControls.pointerSpeed
  },

  mission: {
    extractionRadius: 5,      // radio de la zona de extracción (m)
    finalStageDistance: 80,   // distancia a la extracción que activa la etapa FINAL (y revela la señal)
    instructionsSeconds: 9,   // tiempo que se muestran las instrucciones iniciales
  },

  combat: {
    zombieHealth: 2,          // RF07: exactamente 2 puntos de resistencia
    damagePerHit: 1,          // RF07: cada impacto válido resta 1
    contactDistance: 0.95,    // distancia (centro a centro) a la que un zombi "toca" al jugador
    hitMarkerSeconds: 0.18,
  },

  // Arma 1 = principal (tecla 1), Arma 2 = secundaria (tecla 2)
  WEAPONS: [
    {
      id: 'rifle',
      slot: 1,
      name: 'FUSIL DE ASALTO',
      model: {
        path: asset('models/weapons/rifle.glb'),
        length: 0.55,              // largo del modelo en pantalla (m) -> se escala automáticamente
        rotationY: 180,             // los GLB de Quaternius apuntan a +Z: se giran 180° para apuntar a -Z (grados)
        viewPosition: [0.14, -0.17, -0.5], // posición en primera persona (x derecha, y arriba, z adelante negativa)
      },
      ammo: { initial: 14, max: 60 },
      range: 140,
      damage: 1,
      kick: 0.07,
      flash: 0xffc060,
    },
    {
      id: 'pistol',
      slot: 2,
      name: 'PISTOLA',
      model: {
        path: asset('models/weapons/pistol.glb'),
        length: 0.3,
        rotationY: 180,
        viewPosition: [0.11, -0.12, -0.36],
      },
      ammo: { initial: 10, max: 36 },
      range: 70,
      damage: 1,
      kick: 0.09,
      flash: 0xffd9a0,
    },
  ],

  COLLECTIBLES: {
    pickupRadius: 1.9,
    // Munición que otorga cada tipo de caja (se suma sin pasar el máximo del arma)
    ammoBox: { rifle: 8, pistol: 6 },
  },

  // MODO CAZA: al salir de la zona segura, TODOS los zombis amplían su rango de detección a `range` metros
  // (y no lo pierden hasta que el jugador se aleja `range * loseFactor`). Así vienen hacia ti desde lejos.
  HUNT: { range: 75, loseFactor: 1.8 },

  // Tipos de zombi. `detect` = distancia de detección (m); `loseFactor` = factor de histéresis
  // (se vuelve INACTIVO si el jugador se aleja más de detect * loseFactor).
  ZOMBIE_TYPES: {
    walker: { speed: 2.3, detect: 15, loseFactor: 1.8, model: 'a', height: 1.8 },
    runner: { speed: 3.7, detect: 12, loseFactor: 1.6, model: 'b', height: 1.85 },
    lurker: { speed: 1.9, detect: 24, loseFactor: 1.5, model: 'c', height: 1.75 },
  },

  // Modelos GLB de zombis disponibles (se asignan por tipo). Agrega más y referencia su clave.
  ZOMBIE_MODELS: {
    a: { path: asset('models/zombies/zombie_a.glb'), rotationY: 0 },
    b: { path: asset('models/zombies/zombie_b.glb'), rotationY: 0 },
    c: { path: asset('models/zombies/zombie_c.glb'), rotationY: 0 },
  },

  render: {
    maxPixelRatio: 1.75,
    fov: 75,
    far: 420,
    shadowMapSize: 2048,
    shadowRadius: 48,
  },
};
