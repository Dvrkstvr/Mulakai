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
import { enginesRouter } from './routes/engines.js';
import { lyricsRouter } from './routes/lyrics.js';
import { scorePlanRouter } from './routes/scorePlan.js';
import { scoreRouter } from './routes/score.js';
import { scoreMidiRouter } from './routes/scoreMidi.js';
import { referencedNotationIds, sweepNotation } from './services/notationStore.js';
import { scoreRetimeRouter } from './routes/scoreRetime.js';
import { scoreRenderRouter } from './routes/scoreRender.js';
import { chatRouter } from './routes/chat.js';
import { chatTurnsRouter } from './routes/chatTurns.js';
import { chatReferencesRouter } from './routes/chatReferences.js';
import { chatMarkRouter } from './routes/chatMark.js';
import { chatAnalysisRouter } from './routes/chatAnalysis.js';
import { chatRetimeRouter } from './routes/chatRetime.js';
import { assistRouter } from './routes/assist.js';
import { mountClient } from './clientStatic.js';
import { startAnalysisTrigger } from './services/chat/analysisTrigger.js';
import { probeFfmpeg } from './services/transcode.js';
import { sweepTrash } from './services/trashSweep.js';
import { sweepOrphanStems } from './services/stemFiles.js';
import { isLiveSplit } from './services/stemSplit.js';
import { evictIdle, sweepStaleTemp } from './services/jobEviction.js';

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
app.use('/api/engines', enginesRouter);
app.use('/api/lyrics', lyricsRouter);
app.use('/api/songs', scorePlanRouter);
app.use('/api/songs', scoreRouter);
app.use('/api/songs', scoreRenderRouter);
app.use('/api', scoreMidiRouter);
app.use('/api', scoreRetimeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/chat', chatTurnsRouter);
app.use('/api/chat', chatReferencesRouter);
app.use('/api/chat', chatMarkRouter);
app.use('/api/chat', chatAnalysisRouter);
app.use('/api/chat', chatRetimeRouter);
app.use('/api/assist', assistRouter);
app.use('/audio', express.static(config.audioDir));
if (config.clientDist) mountClient(app, config.clientDist);

startAnalysisTrigger(); // a save on a chat song queues its version analysis (F-052, D-172)
sweepTrash(); // and the orphaned chat reference files (trashSweep.ts)
setInterval(sweepTrash, 60 * 60 * 1000);
// Kept transcription notation files no version points at, once 30 days old (re-time, D-207).
void Promise.resolve().then(() => sweepNotation(referencedNotationIds()))
  .then((n) => { if (n) console.log(`Removed ${n} unreferenced transcription notation file(s)`); })
  .catch((err) => console.error('Notation sweep failed:', err));
// Jobs live only in memory: a restart strands the files they own, and a closed tab
// never cancels or discards its job.
void sweepOrphanStems(isLiveSplit)
  .then((n) => { if (n) console.log(`Removed ${n} unclaimed split stem file(s) from a previous run`); })
  .catch((err) => console.error('Orphaned stem sweep failed:', err));
const sweepTemp = () => void sweepStaleTemp()
  .then((n) => { if (n) console.log(`Removed ${n} stale scratch split/remaster temp file(s)`); })
  .catch((err) => console.error('Stale temp sweep failed:', err));
sweepTemp();
setInterval(sweepTemp, 60 * 60 * 1000);
setInterval(() => void evictIdle().catch((err) => console.error('Idle job eviction failed:', err)), 5 * 60 * 1000);

app.listen(config.port, config.host, async () => {
  console.log(`Mulakai server on http://${config.host}:${config.port} (ACE-Step: ${config.acestepUrl})`);
  // Every produced file goes through ffmpeg (services/transcode.ts). Say so at
  // boot rather than failing mid-generation — it is already a prerequisite of
  // demucs-server and ACE-Step's own setup.
  if (!(await probeFfmpeg())) {
    console.error('  ffmpeg NOT FOUND — generation and stem splits will fail. Install it, or set FFMPEG_PATH.');
  }
});
