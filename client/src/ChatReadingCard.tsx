/** The reading card (F-061, design/chat-reference.html 2c-2g): the WORDS > SCORE > CAPTION strip and one plain line
 * while it runs (reading is not generation: no shader), dashed while queued, CANCEL between steps; then WORDS, the
 * SCORE with its sections and chords, CAPTION, each part not read as a rust line with its cause (never an empty row),
 * the 360 s cut (D-138), the base-layer note (D-137), cover possible or why, the rights line; PROPOSING… under it while
 * the follow-up turn runs (D-129). Its phase is `chatReading`'s. */
import type { ChatMessageView, ChatReadingBody } from './api/chat';
import { isNotRead, type ReadingScore, type ReadingView, type ReferenceView } from './api/chatReferences';
import { READING_STEPS, readingPartial, type CardState } from './chatReading';
import {
  PROPOSING_TAIL, READ_AGAIN, RIGHTS_LINE, captionFacts, coverBlock, coverVerdictLine, cutNote, layersNote,
  notReadLine, partLine, reanalyzeConsequence, readingHead, readingLine, scoreSummary, wordsSummary,
} from './chatReferenceCopy';
import { ChatErrorLine, ChatJobLine } from './ChatTurnLine';

const source = (part: 'words' | 'score' | 'caption', r: ReadingView) => partLine(part, r.plan[part]).split(' · ').slice(1).join(' · ');

function Part({ label, text, from }: { label: string; text: string; from?: string }) {
  return <div className="chat-ref-part"><span className="chat-lb">{label}</span> {text}{from && <span className="chat-hn"> · {from}</span>}</div>;
}

function Sections({ score }: { score: ReadingScore }) {
  const sections = score.facts?.sections ?? [];
  if (!sections.length) return null;
  return (
    <div className="chat-ref-sections">
      {sections.map((s) => <i key={s.index} style={{ flex: Math.max(1, s.to_bar - s.from_bar + 1) }}>{s.label.toUpperCase()}</i>)}
    </div>
  );
}

function Reading({ r, reference }: { r: ReadingView; reference: ReferenceView | undefined }) {
  const warn = (part: 'words' | 'score' | 'caption', why: string) => <div key={part} className="chat-ref-warn">{notReadLine(part, why)}</div>;
  const layers = reference?.origin === 'library' ? layersNote(reference.layers) : null;
  return (
    <>
      {isNotRead(r.words) ? warn('words', r.words.notRead)
        : <Part label="WORDS" text={wordsSummary(r.words.lines.length, r.words.language, r.words.instrumental)} from={source('words', r)} />}
      {isNotRead(r.score) ? warn('score', r.score.notRead) : (
        <>
          <Part label="SCORE" text={scoreSummary(r.score.facts?.header ?? null, r.score.chords)} from={source('score', r)} />
          <Sections score={r.score} />
          {r.score.warnings.map((w) => <div key={w} className="chat-hn">{w}</div>)}
        </>
      )}
      {isNotRead(r.caption) ? warn('caption', r.caption.notRead) : (
        <Part label="CAPTION" text={[r.caption.caption, captionFacts(r.caption)].filter(Boolean).join(' · ')} from={source('caption', r)} />
      )}
      {r.cut && r.seconds && <div className="chat-card-style">{cutNote(r.seconds)}</div>}
      {layers && <div className="chat-card-style">{layers}</div>}
      <div className="chat-card-style">{coverVerdictLine(coverBlock(r))}</div>
      <div className="chat-hn">{RIGHTS_LINE}</div>
    </>
  );
}

interface Props {
  message: ChatMessageView;
  card: CardState | undefined;
  reference: ReferenceView | undefined;
  onCancel: (card: CardState) => void;
  /** READ AGAIN after a failed, cancelled or interrupted reading (RE-ANALYZE's route: no follow-up turn). */
  onReadAgain: (referenceId: string) => void;
}

export function ChatReadingCard({ message, card, reference, onCancel, onReadAgain }: Props) {
  const b = message.body as ChatReadingBody | null;
  if (!b || !card) return null;
  const p = card.phase;
  const line = readingLine(p);
  const cancel = <button type="button" className="chat-q" onClick={() => onCancel(card)}><span>CANCEL</span></button>;
  const again = <button type="button" className="chat-q" onClick={() => onReadAgain(b.referenceId)}><span>{READ_AGAIN}</span></button>;
  const at = p.kind === 'reading' ? p.step : p.kind === 'queued' ? 0 : READING_STEPS.length + 1;
  return (
    <div className="chat-card chat-ref-card">
      <div className="chat-card-hd">
        <span className="chat-lb">{readingHead(b.name)}</span>
        {(p.kind === 'done' || p.kind === 'proposing') && <span className="chat-hn">{readingLine({ kind: 'done', partial: readingPartial(b.reading) })}</span>}
      </div>
      <div className="chat-card-sum chat-ref-body">
        {(p.kind === 'queued' || p.kind === 'reading') && (
          <div className="chat-ref-steps">
            {READING_STEPS.map((s, i) => <i key={s} className={i + 1 < at ? 'dn' : i + 1 === at ? 'on' : ''}>{s}</i>)}
          </div>
        )}
        {p.kind === 'queued' && <ChatJobLine title={line!} waiting action={cancel} />}
        {p.kind === 'reading' && <ChatJobLine title={line!} action={cancel} />}
        {b.reading && <Reading r={b.reading} reference={reference} />}
        {p.kind === 'failed' && <ChatErrorLine title={line!} body="" />}
        {(p.kind === 'cancelled' || p.kind === 'interrupted') && <div className="chat-hn">{line}</div>}
        {(p.kind === 'failed' || p.kind === 'cancelled' || p.kind === 'interrupted') && (
          <div className="chat-ref-end"><span className="chat-cs">{reanalyzeConsequence(null)}</span>{again}</div>
        )}
      </div>
      {p.kind === 'proposing' && <ChatJobLine title={line!} tail={PROPOSING_TAIL} action={cancel} />}
    </div>
  );
}
