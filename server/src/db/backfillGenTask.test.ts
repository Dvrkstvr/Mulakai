import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { backfillGenTask } from './backfillGenTask.js';

/** What an existing install looks like the moment db/index.ts's ensureColumn has added the
 * column: schema in place, every pre-existing row's `gen_task` still null. */
function oldDb() {
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  return db;
}

function seedSong(db: Database.Database, id: string, params: object | null, opts: { kind?: string } = {}) {
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(id, `song ${id}`);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', ?)`).run(`l-${id}`, id, opts.kind ?? 'base');
  if (params) {
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json) VALUES (?, ?, 'a.wav', ?)`)
      .run(`v-${id}`, `l-${id}`, JSON.stringify(params));
  }
}

const taskOf = (db: Database.Database, id: string) =>
  (db.prepare(`SELECT gen_task FROM songs WHERE id = ?`).get(id) as { gen_task: string | null }).gen_task;

describe('backfillGenTask', () => {
  it('lifts task_type off the base layer version params every generation path already stamps', () => {
    const db = oldDb();
    seedSong(db, 'a', { prompt: 'x', task_type: 'text2music' });
    seedSong(db, 'b', { prompt: 'x', task_type: 'cover' });
    seedSong(db, 'c', { prompt: 'x', task_type: 'complete' });

    backfillGenTask(db);

    expect(taskOf(db, 'a')).toBe('text2music');
    expect(taskOf(db, 'b')).toBe('cover');
    expect(taskOf(db, 'c')).toBe('complete');
  });

  it('leaves songs whose params recorded no task null, for the client to treat as text2music', () => {
    const db = oldDb();
    seedSong(db, 'a', { prompt: 'x' });
    seedSong(db, 'b', null); // no version at all

    backfillGenTask(db);

    expect(taskOf(db, 'a')).toBeNull();
    expect(taskOf(db, 'b')).toBeNull();
  });

  it('reads the base layer, not an added instrument layer', () => {
    const db = oldDb();
    seedSong(db, 'a', { task_type: 'cover' });
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES ('l-extra', 'a', 'Guitar', 'instrument', 1)`).run();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json) VALUES ('v-extra', 'l-extra', 'b.wav', ?)`)
      .run(JSON.stringify({ task_type: 'lego' }));

    backfillGenTask(db);

    expect(taskOf(db, 'a')).toBe('cover');
  });

  it('does not overwrite a task already recorded by persistSong', () => {
    const db = oldDb();
    seedSong(db, 'a', { task_type: 'text2music' });
    db.prepare(`UPDATE songs SET gen_task = 'cover' WHERE id = 'a'`).run();

    backfillGenTask(db);

    expect(taskOf(db, 'a')).toBe('cover');
  });

  it('is idempotent — a second run changes nothing', () => {
    const db = oldDb();
    seedSong(db, 'a', { task_type: 'complete' });

    backfillGenTask(db);
    backfillGenTask(db);

    expect(taskOf(db, 'a')).toBe('complete');
  });
});
