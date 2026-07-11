import { AIGeneratingBackground } from './AIGeneratingBackground';

interface Props {
  disabled: boolean;
  analyzing: boolean;
  onClick: () => void;
}

/** Manual trigger for `useAnalyzeSourceAudio`'s `analyze()` — loads the selected model
 * then runs ACE-Step's `/v1/analyze_audio`. Renders the same AI-shader veil the main
 * GENERATE button uses while running, so a cold model load reads as "working" rather
 * than a hung click. Shared by CreateAudioTab.tsx and CreateArrangeTab.tsx. */
export function AnalyzeAudioButton({ disabled, analyzing, onClick }: Props) {
  return (
    <button className={analyzing ? 'analyze-btn analyzing' : 'analyze-btn'} disabled={disabled} onClick={onClick}>
      {analyzing && <AIGeneratingBackground />}
      <span style={{ position: 'relative', zIndex: 1 }}>{analyzing ? 'ANALYZING…' : 'ANALYZE AUDIO'}</span>
    </button>
  );
}
