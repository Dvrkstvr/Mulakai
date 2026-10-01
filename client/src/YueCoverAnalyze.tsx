import { useEffect, useRef, useState } from 'react';
import { useCreateDraftStore } from './createDraftStore';
import { useTranscribeStore } from './transcribeStore';
import { useEngineCaps } from './useEngineCaps';
import { canAnalyze, useAnalyzeSourceAudio, type AnalyzeSource } from './useAnalyzeSourceAudio';
import { coverSourceKey, coverSourceReady, resolveCoverSource } from './coverSource';
import { yueAnalysisPatch, type YueAnalysis } from './yueCoverAnalysis';
import { AnalyzeAudioButton } from './AnalyzeAudioButton';

/** ANALYZE AUDIO on COVER · YUE2 (PLAN.md "ANALYZE AUDIO on COVER · YUE2"): ACE-Step describes the
 * source with COVER's ACE-Step model, and the description becomes a tagged PROMPT (plus wordless
 * LYRICS and an AUTO VOCAL LANGUAGE). Not `useAnalyzeAndApply`: that also writes BPM / KEY /
 * DURATION, which the score fixes here. */
export function YueCoverAnalyze({ blocked, noModel }: { blocked: boolean; noModel: boolean }) {
  const audio = useCreateDraftStore((s) => s.audio);
  const patch = useCreateDraftStore((s) => s.patch);
  const { info } = useEngineCaps();
  const { analyze, analyzing, error, result } = useAnalyzeSourceAudio();
  const [outcome, setOutcome] = useState<YueAnalysis | null>(null);
  const [caption, setCaption] = useState('');
  const sourceRef = useRef<string | null>(null);

  const source: AnalyzeSource = coverSourceReady(audio) ? { kind: 'file', resolve: () => resolveCoverSource(audio) } : null;

  useEffect(() => {
    if (!result) return;
    const d = useCreateDraftStore.getState();
    if (coverSourceKey(d.audio) !== sourceRef.current) return; // the source changed while ACE-Step listened
    const a = yueAnalysisPatch(result, {
      prompt: d.prompt, lyrics: d.lyrics, vocalLanguage: d.vocalLanguage, carried: d.intentOrigin !== 'audio',
      abc: d.audio.yueScore?.abc ?? null, languages: info?.capabilities.languages ?? [],
    });
    if (Object.keys(a.patch).length) patch(a.patch);
    // Without a score yet, the words follow the one TRANSCRIBE brings (transcribeStore).
    if (a.patch.lyrics && !d.audio.yueScore) useTranscribeStore.setState({ analyzedLyrics: a.patch.lyrics });
    setOutcome(a);
    setCaption(result.caption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const run = () => {
    sourceRef.current = coverSourceKey(audio);
    setOutcome(null);
    analyze(source, audio.model);
  };

  return (
    <>
      <AnalyzeAudioButton disabled={blocked || !canAnalyze(source, audio.model, analyzing)} analyzing={analyzing} onClick={run} />
      <div className="hint">
        ANALYZE AUDIO has ACE-Step describe the source · fills an empty PROMPT with its style as tags (voice, genre,
        mood, instruments) and wordless LYRICS with the words it hears — described, not transcribed · nothing is saved
        to your library
      </div>
      {noModel && <div className="hint">ANALYZE AUDIO needs ACE-Step running with a model that can cover</div>}
      {!source && audio.yueScore && <div className="hint">pick a source to analyze — a reused score has no audio</div>}
      {error && <div className="error">{error}</div>}
      {outcome && <div className="hint">{outcomeLine(outcome)}</div>}
      {outcome?.unsung && (
        <div className="warn-note">
          ACE-Step heard the words in {outcome.unsung.toUpperCase()} — {info?.label ?? 'YUE2'} sings{' '}
          {info?.capabilities.languages === 'any' ? 'any language' : (info?.capabilities.languages ?? []).join(', ').toUpperCase()}
          {' '}· rewrite LYRICS in one of those, or expect the words to come out garbled
        </div>
      )}
      {outcome && caption && (
        <details className="score-abc analysis-caption">
          <summary className="section-label">SHOW DESCRIPTION</summary>
          <p>{caption}</p>
        </details>
      )}
    </>
  );
}

function outcomeLine({ prompt, lyrics }: YueAnalysis): string {
  const p = prompt === 'tags' ? "PROMPT holds the description's style as tags — edit freely"
    : prompt === 'prose' ? 'no style tags recognised: PROMPT holds the description as written — trim it to tags'
      : 'PROMPT kept as typed';
  const l = lyrics === 'filled' ? 'LYRICS are what ACE-Step heard, not a transcription — check them against the recording'
    : lyrics === 'none' ? 'ACE-Step heard no words' : 'LYRICS kept as typed';
  return `${p} · ${l}`;
}
