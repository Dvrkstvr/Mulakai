import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Song, type RefineResult } from './api';
import { RefineRail } from './RefineRail';
import { useVoiceStore } from './voiceStore';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { isGenerating } from './generationJob';
import { useLookup } from './lookup';
import { ClearDraftButton } from './ClearDraftButton';
import { StartFromCards } from './StartFromCards';
import { IdeaSteps } from './IdeaSteps';
import { CoverSteps } from './CoverSteps';
import { TrackSteps } from './TrackSteps';
import { useEngineStore } from './engineStore';

/** Dedicated Create takeover — reached from the Library create bar or the Library detail
 * rail's REUSE PROMPT / CREATE COVER FROM AUDIO actions, per docs/design/DESIGN.md.
 * Submitting a generation hands it off to generationStore.ts and returns to the library
 * immediately — the library's GeneratingCard tracks it to completion from there.
 *
 * This is the shell only (PLAN.md "S2 — Guided Create"): the title row, the START FROM cards,
 * and the chosen flow — IdeaSteps / CoverSteps / TrackSteps — which renders its numbered steps
 * and its RECIPE card side by side. The draft lives in createDraftStore.ts (App.tsx loads it at
 * navigation time), so the three flows share one song intent and switching loses nothing. */
export function CreateView({ songs, onBack }: { songs: Song[]; onBack: () => void }) {
  const draft = useCreateDraftStore();
  const { genType, title, folderId, folderName } = draft;
  const patch = draft.patch;
  const genRunning = useGenerationStore((s) => isGenerating(s.job));
  // One model list for every flow: TUNE's selects, and AUTO model's family for QUALITY.
  const inventory = useLookup(api.listModels);

  const [refining, setRefining] = useState(false);
  const [refinePreview, setRefinePreview] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState('');

  // Prefills Title with "<Folder Name>" (or "<Folder Name> <n>" past the highest number
  // already used there) when Create was opened from/for a specific folder — still a plain
  // editable value, not a locked default. Skipped if the field already has content so it never
  // clobbers something the user already put there. Re-runs on `revision` so a freshly loaded or
  // cleared draft gets a suggestion again, both of which blank the title without changing folder.
  useEffect(() => {
    if (!folderId || title) return;
    api.nextFolderTitle(folderId).then((r) => patch({ title: r.title, titleSuggested: true })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, draft.revision]);

  // Fresh engine health each time Create opens: it gates the RECIPE's ENGINE row.
  useEffect(() => { void useEngineStore.getState().load(); }, []);

  // Re-apply a reused song's reference audio (voice + the influences it was rendered at).
  // Keyed on the draft's own values so a fresh draft re-runs it — including the no-reference
  // case, which clears any stale "voice missing" warning.
  useEffect(() => {
    void useVoiceStore.getState().restoreReference(
      draft.referenceLabel, draft.referenceAudioInfluence, draft.referenceStyleInfluence,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.referenceLabel, draft.referenceAudioInfluence, draft.referenceStyleInfluence]);

  const refine = async () => {
    setRefineError('');
    setRefining(true);
    try {
      setRefinePreview(await api.refineInput({
        prompt: draft.prompt, lyrics: draft.lyrics,
        ...(draft.bpm > 0 ? { bpm: draft.bpm } : {}),
        ...(draft.keyScale ? { key_scale: draft.keyScale } : {}),
        ...(draft.timeSignature ? { time_signature: draft.timeSignature } : {}),
        ...(draft.vocalLanguage ? { vocal_language: draft.vocalLanguage } : {}),
        ...(draft.duration > 0 ? { audio_duration: draft.duration } : {}),
      }));
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefining(false);
    }
  };

  const closeRefine = () => {
    setRefinePreview(null);
    setRefineError('');
  };

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  const showRail = refining || !!refinePreview || !!refineError;
  const rail = showRail ? (
    <RefineRail refining={refining} preview={refinePreview} error={refineError} current={draft}
      onRefine={refine} onClose={closeRefine}
      onAccept={{
        prompt: (v) => patch({ prompt: v, formatted: true }),
        lyrics: (v) => patch({ lyrics: v, formatted: true }),
        bpm: (v) => patch({ bpm: v }),
        keyScale: (v) => patch({ keyScale: v }),
        timeSignature: (v) => patch({ timeSignature: v }),
        vocalLanguage: (v) => patch({ vocalLanguage: v }),
        duration: (v) => patch({ duration: v }),
      }} />
  ) : null;

  return (
    <div className="create-shell">
      <ScrollArea className="create-guided">
        <div className="title-row create-title-row">
          <input className="create-title" placeholder="New song" aria-label="Title" value={title}
            onChange={(e) => patch({ title: e.target.value, titleSuggested: false })} />
          <span className="meta">will appear in {folderName ? <span className="dest">{folderName}</span> : 'your library'} once generated</span>
          <ClearDraftButton disabled={genRunning} />
        </div>
        <StartFromCards />
        <div className="create-body">
          {genType === 'prompt' && <IdeaSteps refining={refining} onRefine={refine} onBack={onBack} rail={rail} inventory={inventory} />}
          {genType === 'audio' && <CoverSteps songs={songs} onBack={onBack} inventory={inventory} />}
          {genType === 'complete' && <TrackSteps onBack={onBack} inventory={inventory} />}
        </div>
      </ScrollArea>
    </div>
  );
}
