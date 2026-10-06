/** Every line C3's reference songs say (F-061..F-064, D-134, D-137, D-138; pipeline/design/chat-reference.html once
 * DT-C3 signs it off). C3's copy lives only here, beside `chatCopy.ts` (near its cap, D-136). Pure. */
import type { ChatDraft, ChatDraftKey } from './api/chat';
import { isNotRead, type ReadingPartSource, type ReadingView } from './api/chatReferences';
import type { Attachment } from './chatAttachStore';
import type { CardPhase } from './chatReading';
import { fmtTime } from './dockTarget';
import { queueSuffix, startsAfter } from './queueCopy';

export const ATTACH = 'ATTACH ▾';
export const ATTACH_FILE = 'FILE…';
export const ATTACH_LIBRARY = 'FROM LIBRARY…';
export const DROP_HINT = 'drop an audio file to read it';
export const READ = 'READ';
export const CREATE_COVER = 'CREATE COVER';
export const RE_ANALYZE = 'RE-ANALYZE';
export const AB_PILL = 'REFERENCE ⇄ SONG';
export const REFERENCE_MARK = 'REFERENCE';
export const SCORE_MARK = 'FROM THE SCORE';
export const STEPS_LINE = 'WORDS > SCORE > CAPTION';
/** D-134, on the READ card, the reading card and the cover card. */
export const RIGHTS_LINE = 'Stays on this machine. You are responsible for the rights to this recording.';
export const INSTRUMENTAL = 'instrumental: there are no words';
export const LOCKED_HINT = 'a cover sings the score as it is: tempo, key, meter and structure stay';
/** The reading and a cover use the first 360 s of a longer file (D-138). */
export const READ_LIMIT_SECONDS = 360;

type Part = 'words' | 'score' | 'caption';
const PART: Record<Part, string> = { words: 'WORDS', score: 'SCORE', caption: 'CAPTION' };
const FROM: Record<Part, Record<ReadingPartSource, string>> = {
  words: { own: 'its own lyrics', service: 'heard by lyrics-server', skip: 'skipped' },
  score: { own: 'its own score', service: 'transcribed by yue-server', skip: 'skipped' },
  caption: { own: 'its own caption, tempo and key', service: 'ACE-Step ANALYZE AUDIO', skip: 'skipped' },
};

const gpu = (seconds: number | null | undefined) =>
  seconds === 0 ? 'uses no GPU' : seconds ? `uses the GPU about ${Math.round(seconds)} s` : 'uses the GPU';

/** READ's consequence line (F-061): "Reads WORDS > SCORE > CAPTION · uses the GPU about 40 s, changes nothing". */
export const readConsequence = (gpuSeconds: number | null | undefined, ahead = 0) =>
  `Reads ${STEPS_LINE} · ${gpu(gpuSeconds)}, changes nothing${queueSuffix(ahead)}`;

/** RE-ANALYZE's consequence line (F-062): no follow-up turn, a new reading card. */
export const reanalyzeConsequence = (gpuSeconds: number | null | undefined) =>
  `Reads the reference again · ${gpu(gpuSeconds)} · a new reading card lands in this chat · nothing else changes`;

/** Where a part comes from on the analyze card: "SCORE · transcribed by yue-server". */
export const partLine = (part: Part, source: ReadingPartSource) => `${PART[part]} · ${FROM[part][source]}`;

/** A part the reading could not fill (F-061 edge: never an empty section). */
export function notReadLine(part: Part, why: string): string {
  const reason = why.replace(/^\s*not read:\s*/i, '').trim() || 'no reason given';
  return `${PART[part]} · not read: ${reason}`;
}

/** D-138: "6:52 long · reads the first 6:00 only · A/B plays all of it". */
export const cutNote = (seconds: number) => `${fmtTime(seconds)} long · reads the first ${fmtTime(READ_LIMIT_SECONDS)} only · A/B plays all of it`;

