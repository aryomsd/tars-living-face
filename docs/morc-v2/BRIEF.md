# MORC v2.0 — Rebuild Brief (handover)
Owner: Aryo (AKAKBURGER). Assistant name: "eijke". Informal ID/EN ok. Short replies, minimal tool calls.
Written 2026-11-12 from the v1 session (R2.35–R2.42). v1 stays live at repo root until v2 is approved.

## Mission
A charming desk-companion character in the spirit of Cozmo: cute enough that everyone loves it,
sarcastic enough for adults. Ships as a **playable module inside the AKAKBURGER GOTW / Member Hub app**.
"Clone of Cozmo" = same *feel* (emotion, timing, body language, voice style). See IP note below.

## Aryo's requirements (verbatim intent, numbered as he gave them)
1. Voice similar to Cozmo (babble/vocalisations, not human TTS).
2. Translate Cozmo's physical gestures onto MORC's ring neck/body.
3. Sound FX: computer-like.
4. Release as an AKAKBURGER playable module in the current GOTW/Member Hub app.
5. Eyes: keep current MORC look — motion, shapes, behaviours.
6. Personality, emotion, behaviour, movement similar to Cozmo.
7. Basically a Cozmo clone (feel).
8. Wind-up / momentum / pre-phase on EVERY movement — exaggerate if needed; fluid cartoon animation with inertia, kinetics, physics.
9. Interface:
   1. Logo "MORC v2.0 by AKAK//DEV.WRKS" (red/white).
   2. Keep parametric + stats display and status in the bottom frame.
   3. Sound FX on/off.  4. Voice on/off.
   5. Body mode: current Target (neck rings) · Circle (add subtle marks so rotation is visible) · Eyes only · Rounded-rect screen like Cozmo.
   6. Lose everything else.
   7. Visual effects on/off (glow etc).
   8. AI speech engine on/off (like the Xiaozhi/ESP32 video).
   9. Add a ball or item to play with.
10. Render style like current: scanlines, glow, motion blur.
11. Context-appropriate anticipation, counter-movement, micro movement, micro gesture, follow-through, overshoot, ease in/out.
12. Emotional state connected to gestures, speech, SFX, behaviours.
13. Use the reference videos (they HAVE sound — data extracted below; uploads are not in the repo).
14. Remember each user's character pattern in the browser.
15. More interactivity that feeds mood stats: e.g. a few pokes = funny, too many = angry; play too long = tired; etc.

## Flags / decisions for Aryo (resolve early)
- **IP:** Cozmo is a commercial character (Anki / Digital Dream Labs). Inside a commercial app, copy the
  *principles* only. No Cozmo name, recorded sounds, animation files or screen art. All voice is our own synth.
- **Member Hub boundary:** Cloudflare account "AKAK GOTW v1" is Member Hub only. A MORC session NEVER touches it.
  v2 ships as a self-contained module (`<morc-bot>` web component + `MORC.mount()`), and the Member Hub
  integration is done later, inside the Member Hub project, with Aryo's approval.
