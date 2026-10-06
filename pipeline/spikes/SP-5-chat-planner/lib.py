"""Library scan: every .abc sidecar in server/data (read-only) -> /v1/scores/read facts. Throwaway."""
import glob, json, os, sqlite3, requests, sys
DATA = r"E:\repos\Mulakai\server\data"
YUE = os.environ.get("YUE_URL", "http://127.0.0.1:8095")
def rows():
    db = sqlite3.connect(f"file:{DATA}/mulakai.db?mode=ro", uri=True)
    out = []
    for f in sorted(glob.glob(DATA + "/audio/*.abc")):
        vid = os.path.basename(f)[:-4]
        text = open(f, encoding="utf-8").read()
        row = db.execute("select v.params_json, s.title, s.id, s.caption, s.lyrics, s.bpm, s.key_scale from versions v join layers l on l.id=v.layer_id join songs s on s.id=l.song_id where v.id=?", (vid,)).fetchone()
        if not row: continue
        p = json.loads(row[0]); q = p.get("request", {})
        out.append(dict(vid=vid, abc=text, title=row[1], song=row[2], caption=row[3], lyrics=q.get("lyrics") or row[4] or "", style=q.get("style",""), bpm=row[5], key=row[6]))
    return out
def read(abc, lyrics):
    r = requests.post(YUE + "/v1/scores/read", json={"abc": abc, "lyrics": lyrics}, timeout=60)
    return r.json()
if __name__ == "__main__":
    for r in rows():
        j = read(r["abc"], r["lyrics"])
        f = j.get("facts")
        print(r["vid"][:8], repr(r["title"]), "ok" if j.get("ok") else "BAD:" + str(j.get("error"))[:50],
              (f"bars={f['header']['bars']} sec={f['header']['seconds']:.0f} key={f['header']['key']} bpm={f['header']['bpm']} sections={len(f['sections'])} blocks={len(f['lyric_blocks'])}" if f else ""),
              "| " + r["lyrics"][:60].replace("\n", " / "))
