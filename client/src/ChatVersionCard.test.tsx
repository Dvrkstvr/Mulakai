/** The version card (chat-edit.html 3a-3e; EC-5..EC-7; F-048 #1, edge). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from './api/chat';
import type { ChatVersionBody } from './api/chatEdit';
import { ChatVersionCard } from './ChatVersionCard';

const body = (over: Partial<ChatVersionBody> = {}): ChatVersionBody => ({
  chat_v: 1, seconds: 192, label: 'Jazz chords in chorus 1', number: 2, truncated: false, whole: false,
  splice: { kind: 'reharmonize', bars: [25, 32], lengthDiffS: 0.04 }, fallback: null, previous: { versionId: 'v1', number: 1 }, ...over,
});
const msg = (b: ChatVersionBody): ChatMessageView => ({
  id: 'v', seq: 4, role: 'assistant', kind: 'version', text: 'Saved as v2', body: b as never, proposalId: null, jobId: 'r1', versionId: 'v2', state: null, createdAt: '',
});
const html = (b: ChatVersionBody, o: { active?: boolean; ab?: boolean; onPrevious?: boolean } = {}) => renderToStaticMarkup(
  <ChatVersionCard message={msg(b)} active={o.active ?? true} ab={o.ab ?? true} onPrevious={o.onPrevious ?? false} onPlay={vi.fn()} onBack={vi.fn()} />,
);

describe('ChatVersionCard', () => {
  it('a splice: the lilac pill, the label, the bars changed, PLAY and BACK TO v1', () => {
    const out = html(body());
    expect(out).toMatch(/class="chat-vp"><span>v2<\/span>/);
    expect(out).toContain('Jazz chords in chorus 1');
    expect(out).toContain('bars 25-32 changed');
    expect(out).toContain('v2 is the active version. v1 is kept.');
    expect(out).toContain('▶ PLAY');
    expect(out).toMatch(/class="chat-ab" aria-pressed="false"><span>BACK TO v1/);
  });

  it('on v1: the pill is filled and reads the way back', () => {
    expect(html(body(), { onPrevious: true })).toMatch(/class="chat-ab on" aria-pressed="true"><span>◂ v1 · BACK TO v2/);
  });

  it('the join could not be aligned: a rust line, SAVED · WHOLE SONG (EC-5)', () => {
    const out = html(body({ whole: true, splice: null, fallback: 'the join could not be aligned' }));
    expect(out).toContain('SAVED · WHOLE SONG');
    expect(out).toContain('chat-er');
    expect(out).toContain('THE JOIN COULD NOT BE ALIGNED');
  });

  it('the version before it was deleted: no A/B (F-048 edge)', () => {
    const out = html(body({ previous: null }), { ab: false });
    expect(out).not.toContain('chat-ab');
    expect(out).toContain('no A/B');
  });

  it('an older card (not the active take): no PLAY, no A/B', () => {
    const out = html(body(), { active: false, ab: false });
    expect(out).not.toContain('▶ PLAY');
    expect(out).not.toContain('BACK TO');
  });
});
