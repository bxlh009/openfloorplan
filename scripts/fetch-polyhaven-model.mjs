import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [assetId, outputDir] = process.argv.slice(2);
if (!assetId || !outputDir) throw new Error('Usage: node scripts/fetch-polyhaven-model.mjs <asset-id> <output-dir>');

const apiResponse = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
if (!apiResponse.ok) throw new Error(`Poly Haven API returned ${apiResponse.status}`);
const files = await apiResponse.json();
const gltf = files.gltf?.['1k']?.gltf;
if (!gltf?.url) throw new Error(`No 1K glTF package found for ${assetId}`);

const downloads = new Map([[path.basename(new URL(gltf.url).pathname), gltf], ...Object.entries(gltf.include || {})]);
for (const [relativePath, descriptor] of downloads) {
  const response = await fetch(descriptor.url);
  if (!response.ok) throw new Error(`${relativePath}: download returned ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const digest = createHash('md5').update(data).digest('hex');
  if (descriptor.md5 && digest.toLowerCase() !== descriptor.md5.toLowerCase()) throw new Error(`${relativePath}: MD5 mismatch`);
  const target = path.resolve(outputDir, relativePath);
  const safeRoot = path.resolve(outputDir) + path.sep;
  if (!target.startsWith(safeRoot)) throw new Error(`Unsafe model path: ${relativePath}`);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`${relativePath} ${data.length} ${digest}`);
}
