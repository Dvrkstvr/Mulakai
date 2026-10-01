import { motion, AnimatePresence } from 'framer-motion';
import type { Song } from './api';
import { Player } from './Player';
import type { PlaybackApi } from './mix/playerApi';

interface Props {
  playing: Song | null;
  engine: PlaybackApi;
  /** True while the editor or a takeover screen covers the library. */
  hidden: boolean;
}

/** The library's footer mini-player, docked to the bottom of the app; slides down (not unmount)
 * while the editor/create screen is open so it reappears stopped, not restarted, on return —
 * audio itself is actually stopped by App's openSongId effect. Slides up the first time a song
 * is selected to play. */
export function PlayerFooter({ playing, engine, hidden }: Props) {
  return (
    <AnimatePresence>
      {playing?.audio_file && (
        <motion.footer
          key="footer"
          initial={{ y: '100%' }}
          animate={{ y: hidden ? '100%' : 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Player
            engine={engine}
            downloadSrc={`/audio/${playing.audio_file}`}
            title={playing.title}
            downloadName={`${playing.title}.wav`}
          />
        </motion.footer>
      )}
    </AnimatePresence>
  );
}
