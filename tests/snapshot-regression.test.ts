import { describe,it,expect,vi } from 'vitest';
import { createEmptyBoard, hasAnyLegalPlacement } from '../src/engine';
import { createModel as createGame } from '../src/model';
import { loadLastGame, saveLastGame, SNAPSHOT_HEADER } from '../src/storage';
const valid=()=>({board:createEmptyBoard(),trayIds:['single','penta-h',null],score:540,streak:2,rewardUsed:false});
const store=(state:unknown,header:object=SNAPSHOT_HEADER)=>localStorage.setItem('block-workshop:lastGame',JSON.stringify({...header,state}));
describe('versioned isolated storage',()=>{
 it('the very first tray also survives reload before any move',()=>{const first=createGame();const ids=first.trayPieces.map(p=>p?.id);const second=createGame();expect(second.trayPieces.map(p=>p?.id)).toEqual(ids);expect(second.score).toBe(0);});
 it('restores board, tray, score, streak and once-per-session reward flag',()=>{
  const state=valid();state.rewardUsed=true;saveLastGame(state);const game=createGame();expect(game.score).toBe(540);expect(game.streak).toBe(2);expect(game.trayPieces.map(p=>p?.id??null)).toEqual(state.trayIds);expect(game.boardState).toEqual(state.board);expect(game.rewardUsed).toBe(true);
 });
 it.each([-1,NaN,Infinity,-Infinity,1.5,Number.MAX_SAFE_INTEGER+1])('rejects bad score/streak %s',value=>{
  store({...valid(),score:value});expect(loadLastGame()).toBeNull();store({...valid(),streak:value});expect(loadLastGame()).toBeNull();
 });
 it.each([{app:'other',schemaVersion:1,rulesVersion:1},{app:'block-workshop',schemaVersion:2,rulesVersion:1},{app:'block-workshop',schemaVersion:1,rulesVersion:2},{}])('rejects incompatible header %j',header=>{store(valid(),header);expect(loadLastGame()).toBeNull();});
 it.each([['unknown','single',null],[null,null,null],['single'],[1,'single',null]])('rejects invalid tray %j',(...tray)=>{store({...valid(),trayIds:tray});expect(loadLastGame()).toBeNull();});
 it('rejects malformed board dimensions and family',()=>{store({...valid(),board:[[]]});expect(loadLastGame()).toBeNull();const board=createEmptyBoard().map(r=>[...r]);board[0]![0]='invalid' as never;store({...valid(),board});expect(loadLastGame()).toBeNull();});
 it('storage disabled uses safe defaults and does not throw',()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied');});expect(loadLastGame()).toBeNull();vi.restoreAllMocks();});
 it('restart does not erase Cozy or upstream keys',()=>{localStorage.setItem('pairs-and-paths:progress','keep');localStorage.setItem('blockly:lastGame','keep');createGame().newGame();expect(localStorage.getItem('pairs-and-paths:progress')).toBe('keep');expect(localStorage.getItem('blockly:lastGame')).toBe('keep');});
});
describe('guarded game actions and rewarded tray',()=>{
 it('place and public newGame are ignored while paused',()=>{let blocked=true;const game=createGame({rng:()=>0,canInteract:()=>!blocked});game.place(0,0,0);expect(game.score).toBe(0);const session=game.session;game.newGame();expect(game.session).toBe(session);blocked=false;game.place(0,0,0);expect(game.score).toBeGreaterThan(0);});
 it('prepared tray fits, consumes reward once, survives reload',()=>{const game=createGame({rng:()=>0});const offer=game.prepareReward()!;expect(hasAnyLegalPlacement(game.boardState,offer.pieces)).toBe(true);expect(game.commitReward(offer)).toBe(true);expect(game.commitReward(offer)).toBe(false);expect(game.prepareReward()).toBeNull();expect(createGame().rewardUsed).toBe(true);});
 it('late reward cannot change a restarted session',()=>{const game=createGame();const offer=game.prepareReward()!;game.commitRestart();const tray=game.trayPieces;expect(game.commitReward(offer)).toBe(false);expect(game.trayPieces).toEqual(tray);expect(game.rewardUsed).toBe(false);});
 it('late reward cannot change a board that has advanced',()=>{const game=createGame({rng:()=>0});const offer=game.prepareReward()!;game.place(0,0,0);expect(game.commitReward(offer)).toBe(false);});
 it('availability checks do not draw random shapes',()=>{const rng=vi.fn(()=>0);const game=createGame({rng});rng.mockClear();void game.canReward;void game.canReward;expect(rng).not.toHaveBeenCalled();});
 it('no useful tray is offered on a completely full board',()=>{const board=createEmptyBoard().map(r=>r.map(()=> 'single' as const));const game=createGame({initialBoard:board});expect(game.gameOver).toBe(true);expect(game.canReward).toBe(false);expect(game.prepareReward()).toBeNull();});
});
