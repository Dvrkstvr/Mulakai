/** SCORE's copy (design/score-verb.html; F-021 #2, #3, F-022 #1, F-024 #1). */
import { describe, it, expect } from 'vitest';
import {
  checksSegments, consequenceLine, jobLine, offlineLines, opRows, planHeader, readingLine, rowDetail, chordName, renderModeClause, ASKING_CONSEQUENCE,
} from './scoreCopy';
import type { ScoreOp, ScorePlan } from './api';

const plan = (ops: ScoreOp[], over: Partial<ScorePlan> = {}): ScorePlan => ({
  id: 'p', songId: 's', baseVersionId: 'v2', request: 'r', ops,
  verdicts: ops.map((o, i) => ({ index: i + 1, op: o.op, ok: true, reason: null })), style: 'dark pop, jazz, 88 bpm',
  checks: { bars: 65, seconds: 183, tokens: 1520, chordsPresent: true, changed: { abc: true, style: true } }, attempts: 1, refusals: [], createdAt: 1, ...over,
});
const TEMPO: ScoreOp = { op: 'SET_TEMPO', bpm: 88 };
const REHARM: ScoreOp = { op: 'REHARMONIZE', from_bar: 17, to_bar: 24, chords: [
  { bar: 17, beat: 1, root: 'A', quality: 'm7' }, { bar: 19, beat: 1, root: 'D', quality: '7' },
  { bar: 21, beat: 1, root: 'G', quality: 'maj7' }, { bar: 23, beat: 1, root: 'C', quality: 'maj', bass: 'E' }] };
const STYLE: ScoreOp = { op: 'EDIT_STYLE', style: 'pop, jazz, 87 bpm' };
const BAR = [{ pitch: 'D', beats: 2 }, { pitch: 'F', beats: 2 }];
const PHRASE: ScoreOp = { op: 'WRITE_PHRASE', start_bar: 57, instrument: 'tenor saxophone', bars: [BAR, BAR, BAR, BAR] };
const versions = { baseVersion: 2, versions: 2 };

describe('consequence line, composed from the plan (F-021 #3, D-031)', () => {
  it('a SET TEMPO-only plan says tempo follows and has no "request, not a guarantee" clause', () => {
    const line = consequenceLine(plan([TEMPO]), versions, 0);
    expect(line).toBe('Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different · tempo follows 88 BPM · v2 stays in VERSIONS');
    expect(line).not.toMatch(/request/);
  });

  it('REHARMONIZE and EDIT STYLE are a request to YuE2, not a guarantee; every bar will sound different', () => {
    expect(consequenceLine(plan([TEMPO, REHARM, STYLE]), versions, 0)).toBe('Saves base v3 · re-renders the whole song on YuE2, about 3 min · '
      + 'every bar will sound different · tempo follows 88 BPM · harmony in bars 17–24 and the style change are a request to YuE2, '
      + 'not a guarantee · v2 stays in VERSIONS');
    expect(consequenceLine(plan([REHARM]), versions, 2)).toContain('harmony in bars 17–24 is a request to YuE2, not a guarantee · v2 stays in VERSIONS · starts after 2 jobs');
    expect(consequenceLine(plan([STYLE]), versions, 0)).toContain('the style change is a request to YuE2, not a guarantee');
  });

  it('names the render mode on a chord-free score; a score with chords keeps its line (F-065, D-132)', () => {
    const melody = consequenceLine(plan([TEMPO], { renderMode: { cot: 'melody', reason: 'melody' } }), versions, 0);
    expect(melody).toBe('Saves base v3 · re-renders the whole song on YuE2, about 3 min · renders the melody only, no chords · '
      + 'every bar will sound different · tempo follows 88 BPM · v2 stays in VERSIONS');
    const adds = consequenceLine(plan([REHARM], { renderMode: { cot: 'full', reason: 'reharmonize' } }), versions, 0);
    expect(adds).toContain('about 3 min · adds chords: the whole song renders with chords · every bar');
    expect(renderModeClause({ cot: 'full', reason: 'chords' })).toBeNull();
    expect(consequenceLine(plan([TEMPO], { renderMode: { cot: 'full', reason: 'chords' } }), versions, 0))
      .toBe(consequenceLine(plan([TEMPO]), versions, 0));
  });

  it('WRITE PHRASE names the instrument and its bars as a request, not a guarantee (F-026 #2, D-031 wording)', () => {
    expect(consequenceLine(plan([PHRASE]), versions, 0)).toBe('Saves base v3 · re-renders the whole song on YuE2, about 3 min · '
      + 'every bar will sound different · the tenor saxophone phrase replaces the instrument part in bars 57–60 and is a request to YuE2, '
      + 'not a guarantee · v2 stays in VERSIONS');
    expect(consequenceLine(plan([TEMPO, REHARM, STYLE, PHRASE]), versions, 0)).toContain('tempo follows 88 BPM · harmony in bars 17–24 '
      + 'and the style change are a request to YuE2, not a guarantee · the tenor saxophone phrase replaces the instrument part in bars 57–60 '
      + 'and is a request to YuE2, not a guarantee · v2 stays in VERSIONS');
  });

  it('asking states that nothing changes yet, and when it starts on a busy GPU', () => {
    expect(ASKING_CONSEQUENCE).toBe('asks the planner · uses the GPU for ~10 s · changes nothing yet');
  });
});

