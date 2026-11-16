import { expect, it, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
vi.mock('../src/phaser/CozyAssets',()=>({paperSurface:vi.fn()}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { CAMPAIGN_CATALOG, CHAPTERS, displayChapterForOrder } from '../src/campaign/CampaignCatalog';
import { words } from '../src/app/Localization';

type Zone = {key:string;x:number;y:number;w:number;h:number;action:()=>void;disabled:boolean};
function journal(completed:readonly string[]=[],locale:'ru'|'en'='ru'){
 const zones:Zone[]=[],labels:{x:number;y:number;value:string;role:string;width:number}[]=[];
 const scene=new WorkshopScene({campaign:{completed},locale:{locale,t:(key:keyof typeof words.en)=>words[locale][key]}} as unknown as SceneServices);
 Object.assign(scene,{
  chapter:1,root:{add:vi.fn()},add:{container:()=>({setAlpha:vi.fn()})},
  header:vi.fn(),surface:vi.fn(),icon:vi.fn(),button:vi.fn(),invalidate:vi.fn(),
  text:(x:number,y:number,value:string,role:string,width:number)=>{
   labels.push({x,y,value,role,width});const text={setOrigin:()=>text,setName:()=>text};return text;
  },
  zone:(key:string,x:number,y:number,w:number,h:number,action:()=>void,disabled=false)=>zones.push({key,x,y,w,h,action,disabled}),
 });
 const draw=()=>{zones.length=0;labels.length=0;(scene as unknown as {drawJournal():void}).drawJournal();};
 const state=scene as unknown as {chapter:number;startOrder(id:string):void};
 return {scene,zones,labels,draw,state};
}
it('centers equal chapter surfaces and hit areas at symmetric x coordinates',()=>{
 const j=journal();j.draw();const tabs=j.zones.filter(z=>z.key.startsWith('chapter-'));
 expect(tabs.map(z=>[z.x,z.y,z.w,z.h])).toEqual(Array.from({length:6},(_,i)=>[60+i*72,174,66,66]));
 expect(j.labels.filter(l=>l.y===174).map(l=>l.x)).toEqual([60,132,204,276,348,420]);
});
it.each(['ru','en'] as const)('all 18 %s cards have one full-width column and no redundant completed line',locale=>{
 const j=journal(CAMPAIGN_CATALOG.map(o=>o.id),locale);
 for(let chapter=1;chapter<=6;chapter++){
  j.state.chapter=chapter;j.draw();
  const cards=j.zones.filter(z=>z.key.startsWith('order-'));
  expect(cards.map(z=>[z.x,z.y,z.w,z.h,z.disabled])).toEqual([[240,297,416,132,false],[240,449,416,132,false],[240,601,416,132,false]]);
  const orders=CAMPAIGN_CATALOG.slice((chapter-1)*3,(chapter-1)*3+3);
  for(const [i,o] of orders.entries()){
   const title=j.labels.find(l=>l.value===o.title[locale])!;
   expect(title).toMatchObject({x:122,y:280+i*152,role:'body',width:0});
   const total=o.fragments.flatMap(f=>f.cells).length;
   expect(j.labels).toContainEqual(expect.objectContaining({value:`${words[locale].removed} ${total}/${total}`,y:319+i*152}));
  }
  expect(j.labels.filter(l=>l.value===words[locale].completed)).toHaveLength(0);
 }
});
it('has only chapter navigation and Back, without a header arrow or pagination',()=>{
 const j=journal();const navigate=vi.fn();Object.assign(j.scene,{navigate});j.draw();
 expect(j.zones.map(z=>z.key)).toEqual([...CHAPTERS.map(c=>`chapter-${c.number}`),'order-1','order-2','order-3']);
 expect(j.zones.find(z=>z.key==='order-1')?.disabled).toBe(false);
 expect(j.zones.find(z=>z.key==='order-2')?.disabled).toBe(true);
 expect(j.scene['header']).not.toHaveBeenCalled();
 const button=vi.mocked(j.scene['button']);
 expect(button).toHaveBeenCalledWith('journal-back','back',240,756,expect.any(Function),360,false,true);
 button.mock.calls[0]![4]();expect(navigate).toHaveBeenCalledTimes(1);expect(navigate).toHaveBeenCalledWith('menu');
 j.zones.find(z=>z.key==='chapter-2')!.action();j.draw();
 expect(j.state.chapter).toBe(2);expect(j.labels.some(l=>l.value===CAMPAIGN_CATALOG[3]!.title.ru)).toBe(true);
});
it('starting any order remembers its display chapter for all return paths',()=>{
 const j=journal(CAMPAIGN_CATALOG.map(o=>o.id));
 Object.assign(j.scene,{services:{campaign:{start:()=>true},audio:{unlock:vi.fn()}},commitNavigation:vi.fn()});
 for(const o of CAMPAIGN_CATALOG){
  j.state.startOrder(o.id);expect(j.state.chapter).toBe(displayChapterForOrder(o.id));
 }
});
