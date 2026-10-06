#!/bin/bash
# queue 3: the ladder rungs on the final prompt (v3 + run-length bar map), one rep each: rung 2 (state-allowed actions), rung 1 (router + per-action call)
cd /e/repos/Mulakai/pipeline/spikes/SP-5-chat-planner
export PYTHONPATH=E:/ai/tmp/sp5/site PYTHONUTF8=1
python run.py --mode v3+rle+allowed --rep 1 > E:/ai/tmp/sp5/v3allowed_r1.log 2>&1
python run.py --mode v3+rle+router --rep 1 > E:/ai/tmp/sp5/v3router_r1.log 2>&1
echo QUEUE3 > E:/ai/tmp/sp5/run_all3.done
