import { useState } from 'react';

interface Props {
  onCreate: (draftPrompt: string) => void;
}

/** Slim capture row — hands off to the Create takeover screen rather than generating inline. */
export function CreateBar({ onCreate }: Props) {
  const [draft, setDraft] = useState('');

  return (
    <div className="create-bar">
      <input
        placeholder="What do you want to make?"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="acid" onClick={() => onCreate(draft)}>CREATE</button>
    </div>
  );
}
