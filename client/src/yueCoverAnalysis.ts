/** What ANALYZE AUDIO writes on COVER · YUE2 (PLAN.md "ANALYZE AUDIO on COVER · YUE2"): ACE-Step's
 * description of the source, turned into the fields a YuE2 cover takes. Pure. BPM / KEY /
 * DURATION are left out on purpose: the score fixes them. */
import type { RefineResult } from './api';
import { captionToStyleTags } from './styleTags';
import { fillable } from './useAnalyzeSourceAudio';
import { fitLyricsToSections, hasWords } from './coverLyrics';

export interface YueAnalysisTarget {
  prompt: string;
  lyrics: string;
  vocalLanguage: string;
  /** Prompt/lyrics were written in another Create tab (createDraftStore's intentOrigin). */
  carried: boolean;
  /** The cover's score, when there is one yet. */
  abc: string | null;
  /** The languages the engine sings (EngineCapabilities.languages). */
  languages: string[] | 'any';
}

export interface YueAnalysis {
  patch: { prompt?: string; lyrics?: string; vocalLanguage?: string };
  /** How PROMPT was filled: as tags, as the caption verbatim (no style word recognised), or
   * not at all (a prompt typed on this tab, or an empty caption). */
  prompt: 'tags' | 'prose' | 'kept';
  /** `none`: ACE-Step heard no words. */
  lyrics: 'filled' | 'kept' | 'none';
}

export function yueAnalysisPatch(r: RefineResult, d: YueAnalysisTarget): YueAnalysis {
  const out: YueAnalysis = { patch: {}, prompt: 'kept', lyrics: 'kept' };
  const caption = r.caption?.trim() ?? '';
  if (caption && fillable(d.prompt, d.carried)) {
    const tags = captionToStyleTags(caption);
    out.patch.prompt = tags.length ? tags.join(', ') : caption;
    out.prompt = tags.length ? 'tags' : 'prose';
  }
  // Only section tags (TRANSCRIBE's outline) count as empty: there are no words to lose.
  if (!hasWords(r.lyrics ?? '')) out.lyrics = 'none';
  else if (fillable(d.lyrics, d.carried) || !hasWords(d.lyrics)) {
    out.patch.lyrics = d.abc ? fitLyricsToSections(r.lyrics, d.abc) : r.lyrics.trim();
    out.lyrics = 'filled';
  }
  if (!d.vocalLanguage && r.vocal_language && (d.languages === 'any' || d.languages.includes(r.vocal_language))) {
    out.patch.vocalLanguage = r.vocal_language;
  }
  return out;
}
