
**Candidate A (A3: 1-beat equal-power crossfade, groove-snapped cuts, level-matched span) on local edits**

| edit | song | span metric: result vs full re-render | rest of song (melody F1, result vs control) | seam 1 | seam 2 | base audio changed |
|---|---|---|---|---|---|---|
| reharm | A Purple Shinings | 1.000 vs 1.000 (+0.0 pt) | 0.964 vs 0.938 | raw -4 ms / ok / LUFS +5.8 (ex +0.4) | raw +1 ms / ok / LUFS +1.1 (ex +0.6) | 0.69 s |
| reharm | B Romantica | 0.375 vs 0.375 (+0.0 pt) | 0.992 vs 0.942 | raw -5 ms / ok / LUFS +4.1 (ex +0.1) | raw +12 ms / unres. / LUFS -2.4 (ex +0.4) | 0.64 s |
| reharm | C Gertar | 1.000 vs 1.000 (+0.0 pt) | 0.995 vs 0.977 | raw +7 ms / unres. / LUFS +1.2 (ex -0.0) | raw -10 ms / ok / LUFS +1.9 (ex -0.1) | 0.70 s |
| reharm | D Carinito | 0.875 vs 0.875 (+0.0 pt) | 0.986 vs 0.953 | raw -2 ms / unres. / LUFS +3.7 (ex -0.1) | raw -9 ms / unres. / LUFS -2.6 (ex +0.2) | 0.63 s |
| phrase | A Purple Shinings | 0.878 vs 0.927 (-4.9 pt) | 0.966 vs 0.924 | raw -8 ms / ok / LUFS +1.0 (ex +0.4) | raw +5 ms / ok / LUFS +1.8 (ex +1.3) | 0.69 s |
| phrase | B Romantica | 0.889 vs 0.800 (+8.9 pt) | 0.994 vs 0.960 | raw -39 ms / unres. / LUFS -0.8 (ex +0.1) | raw +58 ms / unres. / LUFS +0.4 (ex -0.0) | 0.64 s |
| phrase | C Gertar | 0.952 vs 0.811 (+14.2 pt) | 0.998 vs 0.986 | raw -9 ms / unres. / LUFS +2.3 (ex +0.3) | raw -9 ms / unres. / LUFS +3.4 (ex +0.1) | 0.70 s |
| phrase | D Carinito | 0.556 vs 0.500 (+5.6 pt) | 0.991 vs 0.933 | raw +2 ms / unres. / LUFS -0.2 (ex -0.2) | raw -7 ms / unres. / LUFS -2.9 (ex -0.3) | 0.63 s |
| lyrics | A Purple Shinings | 0.950 vs 0.950 (+0.0 pt) | 0.975 vs 0.958 | raw +4 ms / ok / LUFS +5.3 (ex -0.1) | raw +18 ms / unres. / LUFS -1.4 (ex -0.1) | 0.69 s |
| lyrics | B Romantica | 0.132 vs 0.105 (+2.6 pt) | 0.993 vs 0.961 | raw -8 ms / ok / LUFS +3.8 (ex -0.2) | raw +12 ms / unres. / LUFS -3.0 (ex -0.1) | 0.64 s |
| lyrics | C Gertar | 0.750 vs 0.750 (+0.0 pt) | 0.997 vs 0.981 | raw +2 ms / unres. / LUFS +0.9 (ex -0.2) | raw -10 ms / unres. / LUFS +1.7 (ex -0.3) | 0.70 s |
| lyrics | D Carinito | 0.211 vs 0.158 (+5.3 pt) | 0.988 vs 0.956 | raw -3 ms / unres. / LUFS +3.8 (ex -0.1) | raw -9 ms / unres. / LUFS -2.6 (ex +0.2) | 0.63 s |

**Candidate C (audio-only REPEAT / CUT, 1-beat crossfade, groove-snapped cut) on structural edits**

