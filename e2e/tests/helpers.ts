import fs from 'node:fs/promises';
import { expect, type APIRequestContext, type Download, type Page } from '@playwright/test';
import { PORTS } from '../ports';

export interface FakeTask {
  id: string;
  params: Record<string, string>;
  hadSrcAudio: boolean;
}

/** What the fake ACE-Step has received so far, oldest first (see fake-acestep/server.ts). */
export async function fakeTasks(request: APIRequestContext): Promise<FakeTask[]> {
  const res = await request.get(`http://127.0.0.1:${PORTS.fake}/__fake/tasks`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as FakeTask[];
}

/** While held, every fake task keeps reporting "running" (see fake-acestep/server.ts). */
export async function holdFake(request: APIRequestContext, hold: boolean): Promise<void> {
  const res = await request.post(`http://127.0.0.1:${PORTS.fake}/__fake/hold`, { data: { hold } });
  expect(res.ok()).toBe(true);
}

export async function lastTaskOfType(request: APIRequestContext, taskType: string): Promise<FakeTask> {
  const task = (await fakeTasks(request)).filter((t) => t.params.task_type === taskType).at(-1);
  expect(task, `fake ACE-Step received no ${taskType} task`).toBeTruthy();
  return task as FakeTask;
}

interface SongVersion { id: string; audio_file: string; label: string | null; active: boolean | number }
interface SongLayer { id: string; name: string; kind: string; versions: SongVersion[] }
export interface SongDetail { id: string; title: string; layers: SongLayer[] }

/** The server's view of a song, looked up by title through the client's own /api proxy. */
export async function songByTitle(request: APIRequestContext, title: string): Promise<SongDetail> {
  const list = (await (await request.get('/api/songs')).json()) as Array<{ id: string; title: string }>;
  const song = list.find((s) => s.title === title);
  expect(song, `no song titled ${title}`).toBeTruthy();
  return (await (await request.get(`/api/songs/${song!.id}`)).json()) as SongDetail;
}

export function activeVersion(layer: SongLayer): SongVersion {
  const active = layer.versions.find((v) => !!v.active);
  expect(active, `layer ${layer.name} has no active version`).toBeTruthy();
  return active as SongVersion;
}

/** Drag across a waveform canvas from `fromSec` to `toSec`, given the song's duration. */
export async function dragRegion(page: Page, canvasSelector: string, duration: number, fromSec: number, toSec: number) {
  const box = await page.locator(canvasSelector).boundingBox();
  if (!box) throw new Error(`${canvasSelector} is not visible`);
  const y = box.y + box.height / 2;
  const x = (sec: number) => box.x + (sec / duration) * box.width;
  await page.mouse.move(x(fromSec), y);
  await page.mouse.down();
  await page.mouse.move(x((fromSec + toSec) / 2), y, { steps: 5 });
  await page.mouse.move(x(toSec), y, { steps: 5 });
  await page.mouse.up();
}

export async function downloadBytes(download: Download): Promise<Buffer> {
  const file = await download.path();
  return fs.readFile(file);
}
