/**
 * Discovers the vocabulary of `[...]` annotation tags ACE-Step's LM actually produces in
 * lyrics (structure tags like `[Verse 2]`, performance tags like `[soft voice]`) by probing
 * it with varied prompts and mining the results. There's no fixed tag schema anywhere —
 * the LM is free to emit any bracket text — so this builds the vocabulary empirically and
 * persists it additively: re-running only grows counts / adds newly-seen tags, never wipes
 * what a prior run found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createSampleFromQuery, createRandomSample, health } from './acestep.js';
import { SEED_QUERIES } from './lyricTagSeedQueries.js';

export interface LyricTagRecord {
  tag: string;
  kind: 'section' | 'inline';
  count: number;
  sectionCount: number;
  inlineCount: number;
}

export interface ProbeState {
  running: boolean;
  completed: number;
  lastRunAt: string | null;
  lastError: string | null;
}

const STORE_PATH = path.join(config.dataDir, 'lyricTags.json');
const BRACKET_RE = /\[([^[\]\n]{1,60})\]/g;

/** Every 4th sample pulls a bundled example instead of an LM generation, to keep
 * surfacing tags from ACE-Step's own example set alongside the seed-query sweep. */
const RANDOM_SAMPLE_STRIDE = 4;
/** Auto-stops an indefinite run if ACE-Step goes down mid-run, instead of hammering
 * it with failing requests forever until someone notices and clicks stop. */
const MAX_CONSECUTIVE_FAILURES = 10;

const state: ProbeState & { stopRequested: boolean } = {
  running: false,
  completed: 0,
  lastRunAt: null,
  lastError: null,
  stopRequested: false,
};

export function getProbeState(): ProbeState {
  const { stopRequested: _stopRequested, ...publicState } = state;
  return publicState;
}

/** Takes effect after the in-flight LM call returns (no cancellation wired into the
 * ACE-Step client), typically within one sample's generation time. */
export function stopProbe(): void {
  state.stopRequested = true;
}

export function getStoredTags(): LyricTagRecord[] {
  return loadStore().sort((a, b) => b.count - a.count);
}

function loadStore(): LyricTagRecord[] {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as LyricTagRecord[];
  } catch {
    return [];
  }
}

function saveStore(records: LyricTagRecord[]): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), 'utf8');
}

interface FreshTagEntry {
  display: string;
  count: number;
  sectionCount: number;
  inlineCount: number;
}

function extractTags(lyrics: string, tagCounts: Map<string, FreshTagEntry>): void {
  for (const line of lyrics.split('\n')) {
    const matches = [...line.matchAll(BRACKET_RE)];
    if (!matches.length) continue;
    const strippedLine = line.replace(BRACKET_RE, '').trim();
    const kind: 'section' | 'inline' = strippedLine === '' ? 'section' : 'inline';
    for (const m of matches) {
      const raw = m[1].trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const entry = tagCounts.get(key) ?? { display: raw, count: 0, sectionCount: 0, inlineCount: 0 };
      entry.count++;
      if (kind === 'section') entry.sectionCount++;
      else entry.inlineCount++;
      tagCounts.set(key, entry);
    }
  }
}

/** Additive merge: existing counts only grow, new tags are added, nothing is ever removed. */
function mergeTags(existing: LyricTagRecord[], fresh: Map<string, FreshTagEntry>): LyricTagRecord[] {
  const byKey = new Map(existing.map((r) => [r.tag.toLowerCase(), { ...r }]));
  for (const [key, entry] of fresh) {
    const prev = byKey.get(key);
    if (prev) {
      prev.count += entry.count;
      prev.sectionCount += entry.sectionCount;
      prev.inlineCount += entry.inlineCount;
      prev.kind = prev.sectionCount >= prev.inlineCount ? 'section' : 'inline';
    } else {
      byKey.set(key, {
        tag: entry.display,
        kind: entry.sectionCount >= entry.inlineCount ? 'section' : 'inline',
        count: entry.count,
        sectionCount: entry.sectionCount,
        inlineCount: entry.inlineCount,
      });
    }
  }
  return [...byKey.values()];
}

/** One sample's worth of tags, merged and persisted immediately — an indefinite run must
 * not lose progress to a later crash/restart/stop by batching writes until the end. */
function recordSample(lyrics: string): void {
  const fresh = new Map<string, FreshTagEntry>();
  extractTags(lyrics, fresh);
  if (fresh.size === 0) return;
  saveStore(mergeTags(loadStore(), fresh));
}

/** Runs until `stopProbe()` is called (or ACE-Step fails repeatedly in a row). Cycles through
 * the seed queries indefinitely, varying temperature each pass, interleaving bundled examples
 * every `RANDOM_SAMPLE_STRIDE`th sample. */
async function probeLoop(onProgress?: (msg: string) => void): Promise<void> {
  const temperatures = [0.7, 0.85, 1.0];
  let i = 0;
  let consecutiveFailures = 0;
  while (!state.stopRequested) {
    const useRandomSample = i % RANDOM_SAMPLE_STRIDE === RANDOM_SAMPLE_STRIDE - 1;
    try {
      const lyrics = useRandomSample
        ? (await createRandomSample('custom_mode')).lyrics ?? ''
        : (
            await createSampleFromQuery({
              query: SEED_QUERIES[i % SEED_QUERIES.length],
              temperature: temperatures[i % temperatures.length],
            })
          ).lyrics ?? '';
      recordSample(lyrics);
      consecutiveFailures = 0;
      onProgress?.(`[${i + 1}] ok  ${useRandomSample ? 'random sample' : `"${SEED_QUERIES[i % SEED_QUERIES.length]}"`}`);
    } catch (err) {
      consecutiveFailures++;
      onProgress?.(`[${i + 1}] fail: ${(err as Error).message}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`Stopped after ${consecutiveFailures} consecutive failures: ${(err as Error).message}`);
      }
    }
    i++;
    state.completed = i;
  }
}

/** Throws if a probe is already running. Runs indefinitely until `stopProbe()` is called;
 * each sample is merged and persisted as it completes, so stopping (or a crash) never loses
 * progress. */
export async function runProbe(onProgress?: (msg: string) => void): Promise<void> {
  if (state.running) throw new Error('Probe already running');

  state.running = true;
  state.stopRequested = false;
  state.completed = 0;
  state.lastError = null;

  try {
    if (!(await health())) throw new Error('ACE-Step server unreachable');
    await probeLoop(onProgress);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : 'Probe failed';
  } finally {
    state.running = false;
    state.lastRunAt = new Date().toISOString();
  }
}
