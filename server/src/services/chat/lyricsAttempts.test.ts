import { describe, it, expect, vi } from 'vitest';
import { writeLyrics } from './lyricsAttempts.js';
import { lyricsMessages, lyricsSchema } from './lyricsPrompt.js';
import type { ChatMessage, PlannerReply } from '../score/planTypes.js';

const INPUT = {
  request: 'ein ruhiges Lied über den Herbst', title: 'Herbstlicht', style: 'acoustic folk', bpm: 84, language: 'de',
  structure: ['Intro', 'Verse', 'Chorus'],
};
const VERSE = ['Der Wind trägt Blätter durch die Gassen', 'Das Licht wird golden, still und weich', 'Ich halte fest, was wir nicht lassen', 'Und jeder Tag wird sanft und gleich'];
const CHORUS = ['Herbstlicht, bleib noch ein wenig hier', 'Herbstlicht, du leuchtest nur für mich', 'Die Tage werden kurz und leise', 'Wir gehen weiter, Schritt für Schritt'];
const GOOD = JSON.stringify({ sections: [{ lines: VERSE }, { lines: CHORUS }] });
const LEAK = JSON.stringify({ sections: [{ lines: VERSE }, { lines: [...CHORUS.slice(0, 3), 'Mulakai bleibt bei mir'] }] });

const answers = (...contents: string[]) => {
  const queue = [...contents];
  return vi.fn(async (_m: ChatMessage[], _s: Record<string, unknown>): Promise<PlannerReply> => ({ content: queue.shift()!, promptTokens: 100 }));
};
const detect = async () => 'de';

describe('writeLyrics', () => {
  it('one good reply: the sections tagged by the sung structure, one attempt', async () => {
    const ask = answers(GOOD);
    const out = await writeLyrics(INPUT, { ask, detect });
    expect(out).toEqual({ ok: true, attempts: 1, lyrics: [{ tag: 'Verse', lines: VERSE }, { tag: 'Chorus', lines: CHORUS }] });
    expect(ask).toHaveBeenCalledWith(lyricsMessages(INPUT), lyricsSchema(2));
  });

  it('a refused reply is sent back with its reasons, then accepted', async () => {
    const ask = answers(LEAK, GOOD);
    const onAttempt = vi.fn();
    const out = await writeLyrics(INPUT, { ask, detect, onAttempt });
    expect(out.ok && out.attempts).toBe(2);
    const second = ask.mock.calls[1][0];
    expect(second.slice(0, 2)).toEqual(lyricsMessages(INPUT));
    expect(second[2]).toEqual({ role: 'assistant', content: LEAK });
    expect(second[3].content).toContain("- line 4 of section 2 contains 'Mulakai'");
    expect(second[3].content).toContain('Return corrected, complete lyrics as JSON only');
    expect(onAttempt.mock.calls).toEqual([[1, undefined], [2, expect.stringContaining('Mulakai')]]);
  });

  it('invalid JSON is a reason too', async () => {
    const out = await writeLyrics(INPUT, { ask: answers('{"sections": [', GOOD), detect });
    expect(out.ok && out.attempts).toBe(2);
  });

  it('gives up after maxAttempts with the last reasons', async () => {
    const ask = answers(LEAK, LEAK, LEAK);
    const out = await writeLyrics(INPUT, { ask, detect });
    expect(out).toEqual({ ok: false, attempts: 3, reasons: [expect.stringContaining("contains 'Mulakai'")] });
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('a thrown error (HTTP, cancel) ends it at once', async () => {
    const ask = vi.fn(async () => { throw new Error('cancelled'); });
    await expect(writeLyrics(INPUT, { ask, detect })).rejects.toThrow('cancelled');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('a structure with nothing sung asks nothing', async () => {
    const ask = answers();
    expect(await writeLyrics({ ...INPUT, structure: ['Intro'] }, { ask, detect })).toEqual({ ok: true, attempts: 0, lyrics: [] });
    expect(ask).not.toHaveBeenCalled();
  });
});
