import type { Region } from './Waveform';
import type { WordsSpan } from './sectionWords';
import type { DockTarget } from './dockTarget';
import { repaintCommitLabel, repaintLine } from './dockTarget';
import { maxCrossfadeSec, clampCrossfade } from './repaintLimits';
import { useJobsAhead } from './queueStore';
import { useSettings } from './settings';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import { VarianceSlider } from './VarianceSlider';
import { RepaintTune } from './RepaintTune';
import { DockWords } from './DockWords';
import { DockCommit } from './DockCommit';
import type { useEditorRepaintJob } from './useEditorRepaintJob';

export interface SectionLyrics {
  unlocked: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  /** The words the selection covers (sectionWords), whatever layer is focused; null = none. */
  words: WordsSpan | null;
  songLyrics: string;
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
  /** SCORE is still open for the song: the line says this edit ends score editing (F-027). */
  scoreOpen: boolean;
}

/** REPAINT: instruction, VARIANCE + CROSSFADE inline, the words for the selected part (on BASE), TUNE, commit. */
export function DockRepaint({ target, layerName, nextVersion, activeVersion, selection, duration, prompt, onPromptChange, job, onRepaint, lyrics, scoreOpen }: Props) {
  const { inFlight, failed, error } = job;
  const ahead = useJobsAhead();
  const repaint = useSettings((s) => s.repaint);
  const setRepaint = useSettings((s) => s.setRepaint);
  const regionSeconds = selection ? selection.end - selection.start : 0;
  const crossfadeOn = !!selection && !target.warn;

  const consequence = repaintLine(target, { layerName, nextVersion, activeVersion, selection, duration, ahead, scoreOpen });

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
        {lyrics.unlocked && lyrics.words && (
          <DockWords span={lyrics.words} draft={lyrics.draft} songLyrics={lyrics.songLyrics} onDraftChange={lyrics.onDraftChange} />
        )}
        {!lyrics.unlocked && lyrics.words && (
          <div className="lyrics-hint">words belong to the BASE layer · select on BASE to change {lyrics.words.label}&apos;s words</div>
        )}
        <RepaintTune />
      </div>
      <DockCommit
        consequence={consequence.line}
        scoreEnds={consequence.scoreEnds}
        label={repaintCommitLabel(layerName, selection, target.section)}
        disabled={target.warn || !!target.idle}
        onCommit={onRepaint}
        jobs={inFlight}
      />
      <ActiveAdapterNote />
      {error && <div className="error">{error} <button onClick={() => failed?.retry?.()}>RETRY</button></div>}
    </>
  );
}
