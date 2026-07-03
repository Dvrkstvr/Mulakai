/**
 * Small "?" affordance with a hover/focus popup — CSS-only (:hover/:focus-within),
 * no JS state, keyboard-reachable via tab focus. Mirrors the progressive-disclosure
 * pattern already used for Editor's "+ ADD LAYER" row (docs/design/DESIGN.md).
 */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-tooltip" tabIndex={0}>
      <span className="info-tooltip-mark">?</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  );
}
