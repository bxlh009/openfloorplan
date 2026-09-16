import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const allowed = new Map([
  ['RGBELoader.js', 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js'],
]);
const [addon, outputFile] = process.argv.slice(2);
if (!allowed.has(addon) || !outputFile) throw new Error('Usage: node scripts/fetch-three-addon.mjs RGBELoader.js <output-file>');
const response = await fetch(allowed.get(addon));
if (!response.ok) throw new Error(`${addon}: download returned ${response.status}`);
const source = await response.text();
if (!source.includes("from 'three'")) throw new Error(`${addon}: unexpected upstream source`);
const patched = source.replaceAll("from 'three'", "from '../three.module.js'");
const target = path.resolve(outputFile);
const safeRoot = path.resolve(process.cwd()) + path.sep;
if (!target.startsWith(safeRoot)) throw new Error(`Unsafe add-on path: ${target}`);
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, patched);
console.log(`${target} ${Buffer.byteLength(patched)} ${createHash('sha256').update(patched).digest('hex')}`);
