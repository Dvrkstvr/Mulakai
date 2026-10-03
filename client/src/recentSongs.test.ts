import { describe, it, expect } from 'vitest';
import type { RecentSong } from './api';
import { describeEdit, fmtAgo, lastAction, parseDbTime } from './recentSongs';

describe('fmtAgo', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const ago = (min: number) => fmtAgo(now - min * 60_000, now);
  it('reads minutes, hours, then days', () => {
    expect(ago(0.5)).toBe('just now');
    expect(ago(12)).toBe('12 min ago');
    expect(ago(150)).toBe('2 h ago');
    expect(ago(60 * 30)).toBe('yesterday');
    expect(ago(60 * 24 * 4)).toBe('4 days ago');
  });
});

describe('parseDbTime', () => {
  it("reads SQLite's zone-less datetime as UTC", () => {
    expect(parseDbTime('2026-10-03 10:00:00')).toBe(Date.parse('2026-10-03T10:00:00Z'));
  });
});

describe('describeEdit', () => {
  it("words the server's version labels with the layer name", () => {
    expect(describeEdit('repaint 1:32–2:07', 'Vocals')).toBe('Repainted 1:32–2:07 · VOCALS');
    expect(describeEdit('alt 0:10–0:20', 'Base')).toBe('Alt take of 0:10–0:20 · BASE');
    expect(describeEdit('similar: first generation', 'Base')).toBe('Similar take of first generation · BASE');
    expect(describeEdit('split: extract vocals', 'Vocals')).toBe('Split out vocals · VOCALS');
    expect(describeEdit('add layer', 'Strings')).toBe('Added a STRINGS layer');
    expect(describeEdit('first generation', 'Base')).toBe('Generated');
  });

  it('shows an unknown label as written', () => {
    expect(describeEdit('imported', 'Base')).toBe('Imported · BASE');
  });
});

describe('lastAction', () => {
  it('joins the edit and how long ago it was', () => {
    const r = { version_label: 'repaint 1:32–2:07', layer_name: 'Vocals', edited_at: '2026-10-03 11:48:00' } as RecentSong;
    expect(lastAction(r, Date.parse('2026-10-03T12:00:00Z'))).toBe('Repainted 1:32–2:07 · VOCALS · 12 min ago');
  });
});
