import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url);
const manifest = JSON.parse(await readFile(new URL('public/assets/cozy-mosaic/asset-manifest.json',root),'utf8'));
const keys = new Set(); let found = 0;
for (const a of manifest.assets) {
 assert(!keys.has(a.key),'Duplicate asset key'); keys.add(a.key);
 assert(/^public\/assets\/cozy-mosaic\/[a-z-]+\.(png|webp)$/.test(a.path),'Unsafe asset path');
 const url = new URL(a.path,root);
 try { await stat(url); } catch(e) { if(e.code==='ENOENT')continue;throw e; }
 const data=await readFile(url);assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256,`Asset checksum mismatch: ${a.path}`);found++;
}
assert(found===0||found===manifest.assets.length,`Incomplete art upload: ${found}/${manifest.assets.length}. Upload all pack images.`);
console.log(`Cozy assets: ${found}/${manifest.assets.length} · ${found ? 'SHA-256 verified; raster build' : 'intentional functional fallback build'}`);
