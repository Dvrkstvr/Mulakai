### gemma4_26b: 116 plans (6 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T1_SET_TEMPO | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 1.6 | 2.3 |
| T2_TRANSPOSE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 0.5 | 0.7 |
| T3_REHARMONIZE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 1.9 | 3.0 |
| T4_REPEAT | 16 | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/0/0/0/0 | 0.5 | 0.6 |
| T5_REWRITE_LYRICS | 14 | 14/14 (100%) | 10/14 (71%) | 10/14 (71%) | 14/14 (100%) | 14/14 (100%) | 10/4/0/0/0 | 1.1 | 2.5 |
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 8/18 (44%) | 8/18 (44%) | 16/18 (89%) | 16/18 (89%) | 8/3/2/3/2 | 3.4 | 6.9 |
| T7_COMPOUND | 14 | 14/14 (100%) | 5/14 (36%) | 5/14 (36%) | 8/14 (57%) | 8/14 (57%) | 5/2/1/0/6 | 9.3 | 14.9 |
| DETERMINISTIC (T1,T2,T4,T5) | 66 | 66/66 (100%) | 62/66 (94%) | 62/66 (94%) | 66/66 (100%) | 66/66 (100%) | 62/4/0/0/0 | 0.7 | 2.4 |
| ALL | 116 | 116/116 (100%) | 93/116 (80%) | 93/116 (80%) | 108/116 (93%) | 108/116 (93%) | 93/9/3/3/8 | 1.6 | 12.1 |

First-attempt failure reasons (normalised):
- 7x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r
- 7x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r
- 4x T5 [apply] op N REWRITE_LYRICS: block N has N lines; you gave N. Keep the line count so the melody still fits
- 3x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 2x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re

prompt tokens (first attempt): min 2033, p50 2746, max 4178
jazzy (>=50% seventh/extended chords) among passing T3: 18/18
card memory in use at plan start (MiB): min 15795, max 15818

### qwen3_14b: 116 plans (6 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T1_SET_TEMPO | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 0.8 | 2.4 |
| T2_TRANSPOSE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 0.3 | 0.3 |
| T3_REHARMONIZE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 2.0 | 3.6 |
| T4_REPEAT | 16 | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/0/0/0/0 | 0.3 | 0.4 |
| T5_REWRITE_LYRICS | 14 | 14/14 (100%) | 12/14 (86%) | 9/14 (64%) | 12/14 (86%) | 9/14 (64%) | 12/0/0/0/2 | 1.6 | 4.2 |
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 2/18 (11%) | 2/18 (11%) | 8/18 (44%) | 8/18 (44%) | 2/1/3/2/10 | 4.6 | 6.4 |
| T7_COMPOUND | 14 | 14/14 (100%) | 3/14 (21%) | 3/14 (21%) | 5/14 (36%) | 5/14 (36%) | 3/1/1/0/9 | 14.0 | 21.6 |
| DETERMINISTIC (T1,T2,T4,T5) | 66 | 66/66 (100%) | 64/66 (97%) | 61/66 (92%) | 64/66 (97%) | 61/66 (92%) | 64/0/0/0/2 | 0.4 | 3.0 |
| ALL | 116 | 116/116 (100%) | 87/116 (75%) | 84/116 (72%) | 95/116 (82%) | 92/116 (79%) | 87/2/4/2/21 | 1.6 | 14.1 |

First-attempt failure reasons (normalised):
- 11x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 7x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 3x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r
- 2x T6 [apply] op N WRITE_PHRASE: bar N: the Vocal sings here; write the phrase over bars where the Vocal rests
- 2x T7 [apply] op N REHARMONIZE: bar N has two chords on the same beat
- 2x T5 [apply] op N REWRITE_LYRICS: block N has N lines; you gave N. Keep the line count so the melody still fits
- 1x T7 [sanity] all phrase bars are identical; write a phrase that develops (vary at least one bar)
- 1x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r

prompt tokens (first attempt): min 2012, p50 2743, max 4161
jazzy (>=50% seventh/extended chords) among passing T3: 18/18
card memory in use at plan start (MiB): min 1580, max 12975

