# 0007 · Threads, messages and the draft in SQLite; proposals in memory

Date: 2026-10-06 · Status: accepted (assumed by the architect, D-108) · Source: D-081, D-086, D-102, decisions/0004

## Context

A song's conversation must survive reloads and restarts and be deleted with the song (D-081, D-102); before the first
take the thread is a draft with no song. The sidebar's fields are one draft (D-086) that the person edits by hand while a
turn runs. Proposals (a recipe card, an edit plan) are reviewed for seconds to minutes.

## Decision

Two tables (`chat_threads`, `chat_messages`, `db/chatSchema.ts`, `CREATE TABLE IF NOT EXISTS`): a thread row per song
(`song_id` NULL for the one draft thread, `ON DELETE CASCADE` from songs) holding the draft as versioned JSON
(`draft_v`); messages with `seq`, kind, text, a versioned card snapshot (`chat_v`), the proposal id, the job id, the version
id (`ON DELETE SET NULL`) and a per-thread unique `client_key` for a double SEND. Live proposals stay in memory
(`chat/proposalStore.ts`; edit proposals are `planStore` plans), so after a restart their cards read EXPIRED.

## Alternatives

- **One JSON file per thread in `DATA_DIR`.** No cascade with the song, no idempotency constraint, hand-rolled locking.
- **Messages inside `versions.params_json`.** Draft threads have no version; most messages make none.
- **Persisted proposals.** A schema for a minutes-long review and a staleness check on restart, against decisions/0004's
  reasoning; a person asks again in one turn.
- **The draft in client storage.** It would not survive a second browser and could not be checked by the server's
  CREATE SONG rules.

## Consequences

- Trash keeps a thread; permanent delete removes it with the song.
- Shape changes of drafts or card bodies follow the `score_v` rule: bump, read both from the raw blob, a named test.
