import { launch, openScore, dock, txt, waitPlanDone } from './lib.mjs';
const { browser, page } = await launch(1366, 900);
await openScore(page, 'Purple Shinings', 0);
const req = page.getByPlaceholder(/Describe the change/);
for (let k = 1; k <= 4; k++) {
  await req.fill('jazz chords in the chorus'); await page.getByRole('button', { name: /^PLAN$/ }).click(); await waitPlanDone(page, 240000);
  if (/PLAN · 1 CHANGE/.test(await txt(dock(page)))) break;
}
console.log('PLAN 1:', (await txt(dock(page))).slice(0, 500));
await req.fill('also slow it down to 80 BPM');
await page.getByRole('button', { name: /^REVISE$/ }).click(); await waitPlanDone(page);
console.log('after REVISE:', (await txt(dock(page))).slice(0, 900));
console.log('APPLY enabled:', await page.getByRole('button', { name: /APPLY & RENDER/ }).isEnabled());
await page.screenshot({ path: '../shots/ui-revise-1op-drops.png', fullPage: true });
await browser.close();
