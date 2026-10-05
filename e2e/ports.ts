/** Off the dev ports (8001/3001/5173), so an e2e run can sit beside a live dev stack. */
export const PORTS = { fake: 8101, server: 3101, client: 5183 } as const;

/**
 * The SCORE spec's own stack (F-028): fake Ollama and fake yue-server, and a second server + Vite
 * that have LLM_API_URL / YUE_API_URL set, so the golden path's server keeps them empty. Off the dev
 * ports too (Ollama 11434/11435, yue-server 8004).
 */
export const SCORE_PORTS = { ollama: 8102, yue: 8103, server: 3102, client: 5184 } as const;
