/** RE-TIME as a chat op (RT-6, F-094; retime.html D1-D5, Q-125, Q-132): the planner's RETIME checked and routed in code. */
import { describe, it, expect } from 'vitest';
import { checkRetime, offersRetime, RETIME_ALONE, RETIME_PENDING, RETIME_RULE, refusedLine, undoneLine } from './retimeReply.js';
import { turnSchema } from './actionSchema.js';
import { chatRules } from './chatRules.js';
import { checkReply } from './replyCheck.js';
import { OWN_SCORE, type VerbFacts } from './retimeVerb.js';

const COVER: VerbFacts = { dock: { state: 'offered', notationId: 'n1', readBpm: 140 }, reading: null };
const SONG: VerbFacts = { dock: { state: 'none' }, reading: { notationId: 'n2', read: { bpm: 87, bars: 65 }, retimed: null } };
const ORIGINAL: VerbFacts = { dock: { state: 'none' }, reading: null };
const half = { op: 'RETIME', mode: 'half' };

describe('checkRetime', () => {
  it('no RETIME op: not its business', () => {
    expect(checkRetime([{ op: 'SET_TEMPO', bpm: 90 }], COVER, 'faster')).toBeNull();
  });

  it('the 3 phrasings route with the right mode: half and a named BPM on a cover go to the dock, double on a reading', () => {
    expect(checkRetime([half], COVER, "it's half time")).toEqual({ route: { kind: 'dock', mode: 'half', bpm: null, readBpm: 140 } });
    expect(checkRetime([{ op: 'RETIME', mode: 'bpm', bpm: 92 }], COVER, "it's really 92 BPM"))
      .toEqual({ route: { kind: 'dock', mode: 'bpm', bpm: 92, readBpm: 140 } });
    expect(checkRetime([{ op: 'RETIME', mode: 'double' }], SONG, 'that reads as double time'))
      .toEqual({ route: { kind: 'reading', mode: 'double', bpm: null, readBpm: 87 } });
  });

  it('a turn about the reading re-times the reading on a cover too', () => {
    expect(checkRetime([half], { ...COVER, reading: SONG.reading }, 'the reading is half time')).toMatchObject({ route: { kind: 'reading' } });
    expect(checkRetime([half], { ...COVER, reading: SONG.reading }, "it's half time")).toMatchObject({ route: { kind: 'dock' } });
  });

  it('D-280: words about the reading on a cover with no reading re-time its transcription in the dock', () => {
    // RT-6 live bug 1: "transcription" matched ABOUT_READING and answered "no transcribed reading", though the dock plan works.
    expect(checkRetime([half], COVER, 'the transcription read it twice as fast as it is'))
      .toEqual({ route: { kind: 'dock', mode: 'half', bpm: null, readBpm: 140 } });
    expect(checkRetime([half], { dock: { state: 'refused', reason: 'it was edited' }, reading: null }, 'the reading is half time'))
      .toEqual({ say: refusedLine('it was edited') });
    expect(checkRetime([half], ORIGINAL, 'the reading is half time')).toEqual({ say: refusedLine(OWN_SCORE) });
  });

  it('Q-125: a BPM within 8 % of the read is a SET TEMPO, said why', () => {
    expect(checkRetime([{ op: 'RETIME', mode: 'bpm', bpm: 143 }], COVER, "it's really 143 BPM")).toEqual({
      tempo: { op: 'SET_TEMPO', bpm: 143 },
      message: '143 is within 8 % of the 140 read: the beat is right, so this is a tempo change, not a re-time.',
    });
  });

  it('Q-132: RETIME with another op goes back with the reason', () => {
    expect(checkRetime([half, { op: 'SET_TEMPO', bpm: 70 }], COVER, 'half time and slower')).toEqual({ fail: RETIME_ALONE });
  });

  it('refused routes are a say with the reason; a song with no facts cannot be re-timed', () => {
    expect(checkRetime([half], ORIGINAL, "it's half time")).toEqual({ say: refusedLine(OWN_SCORE) });
    expect(checkRetime([half], null, "it's half time")).toEqual({ say: refusedLine('this song has no transcription to re-time') });
    expect(refusedLine('x · nothing changed')).toBe('Cannot re-time: x · nothing changed.');
    expect(refusedLine('x')).toBe('Cannot re-time: x · nothing changed.');
  });

  it('RT-6 re-check 3: a refused HALF / DOUBLE says the other mode when it fits, on the dock and on the reading', () => {
    expect(checkRetime([{ op: 'RETIME', mode: 'double' }], { ...COVER, dock: { state: 'offered', notationId: 'n1', readBpm: 146.3 } },
      'the transcription read it twice as fast as it is')).toEqual({ say: 'Cannot re-time: DOUBLE is off: 293 BPM is over the limit'
      + ' · nothing changed. Did you mean half time (146 → 73 BPM)? Say "half time".' });
    expect(checkRetime([half], { ...SONG, reading: { ...SONG.reading!, read: { bpm: 65, bars: 80 } } }, 'that reads as double time'))
      .toEqual({ say: 'Cannot re-time: HALF is off: 33 BPM is under the limit · nothing changed. Did you mean double time'
      + ' (65 → 130 BPM)? Say "double time".' });
    expect(checkRetime([{ op: 'RETIME', mode: 'double' }], { ...COVER, dock: { state: 'offered', notationId: 'n1', readBpm: 500 } }, 'x'))
      .toEqual({ say: 'Cannot re-time: DOUBLE is off: 1000 BPM is over the limit · nothing changed.' });
    expect(checkRetime([{ op: 'RETIME', mode: 'bpm', bpm: 300 }], COVER, "it's really 300 BPM"))
      .toEqual({ say: 'Cannot re-time: 300 BPM is outside 40-240 · nothing changed.' });
  });

  it('a malformed RETIME goes back', () => {
    expect(checkRetime([{ op: 'RETIME', mode: 'bpm' }], COVER, 'x')).toMatchObject({ fail: expect.stringMatching(/RETIME needs/) });
  });
});

