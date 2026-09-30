import { api, type EngineId } from './api';
import { abcFacts } from './abcFacts';
import { AudioPreview } from './AudioPreview';
import type { CoverScore } from './coverDraft';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="score-fact">
      <span className="section-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** COVER on an engine: what the score says before ~a minute is spent singing it (PLAN.md "Client
 * cover decisions"). Listen-and-read only — a score is corrected outside Mulakai and brought
 * back with USE .ABC FILE. Its facts stand in for SONG DETAILS: the score fixes them. */
export function YueScoreReview({ engine, score }: { engine: EngineId; score: CoverScore }) {
  const facts = abcFacts(score.abc);
  const t = score.transcription;
  const previewable = !!(t?.hasPreview && score.previewJobId);
  return (
    <div className="score-review">
      <div className="field-label-row">
        <span className="section-label">SCORE</span>
        <span className="meta">from {score.source}</span>
      </div>
      <div className="score-facts">
        <Fact label="TEMPO" value={facts.bpm ? `${facts.bpm} BPM` : '—'} />
        <Fact label="KEY" value={facts.key || '—'} />
        <Fact label="METER" value={facts.meter || '—'} />
        <Fact label="BARS" value={facts.bars ? String(facts.bars) : '—'} />
        <Fact label="LENGTH" value={facts.seconds ? clock(facts.seconds) : '—'} />
        {t && <Fact label="MELODY NOTES" value={`${t.vocalNotes ?? 0} sung · ${t.instrumentalNotes ?? 0} played`} />}
      </div>
      {t && t.warnings.length > 0 && <div className="warn-note">SheetSage2: {t.warnings.join(' · ')}</div>}
      {previewable ? (
        <>
          <AudioPreview src={api.transcriptionPreviewUrl(engine, score.previewJobId!)} label="piano preview" height={26}
            duration={t?.durationSeconds ?? undefined} />
          <div className="hint">a plain piano playing the score — listen for wrong notes before you generate</div>
        </>
      ) : (
        <div className="hint">
          {t
            ? 'no piano preview — SheetSage2 could not render one; the score itself is fine'
            : 'no piano preview for a score from a file or an earlier cover — TRANSCRIBE a source to hear one'}
        </div>
      )}
      <details className="score-abc">
        <summary className="section-label">SHOW SCORE (ABC)</summary>
        <pre>{score.abc}</pre>
      </details>
    </div>
  );
}
