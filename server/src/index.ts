import express from 'express';
import { config } from './config.js';
import { songsRouter } from './routes/songs.js';
import { songLayersRouter } from './routes/songLayers.js';
import { remasterRouter } from './routes/remaster.js';
import { layersRouter } from './routes/layers.js';
import { versionsRouter } from './routes/versions.js';
import { generateRouter } from './routes/generate.js';
import { splitRouter } from './routes/split.js';
import { voicesRouter } from './routes/voices.js';
import { sweepTrash } from './services/trashSweep.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use('/api/songs', songsRouter);
app.use('/api/songs', songLayersRouter);
app.use('/api/songs', remasterRouter);
app.use('/api/layers', layersRouter);
app.use('/api/layers', versionsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/split', splitRouter);
app.use('/api/voices', voicesRouter);
app.use('/audio', express.static(config.audioDir));

sweepTrash();
setInterval(sweepTrash, 60 * 60 * 1000);

app.listen(config.port, () => {
  console.log(`Mulakai server on http://127.0.0.1:${config.port} (ACE-Step: ${config.acestepUrl})`);
});
