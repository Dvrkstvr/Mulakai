/** The reading line on its own 16 px row under the waveform (F-052, F-053; chat-mark.html MK-2, Q-114 option B):
 * neutral text, rust only on failure with RETRY as the outline button; no spinner, no acid while it reads (the job is
 * not a commit). A transcribed score adds `TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY`. Text from `chatAnalysis`. */
import type { ReadingLine } from './chatAnalysis';

interface Props {
  line: ReadingLine | null;
  onRetry: () => void;
}

export function ChatReadingLine({ line, onRetry }: Props) {
  if (!line) return <div className="chat-rl" aria-hidden="true" />;
  return (
    <div className={`chat-rl ${line.tone}`} role="status" aria-label="Reading">
      <span className="chat-rl-text" title={line.text}>{line.text}</span>
      {line.transcribed && <span className="chat-rl-tr">{line.transcribed}</span>}
      {line.retry && <button type="button" className="chat-ao chat-rl-retry" onClick={onRetry}><span>RETRY</span></button>}
    </div>
  );
}
