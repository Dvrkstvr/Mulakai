import { useCallback, useEffect, useState } from 'react';
import { api, type SongDetail } from './api';
import type { Region } from './Waveform';
import { Player } from './Player';
import { LayerStack } from './LayerStack';
import { SectionStrip } from './SectionStrip';
import { RepaintBar } from './RepaintBar';
import { useSettings } from './settings';
import { usePlaybackEngine } from './mix/usePlaybackEngine';
import { useMainTransportGuard } from './previewPlayback';
import { useAddLayerExpanded } from './useAddLayerExpanded';
import { useEditorRepaintJob } from './useEditorRepaintJob';
import { useSpaceTransport } from './useSpaceTransport';
import { useEditorFocus } from './useEditorFocus';
import { useSectionLyrics } from './useSectionLyrics';
import { useRepaintSubmit } from './useRepaintSubmit';
import { useLyricsDraftSync } from './useLyricsDraftSync';
import { useLibraryBackButton } from './useLibraryBackButton';
import { useEditorColumns } from './useEditorColumns';
import { EditorLeftRail } from './EditorLeftRail';
import { EditorTitleRow } from './EditorTitleRow';
import { EditorRail, type RailMode } from './EditorRail';

interface Props {
  songId: string;
  onBack: () => void;
}

export function Editor({ songId, onBack }: Props) {
  const repaintSettings = useSettings((s) => s.repaint);
  const [song, setSong] = useState<SongDetail | null>(null);
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Region | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [railMode, setRailMode] = useState<RailMode>('history');
  const { addingLayerExpanded, requestAddingLayerExpanded } = useAddLayerExpanded();
  const { startRepaint, dismissEditorJob, myRepaint, job, startedAt, error, busyElsewhere } = useEditorRepaintJob(focusedLayerId);

  const reload = useCallback(() => api.songDetail(songId).then(setSong).catch(() => {}), [songId]);
  useEffect(() => { reload(); }, [reload]);

  useLyricsDraftSync(song, setLyricsDraft);
  const engine = usePlaybackEngine(song?.layers ?? []);
  useMainTransportGuard(engine);
  const playhead = engine.currentTime;
  useSpaceTransport(engine);
  useEditorFocus(song, focusedLayerId, setFocusedLayerId, setRailMode);

  const focusedLayer = song?.layers.find((l) => l.id === focusedLayerId);
  const activeVersion = focusedLayer?.versions.find((v) => v.active);
  const duration = song?.duration ?? 0;
  const { timing, sections, activeSectionIndex, lyricsBlocks, activeLyricsBlock, lyricsUnlocked } =
    useSectionLyrics(song, duration, selection, lyricsDraft, focusedLayer, reload);

  const repaint = useRepaintSubmit({
    songId, focusedLayer, selection, prompt, lyricsUnlocked, lyricsDraft, repaintSettings,
    startRepaint, dismissEditorJob, myRepaint, busyElsewhere, setSelection, setPrompt, reload,
  });

  const seek = (seconds: number) => engine.seek(seconds);

  useLibraryBackButton(onBack);
  const { leftWidth, railWidth, gridTemplateColumns } = useEditorColumns();

  if (!song) return <div className="empty">Loading…</div>;

  return (
    <div className="editor-shell">
      <div className="with-panel editor-layout" style={{ gridTemplateColumns }}>
        <EditorLeftRail
          addingLayerExpanded={addingLayerExpanded}
          requestAddingLayerExpanded={requestAddingLayerExpanded}
          lyricsBlocks={lyricsBlocks}
          lyricsDraft={lyricsDraft}
          onLyricsDraftChange={setLyricsDraft}
          activeLyricsBlock={activeLyricsBlock}
          lyricsUnlocked={lyricsUnlocked}
          lyricsTiming={timing}
          lyricsLines={{ timings: timing.timings, duration, selection, onSelect: setSelection, onSeek: seek }}
          songLyrics={song.lyrics}
          onResizePointerDown={leftWidth.onPointerDown}
        />
        <div className="editor-main">
      <EditorTitleRow song={song} duration={duration} />

      <RepaintBar
        layerName={focusedLayer?.name ?? 'base'}
        nextVersion={(focusedLayer?.versions.length ?? 0) + 1}
        selection={selection}
        prompt={prompt}
        onPromptChange={setPrompt}
        job={job}
        startedAt={startedAt}
        progress={myRepaint?.progress}
        progressStage={myRepaint?.progressStage}
        progressText={myRepaint?.progressText}
        busyElsewhere={busyElsewhere}
        onRepaint={repaint}
        error={error}
      />

      <SectionStrip sections={sections} activeIndex={activeSectionIndex} onSelect={setSelection} onSeek={seek} />

      <LayerStack
        songId={songId}
        layers={song.layers}
        focusedLayerId={focusedLayerId}
        onFocus={setFocusedLayerId}
        onChanged={reload}
        duration={duration}
        playhead={playhead}
        selection={selection}
        onSelect={setSelection}
        onSeek={seek}
        processing={job === 'running'}
        onSplit={(layerId) => { setFocusedLayerId(layerId); setRailMode('split'); }}
        onAddLayerExpandedChange={requestAddingLayerExpanded}
      />

      {activeVersion && (
        <div className="canvas" style={{ marginTop: 12 }}>
          <Player
            engine={engine}
            downloadSrc={`/audio/${activeVersion.audio_file}`}
            downloadName={`${song.title}.wav`}
            minimal
          />
        </div>
      )}
        </div>
        {focusedLayer && (
          <EditorRail
            songId={songId}
            song={song}
            focusedLayer={focusedLayer}
            railMode={railMode}
            onRailModeChange={setRailMode}
            onSelectRegion={setSelection}
            onLoadPrompt={setPrompt}
            onChanged={reload}
            onResizePointerDown={railWidth.onPointerDown}
          />
        )}
      </div>
    </div>
  );
}
