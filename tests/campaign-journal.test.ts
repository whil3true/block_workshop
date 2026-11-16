import { expect, it, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
vi.mock('../src/phaser/CozyAssets',()=>({paperSurface:vi.fn()}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { CAMPAIGN_CATALOG } from '../src/campaign/CampaignCatalog';
import { words } from '../src/app/Localization';

type Zone = {key:string;x:number;y:number;w:number;h:number;action:()=>void;disabled:boolean};
function journal(completed:readonly string[]=[],locale:'ru'|'en'='ru'){
 const zones:Zone[]=[],labels:{x:number;y:number;value:string;role:string;width:number}[]=[];
 const scene=new WorkshopScene({campaign:{completed},locale:{locale,t:(key:keyof typeof words.en)=>words[locale][key]}} as unknown as SceneServices);
 Object.assign(scene,{
  chapter:1,journalPage:0,root:{add:vi.fn()},add:{container:()=>({setAlpha:vi.fn()})},
  header:vi.fn(),surface:vi.fn(),icon:vi.fn(),button:vi.fn(),invalidate:vi.fn(),
  text:(x:number,y:number,value:string,role:string,width:number)=>{
   labels.push({x,y,value,role,width});const text={setOrigin:()=>text,setName:()=>text};return text;
  },
  zone:(key:string,x:number,y:number,w:number,h:number,action:()=>void,disabled=false)=>zones.push({key,x,y,w,h,action,disabled}),
 });
 const draw=()=>{zones.length=0;labels.length=0;(scene as unknown as {drawJournal():void}).drawJournal();};
 const state=scene as unknown as {chapter:number;journalPage:number;startOrder(id:string):void};
 return {scene,zones,labels,draw,state};
}
it('centers equal chapter surfaces and hit areas at symmetric x coordinates',()=>{
 const j=journal();j.draw();const tabs=j.zones.filter(z=>z.key.startsWith('chapter-'));
 expect(tabs.map(z=>[z.x,z.y,z.w,z.h])).toEqual([[86,174,120,50],[240,174,120,50],[394,174,120,50]]);
 expect(j.labels.filter(l=>l.y===174).map(l=>l.x)).toEqual([86,240,394]);
});
it.each(['ru','en'] as const)('all 18 %s cards have one full-width column and no redundant completed line',locale=>{
 const j=journal(CAMPAIGN_CATALOG.map(o=>o.id),locale);
 for(let chapter=1;chapter<=3;chapter++)for(let page=0;page<2;page++){
  j.state.chapter=chapter;j.state.journalPage=page;j.draw();
  const cards=j.zones.filter(z=>z.key.startsWith('order-'));
  expect(cards.map(z=>[z.x,z.y,z.w,z.h,z.disabled])).toEqual([[240,278,416,120,false],[240,413,416,120,false],[240,548,416,120,false]]);
  const orders=CAMPAIGN_CATALOG.slice((chapter-1)*6+page*3,(chapter-1)*6+page*3+3);
  for(const [i,o] of orders.entries()){
   const title=j.labels.find(l=>l.value===o.title[locale])!;
   expect(title).toMatchObject({x:122,y:261+i*135,role:'body',width:0});
   const total=o.fragments.flatMap(f=>f.cells).length;
   expect(j.labels).toContainEqual(expect.objectContaining({value:`${words[locale].removed} ${total}/${total}`,y:300+i*135}));
  }
  expect(j.labels.filter(l=>l.value===words[locale].completed)).toHaveLength(0);
 }
});
it('paginates without crossing a chapter; a changed chapter resets page and locks cannot launch',()=>{
 const j=journal();j.draw();
 expect(j.zones.find(z=>z.key==='journal-prev')?.disabled).toBe(true);
 expect(j.zones.find(z=>z.key==='order-1')?.disabled).toBe(false);
 expect(j.zones.find(z=>z.key==='order-2')?.disabled).toBe(true);
 j.zones.find(z=>z.key==='journal-next')!.action();j.draw();
 expect(j.state.journalPage).toBe(1);expect(j.zones.find(z=>z.key==='journal-next')?.disabled).toBe(true);
 expect(j.zones.filter(z=>z.key.startsWith('order-')).map(z=>z.key)).toEqual(['order-4','order-5','order-6']);
 j.zones.find(z=>z.key==='chapter-2')!.action();j.draw();expect(j.state.journalPage).toBe(0);
 expect(j.labels.some(l=>l.value===CAMPAIGN_CATALOG[6]!.title.ru)).toBe(true);
});
it('starting any order remembers its chapter/page for all return paths',()=>{
 const j=journal(CAMPAIGN_CATALOG.map(o=>o.id));
 Object.assign(j.scene,{services:{campaign:{start:()=>true},audio:{unlock:vi.fn()}},commitNavigation:vi.fn()});
 for(const [index,o] of CAMPAIGN_CATALOG.entries()){
  j.state.startOrder(o.id);expect(j.state.chapter).toBe(o.chapter);expect(j.state.journalPage).toBe(Math.floor(index%6/3));
 }
});
