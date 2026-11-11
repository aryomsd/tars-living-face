"""MORC_ library pass: equalize loudness + assign moods for every clip in R2 clips/ (incl. manual uploads).
- Measures each clip (EBU R128). Off-target (outside -16 LUFS +-1, true peak > -1 dBTP) or non-mp3 -> two-pass
  loudnorm, silence trim, short fades, mono 24 kHz 64 kbps mp3.
- Name not in "<mood>[+mood] - <source> - <line>" form -> Whisper transcript -> mood tagger -> renamed.
- Original is copied to originals/<name> before anything is overwritten or deleted (worker ignores that prefix).
Idempotent: clips already on target with a valid name are skipped. Usage: python normalize_library.py --worker URL"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from build_clips import mood_of, slug, UA

VALID = {'boo','pounce','curious','annoy','angry','happy','glee','dizzy','sleepy','greet','return','joke','scan','provoke',
         'touch','move','sulk','bored','compliment','surprised','sad','neutral','hamburger','pet'}
TARGET_I, TARGET_TP, TOL = -16.0, -1.5, 1.0
_model = None

def fetch(url, dest=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        data = r.read()
    if dest: open(dest, 'wb').write(data)
    return data

def measure(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr)
    return json.loads(m.group(0)) if m else None

def transcribe(path):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = _model.transcribe(path, beam_size=1, vad_filter=True)
    return " ".join(s.text.strip() for s in segs).strip()

def parse(stem):
    parts = [x.strip() for x in re.split(r"\s+-\s+", stem)]
    moods = [m.strip() for m in parts[0].lower().split("+") if m.strip()] if parts else []
    ok = len(parts) >= 3 and moods and all(m in VALID for m in moods)
    return ok, parts

def wr(*args): subprocess.run(["wrangler", "r2", "object", *args, "--remote"], check=True)

def main():
    a = argparse.ArgumentParser(); a.add_argument("--worker", required=True); a.add_argument("--dry", action="store_true"); a = a.parse_args()
    base = a.worker.rstrip("/")
    keys = json.loads(fetch(base + "/keys"))
    names = {k["key"][6:] for k in keys}
    tmp = tempfile.mkdtemp()
    done = skipped = failed = 0
    for k in keys:
        name = k["key"][6:]
        stem, ext = os.path.splitext(name)
        try:
            src = os.path.join(tmp, "in" + (ext or ".bin"))
            fetch(base + "/clip/" + urllib.parse.quote(name), src)
            ms = measure(src)
            if not ms: raise RuntimeError("unreadable audio")
            I, TP = float(ms["input_i"]), float(ms["input_tp"])
            ok_name, parts = parse(stem)
            ok_level = abs(I - TARGET_I) <= TOL and TP <= -1.0 and ext.lower() == ".mp3"
            if ok_name and ok_level:
                skipped += 1; continue
            new = name
            if not ok_name:
                text = transcribe(src)
                hint = " ".join(parts)
                moods = mood_of(text) or mood_of(hint) or "neutral"
                given = [m for m in parts[0].lower().split("+") if m.strip() in VALID] if parts else []
                if given: moods = "+".join(given[:2])           # keep moods Aryo typed, fill the rest
                source = slug(parts[1] if given and len(parts) >= 2 else (parts[0] if len(parts) >= 2 else "movie")) or "movie"
                line = slug(text) or slug(parts[-1]) or "untitled"
                new = f"{moods} - {source} - {line}.mp3"; n = 2
                while new != name and new in names:
                    new = f"{moods} - {source} - {line} {n}.mp3"; n += 1
            out = os.path.join(tmp, "out.mp3")
            ln = (f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:measured_I={ms['input_i']}:measured_TP={ms['input_tp']}"
                  f":measured_LRA={ms['input_lra']}:measured_thresh={ms['input_thresh']}:offset={ms['target_offset']}:linear=true")
            af = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,"
                  "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,"
                  f"{ln},afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse")
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-af", af,
                            "-ac", "1", "-ar", "24000", "-b:a", "64k", out], check=True)
            after = measure(out)
            print(f"{'DRY ' if a.dry else ''}{name!r} I={I:.1f} TP={TP:.1f} -> {new!r} I={float(after['input_i']):.1f} TP={float(after['input_tp']):.1f}")
            if a.dry: done += 1; continue
            wr("put", f"morc-audio/originals/{name}", "--file", src)
            wr("put", f"morc-audio/clips/{new}", "--file", out, "--content-type", "audio/mpeg")
            if new != name:
                wr("delete", f"morc-audio/clips/{name}"); names.discard(name); names.add(new)
            done += 1
        except Exception as e:
            failed += 1; print(f"FAILED {name!r}: {e}")
    print(f"library pass: {done} fixed, {skipped} already ok, {failed} failed, {len(keys)} total")

if __name__ == "__main__":
    main()
