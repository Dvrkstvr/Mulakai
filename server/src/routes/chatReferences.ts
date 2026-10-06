/**
 * Attaching a reference to the draft thread (F-061 storage, F-062; architecture "Chat (C3)"): a
 * dropped file (multipart `audio`), a library song, the thread's list. Refusals are `{reason}` for
 * the card's rust line; a song's thread takes no new reference in C3 (D-130). READ / RE-ANALYZE
 * routes come with CR-4.
 */
import { Router, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { fromLibrary, fromUpload, listReferences, toView, type AddResult } from '../services/chat/referenceStore.js';
import { threadById } from '../services/chat/threadStore.js';
import type { ChatThread } from '../services/chat/chatTypes.js';

export const chatReferencesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: config.coverMaxUploadMb * 1024 * 1024 }, defParamCharset: 'utf8',
}).single('audio');

/** multer's own errors as `{reason}`, never Express's HTML 500 (as routes/engineCovers.ts). */
const receive: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ reason: `the file is over ${config.coverMaxUploadMb} MB` });
    }
    res.status(400).json({ reason: `could not read the upload: ${err instanceof Error ? err.message : String(err)}` });
  });
};

/** The thread, or undefined after answering: 404 unknown; 409 a song's thread (D-130). */
function draftOnly(id: string, res: Response): ChatThread | undefined {
  const thread = threadById(id);
  if (!thread) {
    res.status(404).json({ error: 'unknown chat' });
    return undefined;
  }
  if (thread.songId !== null) {
    res.status(409).json({ reason: 'a reference starts a new song: press NEW CHAT and attach it there' });
    return undefined;
  }
  return thread;
}

function answer(res: Response, result: AddResult) {
  if (!result.ok) return res.status(400).json({ reason: result.reason });
  res.status(result.existing ? 200 : 201).json({ reference: toView(result.reference) });
}

const checkThread: RequestHandler = (req, res, next) => {
  if (draftOnly(String(req.params.id), res)) next();
};

chatReferencesRouter.post('/threads/:id/references', checkThread, receive, (req, res) => {
  if (!req.file) return res.status(400).json({ reason: 'send the file as `audio`' });
  answer(res, fromUpload(String(req.params.id), { data: req.file.buffer, filename: req.file.originalname }));
});

chatReferencesRouter.post('/threads/:id/references/library', async (req, res) => {
  const thread = draftOnly(String(req.params.id), res);
  if (!thread) return;
  const songId = (req.body ?? {}).songId;
  if (typeof songId !== 'string' || !songId) return res.status(400).json({ reason: 'send {songId}' });
  answer(res, await fromLibrary(thread.id, songId));
});

chatReferencesRouter.get('/threads/:id/references', (req, res) => {
  const thread = threadById(String(req.params.id));
  if (!thread) return res.status(404).json({ error: 'unknown chat' });
  res.json({ references: listReferences(thread.id).map(toView) });
});
