import { spawn } from 'node:child_process';
import { launch, openScore, dock, txt, waitPlanDone } from './lib.mjs';
const { browser, page } = await launch();
await openScore(page, 'Gertar', 0);
await page.locator('.section-strip').first().waitFor({ timeout: 60000 });
const chip = async () => (await page.locator('.dock-target').allInnerTexts()).join(' | ');
const clr = page.locator('button', { hasText: /WHOLE SCORE/ }).filter({ hasText: /[✕×x]/ });
if (await clr.count()) await clr.first().click();
const segs = page.locator('.section-strip button');
console.log('segments', await segs.allInnerTexts());
await segs.nth(5).click();   // BRIDGE
await page.waitForTimeout(400);
console.log('chip after pick:', await chip());
// the song changes underneath: a REPEAT of the first chorus, planned and rendered through the server
await new Promise((res) => {
  const p = spawn('node', ['../m2_driver.mjs', 't7_repeat_gertar', 'a69541f2-1904-4ac6-bc3e-56afaa94e89f', 'repeat the first chorus', 'render'], { cwd: process.cwd(), stdio: 'inherit' });
  p.on('exit', res);
});
await page.waitForTimeout(4000);
console.log('chip after the render landed (page not reloaded):', await chip());
console.log('versions:', (await page.locator('text=/score edit/').allInnerTexts()).join(' | '));
await page.screenshot({ path: '../shots/f032-after-repeat-render.png' });
await page.getByPlaceholder(/Describe the change/).fill('make this jazzier');
await page.getByRole('button', { name: /^PLAN$/ }).click();
await waitPlanDone(page);
console.log('dock after PLAN with the old pick:', await txt(dock(page)));
await page.screenshot({ path: '../shots/f032-stale-row.png' });
const use = page.getByRole('button', { name: /USE BARS/ });
console.log('USE BARS buttons:', await use.count());
if (await use.count()) {
  await use.first().click(); await page.waitForTimeout(600);
  console.log('after USE BARS chip:', await chip());
  console.log('dock after USE BARS:', await txt(dock(page)));
  await page.screenshot({ path: '../shots/f032-after-use-bars.png' });
}
await browser.close();
