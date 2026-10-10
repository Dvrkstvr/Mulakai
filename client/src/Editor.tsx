import { useCallback, useMemo, useState } from 'react';
import { useSongDetail } from './useSongDetail';
import type { Region } from './Waveform';
import { EditorTransport } from './EditorTransport';
import { LayerStack } from './LayerStack';
import { SectionStrip } from './SectionStrip';
import { ActionDock } from './ActionDock';
import type { DockVerb } from './dockTarget';
import { useSettings } from './settings';
import { usePlaybackEngine } from './mix/usePlaybackEngine';
import { useAudition } from './useAudition';
import { scoreOpen } from './scoreEnds';
import { AuditionNote } from './AuditionNote';
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
import { ExportButton, ExportPanel } from './ExportPanel';
import { useEditorJobStore } from './editorJobStore';
import { useEditorColumns } from './useEditorColumns';
import { EditorTitleRow } from './EditorTitleRow';
import { EditorRail } from './EditorRail';
import { railLyricsRows } from './railLyricsRows';
import { useEditorCommands } from './useEditorCommands';
import { pickRange } from './editorSelection';
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
  const [verb, setVerb] = useState<DockVerb | null>(null);
  // EXPORT is the header's menu, not an action (PR 10): anything that opens 'export' opens it.
  const [exportOpen, setExportOpen] = useState(false);
  const openVerb = useCallback((v: DockVerb | null) => (v === 'export' ? setExportOpen(true) : setVerb(v)), []);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const remastering = useEditorJobStore((s) => s.editorJobs.some((j) => j.kind === 'remaster' && j.songId === songId && j.stage === 'running'));
  const exportButton = useMemo(() => <ExportButton open={exportOpen} remastering={remastering} onToggle={() => setExportOpen((o) => !o)} />,
    [exportOpen, remastering]);
  const repaintJob = useEditorRepaintJob(focusedLayerId);
  useLandedReload(songId, reload);

  useLyricsDraftSync(song, lyricsDraft, setLyricsDraft);
  const audition = useAudition(song, reload);
  const engine = usePlaybackEngine(audition.layers);
  useMainTransportGuard(engine);
  const playhead = engine.currentTime;
  useSpaceTransport(engine);
  const score = useScoreVerb(songId, scoreSongKey(song), reload);
  const verbs = dockVerbs(score.phase.kind !== 'hidden');
  useDockKeys(openVerb, verbs);
  useEditorFocus(song, focusedLayerId, setFocusedLayerId, openVerb);

  const focusedLayer = song?.layers.find((l) => l.id === focusedLayerId);
  const activeVersion = focusedLayer?.versions.find((v) => v.active);
  const duration = song?.duration ?? 0;
  const { timing, sections, activeSectionIndex, lyricsBlocks, matchedBlocks, words, lyricsUnlocked } =
    useSectionLyrics(song, duration, selection, lyricsDraft, focusedLayer, reload);
  useEditorCommands({ song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setVerb: openVerb });
  const scorePick = useScorePick(songId, verb, sections, lyricsDraft, score, timing.timings);

  const repaint = useRepaintSubmit({
    songId, focusedLayer, selection, duration, prompt, lyricsUnlocked, lyricsDraft, repaintSettings, setSelection, setPrompt,
    ...repaintJob,
  });

  const seek = (seconds: number) => engine.seek(seconds);
  const selectRegion = (region: Region | null) => pickRange(region, setSelection);

  useLibraryBackButton(onBack, exportButton);
  const { railWidth, gridTemplateColumns } = useEditorColumns();

  const retryLoad = <button onClick={() => void reload()}>RETRY</button>;
  if (!song) {
    return loadError
      ? <div className="empty"><div className="error">couldn't load this song — {loadError} {retryLoad}</div></div>
      : <div className="empty">Loading…</div>;
  }

  return (
    <div className="editor-shell">
      <ExportPanel song={song} open={exportOpen} onClose={closeExport} />
      <ScrollArea className="editor-scroll">
        <div className="with-panel editor-layout" style={{ gridTemplateColumns }}>
          <div className="editor-main">
            {loadError && <div className="error">couldn't refresh this song — {loadError} {retryLoad}</div>}
            <EditorTitleRow song={song} duration={duration} />

            <SectionStrip sections={sections} activeIndex={verb !== 'score' ? activeSectionIndex : scorePick?.stripIndex ?? -1}
              onSelect={scorePick?.onStrip ?? selectRegion} onSeek={seek} />

            <LayerStack
              songId={songId}
              layers={song.layers}
              focusedLayerId={focusedLayerId}
              onFocus={setFocusedLayerId}
              onChanged={reload}
              duration={duration}
              playhead={playhead}
              selection={selection}
              onSelect={selectRegion}
              onSeek={seek}
              processing={!!repaintJob.running}
              onSplit={(layerId) => { setFocusedLayerId(layerId); setVerb('split'); }}
              takes={{ hearing: audition.hearing, onUse: audition.use, onHear: audition.hear }}
              scoreOpen={scoreOpen(score)}
              lyrics={{ draft: lyricsDraft, timings: timing.timings, timing, onLine: scorePick?.onLine, picked: scorePick?.lineIndex }}
            />

            <ActionDock
              verb={verb}
              verbs={verbs}
              score={score}
              scorePickable={scorePick?.pickable ?? false}
              onVerb={openVerb}
              song={song}
              focusedLayer={focusedLayer}
              selection={selection}
              onClearSelection={() => setSelection(null)}
              sections={sections}
              repaint={{
                prompt, onPromptChange: setPrompt, job: repaintJob, onRepaint: repaint,
                lyrics: { unlocked: lyricsUnlocked, draft: lyricsDraft, onDraftChange: setLyricsDraft, words, songLyrics: song.lyrics ?? '' },
              }}
            />

            {activeVersion && (
              <div className="canvas" style={{ marginTop: 12 }}>
                {audition.note && <AuditionNote note={audition.note} onBack={audition.back} onUse={audition.use} />}
                {audition.error && <div className="error">{audition.error}</div>}
                <EditorTransport engine={engine} selection={selection} />
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
              lyrics={railLyricsRows(lyricsBlocks, sections, matchedBlocks, activeSectionIndex)}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
