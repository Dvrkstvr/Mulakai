/** The chat's copy (chat-create.html, F-041, F-043, F-044): consequence lines, turn lines, CHANGED / skipped. */
import { describe, it, expect } from 'vitest';
import type { ChatDraftFields } from './api/chat';
import {
  assistantOffLine, blockersLine, cardStateLine, changedLine, createFailedLine, createJobLine, failedTitle, keyName,
  newChatConsequence, railLine, recipeConsequence, recipeSummary, skippedLine, turnLine, turnNote,
} from './chatCopy';
import { INITIAL_TURN, type TurnState } from './chatTurn';

const turn = (phase: TurnState['phase'], over: Partial<TurnState> = {}): TurnState => ({ ...INITIAL_TURN, phase, ...over });
const FIELDS: ChatDraftFields = {
  title: 'Luz sobre el mar', style: 'slow Spanish ballad', bpm: 68, key: 'Am', timeSignature: '4/4', language: 'es',
  structure: ['Intro', 'Verse', 'Chorus'], lyrics: [{ tag: 'Verse', lines: ['a', 'b', 'c', 'd'] }, { tag: 'Chorus', lines: ['e', 'f', 'g', 'h'] }],
  engine: 'yue2',
};

describe('chatCopy', () => {
  it('CREATE SONG\'s consequence line names the engine, the length, the GPU and what stays', () => {
    expect(recipeConsequence(190)).toBe('Renders a new song on YuE2, about 3 min · uses the GPU · lands in Library · nothing else changes');
    expect(recipeConsequence(null, 2)).toBe('Renders a new song on YuE2 · uses the GPU · lands in Library · nothing else changes · starts after 2 jobs');
  });

  it('CHANGED lists the filled fields in sidebar order; none → null', () => {
    expect(changedLine(['style', 'bpm'])).toBe('CHANGED · STYLE, TEMPO');
    expect(changedLine([])).toBeNull();
  });

  it('skipped names the fields the person touched after SEND (F-043 edge)', () => {
    expect(skippedLine(['title'])).toBe('skipped TITLE, you changed it');
    expect(skippedLine(['bpm', 'title', 'key'])).toBe('skipped TITLE, TEMPO and KEY, you changed them');
    expect(skippedLine([])).toBeNull();
  });

  it('turn lines: queued with the queue, thinking with the attempt, cancelling, cancelled, interrupted', () => {
    expect(turnLine(turn({ kind: 'queued', ahead: 2 }))).toBe('THINKING · QUEUED · STARTS AFTER 2 JOBS');
    expect(turnLine(turn({ kind: 'thinking', attempt: 2, note: 'bad key H#' }))).toBe('THINKING… attempt 2 of 3');
    expect(turnNote(turn({ kind: 'thinking', attempt: 2, note: 'bad key H#' }))).toBe('bad key H#');
    expect(turnLine(turn({ kind: 'thinking', attempt: 1, note: null }, { cancelling: true }))).toBe('CANCELLING · the planner unloads first');
    expect(turnLine(turn({ kind: 'cancelled' }))).toBe('CANCELLED · no reply, nothing changed');
    expect(turnLine(turn({ kind: 'interrupted' }))).toMatch(/^INTERRUPTED/);
    expect(turnLine(INITIAL_TURN)).toBeNull();
  });

  it('failed and offline titles', () => {
    expect(failedTitle('check')).toBe('NO ANSWER IN 3 ATTEMPTS');
    expect(failedTitle('context')).toBe('THE TURN FAILED');
    expect(assistantOffLine('Ollama did not answer at LLM_API_URL')).toBe('ASSISTANT OFF · Ollama did not answer at LLM_API_URL');
  });

  it('the recipe card summary reads the live draft', () => {
    expect(keyName('Am')).toBe('A MINOR');
    expect(keyName('F#')).toBe('F# MAJOR');
    expect(recipeSummary(FIELDS)).toBe('68 BPM · A MINOR · 4/4 · 3 SECTIONS · 8 LINES · YUE2');
    expect(recipeSummary({ ...FIELDS, bpm: null, key: null, timeSignature: null, structure: [], lyrics: [] })).toBe('YUE2');
  });

  it('blockers, card states and the take\'s job line', () => {
    expect(blockersLine(['the lyrics need 4 to 8 lines per section'])).toBe('CREATE SONG is off: the lyrics need 4 to 8 lines per section');
    expect(blockersLine([])).toBeNull();
    expect(cardStateLine('superseded')).toMatch(/^SUPERSEDED/);
    expect(cardStateLine('expired')).toBe('EXPIRED · this proposal expired, ask again');
    expect(cardStateLine('pending')).toBeNull();
    expect(createJobLine({ kind: 'queued', ahead: 1 })).toBe('CREATE SONG · QUEUED · STARTS AFTER 1 JOB');
    expect(createJobLine({ kind: 'starting' })).toBe('CREATE SONG · STARTING…');
    expect(createJobLine({ kind: 'running', progressText: 'stage 1 41%' })).toBe('RENDERING ON YUE2 · stage 1 41%');
    expect(createJobLine({ kind: 'failed', error: 'x' })).toBeNull();
    expect(createFailedLine('YuE2 ran out of memory')).toBe('YuE2 ran out of memory · the draft and the thread are kept');
  });

  it('the rail counts filled fields; NEW CHAT says what it drops (F-041 edge)', () => {
    expect(railLine(8)).toBe('8 FIELDS FILLED');
    expect(railLine(1)).toBe('1 FIELD FILLED');
    expect(newChatConsequence(3)).toBe('Drops this draft and its 3 messages · the Library is untouched');
    expect(newChatConsequence(1)).toBe('Drops this draft and its 1 message · the Library is untouched');
    expect(newChatConsequence(0)).toBe('Drops this draft · the Library is untouched');
  });
});
