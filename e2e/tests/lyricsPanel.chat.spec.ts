/**
 * The song sidebar's lyrics panel (F-056, F-057 panel half; chat-converge.html section 2), through the real client and
 * the `score` project's server against e2e/fake-score. A song made from the contract song's words (so every score read
 * replays a recording): the sidebar is VERSIONS, STYLE, TEMPO · KEY and the panel, no draft field; the section list →
 * a click marks one → only that part; ◂ ALL SECTIONS clears. Then a pending REWRITE LYRICS: struck above new inside the
 * mark, PROPOSED outside it with the mark left alone. Runs in `score` (the file name ends in chat.spec.ts, D-224).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { songByTitle } from './helpers';
import { contractSongDraft, editReplyFor, sp5Turn } from '../fake-score/chatReplies';
import { composer, editDraft, openChat, scriptChat, sendMessage } from './chatFakes';
import { markChip } from './chatMarkFakes';

test.describe.configure({ mode: 'serial' });

const TITLE = 'Paper Boats';
const RECIPE = sp5Turn('RC05.t1');
const EDIT_REPLY = editReplyFor('apply-set-tempo', 'Up to 88 BPM; the whole song is re-rendered.');

const panel = (page: Page) => page.getByRole('region', { name: 'Lyrics' });
const row = (page: Page, name: string) => panel(page).locator('.chat-lp-sr', { has: page.locator(`b:text-is("${name}")`) });

async function openSongThread(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.locator('.song-title.link', { hasText: TITLE }).first().click();
  await page.getByRole('button', { name: 'OPEN CHAT' }).click();
  await expect(page.locator('.chat-title')).toHaveText(TITLE);
  await expect(composer(page)).toBeEnabled();
  await expect(page.getByRole('status', { name: 'Reading' })).toHaveText(/^READ v\d/, { timeout: 30_000 });
}

test.beforeAll(async ({ request }) => {
  await scriptChat(request, { down: false, hold: false, replies: [] });
});

test('a song from the contract words: recipe, hand edit, CREATE SONG, v1 saved', async ({ page, request }) => {
  await scriptChat(request, { replies: RECIPE.replies });
  await openChat(page);
  await sendMessage(page, RECIPE.request);
  await expect(page.getByLabel('Proposal').last()).toContainText('PROPOSAL · NEW SONG', { timeout: 30_000 });
  // The person's hand edit: the contract song's style and words (its score fixtures answer), under its own title.
  expect(await editDraft(request, { ...contractSongDraft(), title: TITLE })).toEqual([]);
  await openChat(page);
  await page.getByLabel('Proposal').last().getByRole('button', { name: 'CREATE SONG' }).click();
  await expect(page.locator('.chat-thread').getByText('Saved as v1 in your Library.')).toBeVisible({ timeout: 30_000 });
});

test('the sidebar is the song panel; the section list, a click marks one, only that part, ◂ ALL SECTIONS clears', async ({ page }) => {
  await openSongThread(page);
  const sidebar = page.getByRole('complementary', { name: 'Draft' });
  await expect(sidebar).toContainText('VERSIONS');
  await expect(sidebar).toContainText('v1 ●');
  await expect(sidebar).toContainText('TEMPO · KEY');
  await expect(sidebar.getByLabel('Title')).toHaveCount(0); // D-219: no locked draft fields on a song's thread

  // No mark: every strip section with its bars, line count and first line (YuE2's stored words, paired by kind).
  await expect(panel(page)).toContainText('CLICK TO MARK');
  await expect(panel(page).locator('.chat-lp-sr')).toHaveCount(4);
  await expect(row(page, 'INTRO')).toContainText('NONE');
  await expect(row(page, 'VERSE')).toContainText('walking out');
  await expect(row(page, 'CHORUS')).toContainText('hold on');

  // A click marks the section, the same mark the strip makes; the panel shows only that part.
  await row(page, 'VERSE').click();
  await expect(markChip(page)).toHaveText(/^THIS: VERSE · BARS 11–46 · /);
  await expect(page.locator('.chat-player .chat-strip').getByRole('button', { name: 'VERSE' })).toHaveClass(/\bon\b/);
  await expect(panel(page)).toContainText('LYRICS · VERSE');
  await expect(panel(page)).toContainText('into the rain');
  await expect(panel(page)).not.toContainText('hold on');
  // No word timings (LYRICS_API_URL unset): a line click marks its section (D-218).
  await panel(page).getByRole('button', { name: /walking out/ }).click();
  await expect(markChip(page)).toHaveText(/^THIS: VERSE · BARS 11–46 · /);
  // The panel never follows playback and never edits words: no text field in it.
  await expect(panel(page).getByRole('textbox')).toHaveCount(0);

  await panel(page).getByRole('button', { name: '◂ ALL SECTIONS' }).click();
  await expect(markChip(page)).toHaveCount(0);
  await expect(panel(page).locator('.chat-lp-sr')).toHaveCount(4);
});

test('a pending REWRITE LYRICS: struck above new in the mark, PROPOSED outside it, the mark left alone', async ({ page, request }) => {
  // yue-server has no recorded REWRITE LYRICS for the contract song (apply-rewrite-lyrics is another song's words), so
  // the edit card is a real SET TEMPO plan and its REWRITE LYRICS verdict is added to the thread view the server sends.
  // Record one in yue-server/tests/test_score_edit_routes.py to drop this patch.
  const song = await songByTitle(request, TITLE);
  const view = await (await request.get(`/api/chat/songs/${song.id}/analysis`)).json();
  const chorus = (view.shown.lyrics.sections as Array<{ label: string; block: number | null }>).find((s) => /chorus/i.test(s.label))!;
  const diff = { block: chorus.block, tag: '[Chorus]', occurrence: 1, old: ['hold on'], new: ['hold on tight'] };
  await page.route(/\/api\/chat\/threads\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    const card = (body.messages as Array<{ kind: string; state: string; body: { verdicts?: unknown[] } }>).filter((m) => m.kind === 'edit').at(-1);
    if (card?.state === 'pending') card.body.verdicts = [...(card.body.verdicts ?? []), { index: 99, op: 'REWRITE_LYRICS', ok: true, reason: null, diff }];
    await route.fulfill({ response: res, json: body });
  });
  await openSongThread(page);
  await scriptChat(request, { replies: [EDIT_REPLY] });
  await sendMessage(page, 'a little faster, 88 BPM');
  await expect(page.getByLabel('Edit proposal').last()).toContainText('EDIT · SCORE', { timeout: 30_000 });

  await expect(row(page, 'CHORUS')).toContainText('PROPOSED');
  await row(page, 'VERSE').click();
  await expect(panel(page)).toContainText('LYRICS · VERSE');
  const proposed = panel(page).locator('.chat-lp-part.proposed');
  await expect(proposed).toContainText('CHORUS');
  await expect(proposed).toContainText('PROPOSED');
  await expect(proposed.locator('s')).toHaveText('hold on');
  await expect(proposed.locator('.chat-lp-ln.new')).toContainText('hold on tight');
  await expect(markChip(page)).toHaveText(/^THIS: VERSE · BARS 11–46 · /); // the mark stays on VERSE (Q-074)

  await panel(page).getByRole('button', { name: '◂ ALL SECTIONS' }).click();
  await row(page, 'CHORUS').click();
  await expect(markChip(page)).toHaveText(/^THIS: CHORUS · BARS 47–62 · /);
  await expect(panel(page).locator('.chat-lp-part.proposed')).toHaveCount(0);
  await expect(panel(page).locator('.chat-lp-part s')).toHaveText('hold on');
  await expect(panel(page).locator('.chat-lp-ln.new')).toContainText('hold on tight');
});
