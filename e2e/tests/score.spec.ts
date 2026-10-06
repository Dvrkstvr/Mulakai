/**
 * SCORE's golden path (F-028; F-021..F-024), through the real client and a server that has
 * LLM_API_URL and YUE_API_URL set, against e2e/fake-score: a fake Ollama scripted per test and a
 * fake yue-server replaying yue-server's recorded score replies. One seeded YuE2 song, edge steps
 * first (planner offline, CANCEL while planning, a plan over 360 s), then plan → review → APPLY &
 * RENDER → a new base version. Runs in the `score` project, on its own server and Vite.
 */
import { test, expect } from './fixtures';
import { activeVersion, songByTitle } from './helpers';
import { contract, plannerReplyFor, recordedSong } from '../fake-score/contracts';
import { openSong, plannerLog, scriptPlanner, seedYue2Song, viewButton, yueJobs } from './scoreFakes';

const TITLE = `E2E Score ${Date.now().toString(36)}`;
const REQUEST = 'jazz chords in the chorus, 88 BPM';

test.describe.configure({ mode: 'serial' });

let songId = '';

test.beforeAll(async ({ request }) => {
  await scriptPlanner(request, { down: false, replies: [] });
  songId = await seedYue2Song(request, TITLE);
});

/** The SCORE verb of the open song's dock. */
async function openScore(page: import('@playwright/test').Page) {
  await openSong(page, TITLE);
  const dock = page.getByRole('region', { name: 'Action dock' });
  await dock.getByRole('tab', { name: 'SCORE' }).click();
  return { dock, panel: dock.getByRole('tabpanel', { name: 'SCORE' }) };
}

