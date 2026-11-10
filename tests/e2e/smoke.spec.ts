import { test, expect } from '@playwright/test';
test('production placement, snapshot reload and deliberate restart',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('qa-seeded'))return;
  sessionStorage.setItem('qa-seeded','true');
  localStorage.setItem('block-workshop:ui-locale','en');
  localStorage.setItem('block-workshop:lastGame',JSON.stringify({app:'block-workshop',schemaVersion:1,rulesVersion:1,state:{board:Array.from({length:10},()=>Array(10).fill(null)),trayIds:['single','single','single'],score:0,streak:0,rewardUsed:false}}));
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Play',exact:true}).click();
 const source=await page.locator('.tray__slot').first().boundingBox();const target=await page.locator('.board__cell[data-row="0"][data-col="0"]').boundingBox();
 if(!source||!target)throw Error('Missing drag surface');
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up();
 await expect(page.locator('.hud__pair--current .hud__score')).toHaveText('1');await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('.hud__pair--current .hud__score')).toHaveText('1');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'RU',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await page.getByRole('button',{name:'Вернуться в игру',exact:true}).click();await page.getByRole('button',{name:'Новая игра',exact:true}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await expect(page.locator('.hud__pair--current .hud__score')).toHaveText('0');expect(errors).toEqual([]);
});
