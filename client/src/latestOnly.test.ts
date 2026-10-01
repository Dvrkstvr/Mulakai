import { describe, it, expect } from 'vitest';
import { latestOnly } from './latestOnly';

/** A send whose calls each wait for the test to resolve or reject them. */
function controlledSend() {
  const calls: { value: number; resolve: () => void; reject: (e: Error) => void }[] = [];
  const send = (value: number) => new Promise<void>((resolve, reject) => { calls.push({ value, resolve, reject }); });
  return { calls, send };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('latestOnly', () => {
  it('keeps one send in flight and sends only the latest value queued behind it', async () => {
    const { calls, send } = controlledSend();
    const push = latestOnly(send);
    const done = push(0.1);
    void push(0.2);
    void push(0.3);
    expect(calls.map((c) => c.value)).toEqual([0.1]);
    calls[0].resolve();
    await flush();
    expect(calls.map((c) => c.value)).toEqual([0.1, 0.3]);
    calls[1].resolve();
    await expect(done).resolves.toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it('starts a fresh send once the previous drain has finished', async () => {
    const { calls, send } = controlledSend();
    const push = latestOnly(send);
    const first = push(0.5);
    calls[0].resolve();
    await first;
    void push(0.6);
    expect(calls.map((c) => c.value)).toEqual([0.5, 0.6]);
  });

  it('recovers after a send rejects', async () => {
    const { calls, send } = controlledSend();
    const push = latestOnly(send);
    const first = push(0.5);
    calls[0].reject(new Error('down'));
    await expect(first).rejects.toThrow('down');
    void push(0.7);
    expect(calls.map((c) => c.value)).toEqual([0.5, 0.7]);
  });
});
