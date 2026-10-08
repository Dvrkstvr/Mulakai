/** The Create card's second line (CreateCard.tsx): what a draft sets, as short tags. */
import { isInstrumental } from './instrumental';

interface DraftFacts {
  bpm: number;
  keyScale: string;
  timeSignature: string;
  duration: number;
  vocalLanguage: string;
  lyrics: string;
  engine: string;
}

const fmtLength = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The draft card's second line: only what the draft actually sets (AUTO fields stay out). */
export function draftFacts(d: DraftFacts): string[] {
  const lines = d.lyrics.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('['));
  return [
    d.bpm ? `${d.bpm} BPM` : '',
    d.keyScale.toUpperCase(),
    d.timeSignature ? `${d.timeSignature}/4` : '',
    d.duration ? fmtLength(d.duration) : '',
    d.vocalLanguage ? `${languageName(d.vocalLanguage).toUpperCase()} VOCALS` : '',
    isInstrumental(d.lyrics) ? 'INSTRUMENTAL' : lines.length ? `LYRICS · ${lines.length} LINES` : '',
    d.engine === 'acestep' ? 'ACE-STEP' : d.engine.toUpperCase(),
  ].filter(Boolean);
}
