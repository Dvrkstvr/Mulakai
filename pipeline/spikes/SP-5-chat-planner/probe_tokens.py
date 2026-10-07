"""Bar (g), the worst case on purpose: the 206-bar song's state block + a pending 6-op edit plan + 4 full exchanges + a mark + an
attachment line; and the same with a pending recipe card (no song). Token counts are Ollama's own usage.prompt_tokens (max_tokens 1).
Also: how much of the prompt is rules / song block, for the budget. Throwaway."""
from __future__ import annotations

import json
import sys

sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import llm  # noqa: E402
import prompt as P  # noqa: E402
import songs  # noqa: E402

LONG = ("Done: jazz chords for the second chorus, bars 167-206, in three passes of 16 bars so every bar has a chord and the root moves at least every "
        "other bar. Check the card, then APPLY.")


def count(messages):
    return llm.chat(messages, None, seed=1, max_tokens=1)['prompt_tokens']


def bm(st, text):
    return P.build_messages(st, text, rules=P.rules_for())


def main():
    P.V3 = True
    P.RLE = len(sys.argv) > 1 and sys.argv[1] == 'rle'
    S = songs.load()
    s1 = S['S1']
    chords = lambda a, b: [{'bar': x, 'beat': 1, 'root': ['Ab', 'Db', 'Gb', 'Eb'][x % 4], 'quality': ['maj7', 'm7', '7', 'm7b5'][x % 4]} for x in range(a, b + 1)]  # noqa: E731
    ops = [{'op': 'REHARMONIZE', 'from_bar': 167 + 16 * k, 'to_bar': min(206, 182 + 16 * k), 'chords': chords(167 + 16 * k, min(206, 182 + 16 * k))} for k in range(3)]
    ops += [{'op': 'SET_TEMPO', 'bpm': 132}, {'op': 'EDIT_STYLE', 'style': 'male vocal, jazzy synth-pop, warm electric piano, walking bass, brushed drums'}]
    hist = []
    for i in range(4):
        hist += [('user', f"please also change something else about the song, number {i}, and keep it reasonable and short"), ('assistant', LONG + ' [edit card: REHARMONIZE bars 167-182; REHARMONIZE bars 183-198; REHARMONIZE bars 199-206]')]
    st = {'song': s1, 'library': songs.LIBRARY_TITLES, 'pending': {'kind': 'edit', 'ops': ops, 'against': 'v1'}, 'history': hist,
          'mark': 'bars 167-206, S6 chorus (the second chorus); key Eb, 145 bpm there', 'attachment': None}
    out = {}
    m = bm(st, "make the second chorus jazzier and also a bit slower, and cut the interlude")
    out['206_bars_pending_6ops_4_exchanges_mark'] = count(m)
    st2 = dict(st, pending=None, history=[], mark=None)
    out['206_bars_bare'] = count(bm(st2, "make it jazzier"))
    # system prompt pieces
    out['system_prompt_tokens'] = count([{'role': 'system', 'content': P.rules_for()}, {'role': 'user', 'content': 'x'}]) - 6
    out['ops_reference_tokens'] = count([{'role': 'system', 'content': P.OPS_REFERENCE}, {'role': 'user', 'content': 'x'}]) - 6
    out['song_block_206_tokens'] = count([{'role': 'user', 'content': P.song_block(s1, songs.LIBRARY_TITLES)}]) - 6
    # a pending recipe card with a long lyric + 4 exchanges, no song
    rec = {'title': 'Luz sobre el mar', 'style': 'slow Spanish ballad, nylon guitar, soft female vocal, intimate, sparse arrangement', 'bpm': 68, 'key': 'Am',
           'time_signature': '4/4', 'language': 'es', 'engine': 'yue2', 'structure': ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
           'lyrics': [{'tag': t, 'lines': ['La sal en tu piel, el viento sin nombre y la barca que se va'] * 8} for t in ('Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus')]}
    st3 = {'song': None, 'library': songs.LIBRARY_TITLES, 'pending': {'kind': 'recipe', 'recipe': rec}, 'history': hist, 'mark': None, 'attachment': None}
    out['recipe_pending_8_lines_x6_sections_4_exchanges'] = count(bm(st3, "make it faster"))
    print(json.dumps(out, indent=1))
    json.dump(out, open('results/probe_tokens' + ('_rle' if P.RLE else '_v3') + '.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
