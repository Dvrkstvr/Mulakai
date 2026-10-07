/** The chat spec's mark handles (F-054, F-055; CL-8b): the contract song's bar times as yue-server timed them on its
 * recorded grid (`scores-bars-contract`, `transcription-grid-contract`), the composer's chip and line, and a drag. */
import type { Page } from '@playwright/test';
import { contract } from '../fake-score/contracts';

const BARS = contract('scores-bars-contract').response.body as { starts: number[]; end: number };
export const SONG_SECONDS = (contract('transcription-grid-contract').response.body as { duration: number }).duration;
export const BAR_SECONDS = BARS.starts[1] - BARS.starts[0];

/** Bar n's start as the chip reads it (m:ss); bar 66 is the song's end. */
export function barClock(n: number): string {
  const s = Math.round([...BARS.starts, BARS.end][n - 1]);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const markChip = (page: Page) => page.getByLabel('Marked');
export const markLine = (page: Page) => page.getByLabel('Mark line');

/** Press at `x` and move to `toX` in steps (pointer events, as a person drags); the caller releases. */
export async function drag(page: Page, x: number, toX: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 6 });
}
