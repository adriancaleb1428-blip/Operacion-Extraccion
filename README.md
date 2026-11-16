# OPERACIÓN EXTRACCIÓN: SOBREVIVE AL APOCALIPSIS

Videojuego **FPS 3D** en el navegador (JavaScript + Three.js/WebGL + Vite).
Proyecto de **Computación Gráfica y Visual — Universidad Privada del Norte (UPN), T3, semana 13**.

> Una infección convirtió a gran parte de la población en zombis. Eres uno de los últimos sobrevivientes: sal de la zona segura, cruza una ciudad abandonada, administra tu munición limitada y llega a la **zona de extracción**.

## Objetivo de la misión

| Etapa | Qué ocurre |
|---|---|
| **INICIO** | Apareces en una zona segura con **dos armas** y munición limitada. Se muestran las instrucciones. |
| **DESARROLLO** | Recorres cientos de metros de ciudad (calles, edificios, vehículos, barricadas, zonas de peligro), recoges cajas de munición y enfrentas zombis. |
| **FINAL** | La zona de extracción (círculo verde + haz de luz + helicóptero) está **escondida** dentro de un recinto amurallado en la esquina noreste, con una sola entrada en su muro oeste. Lejos solo recibes una señal de radio débil con un rumbo aproximado; a menos de 80 m la señal es fuerte (distancia + flecha). Al entrar: **¡MISIÓN COMPLETADA! Has llegado a la zona de extracción.** y la partida se detiene. |

Si un zombi vivo te toca → **GAME OVER** (con botón de reinicio y de volver al menú).

## Tecnologías