/** D-137: a library song with more than one layer is read from its base layer only. */
export function layersNote(layers: number | null | undefined): string | null {
  if (!layers || layers <= 1) return null;
  return `reads the base layer only · its other ${layers - 1} layer${layers === 2 ? ' is' : 's are'} not read`;
}

/** The analyze card's state line; null while it is live or done. */
export function analyzeLine(p: CardPhase): string | null {
  switch (p.kind) {
    case 'starting': return `${READ} · STARTING…`;
    case 'refused': return `${READ} REFUSED · ${p.reason}`;
    case 'superseded': return 'SUPERSEDED · a newer reading proposal replaced this one';
    case 'expired': return 'EXPIRED · this proposal expired, ask again';
    default: return null;
  }
}

/** The reading card's line: queued, the step of three, PROPOSING… (the follow-up turn), and how it ended. */
export function readingLine(p: CardPhase): string | null {
  switch (p.kind) {
    case 'queued': return p.ahead > 0 ? `READING · QUEUED · ${startsAfter(p.ahead).toUpperCase()}` : 'READING · STARTING…';
    case 'reading': return `READING · ${p.step} OF 3 · ${p.name}${p.note ? ` · ${p.note}` : ''}`;
    case 'proposing': return 'PROPOSING…';
    case 'done': return p.partial ? 'READ · SOME PARTS NOT READ' : 'READ';
    case 'failed': return `READING FAILED · ${p.error} · nothing changed`;
    case 'cancelled': return 'CANCELLED · nothing was read · nothing changed';
    case 'interrupted': return `INTERRUPTED · the server restarted before the reading finished · ${RE_ANALYZE} reads it again`;
    default: return null;
  }
}

/** Under the reading: a cover is possible, or why not, with the fresh-song option (F-063 edge). */
export const coverVerdictLine = (notPossible: string | null) =>
  notPossible ? `NO COVER · ${notPossible} · a new song in its style is still possible` : 'COVER POSSIBLE';

/** CREATE COVER's consequence line (F-063). */
export function coverConsequence(estSeconds: number | null | undefined, scoreSource: 'own' | 'transcribed' = 'transcribed'): string {
  const length = estSeconds ? `, about ${Math.max(1, Math.round(estSeconds / 60))} min` : '';
  const from = scoreSource === 'own' ? 'its own score' : 'the transcribed score';
  return `keeps the melody, new words and style; renders on YuE2 from ${from}${length} · the new words are fitted by YuE2, not guaranteed`;
}

/** A field filled from the reading: FROM THE SCORE (a cover, locked) or REFERENCE (a borrow); null otherwise. */
export function fieldMark(draft: ChatDraft | null | undefined, key: ChatDraftKey): string | null {
  if (!draft?.reference || !draft.borrowed?.includes(key)) return null;
  return draft.reference.use === 'cover' ? SCORE_MARK : REFERENCE_MARK;
}

const NOUN: Partial<Record<ChatDraftKey, string>> = { bpm: 'tempo', key: 'key', timeSignature: 'meter', structure: 'structure', style: 'instrumentation' };
/** F-064 edge: the field stays blank and says so. */
export const missingNote = (key: ChatDraftKey) => `no ${NOUN[key] ?? key} found in the reference`;

/** The song panel's line under a reference's name (F-062): "3:12 · read 2026-10-07". */
export function referenceMeta(seconds: number | null, readAt: string | null | undefined): string {
  const parts = [seconds ? fmtTime(seconds) : null, readAt ? `read ${readAt.slice(0, 10)}` : 'not read yet'];
  return parts.filter(Boolean).join(' · ');
}

/** The composer chip's line beside the name. */
export function attachChipLine(a: Attachment): string {
  if (a.phase === 'uploading') return `UPLOADING ${Math.round(a.progress * 100)}%`;
  if (a.phase === 'failed') return a.reason;
  return a.seconds ? fmtTime(a.seconds) : 'ATTACHED';
}

