import { useEffect, useState } from 'react';
import { footerMode, type FooterMode } from './footerMode';
import { useGenerationStore } from './generationStore';
import { useMsSinceStopped } from './stoppedClock';

interface Options {
  /** The loaded song's id, or null when the footer holds nothing playable. */
  songKey: string | null;
  isPlaying: boolean;
  onLibrary: boolean;
}

export interface FooterState {
  /** What the footer shows right now, peeks included. */
  mode: FooterMode;
  /** Shown or dimmed without a peek: the Library pads its scroll area so the last row clears it. */
  docked: boolean;
  /** The bottom-edge reveal zone is live (Library, song loaded). */
  canReveal: boolean;
  setEdge: (on: boolean) => void;
  setHover: (on: boolean) => void;
}

/** Wires playback, song generation, the current view and the pointer into footerMode(). */
export function useFooterMode({ songKey, isPlaying, onLibrary }: Options): FooterState {
  const [edge, setEdge] = useState(false);
  const [hover, setHover] = useState(false);
  const generating = useGenerationStore((s) => s.jobs.some((j) => j.stage === 'loading' || j.stage === 'running'));
  const msSinceStopped = useMsSinceStopped(isPlaying, songKey);
  const hasSong = songKey !== null;
  const canReveal = hasSong && onLibrary;

  // The zone or footer can leave the page under the pointer (view switch, song cleared), and
  // then no mouseleave arrives: drop a stale peek so the footer doesn't pop up on return.
  useEffect(() => {
    if (!canReveal) {
      setEdge(false);
      setHover(false);
    }
  }, [canReveal]);

  const inputs = { hasSong, isPlaying, msSinceStopped, generating, onLibrary };
  return {
    mode: footerMode({ ...inputs, peeking: edge || hover }),
    docked: footerMode({ ...inputs, peeking: false }) !== 'hidden',
    canReveal,
    setEdge,
    setHover,
  };
}
