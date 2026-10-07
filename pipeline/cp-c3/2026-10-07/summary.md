# CP-C3, reference songs (2026-10-07)

Server http://127.0.0.1:3401. Planner via the proxy to http://127.0.0.1:11434. GPU at start 14425 MiB. Run 4 (fix/chat-c3-routing 52c4161, --merge, no --retry): the 10 wording legs after reference_use moved first, the REFERENCE rule's cover = ONLY THIS SAME song / Unsure: borrow, and an unread attachment allowing only ask/analyze/say. Run 3 (424d6c7, rule without the ONLY wording) read 4 of 10 right. ACESTEP_API_URL pointed at a dead port (the owner's :8001 untouched), so the upload's CAPTION is not read.

## Stop lines

- PASS slowest reading of a file of 4 min or less: 20.6 s (stop over 240 s)
- PASS follow-up turn p50 11.8 s; planner not fully on the GPU in 0 of 9 seen (stop over 15 s or any)
- PASS score read ok on 3 of 3 audio files (stop under 2)
- PASS reference_use right on 9 of 10 (stop under 8 of 10)
- PASS worst hand-off 0.2 s: unload-to-empty 0.2 s, READ-to-reading 0.0 s, reading-to-follow-up 0.0 s, CREATE-to-take 0.0 s (stop over 5 s)

## Readings

| ref | source | file s | plan | READ->run s | reading s | WORDS s | SCORE s | CAPTION s | words | score | caption | coverable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yue2-cover-en | yue2 | 161 | own/own/own | 0.0 | 0.2 | - | 0.1 | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| ace1-cover-de | acestep | 200 | own/service/own | 0.0 | 18.6 | - | 18.5 | - | en, 24 lines | transcribed, 72 bars, 6 sections, 86 bpm Fm 4/4, chords true, 0 warnings, 945/4096 tok | 87 bpm, F minor, 4: A moody, atmospheric dream-pop trip-hop track built on a fou | yes |
| ace2-borrow-en | acestep | 240 | own/service/own | 0.0 | 20.6 | - | 20.5 | - | ?, 22 lines | transcribed, 92 bars, 8 sections, 91 bpm D#m 4/4, chords true, 0 warnings, 1600/4096 tok | 92 bpm, Eb major, 4: A sophisticated lounge jazz arrangement opens with a crisp,  | yes |
| upload-borrow-es | upload | 140 | service/service/skip | 0.0 | 19.6 | 7.2 | 12.3 | - | en, 21 lines | transcribed, 44 bars, 6 sections, 75 bpm Fm 4/4, chords true, 0 warnings, 727/4096 tok | not read: ACE-Step is not running | yes |
| yue2-cover-es | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-borrow-de | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-borrow-en | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-borrow-es | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-cover-de | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |

## Turns and reference_use

| ref | lang | expect | first reply | ask reply | ask s | follow-up | ->run s | turn s | prompt tok | unload ms | VRAM before | planner | model use | final use | borrowed | missing | note | right |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yue2-cover-en | en | cover | - | analyze | 2.0 | recipe | 0.0 | 11.4 | 1402 | 98 | 3058 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | yes |
| ace1-cover-de | de | cover | - | analyze | 4.2 | recipe | 0.0 | 11.8 | 1355 | 122 | 2980 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | yes |
| ace2-borrow-en | en | borrow | - | analyze | 4.6 | recipe | 0.0 | 11.8 | 1383 | 116 | 2975 | 10.9 of 10.9 GiB on the GPU | borrow | borrow | bpm key timeSignature structure | - | - | yes |
| upload-borrow-es | es | borrow | - | analyze | 5.0 | recipe | 0.0 | 10.4 | 1310 | 104 | 2989 | 10.9 of 10.9 GiB on the GPU | borrow | borrow | bpm key timeSignature structure | - | - | yes |
| non-audio | en | refuse | - | attach 400: notes.txt is not an audio file (MP3, WAV, FLAC, OGG, M4A, AAC, OPUS, AIFF, WEBM) | - | - | - | - | - | - | - | - | - | - | - | - | - | n/a |
| yue2-cover-es | es | cover | - | analyze | 4.8 | recipe | 0.0 | 13.0 | 1410 | 117 | 2981 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | yes |
| yue2-borrow-de | de | borrow | - | analyze | 4.7 | recipe | 0.0 | 13.8 | 1406 | 103 | 2978 | 10.9 of 10.9 GiB on the GPU | borrow | borrow | bpm key timeSignature structure | - | - | yes |
| yue2-borrow-en | en | borrow | - | analyze | 4.4 | recipe | 0.0 | 14.0 | 1404 | 194 | 2978 | 10.9 of 10.9 GiB on the GPU | borrow | borrow | bpm key timeSignature structure | - | - | yes |
| named-cover-en | en | cover | - | recipe | 13.9 | - | - | - | - | - | - | - | - | - | - | - | - | NO |
| yue2-borrow-es | es | borrow | - | analyze | 4.4 | recipe | 0.0 | 13.3 | 1406 | 102 | 2975 | 10.9 of 10.9 GiB on the GPU | borrow | borrow | bpm key timeSignature structure | - | - | yes |
| yue2-cover-de | de | cover | - | analyze | 4.5 | recipe | 0.0 | 10.7 | 1401 | 121 | 2978 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | yes |

## CREATE COVER

- yue2-cover-en: saved, hand-off 5 ms, take 68.9 s, song 69288aaf-804b-41b0-aeb1-79ba009cabdc, 158.43866666666668 s audio
- ace1-cover-de: saved, hand-off 5 ms, take 83.0 s, song c6c88dd9-837f-4c64-b356-7207a40c98e5, 196.47866666666667 s audio