test('with LLM_API_URL and YUE_API_URL set, the app opens on CHAT, on the draft thread (D-099)', async ({ page }) => {
  await page.goto('/');
  await expect(viewButton(page, 'CHAT')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
});

test('planner offline: SCORE says so, and RECHECK brings it back', async ({ page, request }) => {
  await scriptPlanner(request, { down: true });
  const { panel } = await openScore(page);
  const alert = panel.getByRole('alert');
  await expect(alert).toContainText('PLANNER OFFLINE');
  await expect(alert).toContainText('planner offline: no answer from');
  await expect(alert).toContainText('Start Ollama, then RECHECK.');

  await scriptPlanner(request, { down: false });
  await alert.getByRole('button', { name: 'RECHECK' }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.locator('.score-reading')).toHaveText('65 bars · 4/4 · Q:87 · key Dm · est 179 s · 1,832 tokens');
});

test('GET /score carries the read sections and lyric blocks, numbered by yue-server, for a pick (F-032)', async ({ request }) => {
  // The strip and the lyrics lane need lyric timings, which this stack has none of (LYRICS_API_URL is empty and a
  // YuE2 take stores no timestamps), so the pick itself is covered by Vitest; this checks the wire a pick reads.
  const facts = contract('read-ok').response.body.facts as { sections: Array<Record<string, unknown>>; lyric_blocks: unknown[] };
  const status = (await (await request.get(`/api/songs/${songId}/score`)).json()) as { sections: unknown[]; blocks: unknown[] };
  expect(status.sections).toEqual(facts.sections.map((x) => ({ ...x, occurrence: 1 })));
  expect(status.blocks).toEqual(facts.lyric_blocks);
});

test('CANCEL while planning aborts the call, unloads the planner and keeps the request', async ({ page, request }) => {
  await scriptPlanner(request, { replies: [{ hang: true }] });
  const { dock, panel } = await openScore(page);
  await panel.getByRole('textbox', { name: 'Score change request' }).fill(REQUEST);
  await dock.getByRole('button', { name: 'PLAN', exact: true }).click();
  const job = dock.locator('.score-job');
  await expect(job).toContainText('PLANNING… attempt 1 of 3');
  await expect.poll(async () => (await plannerLog(request)).loaded).toBe('qwen3:14b');

  await job.getByRole('button', { name: 'CANCEL' }).click();
  await expect(job).toHaveCount(0, { timeout: 15_000 });
  await expect(panel.getByRole('textbox', { name: 'Score change request' })).toHaveValue(REQUEST);
  await expect(panel.locator('.score-ops')).toHaveCount(0);
  // The GPU hand-off still ran: an unload, then /api/ps polled until empty.
  const { loaded, seen } = await plannerLog(request);
  expect(loaded).toBeNull();
  const unload = seen.filter((r) => r.path === '/api/generate').at(-1);
  expect(unload?.keepAlive).toBe(0);
  expect(seen.some((r) => r.path === '/api/ps' && r.at >= unload!.at)).toBe(true);
  const run = (await (await request.get(`/api/songs/${songId}/score/plan`)).json()) as { run: { cause: string }; plan: unknown };
  expect(run).toMatchObject({ run: { cause: 'cancelled' }, plan: null });
});

test('a plan over 360 s is refused with the number and the tempo that fits', async ({ page, request }) => {
  const slow = contract('apply-set-tempo-over-limit').response.body as { seconds: number };
  await scriptPlanner(request, { replies: [plannerReplyFor('apply-set-tempo-over-limit')] });
  const { dock, panel } = await openScore(page);
  await panel.getByRole('textbox', { name: 'Score change request' }).fill('slow it right down, 40 BPM');
  await dock.getByRole('button', { name: 'PLAN', exact: true }).click();

  const alert = panel.getByRole('alert');
  await expect(alert).toContainText('CHECK FAILED', { timeout: 30_000 });
  await expect(alert).toContainText(new RegExp(`estimated ${Math.round(slow.seconds)} s: over the 360 s limit; at least \\d+ BPM fits`));
  await expect(dock.getByRole('button', { name: 'APPLY & RENDER' })).toBeDisabled();
  // Each of the three attempts was told why and refused again.
  const chats = (await plannerLog(request)).seen.filter((r) => r.path === '/v1/chat/completions');
  expect(chats.length).toBeGreaterThanOrEqual(3);
});

test('REVISE sees plan 1, merges what changes into it and marks what changed since (F-033, D-073)', async ({ page, request }) => {
  // Plan 1 is the compound plan; the REVISE replies only what changes, {drop, ops} (D-073): drop ops 2 and 3, so the
  // merged plan is plan 1's SET TEMPO alone, which yue-server's recorded apply-set-tempo reply answers.
  const reviseReply = JSON.stringify({ drop: [2, 3], ops: [] });
  expect(contract('apply-set-tempo').request.body.ops).toEqual([(contract('apply-compound').request.body.ops as unknown[])[0]]);
  await scriptPlanner(request, { replies: [plannerReplyFor('apply-compound'), reviseReply] });
  const { dock, panel } = await openScore(page);
  const field = panel.getByRole('textbox', { name: 'Score change request' });
  await field.fill(REQUEST);
  await dock.getByRole('button', { name: 'PLAN', exact: true }).click();
  await expect(panel.locator('.score-plan-label')).toHaveText('PLAN · 3 CHANGES · AGAINST BASE v1', { timeout: 30_000 });
  const revise = dock.getByRole('button', { name: 'REVISE', exact: true });
  await expect(revise).toBeDisabled(); // the request is still plan 1's (M2-5)

  const plan1 = ((await (await request.get(`/api/songs/${songId}/score/plan`)).json()) as { plan: { id: string } }).plan.id;
  await field.fill('only the tempo change, no chords or style');
  const posted = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/songs/${songId}/score/plan`));
  await revise.click();
  expect((await posted).postDataJSON()).toEqual({ request: 'only the tempo change, no chords or style', referent: null, revise: plan1 });
  await expect(panel.locator('.score-plan-label', { hasText: 'REVISED' }))
    .toHaveText('PLAN 2 · REVISED FROM PLAN 1 · 1 CHANGE · AGAINST BASE v1', { timeout: 30_000 });
  await expect(panel.locator('.score-since', { hasText: /^SINCE/ })).toHaveText('SINCE PLAN 1 · 1 SAME · 2 REMOVED');
  await expect(panel.locator('.score-since', { hasText: /^REMOVED/ })).toHaveText(/^REMOVED SINCE PLAN 1 · REHARMONIZE .* · EDIT STYLE/);
  await expect(panel.locator('.score-op-name')).toHaveText(['SET TEMPO']);
  await expect(panel.locator('.score-op-mark')).toHaveText(['SAME']);
  await expect(revise).toBeDisabled();
  await expect(dock.getByRole('button', { name: 'APPLY & RENDER' })).toBeEnabled();
  // The planner was asked with plan 1 in the prompt; the second chat is the REVISE's.
  expect((await plannerLog(request)).seen.filter((r) => r.path === '/v1/chat/completions').length).toBeGreaterThanOrEqual(2);
});

test('plan → review → APPLY & RENDER saves a new base version', async ({ page, request }) => {
  const compound = contract('apply-compound').response.body as { abc: string; style: string };
  await scriptPlanner(request, { replies: [plannerReplyFor('apply-compound')] });
  const { dock, panel } = await openScore(page);
  await panel.getByRole('textbox', { name: 'Score change request' }).fill(REQUEST);
  await dock.getByRole('button', { name: 'PLAN', exact: true }).click();

  await test.step('review: the change list, the checks line and the consequence line', async () => {
    await expect(panel.locator('.score-plan-label')).toHaveText('PLAN · 3 CHANGES · AGAINST BASE v1', { timeout: 30_000 });
    const ops = panel.locator('.score-op');
    await expect(ops).toHaveCount(3);
    await expect(ops.locator('.score-op-name')).toHaveText(['SET TEMPO', 'REHARMONIZE', 'EDIT STYLE']);
    await expect(ops.nth(0).locator('.score-op-detail')).toHaveText('87 → 88 BPM · whole song');
    await expect(ops.nth(1).locator('.score-op-detail')).toHaveText('bars 47–50 · Dm7 G7 Bbmaj7 A7sus4');
    await expect(ops.locator('.score-op-tag')).toHaveText(['follows', 'a request', 'a request']);
    await expect(panel.locator('.score-checks')).toHaveText('65 bars · est 177 s of 360 s · 1,833 of 4,096 tokens · chords valid · attempt 1 of 3');
    await expect(dock.getByText(/^Saves base v2 · re-renders the whole song on YuE2, about 3 min · every bar will sound different/))
      .toContainText('tempo follows 88 BPM · harmony in bars 47–50 and the style change are a request to YuE2, not a guarantee · v1 stays in VERSIONS');
    // Nothing is saved by a plan.
    expect((await songByTitle(request, TITLE)).layers[0].versions).toHaveLength(1);
  });

  await test.step('APPLY & RENDER: YuE2 renders the edited score, and v2 lands in VERSIONS', async () => {
    await dock.getByRole('button', { name: 'APPLY & RENDER' }).click();
    await expect(dock.locator('.score-job')).toContainText('RENDERING');
    await expect(panel.locator('.score-done')).toContainText('Saved base v2 · 88 BPM', { timeout: 30_000 });
    // The dock reads the new version's score: the tempo moved, the song is still SCORE-eligible.
    await expect(panel.locator('.score-reading')).toHaveText('65 bars · 4/4 · Q:88 · key Dm · est 177 s · 1,833 tokens');
    const current = page.locator('.versions .version.current');
    await expect(current).toContainText('score edit · SET TEMPO 88 · REHARMONIZE 47–50 · EDIT STYLE');

    const base = (await songByTitle(request, TITLE)).layers[0];
    expect(base.versions).toHaveLength(2);
    expect(activeVersion(base).label).toBe('score edit · SET TEMPO 88 · REHARMONIZE 47–50 · EDIT STYLE');
    const render = (await yueJobs(request)).at(-1)!.body;
    expect(render).toMatchObject({ abc: compound.abc, style: compound.style, lyrics: recordedSong().lyrics, cot: 'full' });
  });
});
