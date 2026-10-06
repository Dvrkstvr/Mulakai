#!/bin/bash
cd "$(dirname "$0")"
for pair in "qwen3:14b qwen3_14b" "gemma4:26b-a4b-it-q4_K_M gemma4_26b"; do
  set -- $pair
  python run.py "$1" "${2}_freechords" --reps 2 --templates T3 --free-chords > "results/${2}_freechords.log" 2>&1
done
curl -s localhost:11435/api/generate -d '{"model":"gemma4:26b-a4b-it-q4_K_M","keep_alive":0}' > /dev/null
curl -s localhost:11435/api/generate -d '{"model":"qwen3:14b","keep_alive":0}' > /dev/null
echo done2