- **AI speech:** Workers AI behind the existing Worker on the personal account (2a71697f8ca88cf88f05e85fef0cdbf8). Free plan only, $0.
  Default OFF. Per-user rate limit (it's public inside a member app). No third-party keys.
- **"Cookie":** use localStorage (cookie only as fallback). Local only. Later, optionally keyed to member ID via host config.

## What the references show (measured from Aryo's videos)
Frames/spectrograms are in `ref/`.
**Eyes (cozmo_eye_sheet.png, cozmo_eyes_*.jpg)**
- Two rounded rects, cyan, soft glow, squarish corners. Expression = lid masks (angled top lids = angry,
  curved bottom lid = happy crescent, drooped outer corners = sad, tall = surprised, small+low = fear,
  asymmetric squint = disgust). Shape barely deforms.
- Both eyes move as ONE unit. Idle = stepped micro-saccades of 1–3 px every 0.6–2.8 s, then still holds. No drift.
- Blink ≈100–150 ms. Eyes squash to one merged line. Blinks often fire *during* big look shifts. Occasional double-blink.
- Look shifts: small counter-move (~25–35% of the distance, 90–140 ms), squash, launch, ~10% overshoot, settle.
**Body (cozmo_personality_sheet, cozmo_attitude_sheet)**
- Dizzy: eyes wobble plus a body sway that decays. "Duck": lift flaps up/down fast. "Cat": crouch, then pounce.
- Refusing a fist bump: turns away, squints, backs up, glances back. Angry: head down, glare, stomps.
- Happy: hop plus side wiggle. Singing: rhythmic head bob. Sleepy: slow sway, droop.
**Voice (spec_cozmo_babble.jpg, spec_cozmo_sing_glide.jpg)**
- Babble ≈7 syllables/s, energy in a bright 1.6–2.4 kHz band, short syllables of 80–160 ms.
- Sung vowels: stacked harmonics, about 0.6 s, gliding up and then down.
- Emotive "wobble" calls: pitch zig-zag vibrato of about 5–7 Hz around 2.2 kHz.
- A long sustained 750 Hz tone plus dense content during "sings" (melody plus motor whine).
**RoboEyes (roboeyes_demo_sheet)**
- Everything tweened. Macros: laugh (eyes hop), confused (side shake), flicker (1 px shiver = cold/scared). Auto-blink 3 s + rand(0–2 s).
**Xiaozhi (xiaozhi_speech_sheet)**
- ESP32 with mic → cloud LLM (personality via system prompt) → neural TTS → speaker.
- Configured from a phone web panel. Lines are short and cheeky.

## HARD RULES (Aryo, 2026-11-12): $0 cost + snappy UX first
- **No money.** Everything runs on free tiers only. Keep the personal Cloudflare account on the Workers **Free** plan.
  There, Workers AI stops at 10k neurons/day and cannot bill. When it's exhausted, MORC falls back to babble silently.
- **Never lag.** MORC reacts instantly to every input (eyes, posture, SFX, babble) and never waits on the network.
  Network results arrive as a bonus on top of a reaction that has already started.
- No heavy downloads: no in-browser LLM/TTS models (Kokoro/WebLLM rejected for this reason).

## AI speech plan (phase 6), all free
- **Pre-baked voice for scripted lines.** The pipeline renders every event/mood line once with Workers AI TTS (MeloTTS),
  applies the robot/Cozmo filter, and stores the result in R2. Playback is instant and costs 0 neurons per visit.
  New lines are rendered on the daily run. This covers ~90% of what MORC "says".
- **Live chat (opt-in):**
  - Hearing: browser SpeechRecognition where it exists (free, instant). Otherwise Workers AI Whisper-turbo.
  - Brain: Workers AI small LLM (llama-3.2-3b or 3.1-8b-fast). **Streamed.** Personality system prompt, replies ≤25 words.
  - Sentence pipelining: as soon as the first sentence finishes streaming, send it to TTS while the rest generates.
  - Voice: MeloTTS → WebAudio pitch-up + bandpass + light bitcrush. Eyes pulse with loudness. Babble covers the gaps.
  - While waiting, MORC acts instantly: a "listening" pose on speech end, then a "thinking" eye-scan and hum.
    A slow network looks like personality, not lag.
  - Budget guard in the Worker: per-user rate limit, and a daily counter that stops at the free allowance.
    Then babble-only, plus the line "brain's tired, ask tomorrow".
- The AI code is lazy-loaded only when the toggle is switched on. The core bundle stays small.

## Performance budget
- Core bundle < 60 KB gzipped, no external runtime deps. First reaction < 100 ms after load.
- 60 fps on mid-range Android. Cap DPR at 2. Cache eye glows on offscreen canvases.
  Pause the loop when the tab is hidden. VFX auto-drops (blur → glow → scanlines) if frame time > 20 ms.
- Audio: one shared AudioContext, synth nodes pooled/recycled, unlocked on the first tap.

## Proposed architecture (v2, from scratch, in /v2/)
Vanilla JS ES modules, no framework. Optional one-step esbuild bundle → `dist/morc.js` for embedding.
- `core/loop` — fixed-step physics at 120 Hz, render on rAF, dt clamp.
- `physics/spring` — damped springs plus an `act(goal,{windup,overshoot,hold,exaggerate})` helper.
  EVERY move runs 4 phases: anticipation (counter-move + squash) → action (fast ease-in, stretch) →
  overshoot/follow-through → settle (+ micro). Global `exaggeration` param (0.5–2.0).
- `body/` — modes Target (neck rings, ported from v1), Circle (with tick marks), EyesOnly, Screen (rounded rect).
  Cozmo→MORC gesture map:
  - head tilt → face pitch/yaw offset
  - lift → ring compression/expansion
  - tread turn → whole-body yaw + slide
  - hop, wiggle, recoil, crouch–pounce, sway, stomp
- `eyes/` — port the v1 renderer (offscreen canvas, feathered lid erase, glow). Preset table of lid masks.
  Eyes locked as one unit, micro-saccades, blink-on-look, macros laugh/confused/shiver.
  Deformation clamped (w 0.72–1.32, h 0.08–1.28).
- `mind/` — stats: joy, energy, irritation, curiosity, bond, boredom, fatigue. Decay plus event deltas.
  Mood = argmax with hysteresis. Each mood → {eye preset, posture, gesture set, SFX, babble pattern, line pool}.
- `interact/`
  - pokes counted in a 6 s window: 1–3 giggle, 4–6 annoyed, 7+ angry, then sulk
  - pet/hold = happy, sleepy if long
  - fling/drag = dizzy
  - shake device (DeviceMotion) = dizzy/angry
  - long idle = bored → sleep → wake on touch
  - long play = fatigue
  - toys: ball (physics; chase / pounce / bat away; fetch) and cube (stack / lift)
  - burger treat (brand easter egg)
- `audio/`
  - `sfx` — computer-like WebAudio synth: beeps, data chirps, servo whirr tied to movement speed, confirm/deny.
  - `voice` — Cozmo-style babble synth per the measurements above (formant bandpass, 6–8 syl/s, glides, 5–7 Hz vibrato, sung vowels).
  - `ai` (opt-in, lazy-loaded) — see "AI speech plan": pre-baked lines from R2 + streamed live chat, babble fallback.
- `memory/` — per-user localStorage: bond, trait drift (playful ↔ grumpy, chatty ↔ quiet), counters, last seen.
  Greeting depends on bond and time away.
- `ui/`
  - header logo "MORC v2.0 by AKAK//DEV.WRKS"
  - bottom frame: parametric readouts + stats bars + status line
  - toggles: SFX, Voice, AI speech, VFX, body mode, add toy
- `render/` — canvas 2D. VFX on: scanlines, glow, motion blur (trail). VFX off: flat and cheap (low-end phones).
- `embed/` — `<morc-bot worker-url member-id body-mode>`, plus a postMessage API for the host app.

## Build phases (one PR each; Aryo merges with "merge N")
1. Skeleton: loop, springs + `act()`, Target body, eyes port, UI shell + toggles, VFX render.
2. Mind + interactions (pokes/pet/fling/idle/sleep), with posture and gesture map wired to mood.
3. Audio: SFX + babble voice, mapped to mood.
4. Body modes Circle / EyesOnly / Screen, plus toys (ball first).
5. Per-user memory + trait drift.
6. AI speech (Worker, opt-in, rate-limited).
7. Embed package + integration notes for Member Hub (no Member Hub changes from this repo).

## Keep / drop from v1
- **Keep:** the eye renderer approach, the R2.41/R2.42 motion numbers, the neck-ring physics, the Worker
  `morc-audio.aryomsd.workers.dev` (reuse it for AI routes), and the repo/Pages setup.
- **Drop:** radio/movie-clip mode, the voice-pack PRs (#39/#40, ignored), browser-TTS prosody, birthday content,
  the command log, and every other v1 UI.
- The audio pipeline (`.github/workflows/morc-audio.yml`) can be disabled once v2 drops radio mode. Ask first.

## Working rules
- Repo aryomsd/tars-living-face. Session: `add_repo` with push access; shallow clone; after a push, fetch the branch ref.
  `gh` works over REST only. The Actions API is blocked by the proxy, so use the built-in browser for Actions.
- Merges to main only on an explicit "merge N" in Aryo's latest message.
- Surgical PRs. Report SHA + tested / not tested. Aryo tests on a real phone.
- Prefer Claude Code locally: serve /v2 and open it on the phone over LAN for fast tuning.
