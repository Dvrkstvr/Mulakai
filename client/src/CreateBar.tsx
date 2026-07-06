import { useState } from 'react';

interface Props {
  onCreate: (draftPrompt: string) => void;
  /** True while a generation is already in progress anywhere — enforces one
   * generation at a time globally (see generationStore.ts / server genLock.ts). */
  busy?: boolean;
}

/** Slim capture row — hands off to the Create takeover screen rather than generating inline. */
export function CreateBar({ onCreate, busy }: Props) {
  const [draft, setDraft] = useState('');

  return (
    <div className="create-bar">
      <input
        placeholder={busy ? 'A song is generating — hang tight…' : 'What do you want to make?'}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="acid" disabled={busy} onClick={() => onCreate(draft)}>
        {busy ? 'GENERATING…' : 'CREATE'}
      </button>
    </div>
  );
}