describe('change list rows', () => {
  it('one row per op with its verdict and tag; the rejected op keeps its reason', () => {
    const p = plan([TEMPO, REHARM, STYLE]);
    p.verdicts[1] = { index: 2, op: 'REHARMONIZE', ok: false, reason: 'bar 20 had 30/32 units' };
    expect(opRows(p, 'dark, pop, 87 bpm', 87)).toEqual([
      { ok: true, name: 'SET TEMPO', detail: '87 → 88 BPM · whole song', tag: 'follows', reason: null, note: null, diff: null },
      { ok: false, name: 'REHARMONIZE', detail: 'bars 17–24 · Am7 D7 Gmaj7 C/E', tag: 'a request', reason: 'bar 20 had 30/32 units', note: null, diff: null },
      { ok: true, name: 'EDIT STYLE', detail: '+ jazz · − dark', tag: 'a request', reason: null, note: null, diff: null },
    ]);
  });

  it('WRITE PHRASE: instrument, bars and count, the style tag code added, and a refusal with its free bars (F-026)', () => {
    const p = plan([PHRASE], { style: 'dark pop, 90 bpm, female vocal, tenor saxophone' });
    expect(opRows(p, 'dark pop, 90 bpm, female vocal', 87)).toEqual([
      { ok: true, name: 'WRITE PHRASE', detail: 'tenor saxophone · bars 57–60 · 4 bars · style + tenor saxophone', tag: 'a request', reason: null, note: null, diff: null },
    ]);
    // the style already named it: nothing is added, so nothing is claimed
    expect(opRows(plan([PHRASE], { style: 'jazz, tenor saxophone' }), 'jazz, tenor saxophone', 87)[0].detail).toBe('tenor saxophone · bars 57–60 · 4 bars');
    // an EDIT STYLE in the same plan is what code appended to, not the stored style
    const withStyle = plan([{ op: 'EDIT_STYLE', style: 'jazz, tenor saxophone' }, PHRASE], { style: 'jazz, tenor saxophone' });
    expect(opRows(withStyle, 'pop', 87)[1].detail).toBe('tenor saxophone · bars 57–60 · 4 bars');
    const refused = plan([{ ...PHRASE, start_bar: 9, bars: [BAR, BAR] }]);
    refused.verdicts[0] = { index: 1, op: 'WRITE_PHRASE', ok: false, reason: 'the Vocal sings in bars 11-12; free: 1-10, 47-65' };
    const [row] = opRows(refused, 'pop', 87);
    expect(rowDetail(row)).toBe('tenor saxophone · bars 9–10 · 2 bars · rejected: the Vocal sings in bars 11-12; free: 1-10, 47-65');
  });

  it('a prose style or a rewrite reads as the new style, clipped, not a tag diff', () => {
    const prose = 'A moody, atmospheric dream-pop trip-hop track built on a foundation of a deep sub-bass and a crisp, lo-fi drum machine beat';
    const rewrite: ScoreOp = { op: 'EDIT_STYLE', style: 'jazz trio, brushed drums, upright bass, smoky late-night club feel with a soft female vocal, 88 bpm' };
    const [row] = opRows(plan([rewrite]), prose, 87);
    expect(row.detail).toBe('→ jazz trio, brushed drums, upright bass, smoky late-night club feel with a soft…');
  });

  it('chord names use upstream spellings; major has no suffix', () => {
    expect(chordName({ bar: 1, beat: 1, root: 'F#', quality: 'm7b5' })).toBe('F#m7b5');
    expect(chordName({ bar: 1, beat: 1, root: 'Bb', quality: 'maj' })).toBe('Bb');
  });

  it('the header names the count and the version planned against', () => {
    expect(planHeader(plan([TEMPO, REHARM, STYLE]), 2)).toBe('PLAN · 3 CHANGES · AGAINST BASE v2');
    expect(planHeader(plan([TEMPO]), 1)).toBe('PLAN · 1 CHANGE · AGAINST BASE v1');
  });
});

