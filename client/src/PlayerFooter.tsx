import { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Song } from './api';
import { FacetGlass } from './FacetGlass';
import { Player } from './Player';
import type { PlaybackApi } from './mix/playerApi';
import type { FooterMode } from './footerMode';
import type { FooterState } from './useFooterMode';

interface Props {
  playing: Song | null;
  engine: PlaybackApi;
  state: FooterState;
}

const POSE: Record<FooterMode, { y: string | number; opacity: number }> = {
  shown: { y: 0, opacity: 1 },
  dimmed: { y: '50%', opacity: 0.5 },
  hidden: { y: '100%', opacity: 1 },
};

/** The library's footer mini-player, overlaying the bottom of the app. It follows playback
 * (useFooterMode): up while playing, half down and dimmed for a minute after a stop, then slid
 * away; also away during a song generation and off the Library. Hiding never touches audio —
 * App's openSongId/view effect is what stops it. A 12px zone on the window's bottom edge
 * reveals it while the pointer rests there or on the footer. */
export function PlayerFooter({ playing, engine, state }: Props) {
  const reduceMotion = useReducedMotion();
  const { mode, canReveal, setEdge, setHover } = state;
  const footerRef = useRef<HTMLElement>(null);
  return (
    <>
      {canReveal && (
        <div className="footer-reveal" aria-hidden="true" onMouseEnter={() => setEdge(true)} onMouseLeave={() => setEdge(false)} />
      )}
      <AnimatePresence>
        {playing?.audio_file && (
          <motion.footer
            key="footer"
            ref={footerRef}
            initial={{ y: '100%' }}
            animate={POSE[mode]}
            exit={{ y: '100%' }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <FacetGlass target={footerRef} />
            <Player
              engine={engine}
              downloadSrc={`/audio/${playing.audio_file}`}
              title={playing.title}
              downloadName={`${playing.title}.wav`}
            />
          </motion.footer>
        )}
      </AnimatePresence>
    </>
  );
}
