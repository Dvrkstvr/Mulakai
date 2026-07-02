import express from 'express';
import { config } from './config.js';
import { songsRouter } from './routes/songs.js';
import { layersRouter } from './routes/layers.js';
import { generateRouter } from './routes/generate.js';
import { sweepTrash } from './services/trashSweep.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use('/api/songs', songsRouter);
app.use('/api/layers', layersRouter);
app.use('/api/generate', generateRouter);
app.use('/audio', express.static(config.audioDir));

sweepTrash();
setInterval(sweepTrash, 60 * 60 * 1000);

app.listen(config.port, () => {
  console.log(`Mulakai server on http://127.0.0.1:${config.port} (ACE-Step: ${config.acestepUrl})`);
});
