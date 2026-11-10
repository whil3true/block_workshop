import { describe,it,expect } from 'vitest';
import { computeAppLayout } from '../src/app/AppLayout';
describe('shell reserves HUD and three figures',()=>{
 it.each([[393,852],[360,800],[820,1180],[1363,936],[852,393],[1180,820]])('fits %sx%s with lifted touch bottom row', (w,h)=>{
  const input={viewportWidth:w,viewportHeight:h,insetTop:0,insetRight:0,insetBottom:0,insetLeft:0,screenPad:12,boardPad:6,gap:2,minCell:24,hudWidth:260,hudHeight:h<500?220:280,trayScale:.5};
  const l=computeAppLayout(input);expect(l.overflow).toBe(false);expect(l.cellSize).toBeGreaterThanOrEqual(24);
  if(l.orientation==='landscape')expect(Math.max(l.boardSize,input.hudHeight+(h<=600?1:3)*l.traySlotSize+36)).toBeLessThanOrEqual(h-24);
  else expect(input.hudHeight+l.boardSize+l.traySlotSize+36).toBeLessThanOrEqual(h-24);
 });
 it('tiny viewport has an explicit overflow fallback instead of hiding cells',()=>{const l=computeAppLayout({viewportWidth:240,viewportHeight:320,insetTop:0,insetRight:0,insetBottom:0,insetLeft:0,screenPad:12,boardPad:6,gap:2,minCell:24,hudWidth:260,hudHeight:280,trayScale:.5});expect(l.overflow).toBe(true);expect(l.cellSize).toBe(24);});
});
