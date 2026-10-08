# SP-7 · German lyrics model (follow-up to SP-5; R-027's open item 1)

Run 2026-10-08, RTX 4080 16 GB (16376 MiB; the owner's other stack held 2.9-3.1 GB of it throughout and was not touched), Windows 11, Ollama 0.32.15 on my own `127.0.0.1:11545` (`OLLAMA_CONTEXT_LENGTH=16384`, `OLLAMA_MODELS=E:\ai\ollama\models`; the owner's :11434 untouched). Models `gemma3:12b` and `mistral-small3.2:24b` pulled with the owner's approval; `qwen3:14b` and `gemma4:26b-a4b-it-q4_K_M` were installed. One model loaded at a time, unloaded after each arm; my Ollama is stopped. Evidence level: *seen running* for the numbers; the lyric quality verdict is **owed to the owner** (`read.html`); my own read below is labelled as such.

## Question

Does any local model other than `qwen3:14b`, used for SP-5's rung-3 lyrics step (the lyrics in their own call), write German lyrics the owner reads as usable first takes (SP-5: qwen3 German RC05-RC07 0/3, "unnatural wording, lines don't sing well")?

## Criterion

Owner's read of 6 German sets per arm (RC05-RC07 plus 3 new genres): an arm needs **>= 5 of 6 usable**. Secondary, by code: shape and language checks pass, seconds per call, VRAM residency, load time. Spanish (RC08-RC10) is optional, read by me.

## Verdict: `inconclusive` (the deciding read is the owner's; by my read no arm reaches 5 of 6, `gemma4` comes closest)

Every arm passes shape and language 9/9 (nothing separates the models by code), so the decision rests on the read. Open `read.html` (blind: X1..X4 shuffled per request, reveal button, summary to copy; the arm names are base64 in the page data).

## Setup (what ran)

