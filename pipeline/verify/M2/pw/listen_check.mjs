import { launch } from './lib.mjs';
const { browser, page } = await launch(1100, 900);
const errs = []; page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('file:///E:/repos/Mulakai/pipeline/verify/M2/listen/index.html');
await page.waitForTimeout(1500);
const r = await page.evaluate(() => ({
  a_to_b_bar31: mapBar(PAIRS[1], 'A', 30.2), b_copy_bar35_to_A: mapBar(PAIRS[1], 'B', 34.2), b_bar20_to_A: mapBar(PAIRS[1], 'B', 19.5), b_bar45_to_A: mapBar(PAIRS[1], 'B', 44.0),
  g_a_bar23_to_B: mapBar(PAIRS[3], 'A', 22.0), g_b_copy_bar25_to_A: mapBar(PAIRS[3], 'B', 24.0),
  durations: [...document.querySelectorAll('audio')].map((a) => [a.id, a.duration]),
}));
console.log(JSON.stringify(r)); console.log('errors:', errs);
await page.screenshot({ path: '../shots/listen-page.png', fullPage: false });
await browser.close();
