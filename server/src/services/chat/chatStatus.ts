/**
 * GET /api/chat/status (D-099, F-043): `configured` = LLM_API_URL and YUE_API_URL are both set (the
 * client opens on CHAT only then; config, not reachability); `assistant` = the planner answers
 * (probePlanner), else `off` with the cause; `yue` = yue-server's /health/ready, which CREATE SONG needs.
 */
import { config } from '../../config.js';
import { health } from '../engineClient.js';
import { yue2Engine } from '../engines/yue2.js';
import { probePlanner } from '../score/ollamaControl.js';

export interface ChatStatus { configured: boolean; assistant: 'ok' | 'off'; cause: string | null; yue: 'ok' | 'off' }

export interface StatusDeps {
  llmUrl: string;
  yueUrl: string;
  probe: () => Promise<string | null>;
  yueReady: () => Promise<boolean>;
}

export function statusDeps(over: Partial<StatusDeps> = {}): StatusDeps {
  return {
    llmUrl: config.llmUrl, yueUrl: yue2Engine.url,
    probe: () => probePlanner({ url: config.llmUrl, model: config.llmModel }),
    yueReady: () => health(yue2Engine),
    ...over,
  };
}

export async function chatStatus(deps: StatusDeps = statusDeps()): Promise<ChatStatus> {
  const configured = Boolean(deps.llmUrl && deps.yueUrl);
  const yue = deps.yueUrl && (await deps.yueReady().catch(() => false)) ? 'ok' : 'off';
  if (!deps.llmUrl) return { configured, assistant: 'off', cause: 'the assistant is not set up: set LLM_API_URL on the server', yue };
  const cause = await deps.probe().catch((err: unknown) => (err instanceof Error ? err.message : String(err)));
  return { configured, assistant: cause ? 'off' : 'ok', cause: cause || null, yue };
}
