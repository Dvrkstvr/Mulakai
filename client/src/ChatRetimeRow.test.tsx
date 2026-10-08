/** RE-TIME on the chat reading (RT-5, F-092; design/retime.html B1, B4, B5). Picking and pressing are browser-checked;
 * the rules and copy are retimeRules' (retimeRules.test.ts). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReadingRetimeOffer } from './api/chatAnalysis';
import { ChatRetimeRow } from './ChatRetimeRow';

const OFFER: ReadingRetimeOffer = { notationId: 'n1', read: { bpm: 140, bars: 96 }, retimed: null };
const draw = (offer: ReadingRetimeOffer) => renderToStaticMarkup(
  <ChatRetimeRow offer={offer} number={1} onRetime={vi.fn()} onUndo={vi.fn()} onAgain={vi.fn()} />);

describe('ChatRetimeRow', () => {
  it('B1 offered: what SheetSage2 read, then HALF · DOUBLE · BPM… as sky choices; no commit before a pick', () => {
    const out = draw(OFFER);
    expect(out).toContain('READ AS');
    expect(out).toContain('140 BPM · 96 BARS');
    expect(out).toMatch(/HALF.*DOUBLE.*BPM…/);
    expect(out).not.toMatch(/RE-TIME AT|UNDO|TRANSCRIBE AGAIN/);
  });

  it('B4 re-timed: still reads as read, with the re-time beside it and UNDO', () => {
    const out = draw({ ...OFFER, retimed: { mode: 'half', bpm: 70, fromBpm: 140, fromBars: 96, toBars: 48, droppedNotes: 17, notes: 293 } });
    expect(out).toContain('140 BPM · 96 BARS');
    expect(out).toContain('RE-TIMED TO 70 BPM');
    expect(out).toContain('from 140 BPM · 96 bars → 48 · same seconds, bars renumbered · 17 of 293 notes left out');
    expect(out).toMatch(/class="tag-retimed">RE-TIMED</);
    expect(out).toContain('UNDO');
  });

  it('B5 no kept reading: the chips are off and TRANSCRIBE AGAIN says it uses the GPU (no minutes, D-240)', () => {
    const out = draw({ ...OFFER, notationId: null });
    expect(out).toContain('THE SAVED READING IS GONE');
    expect(out).toContain('TRANSCRIBE AGAIN reads v1 again from scratch on the GPU');
    expect(out).toMatch(/disabled="".*HALF/);
    expect(out).not.toMatch(/\d+ min/);
  });
});
