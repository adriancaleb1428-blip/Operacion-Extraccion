# Lista de evidencias para la sustentación

Capturas / clips sugeridos para demostrar cada requerimiento funcional. Usa `npm run dev`, abre el juego y juega con captura de mouse normal.

## A. Capturas de pantalla

| # | Evidencia | Cómo obtenerla | RF |
|---|---|---|---|
| 1 | **Menú principal** con fondo de ciudad, JUGAR / INSTRUCCIONES / CRÉDITOS | Al abrir el juego | Interfaz |
| 2 | **Instrucciones** y **Créditos** (con el estado de los modelos 3D) | Botones del menú | Interfaz / Recursos |
| 3 | **Inicio de misión**: zona segura, HUD completo, mensajes de instrucciones | Clic en JUGAR | RF08 (INICIO) |
| 4 | **Arma 1 (fusil) en primera persona** con munición en el HUD | Tecla 1 | RF01 |
| 5 | **Arma 2 (pistola) en primera persona**, HUD cambiado | Tecla 2 | RF01 |
| 6 | Munición **independiente**: HUD con `FUSIL 14 / PISTOLA 10`, disparar con una y comparar | Disparar con cada arma | RF02 |
| 7 | **Sin munición**: mensaje "SIN MUNICIÓN" y el contador en 0 (clic sin efecto) | Gastar toda la munición de un arma | RF01/RF02 |
| 8 | **Ciudad**: avenida con vehículos abandonados, edificios, barricadas, zona de peligro marcada | Recorrer la avenida central | RF03 |
| 9 | Zombi **inactivo** (radar: punto ámbar) a distancia | Acercarse sin entrar en su rango (≈15 m) | RF05 |
| 10 | Zombi **activo** persiguiéndote (punto rojo en el radar, toast "¡Un zombi te ha detectado!") | Entrar en su rango | RF05 |
| 11 | **Impacto**: marcador de impacto + zombi en rojo y chispas | Disparar a un zombi | RF07 |
| 12 | **Zombi eliminado** (cuerpo en el suelo, X roja, contador "Eliminados") | Segundo impacto | RF07 |
| 13 | **Caja de munición** (haz de luz) y el **mensaje "+8 munición"** al recogerla | Acercarse a una caja | RF10 |
| 14 | **GAME OVER** con botones Reiniciar / Menú | Dejar que un zombi te toque | RF09 |
| 15 | Partida **reiniciada** (munición inicial, zombis en su sitio, cajas de nuevo) | Botón REINICIAR | RF09 |
| 16 | **Etapa FINAL**: haz verde de la extracción, misión "FINAL", distancia | Acercarse a la plaza norte | RF08 |
| 17 | **¡MISIÓN COMPLETADA!** — "Has llegado a la zona de extracción." | Entrar al círculo verde | RF08 |
| 18 | **Consola del navegador** (F12) con el reporte `[Recursos 3D]` | F12 → Console | RF04 / Recursos |
| 19 | **Terminal** con `npm test` (22 pruebas OK) y `npm run build` | Terminal | Pruebas |
| 20 | **Explorador de archivos / README**: estructura modular `src/` y carpeta `public/assets/models` | Editor | Arquitectura |
| 21 | **Instalación limpia**: `npm install` + `npm run dev` | Terminal | Pruebas (#15) |

## B. Guion del video (máx. 3:00)

1. **0:00–0:40 — Explicación técnica** de una parte relevante del código. Sugerencia: `src/weapons/ShootingSystem.js` (`fire()`): consumo de munición, `Raycaster` contra el hitbox, comparación con `collision.raycast` (pared vs zombi) y `takeDamage(1)` (2 impactos). Alternativa: `src/enemies/ZombieAI.js` (máquina de estados INACTIVO/ACTIVO).
2. **0:40–2:30 — Demostración**: menú → JUGAR → WASD + mouse → tecla 1/2 → disparo suelto (un clic = un disparo) → munición independiente → recoger caja → zombi inactivo vs activo → 2 impactos y muere → recorrer hasta la extracción → **¡MISIÓN COMPLETADA!**.
3. **2:30–3:00 — Casos límite**: sin munición (clic sin efecto), GAME OVER + reinicio, y mencionar la arquitectura modular y que los GLB provisionales se sustituyen sin tocar el código.

## C. Checklist de las 15 pruebas obligatorias

- [ ] 1 WASD · [ ] 2 Mouse controla cámara · [ ] 3 Teclas 1 y 2 · [ ] 4 Un clic = un disparo · [ ] 5 Munición independiente
- [ ] 6 Sin munición no dispara · [ ] 7 Cajas recuperan munición · [ ] 8 Zombis inactivos fuera de rango · [ ] 9 Persiguen al detectar
- [ ] 10 Exactamente 2 impactos · [ ] 11 Muertos no persiguen · [ ] 12 Contacto = GAME OVER · [ ] 13 Extracción = victoria
- [ ] 14 Reinicio · [ ] 15 Instalación limpia (`npm install` → `npm run dev`)
