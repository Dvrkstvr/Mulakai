import { Router } from 'express';
import multer from 'multer';
import { startAddLayer } from '../services/addLayerJobs.js';
import { GenLockError } from '../services/genLock.js';

export const songLayersRouter = Router();

// Memory storage: the bounced mix is transient (forwarded to ACE-Step, never
// written to our own disk). Limit generously — a 3min stereo 44.1kHz 16-bit
// WAV is ~30MB — well above the 2mb express.json() limit used elsewhere,
// which multer bypasses anyway since it handles multipart bodies itself.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/** Add a new layer to a song via the `lego` task, conditioned on the client-bounced mix of currently audible layers. */
songLayersRouter.post('/:id/layers', upload.single('mix_audio'), async (req, res) => {
  const { prompt = '', layerName = '', lyrics, track_name, inference_steps, guidance_scale,
    use_random_seed, seed, model, lm_model_path, thinking, use_format, audio_format,
    shift, infer_method, timesteps, use_adg, cfg_interval_start, cfg_interval_end,
    lm_temperature, lm_cfg_scale, lm_negative_prompt, lm_top_k, lm_top_p, lm_repetition_penalty,
    voiceId, audio_influence, style_influence } = req.body ?? {};
  const promptStr = String(prompt);
  const layerNameStr = String(layerName);
  if (!promptStr.trim()) return res.status(400).json({ error: 'prompt is required' });
  if (!req.file) return res.status(400).json({ error: 'mix_audio is required' });
  try {
    const job = await startAddLayer(String(req.params.id), promptStr, layerNameStr || 'New Layer', req.file.buffer, {
      ...(lyrics ? { lyrics: String(lyrics) } : {}),
      ...(track_name ? { track_name: String(track_name) } : {}),
      ...(model ? { model: String(model) } : {}),
      ...(lm_model_path ? { lm_model_path: String(lm_model_path) } : {}),
      ...(thinking !== undefined ? { thinking: Boolean(thinking) } : {}),
      ...(use_format !== undefined ? { use_format: Boolean(use_format) } : {}),
      ...(audio_format ? { audio_format: String(audio_format) } : {}),
      ...(inference_steps !== undefined ? { inference_steps: Number(inference_steps) } : {}),
      ...(guidance_scale !== undefined ? { guidance_scale: Number(guidance_scale) } : {}),
      ...(use_random_seed === false ? { use_random_seed: false } : {}),
      ...(seed !== undefined && use_random_seed === false ? { seed: Number(seed) } : {}),
      // Advanced DiT knobs (multipart → strings; use_adg needs an explicit 'true' compare,
      // since Boolean('false') is truthy).
      ...(shift !== undefined ? { shift: Number(shift) } : {}),
      ...(infer_method ? { infer_method: String(infer_method) as 'ode' | 'sde' } : {}),
      ...(typeof timesteps === 'string' && timesteps.trim() ? { timesteps } : {}),
      ...(use_adg !== undefined ? { use_adg: use_adg === 'true' || use_adg === true } : {}),
      ...(cfg_interval_start !== undefined ? { cfg_interval_start: Number(cfg_interval_start) } : {}),
      ...(cfg_interval_end !== undefined ? { cfg_interval_end: Number(cfg_interval_end) } : {}),
      // LM knobs (lego runs the 5Hz LM, unlike repaint).
      ...(lm_temperature !== undefined ? { lm_temperature: Number(lm_temperature) } : {}),
      ...(lm_cfg_scale !== undefined ? { lm_cfg_scale: Number(lm_cfg_scale) } : {}),
      ...(lm_negative_prompt ? { lm_negative_prompt: String(lm_negative_prompt) } : {}),
      ...(lm_top_k !== undefined ? { lm_top_k: Number(lm_top_k) } : {}),
      ...(lm_top_p !== undefined ? { lm_top_p: Number(lm_top_p) } : {}),
      ...(lm_repetition_penalty !== undefined ? { lm_repetition_penalty: Number(lm_repetition_penalty) } : {}),
    }, {
      voiceId: voiceId ? String(voiceId) : undefined,
      audioInfluence: audio_influence !== undefined ? Number(audio_influence) : undefined,
      styleInfluence: style_influence !== undefined ? Number(style_influence) : undefined,
    });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    const msg = err instanceof Error ? err.message : 'add layer failed';
    res.status(msg === 'unknown song' ? 404 : 502).json({ error: msg });
  }
});
