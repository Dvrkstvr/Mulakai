/**
 * Registry of externally-trained LoRA/LoKr adapters, plus the one-way sync that makes
 * ACE-Step's adapter state match the app's selection.
 *
 * Adapters are *global server state* in ACE-Step: `/release_task` has no adapter parameter,
 * so whatever is loaded colours every generate/repaint/lego/cover/remaster until changed.
 * Mulakai therefore models one active adapter app-wide and reconciles before each job
 * (see jobs.ts's ensureModelLoaded), rather than pretending it is a per-request option.
 */
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { loadLora, unloadLora, setLoraScale, loraStatus, getModelGeneration } from './acestep.js';

export interface Adapter {
  id: string;
  name: string;
  /** Path on the ACE-Step host's filesystem — a PEFT directory (LoRA) or a safetensors file (LoKr). */
  path: string;
  kind: string;
  scale: number;
  createdAt: string;
}

interface Row {
  id: string;
  name: string;
  path: string;
  kind: string;
  scale: number;
  created_at: string;
}

const toAdapter = (r: Row): Adapter => ({
  id: r.id, name: r.name, path: r.path, kind: r.kind, scale: r.scale, createdAt: r.created_at,
});

export function listAdapters(): Adapter[] {
  const rows = db.prepare(`SELECT * FROM adapters ORDER BY created_at`).all() as Row[];
  return rows.map(toAdapter);
}

export function getAdapter(id: string): Adapter | null {
  const row = db.prepare(`SELECT * FROM adapters WHERE id = ?`).get(id) as Row | undefined;
  return row ? toAdapter(row) : null;
}

export function getActiveAdapter(): Adapter | null {
  const row = db.prepare(
    `SELECT a.* FROM adapter_state s JOIN adapters a ON a.id = s.active_adapter_id WHERE s.id = 1`,
  ).get() as Row | undefined;
  return row ? toAdapter(row) : null;
}

/** Passing null selects "no adapter" — every generation runs on the base model again. */
export function setActiveAdapter(id: string | null): Adapter | null {
  if (id !== null && !getAdapter(id)) throw new Error(`Unknown adapter ${id}`);
  db.prepare(`UPDATE adapter_state SET active_adapter_id = ? WHERE id = 1`).run(id);
  return getActiveAdapter();
}

export function setAdapterScale(id: string, scale: number): Adapter {
  const clamped = Math.min(1, Math.max(0, scale));
  db.prepare(`UPDATE adapters SET scale = ? WHERE id = ?`).run(clamped, id);
  const adapter = getAdapter(id);
  if (!adapter) throw new Error(`Unknown adapter ${id}`);
  return adapter;
}

/** The FK's ON DELETE SET NULL clears the active selection if this was it. */
export function deleteAdapter(id: string): void {
  db.prepare(`DELETE FROM adapters WHERE id = ?`).run(id);
}

/**
 * Registers an adapter by *loading* it: `lora_path` points at the ACE-Step host's filesystem,
 * which may not be this machine, so a local stat would prove nothing. A bad path or a
 * directory that isn't an adapter fails here with ACE-Step's own message, and the adapter
 * type it reports back becomes `kind`.
 *
 * Requires an initialized model — ACE-Step's adapter routes 500 with "Model not initialized"
 * otherwise, which surfaces to the caller unchanged.
 */
export async function registerAdapter(name: string, adapterPath: string): Promise<Adapter> {
  await loadLora(adapterPath);
  // Loading also activates (ACE-Step sets lora_loaded/use_lora together), so the server is now
  // running this adapter whether or not it is the selected one. Record that, then reconcile
  // back to the actual selection below.
  applied = { path: adapterPath, scale: 1, generation: getModelGeneration() };
  const kind = (await loraStatus().catch(() => null))?.adapterType ?? 'lora';
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO adapters (id, name, path, kind) VALUES (?, ?, ?, ?)`).run(id, name, adapterPath, kind);
  await reconcileAdapter();
  return getAdapter(id)!;
}

/** What this process last applied to slot 1's current model, or null if nothing is loaded. */
let applied: { path: string; scale: number; generation: number } | null = null;

/**
 * Drives ACE-Step to whatever adapter is selected. Idempotent, and safe to call before every
 * job — when nothing is selected and nothing was applied it makes no request at all.
 *
 * The `generation` check is what handles re-initialization: `/v1/init` rebuilds the DiT and
 * silently drops any attached adapter while still reporting it as loaded (see
 * acestep.ts#getModelGeneration), so a bumped counter forces a re-load even though the server
 * claims nothing changed.
 *
 * Failures propagate. A job that was asked to use an adapter and could not should fail with
 * ACE-Step's error rather than quietly generating on the base model, and leaving `applied`
 * untouched means the next attempt retries.
 */
export async function reconcileAdapter(): Promise<void> {
  const desired = getActiveAdapter();
  const generation = getModelGeneration();

  if (!desired) {
    if (applied) {
      await unloadLora();
      applied = null;
    }
    return;
  }

  if (applied && applied.path === desired.path && applied.generation === generation) {
    if (applied.scale !== desired.scale) {
      await setLoraScale(desired.scale);
      applied = { ...applied, scale: desired.scale };
    }
    return;
  }

  await loadLora(desired.path);
  await setLoraScale(desired.scale);
  applied = { path: desired.path, scale: desired.scale, generation };
}

/** Test seam: `applied` is process state, so tests that simulate a fresh boot must clear it. */
export function resetAppliedAdapter(): void {
  applied = null;
}
