/**
 * WHAT IT SEES (D-177, F-055 #1): `POST /api/chat/threads/:id/mark/preview {mark}` → the MARK block's plain rows
 * and AS SENT object (`MarkPreview`), from the same markBlock a turn sends, so the chip shows exactly what goes;
 * 409 `{error: 'MARK_STALE', reason, was, shift}` when the mark no longer matches the playable version (D-175);
 * 400 for a bad mark, a mark on a new-song chat or one past the song's end. Nothing is written.
 */
import { Router } from 'express';
import { markAt } from '../services/chat/songStateSource.js';
import { threadById } from '../services/chat/threadStore.js';
import { parseRange } from '../services/score/planReferent.js';
import type { MarkPreview } from '../services/chat/analysisTypes.js';
import { MARK_ON_DRAFT, markStaleBody } from './chatTurns.js';

export function makeChatMarkRouter(): Router {
  const router = Router();
  router.post('/threads/:id/mark/preview', (req, res) => {
    const parsed = parseRange((req.body ?? {}).mark);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (!parsed.mark) return res.status(400).json({ error: 'send {mark}' });
    const thread = threadById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'unknown chat' });
    if (!thread.songId) return res.status(400).json({ error: MARK_ON_DRAFT });
    const at = markAt(thread.songId, parsed.mark);
    if (!at.ok) return res.status(409).json(markStaleBody(at.stale));
    if (at.outside) return res.status(400).json({ error: at.outside });
    const preview: MarkPreview = at.block.preview;
    res.json(preview);
  });
  return router;
}

export const chatMarkRouter = makeChatMarkRouter();
