"""SP-5 checks: schema validation (independent of Ollama's grammar), recipe validity against Guided Create's rules, lyric language-ID,
the retry loop's semantic problems, and the per-case intent checks the scorer uses. Throwaway."""
from __future__ import annotations

import re
import sys

sys.path.insert(0, r"E:\ai\tmp\sp5\site")

from jsonschema import Draft202012Validator  # noqa: E402
from langdetect import DetectorFactory, detect_langs  # noqa: E402
from langdetect.lang_detect_exception import LangDetectException  # noqa: E402
from lingua import Language, LanguageDetectorBuilder  # noqa: E402

import schemas as S  # noqa: E402

DetectorFactory.seed = 0
_L = Language
_LINGUA = LanguageDetectorBuilder.from_languages(
    _L.ENGLISH, _L.GERMAN, _L.SPANISH, _L.FRENCH, _L.ITALIAN, _L.PORTUGUESE, _L.DUTCH, _L.POLISH, _L.SWEDISH, _L.TURKISH, _L.RUSSIAN, _L.LATIN).build()
_CODE = {'ENGLISH': 'en', 'GERMAN': 'de', 'SPANISH': 'es', 'FRENCH': 'fr', 'ITALIAN': 'it', 'PORTUGUESE': 'pt', 'DUTCH': 'nl',
         'POLISH': 'pl', 'SWEDISH': 'sv', 'TURKISH': 'tr', 'RUSSIAN': 'ru', 'LATIN': 'la'}


def lid(text):
    """Primary language id (lingua, 12 candidate languages); also langdetect's top code as a second opinion."""
    lg = _LINGUA.detect_language_of(text)
    a = _CODE[lg.name] if lg else None
    try:
        b = detect_langs(text)[0].lang
    except LangDetectException:
        b = None
    return a, b


_validators = {}


def validate(reply, schema):
    """Reasons a reply does not satisfy the schema (empty = valid). Independent of Ollama's grammar."""
    key = id(schema)
    if key not in _validators:
        Draft202012Validator.check_schema(schema)
        _validators[key] = Draft202012Validator(schema)
    errs = sorted(_validators[key].iter_errors(reply), key=lambda e: list(e.path))
    out = []
    for e in errs[:6]:
        path = '/'.join(str(p) for p in e.path)
        out.append(f"{path or 'reply'}: {e.message[:140]}")
    return out


# ---------------------------------------------------------------- recipe rules (bar c / d), independent of the schema
BRACKET = re.compile(r"[\[\]]")


def recipe_problems(r):
    """Every field against Guided Create's own rules (key table, tempo range, structure tags, style limit, time signature, engine)
    and the lyric shape rules of bar (d) (closed tags, 4-8 lines, no tags in lines). Returns (field_problems, lyric_problems)."""
    f, ly = [], []
    if r.get('key') not in S.KEYS:
        f.append(f"key {r.get('key')!r} is not one of the 30 names")
    bpm = r.get('bpm')
    if not (isinstance(bpm, int) and not isinstance(bpm, bool) and S.BPM_MIN <= bpm <= S.BPM_MAX):
        f.append(f"bpm {bpm!r} outside {S.BPM_MIN}-{S.BPM_MAX}")
    if r.get('time_signature') not in S.TIMES:
        f.append(f"time_signature {r.get('time_signature')!r}")
    if r.get('engine') not in S.ENGINES:
        f.append(f"engine {r.get('engine')!r}")
    if r.get('language') not in S.LANGS:
        f.append(f"language {r.get('language')!r}")
    st = r.get('style')
    if not (isinstance(st, str) and 1 <= len(st) <= S.STYLE_LIMIT):
        f.append("style missing or over YuE2's limit")
    if not (isinstance(r.get('title'), str) and r['title'].strip()):
        f.append('title missing')
    for t in r.get('structure', []):
        if t not in S.TAGS:
            f.append(f"structure tag {t!r}")
    if not r.get('structure'):
        f.append('structure empty')
    for n, sec in enumerate(r.get('lyrics', []), 1):
        if sec.get('tag') not in S.TAGS:
            ly.append(f"section {n} tag {sec.get('tag')!r} not in the closed list")
        lines = sec.get('lines', [])
        if not (S.LINES_MIN <= len(lines) <= S.LINES_MAX):
            ly.append(f"section {n} ({sec.get('tag')}) has {len(lines)} lines; write {S.LINES_MIN}-{S.LINES_MAX}")
        for ln in lines:
            if BRACKET.search(ln):
                ly.append(f"section {n} has a tag or bracket inside a line: {ln[:40]!r}")
                break
    if not r.get('lyrics'):
        ly.append('no lyrics')
    return f, ly


def sung_matches_structure(r):
    """The lyric sections must be the structure minus instrumental ones, in order (a subsequence of the structure)."""
    it = iter(r.get('structure', []))
    return all(any(t == sec.get('tag') for t in it) for sec in r.get('lyrics', []))


def lyrics_language(r):
    """(whole-lyrics language by lingua, by langdetect, per-section lingua codes)."""
    secs = [' '.join(sec.get('lines', [])) for sec in r.get('lyrics', [])]
    whole = ' '.join(secs)
    a, b = lid(whole) if whole.strip() else (None, None)
    per = [lid(x)[0] if x.strip() else None for x in secs]
    return a, b, per


