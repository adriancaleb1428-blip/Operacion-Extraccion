import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AmmoSystem } from '../src/weapons/AmmoSystem.js';
import { ShootingSystem } from '../src/weapons/ShootingSystem.js';
import { CollisionSystem } from '../src/systems/CollisionSystem.js';
import { Zombie } from '../src/enemies/Zombie.js';
import { ZombieAI, ZombieState } from '../src/enemies/ZombieAI.js';
import { ZombieManager } from '../src/enemies/ZombieManager.js';
import { CONFIG } from '../src/config.js';
import { WORLD, buildColliders, ZOMBIE_SPAWNS, AMMO_BOXES, PLAYER_START, EXTRACTION } from '../src/world/levelData.js';

// Pruebas de la lógica pura del juego (sin WebGL): munición, disparos, IA de zombis, colisiones y nivel.

const model = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.4), new THREE.MeshStandardMaterial()));
  return { scene: g, animations: [] };
};
const makeCollision = () => new CollisionSystem(WORLD);
const makeZombie = (x, z, type = 'walker', detect) =>
  new Zombie({ id: 1, spawn: { x, z }, typeName: type, model: model(), detect });

// ---------- RF02 munición ----------
test('RF02: munición independiente por arma, sin recarga manual, tope máximo', () => {
  const ammo = new AmmoSystem(CONFIG.WEAPONS);
  assert.equal(ammo.get('rifle'), CONFIG.WEAPONS[0].ammo.initial);
  assert.equal(ammo.get('pistol'), CONFIG.WEAPONS[1].ammo.initial);
  ammo.consume('rifle');
  assert.equal(ammo.get('rifle'), CONFIG.WEAPONS[0].ammo.initial - 1);
  assert.equal(ammo.get('pistol'), CONFIG.WEAPONS[1].ammo.initial, 'la pistola no cambia');
  while (ammo.consume('pistol'));
  assert.equal(ammo.get('pistol'), 0);
  assert.equal(ammo.consume('pistol'), false, 'no se puede consumir con 0');
  assert.equal(ammo.get('pistol'), 0);
  assert.equal(ammo.add('pistol', 4), 4);
  const room = ammo.max('rifle') - ammo.get('rifle');
  assert.equal(ammo.add('rifle', 9999), room, 'solo añade hasta el máximo');
  assert.equal(ammo.get('rifle'), ammo.max('rifle'));
  assert.equal(ammo.isFull('rifle'), true);
});

// ---------- RF07 disparos ----------
function setup() {
  const collision = makeCollision();
  const scene = new THREE.Scene();
  const zm = new ZombieManager({ scene, collision, assets: null });
  const z = makeZombie(0, -10);
  scene.add(z.group);
  zm.zombies.push(z); zm._rebuildCaches();
  scene.updateMatrixWorld(true);
  const ammo = new AmmoSystem(CONFIG.WEAPONS);
  const shooting = new ShootingSystem({ ammo, collision, zombies: zm });
  const weapon = { id: 'rifle', range: 100, damage: 1 };
  const origin = new THREE.Vector3(0, 1.7, 0);
  return { collision, zm, z, ammo, shooting, weapon, origin };
}
const fwd = new THREE.Vector3(0, -0.02, -1).normalize();

test('RF07: el zombi muere con exactamente 2 impactos válidos', () => {
  const { z, shooting, weapon, origin } = setup();
  assert.equal(z.health, 2);
  const r1 = shooting.fire(weapon, origin, fwd);
  assert.ok(r1.fired && r1.hit && !r1.killed);
  assert.equal(z.health, 1);
  assert.equal(z.isAlive, true);
  const r2 = shooting.fire(weapon, origin, fwd);
  assert.ok(r2.hit && r2.killed);
  assert.equal(z.health, 0);
  assert.equal(z.state, ZombieState.DEAD);
});

test('RF07: un disparo que falla no reduce la resistencia; el muerto ya no es objetivo', () => {
  const { z, shooting, weapon, origin, ammo } = setup();
  const miss = shooting.fire(weapon, origin, new THREE.Vector3(1, 0, -1).normalize());
  assert.ok(miss.fired && !miss.hit);
  assert.equal(z.health, 2);
  assert.equal(ammo.get('rifle'), CONFIG.WEAPONS[0].ammo.initial - 1, 'el fallo gasta munición');
  shooting.fire(weapon, origin, fwd); shooting.fire(weapon, origin, fwd);
  assert.equal(z.state, ZombieState.DEAD);
  shooting.zombies._rebuildCaches();
  const after = shooting.fire(weapon, origin, fwd);
  assert.ok(after.fired && !after.hit, 'no se puede dañar a un zombi muerto');
});

