/**
 * The chat's golden path (F-051, D-178), through the real client and the `score` project's server (LLM_API_URL and
 * YUE_API_URL set), against e2e/fake-score: a fake Ollama answering with SP-5's recorded replies (chatReplies.ts)
 * and a fake yue-server replaying yue-server's recorded score replies. One draft thread, in order: ASSISTANT OFF,
 * CANCEL while thinking, recipe → CREATE SONG → v1 read (a live strip) → a marked turn → an edit turn → APPLY → v2,
 * then a stale mark and a stale card. Runs in `score`.
 */
import { test, expect } from './fixtures';
import { activeVersion, songByTitle } from './helpers';
import { contract, recordedSong } from '../fake-score/contracts';
import { contractSongDraft, editReplyFor, sp5Turn } from '../fake-score/chatReplies';
import { plannerLog, yueJobs } from './scoreFakes';
import { composer, draftThread, editDraft, jobLine, openChat, scriptChat, sendMessage } from './chatFakes';
import { BAR_SECONDS, SONG_SECONDS, barClock, drag, markChip, markLine } from './chatMarkFakes';

test.describe.configure({ mode: 'serial' });

const RECIPE = sp5Turn('RC05.t1');
const TITLE = String((RECIPE.reply.recipe as { title: string }).title); // "Abschied"
const EDIT_REQUEST = 'a little faster, 88 BPM';
const EDIT_REPLY = editReplyFor('apply-set-tempo', 'Up to 88 BPM; the whole song is re-rendered.');
/** v1's tempo as yue-server's recorded read reports it: the edit card's SET TEMPO row starts from it. */
const BASE_BPM = (contract('read-ok').response.body.facts as { header: { bpm: number } }).header.bpm;

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

test('the player reads v1: the reading line, the strip and the ruler; the thread keeps 400 px at 1366×768', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSongThread(page);
  const player = page.locator('.chat-player');
  // The save queued one analysis (F-052): WORDS is skipped with LYRICS_API_URL unset (not a failure), the score is
  // YuE2's own; a chords run tracks the beat and yue-server times the bars (both replayed from yue-server's recordings
  // of the contract song: transcription-grid-contract, scores-bars-contract), so the strip is live with its names.
  const line = player.getByRole('status', { name: 'Reading' });
  await expect(line).toHaveText(/^READ v1 · 4 SECTIONS · \d+ LINES? · NO WORD TIMINGS$/, { timeout: 30_000 });
  await expect(line).not.toHaveClass(/failed/);
  await expect(line.getByRole('button', { name: 'RETRY' })).toHaveCount(0);
  const strip = player.locator('.chat-strip');
  await expect(strip).toHaveAttribute('data-mode', 'live');
  await expect(strip.getByRole('group', { name: 'Sections' }).getByRole('button')).toHaveText(['INTRO', 'VERSE', 'CHORUS', 'OUTRO']);
  await expect(strip.getByLabel('Bar ruler')).toContainText('57'); // a number every 8 bars: 1, 9, …, 57, 65
  // F-053 #4: the player above the composer leaves the thread at least 400 px.
  const thread = await page.locator('.chat-thread').boundingBox();
  expect(thread!.height).toBeGreaterThanOrEqual(400);
});

