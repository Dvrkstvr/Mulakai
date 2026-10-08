# LD re-check 2 (F-095), origin/main 1db5520 (incl. #260 D-255). Server :3302, proxy :11438, raw/S_*.json (batch.py, 10 chats)
INCONCLUSIVE for the keep bar: 7 of 10 first sends FAILED (job failed: "planner model gemma4 is still loaded after 10 s"; gemma4 writes took 150-320 s,
GPU 99 % with gemma4 still resident after my keep_alive 0 unload -> looks like another client on the shared Ollama). A follow-up after a failed first send has no draft,
so c3/c5/c8 follow-ups wrote (no valid keep test); c1/c2/c4 follow-ups failed the same way.
Valid follow-ups (first send recipe OK):
| chat | follow-up | card | planner calls | loop retry | gemma4 | lyrics same | bpm | secs |
| c6 Heimweh | mach es etwas schneller | recipe | 3 | yes (2nd call refused, 3rd keeps) | no | yes | 68->80 | 15.7 |
| c7 Bahnhof | etwas schneller bitte, Text unveraendert | recipe | 3 | yes, then keep | no | yes | 60->70 | 19.7 |
| c10 EN | make it faster | recipe | 2 (no loop) | - | no | yes | 120->140 | 10.1 |
| c9 Bahnhof | schreib den Refrain neu | recipe | 4 qwen3 + 2 gemma4 | yes, then write | yes | no (written) | 60->60 | 86.1 |
Loop retries seen: 3 (c6, c7, c9), all resolved in the same turn. "no song to change yet": 0. Loop-prone requests (c1 Rock, c2/c4 Bahnhof, c3) not testable: first sends failed.
/api/ps empty after every turn that completed OK; failed turns left gemma4 loaded; empty at end. Own PIDs stopped (server 43684, proxy 49016, batch finished).
