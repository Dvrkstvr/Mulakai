"""SP-4 step 0 (Windows python, stdlib): read each song's library request + score, ask yue-server /v1/scores/read for the
facts (sections, bar ranges, lyric blocks). Writes facts/<code>.json and base/<code>.{abc,json}. Library is read-only."""
import json, os, sqlite3, urllib.request, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = r"E:\repos\Mulakai\server\data"
YUE = "http://127.0.0.1:8044"
SONGS = {"A": "2c944049", "B": "3820c535", "C": "c8144c53", "D": "3c9e79de"}
db = sqlite3.connect(f"file:{DATA}/mulakai.db?mode=ro", uri=True)
os.makedirs(f"{HERE}/facts", exist_ok=True); os.makedirs(f"{HERE}/base", exist_ok=True)
for code, pre in SONGS.items():
    vid, pj = db.execute("select id, params_json from versions where id like ?", (pre + "%",)).fetchone()
    req = json.loads(pj)["request"]
    abc = open(f"{DATA}/audio/{vid}.abc", encoding="utf-8").read()
    open(f"{HERE}/base/{code}.abc", "w", encoding="utf-8", newline="\n").write(abc)
    json.dump({"vid": vid, **req}, open(f"{HERE}/base/{code}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    r = urllib.request.Request(YUE + "/v1/scores/read", data=json.dumps({"abc": abc, "lyrics": req["lyrics"]}).encode(), headers={"content-type": "application/json"})
    facts = json.load(urllib.request.urlopen(r))
    json.dump(facts, open(f"{HERE}/facts/{code}.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    f = facts["facts"]
    print(code, vid[:8], "ok", facts["ok"], "bpm", facts["bpm"], "sec", facts["seconds"], "keys", list(f.keys()))
