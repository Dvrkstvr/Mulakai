#!/bin/bash
# the full set of runs, in order (each ~12 min on the 4080): v2 rep 1 and 2, v2+was rep 1, the long-song probes
cd /e/repos/Mulakai/pipeline/spikes/SP-5-chat-planner
export PYTHONPATH=E:/ai/tmp/sp5/site PYTHONUTF8=1
python run.py --mode v2 --rep 1 > E:/ai/tmp/sp5/v2_r1.log 2>&1
python run.py --mode v2 --rep 2 > E:/ai/tmp/sp5/v2_r2.log 2>&1
python run.py --mode v2+was --rep 1 > E:/ai/tmp/sp5/v2was_r1.log 2>&1
python run.py --mode long --rep 1 --cases cases_long.json > E:/ai/tmp/sp5/long_r1.log 2>&1
echo ALLDONE > E:/ai/tmp/sp5/run_all.done
