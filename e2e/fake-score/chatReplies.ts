/**
 * The chat spec's planner replies (F-051, D-178). SP-5's recorded qwen3:14b replies are read as data from
 * `server/test-fakes/data/sp5-replies.json` (the file the server's sp5Replay test replays; e2e imports nothing
 * from server/), so the e2e answers a turn the way the real model did. An edit reply is SP-5's recorded edit
 * envelope carrying a contract fixture's ops instead of its own: yue-server recorded `/v1/scores/apply` only
 * for the contract song's ops (`apply-*.json`), and the fake yue-server answers nothing else.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contract, recordedSong } from './contracts.js';

const SP5 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server/test-fakes/data/sp5-replies.json');

interface Recorded { turn: string; request: string; song_key: string | null; attempts: Array<{ content: string; reasons: string[] }> }

function recordedTurn(id: string): Recorded {
  const data = JSON.parse(fs.readFileSync(SP5, 'utf8')) as { turns: Recorded[] };
  const turn = data.turns.find((t) => t.turn === id);
  if (!turn) throw new Error(`sp5-replies.json has no turn ${id}`);
  return turn;
}

/** A recorded turn: what the person asked and every attempt the model answered, verbatim. */
export function sp5Turn(id: 'RC05.t1' | 'AK02.t1' | 'ED03.t1'): { request: string; replies: string[]; reply: Record<string, unknown> } {
  const t = recordedTurn(id);
  const replies = t.attempts.map((a) => a.content);
  return { request: t.request, replies, reply: JSON.parse(replies.at(-1)!) as Record<string, unknown> };
}

/** ED03's recorded edit envelope with the ops of `fixture`, and a message that says what those ops do. */
export function editReplyFor(fixture: string, message: string): string {
  const ed03 = sp5Turn('ED03.t1').reply;
  return JSON.stringify({ ...ed03, message, assumptions: ['assuming the whole song'], ops: contract(fixture).request.body.ops });
}

/** C2 (F-058, D-227): a follow-up edit while an edit card is live is a revise, `{drop, ops}` on the pending plan's
 * op numbers. `drop` [] with the pending ops echoed merges to the same plan, all SAME (D-076 e); a turn with no live
 * card reads only `ops`, so the reply works either way. */
export function reviseReplyFor(fixture: string, message: string, drop: number[] = []): string {
  return JSON.stringify({ ...JSON.parse(editReplyFor(fixture, message)), drop });
}

/**
 * The person's hand edit that makes the draft render the contract song: its style as the STYLE, its words
 * as the LYRICS, and TEMPO, KEY, METER, LANGUAGE and STRUCTURE cleared (each would add a style hint or a
 * bare tag). The YuE2 take then stores exactly the style and lyrics yue-server's score fixtures were
 * recorded with, so every score read and apply of the new song matches a recording.
 */
export function contractSongDraft(): Record<string, unknown> {
  const song = recordedSong();
  const lyrics = song.lyrics.trim().split(/\n\n+/).map((block) => {
    const [head, ...lines] = block.split('\n');
    return { tag: head.replace(/^\[|\]$/g, ''), lines };
  });
  return { style: song.style, lyrics, bpm: null, key: null, timeSignature: null, language: null, structure: null };
}
