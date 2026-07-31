import express from 'express';
import { config } from './config.js';
import { songsRouter } from './routes/songs.js';
import { foldersRouter } from './routes/folders.js';
import { songLayersRouter } from './routes/songLayers.js';
import { songImportRouter } from './routes/songImport.js';
import { remasterRouter } from './routes/remaster.js';
import { layersRouter } from './routes/layers.js';
import { versionsRouter } from './routes/versions.js';
import { generateRouter } from './routes/generate.js';
import { splitRouter } from './routes/split.js';
import { voicesRouter } from './routes/voices.js';
import { outputMetadataRouter } from './routes/outputMetadata.js';
import { lyricTagsRouter } from './routes/lyricTags.js';
import { adaptersRouter } from './routes/adapters.js';
import { probeFfmpeg } from './services/transcode.js';
import { sweepTrash } from './services/trashSweep.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use('/api/songs', songsRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/songs', songLayersRouter);
app.use('/api/songs', songImportRouter);
app.use('/api/songs', remasterRouter);
app.use('/api/layers', layersRouter);
app.use('/api/layers', versionsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/split', splitRouter);
app.use('/api/voices', voicesRouter);
app.use('/api/output-metadata', outputMetadataRouter);
app.use('/api/lyric-tags', lyricTagsRouter);
app.use('/api/adapters', adaptersRouter);
app.use('/audio', express.static(config.audioDir));

sweepTrash();
setInterval(sweepTrash, 60 * 60 * 1000);

app.listen(config.port, config.host, async () => {
  console.log(`Mulakai server on http://${config.host}:${config.port} (ACE-Step: ${config.acestepUrl})`);
  // Every produced file goes through ffmpeg (services/transcode.ts). Say so at
  // boot rather than failing mid-generation — it is already a prerequisite of
  // demucs-server and ACE-Step's own setup.
  if (!(await probeFfmpeg())) {
    console.error('  ffmpeg NOT FOUND — generation and stem splits will fail. Install it, or set FFMPEG_PATH.');
  }
});
