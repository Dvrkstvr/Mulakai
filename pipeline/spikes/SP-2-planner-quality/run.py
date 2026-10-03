"""SP-2 driver: library scores x request templates x model -> plan (<=3 retries) -> apply -> validate. Throwaway."""
from __future__ import annotations
import argparse, glob, json, os, re, sqlite3, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score as S
import planner as P
T = S.T

DATA = r"E:\repos\Mulakai\server\data"
db = sqlite3.connect(f"file:{DATA}/mulakai.db?mode=ro", uri=True)


def library():
    out = []
    for f in sorted(glob.glob(DATA + "/audio/*.abc")):
        vid = os.path.basename(f)[:-4]
        text = open(f, encoding="utf-8").read()
        try:
            T.parse_abc(text)
        except T.AbcError:
            continue
        row = db.execute("select params_json from versions where id=?", (vid,)).fetchone()
        q = json.loads(row[0])["request"]
        out.append({"vid": vid, "text": text, "lyrics": q["lyrics"], "style": q["style"]})
    return out


# ---------------------------------------------------------------- cases
SEMI = [(2, "up a whole step"), (-3, "down a minor third"), (5, "up a perfect fourth"), (-2, "down a whole step"),
        (7, "up a perfect fifth"), (1, "up a semitone")]
TOPICS = ["the ocean", "a road trip", "coffee in the morning", "missing an old friend"]


def first_idx(doc, label):
    for i, s in enumerate(doc.sections):
        if (s["label"] or "").lower() == label and doc.section_range(i):
            return i + 1
    return None


def phrase_window(doc):
    """(label, section_index, [allowed start bars]) for the first section that holds >= 4 consecutive Vocal-rest bars"""
    pri = ["intro", "interlude", "outro", "bridge"]
    cands = []
    for i, s in enumerate(doc.sections):
        r = doc.section_range(i)
        if not r:
            continue
        starts = [b for b in range(r[0], r[1] - 2) if all(doc.bar_flags(b + k, "Vocal") == 0 for k in range(4))]
        if starts and (s["label"] or "") in pri:
            first = [x for x in doc.sections[:i] if x["label"] == s["label"]]
            if not first:
                cands.append((pri.index(s["label"]), s["label"], i + 1, starts))
    if not cands:
        return None
    cands.sort()
    return cands[0][1:]


def ref_phrase(doc, start, nb=4):
    L = "CDEFGAB"
    k = L.index(re.match(r"[A-G]", doc.key).group(0))
    degs = [L[k], L[(k + 2) % 7], L[(k + 4) % 7], L[(k + 2) % 7]]
    out = []
    for i in range(nb):
        d = doc.units_per_bar(doc.bar(start + i, "Vocal")[0]) // 4
        order = degs if i % 2 == 0 else degs[::-1]   # vary the bars so the oracle passes the "not a loop" sanity gate
        out.append("".join(f"{x.lower()}{d}" for x in order))
    return out


