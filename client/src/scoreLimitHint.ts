/** The duration hint in a CHECK FAILED (F-030 #2, mockup frame 11, M2-9, Q-048): the server's limit
 * line ("estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least
 * 68 BPM fits", server scoreLimits.ts) read back into a title, a body and the words FILL types.
 * FILL only types into the request field; nothing is sent. Pure. Part of the SCORE copy (dock rule). */

export interface LimitHint { title: string; body: string; fill: string }

const LIMIT = /estimated ([\d,]+) s: over the ([\d,]+) s limit(?:; (.+))?$/;
const CUT = /^cut the (.+?) \d+:\d{2} to fit \(section \d+\)$/;
const num = (text: string) => Number(text.replace(/,/g, ''));

/** Null for any other reason, and for a limit line that names no section, which stay plain lines. */
export function limitHint(reason: string): LimitHint | null {
  const m = LIMIT.exec(reason);
  if (!m) return null;
  const over = num(m[1]) - num(m[2]);
  const fits = m[3] ? m[3].split(', or ') : [];
  const cut = fits.map((f) => CUT.exec(f)).find(Boolean);
  if (!cut) return null;
  return {
    title: `OVER THE ${m[2]} s LIMIT${over > 0 ? ` BY ${over} s` : ''}`,
    body: [`est ${m[1]} s`, ...fits.map((f, i) => (i > 0 ? `or ${f}` : f))].join(' · '),
    fill: `cut the ${cut[1]}`,
  };
}

export const fillLabel = (words: string) => `FILL “${words}”`;

/** The request after FILL: the hint's words added to what is there, once (never sent). */
export function fillRequest(request: string, fill: string): string {
  const kept = request.trim().replace(/[\s,;.]+$/, '');
  if (!kept) return fill;
  if (kept.toLowerCase().includes(fill.toLowerCase())) return request;
  return `${kept}, ${fill}`;
}
