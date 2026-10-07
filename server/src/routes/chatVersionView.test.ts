/** threadView's version cards (F-048 edge, CB-5): a version card's A/B (`previous`) goes once the version before it
 * is deleted in the Editor. On a temp DATA_DIR with real rows. */
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-version-view-'));

const { db } = await import('../db/index.js');
const { appendMessage } = await import('../services/chat/messageStore.js');
const { songThread } = await import('../services/chat/threadStore.js');
const { threadView } = await import('./chat.js');

function song(): { songId: string; v1: string; v2: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const [v1, v2] = [crypto.randomUUID(), crypto.randomUUID()];
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'Luz', 192, 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', 'base')`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label) VALUES (?, ?, 'a.wav', 'first')`).run(v1, layerId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label) VALUES (?, ?, 'b.wav', 'jazz')`).run(v2, layerId);
  return { songId, v1, v2 };
}

describe('threadView: version cards', () => {
  it('keeps previous while v1 exists and drops it once v1 is deleted', () => {
    const { songId, v1, v2 } = song();
    const thread = songThread(songId);
    const body = { seconds: 192, label: 'jazz', number: 2, truncated: false, whole: false, splice: null, fallback: null, previous: { versionId: v1, number: 1 } };
    appendMessage(thread.id, { role: 'assistant', kind: 'version', text: 'Saved as v2', body: body as never, versionId: v2, jobId: 'j1' });
    const card = () => threadView(thread, true).messages.find((m) => m.kind === 'version')!.body as unknown as typeof body;
    expect(card().previous).toEqual({ versionId: v1, number: 1 });
    db.prepare(`DELETE FROM versions WHERE id = ?`).run(v1);
    expect(card().previous).toBeNull();
  });
});
