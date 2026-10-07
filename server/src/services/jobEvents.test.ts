import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitJobSettled, onJobSettled, type JobSettled } from './jobEvents.js';

const event: JobSettled = { jobId: 'j1', kind: 'repaint', status: 'done', songId: 's1', label: 'repaint 0:10–0:20' };
const offs: Array<() => void> = [];
afterEach(() => { offs.splice(0).forEach((off) => off()); vi.restoreAllMocks(); });

describe('jobEvents', () => {
  it('tells every listener, in order, until it unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onJobSettled(a);
    offs.push(onJobSettled(b));
    emitJobSettled(event);
    offA();
    emitJobSettled({ ...event, jobId: 'j2' });
    expect(a.mock.calls).toEqual([[event]]);
    expect(b.mock.calls.map(([e]) => e.jobId)).toEqual(['j1', 'j2']);
  });

  it('a listener that throws is logged and never stops the others', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    offs.push(onJobSettled(() => { throw new Error('boom'); }), onJobSettled(after));
    expect(() => emitJobSettled(event)).not.toThrow();
    expect(after).toHaveBeenCalledWith(event);
    expect(log).toHaveBeenCalled();
  });
});
