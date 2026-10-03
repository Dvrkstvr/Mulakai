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

  await test.step('generate a song from the PROMPT tab', async () => {
    await page.goto('/');
    // The header badge's popover lists each model; hovering it opens the list.
    await page.getByRole('button', { name: /^Model status/ }).hover();
    const acestepRow = page.getByRole('dialog', { name: 'Model status' }).locator('.model-status-row', { hasText: 'ACE-STEP 1.5' });
    await expect(acestepRow).toContainText('ONLINE');
    await page.mouse.move(0, 400);
    // CREATE on an empty box opens Create without asking the LM for a sample first.
    await page.getByRole('button', { name: 'CREATE', exact: true }).click();
    await page.getByPlaceholder('Title').fill(TITLE);
    await page.getByPlaceholder('Describe it — style, mood, instruments').fill('lofi piano with soft drums');
    await page.getByRole('button', { name: 'GENERATE', exact: true }).click();

    const row = page.locator('.library .row', { hasText: TITLE });
    await expect(row).toBeVisible({ timeout: 30_000 });
    expect((await lastTaskOfType(request, 'text2music')).params.prompt).toBe('lofi piano with soft drums');
    await row.getByRole('button', { name: 'EDIT' }).click();
    await expect(page.locator('.title-row .song-title')).toHaveText(TITLE);
    await expect(page.locator('.title-row .meta')).toContainText('1 layer');
  });

  await test.step('repaint 0:02–0:08 of the base layer', async () => {
    await dragRegion(page, '.layer-lane >> nth=0 >> .lane-waveform canvas', DURATION, 2.5, 8.5);
    const dock = page.getByRole('region', { name: 'Action dock' });
    await expect(dock.locator('.dock-target')).toHaveText('BASE · 0:02–0:08');
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
    await firstTake.getByRole('button', { name: 'SEL' }).click();
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
