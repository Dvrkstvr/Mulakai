import os from 'node:os';
import path from 'node:path';

/** Parent of every run's throwaway DATA_DIR; global-setup.ts sweeps stale children out of it. */
export const DATA_ROOT = path.join(os.tmpdir(), 'mulakai-e2e');
