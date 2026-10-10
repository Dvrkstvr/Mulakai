/** The player above the composer (D-095, F-045): the song's active take on the existing `Player`, with the version
 * pill. Space plays unless a text field has focus. Position starts at 0 on every open; no reading, no section strip in
 * C0 (F-053). C3 (F-062, RF-6): a song with a reference gets the REFERENCE ⇄ SONG pill; the swap keeps the seconds
 * and the play state (`useChatPlayback`). C0b (F-048, EC-7): after a chat edit the same pill reads BACK TO v1 and plays
 * the version before at the same seconds without activating it; USE v1 activates it. A new version swaps in at the
 * same position and play state, and a lilac NOW PLAYING THE NEW VERSION lasts until the next play, scrub or send.
 * C1 (F-052, F-053; chat-mark.html MK-1..MK-3): under the transport row the section strip, bar ruler and waveform
 * (`ChatStrip`) and the reading line (`ChatReadingLine`), from `chatAnalysisStore`; read again when the take changes.
 * While A/B plays the reference or the version before, the strip is blank: its bars are the playable version's.
 * CL-8b (F-054): the mark layer over the ruler and waveform (`ChatMarkLayer`), a section click marks that section.
 * RT-5 (F-092): a done, transcribed reading of the playing version gets the READ AS row under its line (`ChatRetimeRow`). */
import { useEffect, useRef, useState } from 'react';
import { abReference } from './chatAb';
import { readingLine, stripMode } from './chatAnalysis';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { markSection, markSeconds } from './chatMark';
import { useBridgeStore } from './bridgeStore';
import { ChatMarkLayer } from './ChatMarkLayer';
import { useChatMarkStore } from './chatMarkStore';
import { ChatReadingLine } from './ChatReadingLine';
import { ChatRetimeRow } from './ChatRetimeRow';
import { ChatStrip } from './ChatStrip';
import { NOW_PLAYING_NEW, USE_FAILED, abListening, abOnLabel, backTo, labelForUse } from './chatEditCopy';
import { AB_LISTENING, AB_PILL } from './chatReferenceCopy';
import { useChatStore } from './chatStore';
import type { PlaybackApi } from './mix/playerApi';
import { Player } from './Player';
import { useMainTransportGuard } from './previewPlayback';
import { useChatAb, useChatPlayback } from './useChatPlayback';
import { useSpaceTransport } from './useSpaceTransport';
import './chatReferenceSong.css';
import './chatEdit.css';

interface Props {
  /** The base layer's active take (chatScreen.playerTake). */
  file: string;
  title: string;
  number: number | null;
  label: string | null;
  /** The version before the newest chat edit (chatAb.abPrevious); null = no version A/B. */
  previous?: { versionId: string; number: number; current: number; url: string } | null;
  /** The newest version card's id: a new one landing shows NOW PLAYING THE NEW VERSION. */
  newest?: string | null;
  /** USE vN: activate that version (the song meta follows, as the Editor's revert); rejects on failure. */
  onUse?: (versionId: string) => Promise<void>;
}

/** Play and scrub end the lilac note; the swap's own seek and play go to the raw engine. */
function clearing(engine: PlaybackApi, clear: () => void): PlaybackApi {
  return { ...engine, play: () => { clear(); engine.play(); }, seek: (t) => { clear(); engine.seek(t); } };
}

