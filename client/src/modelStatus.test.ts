import { describe, it, expect } from 'vitest';
import type { EngineInfo, SplitHealth } from './api';
import { statusRows, statusSummary, type StatusInput } from './modelStatus';

const engine = (id: EngineInfo['id'], over: Partial<EngineInfo> = {}): EngineInfo =>
  ({ id, label: id.toUpperCase(), capabilities: {} as EngineInfo['capabilities'], configured: true, ready: true, coverReady: true, ...over });

const split: SplitHealth = { acestep: true, acestepError: null, demucs: true, demucsReason: null, demucsBackend: 'uvr' };

const allUp: StatusInput = {
  acestep: 'online',
  engines: [engine('acestep'), engine('yue2'), engine('heartmula', { coverReady: false })],
  split,
  lyrics: { configured: true, ready: true },
};

const byId = (input: StatusInput) => Object.fromEntries(statusRows(input).map((r) => [r.id, r]));

describe('statusRows', () => {
  it('lists ACE-Step, each extra engine, the cover model, both split paths and the lyrics reader', () => {
    expect(statusRows(allUp).map((r) => [r.name, r.text])).toEqual([
      ['ACE-STEP 1.5', 'ONLINE'],
      ['YUE2', 'READY'],
      ['SHEETSAGE2', 'READY'],
      ['HEARTMULA', 'READY'],
      ['UVR', 'READY'],
      ['ACE-STEP EXTRACT', 'READY'],
      ['LYRICS READER', 'READY'],
    ]);
  });

  it('tells not configured apart from configured-but-unreachable', () => {
    const rows = byId({
      ...allUp,
      engines: [engine('yue2', { configured: false, ready: false }), engine('heartmula', { ready: false })],
      split: { ...split, demucs: false, demucsReason: 'unset', demucsBackend: null },
      lyrics: { configured: true, ready: false },
    });
    expect(rows.yue2).toMatchObject({ state: 'off', text: 'NOT CONFIGURED' });
    expect(rows.heartmula).toMatchObject({ state: 'down', text: 'UNREACHABLE' });
    expect(rows.demucs).toMatchObject({ name: 'DEMUCS / UVR', state: 'off' });
    expect(rows.lyrics).toMatchObject({ state: 'down', text: 'UNREACHABLE' });
  });

  it('skips the cover model while its engine is down, and the extract row when ACE-Step did not answer', () => {
    const rows = byId({
      ...allUp,
      engines: [engine('yue2', { ready: false, coverReady: false })],
      split: { ...split, acestep: false, acestepError: 'ACE-Step unreachable' },
    });
    expect(rows['yue2-cover']).toBeUndefined();
    expect(rows.extract).toBeUndefined();
  });

  it('shows checking rows before anything has answered', () => {
    const rows = statusRows({ acestep: null, engines: null, split: null, lyrics: null });
    expect(rows.every((r) => r.state === 'checking')).toBe(true);
  });
});

describe('statusSummary', () => {
  it('counts ready rows when nothing is down', () => {
    expect(statusSummary('online', statusRows(allUp))).toEqual({ text: '7 READY', tone: 'ok' });
  });

  it('puts an offline ACE-Step ahead of any count', () => {
    const input = { ...allUp, acestep: 'offline' as const, lyrics: { configured: true, ready: false } };
    expect(statusSummary('offline', statusRows(input))).toEqual({ text: 'ACE-STEP OFFLINE', tone: 'down' });
  });

  it('counts down services, ignoring ones that are only not set up', () => {
    const input = { ...allUp, engines: [engine('yue2', { configured: false, ready: false }), engine('heartmula', { ready: false })] };
    expect(statusSummary('online', statusRows(input))).toEqual({ text: '1 DOWN', tone: 'down' });
  });

  it('reads a busy ACE-Step as busy, not down', () => {
    expect(statusSummary('busy', statusRows({ ...allUp, acestep: 'busy' }))).toEqual({ text: 'ACE-STEP BUSY', tone: 'busy' });
  });
});
