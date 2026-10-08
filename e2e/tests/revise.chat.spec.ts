/**
 * The edit card converging (F-058 client, F-060; chat-converge.html 3a, 3c, 4b, 4d), through the real client and the
 * `score` project's server against e2e/fake-score. A song made from the contract song's words (every score read and
 * apply replays a recording). Plan 1 is SET TEMPO; "and jazz chords in bars 47-50" revises it (D-227): plan 2 reads
 * REVISED · PLAN 2 with SET TEMPO SAME, REHARMONIZE and EDIT STYLE NEW (apply-compound's ops), plan 1 stays dimmed with
 * REVISED BELOW and no APPLY, plan 1's APPLY is off while the revise runs (Q-144), the bar map lights bars 47-50 on hover
 * and focus (Q-143), APPLY saves v2 with the merged score. Then a 200-bar map at 1366×768 stays one row and legible (F-060 edge). Runs in `score`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { songByTitle } from './helpers';
import { contract } from '../fake-score/contracts';
import { contractSongDraft, editReplyFor, reviseReplyFor, sp5Turn } from '../fake-score/chatReplies';
import { yueJobs } from './scoreFakes';
import { composer, editDraft, openChat, scriptChat, sendMessage } from './chatFakes';

test.describe.configure({ mode: 'serial' });

const TITLE = 'Revised Boats';
const RECIPE = sp5Turn('RC05.t1');
const PLAN_1 = editReplyFor('apply-set-tempo', 'Up to 88 BPM; the whole song is re-rendered.');
// The pending SET TEMPO echoed, REHARMONIZE 47-50 and EDIT STYLE added, nothing dropped: the merge is apply-compound's ops.
const PLAN_2 = reviseReplyFor('apply-compound', 'Added jazz chords in bars 47-50; the tempo change stays.');

const cards = (page: Page) => page.getByLabel('Edit proposal');

async function openSongThread(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.locator('.song-title.link', { hasText: TITLE }).first().click();
  await page.getByRole('button', { name: 'OPEN CHAT' }).click();
  await expect(page.locator('.chat-title')).toHaveText(TITLE);
  await expect(composer(page)).toBeEnabled();
}

test.beforeAll(async ({ request }) => {
  await scriptChat(request, { down: false, hold: false, replies: [] });
});

test('a song from the contract words: recipe, hand edit, CREATE SONG, v1 saved', async ({ page, request }) => {
  await scriptChat(request, { replies: RECIPE.replies });
  await openChat(page);
  await sendMessage(page, RECIPE.request);
  await expect(page.getByLabel('Proposal').last()).toContainText('PROPOSAL · NEW SONG', { timeout: 30_000 });
  expect(await editDraft(request, { ...contractSongDraft(), title: TITLE })).toEqual([]);
  await openChat(page);
  await page.getByLabel('Proposal').last().getByRole('button', { name: 'CREATE SONG' }).click();
  await expect(page.locator('.chat-thread').getByText('Saved as v1 in your Library.')).toBeVisible({ timeout: 30_000 });
});

test('a follow-up revises the card: plan 2 NEW + SAME, plan 1 REVISED BELOW, the map lights 47-50, APPLY saves v2', async ({ page, request }) => {
  await openSongThread(page);
  await scriptChat(request, { replies: [PLAN_1] });
  await sendMessage(page, 'a little faster, 88 BPM');
  const plan1 = cards(page).last();
  await expect(plan1).toContainText('PLAN · 1 CHANGE', { timeout: 30_000 });
  await expect(plan1.getByLabel('Bar map')).toContainText(/ALL \d+ BARS CHANGE \(SET TEMPO\)/);
  const before = await cards(page).count();

  // While the revise runs, plan 1's APPLY is off (Q-144); it is still the live card.
  await scriptChat(request, { hold: true, replies: [PLAN_2] });
  await sendMessage(page, 'and jazz chords in bars 47-50');
  await expect(plan1.getByRole('button', { name: 'APPLY' })).toBeDisabled({ timeout: 30_000 });
  await scriptChat(request, { hold: false });

  await expect(cards(page)).toHaveCount(before + 1, { timeout: 30_000 });
  const plan2 = cards(page).last();
  await expect(plan2).toContainText('EDIT · SCORE · REVISED · PLAN 2');
  await expect(plan2).toContainText('PLAN 2 · REVISED FROM PLAN 1 · 3 CHANGES');
  await expect(plan2).toContainText('SINCE PLAN 1 · 2 NEW · 1 SAME');
  await expect(plan2.locator('.score-op', { hasText: 'SET TEMPO' }).locator('.score-op-mark')).toHaveText('SAME');
  await expect(plan2.locator('.score-op', { hasText: 'REHARMONIZE' }).locator('.score-op-mark')).toHaveText('NEW');

  // Plan 1 stays in full, dimmed, REVISED BELOW, no APPLY (Q-140 A).
  const old = cards(page).nth(before - 1);
  await expect(old).toHaveClass(/\bsup\b/);
  await expect(old).toContainText('REVISED BELOW');
  await expect(old).toContainText('Revised below. This one cannot be applied.');
  await expect(old.getByRole('button', { name: 'APPLY' })).toHaveCount(0);

  // The bar map: hovering (or focusing) the REHARMONIZE row lights bars 47-50 only; the SET TEMPO row lights the hatch.
  const map = plan2.getByLabel('Bar map');
  await expect(map.locator('.e.lit')).toHaveCount(0);
  await plan2.locator('.score-op', { hasText: 'REHARMONIZE' }).hover();
  await expect(map.locator('.e.lit')).toHaveAttribute('data-bars', '47-50');
  await expect(map).toContainText('BARS 47–50 · REHARMONIZE · LIT');
  await plan2.locator('.score-op', { hasText: 'SET TEMPO' }).focus();
  await expect(map.locator('.wh.lit')).toHaveCount(1);
  await expect(map.locator('.e.lit')).toHaveCount(0);

  await plan2.getByRole('button', { name: 'APPLY' }).click();
  await expect(page.locator('.chat-version-card').last()).toContainText('v2', { timeout: 30_000 });
  const base = (await songByTitle(request, TITLE)).layers[0];
  expect(base.versions).toHaveLength(2);
  expect((await yueJobs(request)).at(-1)!.body).toMatchObject({ abc: contract('apply-compound').response.body.abc });
});

test('a 200-bar map at 1366×768: one row, every label inside its band, the card one screen high (F-060 edge)', async ({ page }) => {
  // The contract song is under 80 bars: the edit cards' maps are swapped for a 200-bar cover's in the thread view. The
  // card left drawing one is plan 1, superseded and dimmed in full (Q-140 A); plan 2 folded to DONE.
  const sections = [8, 16, 12, 16, 16, 8, 16, 16, 8, 16, 16, 16, 16, 16, 4].reduce<Array<{ label: string; occurrence: number; from: number; to: number }>>(
    (out, len, i) => [...out, { label: i === 0 ? 'intro' : i === 14 ? 'outro' : i % 2 ? 'verse' : 'chorus', occurrence: Math.ceil(i / 2) || 1, from: (out.at(-1)?.to ?? 0) + 1, to: (out.at(-1)?.to ?? 0) + len }], []);
  await page.route(/\/api\/chat\/(threads\/[^/]+|songs\/[^/]+\/thread)$/, async (route) => { // a song's thread opens by song
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    for (const m of (body.messages ?? []) as Array<{ kind: string; state: string; body: { map?: unknown } }>) {
      if (m.kind === 'edit') m.body.map = { bars: 200, sections, ops: [{ spans: [[97, 100]], whole: false }, { spans: [[141, 156], [185, 200]], whole: false }] };
    }
    await route.fulfill({ response: res, json: body });
  });
  await openSongThread(page);
  const map = cards(page).last().getByLabel('Bar map');
  await expect(map).toHaveAttribute('data-bars', '200');
  const box = (await map.boundingBox())!;
  expect(box.height).toBeLessThan(80);
  expect(box.x + box.width).toBeLessThanOrEqual(1366);
  const clipped = await map.locator('.chat-bm-bands > i').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(clipped).toBe(0);
  await page.screenshot({ path: test.info().outputPath('bar-map-200.png') });
});