- `run_arm.py <model> <tag>`: SP-5's rung-3 call verbatim (`lyrics_rules`, `lyrics_schema`, user message from `ladder.py`), strict JSON schema through `/v1/chat/completions`, temperature 0.3, `reasoning_effort: none`, `max_tokens` 4000, fixed seed 1, **one attempt per request**, nothing picked or fixed. (SP-5's loop allows 3 attempts with language feedback; none was needed in any arm, so first-attempt = final.)
- Inputs (`requests.json`, 9): RC05 slow pop about farewell, RC06 Schlager summer at the lake, RC07 something calm to fall asleep (all three with the recipe fields the planner wrote in SP-5's final run, `sp5_recipes.json`); **3 new German requests with recipe fields I wrote by hand in the planner's shape** (`make_requests.py`): DE08 indie-pop, autumn in the big city; DE09 Deutschrap, growing up in the neighbourhood; DE10 Liedermacher, Heimweh, guitar and voice; Spanish RC08 (ballad, sea), RC09 (reggaeton, summer night), RC10 (romantic, for my girlfriend).
- Checks (`checks.py`, `schemas.py` copied from SP-5): schema validation (4-8 lines per section, one entry per sung section), no bracket tags in lines, language-ID of the whole text (lingua) equal to the asked language. Extra (`extra.py`): lines containing a newline or under 6 characters.
- Results: `results/<arm>.json` (raw content, timings, `/api/ps`, VRAM).

## Per-arm numbers (9 requests each)

| arm | shape | language-ID | s per call (median / min-max) | tokens per call (median) | on disk / in memory at 16k | on GPU (`/api/ps`) | load (cold-ish, empty generate) | unload to empty `/api/ps` |
|---|---|---|---|---|---|---|---|---|
| qwen3:14b (control) | 9/9 | 9/9 | 7.2 / 4.9-9.3 | 444 | 9.3 GB / 11.7 GB | 100% | 2.6 s | 0.14 s |
| gemma4 26B-A4B (q4_K_M) | 9/9 | 9/9 | 8.9 / 6.6-15.0 | 286 | 17 GB / 18.2 GB | **73% (13.3 of 18.2 GB; rest on CPU)** | 19.3 s | 0.66 s |
| gemma3:12b | 9/9 | 9/9 | 7.3 / 3.9-10.7 | 478 | 8.1 GB / 8.1 GB | 100% | 3.5 s | 0.36 s |
| mistral-small3.2:24b | 9/9 | 9/9 | **37.5 / 25.8-50.3** | 449 | 15 GB / 17.5 GB | **79% (13.7 of 17.5 GB)** | 14.2 s | 0.47 s |

Stricter "clean lines" check: **gemma3 fails DE08** (15 lines with an embedded newline or a one-letter fragment: "Ein Echo von / Was war...", "Herbst in der Stadt, die Farben zie", "E"); the schema still accepts it. Other arms: 0 broken lines. Words per line, median/p90/max: qwen3 8/11/13, gemma4 6/8/10, gemma3 6/9/23, mistral 7/9/13.

VRAM at the end of an arm (nvidia-smi, whole GPU): qwen3 14.3 GB, gemma4 15.5 GB, gemma3 12.7 GB, mistral 15.2-15.4 GB, against a 2.9-3.1 GB baseline from the owner's stack. **Fits next to nothing else?** Only `qwen3:14b` (11.7 GB) and `gemma3:12b` (8.1 GB) are fully resident. `gemma4` (18.2 GB) and `mistral` (17.5 GB) exceed the 16.4 GB card at 16k context even with the GPU otherwise empty, so they always run split with the CPU; `gemma4` is a 4B-active MoE and stays fast (8.9 s), `mistral` is dense and drops to 37 s a call. Context shrinks it (the KV cache is a few GB at 16k; the lyrics call needs about 0.5k prompt tokens, so a smaller context for this call would help; **not tried**).

Hand-off (D-011, `llm.py` `release`): in SP-5 one model is both planner and lyrics writer, so rung 3 costs a second call but no reload. A different lyrics model is a second load inside the same queue slot: planner unload (0.14 s measured for qwen3) + lyrics-model load (3.5 s gemma3, 14-19 s gemma4/mistral) + the call + unload (0.4-0.7 s) + the planner's reload on the next turn (2.6 s). The load times above follow the model files being read from disk the first time in the run; whether they are warm-cache or cold I did not separate (unverified). gemma4 and mistral add 15-20 s to the first lyrics call after the planner, gemma3 about 3.5 s.

## The assistant's read (mine, fluent German and Spanish; NOT the owner's read)

"Usable" = I would press CREATE SONG on it and edit from there. Rhyme is judged where the genre wants it (pop, Schlager, rap). My marks are a prediction; the owner's blind read is what counts.

German:

| set | qwen3:14b | gemma4 26B-A4B | gemma3:12b | mistral-small3.2:24b |
|---|---|---|---|---|
| RC05 Abschied | no: lines 9-12 words, cliché stacking, a chorus that explains itself ("ein Moment, der ewig bleibt, doch nur für kurze Zeit"), no rhyme | **yes**: short singable lines, concrete images (key on the table, rain on the glass), no rhyme but even; one error ("gemeinsamen Jahren") | borderline: rhymes AABB, but "der so schwer wiegt", "trauriger Quell" read as filler | **yes**: the most idiomatic German of the four ("Es fällt mir schwer, dich gehen zu lassen"), unrhymed, a little long |
| RC06 Schlager | no: 13-word lines, no rhyme, "in uns allen" filler | **yes**: AABB rhyme, plain Schlager register, exactly what the genre wants | no: 8-line verses, "ganz sanft und schlecht", "Lächeln schenkt er, ganz ohne Frage" | no: run-on 8-line verses with no rhyme and a filler line repeated in each verse, chorus too short and bare for a Schlager |
| RC07 Schlaflied | no: "still und Nacht", "so mild" twice, no rhyme | **yes**: even, calm, repeated chorus fits; weak rhyme; "träum ganz ruhig" is slightly off | no: "Sanfte Schlaflied" (wrong gender, lifted from the title), forced "Preis" | borderline-yes: warm, rhyme pairs, two glitches ("Trägen", "mein Liebling, mein") |
| DE08 Indie-Pop | no: 10-word prose lines, "Herz ... hier" filler | **yes**: short lines, images fit the genre, near-rhymes | **no**: broken lines (see above) | borderline: natural, unrhymed, "auf das Pflasterstein" (gender), long last verse line |
| DE09 Deutschrap | no: prose, no rhyme or flow, repeats the chorus idea 4 times | borderline-no: real end rhymes and a rap flow, but "raub", "durchgehau't", "Natur", "ewigen Eis" are nonsense for the rhyme's sake | no: "Gefell", "falsches Stern", "ungestirbt" | no: an essay in lines, no rhyme, not rap |
| DE10 Liedermacher | no: four 15-word lines, no singability | no: "an einem fremden Tasse", "herumtölpeln", "ich hab mich ... selbst verrennt" | no: "die Tränen lacht", "müder Schach", "meine Sehnsucht, die ist ein Kuss" | **yes**: plain, natural, unrhymed, true to the singer-songwriter register |
| **my count of 6** | **0** | **4** (RC05, RC06, RC07, DE08), DE09 borderline | **0-1** | **3-4** (RC05, DE10 clear; RC07, DE08 borderline) |

What separates them: qwen3's lines are 8-13 words with no meter or rhyme (the owner's finding holds, my read agrees 0/6). gemma4 writes short, evenly sized lines and rhymes when the genre calls for it, with an occasional made-up word; it is the only arm whose pop and Schlager sets read like songs. gemma3 chases rhyme at the cost of meaning and breaks twice (DE08, and "Sanfte Schlaflied"). mistral writes the best individual German sentences but without rhyme or meter, so it reads like poems (unrhymed lyrics may or may not be fine for the owner; the SP-5 note "lines don't sing well" suggests rhythm matters). No arm reaches 5 of 6 by my read; **gemma4 is the one to put in front of the owner**.

