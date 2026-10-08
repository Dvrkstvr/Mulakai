/** C2's copy (F-056..F-060): the lyrics panel (chat-lyrics.html LY-3, LY-4, LY-6), the revised edit card, the bar map,
 * UNDO TURN's after-line (chat-create.html CH-5, scope.md "C2"). `chatCopy.ts` is near the cap, so C2's lines live
 * here; DT-C2 (chat-converge.html) may still reword them. Pure. */
import type { ChatDraftKey } from './api/chat';
import type { PanelSection } from './api/chatConverge';
import { FIELD_LABEL } from './chatCopy';
import { EDIT_SUPERSEDED_BODY } from './chatEditCopy';
import { barsText, clock } from './chatMarkLabel';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 'S'}`;

/** `CHORUS 2`; a label that occurs once in the song has no number (`INTRO`), as the strip's chip. */
export function panelName(s: Pick<PanelSection, 'label' | 'occurrence'>, all: Array<Pick<PanelSection, 'label'>>): string {
  const name = s.label.toUpperCase();
  return all.filter((o) => o.label === s.label).length > 1 ? `${name} ${s.occurrence}` : name;
}

/** The section list's count column: `4 LINES`, `NONE` (an instrumental section, drawn dim). */
export const linesText = (n: number) => (n === 0 ? 'NONE' : plural(n, 'LINE'));

/** A part's header: `CHORUS 2 · BARS 41–48 · 1:36`; part-marked (`markedBars` set): `VERSE 3 · 2 OF 8 BARS`. */
export function partHeader(s: PanelSection, all: PanelSection[], markedBars: number | null): string {
  const name = panelName(s, all);
  if (markedBars !== null) return `${name} · ${markedBars} OF ${plural(s.bars[1] - s.bars[0] + 1, 'BAR')}`;
  return [name, barsText(s.bars), ...(s.seconds ? [clock(s.seconds[0])] : [])].join(' · ');
}

export const moreLine = (n: number, name: string) => `${plural(n, 'MORE LINE')} IN ${name} ${n === 1 ? 'IS' : 'ARE'} NOT MARKED`;
/** D-218: a part-marked section whose lines have no times lists them all. */
export const UNTIMED_LINE = 'LINES NOT TIMED · the whole section is listed';
/** Q-074: a rewritten section outside the mark, appended in song order. */
export const PROPOSED = 'PROPOSED';
/** The struck-to-new marker in the line's bar column (LY-4). */
export const CHANGED_MARK = '~';
export const CLEAR_HINT = 'CLEAR THE MARK ✕ to see the section list';
export const LINE_HINT = 'shift-click extends; a header click marks the section';
export const FAILED_TAIL = 'The chat is still sent the whole text.';
export const RETRY = 'RETRY';
export const NO_LYRICS = { title: 'NO LYRICS IN THIS VERSION', body: 'Ask the chat for some; it answers with a proposal.', action: 'ASK THE CHAT' };

export type PanelTitleInput =
  | { kind: 'list'; lines: number }
  | { kind: 'marked'; parts: string[]; lines: number }
  | { kind: 'reading'; version: number | null }
  | { kind: 'failed' }
  | { kind: 'none' };

export function panelTitle(t: PanelTitleInput): string {
  switch (t.kind) {
    case 'list': return `LYRICS · ${plural(t.lines, 'LINE')}`;
    case 'marked': return t.parts.length === 1 ? `LYRICS · ${t.parts[0]}` : `LYRICS · ${plural(t.parts.length, 'SECTION')} · ${plural(t.lines, 'LINE')}`;
    case 'reading': return `LYRICS · READING ${t.version === null ? 'IT' : `v${t.version}`}…`;
    case 'failed': return 'LYRICS · NOT READ';
    case 'none': return 'LYRICS · NONE';
  }
}

/** The title row's right side. `markedLines` null = a whole section (or several) is marked. */
export function panelAside(t: { kind: 'list' } | { kind: 'marked'; markedLines: number | null; of: number } | { kind: 'reading' } | { kind: 'failed' } | { kind: 'none' }): string {
  switch (t.kind) {
    case 'list': return 'CLICK TO MARK';
    case 'marked': return t.markedLines === null ? '◂ ALL SECTIONS' : `${t.markedLines} OF ${plural(t.of, 'LINE')}`;
    case 'reading': return 'MARKS BY BARS';
    case 'failed': return '';
    case 'none': return 'INSTRUMENTAL';
  }
}

export const failedLine = (version: number | null, reason: string) => `COULDN'T READ ${version === null ? 'IT' : `v${version}`} · ${reason}`;

/** The revised edit card's header tag (F-058): from plan 2 on. */
export const revisedHeader = (revision: number | undefined) => (revision && revision > 1 ? `REVISED · PLAN ${revision}` : null);
/** A superseded card: revised by the card below it (D-227), or replaced by a fresh plan (C0b). */
export const supersededBody = (revised: boolean) => (revised ? 'Revised below. This one cannot be applied.' : EDIT_SUPERSEDED_BODY);
/** D-258: a start over scrapped the plan and planned nothing; the line below the card is a say, not a newer card. */
export const SCRAPPED_BODY = 'You scrapped this plan. It cannot be applied.';
/** The bar map's hatched row for SET TEMPO, TRANSPOSE, EDIT STYLE (F-060). */
export const WHOLE_SONG = 'WHOLE SONG';
export const mapTitle = (bars: number) => `BAR MAP · ${plural(bars, 'BAR')}`;

export const UNDO_TURN = 'UNDO TURN';
/** After UNDO TURN the CHANGED line reads `UNDONE · restored …` (5b). */
export const UNDONE = 'UNDONE';
/** The link's reason while a reply is open (5c). */
export const UNDO_OFF = 'off while a reply is open';
const label = (k: ChatDraftKey) => FIELD_LABEL[k];

/** After UNDO TURN: `restored TITLE, STYLE · kept LYRICS: you changed it`. */
export function undoneLine(restored: ChatDraftKey[], kept: Array<{ field: ChatDraftKey; reason: string }>): string {
  const head = `restored ${restored.length ? restored.map(label).join(', ') : 'nothing'}`;
  return kept.length ? `${head} · kept ${kept.map((k) => `${label(k.field)}: ${k.reason}`).join('; ')}` : head;
}
export const undoRefusedLine = (reason: string) => `Couldn't undo: ${reason}. Nothing changed.`;
