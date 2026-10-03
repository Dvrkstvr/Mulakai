import type { CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useSettings, coverParams } from './settings';
import { resolveCoverSource } from './coverSource';
import { recipeEtaKey } from './recipeCopy';
import { useCreateSubmit } from './useCreateSubmit';

/** GENERATE COVER on ACE-Step: a `cover` generation conditioned on an uploaded file or a
 * client-bounced mix of a library song, persisted as a brand-new song. */
export function useCoverGenerate(onBack: () => void) {
  const draft = useCreateDraftStore();
  const gen = useSettings((s) => s.gen);
  const voice = useVoiceStore();
  const startFromAudio = useGenerationStore((s) => s.startFromAudio);
  const { source, selectedSongId, model, variance } = draft.audio;
  const { submitting, error, submit } = useCreateSubmit(onBack, recipeEtaKey('audio', 'acestep', model, gen.quality));
  const { title, prompt, lyrics, bpm, keyScale, duration, folderId } = draft;

  const generate = () => submit(async () => {
    const retryDraft: CreateDraft = {
      genType: 'audio', source, selectedSongId: selectedSongId ?? undefined, prompt, lyrics, bpm, keyScale, duration,
    };
    const srcAudio = await resolveCoverSource(draft.audio);
    await startFromAudio(
      {
        title: title || 'Untitled', prompt, lyrics, ...coverParams(gen, model), audio_cover_strength: 1 - variance,
        ...(bpm > 0 ? { bpm } : {}),
        ...(keyScale ? { key_scale: keyScale } : {}),
        ...(duration > 0 ? { audio_duration: duration } : {}),
        ...(voice.selectedVoiceId ? { voice_id: voice.selectedVoiceId } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
      },
      srcAudio, retryDraft, voice.uploadedRefFile ?? undefined,
    );
  });

  return { submitting, error, generate };
}
