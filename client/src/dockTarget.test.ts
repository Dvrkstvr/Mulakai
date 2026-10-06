import { describe, it, expect } from 'vitest';
import { dockTarget, repaintCommitLabel, repaintConsequence, repaintLine, repaintWarnLine } from './dockTarget';
import { SCORE_ENDS } from './scoreCopy';

const SECTIONS = [
  { label: '', start: 0, end: 12 },
  { label: 'Verse 2', start: 92, end: 127 },
  { label: 'Chorus', start: 127, end: 150 },
];

describe('dockTarget', () => {
  it('names the layer, the one whole section and its range under REPAINT', () => {
    const t = dockTarget('repaint', 'vocals', { start: 92, end: 127 }, SECTIONS, 60);
    expect(t.label).toBe('VOCALS · VERSE 2 · 1:32–2:07');
    expect(t.section).toBe('VERSE 2');
    expect(t).toMatchObject({ warn: false, clearable: true });
  });

  it('leaves the section out of a range that is not exactly one section', () => {
    const t = dockTarget('repaint', 'base', { start: 95, end: 130 }, SECTIONS, 60);
    expect(t.label).toBe('BASE · 1:35–2:10');
    expect(t.section).toBeNull();
  });

  it('leaves an untagged lead-in out, since it has no name', () => {
    expect(dockTarget('repaint', 'base', { start: 0, end: 12 }, SECTIONS, 60).section).toBeNull();
  });

  it('reads the whole song with no selection, with nothing to clear', () => {
    const t = dockTarget('repaint', 'vocals', null, SECTIONS, 60);
    expect(t.label).toBe('VOCALS · WHOLE SONG');
    expect(t.clearable).toBe(false);
  });

  it('warns on a region outside the repaint range, still clearable', () => {
    expect(dockTarget('repaint', 'base', { start: 10, end: 11 }, [], 60)).toMatchObject({ label: '0:10–0:11 · MIN 3s', warn: true, clearable: true });
    expect(dockTarget('repaint', 'base', { start: 0, end: 100 }, [], 60)).toMatchObject({ label: '0:00–1:40 · MAX 90s', warn: true });
  });

  it('holds the whole song to the repaint limit by the song length', () => {
    expect(dockTarget('repaint', 'vocals', null, SECTIONS, 192)).toMatchObject({ label: 'VOCALS · WHOLE SONG · MAX 90s', warn: true, clearable: false });
    expect(dockTarget('repaint', 'vocals', null, SECTIONS, 0)).toMatchObject({ label: 'VOCALS · WHOLE SONG · LENGTH UNKNOWN', warn: true });
    expect(dockTarget('repaint', 'vocals', null, SECTIONS, 90).warn).toBe(false);
    // A song too long to repaint whole still takes a region.
    expect(dockTarget('repaint', 'vocals', { start: 92, end: 127 }, SECTIONS, 192).warn).toBe(false);
  });

  it('ignores the selection for every other verb', () => {
    const sel = { start: 92, end: 127 };
    expect(dockTarget('addLayer', 'vocals', sel, SECTIONS, 60)).toMatchObject({ label: 'WHOLE SONG', clearable: false, warn: false });
    expect(dockTarget('split', 'base', sel, SECTIONS, 60)).toMatchObject({ label: 'BASE · WHOLE LAYER', clearable: false });
    expect(dockTarget('export', 'base', sel, SECTIONS, 60)).toMatchObject({ label: 'WHOLE SONG', clearable: false });
  });

  it('SCORE always targets the whole score of the base, whatever layer is focused (DT-3)', () => {
    expect(dockTarget('score', 'vocals', { start: 92, end: 127 }, SECTIONS, 60))
      .toEqual({ label: 'BASE · WHOLE SCORE', warn: false, clearable: false, hint: 'a score edit re-renders the whole song', section: null });
  });
});

describe('repaint commit copy', () => {
  it('labels the commit by section, then range, then layer', () => {
    expect(repaintCommitLabel('vocals', { start: 92, end: 127 }, 'VERSE 2')).toBe('REPAINT VERSE 2');
    expect(repaintCommitLabel('vocals', { start: 92, end: 127 }, null)).toBe('REPAINT 1:32–2:07');
    expect(repaintCommitLabel('vocals', null, null)).toBe('REPAINT VOCALS');
  });

  it('states the version it saves and the one it keeps', () => {
    expect(repaintConsequence('VOCALS', 5, 4, { start: 92, end: 127 }, 'VERSE 2'))
      .toBe('Saves vocals v5 over VERSE 2 · v4 stays in VERSIONS · other layers untouched');
    expect(repaintConsequence('base', 2, 1, null, null))
      .toBe('Saves base v2 over the whole layer · v1 stays in VERSIONS · other layers untouched');
  });
});

describe('repaintWarnLine', () => {
  it('says why the whole layer is off, and asks for a region', () => {
    expect(repaintWarnLine(null, 192)).toBe('the whole layer is 3:12, over the 90 s repaint limit — select a region of 3–90 s');
    expect(repaintWarnLine(null, 0)).toMatch(/length isn't known/);
  });

  it('offers ✕ WHOLE SONG for a bad region only when the whole layer could be repainted', () => {
    expect(repaintWarnLine({ start: 0, end: 1 }, 60)).toBe('pick a region of 3–90 s, or ✕ WHOLE SONG to repaint the whole layer');
    expect(repaintWarnLine({ start: 0, end: 1 }, 192)).toBe('pick a region of 3–90 s');
  });
});

describe('repaintLine (F-027)', () => {
  const region = { start: 92, end: 127 };
  const input = { layerName: 'base', nextVersion: 2, activeVersion: 1, selection: region, duration: 192, ahead: 1 };
  const target = dockTarget('repaint', 'base', region, [], 192);

  it('ends with the score clause while SCORE is open, after when the job starts', () => {
    expect(repaintLine(target, { ...input, scoreOpen: true })).toEqual({
      line: 'Saves base v2 over 1:32–2:07 · v1 stays in VERSIONS · other layers untouched · starts after 1 job',
      scoreEnds: SCORE_ENDS,
    });
  });

  it('leaves it out where SCORE is hidden or ineligible (after the first repaint lands)', () => {
    expect(repaintLine(target, { ...input, ahead: 0, scoreOpen: false })).toEqual({
      line: 'Saves base v2 over 1:32–2:07 · v1 stays in VERSIONS · other layers untouched',
      scoreEnds: null,
    });
  });

  it('leaves it out while the commit is off: the line says why, and nothing would run', () => {
    const tooShort = { start: 0, end: 1 };
    const off = dockTarget('repaint', 'base', tooShort, [], 192);
    expect(repaintLine(off, { ...input, selection: tooShort, scoreOpen: true }))
      .toEqual({ line: 'pick a region of 3–90 s', scoreEnds: null });
  });
});
