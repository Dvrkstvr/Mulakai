/** C3's copy (F-061..F-064, D-134, D-137, D-138): READ's and RE-ANALYZE's consequence lines, the rights line, the
 * card lines, not-read parts, the 360 s cut, CREATE COVER's line, the field marks and missing-field notes. */
import { describe, it, expect } from 'vitest';
import type { ChatDraft } from './api/chat';
import {
  CREATE_COVER, RIGHTS_LINE, STEPS_LINE, analyzeLine, attachChipLine, coverConsequence, coverVerdictLine, cutNote, fieldMark,
  layersNote, missingNote, notReadLine, partLine, readConsequence, readingLine, reanalyzeConsequence, referenceMeta,
} from './chatReferenceCopy';

const draft = (over: Partial<ChatDraft>): ChatDraft => ({ draft_v: 1, rev: 1, touched: {}, fields: {} as ChatDraft['fields'], ...over });

describe('chatReferenceCopy', () => {
  it('READ says the steps, the GPU estimate and that nothing changes (F-061); a YuE2 song uses no GPU', () => {
    expect(readConsequence(40)).toBe('Reads WORDS > SCORE > CAPTION · uses the GPU about 40 s, changes nothing');
    expect(readConsequence(40, 2)).toBe('Reads WORDS > SCORE > CAPTION · uses the GPU about 40 s, changes nothing · starts after 2 jobs');
    expect(readConsequence(0)).toBe('Reads WORDS > SCORE > CAPTION · uses no GPU, changes nothing');
    expect(readConsequence(null)).toBe('Reads WORDS > SCORE > CAPTION · uses the GPU, changes nothing');
    expect(STEPS_LINE).toBe('WORDS > SCORE > CAPTION');
  });

  it('the rights line is D-134\'s, word for word', () => {
    expect(RIGHTS_LINE).toBe('Stays on this machine. You are responsible for the rights to this recording.');
  });

  it('where each part comes from', () => {
    expect(partLine('words', 'own')).toBe('WORDS · its own lyrics');
    expect(partLine('score', 'service')).toBe('SCORE · transcribed by yue-server');
    expect(partLine('caption', 'service')).toBe('CAPTION · ACE-Step ANALYZE AUDIO');
    expect(partLine('caption', 'skip')).toBe('CAPTION · skipped');
  });

  it('a part not read says why, never empty; the server\'s own "not read:" is not doubled', () => {
    expect(notReadLine('caption', 'ACE-Step is not running')).toBe('CAPTION · not read: ACE-Step is not running');
    expect(notReadLine('words', 'not read: LYRICS_API_URL is not set')).toBe('WORDS · not read: LYRICS_API_URL is not set');
    expect(notReadLine('score', '')).toBe('SCORE · not read: no reason given');
  });

  it('longer than 360 s reads the first 6:00 and says so (D-138); a multi-layer song reads its base layer (D-137)', () => {
    expect(cutNote(412)).toBe('6:52 long · reads the first 6:00 only · A/B plays all of it');
    expect(layersNote(3)).toBe('reads the base layer only · its other 2 layers are not read');
    expect(layersNote(1)).toBeNull();
  });

  it('the analyze card\'s line: starting, refused, superseded, expired; none while pending or done', () => {
    expect(analyzeLine({ kind: 'starting' })).toBe('READ · STARTING…');
    expect(analyzeLine({ kind: 'refused', reason: 'a model is still loaded' })).toBe('READ REFUSED · a model is still loaded');
    expect(analyzeLine({ kind: 'superseded' })).toBe('SUPERSEDED · a newer reading proposal replaced this one');
    expect(analyzeLine({ kind: 'expired' })).toBe('EXPIRED · this proposal expired, ask again');
    expect(analyzeLine({ kind: 'pending' })).toBeNull();
  });

  it('the reading card\'s line through its life', () => {
    expect(readingLine({ kind: 'queued', ahead: 2 })).toBe('READING · QUEUED · STARTS AFTER 2 JOBS');
    expect(readingLine({ kind: 'queued', ahead: 0 })).toBe('READING · STARTING…');
    expect(readingLine({ kind: 'reading', step: 2, name: 'SCORE', note: 'transcribing 41%' })).toBe('READING · 2 OF 3 · SCORE · transcribing 41%');
    expect(readingLine({ kind: 'proposing' })).toBe('PROPOSING…');
    expect(readingLine({ kind: 'done', partial: false })).toBe('READ');
    expect(readingLine({ kind: 'done', partial: true })).toBe('READ · SOME PARTS NOT READ');
    expect(readingLine({ kind: 'failed', error: 'the file cannot be read' })).toBe('READING FAILED · the file cannot be read · nothing changed');
    expect(readingLine({ kind: 'cancelled' })).toBe('CANCELLED · nothing was read · nothing changed');
    expect(readingLine({ kind: 'interrupted' })).toBe('INTERRUPTED · the server restarted before the reading finished · RE-ANALYZE reads it again');
  });

  it('cover verdict: possible, or why not with the fresh-song option (F-063 edge)', () => {
    expect(coverVerdictLine(null)).toBe('COVER POSSIBLE');
    expect(coverVerdictLine('the score failed the validator')).toBe('NO COVER · the score failed the validator · a new song in its style is still possible');
  });

  it('CREATE COVER\'s consequence is F-063\'s line; a YuE2 song\'s own score is said as such', () => {
    expect(CREATE_COVER).toBe('CREATE COVER');
    expect(coverConsequence(200)).toBe('keeps the melody, new words and style; renders on YuE2 from the transcribed score, about 3 min · the new words are fitted by YuE2, not guaranteed');
    expect(coverConsequence(null, 'own')).toBe('keeps the melody, new words and style; renders on YuE2 from its own score · the new words are fitted by YuE2, not guaranteed');
  });

  it('marks: FROM THE SCORE on a cover, REFERENCE on a borrow, none on a field the reading did not fill', () => {
    const cover = draft({ reference: { referenceId: 'r1', use: 'cover' }, borrowed: ['bpm', 'key'] });
    expect(fieldMark(cover, 'bpm')).toBe('FROM THE SCORE');
    expect(fieldMark(cover, 'title')).toBeNull();
    expect(fieldMark(draft({ reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['bpm'] }), 'bpm')).toBe('REFERENCE');
    expect(fieldMark(draft({}), 'bpm')).toBeNull();
  });

  it('a missing value says so (F-064 edge)', () => {
    expect(missingNote('key')).toBe('no key found in the reference');
    expect(missingNote('bpm')).toBe('no tempo found in the reference');
    expect(missingNote('timeSignature')).toBe('no meter found in the reference');
  });

  it('RE-ANALYZE\'s consequence and the panel\'s meta line (F-062)', () => {
    expect(reanalyzeConsequence(40)).toBe('Reads the reference again · uses the GPU about 40 s · a new reading card lands in this chat · nothing else changes');
    expect(referenceMeta(192, '2026-10-07T10:00:00Z')).toBe('3:12 · read 2026-10-07');
    expect(referenceMeta(null, null)).toBe('not read yet');
  });

  it('the chip: uploading with percent, attached with length, failed with the reason', () => {
    expect(attachChipLine({ phase: 'uploading', name: 'a.mp3', progress: 0.414 })).toBe('UPLOADING 41%');
    expect(attachChipLine({ phase: 'attached', name: 'a.mp3', referenceId: 'r1', seconds: 192 })).toBe('3:12');
    expect(attachChipLine({ phase: 'failed', name: 'a.txt', reason: 'this is not an audio file' })).toBe('this is not an audio file');
  });
});
