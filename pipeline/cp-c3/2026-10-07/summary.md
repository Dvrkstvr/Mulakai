# CP-C3, reference songs (2026-10-06)

Server http://127.0.0.1:3401. Planner via the proxy to http://127.0.0.1:11434. GPU at start 2223 MiB. Run 2 (--retry --merge): the 5 cover-worded legs again; a non-analyze first reply is asked again with 'Read the attached song first.' prefixed.

## Stop lines

- PASS slowest reading of a file of 4 min or less: 90.8 s (stop over 240 s)
- PASS follow-up turn p50 13.3 s; planner not fully on the GPU in 0 of 6 seen (stop over 15 s or any)
- PASS score read ok on 2 of 3 audio files (stop under 2)
- STOP reference_use right on 1 of 10 (stop under 8 of 10)
- PASS worst hand-off 0.2 s: unload-to-empty 0.2 s, READ-to-reading 0.0 s, reading-to-follow-up 0.0 s, CREATE-to-take 0.0 s (stop over 5 s)

## Readings

| ref | source | file s | plan | READ->run s | reading s | WORDS s | SCORE s | CAPTION s | words | score | caption | coverable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yue2-cover-en | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| ace2-borrow-en | acestep | 240 | own/service/own | 0.0 | 26.7 | - | 26.6 | - | ?, 22 lines | transcribed, 92 bars, 8 sections, 91 bpm D#m 4/4, chords true, 0 warnings, 1600/4096 tok | 92 bpm, Eb major, 4: A sophisticated lounge jazz arrangement opens with a crisp,  | yes |
| upload-borrow-es | upload | 140 | service/service/service | 0.0 | 90.8 | 11.4 | 12.3 | 66.9 | en, 21 lines | transcribed, 44 bars, 6 sections, 75 bpm Fm 4/4, chords true, 0 warnings, 727/4096 tok | 75 bpm, F minor, 4: A moody and atmospheric downtempo track opens with spacious  | yes |
| yue2-borrow-de | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-borrow-en | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |
| yue2-borrow-es | yue2 | 161 | own/own/own | 0.0 | 0.1 | - | - | - | es, 41 lines | own, 64 bars, 6 sections, 95 bpm Dm 4/4, chords true, 0 warnings, 1042/4096 tok | 95 bpm, D minor, 4: A romantic Latin pop track opens with a clean, arpeggiated p | yes |

## Turns and reference_use

| ref | lang | expect | first reply | ask reply | ask s | follow-up | ->run s | turn s | prompt tok | unload ms | VRAM before | planner | model use | final use | borrowed | missing | note | right |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yue2-cover-en | en | cover | say: The chat cannot do that yet: open the song in the Editor and use REPAINT there. | analyze | 5.2 | recipe | 0.0 | 12.0 | 1428 | 105 | 2224 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | yes |
| ace1-cover-de | de | cover | - | say | 5.9 | - | - | - | - | - | - | - | - | - | - | - | - | NO |
| ace2-borrow-en | en | borrow | - | analyze | 5.8 | recipe | 0.0 | 13.3 | 1345 | 191 | 1335 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | NO |
| upload-borrow-es | es | borrow | - | analyze | 5.5 | recipe | 0.0 | 12.8 | 1314 | 161 | 2192 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | NO |
| non-audio | en | refuse | - | attach 400: notes.txt is not an audio file (MP3, WAV, FLAC, OGG, M4A, AAC, OPUS, AIFF, WEBM) | - | - | - | - | - | - | - | - | - | - | - | - | - | n/a |
| yue2-cover-es | es | cover | - | recipe | 16.0 | - | - | - | - | - | - | - | - | - | - | - | - | NO |
| yue2-borrow-de | de | borrow | - | analyze | 5.8 | recipe | 0.0 | 14.1 | 1368 | 108 | 2200 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | NO |
| yue2-borrow-en | en | borrow | - | analyze | 5.5 | recipe | 0.0 | 26.9 | 1366/2135 | 108 | 2190 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | NO |
| named-cover-en | en | cover | - | recipe | 14.9 | - | - | - | - | - | - | - | - | - | - | - | - | NO |
| yue2-borrow-es | es | borrow | - | analyze | 5.1 | recipe | 0.0 | 14.0 | 1368 | 160 | 2223 | 10.9 of 10.9 GiB on the GPU | cover | cover | bpm key timeSignature structure | - | - | NO |
| yue2-cover-de | de | cover | - | recipe | 16.9 | - | - | - | - | - | - | - | - | - | - | - | - | NO |

## CREATE COVER

- yue2-cover-en: saved, hand-off 4 ms, take 85.1 s, song 7ba4e489-8724-4987-ba8b-c49231040ccf, 159.79866666666666 s audio
