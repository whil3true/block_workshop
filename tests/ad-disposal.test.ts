import { it,expect,vi } from 'vitest';
import { AdFlow } from '../src/app/AdFlow';
import { PauseGate } from '../src/app/PauseGate';
import { WebPlatform } from '../src/platform/WebPlatform';
it.each(['restart','reward'] as const)('late %s callback after exit does not mutate a later app',async mode=>{
 let finish!:(value:boolean)=>void;const request=new Promise<boolean>(r=>{finish=r;});const restart=vi.fn(),applyReward=vi.fn(()=>true);
 const platform=new WebPlatform();platform.showRewarded=()=>request;
 const flow=new AdFlow({gate:new PauseGate(),platform,interstitial:{tryShow:()=>request},restart,applyReward,cover:()=>{},afterFrame:async()=>{}});
 const p=mode==='restart'?flow.restart():flow.reward({session:1,revision:0});flow.dispose();finish(true);await p;flow.flushReward();expect(restart).not.toHaveBeenCalled();expect(applyReward).not.toHaveBeenCalled();
});
