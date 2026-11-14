/**
 * Convierte un .gltf AUTOCONTENIDO (buffer incrustado como data URI) a .glb.
 * Uso:  node scripts/gltf-to-glb.mjs <entrada.gltf> <salida.glb> ["Fuente / licencia"]
 *
 * Útil para modelos como los de Quaternius (CC0), que se distribuyen en .gltf con el buffer
 * y las texturas incrustados.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [input, output, credit] = process.argv.slice(2);
if (!input || !output) {
  console.error('Uso: node scripts/gltf-to-glb.mjs <entrada.gltf> <salida.glb> ["Fuente / licencia"]');
  process.exit(1);
}

const json = JSON.parse(readFileSync(input, 'utf8'));
if (json.buffers?.length !== 1) throw new Error('Solo se admiten .gltf con un único buffer');
const uri = json.buffers[0].uri;
if (!uri?.startsWith('data:')) throw new Error('El buffer no está incrustado (data URI); usa un .gltf autocontenido');

let bin = Buffer.from(uri.split(',')[1], 'base64');
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
delete json.buffers[0].uri;
json.buffers[0].byteLength = bin.length;
if (credit) json.asset.extras = { ...(json.asset.extras ?? {}), source: credit };

let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii'); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.write('JSON', 4, 'ascii');
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4, 'ascii');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, jh, jsonBuf, bh, bin]));
console.log(`✔ ${output} (${(total / 1024).toFixed(0)} KB)`);