def build_cases(sc, idx):
    doc = S.Doc(sc["text"])
    cases = []
    bpm = doc.bpm
    t_new = round(bpm * 1.2) if idx % 2 == 0 else round(bpm * 0.85)
    ph = ["make it {t} BPM.", "Speed it up to {t} beats per minute." if t_new > bpm else "Slow it down to {t} beats per minute."][idx % 2]
    cases.append(dict(tmpl="T1_SET_TEMPO", request=ph.format(t=t_new), expect={"bpm": t_new},
                      oracle=[{"op": "SET_TEMPO", "bpm": t_new}]))
    semi, words = SEMI[idx % len(SEMI)]
    cases.append(dict(tmpl="T2_TRANSPOSE", request=f"Transpose the whole song {words}.", expect={"semi": semi},
                      oracle=[{"op": "TRANSPOSE", "semitones": semi}]))
    ch = first_idx(doc, "chorus")
    if ch:
        r = doc.section_range(ch - 1)
        a = r[0]
        req3 = ["Give the first four bars of the chorus jazz chords.", "Reharmonize the first 4 bars of the chorus with jazzy chords."][idx % 2]
        oracle3 = [{"op": "REHARMONIZE", "from_bar": a, "to_bar": a + 3,
                    "chords": [{"bar": a + i, "beat": 1, "root": "D", "quality": "m7"} for i in range(4)]}]
        cases.append(dict(tmpl="T3_REHARMONIZE", request=req3, expect={"from": a, "to": a + 3}, oracle=oracle3))
        req4 = ["Repeat the chorus once.", "Add one more chorus right after the first chorus."][idx % 2]
        cases.append(dict(tmpl="T4_REPEAT", request=req4, expect={"label": "chorus", "first": ch},
                          oracle=[{"op": "REPEAT", "section": ch, "times": 1}]))
        blocks = S.lyric_blocks(sc["lyrics"])
        firsts = [i for i, b in enumerate(blocks, 1) if b.split("\n")[0].strip("[] ").lower() == "chorus"]
        bi = [i for i in firsts[:1] if len(blocks[i - 1].split("\n")) > 2]
        if bi:
            old = blocks[bi[0] - 1].split("\n")[1:]
            topic = TOPICS[idx % len(TOPICS)]
            cases.append(dict(tmpl="T5_REWRITE_LYRICS", request=f"Rewrite the lyrics of the first chorus so they are about {topic}.",
                              expect={"blocks": bi[:1], "n": len(old)},
                              oracle=[{"op": "REWRITE_LYRICS", "block": bi[0], "lines": ["la la la la"] * len(old)}]))
    w = phrase_window(doc)
    if w:
        label, si, starts = w
        cases.append(dict(tmpl="T6_WRITE_PHRASE", request=f"Add a 4-bar tenor sax phrase in the {label}.",
                          expect={"starts": starts, "n": 4},
                          oracle=[{"op": "WRITE_PHRASE", "start_bar": starts[0], "instrument": "tenor saxophone", "bars": ref_phrase(doc, starts[0])}]))
        if ch:
            a = doc.section_range(ch - 1)[0]
            cases.append(dict(tmpl="T7_COMPOUND", request=f"Jazz chords in the first four bars of the chorus, 88 BPM, and add a 4-bar sax phrase in the {label}.",
                              expect={"from": a, "to": a + 3, "starts": starts, "n": 4, "bpm": 88},
                              oracle=[{"op": "SET_TEMPO", "bpm": 88},
                                      {"op": "REHARMONIZE", "from_bar": a, "to_bar": a + 3, "chords": [{"bar": a + i, "beat": 1, "root": "D", "quality": "m7"} for i in range(4)]},
                                      {"op": "WRITE_PHRASE", "start_bar": starts[0], "instrument": "sax", "bars": ref_phrase(doc, starts[0])}]))
    return cases


# ---------------------------------------------------------------- checks
def kinds_no_style(ops):
    return [o["op"] for o in ops if o["op"] != "EDIT_STYLE"]


def intent(case, ops, doc0):
    t, e = case["tmpl"], case["expect"]
    k = kinds_no_style(ops)
    try:
        if t == "T1_SET_TEMPO":
            return k == ["SET_TEMPO"] and ops[[o["op"] for o in ops].index("SET_TEMPO")]["bpm"] == e["bpm"]
        if t == "T2_TRANSPOSE":
            return k == ["TRANSPOSE"] and ops[0]["semitones"] % 12 == e["semi"] % 12
        if t == "T3_REHARMONIZE":
            o = next(o for o in ops if o["op"] == "REHARMONIZE")
            return k == ["REHARMONIZE"] and (o["from_bar"], o["to_bar"]) == (e["from"], e["to"])
        if t == "T4_REPEAT":
            o = next(o for o in ops if o["op"] == "REPEAT")
            return k == ["REPEAT"] and (doc0.sections[o["section"] - 1]["label"] or "").lower() == "chorus" and o["times"] == 1
        if t == "T5_REWRITE_LYRICS":
            o = next(o for o in ops if o["op"] == "REWRITE_LYRICS")
            return k == ["REWRITE_LYRICS"] and o["block"] in e["blocks"]
        if t == "T6_WRITE_PHRASE":
            o = next(o for o in ops if o["op"] == "WRITE_PHRASE")
            return k == ["WRITE_PHRASE"] and o["start_bar"] in e["starts"] and len(o["bars"]) == 4 and "sax" in o["instrument"].lower()
        if t == "T7_COMPOUND":
            if sorted(k) != ["REHARMONIZE", "SET_TEMPO", "WRITE_PHRASE"]:
                return False
            a = next(o for o in ops if o["op"] == "SET_TEMPO")
            b = next(o for o in ops if o["op"] == "REHARMONIZE")
            c = next(o for o in ops if o["op"] == "WRITE_PHRASE")
            return a["bpm"] == 88 and (b["from_bar"], b["to_bar"]) == (e["from"], e["to"]) and c["start_bar"] in e["starts"] and len(c["bars"]) == 4
    except (KeyError, StopIteration, IndexError, TypeError):
        return False
    return False


