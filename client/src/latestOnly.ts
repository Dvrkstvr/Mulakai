/**
 * Coalesces a stream of values (a volume drag's ticks) to at most one `send` in
 * flight: values that arrive mid-send collapse to the latest, sent once the current
 * one lands. Sending every tick concurrently let the requests land out of order and
 * leave an earlier tick's value as the final one. The returned promise settles when
 * nothing is left to send.
 */
export function latestOnly<T>(send: (value: T) => Promise<unknown>): (value: T) => Promise<void> {
  let pending: { value: T } | null = null;
  let inFlight: Promise<void> | null = null;

  const drain = async () => {
    try {
      while (pending) {
        const { value } = pending;
        pending = null;
        await send(value);
      }
    } finally {
      inFlight = null;
    }
  };

  return (value) => {
    pending = { value };
    if (!inFlight) inFlight = drain();
    return inFlight;
  };
}
