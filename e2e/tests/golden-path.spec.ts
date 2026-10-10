/**
 * PLAN.md Phase 10's golden path, end to end through the real client and server, with ACE-Step
 * replaced by e2e/fake-acestep: generate → repaint a region → add a layer → revert a version → export,
 * every edit through the Editor's action dock.
 * Every fake take is 12 s long, which is what the region drag below is measured against.
 */
import { test, expect } from './fixtures';
import { activeVersion, downloadBytes, dragRegion, lastTaskOfType, songByTitle } from './helpers';

const DURATION = 12;

test('generate → repaint → add layer → revert → export', async ({ page, request }) => {
  // Unique per run, so `--repeat-each` against one database never finds an earlier run's song.
  const TITLE = `E2E Golden Path ${Date.now().toString(36)}`;

  await test.step('generate a song from AN IDEA', async () => {
    await page.goto('/');
    // The header badge's popover lists each model; hovering it opens the list.
    await page.getByRole('button', { name: /^Model status/ }).hover();
    const acestepRow = page.getByRole('dialog', { name: 'Model status' }).locator('.model-status-row', { hasText: 'ACE-STEP 1.5' });
    await expect(acestepRow).toContainText('ONLINE');
    await page.mouse.move(0, 400);
    // CREATE on an empty box opens Create without asking the LM for a sample first.
    await page.getByRole('button', { name: 'CREATE', exact: true }).click();
    // A fresh draft starts from AN IDEA (text2music).
    await expect(page.getByRole('button', { name: /^AN IDEA/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByPlaceholder('New song').fill(TITLE);
    await page.getByPlaceholder('Describe it — style, mood, instruments').fill('lofi piano with soft drums');
    await page.getByRole('button', { name: 'GENERATE', exact: true }).click();

    // The pinned GeneratingCard is a `.row` with the title too: wait for the saved song's row.
    const row = page.locator('.library .row:not(.generating)', { hasText: TITLE });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.library .row.generating')).toHaveCount(0, { timeout: 30_000 });
    expect((await lastTaskOfType(request, 'text2music')).params.prompt).toBe('lofi piano with soft drums');
  });

  await test.step('Activity lists it as DONE; the Ctrl K palette opens it by title', async () => {
    await page.getByRole('button', { name: /^ACTIVITY/ }).click();
    const drawer = page.getByRole('complementary', { name: 'Activity' });
    // One row for the song: DONE, with nothing for it left under RUNNING.
    const rows = drawer.locator('.activity-job', { hasText: TITLE });
    await expect(rows).toHaveCount(1);
    const done = rows.filter({ hasText: 'GENERATED' });
    await expect(done).toBeVisible();
    await expect(done.getByRole('button', { name: 'OPEN' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.keyboard.press('Control+k');
    await page.getByRole('dialog', { name: 'Command palette' }).getByRole('textbox').fill(TITLE);
    await page.keyboard.press('Enter');
    await expect(page.locator('.title-row .song-title')).toHaveText(TITLE);
    await expect(page.locator('.title-row .meta')).toContainText('1 layer');
  });

  await test.step('repaint 0:02–0:08 of the base layer', async () => {
    await dragRegion(page, '.layer-lane >> nth=0 >> .lane-waveform canvas', DURATION, 2.5, 8.5);
    const dock = page.getByRole('region', { name: 'Action dock' });
    await expect(dock.locator('.dock-target')).toHaveText('BASE · 0:02–0:08');
    await dock.getByRole('tab', { name: 'REPAINT' }).click(); // nothing is open on entry
    await expect(dock.getByText('Saves base v2 over 0:02–0:08')).toBeVisible();
    await dock.getByPlaceholder('Describe what should change in the selected region').fill('add a bright synth lead');
    await dock.getByRole('button', { name: 'REPAINT 0:02–0:08' }).click();

    const current = page.locator('.versions .version.current');
    await expect(current).toContainText('0:02–0:08', { timeout: 30_000 });
    await expect(current).toContainText('add a bright synth lead');
    const repaint = await lastTaskOfType(request, 'repaint');
    expect(repaint.hadSrcAudio).toBe(true);
    expect(Number(repaint.params.repainting_start)).toBeCloseTo(2.5, 0);
    expect(Number(repaint.params.repainting_end)).toBeCloseTo(8.5, 0);
  });

  await test.step('add a layer', async () => {
    const dock = page.getByRole('region', { name: 'Action dock' });
    await dock.getByRole('tab', { name: 'ADD LAYER' }).click();
    const addLayer = dock.getByRole('tabpanel', { name: 'ADD LAYER' });
    await expect(dock.locator('.dock-target')).toHaveText('WHOLE SONG');
    await addLayer.getByPlaceholder(/Describe what to add/).fill('warm bass line');
    await addLayer.getByRole('button', { name: 'ADD LAYER', exact: true }).click();

    await expect(page.locator('.title-row .meta')).toContainText('2 layers', { timeout: 30_000 });
    await expect(page.locator('.layer-lane')).toHaveCount(2);
    const lego = await lastTaskOfType(request, 'lego');
    expect(lego.hadSrcAudio).toBe(true);
    expect(lego.params.prompt).toBe('warm bass line');
  });

  await test.step('revert the base layer to its first take', async () => {
    // Focus the base lane (the new layer may have taken focus), then SEL its first take.
    await page.locator('.layer-lane >> nth=0 >> .lane-controls').click();
    const firstTake = page.locator('.versions .version', { hasText: 'first generation' });
    // `version-enter` stays on every row (it only plays the glow), and toHaveClass retries, so a
    // miss here means the revert itself went wrong: say which part — no request, a failed one,
    // or a UI that didn't show what the server saved.
    const activate = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith('/activate'));
    await firstTake.getByRole('button', { name: 'SEL' }).click();
    const sent = await activate;
    const answered = await sent.response();
    expect(answered?.status(), `activate failed: ${sent.failure()?.errorText ?? 'no response'}`).toBe(200);
    await expect(page.locator('.versions .error')).toHaveCount(0);
    await expect(firstTake).toHaveClass(/\bcurrent\b/);
    await expect(page.locator('.versions .version.current')).toHaveCount(1);

    const base = (await songByTitle(request, TITLE)).layers.find((l) => l.kind === 'base')!;
    expect(base.versions).toHaveLength(2);
    expect(activeVersion(base).label).toBe('first generation');
  });

  await test.step('export: the mix, stems, then a remaster of the mix', async () => {
    const dock = page.getByRole('region', { name: 'Action dock' });
    await page.keyboard.press('e');
    const exportPanel = dock.getByRole('tabpanel', { name: 'EXPORT' });
    await expect(dock.getByRole('tab', { name: 'EXPORT' })).toHaveAttribute('aria-selected', 'true');

    // MIX is a client-side bounce of what you hear: a WAV named after the song.
    const [mix] = await Promise.all([
      page.waitForEvent('download'),
      exportPanel.getByRole('button', { name: 'DOWNLOAD MIX' }).click(),
    ]);
    expect(mix.suggestedFilename()).toBe(`${TITLE}.wav`);
    const mixBytes = await downloadBytes(mix);
    expect(mixBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(mixBytes.subarray(8, 12).toString('ascii')).toBe('WAVE');

    await exportPanel.getByRole('radio', { name: 'STEMS' }).click();
    const stems = exportPanel.locator('.stem-row');
    await expect(stems).toHaveCount(2);

    // The base stem is whatever is active now — the reverted first take, byte for byte.
    const song = await songByTitle(request, TITLE);
    const base = song.layers.find((l) => l.kind === 'base')!;
    const [stem] = await Promise.all([
      page.waitForEvent('download'),
      stems.filter({ hasText: base.name }).getByRole('link', { name: 'DOWNLOAD' }).click(),
    ]);
    expect(stem.suggestedFilename()).toMatch(new RegExp(`^${TITLE} - ${base.name}\\.`));
    const served = await (await request.get(`/audio/${activeVersion(base).audio_file}`)).body();
    expect((await downloadBytes(stem)).equals(served)).toBe(true);

    await exportPanel.getByRole('radio', { name: 'REMASTERED MIX' }).click();
    await exportPanel.getByRole('button', { name: 'REMASTER MIX' }).click();
    const remasterLink = exportPanel.getByRole('link', { name: 'DOWNLOAD', exact: true });
    await expect(remasterLink).toBeVisible({ timeout: 30_000 });
    expect((await lastTaskOfType(request, 'cover')).hadSrcAudio).toBe(true);
    const [remaster] = await Promise.all([page.waitForEvent('download'), remasterLink.click()]);
    expect(remaster.suggestedFilename()).toMatch(/^remaster\./);
    expect((await downloadBytes(remaster)).length).toBeGreaterThan(1000);
  });
});
