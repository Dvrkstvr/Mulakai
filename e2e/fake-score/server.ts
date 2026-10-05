/** The SCORE spec's fakes in one process (F-028): fake Ollama and fake yue-server on SCORE_PORTS. */
import { SCORE_PORTS } from '../ports.js';
import { startFakeOllama } from './ollama.js';
import { startFakeYue } from './yue.js';

startFakeOllama(SCORE_PORTS.ollama);
startFakeYue(SCORE_PORTS.yue);
