"""MORC_ audio pipeline: public-domain sources -> Whisper -> 1-4 s mood-tagged mp3 clips.
Runs in GitHub Actions. Usage: python build_clips.py --worker URL --out DIR"""
import argparse, json, os, random, re, subprocess, sys, urllib.parse, urllib.request

UA = {"User-Agent": "MORC-audio-pipeline/1.0 (github.com/aryomsd/tars-living-face)"}
# Public-domain sources only. "check" must appear in the found item's title (guards against remakes).
SOURCES = [
    {"name": "night of the living dead", "id": "Night.Of.The.Living.Dead_1080p"},
    {"name": "plan 9", "q": 'title:("plan 9 from outer space") AND mediatype:movies', "check": "plan 9"},
    {"name": "his girl friday", "q": 'title:("his girl friday") AND mediatype:movies', "check": "girl friday"},
    {"name": "charade", "q": 'title:(charade) AND mediatype:movies AND year:1963', "check": "charade"},
    {"name": "newsreel", "q": 'title:("universal newsreel") AND mediatype:movies AND licenseurl:*publicdomain*', "random": True},
    {"name": "prelinger", "q": 'collection:prelinger AND licenseurl:*publicdomain*', "random": True},
    {"name": "nasa", "q": 'title:(apollo) AND mediatype:audio AND creator:(nasa)', "random": True},
]
MOODS = [  # first match wins as primary; up to 2 moods per clip
    ("boo", r"coming to get you|look out|run!|help!|kill|monster|dead|ghoul|zombie|scream"),
    ("greet", r"\b(hello|hi there|greetings|good (morning|evening|afternoon)|welcome|ladies and gentlemen|how do you do)\b"),
    ("hamburger", r"\b(eat|food|hungry|dinner|lunch|breakfast|coffee|sandwich|steak|cook)\b"),
    ("move", r"\b(lift ?off|launch|countdown|ignition|here we go|let'?s go|go go|move it|full speed|engines?)\b"),
    ("scan", r"\b(news|report|bulletin|attention|radio|signal|roger|copy|station|broadcast|stand by)\b"),
    ("angry", r"\b(get out|shut up|how dare|idiot|fool|stop it|you'?ll pay|enough)\b"),
    ("compliment", r"\b(beautiful|lovely|darling|sweetheart|gorgeous|brilliant|you'?re wonderful)\b"),
    ("happy", r"\b(wonderful|marvelous|swell|terrific|great|fine|fun|ha ha|hooray|love)\b"),
    ("dizzy", r"\b(problem|trouble|crazy|mad|confused|dizzy|spinning)\b"),
    ("sad", r"\b(sorry|alone|lost|poor|cry|miss you|goodbye)\b"),
    ("sleepy", r"\b(tired|sleep|asleep|bed|good ?night|yawn)\b"),
    ("return", r"\b(i'?m back|back again|return|came back|you'?re back)\b"),
    ("joke", r"\b(funny|joke|kidding|laugh)\b"),
    ("annoy", r"\b(oh no|listen|nonsense|ridiculous|what now|now look)\b"),
    ("surprised", r"\b(wow|good heavens|my goodness|good grief|what the|really\?)"),
    ("curious", r"\?$|\b(what is|who is|why|where|how come)\b"),
]
PER_SOURCE, TOTAL, WINDOWS, WIN_S = 8, 60, 2, 480

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()

def ia_find(src):
    if "id" in src: return src["id"]
    q = urllib.parse.urlencode({"q": src["q"], "fl[]": ["identifier", "title"], "rows": 50, "sort[]": "downloads desc", "output": "json"}, doseq=True)
    docs = json.loads(get("https://archive.org/advancedsearch.php?" + q))["response"]["docs"]
    if "check" in src: docs = [d for d in docs if src["check"] in str(d.get("title", "")).lower()]
    if not docs: return None
    return random.choice(docs[:30])["identifier"] if src.get("random") else docs[0]["identifier"]

def ia_media(ident):
    meta = json.loads(get(f"https://archive.org/metadata/{ident}"))
    files = meta.get("files", [])
    pref = ["VBR MP3", "64Kbps MP3", "128Kbps MP3", "Ogg Vorbis", "MPEG4", "512Kb MPEG4", "h.264", "Ogg Video"]
    best = None
    for f in files:
        if f.get("format") in pref:
            k = (pref.index(f["format"]), int(f.get("size") or 1e12))
            if best is None or k < best[0]: best = (k, f)
    if not best: return None, 0
    f = best[1]; ln = f.get("length") or "0"
    try: dur = float(ln) if ":" not in ln else sum(float(x) * 60 ** i for i, x in enumerate(reversed(ln.split(":"))))
    except ValueError: dur = 0
    return f"https://archive.org/download/{ident}/{urllib.parse.quote(f['name'])}", dur

def mood_of(text):
    t = text.lower(); found = [m for m, rx in MOODS if re.search(rx, t)]
    return "+".join(found[:2]) or None

def slug(t): return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", t.lower())).strip().replace("'", "")[:70].strip()

def run(cmd): return subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--worker", default=""); ap.add_argument("--out", required=True); a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True); existing = set()
    if a.worker:
        try: existing = {urllib.parse.unquote(c["src"].rsplit("/clip/", 1)[1]) for c in json.loads(get(a.worker.rstrip("/") + "/manifest.json"))["clips"]}
        except Exception as e: print("manifest read failed:", e)
    from faster_whisper import WhisperModel
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    total = 0
    for src in random.sample(SOURCES, len(SOURCES)):
        if total >= TOTAL: break
        try:
            ident = ia_find(src); url, dur = ia_media(ident) if ident else (None, 0)
        except Exception as e: print("skip", src["name"], e); continue
        if not url: print("no media", src["name"]); continue
        print("source", src["name"], ident, int(dur)); got = 0
        for w in range(WINDOWS):
            if got >= PER_SOURCE: break
            start = random.uniform(60, max(61, dur - WIN_S - 60)) if dur > WIN_S + 180 else 0
            win = f"/tmp/win_{w}.wav"
            try: run(["ffmpeg", "-y", "-ss", str(int(start)), "-i", url, "-t", str(WIN_S), "-vn", "-ac", "1", "-ar", "22050", win])
            except subprocess.CalledProcessError: print("  window failed"); continue
            segs, _ = model.transcribe(win, vad_filter=True, beam_size=5, condition_on_previous_text=False)
            for s in segs:
                if got >= PER_SOURCE or total >= TOTAL: break
                d, text = s.end - s.start, s.text.strip()
                words = len(text.split())
                if not (1.2 <= d <= 7.0 and 4 <= words <= 20) or s.avg_logprob < -0.45 or s.no_speech_prob > 0.3 or s.compression_ratio > 2.2: continue
                if not re.match(r"^[A-Z\"']", text) or not re.search(r"[.!?]$", text): continue  # whole sentences only
                mood = mood_of(text)
                if not mood: continue
                name = f"{mood} - {src['name']} - {slug(text)}.mp3"
                if name in existing or not slug(text): continue
                st, ln = max(0, s.start - 0.08), d + 0.18
                try: run(["ffmpeg", "-y", "-ss", f"{st:.2f}", "-i", win, "-t", f"{ln:.2f}", "-af", f"loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.03,afade=t=out:st={max(0, ln - 0.08):.2f}:d=0.08", "-ac", "1", "-ar", "22050", "-b:a", "48k", os.path.join(a.out, name)])
                except subprocess.CalledProcessError: continue
                existing.add(name); got += 1; total += 1; print("  +", name)
    print("new clips:", total)

if __name__ == "__main__": main()
