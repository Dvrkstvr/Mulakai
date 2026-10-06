"""usage (Windows python): mk_near_variant.py <target_tokens>  -> yue_request_near_<target>.json
(uses WSL tokenizer via build_near_budget.py for the score, then repeats the lyrics' first [Chorus] to match)"""
import json, re, sqlite3, subprocess, sys
t = sys.argv[1]
subprocess.run(["wsl", "-d", "Ubuntu-24.04", "--exec", "bash", "-lc",
  f"cd /mnt/e/repos/Mulakai/pipeline/spikes/SP-1-vram-handoff && ~/yue2/.venv/bin/python build_near_budget.py /mnt/e/repos/Mulakai/server/data/audio/c8144c53-6612-4efc-8a4c-da279f2e0307.abc near_{t}.abc {t}"], check=True)
db = sqlite3.connect("file:../../../server/data/mulakai.db?mode=ro", uri=True)
q = json.loads(db.execute("select params_json from versions where id like 'c8144c53%'").fetchone()[0])["request"]
nb = open(f"near_{t}.abc", encoding="utf-8").read(); lyr = q["lyrics"]
m = re.search(r"\[Chorus\]\n.*?(?=\n\n\[)", lyr, re.S)
extra = nb.count("% chorus") - lyr.count("[Chorus]")
lyr2 = lyr[:m.end()] + ("\n\n" + m.group(0)) * extra + lyr[m.end():]
json.dump({"style": q["style"], "lyrics": lyr2, "cot": "full", "seed": q["seed"], "abc": nb},
          open(f"yue_request_near_{t}.json", "w", encoding="utf-8"), ensure_ascii=False)
print("extra chorus copies", extra)
