/** C2's copy (chat-lyrics.html LY-3/LY-4/LY-6, chat-create.html CH-5, scope.md "C2"): the panel's titles and lines, the
 * revised card's header, the bar map's words and UNDO TURN's after-line. */
import { describe, it, expect } from 'vitest';
import {
  failedLine, linesText, moreLine, panelAside, panelName, panelTitle, partHeader, revisedHeader, supersededBody, undoneLine,
  undoRefusedLine, NO_LYRICS, PROPOSED, UNDO_TURN, UNTIMED_LINE,
} from './chatConvergeCopy';
import type { PanelSection } from './api/chatConverge';

const sec = (strip: number, label: string, occurrence: number, bars: [number, number], seconds: [number, number] | null = null): PanelSection =>
  ({ strip, label, occurrence, bars, seconds, block: null, lines: [] });
const ALL = [sec(1, 'Intro', 1, [1, 8]), sec(2, 'Chorus', 1, [9, 16]), sec(3, 'Chorus', 2, [41, 48], [96, 115])];

describe('panel names and lines', () => {
  it('numbers a label only when it occurs more than once', () => {
    expect(panelName(ALL[0], ALL)).toBe('INTRO');
    expect(panelName(ALL[2], ALL)).toBe('CHORUS 2');
  });

  it('counts lines, NONE when a section has none', () => {
    expect(linesText(4)).toBe('4 LINES');
    expect(linesText(1)).toBe('1 LINE');
    expect(linesText(0)).toBe('NONE');
  });

  it('a part header: name, bars and start time; a part-marked one says how many of its bars', () => {
    expect(partHeader(ALL[2], ALL, null)).toBe('CHORUS 2 · BARS 41–48 · 1:36');
    expect(partHeader(ALL[1], ALL, null)).toBe('CHORUS 1 · BARS 9–16');
    expect(partHeader(ALL[2], ALL, 2)).toBe('CHORUS 2 · 2 OF 8 BARS');
  });

  it('the lines left out and the untimed ones', () => {
    expect(moreLine(3, 'VERSE 3')).toBe('3 MORE LINES IN VERSE 3 ARE NOT MARKED');
    expect(moreLine(1, 'VERSE 3')).toBe('1 MORE LINE IN VERSE 3 IS NOT MARKED');
    expect(UNTIMED_LINE).toMatch(/NOT TIMED/);
    expect(PROPOSED).toBe('PROPOSED');
  });
});

describe('panel title and aside per state', () => {
  it('no mark: the line count, CLICK TO MARK', () => {
    expect(panelTitle({ kind: 'list', lines: 32 })).toBe('LYRICS · 32 LINES');
    expect(panelAside({ kind: 'list' })).toBe('CLICK TO MARK');
  });

  it('one section: its name; a line of it: n OF m LINES; several: sections and lines', () => {
    expect(panelTitle({ kind: 'marked', parts: ['CHORUS 2'], lines: 4 })).toBe('LYRICS · CHORUS 2');
    expect(panelAside({ kind: 'marked', markedLines: null, of: 4 })).toBe('◂ ALL SECTIONS');
    expect(panelAside({ kind: 'marked', markedLines: 1, of: 4 })).toBe('1 OF 4 LINES');
    expect(panelTitle({ kind: 'marked', parts: ['CHORUS 1', 'VERSE 3'], lines: 5 })).toBe('LYRICS · 2 SECTIONS · 5 LINES');
  });

  it('reading, failed, none', () => {
    expect(panelTitle({ kind: 'reading', version: 5 })).toBe('LYRICS · READING v5…');
    expect(panelAside({ kind: 'reading' })).toBe('MARKS BY BARS');
    expect(panelTitle({ kind: 'failed' })).toBe('LYRICS · NOT READ');
    expect(failedLine(5, 'lyrics-server did not answer in 60 s')).toBe("COULDN'T READ v5 · lyrics-server did not answer in 60 s");
    expect(failedLine(null, 'boom')).toBe("COULDN'T READ IT · boom");
    expect(panelTitle({ kind: 'none' })).toBe('LYRICS · NONE');
    expect(panelAside({ kind: 'none' })).toBe('INSTRUMENTAL');
    expect(NO_LYRICS.title).toBe('NO LYRICS IN THIS VERSION');
    expect(NO_LYRICS.action).toBe('ASK THE CHAT');
  });
});

describe('the revised card', () => {
  it('REVISED · PLAN n from the second plan on; nothing for a first plan or an old card', () => {
    expect(revisedHeader(2)).toBe('REVISED · PLAN 2');
    expect(revisedHeader(1)).toBeNull();
    expect(revisedHeader(undefined)).toBeNull();
  });

  it('a card revised below says so; one replaced by a fresh plan keeps C0b’s line', () => {
    expect(supersededBody(true)).toMatch(/^Revised below/);
    expect(supersededBody(false)).toBe('A newer edit card is below. This one cannot be applied.');
  });
});

describe('UNDO TURN', () => {
  it('names what it restored and what it kept, with the reason', () => {
    expect(UNDO_TURN).toBe('UNDO TURN');
    expect(undoneLine(['title', 'style'], [{ field: 'lyrics', reason: 'you changed it' }])).toBe('restored TITLE, STYLE · kept LYRICS: you changed it');
    expect(undoneLine(['bpm'], [])).toBe('restored TEMPO');
    expect(undoneLine([], [{ field: 'title', reason: 'you changed it' }, { field: 'key', reason: 'a later turn changed it' }]))
      .toBe('restored nothing · kept TITLE: you changed it; KEY: a later turn changed it');
  });

  it('a refusal says nothing changed', () => {
    expect(undoRefusedLine('a turn is running')).toBe("Couldn't undo: a turn is running. Nothing changed.");
  });
});
