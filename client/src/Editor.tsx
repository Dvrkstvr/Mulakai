import { useState } from 'react';
import { useSongDetail } from './useSongDetail';
import type { Region } from './Waveform';
import { Player } from './Player';
import { LayerStack } from './LayerStack';
import { SectionStrip } from './SectionStrip';
import { ActionDock } from './ActionDock';
import type { DockVerb } from './dockTarget';
import { useSettings } from './settings';
import { usePlaybackEngine } from './mix/usePlaybackEngine';
import { useMainTransportGuard } from './previewPlayback';
import { useEditorRepaintJob } from './useEditorRepaintJob';
import { useLandedReload } from './useLandedReload';
import { useSpaceTransport } from './useSpaceTransport';
import { useDockKeys } from './useDockKeys';
import { dockVerbs } from './dockVerbs';
import { scoreSongKey, useScorePick, useScoreVerb } from './useScoreVerb';
import { useEditorFocus } from './useEditorFocus';
import { useSectionLyrics } from './useSectionLyrics';
import { useRepaintSubmit } from './useRepaintSubmit';
import { useLyricsDraftSync } from './useLyricsDraftSync';
import { useLibraryBackButton } from './useLibraryBackButton';
import { useEditorColumns } from './useEditorColumns';
import { EditorTitleRow } from './EditorTitleRow';
import { EditorRail } from './EditorRail';
import { useEditorCommands } from './useEditorCommands';
import { pickRange, shownRange } from './editorSelection';
import { ScrollArea } from './ScrollArea';

interface Props {
  songId: string;
  onBack: () => void;
}

export function Editor({ songId, onBack }: Props) {
  const repaintSettings = useSettings((s) => s.repaint);
  const { song, loadError, reload } = useSongDetail(songId);
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Region | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lyricsDraft, setLyricsDraft] = useState('');
  // Per-session UI state, deliberately not persisted: every visit opens on REPAINT.
  const [verb, setVerb] = useState<DockVerb>('repaint');
  const repaintJob = useEditorRepaintJob(focusedLayerId);
  useLandedReload(songId, reload);

  useLyricsDraftSync(song, setLyricsDraft);
  const engine = usePlaybackEngine(song?.layers ?? []);
  useMainTransportGuard(engine);
  const playhead = engine.currentTime;
  useSpaceTransport(engine);
  const score = useScoreVerb(songId, scoreSongKey(song), reload);
  const verbs = dockVerbs(score.phase.kind !== 'hidden');
  useDockKeys(setVerb, verbs);
  useEditorFocus(song, focusedLayerId, setFocusedLayerId, setVerb);

  const focusedLayer = song?.layers.find((l) => l.id === focusedLayerId);
  const activeVersion = focusedLayer?.versions.find((v) => v.active);
  const duration = song?.duration ?? 0;
  const { timing, sections, activeSectionIndex, activeLyricsBlock, lyricsUnlocked } =
    useSectionLyrics(song, duration, selection, lyricsDraft, focusedLayer, reload);
  useEditorCommands({ song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setVerb });
  const scorePick = useScorePick(songId, verb, sections, lyricsDraft, score, timing.timings);

  const repaint = useRepaintSubmit({
    songId, focusedLayer, selection, duration, prompt, lyricsUnlocked, lyricsDraft, repaintSettings, setSelection, setPrompt,
    ...repaintJob,
  });

  const seek = (seconds: number) => engine.seek(seconds);
  const selectRegion = (region: Region | null) => pickRange(region, setSelection, setVerb, verb);
  const shownSelection = shownRange(verb, selection);

  useLibraryBackButton(onBack);
  const { railWidth, gridTemplateColumns } = useEditorColumns();

  const retryLoad = <button onClick={() => void reload()}>RETRY</button>;
  if (!song) {
    return loadError
      ? <div className="empty"><div className="error">couldn't load this song — {loadError} {retryLoad}</div></div>
      : <div className="empty">Loading…</div>;
  }

  return (
    <div className="editor-shell">
      <ScrollArea className="editor-scroll">
        <div className="with-panel editor-layout" style={{ gridTemplateColumns }}>
          <div className="editor-main">
            {loadError && <div className="error">couldn't refresh this song — {loadError} {retryLoad}</div>}
            <EditorTitleRow song={song} duration={duration} />

            <SectionStrip sections={sections} activeIndex={verb === 'repaint' ? activeSectionIndex : scorePick?.stripIndex ?? -1}
              onSelect={scorePick?.onStrip ?? selectRegion} onSeek={seek} />

            <LayerStack
              songId={songId}
              layers={song.layers}
              focusedLayerId={focusedLayerId}
              onFocus={setFocusedLayerId}
              onChanged={reload}
              duration={duration}
              playhead={playhead}
              selection={shownSelection}
              onSelect={selectRegion}
              onSeek={seek}
              processing={!!repaintJob.running}
              onSplit={(layerId) => { setFocusedLayerId(layerId); setVerb('split'); }}
              lyrics={{ draft: lyricsDraft, timings: timing.timings, timing, onLine: scorePick?.onLine, picked: scorePick?.lineIndex }}
            />

            <ActionDock
              verb={verb}
              verbs={verbs}
              score={score}
              scorePickable={scorePick?.pickable ?? false}
              onVerb={setVerb}
              song={song}
              focusedLayer={focusedLayer}
              selection={selection}
              onClearSelection={() => setSelection(null)}
              sections={sections}
              repaint={{
                prompt, onPromptChange: setPrompt, job: repaintJob, onRepaint: repaint,
                lyrics: { unlocked: lyricsUnlocked, draft: lyricsDraft, onDraftChange: setLyricsDraft, activeBlock: activeLyricsBlock },
              }}
              onChanged={reload}
            />

            {activeVersion && (
              <div className="canvas" style={{ marginTop: 12 }}>
                <Player engine={engine} downloadSrc={`/audio/${activeVersion.audio_file}`} downloadName={`${song.title}.wav`} minimal />
              </div>
            )}
          </div>
          {focusedLayer && (
            <EditorRail
              songId={songId}
              focusedLayer={focusedLayer}
              onSelectRegion={selectRegion}
              onLoadPrompt={(p) => { setPrompt(p); setVerb('repaint'); }}
              onChanged={reload}
              onResizePointerDown={railWidth.onPointerDown}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
