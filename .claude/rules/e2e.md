---
paths:
  - "e2e/**"
  - "server/test-fakes/**"
---

# E2E and fakes

- `npm run test:e2e` starts its own stack on 127.0.0.1: fake ACE-Step
  8101, server 3101 with a throwaway `DATA_DIR`, Vite 5183. The `score`
  project (score.spec.ts) gets its own stack: fake Ollama 8102, fake
  yue-server 8103 (`e2e/fake-score/`), server 3102 with `LLM_API_URL`
  set and its own `DATA_DIR`, Vite 5184.
- Before a run, check the ports (`Get-NetTCPConnection -LocalPort <port>
  -State Listen`). A hard-killed run can orphan one ("port in use"): stop
  only a process you started; if another session holds the ports, skip e2e
  and say so.
- CI runs the golden path on Ubuntu for every PR into `main`
  (`.github/workflows/e2e.yml`); failed runs upload the report and traces.
- A CI job that times out inside `apt-get install ffmpeg` is the runner,
  not the tests: `gh run rerun <run id> --failed`. A job cancelled at
  15 min with no runner and no steps is GitHub (check githubstatus.com);
  start a fresh run instead of rerunning the stuck one.
- CI runs only on PRs into `main`: a stacked PR gets checks once it is
  retargeted to `main` and closed/reopened (a base change alone does not
  trigger a run).
- Fakes replay recorded replies (yue-server pytest writes the contract
  fixtures); never hand-edit a reply the real service would not send.
- The golden path keeps `LLM_API_URL` empty, so SCORE stays hidden.
- chat.spec.ts runs on the `score` stack, no new ports (D-178): the fake
  Ollama answers with SP-5's recorded replies (`fake-score/chatReplies.ts`)
  and the chat song is the contract song, so its score fixtures answer.
- C2 adds specs named `*.chat.spec.ts` (picked up by the same pattern, D-224);
  each keeps its own helpers, `chat.spec.ts` and `chatFakes.ts` stay C1's.
