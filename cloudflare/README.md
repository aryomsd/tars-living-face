# MORC_ shared audio library (Cloudflare R2 + Worker, free tier)

Everyone who opens MORC hears these clips (radio mode). **Only public-domain, CC0 or clips you hold a license for.**

## Deploy (once)
1. Cloudflare dashboard → R2 → create bucket `morc-audio`.
2. Workers → Create → paste `morc-audio-worker.js` → Settings → Bindings → R2 bucket, variable `AUDIO` → `morc-audio`. Deploy.
   (or: `npx wrangler deploy` in this folder)
3. Send eijke the Worker URL → it goes into `MORC_AUDIO_WORKER` in index.html. Test before that with `index.html?audio=<worker-url>`.

## Add clips
Upload to the bucket under `clips/`, 1–4 s, mp3:
`<mood> - <source> - <line>.mp3` — several moods: `greet+happy - nasa - liftoff.mp3`
Moods: greet return happy glee curious annoy angry bored sad sulk dizzy boo joke move pounce scan compliment surprised hamburger pet sleepy neutral.
New uploads show up within ~5 min.

## Where to get clips (public domain / CC0)
| Source | What to cut | Moods |
|---|---|---|
| Night of the Living Dead (1968, PD) — archive.org/details/Night.Of.The.Living.Dead_1080p | "They're coming to get you, Barbara", screams, radio emergency bulletins | boo, provoke, scan |
| Plan 9 from Outer Space (1957, PD) — search archive.org | Criswell's opening narration ("Greetings, my friend…"), alien ruler lines | greet, return, joke |
| His Girl Friday (1940, PD) — search archive.org | fast-talk newsroom banter, phone-call lines | annoy, joke, curious |
| Charade (1963, PD) — Internet Archive screening post | Cary Grant / Audrey Hepburn quips | compliment, curious, happy |
| Universal Newsreels (PD) — archive.org | 1940s announcer voice: "And now…", "Latest news!" | greet, scan, move |
| Old-time radio (PD episodes) — archive.org Old Time Radio collections | announcer intros, sci-fi radio drama lines | greet, sleepy, curious |
| NASA audio — nasa.gov/historical-sounds | "Liftoff", countdowns, "Roger", comm beeps, Mission Control | move, pounce, scan, return |
| Kenney Sci-Fi Sounds (CC0) — kenney.nl/assets/sci-fi-sounds | beeps, zaps, power-ups | scan, neutral, surprised |
| Wikimedia Commons sound resources | CC0 / PD voices and effects | any |

Check each film's PD status before uploading (e.g. Wikipedia "List of films in the public domain in the United States"). Some later restorations/soundtracks have new copyrights.
