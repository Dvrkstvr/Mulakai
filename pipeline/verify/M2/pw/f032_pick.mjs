import { launch, openScore, dock, txt, waitPlanDone } from './lib.mjs';
const { browser, page } = await launch();
const log = [];
await openScore(page, 'Gertar', 0);
await page.locator('.section-strip').first().waitFor({ timeout: 60000 });
const segs = page.locator('.section-strip button, .section-strip [role=button], .section-seg');
console.log('segments:', await segs.allInnerTexts());
const chip = page.locator('text=BASE ·').first();
const chipText = async () => (await page.locator('.dock-target').allInnerTexts()).join(' | ');
console.log('chip before:', await chipText());
await segs.nth(4).click();   // second CHORUS
await page.waitForTimeout(500);
console.log('chip after pick:', await chipText());
await page.screenshot({ path: '../shots/f032-pick-chorus2.png' });
await page.getByPlaceholder(/Describe the change/).fill('make this jazzier');
await page.getByRole('button', { name: /^PLAN$/ }).click();
// wait for plan to land
await waitPlanDone(page);

console.log('dock after plan:', await txt(dock(page)));
console.log('chip after plan:', await chipText());
await page.screenshot({ path: '../shots/f032-plan-this.png' });
await browser.close();