- JavaScript (ES modules), HTML5, CSS3
- [Three.js](https://threejs.org/) (WebGL) `^0.187` — `GLTFLoader`, `PointerLockControls`, `Raycaster`
- [Vite](https://vitejs.dev/) `^8` como entorno de desarrollo/compilación
- Node.js ≥ 18 (probado con Node 24)
- Sin otras dependencias: audio con Web Audio API, texturas generadas con `canvas`, colisiones propias (AABB + círculos).

## Instalación y ejecución

```bash
npm install
npm run dev        # abre http://localhost:5173 (si está ocupado, Vite usa otro puerto)
```

Otros comandos:

```bash
npm run build      # compila a dist/ (listo para publicar)
npm run preview    # sirve dist/ localmente
npm test           # 25 pruebas automáticas de lógica, nivel y archivos GLB
npm run gen:models # regenera los GLB provisionales (ver "Modelos 3D")
```

Requiere un navegador de escritorio moderno con WebGL2 (Chrome, Edge, Firefox). Haz clic en **JUGAR** para capturar el mouse.

## Controles

| Tecla / acción | Efecto |
|---|---|
| **W / A / S / D** | Avanzar / izquierda / retroceder / derecha |
| **Mouse** | Orientar la cámara (giro horizontal y vertical limitado a ±83°) |
| **Clic izquierdo** | Disparar — **un clic = un disparo** (mantener presionado no dispara en automático) |
| **1** | Arma principal: Fusil de asalto |
| **2** | Arma secundaria: Pistola |
| **Rueda del mouse** | Cambiar de arma (arriba/abajo) |
| **Esc** | Pausa (al liberar el mouse) |

## Mecánicas

- **Armas (RF01):** dos armas con modelo GLB en primera persona, renderizadas en una pasada aparte (no atraviesan paredes), con balanceo al caminar, inercia al girar, retroceso y fogonazo. El cambio con 1/2 anima el arma.
- **Munición (RF02):** contador independiente por arma. Inicial: fusil 14, pistola 10 (máx. 60 / 36). **No hay recarga por tecla**; solo cajas del escenario. Sin munición no se dispara. Se configura en [`src/config.js`](src/config.js) (`WEAPONS[i].ammo`, `COLLECTIBLES.ammoBox`).
- **Mundo (RF03):** ciudad de 320 × 320 m (generación procedural determinista) desde [`src/world/levelData.js`](src/world/levelData.js): avenidas y calles, más de 100 edificios con fachadas texturizadas (ventanas encendidas/rotas), decenas de vehículos abandonados y barreras (concreto, sacos, contenedores de basura, cajas), estacionamiento, parque, obra, plaza final, barriles con fuego, farolas, zonas de peligro marcadas, zona segura con valla y puerta, muros perimetrales y siluetas de ciudad lejana. Luna + niebla + 6 luces en total (hemisférica, direccional con sombras que sigue al jugador y 4 puntuales: reflector de la zona segura, 2 fuegos y la extracción).
- **Zombis (RF04–RF05):** 50 zombis con modelos GLB (3 modelos / 3 tipos: 32 *walker*, 10 *runner*, 8 *lurker*). Estados **INACTIVO** (quieto, no persigue) y **ACTIVO** (persigue, actualiza su dirección cada frame, esquiva obstáculos y respeta límites). Activación al entrar en su **distancia de detección**; además, al salir de la zona segura se activa el **modo caza** (detección de 75 m) y los zombis siguen un campo de flujo (BFS) que los hace rodear edificios (configurable por tipo y por zombi). Vuelven a INACTIVO si el jugador se aleja `detect × loseFactor`.
- **Disparos (RF07):** `Raycaster` desde el centro de la cámara contra el *hitbox* de cada zombi; las paredes/vehículos bloquean el tiro (rayo 3D contra las cajas de colisión). **2 puntos de resistencia**: muere con exactamente 2 impactos; un fallo no hace daño. Feedback: marcador de impacto (X, roja si mata), chispas, parpadeo rojo del zombi, sonido. Los muertos caen, dejan de perseguir y de tocar al jugador.
- **Suministros (RF10):** cajas flotantes con haz de luz (naranja = fusil, celeste = pistola), recogida por proximidad con estallido de partículas, mensaje y sonido; desaparecen. Si el arma está llena, la caja se deja.
- **Misión (RF08):** etapas INICIO → DESARROLLO (al salir de la zona segura) → FINAL (a menos de 80 m de la extracción, señal fuerte). HUD con rumbo (brújula) y señal de radio hacia la extracción oculta.
- **Derrota (RF09):** contacto con un zombi vivo → GAME OVER, la simulación se congela (no hay movimiento ni disparos), botones **Reiniciar** y **Menú principal**.
- **Dificultad (RF11):** 50 zombis agrupados cerca de suministros y chokepoints (retén de la avenida, plaza final), detecciones de 12–24 m, velocidades 1.9–3.7 m/s (el jugador corre a 5.0 m/s), 32 cajas de munición repartidas por el mapa (si se recogieran todas habría ≈ 3× los impactos necesarios para eliminar a todos, pero en una ruta directa se alcanzan pocas, y muchos zombis se pueden evitar), obstáculos que obligan a rodear. Se verificó con un bot de pruebas que el nivel es completable.
- **HUD:** mira, arma/munición (y la del arma no activa), radar de amenazas rotado con la cámara, contador de enemigos cercanos/vivos/eliminados, mensajes de suministro y misión, viñeta de peligro.

## Arquitectura

```
index.html                    Menú, HUD y pantallas (DOM)
src/
  main.js                     Punto de entrada
  config.js                   ★ Balance y rutas de modelos (munición, zombis, armas)
  game/
    Game.js                   Orquestador y bucle principal (requestAnimationFrame)
    GameState.js              Estados (MENU, PLAYING, PAUSED, VICTORY, GAME_OVER) y etapas
    SceneManager.js           Renderer, cámara FPS y escena del arma (2 pasadas)
  player/
    Player.js · CameraController.js (PointerLockControls) · MovementController.js
  weapons/
    Weapon.js · WeaponManager.js · ShootingSystem.js (Raycaster) · AmmoSystem.js
  enemies/
    Zombie.js · ZombieAI.js (estados) · ZombieManager.js
  world/
    levelData.js              ★ Posiciones: zombis, cajas, vehículos, barreras, calles
    WorldBuilder.js · Environment.js · Props.js · Textures.js · StaticBatcher.js
    Collectibles.js · ExtractionZone.js
  systems/
    CollisionSystem.js · InputManager.js · AudioManager.js · AssetLoader.js · Effects.js
  ui/
    Menu.js · HUD.js · GameOverScreen.js · VictoryScreen.js
  styles/main.css
scripts/generate-placeholder-models.mjs   Genera los GLB provisionales
public/assets/{models,textures,audio}
tests/                        Pruebas con node:test
```

Separación de responsabilidades: **lógica** (`weapons/`, `enemies/`, `systems/CollisionSystem`) sin dependencia del DOM → probada con `npm test`; **renderizado** (`game/SceneManager`, `world/`); **interfaz** (`ui/`).

Buenas prácticas aplicadas: sin objetos nuevos por frame en los bucles calientes, partículas en un único `Points` con pool, geometrías de caja compartidas y mallas estáticas fusionadas por material (≈ 700 draw calls con sombras), `devicePixelRatio` limitado, `dt` acotado, máximo 6 luces, hitboxes simples, `dispose()` de recursos, carga de modelos con manejo de errores.

### Cobertura de requerimientos

| RF | Dónde |
|---|---|
| RF01 armas | `weapons/WeaponManager.js`, `Weapon.js`, `systems/InputManager.js` (`mousedown` ⇒ 1 disparo) |
| RF02 munición | `weapons/AmmoSystem.js`, `world/Collectibles.js`, `config.js` |
| RF03 mundo | `world/*`, `levelData.js` |
| RF04/05 zombis | `enemies/*` |
| RF06 FPS | `player/*`, `game/SceneManager.js` |
| RF07 disparos | `weapons/ShootingSystem.js`, `systems/CollisionSystem.js` |
| RF08 misión | `game/Game.js`, `world/ExtractionZone.js`, `ui/VictoryScreen.js` |
| RF09 derrota | `Game.js` (`findContact`), `ui/GameOverScreen.js` |
| RF10 coleccionables | `world/Collectibles.js` |
| RF11 dificultad | `config.js`, `levelData.js` |

## Modelos 3D (GLB)

El juego usa **GLB** para las 2 armas y los zombis, cargados con `GLTFLoader` desde `public/assets/models/`:

| Archivo | Uso |
|---|---|
| `public/assets/models/weapons/rifle.glb` | Arma principal (tecla 1) |
| `public/assets/models/weapons/pistol.glb` | Arma secundaria (tecla 2) |
| `public/assets/models/zombies/zombie_a.glb` | Zombi tipo *walker* |
| `public/assets/models/zombies/zombie_b.glb` | Zombi tipo *runner* |
| `public/assets/models/zombies/zombie_c.glb` | Zombi tipo *lurker* |

### Estado actual: modelos REALES (Quaternius, CC0)

Los 5 archivos son **GLB reales** del pack **[Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html)** de Quaternius (licencia **CC0 1.0**, dominio público), convertidos de `.gltf` a `.glb` con [`scripts/gltf-to-glb.mjs`](scripts/gltf-to-glb.mjs):

| Archivo del juego | Modelo original |
|---|---|
| `weapons/rifle.glb` | `Weapons/Rifle` |
| `weapons/pistol.glb` | `Weapons/Pistol` |
| `zombies/zombie_a.glb` (walker) | `Characters/Zombie_Basic` |
| `zombies/zombie_b.glb` (runner) | `Characters/Zombie_Arm` |
| `zombies/zombie_c.glb` (lurker) | `Characters/Zombie_Chubby` |

Los zombis usan las animaciones del GLB (`Idle` en reposo, `Walk` al perseguir). El juego reporta el origen de cada recurso: el menú muestra *"5 modelo(s) GLB reales"* y **Créditos → Recursos 3D** lista el estado de cada archivo (`real` / `placeholder` / `fallback`). Si un GLB falta o falla, se usa geometría de emergencia y se marca `fallback`.

`npm run gen:models` genera modelos **provisionales** de cajas y **no sobrescribe** modelos reales (salvo con `--force`).

### Cómo incorporar tus modelos reales

1. Descarga modelos (ver "Fuentes") y **respeta su licencia** (atribución si lo exige).
2. Colócalos **con los mismos nombres** sobrescribiendo los de arriba (o añade nuevos y cambia las rutas en `src/config.js`: `WEAPONS[i].model.path` y `ZOMBIE_MODELS`).
3. Ajustes en `src/config.js` si hace falta:
   - **Armas:** el modelo debe apuntar hacia **−Z**; si apunta a otro lado usa `model.rotationY` (grados). `model.length` escala automáticamente el largo; `model.viewPosition` fija su posición en pantalla `[x, y, z]`.
   - **Zombis:** se escalan automáticamente a `ZOMBIE_TYPES[tipo].height` y se apoyan en el suelo. Deben mirar hacia **+Z** (o usa `ZOMBIE_MODELS[k].rotationY`). Si el GLB trae animaciones se usan (clip *walk/run* al perseguir, *idle* en reposo); si no, se animan los nodos `legL/legR/armL/armR` cuando existen.
   - Más variedad: agrega entradas a `ZOMBIE_MODELS` y asígnalas a un tipo (`ZOMBIE_TYPES[tipo].model`).
4. Reinicia `npm run dev` y revisa en el menú que diga *reales*.

### Fuentes recomendadas de modelos gratuitos (revisa la licencia de cada archivo)

- [Quaternius](https://quaternius.com/) — packs de armas y zombis, normalmente CC0.
- [Kenney](https://kenney.nl/) — assets CC0.
- [Poly Pizza](https://poly.pizza/) — modelos CC0 / CC-BY (exige atribución en CC-BY).
- [Sketchfab](https://sketchfab.com/) (filtro *Downloadable* + licencia) — requiere atribuir según la licencia de cada modelo.

### Licencias y créditos de recursos

| Recurso | Origen | Licencia |
|---|---|---|
| Código del juego | Este proyecto | Académico / MIT (`package.json`) |
| 5 modelos GLB (fusil, pistola, 3 zombis) | [Quaternius — Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html) | CC0 1.0 (dominio público) |
| Modelos provisionales (respaldo) | `scripts/generate-placeholder-models.mjs` | Propios del proyecto |
| Texturas (suelo, fachadas, señales) | Generadas con `canvas` en tiempo de ejecución | Propias |
| Audio | Sintetizado con Web Audio API (sin archivos) | Propio |
| Three.js, Vite | npm | MIT |

> CC0 no exige atribución, pero se acredita a Quaternius (https://quaternius.com/). El `License.txt` del pack trae por error el encabezado de otro pack, pero declara CC0 1.0, igual que la página oficial del kit.

## Configuración rápida

- Munición inicial / máxima: `src/config.js → WEAPONS[i].ammo`
- Munición por caja: `src/config.js → COLLECTIBLES.ammoBox`
- Velocidad y detección de zombis: `src/config.js → ZOMBIE_TYPES` (y `detect` en cada zombi de `levelData.js`)
- Cantidad y posición de zombis / cajas / vehículos: `src/world/levelData.js`

## Pruebas

`npm test` ejecuta 25 pruebas: munición independiente, 2 impactos exactos, fallos sin daño, bloqueo por paredes, sin munición no dispara, estados INACTIVO/ACTIVO, detección configurable, modo caza y rodeo de edificios, muertos inertes, límites del mapa, validez del nivel (nada dentro de obstáculos, **camino transitable inicio → extracción por BFS**) y validez de los GLB.

Para depurar en el navegador: `?debug=1` expone `window.__game`; `?nolock=1` permite jugar sin captura de mouse (útil en navegadores embebidos donde Pointer Lock no está permitido).

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Operación Extracción"
git branch -M main
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

El repositorio incluye `.github/workflows/deploy.yml`: al hacer push a `main`, compila y publica en **GitHub Pages** (activa *Settings → Pages → Source: GitHub Actions*). `vite.config.js` usa `base: './'`, por lo que funciona en cualquier subruta.

## Limitaciones conocidas

- Los zombis reales no tienen animación de muerte propia en el juego: al morir caen con una rotación simple.
- La IA persigue en línea recta con deslizamiento y rodeo simple; no usa *pathfinding* completo, por lo que un zombi puede tardar en rodear manzanas grandes.
- El audio es sintético; se pueden añadir archivos en `public/assets/audio/`.
- Probado en Chrome/Edge sobre escritorio; no está optimizado para móviles (requiere teclado y mouse).
