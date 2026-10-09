/**
 * Several local edits saved as one spliced version (C4, F-069; CK-5), through the real client and the `score`
 * project's server against e2e/fake-score. A song made from the contract song's words; the planner answers
 * REHARMONIZE bar 43 + CUT the chorus (`apply-chain-song`), so the card is a chain of two spans: its consequence says
 * one GPU render and names both spans, APPLY renders the edited score once and sends ONE splice with both steps last
 * bar first (the fake replays `splice-chain-song`, recorded by yue-server on this exact spec), and v2's version card
 * names both spans, the length and where BACK TO stops lining up. The chain needs no gate (CHAT_SPLICE_CHAIN is gone).
 * Runs in `score`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { activeVersion, songByTitle } from './helpers';
import { contract } from '../fake-score/contracts';
import { contractSongDraft, editReplyFor, sp5Turn } from '../fake-score/chatReplies';
import { yueJobs } from './scoreFakes';
import { composer, editDraft, openChat, scriptChat, scriptSplice, sendMessage } from './chatFakes';

test.describe.configure({ mode: 'serial' });

const TITLE = 'Spliced Boats';
const RECIPE = sp5Turn('RC05.t1');
const CHAIN = editReplyFor('apply-chain-song', 'Jazz chords on bar 43, and the chorus cut; both spliced into v1.');
const RECORDED = contract('splice-chain-song') as unknown as { request: { form: { spec: { steps: unknown[] } } } };

const cards = (page: Page) => page.getByLabel('Edit proposal');

async function openSongThread(page: Page) {
  await page.goto('/');
  await page.locator('.song-title.link', { hasText: TITLE }).first().click();
  await page.getByRole('button', { name: 'OPEN CHAT' }).click();
  await expect(page.locator('.chat-title')).toHaveText(TITLE);
  await expect(composer(page)).toBeEnabled();
}

test.beforeAll(async ({ request }) => {
  await scriptChat(request, { down: false, hold: false, replies: [] });
});

test.afterAll(async ({ request }) => {
  await scriptSplice(request, 'splice-ok'); // leave the fake as the other specs expect it
});

test('a song from the contract words: recipe, hand edit, CREATE SONG, v1 saved', async ({ page, request }) => {
  await scriptChat(request, { replies: RECIPE.replies, lyrics: RECIPE.lyrics });
  await openChat(page);
  await sendMessage(page, RECIPE.request);
  await expect(page.getByLabel('Proposal').last()).toContainText('PROPOSAL · NEW SONG', { timeout: 30_000 });
  expect(await editDraft(request, { ...contractSongDraft(), title: TITLE })).toEqual([]);
  await openChat(page);
  await page.getByLabel('Proposal').last().getByRole('button', { name: 'CREATE SONG' }).click();
  await expect(page.locator('.chat-thread').getByText('Saved as v1 in your Library.')).toBeVisible({ timeout: 30_000 });
});

test('two local ops: the card names both spans and one render; APPLY sends one chain; v2 names both spans', async ({ page, request }) => {
  await openSongThread(page);
  await scriptChat(request, { replies: [CHAIN] });
  await scriptSplice(request, 'splice-chain-song');
  const before = (await scriptSplice(request)).length;
  await sendMessage(page, 'jazz chords on bar 43, and cut the chorus');
  const card = cards(page).last();
  await expect(card.locator('.chat-lb')).toHaveText('PLAN · 2 CHANGES · AGAINST BASE v1', { timeout: 30_000 });
  await expect(card.getByLabel('Bar map')).toContainText('17 OF 65 BARS CHANGE · THE OTHER 48 ARE v1');
  const consequence = card.locator('.chat-card-cm .chat-cs');
  await expect(consequence).toContainText('Uses the GPU, one render, a few minutes · re-sings bar 43, cuts bars 47-62');
  await expect(consequence).toContainText("every other bar stays v1's audio");
  await expect(consequence).toContainText('bars after the cut are earlier, so BACK TO v1 will not line up there');
  await expect(consequence).toContainText('if any join cannot be aligned, the whole song is re-rendered instead · saves v2, v1 is kept');
  await expect(card).not.toContainText('WHY THE WHOLE SONG');
  await expect(card).not.toContainText('undefined');
  await page.screenshot({ path: test.info().outputPath('chain-card.png') });

  await card.getByRole('button', { name: 'APPLY' }).click();
  await expect(card.locator('.chat-ref-steps')).toContainText('RENDERINGSPLICINGSAVING');
  await expect(card).toContainText(/RENDERING · YUE2|SPLICING · /, { timeout: 15_000 }); // the fake render runs 1.5 s

  const version = page.locator('.chat-version-card').last();
  await expect(version).toContainText('v2', { timeout: 30_000 });
  await expect(version).toContainText('ACTIVE NOW');
  await expect(version.locator('.chat-card-title')).toContainText('bar 43 spliced · bars 47–62 cut');
  await expect(version.locator('.chat-version-meta')).toContainText("bar 43 changed, bars 47-62 removed · the rest is v1's audio");
  await expect(version.locator('.chat-version-meta')).toContainText('bars after the cut are earlier');
  await expect(version).toContainText('BACK TO v1 plays the same seconds, which no longer line up from bar 47.');
  await expect(version).not.toContainText('undefined');
  await expect(page.locator('.chat-thread .chat-card', { hasText: 'DONE · BAR 43, BARS 47-62' })).toHaveCount(1); // the card folds to its done line
  await page.screenshot({ path: test.info().outputPath('chain-version.png') });

  // ONE splice job with both steps, last bar first, exactly as yue-server recorded it; ONE render of the edited score.
  const specs = await scriptSplice(request);
  expect(specs.length - before).toBe(1);
  expect(specs.at(-1)!.steps).toEqual(RECORDED.request.form.spec.steps);
  expect((await yueJobs(request)).at(-1)!.body).toMatchObject({ abc: contract('apply-chain-song').response.body.abc });
  const base = (await songByTitle(request, TITLE)).layers[0];
  expect(base.versions).toHaveLength(2);
  expect(activeVersion(base).label).toContain('bars 47–62 cut');

  // A reload reads the saved card back from the thread.
  await openSongThread(page);
  await expect(page.locator('.chat-version-card').last().locator('.chat-version-meta')).toContainText('bar 43 changed, bars 47-62 removed');
});
