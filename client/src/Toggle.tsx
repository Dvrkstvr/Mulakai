import { ShaderCanvas } from './ShaderCanvas';
import { InfoTooltip } from './InfoTooltip';

export function Toggle({ label, checked, onChange, ai, disabled, info }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; ai?: boolean; disabled?: boolean;
  /** Explains what the toggle does — rendered as a hover/focus "?" next to the label. */
  info?: string;
}) {
  const cls = ['toggle', checked && 'on', checked && ai && 'toggle-ai', disabled && 'setting-disabled'].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} onClick={() => onChange(!checked)}>
      {checked && ai && (
        <div className="toggle-shader">
          <ShaderCanvas />
          <div className="toggle-shader-mask" />
        </div>
      )}
      <span>
        {label}
        {info && <span onClick={(e) => e.stopPropagation()}><InfoTooltip text={info} /></span>}
      </span>
      <span className="dot" />
    </button>
  );
}

/** Small pill mirroring Toggle's AI-state border ring, so a field visibly carries the
 * same AI ENHANCE treatment whether it's a toggle or a plain field — small elements get
 * a shader border, not a full fill (docs/design/DESIGN.md#Motion). */
export function AiEnhanceBadge() {
  return (
    <span className="ai-badge">
      <span className="ai-badge-shader">
        <ShaderCanvas />
        <span className="ai-badge-mask" />
      </span>
      <span className="ai-badge-label">AI ENHANCE</span>
    </span>
  );
}
