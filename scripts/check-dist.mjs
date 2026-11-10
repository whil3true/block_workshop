import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
async function walk(dir){const files=[];for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const files=await walk(root.pathname);const html=await readFile(new URL('index.html',root),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){assert(!m[1].startsWith('http'),'Unexpected remote initial asset');await stat(new URL(m[1],root));}
for(const name of ['pickup','place','reject','clear','combo','perfect','gameover','workshop']){
 const b=await readFile(new URL(`audio/${name}.wav`,root));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
}
for(const name of ['THIRD_PARTY_NOTICES.txt','licenses/10block-MIT.txt','licenses/Vite-LICENSE.txt'])assert((await stat(new URL(name,root))).size>100);
for(const p of files){
 assert(!/\/(?:sw|registerSW|workbox[^/]*)\.js$/.test(p),'Service worker in platform build');assert(!p.endsWith('.webmanifest'),'PWA manifest');
 if(/\.(js|html|css)$/.test(p)){
  const s=await readFile(p,'utf8');assert(!/fonts\.googleapis|fonts\.gstatic|pairs-and-paths:|blockly:/.test(s),`Unexpected old namespace or remote font: ${p}`);
 }
}
const bytes=(await Promise.all(files.map(p=>stat(p)))).reduce((n,f)=>n+f.size,0);assert(bytes<5*1024*1024,'MVP size budget exceeded');
const digest=createHash('sha256');for(const p of files.sort()){digest.update(p.slice(root.pathname.length));digest.update(await readFile(p));}
console.log(JSON.stringify({result:'PASS',files:files.length,bytes,treeSha256:digest.digest('hex'),sdkPath:'/sdk.js is intentionally supplied by Yandex'},null,2));
