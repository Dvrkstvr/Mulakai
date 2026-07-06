import { useEffect, useState } from 'react';
import { PlayerWaveform } from './PlayerWaveform';
import { VolumeSlider } from './VolumeSlider';
import type { PlaybackApi } from './mix/playerApi';
import { useSettings } from './settings';

interface Props {
  engine: PlaybackApi;
  /** Focused layer's individual audio file — download always targets this stem, never the mixed engine output. */
  downloadSrc: string;
  title?: string;
  downloadName?: string;
  showProgress?: boolean;
  /** Play/pause + stop only — no time, volume, or download. Used in the Editor, where the stack-scrub
      timeline already owns time/seeking and stems are downloaded from the Export rail instead. */
  minimal?: boolean;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Custom transport per docs/design/DESIGN.md — hexagon play, square stop, sky scrub, neutral volume/download. Driven by a shared PlaybackEngine, not a native <audio> element. */
export function Player({ engine, downloadSrc, title, downloadName, showProgress = true, minimal = false }: Props) {
  const defaultVolume = useSettings((s) => s.exportSettings.volume);
  const [volume, setVolume] = useState(defaultVolume);
  const { isPlaying, currentTime, duration } = engine;

  // Applies Settings > Playback & Export's default volume once this player's engine is
  // ready — a fresh <audio>/PlaybackEngine otherwise starts at its own 1.0 default.
  useEffect(() => {
    engine.setVolume(defaultVolume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = () => (isPlaying ? engine.pause() : engine.play());

  return (
    <div className="player">
      <button className="player-btn play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? (
          <svg viewBox="0 0 10 10"><rect x="1" width="3" height="10" /><rect x="6" width="3" height="10" /></svg>
        ) : (
          <svg viewBox="0 0 10 10"><polygon points="1,0 9,5 1,10" /></svg>
        )}
      </button>
      <button className="player-btn stop" onClick={engine.stop} aria-label="Stop to start">
        <svg viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" /></svg>
      </button>
      {!minimal && title && <span className="player-title">{title}</span>}
      {!minimal && <span className="player-time">{fmt(currentTime)} / {fmt(duration)}</span>}
      {!minimal && showProgress && (
        <div className="player-waveform-wrap">
          <PlayerWaveform audioUrl={downloadSrc} duration={duration} playhead={currentTime} onSeek={engine.seek} height={36} />
        </div>
      )}
      {!minimal && (
        <div className="player-volume">
          <svg className="vol-icon" viewBox="0 0 16 16" fill="none">
            <path d="M1 6h3l4-3v10l-4-3H1z" />
            <path d="M11 5.5c1 1 1 4 0 5M13 4c2 2 2 6 0 8" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          <VolumeSlider
            value={volume}
            onChange={(v) => {
              setVolume(v);
              engine.setVolume(v);
            }}
          />
        </div>
      )}
      {!minimal && (
        <a className="player-btn download" href={downloadSrc} download={downloadName} aria-label="Download">
          <svg viewBox="0 0 10 10"><path d="M5 1v6M2 4l3 3 3-3" /><path d="M1.5 9h7" /></svg>
          <span>DOWNLOAD</span>
        </a>
      )}
    </div>
  );
}
