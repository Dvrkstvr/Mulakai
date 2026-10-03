---
paths:
  - "e2e/**"
  - "server/test-fakes/**"
---

# E2E and fakes

- `npm run test:e2e` starts its own stack on 127.0.0.1: fake ACE-Step
  8101, server 3101 with a throwaway `DATA_DIR`, Vite 5183 (M1 adds fake
  Ollama and fake yue beside them, e.g. 8102 / 8103).
- Before a run, check the ports (`Get-NetTCPConnection -LocalPort <port>
  -State Listen`). A hard-killed run can orphan one ("port in use"): stop
  only a process you started; if another session holds the ports, skip e2e
  and say so.
- CI runs the golden path on Ubuntu for every PR into `main`
  (`.github/workflows/e2e.yml`); failed runs upload the report and traces.
- Fakes replay recorded replies (yue-server pytest writes the contract
  fixtures); never hand-edit a reply the real service would not send.
- The golden path keeps `LLM_API_URL` empty, so SCORE stays hidden.