Spanish (optional; my read, same blind order is in `read.html` section 2):

- qwen3:14b: fluent, generic, long lines (10-15 words) with little rhyme; RC08/RC10 usable, RC09 usable but the chorus is a mantra ("el reggaeton nos guía/llama"). 3/3 usable.
- gemma4: the most poetic and singable (RC08 "Eres mi mar de sueños / un horizonte sin final", RC10 with real rhyme); RC09 has a rhymed reggaeton hook but the outro contains the product name ("Mulakai en el control"), copied from the system prompt: a leak to guard against. 3/3 usable, one leak.
- gemma3: forced rhyme and filler ("ames" is not a word in RC08; 6-8 line sections), outro fragments. RC10 usable, RC08/RC09 borderline. About 1-2/3.
- mistral: natural, unrhymed; RC08 good, RC09 prose-like, RC10 chops sentences into 8 two-to-four-word lines and repeats the first four lines in the outro. 2/3.
- SP-5's earlier note that Spanish rung 3 beats the one-call lyrics is not re-tested here (no one-call arm was run).

## What the real build should copy

- If the owner's read confirms it: keep the planner `qwen3:14b` and add a **separate lyrics model for the lyrics step only for German** (and likely any non-English language), starting with `gemma4:26b-a4b-it-q4_K_M`; it is already installed, takes 8.9 s median a call with a split load, and the load cost is 19 s on first use in the slot (see hand-off). Not a drop-in: the lyrics-model load must sit inside the same queue slot after the planner's unload/empty-`/api/ps` (D-011).
- The lyrics call (system prompt, `{sections:[{lines}]}` schema, 4-8 lines, language-ID check) works unchanged on all four models; keep it.
- Add checks the schema does not give: no line with an embedded newline or fewer than 6 characters (gemma3 DE08), no occurrence of the product name or of words from the system prompt in lyrics ("Mulakai", gemma4 RC09 outro), lines over about 12 words (qwen3).
- For rap/Deutschrap and Liedermacher requests no arm was good; do not promise those genres in German from a local model.

## Surprises

- Quality did not track size: the 12B (gemma3) is the worst by code (broken lines) and the 24B dense (mistral) is 5x slower for sentences that are better but unrhymed; the 4B-active MoE is the best singer.
- Everything passes language and shape checks (36/36), including the broken gemma3 set: the by-code checks cannot see "unnatural German", which is why the read is the only gate.
- gemma4 leaked the project's own name from the system prompt into an outro (RC09).
- mistral and gemma4 cannot be fully resident on a 16 GB card at 16k context even alone.

## Caveats

- One run per request, one seed; German output varies run to run, so a single read of 6 sets per arm is a coarse bar (as the brief set it).
- DE08-DE10 recipe fields (title, style, tempo, structure) are my hand-written stand-ins for the planner's output.
- `read.html` shows no metrics (blind); the code checks are in `results/*.json`.
- My Ollama ran `reasoning_effort: none`; gemma4 and mistral may behave differently with thinking on (not tried; not wanted for latency).

## Reproduce

`powershell -File start_ollama.ps1` (:11545), `ollama pull gemma3:12b` and `mistral-small3.2:24b` with `OLLAMA_HOST=127.0.0.1:11545`, `pip install --target E:\ai\tmp\sp5\site jsonschema langdetect lingua-language-detector` (SP-5's site), `python make_requests.py`, then per arm `python run_arm.py qwen3:14b qwen3` (also `gemma4:26b-a4b-it-q4_K_M gemma4`, `gemma3:12b gemma3`, `mistral-small3.2:24b mistral`), `python extra.py`, `python make_read.py`; serve with `python -m http.server <port>` from this folder.
