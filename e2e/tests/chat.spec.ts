/**
 * The chat's golden path (F-051, D-178), through the real client and the `score` project's server (LLM_API_URL and
 * YUE_API_URL set), against e2e/fake-score: a fake Ollama answering with SP-5's recorded replies (chatReplies.ts)
 * and a fake yue-server replaying yue-server's recorded score replies. One draft thread, in order: ASSISTANT OFF,
 * CANCEL while thinking, recipe → CREATE SONG → an edit turn → APPLY → v2, then a stale card. Runs in `score`.
 */
import { test, expect } from './fixtures';
import { activeVersion, songByTitle } from './helpers';
import { contract, recordedSong } from '../fake-score/contracts';
import { contractSongDraft, editReplyFor, sp5Turn } from '../fake-score/chatReplies';
import { plannerLog, yueJobs } from './scoreFakes';
import { composer, draftThread, editDraft, jobLine, openChat, scriptChat, sendMessage } from './chatFakes';

test.describe.configure({ mode: 'serial' });

const RECIPE = sp5Turn('RC05.t1');
const TITLE = String((RECIPE.reply.recipe as { title: string }).title); // "Abschied"
const EDIT_REQUEST = 'a little faster, 88 BPM';
const EDIT_REPLY = editReplyFor('apply-set-tempo', 'Up to 88 BPM; the whole song is re-rendered.');

const thread = (page: import('@playwright/test').Page) => page.locator('.chat-thread');
const editCards = (page: import('@playwright/test').Page) => page.getByLabel('Edit proposal');
const chats = async (request: import('@playwright/test').APIRequestContext) =>
  (await plannerLog(request)).seen.filter((r) => r.path === '/v1/chat/completions') as Array<{ prompt?: string }>;

test.beforeAll(async ({ request }) => {
  await scriptChat(request, { down: false, hold: false, replies: [] });
});

test('ASSISTANT OFF: the composer is off and says why; RETRY brings it back and a turn answers', async ({ page, request }) => {
  await scriptChat(request, { down: true });
  await openChat(page);
  const off = thread(page).getByRole('alert').filter({ hasText: 'ASSISTANT OFF' });
  await expect(off).toContainText('Guided Create works without it (FORM ▸)');
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute('placeholder', 'Assistant off · RETRY above, or use the form');

  await scriptChat(request, { down: false });
  await off.getByRole('button', { name: 'RETRY' }).click();
  await expect(off).toHaveCount(0);
  await expect(composer(page)).toBeEnabled();

  // SP-5's AK02: a bare "yes, do that" with nothing pending is answered with a question and choices.
  const ask = sp5Turn('AK02.t1');
  await scriptChat(request, { replies: ask.replies });
  await sendMessage(page, ask.request);
  await expect(thread(page).getByText(String(ask.reply.message))).toBeVisible({ timeout: 30_000 });
  await expect(thread(page).locator('.chat-choices button')).toHaveText(ask.reply.choices as string[]);
});

test('CANCEL while thinking unloads the planner, keeps nothing, and RETRY asks again', async ({ page, request }) => {
  await scriptChat(request, { hold: true, replies: RECIPE.replies });
  await openChat(page);
  await sendMessage(page, RECIPE.request);
  await expect(jobLine(page)).toContainText('THINKING… attempt 1 of 3', { timeout: 30_000 });
  await expect.poll(async () => (await chats(request)).at(-1)?.prompt ?? '').toContain(RECIPE.request);

  await jobLine(page).getByRole('button', { name: 'CANCEL' }).click();
  const cancelled = thread(page).getByRole('alert').filter({ hasText: 'CANCELLED' });
  await expect(cancelled).toContainText('No reply. Nothing changed.', { timeout: 15_000 });
  await expect(page.getByLabel('Proposal')).toHaveCount(0);
  const { loaded, seen } = await plannerLog(request);
  expect(loaded).toBeNull();
  expect(seen.filter((r) => r.path === '/api/generate').at(-1)?.keepAlive).toBe(0);

  await scriptChat(request, { hold: false });
  await cancelled.getByRole('button', { name: 'RETRY' }).click();
  const card = page.getByLabel('Proposal');
  await expect(card).toContainText('PROPOSAL · NEW SONG', { timeout: 30_000 });
  await expect(card.locator('.chat-card-title')).toHaveText(TITLE);
  await expect(card).toContainText('60 BPM · A MAJOR · 4/4');
});

