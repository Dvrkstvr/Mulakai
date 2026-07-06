import { Router } from 'express';
import { getOutputMetadata, updateOutputMetadata } from '../services/outputMetadata.js';

export const outputMetadataRouter = Router();

outputMetadataRouter.get('/', (_req, res) => {
  res.json(getOutputMetadata());
});

outputMetadataRouter.patch('/', (req, res) => {
  const { artist, encoder, id3Version } = req.body ?? {};
  const meta = updateOutputMetadata({
    ...(typeof artist === 'string' ? { artist } : {}),
    ...(typeof encoder === 'string' ? { encoder } : {}),
    ...(id3Version === '3' || id3Version === '4' ? { id3Version } : {}),
  });
  res.json(meta);
});
