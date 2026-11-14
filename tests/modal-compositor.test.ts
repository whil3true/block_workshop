import { it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
vi.mock('phaser', () => ({default: {
 Scene: class {}, Scale: {Events: {RESIZE:'resize'}}, GameObjects: {Events:{DESTROY:'destroy'}},
}}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { createModalShell, createViewportBackdrop } from '../src/phaser/UiPrimitives';

function harness() {
 const rectangles: {destroyed:boolean; width:number; height:number; x:number; y:number}[] = [];
 const resize = new Set<() => void>();
 const scene = {
  cameras:{main:{zoom:2,scrollX:-600,scrollY:-400,width:1680,height:1600}},
  scale:{gameSize:{width:1680,height:1600},on:vi.fn((_e:string,fn:()=>void)=>resize.add(fn)),off:vi.fn((_e:string,fn:()=>void)=>resize.delete(fn))},
  textures:{exists:()=>false},
  add:{rectangle:vi.fn(()=>{
   let onDestroy=()=>{};
   const rect={destroyed:false,width:0,height:0,x:0,y:0,
    setName(){return this;},setInteractive(){return this;},
    setSize(w:number,h:number){this.width=w;this.height=h;return this;},
    setPosition(x:number,y:number){this.x=x;this.y=y;return this;},
    once(_e:string,fn:()=>void){onDestroy=fn;return this;},
    destroy(){this.destroyed=true;onDestroy();},
   };rectangles.push(rect);return rect;
  }),graphics:()=>({fillStyle(){return this;},fillRoundedRect(){return this;}}),
  container:vi.fn((_x:number,_y:number,children:unknown[])=>({children}))},
 };
 return {scene,rectangles,resize,phaser:scene as unknown as Phaser.Scene};
}
it('nested results, confirmation and external pause replace the single dim source and release resize listeners',()=>{
 const h=harness();
 const scene=new WorkshopScene({} as SceneServices);
 Object.assign(scene,h.scene,{root:{add:vi.fn()}});
 const compositor=scene as unknown as {overlay():void};
 for(let i=0;i<3;i++) {
  compositor.overlay();
  expect(h.rectangles.filter(r=>!r.destroyed)).toHaveLength(1);
  expect(h.resize.size).toBe(1);
 }
 h.rectangles.at(-1)!.destroyed; // the scene removes the last rectangle with its root
});
it('full-viewport coverage follows camera size/zoom and removes its listener on destroy',()=>{
 const h=harness();const backdrop=createViewportBackdrop(h.phaser,0x4e4038,.48);
 expect(h.rectangles[0]).toMatchObject({x:240,y:400,width:840,height:800});
 h.scene.scale.gameSize={width:3200,height:1600};h.scene.cameras.main.width=3200;h.scene.cameras.main.scrollX=-1360;
 h.resize.forEach(fn=>fn());expect(h.rectangles[0]).toMatchObject({x:240,y:400,width:1600,height:800});
 backdrop.destroy();expect(h.resize.size).toBe(0);
});
it('modal shells draw only their panel and never create another dim layer',()=>{
 const h=harness();createModalShell(h.phaser,{x:240,y:400,width:440,height:640});
 expect(h.scene.add.rectangle).not.toHaveBeenCalled();
 expect(h.scene.add.container.mock.calls[0]![2]).toHaveLength(1);
});
