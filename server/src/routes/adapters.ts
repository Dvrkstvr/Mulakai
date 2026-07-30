import { Router } from 'express';
import {
  listAdapters, getActiveAdapter, setActiveAdapter, setAdapterScale,
  deleteAdapter, registerAdapter, reconcileAdapter,
} from '../services/adapters.js';

export const adaptersRouter = Router();

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Mutations write to the DB first, then push the change to ACE-Step. A push failure (most
 * often "Model not initialized" — the adapter routes need a loaded model) is reported back
 * as a warning rather than failing the request: the selection is still recorded, and the
 * reconcile before the next job applies it.
 */
async function syncWarning(): Promise<string | undefined> {
  try {
    await reconcileAdapter();
    return undefined;
  } catch (e) {
    return message(e);
  }
}

adaptersRouter.get('/', (_req, res) => {
  res.json({ adapters: listAdapters(), activeId: getActiveAdapter()?.id ?? null });
});

adaptersRouter.post('/', async (req, res) => {
  const { name, path } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (typeof path !== 'string' || !path.trim()) return res.status(400).json({ error: 'path is required' });
  try {
    res.json(await registerAdapter(name.trim(), path.trim()));
  } catch (e) {
    // Registration validates by loading, so this covers both "that path is not an adapter"
    // and "no model is initialized yet" — both are for the user to fix, and ACE-Step's own
    // message says which.
    res.status(400).json({ error: message(e) });
  }
});

// Declared before /:id so "active" isn't swallowed as an adapter id.
adaptersRouter.patch('/active', async (req, res) => {
  const { id } = req.body ?? {};
  if (id !== null && typeof id !== 'string') return res.status(400).json({ error: 'id must be a string or null' });
  try {
    setActiveAdapter(id);
  } catch (e) {
    return res.status(404).json({ error: message(e) });
  }
  res.json({ activeId: getActiveAdapter()?.id ?? null, warning: await syncWarning() });
});

adaptersRouter.patch('/:id', async (req, res) => {
  const { scale } = req.body ?? {};
  if (typeof scale !== 'number' || Number.isNaN(scale)) {
    return res.status(400).json({ error: 'scale must be a number' });
  }
  try {
    const adapter = setAdapterScale(req.params.id, scale);
    res.json({ ...adapter, warning: await syncWarning() });
  } catch (e) {
    res.status(404).json({ error: message(e) });
  }
});

adaptersRouter.delete('/:id', async (req, res) => {
  deleteAdapter(req.params.id);
  res.json({ activeId: getActiveAdapter()?.id ?? null, warning: await syncWarning() });
});
