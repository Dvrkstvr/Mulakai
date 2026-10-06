"""SP-4 candidate B: ACE-Step repaint of a short window around each seam of a spliced song (Windows python, stdlib only).
ACE-Step 1.5 (S:\\AI Gen\\ACE-Step-1.5, never modified) must be running on ACE_URL with the GPU to itself.
usage: python heal.py <jobs.json>   jobs = [{"id","src","out","windows":[[start,end],...],"mode","strength","prompt","lyrics","lang"}]
Each window is one /release_task (task_type repaint, src_audio uploaded as in server/src/services/acestep/tasks.ts); a second window
repaints the first one's output. Result + timings go to results/heal_<id>.json."""
import json, os, sys, time, uuid, urllib.request, urllib.parse

ACE = os.environ.get("ACE_URL", "http://127.0.0.1:8051")
HERE = os.path.dirname(os.path.abspath(__file__))


def call(path, body=None, timeout=600):
    req = urllib.request.Request(ACE + path, data=None if body is None else json.dumps(body).encode(), headers={"Content-Type": "application/json"} if body is not None else {})
    j = json.load(urllib.request.urlopen(req, timeout=timeout))
    if j.get("code") != 200:
        raise RuntimeError(f"{path}: {j.get('error')}")
    return j["data"]


def multipart(fields, files):
    b = "----sp4" + uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8")
    for k, (fn, data) in files.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + data + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def repaint(src_path, start, end, out_path, mode, strength, prompt, lyrics, lang, steps, model=None, seed=1234):
    fields = {"task_type": "repaint", "repainting_start": start, "repainting_end": end, "prompt": prompt, "lyrics": lyrics, "vocal_language": lang,
              "audio_format": "wav32", "batch_size": 1, "thinking": "false", "use_random_seed": "false", "seed": seed, "inference_steps": steps,
              "repaint_mode": mode, "repaint_strength": strength}
    if model:
        fields["model"] = model
    body, ct = multipart(fields, {"src_audio": (os.path.basename(src_path), open(src_path, "rb").read())})
    t0 = time.time()
    req = urllib.request.Request(ACE + "/release_task", data=body, headers={"Content-Type": ct})
    try:
        j = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"release_task HTTP {e.code}: {e.read()[:600]!r}")
    if j.get("code") != 200:
        raise RuntimeError(f"release_task: {j.get('error')}")
    tid = j["data"]["task_id"]
    while True:
        time.sleep(2)
        rows = call("/query_result", {"task_id_list": [tid]})
        row = rows[0]
        if row["status"] == 0:
            continue
        if row["status"] == 2:
            raise RuntimeError("generation failed: " + str(row)[:400])
        res = json.loads(row["result"]) if isinstance(row["result"], str) else row["result"]
        r = next((x for x in res if x.get("status") == 1), res[0])
        break
    data = urllib.request.urlopen(ACE + r["file"], timeout=600).read()
    open(out_path, "wb").write(data)
    return {"task_id": tid, "seconds": time.time() - t0, "file": r["file"], "bytes": len(data)}


def main(jobs_path):
    jobs = json.load(open(jobs_path, encoding="utf-8"))
    for job in jobs:
        res_path = f"{HERE}/results/heal_{job['id']}.json"
        if os.path.exists(res_path):
            print("skip", job["id"]); continue
        cur = job["src"]; steps_log = []
        for k, (a, b) in enumerate(job["windows"]):
            tmp = job["out"] if k == len(job["windows"]) - 1 else job["out"].replace(".wav", f".w{k}.wav")
            info = repaint(cur, a, b, tmp, job["mode"], job.get("strength", 0.5), job["prompt"], job["lyrics"], job["lang"], job.get("steps", 8), job.get("model"))
            info["window"] = [a, b]; steps_log.append(info); cur = tmp
            print(job["id"], "window", k, [round(a, 2), round(b, 2)], f"{info['seconds']:.1f}s", flush=True)
        json.dump({"id": job["id"], "mode": job["mode"], "strength": job.get("strength", 0.5), "steps": steps_log, "seconds_total": sum(s["seconds"] for s in steps_log)},
                  open(res_path, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
