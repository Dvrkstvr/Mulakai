/** The "why" half of a failed action's rust `.error` line. */
export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Runs one user action for a component's `.error` line (DESIGN.md: errors say what
 * happened, in rust): clears the last error, then on a throw shows "label — why".
 * Never rejects, so an onClick can fire it with `void`; resolves to whether the
 * action landed.
 */
export async function attempt(
  label: string,
  action: () => Promise<unknown>,
  setError: (message: string) => void,
): Promise<boolean> {
  setError('');
  try {
    await action();
    return true;
  } catch (err) {
    setError(`${label} — ${errorText(err)}`);
    return false;
  }
}
