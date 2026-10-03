import type { Region } from './Waveform';
import type { LyricsBlock } from './lyricsBlocks';
import type { DockTarget } from './dockTarget';
import { repaintCommitLabel, repaintConsequence, repaintWarnLine } from './dockTarget';
import { maxCrossfadeSec, clampCrossfade } from './repaintLimits';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
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
  /** The version this repaint will save (counting this layer's takes already on their way),
   * and the active one it keeps — stated before commit. */
  nextVersion: number;
  activeVersion: number | null;
  selection: Region | null;
  /** The song's length (0 = unknown), which a whole-layer repaint covers. */
  duration: number;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  job: Pick<ReturnType<typeof useEditorRepaintJob>, 'inFlight' | 'failed' | 'error'>;
  onRepaint: () => void;
  lyrics: SectionLyrics;
}

/** REPAINT: instruction, VARIANCE + CROSSFADE inline, the one-section lyrics editor, TUNE, commit. */
export function DockRepaint({ target, layerName, nextVersion, activeVersion, selection, duration, prompt, onPromptChange, job, onRepaint, lyrics }: Props) {
  const { inFlight, failed, error } = job;
  const ahead = useJobsAhead();
  const repaint = useSettings((s) => s.repaint);
  const setRepaint = useSettings((s) => s.setRepaint);
  const regionSeconds = selection ? selection.end - selection.start : 0;
  const crossfadeOn = !!selection && !target.warn;

  const consequence = target.warn
    ? repaintWarnLine(selection, duration)
    : repaintConsequence(layerName, nextVersion, activeVersion, selection, target.section) + queueSuffix(ahead);

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
        label={repaintCommitLabel(layerName, selection, target.section)}
        disabled={target.warn}
        onCommit={onRepaint}
        jobs={inFlight}
      />
      <ActiveAdapterNote />
      {error && <div className="error">{error} <button onClick={() => failed?.retry?.()}>RETRY</button></div>}
    </>
  );
}