def lines_language(lines):
    return lid(' '.join(lines))


def recipe_loop_problems(r):
    """What the attempt loop sends back for a recipe (all derivable by code without knowing the request): bracket tags in lines,
    lyrics sections that do not follow the structure, lyrics in another language than the recipe says."""
    out = []
    _, ly = recipe_problems(r)
    out += [p for p in ly if 'bracket' in p or 'tag' in p or 'lines;' in p]
    if not sung_matches_structure(r):
        out.append(f"the lyrics sections ({', '.join(s.get('tag', '?') for s in r.get('lyrics', []))}) must follow the structure ({', '.join(r.get('structure', []))}) in order, skipping only instrumental sections")
    a, _b, per = lyrics_language(r)
    want = r.get('language')
    if a and want and a != want:
        out.append(f"the lyrics read as language '{a}' but language is '{want}': write every lyric line in the language the person asked for ('{want}')")
    return out


# ---------------------------------------------------------------- intent checks (scorer)
def key_regex(key):
    root = key.rstrip('m').replace('b', '[b♭]')
    if key.endswith('m'):
        return re.compile(rf"\b{root}\s?(m\b|minor|-?moll|menor)")
    return re.compile(rf"\b{root}(?!\s?(m\b|minor|-?moll|menor))\b")


def ops_by(ops, name):
    return [o for o in ops if o.get('op') == name]


def edit_intent(ops, ex, song):
    """(ok, why) for one edit turn against its expectation `ex` (case['expect']['edit'])."""
    k = ex.get('kind')
    if ex.get('any'):
        return bool(ops), 'any op'
    if k == 'reharm':
        rs = ops_by(ops, 'REHARMONIZE')
        if not rs:
            return False, 'no REHARMONIZE'
        cands = ex['one_of'] if ex.get('one_of') else [ex['bars']]
        tol = ex.get('tol', 0)
        for a, b in cands:
            inside = all(o['from_bar'] >= a - tol and o['to_bar'] <= b + tol for o in rs)
            covered = set()
            for o in rs:
                covered |= set(range(o['from_bar'], o['to_bar'] + 1))
            frac = len(covered & set(range(a, b + 1))) / (b - a + 1)
            if inside and frac >= ex.get('cover', 0.5):
                return True, f'bars {min(covered)}-{max(covered)} inside {a}-{b} (cover {frac:.0%})'
        spans = [(o['from_bar'], o['to_bar']) for o in rs]
        return False, f'REHARMONIZE spans {spans} not inside {cands}'
    if k == 'lyrics':
        rs = ops_by(ops, 'REWRITE_LYRICS')
        hit = [o for o in rs if o['block'] == ex['block']]
        if not hit:
            return False, f"REWRITE_LYRICS blocks {[o['block'] for o in rs]} != {ex['block']}"
        a, b = lines_language(hit[0]['lines'])
        if ex.get('lang') and a != ex['lang']:
            return False, f"lyric language {a}/{b} != {ex['lang']}"
        return True, f"block {ex['block']} in {a}"
    if k == 'tempo':
        ts = ops_by(ops, 'SET_TEMPO')
        if not ts:
            return False, 'no SET_TEMPO'
        lo, hi = ex['bpm']
        return (lo <= ts[0]['bpm'] <= hi), f"bpm {ts[0]['bpm']} in {lo}-{hi}?"
    if k == 'transpose':
        ts = ops_by(ops, 'TRANSPOSE')
        if not ts or ts[0]['semitones'] == 0:
            return False, 'no TRANSPOSE'
        if 'semitones' in ex and ts[0]['semitones'] != ex['semitones']:
            return False, f"semitones {ts[0]['semitones']} != {ex['semitones']}"
        return True, f"semitones {ts[0]['semitones']}"
    if k == 'style':
        ss = ops_by(ops, 'EDIT_STYLE')
        if not ss:
            return False, 'no EDIT_STYLE'
        ok = all(re.search(t, ss[0]['style'], re.I) for t in ex.get('style_has', []))
        return ok, 'style has ' + str(ex.get('style_has'))
    if k == 'repeat':
        rs = ops_by(ops, 'REPEAT')
        return (bool(rs) and rs[0]['section'] == ex['section']), f"REPEAT sections {[o['section'] for o in rs]} want {ex['section']}"
    return False, 'unknown kind'


def summarize_ops(ops):
    out = []
    for o in ops:
        n = o.get('op')
        if n == 'REHARMONIZE':
            out.append(f"REHARMONIZE bars {o['from_bar']}-{o['to_bar']}")
        elif n == 'SET_TEMPO':
            out.append(f"SET_TEMPO {o['bpm']}")
        elif n == 'TRANSPOSE':
            out.append(f"TRANSPOSE {o['semitones']:+d}")
        elif n in ('REPEAT', 'CUT'):
            out.append(f"{n} S{o['section']} {o['label']}")
        elif n == 'REWRITE_LYRICS':
            out.append(f"REWRITE_LYRICS block {o['block']} {o['tag']} #{o['occurrence']}")
        elif n == 'EDIT_STYLE':
            out.append(f"EDIT_STYLE {o['style'][:50]}")
        else:
            out.append(str(n))
    return '; '.join(out)
