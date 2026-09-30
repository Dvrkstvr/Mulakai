/**
 * Extra song-creation engines (PLAN.md "Multiple Song-Creation Engines"): optional,
 * separate processes that make a new song's first take. ACE-Step still does every edit
 * afterwards. Each engine is a small module describing itself and mapping Create fields
 * onto its own request; engineClient.ts speaks the shared wire contract for all of them.
 */

/** Extra engines only — ACE-Step is the built-in one and never goes through SongEngine. */
export type EngineId = 'yue2' | 'heartmula';

/** Static per engine: it describes the model, not the deployment. Drives the Create UI's
 * in-place `n/a` gating (design point 6). */
export interface EngineCapabilities {
  /** ACE-Step exact; HeartMuLa a cap; YuE2 none. */
  duration: 'exact' | 'max' | 'none';
  /** How BPM / KEY / TIME SIGNATURE reach the model. */
  musicalMeta: 'params' | 'style-text' | 'none';
  /** Voice / reference-audio picker. */
  referenceAudio: boolean;
  /** LoRA/LoKr (ACE-Step only). */
  adapters: boolean;
  /** false = results are not reproducible. */
  seed: boolean;
  languages: string[] | 'any';
  /** The engine's lyric section vocabulary, if it has a fixed one. */
  sectionTags: string[] | null;
  /** LM MODEL / THINKING / AI ENHANCE apply to *this generation*. */
  lmTools: boolean;
  /** ACE-Step's DiT knobs (STEPS, ADVANCED). */
  advanced: boolean;
  /** TAKES / batch_size. */
  takes: boolean;
  extraControls: ('cfg' | 'temperature' | 'topK' | 'cot')[];
  /** The DESIGN.md inline consequence line shown under GENERATE; '' = none. */
  consequence: string;
}

/**
 * The Create › PROMPT fields, under the same names `POST /api/generate` takes, so the
 * client builds either body from one draft. Absent = AUTO. The last four are the
 * engine-only controls, named after `EngineCapabilities.extraControls`.
 */
export interface CreateFields {
  prompt?: string;
  lyrics?: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  vocal_language?: string;
  audio_duration?: number;
  guidance_scale?: number;
  use_random_seed?: boolean;
  seed?: number;
  /** OutputSettings (see audioOutput.ts) — applied by Mulakai on the way to disk, never sent. */
  output?: unknown;
  cfg?: number;
  temperature?: number;
  top_k?: number;
  cot?: 'full' | 'melody' | 'off';
}

/** What an engine can say about its own output's musical metadata. */
export interface SongMeta {
  bpm: number | null;
  keyScale: string;
  timeSignature: string;
}

export interface SongEngine {
  id: EngineId;
  /** Display label, e.g. 'YUE2'. */
  label: string;
  /** From config; '' = disabled. */
  url: string;
  apiKey: string;
  capabilities: EngineCapabilities;
  /** Pure mapper to the wrapper's POST /v1/jobs body. Our job id travels separately, as
   * the Idempotency-Key header (see engineClient.ts). */
  toRequest(fields: CreateFields): Record<string, unknown>;
  /** bpm/key/time signature, from whatever the engine returns (e.g. YuE2's ABC score). */
  readMeta(result: { score?: string }): SongMeta;
}