test('a mark: click CHORUS, drag its end two bars on; the marked turn’s prompt carries MARK; the echo re-marks', async ({ page, request }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSongThread(page);
  const strip = page.locator('.chat-player .chat-strip');
  await strip.getByRole('button', { name: 'CHORUS' }).click();
  await expect(markChip(page)).toHaveText(`THIS: CHORUS · BARS 47–62 · ${barClock(47)}–${barClock(63)}`);
  await expect(strip.getByRole('button', { name: 'CHORUS' })).toHaveClass(/\bon\b/);
  await expect(markLine(page)).toHaveText('plans on these bars only · nothing runs until you press APPLY');

  // Drag the end grip two bars on: it snaps to the bar line and the tag says where (MK-5).
  const grip = page.locator('.chat-mk-grip.end');
  const box = (await grip.boundingBox())!;
  const bar = (await page.locator('.chat-mk-layer').boundingBox())!.width * BAR_SECONDS / SONG_SECONDS;
  await drag(page, box.x + box.width / 2, box.x + box.width / 2 + 2 * bar + 4, box.y + box.height / 2);
  await expect(page.locator('.chat-mk-tag')).toContainText('SNAPS TO END OF BAR 64');
  await page.mouse.up();
  const chip = `CHORUS + 2 BARS · BARS 47–64 · ${barClock(47)}–${barClock(65)}`;
  await expect(markChip(page)).toHaveText(`THIS: ${chip}`);
  expect((await page.locator('.chat-thread').boundingBox())!.height).toBeGreaterThanOrEqual(400); // chip and line too

  // WHAT IT SEES is the server's preview of what SEND carries (D-177).
  await page.getByRole('button', { name: 'WHAT IT SEES ▾' }).click();
  const sees = page.getByRole('dialog', { name: 'WHAT THE ASSISTANT SEES' });
  await expect(sees).toContainText('47-64');
  await sees.getByRole('button', { name: 'AS SENT ▸' }).click();
  await expect(sees.getByLabel('As sent')).toContainText('"bars"');
  await page.getByRole('button', { name: 'WHAT IT SEES ▾' }).click();

  await scriptChat(request, { replies: [EDIT_REPLY] });
  await sendMessage(page, 'make the whole song faster'); // a whole-song op under a mark only when asked for (C1 live B2)
  const card = editCards(page).last();
  await expect(card).toContainText('PLANNED ON THE MARK · BARS 47–64', { timeout: 30_000 });
  await expect(card).toContainText('the whole song, not only the marked bars'); // SET TEMPO is a whole-song op (D-176)
  expect((await chats(request)).at(-1)?.prompt).toContain('MARK (the person marked part of v1');

  // The sent message keeps a frozen echo; the mark stays until cleared; a click on the echo marks it again.
  const echo = thread(page).locator('.chat-mk-echo').last();
  await expect(echo).toContainText(`MARKED · ${chip}`);
  await expect(echo).toContainText('on v1 · click to mark it again');
  await expect(markChip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(markChip(page)).toHaveCount(0);
  await echo.getByRole('button').click();
  await expect(markChip(page)).toHaveText(`THIS: ${chip}`);
  await page.getByRole('button', { name: 'Clear mark' }).click(); // the next turns plan on the whole song
  await expect(markChip(page)).toHaveCount(0);
});

test('an edit turn plans on v1, APPLY re-renders the whole song and v2 lands in the thread', async ({ page, request }) => {
  await scriptChat(request, { replies: [EDIT_REPLY] });
  await openSongThread(page);
  const before = await editCards(page).count(); // the marked turn's card is superseded by this one, not applied
  await sendMessage(page, EDIT_REQUEST);
  await expect(editCards(page)).toHaveCount(before + 1, { timeout: 30_000 });
  const card = editCards(page).last();
  await expect(card).toContainText('EDIT · SCORE', { timeout: 30_000 });
  await expect(card).toContainText('SET TEMPO');
  await expect(card.locator('.score-op-detail').first()).toContainText(`${BASE_BPM} → 88 BPM`); // the base tempo, not "?"
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
  // The recipe card still names the version its own take saved, not the thread's newest one.
  const recipe = thread(page).locator('.chat-card', { hasText: 'PROPOSAL · NEW SONG' }); // a done card drops its label
  await expect(recipe).toContainText('DONE · v1 SAVED');
  await expect(recipe).not.toContainText('v2 SAVED');
  expect((await yueJobs(request)).at(-1)!.body).toMatchObject({ abc: contract('apply-set-tempo').response.body.abc, cot: 'full' });
});

test('a stale mark holds SEND until CLEAR MARK; a stale card: planned on v1, the song changes before APPLY, nothing starts', async ({ page, request }) => {
  await openSongThread(page);
  const player = page.locator('.chat-player');
  // A mark made by a drag on v2's waveform, then v1 made active: v1 is not v2's child, so the mark is stale (F-055 #2).
  const layer = (await page.locator('.chat-mk-layer').boundingBox())!;
  await drag(page, layer.x + layer.width * 0.2, layer.x + layer.width * 0.3, layer.y + layer.height / 2);
  await page.mouse.up();
  await expect(markChip(page)).toHaveText(/^THIS: /);
  await player.getByRole('button', { name: 'BACK TO v1' }).click();
  await player.getByRole('button', { name: 'USE v1' }).click();
  await expect(player).toContainText('v1 IS ACTIVE · v2 is kept in VERSIONS');

  await expect(markChip(page)).toHaveText(/ · STALE$/);
  await expect(page.getByLabel('Stale mark')).toBeVisible(); // the old place, outlined in rust
  const warn = thread(page).getByRole('alert').filter({ hasText: 'STALE MARK' });
  await expect(warn).toContainText('v1 moved those bars; mark again');
  await expect(warn.getByRole('button', { name: /^USE / })).toHaveCount(0); // no shift reported: no USE BARS
  await expect(markLine(page)).toHaveText('SEND IS HELD · press CLEAR MARK, then mark again');
  await composer(page).fill(EDIT_REQUEST);
  await expect(page.getByRole('button', { name: 'SEND ↵' })).toBeDisabled();
  await warn.getByRole('button', { name: 'CLEAR MARK' }).click();
  await expect(markChip(page)).toHaveCount(0);
  await expect(warn).toHaveCount(0);

  await scriptChat(request, { replies: [EDIT_REPLY] });
  const before = await editCards(page).count();
  await sendMessage(page, EDIT_REQUEST);
  // The applied card reads DONE and is no longer a proposal; the new one is planned against v1.
  await expect(editCards(page)).toHaveCount(before + 1, { timeout: 30_000 });
  const card = editCards(page).last();
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
