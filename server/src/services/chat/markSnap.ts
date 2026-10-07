/**
 * A seconds-only mark snapped to bars (D-194, Q-119): when the playable version's bar times are read, a mark made
 * by time (a hatched strip, or a drag the client did not snap) gets the bars it covers at SEND, so the plan is
 * bounded like any bar mark. A bar is in the mark when the mark covers at least half of it; a mark shorter than
 * half of every bar it touches takes the bar holding its middle. Bar i spans starts[i-1] .. starts[i] (the last
 * one .. end). Null when nothing can be snapped (no bars, or the mark lies past the end). Pure.
 */
export interface BarTimesNow { starts: number[]; end: number }

const HALF = 0.5;

export function snapToBars([a, b]: [number, number], { starts, end }: BarTimesNow): [number, number] | null {
  if (!starts.length || a >= end) return null;
  const span = (i: number): [number, number] => [starts[i], i + 1 < starts.length ? starts[i + 1] : end];
  const covered: number[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const [s, e] = span(i);
    const overlap = Math.min(b, e) - Math.max(a, s);
    if (e > s && overlap >= HALF * (e - s)) covered.push(i + 1);
  }
  if (covered.length) return [covered[0], covered[covered.length - 1]];
  const mid = (a + b) / 2;
  const at = starts.findIndex((s, i) => mid >= s && mid < span(i)[1]);
  return at < 0 ? null : [at + 1, at + 1];
}

/** The mark with the bars it covers; unchanged when it carries bars already or none can be snapped. The client's
 * label (the times) is dropped with the snap, so the echo names the bars it was sent with. */
export function snapMark<M extends { bars?: [number, number]; seconds: [number, number]; label?: string }>(mark: M, times: BarTimesNow | null): M {
  if (mark.bars || !times) return mark;
  const bars = snapToBars(mark.seconds, times);
  if (!bars) return mark;
  const { label: _label, ...rest } = mark;
  return { ...rest, bars } as M;
}
