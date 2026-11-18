import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
async function walk(dir){const files=[];for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const files=await walk(root.pathname);const html=await readFile(new URL('index.html',root),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){assert(!m[1].startsWith('http'),'Unexpected remote initial asset');await stat(new URL(m[1],root));}
const assetHashes = JSON.parse(await readFile(new URL('../docs/assets.sha256.json', import.meta.url), 'utf8'));
const audioHashes = Object.entries(assetHashes).filter(([path]) => path.startsWith('audio/'));
const audioPaths = files.map(file => relative(root.pathname, file).replaceAll('\\', '/'))
 .filter(path => path.startsWith('audio/') || /\.(ogg|oga|wav|mp3|m4a|flac|aac|opus|weba)$/i.test(path));
assert.deepEqual(audioPaths.sort(), audioHashes.map(([path]) => path).sort(), 'Unexpected audio inventory');
for (const [path, sha256] of audioHashes) {
 const data = await readFile(new URL(path, root));
 assert.equal(data.toString('ascii', 0, 4), 'OggS', `Invalid OGG: ${path}`);
 assert.equal(createHash('sha256').update(data).digest('hex'), sha256, `Audio asset hash mismatch: ${path}`);
}
for(const name of ['THIRD_PARTY_NOTICES.txt','licenses/10block-MIT.txt','licenses/Vite-LICENSE.txt','licenses/Phaser-MIT.txt','licenses/Phaser-THIRD-PARTY-NOTICES.txt'])assert((await stat(new URL(name,root))).size>100);
for(const p of files){
 assert(!/\/(?:sw|registerSW|workbox[^/]*)\.js$/.test(p),'Service worker in platform build');assert(!p.endsWith('.webmanifest'),'PWA manifest');
 if(/\.(js|html|css)$/.test(p)){
  const s=await readFile(p,'utf8');assert(!/fonts\.googleapis|fonts\.gstatic|pairs-and-paths:|blockly:/.test(s),`Unexpected old namespace or remote font: ${p}`);
 }
}
assert(!html.includes('<button') && !html.includes('<input'), 'DOM game controls in entry document');
// The original 124-second soundtrack is 3.2 MiB on its own.
const bytes=(await Promise.all(files.map(p=>stat(p)))).reduce((n,f)=>n+f.size,0);assert(bytes<7*1024*1024,'Production size budget exceeded');
const digest=createHash('sha256');for(const p of files.sort()){digest.update(p.slice(root.pathname.length));digest.update(await readFile(p));}
console.log(JSON.stringify({result:'PASS',files:files.length,bytes,treeSha256:digest.digest('hex'),sdkPath:'/sdk.js is intentionally supplied by Yandex'},null,2));