describe('RETIME in the reply schema and the prompt', () => {
  it('is offered only when the song has something to re-time: a YuE2 original keeps its prompt', () => {
    expect([COVER, SONG, { dock: { state: 'refused', reason: 'x' } }, ORIGINAL, null].map((f) => offersRetime(f as VerbFacts | null)))
      .toEqual([true, true, true, false, false]);
  });

  const ops = (s: unknown) => JSON.stringify(s);
  it('only with retime facts: the op shapes in the edit schema and the one rule in the OPS block', () => {
    const off = turnSchema({ facts: null, phraseBars: 4, allowed: ['edit', 'say'] });
    const on = turnSchema({ facts: null, phraseBars: 4, allowed: ['edit', 'say'], retime: true });
    expect(ops(off)).not.toContain('RETIME');
    expect(ops(on)).toContain('"const":"RETIME"');
    expect(chatRules(['edit', 'say'])).not.toContain(RETIME_RULE);
    expect(chatRules(['edit', 'say'], { retime: true })).toContain(RETIME_RULE);
  });

  // RT-6 re-check finding 1: "read it twice as fast as it is" was DOUBLE 3 of 3 live; the mode corrects the reading.
  it('says which way the wrong-way words go: read too fast is half', () => {
    expect(RETIME_RULE).toContain('"read too fast / twice as fast" = half');
  });
});