def jazzy(ops):
    ch = [c for o in ops if o["op"] == "REHARMONIZE" for c in o["chords"]]
    def q(c):
        if "quality" in c:
            return c["quality"]
        import re as _re
        m = _re.fullmatch(f"({S.T.PITCH_NAME})(.*?)(?:/.*)?", c["symbol"])
        return m.group(2) if m else ""
    return bool(ch) and sum(q(c) in S.JAZZ_Q for c in ch) / len(ch) >= 0.5


def phrase_sanity(after_text, ops):
    """musical sanity gates for WRITE_PHRASE bars (distinct from the upstream validator)"""
    errs = []
    try:
        sc = T.parse_abc(after_text)
    except T.AbcError:
        return errs
    keyacc = T.key_accidentals(sc.voices["Ins"].keys[0][1])
    pcs = {(T.NATURAL[L] + a) % 12 for L, a in keyacc.items()}
    for o in ops:
        if o["op"] != "WRITE_PHRASE":
            continue
        a, n = o["start_bar"], len(o["bars"])
        bars = sc.voices["Vocal"].bars
        t0, t1 = bars[a - 1][0], bars[a - 1 + n - 1][0] + bars[a - 1 + n - 1][1]
        notes = [x for x in sc.voices["Ins"].notes if t0 <= x[0] < t1]
        if len(notes) < 4:
            errs.append(f"the phrase has only {len(notes)} notes; write a real melody (at least 4 notes)")
            continue
        ps = [x[1] for x in notes]
        if len(set(ps)) < 3:
            errs.append("the phrase uses fewer than 3 distinct pitches")
        if any(p < 48 or p > 88 for p in ps):
            errs.append("some phrase notes are outside the playable range C3..E6; use octave marks to keep it in range")
        if n > 1 and len({json.dumps(b) for b in o["bars"]}) == 1:
            errs.append("all phrase bars are identical; write a phrase that develops (vary at least one bar)")
        inkey = sum(p % 12 in pcs for p in ps) / len(ps)
        if inkey < 0.7:
            errs.append(f"only {inkey:.0%} of the phrase notes are in the key {sc.voices['Ins'].keys[0][1]}; keep to the key")
    return errs


def evaluate(text, lyr, style, ops):
    """apply + upstream validate + sanity. Returns (errors, stage, info, (new_text,new_lyr,new_style))"""
    try:
        nt, nl, ns = S.apply_ops(text, lyr, style, ops)
    except S.OpError as e:
        return [str(e)], "apply", {}, None
    errs, info = S.validate(text, nt, ops)
    if errs:
        return errs, "validate", info, (nt, nl, ns)
    san = phrase_sanity(nt, ops)
    if san:
        return san, "sanity", info, (nt, nl, ns)
    return [], "ok", info, (nt, nl, ns)


# ---------------------------------------------------------------- loop
def gpu_snap():
    try:
        o = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,utilization.gpu", "--format=csv,noheader,nounits"],
                           capture_output=True, text=True, timeout=10).stdout.strip().split(",")
        return int(o[0]), int(o[1])
    except Exception:
        return None, None


