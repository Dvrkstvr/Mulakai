import { chromium } from 'file:///E:/repos/Mulakai/.claude/worktrees/agent-a15895f05108fb2b4/e2e/node_modules/playwright-core/index.mjs';
export const BASE = 'http://127.0.0.1:5190';
export async function launch(w = 1366, h = 768) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  return { browser, page };
}
/** Opens the Editor on the song row whose title is `title` (nth match among rows, default first) and the SCORE tab. */
export async function openScore(page, title, nth = 0) {
  await page.goto(BASE);
  const rows = page.locator('.row-main', { has: page.locator('.song-title', { hasText: new RegExp(`^${title}$`) }) });
  await rows.nth(nth).waitFor();
  await rows.nth(nth).locator('xpath=..').getByRole('button', { name: /EDIT/ }).first().click();
  await page.getByRole('tab', { name: /^SCORE/ }).click();
  await page.waitForTimeout(800);
}
export const dock = (page) => page.getByRole('tabpanel', { name: 'SCORE' });
export const txt = async (loc) => (await loc.innerText()).replace(/\n+/g, ' / ');
export async function waitPlanDone(page, ms = 120000) {
  await page.waitForTimeout(800);
  await page.waitForFunction(() => { const p = [...document.querySelectorAll('[role=tabpanel]')].find((x) => x.getAttribute('aria-label') === 'SCORE'); return p && !/PLANNING|CANCELLING|REVISING/i.test(p.innerText); }, null, { timeout: ms });
  await page.waitForTimeout(700);
}
