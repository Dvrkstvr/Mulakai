/** The lyrics panel as drawn (F-056, F-057; chat-converge.html section 2): the section list, only the marked part, two
 * sections with a dashed break, struck old / new, PROPOSED outside the mark, dim while reading, failed + RETRY, no words;
 * and the song rows above it (VERSIONS, STYLE, TEMPO · KEY) with no draft field on a song's thread (D-219). */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisView, RangeMark } from './api/chatAnalysis';
import type { ScoreLyricDiff } from './api/score';
import type { SongDetail } from './api';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { INITIAL_ANALYSIS } from './chatAnalysis';
import { PANEL, TIMES, panelView } from './chatLyricsFixture';
import { panelRows } from './chatLyricsPanel';
import { markBars } from './chatMark';
import { ChatLyricsPanel } from './ChatLyricsPanel.tsx';
import { ChatSongRows } from './ChatSongPanel';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const V = panelView();
const mark = (a: number, b: number) => markBars(V, a, b)!;
const diff = (block: number, old: string[], next: string[]): ScoreLyricDiff => ({ block, tag: 'Chorus', occurrence: 2, old, new: next });
function draw(view: AnalysisView, m: RangeMark | null = null, diffs: ScoreLyricDiff[] = [], markable = true) {
  const rows = panelRows({ view, mark: m, times: TIMES, diffs });
  return renderToStaticMarkup(
    <ChatLyricsPanel rows={rows} view={view} mark={m} markable={markable} times={TIMES} duration={33}
      onMark={vi.fn()} onClear={vi.fn()} onRetry={vi.fn()} onAsk={vi.fn()} />,
  );
}

afterEach(() => useChatAnalysisStore.setState({ analysis: INITIAL_ANALYSIS }));

describe('ChatLyricsPanel', () => {
  it('no mark: every section with bars, line count and first line; an instrumental one dim', () => {
    const out = draw(V);
    expect(out).toContain('LYRICS · 8 LINES');
    expect(out).toContain('CLICK TO MARK');
    expect(out).toMatch(/class="chat-lp-sr none"[^>]*><b>INTRO<\/b><span>1–2<\/span><span>NONE<\/span>/);
    expect(out).toMatch(/<b>CHORUS 2<\/b><span>15–16<\/span><span>2 LINES<\/span><em>c2 a<\/em>/);
  });
  it('a stale mark: the list is drawn but nothing marks', () => {
    expect(draw(V, null, [], false).match(/class="chat-lp-sr[^"]*" disabled=""/g)).toHaveLength(5);
  });
  it('a whole section marked: only it, its lines with start bars, ◂ ALL SECTIONS clears', () => {
    const out = draw(V, mark(7, 10));
    expect(out).toContain('LYRICS · CHORUS 1');
    expect(out).toMatch(/<button type="button" class="chat-link chat-lp-aside">◂ ALL SECTIONS<\/button>/);
    expect(out).toContain('<i>7</i><span>c1 a</span>');
    expect(out).not.toContain('v1 a');
  });
  it('one line marked: that line tinted, "1 OF 2 LINES"', () => {
    const out = draw(V, mark(5, 6));
    expect(out).toContain('1 OF 2 LINES');
    expect(out).toMatch(/class="chat-lp-ln m"><i>5<\/i><span>v1 b<\/span>/);
  });
  it('the sections next to the mark stay as one dim row each, the line by the mark, so shift-click can cross (2b)', () => {
    const out = draw(V, mark(7, 10));
    expect(out).toMatch(/chat-lp-part ctx"><button[^>]*><span>VERSE 1<\/span>.*<span>v1 b<\/span>/);
    expect(out).toMatch(/chat-lp-part brk ctx"><button[^>]*><span>VERSE 2<\/span>.*<span>v2 a<\/span>/);
    expect(out).not.toContain('v1 a');
    expect(out).toContain('LYRICS · CHORUS 1'); // the title counts only the marked part
  });
  it('two sections: both headers, a dashed break, the unmarked lines counted', () => {
    const out = draw(V, mark(9, 12));
    expect(out).toContain('LYRICS · 2 SECTIONS · 2 LINES');
    expect(out).toContain('class="chat-lp-part brk"');
    expect(out).toContain('1 MORE LINE IN CHORUS 1 IS NOT MARKED');
    expect(out).toContain('1 MORE LINE IN VERSE 2 IS NOT MARKED');
  });
  it('a pending rewrite in the mark: the old words struck above the new, ~ in the bar column', () => {
    const out = draw(V, mark(15, 16), [diff(4, ['c2 a', 'c2 b'], ['c2 a', 'c2 new'])]);
    expect(out).toContain('<s>c2 b</s>');
    expect(out).toMatch(/class="chat-lp-ln new"><i>~<\/i><span>c2 new<\/span>/);
  });
  it('a rewrite outside the mark: that section appended PROPOSED, the mark unchanged', () => {
    const out = draw(V, mark(3, 6), [diff(4, ['c2 a', 'c2 b'], ['x', 'c2 b'])]);
    expect(out).toContain('LYRICS · VERSE 1');
    expect(out).toMatch(/chat-lp-part brk proposed.*CHORUS 2<em class="chat-tag">PROPOSED<\/em>/);
    expect(out).toContain('<s>c2 a</s>');
  });
  it('a newer version being read: the old panel dimmed, READING v5…, MARKS BY BARS', () => {
    const out = draw(panelView({ number: 5, state: { kind: 'running', jobId: 'j', step: 'WORDS', progress: null } }));
    expect(out).toContain('LYRICS · READING v5…');
    expect(out).toContain('MARKS BY BARS');
    expect(out).toContain('class="chat-lp-dim"');
  });
  it('a failed read: the rust line with the reason and RETRY', () => {
    const out = draw(panelView({ number: 5, state: { kind: 'failed', reason: 'lyrics-server did not answer in 60 s', at: 'x' } }));
    expect(out).toContain('LYRICS · NOT READ');
    expect(out).toContain("<b>COULDN&#x27;T READ v5</b> · lyrics-server did not answer in 60 s.");
    expect(out).toContain('<span>RETRY</span>');
  });
  it('no words: says so and how to get them', () => {
    const out = draw(panelView({}, { ...PANEL, source: 'none', note: null, text: null, sections: [] }));
    expect(out).toContain('LYRICS · NONE');
    expect(out).toContain('NO LYRICS IN THIS VERSION');
    expect(out).toContain('<span>ASK THE CHAT</span>');
  });
});

describe('ChatSongRows', () => {
  it('VERSIONS oldest first with the active one as the pill; STYLE and TEMPO · KEY from the reading', () => {
    useChatAnalysisStore.setState({ analysis: { ...INITIAL_ANALYSIS, view: V } });
    const version = (id: string, active: 0 | 1) => ({ id, active, wordTimings: null });
    const song = { caption: 'old caption', bpm: 90, key_scale: 'C major', time_signature: '3/4', duration: 33,
      layers: [{ kind: 'base', versions: [version('c', 0), version('b', 1), version('a', 0)] }] } as unknown as SongDetail;
    const out = renderToStaticMarkup(<ChatSongRows song={song} />);
    expect(out).toMatch(/v1<\/span>.*<span>v2 ●<\/span>.*v3<\/span>/);
    expect(out).toContain('indie pop');
    expect(out).toContain('120 BPM · A MINOR · 4/4');
  });
});
