/**
 * The GPU job queue (PLAN.md "UI Redesign", S4): with the fake ACE-Step held, a second and third
 * generation wait behind the first, show in Activity's UP NEXT, CANCEL takes one out, and the
 * other runs once the first finishes.
 */
import { test, expect } from './fixtures';
import { holdFake } from './helpers';

test('a job submitted while another runs waits in UP NEXT, then runs', async ({ page, request }) => {
  const run = Date.now().toString(36);
  const [FIRST, SECOND, THIRD] = ['First', 'Second', 'Third'].map((n) => `E2E Queue ${n} ${run}`);
  const generate = async (title: string) => {
    const res = await request.post('/api/generate', { data: { title, prompt: 'lofi piano' } });
    expect(res.status()).toBe(202);
    return ((await res.json()) as { jobId: string }).jobId;
  };

  await holdFake(request, true);
  try {
    await generate(FIRST);
    const second = await generate(SECOND);
    await generate(THIRD);
    expect(await (await request.get(`/api/generate/${second}`)).json()).toMatchObject({ status: 'queued', queuePosition: 1 });

    await page.goto('/');
    await expect(page.getByRole('button', { name: /^ACTIVITY/ })).toContainText('1 RUNNING · 2 NEXT');
    await page.getByRole('button', { name: /^ACTIVITY/ }).click();
    const drawer = page.getByRole('complementary', { name: 'Activity' });
    await expect(drawer.locator('.activity-job', { hasText: FIRST })).toContainText('GENERATING');
    const secondRow = drawer.locator('.activity-job.queued', { hasText: SECOND });
    const thirdRow = drawer.locator('.activity-job.queued', { hasText: THIRD });
    await expect(secondRow).toContainText('starts after 1 job');
    await expect(thirdRow).toContainText('starts after 2 jobs');

    await thirdRow.getByRole('button', { name: 'CANCEL' }).click();
    await expect(thirdRow).toBeHidden();
    await expect(drawer.locator('.activity-job.queued')).toHaveCount(1);
  } finally {
    await holdFake(request, false);
  }

  // Released: the first finishes, then the second runs and lands as a song; the third never does.
  const titles = async () => ((await (await request.get('/api/songs')).json()) as Array<{ title: string }>).map((s) => s.title);
  await expect.poll(titles, { timeout: 30_000 }).toEqual(expect.arrayContaining([FIRST, SECOND]));
  expect(await titles()).not.toContain(THIRD);
  await expect(page.getByRole('complementary', { name: 'Activity' }).locator('.activity-job.queued')).toHaveCount(0);
});
