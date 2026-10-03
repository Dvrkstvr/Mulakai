"""Build the planner prompt and the two yue-server job bodies from real library data (read-only)."""
import json, re, sqlite3
AUDIO = "../../../server/data/audio/"
db = sqlite3.connect("file:../../../server/data/mulakai.db?mode=ro", uri=True)
def req(vid):
    r = db.execute("select id, params_json from versions where id like ?", (vid + "%",)).fetchone()
    return r[0], json.loads(r[1])["request"]
def abc(vid_full): return open(AUDIO + vid_full + ".abc", encoding="utf-8").read()

# --- normal 3-minute song (the spike baseline length) ---
vid, q = req("2c944049")
score = abc(vid)
body = {"style": q["style"], "lyrics": q["lyrics"], "cot": "full", "seed": q["seed"], "abc": score}
json.dump(body, open("yue_request_normal.json", "w", encoding="utf-8"), ensure_ascii=False)

# --- near-budget: chorus repeated 14x; lyrics get the same extra [Chorus] blocks ---
vid2, q2 = req("c8144c53")
nb = open("near_budget.abc", encoding="utf-8").read()
lyr = q2["lyrics"]
m = re.search(r"\[Chorus\]\n.*?(?=\n\n\[)", lyr, re.S)
extra = nb.count("% chorus") - lyr.count("[Chorus]")
lyr2 = lyr[:m.end()] + ("\n\n" + m.group(0)) * extra + lyr[m.end():]
json.dump({"style": q2["style"], "lyrics": lyr2, "cot": "full", "seed": q2["seed"], "abc": nb},
          open("yue_request_near.json", "w", encoding="utf-8"), ensure_ascii=False)

# --- planner prompt (real score + condensed dialect rules + lyrics + request), JSON-schema output ---
rules = open("dialect_rules.txt", encoding="utf-8").read()
user = (f"STYLE:\n{q['style']}\n\nLYRICS:\n{q['lyrics']}\n\nSCORE (native YuE2 ABC):\n{score}\n\n"
        "REQUEST: jazz chords in the chorus, 88 BPM, add a 4-bar sax phrase after it.\n"
        "Reply with the op list only.")
schema = {"type": "object", "required": ["ops", "style"], "properties": {
    "style": {"type": "string"},
    "ops": {"type": "array", "items": {"type": "object", "required": ["op"], "properties": {
        "op": {"enum": ["SET_TEMPO", "REHARMONIZE", "REPEAT", "WRITE_PHRASE", "EDIT_STYLE"]},
        "section": {"type": "string"}, "bars": {"type": "string"}, "bpm": {"type": "integer"},
        "chords": {"type": "array", "items": {"type": "string"}}, "abc": {"type": "string"}}}}}}
json.dump({"messages": [{"role": "system", "content": "/no_think\n" + rules}, {"role": "user", "content": user}],
           "schema": schema}, open("planner_prompt.json", "w", encoding="utf-8"), ensure_ascii=False)
print("ok", len(score), len(nb), extra)
