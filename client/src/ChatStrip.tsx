/** The player's section strip, bar ruler and waveform (F-053; chat-mark.html MK-1, MK-3): the strip's sections are the
 * score's (`StripSection[]`), placed on the waveform's time axis when the reading has bar times, else weighted by bars.
 * Live: names, clickable. Dim (an older reading whose edit moved no bars): the same at 50 %. Hatched (bars moved, the
 * reading failed, or no bar times): no names, the ruler counts seconds, marking works by time. None: nothing read yet.
 * `overlay` is the mark layer's slot (CL-8b), drawn over the ruler and waveform; `marked` (the mark's bars) fills the
 * sections it covers in sky, whole, or sky-tint, in part (MK-4). Modes come from `chatAnalysis`. */
import type { CSSProperties, ReactNode } from 'react';
import type { AnalysisView, ShownBars, StripSection } from './api/chatAnalysis';
import type { StripMode } from './chatAnalysis';
import { usableBars } from './chatMark';
import { clock, sectionName } from './chatMarkLabel';
import { PlayerWaveform } from './PlayerWaveform';
import './chatStrip.css';

interface Props {
  view: AnalysisView | null;
  mode: StripMode;
  /** What plays: the waveform is drawn from it. */
  audioUrl: string;
  /** The playing audio's length in seconds (0 until it loads): the x axis of the strip, ruler and waveform. */
  duration: number;
  playhead: number;
  onSeek: (seconds: number) => void;
  /** Click a section (live or dim strip only); without it the names are not buttons. */
  onSection?: (s: StripSection) => void;
  overlay?: ReactNode;
  marked?: [number, number] | null;
}

/** A bar number every this many bars on the ruler (1, 9, 17, …). */
const LABEL_EVERY = 8;
const pct = (t: number, d: number) => `${Math.min(100, Math.max(0, (t / d) * 100))}%`;

/** Placed on the time axis (`left`/`width`, 3 px gap), or a flex weight by bars when there are no times. */
function place(s: StripSection, duration: number): CSSProperties {
  if (!s.seconds || duration <= 0) return { flex: s.bars[1] - s.bars[0] + 1 };
  const [a, b] = s.seconds;
  return { left: pct(a, duration), width: `calc(${pct(b - a, duration)} - 3px)` };
}

/** `on`: the mark covers the whole section; `pt`: a part of it. */
function cover(s: StripSection, m: [number, number] | null | undefined): string {
  if (!m || s.bars[1] < m[0] || s.bars[0] > m[1]) return '';
  return s.bars[0] >= m[0] && s.bars[1] <= m[1] ? ' on' : ' pt';
}

function Sections({ view, mode, duration, onSection, marked }: Pick<Props, 'view' | 'mode' | 'duration' | 'onSection' | 'marked'>) {
  const all = view?.shown?.sections ?? [];
  const named = mode === 'live' || mode === 'dim';
  if (!named || all.length === 0) {
    const cells = mode === 'hatched' && all.length > 0 ? all : [null];
    return (
      <div className="chat-sg" aria-hidden="true">
        {cells.map((s, i) => <i key={i} className={`chat-sg-cell${mode === 'hatched' ? ' hc' : ''}`} style={s ? place(s, 0) : { flex: 1 }} />)}
      </div>
    );
  }
  const positioned = duration > 0 && all.every((s) => s.seconds);
  return (
    <div className={`chat-sg${positioned ? ' pos' : ''}`} role="group" aria-label="Sections">
      {all.map((s) => {
        const name = sectionName(s, all);
        const title = `${name} · bars ${s.bars[0]}–${s.bars[1]}${s.seconds ? ` · ${clock(s.seconds[0])}–${clock(s.seconds[1])}` : ''}`;
        const style = place(s, positioned ? duration : 0);
        return onSection ? (
          <button key={s.index} type="button" className={`chat-sg-cell${cover(s, marked)}`} style={style} title={title} onClick={() => onSection(s)}>{name}</button>
        ) : (
          <i key={s.index} className={`chat-sg-cell${cover(s, marked)}`} style={style} title={title}>{name}</i>
        );
      })}
    </div>
  );
}

/** Bar ticks with a number every 8 bars; without bar times, seconds (a label every 30 s, a tick every 10 s). */
function Ruler({ bars, duration }: { bars: ShownBars | null; duration: number }) {
  if (duration <= 0) return <div className="chat-rr" aria-hidden="true" />;
  if (bars) {
    return (
      <div className="chat-rr" aria-label="Bar ruler">
        {bars.starts.map((t, i) => (i % LABEL_EVERY === 0
          ? <span key={i} style={{ left: pct(t, duration) }}>{i + 1}</span>
          : <i key={i} style={{ left: pct(t, duration) }} />))}
      </div>
    );
  }
  const ticks = Array.from({ length: Math.floor(duration / 10) + 1 }, (_, i) => i * 10);
  return (
    <div className="chat-rr secs" aria-label="Time ruler">
      {ticks.map((t) => (t % 30 === 0 ? <span key={t} style={{ left: pct(t, duration) }}>{clock(t)}</span> : <i key={t} style={{ left: pct(t, duration) }} />))}
    </div>
  );
}

export function ChatStrip({ view, mode, audioUrl, duration, playhead, onSeek, onSection, overlay, marked }: Props) {
  const bars = mode === 'live' || mode === 'dim' ? usableBars(view) : null;
  return (
    <div className={`chat-strip ${mode}`} data-mode={mode}>
      <Sections view={view} mode={mode} duration={duration} onSection={onSection} marked={marked} />
      <div className="chat-stk">
        <Ruler bars={bars} duration={duration} />
        <PlayerWaveform audioUrl={audioUrl} duration={duration} playhead={playhead} onSeek={onSeek} height={36} showPlayhead={false} />
        {duration > 0 && <div className="chat-ph" style={{ left: pct(playhead, duration) }} />}
        {overlay}
      </div>
    </div>
  );
}