test('recipe → CREATE SONG: the take renders the draft as edited and lands as v1', async ({ page, request }) => {
  // The person's hand edit (FORM): the contract song's style and words, so its score fixtures answer the edit turn.
  expect(await editDraft(request, contractSongDraft())).toEqual([]);
  await openChat(page);
  const card = page.getByLabel('Proposal');
  await expect(card.locator('.chat-card-style')).toHaveText(recordedSong().style);
  await expect(card).toContainText('Renders a new song on YuE2');
  await card.getByRole('button', { name: 'CREATE SONG' }).click();

  await expect(thread(page).getByText('Saved as v1 in your Library.')).toBeVisible({ timeout: 30_000 });
  await expect(thread(page)).toContainText('DONE · v1 SAVED');
  const take = (await yueJobs(request)).at(-1)!.body;
  expect(take).toMatchObject({ style: recordedSong().style, lyrics: recordedSong().lyrics });
  expect((await draftThread(request)).songId).toBeNull(); // the thread went to the song; a fresh draft took its place
  expect((await songByTitle(request, TITLE)).layers[0].versions).toHaveLength(1);
});

test('an edit turn plans on v1, APPLY re-renders the whole song and v2 lands in the thread', async ({ page, request }) => {
  await scriptChat(request, { replies: [EDIT_REPLY] });
  await openSongThread(page);
  await sendMessage(page, EDIT_REQUEST);
  const card = editCards(page).last();
  await expect(card).toContainText('EDIT · SCORE', { timeout: 30_000 });
  await expect(card).toContainText('SET TEMPO');
  await expect(card).toContainText('the whole song is re-rendered');
  await expect(card).toContainText('saves v2, v1 is kept');
  expect((await chats(request)).at(-1)?.prompt).toContain(EDIT_REQUEST);

  await card.getByRole('button', { name: 'APPLY' }).click();
  const version = page.locator('.chat-version-card').last();
  await expect(version).toContainText('v2', { timeout: 30_000 });
  await expect(version).toContainText('ACTIVE NOW');
  const base = (await songByTitle(request, TITLE)).layers[0];
  expect(base.versions).toHaveLength(2);
  expect(activeVersion(base).label).toContain('SET TEMPO 88');
  expect((await yueJobs(request)).at(-1)!.body).toMatchObject({ abc: contract('apply-set-tempo').response.body.abc, cot: 'full' });
});

test('a stale card: planned on v1, the song changes before APPLY, and nothing starts', async ({ page, request }) => {
  await openSongThread(page);
  const player = page.locator('.chat-player');
  await player.getByRole('button', { name: 'BACK TO v1' }).click();
  await player.getByRole('button', { name: 'USE v1' }).click();
  await expect(player).toContainText('v1 IS ACTIVE · v2 is kept in VERSIONS');

  await scriptChat(request, { replies: [EDIT_REPLY] });
  await sendMessage(page, EDIT_REQUEST);
  // The applied card reads DONE and is no longer a proposal; the new one is planned against v1.
  const card = editCards(page);
  await expect(card).toContainText('saves v3, v1 is kept', { timeout: 30_000 });
  await expect(card).toContainText('PLAN · 1 CHANGE · AGAINST BASE v1');

  // The Editor's VERSIONS makes v2 active again: the card was planned on v1.
  const base = (await songByTitle(request, TITLE)).layers[0];
  const v2 = base.versions.find((v) => !v.active)!;
  expect((await request.patch(`/api/layers/versions/${v2.id}/activate`)).ok()).toBe(true);
  const renders = (await yueJobs(request)).length;

  await card.getByRole('button', { name: 'APPLY' }).click();
  await expect(card).toContainText('EDIT · SCORE · STALE');
  await expect(card).toContainText('THIS SONG CHANGED SINCE THE PROPOSAL');
  expect((await songByTitle(request, TITLE)).layers[0].versions).toHaveLength(2);
  expect(await yueJobs(request)).toHaveLength(renders);
});

/** The song's thread, as a person reopens it: the Library row's title opens its detail, OPEN CHAT the thread. */
async function openSongThread(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('.song-title.link', { hasText: TITLE }).first().click();
  await page.getByRole('button', { name: 'OPEN CHAT' }).click();
  await expect(page.locator('.chat-title')).toHaveText(TITLE);
  await expect(composer(page)).toBeEnabled();
}
