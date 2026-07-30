import { GEN_TYPE_LABEL, type GenType } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';

const MEANING: Record<GenType, string> = {
  prompt: 'here it describes the whole song, generated from scratch',
  audio: 'here it describes the change from the source track',
  complete: 'here it describes the accompaniment built around the source track',
};

/** Names the shift when the prompt/lyrics in view were written in another tab. The text
 * carries across tabs on purpose — it's one draft rendered three ways — but "prompt" means
 * something different in each, so a caption written for a from-scratch song reads as an
 * instruction to change a source track once it's sitting in COVER. Clears as soon as the text
 * is edited here, since that claims it for this tab (createDraftStore's intentOrigin). */
export function CarriedPromptNote() {
  const genType = useCreateDraftStore((s) => s.genType);
  const intentOrigin = useCreateDraftStore((s) => s.intentOrigin);
  const hasText = useCreateDraftStore((s) => !!(s.prompt || s.lyrics));
  if (intentOrigin === genType || !hasText) return null;
  return <div className="hint">Carried over from {GEN_TYPE_LABEL[intentOrigin]} — {MEANING[genType]}.</div>;
}
