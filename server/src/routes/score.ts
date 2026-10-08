/**
 * SCORE's state for the dock (F-018, F-021, F-024): GET /api/songs/:id/score.
 *   hidden      no tab (not a YuE2 first take, or LLM_API_URL / YUE_API_URL unset)
 *   ineligible  one reason line (D-006, D-021, D-049)
 *   offline     `offline: 'checker'` (yue-server could not read the score) or `'planner'` (the
 *               Ollama probe failed: down, model not pulled, not Ollama); RECHECK asks again
 *   eligible    the reading (bars, seconds, tempo, key, tokens), the active base version's
 *               number and its stored style, for the dock's reading and consequence lines; and the
 *               score's `sections` and lyric `blocks` as yue-server read them (facts.sections /
 *               facts.lyric_blocks, the numbering planReferent checks a pick against), for the
 *               dock's pick (F-032). Absent when yue-server returned no facts. And `retime`: whether RE-TIME
 *               is offered (RT-4, D-240): `offered` with the reading's tempo, `refused` with why, or `none`.
 * The planner is probed only for an eligible song, so a hidden song costs no Ollama call.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { probePlanner } from '../services/score/ollamaControl.js';
import { scoreStatus, type ScoreStatus } from '../services/score/scoreStatus.js';
import { retimeOffer, type RetimeOffer } from '../services/score/retimeOffer.js';

export interface ScoreRouteDeps {
  status: (songId: string) => Promise<ScoreStatus>;
  probe: () => Promise<string | null>;
  retime: (songId: string) => Promise<RetimeOffer>;
}

const defaults = (): ScoreRouteDeps => ({
  status: (songId) => scoreStatus(songId),
  probe: () => probePlanner({ url: config.llmUrl, model: config.llmModel }),
  retime: (songId) => retimeOffer(songId),
});

/** The offer without the kept id: the dock only needs whether, why not, and the tempo read. */
const retimeView = (o: RetimeOffer) => (o.state === 'offered' ? { state: o.state, readBpm: o.readBpm } : o);

type Facts = NonNullable<NonNullable<ScoreStatus['read']>['facts']>;

/** The read's sections, each with its occurrence among sections of the same label (planReferent's
 * `occurrence`), and its lyric blocks as read; yue-server's per-section facts carry no seconds. */
function pickable(f: Facts | null | undefined) {
  if (!f) return {};
  const sections = f.sections.map((x, i) => ({
    index: x.index, label: x.label, occurrence: f.sections.slice(0, i + 1).filter((y) => y.label === x.label).length,
    from_bar: x.from_bar, to_bar: x.to_bar,
  }));
  const blocks = f.lyric_blocks.map((b) => ({ index: b.index, tag: b.tag, occurrence: b.occurrence, lines: b.lines, first_line: b.first_line }));
  return { sections, blocks };
}

/** What the dock reads about an eligible song's score. */
function reading(s: ScoreStatus) {
  const h = s.read?.facts?.header;
  const source = s.source;
  const versions = source?.baseVersions ?? [];
  const index = versions.findIndex((v) => v.id === source?.activeVersionId);
  return {
    reading: h ? { bars: h.bars, seconds: s.read?.seconds ?? h.seconds, bpm: h.bpm, key: h.key, meter: h.meter, tokens: s.read?.tokens ?? null } : null,
    baseVersion: index === -1 ? null : index + 1,
    versions: versions.length,
    style: source?.style ?? null,
    ...pickable(s.read?.facts),
  };
}

export function makeScoreRouter(deps: () => ScoreRouteDeps = defaults): Router {
  const router = Router();

  router.get('/:id/score', async (req, res) => {
    const d = deps();
    try {
      const status = await d.status(req.params.id);
      const e = status.eligibility;
      if (e.state === 'hidden') return res.json({ state: 'hidden' });
      if (e.state === 'ineligible') return res.json({ state: 'ineligible', reason: e.reason });
      if (e.state === 'offline') return res.json({ state: 'offline', offline: 'checker', reason: e.reason });
      const problem = await d.probe();
      if (problem) return res.json({ state: 'offline', offline: 'planner', reason: problem, ...reading(status) });
      const retime = retimeView(await d.retime(req.params.id).catch(() => ({ state: 'none' as const })));
      res.json({ state: 'eligible', ...reading(status), retime });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export const scoreRouter = makeScoreRouter();
