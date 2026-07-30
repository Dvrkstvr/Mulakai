import { useState } from 'react';
import { useAdapterStore } from './adapterStore';

/**
 * Registers an adapter by the path it lives at *on the ACE-Step machine* — there is no upload
 * and no browse: ACE-Step exposes no endpoint listing adapters, and its host may not be this
 * one. The server validates by asking ACE-Step to load the path, so a typo or a directory that
 * isn't an adapter fails here with ACE-Step's own message instead of at generation time.
 */
export function AdapterAddForm() {
  const register = useAdapterStore((s) => s.register);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim() || !path.trim()) return setError('name and path are required');
    setError('');
    setBusy(true);
    try {
      await register(name.trim(), path.trim());
      setName('');
      setPath('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adapter-add">
      <div className="section-label">ADD ADAPTER</div>
      <input placeholder="Name (e.g. Acid House)" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="Path on the ACE-Step machine (LoRA folder, or LoKr .safetensors)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <span className="hint">
        Checked by loading it, so ACE-Step needs a model loaded — generate something first if this fails.
      </span>
      <button className="voice-manage-btn" disabled={busy} onClick={submit}>
        <span>{busy ? 'CHECKING…' : 'REGISTER'}</span>
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