describe('checks line (F-021 #2, F-022 #1)', () => {
  it('bars, seconds of 360, tokens of 4,096, chords, attempt', () => {
    expect(checksSegments(plan([TEMPO]).checks, 1).map((s) => s.text).join(' · '))
      .toBe('65 bars · est 183 s of 360 s · 1,520 of 4,096 tokens · chords valid · attempt 1 of 3');
  });

  it('turns the seconds rust above 330 s, and the chords when invalid', () => {
    const segs = checksSegments({ ...plan([TEMPO]).checks, seconds: 340.4, chordsPresent: false }, 2);
    expect(segs.filter((s) => s.warn).map((s) => s.text)).toEqual(['est 340 s of 360 s', 'chords invalid']);
    expect(checksSegments({ ...plan([TEMPO]).checks, seconds: 330 }, 1).some((s) => s.warn)).toBe(false);
  });

  it('a chord-free plan that renders the melody reads "no chords", not rust (F-065, D-132)', () => {
    const free = { ...plan([TEMPO]).checks, chordsPresent: false };
    const segs = checksSegments(free, 1, { cot: 'melody', reason: 'melody' });
    expect(segs.find((s) => s.text.startsWith('no chords'))).toEqual({ text: 'no chords · melody render', warn: false });
    expect(checksSegments(free, 1, { cot: 'full', reason: 'chords' }).find((s) => s.warn)?.text).toBe('chords invalid');
  });
});

describe('reading, job and offline lines', () => {
  it('reads the score in text-low', () => {
    expect(readingLine({ bars: 65, seconds: 183.2, bpm: 87, key: 'Am', meter: '4/4', tokens: 1520 })).toBe('65 bars · 4/4 · Q:87 · key Am · est 183 s · 1,520 tokens');
  });

  it('queued, planning (with the retry reason) and cancelling', () => {
    expect(jobLine({ kind: 'queued', ahead: 2 })).toBe('PLANNING · QUEUED · STARTS AFTER 2 JOBS');
    expect(jobLine({ kind: 'planning', attempt: 2, note: 'bar 5 had 31/32 units', cancelling: false })).toBe('PLANNING… attempt 2 of 3 · bar 5 had 31/32 units');
    expect(jobLine({ kind: 'planning', attempt: 1, note: null, cancelling: true })).toBe('CANCELLING… unloading the planner before the GPU is free');
  });

  it('PLANNER OFFLINE names the cause and the fix (F-024 #1)', () => {
    expect(offlineLines({ kind: 'offline', source: 'planner', reason: 'planner offline: no answer from http://127.0.0.1:11435 (fetch failed)' })).toEqual({
      title: 'PLANNER OFFLINE', body: 'planner offline: no answer from http://127.0.0.1:11435 (fetch failed)', fix: 'Start Ollama, then RECHECK. Request kept, nothing saved, GPU free.',
    });
    expect(offlineLines({ kind: 'offline', source: 'planner', reason: "model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'" }).fix)
      .toBe('Then RECHECK. Request kept, nothing saved, GPU free.');
    expect(offlineLines({ kind: 'offline', source: 'checker', reason: 'Score checker unreachable: x. Start yue-server, then RECHECK.' }).title).toBe('SCORE CHECKER OFFLINE');
  });
});
