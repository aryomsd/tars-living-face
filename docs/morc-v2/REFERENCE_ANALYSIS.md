# MORC v2 — Reference video analysis
Source: 4 screen recordings Aryo uploaded on 2026-11-11/12. They are not in the repo: they're third-party content and this is a public repo.
Analysed frame-by-frame (8–10 fps strips) and by audio spectrogram. Frame sheets are in `ref/`.
Use this file instead of the videos. **Copy the principles, not Cozmo's exact art or sounds (IP).**

---
## 1. Cozmo — "eyes & attitude" (130 s, has sound) · `ref/cozmo_attitude_sheet.jpg`, `cozmo_eyes_10fps_a.jpg`, `cozmo_eyes_8fps_b.jpg`

### Eye mechanics (measured)
- **Shape:** two cyan rounded squares, corner radius ≈ 15–20% of size, gap ≈ 15% of eye width, soft bloom.
  Not circles, not pills.
- **Blink = 1 frame closed (≤100 ms).** Both eyes collapse to ONE thin horizontal line that is wider than the eyes,
  then reopen on the next frame. No slow fade.
- **KEY INSIGHT: blinks hide transitions.** Expression and position changes go *through* a blink frame:
  shape A → line → shape B (e.g. 3.25 s line → 3.5 s new pose; 5.375 s line → 5.625 s new pose).
  Use this in MORC: any big eye-preset change ≥ 40% different → route it through a blink.
- **Look shifts:** the whole pair jumps together (never independently). On fast shifts the eyes squash slightly
  along the travel direction, often with a blink mid-jump. Settle in ~150–250 ms with a small overshoot.
- **Idle:** long still holds (1–3 s) broken by tiny stepped shifts (1–3 px at 1080p scale) and slight
  size breathing. Never continuous drift.
- **Head tilt:** when the head pitches, the eyes compress at the top/bottom of the screen and squash flat
  (wide, low height) — a perspective cue. MORC: when the face pitches, scale eye height by cos(pitch)
  and shift them toward the screen edge.

### Gestures (timestamps in the original 130 s clip)
| t | Scene | Body | Eyes |
|---|---|---|---|
| 0–8 s | approach | drives toward camera, turns 30° to look | normal, quick look-around blinks |
| 9–30 s | close idle | micro head bob, tiny yaw | stepped micro-shifts, blinks every 2–5 s |
| 33–51 s | "refuses a fist bump" | backs away, turns aside, glances back | flat line (unimpressed) → slides to corner → **chevrons `> <`** (annoyed squint) → small/narrow |
| 54–75 s | "sings" | rhythmic head bob ~2 Hz, slight sway | happy flat/crescent, steady |
| 78–90 s | "fire truck" | lift raised, zooms around cubes | wide excited |
| 96–105 s | "when you don't subscribe" | **leans in close to camera**, head down | angry slanted lids, low |
| 108–115 s | "cat" | crouch low, slow creep | narrow flat stalking eyes |

### Audio (`ref/spec_cozmo_sing_glide.jpg`)
- **Sung vowels:** clear stacked harmonics with the fundamental ~400–800 Hz. ~0.6 s each, pitch glides up and then down.
- **Emotive wobble call:** pitch zig-zag vibrato at **~5–7 Hz**, centred ~2.2 kHz, ~1.5 s long.
- **Sustained ~750 Hz tone** under the "singing" (melody + motor whine).
- Short servo/motor whirrs accompany each body move. Movement is never silent → MORC SFX: a servo whirr whose pitch follows speed.

---
## 2. Cozmo — "personality" (65 s, has sound) · `ref/cozmo_personality_sheet.jpg`, `ref/spec_cozmo_babble.jpg`
| t | Scene | What sells the character |
|---|---|---|
| 2–9 s | table edge: "What am I going to do now?" | stops at the edge, looks DOWN, scared-small eyes, backs up. Fear = shrink + retreat |
| 10–15 s | "very dizzy" | eyes become irregular/scrambled shapes and wobble; body sways in decaying circles |
| 16–21 s | "duck" | lift flaps up/down fast, body tips back, happy squint — silly, playful |
| 22–32 s | idle/turning | turns in place, looks around, glances |
| 33–47 s | "cat" | crouch, slow creep, narrow flat eyes, then pounce |
| 48–64 s | "when you don't subscribe" | slow approach, head down, angry slant, fills the frame — playful intimidation |

