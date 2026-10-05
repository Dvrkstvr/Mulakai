import { launch, openScore, dock, txt } from './lib.mjs';
const [title, secs = '60'] = process.argv.slice(2);
const { browser, page } = await launch();
await openScore(page, title, 0);
for (let i = 0; i < Number(secs) / 5; i++) {
  const n = await page.locator('.section-strip, [class*=section-strip]').count();
  const jobs = await page.evaluate(async () => (await (await fetch('/api/generate/active')).json()));
  console.log(i * 5, 'strips', n, 'active', JSON.stringify(jobs).slice(0, 160));
  if (n) break;
  await page.waitForTimeout(5000);
}
console.log('dock:', await txt(dock(page)));
await page.screenshot({ path: `../shots/timing-${title}.png` });
await browser.close();
