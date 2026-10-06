import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { CHAT_RULES } from './chatRules.js';
import { historyLines, turnMessages, turnRetry } from './turnPrompt.js';
import { songStateLines } from './songState.js';
import { facts206 } from '../../../test-fakes/chatScripts.js';
import type { ChatMessage } from './chatTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
let seq = 0;
const msg = (role: 'user' | 'assistant', kind: ChatMessage['kind'], text: string, body: ChatMessage['body'] = null): ChatMessage => ({
  id: `m${++seq}`, threadId: 't', seq, role, kind, text, body, proposalId: null, jobId: null, versionId: null, clientKey: null, createdAt: '',
});

describe('turn prompt (SP-5 build_messages)', () => {
  it('system = the rules; user = state, pending, history, then the request and the reply line', () => {
    const [system, user] = turnMessages({ rules: CHAT_RULES, state: ['SONG: none yet'], facts: null, request: 'faster please', pending: true, history: [msg('user', 'text', 'a ballad')] });
    expect(system).toEqual({ role: 'system', content: CHAT_RULES });
    const order = ['SONG: none yet', 'PENDING PROPOSAL', 'CONVERSATION (latest last):\nPERSON: a ballad', 'REQUEST: faster please', 'Reply with the JSON object only.'];
    const at = order.map((s) => user.content.indexOf(s));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('a song adds the phrase lines (reused phraseLines) and no pending line when nothing is pending', () => {
    const [, user] = turnMessages({ rules: '', state: [], facts, request: 'add a 2-bar sax phrase', pending: false, history: [] });
    expect(user.content).toContain('PHRASE LENGTH: a WRITE_PHRASE op has exactly 2 bars');
    expect(user.content).not.toContain('PENDING PROPOSAL');
    expect(user.content).not.toContain('CONVERSATION');
  });

  it('history names what each assistant message proposed and skips failed turns', () => {
    const lines = historyLines([
      msg('user', 'text', 'a ballad'),
      msg('assistant', 'recipe', 'Here it is.', { recipe: { title: 'Mar' } as never, assumptions: [], changed: [], skipped: [] }),
      msg('user', 'text', 'hm'),
      msg('assistant', 'failed', 'planner offline'),
      msg('assistant', 'ask', 'Which?', { choices: ['a', 'b'] }),
      msg('assistant', 'song', 'Saved as v1'),
    ]);
    expect(lines).toEqual([
      'PERSON: a ballad', 'ASSISTANT: Here it is. [proposed a new-song card: "Mar"]', 'PERSON: hm', 'ASSISTANT: Which? (choices: a / b)',
      'ASSISTANT: [the song was created: Saved as v1]',
    ]);
  });

  it('a retry appends the reply and the reasons (reused retryMessages)', () => {
    const msgs = turnMessages({ rules: '', state: [], facts: null, request: 'x', pending: false, history: [] });
    const next = turnRetry(msgs, '{"action":"x"}', ['action "x" is not one of ask, say']);
    expect(next).toHaveLength(4);
    expect(next[3].content).toContain('- action "x" is not one of ask, say');
    expect(next[3].content).toContain('Return a corrected, complete reply as one JSON object only.');
  });

  it('the whole prompt on the 206-bar song with 4 turns stays under 6k tokens at 3 characters a token (F-042 #2)', () => {
    const f = facts206();
    const song = { title: 'Long Song', style: 'rock', versions: [{ number: 1, label: 'first generation', active: true }], facts: f, reason: null };
    const history = Array.from({ length: 4 }, () => [msg('user', 'text', 'x'.repeat(200)), msg('assistant', 'say', 'y'.repeat(300))]).flat();
    const msgs = turnMessages({ rules: CHAT_RULES, state: songStateLines({ library: Array(50).fill('A library song title'), draft: {}, song }), facts: f, request: 'jazz chords in the chorus', pending: false, history });
    expect(msgs.reduce((n, m) => n + m.content.length, 0) / 3).toBeLessThan(6000);
  });
});
