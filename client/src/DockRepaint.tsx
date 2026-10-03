import type { Region } from './Waveform';
import type { LyricsBlock } from './lyricsBlocks';
import type { DockTarget } from './dockTarget';
import { repaintCommitLabel, repaintConsequence, repaintWarnLine } from './dockTarget';
import { maxCrossfadeSec, clampCrossfade } from './repaintLimits';
import { fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';
import { waitLabel } from './generationJob';
import { useSettings } from './settings';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import { VarianceSlider } from './VarianceSlider';
import { RepaintTune } from './RepaintTune';
import { DockSectionLyrics } from './DockSectionLyrics';
import { DockCommit } from './DockCommit';
import type { useEditorRepaintJob } from './useEditorRepaintJob';

export interface SectionLyrics {
  unlocked: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  activeBlock: LyricsBlock | null;
}

interface Props {
  target: DockTarget;
  layerName: string;
  /** The version this repaint will save, and the active one it keeps — stated before commit. */
  nextVersion: number;
  activeVersion: number | null;
  selection: Region | null;
  /** The song's length (0 = unknown), which a whole-layer repaint covers. */
  duration: number;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  job: Pick<ReturnType<typeof useEditorRepaintJob>, 'job' | 'startedAt' | 'myRepaint' | 'busyBy' | 'error'>;
  onRepaint: () => void;
  lyrics: SectionLyrics;
}

/** REPAINT: instruction, VARIANCE + CROSSFADE inline, the one-section lyrics editor, TUNE, commit. */
export function DockRepaint({ target, layerName, nextVersion, activeVersion, selection, duration, prompt, onPromptChange, job, onRepaint, lyrics }: Props) {
  const { job: stage, startedAt, myRepaint, busyBy, error } = job;
  const running = stage === 'running';
  const elapsedMs = useElapsedMs(running, startedAt);
  const repaint = useSettings((s) => s.repaint);
  const setRepaint = useSettings((s) => s.setRepaint);
  const regionSeconds = selection ? selection.end - selection.start : 0;
  const crossfadeOn = !!selection && !target.warn;

  const label = running
    ? `REPAINTING… ${fmtElapsed(elapsedMs)}${fmtProgress(myRepaint?.progress) ? ` · ${fmtProgress(myRepaint?.progress)}` : ''}${stageDetail(myRepaint?.progressStage) ? ` · ${stageDetail(myRepaint?.progressStage)}` : ''}`
    : busyBy ? waitLabel(busyBy) : repaintCommitLabel(layerName, selection, target.section);
  const consequence = target.warn
    ? repaintWarnLine(selection, duration)
    : repaintConsequence(layerName, nextVersion, activeVersion, selection, target.section);

  return (
    <>
      <div className="dock-body">
        <input
          className="dock-prompt"
          placeholder="Describe what should change in the selected region"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <div className="dock-row">
          <div className="dock-variance">
            <VarianceSlider value={Math.round(repaint.repaintStrength * 100)} onChange={(v) => setRepaint({ repaintStrength: v / 100 })} />
          </div>
          <div className="crossfade-setting" title={crossfadeOn ? undefined : 'a crossfade blends a region into the take around it'}>
            <span className="crossfade-label">CROSSFADE</span>
            <input
              type="number"
              className="crossfade-input"
              min={0}
              max={maxCrossfadeSec(regionSeconds)}
              step={0.1}
              disabled={!crossfadeOn}
              value={clampCrossfade(repaint.crossfadeSec, regionSeconds)}
              onChange={(e) => setRepaint({ crossfadeSec: clampCrossfade(Number(e.target.value), regionSeconds) })}
            />
            <span className="crossfade-unit">s</span>
          </div>
        </div>
        {target.section && lyrics.unlocked && (
          <DockSectionLyrics section={target.section} draft={lyrics.draft} onDraftChange={lyrics.onDraftChange} activeBlock={lyrics.activeBlock} />
        )}
        {target.section && !lyrics.unlocked && <div className="lyrics-hint">focus BASE to edit {target.section} lyrics</div>}
        <RepaintTune />
      </div>
      <DockCommit
        consequence={consequence}
        label={label}
        disabled={target.warn || !!busyBy}
        running={running}
        progress={myRepaint?.progress}
        title={running ? myRepaint?.progressText : undefined}
        onCommit={onRepaint}
      />
      <ActiveAdapterNote />
      {busyBy && !running && <div className="hint">only one job can use the GPU at a time — try again once it finishes</div>}
      {error && <div className="error">{error} <button onClick={onRepaint}>RETRY</button></div>}
    </>
  );
}
