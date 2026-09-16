import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [assetId, outputFile] = process.argv.slice(2);
if (!assetId || !outputFile) throw new Error('Usage: node scripts/fetch-polyhaven-hdri.mjs <asset-id> <output-file>');

const apiResponse = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
if (!apiResponse.ok) throw new Error(`Poly Haven API returned ${apiResponse.status}`);
const files = await apiResponse.json();
const descriptor = files.hdri?.['1k']?.hdr;
if (!descriptor?.url) throw new Error(`No 1K HDR file found for ${assetId}`);

const response = await fetch(descriptor.url);
if (!response.ok) throw new Error(`HDR download returned ${response.status}`);
const data = Buffer.from(await response.arrayBuffer());
const digest = createHash('md5').update(data).digest('hex');
if (descriptor.md5 && digest.toLowerCase() !== descriptor.md5.toLowerCase()) throw new Error('HDR MD5 mismatch');
const target = path.resolve(outputFile);
const safeRoot = path.resolve(process.cwd()) + path.sep;
if (!target.startsWith(safeRoot)) throw new Error(`Unsafe HDR path: ${target}`);
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, data);
console.log(`${target} ${data.length} ${digest}`);
