import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { test, expect } from './fixtures';
import { click, drag, frames, open, seed, snapshot } from './helpers';

test('raster surfaces render in Canvas fallback and frame times stay bounded with real art',async({page},info)=>{
 await seed(page,{locale:'en'});await open(page);
 const panel=await page.evaluate(()=>{
  const canvas=document.querySelector('canvas')!, context=canvas.getContext('2d');
  if(!context)return null;
  const scale=canvas.width/480;
  return context.getImageData(Math.round(60*scale),Math.round(canvas.height/2+(470-400)*scale),1,1).data[3];
 });
 const hasArt=await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundImage.includes('paper.webp'));
 if(hasArt && panel!==null)expect(panel,'Raster menu panel must be visible in Canvas renderer').toBeGreaterThan(220);
 await click(page,240,412);await click(page,240,278);await frames(page);
 const timings=await page.evaluate(()=>new Promise<{p50:number;p95:number;max:number;samples:number}>(resolve=>{
  const samples:number[]=[];let previous=performance.now();
  function tick(now:number):void {
   samples.push(now-previous);previous=now;
   if(samples.length<120){requestAnimationFrame(tick);return;}
   const ordered=samples.sort((a,b)=>a-b);
   resolve({p50:ordered[60]!,p95:ordered[114]!,max:ordered[119]!,samples:120});
  }
  requestAnimationFrame(tick);
 }));
 const path=info.outputPath('raster-frame-times.json');await writeFile(path,JSON.stringify({...timings,renderer:panel===null?'WebGL':'Canvas',raster:hasArt},null,2));
 await info.attach('raster-frame-times.json',{path,contentType:'application/json'});
 // A one-second freeze is a failure, not a reason to increase the suite timeout.
 expect(timings.max).toBeLessThan(1000);await drag(page,0,8,4);
 await click(page,49,45);await click(page,49,45);await click(page,240,580);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
});

test('relative build resolves fonts, art and full-viewport paper beneath a Pages subpath',async({page},info)=>{
 const prefix='/block_workshop/', root=join(process.cwd(),'dist');
 const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url??'/', 'http://localhost').pathname;
  if(!path.startsWith(prefix)){res.writeHead(404);res.end();return;}
  const relative=path.slice(prefix.length)||'index.html';
  try {
   const data=await readFile(join(root,relative));res.writeHead(200,{'Content-Type':mime[extname(relative)]??'application/octet-stream'});res.end(data);
  } catch {res.writeHead(404);res.end();}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address || typeof address==='string')throw Error('No local test port');
 const origin=`http://127.0.0.1:${address.port}`;
 try {
  const failures:string[]=[];page.on('response',r=>{if(r.status()>=400 && r.request().resourceType()!=='other')failures.push(r.url());});
  await seed(page,{locale:'en'});await open(page,`${origin}${prefix}`);
  const paper=await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundImage);
  if(process.env['EXPECT_COZY_ART']==='1')expect(paper).toContain(`${origin}${prefix}assets/cozy-mosaic/paper.webp`);
  await page.setViewportSize({width:1000,height:600});await frames(page);await page.screenshot({path:info.outputPath('pages-prefix.png')});
  await click(page,240,412);await click(page,240,278);await drag(page,0,8,4);expect(failures).toEqual([]);
 } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
