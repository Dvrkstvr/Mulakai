/** The version card (chat-edit.html 3a-3e; EC-5..EC-7; F-048 #1, edge; C4 RE-RENDER WHOLE SONG, F-066 #5). */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from './api/chat';
import { chatEditApi, type ChatVersionBody } from './api/chatEdit';
import { useChatStore } from './chatStore';
import { ChatVersionCard } from './ChatVersionCard';
import { RERENDER, RERENDER_HINT, askRerender } from './chatRerender';

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
    expect(out).not.toContain('aria-pressed'); // no A/B pill (RE-RENDER WHOLE SONG shares its style)
    expect(out).toContain('no A/B');
  });

  it('an older card (not the active take): no PLAY, no A/B', () => {
    const out = html(body(), { active: false, ab: false });
    expect(out).not.toContain('▶ PLAY');
    expect(out).not.toContain('BACK TO');
  });
});

describe('RE-RENDER WHOLE SONG (D-268, D-270)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('on the active spliced version: a lilac text button in BACK TO style, saying nothing renders until APPLY', () => {
    const out = html(body());
    expect(out).toContain(`<button type="button" class="chat-ab" title="${RERENDER_HINT}"><span>${RERENDER}</span></button>`);
  });

  it('not on an older version, a whole render, or a splice that fell back to the whole render', () => {
    expect(html(body(), { active: false, ab: false })).not.toContain(RERENDER);
    expect(html(body({ whole: true, splice: null }))).not.toContain(RERENDER);
    expect(html(body({ whole: true, splice: null, fallback: 'the join could not be aligned' }))).not.toContain(RERENDER);
  });

  it('the click asks the server for the card, then reads the thread again to show it', async () => {
    const ask = vi.spyOn(chatEditApi, 'rerenderWhole').mockResolvedValue({ messageId: 'm9', proposalId: 'p9' });
    const openSong = vi.fn(async () => {});
    useChatStore.setState({ openSong });
    expect(await askRerender('t1', 's1', 'v2')).toBeNull();
    expect(ask).toHaveBeenCalledWith('t1', 'v2');
    expect(openSong).toHaveBeenCalledWith('s1');
  });

  it('a refusal or an error is the line the card shows; the thread is not reloaded', async () => {
    const openSong = vi.fn(async () => {});
    useChatStore.setState({ openSong });
    vi.spyOn(chatEditApi, 'rerenderWhole').mockResolvedValueOnce({ refused: 'APPLY is already running for this song' });
    expect(await askRerender('t1', 's1', 'v2')).toBe('APPLY is already running for this song');
    vi.spyOn(chatEditApi, 'rerenderWhole').mockRejectedValueOnce(new Error('offline'));
    expect(await askRerender('t1', 's1', 'v2')).toBe('offline');
    expect(openSong).not.toHaveBeenCalled();
  });
});