// RT-6 re-check finding 2: an undone re-time's history line says so (turnRetime.undoneRetimes reads the stored reading).
describe('undoneLine', () => {
  const done = { songId: 's', versionId: 'v', number: 1, mode: 'double' as const, bpm: 130, fromBpm: 65, fromBars: 80, toBars: 160,
    droppedNotes: 0, notes: 400, readAt: 'T2', asReadAt: 'T1' };
  it('the reading back as read (UNDO restored its stamp, no re-time): the undo line', () => {
    expect(undoneLine(done, { readAt: 'T1', retimed: false })).toBe("[UNDONE: the person undid this turn's re-time of the reading of v1]");
  });
  it('the re-time still in place, re-timed again, read again or not read: null (the line stays)', () => {
    expect(undoneLine(done, { readAt: 'T2', retimed: true })).toBeNull();
    expect(undoneLine(done, { readAt: 'T3', retimed: true })).toBeNull();
    expect(undoneLine(done, { readAt: 'T3', retimed: false })).toBeNull();
    expect(undoneLine(done, null)).toBeNull();
  });
});

describe('checkReply with RETIME', () => {
  const ctx = { allowed: ['edit', 'say'] as const, shapeOnly: [], facts: null, phraseBars: 4, request: "it's half time" };
  const edit = (ops: unknown[]) => ({ action: 'edit', message: 'Half time.', assumptions: [], ops });

  it('a routed RETIME is an ok edit carrying its route, checked before the score is needed', async () => {
    const c = await checkReply(edit([half]), { ...ctx, allowed: [...ctx.allowed], shapeOnly: ['edit'], retime: SONG }, {});
    expect(c).toMatchObject({ ok: true, reply: { action: 'edit', ops: [{ op: 'RETIME', mode: 'half' }] }, retime: { kind: 'reading', mode: 'half' } });
  });

  it('a refused RETIME is a say; RETIME with another op is a retry reason', async () => {
    expect(await checkReply(edit([half]), { ...ctx, allowed: [...ctx.allowed], retime: ORIGINAL }, {}))
      .toMatchObject({ ok: true, reply: { action: 'say', message: refusedLine(OWN_SCORE) } });
    expect(await checkReply(edit([half, { op: 'SET_TEMPO', bpm: 70 }]), { ...ctx, allowed: [...ctx.allowed], retime: COVER }, {}))
      .toEqual({ ok: false, reasons: [RETIME_ALONE] });
  });

  // RT-6 review 2 (D-278): a dock RE-TIME replaces the song's plan, so pending ops never vanish silently.
  const pending = [{ op: 'SET_TEMPO', bpm: 90 }, { op: 'SET_KEY', key: 'D major' }] as never[];
  it('with an edit plan pending, a dock RE-TIME (or a slight one, SET TEMPO) is refused with the reason', async () => {
    const at = { ...ctx, allowed: [...ctx.allowed], retime: COVER, pending };
    expect(await checkReply(edit([half]), at, {})).toMatchObject({ ok: true, reply: { action: 'say', message: refusedLine(RETIME_PENDING) } });
    expect(await checkReply(edit([{ op: 'RETIME', mode: 'bpm', bpm: 143 }]), { ...at, request: "it's really 143 BPM" }, {}))
      .toMatchObject({ ok: true, reply: { action: 'say', message: refusedLine(RETIME_PENDING) } });
    expect(refusedLine(RETIME_PENDING)).toBe('Cannot re-time: an edit plan is pending; apply or scrap it first, or say start over · nothing changed.');
  });

  it('with an edit plan pending, a start over re-times on the dock and lists every pending op as REMOVED (D-257)', async () => {
    const c = await checkReply(edit([half]), { ...ctx, allowed: [...ctx.allowed], retime: COVER, pending, request: "start over, it's half time" }, {});
    expect(c).toMatchObject({ ok: true, retime: { kind: 'dock', mode: 'half' }, revised: { marks: [{ mark: 'NEW', was: null }], removed: pending } });
  });

  it('a reading RE-TIME leaves a pending plan alone: not refused, nothing listed', async () => {
    const c = await checkReply(edit([half]), { ...ctx, allowed: [...ctx.allowed], shapeOnly: ['edit'], retime: SONG, pending }, {});
    expect(c).toMatchObject({ ok: true, retime: { kind: 'reading' } });
    expect(c).not.toHaveProperty('revised');
  });
});