**Babble voice (spec 16–22 s):**
- ~**7 syllables/s**, each 80–160 ms.
- Energy concentrated in a **1.6–2.4 kHz band** (bright, small-robot formant).
- Gaps of ~0.1 s between phrases. Phrases of 1–2 s.
- Then a **sung vowel**: ~0.8 s, harmonics at 400/800/1200…, a smooth arch (up then down).
- Synth recipe: sawtooth or pulse source → two bandpasses (~700 Hz Q4, ~2 kHz Q6) → fast attack (10 ms) / decay per syllable.
  Per-syllable random pitch within the mood range, plus 22–32 Hz micro-vibrato for "buzz" and 5–7 Hz slow vibrato on held notes.
  - happy: rising contour, high
  - sad: falling, slow, low
  - angry: low grumble, fast
  - curious: rising end ("?")
  - surprised: big upward glide

---
## 3. FluxGarage RoboEyes demo (306 s) · `ref/roboeyes_demo_sheet.jpg`
Open-source Arduino library. The creator explains it in subtitles:
- **Auto-blinker:** interval = 3 s minimum + random 0–2 s.
- **Idle mode:** eyes reposition randomly every 1–4 s. Everything is **tweened** (no jumps).
- **Moods:** tired/sad (droopy outer lids), angry (inner lids slant down), happy (bottom-lid crescent). Lids are triangles
  laid over rounded rects.
- **Macros:**
  - laugh: eyes hop up/down rapidly
  - confused: eyes shake left/right
  - **flicker**: an alternating 1 px offset in x and y = shivering (tired + flicker = cold/scared; angry + flicker = "about to explode")
- **Curious mode:** the eye on the side being looked at grows bigger (perspective). **Cyclops** option.
- **Config:** eye width, height, border radius, spacing.
- "Glitch is a feature" — the low-res flicker adds charm.

---
## 4. Xiaozhi ESP32 AI speech (108 s) · `ref/xiaozhi_speech_sheet.jpg`
Open-source `xiaozhi-esp32` firmware by Huy Vector.
- **Setup flow:**
  1. Flash via ESPHome Web.
  2. The device makes its own Wi-Fi AP ("Xiaozhi-xxxx") with a captive portal at 192.168.4.1.
  3. Link it on xiaozhi.me with a 6-digit code shown on the OLED.
  4. Configure in the web panel: Role (personality prompt), Model & memory, Speaker recognition, Voice/language.
- **Pipeline:** mic → cloud STT → LLM → neural TTS → audio stream back. The ESP32 only does I/O.
- **UI:** two teal rounded-square eyes on the OLED, with status/subtitle text scrolling under the eyes while it talks.
  Eyes stay mostly still while speaking (cheap).
- **Personality example:** "Who are you?" → "I'm the ESP, your tiny, cheeky pocket companion…"
  Short, self-aware, a bit sassy.
- **MORC takeaways:**
  - Personality comes from a system prompt.
  - Show a subtitle line under the eyes while speaking.
  - Keep replies short.
  - MORC must beat it on animation: eyes react while it talks (loudness pulse, emphasis blinks).

---
## Cross-cutting rules for MORC v2 (derived)
1. Eyes = one locked unit. Expression lives in the lids, not in deformation.
2. Big changes go through a blink frame. Small changes are tweened.
3. Every body move has a sound (servo whirr ∝ speed) and a wind-up.
4. Idle = holds plus stepped micro-shifts, a blink every 3–5 s, and occasional double blinks.
5. Emotions read through the BODY first (approach/retreat, head up/down, crouch, sway), then the eyes, then the voice.
6. Fear = small + retreat. Anger = low + lean in. Joy = hop/bob + crescent eyes. Boredom = droop + slow sway.
   Dizzy = scrambled eyes + decaying sway. Curious = lean + bigger near eye.
7. Voice is babble (6–8 syl/s, 1.6–2.4 kHz band) plus sung vowel arcs and 5–7 Hz wobble on emotional peaks.
