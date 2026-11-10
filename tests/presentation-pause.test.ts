import { it,expect,vi } from 'vitest';
import { createGame } from '../src/game';
import { createEmptyBoard } from '../src/engine';
import { saveLastGame } from '../src/storage';
it('combo countdown preserves remaining time across a long pause',()=>{
 vi.useFakeTimers();
 try {
  const board=createEmptyBoard().map(r=>[...r]);
  for(let c=1;c<10;c++)board[0]![c]='single';
  for(let r=1;r<10;r++)board[r]![0]='single';
  board[5]![5]='single'; // Avoid the higher-priority perfect-clear callout.
  saveLastGame({board,trayIds:['single','single','single'],score:0,streak:1});
  const game=createGame();const root=document.createElement('div');game.mount(root);game.place(0,0,0);
  const combo=root.querySelector<HTMLElement>('.combo-callout')!;expect(combo.dataset['visible']).toBe('true');
  vi.advanceTimersByTime(200);game.setPresentationPaused(true);vi.advanceTimersByTime(20000);expect(combo.dataset['visible']).toBe('true');
  game.setPresentationPaused(false);vi.advanceTimersByTime(699);expect(combo.dataset['visible']).toBe('true');vi.advanceTimersByTime(1);expect(combo.dataset['visible']).toBe('false');
 }finally{vi.useRealTimers();}
});
