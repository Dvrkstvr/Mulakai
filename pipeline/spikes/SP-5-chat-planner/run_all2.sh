#!/bin/bash
# queue 2: prompt v3 (+ run-length bar map): the full set twice, the long-song probes
cd /e/repos/Mulakai/pipeline/spikes/SP-5-chat-planner
export PYTHONPATH=E:/ai/tmp/sp5/site PYTHONUTF8=1
python run.py --mode v3+rle --rep 1 > E:/ai/tmp/sp5/v3rle_r1.log 2>&1
python run.py --mode long+v3+rle --rep 1 --cases cases_long.json > E:/ai/tmp/sp5/long_v3rle.log 2>&1
python run.py --mode v3+rle --rep 2 > E:/ai/tmp/sp5/v3rle_r2.log 2>&1
echo QUEUE2 > E:/ai/tmp/sp5/run_all2.done
