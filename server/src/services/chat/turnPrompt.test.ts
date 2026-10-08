import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { CHAT_RULES } from './chatRules.js';
import { HISTORY_MAX, REPLY_LINE, historyLines, refusedReply, turnMessages, turnRetry } from './turnPrompt.js';
import { songStateLines } from './songState.js';
import { RECIPE, facts206, readingFixture } from '../../../test-fakes/chatScripts.js';
import type { ChatMessage } from './chatTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
let seq = 0;
const msg = (role: 'user' | 'assistant', kind: ChatMessage['kind'], text: string, body: ChatMessage['body'] = null): ChatMessage => ({
  id: `m${++seq}`, threadId: 't', seq, role, kind, text, body, proposalId: null, jobId: null, versionId: null, clientKey: null, createdAt: '',
});
const base = { rules: '', state: [], facts: null, request: 'x', pending: [], history: [] };

describe('turn prompt (SP-5 build_messages, v3.1)', () => {
  it('the reply line asks for compact one-line JSON', () => {
    expect(REPLY_LINE).toBe('Reply with the JSON object only, compact on ONE line (no newlines, no indentation).');
  });

  it('system = the rules; user = state, phrase lines, pending proposal, conversation, REQUEST, the reply line, in that order', () => {
    const [system, user] = turnMessages({
      rules: CHAT_RULES, state: ['SONG: "X"'], facts, request: 'faster please',
      pending: ['PENDING PROPOSAL (the new-song card the person is looking at; nothing has run):', 'title: Mar'], history: [msg('user', 'text', 'a ballad')],
    });
    expect(system).toEqual({ role: 'system', content: CHAT_RULES });
    const order = ['SONG: "X"', 'PHRASE LENGTH:', 'FREE BARS', 'PENDING PROPOSAL', 'title: Mar', 'CONVERSATION (latest last):\nPERSON: a ballad',
      'REQUEST: faster please', REPLY_LINE];
    const at = order.map((s) => user.content.indexOf(s));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(user.content.endsWith(`REQUEST: faster please\n${REPLY_LINE}`)).toBe(true);
  });

  it('C3: a reference card says what it built on and never prints a missing key; READ and reading cards are one line each', () => {
    const { key: _k, ...noKey } = RECIPE;
    const body = { recipe: noKey, assumptions: [], changed: [], skipped: [], reference: { referenceId: 'r1', use: 'borrow', borrowed: ['bpm'], missing: ['key'], note: null } };
    const reading = { referenceId: 'r1', name: 'demo.mp3', followUp: true, reading: readingFixture() };
    const analyze = { target: { referenceId: 'r1' }, name: 'demo.mp3', seconds: 200, readTo: 200, cut: false, estimate: { words: 0, score: 0, caption: 0, total: 0 } };
    const lines = historyLines([
      msg('assistant', 'analyze', 'I will read it first.', analyze as ChatMessage['body']),
      msg('assistant', 'reading', 'Read.', reading as ChatMessage['body']),
      msg('assistant', 'recipe', 'A new song in its style.', body as ChatMessage['body']),
    ]);
    expect(lines[0]).toBe('ASSISTANT: I will read it first. [READ card for "demo.mp3"]');
    expect(lines[1]).toBe('ASSISTANT: [the reference "demo.mp3" was read]');
    expect(historyLines([msg('assistant', 'reading', 'cancelled', { ...reading, reading: null } as ChatMessage['body'])])).toEqual(['ASSISTANT: [the reference "demo.mp3" is not read: cancelled]']);
    expect(lines[2]).toContain('68 bpm · es · borrows from the reference]');
    expect(lines[2]).not.toContain('undefined');
  });

  it('no song: no phrase lines; nothing pending or said: no such blocks', () => {
    const [, user] = turnMessages({ ...base, state: ['SONG: none yet'], request: 'add a 2-bar sax phrase' });
    expect(user.content).toBe(`SONG: none yet\n\nREQUEST: add a 2-bar sax phrase\n${REPLY_LINE}`);
  });

  it('history: one line per message, a one-line card summary from the fields after an assistant card, failed turns skipped', () => {
    const lines = historyLines([
      msg('user', 'text', 'a ballad'),
      msg('assistant', 'recipe', 'Here it is.', { recipe: RECIPE, assumptions: [], changed: [], skipped: [] }),
      msg('user', 'text', 'hm'),
      msg('assistant', 'failed', 'planner offline'),
      msg('assistant', 'ask', 'Which?', { choices: ['a', 'b'] }),
      msg('assistant', 'song', 'Saved as v1'),
    ]);
    expect(lines).toEqual([
      'PERSON: a ballad',
      'ASSISTANT: Here it is. [new-song card: "Luz sobre el mar" · Spanish, slow ballad, nylon guitar, soft female voice · 68 bpm · Am · es]',
      'PERSON: hm', 'ASSISTANT: Which? (choices: a / b)', 'ASSISTANT: [the song was created: Saved as v1]',
    ]);
  });

  it('history keeps the latest lines inside its budget (0.8k tokens)', () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(i % 2 ? 'assistant' : 'user', i % 2 ? 'say' : 'text', `${i} ${'w'.repeat(500)}`));
    const lines = historyLines(many);
    expect(lines.join('\n').length).toBeLessThanOrEqual(HISTORY_MAX);
    expect(lines.at(-1)).toMatch(/^ASSISTANT: 7 w+/);
    expect(lines[0]).not.toMatch(/^PERSON: 0 /);
  });

  it('a retry appends the reply and the reasons with chat wording and the reply line, not "Your op list"', () => {
    const msgs = turnMessages(base);
    const next = turnRetry(msgs, [{ reply: '{"action":"x"}', reasons: ['action "x" is not one of ask, say'] }]);
    expect(next).toHaveLength(4);
    expect(next[2]).toEqual({ role: 'assistant', content: '{"action":"x"}' });
    expect(next[3].content).toBe(`Your reply was rejected:
- action "x" is not one of ask, say
Return a corrected, complete reply; write its message anew, about the corrected reply only. ${REPLY_LINE}`);
  });

  it('N4/N2: a refused edit goes back as its op kinds and bars, without its chords or its message', () => {
    const chords = Array.from({ length: 16 }, (_, i) => ({ bar: 23 + (i >> 1), beat: 1 + 2 * (i % 2), root: 'C', quality: 'maj7' }));
    const reply = JSON.stringify({ action: 'edit', message: 'I will raise the tempo of the whole song.', assumptions: [], ops: [{ op: 'SET_TEMPO', bpm: 120 }, { op: 'REHARMONIZE', from_bar: 23, to_bar: 30, chords }] });
    expect(refusedReply(reply)).toBe('(your refused reply, shortened: action edit; ops: 1 SET_TEMPO bpm=120 | 2 REHARMONIZE from_bar=23 to_bar=30 chords: 16)');
    expect(refusedReply('{"action":"say","message":"hi"}')).toBe('{"action":"say"}');
    expect(refusedReply('not json')).toBe('(not valid JSON: not json)');
  });

  it('N4: each retry is built on the first attempt, one shortened pair per refusal, reasons cut at 300 characters', () => {
    const msgs = turnMessages(base);
    const next = turnRetry(msgs, [{ reply: '{}', reasons: ['a'] }, { reply: '{}', reasons: ['b'.repeat(500)] }]);
    expect(next.slice(0, 2)).toEqual(msgs);
    expect(next.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user']);
    expect(next[5].content).toContain(`- ${'b'.repeat(300)}…
`);
  });

  it('the whole prompt on a chord-free 206-bar song (the library cover F-042 #2 names) with a full history stays under 6k tokens at 3 characters a token', () => {
    const chorded = facts206();
    // SP-5's 206-bar song is a chord-free cover: runs of identical bars, which the run-length map collapses (3.25k -> 1.16k tokens there).
    const bar_map = chorded.bar_map.map((l, i) => `${i + 1}: - | V:${Math.floor(i / 8) % 2 ? 'sung' : 'rest'} | I:0`);
    const f = { ...chorded, bar_map };
    const song = { title: 'Long Song', style: 'rock', versions: [{ number: 1, label: 'first generation', active: true }], facts: f, reason: null };
    const history = Array.from({ length: 4 }, () => [msg('user', 'text', 'x'.repeat(300)), msg('assistant', 'say', 'y'.repeat(300))]).flat();
    const msgs = turnMessages({ rules: CHAT_RULES, state: songStateLines({ library: Array(50).fill('A library song title'), song }), facts: f, request: 'jazz chords in the chorus', pending: [], history });
    expect(msgs.reduce((n, m) => n + m.content.length, 0) / 3).toBeLessThan(6000);
    expect(msgs[1].content).toContain('\n1-8: - | V:rest | I:0\n9-16: - | V:sung | I:0\n');
  });

  it('C1: the MARK lines come after the song state and before the REQUEST; none without a mark', () => {
    const [, user] = turnMessages({ ...base, state: ['SONG: "X"'], mark: ['MARK (…): bars 47-58, 1:58-2:22.'] });
    const at = ['SONG: "X"', 'MARK (…)', 'REQUEST: x'].map((s) => user.content.indexOf(s));
    expect(at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1]))).toBe(true);
    expect(turnMessages(base)[1].content).not.toContain('MARK');
  });
});
