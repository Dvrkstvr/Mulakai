import { Router } from 'express';
import multer from 'multer';
import { startAddLayer } from '../services/addLayerJobs.js';

export const songLayersRouter = Router();

// Memory storage: the bounced mix is transient (forwarded to ACE-Step, never
// written to our own disk). Limit generously — a 3min stereo 44.1kHz 16-bit
// WAV is ~30MB — well above the 2mb express.json() limit used elsewhere,
// which multer bypasses anyway since it handles multipart bodies itself.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/** Add a new layer to a song via the `lego` task, conditioned on the client-bounced mix of currently audible layers. */
songLayersRouter.post('/:id/layers', upload.single('mix_audio'), async (req, res) => {
  const { prompt = '', layerName = '', inference_steps, guidance_scale,
    use_random_seed, seed, model, lm_model_path, thinking, use_format } = req.body ?? {};
  const promptStr = String(prompt);
  const layerNameStr = String(layerName);
  if (!promptStr.trim()) return res.status(400).json({ error: 'prompt is required' });
  if (!req.file) return res.status(400).json({ error: 'mix_audio is required' });
  try {
    const job = await startAddLayer(String(req.params.id), promptStr, layerNameStr || 'New Layer', req.file.buffer, {
      ...(model ? { model: String(model) } : {}),
      ...(lm_model_path ? { lm_model_path: String(lm_model_path) } : {}),
      ...(thinking !== undefined ? { thinking: Boolean(thinking) } : {}),
      ...(use_format !== undefined ? { use_format: Boolean(use_format) } : {}),
      ...(inference_steps !== undefined ? { inference_steps: Number(inference_steps) } : {}),
      ...(guidance_scale !== undefined ? { guidance_scale: Number(guidance_scale) } : {}),
      ...(use_random_seed === false ? { use_random_seed: false } : {}),
      ...(seed !== undefined && use_random_seed === false ? { seed: Number(seed) } : {}),
    });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'add layer failed';
    res.status(msg === 'unknown song' ? 404 : 502).json({ error: msg });
  }
});
