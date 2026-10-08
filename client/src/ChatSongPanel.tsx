/** The song sidebar on a song's thread (F-056, D-219; chat-converge.html CX-1): VERSIONS, STYLE (the version's), TEMPO ·
 * KEY (the shown reading's header), then the lyrics panel. The locked draft fields are not shown here: the draft was
 * the first take's, not the playable version's. `ChatSongRows` sits above the song's references, `ChatSongLyrics`
 * under them; the panel reads the player's analysis view and the thread's mark, so it agrees with the strip. */
import { useMemo, type ReactNode } from 'react';
import type { SongDetail } from './api';
import { FIELD_LABEL, VERSIONS, keyName } from './chatCopy';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { lineTimes } from './chatLyricsMark';
import { liveDiffs, panelRows } from './chatLyricsPanel';
import { useChatMarkStore } from './chatMarkStore';
import { useChatStore } from './chatStore';
import { useChatAb } from './useChatPlayback';
// The extension is load-bearing: on a case-blind disk './ChatLyricsPanel' resolves to the pure chatLyricsPanel.ts.
import { ChatLyricsPanel } from './ChatLyricsPanel.tsx';

const baseVersions = (song: SongDetail | null) => (song?.layers.find((l) => l.kind === 'base') ?? song?.layers[0])?.versions ?? [];

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <div className="chat-fd chat-song-fd"><div className="chat-fk">{k}</div><div>{children}</div></div>;
}

export function ChatSongRows({ song }: { song: SongDetail | null }) {
  const facts = useChatAnalysisStore((s) => s.analysis.view?.shown?.lyrics?.facts ?? null);
  // Newest first in the layer; listed oldest first, the active one as the lilac pill.
  const versions = [...baseVersions(song)].reverse();
  const bpm = facts?.bpm ?? song?.bpm ?? null;
  const tempo = [bpm ? `${bpm} BPM` : null, keyName(facts?.key ?? song?.key_scale ?? '') || null, facts?.meter ?? song?.time_signature ?? null]
    .filter(Boolean).join(' · ');
  return (
    <>
      <Row k={VERSIONS}>
        {versions.map((v, i) => (v.active
          ? <span key={v.id} className="chat-vp chat-song-v"><span>v{i + 1} ●</span></span>
          : <span key={v.id} className="chat-hn chat-song-v">v{i + 1}</span>))}
      </Row>
      <Row k={FIELD_LABEL.style}><span className="chat-song-val">{facts?.style ?? song?.caption ?? '—'}</span></Row>
      <Row k={`${FIELD_LABEL.bpm} · ${FIELD_LABEL.key}`}><span className="chat-song-val mono">{tempo || '—'}</span></Row>
    </>
  );
}

/** The ASK THE CHAT of a song with no words: the composer, focused (the person says what to write). */
const focusComposer = () => (document.querySelector('.chat-input') as HTMLTextAreaElement | null)?.focus();

export function ChatSongLyrics({ song }: { song: SongDetail | null }) {
  const threadId = useChatStore((s) => s.thread?.id ?? null);
  const messages = useChatStore((s) => s.thread?.messages);
  const view = useChatAnalysisStore((s) => s.analysis.view);
  const entry = useChatMarkStore((s) => (threadId ? s.byThread[threadId] : undefined));
  const lyrics = view?.shown?.lyrics ?? null;
  const shownId = view?.shown?.versionId;
  const timings = useMemo(() => baseVersions(song).find((v) => v.id === shownId)?.wordTimings ?? null, [song, shownId]);
  // `alignLyrics` is quadratic in words: once per reading and its timings.
  const times = useMemo(() => lineTimes(lyrics, timings), [lyrics, timings]);
  const diffs = useMemo(() => liveDiffs(messages ?? []), [messages]);
  const mark = entry && !entry.stale ? entry.mark : null;
  const rows = useMemo(() => panelRows({ view, mark, times, diffs }), [view, mark, times, diffs]);
  if (!threadId) return null;
  return (
    <ChatLyricsPanel
      rows={rows} view={view} mark={mark} markable={!!view?.versionId && !entry?.stale} times={times} duration={song?.duration ?? null}
      onMark={(m) => useChatMarkStore.getState().set(threadId, m)}
      onClear={() => useChatMarkStore.getState().clear(threadId)}
      onRetry={() => void useChatAnalysisStore.getState().retry()}
      onAsk={focusComposer}
      onPlay={(at) => useChatAb.getState().playAt(at)}
    />
  );
}
