/** The mark per thread (F-054, F-055; CS-8, CS-11): set / clear, carried onto a version that moved no bars, bars landing
 * on a seconds-only mark, stale (SEND held, never sent), USE BARS, a server MARK_STALE, re-mark from an echo. */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RangeMark } from './api/chatAnalysis';
import { markHoldsSend, markToSend, useChatMarkStore } from './chatMarkStore';
import { READING, v5, view } from './chatMarkFixture';

const CHORUS: RangeMark = { kind: 'range', versionId: 'v4', bars: [7, 10], seconds: [13, 21] };
const store = () => useChatMarkStore.getState();
const entry = () => store().byThread.t1;

beforeEach(() => useChatMarkStore.setState({ byThread: {} }));

describe('chatMarkStore', () => {
  it('set and clear, per thread; no mark sends nothing (the whole song)', () => {
    expect(markToSend('t1')).toBeNull();
    store().set('t1', CHORUS);
    expect(markToSend('t1')).toEqual(CHORUS);
    expect(markToSend('t2')).toBeNull();
    expect(markToSend('t1', READING.sections)).toEqual({ ...CHORUS, label: 'CHORUS 1' }); // the echo keeps the chip's label
    store().clear('t1');
    expect(entry()).toBeUndefined();
  });

  it('a new reading of the same version leaves a barred mark alone', () => {
    store().set('t1', CHORUS);
    const before = entry();
    store().reconcile('t1', view());
    expect(entry()).toBe(before);
  });

  it('carried onto v5 when its edit moved no bars', () => {
    store().set('t1', CHORUS);
    store().reconcile('t1', v5(false, null, { ...READING, mode: 'dim' }));
    expect(entry()).toEqual({ mark: { ...CHORUS, versionId: 'v5' }, stale: null });
  });

  it('a seconds-only mark snaps to bars when the reading lands', () => {
    store().set('t1', { kind: 'range', versionId: 'v4', seconds: [5.3, 12.6] });
    store().reconcile('t1', view());
    expect(entry().mark).toEqual({ kind: 'range', versionId: 'v4', bars: [3, 6], seconds: [5, 13] });
  });

  it('stale: SEND held and the mark never sent; USE BARS only once v5 has bars, then valid', () => {
    store().set('t1', CHORUS);
    const moved = v5(true, { atBar: 3, delta: 2 });
    store().reconcile('t1', moved);
    expect(entry().stale).toEqual({ useBars: [9, 12] });
    expect(markHoldsSend('t1')).toBe(true);
    expect(markToSend('t1')).toBeNull();
    expect(store().useBars('t1', moved)).toBe(false); // v5 not read yet: nothing changes
    expect(markHoldsSend('t1')).toBe(true);
    const read = v5(true, { atBar: 3, delta: 2 }, { ...READING, versionId: 'v5', number: 5 });
    store().reconcile('t1', read); // stays stale: never remapped by a reconcile
    expect(entry().stale).not.toBeNull();
    expect(store().useBars('t1', read)).toBe(true);
    expect(entry()).toEqual({ mark: { kind: 'range', versionId: 'v5', bars: [9, 12], seconds: [17, 25] }, stale: null });
    expect(markHoldsSend('t1')).toBe(false);
  });

  it('across a SET TEMPO before v5 is read: stale (tempo), never sent with the old seconds; USE BARS re-times them once read', () => {
    store().set('t1', CHORUS);
    const tempo = (shown: typeof READING | null) =>
      view({ versionId: 'v5', number: 5, shown, lineage: { fromVersionId: 'v4', moved: false, shift: null, retimed: true } });
    store().reconcile('t1', tempo(null));
    expect(entry().stale).toEqual({ useBars: [7, 10], tempo: true });
    expect(markToSend('t1')).toBeNull();
    const read = tempo({ ...READING, versionId: 'v5', number: 5, bars: { starts: READING.bars!.starts.map((s) => s * 0.8), end: 26.4 } });
    expect(store().useBars('t1', read)).toBe(true);
    expect(entry()).toEqual({ mark: { kind: 'range', versionId: 'v5', bars: [7, 10], seconds: [10.4, 16.8] }, stale: null });
  });

  it('stale with no shift: CLEAR MARK is the way out', () => {
    store().set('t1', CHORUS);
    store().reconcile('t1', v5(true));
    expect(entry().stale).toEqual({ useBars: null });
    store().clear('t1');
    expect(markHoldsSend('t1')).toBe(false);
  });

  it('the server answered MARK_STALE: stale, USE BARS from its shift', () => {
    store().set('t1', CHORUS);
    store().refused('t1', { atBar: 1, delta: 8 });
    expect(entry().stale).toEqual({ useBars: [15, 18] });
    store().refused('t2', null); // no mark there: nothing
    expect(store().byThread.t2).toBeUndefined();
  });

  it('a frozen echo re-marks while it fits, and not once stale', () => {
    expect(store().remark('t1', { ...CHORUS }, v5(false, null, { ...READING, mode: 'dim' }))).toBe(true);
    expect(entry().mark).toEqual({ ...CHORUS, versionId: 'v5' });
    store().clear('t1');
    expect(store().remark('t1', { ...CHORUS, label: 'CHORUS 1' } as RangeMark, v5(true))).toBe(false);
    expect(entry()).toBeUndefined();
    expect(store().remark('t1', { ...CHORUS, label: 'CHORUS 1' } as RangeMark, view())).toBe(true);
    expect(entry().mark).toEqual(CHORUS); // the echo's label is not part of the mark
  });
});
