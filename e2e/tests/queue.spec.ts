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

test('FEELING LUCKY waits its turn behind a running job, then fills the create bar', async ({ page, request }) => {
  await holdFake(request, true);
  try {
    const res = await request.post('/api/generate', { data: { title: `E2E Lucky ${Date.now().toString(36)}`, prompt: 'lofi piano' } });
    expect(res.status()).toBe(202);
    await page.goto('/');
    await page.getByRole('button', { name: 'FEELING LUCKY' }).click();
    await expect(page.getByText('FEELING LUCKY waits its turn · starts after 1 job')).toBeVisible();
    await expect(page.getByPlaceholder('What do you want to make?')).toHaveValue('');
  } finally {
    await holdFake(request, false);
  }
  await expect(page.getByPlaceholder('What do you want to make?')).toHaveValue('fake caption', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'FEELING LUCKY' })).toBeEnabled();
});

test('Quick Start waits its turn behind a running job, then fills the draft', async ({ page, request }) => {
  await holdFake(request, true);
  try {
    const res = await request.post('/api/generate', { data: { title: `E2E Quick ${Date.now().toString(36)}`, prompt: 'lofi piano' } });
    expect(res.status()).toBe(202);
    await page.goto('/');
    await page.getByPlaceholder('What do you want to make?').fill('rainy synthwave');
    await page.getByRole('button', { name: 'CREATE', exact: true }).click();
    await expect(page.getByText('QUICK START waits its turn · starts after 1 job')).toBeVisible();
  } finally {
    await holdFake(request, false);
  }
  // The fake writes the query back as the caption.
  await expect(page.getByPlaceholder('Describe it — style, mood, instruments')).toHaveValue('rainy synthwave', { timeout: 30_000 });
});

test("Create's GENERATE stays live while a song generates, says when it starts, and queues", async ({ page, request }) => {
  const run = Date.now().toString(36);
  const [FIRST, SECOND] = ['Running', 'Queued'].map((n) => `E2E Create ${n} ${run}`);

  await holdFake(request, true);
  try {
    const res = await request.post('/api/generate', { data: { title: FIRST, prompt: 'lofi piano' } });
    expect(res.status()).toBe(202);

    await page.goto('/');
    await page.getByRole('button', { name: 'CREATE', exact: true }).click();
    await page.getByPlaceholder('New song').fill(SECOND);
    await page.getByPlaceholder('Describe it — style, mood, instruments').fill('dusty boom bap');
    const commit = page.getByRole('button', { name: 'GENERATE', exact: true });
    await expect(commit).toBeEnabled();
    await expect(page.locator('.recipe-commit .queue-note')).toHaveText('waits its turn · starts after 1 job');
    await commit.click();

    // Back in the Library: one card per generation, the second waiting its turn.
    const cards = page.locator('.library .row.generating');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: SECOND })).toContainText('QUEUED · STARTS AFTER 1 JOB');
    await expect(cards.filter({ hasText: FIRST })).toContainText('GENERATING');
  } finally {
    await holdFake(request, false);
  }

  const titles = async () => ((await (await request.get('/api/songs')).json()) as Array<{ title: string }>).map((s) => s.title);
  await expect.poll(titles, { timeout: 30_000 }).toEqual(expect.arrayContaining([FIRST, SECOND]));
  await expect(page.locator('.library .row.generating')).toHaveCount(0);
});