test('RF07: una pared entre jugador y zombi bloquea el disparo', () => {
  const { z, shooting, weapon, origin, collision } = setup();
  collision.addBox({ minX: -3, maxX: 3, minZ: -6, maxZ: -5, minY: 0, maxY: 4 });
  const r = shooting.fire(weapon, origin, fwd);
  assert.ok(r.fired && !r.hit);
  assert.ok(r.surfacePoint);
  assert.equal(z.health, 2);
});

test('RF07: el rayo usa la posición actual del zombi aunque no se haya renderizado', () => {
  const { z, shooting, weapon, origin } = setup();
  z.position.set(0, 0, -20); // se movió sin que nadie actualizara matrixWorld
  const r = shooting.fire(weapon, origin, fwd);
  assert.ok(r.hit, 'debe impactar en la nueva posición');
});

test('RF01/RF02: sin munición no se dispara', () => {
  const { shooting, weapon, origin, ammo, z } = setup();
  while (ammo.consume('rifle'));
  const r = shooting.fire(weapon, origin, fwd);
  assert.equal(r.fired, false);
  assert.equal(r.reason, 'NO_AMMO');
  assert.equal(z.health, 2);
});

// ---------- RF05 comportamiento ----------
test('RF05: INACTIVO fuera de rango, ACTIVO dentro, y persigue acercándose', () => {
  const ai = new ZombieAI(makeCollision());
  const z = makeZombie(0, 0, 'walker', 10);
  const far = { x: 0, z: 30 };
  for (let i = 0; i < 60; i++) ai.update(z, far, 1 / 60);
  assert.equal(z.state, ZombieState.IDLE);
  assert.equal(z.position.x, 0); assert.equal(z.position.z, 0, 'inactivo: no se mueve');
  const near = { x: 0, z: 8 };
  ai.update(z, near, 1 / 60);
  assert.equal(z.state, ZombieState.ACTIVE);
  const d0 = Math.hypot(near.x - z.position.x, near.z - z.position.z);
  for (let i = 0; i < 60; i++) ai.update(z, near, 1 / 60);
  const d1 = Math.hypot(near.x - z.position.x, near.z - z.position.z);
  assert.ok(d1 < d0 - 1, `debe acercarse (${d0.toFixed(2)} -> ${d1.toFixed(2)})`);
  // actualiza dirección: el jugador se mueve hacia +X
  ai.update(z, { x: z.position.x + 12, z: z.position.z }, 1 / 60);
  assert.ok(Math.abs(z.heading - Math.PI / 2) < 0.5, 'dirección hacia +X');
});

test('RF05: la distancia de detección es configurable por zombi', () => {
  const ai = new ZombieAI(makeCollision());
  const a = makeZombie(0, 0, 'walker', 5), b = makeZombie(0, 0, 'walker', 20);
  const p = { x: 0, z: 12 };
  ai.updateState(a, p); ai.updateState(b, p);
  assert.equal(a.state, ZombieState.IDLE);
  assert.equal(b.state, ZombieState.ACTIVE);
});

test('RF07/RF09: los zombis muertos no persiguen ni tocan al jugador', () => {
  const collision = makeCollision();
  const zm = new ZombieManager({ scene: new THREE.Scene(), collision, assets: null });
  const z = makeZombie(0, 0, 'walker', 50);
  zm.zombies.push(z); zm._rebuildCaches();
  const player = { x: 0, z: 0.5 };
  assert.equal(zm.findContact(player, CONFIG.player.radius), z, 'vivo: hay contacto');
  z.takeDamage(1); z.takeDamage(1);
  zm._rebuildCaches();
  assert.equal(zm.findContact(player, CONFIG.player.radius), null, 'muerto: sin contacto');
  const before = { ...z.position };
  for (let i = 0; i < 120; i++) zm.update(1 / 60, i / 60, { x: 10, z: 10 });
  assert.equal(z.position.x, before.x); assert.equal(z.position.z, before.z, 'muerto: no se mueve');
});

test('RF05: los zombis respetan los límites del escenario y las paredes', () => {
  const collision = makeCollision();
  collision.addBox({ minX: -5, maxX: 5, minZ: -2, maxZ: -1, minY: 0, maxY: 4 });
  const ai = new ZombieAI(collision);
  const z = makeZombie(0, 0, 'runner', 100);
  for (let i = 0; i < 600; i++) ai.update(z, { x: 0, z: -20 }, 1 / 60);
  assert.ok(z.position.z >= -1.001 - 0.5 || Math.abs(z.position.x) > 5, 'no atraviesa la pared (puede rodearla)');
  const edge = makeZombie(WORLD.maxX - 0.2, 0, 'runner', 500);
  for (let i = 0; i < 300; i++) ai.update(edge, { x: WORLD.maxX + 50, z: 0 }, 1 / 60);
  assert.ok(edge.position.x <= WORLD.maxX);
});

