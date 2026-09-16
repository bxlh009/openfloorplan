import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [url, outputFile, expectedSha256, variantName] = process.argv.slice(2);
if (!url || !outputFile) {
  throw new Error('Usage: node scripts/fetch-khronos-asset.mjs <url> <output-file> [expected-sha256]');
}

const response = await fetch(url);
if (!response.ok) throw new Error(`Khronos asset download returned ${response.status}`);
let data = Buffer.from(await response.arrayBuffer());
const sourceDigest = createHash('sha256').update(data).digest('hex');
if (expectedSha256 && sourceDigest.toLowerCase() !== expectedSha256.toLowerCase()) {
  throw new Error('SHA-256 mismatch');
}

if (variantName) {
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString().replace(/\0+$/u, '').trimEnd());
  const variantIndex = json.extensions?.KHR_materials_variants?.variants?.findIndex(variant => variant.name === variantName);
  if (variantIndex < 0) throw new Error(`Unknown glTF material variant: ${variantName}`);
  let replacements = 0;
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const mapping = primitive.extensions?.KHR_materials_variants?.mappings?.find(item => item.variants?.includes(variantIndex));
      if (mapping) { primitive.material = mapping.material; replacements += 1; }
    }
  }
  if (!replacements) throw new Error(`No primitives use glTF material variant: ${variantName}`);
  const encoded = Buffer.from(JSON.stringify(json));
  if (encoded.length > jsonLength) throw new Error('Updated glTF JSON no longer fits the original GLB chunk');
  const patched = Buffer.from(data);
  encoded.copy(patched, 20);
  patched.fill(0x20, 20 + encoded.length, 20 + jsonLength);
  data = patched;
}

const target = path.resolve(outputFile);
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, data);
const outputDigest = createHash('sha256').update(data).digest('hex');
console.log(`${target} ${data.length} ${outputDigest}${variantName ? ` variant=${variantName}` : ''}`);
