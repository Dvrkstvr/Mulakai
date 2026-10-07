"""The 5 library songs' real song-state blocks (from yue-server /v1/scores/read on library copies) and the apply/commit helpers. Throwaway."""
from __future__ import annotations

import copy
import re

import requests

import lib

PICK = {  # key -> (vid prefix, language of the words)
    "S1": ("691aa438", "de"),   # Kopf hoch getanzt: 206 bars, chord-free, German
    "S2": ("3820c535", "es"),   # Romantica: Spanish, chords, a meter change
    "S3": ("2c944049", "en"),   # Purple Shinings: English, chords
    "S4": ("c8144c53", "de"),   # Gertar: German, 3 choruses, chords
    "S5": ("3b51d3d9", "pl"),   # Polski Polka: Polish words, 3 choruses, chords
}
LIBRARY_TITLES = ["Romantica", "Purple Shinings", "Kopf hoch getanzt", "Gertar", "Polski Polka"]


def lyric_blocks_text(lyrics):
    """[(tag, [lines])] in order; blank lines dropped (the facts' line counts)."""
    out = []
    for raw in lyrics.splitlines():
        t = raw.strip()
        if re.fullmatch(r"\[.*\]", t):
            out.append((t, []))
        elif t and out:
            out[-1][1].append(t)
    return out


def load():
    rows = {r["vid"][:8]: r for r in lib.rows()}
    out = {}
    for key, (prefix, lang) in PICK.items():
        r = rows[prefix]
        j = lib.read(r["abc"], r["lyrics"])
        assert j["ok"], (key, j.get("error"))
        out[key] = {"key": key, "vid": r["vid"], "title": r["title"], "lang": lang, "abc": r["abc"], "style": r["style"],
                    "lyrics": r["lyrics"], "facts": j["facts"], "versions": ["v1 first take (YuE2)"]}
    return out


def apply_ops(song, ops):
    """POST /v1/scores/apply -> (result json or None, error text or None)."""
    r = requests.post(lib.YUE + "/v1/scores/apply", json={"abc": song["abc"], "style": song["style"], "lyrics": song["lyrics"], "ops": ops}, timeout=120)
    if r.status_code != 200:
        return None, f"HTTP {r.status_code}: {r.text[:300]}"
    return r.json(), None


def commit(song, ops, label):
    """The person pressed APPLY: a new version whose facts are read from the edited score (what the next turn's state block shows)."""
    res, err = apply_ops(song, ops)
    assert res and res["ok"], (err, res and (res["verdicts"], res["checks"]))
    new = copy.deepcopy(song)
    new["abc"], new["style"], new["lyrics"] = res["abc"], res["style"], res["lyrics"] if res.get("lyrics") is not None else song["lyrics"]
    j = lib.read(new["abc"], new["lyrics"])
    assert j["ok"], j.get("error")
    new["facts"] = j["facts"]
    n = len(song["versions"]) + 1
    new["versions"] = song["versions"] + [f"v{n} {label}"]
    return new


if __name__ == "__main__":
    for k, s in load().items():
        print(k, s["title"], s["facts"]["header"]["bars"], len(s["facts"]["bar_map"]))