/* CR-7a: ATTACH ▾, the drop target, the READ card and the reading card (design/chat-reference.html 1a-2g, D-141). */
export const ATTACH_FILE_HINT = 'an audio file from this computer';
export const ATTACH_LIBRARY_HINT = 'a song you made';
export const LIBRARY_SEARCH = 'Search your library…';
export const LIBRARY_EMPTY = 'no songs match';
export const LIBRARY_LOADING = 'LOADING…';
export const LIBRARY_FAILED = "COULDN'T LOAD THE LIBRARY · FILE… still works ·";
export const ATTACH_OFF = 'references attach to a new song: start NEW CHAT and attach it there';
export const DROP_TITLE = 'DROP A SONG TO WORK FROM';
export const DROP_FORMATS = 'MP3 · WAV · FLAC · M4A · OGG · copied here, stays on this machine';
export const ANALYZE_HEAD = 'READ · A SONG TO WORK FROM';
export const ANALYZE_TAIL = 'nothing is saved to your library';
export const READ_AGAIN = 'READ AGAIN';
export const SEND_WAITS_READING = 'SEND waits for the reading and its proposal · your text stays';
export const SEND_WAITS_UPLOAD = 'SEND waits for the upload · your text stays';
export const PROPOSING_TAIL = '· the assistant proposes from the reading · nothing runs yet';
export const NO_SCORE = 'no score was read';
export const SCORE_TOO_LONG = 'the score is longer than YuE2 plans in one take';
/** What READ will do with a library song, on its ATTACH ▾ row (D-137): a YuE2 song has its own score. */
export const libraryRowHint = (engine: string | null | undefined) =>
  engine === 'yue2' ? 'its own score and words, no GPU' : 'score transcribed on the GPU';
export const libraryRowMeta = (seconds: number | null, engine: string | null | undefined) =>
  [seconds ? fmtTime(seconds) : null, engine === 'yue2' ? 'YUE2' : 'ACE-STEP'].filter(Boolean).join(' · ');
export const analyzeMeta = (seconds: number | null, origin: 'upload' | 'library') =>
  [seconds ? fmtTime(seconds) : null, origin === 'library' ? 'library' : 'uploaded'].filter(Boolean).join(' · ');
export const analyzeDone = (name: string) => `${READ} · ${name} · THE READING IS BELOW`;
export const readingHead = (name: string) => `READING · ${name}`;
export const sentAttach = (name: string) => `◉ ${name}`;
export const wordsSummary = (lines: number, language: string | null, instrumental: boolean) =>
  instrumental ? `none heard · ${INSTRUMENTAL}` : [`${lines} lines`, language?.toUpperCase(), 'sung'].filter(Boolean).join(' · ');
export function scoreSummary(h: { bars: number; meter: string; key: string; bpm: number } | null, chords: boolean | null): string {
  const c = chords === true ? 'chords read' : chords === false ? 'no chords' : 'chords not known';
  return h ? `${h.bars} bars · ${h.meter} · ${h.key} · ${h.bpm} BPM · ${c}` : `read, its facts could not be parsed · ${c}`;
}
export const captionFacts = (c: { bpm: number | null; key: string | null; meter: string | null }) =>
  [c.bpm ? `${c.bpm} BPM` : null, c.key, c.meter].filter(Boolean).join(' · ');
/** Why a cover is not possible from this reading, as far as the card can tell (the server's `coverVerdict` decides at
 * CREATE COVER): no score, or a measured score over YuE2's plan budget (D-140 e: unmeasured counts as fitting). */
export function coverBlock(r: ReadingView): string | null {
  if (isNotRead(r.score)) return NO_SCORE;
  const m = r.score.measure;
  if (m && m.header + m.sections.reduce((n, s) => n + s.tokens, 0) > m.budget) return SCORE_TOO_LONG;
  return null;
}
