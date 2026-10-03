import type { CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useSettings, genParams } from './settings';
import { recipeEtaKey } from './recipeCopy';
import { useCreateSubmit } from './useCreateSubmit';

/** ARRANGE: ACE-Step's `complete` task around one bare source track, persisted as a new song.
 * The flow's own MODEL is what runs (and what QUALITY resolves on); it is spread after the
 * shared settings so AN IDEA's DIT MODEL can't replace the Base model `complete` needs. */
export function useTrackGenerate(onBack: () => void) {
  const draft = useCreateDraftStore();
  const gen = useSettings((s) => s.gen);
  const voice = useVoiceStore();
  const startComplete = useGenerationStore((s) => s.startComplete);
  const { source, uploadFile, scratchSource, model } = draft.arrange;
  const { submitting, error, submit } = useCreateSubmit(onBack, recipeEtaKey('complete', 'acestep', model, gen.quality));
  const { title, prompt, lyrics, bpm, keyScale, duration, folderId } = draft;

  const generate = () => submit(async () => {
    const retryDraft: CreateDraft = { genType: 'complete', prompt, lyrics, bpm, keyScale, duration };
    const src = source === 'upload'
      ? (uploadFile ? { file: uploadFile } : null)
      : (scratchSource ? { scratchJobId: scratchSource.jobId, scratchStemKind: scratchSource.kind } : null);
    if (!src) throw new Error(source === 'upload' ? 'choose an audio file to upload' : 'split a song and pick a stem to use as the source');
    await startComplete(
      {
        title: title || 'Untitled', prompt, lyrics, ...genParams(gen, model), ...(model ? { model } : {}),
        ...(bpm > 0 ? { bpm } : {}),
        ...(keyScale ? { key_scale: keyScale } : {}),
        ...(duration > 0 ? { audio_duration: duration } : {}),
        ...(voice.selectedVoiceId ? { voice_id: voice.selectedVoiceId } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
      },
      src, retryDraft, voice.uploadedRefFile ?? undefined,
    );
  });

  return { submitting, error, generate };
}
