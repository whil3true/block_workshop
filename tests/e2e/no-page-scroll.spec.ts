import { test, expect } from '@playwright/test';

test('the page cannot pan when a dragged piece crosses the viewport edge',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.goto('/');
 await page.locator('.welcome [data-word="play"]').click();
 const board=page.locator('.board');
 const initial=await board.boundingBox();
 const slot=await page.locator('.tray__slot').first().boundingBox();
 expect(initial).not.toBeNull();expect(slot).not.toBeNull();
 if(!initial||!slot)return;
 await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);
 await page.mouse.down();
 await page.mouse.move(470,900,{steps:6});
 await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);
 await page.mouse.up();
 await page.evaluate(()=>{window.scrollTo(200,200);document.body.scrollTo(200,200);});
 const pos=await board.boundingBox();
 const scroll=await page.evaluate(()=>({x:window.scrollX,y:window.scrollY}));
 expect(scroll).toEqual({x:0,y:0});
 expect(pos?.x).toBeCloseTo(initial.x,0);
 expect(pos?.y).toBeCloseTo(initial.y,0);
});

test('menu Settings and return-to-menu preserve session',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.goto('/');
 await page.locator('.welcome [data-word="settings"]').click();
 await expect(page.locator('.modal input[type="range"]')).toHaveCount(2);
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.locator('.modal [data-word="close"]').click();
 await page.locator('.welcome [data-word="play"]').click();
 const score=await page.locator('.hud__pair--current .hud__score').textContent();
 await page.locator('.appbar [data-word="menu"]').click();
 await expect(page.locator('.welcome')).toBeVisible();
 await page.locator('.welcome [data-word="play"]').click();
 await expect(page.locator('.hud__pair--current .hud__score')).toHaveText(score??'0');
 await expect(page.locator('.hud__mute')).toHaveCount(0);
});
