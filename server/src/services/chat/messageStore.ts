/**
 * Chat messages in SQLite (docs/decisions/0007): append with the thread's next `seq`, idempotent
 * on a user message's `client_key` (a double SEND is one row, F-042 edge); list; the last turns
 * for the prompt; set job / version / outcome. Bodies are stored with `chat_v: 1`; one of an
 * unknown chat_v reads as null (the card shows without its snapshot, never a crash).
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import type { ChatMessage, MessageBody, MessageKind, MessageRole } from './chatTypes.js';

export const CHAT_V = 1;

interface Row {
  id: string; thread_id: string; seq: number; role: string; kind: string; text: string; body_json: string | null;
  proposal_id: string | null; job_id: string | null; version_id: string | null; client_key: string | null; created_at: string;
}

/** body_json -> body. Absent, unreadable or another chat_v -> null. */
export function readBody(raw: string | null): MessageBody | null {
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw) as Record<string, unknown> | null;
    if (!blob || typeof blob !== 'object' || blob.chat_v !== CHAT_V) return null;
    const { chat_v: _v, ...body } = blob;
    return body as unknown as MessageBody;
  } catch {
    return null;
  }
}

const writeBody = (body: MessageBody | null | undefined): string | null =>
  body ? JSON.stringify({ chat_v: CHAT_V, ...body }) : null;

const decode = (r: Row): ChatMessage => ({
  id: r.id, threadId: r.thread_id, seq: r.seq, role: r.role as MessageRole, kind: r.kind as MessageKind, text: r.text,
  body: readBody(r.body_json), proposalId: r.proposal_id, jobId: r.job_id, versionId: r.version_id,
  clientKey: r.client_key, createdAt: r.created_at,
});

export function messageById(id: string): ChatMessage | null {
  const row = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(id) as Row | undefined;
  return row ? decode(row) : null;
}

export interface NewMessage {
  role: MessageRole;
  kind: MessageKind;
  text?: string;
  body?: MessageBody | null;
  proposalId?: string | null;
  jobId?: string | null;
  versionId?: string | null;
  clientKey?: string | null;
}

/** Append at the end of the thread. A `clientKey` already used in this thread returns that first
 * message with `replayed: true` and writes nothing. */
export const appendMessage = db.transaction((threadId: string, m: NewMessage): { message: ChatMessage; replayed: boolean } => {
  if (m.clientKey) {
    const first = db.prepare(`SELECT * FROM chat_messages WHERE thread_id = ? AND client_key = ?`).get(threadId, m.clientKey) as Row | undefined;
    if (first) return { message: decode(first), replayed: true };
  }
  const { next } = db.prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM chat_messages WHERE thread_id = ?`).get(threadId) as { next: number };
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO chat_messages (id, thread_id, seq, role, kind, text, body_json, proposal_id, job_id, version_id, client_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, threadId, next, m.role, m.kind, m.text ?? '', writeBody(m.body), m.proposalId ?? null, m.jobId ?? null,
    m.versionId ?? null, m.clientKey || null,
  );
  return { message: messageById(id)!, replayed: false };
});

/** The thread's messages in order. */
export function listMessages(threadId: string): ChatMessage[] {
  return (db.prepare(`SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY seq`).all(threadId) as Row[]).map(decode);
}

/** The last `n` turns, in order: everything from the n-th last user message on (the prompt's
 * "last 4 turns"). Fewer user messages than `n`: the whole thread. */
export function lastTurns(threadId: string, n: number): ChatMessage[] {
  if (n <= 0) return [];
  const from = db.prepare(`SELECT seq FROM chat_messages WHERE thread_id = ? AND role = 'user' ORDER BY seq DESC LIMIT 1 OFFSET ?`)
    .get(threadId, n - 1) as { seq: number } | undefined;
  return (db.prepare(`SELECT * FROM chat_messages WHERE thread_id = ? AND seq >= ? ORDER BY seq`).all(threadId, from?.seq ?? 0) as Row[]).map(decode);
}

export interface MessagePatch {
  kind?: MessageKind;
  text?: string;
  body?: MessageBody | null;
  proposalId?: string | null;
  jobId?: string | null;
  versionId?: string | null;
}

const COLUMNS: Record<keyof MessagePatch, string> = {
  kind: 'kind', text: 'text', body: 'body_json', proposalId: 'proposal_id', jobId: 'job_id', versionId: 'version_id',
};

/** Set a message's job, version or outcome (only the keys given); returns the updated message. */
export function updateMessage(id: string, patch: MessagePatch): ChatMessage | null {
  const keys = (Object.keys(patch) as (keyof MessagePatch)[]).filter((k) => k in COLUMNS && patch[k] !== undefined);
  if (keys.length > 0) {
    const values = keys.map((k) => (k === 'body' ? writeBody(patch.body) : patch[k]));
    db.prepare(`UPDATE chat_messages SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
  }
  return messageById(id);
}
