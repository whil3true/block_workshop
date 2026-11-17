import { type Page } from '@playwright/test';
import { seed, open } from './helpers';
import type { YandexSdk } from '../../src/platform/YandexSdkTypes';
declare global { interface Window { qaSdk: {
 ready:number; starts:number; stops:number; requests:number; rewardRequests:number; offset:number; activeOffset:number;
 emit:(event:string)=>void; fullscreen:NonNullable<Parameters<NonNullable<YandexSdk['adv']>['showFullscreenAdv']>[0]>['callbacks'];
 reward:Parameters<NonNullable<YandexSdk['adv']>['showRewardedVideo']>[0]['callbacks'];
} } }
export async function sdk(page: Page, startupPause = false) {
 await page.route('http://sdk.block.test/**', async route => {
  const url = new URL(route.request().url());
  const response = await route.fetch({url:'http://127.0.0.1:4180'+url.pathname, headers:{...route.request().headers(),host:'127.0.0.1:4180'}});
  await route.fulfill({response});
 });
 await page.addInitScript(startupPause => {
  const listeners = new Map<string,Set<()=>void>>();
  const qa: Window['qaSdk'] = window.qaSdk = { ready:0,starts:0,stops:0,requests:0,rewardRequests:0,offset:0,activeOffset:0,
   fullscreen:undefined, reward:{}, emit:(event:string)=>listeners.get(event)?.forEach(f=>f()) };
  const now=Date.now;Date.now=()=>now()+qa.offset;
  const activeNow=performance.now.bind(performance);Object.defineProperty(performance,'now',{configurable:true,value:()=>activeNow()+qa.activeOffset});
  const sdk = {
   environment:{i18n:{lang:'ru'}}, features:{LoadingAPI:{ready:()=>qa.ready++},GameplayAPI:{start:()=>qa.starts++,stop:()=>qa.stops++}},
   on:(event:string,handler:()=>void)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event)!.add(handler);if(startupPause&&event==='game_api_pause')handler();},
   off:(event:string,handler:()=>void)=>listeners.get(event)?.delete(handler),
   adv:{showFullscreenAdv:({callbacks}: {callbacks:Window['qaSdk']['fullscreen']})=>{qa.requests++;qa.fullscreen=callbacks;},
    showRewardedVideo:({callbacks}: {callbacks:Window['qaSdk']['reward']})=>{qa.rewardRequests++;qa.reward=callbacks;}},
  };
  Object.assign(window,{YaGames:{init:async()=>sdk}});
 },startupPause);
 await seed(page);await open(page,'http://sdk.block.test/',!startupPause);
}
