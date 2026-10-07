"""How reliable is the offline language-ID on lyrics? Ground truth = library songs whose language is known (de / es / en), cut into
4-line chunks (the smallest recipe section) and whole songs. Compares lingua (12 candidates) and langdetect. Throwaway."""
from __future__ import annotations

import json
import re
import sys

sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import checks as C  # noqa: E402
import lib  # noqa: E402
import songs  # noqa: E402

TRUTH = {'691aa438': 'de', 'c8144c53': 'de', '2a8cc1ca': 'de', '3820c535': 'es', '3c9e79de': 'es', '2c944049': 'en', '29990238': 'en'}


def main():
    rows = {r['vid'][:8]: r for r in lib.rows()}
    chunks, whole = [], []
    for vid, lang in TRUTH.items():
        blocks = songs.lyric_blocks_text(rows[vid]['lyrics'])
        lines = [ln for _t, ls in blocks for ln in ls if not re.match(r"^[\(\[].*[\)\]]$", ln)]
        for i in range(0, len(lines) - 3, 4):
            chunks.append((vid, lang, ' '.join(lines[i:i + 4])))
        whole.append((vid, lang, ' '.join(lines)))
    out = {}
    for name, data in (('4-line chunks', chunks), ('whole songs', whole)):
        res = {'n': len(data), 'lingua': {}, 'langdetect': {}, 'bad_lingua': [], 'bad_langdetect': []}
        for _vid, lang, text in data:
            a, b = C.lid(text)
            for who, got in (('lingua', a), ('langdetect', b)):
                d = res[who].setdefault(lang, [0, 0])
                d[1] += 1
                d[0] += got == lang
                if got != lang:
                    res['bad_' + who].append((_vid, lang, got, text[:70]))
        out[name] = res
    print(json.dumps(out, ensure_ascii=False, indent=1))
    json.dump(out, open('results/langid.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
