/** The SCORE spec's handles on its fakes (e2e/fake-score) and its seeded song. */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { SCORE_PORTS } from '../ports';
import { recordedSong } from '../fake-score/contracts';

const OLLAMA = `http://127.0.0.1:${SCORE_PORTS.ollama}`;
const YUE = `http://127.0.0.1:${SCORE_PORTS.yue}`;

export type PlannerReply = string | { hang: true };

/** Scripts the fake planner: its next chat answers, and whether it is down (see fake-score/ollama.ts). */
export async function scriptPlanner(request: APIRequestContext, script: { replies?: PlannerReply[]; down?: boolean }): Promise<void> {
  const res = await request.post(`${OLLAMA}/__fake/planner`, { data: script });
  expect(res.ok()).toBe(true);
}

export interface PlannerSeen { method: string; path: string; keepAlive?: unknown; at: number }

export async function plannerLog(request: APIRequestContext): Promise<{ loaded: string | null; seen: PlannerSeen[] }> {
  return (await (await request.get(`${OLLAMA}/__fake/planner`)).json()) as { loaded: string | null; seen: PlannerSeen[] };
}

/** The bodies every YuE2 submit carried, oldest first. */
export async function yueJobs(request: APIRequestContext): Promise<Array<{ id: string; body: Record<string, unknown> }>> {
  return (await (await request.get(`${YUE}/__fake/jobs`)).json()) as Array<{ id: string; body: Record<string, unknown> }>;
}

/**
 * A SCORE-eligible song, made the way a person makes one: a YuE2 first take through the server's
 * own engine route. The fake yue-server answers it with the recorded song's score as the sidecar,
 * and the prompt and lyrics are the recorded ones, so every score call matches a contract fixture.
 */
export async function seedYue2Song(request: APIRequestContext, title: string): Promise<string> {
  const song = recordedSong();
  const res = await request.post('/api/engines/yue2/generate', { data: { title, prompt: song.style, lyrics: song.lyrics } });
  expect(res.status(), await res.text()).toBe(202);
  const find = async () => ((await (await request.get('/api/songs')).json()) as Array<{ id: string; title: string }>).find((s) => s.title === title);
  await expect.poll(async () => (await find())?.id, { timeout: 30_000 }).toBeTruthy();
  return (await find())!.id;
}

/** Opens a song in the Editor by title through the Ctrl K palette, as a person would. */
export async function openSong(page: Page, title: string): Promise<void> {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('textbox').fill(title);
  await page.keyboard.press('Enter');
  await expect(page.locator('.title-row .song-title')).toHaveText(title);
}