### gemma4_26b_notes: 32 plans (4 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 12/18 (67%) | 12/18 (67%) | 17/18 (94%) | 17/18 (94%) | 12/4/1/0/1 | 3.2 | 6.9 |
| T7_COMPOUND | 14 | 14/14 (100%) | 6/14 (43%) | 6/14 (43%) | 14/14 (100%) | 14/14 (100%) | 6/6/2/0/0 | 6.6 | 11.0 |
| ALL | 32 | 32/32 (100%) | 18/32 (56%) | 18/32 (56%) | 31/32 (97%) | 31/32 (97%) | 18/10/3/0/1 | 3.6 | 11.2 |

First-attempt failure reasons (normalised):
- 8x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N beats but a bar here is N beats (too long by N)
- 6x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N beats but a bar here is N beats (too long by N)

prompt tokens (first attempt): min 1997, p50 2608, max 4138
card memory in use at plan start (MiB): min 15803, max 15810

### qwen3_14b_notes: 32 plans (4 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 12/18 (67%) | 12/18 (67%) | 18/18 (100%) | 18/18 (100%) | 12/4/1/1/0 | 3.7 | 10.5 |
| T7_COMPOUND | 14 | 14/14 (100%) | 6/14 (43%) | 6/14 (43%) | 12/14 (86%) | 12/14 (86%) | 6/6/0/0/2 | 9.3 | 20.5 |
| ALL | 32 | 32/32 (100%) | 18/32 (56%) | 18/32 (56%) | 30/32 (94%) | 30/32 (94%) | 18/10/1/1/2 | 5.3 | 15.9 |

First-attempt failure reasons (normalised):
- 4x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N beats but a bar here is N beats (too long by N)
- 4x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N beats but a bar here is N beats (too long by N)
- 2x T6 [apply] op N WRITE_PHRASE: bar N: the Vocal sings here; write the phrase over bars where the Vocal rests
- 2x T7 [apply] op N REHARMONIZE: bar N has two chords on the same beat
- 1x T7 [sanity] the phrase has only N notes; write a real melody (at least N notes)
- 1x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N beats but a bar here is N beats (too short by N)

prompt tokens (first attempt): min 1979, p50 2622, max 4124
card memory in use at plan start (MiB): min 12961, max 12961

### gemma4_26b_nopattern: 18 plans (0 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 5/18 (28%) | 5/18 (28%) | 9/18 (50%) | 9/18 (50%) | 5/0/2/2/9 | 6.1 | 8.7 |
| ALL | 18 | 18/18 (100%) | 5/18 (28%) | 5/18 (28%) | 9/18 (50%) | 9/18 (50%) | 5/0/2/2/9 | 6.1 | 8.7 |

First-attempt failure reasons (normalised):
- 6x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r
- 4x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 1x T6 [apply] op N WRITE_PHRASE: phrase bar N: unsupported token at '#NANcNAN'
- 1x T6 [apply] op N WRITE_PHRASE: phrase bar N: unsupported token at '#NANBNC#NDNENF#NG#N'
- 1x T6 [sanity] all phrase bars are identical; write a phrase that develops (vary at least one bar)

prompt tokens (first attempt): min 2036, p50 2750, max 4177
card memory in use at plan start (MiB): min 15676, max 15713

### qwen3_14b_nopattern: 18 plans (0 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 1/18 (6%) | 1/18 (6%) | 6/18 (33%) | 6/18 (33%) | 1/1/0/4/12 | 5.2 | 6.4 |
| ALL | 18 | 18/18 (100%) | 1/18 (6%) | 1/18 (6%) | 6/18 (33%) | 6/18 (33%) | 1/1/0/4/12 | 5.2 | 6.4 |

First-attempt failure reasons (normalised):
- 8x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 4x T6 [apply] op N WRITE_PHRASE: bar N: the Vocal sings here; write the phrase over bars where the Vocal rests
- 4x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too short by N); r
- 1x T6 [apply] op N WRITE_PHRASE: phrase bar N: unsupported token at '#NG#NANF#N'

prompt tokens (first attempt): min 2015, p50 2747, max 4160
card memory in use at plan start (MiB): min 12958, max 12963

