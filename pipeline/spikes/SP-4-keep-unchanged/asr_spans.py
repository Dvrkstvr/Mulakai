"""SP-4: Whisper (faster-whisper large-v3, the lyrics-server settings) on audio spans. Run with the lyrics-server venv on Windows:
  E:\repos\Mulakai\lyrics-server\venv\Scripts\python.exe asr_spans.py <asr_jobs.json> <out.json>
jobs = [{"id","wav","start","end","lang"}]; GPU must be free of YuE2 / ACE-Step. Cached by id in out.json."""
import json, os, subprocess, sys, tempfile, importlib.util, gc
from pathlib import Path

LS = Path(r"E:\repos\Mulakai\lyrics-server")
SETTINGS = {"beam_size": 5, "condition_on_previous_text": False, "word_timestamps": True, "vad_filter": False}


def add_dlls():
    spec = importlib.util.find_spec("nvidia")
    for root in (spec.submodule_search_locations if spec else []) or []:
        for lib in ("cublas", "cudnn"):
            b = Path(root) / lib / "bin"
            if b.is_dir():
                os.add_dll_directory(str(b)); os.environ["PATH"] = str(b) + os.pathsep + os.environ["PATH"]


def main(jobs_path, out_path):
    jobs = json.load(open(jobs_path, encoding="utf-8"))
    done = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {}
    todo = [j for j in jobs if j["id"] not in done]
    if not todo:
        return
    add_dlls()
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cuda", compute_type="float16", download_root=str(LS / "models"))
    tmp = Path(os.environ.get("SP4_TMP", r"E:\ai\tmp\sp4")) / "asr"; tmp.mkdir(parents=True, exist_ok=True)
    for j in todo:
        seg = tmp / (j["id"] + ".wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(j["start"]), "-t", str(j["end"] - j["start"]), "-i", j["wav"], "-ac", "1", "-ar", "16000", str(seg)], check=True)
        segs, info = model.transcribe(str(seg), language=j.get("lang"), **SETTINGS)
        words = [{"w": w.word.strip(), "s": round(w.start + j["start"], 2), "e": round(w.end + j["start"], 2)} for s in segs for w in (s.words or [])]
        done[j["id"]] = {"text": " ".join(w["w"] for w in words), "words": words, "lang": info.language}
        json.dump(done, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(j["id"], done[j["id"]]["text"][:100], flush=True)
    del model; gc.collect()


main(sys.argv[1], sys.argv[2])
