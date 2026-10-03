import { useSettings, genParams, outputParams } from './settings';
import { useVoiceStore, voiceParams } from './voiceStore';
import { useGenerationStore } from './generationStore';
import { busyMessage } from './generationJob';
import { useCreateDraftStore } from './createDraftStore';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import type { CreateDraft } from './createDraft';
import { useEngineCaps } from './useEngineCaps';
import { AUTO_CONTROLS, useEngineSettings } from './engineSettings';
import { enginePromptParams } from './engineRequest';
import { recipeEtaKey } from './recipeCopy';
import { useCreateSubmit } from './useCreateSubmit';
import { RecipeCommit } from './RecipeCommit';

/** AN IDEA's GENERATE, at the foot of the RECIPE card (was PromptGenerateRow.tsx). Reads the
 * shared draft directly. `stepsModel` is the DiT model this take runs (AUTO resolved to the
 * inventory default), which QUALITY's steps resolve against. */
export function IdeaCommit({ thinking, onBack, stepsModel }: { thinking: boolean; onBack: () => void; stepsModel: string }) {
  const gen = useSettings((s) => s.gen);
  const voice = useVoiceStore();
  const draft = useCreateDraftStore();
  const blockedBy = useGenerationStore((s) => busyMessage(s.job, s.otherLock));
  const startGeneration = useGenerationStore((s) => s.start);
  const { id: engineId, info: engine } = useEngineCaps();
  const controls = useEngineSettings((s) => s.values[engineId]);
  const { submitting, error, submit } = useCreateSubmit(onBack, recipeEtaKey('prompt', engineId, stepsModel, gen.quality));
  // Also covers "not loaded yet": an extra engine's GENERATE waits for its descriptor.
  const engineBlocked = engineId !== 'acestep' && !engine?.ready;
  const busy = submitting || !!blockedBy;

  const { title, prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration, folderId, formatted } = draft;

  const generate = () => submit(() => {
    const retryDraft: CreateDraft = {
      genType: 'prompt', prompt, lyrics, bpm, keyScale, timeSignature, duration,
      ...(folderId ? { folderId, folderName: draft.folderName } : {}),
      ...(engineId !== 'acestep' ? { engine: engineId } : {}),
    };
    // AI ENHANCE re-formats whatever prompt/lyrics it's given — fine for hand-typed text, but
    // re-running it on text the LM already produced is what garbled the sung output (see
    // jobs.ts persistSong). Suppress it for this one generation rather than flipping the
    // persisted setting, so it's back next time you type.
    const effectiveGen = formatted ? { ...gen, useFormat: false } : gen;
    return startGeneration(engine ? enginePromptParams(
      { title, prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration, folderId },
      engine.capabilities, gen, { ...AUTO_CONTROLS, ...controls }, outputParams(),
    ) : {
      title: title || 'Untitled', prompt, lyrics,
      ...(bpm > 0 ? { bpm } : {}),
      ...(keyScale ? { key_scale: keyScale } : {}),
      ...(timeSignature ? { time_signature: timeSignature } : {}),
      ...(vocalLanguage ? { vocal_language: vocalLanguage } : {}),
      ...(duration > 0 ? { audio_duration: duration } : {}),
      ...genParams(effectiveGen, stepsModel), ...voiceParams(voice),
      ...(folderId ? { folder_id: folderId } : {}),
    }, retryDraft, engine ? undefined : voice.uploadedRefFile ?? undefined);
  });

  return (
    <RecipeCommit label="GENERATE" submitting={submitting} blocked={blockedBy} error={error} onClick={generate}
      disabled={busy || !prompt || thinking || engineBlocked}>
      {engine?.capabilities.consequence && <div className="hint">{engine.capabilities.consequence}</div>}
      <ActiveAdapterNote notAppliedBy={engine && !engine.capabilities.adapters ? engine.label : undefined} />
    </RecipeCommit>
  );
}