### gemma4_26b_freechords: 18 plans (0 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T3_REHARMONIZE | 18 | 18/18 (100%) | 16/18 (89%) | 16/18 (89%) | 16/18 (89%) | 16/18 (89%) | 16/0/0/0/2 | 2.5 | 10.9 |
| ALL | 18 | 18/18 (100%) | 16/18 (89%) | 16/18 (89%) | 16/18 (89%) | 16/18 (89%) | 16/0/0/0/2 | 2.5 | 10.9 |

First-attempt failure reasons (normalised):
- 2x T3 [apply] op N REHARMONIZE: bar N has two chords on the same beat

prompt tokens (first attempt): min 2026, p50 2735, max 4162
jazzy (>=50% seventh/extended chords) among passing T3: 16/16
card memory in use at plan start (MiB): min 12960, max 15740

### qwen3_14b_freechords: 18 plans (0 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T3_REHARMONIZE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 2.0 | 5.6 |
| ALL | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 2.0 | 5.6 |

First-attempt failure reasons (normalised):

prompt tokens (first attempt): min 2007, p50 2732, max 4145
jazzy (>=50% seventh/extended chords) among passing T3: 18/18
card memory in use at plan start (MiB): min 1559, max 12976

### qwen3_14b_v1: 118 plans (6 infeasible cases skipped)
| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|---|
| T1_SET_TEMPO | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 0.6 | 1.0 |
| T2_TRANSPOSE | 18 | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/18 (100%) | 18/0/0/0/0 | 0.3 | 0.3 |
| T3_REHARMONIZE | 18 | 18/18 (100%) | 16/18 (89%) | 16/18 (89%) | 18/18 (100%) | 18/18 (100%) | 16/2/0/0/0 | 3.8 | 7.7 |
| T4_REPEAT | 16 | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/0/0/0/0 | 0.4 | 0.4 |
| T5_REWRITE_LYRICS | 16 | 16/16 (100%) | 12/16 (75%) | 5/16 (31%) | 16/16 (100%) | 7/16 (44%) | 12/2/2/0/0 | 1.5 | 2.3 |
| T6_WRITE_PHRASE | 18 | 18/18 (100%) | 0/18 (0%) | 0/18 (0%) | 3/18 (17%) | 3/18 (17%) | 0/2/1/0/15 | 5.6 | 8.8 |
| T7_COMPOUND | 14 | 14/14 (100%) | 0/14 (0%) | 0/14 (0%) | 0/14 (0%) | 0/14 (0%) | 0/0/0/0/14 | 24.6 | 30.6 |
| DETERMINISTIC (T1,T2,T4,T5) | 68 | 68/68 (100%) | 64/68 (94%) | 57/68 (84%) | 68/68 (100%) | 59/68 (87%) | 64/2/2/0/0 | 0.4 | 1.8 |
| ALL | 118 | 118/118 (100%) | 80/118 (68%) | 73/118 (62%) | 89/118 (75%) | 80/118 (68%) | 80/6/3/0/29 | 1.4 | 24.7 |

First-attempt failure reasons (normalised):
- 12x T6 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 11x T7 [apply] op N WRITE_PHRASE: phrase bar N (score bar N) adds up to N units but a bar here is N units (too long by N); re
- 4x T5 [apply] op N REWRITE_LYRICS: block N has N lines; you gave N. Keep the line count so the melody still fits
- 4x T6 [sanity] all phrase bars are identical; write a phrase that develops (vary at least one bar)
- 2x T6 [apply] op N WRITE_PHRASE: bar N: the Vocal sings here; write the phrase over bars where the Vocal rests
- 2x T3 [apply] op N REHARMONIZE: beat N is outside the bar
- 2x T7 [apply] op N REHARMONIZE: beat N is outside the bar
- 1x T7 [sanity] all phrase bars are identical; write a phrase that develops (vary at least one bar)

prompt tokens (first attempt): min 1912, p50 2585, max 4011
jazzy (>=50% seventh/extended chords) among passing T3: 18/18
card memory in use at plan start (MiB): min 14117, max 14157

