/** The rust-body clause an ACE-Step edit's consequence line ends with while SCORE is open
 * (F-027, D-030; text from scoreEnds.ts). Renders nothing when the line has none. */
export function ScoreEndsClause({ clause }: { clause: string | null | undefined }) {
  if (!clause) return null;
  return <> · <span className="score-ends">{clause}</span></>;
}