def plan(model, sc, case, seed, pattern, fmt="abc", max_retries=3):
    doc0 = S.Doc(sc["text"])
    schema = P.build_schema(phrase_bars=4 if "WRITE_PHRASE" in [o["op"] for o in case["oracle"]] else None, pattern=pattern, fmt=fmt)
    # phrase_bars only constrains when the template needs a phrase; other templates still carry the op in anyOf with 1..8 bars
    msgs = [{"role": "system", "content": P.system_prompt(fmt)},
            {"role": "user", "content": P.user_prompt(doc0, sc["lyrics"], sc["style"], case["request"])}]
    attempts, total = [], 0.0
    for a in range(1, max_retries + 2):
        data, err, dt = P.chat(model, msgs, schema, seed + a)
        total += dt
        rec = {"attempt": a, "sec": round(dt, 2)}
        if err or not data:
            rec.update(stage="http", errors=[err or "no data"]); attempts.append(rec); break
        content = data["choices"][0]["message"].get("content") or ""
        usage = data.get("usage", {})
        rec.update(prompt_tokens=usage.get("prompt_tokens"), completion_tokens=usage.get("completion_tokens"), raw=content[:3000],
                   finish=data["choices"][0].get("finish_reason"))
        try:
            obj = json.loads(content)
        except json.JSONDecodeError as e:
            rec.update(stage="json", errors=[f"not valid JSON: {e}"], schema_ok=False)
            attempts.append(rec)
            msgs += [{"role": "assistant", "content": content}, {"role": "user", "content": "That was not valid JSON. Reply with the JSON op list only."}]
            continue
        serr = P.check_schema(obj, schema)
        rec["schema_ok"] = not serr
        if serr:
            rec.update(stage="schema", errors=serr[:6])
        else:
            ops = obj["ops"]
            errs, stage, info, res = evaluate(sc["text"], sc["lyrics"], sc["style"], ops)
            rec.update(stage=stage, errors=errs[:8], info=info, ops=ops)
            rec["intent_ok"] = intent(case, ops, doc0)
            if stage == "ok":
                rec["jazzy"] = jazzy(ops)
                rec["new_lyrics"] = res[1] if case["tmpl"] == "T5_REWRITE_LYRICS" else None
                attempts.append(rec); break
        attempts.append(rec)
        feedback = "Your op list was rejected:\n" + "\n".join(f"- {x}" for x in rec["errors"]) + "\nReturn a corrected, complete op list as JSON only."
        msgs += [{"role": "assistant", "content": content}, {"role": "user", "content": feedback}]
    return attempts, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model"); ap.add_argument("tag")
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--scores", default="")
    ap.add_argument("--templates", default="")
    ap.add_argument("--no-pattern", action="store_true")
    ap.add_argument("--phrase-format", default="abc", choices=["abc", "notes"])
    ap.add_argument("--free-chords", action="store_true", help="ablation: chord symbols as free strings, no root/quality enums")
    ap.add_argument("--oracle", action="store_true", help="only check that the reference op lists pass the validator")
    a = ap.parse_args()
    P.FREE_CHORDS = a.free_chords
    lib = library()
    if a.scores:
        want = a.scores.split(",")
        lib = [s for s in lib if s["vid"][:8] in want]
    out_path = os.path.join(HERE, "results", f"{a.tag}.jsonl")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    done = set()
    if os.path.exists(out_path):
        for ln in open(out_path, encoding="utf-8"):
            r = json.loads(ln); done.add((r["vid"], r["tmpl"], r["rep"]))
    f = open(out_path, "a", encoding="utf-8", buffering=1)
    tm = set(a.templates.split(",")) if a.templates else None
    for rep in range(a.reps):
        for idx, sc in enumerate(lib):
            for case in build_cases(sc, idx):
                if tm and not any(case["tmpl"].startswith(x) for x in tm):
                    continue
                key = (sc["vid"][:8], case["tmpl"], rep)
                if key in done:
                    continue
                oerr, ostage, oinfo, _ = evaluate(sc["text"], sc["lyrics"], sc["style"], case["oracle"])
                rec = {"vid": sc["vid"][:8], "tmpl": case["tmpl"], "rep": rep, "request": case["request"], "model": a.model,
                       "oracle_ok": not oerr, "oracle_errors": oerr[:3], "oracle_info": oinfo}
                if a.oracle:
                    print(rec["vid"], rec["tmpl"], "oracle", "OK" if not oerr else oerr[:2]); continue
                if oerr:
                    rec["skipped"] = "infeasible: the reference op list fails the validator"
                    f.write(json.dumps(rec) + "\n"); print(rec["vid"], rec["tmpl"], "SKIP infeasible", oerr[:1]); continue
                mem, util = gpu_snap()
                attempts, total = plan(a.model, sc, case, seed=1000 * rep + idx * 10, pattern=not a.no_pattern, fmt=a.phrase_format)
                rec.update(attempts=attempts, total_sec=round(total, 2), gpu_mem_mib=mem, gpu_util=util)
                f.write(json.dumps(rec) + "\n")
                last = attempts[-1]
                print(f"{rec['vid']} {case['tmpl']:18s} n={len(attempts)} {total:6.1f}s stage={last.get('stage')} intent={last.get('intent_ok')} "
                      f"first={attempts[0].get('stage')} gpu={mem}/{util}%", flush=True)


if __name__ == "__main__":
    main()
