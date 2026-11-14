import { expect, it, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { createEmptyBoard } from '../src/engine';
import { findPieceById } from '../src/pieces';

it.each([false,true])('placement feedback keeps fill and contour without diagonal strokes (occupied=%s)',occupied=>{
 const board=createEmptyBoard().map(row=>[...row]);if(occupied)board[0]![0]='single';
 const scene=new WorkshopScene({gate:{paused:false},model:{boardState:board}} as unknown as SceneServices);
 const preview={clear:vi.fn(),fillStyle:vi.fn(),lineStyle:vi.fn(),fillRoundedRect:vi.fn(),strokeRoundedRect:vi.fn(),lineBetween:vi.fn()};
 for(const key of ['fillStyle','lineStyle','fillRoundedRect','strokeRoundedRect'] as const)preview[key].mockReturnValue(preview);
 Object.assign(scene,{
  preview,drag:{pointerId:1,slot:0,piece:findPieceById('single'),lift:0,x:0,y:0},
  cameras:{main:{getWorldPoint:(x:number,y:number)=>({x,y})}},
  ghost:{removeAll:vi.fn(),add:vi.fn(),setAlpha:vi.fn()},add:{graphics:vi.fn()},drawPiece:vi.fn(),
 });
 (scene as unknown as {move(p:{id:number;x:number;y:number}):void}).move({id:1,x:42,y:178});
 const color=occupied?0xa5423f:0x47735b;
 expect(preview.fillStyle).toHaveBeenCalledWith(color,.22);
 expect(preview.lineStyle).toHaveBeenCalledWith(2,color,1);
 expect(preview.fillRoundedRect).toHaveBeenCalledWith(21,157,42,42,3);
 expect(preview.strokeRoundedRect).toHaveBeenCalledWith(21,157,42,42,3);
 expect(preview.lineBetween).not.toHaveBeenCalled();
});

it('Phaser pointerup from native touchcancel restores the source without placing',()=>{
 const place=vi.fn(),figure={setVisible:vi.fn()},ghost={removeAll:vi.fn()},preview={clear:vi.fn()};
 const scene=new WorkshopScene({model:{place},campaign:{place}} as unknown as SceneServices);
 Object.assign(scene,{drag:{pointerId:1,slot:2},trayFigures:[undefined,undefined,figure],ghost,preview});
 (scene as unknown as {release(p:{id:number;wasCanceled:boolean}):void}).release({id:1,wasCanceled:true});
 expect(place).not.toHaveBeenCalled();expect(figure.setVisible).toHaveBeenCalledWith(true);
 expect(ghost.removeAll).toHaveBeenCalledWith(true);expect(preview.clear).toHaveBeenCalledOnce();
 scene.cancelDrag();expect(figure.setVisible).toHaveBeenCalledOnce();
});
