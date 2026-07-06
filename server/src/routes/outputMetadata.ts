import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getOutputMetadata, updateOutputMetadata, setCoverArt, clearCoverArt, type OutputMetadata } from '../services/outputMetadata.js';

export const outputMetadataRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function withCoverArtUrl(meta: OutputMetadata) {
  return { ...meta, coverArtUrl: meta.coverArtFile ? `/audio/${meta.coverArtFile}` : null };
}

outputMetadataRouter.get('/', (_req, res) => {
  res.json(withCoverArtUrl(getOutputMetadata()));
});

outputMetadataRouter.patch('/', (req, res) => {
  const { artist, encoder, album, genre, id3Version } = req.body ?? {};
  const meta = updateOutputMetadata({
    ...(typeof artist === 'string' ? { artist } : {}),
    ...(typeof encoder === 'string' ? { encoder } : {}),
    ...(typeof album === 'string' ? { album } : {}),
    ...(typeof genre === 'string' ? { genre } : {}),
    ...(id3Version === '3' || id3Version === '4' ? { id3Version } : {}),
  });
  res.json(withCoverArtUrl(meta));
});

outputMetadataRouter.post('/cover-art', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image is required' });
  const ext = path.extname(req.file.originalname) || '.png';
  const meta = await setCoverArt(req.file.buffer, ext);
  res.json(withCoverArtUrl(meta));
});

outputMetadataRouter.delete('/cover-art', async (_req, res) => {
  const meta = await clearCoverArt();
  res.json(withCoverArtUrl(meta));
});
