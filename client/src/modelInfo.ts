/** Human-readable descriptions for ACE-Step models, matched by name pattern since
 * /v1/model_inventory only returns names (docs/ace-step-1.5/GUIDE.md#model-architecture).
 * Falls back to a generic line for anything unrecognized (custom LoRAs, etc.). */

export function ditModelDescription(name: string): string {
  const n = name.toLowerCase();
  if (!name) return 'AUTO — let ACE-Step use its default DiT model.';
  if (n.includes('xl-turbo')) return 'XL (4B decoder) Turbo — fast + high quality, best daily driver on 20GB+ GPU.';
  if (n.includes('xl-sft')) return 'XL (4B decoder) SFT — highest quality, tunable CFG. Needs 12GB+ VRAM.';
  if (n.includes('xl-base')) return 'XL (4B decoder) Base — all tasks incl. extract/lego/complete. Needs 12GB+ VRAM.';
  if (n.includes('turbo-shift1')) return 'Turbo distilled only on shift=1 — richer detail, but weaker semantics.';
  if (n.includes('turbo-shift3')) return 'Turbo distilled only on shift=3 — clearer, richer timbre, but can sound dry with minimal orchestration.';
  if (n.includes('turbo-continuous')) return 'Experimental Turbo with continuous shift 1–5 — most flexible tuning, not thoroughly tested.';
  if (n.includes('turbo')) return 'Joint distillation on shift 1/2/3 — best balance of creativity and semantics. Recommended default.';
  if (n.includes('sft')) return 'Supports CFG tuning and more steps (50) — richer detail/semantics than Turbo, but slower.';
  if (n.includes('base')) return 'Master of all tasks — only model supporting extract/lego/complete. Best for fine-tuning. Slower (32–100 steps).';
  return 'Custom or fine-tuned DiT model.';
}

/**
 * Practical STEPS slider ceiling per DiT model family (docs/ace-step-1.5/API.md#4.2,
 * GUIDE.md's Inference Hyperparameters table). Turbo is distilled for ~8 steps —
 * going past ~20 burns time with no quality gain. Base/SFT can meaningfully use up
 * to ~100. AUTO (unset) keeps a neutral default since the server's actual model
 * isn't known client-side.
 */
export function stepsMax(name: string): number {
  const n = name.toLowerCase();
  if (!name) return 64;
  if (n.includes('turbo')) return 20;
  return 100;
}

/**
 * Whether GUIDANCE (CFG) has any effect on the given DiT model (API.md#4.2,
 * GUIDE.md's SFT Model section). Turbo is distilled without CFG — the slider
 * value is a pure no-op there, unlike STEPS which just has a lower ceiling.
 * AUTO (unset) reads as effective since the resolved model isn't known yet.
 */
export function guidanceEffective(name: string): boolean {
  return !name.toLowerCase().includes('turbo');
}

export function lmModelDescription(name: string): string {
  const n = name.toLowerCase();
  if (!name) return 'AUTO — let ACE-Step use its default LM planner (or skip it, if disabled).';
  if (n.includes('0.6b')) return 'Smallest LM — basic world knowledge, weak memory. Fastest; good for <8GB VRAM or quick prototyping.';
  if (n.includes('1.7b')) return 'Mid-size LM — medium world knowledge & memory. Default recommendation for most setups (8–16GB VRAM).';
  if (n.includes('4b')) return 'Largest LM — richest world knowledge, strongest memory. Best for complex or high-quality generation (16GB+ VRAM).';
  return 'Custom or fine-tuned LM model.';
}
