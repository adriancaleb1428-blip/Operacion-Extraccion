import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';

// Verifica que los modelos GLB declarados en la configuración existen y son GLB (glTF 2.0) válidos.
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const toFile = (urlPath) => resolve(PUBLIC, urlPath.replace(/^\.?\//, ''));

function parseGLB(file) {
  const buf = readFileSync(file);
  assert.equal(buf.toString('ascii', 0, 4), 'glTF', `${file}: cabecera GLB inválida`);
  assert.equal(buf.readUInt32LE(4), 2, 'versión glTF 2');
  assert.equal(buf.readUInt32LE(8), buf.length, 'longitud declarada = tamaño del archivo');
  const jsonLen = buf.readUInt32LE(12);
  assert.equal(buf.toString('ascii', 16, 20), 'JSON');
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

const declared = [
  ...CONFIG.WEAPONS.map((w) => ({ role: `arma ${w.id}`, path: w.model.path })),
  ...Object.entries(CONFIG.ZOMBIE_MODELS).map(([k, m]) => ({ role: `zombi ${k}`, path: m.path })),
];

for (const d of declared) {
  test(`GLB declarado existe y es válido: ${d.role}`, () => {
    const file = toFile(d.path.replace(/^.*?assets\//, 'assets/'));
    assert.ok(existsSync(file), `falta ${file}`);
    const json = parseGLB(file);
    assert.ok(json.meshes?.length > 0, 'el GLB debe contener mallas');
    assert.ok(json.nodes?.length > 0);
  });
}

test('al menos 2 armas distintas y 1 modelo de zombi configurados', () => {
  assert.ok(new Set(CONFIG.WEAPONS.map((w) => w.model.path)).size >= 2);
  assert.ok(Object.keys(CONFIG.ZOMBIE_MODELS).length >= 1);
});
