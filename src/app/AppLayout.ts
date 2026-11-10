import { computeLayout, type Layout, type LayoutInput } from '../layout';
/** DOM shell adapter: reserve space for settings/actions and all three tray slots. */
export function computeAppLayout(input: LayoutInput): Layout {
 const base = computeLayout(input);
 const width = input.viewportWidth - Math.max(input.screenPad,input.insetLeft) - Math.max(input.screenPad,input.insetRight);
 const compact = base.orientation === 'landscape' && input.viewportHeight <= 600;
 const height = input.viewportHeight - Math.max(input.screenPad,input.insetTop) - Math.max(input.screenPad,input.insetBottom);
 let result = base;
 for (let cell = base.cellSize; cell >= input.minCell; cell--) {
  const boardSize = 2*input.boardPad + 10*cell + 9*input.gap;
  const trayCellSize = Math.max(1,Math.floor(cell*input.trayScale));
  const traySlotSize = 5*trayCellSize + 4*input.gap;
  const h = base.orientation === 'portrait'
   ? input.hudHeight + boardSize + traySlotSize + 2*input.screenPad + 2*input.boardPad
   : Math.max(boardSize, input.hudHeight + (compact ? 1 : 3)*traySlotSize + 3*input.screenPad);
  const w = base.orientation === 'portrait' ? boardSize : boardSize + Math.max(input.hudWidth,compact ? 3*traySlotSize + 2*input.boardPad + 2*input.gap : traySlotSize) + input.screenPad;
  // Keep a finger's lifted bottom-row drop point within the viewport too.
  const bottomFinger = (height-h)/2 + (base.orientation === 'portrait' ? input.hudHeight+input.screenPad : (h-boardSize)/2) + boardSize - input.boardPad - cell/2 + 32;
  const fits = h <= height && w <= width && bottomFinger <= height;
  result = { orientation:base.orientation,cellSize:cell,boardSize,trayCellSize,traySlotSize,overflow:!fits };
  if(fits) return result;
 }
 return result;
}
