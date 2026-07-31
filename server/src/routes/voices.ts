import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db } from '../db/index.js';

export const voicesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// Stored files are served same-origin by express.static('/audio'), so the upload's
// extension must be allowlisted — an `.html`/`.svg` name would become an executable
// page on our origin. Same list and reasoning as songImport.ts.
const ALLOWED_EXTS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.opus'];

voicesRouter.get('/', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM voices ORDER BY created_at DESC`).all());
});

/** Save a new voice clip. `duration` is client-supplied (read from HTMLAudioElement) — no server-side audio probing exists elsewhere in this codebase. */
voicesRouter.post('/', upload.single('audio'), async (req, res) => {
  const { name = '', duration, tags = '', default_audio_influence, default_style_influence } = req.body ?? {};
  const nameStr = String(name).trim();
  if (!nameStr) return res.status(400).json({ error: 'name is required' });
  if (!req.file) return res.status(400).json({ error: 'audio is required' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.mp3';
  if (!ALLOWED_EXTS.includes(ext)) {
    return res.status(400).json({ error: `unsupported audio format "${ext}"` });
  }
  const id = crypto.randomUUID();
  const filename = `${id}${ext}`;
  await fs.writeFile(path.join(config.audioDir, filename), req.file.buffer);

  db.prepare(
    `INSERT INTO voices (id, name, audio_file, duration, tags, default_audio_influence, default_style_influence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, nameStr, filename,
    duration !== undefined ? Number(duration) : null,
    String(tags),
    default_audio_influence !== undefined ? Number(default_audio_influence) : 0.5,
    default_style_influence !== undefined ? Number(default_style_influence) : 0.5,
  );
  res.status(201).json(db.prepare(`SELECT * FROM voices WHERE id = ?`).get(id));
});

voicesRouter.patch('/:id', (req, res) => {
  const { name, tags, default_audio_influence, default_style_influence } = req.body ?? {};
  const voice = db.prepare(`SELECT id FROM voices WHERE id = ?`).get(req.params.id);
  if (!voice) return res.status(404).json({ error: 'unknown voice' });
  db.prepare(
    `UPDATE voices SET
       name                    = COALESCE(?, name),
       tags                    = COALESCE(?, tags),
       default_audio_influence = COALESCE(?, default_audio_influence),
       default_style_influence = COALESCE(?, default_style_influence)
     WHERE id = ?`,
  ).run(
    typeof name === 'string' && name.trim() ? name.trim() : null,
    typeof tags === 'string' ? tags : null,
    typeof default_audio_influence === 'number' ? default_audio_influence : null,
    typeof default_style_influence === 'number' ? default_style_influence : null,
    req.params.id,
  );
  res.json(db.prepare(`SELECT * FROM voices WHERE id = ?`).get(req.params.id));
});

voicesRouter.delete('/:id', async (req, res) => {
  const voice = db.prepare(`SELECT audio_file FROM voices WHERE id = ?`).get(req.params.id) as { audio_file: string } | undefined;
  if (!voice) return res.status(404).json({ error: 'unknown voice' });
  db.prepare(`DELETE FROM voices WHERE id = ?`).run(req.params.id);
  await fs.unlink(path.join(config.audioDir, voice.audio_file)).catch(() => {});
  res.json({ ok: true });
});
