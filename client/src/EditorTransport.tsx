import { useEffect, useRef, useState } from 'react';
import { loopEntry, loopWrap } from './loopSelection';
import type { PlaybackApi } from './mix/playerApi';
import { Player } from './Player';
import type { Region } from './Waveform';

interface Props {
  engine: PlaybackApi;
  /** The Editor's selection: what LOOP SELECTION keeps playback inside. */
  selection: Region | null;
}

/** The Editor's transport: play/stop, time, master volume and LOOP SELECTION (PLAN.md "Editor Redesign", PR 2). The
 * loop needs a selection; clearing the selection turns it off. */
export function EditorTransport({ engine, selection }: Props) {
  const [loop, setLoop] = useState(false);
  const prev = useRef(engine.currentTime);
  const on = loop && !!selection;

  useEffect(() => { if (!selection) setLoop(false); }, [selection]);

  useEffect(() => {
    const t = engine.currentTime;
    const jump = on && engine.isPlaying ? loopWrap(prev.current, t, selection) : null;
    prev.current = t;
    if (jump !== null) {
      prev.current = jump;
      engine.seek(jump);
    }
  });

  const toggle = () => {
    const next = !loop;
    setLoop(next);
    const jump = next && engine.isPlaying ? loopEntry(engine.currentTime, selection) : null;
    if (jump !== null) engine.seek(jump);
  };

  return (
    <Player engine={engine} downloadSrc="" compact extra={(
      <button type="button" className={`loop-toggle${on ? ' on' : ''}`} aria-pressed={on} disabled={!selection}
        title={selection ? 'Keep playback inside the selection' : 'Select a part of the song to loop it'} onClick={toggle}>
        <span>LOOP SELECTION</span>
      </button>
    )} />
  );
}