test('RF05: un zombi que pierde de vista al jugador (muy lejos) vuelve a INACTIVO', () => {
  const ai = new ZombieAI(makeCollision());
  const z = makeZombie(0, 0, 'walker', 10);
  ai.updateState(z, { x: 0, z: 5 });
  assert.equal(z.state, ZombieState.ACTIVE);
  ai.updateState(z, { x: 0, z: 10 * z.loseFactor + 5 });
  assert.equal(z.state, ZombieState.IDLE);
});

// ---------- colisiones del jugador ----------
test('el jugador no atraviesa cajas (se desliza)', () => {
  const c = makeCollision();
  c.addBox({ minX: -2, maxX: 2, minZ: -2, maxZ: 2 });
  const p = { x: 0, z: 3 };
  for (let i = 0; i < 100; i++) { p.z -= 0.1; c.resolveCircle(p, 0.45); }
  assert.ok(p.z >= 2.45 - 1e-6, `z=${p.z}`);
});

// ---------- validación del nivel ----------
test('nivel: ningún zombi, caja, inicio o extracción está dentro de un obstáculo', () => {
  const c = makeCollision();
  c.addBoxes(buildColliders());
  const bad = [];
  ZOMBIE_SPAWNS.forEach((s, i) => c.overlapsCircle(s.x, s.z, 0.5) && bad.push(`zombi#${i} (${s.x},${s.z})`));
  AMMO_BOXES.forEach((s, i) => c.overlapsCircle(s.x, s.z, 0.6) && bad.push(`caja#${i} (${s.x},${s.z})`));
  c.overlapsCircle(PLAYER_START.x, PLAYER_START.z, 0.5) && bad.push('inicio');
  c.overlapsCircle(EXTRACTION.x, EXTRACTION.z, 0.5) && bad.push('extracción');
  assert.deepEqual(bad, []);
});

test('nivel: los zombis empiezan lejos del jugador (nadie dentro de su rango al aparecer)', () => {
  for (const s of ZOMBIE_SPAWNS) {
    const t = CONFIG.ZOMBIE_TYPES[s.type];
    const d = Math.hypot(s.x - PLAYER_START.x, s.z - PLAYER_START.z);
    assert.ok(d > (s.detect ?? t.detect) + 5, `zombi (${s.x},${s.z}) demasiado cerca del inicio`);
  }
});

test('nivel: existe un camino transitable desde el inicio hasta la extracción (BFS, celdas de 0.5 m)', () => {
  const c = makeCollision();
  c.addBoxes(buildColliders());
  const cell = 0.5, r = CONFIG.player.radius;
  const W = Math.round((WORLD.maxX - WORLD.minX) / cell), H = Math.round((WORLD.maxZ - WORLD.minZ) / cell);
  const toI = (x, z) => [Math.round((x - WORLD.minX) / cell), Math.round((z - WORLD.minZ) / cell)];
  const free = (i, j) => i >= 0 && j >= 0 && i < W && j < H && !c.overlapsCircle(WORLD.minX + i * cell, WORLD.minZ + j * cell, r);
  const [si, sj] = toI(PLAYER_START.x, PLAYER_START.z), [ei, ej] = toI(EXTRACTION.x, EXTRACTION.z);
  const seen = new Uint8Array(W * H); const q = [[si, sj]]; seen[sj * W + si] = 1; let found = false;
  while (q.length) {
    const [i, j] = q.shift();
    if (Math.hypot(i - ei, j - ej) * cell <= CONFIG.mission.extractionRadius - 0.5) { found = true; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (free(ni, nj) && !seen[nj * W + ni]) { seen[nj * W + ni] = 1; q.push([ni, nj]); }
    }
  }
  assert.ok(found, 'no hay camino hasta la zona de extracción');
});

test('nivel: hay suficiente munición en el escenario pero es limitada', () => {
  const need = ZOMBIE_SPAWNS.length * CONFIG.combat.zombieHealth;
  const rifle = CONFIG.WEAPONS[0].ammo.initial + AMMO_BOXES.filter((b) => b.weapon === 'rifle').length * CONFIG.COLLECTIBLES.ammoBox.rifle;
  const pistol = CONFIG.WEAPONS[1].ammo.initial + AMMO_BOXES.filter((b) => b.weapon === 'pistol').length * CONFIG.COLLECTIBLES.ammoBox.pistol;
  assert.ok(rifle + pistol >= need, `munición total ${rifle + pistol} < impactos para matar a todos (${need})`);
  assert.ok(rifle + pistol < need * 3.5, 'la munición no debe ser abundante');
});
