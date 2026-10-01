/**
 * Typed client for the ACE-Step 1.5 native FastAPI server (docs/en/API.md).
 *
 * Facade — every `./acestep.js` import (and every vi.mock of it) resolves here,
 * unchanged from when this was a single file. The client is split by
 * responsibility to stay inside AGENTS.md's module-size cap:
 *   acestep/types.ts      wire types (release_task params, results, prompt tooling)
 *   acestep/http.ts       authenticated fetch + {data,code,error} envelope (internal)
 *   acestep/prompting.ts  format_input, random/query samples, analyze_audio
 *   acestep/tasks.ts      release_task, query_result, lyric_timestamp, audio download
 *   acestep/models.ts     model init + generation counter, inventory, health
 *   acestep/lora.ts       LoRA/LoKr adapter lifecycle
 * Slices call their siblings directly, so a vi.mock of this module intercepts
 * external callers only — just as intra-file calls were never intercepted before.
 */
export * from './acestep/types.js';
export * from './acestep/prompting.js';
export * from './acestep/tasks.js';
export * from './acestep/models.js';
export * from './acestep/lora.js';
