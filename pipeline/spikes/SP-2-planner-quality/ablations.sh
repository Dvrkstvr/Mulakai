#!/bin/bash
# ablations: (1) chord symbols as free strings (no enum) on T3; (2) WRITE_PHRASE abc without the grammar pattern on T6
cd "$(dirname "$0")"
for pair in "qwen3:14b qwen3_14b" "gemma4:26b-a4b-it-q4_K_M gemma4_26b"; do
  set -- $pair
  python run.py "$1" "${2}_freechords" --reps 2 --templates T3 --free-chords > "results/${2}_freechords.log" 2>&1
  python run.py "$1" "${2}_nopattern" --reps 2 --templates T6 --no-pattern > "results/${2}_nopattern.log" 2>&1
done
curl -s localhost:11435/api/generate -d '{"model":"gemma4:26b-a4b-it-q4_K_M","keep_alive":0}' > /dev/null
curl -s localhost:11435/api/generate -d '{"model":"qwen3:14b","keep_alive":0}' > /dev/null
echo ablations done
