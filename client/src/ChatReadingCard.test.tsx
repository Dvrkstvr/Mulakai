/** The reading card (F-061; design/chat-reference.html 2c-2g, 5c; D-129 PROPOSING…, D-137, D-138). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessageView, ChatReadingBody } from './api/chat';
import type { ReadingView, ReferenceView } from './api/chatReferences';
import { ChatReadingCard } from './ChatReadingCard';
import { coverBlock } from './chatReferenceCopy';
import type { CardPhase } from './chatReading';

const READING: ReadingView = {
  reading_v: 1, readAt: '2026-10-07T10:00:00Z', seconds: 192, readTo: 192, cut: false,
  plan: { words: 'service', score: 'service', caption: 'service' },
  words: { language: 'de', lines: Array.from({ length: 38 }, (_, i) => `line ${i}`), instrumental: false },
  score: {
    abc: 'X:1', source: 'transcribed', chords: true, warnings: [],
    facts: {
      header: { meter: '4/4', unit: '1/8', bpm: 92, key: 'Am', bars: 66, seconds: 172, units_per_quarter: 2 }, key_notes: '',
      sections: [{ index: 0, label: 'Verse', from_bar: 1, to_bar: 16 }, { index: 1, label: 'Chorus', from_bar: 17, to_bar: 32 }],
      lyric_blocks: [], bar_map: [],
    },
    measure: { budget: 3000, header: 100, sections: [{ name: 'Verse', tokens: 900 }, { name: 'Chorus', tokens: 900 }] },
  },
  caption: { caption: 'slow pop ballad, warm female voice, nylon guitar', bpm: 92, key: 'A minor', meter: '4/4' },
};
const body = (reading: ReadingView | null): ChatReadingBody => ({ chat_v: 1, referenceId: 'r1', name: 'slow_dance_demo.mp3', followUp: true, reading });
const msg = (reading: ReadingView | null): ChatMessageView => ({
  id: 'c1', seq: 3, role: 'assistant', kind: 'reading', text: '', body: body(reading), proposalId: null, jobId: 'j9', versionId: null, state: 'done', createdAt: '',
});
const REF = { id: 'r1', origin: 'upload', layers: null } as ReferenceView;

const card = (phase: CardPhase, reading: ReadingView | null = null, reference: Partial<ReferenceView> = {}) => renderToStaticMarkup(
  <ChatReadingCard message={msg(reading)} card={{ phase, jobId: 'j9', stage: 'read' }} reference={{ ...REF, ...reference }} onCancel={vi.fn()} onReadAgain={vi.fn()} />,
);

describe('ChatReadingCard', () => {
  it('queued: dashed and plain, when it starts, CANCEL', () => {
    const out = card({ kind: 'queued', ahead: 1 });
    expect(out).toContain('READING · slow_dance_demo.mp3');
    expect(out).toMatch(/chat-job waiting/);
    expect(out).toContain('STARTS AFTER 1 JOB');
    expect(out).toContain('<span>CANCEL</span>');
  });
  it('reading step 2 of 3: the strip marks WORDS done and SCORE on; a plain line, never the shader', () => {
    const out = card({ kind: 'reading', step: 2, name: 'SCORE', note: 'transcribing 41%' });
    expect(out).toMatch(/class="dn">WORDS<\/i><i class="on">SCORE<\/i><i class="">CAPTION/);
    expect(out).toContain('READING · 2 OF 3 · SCORE · transcribing 41%');
    expect(out).not.toContain('working');
    expect(out).toContain('<span>CANCEL</span>');
  });
  it('done: words, the score with its sections and chords, the caption; cover possible; the rights line', () => {
    const out = card({ kind: 'done', partial: false }, READING);
    for (const s of ['38 lines · DE · sung', '66 bars · 4/4 · Am · 92 BPM · chords read', 'VERSE', 'CHORUS',
      'slow pop ballad, warm female voice, nylon guitar', 'COVER POSSIBLE', 'Stays on this machine']) {
      expect(out).toContain(s);
    }
    expect(out).not.toContain('<span>CANCEL</span>');
  });
  it('proposing: the reading stays, the follow-up line under it with CANCEL (D-129)', () => {
    const out = card({ kind: 'proposing' }, READING);
    expect(out).toContain('38 lines');
    expect(out).toContain('PROPOSING…');
    expect(out).toContain('<span>CANCEL</span>');
  });
  it('partial: a part not read is a rust line naming its cause, never an empty row', () => {
    const out = card({ kind: 'done', partial: true }, { ...READING, caption: { notRead: 'ACE-Step is not running' } });
    expect(out).toMatch(/chat-ref-warn[\s\S]*CAPTION · not read: ACE-Step is not running/);
    expect(out).toContain('READ · SOME PARTS NOT READ');
  });
  it('instrumental: says there are no words', () => {
    const out = card({ kind: 'done', partial: false }, { ...READING, words: { language: null, lines: [], instrumental: true } });
    expect(out).toContain('none heard · instrumental: there are no words');
  });
  it('cover not possible: no score, or a score over the plan budget, says why', () => {
    expect(coverBlock({ ...READING, score: { notRead: 'yue-server is not answering' } })).toBe('no score was read');
    const long = { ...READING, score: { ...(READING.score as object), measure: { budget: 1000, header: 100, sections: [{ name: 'V', tokens: 950 }] } } } as ReadingView;
    expect(coverBlock(long)).toMatch(/longer than YuE2 plans in one take/);
    expect(coverBlock(READING)).toBeNull();
    expect(card({ kind: 'done', partial: true }, long)).toContain('NO COVER · the score is longer than YuE2 plans in one take');
  });
  it('cut at 360 s and a library song read from its base layer (D-138, D-137)', () => {
    const out = card({ kind: 'done', partial: false }, { ...READING, seconds: 461, readTo: 360, cut: true }, { origin: 'library', layers: 2 });
    expect(out).toContain('7:41 long · reads the first 6:00 only');
    expect(out).toContain('its other 1 layer is not read');
  });
  it('failed: a rust box, nothing saved, READ AGAIN', () => {
    const out = card({ kind: 'failed', error: 'no notes found in it' });
    expect(out).toMatch(/chat-er[\s\S]*READING FAILED · no notes found in it · nothing changed/);
    expect(out).toContain('<button type="button" class="chat-q"><span>READ AGAIN</span>');
    expect(out).toContain('Reads the reference again · uses the GPU · a new reading card lands in this chat');
  });
  it('cancelled and interrupted: a plain line, READ AGAIN', () => {
    expect(card({ kind: 'cancelled' })).toContain('CANCELLED · nothing was read');
    expect(card({ kind: 'interrupted' })).toContain('INTERRUPTED');
    expect(card({ kind: 'cancelled' })).toContain('<span>READ AGAIN</span>');
  });
});