| edit | song | span metric: result vs full re-render | rest of song (melody F1, result vs control) | seam 1 | seam 2 | base audio changed |
|---|---|---|---|---|---|---|
| repeat | A Purple Shinings | 0.929 vs 0.966 (-3.7 pt) | 0.967 vs 0.926 | raw -10 ms / ok / LUFS +8.5 (ex --) | (none) | 0.69 s |
| repeat | B Romantica | 0.992 vs 1.000 (-0.8 pt) | 0.988 vs 0.960 | raw -50 ms / ok / LUFS -0.1 (ex --) | (none) | 0.64 s |
| repeat | C Gertar | 0.958 vs 0.950 (+0.8 pt) | 0.992 vs 0.981 | raw +0 ms / unres. / LUFS +3.5 (ex --) | (none) | 0.70 s |
| repeat | D Carinito | 0.991 vs 0.992 (-0.0 pt) | 0.985 vs 0.943 | raw -8 ms / ok / LUFS -0.3 (ex --) | (none) | 0.63 s |
| cut | A Purple Shinings | 1.000 vs 1.000 (+0.0 pt) | 0.800 vs 0.701 | raw -3 ms / ok / LUFS +0.8 (ex --) | (none) | 0.69 s |
| cut | B Romantica | 1.000 vs 1.000 (+0.0 pt) | 0.983 vs 0.966 | raw -64 ms / ok / LUFS -1.9 (ex --) | (none) | 0.64 s |
| cut | C Gertar | 1.000 vs 1.000 (+0.0 pt) | 0.994 vs 0.960 | raw +3 ms / unres. / LUFS +3.4 (ex --) | (none) | 0.70 s |
| cut | D Carinito | 1.000 vs 1.000 (+0.0 pt) | 0.995 vs 0.954 | raw +2 ms / ok / LUFS -1.1 (ex --) | (none) | 0.63 s |

**Candidate B (A3 or C1 + ACE-Step repaint of a 3 s window on each real seam), balanced vs conservative, against the unhealed splice**

| edit | song | span metric: A3/C1 | bal | con | window loudness change in dB per window (bal , con) | worst seam LUFS step beyond the base (structure: raw step): A3/C1 -> bal -> con |
|---|---|---|---|---|---|---|
| reharm | A Purple Shinings | 1.000 | 0.875 | 0.875 | +0.2/-7.8 , -1.1/-8.0 | 0.6 -> 3.1 -> 2.9 |
| reharm | B Romantica | 0.375 | 0.125 | 0.125 | -2.2/-1.9 , -3.0/-2.3 | 0.4 -> 0.1 -> 0.2 |
| reharm | C Gertar | 1.000 | 0.875 | 0.875 | -2.7/-1.0 , -2.7/-1.2 | 0.1 -> 3.1 -> 3.2 |
| reharm | D Carinito | 0.875 | 0.875 | 0.875 | -3.1/-0.2 , -3.2/-0.3 | 0.2 -> 4.6 -> 4.7 |
| phrase | A Purple Shinings | 0.878 | 0.850 | 0.850 | -2.2/-13.4 , -2.8/-14.7 | 1.3 -> 1.6 -> 1.6 |
| phrase | B Romantica | 0.889 | 0.769 | 0.750 | -1.9/-0.7 , -2.0/-0.8 | 0.1 -> 3.2 -> 3.3 |
| phrase | C Gertar | 0.952 | 0.718 | 0.718 | -1.9/-1.2 , -1.4/-1.1 | 0.3 -> 0.8 -> 0.9 |
| phrase | D Carinito | 0.556 | 0.645 | 0.645 | -2.9/-2.2 , -2.9/-3.4 | 0.3 -> 0.4 -> 0.1 |
| lyrics | A Purple Shinings | 0.950 | 1.000 | 1.000 | -0.9/-4.5 , -2.4/-6.6 | 0.1 -> 2.7 -> 2.8 |
| lyrics | B Romantica | 0.132 | 0.316 | 0.211 | -1.6/-0.4 , -1.7/-0.5 | 0.2 -> 1.5 -> 1.6 |
| lyrics | C Gertar | 0.750 | 0.958 | 0.833 | -2.5/-1.6 , -2.5/-2.0 | 0.3 -> 1.2 -> 1.2 |
| lyrics | D Carinito | 0.211 | 0.158 | 0.211 | -3.6/-0.6 , -3.9/-0.6 | 0.2 -> 5.8 -> 7.2 |
| repeat | A Purple Shinings | 0.929 | 0.534 | 0.523 | -4.3 , -5.6 | 8.5 -> 7.9 -> 8.0 |
| repeat | B Romantica | 0.992 | 0.992 | 0.992 | -1.7 , -1.5 | 0.1 -> 0.1 -> 0.0 |
| repeat | C Gertar | 0.958 | 0.920 | 0.920 | -2.8 , -3.1 | 3.5 -> 2.9 -> 2.9 |
| repeat | D Carinito | 0.991 | 0.934 | 0.934 | -0.9 , -0.7 | 0.3 -> 0.4 -> 0.4 |
| cut | A Purple Shinings | 1.000 | 1.000 | 1.000 | -1.5 , -2.1 | 0.8 -> 1.3 -> 1.6 |
| cut | B Romantica | 1.000 | 1.000 | 1.000 | -0.8 , -0.8 | 1.9 -> 1.9 -> 2.1 |
| cut | C Gertar | 1.000 | 1.000 | 1.000 | -1.7 , -2.0 | 3.4 -> 2.3 -> 2.1 |
| cut | D Carinito | 1.000 | 1.000 | 1.000 | -0.4 , -0.3 | 1.1 -> 1.3 -> 1.3 |
