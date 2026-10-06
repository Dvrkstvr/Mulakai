/** ATTACH ▾, the drop target and the chip (F-061; design/chat-reference.html 1a-1c, D-130, D-141 one chip). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Song } from './api/types';
import { AttachChip, AttachMenu, ChatAttachControl, DropOverlay } from './ChatAttach';

const song = (over: Partial<Song>): Song => ({
  id: 's1', title: 'Luz sobre el mar', duration: 192, engine: 'yue2', trashed_at: null, audio_file: 'a.mp3',
  ...over,
} as Song);

describe('AttachChip', () => {
  it('uploading: the name, the share and a bar; ✕ aborts', () => {
    const out = renderToStaticMarkup(<AttachChip a={{ phase: 'uploading', name: 'slow_dance_demo.mp3', progress: 0.42 }} onRemove={vi.fn()} />);
    expect(out).toContain('slow_dance_demo.mp3');
    expect(out).toContain('UPLOADING 42%');
    expect(out).toContain('width:42%');
    expect(out).toMatch(/aria-label="Remove attachment"/);
  });
  it('attached: the name and its length', () => {
    const out = renderToStaticMarkup(<AttachChip a={{ phase: 'attached', name: 'Long Way Down', referenceId: 'r1', seconds: 240 }} onRemove={vi.fn()} />);
    expect(out).toContain('Long Way Down');
    expect(out).toContain('4:00');
    expect(out).not.toContain('chat-attach-bar');
  });
  it('failed: the server reason in rust, nothing stored', () => {
    const out = renderToStaticMarkup(<AttachChip a={{ phase: 'failed', name: 'notes.txt', reason: 'not audio: no length could be read' }} onRemove={vi.fn()} />);
    expect(out).toMatch(/class="chat-attach-chip failed"/);
    expect(out).toContain('not audio: no length could be read');
  });
});

describe('AttachMenu', () => {
  const menu = (songs: Song[] | null, error: string | null = null) => renderToStaticMarkup(
    <AttachMenu songs={songs} error={error} query="" onQuery={vi.fn()} onFile={vi.fn()} onPick={vi.fn()} />,
  );
  it('FILE… and FROM LIBRARY… with what each is, and a search field', () => {
    const out = menu([]);
    for (const s of ['FILE…', 'an audio file from this computer', 'FROM LIBRARY…', 'a song you made', 'Search your library…']) expect(out).toContain(s);
  });
  it('each library row says what READ will do before the click (D-137)', () => {
    const out = menu([song({}), song({ id: 's2', title: 'Long Way Down', duration: 240, engine: null })]);
    expect(out).toContain('3:12 · YUE2');
    expect(out).toContain('its own score and words, no GPU');
    expect(out).toContain('4:00 · ACE-STEP');
    expect(out).toContain('score transcribed on the GPU');
  });
  it('loading, empty and a failed list', () => {
    expect(menu(null)).toContain('LOADING…');
    expect(menu([])).toContain('no songs match');
    expect(menu([], 'HTTP 500')).toMatch(/chat-attach-err[^>]*>[^<]*HTTP 500/);
  });
});

describe('ChatAttachControl', () => {
  it('ATTACH ▾ is a plain choice button, live on the draft thread', () => {
    const out = renderToStaticMarkup(<ChatAttachControl threadId="t1" off={false} />);
    expect(out).toMatch(/<button type="button" class="chat-q chat-attach-btn"[^>]*><span>ATTACH ▾<\/span>/);
    expect(out).not.toMatch(/chat-attach-btn"[^>]*disabled/);
  });
  it('a song thread: greyed with the reason (D-130)', () => {
    const out = renderToStaticMarkup(<ChatAttachControl threadId="t1" off />);
    expect(out).toMatch(/disabled=""/);
    expect(out).toContain('references attach to a new song');
  });
});

describe('the drop target', () => {
  it('names what it takes and that the copy stays here', () => {
    const out = renderToStaticMarkup(<DropOverlay />);
    expect(out).toContain('DROP A SONG TO WORK FROM');
    expect(out).toContain('MP3 · WAV · FLAC · M4A · OGG');
    expect(out).toContain('stays on this machine');
  });
});
