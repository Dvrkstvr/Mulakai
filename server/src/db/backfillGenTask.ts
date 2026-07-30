import type { Database } from 'better-sqlite3';

/**
 * One-time backfill for `songs.gen_task` on DBs created before the column existed.
 * The task type was already being persisted inside the base layer's first version's
 * `params_json` (every generation path stamps `task_type` — see jobs.ts's
 * startGeneration, coverGenJobs.ts, completeGenJobs.ts), and repaintJobs.ts already
 * reads it back out of there, so no information is invented here — it's just lifted
 * onto the song where the Library can reach it without a join.
 *
 * Songs whose base version predates even that (or whose params_json has no
 * `task_type`) stay null and are treated as `text2music` by the client, matching how
 * they behaved before this column existed.
 */
export function backfillGenTask(db: Database): void {
  db.exec(`
    UPDATE songs SET gen_task = (
      SELECT json_extract(v.params_json, '$.task_type')
      FROM layers l JOIN versions v ON v.layer_id = l.id
      WHERE l.song_id = songs.id AND l.kind = 'base'
      ORDER BY v.created_at, v.rowid
      LIMIT 1
    )
    WHERE gen_task IS NULL
  `);
}
