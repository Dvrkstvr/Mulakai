/** Off the dev ports (8001/3001/5173), so an e2e run can sit beside a live dev stack. */
export const PORTS = { fake: 8101, server: 3101, client: 5183 } as const;
