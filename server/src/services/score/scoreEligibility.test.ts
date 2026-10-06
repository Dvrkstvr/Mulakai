import { describe, it, expect } from 'vitest';
import { decideEligibility, recheckAtCommit, CHANGED_SINCE_PLAN, type EligibilityFacts } from './scoreEligibility.js';
import type { ScoreSource } from './scoreSource.js';
import type { ScoreRead } from './yueScoreRead.js';

const source = (over: Partial<ScoreSource> = {}): ScoreSource => ({
  songId: 's1',
  engine: 'yue2',
  genTask: 'text2music',
  layerCount: 1,
  baseLayerId: 'l1',
  baseVersions: [{ id: 'v1', engine: 'yue2', taskType: 'text2music', scoreV: 0 }],
  activeVersionId: 'v1',
  abc: 'X:1\nK:C\n',
  style: 'English, pop, 87 bpm',
  lyrics: '[Verse]\nwalking out\n',
  seed: 42,
  scoreV: 0,
  fingerprint: 'l1|v1|v1',
  ...over,
});

const read = (over: Partial<ScoreRead> = {}): ScoreRead => ({
  ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: null, ...over,
});

const facts = (over: Partial<EligibilityFacts> = {}): EligibilityFacts => ({
  plannerConfigured: true, yueConfigured: true, source: source(), read: read(), ...over,
});

describe('decideEligibility (F-018 #1, #2)', () => {
  it('YuE2 first take + one layer + no repaint + valid sidecar + chords = eligible', () => {
    expect(decideEligibility(facts())).toEqual({ state: 'eligible' });
  });

  it('a score version made by yue2 keeps the song eligible', () => {
    const versions = [
      { id: 'v1', engine: 'yue2', taskType: 'text2music', scoreV: 0 },
      { id: 'v2', engine: 'yue2', taskType: 'score', scoreV: 1 },
    ];
    expect(decideEligibility(facts({ source: source({ baseVersions: versions }) })).state).toBe('eligible');
  });

  it.each([
    ['a cover (gen_task cover, a YuE2 take from a score)', { source: source({ genTask: 'cover' }) }],
    ['an instrumental take (tags-only lyrics)', { source: source({ lyrics: '[Intro]\n\n[Verse]\n\n[Chorus]\n' }) }],
    ['a chord-free score', { read: read({ chordsPresent: false }) }],
    ['a score whose chords the checker did not report', { read: read({ chordsPresent: null }) }],
    ['a chord-free instrumental cover', { source: source({ genTask: 'cover', lyrics: '[Intro]\n' }), read: read({ chordsPresent: false }) }],
  ])('%s is eligible (F-065, D-132)', (_name, over) => {
    expect(decideEligibility(facts(over as Partial<EligibilityFacts>))).toEqual({ state: 'eligible' });
  });

  it.each([
    ['an ACE-Step song', { source: source({ engine: null, genTask: 'text2music' }) }],
    ['an imported song', { source: source({ engine: null, genTask: 'import' }) }],
    ['a HeartMuLa song', { source: source({ engine: 'heartmula' }) }],
    ['a missing or trashed song', { source: null }],
    ['LLM_API_URL unset', { plannerConfigured: false }],
    ['YUE_API_URL unset', { yueConfigured: false }],
  ])('%s is hidden, not ineligible', (_name, over) => {
    expect(decideEligibility(facts(over as Partial<EligibilityFacts>))).toEqual({ state: 'hidden' });
  });

  const repaint = { id: 'v2', engine: null, taskType: 'repaint', scoreV: 0 };
  it.each([
    ['a second layer', { source: source({ layerCount: 2 }) },
      'This song has 2 layers; a re-render would drop the extra one.'],
    ['a repaint version', { source: source({ baseVersions: [source().baseVersions[0], repaint] }) },
      'This song has a repaint version, so score editing ended when it was made.'],
    ['no sidecar', { source: source({ abc: null }), read: null },
      'This song has no saved score.'],
    ['a sidecar failing parse_abc', { read: read({ ok: false, error: 'group 1, Ins, bar 3: event after the measure end',
      messages: ['bar 3 (Ins): 36 of 32 units, too long by 4'], chordsPresent: null }) },
      'The saved score fails the checker: bar 3 (Ins): 36 of 32 units, too long by 4.'],
    ['a sidecar failing with no bar message', { read: read({ ok: false, error: 'group 60, Ins: expected V: Ins', chordsPresent: null }) },
      'The saved score fails the checker: group 60, Ins: expected V: Ins.'],
  ])('%s is ineligible with its own reason', (_name, over, reason) => {
    expect(decideEligibility(facts(over as Partial<EligibilityFacts>))).toEqual({ state: 'ineligible', reason });
  });

  it('each ineligible reason is a distinct string', () => {
    const reasons = new Set([
      facts({ source: source({ layerCount: 3 }) }),
      facts({ source: source({ baseVersions: [repaint] }) }),
      facts({ source: source({ abc: null }), read: null }),
      facts({ read: read({ ok: false, error: 'x' }) }),
    ].map((f) => { const e = decideEligibility(f); return e.state === 'ineligible' ? e.reason : e.state; }));
    expect(reasons.size).toBe(4);
  });

  it('a song-row reason wins over the sidecar verdict', () => {
    const e = decideEligibility(facts({ source: source({ layerCount: 2 }), read: read({ chordsPresent: false }) }));
    expect(e).toEqual({ state: 'ineligible', reason: 'This song has 2 layers; a re-render would drop the extra one.' });
  });

  it('a sidecar that could not be read (yue-server down) is offline, not ineligible', () => {
    const e = decideEligibility(facts({ read: { unreachable: 'YUE2 read score -> fetch failed' } }));
    expect(e).toEqual({ state: 'offline', reason: 'Score checker unreachable: YUE2 read score -> fetch failed. Start yue-server, then RECHECK.' });
  });

  it('a sidecar with no read yet is offline, never eligible', () => {
    expect(decideEligibility(facts({ read: null })).state).toBe('offline');
  });
});

describe('recheckAtCommit (F-018 #3)', () => {
  it('passes when the song is as it was at plan time', () => {
    expect(recheckAtCommit('l1|v1|v1', source())).toBeNull();
  });

  it('refuses when a version landed since the plan', () => {
    expect(recheckAtCommit('l1|v1|v1', source({ fingerprint: 'l1|v1,v2|v2' }))).toBe(CHANGED_SINCE_PLAN);
  });

  it('refuses when the song is gone', () => {
    expect(recheckAtCommit('l1|v1|v1', null)).toBe(CHANGED_SINCE_PLAN);
  });

  it('the refusal reads as the spec says', () => {
    expect(CHANGED_SINCE_PLAN).toBe('this song changed since the plan');
  });
});
