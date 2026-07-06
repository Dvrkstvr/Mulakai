import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type SongDetail } from './api';
import type { Region } from './Waveform';
import { Player } from './Player';
import { VersionHistory } from './VersionHistory';
import { ExportPanel } from './ExportPanel';
import { SplitPanel } from './SplitPanel';
import { LayerStack } from './LayerStack';
import { SectionStrip } from './SectionStrip';
import { groupSections, findActiveSectionIndex } from './lyricSections';
import { splitLyricsBlocks, matchSectionBlocks } from './lyricsBlocks';
import { LyricsPanel } from './LyricsPanel';
import { RepaintBar } from './RepaintBar';
import { SettingsPanel } from './SettingsPanel';
import { useSettings, repaintParams } from './settings';
import { REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS } from './repaintLimits';
import { usePlaybackEngine } from './mix/usePlaybackEngine';
import { useHeaderSlot } from './HeaderSlot';
import { useGenerationStore } from './generationStore';

interface Props {
  songId: string;
  onBack: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Editor({ songId, onBack }: Props) {
  const repaintSettings = useSettings((s) => s.repaint);
  const [song, setSong] = useState<SongDetail | null>(null);
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Region | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [job, setJob] = useState<'idle' | 'running'>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [railMode, setRailMode] = useState<'history' | 'export' | 'split'>('history');
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  // A song generating in the Library, or another editor action already running, both hold the
  // same global lock (see server genLock.ts) — either one blocks repaint here too.
  const busyElsewhere = (!!genJob || !!otherLock) && job !== 'running';

  const reload = useCallback(() => api.songDetail(songId).then(setSong).catch(() => {}), [songId]);
  useEffect(() => { reload(); }, [reload]);

  // Re-sync the editable lyrics draft only when the *canonical* text actually
  // changes (new song, or this song's lyrics were updated by a repaint/revert)
  // — not on every reload() (layer mutes, added layers, etc. would otherwise
  // wipe an in-progress edit that hasn't been repainted yet).
  useEffect(() => {
    setLyricsDraft(song?.lyrics ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, song?.lyrics]);

  const engine = usePlaybackEngine(song?.layers ?? []);
  const playhead = engine.currentTime;

  // Space toggles play/pause; a second press within the window stops
  // instead (seeks to 0) — checked via ref so this only subscribes once
  // and isn't torn down/re-added on every playhead-driven re-render.
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const spaceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const DOUBLE_PRESS_MS = 300;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      if (spaceTimerRef.current !== null) {
        window.clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
        engineRef.current.stop();
        return;
      }
      spaceTimerRef.current = window.setTimeout(() => {
        spaceTimerRef.current = null;
        const live = engineRef.current;
        if (live.isPlaying) live.pause(); else void live.play();
      }, DOUBLE_PRESS_MS);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Default focus to the base layer once the song loads; keep focus if the layer still exists.
  useEffect(() => {
    if (!song) return;
    if (focusedLayerId && song.layers.some((l) => l.id === focusedLayerId)) return;
    setFocusedLayerId(song.layers.find((l) => l.kind === 'base')?.id ?? song.layers[0]?.id ?? null);
  }, [song, focusedLayerId]);

  const focusedLayer = song?.layers.find((l) => l.id === focusedLayerId);
  const activeVersion = focusedLayer?.versions.find((v) => v.active);
  const duration = song?.duration ?? 0;

  // Section structure comes from the base layer's active render (the whole song),
  // not the focused layer — a focused stem shares the song's section timeline.
  const baseActive = song?.layers.find((l) => l.kind === 'base')?.versions.find((v) => v.active);
  const sections = useMemo(
    () => groupSections(baseActive?.lyricTimestamps, duration),
    [baseActive, duration],
  );
  const activeSectionIndex = useMemo(() => findActiveSectionIndex(sections, selection), [sections, selection]);

  // Parsed from the live draft (not the stored song.lyrics) so block char-offsets
  // stay correct as the user edits — re-splitting on every keystroke is cheap at
  // lyric-text length, and it means highlighting a later block after editing an
  // earlier one doesn't drift out of sync with the shifted text.
  const lyricsBlocks = useMemo(() => splitLyricsBlocks(lyricsDraft), [lyricsDraft]);
  const matchedBlocks = useMemo(() => matchSectionBlocks(sections, lyricsBlocks), [sections, lyricsBlocks]);
  const activeLyricsBlock = activeSectionIndex !== -1 ? matchedBlocks[activeSectionIndex] : null;
  // Lyrics live on the song, not the layer — editing only makes sense (and
  // only gets sent as repaint conditioning) while repainting the base layer.
  const canEditLyrics = focusedLayer?.kind === 'base';
  const lyricsUnlocked = canEditLyrics && activeSectionIndex !== -1;

  const regionSeconds = selection ? selection.end - selection.start : 0;
  const regionValid = !!selection && regionSeconds >= REPAINT_MIN_SECONDS && regionSeconds <= REPAINT_MAX_SECONDS;

  const repaint = async () => {
    if (!focusedLayer || !regionValid || !selection || busyElsewhere) return;
    setError('');
    setJob('running');
    setStartedAt(Date.now());
    try {
      const { jobId } = await api.repaint(focusedLayer.id, {
        prompt,
        start: selection.start,
        end: selection.end,
        ...(lyricsUnlocked ? { lyrics: lyricsDraft } : {}),
        ...repaintParams(repaintSettings),
      });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'done') break;
        if (s.status === 'failed') throw new Error(s.error ?? 'repaint failed');
      }
      setSelection(null);
      setPrompt('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJob('idle');
    }
  };

  const revert = async (versionId: string) => {
    await api.activateVersion(versionId);
    await reload();
  };

  const seek = (seconds: number) => engine.seek(seconds);

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>← LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  if (!song) return <div className="empty">Loading…</div>;

  return (
    <div className="editor-shell">
      <div className="with-panel editor-layout">
        <div className="left-rail">
          <LyricsPanel
            blocks={lyricsBlocks}
            draft={lyricsDraft}
            onDraftChange={setLyricsDraft}
            activeBlock={activeLyricsBlock}
            unlocked={lyricsUnlocked}
          />
          <SettingsPanel mode="repaint" />
        </div>
        <div className="editor-main">
      <div className="title-row">
        <span className="song-title">{song.title}</span>
        <span className="meta">
          {duration ? fmt(duration) : ''}{song.bpm ? ` · ${song.bpm} bpm` : ''}{song.key_scale ? ` · ${song.key_scale}` : ''}
          {` · ${song.layers.length} layer${song.layers.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <RepaintBar
        layerName={focusedLayer?.name ?? 'base'}
        nextVersion={(focusedLayer?.versions.length ?? 0) + 1}
        selection={selection}
        prompt={prompt}
        onPromptChange={setPrompt}
        job={job}
        startedAt={startedAt}
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
          <div className="rail">
            {railMode === 'history' ? (
              <>
                <VersionHistory
                  versions={focusedLayer.versions}
                  onSelectRegion={setSelection}
                  onLoadPrompt={setPrompt}
                  onRevert={revert}
                  onChanged={reload}
                />
                <button className="rail-export-btn" onClick={() => setRailMode('export')}><span>EXPORT</span></button>
              </>
            ) : railMode === 'export' ? (
              <ExportPanel song={song} onBack={() => setRailMode('history')} />
            ) : (
              <SplitPanel
                layer={focusedLayer}
                onChanged={reload}
                onBack={() => setRailMode('history')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
