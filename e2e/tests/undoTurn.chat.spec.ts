/**
 * UNDO TURN and the reload-proof marks (F-059, D-220, D-221; chat-converge.html 5a, 5b), through the real client and
 * the `score` project's server against the fake Ollama: a recipe fills the draft → ASSISTANT marks with the old value
 * → a hand edit of STYLE reads YOURS → a reload keeps both → UNDO TURN restores the others and keeps the hand edit,
 * naming why → a reload shows the same after-line. Runs in `score` (after chat.spec.ts, on a fresh draft thread).
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { sp5Turn } from '../fake-score/chatReplies';
import { draftThread, openChat, scriptChat, sendMessage } from './chatFakes';

test.describe.configure({ mode: 'serial' });

const RECIPE = sp5Turn('RC05.t1');
const TITLE = String((RECIPE.reply.recipe as { title: string }).title); // "Abschied"
const MINE = 'dark piano ballad, my words';

const field = (page: Page, label: string) => page.locator('.chat-fd').filter({ has: page.locator('.chat-fk', { hasText: new RegExp(`^${label}$`) }) });
const reply = (page: Page) => page.locator('.chat-thread .chat-undo');

test('a recipe fills the draft; a hand edit reads YOURS; UNDO TURN keeps it and restores the rest, also after a reload', async ({ page, request }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  expect((await request.post('/api/chat/draft/reset')).ok()).toBe(true);
  await scriptChat(request, { down: false, hold: false, replies: RECIPE.replies });
  await openChat(page);
  await sendMessage(page, RECIPE.request);
  const card = page.getByLabel('Proposal');
  await expect(card.locator('.chat-card-title')).toHaveText(TITLE, { timeout: 30_000 });

  // 5a: the fields the reply filled read sky with ASSISTANT; UNDO TURN sits on the reply.
  await expect(field(page, 'TITLE')).toHaveClass(/assistant/);
  await expect(field(page, 'TITLE')).toContainText('ASSISTANT');
  await expect(field(page, 'STYLE')).toHaveClass(/assistant/);
  await expect(reply(page).getByRole('button', { name: 'UNDO TURN' })).toBeEnabled();

  // A hand edit of STYLE: YOURS at once, saved after the debounce (touched on the server).
  await page.getByRole('textbox', { name: 'Style' }).fill(MINE);
  await expect(field(page, 'STYLE')).toContainText('YOURS');
  await expect.poll(async () => (await draftThread(request)).draft.fields.style, { timeout: 10_000 }).toBe(MINE);

  // D-221: a reload keeps the marks (from the server's record, not this tab's memory).
  await openChat(page); // a reload: the app starts on the Library (D-119)
  await expect(field(page, 'TITLE')).toHaveClass(/assistant/, { timeout: 15_000 });
  await expect(field(page, 'STYLE')).toContainText('YOURS');
  await expect(field(page, 'STYLE')).not.toHaveClass(/assistant/);

  // 5b: UNDO TURN restores what the turn filled and nobody touched; STYLE is kept with its reason.
  await reply(page).getByRole('button', { name: 'UNDO TURN' }).click();
  await expect(reply(page)).toContainText(/^UNDONE · restored TITLE, .* · kept STYLE: you changed it$/);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Style' })).toHaveValue(MINE);
  await expect(field(page, 'TITLE')).not.toHaveClass(/assistant/);
  const after = await draftThread(request);
  expect(after.draft.fields).toMatchObject({ title: null, style: MINE, bpm: null });
  await expect(card).toBeVisible(); // the card stays live and mirrors the draft (D-220)

  // The after-line and the restored draft come back after a reload; no second UNDO is offered.
  await openChat(page); // a reload: the app starts on the Library (D-119)
  await expect(reply(page)).toContainText('UNDONE · restored TITLE', { timeout: 15_000 });
  await expect(reply(page).getByRole('button', { name: 'UNDO TURN' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Style' })).toHaveValue(MINE);
  await expect(field(page, 'TITLE')).not.toHaveClass(/assistant/);
});