export function ChatPlayer({ file, title, number, label, previous = null, newest = null, onUse }: Props) {
  const reference = useChatStore((s) => (s.thread?.songId ? abReference(s.thread.references) : null));
  const { toggle, note, setNote } = useChatAb();
  const { engine: raw, side, src } = useChatPlayback({
    song: `/audio/${file}`, reference: previous ? null : reference?.url ?? null, previous: previous?.url ?? null,
  });
  const engine = clearing(raw, () => { if (useChatAb.getState().note) setNote(null); });
  const [useError, setUseError] = useState<string | null>(null);
  const songId = useChatStore((s) => s.thread?.songId ?? null);
  const threadId = useChatStore((s) => s.thread?.id ?? null);
  const analysis = useChatAnalysisStore((s) => s.analysis);
  const mark = useChatMarkStore((s) => (threadId ? s.byThread[threadId] : undefined));
  useEffect(() => { void useChatAnalysisStore.getState().open(songId, threadId); }, [songId, threadId, file]);
  useEffect(() => () => void useChatAnalysisStore.getState().open(null), []);
  useSpaceTransport(engine);
  useMainTransportGuard(engine);
  useEffect(() => () => useChatAb.getState().reset(), []); // another thread starts on the song
  const seen = useRef(newest);
  useEffect(() => {
    if (newest && seen.current !== newest) useChatAb.setState({ side: 'song', note: NOW_PLAYING_NEW });
    seen.current = newest;
  }, [newest, setNote]);

  const onRef = side === 'reference';
  const onPrev = side === 'previous' && previous;
  const use = async () => {
    if (!previous || !onUse) return;
    setUseError(null);
    await onUse(previous.versionId).catch((err: unknown) => setUseError(err instanceof Error ? err.message : String(err)));
  };
  const onSong = side === 'song';
  const view = onSong ? analysis.view : null;
  const markable = !!(view?.versionId && threadId && engine.duration > 0);
  // A part handed over by the Editor's ASK CHAT ABOUT THIS becomes the mark once the reading and the length are known.
  useEffect(() => {
    if (!markable || !songId) return;
    const s = useBridgeStore.getState().takeForChat(songId);
    const m = s ? markSeconds(view, s[0], s[1], false, engine.duration) : null;
    if (m) useChatMarkStore.getState().set(threadId!, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markable, songId]);
  const onSection = view && threadId && !mark?.stale ? (sec: Parameters<typeof markSection>[1]) => {
    const m = markSection(view, sec);
    if (m) useChatMarkStore.getState().set(threadId, m);
  } : undefined;
  return (
    <div className="chat-player has-strip">
      <div className="chat-player-row">
        <Player engine={engine} downloadSrc={src} downloadName={onRef ? reference!.name : `${title}.wav`} showProgress={false} />
        {number !== null && !onRef && !onPrev && <span className="chat-vp" aria-label="Active version"><span>v{number}{label ? ` · ${label}` : ''}</span></span>}
        {previous ? (
          <button type="button" className={`chat-ab${onPrev ? ' on' : ''}`} aria-pressed={!!onPrev} onClick={() => toggle('previous')}>
            <span>{onPrev ? abOnLabel(previous.number, previous.current) : backTo(previous.number)}</span>
          </button>
        ) : reference && (
          <button type="button" className={`chat-ab${onRef ? ' on' : ''}`} aria-pressed={onRef} onClick={() => toggle()}><span>{AB_PILL}</span></button>
        )}
        {onPrev && <button type="button" className="chat-q" onClick={() => void use()}><span>{labelForUse(previous.number)}</span></button>}
        {onRef && <span className="chat-hn chat-ab-status">{AB_LISTENING}</span>}
        {onPrev && <span className="chat-hn chat-ab-status">{abListening(previous.number)}</span>}
        {note && !onRef && !onPrev && <span className="chat-hn chat-ab-note">{note}</span>}
        {useError && <span className="chat-hn chat-use-failed">{USE_FAILED} · {useError}</span>}
      </div>
      <ChatStrip
        view={view} mode={onSong ? stripMode(analysis) : 'none'} audioUrl={src}
        duration={engine.duration} playhead={engine.currentTime} onSeek={engine.seek} onSection={onSection}
        marked={mark && !mark.stale ? mark.mark.bars ?? null : null}
        overlay={markable ? <ChatMarkLayer threadId={threadId!} view={view!} duration={engine.duration} onSeek={engine.seek} /> : null}
      />
      <ChatReadingLine line={readingLine(analysis)} onRetry={() => void useChatAnalysisStore.getState().retry()} />
      {view?.shown?.retime && view.shown.mode === 'current' && view.state.kind === 'done' && (
        <ChatRetimeRow key={view.versionId} offer={view.shown.retime} number={view.number}
          onRetime={(c) => useChatAnalysisStore.getState().retime(c.mode, c.mode === 'bpm' ? c.bpm : null)}
          onUndo={() => useChatAnalysisStore.getState().undoRetime()} onAgain={() => useChatAnalysisStore.getState().transcribeAgain()} />
      )}
    </div>
  );
}
