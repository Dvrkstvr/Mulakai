/**
 * Restoring a trashed song from Settings → Library Maintenance puts it back in the Library: BACK
 * re-reads the list, so the song shows without a reload.
 */
import { test, expect } from './fixtures';

test('a song restored in Settings shows in the Library after BACK', async ({ page, request }) => {
  const TITLE = `E2E Restore ${Date.now().toString(36)}`;
  expect((await request.post('/api/generate', { data: { title: TITLE, prompt: 'lofi piano' } })).status()).toBe(202);
  const songId = async () =>
    ((await (await request.get('/api/songs')).json()) as Array<{ id: string; title: string }>).find((s) => s.title === TITLE)?.id;
  await expect.poll(songId, { timeout: 30_000 }).toBeTruthy();
  expect((await request.patch(`/api/songs/${await songId()}/trash`, { data: {} })).ok()).toBe(true);

  const listed = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/songs' && r.request().method() === 'GET');
  await page.goto('/');
  await listed; // the Library has read its list, without the song
  const row = page.locator('.song-title', { hasText: TITLE });
  await expect(row).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('textbox').fill('Library Maintenance');
  await page.keyboard.press('Enter');
  await page.locator('.voice-list-row', { hasText: TITLE }).getByRole('button', { name: 'RESTORE' }).click();
  await expect(page.locator('.voice-list-row', { hasText: TITLE })).toHaveCount(0);

  await page.getByRole('button', { name: '← LIBRARY' }).click();
  await expect(row).toBeVisible();
});
