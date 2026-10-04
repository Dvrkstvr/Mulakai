"""Reads the throwaway DB (read-only) and writes raw/spec.json for m0_analyze.py: one row per score version
(its audio/.abc, the previous version's audio/.abc it was planned against, the edited bars from its stored ops)."""
import json, os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = sys.argv[1]
db = sqlite3.connect(f"file:{DATA}/mulakai.db?mode=ro", uri=True)
spec = []
for sid, tag in (("3d4dd80a-d8fc-41a8-8b39-c307201379d9", "rain"), ("0d077c13-1720-4d6d-8e62-6e4d0f052b84", "tempo")):
    rows = db.execute("select v.id, v.audio_file, v.label, v.params_json from versions v join layers l on v.layer_id=l.id "
                      "where l.song_id=? and v.label not like 'repaint%' order by v.created_at", (sid,)).fetchall()
    for i, (vid, audio, label, pj) in enumerate(rows):
        p = json.loads(pj) if pj else {}
        if p.get("task_type") != "score":
            continue
        base = p.get("basedOn") or rows[i - 1][0]
        brow = next(r for r in rows if r[0] == base)
        ops = p.get("ops", [])
        spec.append({"name": f"{tag}_v{i + 1}", "audio": f"{DATA}/audio/{audio}", "abc": f"{DATA}/audio/{vid}.abc",
                     "baseName": f"{tag}_v{rows.index(brow) + 1}", "baseAudio": f"{DATA}/audio/{brow[1]}", "baseAbc": f"{DATA}/audio/{brow[0]}.abc",
                     "edited": [[o["from_bar"], o["to_bar"]] for o in ops if o["op"] == "REHARMONIZE"], "label": label})
os.makedirs(f"{HERE}/raw", exist_ok=True)
json.dump(spec, open(f"{HERE}/raw/spec.json", "w"), indent=1)
print(json.dumps([{k: v for k, v in s.items() if k not in ("audio", "abc", "baseAudio", "baseAbc")} for s in spec], indent=1))
