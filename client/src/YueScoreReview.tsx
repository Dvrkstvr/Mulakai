import { api, type EngineId } from './api';
import { abcFacts } from './abcFacts';
import { AudioPreview } from './AudioPreview';
import { retimeRowKey, type CoverScore } from './coverDraft';
import { sungScore } from './scoreCut';
import { useScoreSize } from './useScoreSize';
import { ScoreSectionStrip } from './ScoreSectionStrip';
import { RetimeRow } from './RetimeRow';

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
 * cover decisions"). Notes are corrected outside Mulakai and brought back with USE .ABC FILE;
 * whole sections can be left out here (PLAN.md "YuE2 Covers: Pick the Score's Sections"). Its
 * facts describe what will be sung and stand in for SONG DETAILS: the score fixes them. */
export function YueScoreReview({ engine, score, onChange, onTranscribeAgain, busy }: {
  engine: EngineId; score: CoverScore; onChange: (next: CoverScore) => void; onTranscribeAgain: () => void; busy: boolean;
}) {
  const sung = sungScore(score);
  const facts = abcFacts(sung);
  const { size, error } = useScoreSize(engine, score.abc);
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
      <RetimeRow key={retimeRowKey(score)} score={score} onChange={onChange} onTranscribeAgain={onTranscribeAgain} disabled={busy} />
      <ScoreSectionStrip score={score} size={size} />
      {error && <div className="hint">couldn&apos;t size the score against YuE2&apos;s planner: {error}</div>}
      {t && t.warnings.length > 0 && <div className="warn-note">SheetSage2: {t.warnings.join(' · ')}</div>}
      {previewable ? (
        <>
          <div className={score.retime ? 'retime-stale' : undefined}>
            <AudioPreview src={api.transcriptionPreviewUrl(engine, score.previewJobId!)} label="piano preview" height={26}
              duration={t?.durationSeconds ?? undefined} />
          </div>
          <div className="hint">
            {score.retime && <span className="tag-stale">STALE · {abcFacts(score.retime.original).bpm} BPM</span>}{' '}
            {score.retime
              ? 'the piano still plays the score as read, not the re-timed one (Q-127)'
              : 'a plain piano playing the score — listen for wrong notes before you generate'}
          </div>
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
        <pre>{sung}</pre>
      </details>
    </div>
  );
}
