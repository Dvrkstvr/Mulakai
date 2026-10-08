/** The chat spec's handles (F-051): the CHAT screen, the composer, the draft thread and the fake yue-server's splices. */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { SCORE_PORTS } from '../ports';
import type { SpliceName } from '../fake-score/splices';
import { viewButton } from './scoreFakes';

const YUE = `http://127.0.0.1:${SCORE_PORTS.yue}`;
const OLLAMA = `http://127.0.0.1:${SCORE_PORTS.ollama}`;

/** Scripts the fake Ollama (fake-score/ollama.ts): its next answers, its lyrics calls' answers (LD), offline (`down`),
 * or answers held (`hold`). */
export async function scriptChat(request: APIRequestContext, script: { replies?: Array<string | { hang: true }>; lyrics?: string[]; down?: boolean; hold?: boolean }) {
  const res = await request.post(`${OLLAMA}/__fake/planner`, { data: script });
  expect(res.ok()).toBe(true);
}

/** The app starts on the Library (D-119); CHAT is one click away while the chat is configured. */
export async function openChat(page: Page): Promise<void> {
  await page.goto('/');
  await expect(viewButton(page, 'LIBRARY')).toHaveAttribute('aria-current', 'page');
  await viewButton(page, 'CHAT').click();
  await expect(composer(page)).toBeVisible();
}

export const composer = (page: Page) => page.getByRole('textbox', { name: 'Message' });

/** Types a message and presses SEND ↵, as a person would. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  await composer(page).fill(text);
  await page.getByRole('button', { name: 'SEND ↵' }).click();
}

/** The thread's last line under a message: THINKING…, CANCELLED, ASSISTANT OFF. */
export const jobLine = (page: Page) => page.locator('.chat-thread .chat-job').last();

export interface DraftThread { id: string; songId: string | null; draft: { rev: number; fields: Record<string, unknown> } }

export async function draftThread(request: APIRequestContext): Promise<DraftThread> {
  return (await (await request.get('/api/chat/draft')).json()) as DraftThread;
}

/** A hand edit of the draft through the route the FORM sidebar saves through (PUT …/draft with its rev). */
export async function editDraft(request: APIRequestContext, fields: Record<string, unknown>): Promise<string[]> {
  const thread = await draftThread(request);
  const res = await request.put(`/api/chat/threads/${thread.id}/draft`, { data: { fields, rev: thread.draft.rev } });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { blockers: string[] }).blockers;
}

/** Which recorded splice outcome the fake yue-server replays next, and every spec submitted so far. */
export async function scriptSplice(request: APIRequestContext, fixture?: SpliceName): Promise<Array<Record<string, unknown>>> {
  const res = await request.post(`${YUE}/__fake/splice`, { data: fixture ? { fixture } : {} });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { specs: Array<Record<string, unknown>> }).specs;
}
